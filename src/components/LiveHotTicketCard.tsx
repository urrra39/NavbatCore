"use client";

/**
 * LiveHotTicketCard
 * ----------------------------------------------------------------------------
 * The flagship Liquid Glass surface for the patient-facing queue experience.
 *
 *   * Subscribes (via useHotTicketSocket) to a single ticket's mutation feed
 *     over Socket.IO.
 *   * Renders a heavy frosted-glass card with animated gradient blobs and
 *     pointer-reactive specular highlight (LiquidGlassSurface).
 *   * Drives a millisecond-precise countdown to ETA via requestAnimationFrame.
 *   * Surfaces connection state, server-measured latency, and an absolute
 *     `Timestamptz(6)`-formatted "last event" stamp for power users / staff.
 *   * Animates every status transition with Framer Motion springs — no
 *     content swap is ever instantaneous.
 *
 * Props are intentionally minimal: the parent (an SSR Next.js page) renders
 * an initial snapshot for SEO and hands it to this client component, which
 * then takes over via WebSockets for live updates.
 */

import { TicketStatus } from "@prisma/client";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Variants,
} from "framer-motion";
import { useMemo } from "react";

import { LiquidGlassSurface } from "@/components/glass/LiquidGlassSurface";
import {
  type LiveTicketSnapshot,
  type TicketSocketStatus,
  useHotTicketSocket,
} from "@/hooks/useHotTicketSocket";
import { useMillisecondCountdown } from "@/hooks/useMillisecondCountdown";
import { cn } from "@/lib/cn";

// ----------------------------------------------------------------------------
// Public props
// ----------------------------------------------------------------------------

export interface LiveHotTicketCardProps {
  socketUrl: string;
  authToken: string;
  initialSnapshot: LiveTicketSnapshot;
  /** Optional clinic theme — overrides accent palette. */
  theme?: { accent?: string; accent2?: string; blur?: number; frost?: number };
  className?: string;
  /** Receptionist mode reveals additional precision + raw event ms. */
  staffMode?: boolean;
}

// ----------------------------------------------------------------------------
// Status -> color mapping (matches Tailwind navbat.* tokens).
// ----------------------------------------------------------------------------

const STATUS_META: Record<
  TicketStatus,
  { label: string; tone: string; ring: string; gradient: [string, string] }
> = {
  PENDING: {
    label: "Awaiting Confirmation",
    tone: "text-amber-200",
    ring: "ring-amber-300/40",
    gradient: ["#ffd166", "#ff8fa3"],
  },
  CONFIRMED: {
    label: "In Queue",
    tone: "text-cyan-200",
    ring: "ring-cyan-300/40",
    gradient: ["#3ad6ff", "#8b5cf6"],
  },
  CHECKED_IN: {
    label: "Checked In",
    tone: "text-violet-200",
    ring: "ring-violet-300/40",
    gradient: ["#8b5cf6", "#3ad6ff"],
  },
  IN_PROGRESS: {
    label: "Now Serving",
    tone: "text-emerald-200",
    ring: "ring-emerald-300/50",
    gradient: ["#5eead4", "#3ad6ff"],
  },
  COMPLETED: {
    label: "Completed",
    tone: "text-emerald-100",
    ring: "ring-emerald-200/30",
    gradient: ["#5eead4", "#8b5cf6"],
  },
  CANCELED: {
    label: "Canceled",
    tone: "text-rose-200",
    ring: "ring-rose-300/40",
    gradient: ["#ff8fa3", "#8b5cf6"],
  },
  NO_SHOW: {
    label: "No Show",
    tone: "text-zinc-300",
    ring: "ring-zinc-300/30",
    gradient: ["#94a3b8", "#475569"],
  },
};

const SOCKET_STATUS_META: Record<
  TicketSocketStatus,
  { label: string; dot: string; pulse: boolean }
> = {
  idle: { label: "Idle", dot: "bg-zinc-400", pulse: false },
  connecting: { label: "Connecting", dot: "bg-amber-300", pulse: true },
  connected: { label: "Live", dot: "bg-emerald-300", pulse: true },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400", pulse: true },
  disconnected: { label: "Offline", dot: "bg-zinc-500", pulse: false },
  error: { label: "Error", dot: "bg-rose-400", pulse: true },
};

