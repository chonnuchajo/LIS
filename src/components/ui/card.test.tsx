import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "./card";

describe("Card onOpen", () => {
  it("forces role button and tabIndex 0 when onOpen is provided", () => {
    const onOpen = vi.fn();
    render(
      <Card onOpen={onOpen} role="link" tabIndex={-1}>
        Open me
      </Card>,
    );

    const card = screen.getByRole("button", { name: "Open me" });

    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("preserves role and tabIndex when onOpen is absent", () => {
    render(<Card role="region" tabIndex={-1}>Not interactive</Card>);

    const card = screen.getByText("Not interactive").closest("div")!;

    expect(card).toHaveAttribute("role", "region");
    expect(card).toHaveAttribute("tabindex", "-1");
  });

  it("calls onOpen on click", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);

    fireEvent.click(screen.getByRole("button", { name: "Open me" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen on double click", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open me" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen on Enter and Space", () => {
    const onOpen = vi.fn();
    render(<Card onOpen={onOpen}>Open me</Card>);
    const card = screen.getByRole("button", { name: "Open me" });

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("does not call onOpen from interactive children", () => {
    const onOpen = vi.fn();
    const onChildClick = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <button type="button" onClick={onChildClick}>Child action</button>
      </Card>,
    );

    const allButtons = screen.getAllByRole("button", { name: "Child action" });
    const nestedButton = allButtons.find((node) => node.tagName.toLowerCase() === "button")!;
    const cardButton = allButtons.find((node) => node.tagName.toLowerCase() === "div")!;
    fireEvent.click(nestedButton);

    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(cardButton).toHaveAttribute("role", "button");
  });

  it("keeps draggable and nested title actions independent", () => {
    const onOpen = vi.fn();
    const onTitleClick = vi.fn();
    render(
      <Card onOpen={onOpen} draggable>
        <button type="button" onClick={onTitleClick}>PET-001</button>
        <span>Card body</span>
      </Card>,
    );

    fireEvent.click(screen.getByText("Card body"));
    fireEvent.click(screen.getByRole("button", { name: "PET-001" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onOpen from SVG in interactive child", () => {
    const onOpen = vi.fn();
    const onChildClick = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <button type="button" onClick={onChildClick}>
          <svg data-testid="child-svg-icon" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" />
          </svg>
        </button>
      </Card>,
    );

    fireEvent.click(screen.getByTestId("child-svg-icon"));

    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not call onOpen from data-card-open-ignore children", () => {
    const onOpen = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <span data-card-open-ignore>
          <svg data-testid="ignored-svg" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" />
          </svg>
        </span>
      </Card>,
    );

    fireEvent.click(screen.getByTestId("ignored-svg"));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("runs caller onClick first and skips onOpen when default is prevented", () => {
    const onOpen = vi.fn();
    const onClick = vi.fn((event: MouseEvent<HTMLDivElement>) => event.preventDefault());
    render(<Card onOpen={onOpen} onClick={onClick}>Open me</Card>);

    fireEvent.click(screen.getByRole("button", { name: "Open me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
