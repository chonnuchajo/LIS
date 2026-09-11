import CoaReportTemplate from "@/components/coa/CoaReportTemplate";
import type { CoaReportPage } from "@/lib/coaReport";
import { cn } from "@/lib/utils";

export const sampleCoaPage: CoaReportPage = {
  template: "standard",
  coaNo: "COA-2569-0001",
  revision: 0,
  issueDate: "26/08/2569",
  petitionNo: "REQ-2569-001",
  customer: {
    name: "คุณสมชาย ใจดี",
    company: "บริษัท ตัวอย่าง จำกัด",
    department: "QA",
    email: "qa@example.com",
    phone: "02-000-0000",
  },
  samples: [
    {
      itemSeq: 1,
      sampleName: "ผลิตภัณฑ์ตัวอย่าง A",
      commonName: "GLYPHOSATE 48% SL",
      batchNo: "B2608-001",
      lotNo: "L2608-001",
      productionDate: "2026-08-01",
      sampleId: "SAMPLE-001",
      condition: "ปกติ",
      manufacturer: "I C P Ladda Company Limited",
      product: "ผลิตภัณฑ์ตัวอย่าง A (GLYPHOSATE 48% SL)",
      manufacturingDate: "01/08/2026",
      expiredDate: "01/08/2028",
      batchLabel: "L2608-001 / B2608-001",
      aiContentResult: "48.3% w/w",
      aiContentCriteria: "45.6 - 50.4% w/w",
      densityResult: "1.182 g/ml",
      waxBlockSizeResult: "-",
      dateOfAnalysis: "26/08/2026",
      rows: [
        {
          itemSeq: 1,
          testItem: "Appearance",
          result: "Conform",
          criteria: "Clear liquid",
          method: "Visual",
        },
        {
          itemSeq: 1,
          testItem: "%AI content (W/W)",
          result: "48.3% w/w",
          criteria: "45.6 - 50.4% w/w",
          method: "HPLC",
        },
        {
          itemSeq: 1,
          testItem: "Density",
          result: "1.182 g/ml",
          criteria: "1.170 - 1.190 g/ml",
          method: "Density meter",
        },
        {
          itemSeq: 1,
          testItem: "Date of analysis",
          result: "26/08/2026",
          criteria: "-",
          method: "-",
        },
      ],
    },
  ],
  remark: "ตัวอย่างสำหรับแสดงรูปแบบเอกสารเท่านั้น",
  approvedBy: "นางสาวศิริพร สงสมพันธ์",
  approvedAt: "26/08/2569",
};

type CoaSamplePreviewProps = {
  className?: string;
  title?: string;
  description?: string;
};

export default function CoaSamplePreview({
  className,
  title = "ตัวอย่างฟอร์ม COA 1 ใบ",
  description = "ตัวอย่างเอกสาร Certificate of Analysis จากข้อมูลจำลอง",
}: CoaSamplePreviewProps) {
  const sample = sampleCoaPage.samples[0];

  return (
    <section className={cn("rounded-md border border-sky-100 bg-white p-4 shadow-sm", className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-sky-950">{title}</h2>
        <p className="mt-1 text-sm text-sky-700">{description}</p>
      </div>

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-sky-50 p-3">
          <div className="font-semibold text-sky-900">เลข COA</div>
          <div className="mt-1 text-sky-700">{sampleCoaPage.coaNo}</div>
        </div>
        <div className="rounded-md bg-sky-50 p-3">
          <div className="font-semibold text-sky-900">สินค้า</div>
          <div className="mt-1 text-sky-700">{sample.commonName}</div>
        </div>
        <div className="rounded-md bg-sky-50 p-3">
          <div className="font-semibold text-sky-900">Batch</div>
          <div className="mt-1 text-sky-700">{sample.batchNo}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-100 p-4">
        <CoaReportTemplate pages={[sampleCoaPage]} />
      </div>
    </section>
  );
}