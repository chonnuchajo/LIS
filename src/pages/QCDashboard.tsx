import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Download, FileCheck2, ShieldCheck, UserCheck } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import StatCard from "@/components/lis/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import type { PetitionStatus } from "@/types/petition.types";
import { toast } from "sonner";

const QC_STATUSES: PetitionStatus[] = ["deliveringQC", "sampleSent", "pendingReview", "inProgress"];

export default function QCDashboard() {
  const navigate = useNavigate();
  const { doneSamples, approvals } = useSamples();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const qcPetitions = allPetitions.filter((petition) => QC_STATUSES.includes(petition.status));
  const completedPetitions = allPetitions.filter((petition) => petition.status === "normal" || petition.status === "defective");
  const rejectedQcCount = doneSamples.filter((sample) => approvals[sample.id]?.qcStatus === "rejected").length;
  const approvedQcCount = doneSamples.filter((sample) => approvals[sample.id]?.qcStatus === "approved").length;
  const pendingQcSamples = doneSamples.filter((sample) => !approvals[sample.id]?.qcStatus || approvals[sample.id]?.qcStatus === "pending");
  const formattedDate = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              QC Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              งานตรวจคำร้อง ติดตามสถานะ และอนุมัติผล QC ประจำวันที่ {formattedDate}
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast.success("กำลังส่งออกรายงาน QC...")}>
            <Download className="w-4 h-4" /> ส่งออกรายงาน
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={UserCheck} value={qcPetitions.length} label="คำร้องที่ QC ต้องติดตาม" variant="blue" />
          <StatCard icon={FileCheck2} value={pendingQcSamples.length} label="รออนุมัติผล QC" variant="amber" />
          <StatCard icon={CheckCircle} value={approvedQcCount} label="ผ่าน QC" variant="green" />
          <StatCard icon={AlertTriangle} value={rejectedQcCount} label="ไม่ผ่าน QC" variant="red" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 mb-6">
          <PetitionDashboardTable
            title="คำร้องสำหรับ QC"
            petitions={qcPetitions}
            loading={petitionLoading}
            emptyText="ยังไม่มีคำร้องที่รอ QC ดำเนินการ"
            actionLabel="ตรวจสอบ"
          />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">ผลวิเคราะห์รอ QC</CardTitle>
                <Button size="sm" variant="primary-outline" onClick={() => navigate("/qc-approval")}>
                  ไปหน้าอนุมัติ
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingQcSamples.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีผลวิเคราะห์ที่รอ QC</p>
              ) : (
                pendingQcSamples.slice(0, 8).map((sample) => (
                  <div key={sample.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{sample.id}</p>
                        <p className="truncate text-sm text-foreground">{sample.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sample.receiver || "ไม่ระบุผู้วิเคราะห์"} · {sample.instrument || "ไม่ระบุเครื่องมือ"}
                        </p>
                      </div>
                      <Badge variant="yellow-soft">รอ QC</Badge>
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
      </main>
    </div>
  );
}
