import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  Lock, 
  Store, 
  UserX, 
  X, 
  CheckCircle2, 
  HelpCircle,
  FolderMinus,
  FileX2,
  HardDriveDownload,
  AlertOctagon
} from 'lucide-react';
import { setupModalBackInterceptor } from '../utils/navigation';

export interface DangerZoneSettingsViewProps {
  currentStore: {
    id: number;
    slug: string;
    store_title?: string;
  } | null;
  currentUser?: {
    id?: number;
    email?: string;
    name?: string;
  } | null;
  userStores: Array<{
    id: number;
    slug: string;
    store_title?: string;
  }>;
  token: string;
  apiBase?: string;
  onStoreDeleted: (deletedSlug: string, remainingStores: any[]) => void;
  onAccountDeleted: () => void;
  showToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const DangerZoneSettingsView: React.FC<DangerZoneSettingsViewProps> = ({
  currentStore,
  currentUser,
  userStores,
  token,
  apiBase = '/api',
  onStoreDeleted,
  onAccountDeleted,
  showToast
}) => {
  // Modal states
  const [showStoreDeleteModal, setShowStoreDeleteModal] = useState<boolean>(false);
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState<boolean>(false);

  // Form states for Store Deletion
  const [storeSlugConfirmation, setStoreSlugConfirmation] = useState<string>('');
  const [storePassword, setStorePassword] = useState<string>('');
  const [isDeletingStore, setIsDeletingStore] = useState<boolean>(false);
  const [storeDeleteError, setStoreDeleteError] = useState<string | null>(null);

  // Form states for Account Deletion
  const [accountPhraseConfirmation, setAccountPhraseConfirmation] = useState<string>('');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);

  // Smart Back Interceptors for Modals
  useEffect(() => {
    if (showStoreDeleteModal) {
      return setupModalBackInterceptor(() => {
        setShowStoreDeleteModal(false);
        setStoreSlugConfirmation('');
        setStorePassword('');
        setStoreDeleteError(null);
      });
    }
  }, [showStoreDeleteModal]);

  useEffect(() => {
    if (showAccountDeleteModal) {
      return setupModalBackInterceptor(() => {
        setShowAccountDeleteModal(false);
        setAccountPhraseConfirmation('');
        setAccountPassword('');
        setAccountDeleteError(null);
      });
    }
  }, [showAccountDeleteModal]);

  const expectedStoreSlug = currentStore?.slug || '';
  const isStoreSlugMatched = storeSlugConfirmation.trim().toLowerCase() === expectedStoreSlug.trim().toLowerCase();

  const REQUIRED_ACCOUNT_PHRASE = 'HAPUS AKUN SAYA';
  const isAccountPhraseMatched = accountPhraseConfirmation.trim() === REQUIRED_ACCOUNT_PHRASE;

  // Handle Delete Single Catalog
  const handleConfirmDeleteStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;

    if (!isStoreSlugMatched) {
      setStoreDeleteError(`Ketik persis slug katalog "${expectedStoreSlug}" untuk konfirmasi.`);
      return;
    }

    if (!storePassword) {
      setStoreDeleteError('Kata sandi akun wajib diisi untuk verifikasi keamanan.');
      return;
    }

    setIsDeletingStore(true);
    setStoreDeleteError(null);

