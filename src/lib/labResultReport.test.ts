import { describe, expect, it, vi } from 'vitest';

const buildApprovalGroups = vi.fn(() => [{ seq: 1 }]);
const buildLabReportPages = vi.fn(() => [{ reportNo: 'LR-1' }]);
vi.mock('@/lib/qcApprovalRows', () => ({ buildApprovalGroups: (...a: unknown[]) => buildApprovalGroups(...a) }));
vi.mock('@/lib/labReport', () => ({ buildLabReportPages: (...a: unknown[]) => buildLabReportPages(...a) }));

import { buildLabResultReportPages } from './labResultReport';

const petition = { _id: 'p1', items: [{ seq: 1 }] } as never;
const labRequests = [{ _id: 'lr1' }] as never;
const qcResults = [] as never;
const groupMembership = new Map<string, string[]>();

describe('buildLabResultReportPages', () => {
  it('passes only Lab-scope parameters to buildApprovalGroups', () => {
    const parameters = [
      { _id: 'a', scope: 'lab' },
      { _id: 'b', scope: 'qc' },
      { _id: 'c' }, // undefined scope defaults to qc
    ] as never;
    buildLabResultReportPages({ petition, labRequests, parameters, qcResults, groupMembership });
    const labParamsArg = buildApprovalGroups.mock.calls[0][1] as Array<{ _id: string }>;
    expect(labParamsArg.map((p) => p._id)).toEqual(['a']);
  });

  it('returns the pages from buildLabReportPages', () => {
    const pages = buildLabResultReportPages({ petition, labRequests, parameters: [] as never, qcResults, groupMembership });
    expect(pages).toEqual([{ reportNo: 'LR-1' }]);
    expect(buildLabReportPages).toHaveBeenCalledWith(petition, labRequests, [{ seq: 1 }]);
  });
});
