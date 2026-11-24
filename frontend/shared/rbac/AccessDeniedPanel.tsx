import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedPanelProps {
  title?: string;
  moduleName?: string;
  roleSlug?: string;
  isDark: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export const AccessDeniedPanel: React.FC<AccessDeniedPanelProps> = ({
  title = 'Akses Modul Dibatasi',
  moduleName,
  roleSlug,
  isDark,
  onBack,
  backLabel = 'Kembali ke Beranda Modul',
}) => {
  return (
    <div
      data-testid="rbac-access-denied-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        margin: '1rem auto',
        maxWidth: '520px',
        borderRadius: '1rem',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.72)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(248, 113, 113, 0.3)' : '#fecaca'}`,
        boxShadow: isDark ? '0 12px 30px rgba(0, 0, 0, 0.35)' : '0 8px 24px rgba(15, 23, 42, 0.06)',
        gap: '0.9rem',
      }}
    >
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '0.9rem',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
          border: `1px solid ${isDark ? 'rgba(248, 113, 113, 0.35)' : '#fca5a5'}`,
          color: isDark ? '#f87171' : '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ShieldAlert size={26} strokeWidth={1.75} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 800,
            color: isDark ? '#f8fafc' : '#0f172a',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.84rem',
            lineHeight: 1.55,
            color: isDark ? '#cbd5e1' : '#475569',
          }}
        >
          {moduleName
            ? `Peran akun Anda${roleSlug ? ` (${roleSlug})` : ''} tidak memiliki izin yang diperlukan untuk membuka modul ${moduleName}.`
            : `Peran akun Anda${roleSlug ? ` (${roleSlug})` : ''} tidak memiliki otorisasi untuk mengakses halaman ini.`}
        </p>
        <span
          style={{
            fontSize: '0.74rem',
            color: isDark ? '#94a3b8' : '#64748b',
          }}
        >
          Seluruh permintaan ke API dilindungi oleh RBAC server-side. Hubungi Superadmin jika Anda memerlukan penyesuaian hak akses.
        </span>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: '0.4rem',
            minHeight: '44px',
            padding: '0.6rem 1.2rem',
            borderRadius: '0.75rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          <span>{backLabel}</span>
        </button>
      )}
    </div>
  );
};
