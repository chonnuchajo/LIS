import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EquipmentCheckReport, {
  type EquipmentCheckReportFilters,
} from "./EquipmentCheckReport";
import type { EquipmentCheckRecord } from "@/lib/api";

const rec = (over: Partial<EquipmentCheckRecord> = {}): EquipmentCheckRecord => ({
  _id: "id-" + (over._id ?? "x"),
  roomSlug: "balance",
  instrumentId: "BAL-01",
  instrumentName: "เครื่องชั่ง",
  status: "normal",
  readings: [],
  recorder: "สมชาย",
  date: "2026-07-02",
  checkedAt: "2026-07-02T03:00:00.000Z",
  ...over,
});

const filters: EquipmentCheckReportFilters = {
  date: "2026-07-02", room: "all", instrument: "all", status: "all",
};

describe("EquipmentCheckReport", () => {
  it("shows title and printed-by", () => {
    render(<EquipmentCheckReport rows={[rec()]} filters={filters} printedBy="อลิส" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText("บันทึกการเช็กเครื่องมือประจำวัน")).toBeInTheDocument();
    expect(screen.getByText(/ผู้พิมพ์: อลิส/)).toBeInTheDocument();
  });

  it("summarizes total and abnormal counts", () => {
    const rows = [rec({ _id: "a" }), rec({ _id: "b", status: "abnormal" })];
    render(<EquipmentCheckReport rows={rows} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText(/รวม\s*2\s*รายการ/)).toBeInTheDocument();
    expect(screen.getByText(/ผิดปกติ\s*1\s*รายการ/)).toBeInTheDocument();
  });

  it("joins readings, em dash when none", () => {
    const rows = [
      rec({ _id: "a", readings: [{ key: "temp", label: "อุณหภูมิ", value: 25, unit: "°C" }] }),
      rec({ _id: "b", readings: [] }),
    ];
    render(<EquipmentCheckReport rows={rows} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText("อุณหภูมิ 25 °C")).toBeInTheDocument();
  });

  it("translates filter context to Thai", () => {
    render(<EquipmentCheckReport rows={[rec()]} filters={filters} printedBy="x" printedAt="2026-07-02T04:00:00.000Z" />);
    expect(screen.getByText(/ห้อง: ทุกห้อง/)).toBeInTheDocument();
    expect(screen.getByText(/สถานะ: ทั้งหมด/)).toBeInTheDocument();
  });
});
