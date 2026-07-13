import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PetitionListPage from './PetitionListPage';
import type { Petition } from '@/types/petition.types';

const mocks = vi.hoisted(() => ({
  getParameters: vi.fn().mockResolvedValue([]),
  push: vi.fn(),
  refresh: vi.fn(),
}));

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

// The paginated list is intentionally empty in every test here — this file only
// exercises the separate ?ids= fetch that feeds the pinned highlight group.
vi.mock('@/hooks/usePetition', () => ({
  usePetitionList: () => ({
    data: { items: [], total: 0 },
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/api', () => ({
  api: { getParameters: mocks.getParameters },
}));

function highlightedPetition(overrides: Partial<Petition> = {}): Petition {
  return {
    _id: 'x1',
    petitionNo: 'P-HL',
    dept: 'fg',
    status: 'inProgress',
    submittedBy: { employeeId: 'E001', name: 'ก', submittedAt: '2026-07-13T00:00:00.000Z' },
    items: [],
    reviewHistory: [],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    ...overrides,
  } as Petition;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderPage(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PetitionListPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionListPage highlight', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pins the highlighted petitions above the paginated list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [highlightedPetition()], total: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage('/petitions?highlight=x1');

    expect(await screen.findByText('P-HL')).toBeInTheDocument();
    expect(screen.getByText(/ไฮไลท์ 1 รายการจากแดชบอร์ด/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api/petitions?ids=x1'),
      expect.any(Object),
    );
  });

  it('shows no highlight banner when the param is absent', () => {
    renderPage('/petitions');
    expect(screen.queryByText(/ไฮไลท์/)).not.toBeInTheDocument();
  });

  it('clears the highlight param and the banner when the clear chip is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [highlightedPetition()], total: 1 }),
      }),
    );

    renderPage('/petitions?highlight=x1');

    expect(await screen.findByText(/ไฮไลท์ 1 รายการจากแดชบอร์ด/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('ล้างไฮไลท์'));

    expect(screen.queryByText(/ไฮไลท์/)).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });
});
