import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  Lock,
  Store,
  UserX,
  X,
  HardDriveDownload,
  FolderMinus,
  ShieldAlert,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface TabletDangerZoneViewProps {
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
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onExportCatalogJSON?: () => void;
}

export const TabletDangerZoneView: React.FC<TabletDangerZoneViewProps> = ({
  currentStore,
  currentUser,
  userStores,
  token,
  apiBase = '/api',
  onStoreDeleted,
  onAccountDeleted,
  showToast,
  onExportCatalogJSON
}) => {
  // Modal dialog states
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

  // Smart Back Interceptor for Store Delete Modal
  useModalBackHandler({
    isOpen: showStoreDeleteModal,
    onClose: () => {
      setShowStoreDeleteModal(false);
      setStoreSlugConfirmation('');
      setStorePassword('');
      setStoreDeleteError(null);
    },
    modalId: 'tablet_delete_store_modal'
  });

  // Smart Back Interceptor for Account Delete Modal
  useModalBackHandler({
    isOpen: showAccountDeleteModal,
    onClose: () => {
      setShowAccountDeleteModal(false);
      setAccountPhraseConfirmation('');
      setAccountPassword('');
      setAccountDeleteError(null);
    },
    modalId: 'tablet_delete_account_modal'
  });

  const expectedStoreSlug = currentStore?.slug || '';
  const isStoreSlugMatched = storeSlugConfirmation.trim().toLowerCase() === expectedStoreSlug.trim().toLowerCase();

  const REQUIRED_ACCOUNT_PHRASE = 'HAPUS AKUN SAYA';
  const isAccountPhraseMatched = accountPhraseConfirmation.trim() === REQUIRED_ACCOUNT_PHRASE;

  // Confirm Single Catalog Deletion
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

      showToast(`Profil katalog "${currentStore.store_title || expectedStoreSlug}" telah berhasil dihapus permanen.`, 'success');

      const remaining = data.remaining_stores || userStores.filter(s => s.id !== currentStore.id);
      onStoreDeleted(expectedStoreSlug, remaining);
    } catch (err: any) {
      setStoreDeleteError(err.message || 'Terjadi kesalahan sistem saat menghapus katalog.');
    } finally {
      setIsDeletingStore(false);
    }
  };

  // Confirm Full Account Deletion
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

      showToast('Akun Anda dan seluruh data katalog berhasil dihapus permanen.', 'success');
      onAccountDeleted();
    } catch (err: any) {
      setAccountDeleteError(err.message || 'Terjadi kesalahan saat menghapus akun.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner Alert */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          flexShrink: 0
        }}>
          <ShieldAlert size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              border: '1px solid rgba(239, 68, 68, 0.25)'
            }}>
              PENGATURAN TINGKAT TINGGI
            </span>
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
              Penutupan Akun &amp; Profil Katalog
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0.45rem 0 0 0', lineHeight: 1.55 }}>
            Bagian ini memungkinkan Anda menghapus profil katalog yang sudah tidak aktif atau mengajukan penutupan akun pengguna permanen (PDP/GDPR). Seluruh tindakan memerlukan verifikasi kata sandi demi keamanan akun Anda.
          </p>
        </div>
      </div>

      {/* PANEL 1: BACKUP / CADANGKAN DATA KATALOG (JSON) */}
      {onExportCatalogJSON && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.5rem 1.75rem',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(30, 58, 138, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <HardDriveDownload size={18} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Cadangkan Seluruh Data Katalog (JSON)
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Unduh salinan arsip lengkap profil toko, seluruh item produk, varian, kategori, dan kontak resmi dalam satu berkas terstruktur sebelum melakukan tindakan penghapusan.
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCatalogJSON}
            style={{
              minHeight: '44px',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <HardDriveDownload size={16} style={{ color: 'var(--primary)' }} />
            <span>Unduh Arsip JSON</span>
          </button>
        </div>
      )}

      {/* PANEL 2: HAPUS PROFIL KATALOG INI */}
      <div style={{
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        padding: '1.5rem 1.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <Store size={17} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Hapus Profil Katalog Ini
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
              Hapus profil katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong> (slug: <code style={{ background: 'var(--bg-deep)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}>{expectedStoreSlug}</code>). 
              Produk, varian, etalase, dan berkas foto di server toko ini akan dibersihkan. Akun email Anda dan katalog lainnya ({Math.max(0, userStores.length - 1)} katalog) tetap aktif.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)'
            }}>
              <FolderMinus size={15} />
              <span>Katalog lain yang Anda miliki: <strong style={{ color: 'var(--text-primary)' }}>{Math.max(0, userStores.length - 1)} katalog</strong></span>
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
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              alignSelf: 'center'
            }}
          >
            <Trash2 size={16} />
            <span>Hapus Katalog Ini</span>
          </button>
        </div>
      </div>

      {/* PANEL 3: PENUTUPAN AKUN PENGGUNA PERMANEN (GDPR / PDP) */}
      <div style={{
        borderRadius: '1rem',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        background: 'var(--bg-card)',
        padding: '1.5rem 1.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <UserX size={17} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>
                Penutupan Akun Pengguna Permanen
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
              Tutup akun pengguna Anda secara permanen. Seluruh kredensial, hak akses, sesi login di seluruh perangkat, dan 
              <strong> seluruh katalog ({userStores.length} profil toko)</strong> beserta berkas media di server akan dimusnahkan secara permanen dan tidak dapat dipulihkan kembali.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.78rem',
              color: '#ef4444'
            }}>
              <AlertTriangle size={15} />
              <span>Aksi ini bersifat final dan tidak dapat dibatalkan (irreversible).</span>
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
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              alignSelf: 'center'
            }}
          >
            <UserX size={16} />
            <span>Tutup Akun Permanen</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: KONFIRMASI HAPUS KATALOG TERTENTU
          ========================================================================= */}
      {showStoreDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={17} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Konfirmasi Hapus Katalog
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStoreDeleteModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteStore} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                Anda akan menghapus profil katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong>. Seluruh item etalase dan media fisik di server toko ini akan dibersihkan.
              </div>

              {storeDeleteError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  {storeDeleteError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Ketik persis slug toko: <code style={{ backgroundColor: 'var(--bg-deep)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>{expectedStoreSlug}</code>
                </label>
                <input
                  type="text"
                  required
                  value={storeSlugConfirmation}
                  onChange={(e) => setStoreSlugConfirmation(e.target.value)}
                  placeholder={`Ketik "${expectedStoreSlug}" di sini`}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: isStoreSlugMatched ? '1px solid #10b981' : '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Kata Sandi Akun Pengelola
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.2rem 0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStoreDeleteModal(false)}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isStoreSlugMatched || !storePassword || isDeletingStore}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 'not-allowed' : 'pointer',
                    opacity: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isDeletingStore ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>Hapus Profil Katalog</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: KONFIRMASI TUTUP AKUN PENGGUNA PERMANEN
          ========================================================================= */}
      {showAccountDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '540px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(239, 68, 68, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserX size={17} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#ef4444' }}>
                  Konfirmasi Penutupan Akun Permanen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountDeleteModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteAccount} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                Tindakan ini akan menghapus akun login Anda (<strong style={{ color: 'var(--text-primary)' }}>{currentUser?.email || 'email terdaftar'}</strong>) serta <strong>seluruh {userStores.length} profil toko</strong> dan arsip katalog secara permanen.
              </div>

              {accountDeleteError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  {accountDeleteError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Ketik persis kalimat konfirmasi: <code style={{ backgroundColor: 'var(--bg-deep)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-light)', color: '#ef4444' }}>{REQUIRED_ACCOUNT_PHRASE}</code>
                </label>
                <input
                  type="text"
                  required
                  value={accountPhraseConfirmation}
                  onChange={(e) => setAccountPhraseConfirmation(e.target.value)}
                  placeholder={`Ketik "${REQUIRED_ACCOUNT_PHRASE}" di sini`}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: isAccountPhraseMatched ? '1px solid #10b981' : '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Kata Sandi Akun untuk Otentikasi
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.2rem 0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAccountDeleteModal(false)}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isAccountPhraseMatched || !accountPassword || isDeletingAccount}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'not-allowed' : 'pointer',
                    opacity: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isDeletingAccount ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Memproses Penutupan...</span>
                    </>
                  ) : (
                    <>
                      <UserX size={15} />
                      <span>Konfirmasi Tutup Akun</span>
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
