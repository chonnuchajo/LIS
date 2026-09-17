export function stats(values: number[]) {
  if (values.length < 2 || values.some(v => !Number.isFinite(v))) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || (mean > 0 && !Number.isFinite(sd / mean * 100))) return null;
  return { mean, sd, rsd: mean > 0 ? sd / mean * 100 : null };
}

export function regression(rows: number[][]) {
  if (rows.length < 3 || rows.some(row => row.length !== 2 || row.some(v => !Number.isFinite(v)))) return null;
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
  const r2 = 1 - points.reduce((a, p) => a + p.residual ** 2, 0) / yy;
  if (![slope, intercept, r2].every(Number.isFinite) || points.some(p => !Number.isFinite(p.predicted) || !Number.isFinite(p.residual))) return null;
  return { slope, intercept, r2, points };
}

/** Original Horwitz RSDR. C is analyte mass fraction, never mg/mL. */
export function horwitz(massFraction: number, repeatabilityFactor = 1) {
  if (!Number.isFinite(massFraction) || massFraction <= 0 || massFraction > 1 ||
    !Number.isFinite(repeatabilityFactor) || repeatabilityFactor <= 0) return null;
  return 2 ** (1 - 0.5 * Math.log10(massFraction)) * repeatabilityFactor;
}

/** Balanced one-way random-effects ANOVA: repeated independent preparations per day. */
export function intermediatePrecision(groups: number[][]) {
  if (groups.length < 2 || groups.some(g => g.length < 2 || g.length !== groups[0].length || g.some(v => !Number.isFinite(v)))) return null;
  const n = groups[0].length;
  const k = groups.length;
  const summaries = groups.map(g => stats(g)!);
  if (summaries.some(s => !s)) return null;
  const mean = summaries.reduce((a, s) => a + s.mean, 0) / k;
  if (mean <= 0) return null;
  const msWithin = summaries.reduce((a, s) => a + s.sd ** 2, 0) / k;
  const msBetween = n * summaries.reduce((a, s) => a + (s.mean - mean) ** 2, 0) / (k - 1);
  const betweenVariance = Math.max(0, (msBetween - msWithin) / n);
  const sd = Math.sqrt(msWithin + betweenVariance);
  if (![mean, msWithin, msBetween, sd, sd / mean * 100].every(Number.isFinite)) return null;
  return { mean, msWithin, msBetween, withinSd: Math.sqrt(msWithin), betweenSd: Math.sqrt(betweenVariance), sd, rsd: sd / mean * 100, summaries, truncatedBetweenVariance: msBetween < msWithin };
}

/** Numeric CSV/TSV only. Reject incomplete rows instead of silently discarding data. */
export function parseMeasurements(text: string, columns: number) {
  const rows: number[][] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() && !/[,;\t]/.test(line)) return;
    const cells = line.split(/[,;\t]/).map(s => s.trim());
    if (cells.length !== columns || cells.some(s => !s || !Number.isFinite(Number(s)) || Number(s) < 0)) {
      errors.push(`แถว ${i + 1}: ต้องมีตัวเลขไม่ติดลบ ${columns} ช่อง คั่นด้วย comma หรือ Tab`);
    } else rows.push(cells.map(Number));
  });
  return { rows, errors };
}
