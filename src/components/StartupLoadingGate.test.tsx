import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartupLoadingGate } from "./StartupLoadingGate";

const loadingLabel = "กำลังเตรียมสาร…";

describe("StartupLoadingGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the loading screen visible until the startup delay finishes", () => {
    render(
      <StartupLoadingGate minimumDurationMs={3000}>
        <main>Loaded app</main>
      </StartupLoadingGate>,
    );

    expect(screen.getByRole("status", { name: loadingLabel })).toBeInTheDocument();
    expect(screen.queryByText("Loaded app")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });

    expect(screen.getByRole("status", { name: loadingLabel })).toBeInTheDocument();
    expect(screen.queryByText("Loaded app")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole("status", { name: loadingLabel })).not.toBeInTheDocument();
    expect(screen.getByText("Loaded app")).toBeInTheDocument();
  });

  it("renders children immediately by default", () => {
    render(
      <StartupLoadingGate>
        <main>Loaded app</main>
      </StartupLoadingGate>,
    );

    expect(screen.queryByRole("status", { name: loadingLabel })).not.toBeInTheDocument();
    expect(screen.getByText("Loaded app")).toBeInTheDocument();
  });
});
