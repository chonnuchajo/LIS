// ตรรกะเบิก Standard: จำนวนน้ำหนัก default ตามเครื่อง + รวม/ตรวจ mg รายน้ำหนัก.

/** payload `_user` แนบไปกับ deduct-mg ให้ backend ลง ผู้ดำเนินการ (userMeta อ่าน body._user) */
export function requisitionUser(
  user?: { email?: string; name?: string } | null,
): { email?: string; name?: string } | undefined {
  return user ? { email: user.email, name: user.name } : undefined;
}

/** default จำนวนน้ำหนัก: GC = 3, อื่นๆ (HPLC ฯลฯ) = 1 */
export function defaultWeightCount(group?: string): number {
  return group === "gc" ? 3 : 1;
}

/** ผลรวม mg — ข้ามค่าที่ไม่ใช่ตัวเลข */
export function sumWeights(weights: number[]): number {
  return weights.reduce((s, w) => (Number.isFinite(w) ? s + w : s), 0);
}

/** "" = ผ่าน; ไม่งั้นข้อความ error ภาษาไทย */
export function validateWeights(weights: number[], remainingMg: number): string {
  if (weights.length === 0 || weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    return "กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0";
  }
  if (sumWeights(weights) > remainingMg) return "mg รวมเกินปริมาณคงเหลือของขวด";
  return "";
}
