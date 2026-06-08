import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FlaskConical,
  Hourglass,
  Search,
} from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import StatCard from "@/components/lis/StatCard";
import WaitingSamplesCard from "@/components/lis/WaitingSamplesCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { usePetitionList } from "@/hooks/usePetition";
import type { Petition, PetitionStatus } from "@/types/petition.types";
import { toast } from "sonner";

const LAB_STATUSES: PetitionStatus[] = ["sampleSent", "pendingReview", "inProgress"];
const LAB_BATCH_LAST_DIGITS = new Set(["1", "6"]);
const COMPLETED_OPEN_KEY = "lab.completed.open";
const SHIFT_SWITCH_HOUR = 12;

type KpiKey = "all" | "waiting" | "inProgress" | "completed";

const isLabBatchNo = (batchNo?: string | null) => {
  const trimmed = String(batchNo ?? "").trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
};

const hasLabItem = (petition: Petition) =>
  petition.items.some((item) => isLabBatchNo(item.batchNo));

const onlyLabPetitions = (petitions: Petition[]) => petitions.filter(hasLabItem);

export default function LabDashboard() {
  const navigate = useNavigate();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const labPetitions = onlyLabPetitions(allPetitions.filter((petition) => LAB_STATUSES.includes(petition.status)));
  const completedPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "success"),
  );
  const waitingReceivePetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "sampleSent"),
  );
  const inProgressPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "pendingReview" || petition.status === "inProgress"),
  );
  const labTotal = labPetitions.length + completedPetitions.length;

  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleKpi = (key: KpiKey) => setActiveKpi((current) => (current === key ? null : key));

  const kpiSourceMap: Record<KpiKey, Petition[]> = {
    all: labPetitions,
    waiting: waitingReceivePetitions,
    inProgress: inProgressPetitions,
    completed: completedPetitions,
  };

  const primarySource = activeKpi ? kpiSourceMap[activeKpi] : labPetitions;

  const filteredPrimary = useMemo(() => {
    return primarySource.filter((p) => {
      if (query.trim() && !p.petitionNo.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [primarySource, query]);

  // Header meta
  const now = new Date();
  const formattedDate = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const shiftLabel = now.getHours() < SHIFT_SWITCH_HOUR ? "กะเช้า" : "กะบ่าย";

  // Completed collapsible state — persist in localStorage
  const [completedOpen, setCompletedOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COMPLETED_OPEN_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COMPLETED_OPEN_KEY, completedOpen ? "1" : "0");
  }, [completedOpen]);
  const completedLatest = completedPetitions[0]?.completedAt ?? completedPetitions[0]?.updatedAt;

  // Keyboard shortcuts: n, /, Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping && e.key !== "Escape") return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        navigate("/petitions/new");
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (query) setQuery("");
        if (activeKpi) setActiveKpi(null);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, query, activeKpi]);

  // Primary table title reflects active KPI
  const primaryTitle = (() => {
    switch (activeKpi) {
      case "waiting": return "ตัวอย่างที่รอรับเข้าระบบ";
      case "inProgress": return "กำลังดำเนินการ";
      case "completed": return "ตรวจเสร็จแล้ว";
      default: return "คำร้องสำหรับ Lab";
    }
  })();

  return (
    <AppLayout>
      {/* === Header === */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Lab Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formattedDate} · <span className="font-medium text-foreground/80">{shiftLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขคำร้อง..."
              className="h-9 pl-8 pr-12 w-full sm:w-56 text-sm"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">/</kbd>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success("กำลังส่งออกรายงาน Lab...")}>
            <Download className="w-4 h-4" /> <span className="hidden md:inline">ส่งออก</span>
          </Button>
        </div>
      </div>

      {/* === KPI Strip === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ClipboardList}
          value={labTotal}
          label="งานทั้งหมดใน Lab"
          variant="neutral"
          sublabel={`รวมงานเสร็จแล้ว ${completedPetitions.length}`}
          active={activeKpi === "all"}
          onClick={() => toggleKpi("all")}
        />
        <StatCard
          icon={Hourglass}
          value={waitingReceivePetitions.length}
          label="รอรับเข้าระบบ"
          variant="amber"
          active={activeKpi === "waiting"}
          onClick={() => toggleKpi("waiting")}
        />
        <StatCard
          icon={Activity}
          value={inProgressPetitions.length}
          label="กำลังดำเนินการ"
          variant="blue"
          active={activeKpi === "inProgress"}
          onClick={() => toggleKpi("inProgress")}
        />
        <StatCard
          icon={CheckCircle2}
          value={completedPetitions.length}
          label="ตรวจเสร็จแล้ว"
          variant="green"
          active={activeKpi === "completed"}
          onClick={() => toggleKpi("completed")}
        />
      </div>

      {/* === Main grid: primary table + right rail === */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 mb-4">
        <PetitionDashboardTable
          title={primaryTitle}
          petitions={filteredPrimary}
          loading={petitionLoading}
          actionPathPrefix="/lab-testing"
          viewAllPath="/lab-testing"
          unreceivedListPath="/lab-testing"
          emptyText={
            activeKpi || query
              ? "ไม่พบคำร้องตามเงื่อนไข"
              : "ยังไม่มีคำร้องที่รอ Lab ดำเนินการ"
          }
        />

        <WaitingSamplesCard petitions={waitingReceivePetitions} />
      </div>

      {/* === Completed collapsible === */}
      <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06)]">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-lis-stat-green text-lis-stat-green-icon">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">ตรวจเสร็จแล้ววันนี้</p>
                  <p className="text-xs text-muted-foreground">
                    {completedPetitions.length} รายการ
                    {completedLatest ? ` · ล่าสุด ${new Date(completedLatest).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
              </div>
              {completedOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border p-3">
              <PetitionDashboardTable
                title=""
                petitions={completedPetitions}
                loading={petitionLoading}
                actionPathPrefix="/lab-testing"
                viewAllPath="/lab-testing"
                emptyText="ยังไม่มีคำร้องที่ตรวจเสร็จแล้ว"
                maxHeight="400px"
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </AppLayout>
  );
}
