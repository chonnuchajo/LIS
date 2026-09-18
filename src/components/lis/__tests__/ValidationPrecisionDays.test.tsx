import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ValidationPrecisionDays from "../ValidationPrecisionDays";
it("วันที่ว่างมีช่องกรอกทันทีและเก็บ Area ของวันอื่นไว้", () => {
 const change=vi.fn();
 render(<ValidationPrecisionDays targets={[0.1,0.5,1]} value={'1\t0.1\t0.10026432\t0.1021\n3\t0.1\t0.10026432\t0.099'} onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'วันที่ 2',exact:true}));
 const found=screen.getByLabelText('Accuracy 0.1 ซ้ำ 1 Found');
 expect(found).toHaveValue('');
 expect(screen.getByLabelText('Accuracy 0.5 ซ้ำ 10 Found')).toHaveValue('');
 fireEvent.change(found,{target:{value:'0.101'}});
 expect(change.mock.calls[0][0]).toContain('2\t0.1\t0.10026432\t0.101');
 expect(change.mock.calls[0][0]).toContain('3\t0.1\t0.10026432\t0.099');
});
