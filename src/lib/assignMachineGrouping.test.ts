import { describe, it, expect } from 'vitest';
import { groupMachineMethods, type SubstanceSlotLike } from './assignMachineGrouping';
import type { MethodDoc } from './methodRegistry';

function method(code: string, over: Partial<MethodDoc> = {}): MethodDoc {
  return {
    _id: code,
    code,
    label: code,
    requiresMachine: true,
    machinePrefix: code,
    defaultTimes: 1,
    order: 0,
    active: true,
    builtIn: false,
    ...over,
  };
}

const registry = new Map<string, MethodDoc>([
  ['GC', method('GC')],
  ['HPLC', method('HPLC')],
  ['TITRATE', method('TITRATE', { requiresMachine: false, machinePrefix: '' })],
  ['GC_OLD', method('GC_OLD', { active: false })],
]);

describe('groupMachineMethods', () => {
  it('collapses two substances that share a type into one entry', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'PROPANIL 36%', methods: ['GC'] },
      { name: 'BUTACHLOR 50%', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GC');
    expect(result[0].substanceNames).toEqual(['PROPANIL 36%', 'BUTACHLOR 50%']);
  });

  it('keeps different types as separate entries in first-seen order', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['HPLC'] },
      { name: 'B', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result.map((r) => r.code)).toEqual(['HPLC', 'GC']);
  });

  it('handles a substance needing two machine methods plus a shared one', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['GC', 'HPLC'] },
      { name: 'B', methods: ['GC'] },
    ];
    const result = groupMachineMethods(slots, registry);
    expect(result.map((r) => r.code)).toEqual(['GC', 'HPLC']);
    expect(result.find((r) => r.code === 'GC')!.substanceNames).toEqual(['A', 'B']);
    expect(result.find((r) => r.code === 'HPLC')!.substanceNames).toEqual(['A']);
  });

  it('excludes bench (non-machine), unknown, and empty codes', () => {
    const slots: SubstanceSlotLike[] = [
      { name: 'A', methods: ['TITRATE'] },
      { name: 'B', methods: ['UNKNOWN'] },
      { name: 'C', methods: [] },
    ];
    expect(groupMachineMethods(slots, registry)).toEqual([]);
  });

  it('includes inactive machine-backed methods (picker still shown; assign blocked elsewhere)', () => {
    const slots: SubstanceSlotLike[] = [{ name: 'A', methods: ['GC_OLD'] }];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GC_OLD');
  });

  it('does not duplicate a substance name when it lists a code twice', () => {
    const slots: SubstanceSlotLike[] = [{ name: 'A', methods: ['GC', 'GC'] }];
    const result = groupMachineMethods(slots, registry);
    expect(result).toHaveLength(1);
    expect(result[0].substanceNames).toEqual(['A']);
  });
});
