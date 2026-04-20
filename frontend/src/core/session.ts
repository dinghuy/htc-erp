const TOKEN_STORAGE_KEY = 'crm_token';
const USER_STORAGE_KEY = 'crm_user';

export function persistSession<T extends { token: string }>(user: T) {
  localStorage.setItem(TOKEN_STORAGE_KEY, user.token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function loadPersistedSession<T>(): (T & { token: string }) | null {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !raw) return null;
    const user = JSON.parse(raw) as T;
    return { ...user, token };
  } catch {
    return null;
  }
}

export function clearPersistedSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchWithSessionAuth(token: string, url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (res.status === 401) {
    clearPersistedSession();
    window.location.reload();
  }

  return res;
}
