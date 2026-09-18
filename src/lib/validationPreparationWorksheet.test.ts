import { expect, it } from "vitest";
import { preparationPlan, defaultPreparationLevels } from "./validationPreparation";
import { preparationWorksheet } from "./validationPreparationWorksheet";
it("plans without actual pipetting and subtracts matrix from solvent", () => {
 const row = { ...defaultPreparationLevels()[0], target: "0.5", finalVolume: "10000", aliquot: "", matrix: "4" };
 expect(preparationPlan(row, 2, [])).toEqual({stock:2,target:0.5,finalUl:10000,matrixUl:4,aliquotUl:2500,solventUl:7496});
 expect(preparationPlan({...row,target:"3"},2,[])).toBeNull();
 expect(preparationPlan({...row,stockId:"missing"},2,[])).toBeNull();
 expect(preparationPlan({...row,target:"500",targetUnit:"µg/mL"},2,[])?.aliquotUl).toBe(2500);
 const html=preparationWorksheet({analyte:"<script>alert(1)</script>",method:"QA"},[row],2,[]);
 expect(html).toContain("7,496"); expect(html).not.toContain("<script>"); expect(html).toContain("ปิเปตจริง");
});
