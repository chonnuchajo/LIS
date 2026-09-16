import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LabTestingPage from './LabTestingPage';
import type { Petition } from '@/types/petition.types';

const mocks = vi.hoisted(() => {
  const assignedPetition: Petition = {
    _id: 'petition-assigned-to-current-user',
    petitionNo: 'P-LAB-ASSIGNED',
    dept: 'rm',
    status: 'inProgress',
    submittedBy: {
      name: 'ผู้ส่งตัวอย่าง',
      submittedAt: '2026-09-16T01:00:00.000Z',
    },
    assignedTo: {
      employeeId: 'E123',
      name: 'Analyst A',
      assignedAt: '2026-09-16T02:00:00.000Z',
    },
    labReceivedAt: '2026-09-16T02:30:00.000Z',
    labReceivedBy: 'Analyst A',
    items: [
      {
        seq: 1,
        sampleName: 'ตัวอย่าง Lab',
        commonName: 'ABAMECTIN 1.8% W/V EC',
        batchNo: 'A1',
        sendToLab: true,
      },
    ],
    createdAt: '2026-09-16T01:00:00.000Z',
    updatedAt: '2026-09-16T02:30:00.000Z',
  };

  return {
    assignedPetition,
    refresh: vi.fn(),
    getAbnormalFlags: vi.fn(async () => ({ 'petition-assigned-to-current-user': false })),
    getParameters: vi.fn(async () => [
      {
        _id: 'param-lab-all',
        name: 'Active Ingredient',
        scope: 'lab',
        applyAll: true,
        valueFields: [],
      },
    ]),
    getReturnedFlags: vi.fn(async () => ({ 'petition-assigned-to-current-user': false })),
    user: {
      employeeId: 'E123',
      email: 'analyst@example.test',
      name: 'Analyst A',
      roles: ['lab-analyst'],
    },
  };
});

vi.mock('@/components/lis/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/hooks/useArrivalFlash', () => ({
  useArrivalFlashId: () => null,
}));

vi.mock('@/hooks/useItemGroupMembership', () => ({
  useItemGroupMembership: () => new Map(),
}));

vi.mock('@/hooks/usePetition', () => ({
  usePetitionList: (params: { assignedToEmployeeId?: string; assignedToName?: string }) => {
    const items = params.assignedToEmployeeId === 'E123' && params.assignedToName === 'Analyst A'
      ? [mocks.assignedPetition]
      : [];
    return {
      data: { items, total: items.length, page: 1, limit: 50 },
      loading: false,
      error: null,
      refresh: mocks.refresh,
    };
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    getAbnormalFlags: mocks.getAbnormalFlags,
    getParameters: mocks.getParameters,
    getReturnedFlags: mocks.getReturnedFlags,
  },
}));

describe('LabTestingPage assignment visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads petitions assigned to the current lab user before rendering the list', async () => {
    render(
      <MemoryRouter>
        <LabTestingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('P-LAB-ASSIGNED')).toBeInTheDocument();
  });
});
