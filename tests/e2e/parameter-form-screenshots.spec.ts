import { test, expect } from "@playwright/test";

const SCREEN_DIR = "tests/e2e/screenshots/param-form";

test.describe("Parameter form screenshots for design review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/LIS/parameter-settings");
    await page.waitForLoadState("networkidle");
  });

  test("01 list view", async ({ page }) => {
    await page.screenshot({
      path: `${SCREEN_DIR}/01-list.png`,
      fullPage: true,
    });
  });

  test("02 dialog empty (text type default)", async ({ page }) => {
    await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
    await page.waitForSelector('[role="dialog"]');
    // เพิ่ม value field 1 ตัว
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/02-dialog-text.png`,
      fullPage: true,
    });
  });

  test("03 dialog with number/operator field", async ({ page }) => {
    await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByLabel(/ชื่อพารามิเตอร์/).fill("Demo pH");
    await page.getByRole("checkbox", { name: /ใช้กับทั้งหมด/ }).check();
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    // type = number
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('label:has-text("ชื่อช่อง")').locator("..").locator("input").fill("pH");
    // open ชนิดข้อมูล select
    const typeTrigger = dialog.locator('label:has-text("ชนิดข้อมูล")').locator("..").locator('button[role="combobox"]');
    await typeTrigger.click();
    await page.getByRole("option", { name: /จำนวนเต็ม/ }).click();
    // unit
    await dialog.locator('label:has-text("หน่วย")').first().locator("..").locator("input").fill("pH");
    // operator → between (to show 2 inputs)
    const opTrigger = dialog.locator('label:has-text("เงื่อนไข")').locator("..").locator('button[role="combobox"]');
    await opTrigger.click();
    await page.getByRole("option", { name: /ระหว่าง/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/03-dialog-number-between.png`,
      fullPage: true,
    });
  });

  test("04 dialog with enum field + options", async ({ page }) => {
    await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByLabel(/ชื่อพารามิเตอร์/).fill("Demo Visual");
    await page.getByRole("checkbox", { name: /ใช้กับทั้งหมด/ }).check();
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('label:has-text("ชื่อช่อง")').locator("..").locator("input").fill("สีของยาก่อนผสม");
    const typeTrigger = dialog.locator('label:has-text("ชนิดข้อมูล")').locator("..").locator('button[role="combobox"]');
    await typeTrigger.click();
    await page.getByRole("option", { name: /ตัวเลือก/ }).click();
    // add 3 options
    const optDraft = dialog.locator('input[placeholder*="Enter"]').first();
    for (const opt of ["ปกติ", "สีจาง", "สีเข้มผิดปกติ"]) {
      await optDraft.fill(opt);
      await dialog.getByRole("button", { name: "เพิ่ม" }).click();
    }
    // tick ปกติ for first option
    await dialog.locator('div:has-text("ปกติ")').locator('label:has-text("ปกติ")').first().locator('button[role="checkbox"]').click();
    await page.screenshot({
      path: `${SCREEN_DIR}/04-dialog-enum.png`,
      fullPage: true,
    });
  });

  test("05 dialog with timer field (compound input)", async ({ page }) => {
    await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByLabel(/ชื่อพารามิเตอร์/).fill("Demo Incubation");
    await page.getByRole("checkbox", { name: /ใช้กับทั้งหมด/ }).check();
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('label:has-text("ชื่อช่อง")').locator("..").locator("input").fill("เวลาบ่ม");
    const typeTrigger = dialog.locator('label:has-text("ชนิดข้อมูล")').locator("..").locator('button[role="combobox"]');
    await typeTrigger.click();
    await page.getByRole("option", { name: /จับเวลา/ }).click();
    // pick unit hour
    const unitTrigger = dialog.locator('label:has-text("หน่วย")').locator("..").locator('button[role="combobox"]').last();
    await unitTrigger.click();
    await page.getByRole("option", { name: /ชั่วโมง/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/05-dialog-timer-hour.png`,
      fullPage: true,
    });
    // change to day to show 4 boxes
    await unitTrigger.click();
    await page.getByRole("option", { name: /วัน/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/06-dialog-timer-day.png`,
      fullPage: true,
    });
    // change to month to show 5 boxes
    await unitTrigger.click();
    await page.getByRole("option", { name: /เดือน/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/07-dialog-timer-month.png`,
      fullPage: true,
    });
  });

  test("08 dialog with multiple fields stacked", async ({ page }) => {
    await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
    await page.waitForSelector('[role="dialog"]');
    await page.getByLabel(/ชื่อพารามิเตอร์/).fill("Demo Multi");
    await page.getByRole("checkbox", { name: /ใช้กับทั้งหมด/ }).check();
    // add 3 fields
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    await page.getByRole("button", { name: /เพิ่มช่อง/ }).click();
    await page.screenshot({
      path: `${SCREEN_DIR}/08-dialog-multi-fields.png`,
      fullPage: true,
    });
  });
});
