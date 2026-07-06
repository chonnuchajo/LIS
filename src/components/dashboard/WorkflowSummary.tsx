import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusDonutData, pipelineStages } from "@/lib/dashboardMetrics";
import type { WorkflowKind } from "@/lib/dashboardProfiles";
import type { Petition } from "@/types/petition.types";

export default function WorkflowSummary({ kind, petitions }: { kind: WorkflowKind; petitions: Petition[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">สรุป Workflow</CardTitle></CardHeader>
      <CardContent>
        {kind === "statusDonut" ? <StatusDonut petitions={petitions} /> : <PipelineBar petitions={petitions} />}
      </CardContent>
    </Card>
  );
}

function StatusDonut({ petitions }: { petitions: Petition[] }) {
  const data = statusDonutData(petitions);
  if (data.length === 0) return <Empty />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={85} paddingAngle={2}>
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">คำขอ</span>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate">{d.label}</span>
            <span className="tabular-nums font-medium">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PipelineBar({ petitions }: { petitions: Petition[] }) {
  const data = pipelineStages(petitions);
  if (data.every((d) => d.count === 0)) return <Empty />;
  return (
    <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={72} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function Empty() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
}
