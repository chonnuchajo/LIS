import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Flame, ShieldCheck, UserX, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { highlightPath, type ExecSummary } from "@/lib/execSummary";

type Counts = ExecSummary["live"]["counts"];

interface Props {
  counts: Counts;
  overdueIds: string[];
  atRiskIds?: string[];
  waitingHeadIds?: string[];
  urgentIds?: string[];
  abnormalIds?: string[];
  unassignedIds?: string[];
}

const TONE: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

function Tile({ label, value, icon: Icon, tone, to }: {
  label: string; value: number; icon: LucideIcon; tone: keyof typeof TONE; to: string;
}) {
  return (
    <Link to={to} className="flex-1 min-w-[140px]">
      <Card className={cn("flex items-center gap-3 border p-3 transition hover:shadow-md", TONE[tone])}>
        <Icon className="h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="truncate text-xs">{label}</div>
        </div>
      </Card>
    </Link>
  );
}

export default function AlertStrip({
  counts, overdueIds, atRiskIds = [], waitingHeadIds = [],
  urgentIds = [], abnormalIds = [], unassignedIds = [],
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <Tile label="งานด่วน" value={counts.urgent} icon={Flame} tone="red" to={highlightPath(urgentIds)} />
      <Tile label="เกินเวลา" value={counts.overdue} icon={Clock} tone="red" to={highlightPath(overdueIds)} />
      <Tile label="เสี่ยงเลท" value={counts.atRisk} icon={Activity} tone="amber" to={highlightPath(atRiskIds)} />
      <Tile label="ยังไม่ assign" value={counts.unassigned} icon={UserX} tone="amber" to={highlightPath(unassignedIds)} />
      <Tile label="รอมือหัวหน้า" value={counts.waitingHead} icon={ShieldCheck} tone="blue" to={highlightPath(waitingHeadIds)} />
      <Tile label="ผลผิดปกติ" value={counts.abnormal} icon={AlertTriangle} tone="red" to={highlightPath(abnormalIds)} />
    </div>
  );
}
