import { OverlayModal } from '../ui/OverlayModal';
import { projectStageLabel } from '../ops/workflowOptions';
import { QA_TEST_IDS } from '../testing/testIds';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
};

export function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

export function formatDateValue(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

export function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPastDate(value?: string | null) {
  const parsed = parseDateValue(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

export function numberValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function statusLabel(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'Đang chạy';
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'signed') return 'Đã ký';
  if (normalized === 'effective') return 'Hiệu lực';
  if (normalized === 'paused') return 'Tạm dừng';
  if (normalized === 'partial') return 'Một phần';
  if (normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'rejected') return 'Bị từ chối';
  if (normalized === 'pending') return 'Đang chờ';
  return status || 'Chưa cập nhật';
}

export function statusBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block',
  };
  switch (status) {
    case 'active': return { ...base, background: tokens.colors.infoAccentBg, color: tokens.colors.primary };
    case 'completed':
    case 'signed':
    case 'effective': return { ...base, ...ui.badge.success };
    case 'paused':
    case 'partial': return { ...base, ...ui.badge.warning };
    case 'cancelled':
    case 'rejected': return { ...base, ...ui.badge.error };
    default: return { ...base, ...ui.badge.neutral };
  }
}

export function projectStageBadgeStyle(stage?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block',
  };
  switch (stage) {
    case 'won': return { ...base, ...ui.badge.success };
    case 'lost': return { ...base, ...ui.badge.error };
    case 'delivery': return { ...base, background: tokens.colors.violetStrongBg, color: tokens.colors.violetStrongText };
    default: return { ...base, ...ui.badge.neutral };
  }
}

export function Modal({ title, children, onClose }: any) {
  return (
    <OverlayModal title={title} onClose={onClose} maxWidth="1180px" contentPadding="28px" closeButtonTestId={QA_TEST_IDS.workspace.close}>
      {children}
    </OverlayModal>
  );
}

export function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ ...ui.card.base, padding: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 900, color: accent }}>
        {value}
      </div>
    </div>
  );
}

