import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Store as StoreIcon,
  AlertOctagon,
  LifeBuoy,
  CreditCard,
  Radio,
  Cpu,
  Flame,
  Layers,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Send,
  Lock,
  Unlock,
  MessageSquare,
  Tag,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  X,
  User,
  Zap,
  Globe,
  DollarSign,
  FileText,
  Copy,
  CheckCheck,
  Loader2,
  Paperclip,
  Sliders,
  Download,
  Maximize2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Image as ImageIcon,
  Receipt,
  Phone,
  ShieldAlert,
  XCircle,
  Award,
  HelpCircle,
  BarChart3,
  Bot,
  Printer,
  Package,
  AlertCircle,
  Info,
  Shield,
  Star,
  Database,
  Activity,
  Play,
  Megaphone,
  Users,
  ChevronDown,
  Sparkles,
  Calendar,
  Compass,
  Target,
  Code,
  ChevronLeft,
  Utensils,
  FileCode,
  Briefcase,
  Sprout,
  PawPrint,
  ShoppingBag,
  PhoneCall,
  Link as LinkIcon,
  Upload,
  Server,
  ArrowLeft
} from 'lucide-react';
import { RichTextarea, FormattedText } from './RichTextarea';
import { checkUrlSecurity, cleanDomainString } from '../utils/urlSecurity';
import { TabletRailNav } from './TabletRailNav';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletPlatformStoresView } from './TabletPlatformStoresView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { AdminRBACManagement } from './AdminRBACManagement';
import { AdminSafeDomainsManagement } from './AdminSafeDomainsManagement';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { TabletCustomSelect, type TabletSelectOption } from './TabletCustomSelect';
import { type UserRBACInfo, getRoleBadge, isSuperAdmin, hasPermission } from '../utils/rbac';
import { useModalBackHandler } from '../utils/navigation';

export const REKBER_FACTORY_DEFAULTS: Record<string, string> = {
  rekber_template_physical: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_general: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_food: "Halo *{store_title}*, saya ingin memesan menu kuliner berikut:\n\n*Menu:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_digital: "Halo *{store_title}*, saya ingin membeli item digital berikut:\n\n*Item:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* agar file dan lisensi terlindungi secara aman.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_service: "Halo *{store_title}*, saya ingin memesan layanan jasa berikut:\n\n*Layanan:* {item_name}\n*Tarif:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan escrow *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman selama masa pengerjaan.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_plant: "Halo *{store_title}*, saya ingin membeli tanaman berikut:\n\n*Tanaman:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan perlindungan *Rekening Bersama Syariah ({rekber_website_domain})* agar dana aman hingga tanaman tiba dalam kondisi segar.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_fauna: "Halo *{store_title}*, saya berminat membeli / mengadopsi hewan berikut:\n\n*Satwa/Hewan:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})* dengan proteksi garansi hidup & kesehatan saat tiba.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
};

const TICKET_STATUS_OPTIONS: TabletSelectOption[] = [
  { value: 'open', label: 'Open', badge: 'Baru', badgeBg: 'rgba(59, 130, 246, 0.15)', badgeColor: '#3b82f6', description: 'Tiket baru menunggu respon' },
  { value: 'in_progress', label: 'In Progress', badge: 'Proses', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: '#f59e0b', description: 'Sedang ditangani staf pengelola' },
  { value: 'waiting_user', label: 'Waiting User', badge: 'Menunggu', badgeBg: 'rgba(139, 92, 246, 0.15)', badgeColor: '#8b5cf6', description: 'Menunggu tanggapan dari merchant' },
  { value: 'resolved', label: 'Resolved', badge: 'Selesai', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#10b981', description: 'Kendala berhasil diselesaikan' },
  { value: 'closed', label: 'Closed', badge: 'Tutup', badgeBg: 'rgba(100, 116, 139, 0.15)', badgeColor: '#64748b', description: 'Tiket telah ditutup permanen' },
];

const TICKET_PRIORITY_OPTIONS: TabletSelectOption[] = [
  { value: 'urgent', label: 'Urgent', badge: 'Mendesak', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeColor: '#ef4444', description: 'Kendala fatal / sistematis' },
  { value: 'high', label: 'High', badge: 'Tinggi', badgeBg: 'rgba(249, 115, 22, 0.15)', badgeColor: '#f97316', description: 'Prioritas penanganan tinggi' },
  { value: 'medium', label: 'Medium', badge: 'Sedang', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: '#f59e0b', description: 'Kendala operasional umum' },
  { value: 'low', label: 'Low', badge: 'Rendah', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#10b981', description: 'Pertanyaan atau konsultasi' },
];

const TICKET_CATEGORY_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'billing', label: 'Keuangan & Langganan', description: 'Pertanyaan tagihan atau aktivasi Pro' },
  { value: 'technical', label: 'Kendala Teknis & Bug', description: 'Masalah akses atau error aplikasi' },
  { value: 'catalog_help', label: 'Bantuan Katalog & Produk', description: 'Panduan upload item atau varian' },
  { value: 'account', label: 'Akun & Keamanan', description: 'Reset password atau keamanan toko' },
  { value: 'general', label: 'Pertanyaan Umum', description: 'Konsultasi fitur dan informasi umum' },
];

const TICKET_PRIORITY_FILTER_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Prioritas' },
  { value: 'urgent', label: 'Urgent', badge: 'Mendesak', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeColor: '#ef4444' },
  { value: 'high', label: 'High', badge: 'Tinggi', badgeBg: 'rgba(249, 115, 22, 0.15)', badgeColor: '#f97316' },
  { value: 'medium', label: 'Medium', badge: 'Sedang', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: '#f59e0b' },
  { value: 'low', label: 'Low', badge: 'Rendah', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#10b981' },
];

const BROADCAST_CATEGORY_OPTIONS: TabletSelectOption[] = [
  { value: 'PENGUMUMAN', label: 'PENGUMUMAN', description: 'Informasi umum & pembaruan platform', badge: 'Umum' },
  { value: 'SISTEM', label: 'SISTEM', description: 'Patch atau pembaruan teknis sistem', badge: 'Sistem' },
  { value: 'PROMOSI', label: 'PROMOSI', description: 'Penawaran diskon & paket langganan', badge: 'Promo' },
  { value: 'PEMELIHARAAN', label: 'PEMELIHARAAN', description: 'Jadwal maintenance & servis', badge: 'Maintenance' },
  { value: 'PANDUAN', label: 'PANDUAN', description: 'Panduan & tutorial fitur baru', badge: 'Edukasi' },
  { value: 'KEAMANAN', label: 'KEAMANAN', description: 'Pemberitahuan keamanan & privasi', badge: 'Security' }
];

const BROADCAST_URGENCY_OPTIONS: TabletSelectOption[] = [
  { value: 'info', label: 'Informasi (Biru)', description: 'Notifikasi standar bersifat informatif', badge: 'Info', badgeColor: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.15)' },
  { value: 'warning', label: 'Peringatan / Urgent (Oranye)', description: 'Pemberitahuan penting butuh perhatian segera', badge: 'Urgent', badgeColor: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.15)' },
  { value: 'success', label: 'Rilis & Sukses (Hijau)', description: 'Fitur baru atau kabar pencapaian positif', badge: 'Sukses', badgeColor: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)' },
  { value: 'system', label: 'Sistem (Ungu)', description: 'Pemberitahuan arsitektur dan teknis', badge: 'Sistem', badgeColor: '#8b5cf6', badgeBg: 'rgba(139, 92, 246, 0.15)' }
];

const BROADCAST_TARGET_TYPE_OPTIONS: TabletSelectOption[] = [
  { value: 'all', label: 'Semua Merchant & Pengguna (Global)', description: 'Siaran broadcast massal untuk seluruh ekosistem Catavor', badge: 'Global' },
  { value: 'plan', label: 'Berdasarkan Paket Langganan', description: 'Kirim hanya ke merchant pada tier Free, Pro, atau Enterprise', badge: 'Tier' },
  { value: 'specific', label: 'Toko atau Pengguna Spesifik', description: 'Pilih manual toko merchant atau akun pengguna tertentu', badge: 'Spesifik' }
];

const BROADCAST_PLAN_OPTIONS: TabletSelectOption[] = [
  { value: 'free', label: 'Gratis (Free Tier)', description: 'Merchant dengan paket dasar' },
  { value: 'pro', label: 'Pro Tier', description: 'Merchant berlangganan aktif Pro' },
  { value: 'enterprise', label: 'Enterprise Tier', description: 'Merchant tier tertinggi Enterprise' }
];

const BROADCAST_EXPIRY_OPTIONS: TabletSelectOption[] = [
  { value: '0', label: 'Permanen / Tanpa Batas', description: 'Notifikasi tetap aktif selamanya' },
  { value: '24', label: '24 Jam (1 Hari)', description: 'Kedaluwarsa otomatis setelah 1 hari' },
  { value: '72', label: '72 Jam (3 Hari)', description: 'Kedaluwarsa otomatis setelah 3 hari' },
  { value: '168', label: '168 Jam (1 Minggu / 7 Hari)', description: 'Kedaluwarsa otomatis setelah 7 hari' },
  { value: '720', label: '720 Jam (30 Hari / 1 Bulan)', description: 'Kedaluwarsa otomatis setelah 30 hari' }
];

const BROADCAST_ACTION_TYPE_OPTIONS: TabletSelectOption[] = [
  { value: 'detail', label: 'Buka Artikel Lengkap (Rich Text)', description: 'Membuka modal artikel kaya teks dan panduan' },
  { value: 'navigate', label: 'Navigasi Menu Merchant', description: 'Mengarahkan pengelola langsung ke tab menu tertentu' },
  { value: 'external_link', label: 'Buka Tautan Luar (Web Eksternal)', description: 'Mengarahkan pengguna ke URL web eksternal' }
];

const BROADCAST_MENU_OPTIONS: TabletSelectOption[] = [
  { value: 'settings', label: 'Pengaturan Profil & Toko (settings)' },
  { value: 'items', label: 'Inventaris & Produk (items)' },
  { value: 'subscription', label: 'Paket Langganan & Billing (subscription)' },
  { value: 'help', label: 'Pusat Bantuan & Tiket (help)' },
  { value: 'share', label: 'Bagikan Katalog & QR Merchant (share)' },
  { value: 'analytics', label: 'Dashboard Analitik Merchant (analytics)' }
];

const DEFAULT_CANNED_TEMPLATES = [
  {
    title: 'Salam Pembuka & Konfirmasi Penerimaan',
    category: 'Umum',
    text: 'Halo Pengelola Toko, terima kasih telah menghubungi Pusat Bantuan Catavor. Kami telah menerima laporan/kendala yang Anda sampaikan dan tim kami sedang melakukan investigasi lebih lanjut.'
  },
  {
    title: 'Permintaan Bukti / Tangkapan Layar Tambahan',
    category: 'Investigasi',
    text: 'Untuk membantu kami mempercepat penanganan kendala ini, mohon dapat melampirkan tangkapan layar (screenshot) atau rekaman pesan error yang muncul beserta waktu kejadian.'
  },
  {
    title: 'Verifikasi Pembayaran & Aktivasi Pro',
    category: 'Billing',
    text: 'Terima kasih atas konfirmasinya. Bukti transaksi langganan Anda telah diverifikasi oleh tim keuangan kami dan paket Pro telah berhasil diaktifkan pada katalog toko Anda.'
  },
  {
    title: 'Kendala Teknis Telah Diatasi',
    category: 'Solusi',
    text: 'Kendala teknis yang Anda laporkan telah berhasil diperbaiki oleh tim engineering kami. Silakan muat ulang halaman dashboard Anda dan coba kembali. Jika masih menemui kendala, jangan ragu untuk mengabari kami.'
  },
  {
    title: 'Penutupan Tiket / Masalah Terselesaikan',
    category: 'Selesai',
    text: 'Karena solusi telah diberikan dan tidak ada pertanyaan lanjutan, tiket ini kami tandai sebagai terselesaikan. Anda dapat memberikan penilaian layanan (CSAT) untuk membantu kami meningkatkan kualitas dukungan.'
  }
];

export interface TabletPlatformConsoleProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onLogout: () => void;
}

