import * as ZXing from "html5-qrcode/third_party/zxing-js.umd";

export interface TryHarderQrReader {
  decode: (binaryBitmap: unknown) => { text?: string | null };
  reset?: () => void;
}

type BinarizerCtor = new (source: unknown) => unknown;

export function createTryHarderQrReader(): TryHarderQrReader {
  const hints = new Map<unknown, unknown>();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  return new ZXing.MultiFormatReader(false, hints);
}

function decodeWithBinarizer(canvas: HTMLCanvasElement, reader: TryHarderQrReader, Binarizer: BinarizerCtor): string {
  const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
  const bitmap = new ZXing.BinaryBitmap(new Binarizer(source));
  const result = reader.decode(bitmap);
  return typeof result?.text === "string" ? result.text.trim() : "";
}

export function decodeQrCanvasWithTryHarder(canvas: HTMLCanvasElement, reader = createTryHarderQrReader()): string {
  const binarizers = [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer] as BinarizerCtor[];

  for (const Binarizer of binarizers) {
    try {
      const text = decodeWithBinarizer(canvas, reader, Binarizer);
      if (text) return text;
    } catch {
      continue;
    } finally {
      reader.reset?.();
    }
  }

  return "";
}
