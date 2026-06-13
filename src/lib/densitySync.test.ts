import { describe, it, expect } from 'vitest';
import {
  SG_VALUE_LABEL,
  SG_TEMP_LABEL,
  sourceSiblingKey,
  densityRowToEntry,
  hasHandTypedEntries,
  formatTSetComparison,
} from './densitySync';

const ROW = {
  'Sample name': '26S-ACT50-095 bottom',
  'Density [g/cm³]': '0.9919',
  'T (block) [°C]': '30.00',
  'T (set) [°C]': '30.00',
  'Instrument name': 'DMA 501',
};

describe('labels', () => {
  it('SG value/temp labels', () => {
    expect(SG_VALUE_LABEL).toBe('ค่าถพ.');
    expect(SG_TEMP_LABEL).toBe('อุณหภูมิ');
    expect(sourceSiblingKey('อุณหภูมิ')).toBe('อุณหภูมิ__source');
  });
});

describe('densityRowToEntry', () => {
  it('maps density + T(block) and stores T(set) in provenance', () => {
    const e = densityRowToEntry(ROW, '2026-06-13T03:00:00.000Z');
    expect(e['ค่าถพ.']).toBe(0.9919);
    expect(e['อุณหภูมิ']).toBe(30);
    const tempSrc = e['อุณหภูมิ__source'] as Record<string, unknown>;
    expect(tempSrc.source).toBe('instrument');
    expect(tempSrc.instrument).toBe('DMA 501');
    expect(tempSrc.sampleName).toBe('26S-ACT50-095 bottom');
    expect(tempSrc.tSet).toBe(30);
    expect(tempSrc.fetchedAt).toBe('2026-06-13T03:00:00.000Z');
    const valSrc = e['ค่าถพ.__source'] as Record<string, unknown>;
    expect(valSrc.source).toBe('instrument');
  });
  it('leaves value empty when unparseable', () => {
    const e = densityRowToEntry({ ...ROW, 'Density [g/cm³]': 'n/a' }, '2026-06-13T03:00:00.000Z');
    expect(e['ค่าถพ.']).toBe('');
  });
  it('falls back to DMA 501 when instrument name missing', () => {
    const e = densityRowToEntry({ ...ROW, 'Instrument name': '' }, 'x');
    expect((e['อุณหภูมิ__source'] as Record<string, unknown>).instrument).toBe('DMA 501');
  });
});

describe('hasHandTypedEntries', () => {
  it('false for empty / instrument-sourced entries', () => {
    expect(hasHandTypedEntries(undefined)).toBe(false);
    expect(hasHandTypedEntries([])).toBe(false);
    expect(hasHandTypedEntries([densityRowToEntry(ROW, 'x')])).toBe(false);
  });
  it('true when a value lacks instrument provenance', () => {
    expect(hasHandTypedEntries([{ 'ค่าถพ.': 0.99 }])).toBe(true);
    expect(hasHandTypedEntries([{ 'อุณหภูมิ': 30 }])).toBe(true);
  });
});

describe('formatTSetComparison', () => {
  it('match / differ / no-standard / null', () => {
    expect(formatTSetComparison(30, 30)?.status).toBe('match');
    expect(formatTSetComparison(30, 25)?.status).toBe('differ');
    expect(formatTSetComparison(30, null)?.status).toBe('no-standard');
    expect(formatTSetComparison('', 30)).toBeNull();
    expect(formatTSetComparison(undefined, 30)).toBeNull();
  });
  it('text includes both values when standard present', () => {
    expect(formatTSetComparison(30, 30)?.text).toBe('เครื่องตั้งที่ (T set): 30 • มาตรฐาน: 30');
  });
});
