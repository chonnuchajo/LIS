function buildLotBottleNumbers(existingCount, bottleCount) {
  const start = Math.max(0, Number(existingCount) || 0);
  const count = Math.max(0, Number(bottleCount) || 0);
  return Array.from({ length: count }, (_, index) => start + index + 1);
}

module.exports = { buildLotBottleNumbers };
