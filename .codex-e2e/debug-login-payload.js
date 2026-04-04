const { chromium } = require('@playwright/test');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/api/auth/login', async route => {
    const req = route.request();
    console.log('payload', req.postData());
    await route.continue();
  });
  page.on('response', async res => { if (res.url().includes('/auth/login')) console.log('status', res.status(), await res.text()); });
  await page.goto('http://localhost:5173');
  await page.locator('input[type="text"]').first().fill('qa.admin');
  await page.locator('input[type="password"]').first().fill('QaAdmin@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await browser.close();
})();
