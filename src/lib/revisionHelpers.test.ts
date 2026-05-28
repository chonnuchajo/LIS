import { describe, it, expect } from 'vitest';
import { buildPreviousValueLookup, getPreviousValue } from './revisionHelpers';
import type { QCTestResult, PetitionItem } from '@/types/petition.types';

const makeResult = (overrides: Partial<QCTestResult>): QCTestResult => ({
  petitionId: 'p1',
  itemSeq: 1,
  sampleName: 'SampleA',
  parameterId: 'param1',
  values: {},
  ...overrides,
});

const makeItem = (overrides: Partial<PetitionItem>): PetitionItem => ({
  seq: 1,
  sampleName: 'SampleA',
  batchNo: 'B1',
  ...overrides,
});

describe('buildPreviousValueLookup', () => {
  it('returns empty lookup for empty input', () => {
    const previousItems: PetitionItem[] = [];
    const previousResults: QCTestResult[] = [];
    const lookup = buildPreviousValueLookup(previousItems, previousResults);
    expect(lookup.size).toBe(0);
  });

  it('builds keys keyed by batchNo + sampleName + commonName + parameterId + fieldLabel', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' })];
    const results = [
      makeResult({ itemSeq: 1, parameterId: 'p1', values: { '%Purity': 99.5, Density: 0.79 } }),
    ];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.get('B1|SampleA|Acetone|p1|%Purity')).toBe(99.5);
    expect(lookup.get('B1|SampleA|Acetone|p1|Density')).toBe(0.79);
  });

  it('treats missing commonName as empty string in the key', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', batchNo: 'B1' })];
    const results = [makeResult({ itemSeq: 1, parameterId: 'p1', values: { x: 1 } })];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.get('B1|SampleA||p1|x')).toBe(1);
  });

  it('skips results without a matching item', () => {
    const items = [makeItem({ seq: 1 })];
    const results = [makeResult({ itemSeq: 99, parameterId: 'p1', values: { x: 1 } })];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.size).toBe(0);
  });
});

describe('getPreviousValue', () => {
  it('returns the value when a match exists', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' })];
    const results = [makeResult({ itemSeq: 1, parameterId: 'p1', values: { Density: 0.79 } })];
    const lookup = buildPreviousValueLookup(items, results);
    const currentItem = makeItem({ seq: 5, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' });
    expect(getPreviousValue(lookup, currentItem, 'p1', 'Density')).toBe(0.79);
  });

  it('returns undefined when no match exists', () => {
    const lookup = buildPreviousValueLookup([], []);
    const currentItem = makeItem({ seq: 1 });
    expect(getPreviousValue(lookup, currentItem, 'p1', 'x')).toBeUndefined();
  });
});
