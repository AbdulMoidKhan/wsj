import {PUBLIC_API_URL} from '@/lib/public-api';
export const API = PUBLIC_API_URL;
let token: string | null = null;
export function setToken(value: string | null) { token = value; }
/** Purge the public site caches so published changes are visible straight away. */
export async function revalidatePublic(): Promise<boolean> {
 try {
  /* Lives under /api so the httpOnly session cookie (path=/api) is sent after a page reload.
     Next resolves its own app route before the /api/:path* rewrite to the backend. */
  const response = await fetch('/api/studio-revalidate/', {method: 'POST', headers: token ? {Authorization: 'Bearer ' + token} : {}, credentials: 'include', cache: 'no-store'});
  return response.ok;
 } catch { return false; }
}
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request<T = Record<string, unknown>>(endpoint: string, options: RequestInit = {}): Promise<T> {
 const headers = new Headers(options.headers);
 if (!(options.body instanceof FormData) && options.body) headers.set('Content-Type', 'application/json');
 if (token) headers.set('Authorization', 'Bearer ' + token);
 let response: Response;
 try { response = await fetch(API + endpoint, {...options, headers, credentials: 'include', cache: 'no-store'}); }
 catch { throw new ApiError('API unavailable. Check that the backend is running at ' + API + ' and allows this site via CORS.', 0); }
 const data = response.status === 204 ? null : await response.json().catch(() => null);
 if (response.status === 429) throw new ApiError('Too many attempts. Please wait a minute and try again.', 429);
 if (!response.ok) throw new ApiError(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || data?.error || 'Request failed (' + response.status + ')', response.status);
 return data as T;
}
