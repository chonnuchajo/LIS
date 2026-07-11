import { useNavigate } from "react-router-dom";
import StatCard from "@/components/lis/StatCard";
import KpiMetricWidgetCard from "@/components/dashboard/KpiMetricWidgetCard";
import { KPI_META, type KpiId } from "@/lib/dashboardProfiles";
import { computeKpi, type MetricsCtx } from "@/lib/dashboardMetrics";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const WIDGET_CAPTIONS: Partial<Record<KpiId, string>> = {
  assignedToMe: "คำขอล่าสุด",
  waitingReceive: "รอรับตัวอย่าง",
  inProgress: "รับงานแล้ว",
  waitingReview: "ส่งผลแล้ว",
  completedToday: "วันนี้",
  approvedToday: "วันนี้",
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground">±0 เทียบเมื่อวาน</span>;
  const up = delta > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(delta)} เทียบเมื่อวาน
    </span>
  );
}

interface KpiRowProps {
  kpis: KpiId[];
  ctx: MetricsCtx;
  activeKpi?: KpiId;
  onKpiClick?: (id: KpiId) => void;
  valueOverrides?: Partial<Record<KpiId, number | string>>;
  extraCards?: ReactNode;
  presentation?: "default" | "widgets";
}

export default function KpiRow({
  kpis,
  ctx,
  activeKpi,
  onKpiClick,
  valueOverrides,
  extraCards,
  presentation = "default",
}: KpiRowProps) {
  const navigate = useNavigate();
  return (
    <div
      className={cn(
        "mb-4 grid gap-3",
        presentation === "widgets"
          ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-8"
          : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
      )}
    >
      {kpis.map((id) => {
        const meta = KPI_META[id];
        const { value, delta } = computeKpi(id, ctx);
        const overrideValue = valueOverrides?.[id];
        const displayValue = overrideValue ?? (id === "normalRateApprox" ? `${value}%` : value);
        const sublabel = delta !== undefined && overrideValue === undefined
          ? <DeltaBadge delta={delta} />
          : presentation === "widgets"
            ? WIDGET_CAPTIONS[id]
            : undefined;
        const handleClick = onKpiClick
          ? () => onKpiClick(id)
          : meta.drilldownPath
            ? () => navigate(meta.drilldownPath!)
            : undefined;
        if (presentation === "widgets") {
          return (
            <KpiMetricWidgetCard
              key={id}
              icon={meta.icon}
              value={displayValue}
              label={meta.label}
              variant={meta.variant}
              sublabel={sublabel}
              active={activeKpi === id}
              onClick={handleClick}
            />
          );
        }
        return (
          <StatCard
            key={id}
            icon={meta.icon}
            value={displayValue}
            label={meta.label}
            variant={meta.variant}
            sublabel={sublabel}
            active={activeKpi === id}
            onClick={handleClick}
          />
        );
      })}
      {extraCards}
    </div>
  );
}
