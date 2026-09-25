import React, { useState } from 'react';
import { 
  Layers, 
  ShieldAlert, 
  ArrowRight, 
  Plus, 
  ArrowLeft,
  LogOut,
  AlertTriangle,
  Store,
  RefreshCw,
  Search,
  CheckCircle2
} from 'lucide-react';

export interface CatalogStoreItem {
  id: number;
  slug: string;
  store_title: string;
  store_slogan?: string;
  store_theme?: string;
  store_logo_url?: string;
  plan?: string;
  payment_status?: string;
  whatsapp_number?: string;
  item_count?: number;
  dormancy_status?: string;
  is_suspended?: boolean;
  suspension_reason?: string;
  is_blacklisted?: boolean;
  last_activity_at?: string;
  created_at?: string;
}

interface StoreChooserSheetProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
  user: {
    name?: string;
    email?: string;
  } | null;
  stores: CatalogStoreItem[];
  activeSlug?: string | null;
  complianceAlert?: {
    type: 'banned' | 'suspended' | 'info';
    message: string;
    bannedSlug?: string;
  } | null;
  onSelectStore: (store: CatalogStoreItem) => void;
  onCreateNewStore: () => void;
  onLogout?: () => void;
  switchingSlug?: string | null;
  isFirstTimeLogin?: boolean;
  activeTheme?: string;
}

export const getStoreChooserTheme = (isFreshLogin: boolean, activeTheme?: string) => {
  // RULE: Jika first-time login / belum memilih profil, WAJIB gunakan tema default Landing Page: PUTIH BIRU!
  const themeName = isFreshLogin ? 'navy' : (activeTheme || 'navy');

  switch (themeName) {
    case 'sage':
      return {
        isLight: true,
        bgDeep: '#f4f0e8',
        bgCard: '#ffffff',
        bgCardHover: '#ebe5da',
        borderLight: 'rgba(82, 120, 99, 0.16)',
        borderHover: 'rgba(82, 120, 99, 0.36)',
        primary: '#527863',
        primaryHover: '#41614f',
        primaryGlow: 'rgba(82, 120, 99, 0.22)',
        accentLight: '#6f9580',
        textPrimary: '#1e2922',
        textSecondary: '#4a5b50',
        textMuted: '#7a8c82',
        headerBg: '#ffffff',
        headerGradient: 'linear-gradient(135deg, #527863 0%, #41614f 100%)',
        userCardBg: 'rgba(82, 120, 99, 0.08)'
      };
    case 'pastel':
      return {
        isLight: true,
        bgDeep: '#f8fafc',
        bgCard: '#ffffff',
        bgCardHover: '#f1f5f9',
        borderLight: 'rgba(225, 29, 72, 0.15)',
        borderHover: 'rgba(225, 29, 72, 0.35)',
        primary: '#e11d48',
        primaryHover: '#be123c',
        primaryGlow: 'rgba(225, 29, 72, 0.2)',
        accentLight: '#fb7185',
        textPrimary: '#0f172a',
        textSecondary: '#334155',
        textMuted: '#64748b',
        headerBg: '#ffffff',
        headerGradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
        userCardBg: 'rgba(225, 29, 72, 0.06)'
      };
    case 'cream':
      return {
        isLight: true,
        bgDeep: '#FAF7F2',
        bgCard: '#FFFFFF',
        bgCardHover: '#F5EFE6',
        borderLight: 'rgba(15, 81, 50, 0.14)',
        borderHover: 'rgba(15, 81, 50, 0.3)',
        primary: '#0F5132',
        primaryHover: '#0A3D25',
        primaryGlow: 'rgba(15, 81, 50, 0.2)',
        accentLight: '#10B981',
        textPrimary: '#1C2A24',
        textSecondary: '#4A5D54',
        textMuted: '#788B81',
        headerBg: '#FFFFFF',
        headerGradient: 'linear-gradient(135deg, #0F5132 0%, #0A3D25 100%)',
        userCardBg: 'rgba(15, 81, 50, 0.08)'
      };
    case 'cyberpunk':
      return {
        isLight: false,
        bgDeep: '#0b0716',
        bgCard: '#150d2a',
        bgCardHover: '#221542',
        borderLight: 'rgba(168, 85, 247, 0.2)',
        borderHover: 'rgba(168, 85, 247, 0.45)',
        primary: '#a855f7',
        primaryHover: '#9333ea',
        primaryGlow: 'rgba(168, 85, 247, 0.35)',
        accentLight: '#c084fc',
        textPrimary: '#ffffff',
        textSecondary: '#e9d5ff',
        textMuted: '#a855f7',
        headerBg: '#150d2a',
        headerGradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
        userCardBg: 'rgba(168, 85, 247, 0.12)'
      };
    case 'ocean':
      return {
        isLight: false,
        bgDeep: '#060d1a',
        bgCard: '#0b172e',
        bgCardHover: '#122347',
        borderLight: 'rgba(56, 189, 248, 0.18)',
        borderHover: 'rgba(56, 189, 248, 0.45)',
        primary: '#38bdf8',
        primaryHover: '#0284c7',
        primaryGlow: 'rgba(56, 189, 248, 0.28)',
        accentLight: '#7dd3fc',
        textPrimary: '#ffffff',
        textSecondary: '#bae6fd',
        textMuted: '#38bdf8',
        headerBg: '#060d1a',
        headerGradient: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #1d4ed8 100%)',
        userCardBg: 'rgba(56, 189, 248, 0.12)'
      };
    case 'nordic':
      return {
        isLight: false,
        bgDeep: '#0f141a',
        bgCard: '#17202a',
        bgCardHover: '#202c3a',
        borderLight: 'rgba(142, 176, 204, 0.16)',
        borderHover: 'rgba(142, 176, 204, 0.35)',
        primary: '#5b7c99',
        primaryHover: '#486680',
        primaryGlow: 'rgba(91, 124, 153, 0.28)',
        accentLight: '#8eb0cc',
        textPrimary: '#f8fafc',
        textSecondary: '#cbd5e1',
        textMuted: '#8a9ba8',
        headerBg: '#17202a',
        headerGradient: 'linear-gradient(135deg, #5b7c99 0%, #486680 100%)',
        userCardBg: 'rgba(142, 176, 204, 0.1)'
      };
    case 'emerald':
    case 'dark':
      return {
        isLight: false,
        bgDeep: '#080c14',
        bgCard: '#0f172a',
        bgCardHover: '#1e293b',
        borderLight: 'rgba(255, 255, 255, 0.08)',
        borderHover: 'rgba(255, 255, 255, 0.2)',
        primary: '#10b981',
        primaryHover: '#059669',
        primaryGlow: 'rgba(16, 185, 129, 0.25)',
        accentLight: '#34d399',
        textPrimary: '#ffffff',
        textSecondary: '#cbd5e1',
        textMuted: '#94a3b8',
        headerBg: '#0f172a',
        headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        userCardBg: 'rgba(255, 255, 255, 0.04)'
      };
    case 'navy':
    default:
      // Default: Deep Navy Blue Theme (#1e3a8a matching active dashboard controls & soft slate blue tint)
      return {
        isLight: true,
        bgDeep: '#f8fafc',
        bgCard: '#ffffff',
        bgCardHover: '#f1f5f9',
        borderLight: 'rgba(226, 232, 240, 0.9)',
        borderHover: 'rgba(30, 58, 138, 0.35)',
        primary: '#1e3a8a',
        primaryHover: '#172554',
        primaryGlow: 'rgba(30, 58, 138, 0.28)',
        accentLight: '#3b82f6',
        textPrimary: '#0f172a',
        textSecondary: '#1e3a8a',
        textMuted: '#64748b',
        headerBg: '#ffffff',
        headerGradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
        userCardBg: 'rgba(30, 58, 138, 0.08)'
      };
  }
};

