/**
 * DepartmentTable — the core data grid for the dashboard.
 *
 * Columns (Uzbek):
 *   * Bemor              — patient avatar, name, ticket code, room
 *   * Holati             — severity badge + triage budget (e.g. "25 daq.")
 *   * Navbat holati      — queue status badge
 *   * Kirgan vaqti       — entry time, server-formatted "HH:mm"
 *   * Sarflangan vaqt    — live ticker (ElapsedTime, hydration-safe)
 *   * Kutilayotgan vaqt  — expected serve time + assigned doctor
 *
 * The component itself is presentational; tab state lives one level up
 * in DashboardShell. Rows render via a stable `id` key so React's
 * reconciler stays cheap when the user switches departments.
 */

import { ElapsedTime } from "@/components/dashboard/ElapsedTime";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  type DashboardTicket,
  type Department,
  DEPARTMENT_LABEL_UZ,
  TRIAGE_MINUTES,
} from "@/lib/triage";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  department: Department;
}

export const DepartmentTable = ({ tickets, department }: Props) => {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ---------- Table header strip ---------- */}
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {DEPARTMENT_LABEL_UZ[department]} bo'limi · navbat ro'yxati
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Jami {tickets.length} ta bemor · saralash algoritmi: yengil 15
            daqiqa, o'rta 25 daqiqa, og'ir 45 daqiqa.
          </p>
        </div>
      </header>

      {/* ---------- Table ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th scope="col" className="px-6 py-3">
                Bemor
              </th>
              <th scope="col" className="px-6 py-3">
                Holati
              </th>
              <th scope="col" className="px-6 py-3">
                Navbat holati
              </th>
              <th scope="col" className="px-6 py-3">
                Kirgan vaqti
              </th>
              <th scope="col" className="px-6 py-3">
                Sarflangan vaqt
              </th>
              <th scope="col" className="px-6 py-3">
                Kutilayotgan vaqt
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {tickets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center text-sm text-slate-500"
                >
                  Hozirda bu bo'limda ro'yxatga olingan bemor yo'q.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  {/* Bemor */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100"
                      >
                        {t.patientInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">
                          {t.patientFullName}
                        </div>
                        <div className="font-mono text-xs text-slate-500">
                          {t.ticketCode} · {t.room}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Holati */}
                  <td className="px-6 py-4 align-top">
                    <SeverityBadge severity={t.severity} />
                    <div className="mt-1 text-xs text-slate-500">
                      Saralash: {TRIAGE_MINUTES[t.severity]} daq.
                    </div>
                  </td>

                  {/* Navbat holati */}
                  <td className="px-6 py-4 align-top">
                    <StatusBadge status={t.status} />
                  </td>

                  {/* Kirgan vaqti */}
                  <td className="px-6 py-4 align-top">
                    <span className="font-mono tabular-nums text-slate-900">
                      {t.entryAtFormatted}
                    </span>
                    <div className="text-xs text-slate-500">Toshkent vaqti</div>
                  </td>

                  {/* Sarflangan vaqt */}
                  <td className="px-6 py-4 align-top">
                    <ElapsedTime
                      initialElapsedSec={t.initialElapsedSec}
                      status={t.status}
                    />
                  </td>

                  {/* Kutilayotgan vaqt */}
                  <td className="px-6 py-4 align-top">
                    <div className="font-mono tabular-nums text-slate-900">
                      {t.expectedAtFormatted}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Shifokor: {t.doctorFullName}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
