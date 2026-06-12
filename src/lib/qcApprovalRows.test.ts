import { describe, it, expect } from "vitest";
import { buildApprovalGroups } from "./qcApprovalRows";
import type { ParameterItem } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";

const param = (over: Partial<ParameterItem> = {}): ParameterItem => ({
  _id: "p1",
  name: "density",
  scope: "qc",
  applyAll: true,
  valueFields: [
    { label: "ค่า", type: "number", standardOperator: "between", standardValue: 10, standardValue2: 20, unit: "g" },
  ],
  ...(over as ParameterItem),
});

const petition = (): Petition => ({
  _id: "pet1",
  petitionNo: "Q-001",
  status: "success",
  dept: "rm",
  items: [
    { seq: 1, sampleName: "ตัวอย่าง A", commonName: "density", sampleId: "S1", batchNo: "B1", testItems: "density" },
  ],
} as unknown as Petition);

const result = (value: unknown): QCTestResult => ({
  itemSeq: 1,
  parameterId: "p1",
  parameterName: "ความหนาแน่น",
  values: { ค่า: value },
} as unknown as QCTestResult);

describe("buildApprovalGroups", () => {
  it("จับคู่พารามิเตอร์ + เติมค่าที่บันทึก + เกณฑ์มาตรฐาน", () => {
    const groups = buildApprovalGroups(petition(), [param()], [result(15)], new Map());
    expect(groups).toHaveLength(1);
    const row = groups[0].params[0].rows[0];
    expect(row.value).toBe("15");
    expect(row.standardText).toBe("10 - 20 g");
    expect(row.abnormal).toBe(false);
  });

  it("ตั้งธง abnormal เมื่อค่าหลุดเกณฑ์", () => {
    const groups = buildApprovalGroups(petition(), [param()], [result(99)], new Map());
    expect(groups[0].params[0].rows[0].abnormal).toBe(true);
  });

  it("ค่าว่างเมื่อไม่มีผลบันทึก", () => {
    const groups = buildApprovalGroups(petition(), [param()], [], new Map());
    expect(groups[0].params[0].rows[0].value).toBe("");
  });

  it("ตั้ง unmatched เมื่อไม่มีพารามิเตอร์ตรง", () => {
    const groups = buildApprovalGroups(petition(), [], [result(15)], new Map());
    expect(groups[0].unmatched).toBe(true);
    expect(groups[0].params).toHaveLength(0);
  });
});
