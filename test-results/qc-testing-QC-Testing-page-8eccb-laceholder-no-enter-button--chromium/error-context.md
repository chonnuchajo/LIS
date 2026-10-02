# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qc-testing.spec.ts >> QC Testing pages >> list page: sampleSent shows "รอสแกนรับ" placeholder (no enter button)
- Location: tests\e2e\qc-testing.spec.ts:30:3

# Error details

```
Error: Petition P-2605-0001 not found in DB. Create it first.
```

# Test source

```ts
  1   | import { test, expect, request as pwRequest } from '@playwright/test';
  2   | 
  3   | const BASE = 'http://localhost:8000/LIS';
  4   | const API = 'http://localhost:3001/api';
  5   | const PETITION_NO = 'P-2605-0001';
  6   | let PETITION_ID = '';
  7   | 
  8   | test.describe('QC Testing pages', () => {
  9   |   test.beforeAll(async () => {
  10  |     // Look up petition ID dynamically (it may be re-created between sessions)
  11  |     const ctx = await pwRequest.newContext();
  12  |     const res = await ctx.get(`${API}/petitions?search=${PETITION_NO}&limit=1`);
  13  |     const data = await res.json();
  14  |     const p = data.items?.find((x: { petitionNo: string }) => x.petitionNo === PETITION_NO);
> 15  |     if (!p) throw new Error(`Petition ${PETITION_NO} not found in DB. Create it first.`);
      |                   ^ Error: Petition P-2605-0001 not found in DB. Create it first.
  16  |     PETITION_ID = p._id;
  17  |     await ctx.dispose();
  18  |   });
  19  | 
  20  |   test.beforeEach(async ({ page }) => {
  21  |     page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  22  |     page.on('console', (m) => {
  23  |       if (m.type() === 'error') console.log('[console.error]', m.text());
  24  |     });
  25  |     await page.setViewportSize({ width: 1440, height: 900 });
  26  |   });
  27  | 
  28  |   // ── 1. List page ──────────────────────────────────────────────────────────
  29  | 
  30  |   test('list page: sampleSent shows "รอสแกนรับ" placeholder (no enter button)', async ({ page }) => {
  31  |     // Reset petition to sampleSent
  32  |     await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}`, {
  33  |       data: { status: 'sampleSent', actor: 'test' },
  34  |     });
  35  | 
  36  |     await page.goto(`${BASE}/qc-testing`);
  37  |     await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  38  | 
  39  |     const row = page.locator('tr').filter({ hasText: PETITION_NO });
  40  |     await expect(row).toBeVisible({ timeout: 10_000 });
  41  |     await expect(row.getByText('ส่งตัวอย่างแล้ว')).toBeVisible();
  42  | 
  43  |     // No "เข้าตรวจ" button — instead a placeholder
  44  |     await expect(row.getByRole('button', { name: 'เข้าตรวจ' })).toHaveCount(0);
  45  |     await expect(row.getByText('รอสแกนรับ')).toBeVisible();
  46  | 
  47  |     // Status NOT auto-pushed
  48  |     const res = await page.request.get(`${API}/petitions/${PETITION_ID}`);
  49  |     const body = await res.json();
  50  |     expect(body.status).toBe('sampleSent');
  51  | 
  52  |     await page.screenshot({
  53  |       path: 'tests/e2e/screenshots/qc-testing-list-empty.png',
  54  |       fullPage: false,
  55  |     });
  56  |   });
  57  | 
  58  |   test('list page: pendingReview shows "เข้าตรวจ" button → navigates to detail', async ({ page }) => {
  59  |     // Reset and advance to pendingReview
  60  |     await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}`, {
  61  |       data: { status: 'sampleSent', actor: 'test' },
  62  |     });
  63  |     await page.request.patch(`http://localhost:3001/api/petitions/${PETITION_ID}/receive`, {
  64  |       data: { actor: 'test' },
  65  |     });
  66  | 
  67  |     await page.goto(`${BASE}/qc-testing`);
  68  |     await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  69  | 
  70  |     const row = page.locator('tr').filter({ hasText: PETITION_NO });
  71  |     await expect(row).toBeVisible({ timeout: 10_000 });
  72  | 
  73  |     // "เข้าตรวจ" button is now visible
  74  |     const enterBtn = row.getByRole('button', { name: 'เข้าตรวจ' });
  75  |     await expect(enterBtn).toBeVisible();
  76  | 
  77  |     // Click → navigate to detail
  78  |     await enterBtn.click();
  79  |     await expect(page).toHaveURL(`${BASE}/qc-testing/${PETITION_ID}`, { timeout: 5_000 });
  80  |     await expect(page.getByRole('heading', { name: PETITION_NO })).toBeVisible({ timeout: 10_000 });
  81  |   });
  82  | 
  83  |   test('list page: "สแกน QR รับตัวอย่าง" button is visible', async ({ page }) => {
  84  |     await page.goto(`${BASE}/qc-testing`);
  85  |     await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  86  | 
  87  |     // QR scan button should be visible
  88  |     await expect(
  89  |       page.getByRole('button', { name: /สแกน QR รับตัวอย่าง/ }),
  90  |     ).toBeVisible({ timeout: 10_000 });
  91  | 
  92  |     // Clicking opens the modal
  93  |     await page.getByRole('button', { name: /สแกน QR รับตัวอย่าง/ }).click();
  94  |     await expect(page.getByRole('heading', { name: 'สแกน QR รับตัวอย่าง' })).toBeVisible({ timeout: 5_000 });
  95  | 
  96  |     // Close modal
  97  |     await page.locator('[id="qc-receive-qr-reader"]').first().waitFor({ state: 'attached' });
  98  |     // Close by clicking outside or X button
  99  |     await page.locator('button:has(svg.lucide-x)').last().click();
  100 | 
  101 |     await page.screenshot({
  102 |       path: 'tests/e2e/screenshots/qc-testing-list-filter.png',
  103 |       fullPage: false,
  104 |     });
  105 |   });
  106 | 
  107 |   // ── 2. Detail page ────────────────────────────────────────────────────────
  108 | 
  109 |   test('detail page: sidebar visible + petition header', async ({ page }) => {
  110 |     await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
  111 | 
  112 |     // AppLayout sidebar must be present
  113 |     await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  114 | 
  115 |     // Petition number in header
```