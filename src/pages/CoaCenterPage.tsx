import { useMemo, useRef, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, BellRing, FileCheck2, FileDown, FilePlus2, Folder, Pencil, Printer, TrendingUp } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CoaCreateDialog from "@/components/coa/CoaCreateDialog";
import CoaReportTemplate, { COA_REPORT_CSS } from "@/components/coa/CoaReportTemplate";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import { DEV_MODE } from "@/config/dev";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { buildCoaReportPages } from "@/lib/coaReport";
import { buildCoaRequestTrend, formatCoaTrendPercent } from "@/lib/coaTrend";
import { canPrintCoa } from "@/lib/coaStatus";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import type { CoaDocument, CoaSampleSnapshot } from "@/types/coa.types";

type CoaTab = "today" | "all";
type CoaTabTone = "sky" | "blue";
type CoaDocumentStage = "requested" | "inProgress" | "pendingApproval" | "approved";
type CoaWorkflowStage = "all" | CoaDocumentStage;

const BROMADIOLONE_DEMO_COA_ID = "demo-coa-bromadiolone-0005";
const BROMADIOLONE_DEMO_COA_NO = "00042026";

type DemoCoaEditForm = {
  sampleName: string;
  commonName: string;
  batchNo: string;
  lotNo: string;
  productionDate: string;
  aiContentResult: string;
  waxBlockSizeResult: string;
  dateOfAnalysis: string;
  remark: string;
};

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

function joinValues(values: Array<string | undefined | null>) {
  const cleaned = values.map((value) => value?.trim()).filter(Boolean) as string[];
  return Array.from(new Set(cleaned)).join(", ") || "-";
}

