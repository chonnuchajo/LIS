import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ValidationDataGrid from "./ValidationDataGrid";
import { formatValidationNumber as fmt } from "@/lib/validationAdvanced";
import { calibrationResult, measurementKinds, measurementLabels, newMeasurement, type LinkedMeasurements, type MeasurementKind, type ValidationCalibration, type ValidationMeasurement, type evaluateLinkedMeasurements } from "@/lib/validationMeasurements";
import type { ValidationStock } from "@/lib/validationPreparation";

export default function ValidationMeasurements({ settings, onChange, stocks, result, linearityData, calibrationReference }: {
  settings: LinkedMeasurements; onChange: (value: LinkedMeasurements) => void; stocks: ValidationStock[];
  result: ReturnType<typeof evaluateLinkedMeasurements>; linearityData: string; calibrationReference: string;
}) {
  const [kind, setKind] = useState<MeasurementKind>("accuracy");
  const [openedRow, setOpenedRow] = useState("");
  const updateCalibration = (id: string, key: keyof ValidationCalibration, value: string) => onChange({ ...settings, calibrations: settings.calibrations.map(row => row.id === id ? { ...row, [key]: value } : row) });
  const updateRow = (id: string, key: keyof ValidationMeasurement, value: string) => onChange({ ...settings, rows: settings.rows.map(row => row.id === id ? { ...row, [key]: value } : row) });
  const addCalibration = (copy: boolean) => onChange({ ...settings, calibrations: [...settings.calibrations, { id: crypto.randomUUID(), name: copy ? calibrationReference : "", reference: copy ? calibrationReference : "", mode: copy ? "points" : "equation", points: copy ? linearityData : "", slope: "", intercept: "", min: "", max: "", r2: "" }] });
  const addRow = (copy?: ValidationMeasurement) => {
    const row = copy ? { ...copy, id: crypto.randomUUID(), sampleId: "", area: "" } : newMeasurement(kind);
    onChange({ ...settings, rows: [...settings.rows, row] }); setOpenedRow(row.id);
  };
  return <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Calibration และการเตรียมรายตัวอย่าง</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">ใช้เมื่อมี Area และต้องการคำนวณ Found ด้วย Calibration ของตัวอย่างนั้น เลือกเปิดใช้เป็นรายหัวข้อ ข้อมูลที่กรอกตรงในตารางเดิมจะเก็บไว้ และกลับมาใช้ได้เมื่อปิดหัวข้อนี้</p>
    <div className="flex flex-wrap gap-4">{measurementKinds.map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled.includes(value)} onChange={e => onChange({ ...settings, enabled: e.target.checked ? [...settings.enabled, value] : settings.enabled.filter(k => k !== value) })} />คำนวณจาก Area: {measurementLabels[value]}</label>)}</div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => addCalibration(false)}>เพิ่ม Calibration จากเครื่อง</Button><Button variant="outline" disabled={!linearityData.trim()} onClick={() => addCalibration(true)}>คัดลอกข้อมูล Linearity เป็น Calibration</Button></div>
    <p className="text-xs text-muted-foreground">การคัดลอกเก็บชุดข้อมูลขณะนั้นไว้แยกกัน การแก้ Linearity ภายหลังไม่เปลี่ยน Calibration ที่คัดลอกแล้ว · เกณฑ์ R² ใช้ค่าที่ตั้งในแท็บ Linearity</p>
    {settings.calibrations.map((calibration, index) => {
      const fit = calibrationResult(calibration);
      const used = settings.rows.some(row => row.calibrationId === calibration.id);
      return <div key={calibration.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Calibration {index + 1}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2 text-sm">ชื่อ / Calibration ID<Input aria-label={`Calibration ID ชุด ${index + 1}`} value={calibration.name} onChange={e => updateCalibration(calibration.id, "name", e.target.value)} /></label>
          <label className="space-y-2 text-sm">เอกสาร/ไฟล์จากเครื่องที่ใช้ยืนยัน<Input aria-label={`หลักฐาน Calibration ชุด ${index + 1}`} value={calibration.reference} onChange={e => updateCalibration(calibration.id, "reference", e.target.value)} /></label>
          <label className="space-y-2 text-sm">แหล่งสมการ<NativeSelect aria-label={`แหล่งสมการชุด ${index + 1}`} value={calibration.mode} onChange={e => updateCalibration(calibration.id, "mode", e.target.value)}><option value="equation">สมการที่เครื่องรายงาน</option><option value="points">คำนวณ OLS จากข้อมูลดิบ</option></NativeSelect></label>
        </div>
        {calibration.mode === "points" ? <ValidationDataGrid label={`ข้อมูล Calibration ชุด ${index + 1}`} columns={["Actual (mg/mL)", "Area"]} value={calibration.points} onChange={value => updateCalibration(calibration.id, "points", value)} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{([["slope", "Slope"], ["intercept", "Intercept"], ["min", "ช่วงต่ำ (mg/mL)"], ["max", "ช่วงสูง (mg/mL)"], ["r2", "R² ที่เครื่องรายงาน"]] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input aria-label={`${label} Calibration ชุด ${index + 1}`} type="number" step="any" value={calibration[key]} onChange={e => updateCalibration(calibration.id, key, e.target.value)} /></label>)}</div>}
        <p className="text-sm">Area = {fmt(fit?.slope)} × Conc + ({fmt(fit?.intercept)}) · R² {fmt(fit?.r2)} · ช่วง {fmt(fit?.min)}–{fmt(fit?.max)} mg/mL</p>
        <Button variant="ghost" size="sm" disabled={used} onClick={() => onChange({ ...settings, calibrations: settings.calibrations.filter(row => row.id !== calibration.id) })}>ลบ Calibration{used ? " (มีตัวอย่างใช้อยู่)" : ""}</Button>
      </div>;
    })}
    <div className="flex flex-wrap items-end gap-3"><label className="space-y-2 text-sm">ชุดผลวัด<NativeSelect aria-label="เลือกชุดผลวัดจาก Area" value={kind} onChange={e => setKind(e.target.value as MeasurementKind)}>{measurementKinds.map(value => <option key={value} value={value}>{measurementLabels[value]}</option>)}</NativeSelect></label><Button variant="outline" onClick={() => addRow()}>เพิ่มตัวอย่าง</Button></div>
    <p className="text-sm text-muted-foreground">Actual/Added = C stock × ปิเปตจริง ÷ ปริมาตรสุดท้าย · Found = (Area − Intercept) ÷ Slope · ทุกความเข้มข้นเป็น mg/mL และต้องอยู่ในช่วง Calibration</p>
    {result.results.filter(item => item.row.kind === kind).map(({ row, actual, found, errors }) => <div key={row.id} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <button type="button" className="flex w-full flex-wrap justify-between gap-2 text-left text-sm font-medium" aria-expanded={openedRow === row.id} onClick={() => setOpenedRow(openedRow === row.id ? "" : row.id)}><span>{row.sampleId || "ตัวอย่างใหม่ · กรุณาระบุรหัส"}</span><span>Actual/Added {fmt(actual)} · Found {fmt(found)} mg/mL {errors.length ? "· ต้องแก้ไข" : ""}</span></button>
      {openedRow === row.id && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm">รหัสตัวอย่าง/การเตรียม<Input value={row.sampleId} onChange={e => updateRow(row.id, "sampleId", e.target.value)} /></label>
          <label className="space-y-2 text-sm">Calibration<NativeSelect aria-label="Calibration ของตัวอย่าง" value={row.calibrationId} onChange={e => updateRow(row.id, "calibrationId", e.target.value)}><option value="">เลือก Calibration</option>{settings.calibrations.map(source => <option key={source.id} value={source.id}>{source.name || "ยังไม่ระบุชื่อ"}</option>)}</NativeSelect></label>
          <label className="space-y-2 text-sm">Area ที่วัดได้<Input type="number" step="any" value={row.area} onChange={e => updateRow(row.id, "area", e.target.value)} /></label>
          {row.kind !== "sample" && <label className="space-y-2 text-sm">Stock<NativeSelect aria-label="Stock ของตัวอย่าง" value={row.stockId} onChange={e => updateRow(row.id, "stockId", e.target.value)}><option value="">Stock หลัก</option>{stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.name || stock.id}</option>)}</NativeSelect></label>}
          {([
            ...(row.kind === "accuracy" || row.kind === "daily" ? [["target", "Target (mg/mL)"]] : []),
            ...(row.kind === "daily" ? [["day", "วันที่ (ลำดับวัน)"]] : []),
            ...(row.kind !== "sample" ? [["aliquot", "ปิเปต Stock จริง (µL)"], ["finalVolume", "ปริมาตรสุดท้าย (µL)"], ["matrix", "Matrix (µL)"]] : [["weight", "น้ำหนัก Sample (mg)"], ["volume", "ปริมาตรสกัด (mL)"], ["df", "DF เพิ่มเติม"], ["density", "Density (g/mL)"]]),
            ...(row.kind === "spike" ? [["unspiked", "Unspiked (mg/mL)"]] : []),
          ] as [keyof ValidationMeasurement, string][]).map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label}<Input type="number" step="any" value={row[key]} onChange={e => updateRow(row.id, key, e.target.value)} /></label>)}
        </div>
        {row.kind === "spike" && <p className="text-xs text-muted-foreground">Unspiked ต้องเป็นผลวัดก่อนเติมที่แก้ dilution แล้ว ห้ามใช้ค่าฉลากแทน · Stock/ปิเปตด้านบนคำนวณความเข้มข้น Added</p>}
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => addRow(row)}>เตรียมตัวอย่างถัดไปจากค่านี้</Button><Button variant="ghost" size="sm" onClick={() => onChange({ ...settings, rows: settings.rows.filter(item => item.id !== row.id) })}>ลบตัวอย่าง</Button></div>
        {errors.length > 0 && <ul className="text-sm text-destructive">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      </>}
    </div>)}
    <p className="text-xs text-muted-foreground">หากมีตัวอย่างที่ข้อมูลไม่ครบ ระบบจะรอผลของทั้งหัวข้อนั้น ไม่ตัดแถวผิดทิ้งแล้วคำนวณเฉพาะแถวที่เหลือ</p>
  </CardContent></Card>;
}
