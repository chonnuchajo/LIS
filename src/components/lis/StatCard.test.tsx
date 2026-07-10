import { fireEvent, render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("opens from click, double click, Enter, and Space when interactive", () => {
    const onClick = vi.fn();
    render(
      <StatCard
        icon={FlaskConical}
        value={7}
        label="Waiting"
        variant="blue"
        onClick={onClick}
      />,
    );

    const card = screen.getByRole("button", { name: /Waiting/i });
    fireEvent.click(card);
    fireEvent.doubleClick(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(4);
  });

  it("does not expose a button role without an open action", () => {
    render(<StatCard icon={FlaskConical} value={7} label="Waiting" variant="blue" />);

    expect(screen.queryByRole("button", { name: /Waiting/i })).not.toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });
});
