import { describe, it, expect } from 'vitest';
import {
  getItemProductType,
  getItemSubCategory,
  matchParametersForItem,
  visibleEnumOptions,
} from './petitionTestItems';
import type { ParameterItem, ParameterValueField } from './api';
import type { PetitionItem } from '@/types/petition.types';

const makeItem = (overrides: Partial<PetitionItem> = {}): PetitionItem => ({
  seq: 1,
  sampleId: 'EW-001',
  sampleName: 'Imidacloprid 10% EW',
  commonName: 'EW',
  ...overrides,
} as PetitionItem);

const makeEnumField = (overrides: Partial<ParameterValueField> = {}): ParameterValueField => ({
  label: 'สภาพ',
  type: 'enum',
  options: ['ของเหลวใส', 'ของเหลวขุ่น', 'ผงละเอียด'],
  ...overrides,
});

const makeParam = (overrides: Partial<ParameterItem> = {}): ParameterItem => ({
  name: '%AI',
  status: 'active',
  applyAll: true,
  ...overrides,
} as ParameterItem);

describe('matchParametersForItem — lab-scope gating', () => {
  // A lab-scope parameter only applies to items actually sent to lab
  // (lab batch = batchNo ending in 1 or 6). applyAll must NOT override this.
  it('excludes an applyAll lab param from a non-lab-batch item', () => {
    const param = makeParam({ scope: 'lab' });
    const item = makeItem({ batchNo: 'AB-2502' }); // ends in 2 → not lab
    expect(matchParametersForItem(item, [param])).toEqual([]);
  });

  it('includes an applyAll lab param on a lab-batch item', () => {
    const param = makeParam({ scope: 'lab' });
    expect(matchParametersForItem(makeItem({ batchNo: 'AB-2501' }), [param])).toHaveLength(1);
    expect(matchParametersForItem(makeItem({ batchNo: 'AB-2506' }), [param])).toHaveLength(1);
  });

  it('still matches qc-scope applyAll params on any item (unchanged)', () => {
    const param = makeParam({ scope: 'qc' });
    expect(matchParametersForItem(makeItem({ batchNo: 'AB-2502' }), [param])).toHaveLength(1);
  });

  it('treats a param with no scope as qc (not lab-gated)', () => {
    const param = makeParam({ scope: undefined });
    expect(matchParametersForItem(makeItem({ batchNo: 'AB-2502' }), [param])).toHaveLength(1);
  });
});

describe('getItemProductType', () => {
  it('returns water for EW sample', () => {
    expect(getItemProductType(makeItem({ commonName: 'EW' }))).toBe('water');
  });

  it('returns powder for WP sample', () => {
    expect(getItemProductType(makeItem({ commonName: 'WP', sampleName: 'Foo 80% WP' }))).toBe('powder');
  });

  it('returns empty string when no classification found', () => {
    expect(getItemProductType(makeItem({ commonName: '', sampleName: 'unknown stuff' }))).toBe('');
  });
});

describe('getItemSubCategory', () => {
  it('extracts prefix before first dash from sampleId', () => {
    expect(getItemSubCategory(makeItem({ sampleId: 'ULV-001' }))).toBe('ULV');
  });

  it('returns uppercased sampleId when no dash', () => {
    expect(getItemSubCategory(makeItem({ sampleId: 'ec' }))).toBe('EC');
  });

  it('returns empty string when sampleId missing', () => {
    expect(getItemSubCategory(makeItem({ sampleId: undefined }))).toBe('');
  });
});

describe('visibleEnumOptions', () => {
  it('returns all options when field.optionFilters is undefined (backward-compatible)', () => {
    const field = makeEnumField();
    const item = makeItem();
    expect(visibleEnumOptions(field, item)).toEqual(['ของเหลวใส', 'ของเหลวขุ่น', 'ผงละเอียด']);
  });

  it('returns all options when optionFilters has no entry for an option', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'WP', sampleName: 'Foo WP' });
    expect(visibleEnumOptions(field, item)).toEqual(['ของเหลวขุ่น', 'ผงละเอียด']);
  });

  it('shows option when productType matches', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'EW' });
    expect(visibleEnumOptions(field, item)).toContain('ของเหลวใส');
  });

  it('hides option when productType does not match', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water'] } },
    });
    const item = makeItem({ commonName: 'WP', sampleName: 'Foo WP' });
    expect(visibleEnumOptions(field, item)).not.toContain('ของเหลวใส');
  });

  it('uses OR within productTypes (any match)', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { productTypes: ['water', 'sand'] } },
    });
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ commonName: 'GR', sampleName: 'Foo GR' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP' }))).not.toContain('ของเหลวใส');
  });

  it('uses OR across productTypes and subCategories dimensions', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { productTypes: ['water'], subCategories: ['ROLS'] },
      },
    });
    // water item w/ non-matching subCat — water matches → show
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW', sampleId: 'EW-001' }))).toContain('ของเหลวใส');
    // powder item w/ matching subCat — subCat matches → show
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP', sampleId: 'ROLS-001' }))).toContain('ของเหลวใส');
    // powder item w/ non-matching subCat — neither matches → hide
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP', sampleId: 'WP-001' }))).not.toContain('ของเหลวใส');
  });

  it('treats entry with all empty arrays as "show always"', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { productTypes: [], subCategories: [] },
      },
    });
    expect(visibleEnumOptions(field, makeItem({ commonName: 'WP', sampleName: 'Foo WP' }))).toContain('ของเหลวใส');
  });

  it('matches by itemNames (exact sampleName)', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { itemNames: ['Imidacloprid 10% EW'] },
      },
    });
    expect(visibleEnumOptions(field, makeItem({ sampleName: 'Imidacloprid 10% EW' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ sampleName: 'Other Item' }))).not.toContain('ของเหลวใส');
  });

  it('matches by commonNames (case-insensitive)', () => {
    const field = makeEnumField({
      optionFilters: {
        'ของเหลวใส': { commonNames: ['ULV'] },
      },
    });
    expect(visibleEnumOptions(field, makeItem({ commonName: 'ulv', sampleName: 'X ULV' }))).toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, makeItem({ commonName: 'EW' }))).not.toContain('ของเหลวใส');
  });
});

describe('item-group matching', () => {
  it('matchParametersForItem matches a group-only param when itemGroupIds include it', () => {
    const param = makeParam({ applyAll: false, itemGroups: ['gA'], scope: 'qc' });
    const item = makeItem({ commonName: 'ZZ', sampleName: 'No match' });
    // ไม่ส่ง itemGroupIds → ไม่ match
    expect(matchParametersForItem(item, [param])).toHaveLength(0);
    // ส่ง itemGroupIds ที่ตรง → match
    expect(matchParametersForItem(item, [param], ['gA'])).toHaveLength(1);
  });

  it('visibleEnumOptions shows an option gated by itemGroups when membership matches', () => {
    const field = makeEnumField({
      optionFilters: { 'ของเหลวใส': { itemGroups: ['gA'] } },
    });
    const item = makeItem({ commonName: 'ZZ', sampleName: 'No match' });
    expect(visibleEnumOptions(field, item)).not.toContain('ของเหลวใส');
    expect(visibleEnumOptions(field, item, ['gA'])).toContain('ของเหลวใส');
  });
});
