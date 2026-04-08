import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { projectStageLabel } from '../ops/workflowOptions';
import type { buildWorkspaceHeroPlan } from './workspaceHeroActions';
import type { buildWorkspacePhaseReadiness } from './workspacePhaseReadiness';

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
};

export function WorkspaceHeroActionBar({
  plan,
  onRunAction,
}: {
  plan: ReturnType<typeof buildWorkspaceHeroPlan>;
  onRunAction: (action: string) => void;
}) {
  return (
    <div
      style={{
        ...ui.card.base,
        padding: '20px',
        display: 'grid',
        gap: '16px',
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.surface.heroGradient,
      }}
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>{plan.eyebrow}</div>
        <div style={{ fontSize: '22px', fontWeight: 900, color: tokens.colors.textPrimary }}>{plan.title}</div>
        <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '72ch' }}>{plan.description}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {plan.actions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onRunAction(item.action)}
            style={{
              ...ui.card.base,
              padding: '16px',
              display: 'grid',
              gap: '8px',
              textAlign: 'left',
              cursor: 'pointer',
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.colors.surface,
            }}
          >
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
    status === 'ready_to_create_sales_order'
      ? { label: 'Sẵn sàng tạo SO', style: ui.badge.info }
      : status === 'awaiting_release_approval'
        ? { label: 'Chờ duyệt release', style: ui.badge.warning }
        : status === 'ready_to_release'
          ? { label: 'Sẵn sàng release', style: ui.badge.success }
          : status === 'activated'
            ? { label: 'Handoff đã kích hoạt', style: ui.badge.success }
            : { label: 'Handoff bị chặn', style: ui.badge.error };
  const blockers = Array.isArray(handoffActivation.blockers) ? handoffActivation.blockers.filter(Boolean) : [];

  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '10px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Trạng thái handoff
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
            Một nguồn sự thật cho bước kế tiếp từ báo giá thắng sang execution.
          </div>
        </div>
        <span style={badge.style}>{badge.label}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>
        {handoffActivation.nextActionLabel || 'Rà trạng thái handoff'}
      </div>
      {blockers.length ? (
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
          {blockers[0]}
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowGatesSection({
  gateStates,
  actionAvailability,
  busy,
  onRequestCommercialApproval,
  onCreateSalesOrder,
  onReleaseSalesOrder,
  onRequestDeliveryCompletionApproval,
  onFinalizeDeliveryCompletion,
  onOpenApprovals,
}: any) {
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
        {gates.map((gate: any) => {
          const pendingApprovers = Array.isArray(gate.pendingApprovers) ? gate.pendingApprovers : [];
          const blockers = Array.isArray(gate.actionAvailability?.blockers) ? gate.actionAvailability.blockers : [];

          return (
            <div key={gate.gateType} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{gate.title}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                    {gate.pendingCount ? `${gate.pendingCount} người duyệt đang chờ` : 'Không có người duyệt nào đang chờ'}
                  </div>
                </div>
                <GateStatusBadge status={gate.status} />
              </div>
              {pendingApprovers.length ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pendingApprovers.map((approver: any) => (
                    <span key={`${gate.gateType}-${approver.approvalId}`} style={approver.actionAvailability?.canDecide ? ui.badge.success : ui.badge.info}>
                      {approver.approverName || approver.approverRole || 'Người duyệt đang chờ'}
                    </span>
                  ))}
                </div>
              ) : null}
              {blockers.length ? (
                <div style={{ display: 'grid', gap: '4px' }}>
                  {blockers.map((blocker: string, index: number) => (
                    <div key={`${gate.gateType}-blocker-${index}`} style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                      {blocker}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {gate.gateType === 'quotation_commercial' && actionAvailability?.quotation?.canRequestCommercialApproval ? (
                  <button type="button" onClick={onRequestCommercialApproval} style={S.btnPrimary} disabled={busy === 'request-commercial-approval'}>
                    {busy === 'request-commercial-approval' ? 'Đang tạo...' : 'Tạo phê duyệt thương mại'}
                  </button>
                ) : null}
                {gate.gateType === 'sales_order_release' && actionAvailability?.quotation?.canCreateSalesOrder ? (
                  <button type="button" onClick={onCreateSalesOrder} style={S.btnOutline} disabled={busy === 'create-sales-order'}>
                    {busy === 'create-sales-order' ? 'Đang tạo...' : 'Tạo sales order'}
                  </button>
                ) : null}
                {gate.gateType === 'sales_order_release' && actionAvailability?.salesOrder?.canReleaseLatest ? (
                  <button type="button" onClick={onReleaseSalesOrder} style={S.btnPrimary} disabled={busy === 'release-sales-order'}>
                    {busy === 'release-sales-order' ? 'Đang phát hành...' : 'Phát hành sales order'}
                  </button>
                ) : null}
                {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canRequestDeliveryCompletionApproval ? (
                  <button type="button" onClick={onRequestDeliveryCompletionApproval} style={S.btnOutline} disabled={busy === 'request-delivery-completion'}>
                    {busy === 'request-delivery-completion' ? 'Đang tạo...' : 'Tạo phê duyệt hoàn tất'}
                  </button>
                ) : null}
                {gate.gateType === 'delivery_completion' && actionAvailability?.project?.canFinalizeDeliveryCompletion ? (
                  <button type="button" onClick={onFinalizeDeliveryCompletion} style={S.btnPrimary} disabled={busy === 'finalize-delivery-completion'}>
                    {busy === 'finalize-delivery-completion' ? 'Đang hoàn tất...' : 'Chốt hoàn tất giao hàng'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PhaseControlSection({
  readiness,
  onRunAction,
}: {
  readiness: ReturnType<typeof buildWorkspacePhaseReadiness>;
  onRunAction: (action: string) => void;
}) {
  const resolvedStageLabel = projectStageLabel(readiness.stageLabel) || readiness.stageLabel;
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '16px', border: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content' }}>Kiểm soát giai đoạn</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>
            {resolvedStageLabel} {'->'} {readiness.nextStepLabel}
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7, maxWidth: '78ch' }}>
            {readiness.summary}
          </div>
        </div>
        <div style={{ minWidth: 0, width: '100%', maxWidth: '220px', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px 16px', background: tokens.colors.background }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Điểm sẵn sàng</div>
          <div style={{ marginTop: '8px', fontSize: '28px', fontWeight: 900, color: readiness.readinessTone === 'good' ? tokens.colors.success : readiness.readinessTone === 'warn' ? tokens.colors.warning : tokens.colors.error }}>
            {readiness.readinessScore}%
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {readiness.items.map((item) => (
          <div key={item.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.label}</div>
              <span style={item.status === 'ready' ? ui.badge.success : item.status === 'warning' ? ui.badge.warning : ui.badge.error}>
                {item.status === 'ready' ? 'sẵn sàng' : item.status === 'warning' ? 'cảnh báo' : 'bị chặn'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.detail}</div>
            {item.action ? (
              <button type="button" onClick={() => onRunAction(item.action as string)} style={{ ...S.btnOutline, justifyContent: 'flex-start', padding: '8px 10px' }}>
                Mở bề mặt liên quan
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {readiness.blockers.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Điểm nghẽn hiện tại
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {readiness.blockers.map((blocker) => (
              <div key={blocker.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: blocker.tone === 'danger' ? tokens.colors.badgeBgError : tokens.colors.warningTint }}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{blocker.title}</div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{blocker.detail}</div>
                </div>
                {blocker.action ? (
                  <button type="button" onClick={() => onRunAction(blocker.action as string)} style={{ ...S.btnOutline }}>
                    Xử lý ngay
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
