import { useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { fetchWithAuth } from '../auth';
import { OverlayModal } from '../ui/OverlayModal';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { showNotify } from '../Notification';
import {
  buildGroupedWorkbookLines,
  createSuggestedWorkbookLines,
  normalizeCurrency,
  normalizeIncoterm,
  normalizeProductQbuWorkbook,
  PRODUCT_QBU_GROUP_LABELS,
  type ProductQbuLineGroup,
  type ProductQbuPreviewSummary,
} from './productQbuWorkbook';

const API = API_BASE;
const INCOTERM_OPTIONS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP'];

type WorkbookPreviewResponse = {
  normalizedQbuData?: any;
  preview?: ProductQbuPreviewSummary;
};

type ProductQbuWorkbookModalProps = {
  token: string;
  productName: string;
  basePrice: string | number;
  currency: string;
  initialQbuData: unknown;
  onClose: () => void;
  onSave: (nextQbuData: any) => void;
};

function currencyFormatter(currency: string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: normalizeCurrency(currency) === 'USD' ? 'USD' : 'VND',
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: unknown, currency: string) {
  return currencyFormatter(currency).format(Number(value || 0));
}

function findLineCurrency(lines: any[], fallback: string) {
  return normalizeCurrency(lines.find((line) => line?.currency)?.currency ?? fallback);
}

export function ProductQbuWorkbookModal(props: ProductQbuWorkbookModalProps) {
  const { token, productName, basePrice, currency, initialQbuData, onClose, onSave } = props;
  const [draft, setDraft] = useState(() => normalizeProductQbuWorkbook(initialQbuData));
  const [preview, setPreview] = useState<ProductQbuPreviewSummary | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const groupedLines = useMemo(() => buildGroupedWorkbookLines(draft.lines), [draft.lines]);
  const lineCurrency = useMemo(() => findLineCurrency(draft.lines, draft.basisCurrency), [draft.lines, draft.basisCurrency]);

  useEffect(() => {
    setDraft(normalizeProductQbuWorkbook(initialQbuData));
  }, [initialQbuData]);

  useEffect(() => {
    let active = true;
    const runPreview = async () => {
      setPreviewLoading(true);
      try {
        const res = await fetchWithAuth(token, `${API}/products/qbu/preview`, {
          method: 'POST',
          body: JSON.stringify({
            basePrice,
            currency,
            qbuData: draft,
          }),
        });
        const body: WorkbookPreviewResponse = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error((body as any)?.error || 'Không thể tính preview QBU');
        setPreview(body.preview || null);
      } catch (error: any) {
        if (!active) return;
        setPreview(null);
        showNotify(error?.message || 'Không thể tính preview QBU', 'error');
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    runPreview();
    return () => {
      active = false;
    };
  }, [token, basePrice, currency, draft]);

  const updateFinancialField = (field: string, value: string) => {
    setDraft((current: any) => ({
      ...current,
      financialDefaults: {
        ...current.financialDefaults,
        [field]: field === 'tpcType' ? (value === 'Net' || value === 'Gross' ? value : null) : Number(value || 0),
      },
    }));
  };

  const updateLine = (id: string, field: string, value: string) => {
    setDraft((current: any) => ({
      ...current,
      lines: current.lines.map((line: any) => (
        line.id !== id
          ? line
          : {
              ...line,
              [field]: field === 'amount'
                ? Number(value || 0)
                : field === 'group'
                  ? value
                  : value,
              provenance: line.provenance === 'legacy' ? 'manual' : line.provenance,
            }
      )),
    }));
  };

  const addLine = (group: ProductQbuLineGroup) => {
    setDraft((current: any) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          id: `manual-${Date.now()}-${current.lines.length + 1}`,
          name: 'Chi phí mới',
          group,
          amount: 0,
          currency: current.basisCurrency,
          provenance: 'manual',
        },
      ],
    }));
  };

  const removeLine = (id: string) => {
    setDraft((current: any) => ({
      ...current,
      lines: current.lines.filter((line: any) => line.id !== id),
    }));
  };

  const applyIncotermSuggestions = () => {
    const nextIncoterm = normalizeIncoterm(draft.incoterm);
    const suggestedLines = createSuggestedWorkbookLines(nextIncoterm, draft.basisCurrency);
    setDraft((current: any) => ({
      ...current,
      incoterm: nextIncoterm,
      lines: suggestedLines,
    }));
  };

  return (
    <OverlayModal
      title="QBU Workbook"
      subtitle={`Quản lý master cost snapshot và financial defaults cho ${productName || 'sản phẩm'}.`}
      onClose={onClose}
      maxWidth="1280px"
      contentPadding="24px"
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <section style={{ ...ui.card.base, display: 'grid', gap: '16px', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Commercial basis</div>
              <div style={{ ...ui.form.help, lineHeight: 1.6 }}>
                Incoterm dùng để gợi ý cost lines ban đầu. Sau khi sinh, anh có thể sửa, thêm hoặc xoá dòng tự do.
              </div>
            </div>
            <span style={{ ...ui.badge.info, background: tokens.colors.surfaceSuccessSoft }}>
              Giá bán tham chiếu: {basePrice ? formatMoney(basePrice, normalizeCurrency(currency)) : 'Chưa nhập'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={ui.form.label}>Incoterm</label>
              <select
                style={ui.input.base as any}
                value={draft.incoterm}
                onChange={(event: any) => setDraft((current: any) => ({ ...current, incoterm: event.currentTarget.value }))}
              >
                {INCOTERM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={ui.form.label}>Basis currency</label>
              <select
                style={ui.input.base as any}
                value={draft.basisCurrency}
                onChange={(event: any) => setDraft((current: any) => ({ ...current, basisCurrency: event.currentTarget.value }))}
              >
                {['USD', 'VND'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={ui.form.label}>FX source</label>
              <input style={ui.input.base as any} value={draft.rateSnapshot?.source || ''} readOnly />
            </div>
            <div>
              <label style={ui.form.label}>FX date</label>
              <input style={ui.input.base as any} value={draft.rateSnapshot?.date || ''} readOnly />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...ui.form.help, color: tokens.colors.textMuted }}>
              Nếu muốn quay về cấu trúc chuẩn theo incoterm, bấm áp preset. Các chỉnh sửa hiện tại của dòng chi phí sẽ được thay thế.
            </span>
            <button type="button" onClick={applyIncotermSuggestions} style={ui.btn.outline as any}>
              Áp preset theo incoterm
            </button>
          </div>
        </section>

        <section style={{ ...ui.card.base, display: 'grid', gap: '18px', boxShadow: 'none' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Cost lines</div>
            <div style={{ ...ui.form.help, lineHeight: 1.6 }}>
              Mỗi dòng chi phí có thể thêm, xoá, đổi tên, đổi group và chỉnh số tiền. Đây là cost snapshot chuẩn ở cấp product.
            </div>
          </div>
          {groupedLines.map((group) => (
            <div key={group.group} style={{ display: 'grid', gap: '10px', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{group.label}</div>
                  <div style={ui.form.help}>Subtotal: {formatMoney(group.subtotal, lineCurrency)}</div>
                </div>
                <button type="button" onClick={() => addLine(group.group)} style={ui.btn.outline as any}>
                  Thêm dòng
                </button>
              </div>
              {group.items.length ? group.items.map((line: any) => (
                <div key={line.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 180px 180px auto', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label style={ui.form.label}>Tên chi phí</label>
                    <input style={ui.input.base as any} value={line.name} onInput={(event: any) => updateLine(line.id, 'name', event.currentTarget.value)} />
                  </div>
                  <div>
                    <label style={ui.form.label}>Group</label>
                    <select style={ui.input.base as any} value={line.group} onChange={(event: any) => updateLine(line.id, 'group', event.currentTarget.value)}>
                      {(Object.keys(PRODUCT_QBU_GROUP_LABELS) as ProductQbuLineGroup[]).map((key) => (
                        <option key={key} value={key}>{PRODUCT_QBU_GROUP_LABELS[key]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={ui.form.label}>Amount ({line.currency})</label>
                    <input type="number" style={ui.input.base as any} value={line.amount} onInput={(event: any) => updateLine(line.id, 'amount', event.currentTarget.value)} />
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} style={{ ...(ui.btn.outline as any), color: tokens.colors.error }}>
                    Xóa
                  </button>
                </div>
              )) : (
                <div style={{ ...ui.form.help, color: tokens.colors.textMuted }}>Chưa có dòng nào trong nhóm này.</div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px dashed ${tokens.colors.border}`, paddingTop: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>Tổng cost snapshot</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>{formatMoney(draft.totalAmount, lineCurrency)}</span>
          </div>
        </section>

        <section style={{ ...ui.card.base, display: 'grid', gap: '18px', boxShadow: 'none' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Financial model</div>
            <div style={{ ...ui.form.help, lineHeight: 1.6 }}>
              Các assumption tài chính bên dưới là editable và sẽ được lưu cùng product để downstream pricing clone làm default.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={ui.form.label}>VAT rate</label>
              <input type="number" step="0.01" style={ui.input.base as any} value={draft.financialDefaults.vatRate} onInput={(event: any) => updateFinancialField('vatRate', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>Loan days</label>
              <input type="number" style={ui.input.base as any} value={draft.financialDefaults.loanInterestDays} onInput={(event: any) => updateFinancialField('loanInterestDays', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>Loan rate</label>
              <input type="number" step="0.01" style={ui.input.base as any} value={draft.financialDefaults.loanInterestRate} onInput={(event: any) => updateFinancialField('loanInterestRate', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>CIT rate</label>
              <input type="number" step="0.01" style={ui.input.base as any} value={draft.financialDefaults.citRate} onInput={(event: any) => updateFinancialField('citRate', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>TPC type</label>
              <select style={ui.input.base as any} value={draft.financialDefaults.tpcType || ''} onChange={(event: any) => updateFinancialField('tpcType', event.currentTarget.value)}>
                <option value="">None</option>
                <option value="Net">Net</option>
                <option value="Gross">Gross</option>
              </select>
            </div>
            <div>
              <label style={ui.form.label}>TPC rate</label>
              <input type="number" step="0.01" style={ui.input.base as any} value={draft.financialDefaults.tpcRate} onInput={(event: any) => updateFinancialField('tpcRate', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>Buy FX rate</label>
              <input type="number" style={ui.input.base as any} value={draft.financialDefaults.buyFxRate} onInput={(event: any) => updateFinancialField('buyFxRate', event.currentTarget.value)} />
            </div>
            <div>
              <label style={ui.form.label}>Sell FX rate</label>
              <input type="number" style={ui.input.base as any} value={draft.financialDefaults.sellFxRate} onInput={(event: any) => updateFinancialField('sellFxRate', event.currentTarget.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              ['Tổng sell', preview?.totalSell, 'VND'],
              ['Tổng cost', preview?.totalCost, 'VND'],
              ['VAT sell', preview?.vatSell, 'VND'],
              ['VAT cost', preview?.vatCost, 'VND'],
              ['Discount', preview?.discountAmount, 'VND'],
              ['Loan interest', preview?.loanInterest, 'VND'],
              ['TPC', preview?.tpc, 'VND'],
              ['LNTT', preview?.profitBeforeTax, 'VND'],
              ['CIT', preview?.cit, 'VND'],
              ['LNST', preview?.netProfit, 'VND'],
            ].map(([label, value, moneyCurrency]) => (
              <div key={String(label)} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>
                  {formatMoney(value || 0, String(moneyCurrency))}
                </div>
              </div>
            ))}
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Overall GM</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>
                {`${(((preview?.overallGm || 0) * 100)).toFixed(2)}%`}
              </div>
            </div>
            <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Net ROS</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>
                {`${(((preview?.netRos || 0) * 100)).toFixed(2)}%`}
              </div>
            </div>
          </div>
          <div style={{ ...ui.form.help, color: previewLoading ? tokens.colors.textPrimary : tokens.colors.textMuted }}>
            {previewLoading ? 'Đang tính preview tài chính...' : 'Preview này chỉ dùng quotation-summary math, không kéo rental/amortization vào workbook v1.'}
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={ui.btn.outline as any}>Đóng workbook</button>
          <button type="button" onClick={() => onSave(draft)} style={ui.btn.primary as any}>Áp dụng vào sản phẩm</button>
        </div>
      </div>
    </OverlayModal>
  );
}
