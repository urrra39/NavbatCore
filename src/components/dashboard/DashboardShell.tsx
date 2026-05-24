"use client";

/**
 * DashboardShell — top-level role-routing container.
 *
 * Owns the active dashboard role state and renders the matching view.
 * In production the role is supplied from the authenticated session;
 * the boilerplate's RoleSwitcher exposes all four personas so reviewers
 * can walk through the entire RBAC matrix without a login.
 */

import { useState } from "react";

import { ClinicAdminView } from "@/components/dashboard/views/ClinicAdminView";
import { DoctorView } from "@/components/dashboard/views/DoctorView";
import { ReceptionistView } from "@/components/dashboard/views/ReceptionistView";
import { SuperAdminView } from "@/components/dashboard/views/SuperAdminView";
import {
  DashboardRole,
  ROLE_DESCRIPTION_UZ,
  RoleSwitcher,
} from "@/components/dashboard/RoleSwitcher";
import type { DashboardTicket } from "@/lib/triage";

interface Props {
  tickets: ReadonlyArray<DashboardTicket>;
  generatedAtFormatted: string;
  initialRole?: DashboardRole;
}

export const DashboardShell = ({
  tickets,
  generatedAtFormatted,
  initialRole = DashboardRole.RECEPTIONIST,
}: Props) => {
  const [role, setRole] = useState<DashboardRole>(initialRole);

  return (
    <div className="space-y-6">
      <RoleSwitcher active={role} onChange={setRole} />

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs text-blue-900">
        <span className="font-semibold">{ROLE_DESCRIPTION_UZ[role]}</span>
      </div>

      {role === DashboardRole.SUPER_ADMIN && (
        <SuperAdminView generatedAtFormatted={generatedAtFormatted} />
      )}
      {role === DashboardRole.CLINIC_ADMIN && (
        <ClinicAdminView
          tickets={tickets}
          generatedAtFormatted={generatedAtFormatted}
        />
      )}
      {role === DashboardRole.RECEPTIONIST && (
        <ReceptionistView
          initialTickets={tickets}
          generatedAtFormatted={generatedAtFormatted}
        />
      )}
      {role === DashboardRole.DOCTOR && (
        <DoctorView
          tickets={tickets}
          generatedAtFormatted={generatedAtFormatted}
        />
      )}
    </div>
  );
};
