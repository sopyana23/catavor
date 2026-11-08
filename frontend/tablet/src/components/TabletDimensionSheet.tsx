import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Globe, Smartphone, Compass, ShieldCheck } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import type { DimensionalMetric } from '../utils/telemetryHelpers';

export interface TabletDimensionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dimensionType: 'locations' | 'browsers' | 'operating_systems' | 'devices';
  items: DimensionalMetric[];
  totalViews?: number;
}

export const TabletDimensionSheet: React.FC<TabletDimensionSheetProps> = ({
  isOpen,
  onClose,
  title,
  dimensionType,
  items,
  totalViews: propTotalViews
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'views_desc' | 'name_asc' | 'cr_desc'>('views_desc');

  useModalBackHandler({
    isOpen,
    onClose,
    modalId: `tablet-sheet-${dimensionType}`
  });

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSortBy('views_desc');
    }
  }, [isOpen]);

  // Handle ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalViews = useMemo(() => {
    if (typeof propTotalViews === 'number' && propTotalViews > 0) return propTotalViews;
    return items.reduce((sum, item) => sum + (item.views || 0), 0);
  }, [items, propTotalViews]);

  const filteredItems = useMemo(() => {
    let result = items.filter(i => i.dimension_value !== '__others__');

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.dimension_value.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'id');
      if (sortBy === 'cr_desc') return (b.conversion_rate_percent || 0) - (a.conversion_rate_percent || 0);
      return (b.views || 0) - (a.views || 0);
    });

    return result;
  }, [items, searchTerm, sortBy]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (dimensionType) {
      case 'locations':
        return <Compass size={18} style={{ color: '#f59e0b' }} />;
      case 'browsers':
        return <Globe size={18} style={{ color: '#10b981' }} />;
      default:
        return <Smartphone size={18} style={{ color: '#3b82f6' }} />;
    }
  };

  const accentColor = dimensionType === 'locations' ? '#f59e0b' : dimensionType === 'browsers' ? '#10b981' : '#3b82f6';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.15s ease'
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
          maxWidth: '440px',
          height: '100%',
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-light)',
          boxShadow: '-8px 0 25px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header with touch targets >= 44px */}
        <div
          style={{
            minHeight: '60px',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--bg-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {getIcon()}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Total {filteredItems.length} dimensi terdata
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.6rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Tutup Sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Sort Controls (Touch Target >= 44px) */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'var(--bg-deep)',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }}
            />
            <input
              type="text"
              placeholder={`Cari ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0 0.85rem 0 2.4rem',
                fontSize: '0.82rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
            {[
              { key: 'views_desc', label: 'Kunjungan' },
              { key: 'cr_desc', label: 'Konversi' },
              { key: 'name_asc', label: 'Nama A-Z' }
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortBy(s.key as any)}
                style={{
                  minHeight: '40px',
                  borderRadius: '0.5rem',
                  border: `1px solid ${sortBy === s.key ? accentColor : 'var(--border-light)'}`,
                  backgroundColor: sortBy === s.key ? 'var(--bg-card)' : 'transparent',
                  color: sortBy === s.key ? accentColor : 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: sortBy === s.key ? 800 : 600,
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* List Content */}
        <div
          className="catavor-custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem'
          }}
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const percentage = totalViews > 0 ? (item.views / totalViews) * 100 : item.percentage;
              const isInApp = item.dimension_value.includes('in-app') || item.name.toLowerCase().includes('in-app');
              return (
                <div
                  key={item.dimension_value || idx}
                  style={{
                    padding: '0.75rem 0.95rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                            fontWeight: 800,
                            flexShrink: 0
                          }}
                        >
                          In-App
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: accentColor }}>
                        {item.views.toLocaleString('id-ID')}
                      </span>
                      {(item.conversion_rate_percent || 0) > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                          {(item.conversion_rate_percent || 0).toFixed(0)}% CR
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(4, Math.min(100, percentage))}%`,
                          height: '100%',
                          backgroundColor: isInApp ? '#ec4899' : accentColor,
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: '34px', textAlign: 'right' }}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                {searchTerm ? `Tidak ditemukan data "${searchTerm}".` : 'Belum ada data tercatat.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            minHeight: '60px',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-deep)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>Zero-PII UU No. 27/2022</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: '44px',
              padding: '0 1.25rem',
              borderRadius: '0.6rem',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
