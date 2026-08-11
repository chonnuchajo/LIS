import { describe, it, expect } from "vitest";
import { buildSolventLabelHtml, stockDeductionQrUrl } from "./stockLabel";

describe("stockDeductionQrUrl", () => {
  it("builds the production stock deduction URL with qrId", () => {
    expect(stockDeductionQrUrl("u_abc123")).toBe(
      "https://app-plant.icpladda.com/LIS/stock-deduction?qrId=u_abc123",
    );
  });

  it("URL-encodes qrId values", () => {
    expect(stockDeductionQrUrl("solvent 1/2")).toBe(
      "https://app-plant.icpladda.com/LIS/stock-deduction?qrId=solvent+1%2F2",
    );
  });
});

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
