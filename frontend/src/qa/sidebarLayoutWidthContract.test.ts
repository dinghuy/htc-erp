import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type SidebarRouteFile = {
  routeFile: string;
  expectedFallback: string;
};

const SIDEBAR_ROUTE_FILES: SidebarRouteFile[] = [
  { routeFile: 'features/approvals/ApprovalsRoute.tsx', expectedFallback: 'Đang tải phê duyệt...' },
  { routeFile: 'features/leads/LeadsRoute.tsx', expectedFallback: 'Đang tải khu vực lead...' },
  { routeFile: 'features/projects/EquipmentRoute.tsx', expectedFallback: 'Đang tải danh mục sản phẩm...' },
  { routeFile: 'features/projects/ProjectsRoute.tsx', expectedFallback: 'Đang tải workspace dự án...' },
  { routeFile: 'features/quotations/QuotationsRoute.tsx', expectedFallback: 'Đang tải khu vực báo giá...' },
  { routeFile: 'features/reports/ReportsRoute.tsx', expectedFallback: 'Đang tải báo cáo...' },
  { routeFile: 'features/tasks/TasksRoute.tsx', expectedFallback: 'Đang tải khu vực công việc...' },
  { routeFile: 'features/support/SupportRoute.tsx', expectedFallback: 'Đang tải trung tâm hỗ trợ...' },
  { routeFile: 'features/event-log/EventLogRoute.tsx', expectedFallback: 'Đang tải nhật ký hoạt động...' },
  { routeFile: 'features/admin/UsersRoute.tsx', expectedFallback: 'Đang tải quản lý người dùng...' },
  { routeFile: 'features/sales-orders/SalesOrdersRoute.tsx', expectedFallback: 'Đang tải đơn ERP...' },
  { routeFile: 'features/settings/SettingsRoute.tsx', expectedFallback: 'Đang tải cài đặt...' },
  { routeFile: 'features/operations/OpsOverviewRoute.tsx', expectedFallback: 'Đang tải tổng quan vận hành...' },
  { routeFile: 'features/operations/GanttRoute.tsx', expectedFallback: 'Đang tải gantt vận hành...' },
  { routeFile: 'features/operations/OpsStaffRoute.tsx', expectedFallback: 'Đang tải hiệu suất nhân sự...' },
  { routeFile: 'features/operations/OpsChatRoute.tsx', expectedFallback: 'Đang tải trao đổi vận hành...' },
  { routeFile: 'features/customers/CustomersRoute.tsx', expectedFallback: '' },
];

function readFrontendFile(relativePath: string) {
  return readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

describe('sidebar layout width contract', () => {
  it('keeps ui.page.shell maxWidth aligned to 1400px', () => {
    const source = readFrontendFile('ui/styles.ts');
    expect(source).toContain("maxWidth: '1400px'");
  });

  it('uses FeatureRouteShell without conflicting hard default maxWidth', () => {
    const source = readFrontendFile('features/shared/FeatureRouteShell.tsx');
    expect(source).toContain('...(maxWidth ? { maxWidth } : {})');
    expect(source).not.toContain("maxWidth = '1400px'");
  });

  it('keeps sidebar route adapters mounted through FeatureRouteShell', () => {
    SIDEBAR_ROUTE_FILES.forEach(({ routeFile, expectedFallback }) => {
      const source = readFrontendFile(routeFile);
      expect(source).toContain('<FeatureRouteShell');
      if (expectedFallback) {
        expect(source).toContain(`fallbackMessage=\"${expectedFallback}\"`);
      }
    });
  });

  it('removes page-level maxWidth wrappers from known outlier screens', () => {
    const eventLog = readFrontendFile('EventLog.tsx');
    const support = readFrontendFile('Support.tsx');
    const gantt = readFrontendFile('ops/GanttView.tsx');
    const settings = readFrontendFile('features/settings/SettingsScreen.tsx');

    expect(eventLog).not.toContain("maxWidth: '1000px'");
    expect(support).not.toContain("maxWidth: '1400px'");
    expect(gantt).not.toContain("maxWidth: '1600px'");
    expect(settings).not.toContain("maxWidth: '1280px'");
  });

  it('does not nest ui.page.shell inside Reports screen', () => {
    const reports = readFrontendFile('Reports.tsx');
    expect(reports).not.toContain('style={ui.page.shell as any}');
  });
});
