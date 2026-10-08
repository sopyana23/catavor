/**
 * Cross-Tab Authentication & Session Synchronization Utility
 * Implements Industry-Standard session sync across multiple tabs/windows
 * using BroadcastChannel and window StorageEvent.
 */

export type AuthSyncEvent =
  | { type: 'LOGIN_SUCCESS'; userId: number | string; token: string }
  | { type: 'LOGOUT' }
  | { type: 'STORE_CHANGED'; userId: number | string; slug: string };

type AuthSyncCallback = (event: AuthSyncEvent) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<AuthSyncCallback>();

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

/**
 * Broadcasts auth/store events to all open tabs/windows
 */
export function broadcastAuthEvent(event: AuthSyncEvent): void {
  try {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('catavor_auth_sync');
    }
    channel?.postMessage(event);
  } catch (err) {
    console.warn('[AuthSync] BroadcastChannel postMessage error:', err);
  }
}

/**
 * Subscribes current tab to cross-tab auth state changes
 */
export function subscribeAuthSync(callback: AuthSyncCallback): () => void {
  listeners.add(callback);

  // Initialize BroadcastChannel if available
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('catavor_auth_sync');
      channel.onmessage = (e: MessageEvent<AuthSyncEvent>) => {
        if (e.data && e.data.type) {
          listeners.forEach((cb) => {
            try {
              cb(e.data);
            } catch (err) {
              console.error('[AuthSync] Callback error:', err);
            }
          });
        }
      };
    } catch {}
  }

  // Storage event listener for cross-tab localStorage mutations
  const handleStorage = (e: StorageEvent) => {
    if (!e.key) return;

    if (e.key === 'catavor_token') {
      if (!e.newValue) {
        listeners.forEach((cb) => cb({ type: 'LOGOUT' }));
      } else {
        const rawUser = localStorage.getItem('catavor_user');
        let userId: number | string = '';
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser);
            userId = parsed.id || '';
          } catch {}
        }
        listeners.forEach((cb) => cb({ type: 'LOGIN_SUCCESS', userId, token: e.newValue || '' }));
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}
