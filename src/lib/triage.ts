/**
 * Triage taxonomy and the Akfa Medline expected-service-time policy.
 *
 * One module owns all clinical enums (severity tier, queue status, department)
 * along with their Uzbek-language labels. Every dashboard component, KPI
 * tile, and badge consumes labels from here so the UI is locked to a
 * single localization source.
 *
 * The triage rule is deliberately simple and deterministic — the dashboard
 * never asks an external service for an ETA. It computes:
 *
 *     expectedAt = entryAt + TRIAGE_MINUTES[severity]
 *
 * which means SSR and CSR always produce byte-identical timestamps for the
 * same ticket — a precondition for hydration-safe rendering.
 */

// -----------------------------------------------------------------------------
// Severity (Bemor holati)
// -----------------------------------------------------------------------------

export const Severity = {
  YENGIL: "YENGIL",
  ORTA: "ORTA",
  OGIR: "OGIR",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SEVERITY_LABEL_UZ: Record<Severity, string> = {
  YENGIL: "Yengil",
  ORTA: "O'rta",
  OGIR: "Og'ir",
};

/** Akfa Medline desk policy, in minutes. Single source of triage truth. */
export const TRIAGE_MINUTES: Record<Severity, number> = {
  YENGIL: 15,
  ORTA: 25,
  OGIR: 45,
};

// -----------------------------------------------------------------------------
// Queue status (Navbat holati)
// -----------------------------------------------------------------------------

export const QueueStatus = {
  KUTMOQDA: "KUTMOQDA",
  TASDIQLANGAN: "TASDIQLANGAN",
  ROYXATDA: "ROYXATDA",
  QABULDA: "QABULDA",
  TUGATILDI: "TUGATILDI",
  BEKOR: "BEKOR",
  KELMADI: "KELMADI",
} as const;
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];

export const STATUS_LABEL_UZ: Record<QueueStatus, string> = {
  KUTMOQDA: "Kutmoqda",
  TASDIQLANGAN: "Tasdiqlangan",
  ROYXATDA: "Ro'yxatdan o'tgan",
  QABULDA: "Qabulda",
  TUGATILDI: "Tugatildi",
  BEKOR: "Bekor qilindi",
  KELMADI: "Kelmadi",
};

/** Statuses where the elapsed-time ticker should freeze. */
export const TERMINAL_STATUSES: ReadonlyArray<QueueStatus> = [
  QueueStatus.TUGATILDI,
  QueueStatus.BEKOR,
  QueueStatus.KELMADI,
];

export const isTerminalStatus = (s: QueueStatus): boolean =>
  TERMINAL_STATUSES.includes(s);

// -----------------------------------------------------------------------------
// Department (Bo'lim)
// -----------------------------------------------------------------------------

export const Department = {
  KARDIOLOGIYA: "KARDIOLOGIYA",
  STOMATOLOGIYA: "STOMATOLOGIYA",
  LOR: "LOR",
  NEVROLOGIYA: "NEVROLOGIYA",
} as const;
export type Department = (typeof Department)[keyof typeof Department];

export const DEPARTMENT_LABEL_UZ: Record<Department, string> = {
  KARDIOLOGIYA: "Kardiologiya",
  STOMATOLOGIYA: "Stomatologiya",
  LOR: "LOR",
  NEVROLOGIYA: "Nevrologiya",
};

/** Render order for the tabs strip. */
export const DEPARTMENT_ORDER: ReadonlyArray<Department> = [
  Department.KARDIOLOGIYA,
  Department.STOMATOLOGIYA,
  Department.LOR,
  Department.NEVROLOGIYA,
];

// -----------------------------------------------------------------------------
// View model shipped from server -> client
// -----------------------------------------------------------------------------

/**
 * Wire-friendly ticket row.
 *
 * Every Date is pre-formatted on the server (using a fixed, locale-explicit
 * `Asia/Tashkent` Intl formatter) and shipped as a string so the client
 * never has to compute a clock-derived value during initial render. The
 * only client-side derived field is the elapsed counter, which is seeded
 * from `initialElapsedSec` and ticks via `setInterval` strictly after
 * `useEffect` runs — guaranteeing SSR/CSR text parity at hydration.
 */
export interface DashboardTicket {
  id: string;
  ticketCode: string;
  patientFullName: string;
  patientInitials: string;
  doctorFullName: string;
  room: string;

  department: Department;
  severity: Severity;
  status: QueueStatus;

  /** ISO 8601 — kept for downstream analytics; not used for rendering. */
  entryAt: string;
  /** Formatted "HH:mm" in Asia/Tashkent — rendered as-is. */
  entryAtFormatted: string;

  /** ISO 8601 — kept for downstream analytics; not used for rendering. */
  expectedAt: string;
  /** Formatted "HH:mm" in Asia/Tashkent — rendered as-is. */
  expectedAtFormatted: string;

  /** Whole seconds since `entryAt` at request time. Hydration anchor. */
  initialElapsedSec: number;
}

/**
 * Pure helper used by the page server component when seeding mock data.
 * Lives here so the client can run the same calculation if needed later
 * (e.g. when reconciling a WebSocket update).
 */
export const computeExpectedAt = (entryAt: Date, severity: Severity): Date =>
  new Date(entryAt.getTime() + TRIAGE_MINUTES[severity] * 60_000);
