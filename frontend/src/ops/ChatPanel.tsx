import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fetchWithAuth, type CurrentUser } from '../auth';
import { API_BASE, requestJsonWithAuth } from '../shared/api/client';
import { setNavContext } from '../navContext';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

type ChatMessage = {
  id: string;
  content?: string;
  message?: string;
  senderName?: string;
  senderId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NotificationItem = {
  id: string;
  content?: string;
  title?: string;
  body?: string;
  message?: string;
  link?: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string;
  readAt?: string | null;
  level?: 'info' | 'success' | 'warning' | 'error' | string;
};

type Props = {
  currentUser: Pick<CurrentUser, 'token' | 'fullName' | 'username'>;
  isMobile?: boolean;
  onNavigate?: (route: string) => void;
};

const API = API_BASE;
const POLL_MS = 30000;
const MAX_MESSAGES = 50;

const S = {
  shell: {
    display: 'grid',
    gap: '24px',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
    alignItems: 'start',
  } as const,
  hero: {
    padding: '28px',
    borderRadius: tokens.radius.xl,
    border: `1px solid ${tokens.colors.border}`,
    background: `linear-gradient(135deg, rgba(0, 63, 133, 0.08) 0%, rgba(0, 151, 110, 0.08) 100%)`,
    boxShadow: tokens.shadow.sm,
  } as const,
  card: {
    ...ui.card.base,
    padding: '24px',
  } as const,
  input: {
    ...ui.input.base,
    minHeight: '56px',
    resize: 'vertical' as const,
  } as const,
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    borderRadius: tokens.radius.md,
    fontSize: '12px',
    fontWeight: 800,
  } as const,
};

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isUnread(notification: NotificationItem) {
  return !notification.readAt;
}

function normalizeMessage(message: ChatMessage) {
  return {
    ...message,
    content: message.content ?? message.message ?? '',
  };
}

function normalizeNotification(notification: NotificationItem) {
  const content =
    notification.content ??
    notification.title ??
    notification.message ??
    '';
  return {
    ...notification,
    content,
    title: notification.title ?? content,
    body: notification.body ?? notification.content ?? notification.message ?? '',
  };
}

