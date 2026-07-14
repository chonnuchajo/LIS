import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LabInventorySummaryCard from "@/components/dashboard/LabInventorySummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useExecSummary } from "@/hooks/useExecSummary";
import { DASHBOARD_PROFILES } from "@/lib/dashboardProfiles";
import type { ExecPeriod } from "@/lib/execSummary";
import AlertStrip from "./AlertStrip";
import ActionQueue from "./ActionQueue";
import BottleneckBars from "./BottleneckBars";
import TurnaroundChart from "./TurnaroundChart";
import ThroughputChart from "./ThroughputChart";
import QualityPanel from "./QualityPanel";
import TeamWorkloadPanel from "./TeamWorkloadPanel";

const PERIODS: ExecPeriod[] = [1, 7, 30];

export default function ExecDashboard() {
  const { data, isLoading, isError, period, setPeriod } = useExecSummary();
  const { ctx } = useDashboardData(DASHBOARD_PROFILES["lab-inventory"]);

  if (isError) {
    return (
      <>
        <DashboardHeader titleEn="Executive Dashboard" subtitleTh="ภาพรวม Lab + QC" />
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          โหลดข้อมูลไม่สำเร็จ · ลองรีเฟรชหน้าอีกครั้ง
        </CardContent></Card>
      </>
    );
  }

  const queue = data?.live.actionQueue ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardHeader titleEn="Executive Dashboard" subtitleTh="ภาพรวม Lab + QC" />
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === period ? "default" : "outline"}
              onClick={() => setPeriod(p)}
            >
              {p} วัน
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          กำลังโหลด…
        </CardContent></Card>
      ) : (
        <>
          <AlertStrip
            counts={data.live.counts}
            totalIds={data.live.ids.total}
            overdueIds={data.live.ids.overdue}
            unassignedIds={data.live.ids.unassigned}
            waitingHeadIds={data.live.ids.waitingHead}
            urgentIds={data.live.ids.urgent}
            abnormalIds={data.live.ids.abnormal}
          />
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
            <ActionQueue units={queue} />
            <BottleneckBars rows={data.live.bottleneck} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TurnaroundChart rows={data.stats.turnaround} />
            <ThroughputChart rows={data.stats.throughput} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <QualityPanel quality={data.stats.quality} />
            <TeamWorkloadPanel workload={data.stats.workload} />
          </div>
          <LabInventorySummaryCard
            summary={ctx.labInventorySummary}
            loading={ctx.labInventoryLoading}
          />
        </>
      )}
    </>
  );
}
