export function formatStockQuantity(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return STOCK_QUANTITY_FORMATTER.format(Object.is(value, -0) ? 0 : value);
}

export function formatStockQuantityWithUnit(value?: number | null, unit?: string | null): string {
  const amount = formatStockQuantity(value);
  return amount === "-" || !unit ? amount : `${amount} ${unit}`;
}

const STOCK_QUANTITY_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
});
