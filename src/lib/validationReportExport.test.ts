import { afterEach, expect, it, vi } from "vitest";
import { exportValidationPdf } from "./validationReportExport";
afterEach(() => vi.unstubAllGlobals());
it("exports the displayed report through the app base path", async () => {
  const blob = { slice: () => ({ text: async () => "%PDF-" }) };
  const fetch = vi.fn().mockResolvedValue({ ok: true, headers: { get: () => "application/pdf" }, blob: async () => blob });
  vi.stubGlobal("fetch", fetch);
  expect(await exportValidationPdf("<main>QA</main>")).toBe(blob);
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/print\/pdf$/), expect.objectContaining({ body: JSON.stringify({ docType: "method-validation", html: "<main>QA</main>" }) }));
});
it("rejects HTML error pages and invalid PDF content", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, headers: { get: () => "text/html" } }); vi.stubGlobal("fetch", fetch);
  await expect(exportValidationPdf("QA")).rejects.toThrow("สร้าง PDF ไม่สำเร็จ");
  fetch.mockResolvedValue({ ok: true, headers: { get: () => "application/pdf" }, blob: async () => ({ slice: () => ({ text: async () => "error" }) }) });
  await expect(exportValidationPdf("QA")).rejects.toThrow("ไม่ใช่ PDF");
});
