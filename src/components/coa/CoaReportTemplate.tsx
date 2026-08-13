import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import type { CoaReportPage } from "@/lib/coaReport";
import { A4_PRINT_FONT_FAMILY, A4_PRINT_FONT_SIZE, A4_PRINT_HEADING_FONT_WEIGHT } from "@/lib/printConfig";

export const COA_REPORT_CSS = `
.coa-root, .coa-root * { box-sizing: border-box; color: #000; font-family: ${A4_PRINT_FONT_FAMILY}; font-size: ${A4_PRINT_FONT_SIZE}; }
.coa-page { width: 210mm; min-height: 297mm; padding: 12mm; background: #fff; }
.coa-page + .coa-page { margin-top: 6mm; page-break-before: always; break-before: page; }
.coa-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.coa-table td, .coa-table th { border: 0.8pt solid #000; padding: 2.4mm; vertical-align: top; word-break: break-word; }
.coa-title { text-align: center; font-size: 15pt; font-weight: 700; }
.coa-logo { height: 16mm; }
.coa-center { text-align: center; }
.coa-right { text-align: right; }
.coa-muted { color: #555; }
.coa-sign { margin-top: 14mm; text-align: center; }
.coa-line { display: inline-block; min-width: 62mm; border-bottom: 0.8pt dotted #000; }
.coa-special-page { padding: 24mm 22mm 18mm; }
.coa-special-title { margin-top: 0; text-align: center; font-size: 14pt; font-weight: 700; letter-spacing: 0; }
.coa-special-meta { margin-top: 7mm; text-align: right; line-height: 1.7; }
.coa-special-fields { margin-top: 7mm; line-height: 2.25; }
.coa-special-label { font-weight: 700; }
.coa-special-table { margin-top: 8mm; }
.coa-special-table th, .coa-special-table td { text-align: center; vertical-align: middle; }
.coa-special-sign { margin-top: 28mm; margin-left: auto; width: 78mm; text-align: center; line-height: 1.55; }
.coa-liquid-page { background: #fff3b0; }
.coa-brom-page { padding: 24mm 22mm 18mm; }
.coa-brom-title { margin-top: 0; text-align: center; font-size: 14pt; font-weight: 700; letter-spacing: 0; }
.coa-brom-meta { margin-top: 7mm; text-align: right; line-height: 1.7; }
.coa-brom-fields { margin-top: 7mm; line-height: 2.35; }
.coa-brom-label { font-weight: 700; }
.coa-brom-table { margin-top: 8mm; width: 128mm; }
.coa-brom-table th, .coa-brom-table td { text-align: center; vertical-align: middle; }
.coa-brom-sign { margin-top: 30mm; margin-left: auto; width: 78mm; text-align: center; line-height: 1.55; }
@media screen { .coa-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
.coa-root h1, .coa-root th, .coa-title, .print-heading { font-weight: ${A4_PRINT_HEADING_FONT_WEIGHT} !important; }
`;

function SpecialCoaPage({ page, index }: { page: CoaReportPage; index: number }) {
  const sample = page.samples[0];

  return (
    <section className="coa-page coa-special-page" key={`${page.coaNo}-${index}`}>
      <h1 className="coa-special-title">CERTIFICATE OF ANALYSIS</h1>
      <div className="coa-special-meta">
        <div>NO. {page.coaNo === "-" ? "" : page.coaNo}</div>
        <div>Month Date, ค.ศ.</div>
      </div>

      <div className="coa-special-fields">
        <div><span className="coa-special-label">PRODUCT :</span> {sample?.product || "-"}</div>
        <div><span className="coa-special-label">MANUFACTURER :</span> I C P Ladda Company Limited, Thailand</div>
        <div><span className="coa-special-label">MANUFACTURING DATE :</span> {sample?.manufacturingDate || "-"}</div>
        <div><span className="coa-special-label">EXPIRED DATE :</span> {sample?.expiredDate || "-"}</div>
      </div>

      <table className="coa-table coa-special-table">
        <thead>
          <tr>
            <th>TEST ITEM</th>
            <th>Specification</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Appearance</td>
            <td />
            <td>Conform</td>
          </tr>
          <tr>
            <td colSpan={2}>BATCH NO.</td>
            <td>{sample?.batchLabel === "-" ? "" : sample?.batchLabel}</td>
          </tr>
          <tr>
            <td>%AI content (W/W)</td>
            <td>{sample?.aiContentCriteria === "-" ? "" : sample?.aiContentCriteria}</td>
            <td>{sample?.aiContentResult === "-" ? "" : sample?.aiContentResult}</td>
          </tr>
          <tr>
            <td colSpan={2}>Date of analysis</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="coa-special-sign">
        <span className="coa-line" />
        <div>(สิริพรญ์ สงสมพันธ์)</div>
        <div>Asst. Quality Control Manager</div>
      </div>
    </section>
  );
}

