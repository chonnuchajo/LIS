import { useMemo, useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileCheck2, FileDown, FilePlus2, Folder, Pencil, Printer } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CoaCreateDialog from "@/components/coa/CoaCreateDialog";
import { api } from "@/lib/api";
import { canPrintCoa } from "@/lib/coaStatus";
import type { CoaDocument, CoaSampleSnapshot } from "@/types/coa.types";

type CoaTab = "today" | "all";
type CoaTabTone = "sky" | "emerald";
type CoaWorkflowStage = "all" | "requested" | "inProgress" | "pendingApproval" | "approved";

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

function workflowStageFor(doc: CoaDocument): Exclude<CoaWorkflowStage, "all"> {
  if (doc.status === "requested") return "requested";
  if (doc.status === "pendingApproval" || doc.status === "pendingRevisionApproval") return "pendingApproval";
  if (doc.status === "approved" || doc.status === "printed" || doc.status === "reissued") return "approved";
  return "inProgress";
}

const workflowStageLabels: Record<Exclude<CoaWorkflowStage, "all">, string> = {
  requested: "ขอ COA",
  inProgress: "ดำเนินการแล้ว",
  pendingApproval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
};

const workflowStageBadgeVariants: Record<Exclude<CoaWorkflowStage, "all" | "requested">, ComponentProps<typeof Badge>["variant"]> = {
  inProgress: "blue-soft",
  pendingApproval: "yellow-soft",
  approved: "green-soft",
};

const workflowStageBadgeVariantFor = (stage: Exclude<CoaWorkflowStage, "all">): ComponentProps<typeof Badge>["variant"] => (
  stage === "requested" ? "blue-soft" : workflowStageBadgeVariants[stage]
);

export default function CoaCenterPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CoaTab>("today");
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<CoaWorkflowStage>("all");
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [openAllYear, setOpenAllYear] = useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["coa", "documents"], queryFn: () => api.getCoaDocuments() });

  const items = useMemo(() => data?.items ?? [], [data]);
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
  const showInProgressReviewColumns = showEditActions;
  const showWorkflowTabs = activeTab !== "all";
  const showApprovedCommandColumns = showPrintActions;
  const showPendingApprovalColumns = activeTab !== "all" && activeWorkflowStage === "pendingApproval";
  const showDocumentColumn = !showInProgressReviewColumns && !showApprovedCommandColumns && !showPendingApprovalColumns;
  const showCustomerColumn = !showInProgressReviewColumns && !showApprovedCommandColumns && !showPendingApprovalColumns;
  const showCompanyColumn = showApprovedCommandColumns;
  const showCommonNameColumn = !showApprovedCommandColumns;
  const showLotColumn = !showApprovedCommandColumns;
  const showStatusColumn = activeTab !== "all" && !showInProgressReviewColumns && !showCreateActions && !showApprovedCommandColumns;
  const showCommandColumn = showPrintActions || showCreateActions || showEditActions;
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
      <div className="min-h-[calc(100vh-64px)] bg-sky-50 p-6">
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
                    onClick={() => navigate(`/coa/${doc._id}`)}
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
                              setCreateOpen(true);
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
                            setCreateOpen(true);
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
                    {showEditActions && (
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                          aria-label={`แก้ไข COA ${doc.coaNo || doc.petitionNoSnapshot || doc._id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/coa/${doc._id}`);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          แก้ไข
                        </Button>
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
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/coa/${id}`)} />
    </AppLayout>
  );
}
