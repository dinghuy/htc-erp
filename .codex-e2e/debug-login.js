const { chromium } = require('@playwright/test');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => console.log('console', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('pageerror', String(err)));
  page.on('requestfinished', req => { if (req.url().includes('/auth/login')) console.log('requestfinished', req.url(), req.method()); });
  page.on('response', async res => { if (res.url().includes('/auth/login')) console.log('login-response', res.status(), await res.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('qa.admin');
  await page.locator('input[type="password"]').first().fill('QaAdmin@123');
  await page.screenshot({ path: 'before-login.png', fullPage: true });
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'after-login.png', fullPage: true });
  console.log('url', page.url());
  console.log('body', (await page.locator('body').innerText()).slice(0, 4000));
  await browser.close();
})();
