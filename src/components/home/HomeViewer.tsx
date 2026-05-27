import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Eye,
  Hourglass,
} from "lucide-react";
import HomeHeader from "@/components/home/HomeHeader";
import StatCard from "@/components/lis/StatCard";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePetitionList } from "@/hooks/usePetition";

const IN_PROGRESS_SET = new Set(["deliveringQC", "sampleSent", "pendingReview", "inProgress"]);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function HomeViewer() {
  const navigate = useNavigate();
  const { data: petitionData, loading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];

  const today = todayStr();
  const todayPetitions = allPetitions.filter((p) => (p.createdAt ?? "").startsWith(today));
  const inProgress = allPetitions.filter((p) => IN_PROGRESS_SET.has(p.status));
  const completed = allPetitions.filter((p) => p.status === "success");

  const recent = useMemo(
    () => [...allPetitions].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 20),
    [allPetitions],
  );

  const byStatus = {
    deliveringQC: allPetitions.filter((p) => p.status === "deliveringQC").length,
    sampleSent: allPetitions.filter((p) => p.status === "sampleSent").length,
    pendingReview: allPetitions.filter((p) => p.status === "pendingReview").length,
    inProgress: allPetitions.filter((p) => p.status === "inProgress").length,
    success: completed.length,
  };

  return (
    <>
      <HomeHeader title="ติดตามคำขอ" subtitle="ดูสถานะคำขอทั้งหมดในระบบ" icon={Eye} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ClipboardList}
          value={allPetitions.length}
          label="คำขอทั้งหมด"
          variant="neutral"
          onClick={() => navigate("/petitions")}
        />
        <StatCard
          icon={Hourglass}
          value={todayPetitions.length}
          label="คำขอวันนี้"
          variant="blue"
          onClick={() => navigate("/petitions")}
        />
        <StatCard
          icon={Activity}
          value={inProgress.length}
          label="กำลังดำเนินการ"
          variant="amber"
          onClick={() => navigate("/petitions")}
        />
        <StatCard
          icon={CheckCircle2}
          value={completed.length}
          label="เสร็จสิ้น"
          variant="green"
          onClick={() => navigate("/petitions")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 mb-4">
        <PetitionDashboardTable
          title="คำขอล่าสุด"
          petitions={recent}
          loading={loading}
          emptyText="ยังไม่มีคำขอในระบบ"
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สรุปตามสถานะ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusRow label="กำลังส่งตัวอย่าง" count={byStatus.deliveringQC} tone="text-muted-foreground" />
            <StatusRow label="ส่งตัวอย่างแล้ว" count={byStatus.sampleSent} tone="text-blue-600" />
            <StatusRow label="รับตัวอย่างแล้ว" count={byStatus.pendingReview} tone="text-amber-600" />
            <StatusRow label="QC กำลังตรวจ" count={byStatus.inProgress} tone="text-blue-600" />
            <StatusRow label="เสร็จสิ้น" count={byStatus.success} tone="text-green-600" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusRow({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className={tone}>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </div>
  );
}
