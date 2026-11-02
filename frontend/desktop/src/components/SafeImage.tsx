import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, ImageOff, RotateCcw } from 'lucide-react';

export interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad' | 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  alt?: string;
  /** Label ketika berkas belum diunggah atau src kosong */
  emptyLabel?: string;
  /** Alias kompatibilitas untuk emptyLabel */
  emptyText?: string;
  /** Keterangan tambahan ketika berkas belum diunggah */
  emptySubLabel?: string;
  /** Ikon kustom untuk kondisi kosong (JSX Element atau komponen Icon) */
  emptyIcon?: React.ReactNode | React.ElementType;
  /** Label ketika berkas gagal dimuat / URL rusak */
  errorLabel?: string;
  /** Alias kompatibilitas untuk errorLabel */
  errorText?: string;
  /** Keterangan tambahan ketika berkas rusak */
  errorSubLabel?: string;
  /** Ikon kustom untuk kondisi error (JSX Element atau komponen Icon) */
  errorIcon?: React.ReactNode | React.ElementType;
  /** Tampilkan teks keterangan atau cukup ikon (berguna pada thumbnail ringkas) */
  showLabel?: boolean;
  /** Mode ringkas: hanya tampilkan ikon dengan tooltip native title */
  compact?: boolean;
  /** Tipe object-fit untuk gambar */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Mode tema gelap / terang */
  isDark?: boolean;
  /** Izinkan tombol muat ulang saat gambar gagal terbaca */
  allowRetry?: boolean;
  /** Kustom styling untuk pembungkus */
  wrapperStyle?: React.CSSProperties;
  /** Kelas CSS untuk pembungkus */
  wrapperClassName?: string;
  /** Callback saat gambar berhasil dimuat */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** Callback saat gambar gagal dimuat */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  /** Callback saat kartu/gambar diklik untuk preview atau perbesar */
  onPreview?: () => void;
}

