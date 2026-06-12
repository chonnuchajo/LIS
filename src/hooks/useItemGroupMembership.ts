import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ItemGroupItem } from '@/lib/api';
import { buildItemGroupIndex } from '@/lib/itemGroups';

// Slim catalog row from GET /master-items/slim (only the 3 fields the index
// needs). Avoids downloading the full ~940 KB master-item payload here.
type SlimItem = { itemNo?: string; commonName?: string; tradeName?: string };

function normalizeItems(payload: unknown): SlimItem[] {
  if (Array.isArray(payload)) return payload as SlimItem[];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const found = [p.data, p.items, p.result, p.rows].find(Array.isArray);
    if (Array.isArray(found)) return found as SlimItem[];
  }
  return [];
}

// คืน Map<itemNo, groupId[]> สำหรับส่งเข้า parameter matcher.
export function useItemGroupMembership(): Map<string, string[]> {
  const { data: items = [] } = useQuery({
    queryKey: ['master-items-slim'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items/slim');
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
      itemNo: (it.itemNo ?? '').trim(),
      commonName: (it.commonName ?? '').trim(),
      tradeName: (it.tradeName ?? '').trim(),
    }));
    return buildItemGroupIndex(catalog, groups);
  }, [items, groups]);
}
