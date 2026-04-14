import { expect, type Page } from '@playwright/test';

const TOTAL_STEPS = 13;

export class GuidedPage {
  currentStep = 1;

  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
    await this.page.getByTestId('mode-guided').click();
    this.currentStep = 1;
  }

  progressLabel()  { return this.page.getByTestId('progress-label'); }
  loadingSpinner() { return this.page.getByTestId('step-loading'); }
  statusBadge()    { return this.page.getByTestId('step-status-badge'); }
  btnNext()        { return this.page.getByTestId('btn-next'); }
  btnBack()        { return this.page.getByTestId('btn-back'); }
  btnDbInspector() { return this.page.getByTestId('btn-db-inspector'); }

  async waitForStep(n: number, opts?: { timeout?: number }) {
    await expect(this.progressLabel()).toContainText(`Step ${n} of ${TOTAL_STEPS}`, opts);
    this.currentStep = n;
  }

  async waitForCurrentStepComplete() {
    await expect(this.loadingSpinner()).not.toBeVisible({ timeout: 15_000 });
    await expect(this.statusBadge()).toBeVisible();
  }

  async advanceTo(target: number) {
    for (let i = this.currentStep; i < target; i++) {
      await this.waitForCurrentStepComplete();
      await this.btnNext().click();
      await this.waitForStep(i + 1);
    }
    await this.waitForCurrentStepComplete();
  }
}
