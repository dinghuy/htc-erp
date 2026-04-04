const { chromium } = require('@playwright/test');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('response', async res => { if (res.url().includes('/auth/login')) console.log('login-response', res.status(), await res.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  const user = page.locator('input[type="text"]').first();
  const pass = page.locator('input[type="password"]').first();
  await user.click();
  await user.pressSequentially('qa.admin', { delay: 80 });
  await pass.click();
  await pass.pressSequentially('QaAdmin@123', { delay: 80 });
  console.log('user=', await user.inputValue());
  console.log('pass=', await pass.inputValue());
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  console.log((await page.locator('body').innerText()).slice(0, 1000));
  await browser.close();
})();
