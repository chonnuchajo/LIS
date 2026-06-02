import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Settings } from "lucide-react";

const SettingsPage = () => (
  <AppLayout title="ตั้งค่าระบบ">
    <PageHeader
      title={
        <span className="inline-flex items-center gap-2">
          <Settings className="w-6 h-6" />
          ตั้งค่าระบบ
        </span>
      }
      description="หน้าตั้งค่าระบบ (อยู่ระหว่างพัฒนา)"
    />
  </AppLayout>
);

export default SettingsPage;
