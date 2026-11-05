import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Store as StoreIcon,
  Search,
  MessageCircle,
  Share2,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Package,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Filter,
  ExternalLink,
  Tag,
  Info,
  Layers,
  Globe,
  Flag,
  Check,
  CheckCircle2,
  Copy,
  MoreVertical,
  Archive,
  Utensils,
  Wrench,
  FileCode,
  PawPrint,
  Sprout,
  Building2,
  Sparkles,
  X,
  Lock,
  Compass,
  Heart,
  Truck,
  Star,
  Download,
  AlertTriangle,
  ZoomIn,
  Image as ImageIcon,
  ArrowRight,
  ShoppingBag,
  ShoppingCart,
  Minus,
  Plus,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import apiClient, { API_BASE } from '../utils/apiClient';
import { TabletCustomSelect, type TabletSelectOption } from './TabletCustomSelect';
import { TabletShareCatalogView } from './TabletShareCatalogView';
import { TabletImageLightbox } from './TabletImageLightbox';
import { VideoPlayerEmbed } from './VideoEmbed';
import { useModalBackHandler, smartBack } from '../utils/navigation';
import { FormattedText } from './RichTextarea';
import { ExternalLinkWarningModal } from './ExternalLinkWarningModal';
import { checkUrlSecurity, safeOpenUrl } from '../utils/urlSecurity';
import {
  OperationalHoursCard,
  WhatsAppContactsCard,
  OfficialWebsiteCard,
  SocialMediaSection,
  ProductImportantInfoSection,
  cleanEmoji
} from './TabletAboutComponents';

export interface TabletStoreCatalogProps {
  slug: string;
  onBackToExplore?: () => void;
}

export interface WAContactItem {
  id: string;
  label: string;
  number: string;
  is_default?: boolean;
  use_for_storefront?: boolean;
}

export interface ResolvedWAContact {
  id: string;
  label: string;
  number: string;
  cleanNumber: string;
  isDefault: boolean;
}

export function parseWAContacts(raw: string | null | undefined): WAContactItem[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any, idx: number) => ({
            id: String(item.id || `wa_${idx + 1}`),
            label: item.label || item.name || (idx === 0 ? 'WhatsApp Utama' : `WhatsApp CS ${idx + 1}`),
            number: String(item?.number ?? item?.phone ?? item?.whatsapp ?? '').trim(),
            is_default: Boolean(item.is_default ?? (idx === 0)),
            use_for_storefront: Boolean(item.use_for_storefront ?? (idx === 0))
          }))
          .filter(item => item.number !== '');
      }
    } catch {}
  }

  // Fallback single number
  return [{
    id: 'wa_main',
    label: 'WhatsApp Toko',
    number: trimmed,
    is_default: true,
    use_for_storefront: true
  }];
}

export function getStorefrontDefaultWA(contacts: WAContactItem[], fallbackRaw?: string | null): ResolvedWAContact {
  const list = contacts && contacts.length > 0 ? contacts : parseWAContacts(fallbackRaw);
  if (!list || list.length === 0) {
    return { id: 'default', label: 'WhatsApp', number: '', cleanNumber: '', isDefault: false };
  }

  let chosen = list.find(c => c.use_for_storefront);
  if (!chosen) chosen = list.find(c => c.is_default);
  if (!chosen) chosen = list[0];

  const clean = (chosen.number || '').replace(/\D/g, '');
  return {
    id: chosen.id,
    label: chosen.label || 'WhatsApp Resmi',
    number: chosen.number,
    cleanNumber: clean,
    isDefault: true
  };
}

export function resolveProductWAContact(
  item: any,
  contacts: WAContactItem[],
  fallbackRaw?: string | null
): ResolvedWAContact {
  const list = contacts && contacts.length > 0 ? contacts : parseWAContacts(fallbackRaw);
  if (!list || list.length === 0) {
    return { id: 'default', label: 'WhatsApp', number: '', cleanNumber: '', isDefault: false };
  }

  const targetId = item?.detailed_info?.whatsapp_contact_id || item?.attributes?.whatsapp_contact_id;
  if (targetId && targetId !== 'default') {
    const matched = list.find(c => c.id === targetId);
    if (matched) {
      const clean = (matched.number || '').replace(/\D/g, '');
      if (clean) {
        return {
          id: matched.id,
          label: matched.label || 'WhatsApp CS',
          number: matched.number,
          cleanNumber: clean,
          isDefault: Boolean(matched.is_default || matched.use_for_storefront)
        };
      }
    }
  }

  return getStorefrontDefaultWA(list, fallbackRaw);
}

