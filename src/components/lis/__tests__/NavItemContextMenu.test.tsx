import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import NavItemContextMenu, { type NavItemContextMenuProps } from "../NavItemContextMenu";

// jsdom ไม่มี pointer-capture API ที่ Radix เรียกตอนเปิดเมนู
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
});

type Overrides = Partial<NavItemContextMenuProps>;

function renderMenu(overrides: Overrides = {}) {
  const onToggleFavorite = vi.fn();
  const onMove = vi.fn();
  const utils = render(
    <TooltipProvider>
      <NavItemContextMenu
        path="/petition"
        isFavorite={false}
        inFavorites={false}
        canMoveUp={false}
        canMoveDown={false}
        onToggleFavorite={onToggleFavorite}
        onMove={onMove}
        {...overrides}
      >
        <a href="/petition">รายการคำร้อง</a>
      </NavItemContextMenu>
    </TooltipProvider>,
  );
  return { ...utils, onToggleFavorite, onMove };
}

function openMenu() {
  fireEvent.contextMenu(screen.getByText("รายการคำร้อง"));
}

describe("NavItemContextMenu", () => {
  it("คลิกขวาแล้วเปิดเมนู เพิ่มในรายการโปรด + เปิดในแท็บใหม่ + คัดลอกลิงก์", async () => {
    renderMenu();
    openMenu();

    expect(await screen.findByText("เพิ่มในรายการโปรด")).toBeInTheDocument();
    expect(screen.getByText("เปิดในแท็บใหม่")).toBeInTheDocument();
    expect(screen.getByText("คัดลอกลิงก์")).toBeInTheDocument();
  });

  it("สลับเป็น เอาออกจากรายการโปรด เมื่อเป็นรายการโปรดอยู่แล้ว", async () => {
    renderMenu({ isFavorite: true });
    openMenu();

    expect(await screen.findByText("เอาออกจากรายการโปรด")).toBeInTheDocument();
    expect(screen.queryByText("เพิ่มในรายการโปรด")).not.toBeInTheDocument();
  });

  it("ไม่แสดงปุ่มย้ายเมื่ออยู่นอกกลุ่มรายการโปรด", async () => {
    renderMenu({ isFavorite: true });
    openMenu();

    await screen.findByText("เอาออกจากรายการโปรด");
    expect(screen.queryByText("ย้ายขึ้น")).not.toBeInTheDocument();
    expect(screen.queryByText("ย้ายลง")).not.toBeInTheDocument();
  });

  it("แสดงปุ่มย้ายเมื่ออยู่ในกลุ่มรายการโปรด และเรียก onMove", async () => {
    const { onMove } = renderMenu({ isFavorite: true, inFavorites: true, canMoveDown: true });
    openMenu();

    fireEvent.click(await screen.findByText("ย้ายลง"));
    expect(onMove).toHaveBeenCalledWith("down");
  });

  it("เรียก onToggleFavorite เมื่อกดเมนูรายการโปรด", async () => {
    const { onToggleFavorite } = renderMenu();
    openMenu();

    fireEvent.click(await screen.findByText("เพิ่มในรายการโปรด"));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("ปุ่มย้ายขึ้น disabled ที่ขอบบนสุด ส่วนย้ายลงยังกดได้ (ไม่ใช่แค่ซ่อน)", async () => {
    renderMenu({ isFavorite: true, inFavorites: true, canMoveUp: false, canMoveDown: true });
    openMenu();

    const moveUpItem = (await screen.findByText("ย้ายขึ้น")).closest('[role="menuitem"]');
    const moveDownItem = screen.getByText("ย้ายลง").closest('[role="menuitem"]');

    expect(moveUpItem).toHaveAttribute("aria-disabled", "true");
    expect(moveUpItem).toHaveAttribute("data-disabled");
    expect(moveDownItem).not.toHaveAttribute("aria-disabled");
    expect(moveDownItem).not.toHaveAttribute("data-disabled");
  });

  it("เปิดเมนูได้แม้ห่อด้วย Tooltip (โหมด rail พับ ส่ง tooltip prop มา) — nested asChild Slot ยังทำงาน", async () => {
    renderMenu({ tooltip: "รายการคำร้อง" });
    openMenu();

    expect(await screen.findByText("เพิ่มในรายการโปรด")).toBeInTheDocument();
    expect(screen.getByText("เปิดในแท็บใหม่")).toBeInTheDocument();
    expect(screen.getByText("คัดลอกลิงก์")).toBeInTheDocument();
  });

  it("คัดลอกลิงก์ล้มเหลว (execCommand throw) ต้องไม่หลง textarea ค้างใน DOM และไม่ throw ออกไปนอกฟังก์ชัน", async () => {
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn(() => {
      throw new Error("execCommand ถูกบล็อก");
    }) as typeof document.execCommand;

    try {
      renderMenu();
      openMenu();

      fireEvent.click(await screen.findByText("คัดลอกลิงก์"));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("คัดลอกลิงก์ไม่สำเร็จ");
      });
      expect(document.body.querySelectorAll("textarea")).toHaveLength(0);
    } finally {
      document.execCommand = originalExecCommand;
    }
  });
});
