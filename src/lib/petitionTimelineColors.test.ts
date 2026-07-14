import { describe, expect, it } from "vitest";
import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";

// ทุก key ที่ buildStageRows (petitionTimelineDetail.ts) สร้างจริง — 7 แท่ง + จุด final
const ROW_KEYS = [
  "submitted",
  "sample-sent",
  "assigned",
  "qc-analyzing",
  "lab-analyzing",
  "lab-approval",
  "pre-result",
  "final",
];

describe("petitionTimelineColors", () => {
  it("ทุกแถวที่เสร็จแล้วได้สีไม่ซ้ำกันเลย", () => {
    const solids = ROW_KEYS.map((key) => timelineBarClass(key, { done: true }));
    expect(new Set(solids).size).toBe(ROW_KEYS.length);
  });

  it("จุดที่ยังไม่ถึงเป็นสีเทาทุกแถว", () => {
    for (const key of ROW_KEYS) {
      expect(timelineDotClass(key, { done: false })).toBe("bg-grey-300");
    }
  });

  it("จุด Final Result ที่ปิดงานแล้วใช้สีประจำแถว", () => {
    expect(timelineDotClass("final", { done: true })).toBe("bg-emerald-500");
  });

  it("จุด Final Result ของคำร้องที่ถูกส่งกลับแก้ไขเป็นสีแดง", () => {
    expect(timelineDotClass("final", { done: true, rejected: true })).toBe("bg-red-500");
  });

  it("แท่งที่กำลังทำอยู่ใช้เฉดอ่อนของสีประจำแถว", () => {
    expect(timelineBarClass("qc-analyzing", { done: false })).toBe("bg-sky-200");
    expect(timelineBarClass("lab-analyzing", { done: false })).toBe("bg-amber-200");
    expect(timelineBarClass("lab-approval", { done: false })).toBe("bg-lime-200");
  });

  it("แท่งที่เสร็จแล้วใช้เฉดเข้มของสีประจำแถว", () => {
    expect(timelineBarClass("submitted", { done: true })).toBe("bg-violet-500");
    expect(timelineBarClass("sample-sent", { done: true })).toBe("bg-orange-500");
    expect(timelineBarClass("assigned", { done: true })).toBe("bg-rose-500");
    expect(timelineBarClass("qc-analyzing", { done: true })).toBe("bg-sky-500");
    expect(timelineBarClass("lab-analyzing", { done: true })).toBe("bg-amber-500");
    expect(timelineBarClass("lab-approval", { done: true })).toBe("bg-lime-600");
    expect(timelineBarClass("pre-result", { done: true })).toBe("bg-cyan-500");
  });

  it("Pre Result ไม่ใช้สีเดียวกับ Lab กำลังวิเคราะห์อีกต่อไป", () => {
    expect(timelineBarClass("pre-result", { done: true })).not.toBe(timelineBarClass("lab-analyzing", { done: true }));
  });

  it("rejected ไม่กระทบแถวอื่น", () => {
    expect(timelineBarClass("qc-analyzing", { done: true, rejected: true })).toBe("bg-sky-500");
  });

  it("key ที่ไม่รู้จักถอยไปใช้สีเทา ไม่หายไปจากกราฟ", () => {
    expect(timelineBarClass("unknown-row", { done: true })).toBe("bg-grey-400");
    expect(timelineBarClass("unknown-row", { done: false })).toBe("bg-grey-200");
    expect(timelineDotClass("unknown-row", { done: true })).toBe("bg-grey-400");
  });
});
