const { chromium } = require('@playwright/test');
const fs = require('fs');

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const events = [];
  page.on('console', msg => {
    if (msg.type() === 'error') events.push({ type: 'console', text: msg.text() });
  });
  page.on('pageerror', err => events.push({ type: 'pageerror', text: String(err) }));
  page.on('requestfailed', req => events.push({ type: 'requestfailed', url: req.url(), error: req.failure()?.errorText || 'unknown' }));

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('qa.admin');
  await page.locator('input[type="password"]').first().fill('QaAdmin@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('aside', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const result = { tabs: [], routes: {}, events };

  const getTexts = async (selector) => {
    return (await page.locator(selector).evaluateAll(nodes => nodes.map(n => (n.innerText || '').trim()).filter(Boolean)))
      .map(t => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };

  const tabLabels = [...new Set(await getTexts('header nav button'))];
  result.tabs = tabLabels;

  for (const tab of tabLabels) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
    const navLabels = [...new Set(await getTexts('aside nav button'))].filter(t => !/đăng xuất|logout/i.test(t));
    result.routes[tab] = [];

    for (const nav of navLabels) {
      try {
        await page.getByRole('button', { name: nav, exact: true }).click();
        await page.waitForTimeout(1200);
        const headingText = await page.locator('main').evaluate(el => (el.innerText || '').split('\n').slice(0, 8).join(' | '));
        const contentButtons = [...new Set(await getTexts('main button'))]
          .filter(t => !tabLabels.includes(t))
          .filter(t => t !== nav)
          .filter(t => !/logout|đăng xuất/i.test(t));
        result.routes[tab].push({ nav, headingText, contentButtons: contentButtons.slice(0, 20) });
      } catch (error) {
        result.routes[tab].push({ nav, error: String(error) });
      }
    }
  }

  fs.writeFileSync('ui-enumeration.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
