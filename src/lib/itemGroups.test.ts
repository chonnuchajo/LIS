import { describe, it, expect } from 'vitest';
import { resolveItemGroups, buildItemGroupIndex } from './itemGroups';
import type { ItemGroupItem } from './api';

const g = (over: Partial<ItemGroupItem>): ItemGroupItem => ({
  _id: 'g1', name: 'G', description: '',
  commonNames: [], tradeNames: [], includeItemNos: [], excludeItemNos: [],
  status: 'active', sortOrder: 0, ...over,
});

describe('resolveItemGroups', () => {
  it('matches by commonName (case-insensitive)', () => {
    const groups = [g({ _id: 'a', commonNames: ['EW'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'ew', tradeName: '' }, groups);
    expect(ids).toEqual(['a']);
  });

  it('matches by tradeName when commonName does not match', () => {
    const groups = [g({ _id: 'b', tradeNames: ['SUPERKILL'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'WP', tradeName: 'SuperKill' }, groups);
    expect(ids).toEqual(['b']);
  });

  it('includeItemNos adds an item that rule would not match', () => {
    const groups = [g({ _id: 'c', commonNames: ['EW'], includeItemNos: ['X-9'] })];
    const ids = resolveItemGroups({ itemNo: 'X-9', commonName: 'WP', tradeName: '' }, groups);
    expect(ids).toEqual(['c']);
  });

  it('excludeItemNos wins over rule + include', () => {
    const groups = [g({ _id: 'd', commonNames: ['EW'], includeItemNos: ['X-1'], excludeItemNos: ['X-1'] })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: '' }, groups);
    expect(ids).toEqual([]);
  });

  it('ignores inactive groups', () => {
    const groups = [g({ _id: 'e', commonNames: ['EW'], status: 'inactive' })];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: '' }, groups);
    expect(ids).toEqual([]);
  });

  it('returns every matching group id', () => {
    const groups = [
      g({ _id: 'a', commonNames: ['EW'] }),
      g({ _id: 'b', tradeNames: ['T1'] }),
    ];
    const ids = resolveItemGroups({ itemNo: 'X-1', commonName: 'EW', tradeName: 'T1' }, groups);
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

describe('buildItemGroupIndex', () => {
  it('maps itemNo -> group ids over the catalog', () => {
    const groups = [g({ _id: 'a', commonNames: ['EW'] })];
    const items = [
      { itemNo: 'X-1', commonName: 'EW', tradeName: '' },
      { itemNo: 'X-2', commonName: 'WP', tradeName: '' },
    ];
    const idx = buildItemGroupIndex(items, groups);
    expect(idx.get('X-1')).toEqual(['a']);
    expect(idx.get('X-2')).toEqual([]);
  });
});
