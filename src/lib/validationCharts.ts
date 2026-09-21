import type { regression } from "./validationCalculator";

type Fit = NonNullable<ReturnType<typeof regression>>;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const stepFor = (value: number) => {
  const power = 10 ** Math.floor(Math.log10(value || 1));
  return ([1, 2, 5, 10].find(n => n * power >= value) ?? 10) * power;
};

/** One print-style chart for both the dashboard and exported report.
 * Orange squares / blue diamonds intentionally reproduce the supplied report.
 * Formatting and grouping do not change the regression or residual calculations.
 */
export function validationChartSvg(fit: Fit, analyte: string, residual = false) {
  const points = fit.points;
  if (!points.length) return "";
  const xs = points.map(p => p.concentration);
  const xStep = stepFor(Math.max(...xs) / 6);
  const xMax = Math.max(xStep, Math.ceil((Math.max(...xs) + xStep * 0.1) / xStep) * xStep);
  const xMin = Math.min(0, Math.floor(Math.min(...xs) / xStep) * xStep);
  const ys = points.map(p => residual ? p.residual : p.area);
  const yStep = stepFor(residual ? Math.max(...ys.map(Math.abs)) / 2 : Math.max(...ys) / 6);
  const yMax = residual ? Math.max(yStep, Math.ceil(Math.max(...ys.map(Math.abs)) / yStep) * yStep) : Math.max(yStep, Math.ceil((Math.max(...ys) + yStep * 0.1) / yStep) * yStep);
  const yMin = residual ? -yMax : Math.min(0, Math.floor(Math.min(...ys) / yStep) * yStep);
  const left = 112, right = 592, top = residual ? 100 : 28, bottom = 220;
  const x = (v: number) => left + (v - xMin) / (xMax - xMin) * (right - left);
  const y = (v: number) => bottom - (v - yMin) / (yMax - yMin) * (bottom - top);
  const axisY = residual ? y(0) : bottom;
  const xTicks = Array.from({ length: Math.round((xMax - xMin) / xStep) + 1 }, (_, i) => xMin + i * xStep);
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / yStep) + 1 }, (_, i) => yMin + i * yStep);
  const groups = new Map<number, number[]>();
  for (const p of points) groups.set(p.concentration, [...(groups.get(p.concentration) ?? []), p.area]);
  const dots = residual ? points.map(p => ({ x: p.concentration, y: p.residual })) : [...groups].map(([c, areas]) => ({ x: c, y: areas.reduce((a,b) => a+b,0) / areas.length }));
  const title = residual ? "X Variable 1 Residual Plot" : "Linearity Plot";
  const xLabel = residual ? "X Variable 1" : `Concentration of ${analyte} (mg/mL)`;
  const yLabel = residual ? "Residuals" : "Response Area";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 330" role="img" aria-label="${escape(title)}" style="width:100%;height:auto;background:white;color:black;font-family:Arial,Tahoma,sans-serif"><rect x="1" y="1" width="638" height="328" fill="white" stroke="#999"/>${residual ? `<text x="320" y="54" text-anchor="middle" font-size="30" font-weight="bold">${title}</text>` : ""}<path d="M${left} ${top}V${bottom}M${left} ${axisY}H${right}" fill="none" stroke="#999"/>${xTicks.map(v => `<path d="M${x(v)} ${axisY}v7" stroke="#999"/><text x="${x(v)}" y="${axisY+30}" text-anchor="middle" font-size="17">${v.toFixed(residual ? 4 : 3)}</text>`).join("")}${yTicks.map(v => `<path d="M${left-7} ${y(v)}h7" stroke="#999"/><text x="${left-20}" y="${y(v)+6}" text-anchor="end" font-size="17">${residual ? Number(v.toPrecision(6)) : v.toFixed(2)}</text>`).join("")}${dots.map(p => residual ? `<path d="M${x(p.x)} ${y(p.y)-7}l7 7 -7 7 -7 -7Z" fill="#4472c4"><title>${p.x}: ${p.y}</title></path>` : `<rect x="${x(p.x)-7}" y="${y(p.y)-7}" width="14" height="14" fill="#ed7d31"><title>${p.x}: ${p.y}</title></rect>`).join("")}${!residual ? `<path d="M${x(Math.min(...xs))} ${y(fit.slope*Math.min(...xs)+fit.intercept)}L${x(Math.max(...xs))} ${y(fit.slope*Math.max(...xs)+fit.intercept)}" stroke="black" fill="none"/><text x="285" y="88" text-anchor="middle" font-size="18">y = ${fit.slope.toFixed(5)}x ${fit.intercept < 0 ? "−" : "+"} ${Math.abs(fit.intercept).toFixed(5)}</text><text x="285" y="115" text-anchor="middle" font-size="18">R² = ${fit.r2.toFixed(5)}</text>` : ""}<text x="352" y="${residual ? 296 : 289}" text-anchor="middle" font-size="18" font-weight="bold">${escape(xLabel)}</text><text transform="translate(28 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" font-size="18" font-weight="bold">${yLabel}</text></svg>`;
}
