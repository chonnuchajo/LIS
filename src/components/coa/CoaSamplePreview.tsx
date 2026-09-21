import CoaReportTemplate from "@/components/coa/CoaReportTemplate";
import { buildCoaReportPages } from "@/lib/coaReport";
import { cn } from "@/lib/utils";

const sampleCoaPage = buildCoaReportPages({
  _id: "sample-coa",
  coaNo: "00012026",
  revision: 0,
  status: "approved",
  petitionId: "sample-petition",
  petitionNoSnapshot: "P-2608-0001",
  selectedItemSeqs: [1],
  sampleSnapshots: [
    {
      itemSeq: 1,
      sampleName: "Trade name",
      commonName: "GLYPHOSATE 48% SL",
      batchNo: "B2608-001",
      lotNo: "L2608-001",
      productionDate: "2026-08-01",
    },
  ],
  resultSnapshots: [
    { itemSeq: 1, testItem: "Appearance", result: "Conform", criteria: "Clear liquid" },
    { itemSeq: 1, testItem: "%AI content (W/V)", result: "48.3%" },
    { itemSeq: 1, testItem: "Density at 30°C (g/cm³)", result: "1.182" },
    { itemSeq: 1, testItem: "Date of analysis", result: "2026-08-26" },
  ],
  remark: "ตัวอย่างสำหรับแสดงรูปแบบเอกสารเท่านั้น",
  approval: {
    approvedBy: { name: "สิริพิชญ์ สงสมพันธ์" },
    approvedAt: "2026-08-26T00:00:00.000Z",
  },
})[0];

type CoaSamplePreviewProps = {
  className?: string;
  title?: string;
  description?: string;
};

export default function CoaSamplePreview({
  className,
  title = "ตัวอย่างฟอร์ม COA 1 ใบ",
  description = "ตัวอย่าง COA ยาน้ำจากข้อมูลจำลอง ใช้แม่แบบเดียวกับเอกสารจริง",
}: CoaSamplePreviewProps) {
  const sample = sampleCoaPage.samples[0];

  return (
    <section className={cn("rounded-lg border bg-card p-4 text-card-foreground shadow-sm", className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-muted p-3">
          <div className="font-semibold text-foreground">เลข COA</div>
          <div className="mt-1 text-muted-foreground">{sampleCoaPage.coaNo}</div>
        </div>
        <div className="rounded-md bg-muted p-3">
          <div className="font-semibold text-foreground">สินค้า</div>
          <div className="mt-1 text-muted-foreground">{sample.commonName}</div>
        </div>
        <div className="rounded-md bg-muted p-3">
          <div className="font-semibold text-foreground">Batch</div>
          <div className="mt-1 text-muted-foreground">{sample.batchNo}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-muted p-4">
        <CoaReportTemplate pages={[sampleCoaPage]} />
      </div>
    </section>
  );
}
