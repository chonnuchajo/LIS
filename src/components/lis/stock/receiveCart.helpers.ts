export type CartCategory = "standard" | "solvent" | "glassware";

export interface CartRow {
  id: string;
  category: CartCategory | null;
  itemId: string;
  itemName: string;
  itemCode: string; // standard code; "" สำหรับ solvent/glassware
  // standard
  source: "primary" | "supply";
  sizeMl: string;
  count: string;
  sameExp: boolean;
  commonExp: string;
  perExp: string[];
  // solvent
  qty: string;
  sizeLabel: string;
  exp: string;
  // shared
  lotNo: string;
  note: string;
}

let rowSeq = 0;
export function makeEmptyRow(): CartRow {
  rowSeq += 1;
  return {
    id: `row_${rowSeq}`,
    category: null,
    itemId: "",
    itemName: "",
    itemCode: "",
    source: "primary",
    sizeMl: "100",
    count: "1",
    sameExp: true,
    commonExp: "",
    perExp: [""],
    qty: "1",
    sizeLabel: "",
    exp: "",
    lotNo: "",
    note: "",
  };
}

/** คืน error string ถ้าไม่ผ่าน, null ถ้าผ่าน */
export function validateRow(row: CartRow): string | null {
  if (!row.category || !row.itemId) return "ยังไม่ได้เลือกของ";
  if (row.category === "standard") {
    if (!(Number(row.sizeMl) > 0)) return "ขนาด/ขวดไม่ถูกต้อง";
    const c = Number(row.count);
    if (!Number.isInteger(c) || c < 1) return "จำนวนขวดต้องเป็นจำนวนเต็มบวก";
    if (row.source !== "primary" && row.source !== "supply") return "ต้องเลือกที่มา";
    return null;
  }
  const q = Number(row.qty);
  if (!Number.isInteger(q) || q < 1) return "จำนวนต้องเป็นจำนวนเต็มบวก";
  return null;
}

export function buildBottles(row: CartRow): { exp?: string }[] {
  const n = Math.max(1, Number(row.count) || 1);
  if (row.sameExp) {
    return Array.from({ length: n }, () => ({ exp: row.commonExp || undefined }));
  }
  return row.perExp.slice(0, n).map((e) => ({ exp: e || undefined }));
}

export function composeSolventNote(row: CartRow): string {
  const parts: string[] = [];
  if (row.lotNo) parts.push(`lot ${row.lotNo}`);
  if (row.exp) parts.push(`exp ${row.exp}`);
  if (row.sizeLabel) parts.push(`ขนาด ${row.sizeLabel}`);
  if (row.note) parts.push(row.note);
  return parts.join(" · ");
}
