"use client";

/**
 * ReceptionistActions — operational toolbar for the qabulchi panel.
 *
 * Four explicit actions per spec:
 *   * Chaqirish              — KUTMOQDA -> TASDIQLANGAN (next in line)
 *   * Qabulni boshlash       — TASDIQLANGAN -> QABULDA (selected)
 *   * Tugatish               — QABULDA -> TUGATILDI (selected)
 *   * Favqulodda bemor qo'shish — emergency-buffer interceptor
 *
 * In production every button calls a server action that:
 *   1. Opens a Prisma transaction with `SELECT ... FOR UPDATE SKIP LOCKED`
 *      on the affected ticket(s).
 *   2. Validates the transition via `assertTransition` from
 *      `@/schemas/ticket`.
 *   3. Writes a signed AuditLog entry (HMAC chain via `@/lib/audit`).
 *   4. Publishes a `RealtimeTicketEvent` to Redis Pub/Sub which the
 *      gateway fans out over WebSockets.
 *
 * The boilerplate keeps the actions client-only and mutates the in-memory
 * dataset so reviewers can exercise the UX without standing up Postgres.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import { SEVERITY_LABEL_UZ, Severity, TicketStatus } from "@/lib/triage";

export interface EmergencyDraft {
  fullName: string;
  severity: Severity;
  symptomNote: string;
}

export interface Props {
  /** Disable the row-scoped actions when nothing is selected. */
  hasSelection: boolean;
  /** Status of the selected ticket — drives which buttons are enabled. */
  selectedStatus: TicketStatus | null;
  onCallNext: () => void;
  onStartConsult: () => void;
  onComplete: () => void;
  onEmergencyInsert: (draft: EmergencyDraft) => void;
}

export const ReceptionistActions = ({
  hasSelection,
  selectedStatus,
  onCallNext,
  onStartConsult,
  onComplete,
  onEmergencyInsert,
}: Props) => {
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const canStart =
    hasSelection && selectedStatus === TicketStatus.TASDIQLANGAN;
  const canComplete = hasSelection && selectedStatus === TicketStatus.QABULDA;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Qabul stoli amallari
          </div>
          <div className="text-sm text-slate-700">
            {hasSelection
              ? "Tanlangan bemor uchun amal tanlang yoki yangi bemor qo'shing."
              : "Jadvaldan bemor tanlang yoki yangi bemorni qo'shing."}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton onClick={onCallNext} tone="primary">
            Chaqirish
          </ActionButton>
          <ActionButton onClick={onStartConsult} tone="solid" disabled={!canStart}>
            Qabulni boshlash
          </ActionButton>
          <ActionButton onClick={onComplete} tone="success" disabled={!canComplete}>
            Tugatish
          </ActionButton>
          <ActionButton
            onClick={() => setEmergencyOpen(true)}
            tone="emergency"
          >
            Favqulodda bemor qo'shish
          </ActionButton>
        </div>
      </div>

      {emergencyOpen && (
        <EmergencyDialog
          onClose={() => setEmergencyOpen(false)}
          onSubmit={(draft) => {
            onEmergencyInsert(draft);
            setEmergencyOpen(false);
          }}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------------------

const TONE: Record<
  "primary" | "solid" | "success" | "emergency",
  string
> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm",
  solid:
    "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 shadow-sm",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 shadow-sm",
  emergency:
    "bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-100 shadow-sm",
};

const ActionButton = ({
  onClick,
  tone,
  disabled,
  children,
}: {
  onClick: () => void;
  tone: keyof typeof TONE;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed",
      TONE[tone],
    )}
  >
    {children}
  </button>
);

// -----------------------------------------------------------------------------
// Emergency dialog
// -----------------------------------------------------------------------------

const EmergencyDialog = ({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (d: EmergencyDraft) => void;
}) => {
  const [fullName, setFullName] = useState("");
  const [severity, setSeverity] = useState<Severity>(Severity.OGIR);
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return;
    onSubmit({ fullName: fullName.trim(), severity, symptomNote: note.trim() });
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Favqulodda bemor qo'shish"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">
            Saralash interceptori
          </div>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-900">
            Favqulodda bemor qo'shish
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Bemor navbatning boshiga qo'yiladi va barcha kutayotganlarning
            ETA qiymati avtomatik qayta hisoblanadi.
          </p>
        </header>

        <form className="space-y-4 px-5 py-5" onSubmit={submit}>
          <Field label="Bemorning to'liq ismi sharifi">
            <input
              required
              minLength={2}
              maxLength={80}
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Masalan: Aziz Karimov"
            />
          </Field>

          <Field label="Holati (saralash)">
            <div className="flex gap-2">
              {([Severity.YENGIL, Severity.ORTA, Severity.OGIR] as const).map(
                (s) => {
                  const isActive = s === severity;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold",
                        isActive
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {SEVERITY_LABEL_UZ[s]}
                    </button>
                  );
                },
              )}
            </div>
          </Field>

          <Field label="Shikoyat (ixtiyoriy)">
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Bemorning asosiy shikoyatini qisqacha yozing"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              Navbatga qo'shish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5 text-sm">
    <span className="text-xs font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);
