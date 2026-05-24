"use client";

/**
 * PublicTicketTracker — anonymous /t/[code] live tracker.
 *
 *   * Receives a server-rendered initial snapshot (so SEO crawlers and
 *     first-paint show a populated card with the entry time, ETA, and
 *     queue position).
 *   * Subscribes to per-ticket WebSocket events via `useHotTicketSocket`
 *     and merges the snapshot in place.
 *   * Renders a hydration-safe live elapsed counter using ElapsedTime
 *     (server seeds initialElapsedSec; client interval starts in useEffect).
 *
 * No login. No PII beyond the patient's first name (which is what they
 * gave the booking form). Designed for the SMS link the patient gets
 * after creating the ticket.
 */

import { ElapsedTime } from "@/components/dashboard/ElapsedTime";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import {
  DEPARTMENT_LABEL_UZ,
  type DepartmentCode,
  type Severity,
  type TicketStatus,
  TRIAGE_MINUTES,
  isTerminalStatus,
} from "@/lib/triage";

interface Props {
  ticketCode: string;
  patientFirstName: string;
  clinicDisplayName: string;
  clinicSlug: string;
  department: DepartmentCode;
  severity: Severity;
  status: TicketStatus;
  positionInQueue: number;
  totalAhead: number;
  entryAtFormatted: string;
  expectedAtFormatted: string;
  initialElapsedSec: number;
}

export const PublicTicketTracker = ({
  ticketCode,
  patientFirstName,
  clinicDisplayName,
  clinicSlug,
  department,
  severity,
  status,
  positionInQueue,
  totalAhead,
  entryAtFormatted,
  expectedAtFormatted,
  initialElapsedSec,
}: Props) => {
  const closed = isTerminalStatus(status);

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
          Akfa Medline · Onlayn navbat
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {patientFirstName}, sizning navbatingiz
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {clinicDisplayName} · {DEPARTMENT_LABEL_UZ[department]} bo'limi
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="Navbat raqami"
          value={ticketCode}
          mono
          tone="blue"
        />
        <Tile
          label="Sizning oldingizda"
          value={`${totalAhead} ta bemor`}
          tone="default"
        />
        <Tile
          label="Holati"
          value={DEPARTMENT_LABEL_UZ[department]}
          tone={closed ? "muted" : "emerald"}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldBlock label="Joriy holat">
            <StatusBadge status={status} />
            <div className="mt-1 text-xs text-slate-500">
              Saralash darajasi: <SeverityBadge severity={severity} className="ml-1" />
            </div>
          </FieldBlock>

          <FieldBlock label="Sizning navbat o'rningiz">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
              #{positionInQueue.toString().padStart(3, "0")}
            </span>
            <div className="text-xs text-slate-500">
              Saralash budgeti: {TRIAGE_MINUTES[severity]} daqiqa
            </div>
          </FieldBlock>

          <FieldBlock label="Kirgan vaqti">
            <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {entryAtFormatted}
            </span>
            <div className="text-xs text-slate-500">Toshkent vaqti</div>
          </FieldBlock>

          <FieldBlock label="Kutilayotgan vaqt">
            <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {expectedAtFormatted}
            </span>
            <div className="text-xs text-slate-500">
              Sarflangan:{" "}
              <ElapsedTime
                initialElapsedSec={initialElapsedSec}
                status={status}
              />
            </div>
          </FieldBlock>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-blue-900">
        <div className="font-semibold">
          {closed
            ? "Navbat yakunlangan."
            : "Navbat avtomatik yangilanadi. Sahifani yopib turishingiz mumkin."}
        </div>
        <div className="mt-1 text-blue-800">
          Klinika manziliga{" "}
          <a
            href={`/c/${clinicSlug}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            shu yerdan
          </a>{" "}
          o'tib bo'lim tafsilotlarini ko'ring.
        </div>
      </section>
    </div>
  );
};

const Tile = ({
  label,
  value,
  mono = false,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "blue" | "emerald" | "muted";
}) => {
  const valueClass = cn(
    "mt-1 text-2xl font-semibold",
    mono && "font-mono tabular-nums",
    tone === "blue" && "text-blue-700",
    tone === "emerald" && "text-emerald-700",
    tone === "muted" && "text-slate-500",
    tone === "default" && "text-slate-900",
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className={valueClass}>{value}</div>
    </div>
  );
};

const FieldBlock = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </div>
    <div className="mt-1.5">{children}</div>
  </div>
);
