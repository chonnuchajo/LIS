import { Plus } from "lucide-react";

import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const skeletonSections = [
  {
    title: "รายการ Full spec",
    description: "พื้นที่รายการ spec ที่จะสร้างในขั้นถัดไป",
  },
  {
    title: "สถานะ",
    description: "ตำแหน่งแสดง draft / active / archived",
  },
  {
    title: "รายละเอียด",
    description: "พื้นที่ preview ข้อมูล spec แบบเต็ม",
  },
];

export default function FullSpecPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Full spec"
        description="โครง UI สำหรับรวบรวม spec แบบเต็ม"
        actions={(
          <Button type="button" disabled>
            <Plus className="mr-2 h-4 w-4" />
            สร้างใหม่
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {skeletonSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 rounded bg-muted" />
                <div className="h-3 w-4/5 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
