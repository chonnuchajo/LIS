// src/components/lis/StandardWeighingSection.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, QrCode, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StockQrScanner from "@/components/lis/StockQrScanner";
import { api, type StandardWeighingDoc } from "@/lib/api";
import type { StandardConfigDoc } from "@/lib/standardConfig";
import type { Petition } from "@/types/petition.types";
import { buildWeighTasks, type WeighTask } from "@/lib/standardWeighing";

export type RequiredKey = { commonName: string; substance: string; instrument: "GC" | "HPLC"; times: number | null };

type Props = {
  petition: Petition;
  configs: StandardConfigDoc[];
  readOnly: boolean;
  onValidityChange: (ready: boolean, requiredKeys: RequiredKey[]) => void;
};

type Draft = {
  mode: "fresh" | "working";
  masses: string[];      // string inputs, length = times
  bottleQrId: string;
  bottleLabel: string;   // "itemName · lot · เหลือ X mg" for display
  bottleRemaining: number;
  workingQrId: string;
  deductedAt: string | null;
};

const emptyDraft = (times: number): Draft => ({
  mode: "fresh", masses: Array.from({ length: Math.max(1, times) }, () => ""),
  bottleQrId: "", bottleLabel: "", bottleRemaining: 0, workingQrId: "", deductedAt: null,
});

function draftReady(t: WeighTask, d: Draft): boolean {
  if (t.times == null) return false;
  if (d.deductedAt) return true;
  if (d.mode === "working") return !!d.workingQrId;
  const nums = d.masses.map(Number).filter((n) => n > 0);
  if (nums.length !== t.times || !d.bottleQrId) return false;
  return nums.reduce((s, n) => s + n, 0) <= d.bottleRemaining;
}

