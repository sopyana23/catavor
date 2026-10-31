import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Store as StoreIcon,
  MessageCircle,
  Sparkles,
  Palette,
  Globe,
  SlidersHorizontal,
  Save,
  Check,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Trash2,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  Smartphone,
  ExternalLink,
  Loader,
  Trees,
  Moon,
  Zap,
  Waves,
  Flower2,
  Leaf,
  Compass,
  FileCode,
  ShieldCheck,
  Lock,
  Heart,
  Truck,
  Star
} from 'lucide-react';
import { RichTextarea } from './RichTextarea';
import { formatPhoneNumber, parseWAContacts, type WAContactItem } from '../utils/catalogConfig';
import { useModalBackHandler } from '../utils/navigation';
import type { StoreQuotaData } from './TabletSubscriptionModal';

// =========================================================================
// TYPES & CONSTANTS
// =========================================================================

export type TabletSettingsSubTab = 'general' | 'contact' | 'about' | 'theme' | 'domain';

export interface DaySchedule {
  open: string;
  close: string;
  status: 'open' | 'closed';
}

export interface OperationalHoursData {
  mode: 'everyday' | 'weekdays_weekends' | 'custom' | 'manual';
  timezone?: string;
  everyday?: DaySchedule;
  weekdays?: DaySchedule;
  weekends?: DaySchedule;
  days?: Record<string, DaySchedule>;
  manual_text?: string;
  display_text?: string;
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
      // fallback
    }
  }

  const timeMatch = str.match(/(\d{1,2}[:.]\d{2})\s*[-–s\/d]+\s*(\d{1,2}[:.]\d{2})/);
  const tzMatch = str.match(/(WIB|WITA|WIT)/i);
  const timezone = tzMatch ? tzMatch[1].toUpperCase() : 'WIB';

  if (timeMatch) {
    const open = timeMatch[1].replace('.', ':').padStart(5, '0');
    const close = timeMatch[2].replace('.', ':').padStart(5, '0');
    return {
      mode: 'manual',
      timezone,
      manual_text: str,
      display_text: str,
      everyday: { open, close, status: 'open' },
      days: {
        'Senin': { open, close, status: 'open' },
        'Selasa': { open, close, status: 'open' },
        'Rabu': { open, close, status: 'open' },
        'Kamis': { open, close, status: 'open' },
        'Jumat': { open, close, status: 'open' },
        'Sabtu': { open, close, status: 'open' },
        'Minggu': { open, close, status: 'open' },
      }
    };
  }

  return DEFAULT_OPERATIONAL_HOURS;
}

export const SOCIAL_MEDIA_OPTIONS = [
  { key: 'Instagram', label: 'Instagram' },
  { key: 'Facebook', label: 'Facebook' },
  { key: 'TikTok', label: 'TikTok' },
  { key: 'Youtube', label: 'YouTube' },
  { key: 'Twitter', label: 'Twitter / X' },
  { key: 'LinkedIn', label: 'LinkedIn' },
  { key: 'Telegram', label: 'Telegram' }
];

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

export const ABOUT_ICONS_OPTIONS = [
  { key: 'shield', label: 'Garansi / Keamanan' },
  { key: 'lock', label: 'Transaksi / Terpercaya' },
  { key: 'message', label: 'Konsultasi / Chat' },
  { key: 'heart', label: 'Kesehatan / Kasih Sayang' },
  { key: 'truck', label: 'Pengiriman / Delivery' },
  { key: 'sparkles', label: 'Kualitas / Premium' },
  { key: 'star', label: 'Rekomendasi / Terbaik' },
  { key: 'compass', label: 'Eksplorasi / Visi' }
];

export const renderAboutIcon = (key: string, size = 20, color = 'var(--primary)') => {
  switch (key) {
    case 'shield': return <ShieldCheck size={size} style={{ color }} />;
    case 'lock': return <Lock size={size} style={{ color }} />;
    case 'message': return <MessageCircle size={size} style={{ color }} />;
    case 'heart': return <Heart size={size} style={{ color }} />;
    case 'truck': return <Truck size={size} style={{ color }} />;
    case 'sparkles': return <Sparkles size={size} style={{ color }} />;
    case 'star': return <Star size={size} style={{ color }} />;
    case 'compass': return <Compass size={size} style={{ color }} />;
    default: return <Compass size={size} style={{ color }} />;
  }
};

// =========================================================================
// SUB-COMPONENT: WHATSAPP CONTACTS MANAGER
// =========================================================================

