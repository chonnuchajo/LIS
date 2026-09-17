import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestValidationAi, type ValidationAiResult } from "@/lib/validationAi";

export default function ValidationAiReview() {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<ValidationAiResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  return <details className="rounded-lg border bg-card p-4 shadow-sm">
    <summary className="cursor-pointer text-base font-semibold">AI ช่วยทบทวนเอกสาร</summary>
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">วางเฉพาะข้อความที่ต้องการตรวจ เมื่อกดปุ่ม ข้อความนี้จะส่งให้ OpenAI ผ่าน server ของ LIS โดยใช้ key ที่ตั้งไว้ ผลเป็นข้อเสนอให้ทบทวน ไม่เปลี่ยนค่าในตารางหรือสถานะ Passed/Failed</p>
      <Textarea aria-label="ข้อความให้ AI ทบทวน" maxLength={30000} disabled={busy} className="min-h-32" value={text} onChange={e => { setText(e.target.value); setResult(null); setError(""); }} placeholder="เช่น ขั้นตอนเตรียมสาร เกณฑ์ และผลที่ต้องการตรวจความสอดคล้อง" />
      <Button type="button" disabled={busy || !text.trim()} onClick={async () => {
        const request = new AbortController(); controller.current = request; setBusy(true); setError(""); setResult(null);
        const timeout = setTimeout(() => request.abort(), 70000);
        try { const next = await requestValidationAi({ mode: "review", text }, request.signal); if (!request.signal.aborted) setResult(next); }
        catch (caught) { if (controller.current === request) setError(request.signal.aborted ? "คำขอหมดเวลา กรุณาลองใหม่" : caught instanceof Error ? caught.message : "อ่านข้อมูลไม่สำเร็จ"); }
        finally { clearTimeout(timeout); if (controller.current === request) setBusy(false); }
      }}>{busy ? "AI กำลังทบทวน…" : "ส่งข้อความให้ AI ทบทวน"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && <div role="status" className="space-y-2 rounded-lg border bg-muted p-3 text-sm"><p className="font-medium">ข้อเสนอจาก AI · ต้องตรวจเทียบต้นฉบับ</p><p className="whitespace-pre-wrap">{result.summary}</p><ul className="list-disc space-y-1 pl-5">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    </div>
  </details>;
}
