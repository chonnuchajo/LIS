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
@media screen { .coa-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
.coa-root h1, .coa-root th, .coa-title, .print-heading { font-weight: ${A4_PRINT_HEADING_FONT_WEIGHT} !important; }
`;

export default function CoaReportTemplate({ pages }: { pages: CoaReportPage[] }) {
  return (
    <div className="coa-root">
      <style>{COA_REPORT_CSS}</style>
      {pages.map((page, index) => (
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
            <div>{page.approvedBy} · {page.approvedAt}</div>
          </div>
        </section>
      ))}
    </div>
  );
}
