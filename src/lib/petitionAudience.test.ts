import { describe, it, expect, beforeEach } from "vitest";
import { audiencesForUser, readSeeAll, writeSeeAll, SEE_ALL_EVENT } from "./petitionAudience";
import { LINE_AUDIENCES, lineAudienceLabel } from "./lineConfig";

describe("audiencesForUser", () => {
  it.each(["R&D", "R & D", "RD", "rd", "แผนก R & D"])("รองรับฝ่าย %s โดยไม่ส่งไปฝ่ายผลิต", (department) => {
    expect(audiencesForUser({ department })).toEqual(["rd"]);
  });

  it("มีตัวเลือกกลุ่ม LINE สำหรับฝ่าย R&D", () => {
    expect(LINE_AUDIENCES.find((audience) => audience.value === "rd")).toMatchObject({ label: "แผนก R&D" });
    expect(lineAudienceLabel("rd")).toBe("แผนก R&D");
  });

  it("แปลง role เป็น audience", () => {
    expect(audiencesForUser({ roles: ["qc-staff"] })).toEqual(["qc"]);
    expect(audiencesForUser({ roles: ["lab-analyze"] })).toEqual(["lab"]);
    expect(audiencesForUser({ roles: ["qc-head", "lab-head"] })).toEqual(["qc", "lab"]);
  });

  it("รองรับ legacy single role", () => {
    expect(audiencesForUser({ role: "qc-head" })).toEqual(["qc"]);
  });

  it("แปลง department เป็น audience ทั้งไทยและอังกฤษ ไม่สนตัวพิมพ์", () => {
    expect(audiencesForUser({ department: "RM" })).toEqual(["rm"]);
    expect(audiencesForUser({ department: "คลังวัตถุดิบ" })).toEqual(["rm"]);
    expect(audiencesForUser({ department: "fg warehouse" })).toEqual(["fg"]);
    expect(audiencesForUser({ department: "แผนกผลิต" })).toEqual(["production"]);
    expect(audiencesForUser({ department: "Production" })).toEqual(["production"]);
  });

  it("ไม่ซ้ำเมื่อ role กับ department ชี้ที่เดียวกัน", () => {
    expect(audiencesForUser({ roles: ["qc-staff"], department: "QC" })).toEqual(["qc"]);
  });

  it("admin ล้วน ๆ ไม่มี department → ไม่ได้ audience พิเศษ", () => {
    expect(audiencesForUser({ roles: ["admin"] })).toEqual([]);
  });

  it("null/undefined → []", () => {
    expect(audiencesForUser(null)).toEqual([]);
    expect(audiencesForUser(undefined)).toEqual([]);
  });
});

describe("สวิตช์ ดูทั้งระบบ", () => {
  beforeEach(() => localStorage.clear());

  it("ค่าเริ่มต้น = false และ write/read ไปกลับได้", () => {
    expect(readSeeAll()).toBe(false);
    writeSeeAll(true);
    expect(readSeeAll()).toBe(true);
    writeSeeAll(false);
    expect(readSeeAll()).toBe(false);
  });

  it("write แล้ว dispatch event ให้ watcher รู้", () => {
    let fired = 0;
    const onEvent = () => { fired += 1; };
    window.addEventListener(SEE_ALL_EVENT, onEvent);
    writeSeeAll(true);
    window.removeEventListener(SEE_ALL_EVENT, onEvent);
    expect(fired).toBe(1);
  });
});
