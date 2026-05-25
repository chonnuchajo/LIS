import { test, expect, request as pwRequest } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';
const PETITION_NO = 'P-2605-0001';
let PETITION_ID = '';

test.describe('QC Testing pages', () => {
  test.beforeAll(async () => {
    // Look up petition ID dynamically (it may be re-created between sessions)
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${API}/petitions?search=${PETITION_NO}&limit=1`);
    const data = await res.json();
    const p = data.items?.find((x: { petitionNo: string }) => x.petitionNo === PETITION_NO);
    if (!p) throw new Error(`Petition ${PETITION_NO} not found in DB. Create it first.`);
    PETITION_ID = p._id;
    await ctx.dispose();
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('[console.error]', m.text());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // ── 1. List page ──────────────────────────────────────────────────────────

  test('list page: sampleSent shows "รอสแกนรับ" placeholder (no enter button)', async ({ page }) => {
    // Reset petition to sampleSent
    await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}`, {
      data: { status: 'sampleSent', actor: 'test' },
    });

    await page.goto(`${BASE}/qc-testing`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    const row = page.locator('tr').filter({ hasText: PETITION_NO });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('ส่งตัวอย่างแล้ว')).toBeVisible();

    // No "เข้าตรวจ" button — instead a placeholder
    await expect(row.getByRole('button', { name: 'เข้าตรวจ' })).toHaveCount(0);
    await expect(row.getByText('รอสแกนรับ')).toBeVisible();

    // Status NOT auto-pushed
    const res = await page.request.get(`${API}/petitions/${PETITION_ID}`);
    const body = await res.json();
    expect(body.status).toBe('sampleSent');

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-list-empty.png',
      fullPage: false,
    });
  });

  test('list page: pendingReview shows "เข้าตรวจ" button → navigates to detail', async ({ page }) => {
    // Reset and advance to pendingReview
    await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}`, {
      data: { status: 'sampleSent', actor: 'test' },
    });
    await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}/receive`, {
      data: { actor: 'test' },
    });

    await page.goto(`${BASE}/qc-testing`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    const row = page.locator('tr').filter({ hasText: PETITION_NO });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // "เข้าตรวจ" button is now visible
    const enterBtn = row.getByRole('button', { name: 'เข้าตรวจ' });
    await expect(enterBtn).toBeVisible();

    // Click → navigate to detail
    await enterBtn.click();
    await expect(page).toHaveURL(`${BASE}/qc-testing/${PETITION_ID}`, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });
  });

  test('list page: "สแกน QR รับตัวอย่าง" button is visible', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // QR scan button should be visible
    await expect(
      page.getByRole('button', { name: /สแกน QR รับตัวอย่าง/ }),
    ).toBeVisible({ timeout: 10_000 });

    // Clicking opens the modal
    await page.getByRole('button', { name: /สแกน QR รับตัวอย่าง/ }).click();
    await expect(page.getByRole('heading', { name: 'สแกน QR รับตัวอย่าง' })).toBeVisible({ timeout: 5_000 });

    // Close modal
    await page.locator('[id="qc-receive-qr-reader"]').first().waitFor({ state: 'attached' });
    // Close by clicking outside or X button
    await page.locator('button:has(svg.lucide-x)').last().click();

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-list-filter.png',
      fullPage: false,
    });
  });

  // ── 2. Detail page ────────────────────────────────────────────────────────

  test('detail page: sidebar visible + petition header', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);

    // AppLayout sidebar must be present
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Petition number in header
    await expect(
      page.getByRole('heading', { name: PETITION_NO }),
    ).toBeVisible({ timeout: 10_000 });

    // Back button
    await expect(
      page.getByRole('button', { name: '' }).first(),
    ).toBeVisible();

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-detail-header.png',
      fullPage: false,
    });
  });

  test('detail page: item card + applyAll parameter shows fields', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });

    // Item seq 1 card
    await expect(page.getByText(/รายการที่ 1/)).toBeVisible({ timeout: 8_000 });

    // parameter "กายภาพ" (applyAll=true, matches even when testItems is empty)
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 8_000 });

    // field "ลักษณะ" (enum) — expect a combobox/select
    await expect(page.getByText('ลักษณะ')).toBeVisible();
    // field "สี" (text) — expect a label
    await expect(page.getByText('สี')).toBeVisible();

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-detail-fields.png',
      fullPage: true,
    });
  });

  test('detail page: entering text value triggers auto-save indicator', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 8_000 });

    // Find "สี" text input and type a value
    const colorInput = page.locator('label:has-text("สี")').locator('xpath=following::input[1]');
    await expect(colorInput).toBeVisible();
    await colorInput.fill('เหลืองอ่อน');

    // Saving spinner should appear (or saved check) within 2 seconds
    // The debounce is 800ms, so check within 2s for saved state
    await expect(
      page.locator('svg').filter({ has: page.locator('[class*="animate-spin"]') }).or(
        page.locator('[class*="text-green-500"]'),
      ).first(),
    ).toBeVisible({ timeout: 3_000 });

    // Wait for debounce + API to complete (up to 3s after typing)
    await page.waitForTimeout(1_500);

    // "บันทึกแล้ว" text or green check icon should appear
    const greenCheck = page.locator('.text-green-500').first();
    await expect(greenCheck).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-detail-saved.png',
      fullPage: true,
    });
  });

  test('detail page: value persists after page reload', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    // Type a value
    const colorInput = page.locator('label:has-text("สี")').locator('xpath=following::input[1]');
    await colorInput.fill('ขาวขุ่น');
    // Wait for auto-save
    await page.waitForTimeout(1_800);
    await expect(page.locator('.text-green-500').first()).toBeVisible({ timeout: 5_000 });

    // Reload
    await page.reload();
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    // Value should be pre-populated
    const reloadedInput = page.locator('label:has-text("สี")').locator('xpath=following::input[1]');
    await expect(reloadedInput).toHaveValue('ขาวขุ่น', { timeout: 5_000 });

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-detail-persisted.png',
      fullPage: true,
    });
  });

  // ── Conditional note for enum value ─────────────────────────────────────

  test('detail page: enum value in requireNoteOn shows note textarea', async ({ page }) => {
    // Configure the "กายภาพ" parameter so that "ของเหลวขุ่น" requires a note
    const paramsRes = await page.request.get(`${API}/parameters`);
    const params = await paramsRes.json();
    const physical = params.find((p: { name: string }) => p.name === 'กายภาพ');
    if (!physical) throw new Error('Parameter "กายภาพ" not found');

    // Patch valueFields: add requireNoteOn=["ของเหลวขุ่น"] on the "ลักษณะ" field
    const updatedFields = physical.valueFields.map((f: { label: string; type: string; options?: string[] }) => {
      if (f.label === 'ลักษณะ' && f.type === 'enum') {
        return { ...f, requireNoteOn: ['ของเหลวขุ่น'] };
      }
      return f;
    });
    await page.request.patch(`${API}/parameters/${physical._id}`, {
      data: { valueFields: updatedFields },
    });

    // Open QC testing detail page
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    // Find "ลักษณะ" select and pick "ของเหลวขุ่น"
    const select = page.locator('label:has-text("ลักษณะ")').locator('xpath=following::button[1]');
    await select.click();
    await page.getByRole('option', { name: 'ของเหลวขุ่น' }).click();

    // Note textarea should appear — target the one with placeholder mentioning "ของเหลวขุ่น"
    const noteArea = page.locator('textarea[placeholder*="ของเหลวขุ่น"]');
    await expect(noteArea).toBeVisible({ timeout: 3_000 });

    // Type a note and verify auto-save
    await noteArea.fill('ขุ่นมาก ตกตะกอนชั้นล่าง');
    await page.waitForTimeout(1_500);

    // Pick an option that does NOT require a note → that specific note textarea should disappear
    await select.click();
    await page.getByRole('option', { name: 'ของเหลวใส' }).click();
    await expect(noteArea).toHaveCount(0);

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-note-feature.png',
      fullPage: true,
    });

    // Cleanup: restore parameter
    await page.request.patch(`${API}/parameters/${physical._id}`, {
      data: { valueFields: physical.valueFields },
    });
  });

  // ── Save draft / Submit result ───────────────────────────────────────────

  test('detail page: "บันทึกแบบร่าง" navigates back to list', async ({ page }) => {
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'pendingReview', actor: 'test' },
    });
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /บันทึกแบบร่าง/ }).click();
    await expect(page).toHaveURL(`${BASE}/qc-testing`, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'การทดสอบ QC' })).toBeVisible();
  });

  test('detail page: "บันทึกผล" with complete fields → status success', async ({ page }) => {
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'pendingReview', actor: 'test' },
    });

    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    // Ensure ลักษณะ + สี are filled (in case the petition was wiped)
    const select = page.locator('label:has-text("ลักษณะ")').locator('xpath=following::button[1]');
    const selectText = await select.innerText();
    if (selectText.includes('เลือก')) {
      await select.click();
      await page.getByRole('option', { name: 'ของเหลวใส' }).click();
      await page.waitForTimeout(1_200);
    }
    const colorInput = page.locator('label:has-text("สี")').locator('xpath=following::input[1]');
    const colorVal = await colorInput.inputValue();
    if (!colorVal.trim()) {
      await colorInput.fill('เขียวอ่อน');
      await page.waitForTimeout(1_200);
    }

    // Click "บันทึกผล" → status should change to success
    await page.getByRole('button', { name: /บันทึกผล/ }).click();
    await expect(page).toHaveURL(`${BASE}/qc-testing`, { timeout: 8_000 });

    const res = await page.request.get(`${API}/petitions/${PETITION_ID}`);
    const body = await res.json();
    expect(body.status).toBe('success');
  });

  // ── Auto-advance status ─────────────────────────────────────────────────

  test('detail page: opening pendingReview does NOT advance status (only on field entry)', async ({ page }) => {
    // Reset petition to pendingReview via API
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'pendingReview', actor: 'test' },
    });

    // Open detail page → should NOT auto-PATCH
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });

    // Wait briefly to ensure no advance occurred
    await page.waitForTimeout(1_500);

    // Status should STILL be pendingReview
    const after = await page.request.get(`${API}/petitions/${PETITION_ID}`);
    const afterBody = await after.json();
    expect(afterBody.status).toBe('pendingReview');
  });

  test('detail page: entering a value advances pendingReview → inProgress', async ({ page }) => {
    // Reset to pendingReview
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'pendingReview', actor: 'test' },
    });

    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('กายภาพ')).toBeVisible({ timeout: 10_000 });

    // Type into "สี" field
    const colorInput = page.locator('label:has-text("สี")').locator('xpath=following::input[1]');
    await colorInput.fill('ทดสอบ');
    await page.waitForTimeout(1_800);

    // Status should now be inProgress
    const after = await page.request.get(`${API}/petitions/${PETITION_ID}`);
    const afterBody = await after.json();
    expect(afterBody.status).toBe('inProgress');
  });

  // ── QC Dashboard navigation ──────────────────────────────────────────────

  test('QC Dashboard: "ดูรายการคำร้องทั้งหมด" navigates to /qc-testing', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/qc`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // The "คำร้องสำหรับ QC" card has the "ดูรายการคำร้องทั้งหมด" button
    const viewAllBtn = page.getByRole('button', { name: 'ดูรายการคำร้องทั้งหมด' }).first();
    await expect(viewAllBtn).toBeVisible({ timeout: 10_000 });
    await viewAllBtn.click();

    await expect(page).toHaveURL(`${BASE}/qc-testing`, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'การทดสอบ QC' })).toBeVisible();
  });

  // ── 3. Probe: navigation and edge cases ──────────────────────────────────

  test('🔍 back button from detail navigates to list', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });

    // Click back (ArrowLeft button — first button inside main content, not sidebar)
    await page.locator('main button, [role="main"] button').first().click();
    await expect(page).toHaveURL(`${BASE}/qc-testing`, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'การทดสอบ QC' })).toBeVisible();
  });

  test('🔍 non-existent petition shows error state without crashing sidebar', async ({ page }) => {
    await page.goto(`${BASE}/qc-testing/000000000000000000000000`);
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    // Should show error message, not a blank/crashed page
    await expect(
      page.getByText(/ไม่พบข้อมูลคำร้อง|ไม่พบ|error/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: 'tests/e2e/screenshots/qc-testing-detail-notfound.png',
      fullPage: false,
    });
  });
});