export function WorkspaceHeroActionBar({ plan, onRunAction }: { plan: any; onRunAction: (action: string) => void }) {
  return (
    <div style={{ ...ui.card.base, padding: '20px', display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}`, background: tokens.surface.heroGradient }}>
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>{plan.eyebrow}</div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{plan.title}</div>
        <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '72ch' }}>{plan.description}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {plan.actions.map((item: any) => (
          <button key={item.id} type="button" onClick={() => onRunAction(item.action)} style={{ ...ui.card.base, padding: '16px', display: 'grid', gap: '8px', textAlign: 'left', cursor: 'pointer', border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}>
            <div>
              <span style={item.tone === 'primary' ? ui.badge.info : item.tone === 'secondary' ? ui.badge.warning : ui.badge.neutral}>
                {item.tone === 'primary' ? 'Ưu tiên chính' : item.tone === 'secondary' ? 'Bước kế tiếp' : 'Rà soát'}
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GateStatusBadge({ status }: { status?: string | null }) {
  const normalized = String(status || 'not_requested').toLowerCase();
  if (normalized === 'pending') return <span style={ui.badge.warning}>đang chờ</span>;
  if (normalized === 'approved') return <span style={ui.badge.success}>đã duyệt</span>;
  if (normalized === 'changes_requested') return <span style={ui.badge.info}>cần chỉnh sửa</span>;
  if (normalized === 'rejected') return <span style={ui.badge.error}>bị từ chối</span>;
  return <span style={ui.badge.neutral}>chưa yêu cầu</span>;
}

export function HandoffActivationPanel({ handoffActivation }: { handoffActivation?: any }) {
  if (!handoffActivation) return null;
  const status = String(handoffActivation.status || '').trim().toLowerCase();
  const badge =
    status === 'ready_to_create_sales_order' ? { label: 'Sẵn sàng tạo SO', style: ui.badge.info }
      : status === 'awaiting_release_approval' ? { label: 'Chờ duyệt release', style: ui.badge.warning }
        : status === 'ready_to_release' ? { label: 'Sẵn sàng release', style: ui.badge.success }
          : status === 'activated' ? { label: 'Handoff đã kích hoạt', style: ui.badge.success }
            : { label: 'Handoff bị chặn', style: ui.badge.error };
  const blockers = Array.isArray(handoffActivation.blockers) ? handoffActivation.blockers.filter(Boolean) : [];

  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '10px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trạng thái handoff</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Một nguồn sự thật cho bước kế tiếp từ báo giá thắng sang execution.</div>
        </div>
        <span style={badge.style}>{badge.label}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>{handoffActivation.nextActionLabel || 'Rà trạng thái handoff'}</div>
      {blockers.length ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{blockers[0]}</div> : null}
    </div>
  );
}

export function WorkflowGatesSection({ gateStates, actionAvailability, busy, onRequestCommercialApproval, onCreateSalesOrder, onReleaseSalesOrder, onRequestDeliveryCompletionApproval, onFinalizeDeliveryCompletion, onOpenApprovals }: any) {
  const gates = Array.isArray(gateStates) ? gateStates : [];
  if (!gates.length) return null;
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cổng quy trình</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>Hiển thị người duyệt đang chờ và các hành động mà backend hiện cho phép thực hiện.</div>
        </div>
        <button type="button" onClick={onOpenApprovals} style={S.btnOutline}>Mở phê duyệt</button>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {gates.map((gate: any) => (
          <div key={gate.gateType} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{gate.title}</div>
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>{gate.pendingCount ? `${gate.pendingCount} người duyệt đang chờ` : 'Không có người duyệt nào đang chờ'}</div>
              </div>
              <GateStatusBadge status={gate.status} />
            </div>
            {Array.isArray(gate.actionAvailability?.blockers) && gate.actionAvailability.blockers.length ? (
              <div style={{ display: 'grid', gap: '4px' }}>
                {gate.actionAvailability.blockers.map((blocker: string, index: number) => <div key={`${gate.gateType}-blocker-${index}`} style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{blocker}</div>)}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {gate.gateType === 'quotation_commercial' && actionAvailability?.quotation?.canRequestCommercialApproval ? <button type="button" onClick={onRequestCommercialApproval} style={S.btnPrimary} disabled={busy === 'request-commercial-approval'}>{busy === 'request-commercial-approval' ? 'Đang tạo...' : 'Tạo phê duyệt thương mại'}</button> : null}
              {gate.gateType === 'sales_order_release' && actionAvailability?.quotation?.canCreateSalesOrder ? <button type="button" onClick={onCreateSalesOrder} style={S.btnOutline} disabled={busy === 'create-sales-order'}>{busy === 'create-sales-order' ? 'Đang tạo...' : 'Tạo sales order'}</button> : null}
              {gate.gateType === 'sales_order_release' && actionAvailability?.salesOrder?.canReleaseLatest ? <button type="button" onClick={onReleaseSalesOrder} style={S.btnPrimary} disabled={busy === 'release-sales-order'}>{busy === 'release-sales-order' ? 'Đang phát hành...' : 'Phát hành sales order'}</button> : null}
              {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canRequestDeliveryCompletionApproval ? <button type="button" onClick={onRequestDeliveryCompletionApproval} style={S.btnOutline} disabled={busy === 'request-delivery-completion'}>{busy === 'request-delivery-completion' ? 'Đang tạo...' : 'Tạo phê duyệt hoàn tất'}</button> : null}
              {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canFinalizeDeliveryCompletion ? <button type="button" onClick={onFinalizeDeliveryCompletion} style={S.btnPrimary} disabled={busy === 'finalize-delivery-completion'}>{busy === 'finalize-delivery-completion' ? 'Đang hoàn tất...' : 'Chốt hoàn tất giao hàng'}</button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhaseControlSection({ readiness, onRunAction }: { readiness: any; onRunAction: (action: string) => void }) {
  const resolvedStageLabel = projectStageLabel(readiness.stageLabel) || readiness.stageLabel;
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>Kiểm soát giai đoạn</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>{resolvedStageLabel} {'->'} {readiness.nextStepLabel}</div>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '78ch' }}>{readiness.summary}</div>
        </div>
        <div style={{ minWidth: 0, width: '100%', maxWidth: '220px', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px 16px', background: tokens.colors.background }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Điểm sẵn sàng</div>
          <div style={{ marginTop: '8px', fontSize: '28px', fontWeight: 900, color: readiness.readinessTone === 'good' ? tokens.colors.success : readiness.readinessTone === 'warn' ? tokens.colors.warning : tokens.colors.error }}>{readiness.readinessScore}%</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {readiness.items.map((item: any) => (
          <div key={item.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</div>
              <span style={item.status === 'ready' ? ui.badge.success : item.status === 'warning' ? ui.badge.warning : ui.badge.error}>{item.status === 'ready' ? 'sẵn sàng' : item.status === 'warning' ? 'cảnh báo' : 'bị chặn'}</span>
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.detail}</div>
            {item.action ? <button type="button" onClick={() => onRunAction(item.action as string)} style={{ ...S.btnOutline, justifyContent: 'flex-start', padding: '8px 10px' }}>Mở bề mặt liên quan</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
