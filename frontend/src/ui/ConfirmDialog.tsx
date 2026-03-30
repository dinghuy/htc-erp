import { OverlayModal } from './OverlayModal';
import { WarningIcon } from './icons';
import { tokens } from './tokens';
import { ui } from './styles';

type ConfirmDialogProps = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed confirmation dialog — drop-in replacement for window.confirm().
 * Renders as a centered overlay using the shared zIndex/token system.
 * Usage: conditionally render when a confirm state is set, pass onConfirm/onCancel.
 */
export function ConfirmDialog({
  message,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <OverlayModal
      title={variant === 'danger' ? 'Xác nhận thao tác' : 'Cần xác nhận'}
      subtitle="Thao tác này cần bạn xác nhận trước khi tiếp tục."
      onClose={onCancel}
      maxWidth="400px"
      contentPadding="28px 28px 24px"
    >
      <div role="alertdialog" aria-modal="true" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              flexShrink: 0,
              borderRadius: tokens.radius.md,
              background:
                variant === 'danger'
                  ? tokens.colors.badgeBgError
                  : tokens.colors.badgeBgInfo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: variant === 'danger' ? tokens.colors.error : tokens.colors.warning,
            }}
          >
            <WarningIcon size={20} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.6,
              color: tokens.colors.textPrimary,
              paddingTop: '8px',
            }}
          >
            {message}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onCancel} style={ui.btn.outline}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} style={ui.btn.danger}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
