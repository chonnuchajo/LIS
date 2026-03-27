import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Download, Plus } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import StatCard from "@/components/lis/StatCard";
import SampleColumn from "@/components/lis/SampleColumn";
import { Button } from "@/components/ui/button";
import { useSamples } from "@/context/SampleContext";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { sentSamples, physicalSamples, testingSamples, doneSamples, approvals } = useSamples();

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
            <h1 className="text-2xl font-bold text-foreground">ภาพรวมแล็บ (Dashboard)</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <SampleColumn title="ตัวอย่างที่ส่งแล้ว" items={sentSamples} variant="sent" />
          <SampleColumn title="การตรวจกายภาพ" items={physicalSamples} variant="physical" />
          <SampleColumn title="การตรวจวิเคราะห์ %AI" items={testingSamples} variant="testing" />
          <SampleColumn title="รายการทดสอบเสร็จสิ้น" items={doneColumnItems} variant="done" />
        </div>
      </main>
    </div>
  );
};

export default Index;
