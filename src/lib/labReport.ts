import type { LabRequest } from "@/types/labRequest.types";
import type { Petition, PetitionItem } from "@/types/petition.types";
import { PETITION_DEPT_LABELS } from "@/types/petition.types";
import type { ApprovalItemGroup } from "@/lib/qcApprovalRows";

export interface LabReportRow {
  testItem: string;
  result: string;
  criteria: string;
  method: string;
}

export interface LabReportPage {
  reportNo: string;
  reportDate: string;
  customer: { name: string; company: string; department: string; email: string; phone: string };
  sample: {
    name: string;
    batchNo: string;
    productionDate: string;
    submissionNo: string;
    manufacturer: string;
    sampleNo: string;
    receivedDate: string;
    testedDate: string;
    reportedDate: string;
    condition: string;
  };
  rows: LabReportRow[];
  analystName: string;
  labHeadName: string;
  remark: string;
}

const DASH = "-";
const COMPANY_NAME = "บริษัท ไอ ซี พี ลัดดา จำกัด";

export function buddhistDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
}

// จับคู่ labRequest ต่อ item — ตำแหน่ง sampleSeq ก่อน, batchNo รอง
function labRequestForItem(item: PetitionItem, labRequests: LabRequest[]): LabRequest | undefined {
  return (
    labRequests.find((lr) => lr.sampleSeq === item.seq) ??
    labRequests.find((lr) => lr.batchNo === item.batchNo)
  );
}

function rowsForItem(group: ApprovalItemGroup | undefined): LabReportRow[] {
  if (!group) return [];
  const out: LabReportRow[] = [];
  group.params
    .filter((p) => p.scope === "lab")
    .forEach((p) => {
      p.rows.forEach((r) => {
        const unit = r.unit ? ` (${r.unit})` : "";
        out.push({
          testItem: `${r.label}${unit}`,
          result: r.value || DASH,
          criteria: r.standardText || DASH,
          method: DASH,
        });
      });
    });
  return out;
}

const conditionText = (c?: string) =>
  c === "normal" ? "ปกติ" : c === "defective" ? "บกพร่อง" : DASH;

export function buildLabReportPages(
  petition: Petition,
  labRequests: LabRequest[],
  groups: ApprovalItemGroup[],
): LabReportPage[] {
  const groupBySeq = new Map<number, ApprovalItemGroup>();
  groups.forEach((g) => groupBySeq.set(g.seq, g));

  const reportedDate = buddhistDate(petition.labApprovedAt);
  const analystName = petition.labCompletedBy || DASH;
  const labHeadName = petition.labApprovedBy || DASH;

  return (petition.items ?? []).map((item) => {
    const lr = labRequestForItem(item, labRequests);
    const requester = lr?.requester;
    return {
      reportNo: lr?.labRequestNo || petition.petitionNo,
      reportDate: reportedDate,
      customer: {
        name: lr?.reportCustomerName || requester?.fullName || petition.submittedBy?.name || DASH,
        company: COMPANY_NAME,
        department: requester?.department || PETITION_DEPT_LABELS[petition.dept] || DASH,
        email: requester?.email || DASH,
        phone: requester?.phone || DASH,
      },
      sample: {
        name: item.commonName || item.sampleName || DASH,
        batchNo: item.batchNo || item.lotNo || DASH,
        productionDate: buddhistDate(item.productionDate) || DASH,
        submissionNo: item.submissionNo || lr?.labRequestNo || petition.petitionNo,
        manufacturer: item.labelManufacturer || item.labelSeller || DASH,
        sampleNo: item.sampleId || lr?.labRequestNo || DASH,
        receivedDate: buddhistDate(petition.labReceivedAt || petition.receivedAt || petition.sampleSentAt) || DASH,
        testedDate: buddhistDate(petition.firstResultAt || petition.labCompletedAt) || DASH,
        reportedDate: reportedDate || DASH,
        condition: conditionText(item.condition),
      },
      rows: rowsForItem(groupBySeq.get(item.seq)),
      analystName,
      labHeadName,
      remark: petition.conclusionNote || "",
    };
  });
}
