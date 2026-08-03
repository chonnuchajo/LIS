const { buildInUseItems, canAcknowledgeDeduction } = require('./standardsInUse');

const tx = {
  _id: 'tx1',
  itemCode: 'STD-001',
  itemName: 'ABAMECTIN',
  qrId: 'u_abc',
  weights: [10, 20.5],
  volumeDelta: -30.5,
  instrumentGroup: 'gc',
  note: 'P-2606-0018',
  createdAt: new Date('2026-01-01T03:00:00.000Z'),
  userEmail: 'Someone@ICPLadda.com',
  userName: 'สมชาย',
};

describe('buildInUseItems', () => {
  test('เติม dueAt จากความถี่ของสารที่ตรง code', () => {
    const [item] = buildInUseItems([tx], [{ code: 'STD-001', frequency: '1/1 Week' }]);
    expect(item.dueAt).toBe(new Date('2026-01-08T03:00:00.000Z').toISOString());
    expect(item.withdrawnAt).toBe('2026-01-01T03:00:00.000Z');
    expect(item.frequency).toBe('1/1 Week');
    expect(item._id).toBe('tx1');
    expect(item.totalMg).toBe(30.5);
    expect(item.instrumentGroup).toBe('gc');
    expect(item.userEmail).toBe('Someone@ICPLadda.com');
  });

  test('สารไม่มีความถี่ / หาสารไม่เจอ → dueAt null', () => {
    expect(buildInUseItems([tx], [{ code: 'STD-001', frequency: '' }])[0].dueAt).toBeNull();
    expect(buildInUseItems([tx], [])[0].dueAt).toBeNull();
    expect(buildInUseItems([tx], [])[0].frequency).toBe('');
  });

  test('ไม่มี weights → totalMg มาจาก volumeDelta (ค่าสัมบูรณ์)', () => {
    const [item] = buildInUseItems([{ ...tx, weights: undefined }], []);
    expect(item.totalMg).toBe(30.5);
    expect(item.weights).toEqual([]);
  });

  test('ฟิลด์ที่ขาดกลายเป็นค่าว่าง ไม่ throw', () => {
    const [item] = buildInUseItems([{ _id: 'tx2' }], []);
    expect(item).toEqual({
      _id: 'tx2',
      itemCode: '',
      itemName: '',
      qrId: '',
      weights: [],
      totalMg: 0,
      instrumentGroup: null,
      note: '',
      withdrawnAt: '',
      frequency: '',
      dueAt: null,
      userEmail: '',
      userName: '',
    });
  });
});

describe('canAcknowledgeDeduction', () => {
  test('อีเมลตรงกับผู้เบิก (ไม่สนตัวพิมพ์/ช่องว่าง) → ได้', () => {
    expect(canAcknowledgeDeduction(tx, ' someone@icpladda.com ')).toBe(true);
  });

  test('คนอื่น / ไม่มีอีเมล / transaction ไม่มีผู้เบิก → ไม่ได้', () => {
    expect(canAcknowledgeDeduction(tx, 'other@icpladda.com')).toBe(false);
    expect(canAcknowledgeDeduction(tx, '')).toBe(false);
    expect(canAcknowledgeDeduction({ userEmail: '' }, 'someone@icpladda.com')).toBe(false);
    expect(canAcknowledgeDeduction(null, 'someone@icpladda.com')).toBe(false);
  });
});
