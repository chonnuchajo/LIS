import { beforeEach, describe, it, expect, vi } from 'vitest';
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
  beforeEach(() => {
    vi.mocked(api.triggerDensitySync).mockClear();
    vi.mocked(api.getResultDensitiesByBatch).mockResolvedValue({ batch: '009', docs: [] });
  });

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

  it('applies only checked density rows', async () => {
    const docs = [
      { _id: 'a', 'Sample name': 'Batch 009 A', 'Density [g/cm³]': '0.991', 'T (block) [°C]': '30.0' },
      { _id: 'b', 'Sample name': 'Batch 009 B', 'Density [g/cm³]': '0.992', 'T (block) [°C]': '30.0' },
    ];
    vi.mocked(api.getResultDensitiesByBatch).mockResolvedValue({ batch: '009', docs });
    const onRows = vi.fn();

    renderWith({ onRows });
    fireEvent.click(screen.getByRole('button', { name: /ดึงค่า ถพ\./ }));

    const boxes = await screen.findAllByRole('checkbox');
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /ใช้ค่าที่เลือก/ }));

    expect(onRows).toHaveBeenCalledWith([docs[0]]);
  });
});
