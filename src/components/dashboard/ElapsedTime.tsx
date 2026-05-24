"use client";

/**
 * ElapsedTime — live "Sarflangan vaqt" ticker for one row.
 *
 * Hydration-safety contract
 *   1. The seed value (`initialElapsedSec`) is computed *on the server*
 *      at request time and shipped as a number prop. The component's
 *      initial `useState` reads that prop directly — no `Date.now()`,
 *      no `new Date()`, nothing time-of-render-dependent.
 *   2. Server-rendered HTML and the first client render therefore
 *      produce byte-identical text. React hydrates without warning.
 *   3. Only inside `useEffect` (i.e. AFTER hydration) does the component
 *      install a 1 Hz interval that bumps the local counter. This is
 *      the canonical Next.js pattern for live timers and is documented
 *      as the safe approach.
 *   4. Tickets in a terminal status (Tugatildi / Bekor / Kelmadi) freeze
 *      the counter — there is no ongoing wait to measure.
 */

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import { type QueueStatus, isTerminalStatus } from "@/lib/triage";

interface Props {
  initialElapsedSec: number;
  status: QueueStatus;
  /** Optional warn threshold in minutes; turns the cell amber when crossed. */
  warnAfterMin?: number;
}

export const ElapsedTime = ({
  initialElapsedSec,
  status,
  warnAfterMin = 30,
}: Props) => {
  const [seconds, setSeconds] = useState<number>(initialElapsedSec);
  const frozen = isTerminalStatus(status);

  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [frozen]);

  const overWarn = !frozen && seconds >= warnAfterMin * 60;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        frozen && "text-slate-400",
        !frozen && !overWarn && "text-slate-900",
        overWarn && "text-amber-700",
      )}
    >
      {formatElapsed(seconds)}
    </span>
  );
};
