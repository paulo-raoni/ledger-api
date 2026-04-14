import { test, expect } from '@playwright/test';

test.describe('Header', () => {

  test('service health dots visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-identity')).toBeVisible();
    await expect(page.getByTestId('health-dot-ledger')).toBeVisible();
  });

  test('health dots show green when services are up', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const identity = page.getByTestId('health-dot-identity');
    const ledger = page.getByTestId('health-dot-ledger');
    await expect(identity).toHaveAttribute('aria-label', /online|up/i);
    await expect(ledger).toHaveAttribute('aria-label', /online|up/i);
  });

  test('health dot shows red when service is down', async ({ page }) => {
    await page.route('http://localhost:3002/health', route => route.abort());
    await page.goto('/');
    await page.waitForTimeout(5000);
    await expect(page.getByTestId('health-dot-identity'))
      .toHaveAttribute('aria-label', /offline|down/i);
  });

  test('health dots show yellow/checking state on initial load', async ({ page }) => {
    await page.goto('/');
    const identity = page.getByTestId('health-dot-identity');
    await expect(identity).toHaveAttribute('aria-label', /checking/i);
  });

  test('mode tabs switch active mode', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    await expect(page.getByTestId('step-description')).toBeVisible();

    await page.getByTestId('mode-playground').click();
    await expect(page.getByTestId('section-identity')).toBeVisible();

    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('btn-pause')).toBeVisible();
  });
});
