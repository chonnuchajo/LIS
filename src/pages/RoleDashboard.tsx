import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/lis/AppLayout";
import DashboardHeader, { type DashRange } from "@/components/dashboard/DashboardHeader";
import KpiRow from "@/components/dashboard/KpiRow";
import ActionTable from "@/components/dashboard/ActionTable";
import WorkflowSummary from "@/components/dashboard/WorkflowSummary";
import AnalyticsSection from "@/components/dashboard/AnalyticsSection";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import { useAuth } from "@/context/AuthContext";
import { useActiveRole } from "@/store/activeRole";
import { normalizeRoles } from "@/lib/roles";
import { resolveProfileForRole, DASHBOARD_PROFILES } from "@/lib/dashboardProfiles";
import { useDashboardData } from "@/hooks/useDashboardData";
import { loadAccessControl } from "@/lib/accessControlSource";

const ACTION_LABEL: Record<string, string> = {
  "qc-reviewer": "อนุมัติผล", "qc-head": "อนุมัติ", "qc-staff": "ดำเนินการ",
  "lab-analyze": "บันทึกผล", "lab-head": "อนุมัติ", "lab-config": "ดูรายละเอียด",
  "lab-inventory": "จัดการ", admin: "ดูรายละเอียด", viewer: "ดูรายละเอียด",
};

// Guards against CSV formula injection (Excel/Sheets execute cells starting with
// = + - @ or a leading tab/CR as formulas) and quotes/escapes so commas or
// embedded quotes in field values can't misalign the row.
function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const dangerous = /^[=+\-@\t\r]/.test(raw);
  const neutralized = dangerous ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const { activeRole } = useActiveRole(roles);
  const [range, setRange] = useState<DashRange>("today");

  const { data: access } = useQuery({ queryKey: ["access-control"], queryFn: () => loadAccessControl() });
  const roleObjs = access?.roles ?? [];
  const roleNames = useMemo(
    () => Object.fromEntries(roleObjs.map((r: { id: string; name: string }) => [r.id, r.name])),
    [roleObjs],
  );

  const profileId = resolveProfileForRole(activeRole, roleObjs);
  const profile = DASHBOARD_PROFILES[profileId];
  const { petitions, ctx, refresh } = useDashboardData(profile);

  const urgentIds = useMemo(
    () => new Set(petitions.filter((p) => ctx.abnormalFlags[p._id] || ctx.returnedFlags[p._id]).map((p) => p._id)),
    [petitions, ctx.abnormalFlags, ctx.returnedFlags],
  );

  const handleExport = () => {
    const header = ["คำร้อง", "ผู้ขอ", "ตัวอย่าง", "สถานะ"];
    const lines = petitions.map((p) =>
      [p.petitionNo, p.submittedBy?.name ?? "", p.items.length, p.status].map(csvCell).join(","),
    );
    const blob = new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dashboard-${profileId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <DashboardHeader
        titleEn={profile.titleEn}
        subtitleTh={profile.subtitleTh}
        range={range}
        onRangeChange={setRange}
        onRefresh={refresh}
        onExport={handleExport}
        roleNames={roleNames}
      />
      <KpiRow kpis={profile.kpis} ctx={ctx} />
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
        <ActionTable
          petitions={petitions}
          actionLabel={ACTION_LABEL[profileId] ?? "ดูรายละเอียด"}
          actionPathPrefix="/petitions"
          urgentIds={urgentIds}
        />
        {profile.workflow ? <WorkflowSummary kind={profile.workflow} petitions={petitions} /> : <div />}
      </div>
      <AnalyticsSection specs={profile.analytics} ctx={ctx} />
      <ActivityTimeline kind={profile.activity} />
    </AppLayout>
  );
}
