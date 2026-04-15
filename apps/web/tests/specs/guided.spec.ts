import { test, expect } from '@playwright/test';
import { GuidedPage } from '../pages/GuidedPage';

test.describe('Guided mode', () => {
  test.beforeEach(async () => {
    await fetch('http://localhost:3001/debug/reset?confirm=YES', { method: 'DELETE' });
    await fetch('http://localhost:3002/debug/reset?confirm=YES', { method: 'DELETE' });
  });

  test('renders in Guided mode when tab selected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    await expect(page.getByTestId('step-description')).toBeVisible();
  });

  test('step 1 — description and whyItMatters visible', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const desc = page.getByTestId('step-description');
    const why = page.getByTestId('step-why');
    await expect(desc).toContainText('We register Alice');
    await expect(why).toContainText('Passwords are hashed');
  });

  test('Next button disabled while request in flight', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await expect(gp.btnNext()).toBeDisabled();
    await gp.waitForCurrentStepComplete();
    await expect(gp.btnNext()).toBeEnabled();
  });

  test('Next advances to next step', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await gp.btnNext().click();
    await gp.waitForStep(2);
  });

  test('Back returns to previous step without re-executing', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();

    await gp.waitForStep(1); await gp.waitForCurrentStepComplete();
    await gp.btnNext().click(); // advance to 2
    await gp.waitForStep(2);
    await gp.btnNext().click(); // execute step 2
    await gp.waitForCurrentStepComplete();

    const resp2 = await page.getByTestId('step-response-body').innerText();

    await gp.btnBack().click();
    await gp.waitForStep(1);

    await gp.btnNext().click();
    await gp.waitForStep(2);
    const resp2again = await page.getByTestId('step-response-body').innerText();
    expect(resp2again).toBe(resp2);
  });

  test('Back button absent on step 1', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await expect(gp.btnBack()).not.toBeVisible();
  });

  test('step 9 — 422 shows Expected badge in Guided mode', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.advanceTo(9);
    await expect(page.getByTestId('step-error-expected')).toBeVisible();
    await expect(page.getByTestId('step-status-badge')).toContainText('422');
  });

  test('step 11 — 409 shows Expected badge in Guided mode', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.advanceTo(11);
    await expect(page.getByTestId('step-error-expected')).toBeVisible();
    await expect(page.getByTestId('step-status-badge')).toContainText('409');
  });

  test('DB Inspector accessible between steps', async ({ page }) => {
    const gp = new GuidedPage(page);
    await gp.goto();
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await page.getByTestId('btn-db-inspector').click();
    await expect(page.getByTestId('db-inspector')).toBeVisible();
  });
});
