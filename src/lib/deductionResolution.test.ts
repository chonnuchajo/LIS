import {
  DEDUCTION_RESOLUTION_LABELS,
  isDeductionResolutionReady,
} from "./deductionResolution";

describe("deductionResolution", () => {
  it("labels the supported close-out reasons", () => {
    expect(DEDUCTION_RESOLUTION_LABELS.empty).toBe("หมด");
    expect(DEDUCTION_RESOLUTION_LABELS.ineffective).toBe("ไม่มีประสิทธิภาพ");
    expect(DEDUCTION_RESOLUTION_LABELS.other).toBe("อื่นๆ");
  });

  it("requires a note for ineffective and other reasons", () => {
    expect(isDeductionResolutionReady("empty", "")).toBe(true);
    expect(isDeductionResolutionReady("ineffective", "")).toBe(false);
    expect(isDeductionResolutionReady("ineffective", "สีเปลี่ยน")).toBe(true);
    expect(isDeductionResolutionReady("other", "")).toBe(false);
    expect(isDeductionResolutionReady("other", "แตก")).toBe(true);
  });
});
