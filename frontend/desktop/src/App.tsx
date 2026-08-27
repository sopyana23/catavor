import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  Plus, 
  MapPin, 
  X, 
  BookOpen, 
  ShieldAlert, 
  Info,
  Trash2,
  Check,
  CheckCircle,
  Edit3, 
  Edit3 as Edit,
  Shield,
  FileText, 
  Loader,
  Lock,
  LogOut,
  Upload,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowLeft,
  Home,
  Sun,
  Moon,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Heading,
  Image,
  Settings,
  ShoppingCart,
  ShieldCheck,
  MessageCircle,
  MessageSquare,
  Compass,
  Heart,
  Truck,
  Sparkles,
  Package,
  FileCode,
  Wrench,
  Star,
  AlertTriangle,
  ArrowRight,
  Share2,
  Utensils,
  Shirt,
  Smartphone,
  PawPrint,
  Scissors,
  Zap,
  Store,
  Layers,
  Globe,
  ShoppingBag,
  Clock,
  CreditCard,
  QrCode,
  Copy,
  Download,
  Send,
  Bell,
  HelpCircle,
  Mail,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Filter,
  Calendar,
  ChevronDown,
  Briefcase,
  Sliders,
  Building2,
  Globe2,
  SlidersHorizontal,
  PhoneCall,
  MessageSquareHeart,
  UserCheck,
  Scale,
  FileCheck,
  Palette,
  Wand2,
  Database,
  BellRing,
  PackageCheck,
  BadgeCheck,
  LifeBuoy,
  User,
  Trees,
  Sunset,
  Waves,
  Flower2,
  ChevronUp,
  CheckCheck,
  RefreshCw,
  LayoutGrid
} from 'lucide-react'
import './App.css'
import logoHeaderImg from './assets/logo-header.png'
import appLogoImg from './assets/logo.png'
import { APP_LOGO_BASE64 } from './assets/logoBase64'

// Top-level Store Slug Resolver (Accessible before component mount)
function getStoreSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.toLowerCase();
  const parts = path.split('/').filter(Boolean);
  const reservedPortal = ['api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'terms', 'privacy', 'acceptable-use', 'acceptable_use', 'syarat-ketentuan', 'kebijakan-privasi', 'ketentuan-penggunaan'];
  
  if (parts.length === 0) return null;
  if (reservedPortal.includes(parts[0])) return null;
  
  return parts[0];
}

// Fast Base64 Logo Cacher & Resolver for 0ms Instant Rendering
function getFastStoreLogo(slug: string | null, defaultUrl: string | undefined): string {
  if (!slug) return defaultUrl || '';
  if (defaultUrl === '') {
    try {
      localStorage.removeItem(`catavor_logo_b64_${slug.toLowerCase()}`);
    } catch {}
    return '';
  }
  try {
    const cachedB64 = localStorage.getItem(`catavor_logo_b64_${slug.toLowerCase()}`);
    if (cachedB64 && cachedB64.startsWith('data:image')) {
      return cachedB64;
    }
  } catch {}
  return defaultUrl || '';
}

function cacheLogoAsBase64(slug: string, url: string) {
  if (!slug) return;
  if (!url) {
    try {
      localStorage.removeItem(`catavor_logo_b64_${slug.toLowerCase()}`);
    } catch {}
    return;
  }
  if (url.startsWith('data:')) return;
  try {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 120;
        canvas.height = img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          localStorage.setItem(`catavor_logo_b64_${slug.toLowerCase()}`, dataURL);
        }
      } catch {}
    };
    img.src = url;
  } catch {}
}

export type ItemCategoryType = 'physical' | 'digital' | 'fauna' | 'service' | 'food';

export interface ItemTypeConfig {
  type: ItemCategoryType;
  typeName: string;
  badgeName: string;
  icon: any;
  color: string;
  gradientBg: string;
  modalTitle: (mode: 'create' | 'edit') => string;
  modalSubtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  categoryLabel: string;
  defaultCategory: string;
  categoryOptions: string[];
  priceLabel: string;
  pricePlaceholder: string;
  photoLabel: string;
  photoHelper: string;
  videoLabel: string;
  videoPlaceholder: string;
  deliveryLabel: string;
  deliveryOptions: string[];
  deliveryTermsLabel: string;
  deliveryTermsPlaceholder: string;
  warrantyLabel?: string;
  warrantyPlaceholder?: string;
  descLabel: string;
  descPlaceholder: string;
}

export interface CulinarySmartPreset {
  defaultStorageTemp: string;
  defaultExpiredInfo: string;
  defaultShipping: string;
  portionPlaceholder: string;
  badgeEmoji: string;
  badgeLabel: string;
}

export const CULINARY_SMART_PRESETS: Record<string, CulinarySmartPreset> = {
  'Makanan Siap Santap': {
    defaultStorageTemp: 'Hangat / Langsung Santap',
    defaultExpiredInfo: 'Fresh Daily (Hari Ini)',
    defaultShipping: 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)',
    portionPlaceholder: 'Contoh: 1 Porsi / Paket Nasi Komplit',
    badgeEmoji: '🍽️',
    badgeLabel: 'Siap Santap'
  },
  'Makanan Beku & Olahan (Frozen)': {
    defaultStorageTemp: 'Beku (Freezer -18°C)',
    defaultExpiredInfo: '3 Bulan di Freezer',
    defaultShipping: 'Ekspedisi Cold-Chain / Paxel 1 Hari Sampai (Frozen / Makanan Segar)',
    portionPlaceholder: 'Contoh: Pack 500 gr / Box isi 10 pcs',
    badgeEmoji: '❄️',
    badgeLabel: 'Frozen Food'
  },
  'Minuman & Olahan Kopi': {
    defaultStorageTemp: 'Dingin (Chiller)',
    defaultExpiredInfo: '3-7 Hari di Kulkas',
    defaultShipping: 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)',
    portionPlaceholder: 'Contoh: Botol 250 ml / Literan 1000 ml / Cup 16oz',
    badgeEmoji: '🧃',
    badgeLabel: 'Minuman'
  },
  'Camilan, Snack & Kue Kering': {
    defaultStorageTemp: 'Suhu Ruang',
    defaultExpiredInfo: '3-6 Bulan (Kemasan Rapat)',
    defaultShipping: 'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)',
    portionPlaceholder: 'Contoh: Pouch 200 gr / Toples 250 gr / Pack 100 gr',
    badgeEmoji: '🍪',
    badgeLabel: 'Snack & Kering'
  },
  'Bakery, Roti & Pastry': {
    defaultStorageTemp: 'Suhu Ruang',
    defaultExpiredInfo: '3-4 Hari (Suhu Ruang)',
    defaultShipping: 'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)',
    portionPlaceholder: 'Contoh: 1 Loyang / Box isi 6 pcs / Loaf 400 gr',
    badgeEmoji: '🥐',
    badgeLabel: 'Bakery & Pastry'
  },
  'Bumbu & Bahan Masak': {
    defaultStorageTemp: 'Suhu Ruang',
    defaultExpiredInfo: '6-12 Bulan',
    defaultShipping: 'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)',
    portionPlaceholder: 'Contoh: Botol 250 gr / Pouch 500 gr / Pack 1 kg',
    badgeEmoji: '🧂',
    badgeLabel: 'Bumbu & Bahan'
  },
  'Katering & Paket Pesanan': {
    defaultStorageTemp: 'Hangat / Langsung Santap',
    defaultExpiredInfo: 'Fresh Daily (Hari Acara)',
    defaultShipping: 'Pre-Order Khusus (Katering / Acara)',
    portionPlaceholder: 'Contoh: Paket 20 Box / Tampah 15 Porsi',
    badgeEmoji: '🍱',
    badgeLabel: 'Katering & PO'
  },
  'Lainnya': {
    defaultStorageTemp: 'Fleksibel',
    defaultExpiredInfo: 'Sesuai Kemasan',
    defaultShipping: 'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)',
    portionPlaceholder: 'Contoh: 1 Unit / Pack / Box',
    badgeEmoji: '🍽️',
    badgeLabel: 'Kuliner'
  }
};

export const DEFAULT_MASTER_CATEGORIES: Record<ItemCategoryType, string[]> = {
  physical: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
  food: ['Makanan Utama (Main Course)', 'Dessert & Manisan', 'Minuman & Olahan Kopi', 'Camilan & Kudapan (Appetizer)', 'Bakery, Roti & Pastry', 'Makanan Beku (Frozen)', 'Paket Hemat & Bundling', 'Lainnya'],
  service: ['Perawatan & Grooming', 'Servis & Reparasi', 'Desain Grafis & Kreatif', 'Fotografi & Videografi', 'Kursus & Pelatihan', 'Konsultasi & Jasa Ahli', 'Kebersihan & Maintenance', 'Lainnya'],
  digital: ['E-Book & PDF', 'Template Dokumen & Notion', 'Desain Grafis & UI Kit', 'Source Code & Script', 'Audio & Musik', 'Preset & Filter', 'Video & Aset 3D', 'Lisensi Software', 'Lainnya'],
  fauna: ['Ikan Hias', 'Reptil & Amfibi', 'Burung & Unggas', 'Mamalia Kecil & Pets', 'Tanaman Hias & Flora', 'Invertebrata & Serangga', 'Pakan & Perlengkapan', 'Lainnya'],
};

export function getItemTypeFormConfig(type: ItemCategoryType = 'physical'): ItemTypeConfig {
  switch (type) {
    case 'physical':
      return {
        type: 'physical',
        typeName: 'Barang Fisik',
        badgeName: 'Barang Fisik',
        icon: Package,
        color: '#2563eb',
        gradientBg: 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Barang Fisik' : 'Edit Barang Fisik',
        modalSubtitle: 'Lengkapi spesifikasi barang fisik, merek, varian, dan opsi pengiriman.',
        nameLabel: 'Nama Barang *',
        namePlaceholder: 'Contoh: Kaos Oversize Cotton Combed 24s / Keyboard Mechanical...',
        categoryLabel: 'Kategori / Jenis Barang *',
        defaultCategory: 'Pakaian & Fashion',
        categoryOptions: ['Pakaian & Fashion', 'Aksesoris & Gadget', 'Elektronik & Komputer', 'Perlengkapan Rumah', 'Kerajinan & Kriya', 'Koleksi & Hobi', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 150.000',
        photoLabel: 'Foto Barang (1-5 Foto) *',
        photoHelper: 'Unggah 1 hingga 5 foto barang fisik beresolusi jelas.',
        videoLabel: 'Video Review / Unboxing (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryOptions: ['Bisa Kirim se-Indonesia', 'Khusus Pulau Jawa / Satu Wilayah', 'Ambil Sendiri di Toko (No Shipping)', 'Kurir Instan / Sameday Only'],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)',
        deliveryTermsPlaceholder: 'Contoh: Bisa kirim ke seluruh Indonesia via JNE / J&T / SiCepat atau Kurir Instan (Jabodetabek). Packing aman bubble wrap tebal + kardus gratis...',
        warrantyLabel: 'Kebijakan Garansi / Retur Barang',
        warrantyPlaceholder: 'Contoh: Garansi tukar baru 7 hari jika barang cacat produksi dengan melampirkan video unboxing...',
        descLabel: 'Deskripsi Lengkap Barang *',
        descPlaceholder: 'Jelaskan detail spesifikasi bahan/material, dimensi ukuran, kelengkapan isi kemasan, dan fitur unggulan barang ini...'
      };
    case 'digital':
      return {
        type: 'digital',
        typeName: 'Item Digital',
        badgeName: 'Item Digital',
        icon: FileCode,
        color: '#8b5cf6',
        gradientBg: 'radial-gradient(circle at top left, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Item Digital' : 'Edit Item Digital',
        modalSubtitle: 'Lengkapi tautan unduhan, format file, dan lisensi penggunaan item digital.',
        nameLabel: 'Nama File / Item Digital *',
        namePlaceholder: 'Contoh: E-Book Panduan Bisnis Kuliner / Template Notion 2026 / Source Code...',
        categoryLabel: 'Format & Kategori Digital *',
        defaultCategory: 'E-Book & PDF',
        categoryOptions: ['E-Book & PDF', 'Template Dokumen & Notion', 'Desain Grafis & UI Kit', 'Source Code & Script', 'Audio & Musik', 'Preset & Filter', 'Video & Aset 3D', 'Lisensi Software'],
        priceLabel: 'Harga Lisensi (IDR) *',
        pricePlaceholder: 'Contoh: 75.000 (Ketik 0 jika Gratis)',
        photoLabel: 'Banner / Mockup File (1-5 Gambar) *',
        photoHelper: 'Unggah cover mockup, screenshot preview, atau banner item digital.',
        videoLabel: 'Video Preview / Demo Item Digital (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Pengiriman & Panduan Akses File Digital',
        deliveryOptions: ['Akses Instan Otomatis (Link Cloud)', 'Kirim via Email Pembeli', 'Kirim via WhatsApp Admin', 'Akses Member Area'],
        deliveryTermsLabel: 'Pengiriman & Panduan Akses File Digital',
        deliveryTermsPlaceholder: 'Contoh: Link akses Google Drive / Dropbox otomatis dikirim via WhatsApp & Email setelah transaksi berhasil diverifikasi...',
        warrantyLabel: 'Ketentuan Lisensi & Hak Cipta',
        warrantyPlaceholder: 'Contoh: Pembelian mencakup lisensi personal. Dilarang keras membagikan ulang, menjual kembali, atau mendistribusikan tanpa izin...',
        descLabel: 'Deskripsi & Isi Materi Digital *',
        descPlaceholder: 'Jelaskan daftar isi bab/file yang didapat, software yang dibutuhkan untuk membuka file, dan manfaat materi digital ini...'
      };
    case 'fauna':
      return {
        type: 'fauna',
        typeName: 'Satwa & Living Fauna',
        badgeName: 'Satwa & Fauna',
        icon: PawPrint,
        color: '#059669',
        gradientBg: 'radial-gradient(circle at top left, rgba(5, 150, 105, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Satwa / Living Fauna' : 'Edit Satwa / Living Fauna',
        modalSubtitle: 'Lengkapi taksonomi ilmiah, kondisi satwa, masa hidup, dan garansi pengiriman hidup.',
        nameLabel: 'Nama Hewan / Tanaman Hias *',
        namePlaceholder: 'Contoh: Arwana Super Red Joey / Gecko Sunglow / Sugar Glider...',
        categoryLabel: 'Kelas / Kategori Fauna *',
        defaultCategory: 'Ikan Hias',
        categoryOptions: ['Ikan Hias', 'Reptil & Amfibi', 'Burung & Unggas', 'Mamalia Kecil & Pets', 'Tanaman Hias & Flora', 'Invertebrata & Serangga', 'Lainnya'],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 350.000',
        photoLabel: 'Foto Satwa & Kondisi Nyata (1-5 Foto) *',
        photoHelper: 'Unggah foto asli satwa tampak depan, samping, dan detail motif/anatomi.',
        videoLabel: 'Video Satwa / Feeding Video (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Pengiriman & Garansi Live Arrival (Satwa)',
        deliveryOptions: ['Bisa Kirim se-Indonesia (Legal & Berizin)', 'Khusus Pulau Jawa / Jalur Kereta', 'Ambil Sendiri di Toko (Pickup Only)', 'Kurir Instan Hewan (Gojek/Grab)'],
        deliveryTermsLabel: 'Pengiriman & Garansi Live Arrival (Satwa)',
        deliveryTermsPlaceholder: 'Contoh: Pengiriman via Kereta Api Express (KIB/Herona) atau Bus se-Pulau Jawa. Packing boks styrofoam beroksigen, garansi D.O.A 100% dengan video unboxing full...',
        warrantyLabel: 'Ketentuan Garansi D.O.A (Dead On Arrival)',
        warrantyPlaceholder: 'Contoh: Garansi hidup sampai tujuan (D.O.A 100%) berlaku dengan menyertakan video unboxing full tanpa jeda/cut maksimal 2 jam setelah paket diterima...',
        descLabel: 'Deskripsi & Kondisi Satwa *',
        descPlaceholder: 'Jelaskan riwayat kesehatan, pola makan, keaktifan, minus (jika ada), umur/size, dan petunjuk perawatan harian...'
      };
    case 'service':
      return {
        type: 'service',
        typeName: 'Jasa & Layanan',
        badgeName: 'Jasa & Layanan',
        icon: Wrench,
        color: '#d97706',
        gradientBg: 'radial-gradient(circle at top left, rgba(217, 119, 6, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Jasa & Layanan' : 'Edit Jasa & Layanan',
        modalSubtitle: 'Lengkapi estimasi durasi, metode layanan, wilayah operasional, dan jaminan pengerjaan.',
        nameLabel: 'Nama Jasa / Layanan *',
        namePlaceholder: 'Contoh: Executive Pet Grooming / Servis Laptop & PC / Sesi Foto Studio...',
        categoryLabel: 'Kategori Bidang Jasa *',
        defaultCategory: 'Perawatan & Grooming',
        categoryOptions: ['Perawatan & Grooming', 'Servis & Reparasi', 'Desain Grafis & Kreatif', 'Fotografi & Videografi', 'Kursus & Pelatihan', 'Konsultasi & Jasa Ahli', 'Kebersihan & Maintenance'],
        priceLabel: 'Tarif Layanan (IDR) *',
        pricePlaceholder: 'Contoh: 120.000 / Mulai dari Rp 100.000',
        photoLabel: 'Foto Portofolio / Dokumentasi Layanan (1-5 Foto) *',
        photoHelper: 'Unggah foto dokumentasi hasil kerja, portofolio tim, atau fasilitas peralatan.',
        videoLabel: 'Video Dokumentasi / Hasil Kerja (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Area Layanan, Reservasi & Ketentuan Pengerjaan',
        deliveryOptions: ['Booking Jadwal via WhatsApp', 'Datang Langsung ke Toko (Walk-in)', 'Reservasi DP 50% di Awal', 'Konsultasi Online Terlebih Dahulu'],
        deliveryTermsLabel: 'Area Layanan, Reservasi & Ketentuan Pengerjaan',
        deliveryTermsPlaceholder: 'Contoh: Melayani area Jabodetabek (visit) atau seluruh Indonesia (online). Harap booking minimal H-1 sebelum jadwal pengerjaan...',
        descLabel: 'Deskripsi Cakupan Layanan *',
        descPlaceholder: 'Jelaskan tahapan pengerjaan, apa saja yang termasuk dalam layanan, dan ketentuan lainnya...'
      };
    case 'food':
      return {
        type: 'food',
        typeName: 'Produk Kuliner (F&B)',
        badgeName: 'Kuliner & F&B',
        icon: Utensils,
        color: '#dc2626',
        gradientBg: 'radial-gradient(circle at top left, rgba(220, 38, 38, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Produk Kuliner' : 'Edit Produk Kuliner',
        modalSubtitle: 'Lengkapi takaran porsi/kemasan, masa simpan, suhu penyimpanan, dan metode pengiriman.',
        nameLabel: 'Nama Produk Kuliner / Menu *',
        namePlaceholder: 'Contoh: Wagyu Beef Rice Bowl / Cold Brew Coffee / Frozen Dimsum 20pcs / Bumbu Rendang...',
        categoryLabel: 'Kategori Menu / Toko *',
        defaultCategory: 'Makanan Utama (Main Course)',
        categoryOptions: [
          'Makanan Utama (Main Course)',
          'Dessert & Manisan',
          'Minuman & Olahan Kopi',
          'Camilan & Kudapan (Appetizer)',
          'Bakery, Roti & Pastry',
          'Makanan Beku (Frozen)',
          'Paket Hemat & Bundling',
          'Lainnya'
        ],
        priceLabel: 'Harga Satuan (IDR) *',
        pricePlaceholder: 'Contoh: 35.000',
        photoLabel: 'Foto Produk / Penyajian (1-5 Foto) *',
        photoHelper: 'Unggah 1 hingga 5 foto makanan, minuman, kemasan produk, atau bahan kuliner.',
        videoLabel: 'Video Produk / Penyajian (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Pengiriman & Ketentuan Kemasan (F&B)',
        deliveryOptions: [
          'Khusus Kurir Instan / Sameday (Gojek / Grab / Maxim)',
          'Ekspedisi Cold-Chain / Paxel 1 Hari Sampai (Frozen / Makanan Segar)',
          'Bisa Kirim Seluruh Indonesia (Ekspedisi Reguler / Produk Kering)',
          'Dine-in & Takeaway Only (Makan di Tempat / Bawa Pulang)',
          'Pre-Order Khusus (Katering / Acara)'
        ],
        deliveryTermsLabel: 'Pengiriman & Ketentuan Kemasan (F&B)',
        deliveryTermsPlaceholder: 'Contoh: Khusus kurir Instan / Sameday (Jabodetabek) atau Paxel Next Day. Dibuat fresh saat pesanan masuk, kemasan vacuum sealed food-grade + ice gel aman...',
        descLabel: 'Deskripsi Produk (Opsional)',
        descPlaceholder: 'Tuliskan deskripsi produk, cerita racikan, keunggulan rasa, atau catatan lainnya (opsional)...'
      };
  }
}

interface Fauna {
  id: number
  name: string
  scientific_name: string
  class: string
  habitat: string
  diet: string
  conservation_status: string
  price: number
  video_url: string | null
  is_shipping_available: boolean
  description: string
  image_url: string
  product_type?: ItemCategoryType
  attributes?: {
    stock?: number
    condition?: 'Baru' | 'Bekas' | 'Refurbished'
    weight?: number
    brand?: string
    variant?: string
    download_url?: string
    file_format?: string
    file_size?: string
    license_type?: string
    version?: string
    scientific_name?: string
    fauna_class?: string
    fauna_status?: string
    duration?: string
    service_location?: string
    service_area?: string
    inclusions?: string
    client_requirements?: string
    portion_size?: string
    expired_info?: string
    storage_temp?: string
    certification?: string
    taste_options?: string
    min_purchase?: string
    max_purchase?: string
    [key: string]: any
  }
  detailed_info?: {
    native_region: string
    lifespan: string
    weight: string
    shipping_terms?: string
    warranty_info?: string
    shipping_coverage?: string
    images?: string[]
    shopee_url?: string
    tokopedia_url?: string
    lazada_url?: string
    bukalapak_url?: string
    custom_shop_name?: string
    custom_shop_url?: string
    purchase_links?: Array<{ platform: string, url: string }>
  }
}

interface TicketMessage {
  id: string;
  sender: 'user' | 'support';
  sender_name: string;
  message: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  category: 'payment' | 'technical' | 'account' | 'feature' | 'other';
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TK-9402',
    subject: 'Verifikasi Upgrade Paket Pro Toko Catavor',
    category: 'payment',
    priority: 'high',
    status: 'in_progress',
    created_at: '28 Jul 2026, 14:20',
    updated_at: '28 Jul 2026, 14:35',
    messages: [
      {
        id: 'msg-1',
        sender: 'user',
        sender_name: 'Admin Toko',
        message: 'Halo Tim Catavor, saya sudah melakukan pembayaran transaksi upgrade ke Paket Pro via QRIS. Mohon bantuannya untuk verifikasi agar fitur Pro aktif.',
        timestamp: '28 Jul 2026, 14:20'
      },
      {
        id: 'msg-2',
        sender: 'support',
        sender_name: 'Catavor Official Support',
        message: 'Halo Admin Toko! Terima kasih telah melakukan upgrade. Tim Billing kami sedang memverifikasi mutasi transaksi Anda. Paket Pro akan diaktifkan secara otomatis dalam 5-10 menit.',
        timestamp: '28 Jul 2026, 14:35'
      }
    ]
  },
  {
    id: 'TK-8291',
    subject: 'Kustomisasi Domain Slug Toko',
    category: 'technical',
    priority: 'normal',
    status: 'resolved',
    created_at: '25 Jul 2026, 09:15',
    updated_at: '25 Jul 2026, 09:40',
    messages: [
      {
        id: 'msg-10',
        sender: 'user',
        sender_name: 'Admin Toko',
        message: 'Bagaimana cara mengubah URL toko saya agar lebih ringkas?',
        timestamp: '25 Jul 2026, 09:15'
      },
      {
        id: 'msg-11',
        sender: 'support',
        sender_name: 'Catavor Official Support',
        message: 'Halo! Anda dapat menyesuaikan slug toko pada menu Pengaturan Toko > Informasi Toko. Pastikan slug yang digunakan huruf kecil tanpa spasi dan belum dipakai oleh toko lain.',
        timestamp: '25 Jul 2026, 09:40'
      }
    ]
  }
];

export const LANDING_INDUSTRIES = [
  {
    id: 'culinary',
    name: 'Kuliner & F&B',
    badge: 'Menu Digital & Kafe',
    tagline: 'Restoran, Kafe, Katering, Bakery & Cloud Kitchen',
    description: 'Buku menu digital interaktif dengan visual hidangan menggugah selera, pilihan varian, serta direct order WhatsApp.',
    icon: Utensils,
    color: '#f97316',
    accentBg: '#fff7ed',
    products: [
      {
        id: 'c1',
        title: 'Artisan Cold Brew Coffee (250ml)',
        category: 'Signature Drink',
        price: 'Rp 28.000',
        badge: 'Best Seller',
        rating: '4.9',
        reviews: 142,
        description: 'Biji kopi arabika Gayo diseduh dingin 16 jam, aroma nutty cokelat dengan manis alami aren organik.',
        image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
        merchant: 'Kopi Senja Roastery',
        location: 'Bandung'
      },
      {
        id: 'c2',
        title: 'French Butter Croissant Supreme',
        category: 'Bakery & Pastry',
        price: 'Rp 24.000',
        badge: 'Fresh Daily',
        rating: '4.8',
        reviews: 95,
        description: 'Pastry mentega Prancis renyah berlapis di luar dan lembut wangi di dalam, dipanggang fresh setiap pagi.',
        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
        merchant: 'Maison & Boulangerie',
        location: 'Jakarta Selatan'
      },
      {
        id: 'c3',
        title: 'Wagyu Beef Saikoro Rice Bowl',
        category: 'Main Course',
        price: 'Rp 48.000',
        badge: 'Chef Choice',
        rating: '5.0',
        reviews: 210,
        description: 'Nasi jepang pulen dengan saikoro wagyu melt-in-mouth, onsen egg lembut, dan siraman saus tare homemade.',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        merchant: 'Tokyo Rice & Grill',
        location: 'Surabaya'
      }
    ]
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    badge: 'Lookbook & Butik',
    tagline: 'Butik, Distro, Hijab, Sepatu, Tas & Aksesoris',
    description: 'Etalase lookbook modern dengan informasi varian size/warna, panduan ukuran, dan tautan belanja WhatsApp atau marketplace.',
    icon: Shirt,
    color: '#2563eb',
    accentBg: '#eff6ff',
    products: [
      {
        id: 'f1',
        title: 'Heavyweight Boxy Tee (24s Cotton)',
        category: 'Streetwear',
        price: 'Rp 115.000',
        badge: 'Trending',
        rating: '4.9',
        reviews: 320,
        description: 'Bahan 100% combed cotton 24s gramasi solid, potongan boxy fit modern tidak mudah melar setelah dicuci.',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
        merchant: 'Atelier Monochrome',
        location: 'Jakarta Pusat'
      },
      {
        id: 'f2',
        title: 'Vegan Leather Structured Tote Bag',
        category: 'Bags & Leather',
        price: 'Rp 275.000',
        badge: 'Premium Finish',
        rating: '4.9',
        reviews: 88,
        description: 'Tas jinjing kulit sintetis tebal anti-gores dengan kompartemen laptop 14 inch dan resleting YKK premium.',
        image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',
        merchant: 'Terra Leather Craft',
        location: 'Yogyakarta'
      },
      {
        id: 'f3',
        title: 'Daily Canvas Low-Top Sneakers',
        category: 'Footwear',
        price: 'Rp 210.000',
        badge: 'Ready Stock',
        rating: '4.8',
        reviews: 154,
        description: 'Sepatu kanvas klasik dengan sol karet vulcanized fleksibel dan insole memory foam anti-pegal.',
        image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&auto=format&fit=crop&q=80',
        merchant: 'Karsa Footwear Studio',
        location: 'Tangerang'
      }
    ]
  },
  {
    id: 'plants',
    name: 'Tanaman & Living',
    badge: 'Florist & Botanical',
    tagline: 'Tanaman Hias, Pot Keramik, Florist & Dekorasi',
    description: 'Tampilkan keindahan tanaman hias indoor, buket bunga, pot terakota, dan panduan perawatan dengan visual estetik.',
    icon: Flower2,
    color: '#059669',
    accentBg: '#ecfdf5',
    products: [
      {
        id: 'p1',
        title: 'Monstera Deliciosa Variegata Albo',
        category: 'Rare Aroids',
        price: 'Rp 195.000',
        badge: 'Rare Item',
        rating: '5.0',
        reviews: 45,
        description: 'Corak marmer putih bersih 3-4 daun aktif dengan perakaran matang dan media tanam porous siap pajang.',
        image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600&auto=format&fit=crop&q=80',
        merchant: 'Flora Botanica House',
        location: 'Bogor'
      },
      {
        id: 'p2',
        title: 'Handcrafted Terrazzo Ceramic Planter',
        category: 'Pots & Living',
        price: 'Rp 85.000',
        badge: 'Handmade',
        rating: '4.9',
        reviews: 112,
        description: 'Pot gerabah motif terrazzo minimalis dengan tatakan piringan terpisah dan lubang aerasi drainase optimal.',
        image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80',
        merchant: 'Studio Pot Nusantara',
        location: 'Bali'
      },
      {
        id: 'p3',
        title: 'Rustic Everlasting Dried Flower Bouquet',
        category: 'Florist & Gift',
        price: 'Rp 140.000',
        badge: 'Tahan 3 Tahun',
        rating: '4.8',
        reviews: 86,
        description: 'Rangkaian bunga kering alami bernuansa earth-tone hangat, cocok untuk kado kelulusan maupun pemanis interior.',
        image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=600&auto=format&fit=crop&q=80',
        merchant: 'Aura Flower Atelier',
        location: 'Semarang'
      }
    ]
  },
  {
    id: 'pets',
    name: 'Satwa & Hewan Hias',
    badge: 'Fauna & Aquatics',
    tagline: 'Reptil, Aquascape, Burung, Pakan & Pet Shop',
    description: 'Galeri spesifikasi satwa hias lengkap dengan kelas taksonomi, video satwa, garansi kesehatan, dan panduan perawatan.',
    icon: PawPrint,
    color: '#0891b2',
    accentBg: '#ecfeff',
    products: [
      {
        id: 'a1',
        title: 'Crested Gecko Lily White Sub-Adult',
        category: 'Exotic Reptiles',
        price: 'Rp 850.000',
        badge: 'Garansi Hidup',
        rating: '5.0',
        reviews: 62,
        description: 'Karakter jinak total, kontras putih tinggi, makan rakus diet buah & serangga, aman kirim ke seluruh kota bergaransi.',
        image: 'https://images.unsplash.com/photo-1508817628294-5a453fa0b8fb?w=600&auto=format&fit=crop&q=80',
        merchant: 'DFauna Exotic Pet',
        location: 'Jakarta Barat'
      },
      {
        id: 'a2',
        title: 'Aquascape Nature Display System (30cm)',
        category: 'Aquatic Living',
        price: 'Rp 480.000',
        badge: 'Full Set System',
        rating: '4.9',
        reviews: 38,
        description: 'Tank kaca optik 30cm dengan ekosistem tanaman moss hidup, hardscape lava rock, dan filter mini siap rawat.',
        image: 'https://images.unsplash.com/photo-1520302630591-fd1c66edc19d?w=600&auto=format&fit=crop&q=80',
        merchant: 'AquaScaper Studio',
        location: 'Malang'
      },
      {
        id: 'a3',
        title: 'Sugar Glider Classic Joey (2 Bulan)',
        category: 'Small Mammals',
        price: 'Rp 320.000',
        badge: 'Jinak Bonding',
        rating: '4.9',
        reviews: 50,
        description: 'Joey sehat aktif usia 2 bulan lepas kantung, bonding tangan manusia, sudah makan mandiri buah & bubur halus.',
        image: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=600&auto=format&fit=crop&q=80',
        merchant: 'Pouch Pet Nusantara',
        location: 'Solo'
      }
    ]
  },
  {
    id: 'services',
    name: 'Jasa & Layanan',
    badge: 'Portofolio & Booking',
    tagline: 'Barbershop, Salon & Spa, Studio Foto, Kreatif & Konsultasi',
    description: 'Daftar tarif layanan profesional, portofolio karya, jadwal jam operasional, dan kemudahan booking langsung via WhatsApp.',
    icon: Scissors,
    color: '#7c3aed',
    accentBg: '#f5f3ff',
    products: [
      {
        id: 's1',
        title: 'Executive Haircut & Hot Towel Treatment',
        category: 'Grooming & Barbershop',
        price: 'Rp 65.000',
        badge: 'Paling Populer',
        rating: '4.9',
        reviews: 450,
        description: 'Potong rambut presisi, pijat relaksasi kepala, kompres handuk hangat aromaterapi, dan styling pomade premium.',
        image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
        merchant: 'Gentleman Heritage Barber',
        location: 'Bekasi'
      },
      {
        id: 's2',
        title: 'Sesi Foto Studio Wisuda / Keluarga (1 Jam)',
        category: 'Creative Studio',
        price: 'Rp 299.000',
        badge: 'Unlimited Pose',
        rating: '5.0',
        reviews: 184,
        description: 'Sesi pemotretan studio ber-AC, bebas ganti kostum, 10 foto edited resolusi cetak, dan seluruh file master dikirim via Cloud.',
        image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
        merchant: 'Lensa Visual Creative',
        location: 'Depok'
      },
      {
        id: 's3',
        title: 'Jasa Desain 3D Interior & Gambar Kerja RAB',
        category: 'Design & Living',
        price: 'Rp 450.000',
        badge: 'Revisi 3x',
        rating: '4.8',
        reviews: 76,
        description: 'Visualisasi render 3D fotorealistik denah ruang, layout furnitur 2D skala milimeter, dan estimasi rincian anggaran material.',
        image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80',
        merchant: 'Ruang Idaman Studio',
        location: 'Jakarta Barat'
      }
    ]
  },
  {
    id: 'tech',
    name: 'Gadget & Hobi',
    badge: 'Spesifikasi & Garansi',
    tagline: 'Elektronik, Audio, Aksesoris Komputer & Alat Harian',
    description: 'Etalase produk dengan spesifikasi teknis mendalam, informasi garansi resmi, dan kemudahan tanya ketersediaan stok ke admin.',
    icon: Smartphone,
    color: '#db2777',
    accentBg: '#fdf2f8',
    products: [
      {
        id: 't1',
        title: 'Mechanical Keyboard 75% Tri-Mode RGB Hot-Swap',
        category: 'PC Gaming & Setup',
        price: 'Rp 499.000',
        badge: 'Garansi 1 Tahun',
        rating: '4.9',
        reviews: 135,
        description: 'Keyboard mekanikal dengan switch linear pre-lubed, keycaps PBT dye-sub, baterai 4000mAh, dan konektivitas Bluetooth/2.4G.',
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
        merchant: 'KeyForge Gear',
        location: 'Tangerang Selatan'
      },
      {
        id: 't2',
        title: 'ANC Wireless Over-Ear Headphones (50H Battery)',
        category: 'Audio & Acoustics',
        price: 'Rp 385.000',
        badge: 'Hi-Res Audio',
        rating: '4.8',
        reviews: 92,
        description: 'Peredam bising aktif ganda, ear cushion memory foam lembut nyaman dipakai berjam-jam, serta mikrofon jernih untuk panggilan.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
        merchant: 'SonicPulse Audio',
        location: 'Jakarta Utara'
      },
      {
        id: 't3',
        title: 'Nordic LED Desk Lamp with 15W Qi Wireless Charger',
        category: 'Smart Desk Living',
        price: 'Rp 165.000',
        badge: 'Smart Touch',
        rating: '4.9',
        reviews: 118,
        description: 'Lampu baca aluminium anodized dengan 5 pilihan temperatur cahaya, sensor sentuh, dan fast wireless charging pad di dudukannya.',
        image: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?w=600&auto=format&fit=crop&q=80',
        merchant: 'Lumina Tech Home',
        location: 'Bandung'
      }
    ]
  }
];

export const LANDING_FAQS = [
  {
    q: 'Apakah saya perlu menyewa hosting atau membeli domain terpisah?',
    a: 'Tidak perlu sama sekali! Catavor adalah platform SaaS lengkap. Begitu Anda mendaftar, link katalog Anda langsung aktif seketika (contoh: catavor.com/nama-usaha) di atas infrastruktur cloud kami yang cepat dan aman tanpa biaya server tambahan.'
  },
  {
    q: 'Bagaimana alur pelanggan memesan produk di katalog saya?',
    a: 'Pelanggan cukup membuka link katalog Anda di ponsel atau komputer, memilih produk yang disukai, lalu menekan tombol "Pesan via WhatsApp". Sistem kami secara otomatis membuat draf pesan WhatsApp yang terstruktur rapi (berisi nama produk, harga, varian, dan catatan) sehingga penjual bisa langsung memproses pesanan dengan cepat.'
  },
  {
    q: 'Apakah ada potongan komisi atau biaya transaksi per penjualan?',
    a: '0% Komisi! Catavor tidak memotong sepeser pun dari nominal penjualan Anda. Seluruh pembayaran dari pembeli dan data pelanggan 100% menjadi milik Anda seutuhnya.'
  },
  {
    q: 'Apakah saya bisa mengubah foto, harga, atau menambah produk kapan saja?',
    a: 'Tentu! Anda memiliki akses penuh ke Dashboard Admin yang sangat mudah digunakan. Anda dapat menambah item baru, mengedit harga promo, mengganti foto produk, hingga mengatur jam operasional toko langsung dari ponsel maupun laptop dalam hitungan detik.'
  },
  {
    q: 'Bagaimana jika usaha saya memiliki banyak varian atau jenis layanan berbeda?',
    a: 'Catavor dirancang multi-kategori dan sangat fleksibel. Anda dapat mengelompokkan produk ke dalam berbagai kategori, menambahkan opsi varian (seperti rasa, ukuran, warna), mencantumkan estimasi pengerjaan jasa, hingga menyertakan link marketplace cadangan.'
  },
  {
    q: 'Apakah saya bisa mencetak QR Code untuk dipajang di kasir atau meja toko fisik?',
    a: 'Bisa! Di dalam Dashboard Admin, Anda dapat mengunduh file QR Code beresolusi tinggi secara gratis dalam 1 klik. Anda dapat mencetaknya pada standing acrylic meja kasir, kartu nama bisnis, banner, ataupun stiker packaging pengiriman.'
  }
];

export const ABOUT_ICONS_OPTIONS = [
  { key: 'shield', label: 'Garansi / Keamanan' },
  { key: 'lock', label: 'Transaksi / Terpercaya' },
  { key: 'message', label: 'Konsultasi / Chat' },
  { key: 'heart', label: 'Kesehatan / Kasih Sayang' },
  { key: 'truck', label: 'Pengiriman / Delivery' },
  { key: 'sparkles', label: 'Kualitas / Premium' },
  { key: 'star', label: 'Rekomendasi / Terbaik' },
  { key: 'compass', label: 'Eksplorasi / Visi' }
];

// Helper for adaptive desktop header scale based on title length
const getDesktopHeaderScale = (titleStr: string) => {
  const len = titleStr.trim().length
  if (len <= 12) {
    return { titleFontSize: '1.85rem', iconSize: 36, maxWidth: '480px', badgeFontSize: '0.68rem' }
  } else if (len <= 24) {
    return { titleFontSize: '1.45rem', iconSize: 30, maxWidth: '400px', badgeFontSize: '0.62rem' }
  } else {
    return { titleFontSize: '1.2rem', iconSize: 26, maxWidth: '320px', badgeFontSize: '0.58rem' }
  }
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

export const SOCIAL_MEDIA_OPTIONS = [
  { key: 'Instagram', label: 'Instagram' },
  { key: 'Facebook', label: 'Facebook' },
  { key: 'TikTok', label: 'TikTok' },
  { key: 'Youtube', label: 'YouTube' },
  { key: 'Twitter', label: 'Twitter / X' },
  { key: 'LinkedIn', label: 'LinkedIn' },
  { key: 'Telegram', label: 'Telegram' }
];

export const getPlatformBrandColor = (platform: string) => {
  switch (platform) {
    case 'Instagram': return '#e1306c';
    case 'Facebook': return '#1877f2';
    case 'TikTok': return '#00f2fe';
    case 'Youtube':
    case 'YouTube': return '#ff0000';
    case 'Twitter':
    case 'X': return '#38bdf8';
    case 'LinkedIn': return '#0a66c2';
    case 'Telegram': return '#24a1de';
    default: return 'var(--primary)';
  }
};

export const renderSocialIcon = (platform: string, size = 18, color = 'currentColor') => {
  switch (platform) {
    case 'Instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'Facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'Youtube':
    case 'YouTube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
          <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
        </svg>
      );
    case 'Twitter':
    case 'X':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
        </svg>
      );
    case 'LinkedIn':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case 'Telegram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
};

export function OfficialWebsiteCard({ url }: { url?: string | null }) {
  if (!url || !url.trim()) return null;

  const formattedUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://') 
    ? url.trim() 
    : `https://${url.trim()}`;

  const displayDomain = url.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  return (
    <div style={{
      borderRadius: '0.85rem',
      border: '1px solid var(--border-light)',
      backgroundColor: 'var(--bg-card)',
      overflow: 'hidden',
      transition: 'all 0.25s ease',
      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--primary-glow)', 
          color: 'var(--primary)', 
          flexShrink: 0, 
          border: '1px solid var(--border-light)' 
        }}>
          <Globe size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Website Resmi
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayDomain}
          </span>
        </div>
      </div>

      <a
        href={formattedUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.72rem',
          fontWeight: 800,
          backgroundColor: 'var(--primary-glow)',
          color: 'var(--primary)',
          border: '1px solid var(--border-light)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}
      >
        <span>Kunjungi</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

export const extractSocialHandle = (url: string, platform: string, customLabel?: string): string => {
  if (customLabel && customLabel.trim() !== '') {
    return customLabel.trim();
  }
  if (!url || typeof url !== 'string' || url.trim() === '') return platform;
  
  try {
    let clean = url.trim();
    clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    
    if (clean.includes('wa.me/') || clean.includes('whatsapp.com/')) {
      const num = clean.split('/').filter(Boolean).pop()?.split('?')[0];
      if (num) return `+${num.replace(/\D/g, '')}`;
    }
    
    const parts = clean.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let handle = parts[parts.length - 1];
      handle = handle.split('?')[0].split('#')[0];
      
      if (handle) {
        if (handle.startsWith('@')) return handle;
        if (handle.length < 35 && !handle.includes('.')) {
          return `@${handle}`;
        }
      }
    } else if (parts.length === 1) {
      let handle = parts[0].split('?')[0].split('#')[0];
      if (handle.startsWith('@')) return handle;
    }
  } catch (e) {
    // fallback
  }
  return platform;
};

export function SocialMediaSection({ rawSocialLinks }: { rawSocialLinks?: string | any[] | null }) {
  const validLinks = useMemo(() => {
    if (!rawSocialLinks) return [];
    let parsed: any[] = [];
    if (typeof rawSocialLinks === 'string') {
      try {
        parsed = JSON.parse(rawSocialLinks);
      } catch (e) {
        parsed = [];
      }
    } else if (Array.isArray(rawSocialLinks)) {
      parsed = rawSocialLinks;
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) => item && item.platform && item.url && item.url.trim() !== '');
  }, [rawSocialLinks]);

  if (validLinks.length === 0) return null;

  return (
    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', margin: '0.4rem 0 0.15rem 0' }}>
        <span style={{ height: '1px', flex: 1, backgroundColor: 'var(--border-light)' }}></span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saluran Media Sosial Resmi</span>
        <span style={{ height: '1px', flex: 1, backgroundColor: 'var(--border-light)' }}></span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: validLinks.length > 1 ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
        {validLinks.map((link: any, idx: number) => {
          const handle = extractSocialHandle(link.url, link.platform, link.label);
          const hasHandle = handle && handle !== link.platform;

          return (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.05rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                textDecoration: 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--primary-glow)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--border-light)',
                  flexShrink: 0
                }}>
                  {renderSocialIcon(link.platform, 20, 'var(--primary)')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                    {link.platform}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: hasHandle ? 'var(--primary)' : 'var(--text-secondary)', 
                    fontWeight: hasHandle ? 700 : 500,
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    marginTop: '0.1rem' 
                  }}>
                    {hasHandle ? handle : 'Kunjungi Profil Resmi'}
                  </span>
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.35rem', 
                fontSize: '0.75rem', 
                fontWeight: 800, 
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-glow)',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <span>Buka</span>
                <ExternalLink size={13} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export const renderStoreLogo = (logoUrl: string | undefined, className = '', size = 24, style = {}) => {
  const mergedStyle = { ...style, flexShrink: 0 };
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        className={className} 
        alt="Logo" 
        style={{ 
          height: `${size}px`, 
          width: 'auto', 
          maxWidth: '150px', 
          objectFit: 'contain', 
          borderRadius: '4px',
          ...mergedStyle 
        }} 
      />
    );
  }
  return null;
};

interface ShopSettings {
  plan?: string
  enable_wa_direct?: boolean
  enable_wa_rekber?: boolean
  whatsapp_number: string
  store_slogan: string
  promo_banner?: string
  articles_enabled?: string
  about_title?: string
  about_slogan?: string
  about_description?: string
  about_cards?: string
  about_location?: string
  about_hours?: string
  show_hours?: boolean
  about_disclaimer?: string
  social_links?: string
  official_website?: string
  store_title?: string
  store_logo_url?: string
  store_theme?: string
  default_is_comments_enabled?: string
  default_require_comment_approval?: string
  default_require_comment_email?: string
  default_verify_comment_email_domain?: string
  payment_bank_name?: string
  payment_bank_account?: string
  payment_bank_holder?: string
  payment_qris_image?: string
  master_coupons?: string
}

interface CommentItem {
  id: number
  article_id: number
  name: string
  email?: string
  content: string
  parent_id?: number
  reply_to_name?: string
  status?: string
  created_at: string
  updated_at: string
  article?: {
    id: number
    title: string
    slug: string
  }
  parent?: {
    id: number
    name: string
  }
  replies?: CommentItem[]
}

interface Article {
  id: number
  title: string
  content: string
  image_url?: string
  author?: string
  read_time?: string
  slug?: string
  meta_description?: string
  is_comments_enabled?: boolean
  require_comment_approval?: boolean
  require_comment_email?: boolean
  verify_comment_email_domain?: boolean
  comments?: CommentItem[]
  comments_count?: number
  created_at: string
  updated_at: string
}

const API_BASE = 'http://localhost:8000/api'

/* ==========================================================================
   OPERATIONAL HOURS HELPER & DYNAMIC COMPONENTS
   ========================================================================== */

export interface DaySchedule {
  open: string;
  close: string;
  status: 'open' | 'closed';
}

export interface OperationalHoursData {
  mode: 'everyday' | 'weekdays_weekends' | 'custom' | 'manual';
  timezone: string; // 'WIB' | 'WITA' | 'WIT'
  display_text?: string;
  manual_text?: string;
  everyday?: DaySchedule;
  weekdays?: DaySchedule;
  weekends?: DaySchedule;
  days?: Record<string, DaySchedule>;
}

export const INDO_DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

export const DEFAULT_OPERATIONAL_HOURS: OperationalHoursData = {
  mode: 'everyday',
  timezone: 'WIB',
  everyday: { open: '08:00', close: '21:00', status: 'open' },
  weekdays: { open: '08:00', close: '21:00', status: 'open' },
  weekends: { open: '09:00', close: '22:00', status: 'open' },
  days: {
    'Senin': { open: '08:00', close: '21:00', status: 'open' },
    'Selasa': { open: '08:00', close: '21:00', status: 'open' },
    'Rabu': { open: '08:00', close: '21:00', status: 'open' },
    'Kamis': { open: '08:00', close: '21:00', status: 'open' },
    'Jumat': { open: '08:00', close: '21:00', status: 'open' },
    'Sabtu': { open: '09:00', close: '22:00', status: 'open' },
    'Minggu': { open: '09:00', close: '22:00', status: 'open' },
  }
};

export function parseOperationalHours(raw?: string): OperationalHoursData {
  if (!raw || !raw.trim()) {
    return DEFAULT_OPERATIONAL_HOURS;
  }

  const str = raw.trim();

  // Try JSON parse first
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && parsed.mode) {
        return {
          ...DEFAULT_OPERATIONAL_HOURS,
          ...parsed,
          days: { ...DEFAULT_OPERATIONAL_HOURS.days, ...(parsed.days || {}) }
        };
      }
    } catch (e) {
      // ignore & fallback
    }
  }

  // Regex string fallback
  const timeMatch = str.match(/(\d{1,2}[:.]\d{2})\s*[-–s\/d]+\s*(\d{1,2}[:.]\d{2})/);
  const tzMatch = str.match(/(WIB|WITA|WIT)/i);
  const timezone = tzMatch ? tzMatch[1].toUpperCase() : 'WIB';

  if (timeMatch) {
    const open = timeMatch[1].replace('.', ':').padStart(5, '0');
    const close = timeMatch[2].replace('.', ':').padStart(5, '0');
    return {
      mode: 'manual',
      timezone,
      manual_text: str,
      display_text: str,
      everyday: { open, close, status: 'open' },
      weekdays: { open, close, status: 'open' },
      weekends: { open, close, status: 'open' },
      days: {
        'Senin': { open, close, status: 'open' },
        'Selasa': { open, close, status: 'open' },
        'Rabu': { open, close, status: 'open' },
        'Kamis': { open, close, status: 'open' },
        'Jumat': { open, close, status: 'open' },
        'Sabtu': { open, close, status: 'open' },
        'Minggu': { open, close, status: 'open' },
      }
    };
  }

  return {
    mode: 'manual',
    timezone: 'WIB',
    manual_text: str,
    display_text: str,
    everyday: { open: '08:00', close: '21:00', status: 'open' },
    weekdays: { open: '08:00', close: '21:00', status: 'open' },
    weekends: { open: '08:00', close: '21:00', status: 'open' },
    days: DEFAULT_OPERATIONAL_HOURS.days
  };
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const str = phone.trim();
  if (!str) return '';

  const digits = str.replace(/\D/g, '');
  if (!digits) return str;

  if (digits.startsWith('62')) {
    const main = digits.slice(2);
    const chunks = main.match(/.{1,4}/g) || [];
    return `+62 ${chunks.join(' ')}`;
  }

  if (digits.startsWith('0')) {
    const chunks = digits.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  }

  const chunks = digits.match(/.{1,4}/g) || [];
  return (str.startsWith('+') ? '+' : '') + chunks.join(' ');
}

export interface WAContactItem {
  label: string;
  number: string;
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
            label: item.label || item.name || `WhatsApp ${idx + 1}`,
            number: (item.number || item.phone || item.whatsapp || '').toString().trim()
          }))
          .filter(item => item.number !== '');
      }
    } catch {}
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    return parts.map((num, idx) => ({
      label: idx === 0 ? 'WhatsApp Utama' : `WhatsApp CS ${idx + 1}`,
      number: num
    }));
  }

  return [{
    label: 'WhatsApp Utama',
    number: trimmed
  }];
}

export function WhatsAppContactsCard({ rawWhatsappNumber }: { rawWhatsappNumber: string | null | undefined }) {
  const contacts = useMemo(() => parseWAContacts(rawWhatsappNumber), [rawWhatsappNumber]);

  if (contacts.length === 0) return null;

  if (contacts.length === 1) {
    const c = contacts[0];
    const cleanNum = c.number.replace(/\D/g, '');
    return (
      <a 
        href={`https://wa.me/${cleanNum}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.85rem', 
          padding: '0.9rem 1.15rem', 
          borderRadius: '0.85rem', 
          border: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card)', 
          textDecoration: 'none', 
          transition: 'var(--transition-smooth)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
          <MessageCircle size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, textAlign: 'left', minWidth: 0 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label || 'WhatsApp Official'}</span>
          <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 800 }}>
            {formatPhoneNumber(c.number)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--primary)', color: '#ffffff', padding: '0.45rem 0.85rem', borderRadius: '0.55rem', fontSize: '0.78rem', fontWeight: 800, boxShadow: '0 2px 8px var(--primary-glow)', flexShrink: 0 }}>
          <span>Chat</span>
          <ChevronRight size={14} />
        </div>
      </a>
    );
  }

  return (
    <div style={{ 
      borderRadius: '0.95rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)', 
      padding: '1.15rem',
      boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.9rem'
    }}>
      {/* Executive Header */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-light)', flexShrink: 0 }}>
            <MessageCircle size={19} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              Kontak WhatsApp Official
            </h4>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Layanan Customer Service Resmi
            </p>
          </div>
        </div>
      </div>

      {/* Contacts List Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {contacts.map((c, idx) => {
          const cleanNum = c.number.replace(/\D/g, '');
          return (
            <a
              key={idx}
              href={`https://wa.me/${cleanNum}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.75rem 0.9rem',
                borderRadius: '0.7rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {c.label || `CS ${idx + 1}`}
                  </span>
                </div>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {formatPhoneNumber(c.number)}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.3rem', 
                backgroundColor: 'var(--primary)', 
                color: '#ffffff', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '0.55rem', 
                fontSize: '0.78rem', 
                fontWeight: 800, 
                boxShadow: '0 2px 8px var(--primary-glow)',
                flexShrink: 0 
              }}>
                <span>Chat</span>
                <ChevronRight size={13} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function WhatsAppContactsManager({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (newVal: string) => void;
}) {
  const [localContacts, setLocalContacts] = useState<WAContactItem[]>(() => parseWAContacts(value));

  useEffect(() => {
    const parsed = parseWAContacts(value);
    if (JSON.stringify(parsed) !== JSON.stringify(localContacts)) {
      setLocalContacts(parsed);
    }
  }, [value]);

  const updateAll = (newList: WAContactItem[]) => {
    setLocalContacts(newList);
    onChange(JSON.stringify(newList));
  };

  const handleAdd = () => {
    const nextIdx = localContacts.length + 1;
    const newList = [
      ...localContacts,
      { label: `CS ${nextIdx} • Penjualan`, number: '' }
    ];
    updateAll(newList);
  };

  const handleItemChange = (index: number, field: 'label' | 'number', val: string) => {
    const newList = localContacts.map((c, idx) => {
      if (idx === index) {
        return { ...c, [field]: val };
      }
      return c;
    });
    updateAll(newList);
  };

  const handleDelete = (index: number) => {
    if (localContacts.length <= 1) {
      updateAll([{ label: 'WhatsApp Utama', number: '' }]);
      return;
    }
    const newList = localContacts.filter((_, idx) => idx !== index);
    updateAll(newList);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <label className="form-label" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>
            Nomor WhatsApp Official &amp; Customer Service *
          </label>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
            Kelola kontak CS resmi. Bisa menambahkan lebih dari 1 nomor.
          </span>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--primary-glow)', padding: '0.25rem 0.65rem', borderRadius: '20px', border: '1px solid var(--border-light)', flexShrink: 0 }}>
          {localContacts.length} Kontak WA
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {localContacts.map((c, idx) => (
          <div 
            key={idx} 
            style={{ 
              padding: '1rem', 
              borderRadius: '0.85rem', 
              border: '1px solid var(--border-light)', 
              backgroundColor: 'var(--bg-card-hover)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kontak CS #{idx + 1}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(idx)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  borderRadius: '0.5rem',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  transition: 'all 0.2s ease'
                }}
                title="Hapus kontak ini"
              >
                <Trash2 size={13} />
                <span>Hapus</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                  Label CS (Misal: CS Penjualan / CS 2)
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="CS 1 • Penjualan"
                  value={c.label}
                  onChange={(e) => handleItemChange(idx, 'label', e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                  Nomor WA (Contoh: 628123456789)
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="628123456789"
                  value={c.number}
                  onChange={(e) => handleItemChange(idx, 'number', e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {c.number.trim() && (
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-glow)', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', width: 'fit-content' }}>
                <Smartphone size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>Tampilan Publik:</span>
                <strong>{formatPhoneNumber(c.number)}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={handleAdd}
        style={{
          padding: '0.65rem 1.25rem',
          fontSize: '0.82rem',
          fontWeight: 800,
          borderRadius: '0.6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          cursor: 'pointer',
          border: '1px dashed var(--primary)',
          color: 'var(--primary)',
          backgroundColor: 'var(--primary-glow)',
          transition: 'all 0.2s ease',
          width: '100%',
          marginTop: '0.25rem'
        }}
      >
        <Plus size={16} />
        <span>Tambah Nomor WhatsApp CS Baru</span>
      </button>
    </div>
  );
}

export function ShareCatalogCard({
  storeSlug,
  storeTitle,
  onOpenQRModal,
  onToast
}: {
  storeSlug: string;
  storeTitle?: string;
  onOpenQRModal: () => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [copied, setCopied] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${storeSlug || 'catavor'}`;
    }
    return `https://catavor.id/${storeSlug || 'catavor'}`;
  }, [storeSlug]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    if (onToast) onToast('Link katalog berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.35rem 1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '0.65rem', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)', flexShrink: 0 }}>
          <Share2 size={22} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Bagikan Katalog Digital
          </h4>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            Bagikan katalog Anda via link langsung atau tampilkan kode QR untuk dipindai pelanggan
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary"
          style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
        >
          {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
          <span>{copied ? 'Link Tersalin!' : 'Salin Link'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenQRModal}
          className="btn-primary"
          style={{ padding: '0.6rem 1.1rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
        >
          <QrCode size={16} />
          <span>Tampilkan QR Code</span>
        </button>
      </div>
    </div>
  );
}

export function QRCodeModal({
  isOpen,
  onClose,
  storeSlug,
  storeTitle,
  storeLogoUrl,
  storeSlogan,
  onToast
}: {
  isOpen: boolean;
  onClose: () => void;
  storeSlug: string;
  storeTitle?: string;
  storeLogoUrl?: string;
  storeSlogan?: string;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${storeSlug || 'catavor'}`;
    }
    return `https://catavor.id/${storeSlug || 'catavor'}`;
  }, [storeSlug]);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fullUrl)}&color=0b0e0c&bgcolor=ffffff&margin=12`;

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qrcode-${(storeSlug || 'katalog').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      if (onToast) onToast('Gambar QR Code berhasil diunduh (PNG HD)!', 'success');
    } catch (err) {
      window.open(qrImageUrl, '_blank');
      if (onToast) onToast('Membuka QR Code di tab baru...', 'info');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    if (onToast) onToast('Link katalog berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeTitle || 'Katalog Digital',
          text: `Scan atau buka katalog ${storeTitle || 'Catavor'} secara digital:`,
          url: fullUrl
        });
      } catch (e) {}
    } else {
      handleCopy();
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
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '1.25rem',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={18} />
        </button>

        {/* Store Header Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
          {storeLogoUrl ? (
            <img 
              src={storeLogoUrl} 
              alt={storeTitle} 
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
            />
          ) : (
            <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', border: '1px solid var(--border-light)' }}>
              {(storeTitle || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {storeTitle || 'Katalog Digital'}
          </h3>
          {storeSlogan && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {storeSlogan}
            </span>
          )}
        </div>

        {/* QR Code Frame */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid var(--border-light)' }}>
          <img 
            src={qrImageUrl} 
            alt={`QR Code Katalog ${storeTitle || ''}`}
            style={{ width: '210px', height: '210px', borderRadius: '0.5rem', display: 'block' }}
          />
        </div>

        {/* Catalog Link */}
        <a 
          href={fullUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            fontSize: '0.82rem', 
            color: 'var(--primary)', 
            fontWeight: 700, 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.35rem', 
            padding: '0.4rem 0.95rem',
            backgroundColor: 'var(--primary-glow)',
            border: '1px solid var(--border-light)',
            borderRadius: '2rem',
            wordBreak: 'break-all', 
            textAlign: 'center' 
          }}
        >
          <span>{fullUrl.replace(/^https?:\/\//, '')}</span>
          <ExternalLink size={13} />
        </a>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', width: '100%' }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary"
            style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Download size={15} />
            <span>{downloading ? 'Unduh...' : 'Unduh QR'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
            <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="btn-secondary"
            style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Share2 size={15} />
            <span>Bagikan</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function getOperationalStatus(data: OperationalHoursData) {
  const now = new Date();
  const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayMap[now.getDay()];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let todaySched: DaySchedule = { open: '08:00', close: '21:00', status: 'open' };

  if (data.days && data.days[todayName]) {
    todaySched = data.days[todayName];
  } else if (data.mode === 'everyday') {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  } else if (data.mode === 'weekdays_weekends') {
    const isWeekend = todayName === 'Sabtu' || todayName === 'Minggu';
    todaySched = isWeekend ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
  } else {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  }

  const isClosed = todaySched.status === 'closed';
  const summaryText = isClosed
    ? `Hari ini (${todayName}): Tutup`
    : `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`;

  if (isClosed) {
    return {
      status: 'closed',
      badgeText: 'Tutup',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): Tutup`,
      todayName
    };
  }

  const [openH, openM] = (todaySched.open || '08:00').split(':').map(Number);
  const [closeH, closeM] = (todaySched.close || '21:00').split(':').map(Number);

  const openMin = (openH || 0) * 60 + (openM || 0);
  const closeMin = (closeH || 0) * 60 + (closeM || 0);

  if (currentMin >= openMin && currentMin < closeMin) {
    return {
      status: 'open',
      badgeText: 'Buka Sekarang',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`,
      todayName
    };
  } else {
    return {
      status: 'closed',
      badgeText: 'Tutup',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone || 'WIB'}`,
      todayName
    };
  }
}

export function OperationalHoursCard({ rawHours }: { rawHours?: string }) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => parseOperationalHours(rawHours), [rawHours]);
  const statusInfo = useMemo(() => getOperationalStatus(data), [data]);

  const getDaySchedule = (dayName: string): DaySchedule => {
    if (data.mode === 'everyday') return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
    if (data.mode === 'weekdays_weekends') {
      const isWk = dayName === 'Sabtu' || dayName === 'Minggu';
      return isWk ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
    }
    if (data.mode === 'custom' && data.days && data.days[dayName]) {
      return data.days[dayName];
    }
    return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  };

  return (
    <div style={{ 
      borderRadius: '0.95rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)', 
      overflow: 'hidden', 
      transition: 'all 0.25s ease', 
      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Banner */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '1.1rem 1.15rem', 
          cursor: 'pointer', 
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          backgroundColor: expanded ? 'var(--bg-card-hover)' : 'transparent',
          transition: 'background-color 0.2s ease'
        }}
      >
        {/* Header Row: Icon + Title + Status Badge Pinned Top Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
              <Clock size={19} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                Jam Operasional
              </h4>
            </div>
          </div>

          <span style={{ 
            fontSize: '0.72rem', 
            fontWeight: 800, 
            padding: '0.28rem 0.7rem', 
            borderRadius: '20px', 
            backgroundColor: statusInfo.badgeBg, 
            color: statusInfo.badgeColor, 
            border: `1px solid ${statusInfo.badgeBorder}`, 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusInfo.badgeColor, display: 'inline-block', boxShadow: `0 0 6px ${statusInfo.badgeColor}` }} />
            {statusInfo.badgeText}
          </span>
        </div>

        {/* Schedule Info Box */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 0.95rem',
          borderRadius: '0.65rem',
          backgroundColor: 'var(--bg-card-hover)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Hari Ini ({statusInfo.todayName})
            </span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {statusInfo.todayScheduleText.split(': ')[1] || statusInfo.todayScheduleText}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '0.55rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: expanded ? 'var(--primary)' : 'var(--primary-glow)',
              color: expanded ? '#ffffff' : 'var(--primary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          >
            <Calendar size={13} style={{ flexShrink: 0 }} />
            <span>{expanded ? 'Tutup' : 'Jadwal 7 Hari'}</span>
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }} />
          </button>
        </div>
      </div>

      {/* Expanded Weekly Schedule Table */}
      {expanded && (
        <div style={{ 
          padding: '0.9rem 1.15rem 1.1rem', 
          borderTop: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card-hover)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.55rem', 
          animation: 'fadeIn 0.2s ease' 
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>RINCIAN JADWAL MINGGUAN ({data.timezone})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {INDO_DAYS_LIST.map((day) => {
              const isToday = day === statusInfo.todayName;
              const daySched = getDaySchedule(day);
              const isClosed = daySched.status === 'closed';

              return (
                <div 
                  key={day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: isToday ? 'var(--primary-glow)' : 'var(--bg-card)',
                    border: isToday ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    boxShadow: isToday ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isToday && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />}
                    <span style={{ color: isToday ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isToday ? 800 : 700 }}>
                      {day}
                    </span>
                  </div>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    color: isClosed ? '#ef4444' : (isToday ? 'var(--primary)' : 'var(--text-primary)'), 
                    fontWeight: isClosed ? 800 : (isToday ? 800 : 700),
                    fontSize: isClosed ? '0.74rem' : '0.78rem',
                    backgroundColor: isClosed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    padding: isClosed ? '0.12rem 0.5rem' : '0',
                    borderRadius: isClosed ? '9999px' : '0',
                    border: isClosed ? '1px solid rgba(239, 68, 68, 0.25)' : 'none'
                  }}>
                    {isClosed ? (
                      <>
                        <AlertCircle size={11} style={{ flexShrink: 0, color: '#ef4444' }} />
                        <span>TUTUP</span>
                      </>
                    ) : (
                      <>
                        <Clock size={11} style={{ flexShrink: 0, opacity: isToday ? 0.9 : 0.45, color: isToday ? 'var(--primary)' : 'var(--text-secondary)' }} />
                        <span>{`${daySched.open} - ${daySched.close} ${data.timezone}`}</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function OperationalHoursBuilder({ 
  value, 
  onChange,
  showHours = true,
  onToggleShowHours
}: { 
  value: string; 
  onChange: (val: string) => void; 
  showHours?: boolean;
  onToggleShowHours?: (show: boolean) => void;
}) {
  const parsedData = useMemo(() => parseOperationalHours(value), [value]);

  const [timezone, setTimezone] = useState<string>(parsedData.timezone || 'WIB');

  // Custom 7 Days state
  const [days, setDays] = useState<Record<string, DaySchedule>>(
    parsedData.days || DEFAULT_OPERATIONAL_HOURS.days!
  );

  // Helper to emit JSON updates to parent
  const emitUpdate = (newTz: string, newDays: Record<string, DaySchedule>) => {
    const resultObj: OperationalHoursData = {
      mode: 'custom',
      timezone: newTz,
      days: newDays,
      display_text: `Kustom 7 Hari (${newTz})`
    };
    onChange(JSON.stringify(resultObj));
  };

  const handleTzChange = (newTz: string) => {
    setTimezone(newTz);
    emitUpdate(newTz, days);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '0.75rem', 
      padding: '0.85rem', 
      borderRadius: '0.75rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      {/* Toggle Switch Header (Best Practice UI) */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '0.75rem', 
          padding: '0.65rem 0.85rem', 
          borderRadius: '0.65rem', 
          backgroundColor: showHours ? 'var(--primary-glow)' : 'var(--bg-card-hover)', 
          border: '1px solid var(--border-light)',
          transition: 'all 0.25s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
          <Clock size={18} style={{ color: showHours ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Jam Operasional Bisnis
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {showHours ? 'Jam operasional aktif & ditampilkan di katalog' : 'Jam operasional disembunyikan dari katalog'}
            </span>
          </div>
        </div>

        {onToggleShowHours && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: 800, 
              color: showHours ? 'var(--primary)' : 'var(--text-muted)',
              padding: '0.15rem 0.5rem',
              borderRadius: '12px',
              backgroundColor: showHours ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: showHours ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)'
            }}>
              {showHours ? 'TAMPIL' : 'SEMBUNYI'}
            </span>
            
            {/* iOS/Canva Style Toggle Switch Button */}
            <button
              type="button"
              role="switch"
              aria-checked={showHours}
              onClick={() => onToggleShowHours(!showHours)}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '14px',
                backgroundColor: showHours ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)',
                border: showHours ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: showHours ? 'flex-end' : 'flex-start',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div 
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </button>
          </div>
        )}
      </div>

      {showHours ? (
        <>
          {/* Header + Timezone Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
            Jam Operasional (7 Hari)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Zona:</span>
          <select 
            className="form-input" 
            style={{ width: 'auto', padding: '0.15rem 0.35rem', fontSize: '0.72rem', height: 'auto', borderRadius: '0.35rem', fontWeight: 700 }}
            value={timezone}
            onChange={(e) => handleTzChange(e.target.value)}
          >
            <option value="WIB">WIB (UTC+7)</option>
            <option value="WITA">WITA (UTC+8)</option>
            <option value="WIT">WIT (UTC+9)</option>
          </select>
        </div>
      </div>

      {/* Grid Table Column Headers */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, 1fr) auto', 
        gap: '0.35rem', 
        padding: '0.2rem 0.4rem 0.1rem 0.4rem', 
        fontSize: '0.64rem', 
        fontWeight: 800, 
        color: 'var(--text-secondary)', 
        textTransform: 'uppercase', 
        letterSpacing: '0.03em'
      }}>
        <span>Hari</span>
        <span style={{ textAlign: 'center' }}>Buka</span>
        <span style={{ textAlign: 'center' }}>Tutup</span>
        <span style={{ textAlign: 'center' }}>Aksi</span>
      </div>

      {/* 7 Days Table Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', boxSizing: 'border-box' }}>
        {INDO_DAYS_LIST.map((day) => {
          const currentSched = days[day] || { open: '08:00', close: '21:00', status: 'open' };
          const isClosed = currentSched.status === 'closed';

          return (
            <div 
              key={day} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, 1fr) auto', 
                alignItems: 'center', 
                gap: '0.35rem', 
                padding: '0.35rem 0.45rem', 
                borderRadius: '0.45rem', 
                backgroundColor: isClosed ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)', 
                border: isClosed ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-light)', 
                boxSizing: 'border-box',
                width: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Col 1: Day Name */}
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {day}
              </span>
              
              {/* Col 2 & 3: Time inputs or Closed Label */}
              {isClosed ? (
                <span style={{ gridColumn: 'span 2', fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, textAlign: 'center', letterSpacing: '0.03em' }}>
                  TUTUP SEHARIAN
                </span>
              ) : (
                <>
                  <input 
                    type="time" 
                    className="form-input" 
                    style={{ width: '100%', minWidth: 0, padding: '0.12rem 0.1rem', fontSize: '0.7rem', height: '26px', textAlign: 'center', borderRadius: '0.35rem', boxSizing: 'border-box' }} 
                    value={currentSched.open} 
                    onChange={(e) => {
                      const updatedDays = { ...days, [day]: { ...currentSched, open: e.target.value } };
                      setDays(updatedDays);
                      emitUpdate(timezone, updatedDays);
                    }} 
                  />
                  <input 
                    type="time" 
                    className="form-input" 
                    style={{ width: '100%', minWidth: 0, padding: '0.12rem 0.1rem', fontSize: '0.7rem', height: '26px', textAlign: 'center', borderRadius: '0.35rem', boxSizing: 'border-box' }} 
                    value={currentSched.close} 
                    onChange={(e) => {
                      const updatedDays = { ...days, [day]: { ...currentSched, close: e.target.value } };
                      setDays(updatedDays);
                      emitUpdate(timezone, updatedDays);
                    }} 
                  />
                </>
              )}

              {/* Col 4: Status Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const newStatus = isClosed ? 'open' as const : 'closed' as const;
                  const updatedDays = { ...days, [day]: { ...currentSched, status: newStatus } };
                  setDays(updatedDays);
                  emitUpdate(timezone, updatedDays);
                }}
                style={{ 
                  fontSize: '0.62rem', 
                  padding: '0.2rem 0.45rem', 
                  borderRadius: '0.35rem', 
                  backgroundColor: isClosed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                  color: isClosed ? '#10b981' : '#ef4444', 
                  border: isClosed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', 
                  fontWeight: 800, 
                  cursor: 'pointer', 
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {isClosed ? 'Buka' : 'Tutup'}
              </button>
            </div>
          );
        })}
      </div>
        </>
      ) : (
        <div style={{ 
          padding: '0.85rem 1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.65rem', 
          backgroundColor: 'var(--bg-card-hover)', 
          borderRadius: '0.65rem', 
          border: '1px dashed var(--border-light)',
          color: 'var(--text-secondary)'
        }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#f87171'
          }}>
            <Lock size={13} />
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Jam operasional nonaktif. Bagian jam operasional tidak akan ditampilkan pada katalog publik Anda.
          </span>
        </div>
      )}
    </div>
  );
}

function App() {

  // Parse path for store slug: /u/{slug}
  const getStoreSlug = () => {
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    const reserved = ['api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'terms', 'privacy', 'acceptable_use', 'syarat-ketentuan', 'kebijakan-privasi', 'ketentuan-penggunaan'];
    
    if (parts.length === 0) return null;
    
    if (!reserved.includes(parts[0])) {
      return parts[0];
    }
    return null;
  };
  const [storeSlug, setStoreSlug] = useState<string | null>(getStoreSlug());

  // Persistent Onboarding Registration State across Page Refreshes & Industry Standard Clean URLs
  const loadSavedRegistrationState = () => {
    try {
      const path = window.location.pathname.toLowerCase();
      const urlParams = new URLSearchParams(window.location.search);
      const urlPlan = urlParams.get('plan');

      let pathTab: 'home' | 'login' | 'register' | 'terms' | 'privacy' | 'acceptable_use' = 'home';
      let pathStep: 1 | 2 | 3 = 1;

      if (path === '/login') {
        pathTab = 'login';
      } else if (path === '/register' || path === '/register/step-1') {
        pathTab = 'register';
        pathStep = 1;
      } else if (path === '/register/step-2') {
        pathTab = 'register';
        pathStep = 2;
      } else if (path === '/register/step-3') {
        pathTab = 'register';
        pathStep = 3;
      } else if (path === '/terms' || path === '/syarat-ketentuan') {
        pathTab = 'terms';
      } else if (path === '/privacy' || path === '/kebijakan-privasi') {
        pathTab = 'privacy';
      } else if (path === '/acceptable-use' || path === '/acceptable_use' || path === '/ketentuan-penggunaan') {
        pathTab = 'acceptable_use';
      } else {
        const queryTab = urlParams.get('tab');
        const queryStep = urlParams.get('step');
        if (['login', 'register', 'terms', 'privacy', 'acceptable_use'].includes(queryTab || '')) {
          pathTab = queryTab as any;
          if (queryStep) {
            const stepNum = parseInt(queryStep, 10);
            if (stepNum >= 1 && stepNum <= 3) pathStep = stepNum as 1 | 2 | 3;
          }
        } else {
          const savedTab = sessionStorage.getItem('catavor_portal_tab');
          if (['terms', 'privacy', 'acceptable_use'].includes(savedTab || '')) {
            pathTab = savedTab as any;
          }
        }
      }

      const savedPlan = sessionStorage.getItem('catavor_register_plan');
      const savedForm = sessionStorage.getItem('catavor_register_form');

      const finalPlan = (urlPlan || savedPlan || 'free') as 'free' | 'pro';
      const finalForm = savedForm ? JSON.parse(savedForm) : { name: '', email: '', password: '', store_name: '', store_slug: '' };

      return {
        tab: pathTab,
        step: pathStep,
        plan: finalPlan,
        form: finalForm
      };
    } catch {
      return {
        tab: 'home' as const,
        step: 1 as const,
        plan: 'free' as const,
        form: { name: '', email: '', password: '', store_name: '', store_slug: '' }
      };
    }
  };

  const initialRegState = loadSavedRegistrationState();

  const [portalTab, setPortalTab] = useState<'home' | 'login' | 'register' | 'checkout' | 'terms' | 'privacy' | 'acceptable_use'>(initialRegState.tab as any);
  const [registerPlan, setRegisterPlan] = useState<'free' | 'pro'>(initialRegState.plan);
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(initialRegState.step);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>('bank');
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [paymentProofNote, setPaymentProofNote] = useState<string>('');
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState<boolean>(false);
  const [copiedAccountToast, setCopiedAccountToast] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: 'about_onboarding',
      title: '📋 Lengkapi Pengaturan Halaman Tentang Kami',
      message: 'Lengkapi Alamat Toko, Jam Operasional, dan Profil Komitmen Layanan Anda agar katalog terlihat profesional dan terpercaya.',
      time: 'Baru saja',
      read: false,
      type: 'warning',
      linkSubTab: 'settings',
      linkSettingsSubTab: 'about'
    },
    { id: 1, title: 'Status Verifikasi Plan Pro', message: 'Bukti pembayaran Anda sedang diproses oleh Tim Admin. Akses Plan Free aktif sementara (Est. 1x24 jam).', time: 'Baru saja', read: false, type: 'info' },
    { id: 2, title: 'Selamat Datang di Catavor!', message: 'Katalog interaktif Anda berhasil dibuat. Tambahkan produk pertama Anda.', time: '10 menit lalu', read: false, type: 'success' }
  ]);
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [heroEmailInput, setHeroEmailInput] = useState('');
  // Landing Page Interactive States
  const [landingCategory, setLandingCategory] = useState<'culinary' | 'fashion' | 'plants' | 'pets' | 'services' | 'tech'>('culinary');
  const [pricingBillingCycle, setPricingBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [searchStoreQuery, setSearchStoreQuery] = useState<string>('');
  const [previewProductModal, setPreviewProductModal] = useState<any | null>(null);
  const [simulatedOrderToast, setSimulatedOrderToast] = useState<string | null>(null);
  // Policy & Privacy System States
  const [policies, setPolicies] = useState<{ [key: string]: { type: string, version: string, title: string, content: string, published_at?: string } }>({
    terms: {
      type: 'terms',
      version: 'v1.0.0',
      title: 'Syarat & Ketentuan Layanan',
      content: '1. Ketentuan Umum Layanan Catavor\nCatavor adalah platform penyedia katalog digital dan biolink bisnis online bagi pemilik usaha (Merchant).\n\n2. Hak & Kewajiban Merchant\nMerchant bertanggung jawab penuh atas kebenaran informasi produk, stok, harga, dan foto yang diunggah.\n\n3. Batasan Tanggung Jawab Transaksi\nCatavor menyediakan sarana katalog digital & alat komunikasi pesanan (WhatsApp Direct/Rekber).\n\n4. Hak Cipta & Kekayaan Intelektual\nSeluruh desain platform, kode, dan merek dagang Catavor adalah milik PT Catavor Media Digital.'
    },
    privacy: {
      type: 'privacy',
      version: 'v1.0.0',
      title: 'Kebijakan Privasi & Perlindungan Data',
      content: '1. Pengumpulan & Penggunaan Data\nKami mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar, seperti nama toko, alamat email, nomor WhatsApp bisnis.\n\n2. Keamanan & Enkripsi Data\nSeluruh data pengguna disimpan pada infrastruktur server terenkripsi sesuai Standar Keamanan & Privasi Data Global.\n\n3. Komitmen Kerahasiaan\nCatavor TIDAK AKAN PERNAH menjual, menyewakan, atau membagikan data pribadi atau data pelanggan toko Anda kepada pihak ketiga.\n\n4. Hak Pengguna Atas Data\nAnda berhak memperbarui, mengunduh, atau mengajukan penghapusan data toko Anda kapan saja.'
    },
    acceptable_use: {
      type: 'acceptable_use',
      version: 'v1.0.0',
      title: 'Ketentuan Penggunaan & Komunitas',
      content: '1. Larangan Konten & Barang Ilegal\nPengguna dilarang keras menampilkan, menawarkan, atau menjual narkotika, senjata api/tajam ilegal, satwa liar dilindungi, atau produk bajakan.\n\n2. Penangguhan & Pemblokiran Akun\nPelanggaran terhadap ketentuan penggunaan ini akan mengakibatkan penangguhan atau pemblokiran permanen.'
    }
  });

  const [activePolicyModal, setActivePolicyModal] = useState<string | null>(null);
  const [policyAuditLogs, setPolicyAuditLogs] = useState<any[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<{ type: string, version: string, title: string, content: string } | null>(null);
  const [policySaveLoading, setPolicySaveLoading] = useState(false);
  const [policySaveMsg, setPolicySaveMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`${API_BASE}/policies`);
      const data = await res.json();
      if (data.success && data.data) {
        setPolicies(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    }
  };

  const fetchPolicyAuditLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/settings/policy-audit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPolicyAuditLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch policy audit logs:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Guarantee auto-scroll to top on page/tab navigation (Desktop & Tablet)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [portalTab, storeSlug, registerStep]);

  // Theme Mode (Temporarily defaulted to 'dark')
  const [themeMode, setThemeMode] = useState<'dark' | 'cream'>('dark');

  useEffect(() => {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('catavor_theme', 'dark');
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => (prev === 'dark' ? 'cream' : 'dark'));
  };
  
  // Registration form state
  const [registerForm, setRegisterForm] = useState(initialRegState.form);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset top alert error & field errors when switching steps or tabs
  useEffect(() => {
    setRegisterError(null);
    setFieldErrors({});
  }, [registerStep, portalTab]);

  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string, type: 'free' | 'discount', discount: number, label: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!registerForm.name || !registerForm.name.trim()) {
      errors.name = 'Nama Lengkap Pemilik Usaha wajib diisi.';
    }
    if (!registerForm.email || !registerForm.email.trim()) {
      errors.email = 'Alamat Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email.trim())) {
      errors.email = 'Format alamat email tidak valid (Contoh: nama@domain.com).';
    }
    // Bypass password validation if user registered via Google SSO
    if (!registerForm.google_id) {
      if (!registerForm.password || !registerForm.password.trim()) {
        errors.password = 'Kata Sandi wajib diisi.';
      } else if (registerForm.password.length < 6) {
        errors.password = 'Kata Sandi minimal 6 karakter.';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    if (!validateStep1()) {
      setRegisterStep(1);
      return false;
    }
    const errors: Record<string, string> = {};
    if (!registerForm.store_name || !registerForm.store_name.trim()) {
      errors.store_name = 'Nama Toko / Bisnis wajib diisi.';
    }
    if (!registerForm.store_slug || !registerForm.store_slug.trim()) {
      errors.store_slug = 'Link Username Toko wajib diisi.';
    } else if (registerForm.store_slug.length < 3) {
      errors.store_slug = 'Link Username Toko minimal 3 karakter.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetRegisterFormState = () => {
    setRegisterForm({ name: '', email: '', password: '', store_name: '', store_slug: '', google_id: '', avatar: '' });
    setRegisterStep(1);
    setRegisterError(null);
    setFieldErrors({});
    setSlugStatus(null);
    setSlugChecking(false);
    sessionStorage.removeItem('catavor_register_form');
    sessionStorage.removeItem('catavor_register_plan');
  };

  // Auto reset Google SSO & register form cache whenever returning to Step 1
  useEffect(() => {
    if (portalTab === 'register' && registerStep === 1 && registerForm.google_id) {
      resetRegisterFormState();
    }
  }, [portalTab, registerStep]);

  // Store username (slug) real-time availability check state
  const [slugChecking, setSlugChecking] = useState<boolean>(false);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!registerForm.store_slug || registerForm.store_slug.length < 3) {
      setSlugStatus(null);
      setSlugChecking(false);
      return;
    }

    setSlugChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/check-slug/${registerForm.store_slug.toLowerCase()}`);
        const data = await res.json();
        setSlugStatus({
          available: data.available,
          message: data.message || (data.available ? 'Username tersedia!' : 'Username sudah digunakan.')
        });
      } catch {
        setSlugStatus(null);
      } finally {
        setSlugChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [registerForm.store_slug]);

  // Helper to cleanly format Markdown policy content into React Elements
  const renderFormattedPolicyContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Check for headings: ### Header Title or ## Header Title or # Header Title
          if (trimmed.startsWith('#')) {
            const headerText = trimmed.replace(/^#+\s*/, '');
            return (
              <div key={idx} style={{ marginTop: idx > 0 ? '0.9rem' : '0.2rem', marginBottom: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '4px', height: '18px', borderRadius: '4px', background: 'var(--primary)', flexShrink: 0, boxShadow: '0 0 10px var(--primary-glow)' }} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
                    {headerText}
                  </h4>
                </div>
              </div>
            );
          }

          // Check for list items: - item or • item
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const itemText = trimmed.replace(/^[-•]\s*/, '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', paddingLeft: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.65' }}>
                <span style={{ color: 'var(--primary)', fontSize: '0.95rem', lineHeight: '1.4', flexShrink: 0, fontWeight: 'bold' }}>•</span>
                <span>{itemText}</span>
              </div>
            );
          }

          // Regular paragraph text
          return (
            <p key={idx} style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.7' }}>
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  // Dedicated Full-Page Legal & Policy Renderer for Desktop
  const renderPolicyPage = (type: 'terms' | 'privacy' | 'acceptable_use') => {
    const policy = policies[type] || {
      title: 'Kebijakan Layanan',
      version: 'v1.0.0',
      content: 'Memuat kebijakan...'
    };

    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem 1.5rem', animation: 'fadeIn 0.3s ease-in-out' }}>
        {/* Main Content Card Panel */}
        <div className="glass-panel" style={{ padding: '2.5rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)', background: 'var(--card-bg-gradient)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)' }}>
          {renderFormattedPolicyContent(policy.content)}
        </div>
      </div>
    );
  };

  const [featuredStores, setFeaturedStores] = useState<any[]>([]);
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range
      }
    }
  }

  const restoreSelection = () => {
    if (savedRangeRef.current) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      }
    }
  }

  const [faunas, setFaunas] = useState<Fauna[]>([])
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true)

  // Stable gate logo ref to prevent mid-stream flickering/swapping during initialization
  const initialGateLogoRef = useRef<string | null>(null);
  if (!initialGateLogoRef.current) {
    const slug = getStoreSlug();
    if (slug) {
      const fastLogo = getFastStoreLogo(slug, '');
      if (fastLogo) {
        initialGateLogoRef.current = fastLogo;
      } else {
        try {
          const storeCached = localStorage.getItem(`catavor_store_${slug.toLowerCase()}`);
          if (storeCached) {
            const parsed = JSON.parse(storeCached);
            if (parsed?.store_logo_url) {
              initialGateLogoRef.current = parsed.store_logo_url;
            }
          }
        } catch {}
      }
    }
    if (!initialGateLogoRef.current) {
      initialGateLogoRef.current = APP_LOGO_BASE64;
    }
  }

  const [settings, setSettings] = useState<ShopSettings>(() => {
    try {
      const slug = getStoreSlug();
      if (slug) {
        const storeCached = localStorage.getItem(`catavor_store_${slug.toLowerCase()}`);
        if (storeCached) {
          const parsed = JSON.parse(storeCached);
          if (parsed && typeof parsed === 'object') {
            parsed.store_logo_url = getFastStoreLogo(slug, parsed.store_logo_url);
            return parsed;
          }
        }
      }
      const cached = localStorage.getItem('catavor_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          parsed.store_logo_url = getFastStoreLogo(slug, parsed.store_logo_url);
          return parsed;
        }
      }
    } catch {}
    return {
      whatsapp_number: '',
      store_slogan: 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis. & Pengiriman Seluruh Indonesia',
      promo_banner: '',
      articles_enabled: '1',
      store_title: 'Catavor',
      store_logo_url: '',
      store_theme: 'emerald',
      default_is_comments_enabled: '1',
      default_require_comment_approval: '0',
      default_require_comment_email: '0',
      default_verify_comment_email_domain: '0'
    };
  })
  const [selectedFauna, setSelectedFauna] = useState<Fauna | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [activePublicTab, setActivePublicTab] = useState<'catalog' | 'about' | 'sightings' | 'articles'>('catalog')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false)
  const [agreeCheckoutTerms, setAgreeCheckoutTerms] = useState<boolean>(false)
  const [previousPortalTab, setPreviousPortalTab] = useState<'login' | 'register' | 'home' | 'terms' | 'privacy' | 'acceptable_use' | 'checkout'>('home')
  const [agreeTermsError, setAgreeTermsError] = useState<boolean>(false)
  const [agreeCheckoutTermsError, setAgreeCheckoutTermsError] = useState<boolean>(false)
  const [showQuickPolicyModal, setShowQuickPolicyModal] = useState<'terms' | 'privacy' | 'acceptable_use' | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  // Navigation: 'catalog' or 'admin' or 'article-editor'
  const [view, setView] = useState<'catalog' | 'admin' | 'article-editor'>('catalog')
  const [adminTab, setAdminTab] = useState<'items' | 'notifications' | 'settings' | 'profile' | 'articles' | 'policies' | 'help'>('items')

  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, notifFilter]);

  // Support Ticket System State (Desktop)
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    try {
      const saved = localStorage.getItem('catavor_support_tickets');
      return saved ? JSON.parse(saved) : INITIAL_TICKETS;
    } catch (e) {
      return INITIAL_TICKETS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('catavor_support_tickets', JSON.stringify(tickets));
    } catch (e) {}
  }, [tickets]);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [showCreateTicketModal, setShowCreateTicketModal] = useState<boolean>(false);
  const [ticketReplyText, setTicketReplyText] = useState<string>('');

  const [newTicketForm, setNewTicketForm] = useState<{
    subject: string;
    category: SupportTicket['category'];
    priority: SupportTicket['priority'];
    message: string;
  }>({
    subject: '',
    category: 'payment',
    priority: 'normal',
    message: ''
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !ticketSearch.trim() || 
        t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) || 
        t.id.toLowerCase().includes(ticketSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (ticketFilter === 'active') return t.status === 'open' || t.status === 'in_progress';
      if (ticketFilter === 'resolved') return t.status === 'resolved' || t.status === 'closed';
      return true;
    });
  }, [tickets, ticketFilter, ticketSearch]);

  // Articles state
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState<boolean>(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [articleTabState, setArticleTabState] = useState<'hub' | 'articles' | 'comments'>('hub')
  const [adminComments, setAdminComments] = useState<CommentItem[]>([])
  const [loadingComments, setLoadingComments] = useState<boolean>(false)
  const [commentFilter, setCommentFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [commentsFilter, setCommentsFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    image_url: '',
    author: 'Admin Catavor',
    read_time: '5 mnt baca',
    slug: '',
    meta_description: '',
    is_comments_enabled: true,
    require_comment_approval: false,
    require_comment_email: false,
    verify_comment_email_domain: false
  })
  const [editorTab, setEditorTab] = useState<'compose' | 'html' | 'preview'>('compose')

  // Blogger-style Image Formatting states
  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null)
  const [showImageSettingsModal, setShowImageSettingsModal] = useState<boolean>(false)
  const [imageAltText, setImageAltText] = useState<string>('')
  const [imageCaptionText, setImageCaptionText] = useState<string>('')
  const [imageSizeSelection, setImageSizeSelection] = useState<'kecil' | 'sedang' | 'besar' | 'ekstrabesar' | 'asli'>('sedang')

  // Search & Filters (Multi-Type Hybrid Catalog Support)
  const [search, setSearch] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [habitatFilter, setHabitatFilter] = useState<string>('all')
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all')

  // Available Product Types in this store
  const availableProductTypes = useMemo(() => {
    const types = faunas.map(f => (f.product_type || 'physical') as ItemCategoryType).filter(Boolean);
    return Array.from(new Set(types));
  }, [faunas]);

  const isHybridStore = availableProductTypes.length > 1;

  // Dynamically derived filter options & filtered items strictly from store items (filtered by active product type)
  const availableCategories = useMemo(() => {
    const scopedFaunas = productTypeFilter === 'all' 
      ? faunas 
      : faunas.filter(f => (f.product_type || 'physical') === productTypeFilter);
    const cats = scopedFaunas.map(f => f.class).filter(Boolean);
    return Array.from(new Set(cats));
  }, [faunas, productTypeFilter]);

  const availableSubTypes = useMemo(() => {
    const scopedFaunas = productTypeFilter === 'all' 
      ? faunas 
      : faunas.filter(f => (f.product_type || 'physical') === productTypeFilter);
    const types = scopedFaunas.map(f => f.habitat).filter(Boolean);
    return Array.from(new Set(types));
  }, [faunas, productTypeFilter]);

  const filteredFaunas = useMemo(() => {
    return faunas.filter(item => {
      const itemType = item.product_type || 'physical';
      const matchesProductType = productTypeFilter === 'all' || itemType === productTypeFilter;
      const matchesSearch = !search.trim() || 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.scientific_name && item.scientific_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
      
      const matchesClass = classFilter === 'all' || item.class === classFilter;
      const matchesHabitat = habitatFilter === 'all' || item.habitat === habitatFilter;

      return matchesProductType && matchesSearch && matchesClass && matchesHabitat;
    });
  }, [faunas, search, classFilter, habitatFilter, productTypeFilter]);

  // Modals
  const [showCrudModal, setShowCrudModal] = useState<boolean>(false)
  const [isDetailActive, setIsDetailActive] = useState<boolean>(false)
  const [showPurchaseOptions, setShowPurchaseOptions] = useState<boolean>(false)
  const [showMarketplacesSubMenu, setShowMarketplacesSubMenu] = useState<boolean>(false)
  const [displayLimit, setDisplayLimit] = useState<number>(8)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  // Desktop Admin Inventory States & Filters
  const [adminSearch, setAdminSearch] = useState<string>('')
  const [adminProductTypeFilter, setAdminProductTypeFilter] = useState<'all' | 'physical' | 'food' | 'service' | 'digital' | 'fauna'>('all')
  const [adminClassFilter, setAdminClassFilter] = useState<string>('all')
  const [adminSortBy, setAdminSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'price_asc' | 'price_desc'>('newest')
  const [adminPage, setAdminPage] = useState<number>(1)
  const [adminPerPage, setAdminPerPage] = useState<number>(10)

  // Available categories for desktop admin inventory scoped to active product type
  const availableAdminCategories = useMemo(() => {
    const list = faunas
      .filter(f => adminProductTypeFilter === 'all' || (f.product_type || 'physical') === adminProductTypeFilter)
      .map(f => f.class)
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [faunas, adminProductTypeFilter]);

  // Filtered & Sorted Desktop Admin Inventory Items
  const filteredAdminItems = useMemo(() => {
    let result = faunas.filter((item) => {
      const itemType = (item.product_type || 'physical') as ItemCategoryType;
      const matchesSearch = !adminSearch.trim() ||
        item.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
        (item.scientific_name && item.scientific_name.toLowerCase().includes(adminSearch.toLowerCase())) ||
        (item.class && item.class.toLowerCase().includes(adminSearch.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(adminSearch.toLowerCase()));

      const matchesType = adminProductTypeFilter === 'all' || itemType === adminProductTypeFilter;
      const matchesClass = adminClassFilter === 'all' || item.class === adminClassFilter;

      return matchesSearch && matchesType && matchesClass;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      if (adminSortBy === 'oldest') return a.id - b.id;
      if (adminSortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (adminSortBy === 'price_asc') return a.price - b.price;
      if (adminSortBy === 'price_desc') return b.price - a.price;
      return b.id - a.id; // newest first default
    });

    return result;
  }, [faunas, adminSearch, adminProductTypeFilter, adminClassFilter, adminSortBy]);

  const totalAdminPages = Math.max(1, Math.ceil(filteredAdminItems.length / adminPerPage));
  const paginatedAdminItems = useMemo(() => {
    return filteredAdminItems.slice((adminPage - 1) * adminPerPage, adminPage * adminPerPage);
  }, [filteredAdminItems, adminPage, adminPerPage]);

  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('catavor_token'))
  const isPopStateRef = useRef<boolean>(false)
  const [adminUser, setAdminUser] = useState<{name: string, email: string, payment_status?: string, store_slug?: string, store_title?: string, store_plan?: string} | null>(
    localStorage.getItem('catavor_user') ? JSON.parse(localStorage.getItem('catavor_user')!) : null
  )
  const [isPasswordChanged, setIsPasswordChanged] = useState<boolean>(
    localStorage.getItem('catavor_password_changed') === 'true'
  )

  const isStoreOwner = Boolean(
    token &&
    adminUser &&
    storeSlug &&
    (
      (adminUser.store_slug && adminUser.store_slug.toLowerCase() === storeSlug.toLowerCase()) ||
      ((adminUser as any).username && (adminUser as any).username.toLowerCase() === storeSlug.toLowerCase())
    )
  );

  const [masterCategories, setMasterCategories] = useState<Record<ItemCategoryType, string[]>>(DEFAULT_MASTER_CATEGORIES)
  const [masterCategoryContextTab, setMasterCategoryContextTab] = useState<ItemCategoryType>('physical')
  const [masterClasses, setMasterClasses] = useState<string[]>(['Ikan Hias', 'Mamalia', 'Mamalia Kecil', 'Reptil'])
  const [masterHabitats, setMasterHabitats] = useState<string[]>(['Air Tawar', 'Air Laut', 'Darat'])
  const [masterStatuses, setMasterStatuses] = useState<string[]>(['Tersedia (For Sale)', 'Habis Terjual (Sold Out)', 'Terbatas (Limited)'])
  const [masterShippingCoverages, setMasterShippingCoverages] = useState<string[]>(['Bisa Kirim se-Indonesia', 'Pulau Jawa Saja', 'Ambil Sendiri di Toko (No Shipping)'])

  const [newClassInput, setNewClassInput] = useState('')
  const [newHabitatInput, setNewHabitatInput] = useState('')
  const [newStatusInput, setNewStatusInput] = useState('')
  const [newShippingInput, setNewShippingInput] = useState('')

  const [deleteMasterModalData, setDeleteMasterModalData] = useState<{
    field: 'class' | 'habitat' | 'conservation_status' | 'shipping_coverage'
    value: string
    replacementOptions: string[]
    selectedReplacement: string
  } | null>(null)

  const [renameMasterModalData, setRenameMasterModalData] = useState<{
    field: 'class' | 'habitat' | 'conservation_status' | 'shipping_coverage'
    fieldLabel: string
    oldValue: string
    newValue: string
  } | null>(null)

  const [presetModalData, setPresetModalData] = useState<{
    key: 'physical' | 'digital' | 'fauna' | 'service' | 'food' | 'general'
    title: string
    desc: string
    sampleCategories: string[]
  } | null>(null)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // First-time Password Change Form State
  const [firstPasswordForm, setFirstPasswordForm] = useState({
    name: 'Administrator',
    email: 'admin@catavor.com',
    password: '',
    confirm_password: ''
  })
  const [firstPasswordLoading, setFirstPasswordLoading] = useState(false)
  const [firstPasswordError, setFirstPasswordError] = useState<string | null>(null)

  // CRUD Form State
  const [crudMode, setCrudMode] = useState<'create' | 'edit'>('create')
  const [editId, setEditId] = useState<number | null>(null)
  const [crudForm, setCrudForm] = useState({
    name: '',
    scientific_name: '',
    class: 'Pakaian & Fashion',
    habitat: 'General',
    diet: '',
    conservation_status: 'Tersedia',
    price: 0,
    video_url: '',
    is_shipping_available: true,
    description: '',
    image_url: '',
    native_region: '',
    lifespan: '',
    weight: '',
    shipping_terms: '',
    warranty_info: '',
    shipping_coverage: 'Bisa Kirim se-Indonesia',
    purchase_links: [] as { platform: string, url: string }[],
    product_type: 'physical' as ItemCategoryType,
    attributes: {
      stock: 1,
      condition: 'Baru' as 'Baru' | 'Bekas' | 'Refurbished',
      weight: 100,
      brand: '',
      variant: '',
      download_url: '',
      file_format: 'PDF',
      file_size: '10 MB',
      license_type: 'Lisensi Personal',
      version: 'v1.0',
      scientific_name: '',
      fauna_class: 'Ikan Hias',
      fauna_status: 'Tersedia',
      duration: '1 Sesi / 1 Jam',
      service_location: 'Datang ke Toko',
      service_area: 'Jabodetabek',
      inclusions: '',
      client_requirements: '',
      portion_size: '1 Porsi',
      expired_info: 'Fresh Daily',
      storage_temp: 'Suhu Ruang',
      certification: '100% Halal',
      taste_options: '',
      spicy_level: '',
      prep_time: '',
      serving_method: 'Dine-in, Takeaway & Kurir Instan',
      cooking_guide: '',
      sugar_ice_options: '',
      bake_status: 'Freshly Baked Daily',
      serving_capacity: '',
      min_order: '',
      delivery_service: 'Mobil Antar Toko / Kurir Khusus',
      culinary_type: 'Makanan Siap Santap',
      min_purchase: '1 Pcs',
      max_purchase: ''
    }
  })

  // Dynamic Master dropdown custom inputs
  const [customClass, setCustomClass] = useState<string>('')
  const [showCustomClassInput, setShowCustomClassInput] = useState<boolean>(false)
  const [customHabitat, setCustomHabitat] = useState<string>('')
  const [showCustomHabitatInput, setShowCustomHabitatInput] = useState<boolean>(false)
  const [customConservationStatus, setCustomConservationStatus] = useState<string>('')
  const [showCustomConservationStatusInput, setShowCustomConservationStatusInput] = useState<boolean>(false)
  const [customShippingCoverage, setCustomShippingCoverage] = useState<string>('')
  const [showCustomShippingCoverageInput, setShowCustomShippingCoverageInput] = useState<boolean>(false)

  // Lightbox Galeri Interaktif
  const [showLightbox, setShowLightbox] = useState<boolean>(false)
  const [lightboxIndex, setLightboxIndex] = useState<number>(0)
  const [zoomScale, setZoomScale] = useState<number>(1)
  const [panPosition, setPanPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 })

  // Multi-image management states
  const [crudImages, setCrudImages] = useState<string[]>([''])
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<ShopSettings>(() => ({
    whatsapp_number: '',
    store_slogan: '',
    promo_banner: '',
    articles_enabled: '1',
    about_title: '',
    about_slogan: '',
    about_description: '',
    about_cards: '',
    about_location: '',
    about_hours: '',
    about_disclaimer: '',
    store_title: '',
    store_logo_url: '',
    store_theme: (settings as any)?.store_theme || 'emerald',
    default_is_comments_enabled: '1',
    default_require_comment_approval: '0',
    default_require_comment_email: '0',
    default_verify_comment_email_domain: '0'
  }))
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false)
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)
  const [settingsSubTab, setSettingsSubTabState] = useState<'general' | 'contact' | 'about' | 'theme' | 'master'>('general')

  const setSettingsSubTab = (sub: 'general' | 'contact' | 'about' | 'theme' | 'master') => {
    setSettingsSubTabState(sub);
    try { sessionStorage.setItem('catavor_last_settings_subtab', sub); } catch (e) {}
  };

  // First-time User Onboarding Notification for "Halaman Tentang Kami"
  const [dismissedAboutOnboarding, setDismissedAboutOnboarding] = useState<boolean>(() => {
    try {
      const slug = getStoreSlug() || 'default';
      return localStorage.getItem(`catavor_about_onboarding_dismissed_${slug}`) === 'true';
    } catch (e) {
      return false;
    }
  });

  const showAboutOnboarding = useMemo(() => {
    if (dismissedAboutOnboarding) return false;
    const loc = settingsForm.about_location || (settings as any)?.about_location || '';
    const desc = settingsForm.about_description || (settings as any)?.about_description || '';
    return !loc || !desc;
  }, [dismissedAboutOnboarding, settingsForm, settings]);

  const dismissAboutOnboarding = () => {
    setDismissedAboutOnboarding(true);
    try {
      const slug = getStoreSlug() || 'default';
      localStorage.setItem(`catavor_about_onboarding_dismissed_${slug}`, 'true');
    } catch (e) {}
  };

  // Admin Profile Update State
  const [profileForm, setProfileForm] = useState({
    name: adminUser?.name || 'Administrator',
    email: adminUser?.email || 'admin@catavor.com',
    password: ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [crudLoading, setCrudLoading] = useState<boolean>(false)
  const [crudError, setCrudError] = useState<string | null>(null)

  // Multi-Tenant Store Theme Syncing Engine (Strictly scoped to Unique Store Routes)
  useEffect(() => {
    if (storeSlug) {
      const activeTheme = (settings as any)?.store_theme || (settingsForm as any)?.store_theme || 'emerald';
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.body.setAttribute('data-theme', activeTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'emerald');
      document.body.setAttribute('data-theme', 'emerald');
    }
  }, [storeSlug, (settings as any)?.store_theme, (settingsForm as any)?.store_theme]);

  // Detect & parse URL path on mount (Desktop)
  useEffect(() => {
    const slug = getStoreSlug();
    setStoreSlug(slug);

    if (slug) {
      const path = window.location.pathname.toLowerCase();
      const parts = path.split('/').filter(Boolean);
      const urlParams = new URLSearchParams(window.location.search);

      if (parts.length >= 2) {
        const sub = parts[1];
        if (sub === 'admin') {
          setView('admin');
          const pageSub = parts[2] || urlParams.get('sub');
          const subSub = parts[3];
          const paramId = parts[4];

          if (pageSub === 'items') {
            setAdminTab('items');
            if (subSub === 'create' || subSub === 'new' || subSub === 'create-type' || subSub === 'select-type') {
              const prodType = parts[4];
              if (['physical', 'digital', 'service', 'food', 'fauna'].includes(prodType)) {
                setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
              }
              setCrudMode('create');
              setShowCrudModal(true);
            } else if (subSub === 'edit' && paramId) {
              let actualId = paramId;
              if (parts.length >= 5 && !isNaN(parseInt(parts[4], 10))) {
                actualId = parts[4];
              }
              setCrudMode('edit');
              setEditId(parseInt(actualId, 10));
              setShowCrudModal(true);
            }
          } else if (pageSub === 'articles') {
            setAdminTab('articles');
            if (subSub === 'comments') {
              setArticleTabState('comments');
            } else if (subSub === 'create' || subSub === 'new') {
              setView('article-editor');
              setEditingArticle(null);
            }
          } else if (pageSub === 'settings') {
            setAdminTab('settings');
            const sec = subSub || urlParams.get('section');
            let mappedSec = sec ? sec.toLowerCase().trim() : '';
            if (mappedSec === 'social') mappedSec = 'contact';
            if (mappedSec === 'features') mappedSec = 'general';
            if (['general', 'contact', 'about', 'theme', 'master'].includes(mappedSec)) {
              setSettingsSubTab(mappedSec as any);
            } else {
              const saved = sessionStorage.getItem('catavor_last_settings_subtab');
              if (saved && ['general', 'contact', 'about', 'theme', 'master'].includes(saved)) {
                setSettingsSubTab(saved as any);
              } else {
                setSettingsSubTab('general');
              }
            }
          } else if (pageSub === 'profile') setAdminTab('profile');
          else if (pageSub === 'policies') setAdminTab('policies');
          else if (pageSub === 'notifications') setAdminTab('notifications');
          else if (pageSub === 'help' || pageSub === 'bantuan') {
            setAdminTab('help');
            const ticketParam = urlParams.get('ticket');
            if (ticketParam) {
              const savedTickets = (() => {
                try {
                  const s = localStorage.getItem('catavor_support_tickets');
                  return s ? JSON.parse(s) : INITIAL_TICKETS;
                } catch {
                  return INITIAL_TICKETS;
                }
              })();
              const found = savedTickets.find((t: any) => t.id.toLowerCase() === ticketParam.toLowerCase());
              if (found) setSelectedTicket(found);
            }
          } else setAdminTab('items');
        } else if (sub === 'about') {
          setView('catalog');
          setActivePublicTab('about');
          const subSub = parts[2];
          if (subSub === 'share' || subSub === 'qrcode' || subSub === 'qr' || urlParams.get('sub') === 'share' || urlParams.get('sub') === 'qrcode') {
            setShowQRModal(true);
          } else {
            setShowQRModal(false);
          }
        } else if (sub === 'share' || sub === 'qrcode' || sub === 'qr') {
          setView('catalog');
          setActivePublicTab('about');
          setShowQRModal(true);
        } else if (sub === 'sightings') {
          setView('catalog');
          setActivePublicTab('sightings');
        } else if (sub === 'articles') {
          setView('catalog');
          setActivePublicTab('articles');
        }
      } else {
        const qTab = urlParams.get('tab');
        if (qTab === 'admin') {
          setView('admin');
          const pageSub = urlParams.get('sub');
          if (pageSub === 'items') setAdminTab('items');
          else if (pageSub === 'articles') setAdminTab('articles');
          else if (pageSub === 'settings') {
            setAdminTab('settings');
            const sec = urlParams.get('section');
            let mappedSec = sec ? sec.toLowerCase().trim() : '';
            if (mappedSec === 'social') mappedSec = 'contact';
            if (mappedSec === 'features') mappedSec = 'general';
            if (['general', 'contact', 'about', 'theme', 'master'].includes(mappedSec)) {
              setSettingsSubTab(mappedSec as any);
            } else {
              const saved = sessionStorage.getItem('catavor_last_settings_subtab');
              if (saved && ['general', 'contact', 'about', 'theme', 'master'].includes(saved)) {
                setSettingsSubTab(saved as any);
              } else {
                setSettingsSubTab('general');
              }
            }
          } else if (pageSub === 'profile') setAdminTab('profile');
          else if (pageSub === 'policies') setAdminTab('policies');
          else if (pageSub === 'notifications') setAdminTab('notifications');
          else if (pageSub === 'help' || pageSub === 'bantuan') {
            setAdminTab('help');
            const ticketParam = urlParams.get('ticket');
            if (ticketParam) {
              const savedTickets = (() => {
                try {
                  const s = localStorage.getItem('catavor_support_tickets');
                  return s ? JSON.parse(s) : INITIAL_TICKETS;
                } catch {
                  return INITIAL_TICKETS;
                }
              })();
              const found = savedTickets.find((t: any) => t.id.toLowerCase() === ticketParam.toLowerCase());
              if (found) setSelectedTicket(found);
            }
          }
        } else if (qTab === 'about') { setView('catalog'); setActivePublicTab('about'); }
        else if (qTab === 'sightings') { setView('catalog'); setActivePublicTab('sightings'); }
        else if (qTab === 'articles') { setView('catalog'); setActivePublicTab('articles'); }
        else { setView('catalog'); setActivePublicTab('catalog'); }
      }
    }

    // STRICT FLOW: If the user visits the admin page on mount but they haven't completed changing their password,
    // force them to log in again with the default password.
    if (localStorage.getItem('catavor_password_changed') !== 'true') {
      localStorage.removeItem('catavor_token')
      localStorage.removeItem('catavor_user')
      localStorage.removeItem('catavor_password_changed')
      setToken(null)
      setAdminUser(null)
      setIsPasswordChanged(false)
    }
  }, [adminUser, token])

  // Auto-open fauna item modal if ?item=ID is in URL or /admin/items/edit/ID
  useEffect(() => {
    if (!faunas || faunas.length === 0) return;
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[1] === 'admin' && parts[2] === 'items' && parts[3] === 'edit') {
      const targetId = parseInt(parts[4], 10);
      const found = faunas.find(f => f.id === targetId);
      if (found && (!showCrudModal || editId !== targetId)) {
        openEditModal(found);
      }
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('item');
    if (itemId && !selectedFauna) {
      const found = faunas.find(f => f.id.toString() === itemId);
      if (found) setSelectedFauna(found);
    }
  }, [faunas]);

  // Auto-open article modal if ?article=ID_OR_SLUG is in URL or /admin/articles/edit/ID
  useEffect(() => {
    if (!articles || articles.length === 0) return;
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[1] === 'admin' && parts[2] === 'articles' && parts[3] === 'edit') {
      const artId = parts[4];
      const found = articles.find(a => a.id.toString() === artId || a.slug === artId);
      if (found && (!editingArticle || editingArticle.id !== found.id)) {
        openEditArticleModal(found);
      }
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('article');
    if (articleId && !selectedArticle) {
      const found = articles.find(a => a.id.toString() === articleId || a.slug === articleId);
      if (found) setSelectedArticle(found);
    }
  }, [articles]);

  // Redirect if article module is disabled
  useEffect(() => {
    if (settings.articles_enabled === '0') {
      if (adminTab === 'articles') {
        setAdminTab('items')
      }
    }
  }, [settings.articles_enabled, adminTab])

  // Lock scroll when modals are open
  useEffect(() => {
    if (showCrudModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showCrudModal])

  // Listen to popstate for back navigation & gesture support across clean URL paths (/ , /login , /register/step-X)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      const slug = getStoreSlug();
      setStoreSlug(slug);
      if (slug) {
        const path = window.location.pathname.toLowerCase();
        const parts = path.split('/').filter(Boolean);
        const urlParams = new URLSearchParams(window.location.search);

        if (parts.length >= 2) {
          const sub = parts[1];
          if (sub === 'admin') {
            setView('admin');
            const pageSub = parts[2] || urlParams.get('sub');
            const subSub = parts[3];
            const paramId = parts[4];

            if (pageSub === 'items') {
              setAdminTab('items');
              if (subSub === 'create' || subSub === 'new' || subSub === 'create-type' || subSub === 'select-type') {
                const prodType = parts[4];
                if (['physical', 'digital', 'service', 'food', 'fauna'].includes(prodType)) {
                  setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
                }
                setCrudMode('create');
                setShowCrudModal(true);
              } else if (subSub === 'edit' && paramId) {
                let actualId = paramId;
                if (parts.length >= 5 && !isNaN(parseInt(parts[4], 10))) {
                  actualId = parts[4];
                }
                setCrudMode('edit');
                setEditId(parseInt(actualId, 10));
                setShowCrudModal(true);
              } else {
                setShowCrudModal(false);
              }
            } else if (pageSub === 'articles') {
              setAdminTab('articles');
              if (subSub === 'comments') {
                setArticleTabState('comments');
                setView('admin');
              } else if (subSub === 'create' || subSub === 'new') {
                setView('article-editor');
                setEditingArticle(null);
              } else if (subSub === 'edit' && paramId) {
                const found = articles.find(a => a.id.toString() === paramId || a.slug === paramId);
                if (found) {
                  setView('article-editor');
                  setEditingArticle(found);
                }
              } else {
                setView('admin');
                setArticleTabState('articles');
              }
            } else if (pageSub === 'settings') {
              setAdminTab('settings');
              setView('admin');
              const sec = subSub || urlParams.get('section');
              let mappedSec = sec ? sec.toLowerCase().trim() : '';
              if (mappedSec === 'social') mappedSec = 'contact';
              if (mappedSec === 'features') mappedSec = 'general';
              if (['general', 'contact', 'about', 'theme', 'master'].includes(mappedSec)) {
                setSettingsSubTab(mappedSec as any);
              } else {
                const saved = sessionStorage.getItem('catavor_last_settings_subtab');
                if (saved && ['general', 'contact', 'about', 'theme', 'master'].includes(saved)) {
                  setSettingsSubTab(saved as any);
                } else {
                  setSettingsSubTab('general');
                }
              }
            } else if (pageSub === 'profile') {
              setAdminTab('profile');
              setView('admin');
            } else if (pageSub === 'policies') {
              setAdminTab('policies');
              setView('admin');
            } else if (pageSub === 'notifications') {
              setAdminTab('notifications');
              setView('admin');
            } else if (pageSub === 'help' || pageSub === 'bantuan') {
              setAdminTab('help');
              setView('admin');
              const ticketParam = urlParams.get('ticket');
              if (ticketParam) {
                const savedTickets = (() => {
                  try {
                    const s = localStorage.getItem('catavor_support_tickets');
                    return s ? JSON.parse(s) : INITIAL_TICKETS;
                  } catch {
                    return INITIAL_TICKETS;
                  }
                })();
                const found = savedTickets.find((t: any) => t.id.toLowerCase() === ticketParam.toLowerCase());
                if (found) setSelectedTicket(found);
              }
            } else {
              setAdminTab('items');
              setView('admin');
            }
          } else if (sub === 'about') { setView('catalog'); setActivePublicTab('about'); }
          else if (sub === 'sightings') { setView('catalog'); setActivePublicTab('sightings'); }
          else if (sub === 'articles') { setView('catalog'); setActivePublicTab('articles'); }
          else { setView('catalog'); setActivePublicTab('catalog'); }
        } else {
          setView('catalog');
          setActivePublicTab('catalog');
        }
        return;
      }

      const path = window.location.pathname.toLowerCase();
      const urlParams = new URLSearchParams(window.location.search);
      const urlPlan = urlParams.get('plan');

      if (path === '/login') {
        setPortalTab('login');
      } else if (path === '/register' || path === '/register/step-1') {
        setPortalTab('register');
        setRegisterStep(1);
      } else if (path === '/register/step-2') {
        setPortalTab('register');
        setRegisterStep(2);
      } else if (path === '/register/step-3') {
        setPortalTab('register');
        setRegisterStep(3);
        if (urlPlan === 'free' || urlPlan === 'pro') setRegisterPlan(urlPlan);
      } else if (path === '/terms' || path === '/syarat-ketentuan') {
        setPortalTab('terms');
      } else if (path === '/privacy' || path === '/kebijakan-privasi') {
        setPortalTab('privacy');
      } else if (path === '/acceptable-use' || path === '/acceptable_use' || path === '/ketentuan-penggunaan') {
        setPortalTab('acceptable_use');
      } else if (path === '/' || path === '') {
        setPortalTab('home');
      } else if (event.state?.tab) {
        setPortalTab(event.state.tab);
        if (event.state.step) setRegisterStep(event.state.step);
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync active portalTab to Browser Address Bar URL and Session Storage
  useEffect(() => {
    if (storeSlug) return;
    let targetPath = '/';
    if (portalTab === 'login') targetPath = '/login';
    else if (portalTab === 'register') targetPath = `/register/step-${registerStep}`;
    else if (portalTab === 'terms') targetPath = '/terms';
    else if (portalTab === 'privacy') targetPath = '/privacy';
    else if (portalTab === 'acceptable_use') targetPath = '/acceptable-use';

    if (window.location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
      window.history.pushState({ tab: portalTab, step: registerStep }, '', targetPath);
    }
    sessionStorage.setItem('catavor_portal_tab', portalTab);
  }, [portalTab, registerStep, storeSlug]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [view, adminTab, settingsSubTab, selectedTicket]);

  // Fetch headers helper
  const getAuthHeaders = () => {
    const slug = getStoreSlug();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(slug ? { 'X-Store-Slug': slug } : {})
    }
  }

  const isInvalidRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    const reservedPortal = ['api', 'sanctum', 'desktop', 'mobile', 'assets', 'login', 'register', 'terms', 'privacy', 'acceptable-use', 'acceptable_use', 'syarat-ketentuan', 'kebijakan-privasi', 'ketentuan-penggunaan'];
    
    if (parts.length === 0) return false;
    if (parts.length === 1) return false;
    if (parts[0] === 'register') return false;
    
    if (!reservedPortal.includes(parts[0])) {
      const storeSub = parts[1];
      const validStoreSubs = ['admin', 'about', 'sightings', 'articles'];
      if (validStoreSubs.includes(storeSub)) {
        return false;
      }
    }
    
    return true;
  };

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    setError(null);

    if (isInvalidRoute()) {
      setError('Halaman / Tautan Tidak Ditemukan.');
      setLoading(false);
      return;
    }

    const slug = getStoreSlug();
    
    try {
      if (slug) {
        // Fetch store-specific profile
        const settingsRes = await fetch(`${API_BASE}/u/${slug}`);
        const settingsData = await settingsRes.json();
        
        if (settingsData.success && settingsData.data) {
          const store = settingsData.data;
          const fetchedSettings = {
            plan: store.plan || 'free',
            enable_wa_direct: store.enable_wa_direct !== undefined ? store.enable_wa_direct : true,
            enable_wa_rekber: store.enable_wa_rekber !== undefined ? store.enable_wa_rekber : true,
            whatsapp_number: store.whatsapp_number || '',
            store_slogan: store.store_slogan || 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis.',
            promo_banner: store.promo_banner || '',
            articles_enabled: '0', // force articles module hidden
            about_title: store.about_title || '',
            about_slogan: store.about_slogan || '',
            about_description: store.about_description || '',
            about_cards: store.about_cards ? JSON.stringify(store.about_cards) : '',
            about_location: store.about_location || '',
            about_hours: store.about_hours || '',
            show_hours: store.show_hours !== undefined ? Boolean(store.show_hours) : false,
            about_disclaimer: store.about_disclaimer || '',
            social_links: store.social_links ? JSON.stringify(store.social_links) : '',
            official_website: store.official_website || '',
            store_title: store.store_title || 'Catavor',
            store_logo_url: store.store_logo_url || '',
            store_theme: store.store_theme || 'emerald',
            default_is_comments_enabled: '0',
            default_require_comment_approval: '0',
            default_require_comment_email: '0',
            default_verify_comment_email_domain: '0'
          };
          
          // Preload and convert custom store logo to Base64 in RAM/Storage FIRST
          if (fetchedSettings.store_logo_url) {
            try {
              cacheLogoAsBase64(slug, fetchedSettings.store_logo_url);
              await new Promise<void>((resolve) => {
                const img = new window.Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = fetchedSettings.store_logo_url;
                setTimeout(resolve, 300);
              });
            } catch {}
            // Use fast Base64 data URI if available
            fetchedSettings.store_logo_url = getFastStoreLogo(slug, fetchedSettings.store_logo_url);
          }
          
          setSettings(fetchedSettings);
          try {
            if (slug) {
              localStorage.setItem(`catavor_store_${slug.toLowerCase()}`, JSON.stringify(fetchedSettings));
            }
            localStorage.setItem('catavor_settings', JSON.stringify(fetchedSettings));
          } catch {}
          if (token && adminUser && slug && (adminUser.store_slug?.toLowerCase() === slug.toLowerCase() || (adminUser as any).username?.toLowerCase() === slug.toLowerCase())) {
            setSettingsForm(fetchedSettings);
          }
          
          if (store.master_categories) {
            setMasterCategories(prev => ({
              ...DEFAULT_MASTER_CATEGORIES,
              ...store.master_categories
            }));
          }
          if (store.master_classes) setMasterClasses(store.master_classes);
          if (store.master_habitats) setMasterHabitats(store.master_habitats);
          if (store.master_statuses) setMasterStatuses(store.master_statuses);
          if (store.master_shipping_coverages) setMasterShippingCoverages(store.master_shipping_coverages);

          // Fetch store-scoped fauna catalog
          const params = new URLSearchParams();
          if (search) params.append('search', search);
          if (classFilter !== 'all') params.append('class', classFilter);
          if (habitatFilter !== 'all') params.append('habitat', habitatFilter);

          const faunaRes = await fetch(`${API_BASE}/u/${slug}/fauna?${params.toString()}`);
          const faunaData = await faunaRes.json();
          if (faunaData.success) {
            setFaunas(faunaData.data);
          } else {
            setError(faunaData.message || 'Gagal memuat katalog.');
          }
        } else {
          setError(settingsData.message || 'Katalog / Store tidak ditemukan.');
        }
      } else {
        // Portal mode: Fetch featured stores
        const featuredRes = await fetch(`${API_BASE}/stores/featured`);
        const featuredData = await featuredRes.json();
        if (featuredData.success) {
          setFeaturedStores(featuredData.data);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi terputus. Pastikan server backend Laravel berjalan di http://localhost:8000.');
    } finally {
      setLoading(false);
      setTimeout(() => setIsAppInitializing(false), 200);
    }
  };

  const fetchArticles = async () => {
    setArticlesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/articles`)
      const data = await res.json()
      if (data.success) {
        setArticles(data.data)
      }
    } catch (err) {
      console.error('Error fetching articles:', err)
    } finally {
      setArticlesLoading(false)
    }
  }
  // Share store link (direct to Share / QR modal)
  const handleShareStore = () => {
    setView('catalog');
    setActivePublicTab('about');
    setShowQRModal(true);
    const slug = storeSlug || getStoreSlug();
    if (slug) {
      window.history.pushState({}, '', `/${slug}/about/share`);
    }
  };

  // Share specific fauna item link
  const handleShareItem = (item: any) => {
    const itemUrl = `${window.location.origin}/${storeSlug}?item=${item.id}`;
    navigator.clipboard.writeText(itemUrl).then(() => {
      showToast('Tautan produk berhasil disalin ke papan klip!');
    }).catch(err => {
      console.error('Failed to copy product link: ', err);
      showToast('Gagal menyalin tautan.', 'error');
    });
  };

  // Auto-open product detail from query params on load
  useEffect(() => {
    if (faunas.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get('item');
      if (itemId) {
        const item = faunas.find(f => f.id === parseInt(itemId));
        if (item) {
          setSelectedFauna(item);
          setIsDetailActive(true);
        }
      }
    }
  }, [faunas]);


  const fetchAdminComments = async () => {
    setLoadingComments(true)
    try {
      const res = await fetch(`${API_BASE}/admin/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (data.success) {
        setAdminComments(data.data)
      }
    } catch (err) {
      console.error('Error fetching admin comments:', err)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus komentar ini?')) return
    try {
      const res = await fetch(`${API_BASE}/admin/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (data.success) {
        showToast('Komentar berhasil dihapus!')
        await fetchAdminComments()
      } else {
        showToast(data.message || 'Gagal menghapus komentar.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi bermasalah. Gagal menghapus komentar.', 'error')
    }
  }

  const handleApproveComment = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/comments/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (data.success) {
        showToast('Komentar berhasil disetujui!')
        await fetchAdminComments()
      } else {
        showToast(data.message || 'Gagal menyetujui komentar.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi bermasalah. Gagal menyetujui komentar.', 'error')
    }
  }

  // Synchronize article editor visual contenteditable
  useEffect(() => {
    if (view === 'article-editor' && editorTab === 'compose' && editorRef.current) {
      if (editorRef.current.innerHTML !== articleForm.content) {
        editorRef.current.innerHTML = articleForm.content
      }
    }
  }, [view, editorTab, articleForm.content])

  // Reload when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData()
    }, 200)
    return () => clearTimeout(delayDebounceFn)
  }, [search, classFilter, habitatFilter, storeSlug])
  // Sync view state, admin tab, sub-sub-paths, settings section, public tab & open modals to browser URL pathname
  useEffect(() => {
    if (!storeSlug || error || isInvalidRoute()) return;

    let targetPath = `/${storeSlug}`;
    const params = new URLSearchParams();

    if (view === 'article-editor') {
      if (editingArticle) {
        targetPath += `/admin/articles/edit/${editingArticle.id}`;
      } else {
        targetPath += `/admin/articles/create`;
      }
    } else if (view === 'admin') {
      if (adminTab === 'items') {
        if (showCrudModal) {
          if (crudMode === 'create') {
            targetPath += `/admin/items/create`;
          } else if (crudMode === 'edit' && editId) {
            targetPath += `/admin/items/edit/${editId}`;
          } else {
            targetPath += `/admin/items`;
          }
        } else {
          targetPath += `/admin/items`;
        }
      } else if (adminTab === 'articles') {
        if (articleTabState === 'comments') {
          targetPath += `/admin/articles/comments`;
        } else {
          targetPath += `/admin/articles`;
        }
      } else if (adminTab === 'settings') {
        const sec = settingsSubTab || 'general';
        targetPath += `/admin/settings/${sec}`;
      } else if (adminTab === 'profile') {
        targetPath += `/admin/profile`;
      } else if (adminTab === 'policies') {
        targetPath += `/admin/policies`;
      } else if (adminTab === 'notifications') {
        targetPath += `/admin/notifications`;
      } else if (adminTab === 'help') {
        targetPath += `/admin/help`;
        if (selectedTicket) {
          params.set('ticket', selectedTicket.id);
        }
      } else {
        targetPath += `/admin/items`;
      }
    } else {
      if (activePublicTab === 'about') {
        if (showQRModal) {
          targetPath += `/about/share`;
        } else {
          targetPath += `/about`;
        }
      } else if (activePublicTab === 'sightings') {
        targetPath += `/sightings`;
      } else if (activePublicTab === 'articles') {
        targetPath += `/articles`;
      }
    }

    if (selectedFauna && !showCrudModal) {
      params.set('item', selectedFauna.id.toString());
    } else if (selectedArticle && view !== 'article-editor') {
      params.set('article', selectedArticle.slug || selectedArticle.id.toString());
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const fullTarget = `${targetPath}${queryString}`;

    if (window.location.pathname + window.location.search !== fullTarget) {
      if (isPopStateRef.current) {
        isPopStateRef.current = false;
        window.history.replaceState(
          { view, adminTab, settingsSubTab, activePublicTab, item: selectedFauna?.id, article: selectedArticle?.id, ticket: selectedTicket?.id },
          '',
          fullTarget
        );
      } else {
        window.history.pushState(
          { view, adminTab, settingsSubTab, activePublicTab, item: selectedFauna?.id, article: selectedArticle?.id, ticket: selectedTicket?.id },
          '',
          fullTarget
        );
      }
    }
  }, [view, adminTab, settingsSubTab, showQRModal, showCrudModal, crudMode, editId, editingArticle, articleTabState, activePublicTab, selectedFauna, selectedArticle, selectedTicket, storeSlug, error]);


  // Sync Onboarding & Portal State to Industry Standard Clean URLs (/ , /login , /register/step-X)
  useEffect(() => {
    if (storeSlug || error || isInvalidRoute()) return;

    sessionStorage.setItem('catavor_portal_tab', portalTab);
    sessionStorage.setItem('catavor_register_step', registerStep.toString());
    sessionStorage.setItem('catavor_register_plan', registerPlan);
    sessionStorage.setItem('catavor_register_form', JSON.stringify(registerForm));

    let targetPath = '/';
    if (portalTab === 'login') {
      targetPath = '/login';
    } else if (portalTab === 'register') {
      if (registerStep === 1) targetPath = '/register';
      else if (registerStep === 2) targetPath = '/register/step-2';
      else if (registerStep === 3) targetPath = `/register/step-3${registerPlan !== 'free' ? '?plan=' + registerPlan : ''}`;
    }

    const currentFull = window.location.pathname + window.location.search;

    if (currentFull !== targetPath) {
      window.history.pushState(
        { tab: portalTab, step: registerStep, plan: registerPlan },
        '',
        targetPath
      );
    }
  }, [portalTab, registerStep, registerPlan, registerForm, storeSlug, error]);

  // Reset displayLimit on search or filter change
  useEffect(() => {
    setDisplayLimit(8)
  }, [search, classFilter, habitatFilter])

  // Infinite scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      if (isDetailActive || loadingMore) return
      if (displayLimit >= faunas.length) return
      const threshold = 100
      const position = window.innerHeight + window.scrollY
      const limit = document.documentElement.scrollHeight - threshold
      if (position >= limit) {
        setLoadingMore(true)
        setTimeout(() => {
          setDisplayLimit(prev => Math.min(prev + 8, faunas.length))
          setLoadingMore(false)
        }, 1200)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [faunas.length, isDetailActive, loadingMore, displayLimit])

  // Sync profile form when user state loads
  useEffect(() => {
    if (adminUser) {
      setProfileForm(prev => ({
        ...prev,
        name: adminUser.name,
        email: adminUser.email
      }))
      setFirstPasswordForm(prev => ({
        ...prev,
        name: adminUser.name,
        email: adminUser.email
      }))
    }
  }, [adminUser])

  // Auth check helper & Industry-standard session expiration handler
  const handleUnauthorized = (msg = 'Sesi Anda telah berakhir. Silakan login kembali.') => {
    localStorage.removeItem('catavor_token')
    localStorage.removeItem('catavor_user')
    localStorage.removeItem('catavor_password_changed')
    setToken(null)
    setAdminUser(null)
    setIsPasswordChanged(true)
    setView('admin')
    setAdminTab('items')
    setLoginForm({ email: '', password: '' })
    showToast(msg, 'error')
  }

  const checkAuthResponse = (res: Response, data?: any) => {
    if (res.status === 401 || (data && (data.message === 'Unauthenticated.' || data.message === 'Unauthenticated'))) {
      handleUnauthorized()
      return false
    }
    return true
  }

  // Real Google OAuth 2.0 SSO Handler (Google Accounts Popup Window & GSI API)
  const processGoogleUserPayload = async (googleUser: { email: string; name: string; google_id: string; avatar?: string }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleUser.email,
          name: googleUser.name,
          google_id: googleUser.google_id,
          avatar: googleUser.avatar,
          plan: registerPlan
        })
      });

      const data = await res.json();
      if (data.success) {
        if (data.token && data.user && data.user.store_slug) {
          // Existing User with complete store -> Immediate Auto Login to Admin Dashboard
          localStorage.setItem('catavor_token', data.token);
          localStorage.setItem('catavor_user', JSON.stringify(data.user));
          localStorage.setItem('catavor_password_changed', 'true');
          setToken(data.token);
          setAdminUser(data.user);
          setIsPasswordChanged(true);
          setStoreSlug(data.user.store_slug);
          setView('admin');
          setPortalTab('home');
          showToast('Selamat datang kembali! Akun Google Anda telah terdaftar, otomatis masuk ke Dashboard.', 'success');
          sessionStorage.clear();
        } else {
          // New User OR User without completed store_slug -> Redirect to Store Setup Screen (Step 2)
          if (data.token && data.user) {
            localStorage.setItem('catavor_token', data.token);
            localStorage.setItem('catavor_user', JSON.stringify(data.user));
            setToken(data.token);
            setAdminUser(data.user);
          }
          const userEmail = data.user?.email || googleUser.email;
          const userName = data.user?.name || googleUser.name;
          const userGoogleId = data.user?.google_id || googleUser.google_id;
          const userAvatar = data.user?.avatar || googleUser.avatar;

          setRegisterForm((prev: any) => ({
            ...prev,
            email: userEmail,
            name: userName,
            google_id: userGoogleId,
            avatar: userAvatar,
            store_name: prev.store_name || '',
            store_slug: prev.store_slug || ''
          }));
          setRegisterStep(2);
          setPortalTab('register');
          showToast('Otentikasi Google Berhasil! Silakan lengkapi Informasi Toko & Link Username Anda di Langkah 2.', 'info');
        }
      } else {
        showToast(data.message || 'Gagal otentikasi Google SSO.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan saat otentikasi Google SSO.', 'error');
    }
  };

  const handleGoogleSSO = () => {
    const googleClientId = (window as any).GOOGLE_CLIENT_ID || '847403664953-ef7k9h5n99mtlnbdpr4a6300dt83efk5.apps.googleusercontent.com';

    // 1. Try Google Identity Services GSI Token Client SDK
    if ((window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const googleUser = await userInfoRes.json();
                processGoogleUserPayload({
                  email: googleUser.email,
                  name: googleUser.name,
                  google_id: googleUser.sub,
                  avatar: googleUser.picture
                });
              } catch (err) {
                console.error('UserInfo fetch failed:', err);
              }
            }
          }
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn('GSI Token Client init error, switching to OAuth Popup:', err);
      }
    }

    // 2. Real Google OAuth 2.0 Popup Window (100% Real Google Authorization Window)
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent('email profile openid');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    
    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(authUrl, 'google_oauth_popup', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      alert('Popup diblokir oleh browser Anda. Silakan izinkan popup untuk login dengan Google.');
      return;
    }

    const checkPopup = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          return;
        }
        if (popup.location.href.includes('access_token=')) {
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          popup.close();
          clearInterval(checkPopup);

          if (accessToken) {
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
            .then(res => res.json())
            .then(googleUser => {
              processGoogleUserPayload({
                email: googleUser.email,
                name: googleUser.name,
                google_id: googleUser.sub,
                avatar: googleUser.picture
              });
            })
            .catch(err => console.error(err));
          }
        }
      } catch (e) {
        // Cross-origin check before OAuth redirect is expected
      }
    }, 400);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setAgreeTermsError(true);
      showToast('Silakan centang persetujuan Syarat & Ketentuan serta Kebijakan Privasi terlebih dahulu.', 'error');
      return;
    }
    setAgreeTermsError(false);
    if (registerPlan === 'pro') {
      // Defer API registration & token storage until checkout submission!
      setPortalTab('checkout');
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ ...registerForm, plan: 'free', payment_status: 'none', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta' })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('catavor_token', data.token);
        localStorage.setItem('catavor_user', JSON.stringify(data.user));
        localStorage.setItem('catavor_password_changed', 'true');
        
        setToken(data.token);
        setAdminUser(data.user);
        setIsPasswordChanged(true);
        setRegisterForm({ name: '', email: '', password: '', store_name: '', store_slug: '' });
        setStoreSlug(data.user.store_slug);
        setView('admin');

        // Dynamic Notifications for FREE Plan Registration
        setNotifications([
          {
            id: Date.now() + 1,
            title: '🎉 Selamat Datang di Catavor!',
            message: 'Akun usaha Anda berhasil dibuat! Mulai tambahkan postingan produk pertama Anda ke dalam katalog.',
            time: 'Baru saja',
            read: false,
            type: 'success'
          },
          {
            id: Date.now() + 2,
            title: 'ℹ️ Informasi Paket: Plan Free',
            message: 'Akun Anda saat ini menggunakan Plan Free (maksimal 10 postingan produk). Anda dapat melakukan upgrade ke Plan Pro kapan saja.',
            time: 'Baru saja',
            read: false,
            type: 'info'
          }
        ]);
      } else {
        if (data.errors) {
          const firstErr = Object.values(data.errors)[0] as string[];
          setRegisterError(firstErr[0] || 'Gagal mendaftar.');
        } else {
          setRegisterError(data.message || 'Registrasi gagal.');
        }
      }
    } catch (err) {
      console.error(err);
      setRegisterError('Koneksi terputus. Pastikan server backend Laravel aktif.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const processCheckoutSubmission = async (isFreeCoupon: boolean) => {
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const payload = {
        ...registerForm,
        plan: 'pro',
        payment_status: isFreeCoupon ? 'approved' : 'pending_approval',
        payment_proof_url: isFreeCoupon ? null : paymentProofPreview,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'
      };

      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('catavor_token', data.token);
        localStorage.setItem('catavor_user', JSON.stringify(data.user));
        localStorage.setItem('catavor_password_changed', 'true');

        setToken(data.token);
        setAdminUser(data.user);
        setIsPasswordChanged(true);
        setShowPaymentSuccessModal(true);

        const newNotifs: any[] = [
          {
            id: Date.now() + 1,
            title: '🎉 Selamat Datang di Catavor!',
            message: isFreeCoupon 
              ? 'Akun usaha Anda berhasil dibuat! Selamat menikmati seluruh fitur premium platform Catavor.'
              : 'Akun usaha Anda berhasil dibuat! Selamat datang di platform katalog digital Catavor.',
            time: 'Baru saja',
            read: false,
            type: 'success'
          }
        ];

        if (appliedCoupon) {
          if (appliedCoupon.type === 'free') {
            newNotifs.push({
              id: Date.now() + 2,
              title: `🏷️ Kupon Gratis Diterapkan: ${appliedCoupon.code}`,
              message: `Kupon "${appliedCoupon.code}" (${appliedCoupon.label}) berhasil membebaskan seluruh biaya pendaftaran 100%.`,
              time: 'Baru saja',
              read: false,
              type: 'success'
            });
            newNotifs.push({
              id: Date.now() + 3,
              title: '⚡ Aktivasi Paket Pro Berhasil (100% Gratis)',
              message: 'Selamat! Paket Pro Anda langsung aktif tanpa perlu menunggu verifikasi admin. Nikmati postingan produk unlimited dan fitur toko eksklusif.',
              time: 'Baru saja',
              read: false,
              type: 'success'
            });
          } else {
            const finalPrice = Math.max(0, 30000 - appliedCoupon.discount);
            newNotifs.push({
              id: Date.now() + 2,
              title: `🏷️ Kupon Diskon Diterapkan: ${appliedCoupon.code}`,
              message: `Kupon "${appliedCoupon.code}" memberikan potongan harga Rp ${appliedCoupon.discount.toLocaleString('id-ID')}. Total tagihan Anda menjadi Rp ${finalPrice.toLocaleString('id-ID')}.`,
              time: 'Baru saja',
              read: false,
              type: 'success'
            });
            newNotifs.push({
              id: Date.now() + 3,
              title: '⏳ Status Pembayaran: Dalam Verifikasi (Est. 1x24 Jam)',
              message: `Bukti pembayaran sebesar Rp ${finalPrice.toLocaleString('id-ID')} telah kami terima dan sedang diverifikasi oleh Tim Admin.`,
              time: 'Baru saja',
              read: false,
              type: 'warning'
            });
            newNotifs.push({
              id: Date.now() + 4,
              title: 'ℹ️ Informasi Akses Sementara (Plan Free)',
              message: 'Selama proses verifikasi berlangsung, fitur Plan Free aktif sementara sehingga Anda tetap dapat mengelola katalog usaha Anda.',
              time: 'Baru saja',
              read: false,
              type: 'info'
            });
          }
        } else {
          // Bayar biasa tanpa kupon
          newNotifs.push({
            id: Date.now() + 2,
            title: '⏳ Status Pembayaran: Dalam Verifikasi (Est. 1x24 Jam)',
            message: 'Bukti pembayaran sebesar Rp 30.000 telah kami terima. Tim Admin akan melakukan verifikasi transaksi dalam maksimal 1x24 jam.',
            time: 'Baru saja',
            read: false,
            type: 'warning'
          });
          newNotifs.push({
            id: Date.now() + 3,
            title: 'ℹ️ Informasi Akses Sementara (Plan Free)',
            message: 'Selama proses verifikasi berlangsung, fitur Plan Free aktif sementara sehingga Anda tetap dapat mengelola katalog usaha Anda.',
            time: 'Baru saja',
            read: false,
            type: 'info'
          });
        }

        setNotifications(newNotifs);
      } else {
        if (data.errors) {
          const firstErr = Object.values(data.errors)[0] as string[];
          alert(firstErr[0] || 'Gagal memproses pendaftaran.');
        } else {
          alert(data.message || 'Pendaftaran gagal.');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi terputus. Pastikan server backend Laravel aktif.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCancelCheckout = () => {
    setRegisterForm({ name: '', email: '', password: '', store_name: '', store_slug: '' });
    setRegisterStep(1);
    setAppliedCoupon(null);
    setPaymentProofPreview(null);
    setPortalTab('home');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(loginForm)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.setItem('catavor_token', data.token)
        localStorage.setItem('catavor_user', JSON.stringify(data.user))
        localStorage.setItem('catavor_password_changed', data.is_password_changed ? 'true' : 'false')
        
        setToken(data.token)
        setAdminUser(data.user)
        setIsPasswordChanged(data.is_password_changed)
        setLoginForm({ email: '', password: '' })
        
        // If login succeeded on landing portal, redirect context to user's store
        const currentSlug = getStoreSlug();
        if (!currentSlug && data.user.store_slug) {
          
          setStoreSlug(data.user.store_slug);
          setView('admin');
        } else {
          setView('admin');
        }
      } else {
        setLoginError(data.message || 'Email atau password salah.')
      }
    } catch (err) {
      console.error(err)
      setLoginError('Koneksi terputus ke server.')
    } finally {
      setLoginLoading(false)
    }
  }

  // Handle First-Time Password Submit
  const handleFirstPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFirstPasswordError(null)

    if (firstPasswordForm.password.length < 6) {
      setFirstPasswordError('Password baru minimal harus 6 karakter.')
      return
    }

    if (firstPasswordForm.password !== firstPasswordForm.confirm_password) {
      setFirstPasswordError('Konfirmasi password tidak cocok.')
      return
    }

    setFirstPasswordLoading(true)
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: firstPasswordForm.name,
          email: firstPasswordForm.email,
          password: firstPasswordForm.password
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.setItem('catavor_user', JSON.stringify(data.user))
        localStorage.setItem('catavor_password_changed', 'true')
        setAdminUser(data.user)
        setIsPasswordChanged(true)
      } else {
        setFirstPasswordError(data.message || 'Gagal mengubah password.')
      }
    } catch (err) {
      console.error(err)
      setFirstPasswordError('Hubungan ke server terputus.')
    } finally {
      setFirstPasswordLoading(false)
    }
  }

  // Navigation helpers
  const goToCatalog = () => {
    setView('catalog')
  }



  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
    } catch (err) {
      console.error(err)
    } finally {
      handleUnauthorized()
      goToCatalog()
    }
  }

  // Handle Upgrade Plan to Pro
  const handleUpgradeToPro = async () => {
    try {
      const res = await fetch(`${API_BASE}/stores/upgrade-plan`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ plan: 'pro' })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Selamat! Toko Anda telah berhasil di-upgrade ke Plan Pro (Unlimited)!', 'success')
        loadData()
      } else {
        showToast(data.message || 'Gagal upgrade plan', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat upgrade plan', 'error')
    }
  }

  // Handle Admin Profile Update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileSuccess(null)
    setProfileError(null)

    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileForm)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        localStorage.setItem('catavor_user', JSON.stringify(data.user))
        localStorage.setItem('catavor_password_changed', 'true')
        setAdminUser(data.user)
        setIsPasswordChanged(true)
        setProfileForm(prev => ({ ...prev, password: '' }))
        setProfileSuccess('Profil admin berhasil diperbarui!')
        showToast('Profil admin berhasil diperbarui!')
        setTimeout(() => setProfileSuccess(null), 2000)
      } else {
        if (res.status === 401) {
          handleUnauthorized()
        } else if (data.errors) {
          const firstErr = Object.values(data.errors)[0] as string[]
          setProfileError(firstErr[0])
          showToast(firstErr[0], 'error')
        } else {
          setProfileError(data.message || 'Gagal memperbarui profil.')
          showToast(data.message || 'Gagal memperbarui profil.', 'error')
        }
      }
    } catch (err) {
      console.error(err)
      setProfileError('Hubungan ke server terputus.')
      showToast('Koneksi internet terputus. Gagal memperbarui profil.', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  // Parse YouTube URL
  const getYoutubeEmbedUrl = (url: string | null) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) 
      ? `https://www.youtube.com/embed/${match[2]}` 
      : '';
  }

  // Format IDR
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num)
  }

  // Save Settings
  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettingsLoading(true)
    setSettingsSuccess(null)
    try {
      // Decode arrays from JSON string for backend validation
      const payload = {
        ...settingsForm,
        about_cards: settingsForm.about_cards ? JSON.parse(settingsForm.about_cards) : [],
        social_links: settingsForm.social_links ? JSON.parse(settingsForm.social_links) : []
      };
      
      const res = await fetch(`${API_BASE}/stores/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const store = data.data;
        const updated = {
          whatsapp_number: store.whatsapp_number || '',
          store_slogan: store.store_slogan || '',
          promo_banner: store.promo_banner || '',
          articles_enabled: '0',
          about_title: store.about_title || '',
          about_slogan: store.about_slogan || '',
          about_description: store.about_description || '',
          about_cards: store.about_cards ? JSON.stringify(store.about_cards) : '',
          about_location: store.about_location || '',
          about_hours: store.about_hours || '',
          show_hours: store.show_hours !== undefined ? Boolean(store.show_hours) : false,
          about_disclaimer: store.about_disclaimer || '',
          social_links: store.social_links ? JSON.stringify(store.social_links) : '',
          official_website: store.official_website || '',
          store_title: store.store_title || 'Catavor',
          store_logo_url: store.store_logo_url || '',
          store_theme: store.store_theme || settingsForm.store_theme || 'emerald'
        }
        setSettings(updated)
        setSettingsForm(updated)
        try {
          const slug = getStoreSlug();
          if (slug) {
            localStorage.setItem(`catavor_store_${slug.toLowerCase()}`, JSON.stringify(updated));
          }
          localStorage.setItem('catavor_settings', JSON.stringify(updated));
        } catch {}
        if (updated.store_theme) {
          document.documentElement.setAttribute('data-theme', updated.store_theme);
          document.body.setAttribute('data-theme', updated.store_theme);
        }
        showToast('Pengaturan toko Anda berhasil disimpan!')
      } else {
        if (res.status === 401) {
          handleUnauthorized()
        } else {
          showToast('Akses ditolak atau sesi Anda telah habis. Silakan masuk kembali.', 'error')
        }
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi internet bermasalah. Gagal menyimpan pengaturan.', 'error')
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleThemeSelect = async (themeId: string, themeName: string) => {
    setSettingsForm((prev: any) => ({ ...prev, store_theme: themeId }));
    setSettings((prev: any) => ({ ...prev, store_theme: themeId }));
    document.documentElement.setAttribute('data-theme', themeId);
    document.body.setAttribute('data-theme', themeId);

    const slug = getStoreSlug();

    // 1. Immediately persist to LocalStorage for instant F5 refresh persistence
    try {
      if (slug) {
        const key = `catavor_store_${slug.toLowerCase()}`;
        const existing = localStorage.getItem(key);
        let parsed = existing ? JSON.parse(existing) : {};
        parsed.store_theme = themeId;
        localStorage.setItem(key, JSON.stringify(parsed));
        localStorage.setItem('catavor_settings', JSON.stringify({ ...settings, store_theme: themeId }));
      }
    } catch (e) {}

    // 2. Immediately persist to API Database in background
    if (token) {
      try {
        const payload = {
          store_theme: themeId
        };

        const res = await fetch(`${API_BASE}/stores/update`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        const resData = await res.json();
        if (res.ok && resData.success) {
          showToast(`✨ Tema "${themeName}" berhasil diterapkan & disimpan!`, 'success');
        } else {
          console.warn('API store_theme update response:', resData);
          showToast(`✨ Tema "${themeName}" diterapkan!`, 'success');
        }
      } catch (e) {
        console.error(e);
        showToast(`✨ Tema "${themeName}" diterapkan secara lokal!`, 'info');
      }
    } else {
      showToast(`✨ Tema "${themeName}" diterapkan!`, 'success');
    }
  };

  const [logoUploading, setLogoUploading] = useState<boolean>(false)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validate Square (1:1 Aspect Ratio) Image
    const isSquare = await new Promise<boolean>((resolve) => {
      const img = new window.Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(Math.abs(img.width - img.height) <= 2)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(false)
      }
      img.src = objectUrl
    })

    if (!isSquare) {
      showToast('⚠️ Logo/Ikon harus berukuran persegi (rasio 1:1, contoh: 512x512px atau 200x200px)!', 'error')
      e.target.value = ''
      return
    }

    setLogoUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSettingsForm(prev => ({ ...prev, store_logo_url: data.url }))
        showToast('Logo berhasil dipilih! Klik "Simpan Pengaturan" di bawah untuk mengaplikasikan logo toko.')
      } else {
        showToast(data.message || 'Gagal mengunggah gambar logo.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi terputus ke server saat mengunggah logo.', 'error')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  // Open CRUD modal for create
  const openCreateModal = (initialType: ItemCategoryType = 'physical') => {
    if (settings.plan === 'free' && faunas.length >= 10) {
      showToast('Batas listing Plan Gratis (Maksimal 10 item) telah tercapai. Silakan upgrade ke Plan Pro!', 'error')
      return
    }
    const typeConfig = getItemTypeFormConfig(initialType);
    const foodPreset = initialType === 'food' ? CULINARY_SMART_PRESETS['Makanan Siap Santap'] : null;
    setCrudMode('create')
    setEditId(null)
    setCrudForm({
      name: '',
      scientific_name: '',
      class: typeConfig.defaultCategory,
      habitat: 'General',
      diet: '',
      conservation_status: 'Tersedia',
      price: 0,
      video_url: '',
      is_shipping_available: true,
      description: '',
      image_url: '',
      native_region: '',
      lifespan: '',
      weight: '',
      shipping_terms: '',
      warranty_info: '',
      shipping_coverage: foodPreset ? foodPreset.defaultShipping : (typeConfig.deliveryOptions[0] || 'Bisa Kirim se-Indonesia'),
      purchase_links: [],
      product_type: initialType,
      attributes: {
        stock: 1,
        condition: 'Baru',
        weight: 100,
        brand: '',
        variant: '',
        download_url: '',
        file_format: 'PDF',
        file_size: '10 MB',
        license_type: 'Lisensi Personal',
        version: 'v1.0',
        scientific_name: '',
        fauna_class: 'Ikan Hias',
        fauna_status: 'Tersedia',
        duration: '1 Sesi / 1 Jam',
        service_location: 'Datang ke Toko',
        service_area: 'Jabodetabek',
        inclusions: '',
        client_requirements: '',
        portion_size: '1 Porsi',
        expired_info: foodPreset ? foodPreset.defaultExpiredInfo : 'Fresh Daily',
        storage_temp: foodPreset ? foodPreset.defaultStorageTemp : 'Suhu Ruang',
        certification: '100% Halal',
        taste_options: '',
        spicy_level: '',
        prep_time: '',
        serving_method: 'Dine-in, Takeaway & Kurir Instan',
        cooking_guide: '',
        sugar_ice_options: '',
        bake_status: 'Freshly Baked Daily',
        serving_capacity: '',
        min_order: '',
        delivery_service: 'Mobil Antar Toko / Kurir Khusus',
        culinary_type: 'Makanan Siap Santap',
        min_purchase: '1 Pcs',
        max_purchase: ''
      }
    })
    setCustomClass('')
    setShowCustomClassInput(false)
    setCustomHabitat('')
    setShowCustomHabitatInput(false)
    setCustomConservationStatus('')
    setShowCustomConservationStatusInput(false)
    setCustomShippingCoverage('')
    setShowCustomShippingCoverageInput(false)
    setCrudImages([''])
    setCrudError(null)
    setShowCrudModal(true)
  }

  // Open CRUD modal for edit
  const openEditModal = (item: Fauna) => {
    const itemType = (item.product_type || 'physical') as ItemCategoryType;
    const typeConfig = getItemTypeFormConfig(itemType);
    setCrudMode('edit')
    setEditId(item.id)
    setCrudForm({
      name: item.name,
      scientific_name: item.scientific_name || '',
      class: item.class || typeConfig.defaultCategory,
      habitat: item.habitat || 'General',
      diet: item.diet || '',
      conservation_status: item.conservation_status || 'Tersedia',
      price: item.price,
      video_url: item.video_url || '',
      is_shipping_available: item.is_shipping_available,
      description: item.description,
      image_url: item.image_url,
      native_region: item.detailed_info?.native_region || '',
      lifespan: item.detailed_info?.lifespan || '',
      weight: item.detailed_info?.weight || '',
      shipping_terms: item.detailed_info?.shipping_terms || '',
      warranty_info: item.detailed_info?.warranty_info || '',
      shipping_coverage: item.detailed_info?.shipping_coverage || (item.is_shipping_available ? 'Bisa Kirim se-Indonesia' : 'Ambil Sendiri di Toko (No Shipping)'),
      purchase_links: item.detailed_info?.purchase_links || [
        ...(item.detailed_info?.shopee_url ? [{ platform: 'Shopee', url: item.detailed_info.shopee_url }] : []),
        ...(item.detailed_info?.tokopedia_url ? [{ platform: 'Tokopedia', url: item.detailed_info.tokopedia_url }] : []),
        ...(item.detailed_info?.lazada_url ? [{ platform: 'Lazada', url: item.detailed_info.lazada_url }] : []),
        ...(item.detailed_info?.bukalapak_url ? [{ platform: 'Bukalapak', url: item.detailed_info.bukalapak_url }] : []),
        ...(item.detailed_info?.custom_shop_url ? [{ platform: item.detailed_info.custom_shop_name || 'Marketplace', url: item.detailed_info.custom_shop_url }] : [])
      ],
      product_type: itemType,
      attributes: {
        stock: item.attributes?.stock ?? 1,
        condition: item.attributes?.condition ?? 'Baru',
        weight: item.attributes?.weight ?? 100,
        brand: item.attributes?.brand ?? '',
        variant: item.attributes?.variant ?? '',
        download_url: item.attributes?.download_url ?? '',
        file_format: item.attributes?.file_format ?? 'PDF',
        file_size: item.attributes?.file_size ?? '10 MB',
        license_type: item.attributes?.license_type ?? 'Lisensi Personal',
        version: item.attributes?.version ?? 'v1.0',
        scientific_name: item.attributes?.scientific_name ?? item.scientific_name ?? '',
        fauna_class: item.attributes?.fauna_class ?? item.class ?? 'Ikan Hias',
        fauna_status: item.attributes?.fauna_status ?? item.conservation_status ?? 'Tersedia',
        duration: item.attributes?.duration ?? '1 Sesi / 1 Jam',
        service_location: item.attributes?.service_location ?? 'Datang ke Toko',
        service_area: item.attributes?.service_area ?? 'Jabodetabek',
        inclusions: item.attributes?.inclusions ?? '',
        client_requirements: item.attributes?.client_requirements ?? '',
        portion_size: item.attributes?.portion_size ?? '1 Porsi',
        expired_info: item.attributes?.expired_info ?? 'Fresh Daily',
        storage_temp: item.attributes?.storage_temp ?? 'Suhu Ruang',
        certification: item.attributes?.certification ?? '100% Halal',
        taste_options: item.attributes?.taste_options ?? '',
        spicy_level: item.attributes?.spicy_level ?? '',
        prep_time: item.attributes?.prep_time ?? '',
        serving_method: item.attributes?.serving_method ?? 'Dine-in, Takeaway & Kurir Instan',
        cooking_guide: item.attributes?.cooking_guide ?? '',
        sugar_ice_options: item.attributes?.sugar_ice_options ?? '',
        bake_status: item.attributes?.bake_status ?? 'Freshly Baked Daily',
        serving_capacity: item.attributes?.serving_capacity ?? '',
        min_order: item.attributes?.min_order ?? '',
        delivery_service: item.attributes?.delivery_service ?? 'Mobil Antar Toko / Kurir Khusus',
        culinary_type: item.attributes?.culinary_type ?? (CULINARY_SMART_PRESETS[item.class] ? item.class : 'Makanan Siap Santap'),
        min_purchase: item.attributes?.min_purchase ?? '1 Pcs',
        max_purchase: item.attributes?.max_purchase ?? ''
      }
    })
    setCustomClass('')
    setShowCustomClassInput(false)
    setCustomHabitat('')
    setShowCustomHabitatInput(false)
    setCustomConservationStatus('')
    setShowCustomConservationStatusInput(false)
    setCustomShippingCoverage('')
    setShowCustomShippingCoverageInput(false)
    const initialImages = item.detailed_info?.images && Array.isArray(item.detailed_info.images) && item.detailed_info.images.length > 0
      ? item.detailed_info.images
      : [item.image_url];
    setCrudImages(initialImages)
    setCrudError(null)
    setShowCrudModal(true)
  }

  // Handle Fauna Submit (Create / Update)
  const handleFaunaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCrudLoading(true)
    setCrudError(null)

    const typeConfig = getItemTypeFormConfig(crudForm.product_type)

    const filteredImages = crudImages.map(img => img.trim()).filter(Boolean)
    if (filteredImages.length === 0) {
      setCrudError('Minimal harus menginput 1 foto.')
      setCrudLoading(false)
      return
    }
    if (filteredImages.length > 5) {
      setCrudError('Maksimal hanya dapat menginput 5 foto.')
      setCrudLoading(false)
      return
    }

    const selectedClass = showCustomClassInput ? customClass.trim() : crudForm.class
    const selectedHabitat = showCustomHabitatInput ? customHabitat.trim() : crudForm.habitat
    const selectedConservationStatus = showCustomConservationStatusInput ? customConservationStatus.trim() : crudForm.conservation_status
    const termsVal = (crudForm.shipping_terms || '').trim()
    const isNoShipping = termsVal.toLowerCase().includes('ambil sendiri') || termsVal.toLowerCase().includes('pickup only') || termsVal.toLowerCase().includes('dine-in') || termsVal.toLowerCase().includes('no shipping')

    if (!selectedClass) {
      setCrudError(`${typeConfig.categoryLabel.replace('*', '').trim()} wajib diisi.`)
      setCrudLoading(false)
      return
    }
    if (crudForm.product_type === 'fauna' && !selectedHabitat) {
      setCrudError('Habitat wajib diisi.')
      setCrudLoading(false)
      return
    }
    if (crudForm.product_type === 'fauna' && !selectedConservationStatus) {
      setCrudError('Status ketersediaan / konservasi wajib diisi.')
      setCrudLoading(false)
      return
    }

    const payload = {
      name: crudForm.name,
      scientific_name: crudForm.product_type === 'fauna' ? (crudForm.scientific_name || 'N/A') : (crudForm.scientific_name || 'N/A'),
      class: selectedClass,
      habitat: crudForm.product_type === 'fauna' ? selectedHabitat : 'General',
      diet: crudForm.product_type === 'fauna' ? (crudForm.diet || 'N/A') : 'N/A',
      conservation_status: crudForm.product_type === 'fauna' ? selectedConservationStatus : 'Tersedia',
      price: crudForm.price,
      video_url: crudForm.video_url || null,
      is_shipping_available: !isNoShipping,
      description: crudForm.description,
      image_url: filteredImages[0],
      product_type: crudForm.product_type,
      attributes: {
        ...crudForm.attributes,
        file_format: crudForm.product_type === 'digital' ? selectedClass : (crudForm.attributes.file_format || selectedClass)
      },
      detailed_info: {
        native_region: crudForm.native_region,
        lifespan: crudForm.lifespan,
        weight: crudForm.weight,
        shipping_terms: termsVal,
        warranty_info: crudForm.product_type === 'service' ? '' : crudForm.warranty_info,
        shipping_coverage: termsVal || 'Bisa Kirim se-Indonesia',
        images: filteredImages,
        purchase_links: crudForm.purchase_links.filter(link => link.platform.trim() !== '' && link.url.trim() !== '')
      }
    }

    try {
      const url = crudMode === 'create' 
        ? `${API_BASE}/fauna` 
        : `${API_BASE}/fauna/${editId}`
      const method = crudMode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setShowCrudModal(false)
        loadData()
        showToast('Item katalog berhasil disimpan!')
      } else {
        if (res.status === 401) {
          handleUnauthorized()
        } else if (data.errors) {
          const firstErr = Object.values(data.errors)[0] as string[]
          setCrudError(firstErr[0])
          showToast(firstErr[0], 'error')
        } else {
          setCrudError(data.message || 'Terjadi kesalahan sistem.')
          showToast(data.message || 'Gagal menyimpan item katalog.', 'error')
        }
      }
    } catch (err) {
      console.error(err)
      setCrudError('Koneksi terputus ke server.')
      showToast('Koneksi terputus ke server. Periksa jaringan Anda.', 'error')
    } finally {
      setCrudLoading(false)
    }
  }

  // Handle File Upload from Device
  const handleImageUpload = async (index: number, file: File) => {
    setUploadingIndex(index)
    setCrudError(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const newImages = [...crudImages]
        newImages[index] = data.url
        setCrudImages(newImages)
      } else {
        setCrudError(data.message || 'Gagal mengunggah gambar.')
      }
    } catch (err) {
      console.error(err)
      setCrudError('Koneksi terputus ke server saat mengunggah gambar.')
    } finally {
      setUploadingIndex(null)
    }
  }

  // Formatter helper for Rupiah with dots thousands separator
  const formatRupiahInput = (num: number) => {
    if (!num) return '0'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const parseRupiahInput = (val: string) => {
    const clean = val.replace(/\D/g, '')
    return parseInt(clean) || 0
  }

  // Context-isolated Category Options per Product Type & User Master
  const getCategoryOptionsForType = (productType: ItemCategoryType = 'physical'): string[] => {
    const baseDefaults = masterCategories[productType] || DEFAULT_MASTER_CATEGORIES[productType] || [];
    const customUsed = faunas
      .filter(f => (f.product_type || 'physical') === productType && f.class)
      .map(f => f.class);
    
    const merged = Array.from(new Set([...baseDefaults, ...customUsed])).filter(Boolean);
    return merged.length > 0 ? merged : ['Lainnya'];
  };

  // Get unique options for active master context
  const getUniqueClasses = () => {
    return getCategoryOptionsForType(masterCategoryContextTab);
  }

  const getUniqueHabitats = () => {
    return Array.isArray(masterHabitats) ? masterHabitats : []
  }

  const getUniqueConservationStatuses = () => {
    return Array.isArray(masterStatuses) ? masterStatuses : []
  }

  const getUniqueShippingCoverages = () => {
    return Array.isArray(masterShippingCoverages) ? masterShippingCoverages : []
  }

  const handleTitleChange = (newTitle: string) => {
    const generatedSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    setArticleForm(prev => ({
      ...prev,
      title: newTitle,
      slug: editingArticle ? prev.slug : generatedSlug
    }))
  }

  const handleVisualInput = () => {
    if (editorRef.current) {
      setArticleForm(prev => ({ ...prev, content: editorRef.current!.innerHTML }))
    }
  }

  const preventDefaultOnDesktop = (e: React.MouseEvent) => {
    if (!('ontouchstart' in window)) {
      e.preventDefault()
    }
  }

  const execFormat = (cmd: string, val: string = '') => {
    if (editorRef.current) {
      editorRef.current.focus()
    }
    restoreSelection()
    document.execCommand(cmd, false, val)
    handleVisualInput()
    saveSelection()
  }

  const insertImageUrl = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click()
    }
  }

  const handleArticleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArticlesLoading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (res.status === 401) {
        showToast('Sesi Anda berakhir. Silakan login kembali untuk mengunggah gambar.', 'error')
        return
      }

      const data = await res.json()
      if (data.success && data.url) {
        if (editorRef.current) {
          editorRef.current.focus()
        }
        const imgHtml = `<img src="${data.url}" alt="Gambar Artikel" style="max-width:100%; height:auto; border-radius:0.5rem; margin:1rem 0; border: 1px solid var(--border-light);" />`
        execFormat('insertHTML', imgHtml)
        showToast('Gambar berhasil diunggah dan disisipkan!')
      } else {
        showToast(data.message || 'Gagal mengunggah gambar.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Terjadi kesalahan saat mengunggah gambar. Silakan login ulang.', 'error')
    } finally {
      setArticlesLoading(false)
      e.target.value = ''
    }
  }

  const insertLinkUrl = () => {
    const url = prompt('Masukkan URL Tautan:', 'https://')
    if (url) {
      if (editorRef.current) {
        editorRef.current.focus()
      }
      execFormat('createLink', url)
    }
  }

  const clearFormatting = () => {
    execFormat('removeFormat')
  }

  const openAddArticleModal = () => {
    setEditingArticle(null)
    setArticleForm({
      title: '',
      content: '',
      image_url: '',
      author: 'Admin Catavor',
      read_time: '5 mnt baca',
      slug: '',
      meta_description: '',
      is_comments_enabled: settings.default_is_comments_enabled !== '0',
      require_comment_approval: settings.default_require_comment_approval === '1',
      require_comment_email: settings.default_require_comment_email === '1',
      verify_comment_email_domain: settings.default_verify_comment_email_domain === '1'
    })
    setView('article-editor')
  }

  const openEditArticleModal = (article: Article) => {
    setEditingArticle(article)
    setArticleForm({
      title: article.title,
      content: article.content,
      image_url: article.image_url || '',
      author: article.author || 'Admin Catavor',
      read_time: article.read_time || '5 mnt baca',
      slug: article.slug || '',
      meta_description: article.meta_description || '',
      is_comments_enabled: article.is_comments_enabled !== undefined ? article.is_comments_enabled : true,
      require_comment_approval: article.require_comment_approval !== undefined ? article.require_comment_approval : false,
      require_comment_email: article.require_comment_email !== undefined ? article.require_comment_email : false,
      verify_comment_email_domain: article.verify_comment_email_domain !== undefined ? article.verify_comment_email_domain : false
    })
    setView('article-editor')
  }

  const handleSaveArticle = async (e: React.FormEvent, customPayload?: typeof articleForm) => {
    if (e) e.preventDefault()
    setArticlesLoading(true)
    const payload = customPayload || articleForm
    try {
      const url = editingArticle 
        ? `${API_BASE}/articles/${editingArticle.id}` 
        : `${API_BASE}/articles`
      const method = editingArticle ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (data.success) {
        setView('admin')
        setAdminTab('articles')
        await fetchArticles()
        showToast('Artikel berhasil disimpan!')
      } else {
        showToast(data.message || 'Gagal menyimpan artikel.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi bermasalah. Gagal menyimpan artikel.', 'error')
    } finally {
      setArticlesLoading(false)
    }
  }



  const handleDeleteArticle = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus artikel ini?')) return
    setArticlesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/articles/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (data.success) {
        await fetchArticles()
        showToast('Artikel berhasil dihapus!')
      } else {
        showToast(data.message || 'Gagal menghapus artikel.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi bermasalah. Gagal menghapus artikel.', 'error')
    } finally {
      setArticlesLoading(false)
    }
  }

  const handleDeleteMasterOption = (field: 'class' | 'habitat' | 'conservation_status' | 'shipping_coverage', value: string) => {
    // Determine the list of available options for replacement
    let options: string[] = []
    if (field === 'class') options = getUniqueClasses()
    else if (field === 'habitat') options = getUniqueHabitats()
    else if (field === 'conservation_status') options = getUniqueConservationStatuses()
    else if (field === 'shipping_coverage') options = getUniqueShippingCoverages()

    // Filter out the value to delete and any "+ Tambah Baru..." or "__NEW__" items
    const replacementOptions = options.filter(opt => opt !== value && opt !== '+ Tambah Baru...' && opt !== '__NEW__')

    if (replacementOptions.length === 0) {
      showToast('Tidak ada opsi pengganti lain yang tersedia untuk menghapus opsi ini.', 'error')
      return
    }

    setDeleteMasterModalData({
      field,
      value,
      replacementOptions,
      selectedReplacement: replacementOptions[0]
    })
  }

  const handleAddMasterOption = async (
    field: 'class' | 'habitat' | 'conservation_status' | 'shipping_coverage',
    value: string,
    resetInput: (val: string) => void
  ) => {
    const trimmed = value.trim()
    if (!trimmed) {
      showToast('Nilai opsi tidak boleh kosong.', 'error')
      return
    }

    try {
      setCrudLoading(true)
      const res = await fetch(`${API_BASE}/stores/add-master-option`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ field, value: trimmed })
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (res.ok && data.success) {
        showToast('Kategori/Opsi baru berhasil ditambahkan!')
        resetInput('')
        loadData()
      } else {
        showToast(data.message || 'Gagal menambahkan opsi baru.', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat menambah opsi baru.', 'error')
    } finally {
      setCrudLoading(false)
    }
  }

  const handleRenameMasterOption = async (
    field: 'class' | 'habitat' | 'conservation_status' | 'shipping_coverage',
    oldValue: string,
    newValue: string
  ) => {
    const trimmed = newValue.trim()
    if (!trimmed) {
      showToast('Nama opsi tidak boleh kosong.', 'error')
      return
    }
    if (trimmed === oldValue) {
      setRenameMasterModalData(null)
      return
    }

    try {
      setCrudLoading(true)
      const res = await fetch(`${API_BASE}/stores/rename-master-option`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ field, old_value: oldValue, new_value: trimmed })
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (res.ok && data.success) {
        showToast('Nama kategori/opsi berhasil diubah dan disinkronkan!')
        setRenameMasterModalData(null)
        loadData()
      } else {
        showToast(data.message || 'Gagal mengubah nama opsi.', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat mengubah nama opsi.', 'error')
    } finally {
      setCrudLoading(false)
    }
  }

  const handleApplyPreset = async (presetKey: string) => {
    try {
      setCrudLoading(true)
      const res = await fetch(`${API_BASE}/stores/apply-master-preset`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ preset: presetKey })
      })
      const data = await res.json()
      if (!checkAuthResponse(res, data)) return
      if (res.ok && data.success) {
        showToast('Template preset industri berhasil diterapkan ke katalog toko!')
        setPresetModalData(null)
        loadData()
      } else {
        showToast(data.message || 'Gagal menerapkan preset industri.', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat menerapkan preset industri.', 'error')
    } finally {
      setCrudLoading(false)
    }
  }

  // Handle Fauna Delete
  const handleFaunaDelete = async (id: number): Promise<boolean> => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus postingan hewan ini?')) return false

    try {
      const res = await fetch(`${API_BASE}/fauna/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (res.ok && data.success) {
        loadData()
        showToast('Data satwa berhasil dihapus!')
        return true
      } else {
        if (res.status === 401) {
          handleUnauthorized()
        } else {
          showToast(data.message || 'Gagal menghapus data satwa.', 'error')
        }
        return false
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi terputus. Gagal menghapus data satwa.', 'error')
      return false
    }
  }

  // Fetch details
  const fetchDetails = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/fauna/${id}`)
      const data = await res.json()
      if (data.success) {
        setSelectedFauna(data.data)
        setActiveImageIndex(0)
        setIsDetailActive(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      console.error(err)
      alert('Gagal mengambil data detail.')
    }
  }

  // Get recommendations for desktop
  const getRecommendations = (fauna: Fauna) => {
    const otherFaunas = faunas.filter(f => f.id !== fauna.id)
    const sameClass = otherFaunas.filter(f => f.class === fauna.class)
    const differentClass = otherFaunas.filter(f => f.class !== fauna.class)
    const combined = [...sameClass, ...differentClass]
    return combined.slice(0, 4)
  }


  // Dynamic Theme Style Resolver for Multi-Tenant Loading Gate Screen
  const getThemeGateStyles = (themeName?: string, isPortalMode: boolean = false) => {
    if (isPortalMode || themeName === 'portal') {
      return {
        bg: '#f8fafc',
        bgGradient: 'radial-gradient(circle at 50% 35%, #eff6ff 0%, #f8fafc 70%)',
        cardBg: '#ffffff',
        logoBoxBg: '#ffffff',
        logoBoxBorder: '1px solid #e2e8f0',
        logoBoxShadow: '0 10px 30px rgba(37, 99, 235, 0.08)',
        titleColor: '#0f172a',
        subtitleColor: '#475569',
        trackBg: 'rgba(37, 99, 235, 0.15)',
        accent: '#2563eb'
      };
    }
    const theme = (themeName || 'emerald').toLowerCase();
    switch (theme) {
      case 'cyberpunk':
        return {
          bg: '#0b0716',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(168, 85, 247, 0.22) 0%, rgba(11, 7, 22, 0.98) 70%)',
          cardBg: '#150d2a',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(168, 85, 247, 0.35)',
          logoBoxShadow: '0 10px 30px rgba(168, 85, 247, 0.25)',
          titleColor: '#ffffff',
          subtitleColor: '#e9d5ff',
          trackBg: 'rgba(168, 85, 247, 0.18)',
          accent: '#a855f7'
        };
      case 'sunset':
        return {
          bg: '#140d0b',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(245, 158, 11, 0.22) 0%, rgba(20, 13, 11, 0.98) 70%)',
          cardBg: '#221411',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(245, 158, 11, 0.35)',
          logoBoxShadow: '0 10px 30px rgba(245, 158, 11, 0.25)',
          titleColor: '#ffffff',
          subtitleColor: '#fde68a',
          trackBg: 'rgba(245, 158, 11, 0.18)',
          accent: '#f59e0b'
        };
      case 'ocean':
        return {
          bg: '#081021',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(59, 130, 246, 0.22) 0%, rgba(8, 16, 33, 0.98) 70%)',
          cardBg: '#0f1c38',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(59, 130, 246, 0.35)',
          logoBoxShadow: '0 10px 30px rgba(59, 130, 246, 0.25)',
          titleColor: '#ffffff',
          subtitleColor: '#bfdbfe',
          trackBg: 'rgba(59, 130, 246, 0.18)',
          accent: '#3b82f6'
        };
      case 'pastel':
        return {
          bg: '#f8fafc',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(225, 29, 72, 0.12) 0%, #f8fafc 70%)',
          cardBg: '#ffffff',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(225, 29, 72, 0.28)',
          logoBoxShadow: '0 10px 30px rgba(225, 29, 72, 0.15)',
          titleColor: '#0f172a',
          subtitleColor: '#475569',
          trackBg: 'rgba(225, 29, 72, 0.15)',
          accent: '#e11d48'
        };
      case 'cream':
        return {
          bg: '#faf7f2',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(15, 81, 50, 0.12) 0%, #faf7f2 70%)',
          cardBg: '#ffffff',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(15, 81, 50, 0.28)',
          logoBoxShadow: '0 10px 30px rgba(15, 81, 50, 0.15)',
          titleColor: '#1c2a24',
          subtitleColor: '#4a5d54',
          trackBg: 'rgba(15, 81, 50, 0.15)',
          accent: '#0f5132'
        };
      case 'emerald':
      default:
        return {
          bg: '#080c14',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.22) 0%, rgba(8, 12, 20, 0.98) 70%)',
          cardBg: '#0f172a',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(16, 185, 129, 0.35)',
          logoBoxShadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
          titleColor: '#ffffff',
          subtitleColor: '#cbd5e1',
          trackBg: 'rgba(16, 185, 129, 0.18)',
          accent: '#10b981'
        };
    }
  };

  // Render App Readiness Loader Gate Screen
  if (isAppInitializing) {
    const currentSlug = getStoreSlug();
    const isPortalLanding = !currentSlug;
    let themeFromCache = 'emerald';
    if (currentSlug) {
      try {
        const storeCached = localStorage.getItem(`catavor_store_${currentSlug.toLowerCase()}`);
        if (storeCached) {
          const parsed = JSON.parse(storeCached);
          if (parsed?.store_theme) {
            themeFromCache = parsed.store_theme;
          }
        }
      } catch {}
    }
    const activeTheme = isPortalLanding 
      ? 'portal' 
      : ((settings as any)?.store_theme || (settingsForm as any)?.store_theme || themeFromCache || 'emerald');
    const themeStyles = getThemeGateStyles(activeTheme, isPortalLanding);
    const displayLogo = isPortalLanding ? (logoHeaderImg || APP_LOGO_BASE64) : (initialGateLogoRef.current || APP_LOGO_BASE64);
    const displayTitle = (currentSlug && settings.store_title && settings.store_title !== 'Catavor')
      ? settings.store_title
      : (currentSlug ? currentSlug.charAt(0).toUpperCase() + currentSlug.slice(1) : 'Catavor');
    const displaySubtitle = isPortalLanding
      ? 'Platform Katalog Digital & Biolink Usaha'
      : 'Mempersiapkan Halaman...';

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: themeStyles.bg,
        backgroundImage: themeStyles.bgGradient,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        color: themeStyles.titleColor,
        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
      }}>
        <style>{`
          @keyframes loaderSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>

        {/* Clean Logo Box */}
        {isPortalLanding ? (
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '1.25rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 12px 30px rgba(37, 99, 235, 0.28)',
            marginBottom: '1.25rem'
          }}>
            <Store size={36} />
          </div>
        ) : (
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '1.25rem',
            backgroundColor: themeStyles.logoBoxBg,
            border: themeStyles.logoBoxBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem',
            boxShadow: themeStyles.logoBoxShadow,
            marginBottom: '1.35rem'
          }}>
            <img 
              src={displayLogo} 
              alt={displayTitle} 
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: '0.25rem' }} 
            />
          </div>
        )}

        {/* Store / Platform Title */}
        <h3 style={{
          margin: '0 0 0.35rem 0',
          fontSize: '1.35rem',
          fontWeight: 800,
          color: themeStyles.titleColor,
          letterSpacing: '-0.02em'
        }}>
          {displayTitle}
        </h3>
        
        {/* Subtitle */}
        <p style={{
          margin: 0,
          fontSize: '0.84rem',
          color: themeStyles.subtitleColor,
          fontWeight: 500,
          letterSpacing: '0.01em'
        }}>
          {displaySubtitle}
        </p>

        {/* Minimalist Progress Line */}
        <div style={{
          width: '140px',
          height: '3px',
          backgroundColor: themeStyles.trackBg,
          borderRadius: '2px',
          marginTop: '1.35rem',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            backgroundColor: themeStyles.accent,
            borderRadius: '2px',
            animation: 'loaderSlide 1.1s infinite ease-in-out'
          }} />
        </div>

        {isPortalLanding && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.35rem', 
            marginTop: '1.25rem', 
            padding: '0.25rem 0.75rem', 
            borderRadius: '999px', 
            background: '#eff6ff', 
            border: '1px solid #bfdbfe', 
            color: '#1d4ed8', 
            fontSize: '0.74rem', 
            fontWeight: 700 
          }}>
            <Sparkles size={13} />
            <span>Memuat Platform...</span>
          </div>
        )}
      </div>
    );
  }

  // Render Landing Portal Page
  if (!storeSlug && !error) {
    const activeIndustryData = LANDING_INDUSTRIES.find(ind => ind.id === landingCategory) || LANDING_INDUSTRIES[0];
    const filteredStores = featuredStores.filter(st => {
      if (!searchStoreQuery.trim()) return true;
      const q = searchStoreQuery.toLowerCase();
      return (st.store_title && st.store_title.toLowerCase().includes(q)) || 
             (st.slug && st.slug.toLowerCase().includes(q)) ||
             (st.store_slogan && st.store_slogan.toLowerCase().includes(q));
    });

    return (
      <div className="portal-container" style={{ minHeight: '100vh', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", position: 'relative' }}>
        {/* Toast Notification for WhatsApp Simulator */}
        {simulatedOrderToast && (
          <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 99999, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#ffffff', padding: '1rem 1.4rem', borderRadius: '0.85rem', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.85rem', border: '1px solid rgba(255,255,255,0.25)', animation: 'slideUpBottomSheet 0.3s ease' }}>
            <MessageCircle size={22} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.86rem', lineHeight: 1.4 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.15rem' }}>Simulasi Pesanan WhatsApp</div>
              {simulatedOrderToast}
            </div>
            <button type="button" onClick={() => setSimulatedOrderToast(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.85, padding: '0.2rem' }}>
              <X size={18} />
            </button>
          </div>
        )}

        {/* Product Detail & Order Simulation Modal */}
        {previewProductModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={() => setPreviewProductModal(null)}>
            <div className="animate-fade-in" style={{ width: '100%', maxWidth: '540px', backgroundColor: '#ffffff', borderRadius: '1.25rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.35rem 0.85rem', borderRadius: '999px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.78rem', fontWeight: 800 }}>
                  {previewProductModal.badge || 'Katalog Pilihan'}
                </div>
                <button type="button" onClick={() => setPreviewProductModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={22} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <img src={previewProductModal.image} alt={previewProductModal.title} style={{ width: '130px', height: '130px', objectFit: 'cover', borderRadius: '0.85rem', border: '1px solid #e2e8f0' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>{previewProductModal.category}</div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.45rem 0', color: '#0f172a' }}>{previewProductModal.title}</h3>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginBottom: '0.35rem' }}>{previewProductModal.price}</div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>Penjual: <strong>{previewProductModal.merchant}</strong> ({previewProductModal.location})</div>
                </div>
              </div>

              <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                {previewProductModal.description}
              </p>

              {/* Chat Format Preview Box */}
              <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MessageCircle size={15} /> Format Pesan WhatsApp Otomatis:
                </div>
                <div style={{ fontSize: '0.8rem', color: '#166534', fontFamily: 'monospace', backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #dcfce7', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
{`Halo ${previewProductModal.merchant}, saya tertarik untuk memesan:
• ${previewProductModal.title} (${previewProductModal.price})
Mohon informasi ketersediaan stok & alur pengiriman ya!`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button type="button" className="btn-portal-whatsapp" style={{ flex: 1, padding: '0.75rem', justifyContent: 'center', fontSize: '0.88rem' }} onClick={() => {
                  setPreviewProductModal(null);
                  setSimulatedOrderToast(`Format pesan untuk "${previewProductModal.title}" siap diteruskan ke WhatsApp!`);
                  setTimeout(() => setSimulatedOrderToast(null), 5000);
                }}>
                  <MessageCircle size={18} />
                  <span>Simulasi Order WhatsApp</span>
                </button>
                <button type="button" className="btn-portal-secondary" style={{ flex: 1, padding: '0.75rem', justifyContent: 'center', fontSize: '0.88rem' }} onClick={() => {
                  setPreviewProductModal(null);
                  setRegisterStep(1);
                  setRegisterPlan('free');
                  setPortalTab('register');
                }}>
                  Buat Katalog Saya
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Navigation */}
        {(portalTab === 'home' || ['terms', 'privacy', 'acceptable_use'].includes(portalTab)) && (
          <header style={{ position: 'sticky', top: 0, zIndex: 100 }}>
            <div className="container header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.95rem 2rem', maxWidth: '1280px', margin: '0 auto' }}>
              {['terms', 'privacy', 'acceptable_use'].includes(portalTab) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => setPortalTab('home')}
                    className="btn-portal-secondary"
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem' }}
                    title="Kembali"
                  >
                    <ChevronLeft size={18} />
                    <span>Kembali ke Beranda</span>
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    {portalTab === 'terms' ? 'Syarat & Ketentuan' : portalTab === 'privacy' ? 'Kebijakan Privasi' : 'Ketentuan Penggunaan'}
                  </span>
                </div>
              ) : (
                <>
                  {/* Brand Logo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} onClick={() => setPortalTab('home')}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}>
                      <Store size={20} />
                    </div>
                    <div>
                      <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        Catavor
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.15rem 0.45rem', borderRadius: '999px' }}>
                          COMMERCE
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Desktop Nav Links */}
                  <nav className="portal-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <a href="#industries-section" className="portal-nav-link">Solusi Industri</a>
                    <a href="#features-section" className="portal-nav-link">Fitur Unggulan</a>
                    <a href="#stores-section" className="portal-nav-link">Katalog Bisnis</a>
                    <a href="#pricing-desktop" className="portal-nav-link">Paket &amp; Harga</a>
                    <a href="#faq-section" className="portal-nav-link">FAQ</a>
                  </nav>

                  {/* Header Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {token ? (
                      <button className="btn-portal-primary" onClick={() => {
                        const user = JSON.parse(localStorage.getItem('catavor_user') || '{}');
                        if (user.store_slug) {
                          setStoreSlug(user.store_slug);
                          setView('admin');
                        }
                      }}>
                        <LayoutGrid size={16} />
                        <span>Buka Dashboard</span>
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <>
                        <button 
                          type="button"
                          onClick={() => setPortalTab('login')} 
                          className="portal-nav-link"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Masuk
                        </button>
                        <button 
                          type="button"
                          className="btn-portal-primary" 
                          onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }} 
                        >
                          <span>Buat Katalog — Gratis</span>
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </header>
        )}

        {portalTab === 'home' && (
          <>
            <main style={{ padding: '3.5rem 2rem 5rem 2rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6.5rem' }}>
              
              {/* 1. HERO SECTION */}
              <section className="hero-section-grid">
                <div>
                  <div className="hero-pill-badge-clean" style={{ marginBottom: '1.25rem' }}>
                    <Sparkles size={14} />
                    <span>Platform Katalog Digital &amp; Biolink Commerce Modern</span>
                  </div>

                  <h1 style={{ fontSize: '3.4rem', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '1.35rem' }}>
                    Katalog Produk Interaktif &amp; Biolink untuk <span style={{ color: '#2563eb' }}>Segala Jenis Usaha</span>
                  </h1>

                  <p style={{ fontSize: '1.12rem', color: '#475569', lineHeight: 1.65, marginBottom: '2rem', maxWidth: '620px' }}>
                    Tinggalkan PDF kaku dan daftar harga manual. Hadirkan website katalog interaktif responsif yang terhubung langsung ke pesanan WhatsApp dengan <strong>0% biaya komisi</strong>.
                  </p>

                  {/* Value Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '2.5rem' }}>
                    <span className="hero-value-pill-clean"><Zap size={14} style={{ color: '#2563eb' }} /> 60 Detik Siap Pakai</span>
                    <span className="hero-value-pill-clean"><MessageCircle size={14} style={{ color: '#16a34a' }} /> Direct WhatsApp Order</span>
                    <span className="hero-value-pill-clean"><ShieldCheck size={14} style={{ color: '#2563eb' }} /> 0% Komisi Transaksi</span>
                    <span className="hero-value-pill-clean"><QrCode size={14} style={{ color: '#2563eb' }} /> Subdomain &amp; QR Code Instan</span>
                  </div>

                  {/* Action CTA Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                    <button className="btn-portal-primary" style={{ padding: '0.85rem 1.85rem', fontSize: '1rem' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                      <span>Mulai Buat Katalog — Gratis</span>
                      <ArrowRight size={18} />
                    </button>
                    <a href="#industries-section" className="btn-portal-secondary" style={{ padding: '0.85rem 1.6rem', fontSize: '1rem', textDecoration: 'none' }}>
                      <span>Eksplorasi Katalog</span>
                    </a>
                  </div>

                  {/* Social Proof */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', border: '2px solid #ffffff' }}>☕</div>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid #ffffff' }}>🪴</div>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fae8ff', color: '#86198f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid #ffffff' }}>✂️</div>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid #ffffff' }}>🦎</div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                      Dipercaya oleh <strong>1,200+ Pemilik Usaha</strong> di Indonesia
                    </div>
                  </div>
                </div>

                {/* Right Column: Clean Interactive Mockup */}
                <div>
                  <div className="mockup-device-wrapper-clean" style={{ padding: '1.5rem' }}>
                    {/* Device Status Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 900, fontSize: '1.1rem' }}>
                          M
                        </div>
                        <div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            Maison &amp; Boulangerie <CheckCircle2 size={16} style={{ color: '#2563eb' }} />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>catavor.com/maison-boulangerie</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 700 }}>
                        🟢 Toko Buka
                      </span>
                    </div>

                    {/* Mockup Store Card Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', padding: '0.85rem', borderRadius: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                        <img src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=160&auto=format&fit=crop&q=80" alt="Croissant" style={{ width: '64px', height: '64px', borderRadius: '0.6rem', objectFit: 'cover' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Bakery &amp; Pastry</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>French Butter Croissant</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#2563eb' }}>Rp 24.000</div>
                        </div>
                        <button type="button" className="btn-portal-whatsapp" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem' }} onClick={() => {
                          setSimulatedOrderToast('Pesanan "French Butter Croissant" siap dikirim ke WhatsApp!');
                          setTimeout(() => setSimulatedOrderToast(null), 4000);
                        }}>
                          Pesan
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', padding: '0.85rem', borderRadius: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                        <img src="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=160&auto=format&fit=crop&q=80" alt="Cold Brew" style={{ width: '64px', height: '64px', borderRadius: '0.6rem', objectFit: 'cover' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Signature Coffee</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Artisan Cold Brew Coffee</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#2563eb' }}>Rp 28.000</div>
                        </div>
                        <button type="button" className="btn-portal-whatsapp" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem' }} onClick={() => {
                          setSimulatedOrderToast('Pesanan "Artisan Cold Brew" siap dikirim ke WhatsApp!');
                          setTimeout(() => setSimulatedOrderToast(null), 4000);
                        }}>
                          Pesan
                        </button>
                      </div>
                    </div>

                    {/* Mockup Quick Contact Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><MapPin size={14} style={{ color: '#2563eb' }} /> Jakarta Selatan</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={14} style={{ color: '#2563eb' }} /> 08:00 - 21:00</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><QrCode size={14} style={{ color: '#2563eb' }} /> QR Ready</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. MULTI-INDUSTRY LIVE CATALOG EXPLORER */}
              <section id="industries-section" style={{ scrollMarginTop: '6rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Katalog Multi-Sektor</span>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Satu Platform untuk Segala Bidang Bisnis
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '650px', margin: '0.5rem auto 0 auto' }}>
                    Pilih kategori usaha di bawah ini untuk melihat simulasi tampilan katalog produk, tarif harga, dan alur pemesanan WhatsApp.
                  </p>
                </div>

                {/* Category Selector Tabs */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2.5rem' }}>
                  {LANDING_INDUSTRIES.map((ind) => {
                    const IconCmp = ind.icon;
                    const isActive = landingCategory === ind.id;
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        className={`industry-tab-clean ${isActive ? 'active' : ''}`}
                        onClick={() => setLandingCategory(ind.id as any)}
                      >
                        <IconCmp size={18} style={{ color: ind.color }} />
                        <span>{ind.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Category Banner */}
                <div style={{ padding: '1.25rem 1.75rem', borderRadius: '1rem', background: activeIndustryData.accentBg, border: `1px solid ${activeIndustryData.color}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.25rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>{activeIndustryData.tagline}</div>
                    <div style={{ fontSize: '0.88rem', color: '#475569' }}>{activeIndustryData.description}</div>
                  </div>
                  <div style={{ padding: '0.4rem 0.95rem', borderRadius: '999px', background: '#ffffff', color: activeIndustryData.color, fontWeight: 800, fontSize: '0.8rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                    {activeIndustryData.badge}
                  </div>
                </div>

                {/* 3 Realistic Product Cards */}
                <div className="catalog-cards-grid">
                  {activeIndustryData.products.map((item) => (
                    <div key={item.id} className="catalog-demo-card-clean">
                      <div className="catalog-demo-img-box-clean">
                        <img src={item.image} alt={item.title} />
                        <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', display: 'flex', gap: '0.45rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.25rem 0.65rem', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', backdropFilter: 'blur(4px)' }}>
                            {item.category}
                          </span>
                          {item.badge && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.25rem 0.65rem', borderRadius: '999px', background: '#2563eb', color: '#ffffff' }}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem' }}>
                            <span>{item.merchant} ({item.location})</span>
                            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                              <Star size={13} fill="#f59e0b" /> {item.rating} ({item.reviews})
                            </span>
                          </div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>{item.title}</h3>
                          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{item.description}</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#2563eb' }}>{item.price}</div>
                          <button 
                            type="button" 
                            onClick={() => setPreviewProductModal(item)}
                            className="btn-portal-whatsapp" 
                            style={{ padding: '0.45rem 0.95rem' }}
                          >
                            <MessageCircle size={15} />
                            <span>Pesan via WA</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. VALUE PILLARS & CORE CAPABILITIES */}
              <section id="features-section" style={{ scrollMarginTop: '6rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keunggulan Utama</span>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Mengapa Pemilik Usaha Memilih Catavor?
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '600px', margin: '0.5rem auto 0 auto' }}>
                    Solusi terpadu untuk digitalisasi etalase produk, efisiensi pemesanan, dan branding toko fisik maupun online.
                  </p>
                </div>

                <div className="features-grid-3col">
                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <Image size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>WebP &amp; Fast CDN Images</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Foto produk dikonversi otomatis ke WebP beresolusi tinggi dengan kompresi ringan agar katalog terbuka seketika tanpa lemot.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                      <MessageCircle size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Structured WhatsApp Order</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Tombol pesan otomatis mengisi nama produk, harga, varian, dan catatan sehingga penjual dan pembeli tidak perlu mengetik manual.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                      <Palette size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>5 Pilihan Tema Warna Toko</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Sesuaikan warna katalog Anda (Emerald, Sapphire Blue, Amethyst, Sunset Coral, atau Classic Slate) sesuai identitas brand usaha.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                      <QrCode size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>QR Code Meja Kasir Siap Cetak</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Unduh file QR Code berkualitas tinggi langsung dari Dashboard untuk dicetak pada akrilik meja kasir, stiker kemasan, atau kartu nama.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfeff', border: '1px solid #a5f3fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0891b2' }}>
                      <Globe size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Integrasi Multi-Marketplace</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Sertakan tautan resmi toko Shopee, Tokopedia, dan Instagram Anda dalam satu biolink katalog praktis.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff1f2', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                      <ShieldCheck size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>0% Potongan Komisi</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Seluruh hasil penjualan dari pelanggan 100% milik Anda seutuhnya. Tidak ada biaya tersembunyi per transaksi.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. FEATURED STORES DIRECTORY */}
              {featuredStores && featuredStores.length > 0 && (
                <section id="stores-section" style={{ scrollMarginTop: '6rem' }}>
                  <div className="stores-header-flex">
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Katalog Bisnis Aktif</span>
                      <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                        Jelajahi Toko &amp; Katalog Nyata
                      </h2>
                    </div>
                    
                    {/* Search Input for Stores */}
                    <div className="search-wrapper" style={{ width: '320px', position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Cari nama toko / bidang usaha..." 
                        value={searchStoreQuery}
                        onChange={(e) => setSearchStoreQuery(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.4rem' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>

                  <div className="stores-grid-4col">
                    {filteredStores.slice(0, 8).map((st: any) => (
                      <div 
                        key={st.id || st.slug} 
                        className="portal-card" 
                        style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                        onClick={() => {
                          if (st.slug) {
                            setStoreSlug(st.slug);
                            setView('catalog');
                          }
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                            {st.store_logo_url ? (
                              <img src={st.store_logo_url} alt={st.store_title} style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                            ) : (
                              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', border: '1px solid #bfdbfe' }}>
                                {(st.store_title || 'T')[0]}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {st.store_title || 'Toko Bisnis'}
                              </h4>
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>/{st.slug}</div>
                            </div>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 1rem 0', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {st.store_slogan || st.store_description || 'Katalog digital resmi terpercaya di platform Catavor.'}
                          </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#2563eb', fontWeight: 700 }}>
                          <span>Kunjungi Katalog</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 5. 3-STEP "CARA KERJA" */}
              <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: '5.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kemudahan Operasional</span>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Mulai dalam 3 Langkah Sederhana
                  </h2>
                </div>

                <div className="steps-grid-3col">
                  <div className="portal-card" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}>1</div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Klaim Tautan &amp; Daftarkan Akun</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Daftar gratis dalam 30 detik dan pilih slug nama toko Anda (contoh: <strong>catavor.com/usaha-anda</strong>).
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}>2</div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Upload Produk &amp; Atur Tarif</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Unggah foto produk, isi harga promo, kategori, profil bisnis, nomor WhatsApp, dan jam operasional.
                    </p>
                  </div>

                  <div className="portal-card" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}>3</div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Bagikan di Bio &amp; Meja Kasir</h3>
                    <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                      Pasang link di bio Instagram/TikTok dan tempel QR Code di kasir toko fisik Anda untuk order cepat via WhatsApp.
                    </p>
                  </div>
                </div>
              </section>

              {/* 6. TRANSPARENT PRICING SECTION */}
              <section id="pricing-desktop" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '5.5rem', scrollMarginTop: '6rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Investasi Terjangkau</span>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Pilihan Paket Sesuai Skala Usaha
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '550px', margin: '0.5rem auto 1.5rem auto' }}>
                    Mulai gratis selamanya untuk pemula, atau upgrade ke Pro untuk fitur tanpa batas.
                  </p>

                  {/* Monthly vs Annual Switcher */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem', borderRadius: '999px', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                    <button 
                      type="button" 
                      onClick={() => setPricingBillingCycle('monthly')}
                      style={{ padding: '0.45rem 1.25rem', borderRadius: '999px', border: 'none', background: pricingBillingCycle === 'monthly' ? '#2563eb' : 'transparent', color: pricingBillingCycle === 'monthly' ? '#ffffff' : '#475569', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }}
                    >
                      Bulanan
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPricingBillingCycle('yearly')}
                      style={{ padding: '0.45rem 1.25rem', borderRadius: '999px', border: 'none', background: pricingBillingCycle === 'yearly' ? '#2563eb' : 'transparent', color: pricingBillingCycle === 'yearly' ? '#ffffff' : '#475569', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <span>Tahunan</span>
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '999px' }}>-20% Hemat</span>
                    </button>
                  </div>
                </div>

                <div className="pricing-grid-2col">
                  {/* Free Plan Card */}
                  <div className="portal-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan Starter</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>GRATIS</span>
                      </div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: '0.75rem 0 1.25rem 0' }}>
                        Rp 0 <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>/ selamanya</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        Cocok untuk usaha rintisan atau warung yang baru memulai digitalisasi produk.
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem', color: '#334155' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} style={{ color: '#16a34a' }} /> Maksimal 10 postingan produk</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} style={{ color: '#16a34a' }} /> Subdomain kustom (catavor.com/tokomu)</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} style={{ color: '#16a34a' }} /> WhatsApp Direct Order 1-klik</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} style={{ color: '#16a34a' }} /> Download QR Code toko siap cetak</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}><X size={16} /> Watermark "Free by Catavor" aktif</li>
                      </ul>
                    </div>
                    <button className="btn-portal-secondary" style={{ width: '100%', padding: '0.85rem', marginTop: '2.25rem', justifyContent: 'center' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                      Daftar Plan Gratis
                    </button>
                  </div>

                  {/* Pro Plan Card */}
                  <div className="portal-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid #2563eb', background: '#ffffff', boxShadow: '0 20px 40px -10px rgba(37, 99, 235, 0.15)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-0.8rem', right: '2rem', background: '#2563eb', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '0.25rem 0.85rem', borderRadius: '999px', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
                      PALING DIREKOMENDASIKAN
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan Pro Unlimited</span>
                      </div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: '0.75rem 0 1.25rem 0', display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                        {pricingBillingCycle === 'yearly' && (
                          <span style={{ fontSize: '1.35rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>Rp 30rb</span>
                        )}
                        <span style={{ color: '#2563eb' }}>{pricingBillingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 24.000'}</span>
                        <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>/ bulan</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        Untuk bisnis aktif, restoran, butik, dan profesional yang membutuhkan fitur tak terbatas.
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem', color: '#0f172a' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={18} style={{ color: '#2563eb' }} /> <strong>Unlimited</strong> postingan produk &amp; jasa</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={18} style={{ color: '#2563eb' }} /> Halaman <strong>"Tentang Kami" kustom</strong></li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={18} style={{ color: '#2563eb' }} /> <strong>100% Bebas Watermark</strong> Catavor</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={18} style={{ color: '#2563eb' }} /> Multi-marketplace link (Shopee, Tokopedia)</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={18} style={{ color: '#2563eb' }} /> Akses seluruh 5 palet tema warna toko</li>
                      </ul>
                    </div>
                    <button className="btn-portal-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '2.25rem', justifyContent: 'center', fontSize: '0.95rem' }} onClick={() => { setRegisterStep(1); setRegisterPlan('pro'); setPortalTab('register'); }}>
                      <span>Daftar Plan Pro Sekarang</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </section>

              {/* 7. FAQ ACCORDION SECTION */}
              <section id="faq-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '5.5rem', scrollMarginTop: '6rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pusat Bantuan</span>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.35rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Pertanyaan yang Sering Diajukan
                  </h2>
                </div>

                <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {LANDING_FAQS.map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} className={`faq-accordion-clean ${isOpen ? 'active' : ''}`}>
                        <div 
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0, flex: 1, paddingRight: '1rem' }}>
                            {faq.q}
                          </h4>
                          <ChevronDown size={18} style={{ color: isOpen ? '#2563eb' : '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                        </div>
                        {isOpen && (
                          <div style={{ padding: '0 1.5rem 1.35rem 1.5rem', fontSize: '0.88rem', color: '#475569', lineHeight: 1.65, borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 8. BOTTOM HERO CTA BANNER */}
              <section style={{ padding: '3.5rem 3rem', borderRadius: '1.5rem', background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)', color: '#ffffff', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.35)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 2, maxWidth: '720px', margin: '0 auto' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.85rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Siap Memulai Digitalisasi Katalog Bisnis Anda?
                  </h2>
                  <p style={{ fontSize: '1.05rem', color: '#dbeafe', marginBottom: '2rem', lineHeight: 1.6 }}>
                    Daftar sekarang dan publikasikan katalog produk interaktif Anda dalam 60 detik. Gratis selamanya tanpa kartu kredit.
                  </p>
                  <button className="btn-portal-secondary" style={{ padding: '0.9rem 2.2rem', fontSize: '1rem', fontWeight: 800, color: '#1d4ed8' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                    <span>Buat Link Katalog Saya</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </section>
            </main>
            
            {/* Corporate Footer */}
            <footer style={{ borderTop: '1px solid #e2e8f0', padding: '3rem 2rem', background: '#ffffff' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <Store size={16} />
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Catavor</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
                    © 2026 PT Catavor Media Digital. Hak Cipta Dilindungi.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.82rem' }}>
                  <button type="button" onClick={() => setPortalTab('terms')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                    Syarat &amp; Ketentuan ({policies.terms?.version || 'v1.0.0'})
                  </button>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <button type="button" onClick={() => setPortalTab('privacy')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                    Kebijakan Privasi ({policies.privacy?.version || 'v1.0.0'})
                  </button>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <button type="button" onClick={() => setPortalTab('acceptable_use')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                    Ketentuan Penggunaan ({policies.acceptable_use?.version || 'v1.0.0'})
                  </button>
                </div>
              </div>
            </footer>
          </>
        )}

        {portalTab === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 2rem' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <Lock size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Masuk Administrator</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Kelola profil &amp; katalog bisnis Anda</p>
              </div>
              
              {loginError && (
                <div className="alert-message alert-danger" style={{ marginBottom: '1rem' }}>
                  {loginError}
                </div>
              )}

              {/* Google SSO Login Button */}
              <button 
                type="button" 
                onClick={handleGoogleSSO}
                style={{ 
                  width: '100%', 
                  padding: '0.7rem', 
                  borderRadius: '0.6rem', 
                  backgroundColor: 'rgba(255,255,255,0.06)', 
                  border: '1px solid rgba(255,255,255,0.15)', 
                  color: '#ffffff', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.65rem', 
                  marginBottom: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
                <span>Masuk dengan Google</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>ATAU LOGIN MANUAL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
              </div>

              <form onSubmit={handleLoginSubmit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="nama@email.com" 
                    required 
                    value={loginForm.email} 
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Kata Sandi</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Ketik password..." 
                    required 
                    value={loginForm.password} 
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary btn-full" disabled={loginLoading}>
                  {loginLoading ? 'Memproses...' : 'Masuk Dashboard'}
                </button>
                <button 
                  type="button" 
                  className="btn-secondary btn-full" 
                  style={{ 
                    marginTop: '0.75rem', 
                    padding: '0.75rem', 
                    fontWeight: 700, 
                    fontSize: '0.82rem', 
                    borderRadius: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#d1d5db',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => {
                    setPortalTab('home');
                    setLoginError(null);
                  }}
                >
                  <Home size={16} />
                  <span>Kembali ke Halaman Utama</span>
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Belum punya akun katalog? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setRegisterStep(1); setPortalTab('register'); }}>Daftar Baru</span>
              </div>
            </div>
          </div>
        )}

        {portalTab === 'register' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 1.5rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '2rem 1.75rem', borderRadius: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'linear-gradient(180deg, rgba(17, 24, 21, 0.95) 0%, rgba(9, 14, 12, 0.98) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' }}>
              {/* Premium Header Icon & Branding */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif", margin: '0 0 0.35rem 0' }}>
                  Daftar Katalog Catavor
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                  Buat katalog online &amp; biolink bisnis profesional Anda
                </p>
              </div>

              {/* 3-Step Progress Indicator */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.15rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: registerStep === 1 ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep === 1 ? '#10b981' : 'rgba(255,255,255,0.1)', color: registerStep === 1 ? '#000' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>1</span>
                    Otentikasi
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: registerStep === 2 ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep === 2 ? '#10b981' : 'rgba(255,255,255,0.1)', color: registerStep === 2 ? '#000' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>2</span>
                    Profil Usaha
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: registerStep === 3 ? '#f59e0b' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep === 3 ? '#f59e0b' : 'rgba(255,255,255,0.1)', color: registerStep === 3 ? '#000' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>3</span>
                    Pilih Paket
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: registerStep === 1 ? '33.3%' : registerStep === 2 ? '66.6%' : '100%', height: '100%', background: registerStep === 3 ? 'linear-gradient(90deg, #10b981, #f59e0b)' : '#10b981', transition: 'all 0.3s ease-in-out' }} />
                </div>
              </div>

              {registerError && (
                <div 
                  id="register-error-banner"
                  style={{ 
                    marginBottom: '1.25rem', 
                    fontSize: '0.8rem', 
                    borderRadius: '0.75rem', 
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    boxShadow: '0 8px 25px rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    lineHeight: 1.45,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)',
                    animation: 'fadeIn 0.3s ease-in-out'
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: '0.1rem' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#f87171', fontSize: '0.82rem', marginBottom: '0.15rem' }}>Perhatian!</div>
                    <div>{registerError}</div>
                  </div>
                </div>
              )}

              {/* STEP 1: Identitas & Email / Google SSO */}
              {registerStep === 1 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6', margin: '0 0 0.25rem 0' }}>
                      Langkah 1: Identitas Pemilik Usaha
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      Daftar instan dengan Google atau buat password manual
                    </p>
                  </div>

                  {/* Google SSO Register Button */}
                  <button 
                    type="button" 
                    onClick={handleGoogleSSO}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '0.6rem', 
                      backgroundColor: 'rgba(255,255,255,0.06)', 
                      border: '1px solid rgba(255,255,255,0.15)', 
                      color: '#ffffff', 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '0.65rem', 
                      marginBottom: '1.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Daftar Cepat dengan Google</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>ATAU DAFTAR MANUAL</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  </div>

                  <form 
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!validateStep1()) {
                        setRegisterError('Mohon periksa kembali isian Anda. Lengkapi bidang formulir yang belum diisi.');
                        setTimeout(() => {
                          const el = document.getElementById('register-error-banner');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                        return;
                      }
                      setRegisterError(null);
                      setFieldErrors({});
                      setRegisterStep(2);
                    }} 
                    style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  >
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>Nama Lengkap Pemilik Usaha *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Contoh: Dzikri Muhammad" 
                        value={registerForm.name} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, name: e.target.value });
                          if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                        }}
                        style={{ borderRadius: '0.6rem', padding: '0.65rem 0.85rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.3)', border: fieldErrors.name ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', boxShadow: fieldErrors.name ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none', color: '#fff' }}
                      />
                      {fieldErrors.name && (
                        <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                          <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                          <span>{fieldErrors.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>Alamat Email *</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="nama@domain.com" 
                        value={registerForm.email} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, email: e.target.value });
                          if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                        }}
                        style={{ borderRadius: '0.6rem', padding: '0.65rem 0.85rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.3)', border: fieldErrors.email ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', boxShadow: fieldErrors.email ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none', color: '#fff' }}
                      />
                      {fieldErrors.email && (
                        <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                          <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                          <span>{fieldErrors.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>Kata Sandi Akun *</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Minimal 6 karakter" 
                        value={registerForm.password} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, password: e.target.value });
                          if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                        }}
                        style={{ borderRadius: '0.6rem', padding: '0.65rem 0.85rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.3)', border: fieldErrors.password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', boxShadow: fieldErrors.password ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none', color: '#fff' }}
                      />
                      {fieldErrors.password && (
                        <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                          <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                          <span>{fieldErrors.password}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      className="btn-primary btn-full" 
                      style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        fontWeight: 800, 
                        fontSize: '0.85rem', 
                        borderRadius: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <span>Lanjut ke Informasi Katalog</span>
                      <ChevronRight size={16} />
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '0.85rem', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
                      Dengan mendaftar, Anda menyetujui{' '}
                      <button type="button" onClick={() => setActivePolicyModal('terms')} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, padding: 0 }}>
                        Syarat & Ketentuan ({policies.terms?.version || 'v1.0.0'})
                      </button>{' '}
                      dan{' '}
                      <button type="button" onClick={() => setActivePolicyModal('privacy')} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, padding: 0 }}>
                        Kebijakan Privasi ({policies.privacy?.version || 'v1.0.0'})
                      </button>{' '}
                      Catavor.
                    </div>
                    <button 
                      type="button" 
                      className="btn-secondary btn-full" 
                      style={{ 
                        padding: '0.75rem', 
                        fontWeight: 700, 
                        fontSize: '0.82rem', 
                        borderRadius: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#d1d5db',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        resetRegisterFormState();
                        setPortalTab('home');
                      }}
                    >
                      <Home size={16} />
                      <span>Kembali ke Halaman Utama</span>
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 2: Store Information (Nama & Username Toko) */}
              {registerStep === 2 && (
                <form 
                  noValidate
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!validateStep2()) {
                      setRegisterError('Mohon periksa kembali isian Anda. Lengkapi bidang formulir yang belum diisi.');
                      setTimeout(() => {
                        const el = document.getElementById('register-error-banner');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 50);
                      return;
                    }

                    setRegisterLoading(true);
                    setRegisterError(null);
                    try {
                      const res = await fetch(`${API_BASE}/check-slug/${registerForm.store_slug.toLowerCase()}`);
                      const data = await res.json();
                      if (!data.available) {
                        const errMsg = 'Mohon periksa kembali isian Anda: Link username toko yang Anda masukkan sudah digunakan oleh toko lain. Silakan ganti dengan username lain yang masih tersedia.';
                        setRegisterError(errMsg);
                        setFieldErrors(prev => ({ ...prev, store_slug: `Link username "${registerForm.store_slug}" sudah digunakan oleh toko lain.` }));
                        setSlugStatus({ available: false, message: `Link username "${registerForm.store_slug}" sudah digunakan oleh toko lain.` });
                        setTimeout(() => {
                          const el = document.getElementById('register-error-banner');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                        return;
                      }
                      setRegisterError(null);
                      setFieldErrors({});
                      setRegisterStep(3);
                    } catch (err) {
                      setRegisterError('Gagal memeriksa ketersediaan username. Silakan coba lagi.');
                    } finally {
                      setRegisterLoading(false);
                    }
                  }} 
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6', margin: '0 0 0.25rem 0' }}>
                      Langkah 2: Profil &amp; Link Toko
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      Tentukan nama bisnis dan link tautan unik toko Anda
                    </p>
                  </div>

                  {registerForm.email && (
                    <div style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Check size={14} /> Akun Terotentikasi: <strong>{registerForm.email}</strong>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>Nama Toko / Bisnis *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: Catavor Gallery" 
                      value={registerForm.store_name} 
                      onChange={(e) => {
                        setRegisterForm({ ...registerForm, store_name: e.target.value });
                        if (fieldErrors.store_name) setFieldErrors(prev => ({ ...prev, store_name: '' }));
                      }}
                      style={{ borderRadius: '0.6rem', padding: '0.65rem 0.85rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.3)', border: fieldErrors.store_name ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', boxShadow: fieldErrors.store_name ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none', color: '#fff' }}
                    />
                    {fieldErrors.store_name && (
                      <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                        <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                        <span>{fieldErrors.store_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>Link Username Toko (ID Unik) *</label>
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: '0.6rem', backgroundColor: 'rgba(0,0,0,0.3)', border: fieldErrors.store_slug ? '1px solid #ef4444' : (slugStatus ? (slugStatus.available ? '1px solid #10b981' : '1px solid #ef4444') : '1px solid rgba(255,255,255,0.12)'), boxShadow: fieldErrors.store_slug ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none', overflow: 'hidden', paddingLeft: '0.75rem', transition: 'all 0.2s ease' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, userSelect: 'none' }}>catavor.com/</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="toko-saya" 
                        value={registerForm.store_slug} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') });
                          if (fieldErrors.store_slug) setFieldErrors(prev => ({ ...prev, store_slug: '' }));
                        }}
                        style={{ flex: 1, padding: '0.65rem 0.65rem', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent', color: '#fff' }}
                      />
                    </div>
                    {slugChecking && (
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Sparkles size={12} style={{ color: '#38bdf8' }} />
                        <span>Memeriksa ketersediaan username catavor.com/{registerForm.store_slug}...</span>
                      </div>
                    )}
                    {!slugChecking && slugStatus && (
                      <div style={{ fontSize: '0.72rem', color: slugStatus.available ? '#34d399' : '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                        {slugStatus.available ? <Check size={13} style={{ color: '#34d399' }} /> : <AlertTriangle size={13} style={{ color: '#f87171' }} />}
                        <span>{slugStatus.message}</span>
                      </div>
                    )}
                    {!slugChecking && !slugStatus && fieldErrors.store_slug && (
                      <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                        <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                        <span>{fieldErrors.store_slug}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ 
                        padding: '0.75rem 1rem', 
                        fontSize: '0.8rem', 
                        borderRadius: '0.6rem',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      onClick={() => {
                        resetRegisterFormState();
                        setPortalTab('register');
                        setRegisterStep(1);
                      }}
                    >
                      <ChevronLeft size={16} />
                      <span>Kembali</span>
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ 
                        flex: 1, 
                        padding: '0.75rem', 
                        fontWeight: 800, 
                        fontSize: '0.85rem', 
                        borderRadius: '0.6rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <span>Lanjut ke Pemilihan Paket</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Plan Selection (Free vs Pro) */}
              {registerStep === 3 && (
                <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6', margin: '0 0 0.25rem 0' }}>
                      Langkah 3: Pilih Paket untuk <strong>{registerForm.store_name}</strong>
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                      Pilih paket yang paling sesuai dengan kebutuhan usaha Anda
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Plan Gratis Option Card */}
                    <div 
                      onClick={() => setRegisterPlan('free')}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        borderRadius: '0.75rem', 
                        border: registerPlan === 'free' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)', 
                        backgroundColor: registerPlan === 'free' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: registerPlan === 'free' ? '5px solid #10b981' : '2px solid #6b7280', backgroundColor: registerPlan === 'free' ? '#000' : 'transparent', transition: 'all 0.2s ease' }} />
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: registerPlan === 'free' ? '#10b981' : '#ffffff' }}>Plan Gratis (Free)</span>
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>Rp 0 <small style={{ fontSize: '0.65rem', color: '#9ca3af' }}>/selamanya</small></span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1.65rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} /> Maksimal 10 postingan produk
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} /> Katalog interaktif &amp; WhatsApp
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} /> Watermark "Free by Catavor"
                        </div>
                      </div>
                    </div>

                    {/* Plan Pro Option Card */}
                    <div 
                      onClick={() => setRegisterPlan('pro')}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        borderRadius: '0.75rem', 
                        border: registerPlan === 'pro' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)', 
                        backgroundColor: registerPlan === 'pro' ? 'rgba(245, 158, 11, 0.09)' : 'rgba(245, 158, 11, 0.03)', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'absolute', top: '-10px', right: '14px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000000', fontSize: '0.58rem', fontWeight: 900, padding: '0.15rem 0.55rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
                        🔥 Rekomendasi Utama
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: registerPlan === 'pro' ? '5px solid #f59e0b' : '2px solid #6b7280', backgroundColor: registerPlan === 'pro' ? '#000' : 'transparent', transition: 'all 0.2s ease' }} />
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: registerPlan === 'pro' ? '#f59e0b' : '#ffffff' }}>Plan Pro (Premium)</span>
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500 }}>Rp 50rb</span>
                          <span style={{ color: '#f59e0b', fontWeight: 800 }}>Rp 30rb</span>
                          <small style={{ fontSize: '0.65rem', color: '#9ca3af' }}>/bln</small>
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1.65rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#f59e0b', flexShrink: 0 }} /> Postingan produk Unlimited
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#f59e0b', flexShrink: 0 }} /> Halaman "Tentang Kami" kustom
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#f59e0b', flexShrink: 0 }} /> Bebas watermark Catavor
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={13} style={{ color: '#f59e0b', flexShrink: 0 }} /> Kontrol tombol beli
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ margin: '1rem 0 0.35rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5, backgroundColor: agreeTermsError && !agreeTerms ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0,0,0,0.25)', padding: '0.75rem 0.85rem', borderRadius: '0.6rem', border: agreeTermsError && !agreeTerms ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s ease' }}>
                      <input 
                        type="checkbox" 
                        id="desktop-register-agree" 
                        checked={agreeTerms} 
                        onChange={(e) => { setAgreeTerms(e.target.checked); if (e.target.checked) setAgreeTermsError(false); }} 
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Harap centang kotak ini untuk menyetujui Syarat & Ketentuan serta Kebijakan Privasi.')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        style={{ marginTop: '0.15rem', accentColor: '#10b981', cursor: 'pointer', flexShrink: 0, width: '16px', height: '16px' }} 
                        required 
                      />
                      <label htmlFor="desktop-register-agree" style={{ cursor: 'pointer' }}>
                        Saya menyetujui <span style={{ color: '#34d399', fontWeight: 700, textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviousPortalTab('register'); setPortalTab('terms'); }}>Syarat &amp; Ketentuan</span> serta <span style={{ color: '#34d399', fontWeight: 700, textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviousPortalTab('register'); setPortalTab('privacy'); }}>Kebijakan Privasi</span> Catavor.
                      </label>
                    </div>
                    {agreeTermsError && !agreeTerms && (
                      <div style={{ fontSize: '0.72rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, paddingLeft: '0.2rem' }}>
                        <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                        <span>Anda harus mencentang persetujuan kebijakan terlebih dahulu.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ 
                        padding: '0.75rem 1rem', 
                        fontSize: '0.8rem', 
                        borderRadius: '0.6rem',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      onClick={() => window.history.back()}
                    >
                      <ChevronLeft size={16} />
                      <span>Edit Toko</span>
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ 
                        flex: 1, 
                        padding: '0.75rem', 
                        fontWeight: 800, 
                        fontSize: '0.85rem', 
                        borderRadius: '0.6rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: registerPlan === 'pro' ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: registerPlan === 'pro' ? '0 4px 15px rgba(245, 158, 11, 0.35)' : '0 4px 15px rgba(16, 185, 129, 0.35)'
                      }}
                      disabled={registerLoading}
                    >
                      <span>{registerLoading ? 'Mendaftarkan Toko...' : 'Selesaikan & Buka Toko'}</span>
                      <CheckCircle size={16} />
                    </button>
                  </div>
                </form>
              )}

              <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                Sudah punya akun? <span style={{ color: '#10b981', cursor: 'pointer', fontWeight: 700 }} onClick={() => setPortalTab('login')}>Login Admin</span>
              </div>
            </div>
          </div>
        )}

        {portalTab === 'checkout' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3.5rem 1.5rem', animation: 'fadeIn 0.3s ease-in-out' }}>
            <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Header Title Checkout */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.85rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '0.85rem' }}>
                  <Sparkles size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>CHECKOUT PEMBAYARAN PLAN PRO</span>
                </div>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' }}>
                  Selesaikan Pembayaran Aktivasi Paket
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: 0 }}>
                  Transfer sesuai nominal berikut untuk langsung mengaktifkan fitur Unlimited produk &amp; biolink kustom.
                </p>
              </div>

              {/* Main Content Grid: Left Summary Card, Right Payment Card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Card: Rincian Tagihan (Order Summary) */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.75)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>Rincian Pesanan</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>PAKET PRO</span>
                  </div>

                  {/* Price Calculations */}
                  {(() => {
                    const originalPrice = 30000;
                    const discountAmount = appliedCoupon ? (appliedCoupon.type === 'free' ? 30000 : appliedCoupon.discount) : 0;
                    const finalPrice = Math.max(0, originalPrice - discountAmount);

                    return (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                            <span>Paket Berlangganan:</span>
                            <strong style={{ color: '#ffffff' }}>Plan Pro / Premium (1 Bulan)</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                            <span>Harga Normal:</span>
                            <span style={{ textDecoration: 'line-through', color: '#64748b' }}>Rp 50.000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                            <span>Diskon Promo Plan:</span>
                            <strong style={{ color: '#34d399' }}>- Rp 20.000</strong>
                          </div>
                          {appliedCoupon && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '0.45rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                              <span>Kupon ({appliedCoupon.code}):</span>
                              <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                            <span>Biaya Layanan &amp; PPN:</span>
                            <strong style={{ color: '#ffffff' }}>Rp 0 (Gratis)</strong>
                          </div>
                        </div>

                        {/* Input Box Kode Kupon */}
                        <div style={{ marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.4rem', display: 'block' }}>Gunakan Kode Kupon / Diskon:</label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: CATAVOR100, DISKON10K" 
                              value={couponInput} 
                              onChange={(e) => {
                                setCouponInput(e.target.value.toUpperCase());
                                if (couponMsg) setCouponMsg(null);
                              }}
                              style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.78rem', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: '#fff', textTransform: 'uppercase' }}
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const cleanCode = couponInput.trim().toUpperCase();
                                if (!cleanCode) {
                                  setCouponMsg({ type: 'error', text: 'Masukkan kode kupon terlebih dahulu.' });
                                  return;
                                }
                                let masterCoupons = [];
                                try {
                                  if (settings.master_coupons) masterCoupons = JSON.parse(settings.master_coupons);
                                } catch {}
                                if (!masterCoupons.length) {
                                  masterCoupons = [
                                    { code: 'CATAVOR100', type: 'free', discount: 30000, label: 'Gratis 100% Plan Pro (1 Bulan)' },
                                    { code: 'GRATISPRO', type: 'free', discount: 30000, label: 'Gratis Uji Coba Plan Pro' },
                                    { code: 'DISKON10K', type: 'discount', discount: 10000, label: 'Potongan Harga Rp 10.000' }
                                  ];
                                }
                                const found = masterCoupons.find((c: any) => c.code.toUpperCase() === cleanCode);
                                if (found) {
                                  setAppliedCoupon(found);
                                  setCouponMsg({ type: 'success', text: `Kupon ${found.code} Berhasil! (${found.label})` });
                                } else {
                                  setCouponMsg({ type: 'error', text: `Kode kupon "${cleanCode}" tidak berlaku.` });
                                }
                              }}
                              style={{ padding: '0.5rem 0.85rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                              Terapkan
                            </button>
                          </div>

                          {couponMsg && (
                            <div style={{ fontSize: '0.72rem', color: couponMsg.type === 'success' ? '#34d399' : '#f87171', marginTop: '0.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              {couponMsg.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
                              <span>{couponMsg.text}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: '1px border-dashed rgba(255, 255, 255, 0.15)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>Total Tagihan:</span>
                          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: finalPrice === 0 ? '#34d399' : '#f59e0b' }}>
                            Rp {finalPrice.toLocaleString('id-ID')}
                            {finalPrice === 0 && <span style={{ fontSize: '0.72rem', color: '#34d399', marginLeft: '0.4rem', fontWeight: 800 }}>(GRATIS)</span>}
                          </div>
                        </div>

                        {finalPrice > 0 ? (
                          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.75rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>Lakukan pembayaran sebelum <strong>24 jam</strong> dari sekarang.</span>
                          </div>
                        ) : (
                          <div style={{ padding: '0.75rem', borderRadius: '0.65rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                            <span>Kupon gratis 100% diterapkan! Tidak perlu melakukan transfer bank.</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Right Card: Payment Method Switcher & Details */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'linear-gradient(180deg, rgba(17, 24, 21, 0.95) 0%, rgba(9, 14, 12, 0.98) 100%)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(() => {
                    const originalPrice = 30000;
                    const discountAmount = appliedCoupon ? (appliedCoupon.type === 'free' ? 30000 : appliedCoupon.discount) : 0;
                    const finalPrice = Math.max(0, originalPrice - discountAmount);

                    if (finalPrice === 0) {
                      return (
                        <div style={{ padding: '1rem 0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={28} style={{ color: '#10b981' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.35rem 0' }}>Aktivasi 100% Gratis!</h3>
                            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0, lineHeight: 1.45 }}>
                              Kupon Anda berhasil menggratiskan paket berlangganan Pro. Klik tombol di bawah ini untuk langsung membuka Dashboard.
                            </p>
                          </div>
                          <button 
                            type="button" 
                            className="btn-primary btn-full" 
                            style={{ 
                              padding: '0.85rem', 
                              fontWeight: 800, 
                              fontSize: '0.9rem', 
                              borderRadius: '0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            onClick={() => processCheckoutSubmission(true)}
                            disabled={registerLoading}
                          >
                            <Sparkles size={18} />
                            <span>{registerLoading ? 'Mengaktifkan Akun...' : 'Aktifkan Paket Pro Gratis Sekarang'}</span>
                          </button>

                          <button 
                            type="button" 
                            className="btn-secondary btn-full" 
                            style={{ 
                              padding: '0.65rem', 
                              fontWeight: 700, 
                              fontSize: '0.78rem', 
                              borderRadius: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#d1d5db',
                              cursor: 'pointer'
                            }}
                            onClick={handleCancelCheckout}
                          >
                            <Home size={15} />
                            <span>Kembali ke Halaman Utama</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Payment Method Selector Tabs */}
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.6rem', display: 'block' }}>Pilih Metode Pembayaran:</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            <button 
                              type="button"
                              onClick={() => setPaymentMethod('bank')}
                              style={{ 
                                padding: '0.65rem 0.5rem', 
                                borderRadius: '0.6rem', 
                                border: paymentMethod === 'bank' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.12)', 
                                backgroundColor: paymentMethod === 'bank' ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.3)', 
                                color: paymentMethod === 'bank' ? '#ffffff' : '#9ca3af',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <CreditCard size={15} style={{ color: paymentMethod === 'bank' ? '#10b981' : '#9ca3af' }} />
                              <span>Transfer Bank</span>
                            </button>

                            <button 
                              type="button"
                              onClick={() => setPaymentMethod('qris')}
                              style={{ 
                                padding: '0.65rem 0.5rem', 
                                borderRadius: '0.6rem', 
                                border: paymentMethod === 'qris' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.12)', 
                                backgroundColor: paymentMethod === 'qris' ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.3)', 
                                color: paymentMethod === 'qris' ? '#ffffff' : '#9ca3af',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <QrCode size={15} style={{ color: paymentMethod === 'qris' ? '#10b981' : '#9ca3af' }} />
                              <span>Scan QRIS</span>
                            </button>
                          </div>
                        </div>

                        {/* Panel Details: Bank Transfer Manual */}
                        {paymentMethod === 'bank' && (
                          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af' }}>Nama Bank Perusahaan:</span>
                              <strong style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 800 }}>{settings.payment_bank_name || 'Bank Central Asia (BCA)'}</strong>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div>
                                <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>Nomor Rekening:</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>{settings.payment_bank_account || '8830-1928-3920'}</div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText((settings.payment_bank_account || '8830-1928-3920').replace(/[^0-9]/g, ''));
                                  setCopiedAccountToast(true);
                                  setTimeout(() => setCopiedAccountToast(false), 2500);
                                }}
                                style={{ 
                                  padding: '0.4rem 0.75rem', 
                                  borderRadius: '0.4rem', 
                                  backgroundColor: copiedAccountToast ? '#10b981' : 'rgba(16, 185, 129, 0.15)', 
                                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                                  color: copiedAccountToast ? '#000' : '#34d399',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {copiedAccountToast ? <Check size={13} /> : <Copy size={13} />}
                                <span>{copiedAccountToast ? 'Tersalin!' : 'Salin Rekening'}</span>
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af' }}>Atas Nama:</span>
                              <strong style={{ fontSize: '0.82rem', color: '#ffffff' }}>{settings.payment_bank_holder || 'PT Catavor Media Digital'}</strong>
                            </div>
                          </div>
                        )}

                        {/* Panel Details: QRIS */}
                        {paymentMethod === 'qris' && (
                          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', textAlign: 'center' }}>
                            <div style={{ width: '180px', height: '180px', borderRadius: '12px', background: '#ffffff', padding: '8px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)', border: '2px solid #10b981' }}>
                              <img 
                                src={settings.payment_qris_image || '/img/qris_demo.svg'} 
                                alt="QRIS Catavor" 
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, lineHeight: 1.35 }}>
                              Scan kode QRIS di atas menggunakan M-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, ShopeePay, DANA, LinkAja).
                            </p>
                            <a 
                              href={settings.payment_qris_image || '/img/qris_demo.svg'} 
                              download="QRIS_Catavor_Payment.svg"
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.35rem', 
                                padding: '0.45rem 0.85rem', 
                                borderRadius: '0.4rem', 
                                backgroundColor: 'rgba(255,255,255,0.08)', 
                                border: '1px solid rgba(255,255,255,0.15)', 
                                color: '#ffffff', 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                textDecoration: 'none' 
                              }}
                            >
                              <Download size={14} /> Download Gambar QRIS
                            </a>
                          </div>
                        )}

                        {/* Form Upload Bukti Transfer */}
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            processCheckoutSubmission(false);
                          }}
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}
                        >
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e5e7eb' }}>Unggah Bukti Transfer / Scan *</label>
                            <div 
                              style={{ 
                                border: '2px dashed rgba(255,255,255,0.18)', 
                                borderRadius: '0.6rem', 
                                padding: '0.85rem', 
                                textAlign: 'center', 
                                backgroundColor: 'rgba(0,0,0,0.25)', 
                                cursor: 'pointer',
                                position: 'relative'
                              }}
                            >
                              <input 
                                type="file" 
                                accept="image/*" 
                                required
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setPaymentProofPreview(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                              />
                              {paymentProofPreview ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                  <img src={paymentProofPreview} alt="Bukti Transfer" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #10b981' }} />
                                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>Foto Bukti Siap Diunggah (Klik untuk ganti)</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                                  <Upload size={20} style={{ color: '#10b981' }} />
                                  <span style={{ fontSize: '0.75rem', color: '#d1d5db', fontWeight: 600 }}>Klik atau Geser Foto Bukti Pembayaran ke Sini</span>
                                  <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>Format JPG, PNG, atau WEBP (Maks 5MB)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e5e7eb' }}>Nomor WhatsApp / Catatan Pengirim (Opsional)</label>
                            <input 
                            type="text" 
                              className="form-input" 
                              placeholder="Contoh: WA 08123456789 - a.n Dzikri" 
                              value={paymentProofNote} 
                              onChange={(e) => setPaymentProofNote(e.target.value)}
                              style={{ borderRadius: '0.5rem', padding: '0.65rem 0.75rem', fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                            />
                          </div>

                          <button 
                            type="submit" 
                            className="btn-primary btn-full" 
                            style={{ 
                              padding: '0.75rem', 
                              fontWeight: 800, 
                              fontSize: '0.85rem', 
                              borderRadius: '0.6rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            disabled={registerLoading}
                          >
                            <Send size={16} />
                            <span>{registerLoading ? 'Memproses Pendaftaran...' : 'Kirim Bukti Pembayaran'}</span>
                          </button>
                          
                          <button 
                            type="button" 
                            className="btn-secondary btn-full" 
                            style={{ 
                              padding: '0.65rem', 
                              fontWeight: 700, 
                              fontSize: '0.78rem', 
                              borderRadius: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#d1d5db',
                              cursor: 'pointer'
                            }}
                            onClick={handleCancelCheckout}
                          >
                            <Home size={15} />
                            <span>Kembali ke Halaman Utama</span>
                          </button>
                        </form>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

            {/* Modal Sukses Konfirmasi Pembayaran */}
            {showPaymentSuccessModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '460px', padding: '2rem', borderRadius: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 12, 0.99) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
                    <CheckCircle size={36} style={{ color: '#10b981' }} />
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    Bukti Pembayaran Berhasil Dikirim!
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                    Terima kasih telah melakukan konfirmasi. Tim Admin Catavor akan memverifikasi bukti transaksi Anda. Akses <strong>Plan Pro</strong> Anda akan otomatis aktif maksimal dalam <strong>1x24 Jam</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <button 
                      className="btn-primary btn-full" 
                      style={{ padding: '0.8rem', fontSize: '0.85rem', fontWeight: 800 }}
                      onClick={() => {
                        const user = JSON.parse(localStorage.getItem('catavor_user') || '{}');
                        if (user.store_slug) {
                          setStoreSlug(user.store_slug);
                          setView('admin');
                        } else {
                          setPortalTab('home');
                        }
                        setShowPaymentSuccessModal(false);
                      }}
                    >
                      <span>Lanjut ke Dashboard Admin</span>
                      <ArrowRight size={16} />
                    </button>
                    <button 
                      className="btn-secondary btn-full" 
                      style={{ padding: '0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                      onClick={() => {
                        setShowPaymentSuccessModal(false);
                        setPortalTab('home');
                      }}
                    >
                      <span>Kembali ke Halaman Utama</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {['terms', 'privacy', 'acceptable_use'].includes(portalTab) && renderPolicyPage(portalTab as any)}
        </div>
      );
    }

  return (
    <>
      {/* Hidden File Input for WYSIWYG Editor Image Upload */}
      <input 
        type="file" 
        ref={imageInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleArticleImageUpload} 
      />

      {isDetailActive && selectedFauna ? (
        /* ==========================================================
           FULL-PAGE DESKTOP DETAIL VIEW (CUSTOM ONLINE SHOP AESTHETICS)
           ========================================================== */
        <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
          {/* Header */}
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-light)',
            padding: '1rem 2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            zIndex: 100
          }}>
            <button 
              onClick={() => {
                setIsDetailActive(false);
                setSelectedFauna(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem'
              }}
            >
              <ArrowLeft size={22} />
            </button>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Detail Produk</span>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, padding: '2rem', paddingBottom: '110px', overflowY: 'auto', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
              
              {/* Left Column: Media & Gallery */}
              <div>
                <div style={{ position: 'relative' }}>
                  <img 
                    src={
                      (selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 0)
                        ? (selectedFauna.detailed_info.images[activeImageIndex] || selectedFauna.image_url)
                        : selectedFauna.image_url
                    } 
                    alt={selectedFauna.name} 
                    style={{ width: '100%', height: '480px', objectFit: 'cover', borderRadius: '1rem', border: '1px solid var(--border-light)', cursor: 'zoom-in' }} 
                    onClick={() => {
                      setLightboxIndex(activeImageIndex)
                      setZoomScale(1)
                      setPanPosition({ x: 0, y: 0 })
                      setShowLightbox(true)
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    <ZoomIn size={14} />
                    <span>Klik gambar untuk memperbesar</span>
                  </div>
                </div>

                {/* Thumbnails list */}
                {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                    {selectedFauna.detailed_info.images.map((imgUrl: string, idx: number) => (
                      <img 
                        key={idx}
                        src={imgUrl} 
                        alt="" 
                        onClick={() => setActiveImageIndex(idx)}
                        style={{
                          width: '65px',
                          height: '65px',
                          objectFit: 'cover',
                          borderRadius: '0.5rem',
                          border: activeImageIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                          cursor: 'pointer',
                          flexShrink: 0
                        }} 
                        onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Info details */}
              <div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.5rem' }}>
                  {formatRupiah(selectedFauna.price)}
                </div>
                
                <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                  {selectedFauna.name}
                </h2>
                
                <div style={{ fontStyle: 'italic', fontSize: '1rem', color: 'var(--primary-hover)', marginBottom: '1.5rem' }}>
                  {selectedFauna.scientific_name}
                </div>

                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Kategori: <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.95rem' }}>{selectedFauna.class.toUpperCase()}</span>
                </div>

                {/* Specs List */}
                <div style={{ borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '1.25rem 0', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                    {selectedFauna.product_type === 'food' ? 'Spesifikasi Kuliner' : (selectedFauna.product_type === 'service' ? 'Spesifikasi Layanan' : (selectedFauna.product_type === 'digital' ? 'Spesifikasi File Digital' : 'Spesifikasi Produk'))}
                  </h3>
                  
                  {selectedFauna.product_type === 'food' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem' }}>
                      {selectedFauna.attributes?.portion_size && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Porsi / Isi Bersih</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.portion_size}</span>
                        </div>
                      )}
                      {(selectedFauna.attributes?.spicy_level || selectedFauna.attributes?.taste_options) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Varian / Rasa</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes?.spicy_level || selectedFauna.attributes?.taste_options}</span>
                        </div>
                      )}
                      {(selectedFauna.attributes?.prep_time || selectedFauna.attributes?.bake_status) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Waktu Masak / PO</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes?.prep_time || selectedFauna.attributes?.bake_status}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.cooking_guide && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Cara Memasak</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.cooking_guide}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.sugar_ice_options && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Pilihan Manis &amp; Es</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.sugar_ice_options}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.expired_info && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Masa Simpan</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.expired_info}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.storage_temp && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Suhu Simpan</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.storage_temp}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.serving_capacity && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Kapasitas Masak</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.serving_capacity}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.min_order && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Minimal Order</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.min_order}</span>
                        </div>
                      )}
                      {(selectedFauna.attributes?.serving_method || selectedFauna.attributes?.delivery_service) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Metode Layanan</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes?.serving_method || selectedFauna.attributes?.delivery_service}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.certification && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Sertifikasi</span>
                          <span style={{ fontWeight: 600, color: '#10b981' }}>{selectedFauna.attributes.certification}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Pengiriman</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.shipping_coverage || (selectedFauna.is_shipping_available ? 'Bisa Kirim' : 'Ambil Sendiri')}</span>
                      </div>
                    </div>
                  ) : selectedFauna.product_type === 'physical' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Kondisi</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes?.condition || 'Baru'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Berat Produk</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes?.weight ? `${selectedFauna.attributes.weight} Gram` : '100 Gram'}</span>
                      </div>
                      {selectedFauna.attributes?.brand && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Merek / Brand</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.brand}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.variant && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Varian / Pilihan</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.variant}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.min_purchase && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Min. Pembelian</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.min_purchase}</span>
                        </div>
                      )}
                      {selectedFauna.attributes?.max_purchase && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Maks. Pembelian</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.attributes.max_purchase}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Pengiriman</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.shipping_coverage || (selectedFauna.is_shipping_available ? 'Bisa Kirim se-Indonesia' : 'Ambil Sendiri')}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Bobot</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.weight || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Habitat</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.habitat}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Jangkauan Pengiriman</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.shipping_coverage || (selectedFauna.is_shipping_available ? 'Bisa Kirim se-Indonesia' : 'Ambil Sendiri')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status Konservasi</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.conservation_status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Asal Wilayah</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.native_region || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Masa Hidup</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFauna.detailed_info?.lifespan || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedFauna.description && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Deskripsi</h3>
                    <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {selectedFauna.description}
                    </p>
                  </div>
                )}

                {/* Shipping & Warranty */}
                {(selectedFauna.detailed_info?.shipping_terms || selectedFauna.detailed_info?.warranty_info) && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: (selectedFauna.detailed_info?.shipping_terms && selectedFauna.detailed_info?.warranty_info) ? '1fr 1fr' : '1fr', 
                    gap: '1.5rem', 
                    backgroundColor: 'rgba(255,255,255,0.01)', 
                    padding: '1.25rem', 
                    borderRadius: '0.5rem', 
                    border: '1px solid var(--border-light)', 
                    marginBottom: '1.5rem' 
                  }}>
                    {selectedFauna.detailed_info?.shipping_terms && (
                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--primary-hover)', fontWeight: 700, marginBottom: '0.35rem' }}>
                          {selectedFauna.product_type === 'service' ? 'Ketentuan & Jadwal Layanan' : (selectedFauna.product_type === 'digital' ? 'Panduan Akses File' : (selectedFauna.product_type === 'food' ? 'Ketentuan Pemesanan & Penyajian' : 'Ketentuan Pengiriman'))}
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {selectedFauna.detailed_info.shipping_terms}
                        </p>
                      </div>
                    )}
                    {selectedFauna.detailed_info?.warranty_info && (
                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 700, marginBottom: '0.35rem' }}>
                          {selectedFauna.product_type === 'digital' ? 'Ketentuan Lisensi' : (selectedFauna.product_type === 'fauna' ? 'Garansi Live Arrival (D.O.A)' : (selectedFauna.product_type === 'food' ? 'Petunjuk Penyimpanan' : 'Kebijakan Garansi'))}
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {selectedFauna.detailed_info.warranty_info}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* YouTube Video Embed */}
                {selectedFauna.video_url && getYoutubeEmbedUrl(selectedFauna.video_url) && (
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Video Dokumentasi</h3>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                      <iframe 
                        src={getYoutubeEmbedUrl(selectedFauna.video_url)} 
                        title={selectedFauna.name}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Recommendations Section */}
            <div style={{ marginTop: '4rem', borderTop: '1px solid var(--border-light)', paddingTop: '2.5rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Rekomendasi Satwa Serupa</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                {getRecommendations(selectedFauna).map(rec => (
                  <div 
                    key={rec.id} 
                    className="glass-panel" 
                    onClick={() => {
                      setSelectedFauna(rec);
                      setActiveImageIndex(0);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: '0.75rem', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <img 
                      src={rec.image_url} 
                      alt={rec.name} 
                      style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }}
                    />
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ display: 'inline-block', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {rec.class}
                        </span>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.4em', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                          {rec.name}
                        </div>
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>
                        {formatRupiah(rec.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sticky Bottom Footer */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#0b0e0c',
            borderTop: '1px solid var(--border-light)',
            padding: '1rem 3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Harga Produk</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{formatRupiah(selectedFauna.price)}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {view === 'admin' ? (
                <>
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => {
                      setIsDetailActive(false);
                      setSelectedFauna(null);
                    }}
                    style={{ height: '45px', padding: '0 2rem', fontSize: '0.9rem', borderRadius: '0.35rem' }}
                  >
                    Kembali
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary"
                    onClick={() => {
                      openEditModal(selectedFauna)
                    }}
                    style={{ height: '45px', padding: '0 2.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.35rem' }}
                  >
                    <Edit3 size={16} />
                    Edit Data
                  </button>
                  <button 
                    type="button" 
                    className="btn-danger"
                    onClick={async () => {
                      const deleted = await handleFaunaDelete(selectedFauna.id)
                      if (deleted) {
                        setIsDetailActive(false);
                        setSelectedFauna(null);
                      }
                    }}
                    style={{ height: '45px', padding: '0 2.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.35rem' }}
                  >
                    <Trash2 size={16} />
                    Hapus
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => {
                      if (!settings.enable_wa_direct && !settings.enable_wa_rekber) {
                        setShowMarketplacesSubMenu(true);
                      } else {
                        setShowMarketplacesSubMenu(false);
                      }
                      setShowPurchaseOptions(true);
                    }}
                    className="btn-primary"
                    style={{
                      height: '45px',
                      padding: '0 3rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#10b981',
                      borderColor: '#10b981',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      borderRadius: '0.35rem',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <ShoppingCart size={16} /> Beli Sekarang / Pilih Pembelian
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleShareItem(selectedFauna)}
                    className="btn-secondary"
                    style={{
                      height: '45px',
                      padding: '0 1.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      borderRadius: '0.35rem',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Share2 size={16} /> Bagikan
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header (Shows stylish Catavor brand header on 404 error pages, and store header on valid pages) */}
      {error ? (
        <header className="app-header">
          <div className="container header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <span style={{ 
                fontSize: '1.45rem', 
                fontWeight: 800, 
                color: '#ffffff',
                letterSpacing: '-0.01em',
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
              }}>
                Catavor
              </span>
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                type="button"
                className="btn-primary" 
                onClick={() => { window.location.href = window.location.origin; }}
                style={{ 
                  padding: '0.5rem 1.15rem', 
                  fontSize: '0.82rem', 
                  fontWeight: 800, 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer'
                }}
              >
                <Globe size={15} />
                <span>Portal Utama</span>
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header className="app-header">
          <div className="container header-content">
            <div className="logo-area">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(() => {
                  const titleText = settings.store_title || 'Catavor';
                  const scale = getDesktopHeaderScale(titleText);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                      {renderStoreLogo(settings.store_logo_url, 'logo-icon', scale.iconSize)}
                      <h1 
                        className="logo-text" 
                        style={{ margin: 0, fontSize: scale.titleFontSize, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: scale.maxWidth, transition: 'font-size 0.2s ease' }} 
                        title={titleText}
                      >
                        {titleText}
                      </h1>
                      {settings.plan === 'free' && (
                        <span style={{ fontSize: scale.badgeFontSize, fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--primary)', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Free by Catavor
                        </span>
                      )}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={handleShareStore}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    lineHeight: 1
                  }}
                  title="Bagikan Link Toko"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
            <div className="nav-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {view === 'catalog' ? (
                <>
                  <button 
                    type="button"
                    className={`btn-secondary ${activePublicTab === 'catalog' ? 'active' : ''}`} 
                    onClick={() => setActivePublicTab('catalog')}
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      backgroundColor: activePublicTab === 'catalog' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                      color: activePublicTab === 'catalog' ? '#fff' : 'var(--text-secondary)',
                      border: activePublicTab === 'catalog' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                    }}
                  >
                    🔍 Katalog Produk
                  </button>
                  <button 
                    type="button"
                    className={`btn-secondary ${activePublicTab === 'about' ? 'active' : ''}`} 
                    onClick={() => setActivePublicTab('about')}
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      backgroundColor: activePublicTab === 'about' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                      color: activePublicTab === 'about' ? '#fff' : 'var(--text-secondary)',
                      border: activePublicTab === 'about' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                    }}
                  >
                    📖 Tentang Kami
                  </button>
                </>
              ) : (
                <button 
                  className="btn-primary" 
                  onClick={goToCatalog}
                >
                  Lihat Katalog
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="container" style={{ paddingBottom: '4rem' }}>
        {view === 'catalog' ? (
          /* ========================================================
             CUSTOMER VIEW
             ======================================================== */
          activePublicTab === 'about' ? (
            /* PUBLIC ABOUT US PAGE (DESKTOP - 100% DYNAMIC VISIBILITY) */
            (() => {
              const parsedCards = (() => {
                try {
                  return settings.about_cards ? JSON.parse(settings.about_cards) : [];
                } catch (e) {
                  return [];
                }
              })();

              const cleanEmoji = (text: string) => {
                return text.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}]/gu, '').trim();
              };

              const hasTitle = Boolean(settings.about_title && settings.about_title.trim());
              const hasSlogan = Boolean(settings.about_slogan && settings.about_slogan.trim());
              const hasDescription = Boolean(settings.about_description && settings.about_description.trim());
              const hasDisclaimer = Boolean(settings.about_disclaimer && settings.about_disclaimer.trim());
              const hasCards = Array.isArray(parsedCards) && parsedCards.length > 0;

              const parsedSocial = (() => {
                try {
                  return settings.social_links ? (typeof settings.social_links === 'string' ? JSON.parse(settings.social_links) : settings.social_links) : [];
                } catch (e) {
                  return [];
                }
              })();

              const hasLocation = Boolean(settings.about_location && settings.about_location.trim());
              const hasHours = Boolean(settings.show_hours === true);
              const hasWhatsapp = Boolean(settings.whatsapp_number && settings.whatsapp_number.trim());
              const hasWebsite = Boolean(settings.official_website && settings.official_website.trim());
              const hasSocial = Array.isArray(parsedSocial) && parsedSocial.length > 0;
              const hasAnyContactChannel = hasLocation || hasHours || hasWhatsapp || hasWebsite || hasSocial;

              return (
                <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', marginTop: '1.5rem', maxWidth: '880px', margin: '1.5rem auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', border: '1px solid var(--border-light)' }}>
                  {/* Hero Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
                    <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', width: '52px', height: '52px', display: 'flex', alignItems: 'center', flexShrink: 0, justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                      <Info size={26} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {hasTitle ? settings.about_title : (settings.store_title || 'Catavor')}
                      </h2>
                      {hasSlogan && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                          {settings.about_slogan}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description Paragraph (100% Hidden if empty) */}
                  {hasDescription && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {settings.about_description}
                    </p>
                  )}

                  {/* Value Cards (100% Hidden if empty) */}
                  {hasCards && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        {parsedCards.map((card: any, idx: number) => (
                          <div key={idx} className="glass-panel" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ backgroundColor: 'var(--primary-glow)', borderRadius: '0.65rem', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-light)', color: 'var(--primary)' }}>
                              {renderAboutIcon(card.icon, 22)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', marginTop: '0.1rem' }}>{cleanEmoji(card.title)}</h4>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{card.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}



                  <QRCodeModal 
                    isOpen={showQRModal} 
                    onClose={() => {
                      setShowQRModal(false);
                      const slug = storeSlug || getStoreSlug();
                      if (slug) {
                        window.history.pushState({}, '', `/${slug}/about`);
                      }
                    }} 
                    storeSlug={storeSlug || ''} 
                    storeTitle={settings.store_title}
                    storeLogoUrl={settings.store_logo_url}
                    storeSlogan={settings.about_slogan || settings.store_slogan}
                    onToast={showToast} 
                  />

                  {/* Hubungi Kami Section (100% Hidden if all 5 contact channels are empty) */}
                  {hasAnyContactChannel && (
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.75rem', marginTop: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem', letterSpacing: '0.02em', textTransform: 'uppercase', opacity: 0.9 }}>
                        Hubungi Kami
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Lokasi (100% Hidden if empty - no fallback) */}
                        {hasLocation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '0.65rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0 }}>
                              <MapPin size={18} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Lokasi / Alamat Resmi</span>
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>{settings.about_location}</span>
                            </div>
                          </div>
                        )}

                        {hasHours && <OperationalHoursCard rawHours={settings.about_hours} />}
                        {hasWhatsapp && <WhatsAppContactsCard rawWhatsappNumber={settings.whatsapp_number} />}
                        {hasWebsite && <OfficialWebsiteCard url={settings.official_website} />}
                        {hasSocial && <SocialMediaSection rawSocialLinks={settings.social_links} />}
                      </div>
                    </div>
                  )}

                  {/* Share Action */}
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleShareStore}
                      className="btn-secondary"
                      style={{
                        padding: '0.65rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <Share2 size={16} style={{ color: 'var(--primary)' }} /> Bagikan Halaman Ini
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
          <>
            {/* Catavor SaaS Floating Banner for Free Plan Stores */}
            {settings.plan === 'free' && (
              <div 
                className="glass-panel animate-fade-in"
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                    <Sparkles size={16} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
                    <span>Ingin membuat katalog digital seperti <strong>{settings.store_title || 'toko ini'}</strong>?</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStoreSlug(null);
                    setPortalTab('register');
                    setRegisterStep(1);
                  }}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Buat Katalog Anda Gratis ⚡
                </button>
              </div>
            )}

            {/* Hero Section */}
            <section className="hero-section">
              <h2 className="hero-title">
                Galeri Satwa Hias <span className="hero-highlight">Premium</span>
              </h2>
              <p className="hero-desc">
                Kami menyediakan berbagai pilihan produk barang dan produk berkualitas tinggi dengan layanan cepat, aman, dan terpercaya.
              </p>
            </section>



            {/* Loading & Error States */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
                <Loader className="animate-spin" size={40} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Memuat katalog produk...</p>
              </div>
            )}

            {error && (
              <div 
                className="glass-panel animate-fade-in" 
                style={{ 
                  padding: '5rem 2.5rem 3.5rem 2.5rem', 
                  textAlign: 'center', 
                  borderRadius: '1.5rem',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(9, 14, 12, 0.95) 100%)',
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.35rem',
                  position: 'relative',
                  overflow: 'hidden',
                  maxWidth: '680px',
                  margin: '2rem auto'
                }}
              >
                {/* Ambient Glow Background */}
                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.12)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '180px', height: '180px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', filter: 'blur(40px)', pointerEvents: 'none' }} />

                {/* 404 Status Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 1rem', borderRadius: '20px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
                  404 • Halaman / Katalog Tidak Ditemukan
                </div>

                {/* Glowing Icon Container */}
                <div 
                  style={{ 
                    width: '92px', 
                    height: '92px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                    border: '2px solid rgba(245, 158, 11, 0.35)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#f59e0b',
                    boxShadow: '0 0 36px rgba(245, 158, 11, 0.28)'
                  }}
                >
                  {storeSlug ? <Store size={46} /> : <Globe size={46} />}
                </div>

                {/* Text Content */}
                <div>
                  <h3 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                    {storeSlug ? 'Katalog Tidak Ditemukan' : 'Halaman Tidak Ditemukan'}
                  </h3>
                  <p style={{ fontSize: '0.94rem', color: '#9ca3af', maxWidth: '480px', margin: '0 auto', lineHeight: 1.65 }}>
                    {storeSlug 
                      ? <>Tautan atau username katalog <strong style={{ color: '#e5e7eb' }}>catavor.com/{storeSlug}</strong> tidak terdaftar atau belum diaktifkan di platform Catavor.</>
                      : <>Alamat tautan URL <strong style={{ color: '#e5e7eb' }}>{window.location.pathname}</strong> tidak terdaftar atau salah ketik.</>}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => { window.location.href = window.location.origin; }}
                    style={{ padding: '0.85rem 1.75rem', fontSize: '0.9rem', fontWeight: 800, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)' }}
                  >
                    <Sparkles size={18} />
                    Buat Katalog Anda Gratis ⚡
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => { window.location.href = window.location.origin; }}
                    style={{ padding: '0.85rem 1.5rem', fontSize: '0.88rem', fontWeight: 700, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                  >
                    <Globe size={16} />
                    Ke Halaman Utama Portal
                  </button>
                </div>

                {/* Brand Platform Footer */}
                <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '1rem', width: '100%', marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                    Powered by <strong style={{ color: '#9ca3af' }}>Catavor</strong> • Multi-Tenant Digital Catalog Platform
                  </p>
                </div>
              </div>
            )}

            {/* Catalog Main Content */}
            {!loading && !error && (
              <>
                {faunas.length === 0 ? (
                  /* EXECUTIVE PREMIUM EMPTY STATE (Shown when store has 0 products) */
                  <div 
                    className="glass-panel animate-fade-in" 
                    style={{ 
                      padding: '4.5rem 2rem', 
                      textAlign: 'center', 
                      borderRadius: '1.25rem',
                      border: '1px solid var(--border-light)',
                      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.6) 0%, rgba(9, 14, 12, 0.8) 100%)',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1.15rem'
                    }}
                  >
                    <div 
                      style={{ 
                        width: '76px', 
                        height: '76px', 
                        borderRadius: '50%', 
                        backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                        border: '2px solid rgba(16, 185, 129, 0.3)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#10b981',
                        boxShadow: '0 0 24px rgba(16, 185, 129, 0.18)'
                      }}
                    >
                      <Layers size={38} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.45rem' }}>
                        Katalog Masih Kosong
                      </h3>
                      <p style={{ fontSize: '0.9rem', color: '#9ca3af', maxWidth: '460px', margin: '0 auto', lineHeight: 1.55 }}>
                        Pemilik catalog <strong>{settings.store_title || 'ini'}</strong> belum mengunggah data ke dalam katalog ini. Silakan kunjungi kembali nanti!
                      </p>
                    </div>
                    {isStoreOwner && (
                      <button 
                        className="btn-primary" 
                        onClick={() => setView('admin')}
                        style={{ padding: '0.75rem 1.6rem', fontSize: '0.88rem', fontWeight: 700, borderRadius: '0.65rem', marginTop: '0.5rem' }}
                      >
                        + Tambah Produk Pertama
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Filter Panel (Only shown if store has at least 1 product) */}
                    {isHybridStore && (
                      <div className="product-type-filter-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => { setProductTypeFilter('all'); setClassFilter('all'); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '999px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: productTypeFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                            backgroundColor: productTypeFilter === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                            color: productTypeFilter === 'all' ? '#000000' : 'var(--text-secondary)'
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Semua Katalog ({faunas.length})</span>
                        </button>
                        {availableProductTypes.includes('physical') && (
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('physical'); setClassFilter('all'); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: productTypeFilter === 'physical' ? '1px solid #3b82f6' : '1px solid var(--border-light)',
                              backgroundColor: productTypeFilter === 'physical' ? '#3b82f6' : 'rgba(255,255,255,0.03)',
                              color: productTypeFilter === 'physical' ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <Package size={14} />
                            <span>Barang Fisik ({faunas.filter(f => (f.product_type || 'physical') === 'physical').length})</span>
                          </button>
                        )}
                        {availableProductTypes.includes('food') && (
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('food'); setClassFilter('all'); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: productTypeFilter === 'food' ? '1px solid #ef4444' : '1px solid var(--border-light)',
                              backgroundColor: productTypeFilter === 'food' ? '#ef4444' : 'rgba(255,255,255,0.03)',
                              color: productTypeFilter === 'food' ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <Utensils size={14} />
                            <span>Kuliner &amp; Menu ({faunas.filter(f => f.product_type === 'food').length})</span>
                          </button>
                        )}
                        {availableProductTypes.includes('service') && (
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('service'); setClassFilter('all'); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: productTypeFilter === 'service' ? '1px solid #f59e0b' : '1px solid var(--border-light)',
                              backgroundColor: productTypeFilter === 'service' ? '#f59e0b' : 'rgba(255,255,255,0.03)',
                              color: productTypeFilter === 'service' ? '#000000' : 'var(--text-secondary)'
                            }}
                          >
                            <Wrench size={14} />
                            <span>Jasa &amp; Layanan ({faunas.filter(f => f.product_type === 'service').length})</span>
                          </button>
                        )}
                        {availableProductTypes.includes('digital') && (
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('digital'); setClassFilter('all'); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: productTypeFilter === 'digital' ? '1px solid #8b5cf6' : '1px solid var(--border-light)',
                              backgroundColor: productTypeFilter === 'digital' ? '#8b5cf6' : 'rgba(255,255,255,0.03)',
                              color: productTypeFilter === 'digital' ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <FileCode size={14} />
                            <span>Item Digital ({faunas.filter(f => f.product_type === 'digital').length})</span>
                          </button>
                        )}
                        {availableProductTypes.includes('fauna') && (
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('fauna'); setClassFilter('all'); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: productTypeFilter === 'fauna' ? '1px solid #10b981' : '1px solid var(--border-light)',
                              backgroundColor: productTypeFilter === 'fauna' ? '#10b981' : 'rgba(255,255,255,0.03)',
                              color: productTypeFilter === 'fauna' ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <Compass size={14} />
                            <span>Fauna &amp; Satwa ({faunas.filter(f => f.product_type === 'fauna').length})</span>
                          </button>
                        )}
                      </div>
                    )}

                    <section className="glass-panel controls-panel">
                      <div className="search-wrapper">
                        <Search className="search-icon" />
                        <input 
                          type="text" 
                          className="search-input" 
                          placeholder="Cari produk / item katalog..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <div className="filters-wrapper">
                        <select 
                          className="filter-select"
                          value={classFilter}
                          onChange={(e) => setClassFilter(e.target.value)}
                        >
                          <option value="all">Semua Kategori ({availableCategories.length})</option>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <select 
                          className="filter-select"
                          value={habitatFilter}
                          onChange={(e) => setHabitatFilter(e.target.value)}
                        >
                          <option value="all">Semua Tipe / Variasi</option>
                          {availableSubTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </section>

                    {filteredFaunas.length === 0 ? (
                      /* SEARCH NO RESULTS EMPTY STATE */
                      <div className="glass-panel animate-fade-in" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '1rem' }}>
                        <Search size={44} style={{ marginBottom: '0.85rem', color: 'var(--text-muted)' }} />
                        <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem' }}>Item Tidak Ditemukan</h3>
                        <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Tidak ada item yang sesuai dengan kriteria pencarian atau filter katalog Anda.</p>
                        <button 
                          className="btn-secondary" 
                          onClick={() => { setSearch(''); setClassFilter('all'); setHabitatFilter('all'); setProductTypeFilter('all'); }}
                          style={{ marginTop: '1.25rem', padding: '0.55rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}
                        >
                          Reset Filter Pencarian
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="fauna-grid">
                          {filteredFaunas.slice(0, displayLimit).map((fauna) => (
                        <div 
                          key={fauna.id} 
                          className="glass-panel glass-panel-hover fauna-card"
                          onClick={() => fetchDetails(fauna.id)}
                          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                          <div className="card-image-container" style={{ height: '240px', position: 'relative' }}>
                            <img 
                              src={fauna.image_url} 
                              alt={fauna.name} 
                              className="card-img" 
                              onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareItem(fauna);
                              }}
                              style={{
                                position: 'absolute',
                                top: '0.75rem',
                                right: '0.75rem',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(9, 14, 12, 0.6)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backdropFilter: 'blur(4px)',
                                zIndex: 10
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = '#000'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(9, 14, 12, 0.6)'; e.currentTarget.style.color = '#fff'; }}
                              title="Bagikan produk"
                            >
                              <Share2 size={14} />
                            </button>

                          </div>
                          <div className="card-body" style={{ padding: '1.25rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '6px',
                                backgroundColor: (fauna.product_type === 'food' ? '#ef4444' : fauna.product_type === 'service' ? '#f59e0b' : fauna.product_type === 'digital' ? '#8b5cf6' : fauna.product_type === 'fauna' ? '#10b981' : '#3b82f6') + '22',
                                color: fauna.product_type === 'food' ? '#f87171' : fauna.product_type === 'service' ? '#fbbf24' : fauna.product_type === 'digital' ? '#c084fc' : fauna.product_type === 'fauna' ? '#34d399' : '#60a5fa',
                                border: `1px solid ${(fauna.product_type === 'food' ? '#ef4444' : fauna.product_type === 'service' ? '#f59e0b' : fauna.product_type === 'digital' ? '#8b5cf6' : fauna.product_type === 'fauna' ? '#10b981' : '#3b82f6')}40`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                {fauna.class}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fauna.habitat}</span>
                            </div>
                            <h3 className="card-title" style={{ fontSize: '1.1rem', margin: '0.2rem 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#ffffff' }}>{fauna.name}</h3>
                            <div className="card-subtitle" style={{ fontSize: '0.8rem', margin: 0, fontStyle: 'italic', color: 'var(--text-muted)' }}>{fauna.scientific_name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                              <div className="card-price" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>{formatRupiah(fauna.price)}</div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                Beli / Detail &rarr;
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Infinite Scroll loading indicator */}
                    {loadingMore && (
                      <div className="fauna-grid" style={{ marginTop: '2rem' }}>
                        {[1, 2, 3, 4].map((i) => (
                          <div 
                            key={i} 
                            className="glass-panel"
                            style={{ display: 'flex', flexDirection: 'column', height: '360px', opacity: 0.7 }}
                          >
                            <div style={{ height: '240px', backgroundColor: 'rgba(255,255,255,0.03)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', animation: 'shimmer 1.5s infinite' }}></div>
                            </div>
                            <div style={{ padding: '1.25rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1, justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <div style={{ height: '10px', width: '30%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px' }}></div>
                                  <div style={{ height: '10px', width: '20%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px' }}></div>
                                </div>
                                <div style={{ height: '16px', width: '80%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginTop: '0.75rem' }}></div>
                                <div style={{ height: '10px', width: '60%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginTop: '0.5rem' }}></div>
                              </div>
                              <div style={{ height: '16px', width: '50%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
          )
        ) : view === 'admin' ? (
          /* ========================================================
             ADMIN SYSTEM WITH STRICT MULTI-TENANT GUARD
             ======================================================== */
          token && !isStoreOwner ? (
            /* 403 FORBIDDEN ACCESS CARD FOR OTHER STORE OWNER */
            <div className="glass-panel animate-fade-in" style={{ maxWidth: '520px', margin: '4rem auto', padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#ef4444' }}>
                <ShieldAlert size={32} />
              </div>
              
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.25rem' }}>
                403 • Akses Admin Ditolak
              </span>
              
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>
                Izin Pengelola Tidak Ditemukan
              </h2>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
                Anda terautentikasi sebagai pengelola katalog <strong style={{ color: 'var(--primary)' }}>"{adminUser?.store_slug || 'lain'}"</strong>, tetapi mencoba mengakses panel admin katalog <strong style={{ color: '#ef4444' }}>"{storeSlug}"</strong>. Anda tidak memiliki wewenang untuk mengelola atau melihat data sensitif katalog ini.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {adminUser?.store_slug && (
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => window.location.href = `/${adminUser.store_slug}/admin`}
                    style={{ padding: '0.75rem', fontSize: '0.88rem', fontWeight: 700, width: '100%' }}
                  >
                    Ke Dashboard Katalog Saya ({adminUser.store_slug}) &rarr;
                  </button>
                )}
                
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleLogout}
                  style={{ padding: '0.75rem', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                >
                  Keluar Sesi / Ganti Akun
                </button>
                
                <button 
                  type="button" 
                  onClick={() => window.location.href = `/${storeSlug}`}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.25rem', textDecoration: 'underline' }}
                >
                  Kembali ke Katalog Publik {storeSlug}
                </button>
              </div>
            </div>
          ) : !token ? (
            /* ADMIN LOGIN SCREEN (DYNAMIC HIGH-CONTRAST DESIGN) */
            <div className="glass-panel animate-fade-in" style={{ maxWidth: '420px', margin: '4rem auto', padding: '2.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <Lock size={36} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Login Administrator</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Autentikasi login diperlukan untuk masuk ke dashboard admin.
                </p>
              </div>

              {loginError && (
                <div className="alert-message alert-error">
                  {loginError}
                </div>
              )}

              {/* Google SSO Login Button */}
              <button 
                type="button" 
                onClick={handleGoogleSSO}
                style={{ 
                  width: '100%', 
                  padding: '0.7rem', 
                  borderRadius: '0.6rem', 
                  backgroundColor: 'var(--btn-secondary-bg)', 
                  border: '1px solid var(--btn-secondary-border)', 
                  color: 'var(--btn-secondary-text)', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.65rem', 
                  marginBottom: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Masuk dengan Google</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ATAU LOGIN MANUAL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              </div>

              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Alamat Email Admin *</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="admin@catavor.com"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Kata Sandi *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="password123"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-primary btn-full" 
                  disabled={loginLoading}
                  style={{ fontWeight: 800 }}
                >
                  {loginLoading ? 'Memverifikasi...' : 'Masuk'}
                </button>
              </form>
            </div>
          ) : !isPasswordChanged ? (
            /* FIRST TIME PASSWORD REQUIREMENT */
            <div className="glass-panel animate-fade-in" style={{ maxWidth: '460px', margin: '4rem auto', padding: '2.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <Lock size={36} style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }} />
                <h2 style={{ fontSize: '1.5rem' }}>Ganti Password Pertama Kali</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Untuk alasan keamanan sistem, Administrator wajib mengubah password bawaan sebelum dapat menggunakan dashboard admin.
                </p>
              </div>

              {firstPasswordError && (
                <div className="alert-message alert-error">
                  {firstPasswordError}
                </div>
              )}

              <form onSubmit={handleFirstPasswordSubmit}>
                <div className="form-group">
                  <label className="form-label">Nama Lengkap Admin</label>
                  <input 
                    type="text" 
                    className="form-input"
                    required
                    value={firstPasswordForm.name}
                    onChange={(e) => setFirstPasswordForm({ ...firstPasswordForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Admin</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    required
                    value={firstPasswordForm.email}
                    onChange={(e) => setFirstPasswordForm({ ...firstPasswordForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password Baru *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Minimal 6 karakter..."
                    required
                    value={firstPasswordForm.password}
                    onChange={(e) => setFirstPasswordForm({ ...firstPasswordForm, password: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Konfirmasi Password Baru *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Ketik ulang password baru..."
                    required
                    value={firstPasswordForm.confirm_password}
                    onChange={(e) => setFirstPasswordForm({ ...firstPasswordForm, confirm_password: e.target.value })}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-primary btn-full" 
                  disabled={firstPasswordLoading}
                >
                  {firstPasswordLoading ? 'Memproses...' : 'Perbarui Password & Masuk'}
                </button>
              </form>
            </div>
          ) : (
            /* ADMIN DASHBOARD (LOGGED IN & PASSWORD CHANGED) */
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Panel Administrator
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Selamat datang, <strong>{adminUser?.name}</strong> ({adminUser?.email}). Kelola toko dan postingan Anda.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {/* Notification Bell Button */}
                  <button 
                    type="button" 
                    onClick={() => {
                      setAdminTab('notifications');
                      const slug = getStoreSlug();
                      if (slug) {
                        window.history.pushState({}, '', `/${slug}/admin/notifications`);
                      }
                    }}
                    style={{ 
                      position: 'relative', 
                      background: 'rgba(255,255,255,0.06)', 
                      border: '1px solid rgba(255,255,255,0.12)', 
                      borderRadius: '0.6rem', 
                      padding: '0.65rem 0.85rem', 
                      cursor: 'pointer', 
                      color: '#fff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Bell size={18} style={{ color: notifications.some(n => !n.read) ? '#f59e0b' : '#9ca3af' }} />
                    <span>Notifikasi</span>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.62rem', fontWeight: 900, borderRadius: '9999px', padding: '0.1rem 0.45rem', border: '1.5px solid #0f172a' }}>
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>

                  {adminTab === 'items' && (
                    <button className="btn-primary" onClick={() => openCreateModal('physical')}>
                      <Plus size={18} />
                      Tambah Item Baru
                    </button>
                  )}
                  <button className="btn-danger" onClick={handleLogout} style={{ padding: '0.65rem 1rem' }}>
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>

              {/* Pending Pro Payment Verification Banner */}
              {adminUser?.payment_status === 'pending_approval' && (
                <div style={{ padding: '1rem 1.25rem', borderRadius: '0.85rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fef3c7', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Clock size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: '#ffffff', display: 'block', fontSize: '0.9rem', marginBottom: '0.15rem' }}>🕒 Pembayaran Plan Pro Dalam Verifikasi (Est. 1x24 Jam)</strong>
                      <span>Bukti transaksi pembayaran Paket Pro Anda telah diterima. Akun Anda dapat digunakan dengan fitur Plan Free sementara sampai diverifikasi oleh Tim Admin.</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.3rem 0.75rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.5)', whiteSpace: 'nowrap' }}>
                    PENDING VERIFIKASI
                  </span>
                </div>
              )}

              {/* Onboarding Banner: Lengkapi Pengaturan Halaman Tentang Kami */}
              {showAboutOnboarding && (
                <div style={{
                  padding: '1.15rem 1.35rem',
                  borderRadius: '1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.18) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  marginBottom: '1.5rem',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
                  backdropFilter: 'blur(10px)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1 }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      flexShrink: 0,
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.3)'
                    }}>
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff', display: 'block', fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                        ✨ Selamat Datang di Catavor! Lengkapi Informasi Toko Anda
                      </strong>
                      <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.8rem', lineHeight: 1.45 }}>
                        Agar katalog digital Anda terlihat lebih profesional dan terpercaya bagi pengunjung, mari lengkapi informasi Halaman Tentang Kami (Alamat Toko, Jam Operasional, dan Profil Komitmen Layanan).
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('settings');
                        setSettingsSubTab('about');
                      }}
                      style={{
                        padding: '0.55rem 1.1rem',
                        borderRadius: '0.65rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Sparkles size={15} /> Lengkapi Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissAboutOnboarding()}
                      style={{
                        padding: '0.55rem 0.85rem',
                        borderRadius: '0.65rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#9ca3af',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Nanti Saja
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Pusat Notifikasi Dashboard */}
              {showNotificationModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                  <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '540px', borderRadius: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 12, 0.99) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Bell size={20} style={{ color: '#f59e0b' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Pusat Notifikasi System &amp; Admin</h3>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowNotificationModal(false)}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.25rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ padding: '1.25rem 1.5rem', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem 0', fontSize: '0.85rem' }}>
                          Belum ada notifikasi baru untuk Anda.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            style={{ 
                              padding: '1rem', 
                              borderRadius: '0.75rem', 
                              backgroundColor: n.read ? 'rgba(255,255,255,0.03)' : 'rgba(16, 185, 129, 0.08)', 
                              border: n.read ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(16, 185, 129, 0.25)', 
                              display: 'flex', 
                              gap: '0.85rem', 
                              alignItems: 'flex-start' 
                            }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: n.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {n.type === 'success' ? <CheckCircle size={18} style={{ color: '#10b981' }} /> : <Clock size={18} style={{ color: '#f59e0b' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>{n.title}</strong>
                                <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>{n.time}</span>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between' }}>
                      <button 
                        type="button" 
                        onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Tandai Semua Sudah Dibaca
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowNotificationModal(false)}
                        style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Selector */}
              <div className="admin-tabs">
                <button 
                  className={`admin-tab ${adminTab === 'items' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminTab('items');
                    const slug = getStoreSlug();
                    if (slug) window.history.pushState({}, '', `/${slug}/admin/items`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <PackageCheck size={16} />
                  <span>Daftar Item Katalog</span>
                </button>
                <button 
                  className={`admin-tab ${adminTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminTab('notifications');
                    const slug = getStoreSlug();
                    if (slug) window.history.pushState({}, '', `/${slug}/admin/notifications`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <BellRing size={16} />
                  <span>Notifikasi &amp; Aktivitas</span>
                  {unreadCount > 0 && <span className="badge" style={{ backgroundColor: 'var(--primary)', color: '#000', borderRadius: '999px', fontSize: '0.65rem', padding: '0.1rem 0.45rem', marginLeft: '0.2rem', fontWeight: 800 }}>{unreadCount}</span>}
                </button>
                <button 
                  className={`admin-tab ${adminTab === 'settings' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminTab('settings');
                    const slug = getStoreSlug();
                    if (slug) window.history.pushState({}, '', `/${slug}/admin/settings`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <SlidersHorizontal size={16} />
                  <span>Pengaturan Toko</span>
                </button>
                <button 
                  className={`admin-tab ${adminTab === 'profile' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminTab('profile');
                    const slug = getStoreSlug();
                    if (slug) window.history.pushState({}, '', `/${slug}/admin/profile`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <UserCheck size={16} />
                  <span>Profil &amp; Password Admin</span>
                </button>
                {false && settings.articles_enabled !== '0' && (
                  <button 
                    className={`admin-tab ${adminTab === 'articles' ? 'active' : ''}`}
                    onClick={() => { setAdminTab('articles'); setArticleTabState('hub'); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <BookOpen size={16} />
                    <span>Artikel &amp; Edukasi</span>
                  </button>
                )}
                <button 
                  className={`admin-tab ${adminTab === 'policies' ? 'active' : ''}`}
                  onClick={() => { 
                    setAdminTab('policies'); 
                    fetchPolicies(); 
                    fetchPolicyAuditLogs();
                    const slug = getStoreSlug();
                    if (slug) window.history.pushState({}, '', `/${slug}/admin/policies`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Scale size={16} />
                  <span>Legal &amp; Kebijakan Platform</span>
                </button>
                <button 
                  className={`admin-tab ${adminTab === 'help' ? 'active' : ''}`}
                  onClick={() => { 
                    setAdminTab('help');
                    const slug = getStoreSlug();
                    if (slug) {
                      window.history.pushState({}, '', `/${slug}/admin/help`);
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <LifeBuoy size={16} />
                  <span>Pusat Bantuan &amp; Support</span>
                </button>
              </div>

              {/* Admin Tabs Content */}
              {adminTab === 'items' && (
                /* TAB 1: CRUD LIST & ADMIN INVENTORY CONTROLS */
                loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loader className="animate-spin" style={{ color: 'var(--primary)' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
                    
                    {/* Top Control Bar: Search & Level-1 Type Pills */}
                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)', background: 'var(--card-bg-gradient)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      
                      {/* Search Bar + Secondary Dropdowns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        
                        {/* Search Input */}
                        <div style={{ position: 'relative' }}>
                          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input 
                            type="text"
                            className="form-input"
                            placeholder="Cari nama item, ilmiah, kategori, atau deskripsi..."
                            value={adminSearch}
                            onChange={(e) => { setAdminSearch(e.target.value); setAdminPage(1); }}
                            style={{ paddingLeft: '2.4rem', paddingRight: adminSearch ? '2.2rem' : '0.85rem', height: '40px', fontSize: '0.84rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)' }}
                          />
                          {adminSearch && (
                            <button
                              type="button"
                              onClick={() => { setAdminSearch(''); setAdminPage(1); }}
                              style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Category Dropdown */}
                        <select
                          className="form-select"
                          value={adminClassFilter}
                          onChange={(e) => { setAdminClassFilter(e.target.value); setAdminPage(1); }}
                          style={{ height: '40px', fontSize: '0.82rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)' }}
                        >
                          <option value="all">Semua Kategori ({availableAdminCategories.length})</option>
                          {availableAdminCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>

                        {/* Sort Dropdown */}
                        <select
                          className="form-select"
                          value={adminSortBy}
                          onChange={(e) => { setAdminSortBy(e.target.value as any); setAdminPage(1); }}
                          style={{ height: '40px', fontSize: '0.82rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)' }}
                        >
                          <option value="newest">Terbaru</option>
                          <option value="oldest">Terlama</option>
                          <option value="name_asc">Nama (A-Z)</option>
                          <option value="price_asc">Harga Terendah</option>
                          <option value="price_desc">Harga Tertinggi</option>
                        </select>
                      </div>

                      {/* Level-1 Type Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => { setAdminProductTypeFilter('all'); setAdminClassFilter('all'); setAdminPage(1); }}
                            style={{
                              padding: '0.35rem 0.8rem',
                              borderRadius: '20px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              border: adminProductTypeFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              backgroundColor: adminProductTypeFilter === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                              color: adminProductTypeFilter === 'all' ? '#000000' : 'var(--text-secondary)'
                            }}
                          >
                            ✨ Semua ({faunas.length})
                          </button>
                          {availableProductTypes.includes('physical') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('physical'); setAdminClassFilter('all'); setAdminPage(1); }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'physical' ? '1px solid #3b82f6' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                backgroundColor: adminProductTypeFilter === 'physical' ? '#3b82f6' : 'rgba(255,255,255,0.04)',
                                color: adminProductTypeFilter === 'physical' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              📦 Barang ({faunas.filter(f => (f.product_type || 'physical') === 'physical').length})
                            </button>
                          )}
                          {availableProductTypes.includes('food') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('food'); setAdminClassFilter('all'); setAdminPage(1); }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'food' ? '1px solid #ef4444' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                backgroundColor: adminProductTypeFilter === 'food' ? '#ef4444' : 'rgba(255,255,255,0.04)',
                                color: adminProductTypeFilter === 'food' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              🍔 Kuliner ({faunas.filter(f => f.product_type === 'food').length})
                            </button>
                          )}
                          {availableProductTypes.includes('service') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('service'); setAdminClassFilter('all'); setAdminPage(1); }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'service' ? '1px solid #f59e0b' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                backgroundColor: adminProductTypeFilter === 'service' ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                                color: adminProductTypeFilter === 'service' ? '#000000' : 'var(--text-secondary)'
                              }}
                            >
                              💼 Jasa ({faunas.filter(f => f.product_type === 'service').length})
                            </button>
                          )}
                          {availableProductTypes.includes('digital') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('digital'); setAdminClassFilter('all'); setAdminPage(1); }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'digital' ? '1px solid #8b5cf6' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                backgroundColor: adminProductTypeFilter === 'digital' ? '#8b5cf6' : 'rgba(255,255,255,0.04)',
                                color: adminProductTypeFilter === 'digital' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              💾 Digital ({faunas.filter(f => f.product_type === 'digital').length})
                            </button>
                          )}
                          {availableProductTypes.includes('fauna') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('fauna'); setAdminClassFilter('all'); setAdminPage(1); }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'fauna' ? '1px solid #10b981' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                backgroundColor: adminProductTypeFilter === 'fauna' ? '#10b981' : 'rgba(255,255,255,0.04)',
                                color: adminProductTypeFilter === 'fauna' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              🐾 Fauna ({faunas.filter(f => f.product_type === 'fauna').length})
                            </button>
                          )}
                        </div>

                        {/* Reset filter button */}
                        {(adminSearch || adminProductTypeFilter !== 'all' || adminClassFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminSearch('');
                              setAdminProductTypeFilter('all');
                              setAdminClassFilter('all');
                              setAdminSortBy('newest');
                              setAdminPage(1);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: '70px' }}>Foto</th>
                            <th>Nama Item &amp; Spesifikasi</th>
                            <th>Kategori &amp; Tipe</th>
                            <th>Harga</th>
                            <th>Pengiriman / Akses</th>
                            <th style={{ width: '170px' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {faunas.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                                Belum ada item katalog terdaftar. Klik "+ Tambah Item Baru" di atas untuk memulai.
                              </td>
                            </tr>
                          ) : filteredAdminItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                                Tidak ada item yang sesuai dengan filter atau pencarian Anda.
                              </td>
                            </tr>
                          ) : (
                            paginatedAdminItems.map((item) => {
                              const itemType = (item.product_type || 'physical') as ItemCategoryType;
                              const typeBadgeBg = itemType === 'food' ? '#ef4444' : itemType === 'service' ? '#f59e0b' : itemType === 'digital' ? '#8b5cf6' : itemType === 'fauna' ? '#10b981' : '#3b82f6';
                              const typeEmoji = itemType === 'food' ? '🍔' : itemType === 'service' ? '💼' : itemType === 'digital' ? '💾' : itemType === 'fauna' ? '🐾' : '📦';

                              return (
                                <tr key={item.id}>
                                  <td>
                                    <div style={{ position: 'relative', width: '54px', height: '42px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                                      <img 
                                        src={item.image_url} 
                                        alt={item.name} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        onError={(e) => {
                                          e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=150&q=80';
                                        }}
                                      />
                                      <span style={{ position: 'absolute', bottom: '1px', right: '1px', fontSize: '0.6rem', padding: '0 2px', background: 'rgba(0,0,0,0.7)', borderRadius: '2px' }}>
                                        {typeEmoji}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                      {itemType === 'food' && (
                                        <span>{item.attributes?.portion_size ? `Porsi: ${item.attributes.portion_size}` : 'Fresh Daily'}{item.attributes?.prep_time ? ` • PO: ${item.attributes.prep_time}` : ''}</span>
                                      )}
                                      {itemType === 'physical' && (
                                        <span>{item.attributes?.condition || 'Baru'}{item.attributes?.weight ? ` • ${item.attributes.weight}g` : ''}{item.attributes?.brand ? ` • ${item.attributes.brand}` : ''}</span>
                                      )}
                                      {itemType === 'service' && (
                                        <span>{item.attributes?.duration || '1 Sesi'}{item.attributes?.service_area ? ` • Area: ${item.attributes.service_area}` : ''}</span>
                                      )}
                                      {itemType === 'digital' && (
                                        <span>{item.attributes?.file_format || 'File'}{item.attributes?.file_size ? ` • ${item.attributes.file_size}` : ''}</span>
                                      )}
                                      {itemType === 'fauna' && (
                                        <span>{item.scientific_name ? <i>{item.scientific_name}</i> : (item.habitat || 'General')}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '4px',
                                        backgroundColor: `${typeBadgeBg}20`,
                                        color: typeBadgeBg === '#ef4444' ? '#f87171' : typeBadgeBg === '#f59e0b' ? '#fbbf24' : typeBadgeBg === '#8b5cf6' ? '#c084fc' : typeBadgeBg === '#10b981' ? '#34d399' : '#60a5fa',
                                        border: `1px solid ${typeBadgeBg}40`
                                      }}>
                                        {item.class}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.88rem' }}>
                                      {formatRupiah(item.price)}
                                    </div>
                                  </td>
                                  <td>
                                    {item.is_shipping_available ? (
                                      <span className="badge badge-least-concern" style={{ fontSize: '0.7rem' }}>Bisa Dikirim</span>
                                    ) : (
                                      <span className="badge badge-vulnerable" style={{ fontSize: '0.7rem' }}>Lokal / Pickup</span>
                                    )}
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      <button 
                                        className="btn-secondary btn-small"
                                        onClick={() => fetchDetails(item.id)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.65rem', fontSize: '0.74rem' }}
                                        title="Lihat Detail"
                                      >
                                        <Eye size={12} />
                                        Detail
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Desktop Pagination Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>
                        Menampilkan <strong style={{ color: '#fff' }}>{paginatedAdminItems.length}</strong> dari <strong style={{ color: '#fff' }}>{filteredAdminItems.length}</strong> total item
                      </div>

                      {totalAdminPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button 
                            type="button"
                            disabled={adminPage === 1}
                            onClick={() => setAdminPage(prev => Math.max(prev - 1, 1))}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid var(--border-light)',
                              color: adminPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                              borderRadius: '0.4rem',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: adminPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            &larr; Prev
                          </button>

                          {Array.from({ length: totalAdminPages }).map((_, idx) => {
                            const pageNum = idx + 1;
                            if (
                              totalAdminPages > 7 &&
                              pageNum !== 1 &&
                              pageNum !== totalAdminPages &&
                              Math.abs(pageNum - adminPage) > 2
                            ) {
                              if (pageNum === 2 && adminPage > 4) {
                                return <span key={pageNum} style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}>...</span>;
                              }
                              if (pageNum === totalAdminPages - 1 && adminPage < totalAdminPages - 3) {
                                return <span key={pageNum} style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}>...</span>;
                              }
                              return null;
                            }

                            return (
                              <button
                                type="button"
                                key={pageNum}
                                onClick={() => setAdminPage(pageNum)}
                                style={{
                                  border: pageNum === adminPage ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                  backgroundColor: pageNum === adminPage ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                                  color: pageNum === adminPage ? '#000000' : 'var(--text-primary)',
                                  borderRadius: '0.4rem',
                                  width: '34px',
                                  height: '34px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: pageNum === adminPage ? 800 : 600
                                }}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button 
                            type="button"
                            disabled={adminPage === totalAdminPages}
                            onClick={() => setAdminPage(prev => Math.min(prev + 1, totalAdminPages))}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid var(--border-light)',
                              color: adminPage === totalAdminPages ? 'var(--text-muted)' : 'var(--text-primary)',
                              borderRadius: '0.4rem',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: adminPage === totalAdminPages ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Next &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {adminTab === 'settings' && (
                <>
                  {/* Desktop Settings Sub-Tab Pills (5 Pillars Structure) */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn-secondary ${settingsSubTab === 'general' ? 'active' : ''}`}
                      onClick={() => setSettingsSubTab('general')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backgroundColor: settingsSubTab === 'general' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                        color: settingsSubTab === 'general' ? '#fff' : 'var(--text-secondary)',
                        border: settingsSubTab === 'general' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                      }}
                    >
                      <Store size={15} />
                      <span>Profil &amp; Identitas Utama</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary ${settingsSubTab === 'contact' ? 'active' : ''}`}
                      onClick={() => setSettingsSubTab('contact')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backgroundColor: settingsSubTab === 'contact' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                        color: settingsSubTab === 'contact' ? '#fff' : 'var(--text-secondary)',
                        border: settingsSubTab === 'contact' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                      }}
                    >
                      <MessageSquare size={15} />
                      <span>Kontak &amp; Saluran Resmi</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary ${settingsSubTab === 'about' ? 'active' : ''}`}
                      onClick={() => setSettingsSubTab('about')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backgroundColor: settingsSubTab === 'about' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                        color: settingsSubTab === 'about' ? '#fff' : 'var(--text-secondary)',
                        border: settingsSubTab === 'about' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                      }}
                    >
                      <Sparkles size={15} />
                      <span>Halaman Tentang Kami</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary ${settingsSubTab === 'theme' ? 'active' : ''}`}
                      onClick={() => setSettingsSubTab('theme')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backgroundColor: settingsSubTab === 'theme' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                        color: settingsSubTab === 'theme' ? '#fff' : 'var(--text-secondary)',
                        border: settingsSubTab === 'theme' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                      }}
                    >
                      <Palette size={15} />
                      <span>Tema &amp; Tampilan Visual</span>
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary ${settingsSubTab === 'master' ? 'active' : ''}`}
                      onClick={() => setSettingsSubTab('master')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backgroundColor: settingsSubTab === 'master' ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                        color: settingsSubTab === 'master' ? '#fff' : 'var(--text-secondary)',
                        border: settingsSubTab === 'master' ? '1px solid var(--primary)' : '1px solid var(--border-light)'
                      }}
                    >
                      <Database size={15} />
                      <span>Master Data Katalog</span>
                    </button>
                  </div>

                  {/* 1. TEMA & TAMPILAN SUB-TAB */}
                  {settingsSubTab === 'theme' && (
                    <div style={{ maxWidth: '650px', marginTop: '1rem' }} className="animate-fade-in">
                      <div style={{ paddingBottom: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>Pilih Preset Tema Estetik Katalog</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          Klik salah satu opsi tema di bawah ini. Tema akan langsung diterapkan dan disimpan secara permanen.
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {[
                          { id: 'emerald', name: 'Midnight Emerald', desc: 'Nuansa gelap modern dengan kaca transparan & aksen hijau emerald.', bg: '#080c14', primary: '#10b981', accent: '#f59e0b', cardBg: '#0f172a', IconComponent: Trees },
                          { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Gaya futuristik dengan warna ungu royal & efek neon cyan.', bg: '#0b0716', primary: '#a855f7', accent: '#06b6d4', cardBg: '#150d2a', IconComponent: Zap },
                          { id: 'sunset', name: 'Warm Sunset', desc: 'Tampilan mewah onyx gelap dengan aksen emas amber & coral.', bg: '#140d0b', primary: '#f59e0b', accent: '#f97316', cardBg: '#221411', IconComponent: Sunset },
                          { id: 'ocean', name: 'Oceanic Azure', desc: 'Desain profesional biru gelap korporat & cyan segar.', bg: '#081021', primary: '#3b82f6', accent: '#38bdf8', cardBg: '#0f1c38', IconComponent: Waves },
                          { id: 'pastel', name: 'Pastel Bloom', desc: 'Tema terang estetik yang lembut dengan sentuhan pink rose.', bg: '#f8fafc', primary: '#e11d48', accent: '#f59e0b', cardBg: '#ffffff', light: true, IconComponent: Flower2 }
                        ].map(t => {
                          const isActive = (settingsForm.store_theme || 'emerald') === t.id;
                          const IconComp = t.IconComponent;
                          return (
                            <div 
                              key={t.id}
                              onClick={() => handleThemeSelect(t.id, t.name)}
                              style={{
                                padding: '1rem 1.15rem',
                                borderRadius: '0.85rem',
                                border: isActive ? `2px solid ${t.primary}` : '1px solid var(--border-light)',
                                background: t.cardBg,
                                cursor: 'pointer',
                                boxShadow: isActive ? `0 0 20px ${t.primary}35` : '0 4px 12px rgba(0,0,0,0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                                  <div style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '9px',
                                    backgroundColor: `${t.primary}20`,
                                    border: `1px solid ${t.primary}40`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: t.primary,
                                    boxShadow: `0 4px 10px ${t.primary}25`,
                                    flexShrink: 0
                                  }}>
                                    <IconComp size={16} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', background: t.bg, padding: '5px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.primary, boxShadow: `0 0 5px ${t.primary}` }} />
                                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.accent }} />
                                  </div>
                                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: t.light ? '#0f172a' : '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {t.name}
                                  </h4>
                                </div>

                                {isActive && (
                                  <span style={{
                                    fontSize: '0.64rem',
                                    fontWeight: 800,
                                    color: t.primary,
                                    padding: '0.18rem 0.55rem',
                                    borderRadius: '20px',
                                    backgroundColor: `${t.primary}20`,
                                    border: `1px solid ${t.primary}50`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    boxShadow: `0 2px 6px ${t.primary}20`,
                                    flexShrink: 0
                                  }}>
                                    <CheckCircle2 size={11} /> Aktif
                                  </span>
                                )}
                              </div>

                              <p style={{
                                fontSize: '0.73rem',
                                color: t.light ? '#475569' : '#9ca3af',
                                margin: 0,
                                lineHeight: 1.45
                              }}>
                                {t.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* FORM SUB-TABS (General, Contact, About) */}
                  {settingsSubTab !== 'theme' && settingsSubTab !== 'master' && (
                    <form onSubmit={handleSettingsSave} style={{ maxWidth: '600px', marginTop: '1rem' }} className="animate-fade-in">
                      {settingsSuccess && (
                        <div className="alert-message alert-success">
                          {settingsSuccess}
                        </div>
                      )}

                      {/* SUB-TAB 1: PROFIL & IDENTITAS UTAMA */}
                      {settingsSubTab === 'general' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Nama / Judul Katalog *</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: Catavor Digital"
                              required
                              value={settingsForm.store_title || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, store_title: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Logo Resmi (Unggah Gambar atau Tempel URL)</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {/* Live Preview */}
                              {settingsForm.store_logo_url && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-light)', borderRadius: '6px' }}>
                                  <img 
                                    src={settingsForm.store_logo_url} 
                                    alt="Logo Preview" 
                                    style={{ height: '40px', width: 'auto', objectFit: 'contain' }} 
                                  />
                                  <button 
                                    type="button" 
                                    className="btn-danger btn-small"
                                    onClick={() => setSettingsForm({ ...settingsForm, store_logo_url: '' })}
                                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                                  >
                                    Hapus Logo
                                  </button>
                                </div>
                              )}
                              
                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleLogoUpload}
                                  disabled={logoUploading}
                                  style={{ display: 'none' }}
                                  id="store-logo-file-input-desktop"
                                />
                                <label 
                                  htmlFor="store-logo-file-input-desktop" 
                                  className="btn-secondary"
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                                >
                                  {logoUploading ? 'Mengunggah...' : 'Pilih File Logo dari Perangkat'}
                                </label>
                              </div>

                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Atau tempel URL gambar logo langsung..."
                                value={settingsForm.store_logo_url || ''}
                                onChange={(e) => setSettingsForm({ ...settingsForm, store_logo_url: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Slogan / Tagline Utama *</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Slogan atau tagline bisnis Anda..."
                              required
                              value={settingsForm.store_slogan}
                              onChange={(e) => setSettingsForm({ ...settingsForm, store_slogan: e.target.value })}
                            />
                          </div>

                        </div>
                      )}

                      {/* SUB-TAB 2: KONTAK & SALURAN RESMI */}
                      {settingsSubTab === 'contact' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div className="form-group">
                            <WhatsAppContactsManager 
                              value={settingsForm.whatsapp_number} 
                              onChange={(newVal) => setSettingsForm({ ...settingsForm, whatsapp_number: newVal })} 
                            />
                          </div>

                          <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                            <label className="form-label" style={{ fontWeight: 800 }}>
                              Website Resmi / Portal Official
                            </label>
                            <input 
                              type="url" 
                              className="form-input" 
                              placeholder="Contoh: https://website-resmi.com"
                              value={settingsForm.official_website || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, official_website: e.target.value })}
                            />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                              * Kosongkan jika tidak ada. Jika diisi, tombol Website Resmi akan otomatis tampil di bagian Hubungi Kami.
                            </span>
                          </div>

                          <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                            <label className="form-label">Lokasi / Alamat Resmi</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: Bandung, Jawa Barat, Indonesia"
                              value={settingsForm.about_location || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, about_location: e.target.value })}
                            />
                          </div>

                          <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                            <OperationalHoursBuilder 
                              value={settingsForm.about_hours || ''}
                              onChange={(val) => setSettingsForm({ ...settingsForm, about_hours: val })}
                              showHours={settingsForm.show_hours ?? false}
                              onToggleShowHours={(show) => setSettingsForm({ ...settingsForm, show_hours: show })}
                            />
                          </div>

                          {/* Dynamic Social Links Builder */}
                          <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                            {(() => {
                              const currentLinks = (() => {
                                try {
                                  return settingsForm.social_links ? JSON.parse(settingsForm.social_links) : [];
                                } catch (e) {
                                  return [];
                                }
                              })();

                              return (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div>
                                      <label className="form-label" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Tautan Media Sosial Resmi</label>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                                        Hubungkan akun Instagram, TikTok, Facebook, YouTube, atau saluran resmi lainnya
                                      </span>
                                    </div>
                                    {currentLinks.length > 0 && (
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => {
                                          const newLinks = [...currentLinks, { platform: 'Instagram', url: '' }];
                                          setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          padding: '0.45rem 0.9rem',
                                          fontSize: '0.78rem',
                                          fontWeight: 800,
                                          borderRadius: '0.4rem',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                                        }}
                                      >
                                        <Plus size={14} /> Tambah Sosmed
                                      </button>
                                    )}
                                  </div>

                                  {currentLinks.length === 0 ? (
                                    <div style={{
                                      padding: '1.25rem 1.5rem',
                                      borderRadius: '0.75rem',
                                      backgroundColor: 'var(--primary-glow)',
                                      border: '2px dashed var(--primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '1.25rem',
                                      marginBottom: '1.25rem',
                                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                                          <Share2 size={22} />
                                        </div>
                                        <div>
                                          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-primary)' }}>
                                            Belum Ada Tautan Media Sosial Resmi
                                          </h4>
                                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                            Klik tombol di samping untuk menambah akun Instagram, TikTok, Facebook, YouTube, atau saluran resmi toko Anda.
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => {
                                          const newLinks = [...currentLinks, { platform: 'Instagram', url: '' }];
                                          setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.4rem',
                                          padding: '0.6rem 1.1rem',
                                          fontSize: '0.82rem',
                                          fontWeight: 800,
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                        }}
                                      >
                                        <Plus size={16} /> Tambah Sosmed Sekarang
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                      {currentLinks.map((link: any, index: number) => (
                                        <div key={index} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem', position: 'relative', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newLinks = currentLinks.filter((_: any, idx: number) => idx !== index);
                                              setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '0.75rem',
                                              right: '0.75rem',
                                              background: 'none',
                                              border: 'none',
                                              color: '#ef4444',
                                              cursor: 'pointer'
                                            }}
                                            title="Hapus Tautan"
                                          >
                                            <Trash2 size={14} />
                                          </button>

                                          <div className="form-group" style={{ marginBottom: '0.75rem', width: '85%' }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Platform *</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                                {renderSocialIcon(link.platform || 'Instagram', 18)}
                                              </div>
                                              <select
                                                className="form-input"
                                                value={link.platform || 'Instagram'}
                                                onChange={(e) => {
                                                  const newLinks = [...currentLinks];
                                                  newLinks[index].platform = e.target.value;
                                                  setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                                }}
                                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', height: 'auto', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', flex: 1 }}
                                              >
                                                {SOCIAL_MEDIA_OPTIONS.map((opt) => (
                                                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>

                                          <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>URL / Tautan Profil *</label>
                                            <input
                                              type="url"
                                              className="form-input"
                                              placeholder="Contoh: https://instagram.com/akun"
                                              required
                                              value={link.url}
                                              onChange={(e) => {
                                                const newLinks = [...currentLinks];
                                                newLinks[index].url = e.target.value;
                                                setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                              }}
                                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* SUB-TAB 3: HALAMAN TENTANG KAMI */}
                      {settingsSubTab === 'about' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Judul Halaman Tentang Kami</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: Tentang Catavor"
                              value={settingsForm.about_title || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Slogan Halaman Tentang Kami</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: Platform Katalog Digital & Biolink Bisnis Modern"
                              value={settingsForm.about_slogan || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, about_slogan: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Deskripsi Profil Lengkap</label>
                            <textarea 
                              rows={4}
                              className="form-input" 
                              placeholder="Detail profil usaha, visi misi, atau informasi penting..."
                              value={settingsForm.about_description || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, about_description: e.target.value })}
                            />
                          </div>



                          {/* Dynamic About Cards Builder */}
                          <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                              <label className="form-label" style={{ margin: 0, fontSize: '0.9rem' }}>Kartu Komitmen / Nilai Unggulan</label>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentCards = (() => {
                                    try {
                                      return settingsForm.about_cards ? JSON.parse(settingsForm.about_cards) : [];
                                    } catch (e) {
                                      return [];
                                    }
                                  })();
                                  const newCards = [...currentCards, { title: '', content: '', icon: 'shield' }];
                                  setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: 'var(--primary-glow)',
                                  color: 'var(--primary)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <Plus size={12} /> Tambah Kartu
                              </button>
                            </div>

                            {(() => {
                              const currentCards = (() => {
                                try {
                                  return settingsForm.about_cards ? JSON.parse(settingsForm.about_cards) : [];
                                } catch (e) {
                                  return [];
                                }
                              })();

                              if (currentCards.length === 0) {
                                return (
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0', fontStyle: 'italic' }}>
                                    Belum ada kartu nilai/komitmen. Klik Tambah Kartu.
                                  </p>
                                );
                              }

                              return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                  {currentCards.map((card: any, index: number) => (
                                    <div key={index} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem', position: 'relative', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newCards = currentCards.filter((_: any, idx: number) => idx !== index);
                                          setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: '0.75rem',
                                          right: '0.75rem',
                                          background: 'none',
                                          border: 'none',
                                          color: '#ef4444',
                                          cursor: 'pointer'
                                        }}
                                        title="Hapus Kartu"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                      
                                      <div className="form-group" style={{ marginBottom: '0.75rem', width: '90%' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Pilih Ikon Kartu *</label>
                                        <select
                                          className="form-input"
                                          value={card.icon || 'shield'}
                                          onChange={(e) => {
                                            const newCards = [...currentCards];
                                            newCards[index].icon = e.target.value;
                                            setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                          }}
                                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', height: 'auto', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                                        >
                                          {ABOUT_ICONS_OPTIONS.map((opt) => (
                                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Judul Komitmen *</label>
                                        <input
                                          type="text"
                                          className="form-input"
                                          placeholder="Contoh: Garansi Keamanan"
                                          required
                                          value={card.title}
                                          onChange={(e) => {
                                            const newCards = [...currentCards];
                                            newCards[index].title = e.target.value;
                                            setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                          }}
                                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                        />
                                      </div>

                                      <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Deskripsi Kartu *</label>
                                        <textarea
                                          rows={4}
                                          className="form-input"
                                          placeholder="Penjelasan singkat komitmen..."
                                          required
                                          value={card.content}
                                          onChange={(e) => {
                                            const newCards = [...currentCards];
                                            newCards[index].content = e.target.value;
                                            setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                          }}
                                          style={{ fontSize: '0.8rem', padding: '0.5rem 0.65rem', minHeight: '90px', resize: 'vertical' }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                        <button 
                          type="submit" 
                          className="btn-primary" 
                          disabled={settingsLoading}
                          style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}
                        >
                          {settingsLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Master Data Management Section */}
                  {settingsSubTab === 'master' && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.5rem' }} className="animate-fade-in">
                      {/* Top Header Banner with 1-Click Industry Presets */}
                      <div style={{
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                        border: '1px solid var(--border-light)',
                        marginBottom: '1.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ padding: '0.35rem 0.65rem', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem' }}>
                                TWO-TIER MASTER DATA
                              </span>
                              <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
                                Kelola Master Data &amp; Kategori Toko
                              </h3>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.35rem 0 0 0' }}>
                              Atur daftar kategori, sub-klasifikasi, status ketersediaan, dan jangkauan layanan secara terisolasi untuk toko Anda.
                            </p>
                          </div>
                        </div>

                        {/* Industry Presets Quick Selector */}
                        <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              Template Starter Industri (1-Click Apply):
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Terapkan susunan master data instan sesuai model bisnis Anda:
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                            {[
                              { key: 'physical', label: 'Retail & Barang Fisik', icon: Package, color: '#3b82f6', desc: 'Pakaian, Aksesoris, Elektronik, dll.' },
                              { key: 'digital', label: 'File & Item Digital', icon: FileCode, color: '#8b5cf6', desc: 'E-Book, Script, Desain, Video, dll.' },
                              { key: 'fauna', label: 'Petshop & Satwa Hias', icon: Compass, color: '#10b981', desc: 'Reptil, Ikan, Burung, Pakan, dll.' },
                              { key: 'service', label: 'Jasa & Layanan', icon: Wrench, color: '#f59e0b', desc: 'Konsultasi, Servis, Desain, Kursus, dll.' },
                              { key: 'food', label: 'Kuliner & F&B', icon: Utensils, color: '#ef4444', desc: 'Makanan, Minuman, Snack, Frozen, dll.' },
                              { key: 'general', label: 'Universal / Umum', icon: Layers, color: '#06b6d4', desc: 'Template netral untuk semua bisnis' },
                            ].map((preset) => {
                              const IconComponent = preset.icon;
                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => {
                                    setPresetModalData({
                                      key: preset.key as any,
                                      title: preset.label,
                                      desc: preset.desc,
                                      sampleCategories: preset.key === 'physical'
                                        ? ['Pakaian & Busana', 'Aksesoris & Fashion', 'Gadget & Elektronik', 'Kebutuhan Rumah Tangga', 'Kerajinan Tangan']
                                        : preset.key === 'digital'
                                        ? ['E-Book & Panduan', 'Source Code & Script', 'Template Desain', 'Video & Audio Materi', 'Tools & Aset Digital']
                                        : preset.key === 'fauna'
                                        ? ['Reptil & Amfibi', 'Ikan Hias & Aquascape', 'Burung Kicau & Unggas', 'Mamalia Hias', 'Pakan & Perlengkapan']
                                        : preset.key === 'service'
                                        ? ['Konsultasi & Advice', 'Desain & Kreatif', 'Perbaikan & Servis', 'Kursus & Pelatihan', 'Pembuatan Web & Aplikasi']
                                        : preset.key === 'food'
                                        ? ['Makanan Utama / Berat', 'Camilan & Snack', 'Minuman Segar & Kopi', 'Frozen Food Siap Masak', 'Paket Katering']
                                        : ['Kategori Utama', 'Koleksi Populer', 'Item Unggulan', 'Varian Baru', 'Promo Spesial']
                                    });
                                  }}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '0.65rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid var(--border-light)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    gap: '0.35rem'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = preset.color;
                                    e.currentTarget.style.backgroundColor = `${preset.color}15`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-light)';
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${preset.color}25`, color: preset.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <IconComponent size={14} />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {preset.label}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                    {preset.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 4 Cards Grid for Master Data */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* 1. Kategori Item (master_classes) */}
                        <div className="glass-panel" style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Package size={16} style={{ color: 'var(--primary)' }} /> Master Kategori Item
                              </h4>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                                Pengelompokan kategori etalase per konteks produk toko Anda.
                              </p>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                              {getCategoryOptionsForType(masterCategoryContextTab).length} Kategori
                            </span>
                          </div>

                          {/* Context Switcher Pills */}
                          <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {[
                              { id: 'physical', label: '📦 Barang Fisik' },
                              { id: 'food', label: '🍔 Kuliner' },
                              { id: 'service', label: '💼 Jasa' },
                              { id: 'digital', label: '💾 Digital' },
                              { id: 'fauna', label: '🐾 Fauna' }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setMasterCategoryContextTab(tab.id as ItemCategoryType)}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  border: masterCategoryContextTab === tab.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                  backgroundColor: masterCategoryContextTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                                  color: masterCategoryContextTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', minHeight: '60px' }}>
                            {getCategoryOptionsForType(masterCategoryContextTab).map((c) => {
                              const count = faunas.filter(f => (f.product_type || 'physical') === masterCategoryContextTab && f.class === c).length;
                              return (
                                <span 
                                  key={c} 
                                  className="badge" 
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.45rem', 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)', 
                                    padding: '0.4rem 0.65rem', 
                                    borderRadius: '0.55rem', 
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                  }}
                                >
                                  <span>{c}</span>
                                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                    {count} item
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRenameMasterModalData({
                                        field: 'class',
                                        fieldLabel: `Kategori (${masterCategoryContextTab})`,
                                        oldValue: c,
                                        newValue: c
                                      });
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Ubah nama kategori "${c}"`}
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteMasterOption('class', c);
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Hapus kategori "${c}"`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <input 
                              type="text" 
                              placeholder={`Ketik kategori ${masterCategoryContextTab} baru...`} 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', height: '36px' }}
                              value={newClassInput}
                              onChange={(e) => setNewClassInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMasterOption('class', newClassInput, setNewClassInput);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              className="btn-primary" 
                              style={{ padding: '0 0.9rem', fontSize: '0.8rem', height: '36px', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleAddMasterOption('class', newClassInput, setNewClassInput)}
                            >
                              <Plus size={14} /> Tambah
                            </button>
                          </div>
                        </div>

                        {/* 2. Sub-Klasifikasi / Karakteristik Item (master_habitats) */}
                        <div className="glass-panel" style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Layers size={16} style={{ color: '#8b5cf6' }} /> Sub-Klasifikasi / Karakter
                              </h4>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                                Varian, kondisi, lisensi, atau tipe penyajian item.
                              </p>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
                              {getUniqueHabitats().length} Opsi
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', minHeight: '60px' }}>
                            {getUniqueHabitats().map((h) => {
                              const count = faunas.filter(f => f.habitat === h).length;
                              return (
                                <span 
                                  key={h} 
                                  className="badge" 
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.45rem', 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)', 
                                    padding: '0.4rem 0.65rem', 
                                    borderRadius: '0.55rem', 
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                  }}
                                >
                                  <span>{h}</span>
                                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                    {count} item
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRenameMasterModalData({
                                        field: 'habitat',
                                        fieldLabel: 'Sub-Klasifikasi / Karakter Item',
                                        oldValue: h,
                                        newValue: h
                                      });
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Ubah nama "${h}"`}
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteMasterOption('habitat', h);
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Hapus "${h}"`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <input 
                              type="text" 
                              placeholder="Ketik sub-klasifikasi baru..." 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', height: '36px' }}
                              value={newHabitatInput}
                              onChange={(e) => setNewHabitatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMasterOption('habitat', newHabitatInput, setNewHabitatInput);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              className="btn-primary" 
                              style={{ padding: '0 0.9rem', fontSize: '0.8rem', height: '36px', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleAddMasterOption('habitat', newHabitatInput, setNewHabitatInput)}
                            >
                              <Plus size={14} /> Tambah
                            </button>
                          </div>
                        </div>

                        {/* 3. Status Ketersediaan Item (master_statuses) */}
                        <div className="glass-panel" style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ShieldCheck size={16} style={{ color: '#10b981' }} /> Status Ketersediaan
                              </h4>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                                Status stok, pemesanan, atau ketersediaan listing.
                              </p>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                              {getUniqueConservationStatuses().length} Status
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', minHeight: '60px' }}>
                            {getUniqueConservationStatuses().map((s) => {
                              const count = faunas.filter(f => f.conservation_status === s).length;
                              return (
                                <span 
                                  key={s} 
                                  className="badge" 
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.45rem', 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)', 
                                    padding: '0.4rem 0.65rem', 
                                    borderRadius: '0.55rem', 
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                  }}
                                >
                                  <span>{s}</span>
                                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                    {count} item
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRenameMasterModalData({
                                        field: 'conservation_status',
                                        fieldLabel: 'Status Ketersediaan',
                                        oldValue: s,
                                        newValue: s
                                      });
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Ubah nama "${s}"`}
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteMasterOption('conservation_status', s);
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Hapus "${s}"`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <input 
                              type="text" 
                              placeholder="Ketik status ketersediaan baru..." 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', height: '36px' }}
                              value={newStatusInput}
                              onChange={(e) => setNewStatusInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMasterOption('conservation_status', newStatusInput, setNewStatusInput);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              className="btn-primary" 
                              style={{ padding: '0 0.9rem', fontSize: '0.8rem', height: '36px', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleAddMasterOption('conservation_status', newStatusInput, setNewStatusInput)}
                            >
                              <Plus size={14} /> Tambah
                            </button>
                          </div>
                        </div>

                        {/* 4. Jangkauan Pengiriman / Wilayah Layanan (master_shipping_coverages) */}
                        <div className="glass-panel" style={{ padding: '1.35rem', borderRadius: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Truck size={16} style={{ color: '#3b82f6' }} /> Jangkauan Pengiriman &amp; Layanan
                              </h4>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                                Opsi cakupan kurir, on-site, atau delivery toko.
                              </p>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                              {getUniqueShippingCoverages().length} Jangkauan
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', minHeight: '60px' }}>
                            {getUniqueShippingCoverages().map((sc) => {
                              const count = faunas.filter(f => f.detailed_info?.shipping_coverage === sc).length;
                              return (
                                <span 
                                  key={sc} 
                                  className="badge" 
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.45rem', 
                                    backgroundColor: 'var(--bg-card)', 
                                    border: '1px solid var(--border-light)', 
                                    padding: '0.4rem 0.65rem', 
                                    borderRadius: '0.55rem', 
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                  }}
                                >
                                  <span>{sc}</span>
                                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                    {count} item
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRenameMasterModalData({
                                        field: 'shipping_coverage',
                                        fieldLabel: 'Jangkauan Pengiriman & Layanan',
                                        oldValue: sc,
                                        newValue: sc
                                      });
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Ubah nama "${sc}"`}
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteMasterOption('shipping_coverage', sc);
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                    title={`Hapus "${sc}"`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <input 
                              type="text" 
                              placeholder="Ketik jangkauan baru..." 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', height: '36px' }}
                              value={newShippingInput}
                              onChange={(e) => setNewShippingInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMasterOption('shipping_coverage', newShippingInput, setNewShippingInput);
                                }
                              }}
                            />
                            <button 
                              type="button" 
                              className="btn-primary" 
                              style={{ padding: '0 0.9rem', fontSize: '0.8rem', height: '36px', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleAddMasterOption('shipping_coverage', newShippingInput, setNewShippingInput)}
                            >
                              <Plus size={14} /> Tambah
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {adminTab === 'profile' && (
                /* TAB 3: ADMIN PROFILE & PASSWORD SETTINGS */
                <form onSubmit={handleProfileUpdate} style={{ maxWidth: '600px', marginTop: '1rem' }}>
                  {profileSuccess && (
                    <div className="alert-message alert-success">
                      {profileSuccess}
                    </div>
                  )}
                  {profileError && (
                    <div className="alert-message alert-error">
                      {profileError}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Nama Lengkap Admin *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alamat Email Login *</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      required
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kata Sandi Baru (Kosongkan jika tidak ingin diubah)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="Minimal 6 karakter..."
                      value={profileForm.password}
                      onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={profileLoading}
                  >
                    {profileLoading ? 'Memproses...' : 'Perbarui Profil Admin'}
                  </button>
                </form>
              )}

              {adminTab === 'policies' && (
                <div className="glass-panel animate-fade-in" style={{ padding: '2rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                        Manajemen Kebijakan, Privasi & Audit Trail Pengguna
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                        Kelola isi kebijakan platform, terbitkan versi baru (immutable versioning), dan pantau log bukti persetujuan pengguna.
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(16,185,129,0.12)', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid rgba(16,185,129,0.25)' }}>
                        UU PDP & Consumer Protection Compliant
                      </span>
                    </div>
                  </div>

                  {/* Policy Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                    {[
                      { key: 'terms', name: 'Syarat & Ketentuan', icon: FileText },
                      { key: 'privacy', name: 'Kebijakan Privasi', icon: Shield },
                      { key: 'acceptable_use', name: 'Ketentuan Penggunaan', icon: Lock }
                    ].map(item => {
                      const pol = policies[item.key] || { version: 'v1.0.0', title: item.name, content: '' };
                      const IconComp = item.icon;
                      return (
                        <div key={item.key} style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '0.85rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconComp size={18} color="var(--primary)" />
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399', backgroundColor: 'rgba(16,185,129,0.12)', padding: '0.15rem 0.55rem', borderRadius: '999px' }}>
                                Versi {pol.version}
                              </span>
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#ffffff' }}>
                              {pol.title}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0, lineHeight: 1.4 }}>
                              {pol.content}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setEditingPolicy({
                                type: item.key,
                                version: pol.version,
                                title: pol.title,
                                content: pol.content
                              });
                            }}
                            style={{ marginTop: '1.25rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem', width: '100%', justifyContent: 'center' }}
                          >
                            <Edit size={14} />
                            <span>Edit & Terbitkan Versi Baru</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Policy Edit Form */}
                  {editingPolicy && (
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--primary)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                          Edit & Terbitkan Versi Baru: {editingPolicy.title}
                        </h3>
                        <button type="button" onClick={() => setEditingPolicy(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                          <X size={18} />
                        </button>
                      </div>

                      {policySaveMsg && (
                        <div style={{ padding: '0.65rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.82rem', backgroundColor: policySaveMsg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: policySaveMsg.type === 'success' ? '#34d399' : '#f87171', border: '1px solid currentColor' }}>
                          {policySaveMsg.text}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', display: 'block', marginBottom: '0.35rem' }}>Judul Dokumen</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editingPolicy.title}
                            onChange={(e) => setEditingPolicy({ ...editingPolicy, title: e.target.value })}
                            style={{ borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', display: 'block', marginBottom: '0.35rem' }}>Nomor Versi Baru (Misal v1.1.0)</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editingPolicy.version}
                            onChange={(e) => setEditingPolicy({ ...editingPolicy, version: e.target.value })}
                            placeholder="v1.1.0"
                            style={{ borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', display: 'block', marginBottom: '0.35rem' }}>Isi Dokumen Kebijakan</label>
                        <textarea
                          className="form-input"
                          rows={8}
                          value={editingPolicy.content}
                          onChange={(e) => setEditingPolicy({ ...editingPolicy, content: e.target.value })}
                          style={{ borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.85rem', lineHeight: '1.6', width: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button type="button" className="btn-secondary" onClick={() => setEditingPolicy(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
                          Batal
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={policySaveLoading}
                          onClick={async () => {
                            setPolicySaveLoading(true);
                            setPolicySaveMsg(null);
                            try {
                              const res = await fetch(`${API_BASE}/settings/policies`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  policy_type: editingPolicy.type,
                                  version: editingPolicy.version,
                                  title: editingPolicy.title,
                                  content: editingPolicy.content
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                setPolicySaveMsg({ type: 'success', text: data.message });
                                fetchPolicies();
                                setTimeout(() => setEditingPolicy(null), 1200);
                              } else {
                                setPolicySaveMsg({ type: 'error', text: 'Gagal memperbarui kebijakan.' });
                              }
                            } catch (err) {
                              setPolicySaveMsg({ type: 'error', text: 'Koneksi gagal. Coba lagi.' });
                            } finally {
                              setPolicySaveLoading(false);
                            }
                          }}
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}
                        >
                          {policySaveLoading ? 'Mempublikasikan...' : 'Publikasikan Versi Baru'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audit Trail Log Section */}
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                          Log Audit Persetujuan Pengguna (Immutable Audit Trail)
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                          Catatan permanen persetujuan pengguna saat registrasi. Teks versi lama tersimpan tak terubah walau ada kebijakan baru.
                        </p>
                      </div>
                      <button type="button" className="btn-secondary" onClick={fetchPolicyAuditLogs} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                        Muat Ulang Log
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', borderBottom: '1px solid var(--border-light)' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>ID / Waktu</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Pengguna / Toko</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Jenis Kebijakan</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Versi Disetujui</th>
                            <th style={{ padding: '0.75rem 1rem' }}>IP Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {policyAuditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                Belum ada log pendaftaran persetujuan pengguna.
                              </td>
                            </tr>
                          ) : (
                            policyAuditLogs.map((log: any) => (
                              <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                                  #{log.id} • {new Date(log.agreed_at || log.created_at).toLocaleString('id-ID')}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                                  {log.store_slug || `User #${log.user_id}`}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize' }}>
                                  {log.policy_type === 'terms' ? 'Syarat & Ketentuan' : log.policy_type === 'privacy' ? 'Kebijakan Privasi' : 'Ketentuan Penggunaan'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{ fontWeight: 800, color: '#34d399', backgroundColor: 'rgba(16,185,129,0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                    {log.version}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                  {log.ip_address || '127.0.0.1'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'notifications' && (
                <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem', borderRadius: '1.1rem', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Notifikasi &amp; Aktivitas Toko</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Informasi sistem, transaksi, dan aktivitas penting untuk akun toko Anda.</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setNotifFilter('all')}
                        className={`btn-secondary ${notifFilter === 'all' ? 'active' : ''}`}
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: '999px', fontWeight: notifFilter === 'all' ? 800 : 600 }}
                      >
                        Semua ({notifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifFilter('unread')}
                        className={`btn-secondary ${notifFilter === 'unread' ? 'active' : ''}`}
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: '999px', fontWeight: notifFilter === 'unread' ? 800 : 600 }}
                      >
                        Belum Dibaca ({unreadCount})
                      </button>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            showToast('Semua notifikasi telah ditandai dibaca!');
                          }}
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: '999px' }}
                        >
                          Tandai Semua Dibaca
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredNotifications.length === 0 ? (
                    <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Bell size={42} style={{ marginBottom: '0.85rem', opacity: 0.5 }} />
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>Tidak Ada Notifikasi</h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Semua pembaruan aktivitas akan ditampilkan di sini.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {filteredNotifications.map((item) => (
                        <div
                          key={item.id}
                          className="glass-panel glass-panel-hover"
                          onClick={() => {
                            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
                            if (item.linkSubTab) {
                              setAdminTab(item.linkSubTab);
                              if (item.linkSettingsSubTab) {
                                setSettingsSubTab(item.linkSettingsSubTab);
                              }
                              const slug = getStoreSlug();
                              if (slug) window.history.pushState({}, '', `/${slug}/admin/${item.linkSubTab}`);
                            }
                          }}
                          style={{
                            padding: '1.15rem 1.35rem',
                            borderRadius: '0.9rem',
                            border: item.read ? '1px solid var(--border-light)' : '1px solid var(--primary)',
                            background: 'var(--card-bg-gradient)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                              <Bell size={20} />
                            </div>
                            <div>
                              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{item.title}</h4>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>{item.message}</p>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.timestamp || item.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminTab === 'help' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.25rem' }}>
                  
                  {/* Top Stats Banner Bar */}
                  <div className="glass-panel" style={{ 
                    padding: '1.5rem 2rem', 
                    borderRadius: '1.25rem', 
                    border: '1px solid var(--primary-glow)', 
                    background: 'var(--card-bg-gradient)', 
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ 
                        width: '52px', 
                        height: '52px', 
                        borderRadius: '1rem', 
                        backgroundColor: 'var(--primary-glow)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)', 
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 4px 15px var(--primary-glow)'
                      }}>
                        <HelpCircle size={28} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pusat Tiket Support Catavor</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Interaksi Langsung & Monitoring Kendala Toko Online Anda</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.75rem', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Total Tiket</span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{tickets.length}</strong>
                        </div>
                        <div style={{ width: '1px', backgroundColor: 'var(--border-light)' }} />
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Aktif Diproses</span>
                          <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>{tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setShowCreateTicketModal(true)}
                        style={{
                          padding: '0.65rem 1.25rem',
                          borderRadius: '0.75rem',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          boxShadow: '0 4px 16px var(--primary-glow)'
                        }}
                      >
                        <Plus size={18} /> Buat Tiket Support Baru
                      </button>
                    </div>
                  </div>

                  {/* MASTER-DETAIL TICKET LAYOUT */}
                  <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.25rem', minHeight: '560px' }}>
                    
                    {/* LEFT PANEL: TICKET LIST & FILTERS */}
                    <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '1.1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      
                      {/* Search & Filter Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Cari ID atau judul tiket..."
                            value={ticketSearch}
                            onChange={(e) => setTicketSearch(e.target.value)}
                            style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.8rem', borderRadius: '0.6rem' }}
                          />
                          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '0.6rem', border: '1px solid var(--border-light)' }}>
                          <button
                            type="button"
                            onClick={() => setTicketFilter('all')}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '0.45rem',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: ticketFilter === 'all' ? 'var(--primary)' : 'transparent',
                              color: ticketFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                          >
                            Semua ({tickets.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketFilter('active')}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '0.45rem',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: ticketFilter === 'active' ? 'var(--primary)' : 'transparent',
                              color: ticketFilter === 'active' ? '#ffffff' : 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                          >
                            Aktif
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketFilter('resolved')}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '0.45rem',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: ticketFilter === 'resolved' ? 'var(--primary)' : 'transparent',
                              color: ticketFilter === 'resolved' ? '#ffffff' : 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                          >
                            Selesai
                          </button>
                        </div>
                      </div>

                      {/* Tickets List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', maxHeight: '460px', paddingRight: '0.2rem' }}>
                        {filteredTickets.length === 0 ? (
                          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <MessageSquare size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Tidak ada tiket yang ditemukan.</p>
                          </div>
                        ) : (
                          filteredTickets.map((ticket) => {
                            const isSelected = selectedTicket?.id === ticket.id;
                            const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                            const isInProgress = ticket.status === 'in_progress';
                            const lastMsg = ticket.messages[ticket.messages.length - 1];

                            return (
                              <div
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                style={{
                                  padding: '0.95rem 1rem',
                                  borderRadius: '0.75rem',
                                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                                  backgroundColor: isSelected ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.45rem',
                                  transition: 'all 0.2s ease',
                                  boxShadow: isSelected ? '0 4px 15px rgba(0,0,0,0.3)' : 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{ticket.id}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '999px',
                                    backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.15)' : isInProgress ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    color: isResolved ? '#10b981' : isInProgress ? '#f59e0b' : '#3b82f6'
                                  }}>
                                    {isResolved ? 'Selesai' : isInProgress ? 'Proses' : 'Open'}
                                  </span>
                                </div>

                                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                                  {ticket.subject}
                                </h4>

                                {lastMsg && (
                                  <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <strong style={{ color: lastMsg.sender === 'user' ? 'var(--primary)' : '#10b981' }}>{lastMsg.sender_name}:</strong> {lastMsg.message}
                                  </p>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-light)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  <span>{ticket.messages.length} Pesan</span>
                                  <span>{ticket.updated_at}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>

                    {/* RIGHT PANEL: TICKET DETAIL & THREAD */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.1rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      {selectedTicket ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '1.25rem' }}>
                          
                          {/* Ticket Details Header */}
                          <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--border-light)' }}>
                                  {selectedTicket.id}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dibuat: {selectedTicket.created_at}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '999px',
                                  backgroundColor: selectedTicket.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : selectedTicket.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: selectedTicket.status === 'resolved' ? '#10b981' : selectedTicket.status === 'in_progress' ? '#f59e0b' : '#3b82f6',
                                  border: `1px solid ${selectedTicket.status === 'resolved' ? 'rgba(16, 185, 129, 0.3)' : selectedTicket.status === 'in_progress' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                                }}>
                                  {selectedTicket.status === 'resolved' ? '✓ Tiket Selesai' : selectedTicket.status === 'in_progress' ? '● Dalam Proses' : '● Tiket Open'}
                                </span>

                                {selectedTicket.status !== 'resolved' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'resolved', updated_at: 'Baru saja' } : t));
                                      setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
                                      showToast('Tiket berhasil ditandai Selesai.');
                                    }}
                                    style={{
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '0.5rem',
                                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      color: '#10b981',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✓ Tandai Selesai
                                  </button>
                                )}
                              </div>
                            </div>

                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                              {selectedTicket.subject}
                            </h3>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                Kategori: {selectedTicket.category === 'payment' ? 'Pembayaran & Paket Pro' : selectedTicket.category === 'technical' ? 'Pengaturan Toko & Domain' : selectedTicket.category === 'account' ? 'Kendala Akun' : 'Lainnya'}
                              </span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: selectedTicket.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)', color: selectedTicket.priority === 'urgent' ? '#ef4444' : 'var(--text-secondary)' }}>
                                Urgensi: {selectedTicket.priority.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Discussion Thread Messages */}
                          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem', maxHeight: '350px' }}>
                            {selectedTicket.messages.map((msg) => {
                              const isUser = msg.sender === 'user';
                              return (
                                <div
                                  key={msg.id}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isUser ? 'flex-end' : 'flex-start'
                                  }}
                                >
                                  <div style={{
                                    maxWidth: '82%',
                                    padding: '1rem 1.15rem',
                                    borderRadius: isUser ? '1.1rem 1.1rem 0.2rem 1.1rem' : '1.1rem 1.1rem 1.1rem 0.2rem',
                                    backgroundColor: isUser ? 'var(--primary-glow)' : 'rgba(15, 23, 42, 0.9)',
                                    border: isUser ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '0.45rem' }}>
                                      <strong style={{ fontSize: '0.82rem', color: isUser ? 'var(--primary)' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        {!isUser && <ShieldCheck size={16} color="#10b981" />}
                                        {msg.sender_name}
                                      </strong>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                                    </div>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                      {msg.message}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Reply Input Form */}
                          {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' ? (
                            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '0.9rem', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.3)' }}>
                              <textarea
                                rows={3}
                                className="form-input"
                                placeholder="Ketik balasan pesan untuk Tim Support Catavor..."
                                value={ticketReplyText}
                                onChange={(e) => setTicketReplyText(e.target.value)}
                                style={{ resize: 'none', marginBottom: '0.75rem', fontSize: '0.85rem' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={!ticketReplyText.trim()}
                                  onClick={() => {
                                    if (!ticketReplyText.trim()) return;
                                    const userMsg: TicketMessage = {
                                      id: `msg-${Date.now()}`,
                                      sender: 'user',
                                      sender_name: 'Admin Toko',
                                      message: ticketReplyText.trim(),
                                      timestamp: 'Baru saja'
                                    };

                                    const updatedMessages = [...selectedTicket.messages, userMsg];
                                    const updatedTicket = {
                                      ...selectedTicket,
                                      messages: updatedMessages,
                                      updated_at: 'Baru saja',
                                      status: 'in_progress' as const
                                    };

                                    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
                                    setSelectedTicket(updatedTicket);
                                    setTicketReplyText('');
                                    showToast('Balasan Anda telah terkirim!');

                                    // Auto CS response simulation
                                    setTimeout(() => {
                                      const csReply: TicketMessage = {
                                        id: `msg-${Date.now() + 1}`,
                                        sender: 'support',
                                        sender_name: 'Catavor Official Support',
                                        message: 'Pesan Anda telah diterima oleh Tim Support. Kami sedang mengecek detail permintaan ini.',
                                        timestamp: 'Baru saja'
                                      };
                                      setTickets(prev => prev.map(t => {
                                        if (t.id === selectedTicket.id) {
                                          return { ...t, messages: [...t.messages, csReply] };
                                        }
                                        return t;
                                      }));
                                      setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, csReply] } : null);
                                    }, 1500);
                                  }}
                                  style={{
                                    padding: '0.55rem 1.25rem',
                                    borderRadius: '0.6rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem'
                                  }}
                                >
                                  <Send size={15} /> Kirim Balasan
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="glass-panel" style={{ padding: '1rem', borderRadius: '0.85rem', textAlign: 'center', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
                              <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>
                                ✓ Tiket ini telah ditandai Selesai. Anda dapat membuat tiket baru jika memiliki pertanyaan lain.
                              </span>
                            </div>
                          )}

                        </div>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                          <HelpCircle size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.5 }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Pilih Tiket Support</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', maxWidth: '360px' }}>
                            Pilih salah satu tiket dari daftar di sebelah kiri untuk melihat pesan atau klik tombol di bawah untuk membuat tiket baru.
                          </p>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setShowCreateTicketModal(true)}
                            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '0.65rem' }}
                          >
                            + Buat Tiket Support Baru
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* DESKTOP MODAL: CREATE TICKET */}
                  {showCreateTicketModal && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(8px)',
                      zIndex: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.5rem'
                    }}>
                      <div className="glass-panel animate-scale-up" style={{
                        width: '100%',
                        maxWidth: '560px',
                        backgroundColor: 'var(--card-bg-gradient)',
                        borderRadius: '1.25rem',
                        padding: '1.75rem',
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={20} color="var(--primary)" /> Buat Tiket Support Baru
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowCreateTicketModal(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={22} />
                          </button>
                        </div>

                        <form onSubmit={(e) => {
                          e.preventDefault();
                          if (!newTicketForm.subject.trim() || !newTicketForm.message.trim()) {
                            showToast('Mohon isi Judul dan Detail Kendala.', 'error');
                            return;
                          }

                          const newId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
                          const createdTicket: SupportTicket = {
                            id: newId,
                            subject: newTicketForm.subject.trim(),
                            category: newTicketForm.category,
                            priority: newTicketForm.priority,
                            status: 'open',
                            created_at: 'Baru saja',
                            updated_at: 'Baru saja',
                            messages: [
                              {
                                id: `msg-${Date.now()}`,
                                sender: 'user',
                                sender_name: 'Admin Toko',
                                message: newTicketForm.message.trim(),
                                timestamp: 'Baru saja'
                              }
                            ]
                          };

                          setTickets(prev => [createdTicket, ...prev]);
                          setSelectedTicket(createdTicket);
                          setShowCreateTicketModal(false);
                          setNewTicketForm({ subject: '', category: 'payment', priority: 'normal', message: '' });
                          showToast(`Tiket ${newId} berhasil dibuat!`);
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                          <div className="form-group">
                            <label className="form-label">Judul Kendala / Subjek *</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Contoh: Pembayaran Upgrade Paket Pro Belum Terverifikasi"
                              value={newTicketForm.subject}
                              onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                              required
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                              <label className="form-label">Kategori *</label>
                              <select
                                className="form-input"
                                value={newTicketForm.category}
                                onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value as any })}
                              >
                                <option value="payment">Pembayaran & Paket Pro</option>
                                <option value="technical">Pengaturan Toko / Domain</option>
                                <option value="account">Kendala Akun</option>
                                <option value="feature">Pertanyaan Fitur</option>
                                <option value="other">Lainnya</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Tingkat Urgensi *</label>
                              <select
                                className="form-input"
                                value={newTicketForm.priority}
                                onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value as any })}
                              >
                                <option value="normal">Normal</option>
                                <option value="high">Tinggi</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Detail Pesan & Pertanyaan *</label>
                            <textarea
                              rows={5}
                              className="form-input"
                              placeholder="Jelaskan detail kendala Anda selengkap mungkin..."
                              value={newTicketForm.message}
                              onChange={(e) => setNewTicketForm({ ...newTicketForm, message: e.target.value })}
                              required
                              style={{ resize: 'none' }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setShowCreateTicketModal(false)}
                              style={{ padding: '0.65rem 1.25rem', borderRadius: '0.6rem', fontSize: '0.85rem' }}
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="btn-primary"
                              style={{ padding: '0.65rem 1.5rem', borderRadius: '0.6rem', fontSize: '0.85rem', fontWeight: 800 }}
                            >
                              Kirim Tiket Support
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {adminTab === 'articles' && (
                <div style={{ marginTop: '1rem' }}>
                  {articleTabState === 'hub' && (
                    <div className="animate-fade-in">
                      <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Kelola Blog & Edukasi</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Moderasi komentar pembaca dan kelola konten edukasi satwa hias.</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Card 1: Kelola Artikel */}
                        <div 
                          className="glass-panel card-hover" 
                          onClick={() => setArticleTabState('articles')}
                          style={{ padding: '2rem', borderRadius: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255, 255, 255, 0.01)', transition: 'var(--transition-smooth)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                              <BookOpen size={28} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb), 0.08)', padding: '0.35rem 0.75rem', borderRadius: '2rem' }}>
                              {articles.length} Artikel
                            </span>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Tulis & Kelola Artikel</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                              Tulis artikel edukasi baru, edit konten draf, sesuaikan media gambar, dan kelola opsi izin komentar.
                            </p>
                          </div>
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                            Buka Artikel <ArrowRight size={16} />
                          </div>
                        </div>

                        {/* Card 2: Kelola Komentar */}
                        <div 
                          className="glass-panel card-hover" 
                          onClick={() => { setArticleTabState('comments'); fetchAdminComments(); }}
                          style={{ padding: '2rem', borderRadius: '1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255, 255, 255, 0.01)', transition: 'var(--transition-smooth)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                              <MessageSquare size={28} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', backgroundColor: 'var(--border-light)', padding: '0.35rem 0.75rem', borderRadius: '2rem' }}>
                              Moderasi
                            </span>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Moderasi Komentar</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                              Pantau komentar terbaru dari pembaca, moderation list ala WordPress, serta bersihkan spam atau pesan negatif.
                            </p>
                          </div>
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                            Buka Komentar <ArrowRight size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {articleTabState === 'articles' && (
                    <div className="animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                          <button 
                            className="btn-secondary" 
                            onClick={() => setArticleTabState('hub')} 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <ArrowLeft size={14} /> Kembali ke Hub
                          </button>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Daftar Artikel</h3>
                        </div>
                        <button 
                          className="btn-primary" 
                          onClick={openAddArticleModal}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Plus size={16} /> Tambah Artikel Baru
                        </button>
                      </div>

                      {articles.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <BookOpen size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                          <h3>Belum Ada Artikel</h3>
                          <p style={{ fontSize: '0.9rem' }}>Klik tombol di kanan atas untuk menulis artikel pertama Anda.</p>
                        </div>
                      ) : (
                        <div className="table-responsive" style={{ border: '1px solid var(--border-light)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-light)' }}>
                                <th style={{ padding: '1rem' }}>Gambar</th>
                                <th style={{ padding: '1rem' }}>Judul Artikel</th>
                                <th style={{ padding: '1rem' }}>Penulis / Estimasi</th>
                                <th style={{ padding: '1rem' }}>Komentar</th>
                                <th style={{ padding: '1rem' }}>Tanggal Dibuat</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {articles.map((article) => (
                                <tr key={article.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '1rem' }}>
                                    {article.image_url ? (
                                      <img 
                                        src={article.image_url} 
                                        alt={article.title} 
                                        style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '60px',
                                        height: '40px',
                                        borderRadius: '4px',
                                        background: 'var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)'
                                      }}>
                                        <Image size={14} style={{ opacity: 0.3 }} />
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {article.title}
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                    <div>{article.author}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{article.read_time}</div>
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.25rem',
                                      fontSize: '0.8rem',
                                      color: article.is_comments_enabled ? 'var(--success)' : 'var(--text-muted)',
                                      backgroundColor: article.is_comments_enabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px'
                                    }}>
                                      {article.is_comments_enabled ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                    {new Date(article.updated_at || article.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </td>
                                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                      <button 
                                        className="btn-secondary" 
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                        onClick={() => openEditArticleModal(article)}
                                      >
                                        <Edit3 size={14} /> Edit
                                      </button>
                                      <button 
                                        className="btn-primary" 
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                        onClick={() => handleDeleteArticle(article.id)}
                                      >
                                        <Trash2 size={14} /> Hapus
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {articleTabState === 'comments' && (
                    <div className="animate-fade-in">
                      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <button 
                            className="btn-secondary" 
                            onClick={() => setArticleTabState('hub')} 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <ArrowLeft size={14} /> Kembali ke Hub
                          </button>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Moderasi Komentar Pembaca</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Semua tanggapan pembaca yang masuk pada artikel edukasi Catavor.</p>
                        </div>

                        {/* Status Filter Tab Buttons */}
                        <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                          <button 
                            onClick={() => setCommentsFilter('all')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.35rem',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: commentsFilter === 'all' ? 'var(--primary)' : 'transparent',
                              color: commentsFilter === 'all' ? '#000' : 'var(--text-secondary)'
                            }}
                          >
                            Semua ({adminComments.length})
                          </button>
                          <button 
                            onClick={() => setCommentsFilter('pending')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.35rem',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: commentsFilter === 'pending' ? 'var(--primary)' : 'transparent',
                              color: commentsFilter === 'pending' ? '#000' : 'var(--text-secondary)'
                            }}
                          >
                            Menunggu Moderasi ({adminComments.filter(c => c.status === 'pending').length})
                          </button>
                          <button 
                            onClick={() => setCommentsFilter('approved')}
                            style={{
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.35rem',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: commentsFilter === 'approved' ? 'var(--primary)' : 'transparent',
                              color: commentsFilter === 'approved' ? '#000' : 'var(--text-secondary)'
                            }}
                          >
                            Dipublikasikan ({adminComments.filter(c => c.status === 'approved').length})
                          </button>
                        </div>
                      </div>

                      {loadingComments ? (
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                          <Loader className="animate-spin" style={{ color: 'var(--primary)' }} />
                        </div>
                      ) : adminComments.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <MessageSquare size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                          <h3>Belum Ada Komentar</h3>
                          <p style={{ fontSize: '0.9rem' }}>Belum ada komentar pembaca yang masuk ke dalam sistem.</p>
                        </div>
                      ) : (() => {
                        const filteredComments = adminComments.filter(comment => {
                          if (commentsFilter === 'pending') return comment.status === 'pending';
                          if (commentsFilter === 'approved') return comment.status === 'approved';
                          return true;
                        });
                        if (filteredComments.length === 0) {
                          return (
                            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              <MessageSquare size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                              <h3>Tidak Ada Komentar</h3>
                              <p style={{ fontSize: '0.9rem' }}>Tidak ada komentar dengan status filter ini.</p>
                            </div>
                          );
                        }
                        return (
                          <div className="table-responsive" style={{ border: '1px solid var(--border-light)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-light)' }}>
                                  <th style={{ padding: '1rem', width: '22%' }}>Komentator</th>
                                  <th style={{ padding: '1rem', width: '13%', textAlign: 'center' }}>Status</th>
                                  <th style={{ padding: '1rem', width: '35%' }}>Isi Komentar</th>
                                  <th style={{ padding: '1rem', width: '15%' }}>Artikel</th>
                                  <th style={{ padding: '1rem', width: '15%', textAlign: 'center' }}>Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredComments.map((comment) => (
                                  <tr key={comment.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                                      <div style={{ fontWeight: 600 }}>{comment.name}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comment.email || 'Tanpa email'}</div>
                                      {comment.parent && (
                                        <div style={{ 
                                          fontSize: '0.7rem', 
                                          color: 'var(--primary)', 
                                          marginTop: '0.15rem',
                                          backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
                                          display: 'inline-block',
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '4px'
                                        }}>
                                          Membalas: {comment.parent.name}
                                        </div>
                                      )}
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        {new Date(comment.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        color: comment.status === 'approved' ? 'var(--success)' : '#eab308',
                                        backgroundColor: comment.status === 'approved' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(234, 179, 8, 0.08)'
                                      }}>
                                        {comment.status === 'approved' ? 'Disetujui' : 'Moderasi'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                      {comment.content}
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 500 }}>
                                      {comment.article ? comment.article.title : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Artikel dihapus</span>}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                                        {comment.status === 'pending' && (
                                          <button 
                                            className="btn-primary" 
                                            style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                            onClick={() => handleApproveComment(comment.id)}
                                          >
                                            <Check size={12} /> Setujui
                                          </button>
                                        )}
                                        <button 
                                          className="btn-primary" 
                                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                          onClick={() => handleDeleteComment(comment.id)}
                                        >
                                          <Trash2 size={12} /> Hapus
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          /* ========================================================
             FULL-PAGE ARTICLE EDITOR VIEW (WORDPRESS/BLOGGER STYLE)
             ======================================================== */
          <div className="animate-fade-in" style={{ marginTop: '1rem' }}>
            {/* Editor Sub-Header / Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <button 
                  onClick={() => setView('admin')}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <ArrowLeft size={16} /> Batal & Kembali
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {editingArticle ? 'Mode: Mengedit Artikel' : 'Mode: Tulis Artikel Baru'}
                </span>
                <button 
                  onClick={(e) => handleSaveArticle(e)}
                  className="btn-primary"
                  disabled={articlesLoading}
                  style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
                >
                  {articlesLoading ? 'Menyimpan...' : 'Terbitkan / Simpan'}
                </button>
              </div>
            </div>

            {/* Title & Core Meta Row */}
            <div style={{ marginBottom: '1.5rem' }}>
              <input 
                type="text"
                placeholder="Masukkan Judul Artikel..."
                value={articleForm.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '2px solid var(--border-light)',
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  paddingBottom: '0.75rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderBottomColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderBottomColor = 'var(--border-light)'}
              />
            </div>

            {/* Layout Grid */}
            <div className="article-editor-layout">
              {/* Left Column: Editor Area */}
              <div>
                {/* Visual / HTML / Preview Tabs Selector */}
                <div className="editor-tab-row">
                  <button 
                    className={`editor-tab-btn ${editorTab === 'compose' ? 'active' : ''}`}
                    onClick={() => {
                      if (editorTab === 'html' && editorRef.current) {
                        // Keep visually synced
                        editorRef.current.innerHTML = articleForm.content
                      }
                      setEditorTab('compose')
                    }}
                  >
                    Visual (Compose)
                  </button>
                  <button 
                    className={`editor-tab-btn ${editorTab === 'html' ? 'active' : ''}`}
                    onClick={() => setEditorTab('html')}
                  >
                    HTML / Source Code
                  </button>
                  <button 
                    className={`editor-tab-btn ${editorTab === 'preview' ? 'active' : ''}`}
                    onClick={() => setEditorTab('preview')}
                  >
                    Pratinjau (Preview Layout)
                  </button>
                </div>

                {editorTab === 'compose' && (
                  <>
                    {/* Visual Editor Toolbar */}
                    <div className="editor-toolbar">
                      <button type="button" className="editor-btn" onClick={() => execFormat('bold')} title="Tebal (Bold)"><Bold size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('italic')} title="Miring (Italic)"><Italic size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('underline')} title="Garis Bawah (Underline)"><Underline size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('strikeThrough')} title="Coret (Strikethrough)"><Strikethrough size={16} /></button>
                      
                      <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--border-light)', margin: '0 0.5rem' }}></div>
                      
                      <button type="button" className="editor-btn" onClick={() => execFormat('formatBlock', '<h2>')} title="Heading H2" style={{ fontWeight: 800, fontSize: '0.8rem' }}>H2</button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('formatBlock', '<h3>')} title="Heading H3" style={{ fontWeight: 800, fontSize: '0.8rem' }}>H3</button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('formatBlock', '<p>')} title="Paragraph" style={{ fontSize: '0.8rem' }}>P</button>
                      
                      <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--border-light)', margin: '0 0.5rem' }}></div>
                      
                      <button type="button" className="editor-btn" onClick={() => execFormat('justifyLeft')} title="Rata Kiri"><AlignLeft size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('justifyCenter')} title="Rata Tengah"><AlignCenter size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('justifyRight')} title="Rata Kanan"><AlignRight size={16} /></button>
                      
                      <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--border-light)', margin: '0 0.5rem' }}></div>
                      
                      <button type="button" className="editor-btn" onClick={() => execFormat('insertUnorderedList')} title="Daftar Bullets"><List size={16} /></button>
                      <button type="button" className="editor-btn" onClick={() => execFormat('insertOrderedList')} title="Daftar Angka"><ListOrdered size={16} /></button>
                      
                      <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--border-light)', margin: '0 0.5rem' }}></div>
                      
                      <button type="button" className="editor-btn" onClick={insertLinkUrl} title="Sisipkan Tautan (Link)"><LinkIcon size={16} /></button>
                      <button type="button" className="editor-btn" onClick={insertImageUrl} title="Sisipkan Gambar via URL"><Image size={16} /></button>
                      <button type="button" className="editor-btn" onClick={clearFormatting} title="Hapus Pemformatan"><Heading size={16} /></button>
                    </div>

                    {/* Canvas Area */}
                    <div className="editor-canvas-container">
                      <div 
                        ref={editorRef}
                        contentEditable
                        className="editor-canvas"
                        onInput={handleVisualInput}
                        onKeyUp={saveSelection}
                        onMouseUp={saveSelection}
                        onTouchEnd={saveSelection}
                        onFocus={saveSelection}
                        onBlur={saveSelection}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'IMG') {
                            const imgEl = target as HTMLImageElement;
                            setSelectedEditorImage(imgEl);
                            setImageAltText(imgEl.getAttribute('alt') || '');
                            
                            const nextSib = imgEl.nextElementSibling;
                            if (nextSib && nextSib.getAttribute('data-img-caption') === 'true') {
                              setImageCaptionText((nextSib as HTMLElement).innerText);
                            } else {
                              setImageCaptionText('');
                            }
                            
                            const w = imgEl.style.width || imgEl.getAttribute('width') || '';
                            if (w === '150px' || w === '15%') {
                              setImageSizeSelection('kecil');
                            } else if (w === '300px' || w === '35%') {
                              setImageSizeSelection('sedang');
                            } else if (w === '500px' || w === '60%') {
                              setImageSizeSelection('besar');
                            } else if (w === '800px' || w === '90%') {
                              setImageSizeSelection('ekstrabesar');
                            } else if (w === '100%') {
                              setImageSizeSelection('asli');
                            } else {
                              setImageSizeSelection('sedang');
                            }
                          } else {
                            setSelectedEditorImage(null);
                          }
                        }}
                        style={{ minHeight: '400px' }}
                      />
                    </div>

                    {/* Blogger-style Image Settings Toolbar */}
                    {selectedEditorImage && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        backgroundColor: '#1b221e',
                        border: '1px solid var(--border-light)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 1rem',
                        marginTop: '0.5rem',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Gambar Terpilih:</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            type="button" 
                            className="editor-btn"
                            onClick={() => {
                              const parent = selectedEditorImage.parentElement;
                              const isWrapped = parent && parent.classList.contains('img-caption-wrapper');
                              const targetEl = isWrapped ? parent : selectedEditorImage;

                              targetEl.style.display = isWrapped ? 'inline-block' : 'inline';
                              targetEl.style.float = 'left';
                              targetEl.style.margin = '0.5rem 1rem 0.5rem 0';
                              targetEl.style.clear = 'none';

                              if (isWrapped) {
                                selectedEditorImage.style.display = 'block';
                                selectedEditorImage.style.float = 'none';
                                selectedEditorImage.style.margin = '0 auto';
                                selectedEditorImage.style.clear = 'none';
                                
                                const capDiv = parent.querySelector('.img-caption-text') as HTMLElement;
                                if (capDiv) {
                                  capDiv.style.textAlign = 'left';
                                  capDiv.style.borderLeft = '2px solid var(--primary)';
                                  capDiv.style.borderRight = 'none';
                                  capDiv.style.borderRadius = '0 0.25rem 0.25rem 0';
                                }
                              }
                              handleVisualInput();
                            }}
                            title="Rata Kiri"
                          >
                            <AlignLeft size={14} />
                          </button>
                          <button 
                            type="button" 
                            className="editor-btn"
                            onClick={() => {
                              const parent = selectedEditorImage.parentElement;
                              const isWrapped = parent && parent.classList.contains('img-caption-wrapper');
                              const targetEl = isWrapped ? parent : selectedEditorImage;

                              targetEl.style.display = 'block';
                              targetEl.style.float = 'none';
                              targetEl.style.margin = '1rem auto';
                              targetEl.style.clear = 'both';

                              if (isWrapped) {
                                selectedEditorImage.style.display = 'block';
                                selectedEditorImage.style.float = 'none';
                                selectedEditorImage.style.margin = '0 auto';
                                selectedEditorImage.style.clear = 'none';

                                const capDiv = parent.querySelector('.img-caption-text') as HTMLElement;
                                if (capDiv) {
                                  capDiv.style.textAlign = 'center';
                                  capDiv.style.borderLeft = 'none';
                                  capDiv.style.borderRight = 'none';
                                  capDiv.style.borderRadius = '0.25rem';
                                }
                              }
                              handleVisualInput();
                            }}
                            title="Rata Tengah"
                          >
                            <AlignCenter size={14} />
                          </button>
                          <button 
                            type="button" 
                            className="editor-btn"
                            onClick={() => {
                              const parent = selectedEditorImage.parentElement;
                              const isWrapped = parent && parent.classList.contains('img-caption-wrapper');
                              const targetEl = isWrapped ? parent : selectedEditorImage;

                              targetEl.style.display = isWrapped ? 'inline-block' : 'inline';
                              targetEl.style.float = 'right';
                              targetEl.style.margin = '0.5rem 0 0.5rem 1rem';
                              targetEl.style.clear = 'none';

                              if (isWrapped) {
                                selectedEditorImage.style.display = 'block';
                                selectedEditorImage.style.float = 'none';
                                selectedEditorImage.style.margin = '0 auto';
                                selectedEditorImage.style.clear = 'none';

                                const capDiv = parent.querySelector('.img-caption-text') as HTMLElement;
                                if (capDiv) {
                                  capDiv.style.textAlign = 'right';
                                  capDiv.style.borderLeft = 'none';
                                  capDiv.style.borderRight = '2px solid var(--primary)';
                                  capDiv.style.borderRadius = '0.25rem 0 0 0.25rem';
                                }
                              }
                              handleVisualInput();
                            }}
                            title="Rata Kanan"
                          >
                            <AlignRight size={14} />
                          </button>
                        </div>
                        
                        <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => {
                              setShowImageSettingsModal(true);
                            }}
                          >
                            <Settings size={12} /> Pengaturan
                          </button>
                          <button 
                            type="button" 
                            className="btn-primary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => {
                              selectedEditorImage.remove();
                              setSelectedEditorImage(null);
                              handleVisualInput();
                            }}
                          >
                            <Trash2 size={12} /> Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {editorTab === 'html' && (
                  <div className="editor-canvas-container">
                    <textarea 
                      className="editor-textarea"
                      placeholder="Masukkan kode HTML atau teks di sini..."
                      value={articleForm.content}
                      onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                    />
                  </div>
                )}

                {editorTab === 'preview' && (
                  <div className="editor-canvas-container">
                    <div className="editor-preview">
                      {articleForm.image_url ? (
                        <img 
                          src={articleForm.image_url} 
                          alt="Cover Preview" 
                          style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }} 
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '240px',
                          borderRadius: '0.75rem',
                          marginBottom: '1.5rem',
                          border: '1px solid var(--border-light)',
                          background: 'linear-gradient(135deg, #131916 0%, #0b0e0c 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          color: 'var(--text-muted)'
                        }}>
                          <Image size={32} style={{ opacity: 0.2 }} />
                          <span style={{ fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase' }}>No Cover Image</span>
                        </div>
                      )}
                      <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        {articleForm.title || 'Judul Artikel Kosong'}
                      </h2>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                        <span>Oleh: <strong>{articleForm.author}</strong></span>
                        <span>&bull;</span>
                        <span>{articleForm.read_time}</span>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: articleForm.content || '<p style="color:var(--text-muted)">Belum ada konten...</p>' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Settings / Sidebar */}
              <div className="editor-sidebar-card">
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                  Setelan Artikel (SEO & Metadata)
                </h4>

                {/* Permalink/Slug Editor */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Permalink (Slug URL) *</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>SEO Friendly</span>
                  </label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="nama-slug-artikel..."
                    required
                    value={articleForm.slug}
                    onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    URL: /articles/{articleForm.slug || 'slug'}
                  </small>
                </div>

                {/* Meta Description (Strict SEO counter) */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Meta Deskripsi SEO</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      color: articleForm.meta_description.length > 160 ? 'var(--danger)' : 'var(--success)' 
                    }}>
                      {articleForm.meta_description.length} / 160
                    </span>
                  </label>
                  <textarea 
                    rows={4}
                    className="form-input"
                    placeholder="Ringkasan artikel untuk deskripsi di Google & AI Search (max 160 karakter)..."
                    value={articleForm.meta_description}
                    onChange={(e) => setArticleForm({ ...articleForm, meta_description: e.target.value })}
                    style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Berguna bagi AI Search Engine (Perplexity/Gemini) untuk mengekstrak kutipan ringkasan yang relevan.
                  </small>
                </div>

                {/* Cover Image URL */}
                <div className="form-group">
                  <label className="form-label">Cover Image (URL)</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="https://images.unsplash.com/..."
                    value={articleForm.image_url}
                    onChange={(e) => setArticleForm({ ...articleForm, image_url: e.target.value })}
                  />
                </div>

                {/* Author */}
                <div className="form-group">
                  <label className="form-label">Penulis / Sumber *</label>
                  <input 
                    type="text"
                    className="form-input"
                    required
                    value={articleForm.author}
                    onChange={(e) => setArticleForm({ ...articleForm, author: e.target.value })}
                  />
                </div>

                {/* Read Time */}
                <div className="form-group">
                  <label className="form-label">Waktu Baca *</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="e.g. 5 mnt baca"
                    required
                    value={articleForm.read_time}
                    onChange={(e) => setArticleForm({ ...articleForm, read_time: e.target.value })}
                  />
                </div>

                {/* Comments Toggle */}
                <div className="form-group" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={articleForm.is_comments_enabled}
                      onChange={(e) => setArticleForm({ ...articleForm, is_comments_enabled: e.target.checked })}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: 'var(--primary)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Aktifkan Komentar Pembaca</span>
                  </label>
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Jika diaktifkan, semua orang dapat meninggalkan tanggapan di halaman artikel ini.
                  </small>
                </div>

                {articleForm.is_comments_enabled && (
                  <div style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.85rem', borderLeft: '2px solid var(--border-light)' }}>
                    {/* Require Approval */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={articleForm.require_comment_approval}
                          onChange={(e) => setArticleForm({ ...articleForm, require_comment_approval: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>Tahan Komentar untuk Moderasi</span>
                      </label>
                      <small style={{ display: 'block', marginTop: '0.15rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Komentar harus disetujui admin sebelum diterbitkan secara publik.
                      </small>
                    </div>

                    {/* Require Email */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={articleForm.require_comment_email}
                          onChange={(e) => setArticleForm({ ...articleForm, require_comment_email: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>Wajibkan Email Komentator</span>
                      </label>
                      <small style={{ display: 'block', marginTop: '0.15rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Pengunjung wajib menyertakan alamat email saat berkomentar.
                      </small>
                    </div>

                    {/* Verify Email Domain */}
                    {articleForm.require_comment_email && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={articleForm.verify_comment_email_domain}
                            onChange={(e) => setArticleForm({ ...articleForm, verify_comment_email_domain: e.target.checked })}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>Verifikasi Domain Email (DNS MX)</span>
                        </label>
                        <small style={{ display: 'block', marginTop: '0.15rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Memeriksa keaslian domain (DNS MX record) untuk mencegah email palsu.
                        </small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    )}
      {/* CUSTOM CONFIRMATION DIALOG FOR MASTER OPTION DELETION */}
      {deleteMasterModalData && (
        <div className="modal-overlay" onClick={() => setDeleteMasterModalData(null)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)' }}>
            <button className="modal-close-btn" onClick={() => setDeleteMasterModalData(null)}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--danger)' }}>
              Konfirmasi Hapus Opsi Master
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Anda yakin ingin menghapus opsi <strong>"{deleteMasterModalData.value}"</strong>?
              Semua postingan fauna yang menggunakan opsi ini akan dialihkan ke opsi pengganti di bawah ini.
            </p>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Pilih Opsi Pengganti *</label>
              <select 
                className="form-select"
                value={deleteMasterModalData.selectedReplacement}
                onChange={(e) => setDeleteMasterModalData({
                  ...deleteMasterModalData,
                  selectedReplacement: e.target.value
                })}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.50rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              >
                {deleteMasterModalData.replacementOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setDeleteMasterModalData(null)}
              >
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary"
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={async () => {
                  const { field, value, selectedReplacement } = deleteMasterModalData;
                  setDeleteMasterModalData(null); // Close modal
                  
                  try {
                    setCrudLoading(true)
                    const res = await fetch(`${API_BASE}/stores/delete-master-option`, {
                      method: 'POST',
                      headers: getAuthHeaders(),
                      body: JSON.stringify({ field, value, replacement: selectedReplacement })
                    })
                    const data = await res.json()
                    if (res.ok && data.success) {
                      showToast('Kategori/Opsi berhasil dihapus!')
                      loadData()
                    } else {
                      showToast(data.message || 'Gagal menghapus opsi.', 'error')
                    }
                  } catch (err) {
                    showToast('Koneksi internet bermasalah. Gagal menghapus opsi.', 'error')
                  } finally {
                    setCrudLoading(false)
                  }
                }}
              >
                Hapus & Alihkan
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ADMIN CRUD ADD/EDIT MODAL WITH UNIVERSAL MULTI-CATEGORY SUPPORT */}
      {showCrudModal && (() => {
        const typeConfig = getItemTypeFormConfig(crudForm.product_type);
        const IconComponent = typeConfig.icon;
        
        return (
          <div className="modal-overlay" onClick={() => setShowCrudModal(false)}>
            <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
              <button className="modal-close-btn" onClick={() => setShowCrudModal(false)}>
                <X size={18} />
              </button>
              
              {/* Category Selector Pill Bar */}
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 800, display: 'block', marginBottom: '0.6rem' }}>
                  Pilih Tipe Item Katalog:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem' }}>
                  {[
                    { id: 'physical', name: 'Barang Fisik', icon: Package, color: '#2563eb' },
                    { id: 'digital', name: 'Item Digital', icon: FileCode, color: '#8b5cf6' },
                    { id: 'fauna', name: 'Satwa / Fauna', icon: PawPrint, color: '#059669' },
                    { id: 'service', name: 'Jasa & Layanan', icon: Wrench, color: '#d97706' },
                    { id: 'food', name: 'Menu Kuliner', icon: Utensils, color: '#dc2626' }
                  ].map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = crudForm.product_type === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const newConfig = getItemTypeFormConfig(cat.id as ItemCategoryType);
                          setCrudForm(prev => ({
                            ...prev,
                            product_type: cat.id as ItemCategoryType,
                            class: prev.class === typeConfig.defaultCategory ? newConfig.defaultCategory : prev.class,
                            shipping_coverage: prev.shipping_coverage === typeConfig.deliveryOptions[0] ? newConfig.deliveryOptions[0] : prev.shipping_coverage
                          }));
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          padding: '0.6rem 0.35rem',
                          borderRadius: '0.65rem',
                          border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-light)',
                          backgroundColor: isSelected ? `${cat.color}18` : 'rgba(255, 255, 255, 0.02)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? `0 4px 12px ${cat.color}25` : 'none'
                        }}
                      >
                        <CatIcon size={18} style={{ color: isSelected ? cat.color : 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: isSelected ? 800 : 600, textAlign: 'center', lineHeight: 1.2 }}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Header */}
              <div className="modal-header-section" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: `${typeConfig.color}20`,
                  border: `1px solid ${typeConfig.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: typeConfig.color,
                  flexShrink: 0
                }}>
                  <IconComponent size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {typeConfig.modalTitle(crudMode)}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>
                    {typeConfig.modalSubtitle}
                  </p>
                </div>
              </div>

              <div className="modal-body-scroll">
                {crudError && (
                  <div className="alert-message alert-error" style={{ marginBottom: '1.5rem' }}>
                    {crudError}
                  </div>
                )}

                <form id="crud-form" onSubmit={handleFaunaSubmit}>
                  {/* Standar Fields: Nama & Harga */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{typeConfig.nameLabel}</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder={typeConfig.namePlaceholder}
                        required
                        value={crudForm.name}
                        onChange={(e) => setCrudForm({ ...crudForm, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{typeConfig.priceLabel}</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder={typeConfig.pricePlaceholder}
                        required
                        value={formatRupiahInput(crudForm.price)}
                        onChange={(e) => setCrudForm({ ...crudForm, price: parseRupiahInput(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Kategori / Klasifikasi */}
                  <div className="form-group">
                    <label className="form-label">{typeConfig.categoryLabel}</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select 
                        className="form-select"
                        style={{ flex: 1 }}
                        value={showCustomClassInput ? '__NEW__' : crudForm.class}
                        onChange={(e) => {
                          const newClass = e.target.value;
                          if (newClass === '__NEW__') {
                            setShowCustomClassInput(true)
                            setCustomClass('')
                          } else {
                            setShowCustomClassInput(false)
                            setCrudForm(prev => ({ ...prev, class: newClass }))
                          }
                        }}
                      >
                        {getCategoryOptionsForType(crudForm.product_type).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__NEW__">+ Tambah Kategori Baru...</option>
                      </select>
                    </div>
                    {showCustomClassInput && (
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ marginTop: '0.5rem' }} 
                        placeholder="Ketik nama kategori baru toko Anda..." 
                        value={customClass} 
                        onChange={(e) => setCustomClass(e.target.value)} 
                        required 
                      />
                    )}
                  </div>

                  {/* ============================================================
                      DYNAMIC ATTRIBUTES SPECIFIC TO CATEGORY TYPE
                      ============================================================ */}

                  {/* 1. BARANG FISIK */}
                  {crudForm.product_type === 'physical' && (
                    <div style={{ background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.75rem' }}>
                        📦 Spesifikasi Barang Fisik
                      </span>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Kondisi Barang *</label>
                          <select 
                            className="form-select"
                            value={crudForm.attributes.condition}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, condition: e.target.value as any } })}
                          >
                            <option value="Baru">Baru (Brand New)</option>
                            <option value="Bekas">Bekas (Second Mulus)</option>
                            <option value="Refurbished">Refurbished / Rekondisi</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Berat Barang (Gram) *</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Contoh: 500"
                            required
                            value={crudForm.attributes.weight}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, weight: parseInt(e.target.value) || 0 } })}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Merek / Brand (Opsional)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Nike / Asus / Zara / Custom Handmade"
                            value={crudForm.attributes.brand || ''}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, brand: e.target.value } })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Varian / Ukuran / Warna (Opsional)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: S, M, L, XL / Hitam, Putih / 128GB"
                            value={crudForm.attributes.variant || ''}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, variant: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Minimal Pembelian (Opsional)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: 1 Pcs / 1 Unit / 1 Box"
                            value={crudForm.attributes.min_purchase || ''}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, min_purchase: e.target.value } })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Maksimal Pembelian (Opsional)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: 10 Pcs / Tidak Dibatasi"
                            value={crudForm.attributes.max_purchase || ''}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, max_purchase: e.target.value } })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. ITEM DIGITAL */}
                  {crudForm.product_type === 'digital' && (
                    <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.75rem' }}>
                        💻 Atribut Spesifik Item Digital
                      </span>
                      <div className="form-group">
                        <label className="form-label">Link Akses / Download File *</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          placeholder="https://drive.google.com/file/d/... atau link cloud storage"
                          required
                          value={crudForm.attributes.download_url}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, download_url: e.target.value } })}
                        />
                      </div>
                      <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        <div className="form-group">
                          <label className="form-label">Ukuran File *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: 15 MB / 1.2 GB"
                            required
                            value={crudForm.attributes.file_size}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, file_size: e.target.value } })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Tipe Lisensi *</label>
                          <select 
                            className="form-select"
                            value={crudForm.attributes.license_type || 'Lisensi Personal'}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, license_type: e.target.value } })}
                          >
                            <option value="Lisensi Personal">Lisensi Personal (Penggunaan Pribadi)</option>
                            <option value="Lisensi Komersial">Lisensi Komersial (Bisnis/Proyek)</option>
                            <option value="Extended License">Extended License / Resell Rights</option>
                            <option value="Open Source">Open Source / Bebas</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. SATWA & LIVING FAUNA */}
                  {crudForm.product_type === 'fauna' && (
                    <div style={{ background: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.75rem' }}>
                        🦎 Atribut Spesifik Satwa &amp; Living Fauna
                      </span>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Nama Ilmiah / Taksonomi *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Scleropages formosus..."
                            required
                            value={crudForm.scientific_name}
                            onChange={(e) => setCrudForm({ ...crudForm, scientific_name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Habitat Asli *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Air Tawar / Air Laut / Darat"
                            required
                            value={crudForm.habitat}
                            onChange={(e) => setCrudForm({ ...crudForm, habitat: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Makanan / Diet *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Pelet / Jangkrik / Karnivora"
                            required
                            value={crudForm.diet}
                            onChange={(e) => setCrudForm({ ...crudForm, diet: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Status Ketersediaan *</label>
                          <select 
                            className="form-select"
                            value={crudForm.conservation_status}
                            onChange={(e) => setCrudForm({ ...crudForm, conservation_status: e.target.value })}
                          >
                            <option value="Tersedia">Tersedia (Ready Stock)</option>
                            <option value="Pre-Order">Pre-Order (PO)</option>
                            <option value="Koleksi / Display">Koleksi / Display Only</option>
                            <option value="Habis Terjual">Habis Terjual (Sold Out)</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Asal Wilayah</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Kalimantan Barat..."
                            value={crudForm.native_region}
                            onChange={(e) => setCrudForm({ ...crudForm, native_region: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Estimasi Usia / Masa Hidup</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: 2 Bulan / 10-15 tahun..."
                            value={crudForm.lifespan}
                            onChange={(e) => setCrudForm({ ...crudForm, lifespan: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ukuran / Berat Satwa</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Size 15 cm / 500 gram..."
                            value={crudForm.weight}
                            onChange={(e) => setCrudForm({ ...crudForm, weight: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. JASA & LAYANAN */}
                  {crudForm.product_type === 'service' && (
                    <div style={{ background: 'rgba(217, 119, 6, 0.05)', border: '1px solid rgba(217, 119, 6, 0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.75rem' }}>
                        🔧 Atribut Spesifik Jasa &amp; Layanan
                      </span>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Durasi / Estimasi Pengerjaan *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: 1-2 Jam / 3 Hari Kerja / 1 Sesi"
                            required
                            value={crudForm.attributes.duration}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, duration: e.target.value } })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Metode &amp; Lokasi Layanan *</label>
                          <select 
                            className="form-select"
                            value={crudForm.attributes.service_location}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, service_location: e.target.value } })}
                          >
                            <option value="Datang ke Toko">Datang ke Lokasi Toko / Studio</option>
                            <option value="Home Visit (Ke Rumah)">Panggilan ke Rumah (Home Service)</option>
                            <option value="Online">Online / Jarak Jauh (Remote)</option>
                            <option value="Fleksibel">Fleksibel (Toko / Home Visit)</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Wilayah Jangkauan Operasional *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Jabodetabek / Bandung Kota / Seluruh Indonesia"
                            required
                            value={crudForm.attributes.service_area}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, service_area: e.target.value } })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Termasuk dalam Paket (Inclusions)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Contoh: Alat &amp; Bahan, Garansi 14 Hari, Free Konsultasi"
                            value={crudForm.attributes.inclusions || ''}
                            onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, inclusions: e.target.value } })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. PRODUK KULINER (F&B) - DYNAMIC CONTEXT-AWARE SUB-FORMS */}
                  {crudForm.product_type === 'food' && (() => {
                    const activeCulinaryType = crudForm.attributes.culinary_type || (CULINARY_SMART_PRESETS[crudForm.class] ? crudForm.class : 'Makanan Siap Santap');
                    return (
                    <div style={{ background: 'rgba(220, 38, 38, 0.05)', border: '1px solid rgba(220, 38, 38, 0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(220, 38, 38, 0.15)', paddingBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🍔 Karakteristik &amp; Spesifikasi Kuliner
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Kategori Menu: <strong style={{ color: '#fff' }}>{crudForm.class}</strong>
                        </span>
                      </div>

                      {/* Dropdown Pemilihan Karakteristik Kuliner */}
                      <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                        <label className="form-label">Tipe Karakteristik Kuliner *</label>
                        <select 
                          className="form-select"
                          value={activeCulinaryType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            const preset = CULINARY_SMART_PRESETS[newType];
                            setCrudForm(prev => ({
                              ...prev,
                              shipping_coverage: preset ? preset.defaultShipping : prev.shipping_coverage,
                              attributes: {
                                ...prev.attributes,
                                culinary_type: newType,
                                storage_temp: preset ? preset.defaultStorageTemp : prev.attributes.storage_temp,
                                expired_info: preset ? preset.defaultExpiredInfo : prev.attributes.expired_info
                              }
                            }));
                          }}
                        >
                          {Object.keys(CULINARY_SMART_PRESETS).map(typeKey => (
                            <option key={typeKey} value={typeKey}>
                              {CULINARY_SMART_PRESETS[typeKey].badgeEmoji} {typeKey}
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                          Pilih sifat fisik kuliner untuk memunculkan spesifikasi teknis, takaran saji, dan panduan pengiriman yang tepat.
                        </span>
                      </div>

                      {/* SUB-FORM 1: Makanan Siap Santap */}
                      {activeCulinaryType === 'Makanan Siap Santap' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Porsi / Takaran Saji *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 1 Porsi / Paket Komplit Nasi + Lauk"
                                required
                                value={crudForm.attributes.portion_size || '1 Porsi'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Pilihan Rasa / Level Pedas</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Level 0-5 / Original / Manis Gurih / Pedas Nampol"
                                value={crudForm.attributes.spicy_level || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, spicy_level: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Estimasi Waktu Penyiapan / Masak *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 10 - 20 Menit"
                                required
                                value={crudForm.attributes.prep_time || '15 Menit'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, prep_time: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Metode Penyajian *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.serving_method || 'Dine-in, Takeaway & Kurir Instan'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, serving_method: e.target.value } })}
                              >
                                <option value="Dine-in, Takeaway & Kurir Instan">Dine-in, Takeaway &amp; Kurir Instan</option>
                                <option value="Khusus Kurir Instan / Sameday">Khusus Kurir Instan / Sameday</option>
                                <option value="Dine-in (Makan di Tempat Only)">Dine-in (Makan di Tempat Only)</option>
                                <option value="Takeaway (Bungkus Bawa Pulang)">Takeaway (Bungkus Bawa Pulang)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sertifikasi &amp; Legalitas *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi (Kemenag/MUI)</option>
                                <option value="Homemade / Segar">Homemade / Olahan Segar</option>
                                <option value="Non-Halal">Non-Halal</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 2: Makanan Beku & Olahan (Frozen) */}
                      {activeCulinaryType === 'Makanan Beku & Olahan (Frozen)' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Isi Bersih / Kemasan *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Pack 500 gr (Isi 15 pcs) / Box 1 kg"
                                required
                                value={crudForm.attributes.portion_size || 'Pack 500 gr'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Masa Simpan di Freezer *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 3 Bulan di Freezer (-18°C) / 3 Hari di Chiller"
                                required
                                value={crudForm.attributes.expired_info || '3 Bulan di Freezer'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Petunjuk &amp; Cara Memasak *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Kukus 10 menit / Goreng api sedang 3 menit / Rebus 5 menit"
                                required
                                value={crudForm.attributes.cooking_guide || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, cooking_guide: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Suhu Penyimpanan *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.storage_temp || 'Beku (Freezer -18°C)'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, storage_temp: e.target.value } })}
                              >
                                <option value="Beku (Freezer -18°C)">Beku (Freezer -18°C)</option>
                                <option value="Dingin (Kulkas / Chiller 4°C)">Dingin (Kulkas / Chiller 4°C)</option>
                                <option value="Freezer atau Chiller">Freezer atau Chiller</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Izin Edar &amp; Halal *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="BPOM / P-IRT & Halal">Izin BPOM / P-IRT &amp; Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi</option>
                                <option value="Homemade / Tanpa Pengawet">Homemade / Non-Pengawet</option>
                                <option value="Non-Halal">Non-Halal</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 3: Minuman & Olahan Kopi */}
                      {activeCulinaryType === 'Minuman & Olahan Kopi' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Volume / Kemasan *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Botol 250 ml / Literan 1000 ml / Cup 16oz (Medium)"
                                required
                                value={crudForm.attributes.portion_size || 'Cup 16oz'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Pilihan Level Manis &amp; Es</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Normal / Less Sugar (50%) / No Sugar / Extra Ice"
                                value={crudForm.attributes.sugar_ice_options || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, sugar_ice_options: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Kondisi Suhu Minuman *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.storage_temp || 'Dingin (Chiller)'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, storage_temp: e.target.value } })}
                              >
                                <option value="Dingin (Chiller)">Dingin (Chiller / Kulkas)</option>
                                <option value="Dingin dengan Es Batu">Dingin dengan Es Batu</option>
                                <option value="Hangat / Panas">Hangat / Panas</option>
                                <option value="Bisa Hangat atau Dingin">Bisa Hangat atau Dingin</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Masa Simpan Minuman *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Fresh Daily (Langsung Diminum) / 3-5 Hari di Kulkas"
                                required
                                value={crudForm.attributes.expired_info || 'Fresh Daily'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sertifikasi *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi</option>
                                <option value="P-IRT / BPOM">Izin P-IRT / BPOM</option>
                                <option value="Homemade / Fresh">Homemade / Fresh Segar</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 4: Camilan, Snack & Kue Kering */}
                      {activeCulinaryType === 'Camilan, Snack & Kue Kering' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Berat Bersih / Kemasan *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Toples 250 gr / Pouch Zipper 150 gr / Ball 1 kg"
                                required
                                value={crudForm.attributes.portion_size || 'Pouch 200 gr'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Pilihan Varian Rasa / Level Pedas</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Original Gurih, Balado Pedas, Keju Manis, BBQ"
                                value={crudForm.attributes.spicy_level || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, spicy_level: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Masa Simpan (Exp Date) *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 3-6 Bulan (Tutup rapat di suhu ruang)"
                                required
                                value={crudForm.attributes.expired_info || '6 Bulan'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Suhu Penyimpanan *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.storage_temp || 'Suhu Ruang'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, storage_temp: e.target.value } })}
                              >
                                <option value="Suhu Ruang">Suhu Ruang (Kering &amp; Sejuk)</option>
                                <option value="Kedap Udara">Wadah Kedap Udara</option>
                                <option value="Kulkas / Dingin">Kulkas / Chiller</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Izin Edar &amp; Legalitas *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Dinkes P-IRT">Dinkes P-IRT Resmi</option>
                                <option value="BPOM & Halal">Izin BPOM &amp; Halal</option>
                                <option value="Homemade / Tanpa Pengawet">Homemade / Non-Pengawet</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 5: Bakery, Roti & Pastry */}
                      {activeCulinaryType === 'Bakery, Roti & Pastry' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Ukuran / Jumlah Isi *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 1 Loyang (Diameter 20cm) / Box isi 6 pcs / Loaf 400 gr"
                                required
                                value={crudForm.attributes.portion_size || 'Box isi 6 pcs'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Pilihan Rasa / Topping</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Coklat Belgian, Keju Parmesan, Matcha, Lotus Biscoff"
                                value={crudForm.attributes.taste_options || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, taste_options: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Masa Simpan Roti / Kue *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 3-4 Hari Suhu Ruang / 7 Hari di Kulkas"
                                required
                                value={crudForm.attributes.expired_info || '3-4 Hari Suhu Ruang'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Status Pembuatan *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.bake_status || 'Freshly Baked Daily'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, bake_status: e.target.value } })}
                              >
                                <option value="Freshly Baked Daily">Freshly Baked Daily (Dibuat Harian)</option>
                                <option value="Pre-Order H-1">Pre-Order H-1</option>
                                <option value="Pre-Order H-2">Pre-Order H-2</option>
                                <option value="Ready Stock">Ready Stock di Toko</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sertifikasi *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi</option>
                                <option value="Dinkes P-IRT">Dinkes P-IRT</option>
                                <option value="Tanpa Bahan Pengawet">100% Tanpa Pengawet</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 6: Bumbu & Bahan Masak */}
                      {activeCulinaryType === 'Bumbu & Bahan Masak' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Isi Bersih Kemasan *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Botol Kaca 200 ml / Pouch 250 gr / Pack 1 kg"
                                required
                                value={crudForm.attributes.portion_size || 'Pouch 250 gr'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Kapasitas Olah / Takaran Masak</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Cukup untuk 1 kg daging / 4-6 porsi masakan"
                                value={crudForm.attributes.serving_capacity || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, serving_capacity: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Masa Simpan (Exp Date) *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 12 Bulan (Setelah dibuka simpan di kulkas)"
                                required
                                value={crudForm.attributes.expired_info || '12 Bulan'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Anjuran Suhu Simpan *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.storage_temp || 'Suhu Ruang (Kulkas setelah buka)'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, storage_temp: e.target.value } })}
                              >
                                <option value="Suhu Ruang (Kulkas setelah buka)">Suhu Ruang (Kulkas stlh buka)</option>
                                <option value="Suhu Ruang">Suhu Ruang (Kering &amp; Sejuk)</option>
                                <option value="Wajib Kulkas / Chiller">Wajib Kulkas / Chiller</option>
                                <option value="Freezer (Beku)">Freezer (Beku)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Izin Edar &amp; Legalitas *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Dinkes P-IRT">Dinkes P-IRT</option>
                                <option value="BPOM & Halal">Izin BPOM &amp; Halal</option>
                                <option value="Tradisional / Alami">Resep Tradisional / Alami</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 7: Katering & Paket Pesanan */}
                      {activeCulinaryType === 'Katering & Paket Pesanan' && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Minimal Pemesanan / Kapasitas *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Minimal 20 Box / Tampah 15 Porsi / Paket 5 Hari"
                                required
                                value={crudForm.attributes.min_order || 'Minimal 20 Box'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, min_order: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Batas Waktu Pre-Order (PO) *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Pemesanan Minimal H-2 Sebelum Acara"
                                required
                                value={crudForm.attributes.prep_time || 'Pre-Order H-2'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, prep_time: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Komposisi Menu Paket *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Nasi Gurih + Ayam Bakar Madu + Sambal Goreng Ati + Urap + Kerupuk"
                                required
                                value={crudForm.attributes.inclusions || ''}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, inclusions: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Layanan Pengantaran *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.delivery_service || 'Mobil Antar Toko / Kurir Khusus'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, delivery_service: e.target.value } })}
                              >
                                <option value="Mobil Antar Toko / Kurir Khusus">Mobil Antar Toko / Kurir Khusus</option>
                                <option value="Bisa Diambil Sendiri (Self Pickup)">Bisa Diambil Sendiri (Self Pickup)</option>
                                <option value="Kurir Instan Car (GrabExpress/Gocar)">Kurir Instan Car (Grab/Gojek)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sertifikasi *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi</option>
                                <option value="Laik Higiene Sanitasi">Sertifikat Laik Higiene Sanitasi</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SUB-FORM 8: Lainnya */}
                      {(activeCulinaryType === 'Lainnya' || !['Makanan Siap Santap', 'Makanan Beku & Olahan (Frozen)', 'Minuman & Olahan Kopi', 'Camilan, Snack & Kue Kering', 'Bakery, Roti & Pastry', 'Bumbu & Bahan Masak', 'Katering & Paket Pesanan'].includes(activeCulinaryType)) && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Porsi / Isi Bersih Kemasan *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: 1 Unit / Pack / Box"
                                required
                                value={crudForm.attributes.portion_size || '1 Unit'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, portion_size: e.target.value } })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Masa Simpan / Kadaluwarsa *</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Contoh: Sesuai Kemasan / Fresh Daily"
                                required
                                value={crudForm.attributes.expired_info || 'Sesuai Kemasan'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, expired_info: e.target.value } })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Suhu &amp; Saran Penyimpanan *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.storage_temp || 'Suhu Ruang'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, storage_temp: e.target.value } })}
                              >
                                <option value="Suhu Ruang">Suhu Ruang (Kering &amp; Sejuk)</option>
                                <option value="Dingin (Chiller)">Dingin (Kulkas / Chiller 4°C)</option>
                                <option value="Beku (Freezer)">Beku (Freezer -18°C)</option>
                                <option value="Fleksibel">Fleksibel / Sesuai Kemasan</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sertifikasi &amp; Legalitas *</label>
                              <select 
                                className="form-select"
                                value={crudForm.attributes.certification || '100% Halal'}
                                onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, certification: e.target.value } })}
                              >
                                <option value="100% Halal">100% Halal</option>
                                <option value="Sertifikat Halal Resmi">Sertifikat Halal Resmi</option>
                                <option value="BPOM / P-IRT">Izin BPOM / P-IRT</option>
                                <option value="Homemade / Segar">Homemade / Segar</option>
                                <option value="Non-Halal">Non-Halal</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })()}

                  {/* Multi-image section */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {typeConfig.photoLabel}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                          {typeConfig.photoHelper}
                        </p>
                      </div>
                      {crudImages.length < 5 && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '0.35rem' }}
                          onClick={() => setCrudImages([...crudImages, ''])}
                        >
                          + Tambah Foto
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {crudImages.map((imgUrl, index) => (
                        <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--card-bg-gradient)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                          {/* Preview Thumbnail */}
                          <div style={{ width: '54px', height: '54px', borderRadius: '0.4rem', overflow: 'hidden', border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }} />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <Image size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: '0.58rem', color: 'var(--btn-secondary-text)', fontWeight: 700 }}>Foto</span>
                              </div>
                            )}
                            {uploadingIndex === index && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader className="animate-spin" size={14} style={{ color: 'var(--primary)' }} />
                              </div>
                            )}
                          </div>

                          {/* Input & Upload Controls */}
                          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder={`Tautan Foto ${index === 0 ? 'Utama (Wajib) *' : `${index + 1} (Opsional)`}`}
                                value={imgUrl}
                                onChange={(e) => {
                                  const newImages = [...crudImages]
                                  newImages[index] = e.target.value
                                  setCrudImages(newImages)
                                }}
                                required={index === 0}
                                style={{ height: '38px', fontSize: '0.85rem' }}
                              />
                              
                              {/* Device File Upload Button */}
                              <label className="btn-secondary" style={{ padding: '0.5rem 0.85rem', height: '38px', borderRadius: '0.35rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <Upload size={14} />
                                Upload File
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleImageUpload(index, e.target.files[0])
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          {/* Delete Row Button */}
                          {crudImages.length > 1 && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger-border)', height: '38px', borderRadius: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => {
                                const newImages = crudImages.filter((_, i) => i !== index)
                                setCrudImages(newImages)
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Video URL */}
                  <div className="form-group">
                    <label className="form-label">{typeConfig.videoLabel}</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      placeholder={typeConfig.videoPlaceholder}
                      value={crudForm.video_url}
                      onChange={(e) => setCrudForm({ ...crudForm, video_url: e.target.value })}
                    />
                  </div>

                  {/* Unified Pengiriman & Ketentuan Packing */}
                  {typeConfig.warrantyLabel ? (
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">{typeConfig.deliveryTermsLabel}</label>
                        <textarea 
                          rows={2} 
                          className="form-textarea" 
                          placeholder={typeConfig.deliveryTermsPlaceholder}
                          value={crudForm.shipping_terms}
                          onChange={(e) => setCrudForm({ ...crudForm, shipping_terms: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{typeConfig.warrantyLabel}</label>
                        <textarea 
                          rows={2} 
                          className="form-textarea" 
                          placeholder={typeConfig.warrantyPlaceholder}
                          value={crudForm.warranty_info}
                          onChange={(e) => setCrudForm({ ...crudForm, warranty_info: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">{typeConfig.deliveryTermsLabel}</label>
                      <textarea 
                        rows={2} 
                        className="form-textarea" 
                        placeholder={typeConfig.deliveryTermsPlaceholder}
                        value={crudForm.shipping_terms}
                        onChange={(e) => setCrudForm({ ...crudForm, shipping_terms: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Link Pembelian Marketplace (Opsional) */}
                  <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.03em', textTransform: 'uppercase', opacity: 0.85 }}>
                        Link Marketplace / Alternatif Pesanan (Opsional)
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = [...crudForm.purchase_links, { platform: '', url: '' }]
                          setCrudForm({ ...crudForm, purchase_links: newLinks })
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: 'var(--primary)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Tambah Link
                      </button>
                    </div>

                    {crudForm.purchase_links.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem 0', fontStyle: 'italic' }}>
                        Belum ada link marketplace. Klik "Tambah Link" untuk menyertakan tautan Shopee, Tokopedia, dll.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                        {crudForm.purchase_links.map((link, index) => (
                          <div 
                            key={index} 
                            style={{ 
                              padding: '0.85rem', 
                              border: '1px solid var(--border-light)', 
                              borderRadius: '0.5rem', 
                              backgroundColor: 'rgba(255,255,255,0.02)',
                              position: 'relative'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const newLinks = crudForm.purchase_links.filter((_, idx) => idx !== index)
                                setCrudForm({ ...crudForm, purchase_links: newLinks })
                              }}
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '0.25rem'
                              }}
                              title="Hapus Link"
                            >
                              <Trash2 size={14} />
                            </button>
                            
                            <div className="form-group" style={{ marginBottom: '0.6rem', width: '85%' }}>
                              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>Platform / Toko *</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Shopee / Tokopedia / Website"
                                required
                                value={link.platform}
                                onChange={(e) => {
                                  const newLinks = [...crudForm.purchase_links]
                                  newLinks[index].platform = e.target.value
                                  setCrudForm({ ...crudForm, purchase_links: newLinks })
                                }}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.55rem' }}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>URL Link Pembelian *</label>
                              <input
                                type="url"
                                className="form-input"
                                placeholder="https://..."
                                required
                                value={link.url}
                                onChange={(e) => {
                                  const newLinks = [...crudForm.purchase_links]
                                  newLinks[index].url = e.target.value
                                  setCrudForm({ ...crudForm, purchase_links: newLinks })
                                }}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.55rem' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deskripsi */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{typeConfig.descLabel}</label>
                    <textarea 
                      rows={4} 
                      className="form-textarea" 
                      placeholder={typeConfig.descPlaceholder}
                      required={crudForm.product_type !== 'food'}
                      value={crudForm.description}
                      onChange={(e) => setCrudForm({ ...crudForm, description: e.target.value })}
                    />
                  </div>
                </form>
              </div>

              <div className="modal-cta-section" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowCrudModal(false)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  form="crud-form"
                  className="btn-primary"
                  disabled={crudLoading}
                  style={{ minWidth: '150px', justifyContent: 'center' }}
                >
                  {crudLoading ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Item'
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* LIGHTBOX OVERLAY WITH ZOOM & PAN */}
      {showLightbox && selectedFauna && (
        <div 
          className="modal-overlay" 
          style={{ background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', userSelect: 'none' }}
          onClick={() => setShowLightbox(false)}
        >
          {/* Close Button */}
          <button 
            className="modal-close-btn" 
            style={{ top: '1.5rem', right: '1.5rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', padding: '0.5rem', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} 
            onClick={() => setShowLightbox(false)}
          >
            <X size={20} />
          </button>

          {/* Top Control Bar */}
          <div style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1.25rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.1)', alignItems: 'center', zIndex: 3100 }} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setZoomScale(prev => Math.max(1, prev - 0.5))
                if (zoomScale <= 1.5) setPanPosition({ x: 0, y: 0 })
              }}
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Zoom: {zoomScale.toFixed(1)}x</span>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setZoomScale(prev => Math.min(4, prev + 0.5))
              }}
            >
              <ZoomIn size={16} />
            </button>
            <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }}></span>
            <span style={{ fontSize: '0.85rem', color: '#fff' }}>
              {(selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images))
                ? `${lightboxIndex + 1} / ${selectedFauna.detailed_info.images.length}`
                : '1 / 1'
              }
            </span>
          </div>

          {/* Main Visual Container */}
          <div 
            style={{ width: '80vw', height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
              <button
                type="button"
                style={{ position: 'absolute', left: '1rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const len = selectedFauna.detailed_info?.images?.length || 1
                  setLightboxIndex(prev => (prev - 1 + len) % len)
                  setZoomScale(1)
                  setPanPosition({ x: 0, y: 0 })
                }}
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Next Button */}
            {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
              <button
                type="button"
                style={{ position: 'absolute', right: '1rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const len = selectedFauna.detailed_info?.images?.length || 1
                  setLightboxIndex(prev => (prev + 1) % len)
                  setZoomScale(1)
                  setPanPosition({ x: 0, y: 0 })
                }}
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* The Zoomable/Pannable Image */}
            <div 
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                if (zoomScale > 1) {
                  setIsDragging(true)
                  setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y })
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && zoomScale > 1) {
                  setPanPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  })
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onDoubleClick={() => {
                if (zoomScale > 1) {
                  setZoomScale(1)
                  setPanPosition({ x: 0, y: 0 })
                } else {
                  setZoomScale(2.5)
                }
              }}
            >
              <img
                src={
                  (selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 0)
                    ? (selectedFauna.detailed_info.images[lightboxIndex] || selectedFauna.image_url)
                    : selectedFauna.image_url
                }
                alt={selectedFauna.name}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none'
                }}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                }}
              />
            </div>
          </div>

          {/* Bottom Thumbnails Strip */}
          {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '0.5rem', borderRadius: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
              {selectedFauna.detailed_info.images.map((imgUrl: string, idx: number) => (
                <img
                  key={idx}
                  src={imgUrl}
                  alt=""
                  onClick={() => {
                    setLightboxIndex(idx)
                    setZoomScale(1)
                    setPanPosition({ x: 0, y: 0 })
                  }}
                  style={{
                    width: '50px',
                    height: '50px',
                    objectFit: 'cover',
                    borderRadius: '0.25rem',
                    border: lightboxIndex === idx ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer'
                  }}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80';
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* IMAGE SETTINGS DIALOG MODAL */}
      {showImageSettingsModal && selectedEditorImage && (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
            <button 
              type="button" 
              className="modal-close-btn" 
              onClick={() => setShowImageSettingsModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Edit Gambar</h3>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Teks Alternatif (Alt Text - SEO) *</label>
              <input 
                type="text" 
                className="form-input" 
                value={imageAltText} 
                onChange={(e) => setImageAltText(e.target.value)} 
                placeholder="Deskripsi gambar untuk pencarian Google..." 
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Teks Judul / Keterangan (Title/Caption)</label>
              <input 
                type="text" 
                className="form-input" 
                value={imageCaptionText} 
                onChange={(e) => setImageCaptionText(e.target.value)} 
                placeholder="Judul atau caption melayang..." 
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Ukuran Gambar</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="radio" name="img-size" checked={imageSizeSelection === 'kecil'} onChange={() => setImageSizeSelection('kecil')} />
                  Kecil (150px)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="radio" name="img-size" checked={imageSizeSelection === 'sedang'} onChange={() => setImageSizeSelection('sedang')} />
                  Sedang (300px)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="radio" name="img-size" checked={imageSizeSelection === 'besar'} onChange={() => setImageSizeSelection('besar')} />
                  Besar (500px)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="radio" name="img-size" checked={imageSizeSelection === 'ekstrabesar'} onChange={() => setImageSizeSelection('ekstrabesar')} />
                  Ekstra Besar (800px)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="radio" name="img-size" checked={imageSizeSelection === 'asli'} onChange={() => setImageSizeSelection('asli')} />
                  Ukuran Asli (100%)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowImageSettingsModal(false)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => {
                  if (selectedEditorImage) {
                    selectedEditorImage.setAttribute('alt', imageAltText);
                    
                    if (imageSizeSelection === 'kecil') {
                      selectedEditorImage.style.width = '150px';
                      selectedEditorImage.style.maxWidth = '30%';
                    } else if (imageSizeSelection === 'sedang') {
                      selectedEditorImage.style.width = '300px';
                      selectedEditorImage.style.maxWidth = '60%';
                    } else if (imageSizeSelection === 'besar') {
                      selectedEditorImage.style.width = '500px';
                      selectedEditorImage.style.maxWidth = '80%';
                    } else if (imageSizeSelection === 'ekstrabesar') {
                      selectedEditorImage.style.width = '800px';
                      selectedEditorImage.style.maxWidth = '95%';
                    } else if (imageSizeSelection === 'asli') {
                      selectedEditorImage.style.width = '100%';
                      selectedEditorImage.style.maxWidth = '100%';
                    }
                    selectedEditorImage.style.height = 'auto';

                    const parent = selectedEditorImage.parentElement;
                    const isWrapped = parent && parent.classList.contains('img-caption-wrapper');

                    if (imageCaptionText.trim()) {
                      if (isWrapped) {
                        const capDiv = parent.querySelector('.img-caption-text') as HTMLElement;
                        if (capDiv) {
                          capDiv.innerText = imageCaptionText;
                        }
                        parent.style.width = selectedEditorImage.style.width;
                        parent.style.maxWidth = selectedEditorImage.style.maxWidth;
                      } else {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'img-caption-wrapper';
                        
                        wrapper.style.display = selectedEditorImage.style.display || 'block';
                        wrapper.style.float = selectedEditorImage.style.float || 'none';
                        wrapper.style.margin = selectedEditorImage.style.margin || '1rem auto';
                        wrapper.style.clear = selectedEditorImage.style.clear || 'both';
                        wrapper.style.width = selectedEditorImage.style.width;
                        wrapper.style.maxWidth = selectedEditorImage.style.maxWidth;
                        
                        selectedEditorImage.style.display = 'block';
                        selectedEditorImage.style.float = 'none';
                        selectedEditorImage.style.margin = '0 auto';
                        selectedEditorImage.style.clear = 'none';
                        
                        const capDiv = document.createElement('div');
                        capDiv.className = 'img-caption-text';
                        capDiv.innerText = imageCaptionText;
                        
                        selectedEditorImage.parentNode?.insertBefore(wrapper, selectedEditorImage);
                        wrapper.appendChild(selectedEditorImage);
                        wrapper.appendChild(capDiv);
                      }
                    } else {
                      if (isWrapped) {
                        const grandParent = parent.parentElement;
                        if (grandParent) {
                          selectedEditorImage.style.display = parent.style.display;
                          selectedEditorImage.style.float = parent.style.float;
                          selectedEditorImage.style.margin = parent.style.margin;
                          selectedEditorImage.style.clear = parent.style.clear;
                          
                          grandParent.insertBefore(selectedEditorImage, parent);
                          parent.remove();
                        }
                      }
                    }

                    handleVisualInput();
                    setShowImageSettingsModal(false);
                  }
                }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Perbarui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Glassmorphism Policy Modal Popup */}
      {activePolicyModal && policies[activePolicyModal] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.7)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 26, 0.98) 100%)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.95)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                  {policies[activePolicyModal].title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.6rem', borderRadius: '999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    Versi {policies[activePolicyModal].version}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Resmi • PT Catavor Media Digital
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActivePolicyModal(null)} 
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.75rem 1.5rem', overflowY: 'auto', flex: 1, color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {policies[activePolicyModal].content}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.95)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Perlindungan Data & UU PDP Compliant
              </span>
              <button 
                type="button"
                className="btn-primary" 
                onClick={() => setActivePolicyModal(null)} 
                style={{ padding: '0.5rem 1.35rem', fontSize: '0.82rem', borderRadius: '0.5rem' }}
              >
                Tutup & Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK POLICY POPOVER MODAL FOR FORMS */}
      {showQuickPolicyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowQuickPolicyModal(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                  {showQuickPolicyModal === 'terms' ? 'Syarat & Ketentuan' : showQuickPolicyModal === 'privacy' ? 'Kebijakan Privasi' : 'Ketentuan Penggunaan'}
                </span>
              </div>
              <button type="button" onClick={() => setShowQuickPolicyModal(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {policies[showQuickPolicyModal]?.content || 'Memuat dokumen...'}
            </div>

            <button type="button" className="btn-primary btn-full" onClick={() => setShowQuickPolicyModal(null)} style={{ marginTop: '1.25rem', padding: '0.75rem', fontSize: '0.85rem', fontWeight: 800 }}>
              Saya Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {/* RENAME MASTER OPTION MODAL */}
      {renameMasterModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setRenameMasterModalData(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={20} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                  Ubah Nama {renameMasterModalData.fieldLabel}
                </span>
              </div>
              <button type="button" onClick={() => setRenameMasterModalData(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                Nama Saat Ini:
              </label>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: '0.88rem', fontWeight: 600, marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                {renameMasterModalData.oldValue}
              </div>

              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', display: 'block', marginBottom: '0.4rem' }}>
                Nama Baru:
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Masukkan nama baru..." 
                value={renameMasterModalData.newValue} 
                onChange={(e) => setRenameMasterModalData({ ...renameMasterModalData, newValue: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameMasterOption(renameMasterModalData.field, renameMasterModalData.oldValue, renameMasterModalData.newValue);
                  }
                }}
                autoFocus
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem', borderRadius: '0.6rem' }}
              />
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
              <Info size={16} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#93c5fd', lineHeight: 1.4 }}>
                Perubahan nama ini akan otomatis disinkronkan ke seluruh item katalog yang menggunakan opsi ini secara aman.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setRenameMasterModalData(null)} style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}>
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={crudLoading || !renameMasterModalData.newValue.trim()} 
                onClick={() => handleRenameMasterOption(renameMasterModalData.field, renameMasterModalData.oldValue, renameMasterModalData.newValue)}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 800 }}
              >
                {crudLoading ? 'Menyimpan...' : 'Simpan Nama Baru'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRESET MASTER DATA CONFIRMATION MODAL */}
      {presetModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPresetModalData(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '520px', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                  Terapkan Template {presetModalData.title}
                </span>
              </div>
              <button type="button" onClick={() => setPresetModalData(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem', lineHeight: 1.5 }}>
              Template ini akan menyusun ulang opsi kategori toko bawaan sesuai dengan standar industri <strong>{presetModalData.title}</strong>:
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                Daftar Kategori yang Akan Dimuat:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {presetModalData.sampleCategories.map((cat, idx) => (
                  <span key={idx} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.6rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#6ee7b7', lineHeight: 1.4 }}>
                Item katalog yang sudah ada di toko Anda tidak akan dihapus atau hilang. Anda tetap dapat menambah atau mengubah kategori kapan saja.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setPresetModalData(null)} style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}>
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={crudLoading} 
                onClick={() => handleApplyPreset(presetModalData.key)}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 800 }}
              >
                {crudLoading ? 'Menerapkan...' : 'Terapkan Template Ini'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
