// ย่อเนื้อหาให้พอดีกรอบกระดาษ/ฉลากที่ความสูงตายตัว (A4, sticker 100x50mm)
// กรอบพวกนี้ overflow:hidden — ถ้าเนื้อหาล้น ท่อนท้าย (ลายเซ็น, footer) จะหายไปเงียบๆ
export const DEFAULT_MIN_FIT_SCALE = 0.5;

// เนื้อหาถูก layout ที่ความกว้าง 1/scale ของกรอบ ก่อนจะ scale ลงมา — ยิ่งย่อ กล่องยิ่งกว้าง
// ข้อความยิ่งตัดบรรทัดน้อยลง ความสูงจึงไม่ได้ลดเป็นเส้นตรงตาม scale วัดรอบเดียวแล้วหารจะย่อเกินจำเป็น
// เลย binary search หา scale ที่ใหญ่ที่สุดที่ยังพอดีกรอบ โดยวัดความสูงจริงที่แต่ละ scale
export function solveFitScale({
  boxHeight,
  measureHeight,
  minScale = DEFAULT_MIN_FIT_SCALE,
  steps = 8,
}: {
  boxHeight: number;
  measureHeight: (scale: number) => number;
  minScale?: number;
  steps?: number;
}): number {
  if (!Number.isFinite(boxHeight) || boxHeight <= 0) return 1;

  const fits = (scale: number) => {
    const contentHeight = measureHeight(scale);
    if (!Number.isFinite(contentHeight) || contentHeight <= 0) return true;
    return scale * contentHeight <= boxHeight;
  };

  if (fits(1)) return 1;
  if (!fits(minScale)) return minScale;

  let low = minScale;
  let high = 1;
  for (let step = 0; step < steps; step += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}
