import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DensitySyncButton from './DensitySyncButton';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    triggerDensitySync: vi.fn().mockResolvedValue({ triggered: true }),
    getResultDensitiesByBatch: vi.fn().mockResolvedValue({ batch: '009', docs: [] }),
  },
}));

function renderWith(props: Partial<React.ComponentProps<typeof DensitySyncButton>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DensitySyncButton batchNo="009" hasHandTyped={false} onRows={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('DensitySyncButton', () => {
  it('renders the sync button', () => {
    renderWith();
    expect(screen.getByRole('button', { name: /ดึงค่า ถพ\./ })).toBeInTheDocument();
  });
  it('is disabled when batchNo is empty', () => {
    renderWith({ batchNo: '' });
    expect(screen.getByRole('button', { name: /ดึงค่า ถพ\./ })).toBeDisabled();
  });
  it('fires the density sync webhook on click', async () => {
    renderWith();
    fireEvent.click(screen.getByRole('button', { name: /ดึงค่า ถพ\./ }));
    await waitFor(() => expect(api.triggerDensitySync).toHaveBeenCalledTimes(1));
  });
});
