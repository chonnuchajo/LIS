import { useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileCheck2, FileDown, FilePlus2, Folder, Pencil, Printer } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
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
import { canPrintCoa } from "@/lib/coaStatus";
import { normalizeRoles, primaryRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { CoaDocument, CoaSampleSnapshot } from "@/types/coa.types";

type CoaTab = "today" | "all";
type CoaTabTone = "sky" | "emerald";
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
  pendingApproval: "yellow-soft",
  approved: "green-soft",
};

const workflowStageBadgeVariantFor = (stage: CoaDocumentStage): ComponentProps<typeof Badge>["variant"] => (
  stage === "requested" ? "blue-soft" : workflowStageBadgeVariants[stage]
);

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

  const tabs: Array<{ key: CoaTab; label: string; count: number; tone: CoaTabTone }> = [
    { key: "today", label: "คำขอ COA วันนี้", count: todayCount, tone: "sky" },
    { key: "all", label: "คำขอ COA ทั้งหมด", count: yearItems.length, tone: "emerald" },
  ];
  const tabToneClasses: Record<CoaTabTone, { button: string; selected: string; count: string }> = {
    sky: {
      button: "bg-sky-100 text-sky-800 hover:bg-sky-200",
      selected: "ring-2 ring-sky-300 shadow-sm",
      count: "bg-sky-50 text-sky-700",
    },
    emerald: {
      button: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
      selected: "ring-2 ring-emerald-300 shadow-sm",
      count: "bg-emerald-50 text-emerald-700",
    },
  };
  const workflowTabs: Array<{ key: CoaWorkflowStage; label: string; count: number; className: string; activeClassName: string; countClassName: string }> = [
    { key: "all", label: "ทุกสถานะ", count: yearItems.length, className: "bg-slate-100 text-slate-700 hover:bg-slate-200", activeClassName: "ring-2 ring-slate-300 shadow-sm", countClassName: "bg-white text-slate-600" },
    { key: "requested", label: workflowStageLabels.requested, count: workflowCounts.requested, className: "bg-sky-100 text-sky-800 hover:bg-sky-200", activeClassName: "ring-2 ring-sky-300 shadow-sm", countClassName: "bg-sky-50 text-sky-700" },
    { key: "inProgress", label: workflowStageLabels.inProgress, count: workflowCounts.inProgress, className: "bg-blue-100 text-blue-800 hover:bg-blue-200", activeClassName: "ring-2 ring-blue-300 shadow-sm", countClassName: "bg-blue-50 text-blue-700" },
    { key: "pendingApproval", label: workflowStageLabels.pendingApproval, count: workflowCounts.pendingApproval, className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200", activeClassName: "ring-2 ring-yellow-300 shadow-sm", countClassName: "bg-yellow-50 text-yellow-700" },
    { key: "approved", label: workflowStageLabels.approved, count: workflowCounts.approved, className: "bg-green-100 text-green-800 hover:bg-green-200", activeClassName: "ring-2 ring-green-300 shadow-sm", countClassName: "bg-green-50 text-green-700" },
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
  const isApprovedWorkflowPage = activeTab !== "all" && activeWorkflowStage === "approved";
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
      <div
        data-testid="coa-center-page"
        className={cn(
          "min-h-[calc(100vh-64px)] p-6",
          isApprovedWorkflowPage ? "bg-green-50" : "bg-sky-50",
        )}
      >
        <div className="space-y-5">
          <PageHeader
            title={(
              <span className="inline-flex items-center gap-2 text-violet-950">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                ออกเอกสาร COA
              </span>
            )}
          />

          {demoCoaEnabled && (
            <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                <Badge variant="green-soft">โหมดจำลอง</Badge>
                <span>COA BROMADIOLONE 0.005% พร้อมทดสอบในแท็บขอ COA</span>
              </div>
              <p className="mt-1 text-emerald-700">กดสร้าง COA → เสร็จสิ้น → QC Head อนุมัติ เพื่อส่งไปหน้าอนุมัติแล้วและแฟ้มปี 2569</p>
            </div>
          )}

          <div className="rounded-md border border-violet-100 bg-white p-4 shadow-sm">
            {activeTab !== "all" && (
              <div className="mb-4 flex flex-wrap gap-2">
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
                        ? "bg-violet-700 text-white shadow-sm"
                        : "bg-violet-50 text-violet-700 hover:bg-violet-100"
                    }`}
                    onClick={() => setActiveYear(year)}
                  >
                    {year}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-white/20 text-white" : "bg-white text-violet-600"}`}>
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
                    className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors ${tab.className} ${selected ? tab.activeClassName : "opacity-80"}`}
                    onClick={() => setActiveWorkflowStage(tab.key)}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${tab.countClassName}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
              </div>
            )}
            <Input
              className="max-w-sm border-violet-100 bg-white text-violet-950 placeholder:text-violet-400 focus-visible:ring-violet-300"
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
                    className="flex min-h-28 items-center gap-4 rounded-md border border-emerald-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-emerald-50"
                    onClick={() => setOpenAllYear(year)}
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                      <Folder className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-emerald-900">แฟ้มปี {beYear}</span>
                      <span className="mt-1 block text-sm text-emerald-700">{count} รายการ</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!showAllYearFolders && (
            <div className="overflow-x-auto rounded-md border border-violet-100 bg-white shadow-sm">
              {activeTab === "all" && openAllYear && (
                <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3">
                  <div className="font-semibold text-violet-950">แฟ้มปี {buddhistYear(openAllYear)}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenAllYear(null)}>
                    กลับไปแฟ้มปี
                  </Button>
                </div>
              )}
            <table className="w-full text-sm">
              <thead className="bg-violet-50 text-left text-xs font-semibold text-violet-900">
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
              <tbody className="divide-y divide-violet-50">
                {isLoading && (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-violet-500">กำลังโหลด...</td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={tableColumnCount} className="px-4 py-10 text-center text-violet-500">ยังไม่มีเอกสาร COA</td>
                  </tr>
                )}
                {rows.map((doc) => (
                  <tr
                    key={doc._id}
                    className="cursor-pointer text-slate-700 transition-colors hover:bg-emerald-50/70"
                    onClick={() => {
                      if (isDemoCoaDocument(doc)) {
                        setPreviewDoc(doc);
                        return;
                      }
                      navigate(`/coa/${doc._id}`);
                    }}
                  >
                    {showDocumentColumn && (
                      <td className="px-4 py-3 font-semibold text-violet-950">{doc.petitionNoSnapshot || "-"}</td>
                    )}
                    <td className="px-4 py-3">{doc.coaNo || "ร่าง"}</td>
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
                            className="mt-2 gap-2 bg-violet-700 text-white shadow-sm hover:bg-violet-800"
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
                          className="gap-2 bg-violet-700 text-white shadow-sm hover:bg-violet-800"
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
                          className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
                              className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
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
                              className="gap-2 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
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
                            className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
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
                            className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
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
                            className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
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
        <DialogContent className="border-violet-100 bg-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-violet-950">แก้ไขฟอร์ม COA จำลอง</DialogTitle>
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
            <Button type="button" className="bg-violet-700 text-white hover:bg-violet-800" onClick={handleSaveDemoEdit}>บันทึกฟอร์ม</Button>
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
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/coa/${id}`)} />
    </AppLayout>
  );
}
