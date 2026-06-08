import type { ParameterItem } from "@/lib/api";
import type { QCProgressEntry } from "@/lib/api";
import type { Petition } from "@/types/petition.types";
import { matchParametersForItem } from "@/lib/petitionTestItems";

export { matchParametersForItem };

// Photo fields are not yet implementable in the UI, so they do not count
// toward the denominator. Conditional enum notes are situational and also
// excluded — the bar measures "primary cells to fill".
function isCountableField(type: string | undefined): boolean {
  return type !== "photo";
}

export interface PetitionProgress {
  filled: number;
  total: number;
  percent: number;
}

export function computePetitionProgress(
  petition: Petition,
  parameters: ParameterItem[],
  entries: QCProgressEntry[] | undefined,
  membership?: Map<string, string[]>,
): PetitionProgress {
  const filledByKey = new Map<string, Set<string>>();
  for (const e of entries ?? []) {
    filledByKey.set(`${e.itemSeq}__${e.parameterId}`, new Set(e.filledLabels));
  }

  let total = 0;
  let filled = 0;

  for (const item of petition.items ?? []) {
    const ids = membership?.get(String(item.sampleId ?? '').trim()) ?? [];
    const matched = matchParametersForItem(item, parameters, ids);
    for (const param of matched) {
      const fields = (param.valueFields ?? []).filter((f) =>
        isCountableField(f.type),
      );
      if (fields.length === 0) continue;
      const key = `${item.seq}__${param._id}`;
      const filledLabels = filledByKey.get(key);
      for (const f of fields) {
        total += 1;
        if (filledLabels?.has(f.label)) filled += 1;
      }
    }
  }

  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent };
}

export function isSameLocalDay(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
