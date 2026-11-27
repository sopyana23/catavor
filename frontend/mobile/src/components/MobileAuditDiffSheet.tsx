import React, { useState, useEffect, useRef } from 'react';
import { History, Copy, Check } from 'lucide-react';
import { formatAuditDateTimeWIB } from '../../../shared/audit/auditHelpers';

export interface MobileAuditDiffSheetProps {
  logItem: any | null;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const MobileAuditDiffSheet: React.FC<MobileAuditDiffSheetProps> = ({
  logItem,
  onClose,
  showToast,
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (logItem) {
      setDragY(0);
      setIsDragging(false);
      setIsClosing(false);
      setCopied(false);
    }
  }, [logItem]);

  if (!logItem) return null;

  const triggerSmoothClose = () => {
    setIsDragging(false);
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
    }, 240);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta < 0) {
      setDragY(delta * 0.18);
    } else {
      setDragY(delta);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    startYRef.current = null;
    if (dragY >= 70) {
      triggerSmoothClose();
    } else {
      setDragY(0);
    }
  };

  const hasChanges = Boolean(logItem.changes);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isClosing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'background-color 0.24s ease',
      }}
      onClick={triggerSmoothClose}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '88vh',
          borderTopLeftRadius: '1.35rem',
          borderTopRightRadius: '1.35rem',
          border: '1px solid var(--border-light)',
          borderBottom: 'none',
          background: 'var(--card-bg-gradient, var(--bg-card))',
          boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isClosing ? 'translateY(100%)' : `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag Handle & Clean Header (No Close X per mobile standards) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <div style={{ padding: '0.65rem 0 0.3rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--border-light)' }} />
          </div>

          <div
            style={{
              padding: '0.55rem 1.15rem 0.85rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              backgroundColor: 'var(--bg-deep)',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <History size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                Detail Jejak Aktivitas
              </div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.1rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {logItem.action}
              </h4>
            </div>
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div
          style={{
            padding: '1rem 1.15rem',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
            {logItem.description}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
            <div style={{ padding: '0.65rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aktor</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {logItem.actor_name || 'Sistem'}
              </div>
            </div>
            <div style={{ padding: '0.65rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>Alamat IP</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                {logItem.ip_address || '-'}
              </div>
            </div>
          </div>

          <div style={{ padding: '0.65rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <div>Waktu: <strong style={{ color: 'var(--text-primary)' }}>{formatAuditDateTimeWIB(logItem.created_at)}</strong></div>
            {logItem.entity_title && (
              <div style={{ marginTop: '0.2rem' }}>Target: <strong style={{ color: 'var(--text-primary)' }}>{logItem.entity_title}</strong></div>
            )}
            {logItem.user_agent && (
              <div style={{ marginTop: '0.35rem', fontFamily: 'monospace', fontSize: '0.64rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                UA: {logItem.user_agent}
              </div>
            )}
          </div>

          {hasChanges && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>Snapshot Perubahan (JSON)</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(JSON.stringify(logItem.changes, null, 2));
                      setCopied(true);
                      showToast('Snapshot JSON disalin');
                      window.setTimeout(() => setCopied(false), 2000);
                    } catch {
                      showToast('Gagal menyalin JSON', 'error');
                    }
                  }}
                  style={{
                    minHeight: '36px',
                    background: 'none',
                    border: 'none',
                    color: copied ? '#10b981' : 'var(--primary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Tersalin' : 'Salin JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  backgroundColor: 'var(--bg-deep)',
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: 'var(--primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflowX: 'auto',
                  lineHeight: 1.45,
                }}
              >
                {JSON.stringify(logItem.changes, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderTop: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-deep)',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={triggerSmoothClose}
            style={{
              width: '100%',
              minHeight: '44px',
              borderRadius: '0.75rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
