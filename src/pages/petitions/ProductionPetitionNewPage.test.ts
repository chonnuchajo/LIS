import { describe, expect, it } from 'vitest';
import { buildProductionReturnUrl } from './ProductionPetitionNewPage';

describe('buildProductionReturnUrl', () => {
  it('returns production list with original request number and LIS petition number', () => {
    const params = new URLSearchParams('requestNo=SA260715023429&request_no=SA260715023429');

    expect(buildProductionReturnUrl(params, { petitionNo: 'P26070001' })).toBe(
      'https://app-plant.icpladda.com/production-react/?tab=list&requestNo=SA260715023429&request_no=SA260715023429&lisPetitionNo=P26070001&petitionNo=P26070001&lisStatus=sent&lisSent=1',
    );
  });
});
