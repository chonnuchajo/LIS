export async function exportValidationPdf(html: string): Promise<Blob> {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${base}/api/print/pdf`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: "method-validation", html }),
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("application/pdf")) {
      throw new Error("สร้าง PDF ไม่สำเร็จ ตรวจว่า server พร้อมใช้งาน หรือดาวน์โหลด HTML เพื่อพิมพ์จากเบราว์เซอร์");
    }
    const blob = await response.blob();
    if ((await blob.slice(0, 5).text()) !== "%PDF-") throw new Error("ไฟล์ที่ได้รับไม่ใช่ PDF กรุณาลองใหม่");
    return blob;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("สร้าง PDF หมดเวลา กรุณาลองใหม่หรือดาวน์โหลด HTML");
    if (error instanceof TypeError) throw new Error("ติดต่อ server ไม่ได้ กรุณาลองใหม่หรือดาวน์โหลด HTML");
    throw error;
  } finally { clearTimeout(timeout); }
}
