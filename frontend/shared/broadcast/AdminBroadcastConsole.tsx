import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  Loader2,
  Megaphone,
  MousePointerClick,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Store,
  Tag,
  Target,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  createAdminBroadcast,
  deleteAdminBroadcast,
  fetchAdminBroadcastDetail,
  fetchAdminBroadcasts,
  fetchSubscriptionPlans,
  publishAdminBroadcast,
  revokeAdminBroadcast,
  searchBroadcastRecipients,
  updateAdminBroadcast,
} from './broadcastApi';
import type {
  AdminBroadcastRecord,
  BroadcastActionType,
  BroadcastDevice,
  BroadcastFormPayload,
  BroadcastMetrics,
  BroadcastModalBackOptions,
  BroadcastRecipient,
  BroadcastStatus,
  BroadcastTargetType,
  BroadcastUrgency,
  BroadcastUrlSecurityResult,
  SubscriptionPlanOption,
} from './broadcastTypes';

export interface RichTextareaExternalProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
  showPreviewTab?: boolean;
  showZenFullscreen?: boolean;
  theme?: Record<string, string>;
  isDark?: boolean;
}

export interface FormattedTextExternalProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface AdminBroadcastConsoleProps {
  device: BroadcastDevice;
  token?: string | null;
  isDark: boolean;
  theme: Record<string, string>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  SelectComponent: React.ComponentType<any>;
  RichTextareaComponent: React.ComponentType<RichTextareaExternalProps>;
  FormattedTextComponent: React.ComponentType<FormattedTextExternalProps>;
  checkUrlSecurity: (url: string) => BroadcastUrlSecurityResult;
  cleanDomainString: (url: string) => string;
  useModalBackHandlerHook: (opts: BroadcastModalBackOptions) => void;
  onSummaryChange?: (activeCount: number, subView: string) => void;
  refreshRevision?: number;
}

interface SelectOptionItem {
  value: string;
  label: string;
  desc?: string;
  badge?: string;
  badgeColor?: string;
}

const CATEGORY_OPTIONS: SelectOptionItem[] = [
  { value: 'PENGUMUMAN', label: 'PENGUMUMAN', desc: 'Informasi umum & pembaruan platform', badge: 'Umum' },
  { value: 'SISTEM', label: 'SISTEM', desc: 'Patch atau pembaruan teknis sistem', badge: 'Sistem' },
  { value: 'PROMOSI', label: 'PROMOSI', desc: 'Penawaran diskon & paket langganan', badge: 'Promo' },
  { value: 'PEMELIHARAAN', label: 'PEMELIHARAAN', desc: 'Jadwal maintenance & servis server', badge: 'Maintenance' },
  { value: 'PANDUAN', label: 'PANDUAN', desc: 'Panduan & tutorial fitur baru', badge: 'Edukasi' },
  { value: 'KEAMANAN', label: 'KEAMANAN', desc: 'Pemberitahuan keamanan & privasi', badge: 'Security' },
];

const URGENCY_OPTIONS: SelectOptionItem[] = [
  { value: 'info', label: 'Informasi Standar', desc: 'Notifikasi informatif reguler', badge: 'Info', badgeColor: '#3b82f6' },
  { value: 'warning', label: 'Peringatan / Penting', desc: 'Pemberitahuan penting butuh perhatian segera', badge: 'Penting', badgeColor: '#f59e0b' },
  { value: 'success', label: 'Rilis Fitur & Pembaruan', desc: 'Pengumuman fitur baru atau kabar positif', badge: 'Rilis', badgeColor: '#10b981' },
  { value: 'system', label: 'Sistem & Teknis', desc: 'Pemberitahuan arsitektur & teknis', badge: 'Teknis', badgeColor: '#8b5cf6' },
];

const EXPIRY_OPTIONS: SelectOptionItem[] = [
  { value: '0', label: 'Permanen (Tidak Kedaluwarsa)', desc: 'Tetap aktif di riwayat sampai dicabut', badge: 'Permanen' },
  { value: '24', label: '24 Jam (1 Hari)', desc: 'Kedaluwarsa otomatis setelah 1 hari', badge: '1 Hari' },
  { value: '72', label: '72 Jam (3 Hari)', desc: 'Kedaluwarsa otomatis setelah 3 hari', badge: '3 Hari' },
  { value: '168', label: '168 Jam (7 Hari)', desc: 'Kedaluwarsa otomatis setelah 1 minggu', badge: '7 Hari' },
  { value: '720', label: '720 Jam (30 Hari)', desc: 'Kedaluwarsa otomatis setelah 1 bulan', badge: '30 Hari' },
];

const ACTION_TYPE_OPTIONS: SelectOptionItem[] = [
  { value: 'none', label: 'Hanya Pesan Informasi', desc: 'Tidak membuka menu atau tautan lanjutan', badge: 'Info' },
  { value: 'detail', label: 'Buka Artikel Lengkap (Rich Text)', desc: 'Membuka artikel panduan/pengumuman lengkap saat diklik', badge: 'Artikel' },
  { value: 'navigate', label: 'Navigasi Menu Internal Merchant', desc: 'Mengarahkan merchant langsung ke tab menu tertentu', badge: 'Menu' },
  { value: 'external_link', label: 'Tautan Web Eksternal', desc: 'Mengarahkan merchant ke URL web eksternal dengan guard keamanan', badge: 'URL' },
];

const MENU_OPTIONS: SelectOptionItem[] = [
  { value: 'settings', label: 'Pengaturan Profil & Toko (settings)' },
  { value: 'items', label: 'Inventaris & Produk (items)' },
  { value: 'subscription', label: 'Paket & Langganan (subscription)' },
  { value: 'help', label: 'Pusat Bantuan & Tiket CS (help)' },
  { value: 'share', label: 'Bagikan Katalog & QR (share)' },
  { value: 'analytics', label: 'Dashboard Analitik Toko (analytics)' },
  { value: 'policies', label: 'Kebijakan Toko (policies)' },
  { value: 'profile', label: 'Profil Pengguna (profile)' },
  { value: 'audit_logs', label: 'Log Aktivitas (audit_logs)' },
];

const TARGET_SEGMENT_OPTIONS: SelectOptionItem[] = [
  { value: 'all', label: 'Semua Merchant & Pengguna (Global)', desc: 'Dikirim ke seluruh merchant dan akun terdaftar', badge: 'Global', badgeColor: '#10b981' },
  { value: 'plan', label: 'Berdasarkan Paket Langganan Aktif', desc: 'Target sesuai tier langganan merchant', badge: 'Paket', badgeColor: '#6366f1' },
  { value: 'specific', label: 'Toko / Pengguna Spesifik', desc: 'Pilih satu atau beberapa penerima khusus', badge: 'Spesifik', badgeColor: '#db2777' },
];

const PUBLISH_MODE_OPTIONS: SelectOptionItem[] = [
  { value: 'published', label: 'Terbitkan Langsung (Real-Time SSE)', desc: 'Tayang seketika di lonceng & inbox merchant', badge: 'Live', badgeColor: '#10b981' },
  { value: 'scheduled', label: 'Jadwalkan Publikasi Otomatis', desc: 'Diterbitkan otomatis pada waktu yang ditentukan', badge: 'Jadwal', badgeColor: '#6366f1' },
  { value: 'draft', label: 'Simpan Sebagai Draf', desc: 'Disimpan internal tanpa dikirim ke merchant', badge: 'Draf', badgeColor: '#64748b' },
];

const TARGET_FILTER_OPTIONS: SelectOptionItem[] = [
  { value: 'all', label: 'Semua Target', desc: 'Tampilkan seluruh tipe audiens', badge: 'Semua' },
  { value: 'global', label: 'Global (Semua)', desc: 'Hanya siaran global ke seluruh merchant', badge: 'Global' },
  { value: 'plan', label: 'Paket Langganan', desc: 'Siaran yang menargetkan paket tertentu', badge: 'Paket' },
  { value: 'specific', label: 'Penerima Spesifik', desc: 'Siaran langsung ke toko/akun spesifik', badge: 'Spesifik' },
];

const DESKTOP_PAGE_LIMIT_OPTIONS: SelectOptionItem[] = [
  { value: '10', label: '10 / hal' },
  { value: '25', label: '25 / hal' },
  { value: '50', label: '50 / hal' },
  { value: '100', label: '100 / hal' },
];

const SETTINGS_SUB_TAB_OPTIONS: SelectOptionItem[] = [
  { value: 'general', label: 'Pengaturan Umum Toko (general)' },
  { value: 'about', label: 'Tentang Kami & Profil Usaha (about)' },
  { value: 'contact', label: 'Kontak & Lokasi Maps (contact)' },
  { value: 'theme', label: 'Tema & Tampilan Katalog (theme)' },
  { value: 'master', label: 'Data Master Katalog (master)' },
  { value: 'domain', label: 'Custom Domain Toko (domain)' },
];

function createEmptyMetrics(): BroadcastMetrics {
  return {
    total_broadcasts: 0,
    active_broadcasts: 0,
    draft_broadcasts: 0,
    scheduled_broadcasts: 0,
    revoked_broadcasts: 0,
    global_broadcasts: 0,
    targeted_broadcasts: 0,
    total_reads: 0,
    total_clicks: 0,
    avg_ctr_pct: 0,
  };
}

