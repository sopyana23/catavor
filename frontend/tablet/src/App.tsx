import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Mail,
  Store,
  ShieldCheck,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { TabletPublicLanding } from './components/TabletPublicLanding';
import { TabletStoreCatalog } from './components/TabletStoreCatalog';
import { TabletMerchantAdmin } from './components/TabletMerchantAdmin';
import { TabletPlatformConsole } from './components/TabletPlatformConsole';
import { type UserRBACInfo, isPlatformAdmin } from './utils/rbac';
import { isTokenExpired } from './utils/auth';

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
    const parts = window.location.pathname.split('/').filter(Boolean);
    const reserved = ['api', 'desktop', 'tablet', 'mobile', 'assets', 'login', 'register', 'admin', 'platform', 'ops'];
    if (parts.length > 0 && !reserved.includes(parts[0].toLowerCase())) {
      return parts[0].toLowerCase();
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
            if (data.active_store?.store_theme || data.user?.store_theme) {
              setStoreTheme(data.active_store?.store_theme || data.user?.store_theme);
            }
            if (data.active_store?.slug) {
              localStorage.setItem('catavor_active_slug', data.active_store.slug);
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

  // Handle URL change
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname.toLowerCase();
      setCurrentPath(pathname);
      const parts = pathname.split('/').filter(Boolean);
      const reserved = ['api', 'desktop', 'tablet', 'mobile', 'assets', 'login', 'register', 'admin', 'platform', 'ops'];
      if (parts.length > 0 && !reserved.includes(parts[0])) {
        setActiveSlug(parts[0]);
      } else {
        setActiveSlug(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    const pathname = path.split('?')[0].toLowerCase();
    setCurrentPath(pathname);
    const parts = pathname.split('/').filter(Boolean);
    const reserved = ['api', 'desktop', 'tablet', 'mobile', 'assets', 'login', 'register', 'admin', 'platform', 'ops'];
    if (parts.length > 0 && !reserved.includes(parts[0].toLowerCase())) {
      setActiveSlug(parts[0].toLowerCase());
    } else {
      setActiveSlug(null);
    }
  };

  const isPlatformAdminPath = currentPath === '/admin' || currentPath.startsWith('/admin/') || currentPath === '/platform' || currentPath.startsWith('/platform/') || currentPath === '/ops' || currentPath.startsWith('/ops/');

  // Industry-standard centralized 401/unauthorized session eviction handler
  const handleUnauthorized = (msg = 'Sesi Anda telah berakhir demi keamanan. Silakan login kembali.', customRedirectUrl?: string) => {
    const isStaff = isPlatformAdmin(currentUser);
    const targetLoginUrl = customRedirectUrl || (isStaff || isPlatformAdminPath ? '/admin' : '/login');
    localStorage.removeItem('catavor_token');
    localStorage.removeItem('catavor_user');
    localStorage.removeItem('catavor_active_slug');
    setToken(null);
    setCurrentUser(null);
    setLoginError(msg);
    navigateTo(targetLoginUrl);
  };

  // Safe logout with smart redirect to dedicated admin portal (/admin) or merchant login (/login)
  const handleLogout = (customRedirectUrl?: string) => {
    const isStaff = isPlatformAdmin(currentUser);
    const targetLoginUrl = customRedirectUrl || (isStaff || isPlatformAdminPath ? '/admin' : '/login');
    localStorage.removeItem('catavor_token');
    localStorage.removeItem('catavor_user');
    localStorage.removeItem('catavor_active_slug');
    setToken(null);
    setCurrentUser(null);
    setLoginError(null);
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
        setToken(json.token);
        setCurrentUser(json.user);
        if (json.active_store?.store_theme || json.user?.store_theme) {
          setStoreTheme(json.active_store?.store_theme || json.user?.store_theme);
        }
        if (json.active_store?.slug) {
          localStorage.setItem('catavor_active_slug', json.active_store.slug);
        }
        setLoginEmail('');
        setLoginPassword('');
        if (isPlatformAdmin(json.user)) {
          navigateTo('/admin?tab=dashboard');
        } else {
          const targetSlug = json.active_store?.slug || json.user?.store_slug || localStorage.getItem('catavor_active_slug');
          if (targetSlug) {
            navigateTo(`/${targetSlug}/admin`);
          } else {
            navigateTo('/catalogs');
          }
        }
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
        setToken(data.token);
        if (data.active_store?.store_theme || data.user?.store_theme) {
          setStoreTheme(data.active_store?.store_theme || data.user?.store_theme);
        }
        if (data.active_store?.slug) {
          localStorage.setItem('catavor_active_slug', data.active_store.slug);
        }
        if (isPlatformAdmin(data.user)) {
          navigateTo('/admin?tab=dashboard');
        } else {
          const targetSlug = data.active_store?.slug || data.user?.store_slug || localStorage.getItem('catavor_active_slug');
          if (targetSlug) {
            navigateTo(`/${targetSlug}/admin`);
          } else {
            navigateTo('/catalogs');
          }
        }
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

  const isLoginRoute = currentPath === '/login';
  const isStoreAdminRoute = Boolean(activeSlug) && (currentPath === `/${activeSlug}/admin` || currentPath.startsWith(`/${activeSlug}/admin/`));
  const merchantSlug =
    (currentUser as any)?.store_slug ||
    (currentUser as any)?.active_store?.slug ||
    (currentUser as any)?.stores?.[0]?.slug ||
    localStorage.getItem('catavor_active_slug') ||
    activeSlug ||
    '';

  // 1. PUBLIC STORE CATALOG ROUTE (e.g. /:slug and not admin, platform, ops, or login)
  if (activeSlug && !isStoreAdminRoute && !isLoginRoute && !isPlatformAdminPath) {
    return (
      <TabletStoreCatalog
        slug={activeSlug}
        onBackToExplore={() => navigateTo('/')}
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
                onClick={() => navigateTo('/')}
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
              onClick={() => navigateTo('/')}
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

  // 3. STORE ADMIN ROUTE (/:slug/admin)
  if (isStoreAdminRoute) {
    if (!token) {
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
                <Store size={28} />
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                Masuk Konsol Toko
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Kelola katalog &amp; etalase untuk profil {activeSlug}
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
                {loginLoading ? 'Memproses...' : 'Masuk ke Konsol Toko'}
              </button>

              <button
                type="button"
                onClick={() => navigateTo(`/${activeSlug}`)}
                style={{
                  minHeight: '40px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                &larr; Lihat Katalog Toko Publik
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <TabletMerchantAdmin
        token={token}
        currentUser={currentUser}
        storeSlug={activeSlug || merchantSlug || 'my-store'}
        onLogout={() => handleLogout('/login')}
        onUnauthorized={(msg) => handleUnauthorized(msg, '/login')}
        onViewPublicCatalog={() => navigateTo(activeSlug ? `/${activeSlug}` : '/')}
        onThemeChange={handleThemeChange}
      />
    );
  }

  // 4. GENERAL LOGIN ROUTE (/login)
  if (isLoginRoute) {
    if (token) {
      if (isPlatformAdmin(currentUser)) {
        navigateTo('/admin');
        return null;
      }
      navigateTo(merchantSlug ? `/${merchantSlug}/admin` : '/');
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
              onClick={() => navigateTo('/')}
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

