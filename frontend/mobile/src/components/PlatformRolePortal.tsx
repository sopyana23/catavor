import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Search,
  Filter,
  Eye,
  Check,
  Trash2,
  Plus,
  RefreshCw,
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
  Volume2,
  VolumeX,
  ArrowUp
} from 'lucide-react';
import { type UserRBACInfo, hasPermission, isSuperAdmin, getRoleBadge } from '../utils/rbac';
import { AdminRBACManagement } from './AdminRBACManagement';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import appLogoImg from '../assets/logo.png';
import { APP_LOGO_BASE64 } from '../assets/logoBase64';

interface MobilePlatformRolePortalProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onBack?: () => void;
  onOpenRBAC?: () => void;
  onLogout?: () => void;
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
  | 'audit';

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

const getMerchantDisplayName = (ticket: any, msgSender?: any) => {
  if (msgSender?.name && !msgSender.name.includes('@')) return getFirstName(msgSender.name);
  if (ticket?.user?.name && !ticket.user.name.includes('@')) return getFirstName(ticket.user.name);
  if (ticket?.store?.name) return getFirstName(ticket.store.name);
  if (ticket?.store_name) return getFirstName(ticket.store_name);
  const rawEmail = ticket?.user_email || ticket?.user?.email || msgSender?.email || '';
  if (rawEmail) {
    const prefix = rawEmail.split('@')[0];
    if (prefix) return getFirstName(prefix);
  }
  return 'Merchant';
};

