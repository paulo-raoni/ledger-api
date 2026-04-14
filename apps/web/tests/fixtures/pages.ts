import type { Page } from '@playwright/test';

export { createUser, getToken, creditAccount, debitAccount, getBalance, cleanupUser } from './api';

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.getByTestId('mode-playground').click();
  await page.getByTestId('endpoint-POST-auth').click();
  await page.getByTestId('field-email').fill(email);
  await page.getByTestId('field-password').fill(password);
  await page.getByTestId('endpoint-send').click();
  await page.getByTestId('token-pill').waitFor({ state: 'visible', timeout: 8_000 });
}
