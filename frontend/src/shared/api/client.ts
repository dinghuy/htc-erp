import { fetchWithSessionAuth } from '../../core/session';

function isLoopbackHostname(hostname?: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizeLoopbackApiUrl(explicitApiUrl: string, browserHostname?: string) {
  const trimmedHostname = browserHostname?.trim();
  if (!trimmedHostname || !isLoopbackHostname(trimmedHostname)) return explicitApiUrl;

  try {
    const url = new URL(explicitApiUrl);
    if (!isLoopbackHostname(url.hostname)) return explicitApiUrl;
    url.hostname = trimmedHostname;
    return url.toString().replace(/\/$/, '');
  } catch {
    return explicitApiUrl;
  }
}

export function resolveApiBase(explicitApiUrl?: string, browserHostname?: string) {
  const trimmedUrl = explicitApiUrl?.trim();
  if (trimmedUrl) return normalizeLoopbackApiUrl(trimmedUrl, browserHostname);

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
