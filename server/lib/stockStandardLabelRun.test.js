jest.mock('../models/StockStandardLabelCounter', () => ({
  findOneAndUpdate: jest.fn(),
}));

const Counter = require('../models/StockStandardLabelCounter');
const { buildStandardLabelRunBackfill, formatStandardLabelRun, isCurrentStandardUnit, nextStandardLabelRun } = require('./stockStandardLabelRun');

describe('stockStandardLabelRun', () => {
  beforeEach(() => {
    Counter.findOneAndUpdate.mockReset();
  });

  test('formats standard label receive runs as two digits plus Gregorian year', () => {
    expect(formatStandardLabelRun(1, 2026)).toBe('01/2026');
    expect(formatStandardLabelRun(12, 2026)).toBe('12/2026');
    expect(formatStandardLabelRun(123, 2026)).toBe('123/2026');
  });

  test('rejects invalid sequence or year', () => {
    expect(() => formatStandardLabelRun(0, 2026)).toThrow('positive integer');
    expect(() => formatStandardLabelRun(1, 1999)).toThrow('Gregorian year');
  });





  test('detects only currently usable standard units', () => {
    const now = new Date('2026-08-20T00:00:00.000Z');

    expect(isCurrentStandardUnit({ status: 'active', volume: { remaining: 10 }, exp: '2026-08-21' }, now)).toBe(true);
    expect(isCurrentStandardUnit({ status: 'empty', volume: { remaining: 10 }, exp: '2026-08-21' }, now)).toBe(false);
    expect(isCurrentStandardUnit({ status: 'active', volume: { remaining: 0 }, exp: '2026-08-21' }, now)).toBe(false);
    expect(isCurrentStandardUnit({ status: 'active', volume: { remaining: 10 }, exp: '2026-08-19' }, now)).toBe(false);
  });

  test('assigns one annual run per receive batch for existing units', () => {
    const units = [
      { _id: '65aa00000000000000000001', qrId: 'u_1', receivedDate: '2026-01-05T01:00:00.000Z' },
      { _id: '65aa00000000000000000002', qrId: 'u_2', receivedDate: '2026-01-05T01:00:00.000Z' },
      { _id: '65aa00000000000000000003', qrId: 'u_3', receivedDate: '2026-02-10T01:00:00.000Z' },
      { _id: '65aa00000000000000000004', qrId: 'u_4', receivedDate: '2027-01-01T01:00:00.000Z' },
    ];

    expect(buildStandardLabelRunBackfill(units).assignments).toEqual([
      expect.objectContaining({ qrId: 'u_1', labelRunNo: 1, labelRunYear: 2026, labelRunLabel: '01/2026' }),
      expect.objectContaining({ qrId: 'u_2', labelRunNo: 1, labelRunYear: 2026, labelRunLabel: '01/2026' }),
      expect.objectContaining({ qrId: 'u_3', labelRunNo: 2, labelRunYear: 2026, labelRunLabel: '02/2026' }),
      expect.objectContaining({ qrId: 'u_4', labelRunNo: 1, labelRunYear: 2027, labelRunLabel: '01/2027' }),
    ]);
  });

  test('continues after existing label runs without overwriting them', () => {
    const units = [
      { _id: '65aa00000000000000000001', qrId: 'newer', receivedDate: '2026-08-01T01:00:00.000Z', labelRunNo: 3, labelRunYear: 2026 },
      { _id: '65aa00000000000000000002', qrId: 'old', receivedDate: '2026-01-05T01:00:00.000Z' },
    ];

    const result = buildStandardLabelRunBackfill(units, { initialSequencesByYear: { 2026: 4 } });

    expect(result.assignments).toEqual([
      expect.objectContaining({ qrId: 'old', labelRunNo: 5, labelRunYear: 2026, labelRunLabel: '05/2026' }),
    ]);
    expect(result.latestSequencesByYear).toEqual({ 2026: 5 });
  });

  test('increments the per-standard yearly counter atomically', async () => {
    const lean = jest.fn().mockResolvedValue({ sequence: 2 });
    Counter.findOneAndUpdate.mockReturnValue({ lean });

    await expect(nextStandardLabelRun('std1', new Date('2026-08-20T00:00:00.000Z'))).resolves.toEqual({
      labelRunNo: 2,
      labelRunYear: 2026,
      labelRunLabel: '02/2026',
    });

    expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
      { standardId: 'std1', year: 2026 },
      { $inc: { sequence: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    expect(lean).toHaveBeenCalled();
  });
});
