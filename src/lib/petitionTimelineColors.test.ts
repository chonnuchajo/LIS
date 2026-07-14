import { describe, expect, it } from "vitest";
import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";

const ROW_KEYS = [
  "submitted",
  "sample-sent",
  "received-qc",
  "assigned",
  "received-lab",
  "qc-analyzing",
  "lab-analyzing",
  "pre-result",
  "final",
];

describe("petitionTimelineColors", () => {
  it("ทุกแถวที่เสร็จแล้วได้สีไม่ซ้ำกันเลย", () => {
    const solids = ROW_KEYS.map((key) => timelineBarClass(key, { done: true }));
    expect(new Set(solids).size).toBe(ROW_KEYS.length);
  });

  it("จุด milestone ที่ยังไม่ถึงเป็นสีเทาทุกแถว", () => {
    for (const key of ROW_KEYS) {
      expect(timelineDotClass(key, { done: false })).toBe("bg-grey-300");
    }
  });

  it("จุด milestone ที่ถึงแล้วใช้สีประจำแถว", () => {
    expect(timelineDotClass("submitted", { done: true })).toBe("bg-violet-500");
    expect(timelineDotClass("sample-sent", { done: true })).toBe("bg-orange-500");
    expect(timelineDotClass("received-qc", { done: true })).toBe("bg-sky-500");
    expect(timelineDotClass("assigned", { done: true })).toBe("bg-rose-500");
    expect(timelineDotClass("received-lab", { done: true })).toBe("bg-lime-600");
  });

  it("แท่งที่กำลังทำอยู่ใช้เฉดอ่อนของสีประจำแถว", () => {
    expect(timelineBarClass("qc-analyzing", { done: false })).toBe("bg-primary-200");
    expect(timelineBarClass("lab-analyzing", { done: false })).toBe("bg-amber-200");
  });

  it("แท่งที่เสร็จแล้วใช้เฉดเข้มของสีประจำแถว", () => {
    expect(timelineBarClass("qc-analyzing", { done: true })).toBe("bg-primary-500");
    expect(timelineBarClass("lab-analyzing", { done: true })).toBe("bg-amber-500");
    expect(timelineBarClass("pre-result", { done: true })).toBe("bg-cyan-500");
    expect(timelineBarClass("final", { done: true })).toBe("bg-emerald-500");
  });

  it("Pre Result ไม่ใช้สีเดียวกับ Lab กำลังวิเคราะห์อีกต่อไป", () => {
    expect(timelineBarClass("pre-result", { done: true })).not.toBe(timelineBarClass("lab-analyzing", { done: true }));
  });

  it("แถว final ของคำร้องที่ถูกส่งกลับแก้ไขเป็นสีแดง", () => {
    expect(timelineBarClass("final", { done: true, rejected: true })).toBe("bg-red-500");
  });

  it("rejected ไม่กระทบแถวอื่น", () => {
    expect(timelineBarClass("qc-analyzing", { done: true, rejected: true })).toBe("bg-primary-500");
  });

  it("key ที่ไม่รู้จักถอยไปใช้สีเทา ไม่หายไปจากกราฟ", () => {
    expect(timelineBarClass("unknown-row", { done: true })).toBe("bg-grey-400");
    expect(timelineBarClass("unknown-row", { done: false })).toBe("bg-grey-200");
    expect(timelineDotClass("unknown-row", { done: true })).toBe("bg-grey-400");
  });
});
