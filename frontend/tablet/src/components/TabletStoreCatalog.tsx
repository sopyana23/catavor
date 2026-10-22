import React, { useState, useEffect, useCallback } from 'react';
import {
  Store as StoreIcon,
  Search,
  MessageCircle,
  Share2,
  MapPin,
  Clock,
  ShieldCheck,
  Package,
  ArrowLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  Tag
} from 'lucide-react';
import { TabletProductDetailSheet } from './TabletProductDetailSheet';
import { TabletScrollableFilterTags, type FilterTagItem } from './TabletScrollableFilterTags';

export interface TabletStoreCatalogProps {
  slug: string;
  onBackToExplore?: () => void;
}

export const TabletStoreCatalog: React.FC<TabletStoreCatalogProps> = ({
  slug,
  onBackToExplore
}) => {
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Fetch Store Profile & Products
  const loadStoreData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Store Info
      const storeRes = await fetch(`/api/u/${slug}`);
      if (!storeRes.ok) {
        throw new Error('Katalog toko tidak ditemukan atau sedang dinonaktifkan.');
      }
      const storeJson = await storeRes.json();
      const storeData = storeJson.data || storeJson.store || storeJson;
      setStore(storeData);

      // 2. Fetch Products
      const prodRes = await fetch(`/api/u/${slug}/products`);
      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        setProducts(prodJson.data || prodJson.products || []);
      }

      // 3. Fetch Categories
      const catRes = await fetch(`/api/u/${slug}/categories`);
      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.data || catJson.categories || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat katalog toko.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'all' || 
                          String(p.category_id) === String(selectedCategory) ||
                          p.category_name?.toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch = !searchQuery.trim() ||
                        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleShareStore = () => {
    if (navigator.share) {
      navigator.share({
        title: store?.name || 'Katalog Catavor',
        text: `Kunjungi katalog resmi ${store?.name || 'toko ini'} di Catavor:`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan katalog toko berhasil disalin ke clipboard!');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!store?.whatsapp_number && !store?.phone) {
      alert('Nomor WhatsApp toko belum dikonfigurasi.');
      return;
    }
    const cleanNumber = (store.whatsapp_number || store.phone || '').replace(/\D/g, '');
    const finalNumber = cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber;
    const message = encodeURIComponent(`Halo ${store?.name || 'Toko'}, saya sedang melihat katalog Anda di Catavor.`);
    window.open(`https://wa.me/${finalNumber}?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: '#10b981',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ marginTop: '1rem', fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Memuat Katalog Tablet...
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <StoreIcon size={32} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
          Katalog Tidak Ditemukan
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
          {error || 'Alamat tautan katalog tidak sesuai atau toko telah dinonaktifkan sementara.'}
        </p>
        {onBackToExplore && (
          <button
            type="button"
            onClick={onBackToExplore}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Kembali ke Beranda
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      paddingBottom: '3rem'
    }}>
      {/* 1. Tablet Store Cover Banner */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '240px',
        backgroundColor: '#0f172a',
        backgroundImage: store.banner_url ? `url(${store.banner_url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(8, 12, 20, 0.85) 100%)'
        }} />

        {/* Top Floating Navigation */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          {onBackToExplore && (
            <button
              type="button"
              onClick={onBackToExplore}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} />
              Jelajahi Toko Lain
            </button>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleShareStore}
              title="Bagikan Katalog Toko"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Store Profile Header Section (Tablet Ergonomic Layout) */}
      <div style={{
        maxWidth: '1100px',
        margin: '-50px auto 1.5rem auto',
        padding: '0 1.5rem',
        position: 'relative',
        zIndex: 20
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-premium)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            {/* Store Avatar Logo */}
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '1rem',
              backgroundColor: 'var(--bg-deep)',
              border: '2px solid var(--primary)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <StoreIcon size={36} color="var(--primary)" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {store.name}
                </h1>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <ShieldCheck size={12} />
                  Terverifikasi
                </span>
              </div>

              {store.slogan && (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                  {store.slogan}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {store.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={14} />
                    <span>{store.address}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Package size={14} />
                  <span>{products.length} Produk Aktif</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick CTA WhatsApp (Touch Target >= 44px) */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              minHeight: '44px',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
            }}
          >
            <MessageCircle size={18} />
            Hubungi Toko
          </button>
        </div>
      </div>

      {/* 3. Sticky Search & Category Pills Bar (Tablet Ergonomic) */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto 1.5rem auto',
        padding: '0 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.65rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Cari nama produk dalam katalog ini..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.92rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Filter Pills (Horizontal Touch & Drag Scroll) */}
        <TabletScrollableFilterTags
          items={[
            {
              id: 'all',
              label: 'Semua Produk',
              count: products.length
            },
            ...categories.map((cat) => ({
              id: String(cat.id),
              label: cat.name,
              count: products.filter(
                (p) => String(p.category_id) === String(cat.id) || p.category_name?.toLowerCase() === cat.name.toLowerCase()
              ).length
            }))
          ]}
          selectedId={selectedCategory}
          onSelect={(id) => setSelectedCategory(id)}
          ariaLabel="Filter Kategori Toko"
          containerBg="var(--bg-card)"
        />
      </div>

      {/* 4. Product Catalog Grid (Tablet 3-Column Native) */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 1.5rem'
      }}>
        {filteredProducts.length === 0 ? (
          <div style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px dashed var(--border-light)',
            color: 'var(--text-muted)'
          }}>
            <Package size={48} strokeWidth={1} style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Tidak Ada Produk yang Sesuai
            </h3>
            <p style={{ fontSize: '0.88rem', margin: 0 }}>
              Coba gunakan kata kunci lain atau pilih kategori yang berbeda.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.25rem'
          }}>
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => setSelectedProduct(prod)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.85rem',
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Product Thumbnail */}
                <div style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {prod.image_url ? (
                    <img
                      src={prod.image_url}
                      alt={prod.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={40} strokeWidth={1} color="var(--text-muted)" />
                    </div>
                  )}

                  {prod.category_name && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: '#ffffff'
                    }}>
                      {prod.category_name}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{
                      fontSize: '0.96rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: '0 0 0.35rem 0',
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {prod.name}
                    </h3>

                    <div style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#10b981',
                      letterSpacing: '-0.01em',
                      marginBottom: '0.5rem'
                    }}>
                      Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span>{prod.stock > 0 ? `Stok: ${prod.stock}` : 'Siap Pesan'}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Rincian &rarr;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Product Detail Side Sheet */}
      <TabletProductDetailSheet
        product={selectedProduct}
        store={store}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
