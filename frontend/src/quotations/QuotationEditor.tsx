import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHeader } from '../ui/PageHeader';
import { tokens } from '../ui/tokens';
import { EyeIcon, NoteIcon, QuoteIcon } from '../ui/icons';
import { FormField, ProductModal } from './QuotationComponents';
import { QuotationActionButtons, QuotationPreviewPanel } from './QuotationPreviewBlocks';
import {
  CURRENCIES,
  UNITS,
  VAT_MODES,
  formatCurrencyInputDisplay,
  computeLineItemPricing,
  formatCurrencyValue,
  getCurrencyInputEditState,
  hasQbuStaleWarning,
  hasRateIncreaseWarning,
  hasSnapshotMissingWarning,
  isReadOnlyQuotationStatus,
  quotationStyles,
} from './quotationShared';

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
  addManualItem: () => void;
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
  moveItemToOption: (index: number, isOption: boolean) => void;
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
  totals: {
    mainItems: any[];
    optionItems: any[];
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    optionValue: number;
    vatRate: number;
    calculateTotals: boolean;
    shouldShowTotals: boolean;
    isAllOptional: boolean;
    mainCurrencyGroups: any[];
    optionCurrencyGroups: any[];
  };
  editingQuoteId: string | null;
  vatRate: number;
  setVatRate: (value: number) => void;
  calculateTotals: boolean;
  setCalculateTotals: (value: boolean) => void;
  saveQuotation: (options?: SaveQuotationOptions) => Promise<void>;
  savingQuote: boolean;
};

function MoneyMaskedInput({
  value,
  currency,
  onValueChange,
}: {
  value: unknown;
  currency: string;
  onValueChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayValue = useMemo(() => formatCurrencyInputDisplay(value, currency), [value, currency]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onInput={(event: any) => {
        const input = event.currentTarget as HTMLInputElement;
        const nextState = getCurrencyInputEditState(input.value, input.selectionStart ?? input.value.length, currency);
        onValueChange(nextState.rawValue);
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(nextState.caretPosition, nextState.caretPosition);
        });
      }}
      style={S.input}
    />
  );
}

