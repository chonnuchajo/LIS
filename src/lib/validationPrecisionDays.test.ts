import { expect, it } from "vitest";
import { precisionWithAccuracyDayOne } from "./validationPrecisionDays";
it("ใช้ Accuracy เป็นวันที่หนึ่งเพียงชุดเดียวและคงวันที่สองถึงหก",()=>{
 const other=[2,3,4,5,6].map(d=>`${d}\t0.1\t0.10026432\t0.101`).join("\n");
 const result=precisionWithAccuracyDayOne(`1\t0.1\t0.1\t99\n${other}`,"0.1,0.10026432,0.1021");
 expect(result).toBe(`1\t0.1\t0.10026432\t0.1021\n${other}`);
 expect(precisionWithAccuracyDayOne(result,"0.1\t0.10026432\t0.099")).toBe(`1\t0.1\t0.10026432\t0.099\n${other}`);
 expect(precisionWithAccuracyDayOne(result,"")).toBe(other);
});
