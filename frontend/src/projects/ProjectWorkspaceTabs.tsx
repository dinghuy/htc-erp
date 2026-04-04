import { useState } from 'preact/hooks';
import { Pricing } from '../Pricing';
import { buildDocumentReviewActions } from './documentReviewActions';
import { buildDocumentWorkspaceSummary, buildFinanceWorkspaceSummary, buildLegalWorkspaceSummary } from './workspaceRoleViews';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';


const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '8px' } as any,
  tabBtn: (active: boolean) => ({
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? tokens.colors.primary : 'transparent',
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    border: 'none',
    borderRadius: tokens.radius.lg,
    transition: 'all 0.2s ease'
  }) as any,
};

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function formatDateValue(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

function formatDateTimeValue(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

function formatMoneyValue(value: any, currency = 'VND') {
  const amount = Number(value || 0);
  return `${Number.isFinite(amount) ? amount.toLocaleString('vi-VN') : 0} ${currency}`;
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPastDate(value?: string | null) {
  const parsed = parseDateValue(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

function numberValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function shortageBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block'
  };
  switch (status) {
    case 'fulfilled':
    case 'ordered_complete':
      return { ...base, ...ui.badge.success };
    case 'partial':
    case 'ordered_short':
      return { ...base, ...ui.badge.warning };
    case 'pending':
      return { ...base, ...ui.badge.error };
    default:
      return { ...base, ...ui.badge.neutral };
  }
}

function alertToneStyle(tone: 'warning' | 'danger' | 'info') {
  if (tone === 'danger') return { background: tokens.colors.badgeBgError, color: tokens.colors.error, border: `1px solid ${tokens.colors.error}` };
  if (tone === 'warning') return { background: tokens.colors.badgeBgInfo, color: tokens.colors.warning, border: `1px solid ${tokens.colors.warning}` };
  return { background: tokens.colors.infoAccentBg, color: tokens.colors.infoAccentText, border: `1px solid ${tokens.colors.primary}` };
}

function timelineAccent(eventType?: string) {
  const type = String(eventType || '').toLowerCase();
  if (type.includes('delivery')) return { line: tokens.colors.success, badge: ui.badge.success };
  if (type.includes('inbound')) return { line: tokens.colors.info, badge: ui.badge.info };
  if (type.includes('milestone')) return { line: tokens.colors.violetStrongText, badge: { background: tokens.colors.violetStrongBg, color: tokens.colors.violetStrongText, padding: `${tokens.spacing.xs} ${tokens.spacing.md}`, borderRadius: tokens.radius.md, fontSize: '11px', fontWeight: 800 } };
  if (type.includes('contract') || type.includes('appendix') || type.includes('baseline')) return { line: tokens.colors.primary, badge: ui.badge.info };
  if (type.includes('procurement')) return { line: tokens.colors.warning, badge: ui.badge.warning };
  return { line: tokens.colors.textMuted, badge: ui.badge.neutral };
}

function timelineTypeLabel(eventType?: string) {
  const type = String(eventType || '').toLowerCase();
  if (!type) return 'Sự kiện';
  if (type.includes('contract')) return 'Hợp đồng';
  if (type.includes('appendix')) return 'Phụ lục';
  if (type.includes('baseline')) return 'Baseline';
  if (type.includes('procurement')) return 'Mua hàng';
  if (type.includes('inbound')) return 'Inbound';
  if (type.includes('delivery')) return 'Giao hàng';
  if (type.includes('milestone')) return 'Milestone';
  return String(eventType || '').replace(/\./g, ' / ');
}

function workflowStatusLabel(value?: string | null) {
  const status = String(value || '').toLowerCase();
  switch (status) {
    case 'missing':
      return 'Thiếu';
    case 'requested':
      return 'Đang yêu cầu';
    case 'pending':
      return 'Đang chờ';
    case 'open':
      return 'Đang mở';
    case 'watch':
      return 'Theo dõi';
    case 'resolved':
      return 'Đã xử lý';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Bị từ chối';
    case 'partial':
      return 'Một phần';
    case 'completed':
      return 'Hoàn tất';
    case 'planned':
      return 'Kế hoạch';
    case 'history':
      return 'Lịch sử';
    case 'effective':
      return 'Hiệu lực';
    case 'draft':
      return 'Nháp';
    case 'signed':
      return 'Đã ký';
    case 'missing':
      return 'Thiếu';
    default:
      return value || 'Chưa cập nhật';
  }
}

export function reviewStatusLabel(value?: string | null) {
  const status = String(value || '').toLowerCase();
  if (status === 'draft') return 'Draft';
  if (status === 'in_review') return 'In review';
  if (status === 'approved') return 'Approved review';
  if (status === 'changes_requested') return 'Changes requested';
  if (status === 'archived') return 'Archived review';
  return value || 'Draft';
}

function auditTypeLabel(value?: string | null) {
  const type = String(value || '').toLowerCase();
  if (type === 'approval') return 'Phê duyệt';
  if (type === 'timeline') return 'Timeline';
  if (type === 'document') return 'Tài liệu';
  if (type === 'milestone') return 'Milestone';
  return value || 'Nhật ký';
}

function blockerSourceLabel(value?: string | null) {
  const source = String(value || '').toLowerCase();
  if (source === 'phase_control') return 'Phase control';
  if (source === 'approval_gate') return 'Approval gate';
  if (source === 'sales_order') return 'Sales order';
  if (source === 'logistics') return 'Logistics';
  if (source === 'document_checklist') return 'Document checklist';
  if (source === 'task') return 'Task';
  return value || 'Workspace';
}

function milestoneTypeLabel(value?: string | null) {
  const type = String(value || '').toLowerCase();
  if (!type) return 'Tổng quát';
  if (type === 'payment') return 'Thanh toán';
  return value || 'Tổng quát';
}

function emptyContractLine() {
  return {
    itemCode: '',
    itemName: '',
    description: '',
    unit: '',
    contractQty: 0,
    unitPrice: 0,
    etaDate: '',
    committedDeliveryDate: '',
  };
}

type DepartmentCoverageMetrics = {
  total: number;
  missing: number;
  approved: number;
};

function WorkspaceSection({ title, children, action }: any) {
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        {action || null}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...ui.card.kpi } as any}>
      <div style={{ fontSize: '26px', fontWeight: 800, color: accent || tokens.colors.textPrimary }}>{value}</div>
      <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function OverviewTab(props: any) {
  const { currentBaseline, executionBaselines, procurementLines, shortageLines, overdueEtaLines, overdueDeliveryLines, unorderedLines, overviewAlerts, pendingMilestones, milestones, workspace, projectId, goToRoute, setTab } = props;
  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Baseline triển khai hiện tại" action={<button style={S.btnOutline} onClick={() => goToRoute('ERP Orders', { projectId }, 'Project', projectId)}>Mở ERP Orders</button>}>
        {!currentBaseline ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có baseline thực thi. Hãy tạo hợp đồng đã ký để sinh baseline.</div> : (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{currentBaseline.title || currentBaseline.sourceType} · v{currentBaseline.baselineNo}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Hiệu lực {formatDateValue(currentBaseline.effectiveDate)} · {formatMoneyValue(currentBaseline.totalValue, currentBaseline.currency || 'VND')}</div>
            {ensureArray(currentBaseline.lineItems).slice(0, 4).map((line: any, index: number) => <div key={`${line.sourceLineKey || line.itemCode || 'line'}-${index}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>SL {line.contractQty || 0} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div></div>)}
          </div>
        )}
      </WorkspaceSection>
      <WorkspaceSection title="Cảnh báo vận hành" action={<button style={S.btnOutline} onClick={() => setTab('procurement')}>Mở mua hàng</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="Line thiếu hàng" value={shortageLines.length} accent={tokens.colors.error} />
          <KpiCard label="Quá ETA" value={overdueEtaLines.length} accent={tokens.colors.warning} />
          <KpiCard label="Quá cam kết giao" value={overdueDeliveryLines.length} accent={tokens.colors.warning} />
          <KpiCard label="Chưa đặt đủ" value={unorderedLines.length} accent={tokens.colors.primary} />
        </div>
        {overviewAlerts.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có cảnh báo vận hành nổi bật.</div> : <div style={{ display: 'grid', gap: '10px' }}>{overviewAlerts.map((alert: any) => <div key={alert.key} style={{ ...alertToneStyle(alert.tone), borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800 }}>{alert.title}</div><div style={{ fontSize: '12px', opacity: 0.92, marginTop: '4px' }}>{alert.description}</div></div>)}</div>}
      </WorkspaceSection>
      <WorkspaceSection title="Điểm vào liên quan">
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Khách hàng: {workspace.accountName || '—'} · Người phụ trách: {workspace.managerName || '—'} · Baseline: {executionBaselines.length} · Line mua hàng: {procurementLines.length} · Milestone: {milestones.length} · Mốc đang chờ: {pendingMilestones.length}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={S.btnOutline} onClick={() => goToRoute('Sales', { projectId }, 'Project', projectId)}>Mở Sales</button>
            <button style={S.btnOutline} onClick={() => setTab('finance')}>Mở quản lý chi phí</button>
            <button style={S.btnOutline} onClick={() => goToRoute('Tasks', { projectId }, 'Project', projectId)}>Mở công việc</button>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );
}

export function QuotationTab({ quotationVersions }: any) {
  return <WorkspaceSection title="Phiên bản báo giá">{quotationVersions.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có báo giá trong dự án.</div> : <div style={{ display: 'grid', gap: '10px' }}>{quotationVersions.map((q: any) => <div key={q.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{q.quoteNumber || q.id} {q.revisionLabel ? `· ${q.revisionLabel}` : ''}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{q.subject || 'Không có tiêu đề'} · {formatDateValue(q.quoteDate)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{q.isWinningVersion ? <span style={ui.badge.success}>Đang thắng</span> : null}<span style={ui.badge.neutral}>{workflowStatusLabel(q.status || 'draft')}</span></div></div></div>)}</div>}</WorkspaceSection>;
}

export function QbuRoundsTab({ qbuRounds }: any) {
  return <WorkspaceSection title="Vòng QBU">{qbuRounds.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có vòng QBU nào trong dự án.</div> : <div style={{ display: 'grid', gap: '10px' }}>{qbuRounds.map((round: any) => <div key={round.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Batch {round.batchNo || '—'} · {round.quoteNumber || round.revisionLabel || round.id}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{round.subject || 'Không có tiêu đề'} · Ngày báo giá {formatDateValue(round.quoteDate)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><span style={ui.badge.info}>{round.qbuType || 'QBU'}</span><span style={ui.badge.neutral}>{workflowStatusLabel(round.qbuWorkflowStage || round.status || 'draft')}</span></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Đã gửi</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatDateValue(round.qbuSubmittedAt)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Hoàn tất</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatDateValue(round.qbuCompletedAt)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Số line</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{numberValue(round.lineItemCount)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Giá trị</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatMoneyValue(round.totalAmount, round.currency || 'VND')}</div></div></div></div>)}</div>}</WorkspaceSection>;
}

export function ContractTab(props: any) {
  const { workspace, currentBaseline, contractAppendices, executionBaselines, setContractEditor, setAppendixEditor, canEditCommercial = false } = props;
  return <div style={{ display: 'grid', gap: '18px' }}>
    <WorkspaceSection title="Hợp đồng chính" action={canEditCommercial && !workspace.mainContract ? <button style={S.btnPrimary} onClick={() => setContractEditor({ contractNumber: '', title: '', signedDate: '', effectiveDate: '', status: 'signed', currency: 'VND', totalValue: 0, summary: '', lineItems: currentBaseline?.lineItems?.length ? currentBaseline.lineItems : [emptyContractLine()] })}>Tạo hợp đồng chính</button> : null}>
      {!workspace.mainContract ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có hợp đồng chính.</div> : <div style={{ display: 'grid', gap: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{workspace.mainContract.contractNumber || workspace.mainContract.title || 'Hợp đồng chính'}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Ký {formatDateValue(workspace.mainContract.signedDate)} · Hiệu lực {formatDateValue(workspace.mainContract.effectiveDate)} · {formatMoneyValue(workspace.mainContract.totalValue, workspace.mainContract.currency || 'VND')}</div></div>{canEditCommercial ? <button style={S.btnOutline} onClick={() => setContractEditor({ ...workspace.mainContract, lineItems: ensureArray(workspace.mainContract.lineItems).length ? workspace.mainContract.lineItems : [emptyContractLine()] })}>Cập nhật hợp đồng</button> : null}</div>{ensureArray(workspace.mainContract.lineItems).map((line: any, index: number) => <div key={`${line.sourceLineKey || line.itemCode || 'line'}-${index}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>SL {line.contractQty || 0} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div></div>)}</div>}
    </WorkspaceSection>
    <WorkspaceSection title="Phụ lục hợp đồng" action={canEditCommercial && workspace.mainContract ? <button style={S.btnPrimary} onClick={() => setAppendixEditor({ appendixNumber: '', title: '', signedDate: '', effectiveDate: '', status: 'effective', totalDeltaValue: 0, summary: '', lineItems: currentBaseline?.lineItems?.length ? currentBaseline.lineItems : ensureArray(workspace.mainContract.lineItems).length ? workspace.mainContract.lineItems : [emptyContractLine()] })}>Tạo phụ lục</button> : null}>
      {contractAppendices.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có phụ lục nào.</div> : <div style={{ display: 'grid', gap: '10px' }}>{contractAppendices.map((appendix: any) => <div key={appendix.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{appendix.appendixNumber || appendix.title || appendix.id}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Ký {formatDateValue(appendix.signedDate)} · Hiệu lực {formatDateValue(appendix.effectiveDate)} · {workflowStatusLabel(appendix.status || 'effective')}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}><span style={ui.badge.info}>{formatMoneyValue(appendix.totalDeltaValue, workspace.mainContract?.currency || 'VND')}</span>{canEditCommercial ? <button style={S.btnOutline} onClick={() => setAppendixEditor({ ...appendix, lineItems: ensureArray(appendix.lineItems).length ? appendix.lineItems : [emptyContractLine()] })}>Cập nhật</button> : null}</div></div></div>)}</div>}
    </WorkspaceSection>
    <WorkspaceSection title="Baseline triển khai">{executionBaselines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có baseline thực thi.</div> : <div style={{ display: 'grid', gap: '10px' }}>{executionBaselines.map((baseline: any) => <div key={baseline.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Baseline v{baseline.baselineNo} · {baseline.title || baseline.sourceType}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{baseline.sourceType} · Hiệu lực {formatDateValue(baseline.effectiveDate)} · {baseline.lineItems?.length || 0} line</div></div>{baseline.isCurrent ? <span style={ui.badge.success}>Hiện hành</span> : <span style={ui.badge.neutral}>Lịch sử</span>}</div></div>)}</div>}</WorkspaceSection>
  </div>;
}

export function ProcurementTab(props: any) {
  const { activeProcurementLines, historyProcurementLines, unorderedLines, shortageLines, overdueEtaLines, overdueDeliveryLines, setProcurementEditor, openInboundFromProcurement, openDeliveryFromProcurement, canEditProcurement = false } = props;
  return <div style={{ display: 'grid', gap: '18px' }}>
  <WorkspaceSection title="Baseline mua hàng hiện hành">{activeProcurementLines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Baseline hiện hành chưa có line mua hàng đang hoạt động.</div> : <div style={{ display: 'grid', gap: '12px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
      <KpiCard label="Chưa đặt đủ" value={unorderedLines.length} accent={tokens.colors.primary} />
      <KpiCard label="Thiếu hàng" value={shortageLines.length} accent={tokens.colors.error} />
      <KpiCard label="Quá ETA" value={overdueEtaLines.length} accent={tokens.colors.warning} />
      <KpiCard label="Quá giao hàng" value={overdueDeliveryLines.length} accent={tokens.colors.warning} />
    </div>
    <div style={{ display: 'grid', gap: '10px' }}>{activeProcurementLines.map((line: any) => {
      const delayedEta = isPastDate(line.etaDate) && numberValue(line.receivedQty) < Math.max(numberValue(line.orderedQty), numberValue(line.contractQty));
      const delayedDelivery = isPastDate(line.committedDeliveryDate) && numberValue(line.deliveredQty) < numberValue(line.contractQty);
      return <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '12px', background: (delayedEta || delayedDelivery || numberValue(line.shortageQty) > 0) ? tokens.colors.warningSurfaceBgSoft : tokens.colors.surface }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>NCC {line.supplierName || '—'} · PO {line.poNumber || '—'} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div>
            {line.note ? <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '4px' }}>{line.note}</div> : null}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={ui.badge.info}>{workflowStatusLabel(line.status || 'planned')}</span>
            <span style={shortageBadgeStyle(line.shortageStatus)}>{workflowStatusLabel(line.shortageStatus || 'pending')}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Hợp đồng</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{numberValue(line.contractQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Đặt mua</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.primary }}>{numberValue(line.orderedQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Đã nhận</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.info }}>{numberValue(line.receivedQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Đã giao</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.success }}>{numberValue(line.deliveredQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Thiếu</div><div style={{ fontSize: '18px', fontWeight: 800, color: numberValue(line.shortageQty) > 0 ? tokens.colors.error : tokens.colors.success }}>{numberValue(line.shortageQty)}</div></div>
        </div>
        {(delayedEta || delayedDelivery || numberValue(line.shortageQty) > 0) ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {delayedEta ? <span style={{ ...alertToneStyle('warning'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Quá ETA</span> : null}
          {delayedDelivery ? <span style={{ ...alertToneStyle('warning'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Quá cam kết giao</span> : null}
          {numberValue(line.shortageQty) > 0 ? <span style={{ ...alertToneStyle('danger'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Thiếu {numberValue(line.shortageQty)}</span> : null}
        </div> : null}
        {canEditProcurement ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={S.btnOutline} onClick={() => setProcurementEditor(line)}>Cập nhật line</button>
          <button style={S.btnOutline} onClick={() => openInboundFromProcurement(line)}>Ghi nhận nhập hàng</button>
          <button style={S.btnOutline} onClick={() => openDeliveryFromProcurement(line)}>Ghi nhận giao hàng</button>
        </div> : null}
      </div>;
    })}</div>
  </div>}</WorkspaceSection>
  <WorkspaceSection title="Lịch sử mua hàng">
    {historyProcurementLines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có line mua hàng lịch sử nào bị thay thế.</div> : <div style={{ display: 'grid', gap: '10px' }}>{historyProcurementLines.map((line: any) => <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '10px', background: '#fafafa' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Baseline {line.baselineId || '—'} · Bị thay thế {formatDateValue(line.supersededAt)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><span style={ui.badge.neutral}>{workflowStatusLabel(line.status || 'history')}</span><span style={ui.badge.warning}>Lịch sử</span></div></div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Hợp đồng {numberValue(line.contractQty)} · Đặt mua {numberValue(line.orderedQty)} · Đã nhận {numberValue(line.receivedQty)} · Đã giao {numberValue(line.deliveredQty)}</div></div>)}</div>}
  </WorkspaceSection>
  </div>;
}

export function InboundTab({ inboundLines, setInboundEditor, canEditDelivery = false }: any) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const keyword = search.trim().toLowerCase();
  const filteredLines = inboundLines.filter((line: any) => {
    const text = `${line.itemCode || ''} ${line.itemName || ''} ${line.procurementDescription || ''} ${line.receiptRef || ''} ${line.note || ''}`.toLowerCase();
    const matchesSearch = !keyword || text.includes(keyword);
    const matchesStatus = statusFilter === 'all' || String(line.status || '').toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <WorkspaceSection
      title="Sự kiện inbound"
      action={canEditDelivery ? <button style={S.btnPrimary} onClick={() => setInboundEditor({ procurementLineId: '', receivedQty: 0, etaDate: '', actualReceivedDate: '', status: 'partial', receiptRef: '', note: '' })}>Ghi nhận nhập hàng</button> : null}
    >
      {inboundLines.length === 0 ? (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có đợt nhập hàng nào.</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <input
              style={S.input}
              value={search}
              placeholder="Tìm theo item, receipt ref, ghi chú..."
              onInput={(e: any) => setSearch(e.target.value)}
            />
            <select style={S.input} value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Đang chờ</option>
              <option value="partial">Một phần</option>
              <option value="completed">Hoàn tất</option>
            </select>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
            Hiển thị {filteredLines.length}/{inboundLines.length} sự kiện inbound
          </div>
          {filteredLines.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có sự kiện phù hợp bộ lọc.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredLines.map((line: any) => (
                <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', background: line.procurementIsActive === false ? '#fafafa' : tokens.colors.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.procurementDescription}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Nhập {line.receivedQty || 0} · ETA {formatDateValue(line.etaDate)} · Thực nhận {formatDateValue(line.actualReceivedDate)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {line.procurementIsActive === false ? <span style={ui.badge.warning}>Line lịch sử</span> : null}
                      <span style={ui.badge.neutral}>{workflowStatusLabel(line.status || 'pending')}</span>
                      {canEditDelivery ? <button style={S.btnOutline} onClick={() => setInboundEditor(line)}>Cập nhật</button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WorkspaceSection>
  );
}

export function DeliveryTab({ deliveryLines, setDeliveryEditor, canEditDelivery = false }: any) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const keyword = search.trim().toLowerCase();
  const filteredLines = deliveryLines.filter((line: any) => {
    const text = `${line.itemCode || ''} ${line.itemName || ''} ${line.procurementDescription || ''} ${line.deliveryRef || ''} ${line.note || ''}`.toLowerCase();
    const matchesSearch = !keyword || text.includes(keyword);
    const matchesStatus = statusFilter === 'all' || String(line.status || '').toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <WorkspaceSection
      title="Sự kiện giao hàng"
      action={canEditDelivery ? <button style={S.btnPrimary} onClick={() => setDeliveryEditor({ procurementLineId: '', deliveredQty: 0, committedDate: '', actualDeliveryDate: '', status: 'partial', deliveryRef: '', note: '' })}>Ghi nhận giao hàng</button> : null}
    >
      {deliveryLines.length === 0 ? (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có đợt giao hàng nào.</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <input
              style={S.input}
              value={search}
              placeholder="Tìm theo item, delivery ref, ghi chú..."
              onInput={(e: any) => setSearch(e.target.value)}
            />
            <select style={S.input} value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Đang chờ</option>
              <option value="partial">Một phần</option>
              <option value="completed">Hoàn tất</option>
            </select>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
            Hiển thị {filteredLines.length}/{deliveryLines.length} sự kiện giao hàng
          </div>
          {filteredLines.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có sự kiện phù hợp bộ lọc.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredLines.map((line: any) => (
                <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', background: line.procurementIsActive === false ? '#fafafa' : tokens.colors.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.procurementDescription}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Giao {line.deliveredQty || 0} · Cam kết {formatDateValue(line.committedDate)} · Thực giao {formatDateValue(line.actualDeliveryDate)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {line.procurementIsActive === false ? <span style={ui.badge.warning}>Line lịch sử</span> : null}
                      <span style={ui.badge.neutral}>{workflowStatusLabel(line.status || 'pending')}</span>
                      {canEditDelivery ? <button style={S.btnOutline} onClick={() => setDeliveryEditor(line)}>Cập nhật</button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WorkspaceSection>
  );
}

export function TimelineTab({ milestones, timeline, activityStream = [], setMilestoneEditor, canEditTimeline = false }: any) {
  const [eventFilter, setEventFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activitySourceFilter, setActivitySourceFilter] = useState('all');
  const keyword = search.trim().toLowerCase();

  const filteredTimeline = timeline.filter((event: any) => {
    const type = String(event.eventType || '').toLowerCase();
    const text = `${event.title || ''} ${event.description || ''} ${type}`.toLowerCase();
    const matchesType = eventFilter === 'all' || type.includes(eventFilter);
    const matchesSearch = !keyword || text.includes(keyword);
    return matchesType && matchesSearch;
  });

  const filteredActivityStream = ensureArray(activityStream).filter((item: any) => {
    const source = String(item?.source || 'activity').toLowerCase();
    const text = `${item?.title || ''} ${item?.body || ''} ${item?.activityType || ''} ${item?.actor || ''}`.toLowerCase();
    const matchesSource = activitySourceFilter === 'all' || source === activitySourceFilter;
    const matchesSearch = !keyword || text.includes(keyword);
    return matchesSource && matchesSearch;
  });

  return <div style={{ display: 'grid', gap: '18px' }}>
    <WorkspaceSection title="Milestone" action={canEditTimeline ? <button style={S.btnPrimary} onClick={() => setMilestoneEditor({ milestoneType: '', title: '', plannedDate: '', actualDate: '', status: 'pending', note: '' })}>Tạo milestone</button> : null}>{milestones.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có milestone nào.</div> : <div style={{ display: 'grid', gap: '10px' }}>{milestones.map((milestone: any) => <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{milestoneTypeLabel(milestone.milestoneType)} · Kế hoạch {formatDateValue(milestone.plannedDate)} · Thực tế {formatDateValue(milestone.actualDate)}</div></div>{canEditTimeline ? <button style={S.btnOutline} onClick={() => setMilestoneEditor(milestone)}>Cập nhật</button> : null}</div></div>)}</div>}</WorkspaceSection>
    <WorkspaceSection title="Timeline dự án">
      {timeline.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có sự kiện timeline nào.</div> : <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          <input style={S.input} value={search} placeholder="Tìm theo tiêu đề/mô tả sự kiện..." onInput={(e: any) => setSearch(e.target.value)} />
          <select style={S.input} value={eventFilter} onChange={(e: any) => setEventFilter(e.target.value)}>
            <option value="all">Tất cả loại sự kiện</option>
            <option value="contract">hợp đồng</option>
            <option value="appendix">phụ lục</option>
            <option value="baseline">baseline</option>
            <option value="procurement">mua hàng</option>
            <option value="inbound">inbound</option>
            <option value="delivery">giao hàng</option>
            <option value="milestone">milestone</option>
          </select>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
          Hiển thị {filteredTimeline.length}/{timeline.length} sự kiện timeline
        </div>
        {filteredTimeline.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có sự kiện phù hợp bộ lọc.</div> : <div style={{ display: 'grid', gap: '12px' }}>{filteredTimeline.map((event: any) => {
          const accent = timelineAccent(event.eventType);
          return <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '12px', alignItems: 'stretch' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gridTemplateRows: '14px 1fr' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '999px', background: accent.line, marginTop: '4px' }} />
              <div style={{ width: '2px', background: accent.line, opacity: 0.35, minHeight: '48px' }} />
            </div>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', background: tokens.colors.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{event.title}</div>
                <span style={accent.badge as any}>{timelineTypeLabel(event.eventType)}</span>
              </div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px', lineHeight: 1.5 }}>{event.description || '—'}</div>
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '8px' }}>{formatDateTimeValue(event.eventDate || event.createdAt)}</div>
            </div>
          </div>;
        })}</div>}
      </div>}
    </WorkspaceSection>
    <WorkspaceSection title="Activity stream">
      {ensureArray(activityStream).length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có activity stream nào nổi bật.</div> : <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          <select style={S.input} value={activitySourceFilter} onChange={(e: any) => setActivitySourceFilter(e.target.value)}>
            <option value="all">Tất cả nguồn</option>
            <option value="activity">Activity</option>
            <option value="timeline">Timeline</option>
            <option value="approval">Approval</option>
          </select>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
          Hiển thị {filteredActivityStream.length}/{ensureArray(activityStream).length} activity stream items
        </div>
        {filteredActivityStream.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có activity phù hợp bộ lọc.</div> : <div style={{ display: 'grid', gap: '12px' }}>{filteredActivityStream.map((item: any) => {
          const source = String(item.source || 'activity').toLowerCase();
          const badgeStyle = source === 'approval' ? ui.badge.warning : source === 'timeline' ? ui.badge.info : ui.badge.neutral;
          return <div key={item.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', background: tokens.colors.surface }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.title}</div>
              <span style={badgeStyle as any}>{auditTypeLabel(item.source)}</span>
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px', lineHeight: 1.5 }}>{item.body || '—'}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px', fontSize: '11px', color: tokens.colors.textMuted }}>
              <span>{item.activityType || 'activity'}</span>
              {item.actor ? <span>Actor: {item.actor}</span> : null}
              <span>{formatDateTimeValue(item.createdAt)}</span>
            </div>
          </div>;
        })}</div>}
      </div>}
    </WorkspaceSection>
  </div>;
}

export function FinanceTab({ projectId, token, workspace, approvals, milestones, overdueDeliveryLines, onChanged, canEditPricing = false }: any) {
  const summary = buildFinanceWorkspaceSummary({ workspace, approvals, milestones, overdueDeliveryLines });

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Cockpit quản lý chi phí">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="Phê duyệt tài chính" value={summary.financeApprovals.length} accent={tokens.colors.primary} />
          <KpiCard label="Phê duyệt đang chờ" value={summary.pendingFinanceApprovals.length} accent={tokens.colors.warning} />
          <KpiCard label="Milestone thanh toán" value={summary.pendingPaymentMilestones.length} accent={tokens.colors.info} />
          <KpiCard label="Hồ sơ tài chính thiếu" value={summary.missingFinanceDocuments.length} accent={tokens.colors.error} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Rủi ro công nợ và giao hàng">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Mục rủi ro công nợ</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.textPrimary, marginTop: '8px' }}>{summary.receivableApprovals.length}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Các phê duyệt gắn với thanh toán, invoice hoặc công nợ.</div>
          </div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Rủi ro giao hàng</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.error, marginTop: '8px' }}>{summary.deliveryRiskCount}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Dòng giao hàng quá cam kết có thể ảnh hưởng invoice hoặc thu tiền.</div>
          </div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Hồ sơ tài chính đã duyệt</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.success, marginTop: '8px' }}>{summary.financeDocuments.length - summary.missingFinanceDocuments.length}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Bộ chứng từ tài chính đã sẵn sàng cho bước tiếp theo.</div>
          </div>
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Hàng đợi phê duyệt tài chính">
        {summary.financeApprovals.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có phê duyệt tài chính nào cho dự án này.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {summary.financeApprovals.map((approval: any) => (
              <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title || approval.requestType || approval.id}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{approval.note || approval.description || 'Chưa có ghi chú.'}</div>
                    <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '6px' }}>
                      Phòng ban {approval.department || 'Tài chính'} · Hạn {formatDateValue(approval.dueDate)}
                    </div>
                  </div>
                  <span style={String(approval.status || '').toLowerCase() === 'approved' ? ui.badge.success : String(approval.status || '').toLowerCase() === 'pending' ? ui.badge.warning : ui.badge.neutral}>
                    {workflowStatusLabel(approval.status || 'pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Milestone thanh toán">
        {summary.paymentMilestones.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có milestone tài chính nào được khai báo trong dự án này.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {summary.paymentMilestones.map((milestone: any) => (
              <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title || milestone.id}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {milestoneTypeLabel(milestone.milestoneType || 'payment')} · Kế hoạch {formatDateValue(milestone.plannedDate)} · Thực tế {formatDateValue(milestone.actualDate)}
                    </div>
                  </div>
                  <span style={String(milestone.status || '').toLowerCase() === 'completed' ? ui.badge.success : ui.badge.warning}>
                    {workflowStatusLabel(milestone.status || 'pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Quản lý chi phí dự án">
        <Pricing
          token={token}
          projectId={projectId}
          projectContext={workspace}
          embedded
          onChanged={onChanged}
          readOnly={!canEditPricing}
        />
      </WorkspaceSection>
    </div>
  );
}

export function LegalTab({ workspace, approvals, contractAppendices, setTab }: any) {
  const summary = buildLegalWorkspaceSummary({ workspace, approvals, contractAppendices });

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Rà soát pháp lý" action={<button style={S.btnOutline} onClick={() => setTab('documents')}>Mở hồ sơ</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KpiCard label="Phê duyệt pháp lý" value={summary.legalApprovals.length} accent={tokens.colors.primary} />
          <KpiCard label="Pháp lý đang chờ" value={summary.pendingLegalApprovals.length} accent={tokens.colors.warning} />
          <KpiCard label="Mục sai lệch" value={summary.deviationApprovals.length} accent={tokens.colors.error} />
          <KpiCard label="Hồ sơ pháp lý thiếu" value={summary.missingLegalDocuments.length} accent={tokens.colors.info} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Hợp đồng và sai lệch">
        <div style={{ display: 'grid', gap: '10px' }}>
          {workspace?.mainContract ? (
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{workspace.mainContract.contractNumber || workspace.mainContract.title || 'Hợp đồng chính'}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                Ký {formatDateValue(workspace.mainContract.signedDate)} · Hiệu lực {formatDateValue(workspace.mainContract.effectiveDate)} · {workspace.mainContract.status || 'draft'}
              </div>
            </div>
          ) : (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có hợp đồng chính.</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Phụ lục đã ký</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.success, marginTop: '8px' }}>{summary.signedAppendices.length}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Phụ lục đã có hiệu lực hoặc đã ký.</div>
            </div>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Hồ sơ pháp lý đang theo dõi</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.textPrimary, marginTop: '8px' }}>{summary.legalDocuments.length}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Checklist hồ sơ pháp lý đang theo dõi trong dự án.</div>
            </div>
          </div>

          {summary.legalApprovals.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có phê duyệt pháp lý nào.</div>
          ) : summary.legalApprovals.map((approval: any) => (
            <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title || approval.requestType || approval.id}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{approval.note || approval.description || 'Không có ghi chú sai lệch.'}</div>
                  <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '6px' }}>
                    Phòng ban {approval.department || 'Pháp lý'} · Hạn {formatDateValue(approval.dueDate)}
                  </div>
                </div>
                <span style={String(approval.status || '').toLowerCase() === 'approved' ? ui.badge.success : String(approval.status || '').toLowerCase() === 'pending' ? ui.badge.warning : ui.badge.error}>
                  {workflowStatusLabel(approval.status || 'pending')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>
    </div>
  );
}

export function ProjectTasksTab({ workspace, milestones, goToRoute, projectId }: any) {
  const pendingMilestones = ensureArray(milestones).filter((milestone: any) => String(milestone.status || '').toLowerCase() !== 'completed');

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Tóm tắt công việc" action={<button style={S.btnPrimary} onClick={() => goToRoute('Tasks', { projectId }, 'Project', projectId)}>Mở công việc</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KpiCard label="Tổng công việc" value={numberValue(workspace?.taskCount)} accent={tokens.colors.textPrimary} />
          <KpiCard label="Công việc mở" value={numberValue(workspace?.openTaskCount)} accent={tokens.colors.primary} />
          <KpiCard label="Công việc quá hạn" value={numberValue(workspace?.overdueTaskCount)} accent={tokens.colors.error} />
          <KpiCard label="Milestone đang chờ" value={pendingMilestones.length} accent={tokens.colors.warning} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Milestone đang chờ">
        {pendingMilestones.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không còn milestone nào đang chờ.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {pendingMilestones.map((milestone: any) => (
              <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title}</div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                  {milestoneTypeLabel(milestone.milestoneType)} · Kế hoạch {formatDateValue(milestone.plannedDate)} · Trạng thái {workflowStatusLabel(milestone.status || 'pending')}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}

export function DocumentsTab({ workspace, canEditDocuments = false, reviewerRoleCodes, openDocumentEditor, openBlockerEditor, openAuditItem, onRunAction, onOpenThread, onQuickReviewAction }: any) {
  const summary = buildDocumentWorkspaceSummary({ workspace });
  const departments = Object.entries(summary.groupedByDepartment as Record<string, DepartmentCoverageMetrics>);
  const blockerRegister = ensureArray(summary.blockers);
  const auditItems = ensureArray(summary.auditItems);

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Cockpit checklist hồ sơ" action={canEditDocuments ? <button style={S.btnPrimary} onClick={() => openDocumentEditor?.({
        documentCode: '',
        documentName: '',
        category: '',
        department: '',
        status: 'missing',
        requiredAtStage: workspace?.projectStage || '',
        receivedAt: '',
        note: '',
      })}>Thêm checklist</button> : null}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="Tổng hồ sơ" value={summary.documents.length} accent={tokens.colors.textPrimary} />
          <KpiCard label="Thiếu / đang yêu cầu" value={summary.missingDocuments.length} accent={tokens.colors.error} />
          <KpiCard label="Đã duyệt" value={summary.approvedDocuments.length} accent={tokens.colors.success} />
          <KpiCard label="Phòng ban" value={departments.length} accent={tokens.colors.info} />
          <KpiCard label="Có thread" value={summary.documentsWithThreads} accent={tokens.colors.primary} />
          <KpiCard label="Tin nhắn thread" value={summary.totalThreadMessages} accent={tokens.colors.warning} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={ui.badge.neutral}>Draft {summary.reviewStateCounts.draft}</span>
          <span style={ui.badge.info}>In review {summary.reviewStateCounts.in_review}</span>
          <span style={ui.badge.success}>Approved {summary.reviewStateCounts.approved}</span>
          <span style={ui.badge.warning}>Changes requested {summary.reviewStateCounts.changes_requested}</span>
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Mức phủ theo phòng ban">
        {departments.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có phòng ban nào được ghi nhận trong checklist.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {departments.map(([department, metrics]) => (
              <div key={department} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{department}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <span style={ui.badge.neutral}>Tổng {metrics.total}</span>
                  <span style={metrics.missing > 0 ? ui.badge.error : ui.badge.success}>Thiếu {metrics.missing}</span>
                  <span style={ui.badge.info}>Đã duyệt {metrics.approved}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Blocker register" action={canEditDocuments ? <button style={S.btnOutline} onClick={() => openBlockerEditor?.({
        source: 'manual',
        category: 'workflow',
        ownerRole: '',
        status: 'open',
        tone: 'warning',
        title: '',
        detail: '',
        action: '',
        linkedEntityType: '',
        linkedEntityId: '',
      })}>Thêm blocker</button> : null}>
        {blockerRegister.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có blocker nào đang ghim trong workspace.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {blockerRegister.map((blocker: any) => (
              <div key={blocker.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: blocker.tone === 'danger' ? tokens.colors.badgeBgError : tokens.colors.warningTint }}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{blocker.title}</div>
                    <span style={blocker.tone === 'danger' ? ui.badge.error : ui.badge.warning}>{blockerSourceLabel(blocker.source)}</span>
                    {blocker.owner ? <span style={ui.badge.neutral}>{blocker.owner}</span> : null}
                    {blocker.status ? <span style={String(blocker.status).toLowerCase() === 'resolved' ? ui.badge.success : ui.badge.warning}>{workflowStatusLabel(blocker.status)}</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{blocker.detail}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {blocker.action ? <button style={S.btnOutline} onClick={() => onRunAction?.(blocker.action)}>Mở bề mặt xử lý</button> : null}
                  {canEditDocuments && blocker.isManual ? <button style={S.btnOutline} onClick={() => openBlockerEditor?.(blocker)}>Cập nhật</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Hồ sơ dự án">
      {summary.documents.length === 0 ? (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có checklist hồ sơ nào trong dự án.</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {summary.documents.map((document: any) => (
            (() => {
              const reviewActions = buildDocumentReviewActions(reviewerRoleCodes, document.reviewStatus);
              return (
            <div key={document.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{document.documentName || document.documentCode || document.id}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                    {document.department || 'liên phòng ban'} · {document.category || 'checklist dự án'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={String(document.status || '').toLowerCase() === 'missing' ? ui.badge.error : String(document.status || '').toLowerCase() === 'approved' ? ui.badge.success : ui.badge.warning}>
                    {workflowStatusLabel(document.status || 'pending')}
                  </span>
                  <span style={String(document.reviewStatus || '').toLowerCase() === 'approved' ? ui.badge.success : String(document.reviewStatus || '').toLowerCase() === 'changes_requested' ? ui.badge.warning : ui.badge.neutral}>
                    {reviewStatusLabel(document.reviewStatus || 'draft')}
                  </span>
                  {Number(document.threadMessageCount || 0) > 0 ? <span style={ui.badge.info}>{Number(document.threadMessageCount || 0)} thread msg</span> : null}
                  <button style={S.btnOutline} onClick={() => onOpenThread?.(document)}>{document.threadId ? 'Mở thread' : 'Tạo thread'}</button>
                  {canEditDocuments ? <button style={S.btnOutline} onClick={() => openDocumentEditor?.(document)}>Cập nhật</button> : null}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '8px' }}>
                Cần tại giai đoạn {document.requiredAtStage || 'bất kỳ'} · Nhận {formatDateValue(document.receivedAt)}
              </div>
              {document.note ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '8px' }}>{document.note}</div> : null}
              {(document.reviewNote || document.storageKey || document.threadId) ? (
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '8px', display: 'grid', gap: '4px' }}>
                  {document.reviewNote ? <div>Review note: {document.reviewNote}</div> : null}
                  {document.storageKey ? <div>Storage: {document.storageKey}</div> : null}
                  {document.threadId ? <div>Thread: {document.threadId}</div> : null}
                </div>
              ) : null}
              {reviewActions.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {reviewActions.map((action) => (
                    <button
                      key={`${document.id}-${action.id}`}
                      style={action.tone === 'primary' ? S.btnPrimary : S.btnOutline}
                      onClick={() => onQuickReviewAction?.(document, action.nextStatus)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
              );
            })()
          ))}
        </div>
      )}
    </WorkspaceSection>

      <WorkspaceSection title="Phê duyệt / nhật ký kiểm tra">
        {auditItems.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có mục phê duyệt hoặc kiểm tra nào nổi bật.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {auditItems.map((item: any) => (
              <div key={item.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={item.type === 'approval' || item.source === 'approval' ? ui.badge.warning : item.type === 'timeline' || item.source === 'timeline' ? ui.badge.info : ui.badge.neutral}>
                      {auditTypeLabel(item.type || item.source)}
                    </span>
                    {item.status ? <span style={String(item.status || '').toLowerCase() === 'approved' ? ui.badge.success : String(item.status || '').toLowerCase() === 'pending' ? ui.badge.warning : ui.badge.neutral}>{workflowStatusLabel(item.status)}</span> : null}
                    <button style={S.btnOutline} onClick={() => openAuditItem?.(item)}>Xem chi tiết</button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px', lineHeight: 1.6 }}>{item.detail}</div>
                <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '8px' }}>{item.actor || item.meta || item.category || 'workspace'} · {formatDateTimeValue(item.eventDate)}</div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}


