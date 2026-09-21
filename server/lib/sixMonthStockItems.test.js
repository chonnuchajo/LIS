const assert = require('node:assert/strict');
const test = require('node:test');
const {
  monthAge,
  normalizeSixMonthStockItems,
} = require('./sixMonthStockItems');

test('monthAge counts calendar months and ignores day', () => {
  assert.equal(monthAge('2026-03-31T00:00:00Z', new Date('2026-09-01T00:00:00Z')), 6);
  assert.equal(monthAge('2025-09-30T00:00:00Z', new Date('2026-09-01T00:00:00Z')), 12);
});

test('normalizeSixMonthStockItems keeps F and R item numbers older than 6 months', () => {
  const rows = normalizeSixMonthStockItems([
    { item_no: 'R-KEEP-7', lot_no: 'LOT-7', registering_date: '2026-02-28T00:00:00Z', stock_qty: 10, unit_mea_code: 'KG' },
    { item_no: 'F-KEEP-13', item_name1: 'สินค้า FG เก่า', commonname: 'อะบาเมกติน 1.8% EC', lot_no: 'LOT-13', registering_date: '2025-08-31T00:00:00Z', stock_qty_base: 40, unit_mea_code: 'L' },
    { item_no: 'R-SIX', lot_no: 'LOT-6', registering_date: '2026-03-31T00:00:00Z', stock_qty: 20, unit_mea_code: 'KG' },
    { item_no: 'f-KEEP-8', lot_no: 'LOT-8', registering_date: '2026-01-31T00:00:00Z', stock_qty: 15, unit_mea_code: 'KG' },
    { item_no: ' r-KEEP-9 ', lot_no: 'LOT-9', registering_date: '2025-12-31T00:00:00Z', stock_qty: 25, unit_mea_code: 'KG' },
    { item_no: 'F-FIVE', lot_no: 'LOT-5', registering_date: '2026-04-01T00:00:00Z', stock_qty: 30, unit_mea_code: 'KG' },
    { item_no: 'A-DROP-12', lot_no: 'LOT-12', registering_date: '2025-09-30T00:00:00Z', stock_qty: 50, unit_mea_code: 'KG' },
  ], new Date('2026-09-04T00:00:00Z'));

  assert.deepEqual(rows.map((row) => row.itemNo), ['F-KEEP-13', 'r-KEEP-9', 'f-KEEP-8', 'R-KEEP-7']);
  assert.equal(rows[0].ageMonths, 13);
  assert.equal(rows[0].stockQty, 40);
  assert.equal(rows[0].itemName, 'สินค้า FG เก่า');
  assert.equal(rows[0].commonName, 'อะบาเมกติน 1.8% EC');
});