/**
 * SafeImage: Komponen Standar Industri untuk Penampil Gambar Catavor
 * 
 * Mengelola 4 fase gambar secara elegan tanpa layout shift:
 * 1. Empty State: Belum diunggah / URL kosong (Ikon ImageIcon + Muted Container)
 * 2. Loading State: Menunggu pemuatan gambar (Skeleton Muted Pulse)
 * 3. Error State: Gambar rusak / 404 / format korup (Ikon ImageOff + Opsi Muat Ulang)
 * 4. Success State: Gambar berhasil ter-render dengan object-fit terukur
 * 
 * Sesuai Standar: Bebas Emoji, Vektor Profesional Lucide (1.75px stroke), Anti-AI Slop.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc,
  alt = 'Gambar',
  emptyLabel,
  emptyText: emptyTextProp,
  emptySubLabel = 'Berkas belum diunggah',
  emptyIcon,
  errorLabel,
  errorText: errorTextProp,
  errorSubLabel = 'Berkas rusak atau tautan terputus',
  errorIcon,
  showLabel = true,
  compact = false,
  objectFit = 'cover',
  isDark = false,
  allowRetry = true,
  wrapperStyle,
  wrapperClassName = '',
  style,
  className = '',
  onLoad,
  onError,
  onPreview,
  ...restProps
}) => {
  const finalEmptyLabel = emptyLabel || emptyTextProp || 'Belum Ada Gambar';
  const finalErrorLabel = errorLabel || errorTextProp || 'Gambar Tidak Terbaca';

  const [currentSrc, setCurrentSrc] = useState<string | null>(() => {
    return src && src.trim() ? src : (fallbackSrc && fallbackSrc.trim() ? fallbackSrc : null);
  });
  const [hasTriedFallback, setHasTriedFallback] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  const [status, setStatus] = useState<'empty' | 'loading' | 'loaded' | 'error'>(() => {
    const initial = src && src.trim() ? src : (fallbackSrc && fallbackSrc.trim() ? fallbackSrc : null);
    return !initial ? 'empty' : 'loading';
  });

  // Sinkronisasi status saat prop `src` atau `fallbackSrc` berubah
  useEffect(() => {
    setHasTriedFallback(false);
    if (src && src.trim()) {
      setCurrentSrc(src);
      setStatus('loading');
    } else if (fallbackSrc && fallbackSrc.trim()) {
      setCurrentSrc(fallbackSrc);
      setStatus('loading');
    } else {
      setCurrentSrc(null);
      setStatus('empty');
    }
  }, [src, fallbackSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setStatus('loaded');
    if (onLoad) onLoad(e);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && fallbackSrc.trim() && !hasTriedFallback && currentSrc !== fallbackSrc) {
      setHasTriedFallback(true);
      setCurrentSrc(fallbackSrc);
      setStatus('loading');
      return;
    }

    setStatus('error');
    if (onError) onError(e);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('loading');
    setRetryKey(prev => prev + 1);
  };

  // Kalkulasi URL dengan cache buster jika retry dilakukan
  const resolvedSrc = currentSrc && retryKey > 0
    ? `${currentSrc}${currentSrc.includes('?') ? '&' : '?'}_retry=${retryKey}`
    : currentSrc || '';

  // Palette warna elegan anti-AI slop
  const emptyBg = isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc';
  const emptyBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const emptyTextColor = isDark ? '#94a3b8' : '#64748b';
  const emptySubColor = isDark ? '#64748b' : '#94a3b8';

  const errorBg = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
  const errorBorder = isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.2)';
  const errorTextColor = isDark ? '#f87171' : '#dc2626';
  const errorSubColor = isDark ? '#cbd5e1' : '#64748b';

  // Base container style
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    cursor: onPreview ? 'pointer' : undefined,
    userSelect: 'none',
    ...wrapperStyle
  };

  // Defensive Guard: Deteksi ukuran thumbnail agar teks tidak pernah merusak / bertumpuk di kontainer kecil
  const parseDimension = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const match = val.match(/^(\d+(?:\.\d+)?)/);
      if (match) return parseFloat(match[1]);
    }
    return 999;
  };
  const isSmallSize = (
    parseDimension(wrapperStyle?.width) <= 84 ||
    parseDimension(wrapperStyle?.height) <= 84 ||
    parseDimension(style?.width) <= 84 ||
    parseDimension(style?.height) <= 84
  );
  const isEffectivelyCompact = compact || !showLabel || isSmallSize;

  const renderEmptyIcon = () => {
    if (!emptyIcon) return <ImageIcon size={isEffectivelyCompact ? 20 : 26} strokeWidth={1.75} />;
    if (React.isValidElement(emptyIcon)) return emptyIcon;
    const IconComp = emptyIcon as React.ElementType;
    return <IconComp size={isEffectivelyCompact ? 20 : 26} strokeWidth={1.75} />;
  };

  const renderErrorIcon = () => {
    if (!errorIcon) return <ImageOff size={isEffectivelyCompact ? 20 : 24} strokeWidth={1.75} />;
    if (React.isValidElement(errorIcon)) return errorIcon;
    const IconComp = errorIcon as React.ElementType;
    return <IconComp size={isEffectivelyCompact ? 20 : 24} strokeWidth={1.75} />;
  };

  if (status === 'empty') {
    return (
      <div
        className={`safe-image-empty ${wrapperClassName}`}
        style={{
          ...containerStyle,
          backgroundColor: emptyBg,
          border: `1px dashed ${emptyBorder}`,
          borderRadius: wrapperStyle?.borderRadius || '0.75rem',
          padding: isEffectivelyCompact ? '0.2rem' : '0.75rem'
        }}
        title={isEffectivelyCompact ? `${finalEmptyLabel} (${emptySubLabel})` : undefined}
        onClick={onPreview}
      >
        <div style={{ color: emptyTextColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderEmptyIcon()}
        </div>
        {!isEffectivelyCompact && (
          <div style={{ marginTop: '0.4rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: emptyTextColor, lineHeight: 1.25 }}>
              {finalEmptyLabel}
            </div>
            {emptySubLabel && (
              <div style={{ fontSize: '0.66rem', color: emptySubColor, marginTop: '0.15rem' }}>
                {emptySubLabel}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className={`safe-image-error ${wrapperClassName}`}
        style={{
          ...containerStyle,
          backgroundColor: errorBg,
          border: `1px solid ${errorBorder}`,
          borderRadius: wrapperStyle?.borderRadius || '0.75rem',
          padding: isEffectivelyCompact ? '0.2rem' : '0.75rem'
        }}
        title={isEffectivelyCompact ? `${finalErrorLabel} (${errorSubLabel})` : undefined}
        onClick={onPreview}
      >
        <div style={{ color: errorTextColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderErrorIcon()}
        </div>
        {!isEffectivelyCompact && (
          <div style={{ marginTop: '0.35rem', textAlign: 'center', maxWidth: '90%' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: errorTextColor, lineHeight: 1.25 }}>
              {finalErrorLabel}
            </div>
            {errorSubLabel && (
              <div style={{ fontSize: '0.65rem', color: errorSubColor, marginTop: '0.15rem', lineHeight: 1.2 }}>
                {errorSubLabel}
              </div>
            )}
            {allowRetry && (
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  marginTop: '0.45rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '0.4rem',
                  border: `1px solid ${errorBorder}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={11} strokeWidth={2} />
                <span>Muat Ulang</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`safe-image-wrapper ${wrapperClassName}`}
      style={{
        ...containerStyle,
        backgroundColor: status === 'loading' ? emptyBg : 'transparent'
      }}
      onClick={onPreview}
    >
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: emptyBg,
            zIndex: 1,
            color: emptyTextColor
          }}
        >
          <ImageIcon size={isEffectivelyCompact ? 18 : 24} strokeWidth={1.5} className="animate-pulse" />
        </div>
      )}
      <img
        {...restProps}
        src={resolvedSrc}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: objectFit,
          display: 'block',
          opacity: status === 'loaded' ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          ...style
        }}
      />
    </div>
  );
};

export default SafeImage;
