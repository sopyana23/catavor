import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCode,
  Globe,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

export interface CustomDomainQuotaState {
  store_slug?: string;
  plan?: {
    code?: string;
    name?: string;
    has_custom_domain?: boolean;
  } | null;
  plan_status?: string;
  custom_domain?: string | null;
  custom_domain_status?: string;
  custom_domain_verification_token?: string;
  custom_domain_verified_at?: string | null;
  custom_domain_last_checked_at?: string | null;
  custom_domain_error?: string;
  custom_domain_dns_target?: string;
  custom_domain_edge_ip?: string;
  custom_domain_txt_host?: string;
  custom_domain_txt_record_host?: string;
  custom_domain_is_apex?: boolean;
}

export interface CustomDomainSettingsPanelProps {
  variant: 'desktop' | 'tablet' | 'mobile';
  storeSlug: string;
  quota: CustomDomainQuotaState | null;
  apiBase: string;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshQuota: () => Promise<void> | void;
  onOpenUpgrade: () => void;
}

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  'co.id', 'or.id', 'ac.id', 'web.id', 'my.id', 'biz.id', 'sch.id', 'go.id', 'net.id',
  'co.uk', 'org.uk', 'me.uk', 'com.sg', 'com.my', 'com.au', 'co.jp',
]);

function isApexDomainHost(rawDomain: string): boolean {
  const clean = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\.$/, '');
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.length === 2;
  if (parts.length === 3) {
    return MULTI_PART_PUBLIC_SUFFIXES.has(`${parts[1]}.${parts[2]}`);
  }
  return false;
}

function getStatusMeta(status?: string | null, hasDomain?: boolean) {
  if (!hasDomain || !status || status === 'none') {
    return {
      label: 'Belum Diatur',
      color: 'var(--text-secondary)',
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.3)',
    };
  }
  switch (status) {
    case 'active':
      return {
        label: 'Aktif & Terverifikasi',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
      };
    case 'pending':
    case 'verifying':
      return {
        label: 'Menunggu Verifikasi DNS',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
      };
    case 'failed':
      return {
        label: 'Verifikasi DNS Gagal',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    case 'inactive_expired':
      return {
        label: 'Nonaktif (Paket Berakhir)',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.12)',
        border: 'rgba(249, 115, 22, 0.35)',
      };
    default:
      return {
        label: status,
        color: 'var(--text-secondary)',
        bg: 'rgba(148, 163, 184, 0.12)',
        border: 'rgba(148, 163, 184, 0.3)',
      };
  }
}

