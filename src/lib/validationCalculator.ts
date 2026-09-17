export function stats(values: number[]) {
  if (values.length < 2 || values.some(v => !Number.isFinite(v))) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  return { mean, sd, rsd: mean > 0 ? sd / mean * 100 : null };
}

export function regression(rows: number[][]) {
  if (rows.length < 3) return null;
  const x = rows.map(r => r[0]);
  const y = rows.map(r => r[1]);
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const xx = x.reduce((a, b) => a + (b - mx) ** 2, 0);
  const yy = y.reduce((a, b) => a + (b - my) ** 2, 0);
  if (!xx || !yy) return null;
  const slope = x.reduce((a, b, i) => a + (b - mx) * (y[i] - my), 0) / xx;
  if (slope <= 0) return null;
  const intercept = my - slope * mx;
  const points = rows.map(([concentration, area]) => ({ concentration, area, predicted: slope * concentration + intercept, residual: area - slope * concentration - intercept }));
  return { slope, intercept, r2: 1 - points.reduce((a, p) => a + p.residual ** 2, 0) / yy, points };
}

/** Numeric CSV/TSV only. Reject incomplete rows instead of silently discarding data. */
export function parseMeasurements(text: string, columns: number) {
  const rows: number[][] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const cells = line.trim().split(/[,;\t]/).map(s => s.trim());
    if (cells.length !== columns || cells.some(s => !s || !Number.isFinite(Number(s)) || Number(s) < 0)) {
      errors.push(`แถว ${i + 1}: ต้องมีตัวเลขไม่ติดลบ ${columns} ช่อง คั่นด้วย comma หรือ Tab`);
    } else rows.push(cells.map(Number));
  });
  return { rows, errors };
}
