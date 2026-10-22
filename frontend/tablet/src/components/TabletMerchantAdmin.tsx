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
  RotateCcw
} from 'lucide-react';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { TabletAnalyticsView } from './TabletAnalyticsView';
import { TabletSubscriptionModal, type StoreQuotaData } from './TabletSubscriptionModal';
import { TabletConnectedDevicesView } from './TabletConnectedDevicesView';
import { TabletAuditLogsView } from './TabletAuditLogsView';
import { RichTextarea, FormattedText } from './RichTextarea';
import { useModalBackHandler } from '../utils/navigation';

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
  const onThemeChangeRef = useRef(onThemeChange);
  useEffect(() => {
    onThemeChangeRef.current = onThemeChange;
  }, [onThemeChange]);
  const appliedThemeRef = useRef<string>('');

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
  const [selectedProductId, setSelectedProductId] = useState<number | 'new' | null>(() => {
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

  // Back Interceptor for Tablet Mini Sub-views (Rule 1 & Rule 2)
  useModalBackHandler({
    isOpen: isNarrowScreen && selectedProductId !== null,
    onClose: () => {
      setSelectedProductId(null);
      setIsSelectingProductType(false);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('type');
        url.searchParams.delete('catalog_type');
        window.history.pushState({}, '', url.toString());
      } catch {}
    },
    modalId: 'tablet_item_detail'
  });

  const [productSearch, setProductSearch] = useState<string>('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productPage, setProductPage] = useState<number>(1);
  const [productTotalPages, setProductTotalPages] = useState<number>(1);
  const [productTotalRecords, setProductTotalRecords] = useState<number>(0);

  const [productForm, setProductForm] = useState({
    id: 0,
    name: '',
    price: 0,
    stock: 1,
    category_id: '',
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
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const targetType = presetType || params?.get('type') || params?.get('catalog_type') || '';
    const isValidType = CATALOG_TYPE_OPTIONS.some(t => t.id === targetType);
    const chosenType = isValidType ? targetType : '';
    const typeDef = chosenType ? CATALOG_TYPE_OPTIONS.find(t => t.id === chosenType) : undefined;

    const defaultAttrs: Record<string, any> = {};
    if (chosenType === 'physical') defaultAttrs.condition = 'Baru';
    if (chosenType === 'food') defaultAttrs.halal_status = 'Bersertifikat Halal Resmi (BPJPH / MUI)';
    if (chosenType === 'digital') defaultAttrs.license_type = 'Lisensi Personal';
    if (chosenType === 'service') defaultAttrs.service_location = 'Datang ke Toko / Workshop';
    if (chosenType === 'plant') {
      defaultAttrs.sunlight = 'Partial Sun (Teduh Terang / Naungan Paranet)';
      defaultAttrs.watering = 'Sedang (2-3 Hari Sekali)';
      defaultAttrs.protection_status = 'Non-Dilindungi (Aman & Bebas Diperjualbelikan)';
    }
    if (chosenType === 'fauna') {
      defaultAttrs.conservation_status = 'Tersedia (Ready Stock)';
    }
    if (chosenType === 'property') {
      defaultAttrs.transaction_type = 'Dijual (Jual Putus)';
      defaultAttrs.certificate = 'SHM (Sertifikat Hak Milik)';
      defaultAttrs.furnishing = 'Semi-Furnished';
      defaultAttrs.facing = 'Timur';
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
  }, []);

  const handleCancelToProductTypeSelection = useCallback(() => {
    setSelectedProductId('new');
    setIsSelectingProductType(true);
    setProductForm({
      id: 0,
      name: '',
      price: 0,
      stock: 1,
      category_id: categoriesRef.current.length > 0 ? String(categoriesRef.current[0].id) : '',
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

  const fetchProducts = useCallback(async (page: number, search: string = '', status: string = 'all', catId: string = 'all') => {
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

      const res = await fetch(`/api/products?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Store-Slug': storeSlug,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const json = await res.json();
        const list = json.data || json.products || [];
        setProducts(list);
        setProductPage(page);
        setProductTotalPages(json.totalPages || Math.ceil((json.total || list.length) / 15) || 1);
        setProductTotalRecords(json.total || list.length);

        const isUrlActionNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('action') === 'new';
        if (isUrlActionNew) {
          handleStartNewProduct();
        } else if (!isNarrowScreen) {
          setSelectedProductId(prev => {
            if (prev === null) {
              handleStartNewProduct();
              return 'new';
            }
            return prev;
          });
        }
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, [token, storeSlug, isNarrowScreen, handleStartNewProduct]);

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

    setProductForm({
      id: prod.id,
      name: prod.name || '',
      price: prod.price || 0,
      stock: prod.stock !== undefined ? prod.stock : 1,
      category_id: prod.category_id || '',
      product_type: prod.product_type || 'physical',
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
      attributes: rawAttrs
    });
  };

  const handleSelectProductType = (typeId: string) => {
    const typeDef = CATALOG_TYPE_OPTIONS.find(t => t.id === typeId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'items');
      url.searchParams.set('action', 'new');
      url.searchParams.set('type', typeId);
      window.history.pushState({}, '', url.toString());
    } catch {}
    setProductForm(prev => {
      const defaultAttrs: Record<string, any> = { ...(prev.attributes || {}) };
      if (typeId === 'physical' && !defaultAttrs.condition) defaultAttrs.condition = 'Baru';
      if (typeId === 'food' && !defaultAttrs.halal_status) defaultAttrs.halal_status = 'Bersertifikat Halal Resmi (BPJPH / MUI)';
      if (typeId === 'digital' && !defaultAttrs.license_type) defaultAttrs.license_type = 'Lisensi Personal';
      if (typeId === 'service' && !defaultAttrs.service_location) defaultAttrs.service_location = 'Datang ke Toko / Workshop';
      if (typeId === 'plant') {
        if (!defaultAttrs.sunlight) defaultAttrs.sunlight = 'Partial Sun (Teduh Terang / Naungan Paranet)';
        if (!defaultAttrs.watering) defaultAttrs.watering = 'Sedang (2-3 Hari Sekali)';
        if (!defaultAttrs.protection_status) defaultAttrs.protection_status = 'Non-Dilindungi (Aman & Bebas Diperjualbelikan)';
      }
      if (typeId === 'fauna') {
        if (!defaultAttrs.conservation_status) defaultAttrs.conservation_status = 'Tersedia (Ready Stock)';
      }
      if (typeId === 'property') {
        if (!defaultAttrs.transaction_type) defaultAttrs.transaction_type = 'Dijual (Jual Putus)';
        if (!defaultAttrs.certificate) defaultAttrs.certificate = 'SHM (Sertifikat Hak Milik)';
        if (!defaultAttrs.furnishing) defaultAttrs.furnishing = 'Semi-Furnished';
        if (!defaultAttrs.facing) defaultAttrs.facing = 'Timur';
      }

      const isDefaultUnit = !prev.unit || prev.unit === 'Pcs' || CATALOG_TYPE_OPTIONS.some(o => o.defaultUnit === prev.unit);
      const shouldUpdateUnit = prev.id === 0 && isDefaultUnit;

      return {
        ...prev,
        product_type: typeId,
        unit: shouldUpdateUnit ? (typeDef?.defaultUnit || 'Pcs') : prev.unit,
        attributes: defaultAttrs
      };
    });
    setIsSelectingProductType(false);
  };

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

      const payload = {
        name: productForm.name.trim(),
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        category_id: productForm.category_id ? Number(productForm.category_id) : undefined,
        product_type: productForm.product_type,
        scientific_name: productForm.scientific_name || (productForm.attributes?.scientific_name) || undefined,
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
        await fetchProducts(productPage, productSearch, productStatusFilter, productCategoryFilter);
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
        await fetchProducts(1, productSearch, productStatusFilter, productCategoryFilter);
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
  // 3. CATEGORIES STATE
  // =========================================================================
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
        if (list.length > 0 && !isNarrowScreen) {
          setSelectedCategoryId(prev => {
            if (prev === null) {
              setCategoryForm({ id: list[0].id, name: list[0].name });
              return list[0].id;
            }
            return prev;
          });
        }
      }
    } catch {
      // safe fallback
    }
  }, [storeSlug, getHeaders, isNarrowScreen]);

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
  // 7. USER PROFILE & PASSWORD
  // =========================================================================
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });

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

  // 1. Initial Core Data Fetching (Run ONCE per store/token mount - Only essential store profile, categories, and products)
  const initialLoadedKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${storeSlug}_${token}`;
    if (!storeSlug || initialLoadedKeyRef.current === key) return;
    initialLoadedKeyRef.current = key;

    fetchStoreProfile();
    fetchCategories();
    fetchProducts(1, '', 'all', 'all');
  }, [storeSlug, token, fetchStoreProfile, fetchCategories, fetchProducts]);

  // 2. Debounced Search & Filter Effect for Products (Only triggers fetchProducts, never refetches profile/other tabs)
  const [debouncedProductSearch, setDebouncedProductSearch] = useState<string>(productSearch);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const isInitialFilterMountRef = useRef<boolean>(true);
  useEffect(() => {
    if (isInitialFilterMountRef.current) {
      isInitialFilterMountRef.current = false;
      return;
    }
    fetchProducts(1, debouncedProductSearch, productStatusFilter, productCategoryFilter);
  }, [debouncedProductSearch, productStatusFilter, productCategoryFilter, fetchProducts]);

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
        { key: 'notifications', label: 'Pusat Notifikasi', icon: Bell, badge: notifications.filter(n => !n.read).length > 0 ? String(notifications.filter(n => !n.read).length) : undefined, badgeColor: '#ef4444' },
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
          <TabletMasterDetailView
            title="Katalog Produk & Inventaris"
            subtitle={`${productTotalRecords} total item`}
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
                {/* Search & Category Filter */}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setProductPage(1);
                      }}
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

                  {/* Status Pills & Category Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
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
                              minHeight: '34px',
                              padding: '0.2rem 0.65rem',
                              borderRadius: '999px',
                              border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                              backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                              color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>

                    <select
                      value={productCategoryFilter}
                      onChange={(e) => {
                        setProductCategoryFilter(e.target.value);
                        setProductPage(1);
                      }}
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        outline: 'none',
                        maxWidth: '130px'
                      }}
                    >
                      <option value="all">Semua Kategori</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {loading && products.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Memuat daftar produk...
                    </div>
                  ) : products.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Belum ada produk dalam katalog ini
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
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Stok: {prod.stock ?? 1} {prod.unit || 'Pcs'}
                              </div>
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
                  onPageChange={(p) => fetchProducts(p, productSearch, productStatusFilter, productCategoryFilter)}
                  isLoading={loading}
                />
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
                        onClick={() => {
                          setIsSelectingProductType(true);
                          try {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('type');
                            url.searchParams.delete('catalog_type');
                            window.history.pushState({}, '', url.toString());
                          } catch {}
                        }}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kondisi Barang *
                            </label>
                            <select
                              value={productForm.attributes.condition || 'Baru'}
                              onChange={(e) => updateProductAttribute('condition', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Baru">Baru (100% Baru & Tersegel)</option>
                              <option value="Bekas">Bekas / Second (Pre-owned)</option>
                              <option value="Refurbished">Refurbished (Rekondisi Resmi)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Berat Pengiriman (Gram)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={productForm.attributes.weight || ''}
                              onChange={(e) => updateProductAttribute('weight', Number(e.target.value) || 0)}
                              placeholder="Contoh: 500"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
                              placeholder="Contoh: Nike / Asus / Custom"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Varian / Ukuran Ringkas (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.variant || ''}
                              onChange={(e) => updateProductAttribute('variant', e.target.value)}
                              placeholder="Contoh: Hitam, Putih / S, M, L"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 2. KULINER & F&B */}
                      {productForm.product_type === 'food' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Sertifikasi / Status Halal *
                            </label>
                            <select
                              value={productForm.attributes.halal_status || 'Bersertifikat Halal Resmi (BPJPH / MUI)'}
                              onChange={(e) => updateProductAttribute('halal_status', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Bersertifikat Halal Resmi (BPJPH / MUI)">Bersertifikat Halal Resmi (BPJPH / MUI)</option>
                              <option value="Halal (Bahan Baku Halal & Thayyib)">Halal (Bahan Baku Halal & Thayyib)</option>
                              <option value="Dalam Proses Sertifikasi Halal">Dalam Proses Sertifikasi Halal</option>
                              <option value="Non-Halal">Non-Halal</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Level Rasa / Varian Porsi (Opsional)
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.variant || ''}
                              onChange={(e) => updateProductAttribute('variant', e.target.value)}
                              placeholder="Contoh: Pedas Sedang, Manis Gurih / 500gr"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Suhu Penyimpanan
                            </label>
                            <select
                              value={productForm.attributes.storage_temp || 'Suhu Ruang (Kering & Sejuk)'}
                              onChange={(e) => updateProductAttribute('storage_temp', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Suhu Ruang (Kering & Sejuk)">Suhu Ruang (Kering & Sejuk)</option>
                              <option value="Chiller / Lemari Pendingin (2°C - 8°C)">Chiller / Dingin (2°C - 8°C)</option>
                              <option value="Freezer / Beku (-18°C)">Freezer / Beku (-18°C)</option>
                              <option value="Hangat / Siap Santap">Hangat / Siap Santap Langsung</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Masa Simpan / Daya Tahan
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.expired_info || ''}
                              onChange={(e) => updateProductAttribute('expired_info', e.target.value)}
                              placeholder="Contoh: Fresh Daily / 3 Hari Chiller / 3 Bulan Freezer"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 3. ITEM DIGITAL */}
                      {productForm.product_type === 'digital' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Format Berkas / File *
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.file_format || ''}
                              onChange={(e) => updateProductAttribute('file_format', e.target.value)}
                              placeholder="Contoh: PDF / EPUB / ZIP / Figma"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Ukuran Berkas File
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.file_size || ''}
                              onChange={(e) => updateProductAttribute('file_size', e.target.value)}
                              placeholder="Contoh: 15 MB / 250 MB"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Tipe Lisensi Digital *
                            </label>
                            <select
                              value={productForm.attributes.license_type || 'Lisensi Personal'}
                              onChange={(e) => updateProductAttribute('license_type', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Lisensi Personal">Lisensi Personal (Pemakaian Pribadi)</option>
                              <option value="Lisensi Komersial">Lisensi Komersial (Bisnis & Komersial)</option>
                              <option value="Extended License / Resale Rights">Extended License / Resale Rights (Boleh Dijual Ulang)</option>
                              <option value="Open Source / Bebas">Open Source / Bebas Royalti</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 4. JASA & LAYANAN */}
                      {productForm.product_type === 'service' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Estimasi Durasi Layanan *
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.duration || ''}
                              onChange={(e) => updateProductAttribute('duration', e.target.value)}
                              placeholder="Contoh: 1 Jam / 1 Sesi / 2 Hari Kerja"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Metode Pelaksanaan Layanan *
                            </label>
                            <select
                              value={productForm.attributes.service_location || 'Datang ke Toko / Workshop'}
                              onChange={(e) => updateProductAttribute('service_location', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Datang ke Toko / Workshop">Datang ke Toko / Workshop</option>
                              <option value="Home Visit (Kunjungan ke Rumah)">Home Visit (Kunjungan ke Rumah)</option>
                              <option value="Online / Jarak Jauh">Online / Jarak Jauh</option>
                            </select>
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Area Jangkauan Layanan *
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.service_area || ''}
                              onChange={(e) => updateProductAttribute('service_area', e.target.value)}
                              placeholder="Contoh: Jabodetabek / Kota Bandung / Seluruh Indonesia"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 5. TANAMAN & BIBIT */}
                      {productForm.product_type === 'plant' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Nama Ilmiah / Botani (Latin) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                            </label>
                            <input
                              type="text"
                              value={productForm.scientific_name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProductForm(p => ({ ...p, scientific_name: v, attributes: { ...(p.attributes || {}), scientific_name: v } }));
                              }}
                              placeholder="Contoh: Monstera deliciosa, Sansevieria..."
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontStyle: 'italic',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <Sun size={13} style={{ color: '#f59e0b' }} />
                              <span>Kebutuhan Cahaya *</span>
                            </label>
                            <select
                              value={productForm.attributes.sunlight || 'Partial Sun (Teduh Terang / Naungan Paranet)'}
                              onChange={(e) => updateProductAttribute('sunlight', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Full Sun (Matahari Langsung 6+ Jam)">Full Sun (Matahari Langsung 6+ Jam)</option>
                              <option value="Partial Sun (Teduh Terang / Naungan Paranet)">Partial Sun (Teduh Terang)</option>
                              <option value="Low Light / Indoor (Cahaya Rendah Ruangan)">Low Light / Indoor (Cahaya Rendah)</option>
                              <option value="Fleksibel (Indoor / Outdoor)">Fleksibel (Indoor / Outdoor)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              <Droplets size={13} style={{ color: '#0ea5e9' }} />
                              <span>Frekuensi Penyiraman *</span>
                            </label>
                            <select
                              value={productForm.attributes.watering || 'Sedang (2-3 Hari Sekali)'}
                              onChange={(e) => updateProductAttribute('watering', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Banyak (Rutin Setiap Hari)">Banyak (Rutin Setiap Hari)</option>
                              <option value="Sedang (2-3 Hari Sekali)">Sedang (2-3 Hari Sekali)</option>
                              <option value="Sedikit (1-2 Minggu Sekali / Sukulen)">Sedikit (1-2 Minggu Sekali / Sukulen)</option>
                              <option value="Khusus / Hidroponik & Tanaman Air">Khusus / Hidroponik & Air</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Media Tanam
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.planting_medium || ''}
                              onChange={(e) => updateProductAttribute('planting_medium', e.target.value)}
                              placeholder="Contoh: Sekam Bakar, Pasir Malang, Humus"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Ukuran / Tinggi Tanaman
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.plant_size || ''}
                              onChange={(e) => updateProductAttribute('plant_size', e.target.value)}
                              placeholder="Contoh: Tinggi 25-35 cm, Pot D15"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Status Legalitas Bibit *
                            </label>
                            <select
                              value={productForm.attributes.protection_status || 'Non-Dilindungi (Aman & Bebas Diperjualbelikan)'}
                              onChange={(e) => updateProductAttribute('protection_status', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Non-Dilindungi (Aman & Bebas Diperjualbelikan)">Non-Dilindungi (Aman & Bebas Diperjualbelikan)</option>
                              <option value="Hasil Budidaya Nursery Resmi">Hasil Budidaya Nursery Resmi</option>
                              <option value="Dilindungi (Wajib Izin Khusus / CITES)">Dilindungi (Wajib Izin Khusus / CITES)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 6. SATWA PELIHARAAN */}
                      {productForm.product_type === 'fauna' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Nama Ilmiah / Taksonomi (Latin) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                            </label>
                            <input
                              type="text"
                              value={productForm.scientific_name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProductForm(p => ({ ...p, scientific_name: v, attributes: { ...(p.attributes || {}), scientific_name: v } }));
                              }}
                              placeholder="Contoh: Scleropages formosus, Felis catus..."
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontStyle: 'italic',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Habitat Asli
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.habitat || ''}
                              onChange={(e) => updateProductAttribute('habitat', e.target.value)}
                              placeholder="Contoh: Air Tawar / Darat / Hutan Hujan"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Makanan / Diet
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.diet || ''}
                              onChange={(e) => updateProductAttribute('diet', e.target.value)}
                              placeholder="Contoh: Pelet / Karnivora / Omnivora"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
                              placeholder="Contoh: Kalimantan / Amerika Selatan"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Estimasi Masa Hidup
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.lifespan || ''}
                              onChange={(e) => updateProductAttribute('lifespan', e.target.value)}
                              placeholder="Contoh: 5 - 8 Tahun"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Status Ketersediaan *
                            </label>
                            <select
                              value={productForm.attributes.conservation_status || 'Tersedia (Ready Stock)'}
                              onChange={(e) => updateProductAttribute('conservation_status', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Tersedia (Ready Stock)">Tersedia (Ready Stock / Siap Adopsi)</option>
                              <option value="Pre-Order (PO)">Pre-Order (PO / Inden Khusus)</option>
                              <option value="Koleksi / Display Showcase">Koleksi / Display Showcase (Tanya Penjual)</option>
                              <option value="Habis Terjual (Sold Out)">Habis Terjual (Sold Out)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 7. PROPERTI & REAL ESTATE */}
                      {productForm.product_type === 'property' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Tipe Transaksi *
                            </label>
                            <select
                              value={productForm.attributes.transaction_type || 'Dijual (Jual Putus)'}
                              onChange={(e) => updateProductAttribute('transaction_type', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Dijual (Jual Putus)">Dijual (Jual Putus)</option>
                              <option value="Disewakan (Tahunan)">Disewakan (Tahunan)</option>
                              <option value="Disewakan (Bulanan)">Disewakan (Bulanan)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Legalitas / Sertifikat *
                            </label>
                            <select
                              value={productForm.attributes.certificate || 'SHM (Sertifikat Hak Milik)'}
                              onChange={(e) => updateProductAttribute('certificate', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="SHM (Sertifikat Hak Milik)">SHM (Sertifikat Hak Milik)</option>
                              <option value="HGB (Hak Guna Bangunan)">HGB (Hak Guna Bangunan)</option>
                              <option value="Strata Title / SHMRS">Strata Title / SHMRS (Apartemen)</option>
                              <option value="AJB (Akta Jual Beli)">AJB (Akta Jual Beli)</option>
                              <option value="Girik / Letter C">Girik / Letter C</option>
                              <option value="Lainnya">Lainnya</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Luas Tanah (m²) *
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.land_area || ''}
                              onChange={(e) => updateProductAttribute('land_area', e.target.value)}
                              placeholder="Contoh: 120"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
                              onChange={(e) => updateProductAttribute('bedrooms', Number(e.target.value) || 0)}
                              placeholder="Contoh: 3"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
                              onChange={(e) => updateProductAttribute('bathrooms', Number(e.target.value) || 0)}
                              placeholder="Contoh: 2"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Kondisi Perabotan
                            </label>
                            <select
                              value={productForm.attributes.furnishing || 'Semi-Furnished'}
                              onChange={(e) => updateProductAttribute('furnishing', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            >
                              <option value="Unfurnished (Kosong)">Unfurnished (Kosong)</option>
                              <option value="Semi-Furnished">Semi-Furnished</option>
                              <option value="Fully Furnished (Lengkap)">Fully Furnished (Lengkap Siap Huni)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                              Lokasi / Wilayah Properti *
                            </label>
                            <input
                              type="text"
                              value={productForm.attributes.property_location || ''}
                              onChange={(e) => updateProductAttribute('property_location', e.target.value)}
                              placeholder="Contoh: BSD City, Serpong, Tangerang Selatan"
                              style={{
                                width: '100%',
                                minHeight: '40px',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
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
        {/* ===================================================================
            TAB 3: STATISTIK & TRAFIK BISNIS
            =================================================================== */}
        {activeTab === 'analytics' && (
          <TabletAnalyticsView
            token={token}
            storeSlug={storeSlug}
            showToast={showToast}
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

            {/* Connected Devices (Real Active Sessions Management) */}
            <TabletConnectedDevicesView
              token={token}
              showToast={showToast}
              onLogoutCurrent={onLogout}
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
    </div>
  );
};
