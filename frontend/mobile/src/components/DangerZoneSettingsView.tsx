import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  Lock, 
  Store, 
  UserX, 
  X, 
  FolderMinus,
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
  const [showStoreDeleteModal, setShowStoreDeleteModal] = useState<boolean>(false);
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState<boolean>(false);

  const [storeSlugConfirmation, setStoreSlugConfirmation] = useState<string>('');
  const [storePassword, setStorePassword] = useState<string>('');
  const [isDeletingStore, setIsDeletingStore] = useState<boolean>(false);
  const [storeDeleteError, setStoreDeleteError] = useState<string | null>(null);

  const [accountPhraseConfirmation, setAccountPhraseConfirmation] = useState<string>('');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);

  // Smart Back Interceptors for Mobile Sheets
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

  const handleConfirmDeleteStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;

    if (!isStoreSlugMatched) {
      setStoreDeleteError(`Ketik persis slug katalog "${expectedStoreSlug}".`);
      return;
    }

    if (!storePassword) {
      setStoreDeleteError('Kata sandi akun wajib diisi.');
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
        showToast('success', `Katalog "${currentStore.store_title || expectedStoreSlug}" telah berhasil dihapus permanen.`);
      }

      const remaining = data.remaining_stores || userStores.filter(s => s.id !== currentStore.id);
      onStoreDeleted(expectedStoreSlug, remaining);
    } catch (err: any) {
      setStoreDeleteError(err.message || 'Terjadi kesalahan sistem saat menghapus katalog.');
    } finally {
      setIsDeletingStore(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAccountPhraseMatched) {
      setAccountDeleteError(`Ketik persis frasa "${REQUIRED_ACCOUNT_PHRASE}".`);
      return;
    }

    if (!accountPassword) {
      setAccountDeleteError('Kata sandi akun wajib diisi.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
      {/* Top Banner Alert */}
      <div style={{
        padding: '1rem',
        borderRadius: '0.85rem',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.04) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          flexShrink: 0
        }}>
          <AlertTriangle size={20} />
        </div>
        <div>
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(239, 68, 68, 0.18)',
            color: '#ef4444',
            fontWeight: 800,
            fontSize: '0.65rem',
            letterSpacing: '0.04em'
          }}>
            ZONA BERISIKO TINGGI
          </span>
          <h3 style={{ fontSize: '0.95rem', margin: '0.25rem 0 0 0', fontWeight: 800, color: 'var(--text-primary)' }}>
            Zona Berbahaya &amp; Hapus Data
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: '0.2rem 0 0 0', lineHeight: 1.45 }}>
            Tindakan pada menu ini berdampak permanen. Seluruh file gambar produk di server akan dihapus fisik dan tidak dapat dipulihkan.
          </p>
        </div>
      </div>

      {/* PANEL 1: HAPUS PROFIL KATALOG AKTIF */}
      <div className="glass-panel" style={{
        borderRadius: '0.85rem',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        padding: '1.15rem',
        background: 'var(--bg-surface, rgba(255,255,255,0.02))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Store size={16} style={{ color: '#ef4444' }} />
          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Hapus Profil Katalog Aktif
          </h4>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
          Hapus profil katalog <strong>"{currentStore?.store_title || expectedStoreSlug}"</strong>. Semua produk, banner, foto dari penyimpanan server toko ini akan dibersihkan permanen.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          fontSize: '0.7rem',
          color: '#ef4444',
          marginBottom: '0.85rem'
        }}>
          <FolderMinus size={13} />
          <span>Katalog lain milik Anda: <strong>{Math.max(0, userStores.length - 1)} katalog</strong></span>
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
            width: '100%',
            padding: '0.7rem',
            borderRadius: '0.6rem',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem'
          }}
        >
          <Trash2 size={15} />
          Hapus Katalog Ini
        </button>
      </div>

      {/* PANEL 2: HAPUS AKUN KESELURUHAN (GDPR / PDP) */}
      <div className="glass-panel" style={{
        borderRadius: '0.85rem',
        border: '1.5px solid rgba(220, 38, 38, 0.35)',
        padding: '1.15rem',
        background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, rgba(220, 38, 38, 0.08) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserX size={17} style={{ color: '#dc2626' }} />
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Hapus Akun &amp; Semua Data
            </h4>
          </div>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '2px 5px',
            borderRadius: '4px',
            backgroundColor: '#dc2626',
            color: '#ffffff'
          }}>
            GDPR / PDP
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
          Tutup akun <strong>{currentUser?.email}</strong>. Menghapus akun Anda, <strong>semua {userStores.length} profil katalog</strong>, semua produk, foto fisik server, dan mencabut sesi di seluruh perangkat.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          fontSize: '0.7rem',
          color: '#dc2626',
          marginBottom: '0.85rem'
        }}>
          <AlertOctagon size={13} />
          <span>Permanen dan tidak dapat dipulihkan kembali.</span>
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
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.6rem',
            border: 'none',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
          }}
        >
          <ShieldAlert size={16} />
          Hapus Akun Selamanya
        </button>
      </div>

      {/* BOTTOM SHEET 1: HAPUS KATALOG */}
      {showStoreDeleteModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => {
            if (!isDeletingStore) setShowStoreDeleteModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Konfirmasi Hapus Katalog
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setShowStoreDeleteModal(false)}
                disabled={isDeletingStore}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Dampak penghapusan:
              </strong>
              Semua produk, foto fisik server, dan URL publik <code style={{ color: '#ef4444' }}>/{expectedStoreSlug}</code> akan dihapus permanen.
            </div>

            <form onSubmit={handleConfirmDeleteStore}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Ketik persis slug katalog: <span style={{ color: '#ef4444' }}>{expectedStoreSlug}</span>
                </label>
                <input
                  type="text"
                  value={storeSlugConfirmation}
                  onChange={(e) => setStoreSlugConfirmation(e.target.value)}
                  placeholder={`Ketik ${expectedStoreSlug}`}
                  disabled={isDeletingStore}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.5rem',
                    border: isStoreSlugMatched ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Kata Sandi Akun Anda
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    placeholder="Kata sandi akun"
                    disabled={isDeletingStore}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.65rem 0.65rem 2rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {storeDeleteError && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontSize: '0.74rem',
                  marginBottom: '1rem'
                }}>
                  {storeDeleteError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStoreDeleteModal(false)}
                  disabled={isDeletingStore}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '0.55rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isStoreSlugMatched || !storePassword || isDeletingStore}
                  style={{
                    flex: 1.3,
                    padding: '0.7rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 'rgba(239, 68, 68, 0.3)' : '#ef4444',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}
                >
                  {isDeletingStore ? 'Menghapus...' : 'Ya, Hapus Katalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET 2: HAPUS AKUN KESELURUHAN */}
      {showAccountDeleteModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => {
            if (!isDeletingAccount) setShowAccountDeleteModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              border: '1.5px solid rgba(220, 38, 38, 0.5)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} style={{ color: '#dc2626' }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Hapus Akun &amp; Seluruh Data
                </h4>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAccountDeleteModal(false)}
                disabled={isDeletingAccount}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>
                Perhatian: Tindakan tidak dapat dibatalkan!
              </strong>
              Akun ({currentUser?.email}), semua {userStores.length} katalog, semua produk, aset gambar di server, dan seluruh sesi perangkat akan dimusnahkan.
            </div>

            <form onSubmit={handleConfirmDeleteAccount}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Ketik persis kalimat: <span style={{ color: '#dc2626', fontWeight: 800 }}>{REQUIRED_ACCOUNT_PHRASE}</span>
                </label>
                <input
                  type="text"
                  value={accountPhraseConfirmation}
                  onChange={(e) => setAccountPhraseConfirmation(e.target.value)}
                  placeholder={`Ketik ${REQUIRED_ACCOUNT_PHRASE}`}
                  disabled={isDeletingAccount}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.5rem',
                    border: isAccountPhraseMatched ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Kata Sandi Akun
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Kata sandi akun"
                    disabled={isDeletingAccount}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.65rem 0.65rem 2rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {accountDeleteError && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(220, 38, 38, 0.12)',
                  color: '#dc2626',
                  fontSize: '0.74rem',
                  marginBottom: '1rem'
                }}>
                  {accountDeleteError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAccountDeleteModal(false)}
                  disabled={isDeletingAccount}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '0.55rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isAccountPhraseMatched || !accountPassword || isDeletingAccount}
                  style={{
                    flex: 1.3,
                    padding: '0.7rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'rgba(220, 38, 38, 0.35)' : '#dc2626',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}
                >
                  {isDeletingAccount ? 'Menghapus...' : 'Hapus Akun Selamanya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
