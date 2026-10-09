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

  // Industry Best Practice: Dropdown popover displays top 5 most recent notifications
  const displayedList = useMemo(() => {
    return normalizedList.slice(0, 5);
  }, [normalizedList]);

  if (!isOpen) return null;

  const renderIcon = (norm: NormalizedNotification) => {
    if (norm.modCase.isRestored) {
      return <CheckCircle2 size={15} color="#059669" />;
    }
    if (norm.isModerationNotif) {
      return <ShieldAlert size={15} color="#dc2626" />;
    }
    if (norm.isTicketNotif) {
      return <LifeBuoy size={15} color="#0284c7" />;
    }
    if (norm.category === 'FITUR & PROMO' || norm.type === 'success') {
      return <Sparkles size={15} color="#7c3aed" />;
    }
    if (norm.category === 'INVENTARIS' || norm.type === 'order') {
      return <Package size={15} color="#059669" />;
    }
    return <Bell size={15} color={norm.read ? 'var(--text-muted)' : 'var(--primary)'} />;
  };

  return (
    <div
      ref={popoverRef}
      className="animate-scale-up"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: '415px',
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: '1rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-hover, var(--border-light))',
        boxShadow: '0 24px 50px -10px rgba(0, 0, 0, 0.24), 0 10px 20px -5px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--border-hover, rgba(0, 0, 0, 0.12))',
        color: 'var(--text-primary)',
        zIndex: 1200,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. Header Bar - High-Contrast Header */}
      <div
        style={{
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid var(--border-hover, var(--border-light))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              border: '1px solid var(--border-hover, var(--border-light))'
            }}
          >
            <Bell size={15} />
          </div>
          <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Notifikasi
          </span>
          {unreadCount > 0 ? (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              {unreadCount} Baru
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.3)'
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
                fontSize: '0.74rem',
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
              padding: '0.35rem',
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

      {/* 2. Filter Segmented Switcher - Distinct Tactical Depth */}
      <div
        style={{
          padding: '0.55rem 0.85rem',
          borderBottom: '1px solid var(--border-hover, var(--border-light))',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card-hover)',
            padding: '3px',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            gap: '3px'
          }}
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              flex: 1,
              padding: '0.35rem 0.75rem',
              borderRadius: '0.45rem',
              fontSize: '0.74rem',
              fontWeight: filter === 'all' ? 800 : 600,
              border: filter === 'all' ? '1px solid var(--border-hover, var(--border-light))' : '1px solid transparent',
              backgroundColor: filter === 'all' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: filter === 'all' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Terbaru
          </button>

          <button
            type="button"
            onClick={() => setFilter('unread')}
            style={{
              flex: 1,
              padding: '0.35rem 0.75rem',
              borderRadius: '0.45rem',
              fontSize: '0.74rem',
              fontWeight: filter === 'unread' ? 800 : 600,
              border: filter === 'unread' ? '1px solid var(--border-hover, var(--border-light))' : '1px solid transparent',
              backgroundColor: filter === 'unread' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'unread' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: filter === 'unread' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Belum Dibaca</span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '999px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Notification Feed - Elevated Distinct Cards */}
      <div
        style={{
          maxHeight: '340px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.45rem 0.65rem'
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
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-hover, var(--border-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                color: filter === 'unread' ? 'var(--primary)' : 'var(--text-muted)'
              }}
            >
              {filter === 'unread' ? <CheckCircle2 size={22} /> : <Inbox size={22} />}
            </div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {filter === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}
            </strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '240px', lineHeight: 1.4 }}>
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
                padding: '0.75rem 0.85rem',
                borderRadius: '0.65rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: !norm.read ? 'var(--primary-glow)' : 'var(--bg-card)',
                border: !norm.read
                  ? '1px solid var(--primary)'
                  : '1px solid var(--border-hover, var(--border-light))',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                marginBottom: '0.45rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = !norm.read ? 'var(--primary-glow)' : 'var(--bg-card)';
                e.currentTarget.style.borderColor = !norm.read ? 'var(--primary)' : 'var(--border-hover, var(--border-light))';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
              }}
            >
              {/* Category Icon Badge */}
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

              {/* Text Body - Crisp Typography & Separation */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '0.63rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.35rem',
                      backgroundColor: norm.categoryBg,
                      color: norm.categoryColor,
                      border: `1px solid ${norm.categoryBorder}`
                    }}
                  >
                    {norm.category}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(norm.item.created_at || norm.item.timestamp || norm.time)}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: !norm.read ? 800 : 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.15rem',
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
                    fontSize: '0.73rem',
                    color: 'var(--text-secondary)',
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
              </div>

              {/* Trailing Unread Indicator */}
              <div style={{ flexShrink: 0, paddingTop: '0.35rem' }}>
                {!norm.read ? (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      display: 'block',
                      boxShadow: '0 0 8px var(--primary)'
                    }}
                  />
                ) : (
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
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
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '0.35rem 0',
            borderTop: '1px solid var(--border-hover, var(--border-light))',
            backgroundColor: 'var(--bg-card-hover)'
          }}
        >
          Menampilkan 5 notifikasi terbaru
        </div>
      )}

      {/* 4. Footer Bar - High-Contrast Primary Button */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border-hover, var(--border-light))',
          backgroundColor: 'var(--bg-card)',
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
            padding: '0.65rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--primary)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: '0 4px 14px var(--primary-glow, rgba(0, 0, 0, 0.15))',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.08)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <span>Buka Pusat Notifikasi Lengkap</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default NotificationHeaderPopover;
