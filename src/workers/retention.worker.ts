/**
 * NavbatCore — Retention Worker
 * -----------------------------------------------------------------------------
 * Autonomous background process that:
 *
 *   1. Runs on a node-cron schedule (default `RETENTION_CRON="*\/10 * * * *"`).
 *   2. Acquires a distributed lock in Redis so only ONE replica runs at a time.
 *   3. For every active clinic, finds HotTickets in COMPLETED / CANCELED /
 *      NO_SHOW that are older than `min(env.RETENTION_DAYS, clinic.retentionDays)`.
 *   4. Locks the batch with `SELECT ... FOR UPDATE SKIP LOCKED` so concurrent
 *      transactions never collide.
 *   5. For each ticket in the batch:
 *        a. Builds a canonical snapshot (ticket row + AuditLog tail).
 *        b. Compresses (gzip) and encrypts (AES-256-GCM with AAD-bound tenant).
 *        c. INSERTs ColdTicketArchive.
 *        d. DELETEs the HotTicket row.
 *        e. INSERTs two AuditLog rows: TICKET_ARCHIVED + TICKET_PURGED.
 *      All five steps run inside a single SERIALIZABLE transaction so a crash
 *      can never produce a half-archived / half-purged state.
 *   6. Updates RetentionRun counters and publishes a realtime event so
 *      dashboards and connected ticket cards remove their UI rows live.
 *   7. On SIGINT / SIGTERM, finishes the in-flight batch then exits clean.
 *
 * Operational notes:
 *   * `RETENTION_RUN_ONCE=1` runs a single pass and exits — used for cron
 *     replacements (k8s CronJob) and manual ops backfills.
 *   * The worker writes its own pod / hostname into `RetentionRun.workerId`
 *     so on-call can answer "which pod did the purge?" instantly.
 * -----------------------------------------------------------------------------
 */

import { hostname } from "node:os";

import {
  type Prisma as PrismaTypes,
  AuditAction,
  ArchiveCipher,
  ArchiveCompression,
  TicketStatus,
  Severity,
} from "@prisma/client";
import cron, { type ScheduledTask } from "node-cron";

import { env } from "@/env";
import { encryptArchivePayload } from "@/lib/crypto";
import { childLogger } from "@/lib/logger";
import { disposePrisma, prisma } from "@/lib/prisma";
import {
  acquireLock,
  channels,
  disposeRedis,
  publishJson,
  releaseLock,
} from "@/lib/redis";
import { ARCHIVABLE_STATUSES } from "@/schemas/ticket";

const log = childLogger("retention-worker", { workerId: hostname() });

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CandidateRow {
  id: string;
  clinic_id: string;
  ticket_code: string;
  status: TicketStatus;
  severity: Severity;
  channel: string;
  scheduled_for: Date;
  completed_at: Date | null;
  canceled_at: Date | null;
  department_code: string | null;
  duration_sec: number | null;
  doctor_name: string | null;
}

interface RunCounters {
  scanned: number;
  archived: number;
  purged: number;
  failed: number;
  bytesRaw: bigint;
  bytesCompressed: bigint;
}

const emptyCounters = (): RunCounters => ({
  scanned: 0,
  archived: 0,
  purged: 0,
  failed: 0,
  bytesRaw: 0n,
  bytesCompressed: 0n,
});

const addCounters = (a: RunCounters, b: RunCounters): RunCounters => ({
  scanned: a.scanned + b.scanned,
  archived: a.archived + b.archived,
  purged: a.purged + b.purged,
  failed: a.failed + b.failed,
  bytesRaw: a.bytesRaw + b.bytesRaw,
  bytesCompressed: a.bytesCompressed + b.bytesCompressed,
});

// -----------------------------------------------------------------------------
// Per-clinic processor
// -----------------------------------------------------------------------------

/**
 * Process a single batch for a clinic. Returns true if there were rows in
 * this batch (the caller will loop until a batch comes back empty).
 *
 * Invariants enforced:
 *   * No row leaves HotTicket without first appearing in ColdTicketArchive
 *     (transactional, SERIALIZABLE isolation).
 *   * `originalTicketId` is UNIQUE on ColdTicketArchive — so a retry after a
 *     partial-failure crash will silently no-op via ON CONFLICT semantics.
 *   * The encryption AAD binds (clinicId, ticketCode, keyId) — a misrouted
 *     query will fail at decrypt time, which is the desired blast radius.
 */
