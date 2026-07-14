import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const CONFIG = {
  created: { label: "คำขอใหม่", color: "hsl(217,91%,55%)" },
  completed: { label: "คำขอเสร็จสิ้น", color: "hsl(142,71%,45%)" },
};

export default function ThroughputChart({ rows }: { rows: ExecSummary["stats"]["throughput"] }) {
  const data = rows.map((r) => ({ ...r, day: r.date.slice(5) })); // MM-DD
  const isEmpty = data.every((d) => d.created === 0 && d.completed === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">คำขอใหม่ / คำขอเสร็จสิ้น</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <ChartContainer config={CONFIG} className="h-[240px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="created" stroke="var(--color-created)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
