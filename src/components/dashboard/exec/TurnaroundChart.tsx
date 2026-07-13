import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const CONFIG = {
  avgHours: { label: "เฉลี่ย", color: "hsl(217,91%,55%)" },
  p90Hours: { label: "p90 (ช้าสุด 10%)", color: "hsl(38,92%,50%)" },
};

export default function TurnaroundChart({ rows }: { rows: ExecSummary["stats"]["turnaround"] }) {
  const data = rows
    .filter((r) => r.count > 0)
    .map((r) => ({
      label: r.label,
      avgHours: Math.round(((r.avgMin ?? 0) / 60) * 10) / 10,
      p90Hours: Math.round(((r.p90Min ?? 0) / 60) * 10) / 10,
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">เวลาที่ใช้ต่อด่าน (ชั่วโมง)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <ChartContainer config={CONFIG} className="h-[240px] w-full">
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="label" width={110} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avgHours" fill="var(--color-avgHours)" radius={3} />
              <Bar dataKey="p90Hours" fill="var(--color-p90Hours)" radius={3} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
