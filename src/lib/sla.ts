/**
 * SLA helpers — translate the triage budget into actionable signals
 * for the dashboard.
 *
 *   * `slaTier(elapsedSec, budgetSec)` returns one of:
 *       "ok"       — well within budget
 *       "warn"     — within 80%..100% of budget (amber)
 *       "breach"   — exceeded budget (red, raises an SlaIncident server-side)
 *
 *   * `slaPercent(elapsedSec, budgetSec)` returns 0..120 — useful for a
 *     progress ring.
 *
 * These are pure arithmetic. No locale, no Date — safe to call from server
 * components and client hooks alike.
 */

import { Severity, TRIAGE_BUDGET_SEC } from "@/lib/triage";

export type SlaTier = "ok" | "warn" | "breach";

const WARN_RATIO = 0.8;

export const slaTier = (elapsedSec: number, budgetSec: number): SlaTier => {
  if (elapsedSec >= budgetSec) return "breach";
  if (elapsedSec >= budgetSec * WARN_RATIO) return "warn";
  return "ok";
};

export const slaPercent = (elapsedSec: number, budgetSec: number): number => {
  if (budgetSec <= 0) return 0;
  const raw = (elapsedSec / budgetSec) * 100;
  return Math.max(0, Math.min(120, Math.round(raw)));
};

/** Formats remaining time inside the triage budget — negative when overrun. */
export const slaRemainingSec = (
  elapsedSec: number,
  budgetSec: number,
): number => budgetSec - elapsedSec;

/** Default budget by severity. Real clinics override per-department. */
export const defaultBudgetForSeverity = (severity: Severity): number =>
  TRIAGE_BUDGET_SEC[severity];

/** Tone tokens used by the SLA countdown component. */
export const SLA_TONE_CLASS: Record<SlaTier, string> = {
  ok: "text-emerald-700 bg-emerald-50 ring-emerald-600/20",
  warn: "text-amber-800 bg-amber-50 ring-amber-600/30",
  breach: "text-red-700 bg-red-50 ring-red-600/30",
};

export const SLA_LABEL_UZ: Record<SlaTier, string> = {
  ok: "Me'yorda",
  warn: "Diqqat",
  breach: "SLA buzilgan",
};
