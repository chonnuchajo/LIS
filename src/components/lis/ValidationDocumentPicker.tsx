import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { mapDocumentRows, type DocumentPart, type ValidationDocument } from "@/lib/validationDocumentData";

export default function ValidationDocumentPicker({ columns, onSelect }: { columns: string[]; onSelect: (text: string) => void }) {
  const [reader, setReader] = useState<ValidationDocument | null>(null);
  const [part, setPart] = useState<DocumentPart | null>(null);
  const [partIndex, setPartIndex] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [first, setFirst] = useState("1"), [last, setLast] = useState("1");
  const [mapping, setMapping] = useState(columns.map(() => -1));
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), active = useRef<ValidationDocument | null>(null), version = useRef(0);
  useEffect(() => () => { version.current++; void active.current?.dispose(); active.current = null; }, []);
  const loadPart = async (document: ValidationDocument, index: number) => {
    const token = ++version.current;
    setBusy(true); setError(""); setPart(null); setPartIndex(index); setReviewed(false); onSelect("");
    try {
      const next = await document.readPart(index);
      if (token !== version.current) return;
      setPart(next); setFirst("1"); setLast(String(next.rows.length)); setMapping(columns.map(() => -1)); setPreviewPage(0);
    } catch (caught) { if (token === version.current) setError(caught instanceof Error ? caught.message : "อ่านชีต/หน้าไม่สำเร็จ"); }
    finally { if (token === version.current) setBusy(false); }
  };
  const mapped = mapDocumentRows(part?.rows ?? [], Number(first), Number(last), mapping);
  const width = Math.max(0, ...(part?.rows.map(row => row.length) ?? []));
  const resetReview = () => { setReviewed(false); onSelect(""); };
  return <div className="space-y-3 rounded-lg border bg-card p-3">
    <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>เลือก Excel / PDF</Button>
    <input ref={input} type="file" accept=".xlsx,.pdf" className="hidden" aria-label="ไฟล์ Excel หรือ PDF" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      const token = ++version.current;
      setBusy(true); setError(""); setPart(null); setReader(null); onSelect("");
      try {
        await active.current?.dispose(); active.current = null;
        const { openValidationDocument } = await import("@/lib/validationDocuments");
        const next = await openValidationDocument(file);
        if (token !== version.current) { await next.dispose(); return; }
        active.current = next; setReader(next); await loadPart(next, 0);
      } catch (caught) { if (token === version.current) { setBusy(false); setError(caught instanceof Error ? caught.message : "อ่านไฟล์ไม่สำเร็จ"); } }
    }} />
    <p className="text-xs text-muted-foreground">อ่าน .xlsx และ PDF ในเบราว์เซอร์ · เลือกช่วงแถวและคอลัมน์ที่ต้องใช้ · PDF แบบสแกนยังต้องใช้ OCR</p>
    {busy && <p role="status" className="text-sm">กำลังอ่านเอกสาร…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {reader && <label className="block space-y-2 text-sm">{reader.name}<NativeSelect aria-label="ชีตหรือหน้าเอกสาร" disabled={busy} value={partIndex} onChange={e => void loadPart(reader, Number(e.target.value))}>{reader.parts.map((name, index) => <option key={index} value={index}>{name}</option>)}</NativeSelect></label>}
    {part && <>
      <p className="text-sm text-muted-foreground">{part.warning}</p>
      {part.preview && <details><summary className="cursor-pointer text-sm font-medium">ดูภาพหน้า PDF ต้นฉบับ</summary><img src={part.preview} alt={`${reader?.name} ${reader?.parts[partIndex]}`} className="mt-2 h-auto w-full rounded-lg border" /></details>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">ข้อมูลต้นทาง {part.rows.length} แถว · แสดงแถว {part.rows.length ? previewPage * 100 + 1 : 0}–{Math.min((previewPage + 1) * 100, part.rows.length)}</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={previewPage === 0} onClick={() => setPreviewPage(page => page - 1)}>แถวก่อนหน้า</Button><Button type="button" size="sm" variant="outline" disabled={(previewPage + 1) * 100 >= part.rows.length} onClick={() => setPreviewPage(page => page + 1)}>แถวถัดไป</Button></div></div>
      <div className="max-h-64 overflow-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-2">แถว</th>{Array.from({ length: width }, (_, index) => <th className="p-2" key={index}>คอลัมน์ {index + 1}</th>)}</tr></thead><tbody className="divide-y">{part.rows.slice(previewPage * 100, (previewPage + 1) * 100).map((row, index) => <tr key={index} className="hover:bg-accent"><td className="p-2">{previewPage * 100 + index + 1}</td>{Array.from({ length: width }, (_, column) => <td key={column} className="max-w-64 whitespace-pre-wrap break-words p-2">{row[column] ?? ""}</td>)}</tr>)}</tbody></table></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm">แถวเริ่มต้น<Input aria-label="แถวเริ่มต้น" type="number" min="1" value={first} onChange={e => { setFirst(e.target.value); resetReview(); }} /></label><label className="space-y-2 text-sm">แถวสุดท้าย<Input aria-label="แถวสุดท้าย" type="number" min="1" value={last} onChange={e => { setLast(e.target.value); resetReview(); }} /></label></div>
      <div className="grid gap-3 sm:grid-cols-2">{columns.map((column, index) => <label className="space-y-2 text-sm" key={index}>{column}<NativeSelect aria-label={`คอลัมน์ต้นทางสำหรับ ${column}`} value={mapping[index]} onChange={e => { setMapping(old => old.map((value, i) => i === index ? Number(e.target.value) : value)); resetReview(); }}><option value={-1}>เลือกคอลัมน์ต้นทาง</option>{Array.from({ length: width }, (_, i) => <option key={i} value={i}>คอลัมน์ {i + 1}</option>)}</NativeSelect></label>)}</div>
      {mapped.error && <p className="text-sm text-muted-foreground">{mapped.error}</p>}
      {reader?.kind === "pdf" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => { setReviewed(e.target.checked); if (!e.target.checked) onSelect(""); }} />ตรวจเทียบช่วงแถวและคอลัมน์กับหน้า PDF ต้นฉบับแล้ว</label>}
      <Button type="button" variant="secondary" disabled={mapped.text == null || busy || (reader?.kind === "pdf" && !reviewed)} onClick={() => { if (mapped.text != null) onSelect(mapped.text); }}>ใช้ช่วงนี้ในตัวอย่างนำเข้า</Button>
    </>}
  </div>;
}
