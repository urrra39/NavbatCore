"use client";

/**
 * RoleSwitcher — top tab strip selecting the active dashboard role.
 *
 * In a real deployment, the role is read from the authenticated session
 * (e.g. NextAuth `session.user.role`). The boilerplate exposes a manual
 * switcher so reviewers can walk through every persona without a login
 * flow. The persona enum and labels live in this file.
 */

import { cn } from "@/lib/cn";

export const DashboardRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CLINIC_ADMIN: "CLINIC_ADMIN",
  RECEPTIONIST: "RECEPTIONIST",
  DOCTOR: "DOCTOR",
} as const;
export type DashboardRole = (typeof DashboardRole)[keyof typeof DashboardRole];

export const ROLE_LABEL_UZ: Record<DashboardRole, string> = {
  SUPER_ADMIN: "Bosh administrator",
  CLINIC_ADMIN: "Klinika administratori",
  RECEPTIONIST: "Qabulchi",
  DOCTOR: "Shifokor",
};

export const ROLE_DESCRIPTION_UZ: Record<DashboardRole, string> = {
  SUPER_ADMIN: "Tarmoq bo'yicha global ko'rsatkichlar va auditing",
  CLINIC_ADMIN: "Filial darajasidagi monitoring va SLA hisobotlar",
  RECEPTIONIST: "Qabul stoli — bemorlar bilan jonli ishlash",
  DOCTOR: "Shaxsiy navbat va konsultatsiya SLA hisoblagichi",
};

const ROLE_ORDER: ReadonlyArray<DashboardRole> = [
  DashboardRole.SUPER_ADMIN,
  DashboardRole.CLINIC_ADMIN,
  DashboardRole.RECEPTIONIST,
  DashboardRole.DOCTOR,
];

interface Props {
  active: DashboardRole;
  onChange: (role: DashboardRole) => void;
}

export const RoleSwitcher = ({ active, onChange }: Props) => (
  <nav
    aria-label="Foydalanuvchi rollari"
    className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4"
  >
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
      >
        <span className="text-xs font-semibold">RBAC</span>
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Foydalanuvchi roli
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {ROLE_LABEL_UZ[active]}
        </div>
      </div>
    </div>

    <div className="flex flex-1 flex-wrap items-center gap-1 sm:justify-end">
      {ROLE_ORDER.map((role) => {
        const isActive = role === active;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            aria-pressed={isActive}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
              isActive
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {ROLE_LABEL_UZ[role]}
          </button>
        );
      })}
    </div>
  </nav>
);
