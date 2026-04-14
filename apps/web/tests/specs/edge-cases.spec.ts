import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';
import { createUser, getToken, creditAccount, loginViaUI } from '../fixtures/pages';

test.describe('Edge cases', () => {

  test('amount 0 shows validation error before sending', async ({ page }) => {
    const user = await createUser();
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-POST-transactions').click();
    await page.getByTestId('field-amount').fill('0');
    await page.getByTestId('endpoint-POST-transactions').getByTestId('endpoint-send').click();

    await expect(page.getByTestId('field-error-amount')).toBeVisible();
    await expect(page.getByTestId('field-error-amount')).toContainText('at least 1 cent');
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
    await page.getByTestId('endpoint-POST-users').click();
    await page.getByTestId('field-email').fill('not-an-email');
    await page.getByTestId('endpoint-send').click();
    await expect(page.getByTestId('field-error-email')).toContainText('Invalid email format');
  });

  test('duplicate email returns 409', async ({ page }) => {
    const user = await createUser();

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-POST-users').click();
    await page.getByTestId('field-first_name').fill('Test');
    await page.getByTestId('field-last_name').fill('User');
    await page.getByTestId('field-email').fill(user.email);
    await page.getByTestId('field-password').fill('pass1234');
    await page.getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('409');
  });

  test('DELETE user with non-zero balance returns 409', async ({ page }) => {
    const user = await createUser();
    const { token } = await getToken(user.email, user.password);
    await creditAccount(token, 5000);

    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await loginViaUI(page, user.email, user.password);

    await page.getByTestId('endpoint-DELETE-users-id').click();
    await page.getByTestId('endpoint-DELETE-users-id').getByTestId('endpoint-send').click();

    await expect(page.getByTestId('endpoint-status')).toContainText('409');
  });

  test('Autoplay restart generates different email', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    const req1 = await page.getByTestId('step-request-body').innerText();
    const email1 = JSON.parse(req1).email;

    await ap.btnRestart().click();
    await ap.waitForStep(1);
    await ap.waitForStepComplete();
    const req2 = await page.getByTestId('step-request-body').innerText();
    const email2 = JSON.parse(req2).email;

    expect(email1).not.toBe(email2);
  });

  test('step 7 — idempotent retry does NOT add new transaction row to DB', async ({ page }) => {
    const ap = new AutoplayPage(page);
    await ap.goto();

    await ap.waitForStep(6); await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countBefore = await page.getByTestId('db-table-transactions').getByTestId('db-row').count();
    await page.getByTestId('db-close').click();

    await ap.waitForStep(7); await ap.waitForStepComplete();
    await ap.btnDbInspector().click();
    await page.getByTestId('db-tab-ledger').click();
    const countAfter = await page.getByTestId('db-table-transactions').getByTestId('db-row').count();

    expect(countAfter).toBe(countBefore);
  });
});
