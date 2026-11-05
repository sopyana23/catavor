import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
  MessageCircle,
  Globe,
  ExternalLink,
  ShieldCheck,
  Truck,
  MapPin,
  Download,
  Package,
  Heart,
  Sprout,
  FileCheck
} from 'lucide-react';
import { FormattedText } from './RichTextarea';
import { safeOpenUrl } from '../utils/urlSecurity';
import { parseWAContacts } from './TabletStoreCatalog';

export interface DaySchedule {
  open: string;
  close: string;
  status: 'open' | 'closed';
}

export interface OperationalHoursData {
  mode: 'everyday' | 'weekdays_weekends' | 'custom' | 'manual';
  timezone: string; // 'WIB' | 'WITA' | 'WIT'
  display_text?: string;
  manual_text?: string;
  everyday?: DaySchedule;
  weekdays?: DaySchedule;
  weekends?: DaySchedule;
  days?: Record<string, DaySchedule>;
}

export const INDO_DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

export const DEFAULT_OPERATIONAL_HOURS: OperationalHoursData = {
  mode: 'everyday',
  timezone: 'WIB',
  everyday: { open: '08:00', close: '21:00', status: 'open' },
  weekdays: { open: '08:00', close: '21:00', status: 'open' },
  weekends: { open: '09:00', close: '22:00', status: 'open' },
  days: {
    'Senin': { open: '08:00', close: '21:00', status: 'open' },
    'Selasa': { open: '08:00', close: '21:00', status: 'open' },
    'Rabu': { open: '08:00', close: '21:00', status: 'open' },
    'Kamis': { open: '08:00', close: '21:00', status: 'open' },
    'Jumat': { open: '08:00', close: '21:00', status: 'open' },
    'Sabtu': { open: '09:00', close: '22:00', status: 'open' },
    'Minggu': { open: '09:00', close: '22:00', status: 'open' },
  }
};

export function parseOperationalHours(raw?: string): OperationalHoursData {
  if (!raw || !raw.trim()) {
    return DEFAULT_OPERATIONAL_HOURS;
  }

  const str = raw.trim();

  // Try JSON parse first
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && parsed.mode) {
        return {
          ...DEFAULT_OPERATIONAL_HOURS,
          ...parsed,
          days: { ...DEFAULT_OPERATIONAL_HOURS.days, ...(parsed.days || {}) }
        };
      }
    } catch {
      // ignore & fallback
    }
  }

  // Fallback to manual_text mode
  return {
    ...DEFAULT_OPERATIONAL_HOURS,
    mode: 'manual',
    manual_text: str,
    display_text: str
  };
}

