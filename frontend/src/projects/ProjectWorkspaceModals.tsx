import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { OverlayModal } from '../ui/OverlayModal';

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

function workflowStatusLabel(status?: string | null) {
  switch (status) {
    case 'draft':
      return 'Nháp';
    case 'signed':
      return 'Đã ký';
    case 'effective':
      return 'Hiệu lực';
    case 'planned':
      return 'Kế hoạch';
    case 'ordered':
      return 'Đã đặt';
    case 'partial':
      return 'Một phần';
    case 'delivered':
      return 'Đã giao';
    case 'pending':
      return 'Đang chờ';
    case 'completed':
      return 'Hoàn tất';
    case 'delayed':
      return 'Trễ hạn';
    case 'missing':
      return 'Thiếu';
    case 'requested':
      return 'Đang yêu cầu';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Bị từ chối';
    default:
      return status || 'Chưa cập nhật';
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
    <OverlayModal title={title} onClose={onClose} maxWidth="1180px" contentPadding="28px">
      {children}
    </OverlayModal>
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
            <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Hạng mục #{index + 1}</div>
            <button type="button" onClick={() => onChange(lineItems.filter((_: any, itemIndex: number) => itemIndex !== index))} style={{ ...S.btnOutline, color: tokens.colors.error, borderColor: tokens.colors.error }}>Xóa line</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div><label style={S.label}>MÃ HẠNG MỤC</label><input style={S.input} value={line.itemCode || ''} onInput={(e: any) => setLine(index, { itemCode: e.target.value })} /></div>
            <div><label style={S.label}>TÊN HẠNG MỤC</label><input style={S.input} value={line.itemName || ''} onInput={(e: any) => setLine(index, { itemName: e.target.value })} /></div>
          </div>
          <div><label style={S.label}>MÔ TẢ</label><textarea rows={2} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={line.description || ''} onInput={(e: any) => setLine(index, { description: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label style={S.label}>ĐƠN VỊ</label><input style={S.input} value={line.unit || ''} onInput={(e: any) => setLine(index, { unit: e.target.value })} /></div>
            <div><label style={S.label}>QTY HỢP ĐỒNG</label><input type="number" min="0" style={S.input} value={line.contractQty ?? 0} onInput={(e: any) => setLine(index, { contractQty: Number(e.target.value || 0) })} /></div>
            <div><label style={S.label}>ĐƠN GIÁ</label><input type="number" min="0" style={S.input} value={line.unitPrice ?? 0} onInput={(e: any) => setLine(index, { unitPrice: Number(e.target.value || 0) })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>{isAppendix ? 'SỐ PHỤ LỤC' : 'SỐ HỢP ĐỒNG'} *</label><input style={S.input} value={isAppendix ? value.appendixNumber || '' : value.contractNumber || ''} onInput={(e: any) => onChange({ ...value, [isAppendix ? 'appendixNumber' : 'contractNumber']: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || (isAppendix ? 'effective' : 'signed')} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="draft">{workflowStatusLabel('draft')}</option><option value="signed">{workflowStatusLabel('signed')}</option><option value="effective">{workflowStatusLabel('effective')}</option></select></div>
        </div>
        <div><label style={S.label}>TIÊU ĐỀ</label><input style={S.input} value={value.title || ''} onInput={(e: any) => onChange({ ...value, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>NGÀY KÝ</label><input type="date" style={S.input} value={value.signedDate || ''} onInput={(e: any) => onChange({ ...value, signedDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY HIỆU LỰC</label><input type="date" style={S.input} value={value.effectiveDate || ''} onInput={(e: any) => onChange({ ...value, effectiveDate: e.target.value })} /></div>
          <div><label style={S.label}>{isAppendix ? 'GIÁ TRỊ THAY ĐỔI' : 'TỔNG GIÁ TRỊ'}</label><input type="number" min="0" style={S.input} value={isAppendix ? value.totalDeltaValue ?? 0 : value.totalValue ?? 0} onInput={(e: any) => onChange({ ...value, [isAppendix ? 'totalDeltaValue' : 'totalValue']: Number(e.target.value || 0) })} /></div>
        </div>
        <div><label style={S.label}>TÓM TẮT</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.summary || ''} onInput={(e: any) => onChange({ ...value, summary: e.target.value })} /></div>
        <div><div style={{ ...S.label, marginBottom: '10px' }}>LINE HỢP ĐỒNG</div><ContractLineItemsEditor value={lineItems} onChange={(next: any) => onChange({ ...value, lineItems: next })} /></div>
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
    <Modal title="Cập nhật line mua hàng" onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.textPrimary }}>{contractQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Hợp đồng</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.primary }}>{orderedQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Đặt mua</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.info }}>{receivedQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Đã nhận</div></div>
          <div style={{ ...ui.card.kpi, padding: '14px' } as any}><div style={{ fontSize: '20px', fontWeight: 800, color: tokens.colors.success }}>{deliveredQty}</div><div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Đã giao</div></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={S.btnOutline} onClick={() => onChange({ ...value, orderedQty: contractQty })}>Đặt đủ theo HĐ</button>
          <button type="button" style={S.btnOutline} onClick={() => onChange({ ...value, orderedQty: orderedQty + remainingToOrder })} disabled={remainingToOrder <= 0}>Bù phần còn thiếu</button>
          <span style={{ ...shortageBadgeStyle(value.shortageStatus), alignSelf: 'center' }}>Thiếu {numberValue(value.shortageQty)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>NHÀ CUNG CẤP</label><select style={S.input} value={value.supplierId || ''} onChange={(e: any) => onChange({ ...value, supplierId: e.target.value })}><option value="">-- Chưa chọn NCC --</option>{supplierOptions.map((item: any) => <option key={item.id} value={item.id}>{item.companyName || item.name}</option>)}</select></div>
          <div><label style={S.label}>PO NUMBER</label><input style={S.input} value={value.poNumber || ''} onInput={(e: any) => onChange({ ...value, poNumber: e.target.value })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>QTY HỢP ĐỒNG</label><input style={{ ...S.input, background: '#f8fafc' }} disabled value={value.contractQty ?? 0} /></div>
          <div><label style={S.label}>QTY ĐÃ ĐẶT</label><input type="number" min="0" style={S.input} value={value.orderedQty ?? 0} onInput={(e: any) => onChange({ ...value, orderedQty: Number(e.target.value || 0) })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'planned'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="planned">{workflowStatusLabel('planned')}</option><option value="ordered">{workflowStatusLabel('ordered')}</option><option value="partial">{workflowStatusLabel('partial')}</option><option value="delivered">{workflowStatusLabel('delivered')}</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>ETA</label><input type="date" style={S.input} value={value.etaDate || ''} onInput={(e: any) => onChange({ ...value, etaDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY CAM KẾT GIAO</label><input type="date" style={S.input} value={value.committedDeliveryDate || ''} onInput={(e: any) => onChange({ ...value, committedDeliveryDate: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu line mua hàng'}</button></div>
    </Modal>
  );
}

export function MoveLineEditorModal({ value, procurementLines, onChange, onClose, onSave, saving, type }: any) {
  const lineOptions = ensureArray(procurementLines);
  const isInbound = type === 'inbound';
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isInbound ? (isEdit ? 'Cập nhật inbound' : 'Tạo inbound') : (isEdit ? 'Cập nhật giao hàng' : 'Tạo giao hàng')} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div><label style={S.label}>LINE MUA HÀNG *</label><select style={S.input} value={value.procurementLineId || ''} onChange={(e: any) => onChange({ ...value, procurementLineId: e.target.value })}><option value="">-- Chọn line --</option>{lineOptions.map((line: any) => <option key={line.id} value={line.id}>{line.itemCode || line.itemName} · Hợp đồng {line.contractQty}</option>)}</select></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>{isInbound ? 'QTY NHẬP' : 'QTY GIAO'}</label><input type="number" min="0" style={S.input} value={isInbound ? value.receivedQty ?? 0 : value.deliveredQty ?? 0} onInput={(e: any) => onChange({ ...value, [isInbound ? 'receivedQty' : 'deliveredQty']: Number(e.target.value || 0) })} /></div>
          <div><label style={S.label}>{isInbound ? 'ETA' : 'NGÀY CAM KẾT'}</label><input type="date" style={S.input} value={isInbound ? value.etaDate || '' : value.committedDate || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'etaDate' : 'committedDate']: e.target.value })} /></div>
          <div><label style={S.label}>{isInbound ? 'NGÀY NHẬP THỰC TẾ' : 'NGÀY GIAO THỰC TẾ'}</label><input type="date" style={S.input} value={isInbound ? value.actualReceivedDate || '' : value.actualDeliveryDate || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'actualReceivedDate' : 'actualDeliveryDate']: e.target.value })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>{isInbound ? 'RECEIPT REF' : 'DELIVERY REF'}</label><input style={S.input} value={isInbound ? value.receiptRef || '' : value.deliveryRef || ''} onInput={(e: any) => onChange({ ...value, [isInbound ? 'receiptRef' : 'deliveryRef']: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'partial'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="pending">{workflowStatusLabel('pending')}</option><option value="partial">{workflowStatusLabel('partial')}</option><option value="completed">{workflowStatusLabel('completed')}</option></select></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isInbound ? (isEdit ? 'Cập nhật inbound' : 'Lưu inbound') : (isEdit ? 'Cập nhật giao hàng' : 'Lưu giao hàng'))}</button></div>
    </Modal>
  );
}

export function MilestoneEditorModal({ value, onChange, onClose, onSave, saving }: any) {
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isEdit ? 'Cập nhật milestone' : 'Tạo milestone'} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>LOẠI MỐC</label><input style={S.input} value={value.milestoneType || ''} onInput={(e: any) => onChange({ ...value, milestoneType: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'pending'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="pending">{workflowStatusLabel('pending')}</option><option value="completed">{workflowStatusLabel('completed')}</option><option value="delayed">{workflowStatusLabel('delayed')}</option></select></div>
        </div>
        <div><label style={S.label}>TIÊU ĐỀ *</label><input style={S.input} value={value.title || ''} onInput={(e: any) => onChange({ ...value, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>NGÀY KẾ HOẠCH</label><input type="date" style={S.input} value={value.plannedDate || ''} onInput={(e: any) => onChange({ ...value, plannedDate: e.target.value })} /></div>
          <div><label style={S.label}>NGÀY THỰC TẾ</label><input type="date" style={S.input} value={value.actualDate || ''} onInput={(e: any) => onChange({ ...value, actualDate: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật milestone' : 'Lưu milestone')}</button></div>
    </Modal>
  );
}

export function DocumentChecklistEditorModal({ value, onChange, onClose, onSave, saving }: any) {
  const isEdit = Boolean(value?.id);

  return (
    <Modal title={isEdit ? 'Cập nhật checklist hồ sơ' : 'Thêm checklist hồ sơ'} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>MÃ HỒ SƠ</label><input style={S.input} value={value.documentCode || ''} onInput={(e: any) => onChange({ ...value, documentCode: e.target.value })} /></div>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'missing'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="missing">{workflowStatusLabel('missing')}</option><option value="requested">{workflowStatusLabel('requested')}</option><option value="pending">{workflowStatusLabel('pending')}</option><option value="approved">{workflowStatusLabel('approved')}</option><option value="rejected">{workflowStatusLabel('rejected')}</option></select></div>
        </div>
        <div><label style={S.label}>TÊN HỒ SƠ *</label><input style={S.input} value={value.documentName || ''} onInput={(e: any) => onChange({ ...value, documentName: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>PHÒNG BAN *</label><input style={S.input} value={value.department || ''} onInput={(e: any) => onChange({ ...value, department: e.target.value })} /></div>
          <div><label style={S.label}>NHÓM HỒ SƠ</label><input style={S.input} value={value.category || ''} onInput={(e: any) => onChange({ ...value, category: e.target.value })} /></div>
          <div><label style={S.label}>CẦN TẠI GIAI ĐOẠN</label><input style={S.input} value={value.requiredAtStage || ''} onInput={(e: any) => onChange({ ...value, requiredAtStage: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>NGÀY NHẬN</label><input type="date" style={S.input} value={value.receivedAt || ''} onInput={(e: any) => onChange({ ...value, receivedAt: e.target.value })} /></div>
        <div><label style={S.label}>GHI CHÚ</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.note || ''} onInput={(e: any) => onChange({ ...value, note: e.target.value })} /></div>
        <div style={{ height: '1px', background: tokens.colors.border, margin: '4px 0' }} />
        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review state</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div><label style={S.label}>TRẠNG THÁI REVIEW</label><select style={S.input} value={value.reviewStatus || 'draft'} onChange={(e: any) => onChange({ ...value, reviewStatus: e.target.value })}><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="changes_requested">Changes requested</option><option value="archived">Archived</option></select></div>
            <div><label style={S.label}>REVIEWER USER ID</label><input style={S.input} value={value.reviewerUserId || ''} onInput={(e: any) => onChange({ ...value, reviewerUserId: e.target.value })} /></div>
          </div>
          <div><label style={S.label}>REVIEW NOTE</label><textarea rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.reviewNote || ''} onInput={(e: any) => onChange({ ...value, reviewNote: e.target.value })} /></div>
          <div><label style={S.label}>STORAGE KEY</label><input style={S.input} value={value.storageKey || ''} onInput={(e: any) => onChange({ ...value, storageKey: e.target.value })} /></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật checklist' : 'Lưu checklist')}</button></div>
    </Modal>
  );
}

export function DocumentThreadModal({ document, threadSummary, messages, draft, onDraftChange, onSend, onClose, sending }: any) {
  return (
    <Modal title={`Thread hồ sơ: ${document?.documentName || document?.documentCode || document?.id || 'Document'}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={ui.badge.neutral}>Review {document?.reviewStatus || 'draft'}</span>
          <span style={threadSummary?.hasActiveThread ? ui.badge.info : ui.badge.warning}>
            {threadSummary?.hasActiveThread ? 'Thread active' : 'Chưa có thread'}
          </span>
          <span style={ui.badge.neutral}>{threadSummary?.messageCount || 0} messages</span>
        </div>
        <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
          {Array.isArray(messages) && messages.length > 0 ? messages.map((message: any) => (
            <div key={message.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>{message.authorName || message.authorUserId || 'System'}</div>
              <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{message.content}</div>
            </div>
          )) : <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có tin nhắn nào trong thread này.</div>}
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={S.label}>TIN NHẮN MỚI</label>
          <textarea rows={4} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={draft} onInput={(e: any) => onDraftChange(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        <button onClick={onSend} style={S.btnPrimary}>{sending ? 'Đang gửi...' : 'Gửi vào thread'}</button>
      </div>
    </Modal>
  );
}

export function BlockerEditorModal({ value, onChange, onClose, onSave, saving }: any) {
  const isEdit = Boolean(value?.id);
  return (
    <Modal title={isEdit ? 'Cập nhật blocker' : 'Thêm blocker'} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>TRẠNG THÁI</label><select style={S.input} value={value.status || 'open'} onChange={(e: any) => onChange({ ...value, status: e.target.value })}><option value="open">open</option><option value="watch">watch</option><option value="resolved">resolved</option></select></div>
          <div><label style={S.label}>MỨC ĐỘ</label><select style={S.input} value={value.tone || 'warning'} onChange={(e: any) => onChange({ ...value, tone: e.target.value })}><option value="warning">warning</option><option value="danger">danger</option><option value="info">info</option></select></div>
          <div><label style={S.label}>NHÓM</label><input style={S.input} value={value.category || ''} onInput={(e: any) => onChange({ ...value, category: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>TIÊU ĐỀ *</label><input style={S.input} value={value.title || ''} onInput={(e: any) => onChange({ ...value, title: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>OWNER ROLE</label><input style={S.input} value={value.ownerRole || ''} onInput={(e: any) => onChange({ ...value, ownerRole: e.target.value })} /></div>
          <div><label style={S.label}>ACTION LINK</label><input style={S.input} value={value.action || ''} onInput={(e: any) => onChange({ ...value, action: e.target.value })} /></div>
          <div><label style={S.label}>SOURCE</label><input style={S.input} value={value.source || 'manual'} onInput={(e: any) => onChange({ ...value, source: e.target.value })} /></div>
        </div>
        <div><label style={S.label}>MÔ TẢ</label><textarea rows={4} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} value={value.detail || ''} onInput={(e: any) => onChange({ ...value, detail: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>LINKED ENTITY TYPE</label><input style={S.input} value={value.linkedEntityType || ''} onInput={(e: any) => onChange({ ...value, linkedEntityType: e.target.value })} /></div>
          <div><label style={S.label}>LINKED ENTITY ID</label><input style={S.input} value={value.linkedEntityId || ''} onInput={(e: any) => onChange({ ...value, linkedEntityId: e.target.value })} /></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnOutline}>Hủy</button><button onClick={onSave} style={S.btnPrimary}>{saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật blocker' : 'Lưu blocker')}</button></div>
    </Modal>
  );
}

export function AuditTrailDetailModal({ item, onClose }: any) {
  return (
    <Modal title="Chi tiết audit / history" onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item?.title || 'Audit item'}</div>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7 }}>{item?.detail || 'Không có mô tả.'}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {item?.source ? <span style={ui.badge.info}>{item.source}</span> : null}
            {item?.category ? <span style={ui.badge.neutral}>{item.category}</span> : null}
            {item?.status ? <span style={ui.badge.warning}>{item.status}</span> : null}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>ACTOR</label><div style={S.input}>{item?.actor || item?.meta || 'system'}</div></div>
          <div><label style={S.label}>EVENT DATE</label><div style={S.input}>{item?.eventDate || '—'}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>ACTOR ROLES</label><div style={S.input}>{item?.actorRoles || item?.actingCapability || '—'}</div></div>
          <div><label style={S.label}>CATEGORY</label><div style={S.input}>{item?.category || '—'}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          <div><label style={S.label}>ENTITY TYPE</label><div style={S.input}>{item?.linkedEntityType || item?.entityType || '—'}</div></div>
          <div><label style={S.label}>ENTITY ID</label><div style={S.input}>{item?.linkedEntityId || item?.entityId || '—'}</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}><button onClick={onClose} style={S.btnPrimary}>Đóng</button></div>
    </Modal>
  );
}
