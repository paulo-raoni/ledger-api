import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';

test.describe('Autoplay mode', () => {

  test('completes all 13 steps without intervention', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForAutoplayComplete();
    await expect(ap.progressLabel()).toContainText('Step 13 of 13');
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('step 1 — POST /users — shows Identity badge and 200', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    await expect(page.getByTestId('step-service-badge')).toContainText('IDENTITY');
    await expect(page.getByTestId('step-method')).toContainText('POST');
    await expect(page.getByTestId('step-path')).toContainText('/users');
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('step 2 — POST /auth — token captured and step advances', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(2);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('step 6 — shows Idempotency-Key header', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(6);
    await expect(page.getByTestId('step-idempotency-key')).toContainText('demo-debit-001');
  });

  test('step 7 — retry with same Idempotency-Key returns same transaction id', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(6);
    await ap.waitForStepComplete();
    const body6 = await page.getByTestId('step-response-body').innerText();
    const id6 = JSON.parse(body6).id;

    await ap.waitForStep(7);
    await ap.waitForStepComplete();
    const body7 = await page.getByTestId('step-response-body').innerText();
    const id7 = JSON.parse(body7).id;

    expect(id6).toBe(id7);
  });

  test('step 9 — 422 shows error-expected badge and pauses 4s', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(9);
    await ap.waitForStepComplete();

    await expect(ap.statusBadge()).toContainText('422');
    await expect(ap.errorExpected()).toBeVisible();

    await page.waitForTimeout(1000);
    await expect(ap.progressLabel()).toContainText('Step 9 of 13');

    await ap.waitForStep(10, { timeout: 8_000 });
  });

  test('step 11 — 409 shows error-expected badge, DB Inspector opens automatically', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(11);
    await ap.waitForStepComplete();

    await expect(ap.statusBadge()).toContainText('409');
    await expect(ap.errorExpected()).toBeVisible();
    await expect(page.getByTestId('db-inspector')).toBeVisible({ timeout: 1_000 });
  });

  test('step 13 — DELETE succeeds after zeroing balance', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForAutoplayComplete();
    await expect(ap.statusBadge()).toContainText('200');
    const body = await ap.responseBody().innerText();
    expect(JSON.parse(body).ok).toBe(true);
  });

  test('Pause stops auto-advance, Resume continues', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(3);
    await ap.btnPause().click();

    const labelBefore = await ap.progressLabel().innerText();
    await page.waitForTimeout(4000);
    const labelAfter = await ap.progressLabel().innerText();
    expect(labelBefore).toBe(labelAfter);

    await ap.btnResume().click();
    await ap.waitForStep(4, { timeout: 5_000 });
  });

  test('Restart resets to step 1 with new email', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(4);
    await ap.btnRestart().click();

    await ap.waitForStep(1, { timeout: 3_000 });
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('200');
  });

  test('progress bar advances with each step', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(1);
    const width1 = await ap.progressBar().evaluate(el => (el as HTMLElement).style.width);

    await ap.waitForStep(7);
    const width7 = await ap.progressBar().evaluate(el => (el as HTMLElement).style.width);

    expect(parseFloat(width7)).toBeGreaterThan(parseFloat(width1));
  });

  test('DB Inspector button opens inspector', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(3);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });
});
