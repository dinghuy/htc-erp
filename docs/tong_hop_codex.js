/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GIẢI THÍCH VỀ HỆ THỐNG CODEX TRONG DỰ ÁN NÀY
 * ─────────────────────────────────────────────────────────────────────────────
 * Dự án này có 3 thư mục liên quan đến Codex (AI Agent):
 * 
 * 1. [.codex/] : Cấu hình "Cơ bắp" cho AI
 *    - Chứa file config.toml và các script tiện ích.
 *    - Cung cấp công cụ giúp AI kết nối với bên thứ 3 (ví dụ: mở trình duyệt 
 *      Playwright, lấy dữ liệu thiết kế từ Figma).
 * 
 * 2. [.codex-e2e/] : Kịch bản Test "Chất xám" cho AI
 *    - Chứa các file kịch bản (Playwright E2E) tự động hóa.
 *    - AI đọc các kịch bản này để biết cách đăng nhập, nhấp chuột và truy quét
 *      lỗi trên giao diện website của dự án mà không cần làm thủ công.
 *    - (Code Javascript bên dưới chính là tổng hợp từ thư mục này).
 * 
 * 3. [codex-mcp-template/] : Bản phô-tô / Bài mẫu
 *    - Chứa một bộ khung thiết lập sẵn (template gốc).
 *    - Dùng để chép (copy-paste) sang một dự án hoàn toàn mới nếu muốn lập tức
 *      áp dụng AI có khả năng tương tác Linear, Notion, Playwright, Figma.
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * TỔNG HỢP CÁC KỊCH BẢN KIỂM THỬ PLAYWRIGHT (E2E) CỦA CODEX
 * File này gộp các chức năng từ thư mục .codex-e2e (click-audit, debug-login, enumerate-ui, route-isolation)
 * vào một bộ khung duy nhất, cùng với giải thích chi tiết bằng tiếng Việt.
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');

/**
 * Hàm hỗ trợ: Lắng nghe và ghi nhận các sự kiện lỗi hoặc network từ trang web
 * Giúp chúng ta biết được trang web có bị lỗi JS, gọi API thất bại hay không.
 */
function setupEventListeners(page, eventsArray) {
  const push = (evt) => eventsArray.push({ at: new Date().toISOString(), ...evt });
  
  // Ghi nhận lỗi in ra từ console của trình duyệt
  page.on('console', msg => { 
    if (msg.type() === 'error') push({ type: 'console', text: msg.text() }); 
  });
  
  // Ghi nhận các lỗi crash nội bộ của trang web (Uncaught exceptions)
  page.on('pageerror', err => push({ type: 'pageerror', text: String(err) }));
  
  // Ghi nhận các request HTTP không được gửi đi thành công (mất mạng, DNS...)
  page.on('requestfailed', req => push({ type: 'requestfailed', url: req.url(), error: req.failure()?.errorText || 'unknown' }));
  
  // Ghi nhận các response trả về lỗi từ server (mã lỗi từ 400 trở lên như 404, 500...)
  page.on('response', async res => { 
    if (res.status() >= 400) push({ type: 'response', status: res.status(), url: res.url() }); 
  });
  
  // Hàm này dùng để lấy các lỗi ra và xóa danh sách cũ đi để dùng cho lần test tiếp theo
  const drain = () => { const out = eventsArray.slice(); eventsArray.length = 0; return out; };
  return drain;
}

/**
 * Hàm thực hiện kịch bản Đăng nhập tự động
 * Điền thông tin tài khoản QA và nhấn nút Submit.
 */
async function login(page) {
  console.log('Bắt đầu đăng nhập...');
  // Đi đến trang chủ frontend (Vite)
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  
  // Điền tài khoản và mật khẩu
  await page.locator('input[type="text"]').first().fill('qa.admin');
  await page.locator('input[type="password"]').first().fill('QaAdmin@123');
  
  // Chụp ảnh màn hình trước khi nhấn nút (Debug)
  await page.screenshot({ path: 'before-login.png', fullPage: true });
  
  // Nhấn nút và đợi giao diện chính (cột bên trái - aside) tải xong
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('aside', { timeout: 20000 });
  await page.waitForTimeout(1200); // Đợi các animation hoàn tất
  
  // Chụp ảnh màn hình sau khi vào trong (Debug)
  await page.screenshot({ path: 'after-login.png', fullPage: true });
}

/**
 * Hàm điều hướng tới một trang cụ thể (Tab lớn trên header, và menu nhỏ bên trái)
 * Trả về văn bản trên màn hình chính và các lỗi nếu có.
 */
