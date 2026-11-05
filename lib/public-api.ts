/**
 * Base URL for browser-side API calls.
 * Defaults to the same-origin `/api` path, which next.config.ts rewrites to API_URL,
 * so the browser never depends on cross-origin CORS to reach the API. Static exports
 * (no rewrites) must set NEXT_PUBLIC_API_URL to the public API origin.
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
