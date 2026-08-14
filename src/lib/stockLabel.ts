import QRCode from "qrcode";
import type { StockUnitItem } from "@/types/stock";

const STOCK_PUBLIC_VIEW_QR_BASE_URL = "https://app-plant.icpladda.com/LIS/stock/view";

export function stockDeductionQrUrl(qrId: string): string {
  const url = new URL(STOCK_PUBLIC_VIEW_QR_BASE_URL);
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
  const typeLabel = unit.type || "primary";
  const size = `${unit.volume?.initial ?? "-"}${unit.volume?.unit ? " " + unit.volume.unit : ""}`;
  const lotBottleLabel = formatLotBottleLabel(unit.lotBottleNo);
  const lotBottleHtml = lotBottleLabel ? ` · <b>${escapeHtml(lotBottleLabel)}</b>` : "";
  return `
<div style="display:flex;gap:1.2mm;align-items:center;font-family:'Kanit',Tahoma,Arial,sans-serif;width:65mm;height:25mm;box-sizing:border-box;padding:1mm;color:#000;background:#fff;overflow:hidden;">
  <img src="${qr}" alt="qr" style="width:17mm;height:17mm;flex:none;" />
  <div style="font-size:6.8pt;line-height:1.24;min-width:0;color:#000;overflow:hidden;flex:1;">
    <div style="font-weight:700;font-size:8.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(unit.itemName || "")}</div>
    <div>STD: <b>${escapeHtml(unit.itemCode || "")}</b></div>
    <div>ประเภท: <b>${escapeHtml(typeLabel)}</b> · ${escapeHtml(size)}</div>
    <div>Lot: <b>${escapeHtml(unit.lotNo || "-")}</b>${lotBottleHtml}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
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
<div style="display:flex;gap:1.2mm;align-items:center;font-family:'Kanit',Tahoma,Arial,sans-serif;width:65mm;height:25mm;box-sizing:border-box;padding:1mm;color:#000;background:#fff;overflow:hidden;">
  <img src="${qr}" alt="qr" style="width:17mm;height:17mm;flex:none;" />
  <div style="font-size:6.8pt;line-height:1.24;min-width:0;color:#000;overflow:hidden;flex:1;">
    <div style="font-weight:700;font-size:8.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(payload.name || "")}</div>
    <div>สารเคมี · ${escapeHtml(size)}</div>
    <div>Lot: <b>${escapeHtml(payload.lotNo || "-")}</b></div>
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

function formatLotBottleLabel(value?: number | null): string {
  const bottleNo = Number(value);
  return Number.isInteger(bottleNo) && bottleNo > 0 ? `ขวดที่ ${bottleNo}` : "";
}
