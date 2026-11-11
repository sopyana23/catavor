import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

export interface ProofLightboxProps {
  imageUrl: string;
  onClose: () => void;
  isMobile?: boolean;
}

export const ProofLightbox: React.FC<ProofLightboxProps> = ({
  imageUrl,
  onClose,
  isMobile = false
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(true);

  // Tablet form-factor detection: Tablet Mini (< 880px) vs Wide Tablet (>= 880px)
  const [isWideTablet, setIsWideTablet] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 880 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsWideTablet(window.innerWidth >= 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1.0);
  const lastTapRef = useRef<number>(0);
  const touchMovedRef = useRef<boolean>(false);
  const mouseMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setShowHint(false);
    setZoom((prev) => Math.min(4.0, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setShowHint(false);
    setZoom((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next <= 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setShowHint(true);
  };

  // Keyboard shortcut listener (Esc to close, +/- to zoom, 0 to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Non-passive wheel event listener to support scroll and ctrl+scroll zoom without zooming the entire page
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowHint(false);

      const factor = e.ctrlKey || e.metaKey ? 0.2 : 0.15;
      if (e.deltaY < 0) {
        setZoom((prev) => Math.min(4.0, +(prev + factor).toFixed(2)));
      } else {
        setZoom((prev) => {
          const next = Math.max(0.5, +(prev - factor).toFixed(2));
          if (next <= 1.0) setPan({ x: 0, y: 0 });
          return next;
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseMovedRef.current = false;
    if (zoom <= 1.0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    mouseMovedRef.current = true;
    setShowHint(false);
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers (Pinch to Zoom, Drag to Pan, Double Tap, and Tap to toggle hint)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchMovedRef.current = false;
    if (e.touches.length === 2) {
      setShowHint(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialZoomRef.current = zoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setShowHint(false);
        if (zoom > 1.0) {
          handleResetZoom();
        } else {
          setZoom(2.2);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (zoom > 1.0) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      touchMovedRef.current = true;
      setShowHint(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistRef.current;
      const nextZoom = Math.min(4.0, Math.max(0.5, +(initialZoomRef.current * factor).toFixed(2)));
      setZoom(nextZoom);
    } else if (e.touches.length === 1 && isDragging && zoom > 1.0) {
      touchMovedRef.current = true;
      setShowHint(false);
      setPan({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialPinchDistRef.current = null;
    setIsDragging(false);

    // Single clean tap without moving: toggle hint visibility
    if (e.changedTouches.length === 1 && !touchMovedRef.current) {
      setShowHint((prev) => !prev);
    }
  };

  // Click on viewer area (for mouse/touch non-drag click)
  const handleViewerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mouseMovedRef.current && !touchMovedRef.current) {
      setShowHint((prev) => !prev);
    }
  };

  const btnSize = isWideTablet ? '44px' : '38px';
  const iconSize = isWideTablet ? 20 : 18;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#050811',
        backdropFilter: 'blur(8px)',
        zIndex: 1000000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* FLOATING TOP TOOLBAR */}
      <div
        style={{
          position: 'absolute',
          top: isWideTablet ? '1.5rem' : '1.25rem',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: isWideTablet ? '0.6rem' : '0.45rem',
          padding: isWideTablet ? '0.45rem 0.95rem' : '0.35rem 0.75rem',
          borderRadius: '999px',
          background: 'rgba(30, 41, 59, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          title="Zoom Out (-)"
          style={{
            width: btnSize,
            height: btnSize,
            borderRadius: '999px',
            background: 'transparent',
            border: 'none',
            color: zoom <= 0.5 ? 'rgba(255,255,255,0.3)' : '#ffffff',
            cursor: zoom <= 0.5 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ZoomOut size={iconSize} />
        </button>

        <span
          onClick={handleResetZoom}
          title="Klik untuk reset zoom (100%)"
          style={{
            fontSize: isWideTablet ? '0.92rem' : '0.82rem',
            fontWeight: 800,
            color: '#38bdf8',
            fontFamily: 'monospace',
            minWidth: isWideTablet ? '56px' : '48px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
        >
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 4.0}
          title="Zoom In (+)"
          style={{
            width: btnSize,
            height: btnSize,
            borderRadius: '999px',
            background: 'transparent',
            border: 'none',
            color: zoom >= 4.0 ? 'rgba(255,255,255,0.3)' : '#ffffff',
            cursor: zoom >= 4.0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ZoomIn size={iconSize} />
        </button>

        <div style={{ width: '1px', height: isWideTablet ? '22px' : '18px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.15rem' }} />

        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset Zoom (0)"
          style={{
            minHeight: isWideTablet ? '40px' : '36px',
            padding: isWideTablet ? '0.4rem 0.95rem' : '0.35rem 0.75rem',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#cbd5e1',
            fontSize: isWideTablet ? '0.82rem' : '0.76rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <RotateCcw size={isWideTablet ? 15 : 14} />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Tutup (Esc)"
          style={{
            minHeight: isWideTablet ? '40px' : '36px',
            padding: isWideTablet ? '0.4rem 1.15rem' : '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            fontSize: isWideTablet ? '0.82rem' : '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginLeft: '0.2rem'
          }}
        >
          <X size={isWideTablet ? 17 : 15} />
          <span>Tutup</span>
        </button>
      </div>

      {/* IMAGE VIEWER AREA */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: zoom > 1.0 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleViewerClick}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            transformOrigin: 'center center',
            maxWidth: '85%',
            maxHeight: '82vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src={imageUrl}
            alt="Foto Bukti Pembayaran"
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: '0.5rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {/* BOTTOM HELPER HINT (Auto-hides on zoom/drag, reappears on tap) */}
      <div
        style={{
          position: 'absolute',
          bottom: isWideTablet ? '1.75rem' : '1.35rem',
          zIndex: 10,
          padding: isWideTablet ? '0.55rem 1.35rem' : '0.45rem 1.05rem',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#e2e8f0',
          fontSize: isWideTablet ? '0.82rem' : '0.76rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          pointerEvents: showHint ? 'auto' : 'none',
          opacity: showHint ? 1 : 0,
          transform: showHint ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          textAlign: 'center',
          maxWidth: '90%'
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowHint(false);
        }}
      >
        <span>Cubit 2 jari / scroll untuk zoom • Ketuk 2x untuk toggle • Geser foto saat diperbesar</span>
      </div>
    </div>
  );
};
