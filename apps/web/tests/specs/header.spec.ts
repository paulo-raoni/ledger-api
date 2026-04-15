import { test, expect } from '@playwright/test';

/**
 * Header E2E (M4 + M5 consolidated).
 *
 * Covers:
 *  - M4: service health dots (identity / ledger), online / offline / checking
 *    aria-labels, mode-tab switching.
 *  - M5: app-title text + weight contract, theme-toggle toggles the root class
 *    (PR 3 redesign).
 *
 * The dot spans are 8×8 with no text content so `toBeVisible()` treats them
 * as hidden in some browsers — assert DOM attachment + aria-label contract.
 */

test.describe('Header', () => {
  test('app-title is visible and reads "ledger-api"', async ({ page }) => {
    await page.goto('/');
    const title = page.getByTestId('app-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('ledger-api');
  });

  test('app-title computed font-weight is 700 or bolder', async ({ page }) => {
    await page.goto('/');
    const weight = await page.getByTestId('app-title').evaluate(
      (el) => window.getComputedStyle(el as HTMLElement).fontWeight,
    );
    expect(Number(weight)).toBeGreaterThanOrEqual(700);
  });

  test('service health dots are attached', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-identity')).toHaveCount(1);
    await expect(page.getByTestId('health-dot-ledger')).toHaveCount(1);
  });

  test('health dots show online/up after services respond', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(
        () => page.getByTestId('health-dot-identity').getAttribute('aria-label'),
        { timeout: 10_000 },
      )
      .toMatch(/online|up/i);
    await expect
      .poll(
        () => page.getByTestId('health-dot-ledger').getAttribute('aria-label'),
        { timeout: 10_000 },
      )
      .toMatch(/online|up/i);
  });

  test('health dot shows offline/down when identity service is down', async ({ page }) => {
    await page.route('http://localhost:3002/health', (route) => route.abort());
    await page.goto('/');
    await expect
      .poll(
        () => page.getByTestId('health-dot-identity').getAttribute('aria-label'),
        { timeout: 10_000 },
      )
      .toMatch(/offline|down/i);
  });

  test('health dots show checking on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-identity')).toHaveAttribute(
      'aria-label',
      /checking/i,
    );
  });

  test('health-dot-identity carries an accessible identity label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-identity')).toHaveAttribute(
      'aria-label',
      /identity/i,
    );
  });

  test('health-dot-ledger carries an accessible ledger label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('health-dot-ledger')).toHaveAttribute(
      'aria-label',
      /ledger/i,
    );
  });

  test('theme-toggle click flips a class on documentElement', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.className);
    await page.getByTestId('theme-toggle').click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.className), {
        timeout: 5_000,
      })
      .not.toBe(before);
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
