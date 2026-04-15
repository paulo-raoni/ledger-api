import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';
import { GuidedPage } from '../pages/GuidedPage';
import { createUser, getToken, creditAccount } from '../fixtures/api';

test.describe('DB Inspector', () => {
  test.beforeEach(async () => {
    await fetch('http://localhost:3001/debug/reset?confirm=YES', { method: 'DELETE' });
    await fetch('http://localhost:3002/debug/reset?confirm=YES', { method: 'DELETE' });
  });

  test('opens from Autoplay button', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('opens from Guided button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const gp = new GuidedPage(page);
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await page.getByTestId('btn-db-inspector').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('opens from Playground', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });

  test('Identity DB tab shows Users table', async ({ page }) => {
    await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-identity').click();
    await expect(page.getByTestId('db-table-users')).toBeVisible();
  });

  test('Users table does NOT contain password column', async ({ page }) => {
    await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-identity').click();
    const tableText = await page.getByTestId('db-table-users').innerText();
    expect(tableText.toLowerCase()).not.toContain('password');
    expect(tableText).not.toContain('$2b$');
  });

  test('Ledger DB tab shows Transactions, Balance Snapshot, Idempotency Cache', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-table-transactions')).toBeVisible();
    await expect(page.getByTestId('db-table-balance')).toBeVisible();
    await expect(page.getByTestId('db-table-idempotency')).toBeVisible();
  });

  test('new row highlighted after step creates data', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);

    await ap.waitForStep(4);
    await ap.waitForStepComplete();
    await ap.btnDbInspector().click();

    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-row-new').first()).toBeVisible({ timeout: 4_000 });
  });

  test('Refresh button re-fetches data', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();

    // Wait 3s so initial "just now" rolls to a measurable "Xs ago",
    // then refresh and confirm the timestamp resets.
    await page.waitForTimeout(3500);
    const before = await page.getByTestId('db-inspector').innerText();
    await page.getByTestId('db-refresh').click();
    await expect.poll(
      async () => (await page.getByTestId('db-inspector').innerText()),
      { timeout: 5_000 },
    ).not.toBe(before);
  });

  test('Balance Snapshot reflects correct amount (USD per D08)', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 7500);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const balanceTable = await page.getByTestId('db-table-balance').innerText();
    expect(balanceTable).toContain('$75.00');
    expect(balanceTable).toContain('7500');
  });

  test('Idempotency Cache shows key after idempotent request', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    await fetch('http://localhost:3001/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': 'test-idem-key-123',
      },
      body: JSON.stringify({ type: 'DEBIT', amount: 1000 }),
    });

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const idemTable = await page.getByTestId('db-table-idempotency').innerText();
    expect(idemTable).toContain('test-idem-key-123');
  });

  test('close button dismisses inspector', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
    await page.getByTestId('db-close').click();
    await expect(page.getByTestId('db-inspector')).not.toBeVisible();
  });

  // ── Post-M5 Reset DB flow — migrated from M4 observability Reset DB block ──
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

    await expect(page.getByTestId('reset-db-modal')).not.toBeVisible({ timeout: 15_000 });

    await page.getByTestId('db-tab-identity').click();
    await expect(page.getByTestId('db-empty-users')).toBeVisible();

    await page.getByTestId('db-tab-ledger').click();
    await expect(page.getByTestId('db-empty-transactions')).toBeVisible();
    await expect(page.getByTestId('db-empty-balance')).toBeVisible();
    await expect(page.getByTestId('db-empty-idempotency')).toBeVisible();
  });

  // Post-M5 fix #5: reset-db-modal is viewport-centered via
  // position:fixed + translate(-50%,-50%). Accept ±20px slack for
  // browser rounding & scroll-bar gutters.
  test('reset-db-modal is centered within ±20px of viewport center', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('reset-db-button').click();
    const modal = page.getByTestId('reset-db-modal');
    await expect(modal).toBeVisible();

    const metrics = await modal.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    expect(Math.abs(metrics.cx - metrics.vw / 2)).toBeLessThanOrEqual(20);
    expect(Math.abs(metrics.cy - metrics.vh / 2)).toBeLessThanOrEqual(20);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Post-M5 fix #6: Graph block latency formatting (≤1 decimal).
// Kept here because the assertion depends on the DB-emitting Autoplay flow
// already exercised by other db-inspector tests.
// ──────────────────────────────────────────────────────────────────────
test.describe('Graph block latency format', () => {
  test('service-block body renders latency with at most one decimal place', async ({ page }) => {
    // Register + login via the Playground so userId gets set in AppContext
    // (the POST /users handler stores it). GraphView filters events by
    // currentUserSub — without userId, all events get filtered out and the
    // block-body never populates.
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'testpass123';

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    const registerCard = page.getByTestId('endpoint-POST-users');
    await registerCard.click();
    await registerCard.getByTestId('field-first_name').fill('Gra');
    await registerCard.getByTestId('field-last_name').fill('Ph');
    await registerCard.getByTestId('field-email').fill(email);
    await registerCard.getByTestId('field-password').fill(password);
    await registerCard.getByTestId('endpoint-send').click();
    await expect(registerCard.getByTestId('endpoint-status')).toContainText(
      /2\d\d/,
      { timeout: 8_000 },
    );

    // userId is now set in AppContext from POST /users. Log in via the Auth
    // card (scoped lookup to avoid strict-mode collision with the Register
    // card's still-filled email field) so the token is set and SSE connects.
    const authCard = page.getByTestId('endpoint-POST-auth');
    await authCard.click();
    await authCard.getByTestId('field-email').fill(email);
    await authCard.getByTestId('field-password').fill(password);
    await authCard.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('token-pill')).toBeVisible({ timeout: 8_000 });

    const tokenRes = await getToken(email, password);
    await page.getByTestId('mode-observability').first().click();

    // Drive requests via the browser's fetch so SSE events carry the
    // matching userId. Short cadence keeps the block expanded.
    let found = false;
    for (let i = 0; i < 25 && !found; i++) {
      await page.evaluate(async (t) => {
        await fetch('http://localhost:3001/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({ type: 'CREDIT', amount: 100 }),
        });
      }, tokenRes.token);
      found = await page.evaluate(() => {
        const bodies = document.querySelectorAll('[data-testid^="block-body-"]');
        for (const b of Array.from(bodies)) {
          if (/\b\d+(?:\.\d)?ms\b/.test(b.textContent ?? '')) return true;
        }
        return false;
      });
      if (!found) await page.waitForTimeout(300);
    }
    expect(found).toBe(true);

    const hasTooManyDecimals = await page.evaluate(() => {
      const bodies = document.querySelectorAll('[data-testid^="block-body-"]');
      for (const b of Array.from(bodies)) {
        if (/\b\d+\.\d{2,}ms\b/.test(b.textContent ?? '')) return true;
      }
      return false;
    });
    expect(hasTooManyDecimals).toBe(false);
  });
});
