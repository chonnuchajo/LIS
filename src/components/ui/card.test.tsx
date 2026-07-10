import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "./card";

describe("Card onOpen", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Child action" }));

    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not call onOpen from data-card-open-ignore children", () => {
    const onOpen = vi.fn();
    render(
      <Card onOpen={onOpen}>
        <span data-card-open-ignore>Ignore me</span>
      </Card>,
    );

    fireEvent.click(screen.getByText("Ignore me"));

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
