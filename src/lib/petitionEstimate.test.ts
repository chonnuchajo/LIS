import { describe, expect, it } from "vitest";
import { addWorkingMinutes, endOfNextWorkingDay } from "./petitionEstimate";

// ปฏิทินอ้างอิง: 13 ก.ค. 2026 = จันทร์, 18 ก.ค. = เสาร์, 19 ก.ค. = อาทิตย์
const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, day, hour, minute);

describe("addWorkingMinutes", () => {
  it("บวกภายในวันเดียวกันเมื่อเวลายังเหลือพอ", () => {
    expect(addWorkingMinutes(at(13, 9), 120)).toEqual(at(13, 11));
  });

  it("ข้ามไปวันทำการถัดไปเมื่อเวลาไม่พอ (16:00 + 3 ชม. -> 10:00 วันถัดไป)", () => {
    expect(addWorkingMinutes(at(13, 16), 180)).toEqual(at(14, 10));
  });

  it("เริ่มก่อนเวลางาน ให้ดันไป 08:00 ของวันเดียวกันก่อน", () => {
    expect(addWorkingMinutes(at(13, 6, 30), 60)).toEqual(at(13, 9));
  });

  it("เริ่มหลังเลิกงาน ให้ดันไป 08:00 ของวันถัดไปก่อน", () => {
    expect(addWorkingMinutes(at(13, 19, 14), 60)).toEqual(at(14, 9));
  });

  it("เสาร์เป็นวันทำงานปกติ", () => {
    expect(addWorkingMinutes(at(18, 9), 60)).toEqual(at(18, 10));
  });

  it("ข้ามวันอาทิตย์ (เสาร์ 16:00 + 2 ชม. -> จันทร์ 09:00)", () => {
    expect(addWorkingMinutes(at(18, 16), 120)).toEqual(at(20, 9));
  });

  it("เริ่มวันอาทิตย์ ให้ดันไป 08:00 วันจันทร์ก่อน", () => {
    expect(addWorkingMinutes(at(19, 10), 60)).toEqual(at(20, 9));
  });

  it("ข้ามหลายวัน (9 ชม./วัน)", () => {
    // 08:00 จันทร์ + 20 ชม. = 9 (จ.) + 9 (อ.) + 2 -> พุธ 10:00
    expect(addWorkingMinutes(at(13, 8), 20 * 60)).toEqual(at(15, 10));
  });

  it("นาที <= 0 คืนเวลาหลังดันเข้าหน้าต่างทำงานแล้ว", () => {
    expect(addWorkingMinutes(at(13, 6), 0)).toEqual(at(13, 8));
    expect(addWorkingMinutes(at(13, 10), -30)).toEqual(at(13, 10));
  });

  it("ไม่แก้ค่า Date ที่รับเข้ามา", () => {
    const input = at(13, 9);
    addWorkingMinutes(input, 120);
    expect(input).toEqual(at(13, 9));
  });
});

describe("endOfNextWorkingDay", () => {
  it("คืน 17:00 ของวันทำการถัดไป", () => {
    expect(endOfNextWorkingDay(at(13, 10, 15))).toEqual(at(14, 17));
  });

  it("จากวันศุกร์ไปวันเสาร์ (เสาร์ทำงาน)", () => {
    expect(endOfNextWorkingDay(at(17, 10))).toEqual(at(18, 17));
  });

  it("จากวันเสาร์ ข้ามอาทิตย์ไปจันทร์", () => {
    expect(endOfNextWorkingDay(at(18, 10))).toEqual(at(20, 17));
  });

  it("จากวันอาทิตย์ ไปจันทร์", () => {
    expect(endOfNextWorkingDay(at(19, 10))).toEqual(at(20, 17));
  });
});
