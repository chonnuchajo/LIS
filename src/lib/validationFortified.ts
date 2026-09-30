/** Fortified is the nominal target; retain Found and any malformed evidence cells. */
export function theoreticalFortified(text: string, daily = false) {
  if (!text) return text;
  const target = daily ? 1 : 0;
  return text.split(/\r?\n/).map(line => {
    const cells = line.split(/[,;\t]/);
    if (cells.length === (daily ? 4 : 3) && cells[target].trim() && Number.isFinite(Number(cells[target])) && Number(cells[target]) > 0) cells[target + 1] = cells[target];
    return cells.join("\t");
  }).join("\n");
}
