import { fetchWithSessionAuth } from '../../core/session';

export function resolveApiBase(explicitApiUrl?: string, browserHostname?: string) {
  const trimmedUrl = explicitApiUrl?.trim();
  if (trimmedUrl) return trimmedUrl;

  const trimmedHostname = browserHostname?.trim();
  const hostname = trimmedHostname && trimmedHostname.length > 0 ? trimmedHostname : 'localhost';
  return `http://${hostname}:3001/api`;
}

const inferredBrowserHostname =
  typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
    ? window.location.hostname
    : undefined;

export const API_BASE = resolveApiBase((import.meta as any).env?.VITE_API_URL, inferredBrowserHostname);

export async function readJsonPayload<T = unknown>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getApiMessage(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallback;
}

export async function requestJsonWithAuth<T>(
  token: string,
  url: string,
  options: RequestInit = {},
  fallbackMessage = 'Không thể xử lý yêu cầu',
): Promise<T> {
  const res = await fetchWithSessionAuth(token, url, options);
  const data = await readJsonPayload<T>(res);
  if (!res.ok) throw new Error(getApiMessage(data, fallbackMessage));
  return data as T;
}
