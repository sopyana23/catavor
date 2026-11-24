import React from 'react';
import {
  Store as StoreIcon,
  LogOut,
  CheckCircle,
  AlertCircle,
  Lock,
  ShieldAlert,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Scale,
  ArrowLeft
} from 'lucide-react';
import { TabletHelpdeskView } from './TabletHelpdeskView';
import { StoreChooserModal, type CatalogStoreItem } from './StoreChooserModal';

export interface TabletSuspendedLockViewProps {
  token: string;
  storeSlug: string;
  storeSettings: any;
  currentUser: any;
  userStores: CatalogStoreItem[];
  suspendedViewMode: 'summary' | 'appeal';
  setSuspendedViewMode: (mode: 'summary' | 'appeal') => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  toast: { msg: string; type: 'success' | 'error' } | null;
  openStoreChooserModal: () => void;
  showStoreChooserModal: boolean;
  handleCloseStoreChooserModal: () => void;
  handleSwitchStore: (store: CatalogStoreItem) => void;
  switchingSlug: string | null;
  onLogout: () => void;
  onRefreshStatus: () => void;
  onUpdateUnreadCount: (cnt: number) => void;
}

export const TabletSuspendedLockView: React.FC<TabletSuspendedLockViewProps> = ({
  token,
  storeSlug,
  storeSettings,
  currentUser,
  userStores,
  suspendedViewMode,
  setSuspendedViewMode,
  showToast,
  toast,
  openStoreChooserModal,
  showStoreChooserModal,
  handleCloseStoreChooserModal,
  handleSwitchStore,
  switchingSlug,
  onLogout,
  onRefreshStatus,
  onUpdateUnreadCount
}) => {
  const suspensionCaseId = `SUSP-${storeSettings.id || '0'}-${(storeSlug || 'CAT').toUpperCase().slice(0, 8)}`;
  const isModerationViolation = storeSettings.suspension_reason === 'moderation_violation';

  return (
    <div
      data-testid="tablet-suspended-lock-workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)'
      }}
    >
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '0.65rem',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Top Bar Tablet */}
      <header style={{
        minHeight: '64px',
        padding: '0.75rem 1.25rem',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.65rem',
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d97706',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {storeSettings.logo_url ? (
              <img
                src={storeSettings.logo_url}
                alt={storeSettings.name || 'Logo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ShieldAlert size={20} strokeWidth={1.75} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontWeight: 800,
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '240px'
              }}>
                {storeSettings.name || storeSlug}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                <Lock size={12} strokeWidth={1.75} />
                Katalog Ditangguhkan
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              /{storeSlug} - Akses operasional dikunci sementara
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {suspendedViewMode === 'appeal' && (
            <button
              type="button"
              onClick={() => setSuspendedViewMode('summary')}
              style={{
                minHeight: '44px',
                padding: '0 0.95rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
              Kembali ke Ringkasan Status
            </button>
          )}
          <button
            type="button"
            onClick={openStoreChooserModal}
            style={{
              minHeight: '44px',
              padding: '0 0.95rem',
              borderRadius: '0.65rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer'
            }}
          >
            <StoreIcon size={16} strokeWidth={1.75} />
            Ganti Profil Katalog
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={{
              minHeight: '44px',
              padding: '0 0.9rem',
              borderRadius: '0.65rem',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} strokeWidth={1.75} />
            Keluar
          </button>
        </div>
      </header>

      {/* Body Content */}
      {suspendedViewMode === 'appeal' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TabletHelpdeskView
            token={token}
            storeSlug={storeSlug}
            settings={storeSettings}
            currentUser={currentUser}
            userStores={userStores}
            showToast={(msg, type) => showToast(msg, type === 'error' ? 'error' : 'success')}
            onUpdateUnreadCount={onUpdateUnreadCount}
            isNavExpanded={false}
          />
        </div>
      ) : (
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '2rem 1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '760px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.14)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.35rem',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '0.9rem',
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={28} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#d97706',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  marginBottom: '0.55rem'
                }}>
                  ID KASUS: {suspensionCaseId}
                </div>
                <h1 style={{
                  margin: '0 0 0.45rem 0',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1.25
                }}>
                  Katalog Ditangguhkan Sementara
                </h1>
                <p style={{
                  margin: 0,
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}>
                  {isModerationViolation
                    ? `Operasional katalog "${storeSettings.name || storeSlug}" sedang dibekukan sementara oleh Tim Kepatuhan platform karena laporan pelanggaran yang perlu ditinjau.`
                    : `Katalog "${storeSettings.name || storeSlug}" sedang dalam status penangguhan sementara. Silakan ajukan permohonan pemulihan atau banding kepatuhan melalui Pusat Bantuan.`}{' '}
                  Jika Anda memiliki profil katalog lain yang aktif, gunakan tombol <strong>Ganti Profil Katalog</strong> di bilah atas.
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem'
            }}>
              <div style={{
                padding: '1rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.82rem' }}>
                  <EyeOff size={16} strokeWidth={1.75} />
                  Etalase Publik Dinonaktifkan
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Pengunjung publik tidak dapat mengakses katalog maupun daftar item selama masa penangguhan.
                </p>
              </div>

              <div style={{
                padding: '1rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: '#d97706', fontWeight: 700, fontSize: '0.82rem' }}>
                  <Lock size={16} strokeWidth={1.75} />
                  Pengelolaan Item Dikunci
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Penambahan, pengeditan inventaris, dan perubahan pengaturan toko ditangguhkan hingga kasus selesai.
                </p>
              </div>

              <div style={{
                padding: '1rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.82rem' }}>
                  <CheckCircle2 size={16} strokeWidth={1.75} />
                  Data &amp; Media Tetap Aman
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Seluruh data produk dan aset media Anda tetap tersimpan utuh dan siap pulih jika banding disetujui.
                </p>
              </div>
            </div>

            <div style={{
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={onRefreshStatus}
                style={{
                  minHeight: '48px',
                  padding: '0 1.2rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} strokeWidth={1.75} />
                Muat Ulang Status
              </button>

              <button
                type="button"
                data-testid="btn-tablet-suspended-appeal"
                onClick={() => setSuspendedViewMode('appeal')}
                style={{
                  minHeight: '48px',
                  padding: '0 1.45rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px var(--primary-glow)'
                }}
              >
                <Scale size={18} strokeWidth={1.75} />
                Ajukan Banding Kepatuhan
              </button>
            </div>
          </div>
        </div>
      )}

      <StoreChooserModal
        isOpen={showStoreChooserModal}
        onClose={handleCloseStoreChooserModal}
        user={currentUser}
        stores={userStores}
        activeSlug={storeSlug}
        onSelectStore={handleSwitchStore}
        onCreateNewStore={() => {
          window.location.href = '/register/step-1';
        }}
        onLogout={onLogout}
        switchingSlug={switchingSlug}
        activeTheme={storeSettings.store_theme || 'navy'}
      />
    </div>
  );
};
