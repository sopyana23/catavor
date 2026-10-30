/**
 * Cross-Tab Authentication & Session Synchronization Utility
 * Implements Industry-Standard session sync across multiple tabs/windows
 * using BroadcastChannel and window StorageEvent with loopback & cascade prevention.
 */

import { isPlatformAdmin } from './rbac';

export interface AuthSyncEvent {
  type: 'LOGIN_SUCCESS' | 'LOGOUT' | 'STORE_CHANGED';
  userId?: number | string;
  token?: string;
  slug?: string;
  senderTabId?: string;
}

type AuthSyncCallback = (event: AuthSyncEvent) => void;

// Unique ID for the current browsing session / tab instance to prevent loopback & self-echo
export const TAB_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

let channel: BroadcastChannel | null = null;
const listeners = new Set<AuthSyncCallback>();

// Timestamp of the last received/processed cross-tab logout to debounce storage events
let lastRemoteLogoutTime = 0;

/**
 * Checks if a JWT token is expired using pure base64 decoding (5-second safety buffer).
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(payloadBase64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed || typeof parsed.exp !== 'number') return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return parsed.exp < (currentTime + 5);
  } catch {
    return true;
  }
}

/**
 * Checks if current browser environment has an active, unexpired session token.
 */
export function hasValidSessionToken(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const token = localStorage.getItem('catavor_token') || localStorage.getItem('token');
  return Boolean(token && !isTokenExpired(token));
}

export const isReservedStoreSlug = (slug?: string | null): boolean => {
  if (!slug) return true;
  const clean = slug.toLowerCase().trim();
  const reserved = [
    'api', 'sanctum', 'desktop', 'mobile', 'tablet', 'assets', 'login', 'register',
    'admin', 'platform', 'system', 'ops', 'dashboard', 'terms', 'privacy',
    'acceptable-use', 'acceptable_use', 'syarat-ketentuan', 'kebijakan-privasi',
    'ketentuan-penggunaan', 'explore', 'directory', 'internal', 'staff', 'settings',
    'pengaturan', 'notifications', 'notifikasi', 'articles', 'artikel', 'subscription',
    'langganan', 'help', 'bantuan', 'support', 'catalogs', 'select-catalog', 'stores'
  ];
  return reserved.includes(clean);
};

/**
 * Generates user-scoped storage key for active catalog/store
 */
export function getScopedStoreSlugKey(userId: number | string): string {
  return `catavor_active_slug_${userId}`;
}

/**
 * Retrieves the last active catalog slug remembered specifically for this user
 */
export function getSavedUserSlug(userId: number | string): string | null {
  try {
    return localStorage.getItem(getScopedStoreSlugKey(userId));
  } catch {
    return null;
  }
}

/**
 * Saves active catalog slug scoped by user ID as well as global fallbacks
 */
export function saveUserActiveSlug(userId: number | string, slug: string): void {
  try {
    if (userId) {
      localStorage.setItem(getScopedStoreSlugKey(userId), slug);
    }
    localStorage.setItem('catavor_active_slug', slug);
    sessionStorage.setItem('catavor_active_slug_selected', slug);
  } catch {}
}

function initChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel('catavor_auth_sync');
      channel.onmessage = (e: MessageEvent<AuthSyncEvent>) => {
        if (!e.data || !e.data.type) return;

        // Echo suppression: Ignore broadcasts originating from THIS tab/window instance
        if (e.data.senderTabId && e.data.senderTabId === TAB_ID) {
          return;
        }

        if (e.data.type === 'LOGOUT') {
          lastRemoteLogoutTime = Date.now();
        }

        listeners.forEach((cb) => {
          try {
            cb(e.data);
          } catch (err) {
            console.error('[AuthSync] Callback error:', err);
          }
        });
      };
    } catch (err) {
      console.warn('[AuthSync] Failed to initialize BroadcastChannel:', err);
    }
  }
  return channel;
}

/**
 * Clears active catalog slug selections (both user-scoped and global) upon logout or reset
 */
export function clearUserActiveSlug(userId?: number | string): void {
  try {
    if (userId) {
      localStorage.removeItem(getScopedStoreSlugKey(userId));
    }
    localStorage.removeItem('catavor_active_slug');
    sessionStorage.removeItem('catavor_active_slug_selected');
    if (typeof localStorage !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('catavor_active_slug') || key.startsWith('catavor_store_selected'))) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}
}

/**
 * Preserves active ?view= parameter (e.g. view=mobile or view=tablet) during cross-route redirects
 */
export function appendViewParam(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if (view && !url.includes('view=')) {
      return url + (url.includes('?') ? '&' : '?') + 'view=' + encodeURIComponent(view);
    }
  } catch {}
  return url;
}

/**
 * Resolves the destination URL for an authenticated user avoiding the login form.
 */
