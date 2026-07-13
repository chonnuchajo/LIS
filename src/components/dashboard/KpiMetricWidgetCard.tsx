import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatVariant } from "@/lib/dashboardProfiles";

interface KpiMetricWidgetCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant: StatVariant;
  sublabel?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

const variantClasses: Record<StatVariant, { line: string; iconBg: string; iconFg: string; value: string }> = {
  blue: {
    line: "before:bg-lis-stat-blue-icon",
    iconBg: "bg-lis-stat-blue",
    iconFg: "text-lis-stat-blue-icon",
    value: "text-lis-stat-blue-icon",
  },
  amber: {
    line: "before:bg-lis-stat-amber-icon",
    iconBg: "bg-lis-stat-amber",
    iconFg: "text-lis-stat-amber-icon",
    value: "text-lis-stat-amber-icon",
  },
  green: {
    line: "before:bg-lis-stat-green-icon",
    iconBg: "bg-lis-stat-green",
    iconFg: "text-lis-stat-green-icon",
    value: "text-lis-stat-green-icon",
  },
  red: {
    line: "before:bg-lis-stat-red-icon",
    iconBg: "bg-lis-stat-red",
    iconFg: "text-lis-stat-red-icon",
    value: "text-lis-stat-red-icon",
  },
  neutral: {
    line: "before:bg-border",
    iconBg: "bg-muted",
    iconFg: "text-foreground",
    value: "text-foreground",
  },
};

export default function KpiMetricWidgetCard({
  icon: Icon,
  value,
  label,
  variant,
  sublabel,
  active,
  onClick,
}: KpiMetricWidgetCardProps) {
  const classes = variantClasses[variant];
  const interactive = typeof onClick === "function";

  return (
    <Card
      onOpen={onClick}
      aria-pressed={interactive ? Boolean(active) : undefined}
      className={cn(
        "group relative md:col-span-2 w-full overflow-hidden rounded-xl border-border/70 bg-card p-4 text-left",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-22px_rgba(15,23,42,0.32)]",
        "transition-all before:absolute before:inset-x-0 before:top-0 before:h-1",
        classes.line,
        interactive && "hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)]",
        active && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", classes.iconBg)}>
            <Icon className={cn("h-4 w-4", classes.iconFg)} />
          </div>
          <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        <span
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            active ? "bg-primary" : "bg-border",
          )}
        />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <p className={cn("text-4xl font-bold leading-none tracking-tight tabular-nums", classes.value)}>
          {value}
        </p>
        <p className="pb-1.5 text-sm font-medium leading-none text-foreground">รายการ</p>
      </div>

      <div className="mt-4 border-t border-border/70 pt-3">
        <div className="min-h-[0.75rem] text-xs leading-none text-muted-foreground">{sublabel}</div>
      </div>
    </Card>
  );
}
