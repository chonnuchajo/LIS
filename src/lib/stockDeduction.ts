// แสดงจำนวนที่ตัดของ StockTransaction แถว deduct — solvent/glassware/ขวด standard
// เก็บใน delta ส่วนเบิก mg รายน้ำหนัก (deduct-mg) เก็บใน volumeDelta + weights.

export interface DeductionAmountInput {
  delta?: number | null;
  volumeDelta?: number | null;
  unit?: string;
  weights?: number[];
}

export interface DeductionAmount {
  text: string;
  /** แจกแจงรายน้ำหนัก เช่น "15 + 15 + 15" — มีเฉพาะเมื่อชั่งมากกว่า 1 ครั้ง */
  sub?: string;
}

export function deductionAmount(t: DeductionAmountInput): DeductionAmount {
  const amount = t.delta ?? t.volumeDelta;
  if (amount == null) return { text: "-" };
  const text = `${Math.abs(amount)}${t.unit ? ` ${t.unit}` : ""}`;
  if (t.weights && t.weights.length > 1) return { text, sub: t.weights.join(" + ") };
  return { text };
}