export function buildWALink(phoneNumber: string, messageText: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  if (!cleanNumber) return '#';
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(messageText)}`;
}

export const isNonEmptyValue = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s.length > 0 && s !== 'null' && s !== 'undefined' && s !== '-' && s !== 'none';
  }
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'boolean') return true;
  return false;
};

export const getCatalogItemUnit = (prod: any): string => {
  if (prod?.unit) return prod.unit;
  switch (prod?.product_type) {
    case 'food': return 'Porsi';
    case 'service': return 'Sesi';
    case 'digital': return 'Lisensi';
    case 'property': return 'Unit';
    case 'fauna': return 'Ekor';
    case 'plant': return 'Pot';
    default: return 'Pcs';
  }
};

export function getItemActionConfig(item: any) {
  const pType = (item?.product_type || 'physical');

  if (pType === 'property') {
    return {
      type: 'property',
      shortLabel: 'Hubungi Agen',
      fullLabel: 'Hubungi Agen / Janji Survey',
      Icon: MessageCircle
    };
  }

  if (pType === 'food') {
    return {
      type: 'food',
      shortLabel: 'Pesan Menu',
      fullLabel: 'Pesan Sekarang / Order Menu',
      Icon: Utensils
    };
  }

  if (pType === 'service') {
    return {
      type: 'service',
      shortLabel: 'Pesan Jasa',
      fullLabel: 'Pesan Layanan / Booking Jasa',
      Icon: ShieldCheck
    };
  }

  if (pType === 'digital') {
    return {
      type: 'digital',
      shortLabel: 'Beli & Unduh',
      fullLabel: 'Beli & Dapatkan File Digital',
      Icon: Download
    };
  }

  if (pType === 'fauna') {
    return {
      type: 'fauna',
      shortLabel: 'Beli / Adopsi',
      fullLabel: 'Beli / Adopsi Hewan Sekarang',
      Icon: ShoppingBag
    };
  }

  if (pType === 'plant') {
    return {
      type: 'plant',
      shortLabel: 'Beli Sekarang',
      fullLabel: 'Beli Tanaman Sekarang',
      Icon: ShoppingCart
    };
  }

  return {
    type: 'physical',
    shortLabel: 'Pesan Sekarang',
    fullLabel: 'Pesan via WhatsApp Sekarang',
    Icon: ShoppingCart
  };
}

export const renderAboutIcon = (key: string, size = 20, color = 'var(--primary)') => {
  switch (key) {
    case 'shield': return <ShieldCheck size={size} style={{ color }} />;
    case 'lock': return <Lock size={size} style={{ color }} />;
    case 'message': return <MessageCircle size={size} style={{ color }} />;
    case 'heart': return <Heart size={size} style={{ color }} />;
    case 'truck': return <Truck size={size} style={{ color }} />;
    case 'sparkles': return <Sparkles size={size} style={{ color }} />;
    case 'star': return <Star size={size} style={{ color }} />;
    case 'compass': return <Compass size={size} style={{ color }} />;
    default: return <Compass size={size} style={{ color }} />;
  }
};

export const getCatalogReportReasons = (targetType: 'store' | 'item'): { id: string; title: string; desc: string }[] => {
  if (targetType === 'store') {
    return [
      { id: 'fraud', title: 'Indikasi Penipuan / Toko Fiktif', desc: 'Profil toko mencurigakan atau meminta pembayaran mencurigakan di luar ketentuan.' },
      { id: 'prohibited_items', title: 'Produk Terlarang / Ilegal', desc: 'Menawarkan komoditas yang melanggar hukum atau kebijakan komunitas.' },
      { id: 'impersonation', title: 'Penyalahgunaan Identitas / Merek', desc: 'Mengatasnamakan pihak lain, brand resmi, atau toko lain tanpa izin sah.' },
      { id: 'contact_invalid', title: 'Informasi Kontak Tidak Valid', desc: 'Nomor WhatsApp atau alamat tidak dapat dihubungi secara sah.' },
      { id: 'other', title: 'Pelanggaran Lainnya', desc: 'Kendala kepatuhan lainnya yang memerlukan investigasi tim platform.' }
    ];
  }
  return [
    { id: 'fraud', title: 'Penipuan / Barang Palsu', desc: 'Produk tidak sesuai deskripsi asli atau diduga barang tiruan/fiktif.' },
    { id: 'illegal_content', title: 'Materi / Konten Terlarang', desc: 'Foto, video, atau teks memuat unsur yang melanggar ketentuan hukum.' },
    { id: 'pricing_misleading', title: 'Harga Tidak Wajar / Menyesatkan', desc: 'Pencantuman harga manipulatif atau biaya terselubung.' },
    { id: 'other', title: 'Laporan Lainnya', desc: 'Kendala lainnya pada item ini.' }
  ];
};

export const TabletStoreCatalog: React.FC<TabletStoreCatalogProps> = ({
  slug,
  onBackToExplore
}) => {
  const [settings, setSettings] = useState<any>(null);
  const [faunas, setFaunas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State: 'catalog' or 'about' (Synchronized with URL params)
  const [activePublicTab, setActivePublicTab] = useState<'catalog' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'about') {
        return 'about';
      }
    }
    return 'catalog';
  });

  // External URL Safety Warning Modal State
  const [externalUrlWarning, setExternalUrlWarning] = useState<string | null>(null);

  // Screen Width state for Tablet Mini (< 880px) vs Tablet Lebar (>= 880px)
  const [screenWidth, setScreenWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1024;
  });

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTabletMini = screenWidth < 880;

  // Detail View State (Full-Page Parity with Desktop)
  const [isDetailActive, setIsDetailActive] = useState<boolean>(false);
  const [selectedFauna, setSelectedFauna] = useState<any | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState<boolean>(false);
  const [purchaseQty, setPurchaseQty] = useState<number>(1);
  const [showDetailActionDropdown, setShowDetailActionDropdown] = useState<boolean>(false);
  const detailActionDropdownRef = useRef<HTMLDivElement>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [habitatFilter, setHabitatFilter] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name_asc'>('newest');

  // Server-side Catalog & Pagination State (Parity with Desktop & Mobile)
  const [serverCatalogItems, setServerCatalogItems] = useState<any[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [serverPagination, setServerPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  }>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNext: false,
    hasPrev: false
  });

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Overlays
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [openCardActionMenuId, setOpenCardActionMenuId] = useState<number | null>(null);
  const [reportModalData, setReportModalData] = useState<{ type: 'store' | 'item'; item?: any } | null>(null);
  const [reportReason, setReportReason] = useState<string>('fraud');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [reportEmail, setReportEmail] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const handleSafeExternalRedirect = useCallback((rawUrl?: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!rawUrl) return;
    const fullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;

    const sec = checkUrlSecurity(fullUrl);
    if (!sec.isSafe || sec.sanitizedUrl === '#') {
      showToast('Tautan tidak valid atau diblokir demi keamanan.');
      return;
    }

    if (sec.requiresWarning) {
      setExternalUrlWarning(sec.sanitizedUrl);
    } else {
      const newWin = window.open(sec.sanitizedUrl, '_blank', 'noopener,noreferrer');
      if (newWin) newWin.opener = null;
    }
  }, []);

  // Global external link warning prompt listener
  useEffect(() => {
    const handleGlobalExternalPrompt = (e: any) => {
      if (e.detail?.url) {
        setExternalUrlWarning(e.detail.url);
      }
    };
    window.addEventListener('catavor_prompt_external_url', handleGlobalExternalPrompt);
    return () => window.removeEventListener('catavor_prompt_external_url', handleGlobalExternalPrompt);
  }, []);

  // Sync tab state on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'about') {
        setActivePublicTab('about');
      } else {
        setActivePublicTab('catalog');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Fetch Store Profile & Catalog via SWR (Parity with Desktop apiClient)
  const loadStoreData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      // 1A. SWR fetch store settings
      const { data: storeRes } = await apiClient.swr<any>(`/u/${slug}`, {
        ttlMs: 0,
        forceFresh: true,
        slug,
        onFresh: (freshData) => {
          if (freshData?.success && freshData.data) {
            const store = freshData.data;
            const isSuspended = Boolean(store.is_suspended || freshData.is_suspended || store.dormancy_status === 'suspended');
            const fetched = {
              ...store,
              plan: store.plan || 'free',
              store_title: store.store_title || store.name || 'Katalog Resmi',
              store_logo_url: store.store_logo_url || store.logo_url || '',
              store_slogan: store.store_slogan || store.slogan || 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis.',
              store_theme: store.store_theme || 'navy',
              whatsapp_number: store.whatsapp_number || store.phone || '',
              dormancy_status: store.dormancy_status || (isSuspended ? 'suspended' : 'active'),
              is_suspended: isSuspended,
              suspension_reason: store.suspension_reason || 'none'
            };
            setSettings(fetched);
            const theme = fetched.store_theme || 'navy';
            document.documentElement.setAttribute('data-theme', theme);
            document.body.setAttribute('data-theme', theme);
          }
        }
      });

      if (storeRes && storeRes.success && storeRes.data) {
        const store = storeRes.data;
        const isSuspended = Boolean(store.is_suspended || storeRes.is_suspended || store.dormancy_status === 'suspended');
        const fetched = {
          ...store,
          plan: store.plan || 'free',
          store_title: store.store_title || store.name || 'Katalog Resmi',
          store_logo_url: store.store_logo_url || store.logo_url || '',
          store_slogan: store.store_slogan || store.slogan || 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis.',
          store_theme: store.store_theme || 'navy',
          whatsapp_number: store.whatsapp_number || store.phone || '',
          dormancy_status: store.dormancy_status || (isSuspended ? 'suspended' : 'active'),
          is_suspended: isSuspended,
          suspension_reason: store.suspension_reason || 'none'
        };
        setSettings(fetched);
        const theme = fetched.store_theme || 'navy';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);

        // 1B. Fetch products if not suspended
        if (isSuspended) {
          setFaunas([]);
        } else {
          const { data: prodRes } = await apiClient.swr<any>(`/u/${slug}/products`, {
            ttlMs: 15 * 1000,
            slug,
            onFresh: (freshProd) => {
              if (freshProd?.success && Array.isArray(freshProd.data)) {
                setFaunas(freshProd.data);
              }
            }
          });
          if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
            setFaunas(prodRes.data);
          } else {
            setFaunas([]);
          }
        }
      } else {
        setError(storeRes?.message || 'Katalog toko tidak ditemukan atau sedang dinonaktifkan.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat katalog toko.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  // Fetch Server-Side Catalog (Parity with Desktop & Mobile)
  const fetchServerCatalog = useCallback(async (page: number = 1) => {
    if (!slug) return;
    setIsCatalogLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (productTypeFilter !== 'all') params.set('type', productTypeFilter);
      if (classFilter !== 'all') params.set('class', classFilter);
      if (habitatFilter !== 'all') params.set('habitat', habitatFilter);
      if (sortBy) params.set('sort', sortBy);

      const { data: json } = await apiClient.swr<any>(`/u/${slug}/products?${params.toString()}`, {
        ttlMs: 15 * 1000,
        slug,
        onFresh: (freshData) => {
          if (freshData?.success && Array.isArray(freshData.data)) {
            setServerCatalogItems(freshData.data);
            if (freshData.pagination) {
              setServerPagination({
                currentPage: freshData.pagination.current_page || page,
                totalPages: freshData.pagination.total_pages || 1,
                totalItems: freshData.pagination.total_items ?? freshData.data.length,
                hasNext: Boolean(freshData.pagination.has_next),
                hasPrev: Boolean(freshData.pagination.has_prev)
              });
            }
          }
        }
      });

      if (json && json.success && Array.isArray(json.data)) {
        setServerCatalogItems(json.data);
        if (json.pagination) {
          setServerPagination({
            currentPage: json.pagination.current_page || page,
            totalPages: json.pagination.total_pages || 1,
            totalItems: json.pagination.total_items ?? json.data.length,
            hasNext: Boolean(json.pagination.has_next),
            hasPrev: Boolean(json.pagination.has_prev)
          });
        }

        // Anonymous Search Telemetry Beacon (Clean Public Route, Zero PII)
        const totalFound = json.pagination?.total_items ?? json.data.length;
        if (debouncedSearch.trim().length >= 3) {
          try {
            fetch('/api/telemetry/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                keyword: debouncedSearch.trim(),
                store_slug: slug,
                product_type: productTypeFilter !== 'all' ? productTypeFilter : '',
                category_slug: classFilter !== 'all' ? classFilter : '',
                result_count: totalFound,
                is_zero_result: totalFound === 0,
                _hp_check: ''
              }),
              keepalive: true
            }).catch(() => {});
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Gagal memuat katalog server tablet:', err);
    } finally {
      setIsCatalogLoading(false);
    }
  }, [slug, debouncedSearch, productTypeFilter, classFilter, habitatFilter, sortBy]);

  // Trigger server-side fetch on filter or search change
  useEffect(() => {
    if (activePublicTab === 'catalog') {
      fetchServerCatalog(1);
    }
  }, [fetchServerCatalog, activePublicTab]);

  // WhatsApp Contacts Calculation
  const storeWAContacts = useMemo(() => {
    return parseWAContacts(settings?.whatsapp_number);
  }, [settings?.whatsapp_number]);

  const storefrontWA = useMemo(() => {
    return getStorefrontDefaultWA(storeWAContacts, settings?.whatsapp_number);
  }, [storeWAContacts, settings?.whatsapp_number]);

  // Dynamic Product Types & Categories
  const availableProductTypes = useMemo(() => {
    const types = faunas.map(f => (f.product_type || 'physical')).filter(Boolean);
    return Array.from(new Set(types));
  }, [faunas]);

  const availableCategories = useMemo(() => {
    const scopedFaunas = productTypeFilter === 'all'
      ? faunas
      : faunas.filter(f => (f.product_type || 'physical') === productTypeFilter);
    const cats = scopedFaunas.map(f => f.class).filter(Boolean);
    return Array.from(new Set(cats));
  }, [faunas, productTypeFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    faunas.forEach(f => {
      if (productTypeFilter === 'all' || (f.product_type || 'physical') === productTypeFilter) {
        const cat = f.class || 'Lainnya';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [faunas, productTypeFilter]);

  // Filtered & Sorted Products (Server Catalog First, fallback to initial faunas)
  const filteredFaunas = useMemo(() => {
    if (serverCatalogItems.length > 0 || debouncedSearch.trim() || productTypeFilter !== 'all' || classFilter !== 'all' || habitatFilter !== 'all' || sortBy !== 'newest') {
      return serverCatalogItems;
    }
    return faunas;
  }, [serverCatalogItems, faunas, debouncedSearch, productTypeFilter, classFilter, habitatFilter, sortBy]);

  // -------------------------------------------------------------
  // DETAIL PRODUCT FETCHING & FLOW (Identical to Desktop)
  // -------------------------------------------------------------
  const fetchDetails = useCallback(async (id: number) => {
    try {
      const localItem = faunas.find(f => f.id === id) || serverCatalogItems.find(f => f.id === id);
      if (localItem) {
        setSelectedFauna(localItem);
        setActiveImageIndex(0);
        setIsDetailActive(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Update URL search query
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('item', String(id));
        window.history.pushState({}, '', url.toString());
      } catch {}

      // Fetch deep product details via apiClient
      const res = await apiClient.get<any>(`/products/${id}`, { slug });
      if (res && res.success && res.data) {
        if (!localItem) {
          setActiveImageIndex(0);
          setIsDetailActive(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setSelectedFauna(res.data);
      } else if (!localItem) {
        showToast(res?.message || 'Item tidak ditemukan atau sedang dinonaktifkan.');
        handleCloseDetail();
      }
    } catch (err: any) {
      if (!faunas.some(f => f.id === id)) {
        showToast(err?.message || 'Gagal mengambil data detail produk.');
        handleCloseDetail();
      }
    }
  }, [faunas, slug]);

  const handleCloseDetail = useCallback(() => {
    setIsDetailActive(false);
    setSelectedFauna(null);
    setShowPurchaseModal(false);
    setShowDetailActionDropdown(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('item');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  // Auto-open product detail from query params on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const itemParam = params.get('item');
      if (itemParam && !isNaN(Number(itemParam)) && faunas.length > 0) {
        fetchDetails(Number(itemParam));
      }
    }
  }, [faunas.length, fetchDetails]);

  // Native Gesture / Browser Back Interceptor for Detail View
  useModalBackHandler({
    isOpen: isDetailActive,
    onClose: handleCloseDetail,
    modalId: 'tablet-store-detail-view'
  });

  // 3-Tier Waterfall Recommendations (Identical to Desktop)
  const getRecommendations = (fauna: any) => {
    if (!fauna || !faunas || faunas.length <= 1) return [];
    const activeFaunas = faunas.filter(f => f && f.is_active !== false && f.id !== fauna.id);
    if (activeFaunas.length === 0) return [];

    // Tier 1: Same category
    let recs = activeFaunas.filter(f => f.class && f.class === fauna.class);
    // Tier 2: Same product type
    if (recs.length < 4) {
      const sameType = activeFaunas.filter(f => f.product_type === fauna.product_type && !recs.some(r => r.id === f.id));
      recs = [...recs, ...sameType];
    }
    // Tier 3: Other store items
    if (recs.length < 4) {
      const others = activeFaunas.filter(f => !recs.some(r => r.id === f.id));
      recs = [...recs, ...others];
    }
    return recs.slice(0, 4);
  };

  // Actions
  const handleShareStore = () => setShowShareModal(true);

  const handleShareItem = (item: any) => {
    const itemUrl = `${window.location.origin}/${slug}?item=${item.id}`;
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: `Lihat ${item.name} di katalog resmi ${settings?.store_title || 'kami'}:`,
        url: itemUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(itemUrl).then(() => {
        showToast('Tautan produk berhasil disalin!');
      }).catch(() => {
        showToast('Gagal menyalin tautan.');
      });
    }
  };

  const handleReportStore = () => {
    const initialReasons = getCatalogReportReasons('store');
    setReportReason(initialReasons[0]?.id || 'other');
    setReportNotes('');
    setReportEmail('');
    setReportModalData({ type: 'store' });
  };

  const handleReportItem = (item: any) => {
    const initialReasons = getCatalogReportReasons('item');
    setReportReason(initialReasons[0]?.id || 'other');
    setReportNotes('');
    setReportEmail('');
    setReportModalData({ type: 'item', item });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalData) return;
    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: reportModalData.type,
          store_slug: slug,
          item_id: reportModalData.item?.id,
          reason: reportReason,
          notes: reportNotes,
          reporter_email: reportEmail
        })
      });
      if (res.ok) {
        showToast('Laporan berhasil dikirim. Tim Kepatuhan Catavor akan meninjau.');
        setReportModalData(null);
      } else {
        showToast('Gagal mengirim laporan. Silakan coba kembali.');
      }
    } catch {
      showToast('Terjadi kendala jaringan saat mengirim laporan.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Direct WhatsApp Order
  const handleDirectWhatsAppOrder = (item: any, qty: number) => {
    const itemWA = resolveProductWAContact(item, storeWAContacts, settings?.whatsapp_number);
    if (!itemWA.cleanNumber) {
      alert('Nomor WhatsApp admin/agen belum dikonfigurasi di pengaturan katalog.');
      return;
    }
    const unit = getCatalogItemUnit(item);
    const totalPrice = Number(item.price || 0) * qty;
    const message =
      `Halo *${settings?.store_title || 'Toko'}*, saya ingin memesan produk berikut dari katalog:\n\n` +
      `*${item.name}*\n` +
      `Jumlah: ${qty} ${unit}\n` +
      `Harga Satuan: ${formatRupiah(item.price)}\n` +
      `Total Estimasi: ${formatRupiah(totalPrice)}\n` +
      `Status: ${item.conservation_status || 'Tersedia'}\n` +
      `Tautan: ${window.location.origin}/${slug}?item=${item.id}\n\n` +
      `Apakah pesanan ini dapat diproses? Terima kasih!`;

    window.open(buildWALink(itemWA.cleanNumber, message), '_blank', 'noopener,noreferrer');
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenCardActionMenuId(null);
      setShowDetailActionDropdown(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Back handler for modals
  useModalBackHandler({
    isOpen: showShareModal,
    onClose: () => setShowShareModal(false),
    modalId: 'tablet-share-catalog-modal'
  });

  useModalBackHandler({
    isOpen: Boolean(reportModalData),
    onClose: () => setReportModalData(null),
    modalId: 'tablet-report-modal'
  });

  useModalBackHandler({
    isOpen: showPurchaseModal,
    onClose: () => setShowPurchaseModal(false),
    modalId: 'tablet-purchase-options-modal'
  });

  // -------------------------------------------------------------
  // RENDER: Loading State
  // -------------------------------------------------------------
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        gap: '1rem'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid var(--primary-glow)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Memuat Katalog Digital...
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Error / Not Found State
  // -------------------------------------------------------------
  if (error || !settings) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <StoreIcon size={34} />
        </div>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
          Katalog Tidak Ditemukan
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
          {error || 'Alamat tautan katalog tidak sesuai atau profil toko telah dinonaktifkan sementara.'}
        </p>
        <button
          type="button"
          onClick={() => {
            if (onBackToExplore) onBackToExplore();
            else window.location.href = window.location.origin;
          }}
          style={{
            minHeight: '44px',
            padding: '0.65rem 1.6rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: '0 2px 10px var(--primary-glow)'
          }}
        >
          Ke Halaman Utama Portal
        </button>
      </div>
    );
  }

  const isStoreSuspended = settings.dormancy_status === 'suspended' || settings.is_suspended;

  // =============================================================
  // RENDER: FULL-PAGE DETAIL VIEW (PARITY WITH DESKTOP)
  // =============================================================
  if (isDetailActive && selectedFauna) {
    const galleryImages: string[] = (selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 0)
      ? selectedFauna.detailed_info.images
      : (selectedFauna.image_url ? [selectedFauna.image_url] : []);
    const totalGalleryImages = galleryImages.length;
    const currentImgIdx = Math.min(activeImageIndex, Math.max(0, totalGalleryImages - 1));
    const currentImageSrc = galleryImages[currentImgIdx] || selectedFauna.image_url || 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
    const actionConfig = getItemActionConfig(selectedFauna);
    const ActionIcon = actionConfig.Icon;
    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
    const itemUnit = getCatalogItemUnit(selectedFauna);

    const renderSpecRow = (label: string, value: React.ReactNode, isHighlight = false) => {
      if (!isNonEmptyValue(value)) return null;

      let renderedValue = value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^(https?:\/\/|www\.)[^\s]+$/i.test(trimmed)) {
          const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed
            : `https://${trimmed}`;
          renderedValue = (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleSafeExternalRedirect(fullUrl, e)}
              style={{
                color: 'var(--primary)',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
              title={`Buka tautan ${trimmed}`}
            >
              <span>{trimmed}</span>
              <ExternalLink size={12} style={{ flexShrink: 0 }} />
            </a>
          );
        }
      }

      return (
        <div
          key={label}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 150px) 1fr',
            gap: '0.85rem',
            alignItems: 'baseline',
            padding: '0.55rem 0',
            borderBottom: '1px solid var(--border-light)',
            fontSize: '0.86rem',
            lineHeight: 1.45
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            {label}
          </span>
          <span style={{
            fontWeight: 700,
            color: isHighlight ? 'var(--primary)' : 'var(--text-primary)',
            textAlign: 'right',
            wordBreak: 'break-word',
            letterSpacing: '0.01em'
          }}>
            {renderedValue}
          </span>
        </div>
      );
    };

    return (
      <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
        {/* Sticky Detail Top Bar */}
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          backdropFilter: 'blur(16px)'
        }}>
          {/* Left: Back Button & Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              type="button"
              onClick={handleCloseDetail}
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Kembali ke Katalog"
            >
              <ArrowLeft size={18} />
            </button>

            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem' }}>
              <span
                onClick={handleCloseDetail}
                style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                title="Ke Katalog Utama"
              >
                Katalog
              </span>
              <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {selectedFauna.class ? selectedFauna.class.toUpperCase() : 'PRODUK'}
              </span>
              <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--primary)', fontWeight: 800, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFauna.name}
              </span>
            </nav>
          </div>

          {/* Right: Actions Menu */}
          <div style={{ position: 'relative' }} ref={detailActionDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailActionDropdown(prev => !prev);
              }}
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: showDetailActionDropdown ? 'var(--primary-glow)' : 'var(--bg-card-hover)',
                border: showDetailActionDropdown ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                borderRadius: '10px',
                color: showDetailActionDropdown ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Opsi Produk"
            >
              <MoreVertical size={18} />
            </button>

            {showDetailActionDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '180px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                  padding: '0.35rem',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailActionDropdown(false);
                    handleShareItem(selectedFauna);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    width: '100%',
                    padding: '0.55rem 0.65rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    background: 'none',
                    border: 'none',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Share2 size={14} color="var(--primary)" />
                  <span>Bagikan Item</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDetailActionDropdown(false);
                    handleReportItem(selectedFauna);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    width: '100%',
                    padding: '0.55rem 0.65rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Flag size={14} />
                  <span>Laporkan Item</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail Content (Tablet 2-Column Responsive Flow) */}
        <div style={{ flex: 1, padding: '1.75rem 1.5rem 120px', maxWidth: '1024px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: '2rem', alignItems: 'start' }}>
            {/* Left Column: Media Gallery */}
            <div style={{ position: 'sticky', top: '80px' }}>
              <div style={{
                position: 'relative',
                borderRadius: '1.15rem',
                overflow: 'hidden',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
              }}>
                <img
                  src={currentImageSrc}
                  alt={selectedFauna.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    display: 'block',
                    cursor: 'zoom-in'
                  }}
                  onClick={() => {
                    setLightboxIndex(currentImgIdx);
                    setShowLightbox(true);
                  }}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                  }}
                />

                {/* Floating Prev Button */}
                {totalGalleryImages > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((currentImgIdx - 1 + totalGalleryImages) % totalGalleryImages);
                    }}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(15, 23, 42, 0.72)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(8px)',
                      zIndex: 5
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {/* Floating Next Button */}
                {totalGalleryImages > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((currentImgIdx + 1) % totalGalleryImages);
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(15, 23, 42, 0.72)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(8px)',
                      zIndex: 5
                    }}
                  >
                    <ChevronRight size={20} />
                  </button>
                )}

                {/* Counter Pill */}
                {totalGalleryImages > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 5
                  }}>
                    {currentImgIdx + 1} / {totalGalleryImages}
                  </div>
                )}

                {/* Zoom Hint */}
                <div style={{
                  position: 'absolute',
                  bottom: '0.75rem',
                  left: '0.75rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.65)',
                  color: '#ffffff',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backdropFilter: 'blur(8px)',
                  zIndex: 5
                }}>
                  <ZoomIn size={12} />
                  <span>Perbesar Foto</span>
                </div>
              </div>

              {/* Thumbnail Track */}
              {totalGalleryImages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        padding: 0,
                        border: idx === currentImgIdx ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        width: '56px',
                        height: '56px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-deep)'
                      }}
                    >
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Product Info & Specs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.45rem', letterSpacing: '-0.02em' }}>
                  {formatRupiah(selectedFauna.price)}
                </div>

                {/* Badges Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {selectedFauna.conservation_status && (
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: selectedFauna.conservation_status === 'Habis Terjual'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : selectedFauna.conservation_status === 'Pre-Order'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                      color: selectedFauna.conservation_status === 'Habis Terjual'
                        ? '#ef4444'
                        : selectedFauna.conservation_status === 'Pre-Order'
                        ? '#f59e0b'
                        : '#22c55e',
                      border: `1px solid ${selectedFauna.conservation_status === 'Habis Terjual' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                      {selectedFauna.conservation_status}
                    </span>
                  )}

                  {minOrderVal > 1 && (
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(37, 99, 235, 0.12)',
                      color: '#60a5fa',
                      border: '1px solid rgba(37, 99, 235, 0.3)'
                    }}>
                      Min. Beli: {minOrderVal} {itemUnit}
                    </span>
                  )}
                </div>

                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', lineHeight: 1.3 }}>
                  {selectedFauna.name}
                </h1>

                {isNonEmptyValue(selectedFauna.scientific_name) && (
                  <div style={{ fontStyle: 'italic', fontSize: '0.92rem', color: 'var(--primary)', marginBottom: '0.85rem' }}>
                    {selectedFauna.scientific_name}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Kategori:</span>
                  <span style={{
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)'
                  }}>
                    {selectedFauna.class ? selectedFauna.class.toUpperCase() : 'UMUM'}
                  </span>
                </div>
              </div>

              {/* Structured Specifications Section */}
              <div style={{
                backgroundColor: 'var(--bg-deep)',
                borderRadius: '0.85rem',
                border: '1px solid var(--border-light)',
                padding: '1rem 1.25rem'
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.65rem 0' }}>
                  Spesifikasi Item
                </h3>

                <div>
                  {selectedFauna.product_type === 'property' && (
                    <>
                      {renderSpecRow('Tipe Transaksi', selectedFauna.attributes?.transaction_type || 'Dijual', true)}
                      {renderSpecRow('Tipe Properti', selectedFauna.class || selectedFauna.attributes?.property_type)}
                      {renderSpecRow('Sertifikat / Legalitas', selectedFauna.attributes?.certificate)}
                      {renderSpecRow('Luas Tanah (LT)', isNonEmptyValue(selectedFauna.attributes?.land_area) ? `${selectedFauna.attributes.land_area} m²` : null)}
                      {renderSpecRow('Luas Bangunan (LB)', isNonEmptyValue(selectedFauna.attributes?.building_area) ? `${selectedFauna.attributes.building_area} m²` : null)}
                      {renderSpecRow('Kamar Tidur (KT)', selectedFauna.attributes?.bedrooms)}
                      {renderSpecRow('Kamar Mandi (KM)', selectedFauna.attributes?.bathrooms)}
                      {renderSpecRow('Lokasi Wilayah', selectedFauna.attributes?.property_location || selectedFauna.habitat)}
                    </>
                  )}

                  {selectedFauna.product_type === 'food' && (
                    <>
                      {renderSpecRow('Status Halal', selectedFauna.attributes?.halal_status, true)}
                      {renderSpecRow('Kategori Menu', selectedFauna.class)}
                      {renderSpecRow('Pilihan Varian', selectedFauna.attributes?.variant)}
                      {renderSpecRow('Daya Simpan', selectedFauna.attributes?.shelf_life)}
                    </>
                  )}

                  {selectedFauna.product_type === 'service' && (
                    <>
                      {renderSpecRow('Jenis Layanan', selectedFauna.class, true)}
                      {renderSpecRow('Estimasi Durasi', selectedFauna.attributes?.duration)}
                      {renderSpecRow('Cakupan Wilayah', selectedFauna.attributes?.service_area || selectedFauna.habitat)}
                    </>
                  )}

                  {selectedFauna.product_type === 'digital' && (
                    <>
                      {renderSpecRow('Format Berkas', selectedFauna.attributes?.file_format, true)}
                      {renderSpecRow('Ukuran File', selectedFauna.attributes?.file_size)}
                      {renderSpecRow('Tipe Lisensi', selectedFauna.attributes?.license_type)}
                    </>
                  )}

                  {selectedFauna.product_type === 'plant' && (
                    <>
                      {renderSpecRow('Kebutuhan Cahaya', selectedFauna.attributes?.sunlight, true)}
                      {renderSpecRow('Penyiraman', selectedFauna.attributes?.watering)}
                      {renderSpecRow('Media Tanam', selectedFauna.attributes?.planting_medium)}
                      {renderSpecRow('Ukuran / Tinggi', selectedFauna.attributes?.plant_size)}
                    </>
                  )}

                  {selectedFauna.product_type === 'fauna' && (
                    <>
                      {renderSpecRow('Status Karakter', selectedFauna.attributes?.temperament, true)}
                      {renderSpecRow('Kebutuhan Pakan', selectedFauna.attributes?.diet)}
                      {renderSpecRow('Daerah Asal', selectedFauna.habitat)}
                      {renderSpecRow('Garansi Hidup', selectedFauna.attributes?.live_guarantee)}
                    </>
                  )}

                  {(!selectedFauna.product_type || selectedFauna.product_type === 'physical') && (
                    <>
                      {renderSpecRow('Kondisi Barang', selectedFauna.attributes?.condition || 'Baru', true)}
                      {renderSpecRow('Berat Pengiriman', selectedFauna.attributes?.weight ? `${selectedFauna.attributes.weight} gram` : null)}
                      {renderSpecRow('Bahan / Material', selectedFauna.attributes?.material)}
                      {renderSpecRow('Garansi', selectedFauna.attributes?.warranty)}
                    </>
                  )}

                  {renderSpecRow('Minimal Pemesanan', `${minOrderVal} ${itemUnit}`)}
                  {maxOrderVal && renderSpecRow('Maksimal Pemesanan', `${maxOrderVal} ${itemUnit}`)}
                </div>
              </div>

              {/* Product Description */}
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                  Deskripsi Lengkap
                </h3>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  <FormattedText text={selectedFauna.description || 'Tidak ada deskripsi rinci untuk produk ini.'} />
                </div>
              </div>

              {/* Important Information with Dynamic Contextual Action Buttons & Policy Guidance */}
              <ProductImportantInfoSection item={selectedFauna} isMobile={false} />

              {/* Video Embed Player if available */}
              {selectedFauna.video_url && (
                <div style={{ marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                    Video Preview Produk
                  </h3>
                  <VideoPlayerEmbed url={selectedFauna.video_url} title={`Video ${selectedFauna.name}`} />
                </div>
              )}
            </div>
          </div>

          {/* Recommendations Section (Koleksi Serupa) */}
          {(() => {
            const recs = getRecommendations(selectedFauna);
            if (!recs || recs.length === 0) return null;
            return (
              <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-light)', paddingTop: '2rem' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '999px',
                    backgroundColor: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: '0.4rem'
                  }}>
                    <Sparkles size={12} />
                    <span>Koleksi Serupa &amp; Pilihan</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Rekomendasi Item Lainnya
                  </h3>
                </div>

                <div className="tablet-recs-grid">
                  {recs.map(rec => (
                    <div
                      key={rec.id}
                      onClick={() => fetchDetails(rec.id)}
                      className="tablet-catalog-card"
                    >
                      {/* Product Thumbnail with Badges */}
                      <div style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <img
                          src={rec.image_url}
                          alt={rec.name}
                          className="tablet-card-thumb-img"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                          }}
                        />

                        {/* Top-Left Badges */}
                        <div style={{
                          position: 'absolute',
                          top: '0.65rem',
                          left: '0.65rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          alignItems: 'flex-start',
                          zIndex: 2,
                          maxWidth: 'calc(100% - 1.2rem)'
                        }}>
                          {rec.class && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(0, 0, 0, 0.72)',
                              color: '#ffffff',
                              backdropFilter: 'blur(8px)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}>
                              {rec.class}
                            </span>
                          )}

                          {rec.conservation_status && rec.conservation_status !== 'Tersedia' && (
                            <div style={{
                              padding: '0.18rem 0.55rem',
                              borderRadius: '6px',
                              backgroundColor: rec.conservation_status === 'Habis Terjual'
                                ? 'rgba(239, 68, 68, 0.92)'
                                : rec.conservation_status === 'Pre-Order'
                                ? 'rgba(217, 119, 6, 0.92)'
                                : rec.conservation_status === 'Buka Jadwal'
                                ? 'rgba(124, 58, 237, 0.92)'
                                : 'rgba(59, 130, 246, 0.92)',
                              backdropFilter: 'blur(8px)',
                              color: '#ffffff',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                              <span>{rec.conservation_status}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info & Price (Equal-Height Baseline) */}
                      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: '0 0 0.35rem 0',
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            minHeight: '2.7em'
                          }}>
                            {rec.name}
                          </h4>

                          <div style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: 'var(--primary)',
                            letterSpacing: '-0.01em',
                            marginBottom: '0.5rem'
                          }}>
                            {formatRupiah(Number(rec.price || 0))}
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid var(--border-light)',
                          marginTop: 'auto',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)'
                        }}>
                          <span style={{
                            fontWeight: 600,
                            color: rec.conservation_status === 'Habis Terjual'
                              ? '#ef4444'
                              : rec.conservation_status === 'Pre-Order'
                              ? '#f59e0b'
                              : 'var(--text-secondary)'
                          }}>
                            {rec.conservation_status || (rec.stock > 0 ? `Stok: ${rec.stock}` : 'Tersedia')}
                          </span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            Rincian &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Sticky Bottom Action Bar (Identical to Desktop) */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border-light)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Harga Produk
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
              {formatRupiah(selectedFauna.price)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleCloseDetail}
              style={{
                minHeight: '44px',
                padding: '0 1.25rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPurchaseQty(minOrderVal);
                setShowPurchaseModal(true);
              }}
              style={{
                minHeight: '44px',
                padding: '0 1.65rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px var(--primary-glow)'
              }}
            >
              <ActionIcon size={17} />
              <span>{actionConfig.fullLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareItem(selectedFauna)}
              style={{
                minHeight: '44px',
                padding: '0 1.15rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <Share2 size={16} />
              <span>Bagikan</span>
            </button>
          </div>
        </div>

        {/* Purchase Options Dialog */}
        {showPurchaseModal && (
          <div
            onClick={() => setShowPurchaseModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1.5rem'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '1.15rem',
                border: '1px solid var(--border-light)',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{
                padding: '1.15rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <ShoppingCart size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Pemesanan Produk
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <img src={selectedFauna.image_url} alt="" style={{ width: '60px', height: '60px', borderRadius: '0.65rem', objectFit: 'cover' }} />
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedFauna.name}
                    </h4>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {formatRupiah(selectedFauna.price)}
                    </div>
                  </div>
                </div>

                {/* Quantity Selector */}
                {selectedFauna.product_type !== 'property' && selectedFauna.product_type !== 'service' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-deep)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-light)'
                  }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Jumlah ({itemUnit}):
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <button
                        type="button"
                        disabled={purchaseQty <= minOrderVal}
                        onClick={() => setPurchaseQty(prev => Math.max(minOrderVal, prev - 1))}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: purchaseQty <= minOrderVal ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                        {purchaseQty}
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(maxOrderVal && purchaseQty >= maxOrderVal)}
                        onClick={() => setPurchaseQty(prev => (maxOrderVal ? Math.min(maxOrderVal, prev + 1) : prev + 1))}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: maxOrderVal && purchaseQty >= maxOrderVal ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Subtotal */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Total Estimasi:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatRupiah(Number(selectedFauna.price || 0) * purchaseQty)}
                  </span>
                </div>

                {/* Action Buttons */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    handleDirectWhatsAppOrder(selectedFauna, purchaseQty);
                  }}
                  style={{
                    minHeight: '46px',
                    borderRadius: '0.65rem',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <MessageCircle size={18} />
                  <span>Kirim Pesanan ke WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox for zooming photos */}
        <TabletImageLightbox
          isOpen={showLightbox}
          images={galleryImages}
          initialIndex={lightboxIndex}
          productName={selectedFauna.name}
          onClose={() => setShowLightbox(false)}
        />
      </div>
    );
  }

  // =============================================================
  // RENDER: MAIN PUBLIC STOREFRONT VIEW
  // =============================================================
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      paddingBottom: '3.5rem'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          padding: '0.65rem 1.25rem',
          borderRadius: '999px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-light)',
          fontSize: '0.86rem',
          fontWeight: 700,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={16} color="var(--primary)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Halaman Publik (Identical to Desktop) */}
      <header style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-light)',
        zIndex: 90
      }}>
        <div style={{
          maxWidth: '1024px',
          margin: '0 auto',
          padding: isTabletMini ? '0.75rem 1rem' : '0.85rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          {/* Left: Brand Catavor + Badge Platform Katalog (Parity with Desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s ease'
              }}
              title="Catavor - Platform Katalog Digital"
            >
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 850,
                color: 'var(--primary)',
                letterSpacing: '-0.025em',
                fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
                textShadow: '0 0 16px var(--primary-glow)',
                lineHeight: 1
              }}>
                Catavor
              </span>
            </a>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.18rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'var(--primary-glow)',
              color: 'var(--primary)',
              border: '1px solid var(--border-light)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              display: 'inline-flex',
              alignItems: 'center'
            }}>
              Platform Katalog
            </span>
          </div>

          {/* Right: Share & Report Actions (Parity with Desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleShareStore}
              style={{
                minHeight: '40px',
                padding: '0 1rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Bagikan Profil Katalog Ini"
            >
              <Share2 size={15} color="var(--primary)" />
              <span>Bagikan</span>
            </button>

            <button
              type="button"
              onClick={handleReportStore}
              style={{
                minHeight: '40px',
                padding: '0 0.85rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Laporkan Profil / Katalog Toko Ini"
            >
              <Flag size={14} />
              <span>Laporkan</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Tablet Brand Showcase Hero (Parity with Desktop: Shown on Catalog view, actions on the right) */}
      {!isStoreSuspended && activePublicTab === 'catalog' && (
        <section style={{
          maxWidth: '1024px',
          margin: '1.5rem auto 1.25rem auto',
          padding: isTabletMini ? '0 1rem' : '0 1.5rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isTabletMini ? '1.25rem' : '1.65rem',
            boxShadow: 'var(--shadow-premium, 0 4px 20px rgba(0, 0, 0, 0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            flexWrap: 'wrap'
          }}>
            {/* Brand Left: Avatar + Title + Slogan + Badges */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flex: 1, minWidth: isTabletMini ? '240px' : '280px' }}>
              <div style={{
                width: isTabletMini ? '64px' : '76px',
                height: isTabletMini ? '64px' : '76px',
                borderRadius: '1.15rem',
                backgroundColor: 'var(--primary-glow)',
                border: '2px solid var(--primary)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--primary)',
                fontWeight: 900,
                fontSize: isTabletMini ? '1.5rem' : '1.85rem'
              }}>
                {settings.store_logo_url ? (
                  <img src={settings.store_logo_url} alt={settings.store_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (settings.store_title || slug || 'C').charAt(0).toUpperCase()
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontSize: isTabletMini ? '1.25rem' : '1.45rem',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25
                  }}>
                    {settings.store_title || 'Katalog Resmi'}
                  </h1>

                  {settings.plan === 'pro_business' && (
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      PRO BISNIS
                    </span>
                  )}
                </div>

                <p style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.45,
                  maxWidth: '560px'
                }}>
                  {settings.store_slogan || settings.about_slogan || 'Koleksi produk dan layanan unggulan dengan kualitas terbaik dan pemesanan mudah via WhatsApp.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Package size={14} style={{ color: 'var(--primary)' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>{faunas.length}</strong> Total Item
                  </span>

                  {settings.about_location && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={14} style={{ color: '#38bdf8' }} />
                      <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {settings.about_location}
                      </span>
                    </span>
                  )}

                  {settings.show_hours && (
                    <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                      <Clock size={14} /> Buka Layanan
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CTAs on the Right (Parity with Desktop: Hubungi Penjual & Tentang Kami on the right) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              {storefrontWA.cleanNumber && (
                <a
                  href={buildWALink(storefrontWA.cleanNumber, `Halo ${settings.store_title || 'Admin'}, saya ingin bertanya mengenai produk di katalog Anda.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: '44px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px var(--primary-glow)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MessageCircle size={17} />
                  <span>Hubungi Penjual</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedFauna(null);
                  setIsDetailActive(false);
                  setActivePublicTab('about');
                  if (slug) {
                    window.history.pushState({}, '', `/${slug}?tab=about`);
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="btn-secondary"
                style={{
                  minHeight: '44px',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Lihat Profil & Informasi Lengkap"
              >
                <Info size={16} style={{ color: 'var(--primary)' }} />
                <span>Tentang Kami</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Suspended Catalog State */}
      {isStoreSuspended && (
        <section style={{ maxWidth: '1024px', margin: '2rem auto', padding: isTabletMini ? '0 1rem' : '0 1.5rem' }}>
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: 'rgba(225, 29, 72, 0.08)',
              border: '1px solid rgba(225, 29, 72, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48'
            }}>
              <ShieldAlert size={34} />
            </div>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.8rem',
                borderRadius: '20px',
                backgroundColor: 'rgba(225, 29, 72, 0.08)',
                border: '1px solid rgba(225, 29, 72, 0.2)',
                color: '#e11d48',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                marginBottom: '0.75rem'
              }}>
                Status: Ditangguhkan Sementara
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Profil Katalog Sedang Ditangguhkan Sementara
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Akses publik ke katalog ini dinonaktifkan sementara oleh Tim Kepatuhan platform sehubungan dengan proses peninjauan kebijakan komunitas.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. TAB CONTENT: TENTANG KAMI (PARITY WITH DESKTOP + TABLET RESPONSIVE ADAPTATION) */}
      {!isStoreSuspended && activePublicTab === 'about' && (() => {
        const parsedCards = (() => {
          try {
            return settings.about_cards ? (typeof settings.about_cards === 'string' ? JSON.parse(settings.about_cards) : settings.about_cards) : [];
          } catch {
            return [];
          }
        })();

        const getPremiumIcon = (card: any) => {
          if (card.icon) {
            return renderAboutIcon(card.icon, 22);
          }
          const t = (card.title || '').toLowerCase();
          if (t.includes('sehat') || t.includes('garansi') || t.includes('kesehatan') || t.includes('kualitas')) {
            return renderAboutIcon('shield', 22);
          }
          if (t.includes('aman') || t.includes('transaksi') || t.includes('bayar') || t.includes('percaya')) {
            return renderAboutIcon('lock', 22);
          }
          if (t.includes('tanya') || t.includes('konsultasi') || t.includes('care') || t.includes('layanan') || t.includes('pelanggan')) {
            return renderAboutIcon('message', 22);
          }
          return renderAboutIcon('compass', 22);
        };

        const hasTitle = Boolean(settings.about_title && settings.about_title.trim());
        const hasSlogan = Boolean(settings.about_slogan && settings.about_slogan.trim());
        const hasDescription = Boolean(settings.about_description && settings.about_description.trim());
        const hasCards = Array.isArray(parsedCards) && parsedCards.length > 0;

        const parsedSocial = (() => {
          try {
            return settings.social_links ? (typeof settings.social_links === 'string' ? JSON.parse(settings.social_links) : settings.social_links) : [];
          } catch {
            return [];
          }
        })();

        const hasLocation = Boolean(settings.about_location && settings.about_location.trim());
        const hasHours = Boolean(settings.show_hours === true);
        const hasWhatsapp = Boolean(storefrontWA.cleanNumber);
        const hasWebsite = Boolean(settings.official_website && settings.official_website.trim());
        const hasSocial = Array.isArray(parsedSocial) && parsedSocial.length > 0;
        const hasAnyContactChannel = hasLocation || hasHours || hasWhatsapp || hasWebsite || hasSocial;

        return (
          <div className="animate-fade-in" style={{ maxWidth: '1024px', margin: '1.5rem auto 3rem auto', padding: isTabletMini ? '0 1rem' : '0 1.5rem' }}>
            {/* Top Navigation & Action Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              marginBottom: '1.5rem',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.04)',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              {/* Left: Back Button & Breadcrumbs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const currentSlug = slug || settings?.slug || '';
                    smartBack(() => {
                      setActivePublicTab('catalog');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      if (currentSlug) {
                        window.history.replaceState({}, '', `/${currentSlug}`);
                      }
                    });
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Kembali ke Daftar Katalog Produk"
                >
                  <ArrowLeft size={16} />
                  <span>Kembali ke Katalog ({faunas.length} Item)</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Katalog</span>
                  <span>/</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{settings.store_title || 'Katalog'}</span>
                  <span>/</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Info size={14} /> Tentang Kami
                  </span>
                </div>
              </div>

              {/* Right: Quick Action CTAs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {storefrontWA.cleanNumber && (
                  <a
                    href={buildWALink(storefrontWA.cleanNumber, `Halo ${settings.store_title || 'Admin'}, saya ingin bertanya mengenai profil dan layanan di katalog Anda.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      minHeight: '44px',
                      textDecoration: 'none',
                      padding: '0.55rem 1.15rem',
                      fontSize: '0.84rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      backgroundColor: 'var(--primary)',
                      borderColor: 'var(--primary)',
                      color: '#ffffff',
                      boxShadow: '0 2px 8px var(--primary-glow)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <MessageCircle size={16} />
                    <span>Hubungi Penjual</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleShareStore}
                  style={{
                    minHeight: '44px',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Bagikan Tautan Profil & QR Katalog"
                >
                  <Share2 size={16} style={{ color: 'var(--primary)' }} />
                  <span>Bagikan Profil</span>
                </button>
              </div>
            </div>

            {/* 2-Column Bento Grid Layout with Tablet Mini Fallback */}
            <div className="tablet-about-bento" style={isTabletMini ? { gridTemplateColumns: '1fr', gap: '1.25rem' } : undefined}>
              {/* LEFT COLUMN: Narrative & Value Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                {/* Card 1: Profil & Cerita Toko */}
                <div className="tablet-bento-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-light)' }}>
                      {settings.store_logo_url ? (
                        <img src={settings.store_logo_url} alt={settings.store_title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '11px' }} />
                      ) : (
                        <Info size={24} />
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                          {hasTitle ? settings.about_title : `Tentang ${settings.store_title || 'Catavor'}`}
                        </h2>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-light)' }}>
                          <CheckCircle2 size={12} /> Resmi
                        </span>
                      </div>
                      {hasSlogan && (
                        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                          {settings.about_slogan}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description with FormattedText for Link Interactivity */}
                  {hasDescription ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.75', marginTop: '1.25rem' }}>
                      <FormattedText text={settings.about_description || ''} />
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.6', marginTop: '1.25rem', fontStyle: 'italic' }}>
                      Selamat datang di katalog resmi {settings.store_title || 'kami'}. Jelajahi beragam produk berkualitas terbaik dengan pemesanan langsung melalui WhatsApp.
                    </div>
                  )}
                </div>

                {/* Card 2: Value Cards (Why Choose Us) */}
                {hasCards && (
                  <div className="tablet-bento-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ShieldCheck size={18} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            Keunggulan &amp; Standar Layanan
                          </h3>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.2rem 0.6rem', borderRadius: '6px', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)' }}>
                        {parsedCards.length} Komitmen
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isTabletMini ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
                      {parsedCards.map((card: any, idx: number) => (
                        <div key={idx} className="tablet-about-value-card">
                          <div style={{ backgroundColor: 'var(--primary-glow)', borderRadius: '0.65rem', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-light)', color: 'var(--primary)' }}>
                            {getPremiumIcon(card)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', marginTop: '0.1rem' }}>
                              {cleanEmoji(card.title || '')}
                            </h4>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                              {card.content || card.description || ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Disclaimer Card */}
                {settings.about_disclaimer && (
                  <div style={{
                    backgroundColor: 'rgba(2, 132, 199, 0.04)',
                    borderRadius: '0.85rem',
                    border: '1px solid var(--border-light)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                  }}>
                    <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                        Ketentuan &amp; Penafian Resmi
                      </strong>
                      <FormattedText text={settings.about_disclaimer} />
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Official Channels & Quick Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                {/* Card: Saluran Resmi & Kontak */}
                {hasAnyContactChannel && (
                  <div className="tablet-bento-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                          Saluran Resmi &amp; Kontak
                        </h3>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          Informasi alamat, jam buka, dan komunikasi
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      {/* Lokasi / Alamat */}
                      {hasLocation && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: '0.95rem 1.1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }}>
                            <MapPin size={17} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                              Lokasi / Alamat Resmi
                            </span>
                            <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.5' }}>
                              <FormattedText text={settings.about_location || ''} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Jam Operasional */}
                      {hasHours && <OperationalHoursCard rawHours={settings.about_hours} />}

                      {/* WhatsApp Contacts */}
                      {hasWhatsapp && <WhatsAppContactsCard rawWhatsappNumber={settings.whatsapp_number} />}

                      {/* Official Website */}
                      {hasWebsite && (
                        <OfficialWebsiteCard 
                          url={settings.official_website} 
                          onSafeRedirect={handleSafeExternalRedirect} 
                        />
                      )}

                      {/* Social Media Section */}
                      {hasSocial && (
                        <SocialMediaSection 
                          rawSocialLinks={settings.social_links} 
                          onSafeRedirect={handleSafeExternalRedirect} 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. TAB CONTENT: KATALOG PRODUK */}
      {!isStoreSuspended && activePublicTab === 'catalog' && (
        <section style={{ maxWidth: '1024px', margin: '0 auto', padding: isTabletMini ? '0 1rem' : '0 1.5rem' }}>
          {faunas.length === 0 ? (
            <div style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              borderRadius: '1.15rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}>
                <Layers size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                  Katalog Masih Kosong
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.55 }}>
                  Pengelola katalog <strong>{settings.store_title}</strong> belum mempublikasikan item ke dalam katalog ini. Silakan kunjungi kembali nanti!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar 2-Tier */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                padding: '1.15rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {/* Tier 1: Search + Category + Sort */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    position: 'relative',
                    flex: 1,
                    minWidth: '220px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem' }} />
                    <input
                      type="text"
                      placeholder="Cari item dalam katalog..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0 2.2rem 0 2.5rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.25rem'
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <TabletCustomSelect
                    value={classFilter}
                    onChange={(val) => setClassFilter(val)}
                    options={[
                      {
                        value: 'all',
                        label: 'Semua Kategori',
                        count: faunas.length
                      },
                      ...availableCategories.map(cat => ({
                        value: cat,
                        label: cat,
                        count: categoryCounts[cat] ?? 0
                      }))
                    ]}
                    placeholder="Semua Kategori"
                    ariaLabel="Filter Kategori Produk"
                    style={{ minWidth: '165px' }}
                  />

                  <TabletCustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(val as any)}
                    options={[
                      { value: 'newest', label: 'Terbaru' },
                      { value: 'price_asc', label: 'Harga: Termurah' },
                      { value: 'price_desc', label: 'Harga: Tertinggi' },
                      { value: 'name_asc', label: 'Nama (A-Z)' },
                      { value: 'oldest', label: 'Terlama' }
                    ]}
                    placeholder="Urutan Produk"
                    ariaLabel="Urutan Produk"
                    style={{ minWidth: '150px' }}
                  />
                </div>

                {/* Tier 2: Product Type Chips */}
                {availableProductTypes.length > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    paddingBottom: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => { setProductTypeFilter('all'); setClassFilter('all'); }}
                      style={{
                        minHeight: '36px',
                        padding: '0 0.85rem',
                        borderRadius: '999px',
                        backgroundColor: productTypeFilter === 'all' ? 'var(--primary)' : 'var(--bg-deep)',
                        color: productTypeFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                        border: productTypeFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Layers size={13} />
                      <span>Semua ({faunas.length})</span>
                    </button>

                    {availableProductTypes.includes('physical') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('physical'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'physical' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'physical' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'physical' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Package size={13} />
                        <span>Barang ({faunas.filter(f => (f.product_type || 'physical') === 'physical').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('food') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('food'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'food' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'food' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'food' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Utensils size={13} />
                        <span>Kuliner ({faunas.filter(f => f.product_type === 'food').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('service') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('service'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'service' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'service' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'service' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Wrench size={13} />
                        <span>Jasa ({faunas.filter(f => f.product_type === 'service').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('digital') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('digital'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'digital' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'digital' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'digital' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <FileCode size={13} />
                        <span>Digital ({faunas.filter(f => f.product_type === 'digital').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('fauna') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('fauna'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'fauna' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'fauna' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'fauna' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <PawPrint size={13} />
                        <span>Hewan ({faunas.filter(f => f.product_type === 'fauna').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('plant') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('plant'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'plant' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'plant' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'plant' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Sprout size={13} />
                        <span>Tanaman ({faunas.filter(f => f.product_type === 'plant').length})</span>
                      </button>
                    )}

                    {availableProductTypes.includes('property') && (
                      <button
                        type="button"
                        onClick={() => { setProductTypeFilter('property'); setClassFilter('all'); }}
                        style={{
                          minHeight: '36px',
                          padding: '0 0.85rem',
                          borderRadius: '999px',
                          backgroundColor: productTypeFilter === 'property' ? 'var(--primary)' : 'var(--bg-deep)',
                          color: productTypeFilter === 'property' ? '#ffffff' : 'var(--text-secondary)',
                          border: productTypeFilter === 'property' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Building2 size={13} />
                        <span>Properti ({faunas.filter(f => f.product_type === 'property').length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Counter & Reset Filter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', padding: '0 0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{serverPagination.totalItems > 0 ? `${((serverPagination.currentPage - 1) * 15) + 1} - ${Math.min(serverPagination.currentPage * 15, serverPagination.totalItems)} dari ${serverPagination.totalItems}` : `${filteredFaunas.length} dari ${faunas.length}`}</strong> item
                </span>
                {(search || classFilter !== 'all' || productTypeFilter !== 'all' || sortBy !== 'newest') && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setClassFilter('all'); setProductTypeFilter('all'); setSortBy('newest'); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    ✕ Reset Filter
                  </button>
                )}
              </div>

              {/* Product Grid (Tablet 3-Column Native) */}
              {isCatalogLoading && serverCatalogItems.length === 0 ? (
                <div className="tablet-catalog-grid">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="tablet-catalog-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                      <div style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: 'var(--bg-deep)' }} />
                      <div style={{ padding: '0.85rem' }}>
                        <div style={{ height: '16px', width: '80%', backgroundColor: 'var(--bg-deep)', borderRadius: '4px', marginBottom: '8px' }} />
                        <div style={{ height: '14px', width: '50%', backgroundColor: 'var(--bg-deep)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredFaunas.length === 0 ? (
                <div style={{
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '1rem',
                  border: '1px dashed var(--border-light)',
                  color: 'var(--text-muted)'
                }}>
                  <Search size={40} strokeWidth={1.5} style={{ marginBottom: '0.85rem', color: 'var(--text-muted)' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                    Item Tidak Ditemukan
                  </h3>
                  <p style={{ fontSize: '0.86rem', margin: '0 0 1.25rem 0' }}>
                    Tidak ada produk yang cocok dengan pencarian atau filter yang dipilih.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setClassFilter('all'); setProductTypeFilter('all'); }}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Reset Filter Pencarian
                  </button>
                </div>
              ) : (
                <div className="tablet-catalog-grid">
                  {filteredFaunas.map((fauna) => (
                    <div
                      key={fauna.id}
                      onClick={() => fetchDetails(fauna.id)}
                      className="tablet-catalog-card"
                    >
                      {/* Product Thumbnail */}
                      <div style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <img
                          src={fauna.image_url}
                          alt={fauna.name}
                          className="tablet-card-thumb-img"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                          }}
                        />

                        {/* Top-Left Badges */}
                        <div style={{
                          position: 'absolute',
                          top: '0.65rem',
                          left: '0.65rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          alignItems: 'flex-start',
                          zIndex: 2,
                          maxWidth: 'calc(100% - 3.2rem)'
                        }}>
                          {fauna.class && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(0, 0, 0, 0.72)',
                              color: '#ffffff',
                              backdropFilter: 'blur(8px)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}>
                              {fauna.class}
                            </span>
                          )}

                          {fauna.conservation_status && fauna.conservation_status !== 'Tersedia' && (
                            <div style={{
                              padding: '0.18rem 0.55rem',
                              borderRadius: '6px',
                              backgroundColor: fauna.conservation_status === 'Habis Terjual'
                                ? 'rgba(239, 68, 68, 0.92)'
                                : fauna.conservation_status === 'Pre-Order'
                                ? 'rgba(217, 119, 6, 0.92)'
                                : fauna.conservation_status === 'Buka Jadwal'
                                ? 'rgba(124, 58, 237, 0.92)'
                                : 'rgba(59, 130, 246, 0.92)',
                              backdropFilter: 'blur(8px)',
                              color: '#ffffff',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                              <span>{fauna.conservation_status}</span>
                            </div>
                          )}
                        </div>

                        {/* Top-Right Quick Menu */}
                        <div
                          style={{ position: 'absolute', top: '0.65rem', right: '0.65rem', zIndex: 15 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCardActionMenuId(prev => prev === fauna.id ? null : fauna.id);
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: openCardActionMenuId === fauna.id ? 'var(--primary)' : 'rgba(0, 0, 0, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              backdropFilter: 'blur(8px)'
                            }}
                            title="Opsi Produk"
                          >
                            <MoreVertical size={15} />
                          </button>

                          {openCardActionMenuId === fauna.id && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                width: '180px',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                padding: '0.35rem',
                                zIndex: 50,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenCardActionMenuId(null);
                                  handleShareItem(fauna);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.55rem',
                                  width: '100%',
                                  padding: '0.5rem 0.65rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.4rem',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <Share2 size={14} color="var(--primary)" />
                                <span>Bagikan Item</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenCardActionMenuId(null);
                                  handleReportItem(fauna);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.55rem',
                                  width: '100%',
                                  padding: '0.5rem 0.65rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: '#ef4444',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.4rem',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <Flag size={14} />
                                <span>Laporkan Item</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info & Price (Equal-Height Baseline) */}
                      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: '0 0 0.35rem 0',
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            minHeight: '2.7em'
                          }}>
                            {fauna.name}
                          </h3>

                          <div style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: 'var(--primary)',
                            letterSpacing: '-0.01em',
                            marginBottom: '0.5rem'
                          }}>
                            {formatRupiah(Number(fauna.price || 0))}
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid var(--border-light)',
                          marginTop: 'auto',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)'
                        }}>
                          <span style={{
                            fontWeight: 600,
                            color: fauna.conservation_status === 'Habis Terjual'
                              ? '#ef4444'
                              : fauna.conservation_status === 'Pre-Order'
                              ? '#f59e0b'
                              : 'var(--text-secondary)'
                          }}>
                            {fauna.conservation_status || (fauna.stock > 0 ? `Stok: ${fauna.stock}` : 'Tersedia')}
                          </span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            Rincian &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tablet Native Server-Side Pagination Bar (Rule 7.C: Touch-Segmented Page Bar) */}
              {serverPagination.totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem 0.5rem',
                  marginTop: '1.5rem',
                  borderTop: '1px solid var(--border-light)',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  {/* Summary */}
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{((serverPagination.currentPage - 1) * 15) + 1} - {Math.min(serverPagination.currentPage * 15, serverPagination.totalItems)}</strong> dari <strong style={{ color: 'var(--text-primary)' }}>{serverPagination.totalItems}</strong> item
                  </div>

                  {/* Touch Segmented Pager Controls (Touch Targets >= 44px) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={!serverPagination.hasPrev || isCatalogLoading}
                      onClick={() => {
                        fetchServerCatalog(serverPagination.currentPage - 1);
                        window.scrollTo({ top: 380, behavior: 'smooth' });
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 0.95rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        color: !serverPagination.hasPrev ? 'var(--text-muted)' : 'var(--text-primary)',
                        opacity: !serverPagination.hasPrev ? 0.5 : 1,
                        cursor: !serverPagination.hasPrev ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ChevronLeft size={16} />
                      <span>Sebelumnya</span>
                    </button>

                    {/* Numeric Page Buttons */}
                    {Array.from({ length: Math.min(serverPagination.totalPages, 5) }, (_, i) => {
                      let pageNum = i + 1;
                      if (serverPagination.totalPages > 5) {
                        if (serverPagination.currentPage > 3) {
                          pageNum = Math.min(serverPagination.currentPage - 2 + i, serverPagination.totalPages - 4 + i);
                        }
                      }
                      const isActive = pageNum === serverPagination.currentPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          disabled={isCatalogLoading}
                          onClick={() => {
                            fetchServerCatalog(pageNum);
                            window.scrollTo({ top: 380, behavior: 'smooth' });
                          }}
                          style={{
                            minHeight: '44px',
                            minWidth: '44px',
                            padding: '0 0.65rem',
                            borderRadius: '0.55rem',
                            backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-card)',
                            border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                            color: isActive ? '#ffffff' : 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={!serverPagination.hasNext || isCatalogLoading}
                      onClick={() => {
                        fetchServerCatalog(serverPagination.currentPage + 1);
                        window.scrollTo({ top: 380, behavior: 'smooth' });
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 0.95rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        color: !serverPagination.hasNext ? 'var(--text-muted)' : 'var(--text-primary)',
                        opacity: !serverPagination.hasNext ? 0.5 : 1,
                        cursor: !serverPagination.hasNext ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 6. Share Catalog Modal */}
      {showShareModal && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-light)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Share2 size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Bagikan Profil Katalog
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
              <TabletShareCatalogView
                storeSlug={slug}
                storeTitle={settings.store_title}
                storeLogoUrl={settings.store_logo_url}
                storeSlogan={settings.store_slogan}
                whatsappNumber={settings.whatsapp_number}
                onToast={showToast}
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. Report Modal */}
      {reportModalData && (
        <div
          onClick={() => setReportModalData(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.25rem',
              border: '1px solid var(--border-light)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Flag size={20} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {reportModalData.type === 'store' ? 'Laporkan Profil Toko' : 'Laporkan Item Katalog'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalData(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem' }}>
                  Alasan Laporan
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                >
                  {getCatalogReportReasons(reportModalData.type).map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem' }}>
                  Keterangan Tambahan / Bukti
                </label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan secara singkat kendala atau bukti pelanggaran..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem' }}>
                  Email Pelapor (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="nama@email.com untuk status tindak lanjut"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReportModalData(null)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '0.65rem',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: isSubmittingReport ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingReport ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* External Link Safety Prompt Modal (Tablet) */}
      {externalUrlWarning && (
        <ExternalLinkWarningModal
          url={externalUrlWarning}
          onClose={() => setExternalUrlWarning(null)}
        />
      )}
    </div>
  );
};
