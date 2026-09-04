const {
  monthAge,
  normalizeSixMonthStockItems,
} = require('./sixMonthStockItems');

test('monthAge counts calendar months and ignores day', () => {
  expect(monthAge('2026-03-31T00:00:00Z', new Date('2026-09-01T00:00:00Z'))).toBe(6);
  expect(monthAge('2025-09-30T00:00:00Z', new Date('2026-09-01T00:00:00Z'))).toBe(12);
});

test('normalizeSixMonthStockItems keeps rows whose age month mod 6 is 0', () => {
  const rows = normalizeSixMonthStockItems([
    { item_no: 'A', lot_no: 'LOT-6', registering_date: '2026-03-31T00:00:00Z', stock_qty: 10, unit_mea_code: 'KG' },
    { item_no: 'B', lot_no: 'LOT-5', registering_date: '2026-04-01T00:00:00Z', stock_qty: 20, unit_mea_code: 'KG' },
    { item_no: 'C', lot_no: 'LOT-0', registering_date: '2026-09-01T00:00:00Z', stock_qty: 30, unit_mea_code: 'KG' },
    { item_no: 'D', lot_no: 'LOT-12', registering_date: '2025-09-30T00:00:00Z', stock_qty_base: 40, unit_mea_code: 'L' },
  ], new Date('2026-09-04T00:00:00Z'));

  expect(rows.map((row) => row.itemNo)).toEqual(['D', 'A']);
  expect(rows[0].ageMonths).toBe(12);
  expect(rows[0].stockQty).toBe(40);
});
