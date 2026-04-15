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
    // Autoplay cycles ~1s/step so the "Step N of 13" label is brief. Wait for
    // the current step to reach exactly n via a JS predicate with short
    // polling so the caller lands on the correct step.
    await this.page.waitForFunction(
      (target) => {
        const el = document.querySelector('[data-testid="progress-label"]');
        const txt = el?.textContent ?? '';
        const m = /Step\s+(\d+)\s+of\s+\d+/.exec(txt);
        return !!m && parseInt(m[1], 10) === target;
      },
      n,
      { timeout: opts?.timeout ?? 30_000, polling: 100 },
    );
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
