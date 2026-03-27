import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { UX_REGRESSION_MANIFEST, UX_SMOKE_ROUTES } from './ux-regression.manifest.mjs';
import {
  selectors,
  routeSelector,
  navItemSelector,
  previewPresetSelector,
  approvalLaneButtonSelector,
  approvalActionButtonSelector,
  workspaceTabSelector,
} from './selector-contract.mjs';
import {
  AUDIT_DRIVERS,
  DEFAULT_QA_BACKEND_URL,
  DEFAULT_QA_FRONTEND_URL,
  classifyFailureType,
  createAuditSummary,
  createFatalAuditSummary,
  renderAuditMarkdown,
  resolveFrontendUrl,
} from './ux-audit-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BACKEND_URL = process.env.QA_BACKEND_URL || DEFAULT_QA_BACKEND_URL;
const DEFAULT_FRONTEND_URL = process.env.QA_FRONTEND_URL || DEFAULT_QA_FRONTEND_URL;
const DEFAULT_ADMIN = {
  username: process.env.QA_ADMIN_USERNAME || 'admin',
  password: process.env.QA_ADMIN_PASSWORD || 'admin123',
};
const ARTIFACT_ROOT = path.resolve(FRONTEND_ROOT, 'artifacts', 'ux-audit');
const REPORT_STAMP = new Date().toISOString().replace(/[:.]/g, '-');

