import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ValidationDataGrid from "./ValidationDataGrid";
import ValidationImportDialog from "./ValidationImportDialog";

const columns = ["Target (mg/mL)", "Actual fortified (mg/mL)", "Found (mg/mL)"];
export default function ValidationAccuracyGrid({ value, onChange, targets, readOnly = false }: { value: string; onChange: (value: string) => void; targets: number[]; readOnly?: boolean }) {
  const [raw, setRaw] = useState(false);
  const [editing, setEditing] = useState("");
  const rows = value ? value.split(/\r?\n/).map(line => line.split(/[,;\t]/)) : [];
  const levels = [...new Set([...targets, ...rows.filter(r => r[0]?.trim()).map(r => Number(r[0]))])].filter(n => Number.isFinite(n) && n > 0).sort((a,b) => a-b);
  const malformed = rows.some(r => r.length !== 3 || !r[0]?.trim() || !Number.isFinite(Number(r[0])) || Number(r[0]) <= 0);
  const write = (next: string[][]) => onChange(next.map(r => r.join("\t")).join("\n"));
  const numeric = (s: string) => s?.trim() && Number.isFinite(Number(s)) ? Number(s) : null;
  return <div className="space-y-3"><div className="flex flex-wrap justify-end gap-2">{!readOnly && <ValidationImportDialog label="ข้อมูล Accuracy" columns={columns} hasData={!!value} onApply={onChange} />}<Button variant="outline" onClick={() => setRaw(!raw)}>{raw ? "แสดงแยกความเข้มข้น" : "แก้ Target / วางข้อมูล"}</Button></div>
    {raw || malformed ? <ValidationDataGrid label="ข้อมูล Accuracy" columns={columns} decimals={3} value={value} onChange={onChange} readOnly={readOnly} /> : <div className="grid items-start gap-4 xl:grid-cols-3">{levels.map((level, rank) => {
      const group = rows.map((cells,index) => ({cells,index})).filter(r => Number(r.cells[0]) === level);
      const recoveries = group.map(({cells}) => { const actual=numeric(cells[1]), found=numeric(cells[2]); return actual != null && actual > 0 && found != null && found >= 0 ? found/actual*100 : null; });
      return <section key={level} className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm"><h3 className="bg-muted p-3 text-sm font-semibold">{["ต่ำ (Low)", "กลาง (Mid)", "สูง (High)"][rank] ?? "ระดับเพิ่มเติม"} · {level.toFixed(3)} mg/mL</h3><div className="overflow-x-auto"><table className="w-full table-fixed text-sm"><thead className="text-muted-foreground"><tr><th className="w-10 p-2">ซ้ำ</th><th className="p-2">Found<br/>mg/mL</th><th className="p-2">Fortified<br/>mg/mL</th><th className="w-20 p-2">Recovery<br/>%</th><th className="w-10" /></tr></thead><tbody className="divide-y">{group.map(({cells,index},rep) => <tr key={index}><td className="p-2">{rep+1}</td>{[2,1].map(col => { const n=numeric(cells[col]); const id=`${index}:${col}`; return <td key={col} className="p-1"><Input aria-label={`Accuracy ${level} ซ้ำ ${rep+1} ${col === 2 ? "Found" : "Fortified"}`} readOnly={readOnly} inputMode="decimal" className="h-9 w-full min-w-0 px-2 text-right tabular-nums" value={editing === id || n == null ? cells[col] : n.toFixed(3)} onFocus={() => setEditing(id)} onBlur={() => setEditing("")} onChange={e => write(rows.map((r,i) => i === index ? r.map((v,c) => c === col ? e.target.value : v) : r))}/></td>; })}<td className="p-2 text-right tabular-nums">{recoveries[rep]?.toFixed(2) ?? "—"}</td><td><Button size="icon" variant="ghost" disabled={readOnly} aria-label={`ลบ Accuracy ${level} ซ้ำ ${rep+1}`} onClick={() => write(rows.filter((_,i) => i !== index))}>×</Button></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 border-t p-2"><Button size="sm" variant="outline" disabled={readOnly} onClick={() => write([...rows,[String(level),"",""]])}>เพิ่มแถว</Button><span className="text-xs">Mean Recovery: {recoveries.length && recoveries.every(v => v != null) ? (recoveries.reduce((sum,v) => sum + v!,0)/recoveries.length).toFixed(2) : "—"}%</span></div></section>;
    })}{!levels.length && <p className="text-sm text-muted-foreground">กำหนดระดับความเข้มข้นในแผนเตรียมสาร หรือนำเข้าข้อมูล Accuracy</p>}</div>}
  </div>;
}
