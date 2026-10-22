import React, { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X, Check, RotateCcw, Search, Layers, ArrowUpDown, Tag, Package, CheckCircle2 } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface TabletProductFilterValues {
  status: 'all' | 'active' | 'archived';
  sort: string;
  productType: string;
  categoryId: string;
  stockStatus: 'all' | 'in_stock' | 'out_of_stock';
}

export interface TabletProductFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'all' | 'active' | 'archived';
  sort: string;
  productType: string;
  categoryId: string;
  stockStatus: 'all' | 'in_stock' | 'out_of_stock';
  categories: Array<{ id: number | string; name: string }>;
  catalogMetrics?: {
    total_items?: number;
    active_items?: number;
    archived_items?: number;
  };
  onApply: (filters: TabletProductFilterValues) => void;
  onReset: () => void;
}

export const TabletProductFilterSheet: React.FC<TabletProductFilterSheetProps> = ({
  isOpen,
  onClose,
  status,
  sort,
  productType,
  categoryId,
  stockStatus,
  categories,
  catalogMetrics,
  onApply,
  onReset
}) => {
  // Temporary filter states while sheet is open
  const [tempStatus, setTempStatus] = useState<'all' | 'active' | 'archived'>(status);
  const [tempSort, setTempSort] = useState<string>(sort);
  const [tempProductType, setTempProductType] = useState<string>(productType);
  const [tempCategoryId, setTempCategoryId] = useState<string>(categoryId);
  const [tempStockStatus, setTempStockStatus] = useState<'all' | 'in_stock' | 'out_of_stock'>(stockStatus);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');

  // Synchronize when opening
  useEffect(() => {
    if (isOpen) {
      setTempStatus(status);
      setTempSort(sort);
      setTempProductType(productType);
      setTempCategoryId(categoryId);
      setTempStockStatus(stockStatus);
      setCategorySearchQuery('');
    }
  }, [isOpen, status, sort, productType, categoryId, stockStatus]);

  // Modal Back Interceptor for Android hardware back & gesture back (Rule 2)
  useModalBackHandler({
    isOpen,
    onClose,
    modalId: 'tablet_merchant_product_filter'
  });

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearchQuery]);

  const handleReset = () => {
    setTempStatus('all');
    setTempSort('newest');
    setTempProductType('all');
    setTempCategoryId('all');
    setTempStockStatus('all');
    setCategorySearchQuery('');
    onReset();
    onClose();
  };

  const handleApply = () => {
    onApply({
      status: tempStatus,
      sort: tempSort,
      productType: tempProductType,
      categoryId: tempCategoryId,
      stockStatus: tempStockStatus
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <SlidersHorizontal size={20} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Filter &amp; Urutkan Produk
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Penyaringan inventaris katalog merchant
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup filter"
            style={{
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: '0.55rem',
              border: 'none',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sheet Body with Filter Options */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.35rem'
          }}
        >
          {/* SECTION 1: STATUS PRODUK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
              <CheckCircle2 size={15} color="var(--primary)" />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Status Katalog
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                { key: 'all', label: 'Semua', count: catalogMetrics?.total_items },
                { key: 'active', label: '✓ Aktif', count: catalogMetrics?.active_items },
                { key: 'archived', label: '🔒 Arsip', count: catalogMetrics?.archived_items }
              ].map((st) => {
                const isSelected = tempStatus === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setTempStatus(st.key as any)}
                    style={{
                      padding: '0.55rem 0.5rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 500,
                      minHeight: '44px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-light)',
                      backgroundColor: isSelected
                        ? 'var(--primary-glow)'
                        : 'var(--bg-deep)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{st.label}</span>
                    {typeof st.count === 'number' && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: '2px' }}>
                        ({st.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: URUTKAN BERDASARKAN */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
              <ArrowUpDown size={15} color="var(--primary)" />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Urutkan Berdasarkan
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {[
                { key: 'newest', label: 'Terbaru Ditambahkan' },
                { key: 'oldest', label: 'Terlama' },
                { key: 'price_asc', label: 'Harga: Termurah' },
                { key: 'price_desc', label: 'Harga: Tertinggi' },
                { key: 'name_asc', label: 'Nama (A - Z)' },
                { key: 'name_desc', label: 'Nama (Z - A)' }
              ].map((opt) => {
                const isSelected = tempSort === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTempSort(opt.key)}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 500,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-light)',
                      backgroundColor: isSelected
                        ? 'var(--primary-glow)'
                        : 'var(--bg-deep)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {opt.label}
                    </span>
                    {isSelected && <Check size={15} strokeWidth={3} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: TIPE PRODUK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
              <Layers size={15} color="var(--primary)" />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Tipe Item Produk
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {[
                { key: 'all', label: 'Semua Tipe' },
                { key: 'physical', label: 'Barang Fisik' },
                { key: 'food', label: 'Kuliner' },
                { key: 'service', label: 'Jasa' },
                { key: 'digital', label: 'Digital' },
                { key: 'property', label: 'Properti' },
                { key: 'plant', label: 'Tanaman' },
                { key: 'animal', label: 'Hewan' }
              ].map((opt) => {
                const isSelected = tempProductType === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTempProductType(opt.key)}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 500,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-light)',
                      backgroundColor: isSelected
                        ? 'var(--primary-glow)'
                        : 'var(--bg-deep)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={15} strokeWidth={3} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: KETERSEDIAAN STOK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
              <Package size={15} color="var(--primary)" />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Ketersediaan Stok
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                { key: 'all', label: 'Semua Stok' },
                { key: 'in_stock', label: 'Tersedia (>0)' },
                { key: 'out_of_stock', label: 'Habis (0)' }
              ].map((opt) => {
                const isSelected = tempStockStatus === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTempStockStatus(opt.key as any)}
                    style={{
                      padding: '0.55rem 0.5rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 500,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-light)',
                      backgroundColor: isSelected
                        ? 'var(--primary-glow)'
                        : 'var(--bg-deep)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: KATEGORI PRODUK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={15} color="var(--primary)" />
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Kategori Produk ({categories.length})
                </span>
              </div>
              {tempCategoryId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTempCategoryId('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Reset Kategori
                </button>
              )}
            </div>

            {/* Quick search if categories > 4 */}
            {categories.length > 4 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  marginBottom: '0.65rem'
                }}
              >
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Cari kategori..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
                {categorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCategorySearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '2px'
              }}
            >
              {/* Option: Semua Kategori */}
              <button
                type="button"
                onClick={() => setTempCategoryId('all')}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.82rem',
                  fontWeight: tempCategoryId === 'all' ? 800 : 500,
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  border: tempCategoryId === 'all'
                    ? '1.5px solid var(--primary)'
                    : '1px solid var(--border-light)',
                  backgroundColor: tempCategoryId === 'all'
                    ? 'var(--primary-glow)'
                    : 'var(--bg-deep)',
                  color: tempCategoryId === 'all' ? 'var(--primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Semua Kategori</span>
                {tempCategoryId === 'all' && <Check size={15} strokeWidth={3} color="var(--primary)" />}
              </button>

              {filteredCategories.map((c) => {
                const isSelected = String(tempCategoryId) === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTempCategoryId(String(c.id))}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 800 : 500,
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border-light)',
                      backgroundColor: isSelected
                        ? 'var(--primary-glow)'
                        : 'var(--bg-deep)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </span>
                    {isSelected && <Check size={15} strokeWidth={3} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Sheet Footer */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              flex: 1,
              minHeight: '44px',
              borderRadius: '0.65rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            <RotateCcw size={15} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              flex: 2,
              minHeight: '44px',
              borderRadius: '0.65rem',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--primary-glow)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <Check size={16} strokeWidth={3} />
            Terapkan Filter
          </button>
        </div>
      </div>
    </div>
  );
};