function defaultFormState(defaultPlan = 'pro_starter'): BroadcastFormPayload {
  return {
    target_type: 'all',
    target_plan_code: defaultPlan,
    target_id: 0,
    target_name: '',
    recipients: [],
    status: 'published',
    scheduled_at: '',
    title: '',
    category: 'PENGUMUMAN',
    message: '',
    detail_content: '',
    type: 'info',
    action_enabled: false,
    action_type: 'none',
    link_sub_tab: 'settings',
    link_mobile_settings_tab: 'general',
    action_label: '',
    action_url: '',
    expires_in_hours: 0,
  };
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `bc_${crypto.randomUUID()}`;
  }
  return `bc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface WindowWithBroadcastGuard extends Window {
  __catavor_is_modal_popping?: boolean;
  __catavor_broadcast_dirty_guard?: (onConfirmExit?: () => void) => boolean;
}

function serializeFormForDirtyCheck(f: BroadcastFormPayload): string {
  return JSON.stringify({
    target_type: f.target_type,
    target_plan_code: f.target_plan_code,
    target_id: f.target_id,
    target_name: f.target_name,
    recipients: (f.recipients || []).map((r) => `${r.type}:${r.id}`),
    status: f.status,
    scheduled_at: f.scheduled_at,
    title: f.title,
    category: f.category,
    message: f.message,
    detail_content: f.detail_content,
    type: f.type,
    action_enabled: f.action_enabled,
    action_type: f.action_type,
    link_sub_tab: f.link_sub_tab,
    link_mobile_settings_tab: f.link_mobile_settings_tab,
    action_label: f.action_label,
    action_url: f.action_url,
    expires_in_hours: f.expires_in_hours,
  });
}

function getCategoryStyle(category: string, urgency?: string): { bg: string; text: string; border: string } {
  const cat = String(category || 'PENGUMUMAN').toUpperCase();
  const urg = String(urgency || 'info').toLowerCase();
  if (cat === 'KEAMANAN') {
    return { bg: 'rgba(244, 63, 94, 0.12)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.32)' };
  }
  if (cat === 'PEMELIHARAAN' || urg === 'warning') {
    return { bg: 'rgba(245, 158, 11, 0.14)', text: '#d97706', border: 'rgba(245, 158, 11, 0.34)' };
  }
  if (cat === 'PROMOSI') {
    return { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.32)' };
  }
  if (cat === 'PANDUAN' || urg === 'success') {
    return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.32)' };
  }
  if (cat === 'SISTEM' || urg === 'system') {
    return { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.32)' };
  }
  return { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.32)' };
}

function resolveEffectiveStatus(item: AdminBroadcastRecord): {
  key: 'draft' | 'scheduled' | 'active' | 'expired' | 'revoked';
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  if (item.status === 'revoked' || Boolean(item.revoked_at)) {
    return {
      key: 'revoked',
      label: 'Dicabut',
      bg: 'rgba(239, 68, 68, 0.12)',
      color: '#ef4444',
      border: 'rgba(239, 68, 68, 0.3)',
    };
  }
  if (item.status === 'draft') {
    return {
      key: 'draft',
      label: 'Draf',
      bg: 'rgba(100, 116, 139, 0.14)',
      color: '#64748b',
      border: 'rgba(100, 116, 139, 0.3)',
    };
  }
  if (item.status === 'scheduled') {
    return {
      key: 'scheduled',
      label: 'Terjadwal',
      bg: 'rgba(99, 102, 241, 0.14)',
      color: '#6366f1',
      border: 'rgba(99, 102, 241, 0.3)',
    };
  }
  if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) {
    return {
      key: 'expired',
      label: 'Kedaluwarsa',
      bg: 'rgba(148, 163, 184, 0.14)',
      color: '#64748b',
      border: 'rgba(148, 163, 184, 0.28)',
    };
  }
  return {
    key: 'active',
    label: 'Aktif Tayang',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.3)',
  };
}

function formatDateTimeID(raw?: string | null): string {
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '-';
  return d
    .toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/\./g, ':');
}

function toLocalDateTimeInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTargetBadgeMeta(
  item: AdminBroadcastRecord,
  planMap: Map<string, SubscriptionPlanOption>
): { label: string; bg: string; color: string; border: string } {
  const tt = String(item.target_type || 'all').toLowerCase();
  if (tt === 'all') {
    return {
      label: 'SEMUA MERCHANT',
      bg: 'rgba(16, 185, 129, 0.12)',
      color: '#10b981',
      border: 'rgba(16, 185, 129, 0.3)',
    };
  }
  if (tt === 'plan') {
    const code = String(item.target_plan_code || '').toLowerCase();
    const matched = planMap.get(code);
    const label = matched ? `PAKET ${matched.name.toUpperCase()}` : `PAKET ${code.toUpperCase() || 'KHUSUS'}`;
    return {
      label,
      bg: 'rgba(99, 102, 241, 0.12)',
      color: '#6366f1',
      border: 'rgba(99, 102, 241, 0.3)',
    };
  }
  const count = item.recipients?.length || 0;
  const label = count > 0 ? `SPESIFIK (${count})` : item.target_name || 'PENERIMA SPESIFIK';
  return {
    label,
    bg: 'rgba(236, 72, 153, 0.12)',
    color: '#db2777',
    border: 'rgba(236, 72, 153, 0.3)',
  };
}

function getDefaultActionLabel(actionType: BroadcastActionType, linkSubTab: string, actionUrl: string): string {
  if (actionType === 'detail') return 'Baca Artikel Lengkap';
  if (actionType === 'navigate') {
    const opt = MENU_OPTIONS.find((m) => m.value === linkSubTab);
    return opt ? `Buka ${opt.label.split(' (')[0]}` : 'Buka Menu Terkait';
  }
  if (actionType === 'external_link') {
    if (actionUrl) {
      try {
        const parsed = new URL(actionUrl.startsWith('http') ? actionUrl : `https://${actionUrl}`);
        return `Kunjungi ${parsed.hostname.replace(/^www\./, '')}`;
      } catch { }
    }
    return 'Buka Tautan Luar';
  }
  return '';
}

interface ConfirmDialogState {
  kind: 'publish' | 'revoke' | 'delete';
  item: AdminBroadcastRecord;
}

