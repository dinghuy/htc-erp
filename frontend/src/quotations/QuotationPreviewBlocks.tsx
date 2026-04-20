import { useI18n } from '../i18n';
import { tokens } from '../ui/tokens';
import { CheckIcon, ExportIcon, LoaderIcon, ReportIcon } from '../ui/icons';
import {
  PREVIEW_CONTENT_WIDTH,
  PREVIEW_GRID_COL_LEFT,
  PREVIEW_GRID_COL_RIGHT,
  PREVIEW_GRID_GAP,
  PREVIEW_LABEL_LEFT,
  PREVIEW_LABEL_RIGHT,
  PREVIEW_MARGIN_Y,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  PREVIEW_SCALE,
  computeLineItemPricing,
  formatCurrencyValue,
  quotationStyles,
} from './quotationShared';

const S = quotationStyles;

type SaveQuotationOptions = {
  status?: string;
  exportPdf?: boolean;
};

function getVatModeLabel(mode: unknown) {
  return String(mode || '').trim().toLowerCase() === 'gross' ? 'Gross' : 'NET';
}

function PreviewTable({
  title,
  rows,
  currency,
}: {
  title?: string;
  rows: any[];
  currency: string;
}) {
  return (
    <div style={{ width: `${PREVIEW_CONTENT_WIDTH.toFixed(2)}px`, marginBottom: '18px' }}>
      {title ? (
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#003F85', marginBottom: '6px' }}>{title}</div>
      ) : null}
      <table style={{ width: `${PREVIEW_CONTENT_WIDTH.toFixed(2)}px`, borderCollapse: 'collapse', fontSize: '9px', border: '0.9px solid #1A202C' }}>
        <colgroup>
          <col style={{ width: `${(22 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(68 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(140 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(28 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(25 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(85 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(75 * PREVIEW_SCALE).toFixed(2)}px` }} />
          <col style={{ width: `${(52.28 * PREVIEW_SCALE).toFixed(2)}px` }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#5B9BD5', color: '#fff' }}>
            {[
              { en: 'No.', vi: 'Stt', align: 'left' },
              { en: 'Part name', vi: 'Mã hàng', align: 'left' },
              { en: 'Commodity', vi: 'Tên hàng hóa', align: 'left' },
              { en: 'Unit', vi: 'ĐV', align: 'left' },
              { en: 'Q.ty', vi: 'S.lg', align: 'left' },
              { en: 'Unit price', vi: 'Đơn giá', align: 'right' },
              { en: 'Total', vi: 'Thành tiền', align: 'right' },
              { en: 'Remarks', vi: 'Ghi chú', align: 'left' },
            ].map((header) => (
              <th key={header.en} style={{ padding: '4px 4px', textAlign: header.align as any, fontWeight: 700, border: '0.9px solid #1A202C' }}>
                <div style={{ lineHeight: 1.05 }}>{header.en}</div>
                <div style={{ lineHeight: 1.05 }}>{header.vi}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '16px 6px', textAlign: 'center', color: '#CBD5E1', fontStyle: 'italic', border: '0.9px solid #1A202C' }}>
                Chưa có dòng sản phẩm
              </td>
            </tr>
          ) : (
            rows.map((item: any, idx: number) => (
              <tr key={`${item.id || item.sku || 'row'}-${idx}`}>
                <td style={{ padding: '4px 4px', border: '0.9px solid #1A202C' }}>{idx + 1}</td>
                <td style={{ padding: '4px 4px', color: '#003F85', fontWeight: 700, fontSize: '10.5px', border: '0.9px solid #1A202C' }}>{item.sku || '-'}</td>
                <td style={{ padding: '4px 4px', whiteSpace: 'pre-line', lineHeight: 1.3, border: '0.9px solid #1A202C' }}>
                  <strong>{item.name || '—'}</strong>
                  {item.technicalSpecs ? `\n${item.technicalSpecs}` : ''}
                  {(() => {
                    const pricing = item.pricing || computeLineItemPricing(item);
                    return `\nVAT mode: ${getVatModeLabel(pricing.vatMode)} (${pricing.vatRate}%)`;
                  })()}
                </td>
                <td style={{ padding: '4px 4px', textAlign: 'left', border: '0.9px solid #1A202C' }}>{item.unit || 'Chiếc'}</td>
                <td style={{ padding: '4px 4px', textAlign: 'left', border: '0.9px solid #1A202C' }}>{item.quantity || 1}</td>
                <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: '10.5px', border: '0.9px solid #1A202C' }}>
                  {(() => {
                    const pricing = item.pricing || computeLineItemPricing(item);
                    return formatCurrencyValue(pricing.unitPrice, pricing.currency);
                  })()}
                </td>
                <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 700, fontSize: '10.5px', border: '0.9px solid #1A202C' }}>
                  {(() => {
                    const pricing = item.pricing || computeLineItemPricing(item);
                    return formatCurrencyValue(pricing.grossTotal, pricing.currency);
                  })()}
                </td>
                <td style={{ padding: '4px 4px', fontSize: '9px', color: '#1A202C', border: '0.9px solid #1A202C' }}>{item.remarks || ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {rows.length > 0 ? (
        <div style={{ marginTop: '6px', textAlign: 'right', fontSize: '10px', color: '#64748B' }}>
          Đơn vị tiền tệ / Currency: {currency}
        </div>
      ) : null}
    </div>
  );
}

export function QuotationPreviewPanel({
  isMobile,
  previewZoom,
  setPreviewZoom,
  previewScale,
  previewContentHeight,
  previewPageCount,
  previewA4Ref,
  quoteNumber,
  quoteDate,
  selectedAcc,
  salesperson,
  salespersonPhone,
  getContactDisplayName,
  selectedContact,
  currency,
  subject,
  offerWorkspace,
  terms,
}: any) {
  const { t } = useI18n();
  const previewCurrencyLabel =
    offerWorkspace.offerGroups.length > 1
      ? 'MIXED'
      : offerWorkspace.offerGroups[0]?.currency || currency;

  return (
    <div
      style={{
        ...S.card,
        background: 'var(--bg-primary)',
        position: 'relative',
        zIndex: 0,
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        width: isMobile ? '100%' : undefined,
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          textAlign: 'center',
          fontWeight: 800,
          fontSize: '13px',
          color: 'var(--text-primary)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <ReportIcon size={14} />
        {t('sales.quotations.preview.title')}
      </div>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('sales.quotations.preview.zoom')}</div>
        <input
          type="range"
          min="50"
          max="150"
          value={previewZoom}
          onInput={(event: any) => setPreviewZoom(Number(event.currentTarget.value))}
          style={{ flex: 1, minWidth: 0 }}
        />
        <div style={{ fontSize: '12px', width: '48px', textAlign: 'right', color: 'var(--text-secondary)' }}>{previewZoom}%</div>
      </div>
      <div style={{ padding: '12px', maxHeight: '82vh', overflowY: 'auto', overflowX: 'auto' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            color: '#1A202C',
            width: `${(PREVIEW_PAGE_WIDTH * previewScale).toFixed(2)}px`,
          }}
        >
          <style>
            {`
              @font-face {
                font-family: var(--font-family-sans);
                src: url("/Times New Roman.ttf") format("truetype");
                font-weight: 400;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: var(--font-family-sans);
                src: url("/Times New Roman Bold.ttf") format("truetype");
                font-weight: 700;
                font-style: normal;
                font-display: swap;
              }
            `}
          </style>

          <div style={{ position: 'relative', width: `${(PREVIEW_PAGE_WIDTH * previewScale).toFixed(2)}px`, height: `${(previewContentHeight * previewScale).toFixed(2)}px` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${previewScale})`, transformOrigin: 'top left', willChange: 'transform' }}>
              <div style={{ position: 'relative', width: `${PREVIEW_PAGE_WIDTH}px`, height: `${previewContentHeight}px` }}>
                <div
                  ref={previewA4Ref}
                  style={{
                    width: `${PREVIEW_PAGE_WIDTH}px`,
                    minHeight: `${PREVIEW_PAGE_HEIGHT}px`,
                    padding: `${PREVIEW_MARGIN_Y}px 14.17px`,
                    fontFamily: 'var(--font-family-sans)',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '1.5px solid #003F85' }}>
                    <img src="/lda-logo.png" alt="LDA" style={{ width: '90px', height: 'auto', objectFit: 'contain' }} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#003F85', fontWeight: 700, fontSize: '11px' }}>L&D AUTO COMPANY LIMITED</div>
                      <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px', marginTop: '2px' }}>HW 51, My Tan Quarter,</div>
                      <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Phu My Ward, Ho Chi Minh City, Vietnam</div>
                      <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Tel: +84 254 6263 118    Fax: +84 254 6263 119</div>
                      <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Web: www.ldauto.vn    Hotline: 1900 9696 64</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '35px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#003F85' }}>QUOTATION/BÁO GIÁ</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>No/Số: {quoteNumber || '___-__/BG/LD-___'}</div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `${PREVIEW_GRID_COL_LEFT.toFixed(2)}px ${PREVIEW_GRID_COL_RIGHT.toFixed(2)}px`,
                      columnGap: `${PREVIEW_GRID_GAP.toFixed(2)}px`,
                      rowGap: '6px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Customer / KH:</div>
                      <div>{selectedAcc?.companyName || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Date / Ngày:</div>
                      <div>{quoteDate ? new Date(quoteDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Address / ĐC:</div>
                      <div>{selectedAcc?.address || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Sales / NV:</div>
                      <div>{salesperson || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Tax code / MST:</div>
                      <div>{selectedAcc?.taxCode || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Sale Phone:</div>
                      <div>{salespersonPhone || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Contact / LH:</div>
                      <div>{getContactDisplayName(selectedContact)}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Crcy / Tiền:</div>
                      <div>{previewCurrencyLabel}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Phone / ĐT:</div>
                      <div>{selectedContact?.phone || '—'}</div>
                    </div>
                  </div>

                  {subject ? (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#003F85', marginBottom: '14px' }}>
                      Subject / V/v: {subject}
                    </div>
                  ) : null}

                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Dear Sir/Madam, / Thưa Ông/Bà,</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                    We are glad to offer you the quotation as following / Chúng tôi xin gửi đến quý công ty bảng chào giá như sau:
                  </div>

                  {offerWorkspace.offerGroups.map((group: any, index: number) => {
                    const title = String(group.displayLabel || '').trim() || undefined;
                    return (
                      <div key={group.groupKey}>
                        <PreviewTable title={title} rows={group.items} currency={group.currency} />
                        {group.validation.primaryError ? (
                          <div style={{ marginTop: '-8px', marginBottom: '18px', fontSize: '10px', color: '#B91C1C' }}>
                            {group.validation.primaryError}
                          </div>
                        ) : null}
                        {group.vatComputed && !group.totalComputed ? (
                          <div style={{ marginTop: '-8px', marginBottom: '18px', fontSize: '10px', color: '#64748B' }}>
                            {title || `Phương án ${index + 1}`} đã tính VAT nhưng chưa tính tổng.
                          </div>
                        ) : null}
                        {group.totalComputed && group.summary ? (
                          <div style={{ marginLeft: 'auto', width: '320px', marginBottom: '24px', display: 'grid', gap: '12px' }}>
                            <div style={{ border: '1px solid #CBD5E1', padding: '10px 12px' }}>
                              <div style={{ fontWeight: 700, color: '#003F85', marginBottom: '6px' }}>{group.currency}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>{t('sales.quotations.preview.subtotal')}:</span>
                                <strong>{formatCurrencyValue(group.summary.netSubtotal, group.currency)} {group.currency}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>VAT:</span>
                                <strong>{formatCurrencyValue(group.summary.vatTotal, group.currency)} {group.currency}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#003F85', color: '#fff', marginTop: '8px' }}>
                                <span style={{ fontWeight: 700 }}>{t('sales.quotations.preview.grand_total').toUpperCase()}:</span>
                                <strong>{formatCurrencyValue(group.summary.grossTotal, group.currency)} {group.currency}</strong>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <div style={{ marginTop: '12px' }}>
                    {(terms.remarksEn || terms.remarks) ? (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, marginBottom: '6px' }}>Remark:</div>
                        {terms.remarksEn ? <div style={{ fontWeight: 700, marginBottom: '4px', whiteSpace: 'pre-line' }}>{terms.remarksEn}</div> : null}
                        {terms.remarks ? <div style={{ color: '#64748B', whiteSpace: 'pre-line' }}>{terms.remarks}</div> : null}
                      </div>
                    ) : null}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '20px', alignItems: 'end', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, color: '#003F85' }}>Terms & Conditions</div>
                      <div style={{ fontWeight: 700, color: '#003F85' }}>Điều khoản</div>
                    </div>
                    <div style={{ borderBottom: '1px solid #003F85', marginBottom: '12px' }} />

                    {(terms.termItems || []).map((termItem: any, idx: number) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '20px', marginBottom: '10px' }}>
                        <div>{idx + 1}. {termItem.labelEn}: {termItem.textEn}</div>
                        <div>{idx + 1}. {termItem.labelViPrint}: {termItem.textVi}</div>
                      </div>
                    ))}

                    <div style={{ marginTop: '20px', color: '#64748B' }}>Best regard/Trân trọng./.</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '36px', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>L&D AUTO COMPANY LIMITED</div>
                        <div style={{ fontSize: '11px' }}>CÔNG TY TNHH L&D AUTO</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>CUSTOMER</div>
                        <div style={{ fontSize: '11px' }}>{t('sales.quotations.preview.customer')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {Array.from({ length: previewPageCount - 1 }).map((_, idx) => (
                <div
                  key={`page-break-${idx}`}
                  style={{
                    position: 'absolute',
                    top: `${((idx + 1) * PREVIEW_PAGE_HEIGHT - PREVIEW_MARGIN_Y) * previewScale}px`,
                    left: 0,
                    width: '100%',
                    borderTop: '1px dashed #CBD5E1',
                  }}
                >
                  <div style={{ position: 'absolute', right: '6px', top: '-10px', fontSize: '9px', color: '#64748B', background: '#fff', padding: '0 4px' }}>
                    Page {idx + 2}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotationActionButtons({
  isReadOnly,
  quoteStatus,
  saveQuotation,
  savingQuote,
}: {
  isReadOnly: boolean;
  editingQuoteId: string | null;
  quoteStatus: string;
  saveQuotation: (options?: SaveQuotationOptions) => Promise<void>;
  savingQuote: boolean;
}) {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', position: 'relative', zIndex: 1, background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => saveQuotation({ status: 'draft' })}
          disabled={savingQuote || isReadOnly}
          style={{
            ...S.btnPrimary,
            flex: '1 1 220px',
            background: `linear-gradient(135deg, ${tokens.colors.warning}, ${tokens.colors.warningDark})`,
            opacity: savingQuote || isReadOnly ? 0.7 : 1,
            cursor: savingQuote || isReadOnly ? 'not-allowed' : 'pointer',
          }}
        >
          {savingQuote ? (
            <>
              <LoaderIcon size={14} /> {t('sales.quotations.saving')}
            </>
          ) : (
            <>
              <CheckIcon size={14} /> {t('sales.quotations.save_draft')}
            </>
          )}
        </button>
        <button
          onClick={() => saveQuotation({ status: quoteStatus || 'draft', exportPdf: true })}
          disabled={savingQuote}
          style={{
            ...S.btnPrimary,
            flex: '1 1 220px',
            background: tokens.colors.primaryDark,
            opacity: savingQuote ? 0.7 : 1,
            cursor: savingQuote ? 'not-allowed' : 'pointer',
          }}
        >
          {savingQuote ? (
            <>
              <LoaderIcon size={14} /> {t('sales.quotations.exporting')}
            </>
          ) : (
            <>
              <ExportIcon size={14} /> {t('sales.quotations.export_pdf')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
