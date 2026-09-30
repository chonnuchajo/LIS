import { describe, expect, it, vi } from 'vitest';
import type { AdditionalSampleRequest, Petition, QCTestResult } from '@/types/petition.types';
import { createResultAutosaveQueue, currentSampleResults, pendingAdditionalSample, sampleRoundIdFor } from './additionalSamples';

const request = (overrides: Partial<AdditionalSampleRequest> = {}): AdditionalSampleRequest => ({
  _id: 'round-qc', qrCode: 'QR-QC', side: 'qc', reason: 'ค่าผิดปกติ',
  items: [{ itemSeq: 1, quantity: 2 }], requestedAt: '2026-09-19T01:00:00Z',
  requestedBy: { name: 'ผู้ตรวจ' }, status: 'received', ...overrides,
});
const petition = (requests: AdditionalSampleRequest[]) => ({ additionalSampleRequests: requests } as Petition);
const result = (itemSeq: number, parameterId: string, sampleRoundId?: string): QCTestResult => ({
  petitionId: 'petition-1', itemSeq, parameterId, sampleRoundId, values: { value: 99 },
  valuesPhase2: { value: 98 }, entries: [{ value: 97 }],
});

describe('additional sample rounds', () => {
  it('locks only the side with an unreceived request', () => {
    const data = petition([request({ status: 'sent' })]);
    expect(pendingAdditionalSample(data, 'qc')?._id).toBe('round-qc');
    expect(pendingAdditionalSample(data, 'lab')).toBeUndefined();
    expect(pendingAdditionalSample(petition([request()]), 'qc')).toBeUndefined();
  });

  it('uses the latest received round for each side and item, not a pending round', () => {
    const data = petition([
      request(),
      request({ _id: 'latest', requestedAt: '2026-09-19T00:00:00Z' }),
      request({ _id: 'next', status: 'requested', requestedAt: '2026-09-19T04:00:00Z' }),
      request({ _id: 'lab-round', side: 'lab' }),
    ]);
    expect(sampleRoundIdFor(data, 'qc', 1)).toBe('latest');
    expect(sampleRoundIdFor(data, 'lab', 1)).toBe('lab-round');
    expect(sampleRoundIdFor(data, 'qc', 2)).toBeUndefined();
  });

  it('drops every old value container for requested items without changing other items or sides', () => {
    const data = petition([request()]);
    const rows = [result(1, 'qc'), result(1, 'qc', 'older'), result(1, 'qc', 'round-qc'), result(2, 'qc'), result(1, 'lab')];
    expect(currentSampleResults(data, rows, [{ _id: 'qc', scope: 'qc' }, { _id: 'lab', scope: 'lab' }])).toEqual([rows[2], rows[3], rows[4]]);
  });

  it('keeps original-round results with either an absent or empty sampleRoundId', () => {
    const rows = [result(1, 'qc'), result(2, 'qc', '')];
    expect(currentSampleResults(petition([]), rows, [{ _id: 'qc', scope: 'qc' }])).toEqual(rows);
  });
});

describe('result autosave barrier', () => {
  it('flushes debounced changes and awaits an in-flight save before continuing', async () => {
    const queue = createResultAutosaveQueue();
    const events: string[] = [];
    let finish: () => void = () => {};
    const saving = queue.run('entries', () => new Promise<void>((resolve) => { finish = resolve; }));
    queue.schedule('value', async () => { events.push('saved'); });
    const barrier = queue.flush().then(() => { events.push('request'); });
    await vi.waitFor(() => expect(events).toEqual(['saved']));
    finish();
    await Promise.all([saving, barrier]);
    expect(events).toEqual(['saved', 'request']);
  });

  it('keeps only the last debounced value and serializes in-flight writes of the same field', async () => {
    const queue = createResultAutosaveQueue();
    const values: number[] = [];
    let finish: () => void = () => {};
    const saving = queue.run('field', () => new Promise<void>((resolve) => { finish = () => { values.push(1); resolve(); }; }));
    queue.schedule('field', async () => { values.push(2); });
    queue.schedule('field', async () => { values.push(3); });
    const barrier = queue.flush();
    await Promise.resolve();
    expect(values).toEqual([]);
    finish();
    await Promise.all([saving, barrier]);
    expect(values).toEqual([1, 3]);
  });

  it('blocks request creation after a failed save until that field saves successfully', async () => {
    const queue = createResultAutosaveQueue();
    queue.schedule('field', async () => { throw new Error('offline'); });
    await expect(queue.flush()).rejects.toThrow('บันทึกผลไม่สำเร็จ');
    await expect(queue.flush()).rejects.toThrow('บันทึกผลไม่สำเร็จ');
    queue.schedule('field', async () => {});
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it('serializes different fields of the same parameter when creating its first round result', async () => {
    const queue = createResultAutosaveQueue();
    const events: string[] = [];
    let finish: () => void = () => {};
    queue.schedule('field-a', () => new Promise<void>((resolve) => { finish = () => { events.push('a'); resolve(); }; }), 'parameter');
    queue.schedule('field-b', async () => { events.push('b'); }, 'parameter');
    const barrier = queue.flush();
    await Promise.resolve();
    expect(events).toEqual([]);
    finish();
    await barrier;
    expect(events).toEqual(['a', 'b']);
  });
});
