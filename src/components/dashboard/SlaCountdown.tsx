"use client";

/**
 * SlaCountdown — high-visibility timer that shows how the active
 * consultation is tracking against the triage budget.
 *
 * Hydration-safe contract:
 *   * `initialElapsedSec` is computed by the server at request time.
 *   * `useState` is seeded from that prop — no Date.now() during the
 *     initial render. Server HTML and first client render are byte-
 *     identical.
 *   * The 1 Hz interval starts inside `useEffect`.
 *
 * Visual states (driven by `slaTier` from src/lib/sla.ts):
 *   ok     — emerald, "Me'yorda"
 *   warn   — amber,   "Diqqat" (>=80% of budget consumed)
 *   breach — red,     "SLA buzilgan" (overrun)
 */

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import {
  SLA_LABEL_UZ,
  SLA_TONE_CLASS,
  slaPercent,
  slaRemainingSec,
  slaTier,
} from "@/lib/sla";

interface Props {
  /** Server-computed seconds since consultation started. */
  initialElapsedSec: number;
  /** Triage budget in seconds. */
  budgetSec: number;
  /** When true, the timer is paused (e.g. consultation is over). */
  paused?: boolean;
  className?: string;
}

export const SlaCountdown = ({
  initialElapsedSec,
  budgetSec,
  paused = false,
  className,
}: Props) => {
  const [seconds, setSeconds] = useState<number>(initialElapsedSec);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const tier = slaTier(seconds, budgetSec);
  const pct = useMemo(() => slaPercent(seconds, budgetSec), [seconds, budgetSec]);
  const remaining = slaRemainingSec(seconds, budgetSec);
  const remainingLabel =
    remaining >= 0
      ? `Qoldi: ${formatElapsed(remaining)}`
      : `O'tib ketgan: ${formatElapsed(Math.abs(remaining))}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Konsultatsiya SLA hisoblagichi
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-900">
            {formatElapsed(seconds)}
          </div>
          <div className="text-xs text-slate-500">{remainingLabel}</div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            SLA_TONE_CLASS[tier],
          )}
        >
          {SLA_LABEL_UZ[tier]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div
          aria-hidden
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              tier === "ok" && "bg-emerald-500",
              tier === "warn" && "bg-amber-500",
              tier === "breach" && "bg-red-600",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
          <span>0</span>
          <span>{Math.floor(budgetSec / 60)} daq. (saralash chegarasi)</span>
        </div>
      </div>
    </div>
  );
};
