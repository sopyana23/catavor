import React, { useState } from 'react';
import {
  Trash2,
  Lock,
  Store,
  UserX,
  X,
  HardDriveDownload,
  FolderMinus,
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
          confirm_slug: storeSlugConfirmation.trim(),
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
          confirm_phrase: accountPhraseConfirmation.trim(),
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
      {/* PANEL 1: BACKUP / CADANGKAN DATA KATALOG (JSON) */}
      {onExportCatalogJSON && (
        <div style={{
          backgroundColor: 'var(--card-bg-gradient, var(--bg-card))',
          padding: '1.5rem 1.75rem',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)'
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
              backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
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
        background: 'var(--card-bg-gradient, var(--bg-card))',
        padding: '1.5rem 1.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}>
                <Store size={17} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Hapus Profil Katalog Ini
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
              Hapus profil katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong> (slug: <code style={{ background: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}>{expectedStoreSlug}</code>). 
              Produk, varian, etalase, dan berkas foto di server toko ini akan dibersihkan. Akun email Anda dan katalog lainnya ({Math.max(0, userStores.length - 1)} katalog) tetap aktif.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.04))',
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
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              alignSelf: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <Trash2 size={16} />
            <span>Hapus Katalog Ini</span>
          </button>
        </div>
      </div>

      {/* PANEL 3: PENUTUPAN AKUN PENGGUNA (GDPR / PDP) */}
      <div style={{
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        background: 'var(--card-bg-gradient, var(--bg-card))',
        padding: '1.5rem 1.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}>
                <UserX size={17} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Penutupan Akun Pengguna
              </h4>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.06))',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                letterSpacing: '0.03em'
              }}>
                Privasi &amp; UU PDP
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.55 }}>
              Tutup akun <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.email}</strong> secara permanen. Opsi ini akan menghapus akun pengelola, seluruh <strong style={{ color: 'var(--text-primary)' }}>{userStores.length} profil katalog</strong> yang terdaftar, seluruh media, serta mencabut sesi di semua perangkat terhubung.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-light)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)'
            }}>
              <CheckCircle2 size={15} style={{ color: 'var(--primary)' }} />
              <span>Setelah ditutup, alamat email dapat digunakan kembali jika Anda ingin mendaftar ulang di kemudian hari.</span>
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
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              alignSelf: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <UserX size={16} />
            <span>Tutup Akun Pengguna</span>
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
            borderRadius: '1.15rem',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Store size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Konfirmasi Hapus Profil Katalog
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Verifikasi identitas katalog &amp; kata sandi akun
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStoreDeleteModal(false)}
                disabled={isDeletingStore}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: isDeletingStore ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteStore} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{
                padding: '0.9rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--border-light)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.55
              }}>
                <p style={{ margin: '0 0 0.45rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rincian data yang akan dibersihkan dari server:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                  <li>Semua produk, varian, dan etalase pada katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong></li>
                  <li>Seluruh berkas media foto di disk penyimpanan toko ini</li>
                  <li>Tautan publik <code style={{ color: 'var(--primary)' }}>/{expectedStoreSlug}</code> akan dinonaktifkan</li>
                </ul>
              </div>

              {storeDeleteError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  {storeDeleteError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Ketik persis slug toko: <code style={{ backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-light)', color: '#ef4444' }}>{expectedStoreSlug}</code>
                </label>
                <input
                  type="text"
                  required
                  value={storeSlugConfirmation}
                  onChange={(e) => setStoreSlugConfirmation(e.target.value)}
                  placeholder={`Ketik "${expectedStoreSlug}" di sini`}
                  disabled={isDeletingStore}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: isStoreSlugMatched ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Kata Sandi Akun Pengelola
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    disabled={isDeletingStore}
                    style={{
                      width: '100%',
                      padding: '0.7rem 2.2rem 0.7rem 0.85rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStoreDeleteModal(false)}
                  disabled={isDeletingStore}
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.6rem',
                    backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isDeletingStore ? 'not-allowed' : 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isStoreSlugMatched || !storePassword || isDeletingStore}
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.6rem',
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
          MODAL 2: KONFIRMASI TUTUP AKUN PENGGUNA
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
            border: '1px solid var(--border-light)',
            borderRadius: '1.15rem',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <UserX size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Konfirmasi Penutupan Akun
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Verifikasi otentikasi &amp; konfirmasi penutupan data permanen
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountDeleteModal(false)}
                disabled={isDeletingAccount}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteAccount} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{
                padding: '0.9rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--border-light)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.55
              }}>
                <p style={{ margin: '0 0 0.45rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Akun email (<strong style={{ color: 'var(--text-primary)' }}>{currentUser?.email || 'email terdaftar'}</strong>) dan rincian berikut akan ditutup:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                  <li>Seluruh profil katalog (<strong style={{ color: 'var(--text-primary)' }}>{userStores.length} katalog</strong>) beserta item produk</li>
                  <li>Semua berkas foto di server dan riwayat aktivitas toko</li>
                  <li>Hak akses akun dan sesi login di semua perangkat</li>
                </ul>
              </div>

              {accountDeleteError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  {accountDeleteError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Ketik persis kalimat konfirmasi: <code style={{ backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-light)', color: '#ef4444' }}>{REQUIRED_ACCOUNT_PHRASE}</code>
                </label>
                <input
                  type="text"
                  required
                  value={accountPhraseConfirmation}
                  onChange={(e) => setAccountPhraseConfirmation(e.target.value)}
                  placeholder={`Ketik "${REQUIRED_ACCOUNT_PHRASE}" di sini`}
                  disabled={isDeletingAccount}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: isAccountPhraseMatched ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Kata Sandi Akun untuk Otentikasi
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    disabled={isDeletingAccount}
                    style={{
                      width: '100%',
                      padding: '0.7rem 2.2rem 0.7rem 0.85rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Lock size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAccountDeleteModal(false)}
                  disabled={isDeletingAccount}
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.6rem',
                    backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isDeletingAccount ? 'not-allowed' : 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isAccountPhraseMatched || !accountPassword || isDeletingAccount}
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.6rem',
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

