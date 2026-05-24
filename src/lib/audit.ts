/**
 * AuditLog HMAC chain — cryptographically signed immutable ledger.
 *
 * Every AuditLog row stores:
 *   * `previousId`  — pointer to the prior row within the same clinicId.
 *   * `signature`   — HMAC-SHA256(secret, prevSignature || canonicalJson(payload)),
 *                     hex-encoded (64 chars).
 *
 * Tampering with any historical row breaks the signature of every row
 * after it — `verifyAuditChain` walks forward and detects the first break,
 * which is what compliance reviewers ultimately rely on.
 *
 * Canonical JSON: keys are sorted lexicographically and serialized with
 * `JSON.stringify`. This must be deterministic — never re-serialize via a
 * library that reorders keys.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

export interface AuditPayload {
  action: string;
  targetType: string;
  targetId: string;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  data?: Record<string, unknown>;
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
};

const hmacHex = (secret: string, message: string): string =>
  createHmac("sha256", secret).update(message, "utf8").digest("hex");

/**
 * Compute the signature for a new AuditLog row.
 *
 * @param previousSignature - signature of the previous row in this tenant's
 *                            chain, or `null` for the very first record.
 * @param payload           - the audit payload (will be canonicalized).
 */
export const signAuditPayload = (
  previousSignature: string | null,
  payload: AuditPayload,
): string => {
  const canonical = canonicalize(payload);
  const message = `${previousSignature ?? ""}|${canonical}`;
  return hmacHex(env.AUDIT_HMAC_SECRET, message);
};

/**
 * Verify a chain. Returns the index of the first invalid row, or -1 if the
 * whole chain is intact.
 */
export const verifyAuditChain = (
  rows: ReadonlyArray<{
    id: string;
    previousId: string | null;
    signature: string;
    payload: AuditPayload;
  }>,
): number => {
  let prevSig: string | null = null;
  let prevId: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.previousId !== prevId) return i;
    const expected = signAuditPayload(prevSig, row.payload);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(row.signature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return i;
    prevSig = row.signature;
    prevId = row.id;
  }
  return -1;
};

/**
 * One-shot helper used by API routes / server actions. Caller must
 * supply the latest signature for the tenant (typically fetched in the
 * same Prisma transaction that inserts the new row).
 */
export const buildSignedAuditEntry = (
  previous: { id: string; signature: string } | null,
  payload: AuditPayload,
): { previousId: string | null; signature: string } => ({
  previousId: previous?.id ?? null,
  signature: signAuditPayload(previous?.signature ?? null, payload),
});
