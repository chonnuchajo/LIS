import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import {
  buildLocalStandardLabelCodeDefaults,
  mergeStandardLabelCodeDefaults,
  parseStandardLabelCode,
  standardLabelCodeFromSuffix,
  standardLabelCodePrefix,
  standardLabelCodeSuffix,
} from "@/lib/standardLabelCode";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/components/lis/stock/receiveCart.helpers";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  standard: StockStandardItem;
  onClose: () => void;
  onSaved: () => void;
  onPreviewLabels: (labels: string[], options?: { autoPrint?: boolean }) => void;
}

export default function ReceiveBottlesDialog({ standard, onClose, onSaved, onPreviewLabels }: Props) {
  const labelPrefix = standardLabelCodePrefix(standard.code);
  const [lotNo, setLotNo] = useState("");
  const [purity, setPurity] = useState("");
  const [type, setType] = useState<"primary" | "supplier" | "working" | "">("primary");
  const [sizeMl, setSizeMl] = useState("100");
  const [count, setCount] = useState("1");
  const [labelCodes, setLabelCodes] = useState<string[]>(() => buildLocalStandardLabelCodeDefaults(standard.code, 1).codes);
  const [sameExp, setSameExp] = useState(true);
  const [commonExp, setCommonExp] = useState("");
  const [perExp, setPerExp] = useState<string[]>([""]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const n = Math.max(1, Number(count) || 1);
  const ensureBottleFields = (len: number) => {
    setPerExp((prev) => {
      const next = [...prev];
      while (next.length < len) next.push("");
      next.length = len;
      return next;
    });
    setLabelCodes((prev) => {
      const fallback = buildLocalStandardLabelCodeDefaults(standard.code, len).codes;
      return mergeStandardLabelCodeDefaults(prev, fallback, len);
    });
  };

  useEffect(() => {
    let active = true;
    const len = Math.max(1, Number(count) || 1);
    api.getStandardLabelCodeDefaults(standard._id, len)
      .then((defaults) => {
        if (!active) return;
        setLabelCodes((prev) => mergeFetchedLabelCodeDefaults(prev, defaults.codes, len));
      })
      .catch(() => {
        if (!active) return;
        setLabelCodes((prev) => mergeStandardLabelCodeDefaults(prev, buildLocalStandardLabelCodeDefaults(standard.code, len).codes, len));
      });
    return () => { active = false; };
  }, [standard._id, standard.code, count]);

  const setLabelCodeSuffix = (index: number, value: string) => {
    setLabelCodes((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      next[index] = standardLabelCodeFromSuffix(labelPrefix, value);
      return next;
    });
  };

  const mergeFetchedLabelCodeDefaults = (current: string[], defaults: string[], len: number) => {
    const fallback = buildLocalStandardLabelCodeDefaults(standard.code, len).codes;
    const editableCurrent = current.map((code, index) => (code.trim() === fallback[index] ? "" : code));
    return mergeStandardLabelCodeDefaults(editableCurrent, defaults, len);
  };

  const buildLabels = async (units: StockUnitItem[]) => {
    const labels: string[] = [];
    for (const u of units) {
      try {
        labels.push(await buildStockLabelHtml(u));
      } catch (err) {
        toast.error(`ปริ้นลาเบล ${u.qrId} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }
    return labels;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = Number(sizeMl);
    if (!/^\d+(?:\.\d{1,4})?$/.test(sizeMl.trim()) || !Number.isFinite(size) || size <= 0) {
      toast.error("ปริมาณต้องเป็นตัวเลข และทศนิยมไม่เกิน 4 ตำแหน่ง"); return;
    }
    const cnt = Number(count);
    if (!Number.isInteger(cnt) || cnt < 1) { toast.error("จำนวนขวดต้องเป็นจำนวนเต็มบวก"); return; }
    if (!lotNo.trim()) { toast.error("กรุณาระบุ Lot No"); return; }
    if (!purity.trim()) { toast.error("กรุณาระบุ % Purity"); return; }
    const trimmedLabelCodes = Array.from({ length: cnt }, (_, i) => labelCodes[i]?.trim() ?? "");
    if (trimmedLabelCodes.some((code) => !parseStandardLabelCode(code, standard.code))) {
      toast.error(`Code ต้องขึ้นต้นด้วย ${labelPrefix} และตามด้วยปี/เลขขวด เช่น ${labelPrefix}6901`); return;
    }
    if (sameExp) {
      if (!commonExp) { toast.error("กรุณาระบุ EXP"); return; }
    } else if (Array.from({ length: cnt }, (_, i) => !perExp[i]).some(Boolean)) {
      toast.error("กรุณาระบุ EXP"); return;
    }
    if (type !== "primary" && type !== "supplier" && type !== "working") { toast.error("ต้องเลือกประเภท Barcode"); return; }
    const bottles = Array.from({ length: n }, (_, i) => ({
      exp: sameExp ? commonExp || undefined : perExp[i] || undefined,
      labelCode: trimmedLabelCodes[i],
    }));
    setBusy(true);
    try {
      const created = await api.receiveStockUnits(standard._id, {
        lotNo: lotNo.trim(), purity: purity.trim(), sizeMl: size, unit: "mg", type, bottles,
      });
      toast.success(`รับเข้า ${created.length} ขวดแล้ว`);
      onSaved();
      if (printAfter) {
        const labels = await buildLabels(created);
        if (labels.length > 0) onPreviewLabels(labels, { autoPrint: true });
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>รับเข้าขวด — {standard.name}</DialogTitle>
            <DialogDescription>{standard.code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>ประเภท</Label>
              <div className="flex gap-2 mt-1">
                {(["primary", "working", "supplier"] as const).map((t) => (
                  <Button key={t} type="button" variant={type === t ? "default" : "outline"} size="sm"
                    onClick={() => setType(t)}>{t}</Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label htmlFor="receive-standard-lot">Lot No</Label><Input id="receive-standard-lot" value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="required" required /></div>
              <div><Label htmlFor="receive-standard-purity">% Purity</Label><Input id="receive-standard-purity" value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="เช่น 99.5" inputMode="decimal" required /></div>
              <div><Label>ปริมาณ (mg)</Label><Input value={sizeMl} onChange={(e) => setSizeMl(sanitizeDecimalInput(e.target.value, 4))} inputMode="decimal" placeholder="เช่น 100 หรือ 0.1234" /></div>
            </div>
            <div>
              <Label>จำนวนขวด</Label>
              <Input min="1" step="1" inputMode="numeric" value={count}
                onChange={(e) => { const next = sanitizeIntegerInput(e.target.value); setCount(next); ensureBottleFields(Math.max(1, Number(next) || 1)); }} />
            </div>
            <p className="text-xs text-muted-foreground">Code: 2 ตัวแรกล็อกตาม Code ของ Std ให้แก้ได้เฉพาะปี/เลขขวด เช่น 016901</p>
            <div className="space-y-2">
              {Array.from({ length: n }, (_, i) => (
                <div key={i}>
                  <Label htmlFor={`receive-standard-code-${i}`}>{n === 1 ? "Code" : `Code ขวดที่ ${i + 1}`}</Label>
                  <div className="mt-1 flex gap-2">
                    <Input value={labelPrefix} readOnly aria-label="Code prefix" className="w-16 bg-muted text-center font-medium" />
                    <Input
                      id={`receive-standard-code-${i}`}
                      value={standardLabelCodeSuffix(labelCodes[i] ?? "", labelPrefix)}
                      onChange={(e) => setLabelCodeSuffix(i, e.target.value)}
                      inputMode="numeric"
                      placeholder="6901"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sameExp" checked={sameExp} onCheckedChange={(v) => setSameExp(v === true)} />
              <label htmlFor="sameExp" className="text-sm cursor-pointer">EXP เท่ากันทุกขวด</label>
            </div>
            {sameExp ? (
              <div><Label>EXP (ทุกขวด)</Label><Input type="date" value={commonExp} onChange={(e) => setCommonExp(e.target.value)} required /></div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i}>
                    <Label>EXP ขวดที่ {i + 1}</Label>
                    <Input type="date" value={perExp[i] ?? ""}
                      required
                      onChange={(e) => setPerExp((prev) => { const x = [...prev]; x[i] = e.target.value; return x; })} />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="printAfter" checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />
              <label htmlFor="printAfter" className="text-sm cursor-pointer">ปริ้นลาเบลหลังรับเข้า</label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "รับเข้า"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
