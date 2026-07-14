export type CrosshairPoint = { percent: number; at: Date };

// แปลงตำแหน่งเมาส์บน "ราง" (แถบ tick ของแท็บที่กำลังดู) เป็นเวลาบนแกน
// นอกรางคืน null ไม่หนีบขอบ — ฝั่งซ้ายของรางคือคอลัมน์ชื่อด่าน ค่าที่ได้จะไม่มีความหมาย
export function crosshairAt(
  clientX: number,
  trackRect: { left: number; width: number },
  startAt: string,
  endAt: string,
): CrosshairPoint | null {
  if (!(trackRect.width > 0)) return null;

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const offset = clientX - trackRect.left;
  if (offset < 0 || offset > trackRect.width) return null;

  const ratio = offset / trackRect.width;
  return { percent: ratio * 100, at: new Date(start + ratio * (end - start)) };
}

export function formatCrosshairTime(at: Date): string {
  const day = at.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const hour = String(at.getHours()).padStart(2, "0");
  const minute = String(at.getMinutes()).padStart(2, "0");
  return `${day} ${hour}:${minute}`;
}
