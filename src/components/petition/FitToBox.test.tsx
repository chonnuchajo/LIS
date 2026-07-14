import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FitToBox from "./FitToBox";

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");

function stubLayout({ boxHeight, contentHeight }: { boxHeight: number; contentHeight: number }) {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.fitBox === undefined ? 0 : boxHeight;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.fitContent === undefined ? 0 : contentHeight;
    },
  });
}

afterEach(() => {
  if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
  if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
});

describe("FitToBox", () => {
  it("ย่อเนื้อหาลงให้พอดีกรอบเมื่อเนื้อหาล้น", () => {
    stubLayout({ boxHeight: 100, contentHeight: 200 });
    render(<FitToBox><p>เนื้อหา</p></FitToBox>);

    const content = screen.getByText("เนื้อหา").parentElement as HTMLElement;
    expect(content.style.transform).toBe("scale(0.5)");
    expect(content.style.transformOrigin).toBe("top left");
    expect(content.style.width).toBe("200%");
    expect(content.style.minHeight).toBe("200%");
  });

  it("ไม่ย่อเมื่อเนื้อหาพอดีกรอบอยู่แล้ว", () => {
    stubLayout({ boxHeight: 200, contentHeight: 150 });
    render(<FitToBox><p>เนื้อหา</p></FitToBox>);

    const content = screen.getByText("เนื้อหา").parentElement as HTMLElement;
    expect(content.style.transform).toBe("none");
    expect(content.style.width).toBe("100%");
  });

  it("ไม่ย่อเมื่อวัดขนาดไม่ได้ และยังเรนเดอร์ลูกตามปกติ", () => {
    stubLayout({ boxHeight: 0, contentHeight: 0 });
    render(<FitToBox><p>เนื้อหา</p></FitToBox>);

    const content = screen.getByText("เนื้อหา").parentElement as HTMLElement;
    expect(content.style.transform).toBe("none");
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
  });
});
