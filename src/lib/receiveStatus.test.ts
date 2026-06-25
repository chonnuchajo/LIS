import { describe, it, expect } from 'vitest';
import { isLegacyReceived, labReceivedAt, labReceivedBy, qcReceivedAt, qcReceivedBy, labTrackStatusBadge } from './receiveStatus';

const T1 = '2026-06-08T01:00:00.000Z';
const T2 = '2026-06-10T02:00:00.000Z';

describe('receiveStatus', () => {
  it('legacy petition (receivedBy only) counts as received on both sides', () => {
    const p = { receivedAt: T1, receivedBy: 'Dev Administrator' };
    expect(isLegacyReceived(p)).toBe(true);
    expect(qcReceivedAt(p)).toBe(T1);
    expect(qcReceivedBy(p)).toBe('Dev Administrator');
    expect(labReceivedAt(p)).toBe(T1);
    expect(labReceivedBy(p)).toBe('Dev Administrator');
  });

  it('never received → all null/undefined', () => {
    const p = {};
    expect(isLegacyReceived(p)).toBe(false);
    expect(qcReceivedAt(p)).toBeNull();
    expect(qcReceivedBy(p)).toBeUndefined();
    expect(labReceivedAt(p)).toBeNull();
    expect(labReceivedBy(p)).toBeUndefined();
  });

  it('mixed: Lab received first does NOT mark QC received (no legacy fallback)', () => {
    const p = { labReceivedAt: T1, labReceivedBy: 'Lab Tech', receivedAt: T1, receivedBy: 'Lab Tech' };
    expect(isLegacyReceived(p)).toBe(false);
    expect(labReceivedBy(p)).toBe('Lab Tech');
    expect(qcReceivedAt(p)).toBeNull();
    expect(qcReceivedBy(p)).toBeUndefined();
  });

  it('both sides received independently keep their own actor', () => {
    const p = {
      labReceivedAt: T1, labReceivedBy: 'Lab Tech',
      qcReceivedAt: T2, qcReceivedBy: 'QC Tech',
      receivedAt: T1, receivedBy: 'Lab Tech',
    };
    expect(labReceivedBy(p)).toBe('Lab Tech');
    expect(qcReceivedBy(p)).toBe('QC Tech');
    expect(qcReceivedAt(p)).toBe(T2);
  });
});

describe('labTrackStatusBadge', () => {
  it('QC received + testing but Lab not received yet → "รอรับ" (Lab track, not QC status)', () => {
    const p = { status: 'inProgress' as const, qcReceivedAt: T1, qcReceivedBy: 'QC Tech' };
    expect(labTrackStatusBadge(p).label).toBe('รอรับ');
  });

  it('still waiting to receive when global status already sampleSent', () => {
    const p = { status: 'sampleSent' as const };
    expect(labTrackStatusBadge(p).label).toBe('รอรับ');
  });

  it('Lab received → falls back to the petition status badge', () => {
    const p = { status: 'inProgress' as const, labReceivedAt: T1, labReceivedBy: 'Lab Tech' };
    expect(labTrackStatusBadge(p).label).toBe('QC กำลังตรวจ');
  });

  it('legacy received (receivedAt only) counts as Lab received → petition status badge', () => {
    const p = { status: 'inProgress' as const, receivedAt: T1, receivedBy: 'Dev Administrator' };
    expect(labTrackStatusBadge(p).label).toBe('QC กำลังตรวจ');
  });
});
