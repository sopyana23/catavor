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
  AlertOctagon,
  FileSpreadsheet
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
  onExportCatalog?: (format: 'csv' | 'json') => void;
}

export const DangerZoneSettingsView: React.FC<DangerZoneSettingsViewProps> = ({
  currentStore,
  currentUser,
  userStores,
  token,
  apiBase = '/api',
  onStoreDeleted,
  onAccountDeleted,
  showToast,
  onExportCatalog
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

  // Catalog Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = async (format: 'csv' | 'json') => {
    if (onExportCatalog) {
      onExportCatalog(format);
      return;
    }
    if (isExporting) return;
    setIsExporting(true);
    if (showToast) showToast('info', `Menyiapkan berkas ekspor ${format.toUpperCase()}...`);
    try {
      const res = await fetch(`${apiBase}/admin/catalog/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': currentStore?.slug || ''
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (showToast) showToast('error', errJson.message || 'Gagal mengekspor data katalog');
        return;
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `katalog-${currentStore?.slug || 'export'}-${format === 'csv' ? 'data.csv' : 'backup.json'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (showToast) showToast('success', `Katalog (${format.toUpperCase()}) berhasil diunduh!`);
    } catch {
      if (showToast) showToast('error', `Gagal mengunduh berkas ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

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
      {/* Top Banner Alert: Tenang, Informatif, Profesional */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '1rem',
        background: 'var(--card-bg-gradient, var(--bg-card))',
        border: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexShrink: 0
        }}>
          <FolderMinus size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              border: '1px solid var(--border-light)'
            }}>
              PENGATURAN LANJUTAN
            </span>
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
              Penutupan Akun &amp; Katalog
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0.45rem 0 0 0', lineHeight: 1.55 }}>
            Bagian ini memungkinkan Anda menghapus profil katalog yang sudah tidak digunakan atau mengajukan penutupan akun pengguna secara permanen. Seluruh tindakan memerlukan verifikasi kata sandi demi keamanan kepemilikan akun Anda.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* PANEL 0: CADANGKAN DATA KATALOG SEBELUM PENUTUPAN */}
        <div style={{
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
          background: 'var(--card-bg-gradient, var(--bg-card))',
          padding: '1.5rem 1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(30, 58, 138, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <HardDriveDownload size={18} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Cadangkan Seluruh Data Katalog
                </h4>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem 0', lineHeight: 1.55 }}>
                Unduh salinan arsip lengkap profil toko, seluruh item produk, varian, kategori, spesifikasi domain, dan kontak resmi sebelum melakukan tindakan penutupan atau penghapusan permanen.
              </p>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic', lineHeight: 1.45 }}>
                Peringatan Penting: Menghapus katalog ini akan membersihkan seluruh produk dan berkas foto fisik dari server secara permanen. Pastikan Anda telah mengunduh salinan cadangan data produk Anda sebelum melanjutkan.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                style={{
                  minHeight: '44px',
                  padding: '0.65rem 1.15rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isExporting ? 0.6 : 1
                }}
              >
                <FileSpreadsheet size={16} style={{ color: 'var(--primary)' }} />
                <span>Unduh Berkas Excel (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExport('json')}
                disabled={isExporting}
                style={{
                  minHeight: '44px',
                  padding: '0.65rem 1.15rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--btn-secondary-bg, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isExporting ? 0.6 : 1
                }}
              >
                <HardDriveDownload size={16} style={{ color: 'var(--primary)' }} />
                <span>Unduh Salinan Lengkap (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* PANEL 1: HAPUS PROFIL KATALOG AKTIF */}
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
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
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
                Hapus profil katalog <strong style={{ color: 'var(--text-primary)' }}>"{currentStore?.store_title || expectedStoreSlug}"</strong> (slug: <code style={{ background: 'var(--btn-secondary-bg)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}>{expectedStoreSlug}</code>). 
                Produk, varian, etalase, dan berkas foto di server toko ini akan dibersihkan. Akun email Anda dan katalog lainnya ({Math.max(0, userStores.length - 1)} katalog) tetap aktif seperti biasa.
              </p>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
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
                e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg, rgba(255,255,255,0.05))';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              <Trash2 size={16} />
              Hapus Katalog Ini
            </button>
          </div>
        </div>

        {/* PANEL 2: PENUTUPAN AKUN PENGGUNA (GDPR / PDP) */}
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
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
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
                  backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
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
                background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
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
                e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg, rgba(255,255,255,0.05))';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              <UserX size={16} />
              Tutup Akun Pengguna
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
              border: '1px solid var(--border-light)',
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
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Store size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
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
              background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              padding: '0.9rem 1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rincian data yang akan dibersihkan dari server:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li>Semua produk, varian, dan etalase pada katalog ini</li>
                <li>Seluruh berkas media foto &amp; banner di disk server toko</li>
                <li>Riwayat analitik &amp; klik link kontak katalog ini</li>
                <li>Tautan publik <code style={{ color: 'var(--primary)' }}>/{expectedStoreSlug}</code> akan dinonaktifkan</li>
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
              border: '1px solid var(--border-light)',
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
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <UserX size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
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
              background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Akun email ({currentUser?.email}) dan rincian berikut akan ditutup:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                <li>Semua profil katalog: <strong>{userStores.map(s => s.store_title || s.slug).join(', ') || 'Semua katalog'}</strong></li>
                <li>Seluruh produk, varian, etalase, dan media dari disk server toko</li>
                <li>Semua sesi login di seluruh perangkat (laptop, handphone, tablet) langsung dikeluarkan</li>
                <li>Data akun dibersihkan permanen sesuai standar hak privasi (UU PDP / GDPR)</li>
              </ul>
            </div>

            <form onSubmit={handleConfirmDeleteAccount}>
              {/* Form Input 1: Confirmation Phrase */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Ketik persis kalimat konfirmasi: <span style={{ color: 'var(--text-primary)', fontWeight: 800, userSelect: 'all' }}>{REQUIRED_ACCOUNT_PHRASE}</span>
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
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
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
                      ? 'var(--btn-secondary-bg, rgba(255,255,255,0.08))'
                      : 'rgba(239, 68, 68, 0.85)',
                    color: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount)
                      ? 'var(--text-muted)'
                      : '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'not-allowed' : 'pointer',
                    boxShadow: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isDeletingAccount ? (
                    <>Menutup Akun...</>
                  ) : (
                    <>
                      <UserX size={16} />
                      Konfirmasi Tutup Akun
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
