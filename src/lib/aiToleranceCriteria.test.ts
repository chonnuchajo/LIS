import { describe, expect, it } from "vitest";
import { aiPercentFromCommonName, aiToleranceCriteriaForCommonName, isAiContentTestItem } from "./aiToleranceCriteria";

describe("AI tolerance criteria", () => {
  it("uses the number before % in the common name", () => {
    expect(aiPercentFromCommonName("Glyphosate 48% SL")).toBe("48");
    expect(aiToleranceCriteriaForCommonName("Glyphosate 48% SL")).toBe("48% ± 2.40");
  });

  it("uses formulation-specific tolerance rows when present", () => {
    expect(aiToleranceCriteriaForCommonName("Product 1% SG")).toBe("1% ± 0.25");
    expect(aiToleranceCriteriaForCommonName("Product 1% EC")).toBe("1% ± 0.15");
    expect(aiToleranceCriteriaForCommonName("Product 2% GR")).toBe("2% ± 0.50");
    expect(aiToleranceCriteriaForCommonName("Product 2% SL")).toBe("2% ± 0.30");
  });

  it("matches AI content test item labels", () => {
    expect(isAiContentTestItem("%AI content (W/W)")).toBe(true);
    expect(isAiContentTestItem("Density at 30°C")).toBe(false);
  });
});
