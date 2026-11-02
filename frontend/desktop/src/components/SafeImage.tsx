import React, { useState, useEffect, useRef } from 'react';
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
 * Filter dan sanitasi URL gambar untuk mencegah string sentinel 'null', 'undefined', dll.
 * Dianggap valid hanya jika berupa path/URL riil non-kosong.
 */
export const cleanImageSrc = (s?: string | null): string | null => {
  if (!s) return null;
  const trimmed = s.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '""' ||
    trimmed === "''" ||
    trimmed === '{}' ||
    trimmed === '[]' ||
    trimmed === '[object Object]'
  ) {
    return null;
  }
  return trimmed;
};

/**
 * SafeImage: Komponen Standar Industri untuk Penampil Gambar Catavor
 * 
 * Mengelola 4 fase gambar secara elegan tanpa layout shift:
 * 1. Empty State: Belum diunggah / URL kosong (Ikon ImageIcon + Dashed Muted Container)
 * 2. Loading State: Menunggu pemuatan gambar (Skeleton Muted Pulse)
 * 3. Error State: Gambar rusak / 404 / format korup (Ikon ImageOff + Soft Red Border)
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
  const finalErrorLabel = errorLabel || errorTextProp || 'Gambar Rusak';

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredSmall, setMeasuredSmall] = useState<boolean>(false);

  const validInitialSrc = cleanImageSrc(src) || cleanImageSrc(fallbackSrc);
  const [currentSrc, setCurrentSrc] = useState<string | null>(validInitialSrc);
  const [hasTriedFallback, setHasTriedFallback] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  const [status, setStatus] = useState<'empty' | 'loading' | 'loaded' | 'error'>(() => {
    return !validInitialSrc ? 'empty' : 'loading';
  });

  // Dynamic dimension observer: mendeteksi ukuran kontainer induk secara akurat
  // agar thumbnail (<= 96px) otomatis beroperasi dalam mode compact anti-overflow.
  useEffect(() => {
    if (!containerRef.current) return;
    const checkDim = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if ((rect.width > 0 && rect.width <= 96) || (rect.height > 0 && rect.height <= 96)) {
          setMeasuredSmall(true);
        } else if (rect.width > 96 && rect.height > 96) {
          setMeasuredSmall(false);
        }
      }
    };
    checkDim();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(checkDim);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }
  }, []);

  // Sinkronisasi status saat prop `src` atau `fallbackSrc` berubah
  useEffect(() => {
    setHasTriedFallback(false);
    const validSrc = cleanImageSrc(src);
    const validFallback = cleanImageSrc(fallbackSrc);
    if (validSrc) {
      setCurrentSrc(validSrc);
      setStatus('loading');
    } else if (validFallback) {
      setCurrentSrc(validFallback);
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
    const validFallback = cleanImageSrc(fallbackSrc);
    if (validFallback && !hasTriedFallback && currentSrc !== validFallback) {
      setHasTriedFallback(true);
      setCurrentSrc(validFallback);
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
  const emptyBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1';
  const emptyTextColor = isDark ? '#94a3b8' : '#64748b';
  const emptySubColor = isDark ? '#64748b' : '#94a3b8';

  const errorBg = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
  const errorBorder = isDark ? 'rgba(239, 68, 68, 0.32)' : 'rgba(239, 68, 68, 0.25)';
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
  const isSmallExplicit = (
    parseDimension(wrapperStyle?.width) <= 96 ||
    parseDimension(wrapperStyle?.height) <= 96 ||
    parseDimension(style?.width) <= 96 ||
    parseDimension(style?.height) <= 96
  );
  const isEffectivelyCompact = compact || !showLabel || isSmallExplicit || measuredSmall;

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
        ref={containerRef}
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
          <div style={{ marginTop: '0.4rem', textAlign: 'center', maxWidth: '90%', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: emptyTextColor, lineHeight: 1.25, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {finalEmptyLabel}
            </div>
            {emptySubLabel && (
              <div style={{ fontSize: '0.66rem', color: emptySubColor, marginTop: '0.15rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
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
        ref={containerRef}
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
          <div style={{ marginTop: '0.35rem', textAlign: 'center', maxWidth: '90%', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: errorTextColor, lineHeight: 1.25, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {finalErrorLabel}
            </div>
            {errorSubLabel && (
              <div style={{ fontSize: '0.65rem', color: errorSubColor, marginTop: '0.15rem', lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
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
      ref={containerRef}
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
