import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { prepareValidationImport } from "@/lib/validationImport";
import type { ConcentrationUnit } from "@/lib/validationPreparation";

export default function ValidationImportDialog({ label, columns, hasData, onApply }: {
  label: string; columns: string[]; hasData: boolean; onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [hasHeader, setHasHeader] = useState(false);
  const [units, setUnits] = useState<Record<number, ConcentrationUnit>>({});
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const changeOpen = (next: boolean) => { readVersion.current++; setLoading(false); setOpen(next); };
  const concentrationColumns = columns.flatMap((column, index) => column.includes("(mg/mL)") ? [{ column, index }] : []);
  const conversionUnits = Object.fromEntries(concentrationColumns.map(({ index }) => [index, units[index] ?? "mg/mL"])) as Record<number, ConcentrationUnit>;
  const result = prepareValidationImport(source, columns, conversionUnits, hasHeader);
  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => { setSource(""); setUnits({}); setHasHeader(false); setFileError(""); changeOpen(true); }}>นำเข้า / แปลงหน่วย</Button>
    <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>นำเข้า {label}</DialogTitle><DialogDescription>วางตารางจาก Excel หรือเลือก CSV / TSV แล้วตรวจตัวอย่างก่อนนำไปคำนวณ</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={loading} onClick={() => file.current?.click()}>เลือก CSV / TSV</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />แถวแรกเป็นหัวตาราง</label>
      </div>
      <input ref={file} type="file" accept=".csv,.tsv,.txt" className="hidden" aria-label={`ไฟล์นำเข้า ${label}`} onChange={async e => {
        const selected = e.target.files?.[0]; e.target.value = "";
        if (!selected) return;
        if (selected.size > 2 * 1024 * 1024) { setFileError("ไฟล์ต้องไม่เกิน 2 MB"); return; }
        const version = ++readVersion.current;
        setLoading(true); setFileError("");
        try { const text = await selected.text(); if (version === readVersion.current) setSource(text); }
        catch { if (version === readVersion.current) setFileError("อ่านไฟล์ไม่ได้ กรุณาเลือกใหม่หรือวางข้อความ"); }
        finally { if (version === readVersion.current) setLoading(false); }
      }} />
      <p className="text-sm text-muted-foreground">ลำดับคอลัมน์: {columns.join(" → ")} · ใช้จุดทศนิยม ไม่ใส่เครื่องหมายคั่นหลักพัน</p>
      <Textarea aria-label="ข้อมูลต้นฉบับที่จะนำเข้า" className="min-h-32 font-mono" value={source} disabled={loading} onChange={e => { setSource(e.target.value); setFileError(""); }} />
      {concentrationColumns.length > 0 && <div className="space-y-3">
        <p className="text-sm font-medium">หน่วยต้นทางของแต่ละคอลัมน์</p>
        <div className="grid gap-3 sm:grid-cols-3">{concentrationColumns.map(({ column, index }) => <label key={index} className="space-y-2 text-sm">{column.replace(" (mg/mL)", "")}<NativeSelect aria-label={`หน่วยต้นทาง ${column}`} value={units[index] ?? "mg/mL"} onChange={e => setUnits(old => ({ ...old, [index]: e.target.value as ConcentrationUnit }))}>{["mg/mL", "µg/mL", "mg/L"].map(unit => <option key={unit}>{unit}</option>)}</NativeSelect></label>)}</div>
        <p className="text-sm text-muted-foreground">ตัวอย่างและข้อมูลที่นำไปคำนวณใช้ mg/mL: 500 µg/mL = 500 mg/L = 0.5 mg/mL · ไม่แปลง Area, RT, น้ำหนัก, ปริมาตร หรือ C (g/g)</p>
      </div>}
      {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
      {source && result.errors.length > 0 && <div role="alert" className="text-sm text-destructive"><p>ยังนำเข้าไม่ได้ ({result.errors.length} จุด)</p><ul className="list-disc pl-5">{result.errors.slice(0, 10).map((error, index) => <li key={index}>{error}</li>)}</ul>{result.errors.length > 10 && <p>แสดง 10 จุดแรก กรุณาแก้ข้อมูลต้นทางแล้วตรวจใหม่</p>}</div>}
      {result.text != null && <>
        <p className="text-sm font-medium">ตัวอย่างหลังแปลง · {result.rows.length} แถว{result.rows.length > 20 ? " (แสดง 20 แถวแรก)" : ""}</p>
        <div className="max-h-60 overflow-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{columns.map((column, index) => <th key={index} className="p-2">{column}</th>)}</tr></thead><tbody className="divide-y">{result.rows.slice(0, 20).map((row, index) => <tr key={index} className="hover:bg-accent">{row.map((cell, column) => <td key={column} className="p-2 tabular-nums">{cell}</td>)}</tr>)}</tbody></table></div>
      </>}
      {hasData && <p className="text-sm text-muted-foreground">การนำเข้าจะแทนที่ข้อมูลทั้งตารางนี้ ตรวจตัวอย่างให้ครบก่อนกดปุ่ม</p>}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-background py-2"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>ยกเลิก</Button><Button type="button" disabled={result.text == null || !!fileError || loading} onClick={() => { if (result.text != null && !loading && !fileError) { onApply(result.text); changeOpen(false); } }}>{hasData ? "แทนที่ตารางด้วยข้อมูลที่ตรวจแล้ว" : "ใช้ข้อมูลที่ตรวจแล้ว"}</Button></div>
    </DialogContent></Dialog>
  </>;
}
