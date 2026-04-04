import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { tokens } from './tokens';
import { ui } from './styles';
import { OverlayPortal, getOverlayContainerStyle, overlayStyles } from './overlay';

let overlayModalIdCounter = 0;
const overlayModalStack: number[] = [];
const overlayModalShells = new Map<number, HTMLElement>();

type OverlayModalProps = {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  maxWidth?: string;
  subtitle?: string;
  variant?: 'modal' | 'drawer';
  contentPadding?: string;
  placement?: 'center' | 'right';
  closeButtonTestId?: string;
  closeOnBackdrop?: boolean;
  closeButtonAriaLabel?: string;
};

export function OverlayModal({
  title,
  onClose,
  children,
  maxWidth = '600px',
  subtitle,
  variant = 'modal',
  contentPadding = '24px 32px',
  placement,
  closeButtonTestId,
  closeOnBackdrop = true,
  closeButtonAriaLabel = 'Đóng',
}: OverlayModalProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const instanceId = useMemo(() => {
    overlayModalIdCounter += 1;
    return overlayModalIdCounter;
  }, []);
  const titleId = `overlay-modal-title-${instanceId}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    overlayModalStack.push(instanceId);
    if (shellRef.current) {
      overlayModalShells.set(instanceId, shellRef.current);
    }
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    } else if (shellRef.current) {
      shellRef.current.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (overlayModalStack[overlayModalStack.length - 1] !== instanceId) {
          return;
        }
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && !shellRef.current?.contains(activeElement)) {
          return;
        }

        return;
      }

      if (overlayModalStack[overlayModalStack.length - 1] !== instanceId) {
        return;
      }

      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const focusable = getFocusableElements(shell);
      if (focusable.length === 0) {
        event.preventDefault();
        shell.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      const isShift = event.shiftKey;

      if (!activeElement || !shell.contains(activeElement)) {
        event.preventDefault();
        (isShift ? last : first).focus();
        return;
      }

      if (isShift && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!isShift && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = overlayModalStack.lastIndexOf(instanceId);
      if (index >= 0) {
        overlayModalStack.splice(index, 1);
      }
      overlayModalShells.delete(instanceId);
      const previous = previouslyFocusedRef.current;
      const topmostId =
        overlayModalStack.length > 0
          ? overlayModalStack[overlayModalStack.length - 1]
          : null;
      if (topmostId !== null) {
        const topmostShell = overlayModalShells.get(topmostId);
        if (topmostShell) {
          topmostShell.focus();
          return;
        }
      }

      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [instanceId]);

  const isDrawer = variant === 'drawer';
  const resolvedPlacement = placement ?? (isDrawer ? 'right' : 'center');

  return (
    <OverlayPortal>
      <div
        onClick={() => {
          if (closeOnBackdrop) onCloseRef.current();
        }}
        style={getOverlayContainerStyle(isDrawer ? 'drawer' : 'modal', {
          padding: isDrawer ? '14px' : '20px',
          alignItems: isDrawer ? 'stretch' : 'center',
          justifyContent: resolvedPlacement === 'right' ? 'flex-end' : 'center',
        })}
      >
        <div aria-hidden="true" style={overlayStyles.backdrop} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={shellRef}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          style={{
            ...overlayStyles.surface,
            width: '100%',
            maxWidth,
            maxHeight: isDrawer ? 'calc(100vh - 28px)' : '80vh',
            height: isDrawer ? 'calc(100vh - 28px)' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: isDrawer ? '28px' : ui.modal.shell.borderRadius,
            background: isDrawer
              ? tokens.surface.panelGradient
              : ui.modal.shell.background,
            boxShadow: isDrawer ? tokens.overlay.modalShadow : ui.modal.shell.boxShadow,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: isDrawer ? '22px 24px 20px' : '20px 24px',
              borderBottom: `1px solid ${tokens.colors.border}`,
              background: isDrawer ? tokens.surface.drawerHeader : tokens.colors.background,
            }}
          >
            <div style={{ minWidth: 0, display: 'grid', gap: subtitle ? '6px' : 0 }}>
              <h3
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 800,
                  color: tokens.colors.textPrimary,
                }}
              >
                {title}
              </h3>
              {subtitle ? (
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: tokens.colors.textSecondary,
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeButtonAriaLabel}
              title={closeButtonAriaLabel}
              ref={closeButtonRef}
              data-testid={closeButtonTestId}
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                borderRadius: '999px',
                background: isDrawer ? tokens.colors.surfaceSubtle : 'transparent',
                border: isDrawer ? `1px solid ${tokens.colors.border}` : 'none',
                color: 'inherit',
                fontSize: '24px',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: contentPadding,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

function getFocusableElements(container: HTMLElement) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors.join(',')),
  ).filter((element) => !element.hasAttribute('disabled'));
}
