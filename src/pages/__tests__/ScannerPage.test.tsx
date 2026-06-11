import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScannerPage from '../ScannerPage';

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
import { Html5Qrcode } from 'html5-qrcode';

const petition = {
  _id: 'pet1',
  petitionNo: 'P-2506-0003',
  dept: 'production',
  status: 'pending',
  submittedBy: { name: 'ผู้ส่ง' },
  items: [{ seq: 1, sampleName: 'ตัวอย่าง A' }],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ScannerPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (Html5Qrcode as unknown as { getCameras: ReturnType<typeof vi.fn> }).getCameras =
    vi.fn().mockResolvedValue([]);
});

describe('ScannerPage camera failure fallback', () => {
  it('เปิดกล้องไม่ได้ → ยังมีช่องกรอกเลขให้ส่งตัวอย่างต่อได้ (ไม่ค้างหน้า error ทางตัน)', async () => {
    renderPage();
    // เริ่มสแกน → กล้องเปิดไม่ได้
    fireEvent.click(screen.getByRole('button', { name: /สแกน QR Code/ }));

    // ต้อง fallback ไปกรอกเอง ไม่ใช่ขึ้นข้อความ "กรุณาอนุญาตการเข้าถึงกล้อง"
    expect(
      await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/กรุณาอนุญาตการเข้าถึงกล้อง/)).not.toBeInTheDocument();
  });

  it('พิมพ์เลขที่คำร้องแล้ว submit → เข้าจอ confirm', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: petition } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /สแกน QR Code/ }));

    const input = await screen.findByPlaceholderText(/พิมพ์เลขที่คำร้อง/);
    fireEvent.change(input, { target: { value: 'P-2506-0003' } });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/petitions/scan/P-2506-0003'),
      ),
    );
    expect(await screen.findByText('ตรวจสอบคำร้องก่อนยืนยัน')).toBeInTheDocument();
    expect(screen.getAllByText('P-2506-0003').length).toBeGreaterThan(0);
  });
});
