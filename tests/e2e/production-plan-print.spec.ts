import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8000/LIS';
const API = 'http://localhost:3001/api';

test.describe('Production Plan print', () => {
  test('renders print template when clicking ปุ่มพิมพ์ใบวางแผน-ควบคุมการผลิต', async ({ page, request }) => {
    // Discover a production-dept petition dynamically (DB may have been re-seeded)
    const listRes = await request.get(`${API}/petitions?dept=production&limit=1`);
    expect(listRes.ok()).toBe(true);
    const listBody = (await listRes.json()) as { items: Array<{ _id: string; petitionNo: string }> };
    if (listBody.items.length === 0) {
      test.skip(true, 'No production-dept petitions in the DB — create one first');
    }
    const petitionId = listBody.items[0]._id;
    const petitionNo = listBody.items[0].petitionNo;
    console.log('using petition:', petitionId, petitionNo);

    // Fetch the full petition to know what batch numbers to assert against
    const detailRes = await request.get(`${API}/petitions/${petitionId}`);
    expect(detailRes.ok()).toBe(true);
    const detail = (await detailRes.json()) as { items: Array<{ batchNo: string }> };
    const firstBatch = detail.items[0]?.batchNo ?? '';
    expect(firstBatch.length).toBeGreaterThan(0);
    console.log('expected batch:', firstBatch);

    // Stub window.print so it doesn't block on a real dialog.
    // Do NOT dispatch 'afterprint' here — the app's afterprint handler unmounts
    // the print template, which we want to inspect after clicking.
    await page.addInitScript(() => {
      (window as Window & { __printCalls?: number }).__printCalls = 0;
      window.print = () => {
        (window as Window & { __printCalls?: number }).__printCalls! += 1;
        window.dispatchEvent(new Event('beforeprint'));
      };
    });

    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    await page.goto(`${BASE}/petitions/${petitionId}`);

    // Wait for the petition number to appear (data loaded)
    await expect(page.getByRole('heading', { name: /P-\d{4}-\d{4}/ })).toBeVisible({ timeout: 15000 });

    // The print template div is in the DOM but hidden behind "hidden print:block"
    // After clicking the button, the template renders (mounts via React state)
    const printButton = page.getByRole('button', { name: 'พิมพ์ใบวางแผน-ควบคุมการผลิต' });
    await expect(printButton).toBeVisible();

    // Click to mount the template + fire window.print
    await printButton.click();

    // The trigger waits for the logo image to load before calling window.print —
    // poll until at least one call is recorded
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as Window & { __printCalls?: number }).__printCalls ?? 0,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(1);

    // Force-show the print template div in screen mode so we can assert its content
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('.hidden.print\\:block').forEach((el) => {
        el.classList.remove('hidden');
      });
    });

    // The template root has class .pp-root
    const root = page.locator('.pp-root').first();
    await expect(root).toBeVisible();

    // Verify header strings
    await expect(root.getByText('บริษัท ไอ ซี พี ลัดดา จำกัด').first()).toBeVisible();
    await expect(root.getByText('ใบวางแผน-ควบคุมการผลิต').first()).toBeVisible();

    // Verify section titles 1-4
    await expect(root.getByText('ส่วนที่ 1 การวางแผนผลิต').first()).toBeVisible();
    await expect(root.getByText('ส่วนที่ 2 การตรวจสอบสภาพเครื่องจักร').first()).toBeVisible();
    await expect(root.getByText(/ส่วนที่ 3 ตรวจสอบการทำความสะอาด/).first()).toBeVisible();
    await expect(root.getByText('ส่วนที่ 4 การควบคุมการผลิต').first()).toBeVisible();

    // Verify the batch number actually rendered into ส่วนที่ 1
    await expect(root.getByText(firstBatch).first()).toBeVisible();

    // Verify machine row labels render (Section 2 fixed list)
    await expect(root.getByText('1.   สวิตซ์ไฟเมน').first()).toBeVisible();
    await expect(root.getByText('11.ระบบบำบัดอากาศ').first()).toBeVisible();

    // Capture screenshot for visual review (screen mode)
    await page.screenshot({ path: 'tests/e2e/screenshots/production-plan-screen.png', fullPage: true });

    // Capture print-mode rendering as PDF
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: 'tests/e2e/screenshots/production-plan-print.pdf',
      format: 'A4',
      printBackground: true,
    });
  });
});
