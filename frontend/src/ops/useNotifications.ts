import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { API_BASE, requestJsonWithAuth } from '../shared/api/client';

export interface NotificationItem {
  id: string;
  userId: string;
  content: string;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  readAt: string | null;
  createdAt: string;
}

type NotificationsResponse = {
  items?: NotificationItem[];
  unreadCount?: number;
};

export function useNotifications(token?: string | null) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setUnreadCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await requestJsonWithAuth<NotificationsResponse>(
        token,
        `${API_BASE}/notifications?limit=50`,
        {},
        'Failed to load notifications',
      );
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void load();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [load, token]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!token) return;
    const normalized = Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id.trim()) : [];
    if (normalized.length === 0) return;

    const now = new Date().toISOString();
    setItems(prev => {
      let dec = 0;
      const next = prev.map(item => {
        if (!normalized.includes(item.id)) return item;
        if (!item.readAt) dec += 1;
        return { ...item, readAt: item.readAt ?? now };
      });
      if (dec > 0) {
        setUnreadCount(c => Math.max(0, c - dec));
      }
      return next;
    });

    try {
      await requestJsonWithAuth(
        token,
        `${API_BASE}/notifications/mark-read`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: normalized }),
        },
        'Failed to mark notifications read',
      );
    } catch {
      // If server side update fails, resync state.
      await load();
    }
  }, [load, token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    await requestJsonWithAuth(token, `${API_BASE}/notifications/mark-read`, { method: 'POST' }, 'Failed to mark all notifications read');
    await load();
  }, [load, token]);

  return useMemo(() => ({
    items,
    unreadCount,
    loading,
    error,
    refresh: load,
    markRead,
    markAllRead,
  }), [error, items, load, loading, markAllRead, markRead, unreadCount]);
}
