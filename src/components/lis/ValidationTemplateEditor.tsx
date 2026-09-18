import { sourceTemplate } from "@/lib/validationSourceTemplate";
import { Input } from "@/components/ui/input";

export default function ValidationTemplateEditor({ analyte, values, onChange }: { analyte: string; values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  return <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
    <h2 className="text-base font-semibold">Template รายงานจากไฟล์ต้นฉบับ · ครบหัวข้อ 1–11</h2>
    <p className="text-sm text-muted-foreground">ใช้ข้อความจาก {sourceTemplate.sourceFile} ทั้ง {sourceTemplate.sourcePageCount} หน้า ชื่อสาร ความเข้มข้น ตาราง และผลคำนวณเปลี่ยนตามงานปัจจุบัน ข้อความวิธีและเกณฑ์คงตามแม่แบบ</p>
    <details><summary className="cursor-pointer text-sm font-medium">ดูข้อความต้นฉบับทุกหัวข้อ</summary><div className="mt-3 max-h-96 space-y-3 overflow-y-auto">{sourceTemplate.blocks.filter(block => block.type === "text").map((block, i) => <p key={i} className="whitespace-pre-line text-sm">{block.source.split("Cypermethrin").join(analyte)}</p>)}</div></details>
    <details><summary className="cursor-pointer text-sm font-medium">ปรับค่าผลในข้อความรายงาน / รายละเอียดการเตรียม QC</summary><p className="my-3 text-sm text-muted-foreground">เว้นว่างเพื่อใช้ผลคำนวณของงานนี้ ค่าเดิมแสดงเพื่อช่วยระบุตำแหน่งในแม่แบบเท่านั้น ไม่ถูกนำมาใช้เป็นผลใหม่ ค่าที่ระบบยังไม่มีจะแสดง — ในรายงาน</p><div className="grid max-h-96 gap-3 overflow-y-auto md:grid-cols-2">{Object.entries(sourceTemplate.variables).map(([key, variable]) => <label key={key} className="space-y-1 rounded-lg border p-3 text-sm"><span className="font-medium">หัวข้อ {variable.section} · ค่าเดิม {variable.original}</span><span className="block text-xs text-muted-foreground">{variable.context.split("{{analyte}}").join(analyte)}</span><Input aria-label={`ค่ารายงาน ${key}`} inputMode="decimal" value={values[key] ?? ""} maxLength={200} placeholder="ใช้ผลคำนวณอัตโนมัติ" onChange={event => onChange({ ...values, [key]: event.target.value })} /></label>)}</div></details>
  </section>;
}