export function TabletWhatsAppContactsManager({
  value,
  onChange
}: {
  value: string;
  onChange: (newVal: string) => void;
}) {
  const [localContacts, setLocalContacts] = useState<WAContactItem[]>(() => parseWAContacts(value));

  useEffect(() => {
    const parsed = parseWAContacts(value);
    if (JSON.stringify(parsed) !== JSON.stringify(localContacts)) {
      setLocalContacts(parsed);
    }
  }, [value]);

  const updateAll = (newList: WAContactItem[]) => {
    setLocalContacts(newList);
    onChange(JSON.stringify(newList));
  };

  const handleAdd = () => {
    const nextIdx = localContacts.length + 1;
    const newId = `wa_${Date.now()}`;
    const isFirst = localContacts.length === 0;
    const newList = [
      ...localContacts,
      {
        id: newId,
        label: `CS ${nextIdx} • Penjualan`,
        number: '',
        is_default: isFirst,
        use_for_storefront: isFirst
      }
    ];
    updateAll(newList);
  };

  const handleSetStorefront = (targetId: string) => {
    const newList = localContacts.map(c => ({
      ...c,
      use_for_storefront: c.id === targetId,
      is_default: c.id === targetId
    }));
    updateAll(newList);
  };

  const handleItemChange = (index: number, field: 'label' | 'number', val: string) => {
    const newList = localContacts.map((c, idx) => {
      if (idx === index) {
        return { ...c, [field]: val };
      }
      return c;
    });
    updateAll(newList);
  };

  const handleDelete = (index: number) => {
    if (localContacts.length <= 1) {
      updateAll([{ id: 'wa_main', label: 'WhatsApp Utama', number: '', is_default: true, use_for_storefront: true }]);
      return;
    }
    const wasStorefront = localContacts[index]?.use_for_storefront;
    const newList = localContacts.filter((_, idx) => idx !== index);
    if (wasStorefront && newList.length > 0) {
      newList[0].use_for_storefront = true;
      newList[0].is_default = true;
    }
    updateAll(newList);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <label style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
            Nomor WhatsApp Official &amp; Customer Service *
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
            Kelola kontak CS resmi. Bisa menambahkan lebih dari 1 nomor dan tentukan kontak utama etalase depan.
          </span>
        </div>
        <span style={{
          fontSize: '0.74rem',
          fontWeight: 800,
          color: 'var(--primary)',
          backgroundColor: 'var(--primary-glow)',
          padding: '0.3rem 0.75rem',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          {localContacts.length} Kontak WA
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {localContacts.map((c, idx) => (
          <div
            key={c.id || idx}
            style={{
              padding: '1.15rem',
              borderRadius: '0.85rem',
              border: c.use_for_storefront ? '1px solid var(--primary)' : '1px solid var(--border-light)',
              backgroundColor: c.use_for_storefront ? 'var(--primary-glow)' : 'var(--bg-deep)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.use_for_storefront ? 'var(--primary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kontak CS #{idx + 1}
                </span>
                {c.use_for_storefront && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '4px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff'
                  }}>
                    UTAMA ETALASE
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDelete(idx)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
                title="Hapus kontak ini"
              >
                <Trash2 size={13} />
                <span>Hapus</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Label CS (Misal: CS Penjualan / CS 2)
                </label>
                <input
                  type="text"
                  placeholder="CS 1 • Penjualan"
                  value={c.label}
                  onChange={(e) => handleItemChange(idx, 'label', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Nomor WA (Contoh: 628123456789)
                </label>
                <input
                  type="text"
                  placeholder="628123456789"
                  value={c.number}
                  onChange={(e) => handleItemChange(idx, 'number', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.25rem' }}>
              {c.number.trim() ? (
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)'
                }}>
                  <Smartphone size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Format Publik:</span>
                  <strong>{formatPhoneNumber(c.number)}</strong>
                </div>
              ) : <div />}

              <button
                type="button"
                onClick={() => handleSetStorefront(c.id)}
                style={{
                  minHeight: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.95rem',
                  borderRadius: '999px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: c.use_for_storefront ? 'var(--primary)' : 'var(--bg-card)',
                  color: c.use_for_storefront ? '#ffffff' : 'var(--text-secondary)',
                  border: c.use_for_storefront ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  boxShadow: c.use_for_storefront ? '0 2px 8px var(--primary-glow)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <CheckCircle2 size={14} style={{ color: c.use_for_storefront ? '#ffffff' : 'var(--text-muted)' }} />
                <span>{c.use_for_storefront ? 'Kontak Utama Etalase Depan' : 'Jadikan Kontak Utama Etalase'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        style={{
          minHeight: '44px',
          padding: '0.75rem 1.25rem',
          fontSize: '0.85rem',
          fontWeight: 800,
          borderRadius: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          border: '1px dashed var(--primary)',
          color: 'var(--primary)',
          backgroundColor: 'var(--primary-glow)',
          transition: 'all 0.2s ease',
          width: '100%',
          marginTop: '0.25rem'
        }}
      >
        <Plus size={16} />
        <span>Tambah Nomor WhatsApp CS Baru</span>
      </button>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: OPERATIONAL HOURS BUILDER
// =========================================================================

export function TabletOperationalHoursBuilder({
  value,
  onChange,
  showHours = true,
  onToggleShowHours
}: {
  value: string;
  onChange: (val: string) => void;
  showHours?: boolean;
  onToggleShowHours?: (show: boolean) => void;
}) {
  const parsedData = useMemo(() => parseOperationalHours(value), [value]);
  const [timezone, setTimezone] = useState<string>(parsedData.timezone || 'WIB');
  const [days, setDays] = useState<Record<string, DaySchedule>>(
    parsedData.days || DEFAULT_OPERATIONAL_HOURS.days!
  );

  const emitUpdate = (newTz: string, newDays: Record<string, DaySchedule>) => {
    const resultObj: OperationalHoursData = {
      mode: 'custom',
      timezone: newTz,
      days: newDays,
      display_text: `Kustom 7 Hari (${newTz})`
    };
    onChange(JSON.stringify(resultObj));
  };

  const handleTzChange = (newTz: string) => {
    setTimezone(newTz);
    emitUpdate(newTz, days);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      padding: '1rem',
      borderRadius: '0.75rem',
      border: '1px solid var(--border-light)',
      backgroundColor: 'var(--bg-deep)',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      {/* Toggle Switch Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.65rem',
        backgroundColor: showHours ? 'var(--primary-glow)' : 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
          <Clock size={19} style={{ color: showHours ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Jam Operasional Bisnis
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {showHours ? 'Jam operasional aktif & ditampilkan di katalog' : 'Jam operasional disembunyikan dari katalog'}
            </div>
          </div>
        </div>

        {onToggleShowHours && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: showHours ? 'var(--primary)' : 'var(--text-muted)',
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              backgroundColor: showHours ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: showHours ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)'
            }}>
              {showHours ? 'TAMPIL' : 'SEMBUNYI'}
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={showHours}
              onClick={() => onToggleShowHours(!showHours)}
              style={{
                width: '46px',
                height: '26px',
                borderRadius: '14px',
                backgroundColor: showHours ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)',
                border: showHours ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: showHours ? 'flex-end' : 'flex-start',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
              }} />
            </button>
          </div>
        )}
      </div>

      {showHours && (
        <>
          {/* Header + Timezone Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                Jadwal Buka 7 Hari
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Zona Waktu:</span>
              <select
                style={{
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.78rem',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)'
                }}
                value={timezone}
                onChange={(e) => handleTzChange(e.target.value)}
              >
                <option value="WIB">WIB (UTC+7)</option>
                <option value="WITA">WITA (UTC+8)</option>
                <option value="WIT">WIT (UTC+9)</option>
              </select>
            </div>
          </div>

          {/* Grid Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px minmax(0, 1fr) minmax(0, 1fr) auto',
            gap: '0.5rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}>
            <span>Hari</span>
            <span style={{ textAlign: 'center' }}>Jam Buka</span>
            <span style={{ textAlign: 'center' }}>Jam Tutup</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>

          {/* 7 Days Table Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
            {INDO_DAYS_LIST.map((day) => {
              const currentSched = days[day] || { open: '08:00', close: '21:00', status: 'open' };
              const isClosed = currentSched.status === 'closed';

              return (
                <div
                  key={day}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px minmax(0, 1fr) minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: isClosed ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)',
                    border: isClosed ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-light)',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {day}
                  </span>

                  {isClosed ? (
                    <span style={{ gridColumn: 'span 2', fontSize: '0.74rem', color: '#ef4444', fontWeight: 800, textAlign: 'center', letterSpacing: '0.03em' }}>
                      TUTUP SEHARIAN
                    </span>
                  ) : (
                    <>
                      <input
                        type="time"
                        style={{
                          width: '100%',
                          padding: '0.35rem',
                          fontSize: '0.8rem',
                          textAlign: 'center',
                          borderRadius: '0.4rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)'
                        }}
                        value={currentSched.open}
                        onChange={(e) => {
                          const updatedDays: Record<string, DaySchedule> = {
                            ...days,
                            [day]: { ...currentSched, open: e.target.value }
                          };
                          setDays(updatedDays);
                          emitUpdate(timezone, updatedDays);
                        }}
                      />
                      <input
                        type="time"
                        style={{
                          width: '100%',
                          padding: '0.35rem',
                          fontSize: '0.8rem',
                          textAlign: 'center',
                          borderRadius: '0.4rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)'
                        }}
                        value={currentSched.close}
                        onChange={(e) => {
                          const updatedDays: Record<string, DaySchedule> = {
                            ...days,
                            [day]: { ...currentSched, close: e.target.value }
                          };
                          setDays(updatedDays);
                          emitUpdate(timezone, updatedDays);
                        }}
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const nextStatus: 'open' | 'closed' = isClosed ? 'open' : 'closed';
                      const updatedDays: Record<string, DaySchedule> = {
                        ...days,
                        [day]: {
                          ...currentSched,
                          status: nextStatus
                        }
                      };
                      setDays(updatedDays);
                      emitUpdate(timezone, updatedDays);
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: isClosed ? 'var(--primary)' : 'rgba(239, 68, 68, 0.1)',
                      color: isClosed ? '#ffffff' : '#ef4444',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isClosed ? 'Buka' : 'Tutup'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// =========================================================================
// MAIN VIEW COMPONENT
// =========================================================================

export interface TabletStoreSettingsViewProps {
  storeSlug: string;
  token: string | null;
  quota: StoreQuotaData | null;
  onThemeChange?: (theme: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onOpenSubscriptionModal: () => void;
  onViewPublicCatalog?: () => void;
  onUnauthorized?: () => void;
  onSlugChanged?: (newSlug: string) => void;
  handleUploadImage: (file: File, category?: 'products' | 'branding') => Promise<string | null>;
  isNavExpanded?: boolean;
}

export const TabletStoreSettingsView: React.FC<TabletStoreSettingsViewProps> = ({
  storeSlug,
  token,
  quota,
  onThemeChange,
  showToast,
  onOpenSubscriptionModal,
  onViewPublicCatalog: _onViewPublicCatalog,
  onUnauthorized,
  onSlugChanged,
  handleUploadImage,
  isNavExpanded = false
}) => {
  const [settingsSubTab, setSettingsSubTab] = useState<TabletSettingsSubTab>('general');
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  // Tab track scrolling & touch ergonomics
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabButtonsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = useCallback(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    if (hasOverflow) {
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
    } else {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    }
  }, []);

  useEffect(() => {
    checkTabScroll();
    const el = tabBarRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkTabScroll, { passive: true });
    window.addEventListener('resize', checkTabScroll);
    return () => {
      el.removeEventListener('scroll', checkTabScroll);
      window.removeEventListener('resize', checkTabScroll);
    };
  }, [checkTabScroll, isNavExpanded]);

  const handleSelectSubTab = (id: TabletSettingsSubTab) => {
    setSettingsSubTab(id);
    const btn = tabButtonsRef.current[id];
    if (btn) {
      btn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    store_title: '',
    store_slogan: '',
    store_logo_url: '',
    promo_banner: '',
    store_theme: 'navy',
    whatsapp_number: '',
    official_website: '',
    about_location: '',
    about_hours: '',
    show_hours: true,
    about_title: '',
    about_slogan: '',
    about_description: '',
    about_disclaimer: '',
    about_cards: '[]',
    social_links: '[]',
    custom_domain: '',
    is_paused: false
  });

  // Slug check state
  const [settingsSlug, setSettingsSlug] = useState<string>(() => (storeSlug || '').toLowerCase());
  const [slugCheckStatus, setSlugCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'current'>('idle');
  const [slugCheckMessage, setSlugCheckMessage] = useState<string>('');
  const [showSlugConfirmModal, setShowSlugConfirmModal] = useState<boolean>(false);

  // Custom domain state
  const [customDomainInput, setCustomDomainInput] = useState<string>('');
  const [customDomainLoading, setCustomDomainLoading] = useState<boolean>(false);

  const logoFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  useModalBackHandler({
    isOpen: showSlugConfirmModal,
    onClose: () => setShowSlugConfirmModal(false),
    modalId: 'slug-confirm-tablet'
  });

  const getAuthHeaders = useCallback(() => ({
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
    'X-Store-Slug': storeSlug
  }), [token, storeSlug]);

  // Load store details
  const fetchSettings = useCallback(async () => {
    if (!storeSlug) return;
    try {
      const res = await fetch(`/api/u/${storeSlug}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json.store || json;
        const currentTheme = data.store_theme || 'navy';

        const fetched = {
          store_title: data.store_title || data.name || '',
          store_slogan: data.store_slogan || data.slogan || '',
          store_logo_url: data.store_logo_url || data.logo_url || '',
          promo_banner: data.promo_banner || data.banner_url || '',
          store_theme: currentTheme,
          whatsapp_number: data.whatsapp_number || data.phone || '',
          official_website: data.official_website || '',
          about_location: data.about_location || data.address || '',
          about_hours: data.about_hours || data.operating_hours || '',
          show_hours: data.show_hours !== undefined ? Boolean(data.show_hours) : true,
          about_title: data.about_title || '',
          about_slogan: data.about_slogan || '',
          about_description: data.about_description || '',
          about_disclaimer: data.about_disclaimer || data.service_commitment || '',
          about_cards: data.about_cards ? (typeof data.about_cards === 'string' ? data.about_cards : JSON.stringify(data.about_cards)) : '[]',
          social_links: data.social_links ? (typeof data.social_links === 'string' ? data.social_links : JSON.stringify(data.social_links)) : '[]',
          custom_domain: data.custom_domain || '',
          is_paused: Boolean(data.is_suspended || data.is_dormant)
        };

        setSettingsForm(fetched);

        if (currentTheme) {
          document.documentElement.setAttribute('data-theme', currentTheme);
          document.body.setAttribute('data-theme', currentTheme);
        }

        const activeSlug = (data.slug || storeSlug || '').toLowerCase();
        setSettingsSlug(activeSlug);
        setCustomDomainInput(data.custom_domain || '');

        try {
          if (activeSlug) {
            localStorage.setItem(`catavor_store_${activeSlug}`, JSON.stringify(fetched));
          }
          localStorage.setItem('catavor_settings', JSON.stringify(fetched));
        } catch {}
      }
    } catch {
      // silent fallback
    }
  }, [storeSlug, getAuthHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Debounced live check for slug availability
  useEffect(() => {
    const currentNormalized = (storeSlug || '').toLowerCase();
    const clean = settingsSlug.trim().toLowerCase();

    if (!clean || clean === currentNormalized) {
      setSlugCheckStatus('current');
      setSlugCheckMessage('Tautan saat ini');
      return;
    }

    if (clean.length < 3) {
      setSlugCheckStatus('invalid');
      setSlugCheckMessage('Minimal 3 karakter.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(clean)) {
      setSlugCheckStatus('invalid');
      setSlugCheckMessage('Hanya huruf kecil, angka, dan tanda hubung (-).');
      return;
    }

    if (clean.startsWith('-') || clean.endsWith('-')) {
      setSlugCheckStatus('invalid');
      setSlugCheckMessage('Tidak boleh diawali atau diakhiri tanda hubung.');
      return;
    }

    setSlugCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-slug/${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.available) {
          setSlugCheckStatus('available');
          setSlugCheckMessage('Tautan tersedia!');
        } else {
          setSlugCheckStatus('taken');
          setSlugCheckMessage(data.message || 'Tautan sudah digunakan oleh katalog lain.');
        }
      } catch {
        setSlugCheckStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [settingsSlug, storeSlug]);

  // Save Settings
  const handleSettingsSave = async (e?: React.FormEvent, forceConfirmSlug: boolean = false) => {
    if (e) e.preventDefault();
    if (settingsForm.is_paused) {
      showToast('Operasional katalog sedang dibekukan sementara. Perubahan pengaturan dinonaktifkan.', 'error');
      return;
    }

    const currentNormalized = (storeSlug || '').toLowerCase();
    const cleanNewSlug = settingsSlug.trim().toLowerCase();

    if (cleanNewSlug && cleanNewSlug !== currentNormalized && !forceConfirmSlug) {
      if (slugCheckStatus === 'invalid' || slugCheckStatus === 'taken') {
        showToast(slugCheckMessage || 'ID tautan katalog tidak valid atau sudah terpakai.', 'error');
        return;
      }
      setShowSlugConfirmModal(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...settingsForm,
        slug: cleanNewSlug || currentNormalized,
        about_cards: settingsForm.about_cards ? JSON.parse(settingsForm.about_cards) : [],
        social_links: settingsForm.social_links ? JSON.parse(settingsForm.social_links) : []
      };

      const res = await fetch('/api/stores/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowSlugConfirmModal(false);
        if (onThemeChange && settingsForm.store_theme) {
          onThemeChange(settingsForm.store_theme);
        }

        if (settingsForm.store_theme) {
          document.documentElement.setAttribute('data-theme', settingsForm.store_theme);
          document.body.setAttribute('data-theme', settingsForm.store_theme);
        }

        const activeSlug = (cleanNewSlug || currentNormalized).toLowerCase();
        try {
          if (activeSlug) {
            localStorage.setItem(`catavor_store_${activeSlug}`, JSON.stringify(payload));
          }
          localStorage.setItem('catavor_settings', JSON.stringify(payload));
        } catch {}

        if (data.slug_changed && data.new_slug) {
          const newSlug = data.new_slug;
          setSettingsSlug(newSlug);
          try {
            localStorage.setItem('catavor_active_store_slug', newSlug);
          } catch {}
          if (onSlugChanged) onSlugChanged(newSlug);
          showToast(`Tautan katalog berhasil diperbarui ke catavor.com/${newSlug}!`);
        } else {
          showToast('Pengaturan profil & etalase katalog berhasil disimpan!');
        }
      } else {
        if (res.status === 401 && onUnauthorized) {
          onUnauthorized();
        } else {
          showToast(data.message || 'Gagal menyimpan pengaturan.', 'error');
        }
      }
    } catch {
      showToast('Terjadi kesalahan sistem saat menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Dedicated Theme Selection (Instant local + API persistence identical to Desktop & Mobile)
  const handleThemeSelect = async (themeId: string, themeName: string) => {
    setSettingsForm(prev => ({ ...prev, store_theme: themeId }));
    document.documentElement.setAttribute('data-theme', themeId);
    document.body.setAttribute('data-theme', themeId);
    if (onThemeChange) onThemeChange(themeId);

    const slug = (storeSlug || '').toLowerCase();
    try {
      if (slug) {
        const key = `catavor_store_${slug}`;
        const existing = localStorage.getItem(key);
        let parsed = existing ? JSON.parse(existing) : {};
        parsed.store_theme = themeId;
        localStorage.setItem(key, JSON.stringify(parsed));
        localStorage.setItem('catavor_settings', JSON.stringify({ ...settingsForm, store_theme: themeId }));
      }
    } catch {}

    if (token) {
      try {
        const res = await fetch('/api/stores/update', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ store_theme: themeId })
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          showToast(`Tema "${themeName}" berhasil diterapkan & disimpan!`);
        } else {
          showToast(`Tema "${themeName}" diterapkan!`);
        }
      } catch {
        showToast(`Tema "${themeName}" diterapkan secara lokal!`);
      }
    } else {
      showToast(`Tema "${themeName}" diterapkan!`);
    }
  };

  // Custom Domain Save
  const handleCustomDomainSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomDomainLoading(true);
    try {
      const res = await fetch('/api/subscription/custom-domain', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ custom_domain: customDomainInput.trim().toLowerCase() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Konfigurasi Custom Domain berhasil diperbarui!');
        setSettingsForm(prev => ({ ...prev, custom_domain: customDomainInput.trim().toLowerCase() }));
      } else {
        showToast(data.message || 'Gagal menyimpan custom domain.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan custom domain.', 'error');
    } finally {
      setCustomDomainLoading(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await handleUploadImage(file, 'branding');
      if (url) {
        setSettingsForm(prev => ({ ...prev, store_logo_url: url }));
        showToast('Logo berhasil diunggah!');
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const url = await handleUploadImage(file, 'branding');
      if (url) {
        setSettingsForm(prev => ({ ...prev, promo_banner: url }));
        showToast('Sampul katalog berhasil diunggah!');
      }
    } finally {
      setBannerUploading(false);
    }
  };

  const settingsTabs: Array<{ 
    id: TabletSettingsSubTab; 
    label: string; 
    description: string;
    icon: React.ComponentType<{ size?: number | string; strokeWidth?: number; style?: React.CSSProperties; className?: string }>; 
    isPro?: boolean 
  }> = [
    { id: 'general', label: 'Profil & Identitas', description: 'Nama katalog, tautan unik, logo, dan slogan bisnis', icon: StoreIcon },
    { id: 'contact', label: 'Kontak & Saluran', description: 'WhatsApp CS, telepon, jam operasional, dan lokasi toko', icon: MessageCircle },
    { id: 'about', label: 'Tentang Kami', description: 'Profil cerita bisnis, visi-misi, dan kartu nilai komitmen', icon: Sparkles },
    { id: 'theme', label: 'Tema & Tampilan', description: 'Preset warna estetika, palet brand, dan gaya visual etalase', icon: Palette },
    ...(quota?.plan?.has_custom_domain ? [{ id: 'domain' as const, label: 'Custom Domain', description: 'Tautkan nama domain pribadi Anda ke etalase katalog', icon: Globe, isPro: true }] : [])
  ];

  const themePresets = [
    { id: 'emerald', name: 'Midnight Emerald', desc: 'Nuansa gelap modern dengan kaca transparan & aksen hijau emerald.', bg: '#080c14', primary: '#10b981', accent: '#f59e0b', cardBg: '#0f172a', IconComponent: Trees },
    { id: 'nordic', name: 'Midnight Slate', desc: 'Nuansa gelap slate yang elegan & tenang dengan aksen dusty blue & pendar malam modern.', bg: '#0f141a', primary: '#5b7c99', accent: '#8eb0cc', cardBg: '#17202a', IconComponent: Moon },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Gaya futuristik dengan warna ungu royal & efek neon cyan.', bg: '#0b0716', primary: '#a855f7', accent: '#06b6d4', cardBg: '#150d2a', IconComponent: Zap },
    { id: 'ocean', name: 'Oceanic Azure', desc: 'Desain profesional biru gelap korporat & cyan segar.', bg: '#081021', primary: '#3b82f6', accent: '#38bdf8', cardBg: '#0f1c38', IconComponent: Waves },
    { id: 'pastel', name: 'Pastel Bloom', desc: 'Tema terang estetik yang lembut dengan sentuhan pink rose & putih.', bg: '#f8fafc', primary: '#e11d48', accent: '#fda4af', cardBg: '#ffffff', light: true, IconComponent: Flower2 },
    { id: 'sage', name: 'Sage & Limestone', desc: 'Nuansa organik mewah perpaduan hijau sage menyejukkan dengan kehangatan batu kapur cream.', bg: '#f4f0e8', primary: '#527863', accent: '#d1c2ab', cardBg: '#ffffff', light: true, IconComponent: Leaf },
    { id: 'navy', name: 'Royal Navy', desc: 'Tema terang estetik & elegan perpaduan biru navy klasik dan putih bersih.', bg: '#f8fafc', primary: '#1e3a8a', accent: '#93c5fd', cardBg: '#ffffff', light: true, IconComponent: Compass }
  ];

  return (
    <div 
      className={`tablet-settings-root ${isNavExpanded ? 'is-nav-expanded' : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="tablet-settings-container"
        style={{
          maxWidth: '1040px',
          margin: '0 auto',
          padding: isNavExpanded ? '1.25rem 1.5rem 8rem 1.5rem' : '1.75rem 2rem 8rem 2rem',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'padding 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary-glow)',
            border: '1px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            flexShrink: 0
          }}>
            <SlidersHorizontal size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Pengaturan Profil &amp; Tampilan Katalog
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0', lineHeight: 1.4 }}>
              Kelola identitas publik, branding visual, kontak resmi, dan preferensi etalase katalog Anda.
            </p>
          </div>
        </div>
      </div>

      {/* Tablet Adaptive Segmented Sub-Tab Bar (Touch-First & Zero Collision) */}
      <div
        className={`tablet-settings-tab-wrapper ${isNavExpanded ? 'is-sidebar-expanded' : ''}`}
        style={{ '--tab-count': settingsTabs.length } as React.CSSProperties}
      >
        {canScrollLeft && <div className="tablet-tab-scroll-hint-left" aria-hidden="true" />}
        <div
          ref={tabBarRef}
          className="tablet-settings-tabs-track"
          role="tablist"
          aria-label="Sub-Menu Pengaturan Katalog"
        >
          {settingsTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = settingsSubTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={el => { tabButtonsRef.current[tab.id] = el; }}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={tab.description}
                onClick={() => handleSelectSubTab(tab.id)}
                className={`tablet-settings-tab-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} strokeWidth={2.2} className="tab-icon" />
                <span className="tab-label-text">{tab.label}</span>
                {tab.isPro && (
                  <span className={`tab-pro-badge ${isActive ? 'active' : ''}`}>
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {canScrollRight && <div className="tablet-tab-scroll-hint-right" aria-hidden="true" />}
      </div>

      {/* Hidden file inputs for Branding */}
      <input
        type="file"
        ref={logoFileRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleLogoFileChange}
      />
      <input
        type="file"
        ref={bannerFileRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBannerFileChange}
      />

      {/* ===================================================================
          1. TEMA & TAMPILAN SUB-TAB
          =================================================================== */}
      {settingsSubTab === 'theme' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
              Pilih Preset Tema Estetik Katalog
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Klik salah satu opsi tema di bawah ini. Tema akan langsung diterapkan dan disimpan secara permanen.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem'
          }}>
            {themePresets.map(t => {
              const isActive = (settingsForm.store_theme || 'navy') === t.id;
              const IconComp = t.IconComponent;
              return (
                <div
                  key={t.id}
                  onClick={() => handleThemeSelect(t.id, t.name)}
                  style={{
                    padding: '1.15rem',
                    borderRadius: '0.85rem',
                    border: isActive ? `2px solid ${t.primary}` : '1px solid var(--border-light)',
                    background: t.cardBg,
                    cursor: 'pointer',
                    boxShadow: isActive ? `0 0 20px ${t.primary}35` : '0 4px 12px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9px',
                        backgroundColor: `${t.primary}20`,
                        border: `1px solid ${t.primary}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: t.primary,
                        boxShadow: `0 4px 10px ${t.primary}25`,
                        flexShrink: 0
                      }}>
                        <IconComp size={18} />
                      </div>
                      <div style={{ display: 'flex', gap: '4px', background: t.bg, padding: '5px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.primary, boxShadow: `0 0 5px ${t.primary}` }} />
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.accent }} />
                      </div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: t.light ? '#0f172a' : '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.name}
                      </h4>
                    </div>

                    {isActive && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: t.primary,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        backgroundColor: `${t.primary}20`,
                        border: `1px solid ${t.primary}50`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        flexShrink: 0
                      }}>
                        <CheckCircle2 size={12} /> Aktif
                      </span>
                    )}
                  </div>

                  <p style={{
                    fontSize: '0.78rem',
                    color: t.light ? '#475569' : '#9ca3af',
                    margin: 0,
                    lineHeight: 1.45
                  }}>
                    {t.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================
          2. CUSTOM DOMAIN SUB-TAB
          =================================================================== */}
      {settingsSubTab === 'domain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Globe size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Konfigurasi Custom Domain Katalog
              </h3>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--primary)',
                color: '#ffffff'
              }}>
                PRO BISNIS
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Gunakan domain kustom Anda sendiri (misal: <code>brandanda.com</code> atau <code>katalog.brand.com</code>) sebagai alamat website resmi katalog Anda.
            </p>
          </div>

          {quota && !quota.plan?.has_custom_domain && (
            <div style={{
              padding: '1.15rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertCircle size={22} color="#f59e0b" />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Fitur <strong>Custom Domain</strong> membutuhkan paket <strong>Pro</strong> atau <strong>Enterprise</strong>.
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                style={{
                  minHeight: '40px',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Upgrade Paket
              </button>
            </div>
          )}

          <form onSubmit={handleCustomDomainSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                Nama Domain Kustom
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Contoh: brandanda.com atau katalog.brand.com"
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="submit"
                  disabled={customDomainLoading}
                  style={{
                    minHeight: '44px',
                    padding: '0 1.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: customDomainLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {customDomainLoading ? 'Menyimpan...' : 'Simpan Domain'}
                </button>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                * Masukkan nama domain tanpa http:// atau https://. Kosongkan lalu simpan jika ingin menghapus custom domain.
              </span>
            </div>

            {settingsForm.custom_domain && (
              <div style={{
                padding: '0.85rem 1.15rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary-glow)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>Domain Terhubung: </span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{settingsForm.custom_domain}</strong>
                  </div>
                </div>
                <a
                  href={`https://${settingsForm.custom_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    textDecoration: 'none'
                  }}
                >
                  Buka Domain <ExternalLink size={13} />
                </a>
              </div>
            )}

            {/* DNS Configuration Guide Card */}
            <div style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileCode size={16} style={{ color: 'var(--primary)' }} />
                Petunjuk DNS di Registrar (Niagahoster, DomaiNesia, Cloudflare, dll)
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Buka pengaturan DNS Domain Anda di tempat Anda membeli domain, lalu tambahkan 1 baris record berikut:
              </p>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '0.85rem 1rem',
                borderRadius: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.84rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                border: '1px solid var(--border-light)'
              }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Tipe:</strong> <span style={{ color: 'var(--primary)', fontWeight: 800 }}>CNAME</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Host:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>@</span> atau <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>katalog</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Target:</strong> <span style={{ color: 'var(--primary)', fontWeight: 800 }}>cname.catavor.com</span></div>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                * Setelah DNS diarahkan, domain Anda akan aktif dalam 10-60 menit tergantung propagasi DNS global.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================
          3. FORM SUB-TABS (General, Contact, About)
          =================================================================== */}
      {(settingsSubTab === 'general' || settingsSubTab === 'contact' || settingsSubTab === 'about') && (
        <form onSubmit={handleSettingsSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* SUB-TAB 1: PROFIL & IDENTITAS UTAMA */}
          {settingsSubTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Nama / Judul Katalog *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Catavor Digital"
                  required
                  value={settingsForm.store_title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, store_title: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ID / Tautan Katalog *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
                    {slugCheckStatus === 'checking' && (
                      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Loader size={12} className="animate-spin" /> Memeriksa...
                      </span>
                    )}
                    {slugCheckStatus === 'available' && (
                      <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Check size={13} /> {slugCheckMessage}
                      </span>
                    )}
                    {slugCheckStatus === 'current' && (
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Tautan Saat Ini</span>
                    )}
                    {(slugCheckStatus === 'taken' || slugCheckStatus === 'invalid') && (
                      <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertTriangle size={13} /> {slugCheckMessage}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <span style={{
                    padding: '0.55rem 0.85rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRight: 'none',
                    borderRadius: '0.5rem 0 0 0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    userSelect: 'none',
                    fontFamily: 'monospace'
                  }}>
                    catavor.com/
                  </span>
                  <input
                    type="text"
                    placeholder="nama-katalog-anda"
                    required
                    value={settingsSlug}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setSettingsSlug(val);
                    }}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '0.75rem',
                      borderRadius: '0 0.5rem 0.5rem 0',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid',
                      borderColor: slugCheckStatus === 'available' ? '#10b981' : (slugCheckStatus === 'taken' || slugCheckStatus === 'invalid') ? '#ef4444' : 'var(--border-light)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', lineHeight: 1.4 }}>
                  Alamat unik katalog Anda untuk dibagikan ke calon pembeli. Hanya boleh huruf kecil, angka, dan tanda hubung (-).
                </p>
              </div>

              {/* LOGO RESMI */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Logo Resmi Katalog
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {settingsForm.store_logo_url && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px dashed var(--border-light)',
                      borderRadius: '0.5rem'
                    }}>
                      <img
                        src={settingsForm.store_logo_url}
                        alt="Logo Preview"
                        style={{ height: '48px', width: '48px', borderRadius: '0.5rem', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, store_logo_url: '' })}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          borderRadius: '0.4rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        Hapus Logo
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={logoUploading}
                      style={{
                        minHeight: '44px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: logoUploading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Upload size={16} />
                      <span>{logoUploading ? 'Mengunggah...' : 'Pilih File Logo dari Perangkat'}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Atau tempel URL gambar logo langsung..."
                    value={settingsForm.store_logo_url}
                    onChange={(e) => setSettingsForm({ ...settingsForm, store_logo_url: e.target.value })}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* SLOGAN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Slogan / Tagline Utama *
                </label>
                <input
                  type="text"
                  placeholder="Slogan atau tagline bisnis Anda..."
                  required
                  value={settingsForm.store_slogan}
                  onChange={(e) => setSettingsForm({ ...settingsForm, store_slogan: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* BANNER SAMPUL */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Banner Sampul Toko (Cover Banner)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {settingsForm.promo_banner && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px dashed var(--border-light)',
                      borderRadius: '0.5rem'
                    }}>
                      <img
                        src={settingsForm.promo_banner}
                        alt="Banner Preview"
                        style={{ height: '54px', width: '96px', borderRadius: '0.5rem', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, promo_banner: '' })}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          borderRadius: '0.4rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        Hapus Sampul
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => bannerFileRef.current?.click()}
                      disabled={bannerUploading}
                      style={{
                        minHeight: '44px',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: bannerUploading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Upload size={16} />
                      <span>{bannerUploading ? 'Mengunggah...' : 'Unggah Foto Sampul dari Perangkat'}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Atau tempel URL gambar sampul langsung..."
                    value={settingsForm.promo_banner}
                    onChange={(e) => setSettingsForm({ ...settingsForm, promo_banner: e.target.value })}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: KONTAK & SALURAN RESMI */}
          {settingsSubTab === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <TabletWhatsAppContactsManager
                  value={settingsForm.whatsapp_number}
                  onChange={(newVal) => setSettingsForm({ ...settingsForm, whatsapp_number: newVal })}
                />
              </div>

              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Website Resmi / Portal Official
                </label>
                <input
                  type="url"
                  placeholder="Contoh: https://website-resmi.com"
                  value={settingsForm.official_website}
                  onChange={(e) => setSettingsForm({ ...settingsForm, official_website: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                  * Kosongkan jika tidak ada. Jika diisi, tombol Website Resmi akan otomatis tampil di bagian Hubungi Kami.
                </span>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                <RichTextarea
                  label="Lokasi / Alamat Resmi"
                  rows={4}
                  placeholder="Tuliskan alamat lengkap lokasi usaha/katalog, gedung, patokan, tautan Google Maps, atau instruksi rute..."
                  value={settingsForm.about_location}
                  onChange={(val) => setSettingsForm({ ...settingsForm, about_location: val })}
                />
              </div>

              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                <TabletOperationalHoursBuilder
                  value={settingsForm.about_hours}
                  onChange={(val) => setSettingsForm({ ...settingsForm, about_hours: val })}
                  showHours={settingsForm.show_hours}
                  onToggleShowHours={(show) => setSettingsForm({ ...settingsForm, show_hours: show })}
                />
              </div>

              {/* Dynamic Social Links Builder */}
              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                {(() => {
                  let currentLinks: any[] = [];
                  try {
                    currentLinks = settingsForm.social_links ? JSON.parse(settingsForm.social_links) : [];
                    if (!Array.isArray(currentLinks)) currentLinks = [];
                  } catch {
                    currentLinks = [];
                  }

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <label style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Tautan Media Sosial Resmi
                          </label>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                            Hubungkan akun Instagram, TikTok, Facebook, YouTube, atau saluran resmi lainnya
                          </span>
                        </div>
                        {currentLinks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newLinks = [...currentLinks, { platform: 'Instagram', url: '' }];
                              setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                            }}
                            style={{
                              minHeight: '38px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.45rem 0.95rem',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={15} /> Tambah Sosmed
                          </button>
                        )}
                      </div>

                      {currentLinks.length === 0 ? (
                        <div style={{
                          padding: '1.25rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--primary-glow)',
                          border: '2px dashed var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}>
                          <div>
                            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-primary)' }}>
                              Belum Ada Tautan Media Sosial Resmi
                            </h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                              Klik tombol di samping untuk menambah akun Instagram, TikTok, Facebook, YouTube, atau saluran resmi katalog Anda.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newLinks = [...currentLinks, { platform: 'Instagram', url: '' }];
                              setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                            }}
                            style={{
                              minHeight: '40px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              padding: '0.55rem 1.15rem',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              borderRadius: '0.55rem',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={16} /> Tambah Sosmed Sekarang
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                          gap: '1rem'
                        }}>
                          {currentLinks.map((link: any, index: number) => (
                            <div
                              key={index}
                              style={{
                                padding: '1rem',
                                border: '1px solid var(--border-light)',
                                borderRadius: '0.65rem',
                                position: 'relative',
                                backgroundColor: 'var(--bg-deep)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const newLinks = currentLinks.filter((_, idx) => idx !== index);
                                  setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '0.75rem',
                                  right: '0.75rem',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer'
                                }}
                                title="Hapus Tautan"
                              >
                                <Trash2 size={16} />
                              </button>

                              <div style={{ marginBottom: '0.75rem', width: '85%' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                  Platform *
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--primary-glow)',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                  }}>
                                    {renderSocialIcon(link.platform || 'Instagram', 18)}
                                  </div>
                                  <select
                                    value={link.platform || 'Instagram'}
                                    onChange={(e) => {
                                      const newLinks = [...currentLinks];
                                      newLinks[index].platform = e.target.value;
                                      setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                    }}
                                    style={{
                                      fontSize: '0.82rem',
                                      padding: '0.5rem',
                                      borderRadius: '0.45rem',
                                      backgroundColor: 'var(--bg-card)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid var(--border-light)',
                                      flex: 1
                                    }}
                                  >
                                    {SOCIAL_MEDIA_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                  URL / Tautan Profil *
                                </label>
                                <input
                                  type="url"
                                  placeholder="Contoh: https://instagram.com/akun"
                                  required
                                  value={link.url}
                                  onChange={(e) => {
                                    const newLinks = [...currentLinks];
                                    newLinks[index].url = e.target.value;
                                    setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.82rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: HALAMAN TENTANG KAMI */}
          {settingsSubTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Judul Halaman Tentang Kami
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tentang Catavor"
                  value={settingsForm.about_title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Slogan Halaman Tentang Kami
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Platform Katalog Digital & Biolink Bisnis Modern"
                  value={settingsForm.about_slogan}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_slogan: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <RichTextarea
                  label="Deskripsi Profil Lengkap"
                  rows={5}
                  placeholder="Tuliskan detail profil lengkap bisnis Anda, visi misi, sejarah, atau informasi penting katalog (Mendukung format teks tebal, miring, daftar poin, dan mode layar penuh)..."
                  value={settingsForm.about_description}
                  onChange={(val) => setSettingsForm({ ...settingsForm, about_description: val })}
                />
              </div>

              {/* Dynamic About Cards Builder */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                {(() => {
                  let currentCards: any[] = [];
                  try {
                    currentCards = settingsForm.about_cards ? JSON.parse(settingsForm.about_cards) : [];
                    if (!Array.isArray(currentCards)) currentCards = [];
                  } catch {
                    currentCards = [];
                  }

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <label style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Kartu Komitmen / Nilai Unggulan
                          </label>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                            Tampilkan pilar komitmen mutu, garansi, keaslian, atau jaminan layanan Anda
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newCards = [...currentCards, { title: '', content: '', icon: 'shield' }];
                            setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                          }}
                          style={{
                            minHeight: '38px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.95rem',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={15} /> Tambah Kartu
                        </button>
                      </div>

                      {currentCards.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0', fontStyle: 'italic' }}>
                          Belum ada kartu nilai/komitmen. Klik Tambah Kartu di atas.
                        </p>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                          gap: '1rem'
                        }}>
                          {currentCards.map((card: any, index: number) => (
                            <div
                              key={index}
                              style={{
                                padding: '1.15rem',
                                border: '1px solid var(--border-light)',
                                borderRadius: '0.65rem',
                                position: 'relative',
                                backgroundColor: 'var(--bg-deep)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const newCards = currentCards.filter((_, idx) => idx !== index);
                                  setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '0.75rem',
                                  right: '0.75rem',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer'
                                }}
                                title="Hapus Kartu"
                              >
                                <Trash2 size={16} />
                              </button>

                              <div style={{ width: '85%' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                  Pilih Ikon Kartu *
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--primary-glow)',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    flexShrink: 0
                                  }}>
                                    {renderAboutIcon(card.icon || 'shield', 18)}
                                  </div>
                                  <select
                                    value={card.icon || 'shield'}
                                    onChange={(e) => {
                                      const newCards = [...currentCards];
                                      newCards[index].icon = e.target.value;
                                      setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                    }}
                                    style={{
                                      fontSize: '0.82rem',
                                      padding: '0.5rem',
                                      borderRadius: '0.45rem',
                                      backgroundColor: 'var(--bg-card)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid var(--border-light)',
                                      flex: 1
                                    }}
                                  >
                                    {ABOUT_ICONS_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                  Judul Komitmen *
                                </label>
                                <input
                                  type="text"
                                  placeholder="Contoh: Garansi Keamanan"
                                  required
                                  value={card.title}
                                  onChange={(e) => {
                                    const newCards = [...currentCards];
                                    newCards[index].title = e.target.value;
                                    setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.82rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                  Deskripsi Kartu *
                                </label>
                                <textarea
                                  rows={3}
                                  placeholder="Penjelasan singkat komitmen..."
                                  required
                                  value={card.content}
                                  onChange={(e) => {
                                    const newCards = [...currentCards];
                                    newCards[index].content = e.target.value;
                                    setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    fontSize: '0.82rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)',
                                    boxSizing: 'border-box',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Bottom Form Actions (Non-floating, solid at the very bottom of the form) */}
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              type="submit"
              disabled={saving || settingsForm.is_paused}
              style={{
                minHeight: '44px',
                padding: '0.75rem 1.85rem',
                fontSize: '0.86rem',
                fontWeight: 800,
                borderRadius: '0.6rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                cursor: (saving || settingsForm.is_paused) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px var(--primary-glow)',
                opacity: (saving || settingsForm.is_paused) ? 0.65 : 1,
                transition: 'all 0.2s ease'
              }}
              title={settingsForm.is_paused ? 'Katalog sedang dibekukan sementara' : ''}
            >
              <Save size={17} strokeWidth={2.2} />
              <span>
                {settingsForm.is_paused
                  ? 'Terkunci: Katalog Dibekukan'
                  : (saving ? 'Menyimpan...' : 'Simpan Pengaturan')}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Modal Konfirmasi Penggantian Tautan / Slug Katalog */}
      {showSlugConfirmModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            padding: '1.75rem',
            borderRadius: '1.1rem',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.15rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '11px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Konfirmasi Penggantian Tautan Katalog
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Perubahan tautan katalog publik berdampak langsung ke pelanggan
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              color: '#fca5a5'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, color: '#f87171' }}>
                Peringatan Tautan Lama &amp; Kode QR:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>Tautan lama <strong>catavor.com/{storeSlug}</strong> akan langsung dinonaktifkan.</li>
                <li>Kode QR atau brosur cetak yang memakai link lama tidak dapat membuka katalog lagi.</li>
                <li>Tautan yang sudah dibagikan di bio media sosial atau chat WhatsApp akan menjadi tidak aktif.</li>
              </ul>
            </div>

            <div style={{
              marginBottom: '1.5rem',
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-deep)',
              borderRadius: '0.65rem',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Tautan Baru Katalog Anda:
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                https://catavor.com/{settingsSlug.trim().toLowerCase()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowSlugConfirmModal(false)}
                style={{
                  minHeight: '42px',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSlugConfirmModal(false);
                  handleSettingsSave(undefined, true);
                }}
                disabled={saving}
                style={{
                  minHeight: '42px',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  borderRadius: '0.55rem',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Memproses...' : 'Ya, Saya Paham & Ubah Tautan'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
