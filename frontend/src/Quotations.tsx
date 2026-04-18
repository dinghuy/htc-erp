import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { PageHeader } from './ui/PageHeader';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { consumeNavContext } from './navContext';
import { useI18n } from './i18n';
import { EyeIcon, LoaderIcon, MoneyIcon, PlusIcon, QuoteIcon, ReportIcon, TargetIcon, TrashIcon } from './ui/icons';
import { KpiCard } from './quotations/QuotationComponents';
import { QuotationEditor } from './quotations/QuotationEditor';
import {
  API,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  allowedTransitions,
  buildSaveQuotationGuard,
  createInitialQuotationTerms,
  createNewQuotationTerms,
  ensureArray,
  isLegacyStatus,
  normalizeCommercialTerms,
  normalizeQuotationLineItems,
  quotationStyles,
  resolveSubmissionContactId,
  statusBadgeStyle,
} from './quotations/quotationShared';
import type { QuotationRow } from './quotations/quotationShared';
const S = quotationStyles;



export function Quotations({ autoOpenForm, onFormOpened, isMobile, currentUser }: { autoOpenForm?: boolean; onFormOpened?: () => void; isMobile?: boolean; currentUser?: any } = {}) {
  const { t } = useI18n();
  const token = currentUser?.token || '';
  const userCanEdit = canEdit(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanDelete = canDelete(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const OPEN_QUOTE_KEY = 'crm_open_quotation_id'; // backward-compat: older deep links

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [productsDB, setProductsDB] = useState<any[]>([]);
  const [productCatalogError, setProductCatalogError] = useState('');
  const [userDirectoryError, setUserDirectoryError] = useState('');
  const [latestUsdVndRate, setLatestUsdVndRate] = useState<number | null>(null);
  const [latestUsdVndWarnings, setLatestUsdVndWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [savingQuote, setSavingQuote] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const previewA4Ref = useRef<HTMLDivElement | null>(null);

  // Auto open form when triggered from New Deal button
  useEffect(() => {
    if (autoOpenForm) {
      setShowForm(true);
      setEditingQuoteId(null);
      setMobileTab('form');
      if (onFormOpened) onFormOpened();
    }
  }, [autoOpenForm]);

  // Form State
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteStatus, setQuoteStatus] = useState('draft');
  const [currentEditingQuote, setCurrentEditingQuote] = useState<any | null>(null);
  const [subject, setSubject] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [salespersonPhone, setSalespersonPhone] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [revisionNo, setRevisionNo] = useState(1);
  const [revisionLabel, setRevisionLabel] = useState('R1');
  const [changeReason, setChangeReason] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const BASE_PREVIEW_SCALE = 0.66;
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewContentHeight, setPreviewContentHeight] = useState(PREVIEW_PAGE_HEIGHT);
  const [fin] = useState({ interestRate: 8.5, exchangeRate: 25400, loanTermMonths: 36, markup: 15, vatRate: 8 });
  const [terms, setTerms] = useState<any>(createInitialQuotationTerms());
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const itemsToTranslate = terms.termItems || [];
      const textsToTranslate = [terms.remarks, ...itemsToTranslate.map((i:any) => i.textVi)];
      const translations = await Promise.all(textsToTranslate.map(async (text) => {
        if (!text) return '';
        const res = await fetch(`${API}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        return data.translation || '';
      }));
      setTerms({
         ...terms, 
         remarksEn: translations[0], 
         termItems: itemsToTranslate.map((item:any, idx:number) => ({ ...item, textEn: translations[idx + 1] })) 
      });
    } catch (e: any) {
      showNotify('Lỗi dịch thuật API: ' + e.message, 'error');
    }
    setTranslating(false);
  };

  const selectedAcc = useMemo(() => accounts.find(a => a.id === selectedAccId), [accounts, selectedAccId]);
  const selectedProject = useMemo(() => projects.find((p: any) => p.id === selectedProjectId), [projects, selectedProjectId]);
  const accContacts = useMemo(() => contacts.filter(c => c.accountId === selectedAccId), [contacts, selectedAccId]);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);
  const visibleQuotations = useMemo(() => {
    if (!filterProjectId) return quotations;
    return quotations.filter((q: any) => q.projectId === filterProjectId);
  }, [quotations, filterProjectId]);
  const previewScale = (previewZoom / 100) * BASE_PREVIEW_SCALE;
  const previewPageCount = Math.max(1, Math.ceil(previewContentHeight / PREVIEW_PAGE_HEIGHT));
  const getContactDisplayName = (contact: any) => {
    if (!contact) return '—';
    if (contact.fullName) return contact.fullName;
    const composed = [contact.lastName, contact.firstName].filter(Boolean).join(' ').trim();
    return composed || '—';
  };

  const loadData = async () => {
    try {
      const [qRes, sRes, aRes, pRes, prRes, cRes, spRes, uRes] = await Promise.all([
        fetchWithAuth(token, `${API}/quotations`), fetchWithAuth(token, `${API}/stats`), fetch(`${API}/accounts`),
        fetch(`${API}/products`), fetch(`${API}/projects`), fetch(`${API}/contacts`), fetchWithAuth(token, `${API}/salespersons`),
        fetchWithAuth(token, `${API}/users`)
      ]);
      const [quotationsPayload, statsPayload, accountsPayload, productsPayload, projectsPayload, contactsPayload, salespersonsPayload, usersPayload] = await Promise.all([
        qRes.json(),
        sRes.json(),
        aRes.json(),
        pRes.json(),
        prRes.json(),
        cRes.json(),
        spRes.json(),
        uRes.json(),
      ]);
      setQuotations(ensureArray<QuotationRow>(quotationsPayload));
      setStats(statsPayload && typeof statsPayload === 'object' && !Array.isArray(statsPayload) ? statsPayload : {});
      setAccounts(ensureArray(accountsPayload));
      setProjects(ensureArray(projectsPayload));
      setContacts(ensureArray(contactsPayload));
      setSalespersons(ensureArray(salespersonsPayload));

      if (pRes.ok && Array.isArray(productsPayload)) {
        setProductsDB(productsPayload);
        setProductCatalogError('');
      } else {
        setProductsDB([]);
        setProductCatalogError('Catalog sản phẩm đang tạm thời không tải được. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.');
      }

      if (uRes.ok && Array.isArray(usersPayload)) {
        setUsers(usersPayload);
        setUserDirectoryError('');
      } else {
        setUsers([]);
        setUserDirectoryError('Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.');
      }

      try {
        const fxRes = await fetch(`${API}/exchange-rates/latest?pair=USDVND`);
        const fx = await fxRes.json();
        setLatestUsdVndRate(fx?.rate ?? null);
        setLatestUsdVndWarnings(Array.isArray(fx?.warnings) ? fx.warnings : []);
      } catch {
        setLatestUsdVndRate(null);
        setLatestUsdVndWarnings([]);
      }
    } catch {
      setQuotations([]);
      setAccounts([]);
      setProjects([]);
      setContacts([]);
      setSalespersons([]);
      setProductsDB([]);
      setUsers([]);
      setProductCatalogError('Không tải được catalog sản phẩm. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.');
      setUserDirectoryError('Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.');
      console.error('Load failed');
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const warnIfAspectMismatch = () => {
      const el = previewA4Ref.current;
      if (!el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;
      const targetWidth = PREVIEW_PAGE_WIDTH;
      const targetHeight = PREVIEW_PAGE_HEIGHT;
      const ratio = width / targetHeight;
      const targetRatio = targetWidth / targetHeight;
      const tolerance = 0.02;
      const diff = Math.abs(ratio - targetRatio) / targetRatio;
      if (diff > tolerance) {
        console.warn(
          `[Quotation Preview] A4 ratio mismatch: width=${width}px height=${height}px ratio=${ratio.toFixed(4)} target=${targetRatio.toFixed(4)} diff=${(diff * 100).toFixed(2)}%`
        );
      }
    };
    warnIfAspectMismatch();
    window.addEventListener('resize', warnIfAspectMismatch);
    return () => window.removeEventListener('resize', warnIfAspectMismatch);
  }, []);

  useEffect(() => {
    const measure = () => {
      const el = previewA4Ref.current;
      if (!el) return;
      const nextHeight = Math.max(PREVIEW_PAGE_HEIGHT, el.scrollHeight || 0);
      setPreviewContentHeight((prev: number) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };
    measure();
    const rafId = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    items,
    terms,
    subject,
    selectedAccId,
    selectedContactId,
    salesperson,
    salespersonPhone,
    currency,
    quoteNumber,
    quoteDate,
  ]);

  const addItem = (p: any) => {
    setItems([...items, { ...p, quantity: 1, unitPrice: Math.round(p.basePrice * fin.exchangeRate * (1 + fin.markup / 100)), technicalSpecs: p.technicalSpecs || '', remarks: '', unit: p.unit || 'Chiếc' }]);
    setShowProdModal(false);
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const next = [...items]; next[idx] = { ...next[idx], [field]: val }; setItems(next);
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.unitPrice || 0) * parseInt(i.quantity || 1)), 0);
    const taxTotal = subtotal * ((fin?.vatRate || 8) / 100);
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  }, [items, fin]);

  const handleSalespersonSelect = (id: string) => {
    // Tìm trong Users trước (nhân viên công ty), fall back sang SalesPersons cũ
    const user = users.find(u => u.id === id);
    if (user) { 
      setSalesperson(user.fullName); 
      setSalespersonPhone(user.phone || ''); 
      return; 
    }
    const sp = salespersons.find(s => s.id === id);
    if (sp) { setSalesperson(sp.name); setSalespersonPhone(sp.phone || ''); }
  };

  const downloadQuotationPdf = async (quotationId: string, fallbackQuoteNumber?: string) => {
    setDownloadingPdfId(quotationId);
    try {
      const res = await fetch(`${API}/quotations/${quotationId}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tải PDF');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const safeFallback = (fallbackQuoteNumber || 'quotation').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = matched?.[1] || `Quotation_${safeFallback}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showNotify(`Xuất PDF thất bại: ${e.message}`, 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const saveQuotation = async (status = 'draft') => {
    const guard = buildSaveQuotationGuard({ selectedAccId, lineItems: items });
    if (!guard.canSave && guard.notifyMessage) return showNotify(guard.notifyMessage, 'error');
    setSavingQuote(true);
    const body = {
      quoteNumber: quoteNumber || `QT-${Date.now().toString().slice(-6)}`,
      quoteDate,
      projectId: selectedProjectId || null,
      subject,
      accountId: selectedAccId,
      contactId: resolveSubmissionContactId({ selectedAccId, selectedContactId, contacts }),
      salesperson,
      salespersonPhone,
      currency,
      revisionNo,
      revisionLabel,
      changeReason,
      lineItems: items.map((i, index) => ({
        id: i.id || null,
        sortOrder: Number.isFinite(Number(i.sortOrder)) ? Number(i.sortOrder) : index,
        sku: i.sku,
        name: i.name,
        quantity: parseInt(i.quantity || 1),
        unitPrice: parseFloat(i.unitPrice || 0),
        unit: i.unit,
        technicalSpecs: i.technicalSpecs,
        remarks: i.remarks,
      })),
      financialConfig: { ...fin },
      commercialTerms: {
        remarksVi: terms.remarks || '',
        remarksEn: terms.remarksEn || '',
        termItems: ensureArray(terms.termItems).map((item: any, index: number) => ({
          id: item?.id || null,
          sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
          labelViPrint: item?.labelViPrint || '',
          labelEn: item?.labelEn || '',
          textVi: item?.textVi || '',
          textEn: item?.textEn || '',
        })),
      },
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, status,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    try {
      let savedQuote;
      if (editingQuoteId) {
        const res = await fetchWithAuth(token, `${API}/quotations/${editingQuoteId}`, { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Cập nhật báo giá thất bại');
        }
        savedQuote = await res.json();
      } else {
        const res = await fetchWithAuth(token, `${API}/quotations`, { method: 'POST', body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Tạo báo giá thất bại');
        }
        savedQuote = await res.json();
      }

      setShowForm(false);
      setEditingQuoteId(null);
      loadData();
      showNotify('Đã lưu báo giá thành công', 'success');

      if (status === 'sent' && savedQuote?.id) {
        await downloadQuotationPdf(savedQuote.id, savedQuote.quoteNumber || body.quoteNumber);
      }
    } catch (e: any) {
      showNotify(e.message || 'Không thể lưu báo giá', 'error');
    } finally {
      setSavingQuote(false);
    }
  };

  const updateStatus = async (id: string, currentStatus: string, nextStatus: string) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus, expectedStatus: currentStatus })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Không thể cập nhật trạng thái');
      }
      showNotify('Cập nhật trạng thái thành công', 'success');
      await loadData();
      if (editingQuoteId === id) {
        setQuoteStatus(nextStatus);
        setCurrentEditingQuote((prev: any) => (prev ? { ...prev, status: nextStatus } : prev));
      }
    } catch (e: any) {
      showNotify(e.message || 'Không thể cập nhật trạng thái', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const deleteQuote = (id: string) => {
    setConfirmState({
      message: 'Xóa báo giá này?',
      onConfirm: async () => {
        setConfirmState(null);
        setQuotations(prev => prev.filter((q: any) => q.id !== id));
        await fetchWithAuth(token, `${API}/quotations/${id}`, { method: 'DELETE' });
      },
    });
  };

  const handleCreateRevision = async (q: any) => {
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${q.id}/revise`, {
        method: 'POST',
        body: JSON.stringify({
          quoteNumber: `${q.quoteNumber || 'QT'}-R${Number(q.revisionNo || 1) + 1}`,
          changeReason: 'Tạo revision mới từ quotation hiện tại',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo revision');
      }
      const revised = await res.json();
      await loadData();
      setFilterProjectId(revised.projectId || filterProjectId);
      await handleEditQuote(revised);
      showNotify('Đã tạo quotation revision mới', 'success');
    } catch (e: any) {
      showNotify(e.message || 'Không thể tạo revision', 'error');
    }
  };

  const handleEditQuote = async (q: any) => {
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${q.id}`);
      const fullQ = await res.json();
      setEditingQuoteId(fullQ.id);
      setQuoteStatus(fullQ.status || 'draft');
      setCurrentEditingQuote(fullQ);
      setQuoteNumber(fullQ.quoteNumber || '');
      setQuoteDate(fullQ.quoteDate ? new Date(fullQ.quoteDate).toISOString().slice(0, 10) : (fullQ.createdAt ? new Date(fullQ.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)));
      setSubject(fullQ.subject || '');
      setSelectedProjectId(fullQ.projectId || '');
      setSelectedAccId(fullQ.accountId || '');
      setSelectedContactId(fullQ.contactId || '');
      setSalesperson(fullQ.salesperson || '');
      setSalespersonPhone(fullQ.salespersonPhone || '');
      setCurrency(fullQ.currency || 'VND');
      setRevisionNo(Number(fullQ.revisionNo || 1));
      setRevisionLabel(fullQ.revisionLabel || `R${fullQ.revisionNo || 1}`);
      setChangeReason(fullQ.changeReason || '');
      setItems(normalizeQuotationLineItems(fullQ.lineItems));
      const normalizedTerms = normalizeCommercialTerms(fullQ.commercialTerms);
      if (normalizedTerms.termItems.length > 0 || normalizedTerms.remarks || normalizedTerms.remarksEn) {
        setTerms(normalizedTerms);
      }
      setMobileTab('form');
      setShowForm(true);
    } catch {
      showNotify('Không thể tải chi tiết báo giá', 'error');
    }
  };

  const requestCommercialApproval = async (quotation: QuotationRow) => {
    if (!quotation.projectId) {
      showNotify('Quotation cần gắn project trước khi submit approval', 'error');
      return;
    }
    try {
      const res = await fetchWithAuth(token, `${API}/projects/${quotation.projectId}/approvals`, {
        method: 'POST',
        body: JSON.stringify({
          quotationId: quotation.id,
          requestType: 'quotation_commercial',
          title: `Quotation approval - ${quotation.quoteNumber || quotation.id}`,
          department: 'Commercial',
          approverRole: 'director',
          note: 'Submitted from quotations list',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo approval request');
      }
      showNotify('Đã tạo approval request cho quotation', 'success');
      await loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo approval request', 'error');
    }
  };

  const createSalesOrderFromQuotation = async (quotation: QuotationRow) => {
    try {
      const res = await fetchWithAuth(token, `${API}/sales-orders/from-quotation/${quotation.id}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo sales order');
      }
      showNotify('Đã tạo sales order', 'success');
      await loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo sales order', 'error');
    }
  };

  // Deep link support: open a quotation by id when navigated from Tasks/Notifications.
  useEffect(() => {
    const ctx = consumeNavContext();
    if (ctx?.filters?.projectId) {
      setFilterProjectId(ctx.filters.projectId);
      setSelectedProjectId(ctx.filters.projectId);
    }
    if (ctx?.entityType === 'Quotation' && ctx.entityId) {
      void handleEditQuote({ id: ctx.entityId });
      return;
    }

    const quotationId = localStorage.getItem(OPEN_QUOTE_KEY);
    if (!quotationId) return;
    localStorage.removeItem(OPEN_QUOTE_KEY);
    void handleEditQuote({ id: quotationId });
  }, []);

  const handleCreateNew = () => {
    setEditingQuoteId(null);
    setQuoteStatus('draft');
    setCurrentEditingQuote(null);
    setQuoteNumber('');
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setSubject('');
    setSelectedProjectId(filterProjectId || '');
    setSelectedAccId('');
    setSelectedContactId('');
    setSalesperson('');
    setSalespersonPhone('');
    setCurrency('VND');
    setRevisionNo(1);
    setRevisionLabel('R1');
    setChangeReason('');
    setItems([]);
    setTerms(createNewQuotationTerms());
    setMobileTab('form');
    setShowForm(true);
  };

  if (showForm) {
    return (
      <QuotationEditor
        isMobile={isMobile}
        showProdModal={showProdModal}
        setShowProdModal={setShowProdModal}
        productsDB={productsDB}
        addItem={addItem}
        latestUsdVndRate={latestUsdVndRate}
        latestUsdVndWarnings={latestUsdVndWarnings}
        productCatalogError={productCatalogError}
        setShowForm={setShowForm}
        setEditingQuoteId={setEditingQuoteId}
        quoteStatus={quoteStatus}
        currentEditingQuote={currentEditingQuote}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        quoteNumber={quoteNumber}
        setQuoteNumber={setQuoteNumber}
        quoteDate={quoteDate}
        setQuoteDate={setQuoteDate}
        projects={projects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        revisionNo={revisionNo}
        setRevisionNo={setRevisionNo}
        revisionLabel={revisionLabel}
        setRevisionLabel={setRevisionLabel}
        changeReason={changeReason}
        setChangeReason={setChangeReason}
        subject={subject}
        setSubject={setSubject}
        selectedProject={selectedProject}
        accounts={accounts}
        selectedAccId={selectedAccId}
        setSelectedAccId={setSelectedAccId}
        setSelectedContactId={setSelectedContactId}
        selectedAcc={selectedAcc}
        accContacts={accContacts}
        selectedContactId={selectedContactId}
        userDirectoryError={userDirectoryError}
        handleSalespersonSelect={handleSalespersonSelect}
        users={users}
        salespersons={salespersons}
        salesperson={salesperson}
        setSalesperson={setSalesperson}
        salespersonPhone={salespersonPhone}
        setSalespersonPhone={setSalespersonPhone}
        currency={currency}
        setCurrency={setCurrency}
        items={items}
        setItems={setItems}
        updateItem={updateItem}
        handleTranslate={handleTranslate}
        translating={translating}
        terms={terms}
        setTerms={setTerms}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        previewScale={previewScale}
        previewContentHeight={previewContentHeight}
        previewPageCount={previewPageCount}
        previewA4Ref={previewA4Ref}
        getContactDisplayName={getContactDisplayName}
        selectedContact={selectedContact}
        totals={totals}
        editingQuoteId={editingQuoteId}
        updateStatus={updateStatus}
        saveQuotation={saveQuotation}
        savingQuote={savingQuote}
      />
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      <PageHeader
        icon={<ReportIcon size={22} />}
        title={t('sales.quotations.title')}
        subtitle={t('sales.quotations.subtitle')}
        actions={userCanEdit ? <button style={S.btnPrimary} onClick={handleCreateNew}><PlusIcon size={14} /> {t('sales.quotations.action.create')}</button> : undefined}
      />

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <KpiCard icon={<QuoteIcon size={20} />} label="Tổng Báo giá" value={stats.quotations ?? '—'} color={tokens.colors.primary} />
        <KpiCard icon={<MoneyIcon size={20} />} label="Pipeline" value="~15.5 Tỷ" color={tokens.colors.info} />
        <KpiCard icon={<TargetIcon size={20} />} label="Tỷ lệ thắng" value="32%" color={tokens.colors.warning} />
        <KpiCard icon={<LoaderIcon size={20} />} label="Active" value={stats.activeQuotations ?? '—'} color={tokens.colors.info} />
      </div>

      <div style={{ ...S.card, padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
          <label style={{ ...S.label, marginBottom: '6px' }}>Lọc theo project</label>
          <select style={S.select} value={filterProjectId} onChange={(e:any) => setFilterProjectId(e.target.value)}>
            <option value="">-- Tất cả project --</option>
            {projects.map((p:any) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
          </select>
        </div>
        {filterProjectId && <button style={S.btnGhost} onClick={() => setFilterProjectId('')}>Xóa lọc</button>}
      </div>

      <div style={{ ...S.card, overflowX: 'auto', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}><LoaderIcon size={16} /> Đang tải dữ liệu...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.colors.background }}>
                {['Số Báo giá', 'Revision', 'Project', 'Nội dung', 'Khách hàng', 'Ngày báo giá', 'Tổng GT', 'Trạng thái', ''].map(h => (
                  <th key={h} style={S.thStatic}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleQuotations.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted }}>Bắt đầu bằng cách nhấn "Tạo Báo giá Mới"</td></tr>
              ) : visibleQuotations.map((q) => (
                <tr key={q.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                  <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary }}>{q.quoteNumber}</td>
                  <td style={S.td}>{q.revisionLabel || `R${q.revisionNo || 1}`}</td>
                  <td style={{ ...S.td, fontSize: '12px', color: tokens.colors.textSecondary }}>{q.projectName || q.projectId || 'Tự tạo khi lưu'}</td>
                  <td style={{ ...S.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colors.textMuted, fontSize: '12px' }}>{q.subject || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{q.accountName || q.accountId}</td>
                  <td style={S.td}>{new Date(q.quoteDate || q.createdAt || Date.now()).toLocaleDateString('vi-VN')}</td>
                  <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>{q.grandTotal?.toLocaleString()} đ</td>
                  <td style={S.td}>
                    {(() => {
                      const legacy = isLegacyStatus(q.status || undefined);
                      const remind = q.isRemind === true;
                      const gateState = q.approvalGateState;
                      return (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ ...statusBadgeStyle(q.status || undefined), border: `1px solid ${tokens.colors.border}` }}>
                            {q.status?.toUpperCase()}
                          </span>
                          {gateState?.status && gateState.status !== 'not_requested' && (
                            <span style={gateState.status === 'pending' ? ui.badge.warning : gateState.status === 'approved' ? ui.badge.success : ui.badge.info}>
                              Approval: {String(gateState.status).toUpperCase()}
                            </span>
                          )}
                          {(gateState?.pendingApprovers || []).map((approver) => (
                            <span key={`${q.id}-${approver.approvalId || approver.approverRole || 'approver'}`} style={ui.badge.info}>
                              {approver.approverRole || approver.approverName || 'Pending approver'}
                            </span>
                          ))}
                          {legacy && (
                            <span title="Unsupported status; editing disabled." style={{ ...ui.badge.neutral, border: `1px dashed ${tokens.colors.border}` }}>LEGACY</span>
                          )}
                          {remind && (
                            <span style={{
                              ...ui.badge.warning,
                              color: tokens.colors.textPrimary,
                              border: `1px solid ${tokens.colors.warningDark}`
                            }}>REMIND</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ ...S.td, display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {(() => {
                      const legacy = isLegacyStatus(q.status || undefined);
                      const readOnly = legacy || q.status === 'accepted' || q.status === 'rejected';
                      const nextOptions = allowedTransitions(q.status || undefined);
                      const busy = updatingStatusId === q.id;
                      const actions = q.actionAvailability || {};
                      return (
                        <>
                          {actions.canRequestCommercialApproval && (
                            <button
                              onClick={() => requestCommercialApproval(q)}
                              style={{ ...S.btnGhost, color: tokens.colors.warningDark, fontWeight: 700 }}
                            >
                              Submit approval
                            </button>
                          )}
                          {actions.canCreateSalesOrder && (
                            <button
                              onClick={() => createSalesOrderFromQuotation(q)}
                              style={{ ...S.btnGhost, color: tokens.colors.success, fontWeight: 700 }}
                            >
                              Tạo SO
                            </button>
                          )}
                          {!readOnly && nextOptions.length > 0 && (
                            <select
                              style={{ ...S.select, padding: '6px 8px', fontSize: '11px' }}
                              onChange={(e: any) => {
                                const next = e.target.value;
                                if (next) updateStatus(q.id, q.status || 'draft', next);
                                e.target.value = '';
                              }}
                              disabled={busy}
                              defaultValue=""
                            >
                              <option value="" disabled>Đổi trạng thái</option>
                              {nextOptions.map(s => (
                                <option value={s}>{s.toUpperCase()}</option>
                              ))}
                            </select>
                          )}
                          <button onClick={() => handleEditQuote(q)} style={{ ...S.btnGhost, color: tokens.colors.info, fontWeight: 700 }}><EyeIcon size={14} /></button>
                          {userCanEdit && actions.canRevise !== false && (
                            <button onClick={() => handleCreateRevision(q)} style={{ ...S.btnGhost, color: tokens.colors.primary, fontWeight: 700 }}>R+</button>
                          )}
                          <button
                            onClick={() => downloadQuotationPdf(q.id, q.quoteNumber || undefined)}
                            disabled={downloadingPdfId === q.id}
                            style={{
                              border: `1px solid ${tokens.colors.primary}`,
                              color: tokens.colors.primary,
                              background: 'none',
                              padding: `5px ${tokens.spacing.md}`,
                              borderRadius: tokens.radius.md,
                              cursor: downloadingPdfId === q.id ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: 800,
                              opacity: downloadingPdfId === q.id ? 0.6 : 1
                            }}
                          >
                            {downloadingPdfId === q.id ? '...' : 'PDF'}
                          </button>
                          {userCanDelete && <button
                            onClick={() => { if (!readOnly && actions.canDelete !== false) deleteQuote(q.id); }}
                            disabled={readOnly || actions.canDelete === false}
                            style={{
                              ...S.btnGhost,
                              color: tokens.colors.error,
                              fontWeight: 700,
                              opacity: (readOnly || actions.canDelete === false) ? 0.5 : 1,
                              cursor: (readOnly || actions.canDelete === false) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <TrashIcon size={14} />
                          </button>}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
