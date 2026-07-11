import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { LabInventorySummary } from "@/lib/dashboardMetrics";

interface LabInventorySummaryCardProps {
  summary: LabInventorySummary;
  loading?: boolean;
}

export default function LabInventorySummaryCard({
  summary,
  loading = false,
}: LabInventorySummaryCardProps) {
  const total = summary.rows.reduce((sum, row) => sum + row.value, 0);
  const chartRows = summary.rows.filter((row) => row.value > 0);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">สรุป Lab Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <StateText>กำลังโหลด...</StateText>
        ) : total === 0 ? (
          <StateText>ไม่มีรายการแจ้งเตือน</StateText>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="relative min-h-[220px]">
              <ChartContainer config={{ value: { label: "จำนวน" } }} className="h-[220px] w-full">
                <PieChart>
                  <Pie
                    data={chartRows}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {chartRows.map((row) => (
                      <Cell key={row.key} fill={row.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total.toLocaleString("th-TH")}</span>
                <span className="text-xs text-muted-foreground">รายการทั้งหมด</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {summary.rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-sm text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.value.toLocaleString("th-TH")} รายการ
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StateText({ children }: { children: string }) {
  return <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
