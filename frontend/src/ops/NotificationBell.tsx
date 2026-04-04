import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import type { NotificationItem } from './useNotifications';
import { setNavContext } from '../navContext';
import { BellIcon } from '../ui/icons';
import { buildNotificationNavigationTarget } from './notificationNavigation';

let notificationPanelIdCounter = 0;

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function NotificationBell({
  unreadCount,
  items,
  loading,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  compact = false,
  isMobile = false,
}: {
  unreadCount: number;
  items: NotificationItem[];
  loading?: boolean;
  onRefresh?: () => void;
  onMarkRead?: (ids: string[]) => Promise<void> | void;
  onMarkAllRead?: () => Promise<void> | void;
  onNavigate?: (route: string) => void;
  compact?: boolean;
  isMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const notificationItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpenRef = useRef(false);
  const panelId = useMemo(() => {
    notificationPanelIdCounter += 1;
    return `notification-bell-panel-${notificationPanelIdCounter}`;
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const unreadItems = useMemo(() => items.filter(item => !item.readAt), [items]);
  notificationItemRefs.current = [];

  useEffect(() => {
    if (open) {
      const focusTarget = notificationItemRefs.current.find(Boolean) ?? refreshButtonRef.current ?? panelRef.current;
      focusTarget?.focus();
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = open;
  }, [open, items]);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(prev => !prev)}
        style={{
          position: 'relative',
          width: compact ? '34px' : '40px',
          height: compact ? '34px' : '40px',
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.colors.background,
          color: tokens.colors.textPrimary,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? tokens.shadow.md : 'none',
        }}
        aria-label="Mở thông báo"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
      >
        <BellIcon size={compact ? 16 : 18} strokeWidth={1.9} color={tokens.colors.textPrimary} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 5px',
              borderRadius: '999px',
              background: tokens.colors.warning,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${tokens.colors.surface}`,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label="Thông báo"
          aria-modal="false"
          tabIndex={-1}
          style={{
            position: isMobile ? 'fixed' : 'absolute',
            right: isMobile ? '12px' : 0,
            left: isMobile ? '12px' : 'auto',
            top: isMobile ? '96px' : 'calc(100% + 10px)',
            width: isMobile ? 'auto' : '320px',
            maxWidth: isMobile ? 'none' : 'calc(100vw - 24px)',
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.xl,
            boxShadow: tokens.shadow.md,
            zIndex: tokens.zIndex.popover,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: `1px solid ${tokens.colors.border}` }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông báo</div>
              <div style={{ fontSize: '11px', color: tokens.colors.textSecondary, marginTop: '2px' }}>
                {unreadCount} chưa đọc
              </div>
            </div>
            <button
              type="button"
              ref={refreshButtonRef}
              onClick={() => onRefresh?.()}
              style={{
                ...ui.btn.outline,
                padding: '8px 10px',
                fontSize: '12px',
                lineHeight: 1,
              }}
            >
              Làm mới
            </button>
          </div>

          <div style={{ maxHeight: isMobile ? 'min(60vh, 420px)' : '320px', overflowY: 'auto' }}>
            {loading && unreadItems.length === 0 && (
              <div style={{ padding: '16px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Đang tải thông báo...
              </div>
            )}

            {!loading && items.length === 0 && (
              <div style={{ padding: '16px', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Chưa có thông báo nào.
              </div>
            )}

            {items.map((item, index) => {
              const isUnread = !item.readAt;
              const isClickable = !!(item.link && onNavigate);
              const target = isClickable ? buildNotificationNavigationTarget(item) : null;
              const handleRowClick = () => {
                if (!isClickable) return;
                if (target) setNavContext(target.navContext as any);
                if (isUnread && item.id) {
                  void onMarkRead?.([item.id]);
                }
                onNavigate?.(target?.route || (item.link as string));
                setOpen(false);
              };

              const rowContent = (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      marginTop: '4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isUnread ? tokens.colors.warning : tokens.colors.border,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: tokens.colors.textPrimary, lineHeight: 1.45 }}>
                      {item.content}
                    </div>
                    <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '4px' }}>
                      {formatNotificationTime(item.createdAt)}
                    </div>
                  </div>
                </div>
              );

              const sharedRowStyle = {
                padding: '12px 16px',
                borderBottom: `1px solid ${tokens.colors.border}`,
                background: isUnread ? tokens.colors.badgeBgSuccess : 'transparent',
                width: '100%',
                textAlign: 'left' as const,
                font: 'inherit',
              };

              if (isClickable) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(node) => {
                      notificationItemRefs.current[index] = node;
                    }}
                    onClick={handleRowClick}
                    aria-label={`${item.content} ${formatNotificationTime(item.createdAt)}`.trim()}
                    style={{
                      ...sharedRowStyle,
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    {rowContent}
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  style={{
                    ...sharedRowStyle,
                    cursor: 'default',
                    border: 'none',
                  }}
                >
                  {rowContent}
                </div>
              );
            })}
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', borderTop: `1px solid ${tokens.colors.border}` }}>
            <button
              type="button"
              onClick={async () => {
                await onMarkAllRead?.();
                setOpen(false);
              }}
              style={{
                ...ui.btn.primary,
                flex: 1,
                justifyContent: 'center',
              }}
              disabled={unreadCount === 0}
            >
                Đánh dấu đã đọc tất cả
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
