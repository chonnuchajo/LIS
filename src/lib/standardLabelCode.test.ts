import { describe, expect, it } from "vitest";
import { standardLabelCodeFromSuffix, standardLabelCodeSuffix } from "./standardLabelCode";

describe("standardLabelCode", () => {
  it("keeps suffix digits even when they start with the same digits as the prefix", () => {
    expect(standardLabelCodeFromSuffix("67", "6")).toBe("676");
    expect(standardLabelCodeFromSuffix("67", "67")).toBe("6767");
    expect(standardLabelCodeFromSuffix("67", "6703")).toBe("676703");
    expect(standardLabelCodeSuffix("676703", "67")).toBe("6703");
  });

  it("still accepts pasting a full label Code into the suffix field", () => {
    expect(standardLabelCodeFromSuffix("67", "676703")).toBe("676703");
  });
});
