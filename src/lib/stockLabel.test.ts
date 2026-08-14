import { describe, it, expect } from "vitest";
import { buildSolventLabelHtml, buildStockLabelHtml, stockDeductionQrUrl } from "./stockLabel";
import type { StockUnitItem } from "@/types/stock";

describe("stock public QR URL", () => {
  it("builds the production public stock view URL with qrId", () => {
    expect(stockDeductionQrUrl("u_abc123")).toBe(
      "https://app-plant.icpladda.com/LIS/stock/view?qrId=u_abc123",
    );
  });

  it("URL-encodes qrId values", () => {
    expect(stockDeductionQrUrl("solvent 1/2")).toBe(
      "https://app-plant.icpladda.com/LIS/stock/view?qrId=solvent+1%2F2",
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

describe("stock label paper size", () => {
  it("renders standard labels at 65mm x 25mm", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "primary",
      lotNo: "L1",
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("width:65mm");
    expect(html).toContain("height:25mm");
    expect(html).not.toContain("width:152mm");
    expect(html).not.toContain("height:101mm");
  });

  it("renders standard labels without visible qr id or SEALED code line", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_f9fe87904b1d",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "supplier",
      lotNo: "L1",
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).not.toContain("u_f9fe87904b1d");
    expect(html).not.toContain("Code:");
    expect(html).not.toContain("SEALED");
    expect(html).toContain("STD: <b>STD-001</b>");
    expect(html).toContain("ประเภท: <b>supplier</b>");
  });

  it("renders the bottle number in its lot without the total count", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "primary",
      lotNo: "L1",
      lotBottleNo: 1,
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("ขวดที่ 1");
    expect(html).not.toContain("ขวดที่ 1/3");
  });

  it("uses more of the right side for larger readable standard text", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "primary",
      lotNo: "L1",
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("width:17mm;height:17mm");
    expect(html).toContain("font-size:8.2pt");
    expect(html).not.toContain("font-size:4.8pt");
  });

  it("renders solvent labels at 65mm x 25mm", async () => {
    const html = await buildSolventLabelHtml({ name: "Methanol", idForQr: "sol_123" });

    expect(html).toContain("width:65mm");
    expect(html).toContain("height:25mm");
    expect(html).not.toContain("width:152mm");
    expect(html).not.toContain("height:101mm");
  });
});
