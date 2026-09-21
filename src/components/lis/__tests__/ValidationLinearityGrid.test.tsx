import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ValidationLinearityGrid from "../ValidationLinearityGrid";
import { defaultPreparationLevels } from "@/lib/validationPreparation";

it("displays three decimals but retains full concentration when an Area is edited", () => {
  const onChange = vi.fn();
  render(<ValidationLinearityGrid value={"0.10441728\t"} onChange={onChange} levels={defaultPreparationLevels().slice(0,5)} stock={2} stocks={[]} />);
  const actual = screen.getByLabelText("Linearity LV 1 Injection 1 Actual");
  expect(actual).toHaveValue("0.104");
  fireEvent.focus(actual);
  expect(actual).toHaveValue("0.10441728");
  fireEvent.blur(actual);
  expect(actual).toHaveValue("0.104");
  fireEvent.change(screen.getByLabelText("Linearity LV 1 Injection 1 Area"), { target: { value: "25" } });
  expect(onChange.mock.calls[0][0].split("\n")[0]).toBe("0.10441728\t25");
});
