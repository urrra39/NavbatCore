/**
 * Dashboard host page — `/dashboard`.
 *
 * Server Component. Builds the mock dataset at request time (so the
 * elapsed counters look live on first load), pre-formats every timestamp
 * with the Asia/Tashkent Intl formatter, and hands the dataset to
 * `<DashboardShell/>` — the only client component on the page.
 *
 * The shell handles the 4-tier RBAC (Bosh administrator / Klinika
 * administratori / Qabulchi / Shifokor) and the persona-specific views.
 */

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { formatDateUz, formatHHmm } from "@/lib/format";
import { buildDashboardTickets } from "@/lib/mock-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Akfa Medline · Bosh boshqaruv paneli",
  description:
    "Akfa Medline shifoxonalar tarmog'ining ichki boshqaruv paneli — bo'limlar, navbatlar, SLA monitoringi va RBAC.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  const now = new Date();
  const tickets = buildDashboardTickets(now);
  const generatedAtFormatted = `${formatDateUz(now)} · ${formatHHmm(now)}`;

  return (
    <main className="min-h-dvh bg-slate-50">
      {/* ---------- Top bar ---------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:py-6">
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
            >
              <span className="text-lg font-bold leading-none">A</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                Akfa Medline
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Bosh boshqaruv paneli
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <a
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Onlayn navbat sahifasi
            </a>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-emerald-500"
              />
              <span className="font-medium">Tizim faol</span>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:inline-flex">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Sana
              </span>
              <span className="font-mono text-xs text-slate-800">
                {generatedAtFormatted}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Tarmoq bo'yicha navbat boshqaruvi
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            Saralash algoritmi: yengil holat 15 daqiqa, o'rta holat 25 daqiqa,
            og'ir holat 45 daqiqa. Quyidagi rolni tanlab tegishli ko'rinishni
            oching.
          </p>
        </div>

        <DashboardShell
          tickets={tickets}
          generatedAtFormatted={generatedAtFormatted}
        />
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div>
            Akfa Medline shifoxonalar tarmog'i · NavbatCore navbat boshqaruv tizimi
          </div>
          <div className="font-mono">
            Saralash algoritmi v1.2 · Toshkent vaqti
          </div>
        </div>
      </footer>
    </main>
  );
}
