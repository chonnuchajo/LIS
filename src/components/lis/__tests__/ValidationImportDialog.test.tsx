import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ValidationImportDialog from "../ValidationImportDialog";

describe("ตรวจข้อมูลก่อนนำเข้า", () => {
  it("previews converted measurements and only replaces data on explicit apply", () => {
    const apply = vi.fn();
    render(<ValidationImportDialog label="Accuracy" columns={["Target (mg/mL)", "Found (mg/mL)"]} hasData onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "นำเข้า / แปลงหน่วย" }));
    fireEvent.change(screen.getByLabelText("ข้อมูลต้นฉบับที่จะนำเข้า"), { target: { value: "0.5,501.2" } });
    fireEvent.change(screen.getByLabelText("หน่วยต้นทาง Found (mg/mL)"), { target: { value: "µg/mL" } });
    expect(screen.getByRole("cell", { name: "0.5012" })).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "แทนที่ตารางด้วยข้อมูลที่ตรวจแล้ว" }));
    expect(apply).toHaveBeenCalledWith("0.5\t0.5012");
  });
  it("blocks partial imports and leaves existing data unchanged on cancel", () => {
    const apply = vi.fn();
    render(<ValidationImportDialog label="Linearity" columns={["Actual (mg/mL)", "Area"]} hasData onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "นำเข้า / แปลงหน่วย" }));
    fireEvent.change(screen.getByLabelText("ข้อมูลต้นฉบับที่จะนำเข้า"), { target: { value: "0.5,125\n1," } });
    expect(screen.getByRole("button", { name: "แทนที่ตารางด้วยข้อมูลที่ตรวจแล้ว" })).toBeDisabled();
    expect(screen.queryByLabelText("หน่วยต้นทาง Area")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(apply).not.toHaveBeenCalled();
  });
});
