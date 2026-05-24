"use client";

/**
 * DoctorView — Shifokor paneli.
 *
 * Read-only personal stream:
 *   * High-visibility SLA countdown for the active consultation.
 *   * Current patient card.
 *   * Next 3 tickets in line.
 *   * Total queue depth indicator.
 *
 * The doctor's department is selected via a small filter at the top
 * (in production this comes from the user record). The SLA countdown
 * uses the hydration-safe pattern: server seeds `initialElapsedSec`,
 * client ticks via `useEffect`.
 */

import { useMemo, useState } from "react";

import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { SlaCountdown } from "@/components/dashboard/SlaCountdown";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import {
  type DashboardTicket,
  DEPARTMENT_LABEL_UZ,
  DEPARTMENT_ORDER,
  type Department,
  TRIAGE_BUDGET_SEC,
  TicketStatus,
  isTerminalStatus,
} from "@/lib/triage";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  generatedAtFormatted: string;
}

export const DoctorView = ({ tickets, generatedAtFormatted }: Props) => {
  const [activeDep, setActiveDep] = useState<Department>(
    DEPARTMENT_ORDER[0],
  );

  // Filter to "the doctor's" assigned department + just one doctor's tickets
  // (mocked here as the first doctor name we encounter for the department).
  const doctorName = useMemo(
    () => tickets.find((t) => t.department === activeDep)?.doctorFullName ?? "",
    [tickets, activeDep],
  );

  const myTickets = useMemo(
    () =>
      tickets.filter(
        (t) => t.department === activeDep && t.doctorFullName === doctorName,
      ),
    [tickets, activeDep, doctorName],
  );

  const inProgress = myTickets.find((t) => t.status === TicketStatus.QABULDA);
  const upcoming = myTickets
    .filter(
      (t) =>
        t.status === TicketStatus.TASDIQLANGAN ||
        t.status === TicketStatus.KUTMOQDA,
    )
    .sort((a, b) => a.entryAt.localeCompare(b.entryAt))
    .slice(0, 3);
  const remaining = myTickets.filter((t) => !isTerminalStatus(t.status)).length;

  // Server-seeded elapsed for the active consultation.
  const consultElapsedSec = inProgress?.initialElapsedSec ?? 0;
  const slaBudget = inProgress
    ? TRIAGE_BUDGET_SEC[inProgress.severity]
    : TRIAGE_BUDGET_SEC.ORTA;

  return (
    <div className="space-y-6">
      {/* ---------- Department selector + identity ---------- */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
              {doctorName ? doctorName.split(" ").slice(-1)[0]!.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Shifokor paneli
              </div>
              <div className="text-base font-semibold text-slate-900">
                {doctorName || "Tizimga kirilmagan"}
              </div>
              <div className="text-xs text-slate-500">
                {DEPARTMENT_LABEL_UZ[activeDep]} bo'limi · jami {remaining} ta navbat
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {DEPARTMENT_ORDER.map((dep) => (
              <button
                key={dep}
                type="button"
                onClick={() => setActiveDep(dep)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  dep === activeDep
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-white",
                )}
              >
                {DEPARTMENT_LABEL_UZ[dep]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- SLA countdown + current patient ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SlaCountdown
          initialElapsedSec={inProgress ? consultElapsedSec : 0}
          budgetSec={slaBudget}
          paused={!inProgress}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Hozir qabuldagi bemor
          </div>
          {inProgress ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">
                  {inProgress.patientFullName}
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {inProgress.ticketCode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <SeverityBadge severity={inProgress.severity} />
                <span>·</span>
                <StatusBadge status={inProgress.status} />
              </div>
              <div className="text-xs text-slate-500">
                Kirgan vaqti: <span className="font-mono">{inProgress.entryAtFormatted}</span> ·
                Xona: {inProgress.room}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Hozir qabuldagi bemor yo'q. Keyingi bemor kutmoqda.
            </div>
          )}
        </div>
      </section>

      {/* ---------- Up next ---------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Keyingi bemorlar
          </h2>
          <span className="text-xs text-slate-500">
            Jami {remaining} ta · yangilangan {generatedAtFormatted}
          </span>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Sizning ro'yxatingizda kutayotgan bemorlar yo'q.
          </div>
        ) : (
          <ol className="mt-3 space-y-2">
            {upcoming.map((t, idx) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {t.patientFullName}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      {t.ticketCode} · {t.room}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={t.severity} />
                  <span className="font-mono text-xs text-slate-700">
                    {t.expectedAtFormatted}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
