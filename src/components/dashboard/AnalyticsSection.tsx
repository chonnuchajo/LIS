import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartSpec } from "@/lib/dashboardProfiles";
import {
  deptWorkloadData, analystWorkloadData, normalDonutData, requestTrendData, statusDonutData,
  assignedWeekdayData,
  type MetricsCtx,
  type WeekdayWorkloadBasis,
} from "@/lib/dashboardMetrics";
import { cn } from "@/lib/utils";

interface AnalyticsSectionProps {
  specs: ChartSpec[];
  ctx: MetricsCtx;
  layout?: "grid" | "single";
  weekdayBasis?: WeekdayWorkloadBasis;
}

export default function AnalyticsSection({ specs, ctx, layout = "grid", weekdayBasis = "labAssigned" }: AnalyticsSectionProps) {
  if (specs.length === 0) return null;
  return (
    <div className={cn("grid grid-cols-1 gap-4", layout === "grid" && "mb-4 lg:grid-cols-2")}>
      {specs.map((s) => (
        <Card key={s.kind + s.title}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
          <CardContent><ChartFor spec={s} ctx={ctx} weekdayBasis={weekdayBasis} /></CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartFor({
  spec,
  ctx,
  weekdayBasis,
}: {
  spec: ChartSpec;
  ctx: MetricsCtx;
  weekdayBasis: WeekdayWorkloadBasis;
}) {
  if (spec.kind === "deptBar") return <SimpleBar data={ctx ? deptWorkloadData(ctx.petitions).map((d) => ({ name: d.label, count: d.count })) : []} />;
  if (spec.kind === "analystBar") return <SimpleBar data={analystWorkloadData(ctx.petitions).map((d) => ({ name: d.name, count: d.count }))} />;
  if (spec.kind === "assignedWeekdayBar") return <WeekdayBar data={assignedWeekdayData(ctx.petitions, ctx.now, weekdayBasis)} />;
  if (spec.kind === "withdrawBar") return <TrendBar data={ctx.deductionTrend} />;
  if (spec.kind === "requestTrend") return <TrendBar data={requestTrendData(ctx.petitions, ctx.now, 14)} />;
  if (spec.kind === "normalDonut") return <Donut data={normalDonutData(ctx.petitions, ctx.abnormalFlags)} />;
  return <Donut data={statusDonutData(ctx.petitions)} />; // statusDonut
}

function SimpleBar({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function WeekdayBar({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={58} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function TrendBar({ data, note }: { data: { date: string; count: number }[]; note?: string }) {
  if (data.every((d) => d.count === 0)) return <Empty />;
  return (
    <>
      <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[200px] w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
      {note ? <p className="mt-1 text-[10px] text-muted-foreground">{note}</p> : null}
    </>
  );
}

function Donut({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
}
