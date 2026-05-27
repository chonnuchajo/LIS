import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Package,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import HomeHeader from "@/components/home/HomeHeader";
import StatCard from "@/components/lis/StatCard";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import { useCanAccessPath } from "@/hooks/useCanAccessPath";

const EXPECTED_SCALES = 5;
const EXPIRY_WARN_DAYS = 180;
const SOLVENT_LOW_QTY = 3;

const isExpiringSoon = (exp?: string) => {
  if (!exp) return false;
  const d = new Date(exp);
  if (Number.isNaN(d.getTime())) return false;
  const diffDays = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays <= EXPIRY_WARN_DAYS;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function HomeAdmin() {
  const navigate = useNavigate();
  const canAccess = useCanAccessPath();
  const { data: petitionData, loading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const { doneSamples, approvals } = useSamples();

  const access = {
    petitionsList: canAccess("/petitions"),
    approval: canAccess("/qc-approval"),
    dailyCheck: canAccess("/daily-check"),
    accessControl: canAccess("/access-control"),
    stock: canAccess("/stock"),
    report: canAccess("/report"),
  };

  const today = todayStr();
  const incomingToday = allPetitions.filter((p) => {
    const created = p.createdAt?.slice(0, 10);
    return created === today;
  });
  const pendingQc = doneSamples.filter(
    (s) => !approvals[s.id]?.qcStatus || approvals[s.id]?.qcStatus === "pending",
  );

  const { data: dailySummary } = useQuery({
    queryKey: ["home", "daily-summary"],
    queryFn: api.getDailyCheckTodaySummary,
  });
  const dailyDone = dailySummary?.scaleIds?.length ?? 0;
  const dailyPending = Math.max(0, EXPECTED_SCALES - dailyDone);
  const dailyAllPass = dailySummary?.allPass ?? true;

  const { data: standards } = useQuery({
    queryKey: ["home", "standards"],
    queryFn: api.getStandards,
  });
  const { data: solvents } = useQuery({
    queryKey: ["home", "solvents"],
    queryFn: api.getSolvents,
  });

  const expiringStandards = useMemo(
    () => (standards ?? []).filter((s) => isExpiringSoon(s.working?.exp) || isExpiringSoon(s.supplier?.exp)),
    [standards],
  );
  const lowSolvents = useMemo(
    () => (solvents ?? []).filter((s) => (s.qty ?? 0) < SOLVENT_LOW_QTY),
    [solvents],
  );

  const newPetitions = allPetitions.filter((p) => p.status === "deliveringQC" || p.status === "sampleSent");

  return (
    <>
      <HomeHeader
        title="ภาพรวมระบบ"
        subtitle="ข้อมูลสำหรับผู้ดูแล"
        icon={ShieldCheck}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ClipboardList}
          value={incomingToday.length}
          label="คำขอเข้าวันนี้"
          variant="blue"
          sublabel={`ทั้งหมด ${allPetitions.length} รายการ`}
          onClick={access.petitionsList ? () => navigate("/petitions") : undefined}
        />
        <StatCard
          icon={Hourglass}
          value={pendingQc.length}
          label="รอ QC อนุมัติ"
          variant="amber"
          onClick={access.approval ? () => navigate("/qc-approval") : undefined}
        />
        <StatCard
          icon={Scale}
          value={dailyPending}
          label="Daily check ค้าง"
          variant={!dailyAllPass ? "red" : dailyPending > 0 ? "amber" : "green"}
          sublabel={`${dailyDone}/${EXPECTED_SCALES} เครื่อง · ${dailyAllPass ? "ผ่านทั้งหมด" : "พบรายการ fail"}`}
          onClick={access.dailyCheck ? () => navigate("/daily-check") : undefined}
        />
        <StatCard
          icon={Users}
          value="—"
          label="ผู้ใช้ระบบ"
          variant="neutral"
          sublabel="ดู Access Control"
          onClick={access.accessControl ? () => navigate("/access-control") : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 mb-4">
        <PetitionDashboardTable
          title="คำขอใหม่ (ทุกแผนก)"
          petitions={newPetitions}
          loading={loading}
          emptyText="ยังไม่มีคำขอใหม่"
        />

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                แจ้งเตือนระบบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!dailyAllPass && dailySummary && access.dailyCheck ? (
                <button
                  type="button"
                  onClick={() => navigate("/daily-check")}
                  className="flex w-full items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left hover:bg-red-100"
                >
                  <Scale className="mt-0.5 h-4 w-4 text-red-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-700">เครื่องชั่ง calibrate ไม่ผ่าน</p>
                    <p className="text-xs text-red-600/80">ตรวจสอบ Daily Check ด่วน</p>
                  </div>
                </button>
              ) : null}

              {access.stock && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/stock")}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40"
                  >
                    <Package className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Standard ใกล้หมดอายุ</p>
                      <p className="text-xs text-muted-foreground">
                        {expiringStandards.length} รายการ · ภายใน {EXPIRY_WARN_DAYS} วัน
                      </p>
                    </div>
                    {expiringStandards.length > 0 ? (
                      <Badge variant="yellow-soft" className="shrink-0">{expiringStandards.length}</Badge>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/stock")}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40"
                  >
                    <Package className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Solvent ใกล้หมด</p>
                      <p className="text-xs text-muted-foreground">
                        {lowSolvents.length} รายการ · เหลือน้อยกว่า {SOLVENT_LOW_QTY} ขวด
                      </p>
                    </div>
                    {lowSolvents.length > 0 ? (
                      <Badge variant="primary-soft" className="shrink-0">{lowSolvents.length}</Badge>
                    ) : null}
                  </button>
                </>
              )}

              {dailyAllPass && expiringStandards.length === 0 && lowSolvents.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> ไม่มีรายการต้องดำเนินการ
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                สรุปสถานะคำขอ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <StatusRow label="กำลังส่งตัวอย่าง" count={allPetitions.filter((p) => p.status === "deliveringQC").length} />
              <StatusRow label="ส่งตัวอย่างแล้ว" count={allPetitions.filter((p) => p.status === "sampleSent").length} />
              <StatusRow label="รับตัวอย่างแล้ว" count={allPetitions.filter((p) => p.status === "pendingReview").length} />
              <StatusRow label="กำลังตรวจ" count={allPetitions.filter((p) => p.status === "inProgress").length} />
              <StatusRow label="เสร็จสิ้น" count={allPetitions.filter((p) => p.status === "success").length} />
              {access.report && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => navigate("/report")}
                >
                  <CalendarClock className="mr-2 h-3.5 w-3.5" />
                  ดูรายงานสรุปทั้งหมด
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </div>
  );
}
