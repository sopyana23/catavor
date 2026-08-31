import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  Plus, 
  MapPin, 
  Info, 
  BookOpen, 
  Settings, 
  ShieldAlert,
  Trash2, 
  Edit3, 
  Loader,
  FileText,
  Lock,
  LogOut,
  Upload,
  Database,
  User,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle,
  X,
  Eye,
  ArrowLeft,
  Home,
  Sun,
  Moon,
  ShieldCheck,
  Shield,
  MessageCircle,
  Heart,
  Truck,
  Star,
  Compass,
  ShoppingCart,
  AlertTriangle,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Link as LinkIcon,
  Image,
  Clock,
  Heading,
  Share2,
  Sparkles,
  ArrowRight,
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
  CreditCard,
  QrCode,
  Copy,
  Download,
  Send,
  Bell,
  HelpCircle,
  Mail,
  ExternalLink,
  PhoneCall,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Filter,
  Palette,
  Package,
  FileCode,
  Wrench,
  RefreshCw,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  Briefcase,
  Sliders,
  Building2,
  Globe2,
  SlidersHorizontal,
  MessageSquareHeart,
  UserCheck,
  Scale,
  FileCheck,
  Wand2,
  BellRing,
  PackageCheck,
  BadgeCheck,
  LifeBuoy,
  Trees,
  Sunset,
  Waves,
  Flower2,
  ChevronUp,
  CheckCheck,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Columns,
  MoreVertical,
  MoreHorizontal,
  Flag,
  Award
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

function getCatalogItemUnit(item: any): string {
  if (!item) return 'Pcs';
  if (item.product_type === 'property') return 'Unit';
  if (item.product_type === 'food') return 'Porsi / Pack';
  if (item.product_type === 'service') return 'Sesi';
  if (item.product_type === 'digital') return 'Lisensi';
  if (item.product_type === 'physical') return 'Pcs';

  // For fauna or general showcase:
  const text = `${item.class || ''} ${item.name || ''} ${item.habitat || ''}`.toLowerCase();
  if (text.includes('tanaman') || text.includes('flora') || text.includes('plant') || text.includes('moss') || text.includes('anubias') || text.includes('buce')) {
    return 'Pot / Batang';
  }
  if (text.includes('aquascape') || text.includes('aquarium') || text.includes('tank') || text.includes('paket') || text.includes('set')) {
    return 'Set / Unit';
  }
  if (text.includes('aksesoris') || text.includes('pakan') || text.includes('filter') || text.includes('lampu') || text.includes('alat') || text.includes('pupuk') || text.includes('obat') || text.includes('batu') || text.includes('kayu') || text.includes('hardscape')) {
    return 'Pcs';
  }
  if (text.includes('reptil') || text.includes('ikan') || text.includes('fish') || text.includes('burung') || text.includes('bird') || text.includes('kucing') || text.includes('cat') || text.includes('anjing') || text.includes('dog') || text.includes('fauna') || text.includes('satwa') || text.includes('hewan') || text.includes('aves') || text.includes('mamalia') || text.includes('amfibi') || text.includes('tortoise') || text.includes('gecko') || text.includes('chinchilla') || text.includes('sugar glider')) {
    return 'Ekor';
  }
  return 'Unit';
}

export function isNonEmptyValue(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return !isNaN(val) && val > 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === '' || s === '-' || s === '--' || s === 'n/a' || s === 'na' || s === 'null' || s === 'undefined' || s === 'none' || s === '0' || s === '0 gram' || s === '0 porsi' || s === '0 sesi' || s === '0 lisensi' || s === '0 pack' || s === '0 porsi / pack' || s === '0 porsi/pack') {
      return false;
    }
    return true;
  }
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return false;
}

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

export type ItemCategoryType = 'physical' | 'digital' | 'fauna' | 'service' | 'food' | 'property';

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
  minOrderLabel?: string;
  minOrderPlaceholder?: string;
  maxOrderLabel?: string;
  maxOrderPlaceholder?: string;
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
    portionPlaceholder: '1 Unit / Pack / Box',
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
  property: ['Rumah Tinggal (Landed House)', 'Apartemen & Kondominium', 'Tanah & Kavling', 'Ruko & Komersial', 'Villa & Resort', 'Gudang & Pabrik', 'Kost & Kontrakan', 'Lainnya']
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
        descPlaceholder: 'Jelaskan detail spesifikasi bahan/material, dimensi ukuran, kelengkapan isi kemasan, dan fitur unggulan barang ini...',
        minOrderLabel: 'Minimal Beli (Pcs) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Transaksi (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
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
        categoryLabel: 'Kategori Item Digital *',
        defaultCategory: 'E-Book & Publikasi',
        categoryOptions: ['E-Book & Publikasi', 'Template & Dokumen', 'Desain Grafis & UI Kit', 'Source Code & Skrip', 'Audio, Musik & SFX', 'Preset, Filter & LUTs', 'Video & Aset 3D', 'Software & Tool', 'Kursus & Modul', 'Lainnya'],
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
        descPlaceholder: 'Jelaskan daftar isi bab/file yang didapat, software yang dibutuhkan untuk membuka file, dan manfaat materi digital ini...',
        minOrderLabel: 'Minimal Beli (Lisensi/Seat) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Akun (Opsional)',
        maxOrderPlaceholder: 'Kosongkan jika tanpa batas'
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
        descPlaceholder: 'Jelaskan riwayat kesehatan, pola makan, keaktifan, minus (jika ada), umur/size, dan petunjuk perawatan harian...',
        minOrderLabel: 'Minimal Beli (Ekor/Pack) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Beli per Kiriman (Opsional)',
        maxOrderPlaceholder: 'Contoh: 10 (Batas aman packing)'
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
        descLabel: 'Deskripsi & Detail Menu Kuliner *',
        descPlaceholder: 'Jelaskan porsi/takaran, varian rasa/level pedas, masa simpan, petunjuk penyajian/penyimpanan, dan detail lainnya...',
        minOrderLabel: 'Minimal Pesanan (Porsi/Pack) *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Pesanan per Order (Opsional)',
        maxOrderPlaceholder: 'Contoh: 50 (Batas kapasitas dapur)'
      };
    case 'property':
      return {
        type: 'property',
        typeName: 'Properti & Real Estate',
        badgeName: 'Properti & Real Estate',
        icon: Building2,
        color: '#0284c7',
        gradientBg: 'radial-gradient(circle at top left, rgba(2, 132, 199, 0.15) 0%, transparent 70%)',
        modalTitle: (mode) => mode === 'create' ? 'Tambah Listing Properti' : 'Edit Listing Properti',
        modalSubtitle: 'Lengkapi spesifikasi luas tanah/bangunan, legalitas SHM, kamar tidur, dan jadwal survey.',
        nameLabel: 'Judul / Nama Listing Properti *',
        namePlaceholder: 'Contoh: Rumah Cluster Minimalis 2 Lantai SHM Siap Huni di BSD City...',
        categoryLabel: 'Tipe / Jenis Properti *',
        defaultCategory: 'Rumah Tinggal (Landed House)',
        categoryOptions: [
          'Rumah Tinggal (Landed House)',
          'Apartemen & Kondominium',
          'Tanah & Kavling',
          'Ruko & Komersial',
          'Villa & Resort',
          'Gudang & Pabrik',
          'Kost & Kontrakan',
          'Lainnya'
        ],
        priceLabel: 'Harga Properti (IDR) *',
        pricePlaceholder: 'Contoh: 850.000.000 (Jual) / 35.000.000 (Sewa/Tahun)',
        photoLabel: 'Foto Properti & Interior (1-5 Foto) *',
        photoHelper: 'Unggah 1 hingga 5 foto fasad depan, ruang keluarga, kamar tidur, dapur, dan lingkungan.',
        videoLabel: 'Video Virtual Tour Properti (YouTube URL - Opsional)',
        videoPlaceholder: 'Contoh: https://www.youtube.com/watch?v=...',
        deliveryLabel: 'Akses & Ketentuan Booking / Survey Lokasi',
        deliveryOptions: [
          'Jadwalkan Survey via WhatsApp',
          'Siap Huni (Ready Unit)',
          'Pre-Launch / Indent',
          'Disewakan (Bulanan / Tahunan)',
          'Cash Keras / KPR Bank'
        ],
        deliveryTermsLabel: 'Akses & Ketentuan Booking / Survey Lokasi',
        deliveryTermsPlaceholder: 'Contoh: Layanan survey lokasi dibuka setiap hari pukul 09:00 - 17:00 WIB (konfirmasi H-1). Akses jalan lebar 2 mobil, bebas banjir, 5 menit ke gerbang tol...',
        warrantyLabel: 'Legalitas & Kelengkapan Dokumen',
        warrantyPlaceholder: 'Contoh: Sertifikat Hak Milik (SHM) on hand, IMB/PBG lengkap, PBB lunas. Pembayaran bisa Cash Keras, Cash Bertahap, atau KPR Bank (dibantu hingga akad)...',
        descLabel: 'Deskripsi Lengkap & Keunggulan Properti *',
        descPlaceholder: 'Jelaskan fasilitas cluster (one gate, security 24 jam), akses transportasi terdekat (stasiun/tol), spesifikasi pondasi/kusen, dan nilai investasi properti ini...',
        minOrderLabel: 'Minimal Unit *',
        minOrderPlaceholder: '1',
        maxOrderLabel: 'Maksimal Unit per Pembeli (Opsional)',
        maxOrderPlaceholder: '1'
      };
  }
}

export const getInitialCrudForm = (type: ItemCategoryType = 'physical') => {
  const typeConfig = getItemTypeFormConfig(type);

  return {
    name: '',
    scientific_name: '',
    class: typeConfig.defaultCategory,
    habitat: 'General',
    diet: '',
    conservation_status: 'Tersedia',
    price: 0,
    min_order: 1,
    max_order: '' as string | number,
    video_url: '',
    is_shipping_available: true,
    description: '',
    image_url: '',
    native_region: '',
    lifespan: '',
    weight: '',
    shipping_terms: '',
    warranty_info: '',
    shipping_coverage: typeConfig.deliveryOptions[0] || 'Bisa Kirim se-Indonesia',
    purchase_links: [] as { platform: string, url: string }[],
    enable_wa_rekber: true,
    enable_wa_direct: true,
    product_type: type,
    attributes: {
      condition: 'Baru' as 'Baru' | 'Bekas' | 'Refurbished',
      weight: 100,
      brand: '',
      variant: '',
      file_format: 'PDF',
      file_size: '10 MB',
      license_type: 'Lisensi Personal',
      duration: '1 Sesi / 1 Jam',
      service_location: 'Datang ke Toko',
      service_area: 'Jabodetabek',
      transaction_type: 'Dijual' as 'Dijual' | 'Disewakan (Tahunan)' | 'Disewakan (Bulanan)',
      certificate: 'SHM (Sertifikat Hak Milik)',
      land_area: '120',
      building_area: '90',
      bedrooms: 3,
      bathrooms: 2,
      floors: '2 Lantai',
      electricity: '2200 VA',
      water_source: 'PDAM & Sumur Bor',
      furnishing: 'Semi-Furnished',
      carport: '1 Mobil',
      facing: 'Timur',
      property_location: 'BSD City, Tangerang Selatan',
      facilities: 'One Gate System, Keamanan 24 Jam, Taman Bermain, Akses Jalan 2 Mobil',
      halal_status: 'Bersertifikat Halal Resmi (BPJPH / MUI)'
    }
  };
};

interface Fauna {
  id: number
  name: string
  scientific_name: string
  class: string
  habitat: string
  diet: string
  conservation_status: string
  price: number
  min_order?: number
  max_order?: number | null
  video_url: string | null
  is_shipping_available: boolean
  description: string
  image_url: string
  product_type?: ItemCategoryType
  attributes?: {
    condition?: string
    weight?: number
    brand?: string
    variant?: string
    file_format?: string
    file_size?: string
    license_type?: string
    duration?: string
    service_location?: string
    service_area?: string
    transaction_type?: string
    certificate?: string
    land_area?: string | number
    building_area?: string | number
    bedrooms?: number
    bathrooms?: number
    floors?: string | number
    electricity?: string
    water_source?: string
    furnishing?: string
    carport?: string
    facing?: string
    property_location?: string
    facilities?: string
    halal_status?: string
    enable_wa_rekber?: boolean
    enable_wa_direct?: boolean
    [key: string]: any
  }
  detailed_info?: {
    native_region?: string
    lifespan?: string
    weight?: string
    shipping_terms?: string
    warranty_info?: string
    shipping_coverage?: string
    images?: string[]
    purchase_links?: Array<{ platform: string, url: string }>
    enable_wa_rekber?: boolean
    enable_wa_direct?: boolean
    [key: string]: any
  }
}

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

// Helper for adaptive mobile header scale based on title length
const getMobileHeaderScale = (titleStr: string) => {
  const len = titleStr.trim().length
  if (len <= 10) {
    return { titleFontSize: '1.5rem', iconSize: 32, badgeFontSize: '0.65rem', gap: '0.5rem' }
  } else if (len <= 20) {
    return { titleFontSize: '1.25rem', iconSize: 26, badgeFontSize: '0.58rem', gap: '0.4rem' }
  } else {
    return { titleFontSize: '1.05rem', iconSize: 22, badgeFontSize: '0.5rem', gap: '0.3rem' }
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

export const FormattedText: React.FC<{ text?: string; style?: React.CSSProperties; className?: string }> = ({ text, style, className }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const renderInlineMarkdown = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let idx = 0;
    const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|__(.*?)__|_(.*?)_|`(.*?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      if (match[2] !== undefined) {
        parts.push(<strong key={`b-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{match[2]}</strong>);
      } else if (match[4] !== undefined) {
        parts.push(<strong key={`b2-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{match[4]}</strong>);
      } else if (match[3] !== undefined) {
        parts.push(<em key={`i-${idx++}`}>{match[3]}</em>);
      } else if (match[5] !== undefined) {
        parts.push(<em key={`i2-${idx++}`}>{match[5]}</em>);
      } else if (match[6] !== undefined) {
        parts.push(
          <code key={`c-${idx++}`} style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.9em', color: 'var(--primary)' }}>
            {match[6]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  const flushList = (key: number) => {
    if (!currentList) return null;
    const isUl = currentList.type === 'ul';
    const listNode = isUl ? (
      <ul key={`list-${key}`} style={{ paddingLeft: '1.25rem', margin: '0.35rem 0 0.5rem 0', listStyleType: 'disc' }}>
        {currentList.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    ) : (
      <ol key={`list-${key}`} style={{ paddingLeft: '1.25rem', margin: '0.35rem 0 0.5rem 0' }}>
        {currentList.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    currentList = null;
    return listNode;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[ ] ')) {
      const isChecked = trimmed.includes('[x]') || trimmed.includes('[X]');
      const itemText = trimmed.replace(/^[-*•]?\s*\[[ xX]\]\s+/, '');
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);
      elements.push(
        <div key={`check-${lineIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.18rem 0', paddingLeft: '0.15rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            border: isChecked ? 'none' : '1.5px solid var(--border-hover, #64748b)',
            backgroundColor: isChecked ? 'var(--primary)' : 'transparent',
            color: '#ffffff',
            fontSize: '9px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            {isChecked ? '✓' : ''}
          </span>
          <span style={{ textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '0.88rem' }}>
            {renderInlineMarkdown(itemText)}
          </span>
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      if (!currentList || currentList.type !== 'ul') {
        const flushed = flushList(lineIdx);
        if (flushed) elements.push(flushed);
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      if (!currentList || currentList.type !== 'ol') {
        const flushed = flushList(lineIdx);
        if (flushed) elements.push(flushed);
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
    } else {
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);

      if (!trimmed) {
        elements.push(<div key={`empty-${lineIdx}`} style={{ height: '0.45rem' }} />);
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={`h4-${lineIdx}`} style={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.55rem 0 0.18rem 0', color: 'var(--text-muted, #94a3b8)' }}>
            {renderInlineMarkdown(trimmed.replace(/^####\s+/, ''))}
          </h5>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${lineIdx}`} style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0.7rem 0 0.2rem 0', color: 'var(--primary-hover, #60a5fa)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {renderInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${lineIdx}`} style={{ fontSize: '1.12rem', fontWeight: 800, margin: '0.95rem 0 0.3rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '-0.01em' }}>
            <span style={{ width: '3px', height: '13px', borderRadius: '2px', background: 'var(--primary)', flexShrink: 0, display: 'inline-block' }} />
            <span>{renderInlineMarkdown(trimmed.replace(/^##\s+/, ''))}</span>
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h1-${lineIdx}`} style={{ fontSize: '1.25rem', fontWeight: 800, margin: '1.1rem 0 0.35rem 0', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.3rem', letterSpacing: '-0.01em' }}>
            {renderInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
          </h2>
        );
      } else {
        elements.push(
          <div key={`p-${lineIdx}`} style={{ lineHeight: '1.55', marginBottom: '0.15rem' }}>
            {renderInlineMarkdown(line)}
          </div>
        );
      }
    }
  });

  const finalFlush = flushList(lines.length);
  if (finalFlush) elements.push(finalFlush);

  return (
    <div style={{ wordBreak: 'break-word', ...style }} className={className}>
      {elements}
    </div>
  );
};

export const ProductDescriptionView: React.FC<{ description?: string; isMobile?: boolean; title?: string }> = ({ description, isMobile = true, title }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isNonEmptyValue(description)) return null;

  const cleanDesc = description!.trim();
  const isLong = cleanDesc.length > 180 || cleanDesc.split('\n').length > 3;

  return (
    <div style={{
      padding: isMobile ? '1rem' : '1.25rem 0',
      borderBottom: '1px solid var(--border-light)',
      marginBottom: isMobile ? 0 : '1.5rem'
    }}>
      <h3 style={{
        fontSize: isMobile ? '0.95rem' : '1.05rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.65rem',
        letterSpacing: '-0.01em'
      }}>
        {title || 'Deskripsi'}
      </h3>
      
      <div style={{
        position: 'relative',
        lineHeight: isMobile ? '1.6' : '1.7',
        fontSize: isMobile ? '0.86rem' : '0.925rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{
          display: (!isExpanded && isLong) ? '-webkit-box' : 'block',
          WebkitLineClamp: (!isExpanded && isLong) ? (isMobile ? 3 : 4) : undefined,
          WebkitBoxOrient: 'vertical',
          overflow: (!isExpanded && isLong) ? 'hidden' : 'visible',
          textOverflow: 'ellipsis'
        }}>
          <FormattedText 
            text={cleanDesc} 
            style={{
              fontSize: 'inherit',
              color: 'inherit',
              lineHeight: 'inherit'
            }} 
          />
        </div>
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--primary)',
            fontSize: isMobile ? '0.82rem' : '0.86rem',
            fontWeight: 700,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem 0 0.1rem',
            marginTop: '0.2rem'
          }}
        >
          <span>{isExpanded ? 'Sembunyikan' : 'Lihat Selengkapnya'}</span>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
    </div>
  );
};

export const ProductImportantInfoSection: React.FC<{ item: any; isMobile?: boolean }> = ({ item, isMobile = true }) => {
  if (!item) return null;
  const pType = item.product_type || 'fauna';
  const [isExpanded, setIsExpanded] = useState(false);

  const infoItems = useMemo(() => {
    const list: {
      id: string;
      label: string;
      fullTitle: string;
      icon: any;
      content: string;
    }[] = [];

    // 1. Ketentuan Pengiriman / SOP / Akses File / Ketentuan Layanan / Akses & Survey Properti
    const shippingTerms = (item.detailed_info?.shipping_terms || '').trim();
    if (isNonEmptyValue(shippingTerms) || pType === 'digital' || pType === 'service' || pType === 'property' || pType === 'food') {
      let label = 'Ketentuan Pengiriman';
      let fullTitle = 'Ketentuan Pengiriman & Logistik';
      let icon = Truck;
      let content = shippingTerms;

      if (pType === 'property') {
        label = 'Akses & Survey';
        fullTitle = 'Akses & Ketentuan Booking / Survey Lokasi';
        icon = MapPin;
        if (!content) {
          content = 'Jadwal kunjungan dan survey unit dapat dikoordinasikan langsung bersama agen/pemilik melalui kontak WhatsApp yang tersedia.';
        }
      } else if (pType === 'fauna') {
        label = 'Pengiriman Satwa';
        fullTitle = 'Pengiriman & Garansi Live Arrival';
        icon = Truck;
      } else if (pType === 'service') {
        label = 'Area & Ketentuan';
        fullTitle = 'Area Layanan & Ketentuan Reservasi';
        icon = Calendar;
        if (!content) {
          content = 'Layanan pengerjaan dilaksanakan sesuai dengan jadwal reservasi dan jangkauan wilayah operasional yang disepakati.';
        }
      } else if (pType === 'digital') {
        label = 'Akses File';
        fullTitle = 'Pengiriman & Panduan Akses File';
        icon = Download;
        if (!content) {
          content = 'Tautan unduhan berkas digital akan langsung aktif atau dikirimkan secara instan setelah pesanan berhasil terverifikasi.';
        }
      } else if (pType === 'food') {
        label = 'Pengiriman & Kemasan';
        fullTitle = 'Pengiriman & Ketentuan Kemasan (F&B)';
        icon = Truck;
        if (!content) {
          content = 'Pesanan dikemas rapi dan higienis dengan kemasan food-grade. Untuk pengiriman instan/sameday menggunakan kurir Gojek/Grab/Maxim, dan untuk produk frozen/tahan lama menggunakan ekspedisi khusus / Next Day.';
        }
      } else if (pType === 'physical') {
        label = 'Pengiriman';
        fullTitle = 'Ketentuan Pengiriman & Ekspedisi';
        icon = Package;
      }

      list.push({ id: 'shipping_terms', label, fullTitle, icon, content });
    }

    // 2. Garansi / Kebijakan Toko / Lisensi / DOA / Legalitas Dokumen Properti (Kecuali Service yang tidak memiliki form garansi)
    const warrantyInfo = (item.detailed_info?.warranty_info || '').trim();
    const hasWarranty = pType !== 'service' && (isNonEmptyValue(warrantyInfo) || (pType === 'digital' && isNonEmptyValue(item.attributes?.license_type)) || pType === 'property');
    if (hasWarranty) {
      let label = 'Kebijakan Garansi';
      let fullTitle = 'Kebijakan Garansi & Klaim';
      let icon = ShieldCheck;
      let content = warrantyInfo;

      if (pType === 'property') {
        label = 'Legalitas Dokumen';
        fullTitle = 'Legalitas & Kelengkapan Dokumen';
        icon = FileCheck;
        if (!content) {
          content = 'Legalitas properti dan keabsahan berkas (Sertifikat SHM/HGB, IMB/PBG, PBB) siap diverifikasi bersama notaris/PPAT yang ditunjuk.';
        }
      } else if (pType === 'fauna') {
        label = 'Garansi D.O.A';
        fullTitle = 'Ketentuan Garansi D.O.A (Dead On Arrival)';
        icon = Heart;
      } else if (pType === 'digital') {
        label = 'Lisensi & Hak Cipta';
        fullTitle = 'Ketentuan Lisensi & Hak Cipta';
        icon = FileCheck;
        if (!content) {
          content = `Item digital ini dilindungi oleh hak cipta dan diberikan dengan ketentuan **${item.attributes?.license_type || 'Lisensi Standar'}**.\n\n- Penggunaan hak akses disesuaikan dengan izin lisensi yang dipilih.\n- Dilarang keras membagikan ulang, menjual kembali, atau mendistribusikan berkas tanpa izin pemilik hak cipta.`;
        }
      } else if (pType === 'food') {
        label = 'Jaminan Simpan';
        fullTitle = 'Petunjuk Penyimpanan & Jaminan Kesegaran';
        icon = ShieldCheck;
      }

      list.push({ id: 'warranty_info', label, fullTitle, icon, content });
    }

    return list;
  }, [item, pType]);

  const [activeTabId, setActiveTabId] = useState<string>(() => infoItems[0]?.id || '');

  useEffect(() => {
    if (infoItems.length > 0 && !infoItems.some(it => it.id === activeTabId)) {
      setActiveTabId(infoItems[0].id);
    }
  }, [infoItems, activeTabId]);

  if (infoItems.length === 0) return null;

  const currentItem = infoItems.find(it => it.id === activeTabId) || infoItems[0];
  const hasMultiple = infoItems.length > 1;

  // Clean redundant leading markdown header that matches or duplicates the card title
  const cleanContent = useMemo(() => {
    if (!currentItem?.content) return '';
    let text = currentItem.content.trim();
    const lines = text.split('\n');
    if (lines.length > 0 && /^#{1,4}\s+/.test(lines[0])) {
      const headingRaw = lines[0].replace(/^#{1,4}\s+/, '').trim().toLowerCase();
      const titleLower = (currentItem.fullTitle || '').toLowerCase();
      const labelLower = (currentItem.label || '').toLowerCase();
      if (
        titleLower.includes(headingRaw) ||
        headingRaw.includes(titleLower) ||
        headingRaw.includes(labelLower) ||
        headingRaw.includes('prosedur') ||
        headingRaw.includes('reservasi') ||
        headingRaw.includes('layanan') ||
        headingRaw.includes('ketentuan') ||
        headingRaw.includes('panduan') ||
        headingRaw.includes('jaminan') ||
        headingRaw.includes('standar') ||
        headingRaw.includes('syarat') ||
        headingRaw.includes('garansi') ||
        headingRaw.includes('pengiriman')
      ) {
        text = lines.slice(1).join('\n').trim();
      }
    }
    return text;
  }, [currentItem]);

  const isLong = cleanContent.length > 200 || cleanContent.split('\n').length > 3;

  return (
    <div style={{
      padding: isMobile ? '1rem' : '1.25rem 0',
      borderBottom: '1px solid var(--border-light)',
      marginBottom: isMobile ? 0 : '1.5rem'
    }}>
      {/* Section Title */}
      <h3 style={{
        fontSize: isMobile ? '0.95rem' : '1.05rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.65rem',
        letterSpacing: '-0.01em'
      }}>
        {hasMultiple ? 'Ketentuan & Garansi' : currentItem.fullTitle}
      </h3>

      {/* Tabs Pill Switcher (only rendered if 2+ tabs) */}
      {hasMultiple && (
        <div style={{
          display: 'flex',
          gap: '0.45rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          marginBottom: '0.75rem',
          scrollbarWidth: 'none'
        }}>
          {infoItems.map(info => {
            const IconComp = info.icon;
            const isActive = info.id === currentItem.id;
            return (
              <button
                key={info.id}
                type="button"
                onClick={() => {
                  setActiveTabId(info.id);
                  setIsExpanded(false);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: isMobile ? '0.38rem 0.85rem' : '0.42rem 0.95rem',
                  borderRadius: '0.5rem',
                  fontSize: isMobile ? '0.78rem' : '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  boxShadow: isActive ? '0 2px 8px rgba(var(--primary-rgb), 0.2)' : 'none',
                  flexShrink: 0
                }}
              >
                <IconComp size={13} style={{ color: isActive ? '#ffffff' : 'var(--primary)' }} />
                <span>{info.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Clean Container (matching Spesifikasi & Deskripsi styling) */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.75rem',
        padding: isMobile ? '0.85rem 1rem' : '0.9rem 1.25rem'
      }}>
        <div style={{
          position: 'relative',
          lineHeight: '1.65',
          fontSize: isMobile ? '0.82rem' : '0.88rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{
            display: (!isExpanded && isLong) ? '-webkit-box' : 'block',
            WebkitLineClamp: (!isExpanded && isLong) ? (isMobile ? 3 : 4) : undefined,
            WebkitBoxOrient: 'vertical',
            overflow: (!isExpanded && isLong) ? 'hidden' : 'visible',
            textOverflow: 'ellipsis'
          }}>
            <FormattedText 
              text={cleanContent} 
              style={{
                fontSize: 'inherit',
                color: 'inherit',
                lineHeight: 'inherit'
              }} 
            />
          </div>
        </div>

        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--primary)',
              fontSize: isMobile ? '0.78rem' : '0.84rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.45rem 0 0.1rem',
              marginTop: '0.2rem',
              transition: 'color 0.2s ease'
            }}
          >
            <span>{isExpanded ? 'Sembunyikan' : 'Lihat Selengkapnya'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export const HeadingDropdown: React.FC<{
  onSelect: (level: 1 | 2 | 3) => void;
  btnClassName?: string;
  isZen?: boolean;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignDirection, setAlignDirection] = useState<'left' | 'right'>('left');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuWidth = isZen ? 205 : 190;
      const spaceRight = window.innerWidth - rect.left;
      if (spaceRight < menuWidth + 12) {
        setAlignDirection('right');
      } else {
        setAlignDirection('left');
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isZen]);

  const handleSelect = (level: 1 | 2 | 3) => {
    onSelect(level);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', zIndex: isOpen ? 99999 : 1 }}>
      <button
        type="button"
        className={btnClassName}
        title="Pilih Ukuran Judul (Heading H1, H2, H3)"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOpen ? 'var(--primary-glow, rgba(59,130,246,0.15))' : undefined,
          borderColor: isOpen ? 'var(--primary)' : undefined,
          color: isOpen ? 'var(--primary)' : undefined
        }}
      >
        <span style={{ fontWeight: 700 }}>Judul</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            ...(alignDirection === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            zIndex: 999999,
            minWidth: isZen ? '205px' : '190px',
            maxWidth: 'calc(100vw - 20px)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.55rem',
            boxShadow: '0 14px 35px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.2)',
            padding: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={() => handleSelect(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.35rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)', width: '20px' }}>H1</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Judul Utama</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>#</code>
          </button>

          <button
            type="button"
            onClick={() => handleSelect(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.35rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)', width: '20px' }}>H2</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Judul Bab</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>##</code>
          </button>

          <button
            type="button"
            onClick={() => handleSelect(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.35rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary-hover, #60a5fa)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-hover, #60a5fa)', width: '20px' }}>H3</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Sub-Judul</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>###</code>
          </button>
        </div>
      )}
    </div>
  );
};

export const ListDropdown: React.FC<{
  onSelect: (type: 'bullet' | 'number') => void;
  btnClassName?: string;
  isZen?: boolean;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignDirection, setAlignDirection] = useState<'left' | 'right'>('left');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuWidth = isZen ? 205 : 190;
      const spaceRight = window.innerWidth - rect.left;
      if (spaceRight < menuWidth + 12) {
        setAlignDirection('right');
      } else {
        setAlignDirection('left');
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isZen]);

  const handleSelect = (type: 'bullet' | 'number') => {
    onSelect(type);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', zIndex: isOpen ? 99999 : 1 }}>
      <button
        type="button"
        className={btnClassName}
        title="Pilih Format Daftar (Daftar Poin, Nomor)"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOpen ? 'var(--primary-glow, rgba(59,130,246,0.15))' : undefined,
          borderColor: isOpen ? 'var(--primary)' : undefined,
          color: isOpen ? 'var(--primary)' : undefined
        }}
      >
        <span style={{ fontWeight: 700 }}>List</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            ...(alignDirection === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            zIndex: 999999,
            minWidth: isZen ? '205px' : '190px',
            maxWidth: 'calc(100vw - 20px)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.55rem',
            boxShadow: '0 14px 35px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.2)',
            padding: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={() => handleSelect('bullet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.35rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)', width: '20px', textAlign: 'center', lineHeight: 1 }}>•</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Daftar Poin</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>-</code>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('number')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.35rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)', width: '20px', textAlign: 'center' }}>1.</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Daftar Nomor</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>1.</code>
          </button>
        </div>
      )}
    </div>
  );
};

export interface RichTextareaProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const RichTextarea: React.FC<RichTextareaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
  className = "form-textarea",
  style
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(true);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Lock body scroll when Fullscreen is active
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        fullscreenTextareaRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isFullscreen]);

  const applyFormatToRef = (
    targetRef: React.RefObject<HTMLTextAreaElement | null>,
    prefix: string,
    suffix: string,
    defaultText: string
  ) => {
    const el = targetRef.current;
    const currentVal = value || '';
    if (!el) {
      onChange(currentVal + `${prefix}${defaultText}${suffix}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = currentVal.substring(start, end);

    // List & Checklist insertion logic
    if (prefix === '- ' || prefix === '1. ' || prefix === '- [ ] ') {
      const textBefore = currentVal.substring(0, start);
      const lastNewlineIdx = textBefore.lastIndexOf('\n');
      const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
      const lineText = currentVal.substring(lineStart, start);

      if (lineText.trim() === '') {
        const newText = currentVal.substring(0, lineStart) + prefix + currentVal.substring(start);
        onChange(newText);
        setTimeout(() => {
          el.focus();
          const newPos = lineStart + prefix.length;
          el.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      } else {
        const insertText = '\n' + prefix;
        const newText = currentVal.substring(0, start) + insertText + currentVal.substring(end);
        onChange(newText);
        setTimeout(() => {
          el.focus();
          const newPos = start + insertText.length;
          el.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }
    }

    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`;
    const newValue = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      const newCursor = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
      el.setSelectionRange(newCursor, newCursor + (selected ? 0 : defaultText.length));
    }, 0);
  };

  const handleKeyDownSmartList = (
    targetRef: React.RefObject<HTMLTextAreaElement | null>,
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter') {
      const el = targetRef.current;
      if (!el) return;

      const currentVal = value || '';
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const textBefore = currentVal.substring(0, start);
      const textAfter = currentVal.substring(end);

      const lastNewlineIdx = textBefore.lastIndexOf('\n');
      const currentLine = textBefore.substring(lastNewlineIdx + 1);

      const checklistMatch = currentLine.match(/^([-*•]?\s*\[[ xX]?\]\s+)(.*)$/);
      const bulletMatch = !checklistMatch ? currentLine.match(/^([-*•]\s+)(.*)$/) : null;
      const numberMatch = currentLine.match(/^(\d+)(\.\s+)(.*)$/);

      if (checklistMatch) {
        e.preventDefault();
        const content = checklistMatch[2];
        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextChecklist = '\n- [ ] ';
          const newText = textBefore + nextChecklist + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextChecklist.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        const content = bulletMatch[2];

        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextBullet = '\n' + prefix;
          const newText = textBefore + nextBullet + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextBullet.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else if (numberMatch) {
        e.preventDefault();
        const num = parseInt(numberMatch[1], 10);
        const dotSpace = numberMatch[2];
        const content = numberMatch[3];

        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextPrefix = `\n${num + 1}${dotSpace}`;
          const newText = textBefore + nextPrefix + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextPrefix.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
    }
  };

  const wordCount = (value || '').trim() ? (value || '').trim().split(/\s+/).length : 0;
  const charCount = (value || '').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%', ...style }}>
      {label && <label className="form-label" style={{ marginBottom: '0.1rem' }}>{label}</label>}
      
      {/* Inline Formatting Helper Toolbar */}
      <div className="rich-toolbar-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="rich-btn-format"
            title="Teks Tebal (Bold)"
            onClick={() => applyFormatToRef(textareaRef, '**', '**', 'teks tebal')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="rich-btn-format"
            title="Teks Miring (Italic)"
            onClick={() => applyFormatToRef(textareaRef, '*', '*', 'teks miring')}
          >
            <em>I</em>
          </button>
          <HeadingDropdown
            onSelect={(level) => {
              if (level === 1) applyFormatToRef(textareaRef, '\n# ', '\n', 'Judul Utama H1');
              else if (level === 2) applyFormatToRef(textareaRef, '\n## ', '\n', 'Judul Bab H2');
              else if (level === 3) applyFormatToRef(textareaRef, '\n### ', '\n', 'Sub Judul H3');
            }}
            btnClassName="rich-btn-format"
          />
          <ListDropdown
            onSelect={(type) => {
              if (type === 'bullet') applyFormatToRef(textareaRef, '- ', '', 'Poin list');
              else if (type === 'number') applyFormatToRef(textareaRef, '1. ', '', 'Langkah');
            }}
            btnClassName="rich-btn-format"
          />
        </div>

        {/* Fullscreen Button */}
        <button
          type="button"
          className="rich-btn-fullscreen"
          title="Buka Layar Penuh (Fullscreen Zen Mode)"
          onClick={() => setIsFullscreen(true)}
        >
          <Maximize2 size={12} /> Fullscreen
        </button>
      </div>

      {/* Actual Textarea */}
      <textarea
        ref={textareaRef}
        rows={rows}
        className={className}
        style={{
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          marginTop: 0,
          fontFamily: 'inherit',
          lineHeight: 1.6,
          fontSize: '0.88rem',
          resize: 'vertical',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          minHeight: `${Math.max(rows * 28 + 20, 100)}px`
        }}
        placeholder={placeholder}
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => handleKeyDownSmartList(textareaRef, e)}
      />

      {/* ==========================================================
          FULLSCREEN ZEN-MODE EDITOR OVERLAY (Standard UI/UX Mobile)
          ========================================================== */}
      {isFullscreen && (
        <div className="zen-fullscreen-overlay">
          {/* Mobile App Bar Header: Minimalist & Clean Bar */}
          <div className="zen-fullscreen-header-mobile">
            {/* Left: Title with Word Count Subtitle */}
            <div className="zen-mobile-title-col">
              <span className="zen-mobile-title">{label || 'Editor Teks'}</span>
              <span className="zen-mobile-subtitle">{wordCount} kata · {charCount} karakter</span>
            </div>

            {/* Right: Tab Switcher (Edit / Preview) */}
            <div className="zen-mobile-tab-switch">
              <button
                type="button"
                className={`zen-mobile-tab-btn ${mobileTab === 'editor' ? 'active' : 'inactive'}`}
                onClick={() => setMobileTab('editor')}
              >
                <Edit3 size={11} /> Edit
              </button>
              <button
                type="button"
                className={`zen-mobile-tab-btn ${mobileTab === 'preview' ? 'active' : 'inactive'}`}
                onClick={() => setMobileTab('preview')}
              >
                <Eye size={11} /> Preview
              </button>
            </div>
          </div>

          {/* Quick Formatting Toolbar: Horizontal Scrolling Bar (Only shown in Editor tab) */}
          {mobileTab === 'editor' && (
            <div className="zen-mobile-toolbar-bar">
              <button
                type="button"
                className="zen-mobile-toolbar-btn"
                title="Teks Tebal"
                onClick={() => applyFormatToRef(fullscreenTextareaRef, '**', '**', 'teks tebal')}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className="zen-mobile-toolbar-btn"
                title="Teks Miring"
                onClick={() => applyFormatToRef(fullscreenTextareaRef, '*', '*', 'teks miring')}
              >
                <em>I</em>
              </button>
              <HeadingDropdown
                onSelect={(level) => {
                  if (level === 1) applyFormatToRef(fullscreenTextareaRef, '\n# ', '\n', 'Judul Utama H1');
                  else if (level === 2) applyFormatToRef(fullscreenTextareaRef, '\n## ', '\n', 'Judul Bab H2');
                  else if (level === 3) applyFormatToRef(fullscreenTextareaRef, '\n### ', '\n', 'Sub Judul H3');
                }}
                btnClassName="zen-mobile-toolbar-btn"
                isZen
              />
              <ListDropdown
                onSelect={(type) => {
                  if (type === 'bullet') applyFormatToRef(fullscreenTextareaRef, '- ', '', 'Poin list');
                  else if (type === 'number') applyFormatToRef(fullscreenTextareaRef, '1. ', '', 'Langkah');
                }}
                btnClassName="zen-mobile-toolbar-btn"
                isZen
              />
            </div>
          )}

          {/* Mobile Fullscreen Body */}
          <div className="zen-fullscreen-body-mobile">
            {mobileTab === 'editor' ? (
              <div className="zen-mobile-textarea-wrap">
                <textarea
                  ref={fullscreenTextareaRef}
                  className="zen-mobile-textarea"
                  placeholder={placeholder || 'Tulis deskripsi atau konten lengkap di sini...'}
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => handleKeyDownSmartList(fullscreenTextareaRef, e)}
                />
              </div>
            ) : (
              <div className="zen-mobile-preview-wrap">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--border-light)'
                }}>
                  <Eye size={12} />
                  <span>Pratinjau Tampilan Konsumen (Live Preview)</span>
                </div>

                {(value || '').trim() ? (
                  <FormattedText
                    text={value}
                    style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: '1.7' }}
                  />
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    Belum ada teks yang ditulis. Ketik sesuatu di tab Edit untuk melihat hasil pratinjaunya secara rapi.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Footer Action Bar */}
          <div className="zen-mobile-footer-bar">
            <span className="zen-mobile-tip-text">
              💡 <strong>Tips:</strong> Enter lanjut list, Enter 2x keluar mode list.
            </span>
            <button
              type="button"
              className="zen-mobile-done-btn"
              onClick={() => setIsFullscreen(false)}
            >
              <Check size={14} /> Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const safeHref = (url?: string): string => {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return '#';
  }
  if (!trimmed.includes('://') && !lower.startsWith('mailto:') && !lower.startsWith('tel:') && !trimmed.startsWith('/') && !trimmed.startsWith('#')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
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
                padding: '0.75rem 0.95rem',
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
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--primary-glow)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--border-light)',
                  flexShrink: 0
                }}>
                  {renderSocialIcon(link.platform, 18, 'var(--primary)')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                    {link.platform}
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
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
                gap: '0.3rem', 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-glow)',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <span>Buka</span>
                <ExternalLink size={12} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

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
  default_is_comments_enabled?: string
  default_require_comment_approval?: string
  default_require_comment_email?: string
  default_verify_comment_email_domain?: string
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

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>/g, '')
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          background: 'var(--border-light)',
          border: 'none',
          borderRadius: '0.35rem',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          opacity: currentPage === 1 ? 0.4 : 1,
          transition: 'var(--transition-smooth)'
        }}
      >
        <ChevronLeft size={14} />
      </button>

      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          style={{
            border: page === currentPage ? '1px solid var(--primary)' : 'none',
            borderRadius: '0.35rem',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: page === currentPage ? 'var(--primary)' : 'var(--border-light)',
            color: page === currentPage ? '#000000' : 'var(--text-primary)',
            fontWeight: page === currentPage ? '800' : '500',
            fontSize: '0.75rem',
            cursor: 'pointer',
            boxShadow: page === currentPage ? '0 0 8px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          background: 'var(--border-light)',
          border: 'none',
          borderRadius: '0.35rem',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          opacity: currentPage === totalPages ? 0.4 : 1,
          transition: 'var(--transition-smooth)'
        }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

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
          padding: '0.85rem 1rem', 
          borderRadius: '0.75rem', 
          border: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card)', 
          textDecoration: 'none', 
          transition: 'var(--transition-smooth)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
          <MessageCircle size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, textAlign: 'left', minWidth: 0 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{c.label || 'WhatsApp Official'}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 800 }}>
            {formatPhoneNumber(c.number)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--primary)', color: '#ffffff', padding: '0.38rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 800, boxShadow: '0 2px 6px var(--primary-glow)', flexShrink: 0 }}>
          <span>Chat</span>
          <ChevronRight size={13} />
        </div>
      </a>
    );
  }

  return (
    <div style={{ 
      borderRadius: '0.85rem', 
      border: '1px solid var(--border-light)', 
      backgroundColor: 'var(--bg-card)', 
      padding: '1rem',
      boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem'
    }}>
      {/* Executive Header */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-light)', flexShrink: 0 }}>
            <MessageCircle size={17} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Kontak WhatsApp Official
            </h4>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Layanan Customer Service Resmi
            </p>
          </div>
        </div>
      </div>

      {/* Contacts List Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
                gap: '0.65rem',
                padding: '0.7rem 0.85rem',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 5px var(--primary)' }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {c.label || `CS ${idx + 1}`}
                  </span>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {formatPhoneNumber(c.number)}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                backgroundColor: 'var(--primary)', 
                color: '#ffffff', 
                padding: '0.35rem 0.75rem', 
                borderRadius: '0.5rem', 
                fontSize: '0.74rem', 
                fontWeight: 800, 
                boxShadow: '0 2px 6px var(--primary-glow)',
                flexShrink: 0 
              }}>
                <span>Chat</span>
                <ChevronRight size={12} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800 }}>
            Nomor WhatsApp Official &amp; CS *
          </label>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
            Kelola kontak CS resmi (Bisa tambahkan beberapa nomor)
          </span>
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--primary-glow)', padding: '0.2rem 0.55rem', borderRadius: '16px', border: '1px solid var(--border-light)', flexShrink: 0 }}>
          {localContacts.length} Nomor WA
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {localContacts.map((c, idx) => (
          <div 
            key={idx} 
            style={{ 
              padding: '0.85rem', 
              borderRadius: '0.75rem', 
              border: '1px solid var(--border-light)', 
              backgroundColor: 'var(--bg-card-hover)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)' }}>
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
                  borderRadius: '0.45rem',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
                title="Hapus kontak ini"
              >
                <Trash2 size={12} />
                <span>Hapus</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div>
                <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  Label CS (Misal: CS Penjualan / CS 2)
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="CS 1 • Penjualan"
                  value={c.label}
                  onChange={(e) => handleItemChange(idx, 'label', e.target.value)}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  Nomor WA (Contoh: 628123456789)
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="628123456789"
                  value={c.number}
                  onChange={(e) => handleItemChange(idx, 'number', e.target.value)}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {c.number.trim() && (
              <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--primary-glow)', padding: '0.3rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)', width: 'fit-content' }}>
                <Smartphone size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
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
          padding: '0.6rem 1rem',
          fontSize: '0.78rem',
          fontWeight: 800,
          borderRadius: '0.55rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          cursor: 'pointer',
          border: '1px dashed var(--primary)',
          color: 'var(--primary)',
          backgroundColor: 'var(--primary-glow)',
          width: '100%',
          marginTop: '0.2rem'
        }}
      >
        <Plus size={15} />
        <span>Tambah Nomor WhatsApp CS Baru</span>
      </button>
    </div>
  );
}

export function ShareCatalogCard({
  storeSlug,
  storeTitle,
  onOpenQRCode,
  onToast
}: {
  storeSlug: string;
  storeTitle?: string;
  onOpenQRCode: () => void;
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
    <div className="glass-panel" style={{ padding: '1.15rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '0.5rem', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)', flexShrink: 0 }}>
          <Share2 size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Bagikan Katalog Digital
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
            Bagikan via link langsung atau tampilkan QR Code katalog Anda
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary"
          style={{ padding: '0.55rem 0.6rem', fontSize: '0.76rem', fontWeight: 700, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
        >
          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
          <span>{copied ? 'Link Tersalin!' : 'Salin Link'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenQRCode}
          className="btn-primary"
          style={{ padding: '0.55rem 0.6rem', fontSize: '0.76rem', fontWeight: 800, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: 'pointer' }}
        >
          <QrCode size={14} />
          <span>Tampilkan QR Code</span>
        </button>
      </div>
    </div>
  );
}

export function QRCodeMobileSubPage({
  onBack,
  storeSlug,
  storeTitle,
  storeLogoUrl,
  storeSlogan,
  onToast
}: {
  onBack: () => void;
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

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(fullUrl)}&color=0b0e0c&bgcolor=ffffff&margin=12`;

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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0 1.25rem 0' }}>
      {/* Premium Pass Card */}
      <div 
        className="glass-panel" 
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-light)', 
          borderRadius: '1.25rem', 
          padding: '1.5rem 1.25rem', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1.1rem', 
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Store Logo & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.3rem' }}>
          {storeLogoUrl ? (
            <img 
              src={storeLogoUrl} 
              alt={storeTitle} 
              style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
            />
          ) : (
            <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', border: '1px solid var(--border-light)' }}>
              {(storeTitle || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
            {storeTitle || 'Katalog Digital'}
          </h3>
          {storeSlogan && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.35, maxWidth: '280px' }}>
              {storeSlogan}
            </span>
          )}
        </div>

        {/* QR Code Canvas Frame */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.85rem', backgroundColor: '#ffffff', borderRadius: '0.9rem', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
          <img 
            src={qrImageUrl} 
            alt={`QR Code Katalog ${storeTitle || ''}`}
            style={{ width: '165px', height: '165px', borderRadius: '0.35rem', display: 'block' }}
          />
        </div>

        {/* URL Pill Badge */}
        <a 
          href={fullUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            fontSize: '0.76rem', 
            color: 'var(--primary)', 
            fontWeight: 700, 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.35rem', 
            padding: '0.35rem 0.85rem',
            backgroundColor: 'var(--primary-glow)',
            border: '1px solid var(--border-light)',
            borderRadius: '2rem',
            wordBreak: 'break-all',
            maxWidth: '100%'
          }}
        >
          <span>{fullUrl.replace(/^https?:\/\//, '')}</span>
          <ExternalLink size={12} />
        </a>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', width: '100%', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary"
            style={{ padding: '0.6rem 0.35rem', fontSize: '0.74rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer' }}
          >
            <Download size={14} />
            <span>{downloading ? 'Unduh...' : 'Unduh QR'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{ padding: '0.6rem 0.35rem', fontSize: '0.74rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer' }}
          >
            {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
            <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="btn-secondary"
            style={{ padding: '0.6rem 0.35rem', fontSize: '0.74rem', fontWeight: 800, borderRadius: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer' }}
          >
            <Share2 size={14} />
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
      borderRadius: '0.85rem', 
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
          padding: '0.95rem 1rem', 
          cursor: 'pointer', 
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: expanded ? 'var(--bg-card-hover)' : 'transparent',
          transition: 'background-color 0.2s ease'
        }}
      >
        {/* Header Row: Icon + Title + Status Badge Pinned Top Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
              <Clock size={17} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Jam Operasional
              </h4>
            </div>
          </div>

          <span style={{ 
            fontSize: '0.68rem', 
            fontWeight: 800, 
            padding: '0.25rem 0.65rem', 
            borderRadius: '20px', 
            backgroundColor: statusInfo.badgeBg, 
            color: statusInfo.badgeColor, 
            border: `1px solid ${statusInfo.badgeBorder}`, 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusInfo.badgeColor, display: 'inline-block', boxShadow: `0 0 6px ${statusInfo.badgeColor}` }} />
            {statusInfo.badgeText}
          </span>
        </div>

        {/* Schedule Info Box */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '0.65rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.6rem',
          backgroundColor: 'var(--bg-card-hover)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Hari Ini ({statusInfo.todayName})
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 800 }}>
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
              gap: '0.3rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.72rem',
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
            <Calendar size={12} style={{ flexShrink: 0 }} />
            <span>{expanded ? 'Tutup' : 'Jadwal 7 Hari'}</span>
            <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }} />
          </button>
        </div>
      </div>

      {/* Expanded Weekly Schedule Table */}
      {expanded && (
        <div style={{ 
          padding: '0.85rem 1rem 1rem', 
          borderTop: '1px solid var(--border-light)', 
          backgroundColor: 'var(--bg-card-hover)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.5rem', 
          animation: 'fadeIn 0.2s ease' 
        }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
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
                    padding: '0.45rem 0.7rem',
                    borderRadius: '0.5rem',
                    backgroundColor: isToday ? 'var(--primary-glow)' : 'var(--bg-card)',
                    border: isToday ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    fontSize: '0.75rem',
                    boxShadow: isToday ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {isToday && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />}
                    <span style={{ color: isToday ? 'var(--primary)' : 'var(--text-primary)', fontWeight: isToday ? 800 : 700 }}>
                      {day}
                    </span>
                  </div>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: isClosed ? '#ef4444' : (isToday ? 'var(--primary)' : 'var(--text-primary)'), 
                    fontWeight: isClosed ? 800 : (isToday ? 800 : 700),
                    fontSize: isClosed ? '0.72rem' : '0.75rem',
                    backgroundColor: isClosed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    padding: isClosed ? '0.1rem 0.45rem' : '0',
                    borderRadius: isClosed ? '9999px' : '0',
                    border: isClosed ? '1px solid rgba(239, 68, 68, 0.25)' : 'none'
                  }}>
                    {isClosed ? (
                      <>
                        <AlertCircle size={10} style={{ flexShrink: 0, color: '#ef4444' }} />
                        <span>TUTUP</span>
                      </>
                    ) : (
                      <>
                        <Clock size={10} style={{ flexShrink: 0, opacity: isToday ? 0.9 : 0.45, color: isToday ? 'var(--primary)' : 'var(--text-secondary)' }} />
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

  // Persistent Onboarding Registration State across Page Refreshes (Mobile) & Industry Standard Clean URLs
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
  const [notifications, setNotifications] = useState<Array<{
    id: number | string;
    title: string;
    message: string;
    type: 'order' | 'comment' | 'system' | 'stock' | 'info' | 'success' | 'warning';
    timestamp?: string;
    time?: string;
    read: boolean;
    linkSubTab?: 'items' | 'settings';
    linkMobileSettingsTab?: 'about' | 'general' | 'contact' | 'theme' | 'master';
  }>>([
    {
      id: 'about_onboarding',
      title: '📋 Lengkapi Pengaturan Halaman Tentang Kami',
      message: 'Lengkapi Alamat Toko, Jam Operasional, dan Profil Komitmen Layanan Anda agar katalog terlihat profesional dan terpercaya.',
      type: 'warning',
      timestamp: 'Baru saja',
      read: false,
      linkSubTab: 'settings',
      linkMobileSettingsTab: 'about'
    },
    {
      id: 1,
      title: 'Sistem Toko Siap',
      message: 'Toko Anda telah berhasil dikonfigurasi dan siap melayani transaksi.',
      type: 'system',
      timestamp: '5 menit lalu',
      time: '5 menit lalu',
      read: false
    },
    {
      id: 2,
      title: 'Manajemen Inventaris',
      message: 'Data produk & katalog digital dapat dikelola sewaktu-waktu di menu inventaris.',
      type: 'order',
      timestamp: '1 jam lalu',
      time: '1 jam lalu',
      read: false,
      linkSubTab: 'items'
    },
    {
      id: 3,
      title: 'Konfigurasi Toko',
      message: 'Informasi profil toko, media sosial & logo dapat disesuaikan pada menu pengaturan.',
      type: 'system',
      timestamp: '3 jam lalu',
      time: '3 jam lalu',
      read: true,
      linkSubTab: 'settings'
    }
  ]);
  const [heroEmailInput, setHeroEmailInput] = useState('');
  // Landing Page Interactive States Mobile
  const [landingCategory, setLandingCategory] = useState<'culinary' | 'fashion' | 'plants' | 'pets' | 'services' | 'tech'>('culinary');
  const [pricingBillingCycle, setPricingBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [searchStoreQuery, setSearchStoreQuery] = useState<string>('');
  const [previewProductModal, setPreviewProductModal] = useState<any | null>(null);
  const [simulatedOrderToast, setSimulatedOrderToast] = useState<string | null>(null);
  const [featuredStores, setFeaturedStores] = useState<any[]>([]);
  // Policy & Privacy System States
  const [policies, setPolicies] = useState<{ [key: string]: { type: string, version: string, title: string, content: string, published_at?: string } }>({
    terms: {
      type: 'terms',
      version: 'v1.0.0',
      title: 'Syarat & Ketentuan Layanan',
      content: '### 1. Ketentuan Umum Layanan Catavor\nCatavor adalah platform penyedia katalog digital dan biolink bisnis online bagi pemilik usaha (Merchant).\n\n### 2. Hak & Kewajiban Merchant\n- Merchant bertanggung jawab penuh atas kebenaran informasi produk, stok, harga, dan foto yang diunggah.\n- Dilarang menjual barang atau jasa ilegal yang melanggar hukum Republik Indonesia.\n\n### 3. Batasan Tanggung Jawab Transaksi\nCatavor menyediakan sarana katalog digital & alat komunikasi pesanan (WhatsApp Direct/Rekber).\n\n### 4. Hak Cipta & Kekayaan Intelektual\nSeluruh desain platform, kode, dan merek dagang Catavor adalah milik PT Catavor Media Digital.'
    },
    privacy: {
      type: 'privacy',
      version: 'v1.0.0',
      title: 'Kebijakan Privasi & Perlindungan Data',
      content: '### 1. Pengumpulan & Penggunaan Data\nKami mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar, seperti nama toko, alamat email, nomor WhatsApp bisnis.\n\n### 2. Keamanan & Enkripsi Data\nSeluruh data pengguna disimpan pada infrastruktur server terenkripsi sesuai Standar Keamanan & Privasi Data Global.\n\n### 3. Komitmen Kerahasiaan\nCatavor TIDAK AKAN PERNAH menjual, menyewakan, atau membagikan data pribadi atau data pelanggan toko Anda kepada pihak ketiga.\n\n### 4. Hak Pengguna Atas Data\nAnda berhak memperbarui, mengunduh, atau mengajukan penghapusan data toko Anda kapan saja.'
    },
    acceptable_use: {
      type: 'acceptable_use',
      version: 'v1.0.0',
      title: 'Ketentuan Penggunaan & Komunitas',
      content: '### 1. Larangan Konten & Barang Ilegal\nPengguna dilarang keras menampilkan, menawarkan, atau menjual narkotika, senjata api/tajam ilegal, satwa liar dilindungi, atau produk bajakan.\n\n### 2. Penangguhan & Pemblokiran Akun\nPelanggaran terhadap ketentuan penggunaan ini akan mengakibatkan penangguhan atau pemblokiran permanen.'
    }
  });

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

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Guarantee auto-scroll to top on page/tab navigation (Mobile & Tablet)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [portalTab, storeSlug, registerStep]);

  // Helper to cleanly format Markdown policy content into React Elements
  const renderFormattedPolicyContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Check for headings: ### Header Title or ## Header Title or # Header Title
          if (trimmed.startsWith('#')) {
            const headerText = trimmed.replace(/^#+\s*/, '');
            return (
              <div key={idx} style={{ marginTop: idx > 0 ? '0.85rem' : '0.2rem', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{ width: '4px', height: '16px', borderRadius: '4px', background: '#2563eb', flexShrink: 0 }} />
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', paddingLeft: '0.6rem', color: '#475569', fontSize: '0.82rem', lineHeight: '1.6' }}>
                <span style={{ color: '#2563eb', fontSize: '0.9rem', lineHeight: '1.4', flexShrink: 0, fontWeight: 'bold' }}>•</span>
                <span>{itemText}</span>
              </div>
            );
          }

          // Regular paragraph text
          return (
            <p key={idx} style={{ margin: 0, color: '#475569', fontSize: '0.82rem', lineHeight: '1.65' }}>
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  // Universal Mobile Footer with Clean Modern Commerce Styling
  const renderMobileFooter = () => (
    <footer style={{ 
      borderTop: '1px solid #e2e8f0', 
      padding: '2.25rem 1rem 2.5rem 1rem', 
      background: '#ffffff', 
      marginTop: '3rem', 
      textAlign: 'center',
      position: 'relative',
      zIndex: 20
    }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', maxWidth: '480px', margin: '0 auto' }}>
        
        {/* Brand & Badge Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            fontSize: '1.15rem', 
            fontWeight: 900, 
            color: '#0f172a', 
            letterSpacing: '-0.02em',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            Catavor
          </span>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '0.15rem 0.55rem',
            borderRadius: '999px',
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            Katalog &amp; Biolink
          </span>
        </div>

        {/* Clean Interactive Policy Links */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexWrap: 'wrap', 
          gap: '0.4rem 0.75rem', 
          fontSize: '0.74rem', 
          color: '#64748b',
          margin: '0.2rem 0'
        }}>
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); setPortalTab('terms'); }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#475569', 
              cursor: 'pointer', 
              fontWeight: 600, 
              padding: '0.25rem 0.4rem',
              borderRadius: '0.35rem',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Syarat &amp; Ketentuan</span>
            <span style={{ fontSize: '0.62rem', color: '#1d4ed8', background: '#eff6ff', padding: '0.05rem 0.35rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              {policies.terms?.version || 'v1.0.0'}
            </span>
          </button>

          <span style={{ color: '#cbd5e1', fontSize: '0.6rem' }}>•</span>

          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); setPortalTab('privacy'); }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#475569', 
              cursor: 'pointer', 
              fontWeight: 600, 
              padding: '0.25rem 0.4rem',
              borderRadius: '0.35rem',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Kebijakan Privasi</span>
            <span style={{ fontSize: '0.62rem', color: '#1d4ed8', background: '#eff6ff', padding: '0.05rem 0.35rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              {policies.privacy?.version || 'v1.0.0'}
            </span>
          </button>

          <span style={{ color: '#cbd5e1', fontSize: '0.6rem' }}>•</span>

          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); setPortalTab('acceptable_use'); }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#475569', 
              cursor: 'pointer', 
              fontWeight: 600, 
              padding: '0.25rem 0.4rem',
              borderRadius: '0.35rem',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Ketentuan Penggunaan</span>
            <span style={{ fontSize: '0.62rem', color: '#1d4ed8', background: '#eff6ff', padding: '0.05rem 0.35rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
              {policies.acceptable_use?.version || 'v1.0.0'}
            </span>
          </button>
        </div>

        {/* Security & Compliance Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#64748b', fontSize: '0.68rem', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldCheck size={13} style={{ color: '#16a34a' }} />
            Privasi &amp; Data Terlindungi
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Lock size={12} style={{ color: '#2563eb' }} />
            256-Bit Enkripsi SSL
          </span>
        </div>

        {/* Copyright notice */}
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', fontWeight: 500 }}>
          © 2026 <strong>PT Catavor Global Teknologi</strong>. Hak Cipta Dilindungi.
        </div>

      </div>
    </footer>
  );

  // Dedicated Full-Page Legal & Policy Renderer for Mobile
  const renderPolicyPage = (type: 'terms' | 'privacy' | 'acceptable_use') => {
    const policy = policies[type] || {
      title: 'Kebijakan Layanan',
      version: 'v1.0.0',
      content: 'Memuat kebijakan...'
    };

    return (
      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem 1.25rem 4rem 1.25rem', animation: 'fadeIn 0.3s ease-in-out' }}>
        {/* Main Formatted Content Card */}
        <div className="portal-card" style={{ padding: '1.75rem 1.35rem' }}>
          {renderFormattedPolicyContent(policy.content)}
        </div>
      </div>
    );
  };

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

  // Reset top alert error & field errors when switching steps or tabs (Mobile)
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

  // Store username (slug) real-time availability check state (Mobile)
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
  const [purchaseQty, setPurchaseQty] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

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

  // Mobile navigation views: 'tabs' | 'article-editor' | 'fauna-editor' | 'product-type-selector'
  const isPopStateRef = useRef<boolean>(false)
  const [view, setView] = useState<'tabs' | 'article-editor' | 'fauna-editor' | 'product-type-selector'>('tabs')
  const [activeTab, setActiveTab] = useState<'catalog' | 'about' | 'sightings' | 'articles' | 'admin'>('catalog')
  const [aboutSubView, setAboutSubView] = useState<'main' | 'qrcode'>('main')
  const [adminSubTab, setAdminSubTab] = useState<'menu' | 'items' | 'settings' | 'profile' | 'articles' | 'policies' | 'notifications' | 'help'>('menu')
  const [mobilePolicyTab, setMobilePolicyTab] = useState<'terms' | 'privacy' | 'acceptable_use'>('terms')
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false)
  const [agreeCheckoutTerms, setAgreeCheckoutTerms] = useState<boolean>(false)
  const [previousPortalTab, setPreviousPortalTab] = useState<'login' | 'register' | 'home' | 'terms' | 'privacy' | 'acceptable_use' | 'checkout'>('home')
  const [agreeTermsError, setAgreeTermsError] = useState<boolean>(false)
  const [agreeCheckoutTermsError, setAgreeCheckoutTermsError] = useState<boolean>(false)
  const [showQuickPolicyModal, setShowQuickPolicyModal] = useState<'terms' | 'privacy' | 'acceptable_use' | null>(null)
  const [faunasPage, setFaunasPage] = useState(1)
  const [articlesPage, setArticlesPage] = useState(1)
  const [itemsPage, setItemsPage] = useState<number>(1)
  const [logoUploading, setLogoUploading] = useState<boolean>(false)

  // Notifications Filter State
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  // Support Ticket System State
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

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, notifFilter]);

  // Articles state
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState<boolean>(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null) // for reading full article
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  
  // Public comment states
  const [commentName, setCommentName] = useState<string>('')
  const [commentEmail, setCommentEmail] = useState<string>('')
  const [commentContent, setCommentContent] = useState<string>('')
  const [submittingComment, setSubmittingComment] = useState<boolean>(false)
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string } | null>(null)

  // Admin comments & hub states
  const [articleTabState, setArticleTabState] = useState<'hub' | 'articles' | 'comments'>('hub')
  const [adminComments, setAdminComments] = useState<CommentItem[]>([])
  const [loadingComments, setLoadingComments] = useState<boolean>(false)
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

  // Search & Filters (Multi-Type Hybrid Catalog Support)
  const [search, setSearch] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [habitatFilter, setHabitatFilter] = useState<string>('all')
  const [commentFilter, setCommentFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name_asc'>('newest')
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false)
  const [showSortSheet, setShowSortSheet] = useState<boolean>(false)
  const [showFilterSheet, setShowFilterSheet] = useState<boolean>(false)
  const [categorySearch, setCategorySearch] = useState<string>('')
  const [showProductTypeSelector, setShowProductTypeSelector] = useState<boolean>(false)

  // Context-Aware Action Menu (Three-Dots) & Report Sheet State
  const [actionMenuData, setActionMenuData] = useState<{ type: 'store' | 'item'; item?: any } | null>(null)
  const [reportModalData, setReportModalData] = useState<{ type: 'store' | 'item'; item?: any } | null>(null)
  const [reportReason, setReportReason] = useState<string>('fraud')
  const [reportNotes, setReportNotes] = useState<string>('')
  const [reportEmail, setReportEmail] = useState<string>('')
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false)

  // Dynamic Mobile Bottom Sheet Generic Form Dropdown Picker State
  const [crudDropdownPicker, setCrudDropdownPicker] = useState<{
    title: string;
    icon?: any;
    options: { value: string; label: string; desc?: string; badge?: string; isAction?: boolean }[];
    selectedValue: string;
    onSelect: (value: string) => void;
  } | null>(null);

  // Mobile Drag-to-Dismiss Gesture for Bottom Sheets
  const [sheetDragY, setSheetDragY] = useState<number>(0)
  const [isSheetDragging, setIsSheetDragging] = useState<boolean>(false)
  const touchStartY = useRef<number>(0)

  const handleSheetDragStart = (clientY: number) => {
    touchStartY.current = clientY;
    setIsSheetDragging(true);
  };

  const handleSheetDragMove = (clientY: number) => {
    if (!isSheetDragging) return;
    const delta = clientY - touchStartY.current;
    if (delta > 0) {
      setSheetDragY(delta);
    } else {
      setSheetDragY(delta * 0.15);
    }
  };

  const handleSheetDragEnd = (type: 'category' | 'sort' | 'filter' | 'action_menu' | 'report' | 'rekber_explainer' | 'purchase_options' | 'crud_dropdown') => {
    if (!isSheetDragging) return;
    setIsSheetDragging(false);
    if (sheetDragY > 75) {
      if (type === 'category') setShowCategorySheet(false);
      if (type === 'sort') setShowSortSheet(false);
      if (type === 'filter') setShowFilterSheet(false);
      if (type === 'action_menu') setActionMenuData(null);
      if (type === 'report') setReportModalData(null);
      if (type === 'rekber_explainer') setShowRekberExplainerModal(false);
      if (type === 'crud_dropdown') setCrudDropdownPicker(null);
      if (type === 'purchase_options') {
        setShowPurchaseOptions(false);
        setShowMarketplacesSubMenu(false);
      }
    }
    setSheetDragY(0);
  };

  const getSubtypeLabel = (prodType: string) => {
    switch (prodType) {
      case 'food': return 'Semua Menu / Saji';
      case 'fauna': return 'Semua Asal / Habitat';
      case 'service': return 'Semua Model Layanan';
      case 'digital': return 'Semua Format / Lisensi';
      default: return 'Semua Tipe / Variasi';
    }
  };

  const formatPrice = (num?: number) => {
    if (!num && num !== 0) return 'Rp 0'
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  };

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
    let result = faunas.filter(item => {
      const itemType = item.product_type || 'physical';
      const matchesSearch = !search.trim() || 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.scientific_name && item.scientific_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
      
      const matchesClass = classFilter === 'all' || item.class === classFilter;
      const matchesHabitat = habitatFilter === 'all' || item.habitat === habitatFilter;
      const matchesProductType = productTypeFilter === 'all' || itemType === productTypeFilter;

      return matchesSearch && matchesClass && matchesHabitat && matchesProductType;
    });

    if (sortBy === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => a.id - b.id);
    } else {
      // 'newest' default
      result.sort((a, b) => b.id - a.id);
    }

    return result;
  }, [faunas, search, classFilter, habitatFilter, productTypeFilter, sortBy]);

  // Bottom Sheets
  const [showCrudSheet, setShowCrudSheet] = useState<boolean>(false)
  const [isDetailActive, setIsDetailActive] = useState<boolean>(false)
  const [displayLimit, setDisplayLimit] = useState<number>(10)

  // Smart Floating Dynamic Filter Bar (Auto-Hide on Scroll Down, Reveal on Scroll Up)
  const [isFilterFloating, setIsFilterFloating] = useState<boolean>(false)
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(true)
  const lastFilterScrollYRef = useRef<number>(0)
  const [filterBarHeight, setFilterBarHeight] = useState<number>(140)
  const searchSectionRef = useRef<HTMLElement | null>(null)

  // Admin Inventory State & Server/Client-Side Filtering
  const [adminSearch, setAdminSearch] = useState<string>('')
  const [adminProductTypeFilter, setAdminProductTypeFilter] = useState<'all' | 'physical' | 'food' | 'service' | 'digital' | 'fauna'>('all')
  const [adminClassFilter, setAdminClassFilter] = useState<string>('all')
  const [adminSortBy, setAdminSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'price_asc' | 'price_desc'>('newest')
  const [adminItemsPerPage, setAdminItemsPerPage] = useState<number>(10)

  // Available categories for admin inventory scoped to active product type
  const availableAdminCategories = useMemo(() => {
    const list = faunas
      .filter(f => adminProductTypeFilter === 'all' || (f.product_type || 'physical') === adminProductTypeFilter)
      .map(f => f.class)
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [faunas, adminProductTypeFilter]);

  // Filtered & Sorted Admin Inventory Items
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

  const totalAdminPages = Math.max(1, Math.ceil(filteredAdminItems.length / adminItemsPerPage));
  const paginatedAdminItems = useMemo(() => {
    return filteredAdminItems.slice((itemsPage - 1) * adminItemsPerPage, itemsPage * adminItemsPerPage);
  }, [filteredAdminItems, itemsPage, adminItemsPerPage]);

  const totalItemsPages = totalAdminPages;
  const paginatedItems = paginatedAdminItems;

  const ARTICLES_PER_PAGE = 5
  const totalArticlesPages = Math.ceil(articles.length / ARTICLES_PER_PAGE)
  const paginatedArticles = articles.slice((articlesPage - 1) * ARTICLES_PER_PAGE, articlesPage * ARTICLES_PER_PAGE)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('catavor_token'))
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

  const [faunaToDelete, setFaunaToDelete] = useState<Fauna | null>(null)

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
  const [isChangingTypeInEditor, setIsChangingTypeInEditor] = useState<boolean>(false)
  const [crudForm, setCrudForm] = useState(() => getInitialCrudForm('physical'))

  const resetCrudState = (type: ItemCategoryType = 'physical') => {
    setCrudForm(getInitialCrudForm(type));
    setCrudImages(['']);
    setCustomClass('');
    setShowCustomClassInput(false);
    setCustomHabitat('');
    setShowCustomHabitatInput(false);
    setCustomConservationStatus('');
    setShowCustomConservationStatusInput(false);
    setCustomShippingCoverage('');
    setShowCustomShippingCoverageInput(false);
    setCrudError(null);
    setEditId(null);
    setCrudMode('create');
    setIsChangingTypeInEditor(false);
  };

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
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null)
  const [showPurchaseOptions, setShowPurchaseOptions] = useState<boolean>(false)
  const [showRekberExplainerModal, setShowRekberExplainerModal] = useState<boolean>(false)
  const [showMarketplacesSubMenu, setShowMarketplacesSubMenu] = useState<boolean>(false)
  const [lightboxIndex, setLightboxIndex] = useState<number>(0)
  const [zoomScale, setZoomScale] = useState<number>(1)
  const [panPosition, setPanPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 })

  // Blogger-style Image Formatting states
  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null)
  const [showImageSettingsModal, setShowImageSettingsModal] = useState<boolean>(false)
  const [imageAltText, setImageAltText] = useState<string>('')
  const [imageCaptionText, setImageCaptionText] = useState<string>('')
  const [imageSizeSelection, setImageSizeSelection] = useState<'kecil' | 'sedang' | 'besar' | 'ekstrabesar' | 'asli'>('sedang')

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
  const [mobileSettingsTab, setMobileSettingsTabState] = useState<'menu' | 'general' | 'contact' | 'about' | 'theme' | 'master'>('menu')

  const setMobileSettingsTab = (tab: 'menu' | 'general' | 'contact' | 'about' | 'theme' | 'master') => {
    setMobileSettingsTabState(tab);
    try { sessionStorage.setItem('catavor_last_mobile_settings_tab', tab); } catch (e) {}
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

  // Multi-Tenant Store Theme Syncing Engine (Strictly scoped to Unique Store Routes)
  useEffect(() => {
    if (storeSlug) {
      const activeTheme = (settings as any)?.store_theme || (settingsForm as any)?.store_theme || 'emerald';
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.body.setAttribute('data-theme', activeTheme);
    } else {
      // Non-store routes (Landing Portal, Login, Register, Terms & Policy Pages) enforce default platform theme
      document.documentElement.setAttribute('data-theme', 'emerald');
      document.body.setAttribute('data-theme', 'emerald');
    }
  }, [storeSlug, (settings as any)?.store_theme, (settingsForm as any)?.store_theme]);

  // Profile Form State
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

  // Detect URL path on mount
  // Detect & parse URL path on mount (Mobile)
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
          setActiveTab('admin');
          const pageSub = parts[2] || urlParams.get('sub');
          const subSub = parts[3];
          const paramId = parts[4];

          if (pageSub === 'items') {
            setAdminSubTab('items');
            if (subSub === 'create' || subSub === 'new' || subSub === 'create-type' || subSub === 'select-type') {
              const prodType = parts[4];
              if (['physical', 'digital', 'service', 'food', 'fauna'].includes(prodType)) {
                setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
                setCrudMode('create');
                setView('fauna-editor');
                setShowProductTypeSelector(false);
              } else {
                setShowProductTypeSelector(true);
                setView('product-type-selector');
              }
            } else if (subSub === 'edit' && paramId) {
              let actualId = paramId;
              let prodType = 'physical';
              if (parts.length >= 5) {
                prodType = parts[3];
                actualId = parts[4];
              }
              setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
              setCrudMode('edit');
              setEditId(parseInt(actualId, 10));
              setView('fauna-editor');
              setShowProductTypeSelector(false);
            } else {
              setView('tabs');
              setShowProductTypeSelector(false);
            }
          } else if (pageSub === 'articles') {
            setAdminSubTab('articles');
            if (subSub === 'comments') {
              setArticleTabState('comments');
              setView('tabs');
            } else if (subSub === 'create' || subSub === 'new') {
              setView('article-editor');
              setEditingArticle(null);
            } else {
              setView('tabs');
            }
          } else if (pageSub === 'settings') {
            setAdminSubTab('settings');
            setView('tabs');
            const sec = subSub || urlParams.get('section');
            let mappedSec = sec ? sec.toLowerCase().trim() : '';
            if (mappedSec === 'social') mappedSec = 'contact';
            if (mappedSec === 'features') mappedSec = 'general';
            if (['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(mappedSec)) {
              setMobileSettingsTab(mappedSec as any);
            } else {
              const saved = sessionStorage.getItem('catavor_last_mobile_settings_tab');
              if (saved && ['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(saved)) {
                setMobileSettingsTab(saved as any);
              } else {
                setMobileSettingsTab('menu');
              }
            }
          } else if (pageSub === 'profile') {
            setAdminSubTab('profile');
            setView('tabs');
          } else if (pageSub === 'policies') {
            setAdminSubTab('policies');
            setView('tabs');
          } else if (pageSub === 'notifications') {
            setAdminSubTab('notifications');
            setView('tabs');
          } else if (pageSub === 'help' || pageSub === 'bantuan') {
            setAdminSubTab('help');
            setView('tabs');
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
              if (found) {
                setSelectedTicket(found);
              }
            }
          } else {
            setAdminSubTab('menu');
            setView('tabs');
          }
        } else if (sub === 'about') {
          setActiveTab('about');
          const subSub = parts[2];
          if (subSub === 'share' || subSub === 'qrcode' || subSub === 'qr' || urlParams.get('sub') === 'share' || urlParams.get('sub') === 'qrcode') {
            setAboutSubView('qrcode');
          } else {
            setAboutSubView('main');
          }
        } else if (sub === 'share' || sub === 'qrcode' || sub === 'qr') {
          setActiveTab('about');
          setAboutSubView('qrcode');
        } else if (sub === 'sightings') setActiveTab('sightings');
        else if (sub === 'articles') setActiveTab('articles');
      } else {
        const qTab = urlParams.get('tab');
        if (qTab === 'admin') {
          setActiveTab('admin');
          const pageSub = urlParams.get('sub');
          if (pageSub === 'items') setAdminSubTab('items');
          else if (pageSub === 'articles') setAdminSubTab('articles');
          else if (pageSub === 'settings') {
            setAdminSubTab('settings');
            const sec = urlParams.get('section');
            let mappedSec = sec ? sec.toLowerCase().trim() : '';
            if (mappedSec === 'social') mappedSec = 'contact';
            if (mappedSec === 'features') mappedSec = 'general';
            if (['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(mappedSec)) {
              setMobileSettingsTab(mappedSec as any);
            } else {
              const saved = sessionStorage.getItem('catavor_last_mobile_settings_tab');
              if (saved && ['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(saved)) {
                setMobileSettingsTab(saved as any);
              } else {
                setMobileSettingsTab('menu');
              }
            }
          } else if (pageSub === 'profile') setAdminSubTab('profile');
          else if (pageSub === 'policies') setAdminSubTab('policies');
          else if (pageSub === 'notifications') setAdminSubTab('notifications');
          else if (pageSub === 'help') {
            setAdminSubTab('help');
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
        } else if (qTab === 'about') setActiveTab('about');
        else if (qTab === 'sightings') setActiveTab('sightings');
        else if (qTab === 'articles') setActiveTab('articles');
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

  // Browser Back/Forward PopState Event Listener for Mobile Navigation
  useEffect(() => {
    const handlePopState = () => {
      const slug = getStoreSlug();
      if (slug) {
        const path = window.location.pathname.toLowerCase();
        const parts = path.split('/').filter(Boolean);
        const urlParams = new URLSearchParams(window.location.search);

        if (parts.length >= 2 && parts[1] === 'admin') {
          setActiveTab('admin');
          const pageSub = parts[2] || urlParams.get('sub');
          if (pageSub === 'notifications') {
            setAdminSubTab('notifications');
            setSelectedTicket(null);
          } else if (pageSub === 'help' || pageSub === 'bantuan') {
            setAdminSubTab('help');
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
              else setSelectedTicket(null);
            } else {
              setSelectedTicket(null);
            }
          } else if (pageSub === 'items') {
            setAdminSubTab('items');
            setSelectedTicket(null);
          } else if (pageSub === 'settings') {
            setAdminSubTab('settings');
            const subSub = parts[3];
            const sec = subSub || urlParams.get('section');
            let mappedSec = sec ? sec.toLowerCase().trim() : '';
            if (mappedSec === 'social') mappedSec = 'contact';
            if (mappedSec === 'features') mappedSec = 'general';
            if (['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(mappedSec)) {
              setMobileSettingsTab(mappedSec as any);
            } else {
              const saved = sessionStorage.getItem('catavor_last_mobile_settings_tab');
              if (saved && ['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(saved)) {
                setMobileSettingsTab(saved as any);
              } else {
                setMobileSettingsTab('menu');
              }
            }
            setSelectedTicket(null);
          } else if (pageSub === 'policies') {
            setAdminSubTab('policies');
            setSelectedTicket(null);
          } else if (pageSub === 'profile') {
            setAdminSubTab('profile');
            setSelectedTicket(null);
          } else {
            setAdminSubTab('menu');
            setSelectedTicket(null);
          }
        } else if (parts.length >= 2 && parts[1] === 'about') {
          setActiveTab('about');
          const subSub = parts[2];
          if (subSub === 'share' || subSub === 'qrcode' || subSub === 'qr' || urlParams.get('sub') === 'share' || urlParams.get('sub') === 'qrcode') {
            setAboutSubView('qrcode');
          } else {
            setAboutSubView('main');
          }
        } else if (parts.length >= 2 && (parts[1] === 'share' || parts[1] === 'qrcode' || parts[1] === 'qr')) {
          setActiveTab('about');
          setAboutSubView('qrcode');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-open fauna item sheet if ?item=ID is in URL or /admin/items/edit/ID
  useEffect(() => {
    if (!faunas || faunas.length === 0) return;
    const path = window.location.pathname.toLowerCase();
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[1] === 'admin' && parts[2] === 'items' && parts[3] === 'edit') {
      const targetId = parseInt(parts[4], 10);
      const found = faunas.find(f => f.id === targetId);
      if (found && (!showCrudSheet || editId !== targetId)) {
        openEditSheet(found);
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

  // Article feature disabled/unused
  /*
  useEffect(() => {
    if (!articles || articles.length === 0) return;
    ...
  }, [articles]);
  */

  // Lock scroll when bottom sheets are open
  useEffect(() => {
    if (showCrudSheet) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showCrudSheet])

  // Listen to popstate for clean policy & portal routes
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
            setActiveTab('admin');
            const pageSub = parts[2] || urlParams.get('sub');
            const subSub = parts[3];
            const paramId = parts[4];

            if (pageSub === 'items') {
              setAdminSubTab('items');
              if (subSub === 'create' || subSub === 'new' || subSub === 'create-type' || subSub === 'select-type') {
                const prodType = parts[4];
                if (['physical', 'digital', 'service', 'food', 'fauna'].includes(prodType)) {
                  setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
                  setCrudMode('create');
                  setView('fauna-editor');
                  setShowProductTypeSelector(false);
                } else {
                  setShowProductTypeSelector(true);
                  setView('product-type-selector');
                }
              } else if (subSub === 'edit' && paramId) {
                let actualId = paramId;
                let prodType = 'physical';
                if (parts.length >= 5) {
                  prodType = parts[3];
                  actualId = parts[4];
                }
                setCrudForm(prev => ({ ...prev, product_type: prodType as any }));
                setCrudMode('edit');
                setEditId(parseInt(actualId, 10));
                setView('fauna-editor');
                setShowProductTypeSelector(false);
              } else {
                setView('tabs');
                setShowProductTypeSelector(false);
              }
            } else if (pageSub === 'articles') {
              setAdminSubTab('articles');
              if (subSub === 'comments') {
                setArticleTabState('comments');
                setView('tabs');
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
                setView('tabs');
                setArticleTabState('articles');
              }
            } else if (pageSub === 'settings') {
              setAdminSubTab('settings');
              setView('tabs');
              const sec = subSub || urlParams.get('section');
              let mappedSec = sec ? sec.toLowerCase().trim() : '';
              if (mappedSec === 'social') mappedSec = 'contact';
              if (mappedSec === 'features') mappedSec = 'general';
              if (['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(mappedSec)) {
                setMobileSettingsTab(mappedSec as any);
              } else {
                const saved = sessionStorage.getItem('catavor_last_mobile_settings_tab');
                if (saved && ['general', 'contact', 'about', 'theme', 'master', 'menu'].includes(saved)) {
                  setMobileSettingsTab(saved as any);
                } else {
                  setMobileSettingsTab('menu');
                }
              }
            } else if (pageSub === 'profile') {
              setAdminSubTab('profile');
              setView('tabs');
            } else if (pageSub === 'policies') {
              setAdminSubTab('policies');
              setView('tabs');
            } else if (pageSub === 'notifications') {
              setAdminSubTab('notifications');
              setView('tabs');
            } else if (pageSub === 'help' || pageSub === 'bantuan') {
              setAdminSubTab('help');
              setView('tabs');
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
                else setSelectedTicket(null);
              } else {
                setSelectedTicket(null);
              }
            } else {
              setAdminSubTab('menu');
              setView('tabs');
            }
          } else if (sub === 'about') { setView('tabs'); setActiveTab('about'); }
          else if (sub === 'sightings') { setView('tabs'); setActiveTab('sightings'); }
          else if (sub === 'articles') { setView('tabs'); setActiveTab('articles'); }
          else { setView('tabs'); setActiveTab('catalog'); }
        } else {
          setView('tabs');
          setActiveTab('catalog');
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
  }, [activeTab, adminSubTab, mobileSettingsTab, selectedTicket]);

  // Get headers helper
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

  // Load Data
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
            setMasterCategories(prev => {
              const merged: Record<ItemCategoryType, string[]> = { ...DEFAULT_MASTER_CATEGORIES };
              (Object.keys(DEFAULT_MASTER_CATEGORIES) as ItemCategoryType[]).forEach(type => {
                const storeList = store.master_categories[type];
                if (Array.isArray(storeList) && storeList.length > 0) {
                  merged[type] = Array.from(new Set([...(DEFAULT_MASTER_CATEGORIES[type] || []), ...storeList]));
                }
              });
              return merged;
            });
          }
          if (store.master_classes) setMasterClasses(store.master_classes);
          if (store.master_habitats) setMasterHabitats(store.master_habitats);
          if (store.master_statuses) setMasterStatuses(store.master_statuses);
          if (store.master_shipping_coverages) setMasterShippingCoverages(store.master_shipping_coverages);

          // Fetch store-scoped fauna catalog (Load complete store inventory into master state)
          const faunaRes = await fetch(`${API_BASE}/u/${slug}/fauna`);
          const faunaData = await faunaRes.json();
          if (faunaData.success) {
            setFaunas(faunaData.data);
          } else {
            setError(faunaData.message || 'Gagal memuat produk.');
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
      setError('Koneksi terputus. Pastikan server backend Laravel aktif.');
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
  // Share store link (direct to Share / QR page)
  const handleShareStore = () => {
    setActiveTab('about');
    setAboutSubView('qrcode');
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

  const handleSelectArticle = async (article: Article) => {
    setSelectedArticle(article)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch(`${API_BASE}/articles/${article.id}`)
      const data = await res.json()
      if (data.success) {
        setSelectedArticle(data.data)
      }
    } catch (err) {
      console.error("Error fetching article details:", err)
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedArticle) return
    if (!commentName.trim() || !commentContent.trim()) {
      showToast('Nama dan komentar harus diisi.', 'error')
      return
    }

    setSubmittingComment(true)
    try {
      const res = await fetch(`${API_BASE}/articles/${selectedArticle.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: commentName,
          email: commentEmail || null,
          content: commentContent,
          parent_id: replyingTo ? replyingTo.id : null
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || 'Komentar Anda berhasil diterbitkan!')
        setCommentName('')
        setCommentEmail('')
        setCommentContent('')
        setReplyingTo(null)
        
        // Reload details
        const reloadRes = await fetch(`${API_BASE}/articles/${selectedArticle.id}`)
        const reloadData = await reloadRes.json()
        if (reloadData.success) {
          setSelectedArticle(reloadData.data)
        }
      } else {
        showToast(data.message || 'Gagal mengirim komentar.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Koneksi terputus. Gagal mengirim komentar.', 'error')
    } finally {
      setSubmittingComment(false)
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

  // Dynamic SEO & JSON-LD Schema markup injection
  useEffect(() => {
    if (selectedArticle) {
      // 1. Update Title tag
      const originalTitle = document.title
      document.title = `${selectedArticle.title} - ${settings.store_title || 'Catavor'} Edukasi`

      // 2. Meta tags update/injection
      let metaDesc = document.querySelector('meta[name="description"]')
      let oldDesc = metaDesc ? metaDesc.getAttribute('content') : ''
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      const descContent = selectedArticle.meta_description || selectedArticle.content.replace(/<[^>]*>/g, '').substring(0, 155)
      metaDesc.setAttribute('content', descContent)

      // Add OpenGraph / Twitter metadata tags for AI crawlers
      const ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      ogTitle.setAttribute('content', selectedArticle.title)
      ogTitle.setAttribute('id', 'seo-og-title')
      document.head.appendChild(ogTitle)

      const ogDesc = document.createElement('meta')
      ogDesc.setAttribute('property', 'og:description')
      ogDesc.setAttribute('content', descContent)
      ogDesc.setAttribute('id', 'seo-og-desc')
      document.head.appendChild(ogDesc)

      let ogImage: HTMLMetaElement | null = null
      if (selectedArticle.image_url) {
        ogImage = document.createElement('meta')
        ogImage.setAttribute('property', 'og:image')
        ogImage.setAttribute('content', selectedArticle.image_url)
        ogImage.setAttribute('id', 'seo-og-image')
        document.head.appendChild(ogImage)
      }

      // 3. JSON-LD Schema injection
      const schemaScript = document.createElement('script')
      schemaScript.type = 'application/ld+json'
      schemaScript.id = 'article-json-ld'
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": selectedArticle.title,
        "image": selectedArticle.image_url ? [selectedArticle.image_url] : [],
        "datePublished": selectedArticle.created_at,
        "dateModified": selectedArticle.updated_at || selectedArticle.created_at,
        "author": [{
          "@type": "Person",
          "name": selectedArticle.author || 'Admin Catavor',
          "jobTitle": "Editor",
          "url": "https://catavor.com"
        }],
        "publisher": {
          "@type": "Organization",
          "name": "Catavor Premium",
          "logo": {
            "@type": "ImageObject",
            "url": "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=150&h=150"
          }
        },
        "description": descContent,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": window.location.href + '#/articles/' + (selectedArticle.slug || selectedArticle.id)
        }
      }
      schemaScript.innerHTML = JSON.stringify(jsonLd)
      document.head.appendChild(schemaScript)

      // Cleanup function to restore original state when article is closed
      return () => {
        document.title = originalTitle
        if (metaDesc) {
          metaDesc.setAttribute('content', oldDesc || 'Memudahkan pelanggan menjelajahi produk dan informasi bisnis.')
        }
        const titleEl = document.getElementById('seo-og-title')
        if (titleEl) titleEl.remove()
        const descEl = document.getElementById('seo-og-desc')
        if (descEl) descEl.remove()
        const imgEl = document.getElementById('seo-og-image')
        if (imgEl) imgEl.remove()
        const element = document.getElementById('article-json-ld')
        if (element) {
          element.remove()
        }
      }
    }
  }, [selectedArticle])

  // Trigger loading store data
  useEffect(() => {
    loadData()
  }, [storeSlug])
  // Sync activeTab state, admin sub-tab, sub-sub-paths, settings section, and open views/modals to browser URL
  useEffect(() => {
    if (!storeSlug || error || isInvalidRoute()) return;

    let targetPath = `/${storeSlug}`;
    const params = new URLSearchParams();

    if (view === 'product-type-selector') {
      targetPath += `/admin/items/create`;
    } else if (view === 'fauna-editor') {
      const prodType = crudForm.product_type || 'physical';
      if (crudMode === 'edit' && editId) {
        targetPath += `/admin/items/edit/${prodType}/${editId}`;
      } else {
        targetPath += `/admin/items/create/${prodType}`;
      }
    } else if (view === 'article-editor') {
      if (editingArticle) {
        targetPath += `/admin/articles/edit/${editingArticle.id}`;
      } else {
        targetPath += `/admin/articles/create`;
      }
    } else if (activeTab === 'admin') {
      if (adminSubTab === 'items') {
        targetPath += `/admin/items`;
      } else if (adminSubTab === 'articles') {
        if (articleTabState === 'comments') {
          targetPath += `/admin/articles/comments`;
        } else {
          targetPath += `/admin/articles`;
        }
      } else if (adminSubTab === 'settings') {
        if (mobileSettingsTab && mobileSettingsTab !== 'menu') {
          targetPath += `/admin/settings/${mobileSettingsTab}`;
        } else {
          targetPath += `/admin/settings`;
        }
      } else if (adminSubTab === 'profile') {
        targetPath += `/admin/profile`;
      } else if (adminSubTab === 'policies') {
        targetPath += `/admin/policies`;
      } else if (adminSubTab === 'notifications') {
        targetPath += `/admin/notifications`;
      } else if (adminSubTab === 'help') {
        targetPath += `/admin/help`;
        if (selectedTicket) {
          params.set('ticket', selectedTicket.id);
        }
      } else {
        targetPath += `/admin`;
      }
    } else if (activeTab === 'about') {
      if (aboutSubView === 'qrcode') {
        targetPath += `/about/share`;
      } else {
        targetPath += `/about`;
      }
    } else if (activeTab === 'sightings') {
      targetPath += `/sightings`;
    } else if (activeTab === 'articles') {
      targetPath += `/articles`;
    }

    if (selectedFauna && view !== 'fauna-editor') {
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
          { tab: activeTab, subTab: adminSubTab, section: mobileSettingsTab, view, item: selectedFauna?.id, article: selectedArticle?.id, ticket: selectedTicket?.id },
          '',
          fullTarget
        );
      } else {
        window.history.pushState(
          { tab: activeTab, subTab: adminSubTab, section: mobileSettingsTab, view, item: selectedFauna?.id, article: selectedArticle?.id, ticket: selectedTicket?.id },
          '',
          fullTarget
        );
      }
    }
  }, [activeTab, aboutSubView, adminSubTab, mobileSettingsTab, crudMode, editId, view, editingArticle, articleTabState, selectedFauna, selectedArticle, selectedTicket, storeSlug, error]);

  // Sync Onboarding & Portal State to Industry Standard Clean URLs in Mobile (/ , /login , /register/step-X)
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

  // Mobile PopState listener for Back/Forward & gesture back navigation across clean paths
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const slug = getStoreSlug();
      setStoreSlug(slug);
      if (slug) return;

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
      } else if (path === '/' || path === '') {
        setPortalTab('home');
      } else if (event.state?.tab) {
        setPortalTab(event.state.tab);
        if (event.state.step) setRegisterStep(event.state.step);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // Reset displayLimit on search or filter change
  useEffect(() => {
    setDisplayLimit(10)
  }, [search, classFilter, habitatFilter, productTypeFilter, sortBy])

  // Responsive Infinite scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      if (isDetailActive || loadingMore) return
      if (displayLimit >= filteredFaunas.length) return
      const threshold = 150
      const position = window.innerHeight + window.scrollY
      const limit = document.documentElement.scrollHeight - threshold
      if (position >= limit) {
        setLoadingMore(true)
        setTimeout(() => {
          setDisplayLimit(prev => Math.min(prev + 10, filteredFaunas.length))
          setLoadingMore(false)
        }, 350)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [filteredFaunas.length, isDetailActive, loadingMore, displayLimit])

  // Smart Floating Dynamic Filter Bar Scroll Listener (Online Shop Standard: Auto-Hide Down, Reveal Up)
  useEffect(() => {
    const handleSmartFilterScroll = () => {
      if (activeTab !== 'catalog' || isDetailActive) return;
      const currentScrollY = window.scrollY;
      const triggerThreshold = 190;

      if (currentScrollY <= triggerThreshold) {
        setIsFilterFloating(false);
        setIsFilterVisible(true);
      } else {
        setIsFilterFloating(true);
        const delta = currentScrollY - lastFilterScrollYRef.current;
        if (delta > 6) {
          // User is scrolling DOWN -> Hide filter bar smoothly
          setIsFilterVisible(false);
        } else if (delta < -6) {
          // User scrolled UP -> Reveal filter bar immediately
          setIsFilterVisible(true);
        }
      }
      lastFilterScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleSmartFilterScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleSmartFilterScroll);
  }, [activeTab, isDetailActive]);

  // Sync profile when adminUser loads
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

  // Reset Auth & Industry-standard session expiration handler
  const handleUnauthorized = (msg = 'Sesi Anda telah berakhir. Silakan login kembali.') => {
    localStorage.removeItem('catavor_token')
    localStorage.removeItem('catavor_user')
    localStorage.removeItem('catavor_password_changed')
    setToken(null)
    setAdminUser(null)
    setIsPasswordChanged(true)
    setActiveTab('admin')
    setAdminSubTab('menu')
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

  // Real Google OAuth 2.0 SSO Handler Mobile (Google Accounts Popup Window & GSI API)
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
          window.history.pushState({}, '', `/${data.user.store_slug}`);
          setView('tabs');
          setActiveTab('admin');
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
          const userEmail = data.google_data?.email || data.user?.email || googleUser.email;
          const userName = data.google_data?.name || data.user?.name || googleUser.name;
          const userGoogleId = data.google_data?.google_id || data.user?.google_id || googleUser.google_id;
          const userAvatar = data.google_data?.avatar || data.user?.avatar || googleUser.avatar;

          setRegisterForm((prev: any) => ({
            ...prev,
            email: userEmail,
            name: userName,
            google_id: userGoogleId,
            avatar: userAvatar,
            store_name: prev.store_name || '',
            store_slug: prev.store_slug || ''
          }));
          setStoreSlug('');
          setRegisterStep(2);
          setPortalTab('register');
          window.history.pushState({ tab: 'register', step: 2 }, '', '/register/step-2');
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

  // Handle Login Submit
  
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
        setActiveTab('admin');

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
          setActiveTab('admin');
        } else {
          setActiveTab('admin');
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

  // Handle First Time Password change
  const handleFirstPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFirstPasswordError(null)

    if (firstPasswordForm.password.length < 6) {
      setFirstPasswordError('Password baru minimal 6 karakter.')
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
    setActiveTab('catalog')
  }

  const goToAbout = () => {
    setActiveTab('about')
  }

  const goToArticles = () => {
    setActiveTab('articles')
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
        showToast('Selamat! Toko Anda telah berhasil di-upgrade ke Plan Pro (Unlimited)!')
        loadData()
      } else {
        showToast(data.message || 'Gagal upgrade plan', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat upgrade plan', 'error')
    }
  }

  // Handle Profile Update
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
      setProfileError('Koneksi ke server terputus.')
      showToast('Koneksi internet terputus. Gagal memperbarui profil.', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  // Extract YouTube ID
  const getYoutubeEmbedUrl = (url: string | null) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) 
      ? `https://www.youtube.com/embed/${match[2]}` 
      : '';
  }

  // Rupiah Formatter
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
          if (slug && updated.store_logo_url) {
            cacheLogoAsBase64(slug, updated.store_logo_url);
          }
          localStorage.setItem('catavor_settings', JSON.stringify(updated));
        } catch {}
        document.documentElement.setAttribute('data-theme', updated.store_theme);
        showToast('Pengaturan toko & logo berhasil disimpan!')
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
      const res = await fetch(`${API_BASE}/storage/upload?category=branding`, {
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

  // Open Add Form
  const openCreateSheet = () => {
    if (settings.plan === 'free' && faunas.length >= 10) {
      showToast('Batas listing Plan Gratis (Maksimal 10 item) telah tercapai. Silakan upgrade ke Plan Pro!', 'error')
      return
    }
    resetCrudState('physical')
    setShowProductTypeSelector(true)
    setView('product-type-selector')
  }

  const handleSelectProductType = (type: ItemCategoryType) => {
    setShowProductTypeSelector(false)
    const typeConfig = getItemTypeFormConfig(type);
    const foodPreset = type === 'food' ? CULINARY_SMART_PRESETS['Makanan Siap Santap'] : null;

    // If changing type from within an active form session, adapt type & defaults while preserving user input
    if (isChangingTypeInEditor) {
      setCrudForm(prev => ({
        ...prev,
        product_type: type,
        class: prev.class === 'Umum' || prev.class === 'Reptil' ? typeConfig.defaultCategory : prev.class,
        shipping_coverage: prev.shipping_coverage === 'Bisa Kirim se-Indonesia' ? (foodPreset ? foodPreset.defaultShipping : typeConfig.deliveryOptions[0]) : prev.shipping_coverage
      }))
      setIsChangingTypeInEditor(false)
      setView('fauna-editor')
      return
    }

    // New item creation: completely fresh reset for the selected type
    resetCrudState(type)
    setView('fauna-editor')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExitProductTypeSelector = () => {
    setShowProductTypeSelector(false)
    if (isChangingTypeInEditor) {
      setView('fauna-editor')
      setIsChangingTypeInEditor(false)
    } else {
      resetCrudState('physical')
      setView('tabs')
      setActiveTab('admin')
      setAdminSubTab('items')
    }
  }

  // Open Edit Form
  const openEditSheet = (item: Fauna) => {
    setCrudMode('edit')
    setEditId(item.id)
    const itemType = (item.product_type || 'physical') as ItemCategoryType;
    const typeConfig = getItemTypeFormConfig(itemType);

    const minOrderVal = item.min_order ?? item.attributes?.min_order ?? 1;
    const maxOrderVal = (item.max_order !== null && item.max_order !== undefined) ? item.max_order : (item.attributes?.max_order ?? '');
    const isRekberEnabled = item.detailed_info?.enable_wa_rekber !== undefined
      ? Boolean(item.detailed_info.enable_wa_rekber)
      : (item.attributes?.enable_wa_rekber !== undefined ? Boolean(item.attributes.enable_wa_rekber) : true);
    const isDirectEnabled = item.detailed_info?.enable_wa_direct !== undefined
      ? Boolean(item.detailed_info.enable_wa_direct)
      : (item.attributes?.enable_wa_direct !== undefined ? Boolean(item.attributes.enable_wa_direct) : true);

    setCrudForm({
      name: item.name,
      scientific_name: item.scientific_name || '',
      class: item.class || typeConfig.defaultCategory,
      habitat: item.habitat || 'General',
      diet: item.diet || '',
      conservation_status: item.conservation_status || 'Tersedia',
      price: item.price,
      min_order: minOrderVal,
      max_order: maxOrderVal,
      video_url: item.video_url || '',
      is_shipping_available: item.is_shipping_available,
      description: item.description,
      image_url: item.image_url,
      native_region: item.detailed_info?.native_region || '',
      lifespan: item.detailed_info?.lifespan || '',
      weight: item.detailed_info?.weight || '',
      shipping_terms: item.detailed_info?.shipping_terms || '',
      warranty_info: item.detailed_info?.warranty_info || '',
      shipping_coverage: item.detailed_info?.shipping_coverage || (item.is_shipping_available ? typeConfig.deliveryOptions[0] : 'Ambil Sendiri di Toko (No Shipping)'),
      purchase_links: item.detailed_info?.purchase_links || [
        ...(item.detailed_info?.shopee_url ? [{ platform: 'Shopee', url: item.detailed_info.shopee_url }] : []),
        ...(item.detailed_info?.tokopedia_url ? [{ platform: 'Tokopedia', url: item.detailed_info.tokopedia_url }] : []),
        ...(item.detailed_info?.lazada_url ? [{ platform: 'Lazada', url: item.detailed_info.lazada_url }] : []),
        ...(item.detailed_info?.bukalapak_url ? [{ platform: 'Bukalapak', url: item.detailed_info.bukalapak_url }] : []),
        ...(item.detailed_info?.custom_shop_url ? [{ platform: item.detailed_info.custom_shop_name || 'Marketplace', url: item.detailed_info.custom_shop_url }] : [])
      ],
      enable_wa_rekber: isRekberEnabled,
      enable_wa_direct: isDirectEnabled,
      product_type: itemType,
      attributes: {
        condition: (item.attributes?.condition as any) || 'Baru',
        weight: item.attributes?.weight ?? 100,
        brand: item.attributes?.brand || '',
        variant: item.attributes?.variant || '',
        file_format: item.attributes?.file_format || 'PDF',
        file_size: item.attributes?.file_size || '10 MB',
        license_type: item.attributes?.license_type || 'Lisensi Personal',
        duration: item.attributes?.duration || '1 Sesi / 1 Jam',
        service_location: item.attributes?.service_location || 'Datang ke Toko',
        service_area: item.attributes?.service_area || 'Jabodetabek',
        transaction_type: (item.attributes?.transaction_type as any) || 'Dijual',
        certificate: item.attributes?.certificate || 'SHM (Sertifikat Hak Milik)',
        land_area: String(item.attributes?.land_area || '120'),
        building_area: String(item.attributes?.building_area || '90'),
        bedrooms: item.attributes?.bedrooms ?? 3,
        bathrooms: item.attributes?.bathrooms ?? 2,
        floors: String(item.attributes?.floors || '2 Lantai'),
        electricity: item.attributes?.electricity || '2200 VA',
        water_source: item.attributes?.water_source || 'PDAM & Sumur Bor',
        furnishing: item.attributes?.furnishing || 'Semi-Furnished',
        carport: item.attributes?.carport || '1 Mobil',
        facing: item.attributes?.facing || 'Timur',
        property_location: item.attributes?.property_location || 'BSD City, Tangerang Selatan',
        facilities: item.attributes?.facilities || 'One Gate System, Keamanan 24 Jam, Taman Bermain, Akses Jalan 2 Mobil',
        halal_status: item.attributes?.halal_status || 'Bersertifikat Halal Resmi (BPJPH / MUI)'
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
    setView('fauna-editor')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Save Item
  const handleFaunaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCrudLoading(true)
    setCrudError(null)

    const filteredImages = crudImages.map(img => img.trim()).filter(Boolean)
    if (filteredImages.length === 0) {
      setCrudError('Minimal harus mengunggah 1 foto item.')
      setCrudLoading(false)
      return
    }
    if (filteredImages.length > 5) {
      setCrudError('Maksimal hanya dapat mengunggah 5 foto item.')
      setCrudLoading(false)
      return
    }

    const selectedClass = showCustomClassInput ? customClass.trim() : crudForm.class
    const selectedHabitat = showCustomHabitatInput ? customHabitat.trim() : crudForm.habitat
    const selectedConservationStatus = showCustomConservationStatusInput ? customConservationStatus.trim() : crudForm.conservation_status
    const termsVal = (crudForm.shipping_terms || '').trim()
    const isNoShipping = termsVal.toLowerCase().includes('ambil sendiri') || termsVal.toLowerCase().includes('no shipping') || termsVal.toLowerCase().includes('pickup only')

    if (!selectedClass) {
      setCrudError('Kategori item wajib diisi.')
      setCrudLoading(false)
      return
    }

    const minOrderNum = Math.max(1, parseInt(String(crudForm.min_order)) || 1);
    const maxOrderParsed = crudForm.max_order !== '' && crudForm.max_order !== null && crudForm.max_order !== undefined ? parseInt(String(crudForm.max_order)) : null;
    const maxOrderNum = (maxOrderParsed && maxOrderParsed > 0) ? Math.max(minOrderNum, maxOrderParsed) : null;

    const payload = {
      name: crudForm.name,
      scientific_name: crudForm.product_type === 'fauna' ? (crudForm.scientific_name || '') : '',
      class: selectedClass || 'Umum',
      habitat: selectedHabitat || 'General',
      diet: crudForm.diet || 'N/A',
      conservation_status: selectedConservationStatus || 'Tersedia',
      price: crudForm.price,
      min_order: minOrderNum,
      max_order: maxOrderNum,
      video_url: crudForm.video_url || null,
      is_shipping_available: !isNoShipping,
      description: crudForm.description,
      image_url: filteredImages[0],
      product_type: crudForm.product_type,
      attributes: {
        ...crudForm.attributes,
        min_order: minOrderNum,
        max_order: maxOrderNum,
        file_format: crudForm.attributes.file_format || 'PDF',
        enable_wa_rekber: crudForm.enable_wa_rekber !== false,
        enable_wa_direct: crudForm.enable_wa_direct !== false
      },
      detailed_info: {
        native_region: crudForm.native_region,
        lifespan: crudForm.lifespan,
        weight: crudForm.weight,
        shipping_terms: termsVal,
        warranty_info: crudForm.product_type === 'service' ? '' : crudForm.warranty_info,
        shipping_coverage: termsVal || 'Bisa Kirim se-Indonesia',
        images: filteredImages,
        purchase_links: crudForm.purchase_links.filter(link => link.platform.trim() !== '' && link.url.trim() !== ''),
        enable_wa_rekber: crudForm.enable_wa_rekber !== false,
        enable_wa_direct: crudForm.enable_wa_direct !== false
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
        setShowCrudSheet(false)
        setView('tabs')
        setActiveTab('admin')
        setAdminSubTab('items')
        resetCrudState('physical')
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
          setCrudError(data.message || 'Gagal menyimpan data.')
          showToast(data.message || 'Gagal menyimpan data satwa.', 'error')
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
      const res = await fetch(`${API_BASE}/storage/upload?category=products`, {
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
    const fromMaster = masterCategories[productType] || [];
    const fromDefaults = DEFAULT_MASTER_CATEGORIES[productType] || [];
    const customUsed = faunas
      .filter(f => (f.product_type || 'physical') === productType && f.class)
      .map(f => f.class);
    
    const merged = Array.from(new Set([...fromDefaults, ...fromMaster, ...customUsed])).filter(Boolean);
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
      const res = await fetch(`${API_BASE}/storage/upload?category=articles`, {
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

  const openAddArticleSheet = () => {
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

  const openEditArticleSheet = (article: Article) => {
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
      if (data.success) {
        setView('tabs')
        setActiveTab('admin')
        setAdminSubTab('articles')
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
        body: JSON.stringify({ field, value: trimmed, product_type: field === 'class' ? masterCategoryContextTab : undefined })
      })
      const data = await res.json()
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
        body: JSON.stringify({ field, old_value: oldValue, new_value: trimmed, product_type: field === 'class' ? masterCategoryContextTab : undefined })
      })
      const data = await res.json()
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

  // Delete Item
  const handleFaunaDelete = async (id: number): Promise<boolean> => {
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

  // Open Details Sheet
  const openDetailsSheet = async (id: number) => {
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
      alert('Gagal memuat detail.')
    }
  }

  // Get recommendations for mobile (3-Tier Waterfall Algorithm: Same Class+Type -> Same Type -> Other Store Items)
  const getRecommendations = (fauna: Fauna) => {
    if (!faunas || faunas.length <= 1) return []
    const otherFaunas = faunas.filter(f => f.id !== fauna.id)
    
    // Tier 1: Kategori & Tipe Produk sama persis
    const tier1 = otherFaunas.filter(f => f.class === fauna.class && f.product_type === fauna.product_type)
    
    // Tier 2: Tipe Produk sama, tetapi kategori berbeda
    const tier2 = otherFaunas.filter(f => f.product_type === fauna.product_type && f.class !== fauna.class)
    
    // Tier 3: Sisa katalog lainnya di toko
    const tier3 = otherFaunas.filter(f => f.product_type !== fauna.product_type)
    
    return [...tier1, ...tier2, ...tier3].slice(0, 4)
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
      case 'nordic':
        return {
          bg: '#0f141a',
          bgGradient: 'radial-gradient(circle at 50% 35%, rgba(91, 124, 153, 0.22) 0%, rgba(15, 20, 26, 0.98) 70%)',
          cardBg: '#17202a',
          logoBoxBg: '#ffffff',
          logoBoxBorder: '1px solid rgba(142, 176, 204, 0.35)',
          logoBoxShadow: '0 10px 30px rgba(91, 124, 153, 0.25)',
          titleColor: '#f8fafc',
          subtitleColor: '#cbd5e1',
          trackBg: 'rgba(91, 124, 153, 0.18)',
          accent: '#5b7c99'
        };
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
        padding: '1.5rem',
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
            width: '68px',
            height: '68px',
            borderRadius: '1.15rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.28)',
            marginBottom: '1.15rem'
          }}>
            <Store size={32} />
          </div>
        ) : (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '1.25rem',
            backgroundColor: themeStyles.logoBoxBg,
            border: themeStyles.logoBoxBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.65rem',
            boxShadow: themeStyles.logoBoxShadow,
            marginBottom: '1.25rem'
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
          margin: '0 0 0.3rem 0',
          fontSize: '1.2rem',
          fontWeight: 800,
          color: themeStyles.titleColor,
          letterSpacing: '-0.02em'
        }}>
          {displayTitle}
        </h3>
        
        {/* Subtitle */}
        <p style={{
          margin: 0,
          fontSize: '0.78rem',
          color: themeStyles.subtitleColor,
          fontWeight: 500,
          letterSpacing: '0.01em',
          textAlign: 'center'
        }}>
          {displaySubtitle}
        </p>

        {/* Minimalist Progress Line */}
        <div style={{
          width: '120px',
          height: '2.5px',
          backgroundColor: themeStyles.trackBg,
          borderRadius: '2px',
          marginTop: '1.25rem',
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
            marginTop: '1.15rem', 
            padding: '0.2rem 0.65rem', 
            borderRadius: '999px', 
            background: '#eff6ff', 
            border: '1px solid #bfdbfe', 
            color: '#1d4ed8', 
            fontSize: '0.7rem', 
            fontWeight: 700 
          }}>
            <Sparkles size={12} />
            <span>Memuat Platform...</span>
          </div>
        )}
      </div>
    );
  }

  // Render Landing Portal Page (Mobile Responsive Layout)
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
        {/* Mobile Toast Notification */}
        {simulatedOrderToast && (
          <div style={{ position: 'fixed', bottom: '1rem', left: '1rem', right: '1rem', zIndex: 99999, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#ffffff', padding: '0.85rem 1rem', borderRadius: '0.85rem', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '0.65rem', border: '1px solid rgba(255,255,255,0.25)', animation: 'slideUpBottomSheet 0.3s ease' }}>
            <MessageCircle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '0.76rem', lineHeight: 1.35 }}>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: '0.1rem' }}>Simulasi Pesanan WhatsApp</div>
              {simulatedOrderToast}
            </div>
            <button type="button" onClick={() => setSimulatedOrderToast(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.85 }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Mobile Product Detail & Order Simulation Modal */}
        {previewProductModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setPreviewProductModal(null)}>
            <div className="animate-fade-in" style={{ width: '100%', maxHeight: '85vh', overflowY: 'auto', borderTopLeftRadius: '1.25rem', borderTopRightRadius: '1.25rem', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '1.25rem', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 -15px 40px rgba(15, 23, 42, 0.2)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ padding: '0.25rem 0.65rem', borderRadius: '999px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 800 }}>
                  {previewProductModal.badge || 'Katalog Produk'}
                </div>
                <button type="button" onClick={() => setPreviewProductModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <img src={previewProductModal.image} alt={previewProductModal.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#0f172a' }}>{previewProductModal.title}</h3>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2563eb', marginBottom: '0.25rem' }}>{previewProductModal.price}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Oleh {previewProductModal.merchant} ({previewProductModal.location})</div>
                </div>
              </div>

              {/* Chat Format Preview Box Mobile */}
              <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MessageCircle size={13} /> Format Pesan WhatsApp Otomatis:
                </div>
                <div style={{ fontSize: '0.74rem', color: '#166534', fontFamily: 'monospace', backgroundColor: '#ffffff', padding: '0.65rem', borderRadius: '0.45rem', border: '1px solid #dcfce7', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
{`Halo ${previewProductModal.merchant}, saya ingin memesan:
• ${previewProductModal.title} (${previewProductModal.price})
Mohon info ketersediaan stok & pengiriman ya!`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button type="button" className="btn-portal-whatsapp" style={{ padding: '0.75rem', justifyContent: 'center', fontSize: '0.82rem', width: '100%' }} onClick={() => {
                  setPreviewProductModal(null);
                  setSimulatedOrderToast(`Format order "${previewProductModal.title}" siap dikirim ke WhatsApp!`);
                  setTimeout(() => setSimulatedOrderToast(null), 4500);
                }}>
                  <MessageCircle size={16} />
                  <span>Simulasi Kirim ke WhatsApp</span>
                </button>
                <button type="button" className="btn-portal-secondary" style={{ padding: '0.65rem', justifyContent: 'center', fontSize: '0.78rem', width: '100%' }} onClick={() => {
                  setPreviewProductModal(null);
                  setRegisterStep(1);
                  setRegisterPlan('free');
                  setPortalTab('register');
                }}>
                  Buat Katalog Saya — Gratis
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Header (Shown on Home and Policy Pages) */}
        {(portalTab === 'home' || ['terms', 'privacy', 'acceptable_use'].includes(portalTab)) && (
          <header className="portal-mobile-header">
            <div className="container">
              {['terms', 'privacy', 'acceptable_use'].includes(portalTab) ? (
                <div className="mobile-header-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <button type="button" onClick={() => setPortalTab(previousPortalTab || 'home')} className="btn-back-circle" title="Kembali" style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}>
                    <ChevronLeft size={20} />
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {portalTab === 'terms' ? 'Syarat & Ketentuan' : portalTab === 'privacy' ? 'Kebijakan Privasi' : 'Ketentuan Penggunaan'}
                  </span>
                </div>
              ) : (
                <div className="mobile-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }} onClick={() => setPortalTab('home')}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                      <Store size={16} />
                    </div>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Catavor
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {token ? (
                      <button className="btn-portal-primary" onClick={() => {
                        const user = JSON.parse(localStorage.getItem('catavor_user') || '{}');
                        if (user.store_slug) {
                          setStoreSlug(user.store_slug);
                          setActiveTab('admin');
                        }
                      }} style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}>
                        <span>Dashboard</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <>
                        <button 
                          type="button"
                          onClick={() => setPortalTab('login')} 
                          style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 0.5rem', cursor: 'pointer' }}
                        >
                          Masuk
                        </button>
                        <button 
                          type="button"
                          className="btn-portal-primary" 
                          onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }} 
                          style={{ padding: '0.38rem 0.8rem', fontSize: '0.74rem', fontWeight: 800, borderRadius: '0.5rem' }}
                        >
                          Buat Katalog
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>
        )}

        {portalTab === 'home' && (
          <>
            <main style={{ padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              {/* HERO SECTION MOBILE */}
              <div style={{ textAlign: 'center' }}>
                <div className="hero-pill-badge-clean" style={{ marginBottom: '1rem' }}>
                  <Sparkles size={12} />
                  <span>Katalog Digital &amp; Biolink Multi-Usaha</span>
                </div>

                <h1 style={{ fontSize: '2.15rem', fontWeight: 900, lineHeight: 1.18, letterSpacing: '-0.03em', marginBottom: '0.85rem', color: '#0f172a' }}>
                  Katalog Interaktif untuk <span style={{ color: '#2563eb' }}>Segala Jenis Usaha</span>
                </h1>

                <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Gantikan buku menu fisik atau PDF kaku dengan link katalog web responsif yang terhubung langsung ke WhatsApp tanpa potongan komisi.
                </p>

                {/* Mobile Value Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.75rem' }}>
                  <span className="hero-value-pill-clean"><Zap size={12} style={{ color: '#2563eb' }} /> 60 Detik Siap</span>
                  <span className="hero-value-pill-clean"><MessageCircle size={12} style={{ color: '#16a34a' }} /> WhatsApp Direct</span>
                  <span className="hero-value-pill-clean"><ShieldCheck size={12} style={{ color: '#2563eb' }} /> 0% Komisi</span>
                  <span className="hero-value-pill-clean"><QrCode size={12} style={{ color: '#2563eb' }} /> QR Code Instan</span>
                </div>

                {/* Primary CTA Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '2rem' }}>
                  <button className="btn-portal-primary" style={{ padding: '0.85rem', fontSize: '0.88rem', fontWeight: 800, justifyContent: 'center' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                    <span>Mulai Buat Katalog — Gratis</span>
                    <ArrowRight size={16} />
                  </button>
                  <button className="btn-portal-secondary" style={{ padding: '0.8rem', fontSize: '0.84rem', justifyContent: 'center' }} onClick={() => {
                    const el = document.getElementById('pricing-mobile');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <span>Lihat Paket &amp; Harga</span>
                  </button>
                </div>

                {/* Mobile Store Preview Mockup */}
                <div className="portal-card" style={{ padding: '1rem', textAlign: 'left', borderRadius: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 900, fontSize: '0.9rem' }}>
                        M
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Maison &amp; Coffee <CheckCircle2 size={13} style={{ color: '#2563eb' }} />
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>catavor.com/maison-coffee</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#15803d', background: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
                      🟢 Buka
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', padding: '0.65rem', borderRadius: '0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                    <img src="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=150&auto=format&fit=crop&q=80" alt="Cold brew" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Artisan Cold Brew</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563eb' }}>Rp 28.000</div>
                    </div>
                    <button type="button" className="btn-portal-whatsapp" onClick={() => {
                      setSimulatedOrderToast('Pesanan "Artisan Cold Brew" siap diteruskan ke WhatsApp!');
                      setTimeout(() => setSimulatedOrderToast(null), 4000);
                    }} style={{ padding: '0.35rem 0.65rem', fontSize: '0.68rem', fontWeight: 700 }}>
                      Pesan
                    </button>
                  </div>
                </div>
              </div>

              {/* MULTI-INDUSTRY LIVE CATALOG EXPLORER MOBILE */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategori Usaha</span>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                    Katalog untuk Segala Industri
                  </h2>
                </div>

                {/* Horizontal Scrollable Tabs */}
                <div style={{ display: 'flex', overflowX: 'auto', gap: '0.5rem', paddingBottom: '0.75rem', scrollbarWidth: 'none' }}>
                  {LANDING_INDUSTRIES.map((ind) => {
                    const IconCmp = ind.icon;
                    const isActive = landingCategory === ind.id;
                    return (
                      <button 
                        key={ind.id}
                        type="button" 
                        className={`industry-tab-btn-clean-mobile ${isActive ? 'active' : ''}`}
                        onClick={() => setLandingCategory(ind.id as any)}
                      >
                        <IconCmp size={15} style={{ color: ind.color }} />
                        <span>{ind.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Category Description Mobile */}
                <div style={{ padding: '1rem', borderRadius: '0.85rem', background: activeIndustryData.accentBg, border: `1px solid ${activeIndustryData.color}33`, marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>{activeIndustryData.tagline}</div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.45 }}>{activeIndustryData.description}</div>
                </div>

                {/* Product Cards Mobile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {activeIndustryData.products.map((item) => (
                    <div key={item.id} className="catalog-demo-card-clean-mobile">
                      <div className="catalog-demo-img-box-clean-mobile">
                        <img src={item.image} alt={item.title} />
                        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}>
                            {item.category}
                          </span>
                          {item.badge && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '999px', background: '#2563eb', color: '#ffffff' }}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                          <span>{item.merchant} ({item.location})</span>
                          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: 700 }}>
                            <Star size={11} fill="#f59e0b" /> {item.rating}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{item.title}</h3>
                        <p style={{ fontSize: '0.76rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>{item.description}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2563eb' }}>{item.price}</span>
                          <button 
                            type="button" 
                            onClick={() => setPreviewProductModal(item)}
                            className="btn-portal-whatsapp" 
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.74rem' }}
                          >
                            <MessageCircle size={13} />
                            <span>Pesan via WA</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* VALUE PILLARS MOBILE */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Keunggulan</span>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                    Kenapa Pilih Catavor?
                  </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Image size={20} style={{ color: '#2563eb' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>WebP High-Res</h4>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Foto produk tajam dengan kompresi otomatis kilat.</p>
                  </div>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <MessageCircle size={20} style={{ color: '#16a34a' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>WhatsApp Order</h4>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Format pesan terstruktur rapi siap diproses.</p>
                  </div>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Palette size={20} style={{ color: '#d97706' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>5 Pilihan Tema</h4>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Sesuaikan palet visual dengan identitas brand.</p>
                  </div>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <QrCode size={20} style={{ color: '#7c3aed' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>QR Code Kasir</h4>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Unduh file QR Code siap cetak di kasir/meja.</p>
                  </div>
                </div>
              </div>

              {/* HOW IT WORKS MOBILE */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Cara Kerja</span>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                    3 Langkah Mudah
                  </h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                    <div>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.15rem 0' }}>Klaim Tautan Katalog</h4>
                      <p style={{ fontSize: '0.73rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Daftar akun &amp; klaim link unik catavor.com/namatoko.</p>
                    </div>
                  </div>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                    <div>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.15rem 0' }}>Upload Foto &amp; Atur Harga</h4>
                      <p style={{ fontSize: '0.73rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Unggah produk, varian harga, &amp; jam buka toko.</p>
                    </div>
                  </div>
                  <div className="portal-card" style={{ padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                    <div>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.15rem 0' }}>Bagikan di Bio &amp; Kasir</h4>
                      <p style={{ fontSize: '0.73rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>Pasang link di bio medsos &amp; terima order via WA.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PRICING SECTION MOBILE */}
              <div id="pricing-mobile">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Pilihan Paket</span>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                    Paket Bisnis Sesuai Kebutuhan
                  </h2>

                  {/* Monthly vs Annual Toggle */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem', borderRadius: '999px', background: '#f1f5f9', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setPricingBillingCycle('monthly')}
                      style={{ padding: '0.35rem 0.95rem', borderRadius: '999px', border: 'none', background: pricingBillingCycle === 'monthly' ? '#2563eb' : 'transparent', color: pricingBillingCycle === 'monthly' ? '#ffffff' : '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Bulanan
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPricingBillingCycle('yearly')}
                      style={{ padding: '0.35rem 0.95rem', borderRadius: '999px', border: 'none', background: pricingBillingCycle === 'yearly' ? '#2563eb' : 'transparent', color: pricingBillingCycle === 'yearly' ? '#ffffff' : '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Tahunan (-20%)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Free Card Mobile */}
                  <div className="portal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Plan Free (Starter)</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        Rp 0 <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>/ selamanya</span>
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem', color: '#334155' }}>
                      <li>✅ Maksimal 10 postingan produk</li>
                      <li>✅ Subdomain kustom (catavor.com/tokomu)</li>
                      <li>✅ WhatsApp Direct Order 1-klik</li>
                      <li>✅ Download QR Code toko siap cetak</li>
                    </ul>
                    <button className="btn-portal-secondary" style={{ padding: '0.75rem', fontSize: '0.82rem', justifyContent: 'center' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                      Daftar Plan Gratis
                    </button>
                  </div>

                  {/* Pro Card Mobile */}
                  <div className="portal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid #2563eb' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Plan Pro (Unlimited)</span>
                        <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#2563eb', color: '#ffffff', fontWeight: 800 }}>POPULER</span>
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        {pricingBillingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 24.000'} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>/ bulan</span>
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem', color: '#0f172a' }}>
                      <li>✨ <strong>Unlimited</strong> produk &amp; layanan</li>
                      <li>✨ Halaman <strong>"Tentang Kami" kustom</strong></li>
                      <li>✨ <strong>100% Bebas Watermark</strong> Catavor</li>
                      <li>✨ Multi-marketplace link (Shopee, Tokopedia)</li>
                      <li>✨ Akses seluruh 5 tema warna</li>
                    </ul>
                    <button className="btn-portal-primary" style={{ padding: '0.75rem', fontSize: '0.82rem', fontWeight: 800, justifyContent: 'center' }} onClick={() => { setRegisterStep(1); setRegisterPlan('pro'); setPortalTab('register'); }}>
                      Daftar Plan Pro Sekarang
                    </button>
                  </div>
                </div>
              </div>
              {/* FEATURED STORES DIRECTORY MOBILE */}
              {featuredStores && featuredStores.length > 0 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Katalog Bisnis Aktif</span>
                    <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                      Jelajahi Toko &amp; Katalog Nyata
                    </h2>
                    
                    {/* Mobile Search Input for Stores */}
                    <div style={{ marginTop: '0.85rem', position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Cari nama toko / bidang usaha..." 
                        value={searchStoreQuery}
                        onChange={(e) => setSearchStoreQuery(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.4rem', fontSize: '0.82rem' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {filteredStores.slice(0, 6).map((st: any) => (
                      <div 
                        key={st.id || st.slug} 
                        className="portal-card" 
                        style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                        onClick={() => {
                          if (st.slug) {
                            setStoreSlug(st.slug);
                            setActiveTab('catalog');
                          }
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                            {st.store_logo_url ? (
                              <img src={st.store_logo_url} alt={st.store_title} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem', border: '1px solid #bfdbfe' }}>
                                {(st.store_title || 'T')[0]}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {st.store_title || 'Toko Bisnis'}
                              </h4>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>catavor.com/{st.slug}</div>
                            </div>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.65rem 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {st.store_slogan || st.store_description || 'Katalog digital resmi terpercaya di platform Catavor.'}
                          </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                          <span>Buka Katalog Toko</span>
                          <ArrowRight size={13} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ ACCORDION MOBILE */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Pusat Bantuan</span>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 900, marginTop: '0.25rem', color: '#0f172a' }}>
                    Pertanyaan Umum
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {LANDING_FAQS.map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} className={`faq-accordion-clean-mobile ${isOpen ? 'active' : ''}`}>
                        <div 
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', margin: 0, flex: 1, paddingRight: '0.5rem' }}>
                            {faq.q}
                          </h4>
                          <ChevronDown size={16} style={{ color: isOpen ? '#2563eb' : '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                        </div>
                        {isOpen && (
                          <div style={{ padding: '0 1rem 1rem 1rem', fontSize: '0.76rem', color: '#475569', lineHeight: 1.55, borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MOBILE BOTTOM CTA */}
              <div style={{ padding: '2rem 1.25rem', borderRadius: '1.15rem', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: '#ffffff', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                  Mulai Digitalisasi Katalog Usaha Anda
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#dbeafe', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
                  Buat katalog digital profesional Anda dalam 60 detik. Gratis selamanya.
                </p>
                <button className="btn-portal-secondary" style={{ padding: '0.8rem', fontSize: '0.85rem', fontWeight: 800, justifyContent: 'center', width: '100%', color: '#1d4ed8' }} onClick={() => { setRegisterStep(1); setRegisterPlan('free'); setPortalTab('register'); }}>
                  <span>Buat Katalog Sekarang</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </main>
            
            {renderMobileFooter()}
          </>
        )}

        {/* LOGIN TAB VIEW MOBILE - CLEAN MODERN COMMERCE */}
        {portalTab === 'login' && (
          <div style={{ padding: '2.5rem 1.25rem', maxWidth: '420px', margin: '0 auto' }}>
            <div className="portal-card" style={{ padding: '1.75rem 1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto', border: '1px solid #bfdbfe' }}>
                  <Lock size={22} />
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Masuk Administrator</h2>
                <p style={{ color: '#64748b', fontSize: '0.78rem', margin: 0 }}>Kelola profil &amp; katalog bisnis Anda</p>
              </div>
              
              {loginError && (
                <div className="alert-message alert-danger" style={{ marginBottom: '1rem' }}>
                  {loginError}
                </div>
              )}

              {/* Google SSO Login Button Mobile */}
              <button 
                type="button" 
                onClick={handleGoogleSSO}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '0.65rem', 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  color: '#334155', 
                  fontSize: '0.82rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem', 
                  marginBottom: '1.25rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>ATAU MASUK MANUAL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Email Administrator</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="nama@email.com" 
                    required 
                    value={loginForm.email} 
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Kata Sandi</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Ketik kata sandi..." 
                    required 
                    value={loginForm.password} 
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-portal-primary" style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', fontSize: '0.85rem' }} disabled={loginLoading}>
                  {loginLoading ? 'Memproses...' : 'Masuk Dashboard'}
                </button>
                <button 
                  type="button" 
                  className="btn-portal-secondary" 
                  style={{ width: '100%', padding: '0.65rem', justifyContent: 'center', fontSize: '0.78rem' }}
                  onClick={() => {
                    setPortalTab('home');
                    setLoginError(null);
                  }}
                >
                  <Home size={15} />
                  <span>Kembali ke Beranda</span>
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.76rem', color: '#64748b' }}>
                Belum punya akun? <span style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700 }} onClick={() => { setRegisterStep(1); setPortalTab('register'); }}>Daftar Gratis</span>
              </div>
            </div>
          </div>
        )}

        {/* REGISTER TAB VIEW MOBILE - CLEAN MODERN COMMERCE */}
        {portalTab === 'register' && (
          <div style={{ padding: '2.5rem 1.25rem', maxWidth: '460px', margin: '0 auto' }}>
            <div className="portal-card animate-fade-in" style={{ padding: '1.75rem 1.35rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.65rem auto', border: '1px solid #bfdbfe' }}>
                  <Store size={22} />
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                  Buat Katalog Bisnis
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.76rem', margin: 0 }}>
                  Katalog Online &amp; Biolink Terhubung Langsung ke WhatsApp
                </p>
              </div>

              {/* 3-Step Progress Indicator Clean Mobile */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.1rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: registerStep >= 1 ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep >= 1 ? '#2563eb' : '#e2e8f0', color: registerStep >= 1 ? '#ffffff' : '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 900 }}>1</span>
                    Akun
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: registerStep >= 2 ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep >= 2 ? '#2563eb' : '#e2e8f0', color: registerStep >= 2 ? '#ffffff' : '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 900 }}>2</span>
                    Profil Toko
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: registerStep === 3 ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: registerStep === 3 ? '#2563eb' : '#e2e8f0', color: registerStep === 3 ? '#ffffff' : '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 900 }}>3</span>
                    Pilih Paket
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: registerStep === 1 ? '33.3%' : registerStep === 2 ? '66.6%' : '100%', height: '100%', background: '#2563eb', transition: 'all 0.3s ease-in-out' }} />
                </div>
              </div>

              {registerError && (
                <div 
                  id="register-error-banner-mobile"
                  style={{ 
                    marginBottom: '1rem', 
                    fontSize: '0.76rem', 
                    borderRadius: '0.65rem', 
                    padding: '0.75rem 0.85rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    lineHeight: 1.4,
                    fontWeight: 600
                  }}
                >
                  <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '0.1rem' }} />
                  <div style={{ flex: 1 }}>{registerError}</div>
                </div>
              )}

              {/* STEP 1: Account & Email / Google SSO Mobile */}
              {registerStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Google SSO Register Button Mobile */}
                  <button 
                    type="button" 
                    onClick={handleGoogleSSO}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '0.65rem', 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #cbd5e1', 
                      color: '#334155', 
                      fontSize: '0.82rem', 
                      fontWeight: 700, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '0.5rem', 
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>ATAU DAFTAR MANUAL</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                  </div>

                  <form 
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!validateStep1()) {
                        setRegisterError('Mohon periksa kembali isian Anda. Lengkapi bidang formulir yang belum diisi.');
                        return;
                      }
                      setRegisterError(null);
                      setFieldErrors({});
                      setRegisterStep(2);
                    }} 
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                  >
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Nama Lengkap Pemilik *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Contoh: Budi Santoso" 
                        value={registerForm.name} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, name: e.target.value });
                          if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                        }}
                      />
                      {fieldErrors.name && (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>{fieldErrors.name}</div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Email *</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="nama@domain.com" 
                        value={registerForm.email} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, email: e.target.value });
                          if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                        }}
                      />
                      {fieldErrors.email && (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>{fieldErrors.email}</div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Kata Sandi *</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Minimal 6 karakter..." 
                        value={registerForm.password} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, password: e.target.value });
                          if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                        }}
                      />
                      {fieldErrors.password && (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>{fieldErrors.password}</div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      className="btn-portal-primary" 
                      style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', fontSize: '0.85rem', marginTop: '0.35rem' }}
                    >
                      <span>Lanjut ke Informasi Usaha</span>
                      <ChevronRight size={15} />
                    </button>
                    <button 
                      type="button" 
                      className="btn-portal-secondary" 
                      style={{ width: '100%', padding: '0.65rem', justifyContent: 'center', fontSize: '0.78rem' }}
                      onClick={() => {
                        resetRegisterFormState();
                        setPortalTab('home');
                      }}
                    >
                      <Home size={15} />
                      <span>Kembali ke Beranda</span>
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 2: Store Information Mobile */}
              {registerStep === 2 && (
                <form 
                  noValidate
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!validateStep2()) {
                      setRegisterError('Mohon periksa kembali isian Anda. Lengkapi bidang formulir yang belum diisi.');
                      return;
                    }

                    setRegisterLoading(true);
                    setRegisterError(null);
                    try {
                      const res = await fetch(`${API_BASE}/check-slug/${registerForm.store_slug.toLowerCase()}`);
                      const data = await res.json();
                      if (!data.available) {
                        const errMsg = `Link username "${registerForm.store_slug}" sudah digunakan. Silakan pilih username lain.`;
                        setRegisterError(errMsg);
                        setFieldErrors(prev => ({ ...prev, store_slug: errMsg }));
                        setSlugStatus({ available: false, message: errMsg });
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
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                >
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Nama Toko / Usaha *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: Kopi Senja Roastery" 
                      value={registerForm.store_name} 
                      onChange={(e) => {
                        setRegisterForm({ ...registerForm, store_name: e.target.value });
                        if (fieldErrors.store_name) setFieldErrors(prev => ({ ...prev, store_name: '' }));
                      }}
                    />
                    {fieldErrors.store_name && (
                      <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>{fieldErrors.store_name}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Link Tautan Katalog *</label>
                    <div style={{ display: 'flex', alignItems: 'center', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', overflow: 'hidden', paddingLeft: '0.65rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, userSelect: 'none' }}>catavor.com/</span>
                      <input 
                        type="text" 
                        placeholder="toko-saya" 
                        value={registerForm.store_slug} 
                        onChange={(e) => {
                          setRegisterForm({ ...registerForm, store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') });
                          if (fieldErrors.store_slug) setFieldErrors(prev => ({ ...prev, store_slug: '' }));
                        }}
                        style={{ flex: 1, padding: '0.65rem 0.5rem', fontSize: '0.85rem', border: 'none', outline: 'none', color: '#0f172a' }}
                      />
                    </div>
                    {slugChecking && (
                      <div style={{ fontSize: '0.7rem', color: '#2563eb', marginTop: '0.3rem' }}>Memeriksa ketersediaan username...</div>
                    )}
                    {!slugChecking && slugStatus && (
                      <div style={{ fontSize: '0.7rem', color: slugStatus.available ? '#16a34a' : '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>
                        {slugStatus.message}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <button 
                      type="button" 
                      className="btn-portal-secondary" 
                      style={{ padding: '0.65rem 0.85rem', fontSize: '0.78rem' }}
                      onClick={() => setRegisterStep(1)}
                    >
                      <ChevronLeft size={15} />
                      <span>Kembali</span>
                    </button>
                    <button 
                      type="submit" 
                      className="btn-portal-primary" 
                      style={{ flex: 1, padding: '0.65rem', justifyContent: 'center', fontSize: '0.82rem' }}
                      disabled={registerLoading}
                    >
                      <span>{registerLoading ? 'Memeriksa...' : 'Lanjut ke Pilih Paket'}</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Plan Selection Mobile */}
              {registerStep === 3 && (
                <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Free Plan Card Mobile */}
                    <div 
                      onClick={() => setRegisterPlan('free')}
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '0.75rem', 
                        border: registerPlan === 'free' ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                        backgroundColor: registerPlan === 'free' ? '#eff6ff' : '#ffffff', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: registerPlan === 'free' ? '#1d4ed8' : '#0f172a' }}>Plan Free (Starter)</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>Rp 0 <small style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>/selamanya</small></span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
                        ✅ 10 postingan produk • Direct WA • QR Code
                      </div>
                    </div>

                    {/* Pro Plan Card Mobile */}
                    <div 
                      onClick={() => setRegisterPlan('pro')}
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '0.75rem', 
                        border: registerPlan === 'pro' ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                        backgroundColor: registerPlan === 'pro' ? '#eff6ff' : '#ffffff', 
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ position: 'absolute', top: '-8px', right: '12px', background: '#2563eb', color: '#ffffff', fontSize: '0.55rem', fontWeight: 900, padding: '0.12rem 0.5rem', borderRadius: '999px' }}>
                        POPULER
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: registerPlan === 'pro' ? '#1d4ed8' : '#0f172a' }}>Plan Pro (Unlimited)</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>Rp 30.000 <small style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>/bln</small></span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
                        ✨ Unlimited produk • Bebas Watermark • Halaman Profil
                      </div>
                    </div>
                  </div>

                  <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
                    <input 
                      type="checkbox" 
                      id="mobile-register-agree" 
                      checked={agreeTerms} 
                      onChange={(e) => { setAgreeTerms(e.target.checked); if (e.target.checked) setAgreeTermsError(false); }} 
                      style={{ marginTop: '0.15rem', accentColor: '#2563eb', cursor: 'pointer' }} 
                      required 
                    />
                    <label htmlFor="mobile-register-agree" style={{ cursor: 'pointer' }}>
                      Saya menyetujui <span style={{ color: '#2563eb', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); setPreviousPortalTab('register'); setPortalTab('terms'); }}>Syarat &amp; Ketentuan</span> serta <span style={{ color: '#2563eb', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); setPreviousPortalTab('register'); setPortalTab('privacy'); }}>Kebijakan Privasi</span> Catavor.
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <button 
                      type="button" 
                      className="btn-portal-secondary" 
                      style={{ padding: '0.65rem 0.85rem', fontSize: '0.78rem' }}
                      onClick={() => setRegisterStep(2)}
                    >
                      <ChevronLeft size={15} />
                      <span>Kembali</span>
                    </button>
                    <button 
                      type="submit" 
                      className="btn-portal-primary" 
                      style={{ flex: 1, padding: '0.65rem', justifyContent: 'center', fontSize: '0.82rem' }}
                      disabled={registerLoading}
                    >
                      <span>{registerLoading ? 'Mendaftarkan...' : 'Selesaikan & Buka Toko'}</span>
                      <CheckCircle size={15} />
                    </button>
                  </div>
                </form>
              )}

              <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.76rem', color: '#64748b' }}>
                Sudah punya akun? <span style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 700 }} onClick={() => setPortalTab('login')}>Masuk Admin</span>
              </div>
            </div>
          </div>
        )}

        {/* CHECKOUT TAB VIEW MOBILE - CLEAN MODERN COMMERCE */}
        {portalTab === 'checkout' && (
          <div style={{ padding: '2.5rem 1.25rem', maxWidth: '460px', margin: '0 auto', animation: 'fadeIn 0.3s ease-in-out' }}>
            <div className="portal-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="hero-pill-badge-clean" style={{ marginBottom: '0.65rem' }}>
                  <Sparkles size={12} />
                  <span>Aktivasi Paket Pro</span>
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                  Konfirmasi Pembayaran
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.76rem', margin: 0, lineHeight: 1.4 }}>
                  Transfer sesuai nominal berikut untuk mengaktifkan akses Unlimited produk &amp; fitur Pro.
                </p>
              </div>

              {/* Price Calculations Mobile */}
              {(() => {
                const originalPrice = 30000;
                const discountAmount = appliedCoupon ? (appliedCoupon.type === 'free' ? 30000 : appliedCoupon.discount) : 0;
                const finalPrice = Math.max(0, originalPrice - discountAmount);

                return (
                  <>
                    <div style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Paket Berlangganan:</span>
                        <strong style={{ color: '#0f172a' }}>Plan Pro (1 Bulan)</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Harga Normal:</span>
                        <span style={{ textDecoration: 'line-through' }}>Rp 50.000</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#16a34a' }}>
                        <span>Diskon Promo:</span>
                        <strong>- Rp 20.000</strong>
                      </div>
                      {appliedCoupon && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #bbf7d0' }}>
                          <span>Kupon ({appliedCoupon.code}):</span>
                          <strong>- Rp {discountAmount.toLocaleString('id-ID')}</strong>
                        </div>
                      )}

                      {/* Input Box Kode Kupon / Voucher Mobile */}
                      <div style={{ marginTop: '0.25rem', paddingTop: '0.65rem', borderTop: '1px dashed #cbd5e1' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Punya Kode Kupon / Voucher Diskon?</label>
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
                            style={{ flex: 1, padding: '0.55rem 0.65rem', fontSize: '0.78rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a', textTransform: 'uppercase' }}
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
                            style={{ padding: '0.55rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Terapkan
                          </button>
                        </div>

                        {couponMsg && (
                          <div style={{ fontSize: '0.72rem', color: couponMsg.type === 'success' ? '#16a34a' : '#dc2626', marginTop: '0.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {couponMsg.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
                            <span>{couponMsg.text}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
                        <span>Total Pembayaran:</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.15rem', color: finalPrice === 0 ? '#16a34a' : '#2563eb' }}>
                            Rp {finalPrice.toLocaleString('id-ID')}
                          </span>
                          {finalPrice === 0 && (
                            <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: '0.35rem', fontWeight: 800 }}>(GRATIS)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {finalPrice === 0 ? (
                      /* Instant 100% Free Activation Card Mobile */
                      <div style={{ padding: '1.25rem 1rem', borderRadius: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={24} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d', margin: '0 0 0.25rem 0' }}>Aktivasi 100% Gratis!</h3>
                          <p style={{ fontSize: '0.76rem', color: '#166534', margin: 0, lineHeight: 1.4 }}>
                            Kupon Anda berhasil membebaskan biaya pendaftaran Plan Pro. Klik tombol di bawah ini untuk langsung membuat toko &amp; masuk ke Dashboard.
                          </p>
                        </div>
                        <button 
                          type="button" 
                          className="btn-portal-primary" 
                          onClick={() => processCheckoutSubmission(true)}
                          style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', fontSize: '0.85rem', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: 'none' }}
                          disabled={registerLoading}
                        >
                          <Sparkles size={16} />
                          <span>{registerLoading ? 'Mengaktifkan...' : 'Aktifkan Plan Pro Sekarang (Gratis)'}</span>
                        </button>
                        <button 
                          type="button" 
                          className="btn-portal-secondary" 
                          style={{ width: '100%', padding: '0.65rem', justifyContent: 'center', fontSize: '0.78rem' }}
                          onClick={handleCancelCheckout}
                        >
                          <Home size={15} />
                          <span>Batal / Kembali ke Beranda</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Method Switcher Mobile */}
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem', display: 'block' }}>Pilih Metode Pembayaran:</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <button 
                              type="button"
                              onClick={() => setPaymentMethod('bank')}
                              style={{ 
                                padding: '0.65rem 0.5rem', 
                                borderRadius: '0.5rem', 
                                border: paymentMethod === 'bank' ? '2px solid #2563eb' : '1px solid #cbd5e1', 
                                backgroundColor: paymentMethod === 'bank' ? '#eff6ff' : '#ffffff', 
                                color: paymentMethod === 'bank' ? '#1d4ed8' : '#475569',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer'
                              }}
                            >
                              <CreditCard size={15} />
                              <span>Transfer Bank</span>
                            </button>

                            <button 
                              type="button"
                              onClick={() => setPaymentMethod('qris')}
                              style={{ 
                                padding: '0.65rem 0.5rem', 
                                borderRadius: '0.5rem', 
                                border: paymentMethod === 'qris' ? '2px solid #2563eb' : '1px solid #cbd5e1', 
                                backgroundColor: paymentMethod === 'qris' ? '#eff6ff' : '#ffffff', 
                                color: paymentMethod === 'qris' ? '#1d4ed8' : '#475569',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer'
                              }}
                            >
                              <QrCode size={15} />
                              <span>Scan QRIS</span>
                            </button>
                          </div>
                        </div>

                        {/* Bank Details Mobile */}
                        {paymentMethod === 'bank' && (
                          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                              <span style={{ color: '#64748b' }}>Bank Tujuan:</span>
                              <strong style={{ color: '#0f172a' }}>{settings.payment_bank_name || 'BCA (Bank Central Asia)'}</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '0.45rem', border: '1px solid #e2e8f0' }}>
                              <div>
                                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Nomor Rekening:</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{settings.payment_bank_account || '8830-1928-3920'}</div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText((settings.payment_bank_account || '8830-1928-3920').replace(/[^0-9]/g, ''));
                                  setCopiedAccountToast(true);
                                  setTimeout(() => setCopiedAccountToast(false), 2500);
                                }}
                                className="btn-portal-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem' }}
                              >
                                {copiedAccountToast ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedAccountToast ? 'Disalin!' : 'Salin'}</span>
                              </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                              <span style={{ color: '#64748b' }}>Atas Nama:</span>
                              <strong style={{ color: '#0f172a' }}>{settings.payment_bank_holder || 'PT Catavor Media Digital'}</strong>
                            </div>
                          </div>
                        )}

                        {/* QRIS Details Mobile */}
                        {paymentMethod === 'qris' && (
                          <div style={{ padding: '1rem', borderRadius: '0.65rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', textAlign: 'center' }}>
                            <div style={{ width: '160px', height: '160px', borderRadius: '10px', background: '#ffffff', padding: '6px', border: '2px solid #2563eb' }}>
                              <img 
                                src={settings.payment_qris_image || '/img/qris_demo.svg'} 
                                alt="QRIS Catavor" 
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                              Scan QRIS dengan GoPay, OVO, ShopeePay, BCA Mobile, atau DANA.
                            </p>
                          </div>
                        )}

                        {/* Form Upload Bukti Transfer Mobile */}
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            processCheckoutSubmission(false);
                          }}
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                        >
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Unggah Bukti Transfer / Scan *</label>
                            <div 
                              style={{ 
                                border: '2px dashed #cbd5e1', 
                                borderRadius: '0.65rem', 
                                padding: '1rem', 
                                textAlign: 'center', 
                                position: 'relative', 
                                backgroundColor: '#ffffff',
                                cursor: 'pointer' 
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
                                    reader.onloadend = () => setPaymentProofPreview(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }} 
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                              />
                              {paymentProofPreview ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                  <img src={paymentProofPreview} alt="Bukti Transfer" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #2563eb' }} />
                                  <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700 }}>Foto Bukti Siap (Klik untuk ganti)</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                  <Upload size={20} style={{ color: '#2563eb' }} />
                                  <span style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 700 }}>Pilih Foto Bukti Transfer</span>
                                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>JPG, PNG, WEBP (Maks 5MB)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Nomor WA / Catatan Pengirim (Opsional)</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Contoh: WA 08123456789 - a.n Budi" 
                              value={paymentProofNote} 
                              onChange={(e) => setPaymentProofNote(e.target.value)}
                            />
                          </div>

                          <button 
                            type="submit" 
                            className="btn-portal-primary" 
                            style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', fontSize: '0.85rem' }}
                            disabled={registerLoading}
                          >
                            <Send size={15} />
                            <span>{registerLoading ? 'Memproses...' : 'Kirim Konfirmasi Pembayaran'}</span>
                          </button>

                          <button 
                            type="button" 
                            className="btn-portal-secondary" 
                            style={{ width: '100%', padding: '0.65rem', justifyContent: 'center', fontSize: '0.78rem' }}
                            onClick={handleCancelCheckout}
                          >
                            <Home size={15} />
                            <span>Kembali ke Beranda</span>
                          </button>
                        </form>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Sukses Konfirmasi Pembayaran Mobile */}
            {showPaymentSuccessModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
                <div className="portal-card animate-scale-up" style={{ width: '100%', maxWidth: '380px', padding: '1.75rem 1.5rem', textAlign: 'center' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    <CheckCircle size={30} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Bukti Pembayaran Berhasil!
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    Terima kasih telah mengonfirmasi. Tim Admin Catavor akan memverifikasi transaksi. Akses <strong>Plan Pro</strong> Anda akan aktif maksimal dalam <strong>1x24 Jam</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      className="btn-portal-primary" 
                      style={{ padding: '0.75rem', fontSize: '0.82rem', justifyContent: 'center' }}
                      onClick={() => {
                        const user = JSON.parse(localStorage.getItem('catavor_user') || '{}');
                        if (user.store_slug) {
                          setStoreSlug(user.store_slug);
                          setActiveTab('admin');
                        } else {
                          setPortalTab('home');
                        }
                        setShowPaymentSuccessModal(false);
                      }}
                    >
                      <span>Lanjut ke Dashboard</span>
                      <ArrowRight size={15} />
                    </button>
                    <button 
                      className="btn-portal-secondary" 
                      style={{ padding: '0.65rem', fontSize: '0.78rem', justifyContent: 'center' }}
                      onClick={() => {
                        setShowPaymentSuccessModal(false);
                        setPortalTab('home');
                      }}
                    >
                      <span>Kembali ke Beranda</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
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
           FULL-PAGE MOBILE DETAIL VIEW (CUSTOM ONLINE SHOP AESTHETICS)
           ========================================================== */
        <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
          {/* Header */}
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--header-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-light)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  setIsDetailActive(false);
                  setSelectedFauna(null);
                }}
                className="btn-back-circle"
                title="Kembali"
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>Detail Produk</span>
            </div>
            
            <button
              onClick={() => setActionMenuData({ type: 'item', item: selectedFauna })}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem'
              }}
              title="Opsi Produk"
            >
              <MoreVertical size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, paddingBottom: '90px', overflowY: 'auto' }}>
            {/* Large Center Image */}
            <img 
              src={
                (selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 0)
                  ? (selectedFauna.detailed_info.images[activeImageIndex] || selectedFauna.image_url)
                  : selectedFauna.image_url
              } 
              alt={selectedFauna.name} 
              style={{ width: '100%', height: '320px', objectFit: 'cover', cursor: 'zoom-in' }} 
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

            {/* Click to Zoom Hint */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              <ZoomIn size={12} />
              <span>Ketuk gambar untuk memperbesar & melihat detail</span>
            </div>

            {/* Thumbnails List */}
            {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem', overflowX: 'auto', maxWidth: '100%', padding: '0 1rem', paddingBottom: '0.25rem' }}>
                {selectedFauna.detailed_info.images.map((imgUrl: string, idx: number) => (
                  <img 
                    key={idx}
                    src={imgUrl} 
                    alt="" 
                    onClick={() => setActiveImageIndex(idx)}
                    style={{
                      width: '45px',
                      height: '45px',
                      objectFit: 'cover',
                      borderRadius: '0.35rem',
                      border: activeImageIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }} 
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }}
                  />
                ))}
              </div>
            )}

            {/* Text Info (Price, Title, Category) */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.35rem' }}>
                {formatRupiah(selectedFauna.price)}
              </div>
              {((((selectedFauna.min_order && selectedFauna.min_order > 1) || (selectedFauna.attributes?.min_order && selectedFauna.attributes.min_order > 1)) || ((selectedFauna.max_order && selectedFauna.max_order > 0) || (selectedFauna.attributes?.max_order && selectedFauna.attributes.max_order > 0))) || (selectedFauna.product_type === 'food' && selectedFauna.attributes?.halal_status) || (selectedFauna.product_type === 'property' && selectedFauna.attributes?.transaction_type)) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {selectedFauna.product_type === 'property' && selectedFauna.attributes?.transaction_type && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                      {selectedFauna.attributes.transaction_type}
                    </span>
                  )}
                  {selectedFauna.product_type === 'food' && selectedFauna.attributes?.halal_status && (
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.22rem 0.6rem',
                      borderRadius: '6px',
                      background: 'var(--primary-glow)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--primary)',
                      letterSpacing: '0.01em',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}>
                      {selectedFauna.attributes.halal_status}
                    </span>
                  )}
                  {selectedFauna.product_type !== 'service' && ((selectedFauna.min_order && selectedFauna.min_order > 1) || (selectedFauna.attributes?.min_order && selectedFauna.attributes.min_order > 1)) && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                      {selectedFauna.product_type === 'food' ? 'Min. Pesanan' : (selectedFauna.product_type === 'property' ? 'Min. Unit' : 'Min. Beli')}: {selectedFauna.min_order || selectedFauna.attributes?.min_order} {getCatalogItemUnit(selectedFauna)}
                    </span>
                  )}
                  {((selectedFauna.max_order && selectedFauna.max_order > 0) || (selectedFauna.attributes?.max_order && selectedFauna.attributes.max_order > 0)) && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      {selectedFauna.product_type === 'food' ? 'Maks. Pesanan' : (selectedFauna.product_type === 'service' ? 'Maks. Pemesanan' : (selectedFauna.product_type === 'property' ? 'Maks. Unit' : 'Maks. Beli'))}: {selectedFauna.max_order || selectedFauna.attributes?.max_order} {getCatalogItemUnit(selectedFauna)}
                    </span>
                  )}
                </div>
              )}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                {selectedFauna.name}
              </h2>
              {selectedFauna.product_type === 'fauna' && isNonEmptyValue(selectedFauna.scientific_name) && (
                <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  {selectedFauna.scientific_name}
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Kategori: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedFauna.class.toUpperCase()}</span>
              </div>
            </div>

            {/* Product Specifications */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                {selectedFauna.product_type === 'property' ? 'Spesifikasi Properti & Listing' : (selectedFauna.product_type === 'food' ? 'Spesifikasi Kuliner' : (selectedFauna.product_type === 'service' ? 'Spesifikasi Layanan' : (selectedFauna.product_type === 'digital' ? 'Spesifikasi File Digital' : (selectedFauna.product_type === 'physical' ? 'Spesifikasi Produk Fisik' : 'Spesifikasi Satwa & Fauna'))))}
              </h3>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--card-bg-gradient)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '0.4rem 0.9rem'
              }}>
                {(() => {
                  const renderRow = (label: string, value: React.ReactNode, isLast = false, isHighlight = false) => {
                    if (!isNonEmptyValue(value)) return null;
                    return (
                      <div 
                        key={label}
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'minmax(110px, 140px) 1fr', 
                          gap: '0.85rem',
                          alignItems: 'baseline', 
                          padding: '0.55rem 0', 
                          borderBottom: isLast ? 'none' : '1px solid var(--border-light)', 
                          fontSize: '0.83rem',
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
                          {value}
                        </span>
                      </div>
                    );
                  };

                  const unit = getCatalogItemUnit(selectedFauna);

                  if (selectedFauna.product_type === 'property') {
                    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Tipe Transaksi', selectedFauna.attributes?.transaction_type || 'Dijual', false, true)}
                        {renderRow('Tipe / Jenis Properti', selectedFauna.class || selectedFauna.attributes?.property_type)}
                        {renderRow('Legalitas / Sertifikat', selectedFauna.attributes?.certificate)}
                        {renderRow('Luas Tanah (LT)', isNonEmptyValue(selectedFauna.attributes?.land_area) ? `${selectedFauna.attributes?.land_area} m²` : null)}
                        {renderRow('Luas Bangunan (LB)', isNonEmptyValue(selectedFauna.attributes?.building_area) ? `${selectedFauna.attributes?.building_area} m²` : null)}
                        {renderRow('Kamar Tidur (KT)', isNonEmptyValue(selectedFauna.attributes?.bedrooms) ? `${selectedFauna.attributes?.bedrooms}` : null)}
                        {renderRow('Kamar Mandi (KM)', isNonEmptyValue(selectedFauna.attributes?.bathrooms) ? `${selectedFauna.attributes?.bathrooms}` : null)}
                        {renderRow('Jumlah Lantai', selectedFauna.attributes?.floors)}
                        {renderRow('Kapasitas Carport', selectedFauna.attributes?.carport)}
                        {renderRow('Daya Listrik', selectedFauna.attributes?.electricity)}
                        {renderRow('Sumber Air', selectedFauna.attributes?.water_source)}
                        {renderRow('Kondisi Perabotan', selectedFauna.attributes?.furnishing)}
                        {renderRow('Arah Hadap', selectedFauna.attributes?.facing)}
                        {renderRow('Lokasi / Wilayah Properti', selectedFauna.attributes?.property_location || selectedFauna.habitat, true)}
                        {minOrderVal > 1 && renderRow('Minimal Unit', `${minOrderVal} Unit`)}
                        {maxOrderVal && Number(maxOrderVal) > 0 && renderRow('Maksimal Unit', `${maxOrderVal} Unit`)}
                      </>
                    );
                  } else if (selectedFauna.product_type === 'physical') {
                    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Kondisi', selectedFauna.attributes?.condition)}
                        {renderRow('Berat Produk', isNonEmptyValue(selectedFauna.attributes?.weight) ? `${selectedFauna.attributes?.weight} Gram` : null)}
                        {renderRow('Merek / Brand', selectedFauna.attributes?.brand)}
                        {renderRow('Varian / Pilihan', selectedFauna.attributes?.variant)}
                        {renderRow('Minimal Beli', `${minOrderVal} ${unit}`)}
                        {renderRow('Maksimal Beli', (maxOrderVal && Number(maxOrderVal) > 0) ? `${maxOrderVal} ${unit}` : null, true)}
                      </>
                    );
                  } else if (selectedFauna.product_type === 'food') {
                    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Status / Sertifikasi Halal', selectedFauna.attributes?.halal_status, true)}
                        {renderRow('Kategori Menu', selectedFauna.class)}
                        {renderRow('Pilihan Varian / Rasa', selectedFauna.attributes?.variant)}
                        {renderRow('Minimal Pesanan', `${minOrderVal} Porsi / Pack`)}
                        {renderRow('Maksimal Pesanan', (maxOrderVal && Number(maxOrderVal) > 0) ? `${maxOrderVal} Porsi / Pack` : null, true)}
                      </>
                    );
                  } else if (selectedFauna.product_type === 'fauna') {
                    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Kelas / Kategori', selectedFauna.class)}
                        {renderRow('Nama Ilmiah / Taksonomi', selectedFauna.scientific_name)}
                        {renderRow('Asal Wilayah', selectedFauna.detailed_info?.native_region)}
                        {renderRow('Masa Hidup', selectedFauna.detailed_info?.lifespan)}
                        {renderRow('Bobot', selectedFauna.detailed_info?.weight)}
                        {renderRow('Status Ketersediaan', selectedFauna.conservation_status)}
                        {renderRow('Minimal Beli', `${minOrderVal} ${unit}`)}
                        {renderRow('Maksimal per Kiriman', (maxOrderVal && Number(maxOrderVal) > 0) ? `${maxOrderVal} ${unit}` : null, true)}
                      </>
                    );
                  } else if (selectedFauna.product_type === 'service') {
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Kategori Bidang Jasa', selectedFauna.class)}
                        {renderRow('Durasi Layanan', selectedFauna.attributes?.duration)}
                        {renderRow('Metode Layanan', selectedFauna.attributes?.service_location)}
                        {renderRow('Area Jangkauan', selectedFauna.attributes?.service_area)}
                        {renderRow('Maksimal Pemesanan', (maxOrderVal && Number(maxOrderVal) > 0) ? `${maxOrderVal} Sesi` : null, true)}
                      </>
                    );
                  } else {
                    const minOrderVal = selectedFauna.min_order || selectedFauna.attributes?.min_order || 1;
                    const maxOrderVal = selectedFauna.max_order || selectedFauna.attributes?.max_order;
                    return (
                      <>
                        {renderRow('Kategori Item', selectedFauna.class)}
                        {renderRow('Format File', selectedFauna.attributes?.file_format)}
                        {renderRow('Ukuran File', selectedFauna.attributes?.file_size)}
                        {renderRow('Tipe Lisensi', selectedFauna.attributes?.license_type)}
                        {renderRow('Minimal Beli', `${minOrderVal} Lisensi / Seat`)}
                        {renderRow('Maksimal Beli', (maxOrderVal && Number(maxOrderVal) > 0) ? `${maxOrderVal} Lisensi / Seat` : null, true)}
                      </>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Description with Expand/Collapse */}
            <ProductDescriptionView 
              description={selectedFauna.description} 
              isMobile={true} 
              title={selectedFauna.product_type === 'property' ? 'Deskripsi & Keunggulan Properti' : (selectedFauna.product_type === 'fauna' ? 'Deskripsi & Kondisi Satwa' : (selectedFauna.product_type === 'service' ? 'Deskripsi Cakupan Layanan' : (selectedFauna.product_type === 'digital' ? 'Deskripsi & Isi Materi Digital' : (selectedFauna.product_type === 'food' ? 'Deskripsi Menu & Komposisi' : 'Deskripsi Produk & Spesifikasi'))))}
            />

            {/* Important Information with Dynamic Contextual Action Buttons */}
            <ProductImportantInfoSection item={selectedFauna} isMobile={true} />

            {/* YouTube Embed */}
            {selectedFauna.video_url && getYoutubeEmbedUrl(selectedFauna.video_url) && (
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {selectedFauna.product_type === 'property' ? 'Video Virtual Tour Properti' : (selectedFauna.product_type === 'fauna' ? 'Video Satwa / Feeding Video' : (selectedFauna.product_type === 'digital' ? 'Video Preview & Demo' : (selectedFauna.product_type === 'service' ? 'Video Dokumentasi / Hasil Kerja' : (selectedFauna.product_type === 'food' ? 'Video Review & Penyajian' : 'Video Review & Unboxing'))))}
                </h3>
                <div className="mobile-video-container" style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <iframe 
                    src={getYoutubeEmbedUrl(selectedFauna.video_url)} 
                    title={selectedFauna.name}
                    allowFullScreen
                    style={{ width: '100%', height: '200px', border: 'none' }}
                  ></iframe>
                </div>
              </div>
            )}

            {/* Recommendations Section (Multi-Sector Recommendation & Graceful Hiding) */}
            {activeTab !== 'admin' && getRecommendations(selectedFauna).length > 0 && (
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', marginTop: '1rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Rekomendasi Katalog Lainnya
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', marginBottom: 0 }}>
                    Pilihan produk dan layanan lainnya dari toko ini
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {getRecommendations(selectedFauna).map(rec => (
                    <div 
                      key={rec.id} 
                      className="glass-panel" 
                      onClick={() => {
                        setSelectedFauna(rec);
                        setActiveImageIndex(0);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}
                    >
                      <img 
                        src={rec.image_url} 
                        alt={rec.name} 
                        style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }}
                      />
                      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ display: 'inline-block', fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                            {rec.class}
                          </span>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.4em', lineHeight: 1.2, marginBottom: '0.25rem' }}>
                            {rec.name}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>
                          {formatRupiah(rec.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer (Sticky/Floating) */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--header-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border-light)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 90
          }}>
            {activeTab === 'admin' ? (
              // Admin footer actions
              <>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setIsDetailActive(false);
                    setSelectedFauna(null);
                  }}
                  style={{ flex: 1, height: '42px', fontSize: '0.85rem', borderRadius: '0.35rem' }}
                >
                  Kembali
                </button>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={() => {
                    const temp = selectedFauna;
                    setIsDetailActive(false);
                    setSelectedFauna(null);
                    openEditSheet(temp);
                  }}
                  style={{ flex: 1, height: '42px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', borderRadius: '0.35rem' }}
                >
                  <Edit3 size={14} />
                  Edit
                </button>
                <button 
                  type="button" 
                  className="btn-danger"
                  onClick={() => {
                    setFaunaToDelete(selectedFauna);
                  }}
                  style={{ flex: 1, height: '42px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', borderRadius: '0.35rem' }}
                >
                  <Trash2 size={14} />
                  Hapus
                </button>
              </>
            ) : (
              // Customer footer actions (Dynamic Purchase Options)
              <>
                <button 
                  type="button"
                  onClick={() => {
                    if (selectedFauna.product_type === 'property') {
                      if (settings.whatsapp_number && settings.whatsapp_number.trim()) {
                        const message = `Halo *${settings.store_title || 'Catavor'}*, saya tertarik dengan listing properti berikut:\n🏡 *${selectedFauna.name}* (${selectedFauna.attributes?.transaction_type || 'Dijual'} - Harga: ${formatRupiah(selectedFauna.price)})\n\nMohon info detail mengenai kelengkapan dokumen/legalitas serta ketersediaan jadwal untuk survey lokasi langsung. Terima kasih.`;
                        window.open(`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
                      } else {
                        alert('Nomor WhatsApp admin/agen belum dikonfigurasi di pengaturan toko.');
                      }
                      return;
                    }
                    setShowMarketplacesSubMenu(false);
                    setShowPurchaseOptions(true);
                  }}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--primary)',
                    borderColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    borderRadius: '0.5rem',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--primary-glow)'
                  }}
                >
                  {selectedFauna.product_type === 'property' ? (
                    <>
                      <MessageCircle size={16} /> Hubungi Agen / Janji Survey
                    </>
                  ) : selectedFauna.product_type === 'service' ? (
                    <>
                      <ShieldCheck size={16} /> Pesan Layanan / Booking Jasa
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} /> Beli Sekarang / Pilih Pembelian
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* RENDER IN-DETAIL FAUNA DELETE MODAL CONFIRMATION */}
          {faunaToDelete && (
            <div className="bottom-sheet-confirm-overlay" onClick={() => setFaunaToDelete(null)}>
              <div className="bottom-sheet-confirm" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle" style={{ marginTop: 0, marginBottom: '1.25rem' }}></div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <AlertTriangle size={24} style={{ color: '#f87171' }} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>
                  Hapus Postingan?
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: '1.45', textAlign: 'center' }}>
                  Apakah Anda yakin ingin menghapus postingan fauna <strong>"{faunaToDelete.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setFaunaToDelete(null)}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', cursor: 'pointer' }}
                  >
                    Batal
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary"
                    style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff', fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={async () => {
                      const deleted = await handleFaunaDelete(faunaToDelete.id)
                      if (deleted) {
                        setIsDetailActive(false);
                        setSelectedFauna(null);
                      }
                      setFaunaToDelete(null)
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPurchaseOptions && selectedFauna && (() => {
            const normalizedLinks = (selectedFauna.detailed_info?.purchase_links || [
              ...(selectedFauna.detailed_info?.shopee_url ? [{ platform: 'Shopee', url: selectedFauna.detailed_info.shopee_url }] : []),
              ...(selectedFauna.detailed_info?.tokopedia_url ? [{ platform: 'Tokopedia', url: selectedFauna.detailed_info.tokopedia_url }] : []),
              ...(selectedFauna.detailed_info?.lazada_url ? [{ platform: 'Lazada', url: selectedFauna.detailed_info.lazada_url }] : []),
              ...(selectedFauna.detailed_info?.bukalapak_url ? [{ platform: 'Bukalapak', url: selectedFauna.detailed_info.bukalapak_url }] : []),
              ...(selectedFauna.detailed_info?.custom_shop_url ? [{ platform: selectedFauna.detailed_info.custom_shop_name || 'Marketplace', url: selectedFauna.detailed_info.custom_shop_url }] : [])
            ]).filter(link => link.platform && link.url);

            const isItemWARekberEnabled = selectedFauna.detailed_info?.enable_wa_rekber !== undefined
              ? Boolean(selectedFauna.detailed_info.enable_wa_rekber)
              : (selectedFauna.attributes?.enable_wa_rekber !== undefined ? Boolean(selectedFauna.attributes.enable_wa_rekber) : true);

            const isItemWADirectEnabled = selectedFauna.detailed_info?.enable_wa_direct !== undefined
              ? Boolean(selectedFauna.detailed_info.enable_wa_direct)
              : (selectedFauna.attributes?.enable_wa_direct !== undefined ? Boolean(selectedFauna.attributes.enable_wa_direct) : true);

            const isProperty = selectedFauna.product_type === 'property';
            const hasPhone = Boolean(settings.whatsapp_number && settings.whatsapp_number.trim());
            const showRekberOption = !isProperty && hasPhone && settings.enable_wa_rekber !== false && isItemWARekberEnabled;
            const showDirectOption = hasPhone && settings.enable_wa_direct !== false && isItemWADirectEnabled;
            const hasAnyOptions = normalizedLinks.length > 0 || showRekberOption || showDirectOption;

            return (
              <div 
                className="bottom-sheet-backdrop" 
                style={{ zIndex: 10000 }}
                onClick={() => {
                  setShowPurchaseOptions(false);
                  setShowMarketplacesSubMenu(false);
                }}
              >
                <div 
                  className="bottom-sheet-content" 
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    transform: `translateY(${Math.max(0, sheetDragY)}px)`,
                    transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                    maxHeight: '86vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.65rem 0 0 0',
                    borderTopLeftRadius: '1.5rem', 
                    borderTopRightRadius: '1.5rem', 
                    background: 'var(--card-bg-gradient, linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%))', 
                    borderTop: '2px solid var(--primary)', 
                    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8), 0 0 25px var(--primary-glow)'
                  }}
                >
                  {/* Smooth Drag Handle Area */}
                  <div 
                    className="bottom-sheet-handle-bar"
                    onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
                    onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
                    onTouchEnd={() => handleSheetDragEnd('purchase_options')}
                    onMouseDown={(e) => handleSheetDragStart(e.clientY)}
                    onMouseMove={(e) => handleSheetDragMove(e.clientY)}
                    onMouseUp={() => handleSheetDragEnd('purchase_options')}
                    style={{ cursor: 'grab', padding: '0.4rem 0 0.65rem' }}
                  >
                    <div className="bottom-sheet-handle" style={{ backgroundColor: 'var(--primary)', opacity: 0.75, boxShadow: '0 0 10px var(--primary-glow)' }} />
                  </div>

                  {/* Standard Bottom Sheet Header */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', padding: '0 1.25rem 0.65rem', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '0.55rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {showMarketplacesSubMenu 
                          ? (selectedFauna.product_type === 'service' ? <Briefcase size={20} /> : <ShoppingCart size={20} />)
                          : (selectedFauna.product_type === 'service' ? <ShieldCheck size={20} /> : <ShoppingBag size={20} />)}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                          {showMarketplacesSubMenu 
                            ? (selectedFauna.product_type === 'service' ? 'Pilih Platform Freelance' : 'Pilih Marketplace')
                            : (selectedFauna.product_type === 'property' 
                                ? 'Pilih Opsi Survey & Kontak' 
                                : (selectedFauna.product_type === 'service'
                                    ? 'Pilih Metode Pemesanan Jasa'
                                    : 'Pilih Cara Pembelian'))}
                        </h3>
                        <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                          {showMarketplacesSubMenu 
                            ? (selectedFauna.product_type === 'service'
                                ? `${normalizedLinks.length} Platform Freelance Pihak Ketiga Tersedia`
                                : `${normalizedLinks.length} Toko Online Resmi Tersedia`)
                            : (selectedFauna.product_type === 'property' 
                                ? 'Hubungi langsung pihak properti' 
                                : (selectedFauna.product_type === 'service'
                                    ? 'Layanan Terlindungi Escrow Syariah & Platform Terpercaya'
                                    : 'Transaksi Resmi & Terverifikasi'))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content Body */}
                  <div style={{ overflowY: 'auto', padding: '0 1.25rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: 0, maxHeight: '60vh' }}>
                    {showMarketplacesSubMenu ? (
                      <>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 0.25rem 0', lineHeight: 1.4 }}>
                          {selectedFauna.product_type === 'service'
                            ? 'Pilih platform freelance pihak ketiga resmi pilihan Anda di bawah ini untuk diarahkan langsung ke halaman pemesanan jasa:'
                            : 'Pilih toko online atau marketplace resmi pilihan Anda di bawah ini untuk diarahkan langsung ke halaman produk:'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {normalizedLinks.map((link, index) => (
                            <a 
                              key={index}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.85rem', 
                                padding: '0.85rem 1rem', 
                                borderRadius: '0.75rem', 
                                border: '1px solid var(--border-light)', 
                                backgroundColor: 'var(--bg-card-hover)', 
                                color: 'var(--text-primary)', 
                                textDecoration: 'none', 
                                transition: 'var(--transition-smooth)', 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                              }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {selectedFauna.product_type === 'service' ? <Briefcase size={18} /> : <Store size={18} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {selectedFauna.product_type === 'service' ? `Order di ${link.platform}` : `Beli di ${link.platform}`}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {selectedFauna.product_type === 'service' ? `Buka profil / lapak jasa resmi kami di ${link.platform}` : `Buka halaman produk resmi di ${link.platform}`}
                                </span>
                              </div>
                              <ExternalLink size={16} style={{ color: 'var(--primary)', opacity: 0.85, flexShrink: 0 }} />
                            </a>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 0.25rem 0', lineHeight: 1.4 }}>
                          {selectedFauna.product_type === 'property' 
                            ? 'Pilih jalur komunikasi langsung dengan agen / pemilik properti:' 
                            : (selectedFauna.product_type === 'service' 
                                ? 'Pilih jalur transaksi yang paling aman dan nyaman untuk pemesanan layanan ini:' 
                                : 'Pilih metode transaksi resmi kami:')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {normalizedLinks.length === 1 && (
                            <a 
                              href={normalizedLinks[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)', textDecoration: 'none', transition: 'var(--transition-smooth)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {selectedFauna.product_type === 'service' ? <Briefcase size={18} /> : <Store size={18} />}
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                                  {selectedFauna.product_type === 'service' ? `Order di ${normalizedLinks[0].platform}` : `Beli di ${normalizedLinks[0].platform}`}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
                                  {selectedFauna.product_type === 'service' ? `Buka profil / lapak jasa resmi kami di ${normalizedLinks[0].platform}` : `Buka transaksi resmi kami di ${normalizedLinks[0].platform}`}
                                </span>
                              </div>
                              <ExternalLink size={16} style={{ color: 'var(--primary)', opacity: 0.85, flexShrink: 0 }} />
                            </a>
                          )}

                          {normalizedLinks.length >= 2 && (
                            <div 
                              onClick={() => setShowMarketplacesSubMenu(true)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)', cursor: 'pointer', transition: 'var(--transition-smooth)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {selectedFauna.product_type === 'service' ? <Briefcase size={18} /> : <ShoppingCart size={18} />}
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                                  {selectedFauna.product_type === 'service' ? 'Order via Platform Freelance Pihak Ketiga' : 'Beli via Online Shop / Marketplace'}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
                                  {selectedFauna.product_type === 'service'
                                    ? `Tersedia di ${normalizedLinks.length} platform (${normalizedLinks.map(l => l.platform).join(', ')})`
                                    : `Tersedia di ${normalizedLinks.length} toko (${normalizedLinks.map(l => l.platform).join(', ')})`}
                                </span>
                              </div>
                              <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.85, flexShrink: 0 }} />
                            </div>
                          )}

                          {showRekberOption && (
                            <a 
                              href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(
                                selectedFauna.product_type === 'service'
                                  ? `Halo Admin Rekber Syariah *${settings.store_title || 'Catavor'}*, saya ingin memesan layanan jasa dengan perlindungan escrow aman:\n💼 *${selectedFauna.name}* (Tarif: ${formatRupiah(selectedFauna.price)})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah (rekbersyariah.com)* agar dana aman selama masa pengerjaan.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website https://rekbersyariah.com atau membuatkan grup WhatsApp transaksi bersama (Admin Rekber Syariah, Penyedia Jasa, & Klien). Terima kasih.`
                                  : selectedFauna.product_type === 'food'
                                  ? `Halo Admin Rekber Syariah *${settings.store_title || 'Catavor'}*, saya ingin memesan produk kuliner/katering dengan perlindungan Rekber Syariah:\n🍲 *${selectedFauna.name}* (Harga: ${formatRupiah(selectedFauna.price)})\n\nSaya ingin bertransaksi menggunakan layanan *Rekening Bersama Syariah (rekbersyariah.com)*.\nMohon bantuannya untuk mendaftarkan transaksi ini dan membuatkan grup WhatsApp transaksi bersama. Terima kasih.`
                                  : `Halo *${settings.store_title || 'Catavor'}*, saya berminat membeli produk berikut:\n📦 *${selectedFauna.name}* (Harga: ${formatRupiah(selectedFauna.price)})\n\nSaya ingin bertransaksi secara aman menggunakan layanan *Rekening Bersama Syariah (rekbersyariah.com)*.\nMohon bantuannya untuk mendaftarkan transaksi ini melalui website https://rekbersyariah.com atau menghubungi Admin Rekber Syariah agar dapat dibuatkan grup WhatsApp transaksi bersama (Admin Rekber Syariah, Penjual, & Pembeli). Terima kasih.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)', textDecoration: 'none', transition: 'var(--transition-smooth)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ShieldCheck size={18} />
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                                  {selectedFauna.product_type === 'service' ? 'Pesan via Rekber Syariah (Escrow Aman)' : 'Chat WA & Rekber Syariah'}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
                                  {selectedFauna.product_type === 'service'
                                    ? 'Dana ditahan di rekening penampung syariah sampai pengerjaan tuntas & terverifikasi'
                                    : (selectedFauna.product_type === 'food'
                                        ? 'Gunakan Rekening Bersama Syariah (Aman untuk pesanan frozen/katering)'
                                        : 'Gunakan Rekening Bersama Syariah (Sangat Aman)')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowRekberExplainerModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  cursor: 'pointer',
                                  padding: '0.35rem',
                                  borderRadius: '0.35rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0.85
                                }}
                                title="Pelajari apa itu Rekber Syariah"
                              >
                                <HelpCircle size={18} />
                              </button>
                              <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.8, flexShrink: 0 }} />
                            </a>
                          )}

                          {showDirectOption && (
                            <a 
                              href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(
                                selectedFauna.product_type === 'property'
                                  ? `Halo *${settings.store_title || 'Catavor'}*, saya tertarik dengan listing properti berikut:\n🏡 *${selectedFauna.name}* (${selectedFauna.attributes?.transaction_type || 'Dijual'} - Harga: ${formatRupiah(selectedFauna.price)})\n\nMohon info detail mengenai legalitas/dokumen serta ketersediaan jadwal untuk survey lokasi langsung. Terima kasih.`
                                  : selectedFauna.product_type === 'service'
                                  ? `Halo *${settings.store_title || 'Catavor'}*, saya tertarik untuk berkonsultasi & memesan layanan jasa berikut:\n💼 *${selectedFauna.name}* (Tarif: ${formatRupiah(selectedFauna.price)})\n\nBerikut ringkasan kebutuhan / kendala saya: [...]\nMohon info mengenai estimasi waktu dan ketersediaan jadwal pengerjaan. Terima kasih.`
                                  : selectedFauna.product_type === 'food'
                                  ? `Halo *${settings.store_title || 'Catavor'}*, saya ingin memesan menu kuliner berikut:\n🍲 *${selectedFauna.name}* (Harga: ${formatRupiah(selectedFauna.price)} / ${getCatalogItemUnit(selectedFauna)})\n\nJumlah Pesanan: [1] ${getCatalogItemUnit(selectedFauna)}\nCatatan / Level Pedas / Varian: [...]\nAlamat Pengiriman (jika pesan antar): [...]\nMohon info ketersediaan menu dan total estimasi pengiriman. Terima kasih.`
                                  : `Halo ${settings.store_title || 'Catavor'}, saya tertarik untuk membeli *${selectedFauna.name}* (Harga: ${formatRupiah(selectedFauna.price)}) secara langsung.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)', textDecoration: 'none', transition: 'var(--transition-smooth)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MessageCircle size={18} />
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                                  {selectedFauna.product_type === 'property' 
                                    ? 'Chat WA (Janji Survey & Konsultasi)' 
                                    : (selectedFauna.product_type === 'service'
                                        ? 'Chat WA (Konsultasi & Booking Langsung)'
                                        : (selectedFauna.product_type === 'food'
                                            ? 'Pesan Antar / Order via WhatsApp'
                                            : 'Chat WA (Transaksi Langsung)'))}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
                                  {selectedFauna.product_type === 'property' 
                                    ? 'Hubungi langsung untuk jadwal survey lokasi & info legalitas' 
                                    : (selectedFauna.product_type === 'service'
                                        ? 'Konsultasi scope pekerjaan, estimasi waktu, & tanya jawab teknis'
                                        : (selectedFauna.product_type === 'food'
                                            ? 'Pesan langsung untuk pengiriman instan / same-day / takeaway'
                                            : 'Hubungi penjual langsung via chat WhatsApp'))}
                                </span>
                              </div>
                              <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.8, flexShrink: 0 }} />
                            </a>
                          )}

                          {!hasAnyOptions && (
                            <div style={{ padding: '1.25rem 1rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Metode pembelian online belum diaktifkan untuk item katalog ini.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Standard Footer */}
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid var(--border-light)' }}>
                    {showMarketplacesSubMenu ? (
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => setShowMarketplacesSubMenu(false)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.65rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'var(--transition-smooth)' }}
                      >
                        <ArrowLeft size={16} /> {selectedFauna.product_type === 'service' ? 'Kembali ke Pilihan Pemesanan' : 'Kembali ke Pilihan Pembelian'}
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => setShowPurchaseOptions(false)} 
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.65rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                      >
                        Tutup
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : selectedArticle ? (
        /* ==========================================================
           FULL-PAGE MOBILE ARTICLE READER (PREMIUM READ VIEW)
           ========================================================== */
        <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', padding: '1.25rem', paddingTop: '4.5rem', paddingBottom: '3rem', overflowY: 'auto' }}>
          {/* Fixed Top Sub-Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            height: '3.5rem', 
            zIndex: 100, 
            backgroundColor: 'var(--header-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '0 1rem', 
            borderBottom: '1px solid var(--border-light)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
          }}>
            <button
              type="button"
              className="btn-back-circle"
              onClick={() => {
                setSelectedArticle(null);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              title="Kembali"
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ 
              color: 'var(--text-primary)', 
              fontWeight: 800, 
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              textAlign: 'center',
              margin: '0 0.75rem'
            }}>
              Edukasi {settings.store_title || 'Catavor'}
            </span>
            <div style={{ width: '2.25rem' }} /> {/* To balance the back button */}
          </div>

          {/* Article Reading Content */}
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            {selectedArticle.image_url && (
              <img 
                src={selectedArticle.image_url} 
                alt={selectedArticle.title} 
                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '1.25rem', border: '1px solid var(--border-light)', cursor: 'zoom-in' }}
                onClick={() => {
                  setActiveLightboxImage(selectedArticle.image_url || null);
                  setZoomScale(1);
                  setPanPosition({ x: 0, y: 0 });
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1.3', marginBottom: '0.5rem' }}>
              {selectedArticle.title}
            </h2>

            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <span>Oleh: <strong>{selectedArticle.author || 'Admin'}</strong></span>
              <span>&bull;</span>
              <span>Terakhir Diperbarui: <strong>{new Date(selectedArticle.updated_at || selectedArticle.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
              <span>&bull;</span>
              <span>{selectedArticle.read_time || '5 mnt baca'}</span>
            </div>

            <div 
              className="article-content-rich"
              style={{ 
                color: 'var(--text-primary)', 
                fontSize: '0.9rem', 
                lineHeight: '1.7', 
                textAlign: 'justify' 
              }}
            >
              <FormattedText text={selectedArticle.content} style={{ fontSize: '0.92rem', lineHeight: '1.75' }} />
            </div>

            {/* Tautan Sosial Media (Opsional) */}
            {(() => {
              const socialLinks = (() => {
                try {
                  return settings.social_links ? JSON.parse(settings.social_links) : [];
                } catch (e) {
                  return [];
                }
              })();
              if (!socialLinks || socialLinks.length === 0) return null;
              return (
                <div style={{ marginTop: '2.5rem', padding: '1.25rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Temukan Kami Di Media Sosial</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {socialLinks.map((link: any, idx: number) => {
                      let label = link.platform;
                      let iconLabel = '🌐';
                      if (link.platform.toLowerCase().includes('instagram')) { label = 'Instagram'; iconLabel = '📸'; }
                      else if (link.platform.toLowerCase().includes('facebook')) { label = 'Facebook'; iconLabel = '👥'; }
                      else if (link.platform.toLowerCase().includes('tiktok')) { label = 'TikTok'; iconLabel = '🎵'; }
                      else if (link.platform.toLowerCase().includes('youtube')) { label = 'YouTube'; iconLabel = '🎥'; }
                      
                      return (
                        <a 
                          key={idx} 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            padding: '0.4rem 0.8rem',
                            backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                            borderRadius: '0.35rem',
                            textDecoration: 'none'
                          }}
                        >
                          <span>{iconLabel}</span>
                          <span>{label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Kolom Komentar */}
            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
              {!selectedArticle.is_comments_enabled ? (
                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  🔒 Kolom komentar dinonaktifkan untuk artikel ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                      Diskusi & Komentar ({selectedArticle.comments_count || 0})
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Bagikan tanggapan Anda mengenai artikel edukasi ini.
                    </p>
                  </div>

                  {/* Comments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(!selectedArticle.comments || selectedArticle.comments.length === 0) ? (
                      <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0' }}>Belum ada komentar. Jadilah yang pertama memberikan tanggapan!</p>
                    ) : (
                      selectedArticle.comments.map((comment: CommentItem) => {
                        const initial = comment.name ? comment.name.trim().charAt(0).toUpperCase() : 'U';
                        return (
                          <div key={comment.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(var(--primary-rgb), 0.15)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              flexShrink: 0
                            }}>
                              {initial}
                            </div>
                            <div className="glass-panel" style={{ padding: '0.75rem 1rem', borderRadius: '0 0.75rem 0.75rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{comment.name}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {new Date(comment.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Comment Form */}
                  <form onSubmit={handlePostComment} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Kirim Tanggapan</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Nama Anda *" 
                          required
                          value={commentName}
                          onChange={(e) => setCommentName(e.target.value)}
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <input 
                          type="email" 
                          className="form-input" 
                          placeholder="Email (Opsional)" 
                          value={commentEmail}
                          onChange={(e) => setCommentEmail(e.target.value)}
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <textarea 
                        rows={3} 
                        className="form-input" 
                        placeholder="Tulis tanggapan Anda di sini... *" 
                        required
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', lineHeight: '1.4' }}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={submittingComment}
                      style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, alignSelf: 'flex-end', minWidth: '100px' }}
                    >
                      {submittingComment ? 'Mengirim...' : 'Kirim Komentar'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : view === 'fauna-editor' ? (() => {
        const typeConfig = getItemTypeFormConfig(crudForm.product_type);
        const TypeIcon = typeConfig.icon;

        return (
          /* ==========================================================
             MOBILE FULL-PAGE UNIVERSAL ITEM EDITOR (PREMIUM FORM VIEW)
             ========================================================== */
          <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', padding: '1rem', paddingTop: '4.5rem', paddingBottom: '4rem', overflowY: 'auto' }}>
            {/* Sub-Header / Back Bar (Fixed Top) */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '3.5rem', 
              zIndex: 100, 
              backgroundColor: 'var(--header-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '0 1rem', 
              borderBottom: '1px solid var(--border-light)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
            }}>
              <button 
                type="button"
                onClick={() => {
                  resetCrudState('physical');
                  setView('tabs');
                  setActiveTab('admin');
                  setAdminSubTab('items');
                  setShowProductTypeSelector(false);
                }}
                className="btn-back-circle"
                title="Batal"
              >
                <ChevronLeft size={20} />
              </button>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {typeConfig.modalTitle(crudMode)}
              </h3>
              <div style={{ width: '2.25rem' }} /> {/* Spacer to center the title */}
            </div>

            {/* Form Content */}
            <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              {/* Banner Switcher Tipe Item (Premium Design) */}
              <div style={{ 
                padding: '0.85rem 1rem', 
                borderRadius: '1rem', 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Subtle ambient radial glow behind banner */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-20%',
                  width: '140%',
                  height: '200%',
                  background: typeConfig.gradientBg,
                  pointerEvents: 'none'
                }} />

                {/* Left Side: Category Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1, minWidth: 0 }}>
                  <div style={{ 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '0.65rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    backgroundColor: `${typeConfig.color}20`,
                    border: `1px solid ${typeConfig.color}40`,
                    color: typeConfig.color,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    <TypeIcon size={20} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.1rem' }}>
                      Tipe Item Katalog
                    </span>
                    <span style={{ 
                      fontSize: '0.88rem', 
                      fontWeight: 800, 
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'block'
                    }}>
                      {typeConfig.typeName}
                    </span>
                  </div>
                </div>

                {/* Right Side: Action Button "Ganti Tipe" */}
                <button 
                  type="button" 
                  onClick={() => {
                    setIsChangingTypeInEditor(true);
                    setShowProductTypeSelector(true);
                    setView('product-type-selector');
                  }}
                  style={{ 
                    background: 'var(--primary-glow)', 
                    border: '1px solid var(--primary)', 
                    color: 'var(--primary)', 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    cursor: 'pointer',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    zIndex: 1,
                    flexShrink: 0
                  }}
                  className="btn-glow-hover"
                  title="Ganti Tipe Item"
                >
                  <RefreshCw size={13} />
                  <span>Ganti Tipe</span>
                </button>
              </div>

              {crudError && (
                <div className="alert-box alert-success" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1.25rem' }}>
                  {crudError}
                </div>
              )}

              <form onSubmit={handleFaunaSubmit}>
                {/* Standar Fields: Nama & Harga */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '0.6rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>{typeConfig.nameLabel}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={typeConfig.namePlaceholder}
                      required
                      value={crudForm.name}
                      onChange={(e) => setCrudForm({ ...crudForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>{typeConfig.priceLabel}</label>
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

                {/* Batas Pembelian: Minimal & Maksimal Beli (Dikecualikan dari Jasa) */}
                {typeConfig.minOrderLabel && (
                  <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', alignItems: 'end', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem', fontSize: '0.78rem' }}>
                        {typeConfig.minOrderLabel}
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        className="form-input" 
                        placeholder={typeConfig.minOrderPlaceholder || '1'}
                        required
                        value={crudForm.min_order ?? 1}
                        onChange={(e) => setCrudForm({ ...crudForm, min_order: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem', fontSize: '0.78rem' }}>
                        {typeConfig.maxOrderLabel || 'Maksimal Beli'}
                      </label>
                      <input 
                        type="number" 
                        min={crudForm.min_order || 1}
                        className="form-input" 
                        placeholder={typeConfig.maxOrderPlaceholder || 'Tanpa batas'}
                        value={crudForm.max_order ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                          setCrudForm({ ...crudForm, max_order: val });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Kategori Field */}
                <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  <label className="form-label">{typeConfig.categoryLabel}</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cats = getCategoryOptionsForType(crudForm.product_type);
                        const opts = cats.map(cat => ({
                          value: cat,
                          label: cat,
                          badge: `${faunas.filter(f => f.class === cat).length} item`
                        }));
                        opts.push({
                          value: '__NEW__',
                          label: '+ Tambah Kategori Baru...',
                          desc: 'Ketik nama kategori kustom sendiri',
                          isAction: true
                        } as any);
                        setCrudDropdownPicker({
                          title: typeConfig.categoryLabel,
                          icon: Layers,
                          options: opts,
                          selectedValue: showCustomClassInput ? '__NEW__' : crudForm.class,
                          onSelect: (val) => {
                            if (val === '__NEW__') {
                              setShowCustomClassInput(true);
                              setCustomClass('');
                            } else {
                              setShowCustomClassInput(false);
                              setCrudForm(prev => ({ ...prev, class: val }));
                            }
                          }
                        });
                      }}
                      className="form-input"
                      style={{
                        flex: 1,
                        height: '42px',
                        padding: '0 0.85rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                        {showCustomClassInput ? '+ Tambah Kategori Baru...' : (crudForm.class || 'Pilih Kategori...')}
                      </span>
                      <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    </button>
                  </div>
                  {showCustomClassInput && (
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginTop: '0.35rem' }}
                      placeholder="Ketik nama kategori baru..."
                      value={customClass}
                      onChange={(e) => setCustomClass(e.target.value)}
                      required
                    />
                  )}
                </div>

                {/* DYNAMIC FIELDS SPECIFIC TO PRODUCT TYPE */}
                {/* 1. BARANG FISIK */}
                {crudForm.product_type === 'physical' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Kondisi Barang *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Kondisi Barang',
                              icon: Package,
                              options: [
                                { value: 'Baru', label: 'Baru', desc: 'Produk dalam kondisi gres 100% baru & tersegel' },
                                { value: 'Bekas', label: 'Bekas / Second', desc: 'Produk pernah digunakan / pre-owned' },
                                { value: 'Refurbished', label: 'Refurbished', desc: 'Produk rekondisi resmi & siap pakai' }
                              ],
                              selectedValue: crudForm.attributes.condition,
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, condition: val as any } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.condition || 'Pilih Kondisi'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Berat (Gram) *</label>
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
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Merek / Brand (Opsional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: Nike / Asus / Custom"
                          value={crudForm.attributes.brand || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, brand: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Varian / Ukuran (Opsional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: Hitam, Putih / S, M, L"
                          value={crudForm.attributes.variant || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, variant: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ITEM DIGITAL */}
                {crudForm.product_type === 'digital' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Format File *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: PDF / EPUB / ZIP"
                          required
                          value={crudForm.attributes.file_format || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, file_format: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Ukuran File *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 15 MB"
                          required
                          value={crudForm.attributes.file_size}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, file_size: e.target.value } })}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ marginBottom: '0.35rem' }}>Tipe Lisensi *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setCrudDropdownPicker({
                            title: 'Pilih Tipe Lisensi Digital',
                            icon: ShieldCheck,
                            options: [
                              { value: 'Lisensi Personal', label: 'Lisensi Personal', desc: 'Hanya untuk pemakaian individu non-komersial' },
                              { value: 'Lisensi Komersial', label: 'Lisensi Komersial', desc: 'Boleh digunakan untuk bisnis & proyek berbayar' },
                              { value: 'Resale Rights', label: 'Extended License / Resale Rights', desc: 'Hak cipta diperluas / dapat dijual kembali' },
                              { value: 'Open Source', label: 'Open Source / Bebas', desc: 'Bebas digunakan tanpa batasan royalti' }
                            ],
                            selectedValue: crudForm.attributes.license_type || 'Lisensi Personal',
                            onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, license_type: val } }))
                          });
                        }}
                        className="form-input"
                        style={{
                          height: '42px',
                          padding: '0 0.85rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                          {crudForm.attributes.license_type || 'Lisensi Personal'}
                        </span>
                        <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. SATWA & LIVING FAUNA */}
                {crudForm.product_type === 'fauna' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Nama Ilmiah / Taksonomi *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Nama latin atau taksonomi..."
                        required
                        value={crudForm.scientific_name}
                        onChange={(e) => setCrudForm({ ...crudForm, scientific_name: e.target.value })}
                      />
                    </div>
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Asal Wilayah</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Kalimantan..."
                          value={crudForm.native_region}
                          onChange={(e) => setCrudForm({ ...crudForm, native_region: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Masa Hidup</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="10 tahun..."
                          value={crudForm.lifespan}
                          onChange={(e) => setCrudForm({ ...crudForm, lifespan: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Bobot</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="1 kg..."
                          value={crudForm.weight}
                          onChange={(e) => setCrudForm({ ...crudForm, weight: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Status Ketersediaan *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setCrudDropdownPicker({
                            title: 'Pilih Status Ketersediaan',
                            icon: CheckCircle,
                            options: [
                              { value: 'Ready Stock', label: 'Ready Stock', desc: 'Satwa / fauna siap dikirim / diadopsi segera' },
                              { value: 'Pre-Order', label: 'Pre-Order', desc: 'Pemesanan terlebih dahulu / inden khusus' },
                              { value: 'Tersedia', label: 'Tersedia', desc: 'Stok tersedia di fasilitas penangkaran' }
                            ],
                            selectedValue: crudForm.conservation_status || 'Ready Stock',
                            onSelect: (val) => setCrudForm(prev => ({ ...prev, conservation_status: val }))
                          });
                        }}
                        className="form-input"
                        style={{
                          height: '42px',
                          padding: '0 0.85rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                          {crudForm.conservation_status || 'Ready Stock'}
                        </span>
                        <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. JASA & LAYANAN */}
                {crudForm.product_type === 'service' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Durasi Layanan *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 1 Sesi / 1 Jam / 1 Hari"
                          required
                          value={crudForm.attributes.duration}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, duration: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Metode Layanan *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Metode Layanan',
                              icon: MapPin,
                              options: [
                                { value: 'Datang ke Toko', label: 'Datang ke Toko', desc: 'Klien datang langsung ke outlet / workshop' },
                                { value: 'Home Visit (Ke Rumah)', label: 'Home Visit (Ke Rumah)', desc: 'Penyedia jasa datang ke lokasi / rumah klien' },
                                { value: 'Online', label: 'Online / Jarak Jauh', desc: 'Layanan digital via internet / remote' }
                              ],
                              selectedValue: crudForm.attributes.service_location || 'Datang ke Toko',
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, service_location: val } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.service_location || 'Datang ke Toko'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ marginBottom: '0.35rem' }}>Area Jangkauan *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Contoh: Jabodetabek / Bandung Kota / Seluruh Indonesia"
                        required
                        value={crudForm.attributes.service_area}
                        onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, service_area: e.target.value } })}
                      />
                    </div>
                  </div>
                )}

                {/* 5. PROPERTI & REAL ESTATE */}
                {crudForm.product_type === 'property' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Tipe Transaksi *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Tipe Transaksi',
                              icon: Home,
                              options: [
                                { value: 'Dijual', label: 'Dijual (Jual Putus)', desc: 'Pengalihan hak milik properti secara penuh' },
                                { value: 'Disewakan (Tahunan)', label: 'Disewakan (Tahunan)', desc: 'Sewa kontrak dengan termin per tahun' },
                                { value: 'Disewakan (Bulanan)', label: 'Disewakan (Bulanan)', desc: 'Sewa fleksibel dengan pembayaran per bulan' }
                              ],
                              selectedValue: crudForm.attributes.transaction_type || 'Dijual',
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, transaction_type: val as any } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.transaction_type || 'Dijual'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Legalitas / Sertifikat *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Legalitas / Sertifikat',
                              icon: Award,
                              options: [
                                { value: 'SHM (Sertifikat Hak Milik)', label: 'SHM (Sertifikat Hak Milik)', desc: 'Tingkat kepemilikan terkuat & tertinggi' },
                                { value: 'HGB (Hak Guna Bangunan)', label: 'HGB (Hak Guna Bangunan)', desc: 'Hak mendirikan bangunan di atas tanah' },
                                { value: 'Strata Title / SHMRS', label: 'Strata Title / SHMRS', desc: 'Kepemilikan unit apartemen / kondominium' },
                                { value: 'AJB (Akta Jual Beli)', label: 'AJB (Akta Jual Beli)', desc: 'Bukti sah transaksi di hadapan PPAT' },
                                { value: 'Girik / Letter C', label: 'Girik / Letter C', desc: 'Surat keterangan tanah adat / warisan' },
                                { value: 'Lainnya', label: 'Lainnya', desc: 'Status legalitas atau dokumen khusus' }
                              ],
                              selectedValue: crudForm.attributes.certificate || 'SHM (Sertifikat Hak Milik)',
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, certificate: val } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.certificate || 'SHM (Sertifikat Hak Milik)'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                    </div>

                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Luas Tanah (m²) *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 120"
                          required
                          value={crudForm.attributes.land_area || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, land_area: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Luas Bangunan (m²)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 90 (0 jika tanah)"
                          value={crudForm.attributes.building_area || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, building_area: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Kamar Tidur (KT)</label>
                        <input 
                          type="number" 
                          min={0}
                          className="form-input" 
                          placeholder="Contoh: 3"
                          value={crudForm.attributes.bedrooms ?? ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, bedrooms: parseInt(e.target.value) || 0 } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Kamar Mandi (KM)</label>
                        <input 
                          type="number" 
                          min={0}
                          className="form-input" 
                          placeholder="Contoh: 2"
                          value={crudForm.attributes.bathrooms ?? ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, bathrooms: parseInt(e.target.value) || 0 } })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Jumlah Lantai</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 2 Lantai"
                          value={crudForm.attributes.floors || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, floors: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Kapasitas Carport</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 2 Mobil"
                          value={crudForm.attributes.carport || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, carport: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Daya Listrik</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: 2200 VA"
                          value={crudForm.attributes.electricity || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, electricity: e.target.value } })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Sumber Air</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Contoh: PDAM / Sumur Bor"
                          value={crudForm.attributes.water_source || ''}
                          onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, water_source: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Kondisi Perabotan</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Kondisi Perabotan',
                              icon: Layers,
                              options: [
                                { value: 'Unfurnished (Kosong)', label: 'Unfurnished (Kosong)', desc: 'Unit kosong siap diisi perabot sendiri' },
                                { value: 'Semi-Furnished', label: 'Semi-Furnished', desc: 'Sudah ada beberapa perabot utama (AC, Kitchen Set)' },
                                { value: 'Fully Furnished (Lengkap)', label: 'Fully Furnished (Lengkap)', desc: 'Unit lengkap siap huni / tinggal bawa koper' }
                              ],
                              selectedValue: crudForm.attributes.furnishing || 'Semi-Furnished',
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, furnishing: val } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.furnishing || 'Semi-Furnished'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ minHeight: '2.1rem', display: 'flex', alignItems: 'flex-end', marginBottom: '0.35rem' }}>Arah Hadap</label>
                        <button
                          type="button"
                          onClick={() => {
                            setCrudDropdownPicker({
                              title: 'Pilih Arah Hadap Bangunan',
                              icon: Compass,
                              options: [
                                { value: 'Utara', label: 'Utara' },
                                { value: 'Selatan', label: 'Selatan' },
                                { value: 'Timur', label: 'Timur (Matahari Pagi)' },
                                { value: 'Barat', label: 'Barat' },
                                { value: 'Timur Laut', label: 'Timur Laut' },
                                { value: 'Tenggara', label: 'Tenggara' },
                                { value: 'Barat Daya', label: 'Barat Daya' },
                                { value: 'Barat Laut', label: 'Barat Laut' },
                                { value: 'Bebas / Fleksibel', label: 'Bebas / Fleksibel' }
                              ],
                              selectedValue: crudForm.attributes.facing || 'Timur',
                              onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, facing: val } }))
                            });
                          }}
                          className="form-input"
                          style={{
                            height: '42px',
                            padding: '0 0.85rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {crudForm.attributes.facing || 'Timur'}
                          </span>
                          <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ marginBottom: '0.35rem' }}>Lokasi / Wilayah Properti *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Contoh: BSD City, Serpong, Tangerang Selatan"
                        required
                        value={crudForm.attributes.property_location || ''}
                        onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, property_location: e.target.value } })}
                      />
                    </div>
                  </div>
                )}

                {/* 6. KULINER & MAKANAN */}
                {crudForm.product_type === 'food' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ marginBottom: '0.35rem' }}>Sertifikasi / Status Halal *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setCrudDropdownPicker({
                            title: 'Pilih Sertifikasi / Status Halal',
                            icon: CheckCircle,
                            options: [
                              { value: 'Bersertifikat Halal Resmi (BPJPH / MUI)', label: 'Bersertifikat Halal Resmi (BPJPH / MUI)', desc: 'Telah terverifikasi & terdaftar resmi di BPJPH/MUI' },
                              { value: 'Halal (Bahan Baku Halal & Thayyib)', label: 'Halal (Bahan Baku Halal & Thayyib)', desc: '100% menggunakan bahan baku halal, bersih & higienis' },
                              { value: 'Muslim Friendly / No Pork No Lard', label: 'Muslim Friendly / No Pork No Lard', desc: 'Bebas daging babi, minyak babi, dan alkohol' },
                              { value: 'Dalam Proses Sertifikasi Halal', label: 'Dalam Proses Sertifikasi Halal', desc: 'Sedang dalam proses audit sertifikasi halal' },
                              { value: 'Non-Halal', label: 'Non-Halal', desc: 'Mengandung bahan non-halal / khusus non-muslim' }
                            ],
                            selectedValue: crudForm.attributes.halal_status || 'Bersertifikat Halal Resmi (BPJPH / MUI)',
                            onSelect: (val) => setCrudForm(prev => ({ ...prev, attributes: { ...prev.attributes, halal_status: val } }))
                          });
                        }}
                        className="form-input"
                        style={{
                          height: '42px',
                          padding: '0 0.85rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                          {crudForm.attributes.halal_status || 'Bersertifikat Halal Resmi (BPJPH / MUI)'}
                        </span>
                        <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      </button>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ marginBottom: '0.35rem' }}>Pilihan Varian / Level Rasa (Opsional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Contoh: Pedas Sedang, Ekstra Pedas / 500gr"
                        value={crudForm.attributes.variant || ''}
                        onChange={(e) => setCrudForm({ ...crudForm, attributes: { ...crudForm.attributes, variant: e.target.value } })}
                      />
                    </div>
                  </div>
                )}

                {/* Multi-image upload section */}
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <label className="form-label" style={{ margin: 0 }}>{typeConfig.photoLabel}</label>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', display: 'block' }}>{typeConfig.photoHelper}</small>
                    </div>
                    {crudImages.length < 5 && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem' }}
                        onClick={() => setCrudImages([...crudImages, ''])}
                      >
                        + Foto
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {crudImages.map((imgUrl, index) => (
                      <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--card-bg-gradient)', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
                        {/* Preview Thumbnail */}
                        <div style={{ width: '42px', height: '42px', borderRadius: '0.4rem', overflow: 'hidden', border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=600&q=80'; }} />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <Image size={13} style={{ color: 'var(--primary)' }} />
                              <span style={{ fontSize: '0.52rem', color: 'var(--btn-secondary-text)', fontWeight: 700 }}>Foto</span>
                            </div>
                          )}
                          {uploadingIndex === index && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Loader className="animate-spin" size={10} style={{ color: 'var(--primary)' }} />
                            </div>
                          )}
                        </div>

                        {/* Input & Upload Controls */}
                        <div style={{ flexGrow: 1, display: 'flex', gap: '0.35rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={`Tautan Foto ${index === 0 ? 'Utama *' : `${index + 1}`}`}
                            value={imgUrl}
                            onChange={(e) => {
                              const newImages = [...crudImages]
                              newImages[index] = e.target.value
                              setCrudImages(newImages)
                            }}
                            required={index === 0}
                            style={{ height: '36px', fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                          />
                          
                          {/* Device File Upload Button */}
                          <label 
                            className="btn-secondary" 
                            style={{ 
                              padding: '0.35rem 0.65rem', 
                              height: '36px', 
                              borderRadius: '0.4rem', 
                              fontSize: '0.75rem', 
                              fontWeight: 700,
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.25rem', 
                              cursor: 'pointer', 
                              whiteSpace: 'nowrap',
                              background: 'var(--btn-secondary-bg)',
                              color: 'var(--btn-secondary-text)',
                              border: '1px solid var(--btn-secondary-border)'
                            }}
                          >
                            <Upload size={12} style={{ color: 'var(--primary)' }} />
                            <span>Upload</span>
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

                        {/* Delete Row Button */}
                        {crudImages.length > 1 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ 
                              padding: '0.35rem', 
                              color: '#f87171', 
                              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                              border: '1px solid rgba(239, 68, 68, 0.3)', 
                              height: '36px', 
                              width: '36px', 
                              borderRadius: '0.4rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              flexShrink: 0,
                              cursor: 'pointer' 
                            }}
                            onClick={() => {
                              const newImages = crudImages.filter((_, i) => i !== index)
                              setCrudImages(newImages)
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

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

                {/* Unified Single Pengiriman & Ketentuan Packing Field */}
                {/* Unified Single Pengiriman & Ketentuan Packing Field */}
                <RichTextarea
                  label={typeConfig.deliveryTermsLabel}
                  rows={3}
                  placeholder={typeConfig.deliveryTermsPlaceholder}
                  value={crudForm.shipping_terms}
                  onChange={(val) => setCrudForm({ ...crudForm, shipping_terms: val })}
                />

                {typeConfig.warrantyLabel && (
                  <RichTextarea
                    label={typeConfig.warrantyLabel}
                    rows={3}
                    placeholder={typeConfig.warrantyPlaceholder}
                    value={crudForm.warranty_info}
                    onChange={(val) => setCrudForm({ ...crudForm, warranty_info: val })}
                  />
                )}

                {/* Link Pembelian Marketplace / Platform Freelance (Opsional) - Sembunyikan untuk Properti */}
                {crudForm.product_type !== 'property' && (
                  <div style={{ marginTop: '1.25rem', marginBottom: '1rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800 }}>
                          {crudForm.product_type === 'service' 
                            ? 'Link Platform Freelance (Opsional)' 
                            : (crudForm.product_type === 'food'
                                ? 'Link Pesan-Antar / Online Shop (Opsional)'
                                : 'Link Marketplace (Opsional)')}
                        </label>
                        <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', display: 'block' }}>
                          {crudForm.product_type === 'service' 
                            ? 'Fastwork, Projects.co.id, Fiverr, Upwork, dll.' 
                            : (crudForm.product_type === 'food'
                                ? 'GoFood, GrabFood, ShopeeFood, Tokopedia, dll.'
                                : 'Shopee, Tokopedia, TikTok Shop, dll.')}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = [...crudForm.purchase_links, { platform: '', url: '' }]
                          setCrudForm({ ...crudForm, purchase_links: newLinks })
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: 'var(--primary)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Tambah Link
                      </button>
                    </div>

                    {crudForm.purchase_links.length === 0 ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem 0', fontStyle: 'italic' }}>
                        {crudForm.product_type === 'service'
                          ? 'Belum ada link platform freelance. Klik "+ Tambah Link" jika menyediakan pemesanan via Fastwork, Projects.co.id, dll.'
                          : (crudForm.product_type === 'food'
                              ? 'Belum ada link pesan-antar. Klik "+ Tambah Link" untuk GoFood, GrabFood, ShopeeFood, atau Tokopedia.'
                              : 'Belum ada link marketplace. Klik "+ Tambah Link" jika produk ini dijual di marketplace.')}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.5rem' }}>
                        {crudForm.purchase_links.map((link, index) => (
                          <div 
                            key={index} 
                            style={{ 
                              padding: '0.75rem', 
                              border: '1px solid var(--border-light)', 
                              borderRadius: '0.5rem', 
                              backgroundColor: 'var(--card-bg-gradient)',
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
                                top: '0.4rem',
                                right: '0.4rem',
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
                            
                            <div className="form-group" style={{ marginBottom: '0.5rem', width: '85%' }}>
                              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Platform / Toko *</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder={
                                  crudForm.product_type === 'service' 
                                    ? "Fastwork / Projects.co.id / Fiverr" 
                                    : (crudForm.product_type === 'food'
                                        ? "GoFood / GrabFood / ShopeeFood / Tokopedia"
                                        : "Shopee / Tokopedia / TikTok Shop")
                                }
                                required
                                value={link.platform}
                                onChange={(e) => {
                                  const newLinks = [...crudForm.purchase_links]
                                  newLinks[index].platform = e.target.value
                                  setCrudForm({ ...crudForm, purchase_links: newLinks })
                                }}
                                style={{ fontSize: '0.78rem', height: '36px' }}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>URL Link Produk *</label>
                              <input
                                type="url"
                                className="form-input"
                                placeholder={
                                  crudForm.product_type === 'service' 
                                    ? "https://fastwork.id/user/..." 
                                    : (crudForm.product_type === 'food'
                                        ? "https://gofood.link/... atau https://tokopedia.com/..."
                                        : "https://shopee.co.id/...")
                                }
                                required
                                value={link.url}
                                onChange={(e) => {
                                  const newLinks = [...crudForm.purchase_links]
                                  newLinks[index].url = e.target.value
                                  setCrudForm({ ...crudForm, purchase_links: newLinks })
                                }}
                                style={{ fontSize: '0.78rem', height: '36px' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Opsi Transaksi WhatsApp (Per Produk) */}
                <div style={{ marginTop: '1rem', marginBottom: '1.25rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1.25rem' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800 }}>
                      {crudForm.product_type === 'property' 
                        ? 'Kontak & Janji Survey Properti' 
                        : (crudForm.product_type === 'service'
                            ? 'Opsi Transaksi & Escrow Layanan'
                            : (crudForm.product_type === 'food'
                                ? 'Opsi Transaksi Pesanan Kuliner'
                                : 'Opsi Transaksi WhatsApp'))}
                    </label>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', display: 'block' }}>
                      {crudForm.product_type === 'property' 
                        ? 'Pengunjung akan langsung menghubungi WhatsApp Anda untuk informasi unit & jadwal survey fisik:' 
                        : (crudForm.product_type === 'service'
                            ? 'Atur ketersediaan Rekber Syariah sebagai penengah escrow aman saat pengerjaan jasa:'
                            : (crudForm.product_type === 'food'
                                ? 'Atur ketersediaan Pesan Antar WA langsung atau Rekber Syariah untuk menu ini:'
                                : 'Atur ketersediaan metode transaksi WA untuk item ini:'))}
                    </small>
                  </div>

                  {/* Smart Tip for Food */}
                  {crudForm.product_type === 'food' && (
                    <div style={{ padding: '0.55rem 0.75rem', borderRadius: '0.45rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '0.65rem', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      💡 <strong>Tips Kuliner:</strong> Untuk makanan siap saji / instan, gunakan <strong>Chat WA Langsung</strong> atau tautan <strong>GoFood/ShopeeFood</strong>. Opsi <strong>Rekber Syariah</strong> disarankan untuk frozen food, snack tahan lama, hampers, atau katering besar.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {crudForm.product_type !== 'property' && (
                      <label 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '0.65rem', 
                          padding: '0.75rem 0.85rem', 
                          borderRadius: '0.55rem', 
                          border: `1px solid ${crudForm.enable_wa_rekber !== false ? 'var(--primary)' : 'var(--border-light)'}`, 
                          backgroundColor: crudForm.enable_wa_rekber !== false ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)', 
                          cursor: 'pointer'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={crudForm.enable_wa_rekber !== false}
                          onChange={(e) => setCrudForm({ ...crudForm, enable_wa_rekber: e.target.checked })}
                          style={{ marginTop: '0.15rem', width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                              {crudForm.product_type === 'service' 
                                ? 'Rekber Syariah (Escrow Aman)' 
                                : (crudForm.product_type === 'food'
                                    ? 'Rekber Syariah (Frozen / Katering / Snack)'
                                    : 'Chat WA & Rekber Syariah')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowRekberExplainerModal(true);
                              }}
                              style={{
                                background: 'var(--primary-glow)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.25rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Pelajari apa itu Rekber Syariah"
                            >
                              <HelpCircle size={11} /> Apa ini?
                            </button>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem', lineHeight: 1.3 }}>
                            {crudForm.product_type === 'service'
                              ? 'Dana ditahan aman di rekening penampung syariah sampai pengerjaan tuntas & terverifikasi oleh klien.'
                              : (crudForm.product_type === 'food'
                                  ? 'Gunakan Rekber Syariah untuk pesanan frozen food luar kota, hampers, atau katering besar.'
                                  : 'Gunakan Rekening Bersama Syariah (rekbersyariah.com) yang aman.')}
                          </span>
                        </div>
                      </label>
                    )}

                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.65rem', 
                        padding: '0.75rem 0.85rem', 
                        borderRadius: '0.55rem', 
                        border: `1px solid ${crudForm.enable_wa_direct !== false ? 'var(--primary)' : 'var(--border-light)'}`, 
                        backgroundColor: crudForm.enable_wa_direct !== false ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)', 
                        cursor: 'pointer'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={crudForm.enable_wa_direct !== false}
                        onChange={(e) => setCrudForm({ ...crudForm, enable_wa_direct: e.target.checked })}
                        style={{ marginTop: '0.15rem', width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                          {crudForm.product_type === 'property' 
                            ? 'Chat WA (Janji Survey & Konsultasi)' 
                            : (crudForm.product_type === 'service'
                                ? 'Chat WA (Konsultasi & Booking Langsung)'
                                : (crudForm.product_type === 'food'
                                    ? 'Chat WA (Pesan Antar / Order Langsung)'
                                    : 'Chat WA (Transaksi Langsung)'))}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem', lineHeight: 1.3 }}>
                          {crudForm.product_type === 'property' 
                            ? 'Izinkan calon pembeli menghubungi untuk konsultasi properti dan jadwal survey lokasi.' 
                            : (crudForm.product_type === 'service'
                                ? 'Izinkan klien langsung berkonsultasi mengenai scope pekerjaan, deadline, & estimasi waktu.'
                                : (crudForm.product_type === 'food'
                                    ? 'Izinkan pembeli langsung memesan menu, request porsi/rasa, dan konfirmasi alamat pengiriman.'
                                    : 'Izinkan pembeli langsung menghubungi penjual via chat WhatsApp.'))}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <RichTextarea
                  label={typeConfig.descLabel}
                  rows={6}
                  placeholder={typeConfig.descPlaceholder}
                  required={crudForm.product_type !== 'food'}
                  value={crudForm.description}
                  onChange={(val) => setCrudForm({ ...crudForm, description: val })}
                />

                <button 
                  type="submit" 
                  className="btn-full btn-primary"
                  disabled={crudLoading}
                  style={{ marginTop: '1rem', height: '44px', fontSize: '0.9rem', fontWeight: 'bold' }}
                >
                  {crudLoading ? 'Menyimpan...' : 'Simpan Item'}
                </button>
              </form>
            </div>
          </div>
        );
      })() : view === 'article-editor' ? (
        /* ==========================================================
           MOBILE FULL-PAGE ARTICLE EDITOR (WORDPRESS/BLOGGER STYLE)
           ========================================================== */
        <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', padding: '1rem', paddingBottom: '4rem', overflowY: 'auto' }}>
          {/* Sub-Header / Back Bar */}
          <div style={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 100, 
            backgroundColor: 'var(--header-bg)', 
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '1rem',
            paddingBottom: '0.75rem', 
            borderBottom: '1px solid var(--border-light)', 
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            marginTop: '-1rem', 
            marginLeft: '-1rem', 
            marginRight: '-1rem', 
            paddingLeft: '1rem', 
            paddingRight: '1rem',
            marginBottom: '1.25rem' 
          }}>
            <button 
              type="button"
              onClick={() => {
                setView('tabs')
                setActiveTab('admin')
                setAdminSubTab('articles')
              }}
              className="btn-back-circle"
              title="Batal"
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.98rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {editingArticle ? 'Edit Artikel' : 'Tulis Artikel'}
            </span>
            <button 
              type="button"
              onClick={(e) => handleSaveArticle(e)}
              className="btn-primary"
              disabled={articlesLoading}
              style={{ padding: '0.38rem 1rem', fontSize: '0.8rem', fontWeight: 800, borderRadius: '0.5rem' }}
            >
              {articlesLoading ? '...' : 'Terbitkan'}
            </button>
          </div>

          {/* Title Editor */}
          <div style={{ marginBottom: '1.25rem' }}>
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
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                paddingBottom: '0.5rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Visual / HTML / Preview Tabs */}
          <div className="editor-tab-row" style={{ marginBottom: '0.75rem' }}>
            <button 
              className={`editor-tab-btn ${editorTab === 'compose' ? 'active' : ''}`}
              onClick={() => {
                if (editorTab === 'html' && editorRef.current) {
                  editorRef.current.innerHTML = articleForm.content
                }
                setEditorTab('compose')
              }}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Compose
            </button>
            <button 
              className={`editor-tab-btn ${editorTab === 'html' ? 'active' : ''}`}
              onClick={() => setEditorTab('html')}
              style={{ flex: 1, textAlign: 'center' }}
            >
              HTML
            </button>
            <button 
              className={`editor-tab-btn ${editorTab === 'preview' ? 'active' : ''}`}
              onClick={() => setEditorTab('preview')}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Preview
            </button>
          </div>

          {/* Editor Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '300px' }}>
            {editorTab === 'compose' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Visual Toolbar */}
                <div className="editor-toolbar" style={{ display: 'flex', gap: '0.15rem', padding: '0.35rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <button type="button" className="editor-btn" onClick={() => execFormat('bold')}><Bold size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('italic')}><Italic size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('underline')}><Underline size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('strikeThrough')}><Strikethrough size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('formatBlock', '<h2>')} style={{ fontWeight: 800, fontSize: '0.75rem' }}>H2</button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('formatBlock', '<h3>')} style={{ fontWeight: 800, fontSize: '0.75rem' }}>H3</button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('justifyLeft')}><AlignLeft size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('justifyCenter')}><AlignCenter size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('justifyRight')}><AlignRight size={14} /></button>
                  <button type="button" className="editor-btn" onClick={() => execFormat('insertUnorderedList')}><List size={14} /></button>
                  <button type="button" className="editor-btn" onClick={insertLinkUrl}><LinkIcon size={14} /></button>
                  <button type="button" className="editor-btn" onClick={insertImageUrl}><Image size={14} /></button>
                  <button type="button" className="editor-btn" onClick={clearFormatting}><Heading size={14} /></button>
                </div>
                {/* Editor canvas */}
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
                    style={{ fontSize: '0.9rem', padding: '1rem' }}
                  />
                </div>

                {/* Blogger-style Image Settings Toolbar */}
                {selectedEditorImage && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    backgroundColor: '#1b221e',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    marginTop: '0.5rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease',
                    flexWrap: 'wrap'
                  }}>
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
                    
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => {
                          setShowImageSettingsModal(true);
                        }}
                      >
                        <Settings size={12} /> Edit
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
              </div>
            )}

            {editorTab === 'html' && (
              <div className="editor-canvas-container">
                <textarea 
                  className="editor-textarea"
                  placeholder="Kode HTML..."
                  value={articleForm.content}
                  onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '1rem' }}
                />
              </div>
            )}

            {editorTab === 'preview' && (
              <div className="editor-canvas-container">
                <div className="editor-preview" style={{ padding: '1rem' }}>
                  {articleForm.image_url ? (
                    <img 
                      src={articleForm.image_url} 
                      alt="Cover" 
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-light)' }} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '140px',
                      borderRadius: '0.5rem',
                      marginBottom: '1rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--card-bg-gradient)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      color: 'var(--text-muted)'
                    }}>
                      <Image size={24} style={{ opacity: 0.2 }} />
                      <span style={{ fontSize: '0.7rem', letterSpacing: '0.05em', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase' }}>No Cover Image</span>
                    </div>
                  )}
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {articleForm.title || 'Judul Artikel'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                    <span>Oleh: {articleForm.author}</span>
                    <span>&bull;</span>
                    <span>{articleForm.read_time}</span>
                  </div>
                  {articleForm.content ? (
                    <FormattedText text={articleForm.content} style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-primary)' }} />
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Konten kosong...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings Section (SEO & Metadata) */}
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              SEO & Metadata
            </h4>
            
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Permalink (Slug URL) *</label>
              <input 
                type="text"
                className="form-input"
                required
                value={articleForm.slug}
                onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Meta Deskripsi SEO</span>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: articleForm.meta_description.length > 160 ? 'var(--danger)' : 'var(--success)' 
                }}>
                  {articleForm.meta_description.length}/160
                </span>
              </label>
              <textarea 
                rows={3}
                className="form-input"
                placeholder="Meta deskripsi untuk Google..."
                value={articleForm.meta_description}
                onChange={(e) => setArticleForm({ ...articleForm, meta_description: e.target.value })}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>URL Gambar Sampul</label>
              <input 
                type="text"
                className="form-input"
                value={articleForm.image_url}
                onChange={(e) => setArticleForm({ ...articleForm, image_url: e.target.value })}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Penulis *</label>
                <input 
                  type="text"
                  className="form-input"
                  required
                  value={articleForm.author}
                  onChange={(e) => setArticleForm({ ...articleForm, author: e.target.value })}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Waktu Baca *</label>
                <input 
                  type="text"
                  className="form-input"
                  required
                  value={articleForm.read_time}
                  onChange={(e) => setArticleForm({ ...articleForm, read_time: e.target.value })}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              {/* Comments Toggle */}
              <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
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
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>Aktifkan Komentar Pembaca</span>
                </label>
                <small style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  Jika diaktifkan, pembaca dapat meninggalkan komentar.
                </small>
              </div>

              {articleForm.is_comments_enabled && (
                <div style={{ gridColumn: 'span 2', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '2px solid var(--border-light)', marginTop: '0.25rem' }}>
                  {/* Require Approval */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={articleForm.require_comment_approval}
                        onChange={(e) => setArticleForm({ ...articleForm, require_comment_approval: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>Tahan Komentar untuk Moderasi</span>
                    </label>
                    <small style={{ display: 'block', marginTop: '0.1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Komentar harus disetujui admin sebelum tampil publik.
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
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>Wajibkan Email Komentator</span>
                    </label>
                    <small style={{ display: 'block', marginTop: '0.1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Pengunjung wajib mengisi alamat email untuk mengirim komentar.
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>Verifikasi Domain Email (DNS MX)</span>
                      </label>
                      <small style={{ display: 'block', marginTop: '0.1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Memeriksa keaslian server domain email (mencegah dummy email).
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Bottom padding spacer to prevent clipping */}
          <div style={{ height: '3.5rem' }} />
        </div>
      ) : (
        <>
          <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Mobile Top Header (Shows Catavor brand header on 404 error pages, and store header on valid pages) */}
      {error ? (
        <header className="mobile-header sticky-header">
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <span style={{ 
                fontSize: '1.25rem', 
                fontWeight: 800, 
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
              }}>
                Catavor
              </span>
            </a>
            <button 
              type="button"
              className="btn-primary" 
              onClick={() => { window.location.href = window.location.origin; }}
              style={{ 
                padding: '0.35rem 0.8rem', 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                borderRadius: '0.45rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <Globe size={13} />
              <span>Portal Utama</span>
            </button>
          </div>
        </header>
      ) : (
        <header className="mobile-header sticky-header">
          <div className="container">
            {(() => {
              // About Page Sub-View: QR Code Sub-Page Header
              if (activeTab === 'about' && aboutSubView === 'qrcode') {
                return (
                  <div className="mobile-header-bar" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAboutSubView('main');
                        const slug = storeSlug || getStoreSlug();
                        if (slug) {
                          window.history.pushState({}, '', `/${slug}/about`);
                        }
                      }}
                      className="btn-back-circle"
                      title="Kembali"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        fontSize: '0.94rem', 
                        fontWeight: 800, 
                        color: 'var(--text-primary)', 
                        letterSpacing: '-0.01em',
                        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center'
                      }}>
                        Bagikan Katalog
                      </span>
                    </div>

                    {/* Right spacer to balance left back button */}
                    <div style={{ width: '36px', height: '36px', flexShrink: 0 }} />
                  </div>
                );
              }

              // Admin Panel Sub-Pages Header (Hides store title & share button, shows back button + menu title + action button)
              if (activeTab === 'admin' && adminSubTab !== 'menu') {
                return (
                  <div className="mobile-header-bar" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const slug = getStoreSlug();
                        if (adminSubTab === 'help' && selectedTicket) {
                          setSelectedTicket(null);
                          if (slug) {
                            window.history.pushState({}, '', `/${slug}/admin/help`);
                          }
                        } else if (adminSubTab === 'settings' && mobileSettingsTab && mobileSettingsTab !== 'menu') {
                          setMobileSettingsTab('menu');
                          if (slug) {
                            window.history.pushState({}, '', `/${slug}/admin/settings`);
                          }
                        } else {
                          setAdminSubTab('menu');
                          setSelectedTicket(null);
                          if (slug) {
                            window.history.pushState({}, '', `/${slug}/admin`);
                          }
                        }
                      }}
                      className="btn-back-circle"
                      title="Kembali"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        fontSize: '0.94rem', 
                        fontWeight: 800, 
                        color: 'var(--text-primary)', 
                        letterSpacing: '-0.01em',
                        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left'
                      }}>
                        {adminSubTab === 'items' && 'Kelola Inventaris'}
                        {adminSubTab === 'settings' && (
                          mobileSettingsTab === 'general' ? 'Profil & Identitas Utama' :
                          mobileSettingsTab === 'contact' ? 'Kontak & Saluran Resmi' :
                          mobileSettingsTab === 'about' ? 'Halaman Tentang Kami' :
                          mobileSettingsTab === 'theme' ? 'Tema & Tampilan Visual' :
                          mobileSettingsTab === 'master' ? 'Master Data Katalog' : 'Pengaturan'
                        )}
                        {adminSubTab === 'profile' && 'Profil Admin'}
                        {adminSubTab === 'policies' && 'Legal & Kebijakan'}
                        {adminSubTab === 'notifications' && 'Notifikasi & Aktivitas'}
                        {adminSubTab === 'help' && (
                          selectedTicket ? `Detail Tiket #${selectedTicket.id}` : 'Pusat Bantuan & Support'
                        )}
                      </span>
                    </div>

                    {adminSubTab === 'items' && (
                      <button 
                        type="button"
                        className="btn-primary" 
                        style={{ 
                          padding: '0.35rem 0.65rem', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.75rem', 
                          fontWeight: 800,
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.2rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        onClick={openCreateSheet}
                      >
                        <Plus size={14} />
                        <span>Tambah</span>
                      </button>
                    )}
                  </div>
                );
              }

              // Standard Store Header (Shown on Store Catalog, About, Articles, and Main Admin Dashboard Menu)
              const titleText = settings.store_title || 'Catavor';
              const scale = getMobileHeaderScale(titleText);
              return (
                <div className="mobile-header-bar" style={{ gap: scale.gap }}>
                  <div className="mobile-header-brand" style={{ gap: scale.gap }}>
                    {settings.store_logo_url ? (
                      <img 
                        src={settings.store_logo_url} 
                        alt="Logo" 
                        style={{ height: `${scale.iconSize}px`, width: 'auto', maxWidth: '100px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} 
                      />
                    ) : null}
                    <div className="mobile-header-title-wrapper" style={{ gap: '0.35rem' }}>
                      <h1 
                        className="logo-title" 
                        style={{ fontSize: scale.titleFontSize }}
                        title={titleText}
                      >
                        {titleText}
                      </h1>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="header-more-btn"
                      onClick={() => setActionMenuData({ type: 'store' })}
                      title="Menu & Opsi Katalog"
                    >
                      <MoreVertical size={18} style={{ color: 'var(--primary)' }} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </header>
      )}

      {/* Tabs Content */}
      <main className="container" style={{ marginTop: '1.25rem', paddingTop: '0.25rem' }}>
        {/* Catavor SaaS Floating Banner for Free Plan Stores */}
        {activeTab === 'catalog' && settings.plan === 'free' && (
          <div 
            className="glass-panel animate-fade-in"
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              marginBottom: '1rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                <Sparkles size={14} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#e5e7eb', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
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
                padding: '0.35rem 0.65rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                borderRadius: '0.45rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                flexShrink: 0
              }}
            >
              Buat Katalog Gratis ⚡
            </button>
          </div>
        )}

        {/* Full-Page Pemilihan Tipe Usaha / Produk (Step 1 Input Data) */}
        {showProductTypeSelector && (
          <div 
            className="ambient-glow-bg animate-fade-in"
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 1050, 
              overflowY: 'auto', 
              backgroundColor: 'var(--bg-deep)', 
              display: 'flex', 
              flexDirection: 'column' 
            }}
          >
            {/* Sticky Header Bar */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              backgroundColor: 'var(--header-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid var(--border-light)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleExitProductTypeSelector}
                  className="btn-back-circle"
                  title="Kembali"
                >
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                    Pilih Tipe Item Katalog
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Step 1 dari 2: Kategori Item Katalog
                  </span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleExitProductTypeSelector}
                style={{ 
                  background: 'var(--btn-secondary-bg)', 
                  border: '1px solid var(--btn-secondary-border)', 
                  color: 'var(--text-secondary)', 
                  fontSize: '0.75rem', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px'
                }}
              >
                Batal
              </button>
            </div>

            {/* Page Body Container */}
            <div style={{ flex: 1, padding: '1.25rem 1rem 3rem 1rem', maxWidth: '600px', width: '100%', margin: '0 auto' }}>
              
              {/* Hero Banner Header */}
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '1.25rem', 
                  borderRadius: '1.15rem', 
                  marginBottom: '1.25rem', 
                  border: '1px solid var(--border-light)', 
                  background: 'var(--card-bg-gradient)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)' 
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', borderRadius: '9999px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--border-light)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                  <Sparkles size={12} /> Tipe Katalog Item
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0', letterSpacing: '-0.02em' }}>
                  Mau Menambahkan Item Apa Hari Ini?
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                  Pilih tipe item katalog di bawah agar struktur formulir, bidang input, dan atribut spesifik disesuaikan secara otomatis.
                </p>
              </div>

              {/* Product Type Options Grid / List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                
                {/* 1. Barang Fisik */}
                <div 
                  onClick={() => handleSelectProductType('physical')}
                  style={{ 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '1rem', 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  className="mobile-card-hover"
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '0.85rem', 
                    backgroundColor: 'rgba(59, 130, 246, 0.15)', 
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#3b82f6', 
                    flexShrink: 0 
                  }}>
                    <Package size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Barang Fisik
                      </h4>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        Fisik & Stok
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem 0', lineHeight: 1.35, fontWeight: 500 }}>
                      Pakaian, Aksesoris, Gadget, Kerajinan, & Produk Fisik.
                    </p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚡ Form: Stok, Kondisi, Berat, Merek, Varian
                    </div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronRight size={18} style={{ color: '#3b82f6' }} />
                  </div>
                </div>

                {/* 2. Item Digital */}
                <div 
                  onClick={() => handleSelectProductType('digital')}
                  style={{ 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '1rem', 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  className="mobile-card-hover"
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '0.85rem', 
                    backgroundColor: 'rgba(139, 92, 246, 0.15)', 
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#8b5cf6', 
                    flexShrink: 0 
                  }}>
                    <FileCode size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Item Digital
                      </h4>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        File & Lisensi
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem 0', lineHeight: 1.35, fontWeight: 500 }}>
                      E-book, Template, File PDF, Source Code, Lisensi & Unduhan.
                    </p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚡ Form: Format File, Ukuran File, &amp; Tipe Lisensi
                    </div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronRight size={18} style={{ color: '#8b5cf6' }} />
                  </div>
                </div>

                {/* 3. Satwa & Living Fauna */}
                <div 
                  onClick={() => handleSelectProductType('fauna')}
                  style={{ 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '1rem', 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  className="mobile-card-hover"
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '0.85rem', 
                    backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#10b981', 
                    flexShrink: 0 
                  }}>
                    <PawPrint size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Satwa & Living Fauna
                      </h4>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Satwa & Fauna
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem 0', lineHeight: 1.35, fontWeight: 500 }}>
                      Pet Shop, Reptil, Burung, Ikan Hias, Tanaman Hias, & Biota.
                    </p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚡ Form: Nama Latin, Asal, Bobot, Masa Hidup
                    </div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronRight size={18} style={{ color: '#10b981' }} />
                  </div>
                </div>

                {/* 4. Jasa & Layanan */}
                <div 
                  onClick={() => handleSelectProductType('service')}
                  style={{ 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '1rem', 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  className="mobile-card-hover"
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '0.85rem', 
                    backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#f59e0b', 
                    flexShrink: 0 
                  }}>
                    <Wrench size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Jasa & Layanan
                      </h4>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        Jasa & Sesi
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem 0', lineHeight: 1.35, fontWeight: 500 }}>
                      Grooming, Desain, Service, Repair, Kursus, & Konsultasi.
                    </p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚡ Form: Estimasi Durasi, Lokasi Layanan, &amp; Area Jangkauan
                    </div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronRight size={18} style={{ color: '#f59e0b' }} />
                  </div>
                </div>

                {/* 5. Makanan & Minuman (F&B) */}
                <div 
                  onClick={() => handleSelectProductType('food')}
                  style={{ 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '1rem', 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  className="mobile-card-hover"
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '0.85rem', 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#ef4444', 
                    flexShrink: 0 
                  }}>
                    <Utensils size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Menu Kuliner (F&B)
                      </h4>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '0.35rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        Kuliner & F&B
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.45rem 0', lineHeight: 1.35, fontWeight: 500 }}>
                      Kuliner, Camilan, Frozen Food, Minuman Olahan, & Katering.
                    </p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚡ Form: Porsi, Expired Date, Suhu Simpan, Sertifikasi
                    </div>
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronRight size={18} style={{ color: '#ef4444' }} />
                  </div>
                </div>

              </div>

              {/* Bottom Cancel Action */}
              <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleExitProductTypeSelector}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '0.85rem',
                    backgroundColor: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--btn-secondary-border)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <ArrowLeft size={16} /> Batal & Kembali ke Kelola Item
                </button>
              </div>

            </div>
          </div>
        )}


        
        {/* ==========================================================
           TAB 1: CATALOG
           ========================================================== */}
        {activeTab === 'catalog' && (
          <>
            {/* List Render */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader className="animate-spin" size={28} style={{ color: 'var(--primary)' }} />
              </div>
            )}

            {error && (
              <div 
                className="glass-panel animate-fade-in" 
                style={{ 
                  padding: '3.5rem 1.5rem 2.5rem 1.5rem', 
                  textAlign: 'center', 
                  borderRadius: '1.5rem',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(9, 14, 12, 0.95) 100%)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.25rem',
                  margin: '1rem 0',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Ambient Glow Background */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.12)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', filter: 'blur(30px)', pointerEvents: 'none' }} />

                {/* 404 Status Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.85rem', borderRadius: '20px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
                  404 • Halaman Tidak Ditemukan
                </div>

                {/* Glowing Icon Container */}
                <div 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                    border: '2px solid rgba(245, 158, 11, 0.35)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#f59e0b',
                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)'
                  }}
                >
                  {storeSlug ? <Store size={40} /> : <Globe size={40} />}
                </div>

                {/* Text Content */}
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    {storeSlug ? 'Katalog Tidak Ditemukan' : 'Halaman Tidak Ditemukan'}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#9ca3af', maxWidth: '320px', margin: '0 auto', lineHeight: 1.6 }}>
                    {storeSlug 
                      ? <>Tautan atau username katalog <strong style={{ color: '#e5e7eb' }}>catavor.com/{storeSlug}</strong> tidak terdaftar di sistem Catavor.</>
                      : <>Alamat tautan URL <strong style={{ color: '#e5e7eb' }}>{window.location.pathname}</strong> tidak terdaftar atau salah ketik.</>}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '290px', marginTop: '0.5rem' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => { window.location.href = window.location.origin; }}
                    style={{ padding: '0.8rem 1.25rem', fontSize: '0.84rem', fontWeight: 800, borderRadius: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}
                  >
                    <Sparkles size={16} />
                    Buat Katalog Anda Gratis ⚡
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => { window.location.href = window.location.origin; }}
                    style={{ padding: '0.7rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                  >
                    <Globe size={15} />
                    Ke Halaman Utama Portal
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && (
              <>
                {faunas.length === 0 ? (
                  /* EXECUTIVE PREMIUM EMPTY STATE (Shown when store has 0 products) */
                  <div 
                    className="glass-panel animate-fade-in" 
                    style={{ 
                      padding: '3.25rem 1.5rem', 
                      textAlign: 'center', 
                      borderRadius: '1rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--card-bg-gradient)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1rem',
                      margin: '1.25rem 0 1rem 0'
                    }}
                  >
                    <div 
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--primary-glow)', 
                        border: '2px solid var(--border-light)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        boxShadow: '0 0 18px var(--primary-glow)'
                      }}
                    >
                      <Layers size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        Katalog Masih Kosong
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
                        Pemilik catalog <strong style={{ color: 'var(--text-primary)' }}>{settings.store_title || 'ini'}</strong> belum mengunggah data ke dalam katalog ini. Silakan kunjungi kembali nanti!
                      </p>
                    </div>
                    {isStoreOwner && (
                      <button 
                        className="btn-primary" 
                        onClick={openCreateSheet}
                        style={{ padding: '0.6rem 1.25rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', marginTop: '0.25rem' }}
                      >
                        + Tambah Produk Pertama
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Smart Placeholder when filter is floating to prevent layout shift */}
                    {isFilterFloating && (
                      <div 
                        style={{ 
                          height: `${filterBarHeight}px`, 
                          marginBottom: '0.85rem',
                          visibility: 'hidden',
                          pointerEvents: 'none'
                        }} 
                        aria-hidden="true" 
                      />
                    )}

                    {/* Mobile Search & Filters (Smart Floating Sticky Bar: Auto-Hide Down, Reveal Up) */}
                    <section 
                      ref={(el) => {
                        searchSectionRef.current = el;
                        if (el && el.offsetHeight && !isFilterFloating) {
                          setFilterBarHeight(el.offsetHeight);
                        }
                      }}
                      className={`mobile-search-section ${isFilterFloating ? 'sticky-floating' : ''} ${isFilterFloating ? (isFilterVisible ? 'visible' : 'hidden') : ''}`}
                    >
                      {/* Row 1: Search Input + Unified Advanced Filter Trigger Button */}
                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', width: '100%' }}>
                        <div className="search-wrapper" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                          <Search className="search-icon" />
                          <input 
                            type="text" 
                            className="search-input" 
                            placeholder="Cari produk / item katalog..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          {search && (
                            <button
                              type="button"
                              onClick={() => setSearch('')}
                              className="search-clear-btn"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Unified Industry-Standard Filter Lanjutan & Urutkan Trigger Button */}
                        <button
                          type="button"
                          className={`advanced-filter-trigger-btn ${(classFilter !== 'all' || sortBy !== 'newest') ? 'active' : ''}`}
                          onClick={() => setShowFilterSheet(true)}
                          title="Filter Kategori & Urutan Katalog"
                        >
                          <SlidersHorizontal size={14} />
                          <span>Filter</span>
                          {(classFilter !== 'all' || sortBy !== 'newest') && (
                            <span className="filter-badge-dot" />
                          )}
                        </button>
                      </div>

                      {/* Row 2: Product Type Filter Tabs (Only shown if store has multiple types) */}
                      {isHybridStore && (
                        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.15rem', marginTop: '0.35rem', marginBottom: '0.15rem', WebkitOverflowScrolling: 'touch' }}>
                          <button
                            type="button"
                            onClick={() => { setProductTypeFilter('all'); setClassFilter('all'); }}
                            style={{
                              padding: '0.32rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              border: productTypeFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              backgroundColor: productTypeFilter === 'all' ? 'var(--primary)' : 'var(--bg-deep)',
                              color: productTypeFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                              boxShadow: productTypeFilter === 'all' ? '0 2px 8px var(--primary-glow)' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            Semua ({faunas.length})
                          </button>
                          {availableProductTypes.includes('physical') && (
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('physical'); setClassFilter('all'); }}
                              style={{
                                padding: '0.32rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: productTypeFilter === 'physical' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: productTypeFilter === 'physical' ? 'var(--primary)' : 'var(--bg-deep)',
                                color: productTypeFilter === 'physical' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: productTypeFilter === 'physical' ? '0 2px 8px var(--primary-glow)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Barang ({faunas.filter(f => (f.product_type || 'physical') === 'physical').length})
                            </button>
                          )}
                          {availableProductTypes.includes('food') && (
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('food'); setClassFilter('all'); }}
                              style={{
                                padding: '0.32rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: productTypeFilter === 'food' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: productTypeFilter === 'food' ? 'var(--primary)' : 'var(--bg-deep)',
                                color: productTypeFilter === 'food' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: productTypeFilter === 'food' ? '0 2px 8px var(--primary-glow)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Kuliner ({faunas.filter(f => f.product_type === 'food').length})
                            </button>
                          )}
                          {availableProductTypes.includes('service') && (
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('service'); setClassFilter('all'); }}
                              style={{
                                padding: '0.32rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: productTypeFilter === 'service' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: productTypeFilter === 'service' ? 'var(--primary)' : 'var(--bg-deep)',
                                color: productTypeFilter === 'service' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: productTypeFilter === 'service' ? '0 2px 8px var(--primary-glow)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Jasa ({faunas.filter(f => f.product_type === 'service').length})
                            </button>
                          )}
                          {availableProductTypes.includes('digital') && (
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('digital'); setClassFilter('all'); }}
                              style={{
                                padding: '0.32rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: productTypeFilter === 'digital' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: productTypeFilter === 'digital' ? 'var(--primary)' : 'var(--bg-deep)',
                                color: productTypeFilter === 'digital' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: productTypeFilter === 'digital' ? '0 2px 8px var(--primary-glow)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Digital ({faunas.filter(f => f.product_type === 'digital').length})
                            </button>
                          )}
                          {availableProductTypes.includes('fauna') && (
                            <button
                              type="button"
                              onClick={() => { setProductTypeFilter('fauna'); setClassFilter('all'); }}
                              style={{
                                padding: '0.32rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: productTypeFilter === 'fauna' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: productTypeFilter === 'fauna' ? 'var(--primary)' : 'var(--bg-deep)',
                                color: productTypeFilter === 'fauna' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: productTypeFilter === 'fauna' ? '0 2px 8px var(--primary-glow)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Fauna ({faunas.filter(f => f.product_type === 'fauna').length})
                            </button>
                          )}
                        </div>
                      )}

                      {/* Row 3: Active Filter Tags & Results Counter */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.15rem 0', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{filteredFaunas.length}</strong> produk
                          </span>
                          {classFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setClassFilter('all')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: 'var(--primary-glow)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary)',
                                cursor: 'pointer'
                              }}
                              title="Hapus filter kategori"
                            >
                              {classFilter} ✕
                            </button>
                          )}
                          {sortBy !== 'newest' && (
                            <button
                              type="button"
                              onClick={() => setSortBy('newest')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: 'var(--primary-glow)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary)',
                                cursor: 'pointer'
                              }}
                              title="Kembalikan urutan default"
                            >
                              {sortBy === 'price_asc' ? 'Termurah' : sortBy === 'price_desc' ? 'Tertinggi' : sortBy === 'name_asc' ? 'A - Z' : 'Terlama'} ✕
                            </button>
                          )}
                        </div>

                        {(search || classFilter !== 'all' || habitatFilter !== 'all' || productTypeFilter !== 'all' || sortBy !== 'newest') && (
                          <button
                            type="button"
                            onClick={() => { setSearch(''); setClassFilter('all'); setHabitatFilter('all'); setProductTypeFilter('all'); setSortBy('newest'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Reset Semua
                          </button>
                        )}
                      </div>
                    </section>

                    {filteredFaunas.length === 0 ? (
                      /* SEARCH NO RESULTS EMPTY STATE */
                      <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '0.85rem' }}>
                        <Search size={36} style={{ marginBottom: '0.65rem', color: 'var(--text-muted)' }} />
                        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Item Tidak Ditemukan</h3>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Tidak ada item yang sesuai dengan kriteria pencarian atau filter katalog Anda.</p>
                        <button 
                          className="btn-secondary" 
                          onClick={() => { setSearch(''); setClassFilter('all'); setHabitatFilter('all'); setProductTypeFilter('all'); }}
                          style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.45rem' }}
                        >
                          Reset Filter Pencarian
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mobile-list-grid">
                          {filteredFaunas.slice(0, displayLimit).map((item) => (
                      <div 
                        key={item.id} 
                        className="glass-panel mobile-grid-card"
                        onClick={() => openDetailsSheet(item.id)}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '0.85rem' }}
                      >
                        {/* Clean Product Photo without Emoji Stickers */}
                        <div style={{ width: '100%', height: '140px', position: 'relative', overflow: 'hidden', backgroundColor: '#131916' }}>
                          {/* Fallback displayed under the image */}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg-gradient)', color: 'var(--text-secondary)', zIndex: 1 }}>
                            <Compass size={24} style={{ opacity: 0.3 }} />
                            <span style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.3 }}>No Photo</span>
                          </div>

                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 2 }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuData({ type: 'item', item });
                            }}
                            className="card-more-action-btn"
                            title="Opsi Produk"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>

                        {/* Card Body with Clean Typography and Prominent Price */}
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: 'var(--primary-glow)',
                                color: 'var(--primary)',
                                border: '1px solid var(--border-light)',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}>
                                {item.class}
                              </span>
                            </div>
                            <h3 style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.25,
                              minHeight: '2.05rem',
                              margin: '0.15rem 0 0.2rem'
                            }}>
                              {item.name}
                            </h3>
                            <div style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginBottom: '0.45rem'
                            }}>
                              {item.product_type === 'property'
                                ? `${item.attributes?.transaction_type || 'Dijual'} • ${item.attributes?.certificate || 'SHM'}${item.attributes?.land_area ? ' • LT ' + item.attributes.land_area + 'm²' : ''}${item.attributes?.building_area ? ' • LB ' + item.attributes.building_area + 'm²' : ''}`
                                : item.product_type === 'digital' 
                                ? `${item.attributes?.file_format ? item.attributes.file_format + ' • ' : ''}${item.attributes?.file_size || 'Digital File'}${item.attributes?.license_type ? ' • ' + item.attributes.license_type : ''}`
                                : item.product_type === 'physical'
                                ? `${item.attributes?.brand ? item.attributes.brand + ' • ' : ''}${item.attributes?.condition || 'Baru'}${item.attributes?.weight ? ' • ' + item.attributes.weight + 'g' : ''}`
                                : item.product_type === 'service'
                                ? `Durasi: ${item.attributes?.duration || '1 Sesi'}${item.attributes?.service_location ? ' • ' + item.attributes.service_location : ''}`
                                : item.product_type === 'food'
                                ? `Exp: ${item.attributes?.expired_info || '7 Hari'}${item.attributes?.storage_temp ? ' • ' + item.attributes.storage_temp : ''}`
                                : (item.scientific_name !== 'N/A' && item.scientific_name ? item.scientific_name : item.class)}
                            </div>
                          </div>

                          {/* Full-Width Dedicated Price Row (Standard Industrial E-Commerce Pattern) */}
                          <div style={{
                            borderTop: '1px solid var(--border-light)',
                            paddingTop: '0.45rem',
                            marginTop: 'auto',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <div style={{
                              fontSize: '0.92rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              width: '100%'
                            }}>
                              {formatPrice(item.price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Infinite Scroll loading indicator */}
                  {loadingMore && (
                    <div className="mobile-list-grid" style={{ marginTop: '0.75rem' }}>
                      {[1, 2].map((i) => (
                        <div 
                          key={i} 
                          className="glass-panel mobile-grid-card"
                          style={{ display: 'flex', flexDirection: 'column', height: '220px', opacity: 0.7 }}
                        >
                          <div style={{ height: '130px', backgroundColor: 'rgba(255,255,255,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', animation: 'shimmer 1.5s infinite' }}></div>
                          </div>
                          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ height: '8px', width: '30%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px' }}></div>
                              <div style={{ height: '12px', width: '80%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginTop: '0.5rem' }}></div>
                              <div style={{ height: '8px', width: '50%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', marginTop: '0.35rem' }}></div>
                            </div>
                            <div style={{ height: '12px', width: '60%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px' }}></div>
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
  )}

        {/* ==========================================================
           TAB 2: TENTANG KAMI
           ========================================================== */}
        {activeTab === 'about' && (() => {
          if (aboutSubView === 'qrcode') {
            return (
              <QRCodeMobileSubPage 
                onBack={() => {
                  setAboutSubView('main');
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
            );
          }

          const parsedCards = (() => {
            try {
              return settings.about_cards ? JSON.parse(settings.about_cards) : [];
            } catch (e) {
              return [];
            }
          })();

          const getPremiumIcon = (card: any) => {
            if (card.icon) {
              return renderAboutIcon(card.icon, 20);
            }
            const t = card.title.toLowerCase();
            if (t.includes('sehat') || t.includes('garansi') || t.includes('kesehatan')) {
              return renderAboutIcon('shield', 20);
            }
            if (t.includes('aman') || t.includes('transaksi') || t.includes('bayar') || t.includes('percaya')) {
              return renderAboutIcon('lock', 20);
            }
            if (t.includes('tanya') || t.includes('konsultasi') || t.includes('care') || t.includes('layanan') || t.includes('jual')) {
              return renderAboutIcon('message', 20);
            }
            return renderAboutIcon('compass', 20);
          };

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
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Profile Hero Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0, justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                  <Info size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {hasTitle ? settings.about_title : (settings.store_title || 'Catavor')}
                  </h2>
                  {hasSlogan && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, marginTop: '0.1rem' }}>
                      {settings.about_slogan}
                    </p>
                  )}
                </div>
              </div>

              {/* Profile Description (100% Hidden if empty) */}
              {hasDescription && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {settings.about_description}
                </p>
              )}

              {/* Value Cards (100% Hidden if empty) */}
              {hasCards && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {parsedCards.map((card: any, idx: number) => (
                    <div key={idx} className="glass-panel" style={{ padding: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                      <div style={{ backgroundColor: 'var(--primary-glow)', borderRadius: '0.5rem', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-light)', color: 'var(--primary)' }}>
                        {getPremiumIcon(card)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem', marginTop: '0.1rem' }}>{cleanEmoji(card.title)}</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>{card.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}



              {/* Hubungi Kami Section (100% Hidden if all 5 contact channels are empty) */}
              {hasAnyContactChannel && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', textAlign: 'center', letterSpacing: '0.02em', textTransform: 'uppercase', opacity: 0.9 }}>
                    Hubungi Kami
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Lokasi (100% Hidden if empty - no fallback) */}
                    {hasLocation && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0 }}>
                          <MapPin size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Lokasi / Alamat Resmi</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 700 }}>{settings.about_location}</span>
                        </div>
                      </div>
                    )}

                    {/* Jam Operasional */}
                    {hasHours && <OperationalHoursCard rawHours={settings.about_hours} />}

                    {/* WhatsApp Contacts */}
                    {hasWhatsapp && <WhatsAppContactsCard rawWhatsappNumber={settings.whatsapp_number} />}

                    {/* Official Website */}
                    {hasWebsite && <OfficialWebsiteCard url={settings.official_website} />}

                    {/* Social Media Section */}
                    {hasSocial && <SocialMediaSection rawSocialLinks={settings.social_links} />}
                  </div>
                </div>
              )}

              {/* Share Store Action Button */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleShareStore}
                  className="btn-secondary btn-full"
                  style={{
                    padding: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    width: '100%',
                    cursor: 'pointer',
                    borderRadius: '0.5rem',
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--btn-secondary-border)'
                  }}
                >
                  <Share2 size={16} style={{ color: 'var(--primary)' }} /> Bagikan Halaman Ini
                </button>
              </div>
            </div>
          );
        })()}

        {/* ==========================================================
           TAB 3: ARTIKEL & PANDUAN
           ========================================================== */}
        {false && activeTab === 'articles' && (
          /* ARTICLES LIST VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} /> Artikel & Panduan
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Panduan ahli seputar perawatan dan tips memelihara satwa kesayangan Anda.</p>
            </div>

            {articlesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
              </div>
            ) : articles.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <BookOpen size={36} style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Belum ada artikel yang diterbitkan.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {articles.map((article) => (
                  <div 
                    key={article.id} 
                    className="glass-panel" 
                    onClick={() => {
                      handleSelectArticle(article);
                    }}
                    style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer' }}
                  >
                    {article.image_url ? (
                      <img 
                        src={article.image_url} 
                        alt={article.title} 
                        style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.35rem', marginBottom: '0.25rem', border: '1px solid var(--border-light)' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '120px',
                        borderRadius: '0.35rem',
                        marginBottom: '0.25rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--card-bg-gradient)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        color: 'var(--text-muted)'
                      }}>
                        <Image size={18} style={{ opacity: 0.2 }} />
                        <span style={{ fontSize: '0.65rem', letterSpacing: '0.05em', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase' }}>No Image</span>
                      </div>
                    )}
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>{article.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {stripHtml(article.content)}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span>Oleh: <strong>{article.author}</strong></span>
                      <span>{new Date(article.updated_at || article.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} &bull; {article.read_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================================
           TAB 3: ADMIN PANEL (MOBILE) WITH STRICT MULTI-TENANT GUARD
           ========================================================== */}
        {activeTab === 'admin' && (
          token && !isStoreOwner ? (
            /* 403 FORBIDDEN ACCESS CARD FOR OTHER STORE OWNER */
            <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem 1.25rem', marginTop: '2rem', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#ef4444' }}>
                <ShieldAlert size={28} />
              </div>
              
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.2rem' }}>
                403 • Akses Admin Ditolak
              </span>
              
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
                Izin Pengelola Tidak Ditemukan
              </h2>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Anda terautentikasi sebagai pengelola katalog <strong style={{ color: 'var(--primary)' }}>"{adminUser?.store_slug || 'lain'}"</strong>, tetapi mencoba mengakses panel admin katalog <strong style={{ color: '#ef4444' }}>"{storeSlug}"</strong>. Anda tidak memiliki wewenang untuk mengelola atau melihat data sensitif katalog ini.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {adminUser?.store_slug && (
                  <button 
                    type="button" 
                    className="btn-full btn-primary" 
                    onClick={() => window.location.href = `/${adminUser.store_slug}/admin`}
                    style={{ padding: '0.7rem', fontSize: '0.82rem', fontWeight: 700 }}
                  >
                    Ke Dashboard Katalog Saya ({adminUser.store_slug}) &rarr;
                  </button>
                )}
                
                <button 
                  type="button" 
                  className="btn-full btn-secondary" 
                  onClick={handleLogout}
                  style={{ padding: '0.7rem', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Keluar Sesi / Ganti Akun
                </button>
                
                <button 
                  type="button" 
                  onClick={() => window.location.href = `/${storeSlug}`}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.25rem', textDecoration: 'underline' }}
                >
                  Kembali ke Katalog Publik {storeSlug}
                </button>
              </div>
            </div>
          ) : !token ? (
            /* ADMIN LOGIN (MOBILE - DYNAMIC HIGH-CONTRAST DESIGN) */
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <Lock size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>Login Admin {settings.store_title || 'Catavor'}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Autentikasi login diperlukan untuk masuk.
                </p>
              </div>

              {loginError && (
                <div className="alert-box alert-success" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  {loginError}
                </div>
              )}

              {/* Google SSO Login Button Mobile */}
              <button 
                type="button" 
                onClick={handleGoogleSSO}
                style={{ 
                  width: '100%', 
                  padding: '0.65rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: 'var(--btn-secondary-bg)', 
                  border: '1px solid var(--btn-secondary-border)', 
                  color: 'var(--btn-secondary-text)', 
                  fontSize: '0.8rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem', 
                  marginBottom: '1rem',
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

              <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>ATAU LOGIN MANUAL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
              </div>

              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email Admin *</label>
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
                  <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Password *</label>
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
                  className="btn-full btn-primary" 
                  disabled={loginLoading}
                  style={{ fontWeight: 800 }}
                >
                  {loginLoading ? 'Memverifikasi...' : 'Masuk'}
                </button>
              </form>
            </div>
          ) : !isPasswordChanged ? (
            /* FIRST TIME PASSWORD (MOBILE) */
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <Lock size={32} style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }} />
                <h2 style={{ fontSize: '1.1rem' }}>Ganti Password Pertama Kali</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Demi alasan keamanan, silakan ganti password bawaan seeder terlebih dahulu.
                </p>
              </div>

              {firstPasswordError && (
                <div className="alert-box alert-success" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  {firstPasswordError}
                </div>
              )}

              <form onSubmit={handleFirstPasswordSubmit}>
                <div className="form-group">
                  <label className="form-label">Nama Admin</label>
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
                  <label className="form-label">Ulangi Password Baru *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Ketik ulang password..."
                    required
                    value={firstPasswordForm.confirm_password}
                    onChange={(e) => setFirstPasswordForm({ ...firstPasswordForm, confirm_password: e.target.value })}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-full btn-primary" 
                  disabled={firstPasswordLoading}
                >
                  {firstPasswordLoading ? 'Memproses...' : 'Ubah Password & Masuk'}
                </button>
              </form>
            </div>
          ) : (
            /* ADMIN DASHBOARD (MOBILE - LOGGED IN & PASSWORD CHANGED) */
            <div className="animate-fade-in" style={{ marginTop: '1rem' }}>
              {adminSubTab === 'menu' && (
                /* SIMPLIFIED NATIVE MOBILE ADMIN DASHBOARD */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Top Profile Card - Expert Refined Layout */}
                  <div 
                    className="glass-panel animate-fade-in" 
                    style={{ 
                      padding: '1.15rem', 
                      borderRadius: '1.15rem', 
                      border: '1px solid var(--border-light)', 
                      background: 'var(--card-bg-gradient)', 
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}
                  >
                    {/* Row 1: Avatar + Greeting + Icon Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                          padding: '2px',
                          boxShadow: '0 0 12px var(--primary-glow)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {settings.store_logo_url ? (
                            <img 
                              src={settings.store_logo_url} 
                              alt="Logo" 
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-card)' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: '1.15rem' }}>
                              {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A'}
                            </div>
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Selamat Datang</span>
                          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Halo, {(adminUser?.name || 'Admin').trim().split(' ')[0]}
                          </h2>
                        </div>
                      </div>

                      {/* Clean Icon Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                        <button 
                          type="button"
                          onClick={handleLogout}
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.12)', 
                            border: '1px solid rgba(239, 68, 68, 0.25)', 
                            borderRadius: '50%', 
                            width: '38px',
                            height: '38px',
                            cursor: 'pointer', 
                            color: '#f87171', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation'
                          }}
                          title="Keluar / Logout"
                        >
                          <LogOut size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Status & Metric Metadata Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid var(--border-light)' }}>
                      <span style={{ 
                        fontSize: '0.62rem', 
                        fontWeight: 900, 
                        padding: '0.15rem 0.55rem', 
                        borderRadius: '20px', 
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        backgroundColor: settings.plan === 'free' ? 'rgba(245, 158, 11, 0.15)' : 'var(--primary-glow)',
                        color: settings.plan === 'free' ? '#f59e0b' : 'var(--primary)',
                        border: settings.plan === 'free' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-light)'
                      }}>
                        {settings.plan === 'free' ? 'PLAN FREE' : 'PLAN PRO'}
                      </span>

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {faunas.length} Data Terdaftar
                      </span>
                    </div>
                  </div>

                  {/* Pending Pro Payment Verification Banner */}
                  {adminUser?.payment_status === 'pending_approval' && (
                    <div style={{ padding: '0.85rem 1rem', borderRadius: '0.85rem', background: 'var(--card-bg-gradient)', border: '1px solid rgba(245, 158, 11, 0.4)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>Pembayaran Plan Pro Dalam Verifikasi (1x24 Jam)</strong>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        Bukti pembayaran telah kami terima. Akun Anda dapat digunakan dengan fitur Plan Free sementara sampai disetujui Tim Admin.
                      </p>
                    </div>
                  )}

                  {/* Premium Free Plan Upgrade Promo Card */}
                  {settings.plan === 'free' && (
                    <div 
                      className="glass-panel animate-fade-in" 
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '0.85rem', 
                        border: '1px solid var(--border-light)', 
                        background: 'var(--card-bg-gradient)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.75rem',
                        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', boxShadow: '0 3px 10px rgba(245,158,11,0.4)', flexShrink: 0 }}>
                          ⚡
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            Buka Fitur Unlimited <span style={{ color: 'var(--secondary)' }}>(Plan Pro)</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3, marginTop: '0.1rem' }}>
                            Posting produk tanpa batas &amp; aktifkan Halaman Tentang Kami
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-warning"
                        style={{
                          width: '100%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          padding: '0.65rem 1rem',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          borderRadius: '0.5rem',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
                        }}
                        onClick={handleUpgradeToPro}
                      >
                        <Zap size={15} style={{ flexShrink: 0 }} />
                        <span>Upgrade ke Plan Pro (Rp 30rb/bln)</span>
                      </button>
                    </div>
                  )}

                  {/* Onboarding Banner: Lengkapi Pengaturan Halaman Tentang Kami */}
                  {showAboutOnboarding && (
                    <div style={{
                      padding: '1rem 1.1rem',
                      borderRadius: '0.9rem',
                      background: 'var(--card-bg-gradient)',
                      border: '1px solid var(--border-light)',
                      borderLeft: '4px solid var(--primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginBottom: '1rem',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 16px var(--primary-glow)',
                      backdropFilter: 'blur(10px)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--primary-glow)',
                          border: '1px solid var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px var(--primary-glow)'
                        }}>
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.88rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                            ✨ Selamat Datang di Catavor!
                          </strong>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                            Lengkapi informasi Halaman Tentang Kami (Alamat, Jam Operasional, &amp; Profil Komitmen) agar toko terlihat profesional.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            setAdminSubTab('settings');
                            setMobileSettingsTab('about');
                          }}
                          style={{
                            flex: 1,
                            padding: '0.5rem 0.85rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Sparkles size={14} /> Lengkapi Sekarang
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => dismissAboutOnboarding()}
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Nanti Saja
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MENU GRID SECTION */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* Item 1: Kelola Kategori */}
                    <div 
                      className="glass-panel" 
                      onClick={() => {
                        setAdminSubTab('items');
                        const slug = getStoreSlug();
                        if (slug) window.history.pushState({}, '', `/${slug}/admin/items`);
                      }}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '0.9rem', 
                        background: 'var(--card-bg-gradient)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '0.75rem', 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <Database size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Kelola Kategori</h3>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                          {faunas.length} Data Terdaftar
                        </span>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                    {/* Item 1.5: Notifikasi & Aktivitas */}
                    <div 
                      className="glass-panel" 
                      onClick={() => {
                        setAdminSubTab('notifications');
                        const slug = getStoreSlug();
                        if (slug) {
                          window.history.pushState({}, '', `/${slug}/admin/notifications`);
                        }
                      }}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '0.9rem', 
                        background: 'var(--card-bg-gradient)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '0.75rem', 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)',
                        flexShrink: 0,
                        position: 'relative'
                      }}>
                        <Bell size={22} />
                        {unreadCount > 0 && (
                          <span style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary)',
                            boxShadow: '0 0 8px var(--primary)'
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Notifikasi &amp; Aktivitas</h3>
                          {unreadCount > 0 && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                              {unreadCount} Baru
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                          Pesanan, Komentar, &amp; Info Sistem
                        </span>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                    {/* Item 2: Pengaturan */}
                    <div 
                      className="glass-panel" 
                      onClick={() => {
                        setAdminSubTab('settings');
                        setMobileSettingsTab('menu');
                        const slug = getStoreSlug();
                        if (slug) window.history.pushState({}, '', `/${slug}/admin/settings`);
                      }}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '0.9rem', 
                        background: 'var(--card-bg-gradient)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '0.75rem', 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <Settings size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Pengaturan</h3>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                          Informasi Toko &amp; Akun Admin
                        </span>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                    {/* Item 3: Legal & Kebijakan */}
                    <div 
                      className="glass-panel" 
                      onClick={() => { 
                        setAdminSubTab('policies'); 
                        fetchPolicies(); 
                        const slug = getStoreSlug();
                        if (slug) window.history.pushState({}, '', `/${slug}/admin/policies`);
                      }}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '0.9rem', 
                        background: 'var(--card-bg-gradient)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '0.75rem', 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <ShieldCheck size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Legal &amp; Kebijakan</h3>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                          Syarat &amp; Privasi Platform
                        </span>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                    {/* Item 4: Pusat Bantuan & Support */}
                    <div 
                      className="glass-panel" 
                      onClick={() => {
                        setAdminSubTab('help');
                        const slug = getStoreSlug();
                        if (slug) {
                          window.history.pushState({}, '', `/${slug}/admin/help`);
                        }
                      }}
                      style={{ 
                        padding: '1rem 1.15rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '0.9rem', 
                        background: 'var(--card-bg-gradient)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '0.75rem', 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--border-light)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <HelpCircle size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Pusat Bantuan &amp; Support</h3>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>
                          Kontak Admin WA, Email &amp; FAQ
                        </span>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>

                  </div>
                </div>
              )}

              {adminSubTab === 'items' && (
                /* TAB 1: ADMIN INVENTORY MANAGEMENT (SEARCH, MULTI-TYPE PILLS, RICH CARDS, SERVER-SIDE PAGINATION) */
                <div style={{ paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  
                  {/* 1. TOP SEARCH BAR & FILTERS (Hanya tampil jika sudah ada data item inventaris) */}
                  {faunas.length > 0 && (
                    <>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                          type="text"
                          className="form-input"
                          placeholder="Cari nama item, kategori, atau deskripsi..."
                          value={adminSearch}
                          onChange={(e) => {
                            setAdminSearch(e.target.value);
                            setItemsPage(1);
                          }}
                          style={{
                            paddingLeft: '2.35rem',
                            paddingRight: adminSearch ? '2.2rem' : '0.85rem',
                            height: '40px',
                            fontSize: '0.82rem',
                            borderRadius: '0.65rem',
                            backgroundColor: 'var(--card-bg-gradient)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        {adminSearch && (
                          <button
                            type="button"
                            onClick={() => { setAdminSearch(''); setItemsPage(1); }}
                            style={{
                              position: 'absolute',
                              right: '0.65rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'var(--border-light)',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.7rem'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* 2. LEVEL-1 QUICK-PILLS: TIPE PRODUK (Hanya muncul jika toko memiliki > 1 jenis kategori item) */}
                      {isHybridStore && (
                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem', marginBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
                          <button
                            type="button"
                            onClick={() => { setAdminProductTypeFilter('all'); setAdminClassFilter('all'); setItemsPage(1); }}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              border: adminProductTypeFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              backgroundColor: adminProductTypeFilter === 'all' ? 'var(--primary)' : 'var(--card-bg-gradient)',
                              color: adminProductTypeFilter === 'all' ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            Semua ({faunas.length})
                          </button>
                          {availableProductTypes.includes('physical') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('physical'); setAdminClassFilter('all'); setItemsPage(1); }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'physical' ? '1px solid #3b82f6' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: adminProductTypeFilter === 'physical' ? '#3b82f6' : 'var(--card-bg-gradient)',
                                color: adminProductTypeFilter === 'physical' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              Barang ({faunas.filter(f => (f.product_type || 'physical') === 'physical').length})
                            </button>
                          )}
                          {availableProductTypes.includes('food') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('food'); setAdminClassFilter('all'); setItemsPage(1); }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'food' ? '1px solid #ef4444' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: adminProductTypeFilter === 'food' ? '#ef4444' : 'var(--card-bg-gradient)',
                                color: adminProductTypeFilter === 'food' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              Kuliner ({faunas.filter(f => f.product_type === 'food').length})
                            </button>
                          )}
                          {availableProductTypes.includes('service') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('service'); setAdminClassFilter('all'); setItemsPage(1); }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'service' ? '1px solid #f59e0b' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: adminProductTypeFilter === 'service' ? '#f59e0b' : 'var(--card-bg-gradient)',
                                color: adminProductTypeFilter === 'service' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              Jasa ({faunas.filter(f => f.product_type === 'service').length})
                            </button>
                          )}
                          {availableProductTypes.includes('digital') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('digital'); setAdminClassFilter('all'); setItemsPage(1); }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'digital' ? '1px solid #8b5cf6' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: adminProductTypeFilter === 'digital' ? '#8b5cf6' : 'var(--card-bg-gradient)',
                                color: adminProductTypeFilter === 'digital' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              Digital ({faunas.filter(f => f.product_type === 'digital').length})
                            </button>
                          )}
                          {availableProductTypes.includes('fauna') && (
                            <button
                              type="button"
                              onClick={() => { setAdminProductTypeFilter('fauna'); setAdminClassFilter('all'); setItemsPage(1); }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                border: adminProductTypeFilter === 'fauna' ? '1px solid #10b981' : '1px solid var(--border-light)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                backgroundColor: adminProductTypeFilter === 'fauna' ? '#10b981' : 'var(--card-bg-gradient)',
                                color: adminProductTypeFilter === 'fauna' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              Fauna ({faunas.filter(f => f.product_type === 'fauna').length})
                            </button>
                          )}
                        </div>
                      )}

                      {/* 3. LEVEL-2 SECONDARY FILTER & SORT ROW */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.45rem' }}>
                        <select
                          className="form-select"
                          value={adminClassFilter}
                          onChange={(e) => { setAdminClassFilter(e.target.value); setItemsPage(1); }}
                          style={{ height: '36px', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--card-bg-gradient)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        >
                          <option value="all">Semua Kategori ({availableAdminCategories.length})</option>
                          {availableAdminCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>

                        <select
                          className="form-select"
                          value={adminSortBy}
                          onChange={(e) => { setAdminSortBy(e.target.value as any); setItemsPage(1); }}
                          style={{ height: '36px', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'var(--card-bg-gradient)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        >
                          <option value="newest">Terbaru</option>
                          <option value="oldest">Terlama</option>
                          <option value="name_asc">Nama (A-Z)</option>
                          <option value="price_asc">Harga Terendah</option>
                          <option value="price_desc">Harga Tertinggi</option>
                        </select>
                      </div>

                      {/* 4. SUMMARY BAR */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.1rem 0.2rem' }}>
                        <span>
                          Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{paginatedAdminItems.length}</strong> dari <strong style={{ color: 'var(--text-primary)' }}>{filteredAdminItems.length}</strong> item
                        </span>
                        {(adminSearch || adminProductTypeFilter !== 'all' || adminClassFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminSearch('');
                              setAdminProductTypeFilter('all');
                              setAdminClassFilter('all');
                              setAdminSortBy('newest');
                              setItemsPage(1);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* 5. ITEM CARDS LIST */}
                  {faunas.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '0.85rem', background: 'var(--card-bg-gradient)', border: '1px solid var(--border-light)' }}>
                      <Database size={36} style={{ marginBottom: '0.65rem', color: 'var(--primary)' }} />
                      <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Belum Ada Item Terdaftar</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>Mulai tambahkan produk, menu, jasa, atau file digital pertama Anda.</p>
                      <button 
                        type="button"
                        className="btn-primary" 
                        onClick={openCreateSheet}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', borderRadius: '0.5rem', fontWeight: 700 }}
                      >
                        + Tambah Item Pertama
                      </button>
                    </div>
                  ) : filteredAdminItems.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '0.85rem', background: 'var(--card-bg-gradient)', border: '1px solid var(--border-light)' }}>
                      <Search size={32} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
                      <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Item Tidak Ditemukan</h4>
                      <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0' }}>Tidak ada item yang sesuai dengan kata kunci atau filter yang Anda pilih.</p>
                      <button 
                        type="button"
                        className="btn-secondary" 
                        onClick={() => {
                          setAdminSearch('');
                          setAdminProductTypeFilter('all');
                          setAdminClassFilter('all');
                          setAdminSortBy('newest');
                          setItemsPage(1);
                        }}
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', borderRadius: '0.45rem' }}
                      >
                        Reset Filter
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {paginatedAdminItems.map((item) => {
                        return (
                          <div 
                            key={item.id} 
                            className="glass-panel"
                            style={{
                              padding: '0.75rem 0.85rem',
                              borderRadius: '0.75rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--card-bg-gradient)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {/* Left: Thumbnail & Details */}
                            <div 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, cursor: 'pointer' }}
                              onClick={() => openDetailsSheet(item.id)}
                            >
                              <img 
                                src={item.image_url} 
                                alt={item.name} 
                                style={{ 
                                  width: '46px', 
                                  height: '46px', 
                                  objectFit: 'cover', 
                                  borderRadius: '0.55rem', 
                                  border: '1px solid var(--border-light)',
                                  flexShrink: 0,
                                  backgroundColor: 'rgba(0,0,0,0.05)'
                                }} 
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=150&q=80';
                                }}
                              />
                              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <h4 style={{ 
                                  fontSize: '0.88rem', 
                                  fontWeight: 800, 
                                  color: 'var(--text-primary)', 
                                  margin: 0, 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.25
                                }}>
                                  {item.name}
                                </h4>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.84rem', color: '#ef4444', fontWeight: 800 }}>
                                    {formatRupiah(item.price)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Action */}
                            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              <button 
                                type="button"
                                className="btn-secondary"
                                onClick={() => openDetailsSheet(item.id)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '0.45rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  cursor: 'pointer'
                                }}
                                title="Detail Item"
                              >
                                <Eye size={13} />
                                <span>Detail</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 6. PAGINATION CONTROLS */}
                  {totalAdminPages > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', marginTop: '1rem', paddingBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button 
                          type="button"
                          disabled={itemsPage === 1}
                          onClick={() => setItemsPage(prev => Math.max(prev - 1, 1))}
                          style={{
                            background: 'var(--card-bg-gradient)',
                            border: '1px solid var(--border-light)',
                            color: itemsPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            cursor: itemsPage === 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          &larr; Prev
                        </button>

                        {/* Page Numbers */}
                        {Array.from({ length: totalAdminPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          if (
                            totalAdminPages > 5 &&
                            pageNum !== 1 &&
                            pageNum !== totalAdminPages &&
                            Math.abs(pageNum - itemsPage) > 1
                          ) {
                            if (pageNum === 2 && itemsPage > 3) {
                              return <span key={pageNum} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.2rem' }}>...</span>;
                            }
                            if (pageNum === totalAdminPages - 1 && itemsPage < totalAdminPages - 2) {
                              return <span key={pageNum} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.2rem' }}>...</span>;
                            }
                            return null;
                          }

                          return (
                            <button
                              type="button"
                              key={pageNum}
                              onClick={() => setItemsPage(pageNum)}
                              style={{
                                border: pageNum === itemsPage ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                backgroundColor: pageNum === itemsPage ? 'var(--primary)' : 'var(--card-bg-gradient)',
                                color: pageNum === itemsPage ? '#ffffff' : 'var(--text-primary)',
                                borderRadius: '0.4rem',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: pageNum === itemsPage ? 800 : 600
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button 
                          type="button"
                          disabled={itemsPage === totalAdminPages}
                          onClick={() => setItemsPage(prev => Math.min(prev + 1, totalAdminPages))}
                          style={{
                            background: 'var(--card-bg-gradient)',
                            border: '1px solid var(--border-light)',
                            color: itemsPage === totalAdminPages ? 'var(--text-muted)' : 'var(--text-primary)',
                            borderRadius: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            cursor: itemsPage === totalAdminPages ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Next &rarr;
                        </button>
                      </div>

                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Halaman {itemsPage} dari {totalAdminPages}
                      </span>
                    </div>
                  )}
                </div>
              )}

               {adminSubTab === 'settings' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
                  {settingsSuccess && (
                    <div className="alert-box alert-success" style={{ marginBottom: '1rem' }}>
                      {settingsSuccess}
                    </div>
                  )}

                  {mobileSettingsTab === 'menu' ? (
                    /* Mobile Settings Category List (5 Pillars Structure) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div 
                        className="glass-panel"
                        onClick={() => {
                          const slug = getStoreSlug();
                          setMobileSettingsTab('general');
                          if (slug) window.history.pushState({}, '', `/${slug}/admin/settings/general`);
                        }}
                        style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-light)' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.65rem', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <Store size={20} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>Profil &amp; Identitas Utama</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>Nama katalog, slogan, logo resmi</p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      <div 
                        className="glass-panel"
                        onClick={() => {
                          const slug = getStoreSlug();
                          setMobileSettingsTab('contact');
                          if (slug) window.history.pushState({}, '', `/${slug}/admin/settings/contact`);
                        }}
                        style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-light)' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.65rem', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <MessageCircle size={20} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>Kontak &amp; Saluran Resmi</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>WhatsApp CS, website resmi, sosmed, alamat, jam buka</p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      <div 
                        className="glass-panel"
                        onClick={() => {
                          const slug = getStoreSlug();
                          setMobileSettingsTab('about');
                          if (slug) window.history.pushState({}, '', `/${slug}/admin/settings/about`);
                        }}
                        style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-light)' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.65rem', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>Halaman Tentang Kami</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>Judul, deskripsi profil, disclaimer, kartu komitmen</p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      <div 
                        className="glass-panel"
                        onClick={() => {
                          const slug = getStoreSlug();
                          setMobileSettingsTab('theme');
                          if (slug) window.history.pushState({}, '', `/${slug}/admin/settings/theme`);
                        }}
                        style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-light)' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.65rem', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <Palette size={20} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>Tema &amp; Tampilan Visual</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>Pilih palet warna &amp; gaya estetik (Canva-Style)</p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      <div 
                        className="glass-panel"
                        onClick={() => {
                          const slug = getStoreSlug();
                          setMobileSettingsTab('master');
                          if (slug) window.history.pushState({}, '', `/${slug}/admin/settings/master`);
                        }}
                        style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--border-light)' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '0.65rem', background: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                          <Database size={20} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>Master Data Katalog</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>Pilihan kelas, habitat, status, coverage kirim</p>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  ) : (
                    /* Active Settings Sub-Tab View */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {mobileSettingsTab !== 'master' ? (
                        <form onSubmit={handleSettingsSave} className="glass-panel animate-fade-in" style={{ padding: '1rem', border: '1px solid var(--border-light)' }}>
                          {/* SUB-TAB 4: TEMA */}
                          {mobileSettingsTab === 'theme' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Pilih Preset Tema Estetik Katalog</h3>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                                  Ubah warna background, kartu produk, tombol WhatsApp &amp; aksen katalog secara instan.
                                </p>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {[
                                  { id: 'emerald', name: 'Midnight Emerald', desc: 'Nuansa gelap modern dengan kaca transparan & aksen hijau emerald.', bg: '#080c14', primary: '#10b981', accent: '#f59e0b', cardBg: '#0f172a', IconComponent: Trees },
                                  { id: 'nordic', name: 'Midnight Slate', desc: 'Nuansa gelap slate yang elegan & tenang dengan aksen dusty blue & pendar malam modern.', bg: '#0f141a', primary: '#5b7c99', accent: '#8eb0cc', cardBg: '#17202a', IconComponent: Moon },
                                  { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Gaya futuristik dengan warna ungu royal & efek neon cyan.', bg: '#0b0716', primary: '#a855f7', accent: '#06b6d4', cardBg: '#150d2a', IconComponent: Zap },
                                  { id: 'sunset', name: 'Warm Sunset', desc: 'Tampilan mewah onyx gelap dengan aksen emas amber & coral.', bg: '#140d0b', primary: '#f59e0b', accent: '#f97316', cardBg: '#221411', IconComponent: Sunset },
                                  { id: 'ocean', name: 'Oceanic Azure', desc: 'Desain profesional biru gelap korporat & cyan segar.', bg: '#080121', primary: '#3b82f6', accent: '#38bdf8', cardBg: '#0f1c38', IconComponent: Waves },
                                  { id: 'pastel', name: 'Pastel Bloom', desc: 'Tema terang estetik yang lembut dengan sentuhan pink rose.', bg: '#f8fafc', primary: '#e11d48', accent: '#f59e0b', cardBg: '#ffffff', light: true, IconComponent: Flower2 }
                                ].map(t => {
                                  const isActive = (settingsForm.store_theme || 'emerald') === t.id;
                                  const IconComp = t.IconComponent;
                                  return (
                                    <div 
                                      key={t.id}
                                      onClick={() => handleThemeSelect(t.id, t.name)}
                                      style={{
                                        padding: '0.85rem 0.95rem',
                                        borderRadius: '0.85rem',
                                        border: isActive ? `2px solid ${t.primary}` : '1px solid var(--border-light)',
                                        background: t.cardBg,
                                        cursor: 'pointer',
                                        boxShadow: isActive ? `0 0 16px ${t.primary}35` : '0 4px 12px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.55rem',
                                        transition: 'all 0.2s ease',
                                        WebkitTapHighlightColor: 'transparent',
                                        touchAction: 'manipulation'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                                          <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            backgroundColor: `${t.primary}20`,
                                            border: `1px solid ${t.primary}40`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: t.primary,
                                            boxShadow: `0 4px 10px ${t.primary}25`,
                                            flexShrink: 0
                                          }}>
                                            <IconComp size={15} />
                                          </div>
                                          <div style={{ display: 'flex', gap: '3px', background: t.bg, padding: '4px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.primary, boxShadow: `0 0 5px ${t.primary}` }} />
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.accent }} />
                                          </div>
                                          <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: t.light ? '#0f172a' : '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {t.name}
                                          </h4>
                                        </div>

                                        {isActive && (
                                          <span style={{
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            color: t.primary,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '20px',
                                            backgroundColor: `${t.primary}20`,
                                            border: `1px solid ${t.primary}50`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.2rem',
                                            boxShadow: `0 2px 6px ${t.primary}20`,
                                            flexShrink: 0
                                          }}>
                                            <CheckCircle2 size={10} /> Aktif
                                          </span>
                                        )}
                                      </div>

                                      <p style={{
                                        fontSize: '0.7rem',
                                        color: t.light ? '#475569' : '#9ca3af',
                                        margin: 0,
                                        lineHeight: 1.4
                                      }}>
                                        {t.desc}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* SUB-TAB 1: PROFIL & IDENTITAS UTAMA */}
                          {mobileSettingsTab === 'general' && (
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
                                <label className="form-label">Logo Resmi Katalog</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                  {settingsForm.store_logo_url && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem', backgroundColor: 'var(--bg-card-hover)', border: '1px dashed var(--border-hover)', borderRadius: '0.5rem' }}>
                                      <img 
                                        src={settingsForm.store_logo_url} 
                                        alt="Logo Preview" 
                                        style={{ height: '38px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} 
                                      />
                                      <button 
                                        type="button" 
                                        className="btn-danger btn-small"
                                        onClick={() => setSettingsForm({ ...settingsForm, store_logo_url: '' })}
                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', borderRadius: '0.35rem', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                                      >
                                        Hapus Logo
                                      </button>
                                    </div>
                                  )}
                                  
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={handleLogoUpload}
                                      disabled={logoUploading}
                                      style={{ display: 'none' }}
                                      id="store-logo-file-input"
                                    />
                                    <label 
                                      htmlFor="store-logo-file-input" 
                                      className="btn-secondary"
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '0.5rem', 
                                        cursor: 'pointer', 
                                        padding: '0.65rem 1rem', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 700,
                                        width: '100%',
                                        borderRadius: '0.5rem',
                                        background: 'var(--btn-secondary-bg)',
                                        color: 'var(--btn-secondary-text)',
                                        border: '1px solid var(--btn-secondary-border)'
                                      }}
                                    >
                                      <Upload size={14} style={{ color: 'var(--primary)' }} />
                                      <span>{logoUploading ? 'Mengunggah...' : 'Pilih File Logo dari Perangkat'}</span>
                                    </label>
                                  </div>

                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Atau tempel URL gambar logo langsung..."
                                    value={settingsForm.store_logo_url || ''}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, store_logo_url: e.target.value })}
                                    style={{ fontSize: '0.82rem' }}
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
                          {mobileSettingsTab === 'contact' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div className="form-group">
                                <WhatsAppContactsManager 
                                  value={settingsForm.whatsapp_number} 
                                  onChange={(newVal) => setSettingsForm({ ...settingsForm, whatsapp_number: newVal })} 
                                />
                              </div>

                              <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.85rem' }}>
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
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                                  * Kosongkan jika tidak ada. Jika diisi, komponen Website Resmi akan tampil di Hubungi Kami.
                                </span>
                              </div>

                              <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.85rem' }}>
                                <label className="form-label">Lokasi / Alamat Resmi</label>
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  placeholder="Contoh: Bandung, Jawa Barat, Indonesia"
                                  value={settingsForm.about_location || ''}
                                  onChange={(e) => setSettingsForm({ ...settingsForm, about_location: e.target.value })}
                                />
                              </div>

                              <div className="form-group" style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.85rem' }}>
                                <OperationalHoursBuilder 
                                  value={settingsForm.about_hours || ''}
                                  onChange={(val) => setSettingsForm({ ...settingsForm, about_hours: val })}
                                  showHours={settingsForm.show_hours ?? false}
                                  onToggleShowHours={(show) => setSettingsForm({ ...settingsForm, show_hours: show })}
                                />
                              </div>

                              {/* Dynamic Social Links Builder */}
                              <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.85rem' }}>
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
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                        <div>
                                          <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800 }}>Tautan Media Sosial Resmi</label>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.1rem' }}>
                                            Hubungkan akun Instagram, TikTok, Facebook, YouTube, dll.
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
                                              gap: '0.25rem',
                                              padding: '0.35rem 0.65rem',
                                              fontSize: '0.72rem',
                                              fontWeight: 800,
                                              borderRadius: '0.35rem',
                                              cursor: 'pointer',
                                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                                            }}
                                          >
                                            <Plus size={12} /> Tambah
                                          </button>
                                        )}
                                      </div>

                                      {currentLinks.length === 0 ? (
                                        <div style={{
                                          padding: '1rem',
                                          borderRadius: '0.65rem',
                                          backgroundColor: 'var(--primary-glow)',
                                          border: '2px dashed var(--primary)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          textAlign: 'center',
                                          gap: '0.75rem',
                                          marginBottom: '1rem',
                                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.1)'
                                        }}>
                                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                                            <Share2 size={20} />
                                          </div>
                                          <div>
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                                              Belum Ada Tautan Media Sosial Resmi
                                            </h4>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                              Hubungkan akun Instagram, TikTok, Facebook, YouTube, atau WhatsApp toko Anda agar pengunjung mudah terhubung.
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => {
                                              const newLinks = [...currentLinks, { platform: 'Instagram', url: '' }];
                                              setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                            }}
                                            style={{
                                              width: '100%',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '0.4rem',
                                              padding: '0.6rem 1rem',
                                              fontSize: '0.8rem',
                                              fontWeight: 800,
                                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                            }}
                                          >
                                            <Plus size={15} /> Tambah Sosmed Sekarang
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                          {currentLinks.map((link: any, index: number) => (
                                            <div key={index} style={{ padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem', position: 'relative', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newLinks = currentLinks.filter((_: any, idx: number) => idx !== index);
                                                  setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                                }}
                                                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                title="Hapus Sosmed"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                              
                                              <div className="form-group" style={{ marginBottom: '0.5rem', width: '90%' }}>
                                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Platform *</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                                    {renderSocialIcon(link.platform || 'Instagram', 16)}
                                                  </div>
                                                  <select
                                                    className="form-input"
                                                    value={link.platform || 'Instagram'}
                                                    onChange={(e) => {
                                                      const newLinks = [...currentLinks];
                                                      newLinks[index].platform = e.target.value;
                                                      setSettingsForm({ ...settingsForm, social_links: JSON.stringify(newLinks) });
                                                    }}
                                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: 'auto', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', flex: 1 }}
                                                  >
                                                    {SOCIAL_MEDIA_OPTIONS.map((opt) => (
                                                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.7rem' }}>URL / Tautan Profil *</label>
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
                                                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
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
                          {mobileSettingsTab === 'about' && (
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
                                  placeholder="Contoh: Platform Katalog Digital &amp; Biolink Bisnis Modern"
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



                              {/* About Cards Builder */}
                              <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                  <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Kartu Komitmen / Nilai Unggulan</label>
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
                                      padding: '0.3rem 0.65rem',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      backgroundColor: 'var(--primary-glow)',
                                      color: 'var(--primary)',
                                      border: '1px solid var(--border-light)',
                                      borderRadius: '0.25rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Plus size={10} /> Tambah Kartu
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
                                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0', fontStyle: 'italic' }}>
                                        Belum ada kartu komitmen.
                                      </p>
                                    );
                                  }

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {currentCards.map((card: any, index: number) => (
                                        <div key={index} style={{ padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem', position: 'relative', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newCards = currentCards.filter((_: any, idx: number) => idx !== index);
                                              setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                            }}
                                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            title="Hapus Kartu"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                          
                                          <div className="form-group" style={{ marginBottom: '0.5rem', width: '90%' }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Ikon Kartu *</label>
                                            <select
                                              className="form-input"
                                              value={card.icon || 'shield'}
                                              onChange={(e) => {
                                                const newCards = [...currentCards];
                                                newCards[index].icon = e.target.value;
                                                setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                              }}
                                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: 'auto', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                                            >
                                              {ABOUT_ICONS_OPTIONS.map((opt) => (
                                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="form-group" style={{ marginBottom: '0.5rem', width: '90%' }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Judul Komitmen *</label>
                                            <input
                                              type="text"
                                              className="form-input"
                                              placeholder="Judul..."
                                              required
                                              value={card.title}
                                              onChange={(e) => {
                                                const newCards = [...currentCards];
                                                newCards[index].title = e.target.value;
                                                setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                              }}
                                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                            />
                                          </div>
                                          <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Deskripsi Kartu *</label>
                                            <textarea
                                              rows={4}
                                              className="form-input"
                                              placeholder="Isi penjelasan komitmen..."
                                              required
                                              value={card.content}
                                              onChange={(e) => {
                                                const newCards = [...currentCards];
                                                newCards[index].content = e.target.value;
                                                setSettingsForm({ ...settingsForm, about_cards: JSON.stringify(newCards) });
                                              }}
                                              style={{ fontSize: '0.75rem', padding: '0.45rem 0.55rem', minHeight: '85px', resize: 'vertical' }}
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

                          {mobileSettingsTab !== 'theme' && (
                            <button 
                              type="submit" 
                              className="btn-primary btn-full" 
                              disabled={settingsLoading}
                              style={{ marginTop: '0.5rem', padding: '0.75rem', fontWeight: 800 }}
                            >
                              {settingsLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </button>
                          )}
                        </form>
                      ) : (
                        /* Master Data Subtab on Mobile (Touch-Optimized Hub) */
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {/* Header and 1-Click Preset Bar */}
                          <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.85rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                                TWO-TIER MASTER DATA
                              </span>
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                              Kelola Kategori &amp; Opsi Toko
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: '0.25rem 0 0.75rem 0', lineHeight: 1.4 }}>
                              Atur kategori dan opsi dropdown katalog Anda secara independen.
                            </p>

                            {/* 1-Click Industry Presets Horizontal Slider */}
                            <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                                <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  Preset Industri Instan (1-Click):
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem', WebkitOverflowScrolling: 'touch' }}>
                                {[
                                  { key: 'physical', label: 'Retail & Fisik', color: '#3b82f6', desc: 'Pakaian, Gadget, Aksesoris' },
                                  { key: 'digital', label: 'File & Digital', color: '#8b5cf6', desc: 'E-Book, Script, Video' },
                                  { key: 'fauna', label: 'Satwa & Flora', color: '#10b981', desc: 'Reptil, Ikan, Burung, Pakan' },
                                  { key: 'service', label: 'Jasa & Layanan', color: '#f59e0b', desc: 'Konsultasi, Servis, Desain' },
                                  { key: 'food', label: 'Menu Kuliner', color: '#ef4444', desc: 'Makanan, Minuman, Snack' },
                                  { key: 'general', label: 'Universal', color: '#06b6d4', desc: 'Template netral umum' },
                                ].map((preset) => (
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
                                      padding: '0.45rem 0.75rem',
                                      borderRadius: '0.55rem',
                                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                      border: '1px solid var(--border-light)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-start',
                                      gap: '0.15rem'
                                    }}
                                  >
                                    <span>{preset.label}</span>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{preset.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 1. Kategori Item (master_classes) */}
                          <div className="glass-panel" style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Package size={14} /> Master Kategori Item
                              </h4>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                                {getCategoryOptionsForType(masterCategoryContextTab).length} Opsi
                              </span>
                            </div>

                            {/* Context Switcher Tabs */}
                            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.6rem' }}>
                              {[
                                { id: 'physical', label: 'Barang Fisik' },
                                { id: 'food', label: 'Kuliner' },
                                { id: 'service', label: 'Jasa' },
                                { id: 'digital', label: 'Digital' },
                                { id: 'fauna', label: 'Fauna' }
                              ].map(tab => (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => setMasterCategoryContextTab(tab.id as ItemCategoryType)}
                                  style={{
                                    padding: '0.3rem 0.6rem',
                                    borderRadius: '0.45rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    border: masterCategoryContextTab === tab.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                    backgroundColor: masterCategoryContextTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                                    color: masterCategoryContextTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {getCategoryOptionsForType(masterCategoryContextTab).map((c) => {
                                const count = faunas.filter(f => (f.product_type || 'physical') === masterCategoryContextTab && f.class === c).length;
                                return (
                                  <span key={c} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '0.3rem 0.55rem', borderRadius: '0.45rem', fontSize: '0.74rem' }}>
                                    <span>{c}</span>
                                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                      {count}
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
                                      title={`Ubah nama ${c}`}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteMasterOption('class', c);
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                      title={`Hapus opsi ${c}`}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <input 
                                type="text" 
                                placeholder={`Ketik kategori ${masterCategoryContextTab} baru...`} 
                                className="form-input" 
                                style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', height: '34px', flex: 1 }}
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
                                style={{ padding: '0 0.75rem', fontSize: '0.75rem', height: '34px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => handleAddMasterOption('class', newClassInput, setNewClassInput)}
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            </div>
                          </div>

                          {/* 2. Sub-Klasifikasi / Karakteristik Item (master_habitats) */}
                          <div className="glass-panel" style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: 0, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Layers size={14} /> Sub-Klasifikasi / Karakter
                              </h4>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
                                {getUniqueHabitats().length} Opsi
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {getUniqueHabitats().map((h) => {
                                const count = faunas.filter(f => f.habitat === h).length;
                                return (
                                  <span key={h} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '0.3rem 0.55rem', borderRadius: '0.45rem', fontSize: '0.74rem' }}>
                                    <span>{h}</span>
                                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                      {count}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setRenameMasterModalData({
                                          field: 'habitat',
                                          fieldLabel: 'Sub-Klasifikasi / Karakter',
                                          oldValue: h,
                                          newValue: h
                                        });
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                                      title={`Ubah nama ${h}`}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteMasterOption('habitat', h);
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                      title={`Hapus opsi ${h}`}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <input 
                                type="text" 
                                placeholder="Ketik sub-klasifikasi baru..." 
                                className="form-input" 
                                style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', height: '34px', flex: 1 }}
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
                                style={{ padding: '0 0.75rem', fontSize: '0.75rem', height: '34px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => handleAddMasterOption('habitat', newHabitatInput, setNewHabitatInput)}
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            </div>
                          </div>

                          {/* 3. Status Ketersediaan Item (master_statuses) */}
                          <div className="glass-panel" style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: 0, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <ShieldCheck size={14} /> Status Ketersediaan
                              </h4>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                                {getUniqueConservationStatuses().length} Opsi
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {getUniqueConservationStatuses().map((s) => {
                                const count = faunas.filter(f => f.conservation_status === s).length;
                                return (
                                  <span key={s} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '0.3rem 0.55rem', borderRadius: '0.45rem', fontSize: '0.74rem' }}>
                                    <span>{s}</span>
                                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                      {count}
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
                                      title={`Ubah nama ${s}`}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteMasterOption('conservation_status', s);
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                      title={`Hapus opsi ${s}`}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <input 
                                type="text" 
                                placeholder="Ketik status baru..." 
                                className="form-input" 
                                style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', height: '34px', flex: 1 }}
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
                                style={{ padding: '0 0.75rem', fontSize: '0.75rem', height: '34px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => handleAddMasterOption('conservation_status', newStatusInput, setNewStatusInput)}
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            </div>
                          </div>

                          {/* 4. Jangkauan Pengiriman / Wilayah Layanan (master_shipping_coverages) */}
                          <div className="glass-panel" style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Truck size={14} /> Jangkauan Pengiriman &amp; Layanan
                              </h4>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                                {getUniqueShippingCoverages().length} Opsi
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {getUniqueShippingCoverages().map((sc) => {
                                const count = faunas.filter(f => f.detailed_info?.shipping_coverage === sc).length;
                                return (
                                  <span key={sc} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: '0.3rem 0.55rem', borderRadius: '0.45rem', fontSize: '0.74rem' }}>
                                    <span>{sc}</span>
                                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                      {count}
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
                                      title={`Ubah nama ${sc}`}
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteMasterOption('shipping_coverage', sc);
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}
                                      title={`Hapus opsi ${sc}`}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <input 
                                type="text" 
                                placeholder="Ketik jangkauan baru..." 
                                className="form-input" 
                                style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', height: '34px', flex: 1 }}
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
                                style={{ padding: '0 0.75rem', fontSize: '0.75rem', height: '34px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => handleAddMasterOption('shipping_coverage', newShippingInput, setNewShippingInput)}
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {adminSubTab === 'profile' && (
                /* TAB 3: ADMIN PROFILE FORM */
                <div style={{ paddingTop: '0.25rem' }}>
                  <form onSubmit={handleProfileUpdate} className="glass-panel" style={{ padding: '1.25rem' }}>
                  {profileSuccess && (
                    <div className="alert-box alert-success">
                      {profileSuccess}
                    </div>
                  )}
                  {profileError && (
                    <div className="alert-box alert-success" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
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
                    <label className="form-label">Email Login *</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      required
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password Baru (Kosongkan jika tidak diubah)</label>
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
                    className="btn-full btn-primary" 
                    disabled={profileLoading}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {profileLoading ? 'Memproses...' : 'Perbarui Profil'}
                  </button>
                </form>
              </div>
            )}

              {adminSubTab === 'articles' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Daftar Artikel</h3>
                    <button 
                      className="btn-primary" 
                      onClick={openAddArticleSheet}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={14} /> Tulis Baru
                    </button>
                  </div>

                  {articles.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>Belum ada artikel terbit.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {articles.map(article => (
                        <div key={article.id} className="glass-panel" style={{ padding: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <img 
                            src={article.image_url || 'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&w=150&q=80'} 
                            alt={article.title} 
                            style={{ width: '60px', height: '45px', objectFit: 'cover', borderRadius: '0.25rem' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {article.title}
                            </h4>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                              {article.author} &bull; {article.read_time}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.35rem', borderRadius: '4px' }}
                              onClick={() => openEditArticleSheet(article)}
                              title="Edit"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              className="btn-primary" 
                              style={{ padding: '0.35rem', borderRadius: '4px', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
                              onClick={() => handleDeleteArticle(article.id)}
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminSubTab === 'policies' && (
                <div style={{ paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Quick Switcher Tabs */}
                  <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--btn-secondary-bg)', padding: '0.3rem', borderRadius: '0.65rem', border: '1px solid var(--border-light)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <button
                      type="button"
                      onClick={() => setMobilePolicyTab('terms')}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        border: mobilePolicyTab === 'terms' ? '1px solid var(--primary)' : '1px solid transparent',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        backgroundColor: mobilePolicyTab === 'terms' ? 'var(--primary-glow)' : 'transparent',
                        color: mobilePolicyTab === 'terms' ? 'var(--primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Syarat &amp; Ketentuan
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobilePolicyTab('privacy')}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        border: mobilePolicyTab === 'privacy' ? '1px solid var(--primary)' : '1px solid transparent',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        backgroundColor: mobilePolicyTab === 'privacy' ? 'var(--primary-glow)' : 'transparent',
                        color: mobilePolicyTab === 'privacy' ? 'var(--primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Kebijakan Privasi
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobilePolicyTab('acceptable_use')}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        border: mobilePolicyTab === 'acceptable_use' ? '1px solid var(--primary)' : '1px solid transparent',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        backgroundColor: mobilePolicyTab === 'acceptable_use' ? 'var(--primary-glow)' : 'transparent',
                        color: mobilePolicyTab === 'acceptable_use' ? 'var(--primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Ketentuan Penggunaan
                    </button>
                  </div>

                  {/* Document Card Panel */}
                  <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)', background: 'var(--card-bg-gradient)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {policies[mobilePolicyTab]?.title || 'Dokumen Resmi Platform'}
                      </span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-glow)', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid var(--primary)' }}>
                        {policies[mobilePolicyTab]?.version || 'v1.0.0'}
                      </span>
                    </div>

                    {renderFormattedPolicyContent(policies[mobilePolicyTab]?.content || '')}
                  </div>
                </div>
              )}

              {adminSubTab === 'notifications' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
                  {/* Action Bar / Filter Tabs */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                      <button
                        type="button"
                        onClick={() => setNotifFilter('all')}
                        style={{
                          padding: '0.38rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          border: '1px solid',
                          borderColor: notifFilter === 'all' ? 'var(--primary)' : 'var(--border-light)',
                          backgroundColor: notifFilter === 'all' ? 'var(--primary-glow)' : 'var(--btn-secondary-bg)',
                          color: notifFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Semua ({notifications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifFilter('unread')}
                        style={{
                          padding: '0.38rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          border: '1px solid',
                          borderColor: notifFilter === 'unread' ? 'var(--primary)' : 'var(--border-light)',
                          backgroundColor: notifFilter === 'unread' ? 'var(--primary-glow)' : 'var(--btn-secondary-bg)',
                          color: notifFilter === 'unread' ? 'var(--primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Belum Dibaca ({unreadCount})
                      </button>
                    </div>

                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                          showToast('Semua notifikasi telah ditandai dibaca!');
                        }}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Tandai Dibaca
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  {filteredNotifications.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem 1.5rem', textAlign: 'center', borderRadius: '1rem', border: '1px solid var(--border-light)', background: 'var(--card-bg-gradient)' }}>
                      <Bell size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>Tidak Ada Notifikasi</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Semua pembaruan dan notifikasi aktivitas akan tampil di sini.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {filteredNotifications.map((item) => (
                        <div
                          key={item.id}
                          className="glass-panel"
                          onClick={() => {
                            // Mark as read
                            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
                            if (item.linkSubTab) {
                              setAdminSubTab(item.linkSubTab);
                              if (item.linkMobileSettingsTab) {
                                setMobileSettingsTab(item.linkMobileSettingsTab);
                              }
                              const slug = getStoreSlug();
                              if (slug) {
                                window.history.pushState({}, '', `/${slug}/admin/${item.linkSubTab}`);
                              }
                            }
                          }}
                          style={{
                            padding: '1rem 1.15rem',
                            borderRadius: '0.9rem',
                            border: item.read ? '1px solid var(--border-light)' : '1px solid var(--primary)',
                            background: 'var(--card-bg-gradient)',
                            boxShadow: item.read ? 'none' : '0 4px 20px var(--primary-glow)',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '0.85rem',
                            alignItems: 'center',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation'
                          }}
                        >
                          {/* Notification Type Icon */}
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '0.65rem',
                            backgroundColor: 'var(--primary-glow)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            flexShrink: 0
                          }}>
                            {item.type === 'order' && <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />}
                            {item.type === 'comment' && <MessageCircle size={18} style={{ color: 'var(--accent-blue)' }} />}
                            {(item.type === 'system' || item.type === 'info' || item.type === 'success' || item.type === 'stock') && <Sparkles size={18} style={{ color: 'var(--secondary)' }} />}
                          </div>

                          {/* Notification Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{item.title}</h4>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.timestamp || item.time}</span>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.35 }}>{item.message}</p>
                          </div>

                          {/* Unread Glow Dot & Navigation Arrow */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            {!item.read && (
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary)',
                                boxShadow: '0 0 8px var(--primary)'
                              }} />
                            )}
                            {item.linkSubTab && (
                              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminSubTab === 'help' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
                  
                  {/* VIEW A: TICKET DETAIL & THREAD */}
                  {selectedTicket ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '90px' }}>
                      {/* Ticket Details Header & Status Bar */}
                      <div className="glass-panel" style={{ padding: '1rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)', background: 'var(--card-bg-gradient)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{selectedTicket.id}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>&bull; {selectedTicket.created_at}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              backgroundColor: selectedTicket.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : selectedTicket.status === 'in_progress' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: selectedTicket.status === 'resolved' ? '#10b981' : selectedTicket.status === 'in_progress' ? '#f59e0b' : '#3b82f6',
                              border: `1px solid ${selectedTicket.status === 'resolved' ? 'rgba(16, 185, 129, 0.3)' : selectedTicket.status === 'in_progress' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                            }}>
                              {selectedTicket.status === 'resolved' ? '✓ Selesai' : selectedTicket.status === 'in_progress' ? '● Proses' : '● Open'}
                            </span>

                            {selectedTicket.status !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'resolved', updated_at: 'Baru saja' } : t));
                                  setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
                                  showToast('Tiket telah ditandai Selesai.');
                                }}
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '0.4rem',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#10b981',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                ✓ Tandai Selesai
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.45rem 0', lineHeight: 1.35 }}>
                          {selectedTicket.subject}
                        </h3>

                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                            Kategori: {selectedTicket.category === 'payment' ? 'Pembayaran & Pro' : selectedTicket.category === 'technical' ? 'Pengaturan Toko' : selectedTicket.category === 'account' ? 'Akun' : 'Lainnya'}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: selectedTicket.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)', color: selectedTicket.priority === 'urgent' ? '#ef4444' : 'var(--text-secondary)' }}>
                            Urgensi: {selectedTicket.priority.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Discussion Thread Messages */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                                maxWidth: '88%',
                                padding: '0.85rem 1rem',
                                borderRadius: isUser ? '1rem 1rem 0.2rem 1rem' : '1rem 1rem 1rem 0.2rem',
                                backgroundColor: isUser ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                border: isUser ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem' }}>
                                  <strong style={{ fontSize: '0.78rem', color: isUser ? '#10b981' : '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800 }}>
                                    {!isUser && <ShieldCheck size={14} color="#3b82f6" />}
                                    {msg.sender_name}
                                  </strong>
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                  {msg.message}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Sticky Mobile App Reply Bar */}
                      {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' ? (
                        <div style={{
                          position: 'fixed',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '0.65rem 1rem',
                          backgroundColor: 'var(--header-bg)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          borderTop: '1px solid var(--border-light)',
                          zIndex: 200,
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: '0.5rem',
                          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
                        }}>
                          <textarea
                            id="mobile-reply-textarea"
                            rows={1}
                            className="form-input"
                            placeholder="Ketik balasan untuk Tim Support Catavor..."
                            value={ticketReplyText}
                            onChange={(e) => {
                              setTicketReplyText(e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.min(e.target.scrollHeight, 125)}px`;
                            }}
                            style={{ 
                              flex: 1, 
                              borderRadius: '1.1rem', 
                              padding: '0.65rem 0.9rem', 
                              fontSize: '0.84rem', 
                              lineHeight: '1.4', 
                              minHeight: '40px', 
                              maxHeight: '125px', 
                              height: 'auto',
                              resize: 'none', 
                              overflowY: 'auto',
                              border: '1px solid var(--border-light)', 
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              color: 'var(--text-primary)',
                              boxSizing: 'border-box'
                            }}
                          />

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
                              
                              const el = document.getElementById('mobile-reply-textarea') as HTMLTextAreaElement;
                              if (el) {
                                el.style.height = '40px';
                              }

                              showToast('Balasan Anda telah terkirim!');

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
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginBottom: '1px'
                            }}
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '0.85rem', textAlign: 'center', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
                          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                            ✓ Tiket ini telah ditandai Selesai. Buat tiket baru jika ada pertanyaan lain.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VIEW B: TICKET LIST & HERO STATS */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Hero Header Card */}
                      <div className="glass-panel" style={{ 
                        padding: '1.15rem', 
                        borderRadius: '1rem', 
                        border: '1px solid var(--primary-glow)', 
                        background: 'var(--card-bg-gradient)', 
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ 
                              width: '38px', 
                              height: '38px', 
                              borderRadius: '0.65rem', 
                              backgroundColor: 'var(--primary-glow)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'var(--primary)', 
                              border: '1px solid var(--border-light)' 
                            }}>
                              <HelpCircle size={22} />
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pusat Tiket Support</h3>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Layanan Bantuan Interaktif Catavor</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setShowCreateTicketModal(true)}
                            style={{
                              padding: '0.45rem 0.85rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 4px 12px var(--primary-glow)'
                            }}
                          >
                            <Plus size={15} /> Buat Tiket
                          </button>
                        </div>

                        {/* Search & Filter Bar */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Cari ID atau judul tiket..."
                              value={ticketSearch}
                              onChange={(e) => setTicketSearch(e.target.value)}
                              style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.78rem', borderRadius: '0.55rem' }}
                            />
                            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          </div>

                          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)' }}>
                            <button
                              type="button"
                              onClick={() => setTicketFilter('all')}
                              style={{
                                padding: '0.3rem 0.65rem',
                                borderRadius: '0.4rem',
                                border: 'none',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: ticketFilter === 'all' ? 'var(--primary)' : 'transparent',
                                color: ticketFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => setTicketFilter('active')}
                              style={{
                                padding: '0.3rem 0.65rem',
                                borderRadius: '0.4rem',
                                border: 'none',
                                fontSize: '0.72rem',
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
                                padding: '0.3rem 0.65rem',
                                borderRadius: '0.4rem',
                                border: 'none',
                                fontSize: '0.72rem',
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
                      </div>

                      {/* Ticket Cards List */}
                      {filteredTickets.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderRadius: '1rem', border: '1px solid var(--border-light)' }}>
                          <MessageSquare size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.65rem' }} />
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Tidak Ada Tiket</h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>Belum ada tiket support yang sesuai dengan filter Anda.</p>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setShowCreateTicketModal(true)}
                            style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: '0.55rem' }}
                          >
                            + Buat Tiket Baru
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {filteredTickets.map((ticket) => {
                            const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                            const isInProgress = ticket.status === 'in_progress';
                            const lastMsg = ticket.messages[ticket.messages.length - 1];

                            return (
                              <div
                                key={ticket.id}
                                className="glass-panel"
                                onClick={() => {
                                  setSelectedTicket(ticket);
                                  const slug = getStoreSlug();
                                  if (slug) {
                                    window.history.pushState({}, '', `/${slug}/admin/help?ticket=${ticket.id}`);
                                  }
                                }}
                                style={{
                                  padding: '1rem',
                                  borderRadius: '0.85rem',
                                  border: '1px solid var(--border-light)',
                                  background: 'var(--card-bg-gradient)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.55rem',
                                  transition: 'all 0.2s ease',
                                  WebkitTapHighlightColor: 'transparent'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{ticket.id}</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                      {ticket.category === 'payment' ? 'Pembayaran' : ticket.category === 'technical' ? 'Pengaturan' : 'Umum'}
                                    </span>
                                  </div>

                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '999px',
                                    whiteSpace: 'nowrap',
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
                                  <span>Update: {ticket.updated_at}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODAL: CREATE TICKET */}
                  {showCreateTicketModal && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      backdropFilter: 'blur(6px)',
                      zIndex: 9999,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}>
                      <div className="glass-panel animate-slide-up" style={{
                        width: '100%',
                        maxWidth: '500px',
                        backgroundColor: 'var(--card-bg-gradient)',
                        borderRadius: '1.25rem 1.25rem 0 0',
                        padding: '1.25rem',
                        border: '1px solid var(--border-light)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Plus size={18} color="var(--primary)" /> Buat Tiket Support Baru
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowCreateTicketModal(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={20} />
                          </button>
                        </div>

                        <form onSubmit={(e) => {
                          e.preventDefault();
                          if (!newTicketForm.subject.trim() || !newTicketForm.message.trim()) {
                            showToast('Mohon isi Judul dan Detail Kendala.');
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
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Judul Kendala / Subjek *</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Contoh: Pembayaran Upgrade Paket Pro Belum Terverifikasi"
                              value={newTicketForm.subject}
                              onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                              required
                              style={{ fontSize: '0.8rem' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Kategori *</label>
                              <select
                                className="form-input"
                                value={newTicketForm.category}
                                onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value as any })}
                                style={{ fontSize: '0.8rem' }}
                              >
                                <option value="payment">Pembayaran & Paket Pro</option>
                                <option value="technical">Pengaturan Toko / Domain</option>
                                <option value="account">Kendala Akun</option>
                                <option value="feature">Pertanyaan Fitur</option>
                                <option value="other">Lainnya</option>
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Tingkat Urgensi *</label>
                              <select
                                className="form-input"
                                value={newTicketForm.priority}
                                onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value as any })}
                                style={{ fontSize: '0.8rem' }}
                              >
                                <option value="normal">Normal</option>
                                <option value="high">Tinggi</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Detail Pesan & Pertanyaan *</label>
                            <textarea
                              rows={4}
                              className="form-input"
                              placeholder="Jelaskan detail kendala Anda selengkap mungkin..."
                              value={newTicketForm.message}
                              onChange={(e) => setNewTicketForm({ ...newTicketForm, message: e.target.value })}
                              required
                              style={{ fontSize: '0.8rem', resize: 'none' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setShowCreateTicketModal(false)}
                              style={{ flex: 1, padding: '0.65rem', borderRadius: '0.6rem', fontSize: '0.8rem' }}
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="btn-primary"
                              style={{ flex: 1, padding: '0.65rem', borderRadius: '0.6rem', fontSize: '0.8rem', fontWeight: 800 }}
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
            </div>
          )
        )}
      </main>
    </div>

      {/* PREMIUM CONFIRMATION DIALOG FOR FAUNA DELETION */}
      {activeTab === 'admin' && faunaToDelete && (
        <div className="bottom-sheet-confirm-overlay" onClick={() => setFaunaToDelete(null)}>
          <div className="bottom-sheet-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" style={{ marginTop: 0, marginBottom: '1.25rem' }}></div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <AlertTriangle size={24} style={{ color: '#f87171' }} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>
              Hapus Item Katalog?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: '1.45', textAlign: 'center' }}>
              Apakah Anda yakin ingin menghapus item <strong>"{faunaToDelete.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setFaunaToDelete(null)}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary"
                style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff', fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={async () => {
                  const deleted = await handleFaunaDelete(faunaToDelete.id)
                  if (deleted) {
                    setIsDetailActive(false);
                    setSelectedFauna(null);
                  }
                  setFaunaToDelete(null)
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG FOR MASTER OPTION DELETION */}
      {activeTab === 'admin' && deleteMasterModalData && (
        <div className="bottom-sheet-confirm-overlay" onClick={() => setDeleteMasterModalData(null)}>
          <div className="bottom-sheet-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" style={{ marginTop: 0, marginBottom: '1.25rem' }}></div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--danger)', textAlign: 'center' }}>
              Konfirmasi Hapus
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: '1.45', textAlign: 'center' }}>
              Anda yakin ingin menghapus <strong>"{deleteMasterModalData.value}"</strong>?
              Semua postingan fauna yang menggunakan opsi ini akan dialihkan ke opsi pengganti di bawah ini.
            </p>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Pilih Opsi Pengganti *</label>
              <select 
                className="form-select"
                value={deleteMasterModalData.selectedReplacement}
                onChange={(e) => setDeleteMasterModalData({
                  ...deleteMasterModalData,
                  selectedReplacement: e.target.value
                })}
                style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '0.4rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
              >
                {deleteMasterModalData.replacementOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setDeleteMasterModalData(null)}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary"
                style={{ flex: 1, backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.85rem', padding: '0.65rem', borderRadius: '0.35rem', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={async () => {
                  const { field, value, selectedReplacement } = deleteMasterModalData;
                  setDeleteMasterModalData(null); // Close modal
                  
                  try {
                    setCrudLoading(true)
                    const res = await fetch(`${API_BASE}/stores/delete-master-option`, {
                      method: 'POST',
                      headers: getAuthHeaders(),
                      body: JSON.stringify({ field, value, replacement: selectedReplacement, product_type: field === 'class' ? masterCategoryContextTab : undefined })
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





      {/* Fixed Bottom Navigation Bar */}
      {!error && !(activeTab === 'admin' && adminSubTab !== 'menu') && !(activeTab === 'articles' && selectedArticle) && !(settings.plan === 'free' && !isStoreOwner) && !(activeTab === 'about' && aboutSubView === 'qrcode') && (
        <nav className="bottom-nav">
          <button 
            className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={goToCatalog}
          >
            <BookOpen size={20} />
            <span>Katalog</span>
          </button>
          {settings.plan !== 'free' && (
            <button 
              className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={goToAbout}
            >
              <Info size={20} />
              <span>Tentang Kami</span>
            </button>
          )}
          {false && settings.articles_enabled !== '0' && (
            <button 
              className={`nav-item ${activeTab === 'articles' ? 'active' : ''}`}
              onClick={goToArticles}
            >
              <FileText size={20} />
              <span>Artikel</span>
            </button>
          )}
          {isStoreOwner && (
            <button 
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Settings size={20} />
              <span>Admin</span>
            </button>
          )}
        </nav>
      )}
        </>
      )}

      {/* LIGHTBOX OVERLAY WITH ZOOM & PAN FOR MOBILE */}
      {showLightbox && selectedFauna && (
        <div 
          className="modal-overlay" 
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.97)', zIndex: 3000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', userSelect: 'none' }}
          onClick={() => setShowLightbox(false)}
        >
          {/* Close Button */}
          <button 
            className="modal-close-btn" 
            style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', padding: '0.5rem', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 3200 }} 
            onClick={() => setShowLightbox(false)}
          >
            <X size={18} />
          </button>

          {/* Main Visual Container */}
          <div 
            style={{ width: '95vw', height: '55vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
              <button
                type="button"
                style={{ position: 'absolute', left: '0.5rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const len = selectedFauna.detailed_info?.images?.length || 1
                  setLightboxIndex(prev => (prev - 1 + len) % len)
                  setZoomScale(1)
                  setPanPosition({ x: 0, y: 0 })
                }}
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {/* Next Button */}
            {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
              <button
                type="button"
                style={{ position: 'absolute', right: '0.5rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const len = selectedFauna.detailed_info?.images?.length || 1
                  setLightboxIndex(prev => (prev + 1) % len)
                  setZoomScale(1)
                  setPanPosition({ x: 0, y: 0 })
                }}
              >
                <ChevronRight size={22} />
              </button>
            )}

            {/* Touch Zoomable/Pannable Image Container */}
            <div 
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              onTouchStart={(e) => {
                if (zoomScale > 1 && e.touches.length === 1) {
                  setIsDragging(true)
                  const touch = e.touches[0]
                  setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y })
                }
              }}
              onTouchMove={(e) => {
                if (isDragging && zoomScale > 1 && e.touches.length === 1) {
                  const touch = e.touches[0]
                  setPanPosition({
                    x: touch.clientX - dragStart.x,
                    y: touch.clientY - dragStart.y
                  })
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
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

          {/* Bottom Control Bar */}
          <div 
            style={{ 
              display: 'flex', 
              gap: '1.25rem', 
              background: 'rgba(0,0,0,0.6)', 
              padding: '0.4rem 1rem', 
              borderRadius: '2rem', 
              border: '1px solid rgba(255,255,255,0.1)', 
              alignItems: 'center', 
              zIndex: 3100, 
              marginTop: '1.5rem', 
              marginBottom: '1rem' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button" 
              style={{ padding: '0.25rem 0.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setZoomScale(prev => Math.max(1, prev - 0.5))
                if (zoomScale <= 1.5) setPanPosition({ x: 0, y: 0 })
              }}
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>{zoomScale.toFixed(1)}x</span>
            <button 
              type="button" 
              style={{ padding: '0.25rem 0.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setZoomScale(prev => Math.min(4, prev + 0.5))
              }}
            >
              <ZoomIn size={16} />
            </button>
            <span style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }}></span>
            <span style={{ fontSize: '0.8rem', color: '#fff' }}>
              {(selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images))
                ? `${lightboxIndex + 1} / ${selectedFauna.detailed_info.images.length}`
                : '1 / 1'
              }
            </span>
          </div>

          {/* Bottom Thumbnails Strip */}
          {selectedFauna.detailed_info?.images && Array.isArray(selectedFauna.detailed_info.images) && selectedFauna.detailed_info.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.4rem', zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '0.4rem', borderRadius: '0.5rem', overflowX: 'auto', maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
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
                    width: '44px',
                    height: '44px',
                    objectFit: 'cover',
                    borderRadius: '0.25rem',
                    border: lightboxIndex === idx ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
                    flexShrink: 0
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

      {/* SINGLE IMAGE LIGHTBOX OVERLAY WITH ZOOM & PAN */}
      {activeLightboxImage && (
        <div 
          className="modal-overlay" 
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.97)', zIndex: 3000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', userSelect: 'none' }}
          onClick={() => setActiveLightboxImage(null)}
        >
          {/* Close Button */}
          <button 
            className="modal-close-btn" 
            style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', padding: '0.5rem', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 3200 }} 
            onClick={() => setActiveLightboxImage(null)}
          >
            <X size={18} />
          </button>

          {/* Main Visual Container */}
          <div 
            style={{ width: '95vw', height: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Touch Zoomable/Pannable Image Container */}
            <div 
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              onTouchStart={(e) => {
                if (zoomScale > 1 && e.touches.length === 1) {
                  setIsDragging(true)
                  const touch = e.touches[0]
                  setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y })
                }
              }}
              onTouchMove={(e) => {
                if (isDragging && zoomScale > 1 && e.touches.length === 1) {
                  const touch = e.touches[0]
                  setPanPosition({
                    x: touch.clientX - dragStart.x,
                    y: touch.clientY - dragStart.y
                  })
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
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
                src={activeLightboxImage}
                alt="Detail Gambar"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div 
            style={{ 
              display: 'flex', 
              gap: '1.25rem', 
              background: 'rgba(0,0,0,0.6)', 
              padding: '0.4rem 1rem', 
              borderRadius: '2rem', 
              marginTop: '1rem',
              zIndex: 3100,
              backdropFilter: 'blur(5px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button"
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
              onClick={() => {
                setZoomScale(prev => Math.min(prev + 0.5, 4))
              }}
            >
              <ZoomIn size={16} /> Perbesar
            </button>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
            <button 
              type="button"
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
              onClick={() => {
                setZoomScale(prev => {
                  const next = Math.max(prev - 0.5, 1)
                  if (next === 1) setPanPosition({ x: 0, y: 0 })
                  return next
                })
              }}
            >
              <ZoomOut size={16} /> Perkecil
            </button>
          </div>
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

      {/* QUICK POLICY POPOVER MODAL FOR FORMS */}
      {showQuickPolicyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowQuickPolicyModal(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '440px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
                  {showQuickPolicyModal === 'terms' ? 'Syarat & Ketentuan' : showQuickPolicyModal === 'privacy' ? 'Kebijakan Privasi' : 'Ketentuan Penggunaan'}
                </span>
              </div>
              <button type="button" onClick={() => setShowQuickPolicyModal(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              {renderFormattedPolicyContent(policies[showQuickPolicyModal]?.content || '')}
            </div>

            <button type="button" className="btn-primary btn-full" onClick={() => setShowQuickPolicyModal(null)} style={{ marginTop: '1rem', padding: '0.65rem', fontSize: '0.8rem', fontWeight: 800 }}>
              Saya Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {/* RENAME MASTER OPTION MODAL (MOBILE) */}
      {renameMasterModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setRenameMasterModalData(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '420px', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Edit3 size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  Ubah Nama {renameMasterModalData.fieldLabel}
                </span>
              </div>
              <button type="button" onClick={() => setRenameMasterModalData(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                Nama Saat Ini:
              </label>
              <div style={{ padding: '0.45rem 0.65rem', borderRadius: '0.45rem', backgroundColor: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                {renameMasterModalData.oldValue}
              </div>

              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff', display: 'block', marginBottom: '0.3rem' }}>
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
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.85rem', borderRadius: '0.5rem' }}
              />
            </div>

            <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', marginBottom: '1rem', display: 'flex', gap: '0.45rem' }}>
              <Info size={15} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.72rem', color: '#93c5fd', lineHeight: 1.35 }}>
                Otomatis disinkronkan ke seluruh item katalog yang memakai opsi ini.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setRenameMasterModalData(null)} style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={crudLoading || !renameMasterModalData.newValue.trim()} 
                onClick={() => handleRenameMasterOption(renameMasterModalData.field, renameMasterModalData.oldValue, renameMasterModalData.newValue)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 800 }}
              >
                {crudLoading ? 'Menyimpan...' : 'Simpan Nama Baru'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRESET MASTER DATA CONFIRMATION MODAL (MOBILE) */}
      {presetModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPresetModalData(null)}>
          <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '440px', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.15)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.99) 100%)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  Terapkan Template {presetModalData.title}
                </span>
              </div>
              <button type="button" onClick={() => setPresetModalData(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.85rem', lineHeight: 1.4 }}>
              Template ini akan menyusun ulang opsi kategori toko bawaan sesuai standar <strong>{presetModalData.title}</strong>:
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Kategori yang Akan Dimuat:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {presetModalData.sampleCategories.map((cat, idx) => (
                  <span key={idx} style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ padding: '0.65rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '1rem', display: 'flex', gap: '0.45rem' }}>
              <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', lineHeight: 1.35 }}>
                Item katalog Anda tetap aman &amp; tidak akan terhapus.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setPresetModalData(null)} style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
                Batal
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={crudLoading} 
                onClick={() => handleApplyPreset(presetModalData.key)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 800 }}
              >
                {crudLoading ? 'Menerapkan...' : 'Terapkan Template Ini'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LUXURY UNIFIED ADVANCED FILTER BOTTOM SHEET (Industry Standard: Filter Lanjutan & Urutan) */}
      {showFilterSheet && (
        <div 
          className="bottom-sheet-backdrop" 
          onClick={() => setShowFilterSheet(false)}
        >
          <div 
            className="bottom-sheet-content filter-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0'
            }}
          >
            {/* Smooth Drag Handle Area */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('filter')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('filter')}
            >
              <div className="bottom-sheet-handle" />
            </div>
            
            {/* Header (Clean without X icon, dismissible via drag handle, backdrop, or footer actions) */}
            <div 
              className="bottom-sheet-header"
              style={{ padding: '0 1.25rem 0.65rem' }}
            >
              <div className="bottom-sheet-title-box">
                <SlidersHorizontal size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <h3 className="bottom-sheet-title">Filter &amp; Urutkan Produk</h3>
                </div>
              </div>
            </div>

            {/* Content Container (Fixed Sort + Isolated Category Scroll) */}
            <div style={{ padding: '0.75rem 1.25rem 0.5rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* SECTION 1: URUTKAN (SORT BY) - Static Fixed Header */}
              <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Urutkan Berdasarkan
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.45rem' }}>
                  {[
                    { key: 'newest', label: 'Terbaru' },
                    { key: 'price_asc', label: 'Harga: Termurah' },
                    { key: 'price_desc', label: 'Harga: Tertinggi' },
                    { key: 'name_asc', label: 'Nama: A - Z' },
                    { key: 'oldest', label: 'Terlama' }
                  ].map((s) => {
                    const isSelected = sortBy === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSortBy(s.key as any)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? 800 : 600,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                          backgroundColor: isSelected ? 'var(--primary-glow)' : 'var(--bg-deep)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: KATEGORI PRODUK - Isolated Scroll for Category List */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Kategori Produk ({availableCategories.length})
                  </span>
                  {classFilter !== 'all' && (
                    <button 
                      type="button" 
                      onClick={() => setClassFilter('all')} 
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Pilih Semua
                    </button>
                  )}
                </div>

                {/* Quick Category Search */}
                {availableCategories.length > 6 && (
                  <div className="category-search-input-box" style={{ flexShrink: 0, marginBottom: '0.5rem' }}>
                    <Search size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="category-search-input"
                      placeholder="Cari kategori cepat..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => setCategorySearch('')}
                        style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.7rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Dedicated Scroll Container ONLY for the Category List items */}
                <div className="unified-category-list-scroll-box">
                  <button
                    type="button"
                    className={`unified-category-item ${classFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setClassFilter('all')}
                  >
                    <div className="unified-category-left">
                      <span className="unified-category-name">Semua Kategori</span>
                    </div>
                    <div className="unified-category-right">
                      <span className="unified-category-badge">
                        {productTypeFilter === 'all' ? faunas.length : faunas.filter(f => (f.product_type || 'physical') === productTypeFilter).length} item
                      </span>
                      <div className={`unified-category-radio ${classFilter === 'all' ? 'selected' : ''}`}>
                        {classFilter === 'all' && <Check size={12} strokeWidth={3.5} />}
                      </div>
                    </div>
                  </button>

                  {availableCategories
                    .filter(cat => !categorySearch.trim() || cat.toLowerCase().includes(categorySearch.toLowerCase()))
                    .map((cat) => {
                      const count = faunas.filter(f => f.class === cat && (productTypeFilter === 'all' || (f.product_type || 'physical') === productTypeFilter)).length;
                      const isSelected = classFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`unified-category-item ${isSelected ? 'active' : ''}`}
                          onClick={() => setClassFilter(cat)}
                        >
                          <div className="unified-category-left">
                            <span className="unified-category-name">{cat}</span>
                          </div>
                          <div className="unified-category-right">
                            <span className="unified-category-badge">{count} item</span>
                            <div className={`unified-category-radio ${isSelected ? 'selected' : ''}`}>
                              {isSelected && <Check size={12} strokeWidth={3.5} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer Bottom Sticky Actions (Pinned Flush to Screen Bottom) */}
            <div className="bottom-sheet-sticky-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setClassFilter('all');
                  setSortBy('newest');
                }}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.75rem' }}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowFilterSheet(false)}
                style={{ flex: 2, padding: '0.75rem', fontSize: '0.84rem', fontWeight: 800, borderRadius: '0.75rem' }}
              >
                Terapkan ({filteredFaunas.length} Produk)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT-AWARE LUXURY ACTION MENU BOTTOM SHEET (Bagikan / Laporkan) */}
      {actionMenuData && (
        <div 
          className="bottom-sheet-backdrop" 
          onClick={() => setActionMenuData(null)}
        >
          <div 
            className="bottom-sheet-content action-menu-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: '0.65rem 0 0 0'
            }}
          >
            {/* Drag Handle */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('action_menu')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('action_menu')}
            >
              <div className="bottom-sheet-handle" />
            </div>

            {/* Header / Context Preview */}
            <div className="bottom-sheet-header" style={{ padding: '0 1.25rem 0.65rem' }}>
              <div className="bottom-sheet-title-box">
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  {actionMenuData.type === 'store' ? <Store size={17} /> : <Package size={17} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="bottom-sheet-title" style={{ fontSize: '0.92rem' }}>
                    {actionMenuData.type === 'store' 
                      ? (settings.store_title || 'Katalog Digital') 
                      : (actionMenuData.item?.name || 'Item Katalog')}
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {actionMenuData.type === 'store' 
                      ? 'Opsi dan menu katalog' 
                      : `${actionMenuData.item?.class || 'Produk'} • ${formatPrice(actionMenuData.item?.price)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu List */}
            <div style={{ padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {/* Option 1: Bagikan */}
              <button
                type="button"
                className="action-menu-btn"
                onClick={() => {
                  if (actionMenuData.type === 'store') {
                    handleShareStore();
                  } else {
                    handleShareItem(actionMenuData.item);
                  }
                  setActionMenuData(null);
                }}
              >
                <div className="action-menu-icon-box share-icon-box">
                  <Share2 size={18} />
                </div>
                <div className="action-menu-text-box">
                  <span className="action-menu-title">
                    {actionMenuData.type === 'store' ? 'Bagikan Katalog' : 'Bagikan Produk Ini'}
                  </span>
                  <span className="action-menu-desc">
                    {actionMenuData.type === 'store' 
                      ? 'Salin tautan atau bagikan QR code katalog ini' 
                      : 'Salin tautan langsung produk untuk dibagikan ke chat & medsos'}
                  </span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </button>

              {/* Option 2: Laporkan */}
              <button
                type="button"
                className="action-menu-btn danger-menu-btn"
                onClick={() => {
                  const savedData = actionMenuData;
                  setActionMenuData(null);
                  setReportReason(savedData.type === 'store' ? 'illegal_content' : 'counterfeit');
                  setReportNotes('');
                  setReportEmail('');
                  setReportModalData(savedData);
                }}
              >
                <div className="action-menu-icon-box report-icon-box">
                  <ShieldAlert size={18} />
                </div>
                <div className="action-menu-text-box">
                  <span className="action-menu-title" style={{ color: '#ef4444' }}>
                    {actionMenuData.type === 'store' ? 'Laporkan Katalog Ini' : 'Laporkan Produk Ini'}
                  </span>
                  <span className="action-menu-desc">
                    {actionMenuData.type === 'store' 
                      ? 'Laporkan jika katalog memuat konten terlarang atau pelanggaran aturan' 
                      : 'Laporkan jika produk palsu, menyesatkan, atau melanggar aturan'}
                  </span>
                </div>
                <ChevronRight size={16} style={{ color: '#ef4444' }} />
              </button>
            </div>

            {/* Bottom Safe Cancel */}
            <div className="bottom-sheet-sticky-footer" style={{ borderTop: 'none', paddingTop: '0.35rem' }}>
              <button
                type="button"
                className="btn-secondary btn-full"
                onClick={() => setActionMenuData(null)}
                style={{ padding: '0.75rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.75rem' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT-AWARE LUXURY REPORT MODAL BOTTOM SHEET */}
      {reportModalData && (
        <div 
          className="bottom-sheet-backdrop" 
          onClick={() => setReportModalData(null)}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0'
            }}
          >
            {/* Drag Handle */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('report')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('report')}
            >
              <div className="bottom-sheet-handle" />
            </div>

            {/* Header */}
            <div className="bottom-sheet-header" style={{ padding: '0 1.25rem 0.65rem' }}>
              <div className="bottom-sheet-title-box">
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="bottom-sheet-title" style={{ fontSize: '0.92rem', color: '#ef4444' }}>
                    {reportModalData.type === 'store' 
                      ? (settings.store_title ? `Laporkan Katalog: ${settings.store_title}` : 'Laporkan Katalog Ini') 
                      : `Laporkan Produk: ${reportModalData.item?.name || 'Produk'}`}
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                    Pilih alasan pelanggaran untuk ditinjau Tim Kepatuhan
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Report Form Body */}
            <div style={{ padding: '0.75rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
              {/* Reason Selector */}
              <div>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Alasan Pelaporan *
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(reportModalData.type === 'store' ? [
                    { id: 'illegal_content', title: 'Konten atau Komoditas Terlarang', desc: 'Menampilkan barang terlarang hukum, zat berbahaya, atau satwa/tumbuhan dilindungi' },
                    { id: 'copyright', title: 'Pelanggaran Hak Cipta & Merek Dagang', desc: 'Menggunakan nama brand, logo, foto, atau hak cipta tanpa izin sah' },
                    { id: 'fraud_suspicion', title: 'Indikasi Penipuan atau Aktivitas Fiktif', desc: 'Indikasi penipuan pesanan, identitas palsu, atau transaksi mencurigakan' },
                    { id: 'misleading_info', title: 'Informasi atau Kontak Menyesatkan', desc: 'Nomor kontak, alamat, atau profil katalog manipulatif / palsu' },
                    { id: 'other', title: 'Alasan Lainnya', desc: 'Pelanggaran ketentuan penggunaan dan komunitas lainnya' }
                  ] : [
                    { id: 'counterfeit', title: 'Produk Tiruan atau Pembajakan (KW)', desc: 'Barang tiruan atau bajakan yang melanggar hak cipta / brand resmi' },
                    { id: 'illegal_item', title: 'Komoditas Terlarang atau Satwa Dilindungi', desc: 'Barang terlarang hukum atau satwa/tumbuhan dilindungi undang-undang' },
                    { id: 'misleading_info', title: 'Foto atau Deskripsi Menyesatkan', desc: 'Informasi spesifikasi, kondisi, atau foto produk fiktif / tidak akurat' },
                    { id: 'price_manipulation', title: 'Manipulasi Harga atau Informasi Tarif', desc: 'Harga fiktif, tidak wajar, atau tidak sesuai dengan kesepakatan' },
                    { id: 'other', title: 'Alasan Lainnya', desc: 'Pelanggaran pada item produk yang tidak tercantum di atas' }
                  ]).map((reason) => {
                    const isSelected = reportReason === reason.id;
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        className={`unified-category-item ${isSelected ? 'active' : ''}`}
                        onClick={() => setReportReason(reason.id)}
                        style={{ padding: '0.65rem 0.85rem' }}
                      >
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', display: 'block' }}>
                            {reason.title}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.12rem', lineHeight: 1.3 }}>
                            {reason.desc}
                          </span>
                        </div>
                        <div className={`unified-category-radio ${isSelected ? 'selected' : ''}`} style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border-light)' }}>
                          {isSelected && <Check size={12} strokeWidth={3.5} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional Details (Textarea) */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  className="search-input"
                  placeholder="Jelaskan detail pelanggaran yang Anda temukan..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    resize: 'none',
                    fontSize: '0.78rem',
                    lineHeight: 1.4,
                    height: 'auto'
                  }}
                />
              </div>

              {/* Email (Optional) */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Email Pelapor (Opsional)
                </label>
                <input
                  type="email"
                  className="search-input"
                  placeholder="email@anda.com (untuk pembaruan status laporan)"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem' }}
                />
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="bottom-sheet-sticky-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReportModalData(null)}
                disabled={isSubmittingReport}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.75rem' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={isSubmittingReport}
                onClick={async () => {
                  const reasonList = reportModalData.type === 'store' ? [
                    { id: 'illegal_content', title: 'Konten atau Komoditas Terlarang' },
                    { id: 'copyright', title: 'Pelanggaran Hak Cipta & Merek Dagang' },
                    { id: 'fraud_suspicion', title: 'Indikasi Penipuan atau Aktivitas Fiktif' },
                    { id: 'misleading_info', title: 'Informasi atau Kontak Menyesatkan' },
                    { id: 'other', title: 'Alasan Lainnya' }
                  ] : [
                    { id: 'counterfeit', title: 'Produk Tiruan atau Pembajakan (KW)' },
                    { id: 'illegal_item', title: 'Komoditas Terlarang atau Satwa Dilindungi' },
                    { id: 'misleading_info', title: 'Foto atau Deskripsi Menyesatkan' },
                    { id: 'price_manipulation', title: 'Manipulasi Harga atau Informasi Tarif' },
                    { id: 'other', title: 'Alasan Lainnya' }
                  ];
                  const currentReasonObj = reasonList.find(r => r.id === reportReason);
                  const reasonLabel = currentReasonObj ? currentReasonObj.title : 'Pelanggaran Ketentuan';
                  const targetName = reportModalData.type === 'store' 
                    ? (settings.store_title || 'katalog ini') 
                    : (reportModalData.item?.name || 'produk ini');

                  setIsSubmittingReport(true);
                  try {
                    const res = await fetch(`${API_BASE}/reports`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        target_type: reportModalData.type === 'store' ? 'catalog' : 'item',
                        store_id: (settings as any).id || 0,
                        store_slug: storeSlug || '',
                        store_title: settings.store_title || 'Katalog Digital',
                        fauna_id: reportModalData.type === 'item' ? reportModalData.item?.id : null,
                        item_name: reportModalData.type === 'item' ? reportModalData.item?.name : null,
                        reason_category: reportReason,
                        reason_label: reasonLabel,
                        description: reportNotes.trim(),
                        reporter_email: reportEmail.trim()
                      })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setReportModalData(null);
                      setReportNotes('');
                      setReportEmail('');
                      showToast(`Terima kasih. Laporan #${data.data?.report_number || ''} untuk "${targetName}" telah berhasil dikirim ke tim kepatuhan.`);
                    } else {
                      showToast(data.message || 'Gagal mengirim laporan. Silakan coba lagi.', 'error');
                    }
                  } catch (err) {
                    showToast('Terjadi gangguan saat mengirim laporan. Silakan coba lagi.', 'error');
                  } finally {
                    setIsSubmittingReport(false);
                  }
                }}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  borderRadius: '0.75rem',
                  backgroundColor: '#ef4444',
                  borderColor: '#ef4444',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                }}
              >
                {isSubmittingReport ? 'Mengirim Laporan...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LUXURY MOBILE BOTTOM SHEET: CATEGORY FILTER */}
      {showCategorySheet && (
        <div 
          className="bottom-sheet-backdrop" 
          onClick={() => setShowCategorySheet(false)}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('category')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('category')}
            >
              <div className="bottom-sheet-handle" />
            </div>
            
            {/* Header without X icon */}
            <div 
              className="bottom-sheet-header"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('category')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('category')}
            >
              <div className="bottom-sheet-title-box">
                <Layers size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <h3 className="bottom-sheet-title">Pilih Kategori Produk</h3>
              </div>
            </div>

            <div className="bottom-sheet-scrollable-body">
              <button
                type="button"
                className={`bottom-sheet-item ${classFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setClassFilter('all');
                  setShowCategorySheet(false);
                }}
              >
                <div className="bottom-sheet-item-left">
                  <span className="bottom-sheet-item-name">Semua Kategori</span>
                  <span className="bottom-sheet-item-badge">{faunas.length} item</span>
                </div>
                <div className={`bottom-sheet-radio ${classFilter === 'all' ? 'selected' : ''}`}>
                  {classFilter === 'all' && (
                    <Check size={12} strokeWidth={3.5} style={{ display: 'block', margin: 'auto' }} />
                  )}
                </div>
              </button>

              {availableCategories.map((cat) => {
                const count = faunas.filter(f => f.class === cat && (productTypeFilter === 'all' || (f.product_type || 'physical') === productTypeFilter)).length;
                const isSelected = classFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`bottom-sheet-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setClassFilter(cat);
                      setShowCategorySheet(false);
                    }}
                  >
                    <div className="bottom-sheet-item-left">
                      <span className="bottom-sheet-item-name">{cat}</span>
                      <span className="bottom-sheet-item-badge">{count} item</span>
                    </div>
                    <div className={`bottom-sheet-radio ${isSelected ? 'selected' : ''}`}>
                      {isSelected && (
                        <Check size={12} strokeWidth={3.5} style={{ display: 'block', margin: 'auto' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LUXURY MOBILE BOTTOM SHEET: SORT OPTIONS */}
      {showSortSheet && (
        <div 
          className="bottom-sheet-backdrop" 
          onClick={() => setShowSortSheet(false)}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('sort')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('sort')}
            >
              <div className="bottom-sheet-handle" />
            </div>

            {/* Header without X icon */}
            <div 
              className="bottom-sheet-header"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('sort')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('sort')}
            >
              <div className="bottom-sheet-title-box">
                <ArrowUpDown size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <h3 className="bottom-sheet-title">Urutkan Produk</h3>
              </div>
            </div>

            <div className="bottom-sheet-scrollable-body">
              {[
                { id: 'newest', label: 'Produk Terbaru', desc: 'Menampilkan item yang baru ditambahkan' },
                { id: 'price_asc', label: 'Harga: Termurah', desc: 'Urutan dari harga paling hemat' },
                { id: 'price_desc', label: 'Harga: Tertinggi', desc: 'Urutan dari harga paling tinggi / eksklusif' },
                { id: 'name_asc', label: 'Nama Produk: A - Z', desc: 'Urutan alfabetis nama item katalog' },
                { id: 'oldest', label: 'Produk Terlama', desc: 'Item katalog pertama' }
              ].map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`bottom-sheet-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSortBy(opt.id as any);
                      setShowSortSheet(false);
                    }}
                  >
                    <div className="bottom-sheet-item-col">
                      <span className="bottom-sheet-item-name">{opt.label}</span>
                      <span className="bottom-sheet-item-desc">{opt.desc}</span>
                    </div>
                    <div className={`bottom-sheet-radio ${isSelected ? 'selected' : ''}`}>
                      {isSelected && (
                        <Check size={12} strokeWidth={3.5} style={{ display: 'block', margin: 'auto' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LUXURY MOBILE BOTTOM SHEET: CRUD FORM DROPDOWN PICKER */}
      {crudDropdownPicker && (
        <div 
          className="bottom-sheet-backdrop" 
          style={{ zIndex: 11000 }}
          onClick={() => setCrudDropdownPicker(null)}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Smooth Drag Handle Area (Touch & Mouse Drag to Dismiss) */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('crud_dropdown')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('crud_dropdown')}
            >
              <div className="bottom-sheet-handle" />
            </div>

            {/* Header */}
            <div 
              className="bottom-sheet-header"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('crud_dropdown')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('crud_dropdown')}
            >
              <div className="bottom-sheet-title-box">
                {crudDropdownPicker.icon ? (
                  <crudDropdownPicker.icon size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                ) : (
                  <Layers size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                )}
                <h3 className="bottom-sheet-title">{crudDropdownPicker.title}</h3>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="bottom-sheet-scrollable-body" style={{ maxHeight: '60vh' }}>
              {crudDropdownPicker.options.map((opt) => {
                const isSelected = crudDropdownPicker.selectedValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`bottom-sheet-item ${isSelected ? 'active' : ''}`}
                    style={opt.isAction ? { borderStyle: 'dashed', borderColor: 'var(--primary)', backgroundColor: 'var(--primary-glow)' } : {}}
                    onClick={() => {
                      crudDropdownPicker.onSelect(opt.value);
                      setCrudDropdownPicker(null);
                    }}
                  >
                    <div className="bottom-sheet-item-left">
                      <div className="bottom-sheet-item-col">
                        <span className="bottom-sheet-item-name" style={opt.isAction ? { color: 'var(--primary)', fontWeight: 800 } : {}}>
                          {opt.label}
                        </span>
                        {opt.desc && (
                          <span className="bottom-sheet-item-desc">{opt.desc}</span>
                        )}
                      </div>
                      {opt.badge && (
                        <span className="bottom-sheet-item-badge">{opt.badge}</span>
                      )}
                    </div>
                    <div className={`bottom-sheet-radio ${isSelected ? 'selected' : ''}`}>
                      {isSelected && (
                        <Check size={12} strokeWidth={3.5} style={{ display: 'block', margin: 'auto' }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '2rem',
          backgroundColor: toast.type === 'success' ? 'rgba(10, 18, 14, 0.93)' : 'rgba(22, 12, 12, 0.93)',
          color: '#f3f4f6',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: toast.type === 'success' 
            ? '0 12px 30px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.2)' 
            : '0 12px 30px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          backdropFilter: 'blur(16px)',
          border: toast.type === 'success' 
            ? '1px solid rgba(16, 185, 129, 0.35)' 
            : '1px solid rgba(239, 68, 68, 0.35)',
          maxWidth: '90%',
          minWidth: '280px',
          justifyContent: 'center',
          animation: 'toast-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          boxSizing: 'border-box'
        }}>
          {toast.type === 'success' 
            ? <ShieldCheck size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} /> 
            : <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          }
          <span style={{ letterSpacing: '0.01em', lineHeight: 1.3 }}>{toast.message}</span>
        </div>
      )}

      {/* MOBILE REKBER SYARIAH EXPLAINER BOTTOM SHEET (DRAG-TO-DISMISS) */}
      {showRekberExplainerModal && (
        <div 
          className="bottom-sheet-backdrop" 
          style={{ zIndex: 10000 }}
          onClick={() => setShowRekberExplainerModal(false)}
        >
          <div 
            className="bottom-sheet-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              transform: `translateY(${Math.max(0, sheetDragY)}px)`,
              transition: isSheetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '0.65rem 0 0 0',
              borderTopLeftRadius: '1.5rem', 
              borderTopRightRadius: '1.5rem', 
              background: 'var(--card-bg-gradient, linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%))', 
              borderTop: '2px solid var(--primary)', 
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8), 0 0 25px var(--primary-glow)'
            }}
          >
            {/* Smooth Drag Handle Area (Swipe up/down to drag and close) */}
            <div 
              className="bottom-sheet-handle-bar"
              onTouchStart={(e) => handleSheetDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleSheetDragMove(e.touches[0].clientY)}
              onTouchEnd={() => handleSheetDragEnd('rekber_explainer')}
              onMouseDown={(e) => handleSheetDragStart(e.clientY)}
              onMouseMove={(e) => handleSheetDragMove(e.clientY)}
              onMouseUp={() => handleSheetDragEnd('rekber_explainer')}
              style={{ cursor: 'grab', padding: '0.4rem 0 0.65rem' }}
            >
              <div className="bottom-sheet-handle" style={{ backgroundColor: 'var(--primary)', opacity: 0.75, boxShadow: '0 0 10px var(--primary-glow)' }} />
            </div>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', padding: '0 1.25rem 0.65rem', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '0.55rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                    Rekber Syariah
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                    Amanah • Transparan • rekbersyariah.com
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ overflowY: 'auto', padding: '0 1.25rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
              {/* Intro */}
              <div style={{ padding: '0.75rem 0.85rem', borderRadius: '0.65rem', backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-light)' }}>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                  <strong>Rekening Bersama (Rekber) Syariah</strong> adalah penengah amanah (*Escrow*) yang menjaga uang pembayaran pembeli secara aman sampai barang/jasa diterima dan diverifikasi sesuai pesanan.
                </p>
              </div>

              {/* 4 Keunggulan */}
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.5rem 0' }}>
                  Mengapa Menggunakan Rekber Syariah?
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ padding: '0.65rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      <CheckCircle2 size={13} /> 100% Anti-Penipuan
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.35 }}>
                      Uang tidak diteruskan jika barang belum diterima &amp; diverifikasi pembeli.
                    </p>
                  </div>

                  <div style={{ padding: '0.65rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      <Shield size={13} /> Aman untuk Penjual
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.35 }}>
                      Penjual memiliki kepastian dana sebelum mengirimkan pesanan.
                    </p>
                  </div>

                  <div style={{ padding: '0.65rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      <Scale size={13} /> Prinsip Syariah
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.35 }}>
                      Bebas riba &amp; gharar, berlandaskan akad muamalah yang adil.
                    </p>
                  </div>

                  <div style={{ padding: '0.65rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                      <MessageCircle size={13} /> Grup WA Resmi
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.35 }}>
                      Transaksi dikawal langsung oleh admin via grup WhatsApp khusus.
                    </p>
                  </div>
                </div>
              </div>

              {/* 5 Langkah Alur Transaksi */}
              <div style={{ padding: '0.75rem 0.85rem', borderRadius: '0.65rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  Alur Transaksi:
                </h4>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <li><strong>Hubungi Penjual:</strong> Pembeli mengontak WhatsApp penjual dengan pesan resmi permohonan transaksi via Rekber Syariah (rekbersyariah.com).</li>
                  <li><strong>Pendaftaran Transaksi:</strong> Penjual / Pembeli mendaftarkan detail transaksi ke website rekbersyariah.com atau langsung menghubungi admin resmi Rekber Syariah.</li>
                  <li><strong>Pembuatan Grup WA Resmi:</strong> Admin Rekber Syariah membuat grup WhatsApp khusus yang beranggotakan Admin Rekber, Pembeli, dan Penjual untuk memandu transaksi.</li>
                  <li><strong>Penyetoran Dana &amp; Pengiriman:</strong> Pembeli menyetorkan dana aman ke Rekening Bersama Syariah, lalu penjual mengirimkan barang / memulai jasa.</li>
                  <li><strong>Verifikasi &amp; Pencairan Dana:</strong> Barang diterima dan diperiksa pembeli. Setelah sesuai kesepakatan, dana di Rekber Syariah langsung dicairkan ke rekening penjual.</li>
                </ol>
              </div>
            </div>

            {/* Footer Button */}
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid var(--border-light)' }}>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => setShowRekberExplainerModal(false)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.65rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Saya Paham
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
