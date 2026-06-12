import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmProvider, useConfirm, releaseBodyPointerLock } from "@/context/ConfirmDialog";

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = "";
});

describe("releaseBodyPointerLock", () => {
  it("clears a stuck pointer-events:none on the body", () => {
    document.body.style.pointerEvents = "none";
    releaseBodyPointerLock();
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("leaves an already-clear body untouched", () => {
    document.body.style.pointerEvents = "";
    releaseBodyPointerLock();
    expect(document.body.style.pointerEvents).toBe("");
  });
});

function Harness() {
  const confirm = useConfirm();
  return <button onClick={() => confirm({ description: "ยืนยัน?" })}>open</button>;
}

function renderHarness() {
  return render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>,
  );
}

describe("ConfirmProvider releases the body lock on settle", () => {
  it("unlocks the body the instant the user confirms (no dead window before navigate)", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("ยืนยัน?");

    // Radix locks the body while the modal is open; in production it only
    // restores this after the close animation — which is the dead window.
    document.body.style.pointerEvents = "none";

    fireEvent.click(screen.getByText("ยืนยัน"));

    // settle() must clear it synchronously, before any navigate() that the
    // caller fires right after `await confirm()` resolves.
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("unlocks the body the instant the user cancels", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("ยืนยัน?");
    document.body.style.pointerEvents = "none";

    fireEvent.click(screen.getByText("ยกเลิก"));

    expect(document.body.style.pointerEvents).toBe("");
  });
});
