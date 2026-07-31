import { describe, expect, it } from 'vitest';
import {
  buildProductionReturnUrl,
  hasRequiredLabRequestStep,
  isResearchAndDevelopmentDepartment,
  makeInitialItemsFromQuery,
  requiresMasterItemSelection,
  requiresDeliveryAndBatch,
} from './ProductionPetitionNewPage';

describe('buildProductionReturnUrl', () => {
  it('returns production list with original request number and LIS petition number', () => {
    const params = new URLSearchParams('requestNo=SA260715023429&request_no=SA260715023429');

    expect(buildProductionReturnUrl(params, { petitionNo: 'P26070001' })).toBe(
      'https://app-plant.icpladda.com/production-react/?tab=list&requestNo=SA260715023429&request_no=SA260715023429&lisPetitionNo=P26070001&petitionNo=P26070001&lisStatus=sent&lisSent=1',
    );
  });
});

describe('R&D integration request rules', () => {
  it('recognizes the HR department name regardless of spacing/case', () => {
    expect(isResearchAndDevelopmentDepartment('R & D')).toBe(true);
    expect(isResearchAndDevelopmentDepartment('r&d')).toBe(true);
    expect(isResearchAndDevelopmentDepartment('Production')).toBe(false);
  });

  it('does not require a deliverer or batch number for R&D submitters', () => {
    expect(requiresDeliveryAndBatch('R & D')).toBe(false);
    expect(requiresDeliveryAndBatch('Production')).toBe(true);
  });

  it('always routes R&D submitters through the lab request step', () => {
    expect(hasRequiredLabRequestStep('R & D', [{ batchNo: '', testItems: '' }])).toBe(true);
    expect(hasRequiredLabRequestStep('Production', [{ batchNo: 'BN240602', testItems: '' }])).toBe(false);
    expect(hasRequiredLabRequestStep('Production', [{ batchNo: 'BN240601', testItems: '' }])).toBe(true);
  });

  it('allows R&D submitters to type item fields without a master item match', () => {
    expect(requiresMasterItemSelection({ department: 'R & D', integrationMode: false })).toBe(false);
    expect(requiresMasterItemSelection({ department: 'Production', integrationMode: false })).toBe(true);
    expect(requiresMasterItemSelection({ department: 'Production', integrationMode: true })).toBe(false);
  });

  it('maps the integration lab parameter into testItems when R&D has no batch', () => {
    const items = makeInitialItemsFromQuery(
      new URLSearchParams('department=R%20%26%20D&sampleName=R%26D%20Sample&lab=Assay'),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sampleName: 'R&D Sample',
      batchNo: '',
      testItems: 'Assay',
    });
  });
});
