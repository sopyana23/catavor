import React, { useState, useEffect } from 'react';
import {
  Store as StoreIcon,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  MessageCircle,
  LogIn,
  Scale,
  Zap,
  Utensils,
  Briefcase,
  FileCode,
  PawPrint,
  Leaf,
  Building2,
  Palette,
  PackageCheck,
  Globe,
  ChevronDown,
  Check,
  BadgeCheck,
  Phone,
  HelpCircle,
  Menu,
  X,
  Compass
} from 'lucide-react';

export const CATALOG_TYPES_INFO = [
  {
    id: 'physical',
    name: 'Barang Fisik',
    tagline: 'Fesyen, Kerajinan, Aksesori & Harian',
    description: 'Formulir terstruktur khusus produk nyata dengan rincian merek, bahan/material, bobot pengiriman (gram), serta opsi varian ukuran dan warna.',
    icon: Package,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.25)',
    examples: 'Pakaian, Sepatu, Tas, Perhiasan, Kerajinan Tangan'
  },
  {
    id: 'food',
    name: 'Kuliner & F&B',
    tagline: 'Restoran, Kafe, Bakery & Katering',
    description: 'Buku menu digital interaktif dengan rincian masa simpan (expired date), temperatur penyimpanan, level varian rasa, dan catatan pesan antar.',
    icon: Utensils,
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.1)',
    borderColor: 'rgba(234, 88, 12, 0.25)',
    examples: 'Kopi Artisan, Pastry, Makanan Siap Saji, Katering'
  },
  {
    id: 'service',
    name: 'Jasa & Layanan',
    tagline: 'Barbershop, Studio Foto, Salon & Konsultan',
    description: 'Etalase paket jasa profesional dengan kejelasan estimasi durasi pengerjaan, lokasi layanan (studio/onsite), dan booking langsung ke WhatsApp.',
    icon: Briefcase,
    color: '#7c3aed',
    bgColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: 'rgba(124, 58, 237, 0.25)',
    examples: 'Grooming Pria, Sesi Foto Studio, Arsitektur, Kursus'
  },
  {
    id: 'digital',
    name: 'Produk Digital',
    tagline: 'Template Desain, Spreadsheet & E-Book',
    description: 'Etalase aset digital dengan spesifikasi format berkas (.pdf, .fig, .xlsx), ukuran file, dan kejelasan lisensi komersial siap kirim.',
    icon: FileCode,
    color: '#0284c7',
    bgColor: 'rgba(2, 132, 199, 0.1)',
    borderColor: 'rgba(2, 132, 199, 0.25)',
    examples: 'UI Kit Figma, Spreadsheet Akuntansi, E-Book Panduan'
  },
  {
    id: 'fauna',
    name: 'Hewan & Peliharaan',
    tagline: 'Aquascape, Ikan Hias, Reptil & Pet Shop',
    description: 'Katalog spesifikasi satwa hidup dengan taksonomi latin ilmiah, daerah asal persebaran, karakter jinak, dan garansi hidup.',
    icon: PawPrint,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
    examples: 'Reptil Eksotis, Nano Aquascape, Ikan Hias, Mamalia Kecil'
  },
  {
    id: 'plant',
    name: 'Tanaman & Florist',
    tagline: 'Tanaman Hias, Aroid, Sukulen & Florist',
    description: 'Etalase botani dengan panduan kebutuhan cahaya matahari, frekuensi penyiraman berkala, dan nama latin ilmiah tanaman.',
    icon: Leaf,
    color: '#16a34a',
    bgColor: 'rgba(22, 163, 74, 0.1)',
    borderColor: 'rgba(22, 163, 74, 0.25)',
    examples: 'Monstera Variegata, Sansevieria, Philodendron, Sukulen'
  },
  {
    id: 'property',
    name: 'Listing Properti',
    tagline: 'Rumah Tinggal, Ruko, Tanah Kavling & Villa',
    description: 'Katalog properti dengan status transaksi (Jual / Sewa), legalitas sertifikat resmi (SHM/HGB), serta luas tanah & bangunan terverifikasi.',
    icon: Building2,
    color: '#0d9488',
    bgColor: 'rgba(13, 148, 136, 0.1)',
    borderColor: 'rgba(13, 148, 136, 0.25)',
    examples: 'Rumah Cluster, Ruko Komersial, Tanah Kavling, Paviliun'
  }
];

