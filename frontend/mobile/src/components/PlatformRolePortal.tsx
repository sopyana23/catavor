import React, { useState, useEffect, useRef } from 'react';
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
  Paperclip,
  ZoomIn,
  ZoomOut,
  Download,
  MessageCircle
} from 'lucide-react';
import { type UserRBACInfo, hasPermission, isSuperAdmin, getRoleBadge } from '../utils/rbac';
import { AdminRBACManagement } from './AdminRBACManagement';
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
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    inputBg: isDark ? 'rgba(0, 0, 0, 0.3)' : '#f8fafc',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
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

  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

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
  const [ticketsFilter, setTicketsFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');

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

  const openAttachmentLightbox = (images?: { file_url: string; file_name?: string }[], index: number = 0) => {
    if (!images || images.length === 0) return;
    setAttachmentLightbox({
      isOpen: true,
      images,
      currentIndex: Math.max(0, Math.min(index, images.length - 1))
    });
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const closeAttachmentLightbox = () => {
    setAttachmentLightbox(null);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
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

  const [selectedProofOrder, setSelectedProofOrder] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
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
        const res = await fetch('/api/admin/support/tickets', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setTickets(Array.isArray(d) ? d : d.data || d.tickets || []);
        }
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

  // Open ticket and fetch full conversation stream
  const handleOpenTicketChat = async (ticket: any) => {
    setSelectedTicket(ticket);
    setTicketDetailsLoading(true);
    setReplyText('');
    setTicketReplyAttachments([]);
    setIsInternalNote(false);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.data) {
          setSelectedTicket(d.data);
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
    if (!selectedTicket || (!replyText.trim() && ticketReplyAttachments.length === 0)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/reply`, {
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
        setReplyText('');
        setTicketReplyAttachments([]);
        setIsInternalNote(false);
        showToast(isInternalNote ? 'Catatan internal CS berhasil disimpan' : 'Balasan berhasil dikirim ke merchant', 'success');
        if (shouldResolve) {
          await handleUpdateTicketStatus(selectedTicket.id, 'resolved');
        } else {
          // Re-fetch conversation
          handleOpenTicketChat(selectedTicket);
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
  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const totalAlertsCount = pendingReportsCount + openTicketsCount + pendingOrdersCount + (dormancyMetrics?.dormant_stores || 0);

  // Complete dictionary of all platform modules for metadata & headers
  const allModules: Record<ActiveView, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Pusat Ringkasan Eksekutif' },
    rbac: { title: 'Staf & RBAC', subtitle: 'Matriks & Izin Akses' },
    stores: { title: 'Tata Kelola Toko', subtitle: `${dormancyMetrics?.active_stores || 1} Toko Terdaftar` },
    reports: { title: 'Laporan Masuk', subtitle: `${pendingReportsCount} Laporan Pending` },
    support: { title: 'Helpdesk Tiket', subtitle: `${openTicketsCount} Tiket Terbuka` },
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
      badge: openTicketsCount,
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.15rem',
      width: '100%',
      backgroundColor: theme.bg,
      color: theme.textPrimary,
      padding: (activeView === 'support' && selectedTicket)
        ? '0.5rem 0.85rem 7.5rem 0.85rem'
        : isSubPage
          ? '0.5rem 0.85rem 2rem 0.85rem'
          : '0.5rem 0.85rem 5.5rem 0.85rem',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
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
          activeView === 'support' ? `${openTicketsCount} Tiket Terbuka` :
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
                    setSelectedTicket(null);
                  } else {
                    setActiveView('dashboard');
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
                  ? `${selectedTicket.ticket_number || ('#TCK-' + selectedTicket.id)} • ${selectedTicket.user_email || (selectedTicket.user?.email) || selectedTicket.store_name || (selectedTicket.store?.name) || 'Merchant'}`
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
                    onClick={() => setActiveView('reports')}
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
                    onClick={() => setActiveView('support')}
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
                    onClick={() => setActiveView('finance')}
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
                onClick={() => setActiveView(item.id)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '7.5rem' }}>
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
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    {selectedTicket.ticket_number || `#TCK-${selectedTicket.id}`}
                  </span>
                  <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                    {selectedTicket.subject || 'Tiket Pertanyaan Pengguna'}
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', color: theme.textMuted, whiteSpace: 'nowrap', paddingTop: '0.15rem' }}>
                  {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru'}
                </span>
              </div>

              {/* Badges: Category, Urgency, Merchant Info */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: theme.cardAlt,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}>
                  Kategori: {
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

                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: '1px solid rgba(56, 189, 248, 0.25)'
                }}>
                  Pengirim: {selectedTicket.user_email || (selectedTicket.user?.email) || selectedTicket.store_name || (selectedTicket.store?.name) || 'Merchant Platform'}
                </span>
              </div>

              {/* Interactive Status Switcher (Workflow Pipeline) */}
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '0.85rem',
                backgroundColor: theme.cardAlt,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <SlidersHorizontal size={12} /> Status Pengerjaan Tiket:
                  </span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    backgroundColor: 
                      selectedTicket.status === 'open' ? 'rgba(6, 182, 212, 0.15)' :
                      selectedTicket.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' :
                      selectedTicket.status === 'waiting_user' ? 'rgba(168, 85, 247, 0.15)' :
                      selectedTicket.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color:
                      selectedTicket.status === 'open' ? '#06b6d4' :
                      selectedTicket.status === 'in_progress' ? (isDark ? '#fbbf24' : '#d97706') :
                      selectedTicket.status === 'waiting_user' ? (isDark ? '#c084fc' : '#9333ea') :
                      selectedTicket.status === 'resolved' ? (isDark ? '#34d399' : '#059669') : '#94a3b8'
                  }}>
                    {
                      selectedTicket.status === 'open' ? 'Open (Baru)' :
                      selectedTicket.status === 'in_progress' ? 'Sedang Diproses' :
                      selectedTicket.status === 'waiting_user' ? 'Menunggu Merchant' :
                      selectedTicket.status === 'resolved' ? 'Terselesaikan' :
                      selectedTicket.status === 'closed' ? 'Ditutup' : String(selectedTicket.status).toUpperCase()
                    }
                  </span>
                </div>

                {/* Status Switcher Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.25rem' }}>
                  {[
                    { id: 'open', label: 'Open', color: '#06b6d4' },
                    { id: 'in_progress', label: 'Proses', color: isDark ? '#fbbf24' : '#d97706' },
                    { id: 'waiting_user', label: 'Tunggu User', color: isDark ? '#c084fc' : '#9333ea' },
                    { id: 'resolved', label: 'Selesai', color: isDark ? '#34d399' : '#059669' },
                    { id: 'closed', label: 'Tutup', color: '#94a3b8' }
                  ].map((st) => {
                    const isActive = selectedTicket.status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, st.id)}
                        style={{
                          padding: '0.35rem 0.1rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.62rem',
                          fontWeight: isActive ? 900 : 700,
                          backgroundColor: isActive ? st.color : 'transparent',
                          color: isActive ? '#ffffff' : theme.textMuted,
                          border: `1px solid ${isActive ? st.color : theme.border}`,
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Messages Thread Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Initial Inquiry Card */}
              <div style={{
                padding: '0.95rem 1.05rem',
                borderRadius: '1.15rem',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.cardShadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.78rem', color: isDark ? '#38bdf8' : '#0284c7', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                    <MessageSquare size={13} /> Pertanyaan Awal Merchant:
                  </strong>
                  <span style={{ fontSize: '0.62rem', color: theme.textMuted }}>
                    {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.message || selectedTicket.description || 'Tidak ada deskripsi pesan tertulis.'}
                </p>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Paperclip size={11} /> {selectedTicket.attachments.length} Lampiran Foto:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.4rem' }}>
                      {selectedTicket.attachments.map((att: any, idx: number) => (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => openAttachmentLightbox(selectedTicket.attachments, idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openAttachmentLightbox(selectedTicket.attachments, idx);
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Message Bubbles Feed */}
              {ticketDetailsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.8rem' }}>
                  <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#06b6d4' }} />
                  Memuat riwayat percakapan...
                </div>
              ) : selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((msg: any) => {
                  const isAgent = msg.sender_type === 'agent' || msg.is_admin;
                  const isInternal = msg.is_internal_note;

                  if (isInternal) {
                    return (
                      <div
                        key={msg.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '1rem',
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                          border: isDark ? '1px dashed rgba(245, 158, 11, 0.45)' : '1px dashed rgba(245, 158, 11, 0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isDark ? '#fbbf24' : '#d97706', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Lock size={12} /> CATATAN INTERNAL CS (Hanya Terlihat Oleh Tim Admin)
                          </span>
                          <span style={{ fontSize: '0.62rem', color: theme.textMuted }}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600 }}>
                          Oleh: {msg.sender?.name || msg.sender?.email || 'Staf Admin'}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAgent ? 'flex-end' : 'flex-start',
                        gap: '0.2rem'
                      }}
                    >
                      <div style={{
                        maxWidth: '88%',
                        padding: '0.85rem 1rem',
                        borderRadius: isAgent ? '1.1rem 1.1rem 0.25rem 1.1rem' : '1.1rem 1.1rem 1.1rem 0.25rem',
                        backgroundColor: isAgent 
                          ? (isDark ? 'rgba(6, 182, 212, 0.18)' : 'rgba(2, 132, 199, 0.12)')
                          : theme.surface,
                        color: theme.textPrimary,
                        border: isAgent 
                          ? (isDark ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(2, 132, 199, 0.25)')
                          : `1px solid ${theme.border}`,
                        boxShadow: theme.cardShadow
                      }}>
                        {/* Bubble Sender Label & Time */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.74rem', color: isAgent ? '#06b6d4' : (isDark ? '#38bdf8' : '#0284c7'), display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800 }}>
                            {isAgent ? (
                              <>
                                <ShieldCheck size={13} color="#06b6d4" />
                                {msg.sender?.name || 'Catavor Support (Staf)'}
                              </>
                            ) : (
                              <>
                                <Store size={13} />
                                {selectedTicket.store_name || selectedTicket.user_email || 'Merchant'}
                              </>
                            )}
                          </strong>
                          <span style={{ fontSize: '0.62rem', color: theme.textMuted }}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        {/* Message Text */}
                        <p style={{ margin: 0, fontSize: '0.82rem', color: theme.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </p>

                        {/* Attached Images / Screenshots Gallery */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Paperclip size={11} /> {msg.attachments.length} Lampiran Foto:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.4rem' }}>
                              {msg.attachments.map((att: any, idx: number) => (
                                <div
                                  key={idx}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openAttachmentLightbox(msg.attachments, idx)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      openAttachmentLightbox(msg.attachments, idx);
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
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name || `Foto ${idx+1}`}</span>
                                    <ZoomIn size={10} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : null}
            </div>

            {/* 3. Sleek Executive Bottom Reply Composer (Flush to Bottom) */}
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
                      flexShrink: 0
                    }}>
                      <img src={att.file_url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  accept="image/png, image/jpeg, image/webp"
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
                  rows={1}
                  placeholder={isInternalNote ? "Tulis catatan rahasia internal tim CS..." : "Ketik balasan untuk merchant..."}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                  }}
                  style={{
                    flex: 1,
                    minHeight: '36px',
                    maxHeight: '100px',
                    padding: '0.45rem 0.35rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: theme.textPrimary,
                    fontSize: '0.84rem',
                    lineHeight: 1.45,
                    resize: 'none',
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
          </div>
        ) : (
          /* ----------------------------------------------------------------------- */
          /* 4B. TICKET QUEUE LIST (DAFTAR ANTREAN TIKET)                             */
          /* ----------------------------------------------------------------------- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {[
                { id: 'all', label: 'Semua' },
                { id: 'open', label: 'Open' },
                { id: 'in_progress', label: 'Proses' },
                { id: 'waiting_user', label: 'Tunggu Merchant' },
                { id: 'resolved', label: 'Selesai' },
                { id: 'closed', label: 'Ditutup' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTicketsFilter(f.id as any)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    backgroundColor: ticketsFilter === f.id ? '#06b6d4' : theme.chipInactiveBg,
                    color: ticketsFilter === f.id ? (isDark ? '#000000' : '#ffffff') : theme.chipInactiveText,
                    border: `1px solid ${ticketsFilter === f.id ? '#06b6d4' : theme.border}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tickets Feed */}
            {tickets
              .filter(t => ticketsFilter === 'all' || t.status === ticketsFilter)
              .length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1.15rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
                <Inbox size={36} color="#06b6d4" style={{ margin: '0 auto 0.65rem' }} />
                <h4 style={{ margin: 0, color: theme.textPrimary, fontSize: '0.92rem', fontWeight: 800 }}>Tidak Ada Tiket Bantuan</h4>
                <p style={{ margin: '0.25rem 0 0', color: theme.textSecondary, fontSize: '0.76rem' }}>Semua pertanyaan merchant telah terselesaikan.</p>
              </div>
            ) : (
              tickets
                .filter(t => ticketsFilter === 'all' || t.status === ticketsFilter)
                .map(t => {
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

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenTicketChat(t)}
                      style={{
                        padding: '1.05rem',
                        borderRadius: '1.15rem',
                        backgroundColor: theme.surface,
                        border: t.status === 'open' ? '1px solid rgba(6, 182, 212, 0.4)' : `1px solid ${theme.border}`,
                        boxShadow: theme.cardShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      {/* Card Header: Ticket Number, Status Pill, Created Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#06b6d4' }}>
                            {t.ticket_number || `#TCK-${t.id}`}
                          </span>
                          <span style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            backgroundColor: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusBorder}`
                          }}>
                            {statusLabel}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : 'Baru'}
                        </span>
                      </div>

                      {/* Card Subject & Message Preview */}
                      <div>
                        <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.92rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                          {t.subject || 'Pertanyaan Layanan Toko'}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: theme.cardAlt, color: theme.textSecondary }}>
                            {
                              t.category === 'billing' ? 'Keuangan & Langganan' :
                              t.category === 'technical' ? 'Kendala Teknis & Bug' :
                              t.category === 'catalog_help' ? 'Bantuan Katalog & Produk' :
                              t.category === 'account' ? 'Akun & Keamanan' : 'Pertanyaan Umum'
                            }
                          </span>
                          {t.priority && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: t.priority === 'urgent' || t.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.12)',
                              color: t.priority === 'urgent' || t.priority === 'high' ? '#ef4444' : '#06b6d4'
                            }}>
                              {String(t.priority).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: theme.textSecondary,
                          lineHeight: 1.45,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {t.message || t.description || 'Tidak ada pesan tertulis.'}
                        </p>
                      </div>

                      {/* Card Footer: Sender info & Action Button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.55rem', borderTop: `1px solid ${theme.border}` }}>
                        <span style={{ fontSize: '0.72rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Store size={12} /> {t.store_name || t.user_email || (t.user?.email) || (t.store?.name) || 'Merchant'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTicketChat(t);
                          }}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.65rem',
                            backgroundColor: '#06b6d4',
                            color: isDark ? '#000000' : '#ffffff',
                            border: 'none',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <MessageSquare size={13} />
                          <span>Buka Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })
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

      {/* ========================================================================= */}
      {/* 5. MODALS & BOTTOM SHEETS                                                 */}
      {/* ========================================================================= */}

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
                padding: '0.75rem'
              }}
              onClick={(e) => e.stopPropagation()}
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
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: zoomScale > 1 ? 'grab' : 'zoom-in'
                }}
                onDoubleClick={() => {
                  if (zoomScale > 1) {
                    setZoomScale(1);
                    setPanPosition({ x: 0, y: 0 });
                  } else {
                    setZoomScale(2);
                  }
                }}
              >
                <img
                  src={currentImg.file_url}
                  alt={currentImg.file_name || 'Screenshot'}
                  style={{
                    maxWidth: '92vw',
                    maxHeight: '68vh',
                    objectFit: 'contain',
                    borderRadius: '0.75rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.12)'
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
                onClick={() => setActiveView(tab.id)}
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
    </div>
  );
};