function LiquidCoaPage({ page, index }: { page: CoaReportPage; index: number }) {
  const sample = page.samples[0];

  return (
    <section className="coa-page coa-special-page coa-liquid-page" key={`${page.coaNo}-${index}`}>
      <h1 className="coa-special-title">CERTIFICATE OF ANALYSIS</h1>
      <div className="coa-special-meta">
        <div>NO. {page.coaNo === "-" ? "" : page.coaNo}</div>
        <div>Month DATE, ค.ศ.</div>
      </div>

      <div className="coa-special-fields">
        <div><span className="coa-special-label">PRODUCT :</span> {sample?.product || "-"}</div>
        <div><span className="coa-special-label">MANUFACTURER :</span> I C P Ladda Company Limited, Thailand</div>
        <div><span className="coa-special-label">MANUFACTURING DATE :</span> {sample?.manufacturingDate || "-"}</div>
        <div><span className="coa-special-label">EXPIRED DATE :</span> {sample?.expiredDate || "-"}</div>
      </div>

      <table className="coa-table coa-special-table">
        <thead>
          <tr>
            <th>TEST ITEM</th>
            <th>Specification</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Appearance</td>
            <td />
            <td>Conform</td>
          </tr>
          <tr>
            <td colSpan={2}>BATCH NO.</td>
            <td>{sample?.batchLabel === "-" ? "" : sample?.batchLabel}</td>
          </tr>
          <tr>
            <td>%AI content (W/V)</td>
            <td>{sample?.aiContentCriteria === "-" ? "" : sample?.aiContentCriteria}</td>
            <td>{sample?.aiContentResult === "-" ? "" : sample?.aiContentResult}</td>
          </tr>
          <tr>
            <td>Density at 30°C (g/cm³)</td>
            <td />
            <td>{sample?.densityResult === "-" ? "" : sample?.densityResult}</td>
          </tr>
          <tr>
            <td colSpan={2}>Date of analysis</td>
            <td>{sample?.dateOfAnalysis === "-" ? "" : sample?.dateOfAnalysis}</td>
          </tr>
        </tbody>
      </table>

      <div className="coa-special-sign">
        <span className="coa-line" />
        <div>(สิริพิชญ์ สงสมพันธ์)</div>
        <div>Asst. Quality Control Manager</div>
      </div>
    </section>
  );
}