export const LANDING_FAQS = [
  {
    q: 'Apakah saya perlu menyewa hosting atau membeli domain terpisah?',
    a: 'Tidak perlu sama sekali! Catavor adalah platform SaaS lengkap. Begitu Anda mendaftar, link katalog Anda langsung aktif seketika (contoh: catavor.com/nama-usaha) di atas infrastruktur cloud kami yang cepat dan aman tanpa biaya server tambahan.'
  },
  {
    q: 'Bagaimana alur pelanggan memesan produk di katalog saya?',
    a: 'Pelanggan cukup membuka link katalog Anda di tablet, ponsel, atau komputer, memilih produk yang disukai, lalu menekan tombol "Pesan via WhatsApp". Sistem kami secara otomatis membuat draf pesan WhatsApp yang terstruktur rapi per kategori produk (berisi nama produk, harga, varian, dan catatan) sehingga penjual bisa langsung memproses pesanan dengan cepat.'
  },
  {
    q: 'Apa itu fitur Rekber Syariah di platform Catavor?',
    a: 'Rekber Syariah adalah fasilitas Rekening Bersama berprinsip Syariah untuk menjembatani transaksi yang aman, adil, dan transparan antara pembeli dan penjual. Dana pembeli diamankan terlebih dahulu hingga produk atau layanan diterima dengan baik tanpa ada unsur riba maupun manipulasi.'
  },
  {
    q: 'Apakah ada potongan komisi atau biaya transaksi per penjualan?',
    a: '0% Komisi! Catavor tidak memotong sepeser pun dari nominal penjualan Anda. Seluruh pembayaran dari pembeli dan data pelanggan 100% menjadi milik Anda seutuhnya.'
  },
  {
    q: 'Apa keunggulan 7 format katalog di Catavor dibanding biolink biasa?',
    a: 'Biolink biasa hanya berupa daftar tautan teks statis. Catavor menyediakan formulir atribut khusus sesuai industrinya: bobot & bahan untuk barang fisik, masa simpan & suhu untuk kuliner, durasi pengerjaan untuk jasa, spesifikasi file & lisensi untuk produk digital, taksonomi latin untuk hewan & tanaman hias, serta legalitas sertifikat & luas tanah/bangunan untuk properti.'
  },
  {
    q: 'Apakah saya bisa mengubah foto, harga, atau menambah produk kapan saja?',
    a: 'Tentu! Anda memiliki akses penuh ke Dashboard Admin. Anda dapat menambah item baru, mengedit harga promo, mengganti foto produk (dengan kompresi WebP otomatis), hingga mengatur jam operasional toko langsung dari ponsel, tablet, maupun laptop dalam hitungan detik.'
  }
];

export interface TabletPublicLandingProps {
  onSelectStore: (slug: string) => void;
  onOpenLogin: () => void;
  currentUser: any;
}