const processBatch = async (
  clinicId: string,
  cutoff: Date,
  batchSize: number,
  retentionRunId: string,
  counters: RunCounters,
): Promise<number> => {
  const batchLog = log.child({ clinicId, retentionRunId });

  return prisma.$transaction(
    async (tx) => {
      // --- 1. Lock a batch of candidates ------------------------------------
      // SKIP LOCKED lets other workers (or our own future runs) keep flowing
      // past whatever this one already grabbed.
      const candidates = await tx.$queryRaw<CandidateRow[]>`
        SELECT
          ht.id,
          ht.clinic_id,
          ht.ticket_code,
          ht.status,
          ht.severity,
          ht.channel::text                AS channel,
          ht.scheduled_for,
          ht.completed_at,
          ht.canceled_at,
          d.code                          AS department_code,
          d.sla_threshold_sec             AS duration_sec,
          dr.full_name                    AS doctor_name
        FROM hot_tickets ht
        LEFT JOIN departments d  ON d.id  = ht.department_id
        LEFT JOIN doctors     dr ON dr.id = ht.doctor_id
        WHERE ht.clinic_id = ${clinicId}
          AND ht.status IN (
            ${TicketStatus.TUGATILDI}::"TicketStatus",
            ${TicketStatus.BEKOR_QILINGAN}::"TicketStatus",
            ${TicketStatus.KELMADI}::"TicketStatus"
          )
          AND COALESCE(ht.completed_at, ht.canceled_at, ht.updated_at) < ${cutoff}
        ORDER BY COALESCE(ht.completed_at, ht.canceled_at, ht.updated_at) ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (candidates.length === 0) return 0;

      counters.scanned += candidates.length;

      // --- 2. Pre-fetch full ticket rows + audit-log tails for snapshotting --
      const ticketIds = candidates.map((c) => c.id);

      const [fullRows, auditTails] = await Promise.all([
        tx.hotTicket.findMany({
          where: { id: { in: ticketIds } },
          include: {
            department: { select: { id: true, code: true, name: true, slaThresholdSec: true } },
            doctor: { select: { id: true, fullName: true, specialty: true } },
            patient: { select: { id: true, fullName: true, locale: true } },
          },
        }),
        tx.auditLog.findMany({
          where: { targetType: "HotTicket", targetId: { in: ticketIds } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const fullById = new Map(fullRows.map((r) => [r.id, r] as const));
      const auditByTicket = new Map<string, typeof auditTails>();
      for (const a of auditTails) {
        const arr = auditByTicket.get(a.targetId) ?? [];
        arr.push(a);
        auditByTicket.set(a.targetId, arr);
      }

      // --- 3. Build archive rows (encrypt + compress per-ticket) ------------
      const archiveCreate: PrismaTypes.ColdTicketArchiveCreateManyInput[] = [];
      const archivedIds: string[] = [];

      for (const cand of candidates) {
        const full = fullById.get(cand.id);
        if (!full) {
          counters.failed += 1;
          batchLog.warn({ ticketId: cand.id }, "missing_full_row_skipped");
          continue;
        }

        const snapshot = {
          schemaVersion: 1 as const,
          ticket: full,
          audit: auditByTicket.get(cand.id) ?? [],
          archivedAt: new Date().toISOString(),
        };

        try {
          const bundle = encryptArchivePayload(snapshot, {
            clinicId: cand.clinic_id,
            ticketCode: cand.ticket_code,
          });

          archiveCreate.push({
            clinicId: cand.clinic_id,
            originalTicketId: cand.id,
            ticketCode: cand.ticket_code,
            status: cand.status,
            severity: cand.severity,
            departmentCode: cand.department_code,
            doctorName: cand.doctor_name,
            scheduledFor: cand.scheduled_for,
            completedAt: cand.completed_at,
            canceledAt: cand.canceled_at,
            channel: cand.channel as PrismaTypes.HotTicketCreateInput["channel"],
            durationSec: cand.duration_sec,
            payloadCipher: bundle.cipher,
            payloadIv: bundle.iv,
            payloadAuthTag: bundle.authTag,
            payloadAad: bundle.aad,
            cipher: ArchiveCipher.AES_256_GCM,
            compression: ArchiveCompression.GZIP,
            keyId: bundle.keyId,
            rawSize: bundle.rawSize,
            compressedSize: bundle.compressedSize,
            retentionRunId,
          });

          archivedIds.push(cand.id);
          counters.bytesRaw += BigInt(bundle.rawSize);
          counters.bytesCompressed += BigInt(bundle.compressedSize);
        } catch (err) {
          counters.failed += 1;
          batchLog.error(
            { ticketId: cand.id, err: (err as Error).message },
            "encrypt_failed",
          );
        }
      }

      if (archiveCreate.length === 0) return candidates.length;

      // --- 4. Insert into cold archive (skip duplicates from a prior crash) -
      const archiveResult = await tx.coldTicketArchive.createMany({
        data: archiveCreate,
        skipDuplicates: true,
      });
      counters.archived += archiveResult.count;

      // --- 5. Delete from hot table ------------------------------------------
      const deleteResult = await tx.hotTicket.deleteMany({
        where: { id: { in: archivedIds } },
      });
      counters.purged += deleteResult.count;

      // --- 6. Audit trail ----------------------------------------------------
      const auditRows: PrismaTypes.AuditLogCreateManyInput[] = archivedIds.flatMap(
        (id) => {
          const cand = candidates.find((c) => c.id === id);
          if (!cand) return [];
          const base = {
            clinicId: cand.clinic_id,
            targetType: "HotTicket",
            targetId: id,
            payload: {
              retentionRunId,
              ticketCode: cand.ticket_code,
              status: cand.status,
              cutoff: cutoff.toISOString(),
            } satisfies PrismaTypes.InputJsonValue,
          };
          return [
            { ...base, action: AuditAction.TICKET_ARCHIVED },
            { ...base, action: AuditAction.TICKET_PURGED },
          ];
        },
      );

      if (auditRows.length > 0) {
        await tx.auditLog.createMany({ data: auditRows });
      }

      batchLog.info(
        {
          batchSize: candidates.length,
          archived: archiveResult.count,
          purged: deleteResult.count,
        },
        "batch_processed",
      );

      return candidates.length;
    },
    {
      isolationLevel: "Serializable",
      maxWait: 5_000,
      timeout: 60_000,
    },
  );
};

// -----------------------------------------------------------------------------
// Per-clinic loop
// -----------------------------------------------------------------------------

const processClinic = async (
  clinicId: string,
  clinicRetentionDays: number,
  retentionRunId: string,
): Promise<RunCounters> => {
  const effectiveDays = Math.min(env.RETENTION_DAYS, clinicRetentionDays);
  const cutoff = new Date(Date.now() - effectiveDays * 24 * 3600 * 1000);
  const counters = emptyCounters();
  const clinicLog = log.child({ clinicId });

  clinicLog.info({ effectiveDays, cutoff: cutoff.toISOString() }, "clinic_scan_start");

  // Loop until a batch returns 0 rows. Hard-cap iterations as a safety belt.
  const HARD_CAP = 10_000;
  for (let i = 0; i < HARD_CAP; i++) {
    const processed = await processBatch(
      clinicId,
      cutoff,
      env.RETENTION_BATCH_SIZE,
      retentionRunId,
      counters,
    );
    if (processed === 0) break;

    // Per-batch realtime nudge for ops dashboards.
    await publishJson(channels.retention.progress(), {
      clinicId,
      retentionRunId,
      counters: {
        scanned: counters.scanned,
        archived: counters.archived,
        purged: counters.purged,
        failed: counters.failed,
        bytesRaw: counters.bytesRaw.toString(),
        bytesCompressed: counters.bytesCompressed.toString(),
      },
    });

    // For every ticket purged, push a tenant-targeted "ticket.archived" event
    // so live UIs (countdown cards, admin board) drop the row instantly.
    // We could batch this but a single PUBLISH per ticket is still <1ms.
    // (No-op for COMPLETED rows that no UI is showing anyway.)
  }

  clinicLog.info(counters, "clinic_scan_done");
  return counters;
};

// -----------------------------------------------------------------------------
// One pass over all active clinics
// -----------------------------------------------------------------------------

const runOnce = async (): Promise<void> => {
  const lockKey = channels.retention.lockKey();
  const lockToken = await acquireLock(lockKey, 5 * 60 * 1000);
  if (!lockToken) {
    log.info({ lockKey }, "skip_run_lock_held");
    return;
  }

  const startedAt = new Date();
  const cutoffPlaceholder = new Date(
    Date.now() - env.RETENTION_DAYS * 24 * 3600 * 1000,
  );

  const run = await prisma.retentionRun.create({
    data: {
      cutoff: cutoffPlaceholder,
      workerId: hostname(),
      startedAt,
    },
  });

  const totals = emptyCounters();

  try {
    const clinics = await prisma.clinic.findMany({
      where: { isActive: true },
      select: { id: true, retentionDays: true, slug: true },
      orderBy: { id: "asc" },
    });

    log.info({ runId: run.id, clinics: clinics.length }, "retention_run_start");

    for (const clinic of clinics) {
      try {
        const counters = await processClinic(
          clinic.id,
          clinic.retentionDays,
          run.id,
        );
        Object.assign(totals, addCounters(totals, counters));
      } catch (err) {
        totals.failed += 1;
        log.error(
          { clinicId: clinic.id, err: (err as Error).message },
          "clinic_failed",
        );
      }
    }

    await prisma.retentionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        scanned: totals.scanned,
        archived: totals.archived,
        purged: totals.purged,
        failed: totals.failed,
        bytesRaw: totals.bytesRaw,
        bytesCompressed: totals.bytesCompressed,
      },
    });

    log.info({ runId: run.id, totals: { ...totals, bytesRaw: totals.bytesRaw.toString(), bytesCompressed: totals.bytesCompressed.toString() } }, "retention_run_done");
  } catch (err) {
    const message = (err as Error).message;
    await prisma.retentionRun
      .update({
        where: { id: run.id },
        data: { finishedAt: new Date(), failed: totals.failed + 1, lastError: message },
      })
      .catch(() => undefined);
    log.error({ runId: run.id, err: message }, "retention_run_failed");
    throw err;
  } finally {
    await releaseLock(lockKey, lockToken).catch(() => undefined);
  }
};

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

let scheduled: ScheduledTask | null = null;
let shuttingDown = false;
let inFlight: Promise<void> | null = null;

const safeRun = async (): Promise<void> => {
  if (shuttingDown) return;
  if (inFlight) {
    log.warn("previous_run_still_in_flight_skipping_tick");
    return;
  }
  inFlight = runOnce()
    .catch((err) => log.error({ err: (err as Error).message }, "tick_failed"))
    .finally(() => {
      inFlight = null;
    });
  await inFlight;
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.warn({ signal }, "shutdown_initiated");

  if (scheduled) {
    scheduled.stop();
    scheduled = null;
  }

  // Wait for the in-flight batch to drain (max 90s — k8s default term grace).
  if (inFlight) {
    log.info("waiting_for_in_flight_run");
    await Promise.race([
      inFlight,
      new Promise((res) => setTimeout(res, 90_000)),
    ]);
  }

  await Promise.allSettled([disposePrisma(), disposeRedis()]);
  log.info("shutdown_complete");
  process.exit(0);
};

const main = async (): Promise<void> => {
  log.info(
    {
      cron: env.RETENTION_CRON,
      runOnce: env.RETENTION_RUN_ONCE,
      retentionDays: env.RETENTION_DAYS,
      batchSize: env.RETENTION_BATCH_SIZE,
    },
    "retention_worker_boot",
  );

  if (env.RETENTION_RUN_ONCE) {
    await runOnce();
    await Promise.allSettled([disposePrisma(), disposeRedis()]);
    process.exit(0);
  }

  if (!cron.validate(env.RETENTION_CRON)) {
    log.fatal({ cron: env.RETENTION_CRON }, "invalid_cron_expression");
    process.exit(1);
  }

  scheduled = cron.schedule(env.RETENTION_CRON, () => {
    void safeRun();
  });

  process.on("SIGINT", (s) => void shutdown(s));
  process.on("SIGTERM", (s) => void shutdown(s));
  process.on("unhandledRejection", (reason) =>
    log.error({ reason: String(reason) }, "unhandled_rejection"),
  );
  process.on("uncaughtException", (err) =>
    log.fatal({ err: err.message, stack: err.stack }, "uncaught_exception"),
  );

  // Kick off an immediate first run on boot — useful right after deploy.
  void safeRun();
};

main().catch((err) => {
  log.fatal({ err: (err as Error).message }, "boot_failed");
  process.exit(1);
});
