import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  writable: true,
  value: () => {},
});

// jsdom ไม่มี DOMRect เป็น global — Radix (ContextMenu/DropdownMenu ฯลฯ) เรียก
// `DOMRect.fromRect(...)` ตอนคำนวณตำแหน่ง virtual anchor แล้ว throw ถ้าไม่มี
if (typeof window.DOMRect === "undefined") {
  class DOMRectPolyfill {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;

    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = height < 0 ? y + height : y;
      this.right = width < 0 ? x : x + width;
      this.bottom = height < 0 ? y : y + height;
      this.left = width < 0 ? x + width : x;
    }

    static fromRect(rect?: { x?: number; y?: number; width?: number; height?: number }) {
      return new DOMRectPolyfill(rect?.x, rect?.y, rect?.width, rect?.height);
    }

    toJSON() {
      return { ...this };
    }
  }

  Object.defineProperty(window, "DOMRect", {
    writable: true,
    value: DOMRectPolyfill,
  });
}
