import { describe, expect, it } from "vitest";
import { MAX_FAVORITES, moveFavorite, normalizeFavorites, toggleFavorite } from "./favorites";

describe("toggleFavorite", () => {
  it("ต่อท้ายเมื่อยังไม่มี", () => {
    expect(toggleFavorite(["/stock"], "/petition")).toEqual(["/stock", "/petition"]);
  });

  it("เอาออกเมื่อมีอยู่แล้ว", () => {
    expect(toggleFavorite(["/stock", "/petition"], "/stock")).toEqual(["/petition"]);
  });

  it("ไม่แก้ array เดิม", () => {
    const original = ["/stock"];
    toggleFavorite(original, "/petition");
    expect(original).toEqual(["/stock"]);
  });
});

describe("moveFavorite", () => {
  it("ย้ายขึ้นสลับกับตัวก่อนหน้า", () => {
    expect(moveFavorite(["/a", "/b", "/c"], "/b", "up")).toEqual(["/b", "/a", "/c"]);
  });

  it("ย้ายลงสลับกับตัวถัดไป", () => {
    expect(moveFavorite(["/a", "/b", "/c"], "/b", "down")).toEqual(["/a", "/c", "/b"]);
  });

  it("คืน array ตัวเดิมเมื่ออยู่หัวแถวแล้วสั่งขึ้น", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/a", "up")).toBe(paths);
  });

  it("คืน array ตัวเดิมเมื่ออยู่ท้ายแถวแล้วสั่งลง", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/b", "down")).toBe(paths);
  });

  it("คืน array ตัวเดิมเมื่อหา path ไม่เจอ", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/zzz", "up")).toBe(paths);
  });
});

describe("normalizeFavorites", () => {
  const known = ["/petition", "/stock", "/qc-testing"];

  it("คงลำดับที่เก็บไว้ ไม่ใช่ลำดับของ knownPaths", () => {
    expect(normalizeFavorites(["/stock", "/petition"], known)).toEqual(["/stock", "/petition"]);
  });

  it("ทิ้ง path ที่ไม่รู้จัก", () => {
    expect(normalizeFavorites(["/stock", "/ไม่มีแล้ว"], known)).toEqual(["/stock"]);
  });

  it("ตัดตัวซ้ำ", () => {
    expect(normalizeFavorites(["/stock", "/stock"], known)).toEqual(["/stock"]);
  });

  it("คืน array ว่างเมื่อ input เป็น undefined", () => {
    expect(normalizeFavorites(undefined, known)).toEqual([]);
  });

  it("ตัดเหลือไม่เกิน MAX_FAVORITES", () => {
    const many = Array.from({ length: 25 }, (_, i) => `/page-${i}`);
    expect(normalizeFavorites(many, many)).toHaveLength(MAX_FAVORITES);
  });
});
