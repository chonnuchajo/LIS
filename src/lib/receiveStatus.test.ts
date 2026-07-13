import { describe, it, expect } from 'vitest';
import {
  isLegacyReceived,
  labReceivedAt,
  labReceivedBy,
  qcReceivedAt,
  qcReceivedBy,
  labTrackStatusBadge,
  qcTrackStatusBadge,
  labTrackStatusSteps,
  qcTrackStatusSteps,
} from './receiveStatus';
import type { Petition } from '@/types/petition.types';

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

  it('sampleSent without assignee shows waiting assign on the Lab track', () => {
    const p = { status: 'sampleSent' as const };
    expect(labTrackStatusBadge(p).label).toBe('รอ assign');
  });

  it('sampleSent with assignee but not Lab-received shows waiting receive on the Lab track', () => {
    const p = { status: 'sampleSent' as const, assignedTo: { userId: 'u1' } };
    expect(labTrackStatusBadge(p).label).toBe('รอรับ');
  });

  it('Lab received + global inProgress → Lab track in progress, not QC status', () => {
    const p = { status: 'inProgress' as const, labReceivedAt: T1, labReceivedBy: 'Lab Tech' };
    expect(labTrackStatusBadge(p).label).toBe('Lab กำลังตรวจ');
  });

  it('legacy received (receivedAt only) counts as Lab received → Lab track in progress', () => {
    const p = { status: 'inProgress' as const, receivedAt: T1, receivedBy: 'Dev Administrator' };
    expect(labTrackStatusBadge(p).label).toBe('Lab กำลังตรวจ');
  });

  it('Lab completed shows Lab completion while petition waits for other gates', () => {
    const p = { status: 'inProgress' as const, labReceivedAt: T1, labCompletedAt: T2 };
    expect(labTrackStatusBadge(p).label).toBe('Lab ตรวจครบ · รอออกผล');
  });
});

describe('qcTrackStatusBadge', () => {
  it('QC not received yet → "รอรับ" even if global status inProgress', () => {
    const p = { status: 'inProgress' as const, labReceivedAt: T1 };
    expect(qcTrackStatusBadge(p).label).toBe('รอรับ');
  });

  it('QC received + global inProgress → "กำลังดำเนินการ"', () => {
    const p = { status: 'inProgress' as const, qcReceivedAt: T1 };
    expect(qcTrackStatusBadge(p).label).toBe('กำลังดำเนินการ');
  });

  it('QC completed while petition still open → "รอ Final Result"', () => {
    const p = { status: 'inProgress' as const, qcReceivedAt: T1, qcCompletedAt: T2 };
    expect(qcTrackStatusBadge(p).label).toBe('รอ Final Result');
  });

  it('approved → config label, no QC-track wording', () => {
    const p = { status: 'approved' as const, qcReceivedAt: T1, qcCompletedAt: T2 };
    expect(qcTrackStatusBadge(p).label).toBe('ออก Final Result แล้ว');
  });

  it('legacy received (receivedAt only) counts as QC received', () => {
    const p = { status: 'inProgress' as const, receivedAt: T1, receivedBy: 'Dev Administrator' };
    expect(qcTrackStatusBadge(p).label).toBe('กำลังดำเนินการ');
  });
});

describe('labTrackStatusSteps', () => {
  it('4 steps in Lab-only order: Assign → รับตัวอย่าง → Lab → ออกผล Lab', () => {
    const steps = labTrackStatusSteps({ status: 'sampleSent' } as Petition);
    expect(steps.map((s) => s.label)).toEqual(['Assign', 'รับตัวอย่าง', 'Lab', 'ออกผล Lab']);
  });

  it('nothing done → assigned is the current step', () => {
    const steps = labTrackStatusSteps({ status: 'sampleSent' } as Petition);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.find((s) => s.current)?.key).toBe('assigned');
  });

  it('assigned but not received → received is the current step', () => {
    const steps = labTrackStatusSteps({
      status: 'sampleSent',
      assignedTo: { userId: 'u1' },
    } as unknown as Petition);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['assigned']);
    expect(steps.find((s) => s.current)?.key).toBe('received');
  });

  it('received + assigned + labCompleted, not approved → lab-approval is current', () => {
    const p = {
      status: 'inProgress',
      labReceivedAt: T1,
      assignedTo: { userId: 'u1' },
      labCompletedAt: T2,
    } as unknown as Petition;
    const steps = labTrackStatusSteps(p);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['assigned', 'received', 'lab']);
    expect(steps.find((s) => s.current)?.key).toBe('lab-approval');
  });

  it('labApprovedAt set → every step done', () => {
    const p = {
      status: 'inProgress',
      labReceivedAt: T1,
      assignedTo: { userId: 'u1' },
      labCompletedAt: T2,
      labApprovedAt: T2,
    } as unknown as Petition;
    expect(labTrackStatusSteps(p).every((s) => s.done)).toBe(true);
  });

  it('rejected: intermediate steps done via closed, but ออกผล Lab stays not-done', () => {
    const steps = labTrackStatusSteps({ status: 'rejected' } as Petition);
    expect(steps.find((s) => s.key === 'received')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'lab-approval')?.done).toBe(false);
  });
});

describe('qcTrackStatusSteps', () => {
  it('4 steps in QC-only order: รับตัวอย่าง → Assign → QC → ออก Final Result', () => {
    const steps = qcTrackStatusSteps({ status: 'sampleSent' } as Petition);
    expect(steps.map((s) => s.label)).toEqual(['รับตัวอย่าง', 'Assign', 'QC', 'ออก Final Result']);
  });

  it('qc completed but not approved → ออก Final Result is current', () => {
    const p = {
      status: 'inProgress',
      qcReceivedAt: T1,
      assignedTo: { userId: 'u1' },
      qcCompletedAt: T2,
    } as unknown as Petition;
    expect(qcTrackStatusSteps(p).find((s) => s.current)?.key).toBe('qc-approval');
  });

  it('approved → every step done including ออก Final Result', () => {
    const p = {
      status: 'approved',
      qcReceivedAt: T1,
      assignedTo: { userId: 'u1' },
      qcCompletedAt: T2,
    } as unknown as Petition;
    expect(qcTrackStatusSteps(p).every((s) => s.done)).toBe(true);
  });
});
