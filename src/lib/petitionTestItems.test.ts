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

  it('includes lab params for an explicit lab-track item without a lab batch', () => {
    const labParam = makeParam({ scope: 'lab' });
    const qcParam = makeParam({ scope: 'qc' });
    const item = makeItem({ batchNo: '' });

    expect(matchParametersForItem(item, [labParam, qcParam], [], { forceLabTrack: true })).toEqual([
      labParam,
      qcParam,
    ]);
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

  // itemNo = รหัส Master Item จริง (RO-0123). sampleId เป็น key ของ Approval/
  // PhysicalResult และคำขอเก่าไม่เคยเก็บรหัสสินค้าไว้เลย — itemNo จึงต้องมาก่อน
  it('prefers itemNo over sampleId', () => {
    expect(getItemSubCategory(makeItem({ itemNo: 'RO-0123', sampleId: 'P-2606-0001-1' }))).toBe('RO');
  });

  it('falls back to sampleId when itemNo is blank', () => {
    expect(getItemSubCategory(makeItem({ itemNo: '  ', sampleId: 'ULV-001' }))).toBe('ULV');
  });
});

describe('subCategory prefix matching', () => {
  // หน้า Parameter Settings เขียนกำกับไว้ว่า "ครอบคลุมทุก code ที่ขึ้นต้นด้วย prefix
  // ที่เลือก — เลือก RO จะรวม ROLS, ROPH ด้วย"
  it('matches deeper codes that start with the chosen prefix', () => {
    const param = makeParam({ applyAll: false, subCategories: ['RO'], scope: 'qc' });
    expect(matchParametersForItem(makeItem({ itemNo: 'RO-0123' }), [param])).toHaveLength(1);
    expect(matchParametersForItem(makeItem({ itemNo: 'ROPH-0007' }), [param])).toHaveLength(1);
    expect(matchParametersForItem(makeItem({ itemNo: 'ROLS-0002' }), [param])).toHaveLength(1);
  });

  it('does not match a sibling prefix', () => {
    const param = makeParam({ applyAll: false, subCategories: ['RO'], scope: 'qc' });
    expect(matchParametersForItem(makeItem({ itemNo: 'RI-0044' }), [param])).toHaveLength(0);
    expect(matchParametersForItem(makeItem({ itemNo: 'RS-0100' }), [param])).toHaveLength(0);
  });
});

describe('category (RM/FG) scoping', () => {
  // หมวดหมู่ทำหน้าที่เป็น "ประตู" (AND) ไม่ใช่มิติ OR ตัวที่หก — ตรงกับหน้าจอ
  // ที่ให้เลือกหมวดหมู่ย่อยได้ต่อเมื่อเลือก RM/FG แล้ว
  it('matches a category-only param on a petition of that category', () => {
    const param = makeParam({ applyAll: false, categories: ['RM'], scope: 'qc' });
    const item = makeItem({ itemNo: 'RS-0100' });
    expect(matchParametersForItem(item, [param], [], { petitionCategory: 'RM' })).toHaveLength(1);
  });

  it('drops a category-only param on a petition of another category', () => {
    const param = makeParam({ applyAll: false, categories: ['RM'], scope: 'qc' });
    const item = makeItem({ itemNo: 'F-1200' });
    expect(matchParametersForItem(item, [param], [], { petitionCategory: 'FG' })).toHaveLength(0);
    // คำขอฝ่ายผลิตไม่ใช่ทั้ง RM และ FG
    expect(matchParametersForItem(item, [param], [], { petitionCategory: '' })).toHaveLength(0);
    expect(matchParametersForItem(item, [param])).toHaveLength(0);
  });

  it('narrows (AND) when both category and subCategory are set', () => {
    const param = makeParam({ applyAll: false, categories: ['RM'], subCategories: ['RO'], scope: 'qc' });
    const opts = { petitionCategory: 'RM' as const };
    expect(matchParametersForItem(makeItem({ itemNo: 'RO-0123' }), [param], [], opts)).toHaveLength(1);
    // อยู่ในคำขอ RM แต่รหัสไม่ใช่ RO → ไม่ขึ้น
    expect(matchParametersForItem(makeItem({ itemNo: 'RI-0044' }), [param], [], opts)).toHaveLength(0);
    // รหัส RO แต่คนละหมวดหมู่ → ไม่ขึ้น
    expect(
      matchParametersForItem(makeItem({ itemNo: 'RO-0123' }), [param], [], { petitionCategory: 'FG' }),
    ).toHaveLength(0);
  });

  it('keeps the OR across the other dimensions inside the category gate', () => {
    const param = makeParam({
      applyAll: false,
      categories: ['RM'],
      subCategories: ['RO'],
      commonNames: ['EW'],
      scope: 'qc',
    });
    const opts = { petitionCategory: 'RM' as const };
    // ไม่ใช่ RO แต่ commonName ตรง → ยังขึ้น (OR ภายในประตู RM)
    expect(matchParametersForItem(makeItem({ itemNo: 'RI-0044', commonName: 'EW' }), [param], [], opts)).toHaveLength(1);
  });

  it('leaves params without categories unaffected by petition category', () => {
    const param = makeParam({ applyAll: false, commonNames: ['EW'], scope: 'qc' });
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: 'RM' })).toHaveLength(1);
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: '' })).toHaveLength(1);
  });

  it('applyAll still respects the category gate', () => {
    const param = makeParam({ applyAll: true, categories: ['RM'], scope: 'qc' });
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: 'RM' })).toHaveLength(1);
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: 'FG' })).toHaveLength(0);
  });

  it('excludeCategories drops the param for that petition category', () => {
    const param = makeParam({ applyAll: true, excludeCategories: ['RM'], scope: 'qc' });
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: 'RM' })).toHaveLength(0);
    expect(matchParametersForItem(makeItem(), [param], [], { petitionCategory: 'FG' })).toHaveLength(1);
  });

  it('excludeSubCategories matches by prefix too', () => {
    const param = makeParam({ applyAll: true, excludeSubCategories: ['RO'], scope: 'qc' });
    expect(matchParametersForItem(makeItem({ itemNo: 'ROPH-0007' }), [param])).toHaveLength(0);
    expect(matchParametersForItem(makeItem({ itemNo: 'RI-0044' }), [param])).toHaveLength(1);
  });
});

describe('parameter exclusions', () => {
  it('excludes a commonName even when the item matches the included product type', () => {
    const param = makeParam({
      applyAll: false,
      productTypes: ['water'],
      excludeCommonNames: ['EC'],
      scope: 'qc',
    });

    expect(matchParametersForItem(makeItem({ commonName: 'EC', sampleName: 'Foo EC' }), [param])).toHaveLength(0);
    expect(matchParametersForItem(makeItem({ commonName: 'SC', sampleName: 'Foo SC' }), [param])).toHaveLength(1);
  });

  it('exclusions also apply to applyAll parameters', () => {
    const param = makeParam({
      applyAll: true,
      excludeCommonNames: ['EC'],
      scope: 'qc',
    });

    expect(matchParametersForItem(makeItem({ commonName: 'EC', sampleName: 'Foo EC' }), [param])).toHaveLength(0);
    expect(matchParametersForItem(makeItem({ commonName: 'SC', sampleName: 'Foo SC' }), [param])).toHaveLength(1);
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
