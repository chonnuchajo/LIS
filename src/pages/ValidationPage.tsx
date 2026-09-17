import { useRef, useState, type ReactNode } from "react";
import { Calculator, Download, FileCheck2, FlaskConical, Upload, ShieldCheck } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseMeasurements, regression, stats } from "@/lib/validationCalculator";
import ValidationPreparation from "@/components/lis/ValidationPreparation";
import { defaultPreparationLevels, positiveNumber } from "@/lib/validationPreparation";

const names = ["Specificity", "Linearity", "Accuracy & Precision", "Overall Summary"];
const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 5 });
type Check = { name: string; value: string; criteria: string; pass: boolean | null };
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}
function Results({ checks }: { checks: Check[] }) {
  return <div className="overflow-x-auto rounded-lg border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["รายการตรวจ", "ผลคำนวณ", "เกณฑ์", "สถานะ"].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y">{checks.map(c => <tr key={c.name} className="hover:bg-accent"><td className="p-3">{c.name}</td><td className="p-3 tabular-nums">{c.value}</td><td className="p-3">{c.criteria}</td><td className="p-3"><Badge variant={c.pass === false ? "destructive" : c.pass ? "default" : "secondary"}>{c.pass == null ? "รอตรวจสอบ" : c.pass ? "Passed" : "Failed"}</Badge></td></tr>)}</tbody></table></div>;
}

