"use client";

/**
 * ReceptionistView — the operational front-desk panel.
 *
 *   * Department tabs (Kardiologiya / Stomatologiya / LOR / Nevrologiya)
 *     filter the in-memory dataset client-side (no roundtrip).
 *   * StatsStrip + DepartmentTable render the selected slice.
 *   * Row click selects a ticket; the actions toolbar enables the right
 *     buttons based on the selected row's status.
 *   * The four operational actions (Chaqirish, Qabulni boshlash, Tugatish,
 *     Favqulodda bemor qo'shish) mutate the local dataset to demonstrate
 *     the full lifecycle without a backend.
 *
 * Real implementations replace the local mutations with server actions
 * — see ReceptionistActions.tsx for the contract.
 */

import { useCallback, useMemo, useState } from "react";

import { ElapsedTime } from "@/components/dashboard/ElapsedTime";
import {
  type EmergencyDraft,
  ReceptionistActions,
} from "@/components/dashboard/ReceptionistActions";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import {
  type DashboardTicket,
  type Department,
  DEPARTMENT_LABEL_UZ,
  DEPARTMENT_ORDER,
  Department as DepartmentEnum,
  TRIAGE_MINUTES,
  TicketStatus,
} from "@/lib/triage";

// -----------------------------------------------------------------------------
// Local helpers — initials + ticket code generator for the emergency buffer
// -----------------------------------------------------------------------------

