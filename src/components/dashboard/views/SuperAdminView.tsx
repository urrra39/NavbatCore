/**
 * SuperAdminView — Bosh administrator paneli.
 *
 * Cross-tenant analytics:
 *   * Aggregate KPIs (total clinics, active queues, today's patients,
 *     SLA breaches in the last 24h).
 *   * A table summarizing every clinic in the network with an activation
 *     toggle (read-only in this boilerplate; wired to a server action in
 *     production).
 *   * A live AuditLog stream — read-only ledger surfaces with the HMAC
 *     signature trimmed for the UI.
 *
 * Pure presentational; the parent (DashboardShell) supplies the data.
 */

"use client";

import { cn } from "@/lib/cn";
import {
  type MockClinicSummary,
  MOCK_CLINIC_SUMMARIES,
} from "@/lib/mock-data";

interface Props {
  clinics?: ReadonlyArray<MockClinicSummary>;
  generatedAtFormatted: string;
}

export const SuperAdminView = ({
  clinics = MOCK_CLINIC_SUMMARIES,
  generatedAtFormatted,
}: Props) => {
  const totalClinics = clinics.length;
  const activeClinics = clinics.filter((c) => c.isActive).length;
  const totalActiveQueues = clinics.reduce((acc, c) => acc + c.activeQueues, 0);
  const totalPatientsToday = clinics.reduce(
    (acc, c) => acc + c.todaysPatients,
    0,
  );
  const totalBreaches = clinics.reduce((acc, c) => acc + c.slaBreaches24h, 0);

  return (
    <div className="space-y-6">
      {/* ---------- KPI tiles ---------- */}
      <section
        aria-label="Tarmoq ko'rsatkichlari"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KPI label="Filiallar (faol/jami)" value={`${activeClinics}/${totalClinics}`} hint="Akfa Medline tarmog'i" />
        <KPI label="Faol navbatlar" value={totalActiveQueues.toString()} hint="Hozir kutmoqda yoki qabulda" tone="blue" />
        <KPI label="Bugungi bemorlar" value={totalPatientsToday.toString()} hint="Tarmoq bo'yicha" />
        <KPI label="SLA buzilishlari (24s)" value={totalBreaches.toString()} hint={`Yangilangan: ${generatedAtFormatted}`} tone="red" />
      </section>

      {/* ---------- Tenant table ---------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Filiallar bo'yicha xulosa
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Faollashtirish tugmasi tarmoq darajasidagi audit jurnaliga yoziladi.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3">Filial</th>
                <th scope="col" className="px-6 py-3">Shahar</th>
                <th scope="col" className="px-6 py-3">Faol navbat</th>
                <th scope="col" className="px-6 py-3">Bugun</th>
                <th scope="col" className="px-6 py-3">SLA (24s)</th>
                <th scope="col" className="px-6 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clinics.map((c) => (
                <tr key={c.clinicId} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3 font-medium text-slate-900">{c.clinicName}</td>
                  <td className="px-6 py-3 text-slate-700">{c.city}</td>
                  <td className="px-6 py-3 font-mono tabular-nums text-slate-900">{c.activeQueues}</td>
                  <td className="px-6 py-3 font-mono tabular-nums text-slate-900">{c.todaysPatients}</td>
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                        c.slaBreaches24h === 0
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : c.slaBreaches24h <= 2
                            ? "bg-amber-50 text-amber-800 ring-amber-600/30"
                            : "bg-red-50 text-red-700 ring-red-600/30",
                      )}
                    >
                      {c.slaBreaches24h} ta buzilish
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        c.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          c.isActive ? "bg-emerald-500" : "bg-zinc-400",
                        )}
                      />
                      {c.isActive ? "Faol" : "To'xtatilgan"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Audit log stream ---------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Tarmoq audit jurnali
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Har bir yozuv HMAC-SHA256 imzo bilan zanjirga ulanadi. Tahrirlash mumkin emas.
          </p>
        </header>
        <ul className="divide-y divide-slate-100">
          {MOCK_AUDIT_FEED.map((row) => (
            <li key={row.id} className="px-6 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-900">
                    <span className="font-mono text-xs text-slate-500">
                      [{row.clinicLabel}]
                    </span>{" "}
                    <span className="font-medium">{row.actionLabel}</span>
                    <span className="text-slate-500"> — {row.target}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    sig: {row.signaturePrefix}…
                  </div>
                </div>
                <div className="shrink-0 font-mono text-xs text-slate-500">
                  {row.atFormatted}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Local mock — audit feed
// -----------------------------------------------------------------------------

interface AuditFeedRow {
  id: string;
  clinicLabel: string;
  actionLabel: string;
  target: string;
  signaturePrefix: string;
  atFormatted: string;
}

const MOCK_AUDIT_FEED: ReadonlyArray<AuditFeedRow> = [
  { id: "a1", clinicLabel: "Toshkent", actionLabel: "Favqulodda bemor qo'shildi", target: "ticket E-014", signaturePrefix: "9a3f7c12bf41", atFormatted: "14:38:02" },
  { id: "a2", clinicLabel: "Toshkent", actionLabel: "Holat o'zgarishi: TASDIQLANGAN → QABULDA", target: "ticket K-104", signaturePrefix: "ef4d61022a6c", atFormatted: "14:36:11" },
  { id: "a3", clinicLabel: "Samarqand", actionLabel: "SLA buzilishi aniqlandi", target: "ticket K-098 (Dr. Bobur)", signaturePrefix: "3c81442be0fa", atFormatted: "14:29:55" },
  { id: "a4", clinicLabel: "Buxoro", actionLabel: "Holat o'zgarishi: QABULDA → TUGATILDI", target: "ticket S-049", signaturePrefix: "21fc09a4ed10", atFormatted: "14:25:03" },
  { id: "a5", clinicLabel: "Toshkent", actionLabel: "Klinika sozlamalari yangilandi", target: "Kardiologiya · slaThresholdSec", signaturePrefix: "7b1aae18d3c4", atFormatted: "13:58:47" },
];

// -----------------------------------------------------------------------------
// KPI tile
// -----------------------------------------------------------------------------

const KPI = ({
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