function sanitizeFileName(value) {
  return String(value).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${response.status}) for ${url}`);
  }
  return data;
}

async function writeReportArtifacts(artifactDir, summary) {
  const jsonPath = path.join(artifactDir, 'ux-regression-report.json');
  const mdPath = path.join(artifactDir, 'ux-regression-report.md');
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, renderAuditMarkdown(summary), 'utf8');
  return { jsonPath, mdPath };
}

async function assertHttpReachable(url, label) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`${label} responded with HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `${label} is not reachable at ${url}. Start the local service first. Gốc lỗi: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function apiLogin(backendUrl, credentials) {
  const payload = await requestJson(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  return payload?.token;
}

async function bootstrapSeed(backendUrl) {
  await assertHttpReachable(`${backendUrl}/api/health`, 'Backend');
  try {
    const token = await apiLogin(backendUrl, DEFAULT_ADMIN);
    await requestJson(`${backendUrl}/api/qa/reset-ux-seed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return requestJson(`${backendUrl}/api/qa/ux-seed-contract`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    const bootstrapPayload = await requestJson(`${backendUrl}/api/qa/bootstrap-ux-seed`, {
      method: 'POST',
      headers: {
        'x-qa-bootstrap': process.env.QA_BOOTSTRAP_SECRET || 'ux-seed-local-only',
      },
    });
    return bootstrapPayload.contract;
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error(
      `Thiếu package "playwright". Chạy "npm install --save-dev playwright" trong frontend trước khi chạy suite này. Gốc lỗi: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function launchBrowser(playwright) {
  const channelCandidates = process.env.QA_BROWSER_CHANNEL
    ? [process.env.QA_BROWSER_CHANNEL]
    : ['chrome']; // Force chrome first

  const launchOptions = {
    headless: process.env.QA_HEADLESS === '0' ? false : true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  const launchErrors = [];
  for (const channel of channelCandidates) {
    try {
      return await playwright.chromium.launch({
        ...launchOptions,
        channel,
      });
    } catch (error) {
      launchErrors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    return await playwright.chromium.launch({
      ...launchOptions,
    });
  } catch (error) {
    launchErrors.push(`bundled: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Không thể khởi chạy browser cho UX audit. Hãy cài browser bằng "npx playwright install chromium" hoặc đặt QA_BROWSER_CHANNEL. Chi tiết: ${launchErrors.join(' | ')}`);
  }
}

async function expectVisible(page, selector, message, timeout = 8000) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

async function expectHidden(page, selector, message) {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (count === 0) return;
  if (await locator.first().isVisible()) {
    throw new Error(message || `Expected selector to stay hidden: ${selector}`);
  }
}

async function assertTextContains(page, selector, expected, message) {
  const locator = await expectVisible(page, selector, message);
  const text = await locator.innerText();
  if (!text.includes(expected)) {
    throw new Error(message || `Expected "${expected}" inside ${selector}, received "${text}"`);
  }
}

async function gotoAndWait(page, routeName) {
  await expectVisible(page, navItemSelector(routeName), `Missing nav item for ${routeName}`);
  await page.locator(navItemSelector(routeName)).click();
  await expectVisible(page, routeSelector(routeName), `Route ${routeName} did not render`);
}

async function selectPreviewPreset(page, presetKey, expectedRoute) {
  await expectVisible(page, selectors.layout.previewBanner, 'Preview banner missing before preset switch');
  await page.locator(previewPresetSelector(presetKey)).click();
  await expectVisible(page, routeSelector(expectedRoute), `Route ${expectedRoute} did not render after preset ${presetKey}`);
  await expectVisible(page, selectors.layout.previewBanner, 'Preview banner disappeared unexpectedly');
}

async function openSettingsFromPreview(page) {
  await expectVisible(page, selectors.layout.previewOpenSettings, 'Preview settings button missing');
  await page.locator(selectors.layout.previewOpenSettings).click();
  await expectVisible(page, routeSelector('Settings'), 'Settings route did not render from preview banner');
  await expectVisible(page, selectors.settings.previewPanel, 'Settings preview panel missing');
}

async function openRepresentativeWorkspace(page) {
  await expectVisible(page, selectors.settings.previewOpenWorkspace, 'Open representative workspace button missing');
  await page.locator(selectors.settings.previewOpenWorkspace).click();
  await expectVisible(page, routeSelector('Projects'), 'Projects route did not render after opening representative workspace');
  await expectVisible(page, selectors.workspace.modal, 'Representative project workspace did not open');
}

async function closeRepresentativeWorkspace(page) {
  const closeButton = page.locator(selectors.workspace.close);
  if (await closeButton.count()) {
    await closeButton.click();
  }
}

async function verifyUiLogin(page, contract) {
  await page.goto(contract.baseUrl.frontend, { waitUntil: 'domcontentloaded' });
  await expectVisible(page, selectors.login.shell, 'Login screen did not render');
  await page.locator(selectors.login.username).fill(contract.admin.username);
  await page.locator(selectors.login.password).fill(contract.admin.password);
  await page.locator(selectors.login.submit).click();
  await expectVisible(page, routeSelector('Home'), 'Home route did not render after login');
  await expectVisible(page, navItemSelector('Home'), 'Sidebar Home nav missing after login');
}

async function verifyManifestBaseline(page, journey) {
  for (const selector of journey.expectedVisible) {
    await expectVisible(page, selector, `Journey ${journey.id} expected visible selector missing: ${selector}`);
  }
  for (const selector of journey.expectedHidden) {
    await expectHidden(page, selector, `Journey ${journey.id} expected hidden selector is visible: ${selector}`);
  }
}

async function runAdminPreviewViewerEscape(page) {
  await selectPreviewPreset(page, 'viewer', 'Home');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[0]);
  await openSettingsFromPreview(page);
  await page.locator(previewPresetSelector('sales')).click();
  await expectVisible(page, routeSelector('My Work'), 'Sales preview did not reach My Work from Settings');
  await expectVisible(page, selectors.layout.previewBackToAdmin, 'Back to Admin missing after sales preview');
  await page.locator(selectors.layout.previewBackToAdmin).click();
  await expectHidden(page, selectors.layout.previewBanner, 'Preview banner stayed visible after Back to Admin');
  await expectVisible(page, navItemSelector('Users'), 'Admin nav did not recover after leaving preview');
}

async function runSalesJourney(page, contract) {
  await selectPreviewPreset(page, 'sales', 'My Work');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[1]);
  await assertTextContains(page, selectors.myWork.focusBadge, 'commercial', 'Sales preview did not focus commercial queue');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('commercial'), 'Sales workspace missing commercial tab');
  await expectHidden(page, workspaceTabSelector('finance'), 'Sales workspace exposed finance tab');
  await expectHidden(page, workspaceTabSelector('legal'), 'Sales workspace exposed legal tab');
  await closeRepresentativeWorkspace(page);
  await gotoAndWait(page, 'Approvals');
  await page.locator(approvalLaneButtonSelector('finance')).click();
  await expectVisible(page, approvalLaneButtonSelector('finance'), 'Finance lane button missing');
  await expectHidden(page, approvalActionButtonSelector(contract.sampleIds.approvals.finance, 'approve'), 'Sales preview should not approve finance lane');
  await page.locator(approvalLaneButtonSelector('legal')).click();
  await expectHidden(page, approvalActionButtonSelector(contract.sampleIds.approvals.legal, 'approve'), 'Sales preview should not approve legal lane');
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runPmJourney(page) {
  await selectPreviewPreset(page, 'project_manager', 'My Work');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[2]);
  await assertTextContains(page, selectors.myWork.focusBadge, 'execution', 'PM preview did not focus execution queue');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('timeline'), 'PM workspace missing timeline tab');
  await expectVisible(page, workspaceTabSelector('delivery'), 'PM workspace missing delivery tab');
  await page.locator(workspaceTabSelector('commercial')).click();
  await assertTextContains(page, selectors.workspace.previewNotice, 'read-only', 'PM commercial tab should remain read-only');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runSalesPmJourney(page) {
  await selectPreviewPreset(page, 'sales_pm_combined', 'My Work');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[3]);
  await assertTextContains(page, selectors.myWork.focusBadge, 'combined', 'Sales + PM preview did not focus combined queue');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('commercial'), 'Sales + PM workspace missing commercial tab');
  await expectVisible(page, workspaceTabSelector('timeline'), 'Sales + PM workspace missing timeline tab');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runProcurementJourney(page) {
  await selectPreviewPreset(page, 'procurement', 'Inbox');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[4]);
  await assertTextContains(page, selectors.inbox.focusBadge, 'procurement', 'Procurement preview did not focus procurement inbox');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('procurement'), 'Procurement workspace missing procurement tab');
  await expectVisible(page, workspaceTabSelector('delivery'), 'Procurement workspace missing delivery tab');
  await expectHidden(page, workspaceTabSelector('commercial'), 'Procurement workspace exposed commercial tab');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runAccountingJourney(page, contract) {
  await selectPreviewPreset(page, 'accounting', 'Approvals');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[5]);
  await assertTextContains(page, selectors.approvals.focusBadge, 'finance', 'Accounting preview did not focus finance lane');
  await expectVisible(page, approvalActionButtonSelector(contract.sampleIds.approvals.finance, 'approve'), 'Accounting preview should approve finance lane');
  await page.locator(approvalLaneButtonSelector('legal')).click();
  await expectHidden(page, approvalActionButtonSelector(contract.sampleIds.approvals.legal, 'approve'), 'Accounting preview should not approve legal lane');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('finance'), 'Accounting workspace missing finance tab');
  await expectHidden(page, workspaceTabSelector('legal'), 'Accounting workspace exposed legal tab');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runLegalJourney(page, contract) {
  await selectPreviewPreset(page, 'legal', 'Approvals');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[6]);
  await assertTextContains(page, selectors.approvals.focusBadge, 'legal', 'Legal preview did not focus legal lane');
  await expectVisible(page, approvalActionButtonSelector(contract.sampleIds.approvals.legal, 'approve'), 'Legal preview should approve legal lane');
  await page.locator(approvalLaneButtonSelector('finance')).click();
  await expectHidden(page, approvalActionButtonSelector(contract.sampleIds.approvals.finance, 'approve'), 'Legal preview should not approve finance lane');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('legal'), 'Legal workspace missing legal tab');
  await expectHidden(page, workspaceTabSelector('finance'), 'Legal workspace exposed finance tab');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runDirectorJourney(page) {
  await selectPreviewPreset(page, 'director', 'Approvals');
  await verifyManifestBaseline(page, UX_REGRESSION_MANIFEST[7]);
  await assertTextContains(page, selectors.approvals.focusBadge, 'executive', 'Director preview did not focus executive lane');
  await gotoAndWait(page, 'Reports');
  await expectVisible(page, routeSelector('Reports'), 'Director preview did not reach Reports');
  await openSettingsFromPreview(page);
  await openRepresentativeWorkspace(page);
  await expectVisible(page, workspaceTabSelector('overview'), 'Director workspace missing overview tab');
  await closeRepresentativeWorkspace(page);
  await page.locator(selectors.layout.previewBackToAdmin).click();
}

async function runSmokeRoutes(page) {
  for (const route of UX_SMOKE_ROUTES) {
    await gotoAndWait(page, route);
  }
}

const JOURNEY_HANDLERS = {
  'admin-preview-viewer-escape': runAdminPreviewViewerEscape,
  'sales-commercial-guardrails': runSalesJourney,
  'pm-execution-read-only-commercial': runPmJourney,
  'sales-pm-unified-flow': runSalesPmJourney,
  'procurement-exception-workspace': runProcurementJourney,
  'accounting-finance-lane-boundary': runAccountingJourney,
  'legal-approval-boundary': runLegalJourney,
  'director-executive-cockpit': runDirectorJourney,
};

async function main() {
  const artifactDir = path.join(ARTIFACT_ROOT, REPORT_STAMP);
  await mkdir(artifactDir, { recursive: true });
  let frontendUrl = DEFAULT_FRONTEND_URL;
  let backendUrl = DEFAULT_BACKEND_URL;
  let contractVersion = 'unknown';
  let browser;
  let context;

  try {
    const contract = await bootstrapSeed(DEFAULT_BACKEND_URL);
    frontendUrl = resolveFrontendUrl(contract.baseUrl.frontend, process.env.QA_FRONTEND_URL);
    backendUrl = contract.baseUrl.backend || DEFAULT_BACKEND_URL;
    contractVersion = contract.contractVersion;
    contract.baseUrl.frontend = frontendUrl;
    await assertHttpReachable(contract.baseUrl.frontend, 'Frontend');
    const playwright = await loadPlaywright();
    browser = await launchBrowser(playwright);
    context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const results = [];

    await verifyUiLogin(page, contract);

    for (const journey of UX_REGRESSION_MANIFEST) {
      const startedAt = Date.now();
      const screenshotPath = path.join(artifactDir, `${sanitizeFileName(journey.id)}.png`);
      try {
        await JOURNEY_HANDLERS[journey.id](page, contract);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.push({
          id: journey.id,
          persona: journey.persona,
          status: 'passed',
          durationMs: Date.now() - startedAt,
          screenshot: screenshotPath,
          preconditions: journey.preconditions,
          failureType: null,
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        results.push({
          id: journey.id,
          persona: journey.persona,
          status: 'failed',
          durationMs: Date.now() - startedAt,
          screenshot: screenshotPath,
          error: error instanceof Error ? error.message : String(error),
          preconditions: journey.preconditions,
          failureType: classifyFailureType(error),
        });
      }
    }

    const smokeStartedAt = Date.now();
    const smokeShot = path.join(artifactDir, 'smoke-routes.png');
    try {
      await runSmokeRoutes(page);
      await page.screenshot({ path: smokeShot, fullPage: true });
      results.push({
        id: 'smoke-routes',
        persona: 'admin',
        status: 'passed',
        durationMs: Date.now() - smokeStartedAt,
        screenshot: smokeShot,
        failureType: null,
      });
    } catch (error) {
      await page.screenshot({ path: smokeShot, fullPage: true }).catch(() => {});
      results.push({
        id: 'smoke-routes',
        persona: 'admin',
        status: 'failed',
        durationMs: Date.now() - smokeStartedAt,
        screenshot: smokeShot,
        error: error instanceof Error ? error.message : String(error),
        failureType: classifyFailureType(error),
      });
    }

    const summary = createAuditSummary({
      driver: AUDIT_DRIVERS.NODE_PLAYWRIGHT,
      frontendUrl,
      backendUrl,
      contractVersion,
      results,
    });
    const { mdPath } = await writeReportArtifacts(artifactDir, summary);
    if (summary.failedJourneys > 0) {
      process.stderr.write(`UX audit completed with failures. Report: ${mdPath}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`UX audit passed. Report: ${mdPath}\n`);
  } catch (error) {
    const failureType = classifyFailureType(error);
    const summary = createFatalAuditSummary({
      driver: AUDIT_DRIVERS.NODE_PLAYWRIGHT,
      frontendUrl,
      backendUrl,
      contractVersion,
      failureType,
      error: error instanceof Error ? error.message : String(error),
    });
    const { mdPath } = await writeReportArtifacts(artifactDir, summary);
    process.stderr.write(`${summary.results[0].error}\nReport: ${mdPath}\n`);
    process.exitCode = 1;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
