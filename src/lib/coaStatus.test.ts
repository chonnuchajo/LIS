import { describe, expect, it } from "vitest";
import { allowedCoaActions, canPrintCoa, coaStatusLabel } from "./coaStatus";

describe("coaStatus", () => {
  it("labels statuses for COA Center", () => {
    expect(coaStatusLabel("pendingApproval")).toBe("รอ QC Head อนุมัติ");
    expect(coaStatusLabel("superseded")).toBe("ถูกแทนที่");
  });

  it("allows printing only for active approved document states", () => {
    expect(canPrintCoa("approved")).toBe(true);
    expect(canPrintCoa("printed")).toBe(true);
    expect(canPrintCoa("reissued")).toBe(true);
    expect(canPrintCoa("draft")).toBe(false);
    expect(canPrintCoa("pendingApproval")).toBe(false);
    expect(canPrintCoa("cancelled")).toBe(false);
  });

  it("shows QC Head approval actions only to QC Head", () => {
    expect(allowedCoaActions("pendingApproval", true)).toEqual(["approve", "reject"]);
    expect(allowedCoaActions("pendingApproval", false)).toEqual([]);
    expect(allowedCoaActions("draft", false)).toEqual(["save", "submit"]);
    expect(allowedCoaActions("printed", true)).toEqual(["print", "revise", "cancel"]);
  });
});
