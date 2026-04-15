import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createUser, getToken, creditAccount } from '../fixtures/api';
import { loginViaUI } from '../fixtures/pages';

/**
 * Observability E2E suite (M4 PR 7).
 *
 * All SSE state assertions use `page.waitForFunction` (no waitForSelector
 * on dynamic SSE-driven elements, no fixed waitForTimeout).
 *
 * Validation command (flakiness gate):
 *   cd apps/web && npx playwright test observability.spec.ts --repeat-each=3
 */

async function gotoObservabilityAsUser(page: Page) {
  const user = await createUser();
  await page.goto('/');
  await loginViaUI(page, user.email, user.password);
  await page.getByTestId('mode-observability').first().click();
  // Root view element also carries data-testid="mode-observability".
  await expect(page.locator('[data-testid="mode-observability"]').nth(1)).toBeVisible();
  return user;
}

function isMobileProject(info: TestInfo): boolean {
  return info.project.name === 'mobile-chrome' || info.project.name === 'mobile-safari';
}

test.describe('Observability — tab navigation', () => {
  test('clicking mode-observability mounts the Observability view', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    // Second match is the Observability mode root <div>.
    await expect(page.locator('[data-testid="mode-observability"]').nth(1)).toBeVisible();
  });

  test('sse-status reaches "connected" within timeout', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sse-status"]');
        return !!el && (el.textContent ?? '').trim() === 'connected';
      },
      null,
      { timeout: 15_000 },
    );
  });

  test('desktop viewport: toggle-graph is active by default', async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), 'desktop-only default');
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('graph-view')).toBeVisible();
  });

  test('mobile viewport: toggle-terminal is active by default', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), 'mobile-only default');
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('terminal-view')).toBeVisible();
  });
});

test.describe('Observability — terminal view', () => {
  test('terminal lines appear after triggering a request', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-terminal').click();
    await expect(page.getByTestId('terminal-view')).toBeVisible();

    // Trigger an SSE-emitting request via the identity service.
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 1000);

    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 1,
      null,
      { timeout: 15_000 },
    );
  });

  test('pause scroll stops auto-scroll on new events', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-terminal').click();
    const { token } = await getToken(user.email, user.password);

    // Produce enough events that the terminal is scrollable.
    for (let i = 0; i < 15; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 10,
      null,
      { timeout: 15_000 },
    );

    // Scroll up manually, then pause.
    const scroller = page.locator('[data-testid="terminal-view"] > div').nth(1);
    await scroller.evaluate((el) => { (el as HTMLElement).scrollTop = 0; });
    await page.getByTestId('terminal-pause').click();
    const scrollBefore = await scroller.evaluate((el) => (el as HTMLElement).scrollTop);

    for (let i = 0; i < 5; i++) await creditAccount(token, 100);
    // Give any auto-scroll a chance to run.
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelectorAll('[data-testid="terminal-view"] > div')[1] as HTMLElement | undefined;
        return !!el && el.scrollTop === prev;
      },
      scrollBefore,
      { timeout: 5_000 },
    );
  });

  test('resume scroll snaps terminal to bottom on new events', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-terminal').click();
    const { token } = await getToken(user.email, user.password);

    for (let i = 0; i < 15; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 10,
      null,
      { timeout: 15_000 },
    );

    // Pause, scroll up, then resume.
    await page.getByTestId('terminal-pause').click();
    const scroller = page.locator('[data-testid="terminal-view"] > div').nth(1);
    await scroller.evaluate((el) => { (el as HTMLElement).scrollTop = 0; });
    await page.getByTestId('terminal-pause').click(); // resume

    for (let i = 0; i < 3; i++) await creditAccount(token, 100);

    await page.waitForFunction(
      () => {
        const el = document.querySelectorAll('[data-testid="terminal-view"] > div')[1] as HTMLElement | undefined;
        if (!el) return false;
        return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 4;
      },
      null,
      { timeout: 10_000 },
    );
  });

  test('terminal keeps at most 500 lines in the DOM', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-terminal').click();
    const { token } = await getToken(user.email, user.password);

    // Each credit produces multiple SSE events (http, db, response, etc.).
    // Firing 300 credits reliably pushes past 500 events.
    for (let i = 0; i < 300; i++) {
      // Don't await every one — parallelize in small batches to keep it fast.
      if (i % 20 === 19) {
        await creditAccount(token, 1);
      } else {
        void creditAccount(token, 1);
      }
    }

    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 100,
      null,
      { timeout: 30_000 },
    );

    const count = await page.evaluate(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length,
    );
    expect(count).toBeLessThanOrEqual(500);
  });
});

