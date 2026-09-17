import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Keep invalid and extra cells visible: editing must never silently discard evidence. */
export default function ValidationDataGrid({ label, columns, value, onChange, placeholder, readOnly = false }: {
  label: string; columns: string[]; value: string; onChange: (value: string) => void; placeholder?: string; readOnly?: boolean;
}) {
  const id = useId();
  const [raw, setRaw] = useState(false);
  const lines = value === "" ? [] : value.split(/\r?\n/);
  const rows = lines.map(line => line.split(/[,;\t]/));
  const width = Math.max(columns.length, ...rows.map(row => row.length));
  const writeRows = (next: string[][]) => onChange(next.map(row => row.join("\t")).join("\n"));
  const edit = (row: number, column: number, text: string) => {
    const next = rows.map(cells => [...cells]);
    while (next[row].length < columns.length) next[row].push("");
    next[row][column] = text;
    writeRows(next);
  };
  return <div className="space-y-3" role="group" aria-labelledby={id}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p id={id} className="text-sm font-medium">{label}</p>
      <Button type="button" size="sm" variant="outline" aria-pressed={raw} onClick={() => setRaw(!raw)}>{raw ? "แสดงตาราง" : "วางข้อมูล / ดูข้อความ"}</Button>
    </div>
    {readOnly && <p className="text-xs text-muted-foreground">คำนวณจาก Area · แก้ข้อมูลในส่วน Calibration และการเตรียมรายตัวอย่าง</p>}
    {raw ? <Textarea readOnly={readOnly} aria-label={label} className="min-h-40 font-mono text-sm" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /> : <>
      <div className="max-h-96 overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="p-2">แถว</th>{Array.from({ length: width }, (_, column) => <th className="p-2 font-medium" key={column}>{columns[column] ?? `ช่องเกิน ${column + 1}`}</th>)}<th className="p-2">ลบ</th></tr></thead>
          <tbody className="divide-y">{rows.map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-accent">
            <td className="p-2 tabular-nums">{rowIndex + 1}</td>
            {Array.from({ length: width }, (_, column) => {
              const cell = row[column] ?? "";
              const invalid = column >= columns.length || cell.trim() === "" || !Number.isFinite(Number(cell)) || Number(cell) < 0;
              return <td key={column} className="p-2"><Input readOnly={readOnly} aria-label={`${label} แถว ${rowIndex + 1} ${columns[column] ?? `ช่องเกิน ${column + 1}`}`} aria-invalid={invalid} title={invalid ? "ต้องเป็นตัวเลขไม่ติดลบและจำนวนช่องตรงกับหัวตาราง" : undefined} inputMode="decimal" className={`min-w-24 tabular-nums ${invalid ? "border-destructive" : ""}`} value={cell} onChange={event => edit(rowIndex, column, event.target.value)} /></td>;
            })}
            <td className="p-2"><Button type="button" size="icon" variant="ghost" disabled={readOnly} aria-label={`ลบ ${label} แถว ${rowIndex + 1}`} onClick={() => writeRows(rows.filter((_, index) => index !== rowIndex))}><Trash2 className="h-4 w-4" /></Button></td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล เพิ่มแถวเพื่อกรอกค่า หรือเลือกวางข้อมูลจาก Excel</p>}
      </div>
      <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={() => writeRows([...rows, columns.map(() => "")])}><Plus className="mr-2 h-4 w-4" />เพิ่มแถว</Button>
      <p className="text-xs text-muted-foreground">ช่องขอบแดงคือค่าที่ต้องแก้ไข · หนึ่งแถวต่อผลวัด · วางหลายแถวผ่าน “วางข้อมูล / ดูข้อความ”</p>
    </>}
  </div>;
}
