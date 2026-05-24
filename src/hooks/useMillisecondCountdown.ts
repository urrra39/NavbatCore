"use client";

/**
 * High-resolution countdown hook.
 *
 * `Date.now()` plus `requestAnimationFrame` gives a frame-aligned remainder
 * that keeps the displayed value visually smooth on 60/120/240 Hz panels
 * without the wasted re-renders of a setInterval(1ms) loop.
 *
 * The hook produces millisecond-precise breakdowns and also exposes the
 * raw remaining ms so callers can animate progress rings deterministically.
 */

import { useEffect, useRef, useState } from "react";

export interface CountdownParts {
  totalMs: number;
  isOverdue: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
}

const split = (target: number): CountdownParts => {
  const diff = target - Date.now();
  const abs = Math.abs(diff);
  return {
    totalMs: diff,
    isOverdue: diff < 0,
    hours: Math.floor(abs / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1_000),
    millis: abs % 1_000,
  };
};

/**
 * @param targetIso  ETA as an ISO 8601 string (or null while loading).
 * @param tickHz     Optional throttle in Hz; default = browser frame rate.
 *                   We still sample on every rAF, but only commit React state
 *                   when at least 1000/tickHz ms elapsed since the last commit.
 */
export const useMillisecondCountdown = (
  targetIso: string | null,
  tickHz = 30,
): CountdownParts | null => {
  const [parts, setParts] = useState<CountdownParts | null>(() =>
    targetIso ? split(new Date(targetIso).getTime()) : null,
  );

  const rafRef = useRef<number | null>(null);
  const lastCommitRef = useRef<number>(0);

  useEffect(() => {
    if (!targetIso) {
      setParts(null);
      return;
    }

    const target = new Date(targetIso).getTime();
    const minIntervalMs = Math.max(1, Math.floor(1000 / tickHz));

    const loop = () => {
      const now = performance.now();
      if (now - lastCommitRef.current >= minIntervalMs) {
        lastCommitRef.current = now;
        setParts(split(target));
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetIso, tickHz]);

  return parts;
};