export function getOperationalStatus(data: OperationalHoursData) {
  const now = new Date();
  const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayMap[now.getDay()];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let todaySched: DaySchedule = { open: '08:00', close: '21:00', status: 'open' };

  if (data.days && data.days[todayName]) {
    todaySched = data.days[todayName];
  } else if (data.mode === 'everyday') {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  } else if (data.mode === 'weekdays_weekends') {
    const isWeekend = todayName === 'Sabtu' || todayName === 'Minggu';
    todaySched = isWeekend ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
  } else {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  }

  const isClosed = todaySched.status === 'closed';
  const summaryText = isClosed
    ? `Hari ini (${todayName}): Tutup`
    : `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`;

  if (isClosed) {
    return {
      status: 'closed',
      badgeText: 'Tutup',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): Tutup`,
      todayName
    };
  }

  const [openH, openM] = (todaySched.open || '08:00').split(':').map(Number);
  const [closeH, closeM] = (todaySched.close || '21:00').split(':').map(Number);

  const openMin = (openH || 0) * 60 + (openM || 0);
  const closeMin = (closeH || 0) * 60 + (closeM || 0);

  if (currentMin >= openMin && currentMin < closeMin) {
    return {
      status: 'open',
      badgeText: 'Buka Sekarang',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`,
      todayName
    };
  } else {
    return {
      status: 'closed',
      badgeText: 'Tutup',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`,
      todayName
    };
  }
}

export function OperationalHoursCard({ rawHours }: { rawHours?: string }) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => parseOperationalHours(rawHours), [rawHours]);
  const statusInfo = useMemo(() => getOperationalStatus(data), [data]);

  const getDaySchedule = (dayName: string): DaySchedule => {
    if (data.mode === 'everyday') return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
    if (data.mode === 'weekdays_weekends') {
      const isWk = dayName === 'Sabtu' || dayName === 'Minggu';
      return isWk ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
    }
    if (data.mode === 'custom' && data.days && data.days[dayName]) {
      return data.days[dayName];
    }
    return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  };

  return (
    <div style={{ 
      borderRadius: '0.95rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)', 
      overflow: 'hidden', 
      transition: 'all 0.25s ease', 
      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Banner */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '1.1rem 1.15rem', 
          cursor: 'pointer', 
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          backgroundColor: expanded ? 'var(--bg-card-hover)' : 'transparent',
          transition: 'background-color 0.2s ease'
        }}
      >
        {/* Header Row: Icon + Title + Status Badge Pinned Top Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
              <Clock size={19} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                Jam Operasional
              </h4>
            </div>
          </div>

          <span style={{ 
            fontSize: '0.72rem', 
            fontWeight: 800, 
            padding: '0.28rem 0.7rem', 
            borderRadius: '20px', 
            backgroundColor: statusInfo.badgeBg, 
            color: statusInfo.badgeColor, 
            border: `1px solid ${statusInfo.badgeBorder}`, 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusInfo.badgeColor, display: 'inline-block', boxShadow: `0 0 6px ${statusInfo.badgeColor}` }} />
            {statusInfo.badgeText}
          </span>
        </div>

        {/* Schedule Info Box */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 0.95rem',
          borderRadius: '0.65rem',
          backgroundColor: 'var(--bg-card-hover)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Hari Ini ({statusInfo.todayName})
            </span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {statusInfo.todayScheduleText.split(': ')[1] || statusInfo.todayScheduleText}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '0.55rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: expanded ? 'var(--primary)' : 'var(--primary-glow)',
              color: expanded ? '#ffffff' : 'var(--primary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              minHeight: '36px'
            }}
          >
            <Calendar size={13} style={{ flexShrink: 0 }} />
            <span>{expanded ? 'Tutup' : 'Jadwal 7 Hari'}</span>
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }} />
          </button>
        </div>
      </div>

      {/* Expanded Weekly Schedule Table */}
      {expanded && (
        <div style={{ 
          padding: '0.9rem 1.15rem 1.1rem', 
          borderTop: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card-hover)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.55rem', 
          animation: 'fadeIn 0.2s ease' 
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>RINCIAN JADWAL MINGGUAN ({data.timezone})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {INDO_DAYS_LIST.map((day) => {
              const isToday = day === statusInfo.todayName;
              const daySched = getDaySchedule(day);
              const isClosed = daySched.status === 'closed';

              return (
                <div 
                  key={day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: isToday ? 'var(--primary-glow)' : 'var(--bg-card)',
                    border: isToday ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    boxShadow: isToday ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isToday && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />}
                    <span style={{ color: isToday ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isToday ? 800 : 700 }}>
                      {day}
                    </span>
                  </div>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    color: isClosed ? '#ef4444' : (isToday ? 'var(--primary)' : 'var(--text-primary)'), 
                    fontWeight: isClosed ? 800 : (isToday ? 800 : 700),
                    fontSize: isClosed ? '0.74rem' : '0.78rem',
                    backgroundColor: isClosed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    padding: isClosed ? '0.12rem 0.5rem' : '0',
                    borderRadius: isClosed ? '9999px' : '0',
                    border: isClosed ? '1px solid rgba(239, 68, 68, 0.25)' : 'none'
                  }}>
                    {isClosed ? (
                      <>
                        <AlertCircle size={11} style={{ flexShrink: 0, color: '#ef4444' }} />
                        <span>TUTUP</span>
                      </>
                    ) : (
                      <>
                        <Clock size={11} style={{ flexShrink: 0, opacity: isToday ? 0.9 : 0.45, color: isToday ? 'var(--primary)' : 'var(--text-secondary)' }} />
                        <span>{`${daySched.open} - ${daySched.close} ${data.timezone}`}</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const str = phone.trim();
  if (!str) return '';

  const digits = str.replace(/\D/g, '');
  if (!digits) return str;

  if (digits.startsWith('62')) {
    const main = digits.slice(2);
    const chunks = main.match(/.{1,4}/g) || [];
    return `+62 ${chunks.join(' ')}`;
  }

  if (digits.startsWith('0')) {
    const chunks = digits.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  }

  return str;
}

export function WhatsAppContactsCard({ rawWhatsappNumber, onTrackClick }: { rawWhatsappNumber: string | null | undefined; onTrackClick?: () => void }) {
  const contacts = useMemo(() => parseWAContacts(rawWhatsappNumber), [rawWhatsappNumber]);

  if (contacts.length === 0) return null;

  if (contacts.length === 1) {
    const c = contacts[0];
    const cleanNum = c.number.replace(/\D/g, '');
    return (
      <a 
        href={`https://wa.me/${cleanNum}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onTrackClick?.()}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.85rem', 
          padding: '0.9rem 1.15rem', 
          borderRadius: '0.85rem', 
          border: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card)', 
          textDecoration: 'none', 
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
          <MessageCircle size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, textAlign: 'left', minWidth: 0 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label || 'WhatsApp Official'}</span>
          <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 800 }}>
            {formatPhoneNumber(c.number)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--primary)', color: '#ffffff', padding: '0.45rem 0.85rem', borderRadius: '0.55rem', fontSize: '0.78rem', fontWeight: 800, boxShadow: '0 2px 8px var(--primary-glow)', flexShrink: 0 }}>
          <span>Chat</span>
          <ChevronRight size={14} />
        </div>
      </a>
    );
  }

  return (
    <div style={{ 
      borderRadius: '0.95rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)', 
      padding: '1.15rem',
      boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.9rem'
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-light)', flexShrink: 0 }}>
            <MessageCircle size={19} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              Kontak WhatsApp Official
            </h4>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Layanan Customer Service Resmi
            </p>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {contacts.map((c, idx) => {
          const cleanNum = c.number.replace(/\D/g, '');
          return (
            <a
              key={idx}
              href={`https://wa.me/${cleanNum}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrackClick?.()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.75rem 0.9rem',
                borderRadius: '0.7rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {c.label || `CS ${idx + 1}`}
                  </span>
                </div>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {formatPhoneNumber(c.number)}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.3rem', 
                backgroundColor: 'var(--primary)', 
                color: '#ffffff', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '0.55rem', 
                fontSize: '0.78rem', 
                fontWeight: 800, 
                boxShadow: '0 2px 8px var(--primary-glow)',
                flexShrink: 0
              }}>
                <span>Chat</span>
                <ChevronRight size={13} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export const renderSocialIcon = (platform: string, size = 18, color = 'currentColor') => {
  switch (platform) {
    case 'Instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'Facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'Youtube':
    case 'YouTube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
          <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
        </svg>
      );
    case 'Twitter':
    case 'X':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
        </svg>
      );
    case 'LinkedIn':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case 'Telegram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
};

export const extractSocialHandle = (url: string, platform: string, customLabel?: string): string => {
  if (customLabel && customLabel.trim() !== '') {
    return customLabel.trim();
  }
  if (!url || typeof url !== 'string' || url.trim() === '') return platform;
  
  try {
    let clean = url.trim();
    clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    
    if (clean.includes('wa.me/') || clean.includes('whatsapp.com/')) {
      const num = clean.split('/').filter(Boolean).pop()?.split('?')[0];
      if (num) return `+${num.replace(/\D/g, '')}`;
    }
    
    const parts = clean.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let handle = parts[parts.length - 1];
      handle = handle.split('?')[0].split('#')[0];
      
      if (handle) {
        if (handle.startsWith('@')) return handle;
        if (handle.length < 35 && !handle.includes('.')) {
          return `@${handle}`;
        }
      }
    } else if (parts.length === 1) {
      let handle = parts[0].split('?')[0].split('#')[0];
      if (handle.startsWith('@')) return handle;
    }
  } catch {
    // fallback
  }
  return platform;
};

export function OfficialWebsiteCard({ url, onSafeRedirect }: { url?: string | null; onSafeRedirect?: (url: string) => void }) {
  if (!url || !url.trim()) return null;

  const formattedUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://') 
    ? url.trim() 
    : `https://${url.trim()}`;

  const displayDomain = url.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSafeRedirect) {
      onSafeRedirect(formattedUrl);
    } else {
      safeOpenUrl(formattedUrl);
    }
  };

  return (
    <div style={{
      borderRadius: '0.85rem',
      border: '1px solid var(--border-light)',
      backgroundColor: 'var(--bg-card)',
      overflow: 'hidden',
      transition: 'all 0.25s ease',
      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--primary-glow)', 
          color: 'var(--primary)', 
          flexShrink: 0, 
          border: '1px solid var(--border-light)' 
        }}>
          <Globe size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Website Resmi
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayDomain}
          </span>
        </div>
      </div>

      <a
        href={formattedUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.72rem',
          fontWeight: 800,
          backgroundColor: 'var(--primary-glow)',
          color: 'var(--primary)',
          border: '1px solid var(--border-light)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          minHeight: '36px'
        }}
        title={`Buka situs resmi ${displayDomain}`}
      >
        <span>Kunjungi</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

export function SocialMediaSection({ rawSocialLinks, onSafeRedirect }: { rawSocialLinks?: string | any[] | null; onSafeRedirect?: (url: string) => void }) {
  const validLinks = useMemo(() => {
    if (!rawSocialLinks) return [];
    let parsed: any[] = [];
    if (typeof rawSocialLinks === 'string') {
      try {
        parsed = JSON.parse(rawSocialLinks);
      } catch {
        parsed = [];
      }
    } else if (Array.isArray(rawSocialLinks)) {
      parsed = rawSocialLinks;
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) => item && item.platform && item.url && item.url.trim() !== '');
  }, [rawSocialLinks]);

  if (validLinks.length === 0) return null;

  return (
    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', margin: '0.4rem 0 0.15rem 0' }}>
        <span style={{ height: '1px', flex: 1, backgroundColor: 'var(--border-light)' }}></span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saluran Media Sosial Resmi</span>
        <span style={{ height: '1px', flex: 1, backgroundColor: 'var(--border-light)' }}></span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {validLinks.map((link: any, idx: number) => {
          const handle = extractSocialHandle(link.url, link.platform, link.label);
          const hasHandle = handle && handle !== link.platform;
          const fullUrl = link.url.trim().startsWith('http://') || link.url.trim().startsWith('https://')
            ? link.url.trim()
            : `https://${link.url.trim()}`;

          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            if (onSafeRedirect) {
              onSafeRedirect(fullUrl);
            } else {
              safeOpenUrl(fullUrl);
            }
          };

          return (
            <a
              key={idx}
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                gap: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--primary-glow)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--border-light)',
                  flexShrink: 0
                }}>
                  {renderSocialIcon(link.platform, 18, 'var(--primary)')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {link.platform}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: hasHandle ? 'var(--primary)' : 'var(--text-secondary)', 
                    fontWeight: hasHandle ? 700 : 500,
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    marginTop: '0.1rem' 
                  }}>
                    {hasHandle ? handle : 'Kunjungi Profil Resmi'}
                  </span>
                </div>
              </div>
              
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.35rem', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-glow)',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <span>Buka</span>
                <ExternalLink size={12} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export const cleanEmoji = (text: string) => {
  return text.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}]/gu, '').trim();
};

