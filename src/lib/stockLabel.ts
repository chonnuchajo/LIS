import QRCode from "qrcode";
import type { StockUnitItem } from "@/types/stock";

/** สร้าง HTML ลาเบลขวด พร้อม QR (data URL) — ส่งตรงเข้า api.printDocument
 *  QR encode แค่ qrId เปล่า (ไม่ใช่ URL) → ข้อมูลสั้น module ใหญ่ สแกนง่ายแม้พิมพ์เล็ก;
 *  in-app scanner parseScannedQrId คืน id ตรงๆ อยู่แล้ว */
export async function buildStockLabelHtml(unit: StockUnitItem): Promise<string> {
  const qr = await QRCode.toDataURL(unit.qrId, {
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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