function formatProductionDate(value?: string | null) {
  if (!value) return "";
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function lotLabel(sample: CoaSampleSnapshot) {
  const lot = sample.lotNo?.trim();
  const batch = sample.batchNo?.trim();
  const productionDate = formatProductionDate(sample.productionDate);
  return [lot, batch, productionDate].filter(Boolean).join(" / ");
}

function customerName(doc: CoaDocument) {
  return doc.customerSnapshot?.name || doc.customerSnapshot?.company || "-";
}

function documentYear(doc: CoaDocument) {
  if (doc.coaYear) return doc.coaYear;
  const date = new Date(doc.createdAt || "");
  if (!Number.isNaN(date.getTime())) return date.getFullYear();
  return new Date().getFullYear();
}

function buddhistYear(year: number) {
  return year + 543;
}

function coaDisplayNo(doc: CoaDocument) {
  return doc.coaNo || doc.petitionNoSnapshot || doc._id;
}

function isDemoCoaDocument(doc: CoaDocument) {
  return doc._id === BROMADIOLONE_DEMO_COA_ID;
}

function coaResultValue(doc: CoaDocument, matcher: RegExp) {
  return doc.resultSnapshots.find((row) => matcher.test(row.testItem ?? ""))?.result ?? "";
}

function makeDemoCoaEditForm(doc: CoaDocument): DemoCoaEditForm {
  const sample = doc.sampleSnapshots[0];
  return {
    sampleName: sample?.sampleName ?? "",
    commonName: sample?.commonName ?? "",
    batchNo: sample?.batchNo ?? "",
    lotNo: sample?.lotNo ?? "",
    productionDate: sample?.productionDate ?? "",
    aiContentResult: coaResultValue(doc, /%AI\s*content/i),
    waxBlockSizeResult: coaResultValue(doc, /wax\s*block\s*size/i),
    dateOfAnalysis: coaResultValue(doc, /date\s*of\s*analysis/i),
    remark: doc.remark ?? "",
  };
}

function replaceDemoResult(rows: CoaDocument["resultSnapshots"], testItem: string, result: string) {
  let replaced = false;
  const nextRows = rows.map((row) => {
    if (row.testItem !== testItem) return row;
    replaced = true;
    return { ...row, result };
  });
  return replaced ? nextRows : [...nextRows, { itemSeq: 1, testItem, result }];
}

function makeBromadioloneDemoCoa(status: CoaDocument["status"] = "requested", now = new Date()): CoaDocument {
  const isoNow = now.toISOString();
  return {
    _id: BROMADIOLONE_DEMO_COA_ID,
    coaNo: status === "requested" ? null : BROMADIOLONE_DEMO_COA_NO,
    coaYear: 2026,
    sequence: status === "requested" ? undefined : 4,
    revision: 0,
    status,
    petitionId: "demo-petition-bromadiolone-0005",
    petitionNoSnapshot: "P-2608-DEMO-001",
    selectedItemSeqs: [1],
    customerSnapshot: { name: "ลูกค้าจำลอง", company: "บริษัท ตัวอย่าง จำกัด" },
    sampleSnapshots: [{
      itemSeq: 1,
      sampleName: "Red Wax Block",
      commonName: "BROMADIOLONE 0.005%",
      batchNo: "B-DEMO-001",
      lotNo: "LOT-DEMO-001",
      productionDate: "2026-08-08",
    }],
    resultSnapshots: [
      { itemSeq: 1, testItem: "Appearance", result: "Conform", criteria: "Red wax block" },
      { itemSeq: 1, testItem: "%AI content (W/W)", result: "0.0051%", criteria: "0.005% ± 0.00125" },
      { itemSeq: 1, testItem: "Wax block size", result: "5.90 gm", criteria: "5.88 gm ± 5%" },
      { itemSeq: 1, testItem: "Date of analysis", result: "2026-08-08" },
    ],
    remark: "จำลองการสร้าง COA สำหรับ BROMADIOLONE 0.005%",
    approval: {},
    print: { printCount: 0 },
    createdBy: { name: "Demo User", email: "demo@example.com", role: "demo" },
    updatedBy: { name: "Demo User", email: "demo@example.com", role: "demo" },
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

function workflowStageFor(doc: CoaDocument): CoaDocumentStage {
  if (doc.status === "requested") return "requested";
  if (doc.status === "pendingApproval" || doc.status === "pendingRevisionApproval") return "pendingApproval";
  if (doc.status === "approved" || doc.status === "printed" || doc.status === "reissued") return "approved";
  return "inProgress";
}

const workflowStageLabels: Record<CoaDocumentStage, string> = {
  requested: "ขอ COA",
  inProgress: "ดำเนินการแล้ว",
  pendingApproval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
};

const workflowStageBadgeVariants: Record<Exclude<CoaDocumentStage, "requested">, ComponentProps<typeof Badge>["variant"]> = {
  inProgress: "blue-soft",
  pendingApproval: "blue-soft",
  approved: "blue-soft",
};

const workflowStageBadgeVariantFor = (stage: CoaDocumentStage): ComponentProps<typeof Badge>["variant"] => (
  stage === "requested" ? "blue-soft" : workflowStageBadgeVariants[stage]
);

function isCoaPendingApproval(doc: CoaDocument) {
  return doc.status === "pendingApproval" || doc.status === "pendingRevisionApproval";
}

function needsCoaCorrection(doc: CoaDocument) {
  return (doc.status === "draft" || doc.status === "revisionDraft") && Boolean(
    doc.approval?.rejectedAt || doc.approval?.rejectReason?.trim(),
  );
}

function coaCorrectionReason(doc: CoaDocument) {
  return doc.approval?.rejectReason?.trim() || "กรุณาตรวจสอบและแก้ไขข้อมูล COA ใหม่";
}

function coaNotificationLabel(doc: CoaDocument) {
  return [coaDisplayNo(doc), doc.petitionNoSnapshot].filter(Boolean).join(" · ");
}

function coaNotificationTime(doc: CoaDocument) {
  const value = doc.approval?.rejectedAt || doc.approval?.approvedAt || doc.approval?.submittedAt || doc.updatedAt || doc.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function latestCoaDocuments(docs: CoaDocument[], limit = 3) {
  return [...docs].sort((a, b) => coaNotificationTime(b) - coaNotificationTime(a)).slice(0, limit);
}

type CoaDuplicateGroup = {
  key: string;
  label: string;
  documents: CoaDocument[];
};

type CoaDailyRequestSummary = {
  dateKey: string;
  label: string;
  count: number;
  approvedCount: number;
};

function normalizeNotificationValue(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeNotificationKey(value?: string | null) {
  return normalizeNotificationValue(value).toLowerCase();
}

function normalizeDateKey(value?: string | null) {
  const text = normalizeNotificationValue(value);
  if (!text) return "";
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.toLowerCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSummaryDate(dateKey: string) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dateText = formatProductionDate(dateKey) || dateKey || "ไม่ระบุวันที่";
  return dateKey === todayKey ? `วันนี้ (${dateText})` : dateText;
}

function isNotificationActiveCoa(doc: CoaDocument) {
  return doc.status !== "cancelled" && doc.status !== "superseded" && doc.status !== "rejected";
}

function isCoaReissueRequest(doc: CoaDocument) {
  return Boolean(doc.sourceCoaId) || Number(doc.revision || 0) > 0
    || doc.status === "revisionDraft"
    || doc.status === "pendingRevisionApproval"
    || doc.status === "reissued";
}

function isCoaApprovedDocument(doc: CoaDocument) {
  return doc.status === "approved" || doc.status === "printed" || doc.status === "reissued";
}

function addDocumentToDuplicateGroup(groups: Map<string, CoaDuplicateGroup>, key: string, label: string, doc: CoaDocument) {
  const group = groups.get(key) ?? { key, label, documents: [] };
  if (!group.documents.some((item) => item._id === doc._id)) group.documents.push(doc);
  groups.set(key, group);
}

function sortedDuplicateGroups(groups: Map<string, CoaDuplicateGroup>, limit = 5) {
  return Array.from(groups.values())
    .filter((group) => group.documents.length > 1)
    .sort((a, b) => b.documents.length - a.documents.length || a.label.localeCompare(b.label, "th"))
    .slice(0, limit);
}

function duplicateCommonNameGroups(docs: CoaDocument[]) {
  const groups = new Map<string, CoaDuplicateGroup>();
  for (const doc of docs.filter(isNotificationActiveCoa)) {
    for (const sample of doc.sampleSnapshots ?? []) {
      const label = normalizeNotificationValue(sample.commonName);
      const key = normalizeNotificationKey(label);
      if (!key) continue;
      addDocumentToDuplicateGroup(groups, key, label, doc);
    }
  }
  return sortedDuplicateGroups(groups);
}

function duplicateBatchProductionDateGroups(docs: CoaDocument[]) {
  const groups = new Map<string, CoaDuplicateGroup>();
  for (const doc of docs.filter(isNotificationActiveCoa)) {
    for (const sample of doc.sampleSnapshots ?? []) {
      const batch = normalizeNotificationValue(sample.batchNo);
      const batchKey = normalizeNotificationKey(batch);
      const productionDateKey = normalizeDateKey(sample.productionDate);
      if (!batchKey || !productionDateKey) continue;
      const label = `Batch ${batch} · ผลิต ${formatProductionDate(productionDateKey) || productionDateKey}`;
      addDocumentToDuplicateGroup(groups, `${batchKey}\u0000${productionDateKey}`, label, doc);
    }
  }
  return sortedDuplicateGroups(groups);
}

function dailyRequestSummaries(docs: CoaDocument[], limit = 7) {
  const summaries = new Map<string, { count: number; approvedCount: number }>();
  for (const doc of docs) {
    const dateKey = normalizeDateKey(doc.createdAt || doc.updatedAt);
    if (!dateKey) continue;
    const current = summaries.get(dateKey) ?? { count: 0, approvedCount: 0 };
    current.count += 1;
    if (isCoaApprovedDocument(doc)) current.approvedCount += 1;
    summaries.set(dateKey, current);
  }
  return Array.from(summaries.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, limit)
    .map(([dateKey, summary]) => ({
      dateKey,
      label: formatSummaryDate(dateKey),
      count: summary.count,
      approvedCount: summary.approvedCount,
    }));
}

function approvedSummaryDate(doc: CoaDocument) {
  const dateKey = normalizeDateKey(doc.approval?.approvedAt || doc.updatedAt || doc.createdAt);
  return dateKey ? formatSummaryDate(dateKey) : "ไม่ระบุวันที่อนุมัติ";
}

type CoaNotificationAlertProps = {
  pendingApprovalDocs: CoaDocument[];
  pendingApprovalPreviewDocs: CoaDocument[];
  correctionDocs: CoaDocument[];
  correctionPreviewDocs: CoaDocument[];
  duplicateRequestDocs: CoaDocument[];
  duplicateRequestPreviewDocs: CoaDocument[];
  duplicateCommonNameGroups: CoaDuplicateGroup[];
  duplicateBatchProductionDateGroups: CoaDuplicateGroup[];
  approvedDocs: CoaDocument[];
  approvedPreviewDocs: CoaDocument[];
  dailyRequestSummaries: CoaDailyRequestSummary[];
  onOpenStage: (stage: CoaWorkflowStage) => void;
};

function CoaNotificationAlert({
  pendingApprovalDocs,
  pendingApprovalPreviewDocs,
  correctionDocs,
  correctionPreviewDocs,
  duplicateRequestDocs,
  duplicateRequestPreviewDocs,
  duplicateCommonNameGroups,
  duplicateBatchProductionDateGroups,
  approvedDocs,
  approvedPreviewDocs,
  dailyRequestSummaries,
  onOpenStage,
}: CoaNotificationAlertProps) {
  const duplicateRequestStage = duplicateRequestDocs.some((doc) => workflowStageFor(doc) === "pendingApproval")
    ? "pendingApproval"
    : duplicateRequestDocs.some((doc) => workflowStageFor(doc) === "inProgress")
      ? "inProgress"
      : "approved";

  return (
    <Alert data-testid="coa-notification-alert" className="border-violet-200 bg-violet-50/90 text-violet-950 shadow-sm [&>svg]:text-violet-600">
      <BellRing className="h-5 w-5" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        แจ้งเตือนเอกสาร COA
        {pendingApprovalDocs.length > 0 && <Badge variant="purple-soft">รออนุมัติ {pendingApprovalDocs.length} รายการ</Badge>}
        {correctionDocs.length > 0 && <Badge variant="purple-soft">ต้องแก้ไขข้อมูลใหม่ {correctionDocs.length} รายการ</Badge>}
        {duplicateRequestDocs.length > 0 && <Badge variant="purple-soft">ขอใบซ้ำ {duplicateRequestDocs.length} รายการ</Badge>}
        {duplicateCommonNameGroups.length > 0 && <Badge variant="purple-soft">ชื่อสามัญซ้ำ {duplicateCommonNameGroups.length} กลุ่ม</Badge>}
        {duplicateBatchProductionDateGroups.length > 0 && <Badge variant="purple-soft">Batch/วันที่ผลิตซ้ำ {duplicateBatchProductionDateGroups.length} กลุ่ม</Badge>}
        {approvedDocs.length > 0 && <Badge variant="purple-soft">อนุมัติแล้ว {approvedDocs.length} รายการ</Badge>}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {pendingApprovalDocs.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <AlertTriangle className="h-4 w-4" />
                    รออนุมัติจาก QC Head
                  </div>
                  <p className="mt-1 text-xs text-violet-700">มีเอกสารที่ส่งขออนุมัติแล้วแต่ยังไม่ได้รับการอนุมัติ</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50" onClick={() => onOpenStage("pendingApproval")}>
                  ดูรายการรออนุมัติ
                </Button>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-violet-800">
                {pendingApprovalPreviewDocs.map((doc) => (
                  <li key={doc._id} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="font-semibold">{coaNotificationLabel(doc)}</div>
                    <div className="text-violet-700">{customerName(doc)} · {joinValues(doc.sampleSnapshots?.map((sample) => sample.sampleName))}</div>
                  </li>
                ))}
                {pendingApprovalDocs.length > pendingApprovalPreviewDocs.length && (
                  <li className="text-violet-700">และอีก {pendingApprovalDocs.length - pendingApprovalPreviewDocs.length} รายการ</li>
                )}
              </ul>
            </div>
          )}
          {correctionDocs.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                    <AlertTriangle className="h-4 w-4" />
                    ต้องแก้ไขข้อมูลใหม่
                  </div>
                  <p className="mt-1 text-xs text-violet-700">เอกสารถูกส่งกลับจากการอนุมัติ โปรดแก้ไขข้อมูลแล้วส่งอนุมัติอีกครั้ง</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50" onClick={() => onOpenStage("inProgress")}>
                  ดูรายการต้องแก้ไข
                </Button>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-violet-700">
                {correctionPreviewDocs.map((doc) => (
                  <li key={doc._id} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="font-semibold">{coaNotificationLabel(doc)}</div>
                    <div>{coaCorrectionReason(doc)}</div>
                  </li>
                ))}
                {correctionDocs.length > correctionPreviewDocs.length && <li>และอีก {correctionDocs.length - correctionPreviewDocs.length} รายการ</li>}
              </ul>
            </div>
          )}
          {duplicateRequestDocs.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                    <AlertTriangle className="h-4 w-4" />
                    เอกสารที่ขอใบซ้ำ
                  </div>
                  <p className="mt-1 text-xs text-violet-700">พบ COA ที่เป็นใบแก้ไข/ออกซ้ำจากใบเดิม ควรตรวจสอบก่อนอนุมัติหรือพิมพ์</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50" onClick={() => onOpenStage(duplicateRequestStage)}>
                  ดูรายการใบซ้ำ
                </Button>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-violet-700">
                {duplicateRequestPreviewDocs.map((doc) => (
                  <li key={doc._id} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="font-semibold">{coaNotificationLabel(doc)}</div>
                    <div>Rev.{doc.revision || 0} · {customerName(doc)} · {joinValues(doc.sampleSnapshots?.map((sample) => sample.commonName || sample.sampleName))}</div>
                  </li>
                ))}
                {duplicateRequestDocs.length > duplicateRequestPreviewDocs.length && <li>และอีก {duplicateRequestDocs.length - duplicateRequestPreviewDocs.length} รายการ</li>}
              </ul>
            </div>
          )}
          {duplicateCommonNameGroups.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <AlertTriangle className="h-4 w-4" />
                ชื่อสามัญซ้ำ
              </div>
              <p className="mt-1 text-xs text-violet-700">พบชื่อสามัญเดียวกันในหลายเอกสาร COA ภายในช่วงที่กำลังดู</p>
              <ul className="mt-3 space-y-2 text-xs text-violet-800">
                {duplicateCommonNameGroups.map((group) => (
                  <li key={group.key} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>{group.label}</span>
                      <Badge variant="purple-soft">{group.documents.length} ใบ</Badge>
                    </div>
                    <div className="mt-1 text-violet-700">{group.documents.slice(0, 3).map(coaNotificationLabel).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {duplicateBatchProductionDateGroups.length > 0 && (
            <div className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <AlertTriangle className="h-4 w-4" />
                Batch และวันที่ผลิตซ้ำ
              </div>
              <p className="mt-1 text-xs text-violet-700">พบ Batch No. คู่กับวันที่ผลิตเดียวกันในหลายเอกสาร</p>
              <ul className="mt-3 space-y-2 text-xs text-violet-700">
                {duplicateBatchProductionDateGroups.map((group) => (
                  <li key={group.key} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>{group.label}</span>
                      <Badge variant="purple-soft">{group.documents.length} ใบ</Badge>
                    </div>
                    <div className="mt-1">{group.documents.slice(0, 3).map(coaNotificationLabel).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {approvedDocs.length > 0 && (
            <div data-testid="coa-approved-summary" className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <FileCheck2 className="h-4 w-4" />
                สรุปข้อมูลที่ผ่านการอนุมัติ
              </div>
              <p className="mt-1 text-xs text-violet-700">รวมเอกสารสถานะอนุมัติแล้ว พิมพ์แล้ว และออกซ้ำที่พร้อมใช้งาน</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-violet-700">
                <div className="rounded border border-violet-100 bg-violet-50/70 p-2">
                  <div className="text-lg font-bold text-violet-800">{approvedDocs.length}</div>
                  <div>รายการที่ผ่านอนุมัติ</div>
                </div>
                <div className="rounded border border-violet-100 bg-violet-50/70 p-2">
                  <div className="text-lg font-bold text-violet-800">{approvedDocs.filter((doc) => isToday(doc.approval?.approvedAt || doc.updatedAt || doc.createdAt)).length}</div>
                  <div>อนุมัติวันนี้</div>
                </div>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-violet-700">
                {approvedPreviewDocs.map((doc) => (
                  <li key={doc._id} className="rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <div className="font-semibold">{coaNotificationLabel(doc)}</div>
                    <div>{customerName(doc)} · อนุมัติ {approvedSummaryDate(doc)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dailyRequestSummaries.length > 0 && (
            <div data-testid="coa-daily-request-summary" className="rounded-md border border-violet-200 bg-white/80 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <BellRing className="h-4 w-4" />
                สรุปจำนวนคำขอแต่ละวัน
              </div>
              <p className="mt-1 text-xs text-violet-700">นับจากวันที่สร้างคำขอ COA ในช่วงข้อมูลที่กำลังดู</p>
              <ul className="mt-3 space-y-2 text-xs text-violet-700">
                {dailyRequestSummaries.map((summary) => (
                  <li key={summary.dateKey} className="flex flex-wrap items-center justify-between gap-2 rounded border border-violet-100 bg-violet-50/60 px-2 py-1.5">
                    <span className="font-semibold">{summary.label}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="purple-soft">{summary.count} คำขอ</Badge>
                      {summary.approvedCount > 0 && <Badge variant="purple-soft">อนุมัติ {summary.approvedCount}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default function CoaCenterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const demoCoaEnabled = DEV_MODE && searchParams.get("demoCoa") === "bromadiolone";
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CoaTab>("today");
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<CoaWorkflowStage>(() => (demoCoaEnabled ? "requested" : "all"));
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [openAllYear, setOpenAllYear] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CoaDocument | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const [demoCoa, setDemoCoa] = useState<CoaDocument | null>(() => (demoCoaEnabled ? makeBromadioloneDemoCoa() : null));
  const [demoEditDoc, setDemoEditDoc] = useState<CoaDocument | null>(null);
  const [demoEditForm, setDemoEditForm] = useState<DemoCoaEditForm>(() => makeDemoCoaEditForm(makeBromadioloneDemoCoa("draft")));
  const { data, isLoading } = useQuery({ queryKey: ["coa", "documents"], queryFn: () => api.getCoaDocuments() });

  const roles = normalizeRoles(user);
  const activeRole = user?.role || primaryRole(roles);
  const actor = {
    name: user?.name,
    email: user?.email,
    role: activeRole,
    activeRole,
    roles,
    permissions: user?.permissions ?? [],
    position: user?.position,
  };
  const isQcHead = [user?.role, actor.activeRole]
    .some((value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_") === "qc_head")
    || actor.permissions.includes("coa.approve");
  const invalidateCoaDocuments = () => queryClient.invalidateQueries({ queryKey: ["coa", "documents"] });
  const syncCoaDocument = (doc: CoaDocument) => {
    queryClient.setQueryData<{ items: CoaDocument[] }>(["coa", "documents"], (current) => {
      if (!current) return { items: [doc] };
      const exists = current.items.some((item) => item._id === doc._id);
      const items = exists
        ? current.items.map((item) => (item._id === doc._id ? doc : item))
        : [doc, ...current.items];
      return { ...current, items };
    });
  };
  const submit = useMutation({ mutationFn: (id: string) => api.submitCoaDocument(id, { _user: actor }), onSuccess: invalidateCoaDocuments });
  const approve = useMutation({ mutationFn: (id: string) => api.approveCoaDocument(id, { _user: actor }), onSuccess: invalidateCoaDocuments });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectCoaDocument(id, { reason, _user: actor }),
    onSuccess: invalidateCoaDocuments,
  });

  function handleReject(doc: CoaDocument) {
    const reason = window.prompt(`เหตุผลที่ไม่อนุมัติ COA ${coaDisplayNo(doc)}`)?.trim();
    if (!reason) return;
    if (isDemoCoaDocument(doc)) {
      setDemoCoa({
        ...doc,
        status: "draft",
        approval: {
          ...doc.approval,
          rejectedBy: actor,
          rejectedAt: new Date().toISOString(),
          rejectReason: reason,
        },
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
      setActiveWorkflowStage("inProgress");
      return;
    }
    reject.mutate({ id: doc._id, reason });
  }

  function handleCreate(doc: CoaDocument) {
    if (isDemoCoaDocument(doc)) {
      setDemoCoa({
        ...doc,
        coaNo: doc.coaNo || BROMADIOLONE_DEMO_COA_NO,
        sequence: doc.sequence || 4,
        status: "draft",
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
      setActiveWorkflowStage("inProgress");
      return;
    }
    setCreateOpen(true);
  }

  function handleCreated(doc: CoaDocument) {
    syncCoaDocument(doc);
    if (workflowStageFor(doc) === "pendingApproval") {
      setActiveTab("today");
      setActiveYear(documentYear(doc));
      setActiveWorkflowStage("pendingApproval");
      setOpenAllYear(null);
      return;
    }
    navigate(`/coa/${doc._id}`);
  }

  function handleEdit(doc: CoaDocument) {
    if (isDemoCoaDocument(doc)) {
      setDemoEditForm(makeDemoCoaEditForm(doc));
      setDemoEditDoc(doc);
      return;
    }
    navigate(`/coa/${doc._id}`);
  }

  function handleSubmit(doc: CoaDocument) {
    if (isDemoCoaDocument(doc)) {
      setDemoCoa({
        ...doc,
        status: "pendingApproval",
        approval: { ...doc.approval, submittedBy: actor, submittedAt: new Date().toISOString() },
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
      setActiveWorkflowStage("pendingApproval");
      return;
    }
    submit.mutate(doc._id);
  }

  function handleApprove(doc: CoaDocument) {
    if (isDemoCoaDocument(doc)) {
      setDemoCoa({
        ...doc,
        coaNo: doc.coaNo || BROMADIOLONE_DEMO_COA_NO,
        sequence: doc.sequence || 4,
        status: "approved",
        approval: { ...doc.approval, approvedBy: actor, approvedAt: new Date().toISOString() },
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      });
      setActiveWorkflowStage("approved");
      return;
    }
    approve.mutate(doc._id);
  }

  function handleSaveDemoEdit() {
    if (!demoEditDoc) return;
    setDemoCoa((currentDoc) => {
      const baseDoc = currentDoc && isDemoCoaDocument(currentDoc) ? currentDoc : demoEditDoc;
      const resultSnapshots = replaceDemoResult(
        replaceDemoResult(
          replaceDemoResult(baseDoc.resultSnapshots, "%AI content (W/W)", demoEditForm.aiContentResult),
          "Wax block size",
          demoEditForm.waxBlockSizeResult,
        ),
        "Date of analysis",
        demoEditForm.dateOfAnalysis,
      );
      return {
        ...baseDoc,
        sampleSnapshots: baseDoc.sampleSnapshots.map((sample, index) => (
          index === 0
            ? {
                ...sample,
                sampleName: demoEditForm.sampleName,
                commonName: demoEditForm.commonName,
                batchNo: demoEditForm.batchNo,
                lotNo: demoEditForm.lotNo,
                productionDate: demoEditForm.productionDate,
              }
            : sample
        )),
        resultSnapshots,
        remark: demoEditForm.remark,
        updatedBy: actor,
        updatedAt: new Date().toISOString(),
      };
    });
    setDemoEditDoc(null);
  }

  const items = useMemo(() => {
    const documents = data?.items ?? [];
    return demoCoa ? [demoCoa, ...documents.filter((doc) => doc._id !== demoCoa._id)] : documents;
  }, [data, demoCoa]);
  const previewPages = useMemo(() => (previewDoc ? buildCoaReportPages(previewDoc) : []), [previewDoc]);
  const years = useMemo(() => {
    return Array.from(new Set(items.map(documentYear))).sort((a, b) => b - a);
  }, [items]);
  const allFolderYears = useMemo(() => {
    const folders = Array.from(new Set(items.map(documentYear).filter((year) => year >= 2026))).sort((a, b) => b - a);
    return folders.length ? folders : [2026];
  }, [items]);
  const selectedYear = activeYear && years.includes(activeYear) ? activeYear : years[0] ?? new Date().getFullYear();
  const yearItems = useMemo(() => items.filter((doc) => documentYear(doc) === selectedYear), [items, selectedYear]);
  const openedAllYearItems = useMemo(() => (
    openAllYear ? items.filter((doc) => documentYear(doc) === openAllYear) : []
  ), [items, openAllYear]);
  const trendScopeItems = useMemo(() => {
    if (activeTab === "all") return openAllYear ? openedAllYearItems : items;
    return yearItems;
  }, [activeTab, items, openAllYear, openedAllYearItems, yearItems]);
  const coaRequestTrend = useMemo(() => buildCoaRequestTrend(trendScopeItems), [trendScopeItems]);
  const coaRequestTrendTotal = useMemo(() => (
    coaRequestTrend.reduce((sum, entry) => sum + entry.requestCount, 0)
  ), [coaRequestTrend]);
  const coaRequestTrendScopeLabel = activeTab === "all"
    ? (openAllYear ? `แฟ้มปี ${buddhistYear(openAllYear)}` : "ทุกปี")
    : `ปี ${selectedYear}`;
  const topCoaRequestTrend = coaRequestTrend[0];
  const todayCount = useMemo(() => yearItems.filter((doc) => isToday(doc.createdAt)).length, [yearItems]);
  const workflowCounts = useMemo(() => ({
    requested: yearItems.filter((doc) => workflowStageFor(doc) === "requested").length,
    inProgress: yearItems.filter((doc) => workflowStageFor(doc) === "inProgress").length,
    pendingApproval: yearItems.filter((doc) => workflowStageFor(doc) === "pendingApproval").length,
    approved: yearItems.filter((doc) => workflowStageFor(doc) === "approved").length,
  }), [yearItems]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visibleItems = activeTab === "all"
      ? openedAllYearItems
      : (activeWorkflowStage === "all" ? yearItems.filter((doc) => isToday(doc.createdAt)) : yearItems);
    const scopedItems = activeTab === "all" || activeWorkflowStage === "all"
      ? visibleItems
      : visibleItems.filter((doc) => workflowStageFor(doc) === activeWorkflowStage);
    if (activeTab === "all" && !openAllYear) return [];
    if (!query) return scopedItems;
    return scopedItems.filter((doc) => [
      doc.petitionNoSnapshot,
      doc.coaNo,
      workflowStageLabels[workflowStageFor(doc)],
      customerName(doc),
      joinValues(doc.sampleSnapshots?.map((sample) => sample.sampleName)),
      joinValues(doc.sampleSnapshots?.map((sample) => sample.commonName)),
      joinValues(doc.sampleSnapshots?.map(lotLabel)),
    ].join(" ").toLowerCase().includes(query));
  }, [activeTab, activeWorkflowStage, openAllYear, openedAllYearItems, search, yearItems]);
  const alertScopeItems = useMemo(() => {
    if (activeTab === "all") return openAllYear ? openedAllYearItems : items;
    return yearItems;
  }, [activeTab, items, openAllYear, openedAllYearItems, yearItems]);
  const pendingApprovalDocs = useMemo(() => alertScopeItems.filter(isCoaPendingApproval), [alertScopeItems]);
  const correctionDocs = useMemo(() => alertScopeItems.filter(needsCoaCorrection), [alertScopeItems]);
  const duplicateRequestDocs = useMemo(() => alertScopeItems.filter((doc) => isNotificationActiveCoa(doc) && isCoaReissueRequest(doc)), [alertScopeItems]);
  const duplicateCommonNameAlertGroups = useMemo(() => duplicateCommonNameGroups(alertScopeItems), [alertScopeItems]);
  const duplicateBatchProductionAlertGroups = useMemo(() => duplicateBatchProductionDateGroups(alertScopeItems), [alertScopeItems]);
  const approvedDocs = useMemo(() => alertScopeItems.filter(isCoaApprovedDocument), [alertScopeItems]);
  const dailyRequestAlertSummaries = useMemo(() => dailyRequestSummaries(alertScopeItems), [alertScopeItems]);
  const pendingApprovalPreviewDocs = useMemo(() => latestCoaDocuments(pendingApprovalDocs), [pendingApprovalDocs]);
  const correctionPreviewDocs = useMemo(() => latestCoaDocuments(correctionDocs), [correctionDocs]);
  const duplicateRequestPreviewDocs = useMemo(() => latestCoaDocuments(duplicateRequestDocs), [duplicateRequestDocs]);
  const approvedPreviewDocs = useMemo(() => latestCoaDocuments(approvedDocs), [approvedDocs]);
  const notificationButtonCount = pendingApprovalDocs.length
    + correctionDocs.length
    + duplicateRequestDocs.length
    + duplicateCommonNameAlertGroups.length
    + duplicateBatchProductionAlertGroups.length;
  const showCoaNotifications = alertScopeItems.length > 0;

  function focusCoaNotifications() {
    notificationPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function showWorkflowStage(stage: CoaWorkflowStage) {
    setActiveTab("today");
    setActiveWorkflowStage(stage);
    setOpenAllYear(null);
  }

  const tabs: Array<{ key: CoaTab; label: string; count: number; tone: CoaTabTone }> = [
    { key: "today", label: "คำขอ COA วันนี้", count: todayCount, tone: "sky" },
    { key: "all", label: "คำขอ COA ทั้งหมด", count: yearItems.length, tone: "blue" },
  ];
  const tabToneClasses: Record<CoaTabTone, { button: string; selected: string; count: string }> = {
    sky: {
      button: "bg-sky-100 text-sky-800 hover:bg-sky-200",
      selected: "ring-2 ring-sky-300 shadow-sm",
      count: "bg-sky-50 text-sky-700",
    },
    blue: {
      button: "bg-blue-100 text-blue-800 hover:bg-blue-200",
      selected: "ring-2 ring-blue-300 shadow-sm",
      count: "bg-blue-50 text-blue-700",
    },
  };
  const workflowTabs: Array<{ key: CoaWorkflowStage; label: string; count: number; className: string; activeClassName: string; countClassName: string }> = [
    { key: "all", label: "ทุกสถานะ", count: yearItems.length, className: "bg-sky-50 text-sky-700 hover:bg-sky-100", activeClassName: "ring-2 ring-sky-200 shadow-sm", countClassName: "bg-white text-sky-600" },
    { key: "requested", label: workflowStageLabels.requested, count: workflowCounts.requested, className: "bg-sky-100 text-sky-800 hover:bg-sky-200", activeClassName: "ring-2 ring-sky-300 shadow-sm", countClassName: "bg-sky-50 text-sky-700" },
    { key: "inProgress", label: workflowStageLabels.inProgress, count: workflowCounts.inProgress, className: "bg-green-100 text-green-800 hover:bg-green-200", activeClassName: "ring-2 ring-green-300 shadow-sm", countClassName: "bg-green-50 text-green-700" },
    { key: "pendingApproval", label: workflowStageLabels.pendingApproval, count: workflowCounts.pendingApproval, className: "bg-orange-100 text-orange-800 hover:bg-orange-200", activeClassName: "ring-2 ring-orange-300 shadow-sm", countClassName: "bg-orange-50 text-orange-700" },
    { key: "approved", label: workflowStageLabels.approved, count: workflowCounts.approved, className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200", activeClassName: "ring-2 ring-yellow-300 shadow-sm", countClassName: "bg-yellow-50 text-yellow-700" },
  ];

  const showPrintActions = activeTab !== "all" && activeWorkflowStage === "approved";
  const showCreateActions = activeTab !== "all" && activeWorkflowStage === "requested";
  const showEditActions = activeTab !== "all" && activeWorkflowStage === "inProgress";
  const showApprovalActions = activeTab !== "all" && activeWorkflowStage === "pendingApproval";
  const showInProgressReviewColumns = showEditActions;
  const showWorkflowTabs = activeTab !== "all";
  const showApprovedCommandColumns = showPrintActions;
  const showPendingApprovalColumns = showApprovalActions;
  const showDocumentColumn = !showInProgressReviewColumns && !showApprovedCommandColumns && !showPendingApprovalColumns;
  const showCustomerColumn = !showInProgressReviewColumns && !showApprovedCommandColumns && !showPendingApprovalColumns;
  const showCompanyColumn = showApprovedCommandColumns;
  const showCommonNameColumn = !showApprovedCommandColumns;
  const showLotColumn = !showApprovedCommandColumns;
  const showStatusColumn = activeTab !== "all" && !showInProgressReviewColumns && !showCreateActions && !showApprovedCommandColumns;
  const showCommandColumn = showPrintActions || showCreateActions || showEditActions || showApprovalActions;
  const tableColumnCount = [
    showDocumentColumn,
    true,
    showCustomerColumn,
    true,
    showCompanyColumn,
    showCommonNameColumn,
    showLotColumn,
    showStatusColumn,
    showCommandColumn,
  ].filter(Boolean).length;
  const showAllYearFolders = activeTab === "all" && !openAllYear;

  return (
    <AppLayout>
      <div data-testid="coa-center-page" className="min-h-[calc(100vh-64px)] bg-sky-50 p-6">
        <div className="space-y-5">
          <PageHeader
            title={(
              <span className="inline-flex items-center gap-2 text-sky-950">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                ออกเอกสาร COA
              </span>
            )}
            actions={(
              <Button
                type="button"
                variant="outline"
                aria-label={`แจ้งเตือน COA ${notificationButtonCount} รายการ`}
                aria-controls="coa-notification-panel"
                className="gap-2 border-violet-200 bg-violet-50 text-violet-700 shadow-sm hover:bg-violet-100 hover:text-violet-800"
                onClick={focusCoaNotifications}
              >
                <BellRing className="h-4 w-4 text-violet-600" />
                <span className="hidden sm:inline">แจ้งเตือน</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  {notificationButtonCount}
                </span>
              </Button>
            )}
          />

          {demoCoaEnabled && (
            <div role="status" className="rounded-md border border-sky-200 bg-sky-100/70 p-3 text-sm text-sky-900 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                <Badge variant="blue-soft">โหมดจำลอง</Badge>
                <span>COA BROMADIOLONE 0.005% พร้อมทดสอบในแท็บขอ COA</span>
              </div>
              <p className="mt-1 text-sky-700">กดสร้าง COA → เสร็จสิ้น → QC Head อนุมัติ เพื่อส่งไปหน้าอนุมัติแล้วและแฟ้มปี 2569</p>
            </div>
          )}

          {showCoaNotifications && (
            <div ref={notificationPanelRef} id="coa-notification-panel">
              <CoaNotificationAlert
                pendingApprovalDocs={pendingApprovalDocs}
                pendingApprovalPreviewDocs={pendingApprovalPreviewDocs}
                correctionDocs={correctionDocs}
                correctionPreviewDocs={correctionPreviewDocs}
                duplicateRequestDocs={duplicateRequestDocs}
                duplicateRequestPreviewDocs={duplicateRequestPreviewDocs}
                duplicateCommonNameGroups={duplicateCommonNameAlertGroups}
                duplicateBatchProductionDateGroups={duplicateBatchProductionAlertGroups}
                approvedDocs={approvedDocs}
                approvedPreviewDocs={approvedPreviewDocs}
                dailyRequestSummaries={dailyRequestAlertSummaries}
                onOpenStage={showWorkflowStage}
              />
            </div>
          )}

          <div data-testid="coa-request-trend" className="rounded-md border border-indigo-100 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Trend การขอ COA (%AI)</h2>
                  <p className="text-sm text-slate-500">
                    เก็บจาก COA ที่บันทึกใน {coaRequestTrendScopeLabel}: ความถี่ที่ขอแยกตามชื่อยา พร้อม %AI จากฉลากและผลวิเคราะห์
                  </p>
                </div>
              </div>
              <Badge variant="blue-soft">รวม {coaRequestTrendTotal} รายการยา</Badge>
            </div>
            {coaRequestTrend.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูล Trend จาก COA ในช่วงนี้
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3">
                  {coaRequestTrend.map((entry, index) => (
                    <div key={entry.key} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-700">{index + 1}</span>
                            <span className="truncate">{entry.commonName}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>Label %AI {formatCoaTrendPercent(entry.labelAiPercent)}</span>
                            <span>Avg %AI {formatCoaTrendPercent(entry.averageAiPercent, 4)}</span>
                            {entry.latestAiResult && <span>ล่าสุด {entry.latestAiResult}</span>}
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold text-indigo-700">
                          {entry.requestCount} ครั้ง
                          <div className="text-xs font-normal text-slate-500">{formatCoaTrendPercent(entry.sharePercent, 1)} ของทั้งหมด</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.max(6, Math.min(100, entry.sharePercent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {topCoaRequestTrend && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950">
                    <div className="font-semibold">ยาที่ถูกขอมากที่สุด</div>
                    <div className="mt-2 text-lg font-bold">{topCoaRequestTrend.commonName}</div>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-indigo-700">ความถี่ที่ขอ</dt>
                        <dd className="font-semibold">{topCoaRequestTrend.requestCount} ครั้ง</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-indigo-700">%AI ฉลาก</dt>
                        <dd className="font-semibold">{formatCoaTrendPercent(topCoaRequestTrend.labelAiPercent)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-indigo-700">%AI เฉลี่ย</dt>
                        <dd className="font-semibold">{formatCoaTrendPercent(topCoaRequestTrend.averageAiPercent, 4)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border border-sky-100 bg-white/90 p-4 shadow-sm">
            {activeTab !== "all" && (
              <div className="mb-5 flex flex-wrap gap-x-[5cm] gap-y-3">
              {years.map((year) => {
                const selected = selectedYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    aria-label={`ปี ${year}`}
                    aria-pressed={selected}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                      selected
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                    onClick={() => setActiveYear(year)}
                  >
                    {year}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-white/20 text-white" : "bg-white text-sky-600"}`}>
                      {items.filter((doc) => documentYear(doc) === year).length}
                    </span>
                  </button>
                );
              })}
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const selected = activeTab === tab.key;
                const tone = tabToneClasses[tab.tone];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={selected}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors ${tone.button} ${selected ? tone.selected : "opacity-80"}`}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setOpenAllYear(null);
                      if (tab.key === "all") setActiveWorkflowStage("all");
                    }}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${tone.count}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {showWorkflowTabs && (
              <div className="mb-4 flex flex-wrap gap-2">
              {workflowTabs.map((tab) => {
                const selected = activeWorkflowStage === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-label={`สถานะ ${tab.label}`}
                    aria-pressed={selected}
                    className={`inline-flex min-h-12 items-center gap-3 rounded-lg px-5 py-2.5 text-base font-semibold transition-colors ${tab.className} ${selected ? tab.activeClassName : "opacity-80"}`}
                    onClick={() => setActiveWorkflowStage(tab.key)}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2.5 py-1 text-sm ${tab.countClassName}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
              </div>
            )}
            <Input
              className="max-w-sm border-sky-100 bg-white text-sky-950 placeholder:text-sky-400 focus-visible:ring-sky-300"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหา COA / คำร้อง"
            />
          </div>

          {showAllYearFolders && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allFolderYears.map((year) => {
                const count = items.filter((doc) => documentYear(doc) === year).length;
                const beYear = buddhistYear(year);
                return (
                  <button
                    key={year}
                    type="button"
                    aria-label={`แฟ้มปี ${beYear}`}
                    className="flex min-h-28 items-center gap-4 rounded-md border border-sky-100 bg-white/90 p-4 text-left shadow-sm transition-colors hover:bg-sky-100/70"
                    onClick={() => setOpenAllYear(year)}
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                      <Folder className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-sky-950">แฟ้มปี {beYear}</span>
                      <span className="mt-1 block text-sm text-sky-700">{count} รายการ</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!showAllYearFolders && (
            <div className="overflow-x-auto rounded-md border border-sky-100 bg-white/90 shadow-sm">
              {activeTab === "all" && openAllYear && (
                <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
                  <div className="font-semibold text-sky-950">แฟ้มปี {buddhistYear(openAllYear)}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenAllYear(null)}>
                    กลับไปแฟ้มปี
                  </Button>
                </div>
              )}
            <table className="w-full text-sm">
              <thead className="bg-sky-50 text-left text-xs font-semibold text-sky-900">
                <tr>
                  {showDocumentColumn && <th className="px-4 py-3">Document No</th>}
                  <th className="px-4 py-3">COA No</th>
                  {showCustomerColumn && <th className="px-4 py-3">ชื่อลูกค้า</th>}
                  <th className="px-4 py-3">ชื่อการค้า</th>
                  {showCompanyColumn && <th className="px-4 py-3">ชื่อลูกค้า</th>}
                  {showCommonNameColumn && <th className="px-4 py-3">ชื่อสามัญ</th>}
                  {showLotColumn && <th className="px-4 py-3">LOT No. (แบช+วันที่ผลิต)</th>}
                  {showStatusColumn && <th className="px-4 py-3">สถานะ</th>}
                  {showCommandColumn && <th className="px-4 py-3">คำสั่ง</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-50">
                {isLoading && (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sky-500">กำลังโหลด...</td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-sky-500">ยังไม่มีเอกสาร COA</td>
                  </tr>
                )}
                {rows.map((doc) => (
                  <tr
                    key={doc._id}
                    className="cursor-pointer text-slate-700 transition-colors hover:bg-sky-50/80"
                    onClick={() => {
                      if (isDemoCoaDocument(doc)) {
                        setPreviewDoc(doc);
                        return;
                      }
                      navigate(`/coa/${doc._id}`);
                    }}
                  >
                    {showDocumentColumn && (
                      <td className="px-4 py-3 font-semibold text-sky-950">{doc.petitionNoSnapshot || "-"}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span>{doc.coaNo || "ร่าง"}</span>
                        {needsCoaCorrection(doc) && (
                          <Badge variant="purple-soft">ต้องแก้ไขข้อมูลใหม่</Badge>
                        )}
                      </div>
                    </td>
                    {showCustomerColumn && <td className="px-4 py-3">{customerName(doc)}</td>}
                    <td className="px-4 py-3">{joinValues(doc.sampleSnapshots?.map((sample) => sample.sampleName))}</td>
                    {showCompanyColumn && <td className="px-4 py-3">{customerName(doc)}</td>}
                    {showCommonNameColumn && <td className="px-4 py-3">{joinValues(doc.sampleSnapshots?.map((sample) => sample.commonName))}</td>}
                    {showLotColumn && <td className="px-4 py-3">{joinValues(doc.sampleSnapshots?.map(lotLabel))}</td>}
                    {showStatusColumn && (
                      <td className="px-4 py-3">
                        <Badge variant={workflowStageBadgeVariantFor(workflowStageFor(doc))}>
                          {workflowStageLabels[workflowStageFor(doc)]}
                        </Badge>
                        {showCreateActions && workflowStageFor(doc) === "requested" && (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-2 gap-2 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                            aria-label={`สร้าง COA ${doc.petitionNoSnapshot || doc._id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCreate(doc);
                            }}
                          >
                            <FilePlus2 className="h-4 w-4" />
                            สร้าง COA
                          </Button>
                        )}
                      </td>
                    )}
                    {showCreateActions && (
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                          aria-label={`สร้าง COA ${doc.petitionNoSnapshot || doc._id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCreate(doc);
                          }}
                        >
                          <FilePlus2 className="h-4 w-4" />
                          สร้าง COA
                        </Button>
                      </td>
                    )}
                    {showPrintActions && (
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 border-sky-200 text-sky-700 hover:bg-sky-50"
                          disabled={!canPrintCoa(doc.status)}
                          aria-label={`พิมพ์ COA ${doc.coaNo || doc.petitionNoSnapshot || doc._id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/coa/${doc._id}?print=1`);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                          พิมพ์
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-2 border-sky-200 text-sky-700 hover:bg-sky-50"
                          disabled={!canPrintCoa(doc.status)}
                          aria-label={`บันทึกไฟล์ PDF COA ${doc.coaNo || doc.petitionNoSnapshot || doc._id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/coa/${doc._id}?pdf=1`);
                          }}
                        >
                          <FileDown className="h-4 w-4" />
                          บันทึกไฟล์ PDF
                        </Button>
                      </td>
                    )}
                    {showApprovalActions && (
                      <td className="px-4 py-3">
                        {isQcHead ? (
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-sky-200 text-sky-700 hover:bg-sky-50"
                              aria-label={`เปิดดูไฟล์ COA ${coaDisplayNo(doc)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewDoc(doc);
                              }}
                            >
                              เปิดดูไฟล์
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-2 bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                              disabled={approve.isPending || reject.isPending}
                              aria-label={`QC Head อนุมัติ COA ${coaDisplayNo(doc)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleApprove(doc);
                              }}
                            >
                              QC Head อนุมัติ
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={approve.isPending || reject.isPending}
                              aria-label={`ไม่อนุมัติ COA ${coaDisplayNo(doc)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReject(doc);
                              }}
                            >
                              ไม่อนุมัติ
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-sky-200 text-sky-700 hover:bg-sky-50"
                            aria-label={`ดู COA รออนุมัติ ${coaDisplayNo(doc)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isDemoCoaDocument(doc)) {
                                setPreviewDoc(doc);
                                return;
                              }
                              navigate(`/coa/${doc._id}`);
                            }}
                          >
                            ดูรายละเอียด
                          </Button>
                        )}
                      </td>
                    )}
                    {showEditActions && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-sky-200 text-sky-700 hover:bg-sky-50"
                            aria-label={`เปิดดูไฟล์ COA ${coaDisplayNo(doc)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewDoc(doc);
                            }}
                          >
                            เปิดดูไฟล์
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 border-sky-200 text-sky-700 hover:bg-sky-50"
                            aria-label={`แก้ไข COA ${coaDisplayNo(doc)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEdit(doc);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            แก้ไข
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                            disabled={submit.isPending}
                            aria-label={`เสร็จสิ้น COA ${coaDisplayNo(doc)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSubmit(doc);
                            }}
                          >
                            เสร็จสิ้น
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
      <Dialog open={Boolean(demoEditDoc)} onOpenChange={(open) => {
        if (!open) setDemoEditDoc(null);
      }}>
        <DialogContent className="border-sky-100 bg-sky-50 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sky-950">แก้ไขฟอร์ม COA จำลอง</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-coa-sample-name">ชื่อการค้า</Label>
              <Input
                id="demo-coa-sample-name"
                value={demoEditForm.sampleName}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, sampleName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-common-name">ชื่อสามัญ</Label>
              <Input
                id="demo-coa-common-name"
                value={demoEditForm.commonName}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, commonName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-lot-no">LOT No.</Label>
              <Input
                id="demo-coa-lot-no"
                value={demoEditForm.lotNo}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, lotNo: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-batch-no">Batch No.</Label>
              <Input
                id="demo-coa-batch-no"
                value={demoEditForm.batchNo}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, batchNo: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-production-date">วันที่ผลิต</Label>
              <Input
                id="demo-coa-production-date"
                type="date"
                value={demoEditForm.productionDate}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, productionDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-ai-content">%AI content (W/W)</Label>
              <Input
                id="demo-coa-ai-content"
                value={demoEditForm.aiContentResult}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, aiContentResult: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-wax-size">Wax block size</Label>
              <Input
                id="demo-coa-wax-size"
                value={demoEditForm.waxBlockSizeResult}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, waxBlockSizeResult: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-coa-analysis-date">Date of analysis</Label>
              <Input
                id="demo-coa-analysis-date"
                type="date"
                value={demoEditForm.dateOfAnalysis}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, dateOfAnalysis: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="demo-coa-remark">หมายเหตุ</Label>
              <Textarea
                id="demo-coa-remark"
                value={demoEditForm.remark}
                onChange={(event) => setDemoEditForm((form) => ({ ...form, remark: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDemoEditDoc(null)}>ยกเลิก</Button>
            <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" onClick={handleSaveDemoEdit}>บันทึกฟอร์ม</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PrintPreviewDialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        docType="coa"
        css={COA_REPORT_CSS}
        previewOnly
      >
        <CoaReportTemplate pages={previewPages} />
      </PrintPreviewDialog>
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
    </AppLayout>
  );
}
