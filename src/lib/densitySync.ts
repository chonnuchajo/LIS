import { SG_FIELD_LABEL } from '@/lib/formSpecificGravity';

// The two visible fields of the "ค่า ถพ." parameter.
export const SG_VALUE_LABEL = SG_FIELD_LABEL; // 'ค่าถพ.'
export const SG_TEMP_LABEL = 'อุณหภูมิ';

// Result-Density column keys (raw DMA 501 export).
const COL_DENSITY = 'Density [g/cm³]';
const COL_TBLOCK = 'T (block) [°C]';
const COL_TSET = 'T (set) [°C]';
const COL_INSTRUMENT = 'Instrument name';
const COL_SAMPLE = 'Sample name';

// Provenance sibling convention: "<label>__source" (mirrors LabTestingDetailPage).
export function sourceSiblingKey(label: string): string {
  return `${label}__source`;
}

function toNum(v: unknown): number | '' {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

// Map one Result-Density row to a QCTestResult entry for the "ค่า ถพ." parameter.
// `fetchedAt` is passed in (pure: no Date access here) and recorded in provenance.
export function densityRowToEntry(
  row: Record<string, unknown>,
  fetchedAt: string,
): Record<string, unknown> {
  const instrument = String(row[COL_INSTRUMENT] || 'DMA 501');
  const sampleName = row[COL_SAMPLE];
  const tSet = toNum(row[COL_TSET]);
  return {
    [SG_VALUE_LABEL]: toNum(row[COL_DENSITY]),
    [SG_TEMP_LABEL]: toNum(row[COL_TBLOCK]),
    [sourceSiblingKey(SG_VALUE_LABEL)]: { source: 'instrument', instrument, sampleName, fetchedAt },
    [sourceSiblingKey(SG_TEMP_LABEL)]: {
      source: 'instrument', instrument, sampleName, fetchedAt,
      tSet, tBlock: toNum(row[COL_TBLOCK]),
    },
  };
}

// True if any entry holds a non-empty SG value/temp without instrument provenance
// (i.e. it was hand-typed) — drives the overwrite confirm.
export function hasHandTypedEntries(entries?: Record<string, unknown>[]): boolean {
  for (const e of entries ?? []) {
    if (!e) continue;
    for (const label of [SG_VALUE_LABEL, SG_TEMP_LABEL]) {
      const v = e[label];
      if (v === '' || v == null) continue;
      const src = e[sourceSiblingKey(label)] as { source?: string } | undefined;
      if (!src || src.source !== 'instrument') return true;
    }
  }
  return false;
}

export interface TSetComparison {
  text: string;
  status: 'match' | 'differ' | 'no-standard';
}

// Build the read-only "T set vs standard" line shown under each entry. Returns
// null when there is no usable T(set) value.
export function formatTSetComparison(tSet: unknown, standardValue: unknown): TSetComparison | null {
  if (tSet == null || tSet === '' || !Number.isFinite(Number(tSet))) return null;
  const t = Number(tSet);
  if (standardValue == null || standardValue === '' || !Number.isFinite(Number(standardValue))) {
    return { text: `เครื่องตั้งที่ (T set): ${t}`, status: 'no-standard' };
  }
  const s = Number(standardValue);
  return {
    text: `เครื่องตั้งที่ (T set): ${t} • มาตรฐาน: ${s}`,
    status: t === s ? 'match' : 'differ',
  };
}
