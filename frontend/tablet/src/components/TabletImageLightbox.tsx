import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import { DEFAULT_PRODUCT_PLACEHOLDER } from '../constants';

export interface TabletImageLightboxProps {
  isOpen: boolean;
  images: string[];
  initialIndex?: number;
  productName?: string;
  onClose: () => void;
}

export const TabletImageLightbox: React.FC<TabletImageLightboxProps> = ({
  isOpen,
  images,
  initialIndex = 0,
  productName,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch gesture state for tablet (pinch-to-zoom & swipe)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialTouchDistRef = useRef<number | null>(null);
  const initialTouchScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  // Sync initialIndex when lightbox opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, initialIndex, images.length]);

  // Reset zoom & pan when image index changes
  const switchImage = useCallback((newIndex: number) => {
    if (images.length === 0) return;
    const clampedIndex = (newIndex + images.length) % images.length;
    setCurrentIndex(clampedIndex);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, [images.length]);

  // LIFO smart back navigation: closes ONLY the lightbox, keeping parent modal/sheet open!
  useModalBackHandler({
    isOpen,
    onClose,
    modalId: 'tablet_image_lightbox'
  });

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomScale(prev => Math.min(4, Math.round((prev + 0.5) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale(prev => {
      const next = Math.max(1, Math.round((prev - 0.5) * 10) / 10);
      if (next <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const handleToggleZoom = useCallback(() => {
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      setZoomScale(2.5);
    }
  }, [zoomScale, handleResetZoom]);

  // Keyboard navigation (Arrow keys and Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        switchImage(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        switchImage(currentIndex + 1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, switchImage, handleZoomIn, handleZoomOut, handleResetZoom, onClose]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomScale(prev => Math.min(4, Math.round((prev + 0.25) * 100) / 100));
    } else {
      setZoomScale(prev => {
        const next = Math.max(1, Math.round((prev - 0.25) * 100) / 100);
        if (next <= 1) {
          setPanPosition({ x: 0, y: 0 });
        }
        return next;
      });
    }
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomScale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
    }
  }, [zoomScale, panPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoomScale > 1) {
      e.preventDefault();
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, zoomScale, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch gesture handlers for Tablet touch screens
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      initialTouchDistRef.current = dist;
      initialTouchScaleRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      // Double tap detector (< 300ms)
      if (now - lastTapRef.current < 300) {
        handleToggleZoom();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now
      };

      if (zoomScale > 1) {
        setIsDragging(true);
        setDragStart({
          x: touch.clientX - panPosition.x,
          y: touch.clientY - panPosition.y
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistRef.current !== null) {
      // Pinch to zoom active
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const factor = dist / initialTouchDistRef.current;
      const nextScale = Math.min(4, Math.max(1, initialTouchScaleRef.current * factor));
      setZoomScale(Math.round(nextScale * 100) / 100);
      if (nextScale <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      const touch = e.touches[0];
      setPanPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (initialTouchDistRef.current !== null) {
      initialTouchDistRef.current = null;
    }

    if (isDragging) {
      setIsDragging(false);
    }

    // Horizontal swipe navigation when not zoomed
    if (zoomScale <= 1 && touchStartRef.current && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Check if quick horizontal swipe (> 60px distance within 350ms, mostly horizontal)
      if (deltaTime < 350 && Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          switchImage(currentIndex + 1);
        } else {
          switchImage(currentIndex - 1);
        }
      }
    }
    touchStartRef.current = null;
  };

  if (!isOpen || images.length === 0) return null;

  const currentImageUrl = images[currentIndex] || images[0];

  return (
    <div
      className="modal-overlay"
      id="tablet-image-lightbox-overlay"
      data-testid="tablet-image-lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 10010,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Top Floating Pill Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '0.65rem',
          backgroundColor: 'rgba(18, 24, 27, 0.85)',
          padding: '0.45rem 1.15rem',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
          alignItems: 'center',
          zIndex: 10020
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoomScale <= 1}
          style={{
            padding: '0.35rem 0.55rem',
            color: zoomScale <= 1 ? 'rgba(255,255,255,0.35)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '0.35rem',
            cursor: zoomScale <= 1 ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s ease'
          }}
          title="Perkecil (Zoom Out)"
        >
          <ZoomOut size={16} />
        </button>

        {/* Zoom Reset / Current Scale Indicator */}
        <button
          type="button"
          onClick={handleResetZoom}
          style={{
            fontSize: '0.8rem',
            color: zoomScale > 1 ? '#10b981' : '#ffffff',
            fontWeight: 700,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '999px',
            padding: '0.2rem 0.65rem',
            cursor: zoomScale > 1 ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
          title={zoomScale > 1 ? 'Klik untuk reset zoom (100%)' : 'Skala saat ini'}
        >
          {zoomScale > 1 && <RotateCcw size={11} />}
          <span>{Math.round(zoomScale * 100)}%</span>
        </button>

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoomScale >= 4}
          style={{
            padding: '0.35rem 0.55rem',
            color: zoomScale >= 4 ? 'rgba(255,255,255,0.35)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '0.35rem',
            cursor: zoomScale >= 4 ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s ease'
          }}
          title="Perbesar (Zoom In)"
        >
          <ZoomIn size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

        {/* Photo Counter */}
        <span style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      {/* Top Right Close Button */}
      <button
        type="button"
        id="btn-close-tablet-lightbox"
        data-testid="btn-close-tablet-lightbox"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.25rem',
          right: '1.25rem',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10020,
          transition: 'all 0.15s ease'
        }}
        title="Tutup Pratinjau Gambar"
      >
        <X size={20} />
      </button>

      {/* Main Interactive Visual Canvas */}
      <div
        style={{
          width: '92vw',
          height: images.length > 1 ? '72vh' : '82vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* Previous Image Button */}
        {images.length > 1 && (
          <button
            type="button"
            id="btn-lightbox-prev"
            data-testid="btn-lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              switchImage(currentIndex - 1);
            }}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10015,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'rgba(18, 24, 27, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background-color 0.15s ease'
            }}
            title="Foto Sebelumnya"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        {/* Next Image Button */}
        {images.length > 1 && (
          <button
            type="button"
            id="btn-lightbox-next"
            data-testid="btn-lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              switchImage(currentIndex + 1);
            }}
            style={{
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10015,
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'rgba(18, 24, 27, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'background-color 0.15s ease'
            }}
            title="Foto Berikutnya"
          >
            <ChevronRight size={26} />
          </button>
        )}

        {/* The Zoomable & Pannable Image Area */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleToggleZoom();
          }}
        >
          <img
            src={currentImageUrl}
            alt={productName || 'Pratinjau Foto Produk'}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))'
            }}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_PRODUCT_PLACEHOLDER;
            }}
          />
        </div>
      </div>

      {/* Bottom Thumbnail Strip if Multiple Images */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            zIndex: 10015,
            backgroundColor: 'rgba(18, 24, 27, 0.85)',
            padding: '0.45rem 0.65rem',
            borderRadius: '0.85rem',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            maxWidth: '88vw',
            overflowX: 'auto',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((imgUrl, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => switchImage(idx)}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  border: isActive ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
                  opacity: isActive ? 1 : 0.6,
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                  backgroundColor: 'transparent',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.15s ease'
                }}
              >
                <img
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PRODUCT_PLACEHOLDER;
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
