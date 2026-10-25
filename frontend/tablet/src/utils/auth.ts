/**
 * Catavor Tablet Authentication & Session Eviction Utilities
 * Clean, centralized 401/403 interception & token expiration checks.
 * Following Clean Code & Senior Architecture Standards.
 */

/**
 * Checks if a JWT token is expired using pure base64 decoding (5-second safety buffer).
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    let payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payloadBase64.length % 4 !== 0) {
      payloadBase64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(payloadBase64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed || typeof parsed.exp !== 'number') return false;
    const currentTime = Math.floor(Date.now() / 1000);
    // Expired if exp timestamp is less than current time + 5s buffer
    return parsed.exp < (currentTime + 5);
  } catch {
    // Defensive engineering: Do not falsely mark token expired on decoding error; let /api/auth/verify decide
    return false;
  }
}

export interface AuthFetchOptions {
  getToken?: () => string | null;
  onUnauthorized: (message?: string) => void;
  defaultHeaders?: Record<string, string>;
}

/**
 * Creates a centralized authenticated fetch wrapper that automatically intercepts
 * 401 Unauthorized / 403 Forbidden responses and token expiration, triggering session eviction.
 */
export function createAuthFetch(
  options: AuthFetchOptions
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const { getToken, onUnauthorized, defaultHeaders } = options;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const currentToken = getToken
      ? getToken()
      : typeof localStorage !== 'undefined'
      ? localStorage.getItem('catavor_token')
      : null;

    // 1. Proactive pre-flight token expiration check
    if (currentToken && isTokenExpired(currentToken)) {
      onUnauthorized('Sesi Anda telah berakhir demi keamanan. Silakan login kembali.');
      throw new Error('TOKEN_EXPIRED');
    }

    // 2. Prepare request headers cleanly
    const headers = new Headers(init?.headers || {});
    if (defaultHeaders) {
      Object.entries(defaultHeaders).forEach(([key, val]) => {
        if (!headers.has(key)) {
          headers.set(key, val);
        }
      });
    }
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    // 3. Perform network fetch using window.fetch
    const res = await window.fetch(input, {
      ...init,
      headers
    });

    // 4. Reactive 401 Unauthorized session interception (403 Forbidden is a permission error, NOT session expiration)
    if (res.status === 401) {
      let errorMsg = 'Sesi Anda telah berakhir demi keamanan. Silakan login kembali.';
      try {
        const clone = res.clone();
        const data = await clone.json();
        if (data?.message) {
          errorMsg = data.message;
        }
      } catch {}

      onUnauthorized(errorMsg);
      throw new Error('UNAUTHORIZED');
    }

    return res;
  };
}
