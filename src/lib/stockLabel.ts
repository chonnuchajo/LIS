import QRCode from "qrcode";
import type { StockUnitItem } from "@/types/stock";

const STOCK_DEDUCTION_QR_BASE_URL = "https://app-plant.icpladda.com/LIS/stock-deduction";

export function stockDeductionQrUrl(qrId: string): string {
  const url = new URL(STOCK_DEDUCTION_QR_BASE_URL);
  url.searchParams.set("qrId", qrId);
  return url.toString();
}

/** สร้าง HTML ลาเบลขวด พร้อม QR (data URL) — ส่งตรงเข้า api.printDocument
 *  QR encode URL หน้าเบิก stock เพื่อให้สแกนจากกล้อง/แอปใดก็เปิดหน้าเบิกได้ทันที;
 *  in-app scanner parseScannedQrId ยังรองรับ qrId เปล่าและ URL เดิมอยู่ */
export async function buildStockLabelHtml(unit: StockUnitItem): Promise<string> {
  const qr = await QRCode.toDataURL(stockDeductionQrUrl(unit.qrId), {
    margin: 3, // quiet zone กว้างขึ้น ให้กล้องจับขอบ QR ได้ง่าย
    width: 512, // render คมขึ้น (เดิม 240)
    errorCorrectionLevel: "M",
  });
  const exp = unit.exp ? new Date(unit.exp).toLocaleDateString("th-TH") : "-";
  const kindLabel = unit.kind === "working" ? "WORKING" : "SEALED";
  const size = `${unit.volume?.initial ?? "-"}${unit.volume?.unit ? " " + unit.volume.unit : ""}`;
  return `
<div style="display:flex;gap:8px;align-items:center;font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:6mm;">
  <img src="${qr}" alt="qr" style="width:56mm;height:56mm;flex:none;" />
  <div style="font-size:12pt;line-height:1.4;min-width:0;">
    <div style="font-weight:700;font-size:15pt;">${escapeHtml(unit.itemName || "")}</div>
    <div>Code: <b>${escapeHtml(unit.itemCode || "")}</b> · <b>${kindLabel}</b></div>
    <div>Lot: ${escapeHtml(unit.lotNo || "-")} · ขนาด: ${escapeHtml(size)}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
    <div style="font-size:9pt;color:#666;margin-top:4px;">${escapeHtml(unit.qrId)}</div>
  </div>
</div>`.trim();
}

/** สติกเกอร์สารเคมี — solvent ไม่ได้ track รายขวด จึงไม่มี StockUnit/qrId จริง
 *  QR encode URL หน้าเบิก stock พร้อม idForQr (= _id ของสารเคมี) เพื่อให้เปิดหน้าเบิกได้ทันที
 *  หน้าเบิก stock จะ resolve เป็นสารเคมีจาก idForQr */
export async function buildSolventLabelHtml(payload: {
  name: string;
  idForQr: string;
  lotNo?: string;
  exp?: string | null;
  sizeLabel?: string;
}): Promise<string> {
  const qr = await QRCode.toDataURL(stockDeductionQrUrl(payload.idForQr), {
    margin: 3,
    width: 512,
    errorCorrectionLevel: "M",
  });
  const exp = payload.exp ? new Date(payload.exp).toLocaleDateString("th-TH") : "-";
  const size = payload.sizeLabel || "-";
  return `
<div style="display:flex;gap:8px;align-items:center;font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:6mm;color:#000;">
  <img src="${qr}" alt="qr" style="width:56mm;height:56mm;flex:none;" />
  <div style="font-size:12pt;line-height:1.4;min-width:0;color:#000;">
    <div style="font-weight:700;font-size:15pt;">${escapeHtml(payload.name || "")}</div>
    <div>สารเคมี · ขนาด: ${escapeHtml(size)}</div>
    <div>Lot: ${escapeHtml(payload.lotNo || "-")}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