async function gotoRoute(page, tab, route, drainEvents) {
  // Chọn Tab trên thanh Navbar ngang
  await page.locator('header nav button').filter({ hasText: tab }).first().click({ force: true });
  await page.waitForTimeout(400);
  
  // Chọn menu chi tiết ở cột bên trái
  await page.locator('aside nav button').filter({ hasText: route }).first().click();
  await page.waitForTimeout(1500);
  
  return {
    tab,
    route,
    // Lấy 10-12 dòng chữ đầu tiên trên màn hình để kiểm tra nội dung
    header: (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | '),
    events: drainEvents(),
  };
}

/**
 * Hàm tương tác (click) vào các nút bấm hiển thị ở khu vực chính (main)
 */
async function clickMainButton(page, label, drainEvents) {
  const btn = page.locator('main button').filter({ hasText: label }).first();
  
  // Trả về missing nếu nút bấm đó không tồn tại
  if (await btn.count() === 0) return { action: label, missing: true };
  
  // Bấm vào nút
  await btn.click({ force: true });
  await page.waitForTimeout(1200);
  
  // Lấy nội dung body hiện tại
  const body = (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | ');
  return { action: label, body, events: drainEvents() };
}

/**
 * THU THẬP BIỂU ĐỒ UI TỰ ĐỘNG (Enumerate UI)
 * Tự động tìm kiếm tất cả các Tab và Route đang có trên màn hình
 * Không cần kịch bản lập trước, bot sẽ tự mò mẫm.
 */
async function enumerateUI(page, drainEvents) {
  const result = { tabs: [], routes: {} };

  // Hàm cục bộ: lấy text của nhiều element cùng lúc
  const getTexts = async (selector) => {
    return (await page.locator(selector).evaluateAll(nodes => nodes.map(n => (n.innerText || '').trim()).filter(Boolean)))
      .map(t => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };

  // Tìm tất cả các Tab trên Header (Thanh điều hướng ngang)
  const tabLabels = [...new Set(await getTexts('header nav button'))];
  result.tabs = tabLabels;

  // Lặp qua từng tab lớn
  for (const tab of tabLabels) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
    
    // Tìm lấy tất cả menu con ở cột bên trái, lờ đi nút Đăng xuất
    const navLabels = [...new Set(await getTexts('aside nav button'))].filter(t => !/đăng xuất|logout/i.test(t));
    result.routes[tab] = [];

    // Nhấn thử vào từng menu con một
    for (const nav of navLabels) {
      try {
        await page.getByRole('button', { name: nav, exact: true }).click();
        await page.waitForTimeout(1200);
        
        // Cào dữ liệu text và danh sách nút bấm hiển thị trên màn hình hiện tại
        const headingText = await page.locator('main').evaluate(el => (el.innerText || '').split('\n').slice(0, 8).join(' | '));
        const contentButtons = [...new Set(await getTexts('main button'))]
          .filter(t => !tabLabels.includes(t)) // Bỏ các nút của Tab Header
          .filter(t => t !== nav) // Bỏ các nút trên Navbar bên ngoài
          .filter(t => !/logout|đăng xuất/i.test(t));
          
        result.routes[tab].push({ nav, headingText, contentButtons: contentButtons.slice(0, 20) });
      } catch (error) {
        result.routes[tab].push({ nav, error: String(error) });
      }
    }
  }
  return result;
}

/**
 * HÀM CHẠY CHÍNH (MAIN EXECUTOR)
 */
(async() => {
  // Bật trình duyệt Chromium (headless = true là không hiện giao diện UI của browser)
  const browser = await chromium.launch({ headless: true });
  // Mở tab mới với độ phân giải lớn
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  
  // Khởi tạo hệ thống bắt lỗi (listener)
  let events = [];
  const drain = setupEventListeners(page, events);
  
  try {
    // 1. Thực hiện thủ tục đăng nhập
    await login(page);

    // ==========================================
    // PHẦN A: KIỂM TOÁN LỘ TRÌNH (Route Isolation)
    // Thực hiện đi tới các route cứng trong kế hoạch để test
    // ==========================================
    console.log("-> Bắt đầu Route Isolation...");
    const planSpec = { tab: 'Vận hành', route: 'Gantt', actions: ['Làm mới', 'Hôm nay'] };
    const routeResult = await gotoRoute(page, planSpec.tab, planSpec.route, drain);
    routeResult.actionResults = [];
    
    // Test các nút tương tác
    for(const actionLabel of planSpec.actions) {
      routeResult.actionResults.push(await clickMainButton(page, actionLabel, drain));
    }
    console.log("Kết quả Route:", JSON.stringify(routeResult, null, 2));

    // ==========================================
    // PHẦN B: QUÉT TỰ ĐỘNG GIAO DIỆN (Enumerate UI)
    // ==========================================
    console.log("-> Bắt đầu Enumerate UI...");
    const uiData = await enumerateUI(page, drain);
    fs.writeFileSync('thong-ke-ui-tong-hop.json', JSON.stringify(uiData, null, 2));
    console.log("Đã lưu kết quả quét tự động vào 'thong-ke-ui-tong-hop.json'.");

  } catch (error) {
    console.error("Lỗi trong quá trình chạy E2E Script:", error);
  } finally {
    await browser.close();
  }
})();
