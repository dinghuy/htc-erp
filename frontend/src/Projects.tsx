import { lazy, Suspense } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from './config';
import { buildRoleProfile, type CurrentUser, fetchWithAuth } from './auth';
import { showNotify } from './Notification';
import { consumeNavContext, setNavContext } from './navContext';
import { buildSalesQuotationNavigation } from './shared/workflow/workflowNavigation';
import { projectStageLabel, projectStageValueOptions } from './ops/workflowOptions';
import { canPerformAction, type ProjectWorkspaceTabKey } from './shared/domain/contracts';
import { QA_TEST_IDS, projectCardTestId, projectDetailsButtonTestId, projectWorkspaceButtonTestId } from './testing/testIds';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { DetailField, DetailGrid, DetailModal, DetailSection } from './ui/details';
import { EntitySummaryCard, FilterToolbar, PageHero, PageSectionHeader, StatusChipRow } from './ui/patterns';
import { CompassIcon, EditIcon, EyeIcon, TrashIcon } from './ui/icons';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { SegmentedControl } from './ui/SegmentedControl';
import { buildProjectRoleView } from './projects/projectRoleViews';
const ProjectWorkspaceHubModal = lazy(async () => {
  const module = await import('./projects/ProjectWorkspaceHub');
  return { default: module.ProjectWorkspaceHubModal };
});

const API = API_BASE;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '8px' } as any,
};

type ProjectStatus = 'pending' | 'active' | 'completed' | 'paused' | 'cancelled';
type WorkflowAvailabilityTone = 'good' | 'warn' | 'bad' | 'info';

type ResolvedProjectActionAvailability = {
  nextActionLabel: string;
  nextActionHint: string;
  workspaceTab: ProjectWorkspaceTabKey;
  tone: WorkflowAvailabilityTone;
  blockers: string[];
};

type ProjectFormValue = {
  id?: string;
  code: string;
  name: string;
  description: string;
  managerId: string;
  accountId: string;
  projectStage: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Chưa bắt đầu',
  active: 'Đang thực hiện',
  completed: 'Hoàn thành',
  paused: 'Tạm dừng',
  cancelled: 'Hủy bỏ',
};

const STATUS_TABS: Array<{ key: 'all' | ProjectStatus; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chưa bắt đầu' },
  { key: 'active', label: 'Đang thực hiện' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'paused', label: 'Tạm dừng' },
  { key: 'cancelled', label: 'Hủy bỏ' },
];

function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

