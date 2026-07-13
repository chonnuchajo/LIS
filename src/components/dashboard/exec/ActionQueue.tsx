import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PETITION_DEPT_LABELS, type PetitionDept } from "@/types/petition.types";
import { formatMinutes, highlightPath, type ExecWorkUnit } from "@/lib/execSummary";

const REASON: Record<ExecWorkUnit["state"], (u: ExecWorkUnit) => string> = {
  overdue: (u) => `เกิน ${formatMinutes(u.overdueMin ?? 0)}`,
  atRisk: (u) => `ใกล้ครบเกณฑ์ (${formatMinutes(u.elapsedMin)} จาก ${formatMinutes(u.baselineMin ?? 0)})`,
  unassigned: (u) => `ยังไม่ assign ${formatMinutes(u.elapsedMin)}`,
  noBaseline: (u) => `ยังไม่มีเกณฑ์เวลา · ค้าง ${formatMinutes(u.elapsedMin)}`,
  ok: (u) => `ค้าง ${formatMinutes(u.elapsedMin)}`,
};

const REASON_TONE: Record<ExecWorkUnit["state"], string> = {
  overdue: "text-red-600 font-medium",
  atRisk: "text-amber-600",
  unassigned: "text-amber-600",
  noBaseline: "text-muted-foreground",
  ok: "text-muted-foreground",
};

export default function ActionQueue({ units }: { units: ExecWorkUnit[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">งานที่ต้องจัดการ</CardTitle>
      </CardHeader>
      <CardContent>
        {units.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีงานค้างที่ต้องจัดการ</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">เลขคำขอ</th>
                <th>แผนก</th>
                <th>ด่านที่ติด</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะเวลา</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={`${u.petitionId}-${u.track}`} className="border-b last:border-0">
                  <td className="py-2 font-medium">
                    {u.petitionNo}
                    {u.priority === 1 ? <Badge variant="destructive" className="ml-2">ด่วน</Badge> : null}
                  </td>
                  <td>{PETITION_DEPT_LABELS[u.dept as PetitionDept] ?? u.dept}</td>
                  <td>{u.stageLabel}</td>
                  <td>{u.assigneeName || "—"}</td>
                  <td className={REASON_TONE[u.state]}>{REASON[u.state](u)}</td>
                  <td className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={highlightPath([u.petitionId])}>ดู</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
