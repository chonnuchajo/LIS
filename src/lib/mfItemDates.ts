export type MfItemRow = Record<string, unknown>;

export interface MfItemDateFields {
  MF_Before: string | null;
  MF_Lasted: string | null;
}

export interface MfItemDateOptions {
  itemKeyFields?: string[];
  dateFields?: string[];
}

export const MF_HISTORICAL_API_URL = 'https://n8n-plant.icpladda.com/webhook/item-MF-CLOSE';
export const MF_CURRENT_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/item-MF';

export const MF_ITEM_KEY_FIELDS = [
  'item_id',
  'itemId',
  'item_no',
  'itemNo',
  'code',
  'itemCode',
] as const;

export const MF_CREATE_DATE_FIELDS = [
  'create_date',
  'createDate',
  'productionDate',
  'production_date',
  'mfg_date',
  'manufacture_date',
] as const;

function asRecord(value: unknown): MfItemRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as MfItemRow) : {};
}

export function rowsFromMfPayload(payload: unknown): MfItemRow[] {
  if (Array.isArray(payload)) return payload.map(asRecord);
  const obj = asRecord(payload);
  for (const key of ['value', 'data', 'items', 'rows', 'result']) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(asRecord);
  }
  return Object.keys(obj).length ? [obj] : [];
}

function pickString(row: MfItemRow, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

export function normalizeMfDate(value: unknown): string | null {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  return null;
}

export function appendMfDateNote(note: string, fields: MfItemDateFields): string {
  const mfNote = [
    `MF_Before: ${fields.MF_Before ?? '-'}`,
    `MF_Lasted: ${fields.MF_Lasted ?? '-'}`,
  ].join(' | ');
  return [note.trim(), mfNote].filter(Boolean).join(' | ');
}

export function getMfItemKey(row: MfItemRow, itemKeyFields: readonly string[] = MF_ITEM_KEY_FIELDS): string {
  return pickString(row, itemKeyFields);
}

function getRowDate(row: MfItemRow, dateFields: readonly string[]): string | null {
  for (const key of dateFields) {
    const date = normalizeMfDate(row[key]);
    if (date) return date;
  }
  return null;
}

function buildDateIndex(
  historicalRows: MfItemRow[],
  currentRows: MfItemRow[],
  options: MfItemDateOptions = {},
): Map<string, Set<string>> {
  const itemKeyFields = options.itemKeyFields ?? MF_ITEM_KEY_FIELDS;
  const dateFields = options.dateFields ?? MF_CREATE_DATE_FIELDS;
  const index = new Map<string, Set<string>>();

  for (const row of [...historicalRows, ...currentRows]) {
    const itemKey = getMfItemKey(row, itemKeyFields);
    if (!itemKey) continue;
    if (!index.has(itemKey)) index.set(itemKey, new Set<string>());

    const date = getRowDate(row, dateFields);
    if (date) index.get(itemKey)?.add(date);
  }

  return index;
}

function calculateDateFields(dates?: Set<string>): MfItemDateFields {
  const sortedDates = Array.from(dates ?? []).sort((a, b) => a.localeCompare(b));

  return {
    MF_Before: sortedDates.length > 1 ? sortedDates[sortedDates.length - 2] : null,
    MF_Lasted: sortedDates[sortedDates.length - 1] ?? null,
  };
}

function fallbackDateFields(row: MfItemRow, dateFields: readonly string[]): MfItemDateFields {
  return {
    MF_Before: null,
    MF_Lasted: getRowDate(row, dateFields),
  };
}

function enrichRows(
  rows: MfItemRow[],
  dateIndex: Map<string, Set<string>>,
  options: MfItemDateOptions,
): Array<MfItemRow & MfItemDateFields> {
  const itemKeyFields = options.itemKeyFields ?? MF_ITEM_KEY_FIELDS;
  const dateFields = options.dateFields ?? MF_CREATE_DATE_FIELDS;

  return rows.map((row) => {
    const itemKey = getMfItemKey(row, itemKeyFields);
    const fields = itemKey ? calculateDateFields(dateIndex.get(itemKey)) : fallbackDateFields(row, dateFields);
    return { ...row, ...fields };
  });
}

export function mergeMfItemRows(
  historicalPayload: unknown,
  currentPayload: unknown,
  options: MfItemDateOptions = {},
): Array<MfItemRow & MfItemDateFields> {
  const itemKeyFields = options.itemKeyFields ?? MF_ITEM_KEY_FIELDS;
  const historicalRows = rowsFromMfPayload(historicalPayload);
  const currentRows = rowsFromMfPayload(currentPayload);
  const currentItemKeys = new Set(currentRows.map((row) => getMfItemKey(row, itemKeyFields)).filter(Boolean));
  const fallbackHistoricalRows = historicalRows.filter((row) => {
    const itemKey = getMfItemKey(row, itemKeyFields);
    return !itemKey || !currentItemKeys.has(itemKey);
  });
  const dateIndex = buildDateIndex(historicalRows, currentRows, options);

  return enrichRows([...currentRows, ...fallbackHistoricalRows], dateIndex, options);
}

export function addMfDateFields(
  targetPayload: unknown,
  historicalPayload: unknown,
  currentPayload: unknown,
  options: MfItemDateOptions = {},
): Array<MfItemRow & MfItemDateFields> {
  const targetRows = rowsFromMfPayload(targetPayload);
  const historicalRows = rowsFromMfPayload(historicalPayload);
  const currentRows = rowsFromMfPayload(currentPayload);
  const dateIndex = buildDateIndex(historicalRows, currentRows, options);
  return enrichRows(targetRows, dateIndex, options);
}
