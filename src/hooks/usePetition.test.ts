import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePetitionList } from './usePetition';

function mockFetchOk() {
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => ({ items: [], total: 0, page: 1, limit: 100 }),
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('usePetitionList auto-refetch', () => {
  let fetchMock: ReturnType<typeof mockFetchOk>;

  beforeEach(() => {
    fetchMock = mockFetchOk();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('refetches when the window regains focus (opt-in)', async () => {
    const { result } = renderHook(() =>
      usePetitionList({ page: 1, limit: 100, status: 'sampleSent' }, { refetchOnFocus: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const afterMount = fetchMock.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(afterMount));
  });

  it('refetches when the tab becomes visible again (opt-in)', async () => {
    const { result } = renderHook(() =>
      usePetitionList({ page: 1, limit: 100, status: 'sampleSent' }, { refetchOnFocus: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const afterMount = fetchMock.mock.calls.length;

    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(afterMount));
  });

  it('does NOT refetch on focus by default (no opt-in)', async () => {
    const { result } = renderHook(() =>
      usePetitionList({ page: 1, limit: 100, status: 'sampleSent' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const afterMount = fetchMock.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock.mock.calls.length).toBe(afterMount);
  });
});
