export type TimelineRowColorState = { done: boolean; rejected?: boolean };

type RowColor = { solid: string; soft: string };

// สีต้องเขียนเป็น class literal เต็ม ๆ (Tailwind JIT scan จาก source)
// เรียงให้แถวที่อยู่ติดกันในกราฟมี hue ห่างกัน จะได้แยกออกด้วยตา
const ROW_COLORS: Record<string, RowColor> = {
  submitted: { solid: "bg-violet-500", soft: "bg-violet-200" },
  "sample-sent": { solid: "bg-orange-500", soft: "bg-orange-200" },
  assigned: { solid: "bg-rose-500", soft: "bg-rose-200" },
  "qc-analyzing": { solid: "bg-sky-500", soft: "bg-sky-200" },
  "lab-analyzing": { solid: "bg-amber-500", soft: "bg-amber-200" },
  "lab-approval": { solid: "bg-lime-600", soft: "bg-lime-200" },
  "pre-result": { solid: "bg-cyan-500", soft: "bg-cyan-200" },
  final: { solid: "bg-emerald-500", soft: "bg-emerald-200" },
};

const FALLBACK: RowColor = { solid: "bg-grey-400", soft: "bg-grey-200" };
const PENDING_DOT = "bg-grey-300";
const REJECTED_SOLID = "bg-red-500";

function rowColor(rowKey: string, state: TimelineRowColorState): RowColor {
  // คำร้องที่ถูกส่งกลับแก้ไข ปิดงานด้วยสีแดง — แถว final เปลี่ยน label เป็น "ส่งกลับแก้ไข" ด้วย
  if (rowKey === "final" && state.rejected) return { solid: REJECTED_SOLID, soft: REJECTED_SOLID };
  return ROW_COLORS[rowKey] ?? FALLBACK;
}

export function timelineDotClass(rowKey: string, state: TimelineRowColorState): string {
  return state.done ? rowColor(rowKey, state).solid : PENDING_DOT;
}

export function timelineBarClass(rowKey: string, state: TimelineRowColorState): string {
  const color = rowColor(rowKey, state);
  return state.done ? color.solid : color.soft;
}
