/**
 * Centralized Industrial-Grade API Client for Catavor (Desktop & Mobile)
 * Features:
 * 1. Automatic header injection (Authorization Bearer, X-Store-Slug, X-Request-ID, Content-Type)
 * 2. In-flight request deduplication to eliminate redundant network hits
 * 3. SWR (Stale-While-Revalidate) caching layer with configurable TTL
 * 4. Centralized 401/403 session interception
 * 5. Safe AbortController integration
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  [key: string]: any;
}

export interface ApiRequestOptions extends RequestInit {
  slug?: string | null;
  skipAuth?: boolean;
  timeoutMs?: number;
}

export interface SwrOptions<T = any> {
  ttlMs?: number; // Time-to-live before cache is considered stale (default 5 min)
  maxAgeMs?: number; // Maximum age before cache is discarded completely (default 24 hours)
  forceFresh?: boolean;
  onFresh?: (data: T) => void;
  slug?: string | null;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// In-Memory Cache Store for 0ms SWR Data Retrieval
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

// Global Unauthorized Event Dispatcher
type UnauthorizedListener = (message?: string) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onApiUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function notifyUnauthorized(message?: string) {
  unauthorizedListeners.forEach(listener => {
    try {
      listener(message || 'Sesi Anda telah berakhir. Silakan login kembali.');
    } catch (e) {
      console.error('Error in unauthorized listener:', e);
    }
  });
}

// Helper to get active JWT token safely
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('catavor_token');
  } catch {
    return null;
  }
}

// Helper to get active store slug safely
export function getActiveStoreSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromStorage = localStorage.getItem('catavor_active_slug');
    if (fromStorage) return fromStorage;
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    const reserved = ['api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'admin', 'platform', 'system', 'ops', 'dashboard', 'terms', 'privacy', 'acceptable-use', 'acceptable_use', 'catalogs', 'stores'];
    if (parts.length > 0 && !reserved.includes(parts[0])) {
      return parts[0];
    }
  } catch {}
  return null;
}

export const API_BASE = '/api';

/**
 * Core unified request runner
 */
export async function request<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    slug = getActiveStoreSlug(),
    skipAuth = false,
    timeoutMs = 15000,
    headers: customHeaders = {},
    ...customOptions
  } = options;

  const url = endpoint.startsWith('http') || endpoint.startsWith('/api') 
    ? endpoint 
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = !skipAuth ? getStoredToken() : null;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(slug ? { 'X-Store-Slug': slug } : {}),
    ...(customHeaders as Record<string, string>)
  };

  // Only attach Content-Type if there is a body and it's not FormData
  if (customOptions.body && !(customOptions.body instanceof FormData)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  // Setup Timeout Controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...customOptions,
      headers,
      signal: customOptions.signal || controller.signal
    });

    clearTimeout(timeoutId);

    // Global 401 Unauthorized Interception
    if (res.status === 401) {
      let data: any = {};
      try { data = await res.json(); } catch {}
      notifyUnauthorized(data?.message);
      throw new ApiError(data?.message || 'Sesi login tidak valid.', 401, data?.code || 'UNAUTHORIZED', data);
    }

    // Global 403 Forbidden Interception
    if (res.status === 403) {
      let data: any = {};
      try { data = await res.json(); } catch {}
      throw new ApiError(data?.message || 'Akses ditolak.', 403, data?.code || 'FORBIDDEN', data);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok && data.success === false) {
        throw new ApiError(data.message || `Request gagal dengan status ${res.status}`, res.status, data.code, data);
      }
      return data;
    }

    if (!res.ok) {
      throw new ApiError(`Request gagal dengan status ${res.status}`, res.status);
    }

    return (await res.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Permintaan timeout. Silakan periksa koneksi internet Anda.', 408, 'TIMEOUT');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Koneksi terputus. Pastikan server backend aktif.', 0, 'NETWORK_ERROR');
  }
}

/**
 * Deduplicated Request Wrapper:
 * If an identical GET request is currently in-flight, return the existing Promise.
 */
