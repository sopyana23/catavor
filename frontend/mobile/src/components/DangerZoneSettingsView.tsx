import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  Lock, 
  Store, 
  UserX, 
  X, 
  FolderMinus,
  AlertOctagon,
  CheckCircle2
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

  // Drag-to-dismiss gesture state for Store Delete Bottom Sheet
  const [storeDeleteDragY, setStoreDeleteDragY] = useState(0);
  const [isStoreDeleteDragging, setIsStoreDeleteDragging] = useState(false);
  const storeTouchStartY = useRef(0);

  const handleStoreDragStart = (clientY: number) => {
    if (isDeletingStore) return;
    storeTouchStartY.current = clientY;
    setIsStoreDeleteDragging(true);
  };

  const handleStoreDragMove = (clientY: number) => {
    if (!isStoreDeleteDragging || isDeletingStore) return;
    const delta = clientY - storeTouchStartY.current;
    if (delta > 0) {
      setStoreDeleteDragY(delta);
    } else {
      setStoreDeleteDragY(delta * 0.15);
    }
  };

  const handleStoreDragEnd = () => {
    if (!isStoreDeleteDragging || isDeletingStore) return;
    setIsStoreDeleteDragging(false);
    if (storeDeleteDragY > 70) {
      setShowStoreDeleteModal(false);
      setStoreSlugConfirmation('');
      setStorePassword('');
      setStoreDeleteError(null);
    }
    setStoreDeleteDragY(0);
  };

  // Drag-to-dismiss gesture state for Account Delete Bottom Sheet
  const [accountDeleteDragY, setAccountDeleteDragY] = useState(0);
  const [isAccountDeleteDragging, setIsAccountDeleteDragging] = useState(false);
  const accountTouchStartY = useRef(0);

  const handleAccountDragStart = (clientY: number) => {
    if (isDeletingAccount) return;
    accountTouchStartY.current = clientY;
    setIsAccountDeleteDragging(true);
  };

  const handleAccountDragMove = (clientY: number) => {
    if (!isAccountDeleteDragging || isDeletingAccount) return;
    const delta = clientY - accountTouchStartY.current;
    if (delta > 0) {
      setAccountDeleteDragY(delta);
    } else {
      setAccountDeleteDragY(delta * 0.15);
    }
  };

  const handleAccountDragEnd = () => {
    if (!isAccountDeleteDragging || isDeletingAccount) return;
    setIsAccountDeleteDragging(false);
    if (accountDeleteDragY > 70) {
      setShowAccountDeleteModal(false);
      setAccountPhraseConfirmation('');
      setAccountPassword('');
      setAccountDeleteError(null);
    }
    setAccountDeleteDragY(0);
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }} className="animate-fade-in">
      {/* Top Banner: Tenang & Profesional */}
      <div style={{
        padding: '0.95rem 1rem',
        borderRadius: '0.85rem',
        background: 'var(--card-bg-gradient, var(--bg-card))',
        border: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexShrink: 0
        }}>
          <FolderMinus size={18} />
        </div>
        <div>
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.04em',
            border: '1px solid var(--border-light)'
          }}>
            PENGATURAN LANJUTAN
          </span>
          <h3 style={{ fontSize: '0.95rem', margin: '0.25rem 0 0 0', fontWeight: 800, color: 'var(--text-primary)' }}>
            Penutupan Akun &amp; Katalog
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: '0.2rem 0 0 0', lineHeight: 1.45 }}>
            Opsi lanjutan untuk menghapus profil katalog aktif atau permohonan penutupan akun pengelola secara permanen.
          </p>
        </div>
      </div>

      {/* PANEL 1: HAPUS PROFIL KATALOG AKTIF */}
      <div className="glass-panel" style={{
        borderRadius: '0.85rem',
        border: '1px solid var(--border-light)',
        padding: '1.15rem',
        background: 'var(--card-bg-gradient, var(--bg-card))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            <Store size={15} />
          </div>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Hapus Profil Katalog Ini
          </h4>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
          Hapus profil katalog <strong>"{currentStore?.store_title || expectedStoreSlug}"</strong>. Semua produk, banner, dan foto server toko ini akan dibersihkan. Katalog lain dan akun email Anda tetap aktif.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
          border: '1px solid var(--border-light)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.85rem'
        }}>
          <FolderMinus size={13} />
          <span>Katalog lain milik Anda: <strong style={{ color: 'var(--text-primary)' }}>{Math.max(0, userStores.length - 1)} katalog</strong></span>
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
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Trash2 size={15} />
          Hapus Katalog Ini
        </button>
      </div>

      {/* PANEL 2: PENUTUPAN AKUN PENGGUNA (GDPR / PDP) */}
      <div className="glass-panel" style={{
        borderRadius: '0.85rem',
        border: '1px solid var(--border-light)',
        padding: '1.15rem',
        background: 'var(--card-bg-gradient, var(--bg-card))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              <UserX size={15} />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Penutupan Akun Pengguna
            </h4>
          </div>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-light)'
          }}>
            Privasi &amp; UU PDP
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
          Tutup akun <strong>{currentUser?.email}</strong>. Menghapus akun pengelola, seluruh <strong>{userStores.length} profil katalog</strong>, produk, media server, dan mengakhiri sesi di seluruh perangkat.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
          border: '1px solid var(--border-light)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.85rem'
        }}>
          <CheckCircle2 size={13} style={{ color: 'var(--primary)' }} />
          <span>Email dapat didaftarkan kembali jika dibutuhkan di masa depan.</span>
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
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.2s ease'
          }}
        >
          <UserX size={15} />
          Tutup Akun Pengguna
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
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              border: '1px solid var(--border-light)',
              maxHeight: '90vh',
              overflowY: 'auto',
              transform: `translateY(${Math.max(0, storeDeleteDragY)}px)`,
              transition: isStoreDeleteDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.65rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleStoreDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleStoreDragMove(e.touches[0].clientY)}
              onTouchEnd={handleStoreDragEnd}
              onMouseDown={(e) => handleStoreDragStart(e.clientY)}
              onMouseMove={(e) => handleStoreDragMove(e.clientY)}
              onMouseUp={handleStoreDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, or footer Batal) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '0.85rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleStoreDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleStoreDragMove(e.touches[0].clientY)}
              onTouchEnd={handleStoreDragEnd}
              onMouseDown={(e) => handleStoreDragStart(e.clientY)}
              onMouseMove={(e) => handleStoreDragMove(e.clientY)}
              onMouseUp={handleStoreDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Store size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Konfirmasi Hapus Katalog
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Verifikasi identitas katalog &amp; kata sandi
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-light)',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Rincian data yang akan dibersihkan:
              </strong>
              Semua produk, berkas foto server, dan URL <code style={{ color: 'var(--primary)' }}>/{expectedStoreSlug}</code> akan dinonaktifkan.
            </div>

            <form onSubmit={handleConfirmDeleteStore}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Ketik persis slug katalog: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{expectedStoreSlug}</span>
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
                    background: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 'var(--btn-secondary-bg, rgba(255,255,255,0.08))' : 'rgba(239, 68, 68, 0.85)',
                    color: (!isStoreSlugMatched || !storePassword || isDeletingStore) ? 'var(--text-muted)' : '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}
                >
                  {isDeletingStore ? 'Memproses...' : 'Konfirmasi Hapus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET 2: PENUTUPAN AKUN KESELURUHAN */}
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
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              border: '1px solid var(--border-light)',
              maxHeight: '90vh',
              overflowY: 'auto',
              transform: `translateY(${Math.max(0, accountDeleteDragY)}px)`,
              transition: isAccountDeleteDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Drag Handle Bar (Touch & Mouse Drag-Down to Dismiss) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.65rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleAccountDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleAccountDragMove(e.touches[0].clientY)}
              onTouchEnd={handleAccountDragEnd}
              onMouseDown={(e) => handleAccountDragStart(e.clientY)}
              onMouseMove={(e) => handleAccountDragMove(e.clientY)}
              onMouseUp={handleAccountDragEnd}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            {/* Clean Header (Standard Mobile: No X button, dismiss via drag handle, backdrop, or footer Batal) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '0.85rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleAccountDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleAccountDragMove(e.touches[0].clientY)}
              onTouchEnd={handleAccountDragEnd}
              onMouseDown={(e) => handleAccountDragStart(e.clientY)}
              onMouseMove={(e) => handleAccountDragMove(e.clientY)}
              onMouseUp={handleAccountDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--btn-secondary-bg, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <UserX size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Konfirmasi Penutupan Akun
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Verifikasi otentikasi &amp; konfirmasi penutupan
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--btn-secondary-bg, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-light)',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Rincian data yang akan ditutup:
              </strong>
              Akun ({currentUser?.email}), semua {userStores.length} profil katalog, etalase, berkas di server, serta seluruh sesi perangkat akan diakhiri permanen.
            </div>

            <form onSubmit={handleConfirmDeleteAccount}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Ketik persis kalimat: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{REQUIRED_ACCOUNT_PHRASE}</span>
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
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
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
                    background: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'var(--btn-secondary-bg, rgba(255,255,255,0.08))' : 'rgba(239, 68, 68, 0.85)',
                    color: (!isAccountPhraseMatched || !accountPassword || isDeletingAccount) ? 'var(--text-muted)' : '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}
                >
                  {isDeletingAccount ? 'Memproses...' : 'Konfirmasi Tutup Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
