import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import ValidationDataGrid from "./ValidationDataGrid";
import { evaluateSpecificity, specificitySnapshot, type SpecificityContext, type SpecificitySettings } from "@/lib/validationSpecificity";

export default function ValidationSpecificity({ settings, context, onChange, legacyBlank }: {
  settings: SpecificitySettings; context: SpecificityContext; onChange: (value: SpecificitySettings) => void; legacyBlank: string;
}) {
  const result = evaluateSpecificity(settings, context);
  const update = (key: keyof SpecificitySettings, value: string) => onChange({ ...settings, [key]: value });
  return <Card><CardHeader><CardTitle className="text-base">Blank และหลักฐานความจำเพาะ</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">กรอก Area ของสัญญาณรบกวน ณ ตำแหน่งสารเป้าหมาย กรอก 0 เมื่อได้ตรวจแล้วว่าไม่พบพีค สำหรับสารหลาย isomer ให้ใช้หลักการรวมพีคเดียวกับ Standard และระบุตำแหน่งพีคในบันทึกทบทวน</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{([
      ["minStandards", "จำนวน Standard ขั้นต่ำ"], ["minBlanks", "จำนวน Blank แต่ละชนิดขั้นต่ำ"], ["rtLimit", "RT %CV ไม่เกิน"], ["areaLimit", "Area %RSD ไม่เกิน"], ["blankLimit", "Blank interference (%) ไม่เกิน"],
    ] as const).map(([key, label]) => <label className="space-y-2 text-sm" key={key}>{label}<Input type="number" step="any" value={settings[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
    <p className="text-sm text-muted-foreground">เลือกเกณฑ์ตาม SOP ของสารและเมทริกซ์นี้ หากกำหนดว่าต้องไม่พบสัญญาณรบกวน ให้ตั้งเกณฑ์ Blank เป็น 0%</p>
    {legacyBlank && <p className="rounded-lg bg-muted p-3 text-sm">งานเดิมระบุ Blank Area สูงสุด {legacyBlank} โปรดกรอกผลแต่ละครั้งด้านล่างเพื่อแยก Solvent Blank และ Matrix Blank ค่านี้เก็บไว้เป็นข้อมูลเดิมและไม่นำมาตัดสินผลแทนข้อมูลรายครั้ง</p>}
    <ValidationDataGrid label="ผล Blank รายครั้ง" columns={["Solvent Blank Area", "Matrix Blank Area"]} value={settings.blankData} onChange={value => update("blankData", value)} />
    <div className="grid gap-4 lg:grid-cols-3">{([
      ["standardReference", "หลักฐาน Standard Chromatogram"], ["solventReference", "หลักฐาน Solvent Blank"], ["matrixReference", "หลักฐาน Matrix Blank"],
    ] as const).map(([key, label]) => <label className="space-y-2 text-sm" key={key}>{label}<Input value={settings[key]} onChange={e => update(key, e.target.value)} placeholder="เลขที่เอกสาร / ชื่อไฟล์ / หน้า / Injection ID" /></label>)}</div>
    <label className="block space-y-2 text-sm">บันทึกการตรวจพีคและสัญญาณรบกวน<Textarea value={settings.reviewNotes} onChange={e => update("reviewNotes", e.target.value)} placeholder="ระบุพีค/isomer, RT, การแยกจากสัญญาณอื่น และเหตุผลประกอบผลทบทวน" /></label>
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-2 text-sm">ผลการทบทวนหลักฐาน<NativeSelect aria-label="ผลการทบทวนหลักฐาน" value={settings.decision} onChange={e => update("decision", e.target.value)}><option value="pending">ยังไม่สรุป</option><option value="passed">ผ่านการทบทวนความจำเพาะ</option><option value="failed">ไม่ผ่านการทบทวนความจำเพาะ</option></NativeSelect></label>
      <Button disabled={!result.canRecord} onClick={() => onChange({ ...settings, reviewedAt: new Date().toISOString(), reviewedSnapshot: specificitySnapshot(settings, context) })}>บันทึกผลทบทวน</Button>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{result.current ? `บันทึกผลทบทวนโดย ${context.reviewer} แล้ว` : settings.reviewedAt ? "ข้อมูลหรือเกณฑ์เปลี่ยนหลังทบทวน กรุณาตรวจแล้วบันทึกผลใหม่" : "กรอกผล Standard/Blank ให้ครบ พร้อมหลักฐาน ผลทบทวน และข้อมูลผู้ทบทวน, SOP, Calibration ID ในตั้งค่างาน"}</p>
    <p className="text-xs text-muted-foreground">รายการนี้บันทึกการทบทวนที่ผู้ใช้ระบุ ไม่ใช่ลายเซ็นอิเล็กทรอนิกส์หรือการอนุมัติรายงาน ไฟล์หลักฐานยังต้องเก็บตามเลขอ้างอิงที่กรอก</p>
  </CardContent></Card>;
}
