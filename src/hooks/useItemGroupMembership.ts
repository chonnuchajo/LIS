import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ItemGroupItem } from '@/lib/api';
import { buildItemGroupIndex } from '@/lib/itemGroups';
import { getItemNo, getRawCommonName, getTradeName } from '@/lib/masterItemFields';

type RawItem = Record<string, unknown>;

function normalizeItems(payload: unknown): RawItem[] {
  if (Array.isArray(payload)) return payload as RawItem[];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const found = [p.data, p.items, p.result, p.rows].find(Array.isArray);
    if (Array.isArray(found)) return found as RawItem[];
  }
  return [];
}

// คืน Map<itemNo, groupId[]> สำหรับส่งเข้า parameter matcher.
export function useItemGroupMembership(): Map<string, string[]> {
  const { data: items = [] } = useQuery({
    queryKey: ['master-items'],
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items');
      return normalizeItems(res.data.data);
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['item-groups'],
    queryFn: async () => {
      const res = await api.get<ItemGroupItem[]>('/item-groups');
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  return useMemo(() => {
    const catalog = items.map((it) => ({
      itemNo: getItemNo(it),
      commonName: getRawCommonName(it),
      tradeName: getTradeName(it),
    }));
    return buildItemGroupIndex(catalog, groups);
  }, [items, groups]);
}
