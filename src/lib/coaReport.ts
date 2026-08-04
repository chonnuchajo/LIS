import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot } from "@/types/coa.types";

export type CoaReportSample = CoaSampleSnapshot & { rows: CoaResultSnapshot[] };

export type CoaReportPage = {
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

export function buildCoaReportPages(doc: CoaDocument): CoaReportPage[] {
  const rowsBySeq = new Map<number, CoaResultSnapshot[]>();
  for (const row of doc.resultSnapshots || []) {
    const bucket = rowsBySeq.get(row.itemSeq) || [];
    bucket.push(row);
    rowsBySeq.set(row.itemSeq, bucket);
  }
  return [
    {
      coaNo: doc.coaNo || "-",
      revision: doc.revision || 0,
      issueDate: formatDate(doc.approval?.approvedAt),
      petitionNo: doc.petitionNoSnapshot || "-",
      customer: doc.customerSnapshot || {},
      samples: (doc.sampleSnapshots || []).map((sample) => ({ ...sample, rows: rowsBySeq.get(sample.itemSeq) || [] })),
      remark: doc.remark || "",
      approvedBy: doc.approval?.approvedBy?.name || "-",
      approvedAt: formatDate(doc.approval?.approvedAt),
    },
  ];
}
