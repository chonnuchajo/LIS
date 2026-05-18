import AppLayout from "@/components/lis/AppLayout";
import { Settings } from "lucide-react";

const SettingsPage = () => (
  <AppLayout title="ตั้งค่าระบบ">
    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
      <Settings className="w-6 h-6" />
      ตั้งค่าระบบ
    </h1>
    <p className="text-sm text-muted-foreground mt-1">หน้าตั้งค่าระบบ (อยู่ระหว่างพัฒนา)</p>
  </AppLayout>
);

export default SettingsPage;
