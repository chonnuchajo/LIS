import { expect, it } from "vitest";
import { theoreticalFortified } from "./validationFortified";
it("ใช้ทฤษฎีทุกวันโดยคง Found",()=>{
 expect(theoreticalFortified('0.5\t0.5013\t0.4992')).toBe('0.5\t0.5\t0.4992');
 expect(theoreticalFortified('3\t1\t1.003\t1.0023',true)).toBe('3\t1\t1\t1.0023');
 expect(theoreticalFortified('0.1\t0.10026\t')).toBe('0.1\t0.1\t');
});
