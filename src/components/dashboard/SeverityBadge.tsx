/**
 * SeverityBadge — pill rendering the patient triage tier.
 *
 * Pure presentational component (no client hooks); colors map to a
 * green/amber/red gradient that matches enterprise hospital dashboards.
 */

import { cn } from "@/lib/cn";
import { type Severity, SEVERITY_LABEL_UZ } from "@/lib/triage";

const STYLE: Record<Severity, { container: string; dot: string }> = {
  YENGIL: {
    container: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  ORTA: {
    container: "bg-amber-50 text-amber-800 ring-amber-600/30",
    dot: "bg-amber-500",
  },
  OGIR: {
    container: "bg-red-50 text-red-700 ring-red-600/30",
    dot: "bg-red-500",
  },
};

interface Props {
  severity: Severity;
  className?: string;
}

export const SeverityBadge = ({ severity, className }: Props) => {
  const s = STYLE[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        s.container,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {SEVERITY_LABEL_UZ[severity]}
    </span>
  );
};
