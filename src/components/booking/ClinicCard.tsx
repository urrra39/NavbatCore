/**
 * ClinicCard — a single clinic in the public search results.
 *
 * Pure presentational, server-rendered for SEO. Every card links to
 * `/c/[slug]` (the clinic detail page) which is also fully SSR.
 */

import Link from "next/link";

import { cn } from "@/lib/cn";
import type { MockClinic } from "@/lib/mock-data";
import { DEPARTMENT_LABEL_UZ } from "@/lib/triage";

interface Props {
  clinic: MockClinic;
}

export const ClinicCard = ({ clinic }: Props) => (
  <Link
    href={`/c/${clinic.slug}`}
    className={cn(
      "group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all",
      "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
    )}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
            Akfa Medline
          </span>
          {clinic.liveQueueDepth <= 5 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Qisqa navbat
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-semibold text-slate-900 group-hover:text-blue-700">
          {clinic.displayName}
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {clinic.city}
          {clinic.district ? ` · ${clinic.district}` : ""} · {clinic.addressLine}
        </p>
      </div>
      <div className="text-right">
        <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
          {clinic.rating.toFixed(1)}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {clinic.reviewsCount.toLocaleString("en-GB")} ta sharh
        </div>
      </div>
    </div>

    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{clinic.description}</p>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      {clinic.departments.map((dep) => (
        <span
          key={dep}
          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
        >
          {DEPARTMENT_LABEL_UZ[dep]}
        </span>
      ))}
    </div>

    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
      <span>{clinic.hoursSummary}</span>
      <span className="font-mono tabular-nums">
        Faol navbat: <span className="font-semibold text-slate-900">{clinic.liveQueueDepth}</span>
      </span>
    </div>

    <div className="mt-4 inline-flex items-center text-sm font-semibold text-blue-700 group-hover:underline">
      Onlayn navbat olish →
    </div>
  </Link>
);
