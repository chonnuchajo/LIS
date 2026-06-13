import type { ParameterItem } from '@/lib/api';
import type { QCTestResult } from '@/types/petition.types';

// Field label that QC enters the specific-gravity reading into, inside the
// shared QC parameter "ค่า ถพ.". Matching by field label (not parameter _id)
// keeps this resilient to parameter re-creation; a future explicit flag on the
// Parameter could replace this (see spec).
export const SG_FIELD_LABEL = 'ค่าถพ.';

// Sibling key in QCTestResult.values holding the entry index the lab chose to
// show on the service-request form (for multiEntry ถพ. parameters).
export const FORM_ENTRY_INDEX_KEY = '__formEntryIndex';

export interface SgParameter {
  parameterId: string;
  fieldLabel: string;
}

// Locate the QC parameter that holds the ถพ. reading shared with the lab.
export function findSgParameter(parameters: ParameterItem[] | null | undefined): SgParameter | null {
  for (const p of parameters ?? []) {
    if (p.scope !== 'qc' || !p.shareWithLab || !Array.isArray(p.valueFields)) continue;
    const field = p.valueFields.find((f) => f.label === SG_FIELD_LABEL);
    if (field && p._id) return { parameterId: p._id, fieldLabel: field.label };
  }
  return null;
}

// Resolve the ถพ. value to print for a given sample (itemSeq), honouring the
// lab's chosen entry when the result is multiEntry.
export function resolveSpecificGravity(
  qcResults: QCTestResult[] | null | undefined,
  seq: number,
  sgParam: SgParameter | null,
): string {
  if (!sgParam) return '';
  const result = (qcResults ?? []).find(
    (r) => r.itemSeq === seq && r.parameterId === sgParam.parameterId,
  );
  if (!result) return '';

  const entries = Array.isArray(result.entries) ? result.entries : [];
  let row: Record<string, unknown>;
  if (entries.length) {
    let idx = Number(result.values?.[FORM_ENTRY_INDEX_KEY] ?? 0);
    if (!Number.isFinite(idx) || idx < 0 || idx >= entries.length) idx = 0;
    row = entries[idx] ?? {};
  } else {
    row = result.values ?? {};
  }

  const value = row?.[sgParam.fieldLabel];
  return value == null || value === '' ? '' : String(value);
}
