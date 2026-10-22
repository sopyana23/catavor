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
  Printer
} from 'lucide-react';
import { TabletRailNav } from './TabletRailNav';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletPlatformStoresView } from './TabletPlatformStoresView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { AdminRBACManagement } from './AdminRBACManagement';
import { AdminSafeDomainsManagement } from './AdminSafeDomainsManagement';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { type UserRBACInfo, getRoleBadge, isSuperAdmin, hasPermission } from '../utils/rbac';

export const REKBER_FACTORY_DEFAULTS: Record<string, string> = {
  rekber_template_physical: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_general: "Halo *{store_title}*, saya berminat membeli produk berikut:\n\n*Produk:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah ({rekber_website_domain})*.\n\nMohon bantuannya untuk memproses pesanan ini melalui website {rekber_website_url} atau hubungi WhatsApp Admin Rekber Syariah di *+{rekber_wa_number}* agar dapat dibuatkan grup transaksi bersama.\n\nTerima kasih.",
  rekber_template_food: "Halo *{store_title}*, saya ingin memesan menu kuliner berikut:\n\n*Menu:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin menggunakan layanan *Rekber Syariah ({rekber_website_domain})* demi keamanan transaksi.\n\nMohon diproses via {rekber_website_url} atau hubungi WA Rekber *+{rekber_wa_number}*.\n\nTerima kasih.",
  rekber_template_digital: "Halo *{store_title}*, saya berminat membeli produk digital berikut:\n\n*Item:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin bertransaksi via *Rekber Syariah ({rekber_website_domain})*.\n\nMohon bantuannya via {rekber_website_url} atau WA *+{rekber_wa_number}*.\n\nTerima kasih.",
  rekber_template_service: "Halo *{store_title}*, saya ingin menggunakan jasa berikut:\n\n*Layanan:* {item_name}\n*Biaya:* {item_price}\n\nSaya ingin menggunakan proteksi *Rekber Syariah ({rekber_website_domain})*.\n\nSilakan konfirmasi via {rekber_website_url} atau WA *+{rekber_wa_number}*.\n\nTerima kasih.",
  rekber_template_plant: "Halo *{store_title}*, saya berminat membeli tanaman berikut:\n\n*Tanaman:* {item_name}\n*Harga:* {item_price}\n\nSaya ingin menggunakan layanan *Rekber Syariah ({rekber_website_domain})*.\n\nMohon diproses via {rekber_website_url} atau WA *+{rekber_wa_number}*.\n\nTerima kasih.",
  rekber_template_fauna: "Halo *{store_title}*, saya berminat mengadopsi satwa legal berikut:\n\n*Satwa:* {item_name}\n*Mahar/Harga:* {item_price}\n\nSaya ingin bertransaksi secara aman via *Rekber Syariah ({rekber_website_domain})*.\n\nMohon bantuannya via {rekber_website_url} atau WA *+{rekber_wa_number}*.\n\nTerima kasih."
};

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

  // Navigation View State synced with URL (?tab=...)
  const [activeView, setActiveView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || params.get('view');
      if (tab) return tab;
    }
    return 'dashboard';
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Switch View & sync URL
  const handleSwitchView = (newView: string) => {
    setActiveView(newView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newView);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Header Title metadata
  const viewMetadata = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return { title: 'Ringkasan Eksekutif Platform', subtitle: 'Pusat komando dan metrik operasional ekosistem' };
      case 'staff':
        return { title: 'Staf & Role RBAC', subtitle: 'Matriks izin akses dan penugasan staf pengelola' };
      case 'stores':
        return { title: 'Tata Kelola Profil Toko', subtitle: 'Direktori katalog terdaftar dan kepatuhan akun' };
      case 'reports':
        return { title: 'Kepatuhan & Laporan Masyarakat', subtitle: 'Antrean penertiban satwa dilindungi dan barang terlarang' };
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
        return { title: 'Master Data & Proteksi Rekber', subtitle: 'Whitelist domain aman, template CS, dan escrow syariah' };
      case 'audit':
        return { title: 'System-Wide Audit Trail', subtitle: 'Jejak rekaman forensik seluruh tindakan administratif' };
      default:
        return { title: 'Konsol Operasional Platform', subtitle: 'Sistem tata kelola terpadu Catavor' };
    }
  }, [activeView]);

  // Centralized authenticated fetch with automatic 401/403 session eviction
  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await fetch(input, init);
    if (res.status === 401 || res.status === 403) {
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

  // Load metrics from backend
  const loadPlatformStats = useCallback(async () => {
    if (!token) return;
    try {
      // 1. Dormancy metrics
      const dormRes = await authFetch('/api/admin/dormancy/metrics', {
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

      // 2. Pending reports count
      const repRes = await authFetch('/api/admin/reports?status=pending&limit=1', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (repRes.ok) {
        const rj = await repRes.json();
        setPendingReportsCount(rj.pagination?.total || (rj.data ? rj.data.length : 0));
      }

      // 3. Support tickets
      const tckRes = await authFetch('/api/admin/support/tickets?limit=50', {
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

      // 4. Pending billing orders
      const ordRes = await authFetch('/api/admin/subscription/orders', {
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
      // Fail gracefully
    }
  }, [token, authFetch]);

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
  const [reportsFilter, setReportsFilter] = useState<'pending' | 'investigating' | 'action_taken' | 'banned' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [moderationStatus, setModerationStatus] = useState<string>('pending');
  const [moderationAction, setModerationAction] = useState<string>('none');
  const [actionReason, setActionReason] = useState('');
  const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const q = reportsFilter === 'all' ? '' : `?status=${reportsFilter}`;
      const res = await authFetch(`/api/admin/reports${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setReports(j.data || []);
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Gagal memuat antrean laporan', 'error');
      }
    } finally {
      setReportsLoading(false);
    }
  }, [token, reportsFilter, authFetch]);

  useEffect(() => {
    if (activeView === 'reports') {
      fetchReports();
    }
  }, [activeView, fetchReports]);

  const selectedReport = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  useEffect(() => {
    if (selectedReport) {
      setModerationStatus(selectedReport.status === 'pending' ? 'investigating' : selectedReport.status);
      setModerationAction(selectedReport.action_taken || 'none');
      setActionReason(selectedReport.admin_notes || '');
    }
  }, [selectedReport]);

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
        fetchReports();
        loadPlatformStats();
      } else {
        showToast('Gagal memperbarui status laporan', 'error');
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
    const storeName = rep.target_store_name || `Store #${rep.target_store_id || rep.store_id}`;
    const caseId = rep.id || rep.report_number;
    const reason = rep.reason_category || 'Kepatuhan Etalase';
    const text = `Halo Pengelola *${storeName}*,\n\nKami dari Tim Kepatuhan Platform Catavor ingin memberitahukan terkait laporan kepatuhan (Kasus #${caseId}) dengan kategori: *${reason}*.\n\nCatatan Investigasi: ${actionReason || rep.details || 'Harap tinjau etalase Anda agar senantiasa sesuai dengan ketentuan platform Catavor.'}\n\nMohon lakukan penyesuaian atau koordinasi melalui Pusat Bantuan di dashboard toko Anda.\n\nTerima kasih,\nTim Kepatuhan Catavor`;
    return encodeURIComponent(text);
  };

  const handleCopyReportWarning = (rep: any) => {
    const storeName = rep.target_store_name || `Store #${rep.target_store_id || rep.store_id}`;
    const caseId = rep.id || rep.report_number;
    const reason = rep.reason_category || 'Kepatuhan Etalase';
    const text = `[PERINGATAN RESMI KEPATUHAN CATAVOR]\nKasus: #${caseId}\nTarget: ${storeName}\nKategori: ${reason}\nCatatan: ${actionReason || rep.details || 'Pemeriksaan kepatuhan produk'}\nStatus: ${moderationStatus.toUpperCase()}\nTindakan: ${moderationAction}\nTanggal: ${new Date().toLocaleString('id-ID')}`;
    navigator.clipboard.writeText(text);
    showToast('Format teks peringatan disalin ke clipboard', 'success');
  };

  // =========================================================================
  // SUB-VIEW: SUPPORT (Helpdesk CS)
  // =========================================================================
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [supportFilter, setSupportFilter] = useState<'all' | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
  const [supportSearch, setSupportSearch] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [ticketAttachments, setTicketAttachments] = useState<string[]>([]);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/support/tickets?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setTickets(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'support') {
      fetchTickets();
    }
  }, [activeView, fetchTickets]);

  const fetchTicketDetail = async (id: number) => {
    setSelectedTicketId(id);
    try {
      const res = await authFetch(`/api/admin/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setTicketDetail(j.data || j.ticket || j);
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Gagal memuat rincian tiket', 'error');
      }
    }
  };

  const handleSendTicketReply = async () => {
    if (!selectedTicketId || (!ticketReply.trim() && ticketAttachments.length === 0)) return;
    try {
      const res = await authFetch(`/api/admin/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: ticketReply,
          attachments: ticketAttachments
        })
      });
      if (res.ok) {
        showToast('Tanggapan berhasil dikirim');
        setTicketReply('');
        setTicketAttachments([]);
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
      } else {
        showToast('Gagal mengirim balasan', 'error');
      }
    } catch (e: any) {
      if (e?.message !== 'UNAUTHORIZED') {
        showToast('Terjadi kesalahan koneksi', 'error');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/storage/upload?category=support', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const j = await res.json();
        const url = j.url || j.data?.url || j.file_url;
        if (url) {
          setTicketAttachments(prev => [...prev, url]);
          showToast('Lampiran berhasil diunggah');
        }
      } else {
        showToast('Gagal mengunggah berkas', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat upload', 'error');
    } finally {
      setIsUploadingAttachment(false);
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
        showToast(`Status tiket diperbarui ke: ${status.toUpperCase()}`);
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
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
        fetchTickets();
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

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchStatus = supportFilter === 'all' || t.status === supportFilter;
      const matchCategory = ticketCategoryFilter === 'all' || t.category === ticketCategoryFilter;
      const matchPriority = ticketPriorityFilter === 'all' || t.priority === ticketPriorityFilter;
      const matchSearch = !supportSearch ||
        (t.subject || '').toLowerCase().includes(supportSearch.toLowerCase()) ||
        (t.user_name || '').toLowerCase().includes(supportSearch.toLowerCase()) ||
        (t.ticket_number || '').toLowerCase().includes(supportSearch.toLowerCase());
      return matchStatus && matchCategory && matchPriority && matchSearch;
    });
  }, [tickets, supportFilter, ticketCategoryFilter, ticketPriorityFilter, supportSearch]);

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
  const [broadcastSubView, setBroadcastSubView] = useState<'list' | 'create'>('list');
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<number | null>(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    category: 'PENGUMUMAN',
    target_type: 'all',
    type: 'info',
    message: '',
    action_label: '',
    action_url: '',
    show_top_banner: false,
    banner_color: 'blue'
  });
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/notifications?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setBroadcasts(Array.isArray(j) ? j : j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'broadcast') {
      fetchBroadcasts();
    }
  }, [activeView, fetchBroadcasts]);

  const selectedBroadcast = useMemo(() => {
    return broadcasts.find(b => b.id === selectedBroadcastId) || null;
  }, [broadcasts, selectedBroadcastId]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      showToast('Judul dan isi pesan siaran wajib diisi', 'error');
      return;
    }
    setIsSendingBroadcast(true);
    try {
      const payload = {
        title: broadcastForm.title,
        category: broadcastForm.category,
        target_type: broadcastForm.target_type,
        type: broadcastForm.type,
        message: broadcastForm.message,
        action_label: broadcastForm.action_label || undefined,
        action_url: broadcastForm.action_url || undefined,
        notification_action_enabled: Boolean(broadcastForm.action_url),
        show_top_banner: broadcastForm.show_top_banner,
        banner_color: broadcastForm.banner_color
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
        showToast('Siaran pengumuman berhasil disebarkan ke merchant!', 'success');
        setBroadcastForm({
          title: '',
          category: 'PENGUMUMAN',
          target_type: 'all',
          type: 'info',
          message: '',
          action_label: '',
          action_url: '',
          show_top_banner: false,
          banner_color: 'blue'
        });
        setBroadcastSubView('list');
        fetchBroadcasts();
      } else {
        showToast('Gagal menyebarkan siaran pengumuman', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan dan menghapus notifikasi siaran ini?')) return;
    try {
      const res = await authFetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Siaran pengumuman berhasil dihapus');
        setSelectedBroadcastId(null);
        fetchBroadcasts();
      } else {
        showToast('Gagal menghapus siaran', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // =========================================================================
  // SUB-VIEW: AUTOMATION & BOT SENTINEL (11 BOTS MATRIX)
  // =========================================================================
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [automationSubView, setAutomationSubView] = useState<'overview' | 'bots' | 'logs' | 'sandbox'>('overview');
  const [isTriggeringBot, setIsTriggeringBot] = useState<string | null>(null);

  const fetchAutomation = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, logsRes] = await Promise.all([
        authFetch('/api/admin/automation/status', { headers: { Authorization: `Bearer ${token}` } }),
        authFetch('/api/admin/automation/logs?limit=40', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (statusRes.ok) {
        const j = await statusRes.json();
        setAutomationStatus(j.data || null);
      }
      if (logsRes.ok) {
        const lj = await logsRes.json();
        setAutomationLogs(lj.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'automation') {
      fetchAutomation();
    }
  }, [activeView, fetchAutomation]);

  const handleTriggerSpecificBot = async (botId: string) => {
    setIsTriggeringBot(botId);
    try {
      const res = await authFetch('/api/admin/automation/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bot_id: botId })
      });
      if (res.ok) {
        showToast(`Bot ${botId} berhasil dipicu secara manual!`, 'success');
        fetchAutomation();
      } else {
        showToast('Gagal memicu bot worker', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsTriggeringBot(null);
    }
  };

  const BOT_WORKERS_CATALOG = [
    {
      id: 'store_expiry',
      name: 'Bot Kedaluwarsa & Paket Toko',
      category: 'Lifecycle',
      categoryColor: '#3b82f6',
      freq: 'Setiap 1 Jam',
      desc: 'Memeriksa masa aktif paket merchant (Free/Pro). Mengubah status toko menjadi expired dan otomatis mengirimkan pengumuman peringatan perpanjangan.',
      icon: StoreIcon,
      color: '#3b82f6'
    },
    {
      id: 'dormancy_worker',
      name: 'Engine Lifecycle Dormansi Toko',
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
      desc: 'Memindai voucher diskon & banner promo katalog produk merchant yang telah melewati masa berlaku untuk dinonaktifkan otomatis.',
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
      name: 'Bot Panduan Onboarding Toko Baru',
      category: 'Lifecycle',
      categoryColor: '#10b981',
      freq: 'Event-Driven Realtime',
      desc: 'Secara instan menyuntikkan 3 artikel panduan starter kit katalog digital saat ada merchant baru yang menyelesaikan pendaftaran toko.',
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
    adsense_client_id: '',
    ads_auto_enabled: '0',
    ads_test_mode: '0',
    ads_slot_header: '',
    ads_slot_infeed: '',
    ads_txt_content: 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0',
    ga4_measurement_id: '',
    ga4_enabled: '0',
    ga4_debug_mode: '0',
    rekber_enabled: '1',
    rekber_partner_name: 'Rekber Syariah',
    rekber_website_url: 'https://rekbersyariah.com',
    rekber_wa_number: '62811220227',
    rekber_logo_url: '',
    ...REKBER_FACTORY_DEFAULTS
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          setGoogleSettings(prev => ({
            ...prev,
            ...j.data
          }));
        }
      }
    } catch {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    if (activeView === 'monetization' || activeView === 'master-data') {
      fetchSettings();
    }
  }, [activeView, fetchSettings]);

  const handleSaveGoogleSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(googleSettings)
      });
      if (res.ok) {
        showToast('Pengaturan Google & Monetisasi berhasil disimpan!', 'success');
        fetchSettings();
      } else {
        showToast('Gagal menyimpan pengaturan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // =========================================================================
  // SUB-VIEW: MASTER DATA (Rekber, Domains, CS Templates)
  // =========================================================================
  const [masterSubTab, setMasterSubTab] = useState<'rekber' | 'domains' | 'templates'>('rekber');
  const [selectedRekberCategory, setSelectedRekberCategory] = useState<string>('rekber_template_physical');
  const [cannedTemplates, setCannedTemplates] = useState<any[]>([]);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'general' | 'order' | 'animal' | 'technical' | 'billing'>('all');
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    shortcut_code: '',
    category: 'general',
    content: ''
  });

  const fetchCannedTemplates = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/support/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setCannedTemplates(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'master-data' && masterSubTab === 'templates') {
      fetchCannedTemplates();
    }
  }, [activeView, masterSubTab, fetchCannedTemplates]);

  const handleSaveNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.title.trim() || !newTemplate.content.trim()) return;
    try {
      const res = await authFetch('/api/admin/support/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTemplate)
      });
      if (res.ok) {
        showToast('Template balasan CS berhasil disimpan!');
        setShowAddTemplateModal(false);
        setNewTemplate({ title: '', shortcut_code: '', category: 'general', content: '' });
        fetchCannedTemplates();
      } else {
        showToast('Gagal menyimpan template', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Hapus template balasan ini?')) return;
    try {
      const res = await authFetch(`/api/admin/support/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Template berhasil dihapus');
        fetchCannedTemplates();
      } else {
        showToast('Gagal menghapus template', 'error');
      }
    } catch {
      showToast('Gagal menghapus template', 'error');
    }
  };

  const handleResetTemplateDefaults = async () => {
    if (!window.confirm('Reset seluruh template balasan CS ke standar pabrik Catavor?')) return;
    try {
      const res = await authFetch('/api/admin/support/templates/reset-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Template balasan CS berhasil direset ke standar pabrik');
        fetchCannedTemplates();
      } else {
        showToast('Gagal mereset template', 'error');
      }
    } catch {
      showToast('Gagal mereset template', 'error');
    }
  };

  const handleResetRekberDefaults = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mereset seluruh konfigurasi Rekber Syariah ke standar resmi rekbersyariah.com?')) return;
    setIsSavingSettings(true);
    try {
      const res = await authFetch('/api/admin/settings/rekber/reset-defaults', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Konfigurasi Rekber Syariah berhasil direset ke standar pabrik!', 'success');
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
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // =========================================================================
  // SUB-VIEW: AUDIT TRAIL (Forensik Log)
  // =========================================================================
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<number | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'auth' | 'store' | 'order' | 'ticket' | 'system'>('all');

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/audit-logs?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setAuditLogs(j.data || []);
      }
    } catch {
      // Fail silently
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (activeView === 'audit') {
      fetchAuditLogs();
    }
  }, [activeView, fetchAuditLogs]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const action = (log.action || '').toLowerCase();
      const matchFilter =
        auditFilter === 'all' ||
        (auditFilter === 'auth' && (action.includes('login') || action.includes('token') || action.includes('staff'))) ||
        (auditFilter === 'store' && action.includes('store')) ||
        (auditFilter === 'order' && (action.includes('order') || action.includes('subscription'))) ||
        (auditFilter === 'ticket' && (action.includes('ticket') || action.includes('support'))) ||
        (auditFilter === 'system' && (action.includes('system') || action.includes('setting') || action.includes('bot')));

      const matchSearch =
        !auditSearch ||
        action.includes(auditSearch.toLowerCase()) ||
        (log.actor_email || log.actor || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
        (log.description || '').toLowerCase().includes(auditSearch.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [auditLogs, auditFilter, auditSearch]);

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
        await fetchBroadcasts();
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
                  <div style={{ color: 'var(--text-muted)' }}>Katalog Toko Penerima</div>
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
              onClick={handleRefreshData}
              disabled={isRefreshingData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
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
                                Dugaan satwa terlarang / pelanggaran etalase
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
                  {/* Card 1: Direktori Toko */}
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
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Direktori Toko</span>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StoreIcon size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {metrics.active_stores || metrics.total_stores || 1}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                      &bull; {metrics.dormant_stores || 0} Toko Terindikasi Dormansi
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Toko Berlangganan Pro</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {metrics.pro_stores} Toko Aktif
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
                      { key: 'stores', label: 'Direktori Toko', desc: 'Audit & kepatuhan katalog', icon: StoreIcon, color: '#3b82f6' },
                      { key: 'reports', label: 'Kepatuhan & Laporan', desc: 'Investigasi satwa terlarang', icon: AlertOctagon, color: '#ef4444' },
                      { key: 'support', label: 'Bantuan CS', desc: 'Respon tiket merchant', icon: LifeBuoy, color: '#06b6d4' },
                      { key: 'finance', label: 'Keuangan & Billing', desc: 'Verifikasi aktivasi paket Pro', icon: CreditCard, color: '#10b981' },
                      { key: 'staff', label: 'Staf & Role RBAC', desc: 'Penugasan hak akses tim', icon: ShieldCheck, color: '#8b5cf6' },
                      { key: 'broadcast', label: 'Siaran Broadcast', desc: 'Kirim notifikasi masal', icon: Radio, color: '#ec4899' },
                      { key: 'automation', label: 'Mesin Otomatisasi', desc: 'Status bot & scheduler', icon: Cpu, color: '#f97316' },
                      { key: 'monetization', label: 'Monetisasi & Ads', desc: 'Google AdSense & GA4', icon: Flame, color: '#eab308' },
                      { key: 'master-data', label: 'Master Data & Rekber', desc: 'Rekber Syariah & Whitelist', icon: Layers, color: '#10b981' },
                      { key: 'audit', label: 'Audit Trail', desc: 'Log aktivitas forensik sistem', icon: History, color: '#64748b' }
                    ].map(mod => {
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
          {activeView === 'stores' && (
            <TabletPlatformStoresView
              token={token}
              hideHeader={true}
              onLogout={onLogout}
            />
          )}

          {/* TAB 3: REPORTS (KEPATUHAN & LAPORAN) */}
          {activeView === 'reports' && (
            <TabletMasterDetailView
              title="Laporan Masyarakat"
              subtitle={`${reports.length} laporan pelanggaran`}
              selectedId={selectedReportId}
              onClearSelection={() => setSelectedReportId(null)}
              hideHeaderTitle={true}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Filter Pills */}
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
                    {(['pending', 'investigating', 'action_taken', 'banned', 'resolved', 'dismissed', 'all'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setReportsFilter(tab)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '999px',
                          border: `1px solid ${reportsFilter === tab ? 'var(--primary)' : 'var(--border-light)'}`,
                          backgroundColor: reportsFilter === tab ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                          color: reportsFilter === tab ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {tab === 'pending' ? 'Perlu Investigasi' : tab === 'investigating' ? 'Investigasi' : tab === 'action_taken' ? 'Ditindak' : tab === 'banned' ? 'Banned' : tab === 'resolved' ? 'Selesai' : tab === 'dismissed' ? 'Ditolak' : 'Semua'}
                      </button>
                    ))}
                  </div>

                  {/* Master List */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {reportsLoading ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Memuat laporan...</div>
                    ) : reports.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Semua Laporan Selesai Ditangani</div>
                      </div>
                    ) : (
                      reports.map(rep => {
                        const isSelected = selectedReportId === rep.id;
                        const isItem = rep.target_type === 'item';
                        return (
                          <div
                            key={rep.id}
                            onClick={() => setSelectedReportId(rep.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: isItem ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: isItem ? '#a855f7' : '#3b82f6'
                                }}>
                                  {isItem ? 'PRODUK' : 'TOKO'}
                                </span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444' }}>
                                  {rep.reason_category || 'PELANGGARAN'}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                backgroundColor: rep.status === 'pending' ? 'rgba(239, 68, 68, 0.12)' : rep.status === 'action_taken' ? 'rgba(244, 63, 94, 0.12)' : rep.status === 'resolved' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                color: rep.status === 'pending' ? '#ef4444' : rep.status === 'action_taken' ? '#f43f5e' : rep.status === 'resolved' ? '#10b981' : '#94a3b8'
                              }}>
                                {rep.status?.toUpperCase() || 'PENDING'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {rep.target_store_name || `Toko #${rep.target_store_id || rep.store_id}`}
                              {rep.target_item_title && ` &bull; ${rep.target_item_title}`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rep.details || rep.description || 'Tidak ada catatan pelapor'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              }
              detailPane={
                selectedReport ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                    {/* Header Card */}
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: selectedReport.target_type === 'item' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: selectedReport.target_type === 'item' ? '#a855f7' : '#3b82f6'
                          }}>
                            {selectedReport.target_type === 'item' ? 'MODERASI PRODUK' : 'MODERASI TOKO'}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>
                            Kasus #{selectedReport.id} &bull; {selectedReport.reason_category || 'Pelanggaran'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString('id-ID') : '-'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        Target: {selectedReport.target_store_name || `Store #${selectedReport.target_store_id || selectedReport.store_id}`}
                        {selectedReport.target_item_title && ` / Item: ${selectedReport.target_item_title}`}
                      </h3>

                      {/* Forensic Metadata Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Pelapor Email: </span>
                          <span style={{ fontWeight: 700 }}>{selectedReport.reporter_email || 'Anonim'}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Alamat IP Pelapor: </span>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedReport.reporter_ip || '127.0.0.1'}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Uraian Laporan Masyarakat:</div>
                        {selectedReport.details || selectedReport.description || 'Tidak ada uraian laporan tertulis'}
                      </div>

                      {/* Evidence Attachment */}
                      {selectedReport.evidence_image_url && (
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>Bukti Lampiran Foto Pelapor:</div>
                          <img
                            src={selectedReport.evidence_image_url}
                            alt="Bukti Laporan"
                            onClick={() => {
                              setPreviewDocUrl(selectedReport.evidence_image_url);
                              setPreviewDocTitle(`Bukti Kasus #${selectedReport.id}`);
                            }}
                            style={{
                              width: '140px',
                              height: '140px',
                              objectFit: 'cover',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Status & Enforcement Selector */}
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                          Status Peninjauan Laporan
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {[
                            { value: 'investigating', label: 'Investigasi', color: '#f59e0b' },
                            { value: 'action_taken', label: 'Ditindak', color: '#f43f5e' },
                            { value: 'banned', label: 'Banned', color: '#ef4444' },
                            { value: 'resolved', label: 'Selesai', color: '#10b981' },
                            { value: 'dismissed', label: 'Ditolak', color: '#64748b' }
                          ].map(st => (
                            <button
                              key={st.value}
                              type="button"
                              onClick={() => setModerationStatus(st.value)}
                              style={{
                                padding: '0.5rem',
                                borderRadius: '0.55rem',
                                border: `1.5px solid ${moderationStatus === st.value ? st.color : 'var(--border-light)'}`,
                                backgroundColor: moderationStatus === st.value ? `${st.color}20` : 'var(--bg-card)',
                                color: moderationStatus === st.value ? st.color : 'var(--text-muted)',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                              }}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Enforcement Action Selector */}
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                          Tindakan Penegakan Sistem (Real-Time Enforcement)
                        </h4>
                        <select
                          value={moderationAction}
                          onChange={e => setModerationAction(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        >
                          <option value="none">Tanpa Sanksi Otomatis (Hanya Catatan Investigasi)</option>
                          <option value="warning_issued">Terbitkan Peringatan Resmi ke Merchant</option>
                          {selectedReport.target_type === 'item' ? (
                            <>
                              <option value="item_needs_fix">Nonaktifkan Item: Beri Kesempatan Edit & Perbaiki</option>
                              <option value="item_locked">Nonaktifkan & Kunci Item: Pelanggaran Keras</option>
                              <option value="item_banned">Blokir & Hapus Item (Banned Permanen)</option>
                              <option value="item_restored">Pulihkan & Aktifkan Kembali Item</option>
                            </>
                          ) : (
                            <>
                              <option value="catalog_suspended">Bekukan / Suspend Profil Katalog Toko</option>
                              <option value="catalog_banned">Blokir / Banned Permanen Toko & Akun</option>
                              <option value="catalog_reactivated">Pulihkan / Aktifkan Kembali Profil Toko</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Forensic Notes */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Catatan Forensik Staf Pengelola
                        </label>
                        <textarea
                          rows={3}
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          placeholder="Tuliskan keputusan investigasi / alasan penindakan..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Action Execution Buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          disabled={isSubmittingModeration}
                          onClick={() => handleUpdateReportStatus(selectedReport.id, moderationStatus, moderationAction, actionReason)}
                          style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSubmittingModeration ? 'Menerapkan...' : 'Terapkan Tindakan Moderasi'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyReportWarning(selectedReport)}
                          style={{
                            padding: '0.65rem 1rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Copy size={14} />
                          <span>Salin Format Peringatan</span>
                        </button>

                        {selectedReport.target_store_slug && (
                          <a
                            href={`/${selectedReport.target_store_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.65rem 1rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
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
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 4: SUPPORT (PUSAT BANTUAN CS) */}
          {activeView === 'support' && (
            <TabletMasterDetailView
              title="Tiket Helpdesk CS"
              subtitle={`${filteredTickets.length} antrean tiket`}
              selectedId={selectedTicketId}
              onClearSelection={() => setSelectedTicketId(null)}
              hideHeaderTitle={true}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Search and Filters */}
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        value={supportSearch}
                        onChange={e => setSupportSearch(e.target.value)}
                        placeholder="Cari nomor tiket, subjek, merchant..."
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem 0.45rem 2rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Status Filter */}
                    <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
                      {(['all', 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSupportFilter(st)}
                          style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: '999px',
                            border: `1px solid ${supportFilter === st ? 'var(--primary)' : 'var(--border-light)'}`,
                            backgroundColor: supportFilter === st ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                            color: supportFilter === st ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {st.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* Priority & Category Pills */}
                    <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
                      {(['all', 'urgent', 'high', 'medium', 'low'] as const).map(pr => (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setTicketPriorityFilter(pr)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            border: `1px solid ${ticketPriorityFilter === pr ? '#f59e0b' : 'var(--border-light)'}`,
                            backgroundColor: ticketPriorityFilter === pr ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                            color: ticketPriorityFilter === pr ? '#f59e0b' : 'var(--text-muted)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {pr === 'all' ? 'SEMUA PRIORITAS' : pr.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ticket List */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredTickets.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <LifeBuoy size={36} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada tiket dalam antrean</div>
                      </div>
                    ) : (
                      filteredTickets.map(t => {
                        const isSelected = selectedTicketId === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => fetchTicketDetail(t.id)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.3rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: t.priority === 'urgent' ? '#ef4444' : 'var(--primary)' }}>
                                #{t.ticket_number || t.id}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '999px',
                                  backgroundColor: t.priority === 'urgent' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                  color: t.priority === 'urgent' ? '#ef4444' : 'var(--text-muted)'
                                }}>
                                  {t.priority?.toUpperCase() || 'NORMAL'}
                                </span>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  backgroundColor: t.status === 'open' ? 'rgba(239, 68, 68, 0.12)' : t.status === 'in_progress' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                  color: t.status === 'open' ? '#ef4444' : t.status === 'in_progress' ? '#f59e0b' : '#10b981'
                                }}>
                                  {t.status?.toUpperCase() || 'OPEN'}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {t.subject || 'Pertanyaan Layanan'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {t.user_name || t.user_email || 'Merchant'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              }
              detailPane={
                ticketDetail ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                    {/* Ticket Header */}
                    <div style={{
                      padding: '1rem 1.5rem',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-deep)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Tiket #{ticketDetail.ticket_number || ticketDetail.id} &bull; {ticketDetail.user_name || ticketDetail.user_email}
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0 0' }}>
                          {ticketDetail.subject}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Status selector */}
                        <select
                          value={ticketDetail.status || 'open'}
                          onChange={e => handleUpdateTicketStatus(e.target.value)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.78rem',
                            fontWeight: 700
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="waiting_user">Waiting User</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>

                        {/* Priority selector */}
                        <select
                          value={ticketDetail.priority || 'medium'}
                          onChange={e => handleUpdateTicketPriority(ticketDetail.id, e.target.value)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: ticketDetail.priority === 'urgent' ? '#ef4444' : 'var(--text-primary)',
                            fontSize: '0.78rem',
                            fontWeight: 700
                          }}
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>

                    {/* Merchant Action Bar */}
                    {(ticketDetail.user_phone || ticketDetail.store_slug) && (
                      <div style={{ padding: '0.5rem 1.5rem', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
                        {ticketDetail.store_slug && (
                          <a
                            href={`/${ticketDetail.store_slug}`}
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
                            <span>Katalog Toko</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Messages Thread */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Initial message */}
                      <div style={{
                        padding: '1rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        maxWidth: '85%'
                      }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          {ticketDetail.user_name || 'Pelapor'} (Pesan Pembuka)
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                          {ticketDetail.description || ticketDetail.message || 'Tidak ada detail pesan'}
                        </div>
                      </div>

                      {/* Replies */}
                      {(ticketDetail.messages || ticketDetail.replies || []).map((msg: any, idx: number) => {
                        const isStaff = msg.is_staff || msg.is_admin || msg.sender_role === 'staff' || msg.user_id !== ticketDetail.user_id;
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '1rem',
                              borderRadius: '0.85rem',
                              backgroundColor: isStaff ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-deep)',
                              border: `1px solid ${isStaff ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-light)'}`,
                              alignSelf: isStaff ? 'flex-end' : 'flex-start',
                              maxWidth: '85%'
                            }}
                          >
                            <div style={{ fontSize: '0.72rem', color: isStaff ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                              {isStaff ? 'Staf CS Catavor' : ticketDetail.user_name || 'Merchant'}
                            </div>
                            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                              {msg.message || msg.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply Bar */}
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)' }}>
                      {/* Quick Macro & Canned button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowCannedModal(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.45rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Zap size={13} color="#f59e0b" />
                          <span>Gunakan Template CS</span>
                        </button>
                      </div>

                      {/* Attachments preview */}
                      {ticketAttachments.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          {ticketAttachments.map((att, i) => (
                            <div key={i} style={{ position: 'relative', width: '48px', height: '48px' }}>
                              <img
                                src={att}
                                alt="Attachment"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.4rem' }}
                              />
                              <button
                                type="button"
                                onClick={() => setTicketAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                style={{
                                  position: 'absolute',
                                  top: -4,
                                  right: -4,
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '10px'
                                }}
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                          accept="image/*,.pdf"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAttachment}
                          title="Lampirkan File"
                          style={{
                            padding: '0.65rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          <Paperclip size={18} />
                        </button>
                        <textarea
                          rows={2}
                          value={ticketReply}
                          onChange={e => setTicketReply(e.target.value)}
                          placeholder="Tuliskan respon bantuan ke merchant..."
                          style={{
                            flex: 1,
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            resize: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSendTicketReply}
                          style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Send size={16} />
                          <span>Kirim</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          )}

          {/* TAB 5: FINANCE (KEUANGAN & BILLING) */}
          {activeView === 'finance' && (
            <TabletMasterDetailView
              title="Billing Langganan Pro"
              subtitle={`${filteredOrders.length} order transaksi`}
              hideHeaderTitle={true}
              selectedId={selectedOrderId}
              onClearSelection={() => setSelectedOrderId(null)}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Status Filter */}
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
                    {(['all', 'pending_verification', 'pending_payment', 'paid', 'rejected'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setFinanceFilter(tab)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '999px',
                          border: `1px solid ${financeFilter === tab ? '#10b981' : 'var(--border-light)'}`,
                          backgroundColor: financeFilter === tab ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          color: financeFilter === tab ? '#10b981' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {tab === 'all' ? 'Semua' : tab === 'pending_verification' ? 'Verifikasi' : tab === 'paid' ? 'Lunas' : tab.toUpperCase()}
                      </button>
                    ))}
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
                      {selectedOrder.status !== 'paid' && selectedOrder.status !== 'active' && (
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
          {activeView === 'staff' && (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <AdminRBACManagement
                token={token}
                currentUserEmail={currentUser?.email}
                themeMode={themeMode}
              />
            </div>
          )}

          {/* TAB 7: BROADCAST (SIARAN PENGUMUMAN) */}
          {activeView === 'broadcast' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Top Sub-Switcher */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-deep)'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setBroadcastSubView('list')}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '0.55rem',
                      border: `1px solid ${broadcastSubView === 'list' ? 'var(--primary)' : 'var(--border-light)'}`,
                      backgroundColor: broadcastSubView === 'list' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                      color: broadcastSubView === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Daftar Siaran ({broadcasts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastSubView('create')}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '0.55rem',
                      border: `1px solid ${broadcastSubView === 'create' ? 'var(--primary)' : 'var(--border-light)'}`,
                      backgroundColor: broadcastSubView === 'create' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                      color: broadcastSubView === 'create' ? 'var(--primary)' : 'var(--text-muted)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Buat Siaran Baru
                  </button>
                </div>
              </div>

              {/* Sub-View 1: List Broadcasts (Master Detail) */}
              {broadcastSubView === 'list' && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <TabletMasterDetailView
                    title="Siaran Terkirim"
                    subtitle={`${broadcasts.length} pengumuman`}
                    hideHeaderTitle={true}
                    selectedId={selectedBroadcastId}
                    onClearSelection={() => setSelectedBroadcastId(null)}
                    masterPane={
                      <div style={{ padding: '0.75rem', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {broadcasts.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <Radio size={36} color="#ec4899" style={{ marginBottom: '0.5rem' }} />
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Belum ada siaran disebarkan</div>
                          </div>
                        ) : (
                          broadcasts.map(bc => {
                            const isSelected = selectedBroadcastId === bc.id;
                            return (
                              <div
                                key={bc.id}
                                onClick={() => setSelectedBroadcastId(bc.id)}
                                style={{
                                  padding: '0.85rem',
                                  borderRadius: '0.75rem',
                                  backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.12)' : 'var(--bg-card)',
                                  border: `1px solid ${isSelected ? '#ec4899' : 'var(--border-light)'}`,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ec4899' }}>
                                    {bc.category || 'PENGUMUMAN'}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {bc.created_at ? new Date(bc.created_at).toLocaleDateString('id-ID') : '-'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {bc.title}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Sasaran: {bc.target_type === 'all' ? 'Semua Merchant' : bc.target_type?.toUpperCase()}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    }
                    detailPane={
                      selectedBroadcast ? (
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                          <div style={{
                            padding: '1.25rem',
                            borderRadius: '1rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ec4899' }}>
                                {selectedBroadcast.category || 'PENGUMUMAN'} &bull; Target: {selectedBroadcast.target_type}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteBroadcast(selectedBroadcast.id)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: '#ef4444',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Batalkan Siaran
                              </button>
                            </div>

                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.75rem 0' }}>
                              {selectedBroadcast.title}
                            </h3>

                            <div style={{
                              padding: '1rem',
                              borderRadius: '0.75rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.85rem',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap'
                            }}>
                              {selectedBroadcast.message}
                            </div>

                            {selectedBroadcast.action_url && (
                              <div style={{ marginTop: '1rem' }}>
                                <a
                                  href={selectedBroadcast.action_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.55rem 1rem',
                                    borderRadius: '0.55rem',
                                    backgroundColor: 'var(--primary)',
                                    color: '#ffffff',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                >
                                  <span>{selectedBroadcast.action_label || 'Buka Tautan'}</span>
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </div>
              )}

              {/* Sub-View 2: Create Broadcast Form */}
              {broadcastSubView === 'create' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1.25rem 0' }}>
                      Buat Siaran Pengumuman Masal
                    </h3>

                    <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Judul Pengumuman
                        </label>
                        <input
                          type="text"
                          required
                          value={broadcastForm.title}
                          onChange={e => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Contoh: Pemeliharaan Sistem & Fitur Baru Rekber"
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Kategori Siaran
                          </label>
                          <select
                            value={broadcastForm.category}
                            onChange={e => setBroadcastForm(prev => ({ ...prev, category: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <option value="PENGUMUMAN">Pengumuman Resmi</option>
                            <option value="PEMELIHARAAN">Jadwal Maintenance</option>
                            <option value="PROMO">Promosi & Diskon</option>
                            <option value="URGENT">Peringatan Kepatuhan</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Target Sasaran Penerima
                          </label>
                          <select
                            value={broadcastForm.target_type}
                            onChange={e => setBroadcastForm(prev => ({ ...prev, target_type: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <option value="all">Semua Toko Merchant</option>
                            <option value="pro">Hanya Toko Paket Pro</option>
                            <option value="free">Hanya Toko Paket Free</option>
                            <option value="active">Hanya Toko Aktif</option>
                            <option value="dormant">Toko Indikasi Dormansi</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Isi Pesan Siaran
                        </label>
                        <textarea
                          rows={6}
                          required
                          value={broadcastForm.message}
                          onChange={e => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Tuliskan pesan siaran lengkap yang akan diterima oleh dashboard merchant..."
                          style={{
                            width: '100%',
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            lineHeight: 1.5
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Label Tombol Aksi (Opsional)
                          </label>
                          <input
                            type="text"
                            value={broadcastForm.action_label}
                            onChange={e => setBroadcastForm(prev => ({ ...prev, action_label: e.target.value }))}
                            placeholder="Contoh: Baca Selengkapnya"
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

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            URL Tautan Aksi (Opsional)
                          </label>
                          <input
                            type="url"
                            value={broadcastForm.action_url}
                            onChange={e => setBroadcastForm(prev => ({ ...prev, action_url: e.target.value }))}
                            placeholder="https://catavor.com/promo"
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
                      </div>

                      {/* Announcement Top Banner Switch */}
                      <div style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Tampilkan Banner Pengumuman di Atas Katalog Toko</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Menyematkan strip banner resmi di bagian paling atas halaman etalase publik merchant
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={broadcastForm.show_top_banner}
                            onChange={e => setBroadcastForm(prev => ({ ...prev, show_top_banner: e.target.checked }))}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </div>

                        {broadcastForm.show_top_banner && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Warna Aksen Banner:</span>
                            {(['blue', 'emerald', 'amber', 'rose'] as const).map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setBroadcastForm(prev => ({ ...prev, banner_color: c }))}
                                style={{
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '999px',
                                  border: `1.5px solid ${broadcastForm.banner_color === c ? 'var(--primary)' : 'var(--border-light)'}`,
                                  backgroundColor: c === 'blue' ? '#3b82f6' : c === 'emerald' ? '#10b981' : c === 'amber' ? '#f59e0b' : '#ef4444',
                                  color: '#ffffff',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                {c.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button
                          type="button"
                          onClick={() => setBroadcastSubView('list')}
                          style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isSendingBroadcast}
                          style={{
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#ec4899',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSendingBroadcast ? 'Mengirim Siaran...' : 'Sebarkan Siaran Sekarang'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: AUTOMATION (MESIN OTOMATISASI & 11 BOTS) */}
          {activeView === 'automation' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Sub-Switch: Overview vs Bots vs Logs */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-deep)'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { key: 'overview', label: 'Ringkasan Daemon' },
                    { key: 'bots', label: '11 Bot Platform' },
                    { key: 'logs', label: `Riwayat Log (${automationLogs.length})` },
                    { key: 'sandbox', label: 'Sandbox Simulator' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAutomationSubView(tab.key as any)}
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: '0.55rem',
                        border: `1px solid ${automationSubView === tab.key ? 'var(--primary)' : 'var(--border-light)'}`,
                        backgroundColor: automationSubView === tab.key ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                        color: automationSubView === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerSpecificBot('all')}
                  disabled={Boolean(isTriggeringBot)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isTriggeringBot === 'all' ? 'Menjalankan...' : 'Jalankan Seluruh Bot'}
                </button>
              </div>

              {/* Sub-Tab 1: Overview */}
              {automationSubView === 'overview' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      padding: '1.5rem',
                      borderRadius: '1.25rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 12px #10b981' }} />
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                            Status Mesin: 11 Bot Worker Aktif &amp; Terjadwal (24/7 Daemon)
                          </h3>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Mesin otomatisasi Catavor mengelola siklus hidup merchant (inaktivitas &amp; dormansi), kedaluwarsa kupon &amp; flash sale katalog, penegakan SLA tiket helpdesk, pemusnahan sampah berkas PDP, serta pengiriman siaran streaming SSE secara mandiri di latar belakang.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', paddingTop: '0.5rem' }}>
                        <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Bot Terdaftar</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>11 Worker</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Jadwal Siklus Terpendek</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>5 Menit</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SSE Gateway Streaming</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem' }}>Terhubung</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Database Background Tasks</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>Optimal</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: 11 Bot Matrix Cards */}
              {automationSubView === 'bots' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {BOT_WORKERS_CATALOG.map(bot => {
                      const Icon = bot.icon;
                      const isRunning = isTriggeringBot === bot.id;
                      return (
                        <div
                          key={bot.id}
                          style={{
                            padding: '1.25rem',
                            borderRadius: '1rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '0.75rem',
                              backgroundColor: `${bot.color}20`,
                              color: bot.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Icon size={22} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{bot.name}</span>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  backgroundColor: `${bot.categoryColor}20`,
                                  color: bot.categoryColor
                                }}>
                                  {bot.category}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                                {bot.desc}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                Frekuensi: {bot.freq}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTriggerSpecificBot(bot.id)}
                            disabled={isRunning}
                            style={{
                              padding: '0.55rem 1.15rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isRunning ? 'Menjalankan...' : 'Jalankan Sekarang'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Logs Table */}
              {automationSubView === 'logs' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        Jejak Eksekusi Otomatisasi Terkini
                      </h4>
                      {automationLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          Belum ada riwayat log eksekusi bot
                        </div>
                      ) : (
                        automationLogs.map((log, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 800, color: '#f97316', marginRight: '0.5rem' }}>
                                [{log.bot_id || log.worker || 'BOT'}]
                              </span>
                              <span>{log.message || log.details || 'Tugas background selesai'}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                              {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Sandbox Simulator */}
              {automationSubView === 'sandbox' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                  <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{
                      padding: '1.5rem',
                      borderRadius: '1.25rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={20} color="#f59e0b" />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                          Sandbox Simulator &amp; Pengujian Bot
                        </h3>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Gunakan konsol simulator ini untuk menguji pemicu notifikasi panduan toko baru atau simulasi evaluasi kedaluwarsa tanpa mempengaruhi data produksi riil.
                      </p>

                      <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>Uji Pemicu Onboarding Engine Toko Baru</div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleTriggerSpecificBot('onboarding_engine')}
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: '0.55rem',
                              border: 'none',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Simulasikan Injeksi Starter Kit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerSpecificBot('support_lifecycle')}
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Simulasikan Audit SLA Tiket
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
          {activeView === 'monetization' && (
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
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${monetizationSubTab === 'adsense' ? '#eab308' : 'var(--border-light)'}`,
                    backgroundColor: monetizationSubTab === 'adsense' ? 'rgba(234, 179, 8, 0.12)' : 'var(--bg-card)',
                    color: monetizationSubTab === 'adsense' ? '#eab308' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Google AdSense (Monetisasi Iklan)
                </button>
                <button
                  type="button"
                  onClick={() => setMonetizationSubTab('analytics')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${monetizationSubTab === 'analytics' ? 'var(--primary)' : 'var(--border-light)'}`,
                    backgroundColor: monetizationSubTab === 'analytics' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    color: monetizationSubTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Google Analytics 4 (GA4)
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', boxSizing: 'border-box' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  {monetizationSubTab === 'adsense' && (
                    <form onSubmit={handleSaveGoogleSettings} style={{
                      padding: '1.5rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                            Integrasi Google AdSense
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            Monetisasi etalase publik melalui slot banner dan in-feed resmi Google.
                          </p>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Status Iklan:</span>
                          <input
                            type="checkbox"
                            checked={googleSettings.ads_enabled === '1'}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, ads_enabled: e.target.checked ? '1' : '0' }))}
                          />
                        </label>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Publisher Client ID (ca-pub-...)
                        </label>
                        <input
                          type="text"
                          value={googleSettings.adsense_client_id}
                          onChange={e => setGoogleSettings(prev => ({ ...prev, adsense_client_id: e.target.value }))}
                          placeholder="ca-pub-1234567890123456"
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Header Banner Slot ID
                          </label>
                          <input
                            type="text"
                            value={googleSettings.ads_slot_header}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_header: e.target.value }))}
                            placeholder="Contoh: 1234567890"
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

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            In-Feed Catalog Slot ID
                          </label>
                          <input
                            type="text"
                            value={googleSettings.ads_slot_infeed}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, ads_slot_infeed: e.target.value }))}
                            placeholder="Contoh: 9876543210"
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
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                            Konten ads.txt Resmi
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(googleSettings.ads_txt_content);
                              showToast('Konten ads.txt disalin ke clipboard');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Salin Teks
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={googleSettings.ads_txt_content}
                          onChange={e => setGoogleSettings(prev => ({ ...prev, ads_txt_content: e.target.value }))}
                          placeholder="google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          style={{
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#eab308',
                            color: '#000000',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSavingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi AdSense'}
                        </button>
                      </div>
                    </form>
                  )}

                  {monetizationSubTab === 'analytics' && (
                    <form onSubmit={handleSaveGoogleSettings} style={{
                      padding: '1.5rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                          Google Analytics 4 (GA4)
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                          Pengukuran lalu lintas pengunjung katalog digital dan analitik konversi platform.
                        </p>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Measurement ID (G-XXXXXXXXXX)
                        </label>
                        <input
                          type="text"
                          value={googleSettings.ga4_measurement_id}
                          onChange={e => setGoogleSettings(prev => ({ ...prev, ga4_measurement_id: e.target.value }))}
                          placeholder="G-ABC123XYZ"
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

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          style={{
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSavingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi GA4'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: MASTER DATA (REKBER, DOMAINS, CS TEMPLATES) */}
          {activeView === 'master-data' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 3 Sub-Tabs */}
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
                  onClick={() => setMasterSubTab('rekber')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${masterSubTab === 'rekber' ? '#10b981' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'rekber' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                    color: masterSubTab === 'rekber' ? '#10b981' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Proteksi Rekber Syariah
                </button>
                <button
                  type="button"
                  onClick={() => setMasterSubTab('domains')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${masterSubTab === 'domains' ? 'var(--primary)' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'domains' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    color: masterSubTab === 'domains' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Whitelist Domain Aman
                </button>
                <button
                  type="button"
                  onClick={() => setMasterSubTab('templates')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.55rem',
                    border: `1px solid ${masterSubTab === 'templates' ? '#8b5cf6' : 'var(--border-light)'}`,
                    backgroundColor: masterSubTab === 'templates' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                    color: masterSubTab === 'templates' ? '#8b5cf6' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Template Balasan CS ({cannedTemplates.length})
                </button>
              </div>

              {/* Subtab Content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* 1. Rekber Syariah */}
                {masterSubTab === 'rekber' && (
                  <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
                    <form onSubmit={handleSaveGoogleSettings} style={{
                      maxWidth: '850px',
                      margin: '0 auto',
                      padding: '1.5rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                            Konfigurasi Escrow Rekber Syariah
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            Proteksi transaksi jual-beli aman dan bebas riba bagi pembeli dan merchant.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetRekberDefaults}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Reset Standar Pabrik
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            Nama Mitra Rekber
                          </label>
                          <input
                            type="text"
                            value={googleSettings.rekber_partner_name}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, rekber_partner_name: e.target.value }))}
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

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                            WhatsApp Hotline Rekber
                          </label>
                          <input
                            type="text"
                            value={googleSettings.rekber_wa_number}
                            onChange={e => setGoogleSettings(prev => ({ ...prev, rekber_wa_number: e.target.value }))}
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
                      </div>

                      {/* 7 WhatsApp Category Templates Selector */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                          Pilih Template WhatsApp Berdasarkan Kategori Bisnis:
                        </label>
                        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '0.75rem' }}>
                          {[
                            { key: 'rekber_template_physical', label: 'Produk Fisik' },
                            { key: 'rekber_template_general', label: 'Barang Umum' },
                            { key: 'rekber_template_food', label: 'Kuliner' },
                            { key: 'rekber_template_digital', label: 'Digital' },
                            { key: 'rekber_template_service', label: 'Jasa/Layanan' },
                            { key: 'rekber_template_plant', label: 'Tanaman' },
                            { key: 'rekber_template_fauna', label: 'Fauna/Satwa' }
                          ].map(cat => (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => setSelectedRekberCategory(cat.key)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '999px',
                                border: `1px solid ${selectedRekberCategory === cat.key ? '#10b981' : 'var(--border-light)'}`,
                                backgroundColor: selectedRekberCategory === cat.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-deep)',
                                color: selectedRekberCategory === cat.key ? '#10b981' : 'var(--text-muted)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={6}
                          value={googleSettings[selectedRekberCategory] || ''}
                          onChange={e => setGoogleSettings(prev => ({ ...prev, [selectedRekberCategory]: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            boxSizing: 'border-box',
                            lineHeight: 1.5
                          }}
                        />

                        {/* Variables tag guide */}
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tag Dinamis:</span>
                          {['{store_title}', '{item_name}', '{item_price}', '{rekber_website_domain}', '{rekber_wa_number}'].map(tag => (
                            <span
                              key={tag}
                              onClick={() => {
                                setGoogleSettings(prev => ({
                                  ...prev,
                                  [selectedRekberCategory]: `${prev[selectedRekberCategory] || ''} ${tag}`
                                }));
                              }}
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-light)',
                                fontSize: '0.68rem',
                                fontFamily: 'monospace',
                                color: 'var(--primary)',
                                cursor: 'pointer'
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          style={{
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.55rem',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isSavingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi Rekber'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 2. Whitelist Safe Domains */}
                {masterSubTab === 'domains' && (
                  <AdminSafeDomainsManagement
                    token={token}
                    themeMode={themeMode}
                  />
                )}

                {/* 3. Canned Templates CS */}
                {masterSubTab === 'templates' && (
                  <div style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
                    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {(['all', 'general', 'order', 'animal', 'technical', 'billing'] as const).map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setTemplateFilter(cat)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '999px',
                                border: `1px solid ${templateFilter === cat ? '#8b5cf6' : 'var(--border-light)'}`,
                                backgroundColor: templateFilter === cat ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                                color: templateFilter === cat ? '#8b5cf6' : 'var(--text-muted)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {cat.toUpperCase()}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={handleResetTemplateDefaults}
                            style={{
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Reset Default
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddTemplateModal(true)}
                            style={{
                              padding: '0.45rem 1rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              backgroundColor: '#8b5cf6',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            + Tambah Template
                          </button>
                        </div>
                      </div>

                      {/* Template List */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
                        {cannedTemplates
                          .filter(t => templateFilter === 'all' || t.category === templateFilter)
                          .map(t => (
                            <div
                              key={t.id}
                              style={{
                                padding: '1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8b5cf6' }}>
                                  [{t.category?.toUpperCase() || 'UMUM'}] {t.shortcut_code && `(${t.shortcut_code})`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(t.id)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '0.2rem'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{t.title}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                {t.content}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 11: AUDIT TRAIL (FORENSIK SISTEM) */}
          {activeView === 'audit' && (
            <TabletMasterDetailView
              title="Forensik Audit Trail"
              subtitle={`${filteredAuditLogs.length} rekaman audit`}
              selectedId={selectedAuditLogId}
              onClearSelection={() => setSelectedAuditLogId(null)}
              hideHeaderTitle={true}
              masterPane={
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={e => setAuditSearch(e.target.value)}
                        placeholder="Cari aksi atau email aktor..."
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem 0.45rem 2rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
                      {(['all', 'auth', 'store', 'order', 'ticket', 'system'] as const).map(flt => (
                        <button
                          key={flt}
                          type="button"
                          onClick={() => setAuditFilter(flt)}
                          style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: '999px',
                            border: `1px solid ${auditFilter === flt ? 'var(--primary)' : 'var(--border-light)'}`,
                            backgroundColor: auditFilter === flt ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                            color: auditFilter === flt ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {flt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredAuditLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <History size={36} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tidak ada rekaman audit</div>
                      </div>
                    ) : (
                      filteredAuditLogs.map((log, idx) => {
                        const logId = log.id || idx;
                        const isSelected = selectedAuditLogId === logId;
                        return (
                          <div
                            key={logId}
                            onClick={() => setSelectedAuditLogId(logId)}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.75rem',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {log.action || 'ACTION'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID') : '-'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {log.description || log.target || 'Tindakan sistem'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Oleh: {log.actor_email || log.actor || 'System'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              }
              detailPane={
                selectedAuditLog ? (
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>
                          [{selectedAuditLog.action}]
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {selectedAuditLog.created_at ? new Date(selectedAuditLog.created_at).toLocaleString('id-ID') : '-'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        {selectedAuditLog.description || selectedAuditLog.target}
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.8rem', marginTop: '1rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Aktor Pengguna</div>
                          <div style={{ fontWeight: 800 }}>{selectedAuditLog.actor_email || selectedAuditLog.actor || 'System'}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Alamat IP</div>
                          <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>{selectedAuditLog.ip_address || selectedAuditLog.ip || '127.0.0.1'}</div>
                        </div>
                      </div>

                      {/* Raw Payload JSON */}
                      {selectedAuditLog.payload && (
                        <div style={{ marginTop: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                              Payload Data Forensik:
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const text = typeof selectedAuditLog.payload === 'string'
                                  ? selectedAuditLog.payload
                                  : JSON.stringify(selectedAuditLog.payload, null, 2);
                                navigator.clipboard.writeText(text);
                                showToast('Payload audit disalin ke clipboard');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Copy size={13} />
                              <span>Salin JSON</span>
                            </button>
                          </div>
                          <pre style={{
                            margin: 0,
                            padding: '0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.75rem',
                            color: 'var(--text-primary)',
                            overflowX: 'auto',
                            fontFamily: 'monospace'
                          }}>
                            {typeof selectedAuditLog.payload === 'string'
                              ? selectedAuditLog.payload
                              : JSON.stringify(selectedAuditLog.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </main>
    </div>
  );
};
