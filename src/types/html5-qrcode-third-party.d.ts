declare module "html5-qrcode/third_party/zxing-js.umd" {
  export const BarcodeFormat: Record<string, unknown>;
  export const DecodeHintType: Record<string, unknown>;

  export class MultiFormatReader {
    constructor(verbose?: boolean, hints?: Map<unknown, unknown>);
    decode(binaryBitmap: unknown): { text?: string | null };
    reset(): void;
  }

  export class HTMLCanvasElementLuminanceSource {
    constructor(canvas: HTMLCanvasElement);
  }

  export class HybridBinarizer {
    constructor(source: unknown);
  }

  export class GlobalHistogramBinarizer {
    constructor(source: unknown);
  }

  export class BinaryBitmap {
    constructor(binarizer: unknown);
  }
}
