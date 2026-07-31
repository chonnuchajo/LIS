import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PetitionView from './PetitionView';
import type { Petition } from '@/types/petition.types';
import type { ParameterItem } from '@/lib/api';

const fixtures = vi.hoisted(() => ({
  petition: {
    _id: 'petition-rd',
    petitionNo: 'P-RD-001',
    dept: 'production',
    status: 'inProgress',
    submittedBy: {
      name: 'นักวิจัย',
      department: 'R & D',
      submittedAt: '2026-07-31T01:00:00.000Z',
    },
    items: [
      {
        seq: 1,
        sampleName: 'R&D Sample',
        commonName: 'R&D Active',
        batchNo: '',
      },
    ],
    createdAt: '2026-07-31T01:00:00.000Z',
    updatedAt: '2026-07-31T01:00:00.000Z',
  } as Petition,
  parameters: [
    {
      _id: 'lab-only',
      name: 'ทดสอบ Lab',
      scope: 'lab',
      applyAll: true,
      valueFields: [{ label: 'ผล Lab', type: 'text' }],
    },
    {
      _id: 'qc-physical',
      name: 'กายภาพ',
      scope: 'qc',
      shareWithLab: true,
      applyAll: true,
      valueFields: [{ label: 'ผล QC', type: 'text' }],
    },
  ] as ParameterItem[],
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Lab User', roles: ['admin'] } }),
}));

vi.mock('@/hooks/useItemGroupMembership', () => ({
  useItemGroupMembership: () => new Map(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getParameters: vi.fn().mockResolvedValue(fixtures.parameters),
      getQCResults: vi.fn().mockResolvedValue([]),
    },
  };
});

describe('PetitionView R&D parameter visibility', () => {
  it('shows only Lab-scope parameters for R&D petitions', async () => {
    render(<PetitionView petition={fixtures.petition} />);

    await waitFor(() => expect(screen.getByText('ทดสอบ Lab')).toBeInTheDocument());
    expect(screen.queryByText('กายภาพ')).not.toBeInTheDocument();
  });
});
