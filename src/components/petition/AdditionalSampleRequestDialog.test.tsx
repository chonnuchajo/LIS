import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Petition } from '@/types/petition.types';
import AdditionalSampleRequestDialog from './AdditionalSampleRequestDialog';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

const petition: Petition = {
  _id: 'petition-1', petitionNo: 'LIS-001', dept: 'production', status: 'inProgress',
  submittedBy: { name: 'ผู้ยื่น', submittedAt: '2026-09-19T01:00:00Z' },
  items: [{ seq: 1, sampleName: 'ตัวอย่าง A', batchNo: '1231' }, { seq: 2, sampleName: 'ตัวอย่าง B', batchNo: '1232' }],
  createdAt: '2026-09-19T01:00:00Z', updatedAt: '2026-09-19T01:00:00Z',
};
const showDialog = (beforeSubmit = vi.fn().mockResolvedValue(undefined), data = petition) => {
  const onRequested = vi.fn();
  const onOpenChange = vi.fn();
  render(<AdditionalSampleRequestDialog petition={data} side="qc" items={data.items} open onOpenChange={onOpenChange} beforeSubmit={beforeSubmit} onRequested={onRequested} />);
  return { beforeSubmit, onRequested, onOpenChange };
};
const selectItem = () => fireEvent.click(screen.getByRole('checkbox', { name: /ตัวอย่าง A/ }));
const enterReason = () => fireEvent.change(screen.getByLabelText('เหตุผลที่ขอตัวอย่างเพิ่ม'), { target: { value: ' ค่าสูงกว่าเกณฑ์ ' } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'ส่งคำขอ' }));

describe('AdditionalSampleRequestDialog', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('requires a reason, selection and positive quantity before posting', async () => {
    showDialog();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผล');
    enterReason();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('เลือกรายการ');
    selectItem();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'จำนวนรายการที่ 1' }), { target: { value: '0' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('จำนวนเต็ม 1–1000');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('waits for autosaves, posts selected items only and returns the updated petition', async () => {
    let finish: () => void = () => {};
    const beforeSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const updated = { ...petition, additionalSampleRequests: [{ _id: 'round-1' }] };
    vi.mocked(api.post).mockResolvedValue({ data: { data: updated } });
    const handlers = showDialog(beforeSubmit);
    enterReason();
    selectItem();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'จำนวนรายการที่ 1' }), { target: { value: '2' } });
    submit();
    expect(screen.getByRole('button', { name: /กำลังส่ง/ })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(handlers.onRequested).toHaveBeenCalledWith(updated));
    expect(api.post).toHaveBeenCalledWith('/petitions/petition-1/additional-samples', { side: 'qc', reason: 'ค่าสูงกว่าเกณฑ์', items: [{ itemSeq: 1, quantity: 2 }] });
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('retains reason and selection with an API error so the user can retry', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('ส่งคำขอไม่สำเร็จ: เครือข่ายขัดข้อง'));
    const handlers = showDialog();
    enterReason();
    selectItem();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('เครือข่ายขัดข้อง');
    expect(screen.getByLabelText('เหตุผลที่ขอตัวอย่างเพิ่ม')).toHaveValue(' ค่าสูงกว่าเกณฑ์ ');
    expect(screen.getByRole('checkbox', { name: /ตัวอย่าง A/ })).toBeChecked();
    expect(handlers.onRequested).not.toHaveBeenCalled();
    expect(handlers.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ส่งคำขอ' })).toBeEnabled();
  });

  it('shows failed autosaves and does not create a request', async () => {
    showDialog(vi.fn().mockRejectedValue(new Error('บันทึกผลไม่สำเร็จ')));
    enterReason();
    selectItem();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('บันทึกผลไม่สำเร็จ');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows notification warnings without treating a saved request as a failed creation', async () => {
    const updated = { ...petition, additionalSampleNotificationWarning: 'บันทึกแล้ว แต่แจ้งเตือน LINE ไม่สำเร็จ' };
    vi.mocked(api.post).mockResolvedValue({ data: { data: updated } });
    const handlers = showDialog();
    enterReason();
    selectItem();
    submit();
    await waitFor(() => expect(handlers.onRequested).toHaveBeenCalledWith(updated));
    expect(toast.warning).toHaveBeenCalledWith('บันทึกแล้ว แต่แจ้งเตือน LINE ไม่สำเร็จ');
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks duplicate requests while the same side waits for receipt', () => {
    showDialog(undefined, { ...petition, additionalSampleRequests: [{
      _id: 'pending', qrCode: 'QR', side: 'qc', status: 'requested', reason: 'ขอเพิ่ม',
      items: [{ itemSeq: 1, quantity: 1 }], requestedAt: '2026-09-19T01:00:00Z', requestedBy: { name: 'ผู้ตรวจ' },
    }] });
    expect(screen.getByRole('button', { name: 'ส่งคำขอ' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('รอรับตัวอย่างเพิ่ม');
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each(['1.5', '1001', '-1', ''])('rejects an invalid quantity %s before posting', async (quantity) => {
    showDialog();
    enterReason();
    selectItem();
    const input = screen.getByRole('spinbutton', { name: 'จำนวนรายการที่ 1' });
    fireEvent.change(input, { target: { value: quantity } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('จำนวนเต็ม 1–1000');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '1000');
    expect(input).toHaveAttribute('step', '1');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects reasons longer than 2000 characters without losing the draft', async () => {
    showDialog();
    selectItem();
    const reason = 'ก'.repeat(2001);
    fireEvent.change(screen.getByLabelText('เหตุผลที่ขอตัวอย่างเพิ่ม'), { target: { value: reason } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่เกิน 2000');
    expect(screen.getByLabelText('เหตุผลที่ขอตัวอย่างเพิ่ม')).toHaveValue(reason);
    expect(screen.getByLabelText('เหตุผลที่ขอตัวอย่างเพิ่ม')).toHaveAttribute('maxlength', '2000');
    expect(api.post).not.toHaveBeenCalled();
  });
});
