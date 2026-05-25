import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant: "blue" | "amber" | "green" | "red" | "neutral";
  sublabel?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

const variantClasses: Record<StatCardProps["variant"], { bar: string; iconBg: string; iconFg: string }> = {
  blue: {
    bar: "before:bg-lis-stat-blue-icon",
    iconBg: "bg-lis-stat-blue",
    iconFg: "text-lis-stat-blue-icon",
  },
  amber: {
    bar: "before:bg-lis-stat-amber-icon",
    iconBg: "bg-lis-stat-amber",
    iconFg: "text-lis-stat-amber-icon",
  },
  green: {
    bar: "before:bg-lis-stat-green-icon",
    iconBg: "bg-lis-stat-green",
    iconFg: "text-lis-stat-green-icon",
  },
  red: {
    bar: "before:bg-lis-stat-red-icon",
    iconBg: "bg-lis-stat-red",
    iconFg: "text-lis-stat-red-icon",
  },
  neutral: {
    bar: "before:bg-border",
    iconBg: "bg-muted",
    iconFg: "text-foreground",
  },
};

const StatCard = ({ icon: Icon, value, label, variant, sublabel, active, onClick }: StatCardProps) => {
  const classes = variantClasses[variant];
  const interactive = typeof onClick === "function";

  const Wrapper: keyof JSX.IntrinsicElements = interactive ? "button" : "div";

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(active) : undefined}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-card p-4 text-left",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06)]",
        "border border-border/70 transition-all",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        classes.bar,
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <div className="flex items-start gap-3 pl-2">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", classes.iconBg)}>
          <Icon className={cn("h-4 w-4", classes.iconFg)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
          {sublabel ? (
            <div className="mt-2 text-xs text-muted-foreground">{sublabel}</div>
          ) : null}
        </div>
      </div>
    </Wrapper>
  );
};

export default StatCard;
