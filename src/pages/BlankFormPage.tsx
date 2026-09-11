import { FileCheck2 } from "lucide-react";

import CoaSamplePreview from "@/components/coa/CoaSamplePreview";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";

export default function BlankFormPage() {
  return (
    <AppLayout title="ตัวอย่างฟอร์ม COA">
      <div className="space-y-4">
        <PageHeader
          title={(
            <span className="inline-flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-sky-600" />
              ตัวอย่างฟอร์ม COA 1 ใบ
            </span>
          )}
          description="ตัวอย่างเอกสาร Certificate of Analysis จากข้อมูลจำลอง"
        />

        <CoaSamplePreview />
      </div>
    </AppLayout>
  );
}