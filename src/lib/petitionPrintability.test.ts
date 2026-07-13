import { describe, it, expect } from 'vitest';
import { canPrintSampleLabel, canPrintPreReport } from './petitionPrintability';
import type { PetitionStatus } from '@/types/petition.types';

const pet = (over: Partial<Parameters<typeof canPrintSampleLabel>[0]> = {}) => ({
  status: 'deliveringQC' as PetitionStatus,
  ...over,
});

describe('canPrintSampleLabel', () => {
  it('พิมพ์ได้ตอนคำร้องยังไม่ถึงมือ QC/Lab', () => {
    expect(canPrintSampleLabel(pet())).toBe(true);
    expect(canPrintSampleLabel(pet({ status: 'sampleSent' }))).toBe(true);
  });

  it('พิมพ์ไม่ได้เมื่อ QC รับตัวอย่างแล้ว', () => {
    expect(canPrintSampleLabel(pet({ status: 'pendingReview', qcReceivedBy: 'สมชาย' }))).toBe(false);
  });

  it('พิมพ์ไม่ได้เมื่อ Lab รับตัวอย่างแล้ว', () => {
    expect(canPrintSampleLabel(pet({ status: 'pendingReview', labReceivedBy: 'สมหญิง' }))).toBe(false);
  });

  it('ไม่นับชื่อผู้รับที่เป็นค่าว่าง/ช่องว่าง', () => {
    expect(canPrintSampleLabel(pet({ qcReceivedBy: '', labReceivedBy: '  ' }))).toBe(true);
  });
});

describe('canPrintPreReport', () => {
  it('พิมพ์ได้ทุกสถานะก่อนหัวหน้า QC ออก Final Result', () => {
    for (const status of ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress', 'success', 'rejected'] as PetitionStatus[]) {
      expect(canPrintPreReport(pet({ status }))).toBe(true);
    }
  });

  it('พิมพ์ไม่ได้เมื่อหัวหน้า QC ออก Final Result แล้ว (ใช้ Final Report แทน)', () => {
    expect(canPrintPreReport(pet({ status: 'approved' }))).toBe(false);
  });
});
