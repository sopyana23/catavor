import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Mail,
  Store,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { TabletPublicLanding } from './components/TabletPublicLanding';
import { TabletStoreCatalog } from './components/TabletStoreCatalog';
import { TabletMerchantAdmin } from './components/TabletMerchantAdmin';
import { TabletPlatformConsole } from './components/TabletPlatformConsole';
import { type UserRBACInfo, isPlatformAdmin } from './utils/rbac';
import { isTokenExpired } from './utils/auth';
import {
  subscribeAuthSync,
  broadcastAuthEvent,
  saveUserActiveSlug,
  clearUserActiveSlug,
  resolveAuthenticatedRedirect,
  hasValidSessionToken,
  appendViewParam
} from './utils/authSync';
import { smartBack } from './utils/navigation';

const RESERVED_SLUGS = ['api', 'desktop', 'tablet', 'mobile', 'assets', 'login', 'register', 'admin', 'platform', 'ops', 'catalogs', 'select-catalog', 'stores'];

export const isCatalogChooserRoute = (path: string): boolean => {
  const p = path.toLowerCase().replace(/\/$/, '');
  return p === '/catalogs' || p === '/select-catalog' || p === '/stores';
};

export const extractSlugFromPath = (pathname: string): string | null => {
  if (!pathname) return null;
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  if (parts.length === 0) return null;
  // Format /login/:slug or /login/:slug/admin
  if (parts[0].toLowerCase() === 'login' && parts.length > 1 && !RESERVED_SLUGS.includes(parts[1].toLowerCase())) {
    return parts[1].toLowerCase();
  }
  // Format /:slug or /:slug/admin or /:slug/login
  if (!RESERVED_SLUGS.includes(parts[0].toLowerCase())) {
    return parts[0].toLowerCase();
  }
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('slug');
      if (q && !RESERVED_SLUGS.includes(q.toLowerCase())) return q.toLowerCase();
    } catch {}
  }
  return null;
};

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('catavor_token') || localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState<UserRBACInfo | null>(() => {
    try {
      const saved = localStorage.getItem('catavor_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [storeTheme, setStoreTheme] = useState<string>(() => {
    return localStorage.getItem('catavor_theme') || 'navy';
  });

  // Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
  });

  // Active Store Slug
  const [activeSlug, setActiveSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractSlugFromPath(window.location.pathname);
  });

  // Store Profile & Settings (Cached / Live)
  const [storeInfo, setStoreInfo] = useState<{ title?: string; logo_url?: string; theme?: string } | null>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('catavor_settings');
        if (raw) {
          const s = JSON.parse(raw);
          return { title: s.store_title, logo_url: s.store_logo_url, theme: s.store_theme };
        }
      } catch {}
    }
    return null;
  });

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dynamic Theme Sync (navy, emerald, cyberpunk, ocean, pastel, sage, nordic, cream)
  useEffect(() => {
    const resolvedTheme = storeTheme || 'navy';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.body.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem('catavor_theme', resolvedTheme);
  }, [storeTheme]);

  // Fetch store profile and dynamic theme when activeSlug is available
  useEffect(() => {
    if (!activeSlug) return;
    let isMounted = true;
    const fetchStoreProfile = async () => {
      try {
        const res = await fetch(`/api/u/${encodeURIComponent(activeSlug)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            const st = json.data;
            setStoreInfo({
              title: st.store_title || st.name,
              logo_url: st.store_logo_url,
              theme: st.store_theme
            });
            if (st.store_theme) {
              setStoreTheme(st.store_theme);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load store profile in tablet:', err);
      }
    };
    fetchStoreProfile();
    return () => { isMounted = false; };
  }, [activeSlug]);

  // Session Token & RBAC Verification Hook on Mount
  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const verifySession = async () => {
      if (!token) return;
      if (isTokenExpired(token)) {
        handleUnauthorized();
        return;
      }
      try {
        const res = await fetch('/api/auth/verify', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('catavor_user', JSON.stringify(data.user));
            if (data.stores && Array.isArray(data.stores)) {
              try {
                localStorage.setItem('catavor_stores', JSON.stringify(data.stores));
              } catch {}
            }
            if (data.active_store?.store_theme || data.user?.store_theme) {
              setStoreTheme(data.active_store?.store_theme || data.user?.store_theme);
            }
            if (data.active_store?.slug) {
              localStorage.setItem('catavor_active_slug', data.active_store.slug);
            }
            if (!isPlatformAdmin(data.user)) {
              const curPath = window.location.pathname.toLowerCase();
              if (curPath === '/admin' || isCatalogChooserRoute(curPath)) {
                const destination = resolveAuthenticatedRedirect(data.user);
                const destPath = destination.split('?')[0].toLowerCase();
                if (destPath !== curPath) {
                  navigateTo(destination);
                }
              }
            }
          } else {
            handleUnauthorized();
          }
        } else if (res.status === 401 || res.status === 403) {
          handleUnauthorized();
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      }
    };
    verifySession();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle URL change & proactive /login redirect
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && window.__catavor_is_modal_popping) return;
      const pathname = window.location.pathname.toLowerCase();
      setCurrentPath(pathname);
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0 && !RESERVED_SLUGS.includes(parts[0])) {
        setActiveSlug(parts[0]);
      } else {
        setActiveSlug(null);
      }

      const curToken = localStorage.getItem('catavor_token') || token;
      if (curToken && !isTokenExpired(curToken)) {
        const rawUser = localStorage.getItem('catavor_user');
        let u: any = currentUser;
        if (!u && rawUser) {
          try { u = JSON.parse(rawUser); } catch {}
        }
        const isStaff = isPlatformAdmin(u);
        const shouldRedirect =
          pathname === '/login' ||
          pathname.endsWith('/login') ||
          (pathname === '/admin' && !isStaff) ||
          isCatalogChooserRoute(pathname);

        if (shouldRedirect) {
          const destination = resolveAuthenticatedRedirect(u);
          const destPath = destination.split('?')[0].toLowerCase();
          if (destPath !== pathname) {
            window.history.replaceState({}, '', destination);
            setCurrentPath(destPath);
            const pParts = destPath.split('/').filter(Boolean);
            if (pParts.length > 0 && !RESERVED_SLUGS.includes(pParts[0])) {
              setActiveSlug(pParts[0]);
            }
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, currentUser]);

  // Initial mount route check: if at /login, /admin (non-staff), or /catalogs with active token, immediately redirect to admin dashboard
  useEffect(() => {
    const pathname = window.location.pathname.toLowerCase();
    const curToken = localStorage.getItem('catavor_token') || token;
    if (curToken && !isTokenExpired(curToken)) {
      const rawUser = localStorage.getItem('catavor_user');
      let u: any = currentUser;
      if (!u && rawUser) {
        try { u = JSON.parse(rawUser); } catch {}
      }
      const isStaff = isPlatformAdmin(u);
      const shouldRedirect =
        pathname === '/login' ||
        pathname.endsWith('/login') ||
        ((pathname === '/admin' || pathname.startsWith('/admin/')) && !isStaff) ||
        isCatalogChooserRoute(pathname);

      if (shouldRedirect) {
        const destination = resolveAuthenticatedRedirect(u);
        const destPath = destination.split('?')[0].toLowerCase();
        if (destPath !== pathname) {
          window.history.replaceState({}, '', destination);
          setCurrentPath(destPath);
          const parts = destPath.split('/').filter(Boolean);
          if (parts.length > 0 && !RESERVED_SLUGS.includes(parts[0])) {
            setActiveSlug(parts[0]);
          }
        }
      }
    }
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    const pathname = path.split('?')[0].toLowerCase();
    setCurrentPath(pathname);
    const slug = extractSlugFromPath(pathname);
    setActiveSlug(slug);
  };

  const isPlatformAdminPath = currentPath === '/admin' || currentPath.startsWith('/admin/') || currentPath === '/platform' || currentPath.startsWith('/platform/') || currentPath === '/ops' || currentPath.startsWith('/ops/');

  // Industry-standard centralized 401/unauthorized session eviction handler
  const handleUnauthorized = (msg = 'Sesi Anda telah berakhir demi keamanan. Silakan login kembali.', customRedirectUrl?: string) => {
    const isStaff = isPlatformAdmin(currentUser);
    const targetLoginUrl = customRedirectUrl || (isStaff || isPlatformAdminPath ? '/admin' : (activeSlug ? `/${activeSlug}/admin` : '/login'));
    localStorage.removeItem('catavor_token');
    localStorage.removeItem('catavor_user');
    localStorage.removeItem('catavor_stores');
    localStorage.removeItem('catavor_active_slug');
    try { sessionStorage.removeItem('catavor_active_slug_selected'); } catch {}
    clearUserActiveSlug(currentUser?.id);
    setToken(null);
    setCurrentUser(null);
    setLoginError(msg);
    broadcastAuthEvent({ type: 'LOGOUT' });
    navigateTo(targetLoginUrl);
  };

  // Safe logout with smart redirect to dedicated admin portal (/admin) or merchant login (/login)
  const handleLogout = (customRedirectUrl?: string) => {
    const isStaff = isPlatformAdmin(currentUser);
    const targetLoginUrl = customRedirectUrl || (isStaff || isPlatformAdminPath ? '/admin' : '/login');
    localStorage.removeItem('catavor_token');
    localStorage.removeItem('catavor_user');
    localStorage.removeItem('catavor_stores');
    localStorage.removeItem('catavor_active_slug');
    try { sessionStorage.removeItem('catavor_active_slug_selected'); } catch {}
    clearUserActiveSlug(currentUser?.id);
    setToken(null);
    setCurrentUser(null);
    setLoginError(null);
    broadcastAuthEvent({ type: 'LOGOUT' });
    navigateTo(targetLoginUrl);
  };

  const handleThemeChange = useCallback((newTheme: string) => {
    setStoreTheme(prev => (prev === newTheme ? prev : newTheme));
  }, []);

  // Perform Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const json = await res.json();
      if (res.ok && json.token) {
        localStorage.setItem('catavor_token', json.token);
        localStorage.setItem('catavor_user', JSON.stringify(json.user || {}));
        const rawStoresList = Array.isArray(json.stores) ? json.stores : [];
        const availableStores = rawStoresList.filter((s: any) => s && s.slug && !RESERVED_SLUGS.includes(s.slug.toLowerCase()) && s.dormancy_status !== 'banned' && !s.is_blacklisted);
        localStorage.setItem('catavor_stores', JSON.stringify(availableStores));

        setToken(json.token);
        setCurrentUser(json.user);
        if (json.active_store?.store_theme || json.user?.store_theme) {
          setStoreTheme(json.active_store?.store_theme || json.user?.store_theme);
        }

        let targetSlug: string | null = null;
        if (availableStores.length === 1 && availableStores[0]?.slug) {
          const singleSlug = String(availableStores[0].slug);
          targetSlug = singleSlug;
          localStorage.setItem('catavor_active_slug', singleSlug);
          try { sessionStorage.setItem('catavor_active_slug_selected', singleSlug); } catch {}
          if (json.user?.id) saveUserActiveSlug(json.user.id, singleSlug);
        } else {
          localStorage.removeItem('catavor_active_slug');
          try { sessionStorage.removeItem('catavor_active_slug_selected'); } catch {}
        }

        setLoginEmail('');
        setLoginPassword('');

        const destination = resolveAuthenticatedRedirect(json.user, targetSlug);
        broadcastAuthEvent({ type: 'LOGIN_SUCCESS', userId: json.user?.id || '0', token: json.token });
        navigateTo(destination);
      } else {
        setLoginError(json.message || 'Email atau password tidak sesuai.');
      }
    } catch {
      setLoginError('Gagal menghubungi server. Periksa koneksi internet Anda.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Google OAuth SSO Handler
  const processGoogleUserPayload = async (googleUser: { email?: string; name?: string; google_id?: string; avatar?: string; token?: string; credential?: string }) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleUser.email || '',
          name: googleUser.name || '',
          google_id: googleUser.google_id || '',
          avatar: googleUser.avatar || '',
          token: googleUser.token || '',
          credential: googleUser.credential || '',
          store_slug: activeSlug || ''
        })
      });

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('catavor_token', data.token);
        if (data.user) {
          localStorage.setItem('catavor_user', JSON.stringify(data.user));
          setCurrentUser(data.user);
        }
        const rawStoresList = Array.isArray(data.stores) ? data.stores : [];
        const availableStores = rawStoresList.filter((s: any) => s && s.slug && !RESERVED_SLUGS.includes(s.slug.toLowerCase()) && s.dormancy_status !== 'banned' && !s.is_blacklisted);
        localStorage.setItem('catavor_stores', JSON.stringify(availableStores));

        setToken(data.token);
        if (data.active_store?.store_theme || data.user?.store_theme) {
          setStoreTheme(data.active_store?.store_theme || data.user?.store_theme);
        }

        let targetSlug: string | null = null;
        if (availableStores.length === 1 && availableStores[0]?.slug) {
          const singleSlug = String(availableStores[0].slug);
          targetSlug = singleSlug;
          localStorage.setItem('catavor_active_slug', singleSlug);
          try { sessionStorage.setItem('catavor_active_slug_selected', singleSlug); } catch {}
          if (data.user?.id) saveUserActiveSlug(data.user.id, singleSlug);
        } else {
          localStorage.removeItem('catavor_active_slug');
          try { sessionStorage.removeItem('catavor_active_slug_selected'); } catch {}
        }

        const destination = resolveAuthenticatedRedirect(data.user, targetSlug);
        broadcastAuthEvent({ type: 'LOGIN_SUCCESS', userId: data.user?.id || '0', token: data.token });
        navigateTo(destination);
      } else {
        setLoginError(data.message || 'Otentikasi Google gagal diproses.');
      }
    } catch {
      setLoginError('Terjadi kesalahan saat otentikasi Google SSO.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOAuthToken = async (accessToken: string) => {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userInfoRes.ok) {
        const googleUser = await userInfoRes.json();
        if (googleUser && googleUser.email) {
          processGoogleUserPayload({
            email: googleUser.email,
            name: googleUser.name,
            google_id: googleUser.sub,
            avatar: googleUser.picture,
            token: accessToken
          });
          return;
        }
      }
    } catch (_) {}
    processGoogleUserPayload({ token: accessToken });
  };

  const handleGoogleSSO = () => {
    const googleClientId = (window as any).GOOGLE_CLIENT_ID || '847403664953-ef7k9h5n99mtlnbdpr4a6300dt83efk5.apps.googleusercontent.com';

    // 1. Google Identity Services GSI SDK
    if ((window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              handleOAuthToken(tokenResponse.access_token);
            }
          }
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn('GSI init error, switching to OAuth popup:', err);
      }
    }

    // 2. Real Google OAuth 2.0 Popup Window
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent('email profile openid');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(authUrl, 'google_oauth_popup', `width=${width},height=${height},left=${left},top=${top}`);

    if (popup) {
      const checkPopup = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            return;
          }
          let currentHref = '';
          try { currentHref = popup.location?.href || ''; } catch (_) {}
          if (currentHref && currentHref.includes('access_token=')) {
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            try { popup.close(); } catch (_) {}
            clearInterval(checkPopup);
            if (accessToken) {
              handleOAuthToken(accessToken);
            }
          }
        } catch (_) {}
      }, 500);
    }
  };

  // Google OAuth Cross-Window Listener
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CATAVOR_GOOGLE_AUTH_CALLBACK') {
        const hash = event.data.hash ? event.data.hash.replace(/^#/, '') : '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) handleOAuthToken(accessToken);
      }
    };
    window.addEventListener('message', handleAuthMessage);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('catavor_oauth_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'CATAVOR_GOOGLE_AUTH_CALLBACK') {
            const hash = event.data.hash ? event.data.hash.replace(/^#/, '') : '';
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            if (accessToken) handleOAuthToken(accessToken);
          }
        };
      } catch (_) {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'catavor_oauth_broadcast' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload?.hash) {
            const hash = payload.hash.replace(/^#/, '');
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            if (accessToken) handleOAuthToken(accessToken);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, []);

  // Industry Best Practice: Cross-Tab Session & Store Synchronization for Tablet
  useEffect(() => {
    const unsubscribe = subscribeAuthSync((event) => {
      if (event.type === 'LOGOUT') {
        if (token) {
          const isStaff = isPlatformAdmin(currentUser);
          handleLogout(isStaff ? '/admin' : '/login');
        }
      } else if (event.type === 'LOGIN_SUCCESS') {
        const storedToken = localStorage.getItem('catavor_token') || event.token;
        if (storedToken) {
          if (storedToken !== token) {
            setToken(storedToken);
            const rawUser = localStorage.getItem('catavor_user');
            let parsedUser: any = null;
            try { parsedUser = rawUser ? JSON.parse(rawUser) : null; } catch {}
            if (parsedUser) setCurrentUser(parsedUser);

            const rawStores = localStorage.getItem('catavor_stores');
            if (rawStores) {
              try {
                const parsedStores = JSON.parse(rawStores);
                if (Array.isArray(parsedStores) && parsedStores.length > 0 && parsedStores[0]?.slug) {
                  setActiveSlug(parsedStores[0].slug);
                }
              } catch {}
            }
          }

          const currentP = window.location.pathname.toLowerCase();
          let parsedUser: any = null;
          try {
            const rawUser = localStorage.getItem('catavor_user');
            if (rawUser) parsedUser = JSON.parse(rawUser);
          } catch {}
          if (!parsedUser) parsedUser = currentUser;

          const isStaff = isPlatformAdmin(parsedUser);
          const isGenericAdmin = currentP === '/admin' || currentP.startsWith('/admin/');
          const isLogin = currentP === '/login' || currentP.endsWith('/login');
          const isChooser = currentP === '/catalogs' || isCatalogChooserRoute(currentP);
          const isHome = currentP === '/' || currentP === '';

          if (isLogin || isHome || isChooser || (isGenericAdmin && !isStaff)) {
            const redirectUrl = resolveAuthenticatedRedirect(parsedUser);
            navigateTo(redirectUrl);
          }
        }
      } else if (event.type === 'STORE_CHANGED') {
        if (event.slug && event.slug !== activeSlug) {
          setActiveSlug(event.slug);
        }
      }
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const storedToken = localStorage.getItem('catavor_token');
        if (storedToken && !isTokenExpired(storedToken)) {
          if (storedToken !== token) {
            setToken(storedToken);
            const rawUser = localStorage.getItem('catavor_user');
            let parsedUser: any = null;
            try { parsedUser = rawUser ? JSON.parse(rawUser) : null; } catch {}
            if (parsedUser) setCurrentUser(parsedUser);

            const rawStores = localStorage.getItem('catavor_stores');
            if (rawStores) {
              try {
                const parsedStores = JSON.parse(rawStores);
                if (Array.isArray(parsedStores) && parsedStores.length > 0 && parsedStores[0]?.slug) {
                  setActiveSlug(parsedStores[0].slug);
                }
              } catch {}
            }
          }
          const currentP = window.location.pathname.toLowerCase();
          let parsedUser: any = null;
          try {
            const rawUser = localStorage.getItem('catavor_user');
            if (rawUser) parsedUser = JSON.parse(rawUser);
          } catch {}
          if (!parsedUser) parsedUser = currentUser;

          const isStaff = isPlatformAdmin(parsedUser);
          const isGenericAdmin = currentP === '/admin' || currentP.startsWith('/admin/');
          const isLogin = currentP === '/login' || currentP.endsWith('/login');
          const isChooser = currentP === '/catalogs' || isCatalogChooserRoute(currentP);
          const isHome = currentP === '/' || currentP === '';

          if (isLogin || isHome || isChooser || (isGenericAdmin && !isStaff)) {
            const redirectUrl = resolveAuthenticatedRedirect(parsedUser);
            navigateTo(redirectUrl);
          }
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [token, currentUser, activeSlug, currentPath]);

  const isLoginRoute = currentPath === '/login';
  const isCatalogChooser = isCatalogChooserRoute(currentPath);
  const isStoreAdminRoute = Boolean(activeSlug) && (
    currentPath === `/${activeSlug}/admin` ||
    currentPath.startsWith(`/${activeSlug}/admin/`) ||
    currentPath === `/${activeSlug}/login` ||
    currentPath === `/login/${activeSlug}` ||
    currentPath === `/login/${activeSlug}/admin`
  );
  const merchantSlug = (() => {
    if ((currentUser as any)?.store_slug) return (currentUser as any).store_slug;
    if ((currentUser as any)?.active_store?.slug) return (currentUser as any).active_store.slug;
    if (Array.isArray((currentUser as any)?.stores) && (currentUser as any).stores[0]?.slug) {
      return (currentUser as any).stores[0].slug;
    }
    if (typeof localStorage !== 'undefined') {
      const active = localStorage.getItem('catavor_active_slug');
      if (active) return active;
      try {
        const rawStores = localStorage.getItem('catavor_stores');
        if (rawStores) {
          const parsed = JSON.parse(rawStores);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.slug) {
            return parsed[0].slug;
          }
        }
      } catch {}
    }
    return activeSlug || '';
  })();

  useEffect(() => {
    if (token && !isPlatformAdmin(currentUser) && (currentPath === '/admin' || currentPath.startsWith('/admin/'))) {
      const destination = resolveAuthenticatedRedirect(currentUser, merchantSlug);
      const destPath = destination.split('?')[0].toLowerCase();
      if (destPath !== '/admin') {
        navigateTo(destination);
      } else {
        navigateTo('/catalogs');
      }
    }
  }, [token, currentUser, currentPath, merchantSlug]);

  // 1. PUBLIC STORE CATALOG ROUTE (e.g. /:slug and not admin, platform, ops, or login)
  if (activeSlug && !isStoreAdminRoute && !isLoginRoute && !isPlatformAdminPath) {
    return (
      <TabletStoreCatalog
        slug={activeSlug}
        onBackToExplore={() => smartBack('/')}
      />
    );
  }

  // 2. DEDICATED PLATFORM ADMIN CONSOLE & LOGIN (/admin, /platform, /ops)
  if (isPlatformAdminPath) {
    // 2A. Authenticated Platform Staff
    if (token && isPlatformAdmin(currentUser)) {
      return (
        <TabletPlatformConsole
          token={token}
          currentUser={currentUser}
          onLogout={() => handleLogout('/admin')}
        />
      );
    }

    // 2B. Authenticated but NON-PLATFORM STAFF (Merchant logged in attempting /admin access)
    if (token && !isPlatformAdmin(currentUser)) {
      // Pure ops & internal platform admin paths require platform staff privileges
      if (currentPath === '/platform' || currentPath.startsWith('/platform/') || currentPath === '/ops' || currentPath.startsWith('/ops/')) {
        return (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-deep)',
            color: 'var(--text-primary)',
            padding: '2rem'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-light)',
              padding: '2.5rem',
              boxShadow: 'var(--shadow-premium)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '1.15rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: '#ef4444',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <ShieldAlert size={30} />
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                Akses Dibatasi — Staf Platform
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0', lineHeight: 1.6 }}>
                Akun Anda saat ini (<strong>{currentUser?.email || 'Merchant'}</strong>) terdaftar sebagai merchant/penjual, bukan staf pengelola platform Catavor.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => navigateTo(merchantSlug ? `/${merchantSlug}/admin` : '/')}
                  style={{
                    minHeight: '48px',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  Buka Dashboard Toko Saya
                </button>
                <button
                  type="button"
                  onClick={() => handleLogout('/admin')}
                  style={{
                    minHeight: '44px',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-light)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Keluar &amp; Masuk Akun Pengelola
                </button>
                <button
                  type="button"
                  onClick={() => smartBack('/')}
                  style={{
                    minHeight: '38px',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginTop: '0.25rem'
                  }}
                >
                  &larr; Kembali ke Halaman Utama
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Seamless Merchant Experience: When merchant visits generic /admin, auto-redirect directly to their dashboard!
      const redirectUrl = resolveAuthenticatedRedirect(currentUser, merchantSlug);
      const pathOnly = redirectUrl.split('?')[0].toLowerCase();
      if (pathOnly !== '/admin') {
        window.location.replace(redirectUrl);
      } else {
        window.location.replace(appendViewParam(merchantSlug ? `/${merchantSlug}/admin` : '/catalogs'));
      }
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-deep)',
          color: 'var(--text-primary)'
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Mengarahkan ke dashboard katalog...</div>
        </div>
      );
    }


    // 2C. Unauthenticated on Platform Admin Route -> Dedicated Platform Staff Login Screen
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        padding: '2rem'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <ShieldCheck size={28} />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              Masuk Konsol Pengelola Platform
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
              Portal otentikasi resmi staf kepatuhan, CS, keuangan, dan eksekutif platform
            </p>
          </div>

          {loginError && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <button
              type="button"
              onClick={handleGoogleSSO}
              disabled={loginLoading}
              style={{
                minHeight: '48px',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Masuk Staf dengan Akun Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>atau email staf &amp; sandi</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Email Resmi Staf
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <Mail size={18} color="var(--text-muted)" />
                <input
                  type="email"
                  required
                  placeholder="admin@catavor.id"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Kata Sandi
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <Lock size={18} color="var(--text-muted)" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                minHeight: '48px',
                padding: '0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem'
              }}
            >
              {loginLoading ? 'Memverifikasi...' : 'Masuk ke Konsol Pengelola'}
            </button>

            <button
              type="button"
              onClick={() => smartBack('/')}
              style={{
                minHeight: '40px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              &larr; Kembali ke Halaman Utama
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. STORE ADMIN ROUTE (/:slug/admin) & CATALOG CHOOSER (/catalogs)
  if (isStoreAdminRoute || isCatalogChooser) {
    if (!token) {
      if (isCatalogChooser) {
        navigateTo('/login');
        return null;
      }
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-deep)',
          color: 'var(--text-primary)',
          padding: '2rem 1.5rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light)',
            padding: '2.5rem 2.25rem',
            boxShadow: 'var(--shadow-premium)',
            boxSizing: 'border-box'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '1rem',
                backgroundColor: 'var(--primary-glow)',
                border: '1.5px solid var(--border-light)',
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem auto',
                overflow: 'hidden'
              }}>
                {storeInfo?.logo_url ? (
                  <img src={storeInfo.logo_url} alt={storeInfo.title || activeSlug || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Store size={28} />
                )}
              </div>
              <h1 style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-heading)'
              }}>
                Login Administrator
              </h1>
              <p style={{
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5
              }}>
                Kelola etalase katalog &amp; pesanan {storeInfo?.title ? `"${storeInfo.title}"` : activeSlug ? `"${activeSlug}"` : 'bisnis Anda'}
              </p>
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <ShieldCheck size={13} />
                  <span>Panel Pengelola Toko</span>
                </span>
              </div>
            </div>

            {loginError && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: 'var(--danger, #ef4444)',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                lineHeight: 1.45
              }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <button
                type="button"
                onClick={handleGoogleSSO}
                disabled={loginLoading}
                style={{
                  width: '100%',
                  minHeight: '46px',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1.5px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Masuk dengan Google</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '0.2rem 0', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.06em' }}>ATAU MASUK MANUAL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Email Administrator
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.72rem 0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1.5px solid var(--border-light)',
                  minHeight: '44px'
                }}>
                  <Mail size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="email"
                    required
                    placeholder="admin@catavor.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Kata Sandi
                  </label>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.72rem 0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1.5px solid var(--border-light)',
                  minHeight: '44px'
                }}>
                  <Lock size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: '100%',
                  minHeight: '46px',
                  padding: '0.8rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem'
                }}
              >
                {loginLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
              </button>

              <button
                type="button"
                onClick={() => navigateTo(activeSlug ? `/${activeSlug}` : '/')}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  marginTop: '0.25rem'
                }}
              >
                <ArrowLeft size={15} />
                <span>Kembali ke Katalog Publik {activeSlug ? `(${activeSlug})` : ''}</span>
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (isCatalogChooser) {
      let storesList: any[] = [];
      try {
        const raw = localStorage.getItem('catavor_stores');
        if (raw) storesList = JSON.parse(raw);
      } catch {}
      if (!storesList.length && Array.isArray((currentUser as any)?.stores)) {
        storesList = (currentUser as any).stores;
      }
      storesList = storesList.filter((s: any) => s && s.slug && !RESERVED_SLUGS.includes(s.slug.toLowerCase()) && s.dormancy_status !== 'banned' && !s.is_blacklisted);
      if (storesList.length === 1) {
        const singleSlug = storesList[0].slug;
        try {
          sessionStorage.setItem('catavor_active_slug_selected', singleSlug);
          localStorage.setItem('catavor_active_slug', singleSlug);
        } catch {}
        navigateTo(`/${singleSlug}/admin`);
        return null;
      }
    }

    return (
      <TabletMerchantAdmin
        token={token}
        currentUser={currentUser}
        storeSlug={activeSlug || merchantSlug || 'my-store'}
        initialOpenStoreChooser={isCatalogChooser}
        onLogout={() => handleLogout('/login')}
        onUnauthorized={(msg) => handleUnauthorized(msg, '/login')}
        onViewPublicCatalog={() => navigateTo(activeSlug ? `/${activeSlug}` : '/')}
        onThemeChange={handleThemeChange}
      />
    );
  }

  // 4. GENERAL LOGIN ROUTE (/login)
  if (isLoginRoute) {
    const curToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('catavor_token') : null);
    if (curToken && !isTokenExpired(curToken)) {
      const destination = resolveAuthenticatedRedirect(currentUser);
      navigateTo(destination);
      return null;
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        padding: '2rem'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Lock size={28} />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              Masuk Konsol Tablet
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
              Kelola katalog toko Anda atau akses konsol operasional
            </p>
          </div>

          {loginError && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <button
              type="button"
              onClick={handleGoogleSSO}
              disabled={loginLoading}
              style={{
                minHeight: '48px',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Masuk dengan Akun Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>atau email &amp; sandi</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Alamat Email
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <Mail size={18} color="var(--text-muted)" />
                <input
                  type="email"
                  required
                  placeholder="merchant@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Kata Sandi
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <Lock size={18} color="var(--text-muted)" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                minHeight: '48px',
                padding: '0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem'
              }}
            >
              {loginLoading ? 'Memproses...' : 'Masuk ke Konsol'}
            </button>

            <button
              type="button"
              onClick={() => smartBack('/')}
              style={{
                minHeight: '40px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              &larr; Kembali ke Halaman Utama
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. PUBLIC LANDING PAGE ROUTE FOR TABLET (Default)
  return (
    <TabletPublicLanding
      onSelectStore={(slug) => navigateTo(`/${slug}`)}
      onOpenLogin={() => navigateTo('/login')}
      currentUser={currentUser}
    />
  );
};

export default App;

