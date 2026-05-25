import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Hourglass,
  Search,
  ShieldCheck,
} from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PendingQcSamplesCard from "@/components/lis/PendingQcSamplesCard";
import PetitionDashboardTable from "@/components/lis/PetitionDashboardTable";
import StatCard from "@/components/lis/StatCard";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import type { Petition, PetitionStatus } from "@/types/petition.types";
import { toast } from "sonner";

const PENDING_RECEIVE_STATUSES: PetitionStatus[] = ["sampleSent"];
const IN_PROGRESS_STATUSES: PetitionStatus[] = ["pendingReview", "inProgress"];
const COMPLETED_STATUSES: PetitionStatus[] = ["success"];
const QUEUE_STATUSES: PetitionStatus[] = [...PENDING_RECEIVE_STATUSES, ...IN_PROGRESS_STATUSES];
const COMPLETED_OPEN_KEY = "qc.completed.open";
const SHIFT_SWITCH_HOUR = 12;

type KpiKey = "all" | "waiting" | "inProgress" | "completed";

export default function QCDashboard() {
  const navigate = useNavigate();
  const { doneSamples, approvals } = useSamples();
  const { data: petitionData, loading: petitionLoading } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];

  const pendingReceivePetitions = allPetitions.filter((p) => PENDING_RECEIVE_STATUSES.includes(p.status));
  const inProgressPetitions = allPetitions.filter((p) => IN_PROGRESS_STATUSES.includes(p.status));
  const completedPetitions = allPetitions.filter((p) => COMPLETED_STATUSES.includes(p.status));
  const queuePetitions = allPetitions.filter((p) => QUEUE_STATUSES.includes(p.status));
  const trackedTotal = queuePetitions.length + completedPetitions.length;

  const pendingQcSamples = doneSamples.filter(
    (sample) => !approvals[sample.id]?.qcStatus || approvals[sample.id]?.qcStatus === "pending",
  );

  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleKpi = (key: KpiKey) => setActiveKpi((current) => (current === key ? null : key));

  const kpiSourceMap: Record<KpiKey, Petition[]> = {
    all: queuePetitions,
    waiting: pendingReceivePetitions,
    inProgress: inProgressPetitions,
    completed: completedPetitions,
  };
  const primarySource = activeKpi ? kpiSourceMap[activeKpi] : queuePetitions;

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

  // Completed collapsible — persist in localStorage
  const [completedOpen, setCompletedOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COMPLETED_OPEN_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COMPLETED_OPEN_KEY, completedOpen ? "1" : "0");
  }, [completedOpen]);
  const completedLatest = completedPetitions[0]?.completedAt ?? completedPetitions[0]?.updatedAt;

  // Keyboard shortcuts: /, Esc (no `n` — QC doesn't create petitions)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping && e.key !== "Escape") return;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
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
  }, [query, activeKpi]);

  // Primary table title reflects active KPI
  const primaryTitle = (() => {
    switch (activeKpi) {
      case "waiting": return "รอรับเข้าระบบ";
      case "inProgress": return "กำลังดำเนินการ";
      case "completed": return "ตรวจเสร็จแล้ว";
      default: return "คำร้องที่ QC ต้องติดตาม";
    }
  })();

  return (
    <AppLayout>
      {/* === Header === */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">QC Dashboard</h1>
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success("กำลังส่งออกรายงาน QC...")}>
            <Download className="w-4 h-4" /> <span className="hidden md:inline">ส่งออก</span>
          </Button>
        </div>
      </div>

      {/* === KPI Strip === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ClipboardList}
          value={trackedTotal}
          label="คำร้องที่ QC ติดตาม"
          variant="neutral"
          sublabel={`รวมงานเสร็จแล้ว ${completedPetitions.length}`}
          active={activeKpi === "all"}
          onClick={() => toggleKpi("all")}
        />
        <StatCard
          icon={Hourglass}
          value={pendingReceivePetitions.length}
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
          emptyText={
            activeKpi || query
              ? "ไม่พบคำร้องตามเงื่อนไข"
              : "ยังไม่มีคำร้องที่ QC ต้องติดตาม"
          }
          viewAllPath="/qc-testing"
          actionPathPrefix="/qc-testing"
        />

        <PendingQcSamplesCard samples={pendingQcSamples} />
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
                emptyText="ยังไม่มีคำร้องที่ตรวจเสร็จแล้ว"
                viewAllPath="/qc-testing"
                actionPathPrefix="/qc-testing"
                maxHeight="400px"
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </AppLayout>
  );
}
