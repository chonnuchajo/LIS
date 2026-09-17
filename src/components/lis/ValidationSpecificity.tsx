import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import ValidationDataGrid from "./ValidationDataGrid";
import { evaluateSpecificity, specificitySnapshot, type SpecificityContext, type SpecificitySettings } from "@/lib/validationSpecificity";
import { formatValidationNumber as fmt } from "@/lib/validationAdvanced";

export default function ValidationSpecificity({ settings, context, onChange, legacyBlank }: {
  settings: SpecificitySettings; context: SpecificityContext; onChange: (value: SpecificitySettings) => void; legacyBlank: string;
}) {
  const result = evaluateSpecificity(settings, context);
  const update = (key: keyof SpecificitySettings, value: string) => onChange({ ...settings, [key]: value });
  return <Card><CardHeader><CardTitle className="text-base">Blank และหลักฐานความจำเพาะ</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">กรอก Area ของสัญญาณรบกวน ณ ตำแหน่งสารเป้าหมาย กรอก 0 เมื่อได้ตรวจแล้วว่าไม่พบพีค สำหรับสารหลาย isomer ให้ใช้หลักการรวมพีคเดียวกับ Standard และระบุตำแหน่งพีคในบันทึกทบทวน</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.peakMode} onChange={e => onChange({ ...settings, peakMode: e.target.checked })} />ใช้ข้อมูลแยกรายพีค / isomer</label>
    {settings.peakMode && <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">{settings.peakNames.map((name, index) => <div key={index} className="flex items-end gap-1"><label className="space-y-2 text-sm">พีค {index + 1}<Input aria-label={`ชื่อพีค ${index + 1}`} value={name} onChange={e => onChange({ ...settings, peakNames: settings.peakNames.map((value, i) => i === index ? e.target.value : value) })} /></label><Button variant="ghost" size="sm" disabled={settings.peakNames.length <= 1} onClick={() => onChange({ ...settings, peakNames: settings.peakNames.filter((_, i) => i !== index) })}>ลบพีค {index + 1}</Button></div>)}<Button variant="outline" disabled={settings.peakNames.length >= 20} onClick={() => onChange({ ...settings, peakNames: [...settings.peakNames, `Peak ${settings.peakNames.length + 1}`] })}>เพิ่มพีค</Button></div>
      <p className="text-sm text-muted-foreground">หนึ่งแถวคือหนึ่ง Injection มี RT และ Area ของทุกพีคในแถวเดียวกัน คำนวณ RT %CV แยกรายพีค และ Area %RSD จากผลรวม Area ต่อ Injection · เมื่อเพิ่ม/ลบพีค ข้อมูลเดิมจะคงไว้ กรุณาตรวจจำนวนและลำดับคอลัมน์</p>
      <ValidationDataGrid label="Standard แยกรายพีค" columns={settings.peakNames.flatMap(name => [`${name} RT (min)`, `${name} Area`])} value={settings.peakStandardData} onChange={value => update("peakStandardData", value)} />
      <ValidationDataGrid label="Blank แยกรายพีค" columns={settings.peakNames.flatMap(name => [`${name} Solvent Area`, `${name} Matrix Area`])} value={settings.peakBlankData} onChange={value => update("peakBlankData", value)} />
      <label className="block space-y-2 text-sm">ฐานเปรียบเทียบ Blank รายพีค<NativeSelect aria-label="ฐานเปรียบเทียบ Blank รายพีค" value={settings.peakBlankBasis} onChange={e => update("peakBlankBasis", e.target.value)}><option value="total">Mean ผลรวม Standard Area</option><option value="individual">Mean Standard Area ของพีคนั้น</option></NativeSelect></label>
      <p className="text-xs text-muted-foreground">เลือกฐานตาม SOP โดยระบบตรวจผลรวม Blank ต่อ Mean ผลรวม Standard Area ด้วยทุกครั้ง เพื่อไม่ให้สัญญาณรบกวนหลายพีคถูกมองข้าม</p>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["พีค", "Mean RT", "RT SD", "RT %CV", "Mean Area", "Area SD", "Area %RSD"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{result.peaks.map((peak, index) => <tr key={index} className="hover:bg-accent"><td className="p-3">{peak.name}</td>{[peak.rt?.mean, peak.rt?.sd, peak.rt?.rsd, peak.area?.mean, peak.area?.sd, peak.area?.rsd].map((value, i) => <td className="p-3 tabular-nums" key={i}>{fmt(value)}</td>)}</tr>)}</tbody></table></div>
    </div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{([
      ["minStandards", "จำนวน Standard ขั้นต่ำ"], ["minBlanks", "จำนวน Blank แต่ละชนิดขั้นต่ำ"], ["rtLimit", "RT %CV ไม่เกิน"], ["areaLimit", "Area %RSD ไม่เกิน"], ["blankLimit", "Blank interference (%) ไม่เกิน"],
    ] as const).map(([key, label]) => <label className="space-y-2 text-sm" key={key}>{label}<Input type="number" step="any" value={settings[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
    <p className="text-sm text-muted-foreground">เลือกเกณฑ์ตาม SOP ของสารและเมทริกซ์นี้ หากกำหนดว่าต้องไม่พบสัญญาณรบกวน ให้ตั้งเกณฑ์ Blank เป็น 0%</p>
    {legacyBlank && <p className="rounded-lg bg-muted p-3 text-sm">งานเดิมระบุ Blank Area สูงสุด {legacyBlank} โปรดกรอกผลแต่ละครั้งด้านล่างเพื่อแยก Solvent Blank และ Matrix Blank ค่านี้เก็บไว้เป็นข้อมูลเดิมและไม่นำมาตัดสินผลแทนข้อมูลรายครั้ง</p>}
    {!settings.peakMode && <ValidationDataGrid label="ผล Blank รายครั้ง" columns={["Solvent Blank Area", "Matrix Blank Area"]} value={settings.blankData} onChange={value => update("blankData", value)} />}
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
