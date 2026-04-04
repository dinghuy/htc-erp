const { chromium } = require('@playwright/test');
const fs = require('fs');

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let events = [];
  const push = (evt) => events.push({ at: new Date().toISOString(), ...evt });
  page.on('console', msg => { if (msg.type() === 'error') push({ type: 'console', text: msg.text() }); });
  page.on('pageerror', err => push({ type: 'pageerror', text: String(err) }));
  page.on('requestfailed', req => push({ type: 'requestfailed', url: req.url(), error: req.failure()?.errorText || 'unknown' }));
  page.on('response', async res => { if (res.status() >= 400) push({ type: 'response', status: res.status(), url: res.url() }); });
  const drain = () => { const out = events; events = []; return out; };

  async function login() {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="text"]').first().fill('qa.admin');
    await page.locator('input[type="password"]').first().fill('QaAdmin@123');
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('aside', { timeout: 20000 });
    await page.waitForTimeout(1200);
    drain();
  }

  async function gotoRoute(tab, route) {
    await page.locator('header nav button').filter({ hasText: tab }).first().click();
    await page.waitForTimeout(400);
    await page.locator('aside nav button').filter({ hasText: route }).first().click();
    await page.waitForTimeout(1200);
    return {
      header: (await page.locator('main').innerText()).split('\n').slice(0, 10).join(' | '),
      events: drain(),
    };
  }

  async function clickMainButton(label) {
    const btn = page.locator('main button').filter({ hasText: label }).first();
    if (await btn.count() === 0) return { action: label, missing: true };
    await btn.click();
    await page.waitForTimeout(1200);
    const body = (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | ');
    return { action: label, body, events: drain() };
  }

  async function clickFirstMainButtonContaining(text) {
    const btn = page.locator('main button').filter({ hasText: text }).first();
    if (await btn.count() === 0) return { action: `contains:${text}`, missing: true };
    await btn.click();
    await page.waitForTimeout(1200);
    const body = (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | ');
    return { action: `contains:${text}`, body, events: drain() };
  }

  async function clickCustomerFilter(label) {
    const btn = page.locator('main button').filter({ hasText: label }).first();
    if (await btn.count() === 0) return { action: `filter:${label}`, missing: true };
    await btn.click();
    await page.waitForTimeout(1200);
    const body = (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | ');
    return { action: `filter:${label}`, body, events: drain() };
  }

  const plan = [
    { tab: 'Kinh doanh', route: 'Tổng quan', actions: ['Realtime', '•••', 'Xem toàn bộ nhật ký'] },
    { tab: 'Kinh doanh', route: 'Leads', actions: ['Thêm lead', 'Nhập CSV', 'Xuất CSV'] },
    { tab: 'Kinh doanh', route: 'Khách hàng', actions: ['Thêm Khách hàng', 'Bộ lọc nâng cao'] },
    { tab: 'Kinh doanh', route: 'Liên hệ', actions: ['Thêm liên hệ'] },
    { tab: 'Kinh doanh', route: 'Sản phẩm', actions: [] },
    { tab: 'Kinh doanh', route: 'Báo giá', actions: ['Tạo báo giá mới'] },
    { tab: 'Kinh doanh', route: 'Bảng giá', actions: ['Tạo Dự án'] },
    { tab: 'Kinh doanh', route: 'Báo cáo', actions: [] },
    { tab: 'Vận hành', route: 'Tổng quan vận hành', actions: ['Mở dự án', 'Mở công việc', 'Chạy đồng bộ ERP'] },
    { tab: 'Vận hành', route: 'Gantt', actions: ['Làm mới', 'Mở rộng tất cả', 'Thu gọn tất cả', 'Hôm nay'] },
    { tab: 'Vận hành', route: 'Nhân sự', actions: ['Chi tiết'] },
    { tab: 'Vận hành', route: 'Chat', actions: ['Làm mới'] },
    { tab: 'Vận hành', route: 'Dự án', actions: ['Tạo Dự án', 'Workspace', 'Chi tiết'] },
    { tab: 'Vận hành', route: 'Công việc', actions: ['Thêm công việc'] },
    { tab: 'Vận hành', route: 'Đơn ERP', actions: ['Làm mới', 'Bộ lọc nâng cao'] },
    { tab: 'Quản trị', route: 'Người dùng', actions: [] },
    { tab: 'Quản trị', route: 'Nhật ký', actions: ['Xem chi tiết →'] },
    { tab: 'Quản trị', route: 'Cài đặt', actions: ['Báo giá', 'Doanh nghiệp', 'Giao diện', 'Bảo mật', 'Cập nhật tỷ giá VCB', 'Lưu'] },
    { tab: 'Quản trị', route: 'Hỗ trợ', actions: [] },
  ];

  const results = [];
  await login();

  for (const step of plan) {
    const routeResult = { tab: step.tab, route: step.route, open: null, actions: [] };
    try {
      routeResult.open = await gotoRoute(step.tab, step.route);
      for (const action of step.actions) {
        try {
          routeResult.actions.push(await clickMainButton(action));
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(300);
        } catch (error) {
          routeResult.actions.push({ action, error: String(error), events: drain() });
        }
      }
      if (step.route === 'Khách hàng') {
        routeResult.actions.push(await clickCustomerFilter('Nhà cung cấp'));
        routeResult.actions.push(await clickMainButton('Thêm Nhà cung cấp'));
        routeResult.actions.push(await clickCustomerFilter('Đối tác'));
        routeResult.actions.push(await clickMainButton('Thêm Đối tác'));
        routeResult.actions.push(await clickCustomerFilter('Khách hàng'));
      }
      if (step.route === 'Hỗ trợ') {
        routeResult.actions.push(await clickFirstMainButtonContaining('BẮT ĐẦU ĐỌC'));
      }
    } catch (error) {
      routeResult.open = { error: String(error), events: drain() };
    }
    results.push(routeResult);
  }

  fs.writeFileSync('click-audit.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
