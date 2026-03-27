import { useState } from 'preact/hooks';
import { Pricing } from '../Pricing';
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
  return { background: '#e8f4fd', color: tokens.colors.primary, border: `1px solid ${tokens.colors.primary}` };
}

function timelineAccent(eventType?: string) {
  const type = String(eventType || '').toLowerCase();
  if (type.includes('delivery')) return { line: tokens.colors.success, badge: ui.badge.success };
  if (type.includes('inbound')) return { line: tokens.colors.info, badge: ui.badge.info };
  if (type.includes('milestone')) return { line: '#6d28d9', badge: { background: '#ede9fe', color: '#6d28d9', padding: `${tokens.spacing.xs} ${tokens.spacing.md}`, borderRadius: tokens.radius.md, fontSize: '11px', fontWeight: 800 } };
  if (type.includes('contract') || type.includes('appendix') || type.includes('baseline')) return { line: tokens.colors.primary, badge: ui.badge.info };
  if (type.includes('procurement')) return { line: tokens.colors.warning, badge: ui.badge.warning };
  return { line: tokens.colors.textMuted, badge: ui.badge.neutral };
}

function timelineTypeLabel(eventType?: string) {
  const type = String(eventType || '').replace(/\./g, ' / ');
  return type || 'event';
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
      <WorkspaceSection title="Current Execution Baseline" action={<button style={S.btnOutline} onClick={() => goToRoute('ERP Orders', { projectId }, 'Project', projectId)}>Mở ERP Orders</button>}>
        {!currentBaseline ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có baseline thực thi. Hãy tạo hợp đồng đã ký để sinh baseline.</div> : (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{currentBaseline.title || currentBaseline.sourceType} · v{currentBaseline.baselineNo}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Hiệu lực {formatDateValue(currentBaseline.effectiveDate)} · {formatMoneyValue(currentBaseline.totalValue, currentBaseline.currency || 'VND')}</div>
            {ensureArray(currentBaseline.lineItems).slice(0, 4).map((line: any, index: number) => <div key={`${line.sourceLineKey || line.itemCode || 'line'}-${index}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Qty {line.contractQty || 0} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div></div>)}
          </div>
        )}
      </WorkspaceSection>
      <WorkspaceSection title="Operational Alerts" action={<button style={S.btnOutline} onClick={() => setTab('procurement')}>Mở Procurement</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="Line thiếu hàng" value={shortageLines.length} accent={tokens.colors.error} />
          <KpiCard label="Quá ETA" value={overdueEtaLines.length} accent={tokens.colors.warning} />
          <KpiCard label="Quá cam kết giao" value={overdueDeliveryLines.length} accent={tokens.colors.warning} />
          <KpiCard label="Chưa đặt đủ" value={unorderedLines.length} accent={tokens.colors.primary} />
        </div>
        {overviewAlerts.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có cảnh báo vận hành nổi bật.</div> : <div style={{ display: 'grid', gap: '10px' }}>{overviewAlerts.map((alert: any) => <div key={alert.key} style={{ ...alertToneStyle(alert.tone), borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800 }}>{alert.title}</div><div style={{ fontSize: '12px', opacity: 0.92, marginTop: '4px' }}>{alert.description}</div></div>)}</div>}
      </WorkspaceSection>
      <WorkspaceSection title="Project Hubs">
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Account: {workspace.accountName || '—'} · Owner: {workspace.managerName || '—'} · Baselines: {executionBaselines.length} · Procurement lines: {procurementLines.length} · Milestones: {milestones.length} · Mốc pending: {pendingMilestones.length}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={S.btnOutline} onClick={() => goToRoute('Sales', { projectId }, 'Project', projectId)}>Mở Sales</button>
      <button style={S.btnOutline} onClick={() => setTab('pricing')}>Mở Pricing</button>
            <button style={S.btnOutline} onClick={() => goToRoute('Tasks', { projectId }, 'Project', projectId)}>Mở Tasks</button>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );
}

export function QuotationTab({ quotationVersions }: any) {
  return <WorkspaceSection title="Quotation Versions">{quotationVersions.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có báo giá trong project.</div> : <div style={{ display: 'grid', gap: '10px' }}>{quotationVersions.map((q: any) => <div key={q.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{q.quoteNumber || q.id} {q.revisionLabel ? `· ${q.revisionLabel}` : ''}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{q.subject || 'Không có tiêu đề'} · {formatDateValue(q.quoteDate)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{q.isWinningVersion ? <span style={ui.badge.success}>Winning</span> : null}<span style={ui.badge.neutral}>{q.status || 'draft'}</span></div></div></div>)}</div>}</WorkspaceSection>;
}

export function QbuRoundsTab({ qbuRounds }: any) {
  return <WorkspaceSection title="QBU Rounds">{qbuRounds.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có vòng QBU nào trong project.</div> : <div style={{ display: 'grid', gap: '10px' }}>{qbuRounds.map((round: any) => <div key={round.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Batch {round.batchNo || '—'} · {round.quoteNumber || round.revisionLabel || round.id}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{round.subject || 'Không có tiêu đề'} · Quote date {formatDateValue(round.quoteDate)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><span style={ui.badge.info}>{round.qbuType || 'QBU'}</span><span style={ui.badge.neutral}>{round.qbuWorkflowStage || round.status || 'draft'}</span></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Submitted</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatDateValue(round.qbuSubmittedAt)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Completed</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatDateValue(round.qbuCompletedAt)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Line Items</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{numberValue(round.lineItemCount)}</div></div><div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Amount</div><div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatMoneyValue(round.totalAmount, round.currency || 'VND')}</div></div></div></div>)}</div>}</WorkspaceSection>;
}

export function PricingTab({ projectId, token, workspace, onChanged, canEditPricing = false }: any) {
  return (
    <WorkspaceSection title="Project Pricing">
      <Pricing
        token={token}
        projectId={projectId}
        projectContext={workspace}
        embedded
        onChanged={onChanged}
        readOnly={!canEditPricing}
      />
    </WorkspaceSection>
  );
}

export function ContractTab(props: any) {
  const { workspace, currentBaseline, contractAppendices, executionBaselines, setContractEditor, setAppendixEditor, canEditCommercial = false } = props;
  return <div style={{ display: 'grid', gap: '18px' }}>
    <WorkspaceSection title="Main Contract" action={canEditCommercial && !workspace.mainContract ? <button style={S.btnPrimary} onClick={() => setContractEditor({ contractNumber: '', title: '', signedDate: '', effectiveDate: '', status: 'signed', currency: 'VND', totalValue: 0, summary: '', lineItems: currentBaseline?.lineItems?.length ? currentBaseline.lineItems : [emptyContractLine()] })}>Tạo hợp đồng chính</button> : null}>
      {!workspace.mainContract ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có hợp đồng chính.</div> : <div style={{ display: 'grid', gap: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{workspace.mainContract.contractNumber || workspace.mainContract.title || 'Main Contract'}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Ký {formatDateValue(workspace.mainContract.signedDate)} · Hiệu lực {formatDateValue(workspace.mainContract.effectiveDate)} · {formatMoneyValue(workspace.mainContract.totalValue, workspace.mainContract.currency || 'VND')}</div></div>{canEditCommercial ? <button style={S.btnOutline} onClick={() => setContractEditor({ ...workspace.mainContract, lineItems: ensureArray(workspace.mainContract.lineItems).length ? workspace.mainContract.lineItems : [emptyContractLine()] })}>Cập nhật hợp đồng</button> : null}</div>{ensureArray(workspace.mainContract.lineItems).map((line: any, index: number) => <div key={`${line.sourceLineKey || line.itemCode || 'line'}-${index}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Qty {line.contractQty || 0} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div></div>)}</div>}
    </WorkspaceSection>
    <WorkspaceSection title="Contract Appendices" action={canEditCommercial && workspace.mainContract ? <button style={S.btnPrimary} onClick={() => setAppendixEditor({ appendixNumber: '', title: '', signedDate: '', effectiveDate: '', status: 'effective', totalDeltaValue: 0, summary: '', lineItems: currentBaseline?.lineItems?.length ? currentBaseline.lineItems : ensureArray(workspace.mainContract.lineItems).length ? workspace.mainContract.lineItems : [emptyContractLine()] })}>Tạo phụ lục</button> : null}>
      {contractAppendices.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có phụ lục nào.</div> : <div style={{ display: 'grid', gap: '10px' }}>{contractAppendices.map((appendix: any) => <div key={appendix.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{appendix.appendixNumber || appendix.title || appendix.id}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Ký {formatDateValue(appendix.signedDate)} · Hiệu lực {formatDateValue(appendix.effectiveDate)} · {appendix.status || 'effective'}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}><span style={ui.badge.info}>{formatMoneyValue(appendix.totalDeltaValue, workspace.mainContract?.currency || 'VND')}</span>{canEditCommercial ? <button style={S.btnOutline} onClick={() => setAppendixEditor({ ...appendix, lineItems: ensureArray(appendix.lineItems).length ? appendix.lineItems : [emptyContractLine()] })}>Cập nhật</button> : null}</div></div></div>)}</div>}
    </WorkspaceSection>
    <WorkspaceSection title="Execution Baselines">{executionBaselines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có baseline thực thi.</div> : <div style={{ display: 'grid', gap: '10px' }}>{executionBaselines.map((baseline: any) => <div key={baseline.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Baseline v{baseline.baselineNo} · {baseline.title || baseline.sourceType}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{baseline.sourceType} · Hiệu lực {formatDateValue(baseline.effectiveDate)} · {baseline.lineItems?.length || 0} line(s)</div></div>{baseline.isCurrent ? <span style={ui.badge.success}>Current</span> : <span style={ui.badge.neutral}>History</span>}</div></div>)}</div>}</WorkspaceSection>
  </div>;
}

export function ProcurementTab(props: any) {
  const { activeProcurementLines, historyProcurementLines, unorderedLines, shortageLines, overdueEtaLines, overdueDeliveryLines, setProcurementEditor, openInboundFromProcurement, openDeliveryFromProcurement, canEditProcurement = false } = props;
  return <div style={{ display: 'grid', gap: '18px' }}>
    <WorkspaceSection title="Procurement Active Baseline">{activeProcurementLines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Baseline hiện hành chưa có procurement line active.</div> : <div style={{ display: 'grid', gap: '12px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
      <KpiCard label="Chưa đặt đủ" value={unorderedLines.length} accent={tokens.colors.primary} />
      <KpiCard label="Thiếu hàng" value={shortageLines.length} accent={tokens.colors.error} />
      <KpiCard label="Quá ETA" value={overdueEtaLines.length} accent={tokens.colors.warning} />
      <KpiCard label="Quá giao hàng" value={overdueDeliveryLines.length} accent={tokens.colors.warning} />
    </div>
    <div style={{ display: 'grid', gap: '10px' }}>{activeProcurementLines.map((line: any) => {
      const delayedEta = isPastDate(line.etaDate) && numberValue(line.receivedQty) < Math.max(numberValue(line.orderedQty), numberValue(line.contractQty));
      const delayedDelivery = isPastDate(line.committedDeliveryDate) && numberValue(line.deliveredQty) < numberValue(line.contractQty);
      return <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '12px', background: (delayedEta || delayedDelivery || numberValue(line.shortageQty) > 0) ? '#fffaf0' : tokens.colors.surface }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>NCC {line.supplierName || '—'} · PO {line.poNumber || '—'} · ETA {formatDateValue(line.etaDate)} · Giao {formatDateValue(line.committedDeliveryDate)}</div>
            {line.note ? <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '4px' }}>{line.note}</div> : null}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={ui.badge.info}>{line.status || 'planned'}</span>
            <span style={shortageBadgeStyle(line.shortageStatus)}>{line.shortageStatus || 'pending'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Contract</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{numberValue(line.contractQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Ordered</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.primary }}>{numberValue(line.orderedQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Received</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.info }}>{numberValue(line.receivedQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Delivered</div><div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.success }}>{numberValue(line.deliveredQty)}</div></div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '10px 12px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Thiếu</div><div style={{ fontSize: '18px', fontWeight: 800, color: numberValue(line.shortageQty) > 0 ? tokens.colors.error : tokens.colors.success }}>{numberValue(line.shortageQty)}</div></div>
        </div>
        {(delayedEta || delayedDelivery || numberValue(line.shortageQty) > 0) ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {delayedEta ? <span style={{ ...alertToneStyle('warning'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Quá ETA</span> : null}
          {delayedDelivery ? <span style={{ ...alertToneStyle('warning'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Quá cam kết giao</span> : null}
          {numberValue(line.shortageQty) > 0 ? <span style={{ ...alertToneStyle('danger'), borderRadius: tokens.radius.md, padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>Thiếu {numberValue(line.shortageQty)}</span> : null}
        </div> : null}
        {canEditProcurement ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={S.btnOutline} onClick={() => setProcurementEditor(line)}>Cập nhật line</button>
          <button style={S.btnOutline} onClick={() => openInboundFromProcurement(line)}>Ghi nhận inbound</button>
          <button style={S.btnOutline} onClick={() => openDeliveryFromProcurement(line)}>Ghi nhận delivery</button>
        </div> : null}
      </div>;
    })}</div>
  </div>}</WorkspaceSection>
  <WorkspaceSection title="Procurement History">
    {historyProcurementLines.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có procurement history bị superseded.</div> : <div style={{ display: 'grid', gap: '10px' }}>{historyProcurementLines.map((line: any) => <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '10px', background: '#fafafa' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{line.itemCode || 'ITEM'} · {line.itemName || line.description}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Baseline {line.baselineId || '—'} · Superseded {formatDateValue(line.supersededAt)}</div></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><span style={ui.badge.neutral}>{line.status || 'history'}</span><span style={ui.badge.warning}>History</span></div></div><div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Contract {numberValue(line.contractQty)} · Ordered {numberValue(line.orderedQty)} · Received {numberValue(line.receivedQty)} · Delivered {numberValue(line.deliveredQty)}</div></div>)}</div>}
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
      title="Inbound Events"
      action={canEditDelivery ? <button style={S.btnPrimary} onClick={() => setInboundEditor({ procurementLineId: '', receivedQty: 0, etaDate: '', actualReceivedDate: '', status: 'partial', receiptRef: '', note: '' })}>Ghi nhận inbound</button> : null}
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
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
            Hiển thị {filteredLines.length}/{inboundLines.length} inbound event
          </div>
          {filteredLines.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có event phù hợp bộ lọc.</div>
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
                      {line.procurementIsActive === false ? <span style={ui.badge.warning}>History line</span> : null}
                      <span style={ui.badge.neutral}>{line.status || 'pending'}</span>
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
      title="Delivery Events"
      action={canEditDelivery ? <button style={S.btnPrimary} onClick={() => setDeliveryEditor({ procurementLineId: '', deliveredQty: 0, committedDate: '', actualDeliveryDate: '', status: 'partial', deliveryRef: '', note: '' })}>Ghi nhận delivery</button> : null}
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
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
            Hiển thị {filteredLines.length}/{deliveryLines.length} delivery event
          </div>
          {filteredLines.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có event phù hợp bộ lọc.</div>
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
                      {line.procurementIsActive === false ? <span style={ui.badge.warning}>History line</span> : null}
                      <span style={ui.badge.neutral}>{line.status || 'pending'}</span>
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

export function TimelineTab({ milestones, timeline, setMilestoneEditor, canEditTimeline = false }: any) {
  const [eventFilter, setEventFilter] = useState('all');
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLowerCase();

  const filteredTimeline = timeline.filter((event: any) => {
    const type = String(event.eventType || '').toLowerCase();
    const text = `${event.title || ''} ${event.description || ''} ${type}`.toLowerCase();
    const matchesType = eventFilter === 'all' || type.includes(eventFilter);
    const matchesSearch = !keyword || text.includes(keyword);
    return matchesType && matchesSearch;
  });

  return <div style={{ display: 'grid', gap: '18px' }}>
    <WorkspaceSection title="Milestones" action={canEditTimeline ? <button style={S.btnPrimary} onClick={() => setMilestoneEditor({ milestoneType: '', title: '', plannedDate: '', actualDate: '', status: 'pending', note: '' })}>Tạo milestone</button> : null}>{milestones.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có milestone nào.</div> : <div style={{ display: 'grid', gap: '10px' }}>{milestones.map((milestone: any) => <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}><div><div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{milestone.milestoneType || 'general'} · Kế hoạch {formatDateValue(milestone.plannedDate)} · Thực tế {formatDateValue(milestone.actualDate)}</div></div>{canEditTimeline ? <button style={S.btnOutline} onClick={() => setMilestoneEditor(milestone)}>Cập nhật</button> : null}</div></div>)}</div>}</WorkspaceSection>
    <WorkspaceSection title="Project Timeline">
      {timeline.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có timeline event nào.</div> : <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input style={S.input} value={search} placeholder="Tìm theo tiêu đề/mô tả event..." onInput={(e: any) => setSearch(e.target.value)} />
          <select style={S.input} value={eventFilter} onChange={(e: any) => setEventFilter(e.target.value)}>
            <option value="all">Tất cả event type</option>
            <option value="contract">contract</option>
            <option value="appendix">appendix</option>
            <option value="baseline">baseline</option>
            <option value="procurement">procurement</option>
            <option value="inbound">inbound</option>
            <option value="delivery">delivery</option>
            <option value="milestone">milestone</option>
          </select>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>
          Hiển thị {filteredTimeline.length}/{timeline.length} timeline event
        </div>
        {filteredTimeline.length === 0 ? <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có event phù hợp bộ lọc.</div> : <div style={{ display: 'grid', gap: '12px' }}>{filteredTimeline.map((event: any) => {
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
  </div>;
}

export function FinanceTab({ workspace, approvals, milestones, overdueDeliveryLines }: any) {
  const summary = buildFinanceWorkspaceSummary({ workspace, approvals, milestones, overdueDeliveryLines });

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Finance Cockpit">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="Finance approvals" value={summary.financeApprovals.length} accent={tokens.colors.primary} />
          <KpiCard label="Pending approvals" value={summary.pendingFinanceApprovals.length} accent={tokens.colors.warning} />
          <KpiCard label="Payment milestones" value={summary.pendingPaymentMilestones.length} accent={tokens.colors.info} />
          <KpiCard label="Missing finance docs" value={summary.missingFinanceDocuments.length} accent={tokens.colors.error} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Receivable & Delivery Risk">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Receivable risk items</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.textPrimary, marginTop: '8px' }}>{summary.receivableApprovals.length}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Các approval gắn với payment, invoice hoặc công nợ.</div>
          </div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Delivery risk</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.error, marginTop: '8px' }}>{summary.deliveryRiskCount}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Dòng giao hàng quá cam kết có thể ảnh hưởng invoice hoặc thu tiền.</div>
          </div>
          <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Finance docs approved</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.success, marginTop: '8px' }}>{summary.financeDocuments.length - summary.missingFinanceDocuments.length}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Bộ chứng từ tài chính đã sẵn sàng cho bước tiếp theo.</div>
          </div>
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Finance Approval Queue">
        {summary.financeApprovals.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có approval tài chính nào cho project này.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {summary.financeApprovals.map((approval: any) => (
              <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title || approval.requestType || approval.id}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{approval.note || approval.description || 'Chưa có ghi chú.'}</div>
                    <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '6px' }}>
                      Department {approval.department || 'Finance'} · Due {formatDateValue(approval.dueDate)}
                    </div>
                  </div>
                  <span style={String(approval.status || '').toLowerCase() === 'approved' ? ui.badge.success : String(approval.status || '').toLowerCase() === 'pending' ? ui.badge.warning : ui.badge.neutral}>
                    {approval.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Payment Milestones">
        {summary.paymentMilestones.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có milestone tài chính nào được khai báo trong project này.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {summary.paymentMilestones.map((milestone: any) => (
              <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title || milestone.id}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                      {milestone.milestoneType || 'payment'} · Planned {formatDateValue(milestone.plannedDate)} · Actual {formatDateValue(milestone.actualDate)}
                    </div>
                  </div>
                  <span style={String(milestone.status || '').toLowerCase() === 'completed' ? ui.badge.success : ui.badge.warning}>
                    {milestone.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}

export function LegalTab({ workspace, approvals, contractAppendices, setTab }: any) {
  const summary = buildLegalWorkspaceSummary({ workspace, approvals, contractAppendices });

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Legal Review" action={<button style={S.btnOutline} onClick={() => setTab('documents')}>Mở Documents</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KpiCard label="Legal approvals" value={summary.legalApprovals.length} accent={tokens.colors.primary} />
          <KpiCard label="Pending legal" value={summary.pendingLegalApprovals.length} accent={tokens.colors.warning} />
          <KpiCard label="Deviation items" value={summary.deviationApprovals.length} accent={tokens.colors.error} />
          <KpiCard label="Missing legal docs" value={summary.missingLegalDocuments.length} accent={tokens.colors.info} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Contracts & Deviations">
        <div style={{ display: 'grid', gap: '10px' }}>
          {workspace?.mainContract ? (
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{workspace.mainContract.contractNumber || workspace.mainContract.title || 'Main Contract'}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                Ký {formatDateValue(workspace.mainContract.signedDate)} · Hiệu lực {formatDateValue(workspace.mainContract.effectiveDate)} · {workspace.mainContract.status || 'draft'}
              </div>
            </div>
          ) : (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có hợp đồng chính.</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Signed appendices</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.success, marginTop: '8px' }}>{summary.signedAppendices.length}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Phụ lục đã có hiệu lực hoặc đã ký.</div>
            </div>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Legal docs tracked</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.colors.textPrimary, marginTop: '8px' }}>{summary.legalDocuments.length}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '6px' }}>Checklist hồ sơ pháp lý đang theo dõi trong project.</div>
            </div>
          </div>

          {summary.legalApprovals.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có approval legal nào.</div>
          ) : summary.legalApprovals.map((approval: any) => (
            <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title || approval.requestType || approval.id}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{approval.note || approval.description || 'Không có deviation note.'}</div>
                  <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '6px' }}>
                    Department {approval.department || 'Legal'} · Due {formatDateValue(approval.dueDate)}
                  </div>
                </div>
                <span style={String(approval.status || '').toLowerCase() === 'approved' ? ui.badge.success : String(approval.status || '').toLowerCase() === 'pending' ? ui.badge.warning : ui.badge.error}>
                  {approval.status || 'pending'}
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
      <WorkspaceSection title="Task Summary" action={<button style={S.btnPrimary} onClick={() => goToRoute('Tasks', { projectId }, 'Project', projectId)}>Mở Tasks</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KpiCard label="Total tasks" value={numberValue(workspace?.taskCount)} accent={tokens.colors.textPrimary} />
          <KpiCard label="Open tasks" value={numberValue(workspace?.openTaskCount)} accent={tokens.colors.primary} />
          <KpiCard label="Overdue tasks" value={numberValue(workspace?.overdueTaskCount)} accent={tokens.colors.error} />
          <KpiCard label="Milestones pending" value={pendingMilestones.length} accent={tokens.colors.warning} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Pending Milestones">
        {pendingMilestones.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không còn milestone pending.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {pendingMilestones.map((milestone: any) => (
              <div key={milestone.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{milestone.title}</div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                  {milestone.milestoneType || 'general'} · Planned {formatDateValue(milestone.plannedDate)} · Status {milestone.status || 'pending'}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}

export function DocumentsTab({ workspace }: any) {
  const summary = buildDocumentWorkspaceSummary({ workspace });
  const departments = Object.entries(summary.groupedByDepartment);

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <WorkspaceSection title="Document Checklist Cockpit">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <KpiCard label="All documents" value={summary.documents.length} accent={tokens.colors.textPrimary} />
          <KpiCard label="Missing / requested" value={summary.missingDocuments.length} accent={tokens.colors.error} />
          <KpiCard label="Approved" value={summary.approvedDocuments.length} accent={tokens.colors.success} />
          <KpiCard label="Departments" value={departments.length} accent={tokens.colors.info} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Department Coverage">
        {departments.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có department nào được ghi nhận trong checklist.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {departments.map(([department, metrics]) => (
              <div key={department} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{department}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <span style={ui.badge.neutral}>Total {metrics.total}</span>
                  <span style={metrics.missing > 0 ? ui.badge.error : ui.badge.success}>Missing {metrics.missing}</span>
                  <span style={ui.badge.info}>Approved {metrics.approved}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Project Documents">
      {summary.documents.length === 0 ? (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có document checklist nào trong project.</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {summary.documents.map((document: any) => (
            <div key={document.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{document.title || document.documentType || document.id}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                    {document.department || 'cross-functional'} · {document.ownerName || document.createdByName || 'No owner'}
                  </div>
                </div>
                <span style={String(document.status || '').toLowerCase() === 'missing' ? ui.badge.error : String(document.status || '').toLowerCase() === 'approved' ? ui.badge.success : ui.badge.warning}>
                  {document.status || 'pending'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '8px' }}>
                Required at {document.requiredAtStage || 'any stage'} · Received {formatDateValue(document.receivedAt)}
              </div>
              {document.note ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '8px' }}>{document.note}</div> : null}
            </div>
          ))}
        </div>
      )}
    </WorkspaceSection>
    </div>
  );
}


