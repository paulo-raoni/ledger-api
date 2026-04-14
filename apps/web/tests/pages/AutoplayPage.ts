import { expect, type Page } from '@playwright/test';

export class AutoplayPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/'); }

  stepCard()       { return this.page.getByTestId('step-card'); }
  stepTitle()      { return this.page.getByTestId('step-title'); }
  progressLabel()  { return this.page.getByTestId('progress-label'); }
  progressBar()    { return this.page.getByTestId('progress-bar'); }
  statusBadge()    { return this.page.getByTestId('step-status-badge'); }
  responseBody()   { return this.page.getByTestId('step-response-body'); }
  loadingSpinner() { return this.page.getByTestId('step-loading'); }
  errorExpected()  { return this.page.getByTestId('step-error-expected'); }
  btnPause()       { return this.page.getByTestId('btn-pause'); }
  btnResume()      { return this.page.getByTestId('btn-resume'); }
  btnRestart()     { return this.page.getByTestId('btn-restart'); }
  btnDbInspector() { return this.page.getByTestId('btn-db-inspector'); }

  async waitForStep(n: number, opts?: { timeout?: number }) {
    await expect(this.progressLabel()).toContainText(`Step ${n} of 13`, opts);
  }

  async waitForStepComplete() {
    await expect(this.loadingSpinner()).not.toBeVisible({ timeout: 15_000 });
    await expect(this.statusBadge()).toBeVisible();
  }

  async waitForAutoplayComplete() {
    await expect(this.progressLabel()).toContainText('Step 13 of 13', { timeout: 60_000 });
    await this.waitForStepComplete();
  }
}
