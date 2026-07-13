import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

export default function BottleneckBars({ rows }: { rows: ExecSummary["live"]["bottleneck"] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">คอขวดตอนนี้</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.stage}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
