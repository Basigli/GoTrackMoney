export const getApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    if (envUrl) {
      // Preserve the configured port and path when accessing a local server over LAN.
      const url = new URL(envUrl);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = window.location.hostname;
      }
      return url.toString().replace(/\/$/, '');
    }
    return `${window.location.protocol}//${window.location.hostname}:8098`;
  }
  return envUrl || 'http://localhost:8098';
};
export const API_BASE = getApiBase();

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(body || `Request failed (${status})`);
    this.name = 'ApiError';
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & { token?: string | null; body?: unknown };

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, body, headers: extraHeaders, ...init } = options;
  const headers = new Headers(extraHeaders);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  const text = await response.text();
  return (text && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : undefined) as T;
}
