import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MANDATORY_PRODUCT_KEYWORDS = [
  "PUBLIC HEALTH",
  "LIVE STOCK",
  "BROMADIOLONE",
  "BRODIFACOUM",
  "DIFENACOUM",
  "DIFETHIALONE",
  "COUMATETRALYL",
  "CHLOROPHACINONE",
  "FLOCOUMAFEN",
  "ZINC PHOSPHIDE",
  "RODENTICIDE",
  "RAT BAIT",
  "ยาหนู",
  "กำจัดหนู",
];

type LabSendCondition = {
  title: string;
  source: string;
  details: string[];
};

const LAB_SEND_CONDITIONS: LabSendCondition[] = [
  {
    title: "ผู้ส่งเป็นแผนก R&D",
    source: "ระดับคำร้อง",
    details: [
      "submittedBy.department เมื่อตัดช่องว่างและทำเป็นตัวเล็กแล้วต้องเท่ากับ r&d",
      "คำร้อง R&D เปิดเส้นทาง Lab เสมอ และไม่ต้องเข้าเส้นทาง QC",
    ],
  },
  {
    title: "สินค้าอยู่ในกลุ่มบังคับส่ง Lab",
    source: "ระดับรายการตัวอย่าง",
    details: [
      `ตรวจจาก sampleName และ commonName ด้วยคำหลัก: ${MANDATORY_PRODUCT_KEYWORDS.join(", ")}`,
      "ถ้าเข้าเงื่อนไขนี้ จะส่ง Lab เสมอ แม้ sendToLab จะเป็น false",
    ],
  },
  {
    title: "เลข batch ลงท้าย 1 หรือ 6",
    source: "ระดับรายการตัวอย่าง",
    details: [
      "batchNo ที่ trim แล้วลงท้ายด้วย 1 หรือ 6 จะส่ง Lab เป็นค่า default",
      "ผู้ใช้ยัง override ได้ ถ้าไม่ใช่กลุ่มสินค้าบังคับส่ง Lab",
    ],
  },
  {
    title: "ยา MF หลังเว้นช่วง 30 วันขึ้นไป",
    source: "ระดับรายการตัวอย่าง",
    details: [
      "ใช้ MF_GapDays ก่อน ถ้าไม่มีจะคำนวณจาก MF_Lasted - MF_Before",
      "ส่ง Lab เมื่อ gap ตั้งแต่ 30 วันขึ้นไป และ MF_BatchAfterGap ยังไม่เกิน 5 หรือยังไม่ระบุ",
      "ถ้า MF_ConsecutivePassCount ตั้งแต่ 5 ขึ้นไป จะไม่เข้าเงื่อนไข hold นี้",
    ],
  },
  {
    title: "ผู้ใช้กำหนด sendToLab เอง",
    source: "กำหนดเอง",
    details: [
      "ถ้า sendToLab เป็น boolean จะใช้ค่านั้นแทนค่า default สำหรับรายการที่ไม่ใช่กลุ่มบังคับส่ง Lab",
      "ถ้า sendToLab ต่างจากค่า default ต้องระบุ note เป็นเหตุผลก่อนส่งคำร้อง",
    ],
  },
  {
    title: "คำร้องถือว่ามีเส้นทาง Lab",
    source: "สรุปเส้นทาง",
    details: [
      "คำร้อง R&D ถือว่ามีเส้นทาง Lab",
      "คำร้องที่มี labReceivedAt, labCompletedAt หรือ labApprovedAt ถือว่ามีเส้นทาง Lab",
      "คำร้องที่มีอย่างน้อย 1 รายการผ่านเงื่อนไขส่ง Lab ถือว่ามีเส้นทาง Lab",
    ],
  },
];

export default function LabSendConditionsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="เงื่อนไขการส่ง Lab"
          description="สรุปกฎที่ระบบใช้ตัดสินใจว่าเอกสารหรือรายการตัวอย่างต้องเข้าเส้นทาง Lab โดยไม่แสดงรายการคำร้องจริง"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">รายการเงื่อนไขทั้งหมด</CardTitle>
            <CardDescription>อ้างอิงกฎเดียวกับการส่งคำร้องไป Lab/QC</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {LAB_SEND_CONDITIONS.map((condition, index) => (
              <div key={condition.title} className="rounded-lg border bg-card p-4 text-card-foreground">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">เงื่อนไขที่ {index + 1}</p>
                    <h2 className="mt-1 text-base font-semibold text-foreground">{condition.title}</h2>
                  </div>
                  <Badge variant="secondary">{condition.source}</Badge>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {condition.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
