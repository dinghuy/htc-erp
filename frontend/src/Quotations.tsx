import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { showNotify } from './Notification';
import { canDelete, canEdit, fetchWithAuth } from './auth';
import { useI18n } from './i18n';
import { consumeNavContext } from './navContext';
import { createIdempotencyKey, withIdempotencyKey } from './shared/api/client';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { MetricCard, PageHero } from './ui/patterns';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { EyeIcon, LoaderIcon, TrashIcon } from './ui/icons';
import { QuotationEditor } from './quotations/QuotationEditor';
import {
  API,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  buildSaveQuotationGuard,
  createInitialQuotationTerms,
  createNewQuotationTerms,
  ensureArray,
  getApprovalStateMeta,
  getQuotationStatusMeta,
  normalizeCalculateTotals,
  normalizeCommercialTerms,
  normalizeQuotationLineItems,
  parseNumberInput,
  normalizeVatRate,
  quotationStyles,
  resolveSubmissionContactId,
  type QuotationRow,
} from './quotations/quotationShared';
import {
  computeQuotationOfferWorkspace,
  createEmptyOfferGroup,
  normalizeQuotationOfferGroups,
  serializeQuotationLineItemsByOfferGroups,
  type QuotationOfferGroup,
} from './quotations/quotationOfferGroups';

const S = quotationStyles;
const OPEN_QUOTE_KEY = 'crm_open_quotation_id';
const DEFAULT_FINANCIAL_CONFIG = {
  interestRate: 8.5,
  exchangeRate: 25400,
  loanTermMonths: 36,
  markup: 15,
  vatRate: 8,
  calculateTotals: true,
};

type SaveQuotationOptions = {
  status?: string;
  exportPdf?: boolean;
};