export default function ValidationPage() {
  const [tab, setTab] = useState("0");
  const [title, setTitle] = useState("Cypermethrin — Method Validation");
  const [analyte, setAnalyte] = useState("Cypermethrin");
  const [method, setMethod] = useState("GC-FID");
  const [preparationLevels, setPreparationLevels] = useState(defaultPreparationLevels);
  const [prep, setPrep] = useState(["", "", "25", "250", "1000"]);
  const [texts, setTexts] = useState(["", "", ""]);
  const [blank, setBlank] = useState("");
  const [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [weight, purity, volume, aliquot, finalVolume] = prep.map(Number);
  const validPrep = prep.every(v => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) > 0) && purity <= 100 && aliquot <= finalVolume;
  const stock = validPrep ? weight * purity / 100 / volume : null;
  const actual = stock == null ? null : stock * aliquot / finalVolume;
  const parsed = texts.map((t, i) => parseMeasurements(t, i === 2 ? 3 : 2));
  const specific = parsed[0].errors.length ? [] : parsed[0].rows;
  const rt = stats(specific.map(r => r[0]));
  const area = stats(specific.map(r => r[1]));
  const fit = parsed[1].errors.length ? null : regression(parsed[1].rows);
  const levels = [...new Set(parsed[1].rows.map(r => r[0]))].sort((a, b) => a - b);
  const plannedLinearity = preparationLevels.filter(r => r.purpose === "linearity");
  const plannedAccuracy = preparationLevels.filter(r => r.purpose === "accuracy");
  const accuracyTargets = plannedAccuracy.map(r => Number(r.target));
  const planErrors: string[] = [];
  if (plannedLinearity.length < 3) planErrors.push("แผน Linearity: ต้องกำหนดอย่างน้อย 3 ระดับ");
  if (!plannedAccuracy.length) planErrors.push("แผน Accuracy: ต้องกำหนดระดับที่ต้องการทดสอบ");
  if (preparationLevels.some(r => positiveNumber(r.target) == null)) planErrors.push("แผนเตรียมสาร: Target ต้องมากกว่า 0");
  if (new Set(accuracyTargets).size !== accuracyTargets.length) planErrors.push("แผน Accuracy: ระดับเป้าหมายซ้ำกัน");
  if (plannedAccuracy.some(r => positiveNumber(r.recoveryLow) == null || positiveNumber(r.recoveryHigh) == null || Number(r.recoveryLow) >= Number(r.recoveryHigh))) planErrors.push("แผน Accuracy: ตรวจเกณฑ์ Recovery ต่ำและสูง");
  const linearReady = planErrors.length === 0 && !!fit && levels.length === plannedLinearity.length && levels.every(x => x > 0 && parsed[1].rows.filter(r => r[0] === x).length >= 3);
  const linearStats = levels.map(x => ({ x, stats: stats(parsed[1].rows.filter(r => r[0] === x).map(r => r[1])) }));
  const blankValid = blank.trim() !== "" && Number.isFinite(Number(blank)) && Number(blank) >= 0;
  const interference = blankValid && area && area.mean > 0 ? Number(blank) / area.mean * 100 : null;
  const ready = specific.length >= 6;
  const specificityChecks: Check[] = [
    { name: "RT %CV", value: fmt(rt?.rsd), criteria: "≤ 0.5% · Standard ≥ 6 ครั้ง", pass: ready && rt?.rsd != null ? rt.rsd <= 0.5 : null },
    { name: "Area %RSD", value: fmt(area?.rsd), criteria: "≤ 2.0%", pass: ready && area?.rsd != null ? area.rsd <= 2 : null },
    { name: "Blank interference", value: fmt(interference), criteria: "≤ 0.5% ของ Mean Standard Area", pass: ready && interference != null ? interference <= 0.5 : null },
  ];
  const linearityChecks: Check[] = [
    { name: "R²", value: fmt(fit?.r2), criteria: `≥ 0.995 · ${plannedLinearity.length} ระดับ ระดับละ ≥ 3 ครั้ง`, pass: linearReady ? fit.r2 >= 0.995 : null },
    ...linearStats.map(l => ({ name: `Area %RSD ที่ ${l.x} mg/mL`, value: fmt(l.stats?.rsd), criteria: "≤ 5.0%", pass: linearReady && l.stats?.rsd != null ? l.stats.rsd <= 5 : null })),
  ];
  const recoveryPoints = parsed[2].rows.map(([level, expected, found], i) => ({ index: i + 1, level, expected, found, recovery: expected > 0 ? found / expected * 100 : null }));
  const accuracyChecks: Check[] = plannedAccuracy.map(planned => {
    const level = Number(planned.target);
    const rows = recoveryPoints.filter(r => r.level === level);
    const values = rows.flatMap(r => r.recovery == null ? [] : [r.recovery]);
    const summary = stats(values);
    const low = Number(planned.recoveryLow), high = Number(planned.recoveryHigh);
    return { name: `Recovery ${level} mg/mL (n=${rows.length})`, value: `${fmt(summary?.mean)}% · RSD ${fmt(summary?.rsd)}%`, criteria: `${low}–${high}% ทุกรายการ · ≥ 10 ตัวอย่าง`, pass: parsed[2].errors.length === 0 && rows.length >= 10 && values.length === rows.length ? values.every(v => v >= low && v <= high) : null };
  });
  const checks: Check[] = [...specificityChecks, ...linearityChecks, ...accuracyChecks,
    { name: "ทบทวน Chromatogram / Matrix Blank", value: "ต้องตรวจหลักฐานประกอบ", criteria: "ผู้ทบทวนยืนยันความจำเพาะ", pass: null },
    { name: "Horwitz / HorRat", value: "ยังไม่ประเมิน", criteria: "ต้องยืนยันสูตรและฐานความเข้มข้น", pass: null },
    { name: "Intermediate Precision", value: "ยังไม่ประเมิน", criteria: "ข้อมูลดิบรายวันและวิธีประเมินที่อนุมัติ", pass: null },
  ];
  const errors = [...planErrors, ...parsed.flatMap((p, i) => p.errors.map(e => `${names[i]} · ${e}`))];
  if (recoveryPoints.some(p => p.expected <= 0 || !accuracyTargets.includes(p.level))) errors.push("Accuracy: Actual ต้องมากกว่า 0 และระดับเป้าหมายต้องตรงกับแผนเตรียมสาร");
  const invalidAccuracy = errors.some(e => e.startsWith("Accuracy"));
  if (invalidAccuracy || planErrors.length) accuracyChecks.forEach(c => { c.pass = null; });
  const passed = checks.filter(c => c.pass === true).length;
  const failed = checks.filter(c => c.pass === false).length;
  const download = () => {
    const report = { title, analyte, method, preparationLevels, template: "ปรับจาก WI-06-04-03 · ต้องทบทวนเกณฑ์สำหรับสารที่เลือก", generatedAt: new Date().toISOString(), status: failed || errors.length ? "พบข้อผิดพลาด / ต้องทบทวน" : "รอตรวจสอบ", preparation: { weightMg: prep[0], purityPercent: prep[1], stockVolumeMl: prep[2], aliquotUl: prep[3], finalVolumeUl: prep[4], stock, actual }, rawData: texts, blankArea: blank, calculations: checks, errors };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "validation-report.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const updateText = (value: string) => setTexts(old => old.map((v, i) => i === Number(tab) ? value : v));
  return <AppLayout title="Validation"><div className="space-y-6">
    <PageHeader title="Validation" description="AI Data & Document Validation Checker · ตรวจข้อมูล คำนวณ และสรุปผลในพื้นที่เดียว" actions={<Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />ดาวน์โหลดรายงาน JSON</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><div><h2 className="text-base font-semibold">พื้นที่ตรวจสอบวิธีวิเคราะห์</h2><p className="text-sm text-muted-foreground">{analyte || "ยังไม่ระบุสาร"} · {method || "ยังไม่ระบุวิธี"} · กำหนดช่วงความเข้มข้นในแผนเตรียมสาร</p></div></div><Badge variant="secondary">ฉบับร่าง · รอผู้ทบทวน</Badge></div>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[["รายการตรวจ", checks.length], ["Passed", passed], ["Failed", failed], ["รอตรวจสอบ", checks.length - passed - failed]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div>
    <details className="rounded-lg border bg-card p-4 shadow-sm"><summary className="cursor-pointer text-base font-semibold">ตั้งค่างานและเตรียมสาร · หัวข้อ 6–7</summary><div className="mt-4 space-y-4"><Panel title="ข้อมูลการเตรียมสาร"><label className="block space-y-2 text-sm">ชื่องาน / เลขที่รายงาน<Input value={title} onChange={e => setTitle(e.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{["น้ำหนักมาตรฐาน (mg)", "Purity (%)", "ปริมาตร Stock (mL)", "ปริมาตรที่ปิเปต (µL)", "ปริมาตรสุดท้าย (µL)"].map((label, i) => <label className="space-y-2 text-sm" key={label}>{label}<Input type="number" min="0" step="any" value={prep[i]} onChange={e => setPrep(old => old.map((v, n) => n === i ? e.target.value : v))} /></label>)}</div><div className="flex flex-wrap gap-4 rounded-md bg-muted p-3 text-sm"><span>C stock: <strong>{fmt(stock)} mg/mL</strong></span><span>C actual: <strong>{fmt(actual)} mg/mL</strong></span><span className="text-muted-foreground">C stock = น้ำหนัก × Purity/100 ÷ ปริมาตร</span></div><p className="text-sm text-muted-foreground">ใช้ช่วยคำนวณการเตรียมทีละชุด แล้วนำ C actual ไปใส่ในตารางของชุดนั้น ข้อมูลอยู่ในหน้านี้จนกว่าจะออกหรือรีเฟรชหน้า</p>{!validPrep && prep[0] && prep[1] && <p className="text-sm text-destructive">ตรวจค่าบวกทุกช่อง, Purity ไม่เกิน 100% และปริมาตรที่ปิเปตไม่เกินปริมาตรสุดท้าย</p>}</Panel>
    <Panel title="กำหนดสารและวิธีสำหรับรายงาน">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">ชื่อสาร<Input value={analyte} onChange={e => setAnalyte(e.target.value)} /></label>
        <label className="space-y-2 text-sm">วิธี / เครื่องมือ<Input value={method} onChange={e => setMethod(e.target.value)} /></label>
      </div>
      <ValidationPreparation stock={stock} levels={preparationLevels} onChange={setPreparationLevels} />
    </Panel>
    </div></details>
    <Tabs value={tab} onValueChange={v => { setTab(v); setNotice(""); }}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border bg-card p-2 shadow-sm lg:grid-cols-4">
        {names.map((n, i) => <TabsTrigger className="min-h-20 flex-col gap-1 whitespace-normal rounded-lg border border-transparent px-3 py-4 text-center data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" key={n} value={String(i)}>
          <span className="text-xs opacity-80">ขั้นตอน {i + 1}</span><span className="font-semibold">{n}</span>
        </TabsTrigger>)}
      </TabsList>
      {[0, 1, 2].map(i => <TabsContent key={i} value={String(i)} className="mt-4 space-y-4"><div className="grid items-start gap-4 xl:grid-cols-2"><Panel title={`ข้อมูล ${names[i]}`}><div className="flex items-start gap-3 rounded-lg border border-dashed p-4"><Upload className="mt-1 h-5 w-5 shrink-0 text-primary" /><div className="space-y-2"><p className="text-sm font-medium">วางตารางจาก Excel หรือนำเข้า CSV / TSV</p><p className="text-sm text-muted-foreground">เฉพาะตัวเลข ไม่รวมหัวตาราง · หน่วยความเข้มข้น mg/mL</p><Button variant="outline" size="sm" onClick={() => file.current?.click()}>เลือกไฟล์ข้อมูล</Button></div></div><p className="text-sm font-medium">{i === 0 ? "คอลัมน์: RT (min), ผลรวม Area · Standard อย่างน้อย 6 ครั้ง" : i === 1 ? "คอลัมน์: Actual concentration, Area · หนึ่งแถวต่อ Injection" : "คอลัมน์: Target level, Actual fortified, Found · หนึ่งแถวต่อตัวอย่างที่เตรียม"}</p><Textarea aria-label={`ข้อมูล ${names[i]}`} className="min-h-48 font-mono text-sm" value={texts[i]} onChange={e => updateText(e.target.value)} placeholder={i === 0 ? "4.437,248.883\n4.438,249.102" : i === 1 ? "0.104,25.18\n0.104,25.32\n0.104,25.01" : "0.50,0.5028975,0.5012\n0.50,0.5028975,0.5031"} /><p className="text-sm text-muted-foreground">อ่านได้ {parsed[i].rows.length} แถว · คำนวณอัตโนมัติเมื่อข้อมูลครบ</p>{i === 0 && <label className="block space-y-2 text-sm">Blank Area สูงสุด ณ ตำแหน่งที่ตรวจ (กรอก 0 เมื่อยืนยันว่าไม่พบพีค)<Input type="number" min="0" step="any" value={blank} onChange={e => setBlank(e.target.value)} /></label>}{i === 2 && <p className="text-sm text-muted-foreground">Recovery = Found ÷ Actual fortified × 100 · ใช้กับ Matrix Blank ที่ไม่มีสารเป้าหมายเท่านั้น</p>}</Panel><Panel title="ผลการคำนวณและเกณฑ์ยอมรับ"><Results checks={i === 0 ? specificityChecks : i === 1 ? linearityChecks : accuracyChecks} />{i === 0 && <p className="text-sm text-muted-foreground">Mean RT {fmt(rt?.mean)} min · Mean Area {fmt(area?.mean)} · Sample SD {fmt(area?.sd)}</p>}{i === 1 && <p className="text-sm text-muted-foreground">Area = {fmt(fit?.slope)} × Concentration + ({fmt(fit?.intercept)}) · ถดถอยจากทุก Injection</p>}{i === 2 && <p className="text-sm text-muted-foreground">%RSD คำนวณจาก Recovery โดยใช้ Sample SD (n−1) · HorRat และ Intermediate Precision ยังรอกำหนดวิธีคำนวณ</p>}<div className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Calculator className="h-4 w-4 shrink-0" />เก็บทศนิยมเต็มในการคำนวณ ปัดเศษเฉพาะค่าที่แสดง</div></Panel></div>
      {i === 1 && fit && <div className="grid gap-4 lg:grid-cols-2">{[false, true].map(residual => <Panel key={String(residual)} title={residual ? "Residual Plot" : "Calibration Curve"}><div className="h-64"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ bottom: 20, left: 12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="concentration" name="Concentration" unit=" mg/mL" /><YAxis type="number" dataKey={residual ? "residual" : "area"} name={residual ? "Residual" : "Area"} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={fit.points} fill="hsl(var(--primary))" /></ScatterChart></ResponsiveContainer></div></Panel>)}</div>}
      {i === 2 && recoveryPoints.length > 0 && !invalidAccuracy && <Panel title="Recovery รายตัวอย่าง (%)"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={recoveryPoints}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis domain={["auto", "auto"]} /><Tooltip /><Line dataKey="recovery" name="Recovery (%)" stroke="hsl(var(--primary))" connectNulls={false} /></LineChart></ResponsiveContainer></div></Panel>}
      </TabsContent>)}
      <TabsContent value="3" className="mt-4 space-y-4"><Panel title="Overall Summary"><div className="flex gap-3 rounded-lg bg-muted p-4"><FileCheck2 className="h-5 w-5 shrink-0 text-primary" /><p className="text-sm">ผลนี้เป็นฉบับร่าง ยังไม่สรุปผ่านทั้งวิธีจนกว่าจะมีหลักฐาน Specificity และประเมิน Precision ครบ ดาวน์โหลดรายงานพร้อมข้อมูลดิบและรายการที่ต้องทบทวนได้</p></div><Results checks={checks} /></Panel></TabsContent>
    </Tabs>
    <input ref={file} type="file" accept=".csv,.tsv,.txt" className="hidden" aria-label="นำเข้าข้อมูล Validation" onChange={async e => { const selected = e.target.files?.[0]; e.target.value = ""; if (!selected) return; if (selected.size > 2 * 1024 * 1024) { setNotice("ไฟล์ต้องไม่เกิน 2 MB"); return; } const target = Number(tab); try { const content = await selected.text(); setTexts(old => old.map((v, i) => i === target ? content : v)); setNotice(`นำเข้า ${selected.name} แล้ว`); } catch { setNotice("อ่านไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"); } }} />
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {errors.length > 0 && <Panel title="รายการที่ต้องแก้ไข"><ul className="space-y-2 text-sm text-destructive">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Panel>}
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground"><FlaskConical className="h-5 w-5 shrink-0" /><p>เวอร์ชันนี้ตรวจด้วยสูตรและเกณฑ์ที่ระบุ รองรับ CSV และการวางตารางจาก Excel ส่วนการอ่านไฟล์ Excel/PDF โดยตรงและการวิเคราะห์เอกสารด้วย AI ยังไม่ได้เชื่อมต่อ</p></div>
  </div></AppLayout>;
}
