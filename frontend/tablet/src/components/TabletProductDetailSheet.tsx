import React from 'react';
import { X, MessageCircle, Share2, ShieldCheck, Check, Package, Tag, Clock } from 'lucide-react';

export interface TabletProductDetailSheetProps {
  product: any | null;
  store: any | null;
  onClose: () => void;
}

export const TabletProductDetailSheet: React.FC<TabletProductDetailSheetProps> = ({
  product,
  store,
  onClose
}) => {
  if (!product) return null;

  const handleOrderWhatsApp = () => {
    if (!store?.whatsapp_number && !store?.phone) {
      alert('Nomor WhatsApp toko belum dikonfigurasi.');
      return;
    }
    const cleanNumber = (store.whatsapp_number || store.phone || '').replace(/\D/g, '');
    const finalNumber = cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber;
    const message = encodeURIComponent(
      `Halo ${store.name || 'Toko'}, saya tertarik untuk memesan produk berikut dari katalog:\n\n` +
      `*${product.name}*\n` +
      `Harga: Rp ${Number(product.price || 0).toLocaleString('id-ID')}\n` +
      `Tautan: ${window.location.origin}/${store.slug}#product-${product.id}\n\n` +
      `Apakah produk ini masih tersedia? Terima kasih!`
    );
    window.open(`https://wa.me/${finalNumber}?text=${message}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Lihat ${product.name} di ${store?.name || 'Catavor'}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan produk berhasil disalin!');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease'
    }}>
      {/* Backdrop click to close */}
      <div
        onClick={onClose}
        style={{ flex: 1, height: '100%' }}
      />

      {/* Side Sheet Panel (Width 520px - optimal for tablet screen) */}
      <div style={{
        width: '520px',
        maxWidth: '85vw',
        height: '100%',
        backgroundColor: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-light)',
        boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <Check size={12} strokeWidth={2.5} />
              Katalog Resmi
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleShare}
              title="Bagikan Produk"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Share2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup Panel"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Main Product Image */}
          <div style={{
            width: '100%',
            height: '320px',
            borderRadius: '0.85rem',
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Package size={64} strokeWidth={1} color="var(--text-muted)" />
            )}

            {product.category_name && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <Tag size={12} />
                {product.category_name}
              </div>
            )}
          </div>

          {/* Title & Price */}
          <div>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: '0 0 0.5rem 0'
            }}>
              {product.name}
            </h1>
            <div style={{
              fontSize: '1.65rem',
              fontWeight: 900,
              color: '#10b981',
              letterSpacing: '-0.02em'
            }}>
              Rp {Number(product.price || 0).toLocaleString('id-ID')}
            </div>
          </div>

          {/* Stock & Operational Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'var(--bg-deep)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: (product.stock > 0 || product.is_available !== false) ? '#10b981' : '#ef4444'
            }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              {(product.stock > 0 || product.is_available !== false) ? (
                <span>Stok Tersedia {product.stock ? `(${product.stock} unit)` : 'Siap Kirim'}</span>
              ) : (
                <span style={{ color: '#ef4444' }}>Stok Habis / Pre-Order</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Deskripsi Produk
            </h3>
            <div style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-line'
            }}>
              {product.description || 'Penjual belum menyertakan deskripsi rinci untuk produk ini.'}
            </div>
          </div>

          {/* Store Guarantee Box */}
          <div style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Katalog Resmi {store?.name || 'Catavor'}:</strong>{' '}
              Pemesanan diproses langsung oleh pemilik katalog melalui saluran komunikasi resmi toko.
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar for Tablet (Touch Target >= 44px) */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={handleOrderWhatsApp}
            style={{
              flex: 1,
              minHeight: '48px',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <MessageCircle size={20} />
            Pesan / Tanya via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
