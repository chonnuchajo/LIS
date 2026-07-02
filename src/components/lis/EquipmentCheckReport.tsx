import type { EquipmentCheckRecord } from "@/lib/api";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import {
  fmtDate,
  fmtTime,
  roomLabel,
  roomFilterLabel,
  statusFilterLabel,
  instrumentFilterLabel,
  dateFilterLabel,
} from "@/lib/dailyCheckFormat";

export interface EquipmentCheckReportFilters {
  date: string;
  room: string;
  instrument: string;
  status: string;
}

export interface EquipmentCheckReportProps {
  rows: EquipmentCheckRecord[];
  filters: EquipmentCheckReportFilters;
  printedBy: string;
  printedAt: string; // ISO
}

// A4 landscape — ตาราง 8 คอลัมน์กว้าง; ScaledPreview ย่อพอดีจอด้วย width คงที่
export const EQUIPMENT_REPORT_CSS = `
@page { size: A4 landscape; margin: 12mm; }
body{font-family:'Kanit',sans-serif;margin:0;color:#000;font-size:12px;}
.eqr table{border-collapse:collapse;width:100%;}
.eqr th,.eqr td{border:1px solid #000;padding:5px 8px;vertical-align:top;}
.eqr thead th{background:#f3f4f6;font-weight:600;}
.eqr .sig-line{border-bottom:1px dotted #000;display:inline-block;min-width:200px;}
`;

const renderReadings = (r: EquipmentCheckRecord) =>
  r.readings.length
    ? r.readings.map((x) => `${x.label} ${x.value} ${x.unit}`).join(", ")
    : "—";

export default function EquipmentCheckReport({
  rows,
  filters,
  printedBy,
  printedAt,
}: EquipmentCheckReportProps) {
  const abnormalCount = rows.filter((r) => r.status === "abnormal").length;
  const printedAtLabel = `${fmtDate(printedAt.slice(0, 10))} ${fmtTime(printedAt)}`;

  return (
    <div className="eqr bg-white text-black p-6 font-[Kanit]" style={{ fontSize: 12, width: "1040px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" className="h-12" />
        <div>
          <div className="font-bold text-[15px]">บันทึกการเช็กเครื่องมือประจำวัน</div>
          <div className="text-[12px]">ห้องปฏิบัติการ บริษัท ไอ ซี พี ลัดดา จำกัด</div>
        </div>
      </div>

      {/* Filter context */}
      <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
        <div>วันที่: {dateFilterLabel(filters.date)}</div>
        <div>ห้อง: {roomFilterLabel(filters.room)}</div>
        <div>เครื่อง: {instrumentFilterLabel(filters.room, filters.instrument)}</div>
        <div>สถานะ: {statusFilterLabel(filters.status)}</div>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เวลา</th>
            <th>ห้อง</th>
            <th>เครื่อง</th>
            <th className="text-center">สถานะ</th>
            <th className="text-center">ค่าที่วัด</th>
            <th>หมายเหตุ</th>
            <th>ผู้บันทึก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h._id}>
              <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
              <td className="whitespace-nowrap">{fmtTime(h.checkedAt)}</td>
              <td className="whitespace-nowrap">{roomLabel(h.roomSlug)}</td>
              <td className="whitespace-nowrap">{h.instrumentName} ({h.instrumentId})</td>
              <td className="text-center whitespace-nowrap">{h.status === "normal" ? "ปกติ" : "ผิดปกติ"}</td>
              <td className="text-center">{renderReadings(h)}</td>
              <td>{h.note || "—"}</td>
              <td className="whitespace-nowrap">{h.recorder}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="mt-3 text-[12px]">รวม {rows.length} รายการ — ผิดปกติ {abnormalCount} รายการ</div>

      {/* Signatures + print meta */}
      <div className="mt-10 flex justify-between text-[12px]">
        <div className="text-center">
          <div>ผู้บันทึก <span className="sig-line"></span></div>
          <div className="mt-6">ผู้ตรวจสอบ <span className="sig-line"></span></div>
        </div>
        <div className="self-end text-right text-[11px] text-gray-600">
          <div>พิมพ์เมื่อ: {printedAtLabel}</div>
          <div>ผู้พิมพ์: {printedBy || "—"}</div>
        </div>
      </div>
    </div>
  );
}
