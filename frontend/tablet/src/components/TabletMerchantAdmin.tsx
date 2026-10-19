import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Store as StoreIcon,
  Package,
  FolderTree,
  BarChart3,
  SlidersHorizontal,
  CreditCard,
  UserCheck,
  Bell,
  HelpCircle,
  FileText,
  Share2,
  LogOut,
  ExternalLink,
  Plus,
  Trash2,
  Save,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Tag,
  Phone,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Lock,
  Laptop,
  Smartphone,
  Key,
  QrCode,
  Copy,
  Send,
  MessageCircle,
  Layers,
  ShieldAlert,
  Sparkles,
  Palette,
  Check
} from 'lucide-react';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';

export type TabletMerchantTab =
  | 'items'
  | 'categories'
  | 'analytics'
  | 'subscription'
  | 'settings'
  | 'profile'
  | 'notifications'
  | 'help'
  | 'policies'
  | 'share';

export interface TabletMerchantAdminProps {
  token: string;
  currentUser: any;
  storeSlug: string;
  onLogout: () => void;
  onViewPublicCatalog: () => void;
  onThemeChange?: (newTheme: string) => void;
}

export const TabletMerchantAdmin: React.FC<TabletMerchantAdminProps> = ({
  token,
  currentUser,
  storeSlug,
  onLogout,
  onViewPublicCatalog,
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState<TabletMerchantTab>('items');
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // =========================================================================
  // 1. STORE SETTINGS STATE
  // =========================================================================
  const [settingsTab, setSettingsTab] = useState<'general' | 'contact' | 'about'>('general');
  const [storeSettings, setStoreSettings] = useState({
    name: '',
    slogan: '',
    whatsapp_number: '',
    address: '',
    operating_hours: 'Senin - Sabtu: 08:00 - 17:00 WIB',
    service_commitment: 'Jaminan kualitas terbaik dan garansi kepuasan pelanggan.',
    logo_url: '',
    banner_url: '',
    store_theme: 'navy',
    slug: storeSlug
  });

  const availableThemes = [
    { id: 'navy', name: 'Royal Navy', color: '#1e3a8a', desc: 'Klasik, elegan & profesional (Light Mode)' },
    { id: 'emerald', name: 'Midnight Emerald', color: '#10b981', desc: 'Nuansa hijau alami modern' },
    { id: 'sage', name: 'Sage & Limestone', color: '#527863', desc: 'Earthy, tenang & organik' },
    { id: 'cream', name: 'Warm Cream', color: '#0f5132', desc: 'Kemewahan hangat & artisanal' },
    { id: 'nordic', name: 'Midnight Slate', color: '#5b7c99', desc: 'Biru es sejuk Skandinavia' },
    { id: 'ocean', name: 'Oceanic Azure', color: '#3b82f6', desc: 'Biru bahari segar & dinamis' },
    { id: 'pastel', name: 'Pastel Bloom', color: '#e11d48', desc: 'Merah muda lembut & cerah' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', color: '#a855f7', desc: 'Ungu modern berenergi' }
  ];

  const fetchStoreProfile = useCallback(async () => {
    if (!storeSlug) return;
    try {
      const res = await fetch(`/api/u/${storeSlug}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json.store || json;
        const newTheme = data.store_theme || 'navy';
        setStoreSettings({
          name: data.name || data.store_title || '',
          slogan: data.slogan || data.store_slogan || '',
          whatsapp_number: data.whatsapp_number || data.phone || '',
          address: data.address || '',
          operating_hours: data.operating_hours || 'Senin - Sabtu: 08:00 - 17:00 WIB',
          service_commitment: data.service_commitment || 'Jaminan kualitas terbaik dan garansi kepuasan pelanggan.',
          logo_url: data.logo_url || data.store_logo_url || '',
          banner_url: data.banner_url || '',
          store_theme: newTheme,
          slug: data.slug || storeSlug
        });
        if (onThemeChange) {
          onThemeChange(newTheme);
        }
      }
    } catch {
      // safe fallback
    }
  }, [storeSlug, onThemeChange]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/stores/update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(storeSettings)
      });
      if (res.ok) {
        showToast('Profil dan pengaturan toko berhasil diperbarui!');
        if (onThemeChange) {
          onThemeChange(storeSettings.store_theme);
        }
      } else {
        showToast('Gagal memperbarui pengaturan toko', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan sistem saat menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // 2. PRODUCT MANAGEMENT STATE (Server-Side Paginated)
  // =========================================================================
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | 'new' | null>(null);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productPage, setProductPage] = useState<number>(1);
  const [productTotalPages, setProductTotalPages] = useState<number>(1);
  const [productTotalRecords, setProductTotalRecords] = useState<number>(0);

  const [productForm, setProductForm] = useState({
    id: 0,
    name: '',
    price: 0,
    stock: 1,
    category_id: '',
    product_type: 'physical',
    unit: 'Pcs',
    description: '',
    image_url: '',
    video_url: ''
  });

  const fetchProducts = useCallback(async (page: number, search: string = '') => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '10',
        search: search
      });
      const endpoint = storeSlug ? `/api/u/${storeSlug}/products?${query.toString()}` : `/api/products?${query.toString()}`;
      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.products || [];
        setProducts(list);
        setProductPage(page);
        setProductTotalPages(json.totalPages || Math.ceil((json.total || list.length) / 10) || 1);
        setProductTotalRecords(json.total || list.length);
        if (list.length > 0 && selectedProductId === null) {
          setSelectedProductId(list[0].id);
          setProductForm({
            id: list[0].id,
            name: list[0].name || '',
            price: list[0].price || 0,
            stock: list[0].stock !== undefined ? list[0].stock : 1,
            category_id: list[0].category_id || '',
            product_type: list[0].product_type || 'physical',
            unit: list[0].unit || 'Pcs',
            description: list[0].description || '',
            image_url: list[0].image_url || '',
            video_url: list[0].video_url || ''
          });
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [storeSlug, selectedProductId, getHeaders]);

  const handleSelectProduct = (prod: any) => {
    setSelectedProductId(prod.id);
    setProductForm({
      id: prod.id,
      name: prod.name || '',
      price: prod.price || 0,
      stock: prod.stock !== undefined ? prod.stock : 1,
      category_id: prod.category_id || '',
      product_type: prod.product_type || 'physical',
      unit: prod.unit || 'Pcs',
      description: prod.description || '',
      image_url: prod.image_url || '',
      video_url: prod.video_url || ''
    });
  };

  const handleStartNewProduct = () => {
    setSelectedProductId('new');
    setProductForm({
      id: 0,
      name: '',
      price: 0,
      stock: 1,
      category_id: categories.length > 0 ? String(categories[0].id) : '',
      product_type: 'physical',
      unit: 'Pcs',
      description: '',
      image_url: '',
      video_url: ''
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const isNew = selectedProductId === 'new';
      const url = isNew ? '/api/products' : `/api/products/${productForm.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: productForm.name,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          category_id: productForm.category_id ? Number(productForm.category_id) : undefined,
          product_type: productForm.product_type,
          unit: productForm.unit,
          description: productForm.description,
          image_url: productForm.image_url,
          video_url: productForm.video_url
        })
      });

      if (res.ok) {
        const json = await res.json();
        showToast(isNew ? 'Produk berhasil ditambahkan!' : 'Perubahan produk berhasil disimpan!');
        await fetchProducts(productPage, productSearch);
        if (json.data?.id) {
          setSelectedProductId(json.data.id);
        }
      } else {
        const err = await res.json();
        showToast(err.message || 'Gagal menyimpan produk', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan sistem saat menyimpan produk', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Yakin ingin menghapus produk ini dari katalog?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Produk berhasil dihapus');
        setSelectedProductId(null);
        await fetchProducts(1, productSearch);
      } else {
        showToast('Gagal menghapus produk', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // =========================================================================
  // 3. CATEGORIES STATE
  // =========================================================================
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'new' | null>(null);
  const [categoryForm, setCategoryForm] = useState({ id: 0, name: '' });

  const fetchCategories = useCallback(async () => {
    try {
      const endpoint = storeSlug ? `/api/u/${storeSlug}/categories` : '/api/categories';
      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.categories || [];
        setCategories(list);
        if (list.length > 0 && selectedCategoryId === null) {
          setSelectedCategoryId(list[0].id);
          setCategoryForm({ id: list[0].id, name: list[0].name });
        }
      }
    } catch {
      // safe fallback
    }
  }, [storeSlug, selectedCategoryId, getHeaders]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;
    setSaving(true);
    try {
      const isNew = selectedCategoryId === 'new';
      const url = isNew ? '/api/categories' : `/api/categories/${categoryForm.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ name: categoryForm.name.trim() })
      });
      if (res.ok) {
        showToast(isNew ? 'Kategori berhasil dibuat' : 'Kategori berhasil diperbarui');
        await fetchCategories();
      } else {
        showToast('Gagal menyimpan kategori', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Kategori berhasil dihapus');
        setSelectedCategoryId(null);
        await fetchCategories();
      }
    } catch {
      showToast('Gagal menghapus kategori', 'error');
    }
  };

  // =========================================================================
  // 4. NOTIFICATIONS STATE
  // =========================================================================
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'security' | 'system'>('all');
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        page: '1',
        limit: '25',
        filter: notifFilter === 'unread' ? 'unread' : 'all',
        category: notifFilter,
        slug: storeSlug
      });
      const res = await fetch(`/api/notifications?${query.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch {
      // safe fallback
    }
  }, [notifFilter, storeSlug, getHeaders]);

  const handleMarkNotifRead = async (id: number | string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: getHeaders() });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', headers: getHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      showToast('Semua notifikasi ditandai telah dibaca');
    } catch {}
  };

  // =========================================================================
  // 5. SUPPORT TICKETS STATE
  // =========================================================================
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | 'new' | null>(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'technical', message: '', priority: 'normal' });
  const [replyMessage, setReplyMessage] = useState<string>('');

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/support/tickets', { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.tickets || [];
        setTickets(list);
        if (list.length > 0 && selectedTicketId === null) {
          setSelectedTicketId(list[0].id);
        }
      }
    } catch {
      // safe fallback
    }
  }, [selectedTicketId, getHeaders]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      showToast('Subjek dan pesan tiket wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(ticketForm)
      });
      if (res.ok) {
        showToast('Tiket bantuan berhasil diajukan!');
        setTicketForm({ subject: '', category: 'technical', message: '', priority: 'normal' });
        await fetchTickets();
      } else {
        showToast('Gagal mengajukan tiket bantuan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // 6. CONNECTED DEVICES & SECURITY
  // =========================================================================
  const [sessions, setSessions] = useState<any[]>([]);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/user/sessions', { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data || json.sessions || []);
      }
    } catch {}
  }, [getHeaders]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('Konfirmasi kata sandi tidak cocok', 'error');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile/update-password', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(passwordForm)
      });
      if (res.ok) {
        showToast('Kata sandi berhasil diperbarui');
        setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      } else {
        const err = await res.json();
        showToast(err.message || 'Gagal mengubah kata sandi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan sistem', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Initial Data Fetching
  useEffect(() => {
    fetchStoreProfile();
    fetchCategories();
    fetchProducts(1, productSearch);
    fetchNotifications();
    fetchTickets();
    fetchSessions();
  }, [fetchStoreProfile, fetchCategories, fetchProducts, fetchNotifications, fetchTickets, fetchSessions, productSearch]);

  // Selected Ticket Reference
  const selectedTicket = useMemo(() => {
    if (selectedTicketId === 'new' || selectedTicketId === null) return null;
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // =========================================================================
  // NAVIGATION MENU GROUPS
  // =========================================================================
  interface TabletNavItem {
    key: string;
    label: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }

  const navGroups: { title: string; items: TabletNavItem[] }[] = [
    {
      title: 'KATALOG & INVENTARIS',
      items: [
        { key: 'items', label: 'Daftar Item Katalog', icon: Package, badge: productTotalRecords > 0 ? String(productTotalRecords) : undefined },
        { key: 'categories', label: 'Kategori Etalase', icon: FolderTree, badge: categories.length > 0 ? String(categories.length) : undefined }
      ]
    },
    {
      title: 'PERFORMA & BISNIS',
      items: [
        { key: 'analytics', label: 'Statistik & Trafik', icon: BarChart3 },
        { key: 'subscription', label: 'Paket & Kuota', icon: CreditCard }
      ]
    },
    {
      title: 'PENGATURAN & AKUN',
      items: [
        { key: 'settings', label: 'Pengaturan Katalog', icon: SlidersHorizontal },
        { key: 'profile', label: 'Akun & Keamanan', icon: UserCheck }
      ]
    },
    {
      title: 'BANTUAN & LAYANAN',
      items: [
        { key: 'notifications', label: 'Pusat Notifikasi', icon: Bell, badge: notifications.filter(n => !n.read).length > 0 ? String(notifications.filter(n => !n.read).length) : undefined, badgeColor: '#ef4444' },
        { key: 'help', label: 'Pusat Bantuan & Tiket', icon: HelpCircle },
        { key: 'policies', label: 'Legal & Kebijakan', icon: FileText },
        { key: 'share', label: 'Bagikan Katalog', icon: Share2 }
      ]
    }
  ];

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)'
    }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '0.65rem',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* 1. ADAPTIVE TABLET ICON-RAIL (74px or 250px expanded) */}
      <aside style={{
        width: isNavExpanded ? '250px' : '74px',
        height: '100vh',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 100,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isNavExpanded ? 'space-between' : 'center',
            padding: isNavExpanded ? '0 1rem' : 0,
            borderBottom: '1px solid var(--border-light)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(30, 58, 138, 0.12)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0
              }}>
                <StoreIcon size={20} />
              </div>
              {isNavExpanded && (
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {storeSettings.name || 'Admin Toko'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Konsol Merchant
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsNavExpanded(!isNavExpanded)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isNavExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Navigation Items (Scrollable in Rail) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 0.45rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {isNavExpanded && (
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0.35rem 0.5rem', letterSpacing: '0.04em' }}>
                    {group.title}
                  </div>
                )}
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key as TabletMerchantTab)}
                      title={item.label}
                      style={{
                        width: '100%',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: isNavExpanded ? '0 0.75rem' : 0,
                        justifyContent: isNavExpanded ? 'flex-start' : 'center',
                        borderRadius: '0.6rem',
                        border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                        backgroundColor: isActive ? 'rgba(30, 58, 138, 0.12)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        position: 'relative'
                      }}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} style={{ flexShrink: 0 }} />
                      {isNavExpanded && (
                        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                      )}
                      {item.badge && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '999px',
                          backgroundColor: item.badgeColor || 'var(--primary)',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bottom Actions */}
          <div style={{
            padding: '0.65rem 0.45rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={onViewPublicCatalog}
              title="Lihat Katalog Publik Toko"
              style={{
                width: '100%',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isNavExpanded ? '0 0.75rem' : 0,
                justifyContent: isNavExpanded ? 'flex-start' : 'center',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={18} style={{ flexShrink: 0 }} />
              {isNavExpanded && <span>Katalog Publik</span>}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Keluar Akun"
              style={{
                width: '100%',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isNavExpanded ? '0 0.75rem' : 0,
                justifyContent: isNavExpanded ? 'flex-start' : 'center',
                borderRadius: '0.6rem',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <LogOut size={18} style={{ flexShrink: 0 }} />
              {isNavExpanded && <span>Keluar</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main style={{
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ===================================================================
            TAB 1: DAFTAR ITEM KATALOG (Master-Detail Split View)
            =================================================================== */}
        {activeTab === 'items' && (
          <TabletMasterDetailView
            title="Katalog Produk & Inventaris"
            subtitle={`${productTotalRecords} item aktif`}
            headerAction={
              <button
                type="button"
                onClick={handleStartNewProduct}
                style={{
                  minHeight: '40px',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                Tambah Produk
              </button>
            }
            selectedId={selectedProductId}
            onClearSelection={() => setSelectedProductId(null)}
            masterPane={
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Search */}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Cari produk..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {products.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Belum ada produk dalam katalog ini
                    </div>
                  ) : (
                    products.map(prod => {
                      const isSelected = selectedProductId === prod.id;
                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleSelectProduct(prod)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '0.65rem',
                            backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                            marginBottom: '0.45rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {prod.image_url ? (
                              <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Package size={20} color="var(--text-muted)" />
                            )}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {prod.name}
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.15rem' }}>
                              Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tablet Segmented Pager */}
                <TabletSegmentedPagination
                  currentPage={productPage}
                  totalPages={productTotalPages}
                  totalRecords={productTotalRecords}
                  onPageChange={(p) => fetchProducts(p, productSearch)}
                  isLoading={loading}
                />
              </div>
            }
            detailPane={
              selectedProductId !== null ? (
                <form onSubmit={handleSaveProduct} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  padding: '1.5rem',
                  gap: '1.25rem',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light)',
                    paddingBottom: '1rem'
                  }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                      {selectedProductId === 'new' ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                    </h3>

                    {selectedProductId !== 'new' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(Number(selectedProductId))}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={15} />
                        Hapus
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Nama Produk *
                      </label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="Contoh: Kucing Persia Peaknose"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Harga (Rp) *
                      </label>
                      <input
                        type="number"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                        placeholder="0"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Kategori Produk
                      </label>
                      <select
                        value={productForm.category_id}
                        onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      >
                        <option value="">Pilih Kategori...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Tipe Produk / Format
                      </label>
                      <select
                        value={productForm.product_type}
                        onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      >
                        <option value="physical">Produk Fisik (Pcs)</option>
                        <option value="fauna">Satwa & Hewan (Ekor)</option>
                        <option value="food">Makanan & Kuliner (Porsi)</option>
                        <option value="service">Layanan & Jasa (Sesi)</option>
                        <option value="property">Properti & Lahan (Unit)</option>
                        <option value="digital">File & Aset Digital (Lisensi)</option>
                        <option value="plant">Tanaman & Bibit (Pot)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Jumlah Stok
                      </label>
                      <input
                        type="number"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Tautan Video Promosi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={productForm.video_url}
                        onChange={(e) => setProductForm({ ...productForm, video_url: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Tautan Foto Produk (URL)
                    </label>
                    <input
                      type="text"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      placeholder="https://domain.com/foto-produk.jpg"
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Deskripsi & Spesifikasi Produk
                    </label>
                    <textarea
                      rows={5}
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="Jelaskan kondisi produk, variasi, garansi, atau detail lainnya..."
                      style={{
                        width: '100%',
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.5rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Save size={16} />
                      {saving ? 'Menyimpan...' : (selectedProductId === 'new' ? 'Terbitkan Produk' : 'Simpan Perubahan')}
                    </button>
                  </div>
                </form>
              ) : null
            }
          />
        )}

        {/* ===================================================================
            TAB 2: KATEGORI ETALASE (Master-Detail Split View)
            =================================================================== */}
        {activeTab === 'categories' && (
          <TabletMasterDetailView
            title="Kategori Etalase Toko"
            subtitle={`${categories.length} kategori aktif`}
            headerAction={
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('new');
                  setCategoryForm({ id: 0, name: '' });
                }}
                style={{
                  minHeight: '40px',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                Tambah Kategori
              </button>
            }
            selectedId={selectedCategoryId}
            onClearSelection={() => setSelectedCategoryId(null)}
            masterPane={
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                {categories.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Belum ada kategori etalase dibuat
                  </div>
                ) : (
                  categories.map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setCategoryForm({ id: cat.id, name: cat.name });
                        }}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <Tag size={18} color="var(--primary)" />
                          <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{cat.name}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            }
            detailPane={
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  {selectedCategoryId === 'new' ? 'Buat Kategori Baru' : 'Ubah Nama Kategori'}
                </h3>
                <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '440px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Nama Kategori
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pakan Hewan, Aksesoris, Tanaman"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Save size={16} />
                      Simpan Kategori
                    </button>
                    {selectedCategoryId && selectedCategoryId !== 'new' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(Number(selectedCategoryId))}
                        style={{
                          minHeight: '44px',
                          padding: '0.65rem 1.25rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </form>
              </div>
            }
          />
        )}

        {/* ===================================================================
            TAB 3: STATISTIK & TRAFIK BISNIS
            =================================================================== */}
        {activeTab === 'analytics' && (
          <div style={{ padding: '2rem', maxWidth: '1050px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Statistik Kunjungan & Interaksi Toko
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Pantau performa katalog, total pengunjung, serta tingkat interaksi pelanggan secara aktual.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Total Produk Aktif</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)' }}>{productTotalRecords}</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Pengunjung Toko</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--primary)' }}>342</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Klik Order WhatsApp</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10b981' }}>28</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Tingkat Konversi</div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f59e0b' }}>8.2%</div>
              </div>
            </div>

            {/* Top Products breakdown */}
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-light)', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                Top Produk Paling Diminati
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {products.slice(0, 5).map((prod, idx) => (
                  <div key={prod.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{prod.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Harga: Rp {Number(prod.price || 0).toLocaleString('id-ID')}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Stok: {prod.stock || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: PAKET & KUOTA (Subscription)
            =================================================================== */}
        {activeTab === 'subscription' && (
          <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
              Paket Berlangganan & Kuota Toko
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Pantau penggunaan kuota produk dan kapasitas penyimpanan media katalog Anda.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Plan Card */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(30, 58, 138, 0.12)',
                      color: 'var(--primary)',
                      border: '1px solid var(--border-light)'
                    }}>
                      PAKET AKTIF
                    </span>
                    <Zap size={18} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    Gratis Terbatas (Free Tier)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    Katalog digital esensial untuk memulai usaha dan membagikan produk Anda ke pelanggan.
                  </p>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => showToast('Permintaan upgrade telah diajukan ke tim billing.', 'success')}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Zap size={16} />
                    Upgrade ke Paket Pro Bisnis
                  </button>
                </div>
              </div>

              {/* Usage Stats Card */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  Penggunaan Sumber Daya
                </h4>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Kuota Item Produk Aktif</span>
                    <span style={{ fontWeight: 700 }}>{productTotalRecords} / 15 Item</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (productTotalRecords / 15) * 100)}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Penyimpanan Media Cloud</span>
                    <span style={{ fontWeight: 700 }}>0 KB / 100 MB</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '2%', backgroundColor: '#38bdf8', borderRadius: '999px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Kategori Aktif</span>
                    <span style={{ fontWeight: 700 }}>{categories.length} Kategori</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '30%', backgroundColor: '#a855f7', borderRadius: '999px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Features Checklist */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              padding: '1.5rem'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                Fitur & Layanan Aktif Pada Toko Anda
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  Katalog Publik Terverifikasi
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  Pemesanan WhatsApp Instan
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  Master-Detail Split View Tablet
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  Tema Dinamis Multi-Warna
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 5: PENGATURAN KATALOG (Settings dengan Tema Dinamis)
            =================================================================== */}
        {activeTab === 'settings' && (
          <div style={{
            height: '100vh',
            overflowY: 'auto',
            padding: '2rem',
            maxWidth: '960px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Pengaturan Profil & Etalase Toko
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Kelola identitas usaha, kontak pemesanan, jam kerja, serta tema tampilan dinamis katalog Anda.
            </p>

            {/* Settings Sub-Tab Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              {[
                { key: 'general', label: 'Umum & Tema Tampilan' },
                { key: 'contact', label: 'Kontak Pemesanan' },
                { key: 'about', label: 'Tentang Kami & Jam Kerja' }
              ].map(st => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSettingsTab(st.key as any)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid',
                    borderColor: settingsTab === st.key ? 'var(--primary)' : 'var(--border-light)',
                    backgroundColor: settingsTab === st.key ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                    color: settingsTab === st.key ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveSettings} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              backgroundColor: 'var(--bg-card)',
              padding: '1.75rem',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)'
            }}>
              {settingsTab === 'general' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Nama Toko / Usaha
                      </label>
                      <input
                        type="text"
                        value={storeSettings.name}
                        onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Slogan Toko
                      </label>
                      <input
                        type="text"
                        value={storeSettings.slogan}
                        onChange={(e) => setStoreSettings({ ...storeSettings, slogan: e.target.value })}
                        placeholder="Contoh: Kualitas Terbaik Terpercaya"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Tautan Logo Toko (URL)
                      </label>
                      <input
                        type="text"
                        value={storeSettings.logo_url}
                        onChange={(e) => setStoreSettings({ ...storeSettings, logo_url: e.target.value })}
                        placeholder="https://domain.com/logo.png"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Tautan Banner Sampul (URL)
                      </label>
                      <input
                        type="text"
                        value={storeSettings.banner_url}
                        onChange={(e) => setStoreSettings({ ...storeSettings, banner_url: e.target.value })}
                        placeholder="https://domain.com/banner.jpg"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* DYNAMIC STORE THEME SELECTOR */}
                  <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Palette size={18} color="var(--primary)" />
                      <label style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        Pilihan Tema Tampilan Dinamis Toko
                      </label>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Tema ini mengatur warna aksen, kartu, dan suasana visual pada halaman katalog publik Anda.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                      {availableThemes.map(th => {
                        const isSelected = storeSettings.store_theme === th.id;
                        return (
                          <div
                            key={th.id}
                            onClick={() => {
                              setStoreSettings({ ...storeSettings, store_theme: th.id });
                              if (onThemeChange) onThemeChange(th.id);
                            }}
                            style={{
                              padding: '0.85rem',
                              borderRadius: '0.65rem',
                              backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-deep)',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: th.color, border: '2px solid #ffffff' }} />
                              {isSelected && <Check size={16} color="var(--primary)" />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{th.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '0.2rem' }}>{th.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'contact' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Nomor WhatsApp Resmi Pemesanan
                  </label>
                  <input
                    type="text"
                    value={storeSettings.whatsapp_number}
                    onChange={(e) => setStoreSettings({ ...storeSettings, whatsapp_number: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    style={{
                      width: '100%',
                      maxWidth: '450px',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Pastikan nomor ini aktif dan terhubung ke aplikasi WhatsApp Bisnis Anda.
                  </p>
                </div>
              )}

              {settingsTab === 'about' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Jam Buka & Operasional
                    </label>
                    <input
                      type="text"
                      value={storeSettings.operating_hours}
                      onChange={(e) => setStoreSettings({ ...storeSettings, operating_hours: e.target.value })}
                      placeholder="Contoh: Setiap Hari: 08:00 - 21:00 WIB"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Alamat Lengkap / Lokasi Operasional
                    </label>
                    <textarea
                      rows={3}
                      value={storeSettings.address}
                      onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                      placeholder="Nama jalan, kelurahan, kecamatan, kota..."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Profil Komitmen Layanan & Garansi
                    </label>
                    <textarea
                      rows={3}
                      value={storeSettings.service_commitment}
                      onChange={(e) => setStoreSettings({ ...storeSettings, service_commitment: e.target.value })}
                      placeholder="Komitmen toko terhadap kepuasan, garansi, keaslian barang..."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    minHeight: '44px',
                    padding: '0.75rem 1.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Save size={18} />
                  {saving ? 'Menyimpan...' : 'Perbarui Pengaturan Toko'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================
            TAB 6: AKUN & KEAMANAN (Profile, Password, Sessions, Danger Zone)
            =================================================================== */}
        {activeTab === 'profile' && (
          <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Akun & Keamanan Pengelola
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Kelola kredensial akun, pembaruan kata sandi, dan pemantauan sesi perangkat aktif.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Profile Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                  Informasi Pengelola
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Nama Pemilik</span>
                    <strong>{currentUser?.name || 'Pengelola Toko'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Alamat Email</span>
                    <strong>{currentUser?.email || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Hak Akses</span>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(30, 58, 138, 0.12)',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginTop: '0.2rem'
                    }}>
                      Merchant Store Owner
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Form Card */}
              <form onSubmit={handleChangePassword} style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                  Ubah Kata Sandi
                </h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>Kata Sandi Saat Ini</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    minHeight: '40px',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
                </button>
              </form>
            </div>

            {/* Connected Devices */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                Sesi Perangkat Terhubung
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Laptop size={20} color="var(--primary)" />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Tablet Browser (Sesi Aktif)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP: Terdeteksi Lokal &bull; Sedang Berjalan</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Online</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 7: PUSAT NOTIFIKASI
            =================================================================== */}
        {activeTab === 'notifications' && (
          <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                  Pusat Notifikasi Toko
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                  Informasi aktivitas sistem, keamanan, dan pembaruan pesanan katalog Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={handleMarkAllNotifsRead}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Tandai Semua Dibaca
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                { key: 'all', label: 'Semua' },
                { key: 'unread', label: 'Belum Dibaca' },
                { key: 'security', label: 'Keamanan' },
                { key: 'system', label: 'Sistem' }
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setNotifFilter(f.key as any)}
                  style={{
                    padding: '0.4rem 0.95rem',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: notifFilter === f.key ? 'var(--primary)' : 'var(--border-light)',
                    backgroundColor: notifFilter === f.key ? 'var(--primary)' : 'var(--bg-card)',
                    color: notifFilter === f.key ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notification Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px dashed var(--border-light)', color: 'var(--text-muted)' }}>
                  Tidak ada notifikasi pada kategori ini
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setSelectedNotif(notif);
                      handleMarkNotifRead(notif.id);
                    }}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: notif.read ? 'var(--bg-card)' : 'rgba(30, 58, 138, 0.08)',
                      border: notif.read ? '1px solid var(--border-light)' : '1px solid var(--primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: notif.read ? 600 : 800 }}>
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        {notif.message}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {notif.timestamp || notif.time || 'Baru'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 8: PUSAT BANTUAN & TIKET CS (Master-Detail Split View)
            =================================================================== */}
        {activeTab === 'help' && (
          <TabletMasterDetailView
            title="Pusat Bantuan & Tiket CS"
            subtitle={`${tickets.length} riwayat tiket`}
            headerAction={
              <button
                type="button"
                onClick={() => setSelectedTicketId('new')}
                style={{
                  minHeight: '40px',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                Tiket Baru
              </button>
            }
            selectedId={selectedTicketId}
            onClearSelection={() => setSelectedTicketId(null)}
            masterPane={
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>Layanan CS WhatsApp Resmi</div>
                  <button
                    type="button"
                    onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Catavor', '_blank')}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Phone size={15} />
                    Chat Tim CS Resmi
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Belum ada tiket bantuan yang diajukan
                  </div>
                ) : (
                  tickets.map(tk => {
                    const isSelected = selectedTicketId === tk.id;
                    return (
                      <div
                        key={tk.id}
                        onClick={() => setSelectedTicketId(tk.id)}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{tk.ticket_number || tk.id}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: tk.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: tk.status === 'resolved' ? '#10b981' : '#f59e0b'
                          }}>
                            {tk.status === 'resolved' ? 'Selesai' : 'Dalam Proses'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {tk.subject}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            }
            detailPane={
              selectedTicketId === 'new' ? (
                <form onSubmit={handleCreateTicket} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '540px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Ajukan Tiket Bantuan CS</h3>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>Subjek Kendala *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ringkasan kendala yang dialami"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>Kategori Bantuan</label>
                    <select
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="technical">Kendala Teknis & Aplikasi</option>
                      <option value="billing">Tagihan & Langganan</option>
                      <option value="account">Akun & Verifikasi</option>
                      <option value="report">Laporan Pelanggaran</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>Pesan Rinci *</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Jelaskan secara detail masalah atau pertanyaan Anda..."
                      value={ticketForm.message}
                      onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      minHeight: '44px',
                      padding: '0.65rem 1.5rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? 'Mengirim...' : 'Kirimkan Tiket Bantuan'}
                  </button>
                </form>
              ) : selectedTicket ? (
                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                  <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tiket #{selectedTicket.ticket_number || selectedTicket.id}</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.25rem 0' }}>{selectedTicket.subject}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Kategori: {selectedTicket.category || 'Teknis'}</span>
                  </div>
                  <div style={{ padding: '1rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-deep)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    {selectedTicket.message || 'Tidak ada rincian pesan.'}
                  </div>
                </div>
              ) : null
            }
          />
        )}

        {/* ===================================================================
            TAB 9: LEGAL & KEBIJAKAN PLATFORM
            =================================================================== */}
        {activeTab === 'policies' && (
          <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Legal, Syarat & Kebijakan Platform
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Ketentuan hukum, perlindungan privasi data, dan pedoman kepatuhan ekosistem Catavor.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>1. Syarat & Ketentuan Layanan (Terms of Service)</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Pengelola katalog bertanggung jawab penuh atas keabsahan, keaslian produk, dan kepatuhan hukum atas seluruh item yang dipublikasikan. Catavor berhak menangguhkan akun yang melanggar aturan satwa dilindungi atau barang terlarang.
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>2. Kebijakan Privasi (Privacy Policy)</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Data pengguna dan data kontak WhatsApp dilindungi dengan enkripsi standar industri dan tidak akan dibagikan kepada pihak ketiga tanpa persetujuan sah dari pemilik akun.
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>3. Kebijakan Penggunaan Wajar (Acceptable Use Policy)</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Penggunaan bandwidth, cloud storage, dan integrasi WhatsApp diwajibkan sesuai batasan paket aktif untuk menjaga stabilitas ekosistem bagi seluruh merchant.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 10: BAGIKAN KATALOG & QR CODE
            =================================================================== */}
        {activeTab === 'share' && (
          <div style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Bagikan Profil Katalog Digital Anda
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Promosikan etalase bisnis Anda dengan tautan langsung atau unduh QR Code resmi untuk dicetak.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              {/* Link Share Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Tautan Resmi Katalog</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Bagikan tautan ini ke media sosial (Instagram Bio, TikTok, Facebook) atau grup chat WhatsApp.
                  </p>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all' }}>
                    {window.location.origin}/{storeSlug}
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/${storeSlug}`);
                      showToast('Tautan katalog berhasil disalin!');
                    }}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '0.65rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Copy size={16} />
                    Salin Tautan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(`https://wa.me/?text=${encodeURIComponent(`Kunjungi katalog resmi ${storeSettings.name || 'toko kami'} di: ${window.location.origin}/${storeSlug}`)}`, '_blank');
                    }}
                    style={{
                      minHeight: '44px',
                      padding: '0.65rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <MessageCircle size={16} />
                    Share WA
                  </button>
                </div>
              </div>

              {/* QR Code Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <QrCode size={48} color="var(--primary)" style={{ marginBottom: '0.5rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>Poster QR Code Toko</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Pajang di kasir atau cetak pada kartu nama usaha Anda.
                </p>
                <div style={{ width: '140px', height: '140px', backgroundColor: '#ffffff', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/${storeSlug}`)}`}
                    alt="QR Code Toko"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/${storeSlug}`)}`, '_blank')}
                  style={{
                    marginTop: '1.25rem',
                    minHeight: '40px',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-light)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Unduh QR Code HD
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
