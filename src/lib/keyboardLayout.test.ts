import { describe, expect, it } from "vitest";

import { thaiKedmaneeToEnglish, withThaiKedmaneeFallbacks } from "./keyboardLayout";

describe("thaiKedmaneeToEnglish", () => {
  it("แปลงเลขขวดที่พิมพ์ตอนแป้นเป็นไทยกลับเป็นเลขอังกฤษ", () => {
    expect(thaiKedmaneeToEnglish("ุึุตจ/")).toBe("676902");
  });

  it("แปลงเลขไทยจากแป้นมือถือหรือ iPad เป็นเลขอังกฤษ", () => {
    expect(withThaiKedmaneeFallbacks("๖๗๖๙๐๒")).toContain("676902");
  });

  it("แปลง URL จากเครื่องสแกนที่ยิงตอนแป้นเป็นไทยกลับเป็น URL อังกฤษ", () => {
    expect(thaiKedmaneeToEnglish("้ะะยห://ฟยย-ยสฟืะ.รแยสฟกกฟ.แนท/ศณฆ/หะนแา-กำกีแะรนื?ๆพณก=ี๘ฟิแ๑๒๓")).toBe(
      "https://app-plant.icpladda.com/LIS/stock-deduction?qrId=u_abc123",
    );
  });
});

describe("withThaiKedmaneeFallbacks", () => {
  it("คืนค่าต้นฉบับก่อน fallback เสมอ", () => {
    expect(withThaiKedmaneeFallbacks("676902")).toEqual(["676902"]);
    expect(withThaiKedmaneeFallbacks("ุึุตจ/")).toEqual(["ุึุตจ/", "676902"]);
  });
});
