import { describe, it, expect } from 'vitest';
import { readSlotMethods, machineMatchesMethod, type MethodDoc } from './methodRegistry';

const GC: MethodDoc = { _id: '1', code: 'GC', label: 'GC', requiresMachine: true, machinePrefix: 'GC', defaultTimes: 3, order: 1, active: true, builtIn: true };
const HPLC: MethodDoc = { _id: '2', code: 'HPLC', label: 'HPLC', requiresMachine: true, machinePrefix: 'HPLC', defaultTimes: 1, order: 2, active: true, builtIn: true };

describe('readSlotMethods', () => {
  it('returns methods field as-is when present', () => {
    expect(readSlotMethods({ methods: [['GC'], ['DIGEST', 'TITRATION']] }, 2)).toEqual([['GC'], ['DIGEST', 'TITRATION']]);
  });
  it('maps legacy instruments string→singleton, BOTH→empty, ""→empty', () => {
    expect(readSlotMethods({ instruments: ['GC', 'BOTH', ''] }, 3)).toEqual([['GC'], [], []]);
  });
  it('pads to substanceCount with empty slots', () => {
    expect(readSlotMethods({ methods: [['GC']] }, 3)).toEqual([['GC'], [], []]);
  });
  it('returns all-empty when nothing configured', () => {
    expect(readSlotMethods({}, 2)).toEqual([[], []]);
  });
});

describe('machineMatchesMethod', () => {
  it('matches machine name prefix to method machinePrefix (HPLC before GC)', () => {
    expect(machineMatchesMethod('HPLC 1260 1', HPLC, [GC, HPLC])).toBe(true);
    expect(machineMatchesMethod('HPLC 1260 1', GC, [GC, HPLC])).toBe(false);
    expect(machineMatchesMethod('GC 7890', GC, [GC, HPLC])).toBe(true);
  });
  it('non-machine method never matches a machine', () => {
    const titr: MethodDoc = { ...GC, code: 'TITRATION', requiresMachine: false, machinePrefix: '' };
    expect(machineMatchesMethod('GC 7890', titr, [GC, HPLC, titr])).toBe(false);
  });
});
