import { test, expect } from '@playwright/test';
import { createUser, getToken, creditAccount, loginViaUI } from '../fixtures/pages';

test.describe('Playground mode', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
  });

  test('Identity section renders all 6 endpoint cards (accordion: Identity open by default)', async ({ page }) => {
    const identityEndpoints = [
      'endpoint-POST-users', 'endpoint-POST-auth',
      'endpoint-GET-users', 'endpoint-GET-users-id',
      'endpoint-PATCH-users-id', 'endpoint-DELETE-users-id',
    ];
    for (const id of identityEndpoints) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test('Ledger section renders 3 endpoint cards after opening', async ({ page }) => {
    await page.getByTestId('section-ledger-toggle').click();
    const ledgerEndpoints = [
      'endpoint-POST-transactions', 'endpoint-GET-transactions',
      'endpoint-GET-balance',
    ];
    for (const id of ledgerEndpoints) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test('Identity and Ledger section headers visible', async ({ page }) => {
    await expect(page.getByTestId('section-identity')).toBeVisible();
    await expect(page.getByTestId('section-ledger')).toBeVisible();
  });

  test('POST /auth — token pill appears after login', async ({ page }) => {
    const { email, password } = await createUser();

    await page.getByTestId('endpoint-POST-auth').click();
    await page.getByTestId('field-email').fill(email);
    await page.getByTestId('field-password').fill(password);
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('token-pill')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('endpoint-status')).toContainText('200');
  });

  test('token copy button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { email, password } = await createUser();

    await page.getByTestId('endpoint-POST-auth').click();
    await page.getByTestId('field-email').fill(email);
    await page.getByTestId('field-password').fill(password);
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('token-pill')).toBeVisible();

    await page.getByTestId('token-copy').click();
    await expect(page.getByTestId('token-copied')).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.length).toBeGreaterThan(50);
  });

  test('GET /balance — returns balance for logged in user', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('section-ledger-toggle').click();
    await page.getByTestId('endpoint-GET-balance').click();
    await page.getByTestId('endpoint-GET-balance').getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-GET-balance').getByTestId('endpoint-status')).toContainText('200');
    const resp = await page.getByTestId('endpoint-GET-balance').getByTestId('endpoint-response').innerText();
    expect(JSON.parse(resp).amount).toBe(5000);
  });

  test('authenticated endpoint shows Login required without token', async ({ page }) => {
    await page.getByTestId('section-ledger-toggle').click();
    await page.getByTestId('endpoint-GET-balance').click();
    await expect(page.getByTestId('endpoint-login-required')).toBeVisible();
    await expect(page.getByTestId('endpoint-send')).toBeDisabled();
  });

  test('POST /transactions — CREDIT creates transaction', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('section-ledger-toggle').click();
    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('endpoint-POST-transactions').getByTestId('field-type').selectOption('CREDIT');
    await page.getByTestId('endpoint-POST-transactions').getByTestId('field-amount').fill('2500');
    await page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-status')).toContainText('200');
    const resp = JSON.parse(await page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-response').innerText());
    expect(resp.type).toBe('CREDIT');
    expect(resp.amount).toBe(2500);
  });

  test('POST /transactions — DEBIT over balance returns 422', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('section-ledger-toggle').click();
    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('endpoint-POST-transactions').getByTestId('field-type').selectOption('DEBIT');
    await page.getByTestId('endpoint-POST-transactions').getByTestId('field-amount').fill('99999');
    await page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-status')).toContainText('422');
    const resp = JSON.parse(await page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-response').innerText());
    expect(resp.error).toBe('INSUFFICIENT_BALANCE');
  });

  test('POST /transactions — Idempotency-Key deduplicates', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 10000);
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('section-ledger-toggle').click();

    const sendDebit = async () => {
      const card = page.getByTestId('endpoint-POST-transactions');
      await card.click();
      await card.getByTestId('field-type').selectOption('DEBIT');
      await card.getByTestId('field-amount').fill('1000');
      await card.getByTestId('field-idempotency_key').fill('idem-test-001');
      await card.getByTestId('endpoint-send').click();
      await expect(card.getByTestId('endpoint-status')).toContainText('200');
      return JSON.parse(await card.getByTestId('endpoint-response').innerText());
    };

    const first = await sendDebit();
    const second = await sendDebit();
    expect(first.id).toBe(second.id);
  });

  test('history panel records each request', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    // Clear pre-existing login/setup entries so the assertion only sees the
    // balance request we're about to make.
    await page.getByTestId('history-clear').click();

    await page.getByTestId('section-ledger-toggle').click();
    const balanceCard = page.getByTestId('endpoint-GET-balance');
    await balanceCard.click();
    await balanceCard.getByTestId('endpoint-send').click();
    await expect(balanceCard.getByTestId('endpoint-status')).toContainText('200');

    const entries = page.getByTestId('history-entry');
    await expect(entries).toHaveCount(1, { timeout: 5_000 });
  });

  test('clear history removes all entries', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('history-clear').click();
    await expect(page.getByTestId('history-entry')).toHaveCount(0);
  });

  test('Send button disabled during in-flight request', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('section-ledger-toggle').click();
    const balanceCard = page.getByTestId('endpoint-GET-balance');
    await balanceCard.click();
    await page.route('**/balance', async route => {
      await new Promise(r => setTimeout(r, 2000));
      await route.continue();
    });
    await balanceCard.getByTestId('endpoint-send').click();
    await expect(balanceCard.getByTestId('endpoint-send')).toBeDisabled();
    await expect(balanceCard.getByTestId('endpoint-loading')).toBeVisible();
  });

  test('history entry click expands request and response', async ({ page }) => {
    const user = await createUser();
    await loginViaUI(page, user.email, user.password);
    await page.getByTestId('section-ledger-toggle').click();
    const balanceCard = page.getByTestId('endpoint-GET-balance');
    await balanceCard.click();
    await balanceCard.getByTestId('endpoint-send').click();
    await expect(balanceCard.getByTestId('endpoint-status')).toContainText('200');
    const entry = page.getByTestId('history-entry').first();
    await entry.click();
    await expect(entry).toContainText('GET');
    await expect(entry).toContainText('/balance');
  });

  // ── Post-M5 regression fixes migrated from specs/m5/m5-bugs.spec.ts ──
  test('accordion: clicking an open Identity section closes it', async ({ page }) => {
    const section = page.getByTestId('section-identity');
    const toggle = page.getByTestId('section-identity-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect.poll(() => toggle.getAttribute('aria-expanded'), { timeout: 5_000 })
      .toBe('false');
    await expect(section).toBeVisible();
  });

  test('POST /auth populates the token pill (D07 fix 2b)', async ({ page }) => {
    const user = await createUser();
    // Token pill renders null when there is no token.
    await expect(page.getByTestId('token-pill')).toHaveCount(0);
    await loginViaUI(page, user.email, user.password);
    const pill = page.getByTestId('token-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('Bearer');
  });

  test('amount renders as USD (e.g. $50.00), never R$', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000); // 5000 cents = $50.00

    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();
    const balance = page.getByTestId('db-table-balance');
    await expect(balance).toBeVisible();
    await expect(balance).toContainText('$50.00');
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain('R$');
  });
});
