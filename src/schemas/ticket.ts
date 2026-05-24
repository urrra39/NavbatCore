/**
 * Zod schemas + finite state machine for HotTicket lifecycle.
 *
 * Single source of truth for the queue lifecycle vocabulary. The
 * Prisma `TicketStatus` enum, the realtime event payloads, the worker,
 * and every UI component import from this file (or from `lib/triage.ts`,
 * which re-exports the enum + Uzbek labels).
 *
 * The state machine in `ALLOWED_TRANSITIONS` is consulted by every
 * ticket mutation — anything not enumerated there is rejected.
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Domain enums (string-literal const objects so the UI bundle never depends
// on `prisma generate` having run).
// -----------------------------------------------------------------------------

export const TicketStatus = {
  KUTMOQDA: "KUTMOQDA",
  TASDIQLANGAN: "TASDIQLANGAN",
  QABULDA: "QABULDA",
  TUGATILDI: "TUGATILDI",
  BEKOR_QILINGAN: "BEKOR_QILINGAN",
  KELMADI: "KELMADI",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const Severity = {
  YENGIL: "YENGIL",
  ORTA: "ORTA",
  OGIR: "OGIR",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const TicketChannel = {
  WEB: "WEB",
  MOBILE_APP: "MOBILE_APP",
  WALK_IN: "WALK_IN",
  PHONE: "PHONE",
  PARTNER_API: "PARTNER_API",
} as const;
export type TicketChannel = (typeof TicketChannel)[keyof typeof TicketChannel];

// -----------------------------------------------------------------------------
// Primitive schemas
// -----------------------------------------------------------------------------

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
export const SeveritySchema = z.nativeEnum(Severity);
export const TicketChannelSchema = z.nativeEnum(TicketChannel);

// -----------------------------------------------------------------------------
// Ticket metadata — open struct with a known core
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
    /** True if inserted via the receptionist's emergency buffer. */
    emergency: z.boolean().default(false),
  })
  .passthrough();

export type TicketMetadata = z.infer<typeof TicketMetadataSchema>;

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

export const CreateTicketInputSchema = z.object({
  clinicId: ClinicIdSchema,
  departmentId: CuidSchema,
  doctorId: CuidSchema.optional(),
  patientId: CuidSchema.optional(),

  /** Patient-supplied severity tier — drives the triage matrix. */
  severity: SeveritySchema,
  scheduledFor: PreciseDateSchema,
  channel: TicketChannelSchema.default(TicketChannel.WEB),
  priority: z.number().int().min(0).max(100).default(0),
  metadata: TicketMetadataSchema.default({}),
});

export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

// -----------------------------------------------------------------------------
// State transitions
// -----------------------------------------------------------------------------

export const ALLOWED_TRANSITIONS: Readonly<
  Record<TicketStatus, ReadonlyArray<TicketStatus>>
> = Object.freeze({
  [TicketStatus.KUTMOQDA]: [
    TicketStatus.TASDIQLANGAN,
    TicketStatus.BEKOR_QILINGAN,
  ],
  [TicketStatus.TASDIQLANGAN]: [
    TicketStatus.QABULDA,
    TicketStatus.BEKOR_QILINGAN,
    TicketStatus.KELMADI,
  ],
  [TicketStatus.QABULDA]: [
    TicketStatus.TUGATILDI,
    TicketStatus.BEKOR_QILINGAN,
  ],
  [TicketStatus.TUGATILDI]: [],
  [TicketStatus.BEKOR_QILINGAN]: [],
  [TicketStatus.KELMADI]: [],
});

export class InvalidTransitionError extends Error {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`invalid_transition:${from}->${to}`);
    this.name = "InvalidTransitionError";
  }
}

export const assertTransition = (from: TicketStatus, to: TicketStatus): void => {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
};

/** Statuses that age into the 7-day cold archive. */
export const ARCHIVABLE_STATUSES: ReadonlyArray<TicketStatus> = [
  TicketStatus.TUGATILDI,
  TicketStatus.BEKOR_QILINGAN,
  TicketStatus.KELMADI,
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
    if (val.to === TicketStatus.BEKOR_QILINGAN && !val.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "cancel_reason_required",
      });
    }
  });

export type TransitionInput = z.infer<typeof TransitionInputSchema>;

// -----------------------------------------------------------------------------
// Realtime event payloads (Redis Pub/Sub -> WebSocket)
// -----------------------------------------------------------------------------

export const RealtimeTicketEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ticket.created"),
    ticketId: CuidSchema,
    clinicId: ClinicIdSchema,
    ticketCode: TicketCodeSchema,
    status: TicketStatusSchema,
    severity: SeveritySchema,
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
  z.object({
    type: z.literal("queue.recalculated"),
    clinicId: ClinicIdSchema,
    departmentId: CuidSchema,
    /** Reason — typically "emergency_buffer_inserted". */
    cause: z.string().max(64),
    /** Number of tickets whose ETA changed. */
    affected: z.number().int().min(0),
    occurredAt: PreciseDateSchema,
  }),
]);

export type RealtimeTicketEvent = z.infer<typeof RealtimeTicketEventSchema>;
