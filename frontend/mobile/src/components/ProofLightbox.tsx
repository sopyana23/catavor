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
  isMobile = true
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(true);

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
      if (e.target === e.currentTarget && zoom <= 1.0) {
        onClose();
        return;
      }
      setShowHint((prev) => !prev);
    }
  };

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
      {/* FLOATING TOP TOOLBAR (Compact & Ergonomic for Smartphones) */}
      <div
        style={{
          position: 'absolute',
          top: '0.75rem',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.28rem 0.6rem',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
          touchAction: 'manipulation'
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          title="Zoom Out (-)"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            background: 'transparent',
            border: 'none',
            color: zoom <= 0.5 ? 'rgba(255,255,255,0.25)' : '#ffffff',
            cursor: zoom <= 0.5 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ZoomOut size={15} />
        </button>

        <span
          onClick={handleResetZoom}
          title="Klik untuk reset zoom (100%)"
          style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: '#38bdf8',
            fontFamily: 'monospace',
            minWidth: '42px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: '1px 4px',
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
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            background: 'transparent',
            border: 'none',
            color: zoom >= 4.0 ? 'rgba(255,255,255,0.25)' : '#ffffff',
            cursor: zoom >= 4.0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ZoomIn size={15} />
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.18)', margin: '0 0.1rem' }} />

        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset Zoom (0)"
          style={{
            minHeight: '28px',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#cbd5e1',
            fontSize: '0.7rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Tutup (Esc)"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: '28px',
            padding: '0.2rem 0.7rem',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '0.7rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginLeft: '0.15rem'
          }}
        >
          <X size={13} />
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
            maxWidth: '92%',
            maxHeight: '78vh',
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
              maxHeight: '78vh',
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
          bottom: '0.9rem',
          zIndex: 10,
          padding: '0.35rem 0.9rem',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: '#e2e8f0',
          fontSize: '0.71rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          pointerEvents: showHint ? 'auto' : 'none',
          opacity: showHint ? 1 : 0,
          transform: showHint ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          textAlign: 'center',
          maxWidth: '92%'
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowHint(false);
        }}
      >
        <span>Cubit 2 jari untuk zoom • Ketuk 2x untuk perbesar • Geser foto saat diperbesar</span>
      </div>
    </div>
  );
};
