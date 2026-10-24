/**
 * Cross-Tab Authentication & Session Synchronization Utility
 * Implements Industry-Standard session sync across multiple tabs/windows
 * using BroadcastChannel and window StorageEvent with loopback & cascade prevention.
 */

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
 * Broadcasts auth/store events to other open tabs/windows
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
