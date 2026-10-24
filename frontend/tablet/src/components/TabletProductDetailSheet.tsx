import React, { useState, useMemo } from 'react';
import { X, MessageCircle, Share2, ShieldCheck, Check, Package, Tag, ExternalLink, Truck } from 'lucide-react';
import { FormattedText } from './RichTextarea';
import { useModalBackHandler } from '../utils/navigation';

export interface TabletProductDetailSheetProps {
  product: any | null;
  store: any | null;
  onClose: () => void;
}

const isNonEmptyValue = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s.length > 0 && s !== 'null' && s !== 'undefined' && s !== '-' && s !== 'none';
  }
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'boolean') return true;
  return false;
};

const getCatalogItemUnit = (prod: any): string => {
  if (prod?.unit) return prod.unit;
  switch (prod?.product_type) {
    case 'food': return 'Porsi';
    case 'service': return 'Sesi';
    case 'digital': return 'Lisensi';
    case 'property': return 'Unit';
    case 'fauna': return 'Ekor';
    case 'plant': return 'Pot';
    default: return 'Pcs';
  }
};

export const TabletProductDetailSheet: React.FC<TabletProductDetailSheetProps> = ({
  product,
  store,
  onClose
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useModalBackHandler({
    isOpen: Boolean(product),
    onClose,
    modalId: 'tablet-product-detail'
  });

  // Reset active image when product changes
  React.useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  const images = useMemo(() => {
    const list: string[] = [];
    if (product?.image_url) list.push(product.image_url);
    if (Array.isArray(product?.gallery_images)) {
      product.gallery_images.forEach((img: string) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    if (Array.isArray(product?.detailed_info?.images)) {
      product.detailed_info.images.forEach((img: string) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : ['https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'];
  }, [product]);

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
      `Status: ${product.conservation_status || 'Tersedia'}\n` +
      `Tautan: ${window.location.origin}/${store.slug || ''}#product-${product.id}\n\n` +
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

  const renderRow = (label: string, value: React.ReactNode, isHighlight = false) => {
    if (!isNonEmptyValue(value)) return null;
    return (
      <div
        key={label}
        style={{
          display: 'grid',
          gridTemplateColumns: '150px 1fr',
          gap: '0.85rem',
          alignItems: 'baseline',
          padding: '0.6rem 0',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '0.84rem',
          lineHeight: 1.45
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
          {label}
        </span>
        <span style={{
          fontWeight: 700,
          color: isHighlight ? 'var(--primary)' : 'var(--text-primary)',
          textAlign: 'right',
          wordBreak: 'break-word',
          letterSpacing: '0.01em'
        }}>
          {value}
        </span>
      </div>
    );
  };

  const renderProductSpecifications = () => {
    const unit = getCatalogItemUnit(product);
    const minOrderVal = product.min_order || product.attributes?.min_order || 1;
    const maxOrderVal = product.max_order || product.attributes?.max_order;

    let content: React.ReactNode = null;

    switch (product.product_type) {
      case 'plant':
        content = (
          <>
            {renderRow('Kategori Tanaman', product.class)}
            {renderRow('Nama Ilmiah / Botani', product.scientific_name)}
            {renderRow('Status Ketersediaan', product.conservation_status || 'Ready Stock')}
            {renderRow('Kebutuhan Cahaya', product.attributes?.sunlight || product.attributes?.light_requirement, true)}
            {renderRow('Penyiraman', product.attributes?.watering || product.attributes?.watering_frequency)}
            {renderRow('Media Tanam', product.attributes?.planting_medium || product.attributes?.growing_media)}
            {renderRow('Ukuran / Tinggi', product.attributes?.plant_size)}
            {renderRow('Status Legalitas', product.attributes?.protection_status || product.attributes?.plant_legality)}
            {renderRow('Kondisi Pengiriman', product.attributes?.delivery_condition || product.attributes?.ship_condition)}
            {renderRow('Minimal Pemesanan', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Pemesanan', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;

      case 'property':
        content = (
          <>
            {renderRow('Tipe Transaksi', product.attributes?.transaction_type || 'Dijual', true)}
            {renderRow('Tipe / Jenis Properti', product.class || product.attributes?.property_type)}
            {renderRow('Status Ketersediaan', product.conservation_status || 'Tersedia')}
            {renderRow('Legalitas / Sertifikat', product.attributes?.certificate)}
            {isNonEmptyValue(product.attributes?.land_area) && renderRow('Luas Tanah (LT)', `${product.attributes?.land_area} m²`)}
            {isNonEmptyValue(product.attributes?.building_area) && renderRow('Luas Bangunan (LB)', `${product.attributes?.building_area} m²`)}
            {isNonEmptyValue(product.attributes?.bedrooms) && renderRow('Kamar Tidur (KT)', `${product.attributes?.bedrooms}`)}
            {isNonEmptyValue(product.attributes?.bathrooms) && renderRow('Kamar Mandi (KM)', `${product.attributes?.bathrooms}`)}
            {renderRow('Jumlah Lantai', product.attributes?.floors)}
            {renderRow('Kapasitas Carport', product.attributes?.carport)}
            {renderRow('Daya Listrik', product.attributes?.electricity)}
            {renderRow('Sumber Air', product.attributes?.water_source)}
            {renderRow('Kondisi Perabotan', product.attributes?.furnishing)}
            {renderRow('Arah Hadap', product.attributes?.facing)}
            {renderRow('Lokasi / Wilayah Properti', product.attributes?.property_location || product.habitat)}
            {minOrderVal > 1 && renderRow('Minimal Unit', `${minOrderVal} Unit`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Unit', `${maxOrderVal} Unit`)}
          </>
        );
        break;

      case 'food':
        content = (
          <>
            {renderRow('Status Ketersediaan', product.conservation_status || 'Tersedia')}
            {renderRow('Status Halal', product.attributes?.halal_status, true)}
            {renderRow('Kategori Menu', product.class)}
            {renderRow('Pilihan Varian / Rasa', product.attributes?.variant)}
            {renderRow('Minimal Pesanan', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Pesanan', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;

      case 'service':
        content = (
          <>
            {renderRow('Status Ketersediaan', product.conservation_status || 'Buka Jadwal')}
            {renderRow('Kategori Layanan', product.class)}
            {renderRow('Durasi Layanan', product.attributes?.duration, true)}
            {renderRow('Lokasi Pelaksanaan', product.attributes?.service_location)}
            {renderRow('Cakupan Wilayah', product.attributes?.service_coverage)}
            {renderRow('Minimal Order', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Order', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;

      case 'digital':
        content = (
          <>
            {renderRow('Status Ketersediaan', product.conservation_status || 'Tersedia')}
            {renderRow('Kategori Produk', product.class)}
            {renderRow('Format Berkas', product.attributes?.file_format, true)}
            {renderRow('Ukuran File', product.attributes?.file_size)}
            {renderRow('Tipe Lisensi', product.attributes?.license_type)}
            {renderRow('Masa Berlaku', product.attributes?.validity_period)}
            {renderRow('Versi', product.attributes?.version)}
            {minOrderVal > 1 && renderRow('Minimal Pembelian', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Pembelian', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;

      case 'fauna':
        content = (
          <>
            {renderRow('Kategori Satwa', product.class)}
            {renderRow('Nama Ilmiah', product.scientific_name)}
            {renderRow('Status Ketersediaan', product.conservation_status || 'Tersedia')}
            {renderRow('Habitat Asal', product.attributes?.habitat || product.habitat, true)}
            {renderRow('Pola Pakan', product.attributes?.diet || product.diet)}
            {renderRow('Masa Hidup', product.detailed_info?.lifespan || product.attributes?.lifespan)}
            {renderRow('Bobot Rata-rata', product.detailed_info?.weight || product.attributes?.weight)}
            {renderRow('Minimal Pemesanan', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Pemesanan', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;

      case 'physical':
      default:
        content = (
          <>
            {renderRow('Status Ketersediaan', product.conservation_status || 'Tersedia')}
            {renderRow('Kondisi Barang', product.attributes?.condition)}
            {isNonEmptyValue(product.attributes?.weight) && renderRow('Berat Produk', `${product.attributes?.weight} Gram`)}
            {renderRow('Merek / Brand', product.attributes?.brand)}
            {renderRow('Varian / Pilihan', product.attributes?.variant)}
            {renderRow('Minimal Beli', `${minOrderVal} ${unit}`)}
            {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Beli', `${maxOrderVal} ${unit}`)}
          </>
        );
        break;
    }

    const typeTitleMap: Record<string, string> = {
      plant: 'Spesifikasi Tanaman',
      property: 'Spesifikasi Properti',
      food: 'Spesifikasi Kuliner & Menu',
      service: 'Spesifikasi Layanan',
      digital: 'Spesifikasi Berkas Digital',
      fauna: 'Spesifikasi Satwa',
      physical: 'Spesifikasi Produk Fisik'
    };

    return (
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-primary)' }}>
          {typeTitleMap[product.product_type] || 'Spesifikasi Produk'}
        </h3>
        <div style={{
          backgroundColor: 'var(--bg-deep)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.75rem',
          padding: '0.2rem 1rem'
        }}>
          {content}
        </div>
      </div>
    );
  };

  const purchaseLinks = Array.isArray(product?.detailed_info?.purchase_links)
    ? product.detailed_info.purchase_links.filter((l: any) => l && l.url && l.platform)
    : [];

  const shippingCoverage = product.detailed_info?.shipping_coverage || product.shipping_coverage;
  const shippingTerms = product.detailed_info?.shipping_terms || product.shipping_terms;
  const warrantyInfo = product.detailed_info?.warranty_info || product.warranty_info;

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

      {/* Side Sheet Panel (Width 540px - optimal for tablet screen) */}
      <div style={{
        width: '540px',
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
              Katalog Resmi Toko
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
          {/* Main Photo Container */}
          <div>
            <div style={{
              width: '100%',
              aspectRatio: '16/10',
              borderRadius: '0.85rem',
              overflow: 'hidden',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <img
                src={images[activeImageIndex] || images[0]}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                }}
              />

              {/* Top-Left Category Badge */}
              {(product.class || product.category_name) && (
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
                  gap: '0.35rem',
                  zIndex: 2
                }}>
                  <Tag size={12} />
                  {product.class || product.category_name}
                </div>
              )}

              {/* Top-Right Availability Status Badge */}
              {product.conservation_status && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: product.conservation_status === 'Habis Terjual'
                    ? 'rgba(239, 68, 68, 0.92)'
                    : product.conservation_status === 'Pre-Order'
                    ? 'rgba(217, 119, 6, 0.92)'
                    : (product.conservation_status === 'Koleksi / Display' || product.conservation_status === 'Buka Jadwal')
                    ? 'rgba(124, 58, 237, 0.92)'
                    : 'rgba(16, 185, 129, 0.92)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  zIndex: 2
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff'
                  }} />
                  {product.conservation_status}
                </div>
              )}
            </div>

            {/* Thumbnail Carousel if Multiple Images */}
            {images.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingTop: '0.65rem'
              }}>
                {images.map((imgUrl, idx) => {
                  const isActive = idx === activeImageIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        padding: 0,
                        border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        width: '56px',
                        height: '56px',
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.65,
                        backgroundColor: 'transparent'
                      }}
                    >
                      <img
                        src={imgUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Title, Scientific Name, and Price */}
          <div>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: '0 0 0.35rem 0'
            }}>
              {product.name}
            </h1>

            {(product.product_type === 'fauna' || product.product_type === 'plant') && isNonEmptyValue(product.scientific_name) && (
              <div style={{ fontStyle: 'italic', fontSize: '0.86rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                {product.scientific_name}
              </div>
            )}

            <div style={{
              fontSize: '1.65rem',
              fontWeight: 900,
              color: '#10b981',
              letterSpacing: '-0.02em'
            }}>
              Rp {Number(product.price || 0).toLocaleString('id-ID')}
            </div>
          </div>

          {/* Specifications Box (Contextual for 7 types) */}
          {renderProductSpecifications()}

          {/* Shipping / Delivery Info if available */}
          {(shippingCoverage || shippingTerms || warrantyInfo) && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-primary)' }}>
                Ketentuan Pengiriman &amp; Garansi
              </h3>
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                {shippingCoverage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                    <Truck size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Cakupan:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{shippingCoverage}</strong>
                  </div>
                )}
                {shippingTerms && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Catatan Pengiriman:</strong> {shippingTerms}
                  </div>
                )}
                {warrantyInfo && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Garansi:</strong> {warrantyInfo}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Deskripsi Produk
            </h3>
            <div style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              {product.description ? (
                <FormattedText text={product.description} />
              ) : (
                'Penjual belum menyertakan deskripsi rinci untuk produk ini.'
              )}
            </div>
          </div>

          {/* Marketplace / External Purchase Links if configured */}
          {purchaseLinks.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-primary)' }}>
                Tersedia Juga di Marketplace
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {purchaseLinks.map((link: any, idx: number) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    <span>{link.platform}</span>
                    <ExternalLink size={13} color="var(--text-secondary)" />
                  </a>
                ))}
              </div>
            </div>
          )}

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
              Pemesanan diproses langsung oleh pengelola katalog melalui saluran komunikasi resmi toko.
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
