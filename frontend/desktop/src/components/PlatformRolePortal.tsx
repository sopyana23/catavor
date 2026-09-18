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
  Paperclip,
  ZoomIn,
  ZoomOut,
  Download,
  X,
  ChevronLeft,
  ChevronDown,
  Store,
  SlidersHorizontal,
  Bot,
  Zap,
  Volume2,
  VolumeX,
  Bell,
  Star,
  ArrowUp
} from 'lucide-react';
import { type UserRBACInfo, hasPermission, isSuperAdmin, getRoleBadge } from '../utils/rbac';
import { AdminRBACManagement } from './AdminRBACManagement';

interface PlatformRolePortalProps {
  token: string;
  currentUser: UserRBACInfo | null;
  onNavigateToTab?: (tab: string) => void;
  onClose?: () => void;
  onLogout?: () => void;
}

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
  low: { label: 'Low (Rendah)', color: '#06b6d4' }
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

export const PlatformRolePortal: React.FC<PlatformRolePortalProps> = ({
  token,
  currentUser,
  onNavigateToTab,
  onClose,
  onLogout
}) => {
  const roleSlug = currentUser?.platform_role || (currentUser?.is_superadmin ? 'superadmin' : 'merchant');
  const roleBadge = getRoleBadge(roleSlug);

  // Available division tabs based on permissions / role
  const canAccessRBAC = isSuperAdmin(currentUser) || hasPermission(currentUser, 'system:admins:manage');
  const canAccessCompliance = hasPermission(currentUser, 'compliance:reports:manage') || hasPermission(currentUser, 'compliance:dormancy:manage') || isSuperAdmin(currentUser);
  const canAccessSupport = hasPermission(currentUser, 'support:tickets:read') || hasPermission(currentUser, 'support:tickets:reply') || isSuperAdmin(currentUser);
  const canAccessFinance = hasPermission(currentUser, 'finance:orders:read') || isSuperAdmin(currentUser);
  const canAccessContent = hasPermission(currentUser, 'monetization:google:manage') || hasPermission(currentUser, 'content:broadcast:send') || isSuperAdmin(currentUser);

  // Helper to synchronize URL query parameters cleanly and safely
  const updatePlatformUrl = (division: string, ticketRef?: string | number | null, subtabRef?: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (division) {
        url.searchParams.set('tab', division);
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
        window.history.pushState({ division, ticket: ticketRef || null, subtab: subtabRef || null }, '', newRelativePathQuery);
      }
    } catch (e) {
      console.error('Failed to sync URL:', e);
    }
  };

  // Default active division reading from URL first
  const getDefaultDivision = (): 'overview' | 'rbac' | 'compliance' | 'support' | 'finance' | 'content' => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = (urlParams.get('tab') || urlParams.get('division') || urlParams.get('view') || '').toLowerCase();
      if (['overview', 'rbac', 'compliance', 'support', 'finance', 'content'].includes(tabParam)) {
        if (tabParam === 'rbac' && !canAccessRBAC) return 'overview';
        if (tabParam === 'compliance' && !canAccessCompliance) return 'overview';
        if (tabParam === 'support' && !canAccessSupport) return 'overview';
        if (tabParam === 'finance' && !canAccessFinance) return 'overview';
        if (tabParam === 'content' && !canAccessContent) return 'overview';
        return tabParam as any;
      }
      if (['help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) {
        if (canAccessSupport) return 'support';
      }
    } catch {
      // fallback
    }

    if (isSuperAdmin(currentUser)) return 'overview';
    if (roleSlug === 'compliance' && canAccessCompliance) return 'compliance';
    if (roleSlug === 'support' && canAccessSupport) return 'support';
    if (roleSlug === 'finance' && canAccessFinance) return 'finance';
    if (roleSlug === 'content' && canAccessContent) return 'content';
    if (canAccessCompliance) return 'compliance';
    if (canAccessSupport) return 'support';
    if (canAccessFinance) return 'finance';
    if (canAccessContent) return 'content';
    return 'overview';
  };

  const [activeDivision, setActiveDivision] = useState<'overview' | 'rbac' | 'compliance' | 'support' | 'finance' | 'content'>(getDefaultDivision());

  const handleSwitchDivision = (division: 'overview' | 'rbac' | 'compliance' | 'support' | 'finance' | 'content') => {
    setActiveDivision(division);
    setSelectedTicket(null);
    updatePlatformUrl(division, null);
  };

  const handleCloseTicketChat = () => {
    setSelectedTicket(null);
    updatePlatformUrl(activeDivision || 'support', null);
  };
  const [loading, setLoading] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // State: Compliance
  const [reports, setReports] = useState<any[]>([]);
  const [reportsFilter, setReportsFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [dormancyMetrics, setDormancyMetrics] = useState<any | null>(null);

  // State: Support
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsFilter, setTicketsFilter] = useState<string>('all');
  const [resolvedTimeRangeFilter, setResolvedTimeRangeFilter] = useState<'30d' | '90d' | 'all'>('30d');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');

  // Scroll to Top state & handlers
  const [showPageScrollTop, setShowPageScrollTop] = useState(false);
  const [showChatScrollTop, setShowChatScrollTop] = useState(false);
  const desktopChatFeedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowPageScrollTop(window.scrollY > 220);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollPageToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollChatToTop = () => {
    if (desktopChatFeedRef.current) {
      desktopChatFeedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Pengurutan alami tiket layaknya aplikasi media sosial / chat:
  // Seluruh tiket diurutkan berdasarkan tanggal/waktu pesan terakhir (terbaru di posisi paling atas)
  const sortedTickets = useMemo(() => {
    let list = [...tickets];
    if (ticketsFilter === 'unread') {
      list = list.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0));
    }
    return list.sort((a, b) => {
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
  }, [tickets, ticketsFilter]);

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

  // Unread & Incoming Chat Audio/Notification Management
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

  const handleToggleChimeMute = () => {
    setIsChimeMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem('catavor_admin_chime_muted', String(next));
      } catch {}
      return next;
    });
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

  // Custom Dropdown Popover States for Helpdesk Filter
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const priorityDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setIsPriorityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [ticketReplyAttachments, setTicketReplyAttachments] = useState<any[]>([]);
  const [isUploadingTicketAttachment, setIsUploadingTicketAttachment] = useState(false);

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

  const handleNavigateToTemplatesMaster = () => {
    setShowTemplateModal(false);
    setSelectedTicket(null); // CRITICAL: Closes the full-screen ticket chat modal so user lands directly on Master Template page!
    setActiveDivision('support');
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
        showToast(`Template "${tmpl.title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}!`, 'success');
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

    setReplyMessage((prev: string) => (prev ? `${prev}\n${content}` : content));
    setShowTemplateModal(false);
    showToast(`Template "${tmpl.title}" disisipkan!`, 'success');
  };
  // Support Attachment Gallery Lightbox State (Identik dengan Admin Katalog)
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

  const [replyMessage, setReplyMessage] = useState('');
  const [ticketActionLoading, setTicketActionLoading] = useState(false);
  const ticketTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize and reset textarea height when message is typed or sent/cleared
  useEffect(() => {
    if (ticketTextareaRef.current) {
      if (!replyMessage) {
        ticketTextareaRef.current.style.height = 'auto';
      } else {
        ticketTextareaRef.current.style.height = 'auto';
        ticketTextareaRef.current.style.height = `${Math.min(ticketTextareaRef.current.scrollHeight, 140)}px`;
      }
    }
  }, [replyMessage]);

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
          body: JSON.stringify({ is_typing: replyMessage.trim().length > 0 })
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
  }, [selectedTicket?.id, token, canAccessSupport, replyMessage]);

  // State: Finance
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // State: Content
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', type: 'info', target_role: 'all' });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // 300ms Debounced Ticket Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTicketSearch(ticketSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [ticketSearchQuery]);

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
        credentials: 'omit',
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
                incomingSnippet = lastMsg.message ? (lastMsg.message.length > 60 ? lastMsg.message.substring(0, 60) + '...' : lastMsg.message) : '';
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
            setSelectedTicket((prev: any) => prev ? ({ ...prev, messages: activeUpdated.messages }) : null);
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
      console.error('Error fetching desktop support tickets:', e);
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

  // Polling cerdas setiap 10 detik agar chat masuk terdeteksi secara real-time
  useEffect(() => {
    if (!token || !canAccessSupport) return;
    const interval = setInterval(() => {
      fetchTickets(1, false);
    }, activeDivision === 'support' ? 10000 : 25000);
    return () => clearInterval(interval);
  }, [token, canAccessSupport, activeDivision, ticketsFilter, ticketCategoryFilter, ticketPriorityFilter, resolvedTimeRangeFilter, debouncedTicketSearch]);

  const fetchDivisionData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeDivision === 'compliance' || activeDivision === 'overview') {
        if (canAccessCompliance) {
          const repRes = await fetch('/api/admin/reports', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (repRes.ok) {
            const rData = await repRes.json();
            setReports(Array.isArray(rData) ? rData : rData.data || []);
          }
          const dormRes = await fetch('/api/admin/dormancy/metrics', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (dormRes.ok) {
            const dData = await dormRes.json();
            setDormancyMetrics(dData);
          }
        }
      }

      if (activeDivision === 'support' || activeDivision === 'overview') {
        if (canAccessSupport) {
          fetchTickets(1, false);
        }
      }

      if (activeDivision === 'finance' || activeDivision === 'overview') {
        if (canAccessFinance) {
          const res = await fetch('/api/admin/subscription/orders', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : data.data || data.orders || []);
          }
        }
      }

      if (activeDivision === 'content' || activeDivision === 'overview') {
        if (canAccessContent) {
          const broadRes = await fetch('/api/admin/notifications', { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
          if (broadRes.ok) {
            const bData = await broadRes.json();
            setBroadcasts(Array.isArray(bData) ? bData : bData.data || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load division data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisionData();
  }, [activeDivision, token]);

  // Synchronize URL on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = (searchParams.get('tab') || searchParams.get('division') || searchParams.get('view') || '').toLowerCase();
        const ticketParam = searchParams.get('ticket') || searchParams.get('ticket_id');

        if (tabParam) {
          if (['overview', 'rbac', 'compliance', 'support', 'finance', 'content'].includes(tabParam)) {
            setActiveDivision(tabParam as any);
          } else if (['help', 'bantuan', 'helpdesk', 'tickets', 'chat'].includes(tabParam)) {
            setActiveDivision('support');
          }
        }

        if (!ticketParam) {
          setSelectedTicket(null);
        }
      } catch (err) {
        console.error('Error handling popstate:', err);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Deep-link direct ticket opener when tickets loaded or direct URL access
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
          credentials: 'omit',
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
    setReplyMessage('');
    setTicketReplyAttachments([]);
    setIsInternalNote(false);

    if (pushToHistory) {
      const ticketRef = ticket.ticket_number || ticket.id;
      updatePlatformUrl('support', ticketRef);
    }

    try {
      const res = await fetch(`/api/admin/support/tickets/${rawId}`, {
        credentials: 'omit',
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

  // Upload Attachment for Support Chat
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
        showToast(`${uploaded.length} gambar/screenshot terlampir!`, 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal mengunggah lampiran', 'error');
    } finally {
      setIsUploadingTicketAttachment(false);
    }
  };

  // Support Reply Action (Supports Public Reply or Internal Note)
  const handleReplyTicket = async (shouldResolve = false) => {
    const targetTicketId = selectedTicket?.id || selectedTicket?.ticket?.id || selectedTicket?.ticket_number;
    if (!targetTicketId || (!replyMessage.trim() && ticketReplyAttachments.length === 0)) return;
    setTicketActionLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${targetTicketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: replyMessage.trim(),
          is_internal_note: isInternalNote,
          attachments: ticketReplyAttachments
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const createdMsg = data.data;
        showToast(isInternalNote ? 'Catatan internal CS disimpan!' : 'Balasan staf berhasil terkirim!', 'success');
        setReplyMessage('');
        setTicketReplyAttachments([]);
        setIsInternalNote(false);
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
          handleOpenTicketChat(selectedTicket, false);
        }
        fetchDivisionData();
      } else {
        showToast(data.message || 'Gagal mengirim balasan tiket', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setTicketActionLoading(false);
    }
  };

  // Support Status Update
  const handleUpdateTicketStatus = async (ticketId: number | string, status: string) => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Status tiket berhasil diubah menjadi ${status.toUpperCase()}`, 'success');
        fetchDivisionData();
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status });
        }
      }
    } catch (e) {
      showToast('Gagal mengubah status tiket', 'error');
    }
  };

  // Compliance Report Status Update
  const handleUpdateReportStatus = async (reportId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Laporan #${reportId} berhasil diupdate ke ${status}`, 'success');
        fetchDivisionData();
        setSelectedReport(null);
      } else {
        showToast('Gagal memperbarui status laporan', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
  };

  // Content Broadcast Send
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
        showToast('Siaran notifikasi platform berhasil disebarkan!', 'success');
        setShowBroadcastModal(false);
        setBroadcastForm({ title: '', message: '', type: 'info', target_role: 'all' });
        fetchDivisionData();
      } else {
        showToast('Gagal mengirim siaran notifikasi', 'error');
      }
    } catch (e) {
      showToast('Kesalahan jaringan pengiriman siaran', 'error');
    }
  };

  return (
    <div className="catavor-platform-portal" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Toast */}
      {notificationMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.85rem 1.4rem',
          borderRadius: '0.75rem',
          backgroundColor: notificationMsg.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(244, 63, 94, 0.95)',
          color: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {notificationMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        padding: '1.75rem 2rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '180px',
          height: '180px',
          background: `radial-gradient(circle, ${roleBadge.color}25 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              backgroundColor: roleBadge.bg,
              border: `1px solid ${roleBadge.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: roleBadge.color,
              boxShadow: `0 0 20px ${roleBadge.color}30`
            }}>
              {roleSlug === 'compliance' ? <ShieldAlert size={28} /> :
               roleSlug === 'support' ? <HelpCircle size={28} /> :
               roleSlug === 'finance' ? <CreditCard size={28} /> :
               roleSlug === 'content' ? <Megaphone size={28} /> :
               <Shield size={28} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Portal Operasional Platform
                </h1>
                <span style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: roleBadge.bg,
                  color: roleBadge.color,
                  border: `1px solid ${roleBadge.border}`,
                  letterSpacing: '0.02em'
                }}>
                  {roleBadge.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Akun Staf: <strong>{currentUser?.email || 'admin@catavor.com'}</strong> &bull; {currentUser?.permissions?.length || (isSuperAdmin(currentUser) ? 'Seluruh' : 0)} Izin Akses Aktif
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={fetchDivisionData}
              disabled={loading}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan Data</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                title="Keluar Sesi"
              >
                <LogOut size={15} />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Division Switcher Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => handleSwitchDivision('overview')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '0.65rem',
              backgroundColor: activeDivision === 'overview' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
              border: 'none',
              color: activeDivision === 'overview' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            <Layers size={16} />
            <span>Ringkasan Eksekutif</span>
          </button>

          {canAccessRBAC && (
            <button
              onClick={() => handleSwitchDivision('rbac')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'rbac' ? '#f43f5e' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'rbac' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <Shield size={16} />
              <span>Staf &amp; Hak Akses RBAC</span>
            </button>
          )}

          {canAccessCompliance && (
            <button
              onClick={() => handleSwitchDivision('compliance')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'compliance' ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'compliance' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <ShieldAlert size={16} />
              <span>Kepatuhan &amp; Satwa</span>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canAccessSupport && (
            <button
              onClick={() => handleSwitchDivision('support')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'support' ? '#0ea5e9' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'support' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <HelpCircle size={16} />
              <span>Customer Support</span>
              {(() => {
                const unreadTotal = tickets.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0)).length;
                const openTotal = tickets.filter(t => t.status === 'open').length;
                const displayCount = unreadTotal > 0 ? unreadTotal : openTotal;
                if (displayCount <= 0) return null;
                return (
                  <span style={{
                    padding: '0.12rem 0.5rem',
                    borderRadius: '999px',
                    backgroundColor: unreadTotal > 0 ? '#38bdf8' : '#0284c7',
                    color: '#000',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    boxShadow: unreadTotal > 0 ? '0 0 10px rgba(56, 189, 248, 0.6)' : undefined,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {unreadTotal > 0 && <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#0284c7' }} />}
                    {displayCount}
                  </span>
                );
              })()}
            </button>
          )}

          {canAccessFinance && (
            <button
              onClick={() => handleSwitchDivision('finance')}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.65rem',
                backgroundColor: activeDivision === 'finance' ? '#10b981' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'finance' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <CreditCard size={16} />
              <span>Keuangan &amp; Billing</span>
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#34d399',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {canAccessContent && (
            <button
              type="button"
              onClick={() => handleSwitchDivision('content')}
              style={{
                padding: '0.65rem 1.15rem',
                borderRadius: '0.75rem',
                backgroundColor: activeDivision === 'content' ? '#8b5cf6' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: activeDivision === 'content' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              <Megaphone size={16} />
              <span>Konten &amp; Siaran</span>
              {broadcasts.length > 0 && (
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  backgroundColor: '#c084fc',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {broadcasts.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 0. STAF & RBAC MANAGEMENT VIEW                                            */}
      {/* ========================================================================= */}
      {activeDivision === 'rbac' && canAccessRBAC && (
        <AdminRBACManagement token={token} currentUserEmail={currentUser?.email} />
      )}

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE OVERVIEW DASHBOARD VIEW                                      */}
      {/* ========================================================================= */}
      {activeDivision === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => handleSwitchDivision('compliance')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Laporan Kepatuhan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{reports.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{reports.filter(r => r.status === 'pending').length} butuh tindakan</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                <ShieldAlert size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => handleSwitchDivision('support')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tiket Dukungan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0ea5e9' }}>{tickets.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tickets.filter(t => t.status === 'open').length} belum dijawab</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                <HelpCircle size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => handleSwitchDivision('finance')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pesanan Langganan</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{orders.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{orders.filter(o => o.status === 'pending').length} pending</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <CreditCard size={24} />
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }} onClick={() => handleSwitchDivision('content')}>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Siaran Platform</p>
                <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#8b5cf6' }}>{broadcasts.length}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pengumuman Aktif</span>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <Megaphone size={24} />
              </div>
            </div>
          </div>

          {/* Quick Action Hub */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
              Pusat Kendali Divisi Operasional
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Pilih divisi di atas untuk mulai meninjau laporan, tiket dukungan pelanggan, pembayaran langganan toko, atau moderasi artikel.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldAlert size={16} /> Divisi Kepatuhan
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Memverifikasi kepatuhan satwa dilindungi, menindaklanjuti laporan sengketa pembeli, dan mengelola toko inaktif.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <HelpCircle size={16} /> Divisi Customer Support
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Menjawab tiket kendala teknis merchant, live response chat, dan eskalasi penanganan masalah transaksi.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CreditCard size={16} /> Divisi Keuangan &amp; Billing
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Konfirmasi pembayaran langganan paket Pro/Enterprise dan verifikasi bukti transfer manual merchant.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Megaphone size={16} /> Divisi Konten &amp; Editorial
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Moderasi komentar publik pada blog komunitas dan penyiaran broadcast notifikasi massal platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPLIANCE & SATWA DIVISION                                            */}
      {/* ========================================================================= */}
      {activeDivision === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header & Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                Pengawasan Kepatuhan &amp; Satwa
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Moderasi laporan pengaduan pelanggaran etalase, satwa terlarang, dan metrik toko inaktif.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map(status => (
                <button
                  key={status}
                  onClick={() => setReportsFilter(status)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: reportsFilter === status ? '#f59e0b' : 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: reportsFilter === status ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Reports Table Card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>ID &amp; Tanggal</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Subjek / Tipe</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Toko / Item Terlapor</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Pelapor</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reports
                    .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
                    .map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          #{r.id}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.subject || r.reason || 'Laporan Pengaduan'}</span>
                          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{r.type || 'Etalase'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {r.store_name || r.store_slug || r.target_title || '-'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {r.reporter_name || r.reporter_email || 'Anonim'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              r.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' :
                              r.status === 'investigating' ? 'rgba(245, 158, 11, 0.15)' :
                              r.status === 'dismissed' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color:
                              r.status === 'resolved' ? '#10b981' :
                              r.status === 'investigating' ? '#f59e0b' :
                              r.status === 'dismissed' ? '#94a3b8' : '#ef4444',
                            border: `1px solid ${
                              r.status === 'resolved' ? 'rgba(16, 185, 129, 0.3)' :
                              r.status === 'investigating' ? 'rgba(245, 158, 11, 0.3)' :
                              r.status === 'dismissed' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            }`
                          }}>
                            {r.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedReport(r)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#f59e0b',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Tinjau &amp; Aksi
                          </button>
                        </td>
                      </tr>
                    ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                        Tidak ada laporan pelanggaran aktif saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report Action Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '560px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} color="#f59e0b" /> Tinjau Laporan #{selectedReport.id}
              </h3>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Deskripsi / Alasan Laporan:</p>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {selectedReport.description || selectedReport.reason || 'Tidak ada keterangan tambahan.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pelapor:</span>
                  <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedReport.reporter_name || selectedReport.reporter_email || 'Anonim'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target Toko/Item:</span>
                  <p style={{ margin: '0.2rem 0 0', fontWeight: 600, color: '#f59e0b' }}>
                    {selectedReport.store_name || selectedReport.store_slug || '-'}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  Tetapkan Status Penanganan Kepatuhan:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'investigating')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#f59e0b',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Investigasi
                  </button>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'resolved')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Selesai / Ditindak
                  </button>
                  <button
                    onClick={() => handleUpdateReportStatus(selectedReport.id, 'dismissed')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(148, 163, 184, 0.15)',
                      border: '1px solid rgba(148, 163, 184, 0.4)',
                      color: '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Tolak Laporan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CUSTOMER SUPPORT DIVISION                                              */}
      {/* ========================================================================= */}
      {activeDivision === 'support' && (() => {
        const actionRequiredCount = ticketsMetrics.action_required ?? tickets.filter(t => t.status === 'open' || t.status === 'waiting_agent').length;
        const inProgressCount = ticketsMetrics.in_progress ?? tickets.filter(t => t.status === 'in_progress').length;
        const waitingUserCount = ticketsMetrics.waiting_user ?? tickets.filter(t => t.status === 'waiting_user').length;
        const urgentCount = ticketsMetrics.urgent ?? tickets.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'resolved' && t.status !== 'closed').length;
        const openCount = tickets.filter(t => t.status === 'open').length;
        const resolvedCount = ticketsMetrics.resolved ?? tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
        const totalTicketsCount = ticketsMetrics.total ?? tickets.length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Header & Sub-Navigation Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Pusat Bantuan &amp; Helpdesk Tiket</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {supportSubView === 'tickets'
                    ? 'Kelola percakapan dua arah, keluhan kendala teknis, billing, dan eskalasi merchant secara terpusat.'
                    : 'Kelola master template balasan cepat (canned responses) untuk mempermudah dan mempercepat respons tim CS.'}
                </p>
              </div>

              {/* Sub-view Switcher Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--bg-deep)',
                padding: '0.25rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light)'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setSupportSubView('tickets');
                    updatePlatformUrl('support', null, null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: supportSubView === 'tickets' ? 'var(--primary)' : 'transparent',
                    color: supportSubView === 'tickets' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MessageSquare size={14} />
                  <span>Antrean Tiket</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '0.08rem 0.4rem',
                    borderRadius: '999px',
                    backgroundColor: supportSubView === 'tickets' ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                    color: supportSubView === 'tickets' ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {totalTicketsCount}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: supportSubView === 'templates' ? '#0ea5e9' : 'transparent',
                    color: supportSubView === 'templates' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Zap size={14} />
                  <span>Master Template Balasan</span>
                </button>

                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-light)', margin: '0 0.25rem' }} />

                <button
                  type="button"
                  onClick={handleToggleChimeMute}
                  title={isChimeMuted ? "Suara Notifikasi Chat Dimatikan (Klik untuk membunyikan)" : "Suara Notifikasi Chat Aktif (Klik untuk mute)"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: isChimeMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                    color: isChimeMuted ? '#ef4444' : '#38bdf8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isChimeMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isChimeMuted ? 'Muted' : 'Sound ON'}</span>
                </button>
              </div>
            </div>

            {/* VIEW A: TICKETS QUEUE & CHAT THREAD */}
            {supportSubView === 'tickets' && (
              <>
            {/* 2. Unified Search & Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="search-input"
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  placeholder="Cari ID tiket (#TCK-...), nama toko, subjek, atau email..."
                  style={{
                    width: '100%',
                    padding: '0.55rem 2.2rem 0.55rem 2.5rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {ticketSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTicketSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Dropdown (Only when > 1 category types exist) */}
              {availableCategories.length > 1 && (
                <div ref={categoryDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                      setIsPriorityDropdownOpen(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.52rem 0.85rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: ticketCategoryFilter !== 'all' ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-card)',
                      border: `1px solid ${ticketCategoryFilter !== 'all' ? '#0ea5e9' : 'var(--border-light)'}`,
                      color: ticketCategoryFilter !== 'all' ? '#0ea5e9' : 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: 'var(--card-shadow)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Tag size={13} style={{ color: ticketCategoryFilter !== 'all' ? '#0ea5e9' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span>{ticketCategoryFilter === 'all' ? 'Semua Kategori' : (CATEGORY_LABELS[ticketCategoryFilter] || ticketCategoryFilter)}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        color: ticketCategoryFilter !== 'all' ? '#0ea5e9' : 'var(--text-secondary)',
                        transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    />
                  </button>

                  {isCategoryDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 1000,
                        minWidth: '240px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                        padding: '0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        animation: 'fadeIn 0.15s ease'
                      }}
                    >
                      <div style={{ padding: '0.4rem 0.6rem 0.25rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Filter Kategori Tiket
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketCategoryFilter('all');
                          setIsCategoryDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: ticketCategoryFilter === 'all' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                          color: ticketCategoryFilter === 'all' ? '#0ea5e9' : 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: ticketCategoryFilter === 'all' ? 800 : 500,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span>Semua Kategori</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
                            {tickets.length}
                          </span>
                          {ticketCategoryFilter === 'all' && <Check size={14} color="#0ea5e9" />}
                        </div>
                      </button>
                      {availableCategories.map(cat => {
                        const isSelected = ticketCategoryFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setTicketCategoryFilter(cat.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              backgroundColor: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                              color: isSelected ? '#0ea5e9' : 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <span>{cat.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
                                {cat.count}
                              </span>
                              {isSelected && <Check size={14} color="#0ea5e9" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Priority Dropdown (Only when > 1 priority types exist) */}
              {availablePriorities.length > 1 && (
                <div ref={priorityDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPriorityDropdownOpen(!isPriorityDropdownOpen);
                      setIsCategoryDropdownOpen(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.52rem 0.85rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: ticketPriorityFilter !== 'all' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                      border: `1px solid ${ticketPriorityFilter !== 'all' ? '#ef4444' : 'var(--border-light)'}`,
                      color: ticketPriorityFilter !== 'all' ? '#ef4444' : 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: 'var(--card-shadow)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <AlertCircle size={13} style={{ color: ticketPriorityFilter !== 'all' ? '#ef4444' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span>{ticketPriorityFilter === 'all' ? 'Semua Prioritas' : (PRIORITY_META[ticketPriorityFilter]?.label || ticketPriorityFilter)}</span>
                    <ChevronDown
                      size={13}
                      style={{
                        color: ticketPriorityFilter !== 'all' ? '#ef4444' : 'var(--text-secondary)',
                        transform: isPriorityDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    />
                  </button>

                  {isPriorityDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 1000,
                        minWidth: '220px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                        padding: '0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        animation: 'fadeIn 0.15s ease'
                      }}
                    >
                      <div style={{ padding: '0.4rem 0.6rem 0.25rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Filter Prioritas Tiket
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketPriorityFilter('all');
                          setIsPriorityDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: ticketPriorityFilter === 'all' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                          color: ticketPriorityFilter === 'all' ? '#ef4444' : 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: ticketPriorityFilter === 'all' ? 800 : 500,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span>Semua Prioritas</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
                            {tickets.length}
                          </span>
                          {ticketPriorityFilter === 'all' && <Check size={14} color="#ef4444" />}
                        </div>
                      </button>
                      {availablePriorities.map(prio => {
                        const isSelected = ticketPriorityFilter === prio.id;
                        return (
                          <button
                            key={prio.id}
                            type="button"
                            onClick={() => {
                              setTicketPriorityFilter(prio.id);
                              setIsPriorityDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                              color: isSelected ? prio.color : 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: prio.color }} />
                              <span>{prio.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
                                {prio.count}
                              </span>
                              {isSelected && <Check size={14} color={prio.color} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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
                    gap: '0.35rem',
                    padding: '0.52rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X size={13} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* 3. Unified Triage Tabs (Single Source of Truth) */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'Semua Tiket', count: totalTicketsCount, color: '#0ea5e9', isPriority: false },
                { id: 'unread', label: 'Belum Dibaca', count: tickets.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0)).length, color: '#38bdf8', isPriority: false, isUnreadTab: true },
                { id: 'action_required', label: 'Perlu Respon CS', count: actionRequiredCount, color: '#0ea5e9', isPriority: false },
                { id: 'open', label: 'Open (Baru)', count: openCount, color: '#0ea5e9', isPriority: false },
                { id: 'in_progress', label: 'Sedang Diproses', count: inProgressCount, color: '#f59e0b', isPriority: false },
                { id: 'waiting_user', label: 'Menunggu Merchant', count: waitingUserCount, color: '#a855f7', isPriority: false },
                { id: 'urgent', label: 'Prioritas Urgent', count: urgentCount, color: '#ef4444', isPriority: true },
                { id: 'resolved', label: 'Terselesaikan', count: resolvedCount, color: '#10b981', isPriority: false }
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
                        setTicketsFilter(tab.id);
                        setTicketPriorityFilter('all');
                      }
                    }}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: isActive
                        ? (tab.id === 'unread' ? '#38bdf8' : (tab.id === 'urgent' ? '#ef4444' : (tab.id === 'in_progress' ? '#f59e0b' : (tab.id === 'waiting_user' ? '#a855f7' : (tab.id === 'resolved' ? '#10b981' : '#0ea5e9')))))
                        : 'var(--bg-card)',
                      border: `1px solid ${isActive ? 'transparent' : 'var(--border-light)'}`,
                      color: isActive ? (tab.id === 'unread' ? '#000' : '#ffffff') : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'var(--bg-deep)',
                      color: isActive ? (tab.id === 'unread' ? '#000' : '#ffffff') : (tab.count > 0 && (tab.id === 'unread' || tab.id === 'action_required' || tab.id === 'urgent') ? '#38bdf8' : 'var(--text-muted)'),
                      border: `1px solid ${isActive ? 'rgba(0,0,0,0.1)' : 'var(--border-light)'}`
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3B. Time-Windowing Selector Bar for Selesai / Resolved Tab */}
            {ticketsFilter === 'resolved' && (
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', padding: '0.2rem 0', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.25rem', letterSpacing: '0.5px' }}>
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
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: resolvedTimeRangeFilter === tr.id ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                      color: resolvedTimeRangeFilter === tr.id ? '#10b981' : 'var(--text-secondary)',
                      border: `1px solid ${resolvedTimeRangeFilter === tr.id ? '#10b981' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            )}

            {/* 4. Desktop Table Feed */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Tiket ID &amp; Waktu</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Subjek &amp; Pesan</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Toko &amp; Pengirim</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Kategori &amp; Prioritas</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTickets.map(t => {
                      const messageCount = Array.isArray(t.messages) ? t.messages.length : (t.message_count || 0);
                      const storePlan = String(t.store?.plan || '').toLowerCase();
                      const storeDisplayName = t.store?.store_title || t.store?.name || t.store_slug || t.user?.name || 'Merchant';
                      const msgs = Array.isArray(t.messages) ? t.messages : [];
                      const lastMsg = t.last_msg || (msgs.length > 0 ? msgs[msgs.length - 1] : null);
                      const isUnread = Boolean(t.has_unread || (t.unread_count && t.unread_count > 0));
                      const unreadCount = t.unread_count || 0;
                      const lastSenderName = lastMsg ? (lastMsg.sender_type === 'agent' ? 'CS Support' : getFirstName(getMerchantDisplayName(t, lastMsg.sender))) : '';

                      return (
                        <tr
                          key={t.id}
                          onClick={() => handleOpenTicketChat(t)}
                          style={{
                            borderBottom: '1px solid var(--border-light)',
                            backgroundColor: isUnread ? 'rgba(14, 165, 233, 0.06)' : 'transparent',
                            boxShadow: isUnread ? 'inset 3px 0 0 #0ea5e9' : undefined,
                            cursor: 'pointer',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isUnread ? 'rgba(14, 165, 233, 0.1)' : 'rgba(255,255,255,0.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isUnread ? 'rgba(14, 165, 233, 0.06)' : 'transparent'}
                        >
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              {isUnread && (
                                <span
                                  title="Pesan Baru Belum Dibaca"
                                  style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#38bdf8',
                                    boxShadow: '0 0 8px #38bdf8',
                                    flexShrink: 0
                                  }}
                                />
                              )}
                              <span style={{ fontSize: '0.8rem', fontWeight: isUnread ? 900 : 800, color: '#0ea5e9', fontFamily: 'monospace' }}>
                                {t.ticket_number || `#TCK-${t.id}`}
                              </span>
                              {isUnread && unreadCount > 0 && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '999px',
                                  backgroundColor: 'rgba(14, 165, 233, 0.2)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(14, 165, 233, 0.4)',
                                  letterSpacing: '0.02em'
                                }}>
                                  ● {unreadCount} BARU
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isUnread ? 600 : 400, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={11} /> {formatSupportDateTime(t.last_message_at || t.created_at)}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '340px' }}>
                              <strong style={{ fontSize: '0.84rem', color: isUnread ? '#38bdf8' : 'var(--text-primary)', fontWeight: isUnread ? 900 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.subject || t.title || 'Pertanyaan Layanan Toko'}
                              </strong>
                              <span style={{ fontSize: '0.74rem', color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {lastMsg ? (
                                  <>
                                    <strong style={{ color: lastMsg.sender_type === 'user' ? '#38bdf8' : 'var(--primary)' }}>
                                      {lastSenderName}:
                                    </strong>{' '}
                                    {lastMsg.message || (lastMsg.attachments?.length ? `[${lastMsg.attachments.length} Lampiran Bukti]` : '')}
                                  </>
                                ) : (
                                  t.messages?.[0]?.message || 'Inkuiri Bantuan'
                                )}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Store size={14} color="#0ea5e9" />
                                <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                                  {storeDisplayName}
                                </strong>
                                {storePlan === 'enterprise' && (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '0.1rem 0.4rem', borderRadius: '0.3rem', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                                    ENTERPRISE
                                  </span>
                                )}
                                {storePlan === 'pro' && (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '0.1rem 0.4rem', borderRadius: '0.3rem', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                    PRO
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {t.user?.email || t.user_email || t.email || 'merchant@catavor.com'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.72rem', padding: '0.18rem 0.45rem', borderRadius: '4px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                                  {
                                    t.category === 'billing' ? 'Keuangan & Langganan' :
                                    t.category === 'technical' ? 'Kendala Teknis & Bug' :
                                    t.category === 'catalog_help' ? 'Bantuan Katalog' :
                                    t.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'
                                  }
                                </span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  backgroundColor: (t.priority === 'urgent' || t.priority === 'high') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                                  color: (t.priority === 'urgent' || t.priority === 'high') ? '#ef4444' : '#0ea5e9',
                                  border: `1px solid ${t.priority === 'urgent' || t.priority === 'high' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(14, 165, 233, 0.3)'}`,
                                  textTransform: 'uppercase'
                                }}>
                                  {String(t.priority || 'MEDIUM').toUpperCase()}
                                </span>
                              </div>

                              {/* Multi-Tier SLA Countdown Pill */}
                              {t.sla_breached ? (
                                <span style={{ fontSize: '0.64rem', fontWeight: 900, padding: '0.1rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                                  ⚠️ SLA Terlewat
                                </span>
                              ) : (t.status === 'open' && t.sla_due_at) ? (
                                (() => {
                                  const diffMin = Math.round((new Date(t.sla_due_at).getTime() - Date.now()) / (1000 * 60));
                                  if (diffMin <= 0) {
                                    return (
                                      <span style={{ fontSize: '0.64rem', fontWeight: 900, padding: '0.1rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                                        ⚠️ SLA Terlewat
                                      </span>
                                    );
                                  }
                                  const hours = Math.floor(diffMin / 60);
                                  const mins = diffMin % 60;
                                  const isClose = diffMin < 30;
                                  return (
                                    <span style={{
                                      fontSize: '0.64rem',
                                      fontWeight: 800,
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '4px',
                                      backgroundColor: isClose ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                      color: isClose ? '#f59e0b' : '#10b981',
                                      border: `1px solid ${isClose ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      width: 'fit-content'
                                    }}>
                                      ⏱️ SLA: {hours > 0 ? `${hours}j ` : ''}{mins}m
                                    </span>
                                  );
                                })()
                              ) : t.first_response_at ? (
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  ✓ Respon Pertama Terpenuhi
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <span style={{
                                padding: '0.2rem 0.65rem',
                                borderRadius: '999px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                width: 'fit-content',
                                backgroundColor:
                                  t.status === 'resolved' || t.status === 'closed' ? 'rgba(16, 185, 129, 0.15)' :
                                  t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' :
                                  t.status === 'waiting_user' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                                color:
                                  t.status === 'resolved' || t.status === 'closed' ? '#10b981' :
                                  t.status === 'in_progress' ? '#f59e0b' :
                                  t.status === 'waiting_user' ? '#c084fc' : '#0ea5e9',
                                border: `1px solid ${
                                  t.status === 'resolved' || t.status === 'closed' ? 'rgba(16, 185, 129, 0.3)' :
                                  t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.3)' :
                                  t.status === 'waiting_user' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(14, 165, 233, 0.3)'
                                }`
                              }}>
                                {
                                  t.status === 'open' ? 'Open (Baru)' :
                                  t.status === 'in_progress' ? 'Sedang Diproses' :
                                  t.status === 'waiting_user' ? 'Menunggu Merchant' :
                                  t.status === 'resolved' ? 'Terselesaikan' :
                                  t.status === 'closed' ? 'Ditutup' : String(t.status || 'OPEN').toUpperCase()
                                }
                              </span>

                              {/* CSAT Rating Badge */}
                              {t.rating && (
                                <span
                                  title={t.rating_comment ? `Ulasan: "${t.rating_comment}"` : `Rating Kepuasan: ${t.rating}/5`}
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 900,
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    width: 'fit-content'
                                  }}
                                >
                                  ⭐ {t.rating}/5 CSAT
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MessageSquare size={13} style={{ color: '#0ea5e9' }} /> {messageCount}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTicketChat(t);
                                }}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '0.5rem',
                                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                                  border: '1px solid rgba(14, 165, 233, 0.3)',
                                  color: '#0ea5e9',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <MessageSquare size={13} />
                                <span>Buka Chat</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                          {ticketSearchQuery || ticketsFilter !== 'all' || ticketCategoryFilter !== 'all' || ticketPriorityFilter !== 'all'
                            ? 'Tidak ada antrean tiket yang cocok dengan filter pencarian.'
                            : 'Tidak ada antrian tiket bantuan aktif saat ini.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load More Button for Desktop */}
              {ticketsPagination.has_more && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    disabled={ticketsLoadingMore}
                    onClick={handleLoadMoreTickets}
                    style={{
                      padding: '0.75rem 2rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.5px dashed rgba(14, 165, 233, 0.4)',
                      color: '#0ea5e9',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: ticketsLoadingMore ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: 'var(--card-shadow)',
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
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Menampilkan {tickets.length} dari {ticketsPagination.total_items} tiket
                  </span>
                </div>
              )}
            </div>
          </>
        )}

      {/* Ticket Conversation Chat & Workflow Modal */}
      {selectedTicket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '960px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {selectedTicket.ticket_number || `#TCK-${selectedTicket.id}`}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                    {selectedTicket.subject || 'Support Ticket'}
                  </h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
                  Dari: <strong style={{ color: 'var(--text-primary)' }}>{getMerchantDisplayName(selectedTicket)}</strong> &bull; Email: <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.user?.email || selectedTicket.user_email || '-'}</span> &bull; Toko: {selectedTicket.store?.name || selectedTicket.store_slug || '-'} &bull; Dibuat: {formatSupportDateTime(selectedTicket.created_at)}
                </span>
              </div>
              <button onClick={handleCloseTicketChat} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Tutup Chat &amp; Kembali ke Daftar Tiket">
                <XCircle size={22} />
              </button>
            </div>

            {/* Split Content: Sidebar & Conversation Stream */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Left Sidebar: Status & Info */}
              <div style={{
                width: '280px',
                borderRight: '1px solid var(--border-light)',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-deep)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.1rem',
                overflowY: 'auto'
              }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Status Pengerjaan Tiket:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {[
                      { id: 'open', label: 'Open (Baru)', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)' },
                      { id: 'in_progress', label: 'Sedang Diproses', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
                      { id: 'waiting_user', label: 'Menunggu Merchant', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
                      { id: 'resolved', label: 'Terselesaikan', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                      { id: 'closed', label: 'Ditutup', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
                    ].map(st => {
                      const isActive = selectedTicket.status === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleUpdateTicketStatus(selectedTicket.id, st.id)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${isActive ? st.color : 'transparent'}`,
                            backgroundColor: isActive ? st.bg : 'transparent',
                            color: isActive ? st.color : 'var(--text-secondary)',
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '0.78rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{st.label}</span>
                          {isActive && <Check size={14} color={st.color} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Two-Stage Lifecycle Grace Period & Locked Banners (Desktop Sidebar) */}
                  {selectedTicket.status === 'resolved' && (
                    <div style={{
                      marginTop: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10b981',
                      fontSize: '0.75rem',
                      lineHeight: 1.45,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                        <CheckCircle2 size={15} color="#10b981" />
                        <span>Masa Sanggah (7 Hari)</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Tiket akan otomatis ditutup permanen (Read-Only) jika merchant tidak mengirim balasan sanggahan.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'closed')}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.45rem',
                            backgroundColor: 'rgba(100, 116, 139, 0.2)',
                            border: '1px solid rgba(100, 116, 139, 0.4)',
                            color: 'var(--text-primary)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
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
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Buka Kembali Tiket</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedTicket.status === 'closed' && (
                    <div style={{
                      marginTop: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'rgba(100, 116, 139, 0.15)',
                      border: '1px solid rgba(100, 116, 139, 0.35)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      lineHeight: 1.45,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        <Lock size={14} />
                        <span>Arsip Permanen (Read-Only)</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Percakapan tiket ini telah dikunci permanen.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'in_progress')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.45rem',
                          backgroundColor: 'rgba(14, 165, 233, 0.15)',
                          border: '1px solid rgba(14, 165, 233, 0.35)',
                          color: '#0ea5e9',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginTop: '0.2rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Buka Kembali Tiket</span>
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Informasi Tiket:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Nomor Tiket: </span>
                      <strong style={{ color: '#0ea5e9' }}>{selectedTicket.ticket_number || `#TCK-${selectedTicket.id}`}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Pengirim: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{getMerchantDisplayName(selectedTicket)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Email Akun: </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{selectedTicket.user?.email || selectedTicket.user_email || '-'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Kategori: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {selectedTicket.category === 'billing' ? 'Keuangan & Langganan' :
                         selectedTicket.category === 'technical' ? 'Kendala Teknis & Bug' :
                         selectedTicket.category === 'catalog_help' ? 'Bantuan Katalog & Produk' :
                         selectedTicket.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Urgensi: </span>
                      <span style={{
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: selectedTicket.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                        color: selectedTicket.priority === 'urgent' ? '#ef4444' : '#0ea5e9'
                      }}>
                        {String(selectedTicket.priority || 'medium').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Waktu Dibuat: </span>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.74rem' }}>{formatSupportDateTime(selectedTicket.created_at)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Pembaruan Terakhir: </span>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.74rem' }}>{formatSupportDateTime(selectedTicket.last_message_at || selectedTicket.updated_at)}</span>
                    </div>

                    {/* CSAT Customer Feedback Card in Drawer */}
                    {selectedTicket.rating && (
                      <div style={{
                        marginTop: '0.65rem',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.2rem' }}>
                          Ulasan Kepuasan Merchant:
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f59e0b' }}>
                          ⭐ {selectedTicket.rating} / 5 Bintang
                        </div>
                        {selectedTicket.rating_comment && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            "{selectedTicket.rating_comment}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Area: Conversation Stream & Reply Box */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, backgroundColor: 'var(--bg-card)' }}>
                {/* Agent Collision Warning Banner */}
                {activePresences.length > 0 && (
                  <div style={{
                    padding: '0.55rem 1rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#f59e0b',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}>
                    <AlertTriangle size={14} />
                    <span>
                      {activePresences.map(p => p.admin_name).join(', ')} juga sedang membuka tiket ini
                      {activePresences.some(p => p.is_typing) ? ' dan sedang mengetik balasan...' : '.'}
                    </span>
                  </div>
                )}
                {/* Messages Feed */}
                <div 
                  ref={desktopChatFeedRef}
                  onScroll={(e) => {
                    setShowChatScrollTop(e.currentTarget.scrollTop > 180);
                  }}
                  style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}
                >
                  {/* Floating Chat Scroll to Top Pill */}
                  {showChatScrollTop && (
                    <button
                      type="button"
                      onClick={scrollChatToTop}
                      style={{
                        position: 'sticky',
                        top: '4px',
                        alignSelf: 'center',
                        zIndex: 20,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Kembali ke Pesan Teratas"
                    >
                      <ArrowUp size={13} strokeWidth={2.5} />
                      <span>Kembali ke Atas</span>
                    </button>
                  )}
                  {ticketDetailsLoading ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#0ea5e9' }} />
                      Memuat riwayat percakapan tiket...
                    </div>
                  ) : (!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Belum ada pesan dalam tiket ini.
                    </div>
                  ) : (
                    (() => {
                      const firstUnreadIdx = selectedTicket.messages.findIndex((msg: any) => msg.sender_type === 'user' && !msg.read_at);
                      return selectedTicket.messages.map((m: any, idx: number) => {
                        const isAgent = m.sender_type === 'agent' || m.is_admin;
                        const isInternal = m.is_internal_note;
                        const isSystemBot = m.sender_type === 'system';
                        const isInitialInquiry = idx === 0 && !isAgent && !isInternal && !isSystemBot;
                        const merchantName = getMerchantDisplayName(selectedTicket, m.sender);
                        const showUnreadDivider = firstUnreadIdx > 0 && idx === firstUnreadIdx;

                        return (
                          <React.Fragment key={m.id || idx}>
                            {showUnreadDivider && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.75rem',
                                  margin: '0.75rem 0',
                                  width: '100%'
                                }}
                              >
                                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(14, 165, 233, 0.4)' }} />
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  color: '#38bdf8',
                                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                  padding: '0.2rem 0.65rem',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(14, 165, 233, 0.35)',
                                  letterSpacing: '0.02em',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}>
                                  <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                                  Pesan Baru Belum Terbaca
                                </span>
                                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(14, 165, 233, 0.4)' }} />
                              </div>
                            )}

                            {isSystemBot ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  margin: '0.45rem 0'
                                }}
                              >
                                <div style={{
                                  maxWidth: '92%',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  overflowWrap: 'anywhere',
                                  wordBreak: 'break-word',
                                  padding: '0.95rem 1.15rem',
                                  borderRadius: '0.85rem',
                                  backgroundColor: 'rgba(14, 165, 233, 0.08)',
                                  border: '1px solid rgba(14, 165, 233, 0.3)',
                                  color: 'var(--text-primary)',
                                  boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem', marginBottom: '0.35rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <Bot size={15} color="#0ea5e9" />
                                      <strong style={{ fontSize: '0.78rem', color: '#0ea5e9', fontWeight: 800 }}>
                                        Sistem Otomatis Catavor
                                      </strong>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                                      {formatSupportDateTime(m.created_at)}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                    {m.message}
                                  </p>
                                </div>
                              </div>
                            ) : isInternal ? (
                              <div style={{
                                padding: '0.9rem 1.15rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                border: '1px dashed rgba(245, 158, 11, 0.45)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Lock size={13} /> CATATAN INTERNAL CS (Hanya Terlihat Oleh Tim Admin)
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {formatSupportDateTime(m.created_at)}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Oleh: <strong>{m.sender?.name || 'Staf Admin'}</strong>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                  {m.message}
                                </p>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isAgent ? 'flex-end' : 'flex-start',
                                  gap: '0.25rem',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <div style={{
                                  maxWidth: isInitialInquiry ? '100%' : '88%',
                                  width: isInitialInquiry ? '100%' : 'auto',
                                  boxSizing: 'border-box',
                                  overflowWrap: 'anywhere',
                                  wordBreak: 'break-word',
                                  padding: '1rem 1.25rem',
                                  borderRadius: isInitialInquiry
                                    ? '1rem'
                                    : isAgent
                                      ? '1rem 1rem 0.25rem 1rem'
                                      : '1rem 1rem 1rem 0.25rem',
                                  backgroundColor: isInitialInquiry
                                    ? 'rgba(14, 165, 233, 0.06)'
                                    : isAgent
                                      ? 'rgba(14, 165, 233, 0.12)'
                                      : 'var(--bg-deep)',
                                  border: isInitialInquiry
                                    ? '1px solid rgba(14, 165, 233, 0.35)'
                                    : `1px solid ${isAgent ? 'rgba(14, 165, 233, 0.3)' : 'var(--border-light)'}`,
                                  boxShadow: isInitialInquiry ? '0 4px 16px rgba(0,0,0,0.2)' : undefined
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.45rem', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      {isAgent ? (
                                        <ShieldCheck size={14} color="#0ea5e9" />
                                      ) : (
                                        <Store size={14} color="var(--primary)" />
                                      )}
                                      <strong style={{ color: isAgent ? '#0ea5e9' : 'var(--text-primary)', fontWeight: 800 }}>
                                        {isAgent ? (m.sender?.name || 'Staf CS Catavor') : getFirstName(merchantName)}
                                      </strong>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}>
                                      {formatSupportDateTime(m.created_at)}
                                    </span>
                                  </div>
                                  {m.message ? (
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', wordWrap: 'break-word' }}>
                                      {m.message}
                                    </p>
                                  ) : null}

                                  {m.attachments && m.attachments.length > 0 && (
                                    <div style={{ 
                                      marginTop: m.message ? '0.75rem' : '0.25rem', 
                                      paddingTop: m.message ? '0.65rem' : '0', 
                                      borderTop: m.message ? '1px solid var(--border-light)' : 'none' 
                                    }}>
                                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Paperclip size={12} color={isAgent ? '#0ea5e9' : '#38bdf8'} /> {m.attachments.length} Lampiran Bukti / Screenshot:
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                                        {m.attachments.map((att: any, aIdx: number) => (
                                          <div
                                            key={aIdx}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openAttachmentLightbox(m.attachments, aIdx)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openAttachmentLightbox(m.attachments, aIdx);
                                              }
                                            }}
                                            style={{ width: '85px', height: '85px', borderRadius: '0.6rem', overflow: 'hidden', border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative', backgroundColor: 'rgba(0,0,0,0.5)' }}
                                            title="Klik untuk memperbesar gambar"
                                          >
                                            <img src={att.file_url} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.58rem', padding: '2px 4px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                              <ZoomIn size={10} /> Perbesar
                                            </div>
                                          </div>
                                        ))}
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
                  {/* Anchor for auto-scroll to bottom of chat */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Composer Bar or Locked Read-Only State */}
                {selectedTicket.status === 'closed' ? (
                  <div style={{
                    padding: '1.25rem',
                    borderTop: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: '1px solid var(--border-light)'
                    }}>
                      <Lock size={16} />
                      <span>Tiket telah ditutup permanen (Closed / Read-Only). Balasan dinonaktifkan.</span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderTop: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    {/* Attachment Previews */}
                    {ticketReplyAttachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {ticketReplyAttachments.map((att, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '0.4rem', overflow: 'hidden', border: '1px solid #0ea5e9' }}>
                            <img src={att.file_url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => setTicketReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                              style={{ position: 'absolute', top: 1, right: 1, width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Mode Toggle & Composer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(false)}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: !isInternalNote ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                            color: !isInternalNote ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          💬 Balasan Publik
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(true)}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: isInternalNote ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                            color: isInternalNote ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Lock size={12} />
                          <span>Catatan Internal CS</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {/* Quick Reply Templates Button */}
                        <button
                          type="button"
                          onClick={() => {
                            fetchCannedTemplates();
                            setShowTemplateModal(true);
                          }}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.4rem',
                            backgroundColor: 'rgba(14, 165, 233, 0.12)',
                            border: '1px solid rgba(14, 165, 233, 0.3)',
                            color: '#0ea5e9',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title="Gunakan Template Balasan Cepat (Canned Responses)"
                        >
                          <Zap size={13} />
                          <span>Template Balasan</span>
                        </button>

                        <input
                          type="file"
                          id="desktop-admin-reply-file"
                          multiple
                          accept="image/png, image/jpeg, image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => handleUploadTicketAttachment(e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={isUploadingTicketAttachment}
                          onClick={() => document.getElementById('desktop-admin-reply-file')?.click()}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.4rem',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {isUploadingTicketAttachment ? <RefreshCw size={13} className="animate-spin" /> : <Paperclip size={13} />}
                          <span>Lampirkan Foto</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <textarea
                        ref={ticketTextareaRef}
                        value={replyMessage}
                        onChange={e => setReplyMessage(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if ((replyMessage.trim() || ticketReplyAttachments.length > 0) && !ticketActionLoading) {
                              handleReplyTicket(false);
                            }
                          }
                        }}
                        placeholder={isInternalNote ? "Tulis catatan rahasia untuk tim CS... (Enter untuk kirim, Shift+Enter baris baru)" : "Tulis balasan resmi untuk pemilik toko... (Enter untuk kirim, Shift+Enter baris baru)"}
                        rows={1}
                        style={{
                          flex: 1,
                          minHeight: '38px',
                          maxHeight: '140px',
                          height: 'auto',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isInternalNote ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)',
                          border: `1px solid ${isInternalNote ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-light)'}`,
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          lineHeight: 1.45,
                          outline: 'none',
                          resize: 'none',
                          overflowY: 'auto',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        onClick={() => handleReplyTicket(false)}
                        disabled={ticketActionLoading || (!replyMessage.trim() && ticketReplyAttachments.length === 0)}
                        style={{
                          padding: '0.65rem 1.15rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isInternalNote ? '#f59e0b' : '#0ea5e9',
                          border: 'none',
                          color: isInternalNote ? '#000' : '#fff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          opacity: ticketActionLoading || (!replyMessage.trim() && ticketReplyAttachments.length === 0) ? 0.5 : 1
                        }}
                      >
                        {ticketActionLoading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                        <span>Kirim</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: KELOLA MASTER TEMPLATE BALASAN CEPAT (CANNED RESPONSES) */}
      {supportSubView === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Action Bar & Filter */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-card)',
            padding: '1rem 1.25rem',
            borderRadius: '1rem',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={templateSearchQuery}
                  onChange={e => setTemplateSearchQuery(e.target.value)}
                  placeholder="Cari judul, shortcut (/salam), atau isi template..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                    borderRadius: '0.6rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
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
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: templateCategoryFilter === cat.id ? 800 : 600,
                      backgroundColor: templateCategoryFilter === cat.id ? '#0ea5e9' : 'transparent',
                      color: templateCategoryFilter === cat.id ? '#ffffff' : 'var(--text-secondary)',
                      border: templateCategoryFilter === cat.id ? '1px solid #0ea5e9' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleResetDefaultTemplates}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '0.6rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Kembalikan template ke konfigurasi awal bawaan sistem"
              >
                <RefreshCw size={13} />
                <span>Reset Bawaan</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateTemplate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.05rem',
                  borderRadius: '0.6rem',
                  backgroundColor: '#0ea5e9',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(14,165,233,0.3)'
                }}
              >
                <Plus size={15} />
                <span>Tambah Template</span>
              </button>
            </div>
          </div>

          {/* Templates Grid / Cards */}
          {loadingTemplates ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#0ea5e9' }} />
              <span>Memuat master template...</span>
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
              padding: '3.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px dashed var(--border-light)',
              color: 'var(--text-muted)'
            }}>
              <Zap size={36} style={{ margin: '0 auto 0.6rem', display: 'block', opacity: 0.3 }} />
              <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                Tidak Ada Template yang Cocok
              </strong>
              <p style={{ fontSize: '0.82rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
                Belum ada template balasan pada kategori atau kata kunci ini.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateTemplate}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#0ea5e9',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Buat Template Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
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
                    general: { bg: 'rgba(14, 165, 233, 0.15)', text: '#0ea5e9', label: 'Umum' },
                    billing: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Keuangan' },
                    technical: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Teknis' },
                    closing: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', label: 'Penutupan' },
                    account: { bg: 'rgba(244, 63, 94, 0.15)', text: '#f43f5e', label: 'Akun' }
                  };
                  const catInfo = catColors[tmpl.category] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: tmpl.category };

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
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.12rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: catInfo.bg,
                              color: catInfo.text
                            }}>
                              {catInfo.label}
                            </span>

                            {tmpl.shortcut && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '0.12rem 0.45rem',
                                borderRadius: '0.4rem',
                                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                color: '#0ea5e9'
                              }}>
                                /{tmpl.shortcut}
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

                          <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 800, marginTop: '0.2rem' }}>
                            {tmpl.title}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleTemplateActive(tmpl)}
                            style={{
                              padding: '0.35rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: tmpl.is_active !== false ? '#10b981' : '#94a3b8',
                              cursor: 'pointer'
                            }}
                            title={tmpl.is_active !== false ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                          >
                            {tmpl.is_active !== false ? <Check size={13} /> : <X size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditTemplate(tmpl)}
                            style={{
                              padding: '0.35rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              color: '#0ea5e9',
                              cursor: 'pointer'
                            }}
                            title="Edit Template"
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tmpl.id, tmpl.title)}
                            style={{
                              padding: '0.35rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              cursor: 'pointer'
                            }}
                            title="Hapus Template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Template Content Box */}
                      <div style={{
                        padding: '0.75rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '140px',
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
  );
})()}

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
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={closeAttachmentLightbox}
          >
            {/* Top Header Bar */}
            <div 
              style={{
                padding: '1rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
                zIndex: 10
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.35)'
                }}>
                  {currentIdx + 1} / {total} Foto
                </span>
                <span style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#ffffff'
                }}>
                  {currentImg.file_name || `Lampiran_${currentIdx + 1}`}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  type="button"
                  title="Download Foto"
                  onClick={() => handleDownloadAttachmentImage(currentImg.file_url, currentImg.file_name)}
                  style={{
                    width: '40px',
                    height: '40px',
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
                  <Download size={18} />
                </button>

                <a
                  href={currentImg.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka File Asli di Tab Baru"
                  style={{
                    width: '40px',
                    height: '40px',
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
                  <ExternalLink size={18} />
                </a>

                <button
                  type="button"
                  title="Tutup (Esc)"
                  onClick={closeAttachmentLightbox}
                  style={{
                    width: '40px',
                    height: '40px',
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
                  <X size={20} />
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
                padding: '1rem',
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
              {/* Left Nav Button */}
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
                    left: '2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '48px',
                    height: '48px',
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
                  <ChevronLeft size={24} />
                </button>
              )}

              {/* Right Nav Button */}
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
                    right: '2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '48px',
                    height: '48px',
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
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Center Canvas */}
              <div
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
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
                    maxWidth: '80vw',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: '0.85rem',
                    boxShadow: '0 16px 50px rgba(0,0,0,0.85)',
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
                padding: '1rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)',
                zIndex: 10
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Zoom Controls Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '0.45rem 1.1rem',
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
                  <ZoomOut size={18} />
                </button>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', minWidth: '50px', textAlign: 'center' }}>
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom In"
                  disabled={zoomScale >= 3.5}
                  onClick={() => setZoomScale(prev => Math.min(prev + 0.3, 3.5))}
                  style={{ background: 'none', border: 'none', color: zoomScale >= 3.5 ? 'rgba(255,255,255,0.3)' : '#ffffff', cursor: zoomScale >= 3.5 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  type="button"
                  title="Reset Zoom"
                  onClick={() => {
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Thumbnail Preview Strip */}
              {total > 1 && (
                <div style={{
                  display: 'flex',
                  gap: '0.65rem',
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
                        width: '52px',
                        height: '52px',
                        borderRadius: '0.5rem',
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

      {/* ========================================================================= */}
      {/* 4. FINANCE & BILLING DIVISION                                             */}
      {/* ========================================================================= */}
      {activeDivision === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                Manajemen Keuangan &amp; Langganan Toko
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Pantau pesanan paket langganan merchant, verifikasi pembayaran, dan laporan pendapatan.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'pending', 'paid', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setOrdersFilter(status)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: ordersFilter === status ? '#10b981' : 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    color: ordersFilter === status ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-deep)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>No. Pesanan</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Toko &amp; Pemilik</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Paket Langganan</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Nominal</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status Pembayaran</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => ordersFilter === 'all' || o.status === ordersFilter)
                    .map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          #{o.order_number || o.id}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.store_name || o.store_slug || '-'}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{o.user_email || o.email || '-'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            textTransform: 'uppercase'
                          }}>
                            {o.plan_code || o.plan_name || 'PRO'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                          Rp {(o.amount || o.price || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              o.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' :
                              o.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color:
                              o.status === 'paid' ? '#10b981' :
                              o.status === 'cancelled' ? '#ef4444' : '#f59e0b'
                          }}>
                            {o.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <DollarSign size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5, display: 'block', color: '#10b981' }} />
                        Belum ada data transaksi pesanan paket langganan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONTENT & EDITORIAL DIVISION                                           */}
      {/* ========================================================================= */}
      {activeDivision === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Broadcast Notifications */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                  Siaran Notifikasi Global Platform
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Kirim pengumuman penting kepada seluruh merchant dan pengunjung platform secara real-time.
                </p>
              </div>
              <button
                onClick={() => setShowBroadcastModal(true)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#8b5cf6',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Plus size={16} />
                <span>Buat Siaran Baru</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {broadcasts.map(b => (
                <div key={b.id} style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      color: '#8b5cf6',
                      textTransform: 'uppercase'
                    }}>
                      {b.type || 'INFO'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('id-ID') : ''}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: 'var(--text-primary)' }}>{b.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{b.message}</p>
                </div>
              ))}
              {broadcasts.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1', backgroundColor: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                  Belum ada siaran broadcast aktif. Klik tombol "Buat Siaran Baru" di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Create Modal */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Megaphone size={20} color="#8b5cf6" /> Buat Siaran Notifikasi Global
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Judul Siaran:
                </label>
                <input
                  type="text"
                  required
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                  placeholder="Contoh: Pemeliharaan Server Terjadwal"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Pesan Notifikasi:
                </label>
                <textarea
                  required
                  rows={4}
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  placeholder="Tuliskan rincian pengumuman yang akan diterima seluruh pemilik toko..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Tipe Pengumuman:
                  </label>
                  <select
                    value={broadcastForm.type}
                    onChange={e => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  >
                    <option value="info">Informasi Umum</option>
                    <option value="warning">Peringatan / Urgent</option>
                    <option value="success">Promo &amp; Update Baru</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Target Audiens:
                  </label>
                  <select
                    value={broadcastForm.target_role}
                    onChange={e => setBroadcastForm({ ...broadcastForm, target_role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  >
                    <option value="all">Semua Merchant &amp; Pengunjung</option>
                    <option value="pro">Hanya Toko Pro &amp; Enterprise</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.3rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#8b5cf6',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Send size={15} />
                  <span>Kirim Siaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DESKTOP MODAL: CANNED RESPONSES / QUICK REPLY TEMPLATES */}
      {showTemplateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                  color: '#0ea5e9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Template Balasan Cepat (Canned Responses)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pilih template pesan standar untuk disisipkan otomatis ke form balasan
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleNavigateToTemplatesMaster}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    color: '#0ea5e9',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Buka Halaman Kelola Master Template"
                >
                  <SlidersHorizontal size={13} strokeWidth={2.2} />
                  <span>Kelola Master</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Controls Bar: Search & Category Pills */}
            <div style={{ padding: '1rem 1.5rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Cari judul, shortcut (/salam), atau isi template..."
                  value={templateSearchQuery}
                  onChange={e => setTemplateSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.4rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {templateSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTemplateSearchQuery('')}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Semua Kategori' },
                  { id: 'general', label: 'Umum' },
                  { id: 'billing', label: 'Keuangan & Billing' },
                  { id: 'technical', label: 'Teknis & Solusi' },
                  { id: 'closing', label: 'Penutupan Tiket' },
                  { id: 'account', label: 'Akun & Keamanan' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTemplateCategoryFilter(cat.id)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: templateCategoryFilter === cat.id ? 700 : 500,
                      backgroundColor: templateCategoryFilter === cat.id ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                      color: templateCategoryFilter === cat.id ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Items List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {loadingTemplates ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#0ea5e9' }} />
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
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tidak ada template yang cocok dengan pencarian Anda.
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
                        padding: '1rem 1.15rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#0ea5e9')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                            {tmpl.title}
                          </strong>
                          {tmpl.shortcut && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.12rem 0.45rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'rgba(14, 165, 233, 0.15)',
                              color: '#0ea5e9'
                            }}>
                              /{tmpl.shortcut}
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: 'var(--text-muted)'
                        }}>
                          {tmpl.category}
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
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

      {/* DESKTOP MODAL: TAMBAH / EDIT MASTER TEMPLATE BALASAN CEPAT */}
      {showTemplateFormModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '580px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Zap size={20} color="#0ea5e9" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingTemplate ? 'Edit Master Template Balasan' : 'Tambah Master Template Balasan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateFormModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '80vh', overflowY: 'auto' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
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
                    padding: '0.55rem 0.85rem',
                    borderRadius: '0.6rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Shortcut Singkat
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#0ea5e9', fontWeight: 800, fontSize: '0.84rem' }}>
                      /
                    </span>
                    <input
                      type="text"
                      value={templateForm.shortcut}
                      onChange={e => setTemplateForm({ ...templateForm, shortcut: e.target.value.replace(/^\//, '').toLowerCase() })}
                      placeholder="salam"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.85rem 0.55rem 1.6rem',
                        borderRadius: '0.6rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Kategori Template
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '0.6rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
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
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Isi Template Pesan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Klik tag variabel untuk menyisipkan
                  </span>
                </div>

                {/* Variable Tag Inserters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {[
                    { tag: '{{merchant_name}}', label: 'Nama Merchant' },
                    { tag: '{{store_name}}', label: 'Nama Toko' },
                    { tag: '{{ticket_number}}', label: 'Nomor Tiket' },
                    { tag: '{{agent_name}}', label: 'Nama Petugas CS' }
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => setTemplateForm(prev => ({ ...prev, content: prev.content + v.tag }))}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(14, 165, 233, 0.12)',
                        border: '1px dashed rgba(14, 165, 233, 0.4)',
                        color: '#0ea5e9',
                        cursor: 'pointer'
                      }}
                    >
                      + {v.tag} ({v.label})
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
                    borderRadius: '0.6rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Live Preview Box */}
              {templateForm.content.trim() && (
                <div style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '0.6rem',
                  backgroundColor: 'rgba(14, 165, 233, 0.05)',
                  border: '1px solid rgba(14, 165, 233, 0.2)'
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0ea5e9', display: 'block', marginBottom: '0.3rem' }}>
                    🔍 Pratinjau Teks (Variabel Terisi):
                  </span>
                  <p style={{
                    margin: 0,
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.45,
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={templateForm.is_active}
                    onChange={e => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                  />
                  <span>Template Aktif (Bisa Dipilih CS)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateFormModal(false)}
                    style={{
                      padding: '0.5rem 0.95rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
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
                      padding: '0.5rem 1.25rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#0ea5e9',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      opacity: savingTemplate ? 0.6 : 1
                    }}
                  >
                    {savingTemplate && <RefreshCw size={14} className="animate-spin" />}
                    <span>{editingTemplate ? 'Simpan Perubahan' : 'Tambah Template'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page-level Floating Scroll to Top Button */}
      {showPageScrollTop && !selectedTicket && (
        <button
          type="button"
          onClick={scrollPageToTop}
          style={{
            position: 'fixed',
            right: '28px',
            bottom: '28px',
            zIndex: 99,
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#38bdf8',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          title="Kembali ke Atas Halaman"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
