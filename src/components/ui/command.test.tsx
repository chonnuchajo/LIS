import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Command, CommandInput, CommandItem, CommandList } from "./command";

function optionValues() {
  return screen.getAllByRole("option").map((option) => option.getAttribute("data-value"));
}

describe("Command search ranking", () => {
  it("ranks literal matches before keywords and retains fuzzy matches", async () => {
    render(
      <Command>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandItem value="keyword" keywords={["AB"]}>Keyword</CommandItem>
          <CommandItem value="A---B">Fuzzy</CommandItem>
          <CommandItem value="XXAB">Later</CommandItem>
          <CommandItem value="XAB">Earlier</CommandItem>
          <CommandItem value="AB1">Prefix</CommandItem>
          <CommandItem value="AB">Exact</CommandItem>
          <CommandItem value="unrelated">Unrelated</CommandItem>
        </CommandList>
      </Command>,
    );
    expect(optionValues()).toEqual(["keyword", "A---B", "XXAB", "XAB", "AB1", "AB", "unrelated"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "AB" } });
    await waitFor(() => expect(optionValues()).toEqual(["AB", "AB1", "XAB", "XXAB", "keyword", "A---B"]));
  });

  it("preserves caller filters", async () => {
    render(
      <Command filter={(value) => value === "custom" ? 1 : 0}>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandItem value="match">Match</CommandItem>
          <CommandItem value="custom">Custom</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "match" } });
    await waitFor(() => expect(optionValues()).toEqual(["custom"]));
  });

  it("shows every item for whitespace queries", async () => {
    render(
      <Command>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandItem value="first">First</CommandItem>
          <CommandItem value="second" keywords={["alias"]}>Second</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "   " } });
    await waitFor(() => expect(optionValues()).toEqual(["first", "second"]));
  });

  it("leaves externally filtered lists in their supplied order", () => {
    render(
      <Command shouldFilter={false}>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandItem value="AB1">Prefix</CommandItem>
          <CommandItem value="AB">Exact</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "AB" } });
    expect(optionValues()).toEqual(["AB1", "AB"]);
  });
});
