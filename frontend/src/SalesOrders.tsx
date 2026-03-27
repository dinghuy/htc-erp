import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from './config';
import { fetchWithAuth, type CurrentUser } from './auth';
import { consumeNavContext, setNavContext } from './navContext';
import { OverlayModal } from './ui/OverlayModal';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { projectStageLabel } from './ops/workflowOptions';

type SalesOrderRow = {
  id: string;
  orderNumber?: string;
  quotationId?: string | null;
  quotationNumber?: string | null;
  quotationStatus?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  status?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  taxTotal?: number | null;
  grandTotal?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type QuotationRow = {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
};

type ProjectRow = {
  id: string;
  name?: string | null;
  code?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  projectStage?: string | null;
};

const API = API_BASE;
const fmt = new Intl.NumberFormat('vi-VN');
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  processing: 'Processing',
  delivered: 'Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function formatMoney(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? fmt.format(n) : '0';
}

function formatTime(value?: string | null) {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SalesOrderDetailsModal({
  row,
  onClose,
  onOpenQuotation,
  onOpenProject,
}: {
  row: SalesOrderRow | null;
  onClose: () => void;
  onOpenQuotation: () => void;
  onOpenProject: () => void;
}) {
  if (!row) return null;
  return (
    <OverlayModal title="Chi tiết đơn hàng" onClose={onClose} maxWidth="680px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>
            {row.orderNumber || row.id}
          </div>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.neutral}>Khách hàng: {row.accountName || row.accountId || '—'}</span>
            <span style={ui.badge.info}>{STATUS_LABELS[String(row.status || '')] || row.status || 'draft'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Báo giá</label>
            <div style={{ marginTop: '4px', fontWeight: 700, color: tokens.colors.textPrimary }}>{row.quotationNumber || row.quotationId || '—'}</div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Dự án</label>
            <div style={{ marginTop: '4px', fontWeight: 700, color: tokens.colors.textPrimary }}>{row.projectName || row.projectId || '—'}</div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Giai đoạn</label>
            <div style={{ marginTop: '4px', fontWeight: 700, color: tokens.colors.textPrimary }}>{row.projectStage ? projectStageLabel(row.projectStage) || row.projectStage : '—'}</div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Trạng thái</label>
            <div style={{ marginTop: '4px', fontWeight: 700, color: tokens.colors.textPrimary }}>{STATUS_LABELS[String(row.status || '')] || row.status || 'draft'}</div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tổng tiền</label>
            <div style={{ marginTop: '4px', fontWeight: 900, color: tokens.colors.textPrimary }}>
              {formatMoney(row.grandTotal)} {row.currency || 'VND'}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Cập nhật</label>
            <div style={{ marginTop: '4px', fontWeight: 700, color: tokens.colors.textPrimary }}>{formatTime(row.updatedAt || row.createdAt)}</div>
          </div>
        </div>

        {row.notes && (
          <div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Ghi chú</div>
            <div style={{ whiteSpace: 'pre-wrap', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{row.notes}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button type="button" onClick={onClose} style={ui.btn.outline}>Đóng</button>
        <button type="button" onClick={onOpenQuotation} disabled={!row.quotationId} style={ui.btn.outline}>Mở báo giá</button>
        <button type="button" onClick={onOpenProject} disabled={!row.projectId} style={ui.btn.primary}>Mở dự án</button>
      </div>
    </OverlayModal>
  );
}

export function SalesOrders({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser?: CurrentUser | null;
  onNavigate?: (route: string) => void;
}) {
  const token = currentUser?.token ?? '';
  const [items, setItems] = useState<SalesOrderRow[]>([]);
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterProjectStage, setFilterProjectStage] = useState('');
  const [filterStatusGroup, setFilterStatusGroup] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderRow | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [contextActive, setContextActive] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, quotationsRes, projectsRes] = await Promise.all([
        fetchWithAuth(token, `${API}/sales-orders?limit=200`),
        fetchWithAuth(token, `${API}/quotations`),
        fetchWithAuth(token, `${API}/projects`),
      ]);
      if (!ordersRes.ok) throw new Error(`Load failed (${ordersRes.status})`);
      if (!quotationsRes.ok) throw new Error(`Quotation load failed (${quotationsRes.status})`);
      if (!projectsRes.ok) throw new Error(`Project load failed (${projectsRes.status})`);
      const orders = (await ordersRes.json()) as SalesOrderRow[];
      const quotationRows = await quotationsRes.json();
      const projectRows = await projectsRes.json();
      setItems(Array.isArray(orders) ? orders : []);
      setQuotations(Array.isArray(quotationRows) ? quotationRows : []);
      setProjects(Array.isArray(projectRows) ? projectRows : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    const ctx = consumeNavContext();
    if (!ctx) return;
    const hasContextFilters = !!(ctx.filters && Object.values(ctx.filters).some((v) => v !== undefined && v !== ''));
    const ctxProjectId = ctx.filters?.projectId || (ctx.entityType === 'Project' ? ctx.entityId : undefined);
    if (ctxProjectId) {
      setFilterProjectId(ctxProjectId);
      setSourceLabel('Opened from Project Workspace');
    }
    if (ctx.filters?.status) {
      setStatus(String(ctx.filters.status));
    }
    if (ctx.filters?.accountId) {
      setFilterAccountId(String(ctx.filters.accountId));
    }
    if (ctx.filters?.projectStage) {
      setFilterProjectStage(String(ctx.filters.projectStage));
    }
    if (ctx.filters?.statusGroup) {
      setFilterStatusGroup(String(ctx.filters.statusGroup));
    }
    if (hasContextFilters) {
      setContextActive(true);
    }
  }, []);

  const quotationMap = useMemo(() => {
    return new Map(quotations.map((qRow) => [qRow.id, qRow]));
  }, [quotations]);

  const projectMap = useMemo(() => {
    return new Map(projects.map((pRow) => [pRow.id, pRow]));
  }, [projects]);

  const augmented = useMemo(() => {
    return items.map((row) => {
      const quotation = row.quotationId ? quotationMap.get(row.quotationId) : undefined;
      const projectId = row.projectId || quotation?.projectId || null;
      const project = projectId ? projectMap.get(projectId) : undefined;
      return {
        ...row,
        projectId,
        projectName: row.projectName || quotation?.projectName || project?.name || project?.code || null,
        accountId: row.accountId || quotation?.accountId || project?.accountId || null,
        accountName: row.accountName || project?.accountName || null,
        projectStage: project?.projectStage || null,
      };
    });
  }, [items, quotationMap, projectMap]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return augmented.filter((row) => {
      const rowStatus = String(row.status || '').toLowerCase();
      if (status && rowStatus !== status.toLowerCase()) return false;
      if (filterStatusGroup === 'active' && !['draft', 'processing'].includes(rowStatus)) return false;
      if (filterStatusGroup === 'closed' && !['delivered', 'closed'].includes(rowStatus)) return false;
      if (filterProjectId && String(row.projectId || '') !== filterProjectId) return false;
      if (filterAccountId && String(row.accountId || '') !== filterAccountId) return false;
      if (filterProjectStage && String(row.projectStage || '') !== filterProjectStage) return false;
      if (!needle) return true;
      return (
        matchesQuery(row.orderNumber, needle) ||
        matchesQuery(row.quotationNumber, needle) ||
        matchesQuery(row.accountName, needle) ||
        matchesQuery(row.projectName, needle)
      );
    });
  }, [augmented, q, status, filterProjectId, filterAccountId, filterProjectStage, filterStatusGroup]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const row of augmented) {
      if (!row.projectId) continue;
      if (!seen.has(row.projectId)) {
        seen.set(row.projectId, {
          id: row.projectId,
          label: row.projectName || row.projectId,
        });
      }
    }
    for (const project of projects) {
      if (!seen.has(project.id)) {
        seen.set(project.id, {
          id: project.id,
          label: project.name || project.code || project.id,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [augmented, projects]);

  const accountOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const row of augmented) {
      if (!row.accountId) continue;
      if (!seen.has(row.accountId)) {
        seen.set(row.accountId, {
          id: row.accountId,
          label: row.accountName || row.accountId,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [augmented]);

  const stageOptions = useMemo(() => {
    const seen = new Set<string>();
    const stages: Array<{ id: string; label: string }> = [];
    for (const project of projects) {
      const stage = String(project.projectStage || '').trim();
      if (!stage || seen.has(stage)) continue;
      seen.add(stage);
      stages.push({ id: stage, label: projectStageLabel(stage) || stage });
    }
    return stages.sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  const activeProjectLabel = useMemo(() => {
    if (!filterProjectId) return null;
    const match = projectOptions.find((item) => item.id === filterProjectId);
    return match?.label || filterProjectId;
  }, [filterProjectId, projectOptions]);

  const activeAccountLabel = useMemo(() => {
    if (!filterAccountId) return null;
    const match = accountOptions.find((item) => item.id === filterAccountId);
    return match?.label || filterAccountId;
  }, [filterAccountId, accountOptions]);

  const activeStageLabel = useMemo(() => {
    if (!filterProjectStage) return null;
    return projectStageLabel(filterProjectStage) || filterProjectStage;
  }, [filterProjectStage]);

  const activeStatusGroupLabel = useMemo(() => {
    if (!filterStatusGroup) return null;
    return filterStatusGroup === 'active' ? 'Đang hoạt động' : filterStatusGroup === 'closed' ? 'Đã đóng' : filterStatusGroup;
  }, [filterStatusGroup]);

  const hasFilters = !!(q.trim() || status || filterProjectId || filterAccountId || filterProjectStage || filterStatusGroup);

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setFilterProjectId('');
    setFilterAccountId('');
    setFilterProjectStage('');
    setFilterStatusGroup('');
    setShowAdvancedFilters(false);
    setSourceLabel(null);
    setContextActive(false);
  };

  const clearContext = () => {
    setFilterProjectId('');
    setFilterAccountId('');
    setFilterProjectStage('');
    setFilterStatusGroup('');
    setStatus('');
    setSourceLabel(null);
    setContextActive(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '18px' }}>
      {selectedOrder && (
        <SalesOrderDetailsModal
          row={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOpenQuotation={() => {
            if (!selectedOrder.quotationId) return;
            setNavContext({
              route: 'Sales',
              entityType: 'Quotation',
              entityId: selectedOrder.quotationId,
              autoOpenEdit: true,
              filters: { quotationId: selectedOrder.quotationId },
            });
            onNavigate?.('Sales');
          }}
          onOpenProject={() => {
            if (!selectedOrder.projectId) return;
            setNavContext({
              route: 'Projects',
              entityType: 'Project',
              entityId: selectedOrder.projectId,
              filters: { projectId: selectedOrder.projectId },
            });
            onNavigate?.('Projects');
          }}
        />
      )}
      <div style={{
        ...ui.card.base,
        padding: '22px',
        background: `linear-gradient(135deg, rgba(0, 63, 133, 0.08) 0%, rgba(0, 151, 110, 0.06) 100%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
              ERP
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.04em' }}>
              Đơn hàng bán
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.55, maxWidth: '76ch' }}>
              Đơn hàng nội bộ tạo từ báo giá đã được chấp nhận. Đây là lớp ERP MVP để bàn giao sang vận hành.
            </p>
            {(sourceLabel || activeProjectLabel) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {sourceLabel && (
                  <span style={ui.badge.info}>{sourceLabel}</span>
                )}
                {activeProjectLabel && (
                  <span style={ui.badge.neutral}>Dự án: {activeProjectLabel}</span>
                )}
                {activeAccountLabel && (
                  <span style={ui.badge.neutral}>Khách hàng: {activeAccountLabel}</span>
                )}
                {activeStageLabel && (
                  <span style={ui.badge.info}>Giai đoạn: {activeStageLabel}</span>
                )}
                {activeStatusGroupLabel && (
                  <span style={ui.badge.neutral}>Nhóm trạng thái: {activeStatusGroupLabel}</span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => void load()} style={ui.btn.outline}>
              Làm mới
            </button>
            <button type="button" onClick={() => onNavigate?.('Sales')} style={ui.btn.primary}>
              Đi tới Sales
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <input
            value={q}
            onInput={(e: any) => setQ(e.target.value)}
            placeholder="Tìm đơn hàng, báo giá, khách hàng, dự án..."
            style={{ ...ui.input.base, minWidth: isMobile ? '100%' : '320px' }}
          />
          <select
            value={filterStatusGroup}
            onChange={(e: any) => setFilterStatusGroup(e.target.value)}
            style={{ ...ui.input.base, minWidth: isMobile ? '100%' : '220px' }}
          >
            <option value="">Tất cả nhóm trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="closed">Đã đóng</option>
          </select>
          <button type="button" onClick={() => setShowAdvancedFilters((prev) => !prev)} style={ui.btn.outline}>
            {showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
          </button>
          {hasFilters && (
            <button type="button" onClick={clearFilters} style={ui.btn.outline}>
              Xóa bộ lọc
            </button>
          )}
          {contextActive && (
            <button type="button" onClick={clearContext} style={ui.btn.ghost}>
              Xóa ngữ cảnh
            </button>
          )}
        </div>

        {showAdvancedFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '12px', marginTop: '12px' }}>
            <select
              value={status}
              onChange={(e: any) => setStatus(e.target.value)}
              style={{ ...ui.input.base, minWidth: 0 }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterProjectId}
              onChange={(e: any) => setFilterProjectId(e.target.value)}
              style={{ ...ui.input.base, minWidth: 0 }}
            >
              <option value="">Tất cả dự án</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
            <select
              value={filterAccountId}
              onChange={(e: any) => setFilterAccountId(e.target.value)}
              style={{ ...ui.input.base, minWidth: 0 }}
            >
              <option value="">Tất cả khách hàng</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            <select
              value={filterProjectStage}
              onChange={(e: any) => setFilterProjectStage(e.target.value)}
              style={{ ...ui.input.base, minWidth: 0 }}
            >
              <option value="">Tất cả giai đoạn</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          ...ui.card.base,
          padding: '14px 18px',
          border: '1px solid rgba(220, 38, 38, 0.18)',
          background: 'rgba(220, 38, 38, 0.06)',
          color: '#b91c1c',
          fontSize: '13px',
          fontWeight: 700,
        }}>
          {error}
        </div>
      )}

      <div style={{ ...ui.card.base, padding: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {loading ? 'Đang tải...' : `${filtered.length} đơn hàng`}
        </div>

        <div style={{ marginTop: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '12px', color: tokens.colors.textMuted }}>
                {['Đơn hàng', 'Khách hàng', 'Trạng thái', 'Tổng tiền', 'Cập nhật', 'Thao tác'].map((h) => (
                  <th key={h} style={{ padding: '10px 10px', borderBottom: `1px solid ${tokens.colors.border}`, fontWeight: 900 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '18px 10px', color: tokens.colors.textSecondary }}>
                    Chưa có đơn hàng. Gợi ý: đặt báo giá ở trạng thái <code>accepted</code> rồi chạy ERP Sync.
                  </td>
                </tr>
              )}

              {filtered.map((row) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
                  <td style={{ padding: '12px 10px', fontWeight: 900, color: tokens.colors.textPrimary }}>
                    {row.orderNumber || row.id}
                    <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, marginTop: '4px' }}>
                      {formatTime(row.createdAt)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', color: tokens.colors.textSecondary }}>
                    <div style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>
                      {row.accountName || row.accountId || '--'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: tokens.radius.lg,
                      border: `1px solid ${tokens.colors.border}`,
                      background: tokens.colors.surface,
                      color: tokens.colors.textPrimary,
                      fontSize: '12px',
                      fontWeight: 900,
                    }}>
                      {row.status || 'draft'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', fontWeight: 900, color: tokens.colors.textPrimary }}>
                    {formatMoney(row.grandTotal)} {row.currency || 'VND'}
                  </td>
                  <td style={{ padding: '12px 10px', color: tokens.colors.textSecondary }}>
                    {formatTime(row.updatedAt || row.createdAt)}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        style={{ ...ui.btn.outline, padding: '8px 10px', fontSize: '12px' }}
                        onClick={() => setSelectedOrder(row)}
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        style={{ ...ui.btn.outline, padding: '8px 10px', fontSize: '12px' }}
                        disabled={!row.quotationId}
                        onClick={() => {
                          if (!row.quotationId) return;
                          setNavContext({
                            route: 'Sales',
                            entityType: 'Quotation',
                            entityId: row.quotationId,
                            autoOpenEdit: true,
                            filters: { quotationId: row.quotationId },
                          });
                          onNavigate?.('Sales');
                        }}
                      >
                        Báo giá
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
