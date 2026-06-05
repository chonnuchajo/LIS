import { describe, it, expect } from "vitest";
import { serializeForPrint } from "./print";

describe("serializeForPrint", () => {
  it("returns the element's outerHTML", () => {
    const el = document.createElement("div");
    el.className = "doc";
    el.innerHTML = "<p>hello</p>";
    expect(serializeForPrint(el)).toContain("<p>hello</p>");
    expect(serializeForPrint(el)).toContain('class="doc"');
  });

  it("prepends a <style> block when css is given", () => {
    const el = document.createElement("div");
    el.innerHTML = "x";
    const out = serializeForPrint(el, ".doc{color:red}");
    expect(out.startsWith("<style>.doc{color:red}</style>")).toBe(true);
    expect(out).toContain("x");
  });

  it("throws on null element", () => {
    expect(() => serializeForPrint(null)).toThrow();
  });
});