export const StoreChooserSheet: React.FC<StoreChooserSheetProps> = ({
  isOpen,
  onClose,
  canDismiss = true,
  user,
  stores,
  activeSlug,
  complianceAlert,
  onSelectStore,
  onCreateNewStore,
  onLogout,
  switchingSlug,
  isFirstTimeLogin = false,
  activeTheme
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // RULE: Jika user pertama kali login atau belum terdeteksi slug dari profile tertentu (atau complianceAlert), tampilkan icon katalog dan sembunyikan tombol back. Hanya tampilkan tombol back jika user sudah memilih/berada di profile katalog tertentu.
  const isFreshLogin = isFirstTimeLogin || !activeSlug || Boolean(complianceAlert);
  const effectiveActiveSlug = isFreshLogin ? null : activeSlug;

  const theme = getStoreChooserTheme(isFreshLogin, activeTheme);

  const filteredStores = stores.filter((st) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (st.store_title && st.store_title.toLowerCase().includes(q)) ||
           (st.slug && st.slug.toLowerCase().includes(q));
  }).sort((a, b) => {
    if (!effectiveActiveSlug) return 0;
    const aIsActive = a.slug?.toLowerCase() === effectiveActiveSlug.toLowerCase();
    const bIsActive = b.slug?.toLowerCase() === effectiveActiveSlug.toLowerCase();
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    return 0;
  });

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: theme.bgDeep,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Mobile Top Header */}
      <div 
        style={{
          padding: '0.95rem 1.15rem',
          borderBottom: `1px solid ${theme.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.headerBg,
          boxShadow: theme.isLight ? '0 1px 6px rgba(0, 0, 0, 0.04)' : 'none',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {effectiveActiveSlug ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: theme.userCardBg,
                border: `1px solid ${theme.borderHover}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.primary,
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              title="Kembali ke Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: theme.headerGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: `0 4px 14px ${theme.primaryGlow}`
              }}
            >
              <Layers size={18} />
            </div>
          )}
          <div>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
              Pusat Profil Katalog
            </h2>
            <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
              Multi-Katalog Hub
            </span>
          </div>
        </div>

        {/* Tombol Header Kanan: Selalu Tampilkan Logout Sesi Akun yang Elegan */}
        <button
          type="button"
          onClick={onLogout}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '0.55rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: theme.isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          title="Keluar Sesi Akun"
        >
          <LogOut size={14} />
          <span>Keluar</span>
        </button>
      </div>

      {/* Main Content List with Smooth Scroll & CSS Mask */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.15rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          scrollbarWidth: 'thin',
          scrollbarColor: theme.isLight ? 'rgba(0, 0, 0, 0.15) transparent' : 'rgba(255, 255, 255, 0.2) transparent',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 16px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 16px), transparent 100%)'
        }}
      >
        {/* Compliance Alert - ONLY display when relevant to a REAL banned store */}
        {(() => {
          if (!complianceAlert) return null;
          const bSlug = complianceAlert.bannedSlug;
          const RESERVED = [
            'api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'admin',
            'catavor', 'catafor', 'katavor', 'katafor', 'platform', 'system', 'ops', 'dashboard',
            'terms', 'privacy', 'acceptable_use', 'acceptable-use', 'syarat-ketentuan', 'kebijakan-privasi',
            'explore', 'directory', 'settings', 'notifications', 'articles', 'subscription', 'langganan',
            'help', 'bantuan', 'support', 'catalogs', 'select-catalog', 'stores'
          ];
          if (bSlug && RESERVED.includes(bSlug.toLowerCase())) return null;

          const targetStore = stores.find(s => s.slug?.toLowerCase() === bSlug?.toLowerCase());
          const displayTitle = targetStore?.store_title ? `'${targetStore.store_title}' (@${bSlug})` : (bSlug ? `'${bSlug}'` : 'katalog Anda');
          const alertMessage = complianceAlert.message.includes("'catalogs'") 
            ? complianceAlert.message.replace("'catalogs'", displayTitle)
            : complianceAlert.message;

          return (
            <div 
              style={{
                padding: '0.95rem 1rem',
                borderRadius: '0.85rem',
                background: complianceAlert.type === 'banned' 
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.08) 100%)' 
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(180, 83, 9, 0.08) 100%)',
                border: complianceAlert.type === 'banned' 
                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                  : '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: complianceAlert.type === 'banned' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: complianceAlert.type === 'banned' ? '#ef4444' : '#f59e0b',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                <ShieldAlert size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <span 
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: complianceAlert.type === 'banned' ? '#ef4444' : '#d97706',
                    display: 'block',
                    marginBottom: '0.2rem'
                  }}
                >
                  Pemberitahuan Kepatuhan
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                  {alertMessage}
                </p>
              </div>
            </div>
          );
        })()}

        {/* User Card */}
        <div 
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.85rem',
            backgroundColor: theme.userCardBg,
            border: `1px solid ${theme.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Pengelola'}
            </div>
            <div style={{ fontSize: '0.74rem', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email || '-'}
            </div>
          </div>
          <span 
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: theme.primary,
              backgroundColor: theme.userCardBg,
              border: `1px solid ${theme.borderHover}`,
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              flexShrink: 0
            }}
          >
            {stores.length} Profil
          </span>
        </div>

        {/* Search Bar if 4 or more stores */}
        {stores.length >= 4 && (
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
            <input 
              type="text"
              placeholder="Cari profil katalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem 0.6rem 2.25rem',
                fontSize: '0.8rem',
                borderRadius: '0.7rem',
                backgroundColor: theme.bgCard,
                border: `1px solid ${theme.borderLight}`,
                color: theme.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: theme.isLight ? '0 1px 3px rgba(0, 0, 0, 0.04)' : 'none'
              }}
            />
          </div>
        )}

        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>
          Daftar Profil Katalog Anda
        </div>

        {/* Stores List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredStores.map((store) => {
            const isBanned = store.dormancy_status === 'banned' || store.is_blacklisted;
            const isSuspended = store.dormancy_status === 'suspended' || store.is_suspended;
            // RULE: Pada fresh login, effectiveActiveSlug adalah NULL, sehingga TIDAK ADA yang isCurrent (semua netral!)
            const isCurrent = effectiveActiveSlug && store.slug.toLowerCase() === effectiveActiveSlug.toLowerCase();
            const isSwitching = switchingSlug === store.slug;

            return (
              <div
                key={store.id}
                onClick={() => {
                  if (!isBanned && !isSwitching) {
                    onSelectStore(store);
                  }
                }}
                style={{
                  padding: '1rem 1.05rem',
                  borderRadius: '1rem',
                  border: isCurrent
                    ? `2px solid ${theme.primary}`
                    : isBanned
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : `1px solid ${theme.borderLight}`,
                  backgroundColor: isCurrent
                    ? theme.userCardBg
                    : isBanned
                    ? (theme.isLight ? 'rgba(239, 68, 68, 0.04)' : 'rgba(15, 23, 42, 0.4)')
                    : theme.bgCard,
                  boxShadow: isCurrent 
                    ? `0 4px 18px ${theme.primaryGlow}` 
                    : theme.isLight 
                    ? '0 2px 8px rgba(0, 0, 0, 0.04)' 
                    : 'none',
                  opacity: isBanned ? 0.65 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  cursor: isBanned ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <div 
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: isBanned 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : theme.userCardBg,
                      border: isCurrent ? `1px solid ${theme.primary}` : `1px solid ${theme.borderLight}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    {store.store_logo_url ? (
                      <img 
                        src={store.store_logo_url} 
                        alt={store.store_title} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isBanned ? '#ef4444' : theme.primary }}>
                        {(store.store_title || store.slug || 'K').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h4 
                        style={{
                          margin: 0,
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: isBanned ? theme.textMuted : theme.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {store.store_title || store.slug}
                      </h4>

                      {isBanned && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                          BANNED
                        </span>
                      )}

                      {isSuspended && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#d97706', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                          DIBEKUKAN
                        </span>
                      )}

                      {/* Hanya muncul jika memang ada toko yang aktif dibuka (bukan saat fresh login) */}
                      {isCurrent && (
                        <span style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 800, 
                          color: theme.primary, 
                          backgroundColor: theme.userCardBg, 
                          border: `1px solid ${theme.borderHover}`, 
                          padding: '0.1rem 0.4rem', 
                          borderRadius: '3px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: theme.primary, display: 'inline-block' }} />
                          DIBUKA
                        </span>
                      )}
                    </div>

                    {/* Meta row: fixed layout with ellipsis on slug and nowrap on item count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.72rem', color: theme.textMuted, minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>
                        /{store.slug}
                      </span>
                      <span style={{ opacity: 0.5, flexShrink: 0 }}>•</span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, color: theme.textSecondary }}>
                        {store.item_count ?? 0} Item
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {isBanned ? (
                    <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                      Ditutup
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSwitching}
                      style={{
                        padding: '0.52rem 0.95rem',
                        borderRadius: '0.65rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        ...(isSuspended ? {
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#d97706',
                          border: '1px solid rgba(245, 158, 11, 0.35)'
                        } : isCurrent ? {
                          background: theme.headerGradient,
                          color: '#ffffff',
                          border: 'none',
                          boxShadow: `0 4px 14px ${theme.primaryGlow}`
                        } : {
                          backgroundColor: theme.userCardBg,
                          color: theme.primary,
                          border: `1px solid ${theme.borderHover}`
                        })
                      }}
                    >
                      {isSwitching ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : isSuspended ? (
                        <>
                          <AlertTriangle size={12} />
                          <span>Banding</span>
                        </>
                      ) : (
                        <>
                          <span>{isCurrent ? 'Dibuka' : 'Buka'}</span>
                          <ArrowRight size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredStores.length === 0 && (
          <div 
            style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              borderRadius: '0.85rem',
              backgroundColor: theme.isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px dashed ${theme.borderLight}`
            }}
          >
            <Store size={32} style={{ color: theme.textMuted, margin: '0 auto 0.5rem' }} />
            <div style={{ color: theme.textPrimary, fontSize: '0.85rem', fontWeight: 700 }}>
              {searchQuery ? 'Profil Katalog Tidak Ditemukan' : 'Belum Ada Profil Katalog'}
            </div>
            <div style={{ color: theme.textMuted, fontSize: '0.75rem', marginTop: '0.2rem' }}>
              {searchQuery ? `Tidak ada katalog yang cocok dengan "${searchQuery}"` : 'Daftarkan profil katalog pertama Anda untuk memulai.'}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div 
        style={{
          padding: '0.9rem 1rem',
          borderTop: `1px solid ${theme.borderLight}`,
          backgroundColor: theme.headerBg,
          boxShadow: theme.isLight ? '0 -2px 10px rgba(0, 0, 0, 0.04)' : 'none',
          flexShrink: 0
        }}
      >
        <button
          type="button"
          onClick={onCreateNewStore}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            border: 'none',
            background: theme.headerGradient,
            color: '#ffffff',
            boxShadow: `0 4px 16px ${theme.primaryGlow}`,
            transition: 'all 0.18s ease'
          }}
        >
          <Plus size={16} />
          <span>Daftarkan Profil Katalog Baru</span>
        </button>
      </div>
    </div>
  );
};
