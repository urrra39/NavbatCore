"use client";

/**
 * ClinicSearchForm — top-of-page filter for the public clinic search.
 *
 * Submitting the form pushes new query parameters via `router.push`, which
 * triggers a fresh server render of `/` with the filtered list. This keeps
 * the SEO surface SSR-friendly: every shareable URL produces a stable,
 * indexable HTML page.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { DEPARTMENT_LABEL_UZ, DEPARTMENT_ORDER } from "@/lib/triage";

interface Props {
  cities: ReadonlyArray<string>;
}

export const ClinicSearchForm = ({ cities }: Props) => {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [city, setCity] = useState(params.get("city") ?? "");
  const [dep, setDep] = useState(params.get("dep") ?? "");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (city) sp.set("city", city);
    if (dep) sp.set("dep", dep);
    startTransition(() => {
      router.push(sp.toString() ? `/?${sp.toString()}` : "/");
    });
  };

  const clear = () => {
    setQ("");
    setCity("");
    setDep("");
    startTransition(() => router.push("/"));
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Klinika qidiruvi"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <Field label="Klinika nomi yoki manzil" className="flex-1">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Masalan: Akfa Medline, Toshkent"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </Field>
        <Field label="Shahar" className="lg:w-48">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Barcha shaharlar</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bo'lim" className="lg:w-56">
          <select
            value={dep}
            onChange={(e) => setDep(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Barcha bo'limlar</option>
            {DEPARTMENT_ORDER.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABEL_UZ[d]}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-2 lg:pb-0.5">
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm",
              "hover:bg-blue-700 disabled:bg-blue-300",
            )}
          >
            {pending ? "Qidirilmoqda…" : "Qidirish"}
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tozalash
          </button>
        </div>
      </div>
    </form>
  );
};

const Field = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <label className={cn("flex flex-col gap-1.5", className)}>
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </span>
    {children}
  </label>
);
