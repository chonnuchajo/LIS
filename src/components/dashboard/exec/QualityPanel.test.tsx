import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QualityPanel from "./QualityPanel";

describe("QualityPanel", () => {
  it("shows abnormal and rework as whole-number percentages", () => {
    render(<QualityPanel quality={{ closed: 40, abnormal: 5, abnormalRate: 0.125, reworked: 2, reworkRate: 0.05 }} />);
    expect(screen.getByText("13%")).toBeInTheDocument(); // 12.5 ปัดเป็น 13
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("ปกติ · 35 จาก 40 คำขอ")).toBeInTheDocument();
  });

  it("says so plainly when nothing closed in the window", () => {
    render(<QualityPanel quality={{ closed: 0, abnormal: 0, abnormalRate: 0, reworked: 0, reworkRate: 0 }} />);
    expect(screen.getByText("ไม่มีข้อมูลในช่วงนี้")).toBeInTheDocument();
  });

  it("renders a genuine zero rate as 0%", () => {
    render(<QualityPanel quality={{ closed: 40, abnormal: 0, abnormalRate: 0, reworked: 0, reworkRate: 0 }} />);
    expect(screen.getAllByText("0%")).toHaveLength(2);
  });

  it("renders a tiny non-zero rate as <1% instead of rounding down to 0%", () => {
    render(<QualityPanel quality={{ closed: 1000, abnormal: 1, abnormalRate: 0.001, reworked: 0, reworkRate: 0 }} />);
    expect(screen.getByText("<1%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument(); // reworkRate is a genuine zero
  });
});
