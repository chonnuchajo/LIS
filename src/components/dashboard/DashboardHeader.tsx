import { useAuth } from "@/context/AuthContext";
import { formatThaiDate, currentShift } from "@/lib/dateShift";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download } from "lucide-react";
import type { NavItem } from "@/lib/navItems";
import DashboardNavMenu from "./DashboardNavMenu";

export type DashRange = "today" | "7d" | "30d";
const RANGE_LABEL: Record<DashRange, string> = { today: "วันนี้", "7d": "7 วัน", "30d": "30 วัน" };

interface Props {
  titleEn: string;
  subtitleTh: string;
  range: DashRange;
  onRangeChange: (r: DashRange) => void;
  onRefresh: () => void;
  onExport: () => void;
  navItems?: NavItem[];
}

export default function DashboardHeader({
  titleEn, subtitleTh, range, onRangeChange, onRefresh, onExport, navItems = [],
}: Props) {
  const { user } = useAuth();
  const now = new Date();

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{titleEn}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatThaiDate(now)} · <span className="font-medium text-foreground/80">{currentShift(now)}</span>
          {user?.department ? <> · แผนก {user.department}</> : null}
          {subtitleTh ? <> · {subtitleTh}</> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => onRangeChange(v as DashRange)}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABEL) as DashRange[]).map((r) => (
              <SelectItem key={r} value={r}>{RANGE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onRefresh} aria-label="รีเฟรช">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <DashboardNavMenu items={navItems} />
      </div>
    </div>
  );
}
