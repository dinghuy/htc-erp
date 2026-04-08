import { useState } from 'preact/hooks';
import { OverlayModal } from '../ui/OverlayModal';
import { ImportIcon } from '../ui/icons';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import {
  buildProductImportPreviewSummary,
  buildProductImportSummary,
  type ProductImportPreviewReport,
  type ProductImportReport,
} from './importReport';

export function ProductImportReportModal({
  report,
  onClose,
  primaryButtonStyle,
}: {
  report: ProductImportReport;
  onClose: () => void;
  primaryButtonStyle: any;
}) {
  const actionLabel = {
    created: 'Tạo mới',
    updated: 'Cập nhật',
    skipped: 'Bỏ qua',
    error: 'Lỗi',
  } as const;

  const actionStyle = {
    created: ui.badge.success,
    updated: ui.badge.info,
    skipped: ui.badge.neutral,
    error: ui.badge.error,
  } as const;

  return (
    <OverlayModal title="Kết quả import sản phẩm" onClose={onClose} maxWidth="860px" contentPadding="24px">
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
            {buildProductImportSummary(report)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={report.mode === 'replace' ? ui.badge.warning : ui.badge.info}>
              {report.mode === 'replace' ? 'Replace toàn phần' : 'Merge an toàn'}
            </span>
            {report.clearImages ? <span style={ui.badge.warning}>Reset ảnh</span> : null}
            {report.clearVideos ? <span style={ui.badge.warning}>Reset video</span> : null}
            {report.clearDocuments ? <span style={ui.badge.warning}>Reset tài liệu</span> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Tổng dòng', value: report.totalRows, tone: tokens.colors.textPrimary },
            { label: 'Tạo mới', value: report.created, tone: tokens.colors.success },
            { label: 'Cập nhật', value: report.updated, tone: tokens.colors.info },
            { label: 'Bỏ qua', value: report.skipped, tone: tokens.colors.textSecondary },
            { label: 'Lỗi', value: report.errors, tone: tokens.colors.error },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                ...ui.card.base,
                padding: '16px',
                boxShadow: 'none',
                border: `1px solid ${tokens.colors.border}`,
                display: 'grid',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: tokens.colors.textMuted }}>{item.label}</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: item.tone }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
          {report.rows.map((row) => (
            <div
              key={`${row.rowNumber}-${row.sku || 'empty'}`}
              style={{
                ...ui.card.base,
                boxShadow: 'none',
                border: `1px solid ${tokens.colors.border}`,
                padding: '14px 16px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>Dòng {row.rowNumber}</strong>
                  <span style={actionStyle[row.action]}>{actionLabel[row.action]}</span>
                  <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>SKU: {row.sku || 'Chưa có'}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                {row.messages.length > 0 ? row.messages.map((message, index) => (
                  <div key={`${row.rowNumber}-${index}`} style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                    {message}
                  </div>
                )) : (
                  <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Không có ghi chú bổ sung.</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...primaryButtonStyle, padding: '10px 20px', minWidth: '120px' }}>Đóng báo cáo</button>
        </div>
      </div>
    </OverlayModal>
  );
}

export function ProductImportWizardModal({
  selectedFileName,
  preview,
  importing,
  selectedDuplicateSkus,
  onClose,
  onPickFile,
  onAnalyze,
  onImportNewOnly,
  onReplaceDuplicates,
  onToggleDuplicate,
  onSelectAllDuplicates,
  onClearAllDuplicates,
  outlineButtonStyle,
  primaryButtonStyle,
}: {
  selectedFileName: string;
  preview: ProductImportPreviewReport | null;
  importing: boolean;
  selectedDuplicateSkus: string[];
  onClose: () => void;
  onPickFile: () => void;
  onAnalyze: () => void;
  onImportNewOnly: () => void;
  onReplaceDuplicates: () => void;
  onToggleDuplicate: (sku: string) => void;
  onSelectAllDuplicates: () => void;
  onClearAllDuplicates: () => void;
  outlineButtonStyle: any;
  primaryButtonStyle: any;
}) {
  const [expandedCompareSkus, setExpandedCompareSkus] = useState<string[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'duplicate' | 'error' | 'new'>('all');
  const duplicateCount = preview?.duplicateRows || 0;
  const selectedReplaceCount = selectedDuplicateSkus.length;
  const skippedDuplicateCount = Math.max(duplicateCount - selectedReplaceCount, 0);
  const filteredPreviewRows = (preview?.rows || []).filter((row) => {
    if (previewFilter === 'all') return true;
    return row.action === previewFilter;
  });

  return (
    <OverlayModal
      title="Nhập sản phẩm hàng loạt"
      subtitle="Tải file lên, để hệ thống rà SKU trùng trước, rồi mới quyết định chỉ nhập mới hay replace toàn bộ sản phẩm trùng."
      onClose={onClose}
      maxWidth="820px"
      contentPadding="24px 28px"
      placement="center"
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            {
              step: '01',
              title: 'Chọn file',
              body: selectedFileName ? selectedFileName : 'CSV hoặc XLSX theo mẫu import sản phẩm',
              tone: tokens.colors.info,
            },
            {
              step: '02',
              title: 'Phân tích duplicate',
              body: preview ? `${preview.duplicateRows} SKU trùng · ${preview.newRows} SKU mới` : 'Kiểm tra SKU đã tồn tại trước khi ghi dữ liệu',
              tone: preview?.duplicateRows ? tokens.colors.warningDark : tokens.colors.success,
            },
            {
              step: '03',
              title: 'Quyết định nhập',
              body: preview
                ? preview.duplicateRows > 0
                  ? 'Chọn chỉ nhập sản phẩm mới hoặc replace toàn bộ dòng trùng'
                  : 'Không có duplicate, có thể nhập ngay'
                : 'Sau khi phân tích, hệ thống sẽ cho bạn chọn cách xử lý dòng trùng',
              tone: preview?.duplicateRows ? tokens.colors.warningDark : tokens.colors.textSecondary,
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${tokens.colors.border}`, padding: '16px', display: 'grid', gap: '8px' }}
            >
              <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: item.tone }}>{item.step}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{item.title}</span>
              <span style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{item.body}</span>
            </div>
          ))}
        </div>

        <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${tokens.colors.border}`, padding: '18px', display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Nguồn dữ liệu</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary, marginTop: '4px' }}>
                {selectedFileName || 'Chưa chọn file import'}
              </div>
            </div>
            <button type="button" style={outlineButtonStyle} onClick={onPickFile}>
              <ImportIcon size={14} /> {selectedFileName ? 'Đổi file' : 'Chọn file'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
            Hỗ trợ `.csv` và `.xlsx`. Mẫu import vẫn được tải từ nút `Mẫu import` trên toolbar.
          </div>
        </div>

        {!preview ? (
          <div style={{ borderRadius: '18px', border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '16px 18px', display: 'grid', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Bước tiếp theo</div>
            <div style={{ fontSize: '14px', color: tokens.colors.textPrimary, lineHeight: 1.7 }}>
              {selectedFileName
                ? `File ${selectedFileName} đã sẵn sàng để phân tích duplicate theo SKU.`
                : 'Chọn file trước, sau đó bấm Phân tích file để xem sản phẩm mới, sản phẩm trùng và dòng lỗi.'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${tokens.colors.border}`, padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
                  {buildProductImportPreviewSummary(preview)}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={ui.badge.success}>{preview.newRows} mới</span>
                  <span style={preview.duplicateRows > 0 ? ui.badge.warning : ui.badge.info}>{preview.duplicateRows} trùng</span>
                  <span style={preview.errorRows > 0 ? ui.badge.error : ui.badge.neutral}>{preview.errorRows} lỗi</span>
                  {preview.duplicateRows > 0 ? (
                    <>
                      <button type="button" onClick={onSelectAllDuplicates} style={{ ...outlineButtonStyle, padding: '7px 12px' }}>
                        Chọn tất cả dòng trùng
                      </button>
                      <button type="button" onClick={onClearAllDuplicates} style={{ ...outlineButtonStyle, padding: '7px 12px' }}>
                        Bỏ chọn tất cả
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'all' as const, label: `Tất cả (${preview.totalRows})`, tone: previewFilter === 'all' ? tokens.colors.primary : tokens.colors.textSecondary },
                  { key: 'duplicate' as const, label: `SKU trùng (${preview.duplicateRows})`, tone: previewFilter === 'duplicate' ? tokens.colors.warningDark : tokens.colors.textSecondary },
                  { key: 'error' as const, label: `Dòng lỗi (${preview.errorRows})`, tone: previewFilter === 'error' ? tokens.colors.error : tokens.colors.textSecondary },
                  { key: 'new' as const, label: `Sản phẩm mới (${preview.newRows})`, tone: previewFilter === 'new' ? tokens.colors.success : tokens.colors.textSecondary },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreviewFilter(item.key)}
                    style={{
                      ...outlineButtonStyle,
                      padding: '7px 12px',
                      borderColor:
                        previewFilter === item.key
                          ? item.key === 'duplicate'
                            ? tokens.colors.warningBorder
                            : item.key === 'error'
                              ? tokens.colors.badgeBgError
                              : item.key === 'new'
                                ? tokens.colors.successTint
                                : 'rgba(59, 130, 246, 0.24)'
                          : tokens.colors.border,
                      background:
                        previewFilter === item.key
                          ? item.key === 'duplicate'
                            ? tokens.colors.warningBg
                            : item.key === 'error'
                              ? tokens.colors.badgeBgError
                              : item.key === 'new'
                                ? tokens.colors.successTint
                                : 'rgba(59, 130, 246, 0.1)'
                          : tokens.colors.surface,
                      color: item.tone,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredPreviewRows.map((row) => (
                  <div
                    key={`${row.rowNumber}-${row.sku || 'empty'}`}
                    style={{ ...ui.card.base, boxShadow: 'none', border: `1px solid ${row.action === 'duplicate' ? tokens.colors.warningBorder : tokens.colors.border}`, padding: '14px 16px', display: 'grid', gap: '8px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>Dòng {row.rowNumber}</strong>
                        <span style={row.action === 'new' ? ui.badge.success : row.action === 'duplicate' ? ui.badge.warning : ui.badge.error}>
                          {row.action === 'new' ? 'Mới' : row.action === 'duplicate' ? 'Trùng SKU' : 'Lỗi'}
                        </span>
                        <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>SKU: {row.sku || 'Chưa có'}</span>
                      </div>
                      {row.changes.length > 0 ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {row.changes.map((change) => <span key={change} style={ui.badge.warning}>{change}</span>)}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ fontSize: '13px', color: tokens.colors.textPrimary }}>
                        File nhập: <strong>{row.incomingName || 'Chưa có tên'}</strong>
                      </div>
                      {row.existingName ? (
                        <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                          Hiện tại: <strong>{row.existingName}</strong>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {row.messages.map((message, index) => (
                        <div key={`${row.rowNumber}-${index}`} style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                          {message}
                        </div>
                      ))}
                    </div>
                    {row.action === 'duplicate' && row.sku ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedCompareSkus((current) => current.includes(row.sku!) ? current.filter((item) => item !== row.sku) : [...current, row.sku!])}
                          style={{ ...outlineButtonStyle, padding: '8px 12px' }}
                        >
                          {expandedCompareSkus.includes(row.sku) ? 'Ẩn so sánh' : 'Xem so sánh'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleDuplicate(row.sku!)}
                          style={{
                            ...outlineButtonStyle,
                            padding: '8px 12px',
                            borderColor: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningBorder : tokens.colors.border,
                            background: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningBg : tokens.colors.surface,
                            color: selectedDuplicateSkus.includes(row.sku) ? tokens.colors.warningDark : tokens.colors.textSecondary,
                          }}
                        >
                          {selectedDuplicateSkus.includes(row.sku) ? 'Sẽ replace dòng này' : 'Bỏ qua dòng này'}
                        </button>
                      </div>
                    ) : null}
                    {row.action === 'duplicate' && row.sku && expandedCompareSkus.includes(row.sku) ? (
                      <div style={{ display: 'grid', gap: '8px', borderRadius: '14px', border: `1px solid ${tokens.colors.warningBorder}`, background: `linear-gradient(180deg, ${tokens.colors.warningTint} 0%, ${tokens.colors.surface} 100%)`, padding: '12px' }}>
                        {row.compare.filter((item) => item.changed).length > 0 ? row.compare.filter((item) => item.changed).map((item) => (
                          <div
                            key={`${row.sku}-${item.label}`}
                            style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', alignItems: 'start', borderRadius: '12px', border: `1px solid ${tokens.colors.warningTint}`, background: tokens.colors.surfaceSubtle, padding: '10px' }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.warningDark, textTransform: 'uppercase' }}>{item.label}</div>
                            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.6, minWidth: 0 }}>
                              <strong style={{ display: 'block', color: tokens.colors.textMuted, marginBottom: '2px' }}>Hiện tại</strong>
                              {item.currentValue || 'Chưa có'}
                            </div>
                            <div style={{ fontSize: '12px', color: tokens.colors.textPrimary, lineHeight: 1.6, minWidth: 0 }}>
                              <strong style={{ display: 'block', color: tokens.colors.warningDark, marginBottom: '2px' }}>Trong file</strong>
                              {item.incomingValue || 'Chưa có'}
                            </div>
                          </div>
                        )) : (
                          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                            Không có khác biệt rõ ràng giữa dữ liệu hiện tại và file import.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
                {filteredPreviewRows.length === 0 ? (
                  <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px dashed ${tokens.colors.border}`, padding: '18px', textAlign: 'center', color: tokens.colors.textSecondary }}>
                    Không có dòng nào khớp với bộ lọc hiện tại.
                  </div>
                ) : null}
              </div>
              {preview.duplicateRows > 0 ? (
                <div style={{ position: 'sticky', bottom: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '12px 0 0', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={ui.badge.warning}>{selectedReplaceCount} sẽ replace</span>
                    <span style={ui.badge.neutral}>{skippedDuplicateCount} sẽ skip</span>
                    {preview.errorRows > 0 ? <span style={ui.badge.error}>{preview.errorRows} dòng lỗi cần sửa</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                    Sản phẩm mới vẫn được tạo bình thường. Khu này chỉ áp dụng cho các SKU trùng.
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ borderRadius: '18px', border: `1px solid ${preview.duplicateRows > 0 ? tokens.colors.warningBorder : tokens.colors.border}`, background: preview.duplicateRows > 0 ? tokens.colors.warningTint : tokens.colors.surface, padding: '16px 18px', display: 'grid', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 900, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Quyết định nhập</div>
              <div style={{ fontSize: '14px', color: tokens.colors.textPrimary, lineHeight: 1.7 }}>
                {preview.duplicateRows > 0
                  ? `File có SKU trùng. Hiện có ${selectedDuplicateSkus.length}/${preview.duplicateRows} dòng trùng được chọn để replace.`
                  : 'Không có SKU trùng. Bạn có thể nhập dữ liệu ngay.'}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={outlineButtonStyle}>
            Đóng
          </button>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!preview ? (
              <button
                type="button"
                onClick={onAnalyze}
                disabled={!selectedFileName || importing}
                style={{ ...primaryButtonStyle, opacity: !selectedFileName || importing ? 0.55 : 1, cursor: !selectedFileName || importing ? 'not-allowed' : 'pointer' }}
              >
                <ImportIcon size={14} /> {importing ? 'Đang phân tích...' : 'Phân tích file'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onImportNewOnly}
                  disabled={importing || preview.errorRows > 0}
                  style={{ ...outlineButtonStyle, opacity: importing || preview.errorRows > 0 ? 0.55 : 1, cursor: importing || preview.errorRows > 0 ? 'not-allowed' : 'pointer' }}
                  title={preview.errorRows > 0 ? 'Cần sửa các dòng lỗi trong file trước khi nhập' : 'Chỉ tạo sản phẩm mới, bỏ qua SKU trùng'}
                >
                  Chỉ nhập sản phẩm mới
                </button>
                <button
                  type="button"
                  onClick={onReplaceDuplicates}
                  disabled={importing || preview.errorRows > 0}
                  style={{ ...primaryButtonStyle, opacity: importing || preview.errorRows > 0 ? 0.55 : 1, cursor: importing || preview.errorRows > 0 ? 'not-allowed' : 'pointer' }}
                  title={preview.errorRows > 0 ? 'Cần sửa các dòng lỗi trong file trước khi nhập' : 'Ghi đè toàn bộ sản phẩm trùng SKU bằng dữ liệu trong file'}
                >
                  <ImportIcon size={14} /> {importing ? 'Đang import...' : (preview.duplicateRows > 0 ? 'Nhập với các dòng đã chọn để replace' : 'Nhập dữ liệu')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}