export function Quotations({
  autoOpenForm,
  onFormOpened,
  isMobile,
  currentUser,
}: {
  autoOpenForm?: boolean;
  onFormOpened?: () => void;
  isMobile?: boolean;
  currentUser?: any;
} = {}) {
  const { t } = useI18n();
  const token = currentUser?.token || '';
  const userCanEdit = canEdit(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanDelete = canDelete(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [productsDB, setProductsDB] = useState<any[]>([]);
  const [productCatalogError, setProductCatalogError] = useState('');
  const [userDirectoryError, setUserDirectoryError] = useState('');
  const [latestUsdVndRate, setLatestUsdVndRate] = useState<number | null>(null);
  const [latestUsdVndWarnings, setLatestUsdVndWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingQuote, setSavingQuote] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showProdModal, setShowProdModal] = useState(false);
  const [productPickerOfferGroupKey, setProductPickerOfferGroupKey] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const previewA4Ref = useRef<HTMLDivElement | null>(null);

  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteStatus, setQuoteStatus] = useState('draft');
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [salespersonPhone, setSalespersonPhone] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [items, setItems] = useState<any[]>([]);
  const [offerGroups, setOfferGroups] = useState<QuotationOfferGroup[]>([createEmptyOfferGroup(0, 'VND')]);
  const [selectedOfferGroupKey, setSelectedOfferGroupKey] = useState('group-a');
  const [fin, setFin] = useState(DEFAULT_FINANCIAL_CONFIG);
  const [terms, setTerms] = useState<any>(createInitialQuotationTerms());
  const [translating, setTranslating] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewContentHeight, setPreviewContentHeight] = useState(PREVIEW_PAGE_HEIGHT);

  const BASE_PREVIEW_SCALE = 0.66;
  const previewScale = (previewZoom / 100) * BASE_PREVIEW_SCALE;
  const previewPageCount = Math.max(1, Math.ceil(previewContentHeight / PREVIEW_PAGE_HEIGHT));

  useEffect(() => {
    if (autoOpenForm) {
      handleCreateNew();
      onFormOpened?.();
    }
  }, [autoOpenForm]);

  const selectedAcc = useMemo(
    () => accounts.find((account) => String(account.id) === String(selectedAccId)),
    [accounts, selectedAccId],
  );
  const accContacts = useMemo(
    () => contacts.filter((contact) => String(contact.accountId) === String(selectedAccId)),
    [contacts, selectedAccId],
  );
  const selectedContact = useMemo(
    () => contacts.find((contact) => String(contact.id) === String(selectedContactId)),
    [contacts, selectedContactId],
  );

  const listMetrics = useMemo(() => {
    const totalCount = quotations.length;
    const pendingApprovalCount = quotations.filter((row) => row.approvalGateState?.status === 'pending').length;
    const reminderCount = quotations.filter((row) => row.isRemind === true).length;
    const wonCount = quotations.filter((row) => getQuotationStatusMeta(row.status).normalized === 'won').length;
    return { totalCount, pendingApprovalCount, reminderCount, wonCount };
  }, [quotations]);

  const offerWorkspace = useMemo(
    () => computeQuotationOfferWorkspace(items, offerGroups, currency),
    [items, offerGroups, currency],
  );

  const getContactDisplayName = (contact: any) => {
    if (!contact) return '—';
    if (contact.fullName) return contact.fullName;
    const composed = [contact.lastName, contact.firstName].filter(Boolean).join(' ').trim();
    return composed || '—';
  };

  const markOfferGroupDirty = (groupKey: string) => {
    setOfferGroups((prev) =>
      prev.map((group) =>
        group.groupKey === groupKey
          ? {
              ...group,
              vatComputed: false,
              totalComputed: false,
            }
          : group,
      ),
    );
  };

  const resetEditor = () => {
    setEditingQuoteId(null);
    setQuoteStatus('draft');
    setLinkedProjectId(null);
    setQuoteNumber('');
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setSubject('');
    setSelectedAccId('');
    setSelectedContactId('');
    setSalesperson('');
    setSalespersonPhone('');
    setCurrency('VND');
    setItems([]);
    setOfferGroups([createEmptyOfferGroup(0, 'VND')]);
    setSelectedOfferGroupKey('group-a');
    setFin(DEFAULT_FINANCIAL_CONFIG);
    setTerms(createNewQuotationTerms());
    setMobileTab('form');
  };

  const handleCreateNew = () => {
    resetEditor();
    setShowForm(true);
  };

  const loadData = async () => {
    try {
      const [quotationRes, accountsRes, productsRes, contactsRes, salespersonsRes, usersRes] = await Promise.all([
        fetchWithAuth(token, `${API}/quotations`),
        fetch(`${API}/accounts`),
        fetchWithAuth(token, `${API}/products`),
        fetch(`${API}/contacts`),
        fetchWithAuth(token, `${API}/salespersons`),
        fetchWithAuth(token, `${API}/users`),
      ]);

      const [quotationPayload, accountsPayload, productsPayload, contactsPayload, salespersonsPayload, usersPayload] =
        await Promise.all([
          quotationRes.json(),
          accountsRes.json(),
          productsRes.json(),
          contactsRes.json(),
          salespersonsRes.json(),
          usersRes.json(),
        ]);

      setQuotations(ensureArray<QuotationRow>(quotationPayload));
      setAccounts(ensureArray(accountsPayload));
      setContacts(ensureArray(contactsPayload));
      setSalespersons(ensureArray(salespersonsPayload));

      if (productsRes.ok && Array.isArray(productsPayload)) {
        setProductsDB(productsPayload);
        setProductCatalogError('');
      } else {
        setProductsDB([]);
        setProductCatalogError(
          'Catalog sản phẩm đang tạm thời không tải được. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.',
        );
      }

      if (usersRes.ok && Array.isArray(usersPayload)) {
        setUsers(usersPayload);
        setUserDirectoryError('');
      } else {
        setUsers([]);
        setUserDirectoryError(
          'Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.',
        );
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
      setContacts([]);
      setSalespersons([]);
      setProductsDB([]);
      setUsers([]);
      setProductCatalogError(
        'Không tải được catalog sản phẩm. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.',
      );
      setUserDirectoryError(
        'Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.',
      );
      console.error('Load failed');
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const warnIfAspectMismatch = () => {
      const el = previewA4Ref.current;
      if (!el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;
      const targetRatio = PREVIEW_PAGE_WIDTH / PREVIEW_PAGE_HEIGHT;
      const ratio = width / height;
      const tolerance = 0.02;
      const diff = Math.abs(ratio - targetRatio) / targetRatio;
      if (diff > tolerance) {
        console.warn(
          `[Quotation Preview] A4 ratio mismatch: width=${width}px height=${height}px ratio=${ratio.toFixed(4)} target=${targetRatio.toFixed(4)} diff=${(diff * 100).toFixed(2)}%`,
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
      setPreviewContentHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
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
    fin.vatRate,
    fin.calculateTotals,
  ]);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const termItems = ensureArray<any>(terms.termItems);
      const translationTargets = [
        !terms.remarksEn && terms.remarks
          ? { kind: 'remarksEn' as const, text: terms.remarks }
          : null,
        ...termItems.flatMap((item, index) => [
          !item.labelEn && item.labelViPrint
            ? { kind: 'labelEn' as const, index, text: item.labelViPrint }
            : null,
          !item.textEn && item.textVi
            ? { kind: 'textEn' as const, index, text: item.textVi }
            : null,
        ]),
      ].filter(Boolean) as Array<
        | { kind: 'remarksEn'; text: string }
        | { kind: 'labelEn'; index: number; text: string }
        | { kind: 'textEn'; index: number; text: string }
      >;

      if (!translationTargets.length) {
        showNotify('Không có trường tiếng Anh trống để dịch.', 'info');
        return;
      }

      const translations = await Promise.all(
        translationTargets.map(async (target) => {
          const res = await fetch(`${API}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: target.text }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Server error');
          return data.translation || '';
        }),
      );

      const nextTerms = {
        ...terms,
        termItems: termItems.map((item) => ({ ...item })),
      };

      translationTargets.forEach((target, index) => {
        const translation = translations[index];
        if (!translation) return;
        if (target.kind === 'remarksEn') {
          nextTerms.remarksEn = translation;
          return;
        }
        if (target.kind === 'labelEn') {
          nextTerms.termItems[target.index].labelEn = translation;
          return;
        }
        nextTerms.termItems[target.index].textEn = translation;
      });

      setTerms(nextTerms);
    } catch (error: any) {
      showNotify(`Lỗi dịch thuật API: ${error.message}`, 'error');
    } finally {
      setTranslating(false);
    }
  };

  const addItem = (product: any) => {
    const targetGroupKey = productPickerOfferGroupKey || selectedOfferGroupKey;
    const targetGroup =
      offerGroups.find((group) => group.groupKey === targetGroupKey) ||
      offerGroups[0] ||
      createEmptyOfferGroup(0, currency);
    const previousItem = [...items]
      .reverse()
      .find((item) => String(item.offerGroupKey || 'group-a') === targetGroup.groupKey);
    const nextItem = {
      ...product,
      quantity: 1,
      unitPrice: Math.round(Number(product.basePrice || 0) * fin.exchangeRate * (1 + fin.markup / 100)),
      technicalSpecs: product.technicalSpecs || '',
      remarks: '',
      unit: product.unit || 'Chiếc',
      isOption: false,
      offerGroupKey: targetGroup.groupKey,
      currency: previousItem?.currency || targetGroup.currency || currency,
      vatMode: previousItem?.vatMode || 'net',
      vatRate: previousItem?.vatRate ?? fin.vatRate,
    };
    setItems((prev) => [...prev, nextItem]);
    markOfferGroupDirty(targetGroup.groupKey);
    setSelectedOfferGroupKey(targetGroup.groupKey);
    setProductPickerOfferGroupKey(null);
    setShowProdModal(false);
  };

  const addManualItem = (targetGroupKey = selectedOfferGroupKey) => {
    const targetGroup =
      offerGroups.find((group) => group.groupKey === targetGroupKey) ||
      offerGroups[0] ||
      createEmptyOfferGroup(0, currency);
    const previousItem = [...items]
      .reverse()
      .find((item) => String(item.offerGroupKey || 'group-a') === targetGroup.groupKey);
    setItems((prev) => [
      ...prev,
      {
        id: null,
        sku: '',
        name: '',
        unit: 'Chiếc',
        technicalSpecs: '',
        remarks: '',
        quantity: 1,
        unitPrice: 0,
        sortOrder: null,
        isOption: false,
        offerGroupKey: targetGroup.groupKey,
        currency: previousItem?.currency || targetGroup.currency || currency,
        vatMode: previousItem?.vatMode || 'net',
        vatRate: previousItem?.vatRate ?? fin.vatRate,
      },
    ]);
    markOfferGroupDirty(targetGroup.groupKey);
    setSelectedOfferGroupKey(targetGroup.groupKey);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextItem = { ...item, [field]: value };
        if (field === 'vatMode') {
          nextItem.vatMode = value;
        }
        return nextItem;
      }),
    );
    const targetGroupKey = String(items[index]?.offerGroupKey || selectedOfferGroupKey || 'group-a');
    markOfferGroupDirty(targetGroupKey);
  };

  const removeItemAt = (index: number) => {
    const targetGroupKey = String(items[index]?.offerGroupKey || selectedOfferGroupKey || 'group-a');
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    markOfferGroupDirty(targetGroupKey);
  };

  const addOfferGroup = () => {
    setOfferGroups((prev) => {
      const nextGroup = createEmptyOfferGroup(prev.length, currency);
      setSelectedOfferGroupKey(nextGroup.groupKey);
      return [...prev, nextGroup];
    });
  };

  const openProductPickerForOfferGroup = (groupKey: string) => {
    setSelectedOfferGroupKey(groupKey);
    setProductPickerOfferGroupKey(groupKey);
    setShowProdModal(true);
  };

  const updateOfferGroup = (groupKey: string, patch: Partial<QuotationOfferGroup>) => {
    setOfferGroups((prev) =>
      prev.map((group) =>
        group.groupKey === groupKey
          ? {
              ...group,
              ...patch,
              vatComputed: false,
              totalComputed: false,
            }
          : group,
      ),
    );

    if (Object.prototype.hasOwnProperty.call(patch, 'currency')) {
      setItems((prev) =>
        prev.map((item) =>
          String(item.offerGroupKey || 'group-a') === groupKey
            ? { ...item, currency: patch.currency || item.currency }
            : item,
        ),
      );
    }
  };

  const removeOfferGroup = (groupKey: string) => {
    setOfferGroups((prev) => {
      if (prev.length <= 1) {
        setItems([]);
        setSelectedOfferGroupKey('group-a');
        return [createEmptyOfferGroup(0, currency)];
      }

      const nextGroups = prev
        .filter((group) => group.groupKey !== groupKey)
        .map((group, index) => ({ ...group, sortOrder: index }));
      const nextSelected = selectedOfferGroupKey === groupKey ? nextGroups[0]?.groupKey || 'group-a' : selectedOfferGroupKey;
      setSelectedOfferGroupKey(nextSelected);
      return nextGroups;
    });
    setItems((prev) => prev.filter((item) => String(item.offerGroupKey || 'group-a') !== groupKey));
  };

  const reorderOfferGroups = (sourceGroupKey: string, targetGroupKey: string) => {
    if (!sourceGroupKey || !targetGroupKey || sourceGroupKey === targetGroupKey) return;
    setOfferGroups((prev) => {
      const current = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const sourceIndex = current.findIndex((group) => group.groupKey === sourceGroupKey);
      const targetIndex = current.findIndex((group) => group.groupKey === targetGroupKey);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const [source] = current.splice(sourceIndex, 1);
      current.splice(targetIndex, 0, source);
      return current.map((group, index) => ({ ...group, sortOrder: index }));
    });
  };

  const reorderLineWithinOfferGroup = (sourceIndex: number, targetIndex: number, groupKey: string) => {
    if (sourceIndex === targetIndex) return;
    setItems((prev) => {
      const groupIndexes = prev
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => String(item.offerGroupKey || 'group-a') === groupKey)
        .map(({ index }) => index);
      const sourcePosition = groupIndexes.indexOf(sourceIndex);
      const targetPosition = groupIndexes.indexOf(targetIndex);
      if (sourcePosition < 0 || targetPosition < 0) return prev;

      const groupItems = groupIndexes.map((index) => prev[index]);
      const [moved] = groupItems.splice(sourcePosition, 1);
      groupItems.splice(targetPosition, 0, moved);

      let nextGroupItemIndex = 0;
      const next = prev.map((item, index) => {
        if (!groupIndexes.includes(index)) return item;
        const groupItem = groupItems[nextGroupItemIndex];
        nextGroupItemIndex += 1;
        return groupItem;
      });

      return next;
    });
    markOfferGroupDirty(groupKey);
  };

  const computeVatForOfferGroup = (groupKey: string) => {
    const group = offerWorkspace.offerGroups.find((entry) => entry.groupKey === groupKey);
    if (!group?.validation.canComputeVat) return;
    setOfferGroups((prev) =>
      prev.map((entry) =>
        entry.groupKey === groupKey
          ? {
              ...entry,
              vatComputed: true,
              totalComputed: false,
            }
          : entry,
      ),
    );
  };

  const computeTotalForOfferGroup = (groupKey: string) => {
    const group = offerWorkspace.offerGroups.find((entry) => entry.groupKey === groupKey);
    if (!group?.validation.canComputeTotal) return;
    setOfferGroups((prev) =>
      prev.map((entry) =>
        entry.groupKey === groupKey
          ? {
              ...entry,
              totalComputed: true,
            }
          : entry,
      ),
    );
  };

  const handleSalespersonSelect = (id: string) => {
    const user = users.find((entry) => String(entry.id) === String(id));
    if (user) {
      setSalesperson(user.fullName);
      setSalespersonPhone(user.phone || '');
      return;
    }

    const salespersonEntry = salespersons.find((entry) => String(entry.id) === String(id));
    if (salespersonEntry) {
      setSalesperson(salespersonEntry.name);
      setSalespersonPhone(salespersonEntry.phone || '');
    }
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
    } catch (error: any) {
      showNotify(`Xuất PDF thất bại: ${error.message}`, 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const saveQuotation = async (options: SaveQuotationOptions = {}) => {
    const { status = editingQuoteId ? quoteStatus || 'draft' : 'draft', exportPdf = false } = options;
    const guard = buildSaveQuotationGuard({ selectedAccId, lineItems: items });
    if (!guard.canSave && guard.notifyMessage) {
      showNotify(guard.notifyMessage, 'error');
      return;
    }

    setSavingQuote(true);
    const serializedLineItems = serializeQuotationLineItemsByOfferGroups(items, offerGroups);
    const headerSummary =
      offerWorkspace.offerGroups.length === 1 && offerWorkspace.offerGroups[0]?.totalComputed
        ? offerWorkspace.offerGroups[0].summary
        : null;
    const normalizedFin = {
      ...fin,
      vatRate: normalizeVatRate(fin.vatRate),
      calculateTotals: offerGroups.some((group) => group.totalComputed),
    };

    const body = {
      quoteNumber: quoteNumber || `QT-${Date.now().toString().slice(-6)}`,
      quoteDate,
      projectId: editingQuoteId ? linkedProjectId || null : null,
      autoCreateProject: false,
      subject,
      accountId: selectedAccId,
      contactId: resolveSubmissionContactId({ selectedAccId, selectedContactId, contacts }),
      salesperson,
      salespersonPhone,
      currency,
      offerGroups: offerGroups.map((group, index) => ({
        id: group.id || null,
        groupKey: group.groupKey,
        label: group.label || '',
        currency: group.currency || currency,
        vatComputed: group.vatComputed === true,
        totalComputed: group.totalComputed === true,
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
      })),
      lineItems: serializedLineItems.map((item) => ({
        id: item.id || null,
        sortOrder: Number(item.sortOrder || 0),
        sku: item.sku,
        name: item.name,
        quantity: parseNumberInput(item.quantity || 1),
        unitPrice: parseNumberInput(item.unitPrice || 0),
        unit: item.unit,
        currency: item.currency || currency,
        vatMode: item.vatMode === 'gross' ? 'gross' : 'net',
        vatRate: normalizeVatRate(item.vatRate, normalizedFin.vatRate),
        technicalSpecs: item.technicalSpecs,
        remarks: item.remarks,
        isOption: item.isOption === true,
        offerGroupKey: item.offerGroupKey || 'group-a',
      })),
      financialConfig: normalizedFin,
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
      subtotal: headerSummary?.netSubtotal || 0,
      taxTotal: headerSummary?.vatTotal || 0,
      grandTotal: headerSummary?.grossTotal || 0,
      status,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      let savedQuote;
      if (editingQuoteId) {
        const res = await fetchWithAuth(token, `${API}/v1/quotations/${editingQuoteId}`, withIdempotencyKey({
          method: 'PUT',
          body: JSON.stringify(body),
        }, createIdempotencyKey(`quotation-update:${editingQuoteId}`)));
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Cập nhật báo giá thất bại');
        }
        savedQuote = await res.json();
      } else {
        const res = await fetchWithAuth(token, `${API}/v1/quotations`, withIdempotencyKey({
          method: 'POST',
          body: JSON.stringify(body),
        }, createIdempotencyKey('quotation-create')));
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Tạo báo giá thất bại');
        }
        savedQuote = await res.json();
      }

      setShowForm(false);
      setEditingQuoteId(null);
      await loadData();
      showNotify('Đã lưu báo giá thành công', 'success');

      if (exportPdf && savedQuote?.id) {
        await downloadQuotationPdf(savedQuote.id, savedQuote.quoteNumber || body.quoteNumber);
      }
    } catch (error: any) {
      showNotify(error.message || 'Không thể lưu báo giá', 'error');
    } finally {
      setSavingQuote(false);
    }
  };

  const deleteQuote = (id: string) => {
    setConfirmState({
      message: 'Xóa báo giá này?',
      onConfirm: async () => {
        setConfirmState(null);
        setQuotations((prev) => prev.filter((quotation) => quotation.id !== id));
        await fetchWithAuth(token, `${API}/quotations/${id}`, { method: 'DELETE' });
      },
    });
  };

  const handleEditQuote = async (quotation: any) => {
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${quotation.id}`);
      const fullQ = await res.json();
      setEditingQuoteId(fullQ.id);
      setQuoteStatus(fullQ.status || 'draft');
      setLinkedProjectId(fullQ.projectId || null);
      setQuoteNumber(fullQ.quoteNumber || '');
      setQuoteDate(
        fullQ.quoteDate
          ? new Date(fullQ.quoteDate).toISOString().slice(0, 10)
          : fullQ.createdAt
            ? new Date(fullQ.createdAt).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
      );
      setSubject(fullQ.subject || '');
      setSelectedAccId(fullQ.accountId || '');
      setSelectedContactId(fullQ.contactId || '');
      setSalesperson(fullQ.salesperson || '');
      setSalespersonPhone(fullQ.salespersonPhone || '');
      setCurrency(fullQ.currency || 'VND');
      const normalizedOfferGroups = normalizeQuotationOfferGroups(
        fullQ.offerGroups,
        fullQ.lineItems,
        fullQ.currency || 'VND',
      );
      setOfferGroups(normalizedOfferGroups);
      setSelectedOfferGroupKey(normalizedOfferGroups[0]?.groupKey || 'group-a');
      setItems(
        normalizeQuotationLineItems(fullQ.lineItems).map((item) => ({
          ...item,
          currency: item.currency || fullQ.currency || 'VND',
          vatMode: item.vatMode === 'gross' ? 'gross' : 'net',
          vatRate: item.vatRate ?? normalizeVatRate(fullQ?.financialConfig?.vatRate, DEFAULT_FINANCIAL_CONFIG.vatRate),
          offerGroupKey: item.offerGroupKey || (item.isOption ? 'group-b' : 'group-a'),
        })),
      );
      setFin({
        interestRate: Number(fullQ?.financialConfig?.interestRate ?? DEFAULT_FINANCIAL_CONFIG.interestRate),
        exchangeRate: Number(fullQ?.financialConfig?.exchangeRate ?? DEFAULT_FINANCIAL_CONFIG.exchangeRate),
        loanTermMonths: Number(fullQ?.financialConfig?.loanTermMonths ?? DEFAULT_FINANCIAL_CONFIG.loanTermMonths),
        markup: Number(fullQ?.financialConfig?.markup ?? DEFAULT_FINANCIAL_CONFIG.markup),
        vatRate: normalizeVatRate(fullQ?.financialConfig?.vatRate, DEFAULT_FINANCIAL_CONFIG.vatRate),
        calculateTotals: normalizeCalculateTotals(
          fullQ?.financialConfig?.calculateTotals,
          DEFAULT_FINANCIAL_CONFIG.calculateTotals,
        ),
      });
      const normalizedTerms = normalizeCommercialTerms(fullQ.commercialTerms);
      if (normalizedTerms.termItems.length > 0 || normalizedTerms.remarks || normalizedTerms.remarksEn) {
        setTerms(normalizedTerms);
      } else {
        setTerms(createNewQuotationTerms());
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
      const res = await fetchWithAuth(token, `${API}/v1/projects/${quotation.projectId}/approval-requests`, withIdempotencyKey({
        method: 'POST',
        body: JSON.stringify({
          quotationId: quotation.id,
          requestType: 'quotation_commercial',
          title: `Quotation approval - ${quotation.quoteNumber || quotation.id}`,
          department: 'Commercial',
          approverRole: 'director',
          note: 'Submitted from quotations list',
        }),
      }, createIdempotencyKey(`quotation-approval:${quotation.id}`)));
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

  useEffect(() => {
    const ctx = consumeNavContext();
    if (ctx?.entityType === 'Quotation' && ctx.entityId) {
      void handleEditQuote({ id: ctx.entityId });
      return;
    }

    const quotationId = localStorage.getItem(OPEN_QUOTE_KEY);
    if (!quotationId) return;
    localStorage.removeItem(OPEN_QUOTE_KEY);
    void handleEditQuote({ id: quotationId });
  }, []);

  if (showForm) {
    return (
      <QuotationEditor
        isMobile={isMobile}
        showProdModal={showProdModal}
        setShowProdModal={setShowProdModal}
        productsDB={productsDB}
        addItem={addItem}
        addManualItem={addManualItem}
        openProductPickerForOfferGroup={openProductPickerForOfferGroup}
        latestUsdVndRate={latestUsdVndRate}
        latestUsdVndWarnings={latestUsdVndWarnings}
        productCatalogError={productCatalogError}
        setShowForm={setShowForm}
        setEditingQuoteId={setEditingQuoteId}
        quoteStatus={quoteStatus}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        quoteNumber={quoteNumber}
        setQuoteNumber={setQuoteNumber}
        quoteDate={quoteDate}
        setQuoteDate={setQuoteDate}
        subject={subject}
        setSubject={setSubject}
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
        updateItem={updateItem}
        removeItemAt={removeItemAt}
        selectedOfferGroupKey={selectedOfferGroupKey}
        setSelectedOfferGroupKey={setSelectedOfferGroupKey}
        addOfferGroup={addOfferGroup}
        updateOfferGroup={updateOfferGroup}
        removeOfferGroup={removeOfferGroup}
        reorderOfferGroups={reorderOfferGroups}
        reorderLineWithinOfferGroup={reorderLineWithinOfferGroup}
        computeVatForOfferGroup={computeVatForOfferGroup}
        computeTotalForOfferGroup={computeTotalForOfferGroup}
        offerWorkspace={offerWorkspace}
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
        editingQuoteId={editingQuoteId}
        saveQuotation={saveQuotation}
        savingQuote={savingQuote}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <PageHero
        eyebrow="Revenue flow"
        title={t('sales.quotations.title')}
        description={t('sales.quotations.subtitle')}
        actions={userCanEdit ? [
          {
            key: 'create-quotation',
            label: t('sales.quotations.action.create'),
            onClick: handleCreateNew,
            variant: 'primary' as const,
          },
        ] : undefined}
      />

      <div style={ui.page.metricGrid}>
        <MetricCard label="Tổng báo giá" value={listMetrics.totalCount} accent={tokens.colors.primary} hint="Tổng quotation đang hiện diện trong pipeline hiện tại." />
        <MetricCard label="Chờ duyệt thương mại" value={listMetrics.pendingApprovalCount} accent={tokens.colors.warningDark} hint="Quotation đang nằm tại cổng phê duyệt thương mại." />
        <MetricCard label="Cần follow-up" value={listMetrics.reminderCount} accent={tokens.colors.info} hint="Quotation được đánh dấu cần nhắc việc hoặc follow-up tiếp theo." />
        <MetricCard label="Đã thắng" value={listMetrics.wonCount} accent={tokens.colors.success} hint="Quotation đã chốt thắng và sẵn sàng bàn giao bước tiếp theo." />
      </div>

      <div style={{ ...S.card, overflowX: 'auto', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? (
          <div
            style={{
              padding: '80px',
              textAlign: 'center',
              color: tokens.colors.textMuted,
              fontSize: '15px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <LoaderIcon size={16} /> Đang tải dữ liệu...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.colors.background }}>
                {['Số báo giá', 'Nội dung', 'Khách hàng', 'Ngày báo giá', 'Trạng thái', 'Duyệt / nhắc việc', ''].map((header) => (
                  <th key={header} style={S.thStatic}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted }}>
                    Bắt đầu bằng cách nhấn "Tạo Báo giá Mới"
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => {
                  const quoteStatusMeta = getQuotationStatusMeta(quotation.status);
                  const approvalMeta = getApprovalStateMeta(quotation.approvalGateState?.status);
                  const showReminder = quotation.isRemind === true;
                  const actions = quotation.actionAvailability || {};
                  return (
                    <tr
                      key={quotation.id}
                      style={{ ...ui.table.row }}
                      onMouseEnter={(event: any) => {
                        event.currentTarget.style.background = tokens.colors.background;
                      }}
                      onMouseLeave={(event: any) => {
                        event.currentTarget.style.background = '';
                      }}
                    >
                      <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary }}>{quotation.quoteNumber}</td>
                      <td
                        style={{
                          ...S.td,
                          maxWidth: '280px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: tokens.colors.textMuted,
                          fontSize: '12px',
                        }}
                      >
                        {quotation.subject || '—'}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{quotation.accountName || quotation.accountId}</td>
                      <td style={S.td}>
                        {new Date(quotation.quoteDate || quotation.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={S.td}>
                        <span style={quoteStatusMeta.style}>{quoteStatusMeta.label}</span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'grid', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={approvalMeta.style}>{approvalMeta.label}</span>
                            {showReminder ? <span style={ui.badge.warning}>Cần follow-up</span> : null}
                          </div>
                          {ensureArray(quotation.approvalGateState?.pendingApprovers).slice(0, 1).map((approver) => (
                            <div key={`${quotation.id}-${approver.approvalId || approver.approverRole || 'approver'}`} style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                              Người duyệt: {approver.approverName || approver.approverRole || 'Pending approver'}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...S.td, display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {actions.canRequestCommercialApproval && (
                          <button
                            onClick={() => requestCommercialApproval(quotation)}
                            style={{ ...S.btnGhost, color: tokens.colors.warningDark, fontWeight: 700 }}
                          >
                            Gửi duyệt
                          </button>
                        )}
                        <button
                          onClick={() => handleEditQuote(quotation)}
                          style={{ ...S.btnGhost, color: tokens.colors.info, fontWeight: 700 }}
                        >
                          <EyeIcon size={14} />
                        </button>
                        <button
                          onClick={() => downloadQuotationPdf(quotation.id, quotation.quoteNumber || undefined)}
                          disabled={downloadingPdfId === quotation.id}
                          style={{
                            border: `1px solid ${tokens.colors.primary}`,
                            color: tokens.colors.primary,
                            background: 'none',
                            padding: `5px ${tokens.spacing.md}`,
                            borderRadius: tokens.radius.md,
                            cursor: downloadingPdfId === quotation.id ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            fontWeight: 800,
                            opacity: downloadingPdfId === quotation.id ? 0.6 : 1,
                          }}
                        >
                          {downloadingPdfId === quotation.id ? '...' : 'PDF'}
                        </button>
                        {userCanDelete && (
                          <button
                            onClick={() => {
                              if (actions.canDelete !== false) deleteQuote(quotation.id);
                            }}
                            disabled={actions.canDelete === false}
                            style={{
                              ...S.btnGhost,
                              color: tokens.colors.error,
                              fontWeight: 700,
                              opacity: actions.canDelete === false ? 0.5 : 1,
                              cursor: actions.canDelete === false ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
