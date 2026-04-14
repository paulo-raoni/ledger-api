import { type Page } from '@playwright/test';

export class HeaderPage {
  constructor(private page: Page) {}

  dotIdentity()   { return this.page.getByTestId('health-dot-identity'); }
  dotLedger()     { return this.page.getByTestId('health-dot-ledger'); }
  themeToggle()   { return this.page.getByTestId('theme-toggle'); }
  modeAutoplay()  { return this.page.getByTestId('mode-autoplay'); }
  modeGuided()    { return this.page.getByTestId('mode-guided'); }
  modePlayground(){ return this.page.getByTestId('mode-playground'); }
}
