import { useMemo, useState } from 'preact/hooks';
import { PageHeader } from '../ui/PageHeader';
import { tokens } from '../ui/tokens';
import { EyeIcon, NoteIcon, QuoteIcon } from '../ui/icons';
import { FormField, ProductModal } from './QuotationComponents';
import { QuotationActionButtons, QuotationPreviewPanel } from './QuotationPreviewBlocks';
import {
  CURRENCIES,
  UNITS,
  computeLineItemPricing,
  formatCurrencyValue,
  hasQbuStaleWarning,
  hasRateIncreaseWarning,
  hasSnapshotMissingWarning,
  isReadOnlyQuotationStatus,
  quotationStyles,
} from './quotationShared';
import { getOfferGroupFallbackLabel } from './quotationOfferGroups';

const S = quotationStyles;

type SaveQuotationOptions = {
  status?: string;
  exportPdf?: boolean;
};

export type QuotationEditorProps = {
  isMobile?: boolean;
  showProdModal: boolean;
  setShowProdModal: (value: boolean) => void;
  productsDB: any[];
  addItem: (product: any) => void;
  addManualItem: (groupKey?: string) => void;
  openProductPickerForOfferGroup: (groupKey: string) => void;
  latestUsdVndRate: number | null;
  latestUsdVndWarnings: string[];
  productCatalogError: string;
  setShowForm: (value: boolean) => void;
  setEditingQuoteId: (value: string | null) => void;
  quoteStatus: string;
  mobileTab: 'form' | 'preview';
  setMobileTab: (value: 'form' | 'preview') => void;
  quoteNumber: string;
  setQuoteNumber: (value: string) => void;
  quoteDate: string;
  setQuoteDate: (value: string) => void;
  subject: string;
  setSubject: (value: string) => void;
  accounts: any[];
  selectedAccId: string;
  setSelectedAccId: (value: string) => void;
  setSelectedContactId: (value: string) => void;
  selectedAcc: any;
  accContacts: any[];
  selectedContactId: string;
  userDirectoryError: string;
  handleSalespersonSelect: (value: string) => void;
  users: any[];
  salespersons: any[];
  salesperson: string;
  setSalesperson: (value: string) => void;
  salespersonPhone: string;
  setSalespersonPhone: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  items: any[];
  updateItem: (index: number, field: string, value: any) => void;
  removeItemAt: (index: number) => void;
  selectedOfferGroupKey: string;
  setSelectedOfferGroupKey: (value: string) => void;
  addOfferGroup: () => void;
  updateOfferGroup: (groupKey: string, patch: any) => void;
  removeOfferGroup: (groupKey: string) => void;
  reorderOfferGroups: (sourceGroupKey: string, targetGroupKey: string) => void;
  reorderLineWithinOfferGroup: (sourceIndex: number, targetIndex: number, groupKey: string) => void;
  computeVatForOfferGroup: (groupKey: string) => void;
  computeTotalForOfferGroup: (groupKey: string) => void;
  offerWorkspace: {
    offerGroups: Array<{
      groupKey: string;
      label?: string | null;
      displayLabel?: string;
      currency: string;
      items: any[];
      vatComputed: boolean;
      totalComputed: boolean;
      validation: {
        primaryError: string | null;
        canComputeVat: boolean;
        canComputeTotal: boolean;
      };
      summary: {
        currency: string;
        netSubtotal: number;
        vatTotal: number;
        grossTotal: number;
      } | null;
    }>;
  };
  handleTranslate: () => Promise<void>;
  translating: boolean;
  terms: any;
  setTerms: (value: any) => void;
  previewZoom: number;
  setPreviewZoom: (value: number) => void;
  previewScale: number;
  previewContentHeight: number;
  previewPageCount: number;
  previewA4Ref: any;
  getContactDisplayName: (contact: any) => string;
  selectedContact: any;
  editingQuoteId: string | null;
  saveQuotation: (options?: SaveQuotationOptions) => Promise<void>;
  savingQuote: boolean;
};

function getVatModeLabel(mode: unknown) {
  return String(mode || '').trim().toLowerCase() === 'gross' ? 'Gross' : 'NET';
}