function BromadioloneCoaPage({ page, index }: { page: CoaReportPage; index: number }) {
  const sample = page.samples[0];

  return (
    <section className="coa-page coa-brom-page" key={page.coaNo + "-" + index}>
      <h1 className="coa-brom-title">CERTIFICATE OF ANALYSIS</h1>
      <div className="coa-brom-meta">
        <div>NO. {page.coaNo === "-" ? "" : page.coaNo}</div>
        <div>Month DATE, ค.ศ.</div>
      </div>

      <div className="coa-brom-fields">
        <div><span className="coa-brom-label">PRODUCT :</span> {sample?.product || "-"}</div>
        <div><span className="coa-brom-label">MANUFACTURER :</span> I C P Ladda Company Limited, Thailand</div>
        <div><span className="coa-brom-label">MANUFACTURING DATE :</span> {sample?.manufacturingDate || "-"}</div>
        <div><span className="coa-brom-label">EXPIRED DATE :</span> {sample?.expiredDate || "-"}</div>
      </div>

      <table className="coa-table coa-brom-table">
        <thead>
          <tr>
            <th>TEST ITEM</th>
            <th>Specification</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Appearance</td>
            <td>Red wax block</td>
            <td>Conform</td>
          </tr>
          <tr>
            <td colSpan={2}>BATCH NO.</td>
            <td>{sample?.batchLabel === "-" ? "" : sample?.batchLabel}</td>
          </tr>
          <tr>
            <td>%AI content (W/W)</td>
            <td>{sample?.aiContentCriteria === "-" ? "0.005% ± 0.00125" : sample?.aiContentCriteria}</td>
            <td>{sample?.aiContentResult === "-" ? "" : sample?.aiContentResult}</td>
          </tr>
          <tr>
            <td>Wax block size</td>
            <td>5.88 gm ± 5%</td>
            <td>{sample?.waxBlockSizeResult === "-" ? "" : sample?.waxBlockSizeResult}</td>
          </tr>
          <tr>
            <td colSpan={2}>Date of analysis</td>
            <td>{sample?.dateOfAnalysis === "-" ? "" : sample?.dateOfAnalysis}</td>
          </tr>
        </tbody>
      </table>

      <div className="coa-brom-sign">
        <span className="coa-line" />
        <div>(สิริพิชญ์ สงสมพันธ์)</div>
        <div>Asst. Quality Control Manager</div>
      </div>
    </section>
  );
}

function StandardCoaPage({ page, index }: { page: CoaReportPage; index: number }) {
  return (
    <section className="coa-page" key={`${page.coaNo}-${index}`}>
      <table className="coa-table">
        <tbody>
          <tr>
            <td style={{ width: "34%" }}><img className="coa-logo" src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" /></td>
            <td className="coa-title">Certificate of Analysis<br />ใบรับรองผลการวิเคราะห์</td>
            <td style={{ width: "28%" }}>
              <div>COA No. {page.coaNo}</div>
              {page.revision > 0 && <div>Revision {page.revision}</div>}
              <div>Issue date {page.issueDate}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="coa-table">
        <tbody>
          <tr>
            <td>Customer: {page.customer.name || "-"}</td>
            <td>Company: {page.customer.company || "-"}</td>
          </tr>
          <tr>
            <td>Petition No.: {page.petitionNo}</td>
            <td>Approved by: {page.approvedBy}</td>
          </tr>
        </tbody>
      </table>
      {page.samples.map((sample) => (
        <table className="coa-table" key={sample.itemSeq}>
          <thead>
            <tr><th colSpan={4}>Sample: {sample.sampleName || sample.commonName || `Sample ${sample.itemSeq}`} / Batch: {sample.batchNo || sample.lotNo || "-"}</th></tr>
            <tr><th>Test item</th><th>Result</th><th>Criteria</th><th>Method</th></tr>
          </thead>
          <tbody>
            {sample.rows.length ? sample.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td>{row.testItem || "-"}</td>
                <td className="coa-center">{row.result || "-"}</td>
                <td className="coa-center">{row.criteria || "-"}</td>
                <td className="coa-center">{row.method || "-"}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="coa-center coa-muted">ไม่พบผลทดสอบ</td></tr>
            )}
          </tbody>
        </table>
      ))}
      <div style={{ marginTop: "6mm" }}>Remark: {page.remark || "-"}</div>
      <div className="coa-sign">
        <span className="coa-line" />
        <div>QC Head</div>
        <div>{page.approvedBy} - {page.approvedAt}</div>
      </div>
    </section>
  );
}

export default function CoaReportTemplate({ pages }: { pages: CoaReportPage[] }) {
  return (
    <div className="coa-root">
      <style>{COA_REPORT_CSS}</style>
      {pages.map((page, index) => (
        page.template === "bromadiolone0005"
          ? <BromadioloneCoaPage page={page} index={index} key={`${page.coaNo}-${index}`} />
          : page.template === "liquid"
            ? <LiquidCoaPage page={page} index={index} key={`${page.coaNo}-${index}`} />
          : page.template === "grWpSp"
            ? <SpecialCoaPage page={page} index={index} key={`${page.coaNo}-${index}`} />
            : <StandardCoaPage page={page} index={index} key={`${page.coaNo}-${index}`} />
      ))}
    </div>
  );
}
