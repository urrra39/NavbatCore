/**
 * StatusBadge — pill rendering the queue lifecycle state in Uzbek.
 *
 * Each status has a distinct neutral / brand-tinted ring color so a
 * receptionist can scan the table at a glance. Terminal states
 * (Tugatildi, Bekor, Kelmadi) deliberately use muted tones so they
 * recede behind the active rows.
 */

import { cn } from "@/lib/cn";
import { type QueueStatus, STATUS_LABEL_UZ } from "@/lib/triage";

const STYLE: Record<QueueStatus, string> = {
  KUTMOQDA: "bg-slate-100 text-slate-700 ring-slate-500/20",
  TASDIQLANGAN: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ROYXATDA: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  QABULDA: "bg-cyan-50 text-cyan-800 ring-cyan-700/30",
  TUGATILDI: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  BEKOR: "bg-rose-50 text-rose-700 ring-rose-600/20",
  KELMADI: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

interface Props {
  status: QueueStatus;
  className?: string;
}

export const StatusBadge = ({ status, className }: Props) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
      STYLE[status],
      className,
    )}
  >
    {STATUS_LABEL_UZ[status]}
  </span>
);
