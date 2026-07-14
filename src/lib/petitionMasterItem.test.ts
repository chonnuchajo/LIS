import { describe, expect, it } from 'vitest';
import {
  buildPetitionMasterItemOptions,
  findMatchingPetitionMasterItem,
  normalizeMasterItemPayload,
} from './petitionMasterItem';

describe('petition master item helpers', () => {
  it('builds petition sample options from raw master item aliases', () => {
    const options = buildPetitionMasterItemOptions([
      {
        item_no: 'P001',
        item_name1: 'Product A 1.8 EC',
        common_name: 'ABAMECTIN 1.8% W/V EC',
        desc2: '1 L x 12 bottles',
      },
      {
        itemCode: 'P002',
        tradeName: 'Product B 10 SL',
        itemType: 'IMIDACLOPRID 10% W/V SL',
        packSize: '500 ml x 24 bottles',
      },
    ]);

    expect(options).toEqual([
      {
        itemNo: 'P001',
        sampleName: 'Product A 1.8 EC',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        packageUnit: '1 L x 12 bottles',
      },
      {
        itemNo: 'P002',
        sampleName: 'Product B 10 SL',
        commonName: 'IMIDACLOPRID 10% W/V SL',
        packageUnit: '500 ml x 24 bottles',
      },
    ]);
  });

  it('matches a selected petition row against the same master option values', () => {
    const options = buildPetitionMasterItemOptions([
      {
        item_no: 'P001',
        item_name1: 'Product A 1.8 EC',
        common_name: 'ABAMECTIN 1.8% W/V EC',
        desc2: '1 L x 12 bottles',
      },
    ]);

    expect(
      findMatchingPetitionMasterItem(options, {
        sampleName: 'Product A 1.8 EC',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        packageUnit: '1 L x 12 bottles',
      }),
    ).toEqual(options[0]);
  });

  it('does not match a sample name that is not in master item options', () => {
    const options = buildPetitionMasterItemOptions([
      {
        item_no: 'P001',
        item_name1: 'Product A 1.8 EC',
        common_name: 'ABAMECTIN 1.8% W/V EC',
        desc2: '1 L x 12 bottles',
      },
    ]);

    expect(
      findMatchingPetitionMasterItem(options, {
        sampleName: 'Product X',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        packageUnit: '1 L x 12 bottles',
      }),
    ).toBeNull();
  });

  it('normalizes common API master item payload shapes', () => {
    expect(normalizeMasterItemPayload([{ item_no: 'P001' }])).toEqual([{ item_no: 'P001' }]);
    expect(normalizeMasterItemPayload({ data: [{ item_no: 'P002' }] })).toEqual([{ item_no: 'P002' }]);
    expect(normalizeMasterItemPayload({ items: [{ item_no: 'P003' }] })).toEqual([{ item_no: 'P003' }]);
    expect(normalizeMasterItemPayload(null)).toEqual([]);
  });
});
