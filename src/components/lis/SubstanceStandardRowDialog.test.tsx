import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SubstanceStandard } from "@/lib/api";
import { SubstanceStandardRowDialog } from "./SubstanceStandardRowDialog";

type EditableSubstanceStandard = SubstanceStandard & { headOnly?: boolean };

const baseSubstance: EditableSubstanceStandard = {
  substance: "ABAMECTIN 1.8% W/V EC",
  operator: "gte",
  value: 95,
  value2: null,
  productTypes: ["water"],
  categories: ["RM"],
} as EditableSubstanceStandard;

function renderDialog(substance: EditableSubstanceStandard = baseSubstance) {
  const onSave = vi.fn<(next: EditableSubstanceStandard) => void>();
  const onClose = vi.fn();
  render(
    <SubstanceStandardRowDialog
      open
      substance={substance}
      parameterName="ปริมาณสารสำคัญ"
      fieldLabel="Active"
      unit="%"
      onClose={onClose}
      onSave={onSave}
    />,
  );
  return { onSave, onClose };
}

describe("SubstanceStandardRowDialog", () => {
  it("renders the substance name, context line, and prefilled criteria", () => {
    renderDialog();

    expect(screen.getByText("ABAMECTIN 1.8% W/V EC")).toBeInTheDocument();
    expect(screen.getByText("ปริมาณสารสำคัญ · Active")).toBeInTheDocument();
    expect(screen.getByLabelText("เงื่อนไข")).toHaveValue("gte");
    expect(screen.getByLabelText("ค่า")).toHaveValue(95);
    expect(screen.queryByLabelText("ถึง")).not.toBeInTheDocument();
  });

  it("shows both value inputs for a between rule and keeps them after switching to tolerance", () => {
    renderDialog({ ...baseSubstance, operator: "between", value: 78, value2: 82 });

    expect(screen.getByLabelText("ตั้งแต่")).toHaveValue(78);
    expect(screen.getByLabelText("ถึง")).toHaveValue(82);

    fireEvent.change(screen.getByLabelText("เงื่อนไข"), { target: { value: "tolerance" } });

    expect(screen.getByLabelText("ค่ามาตรฐาน")).toHaveValue(78);
    expect(screen.getByLabelText("+/- %")).toHaveValue(82);
  });

  it("saves the edited rule, preserving untouched properties, then closes", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.change(screen.getByLabelText("ค่า"), { target: { value: "97" } });
    fireEvent.click(screen.getByLabelText("ให้หัวหน้า QC พิจารณาเท่านั้น"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      ...baseSubstance,
      operator: "gte",
      value: 97,
      value2: null,
      headOnly: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
