import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { preparationWorksheet } from "@/lib/validationPreparationWorksheet";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { preparationKind, preparationPlan, preparationResult, targetConcentration, changePreparationUnit, type ConcentrationUnit, type PreparationLevel, type ValidationStock } from "@/lib/validationPreparation";

export default function ValidationPreparation({ stock, stocks, levels, onChange, analyte, method }: {
  analyte: string;
  method: string;
  stock: number | null;
  stocks: ValidationStock[];
  levels: PreparationLevel[];
  onChange: (levels: PreparationLevel[]) => void;
}) {
  const [worksheet, setWorksheet] = useState("");
  const printFrame = useRef<HTMLIFrameElement>(null);
  const [unitError, setUnitError] = useState("");
  useEffect(() => {
    const next = levels.map(row => {
      const plan = preparationPlan(row, stock, stocks);
      const aliquot = plan ? String(plan.aliquotUl) : "";
      return row.aliquot === aliquot ? row : { ...row, aliquot };
    });
    if (next.some((row, i) => row !== levels[i])) onChange(next);
  }, [levels, stock, stocks, onChange]);
  const update = (id: string, key: keyof PreparationLevel, value: string) => onChange(levels.map(row => {
    if (row.id !== id) return row;
    const next = { ...row, preparationKind: preparationKind(row), [key]: value };
    if (key === "stockId") {
      const plan = preparationPlan(next, stock, stocks);
      next.aliquot = plan ? String(plan.aliquotUl) : "";
    }
    return next;
  }));
  return <div className="space-y-4">
    <Dialog open={!!worksheet} onOpenChange={open => { if (!open) setWorksheet(""); }}><DialogContent className="sm:max-w-6xl"><DialogHeader><DialogTitle>ใบเตรียมสาร Validation</DialogTitle><DialogDescription>ตรวจแผนปิเปตและ Solvent ก่อนพิมพ์ เลือกแนวนอนในการพิมพ์</DialogDescription></DialogHeader><iframe ref={printFrame} title="ใบเตรียมสาร" sandbox="allow-same-origin allow-modals" srcDoc={worksheet} className="h-[65vh] w-full rounded-lg border" /><Button onClick={() => { printFrame.current?.contentWindow?.focus(); printFrame.current?.contentWindow?.print(); }}>พิมพ์ / บันทึก PDF</Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([worksheet], { type: "text/html;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "validation-preparation.html"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>ดาวน์โหลดใบเตรียมสาร HTML</Button><p className="text-xs text-muted-foreground">หากหน้าต่างพิมพ์ไม่เปิด ให้ดาวน์โหลด HTML เปิดด้วย Chrome หรือ Edge แล้วกด Ctrl+P</p></DialogContent></Dialog>
    <Button variant="outline" disabled={!levels.length} onClick={() => setWorksheet(preparationWorksheet({ analyte, method }, levels, stock, stocks))}>พิมพ์ตารางคำนวณการเตรียมสาร</Button>
    <p className="text-sm text-muted-foreground">ปริมาตรปิเปตคำนวณจากแผนแบบเรียลไทม์เมื่อเปลี่ยน Stock, Target หรือ Final volume แสดงทศนิยม 1 ตำแหน่ง · กรอก Target (mg/mL) และ Final volume (µL; 1 mL = 1,000 µL) เพื่อดูปริมาตร Stock และ Solvent ตามแผนทันที โดยยังไม่ต้องกรอกปิเปตจริง</p>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold">ตารางคำนวณการเตรียมสาร</h3>
        <p className="mt-1 text-sm text-muted-foreground">เลือกหน่วย Target แยกแต่ละระดับได้ · เมื่อเปลี่ยนหน่วย ระบบแปลงตัวเลขเพื่อคงความเข้มข้นเดิม ส่วน Actual และตารางผลวัดใช้ mg/mL</p></div>
    </div>
    {(["std", "matrix"] as const).map(kind => <section key={kind} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold">{kind === "std" ? "1. เตรียมสารมาตรฐาน (STD)" : "2. เตรียมสารที่เติม Matrix"}</h4><Button variant="outline" disabled={kind === "std" && levels.filter(row => preparationKind(row) === "std").length >= 5} onClick={() => onChange([...levels, { id: crypto.randomUUID(), preparationKind: kind, purpose: kind === "std" ? "linearity" : "accuracy", target: "", aliquot: "", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" }])}><Plus className="mr-2 h-4 w-4" />{kind === "std" ? "เพิ่ม STD" : "เพิ่มสารที่เติม Matrix"}</Button></div>
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm [&_td]:align-top [&_td]:px-3 [&_td]:py-4"><thead className="bg-muted text-muted-foreground"><tr>{["Stock ที่ใช้", "Target และหน่วย", "C stock (mg/mL)", "Stock (µL)", "Solvent (µL)", ...(kind === "matrix" ? ["Matrix (µL)"] : []), "Actual (mg/mL)", "Recovery ต่ำ–สูง (%)", ""].map((h, i) => <th key={i} className={`p-3 align-bottom font-medium ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y">{levels.map((row, i) => ({ row, i })).filter(({ row }) => preparationKind(row) === kind).map(({ row, i }) => {
          const result = preparationResult(row, stock, stocks);
          const plan = preparationPlan(row, stock, stocks);
          return <tr key={row.id} className="hover:bg-accent">
            <td className="min-w-56 p-2"><NativeSelect className="min-w-48" aria-label={`Stock ระดับ ${i + 1}`} value={row.stockId ?? ""} onChange={e => update(row.id, "stockId", e.target.value)}><option value="">Stock หลัก</option>{stocks.map(source => <option key={source.id} value={source.id}>{source.name || source.id}</option>)}</NativeSelect><p className="mt-2 whitespace-normal break-words text-xs text-muted-foreground">{row.stockId ? stocks.find(source => source.id === row.stockId)?.name || row.stockId : "Stock หลัก"}</p></td>
            <td className="min-w-40 space-y-2 p-2"><Input aria-label={`target ระดับ ${i + 1}`} type="number" min="0" step="any" value={row.target} onChange={e => update(row.id, "target", e.target.value)} /><NativeSelect aria-label={`หน่วย Target ระดับ ${i + 1}`} value={row.targetUnit ?? "mg/mL"} onChange={e => {
              const converted = changePreparationUnit(row, e.target.value as ConcentrationUnit);
              if (!converted) { setUnitError(`ระดับ ${i + 1}: แปลงหน่วยไม่ได้ กรุณาตรวจค่า Target ให้อยู่ในช่วงคำนวณ`); return; }
              setUnitError(""); onChange(levels.map(level => level.id === row.id ? converted : level));
            }}>{["mg/mL", "µg/mL", "mg/L"].map(unit => <option key={unit}>{unit}</option>)}</NativeSelect>{row.targetUnit && row.targetUnit !== "mg/mL" && <p className="text-xs text-muted-foreground">= {targetConcentration(row) ?? "—"} mg/mL</p>}<label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">Final volume (µL)<Input className="h-8 w-24 shrink-0 text-right text-xs" aria-label={`finalVolume ระดับ ${i + 1}`} type="number" min="0" step="any" value={row.finalVolume} onChange={e => update(row.id, "finalVolume", e.target.value)} /></label></td>
            <td className="min-w-32 p-2 text-right tabular-nums">{plan?.stock.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
            <td className="min-w-28 p-2 text-right font-semibold tabular-nums"><output aria-label={`aliquot ระดับ ${i + 1}`}>{plan?.aliquotUl.toFixed(1) ?? "—"}</output></td>
            <td className="min-w-32 p-2 text-right tabular-nums">{plan ? plan.solventUl.toFixed(1) : <span className="text-destructive">ตรวจ Stock, Target, Final volume และ Matrix</span>}</td>
            {kind === "matrix" && <td className="min-w-28 p-2"><Input aria-label={`matrix ระดับ ${i + 1}`} type="number" min="0" step="any" value={row.matrix} onChange={e => update(row.id, "matrix", e.target.value)} /></td>}
            <td className="min-w-40 p-2 text-right tabular-nums"><strong>{result?.actual.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</strong>{stock != null && !result && <p className="text-xs text-destructive">ตรวจค่าและปริมาตรรวม</p>}</td>
            <td className="p-2">{row.purpose === "accuracy" ? <div className="flex min-w-40 gap-2"><Input aria-label={`Recovery ต่ำ ระดับ ${i + 1}`} type="number" value={row.recoveryLow} onChange={e => update(row.id, "recoveryLow", e.target.value)} /><Input aria-label={`Recovery สูง ระดับ ${i + 1}`} type="number" value={row.recoveryHigh} onChange={e => update(row.id, "recoveryHigh", e.target.value)} /></div> : "—"}</td>
            <td className="p-2"><Button variant="ghost" size="icon" aria-label={`ลบระดับ ${i + 1}`} onClick={() => onChange(levels.filter(l => l.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></td></tr>;
        })}</tbody>
      </table>
    </div>
    </section>)}
    {unitError && <p role="alert" className="text-sm text-destructive">{unitError}</p>}
    <p className="text-sm text-muted-foreground">คำแนะนำปิเปต = Target × ปริมาตรรวม ÷ C stock · ตารางนี้เป็นค่าคำนวณตามแผน ไม่ใช่บันทึกการปิเปตจริง · เก็บทศนิยมเต็มในการคำนวณ · 1 mg/mL = 1,000 µg/mL = 1,000 mg/L</p>
  </div>;
}
