import { describe, expect, it } from "vitest";
import { buildCoaRequestTrend, formatCoaTrendPercent } from "./coaTrend";
import type { CoaDocument } from "@/types/coa.types";

function coaDoc(overrides: Partial<CoaDocument>): CoaDocument {
  return {
    _id: "coa-1",
    revision: 0,
    status: "draft",
    petitionId: "petition-1",
    selectedItemSeqs: [1],
    sampleSnapshots: [],
    resultSnapshots: [],
    ...overrides,
  } as CoaDocument;
}

describe("COA request trend", () => {
  it("counts requested drugs and extracts label/result %AI", () => {
    const trend = buildCoaRequestTrend([
      coaDoc({
        _id: "coa-old",
        createdAt: "2026-08-01T08:00:00.000Z",
        sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade A", commonName: "BROMADIOLONE 0.005%" }],
        resultSnapshots: [{ itemSeq: 1, testItem: "%AI content (W/W)", result: "0.0051%" }],
      }),
      coaDoc({
        _id: "coa-new",
        createdAt: "2026-08-02T08:00:00.000Z",
        sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade B", commonName: "BROMADIOLONE 0.005%" }],
        resultSnapshots: [{ itemSeq: 1, testItem: "AI content", result: "0.0053%" }],
      }),
      coaDoc({
        _id: "coa-other",
        createdAt: "2026-08-03T08:00:00.000Z",
        sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade C", commonName: "GLYPHOSATE 48% SL" }],
        resultSnapshots: [{ itemSeq: 1, testItem: "%AI content (W/V)", result: "47.9%" }],
      }),
      coaDoc({
        _id: "coa-rejected",
        status: "rejected",
        sampleSnapshots: [{ itemSeq: 1, sampleName: "Rejected", commonName: "BROMADIOLONE 0.005%" }],
      }),
    ]);

    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({
      commonName: "BROMADIOLONE 0.005%",
      requestCount: 2,
      labelAiPercent: 0.005,
      latestAiResult: "0.0053%",
    });
    expect(trend[0].averageAiPercent).toBeCloseTo(0.0052);
    expect(trend[0].sharePercent).toBeCloseTo(66.666, 2);
    expect(trend[1]).toMatchObject({ commonName: "GLYPHOSATE 48% SL", requestCount: 1, labelAiPercent: 48 });
  });

  it("formats trend percentages for compact display", () => {
    expect(formatCoaTrendPercent(48)).toBe("48%");
    expect(formatCoaTrendPercent(0.0052, 4)).toBe("0.0052%");
    expect(formatCoaTrendPercent(null)).toBe("-");
  });

  it("uses stored trend snapshots when available", () => {
    const trend = buildCoaRequestTrend([
      coaDoc({
        _id: "coa-stored-trend",
        trendSnapshots: [{
          itemSeq: 1,
          commonName: "CYPERMETHRIN 10% EC",
          aiLabelPercent: 10,
          aiResultPercent: 9.8,
          aiResultText: "9.8%",
        }],
      }),
    ]);

    expect(trend[0]).toMatchObject({
      commonName: "CYPERMETHRIN 10% EC",
      requestCount: 1,
      labelAiPercent: 10,
      averageAiPercent: 9.8,
      latestAiResult: "9.8%",
    });
  });
});