export function QuotationEditor(props: QuotationEditorProps) {
  const {
    isMobile,
    showProdModal,
    setShowProdModal,
    productsDB,
    addItem,
    addManualItem,
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
    moveItemToOption,
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
    totals,
    editingQuoteId,
    vatRate,
    setVatRate,
    calculateTotals,
    setCalculateTotals,
    saveQuotation,
    savingQuote,
  } = props;

  const isReadOnly = isReadOnlyQuotationStatus(quoteStatus);
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
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedLineIndex(null);
      return;
    }
    const fallbackIndex = items.findIndex((item) => item?.isOption !== true);
    const nextIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
    setSelectedLineIndex((current) => (current != null && current < items.length ? current : nextIndex));
  }, [items]);

  const groupedItems = items.reduce(
    (acc, item, index) => {
      if (item?.isOption) {
        acc.optionItems.push({ item, index });
      } else {
        acc.mainItems.push({ item, index });
      }
      return acc;
    },
    { mainItems: [] as Array<{ item: any; index: number }>, optionItems: [] as Array<{ item: any; index: number }> },
  );
  const selectedLine = selectedLineIndex != null ? items[selectedLineIndex] : null;

  const renderLineDetailFields = (index: number, item: any) => {
    const pricing = computeLineItemPricing(item);
    return (
      <div style={{ display: 'grid', gap: '14px', minWidth: 0 }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>
            {item.name || `Dòng báo giá #${index + 1}`}
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
            {pricing.currency} · {pricing.vatMode === 'included' ? 'Đã gồm VAT' : 'Chưa VAT'} ({pricing.vatRate}%)
          </div>
        </div>
        <FormField label="SKU / Mã hàng">
          <input
            type="text"
            value={item.sku || ''}
            onInput={(event: any) => updateItem(index, 'sku', event.currentTarget.value)}
            style={S.input}
            placeholder="Mã hàng / SKU"
          />
        </FormField>
        <FormField label="Tên hàng hóa / Commodity">
          <input
            type="text"
            value={item.name || ''}
            onInput={(event: any) => updateItem(index, 'name', event.currentTarget.value)}
            style={S.input}
            placeholder="Nhập tên hàng hóa"
          />
        </FormField>
        <FormField label="Thông số kỹ thuật (Technical Specs)">
          <textarea
            rows={6}
            value={item.technicalSpecs || ''}
            onInput={(event: any) => updateItem(index, 'technicalSpecs', event.currentTarget.value)}
            style={{
              ...S.input,
              background: tokens.colors.surface,
              fontFamily: 'var(--font-family-sans)',
              fontSize: '12px',
              resize: 'vertical',
            }}
            placeholder="- Nhãn hiệu: SOCMA&#10;- Model: HNRS4531&#10;- Xuất xứ: Trung Quốc"
          />
        </FormField>
        <FormField label="Ghi chú / Remarks">
          <textarea
            rows={4}
            value={item.remarks || ''}
            onInput={(event: any) => updateItem(index, 'remarks', event.currentTarget.value)}
            style={{ ...S.input, background: tokens.colors.surface, resize: 'vertical' }}
            placeholder="Ghi chú đặc biệt..."
          />
        </FormField>
        <div
          style={{
            display: 'grid',
            gap: '6px',
            padding: '12px 14px',
            borderRadius: '10px',
            border: `1px solid ${tokens.colors.border}`,
            background: tokens.colors.surface,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: tokens.colors.textSecondary }}>Trước VAT</span>
            <strong>{formatCurrencyValue(pricing.netTotal, pricing.currency)} {pricing.currency}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: tokens.colors.textSecondary }}>VAT</span>
            <strong>{formatCurrencyValue(pricing.vatTotal, pricing.currency)} {pricing.currency}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
            <span style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>Sau VAT</span>
            <strong>{formatCurrencyValue(pricing.grossTotal, pricing.currency)} {pricing.currency}</strong>
          </div>
        </div>
      </div>
    );
  };

  const renderItemCard = ({ item, index }: { item: any; index: number }) => (
    <div
      key={`${item.id || item.sku || 'item'}-${index}`}
      style={{
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: '10px',
        padding: '16px',
        background: tokens.colors.background,
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', minWidth: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, color: tokens.colors.primary, overflowWrap: 'anywhere' }}>
            #{index + 1} — {item.sku || 'SKU thủ công'} {item.name ? `· ${item.name}` : ''}
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
            {item.isOption ? 'Phương án tùy chọn / comparison offer' : 'Phương án chính / payable offer'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={{ ...S.btnGhost, color: tokens.colors.warningDark, padding: '0 10px' }}
            onClick={() => moveItemToOption(index, !item.isOption)}
          >
            {item.isOption ? 'Đưa về phương án chính' : 'Chuyển sang phương án tùy chọn'}
          </button>
          <button
            type="button"
            style={{ ...S.btnGhost, color: tokens.colors.error, padding: '0 10px', fontSize: '18px' }}
            onClick={() => removeItemAt(index)}
          >
            ×
          </button>
        </div>
      </div>

      {(hasRateIncreaseWarning(latestUsdVndRate, item.qbuRateValue) ||
        hasQbuStaleWarning(item.qbuUpdatedAt) ||
        hasSnapshotMissingWarning(item.qbuUpdatedAt, item.qbuRateValue, item.qbuRateDate) ||
        latestUsdVndWarnings.includes('RATE_MISSING')) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {hasRateIncreaseWarning(latestUsdVndRate, item.qbuRateValue) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: tokens.colors.error,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              Tỷ giá +2.5% (cần tính lại)
            </span>
          )}
          {hasQbuStaleWarning(item.qbuUpdatedAt) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: tokens.colors.warning,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              QBU quá 6 tháng
            </span>
          )}
          {hasSnapshotMissingWarning(item.qbuUpdatedAt, item.qbuRateValue, item.qbuRateDate) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: tokens.colors.textMuted,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              Snapshot missing
            </span>
          )}
          {latestUsdVndWarnings.includes('RATE_MISSING') && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: tokens.colors.textMuted,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              Chưa có tỷ giá VCB
            </span>
          )}
        </div>
      )}

      <div style={{ minWidth: '960px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 110px minmax(180px, 1fr) 130px 90px', gap: '10px', marginBottom: '10px', minWidth: 0 }}>
          <div>
            <label style={S.label}>ĐVT (Unit)</label>
            <select style={S.select} value={item.unit} onChange={(event: any) => updateItem(index, 'unit', event.target.value)}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Số lượng (Q.ty)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.quantity}
              onInput={(event: any) => updateItem(index, 'quantity', event.currentTarget.value)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Tiền tệ</label>
            <select
              style={S.select}
              value={item.currency || currency}
              onChange={(event: any) => updateItem(index, 'currency', event.target.value)}
            >
              {CURRENCIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Đơn giá ({item.currency || currency})</label>
            <input
              type="number"
              step={(item.currency || currency) === 'VND' ? '1' : '0.01'}
              value={item.unitPrice}
              onInput={(event: any) => updateItem(index, 'unitPrice', event.currentTarget.value)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>VAT mode</label>
            <select
              style={S.select}
              value={item.vatMode || 'excluded'}
              onChange={(event: any) => updateItem(index, 'vatMode', event.target.value)}
            >
              {VAT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'included' ? 'Đã gồm VAT' : 'Chưa VAT'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>VAT %</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={item.vatRate ?? vatRate}
              onInput={(event: any) => updateItem(index, 'vatRate', event.currentTarget.value)}
              style={S.input}
            />
          </div>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={S.label}>Tên hàng hóa / Commodity</label>
          <input
            type="text"
            value={item.name}
            onInput={(event: any) => updateItem(index, 'name', event.currentTarget.value)}
            style={S.input}
            placeholder="Nhập tên hàng hóa"
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={S.label}>Thông số kỹ thuật (Technical Specs)</label>
          <textarea
            rows={5}
            value={item.technicalSpecs}
            onInput={(event: any) => updateItem(index, 'technicalSpecs', event.currentTarget.value)}
            style={{
              ...S.input,
              background: tokens.colors.surface,
              fontFamily: 'var(--font-family-sans)',
              fontSize: '12px',
              resize: 'vertical',
            }}
            placeholder="- Nhãn hiệu: SOCMA&#10;- Model: HNRS4531&#10;- Xuất xứ: Trung Quốc"
          />
        </div>
        <div>
          <label style={S.label}>Ghi chú / Remarks</label>
          <input
            type="text"
            value={item.remarks}
            onInput={(event: any) => updateItem(index, 'remarks', event.currentTarget.value)}
            style={{ ...S.input, background: tokens.colors.surface }}
            placeholder="Ghi chú đặc biệt..."
          />
        </div>
        <div style={{ marginTop: '10px', display: 'grid', gap: '4px', justifyItems: 'end' }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
            {(() => {
              const pricing = computeLineItemPricing(item);
              return `VAT ${pricing.vatMode === 'included' ? 'đã gồm' : 'chưa gồm'} (${pricing.vatRate}%)`;
            })()}
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 800, color: tokens.colors.primary }}>
            {(() => {
              const pricing = computeLineItemPricing(item);
              return `Giá trị dòng: ${formatCurrencyValue(pricing.grossTotal, pricing.currency)} ${pricing.currency}`;
            })()}
          </div>
        </div>
      </div>
    </div>
  );

  const renderItemGridSection = ({
    title,
    subtitle,
    sectionItems,
  }: {
    title: string;
    subtitle: string;
    sectionItems: Array<{ item: any; index: number }>;
  }) => (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{subtitle}</div>
      </div>
      {sectionItems.length === 0 ? (
        <div
          style={{
            minHeight: '72px',
            border: `1px dashed ${tokens.colors.border}`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.colors.textMuted,
            fontSize: '13px',
            background: tokens.colors.surface,
            textAlign: 'center',
            padding: '12px',
          }}
        >
          {title} hiện chưa có dòng sản phẩm.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.colors.background }}>
                {['Tên hàng', 'ĐVT', 'SL', 'Tiền tệ', 'Đơn giá', 'VAT mode', 'VAT %', 'Thành tiền', ''].map((header) => (
                  <th key={`${title}-${header}`} style={S.thStatic}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionItems.map(({ item, index }) => {
                const pricing = computeLineItemPricing(item);
                const isSelected = selectedLineIndex === index;
                return (
                  <tr
                    key={`${item.id || item.sku || 'row'}-${index}`}
                    onClick={() => setSelectedLineIndex(index)}
                    style={{
                      ...S.td,
                      background: isSelected ? tokens.colors.background : 'transparent',
                      cursor: 'pointer',
                    } as any}
                  >
                    <td style={{ ...S.td, minWidth: 0 }}>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ fontWeight: 800, color: tokens.colors.textPrimary, overflowWrap: 'anywhere' }}>
                          {item.name || `Dòng báo giá #${index + 1}`}
                        </div>
                        <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                          {item.sku || 'SKU thủ công'}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <select style={S.select} value={item.unit} onClick={(event) => event.stopPropagation()} onChange={(event: any) => updateItem(index, 'unit', event.target.value)}>
                        {UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={S.td}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onClick={(event) => event.stopPropagation()}
                        onInput={(event: any) => updateItem(index, 'quantity', event.currentTarget.value)}
                        style={S.input}
                      />
                    </td>
                    <td style={S.td}>
                      <select
                        style={S.select}
                        value={item.currency || currency}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event: any) => updateItem(index, 'currency', event.target.value)}
                      >
                        {CURRENCIES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={S.td}>
                      <div onClick={(event) => event.stopPropagation()}>
                        <MoneyMaskedInput
                          value={item.unitPrice}
                          currency={item.currency || currency}
                          onValueChange={(nextValue) => updateItem(index, 'unitPrice', nextValue)}
                        />
                      </div>
                    </td>
                    <td style={S.td}>
                      <select
                        style={S.select}
                        value={item.vatMode || 'excluded'}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event: any) => updateItem(index, 'vatMode', event.target.value)}
                      >
                        {VAT_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode === 'included' ? 'Đã gồm VAT' : 'Chưa VAT'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={S.td}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.vatRate ?? vatRate}
                        onClick={(event) => event.stopPropagation()}
                        onInput={(event: any) => updateItem(index, 'vatRate', event.currentTarget.value)}
                        style={S.input}
                      />
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>
                      {formatCurrencyValue(pricing.grossTotal, pricing.currency)} {pricing.currency}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          style={{ ...S.btnGhost, color: tokens.colors.info, padding: '0 10px' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLineIndex(index);
                          }}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          style={{ ...S.btnGhost, color: tokens.colors.warningDark, padding: '0 10px' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveItemToOption(index, !item.isOption);
                          }}
                        >
                          {item.isOption ? 'Đưa về chính' : 'Sang tùy chọn'}
                        </button>
                        <button
                          type="button"
                          style={{ ...S.btnGhost, color: tokens.colors.error, padding: '0 10px' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeItemAt(index);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderItemSection = ({
    title,
    subtitle,
    items: sectionItems,
  }: {
    title: string;
    subtitle: string;
    items: Array<{ item: any; index: number }>;
  }) => (
    isMobile
      ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{subtitle}</div>
            </div>
            {sectionItems.length === 0 ? (
              <div
                style={{
                  minHeight: '72px',
                  border: `1px dashed ${tokens.colors.border}`,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.colors.textMuted,
                  fontSize: '13px',
                  background: tokens.colors.surface,
                  textAlign: 'center',
                  padding: '12px',
                }}
              >
                {title} hiện chưa có dòng sản phẩm.
              </div>
            ) : (
              sectionItems.map(renderItemCard)
            )}
          </div>
        )
      : renderItemGridSection({ title, subtitle, sectionItems })
  );

  const formPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
      <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '20px' }}>
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>0. Tiêu đề & Ngày báo giá</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Số báo giá (Nhập thủ công)">
              <input
                type="text"
                placeholder="VD: 059-26/BG/LD-PEQ-CHP"
                style={S.input}
                value={quoteNumber}
                onInput={(event: any) => setQuoteNumber(event.currentTarget.value)}
              />
            </FormField>
            <FormField label="Ngày báo giá">
              <input
                type="date"
                style={S.input}
                value={quoteDate}
                onInput={(event: any) => setQuoteDate(event.currentTarget.value)}
              />
            </FormField>
            <FormField label="Subject / Nội dung báo giá" span={2}>
              <input
                type="text"
                placeholder="VD: Báo giá xe nâng Reach Stacker cho Cảng Hải Phòng"
                style={S.input}
                value={subject}
                onInput={(event: any) => setSubject(event.currentTarget.value)}
              />
            </FormField>
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>1. Thông tin khách hàng</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Chọn account (Công ty / Cảng)" span={2}>
              <select
                style={S.select}
                value={selectedAccId}
                onChange={(event: any) => {
                  setSelectedAccId(event.target.value);
                  setSelectedContactId('');
                }}
              >
                <option value="">-- Chọn khách hàng --</option>
                {accounts.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.companyName}
                  </option>
                ))}
              </select>
            </FormField>
            {selectedAcc && (
              <div
                style={{
                  gridColumn: '1/-1',
                  background: tokens.colors.background,
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: tokens.colors.textSecondary,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  border: `1px solid ${tokens.colors.border}`,
                }}
              >
                <span>{selectedAcc.address || 'Chưa có địa chỉ'}</span>
                <span>MST: {selectedAcc.taxCode || '—'}</span>
              </div>
            )}
            <FormField label="Người liên hệ (Contact)" span={2}>
              <select
                style={S.select}
                value={selectedContactId}
                onChange={(event: any) => setSelectedContactId(event.target.value)}
                disabled={!selectedAccId}
              >
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
          {userDirectoryError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.colors.warning}`,
                background: tokens.colors.badgeBgInfo,
                fontSize: '12px',
                color: tokens.colors.textSecondary,
              }}
            >
              {userDirectoryError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Chọn từ danh sách nhân viên" span={2}>
              <select style={S.select} onChange={(event: any) => handleSalespersonSelect(event.target.value)}>
                <option value="">-- Chọn nhân viên phụ trách --</option>
                {users.length > 0 && (
                  <optgroup label="Nhân viên công ty">
                    {users
                      .filter((user) => user.status === 'Active')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} {user.role ? `— ${user.role}` : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
                {salespersons.length > 0 && (
                  <optgroup label="Danh sách cũ">
                    {salespersons.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.phone ? `(${option.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FormField>
            <FormField label="Tên NV sale (hoặc nhập tay)">
              <input
                type="text"
                placeholder="VD: Huy"
                style={S.input}
                value={salesperson}
                onInput={(event: any) => setSalesperson(event.currentTarget.value)}
              />
            </FormField>
            <FormField label="SĐT NV sale (Phone/ĐT trên PDF)">
              <input
                type="text"
                placeholder="VD: 0345 216497"
                style={S.input}
                value={salespersonPhone}
                onInput={(event: any) => setSalespersonPhone(event.currentTarget.value)}
              />
            </FormField>
            <FormField label="Tiền tệ mặc định cho dòng mới">
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

        <div style={{ ...S.card, padding: '24px', minWidth: 0 }}>
          <div style={S.sectionTitle}>3. Sản phẩm & cấu trúc giá</div>
          {productCatalogError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.colors.warning}`,
                background: tokens.colors.badgeBgInfo,
                fontSize: '12px',
                color: tokens.colors.textSecondary,
              }}
            >
              {productCatalogError}
            </div>
          )}

          {isMobile ? (
            <div style={{ display: 'grid', gap: '18px' }}>
              {renderItemSection({
                title: 'Phương án chính',
                subtitle: 'Các dòng trong nhóm này mới được tính vào tổng thanh toán.',
                items: groupedItems.mainItems,
              })}
              {renderItemSection({
                title: 'Phương án tùy chọn',
                subtitle: 'Các phương án so sánh / tham khảo. Không cộng vào tổng thanh toán.',
                items: groupedItems.optionItems,
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '18px', alignItems: 'start', minWidth: 0 }}>
              <div style={{ display: 'grid', gap: '18px', minWidth: 0 }}>
                {renderItemSection({
                  title: 'Phương án chính',
                  subtitle: 'Các dòng trong nhóm này mới được tính vào tổng thanh toán.',
                  items: groupedItems.mainItems,
                })}
                {renderItemSection({
                  title: 'Phương án tùy chọn',
                  subtitle: 'Các phương án so sánh / tham khảo. Không cộng vào tổng thanh toán.',
                  items: groupedItems.optionItems,
                })}
              </div>
              <div
                style={{
                  ...S.card,
                  padding: '20px',
                  position: 'sticky',
                  top: '20px',
                  minWidth: 0,
                  display: 'grid',
                  gap: '16px',
                  background: tokens.colors.surface,
                }}
              >
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Chi tiết dòng đang chọn
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                    Chọn một dòng trong bảng để chỉnh `SKU`, `Commodity`, `Remarks` và kiểm tra nhanh net/VAT/gross.
                  </div>
                </div>
                {selectedLine != null && selectedLineIndex != null ? (
                  renderLineDetailFields(selectedLineIndex, selectedLine)
                ) : (
                  <div style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
                    Chưa có dòng nào để chỉnh chi tiết.
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowProdModal(true)}
              style={{
                ...S.btnOutline,
                color: tokens.colors.info,
                borderColor: tokens.colors.info,
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              + Thêm sản phẩm từ database
            </button>
            <button
              type="button"
              onClick={addManualItem}
              style={{
                ...S.btnOutline,
                color: tokens.colors.primary,
                borderColor: tokens.colors.primary,
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              + Thêm dòng nhập tay
            </button>
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: `1px solid ${tokens.colors.border}`,
              display: 'grid',
              gap: '14px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: tokens.colors.textPrimary, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={calculateTotals}
                  onChange={(event: any) => setCalculateTotals(event.currentTarget.checked)}
                />
                Có cần tính toán tổng giá
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 140px 1fr', gap: '12px', minWidth: 0 }}>
                <FormField label="VAT %">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={vatRate}
                    onInput={(event: any) => setVatRate(Number(event.currentTarget.value || 0))}
                    style={S.input}
                  />
                </FormField>
                <div style={{ gridColumn: 'span 2', display: 'grid', gap: '6px', alignContent: 'end' }}>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                    Chỉ phương án chính mới tạo subtotal/VAT/grand total. Phương án tùy chọn luôn là giá tham khảo.
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '6px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
              }}
            >
              {totals.mainCurrencyGroups.map((group: any) => (
                <div
                  key={`main-${group.currency}`}
                  style={{ display: 'grid', gap: '4px', paddingBottom: '8px', borderBottom: `1px dashed ${tokens.colors.border}` }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                    Phương án chính · {group.currency}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ color: tokens.colors.textSecondary }}>Trước VAT</span>
                    <strong>{formatCurrencyValue(group.netSubtotal, group.currency)} {group.currency}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ color: tokens.colors.textSecondary }}>VAT</span>
                    <strong>{formatCurrencyValue(group.vatTotal, group.currency)} {group.currency}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>Sau VAT</span>
                    <strong>{formatCurrencyValue(group.grossTotal, group.currency)} {group.currency}</strong>
                  </div>
                </div>
              ))}
              {totals.optionCurrencyGroups.map((group: any) => (
                <div key={`option-${group.currency}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: tokens.colors.textSecondary }}>Phương án tùy chọn · {group.currency}</span>
                  <strong>{formatCurrencyValue(group.grossTotal, group.currency)} {group.currency}</strong>
                </div>
              ))}
              {!totals.shouldShowTotals && (
                <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                  {totals.isAllOptional
                    ? 'Báo giá hiện chỉ gồm phương án tùy chọn, nên preview sẽ ẩn phần tổng thanh toán.'
                    : 'Đã tắt tính tổng giá. Preview sẽ ẩn subtotal / VAT / grand total.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px', minWidth: 0 }}>
          <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            4. Điều khoản & Ghi chú (Terms)
            <button
              onClick={handleTranslate}
              style={{ ...S.btnOutline, color: tokens.colors.warning, borderColor: tokens.colors.warning, padding: '4px 12px', fontSize: '13px' }}
              disabled={translating}
            >
              {translating ? 'Đang dịch...' : 'Dịch toàn bộ sang tiếng Anh'}
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>Ghi chú chung (Remarks)</label>
            <textarea
              rows={3}
              value={terms.remarks}
              onInput={(event: any) => setTerms({ ...terms, remarks: event.currentTarget.value })}
              style={S.input}
              placeholder="Nhập ghi chú chung bằng tiếng Việt (nếu có)..."
            />
            {terms.remarksEn && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: tokens.colors.textSecondary, fontStyle: 'italic' }}>
                EN: {terms.remarksEn}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
            {(terms.termItems || []).map((item: any, idx: number) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  background: tokens.colors.surface,
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${tokens.colors.border}`,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '12px' }}>
                  <FormField label="Tên điều khoản (Tiếng Việt)">
                    <input
                      type="text"
                      value={item.labelViPrint}
                      onInput={(event: any) => {
                        const nextTerms = [...terms.termItems];
                        nextTerms[idx].labelViPrint = event.currentTarget.value;
                        setTerms({ ...terms, termItems: nextTerms });
                      }}
                      style={S.input}
                      placeholder="VD: Hiệu lực"
                    />
                  </FormField>
                  <FormField label="Tên điều khoản (Tiếng Anh)">
                    <div style={{ display: 'flex', gap: '8px', minWidth: 0 }}>
                      <input
                        type="text"
                        value={item.labelEn}
                        onInput={(event: any) => {
                          const nextTerms = [...terms.termItems];
                          nextTerms[idx].labelEn = event.currentTarget.value;
                          setTerms({ ...terms, termItems: nextTerms });
                        }}
                        style={{ ...S.input, minWidth: 0 }}
                        placeholder="VD: Validity"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextTerms = terms.termItems.filter((_: any, itemIndex: number) => itemIndex !== idx);
                          setTerms({ ...terms, termItems: nextTerms });
                        }}
                        style={{ ...S.btnGhost, color: tokens.colors.error, padding: '0 12px' }}
                      >
                        Xóa
                      </button>
                    </div>
                  </FormField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                  <FormField label="Nội dung tiếng Việt">
                    <textarea
                      rows={2}
                      value={item.textVi}
                      onInput={(event: any) => {
                        const nextTerms = [...terms.termItems];
                        nextTerms[idx].textVi = event.currentTarget.value;
                        setTerms({ ...terms, termItems: nextTerms });
                      }}
                      style={{ ...S.input, resize: 'vertical' }}
                    />
                  </FormField>
                  <FormField label="Nội dung tiếng Anh">
                    <textarea
                      rows={2}
                      value={item.textEn}
                      onInput={(event: any) => {
                        const nextTerms = [...terms.termItems];
                        nextTerms[idx].textEn = event.currentTarget.value;
                        setTerms({ ...terms, termItems: nextTerms });
                      }}
                      style={{ ...S.input, resize: 'vertical' }}
                    />
                  </FormField>
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
                    { labelViPrint: 'Điều khoản mới', labelEn: 'New Term', textVi: '', textEn: '' },
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
              + Thêm điều khoản mới
            </button>
          </div>
        </div>
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
      items={items}
      totals={totals}
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
      {showProdModal && (
        <ProductModal
          productsDB={productsDB}
          onClose={() => setShowProdModal(false)}
          onSelect={addItem}
          latestRate={latestUsdVndRate}
          rateMissing={latestUsdVndWarnings.includes('RATE_MISSING')}
          catalogError={productCatalogError}
        />
      )}

      <PageHeader
        icon={<QuoteIcon size={22} />}
        title="Trình tạo Báo giá"
        subtitle="Sales Kit — nhập đầy đủ để đồng bộ với template PDF"
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

      {isMobile && (
        <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '8px' }}>
          <button onClick={() => setMobileTab('form')} style={mobileTabStyle(mobileTab === 'form')}>
            <NoteIcon size={14} /> Form
          </button>
          <button onClick={() => setMobileTab('preview')} style={mobileTabStyle(mobileTab === 'preview')}>
            <EyeIcon size={14} /> Preview
          </button>
        </div>
      )}

      {isMobile ? (
        <>
          {mobileTab === 'form' ? formPanel : previewPanel}
          {actionButtons}
        </>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 440px)', gap: '24px', alignItems: 'start', minWidth: '980px' }}>
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
