import { expect, it } from "vitest";
import { regression } from "./validationCalculator";
import { validationChartSvg } from "./validationCharts";

it("uses report scales and symbols without changing regression precision", () => {
  const fit = regression([0.1,0.25,0.5,0.75,1.044].flatMap(x => [-1.5,0,1].map(delta => [x,239.67969*x-0.33311+delta])))!;
  const original = JSON.stringify(fit);
  const linear = validationChartSvg(fit,"A < B");
  const residual = validationChartSvg(fit,"A < B",true);
  expect(linear).toContain("1.200");
  expect(linear).toContain("300.00");
  expect(linear).toContain("A &lt; B");
  expect(linear.match(/fill="#ed7d31"/g)).toHaveLength(5);
  expect(residual.match(/fill="#4472c4"/g)).toHaveLength(15);
  expect(residual).toContain("X Variable 1 Residual Plot");
  expect(residual).toContain("1.2000");
  expect(JSON.stringify(fit)).toBe(original);
});
