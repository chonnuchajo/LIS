import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  // The paginated list is empty in most tests here — this file exercises the separate
  // ?ids= fetch that feeds the dashboard highlight. One test fills it to prove a petition
  // present in both places is not rendered twice.
  listItems: [] as Petition[],
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

vi.mock('@/hooks/usePetition', () => ({
  usePetitionList: () => ({
    data: { items: mocks.listItems, total: mocks.listItems.length },
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

function stubIdsFetch(items: Petition[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items, total: items.length }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PetitionListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionListPage highlight', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    mocks.user = ADMIN_USER;
    mocks.listItems = [];
  });

  it('drops the highlighted petition into the top of the list as an ordinary card', async () => {
    const fetchMock = stubIdsFetch([highlightedPetition()]);

    renderPage('/petitions?highlight=x1');

    expect(await screen.findByText('P-HL')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api/petitions?ids=x1'),
      expect.any(Object),
    );
    // No separate pinned box hovering above the list any more — just the card.
    expect(screen.queryByText(/ไฮไลท์ \d+ รายการจากแดชบอร์ด/)).not.toBeInTheDocument();
    expect(screen.queryByText('ล้างไฮไลท์')).not.toBeInTheDocument();
  });

  it('renders a highlighted petition once even when the current page already holds it', async () => {
    mocks.listItems = [highlightedPetition(), highlightedPetition({ _id: 'x2', petitionNo: 'P-OTHER' })];
    stubIdsFetch([highlightedPetition()]);

    renderPage('/petitions?highlight=x1');

    expect(await screen.findByText('P-OTHER')).toBeInTheDocument();
    expect(screen.getAllByText('P-HL')).toHaveLength(1);
  });

  it('fades the highlight after five seconds and leaves an ordinary card behind', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubIdsFetch([highlightedPetition()]);

    renderPage('/petitions?highlight=x1');

    expect(await screen.findByText('P-HL')).toBeInTheDocument();
    expect(document.querySelector('[data-highlight="on"]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(document.querySelector('[data-highlight="on"]')).toBeNull();
    expect(screen.getByText('P-HL')).toBeInTheDocument();
  });

  it('shows no highlighted card when the param is absent', () => {
    renderPage('/petitions');
    expect(document.querySelector('[data-highlight="on"]')).toBeNull();
  });

  // A shared or bookmarked ?highlight= URL must not hand a non-admin user a petition
  // outside their scope: the highlighted set runs through the same canSeePetition rule
  // the paginated list applies. Two petitions come back from the ?ids= fetch — one the
  // user submitted, one with no lab/qc/assignment tie to them.
  it('filters the highlighted petitions through the same visibility rule as the main list', async () => {
    mocks.user = {
      employeeId: 'E777',
      email: 'production@example.test',
      name: 'สมหญิง',
      roles: ['production'],
    };
    stubIdsFetch([
      highlightedPetition({
        _id: 'x1',
        petitionNo: 'P-OWN',
        submittedBy: { employeeId: 'E777', name: 'สมหญิง', submittedAt: '2026-07-13T00:00:00.000Z' },
      }),
      highlightedPetition({
        _id: 'x2',
        petitionNo: 'P-OTHER',
        submittedBy: { employeeId: 'E001', name: 'คนอื่น', submittedAt: '2026-07-13T00:00:00.000Z' },
      }),
    ]);

    renderPage('/petitions?highlight=x1,x2');

    // Waiting for the user's own petition proves the ?ids= fetch resolved and the list
    // re-rendered — only then is the absence check below conclusive.
    expect(await screen.findByText('P-OWN')).toBeInTheDocument();
    expect(screen.queryByText('P-OTHER')).not.toBeInTheDocument();
  });
});
