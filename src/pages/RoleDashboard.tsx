import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/lis/AppLayout";
import DashboardHeader, { type DashRange } from "@/components/dashboard/DashboardHeader";
import KpiRow from "@/components/dashboard/KpiRow";
import DailyCheckProgressCard from "@/components/dashboard/DailyCheckProgressCard";
import ActionTable from "@/components/dashboard/ActionTable";
import WorkflowSummary from "@/components/dashboard/WorkflowSummary";
import AnalyticsSection from "@/components/dashboard/AnalyticsSection";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import ConfigCoveragePies from "@/components/dashboard/ConfigCoveragePies";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles } from "@/lib/roles";
import {
  resolveProfileForRole,
  resolveDashboardRole,
  DASHBOARD_PROFILES,
  labDataConfigCoveragePlacement,
  type KpiId,
} from "@/lib/dashboardProfiles";
import {
  buildQcStaffWorklist,
  buildLabWorklist,
  isAssignedToUser,
  labWorklistCounts,
  paginateLabWorklist,
  qcStaffWorklistCounts,
  type LabWorklistFilter,
  type QcStaffWorklistFilter,
} from "@/lib/dashboardMetrics";
import { labTrackStatusBadge, qcTrackStatusBadge } from "@/lib/receiveStatus";
import { useDashboardData } from "@/hooks/useDashboardData";
import { loadAccessControl } from "@/lib/accessControlSource";
import GenericMenuGrid from "@/components/dashboard/GenericMenuGrid";
import { getAccessibleNavItemsForRoles } from "@/lib/accessNav";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  "qc-reviewer": "อนุมัติผล", "qc-head": "อนุมัติ", "qc-staff": "ดำเนินการ",
  "lab-analyze": "บันทึกผล", "lab-head": "อนุมัติ", "lab-config": "ดูรายละเอียด",
  "lab-inventory": "จัดการ", admin: "ดูรายละเอียด", viewer: "ดูรายละเอียด",
};

const API_BASE = import.meta.env.BASE_URL + "api";

const QC_STAFF_TABLE_TITLE: Record<QcStaffWorklistFilter, string> = {
  waitingReceive: "งานรอรับ",
  inProgress: "กำลังดำเนินการ",
  waitingReview: "รอตรวจ",
  approvedToday: "เสร็จวันนี้",
};

const QC_STAFF_FILTERS: readonly QcStaffWorklistFilter[] = [
  "waitingReceive",
  "inProgress",
  "waitingReview",
  "approvedToday",
];