export default function StandardWeighingSection({ petition, configs, readOnly, onValidityChange }: Props) {
  const tasks = useMemo(() => buildWeighTasks(petition, configs), [petition, configs]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [scanFor, setScanFor] = useState<string | null>(null); // task.key being scanned
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: saved = [] } = useQuery<StandardWeighingDoc[]>({
    queryKey: ["standard-weighings", petition._id],
    queryFn: () => api.getStandardWeighings(petition._id),
    enabled: !!petition._id,
  });

  // Seed drafts from tasks, then overlay any saved rows.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const t of tasks) {
        const row = saved.find((r) => r.commonName === t.commonName && r.substance === t.substance && r.instrument === t.instrument);
        if (prev[t.key] && !row) { next[t.key] = prev[t.key]; continue; }
        const base = emptyDraft(t.times ?? 1);
        next[t.key] = row
          ? {
              mode: row.mode,
              masses: (row.masses.length ? row.masses.map(String) : base.masses).slice(0, Math.max(1, t.times ?? 1)),
              bottleQrId: row.bottleQrId, bottleLabel: prev[t.key]?.bottleLabel ?? (row.bottleQrId ? `ขวด ${row.bottleQrId}` : ""),
              bottleRemaining: prev[t.key]?.bottleRemaining ?? Number.MAX_SAFE_INTEGER,
              workingQrId: row.workingQrId, deductedAt: row.deductedAt,
            }
          : base;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, saved]);

  // Report readiness + required keys upward whenever drafts/tasks change.
  useEffect(() => {
    const requiredKeys: RequiredKey[] = tasks.map((t) => ({ commonName: t.commonName, substance: t.substance, instrument: t.instrument, times: t.times }));
    const ready = tasks.every((t) => draftReady(t, drafts[t.key] ?? emptyDraft(t.times ?? 1)));
    onValidityChange(ready, requiredKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, drafts]);

  const persist = (t: WeighTask, d: Draft) => {
    clearTimeout(saveTimers.current[t.key]);
    saveTimers.current[t.key] = setTimeout(() => {
      api.saveStandardWeighing({
        petitionId: petition._id, petitionNo: petition.petitionNo, sampleId: t.sampleId,
        commonName: t.commonName, substance: t.substance, instrument: t.instrument, times: t.times,
        mode: d.mode, masses: d.masses.map(Number).filter((n) => Number.isFinite(n)),
        bottleQrId: d.bottleQrId, workingQrId: d.workingQrId,
      }).catch(() => {});
    }, 500);
  };

  const update = (t: WeighTask, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const d = { ...(prev[t.key] ?? emptyDraft(t.times ?? 1)), ...patch };
      persist(t, d);
      return { ...prev, [t.key]: d };
    });
  };

  const onScanned = async (qrId: string) => {
    const key = scanFor;
    setScanFor(null);
    if (!key) return;
    const t = tasks.find((x) => x.key === key);
    if (!t) return;
    try {
      const unit = await api.getStockUnit(qrId);
      if (unit.volume?.unit !== "mg") { toast.error("ขวดนี้ไม่ได้เป็นหน่วย mg"); return; }
      const name = (unit.itemName || "").toLowerCase();
      if (t.substance && !name.includes(t.substance.toLowerCase().split(" ")[0])) {
        toast.warning(`ขวดที่สแกน (${unit.itemName}) อาจไม่ตรงกับสาร ${t.substance}`);
      }
      update(t, {
        bottleQrId: unit.qrId, bottleRemaining: Number(unit.volume?.remaining) || 0,
        bottleLabel: `${unit.itemName}${unit.lotNo ? ` · lot ${unit.lotNo}` : ""} · เหลือ ${unit.volume?.remaining ?? 0} mg`,
      });
    } catch {
      toast.error("ไม่พบขวด (QR) นี้");
    }
  };

  if (tasks.length === 0) return null;

  return (
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-bold">ชั่ง Standard</h3>
        <span className="text-xs text-muted-foreground">(หักสต็อกตอนบันทึกผล)</span>
      </div>

      {tasks.map((t) => {
        const d = drafts[t.key] ?? emptyDraft(t.times ?? 1);
        const ready = draftReady(t, d);
        const total = d.masses.map(Number).filter((n) => n > 0).reduce((s, n) => s + n, 0);
        const over = d.mode === "fresh" && !!d.bottleQrId && total > d.bottleRemaining;
        return (
          <div key={t.key} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {t.substance} <span className="text-muted-foreground">· {t.instrument} · ชั่ง {t.times ?? "?"} ครั้ง</span>
              </div>
              {t.times == null ? (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> ยังไม่ตั้งค่า</Badge>
              ) : d.deductedAt ? (
                <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> หักแล้ว</Badge>
              ) : ready ? (
                <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> พร้อม</Badge>
              ) : (
                <Badge variant="secondary">ยังไม่ครบ</Badge>
              )}
            </div>

            {!d.deductedAt && t.times != null && (
              <>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={d.mode === "fresh" ? "default" : "outline"} disabled={readOnly}
                    onClick={() => update(t, { mode: "fresh" })}>ชั่งใหม่</Button>
                  <Button type="button" size="sm" variant={d.mode === "working" ? "default" : "outline"} disabled={readOnly}
                    onClick={() => update(t, { mode: "working" })}>ใช้ working เดิม</Button>
                </div>

                {d.mode === "fresh" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="gap-1" disabled={readOnly}
                        onClick={() => setScanFor(t.key)}>
                        <QrCode className="h-4 w-4" /> {d.bottleQrId ? "เปลี่ยนขวด" : "สแกน QR ขวด"}
                      </Button>
                      {d.bottleLabel && <span className="text-xs text-muted-foreground">{d.bottleLabel}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: Math.max(1, t.times) }).map((_, i) => (
                        <Input key={i} type="number" inputMode="decimal" step="0.0001" min={0} disabled={readOnly}
                          className="w-24" placeholder={`ครั้งที่ ${i + 1} (mg)`}
                          value={d.masses[i] ?? ""}
                          onChange={(e) => {
                            const masses = [...d.masses]; masses[i] = e.target.value; update(t, { masses });
                          }} />
                      ))}
                    </div>
                    <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      รวมที่จะหัก: {total.toLocaleString()} mg{over ? " — เกินคงเหลือในขวด!" : ""}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1" disabled={readOnly}
                      onClick={() => setScanFor(t.key)}>
                      <QrCode className="h-4 w-4" /> {d.workingQrId ? "เปลี่ยน working" : "สแกน working solution"}
                    </Button>
                    {d.workingQrId && <span className="text-xs text-muted-foreground">working {d.workingQrId}</span>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <StockQrScanner
        open={scanFor != null}
        title="สแกน QR ขวด standard"
        onClose={() => setScanFor(null)}
        onScanned={(qrId) => {
          const t = tasks.find((x) => x.key === scanFor);
          if (t && drafts[t.key]?.mode === "working") { update(t, { workingQrId: qrId }); setScanFor(null); }
          else onScanned(qrId);
        }}
      />
    </section>
  );
}
