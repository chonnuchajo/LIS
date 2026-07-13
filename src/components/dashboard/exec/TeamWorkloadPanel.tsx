import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMinutes, type ExecSummary } from "@/lib/execSummary";

type Side = "lab" | "qc";

export default function TeamWorkloadPanel({ workload }: { workload: ExecSummary["stats"]["workload"] }) {
  const [side, setSide] = useState<Side>("lab");
  const rows = workload[side];
  const max = Math.max(1, ...rows.map((r) => r.completed));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">ภาระงานทีม</CardTitle>
        <div className="flex gap-1">
          {(["lab", "qc"] as Side[]).map((s) => (
            <Button key={s} size="sm" variant={s === side ? "default" : "outline"} onClick={() => setSide(s)}>
              {s === "lab" ? "Lab" : "QC"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : rows.map((row) => (
          <div key={row.name}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{row.name}</span>
              <span className="text-muted-foreground">
                ปิด {row.completed} ใบ · เฉลี่ย {row.avgMinutes == null ? "—" : formatMinutes(row.avgMinutes)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(row.completed / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
