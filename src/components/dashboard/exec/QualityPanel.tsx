import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecSummary } from "@/lib/execSummary";

const pct = (rate: number) => {
  const rounded = Math.round(rate * 100);
  if (rate > 0 && rounded === 0) return "<1%";
  return `${rounded}%`;
};

export default function QualityPanel({ quality }: { quality: ExecSummary["stats"]["quality"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">คุณภาพ</CardTitle>
      </CardHeader>
      <CardContent>
        {quality.closed === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-semibold text-red-600">{pct(quality.abnormalRate)}</div>
              <div className="text-xs text-muted-foreground">
                ผลผิดปกติ · {quality.abnormal} จาก {quality.closed} ใบ
              </div>
            </div>
            <div>
              <div className="text-3xl font-semibold text-amber-600">{pct(quality.reworkRate)}</div>
              <div className="text-xs text-muted-foreground">
                งานตีกลับ/ทำใหม่ · {quality.reworked} จาก {quality.closed} ใบ
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
