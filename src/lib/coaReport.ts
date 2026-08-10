import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot } from "@/types/coa.types";

export type CoaReportTemplateKind = "standard" | "grWpSp" | "liquid" | "bromadiolone0005";

export type CoaReportSample = CoaSampleSnapshot & {
  rows: CoaResultSnapshot[];
  product: string;
  manufacturingDate: string;
  expiredDate: string;
  batchLabel: string;
  aiContentResult: string;
  densityResult: string;
  waxBlockSizeResult: string;
  dateOfAnalysis: string;
};

export type CoaReportPage = {
  template: CoaReportTemplateKind;
  coaNo: string;
  revision: number;
  issueDate: string;
  petitionNo: string;
  customer: NonNullable<CoaDocument["customerSnapshot"]>;
  samples: CoaReportSample[];
  remark: string;
  approvedBy: string;
  approvedAt: string;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH");
}

function formatGregorianDate(value?: string): string {
  if (!value) return "-";
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

function addYears(value: string | undefined, years: number): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  date.setFullYear(date.getFullYear() + years);
  return formatGregorianDate(date.toISOString());
}

function isGrWpSpCommonName(commonName?: string): boolean {
  return /\b(GR|WP|SP)$/i.test(commonName?.trim() ?? "");
}

function isLiquidCommonName(commonName?: string): boolean {
  return /%\s*(SL|ME|SC|EC|ZC|EW)$/i.test(commonName?.trim() ?? "");
}

function normalizeCommonName(commonName?: string): string {
  return commonName?.trim().replace(/\s+/g, " ").toUpperCase() ?? "";
}

function isBromadiolone0005CommonName(commonName?: string): boolean {
  return normalizeCommonName(commonName) === "BROMADIOLONE 0.005%";
}

function productLabel(sample: CoaSampleSnapshot): string {
  const tradeName = sample.sampleName?.trim();
  const commonName = sample.commonName?.trim();
  if (tradeName && commonName) return `${tradeName} (${commonName})`;
  return tradeName || commonName || "-";
}

function batchLabel(sample: CoaSampleSnapshot): string {
  return [sample.lotNo?.trim(), sample.batchNo?.trim()].filter(Boolean).join(" / ") || "-";
}

function aiContentResult(rows: CoaResultSnapshot[]): string {
  return rows.find((row) => /%?\s*AI\s*content/i.test(row.testItem ?? ""))?.result || "-";
}

function waxBlockSizeResult(rows: CoaResultSnapshot[]): string {
  return rows.find((row) => /wax\s*block\s*size/i.test(row.testItem ?? ""))?.result || "-";
}

function densityResult(rows: CoaResultSnapshot[]): string {
  return rows.find((row) => /density/i.test(row.testItem ?? ""))?.result || "-";
}

function dateOfAnalysis(rows: CoaResultSnapshot[]): string {
  const row = rows.find((item) => /date\s*of\s*analysis/i.test(item.testItem ?? ""));
  if (!row?.result) return "-";
  const formatted = formatGregorianDate(row.result);
  return formatted === "-" ? row.result : formatted;
}

function templateKindFor(samples: CoaReportSample[]): CoaReportTemplateKind {
  if (samples.some((sample) => isBromadiolone0005CommonName(sample.commonName))) return "bromadiolone0005";
  if (samples.some((sample) => isGrWpSpCommonName(sample.commonName))) return "grWpSp";
  if (samples.some((sample) => isLiquidCommonName(sample.commonName))) return "liquid";
  return "standard";
}

export function buildCoaReportPages(doc: CoaDocument): CoaReportPage[] {
  const rowsBySeq = new Map<number, CoaResultSnapshot[]>();
  for (const row of doc.resultSnapshots || []) {
    const bucket = rowsBySeq.get(row.itemSeq) || [];
    bucket.push(row);
    rowsBySeq.set(row.itemSeq, bucket);
  }
  const samples = (doc.sampleSnapshots || []).map((sample) => {
    const rows = rowsBySeq.get(sample.itemSeq) || [];
    return {
      ...sample,
      rows,
      product: productLabel(sample),
      manufacturingDate: formatGregorianDate(sample.productionDate),
      expiredDate: addYears(sample.productionDate, 2),
      batchLabel: batchLabel(sample),
      aiContentResult: aiContentResult(rows),
      densityResult: densityResult(rows),
      waxBlockSizeResult: waxBlockSizeResult(rows),
      dateOfAnalysis: dateOfAnalysis(rows),
    };
  });
  return [
    {
      template: templateKindFor(samples),
      coaNo: doc.coaNo || "-",
      revision: doc.revision || 0,
      issueDate: formatDate(doc.approval?.approvedAt),
      petitionNo: doc.petitionNoSnapshot || "-",
      customer: doc.customerSnapshot || {},
      samples,
      remark: doc.remark || "",
      approvedBy: doc.approval?.approvedBy?.name || "-",
      approvedAt: formatDate(doc.approval?.approvedAt),
    },
  ];
}
