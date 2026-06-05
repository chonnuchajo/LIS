import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { serializeForPrint, collectDocumentCss } from "./print";

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

describe("collectDocumentCss", () => {
  let styleEl: HTMLStyleElement;
  beforeEach(() => {
    styleEl = document.createElement("style");
    styleEl.textContent = ".lis-test-marker{color:rgb(1,2,3);}";
    document.head.appendChild(styleEl);
  });
  afterEach(() => {
    styleEl.remove();
  });

  it("returns CSS text from document stylesheets including injected rules", () => {
    const css = collectDocumentCss();
    expect(css).toContain(".lis-test-marker");
  });

  it("never throws (cross-origin sheets are skipped)", () => {
    expect(() => collectDocumentCss()).not.toThrow();
  });
});
