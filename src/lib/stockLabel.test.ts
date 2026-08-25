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
  it("renders chemical bottle labels as the F-CHM form", async () => {
    const html = await buildSolventLabelHtml({
      name: "Methanol",
      idForQr: "sol_123",
      lotNo: "B-001",
      receivedDate: "2026-08-19",
      openedDate: "2026-08-20",
      exp: "2027-01-01",
      bottleNo: 2,
    });

    expect(html).toContain("สารเคมี");
    expect(html).toContain("ชื่อสามัญ");
    expect(html).toContain("Methanol");
    expect(html).toContain("แบชนัมเบอร์");
    expect(html).toContain("B-001");
    expect(html).toContain("วัน เดือน ปี ที่รับ");
    expect(html).toContain("วัน เดือน ปี ที่เปิดใช้");
    expect(html).toContain("วัน เดือน ปี ที่หมดอายุ");
    expect(html).toContain("ขวดที่");
    expect(html).toContain("2");
    expect(html).toContain("F-CHM-01-03 Rev 00 : 12/09/67");
    expect(html).toContain("data:image/png;base64");
    expect(html).toContain("เบิกสารเคมี");
    expect(html).toContain('alt="qr"');
  });

  it("escape HTML ในชื่อ", async () => {
    const html = await buildSolventLabelHtml({ name: "<script>x" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>x");
  });

  it("ไม่มี exp → แสดง '-'", async () => {
    const html = await buildSolventLabelHtml({ name: "Acetone" });
    expect(html).toContain("วัน เดือน ปี ที่หมดอายุ");
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

  it("renders standard labels as the reference standard bottle label", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_f9fe87904b1d",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "supplier",
      lotNo: "L1",
      purity: "99.5",
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("REFERENCE STANDARD");
    expect(html).toContain("Name");
    expect(html).toContain("% Purity");
    expect(html).toContain("99.5%");
    expect(html).toContain("Batch/Lot");
    expect(html).toContain("Exp date");
    expect(html).toContain("LB-TE-CH-002-001-R00 (07/02/67)");
    expect(html.indexOf("Name")).toBeLessThan(html.indexOf("% Purity"));
    expect(html.indexOf("% Purity")).toBeLessThan(html.indexOf("Batch/Lot"));
    expect(html.indexOf("Batch/Lot")).toBeLessThan(html.indexOf("Exp date"));
    expect(html).not.toContain("u_f9fe87904b1d");
    expect(html).toContain("data:image/png;base64");
    expect(html).toContain('alt="qr"');
    expect(html).not.toContain("Code:");
    expect(html).not.toContain("SEALED");
    expect(html).not.toContain("STD:");
    expect(html).not.toContain("ประเภท:");
  });

  it("renders batch lot without the bottle number", async () => {
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

    expect(html).toContain("L1");
    expect(html).not.toContain("ขวดที่ 1");
    expect(html).not.toContain("ขวดที่ 1/3");
  });

  it("renders the standard label as a bordered form", async () => {
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

    expect(html).toContain("border:0.35mm solid #000");
    expect(html).toContain("grid-template-columns:18mm 1fr");
    expect(html).toContain("width:17mm;height:17mm");
    expect(html).toContain('alt="qr"');
    expect(html).toContain("grid-template-rows");
    expect(html).toContain("font-size:6.4pt");
    expect(html).toContain("font-size:6.2pt;font-weight:400");
    expect(html).not.toContain("font-size:6.2pt;font-weight:600");
  });

  it("uses a clearer font for standard label digits", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      kind: "sealed",
      type: "primary",
      lotNo: "30822659",
      exp: "2027-09-08",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("30822659");
    expect(html).toContain("font-family:Verdana,'Segoe UI',Arial,'Kanit',Tahoma,sans-serif");
  });

  it("renders the annual receive run under the QR code", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "2,4-D dimethyl amonium",
      kind: "sealed",
      type: "primary",
      lotNo: "G1237356",
      purity: "99.72",
      labelRunNo: 1,
      labelRunYear: 2026,
      exp: "2028-05-28",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html).toContain("2,4-D dimethyl amonium");
    expect(html).not.toContain("2,4-D dimethyl amonium (01/2026)");
    expect(html.indexOf('alt="qr"')).toBeLessThan(html.indexOf("01/2026"));
    expect(html.indexOf("01/2026")).toBeLessThan(html.indexOf("REFERENCE STANDARD"));
  });

  it("renders the user-entered standard Code under the QR code", async () => {
    const html = await buildStockLabelHtml({
      _id: "unit-1",
      qrId: "u_abc123",
      itemCode: "01",
      itemName: "2,4-D Acid",
      kind: "sealed",
      type: "primary",
      lotNo: "G1237356",
      purity: "99.72",
      labelCode: "016901",
      labelRunNo: 1,
      labelRunYear: 2026,
      exp: "2028-05-28",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "active",
    } as StockUnitItem);

    expect(html.indexOf('alt="qr"')).toBeLessThan(html.indexOf("016901"));
    expect(html.indexOf("016901")).toBeLessThan(html.indexOf("REFERENCE STANDARD"));
    expect(html).not.toContain("01/2026");
  });

  it("renders solvent labels at 65mm x 25mm", async () => {
    const html = await buildSolventLabelHtml({ name: "Methanol", idForQr: "sol_123" });

    expect(html).toContain("width:65mm");
    expect(html).toContain("height:25mm");
    expect(html).not.toContain("width:152mm");
    expect(html).not.toContain("height:101mm");
  });
});
