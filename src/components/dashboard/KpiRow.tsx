import { useNavigate } from "react-router-dom";
import StatCard from "@/components/lis/StatCard";
import { KPI_META, type KpiId } from "@/lib/dashboardProfiles";
import { computeKpi, type MetricsCtx } from "@/lib/dashboardMetrics";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground">±0 เทียบเมื่อวาน</span>;
  const up = delta > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(delta)} เทียบเมื่อวาน
    </span>
  );
}

export default function KpiRow({ kpis, ctx }: { kpis: KpiId[]; ctx: MetricsCtx }) {
  const navigate = useNavigate();
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((id) => {
        const meta = KPI_META[id];
        const { value, delta } = computeKpi(id, ctx);
        return (
          <StatCard
            key={id}
            icon={meta.icon}
            value={id === "normalRateApprox" ? `${value}%` : value}
            label={meta.label}
            variant={meta.variant}
            sublabel={delta !== undefined ? <DeltaBadge delta={delta} /> : undefined}
            onClick={meta.drilldownPath ? () => navigate(meta.drilldownPath!) : undefined}
          />
        );
      })}
    </div>
  );
}