export const CustomDomainSettingsPanel: React.FC<CustomDomainSettingsPanelProps> = ({
  variant,
  storeSlug,
  quota,
  apiBase,
  authFetch,
  showToast,
  onRefreshQuota,
  onOpenUpgrade,
}) => {
  const [domainInput, setDomainInput] = useState<string>(quota?.custom_domain || '');
  const [syncedDomain, setSyncedDomain] = useState<string>(quota?.custom_domain || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [removing, setRemoving] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);

  if ((quota?.custom_domain || '') !== syncedDomain) {
    const nextVal = quota?.custom_domain || '';
    setSyncedDomain(nextVal);
    setDomainInput(nextVal);
  }

  const isPlanEligible = Boolean(quota?.plan?.has_custom_domain) && quota?.plan_status !== 'expired';
  const savedDomain = (quota?.custom_domain || '').trim();
  const domainStatus = quota?.custom_domain_status || 'none';
  const statusMeta = getStatusMeta(domainStatus, Boolean(savedDomain));
  const cnameTarget = (quota?.custom_domain_dns_target || 'cname.catavor.com').trim();
  const edgeIP = (quota?.custom_domain_edge_ip || '').trim();
  const txtHostLabel = (quota?.custom_domain_txt_record_host || '_catavor-verify').trim();
  const txtValue = (quota?.custom_domain_verification_token || '').trim();

  const isApex = useMemo(() => {
    if (savedDomain) {
      return quota?.custom_domain_is_apex ?? isApexDomainHost(savedDomain);
    }
    if (domainInput.trim()) {
      return isApexDomainHost(domainInput.trim());
    }
    return false;
  }, [savedDomain, domainInput, quota?.custom_domain_is_apex]);

  const routingHostLabel = useMemo(() => {
    const target = savedDomain || domainInput.trim().toLowerCase();
    if (!target || isApex) return '@';
    const labels = target.split('.');
    if (labels.length >= 3) {
      const tailTwo = `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
      const suffixLen = labels.length >= 4 && MULTI_PART_PUBLIC_SUFFIXES.has(tailTwo) ? 3 : 2;
      const sub = labels.slice(0, labels.length - suffixLen).join('.');
      return sub || 'www';
    }
    return 'katalog';
  }, [savedDomain, domainInput, isApex]);

  const handleCopy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      showToast('Nilai DNS berhasil disalin.', 'success');
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      showToast('Gagal menyalin ke clipboard.', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPlanEligible) {
      onOpenUpgrade();
      return;
    }
    setSaving(true);
    setVerifyFeedback(null);
    try {
      const res = await authFetch(`${apiBase}/subscription/custom-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_domain: domainInput.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan custom domain.');
      }
      showToast(json.message || 'Pengaturan custom domain berhasil disimpan.', 'success');
      await onRefreshQuota();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan custom domain.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDNS = async () => {
    if (!isPlanEligible || !savedDomain) return;
    setVerifying(true);
    setVerifyFeedback(null);
    try {
      const res = await authFetch(`${apiBase}/subscription/custom-domain/verify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.message || 'Verifikasi DNS belum lolos. Periksa record TXT dan CNAME/A Anda.';
        setVerifyFeedback(msg);
        showToast(msg, 'error');
      } else {
        setVerifyFeedback(null);
        showToast(json.message || 'Verifikasi DNS berhasil! Custom domain kini aktif.', 'success');
      }
      await onRefreshQuota();
    } catch (err: any) {
      const msg = err?.message || 'Gagal menjalankan pemeriksaan DNS.';
      setVerifyFeedback(msg);
      showToast(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemove = async () => {
    if (!isPlanEligible || !savedDomain) return;
    setRemoving(true);
    setVerifyFeedback(null);
    try {
      const res = await authFetch(`${apiBase}/subscription/custom-domain`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menghapus custom domain.');
      }
      setDomainInput('');
      showToast(json.message || 'Custom domain berhasil dihapus.', 'success');
      await onRefreshQuota();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menghapus custom domain.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const isCompact = variant === 'mobile';
  const currentSlug = quota?.store_slug || storeSlug || 'toko-anda';

  return (
    <div
      style={{
        maxWidth: variant === 'desktop' ? '720px' : '100%',
        marginTop: isCompact ? 0 : '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: isCompact ? '1rem' : '1.25rem',
      }}
      className="animate-fade-in"
    >
      {/* Header */}
      <div
        style={{
          paddingBottom: '0.85rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Globe size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontSize: isCompact ? '0.95rem' : '1.08rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Konfigurasi Custom Domain Katalog
            </h3>
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(245, 158, 11, 0.16)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                letterSpacing: '0.04em',
              }}
            >
              PRO BISNIS
            </span>
          </div>

          {isPlanEligible && (
            <span
              data-testid="custom-domain-status-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                backgroundColor: statusMeta.bg,
                color: statusMeta.color,
                border: `1px solid ${statusMeta.border}`,
              }}
            >
              {domainStatus === 'active' && savedDomain ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              <span>{statusMeta.label}</span>
            </span>
          )}
        </div>

        <p style={{ fontSize: isCompact ? '0.74rem' : '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Hubungkan domain resmi milik bisnis Anda (contoh: <code>brandanda.com</code> atau <code>katalog.brand.com</code>) langsung ke etalase Catavor dengan SSL HTTPS otomatis.
        </p>
      </div>

      {/* Marketing Teaser Mode for Non-Business Plans */}
      {!isPlanEligible && (
        <div
          data-testid="custom-domain-marketing-teaser"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: isCompact ? '1rem' : '1.25rem',
            borderRadius: '0.85rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(245, 158, 11, 0.32)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: '1 1 280px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.14)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Lock size={18} />
              </div>
              <div>
                <div style={{ fontSize: isCompact ? '0.86rem' : '0.94rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  Aktifkan Alamat Domain Brand Anda Sendiri
                </div>
                <p style={{ margin: 0, fontSize: isCompact ? '0.74rem' : '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Fitur Custom Domain eksklusif tersedia pada paket <strong>Pro Bisnis</strong>. Saat ini katalog Anda berada pada paket{' '}
                  <strong>{quota?.plan?.name || 'Gratis Terbatas'}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenUpgrade}
              data-testid="custom-domain-upgrade-cta"
              style={{
                minHeight: '44px',
                padding: '0.55rem 1.15rem',
                borderRadius: '0.6rem',
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                width: isCompact ? '100%' : 'auto',
              }}
            >
              <Sparkles size={15} />
              <span>Upgrade ke Pro Bisnis</span>
            </button>
          </div>

          {/* Visual URL Transformation Preview */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.65rem',
              fontFamily: 'monospace',
              fontSize: isCompact ? '0.72rem' : '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              <span>catavor.com/{currentSlug}</span>
            </div>
            <ArrowRight size={15} style={{ color: '#d97706', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary)', fontWeight: 800, wordBreak: 'break-all' }}>
              <ShieldCheck size={15} style={{ flexShrink: 0 }} />
              <span>https://tokoanda.com</span>
            </div>
          </div>

          {/* 3 Concrete Benefits */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '0.65rem',
            }}
          >
            {[
              {
                title: 'Kredibilitas Brand Penuh',
                desc: 'Tampil dengan nama domain toko Anda sendiri tanpa membawa nama platform di URL.',
              },
              {
                title: 'SSL HTTPS Otomatis',
                desc: 'Sertifikat keamanan TLS otomatis terbit & diperbarui untuk domain yang terverifikasi.',
              },
              {
                title: 'Routing Etalase Seketika',
                desc: 'Pengunjung domain Anda langsung membuka katalog lengkap, detail produk, dan order WhatsApp.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.6rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                }}
              >
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Locked Preview Input */}
          <div style={{ opacity: 0.68 }}>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
              Pratinjau Pengaturan Domain (Terkunci di Paket Saat Ini)
            </label>
            <div style={{ display: 'flex', gap: '0.6rem', flexDirection: isCompact ? 'column' : 'row' }}>
              <input
                type="text"
                disabled
                aria-disabled="true"
                value=""
                placeholder="Contoh: brandanda.com atau katalog.brand.com"
                className="form-input"
                style={{ flex: 1, minHeight: '44px', cursor: 'not-allowed' }}
              />
              <button
                type="button"
                disabled
                aria-disabled="true"
                style={{
                  minHeight: '44px',
                  padding: '0 1.15rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <Lock size={14} />
                <span>Simpan Domain</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Business Management Mode */}
      {isPlanEligible && (
        <>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontWeight: 800, fontSize: isCompact ? '0.78rem' : '0.84rem', display: 'block', marginBottom: '0.4rem' }}>
                Nama Domain Kustom
              </label>
              <div style={{ display: 'flex', gap: '0.65rem', flexDirection: isCompact ? 'column' : 'row' }}>
                <input
                  type="text"
                  className="form-input"
                  data-testid="custom-domain-input"
                  placeholder="Contoh: brandanda.com atau katalog.brand.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: isCompact ? '0.82rem' : '0.88rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={saving || verifying || removing}
                  data-testid="custom-domain-save-btn"
                  className="btn-primary"
                  style={{
                    minHeight: '44px',
                    padding: '0 1.35rem',
                    borderRadius: '0.5rem',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Domain'}
                </button>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Masukkan nama domain valid tanpa http://, https://, atau path (contoh: <code>katalog.brandanda.id</code>).
              </span>
            </div>
          </form>

          {/* Saved Domain Status + Actions */}
          {savedDomain && (
            <div
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: domainStatus === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-deep)',
                border: `1px solid ${statusMeta.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {domainStatus === 'active' ? (
                    <CheckCircle2 size={17} style={{ color: '#10b981', flexShrink: 0 }} />
                  ) : domainStatus === 'failed' ? (
                    <AlertTriangle size={17} style={{ color: '#ef4444', flexShrink: 0 }} />
                  ) : (
                    <Clock size={17} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  )}
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Domain Terdaftar: </span>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{savedDomain}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {domainStatus === 'active' && (
                    <a
                      href={`https://${savedDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        minHeight: '38px',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#10b981',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        textDecoration: 'none',
                      }}
                    >
                      <span>Buka Domain</span>
                      <ExternalLink size={13} />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleVerifyDNS}
                    disabled={verifying || saving || removing}
                    data-testid="custom-domain-verify-btn"
                    style={{
                      minHeight: '38px',
                      padding: '0.35rem 0.9rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: verifying ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>{verifying ? 'Memeriksa DNS...' : 'Verifikasi DNS Sekarang'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing || saving || verifying}
                    data-testid="custom-domain-remove-btn"
                    style={{
                      minHeight: '38px',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: removing ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{removing ? 'Menghapus...' : 'Hapus'}</span>
                  </button>
                </div>
              </div>

              {(verifyFeedback || quota?.custom_domain_error) && domainStatus !== 'active' && (
                <div
                  data-testid="custom-domain-error-box"
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{verifyFeedback || quota?.custom_domain_error}</span>
                </div>
              )}

              {quota?.custom_domain_last_checked_at && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Pemeriksaan terakhir: {new Date(quota.custom_domain_last_checked_at).toLocaleString('id-ID')}
                </div>
              )}
            </div>
          )}

          {/* Dynamic DNS Setup Guide */}
          <div
            style={{
              padding: isCompact ? '0.95rem' : '1.15rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
            }}
          >
            <h4 style={{ margin: 0, fontSize: isCompact ? '0.84rem' : '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <FileCode size={16} style={{ color: 'var(--primary)' }} />
              <span>Panduan Pengaturan DNS Registrar</span>
            </h4>
            <p style={{ fontSize: isCompact ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Tambahkan <strong>2 record berikut</strong> di panel DNS domain Anda (Cloudflare, Niagahoster, DomaiNesia, dll) agar kepemilikan terverifikasi dan sertifikat HTTPS dapat diterbitkan otomatis:
            </p>

            {/* Record 1: Ownership TXT */}
            {txtValue && (
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)' }}>1. Record TXT Verifikasi Kepemilikan</div>
                <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '90px 1fr 1.6fr', gap: '0.45rem', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Tipe:</strong> TXT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                    <span><strong style={{ color: 'var(--text-secondary)' }}>Host:</strong> {txtHostLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('txt_host', txtHostLabel)}
                      title="Salin Host TXT"
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--primary)' }}
                    >
                      {copiedField === 'txt_host' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                    <span><strong style={{ color: 'var(--text-secondary)' }}>Value:</strong> {txtValue}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('txt_val', txtValue)}
                      title="Salin Token TXT"
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--primary)' }}
                    >
                      {copiedField === 'txt_val' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Record 2: Routing A or CNAME */}
            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)' }}>
                {txtValue ? '2. ' : ''}Record Pengarah Trafik ({isApex ? 'Domain Root / Apex' : 'Subdomain'})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '110px 1fr 1.6fr', gap: '0.45rem', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Tipe:</strong>{' '}
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                    {isApex && edgeIP ? 'A (atau ALIAS)' : 'CNAME'}
                  </span>
                </div>
                <div style={{ wordBreak: 'break-all' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Host:</strong> {routingHostLabel}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                  <span>
                    <strong style={{ color: 'var(--text-secondary)' }}>Target:</strong>{' '}
                    {isApex && edgeIP ? edgeIP : cnameTarget}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('route_target', isApex && edgeIP ? edgeIP : cnameTarget)}
                    title="Salin Target DNS"
                    style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--primary)' }}
                  >
                    {copiedField === 'route_target' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              {isApex && !edgeIP && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Catatan domain root (<code>@</code>): registrar tradisional tidak selalu mendukung CNAME di <code>@</code>. Gunakan DNS dengan dukungan CNAME Flattening/ALIAS (seperti Cloudflare), atau pakai subdomain (misal <code>katalog.{savedDomain || 'brandanda.com'}</code>).
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