export const TabletPlatformConsole: React.FC<TabletPlatformConsoleProps> = ({
  token,
  currentUser,
  onLogout
}) => {
  // Theme Mode: Strictly Light and Dark Mode only for Platform Admin
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('catavor_admin_theme_mode') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('catavor_admin_theme_mode', next);
    }
  };

  const isDark = themeMode === 'dark';

  const theme = useMemo(() => ({
    surface: isDark ? '#111827' : '#ffffff',
    card: isDark ? '#1e293b' : '#ffffff',
    cardAlt: isDark ? '#0f172a' : '#f8fafc',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    modalBg: isDark ? '#111827' : '#ffffff',
    modalOverlay: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    primary: 'var(--primary, #0284c7)'
  }), [isDark]);

  // Responsive Tablet Form-Factor Tracking (Tablet Mini < 880px vs Tablet Lebar >= 880px)
  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 880;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation View State synced with URL (?tab=...)
  const normalizeTabletTab = useCallback((raw: string | null): string => {
    if (!raw) return 'dashboard';
    const t = raw.toLowerCase().trim();
    if (['dashboard', 'overview', 'home'].includes(t)) return 'dashboard';
    if (['staff', 'rbac', 'roles', 'users'].includes(t)) return 'staff';
    if (['stores', 'merchants', 'toko'].includes(t)) return 'stores';
    if (['reports', 'compliance', 'laporan'].includes(t)) return 'reports';
    if (['support', 'helpdesk', 'help', 'bantuan', 'tickets', 'chat'].includes(t)) return 'support';
    if (['finance', 'keuangan', 'billing', 'orders'].includes(t)) return 'finance';
    if (['broadcast', 'siaran', 'notifikasi'].includes(t)) return 'broadcast';
    if (['automation', 'bot', 'bots', 'otomatisasi', 'cron', 'engine', 'workers'].includes(t)) return 'automation';
    if (['monetization', 'iklan', 'ads', 'google'].includes(t)) return 'monetization';
    if (['master-data', 'master_data', 'domains', 'safe_domains', 'whitelist', 'domain', 'master', 'masters', 'templates', 'canned'].includes(t)) return 'master-data';
    if (['audit', 'logs', 'activity', 'jejak'].includes(t)) return 'audit';
    return 'dashboard';
  }, []);

  const [activeView, setActiveView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
      if (bId) return 'broadcast';
      const tab = params.get('tab') || params.get('view') || params.get('division');
      if (tab) return normalizeTabletTab(tab);
    }
    return 'dashboard';
  });

  // Synchronize on browser history popstate (Back/Forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined' || window.__catavor_is_modal_popping) return;
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
      if (bId) {
        setActiveView('broadcast');
        return;
      }
      const tab = params.get('tab') || params.get('view') || params.get('division');
      setActiveView(normalizeTabletTab(tab));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [normalizeTabletTab]);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Switch View & sync canonical URL (?tab=...)
  const handleSwitchView = (newView: string) => {
    const target = normalizeTabletTab(newView);
    setActiveView(target);
    if (target === 'broadcast') {
      setBroadcastSubView('list');
      setSelectedBroadcastId(null);
      setSelectedBroadcastDetail(null);
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      // Canonical tab name across ecosystem: 'rbac' for staff, 'master_data' for master-data
      const canonicalTab = target === 'staff' ? 'rbac' : (target === 'master-data' ? 'master_data' : target);
      url.searchParams.set('tab', canonicalTab);
      url.searchParams.delete('subview');
      url.searchParams.delete('subtab');
      url.searchParams.delete('broadcast_id');
      window.history.pushState({ tab: canonicalTab }, '', url.toString());
    }
  };

  // =========================================================================
  // RBAC PERMISSION GATES (Aligned with Desktop & Mobile)
  // =========================================================================
  const canAccessRBAC = isSuperAdmin(currentUser) || hasPermission(currentUser, 'system:admins:manage');
  const canAccessCompliance = hasPermission(currentUser, 'compliance:reports:manage') || hasPermission(currentUser, 'compliance:dormancy:manage') || isSuperAdmin(currentUser);
  const canAccessSupport = hasPermission(currentUser, 'support:tickets:read') || hasPermission(currentUser, 'support:tickets:reply') || isSuperAdmin(currentUser);
  const canAccessFinance = hasPermission(currentUser, 'finance:orders:read') || hasPermission(currentUser, 'finance:orders:manage') || isSuperAdmin(currentUser);
  const canAccessBroadcast = hasPermission(currentUser, 'content:broadcast:send') || isSuperAdmin(currentUser);
  const canAccessMonetization = hasPermission(currentUser, 'monetization:google:manage') || isSuperAdmin(currentUser);
  const canAccessMasterData = isSuperAdmin(currentUser) || canAccessSupport || canAccessMonetization;
  const canAccessAudit = hasPermission(currentUser, 'audit:logs:read') || isSuperAdmin(currentUser);

  // Granular Sub-Action Permission Checks
  const canReplySupport = isSuperAdmin(currentUser) || hasPermission(currentUser, 'support:tickets:reply');
  const canManageReports = isSuperAdmin(currentUser) || hasPermission(currentUser, 'compliance:reports:manage');
  const canManageFinance = isSuperAdmin(currentUser) || hasPermission(currentUser, 'finance:orders:manage');
  const canSendBroadcast = isSuperAdmin(currentUser) || hasPermission(currentUser, 'content:broadcast:send');

  // Header Title metadata
  const viewMetadata = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return { title: 'Ringkasan Eksekutif Platform', subtitle: 'Pusat komando dan metrik operasional ekosistem' };
      case 'staff':
        return { title: 'Staf & Role RBAC', subtitle: 'Matriks izin akses dan penugasan staf pengelola' };
      case 'stores':
        return { title: 'Tata Kelola Profil Merchant', subtitle: 'Direktori katalog terdaftar dan kepatuhan akun' };
      case 'reports':
        return { title: 'Kepatuhan & Laporan Masyarakat', subtitle: 'Antrean penertiban komoditas ilegal dan pelanggaran katalog' };
      case 'support':
        return { title: 'Pusat Bantuan & Helpdesk CS', subtitle: 'Penanganan tiket kendala merchant dan percakapan' };
      case 'finance':
        return { title: 'Keuangan & Verifikasi Billing', subtitle: 'Verifikasi aktivasi paket Pro dan invoice langganan' };
      case 'broadcast':
        return { title: 'Siaran Broadcast Pengumuman', subtitle: 'Penyampaian notifikasi masal ke seluruh merchant' };
      case 'automation':
        return { title: 'Mesin Otomatisasi & Bot Worker', subtitle: 'Pemantauan status daemon dan background job' };
      case 'monetization':
        return { title: 'Monetisasi & Integrasi Google', subtitle: 'Pengaturan Google AdSense, ads.txt dan GA4' };
      case 'master-data':
        return { title: 'Master Data', subtitle: 'Whitelist domain aman, template CS, dan proteksi rekber syariah' };
      case 'audit':
        return { title: 'System-Wide Audit Trail', subtitle: 'Jejak rekaman forensik seluruh tindakan administratif' };
      default:
        return { title: 'Konsol Operasional Platform', subtitle: 'Sistem tata kelola terpadu Catavor' };
    }
  }, [activeView]);

  // Centralized authenticated fetch with automatic 401 session eviction
  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await fetch(input, init);
    if (res.status === 401) {
      onLogout();
      throw new Error('UNAUTHORIZED');
    }
    return res;
  }, [onLogout]);

  // Dynamic Badge Counters & Summary Metrics
  const [metrics, setMetrics] = useState({
    active_stores: 0,
    dormant_stores: 0,
    total_stores: 0,
    total_revenue: 0,
    pro_stores: 0
  });
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [urgentTicketsCount, setUrgentTicketsCount] = useState(0);
  const [actionRequiredTicketsCount, setActionRequiredTicketsCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Load metrics from backend (guarded by user permissions)
  const loadPlatformStats = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Dormancy metrics (only if user has compliance permission)
      if (canAccessCompliance) {
        try {
          const dormRes = await fetch('/api/admin/dormancy/metrics', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (dormRes.ok) {
            const j = await dormRes.json();
            if (j.data) {
              setMetrics(prev => ({
                ...prev,
                active_stores: j.data.active_stores || 0,
                dormant_stores: j.data.dormant_stores || 0,
                total_stores: j.data.total_stores || 0
              }));
            }
          }
        } catch {
          // Gracefully continue
        }
      }

      // 2. Pending reports count (only if user has compliance permission)
      if (canAccessCompliance) {
        try {
          const repRes = await fetch('/api/admin/reports?status=pending&limit=1', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (repRes.ok) {
            const rj = await repRes.json();
            setPendingReportsCount(rj.pagination?.total || (rj.data ? rj.data.length : 0));
          }
        } catch {
          // Gracefully continue
        }
      }

      // 3. Support tickets (only if user has support permission)
      if (canAccessSupport) {
        try {
          const tckRes = await fetch('/api/admin/support/tickets?limit=50', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tckRes.ok) {
            const tj = await tckRes.json();
            const list = tj.data || [];
            const urgent = list.filter((t: any) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;
            const actionReq = list.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
            setUrgentTicketsCount(urgent);
            setActionRequiredTicketsCount(actionReq);
          }
        } catch {
          // Gracefully continue
        }
      }

      // 4. Pending billing orders (only if user has finance permission)
      if (canAccessFinance) {
        try {
          const ordRes = await fetch('/api/admin/subscription/orders', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (ordRes.ok) {
            const oj = await ordRes.json();
            const olist = oj.data || [];
            const pending = olist.filter((o: any) => o.status === 'pending_payment' || o.status === 'pending_verification').length;
            const paidOrders = olist.filter((o: any) => o.status === 'paid' || o.status === 'active');
            const rev = paidOrders.reduce((sum: number, o: any) => sum + (o.amount || o.price || 0), 0);
            setPendingOrdersCount(pending);
            setMetrics(prev => ({
              ...prev,
              total_revenue: rev,
              pro_stores: paidOrders.length
            }));
          }
        } catch {
          // Gracefully continue
        }
      }
    } catch {
      // Fail gracefully
    }
  }, [token, canAccessCompliance, canAccessSupport, canAccessFinance]);

  useEffect(() => {
    loadPlatformStats();
  }, [loadPlatformStats]);

  // Global Document Preview Modal state (for payment proofs, report evidence, ticket attachments)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState('Bukti Dokumen');

  // =========================================================================
  // SUB-VIEW: REPORTS (Kepatuhan & Laporan Pelanggaran)
  // =========================================================================
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedReportDetail, setSelectedReportDetail] = useState<any | null>(null);
  const [selectedReportDetailLoading, setSelectedReportDetailLoading] = useState(false);
  const [reportActiveEvidence, setReportActiveEvidence] = useState<any[]>([]);
  const [reportPriorHistory, setReportPriorHistory] = useState<any[]>([]);
  const [reportsFilter, setReportsFilter] = useState<'all' | 'pending' | 'investigating' | 're_review' | 'action_taken' | 'banned' | 'dismissed' | 'resolved'>('all');
  const [reportsTargetFilter, setReportsTargetFilter] = useState<'all' | 'item' | 'catalog'>('all');
  const [reportsSearchQuery, setReportsSearchQuery] = useState('');
  const [debouncedReportsSearch, setDebouncedReportsSearch] = useState('');
  const [reportMetrics, setReportMetrics] = useState<any | null>(null);
  const [reportsPagination, setReportsPagination] = useState<{ page: number; limit: number; total: number; total_pages: number }>({ page: 1, limit: 12, total: 0, total_pages: 1 });
  const [moderationStatus, setModerationStatus] = useState<string>('pending');
  const [moderationAction, setModerationAction] = useState<string>('none');
  const [actionReason, setActionReason] = useState('');
  const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);
  const [showModerationConfirmModal, setShowModerationConfirmModal] = useState(false);
  const [bannedConfirmModalReport, setBannedConfirmModalReport] = useState<any | null>(null);
  const [bannedConfirmAcknowledged, setBannedConfirmAcknowledged] = useState(false);

  // Target counts for compliance reports in tablet
  const reportTargetCounts = useMemo(() => {
    const item = reports.filter(r => r.target_type !== 'catalog' && r.target_type !== 'store').length;
    const catalog = reports.filter(r => r.target_type === 'catalog' || r.target_type === 'store').length;
    const total = reportMetrics ? reportMetrics.total : reports.length;
    return { total, item, catalog };
  }, [reports, reportMetrics]);

  // Dynamic Status Options for Reports in tablet: strictly count > 0
  const reportStatusOptions = useMemo<TabletSelectOption[]>(() => {
    const list: TabletSelectOption[] = [
      { value: 'all', label: 'Semua Status Laporan', count: reportMetrics ? reportMetrics.total : reports.length },
      { value: 'pending', label: 'Menunggu', count: reportMetrics ? reportMetrics.pending : reports.filter(r => r.status === 'pending').length },
      { value: 'investigating', label: 'Investigasi', count: reportMetrics ? reportMetrics.investigating : reports.filter(r => r.status === 'investigating' || r.status === 'in_review').length },
      { value: 're_review', label: 'Revisi Masuk', count: reportMetrics ? (reportMetrics.re_review || 0) : reports.filter(r => r.status === 're_review').length },
      { value: 'action_taken', label: 'Ditindak', count: reportMetrics ? (reportMetrics.action_taken - (reportMetrics.banned || 0) > 0 ? reportMetrics.action_taken - (reportMetrics.banned || 0) : reportMetrics.action_taken) : reports.filter(r => (r.status === 'action_taken' || (r.action_taken && r.action_taken !== 'none')) && r.action_taken !== 'catalog_banned' && r.status !== 'banned').length },
      { value: 'banned', label: 'Banned', count: reportMetrics ? (reportMetrics.banned || 0) : reports.filter(r => r.status === 'banned' || r.action_taken === 'catalog_banned').length },
      { value: 'dismissed', label: 'Ditolak', count: reportMetrics ? reportMetrics.dismissed : reports.filter(r => r.status === 'dismissed').length },
      { value: 'resolved', label: 'Selesai', count: reportMetrics ? reportMetrics.resolved : reports.filter(r => r.status === 'resolved').length }
    ];
    return list.filter(opt => opt.value === 'all' || (typeof opt.count === 'number' && opt.count > 0));
  }, [reportMetrics, reports]);

  // Dynamic Target Options for Reports in tablet: strictly count > 0
  const reportTargetOptions = useMemo<TabletSelectOption[]>(() => {
    const list: TabletSelectOption[] = [
      { value: 'all', label: 'Semua Target', count: reportTargetCounts.total },
      { value: 'item', label: 'Hanya Item', count: reportTargetCounts.item },
      { value: 'catalog', label: 'Katalog Toko', count: reportTargetCounts.catalog }
    ];
    return list.filter(opt => opt.value === 'all' || (typeof opt.count === 'number' && opt.count > 0));
  }, [reportTargetCounts]);

  // Safety auto-resets for tablet compliance reports
  useEffect(() => {
    if (reportsFilter !== 'all' && reportStatusOptions.length > 1) {
      if (!reportStatusOptions.some(opt => opt.value === reportsFilter)) {
        setReportsFilter('all');
      }
    }
  }, [reportStatusOptions, reportsFilter]);

  useEffect(() => {
    if (reportsTargetFilter !== 'all' && reportTargetOptions.length > 1) {
      if (!reportTargetOptions.some(opt => opt.value === reportsTargetFilter)) {
        setReportsTargetFilter('all');
      }
    }
  }, [reportTargetOptions, reportsTargetFilter]);

  useModalBackHandler({
    isOpen: showModerationConfirmModal,
    onClose: () => {
      setShowModerationConfirmModal(false);
      setBannedConfirmModalReport(null);
      setBannedConfirmAcknowledged(false);
    },
    modalId: 'tablet_moderation_confirm_modal'
  });

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

  // 300ms Debounce for reports search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedReportsSearch(reportsSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [reportsSearchQuery]);

  const reportsFilterRef = useRef(reportsFilter);
  reportsFilterRef.current = reportsFilter;
  const reportsTargetFilterRef = useRef(reportsTargetFilter);
  reportsTargetFilterRef.current = reportsTargetFilter;
  const debouncedReportsSearchRef = useRef(debouncedReportsSearch);
  debouncedReportsSearchRef.current = debouncedReportsSearch;

  // Server-side fetch compliance reports list
  const fetchReports = useCallback(async (
    page = 1,
    status = reportsFilterRef.current,
    target = reportsTargetFilterRef.current,
    search = debouncedReportsSearchRef.current
  ) => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '12',
        status: status,
        target_type: target,
        search: search
      });
      const res = await authFetch(`/api/admin/reports?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        const dataList = j.data || [];
        setReports(dataList);
        if (j.pagination) {
          setReportsPagination(j.pagination);
        }
        if (j.metrics) {
          setReportMetrics(j.metrics);
          if (typeof j.metrics.pending === 'number') {
            setPendingReportsCount(j.metrics.pending);
          }
        }
        // Auto-select first report if list not empty and current selection invalid
        if (dataList.length > 0) {
          setSelectedReportId(prev => {
            if (prev && dataList.some((r: any) => r.id === prev)) return prev;
            return dataList[0].id;
          });
        } else {
          setSelectedReportId(null);
          setSelectedReportDetail(null);
        }
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Gagal memuat antrean laporan', 'error');
      }
    } finally {
      setReportsLoading(false);
    }
  }, [token, authFetch, showToast]);

  // Trigger fetch when tab is reports or filters/search change
  useEffect(() => {
    if (activeView === 'reports' && token) {
      fetchReports(1, reportsFilter, reportsTargetFilter, debouncedReportsSearch);
    }
  }, [activeView, token, reportsFilter, reportsTargetFilter, debouncedReportsSearch, fetchReports]);

  // Fetch full report detail including multi-reporter evidence timeline & prior review history
  useEffect(() => {
    if (!selectedReportId || !token || activeView !== 'reports') {
      return;
    }
    let isCancelled = false;
    const fetchReportDetail = async () => {
      setSelectedReportDetailLoading(true);
      try {
        const res = await authFetch(`/api/admin/reports/${selectedReportId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && !isCancelled) {
          const d = await res.json();
          const rep = d.data;
          setSelectedReportDetail(rep);
          setReportActiveEvidence(d.active_reports || d.active_evidence || []);
          setReportPriorHistory(d.history_reports || d.prior_history || []);

          if (rep) {
            setModerationStatus(rep.status === 'pending' ? 'investigating' : rep.status);
            setModerationAction(rep.action_taken || 'none');
            setActionReason(rep.admin_notes || '');
          }
        }
      } catch (err: any) {
        if (!isCancelled && err?.message !== 'UNAUTHORIZED') {
          // Graceful handling
        }
      } finally {
        if (!isCancelled) setSelectedReportDetailLoading(false);
      }
    };

    fetchReportDetail();
    return () => { isCancelled = true; };
  }, [selectedReportId, token, authFetch, activeView]);

  const handleUpdateReportStatus = async (
    reportId: number,
    status: string,
    actionTaken: string = 'none',
    notes?: string,
    applyEnforcement: boolean = true
  ) => {
    setIsSubmittingModeration(true);
    try {
      const res = await authFetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          action_taken: actionTaken,
          admin_notes: notes || actionReason || 'Tindakan penertiban oleh staf pengelola tablet',
          apply_enforcement: applyEnforcement
        })
      });
      if (res.ok) {
        showToast(`Tindakan moderasi (${status}) berhasil diterapkan!`, 'success');
        setShowModerationConfirmModal(false);
        setBannedConfirmModalReport(null);
        setBannedConfirmAcknowledged(false);
        await fetchReports(reportsPagination.page);
        loadPlatformStats();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Gagal memperbarui status laporan', 'error');
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Terjadi kesalahan jaringan', 'error');
      }
    } finally {
      setIsSubmittingModeration(false);
    }
  };

  const generateReportWhatsAppWarning = (rep: any) => {
    const storeName = rep.store_title || rep.target_store_name || `Store #${rep.store_id || rep.target_store_id}`;
    const entityName = rep.target_type === 'item' ? (rep.item_name || 'Item') : storeName;
    const caseId = rep.report_number || `#RPT-${rep.id}`;
    const reason = rep.reason_label || rep.reason_category || 'Kepatuhan Etalase';
    const text = `Halo Pengelola *${storeName}*,\n\nKami dari Tim Kepatuhan Platform Catavor ingin memberitahukan terkait laporan kepatuhan (${caseId}) untuk target *${entityName}* dengan kategori: *${reason}*.\n\nCatatan Investigasi: ${actionReason || rep.description || 'Harap tinjau etalase Anda agar senantiasa sesuai dengan ketentuan platform Catavor.'}\n\nMohon lakukan penyesuaian atau koordinasi melalui Pusat Bantuan di dashboard merchant Anda.\n\nTerima kasih,\nTim Kepatuhan Catavor`;
    return encodeURIComponent(text);
  };

  const handleCopyReportWarning = (rep: any) => {
    const storeName = rep.store_title || rep.target_store_name || `Store #${rep.store_id || rep.target_store_id}`;
    const entityName = rep.target_type === 'item' ? (rep.item_name || 'Item') : storeName;
    const caseId = rep.report_number || `#RPT-${rep.id}`;
    const reason = rep.reason_label || rep.reason_category || 'Kepatuhan Etalase';
    const text = `[PERINGATAN RESMI KEPATUHAN CATAVOR]\nKasus: ${caseId}\nTarget: ${entityName} (${storeName})\nKategori: ${reason}\nCatatan: ${actionReason || rep.description || 'Pemeriksaan kepatuhan etalase'}\nStatus: ${moderationStatus.toUpperCase()}\nTindakan: ${moderationAction}\nTanggal: ${new Date().toLocaleString('id-ID')}`;
    navigator.clipboard.writeText(text);
    showToast('Format teks peringatan disalin ke clipboard', 'success');
  };

  // =========================================================================
  // =========================================================================
  // SUB-VIEW: SUPPORT (Helpdesk CS)
  // =========================================================================
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [supportFilter, setSupportFilter] = useState<'all' | 'action_required' | 'in_progress' | 'waiting_user' | 'urgent' | 'resolved'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
  const [ticketSlaFilter, setTicketSlaFilter] = useState<string>('all');
  const [resolvedTimeRangeFilter, setResolvedTimeRangeFilter] = useState<'30d' | '90d' | 'all'>('30d');
  const [supportSearch, setSupportSearch] = useState('');
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [ticketReplyAttachments, setTicketReplyAttachments] = useState<any[]>([]);
  const [isUploadingTicketAttachment, setIsUploadingTicketAttachment] = useState(false);
  const [activePresences, setActivePresences] = useState<any[]>([]);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
  const [ticketsMetrics, setTicketsMetrics] = useState<any>(null);
  const [ticketsPagination, setTicketsPagination] = useState<{
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_more: boolean;
  }>({
    page: 1,
    limit: 15,
    total_items: 0,
    total_pages: 1,
    has_more: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTicketSearch(supportSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [supportSearch]);

  // Dynamic Support Category Options: strictly count > 0
  const dynamicTicketCategoryOptions = useMemo<TabletSelectOption[]>(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const cat = t.category || 'general';
      map[cat] = (map[cat] || 0) + 1;
    });
    const total = ticketsPagination.total_items || tickets.length;
    const options: TabletSelectOption[] = [
      { value: 'all', label: 'Semua Kategori', count: total }
    ];
    Object.entries(map)
      .filter(([_, count]) => count > 0)
      .forEach(([cat, count]) => {
        const matching = TICKET_CATEGORY_OPTIONS.find(o => o.value === cat);
        options.push({
          value: cat,
          label: matching ? matching.label : (cat.charAt(0).toUpperCase() + cat.slice(1)),
          description: matching?.description,
          count
        });
      });
    return options;
  }, [tickets, ticketsPagination.total_items]);

  // Dynamic Support Priority Options: strictly count > 0
  const dynamicTicketPriorityOptions = useMemo<TabletSelectOption[]>(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const p = (t.priority || 'medium').toLowerCase();
      map[p] = (map[p] || 0) + 1;
    });
    const total = ticketsPagination.total_items || tickets.length;
    const options: TabletSelectOption[] = [
      { value: 'all', label: 'Semua Prioritas', count: total }
    ];
    TICKET_PRIORITY_FILTER_OPTIONS.forEach(opt => {
      if (opt.value !== 'all') {
        const count = map[opt.value] || 0;
        if (count > 0) {
          options.push({
            ...opt,
            count
          });
        }
      }
    });
    return options;
  }, [tickets, ticketsPagination.total_items]);

  // Dynamic Support Status Options: strictly count > 0
  const dynamicTicketStatusOptions = useMemo<TabletSelectOption[]>(() => {
    const totalCount = ticketsMetrics?.total ?? ticketsPagination.total_items ?? tickets.length;
    const actionRequiredCount = ticketsMetrics?.action_required ?? 0;
    const inProgressCount = ticketsMetrics?.in_progress ?? 0;
    const waitingUserCount = ticketsMetrics?.waiting_user ?? 0;
    const urgentCount = ticketsMetrics?.urgent ?? 0;
    const resolvedCount = ticketsMetrics?.resolved ?? 0;

    const raw: TabletSelectOption[] = [
      { value: 'all', label: 'Semua Status Tiket', count: totalCount },
      { value: 'action_required', label: 'Perlu Respon', count: actionRequiredCount },
      { value: 'in_progress', label: 'Diproses', count: inProgressCount },
      { value: 'waiting_user', label: 'Tunggu Merchant', count: waitingUserCount },
      { value: 'urgent', label: 'Urgent', count: urgentCount },
      { value: 'resolved', label: 'Selesai', count: resolvedCount }
    ];
    return raw.filter(opt => opt.value === 'all' || (opt.count !== undefined && opt.count > 0));
  }, [ticketsMetrics, ticketsPagination.total_items, tickets.length]);

  const activeTabletTriageFilter = ticketPriorityFilter === 'urgent' ? 'urgent' : supportFilter;

  const handleTabletTriageFilterChange = (val: string) => {
    if (val === 'urgent') {
      setTicketPriorityFilter('urgent');
      setSupportFilter('all');
    } else {
      if (ticketPriorityFilter === 'urgent') {
        setTicketPriorityFilter('all');
      }
      setSupportFilter(val as any);
    }
  };

  // Safety auto-resets for tablet support
  useEffect(() => {
    const current = ticketPriorityFilter === 'urgent' ? 'urgent' : supportFilter;
    if (current !== 'all' && dynamicTicketStatusOptions.length > 1) {
      if (!dynamicTicketStatusOptions.some(o => o.value === current)) {
        handleTabletTriageFilterChange('all');
      }
    }
  }, [dynamicTicketStatusOptions, supportFilter, ticketPriorityFilter]);

  useEffect(() => {
    if (ticketCategoryFilter !== 'all' && dynamicTicketCategoryOptions.length > 1) {
      if (!dynamicTicketCategoryOptions.some(o => o.value === ticketCategoryFilter)) {
        setTicketCategoryFilter('all');
      }
    }
  }, [dynamicTicketCategoryOptions, ticketCategoryFilter]);

  useEffect(() => {
    if (ticketPriorityFilter !== 'all' && dynamicTicketPriorityOptions.length > 1) {
      if (!dynamicTicketPriorityOptions.some(o => o.value === ticketPriorityFilter)) {
        setTicketPriorityFilter('all');
      }
    }
  }, [dynamicTicketPriorityOptions, ticketPriorityFilter]);

  // Support helpers
  const getTicketStatusMeta = useCallback((status: string) => {
    switch (status) {
      case 'open':
      case 'waiting_agent':
        return {
          label: 'Open (Baru)',
          shortLabel: 'Baru',
          color: '#06b6d4',
          bg: 'rgba(6, 182, 212, 0.12)',
          border: 'rgba(6, 182, 212, 0.3)'
        };
      case 'in_progress':
        return {
          label: 'Sedang Diproses',
          shortLabel: 'Diproses',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)'
        };
      case 'waiting_user':
        return {
          label: 'Menunggu Merchant',
          shortLabel: 'Tunggu Merchant',
          color: '#a855f7',
          bg: 'rgba(168, 85, 247, 0.12)',
          border: 'rgba(168, 85, 247, 0.3)'
        };
      case 'resolved':
        return {
          label: 'Terselesaikan',
          shortLabel: 'Selesai',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)'
        };
      case 'closed':
        return {
          label: 'Ditutup Permanen',
          shortLabel: 'Ditutup',
          color: '#94a3b8',
          bg: 'rgba(100, 116, 139, 0.15)',
          border: 'rgba(100, 116, 139, 0.3)'
        };
      default:
        return {
          label: String(status || 'OPEN').toUpperCase(),
          shortLabel: String(status || 'OPEN').toUpperCase(),
          color: 'var(--primary)',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)'
        };
    }
  }, []);

  const getStoreDisplayName = useCallback((ticket: any) => {
    if (ticket?.store?.name) return ticket.store.name;
    if (ticket?.store_name) return ticket.store_name;
    if (ticket?.store?.slug) return ticket.store.slug;
    if (ticket?.store_slug) return ticket.store_slug;
    if (ticket?.user?.name) return ticket.user.name;
    return ticket?.user_email || 'Merchant';
  }, []);

  const getStorePlanBadge = useCallback((ticket: any) => {
    const plan = String(ticket?.store?.plan || ticket?.store_plan || 'free').toLowerCase();
    if (plan === 'enterprise') return 'ENTERPRISE';
    if (plan === 'pro') return 'PRO';
    return 'FREE';
  }, []);

  const getUserRequesterName = useCallback((ticket: any, msgSender?: any) => {
    if (msgSender?.name) return msgSender.name;
    if (ticket?.user?.name) return ticket.user.name;
    if (ticket?.user_name) return ticket.user_name;
    const rawEmail = ticket?.user?.email || ticket?.user_email || msgSender?.email || '';
    return rawEmail.split('@')[0] || 'Merchant';
  }, []);

  const formatSupportDateTime = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Filter values reference guard to prevent recreation/infinite-loop
  const ticketsFilterRef = useRef({
    page: 1,
    supportFilter,
    ticketCategoryFilter,
    ticketPriorityFilter,
    ticketSlaFilter,
    debouncedTicketSearch,
    resolvedTimeRangeFilter
  });

  useEffect(() => {
    ticketsFilterRef.current = {
      page: ticketsPagination.page,
      supportFilter,
      ticketCategoryFilter,
      ticketPriorityFilter,
      ticketSlaFilter,
      debouncedTicketSearch,
      resolvedTimeRangeFilter
    };
  }, [ticketsPagination.page, supportFilter, ticketCategoryFilter, ticketPriorityFilter, ticketSlaFilter, debouncedTicketSearch, resolvedTimeRangeFilter]);

  // Server-Side Support Tickets Fetcher
  const fetchTickets = useCallback(async (
    page = 1,
    statusOverride?: string,
    categoryOverride?: string,
    priorityOverride?: string,
    slaOverride?: string,
    searchOverride?: string,
    timeRangeOverride?: string
  ) => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const st = statusOverride !== undefined ? statusOverride : ticketsFilterRef.current.supportFilter;
      const cat = categoryOverride !== undefined ? categoryOverride : ticketsFilterRef.current.ticketCategoryFilter;
      const pri = priorityOverride !== undefined ? priorityOverride : ticketsFilterRef.current.ticketPriorityFilter;
      const sla = slaOverride !== undefined ? slaOverride : ticketsFilterRef.current.ticketSlaFilter;
      const q = searchOverride !== undefined ? searchOverride : ticketsFilterRef.current.debouncedTicketSearch;
      const tr = timeRangeOverride !== undefined ? timeRangeOverride : ticketsFilterRef.current.resolvedTimeRangeFilter;

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (st !== 'all') params.set('status', st);
      if (cat !== 'all') params.set('category', cat);
      if (pri !== 'all') params.set('priority', pri);
      if (sla === 'breached') params.set('sla_breached', 'true');
      if (st === 'resolved' && tr !== 'all') {
        params.set('time_range', tr);
      }
      if (q.trim()) {
        params.set('q', q.trim());
      }

      const res = await authFetch(`/api/admin/support/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json.data || json.tickets || []);
        setTickets(data);
        if (json.pagination) {
          setTicketsPagination(json.pagination);
        }
        if (json.metrics) {
          setTicketsMetrics(json.metrics);
        }
      }
    } catch {
      // Fail silently
    } finally {
      setTicketsLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'support') {
      fetchTickets(1);
    }
  }, [activeView, supportFilter, ticketCategoryFilter, ticketPriorityFilter, ticketSlaFilter, debouncedTicketSearch, resolvedTimeRangeFilter, fetchTickets]);

  const fetchTicketDetail = useCallback(async (id: number) => {
    setSelectedTicketId(id);
    setTicketDetailsLoading(true);
    try {
      const res = await authFetch(`/api/admin/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        const data = j.data || j.ticket || j;
        setTicketDetail(data);

        // Fetch collision presences
        try {
          const presRes = await authFetch(`/api/admin/support/tickets/${id}/presence`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (presRes.ok) {
            const presJson = await presRes.json();
            setActivePresences(presJson.presences || presJson.data || []);
          }
        } catch {}
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Gagal memuat rincian tiket', 'error');
      }
    } finally {
      setTicketDetailsLoading(false);
    }
  }, [token, authFetch, showToast]);

  const handleSendTicketReply = async (isNote = false) => {
    if (!selectedTicketId || (!ticketReply.trim() && ticketReplyAttachments.length === 0)) return;
    try {
      const payload: any = {
        message: ticketReply.trim(),
        attachments: ticketReplyAttachments,
        is_internal_note: isNote || isInternalNote
      };
      const res = await authFetch(`/api/admin/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(isNote || isInternalNote ? 'Catatan internal berhasil disimpan' : 'Balasan berhasil dikirim ke merchant');
        setTicketReply('');
        setTicketReplyAttachments([]);
        fetchTicketDetail(selectedTicketId);
        fetchTickets(ticketsPagination.page);
        loadPlatformStats();
      } else {
        showToast('Gagal mengirim balasan', 'error');
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Terjadi kesalahan koneksi', 'error');
      }
    }
  };

  const handleUploadTicketAttachment = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingTicketAttachment(true);
    try {
      for (let i = 0; i < Math.min(files.length, 5 - ticketReplyAttachments.length); i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        const res = await authFetch('/api/storage/upload?category=support', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const j = await res.json();
          const fileUrl = j.url || j.data?.url || j.file_url;
          if (fileUrl) {
            setTicketReplyAttachments(prev => [
              ...prev,
              {
                file_url: fileUrl,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size
              }
            ]);
          }
        }
      }
      showToast('Lampiran berhasil diunggah');
    } catch {
      showToast('Gagal mengunggah lampiran', 'error');
    } finally {
      setIsUploadingTicketAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateTicketStatus = async (status: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await authFetch(`/api/admin/support/tickets/${selectedTicketId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const statusMeta = getTicketStatusMeta(status);
        showToast(`Status tiket diperbarui ke: ${statusMeta.label}`);
        fetchTicketDetail(selectedTicketId);
        fetchTickets(ticketsPagination.page);
        loadPlatformStats();
      } else {
        showToast('Gagal memperbarui status tiket', 'error');
      }
    } catch {
      showToast('Gagal memperbarui status tiket', 'error');
    }
  };

  const handleUpdateTicketPriority = async (ticketId: number, priority: string) => {
    try {
      const res = await authFetch(`/api/admin/support/tickets/${ticketId}/priority`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority })
      });
      if (res.ok) {
        showToast(`Prioritas tiket diubah ke ${priority.toUpperCase()}`);
        fetchTicketDetail(ticketId);
        fetchTickets(ticketsPagination.page);
      } else {
        showToast('Gagal memperbarui prioritas tiket', 'error');
      }
    } catch {
      showToast('Gagal memperbarui prioritas tiket', 'error');
    }
  };

  const handleInsertCannedTemplate = (content: string) => {
    setTicketReply(prev => (prev ? `${prev}\n\n${content}` : content));
    setShowCannedModal(false);
    showToast('Template balasan disisipkan ke pesan');
  };

  // =========================================================================
  // SUB-VIEW: FINANCE (Keuangan & Billing)
  // =========================================================================
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [financeFilter, setFinanceFilter] = useState<'all' | 'pending_verification' | 'pending_payment' | 'paid' | 'rejected'>('all');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/subscription/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setOrders(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'finance') {
      fetchOrders();
    }
  }, [activeView, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (financeFilter === 'all') return true;
      if (financeFilter === 'paid') return o.status === 'paid' || o.status === 'active';
      return o.status === financeFilter;
    });
  }, [orders, financeFilter]);

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const handleUpdateOrderStatus = async (orderId: number, status: 'active' | 'rejected', notes?: string) => {
    try {
      const res = await authFetch(`/api/admin/subscription/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, rejection_reason: notes })
      });
      if (res.ok) {
        showToast(status === 'active' ? 'Paket langganan berhasil diaktifkan!' : 'Pesanan ditandai ditolak.', 'success');
        fetchOrders();
        loadPlatformStats();
        setShowRejectModal(false);
        setRejectionReason('');
      } else {
        showToast('Gagal memproses pesanan', 'error');
      }
    } catch {
      showToast('Kesalahan server', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: BROADCAST (Siaran Pengumuman)
  // =========================================================================
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [broadcastSubView, setBroadcastSubView] = useState<'list' | 'create'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sub = (params.get('subview') || params.get('subtab') || params.get('action') || '').toLowerCase();
      if (['create', 'new', 'tambah', 'buat'].includes(sub)) return 'create';
    }
    return 'list';
  });
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | number | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
      if (bId) return bId;
    }
    return null;
  });
  const [selectedBroadcastDetail, setSelectedBroadcastDetail] = useState<any | null>(null);
  const [isFetchingBroadcastDetail, setIsFetchingBroadcastDetail] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
      return Boolean(bId);
    }
    return false;
  });
  const [broadcastPage, setBroadcastPage] = useState<number>(1);
  const [broadcastTotalPages, setBroadcastTotalPages] = useState<number>(1);
  const [broadcastTotalItems, setBroadcastTotalItems] = useState<number>(0);
  const broadcastPageSize = 10;
  const broadcastCacheRef = useRef<Map<string, { data: any[]; pagination: any; metrics: any; timestamp: number }>>(new Map());

  // URL Deep-Linking & History Synchronizer for Broadcast
  const updateBroadcastUrl = useCallback((subview?: 'list' | 'create' | 'detail' | null, broadcastId?: number | string | null) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'broadcast');
      if (subview && subview !== 'list') {
        url.searchParams.set('subview', subview);
      } else {
        url.searchParams.delete('subview');
      }
      if (broadcastId) {
        const cleanId = String(broadcastId).replace(/[^a-zA-Z0-9_#-]/g, '').trim();
        url.searchParams.set('broadcast_id', cleanId);
      } else {
        url.searchParams.delete('broadcast_id');
        url.searchParams.delete('broadcast');
        url.searchParams.delete('notif_id');
      }
      const newRelativePathQuery = url.pathname + url.search + url.hash;
      const currentRelativePathQuery = window.location.pathname + window.location.search + window.location.hash;
      if (newRelativePathQuery !== currentRelativePathQuery) {
        window.history.pushState(
          { tab: 'broadcast', subview: subview || 'list', broadcast_id: broadcastId || null },
          '',
          newRelativePathQuery
        );
      }
    } catch (e) {
      console.error('Failed to sync tablet broadcast URL:', e);
    }
  }, []);

  const [broadcastMetrics, setBroadcastMetrics] = useState({
    total_broadcasts: 0,
    active_broadcasts: 0,
    targeted_broadcasts: 0
  });
  const [broadcastStatusFilter, setBroadcastStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [broadcastSearchQuery, setBroadcastSearchQuery] = useState('');
  const [debouncedBroadcastSearch, setDebouncedBroadcastSearch] = useState('');
  const [isFetchingBroadcasts, setIsFetchingBroadcasts] = useState(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [targetRecipientSearch, setTargetRecipientSearch] = useState('');
  const [recipientSuggestions, setRecipientSuggestions] = useState<any[]>([]);
  const [isSearchingRecipients, setIsSearchingRecipients] = useState(false);
  const recipientSearchAbortControllerRef = useRef<AbortController | null>(null);
  const recipientSearchCacheRef = useRef<Map<string, any[]>>(new Map());

  const [broadcastForm, setBroadcastForm] = useState({
    target_type: 'all' as 'all' | 'plan' | 'specific' | 'single_store' | 'single_user',
    target_plan_code: 'pro',
    target_id: 0,
    target_name: '',
    recipients: [] as Array<{
      type: 'store' | 'user';
      id: number;
      name: string;
      slug?: string;
      email?: string;
      plan?: string;
    }>,
    title: '',
    category: 'PENGUMUMAN',
    message: '',
    notification_action_enabled: false,
    action_type: 'none' as 'detail' | 'navigate' | 'external_link' | 'none',
    detail_content: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'system',
    link_sub_tab: 'settings',
    link_mobile_settings_tab: 'about',
    action_label: 'Buka Pengumuman Lengkap →',
    action_url: '',
    expires_in_hours: 0
  });

  // 300ms Debounced Broadcast Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedBroadcastSearch(broadcastSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [broadcastSearchQuery]);

  // Unified Autocomplete Search for Stores & Users with in-memory caching & AbortController
  useEffect(() => {
    const query = targetRecipientSearch.trim();
    if (['specific', 'single_store', 'single_user'].includes(broadcastForm.target_type) && query.length >= 1) {
      const cacheKey = `${broadcastForm.target_type}:${query.toLowerCase()}`;
      if (recipientSearchCacheRef.current.has(cacheKey)) {
        setRecipientSuggestions(recipientSearchCacheRef.current.get(cacheKey) || []);
        setIsSearchingRecipients(false);
        return;
      }

      setIsSearchingRecipients(true);
      const timer = setTimeout(async () => {
        if (recipientSearchAbortControllerRef.current) {
          recipientSearchAbortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        recipientSearchAbortControllerRef.current = abortController;

        try {
          const authToken = token || localStorage.getItem('catavor_token') || '';
          const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

          const [storesRes, usersRes] = await Promise.allSettled([
            fetch(`/api/admin/stores/search?q=${encodeURIComponent(query)}`, { headers, signal: abortController.signal }),
            fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`, { headers, signal: abortController.signal })
          ]);

          if (abortController.signal.aborted) return;

          const results: Array<{
            type: 'store' | 'user';
            id: number;
            name: string;
            slug?: string;
            email?: string;
            plan?: string;
          }> = [];

          if (storesRes.status === 'fulfilled' && storesRes.value.ok) {
            const data = await storesRes.value.json();
            const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
            list.forEach((s: any) => {
              results.push({
                type: 'store',
                id: s.id,
                name: s.store_title || s.name || s.slug || `Toko #${s.id}`,
                slug: s.slug,
                plan: s.plan || s.subscription_plan || 'free',
                email: s.user_email || s.email
              });
            });
          }

          if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
            const data = await usersRes.value.json();
            const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
            list.forEach((u: any) => {
              results.push({
                type: 'user',
                id: u.id,
                name: u.name || u.email || `User #${u.id}`,
                email: u.email
              });
            });
          }

          if (recipientSearchCacheRef.current.size >= 100) {
            const firstKey = recipientSearchCacheRef.current.keys().next().value;
            if (firstKey) recipientSearchCacheRef.current.delete(firstKey);
          }
          recipientSearchCacheRef.current.set(cacheKey, results);
          setRecipientSuggestions(results);
        } catch (e: any) {
          if (e?.name !== 'AbortError') {
            console.error('Failed to search recipients:', e);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsSearchingRecipients(false);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (recipientSearchAbortControllerRef.current) {
          recipientSearchAbortControllerRef.current.abort();
        }
      };
    } else {
      setRecipientSuggestions([]);
      setIsSearchingRecipients(false);
    }
  }, [targetRecipientSearch, broadcastForm.target_type, token]);

  const fetchSingleBroadcastDetail = useCallback(async (id: number | string) => {
    if (!id) {
      setIsFetchingBroadcastDetail(false);
      return;
    }
    const cleanId = String(id).replace(/[^a-zA-Z0-9_#-]/g, '').trim();
    if (!cleanId) {
      setIsFetchingBroadcastDetail(false);
      return;
    }
    setIsFetchingBroadcastDetail(true);

    const authToken = token || localStorage.getItem('catavor_token') || localStorage.getItem('token') || '';
    const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    // 1. Check in-memory broadcasts if available
    if (broadcasts && broadcasts.length > 0) {
      const existing = broadcasts.find(b => 
        String(b.id) === cleanId || 
        String(b.id).replace('#', '') === cleanId.replace('#', '')
      );
      if (existing) {
        setSelectedBroadcastDetail(existing);
        setIsFetchingBroadcastDetail(false);
        return;
      }
    }

    try {
      // 2. Fetch direct broadcast detail from admin endpoint
      const res = await authFetch(`/api/admin/notifications/${encodeURIComponent(cleanId)}`, { headers });
      if (res.ok) {
        const d = await res.json();
        if (d.data) {
          setSelectedBroadcastDetail(d.data);
          setIsFetchingBroadcastDetail(false);
          return;
        }
      }

      // 3. Fallback to standard notifications endpoint
      const res2 = await authFetch(`/api/notifications/${encodeURIComponent(cleanId)}`, { headers });
      if (res2.ok) {
        const d2 = await res2.json();
        if (d2.data) {
          setSelectedBroadcastDetail(d2.data);
          setIsFetchingBroadcastDetail(false);
          return;
        }
      }

      // 4. Secondary fallback: query list to find item
      const resList = await authFetch('/api/admin/notifications?limit=50', { headers });
      if (resList.ok) {
        const listData = await resList.json();
        const arr = Array.isArray(listData.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const matched = arr.find((b: any) => 
          String(b.id) === cleanId || 
          String(b.id).replace('#', '') === cleanId.replace('#', '')
        );
        if (matched) {
          setSelectedBroadcastDetail(matched);
          setIsFetchingBroadcastDetail(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch single broadcast detail:', e);
    } finally {
      setIsFetchingBroadcastDetail(false);
    }
  }, [token, broadcasts, authFetch]);

  const fetchBroadcasts = useCallback(async (page = 1, force = false) => {
    if (!token) return;
    const cacheKey = `p${page}_s${broadcastStatusFilter}_q${debouncedBroadcastSearch.trim()}`;
    const cached = broadcastCacheRef.current.get(cacheKey);
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp < 30000)) {
      setBroadcasts(cached.data);
      if (cached.pagination) {
        setBroadcastPage(cached.pagination.page || page);
        setBroadcastTotalPages(cached.pagination.total_pages || 1);
        setBroadcastTotalItems(cached.pagination.total_items || cached.data.length);
      }
      if (cached.metrics) setBroadcastMetrics(cached.metrics);
      return;
    }

    setIsFetchingBroadcasts(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(broadcastPageSize));
      if (broadcastStatusFilter !== 'all') params.set('status', broadcastStatusFilter);
      if (debouncedBroadcastSearch.trim()) params.set('q', debouncedBroadcastSearch.trim());

      const res = await authFetch(`/api/admin/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        const list = Array.isArray(j.data) ? j.data : (Array.isArray(j) ? j : []);
        setBroadcasts(list);
        if (j.pagination) {
          setBroadcastPage(j.pagination.page || page);
          setBroadcastTotalPages(j.pagination.total_pages || 1);
          setBroadcastTotalItems(j.pagination.total_items || list.length);
        } else {
          setBroadcastPage(page);
          setBroadcastTotalPages(1);
          setBroadcastTotalItems(list.length);
        }
        if (j.metrics) {
          setBroadcastMetrics(j.metrics);
        } else {
          setBroadcastMetrics({
            total_broadcasts: list.length,
            active_broadcasts: list.filter((b: any) => b.is_active !== false && (!b.expires_at || new Date(b.expires_at) > new Date())).length,
            targeted_broadcasts: list.filter((b: any) => b.target_type && b.target_type !== 'all').length
          });
        }

        // Cache results
        broadcastCacheRef.current.set(cacheKey, {
          data: list,
          pagination: j.pagination,
          metrics: j.metrics,
          timestamp: now
        });

        // Detail Selection & Refresh Persistence Logic
        if (selectedBroadcastId) {
          const found = list.find((b: any) => String(b.id) === String(selectedBroadcastId));
          if (found) {
            setSelectedBroadcastDetail(found);
          } else if (!selectedBroadcastDetail || String(selectedBroadcastDetail.id) !== String(selectedBroadcastId)) {
            fetchSingleBroadcastDetail(selectedBroadcastId);
          }
        } else if (typeof window !== 'undefined' && window.innerWidth >= 880 && list.length > 0) {
          // On spacious tablet only, auto select first broadcast if none selected
          setSelectedBroadcastId(list[0].id);
          setSelectedBroadcastDetail(list[0]);
        }
      }
    } catch {
      // Fail silently
    } finally {
      setIsFetchingBroadcasts(false);
    }
  }, [token, authFetch, broadcastStatusFilter, debouncedBroadcastSearch, selectedBroadcastId, selectedBroadcastDetail, fetchSingleBroadcastDetail]);

  useEffect(() => {
    if (activeView === 'broadcast') {
      fetchBroadcasts(1);
    }
  }, [activeView, broadcastStatusFilter, debouncedBroadcastSearch]);

  const selectedBroadcast = useMemo(() => {
    if (selectedBroadcastDetail && selectedBroadcastId && String(selectedBroadcastDetail.id) === String(selectedBroadcastId)) {
      return selectedBroadcastDetail;
    }
    if (selectedBroadcastId) {
      return broadcasts.find(b => String(b.id) === String(selectedBroadcastId)) || selectedBroadcastDetail || null;
    }
    return null;
  }, [broadcasts, selectedBroadcastId, selectedBroadcastDetail]);

  const handleSelectBroadcast = useCallback((bc: any) => {
    setSelectedBroadcastId(bc.id);
    setSelectedBroadcastDetail(bc);
    updateBroadcastUrl('detail', bc.id);
  }, [updateBroadcastUrl]);

  const handleClearBroadcastSelection = useCallback(() => {
    setSelectedBroadcastId(null);
    setSelectedBroadcastDetail(null);
    updateBroadcastUrl('list', null);
  }, [updateBroadcastUrl]);

  // Deep-link initial hydration effect
  useEffect(() => {
    if (activeView === 'broadcast' && selectedBroadcastId) {
      if (!selectedBroadcastDetail || String(selectedBroadcastDetail.id) !== String(selectedBroadcastId)) {
        const inMemory = broadcasts.find(b => String(b.id) === String(selectedBroadcastId));
        if (inMemory) {
          setSelectedBroadcastDetail(inMemory);
        } else {
          fetchSingleBroadcastDetail(selectedBroadcastId);
        }
      }
    }
  }, [activeView, selectedBroadcastId, broadcasts, selectedBroadcastDetail, fetchSingleBroadcastDetail]);

  // Broadcast popstate listener for back/forward browser navigation
  useEffect(() => {
    const handleBroadcastPopState = () => {
      if (typeof window === 'undefined' || window.__catavor_is_modal_popping) return;
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || params.get('view') || params.get('division');
      const normalized = normalizeTabletTab(tab);
      if (normalized === 'broadcast') {
        const sub = (params.get('subview') || params.get('subtab') || params.get('action') || '').toLowerCase();
        const bId = params.get('broadcast_id') || params.get('broadcast') || params.get('notif_id');
        if (['create', 'new', 'tambah', 'buat'].includes(sub)) {
          setBroadcastSubView('create');
          setSelectedBroadcastId(null);
          setSelectedBroadcastDetail(null);
        } else if (bId) {
          setSelectedBroadcastId(bId);
          setBroadcastSubView('list');
        } else {
          setSelectedBroadcastId(null);
          setSelectedBroadcastDetail(null);
          setBroadcastSubView('list');
        }
      }
    };
    window.addEventListener('popstate', handleBroadcastPopState);
    return () => window.removeEventListener('popstate', handleBroadcastPopState);
  }, [normalizeTabletTab]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      showToast('Judul dan isi pesan siaran wajib diisi', 'error');
      return;
    }
    if (broadcastForm.target_type === 'specific') {
      if (broadcastForm.recipients.length === 0) {
        showToast('Silakan tambahkan minimal 1 penerima (merchant/user)', 'error');
        return;
      }
    } else if (broadcastForm.target_type === 'single_store' && (!broadcastForm.target_id || broadcastForm.target_id === 0)) {
      showToast('Silakan pilih toko target terlebih dahulu', 'error');
      return;
    } else if (broadcastForm.target_type === 'single_user' && (!broadcastForm.target_id || broadcastForm.target_id === 0)) {
      showToast('Silakan pilih user target terlebih dahulu', 'error');
      return;
    }

    setIsSendingBroadcast(true);
    try {
      let finalTargetName = broadcastForm.target_name;
      if (broadcastForm.target_type === 'specific' && broadcastForm.recipients.length > 0) {
        const count = broadcastForm.recipients.length;
        const names = broadcastForm.recipients.slice(0, 2).map(r => r.name).join(', ');
        finalTargetName = `${count} Penerima Spesifik (${names}${count > 2 ? '...' : ''})`;
      } else if (broadcastForm.target_type === 'all') {
        finalTargetName = 'Semua Merchant & Pengguna (Global)';
      } else if (broadcastForm.target_type === 'plan') {
        finalTargetName = `Paket ${(broadcastForm.target_plan_code || 'PRO').toUpperCase()}`;
      }

      const isActionActive = broadcastForm.notification_action_enabled && broadcastForm.action_type !== 'none';
      const effectiveActionType = isActionActive ? broadcastForm.action_type : 'none';

      const payload = {
        title: broadcastForm.title,
        category: broadcastForm.category,
        target_type: broadcastForm.target_type,
        target_id: broadcastForm.target_id,
        target_plan_code: broadcastForm.target_plan_code,
        target_name: finalTargetName,
        target_recipients: JSON.stringify(broadcastForm.recipients),
        recipients: broadcastForm.recipients,
        type: broadcastForm.type,
        message: broadcastForm.message,
        notification_action_enabled: isActionActive,
        action_enabled: isActionActive,
        action_type: effectiveActionType,
        detail_content: isActionActive && effectiveActionType === 'detail' ? broadcastForm.detail_content : '',
        link_sub_tab: isActionActive && effectiveActionType === 'navigate' ? broadcastForm.link_sub_tab : '',
        link_mobile_settings_tab: isActionActive && effectiveActionType === 'navigate' && broadcastForm.link_sub_tab === 'settings' ? broadcastForm.link_mobile_settings_tab : '',
        action_url: isActionActive && effectiveActionType === 'external_link' ? broadcastForm.action_url : '',
        action_label: isActionActive ? (broadcastForm.action_label || (effectiveActionType === 'external_link' ? 'Buka Tautan Luar →' : effectiveActionType === 'navigate' ? 'Buka Menu Terkait →' : 'Buka Pengumuman Lengkap →')) : '',
        expires_in_hours: broadcastForm.expires_in_hours
      };

      const res = await authFetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Siaran pengumuman berhasil disebarkan!', 'success');
        setBroadcastForm({
          target_type: 'all',
          target_plan_code: 'pro',
          target_id: 0,
          target_name: '',
          recipients: [],
          title: '',
          category: 'PENGUMUMAN',
          message: '',
          notification_action_enabled: false,
          action_type: 'none',
          detail_content: '',
          type: 'info',
          link_sub_tab: 'settings',
          link_mobile_settings_tab: 'about',
          action_label: 'Buka Pengumuman Lengkap →',
          action_url: '',
          expires_in_hours: 0
        });
        setTargetRecipientSearch('');
        setRecipientSuggestions([]);
        recipientSearchCacheRef.current.clear();
        broadcastCacheRef.current.clear();
        setBroadcastSubView('list');
        setSelectedBroadcastId(null);
        setSelectedBroadcastDetail(null);
        updateBroadcastUrl('list', null);
        fetchBroadcasts(1, true);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || errData.message || 'Gagal menyebarkan siaran pengumuman', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (id: string | number) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan dan menghapus notifikasi siaran ini?')) return;
    try {
      const res = await authFetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Siaran pengumuman berhasil dihapus');
        broadcastCacheRef.current.clear();
        setSelectedBroadcastId(null);
        setSelectedBroadcastDetail(null);
        updateBroadcastUrl('list', null);
        fetchBroadcasts(broadcastPage, true);
      } else {
        showToast('Gagal menghapus siaran', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const getBroadcastCategoryStyle = (cat: string) => {
    switch (cat) {
      case 'SISTEM':
        return { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' };
      case 'PROMOSI':
        return { bg: 'rgba(236, 72, 153, 0.12)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.25)' };
      case 'PEMELIHARAAN':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' };
      case 'PANDUAN':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.25)' };
      case 'KEAMANAN':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' };
      case 'PENGUMUMAN':
      default:
        return { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' };
    }
  };

  const getBroadcastUrgencyBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', label: 'Peringatan' };
      case 'success':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', label: 'Sukses' };
      case 'system':
        return { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', label: 'Sistem' };
      case 'info':
      default:
        return { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', label: 'Informasi' };
    }
  };

  const getBroadcastTargetLabel = (b: any) => {
    if (!b) return '-';
    if (b.target_type === 'all' || !b.target_type) return 'Semua Merchant & Pengguna';
    if (b.target_type === 'plan') return `Paket ${b.target_plan_code?.toUpperCase() || 'PRO'}`;
    if (b.target_type === 'specific') {
      if (b.target_name) return b.target_name;
      try {
        const rec = typeof b.target_recipients === 'string' ? JSON.parse(b.target_recipients) : (b.recipients || []);
        if (Array.isArray(rec) && rec.length > 0) return `${rec.length} Sasaran Spesifik`;
      } catch {
        // ignore
      }
      return 'Sasaran Spesifik';
    }
    return String(b.target_type).toUpperCase();
  };

  const selectedBroadcastRecipients = useMemo(() => {
    if (!selectedBroadcast) return [];
    if (Array.isArray(selectedBroadcast.recipients) && selectedBroadcast.recipients.length > 0) {
      return selectedBroadcast.recipients;
    }
    if (selectedBroadcast.target_recipients) {
      try {
        const parsed = typeof selectedBroadcast.target_recipients === 'string'
          ? JSON.parse(selectedBroadcast.target_recipients)
          : selectedBroadcast.target_recipients;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return [];
  }, [selectedBroadcast]);

  // =========================================================================
  // SUB-VIEW: AUTOMATION & BOT SENTINEL (11 BOTS MATRIX)
  // =========================================================================
  const canAccessAutomation = hasPermission(currentUser, 'system:automation:manage') || hasPermission(currentUser, 'system:automation:view') || isSuperAdmin(currentUser);
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [automationLogsTotal, setAutomationLogsTotal] = useState<number>(0);
  const [automationLogsBotFilter, setAutomationLogsBotFilter] = useState<string>('all');
  const [automationLogsStatusFilter, setAutomationLogsStatusFilter] = useState<string>('all');
  const [automationLogsSearch, setAutomationLogsSearch] = useState<string>('');
  const [automationSubView, setAutomationSubView] = useState<'overview' | 'bots' | 'logs' | 'sandbox'>('overview');
  const [isTriggeringBot, setIsTriggeringBot] = useState<string | null>(null);
  const [isFetchingAutomation, setIsFetchingAutomation] = useState(false);
  const [isTestingSandbox, setIsTestingSandbox] = useState(false);

  const fetchAutomationData = useCallback(async (botFilter = automationLogsBotFilter, statusFilter = automationLogsStatusFilter, search = automationLogsSearch) => {
    if (!token || !canAccessAutomation) return;
    setIsFetchingAutomation(true);
    try {
      const params = new URLSearchParams();
      if (botFilter !== 'all') params.set('bot', botFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '50');

      const [statusRes, logsRes] = await Promise.allSettled([
        authFetch('/api/admin/automation/status', { headers: { Authorization: `Bearer ${token}` } }),
        authFetch(`/api/admin/automation/logs?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const j = await statusRes.value.json();
        setAutomationStatus(j.data || j);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        const lj = await logsRes.value.json();
        setAutomationLogs(Array.isArray(lj.data) ? lj.data : Array.isArray(lj) ? lj : []);
        setAutomationLogsTotal(typeof lj.total === 'number' ? lj.total : (Array.isArray(lj.data) ? lj.data.length : 0));
      }
    } catch (err) {
      console.error('Failed to fetch automation data:', err);
    } finally {
      setIsFetchingAutomation(false);
    }
  }, [token, canAccessAutomation, authFetch, automationLogsBotFilter, automationLogsStatusFilter, automationLogsSearch]);

  const fetchAutomation = fetchAutomationData;

  useEffect(() => {
    if (activeView === 'automation' && canAccessAutomation) {
      fetchAutomationData();
    }
  }, [activeView, canAccessAutomation, fetchAutomationData]);

  const handleTriggerBot = async (botType: string, label: string) => {
    if (!token || !canAccessAutomation) return;
    setIsTriggeringBot(botType);
    try {
      const res = await authFetch('/api/admin/automation/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bot_type: botType, action: botType })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Bot "${label}" berhasil dieksekusi!`, 'success');
        await fetchAutomationData();
      } else {
        showToast(data.error || data.message || `Gagal menjalankan bot "${label}"`, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan saat memicu bot', 'error');
    } finally {
      setIsTriggeringBot(null);
    }
  };

  const handleTriggerSpecificBot = handleTriggerBot;

  const handleRunSandboxTest = async () => {
    if (!token || !canAccessAutomation) return;
    setIsTestingSandbox(true);
    try {
      const res = await authFetch('/api/admin/automation/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'test_guide' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Notifikasi simulasi panduan berhasil dikirim via SSE!', 'success');
        await fetchAutomationData();
      } else {
        showToast(data.error || 'Gagal mengirim simulasi', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses sandbox', 'error');
    } finally {
      setIsTestingSandbox(false);
    }
  };

  const BOT_WORKERS_CATALOG = [
    {
      id: 'store_expiry',
      name: 'Bot Kedaluwarsa & Paket Merchant',
      category: 'Lifecycle',
      categoryColor: '#3b82f6',
      freq: 'Setiap 1 Jam',
      desc: 'Memeriksa masa aktif paket merchant (Free/Pro). Mengubah status merchant menjadi expired dan otomatis mengirimkan pengumuman peringatan perpanjangan.',
      icon: StoreIcon,
      color: '#3b82f6'
    },
    {
      id: 'dormancy_worker',
      name: 'Engine Lifecycle Dormansi Merchant',
      category: 'Lifecycle',
      categoryColor: '#8b5cf6',
      freq: 'Setiap 1 Jam',
      desc: 'Memindai akun free inaktif secara bertahap: Peringatan Hari ke-30, Pembekuan Hari ke-38, Pengarsipan Hari ke-45, dan Penghapusan Permanen Hari ke-60.',
      icon: Clock,
      color: '#8b5cf6'
    },
    {
      id: 'promo_expiry',
      name: 'Bot Kedaluwarsa Promo & Kupon',
      category: 'Commerce',
      categoryColor: '#10b981',
      freq: 'Setiap 15 Menit',
      desc: 'Memindai voucher diskon & banner promo katalog item merchant yang telah melewati masa berlaku untuk dinonaktifkan otomatis.',
      icon: Tag,
      color: '#10b981'
    },
    {
      id: 'flash_sale',
      name: 'Bot Sinkronisasi Flash Sale Realtime',
      category: 'Commerce',
      categoryColor: '#ef4444',
      freq: 'Setiap 5 Menit',
      desc: 'Mengaktifkan sesi flash sale terjadwal dan menutup sesi promo diskon yang telah habis waktunya secara otomatis.',
      icon: Zap,
      color: '#ef4444'
    },
    {
      id: 'support_lifecycle',
      name: 'Bot Helpdesk SLA & Auto-Resolve',
      category: 'Support',
      categoryColor: '#06b6d4',
      freq: 'Setiap 15 Menit',
      desc: 'Mengirimkan pengingat tiket membeku (72 jam), auto-resolve tiket tanpa respon merchant (48 jam), auto-close (7 hari), dan deteksi pelanggaran SLA.',
      icon: HelpCircle,
      color: '#06b6d4'
    },
    {
      id: 'ticket_retention_worker',
      name: 'Bot Retensi & Pemusnahan Data PDP Tiket',
      category: 'Compliance',
      categoryColor: '#ec4899',
      freq: 'Setiap 24 Jam (Retensi 30-60 Hari)',
      desc: 'Memusnahkan tiket closed (billing/akun 30h, teknis 60h) beserta berkas lampiran fisik dari penyimpanan server sesuai regulasi PDP.',
      icon: ShieldAlert,
      color: '#ec4899'
    },
    {
      id: 'item_retention_worker',
      name: 'Bot Retensi & Pembersihan Item Moderasi',
      category: 'Compliance',
      categoryColor: '#f43f5e',
      freq: 'Setiap 24 Jam (Retensi 30-90 Hari)',
      desc: 'Memproses pengingat H-7 barang moderasi, pengarsipan otomatis hari ke-30, dan pembersihan total dari sistem pada hari ke-90.',
      icon: FileText,
      color: '#f43f5e'
    },
    {
      id: 'cleaner_worker',
      name: 'Worker Pembersih Notifikasi & Log',
      category: 'System',
      categoryColor: '#64748b',
      freq: 'Setiap 1 Jam',
      desc: 'Menghapus notifikasi kedaluwarsa dan riwayat terbaca > 30 hari secara berkala guna menjaga performa dan kapasitas penyimpanan basis data.',
      icon: Trash2,
      color: '#64748b'
    },
    {
      id: 'weekly_summary',
      name: 'Bot Ringkasan Mingguan Platform',
      category: 'System',
      categoryColor: '#f59e0b',
      freq: 'Setiap Minggu 08:00 WIB',
      desc: 'Mengompilasi statistik transaksi mingguan, pendaftaran merchant baru, kepatuhan, dan mempublikasikan ringkasan otomatis ke dashboard pengelola.',
      icon: BarChart3,
      color: '#f59e0b'
    },
    {
      id: 'onboarding_engine',
      name: 'Bot Panduan Onboarding Merchant Baru',
      category: 'Lifecycle',
      categoryColor: '#10b981',
      freq: 'Event-Driven Realtime',
      desc: 'Secara instan menyuntikkan 3 artikel panduan starter kit katalog digital saat ada merchant baru yang menyelesaikan pendaftaran merchant.',
      icon: Award,
      color: '#10b981'
    },
    {
      id: 'sse_hub',
      name: 'SSE Realtime Streaming Gateway',
      category: 'Streaming',
      categoryColor: '#38bdf8',
      freq: 'Persistent Web Streaming',
      desc: 'Melayani transmisi siaran, status pergerakan tiket CS, dan pembaruan notifikasi langsung tanpa polling ke seluruh aplikasi pengguna aktif.',
      icon: Radio,
      color: '#38bdf8'
    }
  ];

  // =========================================================================
  // SUB-VIEW: MONETIZATION (AdSense & GA4)
  // =========================================================================
  const [monetizationSubTab, setMonetizationSubTab] = useState<'adsense' | 'analytics'>('adsense');
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
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copiedAdsTxt, setCopiedAdsTxt] = useState(false);

  const handleCopyAdsTxt = () => {
    if (!googleSettings.ads_txt_content) return;
    try {
      navigator.clipboard.writeText(googleSettings.ads_txt_content);
      setCopiedAdsTxt(true);
      setTimeout(() => setCopiedAdsTxt(false), 2000);
    } catch {
      showToast('Gagal menyalin konten ads.txt', 'error');
    }
  };

  const fetchSettings = useCallback(async () => {
    if (!canAccessMonetization && activeView === 'monetization') return;
    if (!canAccessMasterData && activeView === 'master-data') return;
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          const d = j.data;
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
    } catch {
      // Fail silently
    }
  }, [canAccessMonetization, canAccessMasterData, activeView]);

  useEffect(() => {
    if ((activeView === 'monetization' && canAccessMonetization) || (activeView === 'master-data' && canAccessMasterData)) {
      fetchSettings();
    }
  }, [activeView, canAccessMonetization, canAccessMasterData, fetchSettings]);

  const handleSaveGoogleSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !canAccessMonetization) return;
    setIsSavingSettings(true);
    try {
      let res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(googleSettings)
      });
      if (!res.ok) {
        res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(googleSettings)
        });
      }
      if (res.ok) {
        showToast('Pengaturan Google AdSense & Analytics berhasil disimpan!', 'success');
        fetchSettings();
      } else {
        showToast('Gagal menyimpan pengaturan Google', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // =========================================================================
  // SUB-VIEW: MASTER DATA (Rekber, Domains, CS Templates)
  // =========================================================================
  const [masterSubTab, setMasterSubTab] = useState<'rekber' | 'domains' | 'templates'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('sub');
      if (sub === 'domains' || sub === 'templates' || sub === 'rekber') return sub;
    }
    return 'rekber';
  });

  const handleSwitchMasterSubTab = (sub: 'rekber' | 'domains' | 'templates') => {
    setMasterSubTab(sub);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'master_data');
      url.searchParams.set('sub', sub);
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const handleMasterPopState = () => {
      if (typeof window === 'undefined' || window.__catavor_is_modal_popping) return;
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('sub');
      const tab = params.get('tab') || params.get('view');
      if (sub === 'domains' || sub === 'templates' || sub === 'rekber') {
        setMasterSubTab(sub);
      } else if (['domains', 'safe_domains', 'whitelist', 'domain'].includes(String(tab).toLowerCase())) {
        setMasterSubTab('domains');
      } else if (['templates', 'canned'].includes(String(tab).toLowerCase())) {
        setMasterSubTab('templates');
      }
    };
    window.addEventListener('popstate', handleMasterPopState);
    return () => window.removeEventListener('popstate', handleMasterPopState);
  }, []);

  // 1. REKBER SYARIAH ESCROW CONFIGURATION
  const [rekberActiveTemplateTab, setRekberActiveTemplateTab] = useState<'physical' | 'food' | 'digital' | 'service' | 'plant' | 'fauna'>('physical');
  const [isUploadingRekberLogo, setIsUploadingRekberLogo] = useState(false);
  const rekberLogoInputRef = useRef<HTMLInputElement | null>(null);

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
      const res = await authFetch('/api/storage/upload?category=rekber', {
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

  const handleResetRekberDefaults = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mereset seluruh konfigurasi Rekber Syariah ke standar resmi pabrik rekbersyariah.com?')) return;
    setIsSavingSettings(true);
    try {
      const res = await authFetch('/api/admin/settings/rekber/reset-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
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
        fetchSettings();
      } else {
        showToast('Gagal mereset konfigurasi Rekber', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat reset', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveRekberSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    try {
      const stripIcons = (s?: string) => (s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/^[ \t]+/gm, '');
      const payload = {
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
      };
      let res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        res = await authFetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        showToast('Konfigurasi Rekber Syariah berhasil disimpan!', 'success');
        fetchSettings();
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.message || 'Gagal menyimpan konfigurasi Rekber', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 2. CANNED RESPONSES / TEMPLATE CS
  const [cannedTemplates, setCannedTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [debouncedTemplateSearch, setDebouncedTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [templateCategoryCounts, setTemplateCategoryCounts] = useState<{ category: string; count: number }[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateLimit] = useState(10);
  const [templatePagination, setTemplatePagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1
  });
  const [showTemplateFormModal, setShowTemplateFormModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    shortcut: '',
    category: 'general',
    content: '',
    is_active: true,
    sort_order: 1
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [copiedTemplateId, setCopiedTemplateId] = useState<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTemplateSearch(templateSearchQuery);
      setTemplatePage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [templateSearchQuery]);

  const fetchCannedTemplates = useCallback(async (
    targetPage: number = templatePage,
    targetSearch: string = debouncedTemplateSearch,
    targetCategory: string = templateCategoryFilter,
    targetLimit: number = templateLimit,
    includeInactive: boolean = true
  ) => {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(targetLimit));
      if (includeInactive) params.set('include_inactive', 'true');
      if (targetCategory && targetCategory !== 'all') params.set('category', targetCategory);
      if (targetSearch && targetSearch.trim()) params.set('search', targetSearch.trim());

      const res = await authFetch(`/api/admin/support/templates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCannedTemplates(data.data || []);
        if (data.pagination) {
          setTemplatePagination(data.pagination);
        }
        if (Array.isArray(data.categories)) {
          setTemplateCategoryCounts(data.categories.filter((c: any) => c && c.category && c.count > 0));
        } else if (Array.isArray(data.data)) {
          const countMap: Record<string, number> = {};
          (data.data as any[]).forEach(t => {
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
  }, [token, authFetch, templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit]);

  // Standardized Category labels for CS Templates
  const templateCategoryLabels: Record<string, string> = useMemo(() => ({
    all: 'Semua Kategori',
    general: 'Umum & Greeting',
    billing: 'Keuangan',
    technical: 'Teknis',
    closing: 'Penutupan',
    account: 'Akun & Keamanan'
  }), []);

  // Dynamic Template Category Options: strictly contains only categories that have actual data (count > 0)
  const templateCategoryOptions = useMemo<TabletSelectOption[]>(() => {
    const totalCount = Number(templatePagination.total || cannedTemplates.length);
    const options: TabletSelectOption[] = [
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
    if (templateCategoryFilter !== 'all' && templateCategoryOptions.length > 1) {
      const exists = templateCategoryOptions.some(opt => opt.value === templateCategoryFilter);
      if (!exists) {
        setTemplateCategoryFilter('all');
      }
    }
  }, [templateCategoryOptions, templateCategoryFilter]);

  useEffect(() => {
    if (activeView === 'master-data' && masterSubTab === 'templates') {
      fetchCannedTemplates(templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, true);
    }
  }, [activeView, masterSubTab, templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, fetchCannedTemplates]);

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      title: '',
      shortcut: '',
      category: 'general',
      content: '',
      is_active: true,
      sort_order: cannedTemplates.length + 1
    });
    setShowTemplateFormModal(true);
  };

  const handleOpenEditTemplate = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      title: tmpl.title || '',
      shortcut: tmpl.shortcut || tmpl.shortcut_code || '',
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

      const res = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(templateForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(isEdit ? 'Template berhasil diperbarui!' : 'Template baru berhasil ditambahkan!', 'success');
        setShowTemplateFormModal(false);
        fetchCannedTemplates(templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, true);
      } else {
        showToast(data.message || 'Gagal menyimpan template', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat menyimpan template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (tmplId: number, tmplTitle: string) => {
    if (!window.confirm(`Hapus template "${tmplTitle}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await authFetch(`/api/admin/support/templates/${tmplId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template berhasil dihapus!', 'success');
        fetchCannedTemplates(templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, true);
      } else {
        showToast(data.message || 'Gagal menghapus template', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungi server', 'error');
    }
  };

  const handleToggleTemplateActive = async (tmpl: any) => {
    try {
      const nextActive = !tmpl.is_active;
      const res = await authFetch(`/api/admin/support/templates/${tmpl.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: nextActive })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Template "${tmpl.title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}!`, 'success');
        fetchCannedTemplates(templatePage, debouncedTemplateSearch, templateCategoryFilter, templateLimit, true);
      }
    } catch (e) {
      console.error('Failed to toggle template active status:', e);
    }
  };

  const handleResetDefaultTemplates = async () => {
    if (!window.confirm('Pulihkan template bawaan standar Catavor? Template kustom Anda akan direset ke daftar default.')) return;
    try {
      const res = await authFetch('/api/admin/support/templates/reset-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template bawaan berhasil dipulihkan!', 'success');
        fetchCannedTemplates(1, '', 'all', templateLimit, true);
      } else {
        showToast(data.message || 'Gagal memulihkan template', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghubungi server', 'error');
    }
  };

  const handleCopyTemplate = (tmpl: any) => {
    if (!tmpl?.content) return;
    try {
      navigator.clipboard.writeText(tmpl.content);
      setCopiedTemplateId(tmpl.id);
      showToast(`Teks template "${tmpl.title}" berhasil disalin!`);
      setTimeout(() => setCopiedTemplateId(null), 2500);
    } catch {
      showToast('Gagal menyalin teks template', 'error');
    }
  };

  useModalBackHandler({
    isOpen: showTemplateFormModal,
    onClose: () => setShowTemplateFormModal(false),
    modalId: 'cs_template_form'
  });

  // =========================================================================
  // SUB-VIEW: AUDIT TRAIL (Forensik Log)
  // =========================================================================
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<number | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [debouncedAuditSearch, setDebouncedAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('all');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditLimit, setAuditLimit] = useState<number>(15);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [copiedAuditPayload, setCopiedAuditPayload] = useState<boolean>(false);
  const [showAuditDetailModal, setShowAuditDetailModal] = useState<boolean>(false);
  const [quickJumpPageInput, setQuickJumpPageInput] = useState<string>('');

  useModalBackHandler({
    isOpen: showAuditDetailModal,
    onClose: () => setShowAuditDetailModal(false),
    modalId: 'tablet_audit_detail_modal'
  });

  // Debounce audit search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAuditSearch(auditSearch.trim());
      setAuditPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [auditSearch]);

  const fetchAuditLogs = useCallback(async (pageToFetch: number = auditPage) => {
    if (!token || !canAccessAudit) return;
    setIsLoadingAudit(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(auditLimit),
      });
      if (auditCategoryFilter !== 'all') params.set('category', auditCategoryFilter);
      if (auditRoleFilter !== 'all') params.set('role', auditRoleFilter);
      if (debouncedAuditSearch) params.set('q', debouncedAuditSearch);

      const res = await authFetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        const data = Array.isArray(j.data) ? j.data : [];
        setAuditLogs(data);
        setAuditTotal(typeof j.total === 'number' ? j.total : data.length);
        setAuditPage(pageToFetch);
        if (data.length > 0) {
          setSelectedAuditLogId(prevId => {
            const exists = data.some((item: any) => (item.id || item.created_at) === prevId);
            return exists ? prevId : (data[0].id || data[0].created_at);
          });
        } else {
          setSelectedAuditLogId(null);
        }
      }
    } catch {
      // Fail silently
    } finally {
      setIsLoadingAudit(false);
    }
  }, [token, authFetch, auditLimit, auditCategoryFilter, auditRoleFilter, debouncedAuditSearch, auditPage]);

  useEffect(() => {
    if (activeView === 'audit' && canAccessAudit) {
      fetchAuditLogs(auditPage);
    }
  }, [activeView, canAccessAudit, auditPage, auditCategoryFilter, auditRoleFilter, debouncedAuditSearch, fetchAuditLogs]);

  const selectedAuditLog = useMemo(() => {
    return auditLogs.find(l => (l.id || l.created_at) === selectedAuditLogId) || null;
  }, [auditLogs, selectedAuditLogId]);

  // Unified Platform & Active View Data Refresh Handler
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  const handleRefreshData = async () => {
    setIsRefreshingData(true);
    try {
      await loadPlatformStats();
      if (activeView === 'stores' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('catavor:refresh-stores'));
      } else if (activeView === 'reports') {
        await fetchReports();
      } else if (activeView === 'support') {
        await fetchTickets();
      } else if (activeView === 'finance') {
        await fetchOrders();
      } else if (activeView === 'broadcast') {
        broadcastCacheRef.current.clear();
        await fetchBroadcasts(broadcastPage, true);
      } else if (activeView === 'automation') {
        await fetchAutomation();
      } else if (activeView === 'audit') {
        await fetchAuditLogs();
      }
      showToast('Data berhasil diperbarui', 'success');
    } catch {
      showToast('Gagal menyegarkan data', 'error');
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Role info badge
  const roleInfo = getRoleBadge(currentUser?.platform_role || (currentUser?.is_superadmin ? 'superadmin' : 'admin'));

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)'
    }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          padding: '0.65rem 1.25rem',
          borderRadius: '999px',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Global Document & Evidence Preview Modal */}
      {previewDocUrl && (
        <DocumentPreviewModal
          data={{
            isOpen: true,
            url: previewDocUrl,
            fileName: previewDocTitle
          }}
          onClose={() => setPreviewDocUrl(null)}
          token={token}
        />
      )}

      {/* Finance Order Rejection Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              Tolak Pembayaran Order #{selectedOrderId}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
              Tuliskan alasan penolakan bukti transfer agar merchant dapat mengunggah bukti valid.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Contoh: Bukti transfer tidak jelas / nominal tidak sesuai / nama pengirim berbeda"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                outline: 'none',
                marginBottom: '1.25rem'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedOrderId) {
                    handleUpdateOrderStatus(selectedOrderId, 'rejected', rejectionReason);
                  }
                }}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Invoice Receipt Modal (Finance Tab Printable Voucher) */}
      {selectedReceiptOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '560px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light)',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {/* Printable Receipt Area */}
            <div id="catavor-invoice-receipt" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px dashed var(--border-light)', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>
                    CATAVOR PLATFORM &bull; TANDA TERIMA RESMI
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0.25rem 0 0 0' }}>
                    Bukti Pelunasan Langganan
                  </h2>
                </div>
                <div style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.75rem',
                  fontWeight: 900
                }}>
                  LUNAS / TERVERIFIKASI
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', fontSize: '0.82rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Nomor Invoice</div>
                  <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>#{selectedReceiptOrder.invoice_number || selectedReceiptOrder.id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Tanggal Pembayaran</div>
                  <div style={{ fontWeight: 700 }}>{new Date(selectedReceiptOrder.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Katalog Merchant Penerima</div>
                  <div style={{ fontWeight: 800 }}>{selectedReceiptOrder.store_name || `Store #${selectedReceiptOrder.store_id}`}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Paket Langganan</div>
                  <div style={{ fontWeight: 800, color: '#10b981' }}>{selectedReceiptOrder.plan_name || selectedReceiptOrder.plan?.toUpperCase()}</div>
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Biaya Langganan</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
                    Rp {(selectedReceiptOrder.amount || selectedReceiptOrder.price || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Metode: {selectedReceiptOrder.payment_method || 'Transfer Bank Manual'} &bull; Diverifikasi oleh Admin Pengelola
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedReceiptOrder(null)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Printer size={15} />
                <span>Cetak Tanda Terima</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CS Canned Template Macro Selector Modal */}
      {showCannedModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Template Respon Cepat CS</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pilih makro jawaban untuk disisipkan langsung ke balasan tiket
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCannedModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cannedTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Belum ada template balasan CS terdaftar
                </div>
              ) : (
                cannedTemplates.map(tmpl => (
                  <div
                    key={tmpl.id}
                    onClick={() => handleInsertCannedTemplate(tmpl.content)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {tmpl.title} {tmpl.shortcut_code && `(${tmpl.shortcut_code})`}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-card)' }}>
                        {tmpl.category?.toUpperCase() || 'UMUM'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {tmpl.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compliance Banned Confirmation Modal (Tablet Form-Factor Centered Panel) */}
      {showModerationConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingModeration) {
              setShowModerationConfirmModal(false);
              setBannedConfirmModalReport(null);
              setBannedConfirmAcknowledged(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              borderRadius: '1.25rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            {(() => {
              const activeRep = bannedConfirmModalReport || selectedReportDetail || reports.find(r => r.id === selectedReportId);
              const isItemConfirm = (activeRep?.target_type === 'item') || (moderationAction === 'item_banned');
              const itemName = activeRep?.item_name || activeRep?.target_title;
              const storeTitle = activeRep?.store_title || activeRep?.target_store_name || 'Toko Katalog';
              const storeSlug = activeRep?.store_slug || activeRep?.target_store_slug;

              return (
                <>
                  {/* Modal Header Bar */}
                  <div
                    style={{
                      padding: '1.15rem 1.35rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '0.75rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ef4444',
                          flexShrink: 0
                        }}
                      >
                        <ShieldAlert size={22} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                            {isItemConfirm ? 'Konfirmasi Banned Item' : 'Konfirmasi Banned Katalog'}
                          </h3>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '0.12rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#ef4444',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              textTransform: 'uppercase'
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                            Permanen
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {isItemConfirm
                            ? 'Penghapusan seketika & brankas forensik 90 hari (tanpa banding)'
                            : 'Tindakan sanksi fatal, tidak dapat dibatalkan kembali'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      overflowY: 'auto',
                      flex: 1
                    }}
                  >
                    {/* Target Metadata Card */}
                    <div
                      style={{
                        padding: '0.9rem 1rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {isItemConfirm ? 'Profil Item Terlapor' : 'Profil Katalog Terlapor'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '0.35rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            fontWeight: 800,
                            fontFamily: 'monospace'
                          }}
                        >
                          #{activeRep?.report_number || `RPT-${activeRep?.id || '-'}`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <div
                          style={{
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
                          }}
                        >
                          {isItemConfirm ? <Package size={17} /> : <StoreIcon size={17} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                            {isItemConfirm ? (itemName || (`Item ID: ${activeRep?.target_id || '-'}`)) : storeTitle}
                          </div>

                          {isItemConfirm ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              Dari Toko: <strong>{storeTitle}</strong> {storeSlug && <span style={{ fontFamily: 'monospace' }}>({storeSlug})</span>}
                            </div>
                          ) : storeSlug && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              catavor.com/{storeSlug}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Impact Warning List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Dampak langsung dari eksekusi sanksi banned ini:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {isItemConfirm ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <Trash2 size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Soft-Delete & Lenyap dari Inventaris Toko:</strong> Item langsung dinonaktifkan dan dihapus dari etalase publik serta dashboard merchant.</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Pemulihan Kuota & Storage Seketika:</strong> Kuota item toko langsung kembali tersedia dan kapasitas storage dibebaskan (0 byte terhitung).</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <Database size={14} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Vault Forensik Kepatuhan 90 Hari (UU ITE & PP 71/2019):</strong> Berkas bukti digital dan media fisik item diamankan selama 90 hari sebelum pemusnahan permanen.</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <Lock size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Keputusan Final Tanpa Banding:</strong> Pemilik toko menerima notifikasi penetapan sanksi fatal tanpa hak pengajuan banding.</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <Trash2 size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Purge Data Profil & Produk:</strong> Seluruh data produk, etalase, galeri foto, dan media fisik katalog akan dihapus/dibersihkan dari platform.</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              <Lock size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Penguncian Slug Permanen:</strong> Slug <code style={{ wordBreak: 'break-all' }}>{storeSlug}</code> didaftarkan ke tabel <em>blacklisted_slugs</em> dan tidak dapat didaftarkan ulang.</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
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
                        gap: '0.65rem',
                        padding: '0.75rem 0.95rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={bannedConfirmAcknowledged}
                        onChange={(e) => setBannedConfirmAcknowledged(e.target.checked)}
                        style={{ marginTop: '3px', accentColor: '#ef4444', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {isItemConfirm
                          ? 'Saya telah memeriksa bukti investigasi dan mengonfirmasi tindakan Banned Permanen pada item ini.'
                          : 'Saya telah memeriksa bukti investigasi dan mengonfirmasi tindakan Banned Permanen katalog ini.'}
                      </span>
                    </label>
                  </div>

                  {/* Modal Footer Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '1rem 1.25rem',
                      borderTop: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)'
                    }}
                  >
                    <button
                      type="button"
                      disabled={isSubmittingModeration}
                      onClick={() => {
                        setShowModerationConfirmModal(false);
                        setBannedConfirmModalReport(null);
                        setBannedConfirmAcknowledged(false);
                      }}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        padding: '0.65rem 1rem',
                        borderRadius: '0.65rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: isSubmittingModeration ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!bannedConfirmAcknowledged || isSubmittingModeration}
                      onClick={() => {
                        if (!bannedConfirmAcknowledged || isSubmittingModeration) return;
                        const reportId = activeRep?.id;
                        setShowModerationConfirmModal(false);
                        if (reportId) {
                          handleUpdateReportStatus(
                            reportId,
                            moderationStatus,
                            moderationAction,
                            actionReason,
                            true
                          );
                        }
                      }}
                      style={{
                        flex: 1.35,
                        minHeight: '44px',
                        padding: '0.65rem 1rem',
                        borderRadius: '0.65rem',
                        border: 'none',
                        backgroundColor: bannedConfirmAcknowledged ? '#ef4444' : 'var(--bg-muted, #64748b)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: (!bannedConfirmAcknowledged || isSubmittingModeration) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        boxShadow: bannedConfirmAcknowledged ? '0 4px 16px rgba(239, 68, 68, 0.35)' : 'none',
                        opacity: (!bannedConfirmAcknowledged || isSubmittingModeration) ? 0.6 : 1
                      }}
                    >
                      {isSubmittingModeration ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : (
                        <ShieldAlert size={15} />
                      )}
                      <span>{isItemConfirm ? 'Ya, Banned & Hapus Item' : 'Ya, Banned Katalog'}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 1. Tablet Rail Navigation */}
      <TabletRailNav
        activeView={activeView}
        onSwitchView={handleSwitchView}
        currentUser={currentUser}
        roleBadge={roleInfo.label}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        pendingReportsCount={pendingReportsCount}
        urgentTicketsCount={urgentTicketsCount}
        actionRequiredTicketsCount={actionRequiredTicketsCount}
      />

      {/* 2. Main Executive Tablet Workspace */}
      <main style={{
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        {/* Tablet Top Executive Header */}
        <header style={{
          height: '64px',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Tablet Executive Console &bull; {roleInfo.label}
            </div>
            <h1 style={{
              fontSize: '1.12rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {viewMetadata.title}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => handleSwitchView('stores')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: activeView === 'stores' ? 'var(--primary)' : 'var(--bg-deep)',
                color: activeView === 'stores' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Pusat Pengelolaan Katalog Toko Platform"
            >
              <StoreIcon size={14} />
              <span>Kelola Toko</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshData}
              disabled={isRefreshingData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                minHeight: '44px',
                minWidth: '44px',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: isRefreshingData ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: isRefreshingData ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Segarkan Data Portal"
            >
              <RefreshCw size={14} className={isRefreshingData ? 'animate-spin' : ''} />
              <span>{isRefreshingData ? 'Menyegarkan...' : 'Segarkan'}</span>
            </button>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: roleInfo.bg,
              color: roleInfo.color,
              border: `1px solid ${roleInfo.border}`,
              fontSize: '0.72rem',
              fontWeight: 800,
              whiteSpace: 'nowrap'
            }}>
              <span>{roleInfo.label}</span>
            </div>
          </div>
        </header>

        {/* 3. Dynamic Module View Body */}
        <div style={{ flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          {/* TAB 1: DASHBOARD (RINGKASAN EKSEKUTIF) */}
          {activeView === 'dashboard' && (
            <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Executive Action Center: Perlu Tindakan Administrator */}
                {(pendingReportsCount > 0 || urgentTicketsCount > 0 || pendingOrdersCount > 0) ? (
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '1.25rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                          Perlu Tindakan Administrator Segera
                        </h3>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Prioritas Pengawasan Platform
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                      {pendingReportsCount > 0 && (
                        <div style={{
                          padding: '1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <AlertOctagon size={20} color="#ef4444" />
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>
                                {pendingReportsCount} Laporan Kepatuhan Baru
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Dugaan komoditas terlarang / pelanggaran etalase
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSwitchView('reports')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: 'none',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Tinjau
                          </button>
                        </div>
                      )}

                      {urgentTicketsCount > 0 && (
                        <div style={{
                          padding: '1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <LifeBuoy size={20} color="#f59e0b" />
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>
                                {urgentTicketsCount} Tiket CS Prioritas Mendesak
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Kendala transaksi atau teknis merchant
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSwitchView('support')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: 'none',
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Buka
                          </button>
                        </div>
                      )}

                      {pendingOrdersCount > 0 && (
                        <div style={{
                          padding: '1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <CreditCard size={20} color="#10b981" />
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>
                                {pendingOrdersCount} Verifikasi Pembayaran Pro
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Bukti transfer menunggu konfirmasi staf
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSwitchView('finance')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: 'none',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Proses
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '1.25rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                      Status Operasional Prima: Seluruh laporan kepatuhan, tiket bantuan CS, dan aktivasi billing tertangani dengan baik.
                    </span>
                  </div>
                )}

                {/* 4 Primary KPI Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Card 1: Direktori Merchant */}
                  <div
                    onClick={() => handleSwitchView('stores')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Direktori Merchant</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StoreIcon size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {metrics.active_stores || metrics.total_stores || 1}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                      &bull; {metrics.dormant_stores || 0} Merchant Terindikasi Dormansi
                    </div>
                  </div>

                  {/* Card 2: Laporan Kepatuhan */}
                  <div
                    onClick={() => handleSwitchView('reports')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Laporan Kepatuhan</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertOctagon size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: pendingReportsCount > 0 ? '#ef4444' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {pendingReportsCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: pendingReportsCount > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                      {pendingReportsCount > 0 ? 'Perlu Investigasi Staf' : 'Semua laporan tertangani'}
                    </div>
                  </div>

                  {/* Card 3: Tiket Helpdesk CS */}
                  <div
                    onClick={() => handleSwitchView('support')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bantuan CS</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LifeBuoy size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: urgentTicketsCount > 0 ? '#f59e0b' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {actionRequiredTicketsCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: urgentTicketsCount > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                      {urgentTicketsCount > 0 ? `${urgentTicketsCount} Tiket Prioritas Mendesak` : 'Antrean bantuan normal'}
                    </div>
                  </div>

                  {/* Card 4: Billing Langganan */}
                  <div
                    onClick={() => handleSwitchView('finance')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Order Billing</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: pendingOrdersCount > 0 ? '#10b981' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {pendingOrdersCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: pendingOrdersCount > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                      {pendingOrdersCount > 0 ? 'Menunggu Konfirmasi Aktivasi' : 'Tidak ada antrean tertunda'}
                    </div>
                  </div>
                </div>

                {/* Telemetry Vitals Row */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: '1.25rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status Daemon 24/7</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Cpu size={14} />
                      <span>11 Bot Worker Aktif</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Realtime Streaming Hub</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Radio size={14} />
                      <span>SSE Gateway Siaga</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Merchant Berlangganan Pro</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {metrics.pro_stores} Merchant Aktif
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Omset Langganan</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                      Rp {metrics.total_revenue.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Quick Nav Module Launcher Grid */}
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '1.25rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                    Akses Cepat Modul Pengelola
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem'
                  }}>
                    {[
                      { key: 'stores', label: 'Direktori Merchant', desc: 'Audit & kepatuhan katalog', icon: StoreIcon, color: '#3b82f6', visible: canAccessCompliance },
                      { key: 'reports', label: 'Kepatuhan & Laporan', desc: 'Investigasi komoditas ilegal', icon: AlertOctagon, color: '#ef4444', visible: canAccessCompliance },
                      { key: 'support', label: 'Bantuan CS', desc: 'Respon tiket merchant', icon: LifeBuoy, color: '#06b6d4', visible: canAccessSupport },
                      { key: 'finance', label: 'Keuangan & Billing', desc: 'Verifikasi aktivasi paket Pro', icon: CreditCard, color: '#10b981', visible: canAccessFinance },
                      { key: 'staff', label: 'Staf & Role RBAC', desc: 'Penugasan hak akses tim', icon: ShieldCheck, color: '#8b5cf6', visible: canAccessRBAC },
                      { key: 'broadcast', label: 'Siaran Broadcast', desc: 'Kirim notifikasi masal', icon: Radio, color: '#ec4899', visible: canAccessBroadcast },
                      { key: 'automation', label: 'Mesin Otomatisasi', desc: 'Status bot & scheduler', icon: Cpu, color: '#f97316', visible: canAccessAutomation },
                      { key: 'monetization', label: 'Monetisasi & Iklan', desc: 'Google AdSense & GA4', icon: DollarSign, color: '#eab308', visible: canAccessMonetization },
                      { key: 'master-data', label: 'Master Data', desc: 'Whitelist domain aman, template CS, dan proteksi rekber', icon: Layers, color: '#10b981', visible: canAccessMasterData },
                      { key: 'audit', label: 'Audit Trail', desc: 'Log aktivitas forensik sistem', icon: History, color: '#64748b', visible: canAccessAudit }
                    ].filter(mod => (mod as any).visible !== false).map(mod => {
                      const Icon = mod.icon;
                      return (
                        <div
                          key={mod.key}
                          onClick={() => handleSwitchView(mod.key)}
                          style={{
                            padding: '1rem',
                            borderRadius: '0.85rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Icon size={16} color={mod.color} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{mod.label}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{mod.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORES */}
          {activeView === 'stores' && canAccessCompliance && (
            <TabletPlatformStoresView
              token={token}
              hideHeader={true}
              onLogout={onLogout}
            />
          )}

          {/* TAB 3: REPORTS (KEPATUHAN & LAPORAN) */}
          {activeView === 'reports' && canAccessCompliance && (
            <TabletMasterDetailView
              title="Kepatuhan & Laporan Masyarakat"
              subtitle={`${reportsPagination.total || reports.length} antrean laporan pelanggaran`}
              selectedId={selectedReportId}
              onClearSelection={() => {
                setSelectedReportId(null);
                setSelectedReportDetail(null);
              }}
              hideHeaderTitle={true}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-deep)' }}>
                  {/* Quick Metrics Bar (4 Columns) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.45rem',
                    padding: '0.65rem 0.75rem',
                    backgroundColor: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-light)'
                  }}>
                    <div style={{ padding: '0.45rem 0.55rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Menunggu</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>
                        {reportMetrics ? reportMetrics.pending : reports.filter(r => r.status === 'pending').length}
                      </span>
                    </div>
                    <div style={{ padding: '0.45rem 0.55rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Investigasi</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
                        {reportMetrics ? reportMetrics.investigating : reports.filter(r => r.status === 'investigating' || r.status === 'in_review').length}
                      </span>
                    </div>
                    <div style={{ padding: '0.45rem 0.55rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sanksi Aktif</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f43f5e' }}>
                        {reportMetrics ? (reportMetrics.action_taken - (reportMetrics.banned || 0) > 0 ? reportMetrics.action_taken - (reportMetrics.banned || 0) : reportMetrics.action_taken) : reports.filter(r => (r.status === 'action_taken' || (r.action_taken && r.action_taken !== 'none')) && r.status !== 'banned' && r.action_taken !== 'catalog_banned').length}
                      </span>
                    </div>
                    <div style={{ padding: '0.45rem 0.55rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', border: '1px solid rgba(239, 68, 68, 0.35)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Banned</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
                        {reportMetrics ? (reportMetrics.banned || 0) : reports.filter(r => r.status === 'banned' || r.action_taken === 'catalog_banned').length}
                      </span>
                    </div>
                  </div>

                  {/* Search and Filters Section */}
                  <div style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Search Input Box */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Cari tiket (#RPT-...), toko, item, email..."
                        value={reportsSearchQuery}
                        onChange={(e) => setReportsSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                          borderRadius: '0.65rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.76rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Standardized Dropdown Filters for Tablet Reports */}
                    <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '180px', flex: 1 }}>
                        <TabletCustomSelect
                          value={reportsFilter}
                          onChange={(val) => setReportsFilter(val as any)}
                          options={reportStatusOptions}
                          icon={<ShieldAlert size={14} />}
                          placeholder="Filter Status Laporan"
                          ariaLabel="Filter Status Laporan"
                          variant="compact"
                          menuWidth={240}
                        />
                      </div>

                      <div style={{ minWidth: '150px', flexShrink: 0 }}>
                        <TabletCustomSelect
                          value={reportsTargetFilter}
                          onChange={(val) => setReportsTargetFilter(val as any)}
                          options={reportTargetOptions}
                          icon={<Layers size={14} />}
                          placeholder="Filter Target"
                          ariaLabel="Filter Target Laporan"
                          variant="compact"
                          menuWidth={180}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Master List of Reports */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {reportsLoading ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Memuat antrean laporan...</div>
                      </div>
                    ) : reports.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <ShieldCheck size={36} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tidak Ada Laporan Ditemukan</div>
                        <div style={{ fontSize: '0.74rem', marginTop: '0.25rem' }}>
                          {reportsSearchQuery ? 'Tidak ada laporan yang sesuai dengan kata kunci pencarian.' : 'Seluruh toko dan item mematuhi aturan kepatuhan platform.'}
                        </div>
                      </div>
                    ) : (
                      reports.map(rep => {
                        const isSelected = selectedReportId === rep.id;
                        const isCatalog = rep.target_type === 'catalog' || rep.target_type === 'store';
                        const isItemBanned = rep.status === 'banned' || rep.action_taken === 'catalog_banned' || rep.action_taken === 'item_banned';

                        const statusBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                          pending: { label: 'Menunggu', bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
                          investigating: { label: 'Investigasi', bg: 'rgba(56, 189, 248, 0.12)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
                          in_review: { label: 'Investigasi', bg: 'rgba(56, 189, 248, 0.12)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
                          re_review: { label: 'Revisi Masuk', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)' },
                          action_taken: { label: 'Ditindak', bg: 'rgba(244, 63, 94, 0.12)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.3)' },
                          banned: { label: 'Banned', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.45)' },
                          dismissed: { label: 'Ditolak', bg: 'rgba(148, 163, 184, 0.12)', text: '#64748b', border: 'rgba(148, 163, 184, 0.25)' },
                          resolved: { label: 'Selesai', bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' }
                        };
                        const currentBadge = (rep.status === 'banned' || rep.action_taken === 'catalog_banned')
                          ? statusBadgeMap.banned
                          : (statusBadgeMap[rep.status] || statusBadgeMap.pending);

                        const hasAction = rep.action_taken && rep.action_taken !== 'none';
                        const actionLabel = rep.action_taken === 'item_banned'
                          ? 'Item Dibanned'
                          : rep.action_taken === 'item_needs_fix'
                          ? 'Perlu Perbaikan'
                          : (rep.action_taken === 'item_locked' || rep.action_taken === 'item_hidden')
                          ? 'Item Dikunci'
                          : rep.action_taken === 'catalog_suspended'
                          ? 'Katalog Dibekukan'
                          : rep.action_taken === 'catalog_banned'
                          ? 'Katalog Dibanned'
                          : rep.action_taken === 'warning_issued'
                          ? 'Diberi Peringatan'
                          : rep.action_taken === 'item_restored'
                          ? 'Item Dipulihkan'
                          : (rep.action_taken || '');

                        return (
                          <div
                            key={rep.id}
                            onClick={() => setSelectedReportId(rep.id)}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                              border: isSelected
                                ? '1.5px solid var(--primary)'
                                : isItemBanned
                                ? '1px solid rgba(239, 68, 68, 0.4)'
                                : rep.status === 're_review'
                                ? '1px solid rgba(16, 185, 129, 0.5)'
                                : rep.status === 'pending'
                                ? '1px solid rgba(245, 158, 11, 0.35)'
                                : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Card Meta Row: Ticket, Target pill, Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  color: 'var(--text-primary)',
                                  backgroundColor: 'var(--bg-deep)',
                                  padding: '0.12rem 0.4rem',
                                  borderRadius: '0.35rem',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  {rep.report_number || `#RPT-${rep.id}`}
                                </span>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 800,
                                  padding: '0.12rem 0.4rem',
                                  borderRadius: '0.35rem',
                                  backgroundColor: isCatalog ? 'rgba(168, 85, 247, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                                  color: isCatalog ? '#a855f7' : '#0284c7',
                                  border: `1px solid ${isCatalog ? 'rgba(168, 85, 247, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`
                                }}>
                                  {isCatalog ? 'PROFIL' : 'ITEM'}
                                </span>
                                {!isCatalog && (
                                  <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    padding: '0.12rem 0.4rem',
                                    borderRadius: '0.35rem',
                                    backgroundColor: 'var(--bg-deep)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-light)'
                                  }}>
                                    {formatCatalogType(rep.item_type || rep.fauna?.product_type)}
                                  </span>
                                )}
                              </div>

                              <span style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '999px',
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                backgroundColor: currentBadge.bg,
                                color: currentBadge.text,
                                border: `1px solid ${currentBadge.border}`
                              }}>
                                {currentBadge.label}
                              </span>
                            </div>

                            {/* Entity Title & Icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '0.45rem',
                                backgroundColor: 'var(--bg-deep)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isCatalog ? <StoreIcon size={14} color="var(--primary)" /> : <Package size={14} color="var(--primary)" />}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isCatalog
                                    ? (rep.store_title || rep.target_store_name || `Katalog /${rep.store_slug || rep.target_store_id}`)
                                    : (rep.item_name || rep.target_item_title || 'Item Produk')}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  /{rep.store_slug || rep.target_store_slug || '-'}
                                </div>
                              </div>
                            </div>

                            {/* Violation Reason & Action Pill */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '0.35rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                color: '#ef4444',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                <ShieldAlert size={11} color="#ef4444" />
                                <span>{rep.reason_label || rep.reason_category || 'Pelanggaran'}</span>
                              </span>

                              {hasAction && (
                                <span style={{
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '0.35rem',
                                  backgroundColor: rep.action_taken === 'catalog_banned' || rep.action_taken === 'item_banned' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(244, 63, 94, 0.12)',
                                  border: `1px solid ${rep.action_taken === 'catalog_banned' || rep.action_taken === 'item_banned' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(244, 63, 94, 0.25)'}`,
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  color: rep.action_taken === 'catalog_banned' || rep.action_taken === 'item_banned' ? '#ef4444' : '#f43f5e'
                                }}>
                                  {actionLabel}
                                </span>
                              )}
                            </div>

                            {/* Re-review indicator if active */}
                            {rep.status === 're_review' && (
                              <div style={{
                                padding: '0.3rem 0.45rem',
                                borderRadius: '0.45rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                fontSize: '0.66rem',
                                color: '#10b981',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}>
                                <RefreshCw size={11} color="#10b981" />
                                <span>Toko mengajukan revisi</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Tablet Segmented Pagination Controls */}
                  <TabletSegmentedPagination
                    currentPage={reportsPagination.page}
                    totalPages={reportsPagination.total_pages}
                    totalRecords={reportsPagination.total}
                    pageSize={reportsPagination.limit}
                    isLoading={reportsLoading}
                    onPageChange={(newPage) => {
                      fetchReports(newPage, reportsFilter, reportsTargetFilter, debouncedReportsSearch);
                    }}
                  />
                </div>
              }
              detailPane={
                !selectedReportId ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <ShieldCheck size={48} color="#10b981" style={{ marginBottom: '0.75rem', opacity: 0.8 }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                      Pilih Laporan untuk Moderasi
                    </h3>
                    <p style={{ fontSize: '0.78rem', maxWidth: '360px', margin: 0, lineHeight: 1.5 }}>
                      Pilih salah satu laporan pelanggaran dari daftar di sebelah kiri untuk memeriksa bukti forensik dan mengeksekusi sanksi penegakan kepatuhan.
                    </p>
                  </div>
                ) : selectedReportDetailLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={32} className="animate-spin" color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Memuat rincian laporan & rekam jejak...</div>
                  </div>
                ) : (() => {
                  const activeRep = selectedReportDetail || reports.find(r => r.id === selectedReportId);
                  if (!activeRep) return null;
                  const isCatalog = activeRep.target_type === 'catalog' || activeRep.target_type === 'store';

                  const itemOptions: TabletSelectOption[] = [
                    { value: 'none', label: 'Tanpa Sanksi Otomatis', description: 'Catat temuan investigasi & perbarui status tanpa sanksi otomatis', badge: 'CATATAN', badgeColor: '#64748b' },
                    { value: 'warning_issued', label: 'Terbitkan Peringatan Resmi', description: 'Kirim surat peringatan resmi kepatuhan ke pengelola', badge: 'PERINGATAN', badgeColor: '#f59e0b' },
                    { value: 'item_needs_fix', label: 'Nonaktifkan: Beri Kesempatan Edit & Perbaiki', description: 'Sembunyikan dari publik, izinkan pengelola mengedit data untuk diajukan ulang', badge: 'PERLU EDIT', badgeColor: '#f59e0b' },
                    { value: 'item_locked', label: 'Nonaktifkan & Kunci: Pelanggaran Kebijakan Keras', description: 'Sembunyikan & kunci edit (read-only) karena indikasi pelanggaran berat', badge: 'TERKUNCI', badgeColor: '#ef4444' },
                    { value: 'item_banned', label: 'Blokir atau Hapus Item (Banned Permanen)', description: 'Hapus permanen dari etalase & pulihkan kuota pengelola seketika', badge: 'BANNED ITEM', badgeColor: '#ef4444' },
                    { value: 'item_restored', label: 'Pulihkan / Aktifkan Item', description: 'Item dipulihkan dan dapat kembali diakses publik', badge: 'AKTIF', badgeColor: '#10b981' },
                    { value: 'catalog_suspended', label: 'Bekukan / Suspend Profil Katalog', description: 'Seluruh etalase profil katalog dibekukan sementara', badge: 'SUSPEND', badgeColor: '#dc2626' },
                    { value: 'catalog_banned', label: 'Blokir / Banned Permanen Profil Katalog', description: 'Tutup akses publik profil katalog dan akun pemilik permanen', badge: 'BANNED', badgeColor: '#b91c1c' },
                    { value: 'catalog_reactivated', label: 'Pulihkan / Aktifkan Profil Katalog', description: 'Cabut status penangguhan dan buka kembali etalase profil katalog', badge: 'PULIHKAN', badgeColor: '#10b981' }
                  ];

                  const catalogOptions: TabletSelectOption[] = [
                    { value: 'none', label: 'Tanpa Sanksi Otomatis', description: 'Catat temuan investigasi & perbarui status tanpa sanksi otomatis', badge: 'CATATAN', badgeColor: '#64748b' },
                    { value: 'warning_issued', label: 'Terbitkan Peringatan Resmi', description: 'Kirim surat peringatan resmi kepatuhan ke pengelola', badge: 'PERINGATAN', badgeColor: '#f59e0b' },
                    { value: 'catalog_suspended', label: 'Bekukan / Suspend Profil Katalog', description: 'Seluruh etalase profil katalog dibekukan sementara dari publik', badge: 'SUSPEND', badgeColor: '#dc2626' },
                    { value: 'catalog_banned', label: 'Blokir / Banned Permanen Profil Katalog', description: 'Tutup akses publik profil katalog dan akun pemilik permanen', badge: 'BANNED', badgeColor: '#b91c1c' },
                    { value: 'catalog_reactivated', label: 'Pulihkan / Aktifkan Profil Katalog', description: 'Cabut status penangguhan dan buka kembali etalase profil katalog', badge: 'PULIHKAN', badgeColor: '#10b981' }
                  ];

                  return (
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                      {/* Section 1: Entity Profile & Evidence Card */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        {/* Meta Row: Target pill + item type + ticket # + Public inspect button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '0.45rem',
                              backgroundColor: isCatalog ? 'rgba(168, 85, 247, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                              color: isCatalog ? '#a855f7' : '#0284c7',
                              border: `1px solid ${isCatalog ? 'rgba(168, 85, 247, 0.3)' : 'rgba(14, 165, 233, 0.3)'}`
                            }}>
                              {isCatalog ? 'PROFIL KATALOG' : 'ITEM KATALOG'}
                            </span>
                            {!isCatalog && (
                              <span style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.45rem',
                                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                color: '#0284c7',
                                border: '1px solid rgba(14, 165, 233, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                <Tag size={11} />
                                {formatCatalogType(activeRep.item_type || activeRep.fauna?.product_type || activeRep.product_type)}
                              </span>
                            )}
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--text-secondary)',
                              backgroundColor: 'var(--bg-deep)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.45rem',
                              border: '1px solid var(--border-light)'
                            }}>
                              {activeRep.report_number || `#RPT-${activeRep.id}`}
                            </span>
                          </div>

                          {activeRep.store_slug && (
                            <a
                              href={`/${activeRep.store_slug}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.55rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <ExternalLink size={13} />
                              <span>Inspeksi Publik</span>
                            </a>
                          )}
                        </div>

                        {/* Entity Title */}
                        <div>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                            Entitas Terlapor
                          </div>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.45rem',
                            lineHeight: 1.35
                          }}>
                            {isCatalog ? (
                              <>
                                <StoreIcon size={18} style={{ color: '#a855f7', flexShrink: 0, marginTop: '2px' }} />
                                <span>{activeRep.store_title || activeRep.target_store_name || `Katalog /${activeRep.store_slug || activeRep.target_store_id}`}</span>
                              </>
                            ) : (
                              <>
                                <Package size={18} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: '2px' }} />
                                <span>{activeRep.item_name || activeRep.target_item_title || 'Item Tanpa Nama'}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '0.65rem 1rem',
                          padding: '0.85rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}>
                          <div>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Profil Bisnis / Usaha</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                              {activeRep.store_title || activeRep.target_store_name || activeRep.store_slug || 'Katalog'}
                            </span>
                          </div>
                          {!isCatalog ? (
                            <div>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Jenis / Tipe Katalog</span>
                              <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                color: '#0284c7',
                                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                                padding: '0.12rem 0.5rem',
                                borderRadius: '0.4rem',
                                border: '1px solid rgba(14, 165, 233, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                <Tag size={11} />
                                {formatCatalogType(activeRep.item_type || activeRep.fauna?.product_type || activeRep.product_type)}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Jenis Entitas</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Profil Katalog Lengkap
                              </span>
                            </div>
                          )}
                          <div>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Kategori Pelanggaran</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f43f5e', wordBreak: 'break-word', lineHeight: 1.3 }}>
                              {activeRep.reason_label || activeRep.reason_category || 'Lainnya'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Status Peninjauan</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {activeRep.status || 'Pending'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Email Pelapor</span>
                            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                              {activeRep.reporter_email || '-'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Alamat IP Pelapor</span>
                            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {activeRep.reporter_ip || '-'}
                            </span>
                          </div>
                        </div>

                        {/* Evidence Quote */}
                        {(activeRep.description || activeRep.details) && (
                          <div style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(244, 63, 94, 0.06)',
                            border: '1px solid rgba(244, 63, 94, 0.2)'
                          }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f43f5e', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <AlertCircle size={13} />
                              <span>Kutipan Barang Bukti & Keluhan Pelapor:</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                              "{activeRep.description || activeRep.details}"
                            </p>
                          </div>
                        )}

                        {/* Evidence Attachment Image Preview */}
                        {activeRep.evidence_image_url && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Lampiran Berkas / Foto Barang Bukti:
                            </div>
                            <img
                              src={activeRep.evidence_image_url}
                              alt="Bukti Laporan"
                              onClick={() => {
                                setPreviewDocUrl(activeRep.evidence_image_url);
                                setPreviewDocTitle(`Bukti Laporan ${activeRep.report_number || `#RPT-${activeRep.id}`}`);
                              }}
                              style={{
                                width: '120px',
                                height: '120px',
                                objectFit: 'cover',
                                borderRadius: '0.65rem',
                                border: '1px solid var(--border-light)',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        )}

                        {/* Multi-Reporter Active Evidence Timeline */}
                        {reportActiveEvidence && reportActiveEvidence.length > 0 && (
                          <div style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.65rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <AlertTriangle size={14} />
                                <span>{reportActiveEvidence.length} Laporan Lain untuk Entitas Ini</span>
                              </div>
                              <span style={{ fontSize: '0.62rem', padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 800 }}>
                                KASUS JAMAK
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              Pengguna lain juga melaporkan entitas ini. Menindak kasus ini akan otomatis memperbarui seluruh laporan terkait.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              {reportActiveEvidence.map((ae: any, idx: number) => (
                                <div key={ae.id || idx} style={{
                                  padding: '0.6rem',
                                  borderRadius: '0.55rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {ae.report_number || `#RPT-${ae.id}`}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                      {ae.created_at ? new Date(ae.created_at).toLocaleString('id-ID') : '-'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f43f5e' }}>
                                    {ae.reason_label || ae.reason_category}
                                  </div>
                                  {ae.description && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.35 }}>
                                      "{ae.description}"
                                    </div>
                                  )}
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    Pelapor: {ae.reporter_email || ae.reporter_ip || 'Anonim'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Prior Review History Ledger */}
                        {reportPriorHistory && reportPriorHistory.length > 0 && (
                          <div style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(14, 165, 233, 0.06)',
                            border: '1px solid rgba(14, 165, 233, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem'
                          }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Clock size={14} />
                              <span>Rekam Jejak Peninjauan Terdahulu ({reportPriorHistory.length})</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                              Entitas ini pernah dilaporkan dan diselesaikan sebelumnya:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              {reportPriorHistory.map((ph: any, pidx: number) => (
                                <div key={ph.id || pidx} style={{
                                  padding: '0.55rem 0.65rem',
                                  borderRadius: '0.55rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)',
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {ph.report_number || `#RPT-${ph.id}`} • Status: <strong style={{ color: ph.status === 'dismissed' ? '#94a3b8' : (ph.status === 'action_taken' ? '#f43f5e' : '#10b981') }}>{ph.status}</strong>
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                      {ph.reviewed_at ? new Date(ph.reviewed_at).toLocaleDateString('id-ID') : '-'}
                                    </span>
                                  </div>
                                  {ph.action_taken && ph.action_taken !== 'none' && (
                                    <div style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: 700 }}>
                                      Sanksi Diterapkan: {ph.action_taken}
                                    </div>
                                  )}
                                  {ph.admin_notes && (
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
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
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={16} style={{ color: '#f59e0b' }} />
                            <span>Status Peninjauan Laporan</span>
                          </h4>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Tentukan status progres investigasi laporan kepatuhan ini.
                          </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
                          {[
                            { value: 'investigating', label: 'Investigasi Aktif', color: '#f59e0b', desc: 'Audit berjalan & verifikasi' },
                            { value: 'action_taken', label: 'Sanksi Ditindak', color: '#f43f5e', desc: 'Sanksi sementara/peringatan' },
                            { value: 'banned', label: 'Banned Permanen', color: '#ef4444', desc: 'Blokir permanen katalog/item' },
                            { value: 'resolved', label: 'Selesai & Pulih', color: '#10b981', desc: 'Kasus tuntas tanpa sanksi' },
                            { value: 'dismissed', label: 'Ditolak (Dismiss)', color: '#64748b', desc: 'Laporan tidak valid/palsu' }
                          ].map(opt => {
                            const isSelected = moderationStatus === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setModerationStatus(opt.value);
                                  if (opt.value === 'banned') {
                                    if (isCatalog) {
                                      setModerationAction('catalog_banned');
                                    } else {
                                      setModerationAction('item_banned');
                                    }
                                  } else if (opt.value === 'action_taken') {
                                    if (isCatalog && (moderationAction === 'none' || moderationAction === 'catalog_banned' || moderationAction === 'catalog_reactivated')) {
                                      setModerationAction('catalog_suspended');
                                    } else if (!isCatalog && (moderationAction === 'none' || moderationAction === 'item_banned' || moderationAction === 'item_restored')) {
                                      setModerationAction('item_locked');
                                    }
                                  } else if (opt.value === 'resolved') {
                                    if (isCatalog && (moderationAction === 'catalog_suspended' || moderationAction === 'catalog_banned')) {
                                      setModerationAction('catalog_reactivated');
                                    } else if (!isCatalog && (moderationAction === 'item_locked' || moderationAction === 'item_needs_fix' || moderationAction === 'item_banned')) {
                                      setModerationAction('item_restored');
                                    }
                                  } else if (opt.value === 'dismissed' || opt.value === 'investigating') {
                                    if (moderationAction === 'item_banned' || moderationAction === 'catalog_banned') {
                                      setModerationAction('none');
                                    }
                                  }
                                }}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--border-light)',
                                  backgroundColor: isSelected ? 'var(--bg-deep)' : 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? opt.color : 'var(--text-primary)' }}>
                                    {opt.label}
                                  </span>
                                  {isSelected && <CheckCircle2 size={14} style={{ color: opt.color }} />}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                  {opt.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section 3: Tindakan Penegakan Sistem (Real-time Enforcement) */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ShieldAlert size={16} style={{ color: '#f43f5e' }} />
                            <span>Tindakan Penegakan Sistem (Real-time Enforcement)</span>
                          </h4>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Sistem akan secara instan mengubah status database katalog/item dan mencatat audit trail.
                          </p>
                        </div>

                        <TabletCustomSelect
                          value={moderationAction}
                          onChange={(val) => {
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
                          }}
                          options={isCatalog ? catalogOptions : itemOptions}
                          ariaLabel="Pilih Tindakan Penegakan Sistem"
                          triggerStyle={{
                            minHeight: '44px',
                            backgroundColor: 'var(--bg-deep)'
                          }}
                        />

                        <div style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.06)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <Info size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Eksekusi sanksi bersifat seketika (*instant*). Pemilik toko akan melihat status item/katalog terbarui di portal mereka.
                          </span>
                        </div>
                      </div>

                      {/* Section 4: Catatan Kepatuhan & Audit (Admin Notes) */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FileText size={16} style={{ color: '#0ea5e9' }} />
                            <span>Catatan Kepatuhan & Audit (Admin Notes)</span>
                          </h4>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Dokumentasikan temuan investigasi, nomor tiket referensi, atau alasan keputusan untuk audit internal.
                          </p>
                        </div>

                        <textarea
                          rows={3}
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          placeholder="Tuliskan temuan audit, riwayat kontak penjual, alasan sanksi atau dasar penolakan laporan..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.65rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            boxSizing: 'border-box',
                            outline: 'none',
                            fontFamily: 'inherit',
                            lineHeight: 1.5,
                            resize: 'vertical'
                          }}
                        />

                        {activeRep.reviewed_by && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <User size={12} />
                            <span>Terakhir ditinjau oleh Admin ID: <strong>{activeRep.reviewed_by}</strong></span>
                            {activeRep.reviewed_at && (
                              <span>pada {new Date(activeRep.reviewed_at).toLocaleDateString('id-ID')}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Section 5: Action Execution Buttons */}
                      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', paddingBottom: '0.5rem' }}>
                        <button
                          type="button"
                          disabled={isSubmittingModeration}
                          onClick={() => {
                            if (moderationAction === 'item_banned' || moderationAction === 'catalog_banned' || moderationAction === 'account_banned' || moderationStatus === 'banned') {
                              setBannedConfirmModalReport(activeRep);
                              setBannedConfirmAcknowledged(false);
                              setShowModerationConfirmModal(true);
                            } else {
                              handleUpdateReportStatus(
                                activeRep.id,
                                moderationStatus,
                                moderationAction,
                                actionReason,
                                true
                              );
                            }
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0 1.35rem',
                            borderRadius: '0.65rem',
                            border: 'none',
                            backgroundColor: '#f43f5e',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            cursor: isSubmittingModeration ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            boxShadow: '0 3px 12px rgba(244, 63, 94, 0.3)',
                            opacity: isSubmittingModeration ? 0.7 : 1
                          }}
                        >
                          {isSubmittingModeration ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <ShieldCheck size={16} />
                          )}
                          <span>Terapkan Tindakan Moderasi</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyReportWarning(activeRep)}
                          style={{
                            minHeight: '44px',
                            padding: '0 1rem',
                            borderRadius: '0.65rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Copy size={14} />
                          <span>Salin Format Peringatan</span>
                        </button>

                        {activeRep.store_slug && (
                          <a
                            href={`/${activeRep.store_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              minHeight: '44px',
                              padding: '0 1rem',
                              borderRadius: '0.65rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <ExternalLink size={14} />
                            <span>Buka Halaman Publik</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()
              }
            />
          )}

          {/* TAB 4: SUPPORT (PUSAT BANTUAN CS) */}
          {activeView === 'support' && canAccessSupport && (
            <TabletMasterDetailView
              title="Tiket Helpdesk CS"
              subtitle={`${ticketsPagination.total_items || tickets.length} antrean tiket`}
              selectedId={selectedTicketId}
              onClearSelection={() => {
                setSelectedTicketId(null);
                setTicketDetail(null);
              }}
              hideHeaderTitle={true}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  {/* Master Pane Header: Search, Triage Tabs, and Secondary Filters */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    flexShrink: 0
                  }}>
                    {/* Search Box */}
                    <div style={{ position: 'relative' }}>
                      <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        value={supportSearch}
                        onChange={e => setSupportSearch(e.target.value)}
                        placeholder="Cari nomor tiket, subjek, merchant..."
                        style={{
                          width: '100%',
                          padding: '0.5rem 2rem 0.5rem 2.2rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                      {supportSearch && (
                        <button
                          type="button"
                          onClick={() => setSupportSearch('')}
                          style={{
                            position: 'absolute',
                            right: '0.6rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Unified Support Filter Toolbar (Tablet Native with count > 0 - Best Practice No Sideways Scroll) */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.45rem',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      {/* Status Tiket Dropdown (Dynamic count > 0) */}
                      <TabletCustomSelect
                        value={activeTabletTriageFilter}
                        onChange={handleTabletTriageFilterChange}
                        options={dynamicTicketStatusOptions}
                        variant="compact"
                        icon={<Filter size={13} />}
                        style={{ flex: '1 1 170px', minWidth: '145px' }}
                        triggerStyle={{
                          minHeight: '44px',
                          fontSize: '0.74rem',
                          padding: '0.25rem 0.65rem',
                          color: activeTabletTriageFilter !== 'all' ? 'var(--primary)' : undefined
                        }}
                        menuWidth={240}
                        ariaLabel="Filter Status Tiket"
                      />

                      {/* Category Dropdown (Dynamic count > 0) */}
                      <TabletCustomSelect
                        value={ticketCategoryFilter}
                        onChange={(val) => setTicketCategoryFilter(val)}
                        options={dynamicTicketCategoryOptions}
                        variant="compact"
                        icon={<Tag size={13} />}
                        style={{ flex: '1 1 170px', minWidth: '145px' }}
                        triggerStyle={{
                          minHeight: '44px',
                          fontSize: '0.74rem',
                          padding: '0.25rem 0.65rem',
                          color: ticketCategoryFilter !== 'all' ? 'var(--primary)' : undefined
                        }}
                        menuWidth={240}
                        ariaLabel="Filter Kategori Tiket"
                      />

                      {/* Priority Dropdown (Dynamic count > 0) */}
                      <TabletCustomSelect
                        value={ticketPriorityFilter}
                        onChange={(val) => setTicketPriorityFilter(val)}
                        options={dynamicTicketPriorityOptions}
                        variant="compact"
                        icon={<AlertCircle size={13} />}
                        style={{ flex: '1 1 150px', minWidth: '135px' }}
                        triggerStyle={{
                          minHeight: '44px',
                          fontSize: '0.74rem',
                          padding: '0.25rem 0.65rem',
                          color: ticketPriorityFilter === 'urgent' ? '#ef4444' : (ticketPriorityFilter !== 'all' ? 'var(--primary)' : undefined)
                        }}
                        menuWidth={220}
                        ariaLabel="Filter Prioritas Tiket"
                      />

                      {/* SLA Filter Toggle */}
                      <button
                        type="button"
                        onClick={() => setTicketSlaFilter(prev => prev === 'breached' ? 'all' : 'breached')}
                        style={{
                          minHeight: '44px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          backgroundColor: ticketSlaFilter === 'breached' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-deep)',
                          color: ticketSlaFilter === 'breached' ? '#ef4444' : 'var(--text-muted)',
                          border: `1px solid ${ticketSlaFilter === 'breached' ? '#ef4444' : 'var(--border-light)'}`,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                        title="Filter tiket dengan batas waktu respon SLA terlewat"
                      >
                        <Clock size={13} />
                        <span>SLA Lewat</span>
                        {(ticketsMetrics?.sla_breached ?? 0) > 0 && (
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '999px',
                            backgroundColor: ticketSlaFilter === 'breached' ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                            color: ticketSlaFilter === 'breached' ? '#ffffff' : '#ef4444',
                            fontWeight: 800
                          }}>
                            {ticketsMetrics?.sla_breached}
                          </span>
                        )}
                      </button>

                      {/* Time range for resolved */}
                      {supportFilter === 'resolved' && (
                        <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          {(['30d', '90d', 'all'] as const).map(tr => (
                            <button
                              key={tr}
                              type="button"
                              onClick={() => setResolvedTimeRangeFilter(tr)}
                              style={{
                                minHeight: '44px',
                                minWidth: '44px',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: resolvedTimeRangeFilter === tr ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-deep)',
                                color: resolvedTimeRangeFilter === tr ? '#10b981' : 'var(--text-muted)',
                                border: `1px solid ${resolvedTimeRangeFilter === tr ? '#10b981' : 'var(--border-light)'}`,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {tr === '30d' ? '30 Hari' : tr === '90d' ? '90 Hari' : 'Semua'}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Reset Filter Button */}
                      {(activeTabletTriageFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketSlaFilter !== 'all' || Boolean(supportSearch.trim())) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleTabletTriageFilterChange('all');
                            setTicketCategoryFilter('all');
                            setTicketPriorityFilter('all');
                            setTicketSlaFilter('all');
                            setSupportSearch('');
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                          title="Reset semua filter pencarian"
                        >
                          <X size={12} />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tickets Master List */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {ticketsLoading ? (
                      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: 'var(--primary)' }} />
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Memuat antrean tiket bantuan...</div>
                      </div>
                    ) : tickets.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                        <LifeBuoy size={40} color="var(--primary)" style={{ margin: '0 auto 0.65rem', display: 'block', opacity: 0.8 }} />
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tidak Ada Tiket</div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                          Tidak ada tiket bantuan yang cocok dengan kriteria filter saat ini.
                        </p>
                      </div>
                    ) : (
                      tickets.map(t => {
                        const isSelected = selectedTicketId === t.id;
                        const isUnread = t.status === 'open' || t.status === 'waiting_agent';
                        const statusMeta = getTicketStatusMeta(t.status);
                        const storeName = getStoreDisplayName(t);
                        const planBadge = getStorePlanBadge(t);
                        const msgs = Array.isArray(t.messages) ? t.messages : [];
                        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                        const messageCount = msgs.length || t.message_count || 1;
                        const lastSenderName = lastMsg ? (lastMsg.sender_type === 'user' ? (lastMsg.sender_name || 'Merchant') : (lastMsg.sender_name || 'Staf CS')) : '';

                        return (
                          <div
                            key={t.id}
                            onClick={() => fetchTicketDetail(t.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: `1.5px solid ${isSelected ? 'var(--primary)' : isUnread ? statusMeta.color : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 2px 10px rgba(59, 130, 246, 0.15)' : 'none'
                            }}
                          >
                            {/* Row 1: Ticket Number & Status Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                                {isUnread && (
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: statusMeta.color,
                                    boxShadow: `0 0 6px ${statusMeta.color}`,
                                    flexShrink: 0
                                  }} />
                                )}
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  color: t.priority === 'urgent' ? '#ef4444' : 'var(--primary)',
                                  fontFamily: 'monospace',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '0.3rem',
                                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  {t.ticket_number || `#TCK-${t.id}`}
                                </span>
                                {t.priority === 'urgent' && (
                                  <span style={{
                                    fontSize: '0.6rem',
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
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                backgroundColor: statusMeta.bg,
                                color: statusMeta.color,
                                border: `1px solid ${statusMeta.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusMeta.color }} />
                                {statusMeta.shortLabel || statusMeta.label}
                              </span>
                            </div>

                            {/* Row 2: Store Name & Subject */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                  {storeName}
                                </span>
                                {planBadge && planBadge !== 'FREE' && (
                                  <span style={{
                                    fontSize: '0.55rem',
                                    fontWeight: 800,
                                    padding: '0.06rem 0.35rem',
                                    borderRadius: '4px',
                                    backgroundColor: planBadge === 'ENTERPRISE' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: planBadge === 'ENTERPRISE' ? '#a855f7' : '#f59e0b',
                                    border: `1px solid ${planBadge === 'ENTERPRISE' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                  }}>
                                    {planBadge}
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: '0.84rem',
                                fontWeight: isUnread ? 800 : 700,
                                color: 'var(--text-primary)',
                                lineHeight: 1.35
                              }}>
                                {t.subject || 'Pertanyaan Layanan'}
                              </div>
                            </div>

                            {/* Row 3: Last Message Snippet if any */}
                            {lastMsg && (
                              <div style={{
                                padding: '0.4rem 0.55rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{lastSenderName}: </strong>
                                {lastMsg.message || 'Lampiran Berkas'}
                              </div>
                            )}

                            {/* Row 4: Footer Timestamp & Message Count */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem', borderTop: '1px solid var(--border-light)' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={11} />
                                {formatSupportDateTime(t.created_at)}
                              </span>
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '999px',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-light)'
                              }}>
                                {messageCount} pesan
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Pagination Control */}
                  <TabletSegmentedPagination
                    currentPage={ticketsPagination.page}
                    totalPages={ticketsPagination.total_pages}
                    totalRecords={ticketsPagination.total_items}
                    pageSize={ticketsPagination.limit}
                    isLoading={ticketsLoading}
                    onPageChange={(newPage) => {
                      fetchTickets(newPage);
                    }}
                  />
                </div>
              }
              detailPane={
                !ticketDetail ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <LifeBuoy size={48} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                      Pusat Bantuan CS Catavor
                    </h4>
                    <p style={{ fontSize: '0.85rem', maxWidth: '360px', lineHeight: 1.5, margin: 0 }}>
                      Pilih salah satu tiket dari antrean di samping untuk melihat riwayat percakapan lengkap, rincian pelapor, dan mengirim respon bantuan.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* Detail Header */}
                    <div style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      flexShrink: 0
                    }}>
                      {/* Agent Collision Warning Banner */}
                      {activePresences.filter(p => p.user_id !== currentUser?.id).length > 0 && (
                        <div style={{
                          padding: '0.6rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                          <span>
                            <strong>{activePresences.filter(p => p.user_id !== currentUser?.id).map(p => p.admin_name).join(', ')}</strong> juga sedang membuka tiket ini
                            {activePresences.filter(p => p.user_id !== currentUser?.id).some(p => p.is_typing) ? ' dan sedang mengetik...' : '.'}
                          </span>
                        </div>
                      )}

                      {/* Subject, Ticket Number & Time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.25)', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                              {ticketDetail.ticket_number || `#TCK-${ticketDetail.id}`}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                            {ticketDetail.subject || 'Pertanyaan Layanan'}
                          </h3>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: '0.2rem' }}>
                          {formatSupportDateTime(ticketDetail.created_at)}
                        </span>
                      </div>

                      {/* Identity & Status Chips Row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Store Identity Chip */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: 'var(--primary)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          <StoreIcon size={13} />
                          <span>{getStoreDisplayName(ticketDetail)}</span>
                          <span style={{
                            fontSize: '0.58rem',
                            padding: '0.08rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: getStorePlanBadge(ticketDetail) === 'ENTERPRISE' ? '#a855f7' : getStorePlanBadge(ticketDetail) === 'PRO' ? '#f59e0b' : 'rgba(100, 116, 139, 0.2)',
                            color: '#ffffff',
                            fontWeight: 800
                          }}>
                            {getStorePlanBadge(ticketDetail)}
                          </span>
                        </div>

                        {/* Requester Identity Chip */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.72rem',
                          fontWeight: 600
                        }}>
                          <User size={12} color="var(--text-muted)" />
                          <span style={{ fontWeight: 700 }}>{getUserRequesterName(ticketDetail)}</span>
                          {(ticketDetail.user?.email || ticketDetail.user_email) && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>
                              ({ticketDetail.user?.email || ticketDetail.user_email})
                            </span>
                          )}
                        </div>

                        {/* Category Chip */}
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-light)'
                        }}>
                          {
                            ticketDetail.category === 'billing' ? 'Keuangan & Langganan' :
                            ticketDetail.category === 'technical' ? 'Kendala Teknis & Bug' :
                            ticketDetail.category === 'catalog_help' ? 'Bantuan Katalog & Produk' :
                            ticketDetail.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'
                          }
                        </span>

                        {/* Status Selector Dropdown */}
                        <TabletCustomSelect
                          value={ticketDetail.status || 'open'}
                          onChange={(val) => handleUpdateTicketStatus(val)}
                          options={TICKET_STATUS_OPTIONS}
                          variant="compact"
                          triggerStyle={{
                            minHeight: '44px',
                            minWidth: '135px',
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.6rem'
                          }}
                          menuWidth={240}
                          ariaLabel="Perbarui Status Tiket"
                        />

                        {/* Priority Selector Dropdown */}
                        <TabletCustomSelect
                          value={ticketDetail.priority || 'medium'}
                          onChange={(val) => handleUpdateTicketPriority(ticketDetail.id, val)}
                          options={TICKET_PRIORITY_OPTIONS}
                          variant="compact"
                          triggerStyle={{
                            minHeight: '44px',
                            minWidth: '125px',
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.6rem',
                            color: ticketDetail.priority === 'urgent' ? '#ef4444' : undefined
                          }}
                          menuWidth={230}
                          ariaLabel="Perbarui Prioritas Tiket"
                        />
                      </div>

                      {/* Merchant Action Links Bar */}
                      {(ticketDetail.user_phone || ticketDetail.store_slug || ticketDetail.store?.slug) && (
                        <div style={{
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'center',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-light)'
                        }}>
                          {ticketDetail.user_phone && (
                            <a
                              href={`https://wa.me/${ticketDetail.user_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.75rem',
                                color: '#10b981',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <Phone size={14} />
                              <span>WhatsApp Merchant</span>
                            </a>
                          )}
                          {(ticketDetail.store_slug || ticketDetail.store?.slug) && (
                            <a
                              href={`/${ticketDetail.store_slug || ticketDetail.store?.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.75rem',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <ExternalLink size={14} />
                              <span>Katalog Merchant</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* CSAT Rating Card if Rated */}
                      {ticketDetail.rating && (
                        <div style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Star size={13} fill="#f59e0b" color="#f59e0b" /> Ulasan Kepuasan Merchant (CSAT)
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#f59e0b' }}>
                              {ticketDetail.rating} / 5 Bintang
                            </span>
                          </div>
                          {ticketDetail.rating_comment && (
                            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                              "{ticketDetail.rating_comment}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* SLA Status Card */}
                      {ticketDetail.sla_due_at && (
                        <div style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.65rem',
                          backgroundColor: ticketDetail.sla_breached ? 'rgba(239, 68, 68, 0.08)' : (ticketDetail.first_response_at ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)'),
                          border: `1px solid ${ticketDetail.sla_breached ? 'rgba(239, 68, 68, 0.25)' : (ticketDetail.first_response_at ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)')}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: ticketDetail.sla_breached ? '#ef4444' : (ticketDetail.first_response_at ? '#10b981' : 'var(--primary)')
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Clock size={13} /> Target Respon Pertama:
                          </span>
                          <span>
                            {ticketDetail.sla_breached ? 'Melewati SLA' : (ticketDetail.first_response_at ? 'Terpenuhi Tepat Waktu' : 'Sedang Berjalan')}
                          </span>
                        </div>
                      )}

                      {/* Two-Stage Lifecycle Grace Period & Locked Banners */}
                      {ticketDetail.status === 'resolved' && (
                        <div style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          fontSize: '0.74rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                            <CheckCircle2 size={14} color="#10b981" />
                            <span>Tiket Terselesaikan (Masa Sanggah 7 Hari)</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Tiket akan otomatis ditutup permanen (Read-Only) jika tidak ada balasan lebih lanjut dari merchant.
                          </p>
                          <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.15rem' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus('closed')}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '0.45rem',
                                backgroundColor: 'rgba(100, 116, 139, 0.15)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.7rem',
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
                              onClick={() => handleUpdateTicketStatus('in_progress')}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '0.45rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-muted)',
                                fontSize: '0.7rem',
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
                        </div>
                      )}

                      {ticketDetail.status === 'closed' && (
                        <div style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(100, 116, 139, 0.1)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-muted)',
                          fontSize: '0.74rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                            <Lock size={14} />
                            <span>Arsip Permanen (Read-Only)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateTicketStatus('in_progress')}
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.45rem',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: 'var(--primary)',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <RefreshCw size={12} />
                            <span>Buka Kembali</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Messages Thread Stream */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      {ticketDetailsLoading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: 'var(--primary)' }} />
                          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Memuat percakapan tiket...</div>
                        </div>
                      ) : (() => {
                        const allMessages: any[] = ticketDetail.messages || ticketDetail.replies || [];
                        if (allMessages.length === 0 && !ticketDetail.description && !ticketDetail.message) {
                          return (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              Belum ada riwayat pesan dalam tiket ini.
                            </div>
                          );
                        }

                        // Combine initial inquiry into list if not already in allMessages
                        const displayMessages: any[] = [...allMessages];
                        if (displayMessages.length === 0 && (ticketDetail.description || ticketDetail.message)) {
                          displayMessages.push({
                            id: 0,
                            sender_type: 'user',
                            sender: ticketDetail.user,
                            message: ticketDetail.description || ticketDetail.message,
                            created_at: ticketDetail.created_at,
                            attachments: ticketDetail.attachments || []
                          });
                        }

                        const firstUnreadIdx = displayMessages.findIndex((m: any) => m.sender_type === 'user' && !m.read_at);

                        return (
                          <>
                            {displayMessages.map((msg: any, idx: number) => {
                              const isStaff = msg.sender_type === 'agent' || msg.is_admin || msg.is_staff || msg.sender_role === 'staff' || (msg.user_id && msg.user_id !== ticketDetail.user_id);
                              const isInternal = msg.is_internal_note;
                              const isSystemBot = msg.sender_type === 'system';
                              const showUnreadDivider = firstUnreadIdx > 0 && idx === firstUnreadIdx;

                              return (
                                <React.Fragment key={msg.id || idx}>
                                  {showUnreadDivider && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                                      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--primary)', opacity: 0.3 }} />
                                      <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        color: 'var(--primary)',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        padding: '0.15rem 0.55rem',
                                        borderRadius: '999px',
                                        border: '1px solid rgba(59, 130, 246, 0.3)'
                                      }}>
                                        Pesan Baru Belum Terbaca
                                      </span>
                                      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--primary)', opacity: 0.3 }} />
                                    </div>
                                  )}

                                  {isSystemBot ? (
                                    <div style={{
                                      padding: '0.85rem 1rem',
                                      borderRadius: '0.85rem',
                                      backgroundColor: 'rgba(59, 130, 246, 0.06)',
                                      border: '1px solid rgba(59, 130, 246, 0.2)',
                                      maxWidth: '92%',
                                      alignSelf: 'center',
                                      width: '100%',
                                      boxSizing: 'border-box'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                          <Bot size={14} color="var(--primary)" />
                                          <strong style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 800 }}>
                                            Sistem Otomatis Catavor
                                          </strong>
                                        </div>
                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                          {formatSupportDateTime(msg.created_at)}
                                        </span>
                                      </div>
                                      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                        {msg.message || msg.content}
                                      </p>
                                    </div>
                                  ) : isInternal ? (
                                    <div style={{
                                      padding: '0.85rem 1rem',
                                      borderRadius: '0.85rem',
                                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                                      border: '1px dashed rgba(245, 158, 11, 0.45)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.3rem',
                                      maxWidth: '92%',
                                      alignSelf: 'center',
                                      width: '100%',
                                      boxSizing: 'border-box'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                          <Lock size={12} /> CATATAN INTERNAL CS (Hanya Terlihat Oleh Tim Admin)
                                        </span>
                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                          {formatSupportDateTime(msg.created_at)}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        Oleh: {msg.sender?.name || 'Staf Admin'}
                                      </div>
                                      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                        {msg.message || msg.content}
                                      </p>
                                    </div>
                                  ) : (
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: isStaff ? 'flex-end' : 'flex-start',
                                      maxWidth: '100%'
                                    }}>
                                      <div style={{
                                        maxWidth: '85%',
                                        minWidth: '220px',
                                        padding: '0.85rem 1.1rem',
                                        borderRadius: isStaff ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                                        backgroundColor: isStaff ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-deep)',
                                        border: `1px solid ${isStaff ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-light)'}`,
                                        color: 'var(--text-primary)',
                                        boxSizing: 'border-box'
                                      }}>
                                        {/* Bubble Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            {isStaff ? (
                                              <ShieldCheck size={13} color="var(--primary)" />
                                            ) : (
                                              <StoreIcon size={13} color="var(--text-muted)" />
                                            )}
                                            <strong style={{ fontSize: '0.74rem', color: isStaff ? 'var(--primary)' : 'var(--text-primary)', fontWeight: 800 }}>
                                              {isStaff ? (msg.sender?.name || 'Staf CS Catavor') : getStoreDisplayName(ticketDetail)}
                                            </strong>
                                          </div>
                                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                            {formatSupportDateTime(msg.created_at)}
                                          </span>
                                        </div>

                                        {/* Message text */}
                                        {msg.message || msg.content ? (
                                          <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {msg.message || msg.content}
                                          </p>
                                        ) : null}

                                        {/* Attachments */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                          <div style={{
                                            marginTop: (msg.message || msg.content) ? '0.6rem' : '0.2rem',
                                            paddingTop: (msg.message || msg.content) ? '0.5rem' : '0',
                                            borderTop: (msg.message || msg.content) ? '1px solid var(--border-light)' : 'none'
                                          }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                              <Paperclip size={11} color="var(--primary)" /> {msg.attachments.length} Lampiran Berkas:
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.45rem' }}>
                                              {msg.attachments.map((att: any, aIdx: number) => {
                                                const isPDF = att.file_type === 'application/pdf' || att.file_name?.toLowerCase().endsWith('.pdf') || att.file_url?.toLowerCase().endsWith('.pdf');
                                                if (isPDF) {
                                                  return (
                                                    <div
                                                      key={aIdx}
                                                      style={{
                                                        gridColumn: '1 / -1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.55rem 0.75rem',
                                                        borderRadius: '0.65rem',
                                                        backgroundColor: 'var(--bg-card)',
                                                        border: '1px solid var(--border-light)',
                                                        gap: '0.5rem'
                                                      }}
                                                    >
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                                        <div style={{
                                                          width: '32px',
                                                          height: '32px',
                                                          borderRadius: '0.45rem',
                                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                                          border: '1px solid rgba(239, 68, 68, 0.3)',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          justifyContent: 'center',
                                                          flexShrink: 0
                                                        }}>
                                                          <FileText size={16} color="#ef4444" />
                                                        </div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                          <div style={{ fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {att.file_name || 'Dokumen.pdf'}
                                                          </div>
                                                          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                                                            PDF {att.file_size ? `• ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                        <button
                                                          type="button"
                                                          onClick={() => setPreviewDocument({
                                                            isOpen: true,
                                                            fileName: att.file_name || 'Dokumen.pdf',
                                                            fileUrl: att.file_url,
                                                            fileSize: att.file_size,
                                                            fileType: att.file_type || 'application/pdf'
                                                          })}
                                                          style={{
                                                            padding: '0.3rem 0.55rem',
                                                            borderRadius: '0.4rem',
                                                            backgroundColor: 'var(--primary)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                          }}
                                                        >
                                                          <Eye size={12} /> Pratinjau
                                                        </button>
                                                        <a
                                                          href={att.file_url}
                                                          download={att.file_name || 'Dokumen.pdf'}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          style={{
                                                            padding: '0.3rem 0.55rem',
                                                            borderRadius: '0.4rem',
                                                            backgroundColor: 'var(--bg-deep)',
                                                            color: 'var(--text-primary)',
                                                            border: '1px solid var(--border-light)',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            textDecoration: 'none',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                          }}
                                                        >
                                                          <Download size={12} /> Unduh
                                                        </a>
                                                      </div>
                                                    </div>
                                                  );
                                                }
                                                return (
                                                  <div
                                                    key={aIdx}
                                                    onClick={() => setPreviewImageUrl(att.file_url)}
                                                    style={{
                                                      position: 'relative',
                                                      borderRadius: '0.45rem',
                                                      overflow: 'hidden',
                                                      border: '1px solid var(--border-light)',
                                                      aspectRatio: '1',
                                                      cursor: 'pointer',
                                                      backgroundColor: '#000000'
                                                    }}
                                                    title="Klik untuk perbesar gambar"
                                                  >
                                                    <img
                                                      src={att.file_url}
                                                      alt={att.file_name || 'Lampiran'}
                                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
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
                            })}
                            <div ref={messagesEndRef} />
                          </>
                        );
                      })()}
                    </div>

                    {/* Docked Reply Composer (Pane Footer) */}
                    <div style={{
                      padding: '0.85rem 1.25rem',
                      borderTop: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      flexShrink: 0
                    }}>
                      {ticketDetail.status === 'closed' ? (
                        <div style={{
                          padding: '0.75rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-muted)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          border: '1px solid var(--border-light)'
                        }}>
                          <Lock size={14} />
                          <span>Tiket telah ditutup permanen (Read-Only). Balasan dinonaktifkan.</span>
                        </div>
                      ) : (
                        <>
                          {/* Segmented Mode Control: Balas Merchant vs Catatan Internal */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.35rem',
                            backgroundColor: 'var(--bg-deep)',
                            borderRadius: '0.55rem',
                            padding: '3px',
                            border: '1px solid var(--border-light)'
                          }}>
                            <button
                              type="button"
                              onClick={() => setIsInternalNote(false)}
                              style={{
                                padding: '0.45rem 0.5rem',
                                borderRadius: '0.45rem',
                                fontSize: '0.74rem',
                                fontWeight: !isInternalNote ? 800 : 600,
                                backgroundColor: !isInternalNote ? 'var(--primary)' : 'transparent',
                                color: !isInternalNote ? '#ffffff' : 'var(--text-muted)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>Balas Merchant</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsInternalNote(true)}
                              style={{
                                padding: '0.45rem 0.5rem',
                                borderRadius: '0.45rem',
                                fontSize: '0.74rem',
                                fontWeight: isInternalNote ? 800 : 600,
                                backgroundColor: isInternalNote ? '#f59e0b' : 'transparent',
                                color: isInternalNote ? '#ffffff' : 'var(--text-muted)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
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
                                  border: '1px solid var(--border-light)',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'var(--bg-deep)'
                                }}>
                                  {(att.file_type === 'application/pdf' || att.file_name?.toLowerCase().endsWith('.pdf')) ? (
                                    <FileText size={20} color="#ef4444" />
                                  ) : (
                                    <img src={att.file_url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {ticketReplyAttachments.length} berkas terlampir
                              </span>
                            </div>
                          )}

                          {/* Input Area + Toolbar */}
                          {!canReplySupport ? (
                            <div style={{
                              padding: '0.85rem 1rem',
                              borderRadius: '0.55rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-muted)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              justifyContent: 'center',
                              width: '100%'
                            }}>
                              <Lock size={15} />
                              <span>Mode Hanya Baca: Akun Anda memiliki izin melihat riwayat (support:tickets:read), namun tidak memiliki wewenang membalas tiket (support:tickets:reply).</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', width: '100%' }}>
                              <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={e => handleUploadTicketAttachment(e.target.files)}
                                multiple
                                accept="image/*,.pdf"
                              />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingTicketAttachment}
                                title="Lampirkan File (Gambar/PDF)"
                                style={{
                                  height: '42px',
                                  padding: '0 0.75rem',
                                  borderRadius: '0.55rem',
                                  border: '1px solid var(--border-light)',
                                  backgroundColor: 'var(--bg-deep)',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700
                                }}
                              >
                                {isUploadingTicketAttachment ? (
                                  <RefreshCw size={15} className="animate-spin" color="var(--primary)" />
                                ) : (
                                  <Paperclip size={16} />
                                )}
                                <span>Lampiran</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowCannedModal(true)}
                                title="Gunakan Template CS"
                                style={{
                                  height: '42px',
                                  padding: '0 0.75rem',
                                  borderRadius: '0.55rem',
                                  border: '1px solid var(--border-light)',
                                  backgroundColor: 'var(--bg-deep)',
                                  color: '#f59e0b',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700
                                }}
                              >
                                <Zap size={14} color="#f59e0b" />
                                <span>Template</span>
                              </button>

                              <textarea
                                rows={2}
                                value={ticketReply}
                                onChange={e => setTicketReply(e.target.value)}
                                placeholder={isInternalNote ? 'Tuliskan catatan internal (hanya terlihat oleh tim admin)...' : 'Tuliskan respon bantuan ke merchant...'}
                                style={{
                                  flex: 1,
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '0.55rem',
                                  border: `1px solid ${isInternalNote ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-light)'}`,
                                  backgroundColor: isInternalNote ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-deep)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.82rem',
                                  outline: 'none',
                                  resize: 'none',
                                  lineHeight: 1.45
                                }}
                              />

                              <button
                                type="button"
                                onClick={() => handleSendTicketReply(isInternalNote)}
                                disabled={!ticketReply.trim() && ticketReplyAttachments.length === 0}
                                style={{
                                  height: '42px',
                                  padding: '0 1.25rem',
                                  borderRadius: '0.55rem',
                                  border: 'none',
                                  backgroundColor: isInternalNote ? '#f59e0b' : 'var(--primary)',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  cursor: (!ticketReply.trim() && ticketReplyAttachments.length === 0) ? 'not-allowed' : 'pointer',
                                  opacity: (!ticketReply.trim() && ticketReplyAttachments.length === 0) ? 0.6 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Send size={15} />
                                <span>{isInternalNote ? 'Simpan Catatan' : 'Kirim'}</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              }
            />
          )}

          {/* TAB 5: FINANCE (KEUANGAN & BILLING) */}
          {activeView === 'finance' && canAccessFinance && (
            <TabletMasterDetailView
              title="Billing Langganan Pro"
              subtitle={`${filteredOrders.length} order transaksi`}
              hideHeaderTitle={true}
              selectedId={selectedOrderId}
              onClearSelection={() => setSelectedOrderId(null)}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Status Filter */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      gap: '0.35rem',
                      overflowX: 'auto',
                      scrollbarWidth: 'thin',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {(['all', 'pending_verification', 'pending_payment', 'paid', 'rejected'] as const).map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setFinanceFilter(tab)}
                          style={{
                            minHeight: '44px',
                            minWidth: '44px',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '999px',
                            border: `1px solid ${financeFilter === tab ? '#10b981' : 'var(--border-light)'}`,
                            backgroundColor: financeFilter === tab ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                            color: financeFilter === tab ? '#10b981' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {tab === 'all' ? 'Semua' : tab === 'pending_verification' ? 'Verifikasi' : tab === 'pending_payment' ? 'Menunggu Bayar' : tab === 'paid' ? 'Lunas' : tab === 'rejected' ? 'Ditolak' : tab}
                        </button>
                      ))}
                    </div>
                    {/* Smooth Right Edge Fade Indicator */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: '1px',
                        width: '28px',
                        background: 'linear-gradient(to right, transparent, var(--bg-card))',
                        pointerEvents: 'none',
                        opacity: 0.95
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredOrders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <CreditCard size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada transaksi billing</div>
                      </div>
                    ) : (
                      filteredOrders.map(ord => {
                        const isSelected = selectedOrderId === ord.id;
                        return (
                          <div
                            key={ord.id}
                            onClick={() => setSelectedOrderId(ord.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? '#10b981' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                                {ord.plan_name || ord.plan?.toUpperCase() || 'PAKET PRO'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                #{ord.invoice_number || ord.id}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {ord.store_name || `Store #${ord.store_id}`}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                                Rp {(ord.amount || ord.price || 0).toLocaleString('id-ID')}
                              </span>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                backgroundColor: ord.status === 'paid' || ord.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                color: ord.status === 'paid' || ord.status === 'active' ? '#10b981' : '#f59e0b'
                              }}>
                                {ord.status?.toUpperCase() || 'PENDING'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              }
              detailPane={
                selectedOrder ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>
                          Invoice #{selectedOrder.invoice_number || selectedOrder.id}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptOrder(selectedOrder)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.45rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Receipt size={14} />
                            <span>Tanda Terima</span>
                          </button>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            backgroundColor: selectedOrder.status === 'active' || selectedOrder.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: selectedOrder.status === 'active' || selectedOrder.status === 'paid' ? '#10b981' : '#f59e0b'
                          }}>
                            {selectedOrder.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedOrder.store_name || `Store #${selectedOrder.store_id}`}
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.82rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Paket Langganan</div>
                          <div style={{ fontWeight: 800 }}>{selectedOrder.plan_name || selectedOrder.plan}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Nominal Pembayaran</div>
                          <div style={{ fontWeight: 800, color: '#10b981' }}>Rp {(selectedOrder.amount || selectedOrder.price || 0).toLocaleString('id-ID')}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Metode Bayar</div>
                          <div style={{ fontWeight: 700 }}>{selectedOrder.payment_method || 'Transfer Bank'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Tanggal Pesanan</div>
                          <div style={{ fontWeight: 700 }}>{new Date(selectedOrder.created_at).toLocaleString('id-ID')}</div>
                        </div>
                      </div>

                      {/* Transfer Proof Section */}
                      {selectedOrder.transfer_proof_url ? (
                        <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Bukti Transfer Bank:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <img
                              src={selectedOrder.transfer_proof_url}
                              alt="Bukti Transfer"
                              onClick={() => {
                                setPreviewDocUrl(selectedOrder.transfer_proof_url);
                                setPreviewDocTitle(`Bukti Transfer Invoice #${selectedOrder.invoice_number || selectedOrder.id}`);
                              }}
                              style={{
                                width: '100px',
                                height: '100px',
                                objectFit: 'cover',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border-light)',
                                cursor: 'pointer'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDocUrl(selectedOrder.transfer_proof_url);
                                setPreviewDocTitle(`Bukti Transfer Invoice #${selectedOrder.invoice_number || selectedOrder.id}`);
                              }}
                              style={{
                                padding: '0.5rem 0.85rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-primary)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Maximize2 size={14} />
                              <span>Lihat Bukti Penuh</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          &bull; Merchant belum mengunggah foto bukti transfer
                        </div>
                      )}

                      {/* Approval Actions */}
                      {selectedOrder.status !== 'paid' && selectedOrder.status !== 'active' && canManageFinance && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'active')}
                            style={{
                              flex: 1,
                              padding: '0.65rem 1rem',
                              borderRadius: '0.6rem',
                              border: 'none',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            Verifikasi & Aktifkan Paket Pro
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRejectModal(true)}
                            style={{
                              padding: '0.65rem 1rem',
                              borderRadius: '0.6rem',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            Tolak Pembayaran
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 6: STAFF & RBAC */}
          {(activeView === 'staff' || activeView === 'rbac') && canAccessRBAC && (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <AdminRBACManagement
                token={token}
                currentUserEmail={currentUser?.email}
                themeMode={themeMode}
              />
            </div>
          )}

          {/* TAB 7: BROADCAST (SIARAN PENGUMUMAN) */}
          {activeView === 'broadcast' && canAccessBroadcast && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Top Sub-Switcher & Header Bar */}
              <div style={{
                padding: '0.85rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-deep)',
                gap: '1rem',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastSubView('list');
                      setSelectedBroadcastId(null);
                      setSelectedBroadcastDetail(null);
                      updateBroadcastUrl('list', null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 1.1rem',
                      borderRadius: '0.65rem',
                      border: `1px solid ${broadcastSubView === 'list' ? '#f59e0b' : 'var(--border-light)'}`,
                      backgroundColor: broadcastSubView === 'list' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                      color: broadcastSubView === 'list' ? (isDark ? '#fbbf24' : '#d97706') : 'var(--text-muted)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Megaphone size={16} />
                    <span>Daftar & Riwayat Siaran</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastSubView('create');
                      setSelectedBroadcastId(null);
                      setSelectedBroadcastDetail(null);
                      updateBroadcastUrl('create', null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 1.1rem',
                      borderRadius: '0.65rem',
                      border: `1px solid ${broadcastSubView === 'create' ? '#f59e0b' : 'var(--border-light)'}`,
                      backgroundColor: broadcastSubView === 'create' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                      color: broadcastSubView === 'create' ? (isDark ? '#fbbf24' : '#d97706') : 'var(--text-muted)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Plus size={16} />
                    <span>Buat Siaran Baru</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {broadcastTotalItems ? `${broadcastTotalItems} Siaran Diterbitkan` : ''}
                  </span>
                </div>
              </div>

              {/* VIEW 1: LIST BROADCASTS (MASTER-DETAIL SPLIT VIEW) */}
              {broadcastSubView === 'list' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Top Bar: Quick Metrics & Search/Filter */}
                  <div style={{
                    padding: '0.85rem 1.5rem',
                    borderBottom: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    flexShrink: 0
                  }}>
                    {/* 3 Quick Metrics Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.6rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Megaphone size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Total Siaran
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1.2 }}>
                            {broadcastMetrics.total_broadcasts}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.6rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Siaran Aktif
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', lineHeight: 1.2 }}>
                            {broadcastMetrics.active_broadcasts}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.6rem',
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          color: '#6366f1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Target size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Target Sasaran
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', lineHeight: 1.2 }}>
                            {broadcastMetrics.targeted_broadcasts}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        flex: 1,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          value={broadcastSearchQuery}
                          onChange={e => setBroadcastSearchQuery(e.target.value)}
                          placeholder="Cari siaran berdasarkan judul, pesan, kategori, atau sasaran..."
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.85rem 0.55rem 2.4rem',
                            borderRadius: '0.65rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            boxSizing: 'border-box'
                          }}
                        />
                        {broadcastSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setBroadcastSearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: '0.65rem',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '0.2rem'
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Status Filter Segmented Buttons */}
                      <div style={{
                        display: 'flex',
                        borderRadius: '0.65rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-deep)',
                        padding: '0.2rem',
                        gap: '0.2rem',
                        flexShrink: 0
                      }}>
                        {[
                          { id: 'all', label: 'Semua Status' },
                          { id: 'active', label: 'Aktif Tayang' },
                          { id: 'expired', label: 'Kedaluwarsa' }
                        ].map(st => {
                          const isActive = broadcastStatusFilter === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setBroadcastStatusFilter(st.id as any);
                                setBroadcastPage(1);
                              }}
                              style={{
                                minHeight: '44px',
                                minWidth: '44px',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '0.5rem',
                                border: `1px solid ${isActive ? '#f59e0b' : 'transparent'}`,
                                backgroundColor: isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                color: isActive ? (isDark ? '#fbbf24' : '#d97706') : 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                fontWeight: isActive ? 800 : 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tablet Master-Detail View */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <TabletMasterDetailView
                      title="Riwayat Siaran"
                      subtitle={`${broadcastTotalItems || broadcasts.length} pengumuman terdaftar`}
                      hideHeaderTitle={true}
                      hideBackButton={true}
                      selectedId={selectedBroadcastId}
                      onClearSelection={handleClearBroadcastSelection}
                      emptyDetailMessage="Pilih salah satu siaran pengumuman dari daftar di samping untuk melihat rincian isi, sasaran, artikel lengkap, dan tindakan."
                      masterPane={
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                          <div style={{ flex: 1, padding: '0.85rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {isFetchingBroadcasts && broadcasts.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.65rem auto', color: '#f59e0b' }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Memuat daftar siaran...</div>
                              </div>
                            ) : broadcasts.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                                <Radio size={36} color="#f59e0b" style={{ margin: '0 auto 0.75rem auto', opacity: 0.8 }} />
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {broadcastSearchQuery ? 'Tidak ada siaran yang cocok' : 'Belum ada siaran disebarkan'}
                                </div>
                                <div style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                                  {broadcastSearchQuery ? 'Coba gunakan kata kunci pencarian yang berbeda.' : 'Tekan tombol "+ Buat Siaran Baru" di atas untuk menyebarkan pengumuman platform.'}
                                </div>
                              </div>
                            ) : (
                              broadcasts.map(bc => {
                                const isSelected = String(selectedBroadcastId) === String(bc.id);
                                const catStyle = getBroadcastCategoryStyle(bc.category);
                                const isExpired = bc.expires_at && new Date(bc.expires_at) <= new Date();
                                const isActive = bc.is_active !== false && !isExpired;

                                return (
                                  <div
                                    key={bc.id}
                                    onClick={() => handleSelectBroadcast(bc)}
                                    style={{
                                      padding: '0.85rem 1rem',
                                      borderRadius: '0.85rem',
                                      backgroundColor: isSelected ? (isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)') : 'var(--bg-card)',
                                      border: `1.5px solid ${isSelected ? '#f59e0b' : 'var(--border-light)'}`,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.45rem',
                                      boxShadow: isSelected ? (isDark ? '0 4px 14px rgba(245, 158, 11, 0.2)' : '0 4px 14px rgba(245, 158, 11, 0.12)') : 'none',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {/* Top Badges */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          padding: '0.15rem 0.5rem',
                                          borderRadius: '0.4rem',
                                          backgroundColor: catStyle.bg,
                                          color: catStyle.text,
                                          border: `1px solid ${catStyle.border}`
                                        }}>
                                          {bc.category || 'PENGUMUMAN'}
                                        </span>
                                        <span style={{
                                          fontSize: '0.66rem',
                                          fontWeight: 700,
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '0.4rem',
                                          backgroundColor: 'var(--bg-deep)',
                                          color: 'var(--text-muted)'
                                        }}>
                                          {getBroadcastTargetLabel(bc)}
                                        </span>
                                      </div>

                                      <span style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 800,
                                        padding: '0.12rem 0.45rem',
                                        borderRadius: '999px',
                                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                        color: isActive ? '#10b981' : '#94a3b8',
                                        border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.25)'}`,
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {isActive ? 'Tayang' : 'Kedaluwarsa'}
                                      </span>
                                    </div>

                                    {/* Title */}
                                    <div style={{
                                      fontSize: '0.88rem',
                                      fontWeight: 800,
                                      color: 'var(--text-primary)',
                                      lineHeight: 1.35,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}>
                                      {bc.title}
                                    </div>

                                    {/* Message Preview */}
                                    <div style={{
                                      fontSize: '0.76rem',
                                      color: 'var(--text-muted)',
                                      lineHeight: 1.45,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}>
                                      {bc.message}
                                    </div>

                                    {/* Footer: Date & Read Counter & Specific Rincian Action Badge */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      paddingTop: '0.35rem',
                                      borderTop: '1px solid var(--border-light)',
                                      fontSize: '0.7rem',
                                      color: 'var(--text-muted)'
                                    }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Clock size={12} />
                                        {bc.created_at ? new Date(bc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700, color: '#3b82f6' }}>
                                          <Eye size={12} />
                                          {bc.read_count || 0} Pembaca
                                        </span>
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          color: isDark ? '#38bdf8' : '#0284c7',
                                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                                          border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)'}`,
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '0.35rem'
                                        }}>
                                          <FileText size={11} />
                                          <span>Rincian</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Tablet Segmented Pagination */}
                          <TabletSegmentedPagination
                            currentPage={broadcastPage}
                            totalPages={broadcastTotalPages}
                            totalRecords={broadcastTotalItems}
                            pageSize={broadcastPageSize}
                            isLoading={isFetchingBroadcasts}
                            onPageChange={(newPage) => {
                              fetchBroadcasts(newPage);
                            }}
                          />
                        </div>
                      }
                      detailPane={
                        isFetchingBroadcastDetail && !selectedBroadcast ? (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4rem 1.5rem',
                            height: '100%',
                            gap: '0.85rem'
                          }}>
                            <RefreshCw size={28} className="animate-spin" color="#f59e0b" />
                            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              Memuat rincian siaran...
                            </span>
                          </div>
                        ) : selectedBroadcast ? (
                          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
                            {/* Top Navigation Row */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem'
                            }}>
                              <button
                                type="button"
                                onClick={handleClearBroadcastSelection}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.45rem 0.85rem',
                                  minHeight: '40px',
                                  borderRadius: '0.55rem',
                                  border: '1px solid var(--border-light)',
                                  backgroundColor: 'var(--bg-card)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                <ArrowLeft size={16} />
                                <span>Kembali</span>
                              </button>

                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                ID #{selectedBroadcast.id}
                              </span>
                            </div>

                            {/* Card Box Header */}
                            <div style={{
                              padding: '1.25rem',
                              borderRadius: '1rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.85rem'
                            }}>
                              {/* Top Bar inside Detail */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {(() => {
                                    const catStyle = getBroadcastCategoryStyle(selectedBroadcast.category);
                                    const urgStyle = getBroadcastUrgencyBadge(selectedBroadcast.type);
                                    const isExpired = selectedBroadcast.expires_at && new Date(selectedBroadcast.expires_at) <= new Date();
                                    const isActive = selectedBroadcast.is_active !== false && !isExpired;

                                    return (
                                      <>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          padding: '0.2rem 0.65rem',
                                          borderRadius: '0.45rem',
                                          backgroundColor: catStyle.bg,
                                          color: catStyle.text,
                                          border: `1px solid ${catStyle.border}`
                                        }}>
                                          {selectedBroadcast.category || 'PENGUMUMAN'}
                                        </span>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          padding: '0.2rem 0.65rem',
                                          borderRadius: '0.45rem',
                                          backgroundColor: urgStyle.bg,
                                          color: urgStyle.text
                                        }}>
                                          {urgStyle.label}
                                        </span>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          padding: '0.2rem 0.65rem',
                                          borderRadius: '0.45rem',
                                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                          color: '#6366f1',
                                          border: '1px solid rgba(99, 102, 241, 0.25)'
                                        }}>
                                          TARGET: {selectedBroadcast.target_type === 'all' || !selectedBroadcast.target_type 
                                            ? 'SEMUA MERCHANT (GLOBAL)' 
                                            : selectedBroadcast.target_type === 'plan' 
                                              ? `PAKET ${(selectedBroadcast.target_plan_code || 'PRO').toUpperCase()}` 
                                              : (selectedBroadcast.target_name || 'PENERIMA SPESIFIK')}
                                        </span>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          padding: '0.2rem 0.65rem',
                                          borderRadius: '999px',
                                          backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                          color: isActive ? '#10b981' : '#94a3b8',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.3rem'
                                        }}>
                                          <span style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: isActive ? '#10b981' : '#94a3b8'
                                          }} />
                                          {isActive ? 'Sedang Tayang' : 'Telah Kedaluwarsa'}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>

                                {/* Read Counter & Delete Button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                                    color: isDark ? '#38bdf8' : '#0284c7',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                  }}>
                                    <Eye size={13} />
                                    {selectedBroadcast.read_count || 0} Toko Telah Membaca
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBroadcast(selectedBroadcast.id)}
                                    title="Batalkan & Hapus Siaran Ini"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.35rem 0.85rem',
                                      borderRadius: '0.5rem',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                      color: '#ef4444',
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Hapus Siaran</span>
                                  </button>
                                </div>
                              </div>

                              {/* Broadcast Title */}
                              <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: 'var(--text-primary)',
                                margin: '0.25rem 0 0 0',
                                lineHeight: 1.35
                              }}>
                                {selectedBroadcast.title}
                              </h3>

                              {/* Metadata Grid */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '0.75rem',
                                padding: '0.85rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)'
                              }}>
                                <div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Waktu Terbit:
                                  </div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Calendar size={13} color="#f59e0b" />
                                    {selectedBroadcast.created_at ? new Date(selectedBroadcast.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                  </div>
                                </div>

                                <div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Masa Berlaku:
                                  </div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Clock size={13} color="#f59e0b" />
                                    {selectedBroadcast.expires_at ? new Date(selectedBroadcast.expires_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Permanen (Tanpa Batas)'}
                                  </div>
                                </div>

                                <div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Target Sasaran:
                                  </div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Target size={13} color="#f59e0b" />
                                    {getBroadcastTargetLabel(selectedBroadcast)}
                                  </div>
                                </div>

                                <div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Tipe Aksi Lanjutan:
                                  </div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Sparkles size={13} color="#f59e0b" />
                                    {selectedBroadcast.action_type === 'detail' ? 'Artikel Lengkap (Detail)' : selectedBroadcast.action_type === 'navigate' ? 'Navigasi Menu Internal' : selectedBroadcast.action_type === 'external_link' ? 'Tautan Eksternal' : 'Pesan Pemberitahuan'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Specific Recipients List Chips (If Any) */}
                            {selectedBroadcastRecipients.length > 0 && (
                              <div style={{
                                padding: '1rem 1.15rem',
                                borderRadius: '0.85rem',
                                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
                                border: isDark ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(245, 158, 11, 0.2)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                              }}>
                                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Users size={14} color="#f59e0b" />
                                  <span>Daftar Penerima Sasaran Khusus ({selectedBroadcastRecipients.length} Target):</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                  {selectedBroadcastRecipients.map((rec: any, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '0.5rem',
                                        backgroundColor: rec.type === 'store' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)',
                                        color: rec.type === 'store' ? '#3b82f6' : '#ec4899',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        border: `1px solid ${rec.type === 'store' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(236, 72, 153, 0.25)'}`
                                      }}
                                    >
                                      {rec.type === 'store' ? <StoreIcon size={12} /> : <User size={12} />}
                                      <span>{rec.name}</span>
                                      {rec.plan && <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>({rec.plan})</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Message Summary Callout */}
                            <div style={{
                              padding: '1.1rem 1.25rem',
                              borderRadius: '0.85rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem'
                            }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                Ringkasan Pesan Notifikasi:
                              </div>
                              <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {selectedBroadcast.message}
                              </div>
                            </div>

                            {/* Rich Article Detail Content (If Present) */}
                            {(selectedBroadcast.detail_content || selectedBroadcast.action_type === 'detail') && (
                              <div style={{
                                padding: '1.25rem',
                                borderRadius: '1rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem'
                              }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <FileText size={16} />
                                  <span>Isi Artikel & Panduan Rilis Lengkap:</span>
                                </div>
                                <div style={{
                                  fontSize: '0.86rem',
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.7,
                                  padding: '1.25rem',
                                  borderRadius: '0.85rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  <FormattedText text={selectedBroadcast.detail_content || selectedBroadcast.message} />
                                </div>
                              </div>
                            )}

                            {/* Informative Action Callout for Article Detail Action */}
                            {selectedBroadcast.action_type === 'detail' && (
                              <div style={{
                                padding: '0.95rem 1.15rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                              }}>
                                <FileText size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f59e0b' }}>
                                    Aksi Sentuh Notifikasi: Buka Rincian Artikel
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                    Saat notifikasi disentuh oleh merchant, aplikasi akan membuka rincian artikel lengkap seperti di atas.
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Internal Navigation Action Target (If Present) */}
                            {selectedBroadcast.action_type === 'navigate' && selectedBroadcast.link_sub_tab && (
                              <div style={{
                                padding: '1rem 1.25rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.45rem'
                              }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: isDark ? '#93c5fd' : '#2563eb', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                  Aksi Navigasi Internal Menu:
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.75rem 1rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: '#3b82f6',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '0.85rem',
                                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                                }}>
                                  <span>{selectedBroadcast.action_label || 'Buka Menu Terkait →'}</span>
                                  <span style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: 0.9 }}>
                                    <Compass size={14} />
                                    <span>{selectedBroadcast.link_sub_tab}</span>
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                  Menu Tujuan: <strong style={{ color: 'var(--text-primary)' }}>
                                    {selectedBroadcast.link_sub_tab === 'settings' ? 'Pengaturan Merchant (settings)' :
                                     selectedBroadcast.link_sub_tab === 'items' ? 'Inventaris & Produk (items)' :
                                     selectedBroadcast.link_sub_tab === 'subscription' ? 'Paket & Langganan Pro (subscription)' :
                                     selectedBroadcast.link_sub_tab === 'help' ? 'Pusat Bantuan & Tiket (help)' :
                                     selectedBroadcast.link_sub_tab === 'share' ? 'Bagikan Katalog & QR (share)' :
                                     selectedBroadcast.link_sub_tab === 'analytics' ? 'Dashboard Analitik (analytics)' :
                                     `Menu ${selectedBroadcast.link_sub_tab}`}
                                  </strong>
                                </div>
                              </div>
                            )}

                            {/* External URL Action & Security Whitelist Badge (If Present) */}
                            {selectedBroadcast.action_type === 'external_link' && selectedBroadcast.action_url && (
                              <div style={{
                                padding: '1rem 1.25rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                              }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                  Aksi Tautan Luar Resmi:
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.75rem 1rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '0.85rem'
                                }}>
                                  <span>{selectedBroadcast.action_label || 'Buka Tautan Luar →'}</span>
                                  <a
                                    href={selectedBroadcast.action_url.startsWith('http') ? selectedBroadcast.action_url : `https://${selectedBroadcast.action_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      color: '#ffffff',
                                      fontSize: '0.72rem',
                                      textDecoration: 'none',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '0.4rem',
                                      backgroundColor: 'rgba(0,0,0,0.15)'
                                    }}
                                  >
                                    <ExternalLink size={12} />
                                    <span>Buka Link</span>
                                  </a>
                                </div>

                                {/* Whitelist Security Badge */}
                                {(() => {
                                  const sec = checkUrlSecurity(selectedBroadcast.action_url);
                                  const domainName = cleanDomainString(selectedBroadcast.action_url);
                                  if (sec.isSafe) {
                                    return (
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.4rem 0.75rem',
                                        borderRadius: '0.55rem',
                                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        color: '#10b981',
                                        fontSize: '0.74rem',
                                        fontWeight: 700
                                      }}>
                                        <ShieldCheck size={14} />
                                        <span>Domain Resmi Terverifikasi: <strong>{sec.domain || domainName}</strong></span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.4rem',
                                      padding: '0.4rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      color: '#f59e0b',
                                      fontSize: '0.74rem',
                                      fontWeight: 700
                                    }}>
                                      <AlertTriangle size={14} />
                                      <span>Domain Eksternal: <strong>{domainName}</strong></span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ) : null
                      }
                    />
                  </div>
                </div>
              )}

              {/* VIEW 2: CREATE BROADCAST (RESPONSIVE TABLET NATIVE FORM) */}
              {broadcastSubView === 'create' && (() => {
                const cardTarget = (
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Target size={16} color="#f59e0b" />
                      <span>1. Target Sasaran Penerima</span>
                    </div>

                    <TabletCustomSelect
                      label="Tipe Target Penerima:"
                      value={broadcastForm.target_type}
                      onChange={(val) => setBroadcastForm(prev => ({ ...prev, target_type: val as any }))}
                      options={BROADCAST_TARGET_TYPE_OPTIONS}
                      icon={<Users size={16} />}
                    />

                    {/* Sub-Target: Plan Selector */}
                    {broadcastForm.target_type === 'plan' && (
                      <div style={{
                        padding: '0.85rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        boxSizing: 'border-box'
                      }}>
                        <TabletCustomSelect
                          label="Pilih Paket Langganan Merchant:"
                          value={broadcastForm.target_plan_code}
                          onChange={(val) => setBroadcastForm(prev => ({ ...prev, target_plan_code: val }))}
                          options={BROADCAST_PLAN_OPTIONS}
                        />
                      </div>
                    )}

                    {/* Sub-Target: Specific Autocomplete Search & Chips */}
                    {broadcastForm.target_type === 'specific' && (
                      <div style={{
                        padding: '0.85rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ position: 'relative' }}>
                          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Cari Toko atau Pengguna Tertentu:
                          </label>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                              type="text"
                              value={targetRecipientSearch}
                              onChange={e => setTargetRecipientSearch(e.target.value)}
                              placeholder="Ketik nama toko, slug, atau email pengguna..."
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                                borderRadius: '0.55rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                boxSizing: 'border-box'
                              }}
                            />
                            {isSearchingRecipients && (
                              <RefreshCw size={14} className="animate-spin" style={{ position: 'absolute', right: '0.75rem', color: '#f59e0b' }} />
                            )}
                          </div>

                          {/* Suggestions Dropdown */}
                          {recipientSuggestions.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: '0.35rem',
                              borderRadius: '0.65rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                              zIndex: 50,
                              maxHeight: '200px',
                              overflowY: 'auto'
                            }}>
                              {recipientSuggestions.map((s, sIdx) => {
                                const alreadySelected = broadcastForm.recipients.some(r => r.type === s.type && r.id === s.id);
                                return (
                                  <div
                                    key={sIdx}
                                    onClick={() => {
                                      if (alreadySelected) {
                                        showToast('Penerima sudah ada dalam daftar', 'error');
                                        return;
                                      }
                                      setBroadcastForm(prev => ({
                                        ...prev,
                                        recipients: [...prev.recipients, s]
                                      }));
                                      setTargetRecipientSearch('');
                                      setRecipientSuggestions([]);
                                      showToast(`${s.name} ditambahkan ke daftar`, 'success');
                                    }}
                                    style={{
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid var(--border-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: alreadySelected ? 'default' : 'pointer',
                                      backgroundColor: alreadySelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                      opacity: alreadySelected ? 0.6 : 1
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                                      {s.type === 'store' ? (
                                        <div style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '0.5rem',
                                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                          color: '#3b82f6',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}>
                                          <StoreIcon size={14} />
                                        </div>
                                      ) : (
                                        <div style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '0.5rem',
                                          backgroundColor: 'rgba(236, 72, 153, 0.12)',
                                          color: '#ec4899',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}>
                                          <User size={14} />
                                        </div>
                                      )}
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {s.name}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          {s.type === 'store' ? (s.slug ? `@${s.slug}` : `ID: #${s.id}`) : (s.email || `ID: #${s.id}`)}
                                          {s.email && s.type === 'store' ? ` • ${s.email}` : ''}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                      <span style={{
                                        fontSize: '0.62rem',
                                        padding: '0.12rem 0.45rem',
                                        borderRadius: '0.35rem',
                                        fontWeight: 800,
                                        backgroundColor: s.type === 'store' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                                        color: s.type === 'store' ? '#3b82f6' : '#ec4899'
                                      }}>
                                        {s.type === 'store' ? 'TOKO' : 'USER'}
                                      </span>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: alreadySelected ? '#10b981' : '#f59e0b' }}>
                                        {alreadySelected ? '✓ Ditambahkan' : '+ Tambah'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Selected Chips */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                              Penerima Terpilih ({broadcastForm.recipients.length}):
                            </span>
                            {broadcastForm.recipients.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setBroadcastForm(prev => ({ ...prev, recipients: [] }))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                Hapus Semua
                              </button>
                            )}
                          </div>
                          {broadcastForm.recipients.length === 0 ? (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Belum ada penerima khusus yang ditambahkan.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {broadcastForm.recipients.map((rec, rIdx) => (
                                <span
                                  key={rIdx}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: rec.type === 'store' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)',
                                    color: rec.type === 'store' ? '#3b82f6' : '#ec4899',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    border: `1px solid ${rec.type === 'store' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)'}`,
                                    maxWidth: '100%'
                                  }}
                                >
                                  {rec.type === 'store' ? <StoreIcon size={12} style={{ flexShrink: 0 }} /> : <User size={12} style={{ flexShrink: 0 }} />}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setBroadcastForm(prev => ({
                                      ...prev,
                                      recipients: prev.recipients.filter((_, idx) => idx !== rIdx)
                                    }))}
                                    style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );

                const cardClassification = (
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Tag size={16} color="#f59e0b" />
                      <span>2. Klasifikasi & Prioritas</span>
                    </div>

                    {/* 2-column select grid: Category & Urgency */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                      <TabletCustomSelect
                        label="Kategori Siaran:"
                        value={broadcastForm.category}
                        onChange={(val) => setBroadcastForm(prev => ({ ...prev, category: val as any }))}
                        options={BROADCAST_CATEGORY_OPTIONS}
                        icon={<Tag size={15} />}
                      />
                      <TabletCustomSelect
                        label="Tingkat Urgensi:"
                        value={broadcastForm.type}
                        onChange={(val) => setBroadcastForm(prev => ({ ...prev, type: val as any }))}
                        options={BROADCAST_URGENCY_OPTIONS}
                        icon={<AlertTriangle size={15} />}
                      />
                    </div>

                    {/* Expiration Duration Select */}
                    <TabletCustomSelect
                      label="Masa Berlaku Notifikasi:"
                      value={String(broadcastForm.expires_in_hours)}
                      onChange={(val) => setBroadcastForm(prev => ({ ...prev, expires_in_hours: parseInt(val, 10) || 0 }))}
                      options={BROADCAST_EXPIRY_OPTIONS}
                      icon={<Clock size={15} />}
                    />
                  </div>
                );

                const cardPreview = (
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px dashed var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Pratinjau Kartu Siaran Merchant:
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Sparkles size={12} />
                        Live Real-Time
                      </span>
                    </div>

                    {/* Preview Card Body */}
                    <div style={{
                      padding: '1rem 1.15rem',
                      borderRadius: '0.85rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {(() => {
                          const catStyle = getBroadcastCategoryStyle(broadcastForm.category);
                          return (
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.4rem',
                              backgroundColor: catStyle.bg,
                              color: catStyle.text,
                              border: `1px solid ${catStyle.border}`
                            }}>
                              {broadcastForm.category || 'PENGUMUMAN'}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Baru saja</span>
                      </div>

                      <div style={{
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        {broadcastForm.title || 'Judul Siaran Pengumuman Platform'}
                      </div>

                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        {broadcastForm.message || 'Ringkasan pesan siaran yang akan diterima oleh para pengelola toko merchant...'}
                      </div>

                      {/* Action CTA indicator inside preview */}
                      {broadcastForm.notification_action_enabled && broadcastForm.action_type !== 'none' && (
                        <div style={{
                          marginTop: '0.4rem',
                          paddingTop: '0.4rem',
                          borderTop: '1px solid var(--border-light)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          wordBreak: 'break-word'
                        }}>
                          {broadcastForm.action_type === 'detail' && <FileText size={13} style={{ flexShrink: 0 }} />}
                          {broadcastForm.action_type === 'navigate' && <Compass size={13} style={{ flexShrink: 0 }} />}
                          {broadcastForm.action_type === 'external_link' && <ExternalLink size={13} style={{ flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {broadcastForm.action_label || (broadcastForm.action_type === 'detail' ? 'Ketuk untuk membaca artikel lengkap →' : 'Ketuk untuk membuka menu/tautan →')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );

                const cardContent = (
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={16} color="#f59e0b" />
                      <span>3. Konten Pesan & Tindakan</span>
                    </div>

                    {/* Title Input */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Judul Pengumuman <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <span style={{ fontSize: '0.7rem', color: broadcastForm.title.length > 90 ? '#ef4444' : 'var(--text-muted)' }}>
                          {broadcastForm.title.length}/100
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={broadcastForm.title}
                        onChange={e => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Contoh: Pembaruan Sistem & Fitur Rekber Syariah v2.4"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Message Textarea */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Pesan Ringkas Notifikasi <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <span style={{ fontSize: '0.7rem', color: broadcastForm.message.length > 230 ? '#ef4444' : 'var(--text-muted)' }}>
                          {broadcastForm.message.length}/250
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        required
                        maxLength={250}
                        value={broadcastForm.message}
                        onChange={e => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Tuliskan ringkasan pengumuman singkat yang akan dibaca pertama kali oleh merchant..."
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                          lineHeight: 1.5,
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    {/* Action Type Selector */}
                    <div style={{
                      padding: '1rem',
                      borderRadius: '0.85rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Aksi Sentuh / Tindakan Lanjutan Notifikasi
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Pilih tindakan yang dijalankan saat merchant mengetuk notifikasi ini
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={broadcastForm.notification_action_enabled}
                          onChange={e => {
                            const checked = e.target.checked;
                            setBroadcastForm(prev => ({
                              ...prev,
                              notification_action_enabled: checked,
                              action_type: checked && prev.action_type === 'none' ? 'detail' : (!checked ? 'none' : prev.action_type)
                            }));
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </div>

                      {broadcastForm.notification_action_enabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)', boxSizing: 'border-box' }}>
                          <TabletCustomSelect
                            label="Pilih Jenis Aksi Sentuh:"
                            value={broadcastForm.action_type === 'none' ? 'detail' : broadcastForm.action_type}
                            onChange={(val) => setBroadcastForm(prev => ({ ...prev, action_type: val as any }))}
                            options={BROADCAST_ACTION_TYPE_OPTIONS}
                          />

                          {/* Option 1: Detail RichTextarea */}
                          {broadcastForm.action_type === 'detail' && (
                            <div style={{ width: '100%', boxSizing: 'border-box' }}>
                              <RichTextarea
                                label="Detail Artikel"
                                value={broadcastForm.detail_content}
                                onChange={val => setBroadcastForm(prev => ({ ...prev, detail_content: val }))}
                                placeholder="Tuliskan pedoman lengkap, instruksi teknis, atau catatan rilis fitur baru..."
                                minHeight="160px"
                                showPreviewTab={true}
                                showZenFullscreen={true}
                                theme={theme}
                                isDark={isDark}
                              />
                            </div>
                          )}

                          {/* Option 2: Internal Menu Navigation */}
                          {broadcastForm.action_type === 'navigate' && (
                            <div>
                              <TabletCustomSelect
                                label="Pilih Menu Internal Merchant:"
                                value={broadcastForm.link_sub_tab}
                                onChange={(val) => setBroadcastForm(prev => ({ ...prev, link_sub_tab: val }))}
                                options={BROADCAST_MENU_OPTIONS}
                                icon={<Compass size={15} />}
                              />
                            </div>
                          )}

                          {/* Option 3: External URL with live security whitelist check */}
                          {broadcastForm.action_type === 'external_link' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', boxSizing: 'border-box' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                  Label Tombol Aksi:
                                </label>
                                <input
                                  type="text"
                                  value={broadcastForm.action_label}
                                  onChange={e => setBroadcastForm(prev => ({ ...prev, action_label: e.target.value }))}
                                  placeholder="Contoh: Baca Panduan Selengkapnya →"
                                  style={{
                                    width: '100%',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: '0.55rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                  URL Website Eksternal:
                                </label>
                                <input
                                  type="url"
                                  value={broadcastForm.action_url}
                                  onChange={e => setBroadcastForm(prev => ({ ...prev, action_url: e.target.value }))}
                                  placeholder="https://catavor.com/promo/syariah"
                                  style={{
                                    width: '100%',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: '0.55rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              {/* Live Security Badge Preview */}
                              {broadcastForm.action_url.trim() && (() => {
                                const sec = checkUrlSecurity(broadcastForm.action_url);
                                const dom = cleanDomainString(broadcastForm.action_url);
                                if (sec.isSafe) {
                                  return (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.4rem 0.75rem',
                                      borderRadius: '0.5rem',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      fontSize: '0.74rem',
                                      fontWeight: 700
                                    }}>
                                      <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Domain Resmi Terverifikasi: <strong>{sec.domain || dom}</strong></span>
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                    color: '#f59e0b',
                                    fontSize: '0.74rem',
                                    fontWeight: 700
                                  }}>
                                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Domain Eksternal: <strong>{dom}</strong></span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const formActions = (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginTop: '0.25rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        setBroadcastSubView('list');
                        setSelectedBroadcastId(null);
                        setSelectedBroadcastDetail(null);
                        updateBroadcastUrl('list', null);
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingBroadcast || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                      style={{
                        padding: '0.75rem 1.85rem',
                        borderRadius: '0.75rem',
                        border: 'none',
                        backgroundColor: '#f59e0b',
                        color: '#000000',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: (isSendingBroadcast || !broadcastForm.title.trim() || !broadcastForm.message.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (isSendingBroadcast || !broadcastForm.title.trim() || !broadcastForm.message.trim()) ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSendingBroadcast ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Mempublikasikan...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Publikasikan Siaran</span>
                        </>
                      )}
                    </button>
                  </div>
                );

                return (
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: isNarrowScreen ? '1rem' : '1.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <form onSubmit={handleSendBroadcast} style={{
                      maxWidth: isNarrowScreen ? '720px' : '1100px',
                      width: '100%',
                      margin: '0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isNarrowScreen ? '1rem' : '1.25rem',
                      boxSizing: 'border-box'
                    }}>
                      {/* Header Banner */}
                      <div style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: '1rem',
                        background: isDark 
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)' 
                          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, #ffffff 100%)',
                        border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)'}`,
                        boxShadow: 'var(--card-shadow, 0 4px 16px rgba(0,0,0,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '0.85rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b',
                          flexShrink: 0
                        }}>
                          <Megaphone size={22} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            Publikasikan Siaran Platform
                          </h2>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Kirim pengumuman langsung ke banner &amp; bilah lonceng notifikasi pengguna
                          </p>
                        </div>
                      </div>

                      {/* Responsive Split: 1-Column on Tablet Mini (< 880px) vs Balanced 2-Column on Tablet Lebar (>= 880px) */}
                      {isNarrowScreen ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
                          {cardTarget}
                          {cardClassification}
                          {cardContent}
                          {cardPreview}
                          {formActions}
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.12fr)',
                          gap: '1.25rem',
                          alignItems: 'start',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          {/* LEFT COLUMN: Target, Klasifikasi, and LIVE PREVIEW (Balances left empty space!) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, boxSizing: 'border-box' }}>
                            {cardTarget}
                            {cardClassification}
                            {cardPreview}
                          </div>

                          {/* RIGHT COLUMN: Konten Pesan, Aksi Sentuh, & Form Submit Actions */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, boxSizing: 'border-box' }}>
                            {cardContent}
                            {formActions}
                          </div>
                        </div>
                      )}
                    </form>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 8: AUTOMATION (MESIN OTOMATISASI & 11 BOTS) */}
          {activeView === 'automation' && canAccessAutomation && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Module Header Sub-Tabs Switcher */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-deep)',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  {[
                    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
                    { id: 'bots', label: `${automationStatus?.total_workers || 11} Bot Platform`, icon: Bot, badge: String(automationStatus?.total_workers || 11) },
                    { id: 'logs', label: 'Riwayat & Audit', icon: Activity, badge: String(automationLogsTotal || automationLogs.length) },
                    { id: 'sandbox', label: 'Sandbox Uji Coba', icon: Zap }
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = automationSubView === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAutomationSubView(tab.id as any);
                          if (tab.id === 'logs' || tab.id === 'overview') {
                            fetchAutomation();
                          }
                        }}
                        style={{
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.55rem 1rem',
                          borderRadius: '0.65rem',
                          border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-light)'}`,
                          backgroundColor: isActive ? 'rgba(59, 130, 246, 0.14)' : 'var(--bg-card)',
                          color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '0.82rem',
                          fontWeight: isActive ? 800 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <Icon size={16} />
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: isActive ? 'var(--primary)' : 'rgba(100, 116, 139, 0.15)',
                            color: isActive ? '#ffffff' : 'var(--text-muted)'
                          }}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SUB-VIEW 1: OVERVIEW & SYSTEM HEALTH TELEMETRY */}
              {automationSubView === 'overview' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Hero Status Banner */}
                    <div style={{
                      padding: '1.4rem 1.6rem',
                      borderRadius: '1.15rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--card-shadow, 0 4px 12px rgba(0,0,0,0.05))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 12px #10b981',
                            display: 'inline-block'
                          }} />
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Status Mesin: {automationStatus?.total_workers || 11} Bot Worker Aktif &amp; Terjadwal (24/7 Daemon)
                          </h3>
                        </div>

                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          <CheckCircle2 size={13} />
                          <span>Daemon Berjalan Normal</span>
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Mesin otomatisasi platform mengelola siklus hidup merchant (inaktivitas &amp; kedaluwarsa), sinkronisasi promo/diskon katalog, eskalasi SLA tiket helpdesk, dan pembersihan sampah data otomatis di latar belakang.
                      </p>

                      {/* 4 Telemetry Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', paddingTop: '0.25rem' }}>
                        <div style={{ padding: '0.9rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', marginBottom: '0.25rem' }}>
                            <Bot size={15} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Total Bot Terdaftar</span>
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {automationStatus?.total_workers || 11} Bot
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                            <span>{automationStatus?.healthy_workers || 11} Sehat / Normal</span>
                          </div>
                        </div>

                        <div style={{ padding: '0.9rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', marginBottom: '0.25rem' }}>
                            <CheckCheck size={15} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Tingkat Sukses 24 Jam</span>
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981' }}>
                            {automationStatus?.success_rate_24h || '100.0%'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            0 kegagalan fatal
                          </div>
                        </div>

                        <div style={{ padding: '0.9rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', marginBottom: '0.25rem' }}>
                            <Activity size={15} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Eksekusi 24 Jam</span>
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {automationStatus?.executions_24h || automationLogs.length} Kali
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Pemicu Cron &amp; Manual
                          </div>
                        </div>

                        <div style={{ padding: '0.9rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', marginBottom: '0.25rem' }}>
                            <Clock size={15} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Uptime Daemon</span>
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            24 / 7
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                            <span>Realtime Loop Active</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Infrastructure Gateway & Streaming Status */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '1.15rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Radio size={16} color="#38bdf8" />
                        <span>Konektivitas Transmisi Real-Time &amp; Antrean</span>
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.9rem 1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            SSE Event Stream Gateway
                          </div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                            <span>{automationStatus?.sse_clients_count || 1} Klien Terhubung</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Siaran instan tanpa refresh (Server-Sent Events)
                          </div>
                        </div>

                        <div style={{
                          padding: '0.9rem 1rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Redis Cache / Message Bus
                          </div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: automationStatus?.redis_available ? '#10b981' : '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: automationStatus?.redis_available ? '#10b981' : '#38bdf8', display: 'inline-block' }} />
                            <span>{automationStatus?.redis_available ? 'Redis Standby' : 'Memori In-App'}</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {automationStatus?.redis_available ? 'Cluster Cache Aktif' : 'Penyimpanan Cepat Aktif'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '1.15rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Zap size={16} color="#f59e0b" />
                        <span>Aksi Cepat &amp; Pintasan Operasional</span>
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                        <button
                          type="button"
                          onClick={() => handleTriggerSpecificBot('ticket_retention_worker', 'Pemusnahan Data PDP Tiket')}
                          disabled={isTriggeringBot !== null}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(236, 72, 153, 0.1)',
                            border: '1px solid rgba(236, 72, 153, 0.25)',
                            color: '#ec4899',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            justifyContent: 'center'
                          }}
                        >
                          <ShieldAlert size={15} />
                          <span>Pemusnahan PDP Tiket</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTriggerSpecificBot('store_expiry', 'Kedaluwarsa Toko')}
                          disabled={isTriggeringBot !== null}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#0284c7',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            justifyContent: 'center'
                          }}
                        >
                          <StoreIcon size={15} />
                          <span>Pindai Toko &amp; Paket</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTriggerSpecificBot('promo_expiry', 'Promo Merchant')}
                          disabled={isTriggeringBot !== null}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#10b981',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            justifyContent: 'center'
                          }}
                        >
                          <Tag size={15} />
                          <span>Pindai Kupon Promo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTriggerSpecificBot('cleaner_worker', 'Pembersih Notifikasi')}
                          disabled={isTriggeringBot !== null}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            color: '#f43f5e',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                          <span>Bersihkan Notif Lama</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAutomationSubView('sandbox')}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(234, 179, 8, 0.1)',
                            border: '1px solid rgba(234, 179, 8, 0.25)',
                            color: '#d97706',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            justifyContent: 'center'
                          }}
                        >
                          <Zap size={15} />
                          <span>Buka Sandbox Uji Coba</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: 11 BOTS CATALOG & INTERACTIVE CONTROLS */}
              {automationSubView === 'bots' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Bot size={18} color="#38bdf8" />
                        <span>Katalog {automationStatus?.total_workers || 11} Bot Platform (Interactive Control Matrix)</span>
                      </h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Klik "Jalankan Sekarang" untuk pemicu paksa manual
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      {BOT_WORKERS_CATALOG.map(bot => {
                        const Icon = bot.icon;
                        const isRunning = isTriggeringBot === bot.id;
                        const runtimeWorker = automationStatus?.workers?.find((w: any) => w.name === bot.id);
                        const isExecuting = runtimeWorker?.is_executing || isRunning;

                        return (
                          <div
                            key={bot.id}
                            style={{
                              padding: '1.15rem 1.25rem',
                              borderRadius: '1rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              boxShadow: 'var(--card-shadow, 0 2px 8px rgba(0,0,0,0.04))'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '0.75rem',
                                    backgroundColor: `${bot.categoryColor}15`,
                                    color: bot.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <Icon size={20} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span>{bot.name}</span>
                                      <span style={{
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: '0.35rem',
                                        backgroundColor: `${bot.categoryColor}18`,
                                        color: bot.categoryColor
                                      }}>
                                        {bot.category}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: bot.color, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                                      <Clock size={12} />
                                      <span>{bot.freq}</span>
                                    </div>
                                  </div>
                                </div>

                                {bot.id !== 'sse_hub' && bot.id !== 'onboarding_engine' ? (
                                  <button
                                    type="button"
                                    disabled={isExecuting || isTriggeringBot !== null}
                                    onClick={() => handleTriggerSpecificBot(bot.id, bot.name)}
                                    style={{
                                      minHeight: '44px',
                                      padding: '0.45rem 0.85rem',
                                      borderRadius: '0.65rem',
                                      backgroundColor: isExecuting ? 'rgba(245, 158, 11, 0.2)' : 'var(--primary)',
                                      border: 'none',
                                      color: '#ffffff',
                                      fontSize: '0.76rem',
                                      fontWeight: 800,
                                      cursor: (isExecuting || isTriggeringBot !== null) ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      whiteSpace: 'nowrap',
                                      boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)'
                                    }}
                                  >
                                    {isExecuting ? (
                                      <>
                                        <Loader2 size={13} className="spin" />
                                        <span>Memproses...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play size={13} fill="currentColor" />
                                        <span>Jalankan</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                    color: '#0284c7'
                                  }}>
                                    {bot.id === 'sse_hub' ? 'Streaming' : 'Event-Driven'}
                                  </span>
                                )}
                              </div>

                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {bot.desc}
                              </p>
                            </div>

                            {/* Runtime Status Footer */}
                            <div style={{
                              paddingTop: '0.5rem',
                              borderTop: '1px solid var(--border-light)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)'
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>Status:</span>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                                <strong style={{ color: '#10b981' }}>Aktif (Normal)</strong>
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setAutomationLogsBotFilter(bot.id);
                                  setAutomationSubView('logs');
                                  fetchAutomation(bot.id, automationLogsStatusFilter, automationLogsSearch);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontWeight: 700,
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.2rem 0.4rem'
                                }}
                              >
                                <span>Lihat Log Bot Ini →</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: EXECUTION LOGS & AUDIT TRAIL STREAM */}
              {automationSubView === 'logs' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Activity size={16} color="#10b981" />
                        <span>Riwayat &amp; Log Eksekusi ({automationLogsTotal || automationLogs.length})</span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => fetchAutomation()}
                        disabled={isFetchingAutomation}
                        style={{
                          minHeight: '44px',
                          minWidth: '44px',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '0.55rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-muted)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: isFetchingAutomation ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <RefreshCw size={13} className={isFetchingAutomation ? 'spin' : ''} />
                        <span>Segarkan</span>
                      </button>
                    </div>

                    {/* Filter Chips by Bot */}
                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                      {[
                        { id: 'all', label: 'Semua Bot' },
                        { id: 'ticket_retention_worker', label: 'Retensi PDP Tiket' },
                        { id: 'item_retention_worker', label: 'Retensi Item' },
                        { id: 'support_lifecycle', label: 'Support SLA' },
                        { id: 'store_expiry', label: 'Toko Expired' },
                        { id: 'dormancy_worker', label: 'Dormansi' },
                        { id: 'promo_expiry', label: 'Promo' },
                        { id: 'flash_sale', label: 'Flash Sale' },
                        { id: 'cleaner_worker', label: 'Pembersih' },
                        { id: 'weekly_summary', label: 'Ringkasan' }
                      ].map(chip => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setAutomationLogsBotFilter(chip.id);
                            fetchAutomation(chip.id, automationLogsStatusFilter, automationLogsSearch);
                          }}
                          style={{
                            minHeight: '44px',
                            minWidth: '44px',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '0.65rem',
                            fontSize: '0.76rem',
                            fontWeight: automationLogsBotFilter === chip.id ? 800 : 600,
                            border: `1px solid ${automationLogsBotFilter === chip.id ? 'var(--primary)' : 'var(--border-light)'}`,
                            backgroundColor: automationLogsBotFilter === chip.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                            color: automationLogsBotFilter === chip.id ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Search Bar */}
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Cari detail log atau target..."
                        value={automationLogsSearch}
                        onChange={e => {
                          setAutomationLogsSearch(e.target.value);
                          fetchAutomation(automationLogsBotFilter, automationLogsStatusFilter, e.target.value);
                        }}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.55rem 0.85rem 0.55rem 2.5rem',
                          borderRadius: '0.75rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Log Cards List */}
                    {isFetchingAutomation ? (
                      <div style={{ padding: '3rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                        <Loader2 size={24} className="spin" color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Memuat log eksekusi...</p>
                      </div>
                    ) : automationLogs.length === 0 ? (
                      <div style={{
                        padding: '3rem 1rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '1rem',
                        border: '1px solid var(--border-light)'
                      }}>
                        <Clock size={36} color="#94a3b8" style={{ margin: '0 auto 0.65rem', opacity: 0.6 }} />
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Belum ada riwayat eksekusi bot yang cocok dengan filter.
                        </p>
                      </div>
                    ) : (
                      automationLogs.map((log, idx) => {
                        const isSuccess = log.status === 'success';
                        const isError = log.status === 'error';
                        const statusColor = isSuccess ? '#10b981' : (log.status === 'info' ? '#38bdf8' : '#ef4444');
                        const statusBg = isSuccess ? 'rgba(16, 185, 129, 0.12)' : (log.status === 'info' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)');
                        const timeVal = log.timestamp || log.created_at;

                        return (
                          <div
                            key={log.id || idx}
                            style={{
                              padding: '1rem 1.25rem',
                              borderRadius: '0.95rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              boxShadow: 'var(--card-shadow, 0 2px 6px rgba(0,0,0,0.03))'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '0.4rem',
                                  backgroundColor: statusBg,
                                  color: statusColor
                                }}>
                                  {log.status ? log.status.toUpperCase() : 'SUKSES'}
                                </span>
                                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {log.bot_title || log.bot_name || log.bot_type || log.bot_id || 'Bot Worker'}
                                </span>
                              </div>

                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {timeVal ? new Date(timeVal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : 'Baru saja'}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              {log.details || log.message}
                            </p>

                            {log.error_message && (
                              <div style={{
                                padding: '0.55rem 0.85rem',
                                borderRadius: '0.6rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#ef4444',
                                fontSize: '0.76rem',
                                fontWeight: 600
                              }}>
                                <strong>Error:</strong> {log.error_message}
                              </div>
                            )}

                            {/* Metadata Footer */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '0.45rem',
                              borderTop: '1px solid var(--border-light)',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              flexWrap: 'wrap',
                              gap: '0.45rem'
                            }}>
                              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                                <span>Durasi: <strong style={{ color: 'var(--text-primary)' }}>{log.duration_ms ?? 0} ms</strong></span>
                                <span>•</span>
                                <span>Terdampak: <strong style={{ color: 'var(--text-primary)' }}>{log.affected_count ?? 0} entitas</strong></span>
                              </div>
                              <span style={{
                                fontSize: '0.66rem',
                                padding: '0.12rem 0.5rem',
                                borderRadius: '0.35rem',
                                backgroundColor: log.trigger_type === 'manual' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                color: log.trigger_type === 'manual' ? '#d97706' : '#6366f1',
                                fontWeight: 700
                              }}>
                                {log.trigger_type === 'manual' ? 'Pemicu Manual' : 'Cron Otomatis'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 4: SANDBOX & SIMULATOR ENGINE */}
              {automationSubView === 'sandbox' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      padding: '1.4rem 1.6rem',
                      borderRadius: '1.15rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '0.75rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b',
                          flexShrink: 0
                        }}>
                          <Zap size={20} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Sandbox Simulator &amp; Pengujian Bot
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Simulasikan proses pengiriman notifikasi atau trigger bot tanpa mengganggu operasional normal.
                          </p>
                        </div>
                      </div>

                      <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <span><strong>Petunjuk:</strong> Modul sandbox memungkinkan Superadmin untuk menguji jalur transmisi SSE, validasi logic siklus toko/promo, dan memastikan antrean bot berjalan tanpa bottleneck.</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.35rem' }}>
                        <button
                          type="button"
                          disabled={isTestingSandbox}
                          onClick={handleRunSandboxTest}
                          style={{
                            minHeight: '46px',
                            padding: '0.8rem 1.25rem',
                            borderRadius: '0.85rem',
                            backgroundColor: '#f59e0b',
                            color: '#000000',
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            border: 'none',
                            cursor: isTestingSandbox ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
                          }}
                        >
                          {isTestingSandbox ? (
                            <>
                              <Loader2 size={16} className="spin" />
                              <span>Mengirimkan Simulasi Realtime...</span>
                            </>
                          ) : (
                            <>
                              <Send size={16} />
                              <span>Uji Transmisi Event SSE (Test Guide)</span>
                            </>
                          )}
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('store_expiry', 'Kedaluwarsa Toko')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <StoreIcon size={15} color="#3b82f6" />
                            <span>Simulasi Toko Expired</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('dormancy_worker', 'Dormansi Toko')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <Clock size={15} color="#8b5cf6" />
                            <span>Simulasi Dormansi</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('promo_expiry', 'Promo Merchant')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <Tag size={15} color="#10b981" />
                            <span>Simulasi Promo Expired</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('cleaner_worker', 'Pembersih Notifikasi')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={15} color="#64748b" />
                            <span>Pembersih Notifikasi</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('onboarding_engine', 'Starter Kit Onboarding')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <Award size={15} color="#10b981" />
                            <span>Simulasi Onboarding Toko</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTriggeringBot !== null}
                            onClick={() => handleTriggerSpecificBot('support_lifecycle', 'Audit SLA Tiket')}
                            style={{
                              minHeight: '44px',
                              padding: '0.7rem 0.95rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: isTriggeringBot !== null ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              justifyContent: 'center'
                            }}
                          >
                            <HelpCircle size={15} color="#06b6d4" />
                            <span>Simulasi SLA Tiket Helpdesk</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: MONETIZATION (GOOGLE ADSENSE & GA4) */}
          {activeView === 'monetization' && canAccessMonetization && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Segmented Switch: AdSense vs GA4 */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-deep)'
              }}>
                <button
                  type="button"
                  onClick={() => setMonetizationSubTab('adsense')}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${monetizationSubTab === 'adsense' ? '#eab308' : 'var(--border-light)'}`,
                    backgroundColor: monetizationSubTab === 'adsense' ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-card)',
                    color: monetizationSubTab === 'adsense' ? '#eab308' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <DollarSign size={16} />
                  <span>Google AdSense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonetizationSubTab('analytics')}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${monetizationSubTab === 'analytics' ? 'var(--primary)' : 'var(--border-light)'}`,
                    backgroundColor: monetizationSubTab === 'analytics' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                    color: monetizationSubTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={16} />
                  <span>Google Analytics 4 (GA4)</span>
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                <div style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
                  {/* TAB 1: GOOGLE ADSENSE SETTINGS */}
                  {monetizationSubTab === 'adsense' && (
                    <form onSubmit={handleSaveGoogleSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Notice Policy Card */}
                      <div style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '0.95rem',
                        backgroundColor: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <DollarSign size={18} color="#eab308" />
                          <strong style={{ fontSize: '0.85rem', color: '#eab308' }}>
                            Google AdSense Monetization (Plan B):
                          </strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Iklan hanya akan disuntikkan pada katalog toko <strong>Versi Gratis (Free)</strong>. Toko yang berlangganan <strong>Paket Pro</strong> dijamin 100% bebas iklan.
                        </p>
                      </div>

                      {/* Master Status & Mode */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        {/* Master Switch */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              Status Iklan Platform
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Aktifkan penayangan Google AdSense di seluruh ekosistem platform
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setGoogleSettings(prev => ({ ...prev, ads_enabled: prev.ads_enabled === '1' ? '0' : '1' }))}
                            style={{
                              width: '48px',
                              height: '26px',
                              borderRadius: '999px',
                              backgroundColor: googleSettings.ads_enabled === '1' ? '#10b981' : 'rgba(148, 163, 184, 0.3)',
                              padding: '2px',
                              border: 'none',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                          >
                            <div style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: googleSettings.ads_enabled === '1' ? '24px' : '2px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </button>
                        </div>

                        {/* Publisher ID Input */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Google AdSense Publisher ID (Client ID)
                          </label>
                          <input
                            type="text"
                            placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                            value={googleSettings.ads_client_id || ''}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, ads_client_id: e.target.value.trim() }))}
                            style={{
                              width: '100%',
                              padding: '0.7rem 0.85rem',
                              borderRadius: '0.65rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              boxSizing: 'border-box'
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                            Salin Publisher ID dari Dashboard Akun Google AdSense Anda.
                          </span>
                        </div>

                        {/* Auto Ads & Test Mode Switches (2-Column Grid on Tablet) */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '0.85rem',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid var(--border-light)'
                        }}>
                          {/* Auto Ads */}
                          <div style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Auto Ads</span>
                              <input
                                type="checkbox"
                                checked={googleSettings.ads_auto_enabled === '1'}
                                onChange={e => setGoogleSettings(prev => ({ ...prev, ads_auto_enabled: e.target.checked ? '1' : '0' }))}
                                style={{ accentColor: '#eab308', cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Iklan otomatis AI Google</span>
                          </div>

                          {/* Test Mode */}
                          <div style={{
                            padding: '0.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Mode Sandbox</span>
                              <input
                                type="checkbox"
                                checked={googleSettings.ads_test_mode === '1'}
                                onChange={e => setGoogleSettings(prev => ({ ...prev, ads_test_mode: e.target.checked ? '1' : '0' }))}
                                style={{ accentColor: '#38bdf8', cursor: 'pointer', width: '18px', height: '18px' }}
                              />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pratinjau tanpa klik palsu</span>
                          </div>
                        </div>
                      </div>

                      {/* Ad Placement Slots Configuration */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Unit Penempatan Iklan Khusus (Slot IDs)
                          </h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Konfigurasi unit slot iklan spesifik di berbagai halaman (opsional jika Auto Ads aktif)
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '1rem'
                        }}>
                          {/* Slot 1: Header Banner */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              1. Header Banner Slot ID (Di Bawah Search Bar Toko)
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: 1234567890 (Opsional jika Auto Ads aktif)"
                              value={googleSettings.ads_slot_header || ''}
                              onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_header: e.target.value.trim() }))}
                              style={{
                                width: '100%',
                                padding: '0.65rem 0.8rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          {/* Slot 2: In-Feed Product Catalog */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              2. In-Feed Catalog Slot ID (Di Sela-Sela Produk)
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: 2345678901 (Opsional jika Auto Ads aktif)"
                              value={googleSettings.ads_slot_infeed || ''}
                              onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_infeed: e.target.value.trim() }))}
                              style={{
                                width: '100%',
                                padding: '0.65rem 0.8rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          {/* Slot 3: Product Detail View */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              3. Product Detail Slot ID (Di Bawah Spesifikasi Produk)
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: 3456789012 (Opsional jika Auto Ads aktif)"
                              value={googleSettings.ads_slot_product_detail || ''}
                              onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_product_detail: e.target.value.trim() }))}
                              style={{
                                width: '100%',
                                padding: '0.65rem 0.8rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          {/* Slot 4: Bottom Banner */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              4. Sticky Footer Slot ID (Banner Melayang Bawah Layar)
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: 4567890123 (Opsional jika Auto Ads aktif)"
                              value={googleSettings.ads_slot_bottom || ''}
                              onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_bottom: e.target.value.trim() }))}
                              style={{
                                width: '100%',
                                padding: '0.65rem 0.8rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ads.txt Manager Card */}
                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Code size={18} color="#10b981" />
                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              File ads.txt Domain Publik
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyAdsTxt}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedAdsTxt ? '#10b981' : 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.4rem 0.65rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--bg-deep)'
                            }}
                          >
                            {copiedAdsTxt ? <CheckCheck size={14} /> : <Copy size={14} />}
                            <span>{copiedAdsTxt ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          File ini disajikan otomatis oleh server di <a href="/ads.txt" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>catavor.com/ads.txt</a> untuk verifikasi robot Google.
                        </p>

                        <textarea
                          rows={3}
                          value={googleSettings.ads_txt_content || ''}
                          onChange={e => setGoogleSettings(prev => ({ ...prev, ads_txt_content: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.65rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            color: '#10b981',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            boxSizing: 'border-box',
                            resize: 'none'
                          }}
                        />
                      </div>

                      {/* Submit Save Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          style={{
                            padding: '0.75rem 1.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#eab308',
                            color: '#000000',
                            border: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minHeight: '44px',
                            boxShadow: '0 4px 15px rgba(234, 179, 8, 0.25)'
                          }}
                        >
                          <Check size={16} />
                          <span>{isSavingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Konfigurasi AdSense'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: GOOGLE ANALYTICS 4 (GA4) */}
                  {monetizationSubTab === 'analytics' && (
                    <form onSubmit={handleSaveGoogleSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '0.95rem',
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BarChart3 size={18} color="#38bdf8" />
                          <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>
                            Google Analytics 4 (GA4 Dinamis):
                          </strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Pelacakan analitik lalu lintas pengunjung platform secara instan tanpa perlu melakukan hardcode atau rebuild kodingan.
                        </p>
                      </div>

                      <div style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        {/* Master Switch GA4 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              Status Pelacakan GA4
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Aktifkan injeksi script gtag.js di katalog publik
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setGoogleSettings(prev => ({ ...prev, ga_enabled: prev.ga_enabled === '1' ? '0' : '1' }))}
                            style={{
                              width: '48px',
                              height: '26px',
                              borderRadius: '999px',
                              backgroundColor: googleSettings.ga_enabled === '1' ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)',
                              padding: '2px',
                              border: 'none',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                          >
                            <div style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: googleSettings.ga_enabled === '1' ? '24px' : '2px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </button>
                        </div>

                        {/* Measurement ID */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Google Analytics Measurement ID
                          </label>
                          <input
                            type="text"
                            placeholder="G-XXXXXXXXXX"
                            value={googleSettings.ga_measurement_id || ''}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, ga_measurement_id: e.target.value.trim().toUpperCase() }))}
                            style={{
                              width: '100%',
                              padding: '0.7rem 0.85rem',
                              borderRadius: '0.65rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              boxSizing: 'border-box'
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                            Contoh format: G-4K89Z1X234 (Dapat ditemukan di Google Analytics Admin &gt; Data Streams).
                          </span>
                        </div>

                        {/* Events Information */}
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.76rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6
                        }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                            Event Otomatis yang Terkirim:
                          </div>
                          <div>&bull; <code>page_view</code> saat pengunjung berpindah halaman toko.</div>
                          <div>&bull; <code>view_item</code> saat detail produk katalog dilihat.</div>
                        </div>
                      </div>

                      {/* Submit Save Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          style={{
                            padding: '0.75rem 1.85rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#38bdf8',
                            color: '#000000',
                            border: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minHeight: '44px',
                            boxShadow: '0 4px 15px rgba(56, 189, 248, 0.25)'
                          }}
                        >
                          <Check size={16} />
                          <span>{isSavingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Konfigurasi GA4'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: MASTER DATA (REKBER, DOMAINS, CS TEMPLATES) */}
          {activeView === 'master-data' && canAccessMasterData && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-main)' }}>
              {/* Segmented Sub-Tab Switcher Bar */}
              <div style={{
                padding: '0.85rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => handleSwitchMasterSubTab('rekber')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.75rem',
                    border: `1.5px solid ${masterSubTab === 'rekber' ? '#10b981' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'rekber' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                    color: masterSubTab === 'rekber' ? '#10b981' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: masterSubTab === 'rekber' ? 800 : 600,
                    cursor: 'pointer',
                    minHeight: '44px',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <ShieldCheck size={17} />
                  <span>Proteksi Rekber Syariah</span>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    fontWeight: 700,
                    backgroundColor: googleSettings.rekber_enabled !== '0' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: googleSettings.rekber_enabled !== '0' ? '#10b981' : '#ef4444'
                  }}>
                    {googleSettings.rekber_enabled !== '0' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMasterSubTab('domains')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.75rem',
                    border: `1.5px solid ${masterSubTab === 'domains' ? 'var(--primary)' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'domains' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                    color: masterSubTab === 'domains' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: masterSubTab === 'domains' ? 800 : 600,
                    cursor: 'pointer',
                    minHeight: '44px',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <Globe size={17} />
                  <span>Whitelist Domain Aman</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMasterSubTab('templates')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.75rem',
                    border: `1.5px solid ${masterSubTab === 'templates' ? '#8b5cf6' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'templates' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                    color: masterSubTab === 'templates' ? '#8b5cf6' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: masterSubTab === 'templates' ? 800 : 600,
                    cursor: 'pointer',
                    minHeight: '44px',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <Zap size={17} />
                  <span>Template Balasan CS</span>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    color: '#8b5cf6'
                  }}>
                    {templatePagination.total || cannedTemplates.length}
                  </span>
                </button>
              </div>

              {/* Subtab Content Area */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* SUBTAB 1: REKBER SYARIAH ESCROW */}
                {masterSubTab === 'rekber' && (
                  <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
                    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Security Advisory Callout */}
                      <div style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '1rem',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Lock size={18} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <strong style={{ fontSize: '0.88rem', color: '#10b981' }}>
                            Otoritas Terpusat Platform
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Platform Catavor bermitra resmi eksklusif dengan <strong>rekbersyariah.com</strong>. Layanan Rekber Syariah aktif untuk 6 tipe katalog: <strong>Barang Fisik, Menu Kuliner, Item Digital, Jasa & Layanan, Tanaman, dan Satwa/Hewan</strong> (Properti otomatis dikecualikan via Notaris/PPAT).
                          </p>
                        </div>
                      </div>

                      {/* Main Configuration Form */}
                      <form onSubmit={handleSaveRekberSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* 1. MASTER TOGGLE & CREDENTIALS CARD */}
                        <div style={{
                          padding: '1.25rem',
                          borderRadius: '1rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.25rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-light)' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Status Master Layanan Rekber
                              </h4>
                              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                Kontrol global izin transaksi Rekber Syariah di seluruh katalog platform
                              </p>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.65rem',
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
                                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#10b981' }}
                              />
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
                            {/* Left Column: Text Inputs */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {/* Partner Name */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                                  Nama Layanan Mitra
                                </label>
                                <input
                                  type="text"
                                  value={googleSettings.rekber_partner_name || 'Rekber Syariah'}
                                  onChange={(e) => setGoogleSettings(prev => ({ ...prev, rekber_partner_name: e.target.value }))}
                                  placeholder="Contoh: Rekber Syariah"
                                  style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-deep)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              {/* Official Website URL */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
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
                                        gap: '0.25rem',
                                        fontSize: '0.72rem',
                                        color: '#10b981',
                                        fontWeight: 700,
                                        textDecoration: 'none'
                                      }}
                                    >
                                      <span>Tes Buka</span>
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                </div>
                                <input
                                  type="url"
                                  value={googleSettings.rekber_website_url !== undefined ? googleSettings.rekber_website_url : 'https://rekbersyariah.com'}
                                  onChange={(e) => setGoogleSettings(prev => ({ ...prev, rekber_website_url: e.target.value }))}
                                  placeholder="https://rekbersyariah.com"
                                  style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-deep)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              {/* WhatsApp Number */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
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
                                  style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-deep)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                                  Format angka internasional tanpa tanda plus atau spasi (contoh: 62811220227).
                                </span>
                              </div>
                            </div>

                            {/* Right Column: Logo Upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ImageIcon size={16} style={{ color: '#10b981' }} />
                                <span>Logo / Ikon Resmi Partner Rekber</span>
                              </label>

                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem',
                                padding: '1rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px dashed var(--border-light)'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                  {/* Live Preview Box */}
                                  <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '12px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                  }}>
                                    {googleSettings.rekber_logo_url ? (
                                      <img
                                        src={googleSettings.rekber_logo_url}
                                        alt="Logo Partner"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <ShieldCheck size={28} style={{ color: '#10b981' }} />
                                    )}
                                  </div>

                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => rekberLogoInputRef.current?.click()}
                                        disabled={isUploadingRekberLogo}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.4rem',
                                          padding: '0.5rem 0.85rem',
                                          fontSize: '0.78rem',
                                          fontWeight: 700,
                                          borderRadius: '0.55rem',
                                          border: '1px solid var(--border-light)',
                                          backgroundColor: 'var(--bg-card)',
                                          color: 'var(--text-primary)',
                                          cursor: isUploadingRekberLogo ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {isUploadingRekberLogo ? (
                                          <>
                                            <Loader2 size={13} className="animate-spin" />
                                            <span>Mengunggah...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload size={13} />
                                            <span>Pilih Gambar</span>
                                          </>
                                        )}
                                      </button>

                                      {googleSettings.rekber_logo_url && (
                                        <button
                                          type="button"
                                          onClick={() => setGoogleSettings(prev => ({ ...prev, rekber_logo_url: '' }))}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            borderRadius: '0.55rem',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <Trash2 size={13} />
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
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '0.55rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.78rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Tampil di Landing Page platform (seksi Transaksi Aman) dan dialog info rekber katalog publik.
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. DYNAMIC MESSAGE TEMPLATES CARD */}
                        <div style={{
                          padding: '1.25rem',
                          borderRadius: '1rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              Format Template Pesan WhatsApp
                            </h4>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              Template teks pesan otomatis saat pembeli mengklik aksi transaksi Rekber di katalog publik
                            </p>
                          </div>

                          {/* Dynamic Variables Guide Chips */}
                          <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px dashed var(--border-light)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem'
                          }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Tag size={13} style={{ color: '#0284c7' }} />
                              <span>Klik variabel di bawah untuk menyisipkan ke dalam draf template:</span>
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {[
                                { code: '{item_name}', label: 'Nama Produk', icon: <ShoppingBag size={11} /> },
                                { code: '{item_price}', label: 'Harga', icon: <DollarSign size={11} /> },
                                { code: '{item_type_label}', label: 'Label Kategori', icon: <Layers size={11} /> },
                                { code: '{store_title}', label: 'Nama Toko', icon: <StoreIcon size={11} /> },
                                { code: '{rekber_website_url}', label: 'URL Website', icon: <Globe size={11} /> },
                                { code: '{rekber_website_domain}', label: 'Domain Web', icon: <LinkIcon size={11} /> },
                                { code: '{rekber_wa_number}', label: 'No WA Rekber', icon: <PhoneCall size={11} /> },
                                { code: '{rekber_wa_section}', label: 'Paragraf Bantuan', icon: <ShieldCheck size={11} /> },
                              ].map((item, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    const keyName = `rekber_template_${rekberActiveTemplateTab}`;
                                    setGoogleSettings(prev => ({
                                      ...prev,
                                      [keyName]: `${prev[keyName] || ''} ${item.code}`
                                    }));
                                  }}
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '0.45rem',
                                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                                    color: isDark ? '#38bdf8' : '#0284c7',
                                    border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span>{item.icon}</span>
                                  <code>{item.code}</code>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 6 Category Tabs */}
                          <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', overflowX: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                            {[
                              { key: 'physical', label: 'Barang Fisik', icon: <Package size={14} /> },
                              { key: 'food', label: 'Kuliner', icon: <Utensils size={14} /> },
                              { key: 'digital', label: 'Item Digital', icon: <FileCode size={14} /> },
                              { key: 'service', label: 'Jasa/Layanan', icon: <Briefcase size={14} /> },
                              { key: 'plant', label: 'Tanaman', icon: <Sprout size={14} /> },
                              { key: 'fauna', label: 'Satwa/Hewan', icon: <PawPrint size={14} /> },
                            ].map((tab) => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setRekberActiveTemplateTab(tab.key as any)}
                                style={{
                                  padding: '0.45rem 0.85rem',
                                  borderRadius: '0.55rem',
                                  border: `1px solid ${rekberActiveTemplateTab === tab.key ? '#10b981' : 'transparent'}`,
                                  backgroundColor: rekberActiveTemplateTab === tab.key
                                    ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)')
                                    : 'transparent',
                                  color: rekberActiveTemplateTab === tab.key ? '#10b981' : 'var(--text-muted)',
                                  fontSize: '0.78rem',
                                  fontWeight: rekberActiveTemplateTab === tab.key ? 800 : 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.4rem',
                                  minHeight: '44px',
                                  minWidth: '44px'
                                }}
                              >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                              </button>
                            ))}
                          </div>

                          {/* 2-Column Split: Active Textarea & Live Simulation */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                            {/* Left: Textarea Editor */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                Edit Format Teks Template:
                              </label>
                              <textarea
                                rows={7}
                                value={googleSettings[`rekber_template_${rekberActiveTemplateTab}`] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGoogleSettings(prev => {
                                    const next = { ...prev, [`rekber_template_${rekberActiveTemplateTab}`]: val };
                                    if (rekberActiveTemplateTab === 'physical') {
                                      next.rekber_template_general = val;
                                    }
                                    return next;
                                  });
                                }}
                                placeholder={REKBER_FACTORY_DEFAULTS[`rekber_template_${rekberActiveTemplateTab}`]}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem',
                                  borderRadius: '0.65rem',
                                  border: '1px solid var(--border-light)',
                                  backgroundColor: 'var(--bg-deep)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.8rem',
                                  fontFamily: 'monospace',
                                  lineHeight: 1.5,
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                  resize: 'vertical'
                                }}
                              />
                            </div>

                            {/* Right: Real-Time WhatsApp Live Simulation Preview */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <MessageSquare size={13} />
                                <span>Pratinjau Balon Pesan WhatsApp (Simulasi Nyata):</span>
                              </label>
                              <div style={{
                                padding: '0.85rem 1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: isDark ? '#064e3b' : '#dcfce7',
                                color: isDark ? '#ecfdf5' : '#14532d',
                                fontSize: '0.78rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
                                minHeight: '150px',
                                maxHeight: '240px',
                                overflowY: 'auto'
                              }}>
                                {(() => {
                                  const websiteUrl = googleSettings.rekber_website_url || 'https://rekbersyariah.com';
                                  let websiteDomain = 'rekbersyariah.com';
                                  try {
                                    websiteDomain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname || 'rekbersyariah.com';
                                  } catch {}
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

                                  return (tmpl || '')
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
                          </div>
                        </div>

                        {/* Submit & Reset Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={handleResetRekberDefaults}
                            disabled={isSavingSettings}
                            style={{
                              padding: '0.65rem 1.15rem',
                              borderRadius: '0.65rem',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                              minHeight: '44px'
                            }}
                          >
                            Reset Standar Pabrik
                          </button>

                          <button
                            type="submit"
                            disabled={isSavingSettings}
                            style={{
                              padding: '0.65rem 1.5rem',
                              borderRadius: '0.65rem',
                              border: 'none',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#ffffff',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                              minHeight: '44px'
                            }}
                          >
                            {isSavingSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi Rekber'}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* SUBTAB 2: SAFE DOMAINS WHITELIST */}
                {masterSubTab === 'domains' && (
                  <div style={{ padding: '1rem', boxSizing: 'border-box' }}>
                    <AdminSafeDomainsManagement
                      token={token}
                      themeMode={themeMode}
                    />
                  </div>
                )}

                {/* SUBTAB 3: CANNED RESPONSES / TEMPLATE CS */}
                {masterSubTab === 'templates' && (
                  <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
                    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Top Action & Filter Bar */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        padding: '1rem',
                        borderRadius: '1rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)'
                      }}>
                        {/* Search Input, Category Select & Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                              type="text"
                              value={templateSearchQuery}
                              onChange={(e) => setTemplateSearchQuery(e.target.value)}
                              placeholder="Cari judul, shortcut (/salam), atau isi template..."
                              style={{
                                width: '100%',
                                padding: '0.65rem 2.2rem 0.65rem 2.4rem',
                                borderRadius: '0.65rem',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none',
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
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  padding: '0.2rem'
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div style={{ minWidth: '190px', flexShrink: 0 }}>
                            <TabletCustomSelect
                              variant="filter"
                              value={templateCategoryFilter}
                              onChange={(val) => {
                                setTemplateCategoryFilter(val);
                                setTemplatePage(1);
                              }}
                              options={templateCategoryOptions}
                              icon={<Filter size={15} />}
                              placeholder="Pilih Kategori"
                              interceptBack={true}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={handleResetDefaultTemplates}
                              style={{
                                padding: '0.6rem 0.95rem',
                                borderRadius: '0.65rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                minHeight: '44px',
                                minWidth: '44px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <RefreshCw size={13} />
                              <span>Reset Standar</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleOpenCreateTemplate}
                              style={{
                                padding: '0.6rem 1.15rem',
                                borderRadius: '0.65rem',
                                border: 'none',
                                backgroundColor: '#8b5cf6',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '44px',
                                minWidth: '44px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)'
                              }}
                            >
                              <Plus size={16} />
                              <span>Tambah Template</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Template Cards Grid */}
                      {loadingTemplates ? (
                        <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#8b5cf6' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Memuat daftar template CS...</span>
                        </div>
                      ) : cannedTemplates.length === 0 ? (
                        <div style={{
                          padding: '3rem 1.5rem',
                          textAlign: 'center',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: '1rem',
                          border: '1px dashed var(--border-light)',
                          color: 'var(--text-muted)'
                        }}>
                          <Zap size={36} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.3 }} />
                          <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                            Tidak Ada Template Ditemukan
                          </strong>
                          <p style={{ fontSize: '0.8rem', margin: '0 0 1rem', color: 'var(--text-muted)' }}>
                            Belum ada template pada kategori atau kata kunci pencarian ini.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenCreateTemplate}
                            style={{
                              padding: '0.55rem 1.15rem',
                              borderRadius: '0.65rem',
                              backgroundColor: '#8b5cf6',
                              border: 'none',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            + Tambah Template Baru
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                          {cannedTemplates.map(tmpl => {
                            const catColors: Record<string, { bg: string; text: string; label: string }> = {
                              general: { bg: 'rgba(56, 189, 248, 0.15)', text: '#0284c7', label: 'Umum' },
                              billing: { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', label: 'Keuangan' },
                              technical: { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', label: 'Teknis' },
                              closing: { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', label: 'Penutupan' },
                              account: { bg: 'rgba(244, 63, 94, 0.15)', text: '#e11d48', label: 'Akun' }
                            };
                            const catInfo = catColors[tmpl.category] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#64748b', label: tmpl.category || 'Umum' };
                            const isCopied = copiedTemplateId === tmpl.id;

                            return (
                              <div
                                key={tmpl.id}
                                style={{
                                  backgroundColor: 'var(--bg-card)',
                                  border: `1px solid ${tmpl.is_active !== false ? 'var(--border-light)' : 'rgba(148, 163, 184, 0.2)'}`,
                                  borderRadius: '1rem',
                                  padding: '1.15rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.75rem',
                                  opacity: tmpl.is_active !== false ? 1 : 0.65,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 800,
                                        padding: '0.12rem 0.5rem',
                                        borderRadius: '999px',
                                        backgroundColor: catInfo.bg,
                                        color: catInfo.text
                                      }}>
                                        {catInfo.label}
                                      </span>

                                      {(tmpl.shortcut || tmpl.shortcut_code) && (
                                        <span style={{
                                          fontSize: '0.66rem',
                                          fontWeight: 800,
                                          padding: '0.12rem 0.45rem',
                                          borderRadius: '0.35rem',
                                          backgroundColor: 'rgba(139, 92, 246, 0.12)',
                                          color: '#8b5cf6'
                                        }}>
                                          /{tmpl.shortcut || tmpl.shortcut_code}
                                        </span>
                                      )}

                                      <span style={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '0.35rem',
                                        backgroundColor: tmpl.is_active !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                        color: tmpl.is_active !== false ? '#10b981' : '#94a3b8'
                                      }}>
                                        {tmpl.is_active !== false ? 'Aktif' : 'Nonaktif'}
                                      </span>
                                    </div>

                                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 800, marginTop: '0.15rem' }}>
                                      {tmpl.title}
                                    </strong>
                                  </div>

                                  {/* Action Buttons */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyTemplate(tmpl)}
                                      style={{
                                        padding: '0.4rem',
                                        borderRadius: '0.45rem',
                                        backgroundColor: 'var(--bg-deep)',
                                        border: '1px solid var(--border-light)',
                                        color: isCopied ? '#10b981' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        minWidth: '44px',
                                        minHeight: '44px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Salin Isi Template"
                                    >
                                      {isCopied ? <CheckCheck size={14} /> : <Copy size={14} />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleTemplateActive(tmpl)}
                                      style={{
                                        padding: '0.4rem',
                                        borderRadius: '0.45rem',
                                        backgroundColor: 'var(--bg-deep)',
                                        border: '1px solid var(--border-light)',
                                        color: tmpl.is_active !== false ? '#10b981' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        minWidth: '44px',
                                        minHeight: '44px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title={tmpl.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                                    >
                                      {tmpl.is_active !== false ? <Check size={14} /> : <X size={14} />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditTemplate(tmpl)}
                                      style={{
                                        padding: '0.4rem',
                                        borderRadius: '0.45rem',
                                        backgroundColor: 'var(--bg-deep)',
                                        border: '1px solid var(--border-light)',
                                        color: '#3b82f6',
                                        cursor: 'pointer',
                                        minWidth: '44px',
                                        minHeight: '44px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Edit Template"
                                    >
                                      <Sliders size={14} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTemplate(tmpl.id, tmpl.title)}
                                      style={{
                                        padding: '0.4rem',
                                        borderRadius: '0.45rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        minWidth: '44px',
                                        minHeight: '44px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Hapus Template"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Template Message Content Box */}
                                <div style={{
                                  padding: '0.75rem 0.85rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: 'var(--bg-deep)',
                                  border: '1px solid var(--border-light)',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-secondary)',
                                  lineHeight: 1.5,
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

                      {/* Server-Side Pagination Bar */}
                      {templatePagination.total_pages > 1 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.25rem',
                          borderRadius: '1rem',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          flexWrap: 'wrap',
                          gap: '0.75rem'
                        }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {(() => {
                              const totalCount = Number(templatePagination.total ?? cannedTemplates.length);
                              const startIdx = totalCount > 0 ? ((templatePage - 1) * templateLimit) + 1 : 0;
                              const endIdx = Math.min(templatePage * templateLimit, totalCount);
                              return (
                                <span>
                                  Menampilkan <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{startIdx} - {endIdx}</strong> dari <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalCount}</strong> template
                                </span>
                              );
                            })()}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                                gap: '0.35rem',
                                padding: '0.45rem 0.95rem',
                                borderRadius: '0.55rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: templatePage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: templatePage <= 1 ? 'not-allowed' : 'pointer',
                                opacity: templatePage <= 1 ? 0.45 : 1,
                                minHeight: '44px',
                                minWidth: '44px'
                              }}
                            >
                              <ChevronLeft size={15} />
                              <span>Sebelumnya</span>
                            </button>

                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '60px',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.55rem',
                              backgroundColor: 'rgba(139, 92, 246, 0.12)',
                              border: '1px solid rgba(139, 92, 246, 0.25)',
                              color: '#8b5cf6',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              minHeight: '44px'
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
                                justifyContent: 'center',
                                gap: '0.35rem',
                                padding: '0.45rem 0.95rem',
                                borderRadius: '0.55rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: templatePage >= templatePagination.total_pages ? 'var(--text-muted)' : 'var(--text-primary)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: templatePage >= templatePagination.total_pages ? 'not-allowed' : 'pointer',
                                opacity: templatePage >= templatePagination.total_pages ? 0.45 : 1,
                                minHeight: '44px',
                                minWidth: '44px'
                              }}
                            >
                              <span>Berikutnya</span>
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 11: AUDIT TRAIL (SISTEM & FORENSIK) */}
          {activeView === 'audit' && canAccessAudit && (
            <div style={{
              height: '100%',
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
              boxSizing: 'border-box',
              WebkitOverflowScrolling: 'touch'
            }}>
              {/* Integrated Filter Toolbar */}
              <div style={{
                padding: '0.85rem 1.15rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                {/* Search Input */}
                <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
                  <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Cari aksi (cth: auth.login), deskripsi, email aktor..."
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0.55rem 2.2rem 0.55rem 2.45rem',
                      borderRadius: '0.65rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                  {auditSearch && (
                    <button
                      type="button"
                      onClick={() => setAuditSearch('')}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.2rem'
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Dropdown Filters & Refresh Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {/* Category Select (Standardized TabletCustomSelect) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Kategori:</span>
                    <TabletCustomSelect
                      value={auditCategoryFilter}
                      onChange={(val) => {
                        setAuditCategoryFilter(val);
                        setAuditPage(1);
                      }}
                      options={[
                        { value: 'all', label: 'Semua Kategori' },
                        { value: 'security', label: 'Keamanan & Akses' },
                        { value: 'catalog', label: 'Katalog & Produk' },
                        { value: 'store', label: 'Toko & Merchant' },
                        { value: 'billing', label: 'Finansial & Billing' },
                        { value: 'moderation', label: 'Moderasi & Laporan' },
                        { value: 'system', label: 'Sistem & Otomasi' }
                      ]}
                      variant="filter"
                      highlight={auditCategoryFilter !== 'all'}
                      placeholder="Semua Kategori"
                      triggerStyle={{
                        minHeight: '44px',
                        width: 'auto',
                        minWidth: '155px'
                      }}
                      menuWidth={210}
                      ariaLabel="Filter Kategori Audit"
                    />
                  </div>

                  {/* Role Select (Standardized TabletCustomSelect) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Aktor:</span>
                    <TabletCustomSelect
                      value={auditRoleFilter}
                      onChange={(val) => {
                        setAuditRoleFilter(val);
                        setAuditPage(1);
                      }}
                      options={[
                        { value: 'all', label: 'Semua Aktor' },
                        { value: 'superadmin', label: 'Superadmin' },
                        { value: 'merchant', label: 'Merchant' },
                        { value: 'system', label: 'Sistem Otomatis' }
                      ]}
                      variant="filter"
                      highlight={auditRoleFilter !== 'all'}
                      placeholder="Semua Aktor"
                      triggerStyle={{
                        minHeight: '44px',
                        width: 'auto',
                        minWidth: '140px'
                      }}
                      menuWidth={180}
                      ariaLabel="Filter Aktor Audit"
                    />
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    disabled={isLoadingAudit}
                    onClick={() => fetchAuditLogs(1)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      minHeight: '44px',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '0.65rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: isLoadingAudit ? 0.6 : 1
                    }}
                  >
                    <RefreshCw size={14} className={isLoadingAudit ? 'animate-spin' : ''} color="var(--primary)" />
                    <span>Segarkan</span>
                  </button>
                </div>
              </div>

              {/* Comprehensive Data Table */}
              <div style={{
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', minWidth: '860px' }}>
                    <thead>
                      <tr style={{
                        backgroundColor: 'var(--bg-deep)',
                        borderBottom: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        <th style={{ padding: '0.85rem 1.15rem', width: '160px' }}>Waktu & Tanggal</th>
                        <th style={{ padding: '0.85rem 1rem', width: '170px' }}>Kode Aksi</th>
                        <th style={{ padding: '0.85rem 1rem', width: '130px' }}>Kategori</th>
                        <th style={{ padding: '0.85rem 1rem', minWidth: '200px' }}>Aktor Pelaksana</th>
                        <th style={{ padding: '0.85rem 1rem', minWidth: '220px' }}>Deskripsi & Target</th>
                        <th style={{ padding: '0.85rem 1rem', width: '130px' }}>Alamat IP</th>
                        <th style={{ padding: '0.85rem 1.15rem', width: '100px', textAlign: 'center' }}>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingAudit && auditLogs.length === 0 ? (
                        [1, 2, 3, 4, 5].map((n) => (
                          <tr key={n} style={{ borderBottom: '1px solid var(--border-light)', opacity: 0.5 }}>
                            <td colSpan={7} style={{ padding: '1rem 1.15rem' }}>
                              <div style={{ height: '16px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px' }} />
                            </td>
                          </tr>
                        ))
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
                            <History size={42} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              Tidak ada rekaman audit ditemukan
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                              Ubah kata kunci pencarian atau sesuaikan filter kategori untuk melihat rekaman lainnya.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log, idx) => {
                          const logId = log.id || log.created_at || idx;
                          const cat = (log.category || '').toLowerCase();
                          let catColor = '#64748b';
                          let catBg = 'rgba(100, 116, 139, 0.15)';
                          let catIcon = Activity;
                          let catLabel = 'Aktivitas';

                          if (cat === 'security') {
                            catColor = '#f59e0b';
                            catBg = 'rgba(245, 158, 11, 0.15)';
                            catIcon = Shield;
                            catLabel = 'Keamanan';
                          } else if (cat === 'catalog') {
                            catColor = '#10b981';
                            catBg = 'rgba(16, 185, 129, 0.15)';
                            catIcon = ShoppingBag;
                            catLabel = 'Katalog';
                          } else if (cat === 'store') {
                            catColor = '#3b82f6';
                            catBg = 'rgba(59, 130, 246, 0.15)';
                            catIcon = StoreIcon;
                            catLabel = 'Toko';
                          } else if (cat === 'billing') {
                            catColor = '#8b5cf6';
                            catBg = 'rgba(139, 92, 246, 0.15)';
                            catIcon = CreditCard;
                            catLabel = 'Finansial';
                          } else if (cat === 'moderation') {
                            catColor = '#ef4444';
                            catBg = 'rgba(239, 68, 68, 0.15)';
                            catIcon = AlertTriangle;
                            catLabel = 'Moderasi';
                          } else if (cat === 'system') {
                            catColor = '#06b6d4';
                            catBg = 'rgba(6, 182, 212, 0.15)';
                            catIcon = Server;
                            catLabel = 'Sistem';
                          }
                          const CatIconComp = catIcon;

                          return (
                            <tr
                              key={logId}
                              style={{
                                borderBottom: '1px solid var(--border-light)',
                                transition: 'background-color 0.15s ease',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSelectedAuditLogId(logId);
                                setShowAuditDetailModal(true);
                              }}
                            >
                              {/* Waktu & Tanggal */}
                              <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                  {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {log.created_at ? new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </div>
                              </td>

                              {/* Kode Aksi */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span style={{
                                  fontWeight: 800,
                                  color: 'var(--primary)',
                                  fontFamily: 'monospace',
                                  fontSize: '0.76rem',
                                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}>
                                  {log.action || 'system.log'}
                                </span>
                              </td>

                              {/* Kategori */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  backgroundColor: catBg,
                                  color: catColor
                                }}>
                                  <CatIconComp size={12} color={catColor} />
                                  <span>{catLabel}</span>
                                </span>
                              </td>

                              {/* Aktor Pelaksana */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <User size={14} color="var(--text-secondary)" />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {log.actor_name || log.actor_email || 'Sistem'}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {log.actor_email || '-'}
                                    </div>
                                  </div>
                                  <span style={{
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    backgroundColor: log.actor_role === 'superadmin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    color: log.actor_role === 'superadmin' ? '#ef4444' : '#3b82f6',
                                    marginLeft: 'auto',
                                    flexShrink: 0
                                  }}>
                                    {log.actor_role || 'staf'}
                                  </span>
                                </div>
                              </td>

                              {/* Deskripsi & Target */}
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, fontSize: '0.8rem' }}>
                                  {log.description || log.entity_title || 'Tindakan sistem'}
                                </div>
                                {(log.entity_title || log.entity_type) && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    <span style={{ fontWeight: 700 }}>Target:</span>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{log.entity_title || log.entity_type}</span>
                                    {log.entity_id ? <span>(ID: #{log.entity_id})</span> : null}
                                  </div>
                                )}
                              </td>

                              {/* Alamat IP */}
                              <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                {log.ip_address || '127.0.0.1'}
                              </td>

                              {/* Aksi: Tombol Inspeksi */}
                              <td style={{ padding: '0.85rem 1.15rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAuditLogId(logId);
                                    setShowAuditDetailModal(true);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    minHeight: '36px',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '0.55rem',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'var(--bg-deep)',
                                    color: 'var(--primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Eye size={13} color="var(--primary)" />
                                  <span>Inspeksi</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tablet Ergonomic Pagination Bar & Footer Information */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)'
                }}>
                  {/* Row 1: Balanced Information Bar (Data Counter on Left, Rows-Per-Page Selector on Right) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    width: '100%'
                  }}>
                    {/* Information Counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Menampilkan <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{auditLogs.length ? (auditPage - 1) * auditLimit + 1 : 0}</strong> –{' '}
                        <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{Math.min(auditPage * auditLimit, auditTotal)}</strong> dari{' '}
                        <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{auditTotal}</strong> rekaman data
                      </span>
                    </div>

                    {/* Rows Per Page Selector (Standardized TabletCustomSelect) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span>Tampilkan:</span>
                      <TabletCustomSelect
                        value={String(auditLimit)}
                        onChange={(val) => {
                          const newLim = Number(val);
                          setAuditLimit(newLim);
                          setAuditPage(1);
                        }}
                        options={[
                          { value: '15', label: '15 baris' },
                          { value: '25', label: '25 baris' },
                          { value: '50', label: '50 baris' },
                          { value: '100', label: '100 baris' }
                        ]}
                        variant="compact"
                        triggerStyle={{
                          minHeight: '38px',
                          padding: '0 0.65rem',
                          width: 'auto',
                          minWidth: '110px'
                        }}
                        menuWidth={130}
                        ariaLabel="Baris Per Halaman"
                      />
                    </div>
                  </div>

                  {/* Row 2: Centered Tablet Navigation Controls & Quick Jump */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '0.45rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-light)',
                    width: '100%'
                  }}>
                    {/* First Page */}
                    <button
                      type="button"
                      disabled={auditPage <= 1 || isLoadingAudit}
                      onClick={() => setAuditPage(1)}
                      style={{
                        minHeight: '40px',
                        minWidth: '40px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: auditPage <= 1 ? 0.35 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title="Halaman Pertama"
                    >
                      <ChevronsLeft size={16} />
                    </button>

                    {/* Prev Page */}
                    <button
                      type="button"
                      disabled={auditPage <= 1 || isLoadingAudit}
                      onClick={() => setAuditPage(auditPage - 1)}
                      style={{
                        minHeight: '40px',
                        minWidth: '40px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: auditPage <= 1 ? 0.35 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Page Number Indicators */}
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));
                      const pages: (number | string)[] = [];
                      if (totalPages <= 5) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (auditPage > 3) pages.push('...');
                        const start = Math.max(2, auditPage - 1);
                        const end = Math.min(totalPages - 1, auditPage + 1);
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (auditPage < totalPages - 2) pages.push('...');
                        pages.push(totalPages);
                      }

                      return pages.map((p, pIdx) => {
                        if (typeof p === 'string') {
                          return (
                            <span key={`el-${pIdx}`} style={{ padding: '0 0.35rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                              ...
                            </span>
                          );
                        }
                        const isCur = p === auditPage;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setAuditPage(p)}
                            style={{
                              minWidth: '40px',
                              height: '40px',
                              borderRadius: '0.55rem',
                              border: `1px solid ${isCur ? 'var(--primary)' : 'var(--border-light)'}`,
                              backgroundColor: isCur ? 'var(--primary)' : 'var(--bg-card)',
                              color: isCur ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: isCur ? 800 : 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {p}
                          </button>
                        );
                      });
                    })()}

                    {/* Next Page */}
                    <button
                      type="button"
                      disabled={auditPage >= Math.ceil(auditTotal / auditLimit) || isLoadingAudit}
                      onClick={() => setAuditPage(auditPage + 1)}
                      style={{
                        minHeight: '40px',
                        minWidth: '40px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: auditPage >= Math.ceil(auditTotal / auditLimit) ? 'not-allowed' : 'pointer',
                        opacity: auditPage >= Math.ceil(auditTotal / auditLimit) ? 0.35 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title="Halaman Selanjutnya"
                    >
                      <ChevronRight size={16} />
                    </button>

                    {/* Last Page */}
                    <button
                      type="button"
                      disabled={auditPage >= Math.ceil(auditTotal / auditLimit) || isLoadingAudit}
                      onClick={() => setAuditPage(Math.max(1, Math.ceil(auditTotal / auditLimit)))}
                      style={{
                        minHeight: '40px',
                        minWidth: '40px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '0.55rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: auditPage >= Math.ceil(auditTotal / auditLimit) ? 'not-allowed' : 'pointer',
                        opacity: auditPage >= Math.ceil(auditTotal / auditLimit) ? 0.35 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title="Halaman Terakhir"
                    >
                      <ChevronsRight size={16} />
                    </button>

                    {/* Subtle Divider */}
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-light)', margin: '0 0.35rem' }} />

                    {/* Quick Jump Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>Lompat:</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, Math.ceil(auditTotal / auditLimit))}
                        value={quickJumpPageInput}
                        onChange={(e) => setQuickJumpPageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const targetP = parseInt(quickJumpPageInput, 10);
                            const maxP = Math.max(1, Math.ceil(auditTotal / auditLimit));
                            if (!isNaN(targetP) && targetP >= 1 && targetP <= maxP) {
                              setAuditPage(targetP);
                              setQuickJumpPageInput('');
                            }
                          }
                        }}
                        placeholder="Hal"
                        style={{
                          width: '48px',
                          minHeight: '40px',
                          padding: '0.25rem 0.4rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTERED FORENSIC MODAL INSPECTOR (TABLET) */}
              {showAuditDetailModal && selectedAuditLog && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.25rem',
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                  onClick={() => setShowAuditDetailModal(false)}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '1rem',
                      border: '1px solid var(--border-light)',
                      maxWidth: '760px',
                      width: '100%',
                      maxHeight: '85vh',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                      animation: 'scaleIn 0.22s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div style={{
                      padding: '1.15rem 1.35rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: 'var(--primary)',
                          fontFamily: 'monospace'
                        }}>
                          [{selectedAuditLog.action || 'system.log'}]
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(59,130,246,0.18)',
                          color: 'var(--primary)'
                        }}>
                          Log #{selectedAuditLog.id}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {selectedAuditLog.created_at ? new Date(selectedAuditLog.created_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }) : '-'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAuditDetailModal(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.4rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '40px',
                          minWidth: '40px'
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div style={{
                      padding: '1.25rem 1.35rem',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {/* Narrative Description Card */}
                      <div style={{
                        padding: '0.95rem 1.15rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          Deskripsi Rekaman Aktivitas:
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {selectedAuditLog.description || selectedAuditLog.target || 'Tindakan operasional sistem'}
                        </div>
                      </div>

                      {/* 2-Column Grid: Actor & Network */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                            Aktor Pengguna (Pelaksana)
                          </div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {selectedAuditLog.actor_name || selectedAuditLog.actor_email || 'Sistem'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {selectedAuditLog.actor_email || '-'}
                          </div>
                          <div style={{ marginTop: '0.4rem' }}>
                            <span style={{
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              backgroundColor: selectedAuditLog.actor_role === 'superadmin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: selectedAuditLog.actor_role === 'superadmin' ? '#ef4444' : '#3b82f6'
                            }}>
                              Role: {selectedAuditLog.actor_role || 'staf'}
                            </span>
                          </div>
                        </div>

                        <div style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                            Alamat IP & Jaringan
                          </div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {selectedAuditLog.ip_address || '127.0.0.1'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                            {selectedAuditLog.user_agent ? 'Browser Client' : 'Internal Service'}
                          </div>
                        </div>
                      </div>

                      {/* Target Entity Snapshot */}
                      {(selectedAuditLog.entity_type || selectedAuditLog.entity_title || selectedAuditLog.entity_id) && (
                        <div style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Entitas Sasaran (Target)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '0.15rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981'
                            }}>
                              {selectedAuditLog.entity_type || 'Entity'}
                            </span>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {selectedAuditLog.entity_title || `ID #${selectedAuditLog.entity_id}`}
                            </span>
                            {selectedAuditLog.entity_id && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                (ID: {selectedAuditLog.entity_id})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Client User Agent */}
                      {selectedAuditLog.user_agent && (
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                            Client User-Agent:
                          </div>
                          <div style={{
                            padding: '0.6rem 0.85rem',
                            borderRadius: '0.55rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all'
                          }}>
                            {selectedAuditLog.user_agent}
                          </div>
                        </div>
                      )}

                      {/* Raw Payload / Changes Data Forensik */}
                      {(selectedAuditLog.changes || selectedAuditLog.payload) && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
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
                                color: 'var(--primary)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              {copiedAuditPayload ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                              <span>{copiedAuditPayload ? 'Tersalin' : 'Salin JSON'}</span>
                            </button>
                          </div>
                          <pre style={{
                            margin: 0,
                            padding: '0.95rem',
                            borderRadius: '0.65rem',
                            backgroundColor: 'var(--bg-deep)',
                            color: '#38bdf8',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.74rem',
                            fontFamily: 'monospace',
                            overflowX: 'auto',
                            maxHeight: '260px'
                          }}>
                            {typeof (selectedAuditLog.changes || selectedAuditLog.payload) === 'string'
                              ? (selectedAuditLog.changes || selectedAuditLog.payload)
                              : JSON.stringify(selectedAuditLog.changes || selectedAuditLog.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div style={{
                      padding: '0.85rem 1.35rem',
                      borderTop: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      display: 'flex',
                      justifyContent: 'flex-end'
                    }}>
                      <button
                        type="button"
                        onClick={() => setShowAuditDetailModal(false)}
                        style={{
                          minHeight: '44px',
                          padding: '0.55rem 1.25rem',
                          borderRadius: '0.6rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
          token={token}
        />
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img
              src={previewImageUrl}
              alt="Pratinjau"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '0.75rem' }}
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* CANNED CS RESPONSE TEMPLATES MODAL */}
      {showCannedModal && (
        <div
          onClick={() => setShowCannedModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Template Balasan Cepat CS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCannedModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: '1rem 1.25rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              {DEFAULT_CANNED_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleInsertCannedTemplate(tmpl.text)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{tmpl.title}</strong>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(59, 130, 246, 0.25)'
                    }}>
                      {tmpl.category}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {tmpl.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CS TEMPLATE FORM MODAL (CENTERED DIALOG TABLET) */}
      {showTemplateFormModal && (
        <div
          onClick={() => setShowTemplateFormModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {editingTemplate ? 'Edit Template Balasan CS' : 'Tambah Template Balasan CS'}
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Konfigurasi pesan standar balasan cepat staf CS platform
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTemplateFormModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '0.45rem'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveTemplate} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    Judul Template <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
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
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Shortcut Cepat
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', fontWeight: 800, fontSize: '0.85rem' }}>
                      /
                    </span>
                    <input
                      type="text"
                      value={templateForm.shortcut}
                      onChange={e => setTemplateForm({ ...templateForm, shortcut: e.target.value.replace(/^\//, '').toLowerCase() })}
                      placeholder="salam"
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem 0.65rem 1.6rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Kategori Template
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="general">Umum &amp; Greeting</option>
                    <option value="billing">Keuangan &amp; Billing</option>
                    <option value="technical">Kendala Teknis</option>
                    <option value="closing">Penutupan Tiket</option>
                    <option value="account">Akun &amp; Keamanan</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    Isi Template Pesan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Klik tag di bawah untuk menyisipkan variabel:
                  </span>
                </div>

                {/* Variable Tag Inserters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
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
                        padding: '0.25rem 0.55rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        border: '1px dashed rgba(139, 92, 246, 0.35)',
                        color: '#8b5cf6',
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
                  rows={5}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Active Toggle Checkbox */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.85rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Status Aktif Template
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Template akan muncul di daftar pilihan staf saat merespons tiket bantuan
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={templateForm.is_active}
                  onChange={e => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateFormModal(false)}
                  style={{
                    padding: '0.6rem 1.15rem',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px',
                    minWidth: '44px'
                  }}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={savingTemplate}
                  style={{
                    padding: '0.6rem 1.35rem',
                    borderRadius: '0.65rem',
                    border: 'none',
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: savingTemplate ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                    minHeight: '44px',
                    minWidth: '44px'
                  }}
                >
                  {savingTemplate ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{savingTemplate ? 'Menyimpan...' : (editingTemplate ? 'Perbarui Template' : 'Simpan Template')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
