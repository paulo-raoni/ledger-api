import { test, expect } from '@playwright/test';
import { createUser, getToken, creditAccount } from '../../fixtures/api';
import { loginViaUI } from '../../fixtures/pages';

/**
 * M5 PR 7 — Graph overhaul E2E (PR 4 + PR 6).
 *
 * Covers: client-block, live-badge in LIVE mode, replay-trigger (Observability
 * header after Autoplay-or-equivalent run), replay-trigger-autoplay (Autoplay
 * finish button), replay-badge toggle, computed animation-duration on fast.
 */

async function primeLastRunEvents(page: import('@playwright/test').Page, token: string) {
  // Seed lastRunEvents by driving SSE traffic while Observability is mounted.
  // AppContext captures events into the replay buffer; PR 4 replay-trigger
  // becomes available once lastRunEvents is non-empty and replayMode === LIVE.
  // The cheapest path in E2E is to trigger Autoplay to completion, but that's
  // 13 steps × 800ms = slow. Instead we drive raw SSE, then click the Autoplay
  // Restart+Replay flow when needed. For most Graph tests we only need
  // lastRunEvents > 0 — achieved by completing an Autoplay run.
  await creditAccount(token, 100);
}

test.describe('M5 Graph', () => {
  test('client-block renders on Observability load', async ({ page }) => {
    await page.goto('/');
    await createUser().then(async (user) => {
      await loginViaUI(page, user.email, user.password);
    });
    await page.getByTestId('mode-observability').first().click();

    await expect(page.getByTestId('client-block')).toBeVisible();
  });

  test('live-badge is visible while replayMode is LIVE', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('mode-observability').first().click();

    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(page.getByTestId('replay-badge')).toHaveCount(0);
  });

  test('replay-trigger-autoplay appears in Autoplay on completion', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();

    // Wait for the full 13-step run to finish. Autoplay completion reveals
    // the Replay-in-Graph button with data-testid="replay-trigger-autoplay".
    await expect(page.getByTestId('replay-trigger-autoplay'))
      .toBeVisible({ timeout: 90_000 });
  });

  test('replay-trigger is visible in Observability header after an Autoplay run', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay'))
      .toBeVisible({ timeout: 90_000 });

    // Switch to Observability — the header-side replay-trigger mirrors
    // lastRunEvents>0 and replayMode==='LIVE'.
    await page.getByTestId('mode-observability').first().click();
    await expect(page.getByTestId('replay-trigger')).toBeVisible();
  });

  test('clicking replay-trigger reveals replay-badge and hides live-badge', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay'))
      .toBeVisible({ timeout: 90_000 });

    // Use the Autoplay-side trigger: it both switches to Observability and
    // starts REPLAY at slow speed (PR 6 §6.2).
    await page.getByTestId('replay-trigger-autoplay').click();

    await expect(page.getByTestId('replay-badge')).toBeVisible();
    await expect(page.getByTestId('live-badge')).toHaveCount(0);
  });

  test('replay "fast" speed yields computed animation-duration=150ms on .packet', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay'))
      .toBeVisible({ timeout: 90_000 });

    await page.getByTestId('replay-trigger-autoplay').click();
    await expect(page.getByTestId('replay-badge')).toBeVisible();

    // Switch to fast speed — the select is rendered beside the REPLAY badge.
    await page.getByTestId('replay-speed-select').selectOption('fast');

    // Wait for a packet whose computed animation-duration reflects "fast"
    // (150ms). Older packets mounted at slow speed (2s / "2s") linger briefly
    // during the animation; a fresh packet is the stable signal.
    await page.waitForFunction(
      () => {
        const pkts = document.querySelectorAll('.packet');
        return Array.from(pkts).some((p) =>
          window.getComputedStyle(p as HTMLElement).animationDuration === '0.15s'
          || window.getComputedStyle(p as HTMLElement).animationDuration === '150ms',
        );
      },
      null,
      { timeout: 30_000 },
    );
  });

  test('replay stop returns the Graph to LIVE', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay'))
      .toBeVisible({ timeout: 90_000 });

    await page.getByTestId('replay-trigger-autoplay').click();
    await expect(page.getByTestId('replay-badge')).toBeVisible();

    await page.getByTestId('replay-stop').click();
    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(page.getByTestId('replay-badge')).toHaveCount(0);
  });

  // Helper kept next to suite for future expansions.
  void primeLastRunEvents;
});
