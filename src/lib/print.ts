import { api } from "@/lib/api";
import type { PrintDocType } from "@/lib/printConfig";

// แปลง DOM node เป็น HTML string สำหรับส่งไป server.
// node ควรมี <style> ของตัวเองฝังอยู่แล้ว (บาง template ทำ); ที่เหลือใช้ Tailwind
// ซึ่งต้องส่ง CSS ของแอปไปด้วย (ดู collectDocumentCss)
export function serializeForPrint(el: HTMLElement | null, css?: string): string {
  if (!el) throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");
  const body = el.outerHTML;
  return css ? `<style>${css}</style>${body}` : body;
}

// รวบรวม CSS ทั้งหมดจาก stylesheet ของหน้า (Tailwind + global) เพื่อให้ PDF ฝั่ง server
// หน้าตาตรงกับ preview ในแอป. ข้าม sheet ที่อ่านไม่ได้ (cross-origin เช่น Google Fonts).
export function collectDocumentCss(): string {
  let css = "";
  if (typeof document === "undefined") return css;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet — not readable; server links fonts itself
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      css += rule.cssText + "\n";
    }
  }
  return css;
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
  // prepend the app's stylesheet first, then any per-call css (per-call wins on conflict)
  const combinedCss = [collectDocumentCss(), opts?.css].filter(Boolean).join("\n");
  const html = serializeForPrint(el, combinedCss || undefined);
  return api.printDocument({ docType, html, copies: opts?.copies });
}

export function openBrowserPrintPreview(
  title: string,
  el: HTMLElement | null,
  opts?: { css?: string },
) {
  const combinedCss = [collectDocumentCss(), opts?.css].filter(Boolean).join("\n");
  const html = serializeForPrint(el, combinedCss || undefined);
  // NOTE: ห้ามใส่ noopener/noreferrer — ถ้าใส่ window.open จะคืนค่า null เสมอ
  // ทำให้เขียนเนื้อหาลงหน้าต่างไม่ได้ (preview จะว่างเปล่า)
  const preview = window.open("", "_blank");
  if (!preview) {
    throw new Error("เปิดหน้าต่าง print preview ไม่สำเร็จ (ป๊อปอัปอาจถูกบล็อก)");
  }

  preview.document.open();
  preview.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      html, body { margin: 0; padding: 0; background: #fff; font-family: "Kanit", sans-serif; }
    </style>
  </head>
  <body>${html}</body>
</html>`);
  preview.document.close();

  preview.onload = () => {
    preview.focus();
    preview.print();
  };
}
