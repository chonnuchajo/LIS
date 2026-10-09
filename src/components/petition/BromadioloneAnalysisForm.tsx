import type { LabReportPage } from "@/lib/labReport";

export const BROMADIOLONE_ANALYSIS_CSS = `
.brom-form-root, .brom-form-root * { box-sizing: border-box; color: #000; font-family: Cordia New, Tahoma, sans-serif; }
.brom-form-page { width: 297mm; min-height: 210mm; padding: 12mm 14mm; background: #fff; }
.brom-form-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.brom-form-table td, .brom-form-table th { border: 0.8pt solid #000; padding: 2mm 2.5mm; vertical-align: middle; }
.brom-form-title { text-align: center; font-size: 16pt; font-weight: 700; margin-bottom: 5mm; }
.brom-form-label { font-weight: 700; }
.brom-form-center { text-align: center; }
.brom-form-section { margin-top: 4mm; font-weight: 700; }
.brom-form-no-border td { border: 0; padding: 1.5mm 0; }
.brom-form-sign { margin-top: 9mm; display: flex; justify-content: space-between; text-align: center; }
.brom-form-sign > div { width: 38%; }
.brom-form-line { display: block; border-bottom: 0.8pt dotted #000; margin-bottom: 1mm; }
@media screen { .brom-form-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
`;

function rowValue(page: LabReportPage, pattern: RegExp): string {
  return page.rows.find((row) => pattern.test(row.testItem))?.result || "";
}

function rowCriteria(page: LabReportPage, pattern: RegExp): string {
  return page.rows.find((row) => pattern.test(row.testItem))?.criteria || "";
}

export default function BromadioloneAnalysisForm({ page }: { page: LabReportPage }) {
  const aiResult = rowValue(page, /%\s*AI|BROMADIOLONE/i);
  const aiCriteria = rowCriteria(page, /%\s*AI|BROMADIOLONE/i) || "0.005% ± 0.00125";
  const waxResult = rowValue(page, /wax\s*block/i);
  const densityResult = rowValue(page, /density|ถพ\.?/i);

  return (
    <div className="brom-form-root">
      <style>{BROMADIOLONE_ANALYSIS_CSS}</style>
      <section className="brom-form-page">
        <div className="brom-form-title">ใบคำนวณผลวิเคราะห์</div>
        <table className="brom-form-table brom-form-no-border">
          <tbody>
            <tr>
              <td><span className="brom-form-label">ตัวอย่างเลขที่</span> {page.reportNo}</td>
              <td><span className="brom-form-label">ชื่อสามัญ</span> Bromadiolone</td>
              <td><span className="brom-form-label">สูตร</span> 0.005%</td>
              <td><span className="brom-form-label">รูปแบบ</span> Wax block</td>
            </tr>
            <tr>
              <td colSpan={2}><span className="brom-form-label">เลขที่ Standard</span> {page.sample.sampleNo || "-"}</td>
              <td colSpan={2}><span className="brom-form-label">เลขที่ Solvent number</span> {page.sample.submissionNo || "-"}</td>
            </tr>
          </tbody>
        </table>

        <div className="brom-form-section">System suitability</div>
        <table className="brom-form-table">
          <thead><tr><th>รายการ</th><th>ผลการทดสอบ</th><th>เกณฑ์กำหนด</th><th>สถานะ</th></tr></thead>
          <tbody><tr><td>% RSD ของ Standard</td><td className="brom-form-center">-</td><td className="brom-form-center">ไม่เกิน 2%</td><td className="brom-form-center">-</td></tr></tbody>
        </table>

        <div className="brom-form-section">ผลการวิเคราะห์ตัวอย่าง</div>
        <table className="brom-form-table">
          <thead><tr><th>รายการทดสอบ</th><th>ผลการทดสอบ</th><th>เกณฑ์กำหนด</th><th>หน่วย</th></tr></thead>
          <tbody>
            <tr><td>%AI content (W/W)</td><td className="brom-form-center">{aiResult || "-"}</td><td className="brom-form-center">{aiCriteria}</td><td className="brom-form-center">% W/W</td></tr>
            <tr><td>Wax block size</td><td className="brom-form-center">{waxResult || "-"}</td><td className="brom-form-center">5.88 gm ± 5%</td><td className="brom-form-center">gm</td></tr>
            <tr><td>Density</td><td className="brom-form-center">{densityResult || "-"}</td><td className="brom-form-center">-</td><td className="brom-form-center">g/cm³</td></tr>
          </tbody>
        </table>

        <table className="brom-form-table brom-form-no-border">
          <tbody><tr><td><span className="brom-form-label">วันที่</span> {page.reportDate || "-"}</td><td><span className="brom-form-label">ผู้วิเคราะห์</span> {page.analystName || "-"}</td><td><span className="brom-form-label">ผู้อนุมัติ</span> {page.labHeadName || "-"}</td></tr></tbody>
        </table>
        <div className="brom-form-sign"><div><span className="brom-form-line" />ผู้วิเคราะห์</div><div><span className="brom-form-line" />ผู้อนุมัติ</div></div>
      </section>
    </div>
  );
}
