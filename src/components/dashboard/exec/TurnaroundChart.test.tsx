import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TurnaroundChart from "./TurnaroundChart";

describe("TurnaroundChart", () => {
  it("uses status wording in the executive turnaround title", () => {
    render(<TurnaroundChart rows={[]} />);
    expect(screen.getByText("เวลาที่ใช้ต่อสถานะ (ชั่วโมง)")).toBeInTheDocument();
  });
});
