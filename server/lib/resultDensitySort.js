function densityTime(row) {
  const time = Date.parse(String(row?.['Date & time'] || ''));
  return Number.isNaN(time) ? 0 : time;
}

function sortLatestDensities(rows) {
  return [...rows].sort((a, b) => densityTime(b) - densityTime(a));
}

module.exports = { sortLatestDensities };
