import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';

test.describe('Petition new (production) — read-only user fields', () => {
  test('ผู้ยื่นคำขอ + ลูกค้า fields locked to system user', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('[console.error]', m.text());
    });

    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto(`${BASE}/petitions/new?dept=production`);

    await expect(page.getByRole('heading', { name: 'คำขอแผนกผลิต' })).toBeVisible({
      timeout: 15000,
    });

    // ===== Step 1: ผู้ยื่นคำขอ + ผู้นำส่ง =====
    await expect(
      page.getByRole('heading', { name: /ผู้ยื่นคำขอ.*ผู้นำส่ง/ }),
    ).toBeVisible();

    // ผู้ยื่นคำขอ is read-only (no combobox under that label)
    const requesterCombobox = page.getByRole('combobox', { name: /ผู้ยื่นคำขอ/ });
    await expect(requesterCombobox).toHaveCount(0);

    // Read-only display for ผู้ยื่นคำขอ
    const submitterDisplay = page.locator('label:has-text("ผู้ยื่นคำขอ") + div').first();
    await expect(submitterDisplay).toBeVisible();
    const submitterText = (await submitterDisplay.innerText()).trim();
    console.log('[step1] ผู้ยื่นคำขอ shown as:', JSON.stringify(submitterText));
    expect(submitterText.length).toBeGreaterThan(0);
    expect(submitterText).not.toBe('-');

    // ผู้นำส่ง is an editable HR picker (combobox present) and defaulted to logged-in user
    const delivererCombobox = page.getByRole('combobox').filter({ hasText: /./ }).first();
    await expect(delivererCombobox).toBeVisible();
    const delivererText = (await delivererCombobox.innerText()).trim();
    console.log('[step1] ผู้นำส่ง shown as:', JSON.stringify(delivererText));
    expect(delivererText.length).toBeGreaterThan(0);

    // Screenshot step 1
    await page.screenshot({
      path: 'tests/e2e/screenshots/petition-new-step1.png',
      fullPage: true,
    });

    // ===== Fill in a sample row so we can advance =====
    // Need to add a batch like XXXXX01 or XXXXX06 to trigger lab step
    const sampleNameInput = page.locator('input[placeholder*="ชื่อตัวอย่าง" i], input').first();

    // Look for the items section "รายการตัวอย่าง"
    await expect(page.getByRole('heading', { name: 'รายการตัวอย่าง' })).toBeVisible();

    // Find inputs for first sample row — try by label proximity
    const allInputs = await page.locator('input[type="text"], input:not([type])').all();
    console.log('[step1] found', allInputs.length, 'inputs');

    // Use the labels to locate
    const sampleNameField = page.locator('label:has-text("ชื่อตัวอย่าง")').first().locator('xpath=following::input[1]');
    const batchField = page.locator('label:has-text("เลขแบช")').first().locator('xpath=following::input[1]');

    await sampleNameField.fill('Test Sample A');
    await batchField.fill('TEST00001'); // ends in 1 → lab batch

    // Click "ถัดไป"
    await page.getByRole('button', { name: /ถัดไป/ }).click();

    // ===== Step 2: production plan — just click next =====
    await expect(page.getByRole('heading', { name: /ใบวางแผน-ควบคุมการผลิต|วางแผน/ }).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: 'tests/e2e/screenshots/petition-new-step2.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: /ถัดไป/ }).click();

    // ===== Step 3: Lab request =====
    await expect(page.getByRole('heading', { name: /ใบคำขอรับบริการ/ })).toBeVisible({ timeout: 10000 });

    // Check the requester customer info section
    await expect(page.getByRole('heading', { name: 'ข้อมูลลูกค้า / ผู้ขอบริการ' })).toBeVisible();

    // ชื่อ-นามสกุล should be a read-only div (no input)
    const fullNameLabel = page.locator('label:has-text("ชื่อ-นามสกุล")').first();
    await expect(fullNameLabel).toBeVisible();
    const fullNameField = fullNameLabel.locator('xpath=following-sibling::*[1]');
    // Check it's NOT an input
    const fullNameTag = await fullNameField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] ชื่อ-นามสกุล element:', fullNameTag);
    expect(fullNameTag).not.toBe('input');
    const fullNameText = (await fullNameField.innerText()).trim();
    console.log('[step3] ชื่อ-นามสกุล value:', JSON.stringify(fullNameText));
    expect(fullNameText.length).toBeGreaterThan(0);
    expect(fullNameText).not.toBe('-');

    // แผนก
    const deptLabel = page.locator('label:has-text("แผนก")').first();
    await expect(deptLabel).toBeVisible();
    const deptField = deptLabel.locator('xpath=following-sibling::*[1]');
    const deptTag = await deptField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] แผนก element:', deptTag);
    expect(deptTag).not.toBe('input');
    const deptText = (await deptField.innerText()).trim();
    console.log('[step3] แผนก value:', JSON.stringify(deptText));
    expect(deptText.length).toBeGreaterThan(0);
    expect(deptText).not.toBe('-');

    // E-mail
    const emailLabel = page.locator('label:has-text("E-mail")').first();
    await expect(emailLabel).toBeVisible();
    const emailField = emailLabel.locator('xpath=following-sibling::*[1]');
    const emailTag = await emailField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] E-mail element:', emailTag);
    expect(emailTag).not.toBe('input');
    const emailText = (await emailField.innerText()).trim();
    console.log('[step3] E-mail value:', JSON.stringify(emailText));
    expect(emailText.length).toBeGreaterThan(0);
    expect(emailText).not.toBe('-');

    // Confirm ที่อยู่ + เบอร์โทร are STILL editable
    const addressField = page.locator('label:has-text("ที่อยู่")').first().locator('xpath=following-sibling::*[1]');
    const addressTag = await addressField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] ที่อยู่ element:', addressTag);
    expect(['textarea', 'input']).toContain(addressTag);

    const phoneField = page.locator('label:has-text("เบอร์โทร")').first().locator('xpath=following-sibling::*[1]');
    const phoneTag = await phoneField.evaluate((el) => el.tagName.toLowerCase());
    console.log('[step3] เบอร์โทร element:', phoneTag);
    expect(phoneTag).toBe('input');

    await page.screenshot({
      path: 'tests/e2e/screenshots/petition-new-step3.png',
      fullPage: true,
    });
  });
});
