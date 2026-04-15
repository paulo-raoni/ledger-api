import { chromium, request } from '@playwright/test';

async function checkService(url: string, timeout = 5000): Promise<boolean> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { timeout });
    return response?.ok() ?? false;
  } catch {
    return false;
  } finally {
    await browser.close();
  }
}

async function resetDb(service: 'identity' | 'ledger') {
  const port = service === 'identity' ? 3002 : 3001;
  const ctx = await request.newContext();
  try {
    const res = await ctx.delete(`http://localhost:${port}/debug/reset?confirm=YES`);
    if (!res.ok()) {
      throw new Error(`Reset ${service} failed: HTTP ${res.status()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

async function globalSetup() {
  const identityOk = await checkService('http://localhost:3002/health');
  const ledgerOk = await checkService('http://localhost:3001/health');

  if (!identityOk || !ledgerOk) {
    throw new Error(
      'Services not available. Run: docker-compose up -d\n' +
      `  Identity (3002): ${identityOk ? 'OK' : 'DOWN'}\n` +
      `  Ledger (3001): ${ledgerOk ? 'OK' : 'DOWN'}`,
    );
  }

  // M5 Pre-mortem 5: clean DB state before every suite run — D07 cents breaking
  // change invalidates any pre-existing rows from older runs.
  await resetDb('identity');
  await resetDb('ledger');
}

export default globalSetup;
