import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Check,
  Image as ImageIcon,
  Upload,
  History,
  Archive,
  Eye,
  EyeOff,
  Globe,
  Sliders,
  DollarSign,
  Receipt,
  Crown,
  HardDrive,
  Utensils,
  FileCode,
  Wrench,
  Sprout,
  PawPrint,
  Building2,
  Home,
  Award,
  Compass,
  Sun,
  Droplets,
  RotateCcw,
  Edit3,
  X,
  Info
} from 'lucide-react';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { TabletAnalyticsView } from './TabletAnalyticsView';
import { TabletSubscriptionModal, type StoreQuotaData } from './TabletSubscriptionModal';
import { TabletConnectedDevicesView } from './TabletConnectedDevicesView';
import { TabletAuditLogsView } from './TabletAuditLogsView';
import { TabletProductFilterSheet, type TabletProductFilterValues } from './TabletProductFilterSheet';
import { TabletScrollableFilterTags, type FilterTagItem } from './TabletScrollableFilterTags';
import { TabletCustomSelect } from './TabletCustomSelect';
import { RichTextarea, FormattedText } from './RichTextarea';
import { useModalBackHandler } from '../utils/navigation';
import { createAuthFetch, isTokenExpired } from '../utils/auth';

export type ItemCategoryType = 'physical' | 'food' | 'service' | 'digital' | 'fauna' | 'property' | 'plant';

export const DEFAULT_MASTER_CATEGORIES: Record<ItemCategoryType, string[]> = {
  physical: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
  food: ['Makanan Utama (Main Course)', 'Dessert & Manisan', 'Minuman & Olahan Kopi', 'Camilan & Kudapan (Appetizer)', 'Bakery, Roti & Pastry', 'Makanan Beku (Frozen)', 'Paket Hemat & Bundling', 'Lainnya'],
  service: ['Perawatan & Grooming', 'Servis & Reparasi', 'Desain Grafis & Kreatif', 'Fotografi & Videografi', 'Kursus & Pelatihan', 'Konsultasi & Jasa Ahli', 'Kebersihan & Maintenance', 'Lainnya'],
  digital: ['E-Book & PDF', 'Template Dokumen & Notion', 'Desain Grafis & UI Kit', 'Source Code & Script', 'Audio & Musik', 'Preset & Filter', 'Video & Aset 3D', 'Lisensi Software', 'Lainnya'],
  fauna: ['Ikan Hias', 'Reptil & Amfibi', 'Burung & Unggas', 'Mamalia Kecil', 'Kucing & Anjing', 'Invertebrata & Serangga', 'Lainnya'],
  property: ['Rumah Tinggal (Landed House)', 'Apartemen & Kondominium', 'Tanah & Kavling', 'Ruko & Komersial', 'Villa & Resort', 'Gudang & Pabrik', 'Kost & Kontrakan', 'Lainnya'],
  plant: ['Tanaman Hias Daun', 'Tanaman Bunga & Anggrek', 'Bibit Buah & Pohon', 'Kaktus & Sukulen', 'Bonsai & Tanaman Seni', 'Tanaman Herbal & Rempah', 'Aquascape & Tanaman Air', 'Lainnya']
};

export const MASTER_CATEGORY_DEFINITIONS: Array<{ id: ItemCategoryType; label: string; desc: string; icon: React.ComponentType<{ size?: number | string; color?: string; style?: React.CSSProperties }>; color: string }> = [
  { id: 'physical', label: 'Barang Fisik', desc: 'Produk ritel fisik, pakaian, fashion, elektronik, kerajinan, dan perlengkapan umum', icon: Package, color: '#2563eb' },
  { id: 'food', label: 'Menu Kuliner (F&B)', desc: 'Makanan siap santap, minuman segar, camilan, bakery, frozen food, dan katering', icon: Utensils, color: '#ea580c' },
  { id: 'digital', label: 'Item Digital', desc: 'E-book, template dokumen, source code, video materi, dan lisensi software', icon: FileCode, color: '#7c3aed' },
  { id: 'service', label: 'Jasa & Layanan', desc: 'Jasa konsultasi, perbaikan/servis, desain kreatif, kursus, dan pengerjaan ahli', icon: Wrench, color: '#d97706' },
  { id: 'plant', label: 'Tanaman & Bibit', desc: 'Tanaman hias, bunga anggrek, bibit buah, kaktus, sukulen, bonsai, dan media tanam', icon: Sprout, color: '#059669' },
  { id: 'fauna', label: 'Satwa Peliharaan', desc: 'Satwa peliharaan, ikan hias, reptil, amfibi, burung, mamalia, dan serangga hidup', icon: PawPrint, color: '#e11d48' },
  { id: 'property', label: 'Properti & Aset', desc: 'Rumah tinggal, apartemen, tanah kavling, ruko, ruang usaha, dan villa', icon: Building2, color: '#0891b2' }
];

export interface CatalogTypeOption {
  id: string;
  name: string;
  categoryBadge: string;
  tagline: string;
  formHighlights: string;
  icon: React.ComponentType<{ size?: number | string; color?: string; style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultUnit: string;
}

export const CATALOG_TYPE_OPTIONS: CatalogTypeOption[] = [
  {
    id: 'physical',
    name: 'Barang Fisik',
    categoryBadge: 'Fisik & Stok',
    tagline: 'Pakaian, Aksesoris, Gadget, Kerajinan, & Produk Fisik.',
    formHighlights: 'Stok, Kondisi, Berat, Merek, Varian',
    icon: Package,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(37, 99, 235, 0.28)',
    defaultUnit: 'Pcs'
  },
  {
    id: 'food',
    name: 'Menu Kuliner (F&B)',
    categoryBadge: 'Kuliner & F&B',
    tagline: 'Restoran, Kafe, Bakery, Katering, Camilan & Minuman Olahan.',
    formHighlights: 'Porsi, Sertifikasi Halal, Level Rasa, Suhu Simpan',
    icon: Utensils,
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.28)',
    defaultUnit: 'Porsi / Pack'
  },
  {
    id: 'digital',
    name: 'Item Digital',
    categoryBadge: 'File & Lisensi',
    tagline: 'E-book, Template Desain, File PDF, Source Code, Lisensi & Unduhan.',
    formHighlights: 'Format File, Ukuran File, & Tipe Lisensi',
    icon: FileCode,
    color: '#7c3aed',
    bgColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.28)',
    defaultUnit: 'Lisensi'
  },
  {
    id: 'service',
    name: 'Jasa & Layanan',
    categoryBadge: 'Jasa & Sesi',
    tagline: 'Grooming, Desain, Servis, Kursus, Salon, Konsultan & Reparasi.',
    formHighlights: 'Estimasi Durasi, Metode Layanan, & Area Jangkauan',
    icon: Wrench,
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: 'rgba(217, 119, 6, 0.28)',
    defaultUnit: 'Sesi'
  },
  {
    id: 'plant',
    name: 'Tanaman & Bibit',
    categoryBadge: 'Tanaman & Florist',
    tagline: 'Tanaman Hias, Bibit Buah, Aroid, Sukulen, Florist & Nursery.',
    formHighlights: 'Kebutuhan Cahaya, Frekuensi Siram, Media Tanam, Ukuran',
    icon: Sprout,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.12)',
    borderColor: 'rgba(5, 150, 105, 0.28)',
    defaultUnit: 'Pot / Bibit'
  },
  {
    id: 'fauna',
    name: 'Satwa Peliharaan',
    categoryBadge: 'Satwa & Hewan',
    tagline: 'Pet Shop, Reptil, Burung, Ikan Hias, Aquascape, & Mamalia.',
    formHighlights: 'Nama Latin, Habitat, Makanan/Diet, Masa Hidup, Bobot',
    icon: PawPrint,
    color: '#e11d48',
    bgColor: 'rgba(225, 29, 72, 0.12)',
    borderColor: 'rgba(225, 29, 72, 0.28)',
    defaultUnit: 'Ekor'
  },
  {
    id: 'property',
    name: 'Properti & Real Estate',
    categoryBadge: 'Properti & Lahan',
    tagline: 'Rumah Tinggal, Ruko, Tanah Kavling, Villa, Apartemen & Sewa.',
    formHighlights: 'Tipe Transaksi, Sertifikat SHM, Luas Tanah/Bangunan, KT/KM',
    icon: Building2,
    color: '#0891b2',
    bgColor: 'rgba(8, 145, 178, 0.12)',
    borderColor: 'rgba(8, 145, 178, 0.28)',
    defaultUnit: 'Unit'
  }
];

export const tabletInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  padding: '0.55rem 0.85rem',
  borderRadius: '0.5rem',
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box'
};

export type TabletMerchantTab =
  | 'items'
  | 'categories'
  | 'analytics'
  | 'subscription'
  | 'settings'
  | 'profile'
  | 'audit_logs'
  | 'notifications'
  | 'help'
  | 'policies'
  | 'share';

export interface TabletMerchantAdminProps {
  token: string;
  currentUser: any;
  storeSlug: string;
  onLogout: () => void;
  onUnauthorized?: (msg?: string) => void;
  onViewPublicCatalog: () => void;
  onThemeChange?: (newTheme: string) => void;
}

