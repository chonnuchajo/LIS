import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ValidationPreparation from "../ValidationPreparation";
import { defaultPreparationLevels, preparationTemplate } from "@/lib/validationPreparation";

function Fixture() {
  const [levels, setLevels] = useState([defaultPreparationLevels().find(level => level.purpose === "accuracy" && level.target === "0.5")!]);
  return <><ValidationPreparation analyte="QA" method="GC" stock={2.01159} stocks={[]} levels={levels} onChange={setLevels} /><output data-testid="template">{preparationTemplate("accuracy", levels, 2.01159, [], 2)}</output></>;
}
describe("หน่วยในแผนเตรียมสาร", () => {
  it("แปลงตัวเลขเมื่อเปลี่ยนหน่วยและไม่เปลี่ยน Actual ตาม Target", () => {
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText("หน่วย Target ระดับ 1"), { target: { value: "µg/mL" } });
    expect(screen.getByLabelText("target ระดับ 1")).toHaveValue(500);
    expect(screen.getByTestId("template").textContent).toContain("0.5\t0.5028975\t");
    fireEvent.change(screen.getByLabelText("target ระดับ 1"), { target: { value: "400" } });
    expect(screen.getByTestId("template").textContent).toContain("0.4\t0.5028975\t");
    fireEvent.change(screen.getByLabelText("หน่วย Target ระดับ 1"), { target: { value: "mg/mL" } });
    expect(screen.getByLabelText("target ระดับ 1")).toHaveValue(0.4);
  });
});


it("recalculates pipetting when switching stock and clears impossible dilution", () => {
  function StockFixture() {
    const [levels, setLevels] = useState([{...defaultPreparationLevels()[0], target:"0.5", aliquot:"250"}]);
    return <ValidationPreparation analyte="QA" method="GC" stock={2} stocks={[{id:"other",name:"Stock มาตรฐานชื่อยาวสำหรับทดสอบ",weight:"100",purity:"100",volume:"25",certificate:"",preparedOn:""},{id:"weak",name:"เจือจาง",weight:"1",purity:"100",volume:"25",certificate:"",preparedOn:""}]} levels={levels} onChange={setLevels} />;
  }
  render(<StockFixture />);
  fireEvent.change(screen.getByLabelText("Stock ระดับ 1"), {target:{value:"other"}});
  expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveValue(125);
  expect(screen.getAllByText("Stock มาตรฐานชื่อยาวสำหรับทดสอบ")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Stock ระดับ 1"), {target:{value:"weak"}});
  expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveValue(null);
});
