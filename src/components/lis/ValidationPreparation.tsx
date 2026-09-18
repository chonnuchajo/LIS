import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { preparationWorksheet } from "@/lib/validationPreparationWorksheet";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { calculatedMatrixVolume, preparationKind, preparationPlan, preparationResult, targetConcentration, type PreparationLevel, type ValidationStock } from "@/lib/validationPreparation";

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
  useEffect(() => {
    const next = levels.map(row => {
      const calculated = row.matrixCalculation ? calculatedMatrixVolume(row.matrixCalculation, row.finalVolume) : null;
      const matrix = row.matrixCalculation ? calculated ? String(calculated.matrixUl) : "" : row.matrix;
      const plan = preparationPlan({ ...row, matrix }, stock, stocks);
      const aliquot = plan ? String(plan.aliquotUl) : "";
      return row.aliquot === aliquot && row.matrix === matrix ? row : { ...row, aliquot, matrix };
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
  const matrixConfig = levels.find(row => preparationKind(row) === "matrix" && row.matrixCalculation)?.matrixCalculation;
  const updateMatrixConfig = (config: PreparationLevel["matrixCalculation"]) => onChange(levels.map(row => preparationKind(row) === "matrix" ? { ...row, preparationKind: "matrix", matrixCalculation: config } : row));
  return <div className="space-y-4">
    <Dialog open={!!worksheet} onOpenChange={open => { if (!open) setWorksheet(""); }}><DialogContent className="sm:max-w-6xl"><DialogHeader><DialogTitle>ใบเตรียมสาร Validation</DialogTitle><DialogDescription>ตรวจแผนปิเปตและ Solvent ก่อนพิมพ์ เลือกแนวนอนในการพิมพ์</DialogDescription></DialogHeader><iframe ref={printFrame} title="ใบเตรียมสาร" sandbox="allow-same-origin allow-modals" srcDoc={worksheet} className="h-[65vh] w-full rounded-lg border" /><Button onClick={() => { printFrame.current?.contentWindow?.focus(); printFrame.current?.contentWindow?.print(); }}>พิมพ์ / บันทึก PDF</Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([worksheet], { type: "text/html;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "validation-preparation.html"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>ดาวน์โหลดใบเตรียมสาร HTML</Button><p className="text-xs text-muted-foreground">หากหน้าต่างพิมพ์ไม่เปิด ให้ดาวน์โหลด HTML เปิดด้วย Chrome หรือ Edge แล้วกด Ctrl+P</p></DialogContent></Dialog>
    <Button variant="outline" disabled={!levels.length} onClick={() => setWorksheet(preparationWorksheet({ analyte, method }, levels, stock, stocks))}>พิมพ์ตารางคำนวณการเตรียมสาร</Button>
    <p className="text-sm text-muted-foreground">ปริมาตรปิเปตคำนวณจากแผนแบบเรียลไทม์เมื่อเปลี่ยน Stock, Target หรือ Final volume แสดงทศนิยม 1 ตำแหน่ง · กรอก Target (mg/mL) และ Final volume (µL; 1 mL = 1,000 µL) เพื่อดูปริมาตร Stock และ Solvent ตามแผนทันที โดยยังไม่ต้องกรอกปิเปตจริง</p>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold">ตารางคำนวณการเตรียมสาร</h3>
        <p className="mt-1 text-sm text-muted-foreground">Target และ Actual ใช้หน่วย mg/mL · ปริมาตร Stock และ Solvent คำนวณอัตโนมัติ</p></div>
    </div>
    {(["std", "matrix"] as const).map(kind => <section key={kind} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold">{kind === "std" ? "1. เตรียมสารมาตรฐาน (STD)" : "2. เตรียมสารที่เติม Matrix · 3 ระดับ ต่ำ–กลาง–สูง"}</h4><Button variant="outline" disabled={levels.filter(row => preparationKind(row) === kind).length >= (kind === "std" ? 5 : 3)} onClick={() => onChange([...levels, { id: crypto.randomUUID(), preparationKind: kind, matrixCalculation: kind === "matrix" ? matrixConfig : undefined, purpose: kind === "std" ? "linearity" : "accuracy", target: "", aliquot: "", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" }])}><Plus className="mr-2 h-4 w-4" />{kind === "std" ? "เพิ่ม STD" : "เพิ่มสารที่เติม Matrix"}</Button></div>
    <label className="flex flex-wrap items-center gap-2 text-sm">กำหนด Final volume สำหรับ {kind === "std" ? "STD" : "Matrix"} (µL)<Input className="h-9 w-28 text-right" aria-label={`Final volume ${kind}`} type="number" min="0" step="any" value={levels.filter(row => preparationKind(row) === kind).every((row,_,all) => row.finalVolume === all[0]?.finalVolume) ? levels.find(row => preparationKind(row) === kind)?.finalVolume ?? "" : ""} placeholder="หลายค่า" onChange={e => onChange(levels.map(row => preparationKind(row) === kind ? { ...row, finalVolume: e.target.value } : row))} /></label>
    {kind === "matrix" && <div className="space-y-3 rounded-lg border bg-card p-4">
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!matrixConfig} onChange={e => updateMatrixConfig(e.target.checked ? { percent: "25", basis: "ww", reference: "1", density: "1", sampleDensity: "" } : undefined)} />คำนวณ Matrix จาก %ยา ตามข้อ 6.5.2</label>
      {matrixConfig && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-sm">%ยา<Input type="number" value={matrixConfig.percent} onChange={e => updateMatrixConfig({ ...matrixConfig, percent: e.target.value })} /></label>
        <label className="space-y-1 text-sm">ฐาน %ยา<NativeSelect value={matrixConfig.basis} onChange={e => updateMatrixConfig({ ...matrixConfig, basis: e.target.value as "ww" | "wv" })}><option value="ww">%w/w</option><option value="wv">%w/v</option></NativeSelect></label>
        <label className="space-y-1 text-sm">ระดับอ้างอิง (mg/mL)<Input type="number" value={matrixConfig.reference} onChange={e => updateMatrixConfig({ ...matrixConfig, reference: e.target.value })} /></label>
        <label className="space-y-1 text-sm">ความหนาแน่น Matrix (mg/µL)<Input type="number" value={matrixConfig.density} onChange={e => updateMatrixConfig({ ...matrixConfig, density: e.target.value })} /></label>
        {matrixConfig.basis === "wv" && <label className="space-y-1 text-sm">ความหนาแน่นตัวอย่าง (g/mL)<Input type="number" value={matrixConfig.sampleDensity} onChange={e => updateMatrixConfig({ ...matrixConfig, sampleDensity: e.target.value })} /></label>}
      </div><p className="text-sm text-muted-foreground">Matrix (µL) = ระดับอ้างอิง × Final volume (mL) ÷ สัดส่วนยาโดยน้ำหนัก ÷ ความหนาแน่น Matrix · ใช้ระดับอ้างอิงเดียวกันทุกแถว ไม่ใช้ Target แต่ละแถว</p><p className="text-sm text-muted-foreground">ตัวอย่าง 25%w/w ระดับอ้างอิง 1 mg/mL, Final volume 1 mL และความหนาแน่น Matrix 1 mg/µL ได้ Matrix 4 µL · ค่า 1 เป็นสมมติฐานในรายงาน เปลี่ยนเป็นค่าที่ทราบจริง หากฉลากเป็น %w/v ต้องกรอกความหนาแน่นตัวอย่างด้วย</p></>}
    </div>}
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm [&_td]:align-top [&_td]:px-3 [&_td]:py-4"><thead className="bg-muted text-muted-foreground"><tr>{["Stock ที่ใช้", "Target (mg/mL)", "C stock (mg/mL)", "Stock (µL)", "Solvent (µL)", ...(kind === "matrix" ? ["Matrix (µL)"] : []), "Actual (mg/mL)", ""].map((h, i) => <th key={i} className={`p-3 align-bottom font-medium ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y">{levels.map((row, i) => ({ row, i })).filter(({ row }) => preparationKind(row) === kind).sort((a,b) => kind === "matrix" ? (targetConcentration(a.row) ?? Infinity) - (targetConcentration(b.row) ?? Infinity) : a.i-b.i).map(({ row, i }, rank) => {
          const result = preparationResult(row, stock, stocks);
          const plan = preparationPlan(row, stock, stocks);
          return <tr key={row.id} className="hover:bg-accent">
            <td className="w-40 min-w-40 max-w-40 p-2"><NativeSelect className="w-full min-w-0" aria-label={`Stock ระดับ ${i + 1}`} value={row.stockId ?? ""} onChange={e => update(row.id, "stockId", e.target.value)}><option value="">Stock หลัก</option>{stocks.map(source => <option key={source.id} value={source.id}>{source.name || source.id}</option>)}</NativeSelect><p className="mt-2 whitespace-normal break-words text-xs text-muted-foreground">{row.stockId ? stocks.find(source => source.id === row.stockId)?.name || row.stockId : "Stock หลัก"}</p></td>
            <td className="w-40 min-w-40 max-w-40 space-y-2 p-2">{kind === "matrix" && <p className="text-xs font-medium">{["ต่ำ (Low)", "กลาง (Mid)", "สูง (High)"][rank] ?? "ระดับเกินแผน"}</p>}<Input className="h-9 w-full min-w-0 text-right tabular-nums" aria-label={`target ระดับ ${i + 1}`} type="number" min="0" step="any" value={row.targetUnit && row.targetUnit !== "mg/mL" ? targetConcentration(row) ?? "" : row.target} onChange={e => onChange(levels.map(level => level.id === row.id ? { ...level, target: e.target.value, targetUnit: "mg/mL" } : level))} /><p className="text-xs text-muted-foreground">Final volume (µL): <output aria-label={`finalVolume ระดับ ${i + 1}`} className="font-medium tabular-nums text-foreground">{row.finalVolume || "—"}</output></p></td>
            <td className="min-w-32 p-2 text-right tabular-nums">{plan?.stock.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
            <td className="min-w-28 p-2 text-right font-semibold tabular-nums"><output aria-label={`aliquot ระดับ ${i + 1}`}>{plan?.aliquotUl.toFixed(1) ?? "—"}</output></td>
            <td className="min-w-32 p-2 text-right tabular-nums">{plan ? plan.solventUl.toFixed(1) : <span className="text-destructive">ตรวจ Stock, Target, Final volume และ Matrix</span>}</td>
            {kind === "matrix" && <td className="min-w-28 p-2"><Input aria-label={`matrix ระดับ ${i + 1}`} readOnly={!!row.matrixCalculation} type="number" min="0" step="any" value={row.matrix} onChange={e => update(row.id, "matrix", e.target.value)} /></td>}
            <td className="min-w-32 p-2 text-right tabular-nums"><strong>{result?.actual.toLocaleString("en-US", { minimumFractionDigits: 5, maximumFractionDigits: 5 }) ?? "—"}</strong>{stock != null && !result && <p className="text-xs text-destructive">ตรวจค่าและปริมาตรรวม</p>}</td>
            <td className="p-2"><Button variant="ghost" size="icon" aria-label={`ลบระดับ ${i + 1}`} onClick={() => onChange(levels.filter(l => l.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></td></tr>;
        })}</tbody>
      </table>
    </div>
    </section>)}
    <p className="text-sm text-muted-foreground">คำแนะนำปิเปต = Target × ปริมาตรรวม ÷ C stock · ตารางนี้เป็นค่าคำนวณตามแผน ไม่ใช่บันทึกการปิเปตจริง · เก็บทศนิยมเต็มในการคำนวณ · 1 mg/mL = 1,000 µg/mL = 1,000 mg/L</p>
  </div>;
}
