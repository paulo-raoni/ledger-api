import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';
import { GuidedPage } from '../pages/GuidedPage';
import { createUser, getToken, creditAccount } from '../fixtures/api';

test.describe('DB Inspector', () => {

  test('opens from Autoplay button', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);
    await ap.waitForStep(2);
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
    await expect(page.getByTestId('db-row-new')).toBeVisible({ timeout: 4_000 });
  });

  test('Refresh button re-fetches data', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();

    const timestamp1 = await page.getByTestId('db-inspector').innerText();
    await page.getByTestId('db-refresh').click();
    await page.waitForTimeout(1500);
    const timestamp2 = await page.getByTestId('db-inspector').innerText();
    expect(timestamp2).not.toBe(timestamp1);
  });

  test('Balance Snapshot reflects correct amount', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 7500);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    await page.getByTestId('db-tab-ledger').click();

    const balanceTable = await page.getByTestId('db-table-balance').innerText();
    expect(balanceTable).toContain('R$ 75,00');
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
});
