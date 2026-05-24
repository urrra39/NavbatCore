/**
 * Zod schemas + finite state machine for HotTicket lifecycle.
 *
 * These schemas are the SINGLE source of truth for incoming payloads. Every
 * API route, WebSocket handler, and worker import from here — never trust
 * a Prisma row that originated outside the database without parsing it.
 *
 * The state machine is deliberately conservative: only transitions that
 * appear in `ALLOWED_TRANSITIONS` are accepted; everything else throws.
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Domain enums (runtime values + types).
// -----------------------------------------------------------------------------
//
// We mirror the Prisma-generated `TicketStatus` / `TicketChannel` enums here
// instead of importing them from `@prisma/client` so that the UI layer never
// depends on `prisma generate` having run. The string values are identical
// to the database enum, so anything that flows through the API boundary
// (raw SQL, Prisma queries, JSON payloads) is interchangeable.
//
// Single source of truth: anything client-side that needs the enum values
// imports from this file.

export const TicketStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  NO_SHOW: "NO_SHOW",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketChannel = {
  WEB: "WEB",
  MOBILE_APP: "MOBILE_APP",
  WALK_IN: "WALK_IN",
  PHONE: "PHONE",
  PARTNER_API: "PARTNER_API",
} as const;
export type TicketChannel = (typeof TicketChannel)[keyof typeof TicketChannel];

// -----------------------------------------------------------------------------
// Primitive helpers
// -----------------------------------------------------------------------------

/** Microsecond-precision ISO 8601 instant. Accepts strings or Date. */
export const PreciseDateSchema = z
  .union([z.string().datetime({ offset: true, precision: 6 }), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const CuidSchema = z.string().regex(/^c[a-z0-9]{24,}$/i, "invalid_cuid");
export const ClinicIdSchema = CuidSchema.brand<"ClinicId">();
export const TicketIdSchema = CuidSchema.brand<"TicketId">();

export const TicketCodeSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[A-Z0-9-]+$/, "ticket_code_must_be_uppercase_alnum_hyphen");

export const TicketStatusSchema = z.nativeEnum(TicketStatus);
export const TicketChannelSchema = z.nativeEnum(TicketChannel);

// -----------------------------------------------------------------------------
// Metadata — open struct, but with a known core.
// -----------------------------------------------------------------------------

export const TicketMetadataSchema = z
  .object({
    locale: z.enum(["uz", "ru", "en"]).default("uz"),
    referralCode: z.string().max(64).optional(),
    symptomNote: z.string().max(2000).optional(),
    paymentIntentId: z.string().max(128).optional(),
    insurance: z
      .object({
        provider: z.string().max(120),
        policyNumber: z.string().max(64),
      })
      .optional(),
    contactPreference: z.enum(["sms", "push", "voice", "none"]).default("sms"),
  })
  .passthrough();

export type TicketMetadata = z.infer<typeof TicketMetadataSchema>;

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

export const CreateTicketInputSchema = z.object({
  clinicId: ClinicIdSchema,
  serviceId: CuidSchema,
  providerId: CuidSchema.optional(),
  patientId: CuidSchema.optional(),

  scheduledFor: PreciseDateSchema,
  channel: TicketChannelSchema.default(TicketChannel.WEB),
  priority: z.number().int().min(0).max(100).default(0),
  metadata: TicketMetadataSchema.default({}),
});

export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

// -----------------------------------------------------------------------------
// State transitions
// -----------------------------------------------------------------------------

/**
 * Allowed transitions for the queue state machine.
 * Any pair NOT listed here is rejected by `assertTransition`.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<TicketStatus, ReadonlyArray<TicketStatus>>
> = Object.freeze({
  [TicketStatus.PENDING]: [
    TicketStatus.CONFIRMED,
    TicketStatus.CANCELED,
  ],
  [TicketStatus.CONFIRMED]: [
    TicketStatus.CHECKED_IN,
    TicketStatus.CANCELED,
    TicketStatus.NO_SHOW,
  ],
  [TicketStatus.CHECKED_IN]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.CANCELED,
  ],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.COMPLETED,
    TicketStatus.CANCELED,
  ],
  [TicketStatus.COMPLETED]: [],
  [TicketStatus.CANCELED]: [],
  [TicketStatus.NO_SHOW]: [],
});

export class InvalidTransitionError extends Error {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`invalid_transition:${from}->${to}`);
    this.name = "InvalidTransitionError";
  }
}

export const assertTransition = (
  from: TicketStatus,
  to: TicketStatus,
): void => {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
};

/** Statuses that are eligible for archival once they age past retentionDays. */
export const ARCHIVABLE_STATUSES: ReadonlyArray<TicketStatus> = [
  TicketStatus.COMPLETED,
  TicketStatus.CANCELED,
  TicketStatus.NO_SHOW,
];

export const TransitionInputSchema = z
  .object({
    ticketId: CuidSchema,
    clinicId: ClinicIdSchema,
    expectedVersion: z.number().int().min(0),
    from: TicketStatusSchema,
    to: TicketStatusSchema,
    actorId: CuidSchema.optional(),
    reason: z.string().max(500).optional(),
    occurredAt: PreciseDateSchema.default(() => new Date()),
  })
  .superRefine((val, ctx) => {
    if (!ALLOWED_TRANSITIONS[val.from].includes(val.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `invalid_transition:${val.from}->${val.to}`,
      });
    }
    if (val.to === TicketStatus.CANCELED && !val.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "cancel_reason_required",
      });
    }
  });

export type TransitionInput = z.infer<typeof TransitionInputSchema>;

// -----------------------------------------------------------------------------
// Realtime event payloads (pushed through Redis Pub/Sub -> WebSockets).
// -----------------------------------------------------------------------------

export const RealtimeTicketEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ticket.created"),
    ticketId: CuidSchema,
    clinicId: ClinicIdSchema,
    ticketCode: TicketCodeSchema,
    status: TicketStatusSchema,
    scheduledFor: PreciseDateSchema,
    etaAt: PreciseDateSchema.nullable(),
    positionInDay: z.number().int().min(0),
    occurredAt: PreciseDateSchema,
  }),
  z.object({
    type: z.literal("ticket.transitioned"),
    ticketId: CuidSchema,
    clinicId: ClinicIdSchema,
    ticketCode: TicketCodeSchema,
    from: TicketStatusSchema,
    to: TicketStatusSchema,
    etaAt: PreciseDateSchema.nullable(),
    occurredAt: PreciseDateSchema,
  }),
  z.object({
    type: z.literal("ticket.eta_updated"),
    ticketId: CuidSchema,
    clinicId: ClinicIdSchema,
    etaAt: PreciseDateSchema.nullable(),
    etaConfidence: z.number().min(0).max(1).nullable(),
    occurredAt: PreciseDateSchema,
  }),
  z.object({
    type: z.literal("ticket.archived"),
    originalTicketId: CuidSchema,
    clinicId: ClinicIdSchema,
    ticketCode: TicketCodeSchema,
    occurredAt: PreciseDateSchema,
  }),
]);

export type RealtimeTicketEvent = z.infer<typeof RealtimeTicketEventSchema>;
