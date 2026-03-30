import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useMemo } from 'preact/hooks';
import { ui } from './styles';
import { tokens } from './tokens';

type OverlayLayer = 'modal' | 'drawer' | 'detail' | 'toast' | 'popover' | 'emergency';

const OVERLAY_ROOT_ID = 'ht-overlay-root';

let scrollLockDepth = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

function getOverlayRoot() {
  let root = document.getElementById(OVERLAY_ROOT_ID) as HTMLElement | null;
  if (root) return root;

  root = document.createElement('div');
  root.id = OVERLAY_ROOT_ID;
  document.body.appendChild(root);
  return root;
}

function lockBodyScroll() {
  if (scrollLockDepth === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
  }
  scrollLockDepth += 1;
}

function unlockBodyScroll() {
  if (scrollLockDepth === 0) return;
  scrollLockDepth -= 1;
  if (scrollLockDepth === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}

export function getOverlayZIndex(layer: OverlayLayer) {
  switch (layer) {
    case 'popover':
      return tokens.zIndex.popover;
    case 'toast':
      return tokens.zIndex.toast;
    case 'drawer':
      return tokens.zIndex.drawer;
    case 'detail':
      return tokens.zIndex.detail;
    case 'emergency':
      return tokens.zIndex.emergency;
    case 'modal':
    default:
      return tokens.zIndex.modal;
  }
}

export function getOverlayContainerStyle(
  layer: OverlayLayer,
  options: {
    padding?: string;
    alignItems?: 'center' | 'stretch';
    justifyContent?: 'center' | 'flex-end';
  } = {},
) {
  return {
    position: 'fixed' as const,
    inset: 0,
    zIndex: getOverlayZIndex(layer),
    padding: options.padding ?? '20px',
    display: 'flex',
    alignItems: options.alignItems ?? 'center',
    justifyContent: options.justifyContent ?? 'center',
  };
}

export const overlayStyles = {
  backdrop: {
    position: 'absolute' as const,
    inset: 0,
    ...ui.overlay.backdrop,
  },
  surface: {
    ...ui.modal.shell,
    position: 'relative' as const,
    zIndex: 1,
  },
};

export function OverlayPortal({
  children,
  lockScroll = true,
}: {
  children: ComponentChildren;
  lockScroll?: boolean;
}) {
  const root = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return getOverlayRoot();
  }, []);

  useEffect(() => {
    if (!lockScroll) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [lockScroll]);

  return root ? createPortal(children, root) : null;
}
