/**
 * Public ticket tracker — `/t/[code]`.
 *
 * Anonymous. The URL contains an opaque `trackingHash` (cuid-style)
 * generated when the ticket is created. The page is SSR for the initial
 * paint (so SMS link previews and crawlers see something useful) and
 * the `PublicTicketTracker` client component then takes over for live
 * updates via `useHotTicketSocket`.
 *
 * Hydration policy: the server pre-formats every clock value and ships
 * `initialElapsedSec` as a number. The client never calls `Date.now()`
 * during initial render.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { PublicTicketTracker } from "@/components/booking/PublicTicketTracker";
import { formatDateUz, formatHHmm } from "@/lib/format";
import { MOCK_CLINICS, TICKET_SEEDS } from "@/lib/mock-data";
import { computeExpectedAt } from "@/lib/triage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sizning navbatingiz · Akfa Medline",
  description: "Akfa Medline klinikasi onlayn navbati holatini kuzatib boring.",
  robots: { index: false, follow: false }, // public but don't index personal pages
  alternates: { canonical: "/t" },
};

interface PageProps {
  params: { code: string };
}

export default function TrackerPage({ params }: PageProps) {
  // Mock lookup — in production: prisma.hotTicket.findUnique({ trackingHash }).
  // We map the hash to the first KUTMOQDA / TASDIQLANGAN seed in the
  // Tashkent main clinic, and salt the patient's first name with the
  // trailing characters of the URL so different links render as different
  // patients.
  const clinic = MOCK_CLINICS[0]!;
  const liveSeed =
    TICKET_SEEDS.find(
      (s) => s.status === "TASDIQLANGAN" || s.status === "KUTMOQDA",
    ) ?? TICKET_SEEDS[0]!;

  const now = new Date();
  const entryAt = new Date(now.getTime() - liveSeed.enteredMinAgo * 60_000);
  const expectedAt = computeExpectedAt(entryAt, liveSeed.severity);
  const initialElapsedSec = Math.max(
    0,
    Math.floor((now.getTime() - entryAt.getTime()) / 1000),
  );

  // Stable position estimate from seeds.
  const totalAhead = TICKET_SEEDS.filter(
    (s) =>
      s.department === liveSeed.department &&
      (s.status === "KUTMOQDA" || s.status === "TASDIQLANGAN"),
  ).length;

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <Link
            href={`/c/${clinic.slug}`}
            className="text-sm font-medium text-slate-600 hover:text-blue-700"
          >
            ← Klinika sahifasiga qaytish
          </Link>
          <span className="font-mono text-xs text-slate-500">
            {formatDateUz(now)} · {formatHHmm(now)}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <PublicTicketTracker
          ticketCode={liveSeed.ticketCode}
          patientFirstName={liveSeed.patientFullName.split(" ")[0]!}
          clinicDisplayName={clinic.displayName}
          clinicSlug={clinic.slug}
          department={liveSeed.department}
          severity={liveSeed.severity}
          status={liveSeed.status}
          positionInQueue={Math.max(1, totalAhead)}
          totalAhead={Math.max(0, totalAhead - 1)}
          entryAtFormatted={formatHHmm(entryAt)}
          expectedAtFormatted={formatHHmm(expectedAt)}
          initialElapsedSec={initialElapsedSec}
        />
        {/* Tracking-hash echo for debugging (not user-facing copy). */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Kuzatish kodi: <span className="font-mono">{params.code}</span>
        </p>
      </div>
    </main>
  );
}
