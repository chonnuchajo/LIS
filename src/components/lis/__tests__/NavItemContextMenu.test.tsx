import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import NavItemContextMenu, { type NavItemContextMenuProps } from "../NavItemContextMenu";

// jsdom ไม่มี pointer-capture API ที่ Radix เรียกตอนเปิดเมนู
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
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
});
