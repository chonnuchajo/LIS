import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ValidationDataGrid from "../ValidationDataGrid";
import { parseMeasurements } from "@/lib/validationCalculator";

function Fixture({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <><ValidationDataGrid label="ผลวัด" columns={["RT", "Area"]} value={value} onChange={setValue} /><output data-testid="raw">{value}</output><output data-testid="errors">{parseMeasurements(value, 2).errors.length}</output></>;
}

describe("ValidationDataGrid", () => {
  it("keeps a new incomplete row invalid until every cell is entered", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มแถว" }));
    expect(screen.getByTestId("errors").textContent).toBe("1");
    fireEvent.change(screen.getByLabelText("ผลวัด แถว 1 RT"), { target: { value: "4.437" } });
    expect(screen.getByTestId("errors").textContent).toBe("1");
    fireEvent.change(screen.getByLabelText("ผลวัด แถว 1 Area"), { target: { value: "248.883" } });
    expect(screen.getByTestId("errors").textContent).toBe("0");
    expect(screen.getByTestId("raw").textContent).toBe("4.437\t248.883");
  });
  it("preserves extra cells and invalid imported text when editing another cell", () => {
    render(<Fixture initial={"4.4,invalid,extra\n4.5,250"} />);
    fireEvent.change(screen.getByLabelText("ผลวัด แถว 2 RT"), { target: { value: "4.6" } });
    expect(screen.getByTestId("raw").textContent).toBe("4.4\tinvalid\textra\n4.6\t250");
    expect(screen.getByTestId("errors").textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "วางข้อมูล / ดูข้อความ" }));
    expect((screen.getByLabelText("ผลวัด", { selector: "textarea" }) as HTMLTextAreaElement).value).toContain("extra");
  });
  it("deletes only the selected row", () => {
    render(<Fixture initial={"4.4,248\n4.5,249\n4.6,250"} />);
    fireEvent.click(screen.getByRole("button", { name: "ลบ ผลวัด แถว 2" }));
    expect(screen.getByTestId("raw").textContent).toBe("4.4\t248\n4.6\t250");
  });
  it("keeps derived measurements read-only in both table and text modes", () => {
    render(<ValidationDataGrid label="ผลคำนวณ" columns={["Actual", "Found"]} value="0.5\t0.5012" onChange={() => { throw new Error("derived data must not be edited"); }} readOnly />);
    expect((screen.getByLabelText("ผลคำนวณ แถว 1 Actual") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByRole("button", { name: "เพิ่มแถว" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "วางข้อมูล / ดูข้อความ" }));
    expect((screen.getByLabelText("ผลคำนวณ", { selector: "textarea" }) as HTMLTextAreaElement).readOnly).toBe(true);
  });
});
