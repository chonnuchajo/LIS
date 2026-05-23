import { test } from "@playwright/test";

const DIR = "tests/e2e/screenshots/param-form";

async function openDialog(page: import("@playwright/test").Page) {
  await page.goto("/LIS/parameter-settings");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /เพิ่มพารามิเตอร์/ }).first().click();
  await page.waitForSelector('[role="dialog"]');
}

async function setName(page: import("@playwright/test").Page, name: string) {
  // ชื่อพารามิเตอร์ — first text input in dialog
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('input[placeholder*="pH"]').fill(name);
}

async function applyAll(page: import("@playwright/test").Page) {
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('label:has-text("ใช้กับทั้งหมด") button[role="checkbox"]').click();
}

async function addFieldAndSetType(
  page: import("@playwright/test").Page,
  label: string,
  typeOption: RegExp,
) {
  const dialog = page.locator('[role="dialog"]');
  await dialog.getByRole("button", { name: /เพิ่มช่อง/ }).click();
  // newly added field card auto-expanded — find its ชื่อช่อง input (last one in dialog)
  const labelInput = dialog.locator('input[placeholder*="หมายเหตุ"]').last();
  await labelInput.fill(label);
  // open the LAST ชนิดข้อมูล select
  const typeTriggers = dialog.locator('[role="combobox"]').filter({ hasText: /(ข้อความ|จำนวนเต็ม|ทศนิยม|ตัวเลือก|ภาพถ่าย|จับเวลา)/ });
  await typeTriggers.last().click();
  await page.getByRole("option", { name: typeOption }).click();
}

test("redesign — text field only", async ({ page }) => {
  await openDialog(page);
  await setName(page, "Demo Text");
  await applyAll(page);
  await addFieldAndSetType(page, "หมายเหตุผู้ตรวจ", /ข้อความ/);
  await page.screenshot({ path: `${DIR}/r-01-text.png`, fullPage: true });
});

test("redesign — number field with operator", async ({ page }) => {
  await openDialog(page);
  await setName(page, "Demo Number");
  await applyAll(page);
  await addFieldAndSetType(page, "ค่า pH", /จำนวนเต็ม/);
  // set unit
  const dialog = page.locator('[role="dialog"]');
  const unitInput = dialog.locator('input[placeholder*="mg/L"]').last();
  await unitInput.fill("pH");
  // set operator = between
  const opTriggers = dialog.locator('[role="combobox"]').filter({ hasText: /ไม่ตรวจค่าผิดปกติ|น้อยกว่า|ระหว่าง/ });
  await opTriggers.first().click();
  await page.getByRole("option", { name: /ระหว่าง/ }).click();
  await page.screenshot({ path: `${DIR}/r-02-number-between.png`, fullPage: true });
});

test("redesign — enum field with options", async ({ page }) => {
  await openDialog(page);
  await setName(page, "Demo Enum");
  await applyAll(page);
  await addFieldAndSetType(page, "ลักษณะของยา", /ตัวเลือก/);
  const dialog = page.locator('[role="dialog"]');
  const optInput = dialog.locator('input[placeholder*="Enter"]').last();
  for (const opt of ["ปกติ", "สีจาง", "สีเข้มผิดปกติ"]) {
    await optInput.fill(opt);
    await dialog.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  }
  // tick ปกติ on first option
  const firstNormal = dialog.locator('label:has-text("ปกติ") button[role="checkbox"]').first();
  await firstNormal.click();
  await page.screenshot({ path: `${DIR}/r-03-enum.png`, fullPage: true });
});

test("redesign — timer field compound input (hour)", async ({ page }) => {
  await openDialog(page);
  await setName(page, "Demo Timer");
  await applyAll(page);
  await addFieldAndSetType(page, "เวลาบ่ม", /จับเวลา/);
  const dialog = page.locator('[role="dialog"]');
  // pick unit = hour from the timer unit dropdown (last combobox)
  const unitTrigger = dialog.locator('[role="combobox"]').last();
  await unitTrigger.click();
  await page.getByRole("option", { name: "ชั่วโมง", exact: true }).click();
  await page.screenshot({ path: `${DIR}/r-04-timer-hour.png`, fullPage: true });
});

test("redesign — multiple fields stacked (all types)", async ({ page }) => {
  await openDialog(page);
  await setName(page, "Demo Multi");
  await applyAll(page);
  await addFieldAndSetType(page, "หมายเหตุ", /ข้อความ/);
  await addFieldAndSetType(page, "pH", /จำนวนเต็ม/);
  await addFieldAndSetType(page, "ลักษณะ", /ตัวเลือก/);
  await addFieldAndSetType(page, "เวลาบ่ม", /จับเวลา/);
  await page.screenshot({ path: `${DIR}/r-05-multi.png`, fullPage: true });
});
