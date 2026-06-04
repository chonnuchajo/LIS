import { Construction, FileDown, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DocumentsPage = () => (
  <div className="mx-auto max-w-2xl space-y-4">
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Construction className="h-4 w-4 text-amber-500" />
          โหลดเอกสาร — อยู่ระหว่างพัฒนา
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          หน้านี้จะใช้โหลด/พิมพ์บันทึก Daily Check ที่กรอกแล้วออกมาเป็นเอกสารตามฟอร์มต้นฉบับ
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <FileDown className="h-3.5 w-3.5 shrink-0" /> ดาวน์โหลดบันทึกที่กรอกแล้ว (PDF/ไฟล์ฟอร์ม)
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground/80">
            <Printer className="h-3.5 w-3.5 shrink-0" /> พิมพ์รายงานตามช่วงวันที่/ห้อง
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
);

export default DocumentsPage;
