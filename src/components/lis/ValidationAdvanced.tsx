import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ValidationDataGrid from "./ValidationDataGrid";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { evaluatePrecision, evaluateQc, formatValidationNumber as fmt, type PrecisionSettings, type QcSettings, type ValidationCheck } from "@/lib/validationAdvanced";

export function ValidationResults({ checks }: { checks: ValidationCheck[] }) {
  return <div className="overflow-x-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["รายการตรวจ", "ผลคำนวณ", "เกณฑ์", "สถานะ"].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y">{checks.map((c, i) => <tr key={`${c.name}-${i}`} className="hover:bg-accent"><td className="p-3">{c.name}</td><td className="p-3 tabular-nums">{c.value}</td><td className="p-3">{c.criteria}</td><td className="p-3"><Badge variant={c.pass === false ? "red-soft" : c.pass ? "green-soft" : "yellow-soft"}>{c.pass == null ? "รอตรวจสอบ" : c.pass ? "Passed" : "Failed"}</Badge></td></tr>)}</tbody></table></div>;
}

export function PrecisionPanel({ settings, onChange, result }: {
  settings: PrecisionSettings; onChange: (value: PrecisionSettings) => void;
  result: ReturnType<typeof evaluatePrecision>;
}) {
  const update = (key: keyof PrecisionSettings, value: string) => onChange({ ...settings, [key]: value });
  return <Card><CardHeader><CardTitle className="text-base">Repeatability และ Intermediate Precision</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{([
      ["repeatabilityFactor", "ตัวคูณ Horwitz สำหรับ Repeatability"], ["repeatabilityLimit", "HorRat(r) ต้องน้อยกว่า"],
      ["intermediateLimit", "HorRat(IP) ต้องน้อยกว่า"], ["minDays", "จำนวนวันขั้นต่ำ"], ["minReplicates", "จำนวนซ้ำต่อระดับ/วันขั้นต่ำ"],
    ] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input type="number" step="any" value={settings[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
    <p className="text-sm text-muted-foreground">Horwitz RSDR = 2^(1 − 0.5 log10 C) โดย C เป็น mass fraction ของสารในวัสดุที่ประเมิน (เช่น 25% w/w = 0.25) ไม่ใช่ mg/mL · ตัวคูณ 1 ใช้ Horwitz เดิม; 0.67 ใช้แนวทาง Repeatability ของ CIPAC 3807 ต้องเลือกให้ตรง SOP</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 text-sm">ฐาน Horwitz: Target level (mg/mL), C (g/g)<ValidationDataGrid label="ฐาน Horwitz" columns={["Target (mg/mL)", "C (g/g)"]} value={settings.massFractions} onChange={value => update("massFractions", value)} /><span className="block text-muted-foreground">กรอกหนึ่งแถวต่อระดับ เลือกฐาน C จากวิธีที่อนุมัติ ไม่แปลงจากความเข้มข้นใน vial อัตโนมัติ</span></div>
      <div className="space-y-2 text-sm">ข้อมูลรายวัน: Day, Target level, Actual fortified, Found<ValidationDataGrid label="ข้อมูลรายวัน" columns={["วัน", "Target (mg/mL)", "Actual (mg/mL)", "Found (mg/mL)"]} value={settings.dailyData} onChange={value => update("dailyData", value)} /><span className="block text-muted-foreground">ความเข้มข้นเป็น mg/mL · หนึ่งแถวต่อตัวอย่างที่เตรียมแยกกัน · จำนวนซ้ำเท่ากันทุกวัน</span></div>
    </div>
    <ValidationResults checks={result.checks} />
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["ระดับ", "วัน", "Mean Recovery", "SD ภายในวัน", "SD ระหว่างวัน", "SD รวม", "RSD รวม"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y">{result.summaries.map(s => <tr key={s.level}><td className="p-3">{s.level}</td><td className="p-3">{s.days.length}</td><td className="p-3">{fmt(s.anova?.mean)}</td><td className="p-3">{fmt(s.anova?.withinSd)}</td><td className="p-3">{fmt(s.anova?.betweenSd)}</td><td className="p-3">{fmt(s.anova?.sd)}</td><td className="p-3">{fmt(s.anova?.rsd)}%</td></tr>)}</tbody></table></div>
    <p className="text-sm text-muted-foreground">ใช้ balanced one-way ANOVA บน Recovery: SD รวม = √(ความแปรปรวนภายในวัน + ระหว่างวัน) หากค่าประมาณความแปรปรวนระหว่างวันติดลบ จะใช้ 0 และยังคงส่วนภายในวัน</p>
    {result.errors.length > 0 && <ul role="alert" className="space-y-1 text-sm text-destructive">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}
  </CardContent></Card>;
}

export function QcPanel({ settings, onChange, result }: {
  settings: QcSettings; onChange: (value: QcSettings) => void;
  result: ReturnType<typeof evaluateQc>;
}) {
  const update = (key: keyof QcSettings, value: string | boolean) => onChange({ ...settings, [key]: value });
  return <Card><CardHeader><CardTitle className="text-base">ผลตัวอย่างและ QC · ส่วนเสริมตามหัวข้อ 11</CardTitle></CardHeader><CardContent className="space-y-4">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e => update("enabled", e.target.checked)} />รวมผลตัวอย่างและ QC ในรายงานนี้</label>
    {settings.enabled && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{([
        ["recoveryLow", "Recovery ต่ำ (%)"], ["recoveryHigh", "Recovery สูง (%)"], ["differenceLimit", "%Difference ไม่เกิน"],
        ["productLow", "เกณฑ์ผลิตภัณฑ์ต่ำ (%)"], ["productHigh", "เกณฑ์ผลิตภัณฑ์สูง (%)"],
      ] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input type="number" step="any" value={settings[key]} onChange={e => update(key, e.target.value)} /></label>)}
        <label className="space-y-2 text-sm">หน่วยเกณฑ์ผลิตภัณฑ์<NativeSelect value={settings.productUnit} onChange={e => update("productUnit", e.target.value)}><option value="ww">%w/w</option><option value="wv">%w/v</option></NativeSelect></label>
      </div>
      <div className="block space-y-2 text-sm">Sample: Weight (mg), Found (mg/mL), Volume (mL), DF, Density (g/mL)<ValidationDataGrid label="ผลตัวอย่าง" columns={["Weight (mg)", "Found (mg/mL)", "Volume (mL)", "DF", "Density (g/mL)"]} value={settings.sampleData} onChange={value => update("sampleData", value)} /><span className="block text-muted-foreground">DF คือการเจือจางเพิ่มเติมเท่านั้น · Density กรอก 0 เมื่อไม่ทราบและรายงานเฉพาะ %w/w; ต้องมีค่าที่วัดได้เพื่อประเมิน %w/v</span></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">Standard Check: Found, Actual standard (mg/mL) · 2 ชุด<ValidationDataGrid label="Standard Check" columns={["Found (mg/mL)", "Actual (mg/mL)"]} value={settings.standardData} onChange={value => update("standardData", value)} /></div>
        <div className="space-y-2 text-sm">Matrix Spike: Found หลังเติม, Unspiked, Added (mg/mL) · 2 ชุด<ValidationDataGrid label="Matrix Spike" columns={["Found (mg/mL)", "Unspiked (mg/mL)", "Added (mg/mL)"]} value={settings.spikeData} onChange={value => update("spikeData", value)} /><span className="block text-muted-foreground">Unspiked เป็นผลวัดก่อนเติมที่ปรับ dilution ให้เท่ากับสารละลายสุดท้ายแล้ว ไม่ใช้ค่าฉลากแทนโดยอัตโนมัติ</span></div>
      </div>
      <ValidationResults checks={result.checks} />
      <p className="text-sm text-muted-foreground">%w/w = Found × V × DF × 100 / W · %w/v = %w/w × Density · Spike Recovery = (Found − Unspiked) / Added × 100 · %Difference คำนวณจาก Recovery ของคู่ซ้ำ</p>
      {result.errors.length > 0 && <ul role="alert" className="space-y-1 text-sm text-destructive">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}
    </>}
  </CardContent></Card>;
}
