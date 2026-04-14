import { chromium } from '@playwright/test';

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
}

export default globalSetup;
