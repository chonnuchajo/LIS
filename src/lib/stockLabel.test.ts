import { describe, it, expect } from "vitest";
import { buildSolventLabelHtml } from "./stockLabel";

describe("buildSolventLabelHtml", () => {
  it("ใส่ชื่อ/lot/ขนาด และฝัง QR เป็น data URL", async () => {
    const html = await buildSolventLabelHtml({
      name: "Methanol",
      idForQr: "sol_123",
      lotNo: "L1",
      exp: "2027-01-01",
      sizeLabel: "2.5 L",
    });
    expect(html).toContain("Methanol");
    expect(html).toContain("L1");
    expect(html).toContain("2.5 L");
    expect(html).toContain("data:image/png;base64");
  });

  it("escape HTML ในชื่อ", async () => {
    const html = await buildSolventLabelHtml({ name: "<script>x", idForQr: "x" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>x");
  });

  it("ไม่มี exp → แสดง '-'", async () => {
    const html = await buildSolventLabelHtml({ name: "Acetone", idForQr: "a" });
    expect(html).toContain("EXP");
    expect(html).toContain("-");
  });
});
