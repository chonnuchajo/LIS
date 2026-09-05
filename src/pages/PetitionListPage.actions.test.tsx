import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    petition('P-2607-0007', 'approved'),
  ];

  return {
    canAccess: vi.fn(() => true),
    getSixMonthMedicineStock: vi.fn().mockResolvedValue({
      serverTime: '2026-09-04T00:00:00.000Z',
      referenceMonth: '2026-09',
      items: [
        {
          companySource: 'ICPL',
          itemNo: 'F-TEST-001',
          locationCode: 'NORMAL',
          binCode: 'DEFAULT',
          lotNo: 'FG260301-001',
          registeringDate: '2026-03-31T00:00:00.000Z',
          unit: 'KG',
          stockQty: 10,
          stockQtyBase: 10,
          ageMonths: 6,
        },
      ],
    }),
    getParameters: vi.fn().mockResolvedValue([]),
    petitions,
    push: vi.fn(),
    refresh: vi.fn(),
    user: {
      employeeId: 'E999',
      email: 'admin@example.test',
      name: 'Admin',
      roles: ['admin'],
    },
  };
});

vi.mock('@/components/lis/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/hooks/useCanAccessPath', () => ({
  useCanAccessPath: () => mocks.canAccess,
}));

vi.mock('@/hooks/useItemGroupMembership', () => ({
  useItemGroupMembership: () => new Map(),
}));

