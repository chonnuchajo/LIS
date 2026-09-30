# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qc-reject-flow.spec.ts >> QC reject + revision flow >> QC reject: success → rejected with required note
- Location: tests\e2e\qc-reject-flow.spec.ts:27:3

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
  8   | test.describe('QC reject + revision flow', () => {
  9   |   test.beforeAll(async () => {
  10  |     const ctx = await pwRequest.newContext();
  11  |     const res = await ctx.get(`${API}/petitions?search=${PETITION_NO}&limit=1`);
  12  |     const data = await res.json();
  13  |     const p = data.items?.find((x: { petitionNo: string }) => x.petitionNo === PETITION_NO);
> 14  |     if (!p) throw new Error(`Petition ${PETITION_NO} not found in DB. Create it first.`);
      |                   ^ Error: Petition P-2605-0001 not found in DB. Create it first.
  15  |     PETITION_ID = p._id;
  16  |     await ctx.dispose();
  17  |   });
  18  | 
  19  |   test.beforeEach(async ({ page }) => {
  20  |     page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  21  |     page.on('console', (m) => {
  22  |       if (m.type() === 'error') console.log('[console.error]', m.text());
  23  |     });
  24  |     await page.setViewportSize({ width: 1440, height: 900 });
  25  |   });
  26  | 
  27  |   test('QC reject: success → rejected with required note', async ({ page }) => {
  28  |     // Set the petition to status=success so the approve/reject buttons appear
  29  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  30  |       data: { status: 'success', actor: 'test-setup' },
  31  |     });
  32  | 
  33  |     await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
  34  |     await expect(page.getByText('บันทึกผลแล้ว — รออนุมัติ')).toBeVisible({ timeout: 15_000 });
  35  | 
  36  |     // Both buttons should be present
  37  |     await expect(page.getByRole('button', { name: 'ส่งให้แก้ไข' })).toBeVisible();
  38  |     await expect(page.getByRole('button', { name: 'อนุมัติคำร้อง' })).toBeVisible();
  39  | 
  40  |     // Open the revision dialog
  41  |     await page.getByRole('button', { name: 'ส่งให้แก้ไข' }).click();
  42  |     await expect(page.getByText(`ส่งคำร้อง ${PETITION_NO} ให้แก้ไข`)).toBeVisible();
  43  | 
  44  |     // Confirm button should be disabled with empty note
  45  |     const confirmBtn = page.locator('button', { hasText: 'ส่งให้แก้ไข' }).last();
  46  |     await expect(confirmBtn).toBeDisabled();
  47  | 
  48  |     // Fill the note and confirm
  49  |     const note = 'ค่าตะกั่วเกินมาตรฐาน — โปรดทดสอบใหม่';
  50  |     await page.locator('textarea').fill(note);
  51  |     await expect(confirmBtn).toBeEnabled();
  52  |     await confirmBtn.click();
  53  | 
  54  |     // After submit, navigates to /qc-approval; verify backend state
  55  |     await expect(page).toHaveURL(/\/qc-approval/);
  56  |     const res = await page.request.get(`${API}/petitions/${PETITION_ID}`);
  57  |     const body = await res.json();
  58  |     expect(body.status).toBe('rejected');
  59  |     expect(body.rejectedAt).toBeTruthy();
  60  |     const lastReject = [...(body.reviewHistory ?? [])].reverse().find((e: { action: string }) => e.action === 'reject');
  61  |     expect(lastReject).toBeTruthy();
  62  |     expect(lastReject.note).toBe(note);
  63  |   });
  64  | 
  65  |   test('submitter view: rejected petition shows banner with note', async ({ page }) => {
  66  |     // Petition is now rejected from previous test (or set it)
  67  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  68  |       data: { status: 'success', actor: 'test-setup' },
  69  |     });
  70  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  71  |       data: { status: 'rejected', actor: 'test-qc', revisionNote: 'ทดสอบ banner' },
  72  |     });
  73  | 
  74  |     await page.goto(`${BASE}/petitions/${PETITION_ID}`);
  75  |     await expect(page.getByText('คำร้องนี้ถูกส่งกลับให้แก้ไข')).toBeVisible({ timeout: 15_000 });
  76  |     await expect(page.getByText('ทดสอบ banner')).toBeVisible();
  77  |   });
  78  | 
  79  |   test('terminal guard: rejected petition cannot transition further', async ({ page }) => {
  80  |     // Reset and reject
  81  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  82  |       data: { status: 'success', actor: 'test-setup' },
  83  |     });
  84  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  85  |       data: { status: 'rejected', actor: 'test-qc', revisionNote: 'guard test' },
  86  |     });
  87  | 
  88  |     // Attempting to set back to inProgress must 409
  89  |     const res = await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  90  |       data: { status: 'inProgress', actor: 'tampering' },
  91  |       failOnStatusCode: false,
  92  |     });
  93  |     expect(res.status()).toBe(409);
  94  |   });
  95  | 
  96  |   test('reject without note returns 400', async ({ page }) => {
  97  |     await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  98  |       data: { status: 'success', actor: 'test-setup' },
  99  |     });
  100 |     const res = await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
  101 |       data: { status: 'rejected', actor: 'test-qc' },
  102 |       failOnStatusCode: false,
  103 |     });
  104 |     expect(res.status()).toBe(400);
  105 |   });
  106 | 
  107 |   // Restoring the petition to a sensible state for the next test run
  108 |   test.afterAll(async () => {
  109 |     const ctx = await pwRequest.newContext();
  110 |     // The seeded petition is now in a terminal state; reset it back via direct DB
  111 |     // would be safer, but we expose no such endpoint. Best effort: leave a note.
  112 |     await ctx.dispose();
  113 |   });
  114 | });
```