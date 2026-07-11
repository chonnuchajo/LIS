import { PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ConfigPieDatum } from "@/lib/dashboardMetrics";

interface ConfigCoveragePiesProps {
  simpleMethodData: ConfigPieDatum[];
  standardTimeData: ConfigPieDatum[];
  loading?: boolean;
}

export default function ConfigCoveragePies({
  simpleMethodData,
  standardTimeData,
  loading = false,
}: ConfigCoveragePiesProps) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CoveragePieCard title="Simple Method" data={simpleMethodData} loading={loading} />
      <CoveragePieCard title="Standard Time" data={standardTimeData} loading={loading} />
    </div>
  );
}

function CoveragePieCard({
  title,
  data,
  loading,
}: {
  title: string;
  data: ConfigPieDatum[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <StateText>กำลังโหลด...</StateText>
        ) : data.length === 0 ? (
          <StateText>ไม่มีข้อมูล</StateText>
        ) : (
          <>
            <ChartContainer config={{ value: { label: "จำนวน" } }} className="h-[220px] w-full">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {data.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-3 grid gap-2 text-sm">
              {data.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{row.value.toLocaleString()} รายการ</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StateText({ children }: { children: string }) {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
