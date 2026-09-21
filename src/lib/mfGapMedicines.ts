import { addMfDateFields, type MfItemRow } from "./mfItemDates";

const MEDICINE_ITEM_NO_PATTERN = /^[RF]/i;
const MF_GAP_THRESHOLD_DAYS = 30;

const itemNoKeys = ["item_no", "itemNo", "item_code", "itemCode", "code", "item_id", "itemId"] as const;
const itemNameKeys = ["item_name1", "itemName", "item_name", "name", "Name", "description"] as const;
const commonNameKeys = ["common_name", "commonname", "commonName", "item_name2", "itemType"] as const;
const categoryKeys = ["inventory_posting_group", "category", "type", "group", "itemGroup", "item_group"] as const;

export type MfGapMedicineRow = {
  itemNo: string;
  itemName: string;
  commonName: string;
  category: string;
  mfBefore: string;
  mfLasted: string;
  mfGapDays: number;
};

function rowsFromPayload(payload: unknown): MfItemRow[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "items", "result", "rows", "value"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is MfItemRow {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickText(row: MfItemRow, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function isMedicineItemNo(itemNo: string): boolean {
  return MEDICINE_ITEM_NO_PATTERN.test(itemNo.trim());
}

export function buildMfGapMedicineRows(
  masterPayload: unknown,
  historicalPayload: unknown,
  currentPayload: unknown,
): MfGapMedicineRow[] {
  return addMfDateFields(rowsFromPayload(masterPayload), historicalPayload, currentPayload)
    .map((row) => {
      const itemNo = pickText(row, itemNoKeys);
      const mfGapDays = Number(row.MF_GapDays);
      return {
        itemNo,
        itemName: pickText(row, itemNameKeys),
        commonName: pickText(row, commonNameKeys),
        category: pickText(row, categoryKeys),
        mfBefore: String(row.MF_Before ?? ""),
        mfLasted: String(row.MF_Lasted ?? ""),
        mfGapDays,
      };
    })
    .filter((row) => isMedicineItemNo(row.itemNo))
    .filter((row) => Number.isFinite(row.mfGapDays) && row.mfGapDays >= MF_GAP_THRESHOLD_DAYS)
    .sort((a, b) => {
      if (b.mfGapDays !== a.mfGapDays) return b.mfGapDays - a.mfGapDays;
      return a.itemNo.localeCompare(b.itemNo, undefined, { numeric: true });
    });
}
