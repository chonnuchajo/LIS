import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTryHarderQrReader, decodeQrCanvasWithTryHarder } from "./qrTryHarderDecoder";
import * as ZXing from "html5-qrcode/third_party/zxing-js.umd";

const zxingState = vi.hoisted(() => ({
  decode: vi.fn(),
  reset: vi.fn(),
  constructorCalls: [] as unknown[][],
  binaryBitmaps: [] as unknown[],
}));

vi.mock("html5-qrcode/third_party/zxing-js.umd", () => {
  class MultiFormatReader {
    constructor(...args: unknown[]) {
      zxingState.constructorCalls.push(args);
    }

    decode(bitmap: unknown) {
      zxingState.binaryBitmaps.push(bitmap);
      return zxingState.decode(bitmap);
    }

    reset() {
      zxingState.reset();
    }
  }

  class HTMLCanvasElementLuminanceSource {
    constructor(public canvas: HTMLCanvasElement) {}
  }

  class HybridBinarizer {
    constructor(public source: unknown) {}
  }

  class GlobalHistogramBinarizer {
    constructor(public source: unknown) {}
  }

  class BinaryBitmap {
    constructor(public binarizer: unknown) {}
  }

  return {
    BarcodeFormat: { QR_CODE: "QR_CODE" },
    DecodeHintType: { POSSIBLE_FORMATS: "POSSIBLE_FORMATS", TRY_HARDER: "TRY_HARDER" },
    MultiFormatReader,
    HTMLCanvasElementLuminanceSource,
    HybridBinarizer,
    GlobalHistogramBinarizer,
    BinaryBitmap,
  };
});

describe("qrTryHarderDecoder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zxingState.constructorCalls = [];
    zxingState.binaryBitmaps = [];
  });

  it("creates a QR-only ZXing reader with TRY_HARDER enabled", () => {
    createTryHarderQrReader();

    const hints = zxingState.constructorCalls[0][1] as Map<unknown, unknown>;
    expect(hints.get(ZXing.DecodeHintType.POSSIBLE_FORMATS)).toEqual([ZXing.BarcodeFormat.QR_CODE]);
    expect(hints.get(ZXing.DecodeHintType.TRY_HARDER)).toBe(true);
  });

  it("falls back to global histogram binarizer when hybrid binarizer misses", () => {
    zxingState.decode
      .mockImplementationOnce(() => {
        throw new Error("not found");
      })
      .mockReturnValueOnce({ text: " https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan " });

    const canvas = document.createElement("canvas");

    expect(decodeQrCanvasWithTryHarder(canvas)).toBe("https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan");
    expect(zxingState.decode).toHaveBeenCalledTimes(2);
    expect(zxingState.reset).toHaveBeenCalledTimes(2);
  });
});
