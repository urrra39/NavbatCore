"use client";

/**
 * TriageBookingForm — patient-facing booking form on `/c/[slug]`.
 *
 * Fields:
 *   * Full name (Uzbek-friendly regex)
 *   * Phone (+998 E.164)
 *   * Department (radio chips)
 *   * Severity (radio chips, each shows the triage budget)
 *   * Symptom note (optional)
 *   * Consent checkbox
 *
 * Validation is performed twice:
 *   1. Client-side via `BookingFormInputSchema.safeParse` so the UX is
 *      instant.
 *   2. Server-side, by the action that ultimately writes to Postgres
 *      (the boilerplate stops at the simulated success screen).
 *
 * On success the form shows a tracking hash and a CTA to `/t/[hash]`.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatHHmm } from "@/lib/format";
import {
  type BookingFormInput,
  BookingFormInputSchema,
} from "@/schemas/booking";
import {
  DEPARTMENT_LABEL_UZ,
  type DepartmentCode,
  SEVERITY_DESCRIPTION_UZ,
  SEVERITY_LABEL_UZ,
  Severity,
  TRIAGE_MINUTES,
  buildTriageQuote,
} from "@/lib/triage";

interface Props {
  clinicSlug: string;
  availableDepartments: ReadonlyArray<DepartmentCode>;
  /** ISO string seeded by the server — used as the entry-time anchor. */
  serverNowIso: string;
  serverNowFormatted: string;
}

type FieldErrors = Partial<Record<keyof BookingFormInput, string>>;

const SEVERITY_ORDER: ReadonlyArray<Severity> = [
  Severity.YENGIL,
  Severity.ORTA,
  Severity.OGIR,
];

export const TriageBookingForm = ({
  clinicSlug,
  availableDepartments,
  serverNowIso,
  serverNowFormatted,
}: Props) => {
  const [departmentCode, setDepartmentCode] = useState<DepartmentCode>(
    availableDepartments[0] ?? "KARDIOLOGIYA",
  );
  const [severity, setSeverity] = useState<Severity>(Severity.ORTA);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [symptomNote, setSymptomNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<{
    code: string;
    trackingHash: string;
    expectedAtFormatted: string;
  } | null>(null);

  // Triage quote for the inline "Kutilayotgan vaqt" preview.
  const quote = useMemo(() => {
    const entryAt = new Date(serverNowIso);
    return buildTriageQuote(entryAt, severity, formatHHmm);
  }, [serverNowIso, severity]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const parsed = BookingFormInputSchema.safeParse({
      clinicSlug,
      departmentCode,
      fullName,
      phoneE164: phone,
      severity,
      symptomNote: symptomNote || undefined,
      consent,
    } satisfies Partial<BookingFormInput>);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof BookingFormInput;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    // In production this hits a server action; here we simulate the
    // server response so the success state can be exercised.
    const trackingHash = `c${Math.random().toString(36).slice(2, 26)}`;
    const codePrefix = departmentCode[0]!;
    const code = `${codePrefix}-${(100 + Math.floor(Math.random() * 900)).toString()}`;
    setSubmitted({
      code,
      trackingHash,
      expectedAtFormatted: quote.expectedAtFormatted,
    });
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Navbat tasdiqlandi
        </div>
        <h3 className="mt-1 text-xl font-semibold text-emerald-900">
          Hurmatli {fullName}, navbatingiz qabul qilindi.
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Navbat raqami" value={submitted.code} mono />
          <Stat
            label="Bo'lim"
            value={DEPARTMENT_LABEL_UZ[departmentCode]}
          />
          <Stat
            label="Kutilayotgan vaqt"
            value={submitted.expectedAtFormatted}
            mono
          />
        </div>
        <p className="mt-4 text-sm text-emerald-900">
          Quyidagi havola orqali navbatingiz holatini istalgan vaqtda kuzatib
          borishingiz mumkin. Havola anonim — kirish talab qilinmaydi.
        </p>
        <a
          href={`/t/${submitted.trackingHash}`}
          className="mt-4 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
        >
          Navbatni kuzatish →
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="Onlayn navbat olish"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        Onlayn navbat
      </div>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">
        Bemor ma'lumotlari
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Quyidagi shaklni to'ldiring — kelishingiz uchun aniq vaqt taklif qilamiz.
      </p>

      <div className="mt-5 space-y-5">
        <FormRow label="Bo'lim" error={errors.departmentCode}>
          <div className="flex flex-wrap gap-2">
            {availableDepartments.map((d) => (
              <Chip
                key={d}
                active={d === departmentCode}
                onClick={() => setDepartmentCode(d)}
              >
                {DEPARTMENT_LABEL_UZ[d]}
              </Chip>
            ))}
          </div>
        </FormRow>

        <FormRow label="To'liq ism sharifi" error={errors.fullName}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Aziz Karimov"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </FormRow>

        <FormRow label="Telefon raqami" error={errors.phoneE164}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998901234567"
            inputMode="tel"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </FormRow>

        <FormRow
          label="Holatingizni baholang"
          hint={`Kutilayotgan kelish vaqti: ${serverNowFormatted}`}
          error={errors.severity}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SEVERITY_ORDER.map((s) => {
              const active = s === severity;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-200"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {SEVERITY_LABEL_UZ[s]}
                    </span>
                    <span className="font-mono text-xs">
                      {TRIAGE_MINUTES[s]} daq.
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {SEVERITY_DESCRIPTION_UZ[s]}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
            <span className="font-semibold">Taxminiy qabul vaqti:</span>{" "}
            <span className="font-mono">{quote.expectedAtFormatted}</span>{" "}
            <span className="text-blue-700">(saralash {quote.budgetMinutesLabel})</span>
          </div>
        </FormRow>

        <FormRow label="Shikoyat (ixtiyoriy)">
          <textarea
            rows={3}
            value={symptomNote}
            onChange={(e) => setSymptomNote(e.target.value)}
            maxLength={500}
            placeholder="Asosiy shikoyatingizni qisqacha yozing"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </FormRow>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
          />
          <span>
            Shaxsiy ma'lumotlarimni qayta ishlashga roziman. Ma'lumotlarim
            faqat tibbiy xizmat ko'rsatish maqsadida saqlanadi.
          </span>
        </label>
        {errors.consent && (
          <div className="text-xs text-red-700">{errors.consent}</div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Navbatni tasdiqlash
          </button>
        </div>
      </div>
    </form>
  );
};

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------

const FormRow = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
    {children}
    {error && <div className="text-xs text-red-700">{error}</div>}
  </div>
);

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    )}
  >
    {children}
  </button>
);

const Stat = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
      {label}
    </div>
    <div
      className={cn(
        "mt-0.5 text-base font-semibold text-slate-900",
        mono && "font-mono tabular-nums",
      )}
    >
      {value}
    </div>
  </div>
);
