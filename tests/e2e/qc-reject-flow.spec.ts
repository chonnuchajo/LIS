import { test, expect, request as pwRequest } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';
const PETITION_NO = 'P-2605-0001';
let PETITION_ID = '';

test.describe('QC reject + revision flow', () => {
  test.beforeAll(async () => {
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

  test('QC reject: success → rejected with required note', async ({ page }) => {
    // Set the petition to status=success so the approve/reject buttons appear
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'success', actor: 'test-setup' },
    });

    await page.goto(`${BASE}/qc-testing/${PETITION_ID}`);
    await expect(page.getByText('บันทึกผลแล้ว — รออนุมัติ')).toBeVisible({ timeout: 15_000 });

    // Both buttons should be present
    await expect(page.getByRole('button', { name: 'ส่งให้แก้ไข' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'อนุมัติคำร้อง' })).toBeVisible();

    // Open the revision dialog
    await page.getByRole('button', { name: 'ส่งให้แก้ไข' }).click();
    await expect(page.getByText(`ส่งคำร้อง ${PETITION_NO} ให้แก้ไข`)).toBeVisible();

    // Confirm button should be disabled with empty note
    const confirmBtn = page.locator('button', { hasText: 'ส่งให้แก้ไข' }).last();
    await expect(confirmBtn).toBeDisabled();

    // Fill the note and confirm
    const note = 'ค่าตะกั่วเกินมาตรฐาน — โปรดทดสอบใหม่';
    await page.locator('textarea').fill(note);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // After submit, navigates to /qc-approval; verify backend state
    await expect(page).toHaveURL(/\/qc-approval/);
    const res = await page.request.get(`${API}/petitions/${PETITION_ID}`);
    const body = await res.json();
    expect(body.status).toBe('rejected');
    expect(body.rejectedAt).toBeTruthy();
    const lastReject = [...(body.reviewHistory ?? [])].reverse().find((e: { action: string }) => e.action === 'reject');
    expect(lastReject).toBeTruthy();
    expect(lastReject.note).toBe(note);
  });

  test('submitter view: rejected petition shows banner with note', async ({ page }) => {
    // Petition is now rejected from previous test (or set it)
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'success', actor: 'test-setup' },
    });
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'rejected', actor: 'test-qc', revisionNote: 'ทดสอบ banner' },
    });

    await page.goto(`${BASE}/petitions/${PETITION_ID}`);
    await expect(page.getByText('คำร้องนี้ถูกส่งกลับให้แก้ไข')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('ทดสอบ banner')).toBeVisible();
  });

  test('terminal guard: rejected petition cannot transition further', async ({ page }) => {
    // Reset and reject
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'success', actor: 'test-setup' },
    });
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'rejected', actor: 'test-qc', revisionNote: 'guard test' },
    });

    // Attempting to set back to inProgress must 409
    const res = await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'inProgress', actor: 'tampering' },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(409);
  });

  test('reject without note returns 400', async ({ page }) => {
    await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'success', actor: 'test-setup' },
    });
    const res = await page.request.patch(`${API}/petitions/${PETITION_ID}`, {
      data: { status: 'rejected', actor: 'test-qc' },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  // Restoring the petition to a sensible state for the next test run
  test.afterAll(async () => {
    const ctx = await pwRequest.newContext();
    // The seeded petition is now in a terminal state; reset it back via direct DB
    // would be safer, but we expose no such endpoint. Best effort: leave a note.
    await ctx.dispose();
  });
});
