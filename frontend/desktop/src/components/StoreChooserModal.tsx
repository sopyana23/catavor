import React, { useState } from 'react';
import { 
  Layers, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Plus, 
  ArrowLeft,
  LogOut,
  Store,
  Sparkles,
  RefreshCw,
  Search
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

interface StoreChooserModalProps {
  isOpen: boolean;
  onClose?: () => void;
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
        bgDeep: '#081021',
        bgCard: '#0f1c38',
        bgCardHover: '#172a52',
        borderLight: 'rgba(59, 130, 246, 0.2)',
        borderHover: 'rgba(59, 130, 246, 0.45)',
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        primaryGlow: 'rgba(59, 130, 246, 0.35)',
        accentLight: '#60a5fa',
        textPrimary: '#ffffff',
        textSecondary: '#cbd5e1',
        textMuted: '#94a3b8',
        headerBg: '#0f1c38',
        headerGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        userCardBg: 'rgba(59, 130, 246, 0.1)'
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
      // Default: Landing Page Catavor "Putih Biru"
      return {
        isLight: true,
        bgDeep: '#f8fafc',
        bgCard: '#ffffff',
        bgCardHover: '#f1f5f9',
        borderLight: 'rgba(226, 232, 240, 0.9)',
        borderHover: 'rgba(37, 99, 235, 0.35)',
        primary: '#2563eb',
        primaryHover: '#1d4ed8',
        primaryGlow: 'rgba(37, 99, 235, 0.22)',
        accentLight: '#3b82f6',
        textPrimary: '#0f172a',
        textSecondary: '#334155',
        textMuted: '#64748b',
        headerBg: '#ffffff',
        headerGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        userCardBg: 'rgba(37, 99, 235, 0.05)'
      };
  }
};

