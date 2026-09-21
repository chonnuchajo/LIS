import logoUrl from "@/assets/validation-report-logo.png";

// Resolve through Vite's base path, then embed for offline HTML and PDF rendering.
export async function validationReportLogo(): Promise<string> {
  const response = await fetch(logoUrl);
  if (!response.ok) throw new Error("โหลดโลโก้รายงานไม่ได้ กรุณาลองอีกครั้ง");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านโลโก้รายงานไม่ได้"));
    reader.readAsDataURL(blob);
  });
}
