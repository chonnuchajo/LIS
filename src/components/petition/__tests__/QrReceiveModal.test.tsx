import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QrReceiveModal from '../QrReceiveModal';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn().mockRejectedValue(new Error('no camera'));
    stop = vi.fn().mockResolvedValue(undefined);
    getState = vi.fn().mockReturnValue(2);
    static getCameras = vi.fn().mockResolvedValue([]);
  },
  Html5QrcodeScannerState: { SCANNING: 2, PAUSED: 3 },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Tester', email: 't@t.com' } }),
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));

import { api } from '@/lib/api';

const qcPetition = {
  _id: 'pet1',
  petitionNo: 'P-2506-0002',
  dept: 'production',
  status: 'sampleSent',
  submittedBy: { name: 'ผู้ส่ง' },
  items: [{ seq: 1, sampleName: 'ตัวอย่าง A' }],
};

function renderModal() {
  return render(
    <MemoryRouter>
      <QrReceiveModal open onClose={() => {}} onReceived={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QrReceiveModal manual entry', () => {
  it('แสดงช่องกรอกเลขที่คำร้องเมื่อไม่มีกล้อง', async () => {
    renderModal();
    expect(
      await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/),
    ).toBeInTheDocument();
  });

  it('พิมพ์เลขที่คำร้องแล้ว submit → เข้าจอ confirm', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: qcPetition },
    });
    renderModal();

    const input = await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/);
    fireEvent.change(input, { target: { value: 'P-2506-0002' } });
    fireEvent.click(screen.getByRole('button', { name: 'รับตัวอย่าง' }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/petitions/scan/P-2506-0002'),
      ),
    );
    expect(await screen.findByText('P-2506-0002')).toBeInTheDocument();
  });
});
