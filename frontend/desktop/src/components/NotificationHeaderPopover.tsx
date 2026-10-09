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

/**
 * Format timestamp into clean, modern relative time (e.g. "5 mnt lalu", "2 jam lalu", "Kemarin", "30 Sep")
 */
function formatRelativeTime(raw: string | number | undefined): string {
  if (!raw) return 'Baru saja';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hr lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
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

  // Industry Best Practice: Dropdown popover displays the top 5 most recent notifications
  const displayedList = useMemo(() => {
    return normalizedList.slice(0, 5);
  }, [normalizedList]);

  if (!isOpen) return null;

  const renderIcon = (norm: NormalizedNotification) => {
    if (norm.modCase.isRestored) {
      return <CheckCircle2 size={14} color="#10b981" />;
    }
    if (norm.isModerationNotif) {
      return <ShieldAlert size={14} color="#f43f5e" />;
    }
    if (norm.isTicketNotif) {
      return <LifeBuoy size={14} color="#38bdf8" />;
    }
    if (norm.category === 'FITUR & PROMO' || norm.type === 'success') {
      return <Sparkles size={14} color="#a855f7" />;
    }
    if (norm.category === 'INVENTARIS' || norm.type === 'order') {
      return <Package size={14} color="#10b981" />;
    }
    return <Bell size={14} color={norm.read ? 'var(--text-muted)' : 'var(--primary)'} />;
  };

  return (
    <div
      ref={popoverRef}
      className="animate-scale-up"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: '400px',
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: '1rem',
        backgroundColor: 'var(--bg-card)',
        backgroundImage: 'var(--card-bg-gradient, none)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-premium, 0 20px 45px rgba(0, 0, 0, 0.5)), 0 0 1px 1px var(--border-light)',
        color: 'var(--text-primary)',
        zIndex: 1200,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. Header Bar - Dynamic Theme Styling */}
      <div
        style={{
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card-hover)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
            <Bell size={14} />
          </div>
          <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Notifikasi
          </span>
          {unreadCount > 0 ? (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              {unreadCount} Baru
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-glow)'
              }}
            >
              Semua Dibaca
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              title="Tandai semua sebagai sudah dibaca"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.4rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'var(--primary-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
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
              borderRadius: '0.35rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. Filter Pills Toolbar - Best Practice Quick Switcher */}
      <div
        style={{
          padding: '0.45rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border-light)',
          backgroundColor: 'rgba(0, 0, 0, 0.04)'
        }}
      >
        <button
          type="button"
          onClick={() => setFilter('all')}
          style={{
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            border: filter === 'all' ? '1px solid var(--primary)' : '1px solid transparent',
            backgroundColor: filter === 'all' ? 'var(--primary-glow)' : 'transparent',
            color: filter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (filter !== 'all') e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
          }}
          onMouseLeave={(e) => {
            if (filter !== 'all') e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Terbaru
        </button>

        <button
          type="button"
          onClick={() => setFilter('unread')}
          style={{
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            border: filter === 'unread' ? '1px solid var(--primary)' : '1px solid transparent',
            backgroundColor: filter === 'unread' ? 'var(--primary-glow)' : 'transparent',
            color: filter === 'unread' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
          onMouseEnter={(e) => {
            if (filter !== 'unread') e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
          }}
          onMouseLeave={(e) => {
            if (filter !== 'unread') e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>Belum Dibaca</span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: '0.62rem',
                padding: '0.05rem 0.35rem',
                borderRadius: '999px',
                backgroundColor: filter === 'unread' ? 'var(--primary)' : 'rgba(239, 68, 68, 0.15)',
                color: filter === 'unread' ? '#ffffff' : '#ef4444',
                fontWeight: 800
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Notification Feed - Minimalist, Scannable & Actionable */}
      <div
        style={{
          maxHeight: '340px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.35rem 0.5rem'
        }}
      >
        {displayedList.length === 0 ? (
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
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                color: filter === 'unread' ? 'var(--primary)' : 'var(--text-muted)'
              }}
            >
              {filter === 'unread' ? <CheckCircle2 size={20} /> : <Inbox size={20} />}
            </div>
            <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {filter === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}
            </strong>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '240px', lineHeight: 1.4 }}>
              {filter === 'unread'
                ? 'Tidak ada pemberitahuan baru yang belum dibaca.'
                : 'Pemberitahuan aktivitas dan sistem toko akan muncul di sini.'}
            </p>
          </div>
        ) : (
          displayedList.map((norm) => (
            <div
              key={norm.id}
              onClick={() => {
                onMarkAsRead(norm.id);
                onClose();
                onSelectNotification(norm.item);
              }}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '0.65rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: !norm.read ? 'var(--primary-glow)' : 'transparent',
                borderLeft: !norm.read ? '3px solid var(--primary)' : '3px solid transparent',
                marginBottom: '0.2rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = !norm.read ? 'var(--primary-glow)' : 'transparent';
              }}
            >
              {/* Category Icon Badge */}
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '0.5rem',
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

              {/* Text Body - Scannable & Clean */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.15rem' }}>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      color: norm.categoryColor
                    }}
                  >
                    {norm.category}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(norm.item.created_at || norm.item.timestamp || norm.time)}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: !norm.read ? 750 : 600,
                    color: !norm.read ? 'var(--text-primary)' : 'var(--text-secondary)',
                    marginBottom: '0.15rem',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {norm.title}
                </div>

                <p
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    opacity: 0.85
                  }}
                >
                  {norm.message}
                </p>
              </div>

              {/* Trailing Unread Dot / Action Indicator */}
              <div style={{ flexShrink: 0, paddingTop: '0.4rem' }}>
                {!norm.read ? (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      display: 'block',
                      boxShadow: '0 0 6px var(--primary)'
                    }}
                  />
                ) : (
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info indicator if more items exist */}
      {normalizedList.length > 5 && (
        <div
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '0.2rem 0',
            backgroundColor: 'rgba(0, 0, 0, 0.02)'
          }}
        >
          Menampilkan 5 notifikasi terbaru
        </div>
      )}

      {/* 4. Footer Bar - Primary Theme CTA */}
      <div
        style={{
          padding: '0.65rem 1rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card-hover)',
          display: 'flex',
          alignItems: 'center'
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
            borderRadius: '0.6rem',
            backgroundColor: 'var(--primary)',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: '0 2px 10px var(--primary-glow)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'none';
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
