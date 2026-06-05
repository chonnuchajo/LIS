import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';

// Petition created for this test suite (no lab request)
const PETITION_NO_LAB_ID = '6a0ffa9d826250d05945d02f'; // P-2605-0002, batch TEST0001 (ends 1)
// Petition with existing lab request
const PETITION_WITH_LAB_ID = '6a0ffaad826250d05945d036'; // P-2605-0003, batch LABTEST001

test.describe('Petition edit page', () => {
  test('step 1: แสดงค่าเดิมของ items และแก้ไขได้', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/petitions/${PETITION_NO_LAB_ID}/edit`);

    // หน้าต้องโหลด
    await expect(page.getByRole('heading', { name: /แก้ไขคำร้อง/ })).toBeVisible({ timeout: 15000 });

    // Stepper ต้องแสดง
    await expect(page.getByText('1. ผู้นำส่ง + รายการตัวอย่าง')).toBeVisible();

    // ชื่อตัวอย่างเดิมต้องอยู่ใน input
    const sampleNameField = page.locator('label:has-text("ชื่อตัวอย่าง")').first().locator('xpath=following::input[1]');
    await expect(sampleNameField).toBeVisible({ timeout: 10000 });
    const originalName = await sampleNameField.inputValue();
    console.log('[step1] ชื่อตัวอย่างเดิม:', originalName);
    expect(originalName.length).toBeGreaterThan(0);

    // เลขแบชเดิมต้องอยู่ใน input
    const batchField = page.locator('label:has-text("เลขแบช")').first().locator('xpath=following::input[1]');
    const originalBatch = await batchField.inputValue();
    console.log('[step1] เลขแบชเดิม:', originalBatch);
    expect(originalBatch.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/e2e/screenshots/edit-step1-prepopulated.png', fullPage: true });

    // แก้ไขหมายเหตุ
    const noteField = page.locator('label:has-text("หมายเหตุ")').first().locator('xpath=following::textarea[1]');
    await noteField.fill('หมายเหตุจาก playwright test');

    // ไปขั้นถัดไป (lab — ใบวางแผน-ควบคุมการผลิต ถูกซ่อนแล้ว)
    await page.getByRole('button', { name: /ถัดไป/ }).click();
    await expect(page.getByText('2. ใบคำขอรับบริการ')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/e2e/screenshots/edit-step2-lab.png', fullPage: true });
  });

  test('step 2 → บันทึก (batch ไม่มี lab) → redirect กลับ detail', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/petitions/${PETITION_NO_LAB_ID}/edit`);
    await expect(page.getByRole('heading', { name: /แก้ไขคำร้อง/ })).toBeVisible({ timeout: 15000 });

    // Step 1 → เพิ่มหมายเหตุ
    const noteField = page.locator('label:has-text("หมายเหตุ")').first().locator('xpath=following::textarea[1]');
    await noteField.fill('updated by playwright');

    // ไป step 2 (lab — ใบวางแผนถูกซ่อน). ปุ่มอาจเป็น "ถัดไป" (มี lab) หรือ "บันทึก" (ไม่มี lab)
    const nextBtn = page.locator('[class*="bg-primary"]').filter({ hasText: /ถัดไป|บันทึก/ });
    const btnText = await nextBtn.innerText();
    console.log('[step1] button text:', btnText);

    await nextBtn.click();

    // ถ้าไปต่อ lab step ให้บันทึกจากนั้น
    const saveBtn = page.getByRole('button', { name: /บันทึกการแก้ไข/ });
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    }

    // ต้อง redirect ไป detail page
    await page.waitForURL(/\/petitions\/[a-f0-9]+$/, { timeout: 15000 });
    const url = page.url();
    console.log('[redirect] url:', url);
    expect(url).toContain('/petitions/');
    expect(url).not.toContain('/edit');

    await page.screenshot({ path: 'tests/e2e/screenshots/edit-after-save.png', fullPage: true });
  });

  test('step 3: lab request โหลดค่าเดิมและแก้ไขได้', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/petitions/${PETITION_WITH_LAB_ID}/edit`);
    await expect(page.getByRole('heading', { name: /แก้ไขคำร้อง/ })).toBeVisible({ timeout: 15000 });

    // Stepper ต้องมี step lab
    await expect(page.getByText('2. ใบคำขอรับบริการ')).toBeVisible();

    // ไป step 2 (lab — ใบวางแผนถูกซ่อน)
    await page.getByRole('button', { name: /ถัดไป/ }).click();
    await expect(page.getByRole('heading', { name: /ใบคำขอรับบริการ/ })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/e2e/screenshots/edit-step3-lab-prepopulated.png', fullPage: true });

    // ชื่อ-นามสกุลต้องแสดงค่าเดิม (read-only div)
    const fullNameLabel = page.locator('label:has-text("ชื่อ-นามสกุล")').first();
    const fullNameField = fullNameLabel.locator('xpath=following-sibling::*[1]');
    const fullNameTag = await fullNameField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] ชื่อ-นามสกุล tag:', fullNameTag);
    expect(fullNameTag).not.toBe('input');
    const fullNameText = (await fullNameField.innerText()).trim();
    console.log('[step3] ชื่อ-นามสกุล value:', fullNameText);
    expect(fullNameText.length).toBeGreaterThan(0);

    // เบอร์โทรต้องแก้ไขได้ — เปลี่ยนค่า
    const phoneField = page.locator('label:has-text("เบอร์โทร")').first().locator('xpath=following::input[1]');
    await expect(phoneField).toBeVisible();
    await phoneField.fill('099-999-9999');

    // ตรวจ reportCustomerName input
    const reportNameField = page.locator('label:has-text("ชื่อบริษัทผู้ส่งตัวอย่าง")').first().locator('xpath=following::input[1]');
    const reportNameVal = await reportNameField.inputValue();
    console.log('[step3] reportCustomerName:', reportNameVal);
    expect(reportNameVal.length).toBeGreaterThan(0);

    // บันทึก
    await page.getByRole('button', { name: /บันทึกการแก้ไข/ }).click();
    await page.waitForURL(/\/petitions\/[a-f0-9]+$/, { timeout: 15000 });
    expect(page.url()).not.toContain('/edit');

    // ตรวจว่า lab request ถูกอัปเดตจริง
    const lrRes = await page.request.get(`${API}/lab-requests?petitionId=${PETITION_WITH_LAB_ID}`);
    const lrData = await lrRes.json();
    const lr = lrData.items?.[0];
    console.log('[verify] lab request phone after update:', lr?.requester?.phone);
    expect(lr?.requester?.phone).toBe('099-999-9999');

    await page.screenshot({ path: 'tests/e2e/screenshots/edit-step3-after-save.png', fullPage: true });
  });

  test('🔍 กดปุ่มกลับจาก step 2 → กลับมา step 1 พร้อมค่าเดิม', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE}/petitions/${PETITION_NO_LAB_ID}/edit`);
    await expect(page.getByRole('heading', { name: /แก้ไขคำร้อง/ })).toBeVisible({ timeout: 15000 });

    // จำค่าเดิม
    const batchField = page.locator('label:has-text("เลขแบช")').first().locator('xpath=following::input[1]');
    const originalBatch = await batchField.inputValue();

    // ไป step 2 (lab — ใบวางแผนถูกซ่อน)
    await page.getByRole('button', { name: /ถัดไป/ }).click();
    await expect(page.getByText('2. ใบคำขอรับบริการ')).toBeVisible({ timeout: 10000 });

    // กลับ
    await page.getByRole('button', { name: /ย้อนกลับ/ }).click();
    await expect(page.getByText('1. ผู้นำส่ง + รายการตัวอย่าง')).toBeVisible({ timeout: 5000 });

    // ค่าต้องยังอยู่
    const batchAfter = await page.locator('label:has-text("เลขแบช")').first().locator('xpath=following::input[1]').inputValue();
    console.log('[probe] batch after back:', batchAfter, 'original:', originalBatch);
    expect(batchAfter).toBe(originalBatch);
  });

  test('🔍 petition ที่ไม่มีอยู่ → แสดง error', async ({ page }) => {
    await page.goto(`${BASE}/petitions/000000000000000000000000/edit`);
    await expect(page.getByText(/โหลดข้อมูลไม่สำเร็จ/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/edit-not-found.png', fullPage: true });
  });
});
