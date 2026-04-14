import { type Page } from '@playwright/test';

export class PlaygroundPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
    await this.page.getByTestId('mode-playground').click();
  }

  dbViewBtn()      { return this.page.getByTestId('db-view-btn'); }
  tokenPill()      { return this.page.getByTestId('token-pill'); }
  historyPanel()   { return this.page.getByTestId('history-panel'); }
  historyClear()   { return this.page.getByTestId('history-clear'); }
}
