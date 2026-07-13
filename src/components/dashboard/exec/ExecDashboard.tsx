import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useExecSummary } from "@/hooks/useExecSummary";
import type { ExecPeriod, ExecWorkUnit } from "@/lib/execSummary";
import AlertStrip from "./AlertStrip";
import ActionQueue from "./ActionQueue";
import BottleneckBars from "./BottleneckBars";

const PERIODS: ExecPeriod[] = [7, 30, 90];

const idsWhere = (units: ExecWorkUnit[], match: (u: ExecWorkUnit) => boolean) =>
  Array.from(new Set(units.filter(match).map((u) => u.petitionId)));

export default function ExecDashboard() {
  const { data, isLoading, isError, period, setPeriod } = useExecSummary();

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
            overdueIds={idsWhere(queue, (u) => u.state === "overdue")}
            atRiskIds={idsWhere(queue, (u) => u.state === "atRisk")}
            unassignedIds={idsWhere(queue, (u) => u.state === "unassigned")}
            waitingHeadIds={idsWhere(queue, (u) => u.stage === "waitingLabApprove" || u.stage === "waitingFinal")}
            urgentIds={idsWhere(queue, (u) => u.priority === 1)}
          />
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
            <ActionQueue units={queue} />
            <BottleneckBars rows={data.live.bottleneck} />
          </div>
        </>
      )}
    </>
  );
}
