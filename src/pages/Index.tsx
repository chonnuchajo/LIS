import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Download, Plus } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import StatCard from "@/components/lis/StatCard";
import SampleColumn from "@/components/lis/SampleColumn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_STATUS_CONFIG } from "@/types/petition.types";
import type { SampleItem } from "@/components/lis/SampleColumn";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { sentSamples, physicalSamples, testingSamples, doneSamples, approvals } = useSamples();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 50 });
  const allPetitions = petitionData?.items ?? [];
  const actionPetitions = allPetitions.filter((petition) =>
    petition.status === "deliveringQC" ||
    petition.status === "sampleSent" ||
    petition.status === "pendingReview"
  );

  const sentPetitionSamples: SampleItem[] = allPetitions
    .filter((petition) => petition.status === "sampleSent")
    .flatMap((petition) =>
      petition.items.map((item) => ({
        id: item.sampleId || `${petition.petitionNo}-${item.seq}`,
        name: [item.sampleName, item.commonName].filter(Boolean).join(" "),
        status: "sent" as const,
        date: new Date(petition.updatedAt).toLocaleDateString("th-TH"),
        time: new Date(petition.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        sender: petition.sampleSubmittedBy || petition.requester.fullName,
      }))
    );
  const sentBoardItems = [...sentPetitionSamples, ...sentSamples];

  // Combine done + testing samples for the "เสร็จสิ้น" column
  const doneColumnItems = [
    ...doneSamples,
    ...testingSamples.map(s => ({ ...s, status: "done" as const })),
  ];

  const today = new Date();
  const formattedDate = today.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalToday = sentSamples.length + physicalSamples.length + testingSamples.length + doneSamples.length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ภาพรวมระบบห้องปฏิบัติการ</h1>
            <p className="text-sm text-muted-foreground">
              ยินดีต้อนรับกลับ, เข้าสู่ระบบจัดการ Lab วันที่ {formattedDate}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => toast.success("กำลังส่งออกรายงาน...")}>
              <Download className="w-4 h-4" /> ส่งออกรายงาน
            </Button>
            <Button className="gap-2" onClick={() => navigate("/send-sample")}>
              <Plus className="w-4 h-4" /> สร้างรายการทดสอบใหม่
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={ClipboardList} value={totalToday} label="ตัวอย่างทั้งหมดวันนี้" variant="blue" />
          <StatCard icon={Clock} value={testingSamples.length} label="รอผลการทดสอบ" variant="amber" />
          <StatCard icon={CheckCircle} value={doneSamples.length} label="ทดสอบเสร็จสิ้น" variant="green" />
          <StatCard icon={AlertTriangle} value={sentSamples.length} label="รอรับเข้าระบบ" variant="red" />
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">รายการส่งตรวจล่าสุด</h2>
        </div>
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">คำร้องรอเจ้าหน้าที่ดำเนินการ</CardTitle>
              <Button variant="primary-outline" size="sm" onClick={() => navigate("/petitions?status=pendingReview")}>
                ดูรายการคำร้อง
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {petitionLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลดคำร้อง...</p>
            ) : actionPetitions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีคำร้องรอดำเนินการ</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่คำร้อง</TableHead>
                      <TableHead>ผู้ยื่น</TableHead>
                      <TableHead>แผนก</TableHead>
                      <TableHead>ตัวอย่าง</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionPetitions.map((petition) => {
                      const statusCfg =
                        PETITION_STATUS_CONFIG[petition.status] ?? { label: petition.status, variant: "gray-soft" as const };
                      return (
                        <TableRow key={petition._id}>
                          <TableCell className="font-semibold text-primary">{petition.petitionNo}</TableCell>
                          <TableCell>{petition.requester.fullName}</TableCell>
                          <TableCell>{petition.requester.department}</TableCell>
                          <TableCell>{petition.items.length} รายการ</TableCell>
                          <TableCell>
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="primary" onClick={() => navigate(`/petitions/${petition._id}`)}>
                              เปิดคำร้อง
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <SampleColumn title="ตัวอย่างที่ส่งแล้ว" items={sentBoardItems} variant="sent" />
          <SampleColumn title="การตรวจกายภาพ" items={physicalSamples} variant="physical" />
          <SampleColumn title="การตรวจวิเคราะห์ %AI" items={testingSamples} variant="testing" />
          <SampleColumn title="รายการทดสอบเสร็จสิ้น" items={doneColumnItems} variant="done" />
        </div>
      </main>
    </div>
  );
};

export default Index;
