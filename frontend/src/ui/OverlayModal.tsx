import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { tokens } from './tokens';
import { ui } from './styles';

let overlayModalIdCounter = 0;
const overlayModalStack: number[] = [];
const overlayModalShells = new Map<number, HTMLElement>();

type OverlayModalProps = {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  maxWidth?: string;
};

export function OverlayModal({
  title,
  onClose,
  children,
  maxWidth = '600px',
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

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: tokens.colors.textPrimary,
          opacity: 0.7,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={shellRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          ...ui.modal.shell,
          width: '100%',
          maxWidth,
          position: 'relative',
          zIndex: 1,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '20px 24px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            background: tokens.colors.background,
          }}
        >
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            ref={closeButtonRef}
            style={{
              background: 'transparent',
              border: 'none',
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
            padding: '24px 32px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
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