// ----------------------------------------------------------------------------
// Animation variants
// ----------------------------------------------------------------------------

const cardVariants: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 26, mass: 0.9 },
  },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.18 } },
};

const digitVariants: Variants = {
  initial: { y: 12, opacity: 0, filter: "blur(6px)" },
  animate: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 360, damping: 30 },
  },
  exit: { y: -10, opacity: 0, filter: "blur(6px)", transition: { duration: 0.12 } },
};

// ----------------------------------------------------------------------------
// Formatting helpers
// ----------------------------------------------------------------------------

const pad = (n: number, w = 2) => n.toString().padStart(w, "0");

/** ISO-style microsecond stamp for the staff overlay. */
const formatMicrosStamp = (iso: string): string => {
  const d = new Date(iso);
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  const ms = pad(d.getUTCMilliseconds(), 3);
  // We only have ms in JS Date; pad three trailing zeros to evoke the
  // server-side timestamptz(6) precision.
  return `${hh}:${mm}:${ss}.${ms}000Z`;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export const LiveHotTicketCard = ({
  socketUrl,
  authToken,
  initialSnapshot,
  theme,
  className,
  staffMode = false,
}: LiveHotTicketCardProps) => {
  const { status, snapshot, lastEvent, latencyMs } = useHotTicketSocket({
    url: socketUrl,
    clinicId: initialSnapshot.clinicId,
    ticketId: initialSnapshot.ticketId,
    authToken,
    initialSnapshot,
  });

  const meta = STATUS_META[snapshot.status as TicketStatus] ?? STATUS_META.PENDING;
  const sockMeta = SOCKET_STATUS_META[status];

  const accent: [string, string] = useMemo(
    () => [theme?.accent ?? meta.gradient[0], theme?.accent2 ?? meta.gradient[1]],
    [theme?.accent, theme?.accent2, meta.gradient],
  );

  const countdown = useMillisecondCountdown(snapshot.etaAt, 30);

  return (
    <LayoutGroup>
      <motion.div
        layout
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        whileHover={{ y: -2, transition: { type: "spring", stiffness: 260, damping: 22 } }}
        className={cn("w-full max-w-md", className)}
      >
        <LiquidGlassSurface
          accent={accent}
          blur={theme?.blur ?? 44}
          frost={theme?.frost ?? 0.55}
          className="p-6 sm:p-8"
        >
          {/* ---------- Header row: clinic / connection ---------- */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/70">
              <span className="font-mono">NAVBAT</span>
              <span className="h-3 w-px bg-white/20" />
              <span className="font-mono">{snapshot.ticketCode}</span>
            </div>

            <ConnectionPill
              label={sockMeta.label}
              dotClass={sockMeta.dot}
              pulse={sockMeta.pulse}
              latencyMs={latencyMs}
            />
          </div>

          {/* ---------- Status badge ---------- */}
          <div className="mt-5 flex items-baseline justify-between">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={snapshot.status}
                variants={digitVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-3"
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    meta.tone.replace("text-", "bg-"),
                    snapshot.status === TicketStatus.IN_PROGRESS && "animate-pulse-ring",
                  )}
                />
                <span className={cn("text-sm font-medium tracking-wide", meta.tone)}>
                  {meta.label}
                </span>
              </motion.div>
            </AnimatePresence>

            <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">
              #{snapshot.positionInDay.toString().padStart(3, "0")}
            </span>
          </div>

          {/* ---------- Countdown ---------- */}
          <div className="mt-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
              {countdown?.isOverdue ? "Overdue by" : "Estimated in"}
            </div>

            <CountdownDisplay countdown={countdown} accent={accent[0]} />
          </div>

          {/* ---------- Footer row: scheduled timestamp ---------- */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
            <Field
              label="Scheduled"
              value={
                <time
                  dateTime={snapshot.scheduledFor}
                  className="font-mono text-[13px] text-white/85"
                  title={snapshot.scheduledFor}
                >
                  {new Date(snapshot.scheduledFor).toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    day: "2-digit",
                    month: "short",
                  })}
                </time>
              }
            />
            <Field
              label="ETA"
              value={
                <time
                  dateTime={snapshot.etaAt ?? undefined}
                  className="font-mono text-[13px] text-white/85"
                  title={snapshot.etaAt ?? undefined}
                >
                  {snapshot.etaAt
                    ? new Date(snapshot.etaAt).toLocaleString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "—"}
                </time>
              }
            />
          </div>

          {/* ---------- Staff diagnostics ---------- */}
          {staffMode && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-3 font-mono text-[11px] leading-relaxed text-white/70 backdrop-blur-md">
              <div className="flex justify-between">
                <span className="text-white/45">last_event_ts</span>
                <span>
                  {snapshot.lastEventAt
                    ? formatMicrosStamp(new Date(snapshot.lastEventAt).toISOString())
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">last_event_type</span>
                <span>{lastEvent?.type ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">eta_confidence</span>
                <span>
                  {snapshot.etaConfidence !== null
                    ? snapshot.etaConfidence.toFixed(3)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">rtt_ms</span>
                <span>{latencyMs ?? "—"}</span>
              </div>
            </div>
          )}
        </LiquidGlassSurface>
      </motion.div>
    </LayoutGroup>
  );
};

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

const ConnectionPill = ({
  label,
  dotClass,
  pulse,
  latencyMs,
}: {
  label: string;
  dotClass: string;
  pulse: boolean;
  latencyMs: number | null;
}) => (
  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-white/80 backdrop-blur-md">
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      <span className={cn("absolute inline-block h-2 w-2 rounded-full", dotClass)} />
      {pulse && (
        <motion.span
          aria-hidden
          className={cn("absolute inline-block h-2 w-2 rounded-full", dotClass)}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </span>
    <span>{label}</span>
    {latencyMs !== null && (
      <span className="font-mono text-white/50">{latencyMs}ms</span>
    )}
  </div>
);

const Field = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
      {label}
    </span>
    {value}
  </div>
);

const CountdownDisplay = ({
  countdown,
  accent,
}: {
  countdown: ReturnType<typeof useMillisecondCountdown>;
  accent: string;
}) => {
  if (!countdown) {
    return (
      <div className="mt-1 font-mono text-4xl text-white/40">--:--:--<span className="text-2xl">.---</span></div>
    );
  }

  const { hours, minutes, seconds, millis, isOverdue } = countdown;
  const sign = isOverdue ? "-" : "";

  return (
    <div className="mt-1 flex items-baseline gap-1 font-mono">
      <motion.span
        key={`h-${hours}`}
        variants={digitVariants}
        initial="initial"
        animate="animate"
        className="text-4xl font-semibold tabular-nums text-white"
        style={{ textShadow: `0 0 22px ${accent}55` }}
      >
        {sign}
        {pad(hours)}
      </motion.span>
      <span className="text-3xl text-white/40">:</span>
      <motion.span
        key={`m-${minutes}`}
        variants={digitVariants}
        initial="initial"
        animate="animate"
        className="text-4xl font-semibold tabular-nums text-white"
        style={{ textShadow: `0 0 22px ${accent}55` }}
      >
        {pad(minutes)}
      </motion.span>
      <span className="text-3xl text-white/40">:</span>
      <motion.span
        key={`s-${seconds}`}
        variants={digitVariants}
        initial="initial"
        animate="animate"
        className="text-4xl font-semibold tabular-nums text-white"
        style={{ textShadow: `0 0 22px ${accent}55` }}
      >
        {pad(seconds)}
      </motion.span>
      <span className="ml-1 text-2xl text-white/35">.</span>
      <span
        className="text-2xl font-semibold tabular-nums text-white/70"
        // millis updates every animation frame — re-keying would thrash, so we
        // let the value mutate in place. Framer is not used on this digit.
      >
        {pad(millis, 3)}
      </span>
    </div>
  );
};
