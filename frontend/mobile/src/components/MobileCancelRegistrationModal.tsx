import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface MobileCancelRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const MobileCancelRegistrationModal: React.FC<MobileCancelRegistrationModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const pointerStartYRef = useRef<number>(0);
  const currentDragYRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);

  const closeWithAnimation = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    isDraggingRef.current = false;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      sheetRef.current.style.transform = 'translateY(100%)';
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      backdropRef.current.style.opacity = '0';
    }

    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  useModalBackHandler({
    isOpen: isOpen && !isClosing,
    onClose: closeWithAnimation,
    modalId: 'mobile-cancel-registration'
  });

  // Entrance animation on mount / isOpen
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;

      const frameId = requestAnimationFrame(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
          sheetRef.current.style.transform = 'translateY(0px)';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'opacity 0.24s ease-out';
          backdropRef.current.style.opacity = '1';
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [isOpen]);

  // Keyboard shortcut (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWithAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isClosing) return;
    // Don't drag if tapping interactive buttons
    if ((e.target as HTMLElement).closest('button, a, input')) return;

    isDraggingRef.current = true;
    pointerStartYRef.current = e.clientY;
    currentDragYRef.current = 0;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.cursor = 'grabbing';
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || isClosing) return;

    const delta = e.clientY - pointerStartYRef.current;
    let targetY = 0;

    if (delta > 0) {
      // Dragging DOWN: 1:1 direct smooth finger tracking
      targetY = delta;
    } else {
      // Dragging UP: Stiff asymptotic rubber-band curve strictly capped at -24px
      // Prevents the modal from floating or exposing empty space beneath
      targetY = Math.max(-24, (delta * 24) / (60 + Math.abs(delta)));
    }

    currentDragYRef.current = targetY;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    animationFrameId.current = requestAnimationFrame(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${targetY}px)`;
      }
      if (backdropRef.current && targetY > 0) {
        const opacityRatio = Math.max(0.2, 1 - (targetY / 320));
        backdropRef.current.style.opacity = String(opacityRatio);
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (sheetRef.current) {
      sheetRef.current.style.cursor = 'grab';
    }

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    // Dismiss threshold: dragged down >= 70px triggers smooth exit
    if (currentDragYRef.current >= 70) {
      closeWithAnimation();
    } else {
      // Natural spring back to resting position
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        backdropRef.current.style.opacity = '1';
      }
      currentDragYRef.current = 0;
    }
  };

  if (!isOpen && !isClosing) return null;

  return createPortal(
    <div
      ref={backdropRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100015,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: 0,
        touchAction: 'none',
        overflow: 'hidden'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeWithAnimation();
        }
      }}
    >
      <div
        ref={sheetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '100%',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          borderBottom: 'none',
          boxShadow: '0 -12px 48px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.65rem 0 calc(1.75rem + env(safe-area-inset-bottom, 16px) + 120px) 0',
          marginBottom: '-120px',
          transform: 'translateY(100%)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'grab',
          willChange: 'transform'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Smooth Drag Handle Area */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '0.35rem 0 0.65rem',
            touchAction: 'none',
            cursor: 'inherit'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '5px',
              backgroundColor: '#cbd5e1',
              borderRadius: '999px',
              opacity: 0.95
            }}
          />
        </div>

        {/* Header (Vector Icon & Title, Clean Anti-X standard) */}
        <div
          style={{
            padding: '0 1.25rem 0.75rem',
            borderBottom: '1px solid #e2e8f0',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={18} color="#dc2626" />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.01em'
                }}
              >
                Batalkan Pendaftaran?
              </h3>
            </div>
          </div>
        </div>

        {/* Sheet Body Content */}
        <div style={{ padding: '1rem 1.25rem 0.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: '#64748b',
              lineHeight: 1.5
            }}
          >
            Seluruh data profil usaha dan draf paket yang telah Anda isi akan dihapus. Anda akan diarahkan kembali ke Beranda.
          </p>

          {/* Action Buttons Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.35rem' }}>
            {/* Destructive Primary: Ya, Batalkan Pendaftaran */}
            <button
              type="button"
              onClick={() => {
                if (isClosing) return;
                onConfirm();
              }}
              style={{
                height: '46px',
                width: '100%',
                borderRadius: '0.85rem',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
            >
              <Trash2 size={17} />
              <span>Ya, Batalkan Pendaftaran</span>
            </button>

            {/* Secondary: Lanjutkan Pembayaran */}
            <button
              type="button"
              onClick={closeWithAnimation}
              style={{
                height: '44px',
                width: '100%',
                borderRadius: '0.85rem',
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#334155',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
            >
              <span>Lanjutkan Pembayaran</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

