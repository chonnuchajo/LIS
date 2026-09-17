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
import ValidationDataGrid from "@/components/lis/ValidationDataGrid";
import ValidationPreparation from "@/components/lis/ValidationPreparation";
import { defaultPreparationLevels, positiveNumber, stockConcentration, defaultLinearitySettings, checkLinearityPreparation, preparationTemplate, type ValidationStock } from "@/lib/validationPreparation";
import ValidationStocks from "@/components/lis/ValidationStocks";
import { PrecisionPanel, QcPanel, ValidationResults as Results } from "@/components/lis/ValidationAdvanced";
import { defaultPrecisionSettings, defaultQcSettings, evaluatePrecision, evaluateQc } from "@/lib/validationAdvanced";
import { createValidationReport } from "@/lib/validationReport";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { readValidationProject } from "@/lib/validationProject";
import ValidationSpecificity from "@/components/lis/ValidationSpecificity";
import { defaultSpecificitySettings, evaluateSpecificity } from "@/lib/validationSpecificity";
import ValidationMeasurements from "@/components/lis/ValidationMeasurements";
import { defaultLinkedMeasurements, evaluateLinkedMeasurements } from "@/lib/validationMeasurements";

const names = ["Specificity", "Linearity", "Accuracy & Precision", "Overall Summary"];
const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 5 });
type Check = { name: string; value: string; criteria: string; pass: boolean | null };
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}
export default function ValidationPage() {
  const [tab, setTab] = useState("0");
  const [title, setTitle] = useState("Cypermethrin — Method Validation");
  const [analyte, setAnalyte] = useState("Cypermethrin");
  const [method, setMethod] = useState("GC-FID");
  const [preparationLevels, setPreparationLevels] = useState(defaultPreparationLevels);
  const [stocks, setStocks] = useState<ValidationStock[]>([]);
  const [linearity, setLinearity] = useState(defaultLinearitySettings);
  const [prep, setPrep] = useState(["", "", "25", "250", "1000"]);
  const [inputTexts, setTexts] = useState(["", "", ""]);
  const [blank, setBlank] = useState("");
  const [specificity, setSpecificity] = useState(defaultSpecificitySettings);
  const [inputPrecision, setPrecision] = useState(defaultPrecisionSettings);
  const [inputQc, setQc] = useState(defaultQcSettings);
  const [linkedMeasurements, setLinkedMeasurements] = useState(defaultLinkedMeasurements);
  const [reportMeta, setReportMeta] = useState({ analyst: "", reviewer: "", protocol: "WI-06-04-03 rev.04 (ปรับเกณฑ์ตามวิธีที่ใช้)", calibration: "", notes: "" });
  const [notice, setNotice] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const projectFile = useRef<HTMLInputElement>(null);
  const [weight, purity, volume, aliquot, finalVolume] = prep.map(Number);
  const validPrep = prep.every(v => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) > 0) && purity <= 100 && aliquot <= finalVolume;
  const stock = stockConcentration(weight, purity, volume);
  const actual = !validPrep || stock == null ? null : stock * aliquot / finalVolume;
  const linkedResult = evaluateLinkedMeasurements(linkedMeasurements, stock, stocks, Number(linearity.r2Min));
  const linked = linkedMeasurements.enabled;
  const texts = inputTexts.map((text, index) => index === 2 && linked.includes("accuracy") ? linkedResult.outputs.accuracy : text);
  const precision = { ...inputPrecision, dailyData: linked.includes("daily") ? linkedResult.outputs.daily : inputPrecision.dailyData };
  const qc = { ...inputQc, sampleData: linked.includes("sample") ? linkedResult.outputs.sample : inputQc.sampleData, standardData: linked.includes("standard") ? linkedResult.outputs.standard : inputQc.standardData, spikeData: linked.includes("spike") ? linkedResult.outputs.spike : inputQc.spikeData };
  const parsed = texts.map((t, i) => parseMeasurements(t, i === 2 ? 3 : 2));
  const specificityContext = { standardData: texts[0], analyte, method, protocol: reportMeta.protocol, calibration: reportMeta.calibration, reviewer: reportMeta.reviewer, preparation: JSON.stringify({ prep, preparationLevels, ...(stocks.length ? { stocks } : {}) }) };
  const specificityResult = evaluateSpecificity(specificity, specificityContext);
  const { rt, area } = specificityResult;
  const fit = parsed[1].errors.length ? null : regression(parsed[1].rows);
  const plannedLinearity = preparationLevels.filter(r => r.purpose === "linearity");
  const plannedAccuracy = preparationLevels.filter(r => r.purpose === "accuracy");
  const accuracyTargets = plannedAccuracy.map(r => Number(r.target));
  const planErrors: string[] = [];
  if (plannedLinearity.length < 3) planErrors.push("แผน Linearity: ต้องกำหนดอย่างน้อย 3 ระดับ");
  if (!plannedAccuracy.length) planErrors.push("แผน Accuracy: ต้องกำหนดระดับที่ต้องการทดสอบ");
  if (preparationLevels.some(r => positiveNumber(r.target) == null)) planErrors.push("แผนเตรียมสาร: Target ต้องมากกว่า 0");
  if (new Set(accuracyTargets).size !== accuracyTargets.length) planErrors.push("แผน Accuracy: ระดับเป้าหมายซ้ำกัน");
  if (plannedAccuracy.some(r => positiveNumber(r.recoveryLow) == null || positiveNumber(r.recoveryHigh) == null || Number(r.recoveryLow) >= Number(r.recoveryHigh))) planErrors.push("แผน Accuracy: ตรวจเกณฑ์ Recovery ต่ำและสูง");
  const linearPreparation = checkLinearityPreparation(parsed[1].rows, preparationLevels, stock, stocks, linearity);
  const linearReady = planErrors.length === 0 && !!fit && linearPreparation.ready;
  const linearStats = linearPreparation.prepared.map(({ level, actual }, index) => ({ id: level.id, x: actual, target: level.target, stats: stats(linearPreparation.groups[index].map(row => row[1])) }));
  const specificityChecks = specificityResult.checks;
  const linearityChecks: Check[] = [
    { name: "R²", value: fmt(fit?.r2), criteria: `≥ ${linearity.r2Min} · ${plannedLinearity.length} ระดับ ระดับละ ≥ ${linearity.minReplicates} ครั้ง`, pass: linearReady ? fit.r2 >= Number(linearity.r2Min) : null },
    ...linearStats.map(l => ({ name: `Area %RSD Target ${l.target} · Actual ${fmt(l.x)} mg/mL`, value: fmt(l.stats?.rsd), criteria: `≤ ${linearity.areaRsdMax}%`, pass: linearReady && l.stats?.rsd != null ? l.stats.rsd <= Number(linearity.areaRsdMax) : null })),
  ];
  const recoveryPoints = parsed[2].rows.map(([level, expected, found], i) => ({ index: i + 1, level, expected, found, recovery: expected > 0 ? found / expected * 100 : null }));
  const accuracyChecks: Check[] = plannedAccuracy.map(planned => {
    const level = Number(planned.target);
    const rows = recoveryPoints.filter(r => r.level === level);
    const values = rows.flatMap(r => r.recovery == null ? [] : [r.recovery]);
    const summary = stats(values);
    const low = Number(planned.recoveryLow), high = Number(planned.recoveryHigh);
    const minReplicates = Number(precision.minReplicates);
    return { name: `Recovery ${level} mg/mL (n=${rows.length})`, value: `${fmt(summary?.mean)}% · RSD ${fmt(summary?.rsd)}%`, criteria: `${low}–${high}% ทุกรายการ · ≥ ${precision.minReplicates} ตัวอย่าง`, pass: Number.isInteger(minReplicates) && minReplicates >= 2 && parsed[2].errors.length === 0 && rows.length >= minReplicates && values.length === rows.length ? values.every(v => v >= low && v <= high) : null };
  });
  const precisionResult = evaluatePrecision(precision, accuracyTargets, texts[2]);
  const qcResult = evaluateQc(qc);
  const checks: Check[] = [...specificityChecks, ...linearityChecks, ...accuracyChecks, ...precisionResult.checks, ...qcResult.checks];
  const errors = [...planErrors, ...linkedResult.errors, ...(texts[1] ? linearPreparation.errors : []), ...specificityResult.errors, ...precisionResult.errors, ...qcResult.errors, ...parsed.flatMap((p, i) => i === 0 ? [] : p.errors.map(e => `${names[i]} · ${e}`))];
  if (recoveryPoints.some(p => p.expected <= 0 || !accuracyTargets.includes(p.level))) errors.push("Accuracy: Actual ต้องมากกว่า 0 และระดับเป้าหมายต้องตรงกับแผนเตรียมสาร");
  const invalidAccuracy = errors.some(e => e.startsWith("Accuracy"));
  if (invalidAccuracy || planErrors.length) {
    accuracyChecks.forEach(c => { c.pass = null; });
    precisionResult.checks.forEach(c => { c.pass = null; });
  }
  const passed = checks.filter(c => c.pass === true).length;
  const failed = checks.filter(c => c.pass === false).length;
  const download = () => {
    const report = { format: "lis-validation-project", version: 1, title, analyte, method, reportMeta, preparationLevels, stocks, linearity, precision: inputPrecision, qc: inputQc, specificity, prep, texts: inputTexts, blank, linkedMeasurements };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "validation-project.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadReadableReport = () => {
    const html = createValidationReport({ title, analyte, method, ...reportMeta, prep, levels: preparationLevels, texts, blank, checks, errors, precision: precisionResult, qc: qcResult, includeQc: qc.enabled, specificity, stocks, linearity, linkedMeasurements });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "method-validation-report.html"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("ดาวน์โหลดรายงาน HTML แล้ว เปิดไฟล์เพื่ออ่านหรือใช้ Ctrl+P บันทึกเป็น PDF");
  };
  const previewReport = () => setPreviewHtml(createValidationReport({ title, analyte, method, ...reportMeta, prep, levels: preparationLevels, texts, blank, checks, errors, precision: precisionResult, qc: qcResult, includeQc: qc.enabled, specificity, stocks, linearity, linkedMeasurements }));
  const updateText = (value: string) => setTexts(old => old.map((v, i) => i === Number(tab) ? value : v));
  const templates = [null, preparationTemplate("linearity", preparationLevels, stock, stocks, Number(linearity.minReplicates)), preparationTemplate("accuracy", preparationLevels, stock, stocks, Number(precision.minReplicates))];
  const fillPreparationTemplate = (index: number) => {
    if (texts[index] !== "" || templates[index] == null || (index === 2 && linked.includes("accuracy"))) return;
    setTexts(old => old.map((value, i) => i === index ? templates[index]! : value));
    setNotice("สร้างแถวด้วย Actual จากแผนแล้ว กรุณากรอกผลวัดจริงทุกแถว หากเตรียมตัวอย่างแยกกันให้แก้ Actual ของแต่ละตัวอย่างตามการเตรียมจริง");
  };
  return <AppLayout title="Validation"><div className="space-y-6">
    <input type="file" accept=".json" ref={projectFile} className="hidden" aria-label="เปิดงาน Validation" onChange={async e => {
      const selected = e.target.files?.[0]; e.target.value = "";
      if (!selected) return;
      if (selected.size > 3 * 1024 * 1024) { setNotice("ไฟล์งานต้องไม่เกิน 3 MB"); return; }
      try {
        const project = readValidationProject(await selected.text());
        setTitle(project.title); setAnalyte(project.analyte); setMethod(project.method);
        setPrep(project.prep); setTexts(project.texts); setBlank(project.blank); setSpecificity(project.specificity);
        setPreparationLevels(project.preparationLevels); setStocks(project.stocks); setLinearity(project.linearity); setReportMeta(project.reportMeta);
        setPrecision(project.precision); setQc(project.qc); setLinkedMeasurements(project.linkedMeasurements); setPreviewHtml("");
        setNotice(`เปิดงาน ${selected.name} และคำนวณใหม่แล้ว`);
      } catch { setNotice("เปิดงานไม่ได้: รูปแบบไฟล์หรือเวอร์ชันไม่ถูกต้อง ข้อมูลปัจจุบันยังคงเดิม"); }
    }} />
    <Dialog open={!!previewHtml} onOpenChange={open => { if (!open) setPreviewHtml(""); }}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader><DialogTitle>ตัวอย่างรายงาน Validation</DialogTitle><DialogDescription>ตรวจตารางและกราฟก่อนดาวน์โหลด เปิดไฟล์ HTML แล้วใช้ Ctrl+P เพื่อบันทึก PDF</DialogDescription></DialogHeader>
        <iframe title="ตัวอย่างรายงาน Validation" sandbox="" srcDoc={previewHtml} className="h-[65vh] w-full rounded-lg border" />
        <Button onClick={downloadReadableReport}><Download className="mr-2 h-4 w-4" />ดาวน์โหลดรายงาน HTML สำหรับพิมพ์</Button>
      </DialogContent>
    </Dialog>
    <PageHeader title="Validation" description="AI Data & Document Validation Checker · ตรวจข้อมูล คำนวณ และสรุปผลในพื้นที่เดียว" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => projectFile.current?.click()}>เปิดงาน</Button><Button onClick={previewReport}><FileCheck2 className="mr-2 h-4 w-4" />ออกรายงาน</Button><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />บันทึกงาน JSON</Button></div>} />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><div><h2 className="text-base font-semibold">พื้นที่ตรวจสอบวิธีวิเคราะห์</h2><p className="text-sm text-muted-foreground">{analyte || "ยังไม่ระบุสาร"} · {method || "ยังไม่ระบุวิธี"} · กำหนดช่วงความเข้มข้นในแผนเตรียมสาร</p></div></div><Badge variant="secondary">ฉบับร่าง · รอผู้ทบทวน</Badge></div>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[["รายการตรวจ", checks.length], ["Passed", passed], ["Failed", failed], ["รอตรวจสอบ", checks.length - passed - failed]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div>
    <details className="rounded-lg border bg-card p-4 shadow-sm"><summary className="cursor-pointer text-base font-semibold">ตั้งค่างานและเตรียมสาร · หัวข้อ 6–7</summary><div className="mt-4 space-y-4"><Panel title="ข้อมูลการเตรียมสาร"><label className="block space-y-2 text-sm">ชื่องาน / เลขที่รายงาน<Input value={title} onChange={e => setTitle(e.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{["น้ำหนักมาตรฐาน (mg)", "Purity (%)", "ปริมาตร Stock (mL)", "ปริมาตรที่ปิเปต (µL)", "ปริมาตรสุดท้าย (µL)"].map((label, i) => <label className="space-y-2 text-sm" key={label}>{label}<Input type="number" min="0" step="any" value={prep[i]} onChange={e => setPrep(old => old.map((v, n) => n === i ? e.target.value : v))} /></label>)}</div><div className="flex flex-wrap gap-4 rounded-md bg-muted p-3 text-sm"><span>C stock: <strong>{fmt(stock)} mg/mL</strong></span><span>C actual: <strong>{fmt(actual)} mg/mL</strong></span><span className="text-muted-foreground">C stock = น้ำหนัก × Purity/100 ÷ ปริมาตร</span></div><p className="text-sm text-muted-foreground">Stock หลักใช้กับระดับที่เลือก Stock หลักด้านล่าง เพิ่ม Stock แยกสำหรับชุดชั่งอื่น แล้วใช้ปุ่มสร้างแถวจากแผนในแท็บ Linearity/Accuracy บันทึกงาน JSON ก่อนออกจากหน้า แล้วใช้เปิดงานเพื่อกลับมาทำต่อ</p>{!validPrep && prep[0] && prep[1] && <p className="text-sm text-destructive">ตรวจค่าบวกทุกช่อง, Purity ไม่เกิน 100% และปริมาตรที่ปิเปตไม่เกินปริมาตรสุดท้าย</p>}</Panel>
    <Panel title="กำหนดสารและวิธีสำหรับรายงาน">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">ชื่อสาร<Input value={analyte} onChange={e => setAnalyte(e.target.value)} /></label>
        <label className="space-y-2 text-sm">วิธี / เครื่องมือ<Input value={method} onChange={e => setMethod(e.target.value)} /></label>
      </div>
      <ValidationStocks measurementStockIds={linkedMeasurements.rows.map(row => row.stockId)} stocks={stocks} levels={preparationLevels} onChange={setStocks} />
      <ValidationPreparation stock={stock} stocks={stocks} levels={preparationLevels} onChange={setPreparationLevels} />
      <div className="grid gap-4 sm:grid-cols-2">
        {([["analyst", "ผู้จัดทำ"], ["reviewer", "ผู้ทบทวน"], ["protocol", "วิธี / SOP และเวอร์ชัน"], ["calibration", "Calibration ID ของ Linearity / ข้อมูลกรอกตรง"]] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input value={reportMeta[key]} onChange={e => setReportMeta(old => ({ ...old, [key]: e.target.value }))} /></label>)}
      </div>
      <label className="block space-y-2 text-sm">ข้อสังเกตสำหรับรายงาน<Textarea value={reportMeta.notes} onChange={e => setReportMeta(old => ({ ...old, notes: e.target.value }))} /></label>
    </Panel>
    </div></details>
    <details className="rounded-lg border bg-card p-4 shadow-sm"><summary className="cursor-pointer text-base font-semibold">คำนวณจาก Area · Calibration และการเตรียมรายตัวอย่าง</summary><div className="mt-4"><ValidationMeasurements settings={linkedMeasurements} onChange={setLinkedMeasurements} stocks={stocks} result={linkedResult} linearityData={texts[1]} calibrationReference={reportMeta.calibration} /></div></details>
    <Tabs value={tab} onValueChange={v => { setTab(v); setNotice(""); }}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border bg-card p-2 shadow-sm lg:grid-cols-4">
        {names.map((n, i) => <TabsTrigger className="min-h-20 flex-col gap-1 whitespace-normal rounded-lg border border-transparent px-3 py-4 text-center data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" key={n} value={String(i)}>
          <span className="text-xs opacity-80">ขั้นตอน {i + 1}</span><span className="font-semibold">{n}</span>
        </TabsTrigger>)}
      </TabsList>
      {[0, 1, 2].map(i => <TabsContent key={i} value={String(i)} className="mt-4 space-y-4">
        {i === 1 && <Panel title="เกณฑ์ Linearity และการเทียบแผนเตรียมสาร"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([["minReplicates", "จำนวน Injection ต่อระดับขั้นต่ำ"], ["r2Min", "R² ไม่น้อยกว่า"], ["areaRsdMax", "Area %RSD ไม่เกิน"], ["concentrationTolerance", "Actual คลาดเคลื่อนจากแผนไม่เกิน (mg/mL)"]] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input type="number" step="any" value={linearity[key]} onChange={e => setLinearity(old => ({ ...old, [key]: e.target.value }))} /></label>)}</div><p className="text-sm text-muted-foreground">ปรับตาม SOP · เทียบ Actual ของแต่ละ Injection กับความเข้มข้นที่คำนวณจาก Stock และปริมาตรในแผน การแก้แผนจะตรวจข้อมูลผลวัดใหม่โดยไม่แก้ทับค่าผลวัด</p></Panel>}
        {i > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"><div><p className="text-sm font-medium">ใช้ความเข้มข้นจากแผนหัวข้อ 6–7</p><p className="text-sm text-muted-foreground">Target = ระดับที่ตั้งใจเตรียม · Actual = คำนวณจากการเตรียมจริง · Found = ผลวัดจากเครื่อง</p><p className="text-xs text-muted-foreground">สร้างได้เมื่อตารางว่างและแผนเตรียมครบ · จำนวนซ้ำ Accuracy ใช้ค่าจากส่วน Precision · ตรวจ Actual รายตัวอย่างเมื่อเตรียมแยกกัน</p></div><Button variant="outline" disabled={texts[i] !== "" || templates[i] == null || (i === 2 && linked.includes("accuracy"))} onClick={() => fillPreparationTemplate(i)}>สร้างแถวจากแผนเตรียมสาร</Button></div>}
        <div className="grid items-start gap-4 xl:grid-cols-2"><Panel title={`ข้อมูล ${names[i]}`}><div className="flex items-start gap-3 rounded-lg border border-dashed p-4"><Upload className="mt-1 h-5 w-5 shrink-0 text-primary" /><div className="space-y-2"><p className="text-sm font-medium">วางตารางจาก Excel หรือนำเข้า CSV / TSV</p><p className="text-sm text-muted-foreground">เฉพาะตัวเลข ไม่รวมหัวตาราง · หน่วยความเข้มข้น mg/mL</p><Button variant="outline" size="sm" disabled={(i === 2 && linked.includes("accuracy")) || (i === 0 && specificity.peakMode)} onClick={() => file.current?.click()}>เลือกไฟล์ข้อมูล</Button></div></div><p className="text-sm font-medium">{i === 0 ? "คอลัมน์: RT (min), ผลรวม Area · Standard ตามจำนวนซ้ำที่กำหนดด้านล่าง" : i === 1 ? "คอลัมน์: Actual concentration, Area · หนึ่งแถวต่อ Injection" : "คอลัมน์: Target level, Actual fortified, Found · หนึ่งแถวต่อตัวอย่างที่เตรียม"}</p>{i === 0 && specificity.peakMode ? <p className="rounded-lg bg-muted p-3 text-sm">ใช้ข้อมูลแยกรายพีคในส่วน Blank และหลักฐานความจำเพาะด้านล่าง ข้อมูลแบบเดิมยังเก็บไว้และกลับมาใช้ได้เมื่อปิดโหมดรายพีค</p> : <ValidationDataGrid readOnly={i === 2 && linked.includes("accuracy")} label={`ข้อมูล ${names[i]}`} columns={i === 0 ? ["RT (min)", "ผลรวม Area"] : i === 1 ? ["Actual (mg/mL)", "Area"] : ["Target (mg/mL)", "Actual fortified (mg/mL)", "Found (mg/mL)"]} value={texts[i]} onChange={updateText} />}<p className="text-sm text-muted-foreground">อ่านได้ {i === 0 ? specificityResult.standardRows.length : parsed[i].rows.length} แถว · คำนวณอัตโนมัติเมื่อข้อมูลครบ</p>{i === 2 && <p className="text-sm text-muted-foreground">Recovery = Found ÷ Actual fortified × 100 · ใช้กับ Matrix Blank ที่ไม่มีสารเป้าหมายเท่านั้น</p>}</Panel><Panel title="ผลการคำนวณและเกณฑ์ยอมรับ"><Results checks={i === 0 ? specificityChecks : i === 1 ? linearityChecks : accuracyChecks} />{i === 0 && <p className="text-sm text-muted-foreground">{specificity.peakMode ? "RT ประเมินแยกรายพีค" : `Mean RT ${fmt(rt?.mean)} min`} · Mean Total Area {fmt(area?.mean)} · Sample SD {fmt(area?.sd)}</p>}{i === 1 && <p className="text-sm text-muted-foreground">Area = {fmt(fit?.slope)} × Concentration + ({fmt(fit?.intercept)}) · ถดถอยจากทุก Injection</p>}{i === 2 && <p className="text-sm text-muted-foreground">%RSD คำนวณจาก Recovery โดยใช้ Sample SD (n−1) · กำหนดฐาน Horwitz และข้อมูลรายวันในส่วน Precision ด้านล่าง</p>}<div className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"><Calculator className="h-4 w-4 shrink-0" />เก็บทศนิยมเต็มในการคำนวณ ปัดเศษเฉพาะค่าที่แสดง</div></Panel></div>
      {i === 0 && <ValidationSpecificity settings={specificity} context={specificityContext} onChange={setSpecificity} legacyBlank={blank} />}
      {i === 1 && fit && <div className="grid gap-4 lg:grid-cols-2">{[false, true].map(residual => <Panel key={String(residual)} title={residual ? "Residual Plot" : "Calibration Curve"}><div className="h-64"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ bottom: 20, left: 12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="concentration" name="Concentration" unit=" mg/mL" /><YAxis type="number" dataKey={residual ? "residual" : "area"} name={residual ? "Residual" : "Area"} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={fit.points} fill="hsl(var(--primary))" /></ScatterChart></ResponsiveContainer></div></Panel>)}</div>}
      {i === 2 && recoveryPoints.length > 0 && !invalidAccuracy && <Panel title="Recovery รายตัวอย่าง (%)"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={recoveryPoints}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis domain={["auto", "auto"]} /><Tooltip /><Line dataKey="recovery" name="Recovery (%)" stroke="hsl(var(--primary))" connectNulls={false} /></LineChart></ResponsiveContainer></div></Panel>}
      {i === 2 && <PrecisionPanel dailyLinked={linked.includes("daily")} settings={precision} onChange={next => setPrecision(old => ({ ...next, dailyData: linked.includes("daily") ? old.dailyData : next.dailyData }))} result={precisionResult} />}
      </TabsContent>)}
      <TabsContent value="3" className="mt-4 space-y-4"><QcPanel linkedKinds={linked} settings={qc} onChange={next => setQc(old => ({ ...next, sampleData: linked.includes("sample") ? old.sampleData : next.sampleData, standardData: linked.includes("standard") ? old.standardData : next.standardData, spikeData: linked.includes("spike") ? old.spikeData : next.spikeData }))} result={qcResult} /><Panel title="Overall Summary"><div className="flex gap-3 rounded-lg bg-muted p-4"><FileCheck2 className="h-5 w-5 shrink-0 text-primary" /><p className="text-sm">ผลนี้เป็นฉบับร่าง ยังไม่สรุปผ่านทั้งวิธีจนกว่าจะมีหลักฐาน Specificity และประเมิน Precision ครบ ดาวน์โหลดรายงานพร้อมข้อมูลดิบและรายการที่ต้องทบทวนได้</p></div><Results checks={checks} /></Panel></TabsContent>
    </Tabs>
    <input ref={file} type="file" accept=".csv,.tsv,.txt" className="hidden" aria-label="นำเข้าข้อมูล Validation" onChange={async e => { const selected = e.target.files?.[0]; e.target.value = ""; if (!selected) return; if (selected.size > 2 * 1024 * 1024) { setNotice("ไฟล์ต้องไม่เกิน 2 MB"); return; } const target = Number(tab); try { const content = await selected.text(); setTexts(old => old.map((v, i) => i === target ? content : v)); setNotice(`นำเข้า ${selected.name} แล้ว`); } catch { setNotice("อ่านไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"); } }} />
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {errors.length > 0 && <Panel title="รายการที่ต้องแก้ไข"><ul className="space-y-2 text-sm text-destructive">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Panel>}
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground"><FlaskConical className="h-5 w-5 shrink-0" /><p>เวอร์ชันนี้ตรวจด้วยสูตรและเกณฑ์ที่ระบุ รองรับ CSV และการวางตารางจาก Excel ส่วนการอ่านไฟล์ Excel/PDF โดยตรงและการวิเคราะห์เอกสารด้วย AI ยังไม่ได้เชื่อมต่อ</p></div>
  </div></AppLayout>;
}
