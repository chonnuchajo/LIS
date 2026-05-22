import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';

test.describe('Service Request (ใบขอรับบริการ) print', () => {
  test('renders print template when clicking พิมพ์ใบคำขอรับบริการ', async ({ page, request }) => {
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

    await page.addInitScript(() => {
      (window as Window & { __printCalls?: number }).__printCalls = 0;
      window.print = () => {
        (window as Window & { __printCalls?: number }).__printCalls! += 1;
        window.dispatchEvent(new Event('beforeprint'));
      };
    });

    page.on('pageerror', (err) => console.log('[pageerror]', err.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('[console.error]', m.text());
    });

    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto(`${BASE}/petitions/${petitionId}`);
    await expect(page.getByRole('heading', { name: /P-\d{4}-\d{4}/ })).toBeVisible({ timeout: 15000 });

    const printButton = page.getByRole('button', { name: 'พิมพ์ใบคำขอรับบริการ' });
    await expect(printButton).toBeVisible();
    await printButton.click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls ?? 0),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('.hidden.print\\:block').forEach((el) => {
        el.classList.remove('hidden');
      });
    });

    const root = page.locator('.pr-root').first();
    await expect(root).toBeVisible();

    const page1Text = await page.locator('.pr-page1').first().innerText();
    const page2Text = await page.locator('.pr-page2').first().innerText();
    console.log('=== PAGE 1 TEXT ===');
    console.log(page1Text);
    console.log('=== PAGE 2 TEXT ===');
    console.log(page2Text);

    await page.screenshot({
      path: 'tests/e2e/screenshots/service-request-screen.png',
      fullPage: true,
    });
    await page.locator('.pr-page1').first().screenshot({
      path: 'tests/e2e/screenshots/service-request-page1.png',
    });
    await page.locator('.pr-page2').first().screenshot({
      path: 'tests/e2e/screenshots/service-request-page2.png',
    });

    await page.emulateMedia({ media: 'print' });
    await page.locator('.pr-page2').first().screenshot({
      path: 'tests/e2e/screenshots/service-request-page2-print.png',
    });
    await page.locator('.pr-page1').first().screenshot({
      path: 'tests/e2e/screenshots/service-request-page1-print.png',
    });
    await page.pdf({
      path: 'tests/e2e/screenshots/service-request-print.pdf',
      format: 'A4',
      printBackground: true,
    });
  });
});
