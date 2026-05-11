import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, ClipboardList, Clock, Download, FlaskConical, Plus } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import SampleColumn from "@/components/lis/SampleColumn";
import StatCard from "@/components/lis/StatCard";
import { Button } from "@/components/ui/button";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import type { SampleItem } from "@/components/lis/SampleColumn";
import type { PetitionStatus } from "@/types/petition.types";
import { toast } from "sonner";

const LAB_STATUSES: PetitionStatus[] = ["pendingReview", "inProgress", "normal", "defective"];

const formatDate = (value: string) => new Date(value).toLocaleDateString("th-TH");
const formatTime = (value: string) => new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function LabDashboard() {
  const navigate = useNavigate();
  const { sentSamples, physicalSamples, testingSamples, doneSamples } = useSamples();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const labPetitions = allPetitions.filter((petition) => LAB_STATUSES.includes(petition.status));

  const sentPetitionSamples: SampleItem[] = allPetitions
    .filter((petition) => petition.status === "sampleSent")
    .flatMap((petition) =>
      petition.items.map((item) => ({
        id: item.sampleId || `${petition.petitionNo}-${item.seq}`,
        name: [item.sampleName, item.commonName].filter(Boolean).join(" "),
        status: "sent" as const,
        date: formatDate(petition.updatedAt),
        time: formatTime(petition.updatedAt),
        sender: petition.sampleSubmittedBy || petition.requester.fullName,
      }))
    );

  const sentBoardItems = [...sentPetitionSamples, ...sentSamples];
  const doneColumnItems = [
    ...doneSamples,
    ...testingSamples.map((sample) => ({ ...sample, status: "done" as const })),
  ];
  const labTotal = sentBoardItems.length + physicalSamples.length + testingSamples.length + doneSamples.length;
  const formattedDate = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
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
          <StatCard icon={AlertTriangle} value={sentBoardItems.length} label="รอรับเข้าระบบ" variant="red" />
          <StatCard icon={Clock} value={testingSamples.length} label="กำลังวิเคราะห์" variant="amber" />
          <StatCard icon={CheckCircle} value={doneSamples.length} label="ส่งผลให้ QC แล้ว" variant="green" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <SampleColumn title="ตัวอย่างที่ส่งแล้ว" items={sentBoardItems} variant="sent" />
          <SampleColumn title="การตรวจกายภาพ" items={physicalSamples} variant="physical" />
          <SampleColumn title="การตรวจวิเคราะห์ %AI" items={testingSamples} variant="testing" />
          <SampleColumn title="ส่งผลให้ QC" items={doneColumnItems} variant="done" />
        </div>

        <PetitionDashboardTable
          title="คำร้องที่เกี่ยวข้องกับ Lab"
          petitions={labPetitions}
          loading={petitionLoading}
          emptyText="ยังไม่มีคำร้องที่เกี่ยวข้องกับ Lab"
          actionLabel="เปิดคำร้อง"
        />
      </main>
    </div>
  );
}
