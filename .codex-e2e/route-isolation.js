const { chromium } = require('@playwright/test');
const fs = require('fs');

async function runCase(browser, spec) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let events = [];
  const push = (evt) => events.push({ at: new Date().toISOString(), ...evt });
  page.on('console', msg => { if (msg.type() === 'error') push({ type: 'console', text: msg.text() }); });
  page.on('pageerror', err => push({ type: 'pageerror', text: String(err) }));
  page.on('requestfailed', req => push({ type: 'requestfailed', url: req.url(), error: req.failure()?.errorText || 'unknown' }));
  page.on('response', async res => { if (res.status() >= 400) push({ type: 'response', status: res.status(), url: res.url() }); });
  const drain = () => { const out = events; events = []; return out; };

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('qa.admin');
  await page.locator('input[type="password"]').first().fill('QaAdmin@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('aside', { timeout: 20000 });
  await page.waitForTimeout(1200);
  drain();

  await page.locator('header nav button').filter({ hasText: spec.tab }).first().click({ force: true });
  await page.waitForTimeout(400);
  await page.locator('aside nav button').filter({ hasText: spec.route }).first().click();
  await page.waitForTimeout(1500);

  const result = {
    tab: spec.tab,
    route: spec.route,
    header: (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | '),
    openEvents: drain(),
    actions: [],
  };

  for (const action of (spec.actions || [])) {
    try {
      const locator = action.contains
        ? page.locator('main button').filter({ hasText: action.contains }).first()
        : page.locator('main button').filter({ hasText: action.label }).first();
      if (await locator.count() === 0) {
        result.actions.push({ action: action.label || `contains:${action.contains}`, missing: true });
        continue;
      }
      await locator.click({ force: !!action.force });
      await page.waitForTimeout(1200);
      result.actions.push({
        action: action.label || `contains:${action.contains}`,
        body: (await page.locator('main').innerText()).split('\n').slice(0, 14).join(' | '),
        events: drain(),
      });
      if (action.escape) {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch (error) {
      result.actions.push({ action: action.label || `contains:${action.contains}`, error: String(error), events: drain() });
    }
  }

  await page.close();
  return result;
}

(async() => {
  const browser = await chromium.launch({ headless: true });
  const specs = [
    { tab: 'Kinh doanh', route: 'Sản phẩm', actions: [] },
    { tab: 'Kinh doanh', route: 'Báo cáo', actions: [] },
    { tab: 'Vận hành', route: 'Tổng quan vận hành', actions: [{ label: 'Chạy đồng bộ ERP' }, { label: 'Mở dự án' }, { label: 'Mở công việc' }] },
    { tab: 'Vận hành', route: 'Gantt', actions: [{ label: 'Làm mới' }, { label: 'Hôm nay' }] },
    { tab: 'Vận hành', route: 'Nhân sự', actions: [{ label: 'Chi tiết' }] },
    { tab: 'Vận hành', route: 'Chat', actions: [{ label: 'Làm mới' }] },
    { tab: 'Vận hành', route: 'Dự án', actions: [{ label: 'Tạo Dự án' }, { label: 'Workspace' }, { label: 'Chi tiết' }] },
    { tab: 'Vận hành', route: 'Công việc', actions: [{ label: 'Thêm công việc' }] },
    { tab: 'Vận hành', route: 'Đơn ERP', actions: [{ label: 'Làm mới' }, { label: 'Bộ lọc nâng cao' }] },
    { tab: 'Quản trị', route: 'Người dùng', actions: [] },
    { tab: 'Quản trị', route: 'Nhật ký', actions: [{ label: 'Xem chi tiết →' }] },
    { tab: 'Quản trị', route: 'Cài đặt', actions: [{ label: 'Báo giá' }, { label: 'Doanh nghiệp' }, { label: 'Giao diện' }, { label: 'Bảo mật' }, { label: 'Cập nhật tỷ giá VCB' }, { label: 'Lưu' }] },
    { tab: 'Quản trị', route: 'Hỗ trợ', actions: [{ contains: 'BẮT ĐẦU ĐỌC', force: true }] },
  ];

  const results = [];
  for (const spec of specs) {
    results.push(await runCase(browser, spec));
  }
  fs.writeFileSync('route-isolation.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
