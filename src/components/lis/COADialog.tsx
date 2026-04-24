import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import logo from "@/assets/icp-ladda-logo.png";
import type { SampleItem } from "@/components/lis/SampleColumn";
import type { PhysicalResult } from "@/context/SampleContext";

interface COADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: SampleItem | null;
  physical?: PhysicalResult;
}

const toThaiDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
};

const parseAiName = (name: string) => {
  // e.g. "Glyphosate 48% SL" -> {ai: "Glyphosate", spec: "48% SL"}
  const m = name.match(/^(.+?)\s+([\d.]+%\s*\S+)\s*$/);
  if (m) return { ai: m[1].trim(), spec: m[2].trim() };
  return { ai: name, spec: "" };
};

const buildSpecRange = (spec: string) => {
  const m = spec.match(/([\d.]+)/);
  if (!m) return "-";
  const v = parseFloat(m[1]);
  const lo = (v - 2.5).toFixed(2);
  const hi = (v + 2.5).toFixed(2);
  return `${lo}-${hi}`;
};

const COADialog = ({ open, onOpenChange, sample, physical }: COADialogProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!sample) return null;
  const { ai, spec } = parseAiName(sample.name);
  const today = new Date();
  const sampleDate = new Date(sample.date);
  const reportNo = `${sample.id.replace(/[^\d]/g, "").slice(-7) || "0000000"}`;
  const aiResult = sample.preResult != null ? `${sample.preResult.toFixed(2)} %W/V` : "-";
  const densityVal = physical?.density || (sample.density != null ? sample.density.toFixed(3) : "-");
  const specRange = buildSpecRange(spec);
  const unitMatch = spec.match(/\b(SL|EC|WP|WG|SC|SP|SE|CS|OD|EW|GR)\b/i);
  const method = unitMatch ? "CIPAC E" : "CIPAC E";
  const physColor = physical?.colorMatch === "match" ? "ของเหลวใส" : (physical?.colorNote || "ของเหลวใส");

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>COA ${sample.id}</title>
      <meta charset="utf-8"/>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Sarabun',sans-serif;margin:0;padding:24px;color:#000;font-size:13px;}
        table{border-collapse:collapse;width:100%;}
        td,th{border:1px solid #000;padding:6px 10px;vertical-align:top;}
        .no-border td,.no-border th{border:none;padding:2px 0;}
        .center{text-align:center;}
        .right{text-align:right;}
        .title{font-weight:700;font-size:15px;}
        .small{font-size:11px;color:#333;}
        .sig-line{border-bottom:1px dotted #000;display:inline-block;min-width:280px;}
        img.logo{height:60px;}
        @media print{ body{padding:12px;} button{display:none;} }
      </style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ใบรายงานผลการทดสอบ (COA) — {sample.id}</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white text-black p-6 font-[Sarabun]" style={{ fontSize: 13 }}>
          {/* Header */}
          <table className="w-full border-collapse" style={{ border: "1px solid #000" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #000", width: "32%", verticalAlign: "top", padding: 8 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={logo} alt="ICP Ladda" className="h-12" />
                  </div>
                  <div className="font-semibold">บริษัท ไอ ซี พี ลัดดา จำกัด</div>
                  <div className="text-[11px] leading-tight">
                    151 หมู่ 8 ตำบลสามควายเผือก อำเภอเมือง<br />
                    นครปฐม จังหวัดนครปฐม 73000<br />
                    โทรศัพท์ : 034-305281-2
                  </div>
                </td>
                <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", padding: 8 }}>
                  <div className="font-bold text-[15px]">ห้องปฏิบัติการบริษัท ไอ ซี พี ลัดดา จำกัด</div>
                </td>
                <td style={{ border: "1px solid #000", width: "26%", padding: 8, verticalAlign: "top" }}>
                  <div className="text-right text-[12px] mb-3">หน้า..1/1.....</div>
                  <div className="text-[12px]">เลขที่รายงาน..{reportNo}............</div>
                  <div className="text-[12px]">วันที่.....{toThaiDate(today)}...........</div>
                </td>
              </tr>
              <tr>
                <td colSpan={3} style={{ border: "1px solid #000", textAlign: "center", padding: 8 }}>
                  <div className="font-bold text-[15px]">รายงานผลการทดสอบ</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Customer info */}
          <table className="w-full border-collapse mt-0" style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", padding: 8, borderRight: "1px solid #000", verticalAlign: "top" }}>
                  <div className="text-right text-[11px] italic mb-1">ข้อมูลจากลูกค้า</div>
                  <div>ชื่อ : {sample.sender || sample.receiver || "-"}</div>
                  <div>บริษัท : ไอซีพี ลัดดา จำกัด</div>
                  <div>หน่วยงาน : RD</div>
                  <div>Email : -</div>
                  <div>โทร : -</div>
                </td>
                <td style={{ width: "50%", padding: 8, verticalAlign: "top" }}>
                  <div className="text-right text-[11px] italic mb-1">ข้อมูลจากลูกค้า</div>
                  <div>ชื่อตัวอย่าง : {sample.name}</div>
                  <div>แบทช์หมายเลข : {(sample as any).batchNo || `26RD-${sample.id.slice(-6)}`}</div>
                  <div>วันที่ผลิต/นำเข้า : {toThaiDate(sampleDate)}</div>
                  <div>เลขที่ใบนำส่ง : {sample.id}</div>
                  <div>ผู้ผลิต/ผู้ขาย : -</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Sample info */}
          <table className="w-full border-collapse" style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderBottom: "1px solid #000" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", padding: 8, borderRight: "1px solid #000" }}>เลขที่ตัวอย่าง : {sample.id}</td>
                <td style={{ width: "50%", padding: 8 }}>วันที่รับตัวอย่าง : {toThaiDate(sampleDate)}</td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderRight: "1px solid #000", borderTop: "1px solid #000" }}>วันที่ทดสอบ : {toThaiDate(sampleDate)}</td>
                <td style={{ padding: 8, borderTop: "1px solid #000" }}>วันที่รายงานผล : {toThaiDate(today)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: 8, borderTop: "1px solid #000" }}>สภาพตัวอย่าง : {physColor}</td>
              </tr>
            </tbody>
          </table>

          {/* Result table */}
          <table className="w-full border-collapse" style={{ border: "1px solid #000" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: 8, width: "30%" }}>รายการทดสอบ</th>
                <th style={{ border: "1px solid #000", padding: 8, width: "22%" }}>ผลการทดสอบ</th>
                <th style={{ border: "1px solid #000", padding: 8, width: "26%" }}>เกณฑ์กำหนด</th>
                <th style={{ border: "1px solid #000", padding: 8, width: "22%" }}>วิธีทดสอบ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>{ai}</td>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>{aiResult}</td>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>{specRange}</td>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>{method}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>Density</td>
                <td style={{ border: "1px solid #000", padding: 10, textAlign: "center" }}>{densityVal} g/cm³</td>
                <td style={{ border: "1px solid #000", padding: 10 }}></td>
                <td style={{ border: "1px solid #000", padding: 10 }}></td>
              </tr>
              <tr><td style={{ border: "1px solid #000", padding: 10, height: 40 }}></td><td style={{ border: "1px solid #000" }}></td><td style={{ border: "1px solid #000" }}></td><td style={{ border: "1px solid #000" }}></td></tr>
              <tr><td style={{ border: "1px solid #000", padding: 10, height: 40 }}></td><td style={{ border: "1px solid #000" }}></td><td style={{ border: "1px solid #000" }}></td><td style={{ border: "1px solid #000" }}></td></tr>
            </tbody>
          </table>

          <div className="mt-6 text-[12px]">หมายเหตุ : {physical?.colorNote || "-"}</div>

          <div className="mt-10 text-center text-[12px]">
            <div>ผู้ทดสอบ <span className="sig-line inline-block border-b border-dotted border-black min-w-[260px]"></span> นักเคมี</div>
            <div className="mt-1">( {sample.receiver || "นางสาวนุชจรินทร์ ดวงเนตร"} )</div>
            <div className="mt-6">ผู้อนุมัติ / ผู้ตรวจสอบ <span className="sig-line inline-block border-b border-dotted border-black min-w-[240px]"></span> หัวหน้าห้องปฏิบัติการ</div>
            <div className="mt-1">( นายนคร อ่อนคง )</div>
          </div>

          <div className="mt-8 text-[11px]">
            <div><strong>หมายเหตุ</strong> รายงานนี้มีผลเฉพาะกับตัวอย่างที่นำมาทดสอบเท่านั้น</div>
            <div className="ml-12">รายงานผลทดสอบต้องไม่ถูกทำสำเนาเฉพาะเพียงบางส่วน โดยได้รับความยินยอมเป็นลายลักษณ์อักษรจากห้องปฏิบัติการ ยกเว้นทำทั้งฉบับ</div>
          </div>

          <div className="flex justify-between mt-6 text-[11px] text-gray-600">
            <span>F-CHM-01-03 Rev 00 16/01/69</span>
            <span>End of Report</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> พิมพ์ / บันทึก PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default COADialog;
