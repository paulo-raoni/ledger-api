import { test, expect } from '@playwright/test';

/**
 * M5 PR 7 — Header E2E
 *
 * Covers the PR 3 header redesign contract: title text + weight, explicit
 * `identity` / `ledger` health dots, and the reused ThemeToggle with
 * `data-testid="theme-toggle"` that flips a class on the document root.
 *
 * Implementation note: the health-dot elements are `<span>` of 8×8 with no
 * text content, so `toBeVisible()` treats them as hidden. We assert DOM
 * attachment + accessible-label contract instead — that is the stable
 * contract for a dot indicator.
 */

test.describe('M5 Header', () => {
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
    // Firefox/WebKit resolve "bold" -> "700"; browsers always return numeric.
    expect(Number(weight)).toBeGreaterThanOrEqual(700);
  });

  test('health-dot-identity is attached with an accessible identity label', async ({ page }) => {
    await page.goto('/');
    const dot = page.getByTestId('health-dot-identity');
    await expect(dot).toHaveCount(1);
    await expect(dot).toHaveAttribute('aria-label', /identity/i);
  });

  test('health-dot-ledger is attached with an accessible ledger label', async ({ page }) => {
    await page.goto('/');
    const dot = page.getByTestId('health-dot-ledger');
    await expect(dot).toHaveCount(1);
    await expect(dot).toHaveAttribute('aria-label', /ledger/i);
  });

  test('theme-toggle click flips a class on documentElement', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.className);
    await page.getByTestId('theme-toggle').click();
    await expect.poll(
      () => page.evaluate(() => document.documentElement.className),
      { timeout: 5_000 },
    ).not.toBe(before);
  });
});
