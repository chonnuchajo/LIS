import { Textarea } from "@/components/ui/textarea";
import { protocolFields, type ProtocolDetails } from "@/lib/validationProtocol";

export default function ValidationProtocol({ value, onChange, missing }: { value: ProtocolDetails; onChange: (value: ProtocolDetails) => void; missing: string[] }) {
  return <details className="rounded-lg border bg-card p-4 shadow-sm">
    <summary className="cursor-pointer text-base font-semibold">รายละเอียดวิธีและเนื้อหารายงาน · หัวข้อ 1–10</summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">กรอกให้ตรงกับสารและวิธีที่ใช้จริง ข้อมูลนี้จะอยู่ในรายงานพร้อมตารางคำนวณ การกรอกครบเป็นเพียงการตรวจความครบถ้วน ไม่ใช่การอนุมัติความถูกต้องทางวิชาการ</p>
      {missing.length > 0 && <p className="text-sm text-muted-foreground">หัวข้อหลักที่ยังไม่ระบุ: {missing.join(" · ")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">{protocolFields.map(([key, label, help]) => <label key={key} className="space-y-2 text-sm"><span className="font-medium">{label}</span><Textarea aria-label={label} maxLength={10000} className="min-h-28" value={value[key]} placeholder={help} onChange={event => onChange({ ...value, [key]: event.target.value })} /><span className="block text-xs text-muted-foreground">{help}</span></label>)}</div>
    </div>
  </details>;
}