async function readApiPayload(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getApiMessage(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallback;
}

async function requestJsonWithAuth(token: string, url: string, options: RequestInit = {}, fallbackMessage = 'Không thể xử lý yêu cầu') {
  const res = await fetchWithAuth(token, url, options);
  const data = await readApiPayload(res);
  if (!res.ok) throw new Error(getApiMessage(data, fallbackMessage));
  return data;
}

function createEmptyProjectForm(): ProjectFormValue {
  return {
    code: '',
    name: '',
    description: '',
    managerId: '',
    accountId: '',
    projectStage: 'new',
    startDate: '',
    endDate: '',
    status: 'pending',
  };
}

function toProjectForm(project?: any): ProjectFormValue {
  if (!project) return createEmptyProjectForm();
  return {
    id: project.id,
    code: project.code || '',
    name: project.name || '',
    description: project.description || '',
    managerId: project.managerId || '',
    accountId: project.accountId || '',
    projectStage: project.projectStage || 'new',
    startDate: project.startDate ? String(project.startDate).slice(0, 10) : '',
    endDate: project.endDate ? String(project.endDate).slice(0, 10) : '',
    status: (project.status || 'pending') as ProjectStatus,
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

function toSafeCount(value: unknown) {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function statusBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block',
  };
  switch (status) {
    case 'active':
      return { ...base, background: tokens.colors.infoAccentBg, color: tokens.colors.primary };
    case 'completed':
      return { ...base, ...ui.badge.success };
    case 'paused':
      return { ...base, ...ui.badge.warning };
    case 'cancelled':
      return { ...base, ...ui.badge.error };
    default:
      return { ...base, ...ui.badge.neutral };
  }
}

function projectStageBadgeStyle(stage?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block',
  };
  switch (stage) {
    case 'won':
      return { ...base, ...ui.badge.success };
    case 'lost':
      return { ...base, ...ui.badge.error };
    case 'delivery':
      return { ...base, background: tokens.colors.violetStrongBg, color: tokens.colors.violetStrongText };
    default:
      return { ...base, ...ui.badge.info };
  }
}

function workflowGateLabel(gateType?: string) {
  switch (String(gateType || '').trim().toLowerCase()) {
    case 'quotation_commercial':
      return 'Thương mại';
    case 'sales_order_release':
      return 'Phát hành SO';
    case 'procurement_commitment':
      return 'Mua hàng';
    case 'delivery_release':
      return 'Phát hành giao hàng';
    case 'delivery_completion':
      return 'Hoàn tất giao hàng';
    default:
      return 'Quy trình';
  }
}

function resolveProjectWorkspaceTab(project: any): ProjectWorkspaceTabKey {
  if (toSafeCount(project?.missingDocumentCount) > 0) return 'documents';
  if (toSafeCount(project?.overdueTaskCount) > 0) return 'timeline';

  const stage = String(project?.projectStage || '').trim().toLowerCase();
  const latestQuotationStatus = String(project?.latestQuotationStatus || '').trim().toLowerCase();

  if (['draft', 'submitted_for_approval', 'revision_required', 'approved', 'won', 'rejected', 'lost'].includes(latestQuotationStatus)) {
    return 'commercial';
  }
  if (['order_released', 'procurement_active'].includes(stage)) return 'procurement';
  if (['delivery_active', 'delivery', 'delivery_completed', 'closed'].includes(stage)) return 'delivery';
  if (['new', 'quoting', 'negotiating', 'internal-review', 'commercial_approved', 'won', 'lost'].includes(stage)) return 'commercial';
  return 'overview';
}

function resolveProjectActionAvailability(project: any): ResolvedProjectActionAvailability {
  const workspaceTab = resolveProjectWorkspaceTab(project);
  const quotationAvailability = project?.actionAvailability?.quotation;
  const salesOrderAvailability = project?.actionAvailability?.salesOrder;
  const projectAvailability = project?.actionAvailability?.project;
  const blockers = [
    ...(Array.isArray(salesOrderAvailability?.blockers) ? salesOrderAvailability.blockers : []),
    ...(Array.isArray(projectAvailability?.blockers) ? projectAvailability.blockers : []),
  ].filter(Boolean);

  if (quotationAvailability?.canRequestCommercialApproval) {
    return {
      nextActionLabel: 'Gửi approval thương mại',
      nextActionHint: 'Báo giá đã sẵn sàng để vào làn phê duyệt thương mại.',
      workspaceTab: 'commercial',
      tone: 'warn',
      blockers,
    };
  }
  if (quotationAvailability?.canCreateSalesOrder) {
    return {
      nextActionLabel: 'Tạo sales order',
      nextActionHint: 'Báo giá đã được duyệt/chốt và đủ điều kiện bàn giao sang sales order.',
      workspaceTab: 'commercial',
      tone: 'good',
      blockers,
    };
  }
  if (salesOrderAvailability?.canReleaseLatest) {
    return {
      nextActionLabel: 'Phát hành sales order',
      nextActionHint: 'Sales order mới nhất đã sẵn sàng để chuyển sang triển khai.',
      workspaceTab: 'commercial',
      tone: 'warn',
      blockers,
    };
  }
  if (projectAvailability?.canRecordLogistics) {
    return {
      nextActionLabel: 'Ghi nhận logistics',
      nextActionHint: 'Sales order đã phát hành, có thể bắt đầu inbound và chuẩn bị giao hàng.',
      workspaceTab: 'delivery',
      tone: 'info',
      blockers,
    };
  }
  if (projectAvailability?.canRequestDeliveryCompletionApproval) {
    return {
      nextActionLabel: 'Yêu cầu duyệt hoàn tất giao hàng',
      nextActionHint: 'Giao hàng đang gần xong; bước tiếp theo là approval hoàn tất giao hàng.',
      workspaceTab: 'delivery',
      tone: 'warn',
      blockers,
    };
  }
  if (projectAvailability?.canFinalizeDeliveryCompletion) {
    return {
      nextActionLabel: 'Chốt hoàn tất giao hàng',
      nextActionHint: 'Approval hoàn tất giao hàng đã sẵn sàng để finalize.',
      workspaceTab: 'delivery',
      tone: 'good',
      blockers,
    };
  }
  if (blockers.length > 0) {
    return {
      nextActionLabel: 'Gỡ chặn quy trình',
      nextActionHint: blockers[0],
      workspaceTab,
      tone: 'bad',
      blockers,
    };
  }

  const pendingApprovals = toSafeCount(project?.pendingApprovalCount);
  const missingDocuments = toSafeCount(project?.missingDocumentCount);
  const overdueTasks = toSafeCount(project?.overdueTaskCount);
  const openTasks = toSafeCount(project?.openTaskCount);
  const latestQuotationStatus = String(project?.latestQuotationStatus || '').trim().toLowerCase();
  const projectStage = String(project?.projectStage || '').trim().toLowerCase();
  const derivedBlockers = [
    pendingApprovals > 0 ? `${pendingApprovals} phê duyệt đang chờ` : '',
    missingDocuments > 0 ? `${missingDocuments} hồ sơ còn thiếu` : '',
    overdueTasks > 0 ? `${overdueTasks} công việc bị trễ` : '',
  ].filter(Boolean);

  if (pendingApprovals > 0) {
    return {
      nextActionLabel: 'Dọn hàng đợi phê duyệt',
      nextActionHint: `${pendingApprovals} phê duyệt đang chặn bước kế tiếp của dự án.`,
      workspaceTab,
      tone: 'warn',
      blockers: derivedBlockers,
    };
  }
  if (missingDocuments > 0) {
    return {
      nextActionLabel: 'Bổ sung hồ sơ',
      nextActionHint: `${missingDocuments} tài liệu còn thiếu trước khi tiếp tục bàn giao hoặc triển khai.`,
      workspaceTab: 'documents',
      tone: 'bad',
      blockers: derivedBlockers,
    };
  }
  if (overdueTasks > 0) {
    return {
      nextActionLabel: 'Kéo lại timeline',
      nextActionHint: `${overdueTasks} công việc quá hạn đang kéo chậm mức sẵn sàng hoặc giao hàng.`,
      workspaceTab: 'timeline',
      tone: 'bad',
      blockers: derivedBlockers,
    };
  }
  if (latestQuotationStatus === 'draft' || latestQuotationStatus === 'revision_required') {
    return {
      nextActionLabel: 'Hoàn thiện quotation',
      nextActionHint: 'Báo giá mới nhất vẫn còn ở draft/revision state.',
      workspaceTab: 'commercial',
      tone: latestQuotationStatus === 'revision_required' ? 'warn' : 'info',
      blockers: derivedBlockers,
    };
  }
  if (latestQuotationStatus === 'submitted_for_approval') {
    return {
      nextActionLabel: 'Theo dõi approval thương mại',
      nextActionHint: 'Báo giá mới nhất đang nằm trong làn phê duyệt.',
      workspaceTab: 'commercial',
      tone: 'warn',
      blockers: derivedBlockers,
    };
  }
  if (latestQuotationStatus === 'approved' || latestQuotationStatus === 'won') {
    return {
      nextActionLabel: 'Tiếp tục bàn giao sales order',
      nextActionHint: 'Báo giá đã được duyệt/chốt; bước kế tiếp là sales order và mức sẵn sàng phát hành.',
      workspaceTab: 'commercial',
      tone: 'good',
      blockers: derivedBlockers,
    };
  }
  if (['order_released', 'procurement_active'].includes(projectStage)) {
    return {
      nextActionLabel: 'Đẩy procurement',
      nextActionHint: 'Dự án đã rời cổng thương mại và cần bám tiếp từ mua hàng hoặc inbound.',
      workspaceTab: 'procurement',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }
  if (['delivery_active', 'delivery'].includes(projectStage)) {
    return {
      nextActionLabel: 'Theo dõi giao hàng',
      nextActionHint: 'Dự án đang ở pha giao hàng; logistics và mức sẵn sàng hoàn tất là trọng tâm.',
      workspaceTab: 'delivery',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }
  if (['delivery_completed', 'closed'].includes(projectStage) || String(project?.status || '').trim().toLowerCase() === 'completed') {
    return {
      nextActionLabel: 'Rà trạng thái hoàn tất',
      nextActionHint: 'Dự án đã ở giai đoạn cuối, cần kiểm tra hoàn tất và đóng vòng.',
      workspaceTab: 'overview',
      tone: 'good',
      blockers: derivedBlockers,
    };
  }
  if (openTasks > 0) {
    return {
      nextActionLabel: 'Xử lý task mở',
      nextActionHint: `${openTasks} công việc còn mở trong không gian hiện tại.`,
      workspaceTab: 'tasks',
      tone: 'info',
      blockers: derivedBlockers,
    };
  }

  return {
    nextActionLabel: 'Mở không gian dự án',
      nextActionHint: 'Dự án chưa có điểm nghẽn nổi bật; rà bước kế tiếp trong không gian làm việc.',
    workspaceTab,
    tone: 'info',
    blockers: derivedBlockers,
  };
}

function resolveAccountLabel(account: any) {
  return account?.companyName || account?.name || account?.shortName || '';
}

function resolveUserLabel(user: any) {
  return user?.fullName || user?.username || user?.email || '';
}

function computeProgress(project: any) {
  const totalTasks = Number(project?.taskCount || 0);
  if (totalTasks > 0) {
    const openTasks = Number(project?.openTaskCount || 0);
    return Math.max(0, Math.min(100, Math.round(((totalTasks - openTasks) / totalTasks) * 100)));
  }
  if (project?.status === 'completed') return 100;
  if (project?.status === 'active') return 55;
  if (project?.status === 'paused') return 35;
  return 0;
}

function ProgressBar({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>Tiến độ</span>
        <span style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>{normalized}%</span>
      </div>
      <div style={{ height: '9px', borderRadius: '999px', background: tokens.colors.background, overflow: 'hidden' }}>
        <div style={{ width: `${normalized}%`, height: '100%', background: tokens.colors.primary, borderRadius: '999px', transition: 'width 0.25s ease' }} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={ui.card.kpi as any}>
      <div style={{ fontSize: '28px', fontWeight: 900, color: accent || tokens.colors.textPrimary }}>{value}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textSecondary }}>{label}</div>
    </div>
  );
}

function ProjectEditorModal({
  title,
  token,
  users,
  accounts,
  initialValue,
  onClose,
  onSaved,
}: {
  title: string;
  token: string;
  users: any[];
  accounts: any[];
  initialValue?: any;
  onClose: () => void;
  onSaved: (project: any) => void;
}) {
  const [form, setForm] = useState<ProjectFormValue>(() => toProjectForm(initialValue));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) {
      showNotify('Thiếu tên dự án', 'error');
      return;
    }
    setSaving(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `${API}/projects/${form.id}` : `${API}/projects`;
      const saved = await requestJsonWithAuth(token, url, { method, body: JSON.stringify(form) }, 'Không thể lưu dự án');
      showNotify(form.id ? 'Đã cập nhật dự án' : 'Đã tạo dự án thủ công', 'success');
      onSaved(saved);
      onClose();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu dự án', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailModal
      open
      title={title}
      subtitle="Flow này dùng cho trường hợp tạo shell dự án thủ công ngoài luồng quotation-to-project chuẩn."
      onClose={onClose}
      width="min(760px, calc(100vw - 24px))"
      actions={<button type="button" onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu dự án'}</button>}
    >
      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={S.label}>Mã dự án</label>
            <input style={S.input} value={form.code} onInput={(e: any) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Tên dự án *</label>
            <input style={S.input} value={form.name} onInput={(e: any) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
        </div>

        <div>
          <label style={S.label}>Mô tả</label>
          <textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={form.description} onInput={(e: any) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={S.label}>Khách hàng / Account</label>
            <select style={S.input} value={form.accountId} onChange={(e: any) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}>
              <option value="">-- Chọn account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{resolveAccountLabel(account)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Người phụ trách dự án</label>
            <select style={S.input} value={form.managerId} onChange={(e: any) => setForm((prev) => ({ ...prev, managerId: e.target.value }))}>
              <option value="">-- Chọn người phụ trách --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{resolveUserLabel(user)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={S.label}>Giai đoạn</label>
            <select style={S.input} value={form.projectStage} onChange={(e: any) => setForm((prev) => ({ ...prev, projectStage: e.target.value }))}>
              {projectStageValueOptions().map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Trạng thái</label>
            <select style={S.input} value={form.status} onChange={(e: any) => setForm((prev) => ({ ...prev, status: e.target.value as ProjectStatus }))}>
              {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={S.label}>Ngày bắt đầu</label>
            <input type="date" style={S.input} value={form.startDate} onInput={(e: any) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Ngày kết thúc</label>
            <input type="date" style={S.input} value={form.endDate} onInput={(e: any) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
          </div>
        </div>
      </div>
    </DetailModal>
  );
}

function AddProjectModal(props: {
  token: string;
  users: any[];
  accounts: any[];
  onClose: () => void;
  onSaved: (project: any) => void;
}) {
  return <ProjectEditorModal title="Tạo dự án thủ công" {...props} />;
}

function EditProjectModal(props: {
  project: any;
  token: string;
  users: any[];
  accounts: any[];
  onClose: () => void;
  onSaved: (project: any) => void;
}) {
  return <ProjectEditorModal title="Cập nhật dự án" initialValue={props.project} token={props.token} users={props.users} accounts={props.accounts} onClose={props.onClose} onSaved={props.onSaved} />;
}

function ProjectDetailsModal({
  project,
  open,
  canEditProject,
  onClose,
  onEdit,
  onOpenWorkspace,
  onNavigate,
}: {
  project: any;
  open: boolean;
  canEditProject: boolean;
  onClose: () => void;
  onEdit: () => void;
  onOpenWorkspace: () => void;
  onNavigate?: (route: string) => void;
}) {
  if (!project) return null;

  const latestQuotationAction = project?.latestQuotationId && onNavigate
    ? () => {
        const target = buildSalesQuotationNavigation(project.latestQuotationId);
        if (!target) return;
        setNavContext(target.navContext);
        onClose();
        onNavigate(target.route);
      }
    : null;

  return (
    <DetailModal
      open={open}
      title={project.name || 'Chi tiết dự án'}
      subtitle={project.code ? `Mã dự án: ${project.code}` : 'Thông tin tổng hợp của dự án và điểm vào workspace hợp đồng.'}
      onClose={onClose}
      actions={(
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {latestQuotationAction ? <button type="button" onClick={latestQuotationAction} style={S.btnOutline}>Mở báo giá</button> : null}
          {canEditProject ? <button type="button" onClick={onEdit} style={S.btnOutline}>Sửa</button> : null}
          <button type="button" onClick={onOpenWorkspace} style={S.btnPrimary}>Mở workspace</button>
        </div>
      )}
    >
      <div style={{ display: 'grid', gap: '16px' }}>
        <DetailSection title="Tổng quan" tone="soft">
          <DetailGrid>
            <DetailField label="Trạng thái" value={<span style={statusBadgeStyle(project.status)}>{STATUS_LABELS[(project.status || 'pending') as ProjectStatus] || project.status || '—'}</span>} />
            <DetailField label="Giai đoạn" value={<span style={projectStageBadgeStyle(project.projectStage)}>{projectStageLabel(project.projectStage) || '—'}</span>} />
            <DetailField label="Khách hàng" value={project.accountName || '—'} />
            <DetailField label="Người phụ trách" value={project.managerName || '—'} />
            <DetailField label="Ngày bắt đầu" value={formatDate(project.startDate)} />
            <DetailField label="Ngày kết thúc" value={formatDate(project.endDate)} />
            <DetailField label="Tiến độ" value={<ProgressBar value={computeProgress(project)} />} wide />
            <DetailField label="Mô tả" value={project.description || '—'} wide />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Liên kết nghiệp vụ">
          <DetailGrid>
            <DetailField label="Tổng task" value={Number(project.taskCount || 0).toLocaleString('vi-VN')} />
            <DetailField label="Task đang mở" value={Number(project.openTaskCount || 0).toLocaleString('vi-VN')} />
            <DetailField label="Task quá hạn" value={Number(project.overdueTaskCount || 0).toLocaleString('vi-VN')} />
            <DetailField label="Số báo giá" value={Number(project.quotationCount || 0).toLocaleString('vi-VN')} />
            <DetailField label="Báo giá NCC" value={Number(project.supplierQuoteCount || 0).toLocaleString('vi-VN')} />
            <DetailField label="Báo giá gần nhất" value={project.latestQuotationNumber || project.latestQuotationId || '—'} />
            <DetailField label="Trạng thái báo giá gần nhất" value={project.latestQuotationStatus || '—'} />
          </DetailGrid>
        </DetailSection>
      </div>
    </DetailModal>
  );
}

export function Projects({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [stageFilter, setStageFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editProject, setEditProject] = useState<any | null>(null);
  const [detailProject, setDetailProject] = useState<any | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<ProjectWorkspaceTabKey | undefined>(undefined);
  const [workspaceFocusDocumentId, setWorkspaceFocusDocumentId] = useState<string | undefined>(undefined);
  const [workspaceOpenThread, setWorkspaceOpenThread] = useState(false);
  const roleProfile = useMemo(() => buildRoleProfile(currentUser.roleCodes, currentUser.systemRole), [currentUser.roleCodes, currentUser.systemRole]);
  const canManageProjectShell = canPerformAction(currentUser.roleCodes, 'edit_project_shell', currentUser.systemRole);
  const canDeleteProject = canPerformAction(currentUser.roleCodes, 'edit_project_shell', currentUser.systemRole)
    && currentUser.roleCodes?.includes('admin');

  const openProjectWorkspace = (project: any, fallbackTab?: ProjectWorkspaceTabKey) => {
    setWorkspaceProjectId(project.id);
    setWorkspaceInitialTab(fallbackTab || resolveProjectActionAvailability(project).workspaceTab);
    setWorkspaceFocusDocumentId(undefined);
    setWorkspaceOpenThread(false);
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [projectsData, usersData, accountsData] = await Promise.all([
        requestJsonWithAuth(currentUser.token, `${API}/projects`, {}, 'Không thể tải danh sách dự án'),
        requestJsonWithAuth(currentUser.token, `${API}/users/directory`, {}, 'Không thể tải danh sách người dùng'),
        requestJsonWithAuth(currentUser.token, `${API}/accounts`, {}, 'Không thể tải danh sách account'),
      ]);
      const normalizedProjects = ensureArray(projectsData);
      setProjects(normalizedProjects);
      setUsers(ensureArray(usersData));
      setAccounts(ensureArray(accountsData));

      const navCtx = consumeNavContext('Projects');
      if (navCtx) {
        if (navCtx.filters?.projectStage) setStageFilter(navCtx.filters.projectStage);
        if (navCtx.filters?.accountId) setAccountFilter(navCtx.filters.accountId);
        if (typeof navCtx.filters?.overdue === 'boolean') setOverdueOnly(navCtx.filters.overdue);
        if (navCtx.filters?.workspaceTab) setWorkspaceInitialTab(navCtx.filters.workspaceTab as ProjectWorkspaceTabKey);
        if (navCtx.filters?.documentId) setWorkspaceFocusDocumentId(navCtx.filters.documentId);
        setWorkspaceOpenThread(Boolean(navCtx.filters?.openThread));
        if (navCtx.filters?.status && STATUS_TABS.some((tab) => tab.key === navCtx.filters?.status)) {
          setStatusFilter(navCtx.filters.status as 'all' | ProjectStatus);
        }
        if (navCtx.entityType === 'Project' && navCtx.entityId) {
          const matched = normalizedProjects.find((project: any) => project.id === navCtx.entityId);
          if (matched) {
            if (navCtx.autoOpenEdit && canManageProjectShell) {
              setEditProject(matched);
            } else {
              if (navCtx.autoOpenEdit && !canManageProjectShell) {
                showNotify('Bạn không có quyền mở editor dự án, đang chuyển sang workspace read-only.', 'info');
              }
              openProjectWorkspace(matched, navCtx.filters?.workspaceTab as ProjectWorkspaceTabKey | undefined);
            }
          }
        } else if (navCtx.filters?.openRepresentative) {
          const matchingProject = normalizedProjects.find((project: any) => {
            if (navCtx.filters?.projectStage && project.projectStage !== navCtx.filters.projectStage) return false;
            if (navCtx.filters?.accountId && project.accountId !== navCtx.filters.accountId) return false;
            if (typeof navCtx.filters?.overdue === 'boolean' && navCtx.filters.overdue && Number(project.overdueTaskCount || 0) <= 0) return false;
            return true;
          });
          if (matchingProject?.id) {
            openProjectWorkspace(matchingProject, navCtx.filters?.workspaceTab as ProjectWorkspaceTabKey | undefined);
          } else {
            setWorkspaceInitialTab(undefined);
            showNotify('Không tìm thấy workspace mẫu phù hợp với role đang preview', 'error');
          }
        }
      }
    } catch (error: any) {
      setLoadError(error?.message || 'Không thể tải dữ liệu dự án');
      setProjects([]);
      setUsers([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const keyword = searchTerm.trim().toLowerCase();
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (stageFilter && project.projectStage !== stageFilter) return false;
      if (accountFilter && project.accountId !== accountFilter) return false;
      if (managerFilter && project.managerId !== managerFilter) return false;
      if (overdueOnly && Number(project.overdueTaskCount || 0) <= 0) return false;
      if (keyword) {
        const haystack = [project.name, project.code, project.description, project.accountName, project.managerName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [accountFilter, managerFilter, overdueOnly, projects, searchTerm, stageFilter, statusFilter]);

  const projectRoleView = useMemo(() => buildProjectRoleView(roleProfile.personaMode, projects), [projects, roleProfile.personaMode]);

  const applyFocusPreset = (presetId: string) => {
    const preset = projectRoleView.focusPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const next = preset.apply();
    setStatusFilter(next.statusFilter ?? 'all');
    setStageFilter(next.stageFilter ?? '');
    setOverdueOnly(Boolean(next.overdueOnly));
    setSearchTerm('');
    setAccountFilter('');
    setManagerFilter('');
  };

  const handleDelete = (project: any) => {
    if (!canDeleteProject) return;
    setConfirmState({
      message: `Xóa dự án "${project.name}"? Thao tác này không thể hoàn tác.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await requestJsonWithAuth(currentUser.token, `${API}/projects/${project.id}`, { method: 'DELETE' }, 'Không thể xóa dự án');
          showNotify('Đã xóa dự án', 'success');
          if (detailProject?.id === project.id) setDetailProject(null);
          if (editProject?.id === project.id) setEditProject(null);
          if (workspaceProjectId === project.id) {
            setWorkspaceProjectId(null);
            setWorkspaceInitialTab(undefined);
          }
          await loadData();
        } catch (error: any) {
          showNotify(error?.message || 'Không thể xóa dự án', 'error');
        }
      },
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStageFilter('');
    setAccountFilter('');
    setManagerFilter('');
    setOverdueOnly(false);
    setStatusFilter('all');
  };

  return (
    <div style={{ display: 'grid', gap: '20px', padding: isMobile ? '16px' : '20px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      <PageHero
        eyebrow="Cockpit dự án"
        title={projectRoleView.title}
        description={`${projectRoleView.subtitle} ${projectRoleView.note}`}
        actions={[
          ...(canManageProjectShell
            ? [{
                key: 'add-project',
                label: projectRoleView.createLabel,
                onClick: () => setShowAdd(true),
                variant: 'primary' as const,
              }]
            : []),
          {
            key: 'open-approvals',
            label: 'Mở phê duyệt',
            onClick: () => onNavigate?.('Approvals'),
            variant: 'outline' as const,
          },
          {
            key: 'open-reports',
            label: 'Xem báo cáo',
            onClick: () => onNavigate?.('Reports'),
            variant: 'ghost' as const,
          },
        ]}
      />

      <section style={{ ...S.card, padding: '18px', display: 'grid', gap: '16px', borderColor: tokens.colors.border }}>
        <PageSectionHeader
          title="Preset ưu tiên"
          description="Chọn nhanh một góc nhìn phù hợp vai trò để gom KPI và danh sách dự án vào đúng queue cần xử lý."
        />
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {projectRoleView.focusPresets.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyFocusPreset(preset.id)} style={S.btnOutline}>
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
        {projectRoleView.cards.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            accent={
              card.tone === 'good'
                ? tokens.colors.success
                : card.tone === 'warn'
                  ? tokens.colors.warning
                  : card.tone === 'bad'
                    ? tokens.colors.error
                    : tokens.colors.primary
            }
          />
        ))}
      </div>

      <section style={{ display: 'grid', gap: '12px' }}>
        <PageSectionHeader
          title="Thanh lọc dự án"
          description="Giữ một bộ lọc gọn để xác định trạng thái, giai đoạn, người phụ trách và hàng đợi ưu tiên trước khi đi vào từng dự án."
        />
        <SegmentedControl
          ariaLabel="Lọc trạng thái dự án"
          wrap
          options={STATUS_TABS.map((tab) => ({
            value: tab.key,
            label: tab.label,
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterToolbar
          controls={[
            {
              key: 'search',
              grow: true,
              node: (
                <input
                  style={S.input}
                  value={searchTerm}
                  onInput={(e: any) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên, mã, account, người phụ trách..."
                />
              ),
            },
            {
              key: 'stage',
              node: (
                <select style={S.input} value={stageFilter} onChange={(e: any) => setStageFilter(e.target.value)}>
                  <option value="">Tất cả stage dự án</option>
                  {projectStageValueOptions().map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ),
            },
            {
              key: 'account',
              node: (
                <select style={S.input} value={accountFilter} onChange={(e: any) => setAccountFilter(e.target.value)}>
                  <option value="">Tất cả account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{resolveAccountLabel(account)}</option>
                  ))}
                </select>
              ),
            },
            {
              key: 'manager',
              node: (
                <select style={S.input} value={managerFilter} onChange={(e: any) => setManagerFilter(e.target.value)}>
                  <option value="">Tất cả người phụ trách</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{resolveUserLabel(user)}</option>
                  ))}
                </select>
              ),
            },
            {
              key: 'overdue',
              node: (
                <button
                  type="button"
                  onClick={() => setOverdueOnly((prev) => !prev)}
                  style={{
                    ...(overdueOnly ? S.btnPrimary : S.btnOutline),
                    width: '100%',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Chỉ dự án có task trễ
                </button>
              ),
            },
            {
              key: 'reset',
              node: (
                <button type="button" onClick={resetFilters} style={{ ...S.btnOutline, width: '100%' }}>
                  Reset
                </button>
              ),
            },
          ]}
          summary={`Hiển thị ${filteredProjects.length}/${projects.length} dự án`}
        />
      </section>

      {loading ? (
        <div style={{ ...S.card, padding: '48px', textAlign: 'center', color: tokens.colors.textSecondary }}>Đang tải danh sách dự án...</div>
      ) : loadError ? (
        <div style={{ ...S.card, padding: '32px', display: 'grid', gap: '14px', color: tokens.colors.textPrimary }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{loadError}</div>
          <div>
            <button type="button" onClick={loadData} style={S.btnOutline}>Tải lại</button>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div style={{ ...S.card, padding: '48px', textAlign: 'center', color: tokens.colors.textSecondary }}>Không có dự án nào.</div>
      ) : (
        <div data-testid={QA_TEST_IDS.projects.list} style={{ display: 'grid', gap: '16px' }}>
          {filteredProjects.map((project) => {
            const progress = computeProgress(project);
            const workflowAction = resolveProjectActionAvailability(project);
            const pendingGates = ensureArray(project.approvalGateStates).filter((gate: any) => String(gate?.status || '').toLowerCase() === 'pending');
            const pendingApprovers = ensureArray(project.pendingApproverState);
            const statusItems = [
              {
                key: `${project.id}-status`,
                label: STATUS_LABELS[(project.status || 'pending') as ProjectStatus] || project.status || '—',
                tone: project.status === 'completed' ? 'good' as const : project.status === 'paused' ? 'warn' as const : project.status === 'cancelled' ? 'bad' as const : 'info' as const,
              },
              {
                key: `${project.id}-stage`,
                label: projectStageLabel(project.projectStage) || '—',
                tone: project.projectStage === 'won' ? 'good' as const : project.projectStage === 'lost' ? 'bad' as const : 'neutral' as const,
              },
            ];
            const supportItems = [
              {
                key: `${project.id}-approvals`,
                label: `${Number(project.pendingApprovalCount || 0)} phê duyệt`,
                tone: Number(project.pendingApprovalCount || 0) > 0 ? 'warn' as const : 'good' as const,
              },
              {
                key: `${project.id}-docs`,
                label: `${Number(project.missingDocumentCount || 0)} hồ sơ thiếu`,
                tone: Number(project.missingDocumentCount || 0) > 0 ? 'bad' as const : 'good' as const,
              },
              {
                key: `${project.id}-overdue`,
                label: `${Number(project.overdueTaskCount || 0)} công việc trễ`,
                tone: Number(project.overdueTaskCount || 0) > 0 ? 'bad' as const : 'info' as const,
              },
              ...pendingGates.slice(0, 1).map((gate: any, index: number) => ({
                key: `${project.id}-gate-${gate.gateType || 'pending'}-${index}`,
                label: `Cổng ${workflowGateLabel(gate.gateType)}`,
                tone: String(gate.status || '').toLowerCase() === 'pending' ? 'warn' as const : 'neutral' as const,
              })),
              ...pendingApprovers.slice(0, 1).map((approver: any, index: number) => ({
                key: `${project.id}-approver-${approver.approvalId || approver.approverRole || 'pending'}-${index}`,
                label: `Chờ ${approver.approverName || approver.approverRole || 'approver'}`,
                tone: 'neutral' as const,
              })),
            ].slice(0, 4);
            return (
              <div key={project.id} data-testid={projectCardTestId(project.id)}>
                <EntitySummaryCard
                  title={project.name}
                  subtitle={`${project.accountName || 'Chưa có account'} · ${project.code ? `#${project.code} · ` : ''}${project.managerName || 'Chưa gán người phụ trách'}`}
                  description={project.description || 'Chưa có mô tả dự án.'}
                  statusItems={statusItems}
                  meta={[
                    { key: 'account', label: 'Khách hàng', value: project.accountName || '—' },
                    { key: 'owner', label: 'Người phụ trách', value: project.managerName || '—' },
                    { key: 'timeline', label: 'Tiến độ thời gian', value: `${formatDate(project.startDate)} - ${formatDate(project.endDate)}` },
                    { key: 'volume', label: 'Công việc / Báo giá', value: `${Number(project.taskCount || 0).toLocaleString('vi-VN')} công việc / ${Number(project.quotationCount || 0).toLocaleString('vi-VN')} báo giá` },
                  ]}
                  primaryLabel={workflowAction.nextActionLabel}
                  primaryHint={workflowAction.nextActionHint}
                  footer={(
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <StatusChipRow items={supportItems} />
                      {workflowAction.blockers.length > 0 && workflowAction.blockers[0] !== workflowAction.nextActionHint ? (
                        <StatusChipRow
                          items={workflowAction.blockers.slice(0, 1).map((blocker, index) => ({
                            key: `${project.id}-blocker-${index}`,
                            label: blocker,
                            tone: 'neutral' as const,
                          }))}
                        />
                      ) : null}
                      <ProgressBar value={progress} />
                    </div>
                  )}
                  actions={(
                    <>
                      <button
                        type="button"
                        data-testid={projectWorkspaceButtonTestId(project.id)}
                        onClick={() => openProjectWorkspace(project)}
                        style={S.btnPrimary}
                      >
                        <CompassIcon size={16} />
                        Workspace
                      </button>
                      <button type="button" data-testid={projectDetailsButtonTestId(project.id)} onClick={() => setDetailProject(project)} style={S.btnOutline}>
                        <EyeIcon size={16} />
                        Chi tiết
                      </button>
                      {canManageProjectShell ? (
                        <button type="button" onClick={() => setEditProject(project)} style={S.btnOutline}>
                          <EditIcon size={16} />
                          Sửa
                        </button>
                      ) : null}
                      {canDeleteProject ? (
                        <button type="button" onClick={() => handleDelete(project)} style={{ ...S.btnOutline, color: tokens.colors.error, borderColor: tokens.colors.error }}>
                          <TrashIcon size={16} />
                          Xóa
                        </button>
                      ) : null}
                    </>
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <AddProjectModal
          token={currentUser.token}
          users={users}
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onSaved={async (project) => {
            await loadData();
            if (project?.id) setWorkspaceProjectId(project.id);
          }}
        />
      ) : null}

      {editProject ? (
        <EditProjectModal
          project={editProject}
          token={currentUser.token}
          users={users}
          accounts={accounts}
          onClose={() => setEditProject(null)}
          onSaved={async () => {
            await loadData();
          }}
        />
      ) : null}

      <ProjectDetailsModal
        project={detailProject}
        open={Boolean(detailProject)}
        canEditProject={canManageProjectShell}
        onClose={() => setDetailProject(null)}
        onEdit={() => {
          if (!detailProject) return;
          setEditProject(detailProject);
          setDetailProject(null);
        }}
        onOpenWorkspace={() => {
          if (!detailProject?.id) return;
          openProjectWorkspace(detailProject);
          setDetailProject(null);
        }}
        onNavigate={onNavigate}
      />

      {workspaceProjectId ? (
        <Suspense
          fallback={
            <div style={{ ...ui.card.base, padding: '20px', marginTop: '12px', fontSize: '14px', fontWeight: 700, color: tokens.colors.textSecondary, textAlign: 'center' }}>
              Đang tải project workspace...
            </div>
          }
        >
          <ProjectWorkspaceHubModal
            projectId={workspaceProjectId}
            token={currentUser.token}
            currentUser={currentUser}
            initialTab={workspaceInitialTab}
            accounts={accounts}
            onClose={() => {
              setWorkspaceProjectId(null);
              setWorkspaceInitialTab(undefined);
              setWorkspaceFocusDocumentId(undefined);
              setWorkspaceOpenThread(false);
            }}
            onNavigate={onNavigate}
            focusDocumentId={workspaceFocusDocumentId}
            openDocumentThreadOnMount={workspaceOpenThread}
            onUnavailable={async (projectId) => {
              if (workspaceProjectId === projectId) setWorkspaceProjectId(null);
              setWorkspaceInitialTab(undefined);
              setWorkspaceFocusDocumentId(undefined);
              setWorkspaceOpenThread(false);
              await loadData();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
