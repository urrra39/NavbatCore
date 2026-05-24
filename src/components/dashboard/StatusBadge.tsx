/**
 * StatusBadge — Uzbek queue lifecycle pill.
 *
 * Color tokens:
 *   KUTMOQDA       slate   — neutral, "in line"
 *   TASDIQLANGAN   blue    — confirmed by reception
 *   QABULDA        cyan    — currently being seen
 *   TUGATILDI      emerald — closed, success
 *   BEKOR_QILINGAN rose    — canceled
 *   KELMADI        zinc    — no-show, muted
 */

import { cn } from "@/lib/cn";
import { type TicketStatus, STATUS_LABEL_UZ } from "@/lib/triage";

const STYLE: Record<TicketStatus, string> = {
  KUTMOQDA: "bg-slate-100 text-slate-700 ring-slate-500/20",
  TASDIQLANGAN: "bg-blue-50 text-blue-700 ring-blue-600/20",
  QABULDA: "bg-cyan-50 text-cyan-800 ring-cyan-700/30",
  TUGATILDI: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  BEKOR_QILINGAN: "bg-rose-50 text-rose-700 ring-rose-600/20",
  KELMADI: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

interface Props {
  status: TicketStatus;
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
