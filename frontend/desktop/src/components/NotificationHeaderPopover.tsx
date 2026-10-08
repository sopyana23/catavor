import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ShieldAlert,
  LifeBuoy,
  Sparkles,
  Package,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Inbox,
  X
} from 'lucide-react';
import { normalizeNotification, type NormalizedNotification } from '../utils/notificationHelpers';

export interface NotificationHeaderPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  unreadCount: number;
  onMarkAsRead: (id: string | number) => void;
  onMarkAllAsRead: () => void;
  onSelectNotification: (notif: any) => void;
  onViewAllNotifications: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const NotificationHeaderPopover: React.FC<NotificationHeaderPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectNotification,
  onViewAllNotifications,
  triggerRef
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  // Normalize list & apply quick filter
  const normalizedList = useMemo(() => {
    const list = (notifications || []).map(normalizeNotification);
    if (filter === 'unread') {
      return list.filter(n => !n.read);
    }
    return list;
  }, [notifications, filter]);

  if (!isOpen) return null;

  const renderIcon = (norm: NormalizedNotification) => {
    if (norm.modCase.isRestored) {
      return <CheckCircle2 size={15} color="#10b981" />;
    }
    if (norm.isModerationNotif) {
      return <ShieldAlert size={15} color="#f43f5e" />;
    }
    if (norm.isTicketNotif) {
      return <LifeBuoy size={15} color="#38bdf8" />;
    }
    if (norm.category === 'FITUR & PROMO' || norm.type === 'success') {
      return <Sparkles size={15} color="#a855f7" />;
    }
    if (norm.category === 'INVENTARIS' || norm.type === 'order') {
      return <Package size={15} color="#10b981" />;
    }
    return <Bell size={15} color={norm.read ? '#94a3b8' : 'var(--primary)'} />;
  };

  return (
    <div
      ref={popoverRef}
      className="animate-scale-up"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: '420px',
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: '1rem',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 16, 26, 0.99) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
        zIndex: 1200,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '1rem 1.25rem 0.85rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              border: '1px solid var(--primary-glow)'
            }}
          >
            <Bell size={15} />
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Notifikasi
          </span>
          {unreadCount > 0 ? (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.35)'
              }}
            >
              {unreadCount} Baru
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}
            >
              Semua Dibaca
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              title="Tandai semua sebagai sudah dibaca"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.55rem',
                borderRadius: '0.4rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              <CheckCheck size={14} />
              <span>Tandai dibaca</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.35rem'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. Filter Pills Toolbar */}
      <div
        style={{
          padding: '0.5rem 1.25rem',
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border-light)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}
      >
        <button
          type="button"
          onClick={() => setFilter('all')}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            border: filter === 'all' ? '1px solid var(--primary)' : '1px solid transparent',
            backgroundColor: filter === 'all' ? 'var(--primary-glow)' : 'transparent',
            color: filter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Semua ({(notifications || []).length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('unread')}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            border: filter === 'unread' ? '1px solid #ef4444' : '1px solid transparent',
            backgroundColor: filter === 'unread' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            color: filter === 'unread' ? '#ef4444' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Belum Dibaca ({unreadCount})
        </button>
      </div>

      {/* 3. Notification List Feed */}
      <div
        style={{
          maxHeight: '360px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.4rem 0'
        }}
      >
        {normalizedList.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                color: 'var(--text-muted)'
              }}
            >
              <Inbox size={22} />
            </div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {filter === 'unread' ? 'Semua notifikasi telah dibaca' : 'Belum ada notifikasi'}
            </strong>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '240px' }}>
              {filter === 'unread'
                ? 'Tidak ada pemberitahuan baru yang membutuhkan perhatian Anda.'
                : 'Pemberitahuan penting toko dan sistem akan muncul di sini.'}
            </p>
          </div>
        ) : (
          normalizedList.slice(0, 10).map((norm) => (
            <div
              key={norm.id}
              onClick={() => {
                onMarkAsRead(norm.id);
                onClose();
                onSelectNotification(norm.item);
              }}
              style={{
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: norm.read ? 'transparent' : 'rgba(255, 255, 255, 0.035)',
                borderLeft: norm.read
                  ? '3px solid transparent'
                  : `3px solid ${norm.categoryColor}`,
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = norm.read ? 'transparent' : 'rgba(255, 255, 255, 0.035)';
              }}
            >
              {/* Category Icon Squircle */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.55rem',
                  backgroundColor: norm.categoryBg,
                  border: `1px solid ${norm.categoryBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.1rem'
                }}
              >
                {renderIcon(norm)}
              </div>

              {/* Text Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: norm.categoryColor
                    }}
                  >
                    {norm.category}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {norm.time}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.83rem',
                    fontWeight: norm.read ? 600 : 800,
                    color: norm.read ? 'var(--text-secondary)' : 'var(--text-primary)',
                    marginBottom: '0.2rem',
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {norm.title}
                </div>

                <p
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {norm.message}
                </p>

                {norm.displayLabel && (
                  <div
                    style={{
                      marginTop: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: norm.categoryColor
                    }}
                  >
                    <span>{norm.displayLabel}</span>
                    {norm.displayType === 'external' ? (
                      <ExternalLink size={10} />
                    ) : (
                      <ChevronRight size={10} />
                    )}
                  </div>
                )}
              </div>

              {/* Trailing Unread Dot / Action Indicator */}
              <div style={{ flexShrink: 0, paddingTop: '0.35rem' }}>
                {!norm.read ? (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: norm.categoryColor,
                      display: 'block',
                      boxShadow: `0 0 8px ${norm.categoryColor}`
                    }}
                  />
                ) : (
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Footer Bar */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            onViewAllNotifications();
          }}
          style={{
            width: '100%',
            padding: '0.55rem 1rem',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-glow)';
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
        >
          <span>Buka Pusat Notifikasi Lengkap</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};

export default NotificationHeaderPopover;
