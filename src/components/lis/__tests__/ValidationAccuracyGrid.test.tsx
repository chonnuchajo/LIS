import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ValidationAccuracyGrid from "../ValidationAccuracyGrid";
it("แยกความเข้มข้นและแก้ Found โดยคงค่าละเอียดและระดับอื่น", () => {
 const change = vi.fn();
 render(<ValidationAccuracyGrid targets={[0.1,0.5,1]} value={'0.1\t0.10026432\t0.1021\n0.5\t0.5013216\t0.4992'} onChange={change}/>);
 expect(screen.getByText('ต่ำ (Low) · 0.100 mg/mL')).toBeTruthy();
 expect(screen.getByText('กลาง (Mid) · 0.500 mg/mL')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Accuracy 0.1 ซ้ำ 1 Found'), {target:{value:'0.101'}});
 expect(change).toHaveBeenCalledWith('0.1\t0.10026432\t0.101\n0.5\t0.5013216\t0.4992');
});
