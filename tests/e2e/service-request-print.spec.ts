import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';

test.describe('Service Request (ใบขอรับบริการ) print', () => {
  test('opens PrintPreviewDialog, POSTs to /api/print, shows toast on success', async ({ page, request }) => {
    // --- 1. Discover a petition with a lab request (same approach as original test) ---
    const listRes = await request.get(`${API}/lab-requests?limit=1`);
    expect(listRes.ok()).toBe(true);
    const listBody = (await listRes.json()) as {
      items: Array<{ _id: string; petitionId: string; labRequestNo: string }>;
    };
    if (listBody.items.length === 0) {
      test.skip(true, 'No lab requests in DB');
    }
    const petitionId = listBody.items[0].petitionId;
    const labRequestNo = listBody.items[0].labRequestNo;
    console.log('using petition:', petitionId, 'lab request:', labRequestNo);

    page.on('pageerror', (err) => console.log('[pageerror]', err.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('[console.error]', m.text());
    });

    // --- 2. Mock print API routes BEFORE navigation ---
    // /api/print/config — service-request has a printer configured
    await page.route('**/api/print/config', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { slug: 'service-request', printerName: 'TEST', copies: 1, paperSize: 'A4' },
          ],
        }),
      });
    });

    // /api/print/printers — list of known printers
    await page.route('**/api/print/printers', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ['TEST'] }),
      });
    });

    // POST /api/print — capture body + return success; let GETs fall through
    let capturedPrintBody: Record<string, unknown> | null = null;
    await page.route('**/api/print', async (route) => {
      if (route.request().method() === 'POST') {
        capturedPrintBody = route.request().postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, printer: 'TEST', copies: 1 }),
        });
      }
      // Non-POST requests (shouldn't normally happen on bare /api/print) fall through
      return route.fallback();
    });

    // --- 3. Navigate to petition detail ---
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto(`${BASE}/petitions/${petitionId}`);
    await expect(page.getByRole('heading', { name: /P-\d{4}-\d{4}/ })).toBeVisible({ timeout: 15000 });

    // --- 4. Click print button to open the PrintPreviewDialog ---
    const printButton = page.getByRole('button', { name: 'พิมพ์ใบคำขอรับบริการ' });
    await expect(printButton).toBeVisible();
    await printButton.click();

    // --- 5. Assert the dialog opened with the correct title ---
    // Title pattern: "ตัวอย่างก่อนพิมพ์ — ใบคำขอ (Petition)"
    await expect(page.getByRole('heading', { name: /ตัวอย่างก่อนพิมพ์/ })).toBeVisible({ timeout: 10000 });
    // Also confirm the printer name is shown in the dialog (configured state)
    await expect(page.getByText('→ TEST')).toBeVisible({ timeout: 5000 });
    // The "พิมพ์" button inside the dialog should be ENABLED (printer is configured)
    const dialogPrintButton = page.getByRole('button', { name: /^พิมพ์$/ });
    await expect(dialogPrintButton).toBeEnabled({ timeout: 5000 });

    // --- 6. Click "พิมพ์" inside the dialog and assert POST + toast ---
    await dialogPrintButton.click();

    // Assert POST body has correct docType
    await expect.poll(() => capturedPrintBody, { timeout: 10000 }).not.toBeNull();
    expect(capturedPrintBody).toMatchObject({ docType: 'service-request' });
    expect(typeof (capturedPrintBody as Record<string, unknown>).html).toBe('string');

    // Assert success toast
    await expect(page.getByText(/ส่งพิมพ์ไปยัง TEST/)).toBeVisible({ timeout: 10000 });

    // Dialog should auto-close after success
    await expect(page.getByRole('heading', { name: /ตัวอย่างก่อนพิมพ์/ })).not.toBeVisible({ timeout: 5000 });
  });
});
