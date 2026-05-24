"use client";

/**
 * DashboardShell — the only client-state owner on the page.
 *
 * Responsibilities:
 *   * Owns the active-department tab state (`activeDep`).
 *   * Filters the server-supplied ticket dataset client-side — this avoids
 *     a network roundtrip when the user clicks a tab.
 *   * Memoizes the filtered dataset and the per-department counts so
 *     re-renders are O(rows) once, then O(1) per click.
 *
 * No data fetching happens here; the parent (page.tsx) seeds the dataset
 * at request time and ships it down.
 */

import { useMemo, useState } from "react";

import { DepartmentTable } from "@/components/dashboard/DepartmentTable";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { cn } from "@/lib/cn";
import {
  type DashboardTicket,
  type Department,
  DEPARTMENT_LABEL_UZ,
  DEPARTMENT_ORDER,
  Department as DepartmentEnum,
} from "@/lib/triage";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  generatedAtFormatted: string;
}

export const DashboardShell = ({ tickets, generatedAtFormatted }: Props) => {
  const [activeDep, setActiveDep] = useState<Department>(
    DepartmentEnum.KARDIOLOGIYA,
  );

  const ticketsForDep = useMemo(
    () => tickets.filter((t) => t.department === activeDep),
    [tickets, activeDep],
  );

  const countByDep = useMemo(() => {
    const m = new Map<Department, number>();
    for (const dep of DEPARTMENT_ORDER) m.set(dep, 0);
    for (const t of tickets) {
      m.set(t.department, (m.get(t.department) ?? 0) + 1);
    }
    return m;
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* ---------- Department tabs ---------- */}
      <nav
        aria-label="Bo'limlar"
        className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        {DEPARTMENT_ORDER.map((dep) => {
          const isActive = dep === activeDep;
          const count = countByDep.get(dep) ?? 0;
          return (
            <button
              key={dep}
              type="button"
              onClick={() => setActiveDep(dep)}
              aria-pressed={isActive}
              className={cn(
                "flex min-w-[140px] flex-1 items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <span>{DEPARTMENT_LABEL_UZ[dep]}</span>
              <span
                className={cn(
                  "inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ---------- KPI tiles ---------- */}
      <StatsStrip
        tickets={ticketsForDep}
        department={activeDep}
        generatedAtFormatted={generatedAtFormatted}
      />

      {/* ---------- Data table ---------- */}
      <DepartmentTable tickets={ticketsForDep} department={activeDep} />
    </div>
  );
};
