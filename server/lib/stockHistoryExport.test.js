const XLSX = require('xlsx');

const {
  buildSolventRequisitionDoc,
  buildStandardExportDateRange,
  buildStandardLotExportWorkbook,
  createZipBuffer,
} = require('./stockHistoryExport');

function readStoredZipEntry(buffer, targetFilename) {
  let offset = 0;
  while (offset < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    expect(signature).toBe(0x04034b50);
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    expect(compressionMethod).toBe(0);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + filenameLength;
    const filename = buffer.subarray(filenameStart, filenameEnd).toString('utf8');
    const dataStart = filenameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (filename === targetFilename) return buffer.subarray(dataStart, dataEnd).toString('utf8');
    offset = dataEnd;
  }
  throw new Error(`Zip entry not found: ${targetFilename}`);
}

function expectWellFormedXml(xml) {
  const stack = [];
  for (const match of xml.matchAll(/<([^>]+)>/g)) {
    const tag = match[1].trim();
    if (!tag || tag.startsWith('?') || tag.startsWith('!') || tag.endsWith('/')) continue;
    if (tag.startsWith('/')) {
      const closingName = tag.slice(1).trim();
      expect(closingName).not.toMatch(/\/$/);
      expect(stack.pop()).toBe(closingName);
      continue;
    }
    stack.push(tag.split(/\s+/)[0]);
  }
  expect(stack).toEqual([]);
}

describe('stock history export', () => {
  test('creates one standard usage workbook with one sheet per lot', () => {
    const standard = { _id: 'std1', code: 'STD-001', name: 'Pesticide Mix', storageTemp: '2-8°C' };
    const units = [
      { qrId: 'u-a1', lotNo: 'L-A', exp: new Date('2027-01-31T00:00:00.000Z'), volume: { initial: 100, unit: 'mg' } },
      { qrId: 'u_e62fefdb8d1d', lotNo: 'L-A', exp: new Date('2027-01-31T00:00:00.000Z'), volume: { initial: 100, unit: 'mg' } },
      { qrId: 'u-b1', lotNo: 'L-B', exp: new Date('2027-03-31T00:00:00.000Z'), volume: { initial: 50, unit: 'mg' } },
    ];
    const transactions = [
      { _id: 'tx3', itemType: 'standard', action: 'deduct', qrId: 'u-b1', volumeDelta: -5, afterQty: 45, unit: 'mg', userName: 'Bob', createdAt: new Date('2026-05-03T02:00:00.000Z') },
      { _id: 'tx1', itemType: 'standard', action: 'receive', qrId: 'u-a1', volumeDelta: 100, afterQty: 100, unit: 'mg', userName: 'Alice', createdAt: new Date('2026-05-01T02:00:00.000Z') },
      { _id: 'tx2', itemType: 'standard', action: 'deduct', qrId: 'u_e62fefdb8d1d', volumeDelta: -12.5, afterQty: 87.5, unit: 'mg', userName: 'Alice', note: 'PET-1', createdAt: new Date('2026-05-02T02:00:00.000Z') },
    ];

    const file = buildStandardLotExportWorkbook({ standard, units, transactions });
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });

    expect(file.filename).toMatch(/STD-001_standard-history\.xlsx$/);
    expect(workbook.SheetNames).toEqual(['L-A', 'L-B']);
    const sheet = workbook.Sheets['L-A'];
    const secondSheet = workbook.Sheets['L-B'];
    expect(sheet.B1.v).toBe('บันทึกการรับ -  การใช้  Standard');
    expect(sheet.D2.v).toBe('Pesticide Mix');
    expect(sheet.B4.v).toBe('L-A');
    expect(sheet.A9.v).toBe('01/05/2026');
    expect(sheet.B9.v).toBe(100);
    expect(sheet.C10.v).toBe(12.5);
    expect(sheet.D10.v).toBe(87.5);
    expect(sheet.E10.v).toBe('Alice');
    expect(sheet.F10.v).toBe('PET-1');
    expect(sheet.A2?.v).toBeUndefined();
    expect(sheet.C7.v).toBe('น้ำหนักที่ใช้');
    expect(secondSheet.B4.v).toBe('L-B');
    expect(secondSheet.C9.v).toBe(5);
  });

  test('creates standard usage XLSX with well-formed XML parts', () => {
    const standard = { _id: 'std1', code: 'STD-001', name: 'Pesticide Mix' };
    const units = [
      { qrId: 'u-a1', lotNo: 'L-A', volume: { initial: 100, unit: 'mg' } },
    ];
    const transactions = [
      { _id: 'tx1', itemType: 'standard', action: 'receive', qrId: 'u-a1', volumeDelta: 100, afterQty: 100, unit: 'mg', createdAt: new Date('2026-05-01T02:00:00.000Z') },
    ];

    const file = buildStandardLotExportWorkbook({ standard, units, transactions });
    const stylesXml = readStoredZipEntry(file.buffer, 'xl/styles.xml');
    const workbookXml = readStoredZipEntry(file.buffer, 'xl/workbook.xml');

    expectWellFormedXml(stylesXml);
    expectWellFormedXml(workbookXml);
  });

  test('builds an inclusive Bangkok-time standard export date range', () => {
    const result = buildStandardExportDateRange('2026-05-01', '2026-05-31');

    expect(result.error).toBeUndefined();
    expect(result.value.startDate).toBe('2026-05-01');
    expect(result.value.endDate).toBe('2026-05-31');
    expect(result.value.createdAt.$gte.toISOString()).toBe('2026-04-30T17:00:00.000Z');
    expect(result.value.createdAt.$lte.toISOString()).toBe('2026-05-31T16:59:59.999Z');
  });

  test('rejects a reversed standard export date range', () => {
    const result = buildStandardExportDateRange('2026-05-31', '2026-05-01');

    expect(result).toEqual({ error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' });
  });

  test('builds a chemical requisition doc for one solvent and date', () => {
    const buffer = buildSolventRequisitionDoc({
      solvent: { _id: 'sol1', name: 'Methanol', sizeLiter: 2.5 },
      date: '2026-06-08',
      requisitions: [
        { date: '2026-06-08', solventName: 'Methanol', qty: 2, instrumentName: 'GC 8890', requestedBy: { name: 'Somchai' }, note: 'analysis' },
      ],
    });
    const html = buffer.toString('utf8');

    expect(html).toContain('ใบรับ/เบิกสิ่งของ');
    expect(html).toContain('ชนิดสารเคมี Methanol');
    expect(html).toContain('08/06/2026');
    expect(html).toContain('GC 8890');
    expect(html).toContain('<td>2</td>');
    expect(html).toContain('Somchai');
  });

  test('creates a stored zip container', () => {
    const zip = createZipBuffer([
      { filename: 'STD-001_L-A.xlsx', buffer: Buffer.from('a') },
      { filename: 'STD-001_L-B.xlsx', buffer: Buffer.from('b') },
    ]);

    expect(zip.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004');
    expect(zip.toString('latin1')).toContain('STD-001_L-A.xlsx');
    expect(zip.toString('latin1')).toContain('STD-001_L-B.xlsx');
  });
});
