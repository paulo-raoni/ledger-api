import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createUser, getToken, creditAccount } from '../fixtures/api';
import { loginViaUI } from '../fixtures/pages';

/**
 * Observability E2E — consolidated M4 + M5 + post-M5 bug-fix suite.
 *
 * Post-M5: the Graph/Terminal tab switcher is gone. Both panels render in a
 * flex column; the Terminal pill/default/maximized controls manage terminal
 * visibility. Tests no longer click `toggle-graph` / `toggle-terminal`.
 *
 * Validation command (flakiness gate):
 *   cd apps/web && npx playwright test observability.spec.ts --repeat-each=3
 */

async function gotoObservabilityAsUser(page: Page) {
  const email = `obs-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'testpass123';
  await page.goto('/');
  // Register via UI so AppContext picks up the userId (needed for GraphView
  // event filtering), then login via the Auth card.
  await page.getByTestId('mode-playground').click();
  const registerCard = page.getByTestId('endpoint-POST-users');
  await registerCard.click();
  await registerCard.getByTestId('field-first_name').fill('Ob');
  await registerCard.getByTestId('field-last_name').fill('Sv');
  await registerCard.getByTestId('field-email').fill(email);
  await registerCard.getByTestId('field-password').fill(password);
  await registerCard.getByTestId('endpoint-send').click();
  await expect(registerCard.getByTestId('endpoint-status')).toContainText(
    /2\d\d/,
    { timeout: 8_000 },
  );
  const authCard = page.getByTestId('endpoint-POST-auth');
  await authCard.click();
  await authCard.getByTestId('field-email').fill(email);
  await authCard.getByTestId('field-password').fill(password);
  await authCard.getByTestId('endpoint-send').click();
  await expect(page.getByTestId('token-pill')).toBeVisible({ timeout: 8_000 });
  await page.getByTestId('mode-observability').first().click();
  // Root mode container carries data-testid="mode-observability" at nth(1).
  await expect(page.locator('[data-testid="mode-observability"]').nth(1)).toBeVisible();
  return { email, password };
}

function isMobileProject(info: TestInfo): boolean {
  return info.project.name === 'mobile-chrome' || info.project.name === 'mobile-safari';
}

async function waitForSseConnected(page: Page) {
  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll('[data-testid="sse-status"]');
      return Array.from(nodes).some(
        (n) => (n.textContent ?? '').trim() === 'connected',
      );
    },
    null,
    { timeout: 30_000 },
  );
}

// ──────────────────────────────────────────────────────────────────────
// Mount + SSE + layout (post-M5 fix #1 + #2)
// ──────────────────────────────────────────────────────────────────────
test.describe('Observability — mount & layout', () => {
  test('clicking mode-observability mounts the Observability view', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await expect(page.locator('[data-testid="mode-observability"]').nth(1)).toBeVisible();
  });

  test('sse-status reaches "connected" within timeout', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await waitForSseConnected(page);
  });

  test('graph-view and terminal-pill/default render together (no tab switcher)', async ({ page }, info) => {
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('graph-view')).toBeVisible();
    // Terminal default panel is always rendered below the Graph (desktop
    // + mobile default per post-M5 fix #1 — 200px / 160px respectively).
    await expect(page.getByTestId('terminal-default')).toBeVisible();
    // Legacy tab-switcher testids are retired.
    await expect(page.getByTestId('toggle-graph')).toHaveCount(0);
    await expect(page.getByTestId('toggle-terminal')).toHaveCount(0);
    void info;
  });
});

// ──────────────────────────────────────────────────────────────────────
// Terminal behavior (M4 scroll + M5 state + SSE persistence)
// ──────────────────────────────────────────────────────────────────────
test.describe('Observability — terminal view', () => {
  test('terminal lines appear after triggering a request', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('terminal-view')).toBeVisible();
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
    const { token } = await getToken(user.email, user.password);
    for (let i = 0; i < 15; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 10,
      null,
      { timeout: 15_000 },
    );
    const scroller = page.locator('[data-testid="terminal-view"]');
    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
    await page.getByTestId('terminal-pause').click();
    const scrollBefore = await scroller.evaluate((el) => (el as HTMLElement).scrollTop);

    for (let i = 0; i < 5; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="terminal-view"]') as HTMLElement | null;
        return !!el && el.scrollTop === prev;
      },
      scrollBefore,
      { timeout: 5_000 },
    );
  });

  test('resume scroll snaps terminal to bottom on new events', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    const { token } = await getToken(user.email, user.password);
    for (let i = 0; i < 15; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="terminal-line"]').length >= 10,
      null,
      { timeout: 15_000 },
    );
    await page.getByTestId('terminal-pause').click();
    const scroller = page.locator('[data-testid="terminal-view"]');
    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
    await page.getByTestId('terminal-pause').click(); // resume
    for (let i = 0; i < 3; i++) await creditAccount(token, 100);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="terminal-view"]') as HTMLElement | null;
        if (!el) return false;
        return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 4;
      },
      null,
      { timeout: 10_000 },
    );
  });

  test('terminal keeps at most 500 lines in the DOM', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
    const { token } = await getToken(user.email, user.password);
    for (let i = 0; i < 300; i++) {
      if (i % 20 === 19) await creditAccount(token, 1);
      else void creditAccount(token, 1);
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

  test('SSE persists across Autoplay ⇄ Observability tab switches', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('mode-observability').first().click();
    await waitForSseConnected(page);

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

    await page.getByTestId('mode-autoplay').click();
    await page.getByTestId('mode-observability').first().click();
    await waitForSseConnected(page);

    await creditAccount(token, 500);
    await page.waitForFunction(
      (prev) =>
        document.querySelectorAll('[data-testid="terminal-line"]').length > prev,
      linesBefore,
      { timeout: 15_000 },
    );
  });

  test('terminal latency renders with at most 1 decimal place', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('mode-observability').first().click();
    await waitForSseConnected(page);

    const { token } = await getToken(user.email, user.password);
    for (let i = 0; i < 3; i++) await creditAccount(token, 100);

    await page.waitForFunction(
      () => {
        const lines = document.querySelectorAll('[data-testid="terminal-line"]');
        for (const l of Array.from(lines)) {
          if (/\b\d+(?:\.\d)?ms\b/.test(l.textContent ?? '')) return true;
        }
        return false;
      },
      null,
      { timeout: 15_000 },
    );
    const hasTooManyDecimals = await page.evaluate(() => {
      const lines = document.querySelectorAll('[data-testid="terminal-line"]');
      for (const l of Array.from(lines)) {
        if (/\b\d+\.\d{2,}ms\b/.test(l.textContent ?? '')) return true;
      }
      return false;
    });
    expect(hasTooManyDecimals).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Terminal tri-state (pill ↔ default ↔ maximized) — post-M5: direct
// controls only (no toggle-terminal / toggle-graph).
// ──────────────────────────────────────────────────────────────────────
test.describe('Observability — terminal states', () => {
  test('terminal-default is the initial state (graph and terminal both visible)', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('graph-view')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toBeVisible();
  });

  test('terminal-minimize collapses Default to Pill', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('terminal-minimize').click();
    await expect(page.getByTestId('terminal-pill')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toHaveCount(0);
  });

  test('terminal-pill click restores Default', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('terminal-minimize').click();
    await expect(page.getByTestId('terminal-pill')).toBeVisible();
    await page.getByTestId('terminal-pill').click();
    await expect(page.getByTestId('terminal-default')).toBeVisible();
  });

  test('terminal-maximize from Default shows terminal-maximized', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-maximized')).toBeVisible();
    await expect(page.getByTestId('terminal-default')).toHaveCount(0);
  });

  test('terminal-maximize from Maximized restores Default', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-maximized')).toBeVisible();
    await page.getByTestId('terminal-maximize').click();
    await expect(page.getByTestId('terminal-default')).toBeVisible();
  });

  test('terminal-close collapses to pill', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await page.getByTestId('terminal-close').click();
    await expect(page.getByTestId('terminal-pill')).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────
// Graph view (M4 service/db blocks + M5 client/badge/replay)
// ──────────────────────────────────────────────────────────────────────
test.describe('Observability — graph view', () => {
  test('service blocks for identity and ledger render', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('service-block-identity')).toBeVisible();
    await expect(page.getByTestId('service-block-ledger')).toBeVisible();
  });

  test('db blocks for identity and ledger render', async ({ page }) => {
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('db-block-identity')).toBeVisible();
    await expect(page.getByTestId('db-block-ledger')).toBeVisible();
  });

  test('client-block renders on Observability load', async ({ page }, info) => {
    // Mobile viewport hides client-block when the Terminal is open (graph-compressed).
    test.skip(isMobileProject(info), 'mobile compresses client-block when terminal open');
    await gotoObservabilityAsUser(page);
    await expect(page.getByTestId('client-block')).toBeVisible();
  });

  test('service-state-identity starts at idle with no events', async ({ page }) => {
    await gotoObservabilityAsUser(page);
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
    const { token } = await getToken(user.email, user.password);
    const burst = Array.from({ length: 20 }, () => creditAccount(token, 1));
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="service-state-ledger"]');
        const v = (el?.textContent ?? '').trim().toLowerCase();
        return v === 'active' || v === 'waiting';
      },
      null,
      { timeout: 15_000 },
    );
    await Promise.all(burst);
  });

  test('service-state-ledger returns to idle ~2s after last event', async ({ page }) => {
    const user = await gotoObservabilityAsUser(page);
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
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });
  });

  test('replay-trigger appears in Observability header after an Autoplay run', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });
    await page.getByTestId('mode-observability').first().click();
    await expect(page.getByTestId('replay-trigger')).toBeVisible();
  });

  test('clicking replay-trigger-autoplay reveals replay-badge and hides live-badge', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });
    await page.getByTestId('replay-trigger-autoplay').click();
    await expect(page.getByTestId('replay-badge')).toBeVisible();
    await expect(page.getByTestId('live-badge')).toHaveCount(0);
  });

  test('replay "fast" speed yields computed animation-duration 150ms on .packet', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });
    await page.getByTestId('replay-trigger-autoplay').click();
    await expect(page.getByTestId('replay-badge')).toBeVisible();
    await page.getByTestId('replay-speed-select').selectOption('fast');
    await page.waitForFunction(
      () => {
        const pkts = document.querySelectorAll('.packet');
        return Array.from(pkts).some((p) => {
          const d = window.getComputedStyle(p as HTMLElement).animationDuration;
          return d === '0.15s' || d === '150ms';
        });
      },
      null,
      { timeout: 30_000 },
    );
  });

  test('replay stop returns the Graph to LIVE', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });
    await page.getByTestId('replay-trigger-autoplay').click();
    await expect(page.getByTestId('replay-badge')).toBeVisible();
    await page.getByTestId('replay-stop').click();
    await expect(page.getByTestId('live-badge')).toBeVisible();
    await expect(page.getByTestId('replay-badge')).toHaveCount(0);
  });

  // Post-M5 fix #4: Terminal mirrors the replay + amber banner.
  test('replay: terminal-replay-banner visible and packet animation-duration = 2000ms (slow)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-autoplay').click();
    await expect(page.getByTestId('replay-trigger-autoplay')).toBeVisible({ timeout: 90_000 });

    // Switch to Observability first so terminal is mounted, then trigger replay
    // via the header-side button (replays at slow speed by default).
    await page.getByTestId('mode-observability').first().click();
    await expect(page.getByTestId('replay-trigger')).toBeVisible();
    await page.getByTestId('replay-trigger').click();

    await expect(page.getByTestId('replay-badge')).toBeVisible();
    await expect(page.getByTestId('terminal-replay-banner')).toBeVisible();

    // At slow speed (REPLAY_TIMING.slow.packetMs === 2000) at least one
    // packet's computed animation-duration equals 2000ms.
    await page.waitForFunction(
      () => {
        const pkts = document.querySelectorAll('.packet');
        return Array.from(pkts).some((p) => {
          const d = window.getComputedStyle(p as HTMLElement).animationDuration;
          return d === '2s' || d === '2000ms';
        });
      },
      null,
      { timeout: 30_000 },
    );
  });
});