function badgeStyle(kind: 'selected' | 'warn' | 'error' | 'neutral') {
  if (kind === 'selected') return { ...S.btnGhost, padding: '2px 8px', background: tokens.colors.infoBg, color: tokens.colors.infoText, borderRadius: '999px', border: `1px solid ${tokens.colors.border}` };
  if (kind === 'warn') return { ...S.btnGhost, padding: '2px 8px', background: tokens.colors.warningBg, color: tokens.colors.warningText, borderRadius: '999px', border: `1px solid ${tokens.colors.border}` };
  if (kind === 'error') return { ...S.btnGhost, padding: '2px 8px', background: tokens.colors.badgeBgError, color: tokens.colors.error, borderRadius: '999px', border: `1px solid ${tokens.colors.border}` };
  return { ...S.btnGhost, padding: '2px 8px', background: tokens.colors.surfaceSubtle, color: tokens.colors.textMuted, borderRadius: '999px', border: `1px solid ${tokens.colors.border}` };
}

export function QuotationEditor(props: QuotationEditorProps) {
  const {
    isMobile,
    showProdModal,
    setShowProdModal,
    productsDB,
    addItem,
    addManualItem,
    openProductPickerForOfferGroup,
    latestUsdVndRate,
    latestUsdVndWarnings,
    productCatalogError,
    setShowForm,
    setEditingQuoteId,
    quoteStatus,
    mobileTab,
    setMobileTab,
    quoteNumber,
    setQuoteNumber,
    quoteDate,
    setQuoteDate,
    subject,
    setSubject,
    accounts,
    selectedAccId,
    setSelectedAccId,
    setSelectedContactId,
    selectedAcc,
    accContacts,
    selectedContactId,
    userDirectoryError,
    handleSalespersonSelect,
    users,
    salespersons,
    salesperson,
    setSalesperson,
    salespersonPhone,
    setSalespersonPhone,
    currency,
    setCurrency,
    items,
    updateItem,
    removeItemAt,
    selectedOfferGroupKey,
    setSelectedOfferGroupKey,
    addOfferGroup,
    updateOfferGroup,
    removeOfferGroup,
    reorderOfferGroups,
    reorderLineWithinOfferGroup,
    computeVatForOfferGroup,
    computeTotalForOfferGroup,
    offerWorkspace,
    handleTranslate,
    translating,
    terms,
    setTerms,
    previewZoom,
    setPreviewZoom,
    previewScale,
    previewContentHeight,
    previewPageCount,
    previewA4Ref,
    getContactDisplayName,
    selectedContact,
    editingQuoteId,
    saveQuotation,
    savingQuote,
  } = props;

  const isReadOnly = isReadOnlyQuotationStatus(quoteStatus);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [draggedOfferGroupKey, setDraggedOfferGroupKey] = useState<string | null>(null);
  const [draggedLine, setDraggedLine] = useState<{ index: number; groupKey: string } | null>(null);
  const selectedOffer =
    offerWorkspace.offerGroups.find((group) => group.groupKey === selectedOfferGroupKey) ||
    offerWorkspace.offerGroups[0] ||
    null;
  const compactLineColumns = '80px minmax(170px, 1fr) 72px 64px 82px 128px 104px 76px 120px 44px';

  const groupedLineItemIndexes = useMemo(() => {
    return offerWorkspace.offerGroups.reduce<Record<string, Array<{ item: any; index: number }>>>((acc, group) => {
      acc[group.groupKey] = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => String(item.offerGroupKey || 'group-a') === group.groupKey);
      return acc;
    }, {});
  }, [items, offerWorkspace.offerGroups]);

  const mobileTabStyle = (active: boolean) => ({
    flex: 1,
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 800,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.colors.border}`,
    background: active ? tokens.colors.primary : tokens.colors.surface,
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    cursor: 'pointer',
  });

  const renderOfferCard = (group: any, index: number) => {
    const lineEntries = groupedLineItemIndexes[group.groupKey] || [];
    const isSelected = group.groupKey === selectedOfferGroupKey;
    const displayTitle = String(group.label || '').trim();
    const fallbackLabel = getOfferGroupFallbackLabel(index);

    return (
      <section
        key={group.groupKey}
        onDragOver={(event: any) => event.preventDefault()}
        onDrop={(event: any) => {
          event.preventDefault();
          const sourceGroupKey = event.dataTransfer?.getData('text/plain') || draggedOfferGroupKey;
          if (sourceGroupKey) reorderOfferGroups(sourceGroupKey, group.groupKey);
          setDraggedOfferGroupKey(null);
        }}
        onDragEnd={() => setDraggedOfferGroupKey(null)}
        onClick={() => setSelectedOfferGroupKey(group.groupKey)}
        style={{
          ...S.card,
          padding: '18px',
          display: 'grid',
          gap: '14px',
          cursor: 'pointer',
          border: `2px solid ${isSelected ? tokens.colors.primary : tokens.colors.border}`,
          background: isSelected ? tokens.colors.surface : tokens.colors.background,
        }}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '8px', minWidth: 0, flex: '1 1 420px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  draggable
                  title="Kéo để đổi thứ tự phương án"
                  aria-label="Kéo để đổi thứ tự phương án"
                  onClick={(event: any) => event.stopPropagation()}
                  onDragStart={(event: any) => {
                    event.stopPropagation();
                    setDraggedOfferGroupKey(group.groupKey);
                    event.dataTransfer?.setData('text/plain', group.groupKey);
                  }}
                  style={{
                    ...S.btnOutline,
                    padding: '8px 0',
                    justifyContent: 'center',
                    cursor: 'grab',
                    color: tokens.colors.textMuted,
                  }}
                >
                  ⋮⋮
                </button>
                <input
                  type="text"
                  value={group.label || ''}
                  onInput={(event: any) => updateOfferGroup(group.groupKey, { label: event.currentTarget.value })}
                  onClick={(event: any) => event.stopPropagation()}
                  style={{
                    ...S.input,
                    fontSize: '16px',
                    fontWeight: 800,
                    background: tokens.colors.surface,
                  }}
                  placeholder=""
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isSelected ? <span style={badgeStyle('selected')}>Đang chọn</span> : null}
                <span style={badgeStyle('neutral')}>{lineEntries.length} dòng</span>
                {!group.vatComputed ? <span style={badgeStyle('warn')}>Chưa tính VAT</span> : null}
                {!group.totalComputed ? <span style={badgeStyle('warn')}>Chưa tính tổng</span> : null}
                {group.validation.primaryError ? <span style={badgeStyle('error')}>Không thể tính</span> : null}
                {!displayTitle ? <span style={badgeStyle('neutral')}>{fallbackLabel}</span> : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={(event: any) => {
                  event.stopPropagation();
                  setSelectedOfferGroupKey(group.groupKey);
                }}
                style={{ ...S.btnOutline, padding: '8px 12px' }}
              >
                Chọn
              </button>
              <button
                type="button"
                onClick={(event: any) => {
                  event.stopPropagation();
                  removeOfferGroup(group.groupKey);
                }}
                style={{ ...S.btnGhost, color: tokens.colors.error, padding: '8px 12px' }}
              >
                Xóa phương án
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
              Chọn phương án để dùng `Tính VAT` và `Tính tổng` ở dock dưới cùng. Tiền tệ, NET/Gross và VAT % chỉnh trực tiếp trên từng dòng.
            </div>
            {group.validation.primaryError ? (
              <div style={{ ...S.label, color: tokens.colors.error, fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>
                {group.validation.primaryError}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: isMobile ? '100%' : '980px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `32px ${compactLineColumns}`, gap: '8px', marginBottom: '10px' }}>
              {['', 'Mã hàng', 'Tên hàng', 'ĐVT', 'SL', 'Tiền tệ', 'Đơn giá', 'VAT mode', 'VAT %', 'Thành tiền', ''].map((header) => (
                <div key={header} style={{ ...S.label, marginBottom: 0 }}>{header}</div>
              ))}
            </div>
            {lineEntries.length === 0 ? (
              <div
                style={{
                  minHeight: '84px',
                  border: `1px dashed ${tokens.colors.border}`,
                  borderRadius: tokens.radius.lg,
                  background: tokens.colors.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.colors.textMuted,
                  fontSize: '13px',
                }}
              >
                Phương án này chưa có dòng sản phẩm.
              </div>
            ) : (
              lineEntries.map(({ item, index: itemIndex }) => {
                const pricing = computeLineItemPricing(item);
                const isLineSelected = selectedLineIndex === itemIndex;
                const showVatRate = String(item.vatMode || '').toLowerCase() !== 'gross';
                return (
                  <div
                    key={`${item.id || item.sku || 'item'}-${itemIndex}`}
                    onClick={(event: any) => {
                      event.stopPropagation();
                      setSelectedLineIndex((current) => (current === itemIndex ? null : itemIndex));
                      setSelectedOfferGroupKey(group.groupKey);
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px minmax(0, 1fr)',
                      gap: '8px',
                      marginBottom: '10px',
                      alignItems: 'stretch',
                      padding: '8px 8px 8px 10px',
                      borderRadius: tokens.radius.lg,
                      borderLeft: `4px solid ${isLineSelected ? tokens.colors.primary : 'transparent'}`,
                      background: isLineSelected ? tokens.colors.surfaceSubtle : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      draggable
                      title="Kéo để đổi thứ tự dòng trong phương án"
                      aria-label="Kéo để đổi thứ tự dòng trong phương án"
                      onClick={(event: any) => event.stopPropagation()}
                      onDragStart={(event: any) => {
                        event.stopPropagation();
                        setDraggedLine({ index: itemIndex, groupKey: group.groupKey });
                        event.dataTransfer?.setData('text/plain', String(itemIndex));
                      }}
                      style={{ ...S.btnOutline, padding: '8px 0', justifyContent: 'center', cursor: 'grab', height: '100%', color: tokens.colors.textMuted }}
                    >
                      ⋮
                    </button>
                    <div style={{ display: 'grid', gap: isLineSelected ? '10px' : 0 }}>
                      <div
                        onDragOver={(event: any) => event.preventDefault()}
                        onDrop={(event: any) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const sourceIndex = Number(event.dataTransfer?.getData('text/plain') || draggedLine?.index);
                          if (Number.isFinite(sourceIndex)) {
                            reorderLineWithinOfferGroup(sourceIndex, itemIndex, group.groupKey);
                            setSelectedLineIndex(itemIndex);
                          }
                          setDraggedLine(null);
                        }}
                        onDragEnd={() => setDraggedLine(null)}
                        style={{ display: 'grid', gridTemplateColumns: compactLineColumns, gap: '8px', alignItems: 'start' }}
                      >
                        <input type="text" value={item.sku || ''} onClick={(event: any) => event.stopPropagation()} onInput={(event: any) => updateItem(itemIndex, 'sku', event.currentTarget.value)} style={{ ...S.input, paddingLeft: '8px', paddingRight: '8px' }} />
                        <input type="text" value={item.name || ''} onClick={(event: any) => event.stopPropagation()} onInput={(event: any) => updateItem(itemIndex, 'name', event.currentTarget.value)} style={{ ...S.input, paddingLeft: '8px', paddingRight: '8px' }} />
                        <select style={{ ...S.select, paddingLeft: '8px', paddingRight: '8px' }} value={item.unit || 'Chiếc'} onClick={(event: any) => event.stopPropagation()} onChange={(event: any) => updateItem(itemIndex, 'unit', event.target.value)}>
                          {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                        <input type="number" min="0" step="0.01" value={item.quantity} onClick={(event: any) => event.stopPropagation()} onInput={(event: any) => updateItem(itemIndex, 'quantity', event.currentTarget.value)} style={{ ...S.input, paddingLeft: '8px', paddingRight: '8px' }} />
                        <select style={{ ...S.select, paddingLeft: '8px', paddingRight: '8px' }} value={item.currency || group.currency} onClick={(event: any) => event.stopPropagation()} onChange={(event: any) => updateItem(itemIndex, 'currency', event.target.value)}>
                          {CURRENCIES.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input type="number" step={(item.currency || group.currency) === 'VND' ? '1' : '0.01'} value={item.unitPrice} onClick={(event: any) => event.stopPropagation()} onInput={(event: any) => updateItem(itemIndex, 'unitPrice', event.currentTarget.value)} style={{ ...S.input, paddingLeft: '8px', paddingRight: '8px' }} />
                        <div onClick={(event: any) => event.stopPropagation()} style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                          {(['net', 'gross'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={(event: any) => {
                                event.stopPropagation();
                                updateItem(itemIndex, 'vatMode', mode);
                              }}
                              style={{
                                ...(item.vatMode === mode ? S.btnPrimary : S.btnOutline),
                                padding: '8px',
                                fontSize: '12px',
                              }}
                            >
                              {getVatModeLabel(mode)}
                            </button>
                          ))}
                        </div>
                        {showVatRate ? (
                          <input type="number" min="0" step="0.1" value={item.vatRate ?? ''} onClick={(event: any) => event.stopPropagation()} onInput={(event: any) => updateItem(itemIndex, 'vatRate', event.currentTarget.value)} style={{ ...S.input, paddingLeft: '8px', paddingRight: '8px' }} />
                        ) : (
                          <div style={{ ...S.input, display: 'flex', alignItems: 'center', background: tokens.colors.surfaceSubtle, color: tokens.colors.textMuted, justifyContent: 'center', paddingLeft: '8px', paddingRight: '8px' }}>
                            —
                          </div>
                        )}
                        <div style={{ ...S.input, display: 'flex', alignItems: 'center', background: tokens.colors.surfaceSubtle, paddingLeft: '8px', paddingRight: '8px' }}>
                          {pricing ? `${formatCurrencyValue(pricing.grossTotal, pricing.currency)} ${pricing.currency}` : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={(event: any) => {
                            event.stopPropagation();
                            removeItemAt(itemIndex);
                            setSelectedLineIndex((current) => (current === itemIndex ? null : current != null && current > itemIndex ? current - 1 : current));
                          }}
                          style={{ ...S.btnGhost, color: tokens.colors.error, justifyContent: 'center', padding: '10px 0' }}
                        >
                          ×
                        </button>
                      </div>
                      {isLineSelected ? (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 280px', gap: '16px', alignItems: 'start', padding: '12px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}>
                          <div style={{ display: 'grid', gap: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Chi tiết dòng đang chọn</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {hasRateIncreaseWarning(latestUsdVndRate, item.qbuRateValue) ? <span style={badgeStyle('error')}>Tỷ giá +2.5%</span> : null}
                              {hasQbuStaleWarning(item.qbuUpdatedAt) ? <span style={badgeStyle('warn')}>QBU quá 6 tháng</span> : null}
                              {hasSnapshotMissingWarning(item.qbuUpdatedAt, item.qbuRateValue, item.qbuRateDate) ? <span style={badgeStyle('neutral')}>Snapshot missing</span> : null}
                              {latestUsdVndWarnings.includes('RATE_MISSING') ? <span style={badgeStyle('neutral')}>Chưa có tỷ giá VCB</span> : null}
                            </div>
                            <FormField label="Thông số kỹ thuật / Technical specs">
                              <textarea
                                rows={5}
                                value={item.technicalSpecs || ''}
                              onClick={(event: any) => event.stopPropagation()}
                              onInput={(event: any) => updateItem(itemIndex, 'technicalSpecs', event.currentTarget.value)}
                                style={{ ...S.input, resize: 'vertical' }}
                                placeholder="- Nhãn hiệu&#10;- Model&#10;- Xuất xứ"
                              />
                            </FormField>
                            <FormField label="Ghi chú / Remarks">
                              <textarea
                                rows={3}
                                value={item.remarks || ''}
                              onClick={(event: any) => event.stopPropagation()}
                              onInput={(event: any) => updateItem(itemIndex, 'remarks', event.currentTarget.value)}
                                style={{ ...S.input, resize: 'vertical' }}
                                placeholder="Ghi chú đặc biệt cho dòng sản phẩm này..."
                              />
                            </FormField>
                          </div>
                          <div style={{ display: 'grid', gap: '8px', padding: '14px 16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surfaceSubtle }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>Preview tính dòng</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px' }}>
                              <span style={{ color: tokens.colors.textSecondary }}>NET</span>
                              <strong>{formatCurrencyValue(pricing.netTotal, pricing.currency)} {pricing.currency}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px' }}>
                              <span style={{ color: tokens.colors.textSecondary }}>VAT</span>
                              <strong>{formatCurrencyValue(pricing.vatTotal, pricing.currency)} {pricing.currency}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '14px' }}>
                              <span style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>Gross</span>
                              <strong>{formatCurrencyValue(pricing.grossTotal, pricing.currency)} {pricing.currency}</strong>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={(event: any) => {
              event.stopPropagation();
              openProductPickerForOfferGroup(group.groupKey);
            }}
            style={{ ...S.btnOutline, color: tokens.colors.info, borderColor: tokens.colors.info, padding: '8px 12px' }}
          >
            + Sản phẩm
          </button>
          <button
            type="button"
            onClick={(event: any) => {
              event.stopPropagation();
              addManualItem(group.groupKey);
            }}
            style={{ ...S.btnOutline, color: tokens.colors.success, borderColor: tokens.colors.success, padding: '8px 12px' }}
          >
            + Line
          </button>
        </div>
      </section>
    );
  };

  const offerActionDock = selectedOffer ? (
    <div
      style={{
        position: isMobile ? 'relative' : 'sticky',
        bottom: 0,
        zIndex: tokens.zIndex.sticky,
        background: tokens.surface.shellChromeRaised,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.xl,
        boxShadow: tokens.shadow.md,
        padding: '16px',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          {selectedOffer.displayLabel ? (
            <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{selectedOffer.displayLabel}</div>
          ) : null}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={badgeStyle('selected')}>Đang chọn</span>
            <span style={badgeStyle('neutral')}>{selectedOffer.currency}</span>
            <span style={badgeStyle('neutral')}>{selectedOffer.items.length} dòng</span>
            {!selectedOffer.vatComputed ? <span style={badgeStyle('warn')}>Chưa tính VAT</span> : null}
            {!selectedOffer.totalComputed ? <span style={badgeStyle('warn')}>Chưa tính tổng</span> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!selectedOffer.validation.canComputeVat}
            onClick={() => computeVatForOfferGroup(selectedOffer.groupKey)}
            style={{
              ...(selectedOffer.validation.canComputeVat ? S.btnPrimary : S.btnOutline),
              opacity: selectedOffer.validation.canComputeVat ? 1 : 0.6,
              cursor: selectedOffer.validation.canComputeVat ? 'pointer' : 'not-allowed',
            }}
          >
            {selectedOffer.vatComputed ? 'Đã tính VAT' : 'Tính VAT'}
          </button>
          <button
            type="button"
            disabled={!selectedOffer.validation.canComputeTotal}
            onClick={() => computeTotalForOfferGroup(selectedOffer.groupKey)}
            style={{
              ...(selectedOffer.validation.canComputeTotal ? S.btnPrimary : S.btnOutline),
              opacity: selectedOffer.validation.canComputeTotal ? 1 : 0.6,
              cursor: selectedOffer.validation.canComputeTotal ? 'pointer' : 'not-allowed',
            }}
          >
            {selectedOffer.totalComputed ? 'Đã tính tổng' : 'Tính tổng'}
          </button>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: selectedOffer.validation.primaryError ? tokens.colors.error : tokens.colors.textSecondary }}>
        {selectedOffer.items.length === 0
          ? 'Thêm dòng sản phẩm vào phương án này để bắt đầu.'
          : selectedOffer.validation.primaryError
            ? selectedOffer.validation.primaryError
            : !selectedOffer.vatComputed
              ? 'Bấm [Tính VAT] để xác nhận VAT cho phương án này.'
              : !selectedOffer.totalComputed
                ? 'Bấm [Tính tổng] để chốt tổng thanh toán của phương án.'
                : '✓ Phương án đã chốt. Xem tổng ở preview bên phải.'}
      </div>
    </div>
  ) : null;

  const termsSection = (
    <div style={{ ...S.card, padding: '24px', minWidth: 0 }}>
      <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        4. Điều khoản & ghi chú song ngữ
        <button
          onClick={handleTranslate}
          style={{ ...S.btnOutline, color: tokens.colors.warning, borderColor: tokens.colors.warning, padding: '4px 12px', fontSize: '13px' }}
          disabled={translating}
        >
          {translating ? 'Đang dịch...' : 'Dịch AI VI -> EN'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '18px' }}>
        <FormField label="Ghi chú chung (VI)">
          <textarea rows={6} value={terms.remarks || ''} onInput={(event: any) => setTerms({ ...terms, remarks: event.currentTarget.value })} style={{ ...S.input, minHeight: '168px', resize: 'vertical' }} />
        </FormField>
        <FormField label="General remarks (EN)">
          <textarea rows={6} value={terms.remarksEn || ''} onInput={(event: any) => setTerms({ ...terms, remarksEn: event.currentTarget.value })} style={{ ...S.input, minHeight: '168px', resize: 'vertical' }} />
        </FormField>
      </div>

      <div style={{ display: 'grid', gap: '16px', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        {(terms.termItems || []).map((item: any, idx: number) => (
          <div key={idx} style={{ background: tokens.colors.surface, padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button type="button" onClick={() => {
                const nextTerms = terms.termItems.filter((_: any, termIndex: number) => termIndex !== idx);
                setTerms({ ...terms, termItems: nextTerms });
              }} style={{ ...S.btnGhost, color: tokens.colors.error, padding: '8px 12px' }}>
                Xóa
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', alignItems: 'stretch' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <FormField label="Tên điều khoản (VI)">
                  <input type="text" value={item.labelViPrint || ''} onInput={(event: any) => {
                    const nextTerms = [...terms.termItems];
                    nextTerms[idx].labelViPrint = event.currentTarget.value;
                    setTerms({ ...terms, termItems: nextTerms });
                  }} style={S.input} />
                </FormField>
                <FormField label="Nội dung (VI)">
                  <textarea rows={5} value={item.textVi || ''} onInput={(event: any) => {
                    const nextTerms = [...terms.termItems];
                    nextTerms[idx].textVi = event.currentTarget.value;
                    setTerms({ ...terms, termItems: nextTerms });
                  }} style={{ ...S.input, minHeight: '140px', resize: 'vertical' }} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <FormField label="Term label (EN)">
                  <input type="text" value={item.labelEn || ''} onInput={(event: any) => {
                    const nextTerms = [...terms.termItems];
                    nextTerms[idx].labelEn = event.currentTarget.value;
                    setTerms({ ...terms, termItems: nextTerms });
                  }} style={S.input} />
                </FormField>
                <FormField label="Term content (EN)">
                  <textarea rows={5} value={item.textEn || ''} onInput={(event: any) => {
                    const nextTerms = [...terms.termItems];
                    nextTerms[idx].textEn = event.currentTarget.value;
                    setTerms({ ...terms, termItems: nextTerms });
                  }} style={{ ...S.input, minHeight: '140px', resize: 'vertical' }} />
                </FormField>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setTerms({
              ...terms,
              termItems: [
                ...(terms.termItems || []),
                { labelViPrint: '', labelEn: '', textVi: '', textEn: '' },
              ],
            })
          }
          style={{
            ...S.btnOutline,
            width: '100%',
            borderColor: tokens.colors.success,
            color: tokens.colors.success,
            justifyContent: 'center',
          }}
        >
          + Thêm điều khoản
        </button>
      </div>
    </div>
  );

  const formPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
      <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '20px' }}>
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>0. Tiêu đề & Ngày báo giá</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <FormField label="Số báo giá (Nhập thủ công)">
              <input type="text" placeholder="VD: 059-26/BG/LD-PEQ-CHP" style={S.input} value={quoteNumber} onInput={(event: any) => setQuoteNumber(event.currentTarget.value)} />
            </FormField>
            <FormField label="Ngày báo giá">
              <input type="date" style={S.input} value={quoteDate} onInput={(event: any) => setQuoteDate(event.currentTarget.value)} />
            </FormField>
            <FormField label="Subject / Nội dung báo giá" span={2}>
              <input type="text" placeholder="VD: Báo giá xe nâng Reach Stacker cho Cảng Hải Phòng" style={S.input} value={subject} onInput={(event: any) => setSubject(event.currentTarget.value)} />
            </FormField>
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>1. Thông tin khách hàng</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <FormField label="Chọn account (Công ty / Cảng)" span={2}>
              <select style={S.select} value={selectedAccId} onChange={(event: any) => {
                setSelectedAccId(event.target.value);
                setSelectedContactId('');
              }}>
                <option value="">-- Chọn khách hàng --</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.companyName}</option>)}
              </select>
            </FormField>
            {selectedAcc ? (
              <div
                style={{
                  gridColumn: '1/-1',
                  background: tokens.colors.background,
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: tokens.colors.textSecondary,
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '4px',
                  border: `1px solid ${tokens.colors.border}`,
                }}
              >
                <span>{selectedAcc.address || 'Chưa có địa chỉ'}</span>
                <span>MST: {selectedAcc.taxCode || '—'}</span>
              </div>
            ) : null}
            <FormField label="Người liên hệ (Contact)" span={2}>
              <select style={S.select} value={selectedContactId} onChange={(event: any) => setSelectedContactId(event.target.value)} disabled={!selectedAccId}>
                <option value="">-- Chọn người liên hệ --</option>
                {accContacts.map((contact: any) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName || contact.fullName} {contact.department ? `(${contact.department})` : ''}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>2. Thông tin sales / NV phụ trách</div>
          {userDirectoryError ? (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, fontSize: '12px', color: tokens.colors.textSecondary }}>
              {userDirectoryError}
            </div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <FormField label="Chọn từ danh sách nhân viên" span={2}>
              <select style={S.select} onChange={(event: any) => handleSalespersonSelect(event.target.value)}>
                <option value="">-- Chọn nhân viên phụ trách --</option>
                {users.length > 0 ? (
                  <optgroup label="Nhân viên công ty">
                    {users.filter((user) => user.status === 'Active').map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} {user.role ? `— ${user.role}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {salespersons.length > 0 ? (
                  <optgroup label="Danh sách cũ">
                    {salespersons.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.phone ? `(${option.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </FormField>
            <FormField label="Tên NV sale (hoặc nhập tay)">
              <input type="text" placeholder="VD: Huy" style={S.input} value={salesperson} onInput={(event: any) => setSalesperson(event.currentTarget.value)} />
            </FormField>
            <FormField label="SĐT NV sale (Phone/ĐT trên PDF)">
              <input type="text" placeholder="VD: 0345 216497" style={S.input} value={salespersonPhone} onInput={(event: any) => setSalespersonPhone(event.currentTarget.value)} />
            </FormField>
            <FormField label="Tiền tệ mặc định cho quotation">
              <select style={S.select} value={currency} onChange={(event: any) => setCurrency(event.target.value)}>
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px', minWidth: 0, display: 'grid', gap: '18px' }}>
          <div style={S.sectionTitle}>3. Các phương án báo giá</div>
          {productCatalogError ? (
            <div style={{ marginBottom: '8px', padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, fontSize: '12px', color: tokens.colors.textSecondary }}>
              {productCatalogError}
            </div>
          ) : null}

          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>
            Dùng [+ Sản phẩm] hoặc [+ Line] trong từng phương án để thêm dòng vào đúng nhóm. Kéo thả card để đổi thứ tự phương án trên preview/PDF.
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            {offerWorkspace.offerGroups.map(renderOfferCard)}
          </div>

          <button type="button" onClick={addOfferGroup} style={{ ...S.btnOutline, width: '100%', justifyContent: 'center', borderColor: tokens.colors.primary, color: tokens.colors.primary }}>
            + Thêm phương án
          </button>

          {offerActionDock}
        </div>

        {termsSection}
      </fieldset>
    </div>
  );

  const previewPanel = (
    <QuotationPreviewPanel
      isMobile={isMobile}
      previewZoom={previewZoom}
      setPreviewZoom={setPreviewZoom}
      previewScale={previewScale}
      previewContentHeight={previewContentHeight}
      previewPageCount={previewPageCount}
      previewA4Ref={previewA4Ref}
      quoteNumber={quoteNumber}
      quoteDate={quoteDate}
      selectedAcc={selectedAcc}
      salesperson={salesperson}
      salespersonPhone={salespersonPhone}
      getContactDisplayName={getContactDisplayName}
      selectedContact={selectedContact}
      currency={currency}
      subject={subject}
      offerWorkspace={offerWorkspace}
      terms={terms}
    />
  );

  const actionButtons = (
    <QuotationActionButtons
      isReadOnly={isReadOnly}
      editingQuoteId={editingQuoteId}
      quoteStatus={quoteStatus}
      saveQuotation={saveQuotation}
      savingQuote={savingQuote}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
      {showProdModal ? (
        <ProductModal
          productsDB={productsDB}
          onClose={() => setShowProdModal(false)}
          onSelect={addItem}
          latestRate={latestUsdVndRate}
          rateMissing={latestUsdVndWarnings.includes('RATE_MISSING')}
          catalogError={productCatalogError}
        />
      ) : null}

      <PageHeader
        icon={<QuoteIcon size={22} />}
        title="Trình tạo Báo giá"
        subtitle="Workspace báo giá theo phương án nghiệp vụ, điều khoản song ngữ và preview theo từng offer."
        actions={
          <button
            onClick={() => {
              setShowForm(false);
              setEditingQuoteId(null);
            }}
            style={S.btnOutline}
          >
            &larr; Quay lại
          </button>
        }
      />

      {isMobile ? (
        <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '8px' }}>
          <button onClick={() => setMobileTab('form')} style={mobileTabStyle(mobileTab === 'form')}>
            <NoteIcon size={14} /> Form
          </button>
          <button onClick={() => setMobileTab('preview')} style={mobileTabStyle(mobileTab === 'preview')}>
            <EyeIcon size={14} /> Preview
          </button>
        </div>
      ) : null}

      {isMobile ? (
        <>
          {mobileTab === 'form' ? formPanel : previewPanel}
          {actionButtons}
        </>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 460px)', gap: '24px', alignItems: 'start', minWidth: '1180px' }}>
            <div style={{ minWidth: 0 }}>{formPanel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              {actionButtons}
              {previewPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