export function deduplicatedGet<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  const cacheKey = `GET:${endpoint}:${options?.slug || ''}:${options?.skipAuth ? 'noauth' : 'auth'}`;
  
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const promise = request<T>(endpoint, { method: 'GET', ...options })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * SWR (Stale-While-Revalidate) Cache Engine:
 * Returns cached data immediately if available, then triggers background fetch to update cache.
 */
export async function swrGet<T = any>(
  endpoint: string,
  options: SwrOptions<T> = {}
): Promise<{ data: T; isStale: boolean }> {
  const {
    ttlMs = 3 * 60 * 1000, // 3 minutes default freshness
    maxAgeMs = 24 * 60 * 60 * 1000, // 24 hours max cache retention
    forceFresh = false,
    onFresh,
    slug = getActiveStoreSlug()
  } = options;

  const cacheKey = `SWR:${endpoint}:${slug || ''}`;
  const now = Date.now();

  // 1. Check in-memory cache first (0ms)
  let cached = memoryCache.get(cacheKey);

  // 2. Check localStorage fallback if not in RAM
  if (!cached && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`catavor_swr_${cacheKey}`);
      if (stored) {
        cached = JSON.parse(stored);
        if (cached) memoryCache.set(cacheKey, cached);
      }
    } catch {}
  }

  const hasCachedData = cached && (now - cached.timestamp < maxAgeMs);
  const isStale = !cached || (now - cached.timestamp > ttlMs);

  // Background fetch worker
  const fetchFresh = async () => {
    try {
      const freshData = await deduplicatedGet<T>(endpoint, { slug });
      
      const newEntry: CacheEntry<T> = {
        data: freshData,
        timestamp: Date.now()
      };

      memoryCache.set(cacheKey, newEntry);
      try {
        localStorage.setItem(`catavor_swr_${cacheKey}`, JSON.stringify(newEntry));
      } catch {}

      if (onFresh) {
        onFresh(freshData);
      }
      return freshData;
    } catch (err: any) {
      // If resource is explicitly 404 Not Found (e.g., store was banned or purged),
      // NEVER return stale cached data! Invalidate cache immediately so banned stores do not linger.
      if (err?.status === 404 || err?.statusCode === 404) {
        memoryCache.delete(cacheKey);
        try {
          localStorage.removeItem(`catavor_swr_${cacheKey}`);
          if (slug) {
            localStorage.removeItem(`catavor_store_${slug.toLowerCase()}`);
          }
        } catch {}
        throw err;
      }

      // If fresh fetch fails but we had stale data, don't throw to caller
      if (hasCachedData) {
        console.warn(`[SWR] Background refresh failed for ${endpoint}, using cached data.`);
        return cached!.data;
      }
      throw err;
    }
  };

  // If forceFresh or no cache exists, await fresh data directly
  if (forceFresh || !hasCachedData) {
    const data = await fetchFresh();
    return { data, isStale: false };
  }

  // If we have cached data but it's stale, trigger background refresh
  if (isStale) {
    // Non-blocking background revalidation
    fetchFresh().catch(() => {});
  }

  return { data: cached!.data, isStale };
}

/**
 * Cache Invalidation Helper:
 * Invalidate specific endpoint or pattern when mutations (Create, Update, Delete) occur.
 */
export function invalidateCache(pattern?: string) {
  if (!pattern) {
    memoryCache.clear();
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('catavor_swr_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
    return;
  }

  memoryCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  });

  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('catavor_swr_') && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  } catch {}
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) => 
    request<T>(endpoint, { method: 'GET', ...options }),
  
  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) => 
    request<T>(endpoint, { 
      method: 'POST', 
      body: body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined), 
      ...options 
    }),

  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) => 
    request<T>(endpoint, { 
      method: 'PUT', 
      body: body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined), 
      ...options 
    }),

  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) => 
    request<T>(endpoint, { method: 'DELETE', ...options }),

  dedupe: deduplicatedGet,
  swr: swrGet,
  invalidate: invalidateCache,
  onUnauthorized: onApiUnauthorized
};

export default apiClient;
