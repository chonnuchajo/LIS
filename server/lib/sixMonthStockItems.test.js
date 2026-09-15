const {
  monthAge,
  normalizeSixMonthStockItems,
} = require('./sixMonthStockItems');

test('monthAge counts calendar months and ignores day', () => {
  expect(monthAge('2026-03-31T00:00:00Z', new Date('2026-09-01T00:00:00Z'))).toBe(6);
  expect(monthAge('2025-09-30T00:00:00Z', new Date('2026-09-01T00:00:00Z'))).toBe(12);
});

test('normalizeSixMonthStockItems keeps only R/F item numbers older than 6 months', () => {
  const rows = normalizeSixMonthStockItems([
    { item_no: 'R-KEEP-7', lot_no: 'LOT-7', registering_date: '2026-02-28T00:00:00Z', stock_qty: 10, unit_mea_code: 'KG' },
    { item_no: 'F-KEEP-13', lot_no: 'LOT-13', registering_date: '2025-08-31T00:00:00Z', stock_qty_base: 40, unit_mea_code: 'L' },
    { item_no: 'R-SIX', lot_no: 'LOT-6', registering_date: '2026-03-31T00:00:00Z', stock_qty: 20, unit_mea_code: 'KG' },
    { item_no: 'F-FIVE', lot_no: 'LOT-5', registering_date: '2026-04-01T00:00:00Z', stock_qty: 30, unit_mea_code: 'KG' },
    { item_no: 'A-DROP-12', lot_no: 'LOT-12', registering_date: '2025-09-30T00:00:00Z', stock_qty: 50, unit_mea_code: 'KG' },
  ], new Date('2026-09-04T00:00:00Z'));

  expect(rows.map((row) => row.itemNo)).toEqual(['F-KEEP-13', 'R-KEEP-7']);
  expect(rows[0].ageMonths).toBe(13);
  expect(rows[0].stockQty).toBe(40);
});
