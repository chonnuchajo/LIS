import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import type { LabReportPage } from "@/lib/labReport";

export const BROMADIOLONE_ANALYSIS_CSS = `
.brom-form-root, .brom-form-root * { box-sizing: border-box; color: #000; font-family: Tahoma, sans-serif; }
.brom-form-page { width: 297mm; min-height: 210mm; padding: 9mm 16mm 8mm; background: #fff; }
.brom-form-title { text-align: center; font-size: 12pt; margin: 12mm 0 7mm; }
.brom-form-logo { width: 39mm; height: auto; object-fit: contain; }
.brom-form-top { display: grid; grid-template-columns: 42% 58%; align-items: start; }
.brom-form-heading { display: grid; grid-template-columns: 33% 34% 13% 20%; align-items: end; column-gap: 3mm; font-size: 9pt; }
.brom-form-field { display: inline-block; min-width: 30mm; border-bottom: .6pt solid #000; padding: 0 2mm 1mm; text-align: center; }
.brom-form-field-wide { min-width: 67mm; }
.brom-form-field-small { min-width: 20mm; }
.brom-form-line-row { display: grid; grid-template-columns: 37mm 37mm 37mm 37mm 37mm; gap: 18mm; margin-top: 6mm; font-size: 9pt; }
.brom-form-line-cell { text-align: center; }
.brom-form-line-cell .brom-form-line { display: block; border-bottom: .6pt solid #000; min-height: 7mm; padding-top: 2mm; }
.brom-form-section { margin-top: 5mm; font-size: 9pt; }
.brom-form-summary { width: 78mm; margin-top: 8mm; font-size: 9pt; }
.brom-form-summary-row { display: grid; grid-template-columns: 18mm 53mm 15mm; align-items: end; min-height: 7mm; }
.brom-form-summary-row .brom-form-line { border-bottom: .6pt solid #000; min-height: 6mm; text-align: center; }
.brom-form-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 35mm; margin-top: 15mm; font-size: 9pt; }
.brom-form-signature-line { display: inline-block; width: 76mm; border-bottom: .6pt solid #000; height: 7mm; vertical-align: bottom; }
.brom-form-signature-name { margin: 7mm 0 0 35mm; color: #1670b7; }
.brom-form-footer { margin-top: 12mm; font-size: 8pt; color: #1670b7; }
@media screen { .brom-form-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
`;

function values(page: LabReportPage, pattern: RegExp): string[] {
  return page.rows.filter((row) => pattern.test(row.testItem)).map((row) => row.result).filter(Boolean);
}

function firstValue(page: LabReportPage, pattern: RegExp, fallback = "") {
  return values(page, pattern)[0] || fallback;
}

export default function BromadioloneAnalysisForm({ page }: { page: LabReportPage }) {
  const aiValues = values(page, /%\s*AI|BROMADIOLONE/i);
  const areaValues = values(page, /area|พื้นที่/i);
  const sampleValues = aiValues.length ? aiValues : ["-", "-", "-"];
  const sampleAverage = sampleValues[0] || "-";
  const area = areaValues.length ? areaValues : ["-", "-", "-"];

  return (
    <div className="brom-form-root">
      <style>{BROMADIOLONE_ANALYSIS_CSS}</style>
      <section className="brom-form-page">
        <div className="brom-form-top"><img className="brom-form-logo" src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" /><div className="brom-form-title">ใบคำนวณผลวิเคราะห์</div></div>
        <div className="brom-form-heading">
          <div>ตัวอย่างเลขที่ <span className="brom-form-field">{page.reportNo}</span></div><div>ชื่อสามัญ <span className="brom-form-field brom-form-field-wide">Bromadiolone</span></div><div>สูตร <span className="brom-form-field brom-form-field-small">0.005</span></div><div>% <span className="brom-form-field brom-form-field-small">Wax block</span></div>
        </div>
        <div className="brom-form-heading" style={{ marginTop: "4mm", gridTemplateColumns: "42% 58%" }}><div>เลขที่ Standard <span className="brom-form-field">{page.sample.sampleNo || "-"}</span></div><div>เลขที่ Solvent numbet <span className="brom-form-field">{page.sample.submissionNo || "-"}</span></div></div>
        <div className="brom-form-section">System suitability</div>
        <div className="brom-form-line-row">{['Area Inj.1', 'Area Inj.2', 'Area Inj.3', 'Average', '% RSD (ไม่เกิน 2 %)'].map((label, index) => <div className="brom-form-line-cell" key={label}>{label}<span className="brom-form-line">{area[index] || "-"}</span></div>)}</div>
        <div className="brom-form-line-row" style={{ marginTop: "8mm" }}><div>Control&nbsp; Sample <span className="brom-form-line">= &nbsp; {firstValue(page, /control/i, "-")} % WW</span></div>{[1, 2, 3, 4].map((index) => <div className="brom-form-line-cell" key={index}>&nbsp;<span className="brom-form-line">-</span></div>)}</div>
        <div className="brom-form-line-row" style={{ marginTop: "8mm" }}>{['% Sample 1', '% Sample 2', '% Sample 3', 'Average', '% RSD (ไม่เกิน 2 %)'].map((label, index) => <div className="brom-form-line-cell" key={label}>{label}<span className="brom-form-line">{sampleValues[index] || (index === 3 ? sampleAverage : "-")}</span></div>)}</div>
        <div className="brom-form-summary"><div className="brom-form-summary-row"><span>Average</span><span className="brom-form-line">{sampleAverage}</span><span>% W/W</span></div><div className="brom-form-summary-row"><span>Density</span><span className="brom-form-line">{firstValue(page, /density|ถพ\.?/i, "1.000")}</span><span>g/cm³</span></div><div className="brom-form-summary-row"><span>Report</span><span className="brom-form-line">{sampleAverage}</span><span>% W/W</span></div><div className="brom-form-summary-row"><span>Date</span><span className="brom-form-line">{page.reportDate || "-"}</span><span>&nbsp;</span></div></div>
        <div className="brom-form-signatures"><div>Analyst <span className="brom-form-signature-line" /><div className="brom-form-signature-name">(..........{page.analystName || "-"}..........)</div></div><div>Approved <span className="brom-form-signature-line" /><div className="brom-form-signature-name">(..........{page.labHeadName || "-"}..........)</div></div></div>
        <div className="brom-form-footer">FM-QP-07-08-002-R01 (16/12/67) P1/1</div>
      </section>
    </div>
  );
}
