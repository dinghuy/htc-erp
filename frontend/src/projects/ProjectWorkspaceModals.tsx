import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '8px' } as any,
};

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function shortageBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block',
  };
  switch (status) {
    case 'fulfilled':
    case 'ordered_complete':
      return { ...base, ...ui.badge.success };
    case 'partial':
    case 'ordered_short':
      return { ...base, ...ui.badge.warning };
    case 'pending':
      return { ...base, ...ui.badge.error };
    default:
      return { ...base, ...ui.badge.neutral };
  }
}

function emptyContractLine() {
  return {
    itemCode: '',
    itemName: '',
    description: '',
    unit: '',
    contractQty: 0,
    unitPrice: 0,
    etaDate: '',
    committedDeliveryDate: '',
  };
}

function Modal({ title, children, onClose }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: tokens.colors.textPrimary, opacity: 0.7 }} />
      <div style={{ ...ui.modal.shell, width: '100%', maxWidth: '1180px', position: 'relative', zIndex: 1, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${tokens.colors.border}`, background: tokens.colors.background, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: tokens.colors.textMuted }}>&times;</button>
        </div>
        <div style={{ padding: '28px' }}>{children}</div>
      </div>
    </div>
  );
}

function ContractLineItemsEditor({ value, onChange }: any) {
  const lineItems = ensureArray(value);
  const setLine = (index: number, patch: any) => {
    const next = lineItems.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item);
    onChange(next);
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {lineItems.map((line: any, index: number) => (
        <div key={`${line.itemCode || 'line'}-${index}`} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Line #{index + 1}</div>
            <button type="button" onClick={() => onChange(lineItems.filter((_: any, itemIndex: number) => itemIndex !== index))} style={{ ...S.btnOutline, color: tokens.colors.error, borderColor: tokens.colors.error }}>Xóa line</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={S.label}>MÃ HẠNG MỤC</label><input style={S.input} value={line.itemCode || ''} onInput={(e: any) => setLine(index, { itemCode: e.target.value })} /></div>
            <div><label style={S.label}>TÊN HẠNG MỤC</label><input style={S.input} value={line.itemName || ''} onInput={(e: any) => setLine(index, { itemName: e.target.value })} /></div>
          </div>
          <div><label style={S.label}>MÔ TẢ</label><textarea rows={2} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={line.description || ''} onInput={(e: any) => setLine(index, { description: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={S.label}>ĐƠN VỊ</label><input style={S.input} value={line.unit || ''} onInput={(e: any) => setLine(index, { unit: e.target.value })} /></div>
            <div><label style={S.label}>QTY HỢP ĐỒNG</label><input type="number" min="0" style={S.input} value={line.contractQty ?? 0} onInput={(e: any) => setLine(index, { contractQty: Number(e.target.value || 0) })} /></div>
            <div><label style={S.label}>ĐƠN GIÁ</label><input type="number" min="0" style={S.input} value={line.unitPrice ?? 0} onInput={(e: any) => setLine(index, { unitPrice: Number(e.target.value || 0) })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={S.label}>ETA</label><input type="date" style={S.input} value={line.etaDate || ''} onInput={(e: any) => setLine(index, { etaDate: e.target.value })} /></div>
            <div><label style={S.label}>NGÀY CAM KẾT GIAO</label><input type="date" style={S.input} value={line.committedDeliveryDate || ''} onInput={(e: any) => setLine(index, { committedDeliveryDate: e.target.value })} /></div>
          </div>
        </div>
      ))}
      <button type="button" style={S.btnOutline} onClick={() => onChange([...lineItems, emptyContractLine()])}>+ Thêm line hợp đồng</button>
    </div>
  );
}

export function ContractEditorModal({ value, onChange, onClose, onSave, saving, isAppendix = false }: any) {
  const lineItems = ensureArray(value?.lineItems).length > 0 ? ensureArray(value?.lineItems) : [emptyContractLine()];
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isAppendix ? (isEdit ? 'Cập nhật Phụ lục hợp đồng' : 'Tạo Phụ lục hợp đồng') : (isEdit ? 'Cập nhật Hợp đồng chính' : 'Tạo Hợp đồng chính')} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>{isAppendix ? 'SỐ PHỤ LỤC' : 'SỐ HỢP ĐỒNG'} *</label><input style={S.input} value={isAppendix ? value.appendixNumber || '' : value.contractNumber || ''} onInput={(e: any) => onChange({ ...value, [isAppendix ? 'appendixNumber' : 'contractNumber']: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || (isAppendix ? 'effective' : 'signed')} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="draft">draft</option><option value="signed">signed</option><option value="effective">effective</option></select></div>
        </div>
        <div><label style={S.label}>TIÊU ĐỀ</label><input style={S.input} value={value.title || ''} onInput={(e: any) => onChange({ ...value, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>NGÀY KÝ</label><input type="date" style={S.input} value={value.signedDate || ''} onInput={(e: any) => onChange({ ...value, signedDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY HIỆU LỰC</label><input type="date" style={S.input} value={value.effectiveDate || ''} onInput={(e: any) => onChange({ ...value, effectiveDate: e.target.value })} /></div>
          <div><label style={S.label}>{isAppendix ? 'GIÁ TRỊ THAY ĐỔI' : 'TỔNG GIÁ TRỊ'}</label><input type="number" min="0" style={S.input} value={isAppendix ? value.totalDeltaValue ?? 0 : value.totalValue ?? 0} onInput={(e: any) => onChange({ ...value, [isAppendix ? 'totalDeltaValue' : 'totalValue']: Number(e.target.value || 0) })} /></div>
        </div>
        <div><label style={S.label}>TÓM TẮT</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.summary || ''} onInput={(e: any) => onChange({ ...value, summary: e.target.value })} /></div>
        <div><div style={{ ...S.label, marginBottom: '10px' }}>LINE ITEMS</div><ContractLineItemsEditor value={lineItems} onChange={(next: any) => onChange({ ...value, lineItems: next })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isAppendix ? (isEdit ? 'Cập nhật Phụ lục' : 'Lưu Phụ lục') : (isEdit ? 'Cập nhật Hợp đồng' : 'Lưu Hợp đồng'))}</button></div>
    </Modal>
  );
}

export function ProcurementEditorModal({ value, suppliers, onChange, onClose, onSave, saving }: any) {
  const supplierOptions = ensureArray(suppliers);
  const contractQty = numberValue(value.contractQty);
  const orderedQty = numberValue(value.orderedQty);
  const receivedQty = numberValue(value.receivedQty);
  const deliveredQty = numberValue(value.deliveredQty);
  const remainingToOrder = Math.max(contractQty - orderedQty, 0);
  return (
    <Modal title="Cập nhật Procurement Line" onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.textPrimary }}>{contractQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Contract</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.primary }}>{orderedQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Ordered</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.info }}>{receivedQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Received</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.success }}>{deliveredQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Delivered</div></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={S.btnOutline} onClick={() => onChange({ ...value, orderedQty: contractQty })}>Đặt đủ theo HĐ</button>
          <button type="button" style={S.btnOutline} onClick={() => onChange({ ...value, orderedQty: orderedQty + remainingToOrder })} disabled={remainingToOrder <= 0}>Bù phần còn thiếu</button>
          <span style={{ ...shortageBadgeStyle(value.shortageStatus), alignSelf: 'center' }}>Thiếu {numberValue(value.shortageQty)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>NHÀ CUNG CẤP</label><select style={S.input} value={value.supplierId || ''} onChange={(e: any) => onChange({ ...value, supplierId: e.target.value })}><option value="">-- Chưa chọn NCC --</option>{supplierOptions.map((item: any) => <option key={item.id} value={item.id}>{item.companyName || item.name}</option>)}</select></div>
          <div><label style={S.label}>PO NUMBER</label><input style={S.input} value={value.poNumber || ''} onInput={(e: any) => onChange({ ...value, poNumber: e.target.value })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>QTY HỢP ĐỒNG</label><input style={{ ...S.input, background: '#f8fafc' }} disabled value={value.contractQty ?? 0} /></div>
          <div><label style={S.label}>QTY ĐÃ ĐẶT</label><input type="number" min="0" style={S.input} value={value.orderedQty ?? 0} onInput={(e: any) => onChange({ ...value, orderedQty: Number(e.target.value || 0) })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'planned'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="planned">planned</option><option value="ordered">ordered</option><option value="partial">partial</option><option value="delivered">delivered</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>ETA</label><input type="date" style={S.input} value={value.etaDate || ''} onInput={(e: any) => onChange({ ...value, etaDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY CAM KẾT GIAO</label><input type="date" style={S.input} value={value.committedDeliveryDate || ''} onInput={(e: any) => onChange({ ...value, committedDeliveryDate: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Procurement'}</button></div>
    </Modal>
  );
}

export function MoveLineEditorModal({ value, procurementLines, onChange, onClose, onSave, saving, type }: any) {
  const lineOptions = ensureArray(procurementLines);
  const isInbound = type === 'inbound';
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isInbound ? (isEdit ? 'Cập nhật Inbound' : 'Tạo Inbound') : (isEdit ? 'Cập nhật Delivery' : 'Tạo Delivery')} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div><label style={S.label}>PROCUREMENT LINE *</label><select style={S.input} value={value.procurementLineId || ''} onChange={(e: any) => onChange({ ...value, procurementLineId: e.target.value })}><option value="">-- Chọn line --</option>{lineOptions.map((line: any) => <option key={line.id} value={line.id}>{line.itemCode || line.itemName} · Contract {line.contractQty}</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>{isInbound ? 'QTY NHẬP' : 'QTY GIAO'}</label><input type="number" min="0" style={S.input} value={isInbound ? value.receivedQty ?? 0 : value.deliveredQty ?? 0} onInput={(e: any) => onChange({ ...value, [isInbound ? 'receivedQty' : 'deliveredQty']: Number(e.target.value || 0) })} /></div>
          <div><label style={S.label}>{isInbound ? 'ETA' : 'NGÀY CAM KẾT'}</label><input type="date" style={S.input} value={isInbound ? value.etaDate || '' : value.committedDate || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'etaDate' : 'committedDate']: e.target.value })} /></div>
          <div><label style={S.label}>{isInbound ? 'NGÀY NHẬP THỰC TẾ' : 'NGÀY GIAO THỰC TẾ'}</label><input type="date" style={S.input} value={isInbound ? value.actualReceivedDate || '' : value.actualDeliveryDate || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'actualReceivedDate' : 'actualDeliveryDate']: e.target.value })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>{isInbound ? 'RECEIPT REF' : 'DELIVERY REF'}</label><input style={S.input} value={isInbound ? value.receiptRef || '' : value.deliveryRef || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'receiptRef' : 'deliveryRef']: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'partial'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="pending">pending</option><option value="partial">partial</option><option value="completed">completed</option></select></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isInbound ? (isEdit ? 'Cập nhật Inbound' : 'Lưu Inbound') : (isEdit ? 'Cập nhật Delivery' : 'Lưu Delivery'))}</button></div>
    </Modal>
  );
}

export function MilestoneEditorModal({ value, onChange, onClose, onSave, saving }: any) {
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isEdit ? 'Cập nhật Milestone' : 'Tạo Milestone'} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>LOẠI MỐC</label><input style={S.input} value={value.milestoneType || ''} onInput={(e: any) => onChange({ ...value, milestoneType: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'pending'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="pending">pending</option><option value="completed">completed</option><option value="delayed">delayed</option></select></div>
        </div>
        <div><label style={S.label}>TIÊU ĐỀ *</label><input style={S.input} value={value.title || ''} onInput={(e: any) => onChange({ ...value, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={S.label}>NGÀY KẾ HOẠCH</label><input type="date" style={S.input} value={value.plannedDate || ''} onInput={(e: any) => onChange({ ...value, plannedDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY THỰC TẾ</label><input type="date" style={S.input} value={value.actualDate || ''} onInput={(e: any) => onChange({ ...value, actualDate: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật Milestone' : 'Lưu Milestone')}</button></div>
    </Modal>
  );
}
