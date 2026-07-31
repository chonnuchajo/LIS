import { describe, expect, it } from "vitest";

import { getClassification, getCommonName } from "./productClassification";

describe("productClassification", () => {
  it("treats SG as a sand formulation common name", () => {
    expect(getClassification("SG")?.group).toBe("sand");
    expect(getCommonName("SG")).toBe("SG");
  });

  it("normalizes SAND GRANULE to SG", () => {
    const value = "BROMADIOLONE 0.005% W/W SAND GRANULE";

    expect(getClassification(value)?.code).toBe("SG");
    expect(getClassification(value)?.group).toBe("sand");
    expect(getCommonName(value)).toBe("SG");
  });
});
