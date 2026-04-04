import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from './config';
import { fetchWithAuth } from './auth';
import { showNotify } from './Notification';
import { consumeNavContext } from './navContext';
import { OverlayPortal, getOverlayContainerStyle, overlayStyles } from './ui/overlay';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import {
  computeAmortization,
  computeMonthlySchedule,
  computePmLevelCosts,
  computeQuotationSummary,
  createEmptyPricingDraft,
  deriveInvestment,
  normalizePricingDraft,
} from './pricing/calc';
import type {
  PricingCostEntry,
  PricingLineItem,
  PricingMaintenancePart,
  PricingQuotationDraft,
  PricingSection,
} from './pricing/calc';
import { CheckIcon, LoaderIcon, MoneyIcon, RefreshIcon, WarningIcon } from './ui/icons';

const API = API_BASE;
const sections: PricingSection[] = ['A_MAIN', 'B_AUXILIARY', 'C_OTHER'];
const sectionLabels: Record<PricingSection, string> = {
  A_MAIN: 'Main',
  B_AUXILIARY: 'Auxiliary',
  C_OTHER: 'Other',
};

const S = {
  card: ui.card.base as any,
  input: { ...ui.input.base, boxSizing: 'border-box' } as any,
  button: ui.btn.outline as any,
  primary: { ...ui.btn.primary, justifyContent: 'center' } as any,
  warning: {
    ...ui.btn.outline,
    borderColor: tokens.colors.warning,
    color: tokens.colors.warning,
    justifyContent: 'center',
  } as any,
  modalCard: {
    ...overlayStyles.surface,
    width: 'min(980px, calc(100vw - 32px))',
    maxHeight: '85vh',
    overflowY: 'auto',
    padding: tokens.spacing.xl,
    display: 'grid',
    gap: tokens.spacing.lg,
  } as any,
};

type ActualEntryForm = {
  recordedAt: string;
  amountVnd: string;
  note: string;
};

type SupplementalReviewState = {
  open: boolean;
  reason: string;
  lineItems: PricingLineItem[];
};

export type PricingProps = {
  isMobile?: boolean;
  currentUser?: any;
  token?: string;
  projectId?: string | null;
  projectContext?: any;
  embedded?: boolean;
  onChanged?: () => void;
  readOnly?: boolean;
};

