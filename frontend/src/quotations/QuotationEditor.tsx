import { PageHeader } from '../ui/PageHeader';
import { tokens } from '../ui/tokens';
import { EyeIcon, NoteIcon, QuoteIcon } from '../ui/icons';
import { FormField, ProductModal } from './QuotationComponents';
import { QuotationActionButtons, QuotationPreviewPanel } from './QuotationPreviewBlocks';
import { CURRENCIES, UNITS, hasQbuStaleWarning, hasRateIncreaseWarning, hasSnapshotMissingWarning, isLegacyStatus, quotationStyles } from './quotationShared';


const S = quotationStyles;

export type QuotationEditorProps = {
  isMobile?: boolean;
  showProdModal: boolean;
  setShowProdModal: (value: boolean) => void;
  productsDB: any[];
  addItem: (product: any) => void;
  latestUsdVndRate: number | null;
  latestUsdVndWarnings: string[];
  productCatalogError: string;
  setShowForm: (value: boolean) => void;
  setEditingQuoteId: (value: string | null) => void;
  quoteStatus: string;
  currentEditingQuote: any;
  mobileTab: 'form' | 'preview';
  setMobileTab: (value: 'form' | 'preview') => void;
  quoteNumber: string;
  setQuoteNumber: (value: string) => void;
  quoteDate: string;
  setQuoteDate: (value: string) => void;
  projects: any[];
  selectedProjectId: string;
  setSelectedProjectId: (value: string) => void;
  revisionNo: number;
  setRevisionNo: (value: number) => void;
  revisionLabel: string;
  setRevisionLabel: (value: string) => void;
  changeReason: string;
  setChangeReason: (value: string) => void;
  subject: string;
  setSubject: (value: string) => void;
  selectedProject: any;
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
  setItems: (items: any[]) => void;
  updateItem: (index: number, field: string, value: any) => void;
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
  totals: { subtotal: number; taxTotal: number; grandTotal: number };
  editingQuoteId: string | null;
  updateStatus: (id: string, currentStatus: string, nextStatus: string) => Promise<void>;
  saveQuotation: (status?: string) => Promise<void>;
  savingQuote: boolean;
};

