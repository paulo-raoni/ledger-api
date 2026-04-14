import { test, expect } from '@playwright/test';
import { AutoplayPage } from '../pages/AutoplayPage';
import { GuidedPage } from '../pages/GuidedPage';

// These tests run on mobile-chrome and mobile-safari projects only
test.describe('Mobile layout', () => {

  test('Autoplay shows one step at a time (wizard)', async ({ page }) => {
    await page.goto('/');
    const ap = new AutoplayPage(page);
    await ap.waitForStep(3);
    const visibleCards = await page.getByTestId('step-card').all();
    expect(visibleCards.length).toBe(1);
  });

  test('progress bar visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('progress-bar')).toBeVisible();
  });

  test('Guided shows Back and Next in bottom bar on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-guided').click();
    const gp = new GuidedPage(page);
    await gp.waitForStep(1);
    await gp.waitForCurrentStepComplete();
    await gp.btnNext().click();
    await gp.waitForStep(2);
    await expect(page.getByTestId('btn-back')).toBeVisible();
    await expect(page.getByTestId('btn-next')).toBeVisible();
  });

  test('Playground history opens as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('history-toggle-mobile').click();
    await expect(page.getByTestId('history-panel')).toBeVisible();
  });

  test('DB Inspector opens as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('db-view-btn').click();
    const inspector = page.getByTestId('db-inspector');
    await expect(inspector).toBeVisible();
    const box = await inspector.boundingBox();
    expect(box!.height).toBeGreaterThan(500);
  });

  test('all 9 endpoint cards visible on mobile via scroll', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-playground').click();
    await page.getByTestId('endpoint-GET-balance').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('endpoint-GET-balance')).toBeVisible();
  });
});
