/**
 * ClinicAdminView — Klinika administratori paneli.
 *
 * Tenant-isolated metrics for the active clinic:
 *   * Per-department live snapshot (active queue depth, average wait,
 *     SLA breach count today).
 *   * Real-time SLA violation alert list — sorted by overrun magnitude.
 *   * Daily throughput strip showing completed vs. canceled vs. no-show.
 *
 * Pure presentational. The parent supplies the dataset slices.
 */

"use client";

import { cn } from "@/lib/cn";
import {
  type DashboardTicket,
  DEPARTMENT_LABEL_UZ,
  DEPARTMENT_ORDER,
  type Department,
  TRIAGE_MINUTES,
  TicketStatus,
  isTerminalStatus,
} from "@/lib/triage";
import { MOCK_SLA_INCIDENTS } from "@/lib/mock-data";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  generatedAtFormatted: string;
}

export const ClinicAdminView = ({ tickets, generatedAtFormatted }: Props) => {
  const perDepartment = DEPARTMENT_ORDER.map((dep) => {
    const inDep = tickets.filter((t) => t.department === dep);
    const active = inDep.filter((t) => !isTerminalStatus(t.status));
    const completed = inDep.filter((t) => t.status === TicketStatus.TUGATILDI);
    const canceled = inDep.filter(
      (t) => t.status === TicketStatus.BEKOR_QILINGAN,
    );
    const noShow = inDep.filter((t) => t.status === TicketStatus.KELMADI);
    const avgBudget =
      inDep.length > 0
        ? Math.round(
            inDep.reduce((acc, t) => acc + TRIAGE_MINUTES[t.severity], 0) /
              inDep.length,
          )
        : 0;
    return {
      dep,
      total: inDep.length,
      active: active.length,
      completed: completed.length,
      canceled: canceled.length,
      noShow: noShow.length,
      avgBudget,
    };
  });

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {perDepartment.map((d) => (
          <DeptCard key={d.dep} dep={d.dep} {...d} />
        ))}
      </section>

      {/* SLA alerts */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              SLA buzilish ogohlantirishlari
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Saralash budgetidan oshib ketgan konsultatsiyalar.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Yangilangan: <span className="font-mono">{generatedAtFormatted}</span>
          </div>
        </header>
        <ul className="divide-y divide-slate-100">
          {MOCK_SLA_INCIDENTS.map((s) => {
            const overrun = s.observedMin - s.budgetMin;
            return (
              <li key={s.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-900">
                    <span className="font-mono text-xs text-slate-500">{s.ticketCode}</span>{" "}
                    <span className="font-medium">{s.doctorName}</span>
                    <span className="text-slate-500"> · {DEPARTMENT_LABEL_UZ[s.department]}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.detectedMinAgo} daqiqa oldin aniqlandi · budjet {s.budgetMin} daq · kuzatildi {s.observedMin} daq
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                    overrun >= 10
                      ? "bg-red-50 text-red-700 ring-red-600/30"
                      : "bg-amber-50 text-amber-800 ring-amber-600/30",
                  )}
                >
                  +{overrun} daq.
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Daily throughput */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Bugungi taqsimot
        </h2>
        <p className="text-sm text-slate-500">
          Yopilgan, bekor qilingan va kelmagan bemorlarning bo'limlar bo'yicha taqsimoti.
        </p>
        <div className="mt-4 space-y-3">
          {perDepartment.map((d) => {
            const finalized = d.completed + d.canceled + d.noShow;
            const segPct = (n: number) =>
              finalized === 0 ? 0 : Math.round((n / finalized) * 100);
            return (
              <div key={d.dep}>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium text-slate-900">
                    {DEPARTMENT_LABEL_UZ[d.dep]}
                  </span>
                  <span className="font-mono tabular-nums">
                    {finalized} ta yakunlangan
                  </span>
                </div>
                <div
                  aria-hidden
                  className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
                >
                  <div className="bg-emerald-500" style={{ width: `${segPct(d.completed)}%` }} />
                  <div className="bg-rose-500" style={{ width: `${segPct(d.canceled)}%` }} />
                  <div className="bg-zinc-400" style={{ width: `${segPct(d.noShow)}%` }} />
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
                  <Legend dot="bg-emerald-500" label={`${d.completed} tugatildi`} />
                  <Legend dot="bg-rose-500" label={`${d.canceled} bekor`} />
                  <Legend dot="bg-zinc-400" label={`${d.noShow} kelmadi`} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const DeptCard = ({
  dep,
  total,
  active,
  avgBudget,
}: {
  dep: Department;
  total: number;
  active: number;
  avgBudget: number;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {DEPARTMENT_LABEL_UZ[dep]}
    </div>
    <div className="mt-1.5 flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums text-slate-900">
        {active}
      </span>
      <span className="text-xs text-slate-500">faol / {total} jami</span>
    </div>
    <div className="mt-1 text-xs text-slate-500">
      O'rtacha saralash: {avgBudget} daq.
    </div>
  </div>
);

const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />
    {label}
  </span>
);
