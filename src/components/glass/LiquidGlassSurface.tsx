"use client";

/**
 * LiquidGlassSurface — composable frosted-glass shell.
 *
 * Layers (bottom to top):
 *   1. Animated radial gradient blobs (motion.div, GPU-only transforms).
 *   2. Frosted plate (backdrop-blur, low-saturation tint, 1px inner stroke).
 *   3. Children content.
 *   4. Specular highlight band that subtly tracks pointer hover.
 *
 * The component is intentionally presentational — no business logic — so it
 * can be reused as the canvas for the Live Hot Ticket Card, dashboards,
 * SEO-rendered public queue boards, etc.
 */

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { type PropsWithChildren, useRef } from "react";

import { cn } from "@/lib/cn";

interface Props {
  className?: string;
  /** Two CSS colors driving the animated frosted gradient. */
  accent?: [string, string];
  /** Backdrop blur radius in px. Default 36. */
  blur?: number;
  /** 0..1 — how heavy the white frost overlay is. Default 0.55. */
  frost?: number;
  /** Disable the pointer-tracking highlight (e.g. for SSR snapshots). */
  staticHighlight?: boolean;
}

export const LiquidGlassSurface = ({
  className,
  accent = ["#3ad6ff", "#8b5cf6"],
  blur = 36,
  frost = 0.55,
  staticHighlight = false,
  children,
}: PropsWithChildren<Props>) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Pointer-relative highlight position (0..1 in both axes).
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 140, damping: 22, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 140, damping: 22, mass: 0.5 });

  const highlight = useMotionTemplate`radial-gradient(
    600px circle at calc(${sx} * 100%) calc(${sy} * 100%),
    rgba(255,255,255,0.18),
    rgba(255,255,255,0) 60%
  )`;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (staticHighlight) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const frostRgba = `rgba(255,255,255,${Math.max(0, Math.min(1, frost)) * 0.18})`;

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      className={cn(
        "relative isolate overflow-hidden rounded-3xl",
        "border border-glass-stroke",
        "shadow-glass-lg",
        "transition-shadow duration-300",
        className,
      )}
      style={{
        // CSS custom prop so descendants can pick up the same blur radius.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--nv-blur" as any]: `${blur}px`,
      }}
    >
      {/* Layer 1 — animated chromatic blobs. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-24"
        initial={{ opacity: 0.55 }}
        animate={{
          rotate: [0, 18, -12, 0],
          scale: [1, 1.08, 0.96, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: `
            radial-gradient(40% 35% at 25% 30%, ${accent[0]}55 0%, transparent 70%),
            radial-gradient(45% 40% at 75% 65%, ${accent[1]}55 0%, transparent 70%),
            radial-gradient(60% 55% at 50% 110%, ${accent[0]}33 0%, transparent 75%)
          `,
          filter: "blur(40px) saturate(1.15)",
        }}
      />

      {/* Layer 2 — frosted plate. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(var(--nv-blur)) saturate(1.4)",
          WebkitBackdropFilter: "blur(var(--nv-blur)) saturate(1.4)",
          background: `linear-gradient(135deg, ${frostRgba} 0%, rgba(255,255,255,0.04) 100%)`,
          boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.18)",
        }}
      />

      {/* Layer 3 — content. */}
      <div className="relative z-10">{children}</div>

      {/* Layer 4 — specular highlight tracking the pointer. */}
      {!staticHighlight && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{ backgroundImage: highlight }}
        />
      )}
    </div>
  );
};
