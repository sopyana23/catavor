import { FinancePager, useFinancePage } from '../../../shared/finance/FinancePaging';
import { AuthenticatedProofImage } from '../../../shared/finance/AuthenticatedProofImage';
import { formatReportStatusLabel, formatReportActionLabel } from '../../../shared/moderation/itemModerationBadge';
import { paymentChannel } from '../../../shared/finance/paymentChannel';
import { FinanceNav, CouponFilters, OrderFilters, PaymentModePicker, financeColors, useFinanceSection } from '../../../shared/finance/FinanceControls';
import { AutomationConsole } from '../../../shared/automation/AutomationConsole';
import { AdminMonetizationConsole } from '../../../shared/monetization/AdminMonetizationConsole';
import { AdminBroadcastConsole } from '../../../shared/broadcast/AdminBroadcastConsole';
import {
  PLATFORM_AUDIT_CATEGORIES,
  PLATFORM_AUDIT_ROLES,
  type AuditChainVerifyReport,
  verifyAuditChainApi,
  exportAuditLogsFile,
} from '../../../shared/audit/auditHelpers';
import { AutomationCatalog } from './AutomationCatalog';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { compactToastMessage } from './SwipeableToast';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
  CreditCard,
  FileText,
  Layers,
  Activity,
  Sparkles,
  TrendingUp,
  Users,
  User,
  UserCheck,
  UserPlus,
  Search,
  Filter,
  Eye,
  EyeOff,
  QrCode,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  RotateCcw,
  Loader2,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Megaphone,
  DollarSign,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Calendar,
  Lock,
  Tag,
  Power,
  Edit2,
  Percent,
  LogOut,
  Copy,
  CheckCheck,
  X,
  Store,
  ChevronDown,
  ChevronUp,
  Inbox,
  Award,
  Radio,
  History,
  Sliders,
  Bell,
  Sun,
  Moon,
  Globe,
  Settings,
  SlidersHorizontal,
  Code,
  Zap,
  Info,
  MoreVertical,
  ChevronLeft,
  LayoutDashboard,
  Star,
  Paperclip,
  ZoomIn,
  ZoomOut,
  Download,
  MessageCircle,
  Bot,
  Cpu,
  Play,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
  Database,
  Package,
  Utensils,
  FileCode,
  Briefcase,
  Sprout,
  PawPrint,
  ShoppingBag,
  PhoneCall,
  Phone,
  Mail,
  Headphones,
  Link as LinkIcon,
  Upload,
  Image as ImageIcon,
  ImageOff,
  Scale,
  Server
} from 'lucide-react';
import { SafeImage } from './SafeImage';
import {
  type UserRBACInfo,
  hasPermission,
  isSuperAdmin,
  getRoleBadge,
  derivePortalCapabilities,
  isViewPermitted,
  getDefaultViewForCapabilities,
} from '../utils/rbac';
import { AccessDeniedPanel } from '../../../shared/rbac/AccessDeniedPanel';
import { AdminRBACManagement } from './AdminRBACManagement';
import { AdminSafeDomainsManagement } from './AdminSafeDomainsManagement';
import { AdminStoresManagement } from './AdminStoresManagement';
import { MobileMarketIntelView } from './MobileMarketIntelView';
import { MobilePolicyManager } from './MobilePolicyManager';
import { ErrorBoundary } from './ErrorBoundary';
import { DocumentPreviewModal, type DocumentPreviewData } from './DocumentPreviewModal';
import { RichTextarea, FormattedText } from './RichTextarea';
import { checkUrlSecurity, cleanDomainString, loadDynamicSafeDomains } from '../utils/urlSecurity';

export const REKBER_FACTORY_DEFAULTS: Record<string, string> = {
  rekber_template_physical: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_general: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_food: "Halo *{store_title}*, saya ingin memesan menu kuliner berikut:\n\n*Menu:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_digital: "Halo *{store_title}*, saya ingin membeli item digital berikut:\n\n*Item:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* agar file dan lisensi terlindungi secara aman.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_service: "Halo *{store_title}*, saya ingin memesan layanan jasa berikut:\n\n*Layanan:* {item_name}\n*Tarif:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan escrow *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman selama masa pengerjaan.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_plant: "Halo *{store_title}*, saya ingin membeli tanaman berikut:\n\n*Tanaman:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman hingga tanaman tiba dalam kondisi segar.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_fauna: "Halo *{store_title}*, saya berminat membeli / mengadopsi hewan berikut:\n\n*Satwa/Hewan:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* dengan proteksi garansi hidup & kesehatan saat tiba.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
};
import { apiClient } from '../utils/apiClient';
import { smartBack, useModalBackHandler, useIsAnyModalOpen } from '../utils/navigation';
import { MobileCustomSelect, type MobileSelectOption } from './MobileCustomSelect';
import {
  interpolateCannedTemplate,
  resolveTicketMessageCount,
  resolveTicketStoreTitle,
  SUPPORT_TEMPLATE_CATEGORIES,
} from '../../../shared/support/supportHelpers';
import appLogoImg from '../assets/logo.png';
import { APP_LOGO_BASE64 } from '../assets/logoBase64';

interface MobilePlatformRolePortalProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onBack?: () => void;
  onOpenRBAC?: () => void;
  onLogout?: () => void;
}

export interface ContextualMenuItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  isDestructive?: boolean;
  variant?: 'normal' | 'danger';
  badge?: string;
  onClick: () => void;
  visible?: boolean;
}

export interface ContextualHeaderConfig {
  showMenu: boolean;
  title?: string;
  subtitle?: string;
  primaryAction?: {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
  };
  items: ContextualMenuItem[];
  includeGlobalUtilities?: boolean;
}

type ActiveView =
  | 'dashboard'
  | 'rbac'
  | 'stores'
  | 'reports'
  | 'support'
  | 'finance'
  | 'monetization'
  | 'broadcast'
  | 'automation'
  | 'audit'
  | 'safe_domains'
  | 'master_data'
  | 'policies'
  | 'market_intel';

const formatSupportDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/\./g, ':');
};

const CATEGORY_LABELS: Record<string, string> = {
  compliance: 'Banding Kepatuhan & Akun',
  technical: 'Kendala Teknis & Bug',
  billing: 'Keuangan & Langganan',
  catalog_help: 'Bantuan Katalog',
  account: 'Akun & Keamanan',
  general: 'Pertanyaan Umum',
  verification: 'Verifikasi & KTP',
  other: 'Lainnya'
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High (Tinggi)', color: '#f97316' },
  medium: { label: 'Medium (Sedang)', color: '#eab308' },
  low: { label: 'Low (Rendah)', color: 'var(--primary)' }
};

const getFirstName = (name?: string): string => {
  if (!name) return 'Merchant';
  const trimmed = name.trim();
  if (!trimmed) return 'Merchant';

  // 1. Take first word before any whitespace
  let first = trimmed.split(/\s+/)[0];

  // 2. If it contains email-like separators, extract the first segment
  if (first.includes('.') || first.includes('_') || first.includes('-')) {
    const subParts = first.split(/[._\-+]/).filter(Boolean);
    if (subParts.length > 0) {
      first = subParts[0];
    }
  }

  // 3. Strip trailing numbers if the remaining letters are a valid name
  const lettersOnly = first.replace(/\d+$/, '');
  if (lettersOnly.length >= 2) {
    first = lettersOnly;
  }

  return first.charAt(0).toUpperCase() + first.slice(1);
};

const getStoreDisplayName = (ticket: any) => {
  if (ticket?.store?.name) return ticket.store.name;
  if (ticket?.store_name) return ticket.store_name;
  if (ticket?.store?.slug) return ticket.store.slug;
  if (ticket?.store_slug) return ticket.store_slug;
  return 'Katalog Merchant';
};

const getStorePlanBadge = (ticket: any) => {
  const plan = ticket?.store?.plan || ticket?.store_plan || 'free';
  return plan.toUpperCase();
};

const getUserRequesterName = (ticket: any, msgSender?: any) => {
  if (msgSender?.name && !msgSender.name.includes('@')) return getFirstName(msgSender.name);
  if (ticket?.user?.name && !ticket.user.name.includes('@')) return getFirstName(ticket.user.name);
  const rawEmail = ticket?.user?.email || ticket?.user_email || msgSender?.email || '';
  if (rawEmail) {
    const prefix = rawEmail.split('@')[0];
    if (prefix) return getFirstName(prefix);
  }
  return 'Merchant';
};

const getMerchantDisplayName = (ticket: any, msgSender?: any) => {
  return getStoreDisplayName(ticket);
};

export const PlatformRolePortal: React.FC<MobilePlatformRolePortalProps> = ({
  token,
  currentUser,
  onBack,
  onOpenRBAC,
  onLogout
}) => {
  // Centralized authenticated fetch with automatic 401 session eviction (never logout on 403 RBAC deny)
  const fetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await window.fetch(input, init);
    if (res.status === 401) {
      if (onLogout) {
        onLogout();
      }
      throw new Error('UNAUTHORIZED');
    }
    return res;
  }, [onLogout]);
  // Theme Mode: Strictly Light and Dark Mode only for Platform Admin
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('catavor_admin_theme_mode') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('catavor_admin_theme_mode', next);
  };

  const isDark = themeMode === 'dark';

  // Strict 2-Theme Design System Tokens
  const theme = {
    bg: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#0f172a' : '#ffffff',
    card: isDark ? '#1e293b' : '#ffffff',
    cardAlt: isDark ? '#141d2e' : '#f1f5f9',
    cardHover: isDark ? '#273549' : '#f8fafc',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#cbd5e1' : '#475569',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1',
    quoteBg: isDark ? 'rgba(0, 0, 0, 0.3)' : '#f1f5f9',
    modalBg: isDark ? '#0f172a' : '#ffffff',
    modalOverlay: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.45)',
    shadow: isDark ? '0 8px 25px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.06)',
    cardShadow: isDark ? '0 4px 15px rgba(0, 0, 0, 0.2)' : '0 2px 10px rgba(0, 0, 0, 0.04)',
    chipActiveBg: isDark ? '#38bdf8' : '#0284c7',
    chipActiveText: isDark ? '#000000' : '#ffffff',
    chipInactiveBg: isDark ? '#1e293b' : '#f1f5f9',
    chipInactiveText: isDark ? '#94a3b8' : '#64748b'
  };

  const roleSlug = currentUser?.platform_role || (currentUser?.is_superadmin ? 'superadmin' : 'merchant');
  const roleBadge = getRoleBadge(roleSlug);

  // Granular Permission Checks (SSOT from shared rbac/model.ts)
  const caps = derivePortalCapabilities(currentUser);
  const {
    canAccessRBAC,
    canAccessCompliance,
    canSuspendStores,
    canAccessSupport,
    canManageSupportTemplates,
    canAccessFinance,
    canReadOrders,
    canReadRevenue,
    canAccessMonetization,
    canAccessBroadcast,
    canAccessAutomation,
    canAccessAudit,
    canManageSystemSettings,
    canAccessMasterData,
    canAccessSettingsRead,
    canAccessMarketIntel,
    canReplySupport,
    canManageOrders: canManageFinance,
    canManagePaymentSettings,
    canManageCoupons,
  } = caps;
  const canManageReports = caps.isSuperAdmin || hasPermission(currentUser, 'compliance:reports:manage');
  const canSendBroadcast = canAccessBroadcast;
  // Helper to synchronize URL query parameters cleanly and safely for Mobile Admin
  const updatePlatformUrl = (
    view: string,
    ticketRef?: string | number | null,
    subtabRef?: string | null,
    broadcastIdRef?: string | number | null,
    reportIdRef?: string | number | null
  ) => {
    try {
      const url = new URL(window.location.href);
      if (view) {
        url.searchParams.set('tab', view);
      } else {
        url.searchParams.delete('tab');
      }

      if (ticketRef) {
        const sanitized = String(ticketRef).replace(/[^a-zA-Z0-9_#-]/g, '').trim();
        url.searchParams.set('ticket', sanitized);
      } else {
        url.searchParams.delete('ticket');
        url.searchParams.delete('ticket_id');
      }

      if (subtabRef) {
        url.searchParams.set('subtab', subtabRef);
      } else {
        url.searchParams.delete('subtab');
      }

      if (broadcastIdRef) {
        const sanitizedBcast = String(broadcastIdRef).replace(/[^a-zA-Z0-9_#-]/g, '').trim();
        url.searchParams.set('broadcast_id', sanitizedBcast);
      } else {
        url.searchParams.delete('broadcast_id');
        url.searchParams.delete('broadcast');
      }

      if (reportIdRef) {
        const sanitizedReport = String(reportIdRef).replace(/[^a-zA-Z0-9_#-]/g, '').trim();
        url.searchParams.set('report_id', sanitizedReport);
      } else {
        url.searchParams.delete('report_id');
        url.searchParams.delete('report');
      }

      const newRelativePathQuery = url.pathname + url.search + url.hash;
      const currentRelativePathQuery = window.location.pathname + window.location.search + window.location.hash;
      if (newRelativePathQuery !== currentRelativePathQuery) {
        window.history.pushState(
          { view, ticket: ticketRef || null, subtab: subtabRef || null, broadcast_id: broadcastIdRef || null, report_id: reportIdRef || null },
          '',
          newRelativePathQuery
        );
      }
    } catch (e) {
      console.error('Failed to sync mobile URL:', e);
    }
  };

  const getDefaultView = (): ActiveView => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = (urlParams.get('tab') || urlParams.get('view') || urlParams.get('division') || '').toLowerCase();
      const ticketParam = urlParams.get('ticket') || urlParams.get('ticket_id');
      const broadcastId = urlParams.get('broadcast_id') || urlParams.get('broadcast') || urlParams.get('notif_id');
      const reportParam = urlParams.get('report_id') || urlParams.get('report');

      if (ticketParam) return 'support';
      if (broadcastId) return 'broadcast';
      if (reportParam) return 'reports';

      if (['dashboard', 'overview', 'home'].includes(tabParam)) return 'dashboard';
      if (['rbac', 'staff', 'roles', 'users'].includes(tabParam)) return 'rbac';
      if (['stores', 'merchants', 'toko'].includes(tabParam)) return 'stores';
      if (['reports', 'compliance', 'laporan'].includes(tabParam)) return 'reports';
      if (['support', 'help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) return 'support';
      if (['finance', 'keuangan', 'billing', 'orders'].includes(tabParam)) return 'finance';
      if (['monetization', 'iklan', 'ads', 'google'].includes(tabParam)) return 'monetization';
      if (['broadcast', 'siaran', 'notifikasi'].includes(tabParam)) return 'broadcast';
      if (['automation', 'bot', 'bots', 'otomatisasi', 'cron', 'engine', 'workers'].includes(tabParam)) return 'automation';
      if (['policies', 'policy', 'kebijakan', 'legal', 'settings', 'setting', 'terms', 'aturan'].includes(tabParam)) return 'policies';
      if (['master_data', 'master-data', 'domains', 'safe_domains', 'whitelist', 'domain', 'master', 'masters', 'templates', 'canned'].includes(tabParam)) return 'master_data';
      if (['audit', 'logs', 'activity', 'jejak'].includes(tabParam)) return 'audit';
      if (['market_intel', 'market-intel', 'intel', 'intelligence', 'riset', 'riset-pasar', 'b2b'].includes(tabParam)) return 'market_intel';
    } catch {
      // fallback
    }

    return getDefaultViewForCapabilities(caps, roleSlug) as ActiveView;
  };

  const [activeView, setActiveView] = useState<ActiveView>(getDefaultView());

  const performSwitchView = (view: ActiveView, ticketId?: any, subView?: string | null) => {
    const targetView = view === 'safe_domains' ? 'master_data' : view;
    setActiveView(targetView);
    setSelectedTicket(null);
    if (targetView === 'broadcast') {
      setBroadcastSubViewState((subView === 'create' || subView === 'detail') ? subView : 'list');
    } else {
      setBroadcastSubViewState('list');
    }
    if (targetView === 'master_data') {
      const sub = (subView === 'templates' || subView === 'domains' || subView === 'rekber' || subView === 'contact' || subView === 'policies')
        ? subView
        : (view === 'safe_domains' ? 'domains' : (subView === 'menu' ? 'menu' : (subView ? (subView as any) : 'menu')));
      setMasterSubView(sub);
      updatePlatformUrl('master_data', null, sub === 'menu' ? null : sub);
      if (sub === 'templates') {
        fetchCannedTemplates(true);
      }
    } else {
      updatePlatformUrl(targetView, ticketId, subView);
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleSwitchView = (view: ActiveView, ticketId?: any, subView?: string | null) => {
    const targetView = view === 'safe_domains' ? 'master_data' : view;
    if (activeView === 'broadcast' && broadcastSubViewState !== 'list' && targetView !== 'broadcast' && typeof window !== 'undefined') {
      const guard = (window as unknown as { __catavor_broadcast_dirty_guard?: (cb?: () => void) => boolean }).__catavor_broadcast_dirty_guard;
      if (guard && guard(() => performSwitchView(view, ticketId, subView))) {
        return;
      }
    }
    performSwitchView(view, ticketId, subView);
  };

  const handleCloseTicketChat = () => {
    setSelectedTicket(null);
    updatePlatformUrl(activeView || 'support', null);
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Support Division & Master Data Sub-Navigation State
  const [supportSubView, setSupportSubView] = useState<'tickets'>('tickets');
  const [masterSubView, setMasterSubView] = useState<'menu' | 'domains' | 'templates' | 'rekber' | 'contact' | 'policies'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sub = (params.get('subtab') || params.get('subview') || params.get('sub') || '').toLowerCase();
      const tab = (params.get('tab') || params.get('view') || '').toLowerCase();
      if (['policies', 'policy', 'kebijakan', 'legal'].includes(sub) || ['policies', 'policy', 'kebijakan', 'legal'].includes(tab)) return 'policies';
      if (['contact', 'kontak', 'official_contact', 'support_contact'].includes(sub) || ['contact', 'kontak'].includes(tab)) return 'contact';
      if (['rekber', 'rekbersyariah', 'escrow'].includes(sub) || ['rekber', 'rekbersyariah'].includes(tab)) return 'rekber';
      if (['templates', 'template', 'canned', 'canned_responses'].includes(sub) || ['templates', 'canned'].includes(tab)) return 'templates';
      if (['domains', 'safe_domains', 'whitelist', 'domain'].includes(sub) || ['domains', 'safe_domains', 'whitelist'].includes(tab)) return 'domains';
    } catch { }
    return 'menu';
  });
  const [cannedTemplates, setCannedTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFooterStatusMenu, setShowFooterStatusMenu] = useState(false);

  const getTicketStatusMeta = (status: string) => {
    switch (status) {
      case 'open':
        return {
          id: 'open',
          label: 'Open (Baru)',
          shortLabel: 'Baru',
          color: '#06b6d4',
          bg: isDark ? 'rgba(6, 182, 212, 0.16)' : 'rgba(6, 182, 212, 0.1)',
          border: isDark ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.25)',
          desc: 'Tiket baru, menunggu respons pertama CS'
        };
      case 'waiting_agent':
        return {
          id: 'waiting_agent',
          label: 'Butuh Respon CS',
          shortLabel: 'Respon CS',
          color: isDark ? '#38bdf8' : '#0284c7',
          bg: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(2, 132, 199, 0.1)',
          border: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)',
          desc: 'Merchant telah membalas, menunggu respons tim CS'
        };
      case 'in_progress':
        return {
          id: 'in_progress',
          label: 'Proses (In Progress)',
          shortLabel: 'Proses',
          color: isDark ? '#fbbf24' : '#d97706',
          bg: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.1)',
          border: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
          desc: 'Sedang diinvestigasi / dikerjakan oleh tim CS'
        };
      case 'waiting_user':
        return {
          id: 'waiting_user',
          label: 'Tunggu User (Pending)',
          shortLabel: 'Tunggu User',
          color: isDark ? '#c084fc' : '#9333ea',
          bg: isDark ? 'rgba(168, 85, 247, 0.16)' : 'rgba(168, 85, 247, 0.1)',
          border: isDark ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.25)',
          desc: 'CS telah menjawab, menunggu tanggapan merchant'
        };
      case 'resolved':
        return {
          id: 'resolved',
          label: 'Selesai (Resolved)',
          shortLabel: 'Selesai',
          color: isDark ? '#34d399' : '#059669',
          bg: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)',
          border: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)',
          desc: 'Kendala tuntas diselesaikan oleh CS'
        };
      case 'closed':
        return {
          id: 'closed',
          label: 'Tutup (Closed)',
          shortLabel: 'Tutup',
          color: '#94a3b8',
          bg: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.1)',
          border: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.25)',
          desc: 'Tiket ditutup permanen (arsip)'
        };
      default: {
        const cleanStr = (status || 'Open').replace(/_/g, ' ');
        const capStr = cleanStr.charAt(0).toUpperCase() + cleanStr.slice(1);
        return {
          id: status || 'open',
          label: capStr,
          shortLabel: capStr,
          color: '#38bdf8',
          bg: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.1)',
          border: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.25)',
          desc: 'Status tiket bantuan'
        };
      }
    }
  };

  const handleNavigateToTemplatesMaster = () => {
    setShowTemplateModal(false);
    setTemplateSheetDragY(0);
    setSelectedTicket(null); // CRITICAL: Exits ticket conversation detail view so user immediately lands on Master Template page!
    setActiveView('master_data');
    setMasterSubView('templates');
    updatePlatformUrl('master_data', null, 'templates');
    fetchCannedTemplates(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateCategoryCounts, setTemplateCategoryCounts] = useState<{ category: string; count: number }[]>([]);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [debouncedTemplateSearch, setDebouncedTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(1);
  const [templateLimit, setTemplateLimit] = useState(10);
  const [templatePagination, setTemplatePagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTemplateSearch(templateSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [templateSearchQuery]);

  useEffect(() => {
    setTemplatePage(1);
  }, [debouncedTemplateSearch, templateCategoryFilter]);

  // Master Template CRUD Modal State
  const [showTemplateFormModal, setShowTemplateFormModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    shortcut: '',
    category: 'general',
    content: '',
    is_active: true,
    sort_order: 0
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Swipe & Drag Bottom Sheet State for Quick Template Modal
  const [templateSheetDragY, setTemplateSheetDragY] = useState(0);
  const [isTemplateSheetDragging, setIsTemplateSheetDragging] = useState(false);
  const templateDragStartY = useRef(0);

  const handleTemplateSheetDragStart = (clientY: number) => {
    templateDragStartY.current = clientY;
    setIsTemplateSheetDragging(true);
  };

  const handleTemplateSheetDragMove = (clientY: number) => {
    if (!isTemplateSheetDragging) return;
    const delta = clientY - templateDragStartY.current;
    if (delta > 0) {
      setTemplateSheetDragY(delta);
    } else {
      setTemplateSheetDragY(delta * 0.18);
    }
  };

  const handleTemplateSheetDragEnd = () => {
    if (!isTemplateSheetDragging) return;
    setIsTemplateSheetDragging(false);
    if (templateSheetDragY > 75) {
      setShowTemplateModal(false);
    }
    setTemplateSheetDragY(0);
  };

  useEffect(() => {
    if (!showTemplateModal) {
      setTemplateSheetDragY(0);
      setIsTemplateSheetDragging(false);
    }
  }, [showTemplateModal]);

  // Swipe & Drag Bottom Sheet State for Ticket Status Modal
  const [statusSheetDragY, setStatusSheetDragY] = useState(0);
  const [isStatusSheetDragging, setIsStatusSheetDragging] = useState(false);
  const statusDragStartY = useRef(0);

  const handleStatusSheetDragStart = (clientY: number) => {
    statusDragStartY.current = clientY;
    setIsStatusSheetDragging(true);
  };

  const handleStatusSheetDragMove = (clientY: number) => {
    if (!isStatusSheetDragging) return;
    const delta = clientY - statusDragStartY.current;
    if (delta > 0) {
      setStatusSheetDragY(delta);
    } else {
      setStatusSheetDragY(delta * 0.18);
    }
  };

  const handleStatusSheetDragEnd = () => {
    if (!isStatusSheetDragging) return;
    setIsStatusSheetDragging(false);
    if (statusSheetDragY > 75) {
      setShowFooterStatusMenu(false);
    }
    setStatusSheetDragY(0);
  };

  useEffect(() => {
    if (!showFooterStatusMenu) {
      setStatusSheetDragY(0);
      setIsStatusSheetDragging(false);
    }
  }, [showFooterStatusMenu]);

  // Swipe & Drag Bottom Sheet State for Template Form Modal (Tambah / Edit)
  const [templateFormDragY, setTemplateFormDragY] = useState(0);
  const [isTemplateFormDragging, setIsTemplateFormDragging] = useState(false);
  const formDragStartY = useRef(0);

  const handleTemplateFormDragStart = (clientY: number) => {
    formDragStartY.current = clientY;
    setIsTemplateFormDragging(true);
  };

  const handleTemplateFormDragMove = (clientY: number) => {
    if (!isTemplateFormDragging) return;
    const delta = clientY - formDragStartY.current;
    if (delta > 0) {
      setTemplateFormDragY(delta);
    } else {
      setTemplateFormDragY(delta * 0.18);
    }
  };

  const handleTemplateFormDragEnd = () => {
    if (!isTemplateFormDragging) return;
    setIsTemplateFormDragging(false);
    if (templateFormDragY > 75) {
      setShowTemplateFormModal(false);
    }
    setTemplateFormDragY(0);
  };

  useEffect(() => {
    if (!showTemplateFormModal) {
      setTemplateFormDragY(0);
      setIsTemplateFormDragging(false);
    }
  }, [showTemplateFormModal]);

  // Floating Scroll to Top button: Intent-Based Directional Detection (Only shows on scroll UP intent)
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  const scrollUpDistance = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
          const diff = currentY - lastScrollY.current;

          // Jika berada di dekat puncak atas halaman (<= 150px), sembunyikan tombol
          if (currentY <= 150) {
            setShowScrollTop(false);
            scrollUpDistance.current = 0;
          } else if (diff > 4) {
            // User sedang scroll ke bawah -> sembunyikan tombol seketika (zero clutter / anti-overlap)
            setShowScrollTop(false);
            scrollUpDistance.current = 0;
          } else if (diff < -4) {
            // User sedang scroll ke atas -> akumulasi jarak geser ke atas
            scrollUpDistance.current += Math.abs(diff);
            // Begitu terdeteksi intensi nyata scroll ke atas (akumulasi >= 25px), munculkan tombol
            if (scrollUpDistance.current >= 25) {
              setShowScrollTop(true);
            }
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowScrollTop(false);
    scrollUpDistance.current = 0;
  };

  const fetchCannedTemplates = async (
    targetPageOrIncludeInactive: number | boolean = templatePage,
    targetSearch = debouncedTemplateSearch,
    targetCategory = templateCategoryFilter,
    targetLimit = templateLimit,
    includeInactive = true,
    fetchAll = false
  ) => {
    let pageNum = templatePage;
    let inact = includeInactive;
    if (typeof targetPageOrIncludeInactive === 'boolean') {
      inact = targetPageOrIncludeInactive;
    } else if (typeof targetPageOrIncludeInactive === 'number') {
      pageNum = targetPageOrIncludeInactive;
    }

    setLoadingTemplates(true);
    try {
      const params = new URLSearchParams();
      if (fetchAll) {
        params.set('all', 'true');
      } else {
        params.set('page', String(pageNum));
        params.set('limit', String(targetLimit));
      }
      if (inact) params.set('include_inactive', 'true');
      if (targetCategory && targetCategory !== 'all') params.set('category', targetCategory);
      if (targetSearch && targetSearch.trim()) params.set('search', targetSearch.trim());

      const url = `/api/admin/support/templates?${params.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCannedTemplates(data.data || []);
        if (data.pagination) {
          setTemplatePagination(data.pagination);
        }
        if (Array.isArray(data.categories)) {
          setTemplateCategoryCounts(data.categories.filter((c: any) => c && c.category && c.count > 0));
        } else {
          // Dynamic fallback aggregation: only categories with count > 0
          const countMap: Record<string, number> = {};
          (data.data || []).forEach((t: any) => {
            const cat = t.category || 'general';
            countMap[cat] = (countMap[cat] || 0) + 1;
          });
          setTemplateCategoryCounts(Object.entries(countMap).map(([category, count]) => ({ category, count })));
        }
      }
    } catch (e) {
      console.error('Failed to load canned response templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const templateCategoryLabels: Record<string, string> = useMemo(() => ({
    all: 'Semua Kategori',
    general: 'Umum & Greeting',
    billing: 'Keuangan',
    technical: 'Teknis',
    closing: 'Penutupan',
    account: 'Akun & Keamanan'
  }), []);

  // Dynamic Template Category Options: strictly contains only categories that have actual data (count > 0)
  const mobileTemplateCategoryOptions = useMemo<MobileSelectOption[]>(() => {
    const totalCount = Number(templatePagination.total ?? cannedTemplates.length);
    const options: MobileSelectOption[] = [
      {
        value: 'all',
        label: 'Semua Kategori',
        count: totalCount
      }
    ];

    templateCategoryCounts.forEach(c => {
      if (c.count > 0 && c.category !== 'all') {
        const label = templateCategoryLabels[c.category] || (c.category.charAt(0).toUpperCase() + c.category.slice(1));
        options.push({
          value: c.category,
          label,
          count: c.count
        });
      }
    });

    return options;
  }, [templateCategoryCounts, templatePagination.total, cannedTemplates.length, templateCategoryLabels]);

  // Safety auto-reset: if selected template category filter no longer has data, fallback safely to 'all'
  useEffect(() => {
    if (templateCategoryFilter !== 'all' && mobileTemplateCategoryOptions.length > 1) {
      const exists = mobileTemplateCategoryOptions.some(opt => opt.value === templateCategoryFilter);
      if (!exists) {
        setTemplateCategoryFilter('all');
      }
    }
  }, [mobileTemplateCategoryOptions, templateCategoryFilter]);

  useEffect(() => {
    if (activeView === 'master_data' && masterSubView === 'templates') {
      fetchCannedTemplates(templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, true, false);
    }
  }, [activeView, masterSubView, templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, token]);

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      title: '',
      shortcut: '',
      category: 'general',
      content: '',
      is_active: true,
      sort_order: (cannedTemplates.length + 1)
    });
    setShowTemplateFormModal(true);
  };

  const handleOpenEditTemplate = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      title: tmpl.title || '',
      shortcut: tmpl.shortcut || '',
      category: tmpl.category || 'general',
      content: tmpl.content || '',
      is_active: tmpl.is_active !== false,
      sort_order: tmpl.sort_order || 0
    });
    setShowTemplateFormModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.title.trim() || !templateForm.content.trim()) {
      showToast('Judul dan isi template wajib diisi!', 'error');
      return;
    }

    setSavingTemplate(true);
    try {
      const isEdit = !!editingTemplate?.id;
      const url = isEdit ? `/api/admin/support/templates/${editingTemplate.id}` : '/api/admin/support/templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(templateForm)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(isEdit ? 'Template berhasil diperbarui!' : 'Template baru berhasil ditambahkan!', 'success');
        setShowTemplateFormModal(false);
        fetchCannedTemplates(true);
      } else {
        showToast(data.message || 'Gagal menyimpan template', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Terjadi kesalahan saat menyimpan template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (tmplId: number, tmplTitle: string) => {
    if (!window.confirm(`Hapus template "${tmplTitle}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`/api/admin/support/templates/${tmplId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template berhasil dihapus!', 'success');
        fetchCannedTemplates(true);
      } else {
        showToast(data.message || 'Gagal menghapus template', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Gagal menghubungi server', 'error');
    }
  };

  const handleToggleTemplateActive = async (tmpl: any) => {
    try {
      const nextActive = !tmpl.is_active;
      const res = await fetch(`/api/admin/support/templates/${tmpl.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ is_active: nextActive })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Template "${tmpl.title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}!`, 'info');
        fetchCannedTemplates(true);
      }
    } catch (e) {
      console.error('Failed to toggle template active status:', e);
    }
  };

  const handleResetDefaultTemplates = async () => {
    if (!window.confirm('Pulihkan template bawaan standar Catavor? Template kustom Anda akan direset ke daftar default.')) return;

    try {
      const res = await fetch('/api/admin/support/templates/reset-defaults', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template bawaan berhasil dipulihkan!', 'success');
        fetchCannedTemplates(true);
      } else {
        showToast(data.message || 'Gagal memulihkan template', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Gagal menghubungi server', 'error');
    }
  };

  const handleApplyTemplate = (tmpl: any) => {
    if (!tmpl) return;
    const content = interpolateCannedTemplate(tmpl.content || '', {
      merchantName: getMerchantDisplayName(selectedTicket),
      storeTitle: resolveTicketStoreTitle(selectedTicket),
      ticketNumber: selectedTicket?.ticket_number || `#TCK-${selectedTicket?.id}`,
      agentName: currentUser?.name || 'Staf CS',
    });

    setReplyText(content);
    setShowTemplateModal(false);
    showToast(`Template "${tmpl.title}" disisipkan!`, 'success');
  };

  // Swipe & Drag Bottom Sheet State for Options Menu
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef(0);
  const currentDragY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    currentDragY.current = 0;
    setIsDraggingSheet(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingSheet) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY.current;
    if (deltaY > 0) {
      currentDragY.current = deltaY;
      setSheetDragY(deltaY);
    } else {
      // Gentle resistance when pulling up
      const resisted = deltaY * 0.2;
      currentDragY.current = resisted;
      setSheetDragY(resisted);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (currentDragY.current > 70) {
      setShowOptionsMenu(false);
    }
    setSheetDragY(0);
  };

  useEffect(() => {
    if (!showOptionsMenu) {
      setSheetDragY(0);
      setIsDraggingSheet(false);
    }
  }, [showOptionsMenu]);

  // Scroll listener with hysteresis and requestAnimationFrame to prevent header jitter/vibration
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const offset = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          setIsScrolled((prev) => {
            // Hysteresis deadband:
            // Activate scrolled mode when scroll is beyond 25px
            // Deactivate ONLY when scroll returns back near the very top (< 8px)
            if (!prev && offset > 25) {
              return true;
            }
            if (prev && offset < 8) {
              return false;
            }
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // States: Division Data
  const [reports, setReports] = useState<any[]>([]);
  const [reportsFilter, setReportsFilter] = useState<'all' | 'pending' | 'investigating' | 're_review' | 'action_taken' | 'banned' | 'resolved' | 'dismissed'>('all');
  const [reportsTargetFilter, setReportsTargetFilter] = useState<'all' | 'item' | 'catalog'>('all');
  const [reportsSearchQuery, setReportsSearchQuery] = useState<string>('');
  const [moderationModalReport, setModerationModalReport] = useState<any | null>(null);
  const [moderationStatus, setModerationStatus] = useState<string>('investigating');
  const [moderationAction, setModerationAction] = useState<string>('none');
  const [moderationNotes, setModerationNotes] = useState<string>('');
  const [isSubmittingModeration, setIsSubmittingModeration] = useState<boolean>(false);
  const isSubmittingModerationRef = useRef<boolean>(false);
  const [showModerationConfirmModal, setShowModerationConfirmModal] = useState<boolean>(false);
  const [bannedConfirmModalReport, setBannedConfirmModalReport] = useState<any | null>(null);
  const [bannedConfirmInput, setBannedConfirmInput] = useState<string>('');
  const [bannedConfirmAcknowledged, setBannedConfirmAcknowledged] = useState<boolean>(false);

  // Swipe & Drag Bottom Sheet State for Banned Confirmation Modal (Mobile Standard)
  const [bannedConfirmDragY, setBannedConfirmDragY] = useState(0);
  const [isBannedConfirmDragging, setIsBannedConfirmDragging] = useState(false);
  const bannedConfirmDragStartY = useRef(0);

  const handleDismissBannedConfirmModal = () => {
    setShowModerationConfirmModal(false);
    setBannedConfirmModalReport(null);
    setBannedConfirmAcknowledged(false);
    setBannedConfirmDragY(0);
    setIsBannedConfirmDragging(false);
  };

  useModalBackHandler({
    isOpen: showModerationConfirmModal,
    onClose: handleDismissBannedConfirmModal,
    modalId: 'banned-confirm-modal',
  });

  const handleBannedConfirmDragStart = (clientY: number) => {
    bannedConfirmDragStartY.current = clientY;
    setIsBannedConfirmDragging(true);
  };

  const handleBannedConfirmDragMove = (clientY: number) => {
    if (!isBannedConfirmDragging) return;
    const delta = clientY - bannedConfirmDragStartY.current;
    if (delta > 0) {
      setBannedConfirmDragY(delta);
    } else {
      setBannedConfirmDragY(delta * 0.18);
    }
  };

  const handleBannedConfirmDragEnd = () => {
    if (!isBannedConfirmDragging) return;
    setIsBannedConfirmDragging(false);
    if (bannedConfirmDragY > 75 && !isSubmittingModeration) {
      handleDismissBannedConfirmModal();
    } else {
      setBannedConfirmDragY(0);
    }
  };

  useEffect(() => {
    if (!showModerationConfirmModal) {
      setBannedConfirmDragY(0);
      setIsBannedConfirmDragging(false);
    }
  }, [showModerationConfirmModal]);
  const [reportsPagination, setReportsPagination] = useState<{ page: number; limit: number; total: number; total_pages: number }>({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [reportMetrics, setReportMetrics] = useState<any | null>(null);
  const [reportActiveEvidence, setReportActiveEvidence] = useState<any[]>([]);
  const [reportPriorHistory, setReportPriorHistory] = useState<any[]>([]);
  const [isLoadingReportDetail, setIsLoadingReportDetail] = useState<boolean>(false);
  const [dormancyMetrics, setDormancyMetrics] = useState<any | null>(null);

  const formatCatalogType = (pType?: string) => {
    const clean = (pType || '').toLowerCase().trim();
    switch (clean) {
      case 'fauna':
        return 'Satwa';
      case 'plant':
        return 'Tanaman';
      case 'physical':
        return 'Barang Fisik';
      case 'digital':
        return 'Produk Digital';
      case 'service':
        return 'Jasa & Layanan';
      case 'food':
        return 'Kuliner';
      case 'property':
        return 'Properti';
      default:
        return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Barang Fisik';
    }
  };

  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsFilter, setTicketsFilter] = useState<'all' | 'unread' | 'action_required' | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
  const [ticketSlaFilter, setTicketSlaFilter] = useState<string>('all');
  const [ticketAssignedFilter, setTicketAssignedFilter] = useState<'all' | 'me' | 'unassigned'>('all');
  const [assigningTicketId, setAssigningTicketId] = useState<number | null>(null);
  const [resolvedTimeRangeFilter, setResolvedTimeRangeFilter] = useState<'30d' | '90d' | 'all'>('30d');

  // Pengurutan alami tiket layaknya aplikasi media sosial / chat:
  // Seluruh tiket diurutkan berdasarkan tanggal/waktu pesan terakhir (terbaru di posisi paling atas)
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const getLatestTime = (t: any): number => {
        if (Array.isArray(t.messages) && t.messages.length > 0) {
          const last = t.messages[t.messages.length - 1];
          const mt = new Date(last.raw_created_at || last.created_at || last.timestamp || 0).getTime();
          if (!isNaN(mt) && mt > 1000000000) return mt;
        }
        if (t.raw_last_message_at || t.last_message_at) {
          const lma = new Date(t.raw_last_message_at || t.last_message_at).getTime();
          if (!isNaN(lma) && lma > 1000000000) return lma;
        }
        if (t.raw_updated_at || t.updated_at) {
          const ua = new Date(t.raw_updated_at || t.updated_at).getTime();
          if (!isNaN(ua) && ua > 1000000000) return ua;
        }
        const ca = new Date(t.created_at || 0).getTime();
        return isNaN(ca) ? 0 : ca;
      };
      return getLatestTime(b) - getLatestTime(a);
    });
  }, [tickets]);

  // Server-Side Tickets Pagination & Metrics State
  const [ticketsMetrics, setTicketsMetrics] = useState<{
    total: number;
    action_required: number;
    in_progress: number;
    waiting_user: number;
    urgent: number;
    resolved: number;
    sla_breached?: number;
    csat_rated_count?: number;
    csat_avg?: number;
    csat_score_percent?: number;
  }>({
    total: 0,
    action_required: 0,
    in_progress: 0,
    waiting_user: 0,
    urgent: 0,
    resolved: 0,
    sla_breached: 0,
    csat_rated_count: 0,
    csat_avg: 5.0,
    csat_score_percent: 100
  });
  const [ticketsPagination, setTicketsPagination] = useState<{
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_more: boolean;
  }>({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
    has_more: false
  });
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoadingMore, setTicketsLoadingMore] = useState(false);
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Bottom Sheet Filter Modal States for Mobile Helpdesk
  const [activeFilterModal, setActiveFilterModal] = useState<'category' | 'priority' | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterSheetDragY, setFilterSheetDragY] = useState<number>(0);
  const [isFilterSheetDragging, setIsFilterSheetDragging] = useState<boolean>(false);
  const filterTouchStartY = useRef<number>(0);

  const handleFilterSheetDragStart = (clientY: number) => {
    filterTouchStartY.current = clientY;
    setIsFilterSheetDragging(true);
  };

  const handleFilterSheetDragMove = (clientY: number) => {
    if (!isFilterSheetDragging) return;
    const delta = clientY - filterTouchStartY.current;
    if (delta > 0) {
      setFilterSheetDragY(delta);
    } else {
      setFilterSheetDragY(delta * 0.15);
    }
  };

  const handleFilterSheetDragEnd = () => {
    if (!isFilterSheetDragging) return;
    setIsFilterSheetDragging(false);
    if (filterSheetDragY > 75) {
      setActiveFilterModal(null);
    }
    setFilterSheetDragY(0);
  };

  // Available unique categories & priorities from tickets: strictly count > 0
  const availableCategories = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const cat = t.category || 'general';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .filter(([_, count]) => count > 0)
      .map(([cat, count]) => ({
        id: cat,
        label: CATEGORY_LABELS[cat] || cat,
        count
      }));
  }, [tickets]);

  const availablePriorities = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const p = (t.priority || 'medium').toLowerCase();
      map[p] = (map[p] || 0) + 1;
    });
    const allPrios = ['urgent', 'high', 'medium', 'low'];
    return allPrios
      .filter(p => (map[p] || 0) > 0)
      .map(p => ({
        id: p,
        label: PRIORITY_META[p]?.label || p,
        color: PRIORITY_META[p]?.color || '#94a3b8',
        count: map[p] || 0
      }));
  }, [tickets]);

  // Dynamic Support Category Options for Mobile: strictly count > 0
  const mobileTicketCategoryOptions = useMemo<MobileSelectOption[]>(() => {
    const total = tickets.length;
    const options: MobileSelectOption[] = [
      { value: 'all', label: 'Semua Kategori', count: total }
    ];
    availableCategories.forEach(c => {
      if (c.count > 0 && c.id !== 'all') {
        options.push({
          value: c.id,
          label: c.label,
          count: c.count
        });
      }
    });
    return options;
  }, [availableCategories, tickets.length]);

  // Dynamic Support Priority Options for Mobile: strictly count > 0
  const mobileTicketPriorityOptions = useMemo<MobileSelectOption[]>(() => {
    const total = tickets.length;
    const options: MobileSelectOption[] = [
      { value: 'all', label: 'Semua Prioritas', count: total }
    ];
    availablePriorities.forEach(p => {
      if (p.count > 0 && p.id !== 'all') {
        options.push({
          value: p.id,
          label: p.label,
          count: p.count,
          badgeColor: p.color
        });
      }
    });
    return options;
  }, [availablePriorities, tickets.length]);

  // Safety auto-reset for mobile support
  useEffect(() => {
    if (ticketCategoryFilter !== 'all' && mobileTicketCategoryOptions.length > 1) {
      if (!mobileTicketCategoryOptions.some(c => c.value === ticketCategoryFilter)) {
        setTicketCategoryFilter('all');
      }
    }
  }, [mobileTicketCategoryOptions, ticketCategoryFilter]);

  useEffect(() => {
    if (ticketPriorityFilter !== 'all' && mobileTicketPriorityOptions.length > 1) {
      if (!mobileTicketPriorityOptions.some(p => p.value === ticketPriorityFilter)) {
        setTicketPriorityFilter('all');
      }
    }
  }, [mobileTicketPriorityOptions, ticketPriorityFilter]);

  // Global target counts for compliance reports in mobile (prefer server metrics over current page slice)
  const mobileReportTargetCounts = useMemo(() => {
    const item = typeof reportMetrics?.item_count === 'number'
      ? reportMetrics.item_count
      : reports.filter(r => r.target_type !== 'catalog' && r.target_type !== 'store').length;
    const catalog = typeof reportMetrics?.catalog_count === 'number'
      ? reportMetrics.catalog_count
      : reports.filter(r => r.target_type === 'catalog' || r.target_type === 'store').length;
    const total = reportMetrics ? reportMetrics.total : reports.length;
    return { total, item, catalog };
  }, [reports, reportMetrics]);

  // Dynamic Status Options for Reports in mobile: strictly count > 0
  const mobileReportStatusOptions = useMemo<MobileSelectOption[]>(() => {
    const list: MobileSelectOption[] = [
      { value: 'all', label: 'Semua Status Laporan', count: reportMetrics ? reportMetrics.total : reports.length },
      { value: 'pending', label: 'Menunggu', count: reportMetrics ? reportMetrics.pending : reports.filter(r => r.status === 'pending').length },
      { value: 'investigating', label: 'Investigasi', count: reportMetrics ? reportMetrics.investigating : reports.filter(r => r.status === 'investigating').length },
      { value: 're_review', label: 'Revisi Masuk', count: reportMetrics ? (reportMetrics.re_review || 0) : reports.filter(r => r.status === 're_review').length },
      { value: 'action_taken', label: 'Ditindak', count: reportMetrics ? (reportMetrics.action_taken || 0) : reports.filter(r => r.status === 'action_taken' && r.action_taken !== 'catalog_banned').length },
      { value: 'banned', label: 'Banned', count: reportMetrics ? (reportMetrics.banned || 0) : reports.filter(r => r.status === 'banned' || r.action_taken === 'catalog_banned').length },
      { value: 'dismissed', label: 'Ditolak', count: reportMetrics ? reportMetrics.dismissed : reports.filter(r => r.status === 'dismissed').length },
      { value: 'resolved', label: 'Selesai', count: reportMetrics ? reportMetrics.resolved : reports.filter(r => r.status === 'resolved').length }
    ];
    return list.filter(opt => opt.value === 'all' || (typeof opt.count === 'number' && opt.count > 0));
  }, [reportMetrics, reports]);

  // Target Options for Reports in mobile: always keep all target options selectable regardless of active filter
  const mobileReportTargetOptions = useMemo<MobileSelectOption[]>(() => {
    return [
      { value: 'all', label: 'Semua Target', count: mobileReportTargetCounts.total },
      { value: 'item', label: 'Hanya Item', count: mobileReportTargetCounts.item > 0 ? mobileReportTargetCounts.item : undefined },
      { value: 'catalog', label: 'Katalog Merchant', count: mobileReportTargetCounts.catalog > 0 ? mobileReportTargetCounts.catalog : undefined }
    ];
  }, [mobileReportTargetCounts]);

  // Safety auto-resets for mobile compliance reports
  useEffect(() => {
    if (reportsFilter !== 'all' && mobileReportStatusOptions.length > 1) {
      if (!mobileReportStatusOptions.some(opt => opt.value === reportsFilter)) {
        setReportsFilter('all');
      }
    }
  }, [mobileReportStatusOptions, reportsFilter]);

  useEffect(() => {
    if (reportsTargetFilter !== 'all' && mobileReportTargetOptions.length > 1) {
      if (!mobileReportTargetOptions.some(opt => opt.value === reportsTargetFilter)) {
        setReportsTargetFilter('all');
      }
    }
  }, [mobileReportTargetOptions, reportsTargetFilter]);

  // Trigger Compliance Reports fetch on filter / debounced search changes
  useEffect(() => {
    if (!token || !canAccessCompliance) return;
    const timer = setTimeout(() => {
      fetchReportsList(1, reportsFilter, reportsTargetFilter, reportsSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [reportsFilter, reportsTargetFilter, reportsSearchQuery, token, canAccessCompliance]);

  const [financeSubTab, setFinanceSubTab] = useFinanceSection(activeView === 'finance', canManagePaymentSettings, canManageCoupons, canReadOrders);
  const orderPage = useFinancePage('orders', activeView === 'finance' && financeSubTab === 'orders' && canReadOrders, token);
  const couponPage = useFinancePage('coupons', activeView === 'finance' && financeSubTab === 'coupons' && canManageCoupons, token);
  const { data: orders, status: ordersFilter, setStatus: setOrdersFilter, input: ordersSearchQuery, setKeyword: setOrdersSearchQuery } = orderPage;
  const { data: coupons, loading: loadingCoupons, input: couponSearchFilter, setKeyword: setCouponSearchFilter, refresh: fetchCoupons } = couponPage;
  const [financeSummary, setFinanceSummary] = useState({ total: 0, pending: 0 });
  const orderPageProvidesTotals = activeView === 'finance' && financeSubTab === 'orders' && !orderPage.keyword;
  useEffect(() => {
    if (orderPageProvidesTotals && orderPage.ready) {
      const { total = 0, pending = 0 } = orderPage.summary;
      setFinanceSummary({ total, pending });
    }
  }, [orderPageProvidesTotals, orderPage.ready, orderPage.summary]);
  const [showAulaaSecrets, setShowAulaaSecrets] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [isUploadingQRISImage, setIsUploadingQRISImage] = useState(false);

  // Coupons State (Mobile Platform Admin)
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponDragY, setCouponDragY] = useState(0);
  const [isDraggingCoupon, setIsDraggingCoupon] = useState(false);
  const couponTouchStartYRef = useRef<number | null>(null);
  const couponDragYRef = useRef<number>(0);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [deletingCouponCode, setDeletingCouponCode] = useState<string | null>(null);
  const [togglingCouponCode, setTogglingCouponCode] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState<{
    code: string;
    label: string;
    type: 'discount' | 'free';
    discount: number;
    usage_limit: number;
    expires_at: string;
    is_active: boolean;
  }>({
    code: '',
    label: '',
    type: 'discount',
    discount: 50000,
    usage_limit: 0,
    expires_at: '',
    is_active: true
  });

  const [broadcastActiveCount, setBroadcastActiveCount] = useState<number>(0);
  const [broadcastSubViewState, setBroadcastSubViewState] = useState<string>('list');
  const [broadcastRefreshRev, setBroadcastRefreshRev] = useState<number>(0);

  const [automationRevision, setAutomationRevision] = useState(0);
  const [marketIntelRevision, setMarketIntelRevision] = useState(0);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditHasMore, setAuditHasMore] = useState<boolean>(false);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('all');
  const [auditSearchInput, setAuditSearchInput] = useState<string>('');
  const [debouncedAuditSearch, setDebouncedAuditSearch] = useState<string>('');
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [isLoadingMoreAudit, setIsLoadingMoreAudit] = useState<boolean>(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [showAuditDetailSheet, setShowAuditDetailSheet] = useState<boolean>(false);
  const [copiedAuditPayload, setCopiedAuditPayload] = useState<boolean>(false);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState<boolean>(false);
  const [auditVerifyReport, setAuditVerifyReport] = useState<AuditChainVerifyReport | null>(null);
  const [isExportingAudit, setIsExportingAudit] = useState<boolean>(false);

  // State: Google AdSense & Analytics Settings
  const [monetizationTab, setMonetizationTab] = useState<'adsense' | 'analytics'>('adsense');
  const [googleSettings, setGoogleSettings] = useState<Record<string, string>>({
    ads_enabled: '0',
    ads_client_id: '',
    ads_auto_enabled: '1',
    ads_slot_header: '',
    ads_slot_infeed: '',
    ads_slot_product_detail: '',
    ads_slot_bottom: '',
    ads_test_mode: '1',
    ads_txt_content: 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0',
    ga_enabled: '0',
    ga_measurement_id: '',
    rekber_enabled: '1',
    rekber_partner_name: 'Rekber Syariah',
    rekber_website_url: 'https://rekbersyariah.com',
    rekber_wa_number: '62811220227',
    rekber_logo_url: '',
    ...REKBER_FACTORY_DEFAULTS
  });
  const [rekberActiveTemplateTab, setRekberActiveTemplateTab] = useState<'physical' | 'food' | 'digital' | 'service' | 'plant' | 'fauna'>('physical');
  const [isUploadingRekberLogo, setIsUploadingRekberLogo] = useState(false);
  const rekberLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedAdsTxt, setCopiedAdsTxt] = useState(false);
  const savedQrisImageRef = useRef<string>('');

  // Selected item Modals & Bottom Sheets
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [ticketReplyAttachments, setTicketReplyAttachments] = useState<any[]>([]);
  const [isUploadingTicketAttachment, setIsUploadingTicketAttachment] = useState(false);
  // Support Ticket Attachment Preview & Direct Download States (Mobile Admin Pengelola)
  const [docPreview, setDocPreview] = useState<DocumentPreviewData | null>(null);

  const supportAttachmentSrc = (att: any): string => {
    if (!att) return '';
    if (att.blob_url || att.blobUrl) return att.blob_url || att.blobUrl;
    if (att.id) return `/api/support/attachments/${att.id}`;
    return att.file_url || '';
  };

  const openDocumentPreview = (att: any) => {
    if (!att) return;
    const isImage = (att.file_type && att.file_type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_name || '') ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_url || '');
    const isPdf = (att.file_type || '').includes('pdf') ||
      (att.file_name || '').toLowerCase().endsWith('.pdf') ||
      (att.file_url || '').toLowerCase().endsWith('.pdf');

    setDocPreview({
      isOpen: true,
      id: att.id,
      url: supportAttachmentSrc(att),
      blobUrl: att.blob_url || att.blobUrl,
      fileName: att.file_name || (isPdf ? 'Dokumen.pdf' : isImage ? 'Lampiran_Gambar.jpg' : 'Berkas_Lampiran'),
      fileSize: att.file_size,
      fileType: att.file_type || (isPdf ? 'application/pdf' : isImage ? 'image/jpeg' : 'application/octet-stream')
    });
  };

  const openAttachmentLightbox = (
    images?: any[],
    indexOrTarget: number | string | any = 0
  ) => {
    if (!images || images.length === 0) return;
    let selected: any = images[0];
    if (typeof indexOrTarget === 'number') {
      selected = images[indexOrTarget] || images[0];
    } else if (typeof indexOrTarget === 'string') {
      selected = images.find(img => img.file_url === indexOrTarget || String(img.id) === indexOrTarget) || images[0];
    } else if (indexOrTarget && typeof indexOrTarget === 'object') {
      selected = images.find(img => (indexOrTarget.id && img.id === indexOrTarget.id) || (indexOrTarget.file_url && img.file_url === indexOrTarget.file_url)) || indexOrTarget;
    }
    openDocumentPreview(selected);
  };

  const handleDownloadDocument = async (att: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!att) return;
    const isImage = (att.file_type && att.file_type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_name || '') ||
      /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_url || '');
    const fileName = att.file_name || (isImage ? 'Lampiran_Gambar.jpg' : 'Dokumen.pdf');
    const authToken = token || localStorage.getItem('catavor_token') || '';

    try {
      const targetUrl = att.id ? `/api/support/attachments/${att.id}?download=1` : (att.file_url || supportAttachmentSrc(att));
      const res = await fetch(targetUrl, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
      }
    } catch (err) {
      console.warn('Direct download blob error, falling back:', err);
    }

    const link = document.createElement('a');
    link.href = att.id ? `/api/support/attachments/${att.id}?download=1` : (att.file_url || supportAttachmentSrc(att) || '#');
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [selectedProofOrder, setSelectedProofOrder] = useState<any | null>(null);
  const [syncingOrderId, setSyncingOrderId] = useState<number | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<any | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('Dana belum masuk ke mutasi rekening / QRIS platform');

  // Deteksi status seluruh overlay/modal aktif (baik global modal stack maupun modal lokal)
  const isGlobalModalOpen = useIsAnyModalOpen();
  const isAnyOverlayActive = isGlobalModalOpen ||
    Boolean(moderationModalReport) ||
    Boolean(showModerationConfirmModal) ||
    Boolean(showTemplateModal) ||
    Boolean(showTemplateFormModal) ||
    Boolean(showFooterStatusMenu) ||
    Boolean(showOptionsMenu) ||
    Boolean(activeFilterModal) ||
    Boolean(docPreview?.isOpen) ||
    Boolean(selectedProofOrder) ||
    Boolean(rejectingOrder);

  // Swipe & Drag Bottom Sheet State for Proof Order Modal
  const [proofSheetDragY, setProofSheetDragY] = useState(0);
  const [isProofSheetDragging, setIsProofSheetDragging] = useState(false);
  const proofDragStartY = useRef(0);

  const handleProofSheetDragStart = (clientY: number) => {
    proofDragStartY.current = clientY;
    setIsProofSheetDragging(true);
  };

  const handleProofSheetDragMove = (clientY: number) => {
    if (!isProofSheetDragging) return;
    const delta = clientY - proofDragStartY.current;
    if (delta > 0) {
      setProofSheetDragY(delta);
    } else {
      setProofSheetDragY(delta * 0.18);
    }
  };

  const handleProofSheetDragEnd = () => {
    if (!isProofSheetDragging) return;
    setIsProofSheetDragging(false);
    if (proofSheetDragY > 75) {
      setSelectedProofOrder(null);
    }
    setProofSheetDragY(0);
  };

  useEffect(() => {
    if (!selectedProofOrder) {
      setProofSheetDragY(0);
      setIsProofSheetDragging(false);
    }
  }, [selectedProofOrder]);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const mobileTicketTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize and reset textarea height when message is typed or sent/cleared
  useEffect(() => {
    if (mobileTicketTextareaRef.current) {
      if (!replyText) {
        mobileTicketTextareaRef.current.style.height = 'auto';
      } else {
        mobileTicketTextareaRef.current.style.height = 'auto';
        mobileTicketTextareaRef.current.style.height = `${Math.min(mobileTicketTextareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [replyText]);

  // Agent Collision Detection Presence (Fase 5)
  const [activePresences, setActivePresences] = useState<any[]>([]);
  const isTypingDebounceTimerRef = useRef<any>(null);
  const prevTypingSentRef = useRef<boolean>(false);

  // Send periodic presence heartbeat (12s interval < 35s Redis TTL, respects document.visibilityState)
  useEffect(() => {
    if (!selectedTicket || !token || !canAccessSupport) {
      setActivePresences([]);
      prevTypingSentRef.current = false;
      return;
    }

    const sendPresence = async (isTyping = false) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await fetch(`/api/admin/support/tickets/${selectedTicket.id}/presence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ is_typing: isTyping })
        });
      } catch (err) {
        // Ignore network hiccups
      }
    };

    const fetchPresence = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/presence`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setActivePresences(json.data);
          }
        }
      } catch (err) {
        // Ignore network hiccups
      }
    };

    sendPresence(false);
    fetchPresence();
    const interval = setInterval(() => {
      sendPresence(false);
      fetchPresence();
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendPresence(false);
        fetchPresence();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedTicket?.id, token, canAccessSupport]);

  // Debounced Typing Indicator: sends both true when typing and false when cleared
  useEffect(() => {
    if (!selectedTicket?.id || !token || !canAccessSupport) return;
    if (isTypingDebounceTimerRef.current) {
      clearTimeout(isTypingDebounceTimerRef.current);
    }
    const isTyping = replyText.trim().length > 0;
    if (!isTyping && !prevTypingSentRef.current) return;

    const delay = isTyping ? 900 : 400;
    isTypingDebounceTimerRef.current = setTimeout(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await fetch(`/api/admin/support/tickets/${selectedTicket.id}/presence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ is_typing: isTyping })
        });
        prevTypingSentRef.current = isTyping;
      } catch { }
    }, delay);

    return () => {
      if (isTypingDebounceTimerRef.current) {
        clearTimeout(isTypingDebounceTimerRef.current);
      }
    };
  }, [replyText, selectedTicket?.id, token, canAccessSupport]);

  // Global Luxury Mobile Bottom Sheet Dropdown Picker for Form Controls
  const [crudDropdownPicker, setCrudDropdownPicker] = useState<{
    title: string;
    subtitle?: string;
    icon?: any;
    selectedValue: any;
    options: Array<{
      value: any;
      label: string;
      desc?: string;
      badge?: string;
      badgeColor?: string;
      icon?: any;
      isAction?: boolean;
    }>;
    onSelect: (val: any) => void;
  } | null>(null);

  const [dropdownDragY, setDropdownDragY] = useState(0);
  const [isDropdownDragging, setIsDropdownDragging] = useState(false);
  const dropdownDragStartY = useRef(0);

  const handleDropdownDragStart = (clientY: number) => {
    dropdownDragStartY.current = clientY;
    setIsDropdownDragging(true);
  };

  const handleDropdownDragMove = (clientY: number) => {
    if (!isDropdownDragging) return;
    const delta = clientY - dropdownDragStartY.current;
    if (delta > 0) {
      setDropdownDragY(delta);
    } else {
      setDropdownDragY(delta * 0.18);
    }
  };

  const handleDropdownDragEnd = () => {
    if (!isDropdownDragging) return;
    setIsDropdownDragging(false);
    if (dropdownDragY > 75) {
      setCrudDropdownPicker(null);
    }
    setDropdownDragY(0);
  };

  useEffect(() => {
    if (!crudDropdownPicker) {
      setDropdownDragY(0);
      setIsDropdownDragging(false);
    }
  }, [crudDropdownPicker]);

  useModalBackHandler({
    isOpen: Boolean(crudDropdownPicker),
    onClose: () => setCrudDropdownPicker(null),
    modalId: 'mobile_crud_dropdown_picker',
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text: compactToastMessage(text), type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyAdsTxt = () => {
    if (googleSettings.ads_txt_content) {
      navigator.clipboard.writeText(googleSettings.ads_txt_content);
      setCopiedAdsTxt(true);
      showToast('Baris ads.txt disalin ke clipboard', 'info');
      setTimeout(() => setCopiedAdsTxt(false), 2000);
    }
  };

  // 300ms Debounced Ticket Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTicketSearch(ticketSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [ticketSearchQuery]);

  // Unread & Incoming Chat Audio/Notification Management for Mobile
  const readTicketIdsRef = useRef<Set<string | number>>(new Set());
  const prevTicketMessagesRef = useRef<Record<string, number>>({});
  const isFirstTicketLoadRef = useRef<boolean>(true);
  const [isChimeMuted, setIsChimeMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('catavor_admin_chime_muted') === 'true';
    } catch {
      return false;
    }
  });

  const playSupportChime = () => {
    if (isChimeMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch { }
  };

  const sendSupportNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/favicon.ico' });
        } catch { }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, { body, icon: '/favicon.ico' });
            } catch { }
          }
        }).catch(() => { });
      }
    }
  };

  // Dedicated Server-Side Support Tickets Fetcher
  const fetchTickets = async (pageToFetch = 1, append = false) => {
    if (!token || !canAccessSupport) return;
    if (append) {
      setTicketsLoadingMore(true);
    } else {
      setTicketsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageToFetch));
      params.set('limit', '20');
      if (ticketsFilter !== 'all' && ticketsFilter !== 'unread') params.set('status', ticketsFilter);
      if (ticketCategoryFilter !== 'all') params.set('category', ticketCategoryFilter);
      if (ticketPriorityFilter !== 'all') params.set('priority', ticketPriorityFilter);
      if (ticketSlaFilter === 'breached') params.set('sla_breached', 'true');
      if (ticketAssignedFilter !== 'all') params.set('assigned', ticketAssignedFilter);
      if (ticketsFilter === 'resolved' && resolvedTimeRangeFilter !== 'all') {
        params.set('time_range', resolvedTimeRangeFilter);
      }
      if (debouncedTicketSearch.trim()) {
        params.set('q', debouncedTicketSearch.trim());
      }

      const res = await fetch(`/api/admin/support/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json.data || json.tickets || []);

        const mappedData = data.map((t: any) => {
          const msgs = Array.isArray(t.messages) ? t.messages : [];
          const isViewed = readTicketIdsRef.current.has(t.id) || readTicketIdsRef.current.has(String(t.id)) || (selectedTicket && selectedTicket.id === t.id);
          const unreadMsgs = msgs.filter((m: any) => m.sender_type === 'user' && !m.read_at);
          const unreadCount = isViewed ? 0 : unreadMsgs.length;
          const hasUnread = isViewed ? false : (unreadCount > 0 || t.status === 'open' || t.status === 'waiting_agent');
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

          return {
            ...t,
            unread_count: unreadCount,
            has_unread: hasUnread,
            last_msg: lastMsg
          };
        });

        // Deteksi chat balasan baru dari merchant untuk memicu chime & desktop push
        if (!isFirstTicketLoadRef.current) {
          let hasNewIncoming = false;
          let incomingSender = '';
          let incomingTicketNum = '';
          let incomingSnippet = '';
          let totalNewIncoming = 0;

          mappedData.forEach((t: any) => {
            const prevCount = prevTicketMessagesRef.current[String(t.id)] || 0;
            const curCount = Array.isArray(t.messages) ? t.messages.length : 0;
            if (curCount > prevCount && prevCount > 0) {
              const msgs = Array.isArray(t.messages) ? t.messages : [];
              const newMsgs = msgs.slice(prevCount);
              const userMsgs = newMsgs.filter((m: any) => m.sender_type === 'user');
              if (userMsgs.length > 0) {
                hasNewIncoming = true;
                totalNewIncoming += userMsgs.length;
                const lastMsg = userMsgs[userMsgs.length - 1];
                incomingSender = getMerchantDisplayName(t, lastMsg.sender);
                incomingTicketNum = t.ticket_number || `#TCK-${t.id}`;
                incomingSnippet = lastMsg.message ? (lastMsg.message.length > 50 ? lastMsg.message.substring(0, 50) + '...' : lastMsg.message) : '';
              }
            }
          });

          if (hasNewIncoming) {
            playSupportChime();
            const incomingTitle = totalNewIncoming === 1 ? '1 pesan masuk' : `${totalNewIncoming} pesan masuk`;
            sendSupportNotification(
              `${incomingTitle}: ${incomingTicketNum}`,
              `${incomingSender}: ${incomingSnippet}`
            );
          }
        }

        const counts: Record<string, number> = {};
        mappedData.forEach((t: any) => {
          counts[String(t.id)] = Array.isArray(t.messages) ? t.messages.length : 0;
        });
        prevTicketMessagesRef.current = counts;
        isFirstTicketLoadRef.current = false;

        // Auto-update status dan metadata tiket yang sedang aktif (TIDAK menimpa daftar pesan penuh dengan cuplikan list)
        if (selectedTicket) {
          const activeUpdated = mappedData.find((t: any) => t.id === selectedTicket.id || String(t.id) === String(selectedTicket.id));
          if (activeUpdated) {
            setSelectedTicket((prev: any) => {
              if (!prev) return null;
              return {
                ...prev,
                status: activeUpdated.status || prev.status,
                priority: activeUpdated.priority || prev.priority,
                first_response_at: activeUpdated.first_response_at || prev.first_response_at,
                sla_breached: activeUpdated.sla_breached !== undefined ? activeUpdated.sla_breached : prev.sla_breached,
                rating: activeUpdated.rating !== undefined ? activeUpdated.rating : prev.rating,
                rating_comment: activeUpdated.rating_comment !== undefined ? activeUpdated.rating_comment : prev.rating_comment,
                rated_at: activeUpdated.rated_at || prev.rated_at,
              };
            });
          }
        }

        if (append) {
          setTickets(prev => [...prev, ...mappedData]);
        } else {
          setTickets(mappedData);
        }
        if (json.metrics) {
          setTicketsMetrics(json.metrics);
        }
        if (json.pagination) {
          setTicketsPagination(json.pagination);
        }
      }
    } catch (e) {
      console.error('Error fetching support tickets:', e);
    } finally {
      setTicketsLoading(false);
      setTicketsLoadingMore(false);
    }
  };

  const handleLoadMoreTickets = () => {
    if (ticketsLoadingMore || !ticketsPagination.has_more) return;
    fetchTickets(ticketsPagination.page + 1, true);
  };

  // Re-fetch tickets server-side whenever active filters or debounced search query change (HANYA saat tab support aktif)
  useEffect(() => {
    if (canAccessSupport && token && activeView === 'support') {
      fetchTickets(1, false);
    }
  }, [token, canAccessSupport, activeView, ticketsFilter, ticketCategoryFilter, ticketPriorityFilter, ticketSlaFilter, ticketAssignedFilter, resolvedTimeRangeFilter, debouncedTicketSearch]);

  // Polling santai fallback (45 detik saat aktif, data utama di-push secara instan via SSE)
  useEffect(() => {
    if (!token || !canAccessSupport || activeView !== 'support') return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchTickets(1, false);
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && activeView === 'support') {
        fetchTickets(1, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, canAccessSupport, activeView, ticketsFilter, ticketCategoryFilter, ticketPriorityFilter, ticketSlaFilter, ticketAssignedFilter, resolvedTimeRangeFilter, debouncedTicketSearch]);

  const selectedTicketRef = useRef<any>(selectedTicket);
  const activeViewRef = useRef<string>(activeView);
  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  // Real-Time Global SSE Stream Subscription (stable across ticket/tab switches)
  useEffect(() => {
    if (!token || (!isSuperAdmin && !canAccessSupport)) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isUnmounted = false;

    const connectSSE = async () => {
      if (isUnmounted) return;
      try {
        // SECURITY (M1/SSE): jangan taruh JWT di URL — tukar sesi cookie
        // dengan tiket sekali pakai (30 detik) sebelum membuka stream.
        const tkRes = await fetch('/api/notifications/ticket', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (tkRes.status === 401) {
          console.warn('SSE: sesi tidak valid, tiket tidak diterbitkan');
          return;
        }
        if (!tkRes.ok) throw new Error(`ticket ${tkRes.status}`);
        const tkJson = await tkRes.json();
        const streamTicket = String((tkJson && (tkJson.ticket || (tkJson.data && tkJson.data.ticket))) || '');
        if (!streamTicket) throw new Error('tiket kosong');
        if (isUnmounted) return;

        const streamUrl = `/api/notifications/stream?ticket=${encodeURIComponent(streamTicket)}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (e) => {
          if (!e.data || e.data.trim() === '' || e.data.startsWith(':')) return;
          try {
            const payload = JSON.parse(e.data);
            const { event, ticket, notification } = payload;
            const currentSelected = selectedTicketRef.current;

            if (event === 'ticket_created' && ticket) {
              playSupportChime();
              const ticketNum = ticket.ticket_number || `#TCK-${ticket.id}`;
              const merchantName = ticket.store?.store_title || ticket.user?.name || ticket.store?.name || 'Merchant';
              sendSupportNotification(
                `Tiket Bantuan Baru: ${ticketNum}`,
                `${merchantName}: ${ticket.subject || 'Kendala baru memerlukan tindakan CS'}`
              );

              setTicketsMetrics((prev: any) => ({
                ...prev,
                total: (prev.total || 0) + 1,
                action_required: (prev.action_required || 0) + 1,
                urgent: (ticket.priority === 'urgent' || ticket.priority === 'high') ? (prev.urgent || 0) + 1 : prev.urgent
              }));

              fetchTickets(1, false);
            } else if (event === 'ticket_reply_from_user' && ticket) {
              playSupportChime();
              const ticketNum = ticket.ticket_number || `#TCK-${ticket.ticket_id}`;
              const sender = ticket.sender_name || 'Merchant';
              const snippet = ticket.message?.message || '';
              sendSupportNotification(
                `Balasan Baru: ${ticketNum}`,
                `${sender}: ${snippet}`
              );

              setTicketsMetrics((prev: any) => ({
                ...prev,
                action_required: (prev.action_required || 0) + 1
              }));

              fetchTickets(1, false);
              if (currentSelected && (currentSelected.id === ticket.ticket_id || currentSelected.ticket_number === ticket.ticket_number)) {
                handleOpenTicketChat({ id: currentSelected.id, ticket_number: currentSelected.ticket_number }, false);
              }
            } else if ((event === 'ticket_status_updated' || event === 'ticket_internal_note_added') && ticket) {
              fetchTickets(1, false);
              if (currentSelected && (currentSelected.id === ticket.ticket_id || currentSelected.id === ticket.id || currentSelected.ticket_number === ticket.ticket_number)) {
                handleOpenTicketChat({ id: currentSelected.id, ticket_number: currentSelected.ticket_number }, false);
              }
            } else if (event === 'ticket_status_updated') {
              fetchTickets(1, false);
            } else if (event === 'notification' && notification) {
              if (notification.type === 'ticket' || notification.link_sub_tab === 'support') {
                playSupportChime();
                sendSupportNotification(notification.title, notification.message);
                fetchTickets(1, false);
              }
            }
          } catch (err) {
            // Non-JSON frame ignored
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connectSSE, 6000);
          }
        };
      } catch (err) {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 8000);
        }
      }
    };

    connectSSE();

    return () => {
      isUnmounted = true;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [token, isSuperAdmin, canAccessSupport]);

  const loadData = async (refreshLists = true) => {
    if (!token) return;
    setLoading(true);
    try {
      if (canAccessCompliance) {
        fetchReportsList(1);
        const dormRes = await fetch('/api/admin/dormancy/metrics', { headers: { Authorization: `Bearer ${token}` } });
        if (dormRes.ok) {
          const dormData = await dormRes.json();
          setDormancyMetrics(dormData?.data || dormData || null);
        }
      }
      if (canAccessSupport) {
        fetchTickets(1, false);
      }
      if (canAccessFinance) {
        if (refreshLists && activeView === 'finance') {
          if (financeSubTab === 'orders' && canReadOrders) orderPage.refresh();
          if (financeSubTab === 'coupons' && canManageCoupons) couponPage.refresh();
        }
        if (canReadOrders && !orderPageProvidesTotals) {
          const res = await fetch('/api/admin/subscription/orders?summary=1', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            if (data.summary) setFinanceSummary(data.summary);
          }
        }
      }
      // Daftar siaran TIDAK diambil di sini. Sebelumnya blok ini memanggil
      // /api/admin/notifications tanpa parameter (server memberi default 15
      // baris) lalu menimpanya ke `broadcasts` — state yang juga diisi halaman
      // siaran dengan parameter page/limit/status/q. Dua penulis pada satu
      // state membuat siaran yang sedang difilter bisa tertimpa daftar tanpa
      // filter, dan server menerima dua request ke endpoint yang sama.
      //
      // Preload itu tidak menyuapi satu pun label yang tampil: satu-satunya
      // pemakai `${broadcasts.length}` adalah `allModules`, yang hanya dirujuk
      // di blok header ber-`&& false` (dead code), sedangkan kartu dashboard
      // siaran memakai subtitle statis 'Notifikasi Massal Pengguna'. Halaman
      // siaran sudah mengambil daftarnya sendiri saat activeView === 'broadcast'.
      if (canAccessSettingsRead) {
        const setRes = await fetch('/api/admin/settings?exclude=master_coupons', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (setRes.ok) {
          const setData = await setRes.json();
          if (setData.data) {
            const d = setData.data;
            savedQrisImageRef.current = (d.payment_qris_manual_image || '').trim();
            const stripIcons = (s?: string) => (s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/^[ \t]+/gm, '');
            setGoogleSettings(prev => ({
              ...prev,
              ...d,
              rekber_template_physical: stripIcons(d.rekber_template_physical || d.rekber_template_general) || REKBER_FACTORY_DEFAULTS.rekber_template_physical,
              rekber_template_general: stripIcons(d.rekber_template_general || d.rekber_template_physical) || REKBER_FACTORY_DEFAULTS.rekber_template_general,
              rekber_template_food: stripIcons(d.rekber_template_food) || REKBER_FACTORY_DEFAULTS.rekber_template_food,
              rekber_template_digital: stripIcons(d.rekber_template_digital) || REKBER_FACTORY_DEFAULTS.rekber_template_digital,
              rekber_template_service: stripIcons(d.rekber_template_service) || REKBER_FACTORY_DEFAULTS.rekber_template_service,
              rekber_template_plant: stripIcons(d.rekber_template_plant) || REKBER_FACTORY_DEFAULTS.rekber_template_plant,
              rekber_template_fauna: stripIcons(d.rekber_template_fauna) || REKBER_FACTORY_DEFAULTS.rekber_template_fauna,
            }));
          }
        }
      }
    } catch {
      showToast('Gagal memuat sebagian data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input for Audit Trail (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAuditSearch(auditSearchInput.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [auditSearchInput]);

  // Server-side Fetch Audit Logs with progressive load-more support
  const fetchAuditLogs = useCallback(async (pageToFetch: number = 1, append: boolean = false) => {
    if (!token || !canAccessAudit) return;
    if (append) {
      setIsLoadingMoreAudit(true);
    } else {
      setIsLoadingAudit(true);
    }
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: '15',
      });
      if (auditCategoryFilter !== 'all') params.set('category', auditCategoryFilter);
      if (auditRoleFilter !== 'all') params.set('role', auditRoleFilter);
      if (debouncedAuditSearch) params.set('q', debouncedAuditSearch);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        const dataList = Array.isArray(j.data) ? j.data : [];
        if (append) {
          setAuditLogs(prev => {
            const existingIds = new Set(prev.map(item => item.id || item.created_at));
            const newItems = dataList.filter((item: any) => !existingIds.has(item.id || item.created_at));
            return [...prev, ...newItems];
          });
        } else {
          setAuditLogs(dataList);
        }
        setAuditPage(pageToFetch);
        setAuditTotal(typeof j.total === 'number' ? j.total : dataList.length);
        setAuditHasMore(Boolean(j.has_more));
      } else {
        showToast('Gagal memuat log audit sistem', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat memuat log audit', 'error');
    } finally {
      setIsLoadingAudit(false);
      setIsLoadingMoreAudit(false);
    }
  }, [token, canAccessAudit, auditCategoryFilter, auditRoleFilter, debouncedAuditSearch]);

  // Lazy-load audit logs only when activeView === 'audit' or query filters change
  useEffect(() => {
    if (activeView === 'audit' && canAccessAudit) {
      fetchAuditLogs(1, false);
    }
  }, [activeView, canAccessAudit, auditCategoryFilter, auditRoleFilter, debouncedAuditSearch, fetchAuditLogs]);

  useModalBackHandler({
    isOpen: showAuditDetailSheet,
    onClose: () => setShowAuditDetailSheet(false),
    modalId: 'mobile_audit_detail'
  });

  useModalBackHandler({
    isOpen: showCouponModal,
    onClose: () => setShowCouponModal(false),
    modalId: 'mobile_coupon_modal'
  });

  useEffect(() => {
    loadData(false);
  }, [token, activeView]);

  // Synchronize URL on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      try {
        if ((window as unknown as { __catavor_is_modal_popping?: boolean }).__catavor_is_modal_popping) return;
        if ((window as unknown as { __catavor_broadcast_dirty_guard?: (cb?: () => void) => boolean }).__catavor_broadcast_dirty_guard?.()) {
          return;
        }
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = (searchParams.get('tab') || searchParams.get('view') || searchParams.get('division') || '').toLowerCase();
        const ticketParam = searchParams.get('ticket') || searchParams.get('ticket_id');
        const subtabParam = (searchParams.get('subtab') || searchParams.get('subview') || searchParams.get('action') || '').toLowerCase();
        const broadcastId = searchParams.get('broadcast_id') || searchParams.get('broadcast') || searchParams.get('notif_id');

        if (ticketParam) {
          setActiveView('support');
        } else if (broadcastId) {
          setActiveView('broadcast');
        } else if (tabParam) {
          if (['dashboard', 'overview', 'home'].includes(tabParam)) {
            setActiveView('dashboard');
          } else if (['rbac', 'staff', 'roles', 'users'].includes(tabParam)) {
            setActiveView('rbac');
          } else if (['stores', 'merchants', 'toko'].includes(tabParam)) {
            setActiveView('stores');
          } else if (['reports', 'compliance', 'laporan'].includes(tabParam)) {
            setActiveView('reports');
          } else if (['support', 'help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) {
            setActiveView('support');
          } else if (['finance', 'keuangan', 'billing', 'orders'].includes(tabParam)) {
            setActiveView('finance');
          } else if (['monetization', 'iklan', 'ads', 'google'].includes(tabParam)) {
            setActiveView('monetization');
          } else if (['broadcast', 'siaran', 'notifikasi'].includes(tabParam)) {
            setActiveView('broadcast');
          } else if (['automation', 'bot', 'bots', 'otomatisasi', 'cron', 'engine', 'workers'].includes(tabParam)) {
            setActiveView('automation');
          } else if (['policies', 'policy', 'kebijakan', 'legal', 'settings', 'setting', 'terms', 'aturan'].includes(tabParam)) {
            setActiveView('policies');
          } else if (['master_data', 'master-data', 'domains', 'safe_domains', 'whitelist', 'domain', 'master', 'masters', 'templates', 'canned'].includes(tabParam)) {
            setActiveView('master_data');
          } else if (['audit', 'logs', 'activity', 'jejak'].includes(tabParam)) {
            setActiveView('audit');
          } else if (['market_intel', 'market-intel', 'intel', 'intelligence', 'riset', 'riset-pasar', 'b2b'].includes(tabParam)) {
            setActiveView('market_intel');
          }
        }

        if (['policies', 'policy', 'kebijakan', 'legal'].includes(subtabParam)) {
          setMasterSubView('policies');
        } else if (['templates', 'template', 'canned'].includes(subtabParam)) {
          setMasterSubView('templates');
        } else if (['domains', 'safe_domains', 'whitelist'].includes(subtabParam) || tabParam === 'safe_domains') {
          setMasterSubView('domains');
        } else if (['rekber', 'rekbersyariah', 'escrow'].includes(subtabParam)) {
          setMasterSubView('rekber');
        } else if (['contact', 'kontak', 'support_contact'].includes(subtabParam)) {
          setMasterSubView('contact');
        } else if (tabParam === 'master_data') {
          setMasterSubView('menu');
        }

        if (['create', 'new', 'tambah', 'buat'].includes(subtabParam)) {
          setBroadcastSubViewState('create');
        } else if (broadcastId || subtabParam === 'detail') {
          setBroadcastSubViewState('detail');
        } else {
          setBroadcastSubViewState('list');
        }

        if (!ticketParam) {
          setSelectedTicket(null);
        }

        const reportParam = searchParams.get('report_id') || searchParams.get('report');
        if (reportParam) {
          setActiveView('reports');
          const found = reports.find(r => r.report_number === reportParam || String(r.id) === String(reportParam));
          if (found) {
            handleOpenModerationPage(found, false);
          } else if (token && canAccessCompliance) {
            fetch(`/api/admin/reports/${reportParam}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
              .then(res => res.json())
              .then(d => {
                if (d.success && d.data) {
                  handleOpenModerationPage(d.data, false);
                }
              })
              .catch(() => { });
          }
        } else if (!ticketParam && !broadcastId && activeView === 'reports') {
          setModerationModalReport(null);
        }
      } catch (err) {
        console.error('Error handling mobile popstate:', err);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, canAccessBroadcast, reports, activeView]);

  // Deep-link direct report moderation page synchronization
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reportParam = urlParams.get('report_id') || urlParams.get('report');
    const tabParam = (urlParams.get('tab') || urlParams.get('view') || '').toLowerCase();

    if (reportParam || tabParam === 'reports' || ['compliance', 'laporan'].includes(tabParam)) {
      if (reportParam) {
        if (reports.length > 0) {
          const found = reports.find(r => r.report_number === reportParam || String(r.id) === String(reportParam));
          if (found && (!moderationModalReport || (moderationModalReport.report_number !== reportParam && String(moderationModalReport.id) !== String(reportParam)))) {
            handleOpenModerationPage(found, false);
          }
        } else if (token && canAccessCompliance) {
          fetch(`/api/admin/reports/${reportParam}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(d => {
              if (d.success && d.data) {
                handleOpenModerationPage(d.data, false);
              }
            })
            .catch(() => { });
        }
      }
    }
  }, [reports, token, canAccessCompliance]);

  // Deep-link direct ticket chat & broadcast detail synchronization
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = (urlParams.get('tab') || urlParams.get('view') || '').toLowerCase();
    const ticketParam = urlParams.get('ticket') || urlParams.get('ticket_id');
    const subtabParam = (urlParams.get('subtab') || urlParams.get('subview') || urlParams.get('action') || '').toLowerCase();
    const broadcastId = urlParams.get('broadcast_id') || urlParams.get('broadcast') || urlParams.get('notif_id');

    if (ticketParam) {
      if (activeView !== 'support') setActiveView('support');
    } else if (broadcastId || tabParam === 'broadcast' || ['siaran', 'notifikasi'].includes(tabParam)) {
      if (activeView !== 'broadcast') setActiveView('broadcast');
      if (['create', 'new', 'tambah', 'buat'].includes(subtabParam)) {
        setBroadcastSubViewState('create');
      } else if (broadcastId || subtabParam === 'detail') {
        setBroadcastSubViewState('detail');
      } else {
        setBroadcastSubViewState('list');
      }
    }

    if (ticketParam && !selectedTicket && canAccessSupport && token) {
      const existingInList = tickets.find(t => t.ticket_number === ticketParam || String(t.id) === String(ticketParam));
      if (existingInList) {
        handleOpenTicketChat(existingInList, false);
      } else {
        fetch(`/api/admin/support/tickets/${ticketParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(d => {
            if (d.success && d.data) {
              const ticketObj = d.data.ticket || d.data;
              const messagesList = d.data.messages || ticketObj.messages || [];
              setSelectedTicket({
                ...ticketObj,
                unread_count: 0,
                has_unread: false,
                messages: messagesList
              });
            }
          })
          .catch(() => { });
      }
    }
  }, [tickets, token, canAccessBroadcast, canAccessSupport]);

  // Open ticket and fetch full conversation stream with URL state update
  const handleOpenTicketChat = async (ticket: any, pushToHistory = true) => {
    const rawId = ticket.id || ticket.ticket_number || ticket.ticket?.id;
    readTicketIdsRef.current.add(ticket.id);
    readTicketIdsRef.current.add(String(ticket.id));
    if (ticket.ticket_number) {
      readTicketIdsRef.current.add(ticket.ticket_number);
    }

    // Hapus tanda unread secara instan di state UI lokal
    setTickets(prev => prev.map(t => (t.id === ticket.id || String(t.id) === String(ticket.id) || t.ticket_number === ticket.ticket_number) ? { ...t, unread_count: 0, has_unread: false } : t));

    setSelectedTicket({ ...ticket, unread_count: 0, has_unread: false });
    setTicketDetailsLoading(true);
    setReplyText('');
    setTicketReplyAttachments([]);
    setIsInternalNote(false);

    if (pushToHistory) {
      const ticketRef = ticket.ticket_number || ticket.id;
      updatePlatformUrl('support', ticketRef);
    }

    try {
      const res = await fetch(`/api/admin/support/tickets/${rawId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.data) {
          const ticketObj = d.data.ticket || d.data;
          const messagesList = d.data.messages || ticketObj.messages || [];
          setSelectedTicket({
            ...ticketObj,
            unread_count: 0,
            has_unread: false,
            messages: messagesList
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTicketDetailsLoading(false);
    }
  };

  // Support Reply Action (Supports Public Reply or Internal Note)
  const handleAdminReply = async (shouldResolve = false) => {
    const targetTicketId = selectedTicket?.id || selectedTicket?.ticket?.id || selectedTicket?.ticket_number;
    if (!targetTicketId || (!replyText.trim() && ticketReplyAttachments.length === 0)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${targetTicketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: replyText.trim(),
          is_internal_note: isInternalNote,
          attachments: ticketReplyAttachments
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const createdMsg = data.data;
        setReplyText('');
        setTicketReplyAttachments([]);
        setIsInternalNote(false);
        showToast(isInternalNote ? 'Catatan internal CS berhasil disimpan' : 'Balasan berhasil dikirim ke merchant', 'success');

        if (createdMsg) {
          setSelectedTicket((prev: any) => {
            if (!prev) return null;
            const currentMsgs = prev.messages || [];
            const exists = currentMsgs.some((m: any) => m.id === createdMsg.id);
            const newMsgs = exists ? currentMsgs : [...currentMsgs, createdMsg];
            return {
              ...prev,
              status: isInternalNote ? prev.status : (prev.status === 'resolved' || prev.status === 'closed' ? prev.status : 'waiting_user'),
              messages: newMsgs
            };
          });
        }

        if (shouldResolve) {
          await handleUpdateTicketStatus(targetTicketId, 'resolved');
        }
        // Perbarui ringkasan antrean tiket tanpa mereset riwayat chat aktif
        fetchTickets(1, false);
      } else {
        showToast(data.message || 'Gagal mengirim balasan', 'error');
      }
    } catch {
      showToast('Koneksi terputus saat mengirim balasan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Upload Screenshot / Attachment for Support Chat
  const handleUploadTicketAttachment = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingTicketAttachment(true);
    try {
      const uploaded: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          showToast(`File ${file.name} melebihi batas 10MB.`, 'error');
          continue;
        }
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', 'support');
        const res = await fetch('/api/admin/support/upload?category=support', {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const lowerName = (file.name || '').toLowerCase();
          let detectedType = file.type || '';
          if (!detectedType) {
            if (lowerName.endsWith('.pdf')) detectedType = 'application/pdf';
            else if (lowerName.endsWith('.png')) detectedType = 'image/png';
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) detectedType = 'image/jpeg';
            else if (lowerName.endsWith('.webp')) detectedType = 'image/webp';
            else if (lowerName.endsWith('.gif')) detectedType = 'image/gif';
            else detectedType = 'application/octet-stream';
          }
          const localBlobUrl = URL.createObjectURL(file);
          uploaded.push({
            file_url: data.file_url || data.url || localBlobUrl,
            storage_key: data.key || data.storage_key || '',
            file_name: file.name,
            file_size: file.size,
            file_type: detectedType,
            blob_url: localBlobUrl
          });
        } else {
          showToast(data.message || `Gagal mengunggah ${file.name}`, 'error');
        }
      }
      if (uploaded.length > 0) {
        setTicketReplyAttachments(prev => [...prev, ...uploaded]);
        showToast(`${uploaded.length} gambar/screenshot terlampir!`, 'info');
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal mengunggah lampiran', 'error');
    } finally {
      setIsUploadingTicketAttachment(false);
    }
  };

  // Ticket Ownership Claim / Release
  const handleAssignTicket = async (
    ticketId: number | string,
    payload: { self?: boolean; assigned_agent_id?: number | null }
  ) => {
    setAssigningTicketId(Number(ticketId));
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        showToast(json.message || 'Penugasan tiket berhasil diperbarui.', 'success');
        setTickets((prev) =>
          prev.map((t) =>
            String(t.id) === String(ticketId)
              ? { ...t, assigned_agent_id: json.data.assigned_agent_id, assigned_agent: json.data.assigned_agent }
              : t
          )
        );
        if (selectedTicket && String(selectedTicket.id) === String(ticketId)) {
          setSelectedTicket((prev: any) =>
            prev
              ? { ...prev, assigned_agent_id: json.data.assigned_agent_id, assigned_agent: json.data.assigned_agent }
              : prev
          );
        }
        fetchTickets(ticketsPagination.page || 1, false);
      } else {
        showToast(json?.message || 'Gagal memperbarui penugasan tiket.', 'error');
      }
    } catch {
      showToast('Koneksi gagal saat memperbarui penugasan tiket.', 'error');
    } finally {
      setAssigningTicketId(null);
    }
  };

  // Support Status Update (Open, In Progress, Waiting User, Resolved, Closed)
  const handleUpdateTicketStatus = async (ticketId: number | string, status: string) => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const statusLabel =
          status === 'open' ? 'OPEN' :
            status === 'in_progress' ? 'SEDANG DIPROSES' :
              status === 'waiting_user' ? 'MENUNGGU MERCHANT' :
                status === 'resolved' ? 'TERSELESAIKAN' :
                  status === 'closed' ? 'DITUTUP' : status.toUpperCase();
        showToast(`Status tiket diubah ke ${statusLabel}`, 'success');
        loadData();
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket((prev: any) => ({ ...prev, status }));
        }
      } else {
        const errJson = await res.json().catch(() => null);
        showToast(errJson?.message || 'Gagal memperbarui status tiket', 'error');
      }
    } catch {
      showToast('Gagal memperbarui tiket', 'error');
    }
  };

  // Compliance Reports List Server-Side Fetcher
  const fetchReportsList = async (page = 1, status = reportsFilter, target = reportsTargetFilter, search = reportsSearchQuery) => {
    if (!token) return;
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: status,
        target_type: target,
        search: search
      });
      const res = await fetch(`/api/admin/reports?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setReports(d.data || []);
        if (d.pagination) {
          setReportsPagination(d.pagination);
        }
        if (d.metrics) {
          setReportMetrics(d.metrics);
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('Gagal memuat daftar laporan:', e?.message || e);
    }
  };

  // Compliance Status & Moderation Action Update
  const handleUpdateReportStatus = async (
    reportId: number,
    status: string,
    actionTaken: string = 'none',
    adminNotes: string = '',
    applyEnforcement: boolean = true
  ) => {
    if (isSubmittingModerationRef.current) return;
    isSubmittingModerationRef.current = true;
    setIsSubmittingModeration(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          action_taken: actionTaken,
          admin_notes: adminNotes,
          apply_enforcement: applyEnforcement
        })
      });
      if (res.ok) {
        showToast('Tindakan moderasi berhasil diterapkan dan audit trail tercatat', 'success');
        apiClient.invalidate();
        try {
          if (moderationModalReport?.store_slug) {
            localStorage.removeItem(`catavor_store_${moderationModalReport.store_slug.toLowerCase()}`);
          }
          localStorage.removeItem('catavor_settings');
        } catch { }
        fetchReportsList(reportsPagination.page);
        handleDismissBannedConfirmModal();
        handleCloseModerationPage();
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.message) console.error('Update report error:', errData.message);
        showToast('laporan gagal diperbaharui', 'error');
      }
    } catch (err) {
      console.error('Update report error:', err);
      showToast('laporan gagal diperbaharui', 'error');
    } finally {
      setIsSubmittingModeration(false);
      isSubmittingModerationRef.current = false;
    }
  };

  const handleOpenModerationPage = (report: any, pushToHistory = true) => {
    setActiveView('reports');
    setModerationModalReport(report);
    setModerationStatus(report.status === 'pending' ? 'investigating' : report.status);
    setModerationAction(report.action_taken || 'none');
    setModerationNotes(report.admin_notes || '');
    setReportActiveEvidence([]);
    setReportPriorHistory([]);
    setIsLoadingReportDetail(true);

    if (token) {
      const refId = report.id || report.report_number;
      fetch(`/api/admin/reports/${refId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            setModerationModalReport(json.data);
            setModerationStatus(json.data.status === 'pending' ? 'investigating' : json.data.status);
            setModerationAction(json.data.action_taken || 'none');
            setModerationNotes(json.data.admin_notes || '');
          }
          if (json.active_reports || json.active_evidence) {
            setReportActiveEvidence(json.active_reports || json.active_evidence);
          }
          if (json.history_reports || json.prior_history) {
            setReportPriorHistory(json.history_reports || json.prior_history);
          }
        })
        .catch(err => console.error('Failed to load active evidence & history', err))
        .finally(() => setIsLoadingReportDetail(false));
    }

    if (pushToHistory) {
      const reportRef = report.report_number || report.id;
      updatePlatformUrl('reports', null, null, null, reportRef);
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleCloseModerationPage = () => {
    handleDismissBannedConfirmModal();
    setModerationModalReport(null);
    setReportActiveEvidence([]);
    setReportPriorHistory([]);
    updatePlatformUrl('reports', null, null, null, null);
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // Normalized Order & Payment Configuration Descriptor (100% Parity across Desktop, Tablet, Mobile)
  const describeSubscriptionOrder = useCallback((o: any) => {
    const rawStatus = String(o?.payment_status || o?.status || 'pending').toLowerCase();
    const isPendingVerification = rawStatus === 'pending_verification';
    const isPendingPayment = rawStatus === 'pending';
    const isPending = isPendingVerification || isPendingPayment;
    const isPaid = rawStatus === 'paid' || rawStatus === 'active';
    const isRejected = rawStatus === 'rejected';
    const isExpired = rawStatus === 'expired' || rawStatus === 'cancelled';

    const statusLabel = isPaid
      ? 'LUNAS & AKTIF'
      : isPendingVerification
        ? 'MENUNGGU VERIFIKASI'
        : isPendingPayment
          ? 'MENUNGGU PEMBAYARAN'
          : isRejected
            ? 'DITOLAK'
            : isExpired
              ? 'KEDALUWARSA'
              : rawStatus.toUpperCase();

    const payMode = String(o?.payment_mode || '').toLowerCase();
    const payMethod = String(o?.payment_method || 'bank').toLowerCase();
    const originalAmount = Number(o?.original_amount ?? o?.amount ?? o?.price ?? 0);
    const discountAmount = Number(o?.discount_amount ?? 0);
    const uniqueCode = Number(o?.unique_code ?? 0);
    const finalAmount = Number(o?.final_amount ?? o?.amount ?? o?.price ?? 0);

    const configType = paymentChannel(o);
    const isFreeCoupon = configType === 'coupon_free';
    const isAulaaGateway = configType === 'gateway_aulaa';
    const isManualQRIS = configType === 'manual_qris';
    const isManualBank = configType === 'manual_bank';

    const configBadgeLabel = isFreeCoupon
      ? 'Kupon Gratis 100%'
      : isAulaaGateway
        ? 'Aulaa Payment Gateway'
        : isManualQRIS
          ? 'QRIS Merchant Manual'
          : 'Transfer Bank Manual';

    const aulaaSubChannelLabel = payMethod === 'qris'
      ? 'QRIS Instan (Aulaa)'
      : payMethod === 'va'
        ? 'Virtual Account Bank (Aulaa)'
        : payMethod === 'ewallet'
          ? 'Dompet Digital / E-Wallet (Aulaa)'
          : payMethod === 'cc' || payMethod === 'card'
            ? 'Kartu Kredit / Debit (Aulaa)'
            : `Kanal Gateway (${payMethod.toUpperCase()})`;

    const configChannelLabel = isFreeCoupon
      ? `Kupon Promo (${o?.coupon_code || 'FREE100'})`
      : isAulaaGateway
        ? aulaaSubChannelLabel
        : isManualQRIS
          ? 'Scan QRIS Statis Merchant (Nominal Pas)'
          : 'Transfer Rekening Bank (Kode Unik Mutasi)';

    const orderNumber = o?.order_number || o?.invoice_number || `INV-SUB-${o?.id || ''}`;
    const orderTypeRaw = String(o?.type || 'upgrade').toLowerCase();
    const orderTypeLabel = orderTypeRaw === 'initial'
      ? 'Pendaftaran Awal'
      : orderTypeRaw === 'renewal'
        ? 'Perpanjangan'
        : 'Upgrade Paket';

    const planCodeRaw = String(o?.plan_code || o?.plan_name || o?.plan || 'pro_starter').toLowerCase();
    const planLabel = planCodeRaw === 'pro_business'
      ? 'PRO BUSINESS'
      : planCodeRaw === 'pro_starter'
        ? 'PRO STARTER'
        : planCodeRaw.toUpperCase().replace(/_/g, ' ');

    const storeTitle = o?.store?.store_title || o?.store?.name || o?.store_name || `Store #${o?.store_id || ''}`;
    const storeSlug = o?.store?.slug || '';
    const storeCurrentPlan = String(o?.store?.plan || 'free').toUpperCase().replace(/_/g, ' ');
    const customerName = o?.user?.name || o?.sender_account_name || 'Merchant Catavor';
    const customerEmail = o?.user?.email || '-';
    const senderAccountName = o?.sender_account_name || o?.user?.name || '-';
    const senderPhone = o?.sender_phone || o?.store?.whatsapp_number || o?.user?.phone || '';
    const rawProof = (o?.payment_proof_url || o?.transfer_proof_url || '').trim();
    let proofUrl = '';
    if (rawProof) {
      const orderId = o?.id || o?.order_number;
      if (orderId) {
        proofUrl = `/api/admin/subscription/orders/${encodeURIComponent(String(orderId))}/proof`;
      } else if (rawProof.startsWith('blob:') || rawProof.startsWith('data:image/')) {
        proofUrl = rawProof;
      }
    }
    const notes = o?.notes || '';
    const rejectionReason = o?.rejection_reason || '';
    const approvedByLabel = o?.approved_by_user?.name || o?.approved_by_user?.email || (isPaid && isAulaaGateway ? 'Webhook Otomatis Aulaa.co' : (isPaid ? 'Admin Keuangan Platform' : '-'));

    const targetQrisMerchant = googleSettings?.payment_qris_manual_merchant || 'Catavor Official Store';
    const targetBankName = googleSettings?.payment_bank_name || 'Bank Central Asia (BCA)';
    const targetBankAccount = googleSettings?.payment_bank_account || '8830-1928-3920';
    const targetBankHolder = googleSettings?.payment_bank_holder || 'PT Catavor Media Digital';

    let gatewayRawSummary = '';
    if (o?.gateway_raw_response) {
      try {
        const parsed = typeof o.gateway_raw_response === 'string' ? JSON.parse(o.gateway_raw_response) : o.gateway_raw_response;
        if (parsed && typeof parsed === 'object') {
          const parts: string[] = [];
          if (parsed.id || parsed.reference_id) parts.push(`ID: ${parsed.id || parsed.reference_id}`);
          if (parsed.status) parts.push(`Status: ${String(parsed.status).toUpperCase()}`);
          if (parsed.payment_method || parsed.channel) parts.push(`Kanal: ${String(parsed.payment_method || parsed.channel).toUpperCase()}`);
          gatewayRawSummary = parts.join(' • ');
        }
      } catch {
        gatewayRawSummary = '';
      }
    }

    return {
      rawStatus,
      isPendingVerification,
      isPendingPayment,
      isPending,
      isPaid,
      isRejected,
      isExpired,
      statusLabel,
      payMode,
      payMethod,
      originalAmount,
      discountAmount,
      uniqueCode,
      finalAmount,
      isFreeCoupon,
      isAulaaGateway,
      isManualQRIS,
      isManualBank,
      configType,
      configBadgeLabel,
      configChannelLabel,
      orderNumber,
      orderTypeLabel,
      planLabel,
      storeTitle,
      storeSlug,
      storeCurrentPlan,
      customerName,
      customerEmail,
      senderAccountName,
      senderPhone,
      proofUrl,
      notes,
      rejectionReason,
      approvedByLabel,
      targetQrisMerchant,
      targetBankName,
      targetBankAccount,
      targetBankHolder,
      gatewayReference: o?.gateway_reference || '',
      gatewayPaymentLink: o?.gateway_payment_link || '',
      gatewayProvider: o?.gateway_provider || (isAulaaGateway ? 'aulaa' : ''),
      gatewayRawSummary,
      couponCode: o?.coupon_code || '',
      durationMonths: Number(o?.duration_months || 1),
      billingCycle: o?.billing_cycle === 'annual' ? 'Tahunan (12 Bulan)' : 'Bulanan (1 Bulan)',
      createdAt: o?.created_at || '',
      paidAt: o?.paid_at || '',
      expiresAt: o?.expires_at || ''
    };
  }, [googleSettings]);

  // Finance Order Status Update
  const handleUpdateOrderStatus = async (orderId: number, status: 'active' | 'rejected' | 'pending_verification', reason?: string) => {
    try {
      const res = await fetch(`/api/admin/subscription/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason: reason || undefined, rejection_reason: reason || undefined })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success !== false) {
        const msg = status === 'active'
          ? 'Paket langganan berhasil diverifikasi & diaktifkan!'
          : status === 'rejected'
            ? 'Pesanan langganan berhasil ditolak.'
            : 'Pesanan dikembalikan ke antrean verifikasi.';
        showToast(msg, 'success');
        await loadData();
        if (d.order && selectedProofOrder?.id === orderId) {
          setSelectedProofOrder((prev: any) => prev ? { ...prev, ...d.order } : null);
        } else if (status !== 'pending_verification') {
          setSelectedProofOrder(null);
        }
        setRejectingOrder(null);
      } else {
        showToast(d.message || 'Gagal memproses pesanan', 'error');
      }
    } catch {
      showToast('Kesalahan server saat memproses pesanan', 'error');
    }
  };

  // Sync Order Status with Aulaa Payment Gateway
  const handleSyncOrderWithAulaa = async (orderId: number) => {
    setSyncingOrderId(orderId);
    try {
      let res = await fetch(`/api/admin/subscription/orders/${orderId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`/api/subscription/orders/${orderId}/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        showToast(d.message || 'Sinkronisasi status gateway Aulaa selesai', 'success');
        await loadData();
        const updatedOrder = d.order || d.data;
        if (updatedOrder && selectedProofOrder?.id === orderId) {
          setSelectedProofOrder((prev: any) => prev ? { ...prev, ...updatedOrder } : null);
        }
      } else {
        showToast(d.message || 'Gagal menyinkronkan status ke gateway Aulaa', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server sinkronisasi Aulaa', 'error');
    } finally {
      setSyncingOrderId(null);
    }
  };

  // Save Google AdSense & Analytics Settings
  const handleSaveGoogleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        ads_enabled: googleSettings.ads_enabled ?? '0',
        ads_client_id: googleSettings.ads_client_id ?? '',
        ads_auto_enabled: googleSettings.ads_auto_enabled ?? '1',
        ads_slot_header: googleSettings.ads_slot_header ?? '',
        ads_slot_infeed: googleSettings.ads_slot_infeed ?? '',
        ads_slot_product_detail: googleSettings.ads_slot_product_detail ?? '',
        ads_slot_bottom: googleSettings.ads_slot_bottom ?? '',
        ads_test_mode: googleSettings.ads_test_mode ?? '1',
        ads_txt_content: googleSettings.ads_txt_content ?? '',
        ga_enabled: googleSettings.ga_enabled ?? '0',
        ga_measurement_id: googleSettings.ga_measurement_id ?? '',
      };
      const res = await fetch('/api/admin/monetization/settings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast('Pengaturan Google AdSense & Analytics berhasil disimpan!', 'success');
        loadData();
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal menyimpan pengaturan Google', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Platform Official Contact Settings
  const handleSaveContactSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform_official_whatsapp: (googleSettings.platform_official_whatsapp || '').trim(),
          platform_official_email: (googleSettings.platform_official_email || '').trim().toLowerCase(),
        }),
      });
      if (res.ok) {
        showToast('Kontak resmi platform berhasil diperbarui!', 'success');
        loadData();
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal menyimpan kontak resmi platform', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Rekber Syariah Global Platform Settings
  const handleSaveRekberSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const stripIcons = (s?: string) => (s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/^[ \t]+/gm, '');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rekber_enabled: googleSettings.rekber_enabled !== undefined ? googleSettings.rekber_enabled : '1',
          rekber_partner_name: googleSettings.rekber_partner_name || 'Rekber Syariah',
          rekber_website_url: googleSettings.rekber_website_url || 'https://rekbersyariah.com',
          rekber_wa_number: (googleSettings.rekber_wa_number || '').trim(),
          rekber_logo_url: (googleSettings.rekber_logo_url || '').trim(),
          rekber_template_physical: stripIcons(googleSettings.rekber_template_physical),
          rekber_template_general: stripIcons(googleSettings.rekber_template_physical || googleSettings.rekber_template_general),
          rekber_template_food: stripIcons(googleSettings.rekber_template_food),
          rekber_template_digital: stripIcons(googleSettings.rekber_template_digital),
          rekber_template_service: stripIcons(googleSettings.rekber_template_service),
          rekber_template_plant: stripIcons(googleSettings.rekber_template_plant),
          rekber_template_fauna: stripIcons(googleSettings.rekber_template_fauna),
        }),
      });
      if (res.ok) {
        showToast('Konfigurasi Rekber Syariah berhasil disimpan!', 'success');
        loadData();
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal menyimpan konfigurasi Rekber', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetRekberDefaults = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mereset seluruh konfigurasi Rekber Syariah ke standar resmi pabrik rekbersyariah.com?')) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings/rekber/reset-defaults', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        showToast('Konfigurasi Rekber Syariah berhasil direset ke standar resmi rekbersyariah.com!', 'success');
        setGoogleSettings(prev => ({
          ...prev,
          rekber_enabled: '1',
          rekber_partner_name: 'Rekber Syariah',
          rekber_website_url: 'https://rekbersyariah.com',
          rekber_wa_number: '62811220227',
          rekber_logo_url: '',
          ...REKBER_FACTORY_DEFAULTS
        }));
        loadData();
      } else {
        showToast('Gagal mereset konfigurasi Rekber', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat reset', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Payment System Platform Settings
  const handleSavePaymentSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: Record<string, string> = {
        payment_system_mode: googleSettings.payment_system_mode || 'gateway_aulaa',
        payment_maintenance_title: googleSettings.payment_maintenance_title || 'Sistem Pembayaran Dalam Pemeliharaan',
        payment_maintenance_message: googleSettings.payment_maintenance_message || 'Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.',
        payment_qris_manual_image: (googleSettings.payment_qris_manual_image || '').trim(),
        payment_qris_manual_merchant: googleSettings.payment_qris_manual_merchant || 'Catavor Official Store',
        payment_bank_name: googleSettings.payment_bank_name || 'Bank Central Asia (BCA)',
        payment_bank_account: googleSettings.payment_bank_account || '8830-1928-3920',
        payment_bank_holder: googleSettings.payment_bank_holder || 'PT Catavor Media Digital',
        payment_aulaa_channel_qris: googleSettings.payment_aulaa_channel_qris !== undefined ? googleSettings.payment_aulaa_channel_qris : '1',
        payment_aulaa_channel_va: googleSettings.payment_aulaa_channel_va !== undefined ? googleSettings.payment_aulaa_channel_va : '1',
        payment_aulaa_channel_cc: googleSettings.payment_aulaa_channel_cc !== undefined ? googleSettings.payment_aulaa_channel_cc : '0',
        payment_aulaa_channel_ewallet: googleSettings.payment_aulaa_channel_ewallet !== undefined ? googleSettings.payment_aulaa_channel_ewallet : '1',
        aulaa_base_url: googleSettings.aulaa_base_url || 'https://api.aulaa.co/v1',
        aulaa_api_key: googleSettings.aulaa_api_key || '',
        aulaa_webhook_secret: googleSettings.aulaa_webhook_secret || '',
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        savedQrisImageRef.current = (googleSettings.payment_qris_manual_image || '').trim();
        try {
          localStorage.setItem('catavor_platform_settings_updated', String(Date.now()));
          window.dispatchEvent(new Event('catavor_platform_settings_updated'));
        } catch { }
        showToast('Konfigurasi sistem pembayaran berhasil disimpan!', 'success');
        loadData();
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal menyimpan konfigurasi sistem pembayaran', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat menyimpan konfigurasi pembayaran', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadQRISImage = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran berkas QRIS maksimal 5MB', 'error');
      return;
    }
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
      showToast('Format berkas harus berupa gambar (PNG, JPG, WebP, SVG)', 'error');
      return;
    }
    setIsUploadingQRISImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('file', file);
      formData.append('category', 'platform_qris');
      const res = await fetch('/api/storage/upload?category=platform_qris', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const uploadedUrl = data.url || data.path || data.file_url;
        if (uploadedUrl) {
          setGoogleSettings(prev => ({
            ...prev,
            payment_qris_manual_image: uploadedUrl,
          }));
          showToast('Gambar QRIS berhasil diunggah! Pratinjau diperbarui (klik Simpan untuk menerapkan)', 'success');
        }
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal mengunggah berkas QRIS', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat mengunggah berkas QRIS', 'error');
    } finally {
      setIsUploadingQRISImage(false);
    }
  };

  const handleOpenCreateCouponModal = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: '',
      label: '',
      type: 'discount',
      discount: 50000,
      usage_limit: 0,
      expires_at: '',
      is_active: true
    });
    setShowCouponModal(true);
  };

  const handleOpenEditCouponModal = (cItem: any) => {
    setEditingCoupon(cItem);
    setCouponForm({
      code: cItem.code || '',
      label: cItem.label || '',
      type: cItem.type === 'free' ? 'free' : 'discount',
      discount: cItem.discount || 0,
      usage_limit: cItem.usage_limit || 0,
      expires_at: cItem.expires_at ? cItem.expires_at.split('T')[0] : '',
      is_active: cItem.is_active !== false
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const cleanCode = couponForm.code.trim().toUpperCase();
    if (!cleanCode) {
      showToast('Kode kupon wajib diisi.', 'error');
      return;
    }
    if (couponForm.type === 'discount' && Number(couponForm.discount) <= 0) {
      showToast('Nominal potongan diskon harus lebih dari Rp 0.', 'error');
      return;
    }
    setSavingCoupon(true);
    try {
      const payload: any = {
        code: cleanCode,
        label: couponForm.label.trim() || `Kupon ${cleanCode}`,
        type: couponForm.type,
        discount: couponForm.type === 'free' ? 0 : Number(couponForm.discount),
        usage_limit: Number(couponForm.usage_limit) || 0,
        is_active: couponForm.is_active
      };
      if (couponForm.expires_at) {
        payload.expires_at = new Date(`${couponForm.expires_at}T23:59:59Z`).toISOString();
      } else {
        payload.expires_at = null;
      }

      const url = editingCoupon ? `/api/admin/coupons/${encodeURIComponent(editingCoupon.code)}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const textErr = await res.text().catch(() => '');
        throw new Error(textErr || `Server error (${res.status} ${res.statusText})`);
      }
      if (res.ok && data?.success) {
        showToast(data.message || (editingCoupon ? 'Kupon berhasil diperbarui!' : 'Kupon baru berhasil ditambahkan!'), 'success');
        setShowCouponModal(false);
        fetchCoupons();
      } else {
        showToast(data?.message || 'Gagal menyimpan kupon.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat menyimpan kupon.', 'error');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!token || !code) return;
    setDeletingCouponCode(code);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Kupon "${code}" berhasil dihapus.`, 'success');
        fetchCoupons();
      } else {
        showToast(data.message || 'Gagal menghapus kupon.', 'error');
      }
    } catch {
      showToast('Gagal menghapus kupon.', 'error');
    } finally {
      setDeletingCouponCode(null);
    }
  };

  const handleToggleCoupon = async (code: string) => {
    if (!token || !code) return;
    setTogglingCouponCode(code);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Status kupon "${code}" berhasil diubah.`, 'success');
        fetchCoupons();
      } else {
        showToast(data.message || 'Gagal mengubah status kupon.', 'error');
      }
    } catch {
      showToast('Gagal mengubah status kupon.', 'error');
    } finally {
      setTogglingCouponCode(null);
    }
  };

  const handleUploadRekberLogo = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file logo maksimal 5MB', 'error');
      return;
    }
    setIsUploadingRekberLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', 'rekber');
      const res = await fetch('/api/storage/upload?category=rekber', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setGoogleSettings(prev => ({
          ...prev,
          rekber_logo_url: data.url
        }));
        showToast('Logo partner rekber berhasil diunggah!', 'success');
      } else {
        showToast(data.message || 'Gagal mengunggah logo partner', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mengunggah logo', 'error');
    } finally {
      setIsUploadingRekberLogo(false);
    }
  };

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const actionRequiredTicketsCount = (ticketsMetrics && typeof ticketsMetrics.action_required === 'number' && ticketsMetrics.action_required > 0)
    ? ticketsMetrics.action_required
    : tickets.filter(t => (t.status === 'open' || t.status === 'waiting_agent')).length;
  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const unreadTicketsCount = tickets.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0)).length;
  const inProgressTicketsCount = ticketsMetrics.in_progress ?? tickets.filter(t => t.status === 'in_progress').length;
  const waitingUserTicketsCount = ticketsMetrics.waiting_user ?? tickets.filter(t => t.status === 'waiting_user').length;
  const urgentTicketsCount = ticketsMetrics.urgent ?? tickets.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedTicketsCount = ticketsMetrics.resolved ?? tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const totalTicketsCount = ticketsMetrics.total ?? tickets.length;
  const pendingOrdersCount = financeSummary.pending;
  const totalAlertsCount = pendingReportsCount + actionRequiredTicketsCount + pendingOrdersCount + (dormancyMetrics?.dormant_stores || 0);

  // Dynamic Mobile Triage Status Options: strictly count > 0
  const mobileTriageStatusOptions = useMemo<MobileSelectOption[]>(() => {
    const raw: MobileSelectOption[] = [
      { value: 'all', label: 'Semua Status Tiket', count: totalTicketsCount, badge: `${totalTicketsCount}` },
      { value: 'action_required', label: 'Perlu Respon', count: actionRequiredTicketsCount, badge: `${actionRequiredTicketsCount}` },
      { value: 'in_progress', label: 'Diproses', count: inProgressTicketsCount, badge: `${inProgressTicketsCount}` },
      { value: 'waiting_user', label: 'Tunggu Merchant', count: waitingUserTicketsCount, badge: `${waitingUserTicketsCount}` },
      { value: 'urgent', label: 'Urgent', count: urgentTicketsCount, badge: `${urgentTicketsCount}` },
      { value: 'resolved', label: 'Selesai', count: resolvedTicketsCount, badge: `${resolvedTicketsCount}` }
    ];
    return raw.filter(opt => opt.value === 'all' || (opt.count !== undefined && opt.count > 0));
  }, [totalTicketsCount, actionRequiredTicketsCount, inProgressTicketsCount, waitingUserTicketsCount, urgentTicketsCount, resolvedTicketsCount]);

  const activeMobileTriageFilter = ticketPriorityFilter === 'urgent' ? 'urgent' : ticketsFilter;

  const handleMobileTriageFilterChange = (val: string) => {
    if (val === 'urgent') {
      setTicketPriorityFilter('urgent');
      setTicketsFilter('all');
    } else {
      if (ticketPriorityFilter === 'urgent') {
        setTicketPriorityFilter('all');
      }
      setTicketsFilter(val as any);
    }
  };

  useEffect(() => {
    const current = ticketPriorityFilter === 'urgent' ? 'urgent' : ticketsFilter;
    if (current !== 'all' && mobileTriageStatusOptions.length > 1) {
      if (!mobileTriageStatusOptions.some(o => o.value === current)) {
        handleMobileTriageFilterChange('all');
      }
    }
  }, [mobileTriageStatusOptions, ticketsFilter, ticketPriorityFilter]);

  // Auto-scroll chat stream to bottom when ticket is opened or new messages arrive
  useEffect(() => {
    if (selectedTicket) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [selectedTicket?.id, selectedTicket?.messages?.length]);

  // Complete dictionary of all platform modules for metadata & headers
  const allModules: Record<ActiveView, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Pusat Ringkasan Eksekutif' },
    rbac: { title: 'Staf & RBAC', subtitle: 'Matriks & Izin Akses' },
    stores: { title: 'Tata Kelola Toko', subtitle: `${dormancyMetrics?.active_stores || 1} Toko Terdaftar` },
    reports: { title: 'Laporan Masuk', subtitle: `${pendingReportsCount} Laporan Pending` },
    support: {
      title: 'Helpdesk Tiket',
      subtitle: actionRequiredTicketsCount > 0
        ? `${actionRequiredTicketsCount} Perlu Respon Tim`
        : (totalTicketsCount > 0
          ? `${totalTicketsCount} Total Tiket`
          : '0 Tiket Aktif')
    },
    finance: { title: 'Keuangan & Order', subtitle: `${pendingOrdersCount} Order Pending` },
    monetization: { title: 'Monetisasi & Iklan', subtitle: 'Google AdSense & GA4' },
    broadcast: { title: 'Siaran Broadcast', subtitle: `${broadcastActiveCount} Siaran Aktif` },
    automation: { title: 'Mesin Otomatisasi', subtitle: 'Status dan riwayat pekerjaan' },
    audit: { title: 'Audit Trail', subtitle: `${auditLogs.length} Log Aktivitas` },
    master_data: {
      title: 'Data Master',
      subtitle: masterSubView === 'domains'
        ? 'Domain Whitelist Ekosistem'
        : (masterSubView === 'templates'
          ? `${cannedTemplates.length} Template Pesan Cepat CS`
          : (masterSubView === 'rekber' ? 'Integrasi Rekber Syariah (rekbersyariah.com)' : (masterSubView === 'policies' ? 'Kebijakan, Regulasi & Ketentuan Legal Platform' : 'Pusat Konfigurasi Master Data')))
    },
    safe_domains: { title: 'Master Domain Aman', subtitle: 'Whitelist URL & Navigasi Bebas Hambatan' },
    policies: { title: 'Kebijakan & Legalitas Platform', subtitle: '6 Pilar Regulasi & Kontrol Versi' },
    market_intel: { title: 'Riset Pasar B2B', subtitle: 'Tren Hype, Demand Gap & Benchmark Harga' },
  };

  // Specialized Platform & System Management Modules on Dashboard Grid
  const dashboardGridItems = [
    {
      id: 'rbac' as ActiveView,
      title: 'Staf & RBAC',
      subtitle: 'Matriks & Izin Akses',
      icon: <Users size={20} />,
      color: '#6366f1',
      bg: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
      border: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.25)',
      badge: 0,
      visible: canAccessRBAC
    },
    {
      id: 'market_intel' as ActiveView,
      title: 'Riset Pasar B2B',
      subtitle: 'Tren Hype & Demand Gap',
      icon: <TrendingUp size={20} />,
      color: '#10b981',
      bg: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      border: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
      badge: 0,
      visible: canAccessMarketIntel
    },
    {
      id: 'stores' as ActiveView,
      title: 'Tata Kelola Toko',
      subtitle: 'Status Kepatuhan & Dormansi',
      icon: <Store size={20} />,
      color: '#3b82f6',
      bg: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
      border: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)',
      badge: dormancyMetrics?.dormant_stores || 0,
      visible: canAccessCompliance
    },
    {
      id: 'monetization' as ActiveView,
      title: 'Monetisasi & Iklan',
      subtitle: 'Google AdSense & GA4',
      icon: <DollarSign size={20} />,
      color: '#eab308',
      bg: isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.1)',
      border: isDark ? 'rgba(234, 179, 8, 0.3)' : 'rgba(234, 179, 8, 0.25)',
      badge: 0,
      visible: canAccessMonetization
    },
    {
      id: 'broadcast' as ActiveView,
      title: 'Siaran Broadcast',
      subtitle: 'Notifikasi Massal Pengguna',
      icon: <Megaphone size={20} />,
      color: '#f59e0b',
      bg: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
      border: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)',
      badge: 0,
      visible: canAccessBroadcast
    },
    {
      id: 'automation' as ActiveView,
      title: 'Mesin Otomatisasi',
      subtitle: 'Status, jadwal, dan riwayat pekerjaan',
      icon: <Bot size={20} />,
      color: '#38bdf8',
      bg: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
      border: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(56, 189, 248, 0.25)',
      badge: 0,
      visible: canAccessAutomation
    },
    {
      id: 'policies' as ActiveView,
      title: 'Kebijakan & Legalitas',
      subtitle: '6 Pilar Regulasi & Banner Legal',
      icon: <Scale size={20} />,
      color: '#10b981',
      bg: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      border: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
      badge: 0,
      visible: canManageSystemSettings
    },
    {
      id: 'master_data' as ActiveView,
      title: 'Data Master',
      subtitle: 'Domain Whitelist & Template CS',
      icon: <Database size={20} />,
      color: '#38bdf8',
      bg: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)',
      border: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(56, 189, 248, 0.25)',
      badge: 0,
      visible: canAccessMasterData
    },
    {
      id: 'audit' as ActiveView,
      title: 'Audit Trail',
      subtitle: 'Log Aktivitas Platform',
      icon: <Activity size={20} />,
      color: '#64748b',
      bg: isDark ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.1)',
      border: isDark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(100, 116, 139, 0.25)',
      badge: 0,
      visible: canAccessAudit
    }
  ].filter(item => item.visible);

  // Exactly 4 Top Priority Operational Tabs in the Bottom Navigation Bar
  const footerNavTabs = [
    {
      id: 'dashboard' as ActiveView,
      label: 'Ringkasan',
      icon: <LayoutDashboard size={20} />,
      badge: 0,
      visible: true
    },
    {
      id: 'reports' as ActiveView,
      label: 'Laporan',
      icon: <ShieldAlert size={20} />,
      badge: pendingReportsCount,
      visible: canAccessCompliance
    },
    {
      id: 'support' as ActiveView,
      label: 'Helpdesk',
      icon: <HelpCircle size={20} />,
      badge: Math.max(
        actionRequiredTicketsCount,
        unreadTicketsCount,
        openTicketsCount,
        (ticketsMetrics && typeof ticketsMetrics.action_required === 'number') ? ticketsMetrics.action_required : 0
      ),
      visible: canAccessSupport
    },
    {
      id: 'finance' as ActiveView,
      label: 'Keuangan',
      icon: <CreditCard size={20} />,
      badge: pendingOrdersCount,
      visible: canAccessFinance
    }
  ].filter(item => item.visible);

  // Cek apakah user sedang berada di sub-halaman/modul sekunder atau detail percakapan
  const isSubPage =
    !['dashboard', 'reports', 'support', 'finance'].includes(activeView) ||
    (activeView === 'reports' && Boolean(moderationModalReport)) ||
    (activeView === 'support' && Boolean(selectedTicket)) ||
    (activeView === 'finance' && Boolean(selectedProofOrder));

  // =========================================================================
  // DYNAMIC CONTEXTUAL HEADER CONFIGURATION (Industry Standard Best Practice)
  // =========================================================================
  const headerConfig = useMemo<ContextualHeaderConfig>(() => {
    // 1. DASHBOARD OVERVIEW
    if (activeView === 'dashboard') {
      return {
        showMenu: true,
        title: 'Ringkasan Platform',
        subtitle: 'Pusat kendali & metrik ekosistem Catavor',
        items: [
          {
            id: 'refresh',
            label: 'Segarkan Data Platform',
            description: 'Sinkronisasi metrik, tiket & pesanan',
            icon: <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Data platform berhasil diperbarui', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 2. MASTER DATA VIEW
    if (activeView === 'master_data') {
      if (masterSubView === 'domains') {
        return {
          showMenu: true,
          title: 'Master Domain Aman',
          subtitle: 'Whitelist & proteksi URL ekosistem',
          primaryAction: {
            icon: <Plus size={17} />,
            title: 'Tambah Domain',
            onClick: () => window.dispatchEvent(new CustomEvent('catavor:open-add-domain'))
          },
          items: [
            {
              id: 'refresh_domains',
              label: 'Segarkan Data Whitelist',
              description: 'Muat ulang daftar domain dari server',
              icon: <RefreshCw size={18} />,
              iconBg: 'rgba(56, 189, 248, 0.15)',
              iconColor: '#38bdf8',
              onClick: () => {
                window.dispatchEvent(new CustomEvent('catavor:refresh-domains'));
                showToast('Data whitelist domain diperbarui', 'success');
              }
            }
          ],
          includeGlobalUtilities: true
        };
      }

      if (masterSubView === 'templates') {
        return {
          showMenu: true,
          title: 'Template Pesan Cepat CS',
          subtitle: 'Katalog respon cepat helpdesk',
          primaryAction: cannedTemplates.length > 0 ? {
            icon: <Plus size={17} />,
            title: 'Tambah Template',
            onClick: () => handleOpenCreateTemplate()
          } : undefined,
          items: [
            {
              id: 'refresh_templates',
              label: 'Segarkan Template CS',
              description: 'Sinkronisasi template dari server',
              icon: <RefreshCw size={18} />,
              iconBg: 'rgba(16, 185, 129, 0.15)',
              iconColor: '#10b981',
              onClick: () => {
                loadData();
                showToast('Daftar template CS diperbarui', 'success');
              }
            }
          ],
          includeGlobalUtilities: true
        };
      }

      // Default: masterSubView === 'menu'
      return {
        showMenu: true,
        title: 'Pusat Master Data',
        subtitle: 'Konfigurasi & standarisasi platform',
        items: [
          {
            id: 'refresh_master',
            label: 'Segarkan Data Master',
            description: 'Perbarui status entitas master',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Data master berhasil disegarkan', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 3. SUPPORT HELPDESK VIEW
    if (activeView === 'support') {
      if (selectedTicket) {
        return {
          showMenu: true,
          title: `Tiket #${selectedTicket.ticket_number || ('TCK-' + selectedTicket.id)}`,
          subtitle: `${getStoreDisplayName(selectedTicket)} • Status: ${String(selectedTicket.status || 'open').toUpperCase()}`,
          items: [
            ...(selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && canReplySupport ? [{
              id: 'resolve_ticket',
              label: 'Tandai Tiket Selesai',
              description: 'Ubah status ke Resolved (Teratasi)',
              icon: <CheckCircle2 size={18} />,
              iconBg: 'rgba(16, 185, 129, 0.15)',
              iconColor: '#10b981',
              onClick: () => handleUpdateTicketStatus(selectedTicket.id, 'resolved')
            }] : []),
            ...(selectedTicket.status !== 'closed' && canReplySupport ? [{
              id: 'close_ticket',
              label: 'Tutup Tiket Permanen',
              description: 'Kunci tiket dan akhiri percakapan',
              icon: <XCircle size={18} />,
              iconBg: 'rgba(239, 68, 68, 0.15)',
              iconColor: '#ef4444',
              onClick: () => handleUpdateTicketStatus(selectedTicket.id, 'closed')
            }] : []),
            {
              id: 'copy_ticket_info',
              label: 'Salin Nomor & Info Tiket',
              description: 'Salin nomor tiket ke papan klip',
              icon: <Copy size={18} />,
              iconBg: 'rgba(56, 189, 248, 0.15)',
              iconColor: '#38bdf8',
              onClick: () => {
                const text = `Tiket #${selectedTicket.ticket_number || selectedTicket.id} - ${getStoreDisplayName(selectedTicket)}: ${selectedTicket.subject || ''}`;
                navigator.clipboard.writeText(text);
                showToast('Info tiket disalin ke clipboard', 'success');
              }
            },
            {
              id: 'manage_templates',
              label: 'Kelola Template Pesan CS',
              description: 'Atur shortcut pesan tanggapan cepat',
              icon: <Zap size={18} />,
              iconBg: 'rgba(245, 158, 11, 0.15)',
              iconColor: '#f59e0b',
              onClick: () => handleSwitchView('master_data', null, 'templates')
            },
            {
              id: 'close_chat',
              label: 'Tutup Obrolan (Kembali)',
              description: 'Kembali ke daftar tiket helpdesk',
              icon: <ArrowLeft size={18} />,
              iconBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
              iconColor: theme.textPrimary,
              onClick: () => handleCloseTicketChat()
            }
          ],
          includeGlobalUtilities: false
        };
      }

      return {
        showMenu: true,
        title: 'Opsi Helpdesk Tiket',
        subtitle: 'Layanan dukungan & penanganan merchant',
        items: [
          {
            id: 'refresh_tickets',
            label: 'Segarkan Daftar Tiket',
            description: 'Periksa pembaruan tiket merchant',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Daftar tiket helpdesk diperbarui', 'success');
            }
          },
          {
            id: 'canned_templates',
            label: 'Katalog Template Cepat CS',
            description: 'Kelola balasan cepat respon tiket',
            icon: <Zap size={18} />,
            iconBg: 'rgba(245, 158, 11, 0.15)',
            iconColor: '#f59e0b',
            onClick: () => handleSwitchView('master_data', null, 'templates')
          },
          {
            id: 'copy_stats',
            label: 'Salin Ringkasan Helpdesk',
            description: 'Salin rekap jumlah tiket aktif & respon',
            icon: <Copy size={18} />,
            iconBg: 'rgba(16, 185, 129, 0.15)',
            iconColor: '#10b981',
            onClick: () => {
              const summary = `Ringkasan Helpdesk: ${tickets.length} total tiket, ${urgentTicketsCount} tiket prioritas tinggi.`;
              navigator.clipboard.writeText(summary);
              showToast('Ringkasan disalin', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 4. FINANCE VIEW
    if (activeView === 'finance') {
      if (selectedProofOrder) {
        const storeTitle = selectedProofOrder.store?.store_title || selectedProofOrder.store?.name || selectedProofOrder.store_name || 'Toko';
        const finalAmt = selectedProofOrder.final_amount ?? selectedProofOrder.amount ?? 0;
        const currentSt = selectedProofOrder.payment_status || selectedProofOrder.status;
        const isPending = currentSt === 'pending' || currentSt === 'pending_verification';

        return {
          showMenu: true,
          title: `Pesanan #${selectedProofOrder.order_number || selectedProofOrder.id}`,
          subtitle: `${storeTitle} • Rp ${finalAmt.toLocaleString('id-ID')}`,
          items: [
            ...(isPending && canManageFinance ? [
              {
                id: 'approve_payment',
                label: 'Aktifkan Paket',
                description: 'Verifikasi transfer & aktifkan langganan toko',
                icon: <CheckCircle2 size={18} />,
                iconBg: 'rgba(16, 185, 129, 0.15)',
                iconColor: '#10b981',
                onClick: () => handleUpdateOrderStatus(selectedProofOrder.id, 'active')
              },
              {
                id: 'reject_payment',
                label: 'Tolak Bukti Pembayaran',
                description: 'Batalkan bukti transfer tidak valid',
                icon: <AlertTriangle size={18} />,
                iconBg: 'rgba(239, 68, 68, 0.15)',
                iconColor: '#ef4444',
                isDestructive: true,
                onClick: () => handleUpdateOrderStatus(selectedProofOrder.id, 'rejected')
              }
            ] : []),
            {
              id: 'copy_order_info',
              label: 'Salin Detail Pesanan',
              description: 'Salin rincian nominal & nomor rekening',
              icon: <Copy size={18} />,
              iconBg: 'rgba(56, 189, 248, 0.15)',
              iconColor: '#38bdf8',
              onClick: () => {
                const text = `Order #${selectedProofOrder.id} - ${selectedProofOrder.store_name}: Rp ${(selectedProofOrder.amount || 99000).toLocaleString('id-ID')}`;
                navigator.clipboard.writeText(text);
                showToast('Detail pesanan disalin', 'success');
              }
            },
            {
              id: 'close_proof',
              label: 'Tutup Detail Verifikasi',
              description: 'Kembali ke daftar antrean keuangan',
              icon: <ArrowLeft size={18} />,
              iconBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
              iconColor: theme.textPrimary,
              onClick: () => setSelectedProofOrder(null)
            }
          ],
          includeGlobalUtilities: false
        };
      }

      return {
        showMenu: true,
        title: 'Opsi Keuangan Platform',
        subtitle: 'Pesanan langganan & verifikasi transfer',
        items: [
          {
            id: 'refresh_finance',
            label: 'Segarkan Data Keuangan',
            description: 'Sinkronkan transaksi dan bukti transfer',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Data keuangan berhasil diperbarui', 'success');
            }
          },
          {
            id: 'copy_finance_summary',
            label: 'Salin Ringkasan Order',
            description: 'Salin metrik pesanan dan order pending',
            icon: <Copy size={18} />,
            iconBg: 'rgba(16, 185, 129, 0.15)',
            iconColor: '#10b981',
            onClick: () => {
              const summary = `Keuangan: ${pendingOrdersCount} order pending butuh verifikasi.`;
              navigator.clipboard.writeText(summary);
              showToast('Ringkasan disalin', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 5. BROADCAST VIEW
    if (activeView === 'broadcast') {
      if (broadcastSubViewState === 'create') {
        return {
          showMenu: false,
          items: []
        };
      }

      return {
        showMenu: true,
        title: 'Siaran Platform',
        subtitle: 'Pengumuman & lifecycle notifikasi merchant',
        items: [
          {
            id: 'refresh_broadcast',
            label: 'Segarkan Riwayat Siaran',
            description: 'Muat data keterbacaan siaran terbaru',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              setBroadcastRefreshRev(n => n + 1);
              showToast('Riwayat siaran diperbarui', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 6. STORES VIEW
    if (activeView === 'stores') {
      return {
        showMenu: true,
        title: 'Tata Kelola Toko',
        subtitle: 'Kepatuhan & direktori merchant',
        items: [
          {
            id: 'refresh_stores',
            label: 'Segarkan Data Toko',
            description: 'Perbarui data merchant dan dormansi',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Data direktori toko diperbarui', 'success');
            }
          },
          {
            id: 'copy_stores_summary',
            label: 'Salin Ringkasan Toko',
            description: 'Rekap toko aktif dan status dorman',
            icon: <Copy size={18} />,
            iconBg: 'rgba(16, 185, 129, 0.15)',
            iconColor: '#10b981',
            onClick: () => {
              const summary = `Ringkasan Toko: ${dormancyMetrics?.active_stores || 1} aktif, ${dormancyMetrics?.dormant_stores || 0} dorman.`;
              navigator.clipboard.writeText(summary);
              showToast('Ringkasan toko disalin', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 7. REPORTS VIEW
    if (activeView === 'reports') {
      if (moderationModalReport) {
        return {
          showMenu: true,
          title: `Laporan #${moderationModalReport.report_number || moderationModalReport.id}`,
          subtitle: `${moderationModalReport.target_type === 'catalog' ? 'Katalog Merchant' : 'Item Produk'} • ${moderationModalReport.store_title || moderationModalReport.store_slug || 'Katalog'}`,
          items: [
            {
              id: 'copy_report_num',
              label: 'Salin Nomor Laporan',
              description: 'Salin nomor tiket pengaduan ini',
              icon: <Copy size={18} />,
              iconBg: 'rgba(56, 189, 248, 0.15)',
              iconColor: '#38bdf8',
              onClick: () => {
                navigator.clipboard.writeText(moderationModalReport.report_number || String(moderationModalReport.id));
                showToast('Nomor laporan disalin ke clipboard', 'success');
              }
            },
            ...(moderationModalReport.store_slug ? [{
              id: 'inspect_public_store',
              label: 'Inspeksi Halaman Publik',
              description: 'Buka toko / item di tab baru',
              icon: <ExternalLink size={18} />,
              iconBg: 'rgba(16, 185, 129, 0.15)',
              iconColor: '#10b981',
              onClick: () => window.open(`/${moderationModalReport.store_slug}`, '_blank')
            }] : []),
            {
              id: 'back_to_reports',
              label: 'Kembali ke Antrean Laporan',
              description: 'Daftar semua laporan pengaduan',
              icon: <ArrowLeft size={18} />,
              iconBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
              iconColor: theme.textPrimary,
              onClick: () => handleCloseModerationPage()
            }
          ],
          includeGlobalUtilities: false
        };
      }

      return {
        showMenu: true,
        title: 'Moderasi & Pengaduan',
        subtitle: 'Penanganan laporan pelanggaran konten',
        items: [
          {
            id: 'refresh_reports',
            label: 'Segarkan Laporan Masuk',
            description: 'Periksa antrean laporan pengaduan baru',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Antrean laporan pengaduan diperbarui', 'success');
            }
          },
          {
            id: 'copy_reports_summary',
            label: 'Salin Ringkasan Laporan',
            description: 'Rekap laporan yang memerlukan tindakan',
            icon: <Copy size={18} />,
            iconBg: 'rgba(239, 68, 68, 0.15)',
            iconColor: '#ef4444',
            onClick: () => {
              const summary = `Laporan: ${pendingReportsCount} laporan pending butuh investigasi.`;
              navigator.clipboard.writeText(summary);
              showToast('Ringkasan laporan disalin', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 8. RBAC VIEW
    if (activeView === 'rbac') {
      return {
        showMenu: true,
        title: 'Kelola Staf & Hak Akses',
        subtitle: 'Matriks izin & keamanan tim pengelola',
        items: [
          {
            id: 'refresh_rbac',
            label: 'Segarkan Matriks Izin Staf',
            description: 'Sinkronisasi daftar staf dan role',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Matriks izin staf diperbarui', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 9. MONETIZATION VIEW
    if (activeView === 'monetization') {
      return {
        showMenu: true,
        title: 'Opsi Monetisasi Platform',
        subtitle: 'Konfigurasi Google AdSense & GA4',
        items: [
          {
            id: 'refresh_monetization',
            label: 'Segarkan Konfigurasi Iklan',
            description: 'Muat ulang script dan status penempatan',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Pengaturan monetisasi disegarkan', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 10. AUTOMATION VIEW
    if (activeView === 'automation') {
      return {
        showMenu: true,
        title: 'Automasi Platform',
        subtitle: 'Bot pemeliharaan & cron jobs',
        items: [
          {
            id: 'refresh_automation',
            label: 'Segarkan Status Bot & Pekerja',
            description: 'Muat log automasi background terbaru',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              setAutomationRevision(n => n + 1);
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 11. AUDIT TRAIL VIEW
    if (activeView === 'audit') {
      return {
        showMenu: true,
        title: 'Log Audit Sistem',
        subtitle: 'Catatan aktivitas keamanan & riwayat admin',
        items: [
          {
            id: 'refresh_audit',
            label: 'Segarkan Log Audit Terbaru',
            description: 'Sinkronisasi aktivitas admin teranyar',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(56, 189, 248, 0.15)',
            iconColor: '#38bdf8',
            onClick: () => {
              loadData();
              showToast('Log audit berhasil diperbarui', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // 12. MARKET INTELLIGENCE VIEW
    if (activeView === 'market_intel') {
      return {
        showMenu: true,
        title: 'Riset Pasar B2B',
        subtitle: 'Tren Hype, Demand Gap & Benchmark Harga',
        items: [
          {
            id: 'refresh_market_intel',
            label: 'Segarkan Data Riset Pasar',
            description: 'Sinkronkan metrik tren dan agregat pasar',
            icon: <RefreshCw size={18} />,
            iconBg: 'rgba(16, 185, 129, 0.15)',
            iconColor: '#10b981',
            onClick: () => {
              loadData();
              setMarketIntelRevision((r) => r + 1);
              showToast('Data riset pasar diperbarui', 'success');
            }
          }
        ],
        includeGlobalUtilities: true
      };
    }

    // Fallback for any other subpage
    return {
      showMenu: true,
      title: 'Opsi Modul',
      subtitle: 'Pengaturan & tindakan modul',
      items: [
        {
          id: 'refresh_generic',
          label: 'Segarkan Data Modul',
          description: 'Sinkronkan data dengan server',
          icon: <RefreshCw size={18} />,
          iconBg: 'rgba(56, 189, 248, 0.15)',
          iconColor: '#38bdf8',
          onClick: () => {
            loadData();
            showToast('Data modul berhasil diperbarui', 'success');
          }
        }
      ],
      includeGlobalUtilities: true
    };
  }, [
    activeView,
    masterSubView,
    broadcastSubViewState,
    selectedTicket,
    selectedProofOrder,
    isDark,
    loading,
    tickets,
    urgentTicketsCount,
    pendingOrdersCount,
    pendingReportsCount,
    dormancyMetrics,
    canAccessMasterData,
    onLogout
  ]);

  return (
    <div
      className={`catavor-platform-portal ${isDark ? 'portal-dark' : 'portal-light'}`}
      data-portal-theme={isDark ? 'dark' : 'light'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        width: '100%',
        maxWidth: '100%',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        padding: (activeView === 'support' && selectedTicket)
          ? `0.5rem 0.95rem calc(${selectedTicket.status === 'closed' ? '70px' : (ticketReplyAttachments.length > 0 ? '245px' : '180px')} + env(safe-area-inset-bottom, 0px)) 0.95rem`
          : (activeView === 'reports' && moderationModalReport)
            ? '0.5rem 0.95rem 1.25rem 0.95rem'
            : isSubPage
              ? '0.5rem 0.95rem 2rem 0.95rem'
              : '0.5rem 0.95rem 5.5rem 0.95rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowX: 'clip'
      }}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          padding: '0.52rem 1.05rem',
          borderRadius: '999px',
          backgroundColor: toastMsg.type === 'success' ? '#10b981' : toastMsg.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          maxWidth: '92%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.25s ease-out'
        }}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> : toastMsg.type === 'error' ? <AlertTriangle size={15} style={{ flexShrink: 0 }} /> : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toastMsg.text}</span>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 1. EXECUTIVE MASTER HEADER (When on Dashboard Menu)                       */}
      {/* ========================================================================= */}
      {activeView === 'dashboard' && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 1000,
            boxSizing: 'border-box',
            borderRadius: 0,
            backgroundColor: isDark
              ? 'rgba(15, 23, 42, 0.96)'
              : 'rgba(255, 255, 255, 0.96)',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#cbd5e1'}`,
            padding: '0.72rem 1rem',
            boxShadow: isDark
              ? '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 18px rgba(56, 189, 248, 0.18)'
              : '0 8px 25px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}>
            {/* Left Side: Avatar & Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
              {/* Brand Logo with Live Online Dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.85rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '3px',
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <img
                    src={appLogoImg || APP_LOGO_BASE64}
                    alt="Catavor Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '0.6rem'
                    }}
                  />
                </div>
                {/* Live Online Dot */}
                <span style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: `2px solid ${theme.surface}`,
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
                }} />
              </div>

              {/* Identity Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
                  <h1 style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    margin: 0,
                    color: theme.textPrimary,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    Catavor Executive
                  </h1>
                  <span style={{
                    padding: '0.05rem 0.35rem',
                    borderRadius: '999px',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    backgroundColor: roleBadge.bg,
                    color: roleBadge.color,
                    border: `1px solid ${roleBadge.border}`,
                    flexShrink: 0
                  }}>
                    {roleBadge.label}
                  </span>
                </div>

                <span style={{
                  fontSize: '0.66rem',
                  color: theme.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '220px'
                }}>
                  {currentUser?.email || 'admin@catavor.com'}
                </span>
              </div>
            </div>

            {/* Right Side: Contextual Options Menu & Primary Action */}
            {headerConfig.showMenu && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                {headerConfig.primaryAction && (
                  <button
                    type="button"
                    onClick={headerConfig.primaryAction.onClick}
                    title={headerConfig.primaryAction.title}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '0.75rem',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                      color: isDark ? '#38bdf8' : '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {headerConfig.primaryAction.icon}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu(true)}
                  title={headerConfig.title || "Menu Opsi"}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MoreVertical size={17} />
                </button>
              </div>
            )}
          </div>
          {/* Header Spacer for Fixed Float & Ideal Content Separation */}
          <div style={{ height: '62px', marginBottom: '0.5rem', flexShrink: 0 }} aria-hidden="true" />
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED EXCLUSIVE SUBPAGE HEADER (When in a specific sub-module)       */}
      {/* ========================================================================= */}
      {activeView !== 'dashboard' && (() => {
        const currentItem = allModules[activeView];
        const isFooterTab = ['reports', 'support', 'finance'].includes(activeView);
        const subStatusText =
          activeView === 'monetization' ? 'Google AdSense & GA4' :
            activeView === 'rbac' ? 'Matriks & Izin Staf' :
              activeView === 'stores' ? `${dormancyMetrics?.active_stores || 1} Toko Terdaftar` :
                activeView === 'reports' ? `${pendingReportsCount} Laporan Pending` :
                  activeView === 'support' ? (actionRequiredTicketsCount > 0 ? `${actionRequiredTicketsCount} Perlu Respon Tim` : (tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length > 0 ? `${tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length} Tiket Aktif` : `${tickets.length} Total Tiket`)) :
                    activeView === 'finance' ? `${pendingOrdersCount} Order Pending` :
                      activeView === 'broadcast' ? `${broadcastActiveCount} Siaran Aktif` :
                        activeView === 'audit' ? `${auditLogs.length} Log Aktivitas` :
                          currentItem?.subtitle || '';

        return (
          <>
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              width: '100%',
              zIndex: 1000,
              boxSizing: 'border-box',
              borderRadius: 0,
              backgroundColor: isDark
                ? 'rgba(15, 23, 42, 0.96)'
                : 'rgba(255, 255, 255, 0.96)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#cbd5e1'}`,
              padding: '0.72rem 1rem',
              boxShadow: isDark
                ? '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 18px rgba(56, 189, 248, 0.18)'
                : '0 8px 25px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0,0,0,0.04)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              {/* Left Side: Brand Logo for Footer Tabs OR Pure Icon Back Button for Secondary Modules / Ticket Detail / Report Moderation */}
              {(isFooterTab && !(activeView === 'support' && selectedTicket) && !(activeView === 'reports' && moderationModalReport)) ? (
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.85rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '3px',
                  flexShrink: 0,
                  boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.05)'
                }}>
                  <img
                    src={appLogoImg || APP_LOGO_BASE64}
                    alt="Catavor Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '0.6rem'
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (activeView === 'reports' && moderationModalReport) {
                      handleCloseModerationPage();
                    } else if (activeView === 'support' && selectedTicket) {
                      handleCloseTicketChat();
                    } else if (activeView === 'broadcast' && broadcastSubViewState !== 'list') {
                      const backEvent = new CustomEvent('catavor:broadcast-request-back', { cancelable: true });
                      window.dispatchEvent(backEvent);
                      if (!backEvent.defaultPrevented) {
                        smartBack(() => handleSwitchView('broadcast'));
                      }
                    } else if (activeView === 'master_data' && masterSubView !== 'menu') {
                      setMasterSubView('menu');
                      updatePlatformUrl('master_data', null, null);
                    } else {
                      handleSwitchView('dashboard');
                    }
                  }}
                  title={
                    activeView === 'reports' && moderationModalReport
                      ? "Kembali ke Antrean Laporan"
                      : activeView === 'support' && selectedTicket
                        ? "Kembali ke Daftar Tiket"
                        : (activeView === 'broadcast' && broadcastSubViewState !== 'list')
                          ? "Kembali ke Riwayat Siaran"
                          : (activeView === 'master_data' && masterSubView !== 'menu')
                            ? "Kembali ke Menu Master"
                            : "Kembali ke Dashboard"
                  }
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '0.75rem',
                    backgroundColor: (activeView === 'broadcast' && broadcastSubViewState !== 'list')
                      ? (isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)')
                      : (isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)'),
                    border: `1px solid ${(activeView === 'broadcast' && broadcastSubViewState !== 'list')
                      ? (isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)')
                      : (isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.2)')}`,
                    color: (activeView === 'broadcast' && broadcastSubViewState !== 'list') ? '#f59e0b' : (isDark ? '#38bdf8' : '#0284c7'),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <ChevronLeft size={19} />
                </button>
              )}

              {/* Center: Module Title & Status (Clean, No Entity Icon) */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, paddingLeft: '0.15rem' }}>
                <h2 style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  margin: 0,
                  color: theme.textPrimary,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {activeView === 'reports' && moderationModalReport
                    ? 'Kelola Laporan'
                    : activeView === 'support' && selectedTicket
                      ? (selectedTicket.ticket_number || `#TCK-${selectedTicket.id}`)
                      : (activeView === 'broadcast' && broadcastSubViewState === 'create')
                        ? 'Buat Siaran Baru'
                        : (activeView === 'broadcast' && broadcastSubViewState === 'edit')
                          ? 'Edit Siaran'
                          : (activeView === 'broadcast' && broadcastSubViewState === 'detail')
                            ? 'Rincian Siaran'
                            : (activeView === 'master_data' && masterSubView === 'domains')
                              ? 'Master Domain Aman'
                              : (activeView === 'master_data' && masterSubView === 'templates')
                                ? 'Template Pesan Cepat'
                                : (activeView === 'master_data' && masterSubView === 'rekber')
                                  ? 'Mitra Rekber Syariah'
                                  : (currentItem?.title || 'Panel Modul')}
                </h2>
                {(() => {
                  const subText = activeView === 'reports' && moderationModalReport
                    ? (moderationModalReport.report_number || `#RPT-${moderationModalReport.id}`)
                    : activeView === 'support' && selectedTicket
                      ? (getStoreDisplayName(selectedTicket) || 'Bantuan Merchant')
                      : (activeView === 'broadcast' && broadcastSubViewState !== 'list')
                        ? ''
                        : (activeView === 'master_data' && masterSubView === 'domains')
                          ? 'Whitelist URL'
                          : (activeView === 'master_data' && masterSubView === 'templates')
                            ? `${cannedTemplates.length} Template CS`
                            : (activeView === 'master_data' && masterSubView === 'rekber')
                              ? 'rekbersyariah.com'
                              : (activeView === 'master_data' && masterSubView === 'menu')
                                ? ''
                                : subStatusText;

                  return subText ? (
                    <span style={{
                      fontSize: '0.67rem',
                      color: theme.textSecondary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 600
                    }}>
                      {subText}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Right: Contextual Quick Actions + Options Menu Button */}
              {(headerConfig.primaryAction || headerConfig.showMenu) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {headerConfig.primaryAction && (
                    <button
                      type="button"
                      onClick={headerConfig.primaryAction.onClick}
                      title={headerConfig.primaryAction.title}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '0.75rem',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                        color: isDark ? '#38bdf8' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {headerConfig.primaryAction.icon}
                    </button>
                  )}
                  {headerConfig.showMenu && (
                    <button
                      type="button"
                      onClick={() => setShowOptionsMenu(true)}
                      title={headerConfig.title || "Menu Opsi"}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '0.75rem',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                        border: `1px solid ${theme.border}`,
                        color: theme.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <MoreVertical size={17} />
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            {/* Header Spacer for Fixed Float & Ideal Content Separation */}
            <div style={{ height: '72px', marginBottom: '0.5rem', flexShrink: 0 }} aria-hidden="true" />
          </>
        );
      })()}

      {/* ========================================================================= */}
      {/* 2.1 EXECUTIVE OPTIONS MENU BOTTOM SHEET (Consolidated Theme, Refresh, etc) */}
      {/* ========================================================================= */}
      {showOptionsMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => {
            setShowOptionsMenu(false);
            setSheetDragY(0);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              borderTop: `1px solid ${theme.borderStrong}`,
              padding: '0.65rem 1.25rem 2.25rem 1.25rem',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              transform: `translateY(${sheetDragY < 0 ? sheetDragY * 0.16 : sheetDragY}px)`,
              transition: isDraggingSheet ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: isDraggingSheet ? 'none' : 'slideUp 0.25s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Interactive Drag Handle (Drag Up/Down to Dismiss) */}
            <div
              onTouchStart={handleTouchStart}
              onMouseDown={handleTouchStart}
              style={{
                width: '100%',
                padding: '0.35rem 0 0.65rem 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDraggingSheet ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
            >
              <div style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#cbd5e1'
              }} />
            </div>

            {/* Header Sheet Title & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.45rem', borderBottom: `1px solid ${theme.border}` }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary }}>
                  {headerConfig.title || 'Opsi Modul'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary }}>
                  {headerConfig.subtitle || 'Aksi dan utilitas modul'}
                </p>
              </div>
            </div>

            {/* Menu Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Contextual Action Items */}
              {headerConfig.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    item.onClick();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.9rem',
                    backgroundColor: item.variant === 'danger'
                      ? (isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)')
                      : theme.cardAlt,
                    border: item.variant === 'danger'
                      ? (isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)')
                      : `1px solid ${theme.border}`,
                    color: item.variant === 'danger' ? '#ef4444' : theme.textPrimary,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.7rem',
                      backgroundColor: item.iconBg || (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)'),
                      color: item.iconColor || (isDark ? '#38bdf8' : '#0284c7'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '0.68rem', color: item.variant === 'danger' ? '#ef4444' : theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.badge && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', flexShrink: 0 }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}

              {/* Global Utilities Divider & Items */}
              {headerConfig.includeGlobalUtilities !== false && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.4rem 0 0.1rem 0' }}>
                    <div style={{ height: '1px', flex: 1, backgroundColor: theme.border }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', color: theme.textMuted, textTransform: 'uppercase' }}>
                      Utilitas Eksekutif
                    </span>
                    <div style={{ height: '1px', flex: 1, backgroundColor: theme.border }} />
                  </div>

                  {/* Toggle Theme Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                      setShowOptionsMenu(false);
                      showToast(`Tema dialihkan ke mode ${isDark ? 'terang' : 'gelap'}`, 'info');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.9rem',
                      backgroundColor: theme.cardAlt,
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '0.7rem',
                        backgroundColor: isDark ? 'rgba(250, 204, 21, 0.15)' : 'rgba(250, 204, 21, 0.1)',
                        color: isDark ? '#facc15' : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                          {isDark ? 'Mode Terang (Light Mode)' : 'Mode Gelap (Dark Mode)'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                          Ubah tampilan visual panel admin
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8' }}>Ganti</span>
                  </button>

                  {/* Logout Action */}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        onLogout();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.9rem',
                        borderRadius: '0.9rem',
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                        border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.7rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <LogOut size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ef4444' }}>Keluar Akun Admin</div>
                          <div style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                            Akhiri sesi pengelolaan platform
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444' }}>Keluar</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DASHBOARD VIEW: METRICS STRIP + 2-COLUMN APP CARD GRID (2x4 / 8 Cards) */}
      {/* ========================================================================= */}
      {activeView === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Metrics Strip */}
          {(canAccessCompliance || canAccessFinance || canAccessSupport) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
              gap: '0.45rem',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {canAccessCompliance && (
                <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.2rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, minWidth: 0, boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Toko</span>
                  <strong style={{ fontSize: '1.1rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, display: 'block' }}>{dormancyMetrics?.active_stores ?? 0}</strong>
                </div>
              )}
              {canAccessFinance && (
                <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.2rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, minWidth: 0, boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Order</span>
                  <strong style={{ fontSize: '1.1rem', color: isDark ? '#34d399' : '#059669', fontWeight: 900, display: 'block' }}>{financeSummary.total}</strong>
                </div>
              )}
              {canAccessCompliance && (
                <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.2rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, minWidth: 0, boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Laporan</span>
                  <strong style={{ fontSize: '1.1rem', color: pendingReportsCount > 0 ? '#f43f5e' : (isDark ? '#fbbf24' : '#d97706'), fontWeight: 900, display: 'block' }}>{reports.length}</strong>
                </div>
              )}
              {canAccessSupport && (
                <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.2rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow, minWidth: 0, boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tiket</span>
                  <strong style={{ fontSize: '1.1rem', color: openTicketsCount > 0 ? '#06b6d4' : theme.textPrimary, fontWeight: 900, display: 'block' }}>{tickets.length}</strong>
                </div>
              )}
            </div>
          )}

          {/* Executive Operational Action Center / Perlu Tindakan Administrator */}
          <div style={{
            padding: '1rem 1.1rem',
            borderRadius: '1.25rem',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
            border: (pendingReportsCount > 0 || actionRequiredTicketsCount > 0 || openTicketsCount > 0 || pendingOrdersCount > 0)
              ? (isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(239, 68, 68, 0.25)')
              : `1px solid ${theme.border}`,
            boxShadow: theme.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.65rem',
                  backgroundColor: (pendingReportsCount > 0 || actionRequiredTicketsCount > 0 || openTicketsCount > 0 || pendingOrdersCount > 0)
                    ? 'rgba(239, 68, 68, 0.15)'
                    : (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'),
                  color: (pendingReportsCount > 0 || actionRequiredTicketsCount > 0 || openTicketsCount > 0 || pendingOrdersCount > 0) ? '#ef4444' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {(pendingReportsCount > 0 || actionRequiredTicketsCount > 0 || openTicketsCount > 0 || pendingOrdersCount > 0)
                    ? <AlertTriangle size={17} />
                    : <CheckCircle2 size={17} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.2 }}>
                    Perlu Tindakan Administrator
                  </h4>
                  <span style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                    {(pendingReportsCount + (actionRequiredTicketsCount || openTicketsCount) + pendingOrdersCount) > 0
                      ? `${pendingReportsCount + (actionRequiredTicketsCount || openTicketsCount) + pendingOrdersCount} antrean tugas aktif`
                      : 'Semua antrean operasional telah ditangani'}
                  </span>
                </div>
              </div>

              {(canAccessCompliance ? pendingReportsCount : 0) + (canAccessSupport ? (actionRequiredTicketsCount || openTicketsCount) : 0) + (canAccessFinance ? pendingOrdersCount : 0) > 0 ? (
                <span style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                }}>
                  {(canAccessCompliance ? pendingReportsCount : 0) + (canAccessSupport ? (actionRequiredTicketsCount || openTicketsCount) : 0) + (canAccessFinance ? pendingOrdersCount : 0)} Prioritas
                </span>
              ) : (
                <span style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
                  color: isDark ? '#34d399' : '#059669',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  border: isDark ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid #a7f3d0'
                }}>
                  Terkendali
                </span>
              )}
            </div>

            {/* Action Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {canAccessSupport && (actionRequiredTicketsCount > 0 || openTicketsCount > 0) && (
                <div
                  onClick={() => handleSwitchView('support')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.1)' : '#f0f9ff',
                    border: isDark ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid #bae6fd',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <HelpCircle size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Helpdesk Tiket Merchant
                      </div>
                      <div style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                        {actionRequiredTicketsCount || openTicketsCount} tiket butuh respon tim CS
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7' }}>Buka</span>
                    <ChevronRight size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
                  </div>
                </div>
              )}

              {canAccessCompliance && pendingReportsCount > 0 && (
                <div
                  onClick={() => handleSwitchView('reports')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? 'rgba(244, 63, 94, 0.1)' : '#fff1f2',
                    border: isDark ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid #fecdd3',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(244, 63, 94, 0.25)' : '#ffe4e6',
                      color: isDark ? '#fb7185' : '#e11d48',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <ShieldAlert size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Laporan Pelanggaran
                      </div>
                      <div style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                        {pendingReportsCount} laporan kepatuhan menunggu review
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isDark ? '#fb7185' : '#e11d48' }}>Tinjau</span>
                    <ChevronRight size={14} color={isDark ? '#fb7185' : '#e11d48'} />
                  </div>
                </div>
              )}

              {canAccessFinance && pendingOrdersCount > 0 && (
                <div
                  onClick={() => handleSwitchView('finance')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #a7f3d0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                      color: isDark ? '#34d399' : '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <CreditCard size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Verifikasi Pembayaran Paket
                      </div>
                      <div style={{ fontSize: '0.66rem', color: theme.textSecondary }}>
                        {pendingOrdersCount} bukti transfer menunggu konfirmasi
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isDark ? '#34d399' : '#059669' }}>Proses</span>
                    <ChevronRight size={14} color={isDark ? '#34d399' : '#059669'} />
                  </div>
                </div>
              )}

              {/* State ketika tidak ada tindakan pending */}
              {(pendingReportsCount === 0 && (actionRequiredTicketsCount || openTicketsCount) === 0 && pendingOrdersCount === 0) && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.85rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px dashed ${theme.border}`,
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: '0.72rem'
                }}>
                  Semua tiket dan laporan operasional telah selesai ditangani.
                </div>
              )}
            </div>
          </div>

          {/* Section Heading: Platform & System Management */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.15rem', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Kelola Platform & Sistem
              </h3>
              <span style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Konfigurasi lanjutan dan tata kelola platform</span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: theme.textSecondary,
              backgroundColor: theme.cardAlt,
              border: `1px solid ${theme.border}`,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              flexShrink: 0,
              marginLeft: '0.5rem'
            }}>
              {dashboardGridItems.length} Modul
            </span>
          </div>

          {/* 2-Column Specialized Management Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '0.75rem',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {dashboardGridItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchView(item.id)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '0.95rem 0.85rem',
                  borderRadius: '1.15rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  minHeight: '105px',
                  overflow: 'hidden',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Top of Card: Icon & Badge/Chevron */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.8rem',
                    backgroundColor: item.bg,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${item.border}`,
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {item.badge > 0 && (
                      <span style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '999px',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                      }}>
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={15} style={{ color: theme.textMuted }} />
                  </div>
                </div>

                {/* Bottom of Card: Title & Subtitle */}
                <div style={{ minWidth: 0, width: '100%', overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: theme.textPrimary,
                    marginBottom: '0.15rem',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 500,
                    color: theme.textSecondary,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ACCESS DENIED PANEL ON DIRECT URL BYPASS TO RESTRICTED VIEW */}
      {!isViewPermitted(activeView, caps) && (
        <AccessDeniedPanel
          moduleName={headerConfig?.title || activeView}
          roleSlug={roleSlug}
          isDark={isDark}
          onBack={() => handleSwitchView(getDefaultViewForCapabilities(caps, roleSlug) as ActiveView)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 1: STAF & RBAC MANAGEMENT                                       */}
      {/* ========================================================================= */}
      {activeView === 'rbac' && canAccessRBAC && (
        <ErrorBoundary sectionName="Manajemen Staf & Role RBAC">
          <AdminRBACManagement
            token={token}
            currentUserEmail={currentUser?.email}
            currentUserId={currentUser?.id}
            canMutate={caps.isSuperAdmin}
            themeMode={themeMode}
            hideHeader={true}
          />
        </ErrorBoundary>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 2: TATA KELOLA TOKO & DORMANSI                                  */}
      {/* ========================================================================= */}
      {activeView === 'stores' && canAccessCompliance && (
        <AdminStoresManagement
          token={token}
          themeMode={themeMode}
          onNavigateToTab={(tab: string) => setActiveView(tab as any)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 3: LAPORAN PELANGGARAN & COMPLIANCE MODERATION                  */}
      {/* ========================================================================= */}
      {activeView === 'reports' && canAccessCompliance && (
        moderationModalReport ? (
          /* ========================================================================= */
          /* 3A. DEDICATED REPORT MODERATION & ENFORCEMENT ACTION PAGE                */
          /* ========================================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '0' }}>
            {/* Section 1: Entity Profile & Evidence Card */}
            <div style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)'
            }}>
              {/* Card Meta Row: Target Badge + Ticket + Inspeksi Publik */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '0.22rem 0.55rem',
                    borderRadius: '0.45rem',
                    backgroundColor: moderationModalReport.target_type === 'catalog' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                    color: moderationModalReport.target_type === 'catalog' ? (isDark ? '#c084fc' : '#9333ea') : (isDark ? '#38bdf8' : '#0ea5e9'),
                    border: `1px solid ${moderationModalReport.target_type === 'catalog' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(14, 165, 233, 0.3)'}`,
                    letterSpacing: '0.02em'
                  }}>
                    {moderationModalReport.target_type === 'catalog' ? 'PROFIL KATALOG' : 'ITEM KATALOG'}
                  </span>
                  {moderationModalReport.target_type === 'item' && (
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      padding: '0.22rem 0.55rem',
                      borderRadius: '0.45rem',
                      backgroundColor: 'rgba(14, 165, 233, 0.12)',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`,
                      letterSpacing: '0.02em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Tag size={11} />
                      {formatCatalogType(moderationModalReport.item_type || moderationModalReport.fauna?.product_type || moderationModalReport.product_type)}
                    </span>
                  )}
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: theme.textSecondary,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.45rem',
                    border: `1px solid ${theme.border}`
                  }}>
                    {moderationModalReport.report_number || `#RPT-${moderationModalReport.id}`}
                  </span>
                </div>

                {moderationModalReport.store_slug && (
                  <a
                    href={`/${moderationModalReport.store_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '0.55rem',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)'}`,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      flexShrink: 0
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Inspeksi Publik</span>
                  </a>
                )}
              </div>

              {/* Entity Title */}
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: theme.textMuted, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Entitas Terlapor
                </div>
                <div style={{
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  lineHeight: 1.35
                }}>
                  {moderationModalReport.target_type === 'item' ? (
                    <>
                      <Package size={17} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: '2px' }} />
                      <span>{moderationModalReport.item_name || 'Item Tanpa Nama'}</span>
                    </>
                  ) : (
                    <>
                      <Store size={17} style={{ color: '#a855f7', flexShrink: 0, marginTop: '2px' }} />
                      <span>{moderationModalReport.store_title || moderationModalReport.store_slug || 'Profil Katalog'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem 1rem',
                padding: '0.85rem',
                borderRadius: '0.75rem',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.border}`
              }}>
                <div>
                  <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Profil Bisnis / Usaha</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, wordBreak: 'break-word' }}>
                    {moderationModalReport.store_title || moderationModalReport.store_slug || 'Katalog'}
                  </span>
                </div>
                {moderationModalReport.target_type === 'item' ? (
                  <div>
                    <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Jenis / Tipe Katalog</span>
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: isDark ? '#38bdf8' : '#0284c7',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.1)',
                      padding: '0.12rem 0.5rem',
                      borderRadius: '0.4rem',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      width: 'fit-content'
                    }}>
                      <Tag size={11} />
                      {formatCatalogType(moderationModalReport.item_type || moderationModalReport.fauna?.product_type || moderationModalReport.product_type)}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Jenis Entitas</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary }}>
                      Profil Katalog Lengkap
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Kategori Pelanggaran</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f43f5e', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {moderationModalReport.reason_label || moderationModalReport.reason_category || 'Lainnya'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Status Peninjauan</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary }}>
                    {formatReportStatusLabel(moderationModalReport.status)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Email Pelapor</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: theme.textSecondary, wordBreak: 'break-all' }}>
                    {moderationModalReport.reporter_email || '-'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', marginBottom: '0.15rem' }}>Alamat IP Pelapor</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: theme.textSecondary }}>
                    {moderationModalReport.reporter_ip || '-'}
                  </span>
                </div>
              </div>

              {/* Evidence Quote */}
              {moderationModalReport.description && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.04)',
                  border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.15)'}`
                }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f43f5e', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertCircle size={13} />
                    <span>Kutipan Barang Bukti & Keluhan Pelapor:</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: theme.textPrimary, lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{moderationModalReport.description}"
                  </p>
                </div>
              )}

              {/* Multi-Reporter Active Evidence Timeline */}
              {reportActiveEvidence && reportActiveEvidence.length > 0 && (
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} />
                      <span>{reportActiveEvidence.length} Laporan Lain untuk Entitas Ini</span>
                    </div>
                    <span style={{ fontSize: '0.64rem', padding: '0.1rem 0.4rem', borderRadius: '0.35rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 800 }}>
                      KASUS JAMAK
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                    Pengguna lain juga melaporkan entitas ini. Menindak kasus ini akan otomatis memperbarui seluruh laporan terkait.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                    {reportActiveEvidence.map((ae: any, idx: number) => (
                      <div key={ae.id || idx} style={{
                        padding: '0.65rem',
                        borderRadius: '0.6rem',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.textPrimary }}>
                            {ae.report_number || `#RPT-${ae.id}`}
                          </span>
                          <span style={{ color: theme.textMuted }}>
                            {ae.created_at ? new Date(ae.created_at).toLocaleString('id-ID') : '-'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f43f5e' }}>
                          {ae.reason_label || ae.reason_category}
                        </div>
                        {ae.description && (
                          <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontStyle: 'italic', lineHeight: 1.35 }}>
                            "{ae.description}"
                          </div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                          Pelapor: {ae.reporter_email || ae.reporter_ip || 'Anonim'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prior Review History Ledger (Audit Context) */}
              {reportPriorHistory && reportPriorHistory.length > 0 && (
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(14, 165, 233, 0.04)',
                  border: `1px solid ${isDark ? 'rgba(14, 165, 233, 0.25)' : 'rgba(14, 165, 233, 0.18)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={14} />
                    <span>Rekam Jejak Peninjauan Terdahulu ({reportPriorHistory.length})</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.35 }}>
                    Entitas ini pernah dilaporkan dan diselesaikan sebelumnya:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {reportPriorHistory.map((ph: any, pidx: number) => (
                      <div key={ph.id || pidx} style={{
                        padding: '0.55rem 0.65rem',
                        borderRadius: '0.55rem',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                        border: `1px solid ${theme.border}`,
                        fontSize: '0.7rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: theme.textPrimary }}>
                            {ph.report_number || `#RPT-${ph.id}`} • Status: <strong style={{ color: ph.status === 'dismissed' ? '#94a3b8' : (ph.status === 'action_taken' ? '#f43f5e' : '#10b981') }}>{formatReportStatusLabel(ph.status)}</strong>
                          </span>
                          <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                            {ph.reviewed_at ? new Date(ph.reviewed_at).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>
                        {ph.action_taken && ph.action_taken !== 'none' && (
                          <div style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: 700 }}>
                            Sanksi Diterapkan: {formatReportActionLabel(ph.action_taken)}
                          </div>
                        )}
                        {ph.admin_notes && (
                          <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontStyle: 'italic' }}>
                            Catatan Admin: "{ph.admin_notes}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Update Status Laporan */}
            <div style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={16} style={{ color: '#f59e0b' }} />
                  <span>Status Peninjauan Laporan</span>
                </h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: theme.textMuted }}>
                  Tentukan status progres investigasi laporan kepatuhan ini.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.55rem' }}>
                {[
                  { value: 'investigating', label: 'Investigasi Aktif', color: '#f59e0b', desc: 'Audit sedang berjalan & verifikasi bukti' },
                  { value: 'action_taken', label: 'Sanksi Sementara', color: '#f43f5e', desc: 'Penangguhan sementara / peringatan dijatuhkan' },
                  { value: 'banned', label: 'Banned Permanen', color: '#ef4444', desc: 'Sanksi final pemblokiran permanen katalog & akun' },
                  { value: 'resolved', label: 'Selesai & Pulih', color: '#10b981', desc: 'Kasus selesai & sanksi dipulihkan' },
                  { value: 'dismissed', label: 'Ditolak (Dismiss)', color: '#64748b', desc: 'Laporan tidak valid atau palsu' }
                ].map(opt => {
                  const isSelected = moderationStatus === opt.value;
                  const isItem = moderationModalReport?.target_type === 'item';
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setModerationStatus(opt.value);
                        if (opt.value === 'banned') {
                          if (isItem) {
                            setModerationAction('item_banned');
                          } else {
                            setModerationAction('catalog_banned');
                          }
                        } else if (opt.value === 'action_taken') {
                          if (isItem && (moderationAction === 'none' || moderationAction === 'item_banned' || moderationAction === 'item_restored')) {
                            setModerationAction('item_locked');
                          } else if (!isItem && (moderationAction === 'none' || moderationAction === 'catalog_banned' || moderationAction === 'catalog_reactivated')) {
                            setModerationAction('catalog_suspended');
                          }
                        } else if (opt.value === 'resolved') {
                          if (isItem && (moderationAction === 'item_locked' || moderationAction === 'item_needs_fix' || moderationAction === 'item_banned')) {
                            setModerationAction('item_restored');
                          } else if (!isItem && (moderationAction === 'catalog_suspended' || moderationAction === 'catalog_banned')) {
                            setModerationAction('catalog_reactivated');
                          }
                        } else if (opt.value === 'dismissed') {
                          setModerationAction('none');
                        } else if (opt.value === 'investigating') {
                          if (moderationAction === 'item_banned' || moderationAction === 'catalog_banned') {
                            setModerationAction('none');
                          }
                        }
                      }}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        border: isSelected ? `2px solid ${opt.color}` : `1px solid ${theme.border}`,
                        backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)') : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? opt.color : theme.textPrimary }}>
                          {opt.label}
                        </span>
                        {isSelected && (
                          <CheckCircle2 size={15} style={{ color: opt.color }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.67rem', color: theme.textMuted, lineHeight: 1.35 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Tindakan Penegakan Sistem (Real-time Enforcement) */}
            <div style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={16} style={{ color: '#f43f5e' }} />
                  <span>Tindakan Penegakan Sistem (Real-time Enforcement)</span>
                </h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: theme.textMuted }}>
                  Sistem akan secara instan mengubah status database katalog/item dan mencatat audit trail.
                </p>
              </div>

              {/* Dropdown Modal Trigger */}
              {(() => {
                const getModerationActionConfig = (action: string) => {
                  switch (action) {
                    case 'warning_issued':
                      return {
                        label: 'Terbitkan Peringatan Resmi',
                        desc: 'Notifikasi peringatan kepatuhan dikirim ke pengelola katalog',
                        icon: AlertTriangle,
                        color: '#f59e0b',
                        badge: 'PERINGATAN',
                        badgeColor: '#f59e0b'
                      };
                    case 'item_needs_fix':
                      return {
                        label: 'Nonaktifkan: Beri Kesempatan Edit & Perbaiki',
                        desc: 'Disembunyikan, pengelola diizinkan edit data untuk diajukan ulang',
                        icon: AlertTriangle,
                        color: '#f59e0b',
                        badge: 'PERLU EDIT',
                        badgeColor: '#f59e0b'
                      };
                    case 'item_locked':
                    case 'item_hidden':
                      return {
                        label: 'Nonaktifkan & Kunci: Pelanggaran Keras',
                        desc: 'Disembunyikan & kunci edit (read-only), hanya klarifikasi banding atau hapus',
                        icon: XCircle,
                        color: '#ef4444',
                        badge: 'TERKUNCI',
                        badgeColor: '#ef4444'
                      };
                    case 'item_banned':
                      return {
                        label: 'Blokir & Hapus Item (Banned Permanen)',
                        desc: 'Hapus permanen dari inventaris katalog & pulihkan kuota pengelola seketika',
                        icon: ShieldAlert,
                        color: '#ef4444',
                        badge: 'BANNED ITEM',
                        badgeColor: '#ef4444'
                      };
                    case 'item_restored':
                      return {
                        label: 'Pulihkan / Aktifkan Item',
                        desc: 'Item dipulihkan dan dapat kembali diakses publik',
                        icon: CheckCircle2,
                        color: '#10b981',
                        badge: 'AKTIF',
                        badgeColor: '#10b981'
                      };
                    case 'catalog_suspended':
                      return {
                        label: 'Bekukan / Suspend Profil Katalog',
                        desc: 'Seluruh etalase profil katalog dibekukan dari akses publik',
                        icon: Lock,
                        color: '#dc2626',
                        badge: 'SUSPEND',
                        badgeColor: '#dc2626'
                      };
                    case 'catalog_banned':
                      return {
                        label: 'Blokir / Banned Permanen Profil Katalog',
                        desc: 'Tutup akses publik profil katalog dan akun pemilik secara permanen',
                        icon: ShieldAlert,
                        color: '#b91c1c',
                        badge: 'BANNED',
                        badgeColor: '#b91c1c'
                      };
                    case 'catalog_reactivated':
                      return {
                        label: 'Pulihkan / Aktifkan Profil Katalog',
                        desc: 'Cabut sanksi penangguhan dan buka etalase profil katalog',
                        icon: Store,
                        color: '#10b981',
                        badge: 'PULIHKAN',
                        badgeColor: '#10b981'
                      };
                    case 'none':
                    default:
                      return {
                        label: 'Tanpa Sanksi Otomatis',
                        desc: 'Hanya mencatat investigasi tanpa mengubah status',
                        icon: FileText,
                        color: theme.textSecondary,
                        badge: 'CATATAN',
                        badgeColor: '#64748b'
                      };
                  }
                };

                const activeCfg = getModerationActionConfig(moderationAction);
                const ActiveIcon = activeCfg.icon;
                const isItem = moderationModalReport.target_type === 'item';

                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const actionOptions: Array<{
                          value: string;
                          label: string;
                          desc: string;
                        }> = [
                            {
                              value: 'none',
                              label: 'Tanpa Sanksi Otomatis',
                              desc: 'Catat temuan investigasi & perbarui status tanpa sanksi otomatis pada profil katalog maupun item'
                            },
                            {
                              value: 'warning_issued',
                              label: 'Terbitkan Peringatan Resmi',
                              desc: 'Kirim surat notifikasi peringatan resmi kepatuhan ke pengelola katalog'
                            },
                            ...(isItem ? [
                              {
                                value: 'item_needs_fix',
                                label: 'Nonaktifkan: Beri Kesempatan Edit & Perbaiki',
                                desc: 'Sembunyikan dari publik namun pengelola diizinkan mengedit foto/deskripsi/spesifikasi untuk diajukan ulang'
                              },
                              {
                                value: 'item_locked',
                                label: 'Nonaktifkan & Kunci: Pelanggaran Kebijakan Keras',
                                desc: 'Sembunyikan dari publik dan kunci fitur edit (read-only) karena indikasi pelanggaran kebijakan keras/fatal. Hanya banding atau hapus'
                              },
                              {
                                value: 'item_banned',
                                label: 'Blokir atau Hapus Item (Banned Permanen)',
                                desc: 'Hapus permanen dari inventaris katalog & pulihkan kuota pengelola seketika. Bukti forensik disimpan 90 hari tanpa hak banding'
                              },
                              {
                                value: 'item_restored',
                                label: 'Pulihkan / Aktifkan Item',
                                desc: 'Memulihkan item agar dapat kembali dilihat dan diakses publik secara normal'
                              }
                            ] : []),
                            ...(canSuspendStores ? [
                              {
                                value: 'catalog_suspended',
                                label: 'Bekukan / Suspend Profil Katalog',
                                desc: 'Seluruh etalase profil katalog dan item dibekukan sementara dari akses publik secara real-time'
                              },
                              {
                                value: 'catalog_banned',
                                label: 'Blokir / Banned Permanen Profil Katalog',
                                desc: 'Nonaktifkan akses publik profil katalog dan akun pemilik secara permanen karena pelanggaran berat atau kegagalan banding'
                              },
                              {
                                value: 'catalog_reactivated',
                                label: 'Pulihkan / Aktifkan Profil Katalog',
                                desc: 'Cabut status penangguhan dan buka kembali akses publik seluruh etalase profil katalog'
                              },
                            ] : [])
                          ];

                        setCrudDropdownPicker({
                          title: 'Tindakan Penegakan Sistem',
                          subtitle: 'Pilih sanksi atau tindakan kepatuhan yang akan dieksekusi secara real-time',
                          icon: ShieldAlert,
                          selectedValue: moderationAction,
                          options: actionOptions,
                          onSelect: (val) => {
                            setModerationAction(val);
                            if (val === 'item_banned' || val === 'catalog_banned') {
                              setModerationStatus('banned');
                            } else if (val === 'item_locked' || val === 'item_needs_fix' || val === 'catalog_suspended' || val === 'warning_issued') {
                              if (moderationStatus !== 'banned') {
                                setModerationStatus('action_taken');
                              }
                            } else if (val === 'item_restored' || val === 'catalog_reactivated') {
                              setModerationStatus('resolved');
                            }
                          }
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '0.8rem 0.95rem',
                        borderRadius: '0.75rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: theme.inputBg,
                        color: theme.textPrimary,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.18s ease, box-shadow 0.18s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '0.55rem',
                          backgroundColor: `${activeCfg.badgeColor}18`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: activeCfg.color,
                          flexShrink: 0
                        }}>
                          <ActiveIcon size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: theme.textPrimary
                          }}>
                            {activeCfg.label}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            color: theme.textMuted,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {activeCfg.desc}
                          </span>
                        </div>
                      </div>
                      <ChevronDown size={17} color={theme.textMuted} style={{ flexShrink: 0 }} />
                    </button>
                  </div>
                );
              })()}

              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.7rem',
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.05)',
                border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.15)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Info size={15} style={{ color: isDark ? '#38bdf8' : '#0284c7', flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                  Eksekusi sanksi bersifat seketika (instan). Pemilik toko akan melihat status item/katalog terbarui di portal mereka.
                </span>
              </div>
            </div>

            {/* Section 4: Catatan Kepatuhan & Audit (Admin Notes) */}
            <div style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={16} style={{ color: '#0ea5e9' }} />
                  <span>Catatan Kepatuhan & Audit (Admin Notes)</span>
                </h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: theme.textMuted }}>
                  Dokumentasikan temuan investigasi, nomor tiket referensi, atau alasan keputusan untuk audit internal.
                </p>
              </div>

              <textarea
                value={moderationNotes}
                onChange={e => setModerationNotes(e.target.value)}
                rows={4}
                placeholder="Tuliskan temuan audit, riwayat kontak penjual, alasan sanksi atau dasar penolakan laporan..."
                style={{
                  width: '100%',
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.inputBg,
                  color: theme.textPrimary,
                  fontSize: '0.8rem',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: 1.5
                }}
              />

              {moderationModalReport.reviewed_by && (
                <div style={{ fontSize: '0.7rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <User size={12} />
                  <span>Terakhir ditinjau oleh Admin ID: <strong>{moderationModalReport.reviewed_by}</strong></span>
                  {moderationModalReport.reviewed_at && (
                    <span>pada {new Date(moderationModalReport.reviewed_at).toLocaleDateString('id-ID')}</span>
                  )}
                </div>
              )}
            </div>

            {/* Section 5: Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              paddingTop: '0.5rem'
            }}>
              <button
                type="button"
                onClick={handleCloseModerationPage}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: 'transparent',
                  color: theme.textSecondary,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingModeration || !canManageReports}
                onClick={() => {
                  if (!canManageReports) {
                    showToast('Akun Anda tidak memiliki wewenang penegakan sanksi laporan (compliance:reports:manage)', 'error');
                    return;
                  }
                  if (moderationAction === 'item_banned' || moderationAction === 'catalog_banned' || moderationAction === 'account_banned' || moderationStatus === 'banned') {
                    setBannedConfirmModalReport(moderationModalReport);
                    setBannedConfirmAcknowledged(false);
                    setShowModerationConfirmModal(true);
                  } else {
                    handleUpdateReportStatus(
                      moderationModalReport.id,
                      moderationStatus,
                      moderationAction,
                      moderationNotes,
                      true
                    );
                  }
                }}
                style={{
                  flex: 2,
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  backgroundColor: !canManageReports ? (isDark ? '#334155' : '#94a3b8') : '#f43f5e',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: (isSubmittingModeration || !canManageReports) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  opacity: (isSubmittingModeration || !canManageReports) ? 0.7 : 1,
                  boxShadow: !canManageReports ? 'none' : '0 4px 16px rgba(244, 63, 94, 0.35)'
                }}
              >
                {isSubmittingModeration ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                <span>{!canManageReports ? 'Mode Hanya Baca' : 'Terapkan Tindakan'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3B. ANTREAN & DAFTAR LAPORAN PELANGGARAN                                  */
          /* ========================================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {/* Quick Metrics Bar (4 Columns with Dedicated Banned Metric) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
              <div data-testid="mobile-metric-pending" style={{ padding: '0.55rem 0.65rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.62rem', color: theme.textSecondary, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Menunggu</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>
                  {reportMetrics ? (reportMetrics.pending || 0) : reports.filter(r => r.status === 'pending').length}
                </span>
              </div>
              <div data-testid="mobile-metric-investigating" style={{ padding: '0.55rem 0.65rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.62rem', color: theme.textSecondary, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Investigasi</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
                  {reportMetrics ? ((reportMetrics.investigating || 0) + (reportMetrics.re_review || 0)) : reports.filter(r => r.status === 'investigating' || r.status === 'in_review' || r.status === 're_review').length}
                </span>
              </div>
              <div data-testid="mobile-metric-action" style={{ padding: '0.55rem 0.65rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.62rem', color: theme.textSecondary, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sanksi Aktif</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f43f5e' }}>
                  {reportMetrics ? (reportMetrics.action_taken || 0) : reports.filter(r => (r.status === 'action_taken' || (r.action_taken && r.action_taken !== 'none')) && r.status !== 'banned' && r.action_taken !== 'catalog_banned').length}
                </span>
              </div>
              <div data-testid="mobile-metric-banned" style={{ padding: '0.55rem 0.65rem', borderRadius: '0.85rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.62rem', color: theme.textSecondary, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Banned</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
                  {reportMetrics ? (reportMetrics.banned || 0) : reports.filter(r => r.status === 'banned' || r.action_taken === 'catalog_banned').length}
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
              <input
                type="text"
                placeholder="Cari nomor tiket (#RPT-...), toko, item, atau email..."
                value={reportsSearchQuery}
                onChange={(e) => setReportsSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.surface,
                  color: theme.textPrimary,
                  fontSize: '0.78rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Mobile Native Dropdowns for Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <MobileCustomSelect
                value={reportsFilter}
                onChange={(val) => setReportsFilter(val as any)}
                options={mobileReportStatusOptions}
                title="Status Laporan Kepatuhan"
                subtitle="Filter berdasarkan status penanganan"
                placeholder="Filter Status Laporan"
                icon={<ShieldAlert size={15} />}
              />

              <MobileCustomSelect
                value={reportsTargetFilter}
                onChange={(val) => setReportsTargetFilter(val as any)}
                options={mobileReportTargetOptions}
                title="Target Laporan"
                subtitle="Filter item atau katalog merchant"
                placeholder="Filter Target"
                icon={<Layers size={15} />}
              />
            </div>

            {/* Filtered Reports Feed */}
            {reports
              .filter(r => {
                if (reportsFilter !== 'all') {
                  if (reportsFilter === 'investigating') {
                    if (r.status !== 'investigating' && r.status !== 'in_review') return false;
                  } else if (reportsFilter === 're_review') {
                    if (r.status !== 're_review') return false;
                  } else if (reportsFilter === 'banned') {
                    if (r.status !== 'banned' && r.action_taken !== 'catalog_banned') return false;
                  } else if (reportsFilter === 'action_taken') {
                    if (r.status !== 'action_taken' || r.action_taken === 'catalog_banned' || r.status === 'banned') return false;
                  } else if (r.status !== reportsFilter) {
                    return false;
                  }
                }
                if (reportsTargetFilter !== 'all') {
                  const isCatalog = r.target_type === 'catalog' || r.target_type === 'store';
                  if (reportsTargetFilter === 'catalog' && !isCatalog) return false;
                  if (reportsTargetFilter === 'item' && isCatalog) return false;
                }
                if (reportsSearchQuery.trim()) {
                  const q = reportsSearchQuery.toLowerCase();
                  const num = (r.report_number || '').toLowerCase();
                  const store = (r.store_title || r.store_slug || '').toLowerCase();
                  const item = (r.item_name || '').toLowerCase();
                  const reason = (r.reason_label || r.reason_category || '').toLowerCase();
                  const email = (r.reporter_email || '').toLowerCase();
                  if (!num.includes(q) && !store.includes(q) && !item.includes(q) && !reason.includes(q) && !email.includes(q)) {
                    return false;
                  }
                }
                return true;
              })
              .length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
                <ShieldCheck size={36} color="#10b981" style={{ margin: '0 auto 0.65rem' }} />
                <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Laporan Ditemukan</h4>
                <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>
                  {reportsSearchQuery ? 'Tidak ada laporan yang sesuai dengan kriteria pencarian.' : 'Seluruh toko dan item mematuhi aturan kepatuhan platform.'}
                </p>
              </div>
            ) : (
              reports
                .filter(r => {
                  if (reportsFilter !== 'all') {
                    if (reportsFilter === 'investigating') {
                      if (r.status !== 'investigating' && r.status !== 'in_review') return false;
                    } else if (reportsFilter === 're_review') {
                      if (r.status !== 're_review') return false;
                    } else if (reportsFilter === 'banned') {
                      if (r.status !== 'banned' && r.action_taken !== 'catalog_banned') return false;
                    } else if (reportsFilter === 'action_taken') {
                      if (r.status !== 'action_taken' || r.action_taken === 'catalog_banned' || r.status === 'banned') return false;
                    } else if (r.status !== reportsFilter) {
                      return false;
                    }
                  }
                  if (reportsTargetFilter !== 'all') {
                    const isCatalog = r.target_type === 'catalog' || r.target_type === 'store';
                    if (reportsTargetFilter === 'catalog' && !isCatalog) return false;
                    if (reportsTargetFilter === 'item' && isCatalog) return false;
                  }
                  if (reportsSearchQuery.trim()) {
                    const q = reportsSearchQuery.toLowerCase();
                    const num = (r.report_number || '').toLowerCase();
                    const store = (r.store_title || r.store_slug || '').toLowerCase();
                    const item = (r.item_name || '').toLowerCase();
                    const reason = (r.reason_label || r.reason_category || '').toLowerCase();
                    const email = (r.reporter_email || '').toLowerCase();
                    if (!num.includes(q) && !store.includes(q) && !item.includes(q) && !reason.includes(q) && !email.includes(q)) {
                      return false;
                    }
                  }
                  return true;
                })
                .map(r => {
                  const isCatalog = r.target_type === 'catalog' || r.target_type === 'store';
                  const statusBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                    pending: { label: 'Menunggu Review', bg: 'rgba(245, 158, 11, 0.15)', text: isDark ? '#fbbf24' : '#d97706', border: 'rgba(245, 158, 11, 0.35)' },
                    investigating: { label: 'Investigasi', bg: 'rgba(56, 189, 248, 0.15)', text: isDark ? '#38bdf8' : '#0284c7', border: 'rgba(56, 189, 248, 0.35)' },
                    in_review: { label: 'Investigasi', bg: 'rgba(56, 189, 248, 0.15)', text: isDark ? '#38bdf8' : '#0284c7', border: 'rgba(56, 189, 248, 0.35)' },
                    re_review: { label: 'Revisi Masuk', bg: 'rgba(16, 185, 129, 0.18)', text: isDark ? '#34d399' : '#059669', border: 'rgba(16, 185, 129, 0.45)' },
                    action_taken: { label: 'Ditindak Sanksi', bg: 'rgba(244, 63, 94, 0.15)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.35)' },
                    banned: { label: 'Banned Permanen', bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.55)' },
                    dismissed: { label: 'Laporan Ditolak', bg: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)', text: isDark ? '#94a3b8' : '#64748b', border: 'rgba(148, 163, 184, 0.25)' },
                    resolved: { label: 'Selesai', bg: 'rgba(16, 185, 129, 0.15)', text: isDark ? '#34d399' : '#059669', border: 'rgba(16, 185, 129, 0.35)' }
                  };
                  const currentBadge = (r.status === 'banned' || r.action_taken === 'catalog_banned')
                    ? statusBadgeMap.banned
                    : (statusBadgeMap[r.status] || statusBadgeMap.pending);

                  const hasAction = r.action_taken && r.action_taken !== 'none';
                  const isRestored = hasAction && (r.action_taken.includes('restored') || r.action_taken.includes('reactivated'));
                  const actionLabel = r.action_taken === 'item_banned'
                    ? 'Item Dibanned Permanen'
                    : r.action_taken === 'item_needs_fix'
                      ? 'Perlu Perbaikan'
                      : (r.action_taken === 'item_locked' || r.action_taken === 'item_hidden')
                        ? 'Item Dikunci'
                        : r.action_taken === 'catalog_suspended'
                          ? 'Katalog Dibekukan'
                          : r.action_taken === 'catalog_banned'
                            ? 'Katalog Dibanned Permanen'
                            : r.action_taken === 'warning_issued'
                              ? 'Diberi Peringatan'
                              : r.action_taken === 'item_restored'
                                ? 'Item Dipulihkan'
                                : (r.action_taken || '');

                  const isItemBanned = r.status === 'banned' || r.action_taken === 'catalog_banned' || r.action_taken === 'item_banned';

                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '0.95rem',
                        backgroundColor: theme.surface,
                        border: isItemBanned
                          ? '1px solid rgba(239, 68, 68, 0.55)'
                          : (r.status === 're_review'
                            ? '1px solid rgba(16, 185, 129, 0.65)'
                            : (r.status === 'pending'
                              ? '1px solid rgba(245, 158, 11, 0.4)'
                              : (r.status === 'action_taken' ? '1px solid rgba(244, 63, 94, 0.4)' : `1px solid ${theme.border}`))),
                        boxShadow: isItemBanned
                          ? '0 4px 14px rgba(239, 68, 68, 0.12)'
                          : (r.status === 're_review' ? '0 4px 14px rgba(16, 185, 129, 0.12)' : theme.cardShadow),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                      }}
                    >
                      {/* Header Row: Ticket # + Target Type Pill + Date & Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: theme.textPrimary,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '0.4rem',
                            border: `1px solid ${theme.border}`
                          }}>
                            {r.report_number || `#RPT-${r.id}`}
                          </span>

                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '0.4rem',
                            backgroundColor: isCatalog ? 'rgba(168, 85, 247, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                            color: isCatalog ? (isDark ? '#c084fc' : '#9333ea') : (isDark ? '#38bdf8' : '#0284c7'),
                            border: `1px solid ${isCatalog ? 'rgba(168, 85, 247, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`
                          }}>
                            {isCatalog ? 'PROFIL KATALOG' : 'ITEM KATALOG'}
                          </span>

                          {!isCatalog && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.4rem',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                              color: theme.textSecondary,
                              border: `1px solid ${theme.border}`
                            }}>
                              {formatCatalogType(r.item_type || r.fauna?.product_type)}
                            </span>
                          )}

                          <span style={{ fontSize: '0.66rem', color: theme.textMuted }}>
                            • {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : 'Baru'}
                          </span>
                        </div>

                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          backgroundColor: currentBadge.bg,
                          color: currentBadge.text,
                          border: `1px solid ${currentBadge.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          {currentBadge.label}
                        </span>
                      </div>

                      {/* Middle Row: Entity Target & Violation Tags */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '0.55rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isCatalog ? <Store size={16} color="var(--primary)" /> : <Package size={16} color="var(--primary)" />}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.25 }}>
                              {isCatalog
                                ? (r.store_title || `Katalog /${r.store_slug}`)
                                : (r.item_name || 'Item Produk')}
                            </h4>
                            <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                              {isCatalog ? `/${r.store_slug || '-'}` : (r.store_title ? `${r.store_title} (/${r.store_slug || '-'})` : `/${r.store_slug || '-'}`)}
                            </span>
                          </div>
                        </div>

                        {/* Chips / Pills: Violation Reason & Active Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.45rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <ShieldAlert size={12} color="#ef4444" />
                            <span>{r.reason_label || r.reason_category || 'Pelanggaran Aturan'}</span>
                          </span>

                          {hasAction && (
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.45rem',
                              backgroundColor: isRestored
                                ? 'rgba(16, 185, 129, 0.12)'
                                : (r.action_taken === 'catalog_banned' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(244, 63, 94, 0.12)'),
                              border: `1px solid ${isRestored
                                ? 'rgba(16, 185, 129, 0.3)'
                                : (r.action_taken === 'catalog_banned' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(244, 63, 94, 0.3)')}`,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: isRestored
                                ? (isDark ? '#34d399' : '#059669')
                                : (r.action_taken === 'catalog_banned' ? '#ef4444' : '#f43f5e'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <span>{actionLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {r.status === 're_review' && (
                        <div style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem'
                        }}>
                          <RefreshCw size={13} color="#10b981" />
                          <span style={{ fontSize: '0.72rem', color: isDark ? '#34d399' : '#059669', fontWeight: 600 }}>
                            Pemilik toko telah mengajukan perbaikan item/katalog dan siap ditinjau ulang.
                          </span>
                        </div>
                      )}

                      {/* Footer Row: Clean Action Buttons */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        paddingTop: '0.5rem',
                        borderTop: `1px solid ${theme.border}`,
                        gap: '0.45rem'
                      }}>
                        {r.store_slug && (
                          <a
                            href={`/${r.store_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '0.55rem',
                              backgroundColor: isDark ? '#334155' : '#f1f5f9',
                              border: `1px solid ${theme.border}`,
                              color: theme.textPrimary,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'opacity 0.15s ease'
                            }}
                          >
                            <ExternalLink size={12} />
                            <span>Inspeksi</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleOpenModerationPage(r)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: '#f43f5e',
                            border: '1px solid #f43f5e',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.25)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                          }}
                        >
                          <Sliders size={12} />
                          <span>Kelola Tindakan</span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}

            {/* Compliance Reports Pagination */}
            {reportsPagination && reportsPagination.total_pages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.8rem 1rem',
                backgroundColor: theme.surface,
                borderRadius: '0.9rem',
                border: `1px solid ${theme.border}`,
                marginTop: '0.5rem'
              }}>
                <button
                  type="button"
                  disabled={reportsPagination.page <= 1}
                  onClick={() => fetchReportsList(reportsPagination.page - 1)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                    color: theme.textPrimary,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: reportsPagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: reportsPagination.page <= 1 ? 0.4 : 1
                  }}
                >
                  Sebelumnya
                </button>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary }}>
                  Halaman <strong>{reportsPagination.page}</strong> dari {reportsPagination.total_pages} ({reportsPagination.total} Laporan)
                </span>
                <button
                  type="button"
                  disabled={reportsPagination.page >= reportsPagination.total_pages}
                  onClick={() => fetchReportsList(reportsPagination.page + 1)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                    color: theme.textPrimary,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: reportsPagination.page >= reportsPagination.total_pages ? 'not-allowed' : 'pointer',
                    opacity: reportsPagination.page >= reportsPagination.total_pages ? 0.4 : 1
                  }}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 4: HELPDESK & TIKET BANTUAN                                     */}
      {/* ========================================================================= */}
      {activeView === 'support' && canAccessSupport && (
        <ErrorBoundary sectionName="Helpdesk Tiket">
        {selectedTicket ? (
          /* ----------------------------------------------------------------------- */
          /* 4A. TICKET CONVERSATION CHAT ROOM (DETAIL THREAD PERCAKAPAN)             */
          /* ----------------------------------------------------------------------- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.25rem', paddingBottom: 0 }}>
            {/* Agent Collision Warning Banner (Fase 5) */}
            {activePresences.filter((p: any) => (p.admin_id ?? p.user_id) !== currentUser?.id).length > 0 && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.15)'
              }}>
                <AlertTriangle size={17} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span>
                    <strong>{activePresences.filter((p: any) => (p.admin_id ?? p.user_id) !== currentUser?.id).map((p: any) => p.admin_name).join(', ')}</strong> juga sedang membuka tiket ini
                    {activePresences.filter((p: any) => (p.admin_id ?? p.user_id) !== currentUser?.id).some((p: any) => p.is_typing) ? ' dan sedang mengetik balasan...' : '.'}
                  </span>
                </div>
              </div>
            )}

            {/* 1. Ticket Meta & Status Controller Header Card */}
            <div style={{
              padding: '1rem 1.15rem',
              borderRadius: '1.2rem',
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: theme.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              {/* Subject, Ticket Number & Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(6, 182, 212, 0.1)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.25)', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.02em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      {selectedTicket.ticket_number || `#TCK-${selectedTicket.id}`}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                    {selectedTicket.subject || 'Tiket Pertanyaan Pengguna'}
                  </h3>
                </div>
                <span style={{ fontSize: '0.66rem', color: theme.textMuted, whiteSpace: 'nowrap', paddingTop: '0.15rem', fontWeight: 600 }}>
                  {formatSupportDateTime(selectedTicket.created_at)}
                </span>
              </div>

              {/* Merchant Identity & Meta Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {/* Store Profile Identity Chip */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.22rem 0.6rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontSize: '0.68rem',
                  fontWeight: 800
                }}>
                  <Store size={12} />
                  <span>{getStoreDisplayName(selectedTicket)}</span>
                  <span style={{
                    fontSize: '0.55rem',
                    padding: '0.06rem 0.35rem',
                    borderRadius: '4px',
                    background: ['ENTERPRISE', 'PRO_BUSINESS'].includes(getStorePlanBadge(selectedTicket))
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : ['PRO', 'PRO_STARTER'].includes(getStorePlanBadge(selectedTicket))
                        ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                        : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 116, 139, 0.15)'),
                    color: ['ENTERPRISE', 'PRO_BUSINESS', 'PRO', 'PRO_STARTER'].includes(getStorePlanBadge(selectedTicket)) ? '#ffffff' : (isDark ? '#94a3b8' : '#475569'),
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    boxShadow: ['ENTERPRISE', 'PRO_BUSINESS'].includes(getStorePlanBadge(selectedTicket))
                      ? '0 1px 3px rgba(217, 119, 6, 0.35)'
                      : ['PRO', 'PRO_STARTER'].includes(getStorePlanBadge(selectedTicket))
                        ? '0 1px 3px rgba(2, 132, 199, 0.3)'
                        : 'none'
                  }}>
                    {getStorePlanBadge(selectedTicket)}
                  </span>
                </div>

                {/* Requester / Account Identity Chip */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.22rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`,
                  fontSize: '0.67rem',
                  fontWeight: 600
                }}>
                  <User size={11} style={{ color: theme.textMuted }} />
                  <span style={{ color: theme.textPrimary, fontWeight: 700 }}>{getUserRequesterName(selectedTicket)}</span>
                  {(selectedTicket.user?.email || selectedTicket.user_email) && (
                    <span style={{ opacity: 0.8, fontSize: '0.62rem' }}>
                      ({selectedTicket.user?.email || selectedTicket.user_email})
                    </span>
                  )}
                </div>

                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: theme.cardAlt,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}>
                  {
                    selectedTicket.category === 'billing' ? 'Keuangan & Langganan' :
                      selectedTicket.category === 'technical' ? 'Kendala Teknis & Bug' :
                        selectedTicket.category === 'catalog_help' ? 'Bantuan Katalog & Produk' :
                          selectedTicket.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'
                  }
                </span>

                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: selectedTicket.priority === 'urgent' || selectedTicket.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.12)',
                  color: selectedTicket.priority === 'urgent' || selectedTicket.priority === 'high' ? '#ef4444' : '#06b6d4',
                  border: `1px solid ${selectedTicket.priority === 'urgent' || selectedTicket.priority === 'high' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.25)'}`
                }}>
                  Urgensi: {String(selectedTicket.priority || 'medium').toUpperCase()}
                </span>

                {/* Status Badge Chip (Clean, compact & opens standard bottom sheet) */}
                {(() => {
                  const statusMeta = getTicketStatusMeta(selectedTicket.status);
                  return (
                    <button
                      type="button"
                      disabled={!canReplySupport}
                      onClick={() => { if (canReplySupport) setShowFooterStatusMenu(true); }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.5rem',
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.border}`,
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        cursor: canReplySupport ? 'pointer' : 'default',
                        transition: 'all 0.15s ease'
                      }}
                      title={canReplySupport ? 'Klik untuk ubah status pengerjaan tiket' : 'Status tiket (Mode Baca Saja)'}
                    >
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: statusMeta.color,
                        display: 'inline-block',
                        boxShadow: `0 0 6px ${statusMeta.color}88`
                      }} />
                      <span>{statusMeta.label}</span>
                    </button>
                  );
                })()}

                {/* Agent Ownership Badge & Claim/Release Button */}
                {(() => {
                  const assignedId = selectedTicket.assigned_agent_id;
                  const assignedName = selectedTicket.assigned_agent?.name || (assignedId ? `Agen #${assignedId}` : '');
                  const isAssignedToMe = Boolean(assignedId && currentUser?.id && Number(assignedId) === Number(currentUser.id));
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.22rem 0.55rem',
                          borderRadius: '0.5rem',
                          backgroundColor: assignedId ? 'rgba(16, 185, 129, 0.12)' : theme.surface,
                          color: assignedId ? '#10b981' : theme.textMuted,
                          border: `1px solid ${assignedId ? 'rgba(16, 185, 129, 0.3)' : theme.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.28rem',
                        }}
                      >
                        <UserCheck size={11} />
                        <span>{assignedId ? (isAssignedToMe ? 'Ditangani Anda' : `PIC: ${assignedName}`) : 'Belum Ditugaskan'}</span>
                      </span>
                      {canReplySupport && (
                        <button
                          type="button"
                          disabled={assigningTicketId === Number(selectedTicket.id)}
                          onClick={() =>
                            handleAssignTicket(
                              selectedTicket.id,
                              isAssignedToMe ? { assigned_agent_id: 0 } : { self: true }
                            )
                          }
                          style={{
                            minHeight: '44px',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.55rem',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            border: `1px solid ${isAssignedToMe ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.4)'}`,
                            backgroundColor: isAssignedToMe ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.15)',
                            color: isAssignedToMe ? '#ef4444' : '#3b82f6',
                            cursor: assigningTicketId === Number(selectedTicket.id) ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <UserPlus size={12} />
                          <span>{isAssignedToMe ? 'Lepas Penugasan' : 'Klaim Tiket'}</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* CSAT Rating Card if Rated (Fase 2) */}
              {selectedTicket.rating && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" /> Ulasan Kepuasan Merchant (CSAT)
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#f59e0b' }}>
                      {selectedTicket.rating} / 5 Bintang
                    </span>
                  </div>
                  {selectedTicket.rating_comment && (
                    <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary, fontStyle: 'italic', lineHeight: 1.4 }}>
                      "{selectedTicket.rating_comment}"
                    </p>
                  )}
                </div>
              )}

              {/* SLA Status Card (Fase 3) */}
              {selectedTicket.sla_due_at && (
                <div style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.65rem',
                  backgroundColor: selectedTicket.sla_breached ? 'rgba(239, 68, 68, 0.08)' : (selectedTicket.first_response_at ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.08)'),
                  border: `1px solid ${selectedTicket.sla_breached ? 'rgba(239, 68, 68, 0.25)' : (selectedTicket.first_response_at ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)')}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: selectedTicket.sla_breached ? '#ef4444' : (selectedTicket.first_response_at ? '#10b981' : (isDark ? '#38bdf8' : '#0284c7'))
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={12} /> Target Respon Pertama:
                  </span>
                  <span>
                    {selectedTicket.sla_breached ? 'Melewati SLA' : (selectedTicket.first_response_at ? '✓ Terpenuhi Tepat Waktu' : 'Sedang Berjalan')}
                  </span>
                </div>
              )}

              {/* Two-Stage Lifecycle Grace Period & Locked Banners */}
              {selectedTicket.status === 'resolved' && (
                <div style={{
                  marginTop: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: isDark ? '#34d399' : '#047857',
                  fontSize: '0.74rem',
                  lineHeight: 1.45,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span>Tiket Terselesaikan (Masa Sanggah 7 Hari)</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.7rem' }}>
                    Tiket akan otomatis ditutup permanen (Read-Only) jika tidak ada balasan lebih lanjut dari merchant.
                  </p>
                  {canReplySupport && (
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.15rem' }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'closed')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.45rem',
                        backgroundColor: isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(100, 116, 139, 0.1)',
                        border: `1px solid ${isDark ? 'rgba(100, 116, 139, 0.4)' : 'rgba(100, 116, 139, 0.25)'}`,
                        color: isDark ? '#cbd5e1' : '#334155',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Lock size={12} />
                      <span>Kunci &amp; Tutup Sekarang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'in_progress')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.45rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.border}`,
                        color: theme.textSecondary,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <RefreshCw size={12} />
                      <span>Buka Kembali</span>
                    </button>
                  </div>
                  )}
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div style={{
                  marginTop: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.08)',
                  border: '1px solid rgba(100, 116, 139, 0.35)',
                  color: isDark ? '#94a3b8' : '#475569',
                  fontSize: '0.74rem',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                    <Lock size={14} />
                    <span>Arsip Permanen (Read-Only)</span>
                  </div>
                  {canReplySupport && (
                  <button
                    type="button"
                    onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'in_progress')}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.45rem',
                      backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      color: '#06b6d4',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Buka Kembali</span>
                  </button>
                  )}
                </div>
              )}
            </div>

            {/* 2. Messages Thread Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Interactive Message Bubbles Feed */}
              {ticketDetailsLoading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.8rem' }}>
                  <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#06b6d4' }} />
                  Memuat riwayat percakapan tiket...
                </div>
              ) : (!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Belum ada pesan dalam tiket ini.
                </div>
              ) : (
                (() => {
                  const firstUnreadIdx = selectedTicket.messages.findIndex((msg: any) => msg.sender_type === 'user' && !msg.read_at);
                  return selectedTicket.messages.map((msg: any, idx: number) => {
                    const isAgent = msg.sender_type === 'agent' || msg.is_admin;
                    const isInternal = msg.is_internal_note;
                    const isSystemBot = msg.sender_type === 'system';
                    const isInitialInquiry = idx === 0 && !isAgent && !isInternal && !isSystemBot;
                    const merchantName = getMerchantDisplayName(selectedTicket, msg.sender);
                    const showUnreadDivider = firstUnreadIdx > 0 && idx === firstUnreadIdx;

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {showUnreadDivider && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.65rem',
                              margin: '0.65rem 0',
                              width: '100%'
                            }}
                          >
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(6, 182, 212, 0.4)' }} />
                            <span style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              color: isDark ? '#38bdf8' : '#0284c7',
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              border: '1px solid rgba(6, 182, 212, 0.35)',
                              letterSpacing: '0.02em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#06b6d4' }} />
                              Pesan Baru Belum Terbaca
                            </span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(6, 182, 212, 0.4)' }} />
                          </div>
                        )}

                        {isSystemBot ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.2rem',
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              margin: '0.35rem 0'
                            }}
                          >
                            <div style={{
                              maxWidth: '96%',
                              width: '100%',
                              boxSizing: 'border-box',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              padding: '0.85rem 1rem',
                              borderRadius: '1rem',
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)',
                              border: isDark ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid rgba(2, 132, 199, 0.2)',
                              color: theme.textPrimary,
                              boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 8px rgba(2, 132, 199, 0.04)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Bot size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
                                  <strong style={{ fontSize: '0.74rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 800 }}>
                                    Sistem Otomatis Catavor
                                  </strong>
                                </div>
                                <span style={{ fontSize: '0.62rem', color: theme.textMuted, fontWeight: 600, flexShrink: 0 }}>
                                  {formatSupportDateTime(msg.created_at)}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                {msg.message}
                              </p>
                            </div>
                          </div>
                        ) : isInternal ? (
                          <div
                            style={{
                              padding: '0.85rem 1rem',
                              borderRadius: '1rem',
                              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                              border: isDark ? '1px dashed rgba(245, 158, 11, 0.45)' : '1px dashed rgba(245, 158, 11, 0.5)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isDark ? '#fbbf24' : '#d97706', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 auto', minWidth: 0 }}>
                                <Lock size={12} style={{ flexShrink: 0 }} /> CATATAN INTERNAL CS (Hanya Terlihat Oleh Tim Admin)
                              </span>
                              <span style={{ fontSize: '0.62rem', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatSupportDateTime(msg.created_at)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600 }}>
                              Oleh: {msg.sender?.name || 'Staf Admin'}
                            </div>
                            {msg.message ? (
                              <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                {msg.message}
                              </p>
                            ) : null}
                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                              <div style={{ marginTop: '0.5rem', paddingTop: '0.45rem', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ fontSize: '0.67rem', fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Paperclip size={11} /> {msg.attachments.length} Lampiran Internal:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                  {msg.attachments.map((att: any, aIdx: number) => {
                                    const isPDF = (att.file_type || '').includes('pdf') || (att.file_name || '').toLowerCase().endsWith('.pdf') || (att.file_url || '').toLowerCase().endsWith('.pdf');
                                    return (
                                      <div key={aIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.6rem', borderRadius: '0.55rem', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff', border: '1px solid rgba(245, 158, 11, 0.35)', fontSize: '0.74rem' }}>
                                        {isPDF ? <FileText size={14} color="#ef4444" /> : <ImageIcon size={14} color="#f59e0b" />}
                                        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{att.file_name || 'Lampiran'}</span>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); openDocumentPreview(att); }} style={{ padding: '0.2rem 0.45rem', borderRadius: '0.35rem', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Preview</button>
                                        <button type="button" onClick={(e) => handleDownloadDocument(att, e)} style={{ padding: '0.2rem 0.45rem', borderRadius: '0.35rem', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.textPrimary, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Unduh</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isAgent ? 'flex-end' : 'flex-start',
                              gap: '0.2rem',
                              maxWidth: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div style={{
                              maxWidth: isInitialInquiry ? '100%' : '90%',
                              width: isInitialInquiry ? '100%' : 'auto',
                              minWidth: (msg.attachments && msg.attachments.length > 0) ? '250px' : undefined,
                              boxSizing: 'border-box',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              padding: '0.95rem 1.1rem',
                              borderRadius: isInitialInquiry
                                ? '1.15rem'
                                : isAgent
                                  ? '1.1rem 1.1rem 0.25rem 1.1rem'
                                  : '1.1rem 1.1rem 1.1rem 0.25rem',
                              backgroundColor: isInitialInquiry
                                ? (isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.05)')
                                : isAgent
                                  ? (isDark ? 'rgba(6, 182, 212, 0.18)' : 'rgba(2, 132, 199, 0.12)')
                                  : theme.surface,
                              color: theme.textPrimary,
                              border: isInitialInquiry
                                ? (isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(2, 132, 199, 0.25)')
                                : isAgent
                                  ? (isDark ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(2, 132, 199, 0.25)')
                                  : `1px solid ${theme.border}`,
                              boxShadow: isInitialInquiry ? (isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(2, 132, 199, 0.08)') : theme.cardShadow
                            }}>
                              {/* Bubble Sender Label & Time */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.38rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                  {isAgent ? (
                                    <ShieldCheck size={13} color="#06b6d4" />
                                  ) : (
                                    <Store size={13} color={isDark ? '#38bdf8' : '#0284c7'} />
                                  )}
                                  <strong style={{ fontSize: '0.74rem', color: isAgent ? '#06b6d4' : (isDark ? '#38bdf8' : '#0284c7'), fontWeight: 800 }}>
                                    {isAgent ? (msg.sender?.name || 'Catavor Support (Staf)') : getStoreDisplayName(selectedTicket)}
                                  </strong>
                                  {!isAgent && (
                                    <span style={{ fontSize: '0.62rem', color: theme.textMuted, fontWeight: 600 }}>
                                      ({getUserRequesterName(selectedTicket, msg.sender)})
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.62rem', color: theme.textMuted, fontWeight: 600, flexShrink: 0 }}>
                                  {formatSupportDateTime(msg.created_at)}
                                </span>
                              </div>

                              {/* Message Text (Only rendered if message text exists) */}
                              {msg.message ? (
                                <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                  {msg.message}
                                </p>
                              ) : null}

                              {/* Attached Files & Documents */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div style={{
                                  marginTop: msg.message ? '0.65rem' : '0.2rem',
                                  paddingTop: msg.message ? '0.5rem' : '0',
                                  borderTop: msg.message ? `1px solid ${theme.border}` : 'none'
                                }}>
                                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Paperclip size={11} color={isAgent ? '#06b6d4' : '#38bdf8'} /> {msg.attachments.length} Lampiran Berkas:
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                    {msg.attachments.map((att: any, aIdx: number) => {
                                      const isPDF = (att.file_type || '').includes('pdf') ||
                                        (att.file_name || '').toLowerCase().endsWith('.pdf') ||
                                        (att.file_url || '').toLowerCase().endsWith('.pdf');
                                      const isImage = (att.file_type && att.file_type.startsWith('image/')) ||
                                        /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_name || '') ||
                                        /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|heic)(\?.*)?$/i.test(att.file_url || '');

                                      return (
                                        <div
                                          key={aIdx}
                                          role="button"
                                          tabIndex={0}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.55rem',
                                            padding: '0.65rem 0.75rem',
                                            borderRadius: '0.8rem',
                                            backgroundColor: isDark
                                              ? (isAgent ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.05)')
                                              : (isAgent ? '#ffffff' : '#f8fafc'),
                                            border: isDark
                                              ? (isAgent ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)')
                                              : (isAgent ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid #e2e8f0'),
                                            boxShadow: isDark
                                              ? '0 2px 10px rgba(0, 0, 0, 0.3)'
                                              : (isAgent ? '0 2px 10px rgba(2, 132, 199, 0.08)' : '0 2px 8px rgba(15, 23, 42, 0.05)'),
                                            color: isDark ? '#ffffff' : '#0f172a',
                                            minWidth: '220px',
                                            maxWidth: '380px',
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          {/* Tier 1: File Header Info */}
                                          <div
                                            onClick={() => openDocumentPreview(att)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', width: '100%' }}
                                            title="Klik untuk pratinjau berkas di aplikasi"
                                          >
                                            <div style={{
                                              width: '36px',
                                              height: '36px',
                                              borderRadius: '0.5rem',
                                              backgroundColor: isPDF
                                                ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2')
                                                : (isDark ? 'rgba(14, 165, 233, 0.18)' : '#e0f2fe'),
                                              border: isPDF
                                                ? (isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fca5a5')
                                                : (isDark ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid #bae6fd'),
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0
                                            }}>
                                              {isPDF ? (
                                                <FileText size={18} color={isDark ? '#f87171' : '#dc2626'} />
                                              ) : (
                                                <ImageIcon size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
                                              )}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                              <div style={{
                                                fontWeight: 700,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontSize: '0.78rem',
                                                color: isDark ? '#ffffff' : '#0f172a',
                                                lineHeight: 1.3
                                              }}>
                                                {att.file_name || (isPDF ? 'Dokumen.pdf' : isImage ? 'Lampiran_Gambar.jpg' : 'Berkas_Lampiran')}
                                              </div>
                                              <div style={{
                                                fontSize: '0.65rem',
                                                color: isDark ? '#94a3b8' : '#64748b',
                                                marginTop: '0.12rem',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              }}>
                                                {isPDF ? 'Dokumen PDF' : isImage ? 'Lampiran Gambar' : 'Berkas Lampiran'} {att.file_size ? `• ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Tier 2: Action Buttons Row */}
                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '0.45rem',
                                            paddingTop: '0.5rem',
                                            borderTop: isDark
                                              ? (isAgent ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)')
                                              : (isAgent ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid #e2e8f0'),
                                            width: '100%',
                                            boxSizing: 'border-box'
                                          }}>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); openDocumentPreview(att); }}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.3rem',
                                                padding: '0.38rem 0.5rem',
                                                borderRadius: '0.45rem',
                                                backgroundColor: isDark ? '#0ea5e9' : '#0284c7',
                                                color: '#ffffff',
                                                border: 'none',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                boxShadow: isDark ? '0 2px 10px rgba(14, 165, 233, 0.35)' : '0 2px 8px rgba(2, 132, 199, 0.25)'
                                              }}
                                              title="Lihat Pratinjau Berkas"
                                            >
                                              <Eye size={12} strokeWidth={2.2} /> Preview
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => handleDownloadDocument(att, e)}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.3rem',
                                                padding: '0.38rem 0.5rem',
                                                borderRadius: '0.45rem',
                                                backgroundColor: isDark
                                                  ? 'rgba(255, 255, 255, 0.08)'
                                                  : (isAgent ? 'rgba(2, 132, 199, 0.06)' : '#ffffff'),
                                                color: isDark
                                                  ? '#f8fafc'
                                                  : (isAgent ? '#0369a1' : '#334155'),
                                                border: isDark
                                                  ? '1px solid rgba(255, 255, 255, 0.2)'
                                                  : (isAgent ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid #cbd5e1'),
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                              }}
                                              title="Unduh Berkas ke Perangkat"
                                            >
                                              <Download size={12} strokeWidth={2.2} /> Unduh
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()
              )}
              {/* Anchor for Auto-Scroll to bottom */}
              <div ref={messagesEndRef} />
            </div>

            {/* 3. Sleek Executive Bottom Reply Composer (Flush to Bottom) */}
            {selectedTicket.status === 'closed' ? (
              <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px)) 1rem',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.97)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                zIndex: 9990,
                boxShadow: isDark ? '0 -8px 30px rgba(0,0,0,0.5)' : '0 -6px 20px rgba(0,0,0,0.06)',
                textAlign: 'center'
              }}>
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.cardAlt,
                  color: theme.textMuted,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  border: `1px solid ${theme.border}`
                }}>
                  <Lock size={14} />
                  <span>Tiket telah ditutup permanen (Read-Only). Balasan dinonaktifkan.</span>
                </div>
              </div>
            ) : (
              <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0.65rem 0.85rem calc(0.65rem + env(safe-area-inset-bottom, 0px)) 0.85rem',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.97)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                zIndex: 9990,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
                boxShadow: isDark ? '0 -8px 30px rgba(0,0,0,0.5)' : '0 -6px 20px rgba(0,0,0,0.06)',
                boxSizing: 'border-box'
              }}>
                {!canReplySupport ? (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#f8fafc',
                    border: `1.5px dashed ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: isDark ? '#94a3b8' : '#64748b'
                  }}>
                    <Lock size={16} style={{ flexShrink: 0, color: isDark ? '#fbbf24' : '#d97706' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      Mode Hanya Baca: Akun Anda memiliki izin melihat riwayat tiket (<code style={{ fontSize: '0.75rem' }}>support:tickets:read</code>), namun tidak memiliki wewenang membalas tiket (<code style={{ fontSize: '0.75rem' }}>support:tickets:reply</code>).
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Segmented Mode Control (Full Width 2-Tabs) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.3rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                      borderRadius: '0.65rem',
                      padding: '3px',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}`
                    }}>
                      <button
                        type="button"
                        onClick={() => setIsInternalNote(false)}
                        style={{
                          minHeight: '44px',
                          padding: '0.45rem 0.5rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.74rem',
                          fontWeight: !isInternalNote ? 800 : 600,
                          backgroundColor: !isInternalNote ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                          color: !isInternalNote ? (isDark ? '#38bdf8' : '#0284c7') : theme.textSecondary,
                          boxShadow: !isInternalNote ? (isDark ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)') : 'none',
                          border: !isInternalNote ? `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.06)'}` : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>Balas Merchant</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInternalNote(true)}
                        style={{
                          minHeight: '44px',
                          padding: '0.45rem 0.5rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.74rem',
                          fontWeight: isInternalNote ? 800 : 600,
                          backgroundColor: isInternalNote ? (isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)') : 'transparent',
                          color: isInternalNote ? (isDark ? '#fbbf24' : '#b45309') : theme.textSecondary,
                          boxShadow: isInternalNote ? '0 2px 6px rgba(245, 158, 11, 0.15)' : 'none',
                          border: isInternalNote ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Lock size={12} />
                        <span>Catatan Internal</span>
                      </button>
                    </div>

                    {/* Attachment Previews */}
                    {ticketReplyAttachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', padding: '0.2rem 0', alignItems: 'center' }}>
                        {ticketReplyAttachments.map((att, idx) => (
                          <div key={idx} style={{
                            position: 'relative',
                            width: '42px',
                            height: '42px',
                            borderRadius: '0.5rem',
                            overflow: 'hidden',
                            border: `1px solid ${theme.borderStrong}`,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: (att.file_type === 'application/pdf' || att.file_name?.toLowerCase().endsWith('.pdf')) ? 'rgba(239,68,68,0.1)' : 'transparent'
                          }}>
                            {(att.file_type === 'application/pdf' || att.file_name?.toLowerCase().endsWith('.pdf')) ? (
                              <FileText size={20} color="#ef4444" />
                            ) : (
                              <SafeImage
                                src={att.file_url}
                                alt="Attachment"
                                compact
                                isDark={isDark}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setTicketReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                          {ticketReplyAttachments.length} lampiran foto
                        </span>
                      </div>
                    )}

                    {/* Quick Action Toolbar Strip: Status Capsule Pill on Left, Template Capsule Pill on Right */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.15rem 0.1rem 0.35rem',
                      gap: '0.45rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {/* Left: Premium Interactive Ticket Status Pill */}
                      {(() => {
                        const statusMeta = getTicketStatusMeta(selectedTicket.status);
                        return (
                          <button
                            type="button"
                            onClick={() => setShowFooterStatusMenu(true)}
                            style={{
                              minHeight: '44px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0 0.65rem',
                              borderRadius: '999px',
                              backgroundColor: statusMeta.bg,
                              color: statusMeta.color,
                              border: `1.5px solid ${statusMeta.border}`,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                              minWidth: 0,
                              flexShrink: 1
                            }}
                            title="Ubah Status Pengerjaan Tiket"
                          >
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: statusMeta.color,
                              display: 'inline-block',
                              boxShadow: `0 0 6px ${statusMeta.color}88`,
                              flexShrink: 0
                            }} />
                            <span style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              Status: <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>{statusMeta.shortLabel}</span>
                            </span>
                            <ChevronDown size={12} strokeWidth={2.5} style={{ opacity: 0.8, flexShrink: 0 }} />
                          </button>
                        );
                      })()}

                      {/* Right: Premium Quick Reply Canned Response Templates Pill */}
                      <button
                        type="button"
                        onClick={() => {
                          fetchCannedTemplates(1, '', 'all', 100, false, true);
                          setShowTemplateModal(true);
                        }}
                        style={{
                          minHeight: '44px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0 0.65rem',
                          borderRadius: '999px',
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                          color: isDark ? '#38bdf8' : '#0284c7',
                          border: `1.5px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.22)'}`,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          flexShrink: 0
                        }}
                        title="Gunakan Template Balasan Cepat (Canned Responses)"
                      >
                        <Zap size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>Template Balasan</span>
                      </button>
                    </div>

                    {/* Input Bar Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      backgroundColor: isInternalNote
                        ? (isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)')
                        : (isDark ? '#1e293b' : '#ffffff'),
                      borderRadius: '0.85rem',
                      padding: '0.35rem 0.45rem 0.35rem 0.65rem',
                      border: isInternalNote
                        ? `1.5px solid ${isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                        : `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
                      boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      <input
                        type="file"
                        id="admin-ticket-reply-file"
                        multiple
                        accept="image/png, image/jpeg, image/webp, application/pdf, .pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadTicketAttachment(e.target.files)}
                      />

                      {/* Paperclip Button */}
                      <button
                        type="button"
                        disabled={isUploadingTicketAttachment || ticketReplyAttachments.length >= 5}
                        onClick={() => document.getElementById('admin-ticket-reply-file')?.click()}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '0.55rem',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: isDark ? '#94a3b8' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          padding: 0
                        }}
                        title="Lampirkan Gambar"
                      >
                        {isUploadingTicketAttachment ? <RefreshCw size={15} className="animate-spin" /> : <Paperclip size={18} />}
                      </button>

                      {/* Textarea */}
                      <textarea
                        ref={mobileTicketTextareaRef}
                        rows={1}
                        placeholder={isInternalNote ? "Tulis catatan rahasia internal tim CS..." : "Ketik balasan untuk merchant..."}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{
                          flex: 1,
                          minHeight: '36px',
                          maxHeight: '120px',
                          height: 'auto',
                          padding: '0.45rem 0.35rem',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: theme.textPrimary,
                          fontSize: '0.84rem',
                          lineHeight: 1.45,
                          resize: 'none',
                          overflowY: 'auto',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Send Button */}
                      <button
                        type="button"
                        disabled={(!replyText.trim() && ticketReplyAttachments.length === 0) || actionLoading}
                        onClick={() => handleAdminReply(false)}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: isInternalNote ? '#f59e0b' : (isDark ? '#38bdf8' : '#0284c7'),
                          color: isInternalNote ? '#000000' : '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          opacity: (!replyText.trim() && ticketReplyAttachments.length === 0) || actionLoading ? 0.35 : 1,
                          boxShadow: (!replyText.trim() && ticketReplyAttachments.length === 0) || actionLoading ? 'none' : '0 2px 8px rgba(0,0,0,0.2)',
                          transition: 'all 0.15s ease',
                          padding: 0
                        }}
                        title={isInternalNote ? "Simpan Catatan Internal" : "Kirim Balasan"}
                      >
                        {actionLoading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ----------------------------------------------------------------------- */
          /* 4B. SUPPORT TICKETS QUEUE                                               */
          /* ----------------------------------------------------------------------- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* 1. Instant Search Bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.9rem', color: isDark ? '#94a3b8' : '#64748b', pointerEvents: 'none' }} />
              <input
                type="text"
                className={`search-input ${isDark ? 'dark-input' : 'light-input'}`}
                value={ticketSearchQuery}
                onChange={(e) => setTicketSearchQuery(e.target.value)}
                placeholder="Cari No Tiket (#TCK), Toko, Subjek, Email..."
                style={{
                  width: '100%',
                  padding: '0.65rem 2.2rem 0.65rem 2.5rem',
                  borderRadius: '0.85rem',
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  outline: 'none',
                  boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)',
                  boxSizing: 'border-box'
                }}
              />
              {ticketSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTicketSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: isDark ? '#94a3b8' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: '0.2rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Unified Support Filter Controls (Mobile Native with count > 0) */}
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '145px' }}>
                <MobileCustomSelect
                  value={activeMobileTriageFilter}
                  onChange={handleMobileTriageFilterChange}
                  options={mobileTriageStatusOptions}
                  title="Status Tiket Bantuan"
                  subtitle="Filter antrean pengerjaan tiket aktif"
                  placeholder="Semua Status Tiket"
                  icon={<Filter size={13} />}
                  triggerStyle={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textPrimary
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '145px' }}>
                <MobileCustomSelect
                  value={ticketCategoryFilter}
                  onChange={(val) => setTicketCategoryFilter(val)}
                  options={mobileTicketCategoryOptions}
                  title="Kategori Tiket Bantuan"
                  subtitle="Filter kategori tiket bantuan aktif"
                  placeholder="Semua Kategori"
                  icon={<Tag size={13} />}
                  triggerStyle={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textPrimary
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '135px' }}>
                <MobileCustomSelect
                  value={ticketPriorityFilter}
                  onChange={(val) => setTicketPriorityFilter(val)}
                  options={mobileTicketPriorityOptions}
                  title="Prioritas Tiket"
                  subtitle="Filter tingkat urgensi tiket aktif"
                  placeholder="Semua Prioritas"
                  icon={<AlertCircle size={13} />}
                  triggerStyle={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textPrimary
                  }}
                />
              </div>

              {/* SLA Filter Toggle */}
              <button
                type="button"
                onClick={() => setTicketSlaFilter((prev: string) => prev === 'breached' ? 'all' : 'breached')}
                style={{
                  minHeight: '44px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: ticketSlaFilter === 'breached' ? 'rgba(239, 68, 68, 0.15)' : theme.surface,
                  color: ticketSlaFilter === 'breached' ? '#ef4444' : theme.textSecondary,
                  border: `1.5px solid ${ticketSlaFilter === 'breached' ? '#ef4444' : theme.border}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <Clock size={13} />
                <span>SLA Lewat</span>
                {(ticketsMetrics?.sla_breached ?? 0) > 0 && (
                  <span style={{
                    fontSize: '0.62rem',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '999px',
                    backgroundColor: ticketSlaFilter === 'breached' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)',
                    color: ticketSlaFilter === 'breached' ? '#ffffff' : '#ef4444',
                    fontWeight: 800
                  }}>
                    {ticketsMetrics.sla_breached}
                  </span>
                )}
              </button>

              {/* Agent Ownership Quick Filters */}
              <button
                type="button"
                onClick={() => setTicketAssignedFilter(prev => prev === 'me' ? 'all' : 'me')}
                style={{
                  minHeight: '44px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: ticketAssignedFilter === 'me' ? 'rgba(59, 130, 246, 0.16)' : theme.surface,
                  color: ticketAssignedFilter === 'me' ? '#3b82f6' : theme.textSecondary,
                  border: `1.5px solid ${ticketAssignedFilter === 'me' ? '#3b82f6' : theme.border}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <UserCheck size={13} />
                <span>Tiket Saya</span>
              </button>
              <button
                type="button"
                onClick={() => setTicketAssignedFilter(prev => prev === 'unassigned' ? 'all' : 'unassigned')}
                style={{
                  minHeight: '44px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: ticketAssignedFilter === 'unassigned' ? 'rgba(245, 158, 11, 0.16)' : theme.surface,
                  color: ticketAssignedFilter === 'unassigned' ? '#f59e0b' : theme.textSecondary,
                  border: `1.5px solid ${ticketAssignedFilter === 'unassigned' ? '#f59e0b' : theme.border}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <UserPlus size={13} />
                <span>Belum Ditugaskan</span>
              </button>

              {/* Reset Filters (if active) */}
              {(activeMobileTriageFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketSlaFilter !== 'all' || ticketAssignedFilter !== 'all' || ticketSearchQuery.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    handleMobileTriageFilterChange('all');
                    setTicketCategoryFilter('all');
                    setTicketPriorityFilter('all');
                    setTicketSlaFilter('all');
                    setTicketAssignedFilter('all');
                    setTicketSearchQuery('');
                  }}
                  style={{
                    padding: '0.3rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    backgroundColor: theme.cardAlt,
                    color: theme.textMuted,
                    border: `1px solid ${theme.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <X size={11} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Tickets Feed List */}
            {tickets.length === 0 ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: theme.surface,
                borderRadius: '1.15rem',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow
              }}>
                <MessageSquare size={36} color="var(--primary)" style={{ margin: '0 auto 0.65rem' }} />
                <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Tiket</h4>
                <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>
                  Tidak ada tiket bantuan yang cocok dengan filter saat ini.
                </p>
              </div>
            ) : (
              tickets.map((t) => {
                const isUnread = t.status === 'open' || t.status === 'waiting_agent';
                const statusMeta = getTicketStatusMeta(t.status);
                const storeDisplayName = resolveTicketStoreTitle(t);
                const storePlan = t.store_plan || t.store?.plan || '';
                const msgs = Array.isArray(t.messages) ? t.messages : [];
                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                const messageCount = resolveTicketMessageCount(t);
                const lastSenderName = lastMsg ? (lastMsg.sender_type === 'user' ? (lastMsg.sender_name || 'Merchant') : (lastMsg.sender_name || 'CS Agent')) : '';

                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTicketChat(t)}
                    style={{
                      padding: '0.95rem 1rem',
                      borderRadius: '1.15rem',
                      backgroundColor: theme.surface,
                      border: isUnread ? `1.5px solid ${statusMeta.color}` : `1px solid ${theme.border}`,
                      boxShadow: theme.cardShadow,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Header Row: Ticket Number & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        {isUnread && (
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: statusMeta.color,
                            boxShadow: `0 0 8px ${statusMeta.color}`,
                            flexShrink: 0
                          }} />
                        )}
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: isDark ? '#38bdf8' : '#0284c7',
                          fontFamily: 'monospace',
                          padding: '0.15rem 0.42rem',
                          borderRadius: '0.35rem',
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                          border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.2)'}`
                        }}>
                          {t.ticket_number || `#TCK-${t.id}`}
                        </span>
                        {t.priority === 'urgent' && (
                          <span style={{
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}>
                            URGENT
                          </span>
                        )}
                      </div>

                      <span style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.border}`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusMeta.color }} />
                        {statusMeta.shortLabel || statusMeta.label}
                      </span>
                    </div>

                    {/* Store Info & Subject */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary }}>
                          {storeDisplayName}
                        </span>
                        {storePlan && storePlan !== 'free' && (
                          <span style={{
                            fontSize: '0.56rem',
                            fontWeight: 800,
                            padding: '0.08rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: isDark ? '#34d399' : '#059669',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            {storePlan.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <h4 style={{
                        margin: 0,
                        fontSize: '0.88rem',
                        fontWeight: isUnread ? 800 : 700,
                        color: theme.textPrimary,
                        lineHeight: 1.35
                      }}>
                        {t.subject || 'Tiket Bantuan'}
                      </h4>
                    </div>

                    {/* Last message snippet if present */}
                    {lastMsg && (
                      <div style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: '0.55rem',
                        backgroundColor: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        fontSize: '0.74rem',
                        color: theme.textSecondary,
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        <strong style={{ color: theme.textPrimary }}>{lastSenderName}: </strong>
                        {lastMsg.message || 'Lampiran'}
                      </div>
                    )}

                    {/* Footer Row: Timestamp, Assignment & Message Count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.2rem', borderTop: `1px solid ${theme.border}` }}>
                      <span style={{ fontSize: '0.64rem', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} />
                        {t.last_message_at || t.created_at ? new Date(t.last_message_at || t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                      </span>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.38rem',
                          borderRadius: '0.35rem',
                          backgroundColor: t.assigned_agent_id ? 'rgba(16, 185, 129, 0.12)' : theme.cardAlt,
                          color: t.assigned_agent_id ? '#10b981' : theme.textMuted,
                          border: `1px solid ${t.assigned_agent_id ? 'rgba(16, 185, 129, 0.25)' : theme.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}>
                          <UserCheck size={10} />
                          <span>{t.assigned_agent?.name || (t.assigned_agent_id ? `Agen #${t.assigned_agent_id}` : 'Belum Ditugaskan')}</span>
                        </span>

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.4rem',
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(2, 132, 199, 0.08)',
                          color: isDark ? '#38bdf8' : '#0284c7',
                          fontSize: '0.66rem',
                          fontWeight: 700
                        }}>
                          <MessageSquare size={11} />
                          <span>{messageCount} Pesan</span>
                          <ChevronRight size={11} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Load More Button for Server-Side Paginated Feed */}
            {ticketsPagination.has_more && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  disabled={ticketsLoadingMore}
                  onClick={handleLoadMoreTickets}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.85rem',
                    backgroundColor: theme.surface,
                    border: `1.5px dashed ${isDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(2, 132, 199, 0.4)'}`,
                    color: isDark ? '#38bdf8' : '#0284c7',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: ticketsLoadingMore ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    boxShadow: theme.cardShadow,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {ticketsLoadingMore ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Memuat Tiket Berikutnya...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={15} />
                      <span>Muat Lebih Banyak Tiket ({tickets.length} dari {ticketsPagination.total_items})</span>
                    </>
                  )}
                </button>
                <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                  Menampilkan {tickets.length} dari {ticketsPagination.total_items} tiket
                </span>
              </div>
            )}
          </div>
        )}
        </ErrorBoundary>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 5: KEUANGAN & ORDER LANGGANAN                                   */}
      {/* ========================================================================= */}
      {activeView === 'finance' && canAccessFinance && (
        <div className="finance-workspace" style={{ ...financeColors(isDark, theme), display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <FinanceNav section={financeSubTab} select={setFinanceSubTab} settings={canManagePaymentSettings}
            coupons={canManageCoupons} pending={pendingOrdersCount} orders={canReadOrders}/>

          {financeSubTab === 'orders' && (
            <>
              {/* Summary Metrics Bar */}
              {(() => {
                const { total: totalCnt = 0, pending: pendingCnt = 0, paid: paidCnt = 0, rejected: rejectedCnt = 0, revenue = 0 } = orderPage.summary;
                const totalVerifiedRevenue = Number(revenue ?? 0);
                const revenueRedacted = !canReadRevenue || Boolean(orderPage.summary?.revenue_redacted);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="finance-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'all', label: 'Total Transaksi', count: totalCnt, color: '#10b981' },
                        { key: 'pending', label: 'Perlu Verifikasi', count: pendingCnt, color: '#f59e0b' },
                        { key: 'paid', label: 'Lunas & Aktif', count: paidCnt, color: '#0284c7' },
                        { key: 'rejected', label: 'Ditolak / Batal', count: rejectedCnt, color: '#ef4444' }
                      ].map(stat => (
                        <button type="button" aria-pressed={ordersFilter === stat.key}
                          key={stat.key}
                          onClick={() => setOrdersFilter(stat.key as any)}
                          style={{
                            minHeight: '44px', textAlign: 'left', font: 'inherit', padding: '0.7rem 0.85rem',
                            borderRadius: '0.85rem',
                            backgroundColor: ordersFilter === stat.key ? `${stat.color}14` : theme.surface,
                            border: `1px solid ${ordersFilter === stat.key ? stat.color : theme.border}`,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 700 }}>{stat.label}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: stat.color, marginTop: '0.1rem' }}>{stat.count}</div>
                          </div>
                          <CreditCard size={18} color={stat.color} style={{ opacity: 0.8 }} />
                        </button>
                      ))}
                    </div>
                    <div style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.85rem',
                      backgroundColor: theme.surface,
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>
                          Omzet Terverifikasi
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: revenueRedacted ? theme.textMuted : '#10b981', marginTop: '0.1rem' }}>
                          {revenueRedacted ? 'Akses Omzet Dibatasi' : `Rp ${totalVerifiedRevenue.toLocaleString('id-ID')}`}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: theme.textSecondary, textAlign: 'right' }}>
                        {revenueRedacted ? 'Perlu izin finance:revenue:read' : 'Transaksi aktif'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Search Input */}
              <div style={{ position: 'relative' }}>
                <Search size={15} color={theme.textMuted} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={ordersSearchQuery}
                  onChange={e => setOrdersSearchQuery(e.target.value)}
                  placeholder="Cari no. invoice, toko, pelanggan, pengirim, ref Aulaa..."
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.55rem 2.2rem 0.55rem 2.35rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.78rem',
                    boxSizing: 'border-box'
                  }}
                />
                {ordersSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrdersSearchQuery('')}
                    style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <OrderFilters Picker={MobileCustomSelect} status={orderPage.status} channel={orderPage.kind}
                facets={orderPage.facets} ready={orderPage.ready} onStatus={orderPage.setStatus} onChannel={orderPage.setKind} />

              {/* Orders Feed */}
              {(() => {
                const filteredList = orders;
                if (!orderPage.ready) return null;
                if (filteredList.length === 0) {
                  return (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
                      <CreditCard size={36} color="#10b981" style={{ margin: '0 auto 0.65rem' }} />
                      <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Transaksi Ditemukan</h4>
                      <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>Belum ada transaksi yang sesuai dengan filter status atau sistem pembayaran saat ini.</p>
                    </div>
                  );
                }

                return filteredList.map(o => {
                  const d = describeSubscriptionOrder(o);
                  const statusColor = d.isPaid ? (isDark ? '#34d399' : '#059669') : d.isPending ? (isDark ? '#facc15' : '#d97706') : '#ef4444';
                  const statusBg = d.isPaid ? 'rgba(16, 185, 129, 0.14)' : d.isPending ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)';
                  const configAccent = d.isAulaaGateway ? '#10b981' : d.isManualQRIS ? '#0284c7' : d.isFreeCoupon ? '#a855f7' : '#3b82f6';

                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedProofOrder(o)}
                      style={{
                        padding: '1rem',
                        borderRadius: '1.15rem',
                        backgroundColor: theme.surface,
                        border: d.isPending ? '1.5px solid rgba(250, 204, 21, 0.55)' : `1px solid ${theme.border}`,
                        boxShadow: theme.cardShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Row 1: Plan, Type, Invoice & Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: isDark ? '#34d399' : '#059669',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            {d.planLabel}
                          </span>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            backgroundColor: theme.cardAlt,
                            color: theme.textSecondary,
                            border: `1px solid ${theme.border}`
                          }}>
                            {d.orderTypeLabel}
                          </span>
                          <span style={{ fontSize: '0.66rem', fontFamily: 'monospace', color: theme.textMuted, fontWeight: 700 }}>
                            #{d.orderNumber}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '0.18rem 0.55rem',
                          borderRadius: '999px',
                          backgroundColor: statusBg,
                          color: statusColor
                        }}>
                          {d.statusLabel}
                        </span>
                      </div>

                      {/* Row 2: Store, Customer & Total Nominal */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary }}>
                            {d.storeTitle} {d.storeSlug ? <span style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textMuted }}>/@{d.storeSlug}</span> : null}
                          </h4>
                          <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                            Pelanggan: <strong style={{ color: theme.textPrimary }}>{d.customerName}</strong> ({d.customerEmail})
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '1.02rem', fontWeight: 900, color: isDark ? '#34d399' : '#059669', display: 'block' }}>
                            Rp {d.finalAmount.toLocaleString('id-ID')}
                          </span>
                          {d.isManualBank && d.uniqueCode > 0 && (
                            <span style={{ fontSize: '0.64rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 700, display: 'block' }}>
                              Kode Unik Mutasi: +Rp {d.uniqueCode}
                            </span>
                          )}
                          {d.isManualQRIS && (
                            <span style={{ fontSize: '0.64rem', color: theme.textMuted, display: 'block' }}>
                              Nominal Pas QRIS
                            </span>
                          )}
                          <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                            {d.createdAt ? new Date(d.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru'}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Dynamic Payment Configuration Box (Represents Aulaa vs Manual QRIS vs Manual Bank vs Coupon) */}
                      <div style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.75rem',
                        backgroundColor: `${configAccent}10`,
                        border: `1px solid ${configAccent}35`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        fontSize: '0.72rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, color: configAccent, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {d.isAulaaGateway ? <Zap size={13} /> : d.isManualQRIS ? <QrCode size={13} /> : d.isFreeCoupon ? <Tag size={13} /> : <CreditCard size={13} />}
                            <span>{d.configBadgeLabel}</span>
                          </span>
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, color: theme.textSecondary }}>
                            {d.configChannelLabel}
                          </span>
                        </div>

                        {d.isAulaaGateway && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', color: theme.textSecondary, fontSize: '0.69rem' }}>
                            <div>Ref Aulaa: <strong style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{d.gatewayReference || 'Menunggu Sesi'}</strong></div>
                            <div>Link Sesi: <strong style={{ color: d.gatewayPaymentLink ? '#10b981' : theme.textMuted }}>{d.gatewayPaymentLink ? 'Tersedia' : 'Belum Terbit'}</strong></div>
                            {d.gatewayRawSummary && (
                              <div style={{ gridColumn: '1 / -1', color: theme.textMuted }}>Webhook: {d.gatewayRawSummary}</div>
                            )}
                          </div>
                        )}

                        {d.isManualQRIS && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', color: theme.textSecondary, fontSize: '0.69rem' }}>
                            <div>Pengirim: <strong style={{ color: theme.textPrimary }}>{d.senderAccountName}</strong></div>
                            <div>WA: <strong style={{ color: theme.textPrimary }}>{d.senderPhone || '-'}</strong></div>
                            <div>QRIS Tujuan: <strong style={{ color: theme.textPrimary }}>{d.targetQrisMerchant}</strong></div>
                            <div>Bukti Scan: <strong style={{ color: d.proofUrl ? '#10b981' : '#f59e0b' }}>{d.proofUrl ? 'Terlampir' : 'Belum Ada'}</strong></div>
                          </div>
                        )}

                        {d.isManualBank && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', color: theme.textSecondary, fontSize: '0.69rem' }}>
                            <div>Rek. Pengirim: <strong style={{ color: theme.textPrimary }}>{d.senderAccountName}</strong></div>
                            <div>WA: <strong style={{ color: theme.textPrimary }}>{d.senderPhone || '-'}</strong></div>
                            <div>Bank Tujuan: <strong style={{ color: theme.textPrimary }}>{d.targetBankName}</strong></div>
                            <div>Bukti Transfer: <strong style={{ color: d.proofUrl ? '#10b981' : '#f59e0b' }}>{d.proofUrl ? 'Terlampir' : 'Belum Ada'}</strong></div>
                          </div>
                        )}

                        {d.isFreeCoupon && (
                          <div style={{ color: theme.textSecondary, fontSize: '0.69rem' }}>
                            Kode Promo: <strong style={{ color: theme.textPrimary }}>{d.couponCode || 'FREE'}</strong> • Diskon: <strong style={{ color: '#10b981' }}>-Rp {d.discountAmount.toLocaleString('id-ID')}</strong>
                          </div>
                        )}

                        {d.isRejected && d.rejectionReason && (
                          <div style={{ color: '#ef4444', fontSize: '0.68rem', fontWeight: 700, paddingTop: '0.2rem', borderTop: `1px dashed ${theme.border}` }}>
                            Alasan Ditolak: {d.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Row 4: Action Triggers (Always Present on Every Card!) */}
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingTop: '0.35rem', borderTop: `1px solid ${theme.border}` }}
                      >
                        <div style={{ display: 'flex', gap: '0.45rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedProofOrder(o)}
                            style={{
                              flex: 1,
                              minHeight: '42px',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.65rem',
                              backgroundColor: theme.cardAlt,
                              border: `1px solid ${theme.border}`,
                              color: isDark ? '#38bdf8' : '#0284c7',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Eye size={14} />
                            <span>Detail</span>
                          </button>

                          {d.isAulaaGateway && d.isPending && (
                            <button
                              type="button"
                              disabled={syncingOrderId === o.id}
                              onClick={() => handleSyncOrderWithAulaa(o.id)}
                              style={{
                                minHeight: '42px',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                color: '#10b981',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <RefreshCw size={13} className={syncingOrderId === o.id ? 'animate-spin' : ''} />
                              <span>{syncingOrderId === o.id ? 'Sinkron...' : 'Cek Aulaa'}</span>
                            </button>
                          )}
                        </div>

                        {canManageFinance ? (
                          d.isPending ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.45rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingOrder(o);
                                  setRejectReasonInput(d.isManualQRIS ? 'Dana scan QRIS belum masuk ke mutasi merchant' : d.isAulaaGateway ? 'Pembayaran gateway melewati batas waktu / dibatalkan' : 'Dana transfer belum masuk ke mutasi rekening bank');
                                }}
                                style={{
                                  minHeight: '42px',
                                  padding: '0.45rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.14)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  color: '#f87171',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <XCircle size={14} />
                                <span>Tolak</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(o.id, 'active')}
                                style={{
                                  minHeight: '42px',
                                  padding: '0.45rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <CheckCircle2 size={14} />
                                <span>Terima &amp; Aktifkan</span>
                              </button>
                            </div>
                          ) : d.isPaid ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(o.id, 'pending_verification')}
                                style={{
                                  minHeight: '40px',
                                  padding: '0.4rem',
                                  borderRadius: '0.6rem',
                                  backgroundColor: theme.cardAlt,
                                  border: `1px solid ${theme.border}`,
                                  color: theme.textSecondary,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <RotateCcw size={13} />
                                <span>Set Pending</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingOrder(o);
                                  setRejectReasonInput('Pembatalan verifikasi oleh admin keuangan');
                                }}
                                style={{
                                  minHeight: '40px',
                                  padding: '0.4rem',
                                  borderRadius: '0.6rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <XCircle size={13} />
                                <span>Batalkan / Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(o.id, 'pending_verification')}
                                style={{
                                  width: '100%',
                                  minHeight: '44px',
                                  padding: '0.4rem',
                                  borderRadius: '0.6rem',
                                  backgroundColor: theme.cardAlt,
                                  border: `1px solid ${theme.border}`,
                                  color: theme.textSecondary,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <RotateCcw size={13} />
                                <span>Kembalikan Pending</span>
                              </button>
                            </div>
                          )
                        ) : (
                          <div style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '0.5rem',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                            border: `1px dashed ${theme.border}`,
                            fontSize: '0.7rem',
                            color: theme.textMuted,
                            textAlign: 'center'
                          }}>
                            Aksi verifikasi memerlukan izin <code style={{ fontSize: '0.66rem' }}>finance:orders:manage</code>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              <FinancePager list={orderPage} device="mobile" />
            </>
          )}

          {/* Mobile Payment System Configuration */}
          {financeSubTab === 'settings' && canManagePaymentSettings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <PaymentModePicker value={googleSettings.payment_system_mode || 'gateway_aulaa'}
                select={payment_system_mode => setGoogleSettings(prev => ({ ...prev, payment_system_mode }))} />
              {/* 2. Focused Configuration Panel (Only Shows Settings for Selected Tab) */}
              {(() => {
                const activeMode = googleSettings.payment_system_mode || 'gateway_aulaa';

                // PANEL 1: AULAA GATEWAY
                if (activeMode === 'gateway_aulaa') {
                  return (
                    <div style={{
                      padding: '1.15rem',
                      backgroundColor: theme.surface,
                      borderRadius: '0.95rem',
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      {/* Active Status Banner */}
                      <div style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Zap size={18} color="#10b981" />
                          <div>
                            <strong style={{ fontSize: '0.8rem', color: theme.textPrimary, display: 'block' }}>
                              Gateway Aulaa.co
                            </strong>
                            <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                              Pembayaran instan otomatis via API Aulaa.co
                            </span>
                          </div>
                        </div>
                        <a
                          href="https://aulaa.co/docs"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            minHeight: '44px',
                            fontSize: '0.68rem',
                            color: '#10b981',
                            textDecoration: 'none',
                            fontWeight: 700,
                            padding: '0 0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            backgroundColor: 'rgba(16, 185, 129, 0.05)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <ExternalLink size={12} /> API Docs
                        </a>
                      </div>

                      {/* Sub-channel Toggles */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                          Sub-Kanal yang Ditampilkan di Checkout:
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {[
                            { key: 'payment_aulaa_channel_qris', label: 'QRIS Instan', desc: 'GoPay, OVO, ShopeePay, BCA', icon: QrCode, color: '#10b981' },
                            { key: 'payment_aulaa_channel_va', label: 'Virtual Account', desc: 'BCA, Mandiri, BRI, BNI', icon: CreditCard, color: '#0284c7' },
                            { key: 'payment_aulaa_channel_ewallet', label: 'Dompet Digital', desc: 'DANA, LinkAja, AstraPay', icon: Zap, color: '#f59e0b' },
                            { key: 'payment_aulaa_channel_cc', label: 'Kartu Kredit / Debit', desc: 'Visa & Mastercard', icon: CreditCard, color: '#a855f7' },
                          ].map(ch => {
                            const isEnabled = googleSettings[ch.key] !== '0';
                            const ChIcon = ch.icon;
                            return (
                              <div
                                key={ch.key}
                                onClick={() => setGoogleSettings(prev => ({ ...prev, [ch.key]: isEnabled ? '0' : '1' }))}
                                style={{
                                  minHeight: '44px',
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: '0.55rem',
                                  backgroundColor: isEnabled ? 'rgba(16, 185, 129, 0.08)' : theme.cardAlt,
                                  border: `1px solid ${isEnabled ? '#10b981' : theme.border}`,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <ChIcon size={16} color={ch.color} />
                                  <div>
                                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary }}>{ch.label}</div>
                                    <div style={{ fontSize: '0.66rem', color: theme.textSecondary }}>{ch.desc}</div>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => { }}
                                  style={{ accentColor: '#10b981', cursor: 'pointer', width: '18px', height: '18px' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* API Key */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                            Aulaa API Key:
                          </label>
                          <button className="finance-utility"
                            type="button"
                            onClick={() => setShowAulaaSecrets(!showAulaaSecrets)}
                            style={{ minHeight: '44px', background: 'none', border: 'none', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            {showAulaaSecrets ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{showAulaaSecrets ? 'Tutup' : 'Lihat'}</span>
                          </button>
                        </div>
                        <input
                          type={showAulaaSecrets ? 'text' : 'password'}
                          value={googleSettings.aulaa_api_key || ''}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, aulaa_api_key: e.target.value }))}
                          placeholder="aulk_live_xxxxxxxxxxxxxxxx"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>

                      {/* Webhook Secret */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Aulaa Webhook Secret (HMAC-SHA256):
                        </label>
                        <input
                          type={showAulaaSecrets ? 'text' : 'password'}
                          value={googleSettings.aulaa_webhook_secret || ''}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, aulaa_webhook_secret: e.target.value }))}
                          placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxxxx"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>

                      {/* Base URL */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Base URL API:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.aulaa_base_url || 'https://api.aulaa.co/v1'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, aulaa_base_url: e.target.value }))}
                          placeholder="https://api.aulaa.co/v1"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      {/* Webhook URL Box */}
                      <div style={{
                        padding: '0.75rem',
                        borderRadius: '0.6rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
                          URL Webhook Catavor:
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <code style={{
                            flex: 1,
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.5rem',
                            backgroundColor: theme.surface,
                            borderRadius: '0.35rem',
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {typeof window !== 'undefined' ? `${window.location.origin}/api/payments/webhook/aulaa` : '/api/payments/webhook/aulaa'}
                          </code>
                          <button className="finance-utility"
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                navigator.clipboard.writeText(`${window.location.origin}/api/payments/webhook/aulaa`);
                                setCopiedWebhookUrl(true);
                                setTimeout(() => setCopiedWebhookUrl(false), 2000);
                                showToast('URL webhook disalin!', 'success');
                              }
                            }}
                            style={{
                              minHeight: '44px',
                              padding: '0 0.65rem',
                              borderRadius: '0.4rem',
                              backgroundColor: copiedWebhookUrl ? '#10b981' : theme.surface,
                              color: copiedWebhookUrl ? '#ffffff' : theme.textPrimary,
                              border: `1px solid ${theme.border}`,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            {copiedWebhookUrl ? <CheckCheck size={13} /> : <Copy size={13} />}
                            <span>{copiedWebhookUrl ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // PANEL 2: MANUAL QRIS & REKENING
                if (activeMode === 'manual_qris') {
                  return (
                    <div style={{
                      padding: '1.15rem',
                      backgroundColor: theme.surface,
                      borderRadius: '0.95rem',
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      {/* Active Status Banner */}
                      <div style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <QrCode size={18} color="#0284c7" />
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: theme.textPrimary, display: 'block' }}>
                            QRIS &amp; Transfer Manual
                          </strong>
                          <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                            Pembayaran manual diverifikasi staf admin (kode unik untuk transfer bank, nominal pas untuk QRIS).
                          </span>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Nama Merchant QRIS:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.payment_qris_manual_merchant || 'Catavor Official Store'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_qris_manual_merchant: e.target.value }))}
                          placeholder="Catavor Official Store"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      {/* QRIS Image Upload / URL */}
                      {(() => {
                        const isQrisStaged = (googleSettings.payment_qris_manual_image || '').trim() !== savedQrisImageRef.current;
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.45rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span>Gambar QRIS Merchant:</span>
                                {isQrisStaged ? (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '0.35rem',
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    color: '#d97706',
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                  }}>
                                    Draf Belum Disimpan
                                  </span>
                                ) : googleSettings.payment_qris_manual_image ? (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '0.35rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.25)'
                                  }}>
                                    Tersimpan Aktif
                                  </span>
                                ) : null}
                              </label>

                              {isQrisStaged && (
                                <button
                                  type="button"
                                  onClick={() => setGoogleSettings(prev => ({ ...prev, payment_qris_manual_image: savedQrisImageRef.current }))}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: theme.textSecondary,
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '0.1rem 0.35rem',
                                    textDecoration: 'underline'
                                  }}
                                  title="Kembalikan ke gambar QRIS yang terakhir disimpan"
                                >
                                  Batal / Kembalikan ke Awal
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '0.65rem',
                                overflow: 'hidden',
                                flexShrink: 0
                              }}>
                                <SafeImage
                                  src={googleSettings.payment_qris_manual_image}
                                  alt="QRIS Merchant"
                                  emptyLabel="Belum Ada QRIS"
                                  emptySubLabel="Unggah berkas QRIS"
                                  errorLabel="QRIS Rusak"
                                  errorSubLabel="Tidak terbaca"
                                  compact={true}
                                  objectFit="contain"
                                  isDark={isDark}
                                  title={googleSettings.payment_qris_manual_image ? "Pratinjau Gambar QRIS" : "QRIS belum diunggah"}
                                />
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <input
                                  type="text"
                                  value={googleSettings.payment_qris_manual_image || ''}
                                  onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_qris_manual_image: e.target.value }))}
                                  placeholder="Unggah berkas QRIS atau tempel URL gambar..."
                                  style={{
                                    width: '100%',
                                    minHeight: '44px',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: theme.cardAlt,
                                    border: `1px solid ${theme.border}`,
                                    color: theme.textPrimary,
                                    fontSize: '0.75rem'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <label style={{
                                    minHeight: '44px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0 0.75rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: theme.surface,
                                    border: `1px solid ${theme.border}`,
                                    color: theme.textPrimary,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: isUploadingQRISImage ? 'not-allowed' : 'pointer',
                                    width: 'fit-content'
                                  }}>
                                    <Upload size={13} color="#0284c7" />
                                    <span>{isUploadingQRISImage ? 'Mengunggah...' : 'Unggah File QRIS'}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled={isUploadingQRISImage}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadQRISImage(f);
                                        e.target.value = '';
                                      }}
                                      style={{ display: 'none' }}
                                    />
                                  </label>
                                  {googleSettings.payment_qris_manual_image && (
                                    <button
                                      type="button"
                                      onClick={() => setGoogleSettings(prev => ({ ...prev, payment_qris_manual_image: '' }))}
                                      style={{
                                        minHeight: '44px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0 0.75rem',
                                        borderRadius: '0.45rem',
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${theme.border}`,
                                        color: '#ef4444',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={13} />
                                      <span>Hapus</span>
                                    </button>
                                  )}
                                </div>
                                {isQrisStaged && (
                                  <div style={{ fontSize: '0.71rem', color: '#d97706', lineHeight: 1.35, marginTop: '0.15rem' }}>
                                    Gambar QRIS masih berupa draf. Pilih <strong>Simpan pengaturan</strong> untuk menerapkannya di checkout.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Nama Bank Penerima:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.payment_bank_name || 'Bank Central Asia (BCA)'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_bank_name: e.target.value }))}
                          placeholder="BCA"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Nomor Rekening:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.payment_bank_account || '8830-1928-3920'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_bank_account: e.target.value }))}
                          placeholder="8830-1928-3920"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Atas Nama Rekening:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.payment_bank_holder || 'PT Catavor Media Digital'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_bank_holder: e.target.value }))}
                          placeholder="PT Catavor Media Digital"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      {/* Info Unique Code */}
                      <div style={{
                        padding: '0.75rem',
                        borderRadius: '0.6rem',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7' }}>
                          Kode Unik 3-Digit Otomatis:
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                          Setiap invoice transfer bank manual otomatis ditambah kode unik nominal acak (100–999) untuk pencocokan mutasi. Pembayaran QRIS manual menggunakan nominal pas.
                        </p>
                      </div>
                    </div>
                  );
                }

                // PANEL 3: MAINTENANCE MODE
                if (activeMode === 'maintenance') {
                  return (
                    <div style={{
                      padding: '1.15rem',
                      backgroundColor: theme.surface,
                      borderRadius: '0.95rem',
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      {/* Active Status Banner */}
                      <div style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <ShieldAlert size={18} color="#ef4444" />
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: '#ef4444', display: 'block' }}>
                            Pemeliharaan checkout
                          </strong>
                          <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>
                            Jika mode ini disimpan, checkout paket berbayar akan ditutup.
                          </span>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Judul Pengumuman:
                        </label>
                        <input
                          type="text"
                          value={googleSettings.payment_maintenance_title || 'Sistem Pembayaran Dalam Pemeliharaan'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_maintenance_title: e.target.value }))}
                          placeholder="Sistem Pembayaran Dalam Pemeliharaan"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.3rem' }}>
                          Isi Pesan Peringatan Pemeliharaan:
                        </label>
                        <textarea
                          rows={3}
                          value={googleSettings.payment_maintenance_message || 'Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.'}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, payment_maintenance_message: e.target.value }))}
                          placeholder="Pesan pemeliharaan..."
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.8rem',
                            lineHeight: 1.45,
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      {/* Mobile Live Preview Card */}
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.06)',
                        border: '1.5px solid rgba(239, 68, 68, 0.25)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ef4444'
                        }}>
                          <ShieldAlert size={18} />
                        </div>
                        <h5 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary }}>
                          {googleSettings.payment_maintenance_title || 'Sistem Pembayaran Dalam Pemeliharaan'}
                        </h5>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.35 }}>
                          {googleSettings.payment_maintenance_message || 'Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
              <div className="finance-save-bar">
                <button type="button" className="finance-action" onClick={handleSavePaymentSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {savingSettings ? 'Menyimpan…' : 'Simpan pengaturan'}
                </button>
              </div>
            </div>
          )}

          {/* Mobile Coupon Management Sub-Tab */}
          {financeSubTab === 'coupons' && canManageCoupons && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Header Info & Create Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                backgroundColor: theme.surface,
                padding: '0.9rem',
                borderRadius: '0.85rem',
                border: `1px solid ${theme.border}`
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                    Kupon langganan
                  </h4>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: theme.textSecondary }}>
                    Kelola diskon, kuota, dan masa berlaku kupon.
                  </p>
                </div>
                <button
                  type="button"
                  className="finance-action"
                  onClick={handleOpenCreateCouponModal}
                  style={{
                    minHeight: '44px',
                    padding: '0 0.85rem',
                    borderRadius: '0.55rem',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={15} />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
                <input
                  type="text"
                  aria-label="Cari kupon"
                  placeholder="Cari kode atau nama kupon..."
                  value={couponSearchFilter}
                  onChange={(e) => setCouponSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.6rem 0.85rem 0.6rem 2.35rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <CouponFilters Picker={MobileCustomSelect} facets={couponPage.facets} ready={couponPage.ready} status={couponPage.status} kind={couponPage.kind}
                onStatus={couponPage.setStatus} onKind={couponPage.setKind} />
              {/* Coupons Card List */}
              {couponPage.error ? null : loadingCoupons ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: theme.textSecondary, fontSize: '0.8rem' }}>
                  Memuat daftar kupon...
                </div>
              ) : (() => {
                const filtered = coupons;
                if (filtered.length === 0) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '2.5rem 1rem',
                      backgroundColor: theme.surface,
                      borderRadius: '0.85rem',
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.65rem'
                    }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: theme.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Tag size={24} style={{ color: theme.textSecondary }} />
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary }}>
                        {couponSearchFilter ? 'Kupon Tidak Ditemukan' : 'Belum Ada Kupon'}
                      </div>
                      <p style={{ fontSize: '0.74rem', color: theme.textSecondary, margin: 0, maxWidth: '280px', lineHeight: 1.4 }}>
                        {couponSearchFilter
                          ? `Tidak ada kupon yang cocok dengan kata kunci "${couponSearchFilter}".`
                          : 'Buat kupon promosi atau kupon uji coba gratis untuk merchant pertama Anda.'}
                      </p>
                      {!couponSearchFilter && (
                        <button
                          type="button"
                          className="finance-action"
                          onClick={handleOpenCreateCouponModal}
                          style={{
                            minHeight: '44px',
                            padding: '0 1rem',
                            borderRadius: '0.55rem',
                            backgroundColor: '#10b981',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            marginTop: '0.5rem'
                          }}
                        >
                          <Plus size={15} />
                          <span>Buat Kupon Pertama</span>
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map((item: any) => {
                      const isFree = item.type === 'free';
                      const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
                      const isLimitReached = item.usage_limit > 0 && item.used_count >= item.usage_limit;

                      return (
                        <div
                          key={item.id || item.code}
                          style={{
                            padding: '1rem',
                            backgroundColor: theme.surface,
                            borderRadius: '0.85rem',
                            border: `1px solid ${item.is_active && !isExpired && !isLimitReached ? theme.border : 'rgba(239, 68, 68, 0.25)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.65rem'
                          }}
                        >
                          {/* Card Top: Code + Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 900, color: theme.textPrimary, letterSpacing: '0.04em' }}>
                                {item.code}
                              </span>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                backgroundColor: isFree ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                                color: isFree ? '#10b981' : '#0284c7',
                                border: isFree ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)'
                              }}>
                                {isFree ? '100% GRATIS' : `DISKON Rp ${Number(item.discount || 0).toLocaleString('id-ID')}`}
                              </span>
                            </div>

                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: !item.is_active ? 'rgba(239, 68, 68, 0.12)' : (isExpired || isLimitReached ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)'),
                              color: !item.is_active ? '#ef4444' : (isExpired || isLimitReached ? '#f59e0b' : '#10b981'),
                              border: !item.is_active ? '1px solid rgba(239, 68, 68, 0.25)' : (isExpired || isLimitReached ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)')
                            }}>
                              {!item.is_active ? 'NONAKTIF' : (isExpired ? 'KEDALUWARSA' : (isLimitReached ? 'HABIS' : 'AKTIF'))}
                            </span>
                          </div>

                          {/* Label Description */}
                          <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
                            {item.label}
                          </div>

                          {/* Metadata row */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.5rem',
                            padding: '0.55rem 0.75rem',
                            backgroundColor: theme.cardAlt,
                            borderRadius: '0.5rem',
                            fontSize: '0.72rem'
                          }}>
                            <div>
                              <span style={{ color: theme.textSecondary }}>Pemakaian: </span>
                              <strong style={{ color: theme.textPrimary }}>
                                {item.used_count || 0} {item.usage_limit > 0 ? `/ ${item.usage_limit}` : '(Tanpa batas)'}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: theme.textSecondary }}>Berlaku: </span>
                              <strong style={{ color: theme.textPrimary }}>
                                {item.expires_at ? new Date(item.expires_at).toLocaleDateString('id-ID') : 'Permanen'}
                              </strong>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '0.4rem', borderTop: `1px solid ${theme.border}`, paddingTop: '0.55rem' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(item.code)}
                              disabled={togglingCouponCode === item.code}
                              style={{
                                flex: 1,
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                borderRadius: '0.45rem',
                                border: `1px solid ${theme.border}`,
                                backgroundColor: item.is_active ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                color: item.is_active ? '#ef4444' : '#10b981',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <Power size={13} />
                              <span>{togglingCouponCode === item.code ? '...' : (item.is_active ? 'Nonaktifkan' : 'Aktifkan')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditCouponModal(item)}
                              style={{
                                flex: 1,
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                borderRadius: '0.45rem',
                                border: `1px solid ${theme.border}`,
                                backgroundColor: theme.surface,
                                color: theme.textPrimary,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Yakin ingin menghapus kupon "${item.code}"?`)) {
                                  handleDeleteCoupon(item.code);
                                }
                              }}
                              disabled={deletingCouponCode === item.code}
                              style={{
                                width: '44px',
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '0.45rem',
                                border: `1px solid ${theme.border}`,
                                backgroundColor: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <FinancePager list={couponPage} device="mobile" />
            </div>
          )}

          {/* Modal Bottom Sheet Add/Edit Coupon (Mobile) */}
          {showCouponModal && (() => {
            const onCouponTouchStart = (e: React.TouchEvent) => {
              couponTouchStartYRef.current = e.touches[0].clientY;
              couponDragYRef.current = 0;
              setIsDraggingCoupon(true);
            };
            const onCouponTouchMove = (e: React.TouchEvent) => {
              if (couponTouchStartYRef.current === null) return;
              const rawDelta = e.touches[0].clientY - couponTouchStartYRef.current;
              const damped = rawDelta < 0 ? rawDelta * 0.18 : rawDelta;
              couponDragYRef.current = damped;
              setCouponDragY(damped);
            };
            const onCouponTouchEnd = () => {
              const delta = couponDragYRef.current;
              couponTouchStartYRef.current = null;
              couponDragYRef.current = 0;
              setIsDraggingCoupon(false);
              if (delta >= 70) {
                setCouponDragY(520);
                setTimeout(() => {
                  setCouponDragY(0);
                  setShowCouponModal(false);
                }, 220);
              } else {
                setCouponDragY(0);
              }
            };
            return (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                animation: 'fadeIn 0.2s ease'
              }}
              onClick={() => { setCouponDragY(0); setShowCouponModal(false); }}
            >
              <div
                style={{
                  backgroundColor: theme.surface,
                  borderTopLeftRadius: '1.25rem',
                  borderTopRightRadius: '1.25rem',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
                  overflow: 'hidden',
                  transform: `translateY(${couponDragY}px)`,
                  transition: isDraggingCoupon ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle Bar + Clean Header (Anti-Stiff touchAction: none, no X button) */}
                <div
                  onTouchStart={onCouponTouchStart}
                  onTouchMove={onCouponTouchMove}
                  onTouchEnd={onCouponTouchEnd}
                  style={{ touchAction: 'none', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0.35rem 0' }}>
                    <div style={{ width: '38px', height: '4px', borderRadius: '999px', backgroundColor: theme.border }} />
                  </div>

                  {/* Clean Header (Haram tombol close 'X' di header per standard mobile) */}
                  <div style={{ padding: '0.5rem 1.25rem 0.85rem 1.25rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag size={18} color="#10b981" />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary }}>
                        {editingCoupon ? `Edit Kupon ${editingCoupon.code}` : 'Tambah Kupon Baru'}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary }}>
                        Konfigurasi aturan pemotongan biaya pendaftaran &amp; paket.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSaveCoupon} style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                      Kode Kupon (Wajib Huruf Besar/Angka) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="CONTOH: PROMOHEMAT"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.55rem',
                        backgroundColor: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        color: theme.textPrimary,
                        fontSize: '0.82rem',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                      Deskripsi / Label Kupon *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Diskon Grand Opening 50%"
                      value={couponForm.label}
                      onChange={(e) => setCouponForm({ ...couponForm, label: e.target.value })}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.55rem',
                        backgroundColor: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        color: theme.textPrimary,
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Tipe Kupon Segmented Switcher */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                      Tipe Kupon
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                      <button
                        type="button"
                        onClick={() => setCouponForm({ ...couponForm, type: 'discount' })}
                        style={{
                          minHeight: '44px',
                          borderRadius: '0.55rem',
                          border: couponForm.type === 'discount' ? '2px solid #10b981' : `1px solid ${theme.border}`,
                          backgroundColor: couponForm.type === 'discount' ? 'rgba(16, 185, 129, 0.12)' : theme.cardAlt,
                          color: couponForm.type === 'discount' ? '#10b981' : theme.textSecondary,
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Percent size={14} />
                        <span>Potongan Nominal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCouponForm({ ...couponForm, type: 'free', discount: 0 })}
                        style={{
                          minHeight: '44px',
                          borderRadius: '0.55rem',
                          border: couponForm.type === 'free' ? '2px solid #10b981' : `1px solid ${theme.border}`,
                          backgroundColor: couponForm.type === 'free' ? 'rgba(16, 185, 129, 0.12)' : theme.cardAlt,
                          color: couponForm.type === 'free' ? '#10b981' : theme.textSecondary,
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Gratis 100% (Free)</span>
                      </button>
                    </div>
                  </div>

                  {couponForm.type === 'discount' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                        Nominal Potongan (Rp) *
                      </label>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        required
                        value={couponForm.discount}
                        onChange={(e) => setCouponForm({ ...couponForm, discount: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '0.55rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          color: theme.textPrimary,
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                        Batas Pakai (0 = Bebas)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={couponForm.usage_limit}
                        onChange={(e) => setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '0.55rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          color: theme.textPrimary,
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textPrimary, display: 'block', marginBottom: '0.35rem' }}>
                        Tanggal Kedaluwarsa
                      </label>
                      <input
                        type="date"
                        value={couponForm.expires_at}
                        onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '0.55rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          color: theme.textPrimary,
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Switch is_active */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`
                  }}>
                    <input
                      type="checkbox"
                      checked={couponForm.is_active}
                      onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.78rem', color: theme.textPrimary, display: 'block' }}>Kupon Aktif</strong>
                      <span style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Pengguna dapat langsung menerapkan kupon ini saat checkout.</span>
                    </div>
                  </label>

                  {/* Footer Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowCouponModal(false)}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        padding: '0.65rem',
                        borderRadius: '0.55rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: 'transparent',
                        color: theme.textSecondary,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingCoupon}
                      style={{
                        flex: 1.5,
                        minHeight: '44px',
                        padding: '0.65rem',
                        borderRadius: '0.55rem',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: savingCoupon ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {savingCoupon ? 'Menyimpan...' : (editingCoupon ? 'Simpan Perubahan' : 'Buat Kupon')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 6: MONETISASI & INTEGRASI GOOGLE (ADSENSE & ANALYTICS)          */}
      {/* ========================================================================= */}
      {activeView === 'monetization' && canAccessMonetization && (
        <AdminMonetizationConsole
          device="mobile"
          token={token}
          isDark={isDark}
          theme={theme as any}
          onToast={(msg, type) => showToast(msg, type || 'success')}
        />
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. MODULE 7: SIARAN BROADCAST                                             */}
      {/* ========================================================================= */}
      {activeView === 'broadcast' && canAccessBroadcast && (
        <ErrorBoundary sectionName="Siaran Broadcast">
          <AdminBroadcastConsole
            device="mobile"
            token={token}
            isDark={isDark}
            theme={theme}
            refreshRevision={broadcastRefreshRev}
            onToast={(msg, type) => showToast(msg, type || 'info')}
            SelectComponent={MobileCustomSelect}
            RichTextareaComponent={RichTextarea}
            FormattedTextComponent={FormattedText}
            checkUrlSecurity={checkUrlSecurity}
            cleanDomainString={cleanDomainString}
            useModalBackHandlerHook={useModalBackHandler}
            onSummaryChange={(count, sub) => {
              setBroadcastActiveCount(count);
              setBroadcastSubViewState(sub);
            }}
          />
        </ErrorBoundary>
      )}

      {/* MODULE: MARKET INTELLIGENCE & B2B RESEARCH                                */}
      {/* ========================================================================= */}
      {activeView === 'market_intel' && canAccessMarketIntel && (
        <div style={{ animation: 'fadeIn 0.25s ease-out', paddingBottom: '4.5rem' }}>
          <ErrorBoundary sectionName="Riset Pasar B2B">
            <MobileMarketIntelView
              token={token}
              themeMode={isDark ? 'dark' : 'light'}
              showToast={showToast}
              canTriggerBot={isSuperAdmin(currentUser) || hasPermission(currentUser, 'system:automation:manage')}
              revision={marketIntelRevision}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 7B: DEDICATED AUTOMATION ENGINE PORTAL                          */}
      {/* ========================================================================= */}
      {activeView === 'automation' && canAccessAutomation && (
        <ErrorBoundary sectionName="Mesin otomasi">
          <AutomationConsole token={token} canManage={hasPermission(currentUser, 'system:automation:manage') || isSuperAdmin(currentUser)}
            device="mobile" theme={theme} isDark={isDark} revision={automationRevision} Catalog={AutomationCatalog} />
        </ErrorBoundary>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 8: AUDIT TRAIL LOGS                                             */}
      {/* ========================================================================= */}
      {activeView === 'audit' && canAccessAudit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Audit Header Bar & Compliance Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.25rem 0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                  System-Wide Audit Trail
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>
                  Jejak forensik &amp; kepatuhan seluruh tindakan administratif
                </p>
              </div>
              <button
                type="button"
                disabled={isLoadingAudit}
                onClick={() => fetchAuditLogs(1, false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  minHeight: '44px',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.65rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.surface,
                  color: theme.textPrimary,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: isLoadingAudit ? 0.6 : 1,
                  boxShadow: theme.cardShadow,
                  flexShrink: 0
                }}
              >
                <RefreshCw size={13} className={isLoadingAudit ? 'animate-spin' : ''} color="#3b82f6" />
                <span>Segarkan</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isVerifyingAudit}
                onClick={async () => {
                  if (!token) return;
                  setIsVerifyingAudit(true);
                  try {
                    const report = await verifyAuditChainApi(token);
                    setAuditVerifyReport(report);
                    showToast(
                      report.intact
                        ? `Rantai hash utuh (${report.chained_count} entri terverifikasi)`
                        : `Peringatan integritas rantai: ${report.reason}`,
                      report.intact ? 'success' : 'error'
                    );
                  } catch (err: any) {
                    showToast(err?.message || 'Gagal memverifikasi rantai audit', 'error');
                  } finally {
                    setIsVerifyingAudit(false);
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${auditVerifyReport ? (auditVerifyReport.intact ? '#10b981' : '#ef4444') : theme.border}`,
                  backgroundColor: theme.surface,
                  color: theme.textPrimary,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: isVerifyingAudit ? 'not-allowed' : 'pointer',
                  opacity: isVerifyingAudit ? 0.6 : 1,
                  boxShadow: theme.cardShadow
                }}
              >
                <ShieldCheck size={14} color={auditVerifyReport?.intact === false ? '#ef4444' : '#10b981'} />
                <span>{isVerifyingAudit ? 'Verifikasi...' : 'Verifikasi Rantai'}</span>
              </button>
              <button
                type="button"
                disabled={isExportingAudit}
                onClick={async () => {
                  if (!token) return;
                  setIsExportingAudit(true);
                  try {
                    const filename = await exportAuditLogsFile({
                      endpoint: '/api/admin/audit-logs/export',
                      token,
                      format: 'csv',
                      category: auditCategoryFilter,
                      role: auditRoleFilter,
                      q: debouncedAuditSearch,
                    });
                    showToast(`Berhasil mengekspor ${filename}`, 'success');
                  } catch (err: any) {
                    showToast(err?.message || 'Gagal mengekspor CSV audit', 'error');
                  } finally {
                    setIsExportingAudit(false);
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.surface,
                  color: theme.textPrimary,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: isExportingAudit ? 'not-allowed' : 'pointer',
                  opacity: isExportingAudit ? 0.6 : 1,
                  boxShadow: theme.cardShadow
                }}
              >
                <Download size={14} color="#3b82f6" />
                <span>{isExportingAudit ? 'Ekspor...' : 'Ekspor CSV'}</span>
              </button>
            </div>
          </div>

          {/* Hash Chain Verification Banner */}
          {auditVerifyReport && (
            <div style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.75rem',
              border: `1px solid ${auditVerifyReport.intact ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.4)'}`,
              backgroundColor: auditVerifyReport.intact
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5')
                : (isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                {auditVerifyReport.intact
                  ? <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                  : <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />}
                <div style={{ fontSize: '0.7rem', color: theme.textPrimary, lineHeight: 1.35 }}>
                  <strong style={{ color: auditVerifyReport.intact ? '#10b981' : '#ef4444' }}>
                    {auditVerifyReport.intact ? 'Rantai Utuh' : 'Rantai Bermasalah'}
                  </strong>
                  {' · '}
                  {auditVerifyReport.chained_count} entri terverifikasi (seq #{auditVerifyReport.last_chain_seq})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditVerifyReport(null)}
                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '0.2rem', display: 'flex', flexShrink: 0 }}
                aria-label="Tutup banner verifikasi"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Search Bar Input */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color={theme.textMuted} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={auditSearchInput}
              onChange={(e) => setAuditSearchInput(e.target.value)}
              placeholder="Cari aksi, deskripsi, atau email aktor..."
              style={{
                width: '100%',
                padding: '0.55rem 2.2rem 0.55rem 2.25rem',
                borderRadius: '0.75rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.surface,
                color: theme.textPrimary,
                fontSize: '0.78rem',
                boxSizing: 'border-box',
                outline: 'none',
                boxShadow: theme.cardShadow
              }}
            />
            {auditSearchInput && (
              <button
                type="button"
                onClick={() => setAuditSearchInput('')}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '0.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: theme.textMuted
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Category Filter Pills */}
          <div style={{
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {PLATFORM_AUDIT_CATEGORIES.map((cat) => {
              const iconMap: Record<string, any> = {
                all: History,
                security: Shield,
                catalog: ShoppingBag,
                store: Store,
                billing: CreditCard,
                moderation: AlertTriangle,
                superadmin: ShieldAlert,
                market_intel: TrendingUp,
                system: Server
              };
              const isActive = auditCategoryFilter === cat.key;
              const IconComp = iconMap[cat.key] || Activity;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setAuditCategoryFilter(cat.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '999px',
                    border: `1.5px solid ${isActive ? '#3b82f6' : theme.border}`,
                    backgroundColor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : theme.surface,
                    color: isActive ? '#3b82f6' : theme.textSecondary,
                    fontSize: '0.72rem',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={13} color={isActive ? '#3b82f6' : theme.textMuted} />
                  <span>{cat.shortLabel || cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Role Filter Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            overflowX: 'auto',
            paddingBottom: '0.15rem'
          }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textMuted, marginRight: '0.2rem', whiteSpace: 'nowrap' }}>
              Aktor:
            </span>
            {PLATFORM_AUDIT_ROLES.map((r) => {
              const isActive = auditRoleFilter === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setAuditRoleFilter(r.value)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${isActive ? (isDark ? '#60a5fa' : '#3b82f6') : theme.border}`,
                    backgroundColor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.12)') : 'transparent',
                    color: isActive ? (isDark ? '#93c5fd' : '#2563eb') : theme.textMuted,
                    fontSize: '0.68rem',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Audit Card List Stream */}
          {isLoadingAudit && auditLogs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '1rem 0' }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.95rem',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    opacity: 0.6
                  }}
                >
                  <div style={{ height: '14px', width: '40%', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: '4px' }} />
                  <div style={{ height: '12px', width: '85%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
                  <div style={{ height: '12px', width: '60%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <History size={38} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, marginBottom: '0.25rem' }}>
                Tidak ada rekaman audit
              </div>
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.74rem', lineHeight: 1.4 }}>
                {debouncedAuditSearch || auditCategoryFilter !== 'all' || auditRoleFilter !== 'all'
                  ? 'Tidak ada log aktivitas yang sesuai dengan kriteria filter saat ini.'
                  : 'Belum ada log audit keamanan atau aktivitas staf yang tercatat.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {auditLogs.map((log) => {
                const cat = (log.category || '').toLowerCase();
                let catColor = '#64748b';
                let catBg = isDark ? 'rgba(100, 116, 139, 0.15)' : '#f1f5f9';
                let catIcon = Activity;
                let catLabel = 'Aktivitas';

                if (cat === 'security') {
                  catColor = '#f59e0b';
                  catBg = isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7';
                  catIcon = Shield;
                  catLabel = 'Keamanan';
                } else if (cat === 'catalog') {
                  catColor = '#10b981';
                  catBg = isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5';
                  catIcon = ShoppingBag;
                  catLabel = 'Katalog';
                } else if (cat === 'store') {
                  catColor = '#3b82f6';
                  catBg = isDark ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe';
                  catIcon = Store;
                  catLabel = 'Toko';
                } else if (cat === 'billing') {
                  catColor = '#8b5cf6';
                  catBg = isDark ? 'rgba(139, 92, 246, 0.18)' : '#ede9fe';
                  catIcon = CreditCard;
                  catLabel = 'Finansial';
                } else if (cat === 'moderation') {
                  catColor = '#ef4444';
                  catBg = isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2';
                  catIcon = AlertTriangle;
                  catLabel = 'Moderasi';
                } else if (cat === 'superadmin') {
                  catColor = '#dc2626';
                  catBg = isDark ? 'rgba(220, 38, 38, 0.18)' : '#fee2e2';
                  catIcon = ShieldAlert;
                  catLabel = 'Superadmin';
                } else if (cat === 'market_intel') {
                  catColor = '#0284c7';
                  catBg = isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe';
                  catIcon = TrendingUp;
                  catLabel = 'Riset Pasar';
                } else if (cat === 'system') {
                  catColor = '#06b6d4';
                  catBg = isDark ? 'rgba(6, 182, 212, 0.18)' : '#cffafe';
                  catIcon = Server;
                  catLabel = 'Sistem';
                }
                const CatIconComp = catIcon;

                return (
                  <div
                    key={log.id || log.created_at}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedAuditLog(log);
                      setShowAuditDetailSheet(true);
                    }}
                    style={{
                      padding: '0.95rem',
                      borderRadius: '1rem',
                      backgroundColor: theme.surface,
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.cardShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, border-color 0.15s ease'
                    }}
                  >
                    {/* Card Header: Category Badge, Action, Timestamp */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          backgroundColor: catBg,
                          color: catColor
                        }}>
                          <CatIconComp size={11} color={catColor} />
                          <span>{catLabel}</span>
                        </span>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#3b82f6',
                          fontFamily: 'monospace'
                        }}>
                          {log.action || 'system.activity'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.66rem', color: theme.textMuted, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {/* Card Body: Description */}
                    <div style={{ fontSize: '0.76rem', color: theme.textPrimary, lineHeight: 1.45, fontWeight: 500 }}>
                      {log.description || log.entity_title || 'Tindakan operasional sistem'}
                    </div>

                    {/* Entity Snapshot (if present) */}
                    {(log.entity_title || log.entity_type) && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.5rem',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        fontSize: '0.68rem',
                        color: theme.textSecondary,
                        width: 'fit-content'
                      }}>
                        <span style={{ fontWeight: 700, color: theme.textMuted }}>Target:</span>
                        <span style={{ fontWeight: 600 }}>{log.entity_title || log.entity_type}</span>
                        {log.entity_id ? <span style={{ color: theme.textMuted }}>#{log.entity_id}</span> : null}
                      </div>
                    )}

                    {/* Card Footer: Actor, Role, IP */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.2rem',
                      paddingTop: '0.45rem',
                      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                      fontSize: '0.68rem',
                      color: theme.textMuted
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, overflow: 'hidden' }}>
                        <User size={12} color={theme.textMuted} />
                        <span style={{ fontWeight: 700, color: theme.textSecondary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {log.actor_name || log.actor_email || log.user_email || 'Sistem'}
                        </span>
                        <span style={{
                          padding: '0.05rem 0.35rem',
                          borderRadius: '4px',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          backgroundColor: log.actor_role === 'superadmin' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                          color: log.actor_role === 'superadmin' ? '#ef4444' : '#3b82f6'
                        }}>
                          {log.actor_role || 'staf'}
                        </span>
                      </div>
                      {log.ip_address && (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.64rem', color: theme.textMuted }}>
                          {log.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Progressive Load More Action Bar */}
              <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                  Menampilkan {auditLogs.length} dari {auditTotal || auditLogs.length} rekaman audit
                </span>
                {auditHasMore ? (
                  <button
                    type="button"
                    disabled={isLoadingMoreAudit}
                    onClick={() => fetchAuditLogs(auditPage + 1, true)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      borderRadius: '0.85rem',
                      border: `1.5px solid ${theme.border}`,
                      backgroundColor: theme.surface,
                      color: '#3b82f6',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxShadow: theme.cardShadow
                    }}
                  >
                    {isLoadingMoreAudit ? (
                      <>
                        <Loader2 size={15} className="animate-spin" color="#3b82f6" />
                        <span>Memuat Rekaman Berikutnya...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown size={15} color="#3b82f6" />
                        <span>Muat 15 Log Berikutnya</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    color: theme.textMuted,
                    fontSize: '0.68rem',
                    fontWeight: 600
                  }}>
                    Seluruh rekaman audit telah dimuat
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SLIDE-UP FORENSIC BOTTOM SHEET (DETAIL INSPECTOR) */}
          {showAuditDetailSheet && selectedAuditLog && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                animation: 'fadeIn 0.2s ease-out'
              }}
              onClick={() => setShowAuditDetailSheet(false)}
            >
              <div
                style={{
                  backgroundColor: theme.surface,
                  borderTopLeftRadius: '1.35rem',
                  borderTopRightRadius: '1.35rem',
                  border: `1px solid ${theme.border}`,
                  borderBottom: 'none',
                  maxHeight: '88vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
                  animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle Bar (Touch Action Isolation) */}
                <div
                  style={{
                    padding: '0.65rem 0 0.35rem',
                    display: 'flex',
                    justifyContent: 'center',
                    touchAction: 'none'
                  }}
                >
                  <div style={{ width: '40px', height: '4px', borderRadius: '999px', backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                </div>

                {/* Sheet Header */}
                <div style={{
                  padding: '0.65rem 1.15rem 0.85rem',
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: '#3b82f6',
                        fontFamily: 'monospace'
                      }}>
                        [{selectedAuditLog.action || 'system.log'}]
                      </span>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#dbeafe',
                        color: '#3b82f6'
                      }}>
                        ID #{selectedAuditLog.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: '0.15rem', fontFamily: 'monospace' }}>
                      {selectedAuditLog.created_at ? new Date(selectedAuditLog.created_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }) : '-'}
                    </div>
                  </div>
                </div>

                {/* Sheet Body (Scrollable Container) */}
                <div style={{
                  padding: '1.15rem',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Section 1: Narrative Description */}
                  <div style={{
                    padding: '0.85rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${theme.border}`
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textMuted, marginBottom: '0.25rem' }}>
                      Deskripsi Rekaman:
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.textPrimary, lineHeight: 1.5 }}>
                      {selectedAuditLog.description || selectedAuditLog.target || 'Tindakan operasional sistem'}
                    </div>
                  </div>

                  {/* Section 2: Actor & Network Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ fontSize: '0.64rem', color: theme.textMuted, fontWeight: 700 }}>Aktor Pelaksana</div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>
                        {selectedAuditLog.actor_name || selectedAuditLog.actor_email || 'Sistem'}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: theme.textSecondary, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {selectedAuditLog.actor_email || '-'}
                      </div>
                      <div style={{ marginTop: '0.3rem' }}>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          backgroundColor: selectedAuditLog.actor_role === 'superadmin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: selectedAuditLog.actor_role === 'superadmin' ? '#ef4444' : '#3b82f6'
                        }}>
                          {selectedAuditLog.actor_role || 'staf'}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ fontSize: '0.64rem', color: theme.textMuted, fontWeight: 700 }}>Alamat IP & Jaringan</div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.textPrimary, fontFamily: 'monospace', marginTop: '0.2rem' }}>
                        {selectedAuditLog.ip_address || '127.0.0.1'}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedAuditLog.user_agent ? 'Browser Client' : 'Internal Service'}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Entity Snapshot */}
                  {(selectedAuditLog.entity_type || selectedAuditLog.entity_title || selectedAuditLog.entity_id) && (
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ fontSize: '0.64rem', color: theme.textMuted, fontWeight: 700, marginBottom: '0.35rem' }}>
                        Entitas Sasaran (Target)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                          color: '#10b981'
                        }}>
                          {selectedAuditLog.entity_type || 'Entity'}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary }}>
                          {selectedAuditLog.entity_title || `ID #${selectedAuditLog.entity_id}`}
                        </span>
                        {selectedAuditLog.entity_id && (
                          <span style={{ fontSize: '0.68rem', color: theme.textMuted, fontFamily: 'monospace' }}>
                            (ID: {selectedAuditLog.entity_id})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section 4: User Agent (if present) */}
                  {selectedAuditLog.user_agent && (
                    <div>
                      <div style={{ fontSize: '0.66rem', color: theme.textMuted, fontWeight: 700, marginBottom: '0.25rem' }}>
                        Client User-Agent:
                      </div>
                      <div style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
                        border: `1px solid ${theme.border}`,
                        fontSize: '0.66rem',
                        color: theme.textSecondary,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {selectedAuditLog.user_agent}
                      </div>
                    </div>
                  )}

                  {/* Section 5: Payload / Changes Data Forensik */}
                  {(selectedAuditLog.changes || selectedAuditLog.payload) && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textPrimary }}>
                          Data Perubahan / Payload Forensik:
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const raw = selectedAuditLog.changes || selectedAuditLog.payload;
                            const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
                            navigator.clipboard.writeText(text);
                            setCopiedAuditPayload(true);
                            showToast('Payload audit disalin ke clipboard');
                            setTimeout(() => setCopiedAuditPayload(false), 2000);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          {copiedAuditPayload ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          <span>{copiedAuditPayload ? 'Tersalin' : 'Salin JSON'}</span>
                        </button>
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: '0.85rem',
                        borderRadius: '0.65rem',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : '#0f172a',
                        color: '#38bdf8',
                        border: `1px solid ${theme.border}`,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        maxHeight: '220px'
                      }}>
                        {typeof (selectedAuditLog.changes || selectedAuditLog.payload) === 'string'
                          ? (selectedAuditLog.changes || selectedAuditLog.payload)
                          : JSON.stringify(selectedAuditLog.changes || selectedAuditLog.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Sheet Footer: Dismiss Button */}
                <div style={{
                  padding: '0.85rem 1.15rem',
                  borderTop: `1px solid ${theme.border}`,
                  backgroundColor: theme.surface
                }}>
                  <button
                    type="button"
                    onClick={() => setShowAuditDetailSheet(false)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.85rem',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                      color: theme.textPrimary,
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Tutup Detail Forensik
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE: DATA MASTER PLATFORM (DOMAIN WHITELIST & TEMPLATE CS)           */}
      {/* ========================================================================= */}
      {activeView === 'master_data' && canAccessMasterData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* 1. MASTER HUB: MENU PILIHAN MASTER PLATFORM */}
          {masterSubView === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Header Hero Banner */}
              <div style={{
                padding: '1rem',
                borderRadius: '1rem',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
                border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '0.85rem',
                  background: isDark
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  flexShrink: 0
                }}>
                  <Database size={22} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: theme.textPrimary,
                      letterSpacing: '-0.01em'
                    }}>
                      Data Master
                    </h4>
                    <span style={{
                      fontSize: '0.62rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      fontWeight: 700,
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.12)',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`
                    }}>
                      Pilihan Master
                    </span>
                  </div>
                  <p style={{
                    margin: '0.2rem 0 0 0',
                    fontSize: '0.72rem',
                    color: theme.textSecondary,
                    lineHeight: 1.35
                  }}>
                    Pilih entitas data acuan atau konfigurasi master di bawah ini untuk dikelola.
                  </p>
                </div>
              </div>

              {/* Grid / List of Master Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem'
              }}>
                {/* Master Option 1: Master Domain Aman */}
                {canManageSystemSettings && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMasterSubView('domains');
                    updatePlatformUrl('master_data', null, 'domains');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMasterSubView('domains');
                      updatePlatformUrl('master_data', null, 'domains');
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.card,
                    border: `1.5px solid ${isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.2)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.85rem',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)'}`,
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Globe size={21} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                            Master Domain Aman
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                          Whitelist URL & Ekosistem
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      whiteSpace: 'nowrap'
                    }}>
                      Proteksi Keamanan
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 0.85rem 0',
                    fontSize: '0.73rem',
                    color: theme.textSecondary,
                    lineHeight: 1.45
                  }}>
                    Kelola daftar whitelist URL domain mitra resmi, verifikasi akses keluar bebas hambatan, dan proteksi phishing ekosistem.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#10b981'
                  }}>
                    <span>Buka Master Domain</span>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
                )}

                {/* Master Option 2: Template Pesan Cepat CS */}
                {canManageSupportTemplates && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMasterSubView('templates');
                    updatePlatformUrl('master_data', null, 'templates');
                    fetchCannedTemplates(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMasterSubView('templates');
                      updatePlatformUrl('master_data', null, 'templates');
                      fetchCannedTemplates(true);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.card,
                    border: `1.5px solid ${isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.2)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isDark ? '#38bdf8' : '#0284c7';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.85rem',
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(2, 132, 199, 0.1)',
                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)'}`,
                        color: isDark ? '#38bdf8' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Zap size={21} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                            Template Pesan Cepat CS
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 700 }}>
                          Canned Responses & Makro Tiket
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.1)',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
                      whiteSpace: 'nowrap'
                    }}>
                      {cannedTemplates.length} Template
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 0.85rem 0',
                    fontSize: '0.73rem',
                    color: theme.textSecondary,
                    lineHeight: 1.45
                  }}>
                    Kumpulan template jawaban live chat, makro penanganan masalah, dan standarisasi respon operasional staf CS platform.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: isDark ? '#38bdf8' : '#0284c7'
                  }}>
                    <span>Buka Template CS</span>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
                )}

                {/* Master Option 3: Mitra Rekber Syariah (rekbersyariah.com) */}
                {canManageSystemSettings && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMasterSubView('rekber');
                    updatePlatformUrl('master_data', null, 'rekber');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMasterSubView('rekber');
                      updatePlatformUrl('master_data', null, 'rekber');
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.card,
                    border: `1.5px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.8rem',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)',
                        border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.25)'}`,
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                          Mitra Rekber Syariah
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                          Integrasi Escrow Amanah
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: googleSettings.rekber_enabled !== '0'
                        ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)')
                        : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                      color: googleSettings.rekber_enabled !== '0' ? '#10b981' : '#ef4444',
                      border: `1px solid ${googleSettings.rekber_enabled !== '0' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      whiteSpace: 'nowrap'
                    }}>
                      {googleSettings.rekber_enabled !== '0' ? '● Aktif' : '○ Nonaktif'}
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 0.85rem 0',
                    fontSize: '0.73rem',
                    color: theme.textSecondary,
                    lineHeight: 1.45
                  }}>
                    Kelola URL website resmi rekbersyariah.com, kontak WhatsApp resmi admin rekber, dan kustomisasi template pesan WhatsApp transaksi aman.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#10b981'
                  }}>
                    <span>Buka Pengaturan Rekber</span>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
                )}

                {/* Master Option 4: Kontak Resmi Platform (WhatsApp & Email Bantuan) */}
                {canManageSystemSettings && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMasterSubView('contact');
                    updatePlatformUrl('master_data', null, 'contact');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMasterSubView('contact');
                      updatePlatformUrl('master_data', null, 'contact');
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.card,
                    border: `1.5px solid ${isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.25)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.8rem',
                        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)',
                        border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.4)' : 'rgba(37, 99, 235, 0.25)'}`,
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Headphones size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                          Kontak Resmi Platform
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>
                          WhatsApp & Email Support
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                      color: '#2563eb',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      whiteSpace: 'nowrap'
                    }}>
                      Aktif
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.74rem',
                    color: theme.textSecondary,
                    lineHeight: 1.45,
                    margin: '0 0 0.85rem 0'
                  }}>
                    Kelola nomor WhatsApp CS dan email resmi yang tampil pada kartu bantuan teknis halaman checkout saat merchant mendaftar.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#2563eb'
                  }}>
                    <span>Buka Kontak Resmi</span>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
                )}

                {/* 5. Kebijakan & Legalitas Platform Card */}
                {canManageSystemSettings && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMasterSubView('policies');
                    updatePlatformUrl('master_data', null, 'policies');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMasterSubView('policies');
                      updatePlatformUrl('master_data', null, 'policies');
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.card,
                    border: `1.5px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.8rem',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)',
                        border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.25)'}`,
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Scale size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                          Kebijakan &amp; Legalitas Platform
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                          6 Pilar Regulasi &amp; Kontrol Versi
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      whiteSpace: 'nowrap'
                    }}>
                      6 Dokumen
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.74rem',
                    color: theme.textSecondary,
                    lineHeight: 1.45,
                    margin: '0 0 0.85rem 0'
                  }}>
                    Kelola Syarat Layanan, Komoditas Terlarang, Privasi &amp; Telemetri B2B (UU PDP), Moderasi 4 Tingkat, Transaksi Rekber, dan Langganan Merchant.
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.65rem',
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#10b981'
                  }}>
                    <span>Buka Pengaturan Kebijakan</span>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Extensibility & Scalability Information Card */}
              <div style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                border: `1px dashed ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem'
              }}>
                <Layers size={17} style={{ color: theme.textMuted, flexShrink: 0 }} />
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 700, color: theme.textPrimary }}>Arsitektur Master Modular: </span>
                  Data master baru seperti Master Kategori, Alasan Laporan, dan Pengaturan Sistem dapat ditambahkan langsung ke menu ini tanpa merombak navigasi tab.
                </div>
              </div>
            </div>
          )}

          {!canManageSystemSettings && masterSubView !== 'menu' && masterSubView !== 'templates' && (
            <AccessDeniedPanel
              moduleName="Pengaturan Master Sistem"
              roleSlug={roleSlug}
              isDark={isDark}
              onBack={() => {
                setMasterSubView('menu');
                updatePlatformUrl('master_data', null, null);
              }}
              backLabel="Kembali ke Data Master"
            />
          )}

          {/* SUB-VIEW 1: DOMAIN WHITELIST */}
          {canManageSystemSettings && masterSubView === 'domains' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <AdminSafeDomainsManagement
                token={token}
                themeMode={themeMode}
                onClose={() => {
                  setMasterSubView('menu');
                  updatePlatformUrl('master_data', null, null);
                }}
              />
            </div>
          )}

          {/* SUB-VIEW 2: MASTER CANNED RESPONSES (TEMPLATE CS) */}
          {canManageSupportTemplates && masterSubView === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Search Bar & Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.9rem', color: isDark ? '#94a3b8' : '#64748b', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className={`search-input ${isDark ? 'dark-input' : 'light-input'}`}
                    value={templateSearchQuery}
                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                    placeholder="Cari judul, shortcut (/salam), atau isi..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.2rem 0.65rem 2.5rem',
                      borderRadius: '0.85rem',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      outline: 'none',
                      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)',
                      boxSizing: 'border-box'
                    }}
                  />
                  {templateSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: isDark ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: '0.2rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Mobile Dropdown: Option Picker Bottom Sheet Modal */}
                <div>
                  <MobileCustomSelect
                    value={templateCategoryFilter}
                    onChange={(val) => {
                      setTemplateCategoryFilter(val);
                      setTemplatePage(1);
                    }}
                    options={mobileTemplateCategoryOptions}
                    title="Kategori Template CS"
                    subtitle="Menampilkan kategori template balasan yang tersedia"
                    placeholder="Pilih Kategori..."
                    icon={<Filter size={15} />}
                  />
                </div>
              </div>

              {/* Template Cards List */}
              {loadingTemplates ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: theme.textSecondary }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: isDark ? '#38bdf8' : '#0284c7' }} />
                  <span style={{ fontSize: '0.8rem' }}>Memuat master template...</span>
                </div>
              ) : cannedTemplates.length === 0 ? (
                <div style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: theme.surface,
                  borderRadius: '1rem',
                  border: `1px dashed ${theme.border}`,
                  color: theme.textMuted
                }}>
                  <Zap size={32} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.3 }} />
                  <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.25rem', color: theme.textPrimary }}>
                    Tidak Ada Template
                  </strong>
                  <p style={{ fontSize: '0.76rem', margin: '0 0 0.85rem', color: theme.textSecondary }}>
                    Belum ada template pada kategori atau kata kunci ini.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateTemplate}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Tambah Template
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {cannedTemplates.map(tmpl => {
                    const catColors: Record<string, { bg: string; text: string; label: string }> = {
                      general: { bg: 'rgba(56, 189, 248, 0.15)', text: isDark ? '#38bdf8' : '#0284c7', label: 'Umum' },
                      billing: { bg: 'rgba(16, 185, 129, 0.15)', text: isDark ? '#34d399' : '#059669', label: 'Keuangan' },
                      technical: { bg: 'rgba(245, 158, 11, 0.15)', text: isDark ? '#fbbf24' : '#d97706', label: 'Teknis' },
                      closing: { bg: 'rgba(168, 85, 247, 0.15)', text: isDark ? '#c084fc' : '#9333ea', label: 'Penutupan' },
                      account: { bg: 'rgba(244, 63, 94, 0.15)', text: isDark ? '#fb7185' : '#e11d48', label: 'Akun' }
                    };
                    const catInfo = catColors[tmpl.category] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: tmpl.category };

                    return (
                      <div
                        key={tmpl.id}
                        style={{
                          backgroundColor: theme.surface,
                          border: `1px solid ${tmpl.is_active !== false ? theme.border : 'rgba(148, 163, 184, 0.2)'}`,
                          borderRadius: '0.95rem',
                          padding: '0.95rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          opacity: tmpl.is_active !== false ? 1 : 0.65,
                          boxShadow: theme.cardShadow
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: catInfo.bg,
                                color: catInfo.text
                              }}>
                                {catInfo.label}
                              </span>

                              {tmpl.shortcut && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '0.35rem',
                                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                                  color: isDark ? '#38bdf8' : '#0284c7'
                                }}>
                                  /{tmpl.shortcut}
                                </span>
                              )}

                              <span style={{
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                padding: '0.08rem 0.35rem',
                                borderRadius: '0.3rem',
                                backgroundColor: tmpl.is_active !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                color: tmpl.is_active !== false ? (isDark ? '#34d399' : '#059669') : '#94a3b8'
                              }}>
                                {tmpl.is_active !== false ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>

                            <strong style={{ fontSize: '0.86rem', color: theme.textPrimary, fontWeight: 800, marginTop: '0.15rem' }}>
                              {tmpl.title}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleTemplateActive(tmpl)}
                              style={{
                                padding: '0.35rem',
                                borderRadius: '0.4rem',
                                backgroundColor: theme.cardAlt,
                                border: `1px solid ${theme.border}`,
                                color: tmpl.is_active !== false ? '#10b981' : '#94a3b8',
                                cursor: 'pointer'
                              }}
                              title={tmpl.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {tmpl.is_active !== false ? <Check size={12} /> : <X size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTemplate(tmpl)}
                              style={{
                                padding: '0.35rem',
                                borderRadius: '0.4rem',
                                backgroundColor: theme.cardAlt,
                                border: `1px solid ${theme.border}`,
                                color: isDark ? '#38bdf8' : '#0284c7',
                                cursor: 'pointer'
                              }}
                              title="Edit Template"
                            >
                              <Sliders size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tmpl.id, tmpl.title)}
                              style={{
                                padding: '0.35rem',
                                borderRadius: '0.4rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                              title="Hapus Template"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Template Content Box */}
                        <div style={{
                          padding: '0.65rem 0.75rem',
                          borderRadius: '0.65rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          fontSize: '0.78rem',
                          color: theme.textSecondary,
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}>
                          {tmpl.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Server-Side Pagination Controls for Template CS */}
              {templatePagination.total_pages > 1 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  padding: '0.95rem 1rem',
                  marginTop: '0.75rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '0.95rem',
                  border: `1px solid ${theme.border}`,
                  boxSizing: 'border-box',
                  width: '100%'
                }}>
                  {/* Row 1: Pagination Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    <button
                      type="button"
                      disabled={templatePage <= 1 || loadingTemplates}
                      onClick={() => {
                        setTemplatePage(p => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.65rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: theme.cardAlt,
                        color: templatePage <= 1 ? theme.textMuted : theme.textPrimary,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: templatePage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: templatePage <= 1 ? 0.45 : 1,
                        transition: 'all 0.15s ease',
                        boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <ChevronLeft size={15} />
                      <span>Sebelumnya</span>
                    </button>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '58px',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(2, 132, 199, 0.1)',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)'}`,
                      color: isDark ? '#38bdf8' : '#0284c7',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      letterSpacing: '0.02em'
                    }}>
                      <span>{templatePage}</span>
                      <span style={{ opacity: 0.5, margin: '0 0.25rem' }}>/</span>
                      <span>{templatePagination.total_pages}</span>
                    </div>

                    <button
                      type="button"
                      disabled={templatePage >= templatePagination.total_pages || loadingTemplates}
                      onClick={() => {
                        setTemplatePage(p => Math.min(templatePagination.total_pages, p + 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.65rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: theme.cardAlt,
                        color: templatePage >= templatePagination.total_pages ? theme.textMuted : theme.textPrimary,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: templatePage >= templatePagination.total_pages ? 'not-allowed' : 'pointer',
                        opacity: templatePage >= templatePagination.total_pages ? 0.45 : 1,
                        transition: 'all 0.15s ease',
                        boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <span>Berikutnya</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  {/* Row 2: Clean Info Row */}
                  <div style={{
                    fontSize: '0.74rem',
                    color: theme.textMuted,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    {(() => {
                      const totalCount = Number(templatePagination.total ?? cannedTemplates.length);
                      const startIdx = totalCount > 0 ? ((templatePage - 1) * templateLimit) + 1 : 0;
                      const endIdx = Math.min(templatePage * templateLimit, totalCount);
                      return (
                        <span>
                          Menampilkan <strong style={{ color: theme.textPrimary, fontWeight: 700 }}>{startIdx} - {endIdx}</strong> dari <strong style={{ color: theme.textPrimary, fontWeight: 700 }}>{totalCount}</strong> template
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 3: MASTER REKBER SYARIAH (INTEGRASI ESCROW RESMI) */}
          {canManageSystemSettings && masterSubView === 'rekber' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Security Advisory Callout */}
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '0.6rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Lock size={15} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <strong style={{ fontSize: '0.78rem', color: '#10b981' }}>
                    Otoritas Terpusat Platform
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                    Platform Catavor bermitra resmi eksklusif dengan <strong>rekbersyariah.com</strong>. Layanan Rekber Syariah aktif untuk 6 tipe katalog: <strong>Barang Fisik, Menu Kuliner, Item Digital, Jasa & Layanan, Tanaman, dan Satwa/Hewan</strong> (Properti otomatis dikecualikan via Notaris/PPAT).
                  </p>
                </div>
              </div>

              {/* Main Configuration Form */}
              <form onSubmit={handleSaveRekberSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* 1. MASTER TOGGLE & CREDENTIALS CARD */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: `1px solid ${theme.border}` }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary }}>
                        Status Master Layanan Rekber
                      </h4>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>
                        Kontrol global izin transaksi Rekber Syariah
                      </p>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: googleSettings.rekber_enabled !== '0'
                          ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)')
                          : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)'),
                        color: googleSettings.rekber_enabled !== '0' ? '#10b981' : '#ef4444',
                        border: `1px solid ${googleSettings.rekber_enabled !== '0' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                      }}>
                        {googleSettings.rekber_enabled !== '0' ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <input
                        type="checkbox"
                        checked={googleSettings.rekber_enabled !== '0'}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_enabled: e.target.checked ? '1' : '0'
                        }))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Partner Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary }}>
                        Nama Layanan Mitra
                      </label>
                      <input
                        type="text"
                        value={googleSettings.rekber_partner_name || 'Rekber Syariah'}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_partner_name: e.target.value
                        }))}
                        placeholder="Contoh: Rekber Syariah"
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.78rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Official Website URL */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary }}>
                          Alamat Website Resmi Mitra
                        </label>
                        {googleSettings.rekber_website_url && (
                          <a
                            href={googleSettings.rekber_website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              color: '#10b981',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <span>Tes Buka</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <input
                        type="url"
                        value={googleSettings.rekber_website_url !== undefined ? googleSettings.rekber_website_url : 'https://rekbersyariah.com'}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_website_url: e.target.value
                        }))}
                        placeholder="https://rekbersyariah.com"
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.78rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Official Admin WhatsApp Number */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary }}>
                        Nomor WhatsApp Resmi Admin Rekber
                      </label>
                      <input
                        type="text"
                        value={googleSettings.rekber_wa_number || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_wa_number: e.target.value.replace(/[^0-9]/g, '')
                        }))}
                        placeholder="Contoh: 62811220227 (Default resmi)"
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.78rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ fontSize: '0.67rem', color: theme.textMuted }}>
                        Format angka internasional (contoh: 628123456789).
                      </span>
                    </div>

                    {/* Partner Logo / Icon */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ImageIcon size={14} style={{ color: '#10b981' }} />
                        <span>Logo / Ikon Resmi Partner Rekber</span>
                      </label>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc',
                        border: `1px dashed ${theme.border}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Live Preview Box */}
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '0.65rem',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            <SafeImage
                              src={googleSettings.rekber_logo_url}
                              alt="Logo Partner"
                              emptyLabel="Logo Belum Diunggah"
                              emptySubLabel="Pilih berkas PNG/SVG"
                              errorLabel="Logo Rusak"
                              errorSubLabel="Tidak terbaca"
                              compact={true}
                              objectFit="contain"
                              isDark={isDark}
                              title={googleSettings.rekber_logo_url ? "Logo Partner Rekber" : "Logo mitra belum diunggah"}
                            />
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <input
                              type="file"
                              ref={rekberLogoInputRef}
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadRekberLogo(e.target.files[0]);
                                  e.target.value = '';
                                }
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => rekberLogoInputRef.current?.click()}
                                disabled={isUploadingRekberLogo}
                                className="btn-portal-secondary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderRadius: '0.5rem',
                                  cursor: isUploadingRekberLogo ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {isUploadingRekberLogo ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>Mengunggah...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={12} />
                                    <span>Pilih Gambar</span>
                                  </>
                                )}
                              </button>

                              {googleSettings.rekber_logo_url && (
                                <button
                                  type="button"
                                  onClick={() => setGoogleSettings(prev => ({ ...prev, rekber_logo_url: '' }))}
                                  className="btn-portal-secondary"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.4rem 0.65rem',
                                    fontSize: '0.72rem',
                                    color: '#ef4444',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                  }}
                                >
                                  <Trash2 size={12} />
                                  <span>Hapus</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={googleSettings.rekber_logo_url || ''}
                          onChange={(e) => setGoogleSettings(prev => ({ ...prev, rekber_logo_url: e.target.value }))}
                          placeholder="Atau tempel URL gambar (https://...)"
                          className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                            color: theme.textPrimary,
                            fontSize: '0.73rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />

                        <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                          Tampil di Landing Page platform (section Transaksi Aman) dan modal info rekber.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. DYNAMIC MESSAGE TEMPLATES CARD */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: theme.textPrimary }}>
                      Format Template Pesan WhatsApp
                    </h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: theme.textSecondary }}>
                      Template teks pesan yang otomatis terisi saat pembeli mengklik transaksi Rekber
                    </p>
                  </div>

                  {/* Variables Reference */}
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    border: `1px dashed ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Tag size={12} style={{ color: '#0284c7' }} />
                      <span>Variabel Dinamis:</span>
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {[
                        { code: '{item_name}', icon: <ShoppingBag size={10} /> },
                        { code: '{item_price}', icon: <DollarSign size={10} /> },
                        { code: '{item_type_label}', icon: <Layers size={10} /> },
                        { code: '{store_title}', icon: <Store size={10} /> },
                        { code: '{rekber_website_url}', icon: <Globe size={10} /> },
                        { code: '{rekber_website_domain}', icon: <LinkIcon size={10} /> },
                        { code: '{rekber_wa_number}', icon: <PhoneCall size={10} /> },
                        { code: '{rekber_wa_section}', icon: <ShieldCheck size={10} /> },
                      ].map((item, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.35rem',
                            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                            color: isDark ? '#38bdf8' : '#0284c7',
                            border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <span style={{ opacity: 0.85, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                          <code>{item.code}</code>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Template Tabs: 6 Allowed Types */}
                  <div style={{ display: 'flex', gap: '0.35rem', borderBottom: `1px solid ${theme.border}`, paddingBottom: '0.4rem', overflowX: 'auto' }}>
                    {[
                      { key: 'physical', label: 'Fisik', icon: <Package size={13} /> },
                      { key: 'food', label: 'Kuliner', icon: <Utensils size={13} /> },
                      { key: 'digital', label: 'Digital', icon: <FileCode size={13} /> },
                      { key: 'service', label: 'Jasa', icon: <Briefcase size={13} /> },
                      { key: 'plant', label: 'Tanaman', icon: <Sprout size={13} /> },
                      { key: 'fauna', label: 'Hewan', icon: <PawPrint size={13} /> },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setRekberActiveTemplateTab(tab.key as any)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: rekberActiveTemplateTab === tab.key
                            ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)')
                            : 'transparent',
                          color: rekberActiveTemplateTab === tab.key ? '#10b981' : theme.textSecondary,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Textarea per Catalog Type */}
                  <div>
                    {rekberActiveTemplateTab === 'physical' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_physical || googleSettings.rekber_template_general || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_physical: e.target.value,
                          rekber_template_general: e.target.value,
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_physical}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}

                    {rekberActiveTemplateTab === 'food' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_food || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_food: e.target.value
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_food}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}

                    {rekberActiveTemplateTab === 'digital' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_digital || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_digital: e.target.value
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_digital}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}

                    {rekberActiveTemplateTab === 'service' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_service || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_service: e.target.value
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_service}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}

                    {rekberActiveTemplateTab === 'plant' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_plant || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_plant: e.target.value
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_plant}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}

                    {rekberActiveTemplateTab === 'fauna' && (
                      <textarea
                        rows={5}
                        value={googleSettings.rekber_template_fauna || ''}
                        onChange={(e) => setGoogleSettings(prev => ({
                          ...prev,
                          rekber_template_fauna: e.target.value
                        }))}
                        placeholder={REKBER_FACTORY_DEFAULTS.rekber_template_fauna}
                        className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          color: theme.textPrimary,
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.4,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}
                  </div>

                  {/* Live Simulation Preview */}
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? '#064e3b' : '#dcfce7',
                    color: isDark ? '#ecfdf5' : '#14532d',
                    fontSize: '0.72rem',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
                  }}>
                    {(() => {
                      const websiteUrl = googleSettings.rekber_website_url || 'https://rekbersyariah.com';
                      let websiteDomain = 'rekbersyariah.com';
                      try {
                        websiteDomain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname || 'rekbersyariah.com';
                      } catch { }
                      const waNumber = (googleSettings.rekber_wa_number || '62811220227').trim();
                      const cleanWANum = waNumber.replace(/\D/g, '') || '62811220227';
                      const waLink = `https://wa.me/${cleanWANum}`;
                      const waSection = ` atau hubungi WhatsApp Admin Rekber Syariah di *+${cleanWANum}* agar dapat dibuatkan grup transaksi bersama`;

                      let tmpl = '';
                      let sampleName = 'Sepatu Sneakers Vintage Original';
                      let samplePrice = 'Rp 450.000';
                      let typeLabel = 'Barang Fisik';

                      if (rekberActiveTemplateTab === 'food') {
                        tmpl = googleSettings.rekber_template_food || REKBER_FACTORY_DEFAULTS.rekber_template_food;
                        sampleName = 'Paket Nasi Kebuli Kambing Spesial';
                        samplePrice = 'Rp 85.000';
                        typeLabel = 'Menu Kuliner';
                      } else if (rekberActiveTemplateTab === 'digital') {
                        tmpl = googleSettings.rekber_template_digital || REKBER_FACTORY_DEFAULTS.rekber_template_digital;
                        sampleName = 'Preset Lightroom Pro & Lisensi E-Book';
                        samplePrice = 'Rp 120.000';
                        typeLabel = 'Item Digital';
                      } else if (rekberActiveTemplateTab === 'service') {
                        tmpl = googleSettings.rekber_template_service || REKBER_FACTORY_DEFAULTS.rekber_template_service;
                        sampleName = 'Jasa Desain Arsitektur & Denah 3D';
                        samplePrice = 'Rp 1.500.000';
                        typeLabel = 'Layanan Jasa';
                      } else if (rekberActiveTemplateTab === 'plant') {
                        tmpl = googleSettings.rekber_template_plant || REKBER_FACTORY_DEFAULTS.rekber_template_plant;
                        sampleName = 'Tanaman Hias Monstera Variegata Albo';
                        samplePrice = 'Rp 650.000';
                        typeLabel = 'Tanaman';
                      } else if (rekberActiveTemplateTab === 'fauna') {
                        tmpl = googleSettings.rekber_template_fauna || REKBER_FACTORY_DEFAULTS.rekber_template_fauna;
                        sampleName = 'Kucing British Shorthair Pedigree';
                        samplePrice = 'Rp 4.500.000';
                        typeLabel = 'Satwa / Hewan';
                      } else {
                        tmpl = googleSettings.rekber_template_physical || googleSettings.rekber_template_general || REKBER_FACTORY_DEFAULTS.rekber_template_physical;
                      }

                      return tmpl
                        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                        .replace(/{store_title}/g, 'Catavor Demo Store')
                        .replace(/{item_name}/g, sampleName)
                        .replace(/{product_name}/g, sampleName)
                        .replace(/{item_price}/g, samplePrice)
                        .replace(/{product_price}/g, samplePrice)
                        .replace(/{item_type_label}/g, typeLabel)
                        .replace(/{rekber_website_url}/g, websiteUrl)
                        .replace(/{rekber_website_domain}/g, websiteDomain)
                        .replace(/{rekber_wa_number}/g, cleanWANum)
                        .replace(/{rekber_wa_link}/g, waLink)
                        .replace(/{rekber_wa_section}/g, waSection);
                    })()}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleResetRekberDefaults}
                    disabled={savingSettings}
                    style={{
                      padding: '0.6rem 0.95rem',
                      borderRadius: '0.65rem',
                      border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)'}`,
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: savingSettings ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Reset Default
                  </button>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '0.65rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: savingSettings ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{savingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 4: MASTER KONTAK RESMI PLATFORM */}
          {canManageSystemSettings && masterSubView === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Back to Master Menu Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMasterSubView('menu');
                    updatePlatformUrl('master_data', null, null);
                  }}
                  className="btn-portal-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    minHeight: '44px'
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Kembali ke Master</span>
                </button>
              </div>

              {/* Info Advisory Callout */}
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.85rem',
                backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                border: `1px solid ${isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.2)'}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <Headphones size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.84rem', fontWeight: 800, color: theme.textPrimary }}>
                    Kontak Bantuan Teknis Resmi Catavor
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                    Kontak berikut otomatis disinkronkan ke kartu bantuan pada halaman Checkout di seluruh perangkat (Desktop, Tablet, dan Mobile) untuk calon merchant yang membutuhkan kendala pembayaran.
                  </p>
                </div>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveContactSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem'
                }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Phone size={13} style={{ color: '#10b981' }} />
                      <span>Nomor WhatsApp Bantuan Resmi *</span>
                    </label>
                    <input
                      type="text"
                      value={googleSettings.platform_official_whatsapp || ''}
                      onChange={(e) => setGoogleSettings(prev => ({
                        ...prev,
                        platform_official_whatsapp: e.target.value
                      }))}
                      placeholder="Contoh: 62811220227"
                      className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.8rem',
                        borderRadius: '0.65rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        color: theme.textPrimary,
                        fontSize: '0.8rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: '0.3rem' }}>
                      Gunakan format internasional tanpa spasi atau tanda plus (contoh: 62811220227).
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Mail size={13} style={{ color: '#2563eb' }} />
                      <span>Alamat Email Bantuan Resmi *</span>
                    </label>
                    <input
                      type="email"
                      value={googleSettings.platform_official_email || ''}
                      onChange={(e) => setGoogleSettings(prev => ({
                        ...prev,
                        platform_official_email: e.target.value
                      }))}
                      placeholder="Contoh: support@catavor.com"
                      className={`text-input ${isDark ? 'dark-input' : 'light-input'}`}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.8rem',
                        borderRadius: '0.65rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        color: theme.textPrimary,
                        fontSize: '0.8rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: '0.3rem' }}>
                      Alamat email resmi untuk menerima kendala pembayaran / bukti transaksi manual.
                    </div>
                  </div>

                  {/* Preview Card */}
                  <div style={{
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
                    border: `1px solid ${theme.border}`
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
                      Simulasi Visual di Halaman Checkout:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}>
                        <MessageCircle size={14} />
                        <span>WhatsApp: +{(googleSettings.platform_official_whatsapp || '62811220227').replace(/\D/g, '')}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}>
                        <Mail size={14} />
                        <span>Email: {googleSettings.platform_official_email || 'support@catavor.com'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0.7rem 1.25rem',
                      borderRadius: '0.65rem',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: savingSettings ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                    }}
                  >
                    {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>{savingSettings ? 'Menyimpan...' : 'Simpan Kontak Resmi'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 5: MASTER KEBIJAKAN & LEGALITAS PLATFORM */}
          {canManageSystemSettings && masterSubView === 'policies' && (
            <ErrorBoundary sectionName="Manajemen Kebijakan Platform">
              <MobilePolicyManager
                token={token || localStorage.getItem('catavor_token') || ''}
                isDark={isDark}
                theme={theme}
                backLabel="Master Data"
                onBack={() => {
                  smartBack(() => {
                    setMasterSubView('menu');
                    updatePlatformUrl('master_data', null, null);
                  });
                }}
                showToast={(msg, type) => setToastMsg({ text: msg, type: type || 'success' })}
              />
            </ErrorBoundary>
          )}
        </div>
      )}

      {/* DIRECT TOP-LEVEL VIEW: KEBIJAKAN & LEGALITAS PLATFORM */}
      {activeView === 'policies' && canManageSystemSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <ErrorBoundary sectionName="Manajemen Kebijakan Platform">
            <MobilePolicyManager
              token={token || localStorage.getItem('catavor_token') || ''}
              isDark={isDark}
              theme={theme}
              backLabel="Kembali"
              onBack={() => {
                smartBack(() => {
                  handleSwitchView('dashboard');
                  updatePlatformUrl('dashboard', null, null);
                });
              }}
              showToast={(msg, type) => setToastMsg({ text: msg, type: type || 'success' })}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* DOCUMENT & IMAGE PREVIEW MODAL (IN-APP VIEWER & DIRECT DOWNLOAD) */}
      {docPreview && docPreview.isOpen && (
        <DocumentPreviewModal
          data={docPreview}
          onClose={() => setDocPreview(null)}
          token={token || localStorage.getItem('catavor_token') || ''}
        />
      )}


      {/* LUXURY MOBILE BOTTOM SHEET: CRUD FORM DROPDOWN PICKER */}
      {crudDropdownPicker && (
        <div
          className="bottom-sheet-backdrop"
          style={{
            zIndex: 11000,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setCrudDropdownPicker(null)}
        >
          <div
            className="bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textPrimary,
              transform: `translateY(${Math.max(0, dropdownDragY)}px)`,
              transition: isDropdownDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Smooth Drag Handle Bar */}
            <div
              className="bottom-sheet-handle-bar"
              style={{ touchAction: 'none' }}
              onTouchStart={(e) => handleDropdownDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDropdownDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDropdownDragEnd}
              onMouseDown={(e) => handleDropdownDragStart(e.clientY)}
              onMouseMove={(e) => handleDropdownDragMove(e.clientY)}
              onMouseUp={handleDropdownDragEnd}
            >
              <div className="bottom-sheet-handle" style={{ backgroundColor: theme.borderStrong }} />
            </div>

            {/* Header (No Close X button as per design spec - dismiss by drag, click outside, or selection) */}
            <div
              className="bottom-sheet-header"
              onTouchStart={(e) => handleDropdownDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDropdownDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDropdownDragEnd}
              onMouseDown={(e) => handleDropdownDragStart(e.clientY)}
              onMouseMove={(e) => handleDropdownDragMove(e.clientY)}
              onMouseUp={handleDropdownDragEnd}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}`, padding: '0.5rem 1rem 0.75rem', touchAction: 'none' }}
            >
              <div className="bottom-sheet-title-box">
                {crudDropdownPicker.icon ? (
                  <crudDropdownPicker.icon size={18} style={{ color: 'var(--primary, #f59e0b)', flexShrink: 0 }} />
                ) : (
                  <Layers size={18} style={{ color: 'var(--primary, #f59e0b)', flexShrink: 0 }} />
                )}
                <div>
                  <h3 className="bottom-sheet-title" style={{ color: theme.textPrimary }}>{crudDropdownPicker.title}</h3>
                  {crudDropdownPicker.subtitle && (
                    <span style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 500 }}>
                      {crudDropdownPicker.subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="bottom-sheet-scrollable-body" style={{ maxHeight: '60vh', padding: '0.5rem 1rem 1.25rem' }}>
              {crudDropdownPicker.options.map((opt) => {
                const isSelected = crudDropdownPicker.selectedValue === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={`bottom-sheet-item ${isSelected ? 'active' : ''}`}
                    style={{
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.08)')
                        : opt.isAction
                          ? (isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)')
                          : (isDark ? 'rgba(255,255,255,0.02)' : '#ffffff'),
                      borderColor: isSelected
                        ? 'var(--primary, #f59e0b)'
                        : opt.isAction
                          ? 'var(--primary, #f59e0b)'
                          : theme.border,
                      borderStyle: opt.isAction ? 'dashed' : 'solid',
                      color: theme.textPrimary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.85rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.85rem',
                      marginBottom: '0.6rem'
                    }}
                    onClick={() => {
                      crudDropdownPicker.onSelect(opt.value);
                      setCrudDropdownPicker(null);
                    }}
                  >
                    <div className="bottom-sheet-item-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      {opt.icon && (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '0.6rem',
                          backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? '#f59e0b' : theme.textSecondary,
                          flexShrink: 0
                        }}>
                          <opt.icon size={16} />
                        </div>
                      )}
                      <div className="bottom-sheet-item-col" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1, minWidth: 0, gap: '0.2rem' }}>
                        <span className="bottom-sheet-item-name" style={{
                          color: opt.isAction ? 'var(--primary, #f59e0b)' : (isSelected ? 'var(--primary, #f59e0b)' : theme.textPrimary),
                          fontWeight: isSelected || opt.isAction ? 800 : 700,
                          fontSize: '0.88rem',
                          lineHeight: 1.35,
                          whiteSpace: 'normal',
                          overflow: 'visible',
                          textOverflow: 'clip',
                          wordBreak: 'break-word'
                        }}>
                          {opt.label}
                        </span>
                        {opt.desc && (
                          <span className="bottom-sheet-item-desc" style={{
                            color: theme.textSecondary,
                            fontSize: '0.74rem',
                            lineHeight: 1.4,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                          }}>
                            {opt.desc}
                          </span>
                        )}
                      </div>
                      {opt.badge && (
                        <span
                          className="bottom-sheet-item-badge"
                          style={{
                            backgroundColor: opt.badgeColor ? `${opt.badgeColor}22` : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                            color: opt.badgeColor || theme.textSecondary,
                            border: `1px solid ${opt.badgeColor ? `${opt.badgeColor}44` : theme.border}`,
                            fontSize: '0.65rem',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div
                      className={`bottom-sheet-radio ${isSelected ? 'selected' : ''}`}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--primary, #f59e0b)' : theme.borderStrong}`,
                        backgroundColor: isSelected ? 'var(--primary, #f59e0b)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isSelected && (
                        <Check size={12} strokeWidth={3.5} style={{ color: '#ffffff' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}



      {/* Bottom Sheet: Detail Transaksi & Verifikasi Sistem Pembayaran */}
      {selectedProofOrder && (() => {
        const d = describeSubscriptionOrder(selectedProofOrder);
        const statusColor = d.isPaid ? (isDark ? '#34d399' : '#059669') : d.isPending ? (isDark ? '#facc15' : '#d97706') : '#ef4444';
        const statusBg = d.isPaid ? 'rgba(16, 185, 129, 0.14)' : d.isPending ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)';
        const configAccent = d.isAulaaGateway ? '#10b981' : d.isManualQRIS ? '#0284c7' : d.isFreeCoupon ? '#a855f7' : '#3b82f6';
        const cleanWaPhone = d.senderPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }} onClick={() => setSelectedProofOrder(null)}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '520px',
                width: '100%',
                maxHeight: '90vh',
                backgroundColor: theme.modalBg,
                borderTopLeftRadius: '1.5rem',
                borderTopRightRadius: '1.5rem',
                border: `1px solid ${theme.borderStrong}`,
                borderBottom: 'none',
                boxShadow: theme.shadow,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transform: `translateY(${Math.max(0, proofSheetDragY)}px)`,
                transition: isProofSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Drag Handle & Clean Header (No X button per Mobile Native Standard) */}
              <div
                style={{
                  padding: '0.65rem 1.25rem 0.85rem',
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: 'grab',
                  touchAction: 'none',
                  flexShrink: 0
                }}
                onTouchStart={(e) => handleProofSheetDragStart(e.touches[0].clientY)}
                onTouchMove={(e) => handleProofSheetDragMove(e.touches[0].clientY)}
                onTouchEnd={handleProofSheetDragEnd}
                onMouseDown={(e) => handleProofSheetDragStart(e.clientY)}
                onMouseMove={(e) => handleProofSheetDragMove(e.clientY)}
                onMouseUp={handleProofSheetDragEnd}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ width: '44px', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.65rem',
                      backgroundColor: `${configAccent}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: configAccent,
                      flexShrink: 0
                    }}>
                      {d.isAulaaGateway ? <Zap size={18} /> : d.isManualQRIS ? <QrCode size={18} /> : d.isFreeCoupon ? <Tag size={18} /> : <CreditCard size={18} />}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.94rem', fontWeight: 800 }}>
                        Detail Transaksi #{d.orderNumber}
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                        {d.configBadgeLabel} &bull; {d.orderTypeLabel}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    backgroundColor: statusBg,
                    color: statusColor,
                    whiteSpace: 'nowrap'
                  }}>
                    {d.statusLabel}
                  </span>
                </div>
              </div>

              {/* Scrollable Body Content (5 Structured Parity Sections) */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.95rem'
              }}>
                {/* Rejected Reason Alert */}
                {d.isRejected && d.rejectionReason && (
                  <div style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    fontSize: '0.75rem',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.15rem' }}>Alasan Penolakan:</strong>
                      <span>{d.rejectionReason}</span>
                    </div>
                  </div>
                )}

                {/* SECTION 1: Identitas Invoice & Paket Langganan */}
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.74rem'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    1. Identitas Invoice &amp; Paket
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nomor Invoice</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <strong style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>#{d.orderNumber}</strong>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(d.orderNumber);
                            showToast('Nomor invoice disalin', 'success');
                          }}
                          style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Paket &amp; Siklus</span>
                      <strong style={{ color: '#10b981' }}>{d.planLabel} ({d.billingCycle})</strong>
                    </div>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Jenis Transaksi</span>
                      <strong style={{ color: theme.textPrimary }}>{d.orderTypeLabel}</strong>
                    </div>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Waktu Pesanan</span>
                      <strong style={{ color: theme.textPrimary }}>{d.createdAt ? new Date(d.createdAt).toLocaleString('id-ID') : '-'}</strong>
                    </div>
                    {d.paidAt && (
                      <div>
                        <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Waktu Lunas</span>
                        <strong style={{ color: '#10b981' }}>{new Date(d.paidAt).toLocaleString('id-ID')}</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Diverifikasi Oleh</span>
                      <strong style={{ color: theme.textPrimary }}>{d.approvedByLabel}</strong>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Informasi Pelanggan & Katalog Merchant */}
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  fontSize: '0.74rem'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    2. Informasi Pelanggan &amp; Toko
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nama Toko Katalog</span>
                      <strong style={{ color: theme.textPrimary }}>{d.storeTitle}</strong>
                      {d.storeSlug && <span style={{ display: 'block', fontSize: '0.66rem', color: theme.textMuted }}>/@{d.storeSlug} (Paket Aktif: {d.storeCurrentPlan})</span>}
                    </div>
                    <div>
                      <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Pemilik / Pelanggan</span>
                      <strong style={{ color: theme.textPrimary }}>{d.customerName}</strong>
                      <span style={{ display: 'block', fontSize: '0.66rem', color: theme.textMuted }}>{d.customerEmail}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', paddingTop: '0.2rem' }}>
                    {cleanWaPhone && (
                      <a
                        href={`https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(`Halo ${d.customerName} (${d.storeTitle}), terkait transaksi langganan #${d.orderNumber} paket ${d.planLabel} senilai Rp ${d.finalAmount.toLocaleString('id-ID')}:`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          minHeight: '38px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.14)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#10b981',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>Hubungi WA ({d.senderPhone})</span>
                      </a>
                    )}
                    {d.storeSlug && (
                      <a
                        href={`/${d.storeSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          minHeight: '38px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: theme.surface,
                          border: `1px solid ${theme.border}`,
                          color: theme.textPrimary,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Store size={13} />
                        <span>Buka Katalog</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Konfigurasi Sistem Pembayaran Spesifik Transaksi */}
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: `${configAccent}0D`,
                  border: `1.5px solid ${configAccent}40`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  fontSize: '0.74rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: configAccent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      3. Rincian Sistem Pembayaran ({d.configBadgeLabel})
                    </span>
                  </div>

                  {/* AULAA PAYMENT GATEWAY DETAILS */}
                  {d.isAulaaGateway && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Provider Gateway</span>
                          <strong style={{ color: theme.textPrimary }}>Aulaa.co ({d.gatewayProvider.toUpperCase()})</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Sub-Kanal Pembayaran</span>
                          <strong style={{ color: configAccent }}>{d.configChannelLabel}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>ID Referensi Aulaa</span>
                          <strong style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{d.gatewayReference || 'Belum diterbitkan'}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Status Sesi / Webhook</span>
                          <strong style={{ color: d.isPaid ? '#10b981' : '#f59e0b' }}>
                            {d.isPaid ? 'Webhook Terverifikasi Lunas' : 'Menunggu Pembayaran / Callback'}
                          </strong>
                        </div>
                      </div>
                      {d.gatewayRawSummary && (
                        <div style={{ padding: '0.5rem 0.65rem', borderRadius: '0.5rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, fontSize: '0.68rem', color: theme.textSecondary }}>
                          <strong>Payload Aulaa:</strong> {d.gatewayRawSummary}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {d.gatewayPaymentLink && (
                          <a
                            href={d.gatewayPaymentLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              minHeight: '38px',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '0.55rem',
                              backgroundColor: theme.surface,
                              border: `1px solid ${theme.border}`,
                              color: configAccent,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Buka Link Checkout Aulaa</span>
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={syncingOrderId === selectedProofOrder.id}
                          onClick={() => handleSyncOrderWithAulaa(selectedProofOrder.id)}
                          style={{
                            minHeight: '38px',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <RefreshCw size={13} className={syncingOrderId === selectedProofOrder.id ? 'animate-spin' : ''} />
                          <span>{syncingOrderId === selectedProofOrder.id ? 'Menyinkronkan...' : 'Cek Status Aulaa'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MANUAL QRIS MERCHANT DETAILS */}
                  {d.isManualQRIS && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Merchant QRIS Tujuan</span>
                          <strong style={{ color: theme.textPrimary }}>{d.targetQrisMerchant}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Kebijakan Tagihan QRIS</span>
                          <strong style={{ color: configAccent }}>Nominal Pas (Tanpa Kode Unik)</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nama Akun / E-Wallet Pengirim</span>
                          <strong style={{ color: theme.textPrimary }}>{d.senderAccountName}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nomor WhatsApp Pengirim</span>
                          <strong style={{ color: theme.textPrimary }}>{d.senderPhone || '-'}</strong>
                        </div>
                      </div>
                      {d.notes && (
                        <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                          Catatan Pengirim: <strong style={{ color: theme.textPrimary }}>{d.notes}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MANUAL BANK TRANSFER DETAILS */}
                  {d.isManualBank && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Bank &amp; Rekening Tujuan</span>
                          <strong style={{ color: theme.textPrimary }}>{d.targetBankName} ({d.targetBankAccount})</strong>
                          <span style={{ display: 'block', fontSize: '0.64rem', color: theme.textMuted }}>a.n. {d.targetBankHolder}</span>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Kode Unik Mutasi 3-Digit</span>
                          <strong style={{ color: configAccent }}>{d.uniqueCode > 0 ? `+Rp ${d.uniqueCode.toLocaleString('id-ID')}` : 'Tanpa Kode Unik'}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nama Rekening Pengirim</span>
                          <strong style={{ color: theme.textPrimary }}>{d.senderAccountName}</strong>
                        </div>
                        <div>
                          <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Nomor WhatsApp Pengirim</span>
                          <strong style={{ color: theme.textPrimary }}>{d.senderPhone || '-'}</strong>
                        </div>
                      </div>
                      {d.notes && (
                        <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                          Catatan Transfer: <strong style={{ color: theme.textPrimary }}>{d.notes}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* COUPON FREE 100% DETAILS */}
                  {d.isFreeCoupon && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Kode Kupon Digunakan</span>
                        <strong style={{ color: configAccent }}>{d.couponCode || 'FREE100'}</strong>
                      </div>
                      <div>
                        <span style={{ color: theme.textSecondary, display: 'block', fontSize: '0.68rem' }}>Potongan Diskon</span>
                        <strong style={{ color: '#10b981' }}>100% (-Rp {d.discountAmount.toLocaleString('id-ID')})</strong>
                      </div>
                    </div>
                  )}

                  {/* Payment Proof Image (Shown for Manual QRIS / Manual Bank or whenever proofUrl exists) */}
                  {(d.isManualQRIS || d.isManualBank || d.proofUrl) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textSecondary }}>
                        Lampiran Bukti {d.isManualQRIS ? 'Scan QRIS' : 'Transfer Bank'}:
                      </span>
                      <div style={{ width: '100%', minHeight: '150px', maxHeight: '260px', overflow: 'hidden', borderRadius: '0.75rem', backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AuthenticatedProofImage
                          src={d.proofUrl}
                          alt="Bukti Pembayaran"
                          apiToken={token}
                          fallbackText="Berkas bukti tidak dapat ditampilkan"
                          onClick={(resolvedSrc) => {
                            if (resolvedSrc || d.proofUrl) {
                              openAttachmentLightbox([{ file_url: resolvedSrc || d.proofUrl, file_name: `Bukti_Bayar_${d.orderNumber}.jpg` }]);
                            }
                          }}
                          style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain' }}
                        />
                      </div>
                      {d.proofUrl && (
                        <button
                          type="button"
                          onClick={() => openAttachmentLightbox([{ file_url: d.proofUrl, file_name: `Bukti_Bayar_${d.orderNumber}.jpg` }])}
                          style={{
                            minHeight: '38px',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: theme.surface,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Eye size={13} />
                          <span>Perbesar Bukti</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 4: Rincian Kalkulasi Tagihan */}
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '0.74rem'
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    4. Rincian Kalkulasi Tagihan
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.textSecondary }}>
                    <span>Harga Dasar Paket ({d.planLabel})</span>
                    <strong style={{ color: theme.textPrimary }}>Rp {d.originalAmount.toLocaleString('id-ID')}</strong>
                  </div>
                  {d.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                      <span>Potongan Kupon {d.couponCode ? `(${d.couponCode})` : ''}</span>
                      <strong>-Rp {d.discountAmount.toLocaleString('id-ID')}</strong>
                    </div>
                  )}
                  {d.isManualBank && d.uniqueCode > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? '#38bdf8' : '#0284c7' }}>
                      <span>Kode Unik Mutasi Rekening (3-Digit)</span>
                      <strong>+Rp {d.uniqueCode.toLocaleString('id-ID')}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: `1px dashed ${theme.border}`, fontSize: '0.84rem' }}>
                    <strong style={{ color: theme.textPrimary }}>Total Tagihan Akhir</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <strong style={{ fontSize: '0.96rem', fontWeight: 900, color: '#10b981' }}>
                        Rp {d.finalAmount.toLocaleString('id-ID')}
                      </strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(String(d.finalAmount));
                          showToast('Nominal tagihan disalin', 'success');
                        }}
                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Sticky Action Triggers Footer */}
              <div style={{
                padding: '0.75rem 1.25rem 1.25rem',
                borderTop: `1px solid ${theme.border}`,
                backgroundColor: theme.surface,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                {canManageFinance && (
                  d.isPending ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrder(selectedProofOrder);
                          setRejectReasonInput(d.isManualQRIS ? 'Dana scan QRIS belum masuk ke mutasi merchant' : d.isAulaaGateway ? 'Pembayaran gateway melewati batas waktu / dibatalkan' : 'Dana transfer belum masuk ke mutasi rekening bank');
                        }}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <XCircle size={15} />
                        <span>Tolak</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'active')}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Terima &amp; Aktifkan</span>
                      </button>
                    </div>
                  ) : d.isPaid ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'pending_verification')}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          color: theme.textSecondary,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <RotateCcw size={14} />
                        <span>Set Pending</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrder(selectedProofOrder);
                          setRejectReasonInput('Pembatalan verifikasi oleh admin keuangan');
                        }}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.14)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <XCircle size={14} />
                        <span>Batalkan</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'pending_verification')}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: theme.cardAlt,
                          border: `1px solid ${theme.border}`,
                          color: theme.textSecondary,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <RotateCcw size={14} />
                        <span>Set Pending</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'active')}
                        style={{
                          minHeight: '44px',
                          padding: '0.6rem',
                          borderRadius: '0.65rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Aktifkan Ulang</span>
                      </button>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProofOrder(null)}
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardAlt,
                    color: theme.textSecondary,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bottom Sheet: Konfirmasi Alasan Penolakan Pesanan */}
      {rejectingOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }}
          onClick={() => setRejectingOrder(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              borderBottom: 'none',
              padding: '0.85rem 1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
              <div style={{ width: '44px', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: theme.textPrimary }}>
                  Tolak / Batalkan Pesanan #{rejectingOrder.order_number || rejectingOrder.id}
                </h4>
                <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                  Pilih atau tulis alasan penolakan untuk diinformasikan ke merchant
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                'Dana belum masuk ke mutasi rekening / QRIS platform',
                'Nominal pembayaran tidak sesuai tagihan invoice',
                'Foto bukti pembayaran buram, terpotong, atau tidak valid',
                'Batas waktu pembayaran telah kedaluwarsa'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectReasonInput(preset)}
                  style={{
                    minHeight: '42px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.6rem',
                    backgroundColor: rejectReasonInput === preset ? 'rgba(239, 68, 68, 0.12)' : theme.cardAlt,
                    border: `1px solid ${rejectReasonInput === preset ? '#ef4444' : theme.border}`,
                    color: rejectReasonInput === preset ? '#f87171' : theme.textSecondary,
                    fontSize: '0.73rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rejectReasonInput}
              onChange={e => setRejectReasonInput(e.target.value)}
              placeholder="Tulis alasan penolakan..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                fontSize: '0.78rem',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                style={{
                  minHeight: '44px',
                  padding: '0.6rem',
                  borderRadius: '0.65rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  color: theme.textSecondary,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleUpdateOrderStatus(rejectingOrder.id, 'rejected', rejectReasonInput)}
                style={{
                  minHeight: '44px',
                  padding: '0.6rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PERSISTENT EXECUTIVE FOOTER NAVIGATION (Only on Main 4 Platform Tabs)  */}
      {/* ========================================================================= */}
      {!isSubPage && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          height: '60px',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTop: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 0, 0, 0.08)'}`,
          boxShadow: isDark ? '0 -4px 25px rgba(0, 0, 0, 0.65)' : '0 -4px 20px rgba(0, 0, 0, 0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 0.35rem',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}>
          {footerNavTabs.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSwitchView(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.2rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.35rem 0',
                  color: isActive ? (isDark ? '#38bdf8' : '#0284c7') : theme.textMuted,
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Active Pill Indicator at Top of Tab */}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    top: '0.1rem',
                    width: '20px',
                    height: '2.5px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                    boxShadow: isDark ? '0 0 8px #38bdf8' : '0 0 6px #0284c7'
                  }} />
                )}

                {/* Tab Icon with Badge */}
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease'
                }}>
                  {tab.icon}
                  {tab.badge > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-7px',
                      minWidth: '15px',
                      height: '15px',
                      borderRadius: '999px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                      border: `1.5px solid ${isDark ? '#0f172a' : '#ffffff'}`,
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </div>

                {/* Tab Label */}
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: isActive ? 800 : 600,
                  letterSpacing: '-0.01em'
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* MOBILE BOTTOM SHEET MODAL: HELPDESK CATEGORY & PRIORITY FILTER */}
      {activeFilterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => setActiveFilterModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, filterSheetDragY)}px)`,
              transition: isFilterSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '78vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0',
              backgroundColor: theme.surface,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              boxShadow: isDark ? '0 -12px 48px rgba(0, 0, 0, 0.6)' : '0 -10px 35px rgba(0, 0, 0, 0.12)',
              color: theme.textPrimary,
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Smooth Drag Handle Area (Clean Touch & Mouse Dismiss) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0.35rem 0 0.75rem',
                flexShrink: 0,
                cursor: isFilterSheetDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleFilterSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleFilterSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleFilterSheetDragEnd}
              onMouseDown={(e) => handleFilterSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleFilterSheetDragMove(e.clientY)}
              onMouseUp={handleFilterSheetDragEnd}
            >
              <div style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'
              }} />
            </div>

            {/* Header (Clean without X icon, dismissible via drag handle, backdrop, or footer actions) */}
            <div
              style={{
                padding: '0.15rem 1.25rem 0.75rem',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box',
                flexShrink: 0
              }}
              onTouchStart={(e) => handleFilterSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleFilterSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleFilterSheetDragEnd}
              onMouseDown={(e) => handleFilterSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleFilterSheetDragMove(e.clientY)}
              onMouseUp={handleFilterSheetDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                {activeFilterModal === 'category' ? (
                  <Tag size={18} style={{ color: 'var(--primary, #10b981)', flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={18} style={{ color: 'var(--primary, #10b981)', flexShrink: 0 }} />
                )}
                <h3 style={{
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  color: theme.textPrimary,
                  margin: 0,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {activeFilterModal === 'category' ? 'Pilih Kategori Tiket' : 'Pilih Tingkat Prioritas'}
                </h3>
              </div>
            </div>

            {/* Search Bar for Category if availableCategories > 4 */}
            {activeFilterModal === 'category' && availableCategories.length > 4 && (
              <div style={{ padding: '0.65rem 1.25rem 0.25rem', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: isDark ? '#94a3b8' : '#64748b', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className={`filter-search-input ${isDark ? 'dark-input' : 'light-input'}`}
                    placeholder="Cari kategori tiket..."
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 2rem 0.6rem 2.25rem',
                      borderRadius: '0.75rem',
                      border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : '#ffffff',
                      color: theme.textPrimary,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                      boxShadow: isDark ? 'inset 0 1px 3px rgba(0,0,0,0.5)' : 'inset 0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  />
                  {filterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterSearchQuery('')}
                      style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div style={{
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              maxHeight: '52vh',
              padding: '0.65rem 1.25rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              flex: 1,
              minHeight: 0
            }}>
              {activeFilterModal === 'category' ? (
                <>
                  {/* Option: Semua Kategori */}
                  <button
                    type="button"
                    onClick={() => {
                      setTicketCategoryFilter('all');
                      setActiveFilterModal(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.8rem 0.95rem',
                      borderRadius: '0.75rem',
                      backgroundColor: ticketCategoryFilter === 'all'
                        ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                        : theme.cardAlt,
                      border: ticketCategoryFilter === 'all'
                        ? '1.5px solid var(--primary, #10b981)'
                        : `1px solid ${theme.border}`,
                      color: ticketCategoryFilter === 'all' ? 'var(--primary, #10b981)' : theme.textPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: ticketCategoryFilter === 'all' ? 800 : 600, color: ticketCategoryFilter === 'all' ? 'var(--primary, #10b981)' : theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Semua Kategori
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.45rem',
                        borderRadius: '999px',
                        backgroundColor: ticketCategoryFilter === 'all' ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                        color: ticketCategoryFilter === 'all' ? 'var(--primary, #10b981)' : theme.textSecondary,
                        flexShrink: 0
                      }}>
                        {tickets.length} tiket
                      </span>
                    </div>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: ticketCategoryFilter === 'all' ? '1.5px solid var(--primary, #10b981)' : `1.5px solid ${theme.borderStrong}`,
                      backgroundColor: ticketCategoryFilter === 'all' ? 'var(--primary, #10b981)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: ticketCategoryFilter === 'all' ? '0 0 10px var(--primary-glow, rgba(16, 185, 129, 0.35))' : 'none'
                    }}>
                      {ticketCategoryFilter === 'all' && (
                        <Check size={12} strokeWidth={3.5} color="#ffffff" />
                      )}
                    </div>
                  </button>

                  {/* Category Items */}
                  {availableCategories
                    .filter(cat => !filterSearchQuery.trim() || cat.label.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .map((cat) => {
                      const isSelected = ticketCategoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setTicketCategoryFilter(cat.id);
                            setActiveFilterModal(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.8rem 0.95rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                              : theme.cardAlt,
                            border: isSelected
                              ? '1.5px solid var(--primary, #10b981)'
                              : `1px solid ${theme.border}`,
                            color: isSelected ? 'var(--primary, #10b981)' : theme.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--primary, #10b981)' : theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cat.label}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.12rem 0.45rem',
                              borderRadius: '999px',
                              backgroundColor: isSelected ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                              color: isSelected ? 'var(--primary, #10b981)' : theme.textSecondary,
                              flexShrink: 0
                            }}>
                              {cat.count} tiket
                            </span>
                          </div>
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: isSelected ? '1.5px solid var(--primary, #10b981)' : `1.5px solid ${theme.borderStrong}`,
                            backgroundColor: isSelected ? 'var(--primary, #10b981)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: isSelected ? '0 0 10px var(--primary-glow, rgba(16, 185, 129, 0.35))' : 'none'
                          }}>
                            {isSelected && (
                              <Check size={12} strokeWidth={3.5} color="#ffffff" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                </>
              ) : (
                <>
                  {/* Option: Semua Prioritas */}
                  <button
                    type="button"
                    onClick={() => {
                      setTicketPriorityFilter('all');
                      setActiveFilterModal(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.8rem 0.95rem',
                      borderRadius: '0.75rem',
                      backgroundColor: ticketPriorityFilter === 'all'
                        ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                        : theme.cardAlt,
                      border: ticketPriorityFilter === 'all'
                        ? '1.5px solid var(--primary, #10b981)'
                        : `1px solid ${theme.border}`,
                      color: ticketPriorityFilter === 'all' ? 'var(--primary, #10b981)' : theme.textPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: ticketPriorityFilter === 'all' ? 800 : 600, color: ticketPriorityFilter === 'all' ? 'var(--primary, #10b981)' : theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Semua Tingkat Prioritas
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.45rem',
                        borderRadius: '999px',
                        backgroundColor: ticketPriorityFilter === 'all' ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                        color: ticketPriorityFilter === 'all' ? 'var(--primary, #10b981)' : theme.textSecondary,
                        flexShrink: 0
                      }}>
                        {tickets.length} tiket
                      </span>
                    </div>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: ticketPriorityFilter === 'all' ? '1.5px solid var(--primary, #10b981)' : `1.5px solid ${theme.borderStrong}`,
                      backgroundColor: ticketPriorityFilter === 'all' ? 'var(--primary, #10b981)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: ticketPriorityFilter === 'all' ? '0 0 10px var(--primary-glow, rgba(16, 185, 129, 0.35))' : 'none'
                    }}>
                      {ticketPriorityFilter === 'all' && (
                        <Check size={12} strokeWidth={3.5} color="#ffffff" />
                      )}
                    </div>
                  </button>

                  {/* Priority Items */}
                  {availablePriorities.map((prio) => {
                    const isSelected = ticketPriorityFilter === prio.id;
                    return (
                      <button
                        key={prio.id}
                        type="button"
                        onClick={() => {
                          setTicketPriorityFilter(prio.id);
                          setActiveFilterModal(null);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.8rem 0.95rem',
                          borderRadius: '0.75rem',
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                            : theme.cardAlt,
                          border: isSelected
                            ? '1.5px solid var(--primary, #10b981)'
                            : `1px solid ${theme.border}`,
                          color: isSelected ? 'var(--primary, #10b981)' : theme.textPrimary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: prio.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.86rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--primary, #10b981)' : theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prio.label}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: isSelected ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                            color: isSelected ? 'var(--primary, #10b981)' : theme.textSecondary,
                            flexShrink: 0
                          }}>
                            {prio.count} tiket
                          </span>
                        </div>
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isSelected ? '1.5px solid var(--primary, #10b981)' : `1.5px solid ${theme.borderStrong}`,
                          backgroundColor: isSelected ? 'var(--primary, #10b981)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: isSelected ? '0 0 10px var(--primary-glow, rgba(16, 185, 129, 0.35))' : 'none'
                        }}>
                          {isSelected && (
                            <Check size={12} strokeWidth={3.5} color="#ffffff" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Sticky Footer */}
            <div style={{
              padding: '0.75rem 1.25rem max(1.15rem, env(safe-area-inset-bottom))',
              borderTop: `1px solid ${theme.border}`,
              backgroundColor: theme.surface,
              display: 'flex',
              gap: '0.65rem',
              width: '100%',
              boxSizing: 'border-box',
              flexShrink: 0,
              marginTop: 'auto'
            }}>
              <button
                type="button"
                onClick={() => {
                  if (activeFilterModal === 'category') {
                    setTicketCategoryFilter('all');
                  } else {
                    setTicketPriorityFilter('all');
                  }
                  setActiveFilterModal(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '0.75rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterModal(null)}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--primary, #10b981)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--primary-glow, rgba(16, 185, 129, 0.35))',
                  transition: 'all 0.15s ease'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. STANDARD MOBILE BOTTOM SHEET MODAL: STATUS PENGERJAAN TIKET */}
      {showFooterStatusMenu && selectedTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 13500,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => {
            setShowFooterStatusMenu(false);
            setStatusSheetDragY(0);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, statusSheetDragY)}px)`,
              transition: isStatusSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0',
              backgroundColor: theme.surface,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              boxShadow: isDark ? '0 -12px 48px rgba(0, 0, 0, 0.6)' : '0 -10px 35px rgba(0, 0, 0, 0.12)',
              color: theme.textPrimary,
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0.35rem 0 0.75rem',
                flexShrink: 0,
                cursor: isStatusSheetDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleStatusSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleStatusSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleStatusSheetDragEnd}
              onMouseDown={(e) => handleStatusSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleStatusSheetDragMove(e.clientY)}
              onMouseUp={handleStatusSheetDragEnd}
            >
              <div style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'
              }} />
            </div>

            {/* Header (Clean, draggable, WITHOUT X icon, matching platform standard) */}
            <div
              style={{
                padding: '0.15rem 1.25rem 0.85rem',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                cursor: isStatusSheetDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleStatusSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleStatusSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleStatusSheetDragEnd}
              onMouseDown={(e) => handleStatusSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleStatusSheetDragMove(e.clientY)}
              onMouseUp={handleStatusSheetDragEnd}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Activity size={18} style={{ color: isDark ? '#38bdf8' : '#0284c7' }} />
                  <h3 style={{
                    fontSize: '1.02rem',
                    fontWeight: 800,
                    color: theme.textPrimary,
                    letterSpacing: '-0.02em',
                    margin: 0
                  }}>
                    Status Pengerjaan Tiket
                  </h3>
                </div>
                <span style={{ fontSize: '0.73rem', color: theme.textSecondary }}>
                  Pilih status terbaru untuk tiket #{selectedTicket.ticket_number || selectedTicket.id}
                </span>
              </div>
            </div>

            {/* Scrollable Body: Standard Selection List */}
            <div style={{ padding: '1rem 1.15rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto' }}>
              {[
                { id: 'open', label: 'Open (Baru)', desc: 'Tiket baru masuk dari merchant, menunggu respons pertama tim CS.', color: '#06b6d4' },
                { id: 'waiting_agent', label: 'Butuh Respon CS', desc: 'Merchant telah membalas, menunggu tanggapan staf CS.', color: isDark ? '#38bdf8' : '#0284c7' },
                { id: 'in_progress', label: 'Proses (In Progress)', desc: 'Sedang dalam penanganan / investigasi aktif oleh staf CS.', color: isDark ? '#fbbf24' : '#d97706' },
                { id: 'waiting_user', label: 'Tunggu User (Pending)', desc: 'CS telah membalas, menunggu tanggapan merchant (Otomatis saat membalas).', color: isDark ? '#c084fc' : '#9333ea' },
                { id: 'resolved', label: 'Selesai (Resolved)', desc: 'Kendala tuntas diselesaikan. Tiket masuk masa sanggah 7 hari sebelum ditutup.', color: isDark ? '#34d399' : '#059669' },
                { id: 'closed', label: 'Tutup (Closed)', desc: 'Tiket ditutup permanen dan diarsipkan secara Read-Only.', color: '#94a3b8' }
              ].map(st => {
                const isSelected = selectedTicket.status === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={async () => {
                      setShowFooterStatusMenu(false);
                      setStatusSheetDragY(0);
                      await handleUpdateTicketStatus(selectedTicket.id, st.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.95rem',
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.07)')
                        : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
                      border: isSelected
                        ? `1.5px solid ${isDark ? '#38bdf8' : '#0284c7'}`
                        : `1px solid ${theme.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <span style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: st.color,
                        flexShrink: 0,
                        boxShadow: `0 0 10px ${st.color}55`
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.86rem',
                          fontWeight: isSelected ? 800 : 700,
                          color: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : theme.textPrimary,
                          marginBottom: '0.15rem'
                        }}>
                          {st.label}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                          {st.desc}
                        </div>
                      </div>
                    </div>

                    {/* Radio / Check Indicator */}
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: isSelected ? `2px solid ${isDark ? '#38bdf8' : '#0284c7'}` : `2px solid ${theme.borderStrong}`,
                      backgroundColor: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET MODAL: CANNED RESPONSES / QUICK REPLY TEMPLATES */}
      {showTemplateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 13000,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => {
            setShowTemplateModal(false);
            setTemplateSheetDragY(0);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, templateSheetDragY)}px)`,
              transition: isTemplateSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0',
              backgroundColor: theme.surface,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              boxShadow: isDark ? '0 -12px 48px rgba(0, 0, 0, 0.6)' : '0 -10px 35px rgba(0, 0, 0, 0.12)',
              color: theme.textPrimary,
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0.35rem 0 0.75rem',
                flexShrink: 0,
                cursor: isTemplateSheetDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleTemplateSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTemplateSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTemplateSheetDragEnd}
              onMouseDown={(e) => handleTemplateSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleTemplateSheetDragMove(e.clientY)}
              onMouseUp={handleTemplateSheetDragEnd}
            >
              <div style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'
              }} />
            </div>

            {/* Header (Clean, draggable, without X icon, sleek & elegant styling) */}
            <div
              style={{
                padding: '0.15rem 1.25rem 0.85rem',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                cursor: isTemplateSheetDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleTemplateSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTemplateSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTemplateSheetDragEnd}
              onMouseDown={(e) => handleTemplateSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleTemplateSheetDragMove(e.clientY)}
              onMouseUp={handleTemplateSheetDragEnd}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: theme.textPrimary,
                  letterSpacing: '-0.02em',
                  margin: 0
                }}>
                  Template Balasan Cepat
                </h3>
                <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                  Pilih template untuk mengisi balasan otomatis
                </span>
              </div>

              {/* Kelola Master Button (Premium Pill, NO crude emoji, NO X icon) */}
              <button
                type="button"
                onClick={handleNavigateToTemplatesMaster}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.42rem 0.85rem',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.22)'}`,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title="Buka Pengaturan Master Template"
              >
                <SlidersHorizontal size={13} strokeWidth={2.2} />
                <span>Kelola Master</span>
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '0.75rem 1.25rem 0.35rem', flexShrink: 0 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: isDark ? '#94a3b8' : '#64748b', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className={`filter-search-input ${isDark ? 'dark-input' : 'light-input'}`}
                  placeholder="Cari judul, shortcut (/salam), atau isi..."
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 2rem 0.55rem 2.3rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {templateSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTemplateSearchQuery('')}
                    style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', padding: '0.4rem 1.25rem', flexShrink: 0 }}>
              {[
                { id: 'all', label: 'Semua' },
                { id: 'general', label: 'Umum' },
                { id: 'billing', label: 'Keuangan' },
                { id: 'technical', label: 'Teknis' },
                { id: 'closing', label: 'Penutupan' },
                { id: 'account', label: 'Akun' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat.id)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: templateCategoryFilter === cat.id ? 800 : 600,
                    backgroundColor: templateCategoryFilter === cat.id
                      ? (isDark ? '#38bdf8' : '#0284c7')
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                    color: templateCategoryFilter === cat.id ? '#ffffff' : theme.textSecondary,
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Templates List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.5rem 1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              boxSizing: 'border-box'
            }}>
              {loadingTemplates ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.8rem' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 0.4rem', display: 'block', color: '#0284c7' }} />
                  Memuat template balasan...
                </div>
              ) : cannedTemplates.filter(t => {
                if (t.is_active === false) return false;
                if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) return false;
                if (templateSearchQuery.trim()) {
                  const q = templateSearchQuery.toLowerCase();
                  return t.title?.toLowerCase().includes(q) || t.shortcut?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
                }
                return true;
              }).length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.8rem' }}>
                  Tidak ada template yang cocok.
                </div>
              ) : (
                cannedTemplates
                  .filter(t => {
                    if (t.is_active === false) return false;
                    if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) return false;
                    if (templateSearchQuery.trim()) {
                      const q = templateSearchQuery.toLowerCase();
                      return t.title?.toLowerCase().includes(q) || t.shortcut?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl)}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '0.85rem',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <strong style={{ fontSize: '0.84rem', color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 800 }}>
                            {tmpl.title}
                          </strong>
                          {tmpl.shortcut && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '0.4rem',
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                              color: isDark ? '#38bdf8' : '#0284c7'
                            }}>
                              /{tmpl.shortcut}
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.62rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: theme.textMuted
                        }}>
                          {tmpl.category}
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '0.76rem',
                        color: theme.textSecondary,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {tmpl.content}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET: TAMBAH / EDIT MASTER TEMPLATE */}
      {showTemplateFormModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 14000,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => {
            setShowTemplateFormModal(false);
            setTemplateFormDragY(0);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, templateFormDragY)}px)`,
              transition: isTemplateFormDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0',
              backgroundColor: theme.surface,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              boxShadow: isDark ? '0 -12px 48px rgba(0, 0, 0, 0.6)' : '0 -10px 35px rgba(0, 0, 0, 0.12)',
              color: theme.textPrimary,
              boxSizing: 'border-box',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0.35rem 0 0.75rem',
                flexShrink: 0,
                cursor: isTemplateFormDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleTemplateFormDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTemplateFormDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTemplateFormDragEnd}
              onMouseDown={(e) => handleTemplateFormDragStart(e.clientY)}
              onMouseMove={(e) => handleTemplateFormDragMove(e.clientY)}
              onMouseUp={handleTemplateFormDragEnd}
            >
              <div style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'
              }} />
            </div>

            {/* Header (Clean, draggable, without X icon) */}
            <div
              style={{
                padding: '0.15rem 1.25rem 0.85rem',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                flexShrink: 0,
                cursor: isTemplateFormDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleTemplateFormDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleTemplateFormDragMove(e.touches[0].clientY)}
              onTouchEnd={handleTemplateFormDragEnd}
              onMouseDown={(e) => handleTemplateFormDragStart(e.clientY)}
              onMouseMove={(e) => handleTemplateFormDragMove(e.clientY)}
              onMouseUp={handleTemplateFormDragEnd}
            >
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: theme.textPrimary,
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                {editingTemplate ? 'Edit Template Balasan' : 'Tambah Template Balasan'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                Konfigurasi pesan standar balasan cepat CS
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTemplate} style={{ padding: '1rem 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary }}>
                    Judul Template <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                    {templateForm.title.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={templateForm.title}
                  onChange={e => setTemplateForm({ ...templateForm, title: e.target.value })}
                  placeholder="Contoh: Salam & Permintaan Screenshot Bukti"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                    Shortcut
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 800, fontSize: '0.82rem' }}>
                      /
                    </span>
                    <input
                      type="text"
                      value={templateForm.shortcut}
                      onChange={e => setTemplateForm({ ...templateForm, shortcut: e.target.value.replace(/^\//, '').toLowerCase() })}
                      placeholder="salam"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem 0.55rem 1.4rem',
                        borderRadius: '0.65rem',
                        backgroundColor: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        color: theme.textPrimary,
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                    Kategori
                  </label>
                  <MobileCustomSelect
                    value={templateForm.category}
                    onChange={(val) => setTemplateForm({ ...templateForm, category: val })}
                    options={SUPPORT_TEMPLATE_CATEGORIES.map((opt) => ({ value: opt.value, label: opt.label }))}
                    title="Pilih Kategori Template"
                    triggerStyle={{ minHeight: '44px' }}
                    ariaLabel="Kategori Template"
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary }}>
                    Isi Template Pesan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                    Klik tag di bawah untuk sisipkan
                  </span>
                </div>

                {/* Variable Tag Inserters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.45rem' }}>
                  {[
                    { tag: '{{merchant_name}}', label: 'Merchant' },
                    { tag: '{{store_name}}', label: 'Toko' },
                    { tag: '{{ticket_number}}', label: 'No Tiket' },
                    { tag: '{{agent_name}}', label: 'Staf CS' }
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => setTemplateForm(prev => ({ ...prev, content: prev.content + v.tag }))}
                      style={{
                        padding: '0.2rem 0.45rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                        border: `1px dashed ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.35)'}`,
                        color: isDark ? '#38bdf8' : '#0284c7',
                        cursor: 'pointer'
                      }}
                    >
                      + {v.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  value={templateForm.content}
                  onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                  placeholder="Tulis draf pesan template di sini..."
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Live Preview Box */}
              {templateForm.content.trim() && (
                <div style={{
                  padding: '0.65rem 0.8rem',
                  borderRadius: '0.65rem',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)'}`
                }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', display: 'block', marginBottom: '0.2rem' }}>
                    Pratinjau Teks (Variabel Terisi):
                  </span>
                  <p style={{
                    margin: 0,
                    fontSize: '0.74rem',
                    color: theme.textPrimary,
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {templateForm.content
                      .replace(/\{\{merchant_name\}\}/gi, 'Budi Santoso')
                      .replace(/\{\{store_name\}\}/gi, 'Fauna Paradise')
                      .replace(/\{\{ticket_number\}\}/gi, '#TCK-20260915-0812')
                      .replace(/\{\{agent_name\}\}/gi, currentUser?.name || 'Staf CS')}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.4rem', borderTop: `1px solid ${theme.border}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: theme.textPrimary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={templateForm.is_active}
                    onChange={e => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                  />
                  <span>Template Aktif</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateFormModal(false)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    style={{
                      padding: '0.45rem 1.15rem',
                      borderRadius: '0.55rem',
                      backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      opacity: savingTemplate ? 0.6 : 1
                    }}
                  >
                    {savingTemplate && <RefreshCw size={13} className="animate-spin" />}
                    <span>{editingTemplate ? 'Simpan' : 'Tambah'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI AKSI BANNED PERMANEN (Standard Mobile Bottom Sheet)       */}
      {/* ========================================================================= */}
      {showModerationConfirmModal && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingModeration) {
              handleDismissBannedConfirmModal();
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '90vh',
              transform: `translateY(${Math.max(0, bannedConfirmDragY)}px)`,
              transition: isBannedConfirmDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              borderTopLeftRadius: '1.6rem',
              borderTopRightRadius: '1.6rem',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderTop: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)'}`,
              boxShadow: isDark
                ? '0 -14px 48px rgba(0, 0, 0, 0.65), 0 -4px 20px rgba(239, 68, 68, 0.2)'
                : '0 -10px 40px rgba(0, 0, 0, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0.55rem 0 0.35rem',
                flexShrink: 0,
                cursor: isBannedConfirmDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none'
              }}
              onTouchStart={(e) => handleBannedConfirmDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleBannedConfirmDragMove(e.touches[0].clientY)}
              onTouchEnd={handleBannedConfirmDragEnd}
              onMouseDown={(e) => handleBannedConfirmDragStart(e.clientY)}
              onMouseMove={(e) => handleBannedConfirmDragMove(e.clientY)}
              onMouseUp={handleBannedConfirmDragEnd}
            >
              <div style={{
                width: '38px',
                height: '4px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)'
              }} />
            </div>

            {/* Modal Header Bar (Professional & Elegant Enterprise Grade) */}
            <div
              style={{
                padding: '0.65rem 1.25rem 0.9rem',
                background: isDark
                  ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.9)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexShrink: 0,
                position: 'relative'
              }}
            >
              {(() => {
                const isItemConfirm = (bannedConfirmModalReport?.target_type === 'item') || (moderationModalReport?.target_type === 'item') || (moderationAction === 'item_banned');
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0.85rem',
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.15) 100%)'
                        : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                      border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                      boxShadow: isDark
                        ? '0 4px 14px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 4px 12px rgba(239, 68, 68, 0.15)',
                      flexShrink: 0
                    }}>
                      <ShieldAlert size={22} style={{ filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '0.98rem',
                          fontWeight: 800,
                          color: theme.textPrimary,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.25
                        }}>
                          {isItemConfirm ? 'Konfirmasi Banned Item' : 'Konfirmasi Banned Katalog'}
                        </h3>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)',
                          border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.25)'}`,
                          color: '#ef4444',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                          Permanen
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '0.72rem',
                        color: theme.textSecondary,
                        lineHeight: 1.3,
                        fontWeight: 500
                      }}>
                        {isItemConfirm
                          ? 'Penghapusan seketika & brankas forensik 90 hari (tanpa banding)'
                          : 'Tindakan sanksi fatal, tidak dapat dibatalkan kembali'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Content Body (Scrollable) */}
            {(() => {
              const isItemConfirm = (bannedConfirmModalReport?.target_type === 'item') || (moderationModalReport?.target_type === 'item') || (moderationAction === 'item_banned');
              const itemName = bannedConfirmModalReport?.item_name || bannedConfirmModalReport?.target_title || moderationModalReport?.item_name || moderationModalReport?.target_title;
              const storeTitle = bannedConfirmModalReport?.store_title || moderationModalReport?.store_title || 'Toko Katalog';
              const storeSlug = bannedConfirmModalReport?.store_slug || moderationModalReport?.store_slug;

              return (
                <div style={{
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  overflowY: 'auto',
                  flex: 1
                }}>
                  {/* Target Metadata Card */}
                  <div style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(254, 242, 242, 0.65)',
                    border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.22)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {isItemConfirm ? 'Profil Item Terlapor' : 'Profil Katalog Terlapor'}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.35rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        color: '#ef4444',
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                        fontFamily: 'monospace',
                        flexShrink: 0
                      }}>
                        #{bannedConfirmModalReport?.report_number || moderationModalReport?.report_number || '-'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '0.6rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {isItemConfirm ? <Package size={17} /> : <Store size={17} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{
                          fontSize: '0.94rem',
                          fontWeight: 800,
                          color: theme.textPrimary,
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          letterSpacing: '-0.01em'
                        }}>
                          {isItemConfirm ? (itemName || ('Item ID: ' + (bannedConfirmModalReport?.target_id || moderationModalReport?.target_id || '-'))) : storeTitle}
                        </div>

                        {isItemConfirm ? (
                          <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.3 }}>
                            Dari Toko: <strong>{storeTitle}</strong> {storeSlug && <span style={{ fontFamily: 'monospace' }}>({storeSlug})</span>}
                          </div>
                        ) : storeSlug && (
                          <div style={{
                            fontSize: '0.74rem',
                            color: theme.textSecondary,
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            lineHeight: 1.3
                          }}>
                            catavor.com/{storeSlug}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Warning List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.textPrimary }}>
                      Dampak langsung dari eksekusi sanksi banned ini:
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isItemConfirm ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Trash2 size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Soft-Delete &amp; Lenyap dari Inventaris Toko:</strong> Item langsung dinonaktifkan dan dihapus dari etalase publik serta dashboard merchant (tidak akan tampil di tab Semua, Aktif, maupun Diarsipkan).</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Pemulihan Kuota &amp; Storage Seketika:</strong> Kuota item toko langsung kembali tersedia dan kapasitas storage dibebaskan (0 byte terhitung untuk merchant) sehingga toko tidak dirugikan.</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Database size={14} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Vault Forensik Kepatuhan 90 Hari (UU ITE &amp; PP 71/2019):</strong> Berkas bukti digital dan media fisik item diamankan di brankas forensik selama 90 hari sebelum pemusnahan permanen (hard-purge).</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Lock size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Keputusan Final Tanpa Banding:</strong> Pemilik toko menerima notifikasi penetapan sanksi fatal tanpa hak pengajuan banding (<em>No Right to Appeal</em>).</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Trash2 size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Purge Data Profil &amp; Produk:</strong> Seluruh data produk, etalase, galeri foto, dan media fisik katalog akan dihapus/dibersihkan dari platform.</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Lock size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Penguncian Slug Permanen:</strong> Slug <code style={{ wordBreak: 'break-all' }}>{storeSlug}</code> didaftarkan ke tabel <em>blacklisted_slugs</em> dan tidak dapat didaftarkan ulang.</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.76rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                            <Globe size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Respons 404 Server Publik:</strong> Pengunjung yang membuka alamat URL ini akan menerima tampilan Error 404 Default Platform.</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acknowledgment Checkbox */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.7rem 0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(254, 242, 242, 0.8)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={bannedConfirmAcknowledged}
                      onChange={(e) => setBannedConfirmAcknowledged(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.73rem', fontWeight: 700, color: theme.textPrimary, lineHeight: 1.4 }}>
                      {isItemConfirm
                        ? 'Saya telah memeriksa bukti investigasi dan mengonfirmasi tindakan Banned Permanen pada item ini.'
                        : 'Saya telah memeriksa bukti investigasi dan mengonfirmasi tindakan Banned Permanen katalog ini.'}
                    </span>
                  </label>
                </div>
              );
            })()}

            {/* Modal Bottom Buttons (Clean footer without X icon on top) */}
            <div style={{
              display: 'flex',
              gap: '0.65rem',
              padding: '0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom, 0px))',
              borderTop: `1px solid ${theme.border}`,
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              flexShrink: 0
            }}>
              <button
                type="button"
                disabled={isSubmittingModeration}
                onClick={handleDismissBannedConfirmModal}
                style={{
                  flex: 1,
                  padding: '0.78rem 1rem',
                  borderRadius: '0.75rem',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
                  color: theme.textSecondary,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: isSubmittingModeration ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!bannedConfirmAcknowledged || isSubmittingModeration}
                onClick={() => {
                  if (!bannedConfirmAcknowledged || isSubmittingModeration) return;
                  const reportId = moderationModalReport?.id;
                  handleDismissBannedConfirmModal();
                  if (reportId) {
                    handleUpdateReportStatus(
                      reportId,
                      moderationStatus,
                      moderationAction,
                      moderationNotes,
                      true
                    );
                  }
                }}
                style={{
                  flex: 1.25,
                  padding: '0.78rem 1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  backgroundColor: bannedConfirmAcknowledged ? '#ef4444' : (isDark ? '#334155' : '#cbd5e1'),
                  color: bannedConfirmAcknowledged ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: (!bannedConfirmAcknowledged || isSubmittingModeration) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  whiteSpace: 'nowrap',
                  boxShadow: bannedConfirmAcknowledged ? '0 4px 16px rgba(239, 68, 68, 0.35)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                {isSubmittingModeration ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ShieldAlert size={14} />
                )}
                <span>{((bannedConfirmModalReport?.target_type === 'item') || (moderationModalReport?.target_type === 'item') || (moderationAction === 'item_banned')) ? 'Ya, Banned & Hapus Item' : 'Ya, Banned Katalog'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Scroll to Top Button (Intent-Based: Hanya muncul saat intensi scroll ke atas, sembunyi saat scroll ke bawah) */}
      {showScrollTop && !isAnyOverlayActive && !selectedTicket && activeView !== 'master_data' && !(activeView === 'broadcast' && (broadcastSubViewState === 'create' || broadcastSubViewState === 'edit')) && (
        <button
          type="button"
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            right: '16px',
            bottom: !isSubPage
              ? 'calc(72px + env(safe-area-inset-bottom, 0px))'
              : activeView === 'rbac'
                ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
                : 'calc(20px + env(safe-area-inset-bottom, 0px))',
            zIndex: 40,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#38bdf8' : '#0284c7',
            border: `1.5px solid ${isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.35)'}`,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            animation: 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          title="Kembali ke Atas"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
