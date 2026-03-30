import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const operationsOverviewSource = readFileSync(
  resolve(process.cwd(), 'src/ops/OperationsOverview.tsx'),
  'utf8',
);

describe('ops overview sales-order workflow contract', () => {
  it('loads sales orders directly from the ERP orders payload and keeps workflow contract fields in the row shape', () => {
    expect(operationsOverviewSource).toContain("apiGet(`${API}/sales-orders?limit=200`)");
    expect(operationsOverviewSource).toContain('approvalGateState?: {');
    expect(operationsOverviewSource).toContain('actionAvailability?: {');
  });

  it('treats release-ready, pending gate, and blockers as workflow attention signals', () => {
    expect(operationsOverviewSource).toContain('const workflowAttentionOrders = [...normalizedOrders]');
    expect(operationsOverviewSource).toContain('order.actionAvailability?.canRelease');
    expect(operationsOverviewSource).toContain("String(order.approvalGateState?.status || '').toLowerCase() === 'pending'");
    expect(operationsOverviewSource).toContain('Array.isArray(order.actionAvailability?.blockers) && order.actionAvailability.blockers.length > 0');
    expect(operationsOverviewSource).toContain('const pendingReleaseApprovals = normalizedOrders.filter((order) => String(order.approvalGateState?.status || \'\').toLowerCase() === \'pending\')');
    expect(operationsOverviewSource).toContain('const releasableOrders = normalizedOrders.filter((order) => order.actionAvailability?.canRelease)');
  });

  it('renders the sales-order workflow attention contract with gate, pending approver, release-ready, and blocker pills', () => {
    expect(operationsOverviewSource).toContain('Đơn hàng bàn giao từ dự án, đọc trực tiếp workflow contract từ sales-order payload');
    expect(operationsOverviewSource).toContain('<MiniPill label="Gate"');
    expect(operationsOverviewSource).toContain('label="Pending approver"');
    expect(operationsOverviewSource).toContain('<MiniPill label="Action" value="Release ready" tone="good" />');
    expect(operationsOverviewSource).toContain('<MiniPill key={`${order.id}-${blocker}`} label="Blocker" value={blocker} tone="bad" />');
  });
});