export const TabletPublicLanding: React.FC<TabletPublicLandingProps> = ({
  onSelectStore,
  onOpenLogin,
  currentUser
}) => {
  const [featuredStores, setFeaturedStores] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedCatalogFormat, setSelectedCatalogFormat] = useState<string>('physical');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanTab, setSelectedPlanTab] = useState<'free' | 'pro_starter' | 'pro_business'>('pro_starter');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [showFloatingMenu, setShowFloatingMenu] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('direktori-toko');
  const pillRailRef = React.useRef<HTMLDivElement>(null);

  const SECTION_NAV_ITEMS = [
    {
      id: 'direktori-toko',
      label: 'Direktori Toko',
      shortLabel: 'Direktori',
      icon: StoreIcon,
      badge: 'Katalog',
      subtitle: '5 Toko Aktif'
    },
    {
      id: 'format-katalog',
      label: '7 Format Spesifik',
      shortLabel: '7 Format',
      icon: Layers,
      badge: 'Industri',
      subtitle: 'Multi-Format'
    },
    {
      id: 'keunggulan',
      label: 'Keunggulan',
      shortLabel: 'Keunggulan',
      icon: Sparkles,
      badge: 'Fitur',
      subtitle: '0% Komisi'
    },
    {
      id: 'rekber-syariah',
      label: 'Rekber Syariah',
      shortLabel: 'Rekber Aman',
      icon: ShieldCheck,
      badge: 'Escrow',
      subtitle: '100% Bebas Riba'
    },
    {
      id: 'paket-harga',
      label: 'Pilihan Paket',
      shortLabel: 'Pilihan Paket',
      icon: Scale,
      badge: 'Biaya',
      subtitle: 'Gratis & Pro'
    },
    {
      id: 'faq',
      label: 'Tanya Jawab',
      shortLabel: 'Bantuan',
      icon: HelpCircle,
      badge: 'FAQ',
      subtitle: 'Pusat Bantuan'
    }
  ];

  // Dynamic Tablet Width State: Mini (<880px) vs Large (>=880px)
  const [isMiniTablet, setIsMiniTablet] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 880;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMiniTablet(window.innerWidth < 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-time Scrollspy Tracking for Sticky Section Navigation
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140; // 68px header + ~52px floating nav + buffer
      const sectionIds = ['direktori-toko', 'format-katalog', 'keunggulan', 'rekber-syariah', 'paket-harga', 'faq'];

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll active pill into view safely on Tablet Mini without clipping left edge
  useEffect(() => {
    if (pillRailRef.current && isMiniTablet && showFloatingMenu) {
      const container = pillRailRef.current;
      const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        if (activeSection === 'direktori-toko') {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          const elLeft = activeEl.offsetLeft;
          const elWidth = activeEl.offsetWidth;
          const containerWidth = container.clientWidth;
          const targetScroll = Math.max(0, elLeft - (containerWidth / 2) + (elWidth / 2));
          container.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      }
    }
  }, [activeSection, isMiniTablet, showFloatingMenu]);

  const handleScrollTo = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      const headerOffset = 132; // 68px header + 52px floating bar + 12px padding
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setActiveSection(sectionId);
    }
  };

  const industries = [
    { id: 'all', label: 'Semua' },
    { id: 'physical', label: 'Barang Fisik' },
    { id: 'food', label: 'Kuliner' },
    { id: 'service', label: 'Jasa' },
    { id: 'digital', label: 'Digital' },
    { id: 'fauna', label: 'Satwa' },
    { id: 'plant', label: 'Tanaman' },
    { id: 'property', label: 'Properti' }
  ];

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/stores/featured');
        if (res.ok) {
          const json = await res.json();
          setFeaturedStores(json.data || json.stores || []);
        }
      } catch {
        // safe fallback
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const filteredStores = featuredStores.filter(st => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (st.name && st.name.toLowerCase().includes(q)) ||
      (st.store_title && st.store_title.toLowerCase().includes(q)) ||
      (st.slug && st.slug.toLowerCase().includes(q)) ||
      (st.slogan && st.slogan.toLowerCase().includes(q)) ||
      (st.store_slogan && st.store_slogan.toLowerCase().includes(q));

    const matchIndustry = selectedIndustry === 'all' || st.industry === selectedIndustry;
    return matchSearch && matchIndustry;
  });

  const activeFormatData = CATALOG_TYPES_INFO.find(cat => cat.id === selectedCatalogFormat) || CATALOG_TYPES_INFO[0];
  const FormatIcon = activeFormatData.icon;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      {/* 1. TABLET ADAPTIVE HEADER */}
      <header style={{
        height: '68px',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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
            fontWeight: 900,
            fontSize: '1.15rem'
          }}>
            C
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Catavor
            </div>
            {!isMiniTablet && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Platform Ekosistem Katalog Digital
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setShowFloatingMenu(!showFloatingMenu)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.65rem',
              border: showFloatingMenu ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
              backgroundColor: showFloatingMenu ? 'rgba(30, 58, 138, 0.08)' : 'var(--bg-deep)',
              color: showFloatingMenu ? 'var(--primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title={showFloatingMenu ? 'Tutup Menu Navigasi' : 'Buka Menu Navigasi'}
          >
            {showFloatingMenu ? <X size={18} /> : <Menu size={18} />}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => window.location.href = '/admin?view=tablet'}
              style={{
                minHeight: '40px',
                padding: '0 1.15rem',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                border: 'none',
                boxShadow: 'var(--shadow-premium)'
              }}
            >
              <StoreIcon size={15} />
              <span>Dashboard Toko</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              style={{
                minHeight: '40px',
                padding: '0 1.15rem',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: 'var(--shadow-premium)'
              }}
            >
              <LogIn size={15} />
              <span>Masuk / Buat Katalog</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. FLOATING STICKY SUB-NAVIGATION BAR (Muncul & Mengambang, Hilang Total Tanpa Space Kosong Saat Ditutup) */}
      {showFloatingMenu && (
        <nav
          aria-label="Navigasi Seksi Halaman"
          style={{
            position: 'sticky',
            top: '68px',
            zIndex: 45,
            backgroundColor: 'var(--bg-card)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-light)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            padding: isMiniTablet ? '0.65rem 1.25rem' : '0.7rem 2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMiniTablet ? 'flex-start' : 'space-between',
            gap: '0.85rem',
            boxSizing: 'border-box',
            width: '100%',
            transition: 'all 0.2s ease'
          }}
        >
          {/* On Tablet Lebar: Contextual Status Information */}
          {!isMiniTablet && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(30, 58, 138, 0.08)',
                color: 'var(--primary)',
                fontSize: '0.72rem',
                fontWeight: 800,
                border: '1px solid var(--border-light)'
              }}>
                <Compass size={13} />
                <span>JELAJAHI</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Melihat:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {SECTION_NAV_ITEMS.find(s => s.id === activeSection)?.label || 'Direktori Toko'}
                </strong>
                <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>•</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  {SECTION_NAV_ITEMS.find(s => s.id === activeSection)?.subtitle || 'Etalase'}
                </span>
              </div>
            </div>
          )}

          {/* Scrollable Pill Container (Supports smooth thumb swipe on mini tablet with generous padding) */}
          <div
            ref={pillRailRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '0.2rem 0.25rem',
              flex: 1,
              minWidth: 0
            }}
          >
            {SECTION_NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={(e) => handleScrollTo(e, item.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: isMiniTablet ? '0.48rem 1rem' : '0.52rem 1.2rem',
                    borderRadius: '999px',
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-deep)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    border: isActive ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                    textDecoration: 'none',
                    fontSize: isMiniTablet ? '0.78rem' : '0.82rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isActive ? '0 2px 10px var(--primary-glow)' : 'none',
                    flexShrink: 0
                  }}
                >
                  <Icon size={15} color={isActive ? '#ffffff' : 'var(--primary)'} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '0.12rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      marginLeft: '0.2rem'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </nav>
      )}

      {/* 2. TABLET HERO SECTION (Scaled for Mini vs Large) */}
      <section style={{
        padding: isMiniTablet ? '2.5rem 1.25rem 2rem 1.25rem' : '3.5rem 2rem 2.75rem 2rem',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.85rem',
          borderRadius: '999px',
          backgroundColor: 'rgba(30, 58, 138, 0.08)',
          border: '1px solid var(--border-light)',
          color: 'var(--primary)',
          fontSize: isMiniTablet ? '0.76rem' : '0.82rem',
          fontWeight: 700,
          marginBottom: '1rem'
        }}>
          <Sparkles size={14} />
          Katalog Digital &amp; Biolink Usaha Mandiri
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: isMiniTablet ? '2rem' : '2.5rem',
          fontWeight: 900,
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.22,
          margin: '0 auto 1rem auto',
          maxWidth: '820px'
        }}>
          Katalog Interaktif untuk <span style={{ color: 'var(--primary)' }}>Segala Jenis Usaha</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: isMiniTablet ? '0.92rem' : '1.02rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 1.75rem auto'
        }}>
          Gantikan buku menu fisik atau PDF kaku dengan link katalog web responsif yang terhubung langsung ke WhatsApp tanpa potongan komisi.
        </p>

        {/* Value Pills Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.45rem',
          marginBottom: '2rem'
        }}>
          {[
            { icon: Zap, label: '60 Detik Siap', color: 'var(--primary)' },
            { icon: Layers, label: '7 Format Spesifik', color: 'var(--primary)' },
            { icon: MessageCircle, label: 'WhatsApp Direct', color: '#10b981' },
            { icon: ShieldCheck, label: 'Rekber Syariah', color: 'var(--primary)' },
            { icon: Scale, label: '0% Komisi', color: 'var(--primary)' }
          ].map((pill, idx) => {
            const Icon = pill.icon;
            return (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                <Icon size={13} color={pill.color} />
                <span>{pill.label}</span>
              </span>
            );
          })}
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          flexDirection: isMiniTablet ? 'column' : 'row',
          maxWidth: isMiniTablet ? '380px' : 'none',
          margin: '0 auto'
        }}>
          <button
            type="button"
            onClick={onOpenLogin}
            style={{
              minHeight: '46px',
              padding: '0 1.5rem',
              borderRadius: '0.7rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-premium)'
            }}
          >
            <span>Mulai Buat Katalog — Gratis</span>
            <ArrowRight size={17} />
          </button>
          <a
            href="#format-katalog"
            style={{
              minHeight: '46px',
              padding: '0 1.35rem',
              borderRadius: '0.7rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none'
            }}
          >
            <span>Lihat 7 Tipe Katalog</span>
          </a>
        </div>
      </section>

      {/* 3. DIREKTORI TOKO TERVERIFIKASI & PENCARIAN (Adaptive Grid) */}
      <section id="direktori-toko" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light)',
          padding: isMiniTablet ? '1.5rem 1.25rem' : '2rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: isMiniTablet ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMiniTablet ? 'flex-start' : 'flex-end',
            gap: isMiniTablet ? '0.35rem' : '0',
            marginBottom: '1.25rem'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Eksplorasi Bisnis
              </div>
              <h2 style={{ fontSize: isMiniTablet ? '1.25rem' : '1.45rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0 0 0' }}>
                Direktori Toko &amp; Etalase Aktif
              </h2>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Menampilkan <strong>{filteredStores.length}</strong> toko terkurasi
            </div>
          </div>

          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.65rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'var(--bg-deep)',
            border: '1px solid var(--border-light)',
            marginBottom: '0.85rem'
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Cari nama usaha, produk, atau username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Industry Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {industries.map(ind => (
              <button
                key={ind.id}
                type="button"
                onClick={() => setSelectedIndustry(ind.id)}
                style={{
                  minHeight: '34px',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  border: selectedIndustry === ind.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: selectedIndustry === ind.id ? 'var(--primary)' : 'transparent',
                  color: selectedIndustry === ind.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {ind.label}
              </button>
            ))}
          </div>

          {/* Stores Grid: 1-Column on Mini Tablet, 2-Column on Large Tablet */}
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Memuat data direktori toko...
            </div>
          ) : filteredStores.length === 0 ? (
            <div style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-deep)',
              borderRadius: '0.85rem',
              border: '1px dashed var(--border-light)'
            }}>
              <StoreIcon size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tidak Ada Toko yang Cocok
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Silakan ubah kata kunci atau pilih kategori lain.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(2, 1fr)',
              gap: '0.85rem'
            }}>
              {filteredStores.map(st => {
                const title = st.store_title || st.name || 'Toko Resmi';
                const slogan = st.store_slogan || st.slogan || 'Katalog resmi terverifikasi di Catavor';
                return (
                  <div
                    key={st.id}
                    onClick={() => onSelectStore(st.slug)}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.8rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.65rem',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {st.logo_url ? (
                          <img src={st.logo_url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <StoreIcon size={20} color="var(--primary)" />
                        )}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <h3 style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {title}
                          </h3>
                          <CheckCircle size={13} color="#10b981" style={{ flexShrink: 0 }} />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                          catavor.com/{st.slug}
                        </div>
                      </div>
                    </div>

                    <p style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {slogan}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.55rem',
                      borderTop: '1px solid var(--border-light)',
                      fontSize: '0.75rem'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>Buka Etalase</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        Lihat Produk &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. 7 SPESIALISASI FORMAT KATALOG (Mini: Top Tabs + Card / Large: Split Master-Detail) */}
      <section id="format-katalog" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Solusi Multi-Industri
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            7 Format Spesialisasi Katalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.5 }}>
            Setiap jenis usaha memiliki formulir atribut khusus yang relevan dengan spesifikasi teknis produk atau layanan Anda.
          </p>
        </div>

        {/* Mini Tablet: Horizontal Scrollable Selector + Full Card */}
        {isMiniTablet ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Scrollable Pill Bar */}
            <div style={{
              display: 'flex',
              gap: '0.45rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem',
              scrollbarWidth: 'none'
            }}>
              {CATALOG_TYPES_INFO.map(cat => {
                const isSelected = selectedCatalogFormat === cat.id;
                const IconCmp = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCatalogFormat(cat.id)}
                    style={{
                      padding: '0.55rem 0.85rem',
                      borderRadius: '0.65rem',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <IconCmp size={15} color={isSelected ? '#ffffff' : cat.color} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Card Content */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-premium)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '0.75rem',
                  backgroundColor: activeFormatData.bgColor,
                  border: `1px solid ${activeFormatData.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activeFormatData.color,
                  flexShrink: 0
                }}>
                  <FormatIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    {activeFormatData.name}
                  </h3>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: activeFormatData.color }}>
                    {activeFormatData.tagline}
                  </div>
                </div>
              </div>

              <div style={{
                padding: '0.95rem',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--bg-deep)',
                border: '1px solid var(--border-light)',
                marginBottom: '1.25rem',
                fontSize: '0.84rem',
                lineHeight: 1.55,
                color: 'var(--text-secondary)'
              }}>
                {activeFormatData.description}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Contoh Penggunaan:
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeFormatData.examples}
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <span>Pilih Format Ini</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* Large Tablet: Master-Detail Split View */
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light)',
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-premium)'
          }}>
            {/* Left: Selector List */}
            <div style={{
              padding: '1.25rem',
              borderRight: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              {CATALOG_TYPES_INFO.map(cat => {
                const IconCmp = cat.icon;
                const isSelected = selectedCatalogFormat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCatalogFormat(cat.id)}
                    style={{
                      padding: '0.7rem 0.85rem',
                      borderRadius: '0.75rem',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--bg-card)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '0.55rem',
                      backgroundColor: cat.bgColor,
                      border: `1px solid ${cat.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: cat.color,
                      flexShrink: 0
                    }}>
                      <IconCmp size={17} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.tagline}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Format Detail Preview */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '0.85rem',
                    backgroundColor: activeFormatData.bgColor,
                    border: `1px solid ${activeFormatData.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: activeFormatData.color
                  }}>
                    <FormatIcon size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                      {activeFormatData.name}
                    </h3>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: activeFormatData.color }}>
                      {activeFormatData.tagline}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '1.15rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  marginBottom: '1.5rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)'
                }}>
                  {activeFormatData.description}
                </div>

                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Contoh Penggunaan Industri:
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeFormatData.examples}
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Siap didaftarkan tanpa biaya komisi
                </span>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  style={{
                    minHeight: '40px',
                    padding: '0 1.25rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <span>Pilih Format Ini</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. KEUNGGULAN UTAMA (Mini: 2-Col / Large: 3-Col) */}
      <section id="keunggulan" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Mengapa Catavor?
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            Keunggulan Platform Ekosistem
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: isMiniTablet ? '0.75rem' : '1.15rem'
        }}>
          {[
            { icon: Layers, title: '7 Format Spesifik', desc: 'Formulir spesifik untuk barang, kuliner, jasa, flora, fauna, digital & properti.', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
            { icon: MessageCircle, title: 'Pesanan WhatsApp', desc: 'Format chat rapi otomatis berisi nama produk, rincian varian & harga siap proses.', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
            { icon: Palette, title: 'Kustomisasi Tema', desc: '8 pilihan tema warna dinamis etalase toko, logo usaha, dan banner sampul.', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
            { icon: PackageCheck, title: 'Dashboard Multi-Item', desc: 'Kelola stok, kategori, tiket CS, dan kompresi foto WebP dari satu panel kontrol.', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
            { icon: ShieldCheck, title: '0% Biaya Komisi', desc: 'Seluruh keuntungan penjualan dari pembeli 100% menjadi hak milik pengelola usaha.', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)' },
            { icon: Globe, title: 'Biolink Toko Mandiri', desc: 'Alamat katalog kustom (catavor.com/nama-usaha) super cepat dan ramah sentuh.', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)' }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                style={{
                  padding: isMiniTablet ? '1.15rem' : '1.35rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.65rem',
                  backgroundColor: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color
                }}>
                  <Icon size={18} />
                </div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. ALUR 3 LANGKAH (Mini: Vertical Stack / Large: 3-Col Horizontal) */}
      <section style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Alur Pembuatan
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            3 Langkah Mudah Memulai
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(3, 1fr)',
          gap: '0.85rem'
        }}>
          {[
            { step: '1', title: 'Klaim Tautan Katalog', desc: 'Daftar akun gratis & klaim link unik usaha Anda di catavor.com/namabisnis.' },
            { step: '2', title: 'Upload Foto & Atur Harga', desc: 'Unggah produk, tentukan varian harga, spesifikasi, dan jadwal operasional.' },
            { step: '3', title: 'Bagikan & Terima Order', desc: 'Pasang link di bio media sosial & terima pesanan WhatsApp atau opsi Rekber.' }
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '1.25rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                gap: '0.85rem',
                alignItems: isMiniTablet ? 'center' : 'flex-start',
                flexDirection: isMiniTablet ? 'row' : 'column'
              }}
            >
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {item.step}
              </div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. MITRA RESMI REKBER SYARIAH (Mini: 2x2 Grid / Large: 4-Col Grid) */}
      <section id="rekber-syariah" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.25rem',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          padding: isMiniTablet ? '1.5rem 1.25rem' : '2rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                fontSize: '0.72rem',
                fontWeight: 700,
                marginBottom: '0.5rem'
              }}>
                <ShieldCheck size={13} />
                Kemitraan Resmi &amp; Escrow Terpercaya
              </div>
              <h2 style={{ fontSize: isMiniTablet ? '1.35rem' : '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Belanja Tenang Bersama <span style={{ color: 'var(--primary)' }}>Rekber Syariah</span>
              </h2>
            </div>

            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '0.15rem 0.55rem',
              borderRadius: '999px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              100% BEBAS RIBA
            </span>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 1.5rem 0' }}>
            Platform Catavor bekerja sama resmi dengan <strong>Rekber Syariah</strong> (rekbersyariah.com) untuk proteksi transaksi anti-penipuan. Dana pembeli diamankan di rekening escrow resmi hingga barang diterima dengan baik.
          </p>

          {/* 4 Steps Grid: 2x2 on Mini Tablet, 4-Col on Large Tablet */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMiniTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            {[
              { step: '1', title: 'Pilih Produk', desc: 'Klik tombol Rekber di katalog toko.' },
              { step: '2', title: 'Grup WA 3 Pihak', desc: 'Admin membuat grup Pembeli & Penjual.' },
              { step: '3', title: 'Transfer & Kirim', desc: 'Pembeli transfer escrow, penjual kirim.' },
              { step: '4', title: 'Verifikasi & Cair', desc: 'Barang aman, dana langsung dicairkan.', isGreen: true }
            ].map((stepItem, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  backgroundColor: stepItem.isGreen ? '#10b981' : 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.4rem'
                }}>
                  {stepItem.step}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                  {stepItem.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {stepItem.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div style={{
            display: 'flex',
            flexDirection: isMiniTablet ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMiniTablet ? 'flex-start' : 'center',
            gap: isMiniTablet ? '0.75rem' : '0',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              WhatsApp Admin Resmi: <strong>+62 811-220-227</strong>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', width: isMiniTablet ? '100%' : 'auto' }}>
              <a
                href="https://rekbersyariah.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: isMiniTablet ? 1 : 'none',
                  minHeight: '38px',
                  padding: '0 0.85rem',
                  borderRadius: '0.6rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  textDecoration: 'none'
                }}
              >
                <span>Situs Mitra</span>
                <ExternalLink size={13} />
              </a>
              <a
                href="https://wa.me/62811220227?text=Halo%20Admin%20Rekber%20Syariah,%20saya%20ingin%20berkonsultasi%20mengenai%20transaksi%20melalui%20Catavor."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: isMiniTablet ? 1 : 'none',
                  minHeight: '38px',
                  padding: '0 1rem',
                  borderRadius: '0.6rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none'
                }}
              >
                <MessageCircle size={14} />
                <span>Chat Rekber</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 8. PAKET BISNIS (Mini: Tabbed Focused Switcher / Large: 3-Col Side by Side) */}
      <section id="paket-harga" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pilihan Paket Berlangganan
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            Skalabilitas Sesuai Kebutuhan
          </h2>

          {/* Billing Cycle Toggle */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            marginTop: '0.85rem'
          }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Tahunan (-20%)
            </button>
          </div>
        </div>

        {/* Mini Tablet: Interactive Focused Plan Switcher */}
        {isMiniTablet ? (
          <div>
            {/* Plan Switcher Pills */}
            <div style={{
              display: 'flex',
              padding: '0.3rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              marginBottom: '1rem',
              gap: '0.3rem'
            }}>
              {[
                { id: 'free', label: 'Gratis' },
                { id: 'pro_starter', label: 'Pro Starter ⭐' },
                { id: 'pro_business', label: 'Pro Bisnis 👑' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedPlanTab(tab.id as any)}
                  style={{
                    flex: 1,
                    minHeight: '38px',
                    borderRadius: '0.55rem',
                    border: 'none',
                    backgroundColor: selectedPlanTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: selectedPlanTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Focused Active Card */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '1rem',
              backgroundColor: 'var(--bg-card)',
              border: selectedPlanTab === 'pro_starter' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-premium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {selectedPlanTab === 'free' && (
                <>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Gratis (Free)
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      Rp 0 <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ selamanya</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Mulai tanpa biaya untuk katalog dasar
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#10b981" /> 15 item produk aktif
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#10b981" /> 100 MB Cloud Storage
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#10b981" /> WhatsApp Direct Order
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#10b981" /> Download QR Code Toko
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    style={{
                      width: '100%',
                      minHeight: '42px',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Mulai Gratis Sekarang
                  </button>
                </>
              )}

              {selectedPlanTab === 'pro_starter' && (
                <>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                        Pro Starter
                      </span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, backgroundColor: 'var(--primary)', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        POPULER
                      </span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      {billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 25.000'}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}> /bln</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Pilihan paling tepat untuk katalog toko berkembang
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Zap size={15} color="var(--primary)" /> <strong>150 item produk aktif</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Zap size={15} color="var(--primary)" /> <strong>2 GB Cloud Storage</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Zap size={15} color="var(--primary)" /> Lencana Toko Terverifikasi
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Zap size={15} color="var(--primary)" /> 100% Bebas Watermark
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    style={{
                      width: '100%',
                      minHeight: '42px',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--primary)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Pilih Pro Starter
                  </button>
                </>
              )}

              {selectedPlanTab === 'pro_business' && (
                <>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                      Pro Bisnis
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      {billingCycle === 'monthly' ? 'Rp 129.000' : 'Rp 107.500'}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}> /bln</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Kapasitas maksimal untuk skala bisnis besar
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#f59e0b" /> <strong>Unlimited Produk &amp; Jasa</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#f59e0b" /> <strong>10 GB Cloud Storage</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#f59e0b" /> Custom Domain (brand.com)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={15} color="#f59e0b" /> Prioritas VIP Support 24/7
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    style={{
                      width: '100%',
                      minHeight: '42px',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Pilih Pro Bisnis
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Large Tablet: 3 Cards Side by Side */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.15rem'
          }}>
            {/* Free */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '1.15rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.15rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Gratis (Free)
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                  Rp 0
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Aktif selamanya tanpa biaya bulanan
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#10b981" /> 15 item produk aktif
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#10b981" /> 100 MB Cloud Storage
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#10b981" /> WhatsApp Direct Order
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#10b981" /> Download QR Code Toko
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Mulai Gratis
              </button>
            </div>

            {/* Pro Starter */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '1.15rem',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--primary)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.15rem',
              position: 'relative',
              boxShadow: 'var(--shadow-premium)'
            }}>
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '16px',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px'
              }}>
                POPULER
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Pro Starter
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                  {billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 25.000'}
                  <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}> /bln</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Cocok untuk katalog berkembang
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={15} color="var(--primary)" /> <strong>150 item produk aktif</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={15} color="var(--primary)" /> <strong>2 GB Cloud Storage</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={15} color="var(--primary)" /> Lencana Terverifikasi
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={15} color="var(--primary)" /> 100% Bebas Watermark
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Pilih Pro Starter
              </button>
            </div>

            {/* Pro Bisnis */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '1.15rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.15rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                  Pro Bisnis
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                  {billingCycle === 'monthly' ? 'Rp 129.000' : 'Rp 107.500'}
                  <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}> /bln</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Kapasitas skala besar
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#f59e0b" /> <strong>Unlimited Produk &amp; Jasa</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#f59e0b" /> <strong>10 GB Cloud Storage</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#f59e0b" /> Custom Domain (brand.com)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} color="#f59e0b" /> Prioritas VIP Support 24/7
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Pilih Pro Bisnis
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 9. FAQ ACCORDION (Pusat Bantuan & Pertanyaan Umum) */}
      <section id="faq" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pertanyaan Umum
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            Hal yang Sering Ditanyakan
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {LANDING_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  style={{
                    padding: isMiniTablet ? '1rem' : '1.15rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, paddingRight: '0.75rem' }}>
                    {faq.q}
                  </h4>
                  <ChevronDown
                    size={17}
                    style={{
                      color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0
                    }}
                  />
                </div>

                {isOpen && (
                  <div style={{
                    padding: isMiniTablet ? '0 1rem 1rem 1rem' : '0 1.25rem 1.15rem 1.25rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '0.75rem'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 10. BOTTOM BANNER PERSUASIF */}
      <section style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          padding: isMiniTablet ? '2rem 1.5rem' : '2.75rem 2.25rem',
          borderRadius: '1.15rem',
          backgroundColor: 'var(--primary)',
          color: '#ffffff',
          textAlign: 'center',
          boxShadow: 'var(--shadow-premium)'
        }}>
          <h3 style={{ fontSize: isMiniTablet ? '1.45rem' : '1.75rem', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Mulai Digitalisasi Katalog Usaha Anda
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', margin: '0 auto 1.5rem auto', maxWidth: '540px', lineHeight: 1.5 }}>
            Buat katalog digital interaktif profesional Anda dalam 60 detik. Gratis selamanya tanpa potongan komisi.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            style={{
              minHeight: '44px',
              padding: '0 1.5rem',
              borderRadius: '0.65rem',
              backgroundColor: '#ffffff',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <span>Buat Katalog Sekarang</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* 11. FOOTER RESMI PLATFORM (Adaptive 2-Col or 3-Col) */}
      <footer style={{
        marginTop: 'auto',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-light)',
        padding: isMiniTablet ? '2.25rem 1.25rem 1.75rem 1.25rem' : '3rem 2rem 2rem 2rem'
      }}>
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr 1fr' : '2fr 1fr 1fr',
          gap: isMiniTablet ? '1.5rem' : '2.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ gridColumn: isMiniTablet ? 'span 2' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(30, 58, 138, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontWeight: 900
              }}>
                C
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                Catavor
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0, maxWidth: '380px' }}>
              Platform ekosistem katalog digital dan biolink usaha mandiri terintegrasi pesan WhatsApp dan mitra resmi Rekber Syariah anti-penipuan.
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
              Navigasi Cepat
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem' }}>
              <a href="#direktori-toko" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Direktori Toko</a>
              <a href="#format-katalog" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>7 Format Spesialisasi</a>
              <a href="#keunggulan" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Keunggulan Platform</a>
              <a href="#rekber-syariah" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Rekber Syariah</a>
              <a href="#paket-harga" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Paket Berlangganan</a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
              Legal &amp; Layanan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Syarat &amp; Ketentuan</span>
              <span style={{ color: 'var(--text-secondary)' }}>Kebijakan Privasi</span>
              <span style={{ color: 'var(--text-secondary)' }}>Kebijakan Penggunaan</span>
              <span style={{ color: 'var(--text-secondary)' }}>Bantuan CS WhatsApp</span>
            </div>
          </div>
        </div>

        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
          fontSize: '0.74rem',
          color: 'var(--text-muted)'
        }}>
          &copy; {new Date().getFullYear()} Catavor. Platform Katalog Digital &amp; Biolink Usaha Terpercaya. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default TabletPublicLanding;
