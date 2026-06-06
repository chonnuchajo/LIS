import QRCode from "qrcode";
import type { StockUnitItem } from "@/types/stock";

/** สร้าง HTML ลาเบลขวด พร้อม QR (data URL) — ส่งตรงเข้า api.printDocument */
export async function buildStockLabelHtml(
  unit: StockUnitItem,
  origin: string,
): Promise<string> {
  const scanUrl = `${origin.replace(/\/$/, "")}/LIS/stock/scan/${encodeURIComponent(unit.qrId)}`;
  const qr = await QRCode.toDataURL(scanUrl, { margin: 1, width: 240 });
  const exp = unit.exp ? new Date(unit.exp).toLocaleDateString("th-TH") : "-";
  const kindLabel = unit.kind === "working" ? "WORKING" : "SEALED";
  const size = `${unit.volume?.initial ?? "-"} ${unit.volume?.unit ?? ""}`;
  return `
<div style="display:flex;gap:8px;align-items:center;font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:6mm;">
  <img src="${qr}" alt="qr" style="width:34mm;height:34mm;flex:none;" />
  <div style="font-size:11pt;line-height:1.4;">
    <div style="font-weight:700;font-size:14pt;">${escapeHtml(unit.itemName || "")}</div>
    <div>Code: <b>${escapeHtml(unit.itemCode || "")}</b> · <b>${kindLabel}</b></div>
    <div>Lot: ${escapeHtml(unit.lotNo || "-")} · ขนาด: ${escapeHtml(size)}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
    <div style="font-size:8pt;color:#666;margin-top:4px;">${escapeHtml(unit.qrId)}</div>
  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