export const PlatformRolePortal: React.FC<MobilePlatformRolePortalProps> = ({
  token,
  currentUser,
  onBack,
  onOpenRBAC,
  onLogout
}) => {
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

  // Granular Permission Checks
  const canAccessRBAC = isSuperAdmin(currentUser) || hasPermission(currentUser, 'system:admins:manage');
  const canAccessCompliance = hasPermission(currentUser, 'compliance:reports:manage') || hasPermission(currentUser, 'compliance:dormancy:manage') || isSuperAdmin(currentUser);
  const canAccessSupport = hasPermission(currentUser, 'support:tickets:read') || hasPermission(currentUser, 'support:tickets:reply') || isSuperAdmin(currentUser);
  const canAccessFinance = hasPermission(currentUser, 'finance:orders:read') || isSuperAdmin(currentUser);
  const canAccessMonetization = hasPermission(currentUser, 'monetization:google:manage') || isSuperAdmin(currentUser);
  const canAccessBroadcast = hasPermission(currentUser, 'content:broadcast:send') || isSuperAdmin(currentUser);
  const canAccessAudit = isSuperAdmin(currentUser) || hasPermission(currentUser, 'audit:logs:read');
  // Helper to synchronize URL query parameters cleanly and safely for Mobile Admin
  const updatePlatformUrl = (view: string, ticketRef?: string | number | null, subtabRef?: string | null) => {
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

      const newRelativePathQuery = url.pathname + url.search + url.hash;
      const currentRelativePathQuery = window.location.pathname + window.location.search + window.location.hash;
      if (newRelativePathQuery !== currentRelativePathQuery) {
        window.history.pushState({ view, ticket: ticketRef || null, subtab: subtabRef || null }, '', newRelativePathQuery);
      }
    } catch (e) {
      console.error('Failed to sync mobile URL:', e);
    }
  };

  const getDefaultView = (): ActiveView => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = (urlParams.get('tab') || urlParams.get('view') || urlParams.get('division') || '').toLowerCase();
      if (['dashboard', 'rbac', 'stores', 'reports', 'support', 'finance', 'monetization', 'broadcast', 'audit'].includes(tabParam)) {
        return tabParam as ActiveView;
      }
      if (['overview', 'home'].includes(tabParam)) return 'dashboard';
      if (['help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) return 'support';
      if (['compliance', 'laporan'].includes(tabParam)) return 'reports';
      if (['keuangan', 'billing', 'orders'].includes(tabParam)) return 'finance';
      if (['iklan', 'ads', 'google'].includes(tabParam)) return 'monetization';
      if (['siaran', 'notifikasi'].includes(tabParam)) return 'broadcast';
    } catch {
      // fallback
    }

    if (isSuperAdmin(currentUser)) return 'dashboard';
    if (roleSlug === 'compliance' && canAccessCompliance) return 'reports';
    if (roleSlug === 'support' && canAccessSupport) return 'support';
    if (roleSlug === 'finance' && canAccessFinance) return 'finance';
    if (roleSlug === 'content' && canAccessBroadcast) return 'broadcast';
    return 'dashboard';
  };

  const [activeView, setActiveView] = useState<ActiveView>(getDefaultView());

  const handleSwitchView = (view: ActiveView) => {
    setActiveView(view);
    setSelectedTicket(null);
    updatePlatformUrl(view, null);
  };

  const handleCloseTicketChat = () => {
    setSelectedTicket(null);
    updatePlatformUrl(activeView || 'support', null);
  };
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Support Division Sub-Navigation & Master Canned Responses State
  const [supportSubView, setSupportSubView] = useState<'tickets' | 'templates'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sub = (params.get('subtab') || params.get('subview') || '').toLowerCase();
      if (sub === 'templates' || sub === 'template' || sub === 'canned') return 'templates';
    } catch {}
    return 'tickets';
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
          shortLabel: 'Open',
          color: '#06b6d4',
          bg: isDark ? 'rgba(6, 182, 212, 0.16)' : 'rgba(6, 182, 212, 0.1)',
          border: isDark ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.25)',
          desc: 'Tiket baru, menunggu respons pertama CS'
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
      default:
        return {
          id: status || 'open',
          label: status || 'Open',
          shortLabel: status || 'Open',
          color: '#38bdf8',
          bg: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.1)',
          border: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.25)',
          desc: ''
        };
    }
  };

  const handleNavigateToTemplatesMaster = () => {
    setShowTemplateModal(false);
    setTemplateSheetDragY(0);
    setSelectedTicket(null); // CRITICAL: Exits ticket conversation detail view so user immediately lands on Master Template page!
    setActiveView('support');
    setSupportSubView('templates');
    updatePlatformUrl('support', null, 'templates');
    fetchCannedTemplates(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

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

  // Floating Scroll to Top button state & listener
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchCannedTemplates = async (includeInactive = true) => {
    setLoadingTemplates(true);
    try {
      const url = `/api/admin/support/templates${includeInactive ? '?include_inactive=true' : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCannedTemplates(data.data || []);
      }
    } catch (e) {
      console.error('Failed to load canned response templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

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
    const merchantName = getMerchantDisplayName(selectedTicket);
    const storeName = selectedTicket?.store?.name || selectedTicket?.store_name || 'Toko Anda';
    const ticketNum = selectedTicket?.ticket_number || `#TCK-${selectedTicket?.id}`;
    const agentName = currentUser?.name || 'Staf CS';

    let content = tmpl.content || '';
    content = content.replace(/\{\{merchant_name\}\}/gi, merchantName);
    content = content.replace(/\{\{store_name\}\}/gi, storeName);
    content = content.replace(/\{\{ticket_number\}\}/gi, ticketNum);
    content = content.replace(/\{\{agent_name\}\}/gi, agentName);

    setReplyText(prev => (prev ? `${prev}\n${content}` : content));
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
  const [reportsFilter, setReportsFilter] = useState<'all' | 'pending' | 'investigating' | 'resolved'>('all');
  const [dormancyMetrics, setDormancyMetrics] = useState<any | null>(null);

  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsFilter, setTicketsFilter] = useState<'all' | 'unread' | 'action_required' | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
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

  // Available unique categories & priorities from registered dictionary & tickets
  const availableCategories = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const cat = t.category || 'general';
      map[cat] = (map[cat] || 0) + 1;
    });
    const allKeys = Array.from(new Set([...Object.keys(CATEGORY_LABELS), ...Object.keys(map)]));
    return allKeys.map(cat => ({
      id: cat,
      label: CATEGORY_LABELS[cat] || cat,
      count: map[cat] || 0
    }));
  }, [tickets]);

  const availablePriorities = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      const p = (t.priority || 'medium').toLowerCase();
      map[p] = (map[p] || 0) + 1;
    });
    const allPrios = ['urgent', 'high', 'medium', 'low'];
    return allPrios.map(p => ({
      id: p,
      label: PRIORITY_META[p]?.label || p,
      color: PRIORITY_META[p]?.color || '#94a3b8',
      count: map[p] || 0
    }));
  }, [tickets]);

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

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
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedAdsTxt, setCopiedAdsTxt] = useState(false);

  // Selected item Modals & Bottom Sheets
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [ticketReplyAttachments, setTicketReplyAttachments] = useState<any[]>([]);
  const [isUploadingTicketAttachment, setIsUploadingTicketAttachment] = useState(false);
  // Support Ticket Attachments Gallery Lightbox State (Identik dengan Admin Katalog)
  const [attachmentLightbox, setAttachmentLightbox] = useState<{
    isOpen: boolean;
    images: { file_url: string; file_name?: string }[];
    currentIndex: number;
  } | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const openAttachmentLightbox = (images?: { file_url: string; file_name?: string }[], index: number = 0) => {
    if (!images || images.length === 0) return;
    setAttachmentLightbox({
      isOpen: true,
      images,
      currentIndex: Math.max(0, Math.min(index, images.length - 1))
    });
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const closeAttachmentLightbox = () => {
    setAttachmentLightbox(null);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleDownloadAttachmentImage = (url: string, fileName?: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'lampiran_catavor.jpg';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  // In-App Document Preview Modal State (PDF & Documents)
  const [docPreview, setDocPreview] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    fileType?: string;
    id?: string;
  } | null>(null);

  const openDocumentPreview = (att: { file_url?: string; file_name?: string; file_size?: number; file_type?: string; id?: string }) => {
    if (!att || !att.file_url) return;
    setDocPreview({
      isOpen: true,
      fileUrl: att.file_url,
      fileName: att.file_name || 'Dokumen.pdf',
      fileSize: att.file_size,
      fileType: att.file_type || 'application/pdf',
      id: att.id
    });
  };

  const handleDownloadDocument = (att: { file_url?: string; file_name?: string; id?: string }, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const fileName = att.file_name || 'Dokumen.pdf';
    const link = document.createElement('a');
    link.href = att.id ? `/api/support/attachments/${att.id}?download=1&token=${token}` : (att.file_url || '#');
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [selectedProofOrder, setSelectedProofOrder] = useState<any | null>(null);
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

  useEffect(() => {
    if (!selectedTicket || !token || !canAccessSupport) {
      setActivePresences([]);
      return;
    }

    const sendPresence = async () => {
      try {
        await fetch(`/api/admin/support/tickets/${selectedTicket.id}/presence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ is_typing: replyText.trim().length > 0 })
        });
      } catch (err) {
        // Ignore network hiccups
      }
    };

    const fetchPresence = async () => {
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

    sendPresence();
    fetchPresence();
    const interval = setInterval(() => {
      sendPresence();
      fetchPresence();
    }, 12000);

    return () => clearInterval(interval);
  }, [selectedTicket?.id, token, canAccessSupport, replyText]);

  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info', target_role: 'all' });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
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
    } catch {}
  };

  const sendSupportNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/favicon.ico' });
        } catch {}
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, { body, icon: '/favicon.ico' });
            } catch {}
          }
        }).catch(() => {});
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
              `💬 ${incomingTitle}: ${incomingTicketNum}`,
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

        // Auto-update thread chat jika tiket yang sedang dibuka menerima balasan baru
        if (selectedTicket) {
          const activeUpdated = mappedData.find((t: any) => t.id === selectedTicket.id || String(t.id) === String(selectedTicket.id));
          if (activeUpdated && Array.isArray(activeUpdated.messages) && activeUpdated.messages.length !== (selectedTicket.messages?.length || 0)) {
            setSelectedTicket((prev: any) => {
              if (!prev) return null;
              const mergedMsgs = activeUpdated.messages.map((m: any) => {
                const existing = prev.messages?.find((em: any) => em.id === m.id);
                if (existing?.attachments?.length && (!m.attachments || m.attachments.length === 0)) {
                  return { ...m, attachments: existing.attachments };
                }
                return m;
              });
              return { ...prev, ...activeUpdated, messages: mergedMsgs };
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

  // Re-fetch tickets server-side whenever active filters or debounced search query change
  useEffect(() => {
    if (canAccessSupport && token) {
      fetchTickets(1, false);
    }
  }, [token, canAccessSupport, ticketsFilter, ticketCategoryFilter, ticketPriorityFilter, resolvedTimeRangeFilter, debouncedTicketSearch]);

  // Polling berkala setiap 10 detik di mobile saat tab support aktif
  useEffect(() => {
    if (!token || !canAccessSupport) return;
    const interval = setInterval(() => {
      fetchTickets(1, false);
    }, activeView === 'support' ? 10000 : 25000);
    return () => clearInterval(interval);
  }, [token, canAccessSupport, activeView, ticketsFilter, ticketCategoryFilter, ticketPriorityFilter, resolvedTimeRangeFilter, debouncedTicketSearch]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (canAccessCompliance) {
        const res = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setReports(Array.isArray(d) ? d : d.data || []);
        }
        const dormRes = await fetch('/api/admin/dormancy/metrics', { headers: { Authorization: `Bearer ${token}` } });
        if (dormRes.ok) {
          const dormData = await dormRes.json();
          setDormancyMetrics(dormData);
        }
      }
      if (canAccessSupport) {
        fetchTickets(1, false);
      }
      if (canAccessFinance) {
        const res = await fetch('/api/admin/subscription/orders', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setOrders(Array.isArray(d) ? d : d.data || d.orders || []);
        }
      }
      if (canAccessBroadcast) {
        const broadRes = await fetch('/api/admin/notifications', { headers: { Authorization: `Bearer ${token}` } });
        if (broadRes.ok) {
          const d = await broadRes.json();
          setBroadcasts(Array.isArray(d) ? d : d.data || []);
        }
      }
      if (canAccessMonetization) {
        const setRes = await fetch('/api/settings');
        if (setRes.ok) {
          const setData = await setRes.json();
          if (setData.data) {
            setGoogleSettings(prev => ({
              ...prev,
              ...setData.data,
            }));
          }
        }
      }
      if (canAccessAudit) {
        const auditRes = await fetch('/api/admin/audit-logs?limit=20', { headers: { Authorization: `Bearer ${token}` } });
        if (auditRes.ok) {
          const aData = await auditRes.json();
          setAuditLogs(Array.isArray(aData.data) ? aData.data : []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Synchronize URL on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = (searchParams.get('tab') || searchParams.get('view') || searchParams.get('division') || '').toLowerCase();
        const ticketParam = searchParams.get('ticket') || searchParams.get('ticket_id');

        if (tabParam) {
          if (['dashboard', 'rbac', 'stores', 'reports', 'support', 'finance', 'monetization', 'broadcast', 'audit'].includes(tabParam)) {
            setActiveView(tabParam as ActiveView);
          } else if (['overview', 'home'].includes(tabParam)) {
            setActiveView('dashboard');
          } else if (['help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) {
            setActiveView('support');
          } else if (['compliance', 'laporan'].includes(tabParam)) {
            setActiveView('reports');
          } else if (['keuangan', 'billing', 'orders'].includes(tabParam)) {
            setActiveView('finance');
          } else if (['iklan', 'ads', 'google'].includes(tabParam)) {
            setActiveView('monetization');
          } else if (['siaran', 'notifikasi'].includes(tabParam)) {
            setActiveView('broadcast');
          }
        }

        if (!ticketParam) {
          setSelectedTicket(null);
        }
      } catch (err) {
        console.error('Error handling mobile popstate:', err);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Deep-link direct ticket opener when tickets are loaded or direct URL access
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const ticketParam = searchParams.get('ticket') || searchParams.get('ticket_id');

    if (ticketParam && !selectedTicket && canAccessSupport && token) {
      const cleanParam = String(ticketParam).trim().toLowerCase();
      const foundInList = tickets.find(
        t => String(t.id).toLowerCase() === cleanParam ||
             (t.ticket_number && t.ticket_number.toLowerCase() === cleanParam) ||
             (`#TCK-${t.id}`).toLowerCase() === cleanParam
      );

      if (foundInList) {
        handleOpenTicketChat(foundInList, false);
      } else {
        fetch(`/api/admin/support/tickets/${ticketParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(d => {
            if (d.data) {
              const ticketObj = d.data.ticket || d.data;
              const messagesList = d.data.messages || ticketObj.messages || [];
              setSelectedTicket({
                ...ticketObj,
                messages: messagesList
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [tickets, token]);

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
            if (!currentMsgs.some((m: any) => m.id === createdMsg.id)) {
              return { ...prev, messages: [...currentMsgs, createdMsg] };
            }
            return prev;
          });
        }

        if (shouldResolve) {
          await handleUpdateTicketStatus(targetTicketId, 'resolved');
        } else {
          // If public reply, optimistically update status to waiting_user (Zendesk / Intercom Best Practice)
          if (!isInternalNote && selectedTicket?.status !== 'resolved' && selectedTicket?.status !== 'closed') {
            setSelectedTicket((prev: any) => prev ? { ...prev, status: 'waiting_user' } : null);
          }
          // Re-fetch conversation without clearing UI state
          handleOpenTicketChat(selectedTicket, false);
        }
        loadData();
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
        const res = await fetch('/api/storage/upload?category=support', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          uploaded.push({
            file_url: data.url,
            storage_key: data.storage_key || '',
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || 'image/jpeg'
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
      }
    } catch {
      showToast('Gagal memperbarui tiket', 'error');
    }
  };

  // Compliance Status Update
  const handleUpdateReportStatus = async (reportId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Laporan #${reportId} ditandai ${status.toUpperCase()}`, 'success');
        loadData();
        setSelectedReport(null);
      } else {
        showToast('Gagal memperbarui status laporan', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan', 'error');
    }
  };

  // Finance Order Status Update
  const handleUpdateOrderStatus = async (orderId: number, status: 'active' | 'rejected') => {
    try {
      const res = await fetch(`/api/admin/subscription/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(status === 'active' ? 'Paket langganan berhasil diaktifkan' : 'Pesanan ditandai ditolak', 'success');
        loadData();
        setSelectedProofOrder(null);
      } else {
        showToast('Gagal memproses pesanan', 'error');
      }
    } catch {
      showToast('Kesalahan server', 'error');
    }
  };

  // Broadcast Submit
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcastForm)
      });
      if (res.ok) {
        showToast('Siaran notifikasi berhasil disebarkan', 'success');
        setShowBroadcastSheet(false);
        setBroadcastForm({ title: '', message: '', type: 'info', target_role: 'all' });
        loadData();
      } else {
        showToast('Gagal mengirim siaran', 'error');
      }
    } catch {
      showToast('Gagal mengirim siaran', 'error');
    }
  };

  // Save Google AdSense & Analytics Settings
  const handleSaveGoogleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(googleSettings),
      });
      if (res.ok) {
        showToast('Pengaturan Google AdSense & Analytics berhasil disimpan!', 'success');
        loadData();
      } else {
        showToast('Gagal menyimpan pengaturan Google', 'error');
      }
    } catch {
      showToast('Kesalahan jaringan saat menyimpan', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const actionRequiredTicketsCount = ticketsMetrics.action_required ?? tickets.filter(t => (t.status === 'open' || t.status === 'waiting_agent')).length;
  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const unreadTicketsCount = tickets.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0)).length;
  const inProgressTicketsCount = ticketsMetrics.in_progress ?? tickets.filter(t => t.status === 'in_progress').length;
  const waitingUserTicketsCount = ticketsMetrics.waiting_user ?? tickets.filter(t => t.status === 'waiting_user').length;
  const urgentTicketsCount = ticketsMetrics.urgent ?? tickets.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedTicketsCount = ticketsMetrics.resolved ?? tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const totalTicketsCount = ticketsMetrics.total ?? tickets.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const totalAlertsCount = pendingReportsCount + actionRequiredTicketsCount + pendingOrdersCount + (dormancyMetrics?.dormant_stores || 0);

  // Auto-scroll chat stream to bottom when ticket is opened or new messages arrive
  useEffect(() => {
    if (selectedTicket) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
    broadcast: { title: 'Siaran Broadcast', subtitle: `${broadcasts.length} Siaran Aktif` },
    audit: { title: 'Audit Trail', subtitle: `${auditLogs.length} Log Aktivitas` },
  };

  // 5 Specialized Platform & System Management Modules on Dashboard Grid
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
      badge: unreadTicketsCount > 0 ? unreadTicketsCount : (actionRequiredTicketsCount > 0 ? actionRequiredTicketsCount : openTicketsCount),
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
    (activeView === 'support' && Boolean(selectedTicket)) ||
    (activeView === 'finance' && Boolean(selectedProofOrder));

  return (
    <div
      className={`catavor-platform-portal ${isDark ? 'portal-dark' : 'portal-light'}`}
      data-portal-theme={isDark ? 'dark' : 'light'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        width: '100%',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        padding: (activeView === 'support' && selectedTicket)
          ? `0.5rem 0.85rem calc(${selectedTicket.status === 'closed' ? '70px' : '160px'} + 1rem + env(safe-area-inset-bottom, 0px)) 0.85rem`
          : isSubPage
            ? '0.5rem 0.85rem 2rem 0.85rem'
            : '0.5rem 0.85rem 5.5rem 0.85rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        minHeight: '100vh',
        boxSizing: 'border-box'
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
          padding: '0.65rem 1.2rem',
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
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.25s ease-out'
        }}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={15} /> : toastMsg.type === 'error' ? <AlertTriangle size={15} /> : <AlertCircle size={15} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE MASTER HEADER (When on Dashboard Menu)                       */}
      {/* ========================================================================= */}
      {activeView === 'dashboard' && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 999,
          boxSizing: 'border-box',
          width: isScrolled ? 'calc(100% + 1.7rem)' : '100%',
          marginLeft: isScrolled ? '-0.85rem' : '0',
          marginRight: isScrolled ? '-0.85rem' : '0',
          marginTop: 0,
          marginBottom: 0,
          borderRadius: isScrolled ? '0 0 1.15rem 1.15rem' : '1.25rem',
          backgroundColor: isDark 
            ? (isScrolled ? 'rgba(15, 23, 42, 0.94)' : '#0f172a') 
            : (isScrolled ? 'rgba(255, 255, 255, 0.94)' : '#ffffff'),
          borderTop: isScrolled ? 'none' : `1px solid ${theme.border}`,
          borderLeft: isScrolled ? 'none' : `1px solid ${theme.border}`,
          borderRight: isScrolled ? 'none' : `1px solid ${theme.border}`,
          borderBottom: `1px solid ${isScrolled ? (isDark ? 'rgba(56, 189, 248, 0.35)' : '#cbd5e1') : theme.border}`,
          padding: isScrolled ? '0.62rem 0.85rem' : '0.72rem 0.85rem',
          boxShadow: isScrolled 
            ? (isDark ? '0 14px 35px rgba(0, 0, 0, 0.65), 0 0 18px rgba(56, 189, 248, 0.18)' : '0 10px 25px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0,0,0,0.04)')
            : theme.shadow,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Left Side: Avatar & Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
            {/* Brand Logo with Live Online Dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: isScrolled ? '34px' : '38px',
                height: isScrolled ? '34px' : '38px',
                borderRadius: isScrolled ? '0.75rem' : '0.85rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '3px',
                boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.25s ease'
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
                width: isScrolled ? '9px' : '10px',
                height: isScrolled ? '9px' : '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: `2px solid ${theme.surface}`,
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
              }} />
            </div>

            {/* Identity Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
                <h2 style={{
                  fontSize: isScrolled ? '0.84rem' : '0.9rem',
                  fontWeight: 800,
                  margin: 0,
                  color: theme.textPrimary,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  Catavor Executive
                </h2>
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

              {!isScrolled && (
                <span style={{
                  fontSize: '0.66rem',
                  color: theme.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px'
                }}>
                  {currentUser?.email || 'admin@catavor.com'}
                </span>
              )}
            </div>
          </div>

          {/* Right Side: Options Menu Button [ ⋮ ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowOptionsMenu(true)}
              title="Menu Opsi Eksekutif"
              style={{
                width: '34px',
                height: '34px',
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
        </div>
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
          activeView === 'broadcast' ? `${broadcasts.length} Siaran Aktif` :
          activeView === 'audit' ? `${auditLogs.length} Log Aktivitas` :
          currentItem?.subtitle || '';

        return (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 999,
            boxSizing: 'border-box',
            width: isScrolled ? 'calc(100% + 1.7rem)' : '100%',
            marginLeft: isScrolled ? '-0.85rem' : '0',
            marginRight: isScrolled ? '-0.85rem' : '0',
            marginTop: 0,
            marginBottom: 0,
            borderRadius: isScrolled ? '0 0 1.15rem 1.15rem' : '1.2rem',
            backgroundColor: isDark 
              ? (isScrolled ? 'rgba(15, 23, 42, 0.94)' : '#0f172a') 
              : (isScrolled ? 'rgba(255, 255, 255, 0.94)' : '#ffffff'),
            borderTop: isScrolled ? 'none' : `1px solid ${theme.border}`,
            borderLeft: isScrolled ? 'none' : `1px solid ${theme.border}`,
            borderRight: isScrolled ? 'none' : `1px solid ${theme.border}`,
            borderBottom: `1px solid ${isScrolled ? (isDark ? 'rgba(56, 189, 248, 0.35)' : '#cbd5e1') : theme.border}`,
            padding: isScrolled ? '0.62rem 0.85rem' : '0.65rem 0.75rem',
            boxShadow: isScrolled 
              ? (isDark ? '0 14px 35px rgba(0, 0, 0, 0.65), 0 0 18px rgba(56, 189, 248, 0.18)' : '0 10px 25px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0,0,0,0.04)')
              : theme.shadow,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Left Side: Brand Logo for Footer Tabs OR Pure Icon Back Button for Secondary Modules / Ticket Detail */}
            {(isFooterTab && !(activeView === 'support' && selectedTicket)) ? (
              <div style={{
                width: isScrolled ? '34px' : '38px',
                height: isScrolled ? '34px' : '38px',
                borderRadius: isScrolled ? '0.75rem' : '0.85rem',
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
                  if (activeView === 'support' && selectedTicket) {
                    handleCloseTicketChat();
                  } else {
                    handleSwitchView('dashboard');
                  }
                }}
                title={activeView === 'support' && selectedTicket ? "Kembali ke Daftar Tiket" : "Kembali ke Dashboard"}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                  border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.2)'}`,
                  color: isDark ? '#38bdf8' : '#0284c7',
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
              <h3 style={{
                fontSize: '0.92rem',
                fontWeight: 800,
                margin: 0,
                color: theme.textPrimary,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {activeView === 'support' && selectedTicket 
                  ? (selectedTicket.subject || 'Detail Tiket') 
                  : (currentItem?.title || 'Panel Modul')}
              </h3>
              <span style={{
                fontSize: '0.67rem',
                color: theme.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 600
              }}>
                {activeView === 'support' && selectedTicket
                  ? `${selectedTicket.ticket_number || ('#TCK-' + selectedTicket.id)} • ${getMerchantDisplayName(selectedTicket)}`
                  : subStatusText}
              </span>
            </div>

            {/* Right: Contextual Quick Actions + Options Menu Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              {/* Contextual Action for Broadcast: + Siaran */}
              {activeView === 'broadcast' && (
                <button
                  onClick={() => setShowBroadcastSheet(true)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#f59e0b',
                    color: '#000000',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    flexShrink: 0
                  }}
                >
                  <Plus size={13} />
                  <span>Siaran</span>
                </button>
              )}

              {/* Options Menu Button [ ⋮ ] */}
              <button
                type="button"
                onClick={() => setShowOptionsMenu(true)}
                title="Menu Opsi Eksekutif"
                style={{
                  width: '34px',
                  height: '34px',
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
          </div>
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
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
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

            {/* Menu Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* 1. Toggle Theme Mode */}
              <button
                onClick={() => {
                  toggleTheme();
                  setShowOptionsMenu(false);
                  showToast(`Tema dialihkan ke mode ${isDark ? 'terang' : 'gelap'}`, 'info');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.95rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.75rem',
                    backgroundColor: isDark ? 'rgba(250, 204, 21, 0.15)' : 'rgba(250, 204, 21, 0.1)',
                    color: isDark ? '#facc15' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>
                      {isDark ? 'Mode Terang (Light Mode)' : 'Mode Gelap (Dark Mode)'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                      Ubah tampilan visual panel admin
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8' }}>Ganti</span>
              </button>

              {/* 2. Refresh Data Platform */}
              <button
                onClick={() => {
                  loadData();
                  setShowOptionsMenu(false);
                  showToast('Data platform berhasil diperbarui', 'success');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.95rem',
                  backgroundColor: theme.cardAlt,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <RefreshCw size={19} className={loading ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>Segarkan Data Platform</div>
                    <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                      Sinkronisasi data metrik, tiket & pesanan
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>Segarkan</span>
              </button>


              {/* 4. Logout Action */}
              {onLogout && (
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onLogout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.95rem',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <LogOut size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ef4444' }}>Keluar Akun Admin</div>
                      <div style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                        Akhiri sesi pengelolaan platform
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>Keluar</span>
                </button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
            <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.25rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Toko</span>
              <strong style={{ fontSize: '1.1rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900 }}>{dormancyMetrics?.active_stores || 1}</strong>
            </div>
            <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.25rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Order</span>
              <strong style={{ fontSize: '1.1rem', color: isDark ? '#34d399' : '#059669', fontWeight: 900 }}>{orders.length}</strong>
            </div>
            <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.25rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Laporan</span>
              <strong style={{ fontSize: '1.1rem', color: pendingReportsCount > 0 ? '#f43f5e' : (isDark ? '#fbbf24' : '#d97706'), fontWeight: 900 }}>{reports.length}</strong>
            </div>
            <div style={{ backgroundColor: theme.surface, padding: '0.7rem 0.25rem', borderRadius: '0.85rem', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <span style={{ fontSize: '0.64rem', color: theme.textSecondary, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.2rem' }}>Tiket</span>
              <strong style={{ fontSize: '1.1rem', color: openTicketsCount > 0 ? '#06b6d4' : theme.textPrimary, fontWeight: 900 }}>{tickets.length}</strong>
            </div>
          </div>

          {/* Interactive Action Alerts */}
          {(pendingReportsCount > 0 || openTicketsCount > 0 || pendingOrdersCount > 0) && (
            <div style={{
              padding: '0.95rem 1.1rem',
              borderRadius: '1.15rem',
              backgroundColor: isDark ? 'rgba(244, 63, 94, 0.1)' : 'rgba(244, 63, 94, 0.08)',
              border: isDark ? '1px solid rgba(244, 63, 94, 0.28)' : '1px solid rgba(244, 63, 94, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <AlertTriangle size={16} color="#f43f5e" />
                <strong style={{ fontSize: '0.82rem', color: isDark ? '#fb7185' : '#e11d48' }}>Perlu Tindakan Administrator:</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {pendingReportsCount > 0 && (
                  <button
                    onClick={() => handleSwitchView('reports')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: theme.textPrimary
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>&bull; {pendingReportsCount} laporan pelanggaran baru menunggu review</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f43f5e', textDecoration: 'underline' }}>Periksa</span>
                  </button>
                )}
                {openTicketsCount > 0 && (
                  <button
                    onClick={() => handleSwitchView('support')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: theme.textPrimary
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>&bull; {openTicketsCount} tiket helpdesk merchant belum dibalas</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#06b6d4', textDecoration: 'underline' }}>Buka</span>
                  </button>
                )}
                {pendingOrdersCount > 0 && (
                  <button
                    onClick={() => handleSwitchView('finance')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: theme.textPrimary
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>&bull; {pendingOrdersCount} pesanan paket Pro menunggu verifikasi bukti</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', textDecoration: 'underline' }}>Verifikasi</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section Heading: Platform & System Management */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.15rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                Kelola Platform & Sistem
              </h3>
              <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Konfigurasi lanjutan dan tata kelola platform</span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: theme.textSecondary,
              backgroundColor: theme.cardAlt,
              border: `1px solid ${theme.border}`,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px'
            }}>
              {dashboardGridItems.length} Modul
            </span>
          </div>

          {/* 2-Column Specialized Management Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem'
          }}>
            {dashboardGridItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSwitchView(item.id)}
                style={{
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
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Top of Card: Icon & Badge/Chevron */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                <div>
                  <div style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: theme.textPrimary,
                    marginBottom: '0.15rem',
                    lineHeight: 1.25
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

      {/* ========================================================================= */}
      {/* 4. MODULE 1: STAF & RBAC MANAGEMENT                                       */}
      {/* ========================================================================= */}
      {activeView === 'rbac' && canAccessRBAC && (
        <AdminRBACManagement
          token={token}
          currentUserEmail={currentUser?.email}
          themeMode={themeMode}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 2: TATA KELOLA TOKO & DORMANSI                                  */}
      {/* ========================================================================= */}
      {activeView === 'stores' && canAccessCompliance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <div style={{ padding: '1rem', borderRadius: '1rem', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
            <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
              Metrik Dormansi Toko
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
              <div style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'block', marginBottom: '0.15rem' }}>Toko Aktif</span>
                <strong style={{ fontSize: '1.05rem', color: isDark ? '#34d399' : '#059669', fontWeight: 900 }}>{dormancyMetrics?.active_stores || 1}</strong>
              </div>
              <div style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.25)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'block', marginBottom: '0.15rem' }}>Dorman</span>
                <strong style={{ fontSize: '1.05rem', color: isDark ? '#fbbf24' : '#d97706', fontWeight: 900 }}>{dormancyMetrics?.dormant_stores || 0}</strong>
              </div>
              <div style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'block', marginBottom: '0.15rem' }}>Ditangguhkan</span>
                <strong style={{ fontSize: '1.05rem', color: isDark ? '#f87171' : '#dc2626', fontWeight: 900 }}>{dormancyMetrics?.suspended_stores || 0}</strong>
              </div>
            </div>
          </div>

          <div style={{ padding: '0.95rem 1rem', borderRadius: '0.95rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.55 }}>
            Kebijakan dormansi otomatis mengarsipkan katalog toko yang tidak aktif lebih dari 45 hari untuk menjaga kualitas pencarian ekosistem Catavor.
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 3: LAPORAN PELANGGARAN                                          */}
      {/* ========================================================================= */}
      {activeView === 'reports' && canAccessCompliance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {(['all', 'pending', 'investigating', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setReportsFilter(f)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: reportsFilter === f ? '#f43f5e' : theme.chipInactiveBg,
                  color: reportsFilter === f ? '#ffffff' : theme.chipInactiveText,
                  border: `1px solid ${reportsFilter === f ? '#f43f5e' : theme.border}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'investigating' ? 'Investigasi' : 'Selesai'}
              </button>
            ))}
          </div>

          {/* Reports Feed */}
          {reports
            .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
            .length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <ShieldCheck size={36} color="#10b981" style={{ margin: '0 auto 0.65rem' }} />
              <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Laporan</h4>
              <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>Seluruh toko mematuhi aturan platform.</p>
            </div>
          ) : (
            reports
              .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
              .map(r => (
                <div
                  key={r.id}
                  style={{
                    padding: '1.05rem',
                    borderRadius: '1.15rem',
                    backgroundColor: theme.surface,
                    border: r.status === 'pending' ? '1px solid rgba(244, 63, 94, 0.4)' : `1px solid ${theme.border}`,
                    boxShadow: theme.cardShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: r.reason === 'fraud' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: r.reason === 'fraud' ? '#f87171' : (isDark ? '#fbbf24' : '#d97706'),
                      border: r.reason === 'fraud' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {r.reason ? r.reason.toUpperCase() : 'PELANGGARAN'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : 'Baru'}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                      {r.store_name ? `Toko: ${r.store_name}` : `Item #${r.item_id || 'Umum'}`}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.5, backgroundColor: theme.quoteBg, padding: '0.55rem 0.75rem', borderRadius: '0.65rem' }}>
                      "{r.notes || r.description || 'Tidak ada catatan pelapor.'}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                      Pelapor: {r.reporter_email || 'Anonim'}
                    </span>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateReportStatus(r.id, 'investigating')}
                          style={{
                            padding: '0.4rem 0.7rem',
                            borderRadius: '0.6rem',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: isDark ? '#fbbf24' : '#d97706',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Investigasi
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateReportStatus(r.id, 'resolved')}
                        style={{
                          padding: '0.4rem 0.7rem',
                          borderRadius: '0.6rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: isDark ? '#34d399' : '#059669',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Selesaikan
                      </button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 4: HELPDESK & TIKET BANTUAN                                     */}
      {/* ========================================================================= */}
      {activeView === 'support' && canAccessSupport && (
        selectedTicket ? (
          /* ----------------------------------------------------------------------- */
          /* 4A. TICKET CONVERSATION CHAT ROOM (DETAIL THREAD PERCAKAPAN)             */
          /* ----------------------------------------------------------------------- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Agent Collision Warning Banner (Fase 5) */}
            {activePresences.filter((p: any) => p.user_id !== currentUser?.id).length > 0 && (
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
                    👀 <strong>{activePresences.filter((p: any) => p.user_id !== currentUser?.id).map((p: any) => p.admin_name).join(', ')}</strong> juga sedang membuka tiket ini
                    {activePresences.filter((p: any) => p.user_id !== currentUser?.id).some((p: any) => p.is_typing) ? ' dan sedang mengetik balasan...' : '.'}
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
                {/* Merchant Identity Chip */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: '0.67rem',
                  fontWeight: 700
                }}>
                  <Store size={12} />
                  <span>{getMerchantDisplayName(selectedTicket)}</span>
                  {(selectedTicket.user?.email || selectedTicket.user_email) && (
                    <span style={{ opacity: 0.75, fontWeight: 500, fontSize: '0.62rem' }}>
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
                      onClick={() => setShowFooterStatusMenu(true)}
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
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Klik untuk ubah status pengerjaan tiket"
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
                    {selectedTicket.sla_breached ? '⚠️ Melewati SLA' : (selectedTicket.first_response_at ? '✓ Terpenuhi Tepat Waktu' : 'Sedang Berjalan')}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isDark ? '#fbbf24' : '#d97706', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Lock size={12} /> CATATAN INTERNAL CS (Hanya Terlihat Oleh Tim Admin)
                              </span>
                              <span style={{ fontSize: '0.62rem', color: theme.textMuted, fontWeight: 600 }}>
                                {formatSupportDateTime(msg.created_at)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600 }}>
                              Oleh: {msg.sender?.name || 'Staf Admin'}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                              {msg.message}
                            </p>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  {isAgent ? (
                                    <ShieldCheck size={13} color="#06b6d4" />
                                  ) : (
                                    <Store size={13} color={isDark ? '#38bdf8' : '#0284c7'} />
                                  )}
                                  <strong style={{ fontSize: '0.74rem', color: isAgent ? '#06b6d4' : (isDark ? '#38bdf8' : '#0284c7'), fontWeight: 800 }}>
                                    {isAgent ? (msg.sender?.name || 'Catavor Support (Staf)') : getFirstName(merchantName)}
                                  </strong>
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

                              {/* Attached Images / Screenshots Gallery */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div style={{ 
                                  marginTop: msg.message ? '0.65rem' : '0.2rem', 
                                  paddingTop: msg.message ? '0.5rem' : '0', 
                                  borderTop: msg.message ? `1px solid ${theme.border}` : 'none' 
                                }}>
                                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Paperclip size={11} color={isAgent ? '#06b6d4' : '#38bdf8'} /> {msg.attachments.length} Lampiran File:
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.4rem' }}>
                                    {msg.attachments.map((att: any, aIdx: number) => {
                                      const isPDF = att.file_type === 'application/pdf' || att.file_name?.toLowerCase().endsWith('.pdf') || att.file_url?.toLowerCase().endsWith('.pdf');
                                      if (isPDF) {
                                        return (
                                          <div
                                            key={aIdx}
                                            onClick={() => openDocumentPreview(att)}
                                            style={{
                                              gridColumn: '1 / -1',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.45rem',
                                              padding: '0.45rem 0.65rem',
                                              borderRadius: '0.55rem',
                                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                              border: `1px solid ${theme.border}`,
                                              textDecoration: 'none',
                                              color: theme.textPrimary,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              transition: 'all 0.15s ease'
                                            }}
                                            title="Pratinjau Dokumen PDF"
                                          >
                                            <div style={{
                                              width: '30px',
                                              height: '30px',
                                              borderRadius: '0.4rem',
                                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0
                                            }}>
                                              <FileText size={17} color="#ef4444" />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                                {att.file_name || 'Dokumen.pdf'}
                                              </div>
                                              <div style={{ fontSize: '0.62rem', color: theme.textMuted }}>
                                                PDF {att.file_size ? `• ${(att.file_size / 1024).toFixed(0)} KB` : ''} • Klik untuk pratinjau
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                              <button
                                                type="button"
                                                onClick={(e) => handleDownloadDocument(att, e)}
                                                style={{
                                                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                                  border: `1px solid ${theme.border}`,
                                                  borderRadius: '0.35rem',
                                                  padding: '0.25rem 0.35rem',
                                                  color: theme.textSecondary,
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}
                                                title="Unduh PDF langsung"
                                              >
                                                <Download size={13} />
                                              </button>
                                              <div
                                                style={{
                                                  background: 'var(--primary, #0284c7)',
                                                  borderRadius: '0.35rem',
                                                  padding: '0.25rem 0.35rem',
                                                  color: '#ffffff',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}
                                                title="Pratinjau Dokumen"
                                              >
                                                <Eye size={13} />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div
                                          key={aIdx}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => openAttachmentLightbox(msg.attachments, aIdx)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              openAttachmentLightbox(msg.attachments, aIdx);
                                            }
                                          }}
                                          style={{
                                            position: 'relative',
                                            borderRadius: '0.5rem',
                                            overflow: 'hidden',
                                            border: `1px solid ${theme.border}`,
                                            aspectRatio: '1',
                                            cursor: 'pointer',
                                            backgroundColor: '#000000'
                                          }}
                                          title="Perbesar gambar"
                                        >
                                          <img
                                            src={att.file_url}
                                            alt={att.file_name || 'Attachment'}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                          <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '2px 4px',
                                            backgroundColor: 'rgba(0,0,0,0.7)',
                                            fontSize: '0.55rem',
                                            color: '#ffffff',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                          }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name || `Foto ${aIdx+1}`}</span>
                                            <ZoomIn size={10} />
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
                padding: '0.15rem 0.15rem 0.35rem',
                gap: '0.6rem'
              }}>
                {/* Left: Premium Interactive Ticket Status Pill */}
                {(() => {
                  const statusMeta = getTicketStatusMeta(selectedTicket.status);
                  return (
                    <button
                      type="button"
                      onClick={() => setShowFooterStatusMenu(true)}
                      style={{
                        height: '36px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0 0.85rem',
                        borderRadius: '999px',
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1.5px solid ${statusMeta.border}`,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      title="Ubah Status Pengerjaan Tiket"
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: statusMeta.color,
                        display: 'inline-block',
                        boxShadow: `0 0 6px ${statusMeta.color}88`,
                        flexShrink: 0
                      }} />
                      <span style={{ whiteSpace: 'nowrap' }}>
                        Status: <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>{statusMeta.shortLabel}</span>
                      </span>
                      <ChevronDown size={13} strokeWidth={2.5} style={{ opacity: 0.8 }} />
                    </button>
                  );
                })()}

                {/* Right: Premium Quick Reply Canned Response Templates Pill */}
                <button
                  type="button"
                  onClick={() => {
                    fetchCannedTemplates();
                    setShowTemplateModal(true);
                  }}
                  style={{
                    height: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0 0.85rem',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                    color: isDark ? '#38bdf8' : '#0284c7',
                    border: `1.5px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.22)'}`,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  title="Gunakan Template Balasan Cepat (Canned Responses)"
                >
                  <Zap size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
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
                    width: '32px',
                    height: '32px',
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
                    width: '36px',
                    height: '36px',
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
            </div>
          )}
        </div>
      ) : (
          /* ----------------------------------------------------------------------- */
          /* 4B. SUPPORT SUB-VIEWS: TICKET QUEUE LIST & MASTER CANNED RESPONSES       */
          /* ----------------------------------------------------------------------- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Top Sub-Navigation Pill Switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              padding: '0.25rem',
              borderRadius: '0.85rem',
              border: `1px solid ${theme.border}`,
              gap: '0.3rem'
            }}>
              <button
                type="button"
                onClick={() => {
                  setSupportSubView('tickets');
                  updatePlatformUrl('support', null, null);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.6rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: supportSubView === 'tickets' ? 'var(--primary, #10b981)' : 'transparent',
                  color: supportSubView === 'tickets' ? '#ffffff' : theme.textSecondary,
                  transition: 'all 0.15s ease'
                }}
              >
                <MessageSquare size={13} />
                <span>Antrean Tiket</span>
                <span style={{
                  fontSize: '0.62rem',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '999px',
                  backgroundColor: supportSubView === 'tickets' ? 'rgba(255, 255, 255, 0.25)' : theme.cardAlt,
                  color: supportSubView === 'tickets' ? '#ffffff' : theme.textMuted
                }}>
                  {ticketsMetrics.total || tickets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSupportSubView('templates');
                  updatePlatformUrl('support', null, 'templates');
                  fetchCannedTemplates(true);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.6rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: supportSubView === 'templates' ? (isDark ? '#38bdf8' : '#0284c7') : 'transparent',
                  color: supportSubView === 'templates' ? '#ffffff' : theme.textSecondary,
                  transition: 'all 0.15s ease'
                }}
              >
                <Zap size={13} />
                <span>Master Template</span>
              </button>
            </div>

            {/* VIEW 1: TICKETS QUEUE */}
            {supportSubView === 'tickets' && (
              <>
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

            {/* 2. Unified Triage Tabs Bar (Single Source of Truth) */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
              {[
                { id: 'all', label: 'Semua', count: totalTicketsCount, color: 'var(--primary)', isPriority: false },
                { id: 'action_required', label: 'Perlu Respon', count: actionRequiredTicketsCount, color: 'var(--primary)', isPriority: false },
                { id: 'in_progress', label: 'Diproses', count: inProgressTicketsCount, color: isDark ? '#fbbf24' : '#d97706', isPriority: false },
                { id: 'waiting_user', label: 'Tunggu Merchant', count: waitingUserTicketsCount, color: isDark ? '#c084fc' : '#9333ea', isPriority: false },
                { id: 'urgent', label: 'Urgent', count: urgentTicketsCount, color: '#ef4444', isPriority: true },
                { id: 'resolved', label: 'Selesai', count: resolvedTicketsCount, color: isDark ? '#34d399' : '#059669', isPriority: false }
              ].map(tab => {
                const isActive = tab.isPriority 
                  ? ticketPriorityFilter === 'urgent'
                  : (ticketsFilter === tab.id && ticketPriorityFilter !== 'urgent');

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.isPriority) {
                        setTicketPriorityFilter(ticketPriorityFilter === 'urgent' ? 'all' : 'urgent');
                        setTicketsFilter('all');
                      } else {
                        setTicketsFilter(tab.id as any);
                        setTicketPriorityFilter('all');
                      }
                    }}
                    style={{
                      padding: '0.36rem 0.65rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: isActive 
                        ? (tab.id === 'urgent' ? '#ef4444' : (tab.id === 'in_progress' ? '#f59e0b' : (tab.id === 'waiting_user' ? '#a855f7' : (tab.id === 'resolved' ? '#10b981' : 'var(--primary)')))) 
                        : theme.chipInactiveBg,
                      color: isActive ? (isDark && tab.id !== 'urgent' && tab.id !== 'waiting_user' && tab.id !== 'resolved' ? '#000000' : '#ffffff') : theme.textSecondary,
                      border: `1px solid ${isActive ? 'transparent' : theme.border}`,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 900,
                      padding: '0.08rem 0.35rem',
                      borderRadius: '999px',
                      backgroundColor: isActive ? 'rgba(0,0,0,0.25)' : theme.cardAlt,
                      color: isActive ? '#ffffff' : (tab.count > 0 && (tab.id === 'action_required' || tab.id === 'urgent') ? '#ef4444' : theme.textMuted),
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : theme.border}`
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3. Time-Windowing Selector Bar for Selesai / Resolved Tab */}
            {ticketsFilter === 'resolved' && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', padding: '0.2rem 0', overflowX: 'auto' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', marginRight: '0.15rem', whiteSpace: 'nowrap' }}>
                  Rentang Riwayat:
                </span>
                {[
                  { id: '30d', label: '30 Hari Terakhir' },
                  { id: '90d', label: '90 Hari Terakhir' },
                  { id: 'all', label: 'Semua Riwayat Selesai' }
                ].map(tr => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setResolvedTimeRangeFilter(tr.id as any)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: resolvedTimeRangeFilter === tr.id ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)') : theme.chipInactiveBg,
                      color: resolvedTimeRangeFilter === tr.id ? (isDark ? '#34d399' : '#059669') : theme.textMuted,
                      border: `1px solid ${resolvedTimeRangeFilter === tr.id ? '#10b981' : theme.border}`,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            )}

            {/* 4. Secondary Filter Row (Mobile Trigger for Bottom Sheet Modals & Reset) */}
            {(availableCategories.length > 1 || availablePriorities.length > 1 || (ticketsFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketSearchQuery)) && (
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Category Bottom Sheet Trigger (Only when > 1 category types exist) */}
                {availableCategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSearchQuery('');
                      setActiveFilterModal('category');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: ticketCategoryFilter !== 'all' ? 'var(--primary-glow)' : theme.surface,
                      border: `1px solid ${ticketCategoryFilter !== 'all' ? 'var(--primary)' : theme.border}`,
                      color: ticketCategoryFilter !== 'all' ? 'var(--primary)' : theme.textPrimary,
                      cursor: 'pointer',
                      boxShadow: theme.cardShadow,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Tag size={12} style={{ color: ticketCategoryFilter !== 'all' ? 'var(--primary)' : theme.textSecondary, flexShrink: 0 }} />
                    <span>{ticketCategoryFilter === 'all' ? 'Semua Kategori' : (CATEGORY_LABELS[ticketCategoryFilter] || ticketCategoryFilter)}</span>
                    <ChevronDown size={12} style={{ color: ticketCategoryFilter !== 'all' ? 'var(--primary)' : theme.textSecondary, flexShrink: 0 }} />
                  </button>
                )}

                {/* Priority Bottom Sheet Trigger (Only when > 1 priority types exist) */}
                {availablePriorities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSearchQuery('');
                      setActiveFilterModal('priority');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: ticketPriorityFilter !== 'all' ? (isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.1)') : theme.surface,
                      border: `1px solid ${ticketPriorityFilter !== 'all' ? '#ef4444' : theme.border}`,
                      color: ticketPriorityFilter !== 'all' ? '#ef4444' : theme.textPrimary,
                      cursor: 'pointer',
                      boxShadow: theme.cardShadow,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <AlertCircle size={12} style={{ color: ticketPriorityFilter !== 'all' ? '#ef4444' : theme.textSecondary, flexShrink: 0 }} />
                    <span>{ticketPriorityFilter === 'all' ? 'Semua Prioritas' : (PRIORITY_META[ticketPriorityFilter]?.label || ticketPriorityFilter)}</span>
                    <ChevronDown size={12} style={{ color: ticketPriorityFilter !== 'all' ? '#ef4444' : theme.textSecondary, flexShrink: 0 }} />
                  </button>
                )}

                {/* Active Filter Indicator & Reset Button */}
                {(ticketsFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketSearchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTicketsFilter('all');
                      setTicketCategoryFilter('all');
                      setTicketPriorityFilter('all');
                      setTicketSearchQuery('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.cardAlt,
                      border: `1px solid ${theme.border}`,
                      color: theme.textMuted,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
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
            )}

            {/* 5. Tickets Feed (Server-Side Filtered & Paginated with Load More) */}
            {ticketsLoading && tickets.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
                <RefreshCw size={26} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 0.65rem' }} />
                <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.78rem', fontWeight: 600 }}>
                  Memuat antrean tiket bantuan...
                </p>
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
                <Inbox size={36} color="#06b6d4" style={{ margin: '0 auto 0.65rem' }} />
                <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>
                  {ticketSearchQuery || ticketsFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all'
                    ? 'Tidak Ada Tiket yang Cocok'
                    : 'Semua Tiket Terselesaikan'}
                </h4>
                <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>
                  {ticketSearchQuery || ticketsFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all'
                    ? 'Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.'
                    : 'Tidak ada antrean tiket aktif saat ini.'}
                </p>
              </div>
            ) : (
              <>
                {sortedTickets.map(t => {
                  const statusBg = 
                    t.status === 'open' ? 'rgba(6, 182, 212, 0.15)' :
                    t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' :
                    t.status === 'waiting_user' ? 'rgba(168, 85, 247, 0.15)' :
                    t.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)';
                  const statusColor =
                    t.status === 'open' ? '#06b6d4' :
                    t.status === 'in_progress' ? (isDark ? '#fbbf24' : '#d97706') :
                    t.status === 'waiting_user' ? (isDark ? '#c084fc' : '#9333ea') :
                    t.status === 'resolved' ? (isDark ? '#34d399' : '#059669') : '#94a3b8';
                  const statusBorder =
                    t.status === 'open' ? 'rgba(6, 182, 212, 0.35)' :
                    t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.35)' :
                    t.status === 'waiting_user' ? 'rgba(168, 85, 247, 0.35)' :
                    t.status === 'resolved' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.35)';
                  const statusLabel =
                    t.status === 'open' ? 'Open (Baru)' :
                    t.status === 'in_progress' ? 'Sedang Diproses' :
                    t.status === 'waiting_user' ? 'Menunggu Merchant' :
                    t.status === 'resolved' ? 'Terselesaikan' :
                    t.status === 'closed' ? 'Ditutup' : String(t.status || 'OPEN').toUpperCase();

                  const storePlan = String(t.store?.plan || '').toLowerCase();
                  const storeDisplayName = t.store?.store_title || t.store?.name || t.store_name || t.user?.name || 'Merchant';
                  const messageCount = Array.isArray(t.messages) ? t.messages.length : (t.message_count || 0);
                  const msgs = Array.isArray(t.messages) ? t.messages : [];
                  const lastMsg = t.last_msg || (msgs.length > 0 ? msgs[msgs.length - 1] : null);
                  const isUnread = Boolean(t.has_unread || (t.unread_count && t.unread_count > 0));
                  const unreadCount = t.unread_count || 0;
                  const lastSenderName = lastMsg ? (lastMsg.sender_type === 'agent' ? 'CS Support' : getFirstName(getMerchantDisplayName(t, lastMsg.sender))) : '';

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenTicketChat(t)}
                      style={{
                        padding: '1rem',
                        borderRadius: '1.15rem',
                        backgroundColor: isUnread ? (isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.04)') : theme.surface,
                        border: isUnread
                          ? '1px solid rgba(6, 182, 212, 0.65)'
                          : (t.status === 'open' || t.status === 'waiting_agent') 
                            ? '1px solid rgba(6, 182, 212, 0.45)' 
                            : (t.priority === 'urgent' ? '1px solid rgba(239, 68, 68, 0.4)' : `1px solid ${theme.border}`),
                        boxShadow: isUnread ? '0 4px 18px rgba(6, 182, 212, 0.16)' : theme.cardShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Card Header: Ticket Number & Unread Dot on Left | Status Pill on Right (Single Row, Never Wraps) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          {/* Unread Glow Dot Indicator */}
                          {isUnread && (
                            <span 
                              title={unreadCount > 0 ? `${unreadCount} Pesan Baru` : 'Pesan Baru'}
                              style={{ 
                                display: 'inline-block', 
                                width: '7px', 
                                height: '7px', 
                                borderRadius: '50%', 
                                backgroundColor: '#06b6d4',
                                boxShadow: '0 0 8px rgba(6, 182, 212, 0.7)',
                                flexShrink: 0
                              }} 
                            />
                          )}

                          {/* Ticket Number */}
                          <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            backgroundColor: isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.08)', 
                            padding: '0.15rem 0.42rem', 
                            borderRadius: '0.35rem', 
                            border: '1px solid rgba(6, 182, 212, 0.22)',
                            flexShrink: 0
                          }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', fontFamily: 'monospace', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                              {t.ticket_number || `#TCK-${t.id}`}
                            </span>
                          </div>

                          {/* SLA Breached Alert (Only shown if critical/breached to prevent clutter) */}
                          {t.sla_breached && (
                            <span style={{ 
                              fontSize: '0.58rem', 
                              fontWeight: 800, 
                              padding: '0.1rem 0.35rem', 
                              borderRadius: '0.3rem', 
                              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                              color: '#ef4444', 
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              ⚠️ SLA Lewat
                            </span>
                          )}
                        </div>

                        {/* Status Pill with live indicator dot (Pinned Top-Right, No wrap) */}
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          backgroundColor: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusBorder}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} />
                          {statusLabel}
                        </span>
                      </div>

                      {/* Card Subject & Clean Metadata Row */}
                      <div>
                        <h4 style={{ 
                          margin: '0 0 0.3rem 0', 
                          fontSize: '0.92rem', 
                          fontWeight: isUnread ? 900 : 700, 
                          color: isUnread ? (isDark ? '#38bdf8' : '#0284c7') : theme.textPrimary, 
                          letterSpacing: '-0.01em', 
                          lineHeight: 1.35 
                        }}>
                          {t.subject || 'Pertanyaan Layanan Toko'}
                        </h4>

                        {/* Streamlined Meta Info (Category, Priority, Time) */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.45rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.66rem' }}>
                          <span style={{ 
                            fontWeight: 700, 
                            padding: '0.12rem 0.38rem', 
                            borderRadius: '4px', 
                            backgroundColor: theme.cardAlt, 
                            color: theme.textSecondary, 
                            border: `1px solid ${theme.border}`,
                            fontSize: '0.62rem'
                          }}>
                            {
                              t.category === 'billing' ? 'Keuangan & Langganan' :
                              t.category === 'technical' ? 'Kendala Teknis & Bug' :
                              t.category === 'catalog_help' ? 'Bantuan Katalog' :
                              t.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'
                            }
                          </span>

                          {t.priority && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '0.12rem 0.38rem',
                              borderRadius: '4px',
                              backgroundColor: (t.priority === 'urgent' || t.priority === 'high') ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)') : theme.cardAlt,
                              color: (t.priority === 'urgent' || t.priority === 'high') ? '#ef4444' : theme.textSecondary,
                              border: `1px solid ${(t.priority === 'urgent' || t.priority === 'high') ? 'rgba(239, 68, 68, 0.35)' : theme.border}`,
                              textTransform: 'uppercase'
                            }}>
                              {t.priority}
                            </span>
                          )}

                          {/* CSAT Rating if present */}
                          {t.rating && (
                            <span style={{ 
                              fontSize: '0.62rem', 
                              fontWeight: 800, 
                              color: '#f59e0b', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.15rem' 
                            }}>
                              <Star size={10} fill="#f59e0b" color="#f59e0b" />
                              <span>{t.rating}/5</span>
                            </span>
                          )}

                          {/* Time */}
                          <span style={{ fontSize: '0.63rem', color: isUnread ? theme.textPrimary : theme.textMuted, fontWeight: isUnread ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto' }}>
                            <Clock size={10} />
                            {formatSupportDateTime(t.last_message_at || t.created_at)}
                          </span>
                        </div>

                        {/* Snippet message */}
                        {lastMsg ? (
                          <p style={{
                            margin: 0,
                            fontSize: '0.76rem',
                            color: isUnread ? theme.textPrimary : theme.textSecondary,
                            fontWeight: isUnread ? 600 : 400,
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            <strong style={{ color: lastMsg.sender_type === 'user' ? '#06b6d4' : 'var(--primary)' }}>
                              {lastSenderName}:
                            </strong>{' '}
                            {lastMsg.message || (lastMsg.attachments?.length ? `[${lastMsg.attachments.length} Lampiran Bukti]` : '')}
                          </p>
                        ) : (t.messages && t.messages.length > 0 && (
                          <p style={{
                            margin: 0,
                            fontSize: '0.76rem',
                            color: theme.textSecondary,
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {t.messages[0]?.message}
                          </p>
                        ))}
                      </div>

                      {/* Card Footer: Merchant Identity & Plan Badge on Left | Messages Count on Right */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '0.55rem',
                        borderTop: `1px solid ${theme.border}`,
                        marginTop: '0.15rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1, marginRight: '0.5rem' }}>
                          <Store size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: theme.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {storeDisplayName}
                          </span>

                          {/* Store Tier Badge (Contextually placed next to Store Name) */}
                          {storePlan === 'enterprise' && (
                            <span style={{ fontSize: '0.58rem', fontWeight: 900, padding: '0.08rem 0.35rem', borderRadius: '0.3rem', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', flexShrink: 0 }}>
                              ENTERPRISE
                            </span>
                          )}
                          {storePlan === 'pro' && (
                            <span style={{ fontSize: '0.58rem', fontWeight: 900, padding: '0.08rem 0.35rem', borderRadius: '0.3rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', flexShrink: 0 }}>
                              PRO
                            </span>
                          )}
                        </div>

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.22rem 0.55rem',
                          borderRadius: '0.5rem',
                          backgroundColor: isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.08)',
                          border: '1px solid rgba(6, 182, 212, 0.25)',
                          color: '#06b6d4',
                          fontSize: '0.7rem',
                          fontWeight: 800
                        }}>
                          <MessageSquare size={11} />
                          <span>{messageCount} Pesan</span>
                          <ChevronRight size={12} />
                        </div>
                      </div>
                    </div>
                  );
                })}

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
              </>
            )}
          </>
        )}

        {/* VIEW 2: MASTER CANNED RESPONSES (PENGELOLAAN TEMPLATE) */}
        {supportSubView === 'templates' && (
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

              {/* Action Buttons Row & Category Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
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
                        padding: '0.3rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: templateCategoryFilter === cat.id ? 800 : 600,
                        backgroundColor: templateCategoryFilter === cat.id ? (isDark ? '#38bdf8' : '#0284c7') : theme.chipInactiveBg,
                        color: templateCategoryFilter === cat.id ? '#ffffff' : theme.chipInactiveText,
                        border: `1px solid ${templateCategoryFilter === cat.id ? (isDark ? '#38bdf8' : '#0284c7') : theme.border}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleResetDefaultTemplates}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.cardAlt,
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    title="Reset ke bawaan"
                  >
                    <RefreshCw size={12} />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCreateTemplate}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    <Plus size={13} />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Template Cards List */}
            {loadingTemplates ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: theme.textSecondary }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: isDark ? '#38bdf8' : '#0284c7' }} />
                <span style={{ fontSize: '0.8rem' }}>Memuat master template...</span>
              </div>
            ) : cannedTemplates.filter(t => {
              if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) return false;
              if (templateSearchQuery.trim()) {
                const q = templateSearchQuery.toLowerCase();
                return t.title?.toLowerCase().includes(q) || t.shortcut?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
              }
              return true;
            }).length === 0 ? (
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
                {cannedTemplates
                  .filter(t => {
                    if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) return false;
                    if (templateSearchQuery.trim()) {
                      const q = templateSearchQuery.toLowerCase();
                      return t.title?.toLowerCase().includes(q) || t.shortcut?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(tmpl => {
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
          </div>
        )}
      </div>
    )
  )}

      {/* ========================================================================= */}
      {/* 4. MODULE 5: KEUANGAN & ORDER LANGGANAN                                   */}
      {/* ========================================================================= */}
      {activeView === 'finance' && canAccessFinance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {(['all', 'pending', 'active', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setOrdersFilter(f)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: ordersFilter === f ? '#10b981' : theme.chipInactiveBg,
                  color: ordersFilter === f ? '#ffffff' : theme.chipInactiveText,
                  border: `1px solid ${ordersFilter === f ? '#10b981' : theme.border}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {f === 'all' ? 'Semua' : f === 'pending' ? 'Pending' : f === 'active' ? 'Aktif' : 'Ditolak'}
              </button>
            ))}
          </div>

          {/* Orders Feed */}
          {orders
            .filter(o => ordersFilter === 'all' || o.status === ordersFilter)
            .length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <CreditCard size={36} color="#10b981" style={{ margin: '0 auto 0.65rem' }} />
              <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Pesanan Paket</h4>
              <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>Semua transaksi paket langganan telah terverifikasi.</p>
            </div>
          ) : (
            orders
              .filter(o => ordersFilter === 'all' || o.status === ordersFilter)
              .map(o => (
                <div
                  key={o.id}
                  style={{
                    padding: '1.05rem',
                    borderRadius: '1.15rem',
                    backgroundColor: theme.surface,
                    border: o.status === 'pending' ? '1px solid rgba(250, 204, 21, 0.5)' : `1px solid ${theme.border}`,
                    boxShadow: theme.cardShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: isDark ? '#34d399' : '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      {o.plan_name || 'PRO STARTER'}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: o.status === 'active' ? (isDark ? '#34d399' : '#059669') : o.status === 'pending' ? (isDark ? '#facc15' : '#d97706') : '#f87171' }}>
                      {o.status ? o.status.toUpperCase() : 'PENDING'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary }}>
                        {o.store_name || `Store #${o.store_id || ''}`}
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                        Metode: {o.payment_method ? o.payment_method.toUpperCase() : 'TRANSFER BANK'}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 900, color: isDark ? '#34d399' : '#059669', display: 'block' }}>
                        Rp {(o.amount || o.price || 99000).toLocaleString('id-ID')}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID') : 'Baru'}
                      </span>
                    </div>
                  </div>

                  {o.payment_proof_url && (
                    <button
                      onClick={() => setSelectedProofOrder(o)}
                      style={{
                        padding: '0.45rem',
                        borderRadius: '0.6rem',
                        backgroundColor: theme.cardAlt,
                        border: `1px solid ${theme.border}`,
                        color: isDark ? '#38bdf8' : '#0284c7',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Eye size={13} />
                      <span>Lihat Bukti Pembayaran</span>
                    </button>
                  )}

                  {o.status === 'pending' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.4rem', borderTop: `1px solid ${theme.border}` }}>
                      <button
                        onClick={() => handleUpdateOrderStatus(o.id, 'rejected')}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleUpdateOrderStatus(o.id, 'active')}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '0.65rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        Aktifkan Paket
                      </button>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 6: MONETISASI & INTEGRASI GOOGLE (ADSENSE & ANALYTICS)          */}
      {/* ========================================================================= */}
      {activeView === 'monetization' && canAccessMonetization && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Sub-Tabs: Google AdSense / Google Analytics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.4rem',
            backgroundColor: theme.cardAlt,
            padding: '0.25rem',
            borderRadius: '0.85rem',
            border: `1px solid ${theme.border}`
          }}>
            <button
              onClick={() => setMonetizationTab('adsense')}
              style={{
                padding: '0.65rem 0.5rem',
                borderRadius: '0.65rem',
                backgroundColor: monetizationTab === 'adsense' ? '#eab308' : 'transparent',
                color: monetizationTab === 'adsense' ? '#000000' : theme.textSecondary,
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <DollarSign size={14} />
              <span>Google AdSense</span>
            </button>

            <button
              onClick={() => setMonetizationTab('analytics')}
              style={{
                padding: '0.65rem 0.5rem',
                borderRadius: '0.65rem',
                backgroundColor: monetizationTab === 'analytics' ? '#38bdf8' : 'transparent',
                color: monetizationTab === 'analytics' ? '#000000' : theme.textSecondary,
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <BarChart3 size={14} />
              <span>Google Analytics</span>
            </button>
          </div>

          {/* TAB 1: GOOGLE ADSENSE SETTINGS */}
          {monetizationTab === 'adsense' && (
            <form onSubmit={handleSaveGoogleSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              {/* Notice Policy */}
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.95rem',
                backgroundColor: isDark ? 'rgba(234, 179, 8, 0.08)' : 'rgba(234, 179, 8, 0.06)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={15} color="#eab308" />
                  <strong style={{ fontSize: '0.8rem', color: isDark ? '#fde047' : '#ca8a04' }}>
                    Google AdSense Monetization (Plan B):
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                  Iklan hanya akan disuntikkan pada katalog toko <strong>Versi Gratis (Free)</strong>. Toko yang berlangganan <strong>Paket Pro</strong> dijamin 100% bebas iklan.
                </p>
              </div>

              {/* Master Status & Mode */}
              <div style={{
                padding: '1rem',
                borderRadius: '1.05rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {/* Master Switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: theme.textPrimary }}>
                      Status Iklan Platform
                    </div>
                    <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                      Aktifkan penayangan Google AdSense di platform
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGoogleSettings(prev => ({ ...prev, ads_enabled: prev.ads_enabled === '1' ? '0' : '1' }))}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '999px',
                      backgroundColor: googleSettings.ads_enabled === '1' ? '#10b981' : (isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                      padding: '2px',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '2px',
                      left: googleSettings.ads_enabled === '1' ? '22px' : '2px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>

                {/* Publisher ID Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                    Google AdSense Publisher ID (Client ID)
                  </label>
                  <input
                    type="text"
                    placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                    value={googleSettings.ads_client_id}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ads_client_id: e.target.value.trim() }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.7rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: '0.2rem', display: 'block' }}>
                    Salin Publisher ID dari Dashboard Akun Google AdSense Anda.
                  </span>
                </div>

                {/* Auto Ads & Test Mode Switches */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', paddingTop: '0.4rem', borderTop: `1px solid ${theme.border}` }}>
                  {/* Auto Ads */}
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textPrimary }}>Auto Ads</span>
                      <input
                        type="checkbox"
                        checked={googleSettings.ads_auto_enabled === '1'}
                        onChange={e => setGoogleSettings(prev => ({ ...prev, ads_auto_enabled: e.target.checked ? '1' : '0' }))}
                        style={{ accentColor: '#eab308', cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>Iklan otomatis AI Google</span>
                  </div>

                  {/* Test Mode */}
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textPrimary }}>Mode Sandbox</span>
                      <input
                        type="checkbox"
                        checked={googleSettings.ads_test_mode === '1'}
                        onChange={e => setGoogleSettings(prev => ({ ...prev, ads_test_mode: e.target.checked ? '1' : '0' }))}
                        style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>Pratinjau tanpa klik palsu</span>
                  </div>
                </div>
              </div>

              {/* Ad Placement Slots Configuration */}
              <div style={{
                padding: '1rem',
                borderRadius: '1.05rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                  Unit Penempatan Iklan Khusus (Slot IDs)
                </h4>

                {/* Slot 1: Header Banner */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.2rem' }}>
                    1. Header Banner Slot ID (Di Bawah Search Bar Toko)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1234567890 (Opsional jika Auto Ads aktif)"
                    value={googleSettings.ads_slot_header}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_header: e.target.value.trim() }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.76rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Slot 2: In-Feed Product Catalog */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.2rem' }}>
                    2. In-Feed Catalog Slot ID (Di Sela-Sela Produk)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2345678901 (Opsional jika Auto Ads aktif)"
                    value={googleSettings.ads_slot_infeed}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_infeed: e.target.value.trim() }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.76rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Slot 3: Product Detail View */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.2rem' }}>
                    3. Product Detail Slot ID (Di Bawah Spesifikasi Produk)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 3456789012 (Opsional jika Auto Ads aktif)"
                    value={googleSettings.ads_slot_product_detail}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_product_detail: e.target.value.trim() }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.76rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Slot 4: Bottom Banner */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.2rem' }}>
                    4. Sticky Footer Slot ID (Banner Melayang Bawah Layar)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 4567890123 (Opsional jika Auto Ads aktif)"
                    value={googleSettings.ads_slot_bottom}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_bottom: e.target.value.trim() }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.76rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* ads.txt Manager */}
              <div style={{
                padding: '1rem',
                borderRadius: '1.05rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Code size={15} color="#10b981" />
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                      File ads.txt Domain Publik
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAdsTxt}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedAdsTxt ? '#10b981' : theme.textSecondary,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {copiedAdsTxt ? <CheckCheck size={12} /> : <Copy size={12} />}
                    <span>{copiedAdsTxt ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.7rem', color: theme.textSecondary }}>
                  File ini disajikan otomatis oleh server di <a href="/ads.txt" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}>catavor.com/ads.txt</a> untuk verifikasi robot Google.
                </p>

                <textarea
                  rows={2}
                  value={googleSettings.ads_txt_content}
                  onChange={e => setGoogleSettings(prev => ({ ...prev, ads_txt_content: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: isDark ? '#34d399' : '#059669',
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    boxSizing: 'border-box',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Submit Save Button */}
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#eab308',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(234, 179, 8, 0.3)'
                }}
              >
                <Check size={16} />
                <span>{savingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Konfigurasi AdSense'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: GOOGLE ANALYTICS 4 (GA4) */}
          {monetizationTab === 'analytics' && (
            <form onSubmit={handleSaveGoogleSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.95rem',
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.06)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BarChart3 size={15} color="#38bdf8" />
                  <strong style={{ fontSize: '0.8rem', color: isDark ? '#7dd3fc' : '#0284c7' }}>
                    Google Analytics 4 (GA4 Dinamis):
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                  Pelacakan analitik lalu lintas pengunjung platform secara instan tanpa perlu melakukan hardcode atau rebuild kodingan.
                </p>
              </div>

              <div style={{
                padding: '1rem',
                borderRadius: '1.05rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {/* Master Switch GA4 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: theme.textPrimary }}>
                      Status Pelacakan GA4
                    </div>
                    <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                      Aktifkan injeksi script `gtag.js` di katalog publik
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGoogleSettings(prev => ({ ...prev, ga_enabled: prev.ga_enabled === '1' ? '0' : '1' }))}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '999px',
                      backgroundColor: googleSettings.ga_enabled === '1' ? '#38bdf8' : (isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                      padding: '2px',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: '2px',
                      left: googleSettings.ga_enabled === '1' ? '22px' : '2px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>

                {/* Measurement ID */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                    Google Analytics Measurement ID
                  </label>
                  <input
                    type="text"
                    placeholder="G-XXXXXXXXXX"
                    value={googleSettings.ga_measurement_id}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, ga_measurement_id: e.target.value.trim().toUpperCase() }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.7rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: '0.2rem', display: 'block' }}>
                    Contoh format: G-4K89Z1X234 (Dapat ditemukan di Google Analytics Admin &gt; Data Streams).
                  </span>
                </div>

                {/* Events Information */}
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}`, fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: theme.textPrimary, marginBottom: '0.2rem' }}>
                    Event Otomatis yang Terkirim:
                  </div>
                  <div>&bull; `page_view` saat pengunjung berpindah halaman toko.</div>
                  <div>&bull; `view_item` saat detail produk katalog dilihat.</div>
                </div>
              </div>

              {/* Submit Save Button */}
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.85rem',
                  backgroundColor: '#38bdf8',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                }}
              >
                <Check size={16} />
                <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Google Analytics'}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 7: SIARAN BROADCAST                                             */}
      {/* ========================================================================= */}
      {activeView === 'broadcast' && canAccessBroadcast && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <button
            onClick={() => setShowBroadcastSheet(true)}
            style={{
              padding: '0.85rem 1.15rem',
              borderRadius: '0.85rem',
              backgroundColor: '#f59e0b',
              color: '#000000',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
            }}
          >
            <Plus size={16} />
            <span>Kirim Siaran Broadcast Baru</span>
          </button>

          <h4 style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
            Riwayat Siaran ({broadcasts.length})
          </h4>

          {broadcasts.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <Megaphone size={36} color="#f59e0b" style={{ margin: '0 auto 0.65rem' }} />
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.76rem' }}>Belum ada riwayat siaran broadcast.</p>
            </div>
          ) : (
            broadcasts.map((b, idx) => (
              <div
                key={b.id || idx}
                style={{
                  padding: '1rem',
                  borderRadius: '1rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', padding: '0.12rem 0.5rem', borderRadius: '999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: isDark ? '#fbbf24' : '#d97706', fontWeight: 800 }}>
                    Target: {b.target_role ? b.target_role.toUpperCase() : 'SEMUA MERCHANT'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                    {b.created_at ? new Date(b.created_at).toLocaleDateString('id-ID') : 'Baru'}
                  </span>
                </div>
                <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                  {b.title}
                </h5>
                <p style={{ margin: 0, fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.45 }}>
                  {b.message}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 8: AUDIT TRAIL LOGS                                             */}
      {/* ========================================================================= */}
      {activeView === 'audit' && canAccessAudit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
            System Audit Trail ({auditLogs.length})
          </h4>

          {auditLogs.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <Activity size={36} color="#94a3b8" style={{ margin: '0 auto 0.65rem' }} />
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.76rem' }}>Belum ada log audit keamanan tercatat.</p>
            </div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '0.95rem',
                  borderRadius: '0.95rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.textPrimary }}>
                    {log.action || 'Aktivitas Sistem'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: theme.textSecondary }}>
                  Aktor: <strong style={{ color: theme.textPrimary }}>{log.user_email || 'Sistem'}</strong> ({log.role || 'Superadmin'})
                </div>
                {log.details && (
                  <p style={{ margin: 0, fontSize: '0.74rem', color: theme.textMuted, fontStyle: 'italic' }}>
                    {log.details}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL (PDF / IN-APP VIEWER & DIRECT DOWNLOAD) */}
      <DocumentPreviewModal
        data={docPreview}
        onClose={() => setDocPreview(null)}
        token={token || localStorage.getItem('catavor_token') || ''}
      />

      {/* SUPPORT TICKET ATTACHMENTS GALLERY LIGHTBOX MODAL (IDENTIK DENGAN ADMIN KATALOG) */}
      {attachmentLightbox?.isOpen && attachmentLightbox.images.length > 0 && (() => {
        const currentImg = attachmentLightbox.images[attachmentLightbox.currentIndex] || attachmentLightbox.images[0];
        const total = attachmentLightbox.images.length;
        const currentIdx = attachmentLightbox.currentIndex;

        return (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999999,
              backgroundColor: 'rgba(5, 8, 15, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              userSelect: 'none',
              touchAction: 'none',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={closeAttachmentLightbox}
          >
            {/* Top Header Bar */}
            <div 
              style={{
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
                zIndex: 10,
                gap: '0.75rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {currentIdx + 1} / {total} Foto
                </span>
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {currentImg.file_name || `Lampiran_${currentIdx + 1}`}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  title="Download Foto"
                  onClick={() => handleDownloadAttachmentImage(currentImg.file_url, currentImg.file_name)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={16} />
                </button>

                <a
                  href={currentImg.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka File Asli di Tab Baru"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <ExternalLink size={16} />
                </a>

                <button
                  type="button"
                  title="Tutup (Esc)"
                  onClick={closeAttachmentLightbox}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Image Stage with Zoom & Pan */}
            <div 
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '0.75rem',
                touchAction: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseMove={(e) => {
                if (isDragging && zoomScale > 1) {
                  e.preventDefault();
                  setPanPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchMove={(e) => {
                if (isDragging && zoomScale > 1 && e.touches.length === 1) {
                  const touch = e.touches[0];
                  setPanPosition({
                    x: touch.clientX - dragStart.x,
                    y: touch.clientY - dragStart.y
                  });
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
              onTouchCancel={() => setIsDragging(false)}
              onWheel={(e) => {
                e.stopPropagation();
                const delta = e.deltaY < 0 ? 0.25 : -0.25;
                setZoomScale(prev => {
                  const next = Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.75), 4);
                  if (next <= 1) setPanPosition({ x: 0, y: 0 });
                  return next;
                });
              }}
            >
              {/* Left Nav Button (if multiple images) */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachmentLightbox(prev => prev ? { ...prev, currentIndex: (prev.currentIndex - 1 + total) % total } : null);
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                    setIsDragging(false);
                  }}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 20,
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                  }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {/* Right Nav Button (if multiple images) */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachmentLightbox(prev => prev ? { ...prev, currentIndex: (prev.currentIndex + 1) % total } : null);
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                    setIsDragging(false);
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 20,
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                  }}
                >
                  <ChevronRight size={22} />
                </button>
              )}

              {/* Center Canvas */}
              <div
                style={{
                  maxWidth: '94vw',
                  maxHeight: '72vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                  transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none'
                }}
                onMouseDown={(e) => {
                  if (zoomScale > 1) {
                    e.preventDefault();
                    setIsDragging(true);
                    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging && zoomScale > 1) {
                    e.preventDefault();
                    setPanPosition({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y
                    });
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={(e) => {
                  if (zoomScale > 1 && e.touches.length === 1) {
                    setIsDragging(true);
                    const touch = e.touches[0];
                    setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y });
                  }
                }}
                onTouchMove={(e) => {
                  if (isDragging && zoomScale > 1 && e.touches.length === 1) {
                    const touch = e.touches[0];
                    setPanPosition({
                      x: touch.clientX - dragStart.x,
                      y: touch.clientY - dragStart.y
                    });
                  }
                }}
                onTouchEnd={() => setIsDragging(false)}
                onTouchCancel={() => setIsDragging(false)}
                onDoubleClick={() => {
                  if (zoomScale > 1) {
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                    setIsDragging(false);
                  } else {
                    setZoomScale(2.5);
                  }
                }}
              >
                <img
                  src={currentImg.file_url}
                  alt={currentImg.file_name || 'Screenshot'}
                  draggable={false}
                  style={{
                    maxWidth: '92vw',
                    maxHeight: '68vh',
                    objectFit: 'contain',
                    borderRadius: '0.75rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </div>

            {/* Bottom Thumbnail Strip & Zoom Bar */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)',
                zIndex: 10
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Zoom Controls Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)'
              }}>
                <button
                  type="button"
                  title="Zoom Out"
                  disabled={zoomScale <= 0.75}
                  onClick={() => setZoomScale(prev => Math.max(prev - 0.3, 0.75))}
                  style={{ background: 'none', border: 'none', color: zoomScale <= 0.75 ? 'rgba(255,255,255,0.3)' : '#ffffff', cursor: zoomScale <= 0.75 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ZoomOut size={16} />
                </button>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ffffff', minWidth: '45px', textAlign: 'center' }}>
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom In"
                  disabled={zoomScale >= 3.5}
                  onClick={() => setZoomScale(prev => Math.min(prev + 0.3, 3.5))}
                  style={{ background: 'none', border: 'none', color: zoomScale >= 3.5 ? 'rgba(255,255,255,0.3)' : '#ffffff', cursor: zoomScale >= 3.5 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  title="Reset Zoom"
                  onClick={() => {
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: 'none',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Thumbnail Preview Strip (if > 1 image) */}
              {total > 1 && (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  overflowX: 'auto',
                  maxWidth: '100%',
                  padding: '0.25rem',
                  justifyContent: 'center'
                }}>
                  {attachmentLightbox.images.map((att, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAttachmentLightbox(prev => prev ? { ...prev, currentIndex: idx } : null);
                        setZoomScale(1);
                        setPanPosition({ x: 0, y: 0 });
                      }}
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '0.45rem',
                        overflow: 'hidden',
                        border: currentIdx === idx ? '2.5px solid #06b6d4' : '1px solid rgba(255,255,255,0.25)',
                        padding: 0,
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        transform: currentIdx === idx ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <img src={att.file_url} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Bottom Sheet: Kirim Siaran Broadcast */}
      {showBroadcastSheet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: theme.modalOverlay,
          backdropFilter: 'blur(6px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }} onClick={() => setShowBroadcastSheet(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '90vh',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.35rem',
              borderTopRightRadius: '1.35rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.shadow,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.95rem',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary }}>
                Kirim Siaran Broadcast Global
              </h3>
              <button onClick={() => setShowBroadcastSheet(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                  Target Penerima
                </label>
                <select
                  value={broadcastForm.target_role}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, target_role: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="all">Semua Pemilik Toko &amp; Merchant</option>
                  <option value="pro">Hanya Toko Paket Pro (Aktif)</option>
                  <option value="free">Hanya Toko Paket Gratis</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                  Judul Siaran
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pembaruan Sistem / Informasi Layanan"
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                  Pesan Notifikasi
                </label>
                <textarea
                  rows={4}
                  placeholder="Isi pesan notifikasi siaran broadcast yang akan tampil di dashboard semua merchant..."
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    resize: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!broadcastForm.title.trim() || !broadcastForm.message.trim()}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  marginTop: '0.4rem',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.25)'
                }}
              >
                <Send size={15} />
                <span>Kirim Siaran Sekarang</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zoom: Preview Bukti Transfer */}
      {selectedProofOrder && (
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }} onClick={() => setSelectedProofOrder(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '380px',
              width: '100%',
              backgroundColor: theme.modalBg,
              borderRadius: '1.25rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.shadow,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>
                Bukti Pembayaran #{selectedProofOrder.id}
              </h4>
              <button onClick={() => setSelectedProofOrder(null)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div 
              onClick={() => openAttachmentLightbox([{ file_url: selectedProofOrder.payment_proof_url, file_name: `Bukti_Bayar_Order_${selectedProofOrder.id}.jpg` }])}
              style={{ width: '100%', maxHeight: '300px', overflow: 'hidden', borderRadius: '0.75rem', backgroundColor: isDark ? '#000' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Klik untuk perbesar gambar"
            >
              <img
                src={selectedProofOrder.payment_proof_url}
                alt="Bukti Transfer"
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: theme.textSecondary }}>
              <span>Toko: <strong style={{ color: theme.textPrimary }}>{selectedProofOrder.store_name}</strong></span>
              <span>Nominal: <strong style={{ color: isDark ? '#34d399' : '#059669' }}>Rp {(selectedProofOrder.amount || 99000).toLocaleString('id-ID')}</strong></span>
            </div>

            {selectedProofOrder.status === 'pending' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.35rem' }}>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'rejected')}
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Tolak
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedProofOrder.id, 'active')}
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Aktifkan Paket
                </button>
              </div>
            )}
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
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                  Judul Template <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
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
                  <select
                    value={templateForm.category}
                    onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: theme.cardAlt,
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
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
                    🔍 Pratinjau Teks (Variabel Terisi):
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

      {/* Floating Scroll to Top Button (Only on ticket queue/dashboard, hidden in chat room) */}
      {showScrollTop && !selectedTicket && (
        <button
          type="button"
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            right: '16px',
            bottom: selectedTicket ? '96px' : '24px',
            zIndex: 90,
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