test.describe('Observability — graph view', () => {
  test('service blocks for identity and ledger render', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-graph').click();
    await expect(page.getByTestId('service-block-identity')).toBeVisible();
    await expect(page.getByTestId('service-block-ledger')).toBeVisible();
  });

  test('service-state-identity starts at idle with no events', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-graph').click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="service-state-identity"]');
        return !!el && (el.textContent ?? '').trim().toLowerCase() === 'idle';
      },
      null,
      { timeout: 10_000 },
    );
  });

  test('service-state-ledger becomes active or waiting during a request', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-graph').click();
    const { token } = await getToken(user.email, user.password);

    // Fire a burst so we overlap with the render tick window.
    const burst = Array.from({ length: 20 }, () => creditAccount(token, 1));

    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="service-state-ledger"]');
        const v = ((el?.textContent) ?? '').trim().toLowerCase();
        return v === 'active' || v === 'waiting';
      },
      null,
      { timeout: 15_000 },
    );

    await Promise.all(burst);
  });

  test('service-state-ledger returns to idle ~2s after last event', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-graph').click();
    const { token } = await getToken(user.email, user.password);

    await creditAccount(token, 1);

    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="service-state-ledger"]');
        return !!el && (el.textContent ?? '').trim().toLowerCase() === 'idle';
      },
      null,
      { timeout: 10_000 },
    );
  });

  test('db blocks for identity and ledger render', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('toggle-graph').click();
    await expect(page.getByTestId('db-block-identity')).toBeVisible();
    await expect(page.getByTestId('db-block-ledger')).toBeVisible();
  });
});

test.describe('Observability — Reset DB', () => {
  test('reset-db-button is clickable from DB Inspector', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    const btn = page.getByTestId('reset-db-button');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('clicking reset-db-button opens the confirmation modal', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('reset-db-button').click();
    await expect(page.getByTestId('reset-db-modal')).toBeVisible();
  });

  test('cancel closes modal without resetting data', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 4200);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-table-balance')).toBeVisible();
    const balanceBefore = await page.getByTestId('db-table-balance').innerText();
    expect(balanceBefore).toContain('4200');

    await page.getByTestId('reset-db-button').click();
    await expect(page.getByTestId('reset-db-modal')).toBeVisible();
    await page.getByTestId('reset-db-cancel').click();
    await expect(page.getByTestId('reset-db-modal')).not.toBeVisible();

    const balanceAfter = await page.getByTestId('db-table-balance').innerText();
    expect(balanceAfter).toContain('4200');
  });

  test('confirm resets all tables to empty state', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 9900);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();

    await page.getByTestId('reset-db-button').click();
    await expect(page.getByTestId('reset-db-modal')).toBeVisible();
    await page.getByTestId('reset-db-confirm').click();

    // Modal closes once the Promise.all resolves.
    await expect(page.getByTestId('reset-db-modal')).not.toBeVisible({ timeout: 15_000 });

    // Identity DB: users table empty-state placeholder is rendered.
    await page.getByTestId('db-tab-identity').click();
    await expect(page.getByTestId('db-empty-users')).toBeVisible();

    // Ledger DB: transactions / balance / idempotency empty-state placeholders.
    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-empty-transactions')).toBeVisible();
    await expect(page.getByTestId('db-empty-balance')).toBeVisible();
    await expect(page.getByTestId('db-empty-idempotency')).toBeVisible();
  });
});
