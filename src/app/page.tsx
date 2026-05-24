/**
 * Public clinic search portal — `/`.
 *
 * Server Component. Fully SSR for Google indexability:
 *   * Page is `force-dynamic` so the rendered HTML always reflects the
 *     current filter and live queue depth (no stale ISR snapshots).
 *   * Every clinic card is rendered as a real `<a>` link on the server,
 *     which is what crawlers consume.
 *   * The `ClinicSearchForm` is the only client component; submitting it
 *     pushes new query params and forces a fresh server render.
 *
 * Search params honored:
 *   q     — free-text match against name / city / address
 *   city  — exact city name
 *   dep   — department code (KARDIOLOGIYA / STOMATOLOGIYA / LOR / NEVROLOGIYA)
 */

import type { Metadata } from "next";
import Link from "next/link";

import { ClinicCard } from "@/components/booking/ClinicCard";
import { ClinicSearchForm } from "@/components/booking/ClinicSearchForm";
import { formatDateUz, formatHHmm } from "@/lib/format";
import { MOCK_CLINICS } from "@/lib/mock-data";
import { ClinicSearchInputSchema } from "@/schemas/booking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title:
    "Akfa Medline klinikasi onlayn navbat · NavbatCore",
  description:
    "Akfa Medline shifoxonalar tarmog'i bo'yicha onlayn navbat oling. Toshkent, Samarqand, Buxoro va boshqa shaharlardagi klinikalar — kardiologiya, stomatologiya, LOR va nevrologiya bo'limlari.",
  keywords: [
    "Akfa Medline",
    "onlayn navbat",
    "shifoxona Toshkent",
    "kardiolog navbat",
    "stomatolog navbat",
    "LOR shifokori",
    "nevrolog navbat",
    "klinika qidirish",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Akfa Medline · NavbatCore",
    title: "Akfa Medline klinikasi onlayn navbat",
    description:
      "Klinikani toping, bo'lim tanlang va onlayn navbat oling. Toshkent vaqtida real navbat.",
    locale: "uz_UZ",
  },
  robots: { index: true, follow: true },
};

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function HomePage({ searchParams }: PageProps) {
  // Validate + normalize search params via Zod.
  const flatten = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const parsed = ClinicSearchInputSchema.safeParse({
    q: flatten(searchParams?.q),
    dep: flatten(searchParams?.dep),
    city: flatten(searchParams?.city),
  });
  const filters = parsed.success ? parsed.data : {};

  const cities = Array.from(new Set(MOCK_CLINICS.map((c) => c.city))).sort();

  // Apply filters — order matters for SEO (broadest first).
  const results = MOCK_CLINICS.filter((c) => {
    if (filters.dep && !c.departments.includes(filters.dep)) return false;
    if (filters.city && c.city !== filters.city) return false;
    if (filters.q) {
      const needle = filters.q.toLowerCase();
      const haystack = `${c.displayName} ${c.city} ${c.addressLine}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const now = new Date();
  const generatedAtFormatted = `${formatDateUz(now)} · ${formatHHmm(now)}`;

  return (
    <main className="min-h-dvh bg-slate-50">
      {/* ---------- Top bar ---------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:py-6">
          <Link href="/" className="flex items-center gap-3">
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
              <span className="text-base font-semibold text-slate-900">
                Onlayn navbat tizimi
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Xodim paneli
            </Link>
            <span className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 sm:inline-flex">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Sana
              </span>
              <span className="ml-2 font-mono text-xs text-slate-800">
                {generatedAtFormatted}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 ring-1 ring-inset ring-blue-100">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Tarmoq bo'yicha jonli navbat
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Akfa Medline klinikasiga onlayn navbat oling
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              Klinikani toping, bo'lim tanlang va saralash algoritmiga ko'ra
              aniq qabul vaqtini oling — kelishingizdan oldin navbatda kutib
              o'tirmang.
            </p>
          </div>

          <div className="mt-7">
            <ClinicSearchForm cities={cities} />
          </div>
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {results.length === MOCK_CLINICS.length
              ? "Barcha filiallar"
              : "Qidiruv natijalari"}
            <span className="ml-2 font-mono text-sm text-slate-500">
              ({results.length} ta)
            </span>
          </h2>
        </div>

        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <h3 className="text-base font-semibold text-slate-900">
              Hech qanday klinika topilmadi
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Filtrlarni o'zgartirib qaytadan urinib ko'ring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {results.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
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
