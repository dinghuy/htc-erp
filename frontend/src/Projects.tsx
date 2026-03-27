import { lazy, Suspense } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from './config';
import { type CurrentUser, fetchWithAuth } from './auth';
import { showNotify } from './Notification';
import { consumeNavContext, setNavContext } from './navContext';
import { projectStageLabel, projectStageValueOptions } from './ops/workflowOptions';
import { canPerformAction, type ProjectWorkspaceTabKey } from './shared/domain/contracts';
import { QA_TEST_IDS, projectCardTestId, projectDetailsButtonTestId, projectWorkspaceButtonTestId } from './testing/testIds';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { DetailField, DetailGrid, DetailModal, DetailSection } from './ui/details';
import { CompassIcon, EditIcon, EyeIcon, FolderIcon, PlusIcon, TrashIcon } from './ui/icons';
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
      return { ...base, background: '#e8f4fd', color: tokens.colors.primary };
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
      return { ...base, background: '#ede9fe', color: '#6d28d9' };
    default:
      return { ...base, ...ui.badge.info };
  }
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
            <label style={S.label}>Project Owner</label>
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
            <label style={S.label}>Stage</label>
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
        setNavContext({ route: 'Sales', entityType: 'Quotation', entityId: project.latestQuotationId });
        onClose();
        onNavigate('Sales');
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
            <DetailField label="Stage" value={<span style={projectStageBadgeStyle(project.projectStage)}>{projectStageLabel(project.projectStage) || '—'}</span>} />
            <DetailField label="Khách hàng" value={project.accountName || '—'} />
            <DetailField label="Owner" value={project.managerName || '—'} />
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
            <DetailField label="Supplier quotes" value={Number(project.supplierQuoteCount || 0).toLocaleString('vi-VN')} />
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
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<ProjectWorkspaceTabKey | undefined>(undefined);
  const canManageProjectShell = canPerformAction(currentUser.roleCodes, 'edit_project_shell', currentUser.systemRole);
  const canDeleteProject = canPerformAction(currentUser.roleCodes, 'edit_project_shell', currentUser.systemRole)
    && currentUser.roleCodes?.includes('admin');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [projectsData, usersData, accountsData] = await Promise.all([
        requestJsonWithAuth(currentUser.token, `${API}/projects`, {}, 'Không thể tải danh sách dự án'),
        requestJsonWithAuth(currentUser.token, `${API}/users`, {}, 'Không thể tải danh sách người dùng'),
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
              setWorkspaceProjectId(matched.id);
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
            setWorkspaceProjectId(matchingProject.id);
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

  const stats = useMemo(() => {
    const countByStatus = (status: ProjectStatus) => projects.filter((project) => project.status === status).length;
    return {
      total: projects.length,
      active: countByStatus('active'),
      completed: countByStatus('completed'),
      paused: countByStatus('paused'),
    };
  }, [projects]);

  const handleDelete = async (project: any) => {
    if (!canDeleteProject) return;
    if (!window.confirm(`Xóa dự án \"${project.name}\"? Thao tác này không thể hoàn tác.`)) return;
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
  };

  return (
    <div style={{ display: 'grid', gap: '20px', padding: isMobile ? '16px' : '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderIcon size={22} color={tokens.colors.textPrimary} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: tokens.colors.textPrimary }}>Dự án</h2>
          </div>
          <div style={{ marginTop: '6px', fontSize: '14px', color: tokens.colors.textSecondary }}>Quản lý toàn bộ dự án và đi sâu vào workspace hợp đồng cho từng dự án.</div>
        </div>
        {canManageProjectShell ? (
          <button type="button" onClick={() => setShowAdd(true)} style={S.btnPrimary}>
            <PlusIcon size={16} />
            Tạo Dự Án Thủ Công
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
        <KpiCard label="Tổng dự án" value={stats.total} />
        <KpiCard label="Đang thực hiện" value={stats.active} accent={tokens.colors.primary} />
        <KpiCard label="Hoàn thành" value={stats.completed} accent={tokens.colors.success} />
        <KpiCard label="Tạm dừng" value={stats.paused} accent={tokens.colors.warning} />
      </div>

      <div style={{ ...S.card, padding: '18px', display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
                  borderRadius: tokens.radius.lg,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 800,
                  background: active ? tokens.colors.primary : 'transparent',
                  color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1.4fr) repeat(3, minmax(180px, 1fr)) auto auto', gap: '12px', alignItems: 'center' }}>
          <input
            style={S.input}
            value={searchTerm}
            onInput={(e: any) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, mã, account, owner..."
          />
          <select style={S.input} value={stageFilter} onChange={(e: any) => setStageFilter(e.target.value)}>
            <option value="">Tất cả stage dự án</option>
            {projectStageValueOptions().map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select style={S.input} value={accountFilter} onChange={(e: any) => setAccountFilter(e.target.value)}>
            <option value="">Tất cả account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{resolveAccountLabel(account)}</option>
            ))}
          </select>
          <select style={S.input} value={managerFilter} onChange={(e: any) => setManagerFilter(e.target.value)}>
            <option value="">Tất cả owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{resolveUserLabel(user)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOverdueOnly((prev) => !prev)}
            style={{
              ...(overdueOnly ? S.btnPrimary : S.btnOutline),
              whiteSpace: 'nowrap',
            }}
          >
            Chỉ dự án có task trễ
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStageFilter('');
              setAccountFilter('');
              setManagerFilter('');
              setOverdueOnly(false);
              setStatusFilter('all');
            }}
            style={S.btnOutline}
          >
            Reset
          </button>
        </div>
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, fontWeight: 700 }}>
          Hiển thị {filteredProjects.length}/{projects.length} dự án
        </div>
      </div>

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
            return (
              <div key={project.id} data-testid={projectCardTestId(project.id)} style={{ ...S.card, padding: '18px', display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setWorkspaceProjectId(project.id)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: tokens.colors.textPrimary, fontSize: '18px', fontWeight: 900, textAlign: 'left' }}
                      >
                        {project.name}
                      </button>
                      {project.code ? <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textMuted }}>#{project.code}</span> : null}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                      {project.description || 'Chưa có mô tả dự án.'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={statusBadgeStyle(project.status)}>{STATUS_LABELS[(project.status || 'pending') as ProjectStatus] || project.status}</span>
                    <span style={projectStageBadgeStyle(project.projectStage)}>{projectStageLabel(project.projectStage) || '—'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{project.accountName || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{project.managerName || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatDate(project.startDate)} - {formatDate(project.endDate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task / Quote</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>
                      {Number(project.taskCount || 0).toLocaleString('vi-VN')} task / {Number(project.quotationCount || 0).toLocaleString('vi-VN')} báo giá
                    </div>
                  </div>
                </div>

                <ProgressBar value={progress} />

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="button" data-testid={projectWorkspaceButtonTestId(project.id)} onClick={() => setWorkspaceProjectId(project.id)} style={S.btnPrimary}>
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
                </div>
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
          setWorkspaceProjectId(detailProject.id);
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
            }}
            onNavigate={onNavigate}
            onUnavailable={async (projectId) => {
              if (workspaceProjectId === projectId) setWorkspaceProjectId(null);
              setWorkspaceInitialTab(undefined);
              await loadData();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