const initialsOf = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const nextEmergencyCode = (existing: ReadonlyArray<DashboardTicket>): string => {
  const max = existing.reduce((acc, t) => {
    if (!t.ticketCode.startsWith("E-")) return acc;
    const n = parseInt(t.ticketCode.slice(2), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `E-${(max + 1).toString().padStart(3, "0")}`;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface Props {
  initialTickets: ReadonlyArray<DashboardTicket>;
  generatedAtFormatted: string;
}

export const ReceptionistView = ({
  initialTickets,
  generatedAtFormatted,
}: Props) => {
  const [tickets, setTickets] = useState<ReadonlyArray<DashboardTicket>>(
    initialTickets,
  );
  const [activeDep, setActiveDep] = useState<Department>(
    DepartmentEnum.KARDIOLOGIYA,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  // ---------------------------------------------------------------------------
  // Action handlers — local mutations matching the server-action contract.
  // ---------------------------------------------------------------------------

  const transition = useCallback(
    (id: string, to: TicketStatus) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: to } : t)),
      );
    },
    [],
  );

  const handleCallNext = useCallback(() => {
    // Promote the oldest KUTMOQDA in the active department -> TASDIQLANGAN.
    const next = ticketsForDep
      .filter((t) => t.status === TicketStatus.KUTMOQDA)
      .sort((a, b) => a.entryAt.localeCompare(b.entryAt))[0];
    if (!next) return;
    transition(next.id, TicketStatus.TASDIQLANGAN);
    setSelectedId(next.id);
  }, [ticketsForDep, transition]);

  const handleStartConsult = useCallback(() => {
    if (!selected || selected.status !== TicketStatus.TASDIQLANGAN) return;
    transition(selected.id, TicketStatus.QABULDA);
  }, [selected, transition]);

  const handleComplete = useCallback(() => {
    if (!selected || selected.status !== TicketStatus.QABULDA) return;
    transition(selected.id, TicketStatus.TUGATILDI);
    setSelectedId(null);
  }, [selected, transition]);

  const handleEmergency = useCallback(
    (draft: EmergencyDraft) => {
      // Emergency buffer interceptor:
      //   1. Insert a new TASDIQLANGAN ticket with `emergency=true`.
      //   2. The smart-ETA pipeline (mocked here) bumps every other
      //      KUTMOQDA / TASDIQLANGAN forward by `TRIAGE_MINUTES[severity]`.
      //   3. In production this transaction also publishes
      //      `queue.recalculated` over Redis Pub/Sub.
      const now = new Date();
      const entryAtIso = now.toISOString();
      const expectedAt = new Date(
        now.getTime() + TRIAGE_MINUTES[draft.severity] * 60_000,
      );

      const fmt = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tashkent",
      });

      const newTicket: DashboardTicket = {
        id: `t_emerg_${Date.now()}`,
        ticketCode: nextEmergencyCode(tickets),
        patientFullName: draft.fullName,
        patientInitials: initialsOf(draft.fullName),
        doctorFullName: "Dr. Navbatchi shifokor",
        room: "Tezkor xona",
        department: activeDep,
        severity: draft.severity,
        status: TicketStatus.TASDIQLANGAN,
        entryAt: entryAtIso,
        entryAtFormatted: fmt.format(now),
        expectedAt: expectedAt.toISOString(),
        expectedAtFormatted: fmt.format(expectedAt),
        initialElapsedSec: 0,
        emergency: true,
      };

      setTickets((prev) => {
        // Push the new emergency to the front; bump everyone else's ETA.
        const bumped = prev.map((t) => {
          if (
            t.department === activeDep &&
            (t.status === TicketStatus.KUTMOQDA ||
              t.status === TicketStatus.TASDIQLANGAN)
          ) {
            const newEta = new Date(
              new Date(t.expectedAt).getTime() +
                TRIAGE_MINUTES[draft.severity] * 60_000,
            );
            return {
              ...t,
              expectedAt: newEta.toISOString(),
              expectedAtFormatted: fmt.format(newEta),
            };
          }
          return t;
        });
        return [newTicket, ...bumped];
      });
      setSelectedId(newTicket.id);
    },
    [tickets, activeDep],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
              onClick={() => {
                setActiveDep(dep);
                setSelectedId(null);
              }}
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

      {/* ---------- Action toolbar ---------- */}
      <ReceptionistActions
        hasSelection={!!selected}
        selectedStatus={selected?.status ?? null}
        onCallNext={handleCallNext}
        onStartConsult={handleStartConsult}
        onComplete={handleComplete}
        onEmergencyInsert={handleEmergency}
      />

      {/* ---------- Data table ---------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {DEPARTMENT_LABEL_UZ[activeDep]} bo'limi · navbat ro'yxati
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Jami {ticketsForDep.length} ta bemor · saralash algoritmi:
              yengil 15 daqiqa, o'rta 25 daqiqa, og'ir 45 daqiqa.
            </p>
          </div>
          {selected && (
            <div className="text-xs text-slate-500">
              Tanlangan: <span className="font-mono text-slate-800">{selected.ticketCode}</span> —{" "}
              <span className="font-medium text-slate-700">{selected.patientFullName}</span>
            </div>
          )}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3">Bemor</th>
                <th scope="col" className="px-6 py-3">Holati</th>
                <th scope="col" className="px-6 py-3">Navbat holati</th>
                <th scope="col" className="px-6 py-3">Kirgan vaqti</th>
                <th scope="col" className="px-6 py-3">Sarflangan vaqt</th>
                <th scope="col" className="px-6 py-3">Kutilayotgan vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {ticketsForDep.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-sm text-slate-500"
                  >
                    Hozirda bu bo'limda ro'yxatga olingan bemor yo'q.
                  </td>
                </tr>
              ) : (
                ticketsForDep.map((t) => {
                  const isSelected = t.id === selectedId;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected
                          ? "bg-blue-50/70"
                          : "hover:bg-slate-50/70",
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset",
                              t.emergency
                                ? "bg-red-50 text-red-700 ring-red-200"
                                : "bg-blue-50 text-blue-700 ring-blue-100",
                            )}
                          >
                            {t.patientInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-medium text-slate-900">
                                {t.patientFullName}
                              </span>
                              {t.emergency && (
                                <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">
                                  Favqulodda
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-slate-500">
                              {t.ticketCode} · {t.room}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <SeverityBadge severity={t.severity} />
                        <div className="mt-1 text-xs text-slate-500">
                          Saralash: {TRIAGE_MINUTES[t.severity]} daq.
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="font-mono tabular-nums text-slate-900">
                          {t.entryAtFormatted}
                        </span>
                        <div className="text-xs text-slate-500">Toshkent vaqti</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <ElapsedTime
                          initialElapsedSec={t.initialElapsedSec}
                          status={t.status}
                        />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-mono tabular-nums text-slate-900">
                          {t.expectedAtFormatted}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Shifokor: {t.doctorFullName}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
