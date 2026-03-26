import AppSidebar from "@/components/lis/AppSidebar";
import { FileBarChart } from "lucide-react";

const Report = () => (
  <div className="flex min-h-screen bg-background">
    <AppSidebar />
    <main className="flex-1 p-6 overflow-auto">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <FileBarChart className="w-6 h-6" />
        รายงานสรุป
      </h1>
      <p className="text-sm text-muted-foreground mt-1">หน้ารายงานสรุป (อยู่ระหว่างพัฒนา)</p>
    </main>
  </div>
);

export default Report;
