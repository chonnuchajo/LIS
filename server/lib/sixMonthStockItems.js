function parseRegisteringDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthAge(registeringDate, referenceDate = new Date()) {
  const registered = parseRegisteringDate(registeringDate);
  const reference = parseRegisteringDate(referenceDate);
  if (!registered || !reference) return null;
  return (reference.getUTCFullYear() - registered.getUTCFullYear()) * 12
    + (reference.getUTCMonth() - registered.getUTCMonth());
}

function textValue(value) {
  return value == null ? '' : String(value).trim();
}

function numericValue(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function normalizeSixMonthStockItem(row, referenceDate = new Date()) {
  const ageMonths = monthAge(row.registering_date ?? row.registeringDate, referenceDate);
  if (ageMonths == null || ageMonths < 6 || ageMonths % 6 !== 0) return null;
  const registered = parseRegisteringDate(row.registering_date ?? row.registeringDate);
  if (!registered) return null;

  return {
    companySource: textValue(row.company_source ?? row.companySource),
    itemNo: textValue(row.item_no ?? row.itemNo),
    locationCode: textValue(row.loca_code ?? row.locationCode),
    binCode: textValue(row.bin_code ?? row.binCode),
    lotNo: textValue(row.lot_no ?? row.lotNo),
    registeringDate: registered.toISOString(),
    unit: textValue(row.unit_mea_code ?? row.unit),
    stockQty: numericValue(row.stock_qty, row.stock_qty_base, row.stockQty, row.stockQtyBase),
    stockQtyBase: numericValue(row.stock_qty_base, row.stock_qty, row.stockQtyBase, row.stockQty),
    ageMonths,
  };
}

function normalizeSixMonthStockItems(rows, referenceDate = new Date()) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeSixMonthStockItem(row, referenceDate))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.ageMonths !== a.ageMonths) return b.ageMonths - a.ageMonths;
      const itemCompare = a.itemNo.localeCompare(b.itemNo, undefined, { numeric: true });
      if (itemCompare !== 0) return itemCompare;
      return a.lotNo.localeCompare(b.lotNo, undefined, { numeric: true });
    });
}

module.exports = {
  monthAge,
  normalizeSixMonthStockItem,
  normalizeSixMonthStockItems,
  parseRegisteringDate,
};
