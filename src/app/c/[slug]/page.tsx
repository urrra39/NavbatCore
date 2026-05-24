/**
 * Clinic detail + booking page — `/c/[slug]`.
 *
 * Fully SSR. Generates per-clinic metadata for SEO. The page is composed
 * of static server-rendered sections (clinic header, departments, doctors)
 * and one client component (`TriageBookingForm`) for the interactive form.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TriageBookingForm } from "@/components/booking/TriageBookingForm";
import { formatHHmm } from "@/lib/format";
import { findClinicBySlug, MOCK_CLINICS } from "@/lib/mock-data";
import { DEPARTMENT_LABEL_UZ } from "@/lib/triage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

// -----------------------------------------------------------------------------
// generateStaticParams — pre-render all known clinics
// -----------------------------------------------------------------------------

export const generateStaticParams = (): Array<{ slug: string }> =>
  MOCK_CLINICS.map((c) => ({ slug: c.slug }));

// -----------------------------------------------------------------------------
// Per-clinic SEO metadata
// -----------------------------------------------------------------------------

export const generateMetadata = ({ params }: PageProps): Metadata => {
  const c = findClinicBySlug(params.slug);
  if (!c) {
    return {
      title: "Klinika topilmadi · NavbatCore",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${c.displayName} · Onlayn navbat`,
    description: c.description,
    keywords: [
      c.displayName,
      c.city,
      "Akfa Medline",
      "onlayn navbat",
      ...c.departments.map((d) => DEPARTMENT_LABEL_UZ[d]),
    ],
    alternates: { canonical: `/c/${c.slug}` },
    openGraph: {
      type: "website",
      title: `${c.displayName} · Onlayn navbat`,
      description: c.description,
      locale: "uz_UZ",
    },
  };
};

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function ClinicPage({ params }: PageProps) {
  const c = findClinicBySlug(params.slug);
  if (!c) notFound();

  const now = new Date();
  const serverNowFormatted = formatHHmm(now);
  const serverNowIso = now.toISOString();

  return (
    <main className="min-h-dvh bg-slate-50">
      {/* ---------- Top bar ---------- */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-blue-700"
          >
            ← Barcha klinikalar
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:py-10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
            Akfa Medline · {c.city}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {c.displayName}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-slate-600">{c.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Manzil" value={c.addressLine} />
            <Stat label="Telefon" value={c.phone} mono />
            <Stat label="Ish vaqti" value={c.hoursSummary} />
            <Stat
              label="Faol navbat"
              value={`${c.liveQueueDepth} ta bemor`}
              mono
            />
          </dl>
        </div>
      </section>

      {/* ---------- Departments + Doctors + Booking ---------- */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_minmax(0,2fr)]">
        {/* Left column — departments & doctors */}
        <aside className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Mavjud bo'limlar
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.departments.map((d) => (
                <li
                  key={d}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-900">
                    {DEPARTMENT_LABEL_UZ[d]}
                  </span>
                  <span className="text-xs text-slate-500">Onlayn navbat</span>
                </li>
              ))}
            </ul>
          </div>

          {c.doctors.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Shifokorlar
              </h2>
              <ul className="mt-3 space-y-3">
                {c.doctors.slice(0, 6).map((doc) => (
                  <li key={doc.id} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                      {doc.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {doc.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doc.specialty} ·{" "}
                        {DEPARTMENT_LABEL_UZ[doc.department]} · {doc.room}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Right column — booking form */}
        <div>
          <TriageBookingForm
            clinicSlug={c.slug}
            availableDepartments={c.departments}
            serverNowIso={serverNowIso}
            serverNowFormatted={serverNowFormatted}
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div>{c.legalName} · NavbatCore</div>
          <div className="font-mono">Toshkent vaqti</div>
        </div>
      </footer>
    </main>
  );
}

const Stat = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </div>
    <div
      className={`mt-1 text-sm font-medium text-slate-900 ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {value}
    </div>
  </div>
);
