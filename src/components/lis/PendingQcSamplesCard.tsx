import { FlaskConical, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SampleItem } from "@/components/lis/SampleColumn";

const MAX_VISIBLE = 6;

export default function PendingQcSamplesCard({
  samples,
  onSelect,
}: {
  samples: SampleItem[];
  onSelect?: (sample: SampleItem) => void;
}) {
  const visible = samples.slice(0, MAX_VISIBLE);
  const remaining = Math.max(0, samples.length - MAX_VISIBLE);

  return (
    <Card className="shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            ผลวิเคราะห์รอ QC
            {samples.length > 0 ? (
              <Badge variant="yellow-soft" className="tabular-nums">{samples.length}</Badge>
            ) : null}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {samples.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm font-medium">ไม่มีผลวิเคราะห์ที่รอ QC</p>
            <p className="text-xs text-muted-foreground">ทุกเคสได้รับการอนุมัติแล้ว ✨</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visible.map((sample) => (
                <li key={sample.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(sample)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-lis-stat-amber text-lis-stat-amber-icon">
                      <FlaskConical className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-primary text-sm">{sample.id}</span>
                        <Badge variant="yellow-soft" className="shrink-0 text-[10px]">รอ QC</Badge>
                      </div>
                      <p className="truncate text-xs text-foreground/80 mt-0.5">{sample.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {sample.receiver || "ไม่ระบุผู้วิเคราะห์"} · {sample.instrument || "ไม่ระบุเครื่องมือ"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <div className="border-t border-border px-4 py-2.5 text-center text-xs text-muted-foreground">
                + อีก {remaining} รายการ
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