export const AdminBroadcastConsole: React.FC<AdminBroadcastConsoleProps> = ({
  device,
  token,
  isDark,
  theme,
  onToast,
  SelectComponent,
  RichTextareaComponent,
  FormattedTextComponent,
  checkUrlSecurity,
  cleanDomainString,
  useModalBackHandlerHook,
  onSummaryChange,
  refreshRevision = 0,
}) => {
  const isMobile = device === 'mobile';
  const isTablet = device === 'tablet';
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isTabletSplit = isTablet && viewportWidth >= 880;
  const surfaceBg = theme.surface || theme.card || (isDark ? '#111827' : '#ffffff');
  const cardBg = theme.card || surfaceBg;
  const deepBg = theme.cardAlt || theme.inputBg || (isDark ? '#0f172a' : '#f8fafc');
  const borderCol = theme.border || (isDark ? 'rgba(255,255,255,0.09)' : '#e2e8f0');
  const inputBg = theme.inputBg || deepBg;
  const inputBorder = theme.inputBorder || borderCol;
  const textPrimary = theme.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = theme.textSecondary || (isDark ? '#94a3b8' : '#475569');
  const textMuted = theme.textMuted || '#64748b';
  const cardShadow = theme.cardShadow || '0 1px 3px rgba(15, 23, 42, 0.06)';
  const minTouchHeight = isDesktopOrZero(device);

  function isDesktopOrZero(dev: BroadcastDevice): number {
    return dev === 'desktop' ? 38 : 44;
  }

  const renderFieldSelect = (cfg: {
    value: string;
    onChange: (val: string) => void;
    options: SelectOptionItem[];
    title: string;
    subtitle?: string;
    disabled?: boolean;
    ariaLabel?: string;
    align?: 'left' | 'right' | 'auto';
  }) => {
    const mappedOptions = cfg.options.map((o) => ({
      value: o.value,
      label: o.label,
      description: o.desc,
      badge: o.badge,
      badgeColor: o.badgeColor,
    }));

    if (isMobile) {
      return (
        <SelectComponent
          value={cfg.value}
          onChange={cfg.onChange}
          options={mappedOptions}
          title={cfg.title}
          subtitle={cfg.subtitle}
          disabled={cfg.disabled}
          ariaLabel={cfg.ariaLabel || cfg.title}
          interceptBack={true}
          searchable={mappedOptions.length >= 7}
          triggerStyle={{
            minHeight: '44px',
            backgroundColor: inputBg,
            border: `1.5px solid ${inputBorder}`,
            color: textPrimary,
            borderRadius: '0.7rem',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        />
      );
    }

    if (isTablet) {
      return (
        <SelectComponent
          value={cfg.value}
          onChange={cfg.onChange}
          options={mappedOptions}
          disabled={cfg.disabled}
          ariaLabel={cfg.ariaLabel || cfg.title}
          interceptBack={true}
          variant="default"
          align={cfg.align || 'auto'}
          searchable={mappedOptions.length >= 7}
          style={{ width: '100%' }}
          triggerStyle={{
            minHeight: '44px',
            backgroundColor: inputBg,
            border: `1px solid ${inputBorder}`,
            color: textPrimary,
            borderRadius: '0.65rem',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
          menuStyle={{
            backgroundColor: surfaceBg,
            border: `1px solid ${borderCol}`,
          }}
        />
      );
    }

    return (
      <SelectComponent
        value={cfg.value}
        onChange={cfg.onChange}
        options={mappedOptions.map((o) => ({ value: o.value, label: o.label }))}
        disabled={cfg.disabled}
        ariaLabel={cfg.ariaLabel || cfg.title}
        align={cfg.align || 'auto'}
        searchable={mappedOptions.length >= 8}
        triggerStyle={{
          height: '40px',
          background: inputBg,
          border: `1px solid ${inputBorder}`,
          color: textPrimary,
          borderRadius: '0.65rem',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
        dropdownStyle={{
          background: surfaceBg,
          backgroundColor: surfaceBg,
          border: `1px solid ${borderCol}`,
        }}
      />
    );
  };

  // Subscription plans (single source of truth from backend /api/subscription/plans)
  const [plans, setPlans] = useState<SubscriptionPlanOption[]>([]);
  useEffect(() => {
    let active = true;
    fetchSubscriptionPlans(token).then((loaded) => {
      if (active) setPlans(loaded);
    });
    return () => {
      active = false;
    };
  }, [token]);

  const planMap = useMemo(() => {
    const m = new Map<string, SubscriptionPlanOption>();
    for (const p of plans) {
      m.set(p.code.toLowerCase(), p);
    }
    return m;
  }, [plans]);

  // Subview & URL state sync
  const [subView, setSubView] = useState<'list' | 'create' | 'edit' | 'detail'>(() => {
    if (typeof window === 'undefined') return 'list';
    const params = new URLSearchParams(window.location.search);
    const sub = (params.get('subview') || params.get('subtab') || '').toLowerCase();
    const bid = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
    if (sub === 'create' || sub === 'new') return 'create';
    if (sub === 'edit' && bid) return 'edit';
    if (bid && device !== 'tablet') return 'detail';
    return 'list';
  });

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
  });

  const [items, setItems] = useState<AdminBroadcastRecord[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<AdminBroadcastRecord | null>(null);
  const [metrics, setMetrics] = useState<BroadcastMetrics>(createEmptyMetrics);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(isMobile ? 10 : isTablet ? 15 : 10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'scheduled' | 'expired' | 'revoked'>('all');
  const [targetFilter, setTargetFilter] = useState<'all' | 'global' | 'plan' | 'specific'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultPlanCode = useMemo(() => {
    const paid = plans.find((p) => p.code !== 'free');
    return paid ? paid.code : 'pro_starter';
  }, [plans]);

  const [form, setForm] = useState<BroadcastFormPayload>(() => defaultFormState('pro_starter'));
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newIdempotencyKey());
  const [recipientQuery, setRecipientQuery] = useState<string>('');
  const [recipientResults, setRecipientResults] = useState<BroadcastRecipient[]>([]);
  const [isSearchingRecipients, setIsSearchingRecipients] = useState<boolean>(false);

  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState<boolean>(false);

  // Mobile drag-to-dismiss bottom sheet picker & confirmation physics (AGENTS.md Rule 7.A.3)
  const [mobileSheetDragY, setMobileSheetDragY] = useState<number>(0);
  const [isDraggingMobileSheet, setIsDraggingMobileSheet] = useState<boolean>(false);
  const dragStartYRef = useRef<number | null>(null);

  const resetMobileSheetDrag = useCallback(() => {
    setIsDraggingMobileSheet(false);
    setMobileSheetDragY(0);
    dragStartYRef.current = null;
  }, []);

  // Unsaved-changes confirmation guard & mobile bottom sheet physics
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const initialFormSnapshotRef = useRef<string>('');
  const formUrlRef = useRef<string>('');
  const pendingExitActionRef = useRef<(() => void) | null>(null);
  const allowDiscardPopRef = useRef<boolean>(false);
  const lastGuardBlockTsRef = useRef<number>(0);

  const [discardSheetDragY, setDiscardSheetDragY] = useState<number>(0);
  const [isDraggingDiscardSheet, setIsDraggingDiscardSheet] = useState<boolean>(false);
  const discardDragStartYRef = useRef<number | null>(null);

  const isInForm = subView === 'create' || subView === 'edit';
  const isFormDirty = useMemo(
    () =>
      isInForm &&
      initialFormSnapshotRef.current !== '' &&
      serializeFormForDirtyCheck(form) !== initialFormSnapshotRef.current,
    [isInForm, form]
  );

  const isInFormRef = useRef<boolean>(isInForm);
  const isFormDirtyRef = useRef<boolean>(isFormDirty);
  const isSubmittingRef = useRef<boolean>(isSubmitting);
  const subViewRef = useRef(subView);
  const editingIdRef = useRef(editingId);
  const showDiscardConfirmRef = useRef<boolean>(showDiscardConfirm);
  isInFormRef.current = isInForm;
  isFormDirtyRef.current = isFormDirty;
  isSubmittingRef.current = isSubmitting;
  subViewRef.current = subView;
  editingIdRef.current = editingId;
  showDiscardConfirmRef.current = showDiscardConfirm;

  useEffect(() => {
    if (!isMobile || !showDiscardConfirm || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile, showDiscardConfirm]);

  useEffect(() => {
    if (isInForm && initialFormSnapshotRef.current === '') {
      initialFormSnapshotRef.current = serializeFormForDirtyCheck(form);
    }
    if (isInForm && typeof window !== 'undefined') {
      formUrlRef.current = window.location.href;
    }
  }, [isInForm, form]);

  const resetDiscardSheetDrag = useCallback(() => {
    setIsDraggingDiscardSheet(false);
    setDiscardSheetDragY(0);
    discardDragStartYRef.current = null;
  }, []);

  const closeConfirmDialog = useCallback(() => {
    if (isExecutingAction) return;
    setConfirmState(null);
    resetMobileSheetDrag();
  }, [isExecutingAction, resetMobileSheetDrag]);

  const closeDiscardConfirm = useCallback(() => {
    pendingExitActionRef.current = null;
    setShowDiscardConfirm(false);
    resetDiscardSheetDrag();
  }, [resetDiscardSheetDrag]);

  useModalBackHandlerHook({
    isOpen: Boolean(confirmState),
    onClose: closeConfirmDialog,
    modalId: `broadcast-confirm-${device}`,
  });

  // Sync URL navigation
  const pushBroadcastUrl = useCallback((nextView: string, nextId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'broadcast');
    if (nextView === 'create') {
      url.searchParams.set('subview', 'create');
      url.searchParams.delete('broadcast_id');
    } else if (nextView === 'edit' && nextId) {
      url.searchParams.set('subview', 'edit');
      url.searchParams.set('broadcast_id', nextId);
    } else if (nextId) {
      url.searchParams.set('subview', 'detail');
      url.searchParams.set('broadcast_id', nextId);
    } else {
      url.searchParams.delete('subview');
      url.searchParams.delete('broadcast_id');
      url.searchParams.delete('broadcast');
      url.searchParams.delete('notif_id');
    }
    const nextHref = url.toString();
    if (nextView === 'create' || nextView === 'edit') {
      formUrlRef.current = nextHref;
    }
    window.history.pushState({ view: 'broadcast', subView: nextView, broadcastId: nextId }, '', nextHref);
  }, []);

  const performExitToList = useCallback(() => {
    initialFormSnapshotRef.current = '';
    setShowDiscardConfirm(false);
    resetDiscardSheetDrag();
    setSubView('list');
    setEditingId(null);
    setSelectedId(null);
    setSelectedDetail(null);
    pushBroadcastUrl('list', null);
  }, [pushBroadcastUrl, resetDiscardSheetDrag]);

  const confirmDiscardAndExit = useCallback(() => {
    const exitAction = pendingExitActionRef.current;
    pendingExitActionRef.current = null;
    allowDiscardPopRef.current = true;
    initialFormSnapshotRef.current = '';
    if (typeof window !== 'undefined') {
      delete (window as WindowWithBroadcastGuard).__catavor_broadcast_dirty_guard;
    }
    setShowDiscardConfirm(false);
    resetDiscardSheetDrag();
    if (exitAction) {
      exitAction();
    } else {
      performExitToList();
    }
    window.setTimeout(() => {
      allowDiscardPopRef.current = false;
    }, 100);
  }, [performExitToList, resetDiscardSheetDrag]);

  const requestExitForm = useCallback(
    (onConfirmExit?: () => void) => {
      if (isInFormRef.current && isFormDirtyRef.current && !isSubmittingRef.current) {
        pendingExitActionRef.current = onConfirmExit || null;
        setShowDiscardConfirm(true);
        return;
      }
      if (onConfirmExit) {
        initialFormSnapshotRef.current = '';
        onConfirmExit();
      } else {
        performExitToList();
      }
    },
    [performExitToList]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as WindowWithBroadcastGuard;
    if (!isInForm || !isFormDirty) {
      delete win.__catavor_broadcast_dirty_guard;
      return;
    }
    const guard = (onConfirmExit?: () => void): boolean => {
      if (!isInFormRef.current || !isFormDirtyRef.current || allowDiscardPopRef.current) {
        return false;
      }
      const now = Date.now();
      if (now - lastGuardBlockTsRef.current < 150) {
        return true;
      }
      lastGuardBlockTsRef.current = now;
      if (!onConfirmExit && formUrlRef.current) {
        window.history.pushState(
          { view: 'broadcast', subView: subViewRef.current, broadcastId: editingIdRef.current },
          '',
          formUrlRef.current
        );
      }
      if (showDiscardConfirmRef.current && !onConfirmExit) {
        // Back pressed while confirmation sheet/modal is open -> close dialog and stay in form (AGENTS.md Rule 2)
        pendingExitActionRef.current = null;
        setShowDiscardConfirm(false);
        resetDiscardSheetDrag();
        return true;
      }
      pendingExitActionRef.current = onConfirmExit || null;
      setShowDiscardConfirm(true);
      return true;
    };
    win.__catavor_broadcast_dirty_guard = guard;
    return () => {
      if (win.__catavor_broadcast_dirty_guard === guard) {
        delete win.__catavor_broadcast_dirty_guard;
      }
    };
  }, [isInForm, isFormDirty, resetDiscardSheetDrag]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRequestBack = (ev: Event) => {
      if (!isInFormRef.current) return;
      ev.preventDefault();
      requestExitForm();
    };
    window.addEventListener('catavor:broadcast-request-back', onRequestBack);
    return () => window.removeEventListener('catavor:broadcast-request-back', onRequestBack);
  }, [requestExitForm]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isInForm || !isFormDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isInForm, isFormDirty]);

  useEffect(() => {
    if (!showDiscardConfirm || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDiscardConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDiscardConfirm, closeDiscardConfirm]);

  useEffect(() => {
    const onPopState = () => {
      if (typeof window === 'undefined') return;
      const win = window as WindowWithBroadcastGuard;
      if (win.__catavor_is_modal_popping) {
        return;
      }
      if (win.__catavor_broadcast_dirty_guard && win.__catavor_broadcast_dirty_guard()) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const sub = (params.get('subview') || '').toLowerCase();
      const bid = params.get('broadcast_id');
      if (sub === 'create') {
        setSubView('create');
        setSelectedId(null);
        setSelectedDetail(null);
      } else if (sub === 'edit' && bid) {
        setSubView('edit');
        setSelectedId(bid);
      } else if (bid) {
        setSelectedId(bid);
        setSubView(isTablet ? 'list' : 'detail');
      } else {
        setSelectedId(null);
        setSelectedDetail(null);
        setSubView('list');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isTablet]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Recipient search debounce
  useEffect(() => {
    const q = recipientQuery.trim();
    if (!q || form.target_type !== 'specific') {
      setRecipientResults([]);
      setIsSearchingRecipients(false);
      return;
    }
    let cancelled = false;
    setIsSearchingRecipients(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchBroadcastRecipients(q, token);
        if (!cancelled) setRecipientResults(res);
      } finally {
        if (!cancelled) setIsSearchingRecipients(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [recipientQuery, form.target_type, token]);

  const loadBroadcasts = useCallback(
    async (targetPage = page, silent = false) => {
      if (!silent) setIsLoadingList(true);
      try {
        const resp = await fetchAdminBroadcasts(
          {
            page: targetPage,
            limit,
            status: statusFilter,
            target: targetFilter,
            category: categoryFilter,
            q: debouncedSearch,
          },
          token
        );
        const list = Array.isArray(resp.data) ? resp.data : [];
        setItems(list);
        if (resp.metrics) setMetrics(resp.metrics);
        if (resp.pagination) {
          setPage(resp.pagination.page || targetPage);
          setTotalPages(Math.max(1, resp.pagination.total_pages || 1));
          setTotalItems(resp.pagination.total_items ?? list.length);
        } else {
          setTotalItems(list.length);
        }

        if (isTabletSplit && !selectedId && list.length > 0 && subView === 'list') {
          setSelectedId(list[0].id);
          setSelectedDetail(list[0]);
        }
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Gagal memuat daftar siaran', 'error');
      } finally {
        setIsLoadingList(false);
      }
    },
    [page, limit, statusFilter, targetFilter, categoryFilter, debouncedSearch, token, isTabletSplit, selectedId, subView, onToast]
  );

  useEffect(() => {
    loadBroadcasts(1);
  }, [statusFilter, targetFilter, categoryFilter, debouncedSearch, limit]);

  useEffect(() => {
    if (refreshRevision > 0) {
      loadBroadcasts(page, false);
    }
  }, [refreshRevision]);

  useEffect(() => {
    if (onSummaryChange) {
      onSummaryChange(metrics.active_broadcasts, subView);
    }
  }, [metrics.active_broadcasts, subView, onSummaryChange]);

  const loadSingleDetail = useCallback(
    async (id: string) => {
      setIsLoadingDetail(true);
      try {
        const detail = await fetchAdminBroadcastDetail(id, token);
        setSelectedDetail(detail);
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Rincian siaran tidak ditemukan', 'error');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [token, onToast]
  );

  useEffect(() => {
    if (selectedId) {
      const fromList = items.find((i) => i.id === selectedId);
      if (fromList) {
        setSelectedDetail(fromList);
      } else {
        loadSingleDetail(selectedId);
      }
    }
  }, [selectedId, items, loadSingleDetail]);

  const handleOpenCreate = () => {
    const nextForm = defaultFormState(defaultPlanCode);
    setEditingId(null);
    setForm(nextForm);
    initialFormSnapshotRef.current = serializeFormForDirtyCheck(nextForm);
    setIdempotencyKey(newIdempotencyKey());
    setRecipientQuery('');
    setRecipientResults([]);
    setSubView('create');
    setSelectedId(null);
    setSelectedDetail(null);
    pushBroadcastUrl('create', null);
  };

  const handleOpenEdit = (item: AdminBroadcastRecord) => {
    setEditingId(item.id);
    const actionType = (item.action_type || 'none') as BroadcastActionType;
    const nextForm: BroadcastFormPayload = {
      target_type: (item.target_type || 'all') as BroadcastTargetType,
      target_plan_code: item.target_plan_code || defaultPlanCode,
      target_id: item.target_id || 0,
      target_name: item.target_name || '',
      recipients: Array.isArray(item.recipients) ? item.recipients : [],
      status: item.status === 'draft' || item.status === 'scheduled' ? item.status : 'published',
      scheduled_at: toLocalDateTimeInputValue(item.scheduled_at),
      title: item.title || '',
      category: item.category || 'PENGUMUMAN',
      message: item.message || '',
      detail_content: item.detail_content || '',
      type: (item.type || 'info') as BroadcastUrgency,
      action_enabled: Boolean(item.action_enabled && actionType !== 'none'),
      action_type: actionType,
      link_sub_tab: item.link_sub_tab || 'settings',
      link_mobile_settings_tab: item.link_mobile_settings_tab || 'general',
      action_label: item.action_label || '',
      action_url: item.action_url || '',
      expires_in_hours: 0,
    };
    setForm(nextForm);
    initialFormSnapshotRef.current = serializeFormForDirtyCheck(nextForm);
    setRecipientQuery('');
    setRecipientResults([]);
    setSubView('edit');
    pushBroadcastUrl('edit', item.id);
  };

  const handleSelectItem = (item: AdminBroadcastRecord) => {
    setSelectedId(item.id);
    setSelectedDetail(item);
    if (!isTablet) {
      setSubView('detail');
    }
    pushBroadcastUrl('detail', item.id);
    loadSingleDetail(item.id);
  };

  const handleBackToList = () => {
    if (isInFormRef.current) {
      requestExitForm();
      return;
    }
    performExitToList();
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.title.trim() || !form.message.trim()) {
      onToast('Judul dan ringkasan pesan siaran wajib diisi', 'error');
      return;
    }
    if (form.target_type === 'plan' && !form.target_plan_code.trim()) {
      onToast('Pilih paket langganan target terlebih dahulu', 'error');
      return;
    }
    if (form.target_type === 'specific' && form.recipients.length === 0) {
      onToast('Tambahkan minimal 1 toko atau pengguna pada penerima spesifik', 'error');
      return;
    }
    if (form.status === 'scheduled') {
      if (!form.scheduled_at) {
        onToast('Tentukan tanggal dan waktu penjadwalan', 'error');
        return;
      }
      const schedDate = new Date(form.scheduled_at);
      if (Number.isNaN(schedDate.getTime()) || schedDate.getTime() <= Date.now()) {
        onToast('Waktu penjadwalan harus lebih lambat dari waktu saat ini', 'error');
        return;
      }
    }

    const effectiveActionType: BroadcastActionType =
      form.action_enabled && form.action_type !== 'none' ? form.action_type : 'none';
    if (effectiveActionType === 'detail' && !form.detail_content.trim()) {
      onToast('Isi artikel lengkap wajib diisi untuk tipe aksi Artikel Detail', 'error');
      return;
    }
    if (effectiveActionType === 'external_link' && !form.action_url.trim()) {
      onToast('URL tautan eksternal wajib diisi', 'error');
      return;
    }

    const finalPayload: BroadcastFormPayload = {
      ...form,
      action_enabled: effectiveActionType !== 'none',
      action_type: effectiveActionType,
      detail_content: effectiveActionType === 'detail' ? form.detail_content : '',
      link_sub_tab: effectiveActionType === 'navigate' ? form.link_sub_tab : '',
      link_mobile_settings_tab:
        effectiveActionType === 'navigate' && form.link_sub_tab === 'settings'
          ? form.link_mobile_settings_tab
          : '',
      action_url: effectiveActionType === 'external_link' ? form.action_url.trim() : '',
      action_label:
        effectiveActionType !== 'none'
          ? form.action_label.trim() ||
          getDefaultActionLabel(effectiveActionType, form.link_sub_tab, form.action_url)
          : '',
      scheduled_at:
        form.status === 'scheduled' && form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : undefined,
    };

    setIsSubmitting(true);
    try {
      if (subView === 'edit' && editingId) {
        const res = await updateAdminBroadcast(editingId, finalPayload, token);
        initialFormSnapshotRef.current = '';
        onToast(res.message || 'Perubahan siaran berhasil disimpan', 'success');
        setSelectedDetail(res.notification);
        setSelectedId(res.notification.id);
        setSubView(isTablet ? 'list' : 'detail');
        pushBroadcastUrl('detail', res.notification.id);
      } else {
        const res = await createAdminBroadcast(finalPayload, idempotencyKey, token);
        initialFormSnapshotRef.current = '';
        onToast(res.message || 'Siaran berhasil diproses', 'success');
        setSubView('list');
        setSelectedId(isTabletSplit ? res.notification.id : null);
        setSelectedDetail(isTabletSplit ? res.notification : null);
        setIdempotencyKey(newIdempotencyKey());
        pushBroadcastUrl('list', null);
      }
      await loadBroadcasts(1, true);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal menyimpan siaran', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!confirmState || isExecutingAction) return;
    setIsExecutingAction(true);
    const { kind, item } = confirmState;
    try {
      if (kind === 'publish') {
        const res = await publishAdminBroadcast(item.id, token);
        onToast(res.message || 'Siaran diterbitkan', 'success');
        if (selectedDetail?.id === item.id) setSelectedDetail(res.notification);
      } else if (kind === 'revoke') {
        const res = await revokeAdminBroadcast(item.id, token);
        onToast(res.message || 'Siaran dicabut dari merchant', 'success');
        if (selectedDetail?.id === item.id) setSelectedDetail(res.notification);
      } else if (kind === 'delete') {
        const res = await deleteAdminBroadcast(item.id, token);
        onToast(res.message || 'Siaran dihapus permanen', 'success');
        if (selectedId === item.id) {
          setSelectedId(null);
          setSelectedDetail(null);
          if (subView === 'detail') setSubView('list');
          pushBroadcastUrl('list', null);
        }
      }
      setConfirmState(null);
      resetMobileSheetDrag();
      await loadBroadcasts(page, true);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Tindakan gagal diproses', 'error');
    } finally {
      setIsExecutingAction(false);
    }
  };

  const renderDiscardConfirmOverlay = () => {
    if (!showDiscardConfirm) return null;
    const discardTitle = 'Buang Perubahan?';
    const discardDesc =
      'Perubahan pada formulir siaran belum disimpan dan akan terhapus jika Anda keluar sekarang. Tetap lanjut mengedit?';

    if (isMobile) {
      return (
        <div
          onClick={closeDiscardConfirm}
          role="dialog"
          aria-modal="true"
          aria-label={discardTitle}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: surfaceBg,
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              borderTop: `1px solid ${borderCol}`,
              padding: '0 1rem 1.25rem',
              transform: `translateY(${discardSheetDragY}px)`,
              transition: isDraggingDiscardSheet ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.28)',
              boxSizing: 'border-box',
            }}
          >
            {/* Clean Drag Handle & Header (NO Close/X button per AGENTS.md Rule 7.A.3) */}
            <div
              style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
              onTouchStart={(e) => {
                discardDragStartYRef.current = e.touches[0].clientY;
                setIsDraggingDiscardSheet(true);
              }}
              onTouchMove={(e) => {
                if (discardDragStartYRef.current === null) return;
                const delta = e.touches[0].clientY - discardDragStartYRef.current;
                setDiscardSheetDragY(delta < 0 ? delta * 0.18 : delta);
              }}
              onTouchEnd={() => {
                if (discardSheetDragY >= 70) {
                  closeDiscardConfirm();
                } else {
                  resetDiscardSheetDrag();
                }
              }}
            >
              <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '44px',
                    height: '5px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  paddingBottom: '0.85rem',
                  borderBottom: `1px solid ${borderCol}`,
                  marginBottom: '0.85rem',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} color="#f59e0b" />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary, textAlign: 'center' }}>
                  {discardTitle}
                </h4>
              </div>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: textSecondary, lineHeight: 1.5, textAlign: 'center' }}>
              {discardDesc}
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={closeDiscardConfirm}
                style={{
                  flex: 1.15,
                  minHeight: '44px',
                  borderRadius: '0.75rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: deepBg,
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Lanjut Edit
              </button>
              <button
                type="button"
                onClick={confirmDiscardAndExit}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: '0.75rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Buang &amp; Keluar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={closeDiscardConfirm}
        role="dialog"
        aria-modal="true"
        aria-label={discardTitle}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          zIndex: 10005,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: surfaceBg,
            borderRadius: '1rem',
            border: `1px solid ${borderCol}`,
            padding: '1.25rem',
            boxShadow: '0 20px 45px rgba(0,0,0,0.28)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <AlertTriangle size={19} color="#f59e0b" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary }}>{discardTitle}</h4>
            </div>
            <button
              type="button"
              onClick={closeDiscardConfirm}
              aria-label="Tutup"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textSecondary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '0.84rem', color: textSecondary, lineHeight: 1.55 }}>{discardDesc}</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.25rem' }}>
            <button
              type="button"
              onClick={closeDiscardConfirm}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.55rem 1.05rem',
                borderRadius: '0.65rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textPrimary,
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Lanjut Edit
            </button>
            <button
              type="button"
              onClick={confirmDiscardAndExit}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.55rem 1.15rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Buang &amp; Keluar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmOverlay = () => {
    if (!confirmState) return null;
    const { kind, item } = confirmState;
    const title =
      kind === 'delete'
        ? 'Hapus Siaran Permanen'
        : kind === 'revoke'
          ? 'Cabut Tayangan Siaran'
          : 'Terbitkan Siaran Sekarang';
    const desc =
      kind === 'delete'
        ? `Siaran "${item.title}" beserta seluruh data pembaca akan dihapus permanen dari database dan menghilang real-time dari perangkat merchant.`
        : kind === 'revoke'
          ? `Siaran "${item.title}" akan dicabut seketika dari seluruh kotak masuk merchant via real-time SSE, tetapi jejak audit & analitik keterbacaan (${item.read_count} baca) tetap tersimpan.`
          : `Siaran "${item.title}" akan langsung diterbitkan sekarang dan dikirim ke perangkat target audiens via real-time SSE.`;
    const confirmBg = kind === 'publish' ? '#10b981' : '#ef4444';
    const confirmLabel =
      kind === 'delete' ? 'Ya, Hapus Permanen' : kind === 'revoke' ? 'Ya, Cabut Tayangan' : 'Ya, Terbitkan Sekarang';

    if (isMobile) {
      return (
        <div
          onClick={closeConfirmDialog}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: surfaceBg,
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              borderTop: `1px solid ${borderCol}`,
              padding: '0 1rem 1.25rem',
              transform: `translateY(${mobileSheetDragY}px)`,
              transition: isDraggingMobileSheet ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.28)',
              boxSizing: 'border-box',
            }}
          >
            {/* Clean Drag Handle & Header (NO Close/X button per AGENTS.md Rule 7.A.3) */}
            <div
              style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
              onTouchStart={(e) => {
                dragStartYRef.current = e.touches[0].clientY;
                setIsDraggingMobileSheet(true);
              }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === null) return;
                const delta = e.touches[0].clientY - dragStartYRef.current;
                setMobileSheetDragY(delta < 0 ? delta * 0.18 : delta);
              }}
              onTouchEnd={() => {
                if (mobileSheetDragY >= 70) {
                  closeConfirmDialog();
                } else {
                  resetMobileSheetDrag();
                }
              }}
            >
              <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '44px',
                    height: '5px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.85rem', borderBottom: `1px solid ${borderCol}`, marginBottom: '0.85rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    backgroundColor: kind === 'publish' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {kind === 'publish' ? (
                    <Send size={19} color="#10b981" />
                  ) : kind === 'revoke' ? (
                    <Archive size={19} color="#ef4444" />
                  ) : (
                    <Trash2 size={19} color="#ef4444" />
                  )}
                </div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary, textAlign: 'center' }}>
                  {title}
                </h4>
              </div>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: textSecondary, lineHeight: 1.5 }}>
              {desc}
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={isExecutingAction}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: '0.75rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: deepBg,
                  color: textPrimary,
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmExecute}
                disabled={isExecutingAction}
                style={{
                  flex: 1.3,
                  minHeight: '44px',
                  borderRadius: '0.75rem',
                  border: 'none',
                  backgroundColor: confirmBg,
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  opacity: isExecutingAction ? 0.7 : 1,
                }}
              >
                {isExecutingAction ? 'Memproses...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={closeConfirmDialog}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: isTablet ? '480px' : '440px',
            backgroundColor: surfaceBg,
            borderRadius: '1rem',
            border: `1px solid ${borderCol}`,
            padding: '1.25rem',
            boxShadow: '0 20px 45px rgba(0,0,0,0.28)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              {kind === 'publish' ? (
                <Send size={18} color="#10b981" />
              ) : kind === 'revoke' ? (
                <Archive size={18} color="#ef4444" />
              ) : (
                <Trash2 size={18} color="#ef4444" />
              )}
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary }}>{title}</h4>
            </div>
            <button
              type="button"
              onClick={closeConfirmDialog}
              aria-label="Tutup"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textSecondary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '0.84rem', color: textSecondary, lineHeight: 1.55 }}>{desc}</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.25rem' }}>
            <button
              type="button"
              onClick={closeConfirmDialog}
              disabled={isExecutingAction}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.55rem 1.05rem',
                borderRadius: '0.65rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textPrimary,
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmExecute}
              disabled={isExecutingAction}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.55rem 1.15rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: confirmBg,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: isExecutingAction ? 0.7 : 1,
              }}
            >
              {isExecutingAction ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPanel = (detail: AdminBroadcastRecord) => {
    const statusMeta = resolveEffectiveStatus(detail);
    const targetMeta = getTargetBadgeMeta(detail, planMap);
    const catStyle = getCategoryStyle(detail.category, detail.type);
    const recips = Array.isArray(detail.recipients) ? detail.recipients : [];
    const effectiveAction = (detail.action_type || 'none') as BroadcastActionType;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!isTabletSplit && !isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleBackToList}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.45rem 0.9rem',
                borderRadius: '0.65rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: cardBg,
                color: textPrimary,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ArrowLeft size={15} />
              <span>Kembali ke Daftar Siaran</span>
            </button>

            <span style={{ fontSize: '0.74rem', color: textMuted, fontWeight: 600 }}>ID: {detail.id}</span>
          </div>
        )}

        <div
          style={{
            padding: isMobile ? '1rem' : '1.25rem',
            borderRadius: '1rem',
            backgroundColor: surfaceBg,
            border: `1px solid ${borderCol}`,
            boxShadow: cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Badges + Actions Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '0.65rem',
              borderBottom: `1px solid ${borderCol}`,
              paddingBottom: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '0.4rem',
                  backgroundColor: catStyle.bg,
                  color: catStyle.text,
                  border: `1px solid ${catStyle.border}`,
                  textTransform: 'uppercase',
                }}
              >
                {detail.category || 'PENGUMUMAN'}
              </span>

              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '0.4rem',
                  backgroundColor: targetMeta.bg,
                  color: targetMeta.color,
                  border: `1px solid ${targetMeta.border}`,
                }}
              >
                {targetMeta.label}
              </span>

              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: statusMeta.bg,
                  color: statusMeta.color,
                  border: `1px solid ${statusMeta.border}`,
                }}
              >
                {statusMeta.label}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {statusMeta.key !== 'revoked' && (
                <button
                  type="button"
                  onClick={() => handleOpenEdit(detail)}
                  style={{
                    minHeight: `${minTouchHeight}px`,
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.6rem',
                    border: `1px solid ${borderCol}`,
                    backgroundColor: deepBg,
                    color: textPrimary,
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Edit3 size={13} />
                  <span>Edit</span>
                </button>
              )}

              {(statusMeta.key === 'draft' || statusMeta.key === 'scheduled') && (
                <button
                  type="button"
                  onClick={() => setConfirmState({ kind: 'publish', item: detail })}
                  style={{
                    minHeight: `${minTouchHeight}px`,
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.6rem',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    backgroundColor: 'rgba(16, 185, 129, 0.14)',
                    color: '#10b981',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Send size={13} />
                  <span>Terbitkan Sekarang</span>
                </button>
              )}

              {statusMeta.key === 'active' && (
                <button
                  type="button"
                  onClick={() => setConfirmState({ kind: 'revoke', item: detail })}
                  style={{
                    minHeight: `${minTouchHeight}px`,
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.6rem',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                    color: '#d97706',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Archive size={13} />
                  <span>Cabut Tayangan</span>
                </button>
              )}
            </div>
          </div>

          <h3 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 800, color: textPrimary, lineHeight: 1.35 }}>
            {detail.title}
          </h3>

          {/* Analytics & Timestamps Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: '0.65rem',
            }}
          >
            <div style={{ padding: '0.7rem 0.8rem', borderRadius: '0.75rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Keterbacaan</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem' }}>
                {detail.read_count || 0} / {detail.target_audience_count || '-'}
              </div>
              <div style={{ fontSize: '0.68rem', color: textSecondary }}>
                Reach: {(detail.read_rate_pct || 0).toFixed(1)}%
              </div>
            </div>

            <div style={{ padding: '0.7rem 0.8rem', borderRadius: '0.75rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Klik CTA (CTR)</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                {detail.click_count || 0} Klik
              </div>
              <div style={{ fontSize: '0.68rem', color: textSecondary }}>
                CTR: {(detail.ctr_pct || 0).toFixed(1)}%
              </div>
            </div>

            <div style={{ padding: '0.7rem 0.8rem', borderRadius: '0.75rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>
                {detail.status === 'scheduled' ? 'Dijadwalkan' : 'Waktu Terbit'}
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: textPrimary, marginTop: '0.25rem' }}>
                {detail.status === 'scheduled'
                  ? formatDateTimeID(detail.scheduled_at)
                  : formatDateTimeID(detail.published_at || detail.created_at)}
              </div>
            </div>

            <div style={{ padding: '0.7rem 0.8rem', borderRadius: '0.75rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>
                {detail.revoked_at ? 'Dicabut Pada' : 'Kedaluwarsa'}
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: textPrimary, marginTop: '0.25rem' }}>
                {detail.revoked_at
                  ? formatDateTimeID(detail.revoked_at)
                  : detail.expires_at
                    ? formatDateTimeID(detail.expires_at)
                    : 'Permanen'}
              </div>
            </div>
          </div>

          {/* Normalized Specific Recipients List (No longer dead code!) */}
          {recips.length > 0 && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={14} color="#3b82f6" />
                <span>Daftar Penerima Spesifik ({recips.length}):</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {recips.map((rec, idx) => (
                  <span
                    key={`${rec.type}_${rec.id}_${idx}`}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.45rem',
                      backgroundColor: rec.type === 'store' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(236, 72, 153, 0.14)',
                      color: rec.type === 'store' ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#f472b6' : '#be185d'),
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    {rec.type === 'store' ? <Store size={12} /> : <User size={12} />}
                    <span>{rec.name}</span>
                    {rec.slug && <span style={{ opacity: 0.75 }}>@{rec.slug}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Short Message */}
          <div style={{ padding: '0.9rem 1rem', borderRadius: '0.85rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: textMuted, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Ringkasan Notifikasi
            </div>
            <div style={{ fontSize: '0.84rem', color: textPrimary, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {detail.message}
            </div>
          </div>

          {/* Rich Detail Content */}
          {detail.detail_content && (
            <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: deepBg, border: `1px solid ${borderCol}` }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <FileText size={15} />
                <span>Isi Artikel Pengumuman Lengkap</span>
              </div>
              <div style={{ fontSize: '0.86rem', color: textPrimary, lineHeight: 1.68 }}>
                <FormattedTextComponent text={detail.detail_content} />
              </div>
            </div>
          )}

          {/* Active Action Metadata */}
          {effectiveAction !== 'none' && (
            <div style={{ padding: '0.85rem 1rem', borderRadius: '0.85rem', backgroundColor: deepBg, border: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: textMuted, textTransform: 'uppercase' }}>
                Aksi Sentuh Merchant ({effectiveAction})
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: textPrimary }}>
                Tombol CTA: {detail.action_label || getDefaultActionLabel(effectiveAction, detail.link_sub_tab, detail.action_url)}
              </div>
              {effectiveAction === 'navigate' && (
                <div style={{ fontSize: '0.76rem', color: textSecondary }}>
                  Tab Tujuan: <strong>{detail.link_sub_tab}</strong>
                  {detail.link_sub_tab === 'settings' && detail.link_mobile_settings_tab ? ` -> ${detail.link_mobile_settings_tab}` : ''}
                </div>
              )}
              {effectiveAction === 'external_link' && detail.action_url && (
                <div style={{ fontSize: '0.76rem', color: '#10b981', wordBreak: 'break-all' }}>
                  URL Target: {detail.action_url}
                </div>
              )}
            </div>
          )}

          {/* Danger Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: isMobile ? 'stretch' : 'space-between',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '0.65rem',
              paddingTop: '0.85rem',
              borderTop: `1px solid ${borderCol}`,
            }}
          >
            <span style={{ fontSize: '0.72rem', color: textMuted }}>
              Menghapus permanen akan memusnahkan seluruh histori penerima dan membaca secara real-time.
            </span>
            <button
              type="button"
              onClick={() => setConfirmState({ kind: 'delete', item: detail })}
              style={{
                minHeight: `${minTouchHeight}px`,
                padding: '0.55rem 1.05rem',
                borderRadius: '0.7rem',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Trash2 size={14} />
              <span>Hapus Permanen</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFormView = () => {
    const isEditMode = subView === 'edit';
    const isEditingPublished = isEditMode && selectedDetail?.status === 'published';
    const effectiveAction: BroadcastActionType =
      form.action_enabled && form.action_type !== 'none' ? form.action_type : 'none';
    const catStyle = getCategoryStyle(form.category, form.type);
    const previewCtaLabel =
      effectiveAction !== 'none'
        ? form.action_label.trim() || getDefaultActionLabel(effectiveAction, form.link_sub_tab, form.action_url)
        : '';

    const previewCard = (
      <div
        style={{
          padding: '1rem',
          borderRadius: '1rem',
          backgroundColor: surfaceBg,
          border: `1px dashed ${borderCol}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          position: device === 'desktop' ? 'sticky' : 'static',
          top: device === 'desktop' ? '1rem' : undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: textMuted, textTransform: 'uppercase' }}>
            Pratinjau Kartu Merchant
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: catStyle.text }}>
            {form.type === 'warning' ? 'Urgent' : form.type === 'success' ? 'Rilis' : form.type === 'system' ? 'Teknis' : 'Info'}
          </span>
        </div>

        <div
          style={{
            padding: '0.95rem 1rem',
            borderRadius: '0.85rem',
            backgroundColor: deepBg,
            border: `1px solid ${borderCol}`,
            borderLeft: `4px solid ${catStyle.text}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '0.14rem 0.5rem',
                borderRadius: '0.35rem',
                backgroundColor: catStyle.bg,
                color: catStyle.text,
                border: `1px solid ${catStyle.border}`,
              }}
            >
              {form.category || 'PENGUMUMAN'}
            </span>
            <span style={{ fontSize: '0.68rem', color: textMuted }}>
              {form.status === 'draft'
                ? 'Draf'
                : form.status === 'scheduled'
                  ? 'Terjadwal'
                  : 'Baru saja'}
            </span>
          </div>

          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: textPrimary, lineHeight: 1.35, wordBreak: 'break-word' }}>
            {form.title.trim() || 'Judul Siaran Pengumuman'}
          </div>

          <div style={{ fontSize: '0.78rem', color: textSecondary, lineHeight: 1.48, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {form.message.trim() || 'Ringkasan pesan siaran yang akan tampil pada lonceng dan kotak masuk merchant...'}
          </div>

          {effectiveAction !== 'none' && (
            <div
              style={{
                marginTop: '0.35rem',
                paddingTop: '0.45rem',
                borderTop: `1px solid ${borderCol}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                color:
                  effectiveAction === 'external_link'
                    ? '#10b981'
                    : effectiveAction === 'navigate'
                      ? '#3b82f6'
                      : '#d97706',
              }}
            >
              {effectiveAction === 'detail' && <FileText size={13} />}
              {effectiveAction === 'navigate' && <Compass size={13} />}
              {effectiveAction === 'external_link' && <ExternalLink size={13} />}
              <span>{previewCtaLabel}</span>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <form
        onSubmit={handleSubmitForm}
        style={{
          maxWidth: device === 'desktop' ? '1280px' : isTablet ? '920px' : '100%',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          paddingBottom: isMobile ? '5.25rem' : '2rem',
          boxSizing: 'border-box',
        }}
      >
        {!isMobile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.9rem 1.1rem',
              borderRadius: '1rem',
              backgroundColor: surfaceBg,
              border: `1px solid ${borderCol}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={handleBackToList}
                style={{
                  minHeight: `${minTouchHeight}px`,
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: deepBg,
                  color: textPrimary,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ArrowLeft size={15} />
                <span>Kembali</span>
              </button>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary }}>
                  {isEditMode ? 'Edit Siaran Broadcast' : 'Buat Siaran Broadcast Baru'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.72rem', color: textSecondary }}>
                  {isEditingPublished
                    ? 'Mode edit siaran aktif tayang (target audiens dikunci untuk integritas analitik)'
                    : 'Konfigurasikan target audiens, jadwal tayang, isi konten, dan CTA interaktif'}
                </p>
              </div>
            </div>
          </div>
        ) : isEditingPublished ? (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.8rem',
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: isDark ? '#fbbf24' : '#b45309',
            }}
          >
            Mode edit siaran aktif tayang (target audiens dikunci untuk integritas analitik).
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: device === 'desktop' ? 'minmax(0, 1.45fr) minmax(320px, 1fr)' : 'minmax(0, 1fr)',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 1. Target Sasaran & Jadwal */}
            <div
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', fontWeight: 800, color: textPrimary }}>
                <Target size={16} color="#f59e0b" />
                <span>1. Target Audiens & Mode Publikasi</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Segmentasi Target Penerima
                  </label>
                  {renderFieldSelect({
                    value: form.target_type,
                    onChange: (val) => setForm((prev) => ({ ...prev, target_type: val as BroadcastTargetType })),
                    options: TARGET_SEGMENT_OPTIONS,
                    title: 'Segmentasi Target Penerima',
                    subtitle: 'Tentukan siapa penerima siaran ini',
                    disabled: isEditingPublished,
                    ariaLabel: 'Segmentasi Target Penerima',
                  })}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Mode Publikasi
                  </label>
                  {renderFieldSelect({
                    value: form.status,
                    onChange: (val) => setForm((prev) => ({ ...prev, status: val as 'draft' | 'scheduled' | 'published' })),
                    options: PUBLISH_MODE_OPTIONS,
                    title: 'Mode Publikasi',
                    subtitle: 'Pilih penerbitan instan, terjadwal, atau draf',
                    disabled: isEditingPublished,
                    ariaLabel: 'Mode Publikasi',
                  })}
                </div>
              </div>

              {form.status === 'scheduled' && !isEditingPublished && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Jadwal Tanggal & Jam Tayang
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.scheduled_at || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                    style={{
                      width: '100%',
                      minHeight: `${minTouchHeight}px`,
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: textPrimary,
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {form.target_type === 'plan' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Paket Langganan Sasaran (Dinamis dari Sistem)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {plans.map((pl) => {
                      const active = form.target_plan_code.toLowerCase() === pl.code.toLowerCase();
                      return (
                        <button
                          key={pl.code}
                          type="button"
                          disabled={isEditingPublished}
                          onClick={() => setForm((prev) => ({ ...prev, target_plan_code: pl.code }))}
                          style={{
                            minHeight: `${minTouchHeight}px`,
                            padding: '0.5rem 0.85rem',
                            borderRadius: '0.65rem',
                            border: `1.5px solid ${active ? '#f59e0b' : borderCol}`,
                            backgroundColor: active ? 'rgba(245, 158, 11, 0.14)' : deepBg,
                            color: active ? '#d97706' : textPrimary,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: isEditingPublished ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <Award size={14} />
                          <span>{pl.name}</span>
                          <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>({pl.code})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.target_type === 'specific' && !isEditingPublished && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary }}>
                    Cari & Tambah Toko atau Akun Pengguna Spesifik
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
                    <input
                      type="text"
                      value={recipientQuery}
                      onChange={(e) => setRecipientQuery(e.target.value)}
                      placeholder="Ketik nama toko, @slug, email, atau ID..."
                      style={{
                        width: '100%',
                        minHeight: `${minTouchHeight}px`,
                        padding: '0.55rem 2.2rem 0.55rem 2.25rem',
                        borderRadius: '0.65rem',
                        backgroundColor: inputBg,
                        border: `1px solid ${inputBorder}`,
                        color: textPrimary,
                        fontSize: '0.82rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {isSearchingRecipients && (
                      <Loader2 size={15} className="spin" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#f59e0b' }} />
                    )}

                    {recipientResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '0.3rem',
                          backgroundColor: surfaceBg,
                          border: `1px solid ${borderCol}`,
                          borderRadius: '0.7rem',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          zIndex: 40,
                        }}
                      >
                        {recipientResults.map((cand) => {
                          const exists = form.recipients.some((r) => r.type === cand.type && r.id === cand.id);
                          return (
                            <button
                              key={`${cand.type}_${cand.id}`}
                              type="button"
                              onClick={() => {
                                if (exists) return;
                                setForm((prev) => ({ ...prev, recipients: [...prev.recipients, cand] }));
                                setRecipientQuery('');
                                setRecipientResults([]);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                minHeight: `${minTouchHeight}px`,
                                padding: '0.55rem 0.85rem',
                                border: 'none',
                                borderBottom: `1px solid ${borderCol}`,
                                backgroundColor: exists ? deepBg : 'transparent',
                                cursor: exists ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: textPrimary }}>
                                  {cand.name}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: textMuted }}>
                                  {cand.type === 'store' ? `TOKO #${cand.id}${cand.slug ? ` (@${cand.slug})` : ''}${cand.plan ? ` • ${cand.plan}` : ''}` : `USER #${cand.id}${cand.email ? ` (${cand.email})` : ''}`}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: exists ? '#10b981' : '#f59e0b', flexShrink: 0 }}>
                                {exists ? 'Terpilih' : '+ Tambah'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {form.recipients.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {form.recipients.map((rec, idx) => (
                        <span
                          key={`${rec.type}_${rec.id}_${idx}`}
                          style={{
                            padding: '0.28rem 0.6rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            backgroundColor: rec.type === 'store' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(236, 72, 153, 0.14)',
                            color: rec.type === 'store' ? '#3b82f6' : '#ec4899',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          {rec.type === 'store' ? <Store size={12} /> : <User size={12} />}
                          <span>{rec.name}</span>
                          <button
                            type="button"
                            aria-label={`Hapus ${rec.name}`}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                recipients: prev.recipients.filter((_, i) => i !== idx),
                              }))
                            }
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Klasifikasi & Masa Berlaku */}
            <div
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', fontWeight: 800, color: textPrimary }}>
                <Tag size={16} color="#f59e0b" />
                <span>2. Kategori, Urgensi & Masa Berlaku</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Kategori
                  </label>
                  {renderFieldSelect({
                    value: form.category,
                    onChange: (val) => setForm((prev) => ({ ...prev, category: val })),
                    options: CATEGORY_OPTIONS,
                    title: 'Kategori Siaran',
                    subtitle: 'Kelompokkan topik informasi pengumuman',
                    ariaLabel: 'Kategori',
                  })}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Tingkat Urgensi
                  </label>
                  {renderFieldSelect({
                    value: form.type,
                    onChange: (val) => setForm((prev) => ({ ...prev, type: val as BroadcastUrgency })),
                    options: URGENCY_OPTIONS,
                    title: 'Tingkat Urgensi',
                    subtitle: 'Tentukan prioritas visual pengumuman',
                    ariaLabel: 'Tingkat Urgensi',
                  })}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.35rem' }}>
                    Masa Berlaku
                  </label>
                  {renderFieldSelect({
                    value: String(form.expires_in_hours),
                    onChange: (val) => setForm((prev) => ({ ...prev, expires_in_hours: parseInt(val, 10) || 0 })),
                    options: EXPIRY_OPTIONS,
                    title: 'Masa Berlaku Siaran',
                    subtitle: 'Durasi tampil di kotak masuk merchant',
                    ariaLabel: 'Masa Berlaku',
                    align: 'right',
                  })}
                </div>
              </div>
            </div>

            {/* 3. Konten & CTA */}
            <div
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', fontWeight: 800, color: textPrimary }}>
                <FileText size={16} color="#f59e0b" />
                <span>3. Konten Pesan & Tindakan Lanjutan (CTA)</span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary }}>Judul Pengumuman</label>
                  <span style={{ fontSize: '0.7rem', color: form.title.length > 130 ? '#ef4444' : textMuted }}>
                    {form.title.length}/150
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: Pembaruan Kebijakan & Fitur Katalog Terbaru"
                  style={{
                    width: '100%',
                    minHeight: `${minTouchHeight}px`,
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary }}>Ringkasan Notifikasi</label>
                  <span style={{ fontSize: '0.7rem', color: form.message.length > 1800 ? '#ef4444' : textMuted }}>
                    {form.message.length}/2000
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Ringkasan singkat yang muncul langsung di lonceng & kartu notifikasi merchant..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: textPrimary,
                    fontSize: '0.84rem',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ padding: '0.9rem', borderRadius: '0.85rem', backgroundColor: deepBg, border: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: textPrimary }}>Aktifkan Aksi Sentuh / Tombol CTA</div>
                    <div style={{ fontSize: '0.7rem', color: textMuted }}>Arahkan merchant membaca artikel, menuju menu toko, atau tautan eksternal</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.action_enabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        action_enabled: checked,
                        action_type: checked ? (prev.action_type === 'none' ? 'detail' : prev.action_type) : 'none',
                      }));
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                {form.action_enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: `1px solid ${borderCol}`, paddingTop: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                          Tipe Aksi
                        </label>
                        {renderFieldSelect({
                          value: form.action_type === 'none' ? 'detail' : form.action_type,
                          onChange: (val) => setForm((prev) => ({ ...prev, action_type: val as BroadcastActionType })),
                          options: ACTION_TYPE_OPTIONS.filter((o) => o.value !== 'none'),
                          title: 'Tipe Aksi CTA',
                          subtitle: 'Pilih tindakan saat notifikasi diklik merchant',
                          ariaLabel: 'Tipe Aksi',
                        })}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                          Label Tombol CTA (Opsional)
                        </label>
                        <input
                          type="text"
                          maxLength={128}
                          value={form.action_label}
                          onChange={(e) => setForm((prev) => ({ ...prev, action_label: e.target.value }))}
                          placeholder={getDefaultActionLabel(effectiveAction, form.link_sub_tab, form.action_url)}
                          style={{
                            width: '100%',
                            minHeight: `${minTouchHeight}px`,
                            padding: '0.55rem 0.75rem',
                            borderRadius: '0.6rem',
                            backgroundColor: surfaceBg,
                            border: `1px solid ${inputBorder}`,
                            color: textPrimary,
                            fontSize: '0.8rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    {form.action_type === 'detail' && (
                      <RichTextareaComponent
                        label="Isi Artikel Lengkap"
                        value={form.detail_content}
                        onChange={(val) => setForm((prev) => ({ ...prev, detail_content: val }))}
                        placeholder="Tuliskan panduan lengkap, catatan rilis, atau instruksi untuk merchant..."
                        minHeight="170px"
                        showPreviewTab={true}
                        showZenFullscreen={true}
                        theme={theme}
                        isDark={isDark}
                      />
                    )}

                    {form.action_type === 'navigate' && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile || form.link_sub_tab !== 'settings' ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                            Menu Internal Tujuan
                          </label>
                          {renderFieldSelect({
                            value: form.link_sub_tab,
                            onChange: (val) => setForm((prev) => ({ ...prev, link_sub_tab: val })),
                            options: MENU_OPTIONS,
                            title: 'Menu Internal Tujuan',
                            subtitle: 'Pilih halaman admin toko tujuan',
                            ariaLabel: 'Menu Internal Tujuan',
                          })}
                        </div>

                        {form.link_sub_tab === 'settings' && (
                          <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.3rem' }}>
                              Sub-Tab Pengaturan Toko
                            </label>
                            {renderFieldSelect({
                              value: form.link_mobile_settings_tab,
                              onChange: (val) => setForm((prev) => ({ ...prev, link_mobile_settings_tab: val })),
                              options: SETTINGS_SUB_TAB_OPTIONS,
                              title: 'Sub-Tab Pengaturan Toko',
                              subtitle: 'Arahkan ke bagian pengaturan spesifik',
                              ariaLabel: 'Sub-Tab Pengaturan Toko',
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {form.action_type === 'external_link' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary }}>URL Website Eksternal</label>
                        <input
                          type="url"
                          value={form.action_url}
                          onChange={(e) => setForm((prev) => ({ ...prev, action_url: e.target.value }))}
                          placeholder="https://catavor.com/panduan"
                          style={{
                            width: '100%',
                            minHeight: `${minTouchHeight}px`,
                            padding: '0.55rem 0.75rem',
                            borderRadius: '0.6rem',
                            backgroundColor: surfaceBg,
                            border: `1px solid ${inputBorder}`,
                            color: textPrimary,
                            fontSize: '0.82rem',
                            boxSizing: 'border-box',
                          }}
                        />
                        {form.action_url.trim() && (() => {
                          const sec = checkUrlSecurity(form.action_url);
                          const dom = sec.domain || cleanDomainString(form.action_url);
                          const safe = sec.isMasterTrusted || sec.isSafe;
                          return (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.4rem 0.7rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                backgroundColor: safe ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                color: safe ? '#10b981' : '#d97706',
                              }}
                            >
                              {safe ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                              <span>{safe ? `Domain Terpercaya: ${dom}` : `Domain Eksternal (Konfirmasi Keamanan Aktif): ${dom}`}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {device === 'desktop' ? previewCard : previewCard}
        </div>

        {/* Form Actions Footer */}
        <div
          style={
            isMobile
              ? {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0.7rem 1rem',
                backgroundColor: surfaceBg,
                borderTop: `1px solid ${borderCol}`,
                display: 'flex',
                gap: '0.6rem',
                zIndex: 45,
              }
              : {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.7rem',
                padding: '0.9rem 1.1rem',
                borderRadius: '1rem',
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
              }
          }
        >
          <button
            type="submit"
            disabled={isSubmitting || !form.title.trim() || !form.message.trim()}
            style={{
              width: isMobile ? '100%' : 'auto',
              minHeight: isMobile ? '46px' : `${minTouchHeight}px`,
              padding: '0.6rem 1.4rem',
              borderRadius: '0.7rem',
              border: 'none',
              backgroundColor: '#f59e0b',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !form.title.trim() || !form.message.trim() ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              whiteSpace: 'nowrap',
            }}
          >
            {isSubmitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
            <span>
              {isSubmitting
                ? 'Menyimpan...'
                : isEditMode
                  ? 'Simpan'
                  : form.status === 'draft'
                    ? 'Simpan Draf'
                    : form.status === 'scheduled'
                      ? 'Jadwalkan'
                      : 'Terbitkan'}
            </span>
          </button>
        </div>
      </form>
    );
  };

  if (subView === 'create' || subView === 'edit') {
    return (
      <>
        {renderFormView()}
        {renderConfirmOverlay()}
        {renderDiscardConfirmOverlay()}
      </>
    );
  }

  if (subView === 'detail' && !isTabletSplit) {
    return (
      <div style={{ maxWidth: device === 'desktop' ? '1100px' : '100%', margin: '0 auto', paddingBottom: '2rem' }}>
        {isLoadingDetail && !selectedDetail ? (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: surfaceBg, borderRadius: '1rem', border: `1px solid ${borderCol}` }}>
            <Loader2 size={24} className="spin" color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.84rem', color: textSecondary }}>Memuat rincian siaran...</div>
          </div>
        ) : selectedDetail ? (
          renderDetailPanel(selectedDetail)
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: surfaceBg, borderRadius: '1rem', border: `1px solid ${borderCol}` }}>
            <AlertCircle size={28} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: textPrimary }}>Rincian Siaran Tidak Ditemukan</div>
            <button
              type="button"
              onClick={handleBackToList}
              style={{
                marginTop: '0.85rem',
                minHeight: `${minTouchHeight}px`,
                padding: '0.5rem 1rem',
                borderRadius: '0.65rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textPrimary,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kembali ke Daftar
            </button>
          </div>
        )}
        {renderConfirmOverlay()}
      </div>
    );
  }

  const startEntry = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(totalItems, page * limit);

  const renderCard = (b: AdminBroadcastRecord) => {
    const statusMeta = resolveEffectiveStatus(b);
    const targetMeta = getTargetBadgeMeta(b, planMap);
    const catStyle = getCategoryStyle(b.category, b.type);
    const isSelected = selectedId === b.id;

    return (
      <div
        key={b.id}
        onClick={() => handleSelectItem(b)}
        style={{
          padding: isMobile ? '0.9rem' : '1rem 1.1rem',
          borderRadius: '0.95rem',
          backgroundColor: surfaceBg,
          border: isSelected ? '1.5px solid #f59e0b' : `1px solid ${borderCol}`,
          boxShadow: cardShadow,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.65rem',
          transition: 'border-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  padding: '0.14rem 0.48rem',
                  borderRadius: '0.35rem',
                  backgroundColor: catStyle.bg,
                  color: catStyle.text,
                  border: `1px solid ${catStyle.border}`,
                }}
              >
                {b.category || 'PENGUMUMAN'}
              </span>

              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  padding: '0.14rem 0.48rem',
                  borderRadius: '0.35rem',
                  backgroundColor: targetMeta.bg,
                  color: targetMeta.color,
                  border: `1px solid ${targetMeta.border}`,
                }}
              >
                {targetMeta.label}
              </span>

              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  padding: '0.14rem 0.48rem',
                  borderRadius: '999px',
                  backgroundColor: statusMeta.bg,
                  color: statusMeta.color,
                  border: `1px solid ${statusMeta.border}`,
                }}
              >
                {statusMeta.label}
              </span>
            </div>

            <span style={{ fontSize: '0.68rem', color: textMuted, whiteSpace: 'nowrap' }}>
              {formatDateTimeID(b.scheduled_at && statusMeta.key === 'scheduled' ? b.scheduled_at : b.created_at)}
            </span>
          </div>

          <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: textPrimary, lineHeight: 1.35 }}>
            {b.title}
          </h5>

          <p
            style={{
              margin: 0,
              fontSize: '0.76rem',
              color: textSecondary,
              lineHeight: 1.48,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {b.message}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            paddingTop: '0.55rem',
            borderTop: `1px solid ${borderCol}`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#3b82f6' }}>
              <Eye size={13} />
              <span>{b.read_count || 0}{b.target_audience_count > 0 ? `/${b.target_audience_count}` : ''}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
              <MousePointerClick size={13} />
              <span>{b.click_count || 0}</span>
            </span>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleSelectItem(b)}
              style={{
                minHeight: isMobile || isTablet ? '44px' : '32px',
                padding: isMobile || isTablet ? '0.45rem 0.85rem' : '0.28rem 0.65rem',
                borderRadius: '0.55rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textPrimary,
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
              }}
            >
              <FileText size={13} />
              <span>Rincian</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmState({ kind: 'delete', item: b })}
              style={{
                minHeight: isMobile || isTablet ? '44px' : '32px',
                padding: isMobile || isTablet ? '0.45rem 0.8rem' : '0.28rem 0.6rem',
                borderRadius: '0.55rem',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Trash2 size={13} />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPaginationBar = () => {
    if (isMobile) {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', paddingTop: '0.35rem' }}>
          <button
            type="button"
            disabled={page <= 1 || isLoadingList}
            onClick={() => loadBroadcasts(page - 1)}
            style={{
              minHeight: '44px',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.65rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: surfaceBg,
              color: page <= 1 ? textMuted : textPrimary,
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Sebelumnya
          </button>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: textSecondary }}>
            Hal {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoadingList}
            onClick={() => loadBroadcasts(page + 1)}
            style={{
              minHeight: '44px',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.65rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: surfaceBg,
              color: page >= totalPages ? textMuted : textPrimary,
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Selanjutnya
          </button>
        </div>
      );
    }

    if (isTablet) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            borderTop: `1px solid ${borderCol}`,
            backgroundColor: cardBg,
          }}
        >
          <button
            type="button"
            disabled={page <= 1 || isLoadingList}
            onClick={() => loadBroadcasts(page - 1)}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.6rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page <= 1 ? textMuted : textPrimary,
              fontWeight: 700,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: textSecondary }}>
            Hal {page} / {totalPages} ({totalItems})
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoadingList}
            onClick={() => loadBroadcasts(page + 1)}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 0.85rem',
              borderRadius: '0.6rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page >= totalPages ? textMuted : textPrimary,
              fontWeight: 700,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      );
    }

    // Desktop enterprise numbered pagination bar
    const pagesToShow: number[] = [];
    const maxBtn = 5;
    let startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, startPage + maxBtn - 1);
    startPage = Math.max(1, endPage - maxBtn + 1);
    for (let p = startPage; p <= endPage; p++) pagesToShow.push(p);

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.9rem',
          backgroundColor: surfaceBg,
          border: `1px solid ${borderCol}`,
        }}
      >
        <span style={{ fontSize: '0.78rem', color: textSecondary, fontWeight: 600 }}>
          Menampilkan {startEntry} - {endEntry} dari {totalItems} siaran
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={page <= 1 || isLoadingList}
            onClick={() => loadBroadcasts(1)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '0.5rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page <= 1 ? textMuted : textPrimary,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Awal
          </button>
          <button
            type="button"
            disabled={page <= 1 || isLoadingList}
            onClick={() => loadBroadcasts(page - 1)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '0.5rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page <= 1 ? textMuted : textPrimary,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Sebelumnya
          </button>

          {pagesToShow.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loadBroadcasts(p)}
              style={{
                minWidth: '34px',
                padding: '0.4rem 0.55rem',
                borderRadius: '0.5rem',
                border: `1px solid ${p === page ? '#f59e0b' : borderCol}`,
                backgroundColor: p === page ? '#f59e0b' : deepBg,
                color: p === page ? '#000000' : textPrimary,
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={page >= totalPages || isLoadingList}
            onClick={() => loadBroadcasts(page + 1)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '0.5rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page >= totalPages ? textMuted : textPrimary,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Selanjutnya
          </button>
          <button
            type="button"
            disabled={page >= totalPages || isLoadingList}
            onClick={() => loadBroadcasts(totalPages)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '0.5rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: deepBg,
              color: page >= totalPages ? textMuted : textPrimary,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Akhir
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        maxWidth: device === 'desktop' ? '1280px' : '100%',
        margin: '0 auto',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingBottom: isMobile ? '4rem' : '2rem',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          padding: isMobile ? '0.9rem' : '1rem 1.25rem',
          borderRadius: '1rem',
          backgroundColor: surfaceBg,
          border: `1px solid ${borderCol}`,
          boxShadow: cardShadow,
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              flexShrink: 0,
            }}
          >
            <Megaphone size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary }}>
              Manajemen Siaran Broadcast
            </h4>
            <p style={{ margin: 0, fontSize: '0.74rem', color: textSecondary }}>
              Kelola pengumuman terbit, draf, jadwal otomatis, segmentasi paket, dan analitik keterbacaan
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
          {isMobile && (
            <button
              type="button"
              onClick={() => loadBroadcasts(page)}
              aria-label="Segarkan daftar siaran"
              style={{
                minHeight: `${minTouchHeight}px`,
                minWidth: `${minTouchHeight}px`,
                padding: '0 0.75rem',
                borderRadius: '0.7rem',
                border: `1px solid ${borderCol}`,
                backgroundColor: deepBg,
                color: textPrimary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <RefreshCw size={14} className={isLoadingList ? 'spin' : undefined} />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              flex: isMobile ? 1 : undefined,
              minHeight: `${minTouchHeight}px`,
              padding: '0.55rem 1.1rem',
              borderRadius: '0.7rem',
              backgroundColor: '#f59e0b',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.82rem',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Plus size={15} />
            <span>Buat Siaran Baru</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={{ padding: '0.85rem', borderRadius: '0.9rem', backgroundColor: surfaceBg, border: `1px solid ${borderCol}`, boxShadow: cardShadow }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Total Siaran</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>{metrics.total_broadcasts}</div>
        </div>
        <div style={{ padding: '0.85rem', borderRadius: '0.9rem', backgroundColor: surfaceBg, border: `1px solid ${borderCol}`, boxShadow: cardShadow }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Aktif Tayang</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>{metrics.active_broadcasts}</div>
        </div>
        <div style={{ padding: '0.85rem', borderRadius: '0.9rem', backgroundColor: surfaceBg, border: `1px solid ${borderCol}`, boxShadow: cardShadow }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Draf / Terjadwal</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#6366f1', marginTop: '0.2rem' }}>
            {metrics.draft_broadcasts + metrics.scheduled_broadcasts}
          </div>
        </div>
        <div style={{ padding: '0.85rem', borderRadius: '0.9rem', backgroundColor: surfaceBg, border: `1px solid ${borderCol}`, boxShadow: cardShadow }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Total Baca &amp; CTR</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#3b82f6', marginTop: '0.2rem' }}>
            {metrics.total_reads}{' '}
            <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 800 }}>
              ({metrics.avg_ctr_pct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div
        style={{
          padding: '0.85rem',
          borderRadius: '0.95rem',
          backgroundColor: surfaceBg,
          border: `1px solid ${borderCol}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.7rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
          {(
            [
              { id: 'all', label: `Semua (${metrics.total_broadcasts})` },
              { id: 'active', label: `Aktif (${metrics.active_broadcasts})` },
              { id: 'draft', label: `Draf (${metrics.draft_broadcasts})` },
              { id: 'scheduled', label: `Terjadwal (${metrics.scheduled_broadcasts})` },
              { id: 'expired', label: 'Kedaluwarsa' },
              { id: 'revoked', label: `Dicabut (${metrics.revoked_broadcasts})` },
            ] as const
          ).map((st) => {
            const active = statusFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  setPage(1);
                }}
                style={{
                  minHeight: `${minTouchHeight}px`,
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${active ? '#f59e0b' : borderCol}`,
                  backgroundColor: active ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                  color: active ? '#d97706' : textSecondary,
                  fontSize: '0.76rem',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {st.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              device === 'desktop'
                ? 'minmax(220px, 1.5fr) minmax(170px, 0.85fr) minmax(170px, 0.85fr) minmax(120px, 0.55fr)'
                : isMobile
                  ? '1fr'
                  : 'repeat(2, minmax(0, 1fr))',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', minWidth: 0, gridColumn: device === 'desktop' || isMobile ? undefined : '1 / -1' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, pesan, atau nama penerima..."
              style={{
                width: '100%',
                minHeight: `${minTouchHeight}px`,
                padding: '0.5rem 2rem 0.5rem 2.2rem',
                borderRadius: '0.65rem',
                border: `1px solid ${inputBorder}`,
                backgroundColor: inputBg,
                color: textPrimary,
                fontSize: '0.8rem',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: textMuted, cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            {renderFieldSelect({
              value: targetFilter,
              onChange: (val) => {
                setTargetFilter(val as 'all' | 'global' | 'plan' | 'specific');
                setPage(1);
              },
              options: TARGET_FILTER_OPTIONS,
              title: 'Filter Target Siaran',
              subtitle: 'Saring daftar menurut segmentasi audiens',
              ariaLabel: 'Filter target siaran',
            })}
          </div>

          <div style={{ minWidth: 0 }}>
            {renderFieldSelect({
              value: categoryFilter,
              onChange: (val) => {
                setCategoryFilter(val);
                setPage(1);
              },
              options: [{ value: 'all', label: 'Semua Kategori', desc: 'Tampilkan seluruh kategori siaran', badge: 'Semua' }, ...CATEGORY_OPTIONS],
              title: 'Filter Kategori Siaran',
              subtitle: 'Saring daftar menurut topik pengumuman',
              ariaLabel: 'Filter kategori siaran',
              align: isTablet ? 'right' : 'auto',
            })}
          </div>

          {device === 'desktop' && (
            <div style={{ minWidth: 0 }}>
              {renderFieldSelect({
                value: String(limit),
                onChange: (val) => {
                  const nl = parseInt(val, 10) || 10;
                  setLimit(nl);
                  setPage(1);
                },
                options: DESKTOP_PAGE_LIMIT_OPTIONS,
                title: 'Jumlah Baris per Halaman',
                ariaLabel: 'Jumlah baris per halaman',
                align: 'right',
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main List / Master-Detail Area */}
      {isTabletSplit ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(310px, 38%) minmax(0, 1fr)',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderRadius: '1rem', border: `1px solid ${borderCol}`, backgroundColor: deepBg, overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '640px', overflowY: 'auto' }}>
              {isLoadingList && items.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: textMuted }}>Memuat siaran...</div>
              ) : items.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: textMuted }}>Belum ada siaran cocok.</div>
              ) : (
                items.map(renderCard)
              )}
            </div>
            {renderPaginationBar()}
          </div>

          <div>
            {selectedDetail ? (
              renderDetailPanel(selectedDetail)
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', borderRadius: '1rem', border: `1px solid ${borderCol}`, backgroundColor: surfaceBg, color: textMuted }}>
                <Radio size={32} color="#f59e0b" style={{ margin: '0 auto 0.65rem' }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: textPrimary }}>Pilih Siaran dari Daftar</div>
                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Klik salah satu kartu siaran di sebelah kiri untuk melihat rincian, penerima spesifik, analitik CTR, dan tindakan.</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {isLoadingList ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: surfaceBg, borderRadius: '1rem', border: `1px solid ${borderCol}` }}>
              <Loader2 size={24} className="spin" color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.82rem', color: textSecondary }}>Memuat daftar siaran...</div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', backgroundColor: surfaceBg, borderRadius: '1rem', border: `1px solid ${borderCol}` }}>
              <Megaphone size={36} color="#f59e0b" style={{ margin: '0 auto 0.75rem', opacity: 0.85 }} />
              <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800, color: textPrimary }}>
                {searchQuery || statusFilter !== 'all' || targetFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Siaran Tidak Ditemukan'
                  : 'Belum Ada Siaran Notifikasi'}
              </h4>
              <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: textSecondary }}>
                Kirim pengumuman massal, jadwalkan kampanye, atau simpan draf untuk merchant Anda.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                style={{
                  minHeight: `${minTouchHeight}px`,
                  padding: '0.55rem 1.15rem',
                  borderRadius: '0.7rem',
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Plus size={15} />
                <span>Buat Siaran Baru</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: device === 'desktop' ? 'repeat(auto-fill, minmax(460px, 1fr))' : '1fr',
                gap: '0.85rem',
              }}
            >
              {items.map(renderCard)}
            </div>
          )}

          {totalItems > 0 && renderPaginationBar()}
        </>
      )}

      {renderConfirmOverlay()}
      {renderDiscardConfirmOverlay()}
    </div>
  );
};
