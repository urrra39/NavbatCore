/**
 * HIS Gateway · POST /api/his/v1/tickets
 *
 * Hospital Information System integration endpoint. Accepts ticket
 * insertions from third-party HIS providers (e.g. an EMR pushing a
 * walk-in patient). Authentication is by HMAC-SHA256 over the raw
 * request body using `env.HIS_GATEWAY_HMAC_SECRET`.
 *
 * Request: `application/json` body matching `HisInboundTicketSchema`.
 *   Headers required:
 *     X-HIS-Signature: hex(HMAC-SHA256(secret, rawBody))
 *     X-HIS-Tenant:    clinic slug
 *     X-HIS-Timestamp: unix ms — must be within 5 minutes of `now`
 *
 * Response:
 *   201 Created — { ticketCode, trackingHash, expectedAtIso }
 *   400 Bad Request — validation errors
 *   401 Unauthorized — bad signature or stale timestamp
 *
 * The persistence layer (Prisma transaction + AuditLog signed entry)
 * is intentionally stubbed in this boilerplate; the contract above is
 * the public surface every HIS provider integrates against.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { computeExpectedAt } from "@/lib/triage";
import { SeveritySchema } from "@/schemas/ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HisInboundTicketSchema = z.object({
  externalId: z.string().min(1).max(64),
  fullName: z.string().min(2).max(120),
  phoneE164: z.string().regex(/^\+\d{8,15}$/),
  departmentCode: z.enum([
    "KARDIOLOGIYA",
    "STOMATOLOGIYA",
    "LOR",
    "NEVROLOGIYA",
  ]),
  severity: SeveritySchema,
  notes: z.string().max(2000).optional(),
  scheduledAtIso: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

const SIG_TOLERANCE_MS = 5 * 60 * 1000;

const verifySignature = (
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean => {
  if (!signatureHeader || !timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > SIG_TOLERANCE_MS) return false;
  const expected = createHmac("sha256", env.HIS_GATEWAY_HMAC_SECRET)
    .update(`${ts}.${rawBody}`, "utf8")
    .digest("hex");
  const a = Buffer.from(signatureHeader, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const sig = req.headers.get("x-his-signature");
  const ts = req.headers.get("x-his-timestamp");
  const tenant = req.headers.get("x-his-tenant");

  if (!verifySignature(rawBody, sig, ts)) {
    return NextResponse.json(
      { error: "unauthorized", reason: "invalid_signature_or_timestamp" },
      { status: 401 },
    );
  }
  if (!tenant) {
    return NextResponse.json(
      { error: "bad_request", reason: "x_his_tenant_header_required" },
      { status: 400 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "bad_request", reason: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = HisInboundTicketSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "bad_request",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // -- Stubbed persistence ---------------------------------------------------
  // In production this block opens a Prisma transaction:
  //   1. Resolve clinicId from `tenant` slug.
  //   2. Resolve departmentId from clinicId + departmentCode.
  //   3. INSERT INTO hot_tickets ... RETURNING id, tracking_hash, ticket_code.
  //   4. Compute etaAt = computeExpectedAt(scheduledFor, severity).
  //   5. Append a signed AuditLog row (action=TICKET_CREATED, channel=PARTNER_API).
  //   6. PUBLISH ticket.created over Redis Pub/Sub.
  // The stub mints a deterministic-looking response so the contract is
  // testable end-to-end with no database.
  // -------------------------------------------------------------------------

  const scheduledFor = parsed.data.scheduledAtIso
    ? new Date(parsed.data.scheduledAtIso)
    : new Date();
  const expectedAt = computeExpectedAt(scheduledFor, parsed.data.severity);
  const ticketCode = `${parsed.data.departmentCode[0]}-${(100 + Math.floor(Math.random() * 900)).toString()}`;
  const trackingHash = `c${Math.random().toString(36).slice(2, 26)}`;

  return NextResponse.json(
    {
      ticketCode,
      trackingHash,
      clinicSlug: tenant,
      departmentCode: parsed.data.departmentCode,
      severity: parsed.data.severity,
      scheduledAt: scheduledFor.toISOString(),
      expectedAtIso: expectedAt.toISOString(),
    },
    { status: 201 },
  );
}
