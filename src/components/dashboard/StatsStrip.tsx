/**
 * StatsStrip — top-of-table KPI tiles for the active department.
 *
 * Pure presentational; the parent (DashboardShell) recomputes the props
 * whenever the user switches departments. The "average expected time"
 * uses the same TRIAGE_MINUTES table the table cells use, so the KPI
 * never disagrees with the row data.
 */

import {
  type DashboardTicket,
  type Department,
  DEPARTMENT_LABEL_UZ,
  Severity,
  TRIAGE_MINUTES,
  isTerminalStatus,
} from "@/lib/triage";
import { cn } from "@/lib/cn";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  department: Department;
  generatedAtFormatted: string;
}

export const StatsStrip = ({
  tickets,
  department,
  generatedAtFormatted,
}: Props) => {
  const total = tickets.length;
  const active = tickets.filter((t) => !isTerminalStatus(t.status)).length;
  const ogir = tickets.filter((t) => t.severity === Severity.OGIR).length;

  const avgMin =
    total > 0
      ? Math.round(
          tickets.reduce((acc, t) => acc + TRIAGE_MINUTES[t.severity], 0) /
            total,
        )
      : 0;

  return (
    <section
      aria-label="Bo'lim ko'rsatkichlari"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <Stat
        label="Jami bemor"
        value={total.toString()}
        hint={`${DEPARTMENT_LABEL_UZ[department]} bo'limi`}
      />
      <Stat
        label="Faol navbat"
        value={active.toString()}
        hint="Hozir kutmoqda yoki qabulda"
        tone="blue"
      />
      <Stat
        label="Og'ir holatlar"
        value={ogir.toString()}
        hint="Tezkor saralash talab qiladi"
        tone="red"
      />
      <Stat
        label="O'rtacha kutish"
        value={`${avgMin} daq`}
        hint={`Yangilangan: ${generatedAtFormatted}`}
      />
    </section>
  );
};

const Stat = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "blue" | "red";
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </div>
    <div
      className={cn(
        "mt-1.5 text-2xl font-semibold tabular-nums",
        tone === "blue" && "text-blue-700",
        tone === "red" && "text-red-700",
        tone === "default" && "text-slate-900",
      )}
    >
      {value}
    </div>
    <div className="mt-1 text-xs text-slate-500">{hint}</div>
  </div>
);
