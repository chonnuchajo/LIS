import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { dilution, type PreparationLevel } from "@/lib/validationPreparation";

export default function ValidationPreparation({ stock, levels, onChange }: {
  stock: number | null;
  levels: PreparationLevel[];
  onChange: (levels: PreparationLevel[]) => void;
}) {
  const update = (id: string, key: keyof PreparationLevel, value: string) => onChange(levels.map(row => row.id === id ? { ...row, [key]: value } : row));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold">หัวข้อ 6–7 · แผนเตรียมสารและระดับที่ทดสอบ</h3>
        <p className="mt-1 text-sm text-muted-foreground">ปรับระดับและเกณฑ์ให้ตรงกับสารและวิธีที่ใช้ · ความเข้มข้นทุกช่องเป็น mg/mL</p></div>
      <Button variant="outline" onClick={() => onChange([...levels, { id: crypto.randomUUID(), purpose: "linearity", target: "", aliquot: "", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" }])}><Plus className="mr-2 h-4 w-4" />เพิ่มระดับ</Button>
    </div>
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["ใช้สำหรับ", "Target (mg/mL)", "ปิเปตจริง (µL)", "ปริมาตรรวม (µL)", "Matrix (µL)", "Actual (mg/mL)", "Recovery ต่ำ–สูง (%)", ""].map((h, i) => <th key={i} className="p-3 text-left font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{levels.map((row, i) => {
          const result = stock == null || !row.matrix.trim() ? null : dilution({ stockMgMl: stock, target: Number(row.target), unit: "mg/mL", finalUl: Number(row.finalVolume), actualAliquotUl: Number(row.aliquot), matrixUl: Number(row.matrix) });
          return <tr key={row.id} className="hover:bg-accent"><td className="p-2"><NativeSelect aria-label={`การใช้งานระดับ ${i + 1}`} value={row.purpose} onChange={e => update(row.id, "purpose", e.target.value)}><option value="linearity">Linearity</option><option value="accuracy">Accuracy / Precision</option><option value="suitability">Specificity / SST</option><option value="qc">QC</option></NativeSelect></td>
            {(["target", "aliquot", "finalVolume", "matrix"] as const).map(key => <td key={key} className="min-w-28 p-2"><Input aria-label={`${key} ระดับ ${i + 1}`} type="number" min="0" step="any" value={row[key]} onChange={e => update(row.id, key, e.target.value)} /></td>)}
            <td className="min-w-40 p-2 tabular-nums"><strong>{result?.actual.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</strong>{result && <p className="mt-1 text-xs text-muted-foreground">ปิเปตเพื่อให้ตรง Target: {result.suggestedAliquotUl.toFixed(3)} µL<br />Diluent: {result.diluentUl.toFixed(3)} µL</p>}{stock != null && !result && <p className="text-xs text-destructive">ตรวจค่าและปริมาตรรวม</p>}</td>
            <td className="p-2">{row.purpose === "accuracy" ? <div className="flex min-w-40 gap-2"><Input aria-label={`Recovery ต่ำ ระดับ ${i + 1}`} type="number" value={row.recoveryLow} onChange={e => update(row.id, "recoveryLow", e.target.value)} /><Input aria-label={`Recovery สูง ระดับ ${i + 1}`} type="number" value={row.recoveryHigh} onChange={e => update(row.id, "recoveryHigh", e.target.value)} /></div> : "—"}</td>
            <td className="p-2"><Button variant="ghost" size="icon" aria-label={`ลบระดับ ${i + 1}`} onClick={() => onChange(levels.filter(l => l.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></td></tr>;
        })}</tbody>
      </table>
    </div>
    <p className="text-sm text-muted-foreground">คำแนะนำปิเปต = Target × ปริมาตรรวม ÷ C stock · Actual ใช้ปริมาตรที่ปิเปตจริง ไม่เปลี่ยนเป็น Target โดยอัตโนมัติ · 1 mg/mL = 1,000 µg/mL = 1,000 mg/L</p>
  </div>;
}