export function QuotationEditor(props: QuotationEditorProps) {
  const {
    isMobile,
    showProdModal,
    setShowProdModal,
    productsDB,
    addItem,
    latestUsdVndRate,
    latestUsdVndWarnings,
    productCatalogError,
    setShowForm,
    setEditingQuoteId,
    quoteStatus,
    currentEditingQuote,
    mobileTab,
    setMobileTab,
    quoteNumber,
    setQuoteNumber,
    quoteDate,
    setQuoteDate,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    revisionNo,
    setRevisionNo,
    revisionLabel,
    setRevisionLabel,
    changeReason,
    setChangeReason,
    subject,
    setSubject,
    selectedProject,
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
    setItems,
    updateItem,
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
    updateStatus,
    saveQuotation,
    savingQuote,
  } = props;

  const isReadOnly = quoteStatus === 'accepted' || quoteStatus === 'rejected' || isLegacyStatus(quoteStatus);
  const showRemind = quoteStatus === 'sent' && currentEditingQuote?.isRemind;
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

  const formPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>0. Tiêu đề & Ngày Báo giá</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Số báo giá (Nhập thủ công)">
              <input
                type="text"
                placeholder="VD: 059-26/BG/LD-PEQ-CHP"
                style={S.input}
                value={quoteNumber}
                onInput={(event: any) => setQuoteNumber(event.target.value)}
              />
            </FormField>
            <FormField label="Ngày báo giá">
              <input type="date" style={S.input} value={quoteDate} onInput={(event: any) => setQuoteDate(event.target.value)} />
            </FormField>
            <FormField label="Project / Deal Workspace" span={2}>
              <select style={S.select} value={selectedProjectId} onChange={(event: any) => setSelectedProjectId(event.target.value)}>
                <option value="">-- Chưa chọn project (hệ thống sẽ tự tạo nếu lưu mới) --</option>
                {projects.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.code ? `${project.code} · ` : ''}
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Revision" span={2}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 160px 1fr', gap: '12px' }}>
                <input
                  type="number"
                  min={1}
                  style={S.input}
                  value={revisionNo}
                  onInput={(event: any) => setRevisionNo(Number(event.target.value || 1))}
                />
                <input type="text" style={S.input} value={revisionLabel} onInput={(event: any) => setRevisionLabel(event.target.value)} />
                <input
                  type="text"
                  placeholder="Lý do thay đổi / ghi chú revision"
                  style={S.input}
                  value={changeReason}
                  onInput={(event: any) => setChangeReason(event.target.value)}
                />
              </div>
            </FormField>
            <FormField label="Subject / Nội dung báo giá" span={2}>
              <input
                type="text"
                placeholder="VD: Báo giá xe nâng Reach Stacker cho Cảng Hải Phòng"
                style={S.input}
                value={subject}
                onInput={(event: any) => setSubject(event.target.value)}
              />
            </FormField>
            {selectedProject && (
              <div
                style={{
                  gridColumn: '1/-1',
                  background: tokens.colors.background,
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: tokens.colors.textSecondary,
                  border: `1px solid ${tokens.colors.border}`,
                }}
              >
                Workspace hiện tại: <strong>{selectedProject.name}</strong>{' '}
                {selectedProject.projectStage ? `· stage ${selectedProject.projectStage}` : ''}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>1. Thông tin Khách hàng</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Chọn Account (Công ty / Cảng)" span={2}>
              <select
                style={S.select}
                value={selectedAccId}
                onChange={(event: any) => {
                  setSelectedAccId(event.target.value);
                  setSelectedContactId('');
                }}
              >
                <option value="">-- Chọn Khách hàng --</option>
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
          <div style={S.sectionTitle}>2. Thông tin Sales / NV Phụ trách</div>
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
            <FormField label="Chọn từ danh sách Nhân viên" span={2}>
              <select style={S.select} onChange={(event: any) => handleSalespersonSelect(event.target.value)}>
                <option value="">-- Chọn Nhân viên phụ trách --</option>
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
                    {salespersons.map((salespersonOption) => (
                      <option key={salespersonOption.id} value={salespersonOption.id}>
                        {salespersonOption.name} {salespersonOption.phone ? `(${salespersonOption.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FormField>
            <FormField label="Tên NV Sale (hoặc nhập tay)">
              <input
                type="text"
                placeholder="VD: Huy"
                style={S.input}
                value={salesperson}
                onInput={(event: any) => setSalesperson(event.target.value)}
              />
            </FormField>
            <FormField label="SĐT NV Sale (Phone/ĐT trên PDF)">
              <input
                type="text"
                placeholder="VD: 0345 216497"
                style={S.input}
                value={salespersonPhone}
                onInput={(event: any) => setSalespersonPhone(event.target.value)}
              />
            </FormField>
            <FormField label="Đơn vị tiền tệ (Crcy)">
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

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={S.sectionTitle}>3. Sản phẩm & Cấu trúc giá</div>
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
          {items.length === 0 ? (
            <div
              style={{
                minHeight: '90px',
                border: `2px dashed ${tokens.colors.border}`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.textMuted,
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              Chưa có sản phẩm. Nhấn nút bên dưới để chọn từ database.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '14px',
                  background: tokens.colors.background,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, color: tokens.colors.primary }}>
                    #{idx + 1} — {item.sku}: {item.name}
                  </div>
                  <button
                    style={{ ...S.btnGhost, color: tokens.colors.error, fontSize: '18px' }}
                    onClick={() => setItems(items.filter((_: any, itemIndex: number) => itemIndex !== idx))}
                  >
                    ×
                  </button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={S.label}>ĐVT (Unit)</label>
                    <select style={S.select} value={item.unit} onChange={(event: any) => updateItem(idx, 'unit', event.target.value)}>
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
                      min="1"
                      value={item.quantity}
                      onInput={(event: any) => updateItem(idx, 'quantity', event.target.value)}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Đơn giá ({currency})</label>
                    <input value={item.unitPrice} onInput={(event: any) => updateItem(idx, 'unitPrice', event.target.value)} style={S.input} />
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={S.label}>Thông số kỹ thuật (Commodity)</label>
                  <textarea
                    rows={5}
                    value={item.technicalSpecs}
                    onInput={(event: any) => updateItem(idx, 'technicalSpecs', event.target.value)}
                    style={{ ...S.input, background: tokens.colors.surface, fontFamily: 'var(--font-family-sans)', fontSize: '12px', resize: 'vertical' }}
                    placeholder={
                      '- Nhãn hiệu: SOCMA\n- Model: HNRS4531\n- Xuất xứ: Trung Quốc\n- Tình trạng: Mới 100%\n- Năm SX: 2025 trở về sau\n- Tải trọng: 45T, 31T, 16T\n- Chiều cao nâng: 15100mm'
                    }
                  />
                </div>
                <div>
                  <label style={S.label}>Ghi chú / Remarks</label>
                  <input
                    type="text"
                    value={item.remarks}
                    onInput={(event: any) => updateItem(idx, 'remarks', event.target.value)}
                    style={{ ...S.input, background: tokens.colors.surface }}
                    placeholder="Ghi chú đặc biệt..."
                  />
                </div>
                <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 800, color: tokens.colors.primary }}>
                  Thành tiền: {(parseFloat(item.unitPrice || 0) * parseInt(item.quantity || 1)).toLocaleString()} {currency}
                </div>
              </div>
            ))
          )}
          <button
            onClick={() => setShowProdModal(true)}
            style={{
              ...S.btnOutline,
              width: '100%',
              color: tokens.colors.info,
              borderColor: tokens.colors.info,
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            + Thêm Sản phẩm từ Database
          </button>
        </div>

        <div style={{ ...S.card, padding: '24px' }}>
          <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            4. Điều khoản & Ghi chú (Terms)
            <button
              onClick={handleTranslate}
              style={{ ...S.btnOutline, color: tokens.colors.warning, borderColor: tokens.colors.warning, padding: '4px 12px', fontSize: '13px' }}
              disabled={translating}
            >
              {translating ? 'Đang dịch...' : 'Dịch toàn bộ sang Tiếng Anh'}
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>Ghi chú chung (Remarks)</label>
            <textarea
              rows={3}
              value={terms.remarks}
              onInput={(event: any) => setTerms({ ...terms, remarks: event.target.value })}
              style={S.input}
              placeholder="Nhập ghi chú chung bằng Tiếng Việt (nếu có)..."
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <FormField label="Nội dung Tiếng Việt">
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
                  <FormField label="Nội dung Tiếng Anh">
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
                  termItems: [...(terms.termItems || []), { labelViPrint: 'Điều khoản mới', labelEn: 'New Term', textVi: '', textEn: '' }],
                })
              }
              style={{ ...S.btnOutline, width: '100%', borderColor: tokens.colors.success, color: tokens.colors.success, justifyContent: 'center' }}
            >
              + Thêm Điều Khoản Mới
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
      showRemind={showRemind}
      editingQuoteId={editingQuoteId}
      quoteStatus={quoteStatus}
      updateStatus={updateStatus}
      saveQuotation={saveQuotation}
      savingQuote={savingQuote}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '24px', alignItems: 'start' }}>
          {formPanel}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {actionButtons}
            {previewPanel}
          </div>
        </div>
      )}
    </div>
  );
}
