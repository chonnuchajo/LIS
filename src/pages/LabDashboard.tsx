import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, ClipboardList, Clock, Download, FlaskConical, Plus } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import StatCard from "@/components/lis/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePetitionList } from "@/hooks/usePetition";
import type { Petition, PetitionStatus } from "@/types/petition.types";
import { toast } from "sonner";

const LAB_STATUSES: PetitionStatus[] = ["sampleSent", "pendingReview", "inProgress"];
const LAB_BATCH_LAST_DIGITS = new Set(["1", "6"]);

const isLabBatchNo = (batchNo?: string | null) => {
  const trimmed = String(batchNo ?? "").trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
};

const hasLabItem = (petition: Petition) =>
  petition.items.some((item) => isLabBatchNo(item.batchNo));

const onlyLabPetitions = (petitions: Petition[]) => petitions.filter(hasLabItem);

const formatDate = (value: string) => new Date(value).toLocaleDateString("th-TH");
const formatTime = (value: string) => new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function LabDashboard() {
  const navigate = useNavigate();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const labPetitions = onlyLabPetitions(allPetitions.filter((petition) => LAB_STATUSES.includes(petition.status)));
  const completedPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "success"),
  );
  const waitingReceivePetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "sampleSent"),
  );
  const inProgressPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "pendingReview" || petition.status === "inProgress"),
  );
  const labTotal = labPetitions.length + completedPetitions.length;
  const formattedDate = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  return (
    <AppLayout>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6" />
              Lab Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              งานรับตัวอย่าง ตรวจกายภาพ วิเคราะห์ และส่งผลให้ QC ประจำวันที่ {formattedDate}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => toast.success("กำลังส่งออกรายงาน Lab...")}>
              <Download className="w-4 h-4" /> ส่งออกรายงาน
            </Button>
            <Button className="gap-2" onClick={() => navigate("/petitions/new")}>
              <Plus className="w-4 h-4" /> สร้างคำร้องใหม่
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={ClipboardList} value={labTotal} label="งานทั้งหมดใน Lab" variant="blue" />
          <StatCard icon={AlertTriangle} value={waitingReceivePetitions.length} label="รอรับเข้าระบบ" variant="red" />
          <StatCard icon={Clock} value={inProgressPetitions.length} label="กำลังดำเนินการ" variant="amber" />
          <StatCard icon={CheckCircle} value={completedPetitions.length} label="ตรวจเสร็จแล้ว" variant="green" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 mb-6">
          <PetitionDashboardTable
            title="คำร้องสำหรับ Lab"
            petitions={labPetitions}
            loading={petitionLoading}
            emptyText="ยังไม่มีคำร้องที่รอ Lab ดำเนินการ"
            actionLabel="ดำเนินการ"
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ตัวอย่างรอรับเข้าระบบ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {waitingReceivePetitions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีตัวอย่างที่รอรับเข้าระบบ</p>
              ) : (
                waitingReceivePetitions.slice(0, 8).map((petition) => (
                  <div key={petition._id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{petition.petitionNo}</p>
                        <p className="truncate text-sm text-foreground">
                          {petition.items.map((item) => item.sampleName).filter(Boolean).join(", ") || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {petition.submittedBy?.name ?? '-'} · {formatDate(petition.updatedAt)} {formatTime(petition.updatedAt)}
                        </p>
                      </div>
                      <Badge variant="primary-soft">รอรับ</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <PetitionDashboardTable
          title="คำร้องที่ตรวจเสร็จแล้ว"
          petitions={completedPetitions}
          loading={petitionLoading}
          emptyText="ยังไม่มีคำร้องที่ตรวจเสร็จแล้ว"
          actionLabel="ดูรายละเอียด"
        />
    </AppLayout>
  );
}
