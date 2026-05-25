import type { ParameterItem } from '@/lib/api';
import type { PetitionItem, Petition } from '@/types/petition.types';

export function matchParametersForItem(
  item: PetitionItem,
  params: ParameterItem[],
): ParameterItem[] {
  const active = params.filter((p) => p.status !== 'inactive');
  if (!item.testItems) return active.filter((p) => p.applyAll);
  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return active.filter((p) => names.includes((p.name ?? '').toLowerCase()));
}

export function parameterNamesForPetition(
  petition: Petition,
  params: ParameterItem[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of petition.items ?? []) {
    for (const p of matchParametersForItem(item, params)) {
      const name = p.name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  return names;
}