    try {
      const res = await fetch(`${apiBase}/stores/${currentStore.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slug: storeSlugConfirmation.trim(),
          password: storePassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus profil katalog');
      }

      setShowStoreDeleteModal(false);
      setStoreSlugConfirmation('');
      setStorePassword('');

      if (showToast) {
        showToast('success', `Profil katalog "${currentStore.store_title || expectedStoreSlug}" telah berhasil dihapus permanen.`);
      }

      const remaining = data.remaining_stores || userStores.filter(s => s.id !== currentStore.id);
      onStoreDeleted(expectedStoreSlug, remaining);
    } catch (err: any) {
      setStoreDeleteError(err.message || 'Terjadi kesalahan sistem saat menghapus katalog.');
    } finally {
      setIsDeletingStore(false);
    }
  };

  // Handle Delete Entire Account
  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAccountPhraseMatched) {
      setAccountDeleteError(`Ketik persis kalimat "${REQUIRED_ACCOUNT_PHRASE}" untuk konfirmasi.`);
      return;
    }

    if (!accountPassword) {
      setAccountDeleteError('Kata sandi akun wajib diisi untuk otentikasi penghapusan akun.');
      return;
    }

    setIsDeletingAccount(true);
    setAccountDeleteError(null);

    try {
      const res = await fetch(`${apiBase}/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          confirmation: accountPhraseConfirmation.trim(),
          password: accountPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus akun pengguna');
      }

      setShowAccountDeleteModal(false);
      setAccountPhraseConfirmation('');
      setAccountPassword('');

      if (showToast) {
        showToast('success', 'Akun Anda dan seluruh data katalog berhasil dihapus permanen.');
      }

      onAccountDeleted();
    } catch (err: any) {
      setAccountDeleteError(err.message || 'Terjadi kesalahan saat menghapus akun.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '0.5rem 0' }} className="animate-fade-in">
      {/* Top Banner Alert */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '1rem',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.03) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          flexShrink: 0
        }}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.18)',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '0.72rem',
              letterSpacing: '0.04em'
            }}>
              ZONA BERISIKO TINGGI
            </span>
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
              Zona Berbahaya &amp; Manajemen Penghapusan Data
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0.45rem 0 0 0', lineHeight: 1.5 }}>
            Tindakan pada halaman ini berdampak permanen terhadap data katalog dan akun Anda. Seluruh file gambar, produk, dan riwayat akan dihapus secara fisik dari server dan tidak dapat dipulihkan kembali. Mohon lakukan dengan hati-hati.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* PANEL 1: HAPUS PROFIL KATALOG AKTIF */}
        <div style={{
          borderRadius: '1rem',
          border: '1px solid rgba(239, 68, 68, 0.22)',
          background: 'var(--bg-surface, rgba(255,255,255,0.03))',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <Store size={18} style={{ color: '#ef4444' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Hapus Profil Katalog Aktif
                </h4>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
                Hapus profil katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong> (slug: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{expectedStoreSlug}</code>). 
                Semua produk, varian, kategori, banner, dan folder media di server toko ini akan dihapus permanen. Akun email Anda dan profil katalog lain yang Anda miliki tetap aman.
              </p>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                fontSize: '0.78rem',
                color: '#ef4444'
              }}>
                <FolderMinus size={15} />
                <span>Katalog lain yang Anda miliki: <strong>{Math.max(0, userStores.length - 1)} katalog</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setStoreSlugConfirmation('');
                setStorePassword('');
                setStoreDeleteError(null);
                setShowStoreDeleteModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.65rem',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                alignSelf: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = '#ef4444';
              }}
            >
              <Trash2 size={16} />
              Hapus Katalog Ini
            </button>
          </div>
        </div>

        {/* PANEL 2: HAPUS AKUN KESELURUHAN (GDPR / PDP) */}
        <div style={{
          borderRadius: '1rem',
          border: '1px solid rgba(220, 38, 38, 0.35)',
          background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, rgba(220, 38, 38, 0.08) 100%)',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 4px 20px rgba(220, 38, 38, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <UserX size={19} style={{ color: '#dc2626' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Hapus Akun &amp; Seluruh Data Pengguna
                </h4>
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  letterSpacing: '0.04em'
                }}>
                  GDPR / UU PDP
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
                Tutup akun <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.email}</strong> secara permanen. Tindakan ini akan menghapus akun Anda, <strong>semua {userStores.length} profil katalog</strong> yang terhubung, seluruh produk, seluruh media penyimpanan, riwayat pesanan/inquiry, dan otomatis mencabut seluruh sesi login di semua perangkat.
              </p>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                fontSize: '0.78rem',
                color: '#dc2626'
              }}>
                <AlertOctagon size={15} />
                <span>Setelah dihapus, email ini dapat didaftarkan kembali sebagai akun kosong baru.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAccountPhraseConfirmation('');
                setAccountPassword('');
                setAccountDeleteError(null);
                setShowAccountDeleteModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.7rem 1.35rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                transition: 'all 0.2s ease',
                alignSelf: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b91c1c';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(220, 38, 38, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(220, 38, 38, 0.35)';
              }}
            >
              <ShieldAlert size={17} />
              Hapus Akun Selamanya
            </button>
          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* MODAL 1: KONFIRMASI HAPUS KATALOG TUNGGAL                      */}
      {/* ============================================================== */}
      {showStoreDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.65)', 
            backdropFilter: 'blur(6px)', 
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => {
            if (!isDeletingStore) setShowStoreDeleteModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5)',
              padding: '1.75rem',
              position: 'relative',
              animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Konfirmasi Hapus Katalog
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>
                    Tindakan ini tidak dapat dibatalkan
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowStoreDeleteModal(false)}
                disabled={isDeletingStore}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: isDeletingStore ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Checklist Box */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.18)',
              borderRadius: '0.75rem',
              padding: '0.9rem 1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Data yang akan dihapus permanen dari server:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li>Semua produk &amp; varian di etalase katalog ini</li>
                <li>Seluruh berkas media foto &amp; banner di disk server</li>
                <li>Riwayat analitik &amp; klik link WhatsApp katalog ini</li>
                <li>Tautan publik <code style={{ color: '#ef4444' }}>/{expectedStoreSlug}</code> akan dilepas</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmDeleteStore}>
              {/* Form Input 1: Slug Confirmation */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Ketik persis slug katalog: <span style={{ color: '#ef4444', userSelect: 'all' }}>{expectedStoreSlug}</span>
                </label>
                <input
                  type="text"
                  value={storeSlugConfirmation}
                  onChange={(e) => setStoreSlugConfirmation(e.target.value)}
                  placeholder={`Ketik ${expectedStoreSlug}`}
                  disabled={isDeletingStore}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.55rem',
                    border: isStoreSlugMatched 
                      ? '1.5px solid #10b981' 
                      : '1.5px solid var(--border-light, rgba(255,255,255,0.12))',
                    backgroundColor: 'var(--bg-input, rgba(0,0,0,0.15))',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Form Input 2: Password */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Kata Sandi Akun Anda
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    placeholder="Masukkan kata sandi untuk otentikasi"
                    disabled={isDeletingStore}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                      borderRadius: '0.55rem',
                      border: '1.5px solid var(--border-light, rgba(255,255,255,0.12))',
                      backgroundColor: 'var(--bg-input, rgba(0,0,0,0.15))',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Error Message */}
              {storeDeleteError && (
                <div style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.78rem',
                  marginBottom: '1.25rem'
                }}>
                  {storeDeleteError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowStoreDeleteModal(false)}
                  disabled={isDeletingStore}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '0.55rem',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isDeletingStore ? 'not-allowed' : 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isStoreSlugMatched || !storePassword || isDeletingStore}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: (!isStoreSlugMatched || !storePassword || isDeletingStore)
                      ? 'rgba(239, 68, 68, 0.3)'
                      : '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  {isDeletingStore ? (
                    <>Menghapus Katalog...</>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Ya, Hapus Katalog Ini
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: KONFIRMASI HAPUS AKUN KESELURUHAN (GDPR / PDP)       */}
      {/* ============================================================== */}
      {showAccountDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.7)', 
            backdropFilter: 'blur(7px)', 
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => {
            if (!isDeletingAccount) setShowAccountDeleteModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              border: '1.5px solid rgba(220, 38, 38, 0.5)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px -15px rgba(220, 38, 38, 0.3)',
              padding: '1.75rem',
              position: 'relative',
              animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(220, 38, 38, 0.18)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Hapus Akun Pengguna Permanen
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 800, letterSpacing: '0.03em' }}>
                    PERINGATAN TERTINGGI: TIDAK DAPAT DIPULIHKAN
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAccountDeleteModal(false)}
                disabled={isDeletingAccount}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Checklist Box */}
            <div style={{
              background: 'rgba(220, 38, 38, 0.07)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontWeight: 800, color: '#dc2626' }}>
                Akun email ({currentUser?.email}) dan seluruh aset berikut akan dimusnahkan:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                <li>Semua profil katalog: <strong>{userStores.map(s => s.store_title || s.slug).join(', ') || 'Semua katalog'}</strong></li>
                <li>Seluruh produk, varian, etalase, dan media dari disk server</li>
                <li>Semua sesi login di seluruh perangkat (laptop, handphone, tablet) langsung dikeluarkan</li>
                <li>Data akun dihapus sesuai standar hak privasi GDPR / UU PDP</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmDeleteAccount}>
              {/* Form Input 1: Confirmation Phrase */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Ketik persis kalimat konfirmasi: <span style={{ color: '#dc2626', fontWeight: 800, userSelect: 'all' }}>{REQUIRED_ACCOUNT_PHRASE}</span>
                </label>
                <input
                  type="text"
                  value={accountPhraseConfirmation}
                  onChange={(e) => setAccountPhraseConfirmation(e.target.value)}
                  placeholder={`Ketik ${REQUIRED_ACCOUNT_PHRASE}`}
                  disabled={isDeletingAccount}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.55rem',
                    border: isAccountPhraseMatched 
                      ? '1.5px solid #10b981' 
                      : '1.5px solid var(--border-light, rgba(255,255,255,0.12))',
                    backgroundColor: 'var(--bg-input, rgba(0,0,0,0.15))',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Form Input 2: Password */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Kata Sandi Akun untuk Konfirmasi Akhir
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    disabled={isDeletingAccount}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                      borderRadius: '0.55rem',
                      border: '1.5px solid var(--border-light, rgba(255,255,255,0.12))',
                      backgroundColor: 'var(--bg-input, rgba(0,0,0,0.15))',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Error Message */}
              {accountDeleteError && (
                <div style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(220, 38, 38, 0.12)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  marginBottom: '1.25rem'
                }}>
                  {accountDeleteError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAccountDeleteModal(false)}
                  disabled={isDeletingAccount}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '0.55rem',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isDeletingAccount ? 'not-allowed' : 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isAccountPhraseMatched || !accountPassword || isDeletingAccount}
                  style={{
                    padding: '0.65rem 1.35rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount)
                      ? 'rgba(220, 38, 38, 0.35)'
                      : '#dc2626',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  {isDeletingAccount ? (
                    <>Menghapus Akun &amp; Data...</>
                  ) : (
                    <>
                      <UserX size={17} />
                      Saya Paham, Hapus Akun Selamanya
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
