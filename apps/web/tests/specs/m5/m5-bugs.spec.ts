import { test, expect } from '@playwright/test';
import { createUser, getToken, creditAccount } from '../../fixtures/api';
import { loginViaUI } from '../../fixtures/pages';

/**
 * M5 PR 7 — Bug-fix regression suite (PRs 1 and 2).
 *
 * - Accordion toggle (Fix 2a)
 * - Token pill updates after Playground POST /auth (Fix 2b)
 * - SSE persistence across Observability ⇄ Autoplay tab switches (Fix 2c)
 * - USD amount format `$50.00` (Fix 2d + D08)
 * - Terminal latency ≤1 decimal (Fix 2e)
 */

test.describe('M5 Bugs', () => {
  test('playground accordion: clicking an open section closes it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();

    const section = page.getByTestId('section-identity');
    const toggle = page.getByTestId('section-identity-toggle');

    // Identity section defaults to open on Playground load.
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect.poll(() => toggle.getAttribute('aria-expanded'), { timeout: 5_000 })
      .toBe('false');

    // Wrapper still mounted (it hosts the toggle); only the body collapses.
    await expect(section).toBeVisible();
  });

  test('playground POST /auth populates the token pill', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');

    // Token pill renders null when there is no token.
    await expect(page.getByTestId('token-pill')).toHaveCount(0);

    await loginViaUI(page, user.email, user.password);

    const pill = page.getByTestId('token-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('Bearer');
  });

  test('SSE persists across Autoplay ⇄ Observability tab switches', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await loginViaUI(page, user.email, user.password);

    // Go to Observability and open the Default terminal so events show up.
    await page.getByTestId('mode-observability').first().click();
    await page.getByTestId('toggle-terminal').click();
    await page.waitForFunction(
      () => {
        // Terminal and Graph each render a sse-status node. Any one at
        // "connected" is sufficient to declare the pipeline live.
        const nodes = document.querySelectorAll('[data-testid="sse-status"]');
        return Array.from(nodes).some(
          (n) => ((n.textContent ?? '').trim() === 'connected'),
        );
      },
      null,
      { timeout: 30_000 },
    );

    // Fire one event while we're on Observability and confirm it lands.
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 1000);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 1,
      null,
      { timeout: 15_000 },
    );
    const linesBefore = await page.evaluate(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length,
    );

    // Switch away (Autoplay) and back (Observability). With SSE lifted to
    // AppContext, no reconnect occurs and previously seen events stay.
    await page.getByTestId('mode-autoplay').click();
    await page.getByTestId('mode-observability').first().click();
    await page.getByTestId('toggle-terminal').click();

    // SSE remains connected on return.
    await page.waitForFunction(
      () => {
        const nodes = document.querySelectorAll('[data-testid="sse-status"]');
        return Array.from(nodes).some(
          (n) => ((n.textContent ?? '').trim() === 'connected'),
        );
      },
      null,
      { timeout: 15_000 },
    );

    // New events emitted during the tab-switch sequence append (not replace).
    await creditAccount(token, 500);
    await page.waitForFunction(
      (prev) =>
        document.querySelectorAll('[data-testid="terminal-line"]').length > prev,
      linesBefore,
      { timeout: 15_000 },
    );
  });

  test('amount renders as USD (e.g. $50.00), never R$', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000); // 5000 cents = $50.00

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const balance = page.getByTestId('db-table-balance');
    await expect(balance).toBeVisible();
    await expect(balance).toContainText('$50.00');

    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain('R$');
  });

  test('terminal latency renders with at most 1 decimal place', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('mode-observability').first().click();
    await page.getByTestId('toggle-terminal').click();
    await page.waitForFunction(
      () => {
        const nodes = document.querySelectorAll('[data-testid="sse-status"]');
        return Array.from(nodes).some(
          (n) => ((n.textContent ?? '').trim() === 'connected'),
        );
      },
      null,
      { timeout: 30_000 },
    );

    // Trigger a few events so at least one response log line is emitted.
    const { token } = await getToken(user.email, user.password);
    for (let i = 0; i < 3; i++) await creditAccount(token, 100);

    // Wait for a line that carries a `Nms` or `N.Nms` latency.
    await page.waitForFunction(
      () => {
        const lines = document.querySelectorAll('[data-testid="terminal-line"]');
        for (const l of Array.from(lines)) {
          const t = (l.textContent ?? '');
          if (/\b\d+(?:\.\d)?ms\b/.test(t)) return true;
        }
        return false;
      },
      null,
      { timeout: 15_000 },
    );

    // Negative assertion: no line contains more than one decimal in a ms reading.
    const hasTooManyDecimals = await page.evaluate(() => {
      const lines = document.querySelectorAll('[data-testid="terminal-line"]');
      for (const l of Array.from(lines)) {
        const t = (l.textContent ?? '');
        if (/\b\d+\.\d{2,}ms\b/.test(t)) return true;
      }
      return false;
    });
    expect(hasTooManyDecimals).toBe(false);
  });
});