export const TabletMerchantAdmin: React.FC<TabletMerchantAdminProps> = ({
  token,
  currentUser,
  storeSlug: initialStoreSlug,
  onLogout,
  onUnauthorized,
  onViewPublicCatalog,
  onThemeChange
}) => {
  // Resolve actual store slug defensively to avoid sending invalid fallback 'my-store' to backend
  const storeSlug = useMemo(() => {
    if (initialStoreSlug && initialStoreSlug !== 'my-store') return initialStoreSlug;
    return (
      (currentUser as any)?.store_slug ||
      (currentUser as any)?.active_store?.slug ||
      (currentUser as any)?.stores?.[0]?.slug ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('catavor_active_slug') : '') ||
      initialStoreSlug ||
      ''
    );
  }, [initialStoreSlug, currentUser]);

  // Centralized authenticated fetch with automatic 401 session eviction (matching admin pengelola standard)
  const fetch = useMemo(() => {
    return createAuthFetch({
      getToken: () => token,
      onUnauthorized: (msg) => {
        if (onUnauthorized) {
          onUnauthorized(msg);
        } else {
          onLogout();
        }
      }
    });
  }, [token, onUnauthorized, onLogout]);

  // Proactive token expiration verification on mount and on idle focus/heartbeat
  useEffect(() => {
    const checkToken = () => {
      const curToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('catavor_token') : null);
      if (!curToken || isTokenExpired(curToken)) {
        if (onUnauthorized) {
          onUnauthorized('Sesi Anda telah berakhir demi keamanan. Silakan login kembali.');
        } else {
          onLogout();
        }
      }
    };

    checkToken();

    window.addEventListener('focus', checkToken);
    const interval = setInterval(checkToken, 30000);
    return () => {
      window.removeEventListener('focus', checkToken);
      clearInterval(interval);
    };
  }, [token, onUnauthorized, onLogout]);
  const onThemeChangeRef = useRef(onThemeChange);
  useEffect(() => {
    onThemeChangeRef.current = onThemeChange;
  }, [onThemeChange]);
  const appliedThemeRef = useRef<string>('');

  const [activeTab, setActiveTabState] = useState<TabletMerchantTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabletMerchantTab;
      const validTabs: TabletMerchantTab[] = [
        'items', 'categories', 'analytics', 'subscription', 'settings',
        'profile', 'audit_logs', 'notifications', 'help', 'policies', 'share'
      ];
      if (tabParam && validTabs.includes(tabParam)) {
        return tabParam;
      }
    }
    return 'items';
  });

  const setActiveTab = useCallback((tab: TabletMerchantTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      url.searchParams.delete('action');
      url.searchParams.delete('type');
      url.searchParams.delete('catalog_type');
      window.history.pushState({ tab }, '', url.toString());
    }
  }, []);
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

  // Utility formatBytes
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // =========================================================================
  // FILE UPLOAD HELPER (Direct Multi-tenant Cloud Storage)
  // =========================================================================
  const handleUploadImage = async (file: File, category: 'products' | 'branding' = 'products'): Promise<string | null> => {
    if (!token) return null;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Ukuran file maksimal 10MB', 'error');
      return null;
    }
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', category);
    setSaving(true);
    try {
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        },
        body: formData
      });
      const json = await res.json();
      if (res.ok && (json.url || json.data?.url)) {
        const uploadedUrl = json.url || json.data?.url;
        showToast('Foto berhasil diunggah!');
        return uploadedUrl;
      } else {
        showToast(json.message || 'Gagal mengunggah foto', 'error');
        return null;
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mengunggah foto', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // 1. STORE SETTINGS STATE
  // =========================================================================
  const [settingsTab, setSettingsTab] = useState<'general' | 'contact' | 'about' | 'domain' | 'danger'>('general');
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
    slug: storeSlug,
    official_website: '',
    instagram: '',
    custom_domain: '',
    show_hours: true,
    is_paused: false
  });

  // Master Categories State (Two-Tier Architecture matching Mobile & Desktop)
  const [masterCategories, setMasterCategories] = useState<Record<ItemCategoryType, string[]>>(DEFAULT_MASTER_CATEGORIES);
  const [masterCategoryContextTab, setMasterCategoryContextTab] = useState<ItemCategoryType>('physical');
  const [newCustomCategoryInput, setNewCustomCategoryInput] = useState<string>('');
  const [renameMasterModalData, setRenameMasterModalData] = useState<{
    field: 'class';
    fieldLabel?: string;
    oldValue: string;
    newValue: string;
    productType: ItemCategoryType;
  } | null>(null);
  const [deleteMasterModalData, setDeleteMasterModalData] = useState<{
    field: 'class';
    value: string;
    replacementOptions: string[];
    selectedReplacement: string;
    productType: ItemCategoryType;
  } | null>(null);

  // Product Form inline custom category input state
  const [showCustomClassInput, setShowCustomClassInput] = useState<boolean>(false);
  const [customClass, setCustomClass] = useState<string>('');

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
          slug: data.slug || storeSlug,
          official_website: data.official_website || '',
          instagram: data.social_links?.instagram || '',
          custom_domain: data.custom_domain || '',
          show_hours: data.show_hours !== undefined ? data.show_hours : true,
          is_paused: Boolean(data.is_suspended || data.is_dormant)
        });
        if (data.master_categories) {
          setMasterCategories(prev => {
            const merged: Record<ItemCategoryType, string[]> = { ...DEFAULT_MASTER_CATEGORIES };
            (Object.keys(DEFAULT_MASTER_CATEGORIES) as ItemCategoryType[]).forEach(type => {
              const storeList = data.master_categories[type];
              if (Array.isArray(storeList) && storeList.length > 0) {
                merged[type] = Array.from(new Set([...(DEFAULT_MASTER_CATEGORIES[type] || []), ...storeList]));
              }
            });
            return merged;
          });
        }
        if (newTheme && newTheme !== appliedThemeRef.current) {
          appliedThemeRef.current = newTheme;
          if (onThemeChangeRef.current) {
            onThemeChangeRef.current(newTheme);
          }
        }
      }
    } catch {
      // safe fallback
    }
  }, [storeSlug]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/stores/update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          store_title: storeSettings.name,
          store_slogan: storeSettings.slogan,
          whatsapp_number: storeSettings.whatsapp_number,
          official_website: storeSettings.official_website,
          store_logo_url: storeSettings.logo_url,
          store_theme: storeSettings.store_theme,
          about_location: storeSettings.address,
          about_hours: storeSettings.operating_hours,
          show_hours: storeSettings.show_hours,
          about_disclaimer: storeSettings.service_commitment,
          promo_banner: storeSettings.banner_url,
          social_links: {
            instagram: storeSettings.instagram
          }
        })
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

  // Custom Domain Update
  const handleSaveCustomDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/subscription/custom-domain', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ custom_domain: storeSettings.custom_domain })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Custom domain berhasil diperbarui!');
        fetchQuota();
      } else {
        showToast(data.message || 'Gagal memperbarui custom domain', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Download Catalog JSON
  const handleExportCatalogJSON = async () => {
    try {
      const res = await fetch(`/api/u/${storeSlug}`);
      if (res.ok) {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `katalog-${storeSlug}-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup data katalog berhasil diunduh!');
      }
    } catch {
      showToast('Gagal mengunduh backup katalog', 'error');
    }
  };

  // =========================================================================
  // 2. PRODUCT MANAGEMENT STATE (Server-Side Filtered & Paginated)
  // =========================================================================
  const [categories, setCategories] = useState<any[]>([]);
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  const [products, setProducts] = useState<any[]>([]);
  const productsRef = useRef<any[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Helper to retrieve category options for a specific product type (Two-Tier Master Data)
  const getCategoryOptionsForType = useCallback((productType: string = 'physical'): string[] => {
    const pType = (productType || 'physical') as ItemCategoryType;
    const fromMaster = masterCategories[pType] || [];
    const fromDefaults = DEFAULT_MASTER_CATEGORIES[pType] || [];

    // Collect defaults from other product types so cross-industry defaults don't leak into this type
    const otherDefaults = new Set<string>();
    (Object.keys(DEFAULT_MASTER_CATEGORIES) as ItemCategoryType[]).forEach(otherType => {
      if (otherType !== pType) {
        (DEFAULT_MASTER_CATEGORIES[otherType] || []).forEach(c => otherDefaults.add(c));
      }
    });

    const customUsed = (productsRef.current || [])
      .filter(p => (p.product_type || 'physical') === pType && p.class)
      .map(p => p.class)
      .filter(c => !otherDefaults.has(c));

    const merged = Array.from(new Set([...fromDefaults, ...fromMaster, ...customUsed])).filter(Boolean);
    return merged.length > 0 ? merged : ['Lainnya'];
  }, [masterCategories]);

  const getDefaultCategoryForType = useCallback((productType: string = 'physical'): string => {
    const options = getCategoryOptionsForType(productType);
    return options[0] || 'Lainnya';
  }, [getCategoryOptionsForType]);

  const [selectedProductId, setSelectedProductId] = useState<number | string | null>(() => {
    if (typeof window !== 'undefined') {
      const isNarrow = window.innerWidth < 880;
      const isActionNew = new URLSearchParams(window.location.search).get('action') === 'new';
      if (isActionNew || !isNarrow) {
        return 'new';
      }
    }
    return null;
  });
  const [isSelectingProductType, setIsSelectingProductType] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isNarrow = window.innerWidth < 880;
      const isActionNew = new URLSearchParams(window.location.search).get('action') === 'new';
      const hasType = Boolean(new URLSearchParams(window.location.search).get('type') || new URLSearchParams(window.location.search).get('catalog_type'));
      if ((isActionNew || !isNarrow) && !hasType) {
        return true;
      }
    }
    return false;
  });

  // Responsive Tablet Form-Factor Tracking (Tablet Mini < 880px vs Tablet Lebar >= 880px)
  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 880);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Narrow screen and single-pane back interceptions are managed natively by TabletMasterDetailView

  const [productSearch, setProductSearch] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [productSortFilter, setProductSortFilter] = useState<string>('newest');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'low' | 'out' | 'out_of_stock'>('all');
  const [isProductFilterOpen, setIsProductFilterOpen] = useState<boolean>(false);
  const [productPage, setProductPage] = useState<number>(1);
  const [productTotalPages, setProductTotalPages] = useState<number>(1);
  const [productTotalRecords, setProductTotalRecords] = useState<number>(0);
  const [catalogMetrics, setCatalogMetrics] = useState<{
    total_items?: number;
    active_items?: number;
    archived_items?: number;
    out_of_stock_items?: number;
    low_stock_items?: number;
    total_categories?: number;
    total_value?: number;
    by_type?: Record<string, number>;
    by_category?: Record<string, number>;
  } | null>(null);
  const [hasEverLoadedProducts, setHasEverLoadedProducts] = useState<boolean>(false);

  // Active filter count for badge indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (productStatusFilter !== 'all') count++;
    if (productCategoryFilter !== 'all') count++;
    if (productTypeFilter !== 'all') count++;
    if (productSortFilter !== 'newest') count++;
    if (productStockFilter !== 'all') count++;
    return count;
  }, [productStatusFilter, productCategoryFilter, productTypeFilter, productSortFilter, productStockFilter]);

  // When catalog has 0 items ever, hide filter bar, metrics, and pagination per user requirement
  const isCatalogCompletelyEmpty = useMemo(() => {
    if (!hasEverLoadedProducts) return false;
    if (catalogMetrics && typeof catalogMetrics.total_items === 'number') {
      return catalogMetrics.total_items === 0;
    }
    return (
      productTotalRecords === 0 &&
      !productSearch.trim() &&
      activeFilterCount === 0
    );
  }, [hasEverLoadedProducts, catalogMetrics, productTotalRecords, productSearch, activeFilterCount]);

  // Distinct catalog types present in the store's inventory
  const availableCatalogTypes = useMemo(() => {
    // 1. Check catalogMetrics.by_type
    if (catalogMetrics?.by_type) {
      const typesFromMetrics = Object.keys(catalogMetrics.by_type).filter(
        k => (catalogMetrics.by_type?.[k] || 0) > 0
      );
      if (typesFromMetrics.length > 0) return typesFromMetrics;
    }
    // 2. Fallback to products array
    const typesFromProducts = products
      .map(p => p.product_type || 'physical')
      .filter(Boolean);
    return Array.from(new Set(typesFromProducts));
  }, [catalogMetrics, products]);

  // Hybrid store flag: true only if there are 2 or more distinct catalog types in the items
  const isHybridStore = availableCatalogTypes.length > 1;

  // Auto-reset productTypeFilter to 'all' if store only has 1 catalog type
  useEffect(() => {
    if (!isHybridStore && productTypeFilter !== 'all') {
      setProductTypeFilter('all');
    }
  }, [isHybridStore, productTypeFilter]);

  const handleApplyProductFilters = useCallback((filters: TabletProductFilterValues) => {
    setProductStatusFilter(filters.status);
    setProductSortFilter(filters.sort);
    setProductTypeFilter(filters.productType);
    setProductCategoryFilter(filters.categoryId);
    setProductStockFilter(filters.stockStatus);
    setProductPage(1);
  }, []);

  const handleResetAllFilters = useCallback(() => {
    setProductSearch('');
    setProductStatusFilter('all');
    setProductCategoryFilter('all');
    setProductTypeFilter('all');
    setProductSortFilter('newest');
    setProductStockFilter('all');
    setProductPage(1);
  }, []);

  // Tag mode switcher for horizontal scrollable filter bar: Format Katalog vs Kategori
  const [filterTagMode, setFilterTagMode] = useState<'types' | 'categories'>('types');

  // Effective tag mode: if not hybrid, always fallback to 'categories'
  const effectiveFilterTagMode = isHybridStore ? filterTagMode : 'categories';

  // Format Katalog tag items with Lucide vector icons, badges, and distinct theme colors
  // Only populated if isHybridStore is true (more than 1 catalog type exists)
  const catalogTypeTagItems: FilterTagItem[] = useMemo(() => {
    if (!isHybridStore) return [];

    const availableOptions = CATALOG_TYPE_OPTIONS.filter(opt =>
      availableCatalogTypes.includes(opt.id)
    );

    return [
      {
        id: 'all',
        label: 'Semua Format',
        count: catalogMetrics?.total_items ?? productTotalRecords
      },
      ...availableOptions.map((opt) => ({
        id: opt.id,
        label: opt.name,
        icon: opt.icon,
        color: opt.color,
        bgColor: opt.bgColor,
        borderColor: opt.borderColor,
        count: catalogMetrics?.by_type?.[opt.id]
      }))
    ];
  }, [isHybridStore, availableCatalogTypes, catalogMetrics?.total_items, catalogMetrics?.by_type, productTotalRecords]);

  // Category tag items for the horizontal scrollable track (combines relational categories & master classes)
  const categoryTagItems: FilterTagItem[] = useMemo(() => {
    const list: FilterTagItem[] = [
      {
        id: 'all',
        label: 'Semua Kategori'
      }
    ];

    const seen = new Set<string>();
    categories.forEach((cat) => {
      if (cat.name && !seen.has(cat.name.toLowerCase())) {
        seen.add(cat.name.toLowerCase());
        list.push({
          id: String(cat.id),
          label: cat.name,
          icon: Tag
        });
      }
    });

    products.forEach((p) => {
      if (p.class && !seen.has(p.class.toLowerCase())) {
        seen.add(p.class.toLowerCase());
        list.push({
          id: p.class,
          label: p.class,
          icon: Tag
        });
      }
    });

    return list;
  }, [categories, products]);

  const [productForm, setProductForm] = useState({
    id: 0,
    name: '',
    price: 0,
    stock: 1,
    category_id: '',
    class: '',
    product_type: '',
    scientific_name: '',
    unit: 'Pcs',
    description: '',
    image_url: '',
    video_url: '',
    is_active: true,
    is_shipping_available: true,
    min_order: 1,
    max_order: '' as string | number,
    gallery_images: [] as string[],
    variants: [] as Array<{ variant_name: string; sku: string; price_override?: number; stock_qty: number }>,
    attributes: {} as Record<string, any>
  });

  const mainImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImageInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartNewProduct = useCallback((presetType?: string) => {
    setSelectedProductId('new');
    setShowCustomClassInput(false);
    setCustomClass('');
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const targetType = presetType || params?.get('type') || params?.get('catalog_type') || '';
    const isValidType = CATALOG_TYPE_OPTIONS.some(t => t.id === targetType);
    const chosenType = isValidType ? targetType : '';
    const typeDef = chosenType ? CATALOG_TYPE_OPTIONS.find(t => t.id === chosenType) : undefined;
    const initialClass = chosenType ? getDefaultCategoryForType(chosenType) : '';

    const defaultAttrs: Record<string, any> = {};
    if (chosenType === 'physical') {
      defaultAttrs.condition = 'Baru';
      defaultAttrs.weight = 100;
      defaultAttrs.brand = '';
      defaultAttrs.variant = '';
      defaultAttrs.material = '';
    }
    if (chosenType === 'food') {
      defaultAttrs.halal_status = 'Bersertifikat Halal Resmi (BPJPH / MUI)';
      defaultAttrs.variant = '';
      defaultAttrs.portion_size = '';
      defaultAttrs.prep_time = '';
      defaultAttrs.storage_temp = 'Suhu Ruang (Kering & Sejuk)';
      defaultAttrs.expired_info = '';
      defaultAttrs.delivery_condition = 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)';
    }
    if (chosenType === 'digital') {
      defaultAttrs.file_format = 'PDF';
      defaultAttrs.file_size = '10 MB';
      defaultAttrs.license_type = 'Lisensi Personal';
      defaultAttrs.delivery_condition = 'Akses Instan Otomatis (Link Cloud)';
    }
    if (chosenType === 'service') {
      defaultAttrs.duration = '1 Sesi / 1 Jam';
      defaultAttrs.service_location = 'Datang ke Toko';
      defaultAttrs.service_area = 'Jabodetabek';
    }
    if (chosenType === 'plant') {
      defaultAttrs.sunlight = 'Partial Sun (Teduh Terang)';
      defaultAttrs.watering = 'Sedang (2-3 Hari Sekali)';
      defaultAttrs.planting_medium = 'Tanah Subur & Kompos';
      defaultAttrs.plant_size = 'Tinggi 25-35 cm';
      defaultAttrs.protection_status = 'Non-Dilindungi (Aman Diperjualbelikan)';
      defaultAttrs.delivery_condition = 'Kirim Bersama Pot & Media Tanam';
      defaultAttrs.conservation_status = 'Ready Stock';
    }
    if (chosenType === 'fauna') {
      defaultAttrs.habitat = 'General';
      defaultAttrs.diet = '';
      defaultAttrs.native_region = '';
      defaultAttrs.lifespan = '';
      defaultAttrs.weight = '';
      defaultAttrs.conservation_status = 'Tersedia';
      defaultAttrs.delivery_condition = 'Bisa Kirim se-Indonesia (Legal & Berizin)';
    }
    if (chosenType === 'property') {
      defaultAttrs.transaction_type = 'Dijual';
      defaultAttrs.certificate = 'SHM (Sertifikat Hak Milik)';
      defaultAttrs.land_area = '120';
      defaultAttrs.building_area = '90';
      defaultAttrs.bedrooms = 3;
      defaultAttrs.bathrooms = 2;
      defaultAttrs.floors = '2 Lantai';
      defaultAttrs.carport = '1 Mobil';
      defaultAttrs.electricity = '2200 VA';
      defaultAttrs.water_source = 'PDAM & Sumur Bor';
      defaultAttrs.furnishing = 'Semi-Furnished';
      defaultAttrs.facing = 'Timur';
      defaultAttrs.facilities = 'One Gate System, Keamanan 24 Jam';
      defaultAttrs.property_location = 'BSD City, Tangerang Selatan';
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'items');
      url.searchParams.set('action', 'new');
      if (isValidType) {
        url.searchParams.set('type', targetType);
      } else {
        url.searchParams.delete('type');
        url.searchParams.delete('catalog_type');
      }
      window.history.pushState({}, '', url.toString());
    } catch {}

    setProductForm({
      id: 0,
      name: '',
      price: 0,
      stock: 1,
      category_id: categoriesRef.current.length > 0 ? String(categoriesRef.current[0].id) : '',
      class: initialClass,
      product_type: chosenType,
      scientific_name: '',
      unit: typeDef?.defaultUnit || 'Pcs',
      description: '',
      image_url: '',
      video_url: '',
      is_active: true,
      is_shipping_available: true,
      min_order: 1,
      max_order: '',
      gallery_images: [],
      variants: [],
      attributes: defaultAttrs
    });

    setIsSelectingProductType(!isValidType);
  }, [getDefaultCategoryForType]);

  const handleCancelToProductTypeSelection = useCallback(() => {
    setSelectedProductId('new');
    setIsSelectingProductType(true);
    setShowCustomClassInput(false);
    setCustomClass('');
    setProductForm({
      id: 0,
      name: '',
      price: 0,
      stock: 1,
      category_id: categoriesRef.current.length > 0 ? String(categoriesRef.current[0].id) : '',
      class: '',
      product_type: '',
      scientific_name: '',
      unit: 'Pcs',
      description: '',
      image_url: '',
      video_url: '',
      is_active: true,
      is_shipping_available: true,
      min_order: 1,
      max_order: '',
      gallery_images: [],
      variants: [],
      attributes: {}
    });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'items');
      url.searchParams.set('action', 'new');
      url.searchParams.delete('type');
      url.searchParams.delete('catalog_type');
      window.history.pushState({}, '', url.toString());
    } catch {}
  }, []);

  const fetchProducts = useCallback(async (
    page: number,
    search: string = '',
    status: string = 'all',
    catId: string = 'all',
    pType: string = 'all',
    sort: string = 'newest',
    stock: string = 'all'
  ) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        search: search,
        status: status
      });
      if (catId && catId !== 'all') {
        query.set('category_id', catId);
      }
      if (pType && pType !== 'all') {
        query.set('product_type', pType);
      }
      if (sort && sort !== 'newest') {
        query.set('sort', sort);
      }
      if (stock && stock !== 'all') {
        query.set('stock', stock);
      }

      const endpoint = storeSlug
        ? `/api/u/${encodeURIComponent(storeSlug)}/products?view=merchant&${query.toString()}`
        : `/api/products?${query.toString()}`;

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.products || [];
        const pagination = json.pagination;
        const totalItems = pagination?.total_items ?? json.total ?? list.length;
        const totalPages = pagination?.total_pages ?? json.totalPages ?? Math.max(1, Math.ceil(totalItems / 15));
        setProducts(list);
        setProductPage(page);
        setProductTotalPages(totalPages);
        setProductTotalRecords(totalItems);
        setHasEverLoadedProducts(true);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [token, storeSlug, fetch]);

  const fetchCatalogMetrics = useCallback(async () => {
    if (!storeSlug) return;
    try {
      const res = await fetch(`/api/u/${encodeURIComponent(storeSlug)}/catalog-metrics?view=merchant`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCatalogMetrics(json.data);
        }
      }
    } catch {}
  }, [storeSlug, token]);

  const handleSelectProduct = (prod: any) => {
    setSelectedProductId(prod.id);
    setIsSelectingProductType(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('type');
      url.searchParams.delete('catalog_type');
      window.history.pushState({}, '', url.toString());
    } catch {}
    const gallery = (prod.images || []).map((img: any) => img.image_url || img);
    const variants = (prod.variants || []).map((v: any) => ({
      variant_name: v.variant_name || '',
      sku: v.sku || '',
      price_override: v.price_override,
      stock_qty: v.stock_qty || 0
    }));

    let rawAttrs: Record<string, any> = {};
    if (prod.attributes) {
      if (typeof prod.attributes === 'string') {
        try { rawAttrs = JSON.parse(prod.attributes); } catch {}
      } else if (typeof prod.attributes === 'object') {
        rawAttrs = { ...prod.attributes };
      }
    }

    const editProdType = prod.product_type || 'physical';
    const resolvedClass = prod.class || prod.category_name || (categories.find(c => String(c.id) === String(prod.category_id))?.name) || getDefaultCategoryForType(editProdType);
    setShowCustomClassInput(false);
    setCustomClass('');

    setProductForm({
      id: prod.id,
      name: prod.name || '',
      price: prod.price || 0,
      stock: prod.stock !== undefined ? prod.stock : 1,
      category_id: prod.category_id || '',
      class: resolvedClass,
      product_type: editProdType,
      scientific_name: prod.scientific_name || rawAttrs.scientific_name || '',
      unit: prod.unit || 'Pcs',
      description: prod.description || '',
      image_url: prod.image_url || '',
      video_url: prod.video_url || '',
      is_active: prod.is_active !== undefined ? prod.is_active : true,
      is_shipping_available: prod.is_shipping_available !== undefined ? prod.is_shipping_available : true,
      min_order: prod.min_order || 1,
      max_order: prod.max_order || '',
      gallery_images: gallery,
      variants: variants,
      attributes: {
        ...(prod.habitat ? { habitat: prod.habitat } : {}),
        ...(prod.diet ? { diet: prod.diet } : {}),
        ...(prod.conservation_status ? { conservation_status: prod.conservation_status } : {}),
        ...(prod.lifespan ? { lifespan: prod.lifespan } : {}),
        ...(prod.native_region ? { native_region: prod.native_region } : {}),
        ...(prod.weight ? { weight: prod.weight } : {}),
        ...rawAttrs
      }
    });
  };

  const handleSelectProductType = (typeId: string) => {
    const typeDef = CATALOG_TYPE_OPTIONS.find(t => t.id === typeId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'items');
      url.searchParams.set('action', 'new');
      url.searchParams.set('type', typeId);
      window.history.replaceState({ tab: 'items', action: 'new', type: typeId }, '', url.toString());
    } catch {}
    setProductForm(prev => {
      const defaultAttrs: Record<string, any> = { ...(prev.attributes || {}) };
      if (typeId === 'physical') {
        if (!defaultAttrs.condition) defaultAttrs.condition = 'Baru';
        if (defaultAttrs.weight === undefined) defaultAttrs.weight = 100;
      }
      if (typeId === 'food') {
        if (!defaultAttrs.halal_status) defaultAttrs.halal_status = 'Bersertifikat Halal Resmi (BPJPH / MUI)';
        if (!defaultAttrs.storage_temp) defaultAttrs.storage_temp = 'Suhu Ruang (Kering & Sejuk)';
      }
      if (typeId === 'digital') {
        if (!defaultAttrs.file_format) defaultAttrs.file_format = 'PDF';
        if (!defaultAttrs.file_size) defaultAttrs.file_size = '10 MB';
        if (!defaultAttrs.license_type) defaultAttrs.license_type = 'Lisensi Personal';
      }
      if (typeId === 'service') {
        if (!defaultAttrs.duration) defaultAttrs.duration = '1 Sesi / 1 Jam';
        if (!defaultAttrs.service_location) defaultAttrs.service_location = 'Datang ke Toko';
        if (!defaultAttrs.service_area) defaultAttrs.service_area = 'Jabodetabek';
      }
      if (typeId === 'plant') {
        if (!defaultAttrs.sunlight) defaultAttrs.sunlight = 'Partial Sun (Teduh Terang)';
        if (!defaultAttrs.watering) defaultAttrs.watering = 'Sedang (2-3 Hari Sekali)';
        if (!defaultAttrs.protection_status) defaultAttrs.protection_status = 'Non-Dilindungi (Aman Diperjualbelikan)';
        if (!defaultAttrs.delivery_condition) defaultAttrs.delivery_condition = 'Kirim Bersama Pot & Media Tanam';
        if (!defaultAttrs.conservation_status) defaultAttrs.conservation_status = 'Ready Stock';
      }
      if (typeId === 'fauna') {
        if (!defaultAttrs.conservation_status) defaultAttrs.conservation_status = 'Tersedia';
        if (!defaultAttrs.habitat) defaultAttrs.habitat = 'General';
      }
      if (typeId === 'property') {
        if (!defaultAttrs.transaction_type) defaultAttrs.transaction_type = 'Dijual';
        if (!defaultAttrs.certificate) defaultAttrs.certificate = 'SHM (Sertifikat Hak Milik)';
        if (!defaultAttrs.furnishing) defaultAttrs.furnishing = 'Semi-Furnished';
        if (!defaultAttrs.facing) defaultAttrs.facing = 'Timur';
      }

      const isDefaultUnit = !prev.unit || prev.unit === 'Pcs' || CATALOG_TYPE_OPTIONS.some(o => o.defaultUnit === prev.unit);
      const shouldUpdateUnit = prev.id === 0 && isDefaultUnit;

      const validCategories = getCategoryOptionsForType(typeId);
      const isFromOtherTypeDefault = (Object.keys(DEFAULT_MASTER_CATEGORIES) as ItemCategoryType[])
        .some(otherType => otherType !== typeId && DEFAULT_MASTER_CATEGORIES[otherType].includes(prev.class));
      const nextClass = (prev.class && validCategories.includes(prev.class) && !isFromOtherTypeDefault)
        ? prev.class
        : (validCategories[0] || 'Lainnya');

      return {
        ...prev,
        product_type: typeId,
        class: nextClass,
        unit: shouldUpdateUnit ? (typeDef?.defaultUnit || 'Pcs') : prev.unit,
        attributes: defaultAttrs
      };
    });
    setIsSelectingProductType(false);
  };

  const handleBackToTypeSelection = useCallback(() => {
    setIsSelectingProductType(true);
    setProductForm(prev => ({ ...prev, product_type: '' }));
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('type');
      url.searchParams.delete('catalog_type');
      window.history.replaceState({ tab: 'items', action: 'new' }, '', url.toString());
    } catch {}
  }, []);

  // Sub-workflow Back Interceptor 1 (Step 2 -> Step 1):
  // When merchant is in Step 2 (Product Input Form) during new product creation,
  // pressing hardware/browser Back or swipe gesture reverts back to Step 1 (Pilih Tipe Katalog)
  useModalBackHandler({
    isOpen: activeTab === 'items' && selectedProductId === 'new' && !isSelectingProductType && Boolean(productForm.product_type),
    onClose: handleBackToTypeSelection,
    modalId: 'tablet_new_item_form_step'
  });

  // Sub-workflow Back Interceptor 2 (Step 1 -> Cancel creation):
  // When merchant is in Step 1 (Pilih Tipe) during new product creation,
  // pressing hardware/browser Back cancels creation and restores previous view
  useModalBackHandler({
    isOpen: activeTab === 'items' && selectedProductId === 'new' && isSelectingProductType,
    onClose: () => {
      if (products.length > 0 && !isNarrowScreen) {
        handleSelectProduct(products[0]);
      } else {
        setSelectedProductId(null);
        setIsSelectingProductType(false);
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('type');
        url.searchParams.delete('catalog_type');
        window.history.replaceState({ tab: 'items' }, '', url.toString());
      } catch {}
    },
    modalId: 'tablet_new_item_type_step'
  });

  // Sub-workflow Back Interceptor for Rename Master Category Modal
  useModalBackHandler({
    isOpen: Boolean(renameMasterModalData),
    onClose: () => setRenameMasterModalData(null),
    modalId: 'tablet_rename_master_modal'
  });

  // Sub-workflow Back Interceptor for Delete & Reassign Master Category Modal
  useModalBackHandler({
    isOpen: Boolean(deleteMasterModalData),
    onClose: () => setDeleteMasterModalData(null),
    modalId: 'tablet_delete_master_modal'
  });

  // Comprehensive browser history listener (activeTab + sub-view query state)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined' || window.__catavor_is_modal_popping) return;
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabletMerchantTab;
      const validTabs: TabletMerchantTab[] = [
        'items', 'categories', 'analytics', 'subscription', 'settings',
        'profile', 'audit_logs', 'notifications', 'help', 'policies', 'share'
      ];
      const activeT = (tabParam && validTabs.includes(tabParam)) ? tabParam : 'items';
      setActiveTabState(activeT);

      if (activeT === 'items') {
        const actionParam = params.get('action');
        const typeParam = params.get('type') || params.get('catalog_type');
        if (actionParam === 'new') {
          setSelectedProductId('new');
          if (typeParam) {
            setIsSelectingProductType(false);
            setProductForm(prev => ({ ...prev, product_type: typeParam }));
          } else {
            setIsSelectingProductType(true);
            setProductForm(prev => ({ ...prev, product_type: '' }));
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateProductAttribute = (field: string, value: any) => {
    setProductForm(prev => ({
      ...prev,
      attributes: {
        ...(prev.attributes || {}),
        [field]: value
      }
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }
    if (!productForm.product_type) {
      showToast('Silakan pilih tipe item katalog terlebih dahulu', 'error');
      setIsSelectingProductType(true);
      return;
    }
    setSaving(true);
    try {
      const isNew = selectedProductId === 'new';
      const url = isNew ? '/api/products' : `/api/products/${productForm.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const effectiveClass = (showCustomClassInput ? customClass.trim() : productForm.class.trim()) || getDefaultCategoryForType(productForm.product_type);
      
      // Auto register custom category to backend master options if typed directly
      if (showCustomClassInput && customClass.trim()) {
        const pType = (productForm.product_type || 'physical') as ItemCategoryType;
        const existingOpts = getCategoryOptionsForType(pType);
        if (!existingOpts.includes(customClass.trim())) {
          try {
            fetch('/api/stores/add-master-option', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Store-Slug': storeSlug,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                field: 'class',
                value: customClass.trim(),
                product_type: pType
              })
            }).then(() => {
              setMasterCategories(prev => {
                const cur = prev[pType] || [];
                return {
                  ...prev,
                  [pType]: Array.from(new Set([...cur, customClass.trim()]))
                };
              });
            }).catch(() => {});
          } catch {}
        }
      }

      const matchedCat = categories.find(c => c.name.toLowerCase() === effectiveClass.toLowerCase());

      const payload = {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        class: effectiveClass,
        category_id: productForm.category_id ? Number(productForm.category_id) : (matchedCat ? matchedCat.id : undefined),
        product_type: productForm.product_type,
        scientific_name: productForm.scientific_name || (productForm.attributes?.scientific_name) || undefined,
        habitat: (productForm.product_type === 'fauna' || productForm.product_type === 'plant') ? (productForm.attributes?.habitat || undefined) : undefined,
        diet: productForm.product_type === 'fauna' ? (productForm.attributes?.diet || undefined) : undefined,
        conservation_status: (productForm.product_type === 'fauna' || productForm.product_type === 'plant') ? (productForm.attributes?.conservation_status || undefined) : undefined,
        unit: productForm.unit,
        description: productForm.description,
        image_url: productForm.image_url,
        video_url: productForm.video_url,
        is_active: productForm.is_active,
        is_shipping_available: productForm.is_shipping_available,
        min_order: Number(productForm.min_order) || 1,
        max_order: productForm.max_order !== '' ? Number(productForm.max_order) : null,
        gallery_images: productForm.gallery_images,
        variants: productForm.variants.map(v => ({
          variant_name: v.variant_name,
          sku: v.sku,
          price_override: v.price_override !== undefined && v.price_override !== null && v.price_override > 0 ? Number(v.price_override) : null,
          stock_qty: Number(v.stock_qty) || 0
        })),
        attributes: productForm.attributes || {}
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        showToast(isNew ? 'Produk berhasil ditambahkan!' : 'Perubahan produk berhasil disimpan!');
        await fetchProducts(
          productPage,
          productSearch,
          productStatusFilter,
          productCategoryFilter,
          productTypeFilter,
          productSortFilter,
          productStockFilter
        );
        fetchCatalogMetrics();
        if (isNarrowScreen) {
          setSelectedProductId(null);
          setIsSelectingProductType(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            url.searchParams.delete('type');
            url.searchParams.delete('catalog_type');
            window.history.pushState({}, '', url.toString());
          } catch {}
        } else if (json.data?.id) {
          setSelectedProductId(json.data.id);
          setIsSelectingProductType(false);
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
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        }
      });
      if (res.ok) {
        showToast('Produk berhasil dihapus');
        setSelectedProductId(null);
        await fetchProducts(
          1,
          productSearch,
          productStatusFilter,
          productCategoryFilter,
          productTypeFilter,
          productSortFilter,
          productStockFilter
        );
        fetchCatalogMetrics();
      } else {
        showToast('Gagal menghapus produk', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // Add Product Variant Row
  const handleAddVariant = () => {
    setProductForm(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        { variant_name: '', sku: '', price_override: undefined, stock_qty: 0 }
      ]
    }));
  };

  // Remove Product Variant Row
  const handleRemoveVariant = (index: number) => {
    setProductForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index)
    }));
  };

  // Update Product Variant Field
  const handleUpdateVariant = (index: number, field: string, value: any) => {
    setProductForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, idx) => idx === index ? { ...v, [field]: value } : v)
    }));
  };

  // Add Gallery Image URL
  const handleAddGalleryImage = (url: string) => {
    if (!url) return;
    setProductForm(prev => ({
      ...prev,
      gallery_images: [...prev.gallery_images, url]
    }));
  };

  // Remove Gallery Image
  const handleRemoveGalleryImage = (index: number) => {
    setProductForm(prev => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, idx) => idx !== index)
    }));
  };

  // =========================================================================
  // 3. MASTER CATEGORIES ACTIONS (Two-Tier Data Architecture)
  // =========================================================================
  const fetchCategories = useCallback(async () => {
    try {
      const endpoint = storeSlug ? `/api/u/${storeSlug}/categories` : '/api/categories';
      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.categories || [];
        setCategories(list);
      }
    } catch {
      // safe fallback
    }
  }, [storeSlug, getHeaders]);

  const handleAddMasterOption = async (
    value: string,
    productType: ItemCategoryType,
    resetInput?: (val: string) => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      showToast('Nama kategori tidak boleh kosong.', 'error');
      return false;
    }

    const isAlreadyDefault = (DEFAULT_MASTER_CATEGORIES[productType] || []).some(
      c => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (isAlreadyDefault) {
      showToast(`Kategori "${trimmed}" sudah tersedia sebagai standar bawaan sistem.`, 'error');
      return false;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/stores/add-master-option', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          field: 'class',
          value: trimmed,
          product_type: productType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Kategori baru berhasil ditambahkan!');
        if (resetInput) resetInput('');
        setMasterCategories(prev => {
          const cur = prev[productType] || [];
          return {
            ...prev,
            [productType]: Array.from(new Set([...cur, trimmed]))
          };
        });
        await fetchStoreProfile();
        await fetchCategories();
        return true;
      } else {
        showToast(data.message || 'Gagal menambahkan kategori baru.', 'error');
        return false;
      }
    } catch {
      showToast('Terjadi kesalahan koneksi saat menambah kategori baru.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRenameMasterOption = async (
    oldValue: string,
    newValue: string,
    productType: ItemCategoryType
  ) => {
    if ((DEFAULT_MASTER_CATEGORIES[productType] || []).includes(oldValue)) {
      showToast(`Kategori "${oldValue}" adalah standar bawaan sistem dan tidak dapat diubah namanya.`, 'error');
      setRenameMasterModalData(null);
      return;
    }

    const trimmed = newValue.trim();
    if (!trimmed) {
      showToast('Nama kategori tidak boleh kosong.', 'error');
      return;
    }
    if (trimmed === oldValue) {
      setRenameMasterModalData(null);
      return;
    }

    const isAlreadyDefault = (DEFAULT_MASTER_CATEGORIES[productType] || []).some(
      c => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (isAlreadyDefault) {
      showToast(`Kategori "${trimmed}" sudah merupakan standar bawaan sistem.`, 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/stores/rename-master-option', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          field: 'class',
          old_value: oldValue,
          new_value: trimmed,
          product_type: productType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Nama kategori berhasil diubah dan disinkronkan!');
        setRenameMasterModalData(null);
        setMasterCategories(prev => {
          const cur = prev[productType] || [];
          return {
            ...prev,
            [productType]: cur.map(c => c === oldValue ? trimmed : c)
          };
        });
        await fetchStoreProfile();
        await fetchProducts(
          productPage,
          productSearch,
          productStatusFilter,
          productCategoryFilter,
          productTypeFilter,
          productSortFilter,
          productStockFilter
        );
      } else {
        showToast(data.message || 'Gagal mengubah nama kategori.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi saat mengubah nama kategori.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteMasterOption = (value: string, productType: ItemCategoryType) => {
    if ((DEFAULT_MASTER_CATEGORIES[productType] || []).includes(value)) {
      showToast(`Kategori "${value}" adalah standar bawaan sistem dan tidak dapat dihapus.`, 'error');
      return;
    }

    const options = getCategoryOptionsForType(productType);
    const replacementOptions = options.filter(opt => opt !== value && opt !== '+ Tambah Baru...' && opt !== '__NEW__' && opt !== '__ADD_NEW__');

    if (replacementOptions.length === 0) {
      showToast('Tidak ada opsi kategori pengganti lain yang tersedia untuk menghapus kategori ini.', 'error');
      return;
    }

    setDeleteMasterModalData({
      field: 'class',
      value,
      replacementOptions,
      selectedReplacement: replacementOptions[0],
      productType
    });
  };

  const handleConfirmDeleteMasterOption = async () => {
    if (!deleteMasterModalData) return;
    const { field, value, selectedReplacement, productType } = deleteMasterModalData;
    setDeleteMasterModalData(null);

    setSaving(true);
    try {
      const res = await fetch('/api/stores/delete-master-option', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          field,
          value,
          replacement_option: selectedReplacement,
          product_type: productType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Kategori berhasil dihapus dan item telah dialihkan!');
        setMasterCategories(prev => {
          const cur = prev[productType] || [];
          return {
            ...prev,
            [productType]: cur.filter(c => c !== value)
          };
        });
        await fetchStoreProfile();
        await fetchProducts(
          productPage,
          productSearch,
          productStatusFilter,
          productCategoryFilter,
          productTypeFilter,
          productSortFilter,
          productStockFilter
        );
      } else {
        showToast(data.message || 'Gagal menghapus kategori.', 'error');
      }
    } catch {
      showToast('Koneksi internet bermasalah. Gagal menghapus kategori.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // 4. NOTIFICATIONS STATE
  // =========================================================================
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState<number>(0);
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
        if (typeof json.unread_count === 'number') {
          setNotifUnreadCount(json.unread_count);
        }
      }
    } catch {
      // safe fallback
    }
  }, [notifFilter, storeSlug, getHeaders]);

  const handleMarkNotifRead = async (id: number | string) => {
    try {
      setNotifications(prev => {
        const item = prev.find(n => n.id === id);
        if (item && !item.read) {
          setNotifUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.map(n => n.id === id ? { ...n, read: true } : n);
      });
      await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: getHeaders() });
    } catch {}
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setNotifUnreadCount(0);
      showToast('Semua notifikasi ditandai telah dibaca');
      await fetch('/api/notifications/read-all', { method: 'POST', headers: getHeaders() });
    } catch {}
  };

  // =========================================================================
  // 5. SUBSCRIPTIONS & QUOTA STATE
  // =========================================================================
  const [quota, setQuota] = useState<StoreQuotaData | null>(null);
  const [subscriptionOrders, setSubscriptionOrders] = useState<any[]>([]);
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);

  const fetchQuota = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/subscription/my-quota', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setQuota(json.data);
        }
      }
    } catch {}
  }, [token, storeSlug]);

  const fetchSubscriptionOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/subscription/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSubscriptionOrders(json.data);
        }
      }
    } catch {}
  }, [token, storeSlug]);

  // =========================================================================
  // 6. SUPPORT TICKETS & REAL-TIME REPLIES
  // =========================================================================
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | 'new' | null>(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'technical', message: '', priority: 'normal' });
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [ticketDetails, setTicketDetails] = useState<any | null>(null);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState<boolean>(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/support/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        }
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.tickets || [];
        setTickets(list);
        if (list.length > 0 && !isNarrowScreen) {
          setSelectedTicketId(prev => (prev === null ? list[0].id : prev));
        }
      }
    } catch {
      // safe fallback
    }
  }, [token, storeSlug, isNarrowScreen]);

  const fetchTicketDetails = useCallback(async (ticketId: number) => {
    if (!token || !ticketId) return;
    setLoadingTicketDetail(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug
        }
      });
      if (res.ok) {
        const json = await res.json();
        setTicketDetails(json.data || json.ticket || null);
        // Automatically clear unread status for this ticket in local list & support ping count
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, unread_count: 0, has_unread: false } : t));
        setSupportUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {}
    finally {
      setLoadingTicketDetail(false);
    }
  }, [token, storeSlug]);

  const [supportUnreadCount, setSupportUnreadCount] = useState<number>(0);

  const fetchTicketsPing = useCallback(async () => {
    if (!token) return;
    try {
      const queryParams = new URLSearchParams();
      if (storeSlug) {
        queryParams.set('store_slug', storeSlug);
      }
      const res = await fetch(`/api/support/tickets-ping?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {}),
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.success && typeof d.unread_count === 'number') {
          setSupportUnreadCount(d.unread_count);
        }
      }
    } catch {}
  }, [token, storeSlug]);

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
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...ticketForm,
          store_slug: storeSlug
        })
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

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || selectedTicketId === 'new' || !replyMessage.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: replyMessage.trim() })
      });
      if (res.ok) {
        showToast('Balasan tiket berhasil dikirim');
        setReplyMessage('');
        fetchTicketDetails(Number(selectedTicketId));
        fetchTickets();
      } else {
        showToast('Gagal mengirim balasan tiket', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // 7. USER PROFILE & PASSWORD (Dual-Mode: SSO Backup vs Standard Change)
  // =========================================================================
  const [hasCustomPassword, setHasCustomPassword] = useState<boolean>(() => {
    if (currentUser?.has_custom_password !== undefined) {
      return Boolean(currentUser.has_custom_password);
    }
    try {
      const saved = localStorage.getItem('catavor_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.has_custom_password !== undefined) {
          return Boolean(parsed.has_custom_password);
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return true;
  });

  useEffect(() => {
    if (currentUser?.has_custom_password !== undefined) {
      setHasCustomPassword(Boolean(currentUser.has_custom_password));
    }
  }, [currentUser?.has_custom_password]);

  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [showOldPassword, setShowOldPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPass = passwordForm.new_password.trim();
    const confirmPass = passwordForm.confirm_password.trim();
    const oldPass = passwordForm.old_password.trim();

    if (hasCustomPassword && !oldPass) {
      showToast('Kata sandi saat ini wajib diisi', 'error');
      return;
    }

    if (newPass.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter', 'error');
      return;
    }
    if (!/[A-Z]/.test(newPass)) {
      showToast('Kata sandi baru wajib mengandung minimal 1 huruf besar (A-Z)', 'error');
      return;
    }
    if (!/[a-z]/.test(newPass)) {
      showToast('Kata sandi baru wajib mengandung minimal 1 huruf kecil (a-z)', 'error');
      return;
    }
    if (!/[0-9]/.test(newPass)) {
      showToast('Kata sandi baru wajib mengandung minimal 1 angka (0-9)', 'error');
      return;
    }
    if (!/[^a-zA-Z0-9\s]/.test(newPass)) {
      showToast('Kata sandi baru wajib mengandung minimal 1 simbol unik (@, #, $, %, !, dll)', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('Konfirmasi kata sandi tidak cocok', 'error');
      return;
    }
    if (hasCustomPassword && oldPass && newPass === oldPass) {
      showToast('Kata sandi baru tidak boleh sama dengan kata sandi saat ini', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: currentUser?.name || 'Admin Toko',
          current_password: hasCustomPassword ? oldPass : '',
          password: newPass,
          confirm_password: confirmPass
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('catavor_token', data.token);
        }
        try {
          const saved = localStorage.getItem('catavor_user');
          const userObj = saved ? JSON.parse(saved) : {};
          const merged = { ...userObj, ...(data.user || {}), has_custom_password: true, is_password_changed: true };
          localStorage.setItem('catavor_user', JSON.stringify(merged));
        } catch {
          // ignore
        }
        setHasCustomPassword(true);
        setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
        setShowOldPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        const successMsg = hasCustomPassword
          ? 'Kata sandi berhasil diperbarui!'
          : 'Kata sandi cadangan akun berhasil disimpan!';
        showToast(successMsg, 'success');
      } else {
        showToast(data.message || 'Gagal menyimpan kata sandi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan sistem saat menghubungi server', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 1. Initial Core Data Fetching (Run ONCE per store/token mount - Essential store profile, categories, products, notifications & tickets ping)
  const initialLoadedKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${storeSlug}_${token}`;
    if (!storeSlug || initialLoadedKeyRef.current === key) return;
    initialLoadedKeyRef.current = key;

    fetchStoreProfile();
    fetchCategories();
    fetchProducts(1, '', 'all', 'all', 'all', 'newest', 'all');
    fetchCatalogMetrics();
    fetchTicketsPing();
    fetchNotifications();
  }, [storeSlug, token, fetchStoreProfile, fetchCategories, fetchProducts, fetchCatalogMetrics, fetchTicketsPing, fetchNotifications]);

  // 2. Debounced Search & Filter Effect for Products (Only triggers fetchProducts, never refetches profile/other tabs)
  const [debouncedProductSearch, setDebouncedProductSearch] = useState<string>(productSearch);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const fetchProductsRef = useRef(fetchProducts);
  useEffect(() => {
    fetchProductsRef.current = fetchProducts;
  }, [fetchProducts]);

  const isInitialFilterMountRef = useRef<boolean>(true);
  useEffect(() => {
    if (isInitialFilterMountRef.current) {
      isInitialFilterMountRef.current = false;
      return;
    }
    fetchProductsRef.current(
      1,
      debouncedProductSearch,
      productStatusFilter,
      productCategoryFilter,
      productTypeFilter,
      productSortFilter,
      productStockFilter
    );
  }, [
    debouncedProductSearch,
    productStatusFilter,
    productCategoryFilter,
    productTypeFilter,
    productSortFilter,
    productStockFilter
  ]);

  // 3. Lazy Tab Loading (Only fetch on-demand when switching to the relevant tab)
  const loadedTabsRef = useRef<Set<string>>(new Set(['items']));
  useEffect(() => {
    if (!loadedTabsRef.current.has(activeTab)) {
      loadedTabsRef.current.add(activeTab);
      if (activeTab === 'notifications') {
        fetchNotifications();
      } else if (activeTab === 'help') {
        fetchTickets();
      } else if (activeTab === 'subscription') {
        fetchQuota();
        fetchSubscriptionOrders();
      }
    }
  }, [activeTab, fetchNotifications, fetchTickets, fetchQuota, fetchSubscriptionOrders]);

  // 4. Ticket Details Fetching (Only when help tab is active and a ticket is selected)
  useEffect(() => {
    if (activeTab === 'help' && selectedTicketId && selectedTicketId !== 'new') {
      fetchTicketDetails(Number(selectedTicketId));
    } else if (activeTab === 'help' && !selectedTicketId) {
      setTicketDetails(null);
    }
  }, [activeTab, selectedTicketId, fetchTicketDetails]);

  // 5. Periodic Background Ping (Tickets Ping & Notifications Badge Sync every 60s with visibility guard)
  useEffect(() => {
    if (!token) return;
    fetchTicketsPing();
    fetchNotifications();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchTicketsPing();
      fetchNotifications();
    }, 60000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTicketsPing();
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, fetchTicketsPing, fetchNotifications]);

  // 6. Active Support Chat Polling (every 45s while help tab is active)
  useEffect(() => {
    if (!token || activeTab !== 'help') return;

    const intervalMs = 45000;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (selectedTicketId && selectedTicketId !== 'new') {
        fetchTicketDetails(Number(selectedTicketId));
      }
      fetchTickets();
    }, intervalMs);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && activeTab === 'help') {
        if (selectedTicketId && selectedTicketId !== 'new') {
          fetchTicketDetails(Number(selectedTicketId));
        }
        fetchTickets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeTab, token, selectedTicketId, fetchTickets, fetchTicketDetails]);

  // Selected Ticket Reference
  const selectedTicket = useMemo(() => {
    if (selectedTicketId === 'new' || selectedTicketId === null) return null;
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Real-time unread notifications count combining server unread_count and local items
  const totalNotifUnread = useMemo(() => {
    const localUnread = notifications.filter(n => !n.read).length;
    return Math.max(notifUnreadCount, localUnread);
  }, [notifUnreadCount, notifications]);

  // Real-time unread support count combining active tickets and ping
  const totalHelpUnread = useMemo(() => {
    const listCount = tickets.filter(t => Boolean(t.has_unread || (t.unread_count && t.unread_count > 0))).length;
    return Math.max(listCount, supportUnreadCount);
  }, [tickets, supportUnreadCount]);

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
        { key: 'items', label: 'Daftar Item Katalog', icon: Package },
        { key: 'categories', label: 'Kategori Etalase', icon: FolderTree }
      ]
    },
    {
      title: 'PERFORMA & BISNIS',
      items: [
        { key: 'analytics', label: 'Statistik & Trafik', icon: BarChart3 },
        { key: 'subscription', label: 'Paket & Kuota', icon: CreditCard },
        { key: 'audit_logs', label: 'Jejak Audit & Log', icon: History }
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
        { key: 'notifications', label: 'Pusat Notifikasi', icon: Bell, badge: totalNotifUnread > 0 ? String(totalNotifUnread) : undefined, badgeColor: '#ef4444' },
        { key: 'help', label: 'Pusat Bantuan & Tiket', icon: HelpCircle, badge: totalHelpUnread > 0 ? String(totalHelpUnread) : undefined, badgeColor: '#ef4444' },
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
            {isNavExpanded ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
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
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {storeSettings.name || 'Admin Toko'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                      Konsol Merchant
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNavExpanded(false)}
                  title="Ciutkan Menu"
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
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsNavExpanded(true)}
                title="Perluas Menu Navigasi"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(30, 58, 138, 0.12)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <StoreIcon size={20} />
                <span style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '50%',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '14px',
                  height: '14px',
                  color: 'var(--text-muted)'
                }}>
                  <ChevronRight size={10} />
                </span>
              </button>
            )}
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
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} style={{ flexShrink: 0 }} />
                        {!isNavExpanded && item.badge && (
                          <span
                            id={`indicator-dot-${item.key}`}
                            data-testid={`indicator-dot-${item.key}`}
                            style={{
                              position: 'absolute',
                              top: '-3px',
                              right: '-4px',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: item.badgeColor || 'var(--primary)',
                              border: '1.5px solid var(--bg-card)',
                              boxShadow: '0 0 4px rgba(0,0,0,0.15)',
                              flexShrink: 0
                            }}
                            title={`${item.label}: ${item.badge} data aktif`}
                          />
                        )}
                      </div>

                      {isNavExpanded && (
                        <>
                          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span
                              id={`badge-detail-${item.key}`}
                              data-testid={`badge-detail-${item.key}`}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.5rem',
                                borderRadius: '999px',
                                backgroundColor: item.badgeColor || 'var(--primary)',
                                color: '#ffffff',
                                flexShrink: 0,
                                marginLeft: 'auto'
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
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
        minWidth: 0,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ===================================================================
            TAB 1: DAFTAR ITEM KATALOG (Master-Detail Split View)
            =================================================================== */}
        {activeTab === 'items' && (
          isCatalogCompletelyEmpty && selectedProductId !== 'new' ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              backgroundColor: 'var(--bg-deep)',
              overflowY: 'auto'
            }}>
              {/* Clean Top Header Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Katalog Produk &amp; Inventaris
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Kelola seluruh produk, harga, dan inventaris toko Anda
                  </span>
                </div>
              </div>

              {/* Full-Page Centered Executive Empty State */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                textAlign: 'center'
              }}>
                <div style={{
                  maxWidth: '460px',
                  width: '100%',
                  padding: '2.5rem 2rem',
                  borderRadius: '1.25rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(30, 58, 138, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    boxShadow: '0 0 20px rgba(30, 58, 138, 0.12)'
                  }}>
                    <Package size={32} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.45rem 0' }}>
                      Belum Ada Item Terdaftar
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                      Katalog toko Anda masih kosong. Mulai tambahkan barang fisik, makanan, jasa, tiket, atau file digital pertama Anda.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="btn-tambah-item-pertama"
                    data-testid="btn-tambah-item-pertama"
                    onClick={() => handleCancelToProductTypeSelection()}
                    style={{
                      minHeight: '44px',
                      padding: '0.65rem 1.5rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      marginTop: '0.5rem',
                      boxShadow: '0 2px 10px var(--primary-glow)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Plus size={18} />
                    <span>Tambah Item Pertama</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <TabletMasterDetailView
            title="Katalog Produk & Inventaris"
            subtitle={isCatalogCompletelyEmpty ? undefined : `${productTotalRecords} total item`}
            headerAction={
              selectedProductId === 'new' ? (
                <button
                  id="btn-reset-form-produk"
                  data-testid="btn-reset-form-produk"
                  type="button"
                  onClick={() => handleCancelToProductTypeSelection()}
                  title="Mulai Ulang Formulir & Pilih Ulang Tipe Katalog"
                  style={{
                    minHeight: '44px',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <RotateCcw size={16} />
                  <span>Reset Form</span>
                </button>
              ) : (
                <button
                  id="btn-tambah-produk"
                  data-testid="btn-tambah-produk"
                  type="button"
                  onClick={() => handleCancelToProductTypeSelection()}
                  style={{
                    minHeight: '44px',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px var(--primary-glow)'
                  }}
                >
                  <Plus size={17} />
                  <span>Tambah Produk</span>
                </button>
              )
            }
            selectedId={selectedProductId}
            onClearSelection={() => {
              if (isNarrowScreen) {
                setSelectedProductId(null);
                setIsSelectingProductType(false);
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('action');
                  url.searchParams.delete('type');
                  url.searchParams.delete('catalog_type');
                  window.history.pushState({}, '', url.toString());
                } catch {}
              } else {
                handleCancelToProductTypeSelection();
              }
            }}
            masterPane={
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Catalog Metrics Pills Summary - Hidden if catalog has no items */}
                {!isCatalogCompletelyEmpty && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.35rem',
                    padding: '0.65rem 0.75rem 0.45rem',
                    backgroundColor: 'var(--bg-deep)',
                    borderBottom: '1px solid var(--border-light)'
                  }}>
                    <div
                      onClick={() => {
                        setProductStatusFilter('all');
                        setProductStockFilter('all');
                        setProductPage(1);
                      }}
                      style={{
                        padding: '0.35rem 0.45rem',
                        borderRadius: '0.5rem',
                        backgroundColor: productStatusFilter === 'all' && productStockFilter === 'all' ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                        border: productStatusFilter === 'all' && productStockFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {catalogMetrics?.total_items ?? productTotalRecords}
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setProductStatusFilter('active');
                        setProductStockFilter('all');
                        setProductPage(1);
                      }}
                      style={{
                        padding: '0.35rem 0.45rem',
                        borderRadius: '0.5rem',
                        backgroundColor: productStatusFilter === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                        border: productStatusFilter === 'active' ? '1px solid #10b981' : '1px solid var(--border-light)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>Aktif</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>
                        {catalogMetrics?.active_items ?? (products.filter(p => p.is_active !== false).length || '-')}
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setProductStockFilter('low');
                        setProductPage(1);
                      }}
                      style={{
                        padding: '0.35rem 0.45rem',
                        borderRadius: '0.5rem',
                        backgroundColor: productStockFilter === 'low' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card)',
                        border: productStockFilter === 'low' ? '1px solid #f59e0b' : '1px solid var(--border-light)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 600 }}>Menipis</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>
                        {catalogMetrics?.low_stock_items ?? (products.filter(p => (p.stock ?? 1) > 0 && (p.stock ?? 1) <= 5).length || '-')}
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setProductStockFilter('out');
                        setProductPage(1);
                      }}
                      style={{
                        padding: '0.35rem 0.45rem',
                        borderRadius: '0.5rem',
                        backgroundColor: productStockFilter === 'out' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                        border: productStockFilter === 'out' ? '1px solid #ef4444' : '1px solid var(--border-light)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>Habis</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>
                        {catalogMetrics?.out_of_stock_items ?? (products.filter(p => (p.stock ?? 1) === 0).length || '-')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Search & Tablet Ergonomic Filter Header - Hidden if catalog has no items */}
                {!isCatalogCompletelyEmpty && (
                  <div style={{
                    padding: '0.65rem 0.75rem 0.5rem',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    backgroundColor: 'var(--bg-deep)'
                  }}>
                    {/* Row 1: Search Input */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      <Search size={16} color="var(--text-muted)" />
                      <input
                        type="text"
                        placeholder="Cari nama, SKU, deskripsi..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setProductPage(1);
                        }}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      />
                      {productSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearch('');
                            setProductPage(1);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    {/* Row 2: Status Tabs + Prominent Filter & Urutkan Button */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.45rem'
                    }}>
                      {/* Status Tabs: Semua / Aktif / Arsip */}
                      <div style={{
                        display: 'inline-flex',
                        padding: '2px',
                        borderRadius: '0.6rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)'
                      }}>
                        {[
                          { key: 'all', label: 'Semua' },
                          { key: 'active', label: 'Aktif' },
                          { key: 'archived', label: 'Arsip' }
                        ].map(st => {
                          const isSelected = productStatusFilter === st.key;
                          return (
                            <button
                              key={st.key}
                              type="button"
                              onClick={() => {
                                setProductStatusFilter(st.key as any);
                                setProductPage(1);
                              }}
                              style={{
                                minHeight: '30px',
                                padding: '0.2rem 0.65rem',
                                borderRadius: '0.45rem',
                                border: 'none',
                                backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '0.74rem',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Filter & Urutkan Button (Always prominent & accessible) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          id="btn-open-product-filter"
                          data-testid="btn-open-product-filter"
                          onClick={() => setIsProductFilterOpen(true)}
                          title="Buka panel filter & urutkan lengkap"
                          style={{
                            minHeight: '34px',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '0.55rem',
                            border: activeFilterCount > 0 ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                            backgroundColor: activeFilterCount > 0 ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                            color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--text-primary)',
                            fontSize: '0.76rem',
                            fontWeight: activeFilterCount > 0 ? 800 : 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                          }}
                        >
                          <SlidersHorizontal size={14} />
                          <span>Filter &amp; Urutkan</span>
                          {activeFilterCount > 0 && (
                            <span style={{
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              borderRadius: '999px',
                              padding: '0 5px',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              lineHeight: '16px'
                            }}>
                              {activeFilterCount}
                            </span>
                          )}
                        </button>

                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={handleResetAllFilters}
                            title="Reset semua filter"
                            aria-label="Reset semua filter"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Horizontal Scrollable Tag/Badge Track (Only if multiple types exist OR categories exist) */}
                    {(isHybridStore || categories.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {/* Tag Mode Switcher: Only displayed when both multiple catalog types exist AND categories exist */}
                        {isHybridStore && categories.length > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 0.15rem',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600 }}>Tampilkan Tag:</span>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setFilterTagMode('types')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.7rem',
                                    fontWeight: effectiveFilterTagMode === 'types' ? 700 : 500,
                                    color: effectiveFilterTagMode === 'types' ? 'var(--primary)' : 'var(--text-muted)',
                                    backgroundColor: effectiveFilterTagMode === 'types' ? 'rgba(30, 58, 138, 0.08)' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                >
                                  <span>Tipe Format</span>
                                  {productTypeFilter !== 'all' && (
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFilterTagMode('categories')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '0.35rem',
                                    fontSize: '0.7rem',
                                    fontWeight: effectiveFilterTagMode === 'categories' ? 700 : 500,
                                    color: effectiveFilterTagMode === 'categories' ? 'var(--primary)' : 'var(--text-muted)',
                                    backgroundColor: effectiveFilterTagMode === 'categories' ? 'rgba(30, 58, 138, 0.08)' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                >
                                  <span>Kategori ({categories.length})</span>
                                  {productCategoryFilter !== 'all' && (
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {effectiveFilterTagMode === 'types' && productTypeFilter !== 'all' && (
                              <button
                                type="button"
                                onClick={() => { setProductTypeFilter('all'); setProductPage(1); }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                Reset Tipe
                              </button>
                            )}
                            {effectiveFilterTagMode === 'categories' && productCategoryFilter !== 'all' && (
                              <button
                                type="button"
                                onClick={() => { setProductCategoryFilter('all'); setProductPage(1); }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                Reset Kategori
                              </button>
                            )}
                          </div>
                        )}

                        {/* Scrollable Badges Track: if not hybrid, always displays categoryTagItems */}
                        <TabletScrollableFilterTags
                          items={effectiveFilterTagMode === 'types' ? catalogTypeTagItems : categoryTagItems}
                          selectedId={effectiveFilterTagMode === 'types' ? productTypeFilter : productCategoryFilter}
                          onSelect={(id) => {
                            if (effectiveFilterTagMode === 'types') {
                              setProductTypeFilter(id);
                            } else {
                              setProductCategoryFilter(id);
                            }
                            setProductPage(1);
                          }}
                          ariaLabel={effectiveFilterTagMode === 'types' ? 'Filter Tipe Format Katalog' : 'Filter Kategori Produk'}
                          containerBg="var(--bg-deep)"
                        />
                      </div>
                    )}

                    {/* Row 4: Active Filter Summary Chips (Visible only when filters active) */}
                    {activeFilterCount > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                        paddingTop: '0.15rem'
                      }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aktif:</span>
                        
                        {productTypeFilter !== 'all' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(30, 58, 138, 0.1)',
                            color: 'var(--primary)',
                            fontSize: '0.68rem',
                            fontWeight: 700
                          }}>
                            <span>{CATALOG_TYPE_OPTIONS.find(t => t.id === productTypeFilter)?.name || productTypeFilter}</span>
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('all'); setProductPage(1); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )}

                        {productCategoryFilter !== 'all' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(30, 58, 138, 0.1)',
                            color: 'var(--primary)',
                            fontSize: '0.68rem',
                            fontWeight: 700
                          }}>
                            <span>{categories.find(c => String(c.id) === productCategoryFilter)?.name || productCategoryFilter}</span>
                            <button
                              type="button"
                              onClick={() => { setProductCategoryFilter('all'); setProductPage(1); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )}

                        {productStockFilter !== 'all' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            color: '#d97706',
                            fontSize: '0.68rem',
                            fontWeight: 700
                          }}>
                            <span>{productStockFilter === 'in_stock' ? 'Tersedia' : productStockFilter === 'low' ? 'Menipis' : 'Habis'}</span>
                            <button
                              type="button"
                              onClick={() => { setProductStockFilter('all'); setProductPage(1); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )}

                        {productSortFilter !== 'newest' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(100, 116, 139, 0.12)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.68rem',
                            fontWeight: 700
                          }}>
                            <span>Urutan: {productSortFilter === 'oldest' ? 'Terlama' : productSortFilter.includes('asc') ? 'A-Z / Rendah' : 'Z-A / Tinggi'}</span>
                            <button
                              type="button"
                              onClick={() => { setProductSortFilter('newest'); setProductPage(1); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={handleResetAllFilters}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '0 0.2rem'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Items List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {loading && products.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Memuat daftar produk...
                    </div>
                  ) : isCatalogCompletelyEmpty ? (
                    /* Clean Empty State aligned with Mobile & Desktop */
                    <div style={{
                      padding: '3rem 1.5rem',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: '260px'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: 'rgba(30, 58, 138, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        color: 'var(--primary)'
                      }}>
                        <Package size={28} />
                      </div>
                      <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Belum Ada Item Terdaftar
                      </h3>
                      <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.4 }}>
                        Mulai tambahkan barang, menu, jasa, atau file digital pertama Anda.
                      </p>
                      <button
                        type="button"
                        id="btn-tambah-item-pertama"
                        data-testid="btn-tambah-item-pertama"
                        onClick={() => handleCancelToProductTypeSelection()}
                        style={{
                          minHeight: '44px',
                          padding: '0.65rem 1.35rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px var(--primary-glow)'
                        }}
                      >
                        <Plus size={16} />
                        <span>Tambah Item Pertama</span>
                      </button>
                    </div>
                  ) : products.length === 0 ? (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <Search size={32} style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', opacity: 0.5 }} />
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Item Tidak Ditemukan</div>
                      <div style={{ fontSize: '0.8rem' }}>Tidak ada item yang sesuai dengan kata kunci atau filter yang Anda pilih.</div>
                      <button
                        type="button"
                        onClick={handleResetAllFilters}
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Filter
                      </button>
                    </div>
                  ) : (
                    products.map(prod => {
                      const isSelected = selectedProductId === prod.id;
                      const isActive = prod.is_active !== false;

                      return (
                        <div
                          key={prod.id}
                          id={`product-item-${prod.id}`}
                          data-testid={`product-item-${prod.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectProduct(prod)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectProduct(prod);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '0.65rem',
                            backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                            marginBottom: '0.45rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '48px',
                            height: '48px',
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
                              <Package size={22} color="var(--text-muted)" />
                            )}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
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
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                color: isActive ? '#10b981' : '#64748b'
                              }}>
                                {isActive ? 'Aktif' : 'Arsip'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>
                                Rp {Number(prod.price || 0).toLocaleString('id-ID')}
                              </div>
                              <div style={{
                                fontSize: '0.74rem',
                                fontWeight: (prod.stock ?? 1) <= 5 ? 700 : 500,
                                color: (prod.stock ?? 1) === 0 ? '#ef4444' : (prod.stock ?? 1) <= 5 ? '#f59e0b' : 'var(--text-muted)'
                              }}>
                                {(prod.stock ?? 1) === 0
                                  ? 'Habis'
                                  : (prod.stock ?? 1) <= 5
                                  ? `Sisa ${prod.stock} ${prod.unit || 'Pcs'}`
                                  : `Stok: ${prod.stock} ${prod.unit || 'Pcs'}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tablet Segmented Pager - Hidden if no items or only 1 page */}
                {!isCatalogCompletelyEmpty && productTotalPages > 1 && products.length > 0 && (
                  <TabletSegmentedPagination
                    currentPage={productPage}
                    totalPages={productTotalPages}
                    totalRecords={productTotalRecords}
                    onPageChange={(p) =>
                      fetchProducts(
                        p,
                        debouncedProductSearch,
                        productStatusFilter,
                        productCategoryFilter,
                        productTypeFilter,
                        productSortFilter,
                        productStockFilter
                      )
                    }
                    isLoading={loading}
                  />
                )}
              </div>
            }
            detailPane={
              (selectedProductId !== null || !isNarrowScreen) ? (() => {
                const activeTypeDef = CATALOG_TYPE_OPTIONS.find(t => t.id === productForm.product_type) || CATALOG_TYPE_OPTIONS[0];
                const ActiveTypeIcon = activeTypeDef.icon;

                const shouldShowStep1 = isSelectingProductType || (selectedProductId === 'new' && !productForm.product_type) || (selectedProductId === null && !isNarrowScreen);

                if (shouldShowStep1) {
                  return (
                    /* =========================================================================
                       STEP 1: PILIH TIPE KATALOG PRODUK (CARD SELECTION GRID)
                       ========================================================================= */
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      padding: '1.25rem 1.5rem',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-deep)',
                      gap: '1rem'
                    }}>
                      {/* Header Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-light)',
                        paddingBottom: '0.85rem'
                      }}>
                        <div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            Pilih Tipe Item Katalog
                          </h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Step 1 dari 2: Tentukan format spesialisasi katalog sebelum mengisi formulir
                          </span>
                        </div>

                        <button
                          type="button"
                          id="btn-batal-pilih-tipe"
                          onClick={() => {
                            if (isNarrowScreen) {
                              setSelectedProductId(null);
                              setIsSelectingProductType(false);
                            } else if (products.length > 0) {
                              handleSelectProduct(products[0]);
                            } else {
                              handleCancelToProductTypeSelection();
                            }
                            try {
                              const url = new URL(window.location.href);
                              url.searchParams.delete('action');
                              url.searchParams.delete('type');
                              url.searchParams.delete('catalog_type');
                              window.history.pushState({}, '', url.toString());
                            } catch {}
                          }}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '999px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Batal
                        </button>
                      </div>

                      {/* Hero Card */}
                      <div style={{
                        padding: '1.15rem',
                        borderRadius: '0.85rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          border: '1px solid rgba(37, 99, 235, 0.25)',
                          color: 'var(--primary)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          marginBottom: '0.45rem'
                        }}>
                          <Sparkles size={12} />
                          <span>Spesialisasi Format Katalog</span>
                        </div>
                        <h2 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                          Mau Menambahkan Item Apa Hari Ini?
                        </h2>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                          Pilih tipe katalog di bawah agar struktur formulir, bidang input, satuan unit, dan atribut spesifik disesuaikan secara otomatis.
                        </p>
                      </div>

                      {/* 7 Cards List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {CATALOG_TYPE_OPTIONS.map((opt) => {
                          const OptIcon = opt.icon;
                          return (
                            <div
                              key={opt.id}
                              id={`catalog-type-${opt.id}`}
                              data-testid={`catalog-type-${opt.id}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectProductType(opt.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSelectProductType(opt.id);
                                }
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = opt.color;
                                e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-light)';
                                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                              style={{
                                padding: '0.95rem 1.15rem',
                                borderRadius: '0.85rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '0.75rem',
                                backgroundColor: opt.bgColor,
                                border: `1px solid ${opt.borderColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: opt.color,
                                flexShrink: 0
                              }}>
                                <OptIcon size={24} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                    {opt.name}
                                  </h4>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.12rem 0.5rem',
                                    borderRadius: '0.4rem',
                                    backgroundColor: opt.bgColor,
                                    color: opt.color,
                                    border: `1px solid ${opt.borderColor}`
                                  }}>
                                    {opt.categoryBadge}
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.35rem 0', lineHeight: 1.35 }}>
                                  {opt.tagline}
                                </p>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                  ⚡ Form: {opt.formHighlights}
                                </div>
                              </div>

                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: opt.bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: opt.color,
                                flexShrink: 0
                              }}>
                                <ChevronRight size={17} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  /* =========================================================================
                     STEP 2: FORMULIR INPUT DATA PRODUK LENGKAP
                     ========================================================================= */
                  <form onSubmit={handleSaveProduct} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    padding: '1.5rem',
                    gap: '1.25rem',
                    overflowY: 'auto'
                  }}>
                    {/* Active Type Banner with Ganti Tipe Button */}
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.85rem',
                      backgroundColor: activeTypeDef.bgColor,
                      border: `1.5px solid ${activeTypeDef.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--bg-card)',
                          border: `1px solid ${activeTypeDef.borderColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: activeTypeDef.color,
                          flexShrink: 0
                        }}>
                          <ActiveTypeIcon size={22} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: activeTypeDef.color }}>
                              Tipe Katalog Aktif
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', backgroundColor: 'var(--bg-card)', border: `1px solid ${activeTypeDef.borderColor}`, color: 'var(--text-secondary)' }}>
                              {activeTypeDef.categoryBadge}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                            {activeTypeDef.name}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        id="btn-ganti-tipe"
                        data-testid="btn-ganti-tipe"
                        onClick={handleBackToTypeSelection}
                        style={{
                          minHeight: '36px',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: 'var(--bg-card)',
                          border: `1px solid ${activeTypeDef.borderColor}`,
                          color: activeTypeDef.color,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                        }}
                        title="Ganti format tipe katalog"
                      >
                        <RefreshCw size={13} />
                        <span>Ganti Tipe</span>
                      </button>
                    </div>

                    {/* Header Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-light)',
                      paddingBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                          {selectedProductId === 'new' ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                          Lengkapi foto, atribut spesifik, serta batas pemesanan produk
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Active Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => setProductForm(p => ({ ...p, is_active: !p.is_active }))}
                          style={{
                            minHeight: '38px',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: productForm.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: productForm.is_active ? '#10b981' : '#ef4444',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer'
                          }}
                        >
                          {productForm.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                          {productForm.is_active ? 'Status: Aktif di Etalase' : 'Status: Diarsipkan'}
                        </button>

                        {selectedProductId !== 'new' && (
                          <button
                            id="btn-hapus-produk"
                            data-testid="btn-hapus-produk"
                            type="button"
                            onClick={() => handleDeleteProduct(Number(selectedProductId))}
                            style={{
                              minHeight: '38px',
                              padding: '0.4rem 0.85rem',
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
                    </div>

                    {/* Basic Information Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Nama Produk *
                        </label>
                        <input
                          type="text"
                          required
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
                          Harga Satuan Dasar (Rp) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
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

                      <div style={{ gridColumn: showCustomClassInput ? '1 / -1' : 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            Kategori {activeTypeDef.name} *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !showCustomClassInput;
                              setShowCustomClassInput(next);
                              if (!next) setCustomClass('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0.2rem 0.4rem',
                              color: 'var(--primary)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {showCustomClassInput ? (
                              <>
                                <RotateCcw size={13} />
                                <span>Pilih dari Daftar</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} strokeWidth={2.5} />
                                <span>Buat Kategori Baru</span>
                              </>
                            )}
                          </button>
                        </div>

                        {showCustomClassInput ? (
                          <div style={{
                            padding: '1rem 1.15rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1.5px solid var(--primary)',
                            boxShadow: '0 4px 14px var(--primary-glow)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                <Tag size={15} color="var(--primary)" />
                                <span>Buat Kategori Kustom Baru ({activeTypeDef.name})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomClassInput(false);
                                  setCustomClass('');
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '0.25rem 0.5rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.76rem',
                                  fontWeight: 600
                                }}
                              >
                                <X size={14} />
                                <span>Batal</span>
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                placeholder={`Ketik nama kategori baru untuk ${activeTypeDef.name}...`}
                                value={customClass}
                                onChange={(e) => {
                                  setCustomClass(e.target.value);
                                  setProductForm(p => ({ ...p, class: e.target.value }));
                                }}
                                autoFocus
                                style={{
                                  flex: '1 1 240px',
                                  minWidth: '200px',
                                  minHeight: '42px',
                                  padding: '0.55rem 0.85rem',
                                  borderRadius: '0.5rem',
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-light)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.88rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (customClass.trim()) {
                                      handleAddMasterOption(customClass.trim(), (productForm.product_type || 'physical') as ItemCategoryType, (val) => {
                                        setProductForm(p => ({ ...p, class: customClass.trim() }));
                                        setCustomClass(val);
                                        setShowCustomClassInput(false);
                                      });
                                    }
                                  }
                                }}
                              />
                              <button
                                type="button"
                                disabled={!customClass.trim() || saving}
                                onClick={async () => {
                                  if (!customClass.trim()) return;
                                  await handleAddMasterOption(customClass.trim(), (productForm.product_type || 'physical') as ItemCategoryType, (val) => {
                                    setProductForm(p => ({ ...p, class: customClass.trim() }));
                                    setCustomClass(val);
                                    setShowCustomClassInput(false);
                                  });
                                }}
                                style={{
                                  flex: '0 0 auto',
                                  minHeight: '42px',
                                  padding: '0 1.25rem',
                                  borderRadius: '0.5rem',
                                  backgroundColor: 'var(--primary)',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  cursor: !customClass.trim() ? 'not-allowed' : 'pointer',
                                  opacity: !customClass.trim() ? 0.6 : 1,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Check size={14} strokeWidth={2.5} />
                                <span>Simpan & Gunakan</span>
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              <Sparkles size={12} color="var(--primary)" />
                              <span>Kategori ini akan otomatis tersimpan ke daftar master toko dan dapat Anda gunakan kembali nanti.</span>
                            </div>
                          </div>
                        ) : (
                          <TabletCustomSelect
                            value={
                              (productForm.class && getCategoryOptionsForType(productForm.product_type).includes(productForm.class))
                                ? productForm.class
                                : getDefaultCategoryForType(productForm.product_type)
                            }
                            onChange={(val) => {
                              if (val === '__ADD_NEW__') {
                                setShowCustomClassInput(true);
                                setCustomClass('');
                              } else {
                                setProductForm(p => ({ ...p, class: val }));
                              }
                            }}
                            options={[
                              ...getCategoryOptionsForType(productForm.product_type).map(catName => {
                                const isDefault = (DEFAULT_MASTER_CATEGORIES[productForm.product_type as ItemCategoryType] || []).includes(catName);
                                return {
                                  value: catName,
                                  label: catName,
                                  badge: isDefault ? 'Standar' : 'Kustom',
                                  badgeBg: isDefault ? 'var(--bg-deep)' : 'rgba(30, 58, 138, 0.12)',
                                  badgeColor: isDefault ? 'var(--text-muted)' : 'var(--primary)'
                                };
                              }),
                              {
                                value: '__ADD_NEW__',
                                label: '+ Buat Kategori Baru (Ketik Sendiri)...',
                                badge: 'Aksi',
                                badgeBg: 'var(--primary-glow)',
                                badgeColor: 'var(--primary)'
                              }
                            ]}
                            placeholder={`Pilih Kategori ${activeTypeDef.name}...`}
                            searchable={true}
                            searchPlaceholder="Cari kategori..."
                            triggerStyle={{ minHeight: '42px', fontSize: '0.88rem' }}
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Format Spesialisasi
                        </label>
                        <div
                          onClick={() => setIsSelectingProductType(true)}
                          style={{
                            width: '100%',
                            minHeight: '42px',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                          title="Klik untuk mengubah tipe katalog"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ActiveTypeIcon size={16} color={activeTypeDef.color} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {activeTypeDef.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: activeTypeDef.color }}>
                            Ubah
                          </span>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Jumlah Stok
                        </label>
                        <input
                          type="number"
                          min="0"
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
                          Satuan Unit
                        </label>
                        <input
                          type="text"
                          value={productForm.unit}
                          onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                          placeholder="Contoh: Pcs, Ekor, Kg, Paket"
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
                          Minimal Pemesanan
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={productForm.min_order}
                          onChange={(e) => setProductForm({ ...productForm, min_order: Number(e.target.value) || 1 })}
                          placeholder="1"
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
                          Maksimal Pemesanan (Opsional)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={productForm.max_order}
                          onChange={(e) => setProductForm({ ...productForm, max_order: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="Tidak dibatasi"
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

                    {/* Shipping toggle */}
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dukungan Pengiriman / Kurir Ekspedisi</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aktifkan jika item dapat dikirim via kurir ekspedisi</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductForm(p => ({ ...p, is_shipping_available: !p.is_shipping_available }))}
                        style={{
                          minHeight: '36px',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: productForm.is_shipping_available ? 'var(--primary)' : 'var(--bg-card)',
                          color: productForm.is_shipping_available ? '#ffffff' : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {productForm.is_shipping_available ? 'Dapat Dikirim' : 'Ambil di Toko / Khusus'}
                      </button>
                    </div>

                    {/* Dynamic Type-Specific Attributes Card */}
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '0.75rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '0.5rem',
                          backgroundColor: activeTypeDef.bgColor,
                          border: `1px solid ${activeTypeDef.borderColor}`,
                          color: activeTypeDef.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <ActiveTypeIcon size={18} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Spesifikasi & Atribut: {activeTypeDef.name}
                          </h4>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {activeTypeDef.formHighlights}
                          </span>
                        </div>
                      </div>

                      {/* 1. BARANG FISIK */}
                      {productForm.product_type === 'physical' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kondisi Barang *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.condition || 'Baru'}
                              onChange={(val) => updateProductAttribute('condition', val)}
                              options={[
                                { value: 'Baru', label: 'Baru (100% Baru & Tersegel)', description: 'Produk dalam kondisi gres 100% baru & tersegel' },
                                { value: 'Bekas', label: 'Bekas / Second (Pre-owned)', description: 'Produk pernah digunakan / pre-owned' },
                                { value: 'Refurbished', label: 'Refurbished (Rekondisi Resmi)', description: 'Produk rekondisi resmi & siap pakai' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Berat Pengiriman (Gram) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={productForm.attributes.weight ?? ''}
                              onChange={(e) => updateProductAttribute('weight', parseInt(e.target.value) || 0)}
                              placeholder="Contoh: 500"
                              required
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Merek / Brand (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.brand || ''}
                              onChange={(e) => updateProductAttribute('brand', e.target.value)}
                              placeholder="Contoh: Nike / Asus / Custom Handmade"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Varian / Ukuran / Warna (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.variant || ''}
                              onChange={(e) => updateProductAttribute('variant', e.target.value)}
                              placeholder="Contoh: S, M, L, XL / Hitam, Putih / 128GB"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Bahan / Material (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.material || ''}
                              onChange={(e) => updateProductAttribute('material', e.target.value)}
                              placeholder="Contoh: Cotton Combed 24s / Aluminium Alloy / Kayu Jati"
                              style={tabletInputStyle}
                            />
                          </div>
                        </div>
                      )}

                      {/* 2. KULINER & F&B */}
                      {productForm.product_type === 'food' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Sertifikasi / Status Halal *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.halal_status || 'Bersertifikat Halal Resmi (BPJPH / MUI)'}
                              onChange={(val) => updateProductAttribute('halal_status', val)}
                              options={[
                                { value: 'Bersertifikat Halal Resmi (BPJPH / MUI)', label: 'Bersertifikat Halal Resmi (BPJPH / MUI)', description: 'Telah terverifikasi & terdaftar resmi di BPJPH/MUI' },
                                { value: 'Halal (Bahan Baku Halal & Thayyib)', label: 'Halal (Bahan Baku Halal & Thayyib)', description: '100% menggunakan bahan baku halal, bebas babi & alkohol' },
                                { value: 'Dalam Proses Sertifikasi Halal', label: 'Dalam Proses Sertifikasi Halal', description: 'Sedang dalam tahap audit / pendaftaran sertifikasi halal' },
                                { value: 'Non-Halal', label: 'Non-Halal', description: 'Mengandung bahan non-halal / khusus non-muslim' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Pilihan Varian / Level Rasa (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.variant || ''}
                              onChange={(e) => updateProductAttribute('variant', e.target.value)}
                              placeholder="Contoh: Pedas Sedang, Level 1-5 / Manis Gurih"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Takaran Porsi / Kemasan (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.portion_size || ''}
                              onChange={(e) => updateProductAttribute('portion_size', e.target.value)}
                              placeholder="Contoh: 1 Porsi (Personal) / 2-3 Orang / 500gr"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Estimasi Waktu Penyajian (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.prep_time || ''}
                              onChange={(e) => updateProductAttribute('prep_time', e.target.value)}
                              placeholder="Contoh: 15-20 Menit / Siap Santap Langsung"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Suhu Penyimpanan
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.storage_temp || 'Suhu Ruang (Kering & Sejuk)'}
                              onChange={(val) => updateProductAttribute('storage_temp', val)}
                              options={[
                                { value: 'Suhu Ruang (Kering & Sejuk)', label: 'Suhu Ruang (Kering & Sejuk)', description: 'Simpan di tempat teduh, sejuk & tidak lembab' },
                                { value: 'Chiller / Lemari Pendingin (2°C - 8°C)', label: 'Chiller / Dingin (2°C - 8°C)', description: 'Simpan di dalam kulkas / chiller pendingin' },
                                { value: 'Freezer / Beku (-18°C)', label: 'Freezer / Beku (-18°C)', description: 'Simpan beku di freezer untuk daya tahan maksimal' },
                                { value: 'Hangat / Siap Santap', label: 'Hangat / Siap Santap Langsung', description: 'Disajikan hangat, konsumsi segera saat tiba' }
                              ]}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Masa Simpan / Daya Tahan
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.expired_info || ''}
                              onChange={(e) => updateProductAttribute('expired_info', e.target.value)}
                              placeholder="Contoh: Hari ini (Fresh Daily) / 3 Hari Kulkas / 3 Bulan Freezer"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Pengiriman & Ketentuan Kemasan (F&B)
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.delivery_condition || 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)'}
                              onChange={(val) => updateProductAttribute('delivery_condition', val)}
                              options={[
                                { value: 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)', label: 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)', description: 'Siap santap / fresh, langsung dikirim dalam hitungan jam' },
                                { value: 'Ekspedisi Cold-Chain / Paxel 1 Hari Sampai (Frozen / Makanan Segar)', label: 'Ekspedisi Cold-Chain / Paxel Next Day (Frozen / Segar)', description: 'Pengiriman berpendingin khusus makanan beku antarkota' },
                                { value: 'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)', label: 'Bisa Kirim se-Indonesia (Ekspedisi Reguler / Kering)', description: 'Aman untuk makanan kering / kemasan tahan lama' },
                                { value: 'Dine-in & Takeaway Only (Makan di Tempat / Bawa Pulang)', label: 'Dine-in & Takeaway Only (No Delivery)', description: 'Hanya melayani makan di tempat atau pesan ambil sendiri' },
                                { value: 'Pre-Order Khusus (Katering / Acara)', label: 'Pre-Order Khusus (Katering / Acara)', description: 'Pemesanan terjadwal H-1 s/d H-3 untuk acara' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* 3. ITEM DIGITAL */}
                      {productForm.product_type === 'digital' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Format Berkas / File *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.file_format || ''}
                              onChange={(e) => updateProductAttribute('file_format', e.target.value)}
                              placeholder="Contoh: PDF / EPUB / ZIP / MP4"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Ukuran Berkas File *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.file_size || ''}
                              onChange={(e) => updateProductAttribute('file_size', e.target.value)}
                              placeholder="Contoh: 15 MB / 1.2 GB"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Tipe Lisensi Digital *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.license_type || 'Lisensi Personal'}
                              onChange={(val) => updateProductAttribute('license_type', val)}
                              options={[
                                { value: 'Lisensi Personal', label: 'Lisensi Personal (Penggunaan Pribadi)', description: 'Hanya untuk pemakaian individu non-komersial' },
                                { value: 'Lisensi Komersial', label: 'Lisensi Komersial (Bisnis & Proyek)', description: 'Boleh digunakan untuk bisnis & proyek berbayar' },
                                { value: 'Extended License', label: 'Extended License / Resale Rights', description: 'Hak cipta diperluas / dapat dijual kembali' },
                                { value: 'Open Source', label: 'Open Source / Bebas', description: 'Bebas digunakan tanpa batasan royalti' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Panduan Pengiriman / Akses File
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.delivery_condition || 'Akses Instan Otomatis (Link Cloud)'}
                              onChange={(val) => updateProductAttribute('delivery_condition', val)}
                              options={[
                                { value: 'Akses Instan Otomatis (Link Cloud)', label: 'Akses Instan Otomatis (Link Cloud)', description: 'Tautan Google Drive / Cloud dikirim otomatis' },
                                { value: 'Kirim via Email Pembeli', label: 'Kirim via Email Pembeli', description: 'File atau link dikirim manual/otomatis ke email' },
                                { value: 'Kirim via WhatsApp Admin', label: 'Kirim via WhatsApp Admin', description: 'Admin mengirimkan file via chat WhatsApp resmi' },
                                { value: 'Akses Member Area', label: 'Akses Member Area / LMS', description: 'Akses login ke portal materi / kelas digital' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* 4. JASA & LAYANAN */}
                      {productForm.product_type === 'service' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Estimasi Durasi Layanan *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.duration || ''}
                              onChange={(e) => updateProductAttribute('duration', e.target.value)}
                              placeholder="Contoh: 1 Jam / 1 Sesi / 3 Hari Kerja"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Metode Pelaksanaan Layanan *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.service_location || 'Datang ke Toko'}
                              onChange={(val) => updateProductAttribute('service_location', val)}
                              options={[
                                { value: 'Datang ke Toko', label: 'Datang ke Lokasi Toko / Workshop', description: 'Klien datang langsung ke studio / outlet workshop' },
                                { value: 'Home Visit (Ke Rumah)', label: 'Panggilan ke Rumah (Home Service)', description: 'Penyedia jasa datang ke lokasi / rumah klien' },
                                { value: 'Online', label: 'Online / Jarak Jauh (Remote)', description: 'Layanan digital via internet, Zoom, Google Meet' },
                                { value: 'Fleksibel', label: 'Fleksibel (Toko / Home Visit)', description: 'Dapat disepakati bersama antara klien & penjual' }
                              ]}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Area Jangkauan Layanan *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.service_area || ''}
                              onChange={(e) => updateProductAttribute('service_area', e.target.value)}
                              placeholder="Contoh: Jabodetabek / Kota Bandung / Seluruh Indonesia"
                              style={tabletInputStyle}
                            />
                          </div>
                        </div>
                      )}

                      {/* 5. TANAMAN & BIBIT */}
                      {productForm.product_type === 'plant' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Nama Ilmiah / Botani (Latin) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                            </label>
                            <input
                              type="text"
                              value={productForm.scientific_name || productForm.attributes.scientific_name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProductForm(p => ({ ...p, scientific_name: v, attributes: { ...(p.attributes || {}), scientific_name: v } }));
                              }}
                              placeholder="Contoh: Monstera deliciosa, Sansevieria trifasciata..."
                              style={{ ...tabletInputStyle, fontStyle: 'italic' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <Sun size={14} style={{ color: '#f59e0b' }} />
                              <span>Kebutuhan Sinar Matahari *</span>
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.sunlight || 'Partial Sun (Teduh Terang)'}
                              onChange={(val) => updateProductAttribute('sunlight', val)}
                              options={[
                                { value: 'Full Sun (Matahari Langsung)', label: 'Full Sun (Matahari Penuh > 6 Jam)', description: 'Butuh 6+ jam sinar matahari langsung per hari' },
                                { value: 'Partial Sun (Teduh Terang)', label: 'Partial Sun (Teduh Terang / Naungan Paranet)', description: 'Cahaya terang tidak langsung / naungan paranet' },
                                { value: 'Low Light / Indoor (Cahaya Rendah)', label: 'Indoor / Low Light (Dalam Ruangan)', description: 'Cocok dalam ruangan dengan pencahayaan minim' },
                                { value: 'Fleksibel (Indoor / Outdoor)', label: 'Fleksibel (Bisa Indoor / Outdoor)', description: 'Bisa beradaptasi di dalam maupun luar ruangan' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <Droplets size={14} style={{ color: '#0ea5e9' }} />
                              <span>Kebutuhan Penyiraman *</span>
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.watering || 'Sedang (2-3 Hari Sekali)'}
                              onChange={(val) => updateProductAttribute('watering', val)}
                              options={[
                                { value: 'Banyak (Setiap Hari)', label: 'Rutin Harian (1-2x Sehari)', description: 'Media harus selalu lembab & rutin disiram' },
                                { value: 'Sedang (2-3 Hari Sekali)', label: 'Sedang (2-3 Hari Sekali / Media Kering)', description: 'Siram saat media tanam mulai agak kering' },
                                { value: 'Sedikit (1-2 Minggu Sekali / Sukulen & Kaktus)', label: 'Minim Air (1-2 Minggu Sekali)', description: 'Tahan kering, sukulen, kaktus, sansevieria' },
                                { value: 'Khusus / Tanaman Air', label: 'Khusus / Hidroponik & Tanaman Air', description: 'Aquascape atau media terendam air' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Rekomendasi Media Tanam *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.planting_medium || ''}
                              onChange={(e) => updateProductAttribute('planting_medium', e.target.value)}
                              placeholder="Contoh: Sekam Bakar, Pasir Malang, Humus"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Ukuran / Estimasi Tinggi Tanaman
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.plant_size || ''}
                              onChange={(e) => updateProductAttribute('plant_size', e.target.value)}
                              placeholder="Contoh: Tinggi 25-35 cm, Pot D15"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <ShieldCheck size={14} style={{ color: '#10b981' }} />
                              <span>Status Perlindungan & Legalitas *</span>
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.protection_status || 'Non-Dilindungi (Aman Diperjualbelikan)'}
                              onChange={(val) => updateProductAttribute('protection_status', val)}
                              options={[
                                { value: 'Non-Dilindungi (Aman Diperjualbelikan)', label: 'Non-Dilindungi (Aman & Bebas Diperjualbelikan)', description: 'Tanaman umum bebas izin diperjualbelikan' },
                                { value: 'Hasil Budidaya Nursery', label: 'Hasil Budidaya Nursery Resmi', description: 'Perbanyakan legal dari kebun/nursery bersertifikat' },
                                { value: 'Dilindungi (Sertifikasi/Izin Khusus)', label: 'Dilindungi / Wajib Izin Khusus (BKSDA / CITES)', description: 'Wajib sertifikasi BKSDA / CITES resmi' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <Package size={14} style={{ color: '#8b5cf6' }} />
                              <span>Kondisi Pengiriman Tanaman *</span>
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.delivery_condition || 'Kirim Bersama Pot & Media Tanam'}
                              onChange={(val) => updateProductAttribute('delivery_condition', val)}
                              options={[
                                { value: 'Kirim Bersama Pot & Media Tanam', label: 'Kirim Bersama Pot & Media Tanam', description: 'Tanaman aman dan siap langsung dipajang' },
                                { value: 'Kirim Bare Root (Kurangi Media)', label: 'Kirim Bare Root (Kurangi Media - Hemat Ongkir)', description: 'Akar dibungkus cocopeat lembab rapi' },
                                { value: 'Khusus Kurir Instan / Sameday', label: 'Khusus Kurir Instan / Sameday (Siap Pajang)', description: 'Siap pajang, tanpa risiko layu di perjalanan' },
                                { value: 'Bisa Kirim se-Indonesia', label: 'Bisa Kirim se-Indonesia (Packing Paralon/Kardus)', description: 'Packing paralon kuat aman antar kota & pulau' }
                              ]}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Status Ketersediaan Tanaman *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.conservation_status || 'Ready Stock'}
                              onChange={(val) => {
                                updateProductAttribute('conservation_status', val);
                                setProductForm(p => ({ ...p, conservation_status: val }));
                              }}
                              options={[
                                { value: 'Ready Stock', label: 'Ready Stock (Tersedia)', description: 'Tanaman siap kirim segera dari kebun/nursery' },
                                { value: 'Pre-Order', label: 'Pre-Order (PO / Inden)', description: 'Pemesanan terlebih dahulu / bibit dalam tahap rawatan' },
                                { value: 'Koleksi / Display', label: 'Koleksi / Display Only', description: 'Hanya pajangan showcase, hubungi penjual via WA' },
                                { value: 'Habis Terjual', label: 'Habis Terjual (Sold Out)', description: 'Stok tanaman saat ini sedang kosong' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* 6. SATWA PELIHARAAN */}
                      {productForm.product_type === 'fauna' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Nama Ilmiah / Taksonomi (Latin) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                            </label>
                            <input
                              type="text"
                              value={productForm.scientific_name || productForm.attributes.scientific_name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProductForm(p => ({ ...p, scientific_name: v, attributes: { ...(p.attributes || {}), scientific_name: v } }));
                              }}
                              placeholder="Contoh: Scleropages formosus, Felis catus..."
                              style={{ ...tabletInputStyle, fontStyle: 'italic' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Habitat Asli *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.habitat || ''}
                              onChange={(e) => updateProductAttribute('habitat', e.target.value)}
                              placeholder="Contoh: Air Tawar / Air Laut / Darat"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Makanan / Diet *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.diet || ''}
                              onChange={(e) => updateProductAttribute('diet', e.target.value)}
                              placeholder="Contoh: Pelet / Jangkrik / Karnivora"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Asal Wilayah Persebaran
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.native_region || ''}
                              onChange={(e) => updateProductAttribute('native_region', e.target.value)}
                              placeholder="Contoh: Kalimantan Barat / Amerika Selatan"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Estimasi Usia / Masa Hidup
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.lifespan || ''}
                              onChange={(e) => updateProductAttribute('lifespan', e.target.value)}
                              placeholder="Contoh: 2 Bulan / 10-15 tahun"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Ukuran / Bobot Satwa
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.weight || ''}
                              onChange={(e) => updateProductAttribute('weight', e.target.value)}
                              placeholder="Contoh: Size 15 cm / 500 gram / 1 kg"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kondisi Pengiriman & Garansi
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.delivery_condition || 'Bisa Kirim se-Indonesia (Legal & Berizin)'}
                              onChange={(val) => updateProductAttribute('delivery_condition', val)}
                              options={[
                                { value: 'Bisa Kirim se-Indonesia (Legal & Berizin)', label: 'Bisa Kirim se-Indonesia (Legal & Berizin)', description: 'Pengiriman legal & resmi dengan dokumen perjalanan' },
                                { value: 'Khusus Pulau Jawa / Jalur Kereta', label: 'Khusus Pulau Jawa / Jalur Kereta', description: 'Ekspedisi Kereta Api Express (KIB/Herona) sehari sampai' },
                                { value: 'Ambil Sendiri di Toko (Pickup Only)', label: 'Ambil Sendiri di Toko (Pickup Only)', description: 'Hanya melayani serah terima langsung di workshop' },
                                { value: 'Kurir Instan Hewan (Gojek/Grab)', label: 'Kurir Instan Hewan (Gojek/Grab)', description: 'Kirim cepat hari ini area satu kota' }
                              ]}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Status Ketersediaan *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.conservation_status || 'Tersedia'}
                              onChange={(val) => {
                                updateProductAttribute('conservation_status', val);
                                setProductForm(p => ({ ...p, conservation_status: val }));
                              }}
                              options={[
                                { value: 'Tersedia', label: 'Tersedia (Ready Stock / Siap Adopsi)', description: 'Satwa siap dikirim / diadopsi segera' },
                                { value: 'Pre-Order', label: 'Pre-Order (PO / Inden Khusus)', description: 'Pemesanan terlebih dahulu / inden khusus' },
                                { value: 'Koleksi / Display', label: 'Koleksi / Display Showcase (Tanya Penjual)', description: 'Hanya pajangan showcase, hubungi penjual via WA' },
                                { value: 'Habis Terjual', label: 'Habis Terjual (Sold Out)', description: 'Stok satwa saat ini sedang kosong / telah diadopsi' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* 7. PROPERTI & REAL ESTATE */}
                      {productForm.product_type === 'property' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Tipe Transaksi *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.transaction_type || 'Dijual'}
                              onChange={(val) => updateProductAttribute('transaction_type', val)}
                              options={[
                                { value: 'Dijual', label: 'Dijual (Jual Putus / Kepemilikan Penuh)', description: 'Pengalihan hak milik properti secara penuh' },
                                { value: 'Disewakan (Tahunan)', label: 'Disewakan (Tahunan)', description: 'Sewa kontrak dengan termin per tahun' },
                                { value: 'Disewakan (Bulanan)', label: 'Disewakan (Bulanan)', description: 'Sewa fleksibel dengan pembayaran per bulan' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Legalitas / Sertifikat *
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.certificate || 'SHM (Sertifikat Hak Milik)'}
                              onChange={(val) => updateProductAttribute('certificate', val)}
                              options={[
                                { value: 'SHM (Sertifikat Hak Milik)', label: 'SHM (Sertifikat Hak Milik)', description: 'Tingkat kepemilikan terkuat & tertinggi' },
                                { value: 'HGB (Hak Guna Bangunan)', label: 'HGB (Hak Guna Bangunan)', description: 'Hak mendirikan bangunan di atas tanah negara/pihak lain' },
                                { value: 'Strata Title / SHMRS', label: 'Strata Title / SHMRS (Apartemen)', description: 'Kepemilikan unit apartemen / kondominium' },
                                { value: 'AJB (Akta Jual Beli)', label: 'AJB (Akta Jual Beli)', description: 'Bukti sah transaksi di hadapan PPAT' },
                                { value: 'Girik / Letter C', label: 'Girik / Letter C', description: 'Surat keterangan tanah adat / warisan' },
                                { value: 'Lainnya', label: 'Lainnya / PPJB', description: 'Status legalitas atau perjanjian pengikatan jual beli' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Luas Tanah (m²) *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.land_area || ''}
                              onChange={(e) => updateProductAttribute('land_area', e.target.value)}
                              placeholder="Contoh: 120"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Luas Bangunan (m²)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.building_area || ''}
                              onChange={(e) => updateProductAttribute('building_area', e.target.value)}
                              placeholder="Contoh: 90 (0 jika tanah kavling)"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kamar Tidur (KT)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={productForm.attributes.bedrooms ?? ''}
                              onChange={(e) => updateProductAttribute('bedrooms', parseInt(e.target.value) || 0)}
                              placeholder="Contoh: 3"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kamar Mandi (KM)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={productForm.attributes.bathrooms ?? ''}
                              onChange={(e) => updateProductAttribute('bathrooms', parseInt(e.target.value) || 0)}
                              placeholder="Contoh: 2"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Jumlah Lantai
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.floors || ''}
                              onChange={(e) => updateProductAttribute('floors', e.target.value)}
                              placeholder="Contoh: 2 Lantai"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kapasitas Carport
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.carport || ''}
                              onChange={(e) => updateProductAttribute('carport', e.target.value)}
                              placeholder="Contoh: 2 Mobil"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Daya Listrik
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.electricity || ''}
                              onChange={(e) => updateProductAttribute('electricity', e.target.value)}
                              placeholder="Contoh: 2200 VA"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Sumber Air
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.water_source || ''}
                              onChange={(e) => updateProductAttribute('water_source', e.target.value)}
                              placeholder="Contoh: PDAM / Sumur Bor"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kondisi Perabotan
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.furnishing || 'Semi-Furnished'}
                              onChange={(val) => updateProductAttribute('furnishing', val)}
                              options={[
                                { value: 'Unfurnished (Kosong)', label: 'Unfurnished (Kosong)', description: 'Unit kosong siap diisi perabot sendiri' },
                                { value: 'Semi-Furnished', label: 'Semi-Furnished', description: 'Sudah ada beberapa perabot utama (AC, Kitchen Set)' },
                                { value: 'Fully Furnished (Lengkap)', label: 'Fully Furnished (Lengkap Siap Huni)', description: 'Unit lengkap siap huni / tinggal bawa koper' }
                              ]}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Arah Hadap Bangunan
                            </label>
                            <TabletCustomSelect
                              value={productForm.attributes.facing || 'Timur'}
                              onChange={(val) => updateProductAttribute('facing', val)}
                              options={[
                                { value: 'Utara', label: 'Utara' },
                                { value: 'Selatan', label: 'Selatan' },
                                { value: 'Timur', label: 'Timur (Matahari Pagi)' },
                                { value: 'Barat', label: 'Barat' },
                                { value: 'Timur Laut', label: 'Timur Laut' },
                                { value: 'Tenggara', label: 'Tenggara' },
                                { value: 'Barat Daya', label: 'Barat Daya' },
                                { value: 'Barat Laut', label: 'Barat Laut' },
                                { value: 'Bebas / Fleksibel', label: 'Bebas / Fleksibel' }
                              ]}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Fasilitas Tambahan & Cluster (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.facilities || ''}
                              onChange={(e) => updateProductAttribute('facilities', e.target.value)}
                              placeholder="Contoh: One Gate System, Keamanan 24 Jam, Kolam Renang, Akses Jalan 2 Mobil"
                              style={tabletInputStyle}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Lokasi / Wilayah Properti *
                            </label>
                            <input
                              type="text"
                              required
                              value={productForm.attributes.property_location || ''}
                              onChange={(e) => updateProductAttribute('property_location', e.target.value)}
                              placeholder="Contoh: BSD City, Serpong, Tangerang Selatan"
                              style={tabletInputStyle}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Primary Photo with Direct Upload */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Foto Utama Produk
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <div style={{
                        width: '90px',
                        height: '90px',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {productForm.image_url ? (
                          <img src={productForm.image_url} alt="Foto Utama" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <ImageIcon size={32} color="var(--text-muted)" />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={productForm.image_url}
                          onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                          placeholder="https://domain.com/foto-produk.jpg"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none'
                          }}
                        />

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            ref={mainImageInputRef}
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleUploadImage(file, 'products');
                                if (url) setProductForm(p => ({ ...p, image_url: url }));
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => mainImageInputRef.current?.click()}
                            style={{
                              minHeight: '40px',
                              padding: '0.5rem 1rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Upload size={15} />
                            Unggah Foto Tablet
                          </button>
                          {productForm.image_url && (
                            <button
                              type="button"
                              onClick={() => setProductForm(p => ({ ...p, image_url: '' }))}
                              style={{
                                minHeight: '40px',
                                padding: '0.5rem 0.85rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-light)',
                                color: '#ef4444',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Hapus Foto
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multiple Gallery Images */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Foto Tambahan Galeri (Maksimal 5)</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tambahkan sudut pandang lain dari produk Anda</div>
                      </div>

                      {productForm.gallery_images.length < 5 && (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            ref={galleryImageInputRef}
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleUploadImage(file, 'products');
                                if (url) handleAddGalleryImage(url);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => galleryImageInputRef.current?.click()}
                            style={{
                              minHeight: '38px',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={15} />
                            Tambah Foto Galeri
                          </button>
                        </div>
                      )}
                    </div>

                    {productForm.gallery_images.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Belum ada foto galeri tambahan.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {productForm.gallery_images.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: '74px',
                              height: '74px',
                              borderRadius: '0.5rem',
                              overflow: 'hidden',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            <img src={imgUrl} alt={`Galeri ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryImage(idx)}
                              style={{
                                position: 'absolute',
                                top: '3px',
                                right: '3px',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0,0,0,0.65)',
                                color: '#ffffff',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product Variants Manager */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Variasi Produk (Ukuran, Rasa, Warna, SKU)</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atur harga dan stok spesifik untuk masing-masing varian</div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddVariant}
                        style={{
                          minHeight: '38px',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={15} />
                        Tambah Varian
                      </button>
                    </div>

                    {productForm.variants.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Item tunggal standar tanpa variasi. Klik "Tambah Varian" bila produk memiliki ragam opsi.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {productForm.variants.map((v, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 40px',
                              gap: '0.6rem',
                              alignItems: 'center',
                              padding: '0.65rem',
                              borderRadius: '0.5rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Nama Varian (misal: Size L)"
                              value={v.variant_name}
                              onChange={(e) => handleUpdateVariant(idx, 'variant_name', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '0.35rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="SKU (Opsional)"
                              value={v.sku}
                              onChange={(e) => handleUpdateVariant(idx, 'sku', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '0.35rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                            <input
                              type="number"
                              placeholder="Harga Khusus (Rp)"
                              value={v.price_override ?? ''}
                              onChange={(e) => handleUpdateVariant(idx, 'price_override', e.target.value === '' ? undefined : Number(e.target.value))}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '0.35rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                            <input
                              type="number"
                              placeholder="Stok"
                              value={v.stock_qty}
                              onChange={(e) => handleUpdateVariant(idx, 'stock_qty', Number(e.target.value))}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '0.35rem',
                                border: '1px solid var(--border-light)',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(idx)}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '0.35rem',
                                border: 'none',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Video & Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Tautan Video Promosi (YouTube / TikTok)
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

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <RichTextarea
                      label="Deskripsi & Spesifikasi Produk"
                      value={productForm.description}
                      onChange={(val) => setProductForm((prev) => ({ ...prev, description: val }))}
                      placeholder="Jelaskan secara detail keunggulan, material, spesifikasi, dan kelengkapan produk..."
                      rows={5}
                      minHeight="140px"
                      showZenFullscreen={true}
                    />
                  </div>

                  {/* Submit Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    <button
                      type="button"
                      id="btn-batal-form-produk"
                      data-testid="btn-batal-form-produk"
                      onClick={() => {
                        handleCancelToProductTypeSelection();
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-light)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer'
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      id="btn-simpan-produk"
                      data-testid="btn-simpan-produk"
                      disabled={saving}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.75rem',
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
              );
            })() : null}
          />
          )
        )}

        {/* ===================================================================
            TAB 2: KATEGORI ETALASE (Two-Tier Master Data Hub - Master-Detail Split View)
            =================================================================== */}
        {activeTab === 'categories' && (() => {
          const activeTypeDef = MASTER_CATEGORY_DEFINITIONS.find(t => t.id === masterCategoryContextTab) || MASTER_CATEGORY_DEFINITIONS[0];
          const ActiveTypeIcon = activeTypeDef.icon;
          const activeCategories = getCategoryOptionsForType(masterCategoryContextTab);
          const defaultList = DEFAULT_MASTER_CATEGORIES[masterCategoryContextTab] || [];
          const systemCategories = activeCategories.filter(c => defaultList.includes(c));
          const customCategories = activeCategories.filter(c => !defaultList.includes(c));

          return (
            <TabletMasterDetailView
              title="Master Kategori Etalase"
              subtitle="Kelola taksonomi kategori etalase per format spesialisasi katalog"
              selectedId={masterCategoryContextTab}
              onClearSelection={() => {}}
              masterPane={
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', overflowY: 'auto' }}>
                  <div style={{ padding: '0.25rem 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Pilih Tipe Katalog
                  </div>
                  {MASTER_CATEGORY_DEFINITIONS.map(tab => {
                    const isSelected = masterCategoryContextTab === tab.id;
                    const TabIcon = tab.icon;
                    const opts = getCategoryOptionsForType(tab.id);
                    const defaults = DEFAULT_MASTER_CATEGORIES[tab.id] || [];
                    const customCount = opts.filter(c => !defaults.includes(c)).length;

                    return (
                      <div
                        key={tab.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setMasterCategoryContextTab(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setMasterCategoryContextTab(tab.id);
                          }
                        }}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isSelected ? `${tab.color}15` : 'var(--bg-card)',
                          border: isSelected ? `1.5px solid ${tab.color}` : '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '0.5rem',
                            backgroundColor: `${tab.color}20`,
                            color: tab.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <TabIcon size={19} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {tab.label}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {opts.length} Kategori
                            </div>
                          </div>
                        </div>

                        {customCount > 0 && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981'
                          }}>
                            +{customCount} Kustom
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              }
              detailPane={
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                  {/* Context Header Card */}
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '0.85rem',
                    backgroundColor: `${activeTypeDef.color}10`,
                    border: `1px solid ${activeTypeDef.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '0.75rem',
                        backgroundColor: `${activeTypeDef.color}25`,
                        color: activeTypeDef.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <ActiveTypeIcon size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {activeTypeDef.label}
                        </h3>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {activeTypeDef.desc}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-light)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <Lock size={12} strokeWidth={2.2} /> {systemCategories.length} Standar
                      </span>
                      {customCategories.length > 0 && (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          +{customCategories.length} Kustom
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff'
                      }}>
                        Total {activeCategories.length} Kategori
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Kategori Standar Sistem */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Lock size={14} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                          Kategori Standar Sistem
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                          {systemCategories.length}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Standar bawaan ekosistem (terkunci demi konsistensi etalase)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                      {systemCategories.map(c => {
                        const count = products.filter(p => (p.product_type || 'physical') === masterCategoryContextTab && p.class === c).length;
                        return (
                          <div
                            key={c}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.55rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.84rem',
                              color: 'var(--text-primary)'
                            }}
                            title="Kategori bawaan standar sistem yang terkunci"
                          >
                            <Lock size={12} strokeWidth={2.2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{c}</span>
                            {count > 0 && (
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: 'var(--bg-deep)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-light)'
                              }}>
                                {count} item
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Kategori Kustom Anda */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: customCategories.length > 0 ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-deep)',
                    border: customCategories.length > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Tag size={15} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>
                          Kategori Kustom Anda
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                          {customCategories.length}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Dapat diubah nama atau dihapus kapan saja
                      </span>
                    </div>

                    {customCategories.length === 0 ? (
                      <div style={{
                        padding: '1rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px dashed var(--border-light)',
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <Tag size={15} style={{ opacity: 0.5 }} />
                        <span>Belum ada kategori kustom untuk <strong>{activeTypeDef.label}</strong>. Tambahkan melalui kolom di bawah.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                        {customCategories.map(c => {
                          const count = products.filter(p => (p.product_type || 'physical') === masterCategoryContextTab && p.class === c).length;
                          return (
                            <div
                              key={c}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.4rem 0.55rem 0.4rem 0.85rem',
                                borderRadius: '0.55rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontSize: '0.84rem',
                                color: 'var(--text-primary)'
                              }}
                            >
                              <Tag size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 600 }}>{c}</span>
                              {count > 0 && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '999px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981'
                                }}>
                                  {count} item
                                </span>
                              )}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.35rem', paddingLeft: '0.4rem', borderLeft: '1px solid var(--border-light)' }}>
                                <button
                                  type="button"
                                  onClick={() => setRenameMasterModalData({
                                    field: 'class',
                                    fieldLabel: `Kategori (${activeTypeDef.label})`,
                                    oldValue: c,
                                    newValue: c,
                                    productType: masterCategoryContextTab
                                  })}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-light)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                  title={`Ubah nama kategori "${c}"`}
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteMasterOption(c, masterCategoryContextTab)}
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                  title={`Hapus kategori "${c}"`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Add Custom Category Form */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Tambah Kategori Kustom Baru ({activeTypeDef.label})
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          placeholder={`Ketik nama kategori baru untuk ${activeTypeDef.label}... (tekan Enter untuk menyimpan)`}
                          value={newCustomCategoryInput}
                          onChange={(e) => setNewCustomCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddMasterOption(newCustomCategoryInput, masterCategoryContextTab, setNewCustomCategoryInput);
                            }
                          }}
                          style={{
                            width: '100%',
                            minHeight: '42px',
                            padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                            borderRadius: '0.55rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            outline: 'none'
                          }}
                        />
                        <Plus size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      </div>
                      <button
                        type="button"
                        disabled={saving || !newCustomCategoryInput.trim()}
                        onClick={() => handleAddMasterOption(newCustomCategoryInput, masterCategoryContextTab, setNewCustomCategoryInput)}
                        style={{
                          minHeight: '42px',
                          padding: '0 1.25rem',
                          borderRadius: '0.55rem',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: saving || !newCustomCategoryInput.trim() ? 'not-allowed' : 'pointer',
                          opacity: saving || !newCustomCategoryInput.trim() ? 0.6 : 1,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Plus size={16} />
                        <span>Tambah Kategori</span>
                      </button>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sparkles size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span>Kategori yang Anda tambahkan di sini akan langsung tersedia di formulir input produk <strong>{activeTypeDef.label}</strong>.</span>
                    </div>
                  </div>
                </div>
              }
            />
          );
        })()}

        {/* ===================================================================
            TAB 3: STATISTIK & TRAFIK BISNIS
            =================================================================== */}
        {/* ===================================================================
            TAB 3: STATISTIK & TRAFIK BISNIS
            =================================================================== */}
        {activeTab === 'analytics' && (
          <TabletAnalyticsView
            token={token}
            storeSlug={storeSlug}
            showToast={showToast}
            onLogout={onLogout}
            onUnauthorized={onUnauthorized}
          />
        )}

        {/* ===================================================================
            TAB 4: PAKET & KUOTA (Subscription)
            =================================================================== */}
        {activeTab === 'subscription' && (
          <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', height: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                  Paket Berlangganan & Kuota Toko
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pantau penggunaan kuota produk dan kapasitas penyimpanan media katalog Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchQuota();
                  fetchSubscriptionOrders();
                  showToast('Data kuota diperbarui');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} />
                Segarkan
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
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
                      backgroundColor: quota?.is_in_grace_period ? 'rgba(239, 68, 68, 0.12)' : 'rgba(30, 58, 138, 0.12)',
                      color: quota?.is_in_grace_period ? '#ef4444' : 'var(--primary)',
                      border: '1px solid var(--border-light)'
                    }}>
                      {quota?.is_in_grace_period ? 'MASA TENGGANG' : 'PAKET AKTIF'}
                    </span>
                    <Crown size={20} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    {quota?.plan?.name || 'Gratis Terbatas (Free Tier)'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    {quota?.plan?.description || 'Katalog digital esensial untuk memulai usaha dan membagikan produk Anda ke pelanggan.'}
                  </p>
                  {quota?.days_remaining !== undefined && quota.days_remaining > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: quota.days_remaining <= 7 ? '#ef4444' : 'var(--text-secondary)' }}>
                      Masa aktif tersisa: <strong>{quota.days_remaining} hari</strong>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsSubModalOpen(true)}
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
                    Pilih Paket & Upgrade Berlangganan
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
                    <span style={{ fontWeight: 700 }}>
                      {quota?.active_items_count ?? productTotalRecords} / {quota?.max_items ?? 15} Item
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, quota?.items_usage_percent ?? Math.round((productTotalRecords / 15) * 100))}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Penyimpanan Media Cloud</span>
                    <span style={{ fontWeight: 700 }}>
                      {formatBytes(quota?.storage_used_bytes || 0)} / {formatBytes(quota?.storage_limit_bytes || 104857600)}
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, quota?.storage_usage_percent ?? 0)}%`,
                      backgroundColor: '#38bdf8',
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Kategori Aktif</span>
                    <span style={{ fontWeight: 700 }}>{categories.length} Kategori</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, categories.length * 10)}%`, backgroundColor: '#a855f7', borderRadius: '999px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Features Checklist */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                Fitur & Layanan Aktif Pada Toko Anda
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', fontSize: '0.88rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color={quota?.plan?.has_custom_domain ? 'var(--primary)' : 'var(--text-muted)'} />
                  <span>Custom Domain: {quota?.plan?.has_custom_domain ? (storeSettings.custom_domain || 'Tersedia') : 'Paket Pro / Enterprise'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={18} color={quota?.plan?.has_priority_support ? 'var(--primary)' : 'var(--text-muted)'} />
                  <span>Dukungan CS: {quota?.plan?.has_priority_support ? 'Jalur Prioritas' : 'Dukungan Reguler'}</span>
                </div>
              </div>
            </div>

            {/* Riwayat Tagihan / Orders */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} color="var(--primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    Riwayat Tagihan & Transaksi Berlangganan
                  </h4>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {subscriptionOrders.length} transaksi tercatat
                </span>
              </div>

              {subscriptionOrders.length === 0 ? (
                <div style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-deep)',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--border-light)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}>
                  Belum ada riwayat pesanan paket berlangganan. Silakan pilih paket untuk upgrade kapasitas toko Anda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {subscriptionOrders.map(order => {
                    const statusBg = order.status === 'paid' ? 'rgba(16, 185, 129, 0.12)' : order.status === 'pending' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(100, 116, 139, 0.12)';
                    const statusColor = order.status === 'paid' ? '#10b981' : order.status === 'pending' ? '#f59e0b' : '#64748b';
                    const statusLabel = order.status === 'paid' ? 'Lunas' : order.status === 'pending' ? 'Menunggu Pembayaran' : order.status || 'Selesai';
                    return (
                      <div
                        key={order.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.85rem 1rem',
                          borderRadius: '0.65rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <CreditCard size={18} color="var(--primary)" />
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                              {order.plan_name || order.Plan?.name || 'Paket Berlangganan'} &bull; {order.billing_cycle === 'annual' ? 'Tahunan (Hemat 20%)' : 'Bulanan'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              #{order.order_number || order.id} &bull; {order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Rp {Number(order.total_amount || order.amount || 0).toLocaleString('id-ID')}
                          </div>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            backgroundColor: statusBg,
                            color: statusColor,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            marginTop: '0.2rem'
                          }}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tablet Subscription Modal Mount */}
            <TabletSubscriptionModal
              isOpen={isSubModalOpen}
              onClose={() => setIsSubModalOpen(false)}
              token={token}
              storeSlug={storeSlug}
              currentQuota={quota}
              onSuccessUpgrade={() => {
                fetchQuota();
                fetchSubscriptionOrders();
              }}
              showToast={showToast}
              onLogout={onLogout}
              onUnauthorized={onUnauthorized}
            />
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
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', overflowX: 'auto' }}>
              {[
                { key: 'general', label: 'Umum & Tema' },
                { key: 'contact', label: 'Kontak & Medsos' },
                { key: 'about', label: 'Tentang & Jam Buka' },
                { key: 'domain', label: 'Custom Domain' },
                { key: 'danger', label: 'Cadangan & Data' }
              ].map(st => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSettingsTab(st.key as any)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid',
                    borderColor: settingsTab === st.key ? 'var(--primary)' : 'var(--border-light)',
                    backgroundColor: settingsTab === st.key ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                    color: settingsTab === st.key ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Hidden file inputs for Branding Uploads */}
            <input
              type="file"
              ref={logoInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = await handleUploadImage(file, 'branding');
                  if (url) {
                    setStoreSettings(prev => ({ ...prev, logo_url: url }));
                  }
                }
              }}
            />
            <input
              type="file"
              ref={bannerInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = await handleUploadImage(file, 'branding');
                  if (url) {
                    setStoreSettings(prev => ({ ...prev, banner_url: url }));
                  }
                }
              }}
            />

            {settingsTab === 'domain' ? (
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1.75rem',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    Hubungkan Domain Sendiri (Custom Domain)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    Arahkan nama domain pribadi Anda (misal: <code>katalog.tokosaya.com</code>) langsung ke etalase digital Catavor.
                  </p>
                </div>

                {quota && !quota.plan?.has_custom_domain && (
                  <div style={{
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <AlertCircle size={22} color="#f59e0b" />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        Fitur <strong>Custom Domain</strong> membutuhkan paket <strong>Pro</strong> atau <strong>Enterprise</strong>.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSubModalOpen(true)}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#f59e0b',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Upgrade Paket
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveCustomDomain} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Nama Domain Kustom
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        type="text"
                        value={storeSettings.custom_domain}
                        onChange={(e) => setStoreSettings({ ...storeSettings, custom_domain: e.target.value })}
                        placeholder="contoh: katalog.namabrand.com"
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          minHeight: '44px',
                          padding: '0.65rem 1.25rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <Globe size={16} />
                        Simpan Domain
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                      Panduan Konfigurasi DNS di Registrar Domain Anda
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.75rem 0' }}>
                      Buka panel DNS (Cloudflare, Niagahoster, Domainesia, dsb.) dan tambahkan DNS Record berikut:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                      <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>TIPE RECORD</div>
                        <div style={{ fontWeight: 800 }}>CNAME</div>
                      </div>
                      <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>NAMA / HOST</div>
                        <div style={{ fontWeight: 800 }}>katalog (atau subdomain Anda)</div>
                      </div>
                      <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>TARGET / NILAI</div>
                        <div style={{ fontWeight: 800 }}>cname.catavor.com</div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            ) : settingsTab === 'danger' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Backup & Export Card */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '1.75rem',
                  borderRadius: '1rem',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                        Cadangkan Seluruh Data Katalog (JSON)
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, maxWidth: '580px', lineHeight: 1.45 }}>
                        Unduh salinan arsip lengkap profil toko, daftar seluruh produk, varian harga, kategori, dan kontak resmi dalam satu berkas terstruktur.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportCatalogJSON}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <HardDrive size={16} color="var(--primary)" />
                      Unduh Backup JSON
                    </button>
                  </div>
                </div>

                {/* Status Operasional */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '1.75rem',
                  borderRadius: '1rem',
                  border: '1px solid var(--border-light)'
                }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                    Status Visibilitas Toko
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                    Katalog Anda saat ini berstatus <strong>{storeSettings.is_paused ? 'Ditangguhkan' : 'Publik & Aktif'}</strong> dan dapat diakses publik di alamat <code>/{storeSlug}</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => onViewPublicCatalog()}
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(30, 58, 138, 0.1)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={15} />
                    Buka Etalase Publik
                  </button>
                </div>
              </div>
            ) : (
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
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

                      {/* LOGO FIELD WITH UPLOAD BUTTON */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Logo Toko
                          </label>
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'rgba(30, 58, 138, 0.1)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <Upload size={13} />
                            Unggah Foto Logo
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                          {storeSettings.logo_url && (
                            <img
                              src={storeSettings.logo_url}
                              alt="Logo Preview"
                              style={{ width: '40px', height: '40px', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                            />
                          )}
                          <input
                            type="text"
                            value={storeSettings.logo_url}
                            onChange={(e) => setStoreSettings({ ...storeSettings, logo_url: e.target.value })}
                            placeholder="https://... atau unggah foto"
                            style={{
                              flex: 1,
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

                      {/* BANNER FIELD WITH UPLOAD BUTTON */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Banner Sampul Toko
                          </label>
                          <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '0.4rem',
                              backgroundColor: 'rgba(30, 58, 138, 0.1)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <Upload size={13} />
                            Unggah Foto Sampul
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                          {storeSettings.banner_url && (
                            <img
                              src={storeSettings.banner_url}
                              alt="Banner Preview"
                              style={{ width: '64px', height: '40px', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                            />
                          )}
                          <input
                            type="text"
                            value={storeSettings.banner_url}
                            onChange={(e) => setStoreSettings({ ...storeSettings, banner_url: e.target.value })}
                            placeholder="https://... atau unggah foto"
                            style={{
                              flex: 1,
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                        Nomor WhatsApp Resmi Pemesanan *
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Username Instagram Toko
                        </label>
                        <input
                          type="text"
                          value={storeSettings.instagram}
                          onChange={(e) => setStoreSettings({ ...storeSettings, instagram: e.target.value })}
                          placeholder="@nama_toko"
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
                          Tautan Website Resmi (Opsional)
                        </label>
                        <input
                          type="text"
                          value={storeSettings.official_website}
                          onChange={(e) => setStoreSettings({ ...storeSettings, official_website: e.target.value })}
                          placeholder="https://brandanda.com"
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
                  </div>
                )}

                {settingsTab === 'about' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
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

                      <div style={{ paddingTop: '1.4rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={storeSettings.show_hours}
                            onChange={(e) => setStoreSettings({ ...storeSettings, show_hours: e.target.checked })}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                          />
                          Tampilkan Jam di Katalog
                        </label>
                      </div>
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
            )}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
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
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Status Keamanan</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      backgroundColor: hasCustomPassword ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                      color: hasCustomPassword ? '#10b981' : '#2563eb',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginTop: '0.2rem'
                    }}>
                      <ShieldCheck size={13} />
                      {hasCustomPassword ? 'Kata Sandi Kustom Aktif' : 'Google SSO (Kata Sandi Manual Belum Disetel)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Form Card (Dual-Mode: SSO Backup vs Standard Update) */}
              <form onSubmit={handleChangePassword} style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {hasCustomPassword ? (
                      <Lock size={18} style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Key size={18} style={{ color: '#2563eb' }} />
                    )}
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      {hasCustomPassword ? 'Ubah Kata Sandi Akun' : 'Kata Sandi Cadangan (Opsional)'}
                    </h3>
                  </div>
                  {!hasCustomPassword && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563eb',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}>
                      <ShieldCheck size={12} />
                      Google SSO
                    </span>
                  )}
                </div>

                {!hasCustomPassword ? (
                  <div style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}>
                    <ShieldAlert size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      Akun Anda terhubung dengan Google SSO. Anda dapat menyetel kata sandi manual untuk login alternatif jika layanan Google mengalami kendala.
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Kata Sandi Saat Ini
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        required
                        value={passwordForm.old_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                        placeholder="Masukkan kata sandi lama Anda"
                        style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        aria-label="Tampilkan atau sembunyikan kata sandi saat ini"
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {hasCustomPassword ? 'Kata Sandi Baru' : 'Kata Sandi Baru Cadangan'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      placeholder="Minimal 8 karakter (huruf besar, kecil, angka, simbol)"
                      style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label="Tampilkan atau sembunyikan kata sandi baru"
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      placeholder="Ketik ulang kata sandi baru"
                      style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Tampilkan atau sembunyikan konfirmasi kata sandi baru"
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '-0.2rem' }}>
                  Kriteria: Min. 8 karakter, wajib kombinasi huruf besar (A-Z), huruf kecil (a-z), angka (0-9), dan simbol unik (@, #, $, dll).
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    marginTop: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : hasCustomPassword ? (
                    <>
                      <Lock size={16} />
                      <span>Perbarui Kata Sandi</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Simpan Kata Sandi Cadangan</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Connected Devices (Real Active Sessions Management) */}
            <TabletConnectedDevicesView
              token={token}
              showToast={showToast}
              onLogoutCurrent={onLogout}
              onLogout={onLogout}
              onUnauthorized={onUnauthorized}
            />
          </div>
        )}

        {/* ===================================================================
            TAB: AUDIT LOGS (JEJAK AKTIVITAS PENGELOLA)
            =================================================================== */}
        {activeTab === 'audit_logs' && (
          <TabletAuditLogsView
            token={token}
            storeSlug={storeSlug}
            showToast={showToast}
            onLogout={onLogout}
            onUnauthorized={onUnauthorized}
          />
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
                    const hasUnread = Boolean(tk.has_unread || (tk.unread_count && tk.unread_count > 0));
                    const isResolved = tk.status === 'resolved' || tk.status === 'closed';
                    const isWaitingUser = tk.status === 'waiting_user';

                    return (
                      <div
                        key={tk.id}
                        onClick={() => setSelectedTicketId(tk.id)}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          borderLeft: hasUnread ? '3.5px solid #ef4444' : (isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)'),
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{tk.ticket_number || tk.id}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {hasUnread && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '999px',
                                  backgroundColor: '#ef4444',
                                  color: '#ffffff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                                {tk.unread_count && tk.unread_count > 1 ? `${tk.unread_count} Balasan Baru` : 'Balasan Baru'}
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '999px',
                              backgroundColor: isResolved
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isWaitingUser
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(245, 158, 11, 0.15)',
                              color: isResolved
                                ? '#10b981'
                                : isWaitingUser
                                ? '#ef4444'
                                : '#f59e0b'
                            }}>
                              {isResolved ? 'Selesai' : isWaitingUser ? 'Perlu Respon Anda' : 'Dalam Proses'}
                            </span>
                          </div>
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
                (() => {
                  const currentTicket = ticketDetails?.ticket || selectedTicket;
                  const messages: any[] = ticketDetails?.messages || [];
                  const isResolved = currentTicket.status === 'resolved' || currentTicket.status === 'closed';

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* Ticket Header */}
                      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            #{currentTicket.ticket_number || currentTicket.id}
                          </span>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: '999px',
                            backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isResolved ? '#10b981' : '#f59e0b'
                          }}>
                            {isResolved ? 'Selesai' : 'Dalam Proses'}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                          {currentTicket.subject}
                        </h3>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <span>Kategori: <strong>{currentTicket.category || 'Teknis'}</strong></span>
                          <span>Prioritas: <strong>{currentTicket.priority || 'Normal'}</strong></span>
                          <span>Dibuat: {currentTicket.created_at ? new Date(currentTicket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>
                        </div>
                      </div>

                      {/* Messages Scroll Area */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Initial Message */}
                        <div style={{
                          padding: '1.25rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                              Pengajuan Awal (Deskripsi Kendala)
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {currentTicket.created_at ? new Date(currentTicket.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {currentTicket.message || 'Tidak ada rincian pesan.'}
                          </p>
                        </div>

                        {/* Thread Messages */}
                        {loadingTicketDetail ? (
                          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Memuat percakapan tiket...
                          </div>
                        ) : messages.length === 0 ? (
                          <div style={{
                            padding: '1.25rem',
                            textAlign: 'center',
                            backgroundColor: 'rgba(30, 58, 138, 0.04)',
                            borderRadius: '0.75rem',
                            border: '1px dashed var(--border-light)',
                            color: 'var(--text-muted)',
                            fontSize: '0.82rem'
                          }}>
                            Belum ada balasan tanggapan dari staf CS. Tim bantuan kami akan segera meninjau tiket Anda.
                          </div>
                        ) : (
                          messages.map((msg: any) => {
                            const isStaffMsg = msg.sender_type === 'agent' || msg.sender_type === 'staff';
                            return (
                              <div
                                key={msg.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isStaffMsg ? 'flex-start' : 'flex-end',
                                  gap: '0.35rem'
                                }}
                              >
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {isStaffMsg ? (
                                    <>
                                      <ShieldCheck size={13} color="var(--primary)" />
                                      <strong>Tim Dukungan CS Catavor</strong>
                                    </>
                                  ) : (
                                    <strong>Anda (Pengelola)</strong>
                                  )}
                                  <span>&bull;</span>
                                  <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                </div>
                                <div style={{
                                  maxWidth: '85%',
                                  padding: '0.85rem 1.15rem',
                                  borderRadius: '0.85rem',
                                  backgroundColor: isStaffMsg ? 'var(--bg-card)' : 'rgba(30, 58, 138, 0.1)',
                                  border: isStaffMsg ? '1px solid var(--border-light)' : '1px solid rgba(30, 58, 138, 0.25)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.88rem',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {msg.message}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Reply Form Footer */}
                      <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)' }}>
                        {isResolved ? (
                          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Tiket ini telah berstatus selesai. Jika Anda membutuhkan bantuan lebih lanjut, silakan ajukan tiket baru.
                          </div>
                        ) : (
                          <form onSubmit={handleSendTicketReply} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <textarea
                              rows={2}
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Tuliskan tanggapan balasan atau penjelasan tambahan..."
                              style={{
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
                            <button
                              type="submit"
                              disabled={saving || !replyMessage.trim()}
                              style={{
                                minHeight: '44px',
                                padding: '0 1.25rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--primary)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                cursor: saving || !replyMessage.trim() ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <Send size={15} />
                              {saving ? 'Mengirim...' : 'Kirim'}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })()
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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

      {/* Product Filter Side Sheet (Tablet Native Standard) */}
      <TabletProductFilterSheet
        isOpen={isProductFilterOpen}
        onClose={() => setIsProductFilterOpen(false)}
        status={productStatusFilter}
        sort={productSortFilter}
        productType={productTypeFilter}
        categoryId={productCategoryFilter}
        stockStatus={productStockFilter === 'low' || productStockFilter === 'out' ? 'all' : (productStockFilter as 'all' | 'in_stock' | 'out_of_stock')}
        categories={categories}
        catalogMetrics={catalogMetrics || undefined}
        isHybridStore={isHybridStore}
        availableProductTypes={availableCatalogTypes}
        onApply={handleApplyProductFilters}
        onReset={handleResetAllFilters}
      />

      {/* ===================================================================
          RENAME MASTER CATEGORY MODAL (Tablet Native Standard)
          =================================================================== */}
      {renameMasterModalData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.18s ease'
          }}
          onClick={() => setRenameMasterModalData(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--primary-glow)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Ubah Nama Kategori
                  </h3>
                  {renameMasterModalData.fieldLabel && (
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {renameMasterModalData.fieldLabel}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenameMasterModalData(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Nama Kategori Saat Ini:
                </label>
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  fontWeight: 600
                }}>
                  {renameMasterModalData.oldValue}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Nama Baru Kategori *
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama baru kategori..."
                  value={renameMasterModalData.newValue}
                  onChange={(e) => setRenameMasterModalData({ ...renameMasterModalData, newValue: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (renameMasterModalData.newValue.trim() && !saving) {
                        handleRenameMasterOption(
                          renameMasterModalData.oldValue,
                          renameMasterModalData.newValue,
                          renameMasterModalData.productType
                        );
                      }
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Informative Synchronize Note */}
              <div style={{
                padding: '0.75rem 0.95rem',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.22)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Perubahan nama kategori ini akan otomatis disinkronkan ke seluruh item katalog yang menggunakan kategori ini secara aman.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <button
                type="button"
                onClick={() => setRenameMasterModalData(null)}
                style={{
                  minHeight: '44px',
                  padding: '0 1.25rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving || !renameMasterModalData.newValue.trim() || renameMasterModalData.newValue.trim() === renameMasterModalData.oldValue}
                onClick={() => handleRenameMasterOption(
                  renameMasterModalData.oldValue,
                  renameMasterModalData.newValue,
                  renameMasterModalData.productType
                )}
                style={{
                  minHeight: '44px',
                  padding: '0 1.5rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: (saving || !renameMasterModalData.newValue.trim() || renameMasterModalData.newValue.trim() === renameMasterModalData.oldValue) ? 'not-allowed' : 'pointer',
                  opacity: (saving || !renameMasterModalData.newValue.trim() || renameMasterModalData.newValue.trim() === renameMasterModalData.oldValue) ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Save size={15} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          DELETE & REASSIGN MASTER CATEGORY MODAL (Tablet Native Standard)
          =================================================================== */}
      {deleteMasterModalData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.18s ease'
          }}
          onClick={() => setDeleteMasterModalData(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
                    Konfirmasi Hapus Kategori
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Pengalihan Relasi Item Katalog Wajib Dilakukan
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteMasterModalData(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                Anda akan menghapus kategori <strong style={{ color: 'var(--text-primary)' }}>"{deleteMasterModalData.value}"</strong>. 
                Seluruh item katalog yang saat ini menggunakan kategori ini akan dialihkan ke kategori pengganti di bawah ini.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                  Pilih Kategori Pengganti *
                </label>
                <TabletCustomSelect
                  value={deleteMasterModalData.selectedReplacement}
                  onChange={(val) => setDeleteMasterModalData({
                    ...deleteMasterModalData,
                    selectedReplacement: val
                  })}
                  options={deleteMasterModalData.replacementOptions.map(opt => ({
                    value: opt,
                    label: opt
                  }))}
                  placeholder="Pilih Kategori Pengganti..."
                  triggerStyle={{ minHeight: '44px', fontSize: '0.88rem' }}
                />
              </div>

              {/* Informative Note */}
              <div style={{
                padding: '0.75rem 0.95rem',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Tindakan ini tidak dapat dibatalkan. Kategori lama akan dihapus permanen dari daftar etalase toko Anda.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-deep)'
            }}>
              <button
                type="button"
                onClick={() => setDeleteMasterModalData(null)}
                style={{
                  minHeight: '44px',
                  padding: '0 1.25rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving || !deleteMasterModalData.selectedReplacement}
                onClick={handleConfirmDeleteMasterOption}
                style={{
                  minHeight: '44px',
                  padding: '0 1.5rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: (saving || !deleteMasterModalData.selectedReplacement) ? 'not-allowed' : 'pointer',
                  opacity: (saving || !deleteMasterModalData.selectedReplacement) ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Trash2 size={15} />
                <span>{saving ? 'Menghapus...' : 'Hapus & Alihkan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