export const ProductImportantInfoSection: React.FC<{ item: any; isMobile?: boolean }> = ({ item, isMobile = false }) => {
  const pType = item?.product_type || 'fauna';
  const [isExpanded, setIsExpanded] = useState(false);

  const infoItems = useMemo(() => {
    if (!item) return [];
    const list: {
      id: string;
      label: string;
      fullTitle: string;
      icon: any;
      content: string;
    }[] = [];

    // 1. Ketentuan Pengiriman / SOP / Akses File / Ketentuan Layanan / Akses & Survey Properti / Packing Tanaman
    const shippingTerms = (item.detailed_info?.shipping_terms || '').trim();
    if (Boolean(shippingTerms) || pType === 'digital' || pType === 'service' || pType === 'property' || pType === 'food' || pType === 'plant') {
      let label = 'Ketentuan Pengiriman';
      let fullTitle = 'Ketentuan Pengiriman & Logistik';
      let icon = Truck;
      let content = shippingTerms;

      if (pType === 'property') {
        label = 'Akses & Survey';
        fullTitle = 'Akses & Ketentuan Booking / Survey Lokasi';
        icon = MapPin;
        if (!content) {
          content = 'Jadwal kunjungan dan survey unit dapat dikoordinasikan langsung bersama agen/pemilik melalui kontak WhatsApp yang tersedia.';
        }
      } else if (pType === 'fauna') {
        label = 'Pengiriman Hewan';
        fullTitle = 'Pengiriman & Garansi Live Arrival';
        icon = Truck;
      } else if (pType === 'plant') {
        label = 'Pengiriman Tanaman';
        fullTitle = 'Pengiriman & Packing Tanaman Hidup';
        icon = Truck;
        if (!content) {
          content = 'Tanaman dikemas rapi dan aman dengan pengaman akar serta media tanam. Disarankan menggunakan kurir instan/sameday atau ekspedisi kilat untuk menjaga kesegaran tanaman.';
        }
      } else if (pType === 'service') {
        label = 'Area & Ketentuan';
        fullTitle = 'Area Layanan & Ketentuan Reservasi';
        icon = Calendar;
        if (!content) {
          content = 'Layanan pengerjaan dilaksanakan sesuai dengan jadwal reservasi dan jangkauan wilayah operasional yang disepakati.';
        }
      } else if (pType === 'digital') {
        label = 'Akses File';
        fullTitle = 'Pengiriman & Panduan Akses File';
        icon = Download;
        if (!content) {
          content = 'Tautan unduhan berkas digital akan langsung aktif atau dikirimkan secara instan setelah pesanan berhasil terverifikasi.';
        }
      } else if (pType === 'food') {
        label = 'Pengiriman & Kemasan';
        fullTitle = 'Pengiriman & Ketentuan Kemasan (F&B)';
        icon = Truck;
        if (!content) {
          content = 'Pesanan dikemas rapi dan higienis dengan kemasan food-grade. Untuk pengiriman instan/sameday menggunakan kurir Gojek/Grab/Maxim, dan untuk produk frozen/tahan lama menggunakan ekspedisi khusus / Next Day.';
        }
      } else if (pType === 'physical') {
        label = 'Pengiriman';
        fullTitle = 'Ketentuan Pengiriman & Ekspedisi';
        icon = Package;
      }

      list.push({ id: 'shipping_terms', label, fullTitle, icon, content });
    }

    // 2. Garansi / Kebijakan Toko / Lisensi / DOA / Legalitas Dokumen Properti / Kesegaran Tanaman
    const warrantyInfo = (item.detailed_info?.warranty_info || '').trim();
    const hasWarranty = pType !== 'service' && (Boolean(warrantyInfo) || (pType === 'digital' && Boolean(item.attributes?.license_type)) || pType === 'property' || pType === 'plant');
    if (hasWarranty) {
      let label = 'Kebijakan Garansi';
      let fullTitle = 'Kebijakan Garansi & Klaim';
      let icon = ShieldCheck;
      let content = warrantyInfo;

      if (pType === 'property') {
        label = 'Legalitas Dokumen';
        fullTitle = 'Legalitas & Kelengkapan Dokumen';
        icon = FileCheck;
        if (!content) {
          content = 'Legalitas properti dan keabsahan berkas (Sertifikat SHM/HGB, IMB/PBG, PBB) siap diverifikasi bersama notaris/PPAT yang ditunjuk.';
        }
      } else if (pType === 'fauna') {
        label = 'Garansi D.O.A';
        fullTitle = 'Ketentuan Garansi D.O.A (Dead On Arrival)';
        icon = Heart;
      } else if (pType === 'plant') {
        label = 'Garansi Segar';
        fullTitle = 'Jaminan Kesegaran & Garansi Tiba Aman';
        icon = Sprout;
        if (!content) {
          content = 'Garansi tanaman hidup dan segar sampai tujuan. Klaim penggantian bibit berlaku dengan menyertakan video unboxing utuh tanpa jeda maksimal 2 jam setelah paket diterima.';
        }
      } else if (pType === 'digital') {
        label = 'Lisensi & Hak Cipta';
        fullTitle = 'Ketentuan Lisensi & Hak Cipta';
        icon = FileCheck;
        if (!content) {
          content = `Item digital ini dilindungi oleh hak cipta dan diberikan dengan ketentuan **${item.attributes?.license_type || 'Lisensi Standar'}**.\n\n- Penggunaan hak akses disesuaikan dengan izin lisensi yang dipilih.\n- Dilarang keras membagikan ulang, menjual kembali, atau mendistribusikan berkas tanpa izin pemilik hak cipta.`;
        }
      } else if (pType === 'food') {
        label = 'Jaminan Simpan';
        fullTitle = 'Petunjuk Penyimpanan & Jaminan Kesegaran';
        icon = ShieldCheck;
      }

      list.push({ id: 'warranty_info', label, fullTitle, icon, content });
    }

    return list;
  }, [item, pType]);

  const [activeTabId, setActiveTabId] = useState<string>('');

  useEffect(() => {
    if (infoItems.length > 0 && !infoItems.some(it => it.id === activeTabId)) {
      setActiveTabId(infoItems[0].id);
    }
  }, [infoItems, activeTabId]);

  const currentItem = infoItems.find(it => it.id === activeTabId) || infoItems[0];
  const hasMultiple = infoItems.length > 1;

  const cleanContent = useMemo(() => {
    if (!currentItem?.content) return '';
    let text = currentItem.content.trim();
    const lines = text.split('\n');
    if (lines.length > 0 && /^#{1,4}\s+/.test(lines[0])) {
      const headingRaw = lines[0].replace(/^#{1,4}\s+/, '').trim().toLowerCase();
      const titleLower = (currentItem.fullTitle || '').toLowerCase();
      const labelLower = (currentItem.label || '').toLowerCase();
      if (
        titleLower.includes(headingRaw) ||
        headingRaw.includes(titleLower) ||
        headingRaw.includes(labelLower) ||
        headingRaw.includes('prosedur') ||
        headingRaw.includes('reservasi') ||
        headingRaw.includes('layanan') ||
        headingRaw.includes('ketentuan') ||
        headingRaw.includes('panduan') ||
        headingRaw.includes('jaminan') ||
        headingRaw.includes('standar') ||
        headingRaw.includes('syarat') ||
        headingRaw.includes('garansi') ||
        headingRaw.includes('pengiriman')
      ) {
        text = lines.slice(1).join('\n').trim();
      }
    }
    return text;
  }, [currentItem]);

  if (!item || infoItems.length === 0) return null;

  const isLong = cleanContent.length > 250 || cleanContent.split('\n').length > 4;

  return (
    <div style={{
      marginBottom: isMobile ? 0 : '1.5rem',
      padding: isMobile ? '1rem' : '0 0 1.25rem',
      borderBottom: '1px solid var(--border-light)'
    }}>
      <h3 style={{
        fontSize: isMobile ? '0.95rem' : '1.05rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.65rem',
        letterSpacing: '-0.01em'
      }}>
        {hasMultiple ? 'Ketentuan & Garansi' : currentItem.fullTitle}
      </h3>

      {hasMultiple && (
        <div style={{
          display: 'flex',
          gap: '0.45rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          marginBottom: '0.75rem',
          scrollbarWidth: 'none'
        }}>
          {infoItems.map(info => {
            const IconComp = info.icon;
            const isActive = info.id === currentItem.id;
            return (
              <button
                key={info.id}
                type="button"
                onClick={() => {
                  setActiveTabId(info.id);
                  setIsExpanded(false);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: isMobile ? '0.38rem 0.85rem' : '0.45rem 0.95rem',
                  borderRadius: '0.5rem',
                  fontSize: isMobile ? '0.78rem' : '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  boxShadow: isActive ? '0 2px 8px var(--primary-glow)' : 'none',
                  flexShrink: 0
                }}
              >
                <IconComp size={14} style={{ color: isActive ? '#ffffff' : 'var(--primary)' }} />
                <span>{info.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.75rem',
        padding: isMobile ? '0.85rem 1rem' : '0.9rem 1.25rem'
      }}>
        <div style={{
          position: 'relative',
          lineHeight: '1.65',
          fontSize: isMobile ? '0.82rem' : '0.88rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{
            display: (!isExpanded && isLong) ? '-webkit-box' : 'block',
            WebkitLineClamp: (!isExpanded && isLong) ? (isMobile ? 3 : 4) : undefined,
            WebkitBoxOrient: 'vertical',
            overflow: (!isExpanded && isLong) ? 'hidden' : 'visible',
            textOverflow: 'ellipsis'
          }}>
            <FormattedText 
              text={cleanContent} 
              style={{
                fontSize: 'inherit',
                color: 'inherit',
                lineHeight: 'inherit'
              }} 
            />
          </div>
        </div>

        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--primary)',
              fontSize: isMobile ? '0.8rem' : '0.84rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.45rem 0 0.1rem',
              marginTop: '0.2rem',
              transition: 'color 0.2s ease'
            }}
          >
            <span>{isExpanded ? 'Sembunyikan' : 'Lihat Selengkapnya'}</span>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>
    </div>
  );
};