export function resolveAuthenticatedRedirect(user?: any, preferredSlug?: string | null, preserveViewParam: boolean = true): string {
  let resolvedUser = user;
  if (!resolvedUser && typeof localStorage !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('catavor_user');
      if (savedUser) resolvedUser = JSON.parse(savedUser);
    } catch {}
  }

  let dest = '/catalogs';
  if (isPlatformAdmin(resolvedUser)) {
    dest = '/admin';
  } else if (preferredSlug && !isReservedStoreSlug(preferredSlug)) {
    dest = `/${preferredSlug.toLowerCase()}/admin`;
  } else {
    // Collect available stores
    let availableStores: any[] = [];
    if (Array.isArray(resolvedUser?.stores) && resolvedUser.stores.length > 0) {
      availableStores = resolvedUser.stores;
    } else if (typeof localStorage !== 'undefined') {
      try {
        const rawStores = localStorage.getItem('catavor_stores');
        if (rawStores) {
          const parsed = JSON.parse(rawStores);
          if (Array.isArray(parsed)) availableStores = parsed;
        }
      } catch {}
    }

    availableStores = availableStores.filter(s => s && s.slug && !isReservedStoreSlug(s.slug) && s.dormancy_status !== 'banned' && !s.is_blacklisted);

    if (availableStores.length === 1) {
      // Rule: Account with EXACTLY 1 catalog profile automatically enters that single store dashboard
      const singleSlug = availableStores[0].slug;
      if (resolvedUser?.id && singleSlug) {
        saveUserActiveSlug(resolvedUser.id, singleSlug);
      }
      try {
        localStorage.setItem('catavor_active_slug', singleSlug);
        sessionStorage.setItem('catavor_active_slug_selected', singleSlug);
      } catch {}
      dest = `/${singleSlug.toLowerCase()}/admin`;
    } else if (availableStores.length > 1) {
      // Rule: Account with MULTIPLE stores (>1) MUST choose one at the beginning (/catalogs),
      // unless a specific store was already chosen in this active browser session.
      let activeSlug: string | null = null;
      try {
        activeSlug = sessionStorage.getItem('catavor_active_slug_selected');
      } catch {}

      if (activeSlug && availableStores.some(s => s.slug?.toLowerCase() === activeSlug?.toLowerCase())) {
        dest = `/${activeSlug.toLowerCase()}/admin`;
      } else {
        dest = '/catalogs';
      }
    } else {
      // 0 stores
      let fallbackActiveSlug: string | null = null;
      try {
        fallbackActiveSlug = sessionStorage.getItem('catavor_active_slug_selected') || localStorage.getItem('catavor_active_slug');
      } catch {}
      if (fallbackActiveSlug && !isReservedStoreSlug(fallbackActiveSlug)) {
        dest = `/${fallbackActiveSlug.toLowerCase()}/admin`;
      } else if (resolvedUser?.store_slug && !isReservedStoreSlug(resolvedUser.store_slug)) {
        dest = `/${resolvedUser.store_slug.toLowerCase()}/admin`;
      } else if (resolvedUser?.active_store?.slug && !isReservedStoreSlug(resolvedUser.active_store.slug)) {
        dest = `/${resolvedUser.active_store.slug.toLowerCase()}/admin`;
      } else {
        dest = '/';
      }
    }
  }

  return preserveViewParam ? appendViewParam(dest) : dest;
}

/**
 * Broadcasts auth/store events to all open tabs/windows
 */
export function broadcastAuthEvent(event: AuthSyncEvent): void {
  try {
    const ch = initChannel();
    const payload: AuthSyncEvent = {
      ...event,
      senderTabId: TAB_ID,
    };
    ch?.postMessage(payload);

    // Secondary sync: Write to a designated localStorage key to trigger native window 'storage' event across all tabs/windows
    try {
      localStorage.setItem('catavor_auth_sync_ping', JSON.stringify({ ...payload, _ts: Date.now() }));
    } catch {}
  } catch (err) {
    console.warn('[AuthSync] BroadcastChannel postMessage error:', err);
  }
}

/**
 * Subscribes current tab to cross-tab auth state changes
 */
export function subscribeAuthSync(callback: AuthSyncCallback): () => void {
  listeners.add(callback);
  initChannel();

  // Storage event listener as fallback / secondary sync for cross-tab mutations
  const handleStorage = (e: StorageEvent) => {
    if (!e.key) return;

    if (e.key === 'catavor_auth_sync_ping' && e.newValue) {
      try {
        const payload: AuthSyncEvent = JSON.parse(e.newValue);
        if (payload.senderTabId && payload.senderTabId === TAB_ID) return;
        if (payload.type === 'LOGOUT') {
          if (Date.now() - lastRemoteLogoutTime < 1500) return;
          lastRemoteLogoutTime = Date.now();
        }
        listeners.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('[AuthSync] Callback error:', err);
          }
        });
      } catch {}
      return;
    }

    if (e.key === 'catavor_token') {
      if (!e.newValue && e.oldValue) {
        // Debounce: If BroadcastChannel already handled LOGOUT within the last 1500ms, skip duplicate
        if (Date.now() - lastRemoteLogoutTime < 1500) {
          return;
        }
        lastRemoteLogoutTime = Date.now();
        listeners.forEach((cb) => cb({ type: 'LOGOUT', senderTabId: 'storage_event' }));
      } else if (e.newValue && e.newValue !== e.oldValue) {
        const rawUser = localStorage.getItem('catavor_user');
        let userId: number | string = '';
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser);
            userId = parsed.id || '';
          } catch {}
        }
        listeners.forEach((cb) => cb({ type: 'LOGIN_SUCCESS', userId, token: e.newValue || '', senderTabId: 'storage_event' }));
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}
