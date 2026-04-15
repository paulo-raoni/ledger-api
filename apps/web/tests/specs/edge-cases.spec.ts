import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';
import { createUser, getToken, creditAccount, loginViaUI } from '../fixtures/pages';

test.describe('Edge cases', () => {
  test.beforeEach(async () => {
    // Fresh DB per test so prior test residue does not skew row counts.
    await fetch('http://localhost:3001/debug/reset?confirm=YES', { method: 'DELETE' });
    await fetch('http://localhost:3002/debug/reset?confirm=YES', { method: 'DELETE' });
  });

  test('amount 0 shows validation error before sending', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('section-ledger-toggle').click();
    const card = page.getByTestId('endpoint-POST-transactions');
    await card.click();
    await card.getByTestId('field-amount').fill('0');
    await card.getByTestId('endpoint-send').click();

    await expect(card.getByTestId('field-error-amount')).toBeVisible();
    await expect(card.getByTestId('field-error-amount')).toContainText('at least 1 cent');
  });

  test('empty required field shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-POST-users').click();
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('field-error-email')).toBeVisible();
  });

  test('invalid email format shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    const card = page.getByTestId('endpoint-POST-users');
    await card.click();
    await card.getByTestId('field-first_name').fill('F');
    await card.getByTestId('field-last_name').fill('L');
    await card.getByTestId('field-password').fill('pass1234');
    await card.getByTestId('field-email').fill('not-an-email');
    await card.getByTestId('endpoint-send').click();
    await expect(card.getByTestId('field-error-email')).toContainText(
      'Invalid email format',
    );
  });

  test('duplicate email returns 409', async ({ page }) => {
    const user = await createUser();

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    const card = page.getByTestId('endpoint-POST-users');
    await card.click();
    await card.getByTestId('field-first_name').fill('Test');
    await card.getByTestId('field-last_name').fill('User');
    await card.getByTestId('field-email').fill(user.email);
    await card.getByTestId('field-password').fill('pass1234');
    await card.getByTestId('endpoint-send').click();

    await expect(card.getByTestId('endpoint-status')).toContainText('409');
  });

  test('DELETE user with non-zero balance returns 409', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    const card = page.getByTestId('endpoint-DELETE-users-id');
    await card.click();
    await card.getByTestId('field-id').fill(user.id);
    await card.getByTestId('endpoint-send').click();

    await expect(card.getByTestId('endpoint-status')).toContainText('409');
  });

  test('Autoplay restart generates different email', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStepComplete();
    const req1 = await page.getByTestId('step-request-body').innerText();
    const email1 = JSON.parse(req1).email;

    // Ensure Date.now() increments so the new runEmail differs.
    await page.waitForTimeout(50);
    await ap.btnRestart().click();
    // Wait until the step-request-body changes from req1 (the old email)
    // before re-reading — restart resets the whole run.
    await expect
      .poll(() => page.getByTestId('step-request-body').innerText(), { timeout: 10_000 })
      .not.toBe(req1);
    await ap.waitForStepComplete();
    const req2 = await page.getByTestId('step-request-body').innerText();
    const email2 = JSON.parse(req2).email;

    expect(email1).not.toBe(email2);
  });

  test('step 7 — idempotent retry does NOT add new transaction row to DB', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    const countTxRows = async () => {
      const table = page.getByTestId('db-table-transactions');
      const a = await table.getByTestId('db-row').count();
      const b = await table.getByTestId('db-row-new').count();
      return a + b;
    };

    await ap.waitForStep(6);
    await ap.waitForStepComplete();
    await ap.btnPause().click();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countBefore = await countTxRows();
    await page.getByTestId('db-close').click();
    await ap.btnResume().click();

    await ap.waitForStep(7);
    await ap.waitForStepComplete();
    await ap.btnPause().click();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countAfter = await countTxRows();

    expect(countAfter).toBe(countBefore);
  });
});
