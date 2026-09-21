import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Petition, AdditionalSampleRequest } from '@/types/petition.types';
import AdditionalSamplePrintTemplate from '../AdditionalSamplePrintTemplate';
import AdditionalSampleRequests from '../AdditionalSampleRequests';
import SampleLabelPrintTemplate from '../SampleLabelPrintTemplate';

const auth = vi.hoisted(() => ({ user: { name: 'Requester', employeeId: 'EMP-1', email: 'owner@test', role: 'viewer' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/components/lis/PrintPreviewDialog', () => ({ default: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div role="dialog">{children}</div> : null }));

const request: AdditionalSampleRequest = {
  _id: 'round-1', qrCode: 'LIS-EXTRA-11111111-1111-4111-8111-111111111111', side: 'qc',
  reason: 'ตัวอย่างไม่พอ', items: [{ itemSeq: 2, quantity: 2 }], status: 'requested',
  requestedAt: '2026-09-19T01:00:00Z', requestedBy: { name: 'QC Reviewer' },
  previousResults: [{ petitionId: 'petition-1', itemSeq: 2, parameterId: 'ph', parameterName: 'pH', values: { pH: 15 }, enteredAt: '2026-09-18T01:00:00Z' }],
};
const petition: Petition = {
  _id: 'petition-1', petitionNo: 'P-2609-0001', dept: 'production', status: 'inProgress',
  submittedBy: { employeeId: 'EMP-1', name: 'Requester', submittedAt: '2026-09-18T01:00:00Z' },
  items: [{ seq: 1, sampleName: 'Original item', batchNo: '', sampleQuantity: 4 }, { seq: 2, sampleName: 'Selected item', batchNo: '', sampleQuantity: 5 }],
  createdAt: '2026-09-18T01:00:00Z', updatedAt: '2026-09-19T01:00:00Z', additionalSampleRequests: [request],
};

beforeEach(() => { auth.user.role = 'viewer'; auth.user.employeeId = 'EMP-1'; });

describe('additional sample printing and history', () => {
  it('prints only selected items, quantity, reason, side, round and stable server QR', () => {
    const original = JSON.stringify(petition);
    const { rerender } = render(<AdditionalSamplePrintTemplate petition={petition} request={request} />);
    expect(screen.getByText('ใบนำส่งตัวอย่างเพิ่ม')).toBeInTheDocument();
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(screen.queryByText('Original item')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('ตัวอย่างไม่พอ')).toBeInTheDocument();
    expect(screen.getByText(/QC.*รอบ 1/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR ' + request.qrCode })).toBeInTheDocument();
    rerender(<AdditionalSamplePrintTemplate petition={petition} request={request} />);
    expect(screen.getByRole('img', { name: 'QR ' + request.qrCode })).toBeInTheDocument();
    const next = { ...request, _id: 'round-2', qrCode: 'LIS-EXTRA-22222222-2222-4222-8222-222222222222' };
    rerender(<AdditionalSamplePrintTemplate petition={{ ...petition, additionalSampleRequests: [request, next] }} request={next} />);
    expect(screen.getByRole('img', { name: 'QR ' + next.qrCode })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR ' + request.qrCode })).not.toBeInTheDocument();
    expect(JSON.stringify(petition)).toBe(original);
  });

  it('prints one label per selected weight without changing original labels', () => {
    const weightedRequest = { ...request, items: [{ itemSeq: 2, quantity: 2, weights: [100, 500] }] };
    const { container, rerender } = render(<SampleLabelPrintTemplate petition={petition} additionalSampleRequest={weightedRequest} />);
    expect(container.querySelectorAll('.label-card')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'QR ' + request.qrCode })).toHaveLength(2);
    expect(screen.getByText('100 g')).toBeInTheDocument();
    expect(screen.getByText('500 g')).toBeInTheDocument();
    expect(screen.queryByText(/ชุดที่/)).not.toBeInTheDocument();
    expect(screen.queryByText('Original item')).not.toBeInTheDocument();
    rerender(<SampleLabelPrintTemplate petition={petition} />);
    expect(container.querySelectorAll('.label-card')).toHaveLength(9);
    expect(screen.queryByRole('img', { name: 'QR ' + request.qrCode })).not.toBeInTheDocument();
  });

  it('prints one legacy label when old quantity stores weight 500', () => {
    const legacyRequest = { ...request, items: [{ itemSeq: 2, quantity: 500 }] };
    const { container } = render(<SampleLabelPrintTemplate petition={petition} additionalSampleRequest={legacyRequest} />);
    expect(container.querySelectorAll('.label-card')).toHaveLength(1);
    expect(screen.getByText('500 g')).toBeInTheDocument();
  });

  it('keeps each item weight on its own label without mutating original per-copy quantities', () => {
    const weightedPetition = { ...petition, items: petition.items.map((item) => ({ ...item, labelQuantity: 'old weight', labelQuantities: ['old copy weight'] })) };
    const original = JSON.stringify(weightedPetition);
    const weightedRequest = { ...request, items: [{ itemSeq: 1, quantity: 1, weights: [250] }, { itemSeq: 2, quantity: 1, weights: [500] }] };
    const { container } = render(<SampleLabelPrintTemplate petition={weightedPetition} additionalSampleRequest={weightedRequest} />);
    const labels = container.querySelectorAll<HTMLElement>('.label-card');
    expect(labels).toHaveLength(2);
    expect(within(labels[0]).getByText('Original item')).toBeInTheDocument();
    expect(within(labels[0]).getByText('250 g')).toBeInTheDocument();
    expect(within(labels[1]).getByText('Selected item')).toBeInTheDocument();
    expect(within(labels[1]).getByText('500 g')).toBeInTheDocument();
    expect(screen.queryByText(/old.*weight/)).not.toBeInTheDocument();
    expect(JSON.stringify(weightedPetition)).toBe(original);
  });

  it('shows the selected weights in request history rather than their sum as a sample count', () => {
    render(<AdditionalSampleRequests petition={{ ...petition, additionalSampleRequests: [{ ...request, items: [{ itemSeq: 2, quantity: 2, weights: [100, 500] }] }] }} />);
    expect(screen.getByText(/2 ตัวอย่าง · น้ำหนัก 100 กรัม, 500 กรัม/)).toBeInTheDocument();
  });

  it('requester sees pending request, print actions and timestamps, not restricted snapshots', () => {
    render(<AdditionalSampleRequests petition={petition} />);
    expect(screen.getByText('รอนำส่ง')).toBeInTheDocument();
    expect(screen.getByText(/ขอเพิ่มเมื่อ/)).toBeInTheDocument();
    expect(screen.getByText(/นำส่งเมื่อ/)).toBeInTheDocument();
    expect(screen.getByText(/รับเมื่อ/)).toBeInTheDocument();
    expect(screen.queryByText('pH')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'พิมพ์ใบนำส่งตัวอย่างเพิ่ม' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'พิมพ์ฉลากตัวอย่างเพิ่ม' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR ' + request.qrCode })).toBeInTheDocument();
  });

  it('same display name never grants print actions; QC staff can read value snapshots without standards', () => {
    auth.user.employeeId = 'OTHER'; auth.user.role = 'qc-staff';
    render(<AdditionalSampleRequests petition={petition} />);
    expect(screen.queryByRole('button', { name: 'พิมพ์ใบนำส่งตัวอย่างเพิ่ม' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'พิมพ์ฉลากตัวอย่างเพิ่ม' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('ผลก่อนขอเพิ่ม (สำเนา)'));
    expect(screen.getAllByText('pH')).toHaveLength(2);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText(/เกณฑ์มาตรฐาน/)).not.toBeInTheDocument();
  });
});
