import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PetitionListPage from './PetitionListPage';
import type { Petition } from '@/types/petition.types';

const ADMIN_USER = {
  employeeId: 'E999',
  email: 'admin@example.test',
  name: 'Admin',
  roles: ['admin'],
};

const mocks = vi.hoisted(() => ({
  getParameters: vi.fn().mockResolvedValue([]),
  push: vi.fn(),
  refresh: vi.fn(),
  user: {
    employeeId: 'E999',
    email: 'admin@example.test',
    name: 'Admin',
    roles: ['admin'],
  } as { employeeId: string; email: string; name: string; roles: string[] },
}));

vi.mock('@/components/lis/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
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
    mocks.user = ADMIN_USER;
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

  // Finding 4: the pinned highlight group must run through the same visibility
  // rule (canSeePetition) the main list applies for non-admin users — otherwise a
  // shared/bookmarked ?highlight= URL leaks full petition cards outside a user's
  // scope. Two petitions come back from the ?ids= fetch: one the user submitted
  // (visible) and one submitted by someone else with no lab/qc/assignment tie to
  // the user (must be filtered out), same as ownedItems does for the main list.
  it('filters the highlighted group through the same visibility rule as the main list for a non-admin user', async () => {
    mocks.user = {
      employeeId: 'E777',
      email: 'production@example.test',
      name: 'สมหญิง',
      roles: ['production'],
    };
    const ownPetition = highlightedPetition({
      _id: 'x1',
      petitionNo: 'P-OWN',
      status: 'inProgress',
      submittedBy: { employeeId: 'E777', name: 'สมหญิง', submittedAt: '2026-07-13T00:00:00.000Z' },
    });
    const otherPetition = highlightedPetition({
      _id: 'x2',
      petitionNo: 'P-OTHER',
      status: 'inProgress',
      submittedBy: { employeeId: 'E001', name: 'คนอื่น', submittedAt: '2026-07-13T00:00:00.000Z' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [ownPetition, otherPetition], total: 2 }),
      }),
    );

    renderPage('/petitions?highlight=x1,x2');

    // Waiting for the user's own petition to appear proves the async ?ids= fetch
    // has resolved and the highlight group re-rendered — only then is the absence
    // check below conclusive rather than a false negative from an unresolved fetch.
    expect(await screen.findByText('P-OWN')).toBeInTheDocument();
    expect(screen.queryByText('P-OTHER')).not.toBeInTheDocument();
  });
});