export const StoreChooserModal: React.FC<StoreChooserModalProps> = ({
  isOpen,
  onClose,
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
  const [hoveredStoreId, setHoveredStoreId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // RULE: Jika first time login, activeSlug wajib null (daftar profil netral tanpa highlight '• DIBUKA')
  const isFreshLogin = isFirstTimeLogin || !activeSlug || Boolean(complianceAlert);
  const effectiveActiveSlug = isFreshLogin ? null : activeSlug;

  const theme = getStoreChooserTheme(isFreshLogin, activeTheme);

  const filteredStores = stores.filter((st) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (st.store_title && st.store_title.toLowerCase().includes(q)) ||
           (st.slug && st.slug.toLowerCase().includes(q));
  });

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: theme.isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(5, 10, 24, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.5rem',
          border: `1px solid ${theme.borderLight}`,
          backgroundColor: theme.bgCard,
          boxShadow: theme.isLight 
            ? '0 25px 70px rgba(0, 0, 0, 0.12), 0 0 40px rgba(37, 99, 235, 0.08)' 
            : `0 25px 70px rgba(0, 0, 0, 0.6), 0 0 50px ${theme.primaryGlow}`,
          overflow: 'hidden'
        }}
      >
        {/* Top Header Bar */}
        <div 
          style={{
            padding: '1.15rem 1.75rem',
            borderBottom: `1px solid ${theme.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            backgroundColor: theme.headerBg,
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: theme.headerGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: `0 4px 14px ${theme.primaryGlow}`
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                Pusat Pengelolaan Katalog
              </h2>
              <span style={{ fontSize: '0.76rem', color: theme.textMuted }}>
                Multi-Tenant Workspace Hub Catavor
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary }}>
                {user?.name || 'Pengelola'}
              </div>
              <div style={{ fontSize: '0.74rem', color: theme.textMuted }}>
                {user?.email || '-'}
              </div>
            </div>

            {/* Tombol Header: "Keluar" jika fresh login (belum memilih toko), atau "Kembali" jika sudah membuka salah satu toko */}
            {!effectiveActiveSlug ? (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  backgroundColor: theme.isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  transition: 'all 0.18s ease'
                }}
                title="Keluar Sesi Akun"
              >
                <LogOut size={14} />
                <span>Keluar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  backgroundColor: theme.isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                  color: theme.textPrimary,
                  border: `1px solid ${theme.borderLight}`,
                  transition: 'all 0.18s ease'
                }}
                title="Kembali ke Dashboard"
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Modal Body with Smooth Fade Mask */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backgroundColor: theme.bgDeep,
            scrollbarWidth: 'thin',
            scrollbarColor: theme.isLight ? 'rgba(0, 0, 0, 0.15) transparent' : 'rgba(255, 255, 255, 0.2) transparent',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 14px, black calc(100% - 18px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14px, black calc(100% - 18px), transparent 100%)'
          }}
        >
          {/* Compliance Notice Banner */}
          {complianceAlert && (
            <div 
              style={{
                padding: '1.15rem 1.35rem',
                borderRadius: '1rem',
                background: complianceAlert.type === 'banned' 
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.08) 100%)' 
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(180, 83, 9, 0.08) 100%)',
                border: complianceAlert.type === 'banned' 
                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                  : '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: complianceAlert.type === 'banned' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: complianceAlert.type === 'banned' ? '#ef4444' : '#f59e0b',
                  flexShrink: 0
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 
                  style={{ 
                    margin: '0 0 0.35rem 0', 
                    fontSize: '0.88rem', 
                    fontWeight: 800, 
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: complianceAlert.type === 'banned' ? '#ef4444' : '#d97706' 
                  }}
                >
                  Pemberitahuan Kepatuhan Platform
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.5 }}>
                  {complianceAlert.message}
                </p>
              </div>
            </div>
          )}

          {/* Section Heading & Search Filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: theme.textPrimary, margin: 0 }}>
                Pilih Profil Katalog
              </h3>
              <p style={{ fontSize: '0.8rem', color: theme.textMuted, margin: '0.2rem 0 0' }}>
                Anda memiliki akses kepemilikan atas {stores.length} profil katalog di bawah ini.
              </p>
            </div>

            {stores.length >= 4 && (
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                <input 
                  type="text"
                  placeholder="Cari katalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem 0.55rem 2.3rem',
                    fontSize: '0.8rem',
                    borderRadius: '0.65rem',
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
          </div>

          {/* Stores List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredStores.map((store) => {
              const isBanned = store.dormancy_status === 'banned' || store.is_blacklisted;
              const isSuspended = store.dormancy_status === 'suspended' || store.is_suspended;
              // RULE: Pada fresh login, effectiveActiveSlug adalah NULL, sehingga TIDAK ADA yang isCurrent (semua netral!)
              const isCurrent = effectiveActiveSlug && store.slug.toLowerCase() === effectiveActiveSlug.toLowerCase();
              const isHovered = hoveredStoreId === store.id;
              const isSwitching = switchingSlug === store.slug;

              return (
                <div
                  key={store.id}
                  onMouseEnter={() => setHoveredStoreId(store.id)}
                  onMouseLeave={() => setHoveredStoreId(null)}
                  onClick={() => {
                    if (!isBanned && !isSwitching) {
                      onSelectStore(store);
                    }
                  }}
                  style={{
                    padding: '1.1rem 1.35rem',
                    borderRadius: '1rem',
                    border: isCurrent 
                      ? `2px solid ${theme.primary}` 
                      : isHovered && !isBanned
                      ? `1px solid ${theme.borderHover}`
                      : isBanned
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : `1px solid ${theme.borderLight}`,
                    backgroundColor: isCurrent 
                      ? (theme.isLight ? 'rgba(37, 99, 235, 0.06)' : 'rgba(16, 185, 129, 0.08)')
                      : isHovered && !isBanned
                      ? theme.bgCardHover
                      : isBanned
                      ? (theme.isLight ? 'rgba(239, 68, 68, 0.04)' : 'rgba(15, 23, 42, 0.45)')
                      : theme.bgCard,
                    boxShadow: isCurrent 
                      ? `0 4px 20px ${theme.primaryGlow}` 
                      : isHovered && !isBanned
                      ? (theme.isLight ? '0 6px 20px rgba(0, 0, 0, 0.06)' : '0 6px 20px rgba(0, 0, 0, 0.3)')
                      : theme.isLight
                      ? '0 2px 8px rgba(0, 0, 0, 0.03)'
                      : 'none',
                    opacity: isBanned ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    cursor: isBanned ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isHovered && !isBanned ? 'translateY(-2px)' : 'none'
                  }}
                >
                  {/* Left Store Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                    {/* Store Logo / Initials */}
                    <div 
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: isBanned 
                          ? 'rgba(239, 68, 68, 0.15)' 
                          : theme.isLight 
                          ? 'rgba(37, 99, 235, 0.07)' 
                          : 'rgba(255, 255, 255, 0.06)',
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
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isBanned ? '#ef4444' : theme.primary }}>
                          {(store.store_title || store.slug || 'K').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Meta Title & Badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <h4 
                          style={{ 
                            margin: 0, 
                            fontSize: '1rem', 
                            fontWeight: 800, 
                            color: isBanned ? theme.textMuted : theme.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {store.store_title || store.slug}
                        </h4>

                        {/* Plan Badge */}
                        <span 
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '4px',
                            backgroundColor: store.plan === 'pro_business' ? 'rgba(245, 158, 11, 0.15)' : store.plan === 'pro_starter' ? 'rgba(56, 189, 248, 0.15)' : (theme.isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)'),
                            color: store.plan === 'pro_business' ? '#d97706' : store.plan === 'pro_starter' ? '#0284c7' : theme.textMuted,
                            border: `1px solid ${theme.borderLight}`,
                            textTransform: 'uppercase'
                          }}
                        >
                          {store.plan === 'pro_business' ? 'Bisnis' : store.plan === 'pro_starter' ? 'Starter' : 'Free'}
                        </span>

                        {/* Status Badges */}
                        {isBanned && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.12rem 0.5rem', borderRadius: '4px' }}>
                            DIBLOKIR
                          </span>
                        )}

                        {isSuspended && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d97706', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.12rem 0.5rem', borderRadius: '4px' }}>
                            DIBEKUKAN SEMENTARA
                          </span>
                        )}

                        {/* Hanya muncul jika memang ada toko yang aktif dibuka (bukan saat fresh login) */}
                        {isCurrent && (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 800, 
                            color: theme.primary, 
                            backgroundColor: theme.isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.15)', 
                            border: `1px solid ${theme.borderHover}`, 
                            padding: '0.15rem 0.6rem', 
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: theme.primary, display: 'inline-block' }} />
                            SEDANG DIBUKA
                          </span>
                        )}
                      </div>

                      {/* Store Slug and Item Count */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.35rem', fontSize: '0.78rem', color: theme.textMuted, minWidth: 0 }}>
                        <span style={{ fontFamily: 'monospace', color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>
                          catavor.com/{store.slug}
                        </span>
                        <span style={{ opacity: 0.5, flexShrink: 0 }}>•</span>
                        <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, color: theme.textSecondary }}>
                          {store.item_count ?? 0} Item
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div style={{ flexShrink: 0 }}>
                    {isBanned ? (
                      <span style={{ fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600 }}>
                        Akses Dicabut
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isSwitching}
                        style={{
                          padding: '0.6rem 1.25rem',
                          borderRadius: '0.7rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          border: 'none',
                          transition: 'all 0.15s ease',
                          ...(isSuspended ? {
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.35)'
                          } : {
                            background: theme.headerGradient,
                            color: '#ffffff',
                            boxShadow: `0 2px 10px ${theme.primaryGlow}`
                          })
                        }}
                      >
                        {isSwitching ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Membuka...</span>
                          </>
                        ) : isSuspended ? (
                          <>
                            <AlertTriangle size={14} />
                            <span>Lihat Status Banding</span>
                            <ArrowRight size={14} />
                          </>
                        ) : (
                          <>
                            <span>Buka Dashboard</span>
                            <ArrowRight size={14} />
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
                padding: '3rem 1.5rem',
                borderRadius: '1rem',
                backgroundColor: theme.isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px dashed ${theme.borderLight}`
              }}
            >
              <Store size={36} style={{ color: theme.textMuted, margin: '0 auto 0.75rem' }} />
              <h4 style={{ color: theme.textPrimary, fontSize: '1rem', margin: '0 0 0.35rem' }}>
                {searchQuery ? 'Profil Katalog Tidak Ditemukan' : 'Belum Ada Profil Katalog'}
              </h4>
              <p style={{ color: theme.textMuted, fontSize: '0.82rem', margin: 0 }}>
                {searchQuery ? `Tidak ada katalog yang cocok dengan kata kunci "${searchQuery}"` : 'Silakan daftarkan profil katalog pertama Anda untuk memulai etalase bisnis.'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div 
          style={{
            padding: '1.15rem 2rem',
            borderTop: `1px solid ${theme.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.headerBg,
            boxShadow: theme.isLight ? '0 -2px 10px rgba(0, 0, 0, 0.03)' : 'none',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '0.78rem', color: theme.textMuted }}>
            Butuh bantuan? Kunjungi <a href="/bantuan" target="_blank" rel="noreferrer" style={{ color: theme.primary, textDecoration: 'underline' }}>Pusat Dukungan Catavor</a>
          </div>

          <button
            type="button"
            onClick={onCreateNewStore}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
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
    </div>
  );
};