function isQcStaffFilter(id: KpiId): id is QcStaffWorklistFilter {
  return QC_STAFF_FILTERS.includes(id as QcStaffWorklistFilter);
}

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
  const [range, setRange] = useState<DashRange>("today");
  const [labFilter, setLabFilter] = useState<LabWorklistFilter>("inProgress");
  const [labPage, setLabPage] = useState(1);
  const [qcStaffFilter, setQcStaffFilter] = useState<QcStaffWorklistFilter>("inProgress");
  const [qcStaffPage, setQcStaffPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: access } = useQuery({ queryKey: ["access-control"], queryFn: () => loadAccessControl() });
  const roleObjs = access?.roles ?? [];
  const navItems = useMemo(() => getAccessibleNavItemsForRoles(roles, access), [roles, access]);

  // resolveProfileForRole returns null for a custom/unknown role with no real
  // profile match (explicit `viewer` role still resolves to "viewer" via the
  // default map). Hooks below must stay unconditional, so we feed
  // useDashboardData a harmless placeholder profile in the no-match case and
  // branch only on what gets rendered.
  const profileId = resolveProfileForRole(resolveDashboardRole(roles), roleObjs);
  const profile = profileId ? DASHBOARD_PROFILES[profileId] : null;
  const { petitions, ctx, refresh } = useDashboardData(profile ?? DASHBOARD_PROFILES.viewer);
  const isLabAnalyze = profileId === "lab-analyze";
  const isQcStaff = profileId === "qc-staff";
  const labConfigCoveragePlacement = labDataConfigCoveragePlacement(roles, profileId);
  const labConfigCoverageSection = labConfigCoveragePlacement === "hidden" ? null : (
    <ConfigCoveragePies
      simpleMethodData={ctx.simpleMethodCoverage}
      standardTimeData={ctx.standardTimeCoverage}
      loading={ctx.configCoverageLoading}
    />
  );
  const qcStaffIdsParam = useMemo(() => petitions.map((p) => p._id).join(","), [petitions]);
  const { data: qcParticipants = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["dash", "qc-testers", qcStaffIdsParam],
    enabled: isQcStaff && qcStaffIdsParam.length > 0,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/qc-results/testers?petitionIds=${encodeURIComponent(qcStaffIdsParam)}`, {
        cache: "no-store",
      });
      if (!res.ok) return {};
      return (await res.json()) as Record<string, string[]>;
    },
  });
  const labRows = useMemo(
    () => buildLabWorklist(petitions, labFilter, user, ctx.now),
    [petitions, labFilter, user, ctx.now],
  );
  const labAssignedPetitions = useMemo(
    () => petitions.filter((p) => isAssignedToUser(p, user)),
    [petitions, user],
  );
  const labAnalyticsCtx = useMemo(
    () => ({ ...ctx, petitions: labAssignedPetitions }),
    [ctx, labAssignedPetitions],
  );
  const labKpiValues = useMemo(() => labWorklistCounts(petitions, user, ctx.now), [petitions, user, ctx.now]);
  const labPageData = useMemo(() => paginateLabWorklist(labRows, labPage), [labRows, labPage]);
  const qcStaffRows = useMemo(
    () => buildQcStaffWorklist(petitions, qcStaffFilter, user, ctx.now, qcParticipants),
    [petitions, qcStaffFilter, user, ctx.now, qcParticipants],
  );
  const qcStaffKpiValues = useMemo(
    () => qcStaffWorklistCounts(petitions, user, ctx.now, qcParticipants),
    [petitions, user, ctx.now, qcParticipants],
  );
  const qcStaffPageData = useMemo(
    () => paginateLabWorklist(qcStaffRows, qcStaffPage),
    [qcStaffRows, qcStaffPage],
  );

  const urgentIds = useMemo(
    () => new Set(petitions.filter((p) => ctx.abnormalFlags[p._id] || ctx.returnedFlags[p._id]).map((p) => p._id)),
    [petitions, ctx.abnormalFlags, ctx.returnedFlags],
  );

  const handleRefresh = () => {
    refresh();
    queryClient.invalidateQueries({ queryKey: ["dash"] });
    queryClient.invalidateQueries({ queryKey: ["dash", "qc-testers"] });
    queryClient.invalidateQueries({ queryKey: ["access-control"] });
  };

  const handleLabKpiClick = (id: KpiId) => {
    if (id !== "assignedToMe" && id !== "inProgress" && id !== "completedToday") return;
    setLabFilter(id);
    setLabPage(1);
  };

  const handleQcStaffKpiClick = (id: KpiId) => {
    if (!isQcStaffFilter(id)) return;
    setQcStaffFilter(id);
    setQcStaffPage(1);
  };

  if (!profileId || !profile) {
    return (
      <AppLayout>
        <GenericMenuGrid />
      </AppLayout>
    );
  }

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
        onRefresh={handleRefresh}
        onExport={handleExport}
        navItems={navItems}
      />
      {labConfigCoveragePlacement === "top" ? labConfigCoverageSection : null}
      <KpiRow
        kpis={profile.kpis}
        ctx={ctx}
        activeKpi={isLabAnalyze ? labFilter : isQcStaff ? qcStaffFilter : undefined}
        onKpiClick={isLabAnalyze ? handleLabKpiClick : isQcStaff ? handleQcStaffKpiClick : undefined}
        valueOverrides={isLabAnalyze ? labKpiValues : isQcStaff ? qcStaffKpiValues : undefined}
        presentation={isLabAnalyze || isQcStaff ? "widgets" : "default"}
        extraCards={isLabAnalyze ? (
          <DailyCheckProgressCard
            done={ctx.dailyCheckDone}
            pending={ctx.dailyCheckPending}
            total={ctx.dailyCheckTotal}
            loading={ctx.dailyCheckLoading}
          />
        ) : undefined}
      />
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
        <ActionTable
          petitions={isLabAnalyze ? labPageData.pageRows : isQcStaff ? qcStaffPageData.pageRows : petitions}
          title={isLabAnalyze ? "งานที่กำลังดำเนินการ" : isQcStaff ? QC_STAFF_TABLE_TITLE[qcStaffFilter] : undefined}
          emptyMessage={isLabAnalyze ? "ไม่มีงานในหมวดนี้" : isQcStaff ? "ไม่มีงานในหมวดนี้" : undefined}
          actionLabel={ACTION_LABEL[profileId] ?? "ดูรายละเอียด"}
          actionPathPrefix={isLabAnalyze ? "/lab-testing" : isQcStaff ? "/qc-testing" : "/petitions"}
          urgentIds={urgentIds}
          sortRows={!isLabAnalyze && !isQcStaff}
          statusBadge={isLabAnalyze ? labTrackStatusBadge : isQcStaff ? qcTrackStatusBadge : undefined}
          footer={isLabAnalyze ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                หน้า {labPageData.page}/{labPageData.totalPages} · {labPageData.total} รายการ
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={labPageData.page <= 1}
                  onClick={() => setLabPage((page) => Math.max(1, page - 1))}
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={labPageData.page >= labPageData.totalPages}
                  onClick={() => setLabPage((page) => Math.min(labPageData.totalPages, page + 1))}
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : isQcStaff ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                หน้า {qcStaffPageData.page}/{qcStaffPageData.totalPages} · {qcStaffPageData.total} รายการ
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={qcStaffPageData.page <= 1}
                  onClick={() => setQcStaffPage((page) => Math.max(1, page - 1))}
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={qcStaffPageData.page >= qcStaffPageData.totalPages}
                  onClick={() => setQcStaffPage((page) => Math.min(qcStaffPageData.totalPages, page + 1))}
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : undefined}
        />
        {isLabAnalyze ? (
          <AnalyticsSection specs={profile.analytics} ctx={labAnalyticsCtx} layout="single" />
        ) : profile.workflow ? (
          <WorkflowSummary kind={profile.workflow} petitions={petitions} />
        ) : <div />}
      </div>
      {!isLabAnalyze ? <AnalyticsSection specs={profile.analytics} ctx={ctx} /> : null}
      {!isLabAnalyze ? <ActivityTimeline kind={profile.activity} /> : null}
      {labConfigCoveragePlacement === "bottom" ? labConfigCoverageSection : null}
    </AppLayout>
  );
}