export function ChatPanel({ currentUser, isMobile, onNavigate }: Props) {
  const token = currentUser.token;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => isUnread(item)).length,
    [notifications]
  );

  const apiGet = async <T,>(url: string): Promise<T> => {
    return requestJsonWithAuth<T>(token, url, {}, 'Request failed');
  };

  const refresh = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [messageRes, notificationRes] = await Promise.allSettled([
        apiGet<{ items: ChatMessage[] }>(`${API}/chat/messages?limit=${MAX_MESSAGES}`),
        apiGet<{ items: NotificationItem[]; unreadCount?: number }>(`${API}/notifications`),
      ]);

      if (messageRes.status === 'fulfilled') {
        const items = Array.isArray(messageRes.value?.items) ? messageRes.value.items : [];
        setMessages(items.map(normalizeMessage));
      }

      if (notificationRes.status === 'fulfilled') {
        const items = Array.isArray(notificationRes.value?.items) ? notificationRes.value.items : [];
        setNotifications(items.map(normalizeNotification));
      }

      const failed = [messageRes, notificationRes].some((item) => item.status === 'rejected');
      if (failed) {
        setError('Khong the tai day du chat hoac thong bao. Dang hien thi phan du lieu co san.');
      }
      setLastSync(new Date());
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Failed to load chat panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      senderName: currentUser.fullName || currentUser.username || 'You',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [optimistic, ...prev].slice(0, MAX_MESSAGES));
    setDraft('');

    try {
      const response = await fetchWithAuth(token, `${API}/chat/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Send failed (${response.status})`);
      }

      const created = (await response.json()) as ChatMessage | undefined;
      if (created?.id) {
        setMessages((prev) =>
          [normalizeMessage(created), ...prev.filter((item) => !String(item.id).startsWith('temp-'))]
            .slice(0, MAX_MESSAGES)
        );
      } else {
        await refresh(true);
      }
    } catch (sendError: any) {
      setMessages((prev) => prev.filter((item) => !String(item.id).startsWith('temp-')));
      setDraft(content);
      setError(sendError?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const markRead = async (ids: string[]) => {
    const targetIds = ids.filter(Boolean);
    if (targetIds.length === 0) return;

    try {
      const response = await fetchWithAuth(token, `${API}/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targetIds }),
      });

      if (!response.ok) {
        throw new Error(`Mark read failed (${response.status})`);
      }

      setNotifications((prev) =>
        prev.map((item) => (targetIds.includes(item.id) ? { ...item, readAt: item.readAt || new Date().toISOString() } : item))
      );
    } catch (markError: any) {
      setError(markError?.message || 'Failed to mark notifications as read');
    }
  };

  const markAllRead = async () => {
    await markRead(notifications.filter(isUnread).map((item) => item.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={S.hero}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '220px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
              Vận hành
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', color: tokens.colors.textPrimary }}>
              Chat và thông báo
            </h1>
            <p style={{ margin: '8px 0 0', color: tokens.colors.textSecondary, fontSize: '14px', lineHeight: 1.6, maxWidth: '72ch' }}>
              Trung tâm trao đổi nội bộ, nhận thông báo theo dõi việc và xử lý trạng thái đã đọc/chưa đọc ngay trong CRM.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span style={{ ...S.chip, background: tokens.colors.surface, color: tokens.colors.textSecondary, border: `1px solid ${tokens.colors.border}` }}>
              {currentUser.fullName || currentUser.username}
            </span>
            <span style={{ ...S.chip, background: 'var(--ht-success-bg)', color: 'var(--ht-green)' }}>
              {unreadCount} chưa đọc
            </span>
            <button
              type="button"
              onClick={() => void refresh(true)}
              style={{ ...ui.btn.outline, minHeight: '40px' }}
            >
              {refreshing ? 'Đang làm mới...' : 'Làm mới'}
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                style={{ ...ui.btn.primary, minHeight: '40px' }}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: '14px', fontSize: '12px', color: tokens.colors.textMuted, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span>Lần đồng bộ gần nhất: {lastSync ? formatTime(lastSync.toISOString()) : 'Đang chờ'}</span>
          <span>Tự làm mới: 30 giây</span>
          {onNavigate && <button type="button" onClick={() => onNavigate('Ops Overview')} style={{ background: 'none', border: 'none', color: tokens.colors.primary, cursor: 'pointer', padding: 0 }}>Quay lại tổng quan vận hành</button>}
        </div>
      </div>

      {error && (
        <div style={{
          ...ui.card.base,
          padding: '14px 18px',
          border: `1px solid rgba(220, 38, 38, 0.18)`,
          background: 'rgba(220, 38, 38, 0.06)',
          color: '#b91c1c',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <div style={isMobile ? { display: 'grid', gap: '20px' } : S.shell}>
        <section style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '-0.03em' }}>Hội thoại nội bộ</h2>
              <p style={{ margin: '4px 0 0', color: tokens.colors.textSecondary, fontSize: '13px' }}>
                Trao đổi nhanh, lưu trữ 50 tin nhắn gần nhất.
              </p>
            </div>
            <span style={{ ...S.chip, background: tokens.colors.background, color: tokens.colors.textSecondary, border: `1px solid ${tokens.colors.border}` }}>
              {messages.length} tin nhắn
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '12px',
            maxHeight: '560px',
            overflowY: 'auto',
            paddingRight: '6px',
          }}>
            {!loading && messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 18px', color: tokens.colors.textMuted, fontSize: '13px' }}>
                  Chưa có tin nhắn nào. Hãy bắt đầu cuộc trao đổi.
                </div>
              )}

            {messages.map((message) => {
              const mine =
                String(message.senderId || '').toLowerCase() === String(currentUser.username || '').toLowerCase() ||
                String(message.senderName || '').toLowerCase() === String(currentUser.fullName || '').toLowerCase();

              return (
                <article
                  key={message.id}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: 'min(88%, 640px)',
                    padding: '14px 16px',
                    borderRadius: mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                    background: mine ? 'linear-gradient(135deg, rgba(0, 151, 110, 0.14), rgba(0, 63, 133, 0.08))' : tokens.colors.background,
                    border: `1px solid ${mine ? 'rgba(0, 151, 110, 0.18)' : tokens.colors.border}`,
                    boxShadow: tokens.shadow.sm,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '13px', color: tokens.colors.textPrimary }}>
                      {message.senderName || 'System'}
                    </strong>
                    <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                      {formatTime(message.createdAt || message.updatedAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: 1.65, color: tokens.colors.textPrimary, whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </div>
                </article>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
            <textarea
              value={draft}
              onInput={(event: any) => setDraft(event.target.value)}
              placeholder={`Nhan tin nhan...`}
              rows={4}
              style={S.input}
              aria-label="Compose message"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                Gui voi danh tinh: <strong>{currentUser.fullName || currentUser.username}</strong>
              </div>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || !draft.trim()}
                style={{
                  ...ui.btn.primary,
                  minHeight: '44px',
                  opacity: sending || !draft.trim() ? 0.7 : 1,
                  cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </div>
        </section>

        <aside style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '-0.03em' }}>Notifications</h2>
              <p style={{ margin: '4px 0 0', color: tokens.colors.textSecondary, fontSize: '13px' }}>
                Theo doi canh bao, nhac viec va thong diep he thong.
              </p>
            </div>
            <span style={{ ...S.chip, background: 'var(--ht-warning-bg, #fff7ed)', color: 'var(--ht-amber)' }}>
              {unreadCount} unread
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto', paddingRight: '4px' }}>
            {!loading && notifications.length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: tokens.colors.textMuted, fontSize: '13px' }}>
                Khong co thong bao nao.
              </div>
            )}

            {notifications.map((item) => {
              const unread = isUnread(item);
              const clickable = !!(item.link && onNavigate);
              return (
                <article
                  key={item.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: tokens.radius.lg,
                    border: `1px solid ${unread ? 'rgba(0, 151, 110, 0.2)' : tokens.colors.border}`,
                    background: unread ? 'rgba(0, 151, 110, 0.05)' : tokens.colors.background,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (!clickable) return;
                    const entityType =
                      item.entityType === 'Task' || item.entityType === 'Quotation' || item.entityType === 'Account' || item.entityType === 'Lead'
                        ? item.entityType
                        : undefined;
                    const entityId = item.entityId || undefined;

                    setNavContext({
                      route: item.link as string,
                      entityType,
                      entityId,
                      autoOpenEdit: true,
                      filters: entityType === 'Quotation' && entityId
                        ? { quotationId: entityId }
                        : entityType === 'Account' && entityId
                          ? { accountId: entityId }
                          : entityType === 'Lead' && entityId
                            ? { leadId: entityId }
                            : undefined,
                    });

                    if (unread) {
                      void markRead([item.id]);
                    }
                    onNavigate?.(item.link as string);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: tokens.colors.textPrimary }}>
                        {item.title || 'Notification'}
                      </div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.55, marginTop: '4px' }}>
                        {item.body || 'No detail provided.'}
                      </div>
                    </div>
                    {unread && (
                      <span style={{ ...S.chip, background: 'var(--ht-success-bg)', color: 'var(--ht-green)', flexShrink: 0 }}>
                        New
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
                      {formatTime(item.createdAt)}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {item.link && onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate(item.link!)}
                          style={{ ...ui.btn.ghost, padding: '8px 0', fontSize: '12px', fontWeight: 800 }}
                        >
                          Open
                        </button>
                      )}
                      {unread && (
                        <button
                          type="button"
                          onClick={() => void markRead([item.id])}
                          style={{ ...ui.btn.outline, padding: '8px 12px', minHeight: '34px', fontSize: '12px' }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
