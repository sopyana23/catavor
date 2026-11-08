import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, ArrowUpDown, Globe, Smartphone, Compass, ChevronDown, Check, ShieldCheck } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import type { DimensionalMetric } from '../utils/telemetryHelpers';

export interface AnalyticsDimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dimensionType: 'locations' | 'browsers' | 'operating_systems' | 'devices';
  items: DimensionalMetric[];
  totalViews?: number;
  themeMode?: 'dark' | 'light';
}

export const AnalyticsDimensionModal: React.FC<AnalyticsDimensionModalProps> = ({
  isOpen,
  onClose,
  title,
  dimensionType,
  items,
  totalViews: propTotalViews,
  themeMode
}) => {
  const isDark = themeMode === 'dark' || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'views_desc' | 'name_asc' | 'cr_desc'>('views_desc');

  // Register Smart Back interceptor so back button closes this modal
  useModalBackHandler({
    isOpen,
    onClose,
    modalId: `dimension-modal-${dimensionType}`
  });

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSortBy('views_desc');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalViews = useMemo(() => {
    if (typeof propTotalViews === 'number' && propTotalViews > 0) return propTotalViews;
    return items.reduce((sum, item) => sum + (item.views || 0), 0);
  }, [items, propTotalViews]);

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Exclude the '__others__' roll-up item in full modal view so users see the real individual dimensions
    result = result.filter(item => item.dimension_value !== '__others__');

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.dimension_value.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'id');
      }
      if (sortBy === 'cr_desc') {
        return (b.conversion_rate_percent || 0) - (a.conversion_rate_percent || 0);
      }
      return (b.views || 0) - (a.views || 0);
    });

    return result;
  }, [items, searchTerm, sortBy]);

  if (!isOpen) return null;

  const getDimensionIcon = () => {
    switch (dimensionType) {
      case 'locations':
        return <Compass size={18} style={{ color: '#f59e0b' }} />;
      case 'browsers':
        return <Globe size={18} style={{ color: '#10b981' }} />;
      case 'operating_systems':
      case 'devices':
      default:
        return <Smartphone size={18} style={{ color: '#3b82f6' }} />;
    }
  };

  const theme = {
    bgModal: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    bgDeep: isDark ? '#0f172a' : '#f8fafc',
    rowHover: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f1f5f9',
    accent: dimensionType === 'locations' ? '#f59e0b' : dimensionType === 'browsers' ? '#10b981' : '#3b82f6'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.18s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: theme.bgModal,
          borderRadius: '1rem',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.15rem 1.35rem',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.6rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {getDimensionIcon()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.textPrimary }}>
                  {title}
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.5rem',
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6'
                  }}
                >
                  {items.filter(i => i.dimension_value !== '__others__').length} Data
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                Data agregat analitik &bull; Privasi Zero-PII UU No. 27/2022
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '0.5rem',
              border: `1px solid ${theme.border}`,
              backgroundColor: 'transparent',
              color: theme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Tutup Modal (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Sort Controls Toolbar */}
        <div
          style={{
            padding: '0.85rem 1.35rem',
            backgroundColor: theme.bgDeep,
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.textSecondary
              }}
            />
            <input
              type="text"
              placeholder={`Cari nama ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                fontSize: '0.78rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bgModal,
                color: theme.textPrimary,
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600 }}>
              Urutan:
            </span>
            {[
              { key: 'views_desc', label: 'Kunjungan' },
              { key: 'cr_desc', label: 'Konversi' },
              { key: 'name_asc', label: 'Abjad A-Z' }
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortBy(s.key as any)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: `1px solid ${sortBy === s.key ? theme.accent : theme.border}`,
                  backgroundColor: sortBy === s.key ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                  color: sortBy === s.key ? (isDark ? '#60a5fa' : '#2563eb') : theme.textSecondary,
                  fontSize: '0.72rem',
                  fontWeight: sortBy === s.key ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div
          className="catavor-custom-scrollbar"
          style={{
            flex: 1,
            maxHeight: '420px',
            overflowY: 'auto',
            padding: '0.5rem 1.35rem'
          }}
        >
          {filteredAndSortedItems.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>Nama Dimensi</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>Kunjungan</th>
                  <th style={{ padding: '0.65rem 0.5rem', width: '130px', fontWeight: 700 }}>Porsi (%)</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>Konversi (CR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedItems.map((item, idx) => {
                  const percentage = totalViews > 0 ? (item.views / totalViews) * 100 : item.percentage;
                  const isInApp = item.dimension_value.includes('in-app') || item.name.toLowerCase().includes('in-app');
                  return (
                    <tr
                      key={item.dimension_value || idx}
                      style={{
                        borderBottom: `1px dashed ${theme.border}`,
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 700, color: theme.textPrimary }}>
                            {item.name || item.dimension_value}
                          </span>
                          {isInApp && (
                            <span
                              style={{
                                fontSize: '0.6rem',
                                padding: '0.05rem 0.35rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                                color: '#ec4899',
                                fontWeight: 700
                              }}
                            >
                              In-App
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: theme.accent }}>
                        {item.views.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.max(4, Math.min(100, percentage))}%`,
                                height: '100%',
                                backgroundColor: isInApp ? '#ec4899' : theme.accent,
                                borderRadius: '3px'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, fontWeight: 600, minWidth: '34px', textAlign: 'right' }}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: (item.conversion_rate_percent || 0) > 0 ? '#10b981' : theme.textSecondary }}>
                        {(item.conversion_rate_percent || 0).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: theme.textSecondary }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                {searchTerm ? `Tidak ditemukan dimensi yang cocok dengan "${searchTerm}".` : 'Belum ada data untuk dimensi ini.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.35rem',
            borderTop: `1px solid ${theme.border}`,
            backgroundColor: theme.bgDeep,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: theme.textSecondary }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>K-Anonymity privasi dilindungi secara matematis.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.bgModal,
              color: theme.textPrimary,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.78rem'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
