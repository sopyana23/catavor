import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Globe, Smartphone, Compass, ShieldCheck } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import type { DimensionalMetric } from '../utils/telemetryHelpers';

export interface MobileDimensionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dimensionType: 'locations' | 'browsers' | 'operating_systems' | 'devices';
  items: DimensionalMetric[];
  totalViews?: number;
  themeMode?: 'dark' | 'light';
}

export const MobileDimensionSheet: React.FC<MobileDimensionSheetProps> = ({
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

  // Gesture drag physics states
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);

  useModalBackHandler({
    isOpen,
    onClose,
    modalId: `mobile-sheet-${dimensionType}`
  });

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSortBy('views_desc');
      setDragOffset(0);
      setIsDragging(false);
      setIsClosing(false);
    }
  }, [isOpen]);

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

  // Handle Touch Drag Physics on Drag Handle Bar
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentYRef.current = e.touches[0].clientY;
    const delta = currentYRef.current - startYRef.current;
    if (delta > 0) {
      setDragOffset(delta);
    } else {
      // Rubber banding when dragged upwards
      setDragOffset(delta * 0.18);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset >= 70) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 200);
    } else {
      setDragOffset(0);
    }
  };

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

  const theme = {
    surface: isDark ? '#1e293b' : '#ffffff',
    cardAlt: isDark ? '#0f172a' : '#f8fafc',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'opacity 0.2s ease',
        opacity: isClosing ? 0 : 1
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
          maxHeight: '85vh',
          backgroundColor: theme.surface,
          borderRadius: '1.25rem 1.25rem 0 0',
          borderTop: `1px solid ${theme.border}`,
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          transform: isClosing
            ? 'translateY(100%)'
            : isDragging
            ? `translateY(${Math.max(0, dragOffset)}px)`
            : 'translateY(0)',
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
      >
        {/* Drag Handle Bar (Touch Action None) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: 'none',
            paddingTop: '0.65rem',
            paddingBottom: '0.35rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'grab'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
            }}
          />
        </div>

        {/* Header - Clean without 'X' button according to Catavor Mobile Rule */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: 'none',
            padding: '0.5rem 1.15rem 0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.border}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.65rem',
                backgroundColor: theme.cardAlt,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {getIcon()}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: theme.textPrimary }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary }}>
                Total {filteredItems.length} rincian dimensi &bull; Zero-PII
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '10px',
              backgroundColor: theme.cardAlt,
              color: accentColor,
              border: `1px solid ${theme.border}`
            }}
          >
            {filteredItems.length} Entri
          </span>
        </div>

        {/* Sticky Search & Sort Controls Toolbar */}
        <div
          style={{
            padding: '0.75rem 1.15rem',
            backgroundColor: theme.cardAlt,
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem'
          }}
        >
          {/* Search Box (Min-Height 44px) */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.85rem',
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
                minHeight: '44px',
                padding: '0 0.85rem 0 2.4rem',
                fontSize: '0.8rem',
                borderRadius: '0.65rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.surface,
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
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Pills (Min-Height 40px) */}
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
                  borderRadius: '0.55rem',
                  border: `1px solid ${sortBy === s.key ? accentColor : theme.border}`,
                  backgroundColor: sortBy === s.key ? theme.surface : 'transparent',
                  color: sortBy === s.key ? accentColor : theme.textSecondary,
                  fontSize: '0.72rem',
                  fontWeight: sortBy === s.key ? 800 : 600,
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body with Touch Containment */}
        <div
          className="catavor-custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '0.75rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
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
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name || item.dimension_value}
                      </span>
                      {isInApp && (
                        <span
                          style={{
                            fontSize: '0.58rem',
                            padding: '0.05rem 0.3rem',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: accentColor }}>
                        {item.views.toLocaleString('id-ID')}
                      </span>
                      {(item.conversion_rate_percent || 0) > 0 && (
                        <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                          {(item.conversion_rate_percent || 0).toFixed(0)}% CR
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: theme.surface, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(4, Math.min(100, percentage))}%`,
                          height: '100%',
                          backgroundColor: isInApp ? '#ec4899' : accentColor,
                          borderRadius: '2px'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: theme.textSecondary }}>
              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>
                {searchTerm ? `Tidak ditemukan "${searchTerm}".` : 'Belum ada data dimensi.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer (Touch Target >= 44px) */}
        <div
          style={{
            padding: '0.75rem 1.15rem 1rem 1.15rem',
            borderTop: `1px solid ${theme.border}`,
            backgroundColor: theme.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', color: theme.textSecondary }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>UU No. 27/2022</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: '44px',
              padding: '0 1.5rem',
              borderRadius: '0.65rem',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