vi.mock('@/hooks/usePetition', () => ({
  usePetitionList: (params: { status?: string; search?: string }) => {
    const search = params.search?.trim().toLowerCase();
    const items = mocks.petitions
      .filter((petition) =>
        params.status ? params.status.split(',').includes(petition.status) : true,
      )
      .filter((petition) => {
        if (!search) return true;
        return [
          petition.petitionNo,
          petition.submittedBy?.name,
          ...petition.items.map((item) => item.sampleName),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);
      });
    return {
      data: { items, total: items.length },
      loading: false,
      error: null,
      refresh: mocks.refresh,
    };
  },
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getSixMonthMedicineStock: mocks.getSixMonthMedicineStock,
    getParameters: mocks.getParameters,
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage(props: React.ComponentProps<typeof PetitionListPage> = {}, initialEntry = '/petitions') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <PetitionListPage {...props} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionListPage action cues', () => {
  beforeEach(() => {
    mocks.canAccess.mockClear();
    mocks.canAccess.mockImplementation(() => true);
    mocks.getSixMonthMedicineStock.mockClear();
    mocks.user = {
      employeeId: 'E999',
      email: 'admin@example.test',
      name: 'Admin',
      roles: ['admin'],
    };
  });

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

  it('uses a configured destination when a petition row is opened', async () => {
    renderPage({ petitionDetailPath: (petition) => `/petition/${petition._id}` });

    fireEvent.click(await screen.findByText('P-2607-0001'));

    expect(screen.getByTestId('location')).toHaveTextContent('/petition/P-2607-0001');
  });

  it('shows the new petition button for viewer users who can open the canonical form', async () => {
    mocks.user = {
      employeeId: 'E777',
      email: 'viewer@example.test',
      name: 'Viewer',
      roles: ['viewer'],
    };
    mocks.canAccess.mockImplementation((path: string) => path === '/petitions/new');

    renderPage();

    const button = await screen.findByRole('button', { name: 'ยื่นคำร้องใหม่' });
    expect(button.querySelector('svg')).not.toBeNull();

    fireEvent.click(button);

    expect(mocks.canAccess).toHaveBeenCalledWith('/petitions/new');
    expect(screen.getByTestId('location')).toHaveTextContent('/petitions/new');
  });

  it('shows approved petitions as completed instead of final-result wording', async () => {
    renderPage();

    expect(await screen.findByText('P-2607-0007')).toBeInTheDocument();
    expect(screen.getByText('เสร็จสิ้น')).toBeInTheDocument();
    expect(screen.queryByText('ออก Final Result แล้ว')).not.toBeInTheDocument();
  });

  it('shows completed approved petitions to QC head users', async () => {
    mocks.user = {
      employeeId: 'E888',
      email: 'qc-head@example.test',
      name: 'QC Head',
      roles: ['qc-head'],
    };

    renderPage({}, '/petitions?status=approved');

    expect(await screen.findByText('P-2607-0007')).toBeInTheDocument();
    expect(screen.queryByText('ยังไม่มีคำร้องที่คุณยื่นหรือได้รับมอบหมาย')).not.toBeInTheDocument();
  });

  it('keeps summary card counts based on all visible petitions when a status card filters the list', async () => {
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();

    const allCard = screen.getByText('ทั้งหมด').closest('[role="button"]');
    const waitingCard = screen.getByText(/รอตรวจ/).closest('[role="button"]');
    const inProgressCard = screen.getAllByText('กำลังดำเนินการ')[0].closest('[role="button"]');
    const rejectedCard = screen.getAllByText(/ส่งกลับ/)[0].closest('[role="button"]');

    expect(allCard).toHaveTextContent('7');
    expect(waitingCard).toHaveTextContent('1');
    expect(inProgressCard).toHaveTextContent('2');
    expect(rejectedCard).toHaveTextContent('1');

    fireEvent.click(screen.getByText(/รอตรวจ/));

    expect(await screen.findByText('P-2607-0004')).toBeInTheDocument();
    expect(screen.queryByText('P-2607-0001')).not.toBeInTheDocument();
    expect(allCard).toHaveTextContent('7');
    expect(waitingCard).toHaveTextContent('1');
    expect(inProgressCard).toHaveTextContent('2');
    expect(rejectedCard).toHaveTextContent('1');
  });

  it('shows six-month medicine stock rows from the stock API', async () => {
    mocks.user = {
      employeeId: 'E888',
      email: 'qc-head@example.test',
      name: 'QC Head',
      roles: ['qc-head'],
    };
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();

    const petitionsTab = screen.getByRole('tab', { name: 'รายการคำร้อง' });
    const sixMonthMedicineTab = screen.getByRole('tab', { name: 'List ยา 6 เดือน' });

    expect(petitionsTab).toHaveAttribute('aria-selected', 'true');
    expect(sixMonthMedicineTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.mouseDown(sixMonthMedicineTab, { button: 0, ctrlKey: false });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'List ยา 6 เดือน' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('F-TEST-001')).toBeInTheDocument();
      expect(screen.getByText('FG260301-001')).toBeInTheDocument();
      expect(screen.getByText('10 KG')).toBeInTheDocument();
      expect(screen.queryByText('P-2607-0001')).not.toBeInTheDocument();
    });
    expect(mocks.getSixMonthMedicineStock).toHaveBeenCalledTimes(1);
  });

  it('shows the six-month medicine tab for admin users', async () => {
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'List ยา 6 เดือน' })).toBeInTheDocument();
  });

  it('hides the six-month medicine tab for users without admin or QC head', async () => {
    mocks.user = {
      employeeId: 'E889',
      email: 'qc-staff@example.test',
      name: 'QC Staff',
      roles: ['qc-staff'],
    };
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'List ยา 6 เดือน' })).not.toBeInTheDocument();
    expect(mocks.getSixMonthMedicineStock).not.toHaveBeenCalled();
  });

  it('uses production petition_no query as the list search term', async () => {
    renderPage({}, '/petitions?petition_no=P-2607-0003');

    expect(await screen.findByText('P-2607-0003')).toBeInTheDocument();
    expect(screen.queryByText('P-2607-0001')).not.toBeInTheDocument();
  });

  it('filters the list as soon as the search field changes', async () => {
    renderPage();

    expect(await screen.findByText('P-2607-0001')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'P-2607-0004' },
    });

    await waitFor(() => {
      expect(screen.getByText('P-2607-0004')).toBeInTheDocument();
      expect(screen.queryByText('P-2607-0001')).not.toBeInTheDocument();
    });
  });
});
