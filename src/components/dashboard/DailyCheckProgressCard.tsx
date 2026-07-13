import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DailyCheckProgressCardProps {
  done: number;
  pending: number;
  total: number;
  loading?: boolean;
}

export default function DailyCheckProgressCard({ done, pending, total, loading = false }: DailyCheckProgressCardProps) {
  const navigate = useNavigate();
  const complete = !loading && pending === 0 && total > 0;
  const percent = !loading && total > 0 ? Math.round((done / total) * 100) : 0;
  const pendingLabel = loading ? "..." : pending;
  const doneLabel = loading ? "..." : done;
  const totalLabel = loading ? "..." : total;
  const pendingTone = complete ? "text-lis-stat-green-icon" : "text-lis-stat-amber-icon";

  return (
    <Card
      onOpen={() => navigate("/daily-check")}
      aria-label={
        loading
          ? "Daily Check กำลังโหลดข้อมูล"
          : `Daily Check ยังไม่ได้ทำ ${pending} รายการ ทำแล้ว ${done} จาก ${total} รายการ`
      }
      className={cn(
        "group relative md:col-span-2 w-full overflow-hidden rounded-xl border-border/70 bg-card p-4 text-left",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-22px_rgba(15,23,42,0.32)]",
        "transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)]",
        "before:absolute before:inset-x-0 before:top-0 before:h-1",
        complete
          ? "before:bg-lis-stat-green-icon"
          : "before:bg-gradient-to-r before:from-lis-stat-amber-icon before:via-primary before:to-lis-stat-green-icon",
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                complete ? "bg-lis-stat-green" : "bg-lis-stat-amber",
              )}
            >
              <Scale className={cn("h-4 w-4", complete ? "text-lis-stat-green-icon" : "text-lis-stat-amber-icon")} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Daily Check</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">วันนี้</p>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-2">
            <p className={cn("text-4xl font-bold leading-none tracking-tight tabular-nums", pendingTone)}>
              {pendingLabel}
            </p>
            <div className="pb-1.5">
              <p className="text-sm font-medium leading-none text-foreground">ยังไม่ได้ทำ</p>
              <p className="mt-1 text-xs leading-none text-muted-foreground">ทำแล้ว {doneLabel}/{totalLabel}</p>
            </div>
          </div>
        </div>

        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 42 42" className="-rotate-90">
            <circle
              cx="21"
              cy="21"
              r="17"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="4"
              pathLength="100"
            />
            <circle
              cx="21"
              cy="21"
              r="17"
              fill="none"
              stroke={complete ? "hsl(var(--lis-stat-green-icon))" : "hsl(var(--lis-stat-amber-icon))"}
              strokeDasharray={`${percent} 100`}
              strokeLinecap="round"
              strokeWidth="4"
              pathLength="100"
            />
          </svg>
          <span className="absolute text-sm font-semibold tabular-nums text-foreground">
            {loading ? "..." : `${percent}%`}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5 text-lis-stat-amber-icon" />
          <div className="min-w-0">
            <p className="text-xs leading-none text-muted-foreground">ค้าง</p>
            <p className="mt-1 text-sm font-semibold leading-none tabular-nums text-foreground">{pendingLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-lis-stat-green-icon" />
          <div className="min-w-0">
            <p className="text-xs leading-none text-muted-foreground">เสร็จแล้ว</p>
            <p className="mt-1 text-sm font-semibold leading-none tabular-nums text-foreground">{doneLabel}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
