import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, MessageSquare, X } from 'lucide-react';

export interface ToastItem {
  message: string;
  type?: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface SwipeableToastProps {
  toast: ToastItem | null;
  onClose: () => void;
  position?: 'top' | 'bottom';
  className?: string;
}

export const SwipeableToast: React.FC<SwipeableToastProps> = ({
  toast,
  onClose,
  position = 'top',
  className = '',
}) => {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef<number>(3800);
  const startTimeRef = useRef<number>(Date.now());
  const toastRef = useRef<HTMLDivElement>(null);

  // Setup auto-dismiss timer with pause/resume support
  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    remainingTimeRef.current = duration;
    startTimeRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      triggerDismiss('up');
    }, duration);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(800, remainingTimeRef.current - elapsed);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (!timerRef.current && remainingTimeRef.current > 0) {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        triggerDismiss('up');
      }, remainingTimeRef.current);
    }
  }, []);

  // Trigger dismiss with smooth exit animation and haptic vibration
  const triggerDismiss = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (isExiting) return;
    setIsExiting(true);
    setExitDirection(dir);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Haptic pulse if supported
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {
      // Ignore vibration error on unsupported browsers
    }

    setTimeout(() => {
      onClose();
      setIsExiting(false);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
    }, 220);
  }, [isExiting, onClose]);

  // Reset or initialize when toast changes
  useEffect(() => {
    if (toast) {
      setIsExiting(false);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
      const defaultDuration = toast.actionLabel ? 6000 : 3800;
      startTimer(toast.duration || defaultDuration);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, startTimer]);

  if (!toast) return null;

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    pauseTimer();
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    currentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startPosRef.current.x;
    const dy = touch.clientY - startPosRef.current.y;

    // Apply slight resistance to vertical drag if position is top and dragged downwards
    let effectiveDy = dy;
    if (position === 'top' && dy > 0) {
      effectiveDy = dy * 0.3; // Rubber-band effect downwards when toast is at top
    }

    currentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setDragOffset({ x: dx, y: effectiveDy });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const thresholdX = 50;
    const thresholdY = 35;

    // Check if dismissed horizontally or upward
    if (dx > thresholdX) {
      triggerDismiss('right');
    } else if (dx < -thresholdX) {
      triggerDismiss('left');
    } else if (position === 'top' && dy < -thresholdY) {
      triggerDismiss('up');
    } else if (position === 'bottom' && dy > thresholdY) {
      triggerDismiss('down');
    } else {
      // Spring bounce back to origin
      setDragOffset({ x: 0, y: 0 });
      resumeTimer();
    }
  };

  // Mouse Handlers (for desktop testing or hybrid devices)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    pauseTimer();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    currentPosRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    let effectiveDy = dy;
    if (position === 'top' && dy > 0) {
      effectiveDy = dy * 0.3;
    }

    currentPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: dx, y: effectiveDy });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const thresholdX = 50;
    const thresholdY = 35;

    if (dx > thresholdX) {
      triggerDismiss('right');
    } else if (dx < -thresholdX) {
      triggerDismiss('left');
    } else if (position === 'top' && dy < -thresholdY) {
      triggerDismiss('up');
    } else if (position === 'bottom' && dy > thresholdY) {
      triggerDismiss('down');
    } else {
      setDragOffset({ x: 0, y: 0 });
      resumeTimer();
    }
  };

  // Compute dynamic styling based on gesture state
  const getTransform = () => {
    if (isExiting) {
      switch (exitDirection) {
        case 'right':
          return 'translateX(120vw) translateY(0) rotate(15deg)';
        case 'left':
          return 'translateX(-120vw) translateY(0) rotate(-15deg)';
        case 'up':
          return 'translateX(-50%) translateY(-100px) scale(0.85)';
        case 'down':
          return 'translateX(-50%) translateY(100px) scale(0.85)';
        default:
          return 'translateX(-50%) translateY(-60px) scale(0.9)';
      }
    }

    if (isDragging) {
      const rotation = dragOffset.x * 0.05;
      return `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px) rotate(${rotation}deg)`;
    }

    return 'translateX(-50%) translateY(0) rotate(0deg)';
  };

  const getOpacity = () => {
    if (isExiting) return 0;
    if (isDragging) {
      const distance = Math.sqrt(dragOffset.x * dragOffset.x + dragOffset.y * dragOffset.y);
      return Math.max(0.2, 1 - distance / 160);
    }
    return 1;
  };

  const isSuccess = toast.type === 'success' || !toast.type;
  const isInfo = toast.type === 'info';

  const bgColor = isSuccess
    ? 'rgba(10, 20, 16, 0.94)'
    : isInfo
    ? 'rgba(15, 23, 42, 0.94)'
    : 'rgba(24, 12, 12, 0.94)';

  const borderColor = isSuccess
    ? 'rgba(16, 185, 129, 0.35)'
    : isInfo
    ? 'rgba(56, 189, 248, 0.35)'
    : 'rgba(239, 68, 68, 0.35)';

  const glowShadow = isSuccess
    ? '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 14px rgba(16, 185, 129, 0.25)'
    : isInfo
    ? '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 16px rgba(56, 189, 248, 0.25)'
    : '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 14px rgba(239, 68, 68, 0.25)';

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live="assertive"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`swipeable-toast ${className}`}
      style={{
        position: 'fixed',
        top: position === 'top' ? '18px' : 'auto',
        bottom: position === 'bottom' ? '20px' : 'auto',
        left: '50%',
        transform: getTransform(),
        opacity: getOpacity(),
        transition: isDragging
          ? 'none'
          : isExiting
          ? 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'transform 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease',
        zIndex: 999999,
        padding: '0.52rem 1.05rem',
        borderRadius: '999px',
        backgroundColor: bgColor,
        color: '#f8fafc',
        fontSize: '0.8rem',
        fontWeight: 600,
        boxShadow: glowShadow,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.55rem',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`,
        maxWidth: '92%',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        animation: !isDragging && !isExiting ? 'toast-slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none'
      }}
    >
      {/* Icon based on toast type */}
      {isSuccess ? (
        <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
      ) : isInfo ? (
        <MessageSquare size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
      ) : (
        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
      )}

      {/* Message text */}
      <span
        style={{
          letterSpacing: '0.01em',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '65vw',
        }}
      >
        {toast.message}
      </span>

      {/* Action button if provided */}
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toast.onAction?.();
            triggerDismiss('right');
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.18)',
            border: 'none',
            color: '#ffffff',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginLeft: '0.2rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        >
          {toast.actionLabel}
        </button>
      )}

      {/* Close button that triggers dismiss immediately */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerDismiss('right');
        }}
        aria-label="Tutup Notifikasi"
        title="Tutup (bisa juga diusap)"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.55)',
          padding: '0.1rem',
          marginLeft: '0.15rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          flexShrink: 0,
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)')}
      >
        <X size={14} />
      </button>
    </div>
  );
};