const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value || 0))} đ`;
const formatPct = (value: number) => `${(value * 100).toFixed(2)}%`;
const fieldValue = (value: any) => (value ?? value === 0 ? String(value) : '');
const todayValue = () => new Date().toISOString().slice(0, 10);

function isRoutedSection(section: PricingSection) {
  return section === 'B_AUXILIARY' || section === 'C_OTHER';
}

function workflowLabel(stage?: string | null) {
  switch (stage) {
    case 'procurement_review': return 'Đang duyệt Phòng mua hàng';
    case 'finance_review': return 'Đang duyệt Phòng tài chính';
    case 'completed': return 'Đã hoàn tất';
    case 'closed': return 'Đã đóng';
    default: return 'Bản nháp';
  }
}

function batchLabel(draft: PricingQuotationDraft) {
  return Number(draft.batchNo || 0) > 0 ? `Bổ sung đợt ${draft.batchNo}` : 'QBU gốc';
}

const newLineItem = (section: PricingSection): PricingLineItem => ({
  section,
  description: '',
  quantityLabel: section === 'C_OTHER' ? 'gói' : 'xe',
  unitCount: 1,
  sellUnitPriceVnd: section === 'A_MAIN' ? 0 : null,
  buyUnitPriceVnd: 0,
  buyUnitPriceUsd: null,
  costRoutingType: isRoutedSection(section) ? 'OTHER_COST' : null,
});

const newPart = (): PricingMaintenancePart => ({
  systemName: '',
  itemDescription: '',
  modelSpec: '',
  unit: '',
  qty: 0,
  unitPriceVnd: 0,
  level500h: false,
  level1000h: false,
  level2000h: false,
  level3000h: false,
  level4000h: false,
  note: '',
});

function deriveSalesperson(project: any) {
  const latestQbu = Array.isArray(project?.qbuRounds) ? project.qbuRounds[0] : null;
  const latestQuotation = Array.isArray(project?.quotations) ? project.quotations[0] : null;
  return latestQbu?.salePerson || latestQuotation?.salesperson || project?.salePerson || project?.managerName || '';
}

function buildDraftFromProject(project: any, projectId: string) {
  const draft = createEmptyPricingDraft();
  return normalizePricingDraft({
    ...draft,
    projectId,
    projectCode: project?.code || draft.projectCode,
    customerName: project?.accountName || project?.customerName || project?.companyName || draft.customerName,
    salePerson: deriveSalesperson(project),
  });
}

function buildExistingActualDrafts(costEntries: PricingCostEntry[] = []) {
  const map: Record<string, ActualEntryForm> = {};
  for (const entry of costEntries.filter((item) => item.entryType === 'ACTUAL' && item.id)) {
    map[String(entry.id)] = {
      recordedAt: String(entry.recordedAt || todayValue()).slice(0, 10),
      amountVnd: entry.amountVnd == null ? '' : String(entry.amountVnd),
      note: entry.note || '',
    };
  }
  return map;
}

function buildNewActualDrafts(lineItems: PricingLineItem[] = []) {
  const map: Record<string, ActualEntryForm> = {};
  for (const line of lineItems.filter((item) => item.id && isRoutedSection(item.section))) {
    map[String(line.id)] = { recordedAt: todayValue(), amountVnd: '', note: '' };
  }
  return map;
}

function buildSupplementalLines(draft: PricingQuotationDraft) {
  return (draft.varianceSummary?.lines || [])
    .filter((line) => line.requiresSupplementalApproval)
    .map((line) => {
      const baseItem = draft.lineItems.find((item) => item.id === line.lineItemId);
      if (!baseItem) return null;
      return {
        section: baseItem.section,
        description: `${line.description} - chi phí bổ sung`,
        quantityLabel: baseItem.quantityLabel || '',
        unitCount: 1,
        sellUnitPriceVnd: baseItem.section === 'A_MAIN' ? baseItem.sellUnitPriceVnd : null,
        buyUnitPriceVnd: Math.abs(line.varianceAmountVnd),
        buyUnitPriceUsd: null,
        costRoutingType: baseItem.costRoutingType || null,
      } satisfies PricingLineItem;
    })
    .filter(Boolean) as PricingLineItem[];
}

function PricingModal({
  title,
  subtitle,
  onClose,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: any;
  actions?: any;
}) {
  return (
    <OverlayPortal>
      <div style={getOverlayContainerStyle('modal', { padding: '24px' })}>
        <div aria-hidden="true" style={overlayStyles.backdrop} onClick={onClose} />
        <div style={S.modalCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
            {subtitle ? <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} style={{ ...ui.btn.ghost } as any}>Đóng</button>
        </div>
        {children}
        {actions ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
      </div>
    </OverlayPortal>
  );
}

export function Pricing({
  isMobile,
  currentUser,
  token: explicitToken,
  projectId: projectIdProp,
  projectContext,
  embedded = false,
  onChanged,
  readOnly = false,
}: PricingProps = {}) {
  const navContext = useMemo(() => (!embedded && !projectIdProp ? consumeNavContext('Pricing') : null), [embedded, projectIdProp]);
  const navProjectId = navContext?.filters?.projectId || null;
  const token = explicitToken || currentUser?.token || '';
  const [projectOptions, setProjectOptions] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdProp || navProjectId || '');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [draft, setDraft] = useState<PricingQuotationDraft>(() => createEmptyPricingDraft());
  const [tab, setTab] = useState<'quotation' | 'rental' | 'pm'>('quotation');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingSupplemental, setCreatingSupplemental] = useState(false);
  const [rootDraftStarted, setRootDraftStarted] = useState(false);
  const [newActualDrafts, setNewActualDrafts] = useState<Record<string, ActualEntryForm>>({});
  const [existingActualDrafts, setExistingActualDrafts] = useState<Record<string, ActualEntryForm>>({});
  const [actualSavingKey, setActualSavingKey] = useState<string | null>(null);
  const [supplementalReview, setSupplementalReview] = useState<SupplementalReviewState>({
    open: false,
    reason: '',
    lineItems: [],
  });

  const activeProjectId = projectIdProp || selectedProjectId || '';
  const activeProject = projectContext || projectOptions.find((project) => project.id === activeProjectId) || null;

  const computed = useMemo(() => {
    const normalized = normalizePricingDraft(draft);
    const summary = computeQuotationSummary(normalized);
    const pmLevelCosts = computePmLevelCosts(normalized.maintenanceParts);
    const investment = deriveInvestment(summary, normalized.rentalConfig.investmentQty);
    const amortization = computeAmortization(normalized.rentalConfig, investment.totalInvestment);
    const schedule = computeMonthlySchedule(normalized.rentalConfig, normalized.operationConfig, pmLevelCosts, amortization, investment.totalInvestment);
    return { normalized, summary, pmLevelCosts, investment, amortization, schedule };
  }, [draft]);

  const projectClosed = String(activeProject?.projectStage || '').toLowerCase() === 'closed';
  const isDraftLocked = readOnly || draft.qbuWorkflowStage !== 'draft' || projectClosed;
  const routedLines = computed.summary.lineItems.filter((item) => isRoutedSection(item.section));
  const grouped = sections.map((section) => ({
    section,
    rows: computed.normalized.lineItems.map((item, index) => ({ item, index })).filter(({ item }) => item.section === section),
  }));
  const showProjectShortcut = !embedded && !activeProjectId;
  const showRootEmptyState = !!activeProjectId && quotes.length === 0 && !draft.id && !rootDraftStarted;

  const loadProjects = async () => {
    if (!token) return;
    const res = await fetchWithAuth(token, `${API}/projects`);
    const data = await res.json();
    setProjectOptions(Array.isArray(data) ? data : []);
  };

  const hydrateDetailState = (detail: PricingQuotationDraft, nextBatches: any[]) => {
    const normalized = normalizePricingDraft(detail);
    setDraft(normalized);
    setBatches(nextBatches);
    setExistingActualDrafts(buildExistingActualDrafts(normalized.costEntries));
    setNewActualDrafts(buildNewActualDrafts(normalized.lineItems));
    setRootDraftStarted(false);
  };

  const loadDetail = async (quotationId: string) => {
    const detailRes = await fetchWithAuth(token, `${API}/pricing/quotations/${quotationId}`);
    const detail = await detailRes.json();
    const batchRes = await fetchWithAuth(token, `${API}/pricing/quotations/${quotationId}/batches`);
    const nextBatches = batchRes.ok ? await batchRes.json() : [detail];
    hydrateDetailState(detail, nextBatches);
  };

  const loadList = async (targetProjectId = activeProjectId, nextId?: string) => {
    if (!token || !targetProjectId) {
      setQuotes([]);
      setBatches([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/pricing/quotations?projectId=${encodeURIComponent(targetProjectId)}`);
      const data = await res.json();
      const nextQuotes = Array.isArray(data) ? data : [];
      setQuotes(nextQuotes);
      if (nextQuotes.length) {
        await loadDetail(nextId || nextQuotes[0].id);
      } else {
        setBatches([]);
        setExistingActualDrafts({});
        setNewActualDrafts({});
        if (!rootDraftStarted) {
          setDraft(buildDraftFromProject(activeProject, targetProjectId));
        }
      }
    } catch (error: any) {
      showNotify(error?.message || 'Không tải được pricing module', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [token]);

  useEffect(() => {
    if (!activeProjectId || !token) return;
    void loadList(activeProjectId);
  }, [activeProjectId, token]);

  useEffect(() => {
    if (projectIdProp) {
      setSelectedProjectId(projectIdProp);
    }
  }, [projectIdProp]);

  const setField = (field: keyof PricingQuotationDraft, value: any) => setDraft((prev) => ({ ...prev, [field]: value }));
  const setLine = (index: number, field: keyof PricingLineItem, value: any) => setDraft((prev) => {
    const lineItems = [...prev.lineItems];
    lineItems[index] = { ...lineItems[index], [field]: value };
    return { ...prev, lineItems };
  });
  const setRental = (field: string, value: any) => setDraft((prev) => ({ ...prev, rentalConfig: { ...prev.rentalConfig, [field]: value } }));
  const setOps = (field: string, value: any) => setDraft((prev) => ({ ...prev, operationConfig: { ...prev.operationConfig, [field]: value } }));
  const setPmInterval = (index: number, value: any) => setDraft((prev) => {
    const pmIntervalsHours = [...prev.operationConfig.pmIntervalsHours];
    pmIntervalsHours[index] = Number(value);
    return { ...prev, operationConfig: { ...prev.operationConfig, pmIntervalsHours } };
  });
  const setPart = (index: number, field: keyof PricingMaintenancePart, value: any) => setDraft((prev) => {
    const maintenanceParts = [...prev.maintenanceParts];
    maintenanceParts[index] = { ...maintenanceParts[index], [field]: value };
    return { ...prev, maintenanceParts };
  });

  const startRootDraft = () => {
    if (readOnly) {
      showNotify('Vai trò hiện tại chỉ được xem pricing workspace', 'error');
      return;
    }
    if (!activeProjectId) {
      showNotify('Cần chọn project trước khi tạo QBU gốc', 'error');
      return;
    }
    if (projectClosed) {
      showNotify('Project đã close, không thể tạo QBU mới', 'error');
      return;
    }
    setDraft(buildDraftFromProject(activeProject, activeProjectId));
    setRootDraftStarted(true);
  };

  const save = async () => {
    if (readOnly) {
      showNotify('Vai trò hiện tại chỉ được xem pricing workspace', 'error');
      return;
    }
    const finalProjectId = activeProjectId || draft.projectId || null;
    if (!finalProjectId) {
      showNotify('Pricing phải nằm trong context của một project', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth(token, draft.id ? `${API}/pricing/quotations/${draft.id}` : `${API}/pricing/quotations`, {
        method: draft.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...computed.normalized,
          projectId: finalProjectId,
          qbuType: draft.id ? draft.qbuType : 'INITIAL',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await loadList(finalProjectId, data.id);
      onChanged?.();
      showNotify(draft.id ? 'Đã cập nhật QBU draft' : 'Đã tạo QBU gốc', 'success');
    } catch (error: any) {
      showNotify(error.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitQbu = async () => {
    if (readOnly) {
      showNotify('Vai trò hiện tại không được trình QBU', 'error');
      return;
    }
    if (!draft.id) {
      showNotify('Cần lưu draft trước khi trình QBU', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(token, `${API}/pricing/quotations/${draft.id}/submit-qbu`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể trình QBU');
      await loadDetail(draft.id);
      onChanged?.();
      showNotify('Đã trình QBU theo workflow công ty', 'success');
    } catch (error: any) {
      showNotify(error.message || 'Không thể trình QBU', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openSupplementalReview = () => {
    if (readOnly) {
      showNotify('Vai trò hiện tại không được tạo QBU bổ sung', 'error');
      return;
    }
    if (!draft.id) {
      showNotify('Cần chọn một QBU trước', 'error');
      return;
    }
    if (projectClosed) {
      showNotify('Project đã close, không thể tạo batch bổ sung', 'error');
      return;
    }
    const deltaLines = buildSupplementalLines(draft);
    if (!deltaLines.length) {
      showNotify('Chưa có variance vượt ngưỡng để mở QBU bổ sung', 'error');
      return;
    }
    setSupplementalReview({ open: true, reason: '', lineItems: deltaLines });
  };

  const createSupplementalBatch = async () => {
    if (readOnly) {
      showNotify('Vai trò hiện tại không được tạo QBU bổ sung', 'error');
      return;
    }
    if (!draft.id) return;
    const reason = supplementalReview.reason.trim();
    if (!reason) {
      showNotify('Cần nhập lý do tạo QBU bổ sung', 'error');
      return;
    }
    setCreatingSupplemental(true);
    try {
      const res = await fetchWithAuth(token, `${API}/pricing/quotations/${draft.id}/supplemental-batches`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: activeProjectId,
          reason,
          lineItems: supplementalReview.lineItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tạo batch bổ sung');
      setSupplementalReview({ open: false, reason: '', lineItems: [] });
      await loadList(activeProjectId, data.id);
      onChanged?.();
      showNotify('Đã tạo QBU bổ sung sau bước review', 'success');
    } catch (error: any) {
      showNotify(error.message || 'Không thể tạo QBU bổ sung', 'error');
    } finally {
      setCreatingSupplemental(false);
    }
  };

  const saveNewActualCost = async (lineItemId: string) => {
    if (readOnly) {
      showNotify('Vai trò hiện tại chỉ được xem pricing workspace', 'error');
      return;
    }
    if (!draft.id) return;
    const value = newActualDrafts[lineItemId];
    if (!value || !value.amountVnd) {
      showNotify('Cần nhập số tiền actual', 'error');
      return;
    }
    setActualSavingKey(`new:${lineItemId}`);
    try {
      const res = await fetchWithAuth(token, `${API}/pricing/quotations/${draft.id}/actual-costs`, {
        method: 'POST',
        body: JSON.stringify({
          lineItemId,
          amountVnd: Number(value.amountVnd || 0),
          quantity: 1,
          note: value.note || '',
          recordedAt: value.recordedAt || todayValue(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được actual cost');
      await loadDetail(draft.id);
      onChanged?.();
      showNotify('Đã thêm chi phí thực tế', 'success');
    } catch (error: any) {
      showNotify(error.message || 'Không lưu được chi phí thực tế', 'error');
    } finally {
      setActualSavingKey(null);
    }
  };

  const saveExistingActualCost = async (entryId: string) => {
    if (readOnly) {
      showNotify('Vai trò hiện tại chỉ được xem pricing workspace', 'error');
      return;
    }
    if (!draft.id) return;
    const value = existingActualDrafts[entryId];
    if (!value) return;
    setActualSavingKey(`entry:${entryId}`);
    try {
      const res = await fetchWithAuth(token, `${API}/pricing/quotations/${draft.id}/actual-costs/${entryId}`, {
        method: 'PUT',
        body: JSON.stringify({
          amountVnd: Number(value.amountVnd || 0),
          quantity: 1,
          note: value.note || '',
          recordedAt: value.recordedAt || todayValue(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không cập nhật được actual cost');
      await loadDetail(draft.id);
      onChanged?.();
      showNotify('Đã cập nhật actual cost', 'success');
    } catch (error: any) {
      showNotify(error.message || 'Không cập nhật được actual cost', 'error');
    } finally {
      setActualSavingKey(null);
    }
  };

  if (showProjectShortcut) {
    return (
      <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
        <div style={{ ...S.card, padding: tokens.spacing.xl, display: 'grid', gap: tokens.spacing.md }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: tokens.colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <MoneyIcon size={22} /> Pricing
            </h2>
            <div style={{ marginTop: '6px', color: tokens.colors.textSecondary, fontSize: '14px' }}>
              Pricing giờ nằm trong phần quản lý chi phí của từng project. Chọn project để mở context QBU của dự án.
            </div>
          </div>
          <div style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
            <label style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Project</label>
            <select style={S.input} value={selectedProjectId} onChange={(e: any) => setSelectedProjectId(e.currentTarget.value || '')}>
              <option value="">Chọn project</option>
              {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.code || project.name}</option>)}
            </select>
          </div>
          {selectedProjectId ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={S.primary} onClick={() => void loadList(selectedProjectId)}>Mở quản lý chi phí của project</button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: tokens.spacing.md }}>
        <div>
          <h2 style={{ margin: 0, fontSize: embedded ? '24px' : '28px', fontWeight: 800, color: tokens.colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <MoneyIcon size={22} /> {embedded ? 'Quản lý chi phí dự án' : 'Pricing'}
          </h2>
          <div style={{ marginTop: '6px', color: tokens.colors.textSecondary, fontSize: '14px' }}>
            {activeProject?.code || activeProject?.name || 'Project'} · QBU gốc, QBU bổ sung, actual cost, variance và workflow duyệt.
          </div>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
          <button style={S.button} onClick={() => void loadList(activeProjectId, draft.id)}>{loading ? 'Loading...' : <><RefreshIcon size={14} /> Reload</>}</button>
          {!quotes.length ? <button style={S.button} onClick={startRootDraft} disabled={projectClosed || readOnly}>Tạo QBU gốc</button> : null}
          <button style={S.button} onClick={save} disabled={saving || isDraftLocked || showRootEmptyState}>{saving ? 'Saving...' : <><CheckIcon size={14} /> Save</>}</button>
          <button style={S.primary} onClick={submitQbu} disabled={readOnly || submitting || !draft.id || draft.qbuWorkflowStage !== 'draft'}>{submitting ? 'Submitting...' : 'Trình QBU'}</button>
          <button
            style={draft.varianceSummary?.requiresSupplementalApproval ? S.warning : S.button}
            onClick={openSupplementalReview}
            disabled={readOnly || creatingSupplemental || !draft.id || projectClosed}
          >
            {draft.varianceSummary?.requiresSupplementalApproval ? <><WarningIcon size={14} /> Tạo QBU bổ sung</> : 'Tạo QBU bổ sung'}
          </button>
        </div>
      </div>

      {showRootEmptyState ? (
        <div style={{ ...S.card, padding: tokens.spacing.xl, display: 'grid', gap: tokens.spacing.md }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>Project này chưa có QBU gốc trong quản lý chi phí</div>
          <div style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>
            Tạo QBU gốc trực tiếp trong workspace dự án để quản lý toàn bộ chi phí, actual cost và các batch bổ sung.
          </div>
          <div>
            <button style={S.primary} onClick={startRootDraft} disabled={projectClosed}>Tạo QBU gốc</button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card.kpi, minWidth: '170px' }}><div>Total Sell</div><strong>{formatMoney(computed.summary.totalSell)}</strong></div>
        <div style={{ ...ui.card.kpi, minWidth: '170px' }}><div>Total Cost</div><strong>{formatMoney(computed.summary.totalCost)}</strong></div>
        <div style={{ ...ui.card.kpi, minWidth: '170px' }}><div>Net Profit</div><strong>{formatMoney(computed.summary.netProfit)}</strong><span>{formatPct(computed.summary.netRos)}</span></div>
        <div style={{ ...ui.card.kpi, minWidth: '170px' }}><div>Monthly Rental</div><strong>{formatMoney(computed.schedule.recommendedMonthlyRental)}</strong></div>
      </div>

      <div style={{ ...S.card, padding: tokens.spacing.lg, display: 'grid', gap: tokens.spacing.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...ui.badge.neutral }}>{batchLabel(draft)}</span>
            <span style={draft.varianceSummary?.requiresSupplementalApproval ? ui.badge.warning as any : ui.badge.info as any}>{workflowLabel(draft.qbuWorkflowStage)}</span>
            {projectClosed ? <span style={ui.badge.error as any}>Project closed</span> : null}
            {readOnly ? <span style={ui.badge.neutral as any}>Read only by role</span> : null}
            {draft.changeReason ? <span style={ui.badge.neutral as any}>Reason: {draft.changeReason}</span> : null}
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
            {draft.qbuSubmittedAt ? `Submitted: ${new Date(draft.qbuSubmittedAt).toLocaleString('vi-VN')}` : 'Chưa submit'}
          </div>
        </div>
        {batches.length > 0 ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {batches.map((batch: any) => (
              <button
                key={batch.id}
                style={{ ...ui.btn.outline, background: batch.id === draft.id ? tokens.colors.badgeBgInfo : tokens.colors.surface } as any}
                onClick={() => void loadDetail(batch.id)}
              >
                {Number(batch.batchNo || 0) > 0 ? `Bổ sung ${batch.batchNo}` : 'QBU gốc'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: tokens.spacing.lg }}>
        <div style={{ ...S.card, padding: tokens.spacing.lg }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', marginBottom: tokens.spacing.md }}>
            Project QBU Batches
          </div>
          <div style={{ display: 'grid', gap: tokens.spacing.sm }}>
            {quotes.length === 0 ? <div style={{ color: tokens.colors.textSecondary, fontSize: '13px' }}>Chưa có batch nào.</div> : quotes.map((quote) => (
              <button
                key={quote.id}
                style={{ ...ui.btn.outline, padding: tokens.spacing.md, textAlign: 'left', justifyContent: 'space-between', background: quote.id === draft.id ? tokens.colors.badgeBgInfo : tokens.colors.surface }}
                onClick={() => void loadDetail(quote.id)}
              >
                <span style={{ display: 'grid', gap: '4px' }}>
                  <strong>{Number(quote.batchNo || 0) > 0 ? `Bổ sung ${quote.batchNo}` : 'QBU gốc'}</strong>
                  <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{quote.customerName || activeProject?.accountName || 'No customer'}</span>
                </span>
                <span style={{ fontSize: '12px' }}>{formatMoney(quote.totalSell || 0)}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            {(['quotation', 'rental', 'pm'] as const).map((name) => (
              <button key={name} style={{ ...ui.btn.outline, background: tab === name ? tokens.colors.badgeBgInfo : tokens.colors.surface } as any} onClick={() => setTab(name)}>
                {name === 'quotation' ? 'Quotation' : name === 'rental' ? 'Rental' : 'PM Catalog'}
              </button>
            ))}
          </div>

          <div style={{ ...S.card, padding: tokens.spacing.lg }}>
            {tab === 'quotation' && (
              <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.md }}>
                  {[
                    ['Project Code', 'projectCode', 'text'],
                    ['Customer', 'customerName', 'text'],
                    ['Supplier', 'supplierName', 'text'],
                    ['Salesperson', 'salePerson', 'text'],
                    ['Date', 'date', 'date'],
                    ['VAT', 'vatRate', 'number'],
                    ['Discount', 'discountRate', 'number'],
                    ['CIT', 'citRate', 'number'],
                    ['TPC Rate', 'tpcRate', 'number'],
                    ['Sell FX', 'sellFxRate', 'number'],
                    ['Buy FX', 'buyFxRate', 'number'],
                    ['Loan Days', 'loanInterestDays', 'number'],
                    ['Loan Rate', 'loanInterestRate', 'number'],
                  ].map(([label, field, type]) => (
                    <label key={field} style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      <span>{label}</span>
                      <input
                        type={type}
                        style={S.input}
                        disabled={isDraftLocked}
                        value={fieldValue((draft as any)[field])}
                        onInput={(e: any) => setField(field as any, type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
                      />
                    </label>
                  ))}
                  <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                    <span>TPC Type</span>
                    <select style={S.input} disabled={isDraftLocked} value={draft.tpcType || ''} onChange={(e: any) => setField('tpcType', e.currentTarget.value || null)}>
                      <option value="">None</option>
                      <option value="Net">Net</option>
                      <option value="Gross">Gross</option>
                    </select>
                  </label>
                </div>

                {grouped.map(({ section, rows }) => (
                  <div key={section} style={{ display: 'grid', gap: tokens.spacing.sm }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{sectionLabels[section]}</strong>
                      <button style={ui.btn.ghost as any} disabled={isDraftLocked} onClick={() => setDraft((prev) => ({ ...prev, lineItems: [...prev.lineItems, newLineItem(section)] }))}>+ Add</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Description', 'Qty', 'Sell VND', 'Buy VND', 'Buy USD', 'Routing', 'GM', ''].map((label) => <th key={label} style={ui.table.thStatic as any}>{label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? <tr><td colSpan={8} style={ui.table.td as any}>No rows.</td></tr> : rows.map(({ item, index }) => {
                            const summaryItem = computed.summary.lineItems[index];
                            return (
                              <tr key={`${section}-${index}`}>
                                <td style={ui.table.td as any}><input style={S.input} disabled={isDraftLocked} value={item.description || ''} onInput={(e: any) => setLine(index, 'description', e.currentTarget.value)} /></td>
                                <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(item.unitCount)} onInput={(e: any) => setLine(index, 'unitCount', Number(e.currentTarget.value))} /></td>
                                <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(item.sellUnitPriceVnd)} onInput={(e: any) => setLine(index, 'sellUnitPriceVnd', e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} /></td>
                                <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(item.buyUnitPriceVnd)} onInput={(e: any) => setLine(index, 'buyUnitPriceVnd', e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} /></td>
                                <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(item.buyUnitPriceUsd)} onInput={(e: any) => setLine(index, 'buyUnitPriceUsd', e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} /></td>
                                <td style={ui.table.td as any}>
                                  {isRoutedSection(section) ? (
                                    <select style={S.input} disabled={isDraftLocked} value={item.costRoutingType || ''} onChange={(e: any) => setLine(index, 'costRoutingType', e.currentTarget.value || null)}>
                                      <option value="">Chọn loại phí</option>
                                      <option value="IMPORT_COST">Chi phí nhập</option>
                                      <option value="OTHER_COST">Chi phí khác</option>
                                    </select>
                                  ) : '—'}
                                </td>
                                <td style={ui.table.td as any}>{formatPct(summaryItem?.gmPct || 0)}</td>
                                <td style={ui.table.td as any}><button style={ui.btn.ghost as any} disabled={isDraftLocked} onClick={() => setDraft((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, rowIndex) => rowIndex !== index) }))}>×</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'grid', gap: tokens.spacing.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong>Actual Cost & Variance</strong>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                      Threshold: {formatPct(draft.varianceSummary?.thresholds?.thresholdPct || 0)} và {formatMoney(draft.varianceSummary?.thresholds?.thresholdVnd || 0)}
                    </div>
                  </div>
                  {routedLines.length === 0 ? <div style={{ color: tokens.colors.textSecondary, fontSize: '13px' }}>Chưa có dòng phí B/C.</div> : (
                    <div style={{ display: 'grid', gap: tokens.spacing.md }}>
                      {routedLines.map((line) => {
                        const variance = draft.varianceSummary?.lines?.find((item) => item.lineItemId === line.id);
                        const actualEntries = (draft.costEntries || []).filter((entry) => entry.entryType === 'ACTUAL' && entry.lineItemId === line.id);
                        const newEntry = newActualDrafts[line.id || ''] || { recordedAt: todayValue(), amountVnd: '', note: '' };
                        return (
                          <div key={line.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, display: 'grid', gap: tokens.spacing.md }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>{line.description}</div>
                                <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                                  {line.costRoutingType === 'IMPORT_COST' ? 'Phòng mua hàng' : 'Phòng tài chính'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={ui.badge.neutral as any}>Approved {formatMoney(variance?.approvedAmountVnd || 0)}</span>
                                <span style={ui.badge.info as any}>Actual {formatMoney(variance?.actualAmountVnd || 0)}</span>
                                <span style={variance?.requiresSupplementalApproval ? ui.badge.warning as any : ui.badge.neutral as any}>
                                  Variance {formatMoney(variance?.varianceAmountVnd || 0)} · {formatPct(variance?.variancePct || 0)}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gap: '8px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textMuted }}>Lịch sử actual entries</div>
                              {actualEntries.length === 0 ? <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Chưa có phát sinh actual.</div> : actualEntries.map((entry) => {
                                const value = existingActualDrafts[String(entry.id)] || { recordedAt: todayValue(), amountVnd: '', note: '' };
                                return (
                                  <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '140px 180px 1fr 120px', gap: '8px', alignItems: 'center' }}>
                                    <input type="date" style={S.input} value={value.recordedAt} onInput={(e: any) => setExistingActualDrafts((prev) => ({ ...prev, [String(entry.id)]: { ...value, recordedAt: e.currentTarget.value } }))} />
                                    <input type="number" style={S.input} value={value.amountVnd} onInput={(e: any) => setExistingActualDrafts((prev) => ({ ...prev, [String(entry.id)]: { ...value, amountVnd: e.currentTarget.value } }))} />
                                    <input style={S.input} value={value.note} onInput={(e: any) => setExistingActualDrafts((prev) => ({ ...prev, [String(entry.id)]: { ...value, note: e.currentTarget.value } }))} />
                                    <button style={ui.btn.ghost as any} disabled={readOnly || actualSavingKey === `entry:${entry.id}`} onClick={() => entry.id && void saveExistingActualCost(String(entry.id))}>
                                      {actualSavingKey === `entry:${entry.id}` ? <LoaderIcon size={14} /> : 'Lưu'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: 'grid', gap: '8px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textMuted }}>Thêm phát sinh</div>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '140px 180px 1fr 140px', gap: '8px', alignItems: 'center' }}>
                                <input type="date" style={S.input} value={newEntry.recordedAt} onInput={(e: any) => setNewActualDrafts((prev) => ({ ...prev, [String(line.id)]: { ...newEntry, recordedAt: e.currentTarget.value } }))} />
                                <input type="number" style={S.input} value={newEntry.amountVnd} onInput={(e: any) => setNewActualDrafts((prev) => ({ ...prev, [String(line.id)]: { ...newEntry, amountVnd: e.currentTarget.value } }))} />
                                <input style={S.input} value={newEntry.note} onInput={(e: any) => setNewActualDrafts((prev) => ({ ...prev, [String(line.id)]: { ...newEntry, note: e.currentTarget.value } }))} />
                                <button style={S.button} disabled={readOnly || actualSavingKey === `new:${line.id}`} onClick={() => line.id && void saveNewActualCost(String(line.id))}>
                                  {actualSavingKey === `new:${line.id}` ? 'Đang lưu...' : 'Thêm actual'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap' }}>
                    <div style={{ ...ui.card.kpi, minWidth: '180px' }}><div>Approved Total</div><strong>{formatMoney(draft.varianceSummary?.totals?.approvedAmountVnd || 0)}</strong></div>
                    <div style={{ ...ui.card.kpi, minWidth: '180px' }}><div>Actual Total</div><strong>{formatMoney(draft.varianceSummary?.totals?.actualAmountVnd || 0)}</strong></div>
                    <div style={{ ...ui.card.kpi, minWidth: '180px' }}><div>Variance</div><strong>{formatMoney(draft.varianceSummary?.totals?.varianceAmountVnd || 0)}</strong><span>{formatPct(draft.varianceSummary?.totals?.variancePct || 0)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'rental' && (
              <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
                <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap' }}>
                  <div style={{ ...ui.card.kpi, minWidth: '160px' }}><div>Main Units</div><strong>{computed.investment.mainUnitCount}</strong></div>
                  <div style={{ ...ui.card.kpi, minWidth: '160px' }}><div>Unit Investment</div><strong>{formatMoney(computed.investment.unitInvestment)}</strong></div>
                  <div style={{ ...ui.card.kpi, minWidth: '160px' }}><div>Total Investment</div><strong>{formatMoney(computed.investment.totalInvestment)}</strong></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: tokens.spacing.md }}>
                  {Object.keys(draft.rentalConfig).map((field) => (
                    <label key={field} style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      <span>{field}</span>
                      <input type="number" step="0.01" style={S.input} disabled={isDraftLocked} value={fieldValue((draft.rentalConfig as any)[field])} onInput={(e: any) => setRental(field, Number(e.currentTarget.value))} />
                    </label>
                  ))}
                  {Object.keys(draft.operationConfig).filter((field) => field !== 'pmIntervalsHours').map((field) => (
                    <label key={field} style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      <span>{field}</span>
                      <input type="number" step="0.01" style={S.input} disabled={isDraftLocked} value={fieldValue((draft.operationConfig as any)[field])} onInput={(e: any) => setOps(field, Number(e.currentTarget.value))} />
                    </label>
                  ))}
                  {draft.operationConfig.pmIntervalsHours.map((value, index) => (
                    <label key={`pm-${index}`} style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      <span>PM Interval {index + 1}</span>
                      <input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(value)} onInput={(e: any) => setPmInterval(index, Number(e.currentTarget.value))} />
                    </label>
                  ))}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Month', 'Hours', 'KM', 'Triggers', 'Fuel', 'Maint', 'Driver', 'Rental'].map((label) => <th key={label} style={ui.table.thStatic as any}>{label}</th>)}</tr></thead>
                    <tbody>{computed.schedule.rows.map((row) => (
                      <tr key={row.month}>
                        <td style={ui.table.td as any}>{row.month}</td>
                        <td style={ui.table.td as any}>{row.accumulatedHours}</td>
                        <td style={ui.table.td as any}>{row.accumulatedKm}</td>
                        <td style={ui.table.td as any}>{row.triggers.join(' / ')}</td>
                        <td style={ui.table.td as any}>{formatMoney(row.fuelCost)}</td>
                        <td style={ui.table.td as any}>{formatMoney(row.maintenanceCost)}</td>
                        <td style={ui.table.td as any}>{formatMoney(row.driverCost)}</td>
                        <td style={ui.table.td as any}>{formatMoney(row.recommendedRental)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'pm' && (
              <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
                <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap' }}>
                  {computed.pmLevelCosts.map((cost, index) => <div key={index} style={{ ...ui.card.kpi, minWidth: '150px' }}><div>{draft.operationConfig.pmIntervalsHours[index]}h</div><strong>{formatMoney(cost)}</strong></div>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={ui.btn.ghost as any} disabled={isDraftLocked} onClick={() => setDraft((prev) => ({ ...prev, maintenanceParts: [...prev.maintenanceParts, newPart()] }))}>+ Add Part</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['System', 'Description', 'Qty', 'Unit Price', '500', '1000', '2000', '3000', '4000', ''].map((label) => <th key={label} style={ui.table.thStatic as any}>{label}</th>)}</tr></thead>
                    <tbody>
                      {draft.maintenanceParts.length === 0 ? <tr><td colSpan={10} style={ui.table.td as any}>No PM parts.</td></tr> : draft.maintenanceParts.map((part, index) => (
                        <tr key={index}>
                          <td style={ui.table.td as any}><input style={S.input} disabled={isDraftLocked} value={part.systemName || ''} onInput={(e: any) => setPart(index, 'systemName', e.currentTarget.value)} /></td>
                          <td style={ui.table.td as any}><input style={S.input} disabled={isDraftLocked} value={part.itemDescription || ''} onInput={(e: any) => setPart(index, 'itemDescription', e.currentTarget.value)} /></td>
                          <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(part.qty)} onInput={(e: any) => setPart(index, 'qty', Number(e.currentTarget.value))} /></td>
                          <td style={ui.table.td as any}><input type="number" style={S.input} disabled={isDraftLocked} value={fieldValue(part.unitPriceVnd)} onInput={(e: any) => setPart(index, 'unitPriceVnd', Number(e.currentTarget.value))} /></td>
                          {(['level500h', 'level1000h', 'level2000h', 'level3000h', 'level4000h'] as const).map((field) => <td key={field} style={ui.table.td as any}><input type="checkbox" disabled={isDraftLocked} checked={Boolean((part as any)[field])} onChange={(e: any) => setPart(index, field, e.currentTarget.checked)} /></td>)}
                          <td style={ui.table.td as any}><button style={ui.btn.ghost as any} disabled={isDraftLocked} onClick={() => setDraft((prev) => ({ ...prev, maintenanceParts: prev.maintenanceParts.filter((_, rowIndex) => rowIndex !== index) }))}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {supplementalReview.open ? (
        <PricingModal
          title="Review QBU bổ sung"
          subtitle="Xem lại delta line từ variance trước khi tạo batch bổ sung. Lý do là bắt buộc."
          onClose={() => setSupplementalReview({ open: false, reason: '', lineItems: [] })}
          actions={(
            <>
              <button type="button" onClick={() => setSupplementalReview({ open: false, reason: '', lineItems: [] })} style={S.button}>Hủy</button>
              <button type="button" onClick={() => void createSupplementalBatch()} style={S.primary} disabled={creatingSupplemental}>
                {creatingSupplemental ? 'Đang tạo...' : 'Tạo batch bổ sung'}
              </button>
            </>
          )}
        >
          <div style={{ display: 'grid', gap: tokens.spacing.md }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
              <span>Lý do tạo QBU bổ sung *</span>
              <textarea
                rows={3}
                style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
                value={supplementalReview.reason}
                onInput={(e: any) => setSupplementalReview((prev) => ({ ...prev, reason: e.currentTarget.value }))}
              />
            </label>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Description', 'Qty', 'Buy VND', 'Routing'].map((label) => <th key={label} style={ui.table.thStatic as any}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {supplementalReview.lineItems.map((line, index) => (
                    <tr key={`${line.description}-${index}`}>
                      <td style={ui.table.td as any}><input style={S.input} value={line.description || ''} onInput={(e: any) => setSupplementalReview((prev) => ({ ...prev, lineItems: prev.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.currentTarget.value } : item) }))} /></td>
                      <td style={ui.table.td as any}><input type="number" style={S.input} value={fieldValue(line.unitCount)} onInput={(e: any) => setSupplementalReview((prev) => ({ ...prev, lineItems: prev.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, unitCount: Number(e.currentTarget.value) } : item) }))} /></td>
                      <td style={ui.table.td as any}><input type="number" style={S.input} value={fieldValue(line.buyUnitPriceVnd)} onInput={(e: any) => setSupplementalReview((prev) => ({ ...prev, lineItems: prev.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, buyUnitPriceVnd: Number(e.currentTarget.value) } : item) }))} /></td>
                      <td style={ui.table.td as any}>
                        <select style={S.input} value={line.costRoutingType || ''} onChange={(e: any) => setSupplementalReview((prev) => ({ ...prev, lineItems: prev.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, costRoutingType: e.currentTarget.value || null } : item) }))}>
                          <option value="IMPORT_COST">Chi phí nhập</option>
                          <option value="OTHER_COST">Chi phí khác</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PricingModal>
      ) : null}
    </div>
  );
}
