/**
 * Triage taxonomy + Akfa Medline service-time policy.
 *
 * This module re-exports the canonical `TicketStatus` and `Severity`
 * enums from `@/schemas/ticket` (the schema-level source of truth),
 * adds Uzbek-language labels for every enum value, and exposes the
 * deterministic ETA calculator that drives both the dashboard cells
 * and the public booking flow.
 *
 *     expectedAt = entryAt + TRIAGE_MINUTES[severity]
 *
 * Because the rule is pure arithmetic and timezone-agnostic, server
 * and client always agree on the timestamp — a hard precondition for
 * hydration-safe rendering.
 */

import {
  Severity as TicketSeverity,
  TicketStatus as TicketStatusEnum,
  type Severity as SeverityType,
  type TicketStatus as TicketStatusType,
} from "@/schemas/ticket";

// -----------------------------------------------------------------------------
// Re-exports — keep the rest of the codebase importing from a single place.
// -----------------------------------------------------------------------------

export const Severity = TicketSeverity;
export type Severity = SeverityType;

/** Alias kept for legacy call sites; identical to `TicketStatus`. */
export const QueueStatus = TicketStatusEnum;
export type QueueStatus = TicketStatusType;

export const TicketStatus = TicketStatusEnum;
export type TicketStatus = TicketStatusType;

// -----------------------------------------------------------------------------
// Severity labels + triage matrix
// -----------------------------------------------------------------------------

export const SEVERITY_LABEL_UZ: Record<Severity, string> = {
  YENGIL: "Yengil",
  ORTA: "O'rta",
  OGIR: "Og'ir",
};

export const SEVERITY_DESCRIPTION_UZ: Record<Severity, string> = {
  YENGIL: "Yengil shikoyat — qisqa muddatli ko'rik",
  ORTA: "O'rta og'irlikdagi holat — standart konsultatsiya",
  OGIR: "Og'ir holat — chuqur tekshiruv talab qiladi",
};

/** Akfa Medline desk policy. Single source of truth for ETA + SLA budget. */
export const TRIAGE_MINUTES: Record<Severity, number> = {
  YENGIL: 15,
  ORTA: 25,
  OGIR: 45,
};

export const TRIAGE_BUDGET_SEC: Record<Severity, number> = {
  YENGIL: 15 * 60,
  ORTA: 25 * 60,
  OGIR: 45 * 60,
};

// -----------------------------------------------------------------------------
// Queue status (Navbat holati)
// -----------------------------------------------------------------------------

export const STATUS_LABEL_UZ: Record<TicketStatus, string> = {
  KUTMOQDA: "Kutmoqda",
  TASDIQLANGAN: "Tasdiqlangan",
  QABULDA: "Qabulda",
  TUGATILDI: "Tugatildi",
  BEKOR_QILINGAN: "Bekor qilingan",
  KELMADI: "Kelmadi",
};

export const TERMINAL_STATUSES: ReadonlyArray<TicketStatus> = [
  TicketStatus.TUGATILDI,
  TicketStatus.BEKOR_QILINGAN,
  TicketStatus.KELMADI,
];

export const isTerminalStatus = (s: TicketStatus): boolean =>
  TERMINAL_STATUSES.includes(s);

// -----------------------------------------------------------------------------
// Department (Bo'lim) — UI vocabulary, distinct from the Prisma model name
// -----------------------------------------------------------------------------

export const DepartmentCode = {
  KARDIOLOGIYA: "KARDIOLOGIYA",
  STOMATOLOGIYA: "STOMATOLOGIYA",
  LOR: "LOR",
  NEVROLOGIYA: "NEVROLOGIYA",
} as const;
export type DepartmentCode = (typeof DepartmentCode)[keyof typeof DepartmentCode];

/** Backwards-compatible alias — older imports use `Department`. */
export const Department = DepartmentCode;
export type Department = DepartmentCode;

export const DEPARTMENT_LABEL_UZ: Record<DepartmentCode, string> = {
  KARDIOLOGIYA: "Kardiologiya",
  STOMATOLOGIYA: "Stomatologiya",
  LOR: "LOR",
  NEVROLOGIYA: "Nevrologiya",
};

export const DEPARTMENT_ORDER: ReadonlyArray<DepartmentCode> = [
  DepartmentCode.KARDIOLOGIYA,
  DepartmentCode.STOMATOLOGIYA,
  DepartmentCode.LOR,
  DepartmentCode.NEVROLOGIYA,
];

// -----------------------------------------------------------------------------
// Wire-friendly view model used by the dashboard + tracker
// -----------------------------------------------------------------------------

export interface DashboardTicket {
  id: string;
  ticketCode: string;
  patientFullName: string;
  patientInitials: string;
  doctorFullName: string;
  room: string;

  department: DepartmentCode;
  severity: Severity;
  status: TicketStatus;

  /** ISO 8601 — for analytics / WebSocket reconciliation. */
  entryAt: string;
  /** Pre-formatted "HH:mm" in Asia/Tashkent. Hydration-safe. */
  entryAtFormatted: string;

  expectedAt: string;
  expectedAtFormatted: string;

  /** Whole seconds since `entryAt` at request time. Hydration anchor. */
  initialElapsedSec: number;

  /** True if inserted via the emergency buffer (jumps the queue). */
  emergency?: boolean;
}

// -----------------------------------------------------------------------------
// Triage matrix — public API
// -----------------------------------------------------------------------------

/**
 * Deterministic ETA calculator used by:
 *   * `/c/[slug]/page.tsx` when a patient picks a severity.
 *   * The dashboard mock dataset.
 *   * The retention worker's audit payloads.
 *
 * Microsecond-precise: the input `Date` is treated as UTC ms; we just add
 * the triage budget in milliseconds, so the result is exact to the
 * platform's `Date` resolution.
 */
export const computeExpectedAt = (entryAt: Date, severity: Severity): Date =>
  new Date(entryAt.getTime() + TRIAGE_MINUTES[severity] * 60_000);

export interface TriageQuote {
  severity: Severity;
  budgetSec: number;
  budgetMinutesLabel: string;
  expectedAtIso: string;
  expectedAtFormatted: string;
}

/**
 * Build a triage quote ready to be surfaced on the booking page. The
 * caller is responsible for the `formatHHmm` helper to keep this module
 * dependency-free and unit-testable.
 */
export const buildTriageQuote = (
  entryAt: Date,
  severity: Severity,
  formatHHmm: (d: Date) => string,
): TriageQuote => {
  const expectedAt = computeExpectedAt(entryAt, severity);
  return {
    severity,
    budgetSec: TRIAGE_BUDGET_SEC[severity],
    budgetMinutesLabel: `${TRIAGE_MINUTES[severity]} daq.`,
    expectedAtIso: expectedAt.toISOString(),
    expectedAtFormatted: formatHHmm(expectedAt),
  };
};
