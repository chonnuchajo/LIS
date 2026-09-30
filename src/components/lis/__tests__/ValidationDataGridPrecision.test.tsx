import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ValidationDataGrid from "../ValidationDataGrid";

it("formats Accuracy concentrations without rounding stored values or filling blanks", () => {
  const change = vi.fn();
  render(<ValidationDataGrid label="Accuracy" columns={["Target", "Actual", "Found"]} value={"0.1\t0.1002643200000\t"} onChange={change} decimals={3} />);
  const actual = screen.getByLabelText("Accuracy แถว 1 Actual");
  expect(actual).toHaveValue("0.100");
  expect(screen.getByLabelText("Accuracy แถว 1 Target")).toHaveValue("0.100");
  expect(screen.getByLabelText("Accuracy แถว 1 Found")).toHaveValue("");
  fireEvent.focus(actual);
  expect(actual).toHaveValue("0.1002643200000");
  fireEvent.blur(actual);
  expect(actual).toHaveValue("0.100");
  fireEvent.change(screen.getByLabelText("Accuracy แถว 1 Found"), { target: { value: "0.101" } });
  expect(change).toHaveBeenCalledWith("0.1\t0.1002643200000\t0.101");
});
