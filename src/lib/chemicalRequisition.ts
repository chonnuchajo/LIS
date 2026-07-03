export interface ChemicalRequisition {
  _id: string;
  date: string;
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  itemType: "solvent";
  solventId: string;
  solventName: string;
  qty: number;
  unit: string;
  note: string;
  requestedBy: { email: string; name: string };
  createdAt?: string;
}

export const todayStr = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function groupRequisitionsByInstrument(
  reqs: ChemicalRequisition[],
): Record<string, ChemicalRequisition[]> {
  const map: Record<string, ChemicalRequisition[]> = {};
  for (const r of reqs) {
    if (!map[r.instrumentId]) map[r.instrumentId] = [];
    map[r.instrumentId].push(r);
  }
  return map;
}

/** "" = ok; otherwise a Thai error message. */
export function validateRequisitionQty(qty: number, remaining: number): string {
  if (!Number.isFinite(qty) || qty <= 0) return "กรุณาระบุจำนวน";
  if (qty > remaining) return "จำนวน stock ไม่พอ";
  return "";
}
