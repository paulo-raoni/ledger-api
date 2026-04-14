import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';

test.describe('Error states', () => {

  test('network error shows "Cannot reach service" with Retry button', async ({ page }) => {
    await page.route('http://localhost:3002/**', route => route.abort('connectionrefused'));

    await page.goto('/');
    await expect(page.getByTestId('step-error-unexpected')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="step-error-unexpected"]')).toContainText('Cannot reach service');
    await expect(page.getByTestId('btn-retry')).toBeVisible();
  });

  test('request timeout shows correct message', async ({ page }) => {
    await page.route('http://localhost:3002/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 12_000));
      await route.abort('timedout');
    });
    await page.goto('/');
    await expect(page.getByText('Service unavailable')).toBeVisible({ timeout: 15_000 });
  });

  test('401 in Playground shows Login required', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-GET-balance').click();
    await expect(page.getByTestId('endpoint-login-required')).toBeVisible();
  });

  test('Autoplay step 9 — 422 is expected, does not stop flow', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(9);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('422');
    await ap.waitForStep(10, { timeout: 8_000 });
  });

  test('Autoplay step 11 — 409 is expected, does not stop flow', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(11);
    await ap.waitForStepComplete();
    await expect(ap.statusBadge()).toContainText('409');
    await ap.waitForStep(12, { timeout: 8_000 });
  });

  test('401 mid-flow shows Session expired message', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();
    await ap.waitForStep(3);
    await page.route('**/*', route => {
      if (route.request().url().includes('localhost:300')) {
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
      } else { route.continue(); }
    });
    await ap.waitForStep(4);
    await expect(page.getByText('Session expired')).toBeVisible({ timeout: 15_000 });
  });

  test('/debug/db unavailable shows error in DB Inspector', async ({ page }) => {
    await page.route('**/debug/db', route => route.abort());
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-error')).toBeVisible();
  });
});
