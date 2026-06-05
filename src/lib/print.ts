import { api } from "@/lib/api";
import type { PrintDocType } from "@/lib/printConfig";

// แปลง DOM node เป็น HTML string สำหรับส่งไป server.
// node ควรมี <style> ของตัวเองฝังอยู่แล้ว (templates ส่วนใหญ่ทำแบบนี้);
// COA ที่ CSS แยก ให้ส่ง css เข้ามาเพื่อ prepend
export function serializeForPrint(el: HTMLElement | null, css?: string): string {
  if (!el) throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");
  const body = el.outerHTML;
  return css ? `<style>${css}</style>${body}` : body;
}

export interface PrintResult {
  printer: string;
  copies: number;
}

export async function printDocument(
  docType: PrintDocType,
  el: HTMLElement | null,
  opts?: { css?: string; copies?: number },
): Promise<PrintResult> {
  const html = serializeForPrint(el, opts?.css);
  return api.printDocument({ docType, html, copies: opts?.copies });
}
