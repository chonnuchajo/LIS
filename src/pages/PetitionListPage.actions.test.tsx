import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PetitionListPage from './PetitionListPage';
import type { Petition } from '@/types/petition.types';

const mocks = vi.hoisted(() => {
  const petition = (
    id: string,
    status: Petition['status'],
    overrides: Partial<Petition> = {},
  ): Petition => ({
    _id: id,
    petitionNo: id,
    dept: 'production',
    status,
    submittedBy: {
      employeeId: 'E001',
      name: 'ผู้ทดสอบ',
      submittedAt: '2026-07-13T01:00:00.000Z',
    },
    items: [
      {
        seq: 1,
        sampleName: `ตัวอย่าง ${id}`,
        batchNo: 'BATCH-002',
      },
    ],
    reviewHistory: [],
    createdAt: '2026-07-13T01:00:00.000Z',
    updatedAt: '2026-07-13T01:00:00.000Z',
    ...overrides,
  });

  const petitions = [
    petition('P-2607-0001', 'success'),
    petition('P-2607-0002', 'inProgress'),
    petition('P-2607-0003', 'rejected'),
    petition('P-2607-0004', 'sampleSent'),
    petition('P-2607-0005', 'pendingReview', {
      assignedTo: { employeeId: 'E002', name: 'ผู้รับงาน' },
    }),
    petition('P-2607-0006', 'deliveringQC'),
  ];

  return {
    getParameters: vi.fn().mockResolvedValue([]),
    petitions,
    push: vi.fn(),
    refresh: vi.fn(),
  };
});

vi.mock('@/components/lis/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      employeeId: 'E999',
      email: 'admin@example.test',
      name: 'Admin',
      roles: ['admin'],
    },
  }),
}));

vi.mock('@/hooks/useCanAccessPath', () => ({
  useCanAccessPath: () => () => true,
}));

vi.mock('@/hooks/useItemGroupMembership', () => ({
  useItemGroupMembership: () => new Map(),
}));

vi.mock('@/hooks/usePetition', () => ({
  usePetitionList: () => ({
    data: { items: mocks.petitions, total: mocks.petitions.length },
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getParameters: mocks.getParameters,
  },
}));

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/petitions']}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <PetitionListPage />
    </MemoryRouter>,
  );
}

describe('PetitionListPage action cues', () => {
  it('does not show the per-card action labels on the petitions list', async () => {
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();

    for (const label of [
      'ดูสรุปผล',
      'ดูความคืบหน้า',
      'ดูเหตุผล',
      'Assign ผู้รับงาน',
      'ดูผู้รับงาน',
      'ดูรายละเอียด',
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
