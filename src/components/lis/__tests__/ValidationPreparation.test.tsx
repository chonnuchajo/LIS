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
  it("แปลงหน่วยและคำนวณปิเปตตาม Target แบบเรียลไทม์", () => {
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText("หน่วย Target ระดับ 1"), { target: { value: "µg/mL" } });
    expect(screen.getByLabelText("target ระดับ 1")).toHaveValue(500);
    expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveTextContent("248.6");
    fireEvent.change(screen.getByLabelText("target ระดับ 1"), { target: { value: "400" } });
    expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveTextContent("198.8");
    fireEvent.change(screen.getByLabelText("finalVolume ระดับ 1"), {target:{value:"2000"}});
    expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveTextContent("397.7");
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
  expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveTextContent("125.0");
  expect(screen.getAllByText("Stock มาตรฐานชื่อยาวสำหรับทดสอบ")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Stock ระดับ 1"), {target:{value:"weak"}});
  expect(screen.getByLabelText("aliquot ระดับ 1")).toHaveTextContent("—");
});

it("updates Matrix and Solvent when percent changes and final volume scales", () => {
 render(<Fixture />);
 fireEvent.click(screen.getByRole("checkbox", {name:"คำนวณ Matrix จาก %ยา ตามข้อ 6.5.2"}));
 expect(screen.getByLabelText("matrix ระดับ 1")).toHaveValue(4);
 fireEvent.change(screen.getByLabelText("%ยา", {exact:true}),{target:{value:"10"}});
 expect(screen.getByLabelText("matrix ระดับ 1")).toHaveValue(10);
 fireEvent.change(screen.getByLabelText("finalVolume ระดับ 1"),{target:{value:"2000"}});
 expect(screen.getByLabelText("matrix ระดับ 1")).toHaveValue(20);
 fireEvent.change(screen.getByLabelText("ฐาน %ยา"),{target:{value:"wv"}});
 expect(screen.getByLabelText("matrix ระดับ 1")).toHaveValue(null);
});
