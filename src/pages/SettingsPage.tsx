import AppSidebar from "@/components/lis/AppSidebar";
import { Settings } from "lucide-react";

const SettingsPage = () => (
  <div className="flex min-h-screen bg-background">
    <AppSidebar />
    <main className="flex-1 p-6 overflow-auto">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings className="w-6 h-6" />
        ตั้งค่าระบบ
      </h1>
      <p className="text-sm text-muted-foreground mt-1">หน้าตั้งค่าระบบ (อยู่ระหว่างพัฒนา)</p>
    </main>
  </div>
);

export default SettingsPage;
