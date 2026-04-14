import { type Page } from '@playwright/test';

export class DbInspectorPage {
  constructor(private page: Page) {}

  container()      { return this.page.getByTestId('db-inspector'); }
  tabIdentity()    { return this.page.getByTestId('db-tab-identity'); }
  tabLedger()      { return this.page.getByTestId('db-tab-ledger'); }
  tableUsers()     { return this.page.getByTestId('db-table-users'); }
  tableTxns()      { return this.page.getByTestId('db-table-transactions'); }
  tableBalance()   { return this.page.getByTestId('db-table-balance'); }
  tableIdem()      { return this.page.getByTestId('db-table-idempotency'); }
  refresh()        { return this.page.getByTestId('db-refresh'); }
  close()          { return this.page.getByTestId('db-close'); }
  error()          { return this.page.getByTestId('db-error'); }
}
