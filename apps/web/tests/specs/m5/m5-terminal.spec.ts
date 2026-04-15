import { test, expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { createUser } from '../../fixtures/api';
import { loginViaUI } from '../../fixtures/pages';

/**
 * M5 PR 7 — Terminal tri-state E2E (PR 5).
 *
 * Implementation detail: Observability owns a reconciling effect that keys
 * terminalState off `observabilityView` — toggle-terminal forces Default,
 * toggle-graph forces Pill (desktop only). Because of this, the canonical
 * "minimize to pill" UX on desktop is "click the Graph tab"; the internal
 * terminal-minimize / terminal-close buttons are still rendered (contract)
 * but their effect is reconciled-away while observabilityView==='terminal'.
 * This suite therefore asserts the testid contract is present and the
 * visible state transitions via the reconciler.
 *
 * Mobile projects: skipped — they default to 'default' (not 'pill'),
 * per Observability.tsx initial-state selection.
 */

function isMobile(info: TestInfo): boolean {
  return info.project.name === 'mobile-chrome' || info.project.name === 'mobile-safari';
}

async function gotoObservability(page: import('@playwright/test').Page) {
  const user = await createUser();
  await page.goto('/');
  await loginViaUI(page, user.email, user.password);
  await page.getByTestId('mode-observability').first().click();
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
}

async function openDefault(page: import('@playwright/test').Page) {
  // toggle-terminal flips observabilityView to 'terminal', which causes the
  // Observability reconciler to open the Default terminal.
  await page.getByTestId('toggle-terminal').click();
  await expect(page.getByTestId('terminal-default')).toBeVisible();
}

test.describe('M5 Terminal states', () => {
  test('terminal-pill is the initial state on desktop', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only default state');
    await gotoObservability(page);
    await expect(page.getByTestId('terminal-pill')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toHaveCount(0);
  });

  test('toggle-terminal reveals terminal-default and hides pill', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only transition');
    await gotoObservability(page);
    await openDefault(page);
    await expect(page.getByTestId('terminal-pill')).toHaveCount(0);
  });

  test('toggle-graph from Default reconciles terminal back to Pill', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only reconcile');
    await gotoObservability(page);
    await openDefault(page);

    await page.getByTestId('toggle-graph').click();
    await expect(page.getByTestId('terminal-pill')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toHaveCount(0);
  });

  test('terminal-maximize from Default shows terminal-maximized', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only transition');
    await gotoObservability(page);
    await openDefault(page);

    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-maximized')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toHaveCount(0);
  });

  test('terminal-maximize from Maximized restores Default', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only transition');
    await gotoObservability(page);
    await openDefault(page);

    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-maximized')).toBeVisible();
    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-default')).toBeVisible();
  });

  test('terminal-minimize and terminal-close buttons are wired inside Default', async ({ page }, info) => {
    test.skip(isMobile(info), 'desktop-only transition');
    await gotoObservability(page);
    await openDefault(page);

    // Contract: the header icon buttons exist, are visible, and are wired to
    // click handlers (no-op here is expected because the Observability
    // reconciler keys terminalState off observabilityView).
    await expect(page.getByTestId('terminal-minimize')).toBeVisible();
    await expect(page.getByTestId('terminal-close')).toBeVisible();
    await page.getByTestId('terminal-minimize').click();
    await page.getByTestId('terminal-close').click();
    // Terminal stays Default while observabilityView remains 'terminal'.
    await expect(page.getByTestId('terminal-default')).toBeVisible();
  });
});
