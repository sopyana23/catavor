import React, { useState, useEffect, useRef } from 'react';
import {
  Store as StoreIcon,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
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
  CheckCheck,
  X,
  BadgeCheck,
  HelpCircle,
  Menu,
  Compass
} from 'lucide-react';

import { TabletPoliciesView } from './TabletPoliciesView';

export const CATALOG_TYPES_INFO = [
  {
    id: 'physical',
    name: 'Barang Fisik',
    tagline: 'Fesyen, Kerajinan, Aksesori, & Kebutuhan Harian',
    description: 'Formulir terstruktur khusus produk nyata dengan rincian merek, bahan/material, bobot pengiriman (gram), serta opsi varian ukuran/warna.',
    icon: Package,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.25)',
    examples: 'Pakaian, Sepatu, Tas, Perhiasan, Kerajinan Tangan'
  },
  {
    id: 'food',
    name: 'Kuliner & F&B',
    tagline: 'Restoran, Kafe, Bakery, Katering & Minuman',
    description: 'Buku menu digital interaktif dengan rincian masa simpan (expired date), temperatur penyimpanan, level varian/rasa, dan catatan pesan antar.',
    icon: Utensils,
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.1)',
    borderColor: 'rgba(234, 88, 12, 0.25)',
    examples: 'Kopi Artisan, Pastry, Makanan Siap Saji, Katering'
  },
  {
    id: 'service',
    name: 'Jasa & Layanan',
    tagline: 'Barbershop, Studio Foto, Salon, Konsultan & Reparasi',
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
    tagline: 'Template Desain, Spreadsheet, E-Book & Software',
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
    tagline: 'Aquascape, Ikan Hias, Reptil, Burung & Pet Shop',
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
    tagline: 'Tanaman Hias, Aroid, Sukulen, Florist & Perkebunan',
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
    tagline: 'Rumah Tinggal, Ruko, Tanah Kavling, Villa & Sewa',
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
    a: 'Pelanggan cukup membuka link katalog Anda di ponsel atau komputer, memilih produk yang disukai, lalu menekan tombol "Pesan via WhatsApp". Sistem kami secara otomatis membuat draf pesan WhatsApp yang terstruktur rapi per kategori produk (berisi nama produk, harga, varian, dan catatan) sehingga penjual bisa langsung memproses pesanan dengan cepat.'
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
    a: 'Biolink biasa hanya berupa daftar link teks statis. Catavor menyediakan formulir atribut khusus sesuai industrinya: bobot & bahan untuk barang fisik, masa simpan & suhu untuk kuliner, durasi pengerjaan untuk jasa, spesifikasi file & lisensi untuk produk digital, taksonomi latin untuk hewan & tanaman hias, serta legalitas sertifikat & luas tanah/bangunan untuk properti.'
  },
  {
    q: 'Apakah saya bisa mengubah foto, harga, atau menambah produk kapan saja?',
    a: 'Tentu! Anda memiliki akses penuh ke Dashboard Admin. Anda dapat menambah item baru, mengedit harga promo, mengganti foto produk (dengan kompresi WebP otomatis), hingga mengatur jam operasional toko langsung dari ponsel maupun laptop dalam hitungan detik.'
  }
];

export interface TabletPublicLandingProps {
  onSelectStore?: (slug: string) => void;
  onOpenLogin: () => void;
  currentUser: any;
}

export const TabletPublicLanding: React.FC<TabletPublicLandingProps> = ({
  onOpenLogin,
  currentUser
}) => {
  const [selectedCatalogFormat, setSelectedCatalogFormat] = useState<string>('physical');
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanTab, setSelectedPlanTab] = useState<'free' | 'pro_starter' | 'pro_business'>('pro_starter');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('catalog-types');
  const pillRailRef = useRef<HTMLDivElement>(null);
  const stickyContainerRef = useRef<HTMLDivElement>(null);
  const isManualScrollRef = useRef<boolean>(false);
  const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exact 6 Canonical Sections matching Desktop and Mobile
  const SECTION_NAV_ITEMS = [
    {
      id: 'catalog-types',
      label: 'Tipe Katalog',
      shortLabel: 'Tipe',
      icon: Layers,
      badge: '7 Format',
      subtitle: 'Format Usaha'
    },
    {
      id: 'features-section',
      label: 'Keunggulan',
      shortLabel: 'Keunggulan',
      icon: Sparkles,
      badge: 'Fitur',
      subtitle: '0% Komisi'
    },
    {
      id: 'steps-section',
      label: 'Cara Kerja',
      shortLabel: 'Cara Kerja',
      icon: Compass,
      badge: '3 Langkah',
      subtitle: 'Alur Mudah'
    },
    {
      id: 'escrow-partner',
      label: 'Transaksi Aman',
      shortLabel: 'Rekber',
      icon: ShieldCheck,
      badge: 'Escrow',
      subtitle: 'Bebas Riba'
    },
    {
      id: 'pricing-section',
      label: 'Paket & Harga',
      shortLabel: 'Paket',
      icon: Scale,
      badge: 'Biaya',
      subtitle: 'Gratis & Pro'
    },
    {
      id: 'faq-section',
      label: 'FAQ',
      shortLabel: 'Bantuan',
      icon: HelpCircle,
      badge: 'FAQ',
      subtitle: 'Pusat Bantuan'
    }
  ];

  /* ---------------------------------------------------------------------
     TABLET VIEWPORT TIER SYSTEM
     Dipetakan ke lebar CSS perangkat tablet yang beredar saat ini:
       compact  : < 768px   -> tablet mini portrait (iPad mini 744, Android 600-767)
       regular  : 768-899   -> tablet portrait standar (iPad 768, iPad Air 810/820, iPad Pro 11 834)
       expanded : 900-1119  -> tablet besar portrait / landscape kecil (Surface Go 912, iPad Pro 12.9 1024)
       wide     : >= 1120   -> tablet landscape lebar (iPad Air 13 1180/1194, Surface Pro 1280/1366)
     --------------------------------------------------------------------- */
  type TabletTier = 'compact' | 'regular' | 'expanded' | 'wide';
  const resolveTier = (w: number): TabletTier => {
    if (w < 768) return 'compact';
    if (w < 900) return 'regular';
    if (w < 1120) return 'expanded';
    return 'wide';
  };

  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1024;
    return window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const tier = resolveTier(viewportWidth);
  // isMiniTablet dipertahankan sebagai alias "layout paling sempit" (compact)
  // agar seluruh pemakaian lama tetap konsisten, sementara tier baru dipakai
  // untuk keputusan grid/tipografi yang butuh pembedaan lebih rinci.
  const isMiniTablet = tier === 'compact';
  const isCompact = tier === 'compact';
  const isRegular = tier === 'regular';
  const isExpanded = tier === 'expanded';
  const isWide = tier === 'wide';
  const isExpandedPlus = isExpanded || isWide;
  // Layar sempit (di bawah tablet): CTA & pricing ditumpuk.
  // Tablet mini 744px sudah cukup lebar untuk CTA sejajar + grid harga 2 kolom.
  const isNarrow = viewportWidth < 640;
  const useTabbedPricing = isNarrow;
  // Ritme spasi vertikal antar section mengikuti tinggi layar efektif
  const sectionGap = isCompact ? '2.25rem' : isRegular ? '2.5rem' : '2.75rem';
  const sectionPadX = isCompact ? '1.25rem' : isRegular ? '1.5rem' : '1.75rem';

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
    };
  }, []);

  // Real-time Scrollspy Tracking for Sticky Section Navigation with Lock during Smooth Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isManualScrollRef.current) return;
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const headerOffset = stickyContainerRef.current ? stickyContainerRef.current.offsetHeight : 135;
      const scrollPos = currentScroll + headerOffset + 60;
      const sectionIds = ['catalog-types', 'features-section', 'steps-section', 'escrow-partner', 'pricing-section', 'faq-section'];

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const top = el.getBoundingClientRect().top + currentScroll;
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

  // Auto-scroll active pill into view smoothly without clipping edges
  useEffect(() => {
    if (pillRailRef.current && showFloatingMenu) {
      const container = pillRailRef.current;
      const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        if (activeSection === 'catalog-types') {
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
  }, [activeSection, showFloatingMenu]);

  const handleScrollTo = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      // 1. Immediately highlight target tab for immediate fluid feedback
      setActiveSection(sectionId);

      // 2. Lock scrollspy during smooth scroll to prevent intermediate tab flickering
      isManualScrollRef.current = true;
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
      manualScrollTimeoutRef.current = setTimeout(() => {
        isManualScrollRef.current = false;
      }, 750);

      // 3. Smooth scroll with exact header offset
      const headerOffset = stickyContainerRef.current ? stickyContainerRef.current.offsetHeight : 135;
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const elementTop = target.getBoundingClientRect().top + currentScroll;
      const targetPosition = Math.max(0, elementTop - headerOffset + 4);

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      try {
        window.history.pushState(null, '', `#${sectionId}`);
      } catch (_) {}
    }
  };

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
      {/* 1. TABLET UNIFIED STICKY TOP CONTAINER (Header + Floating Sub-Nav Always Floating Together) */}
      <div
        ref={stickyContainerRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          backgroundColor: 'var(--bg-card)'
        }}>
        {/* Header */}
        <header style={{
          height: isCompact ? '64px' : '72px',
          padding: isCompact ? '0 1.25rem' : isRegular ? '0 1.5rem' : '0 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: !showFloatingMenu ? '0 2px 8px rgba(0,0,0,0.03)' : 'none'
        }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{
            width: isMiniTablet ? '36px' : '40px',
            height: isMiniTablet ? '36px' : '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
          }}>
            <StoreIcon size={isMiniTablet ? 18 : 20} />
          </div>
          <div>
            <div style={{ fontSize: isMiniTablet ? '1.15rem' : '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Catavor
              <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.12rem 0.45rem', borderRadius: '999px' }}>
                COMMERCE
              </span>
            </div>
            {!isMiniTablet && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Platform Katalog Digital &amp; Biolink Usaha
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            id="tablet-toggle-floating-nav"
            type="button"
            onClick={() => setShowFloatingMenu(!showFloatingMenu)}
            style={{
              width: '44px',
              height: '44px',
              flexShrink: 0,
              borderRadius: '0.65rem',
              border: showFloatingMenu ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
              backgroundColor: showFloatingMenu ? '#eff6ff' : 'var(--bg-deep)',
              color: showFloatingMenu ? 'var(--primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title={showFloatingMenu ? 'Tutup Navigasi' : 'Buka Navigasi'}
          >
            {showFloatingMenu ? <X size={18} /> : <Menu size={18} />}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => window.location.href = '/admin?view=tablet'}
              style={{
                minHeight: '44px',
                padding: '0 1.25rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
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
                minHeight: '44px',
                padding: '0 1.25rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
              }}
            >
              <LogIn size={15} />
              <span>Masuk / Buat Katalog</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. FLOATING SUB-NAVIGATION BAR (Sticky Together with Header inside Unified Container) */}
      {showFloatingMenu && (
        <nav
          aria-label="Navigasi Seksi Halaman"
          style={{
            backgroundColor: 'var(--bg-card)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-light)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            padding: isCompact ? '0.65rem 1.25rem' : isRegular ? '0.7rem 1.5rem' : '0.8rem 2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpandedPlus ? 'space-between' : 'flex-start',
            gap: '0.85rem',
            boxSizing: 'border-box',
            width: '100%',
            transition: 'all 0.2s ease'
          }}
        >
          {/* On Tablet Lebar: Contextual Status Information */}
          {isExpandedPlus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '999px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '0.78rem',
                fontWeight: 800,
                border: '1px solid #bfdbfe'
              }}>
                <Compass size={14} />
                <span>JELAJAHI</span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Melihat:{' '}
                <strong style={{ color: 'var(--text-primary)', transition: 'color 0.25s ease' }}>
                  {SECTION_NAV_ITEMS.find(s => s.id === activeSection)?.label || 'Tipe Katalog'}
                </strong>
                <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>•</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700, transition: 'color 0.25s ease' }}>
                  {SECTION_NAV_ITEMS.find(s => s.id === activeSection)?.subtitle || 'Platform'}
                </span>
              </div>
            </div>
          )}

          {/* Scrollable Pill Container */}
          <div
            ref={pillRailRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              overflowX: 'auto',
              scrollBehavior: 'smooth',
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
                  id={`tablet-nav-pill-${item.id}`}
                  href={`#${item.id}`}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={(e) => handleScrollTo(e, item.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minHeight: '44px',
                    padding: isCompact ? '0.5rem 0.95rem' : '0.55rem 1.25rem',
                    borderRadius: '999px',
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-deep)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    border: isActive ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                    textDecoration: 'none',
                    fontSize: isMiniTablet ? '0.78rem' : '0.88rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isActive ? '0 3px 12px var(--primary-glow)' : 'none',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                    flexShrink: 0
                  }}
                >
                  <Icon
                    size={isMiniTablet ? 15 : 17}
                    color={isActive ? '#ffffff' : 'var(--primary)'}
                    style={{ transition: 'color 0.25s ease' }}
                  />
                  <span style={{ transition: 'color 0.25s ease' }}>{item.label}</span>
                  <span style={{
                    fontSize: isMiniTablet ? '0.65rem' : '0.72rem',
                    borderRadius: '999px',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                    color: '#ffffff',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    maxWidth: isActive ? '90px' : '0px',
                    padding: isActive ? '0.15rem 0.55rem' : '0',
                    marginLeft: isActive ? '0.3rem' : '0',
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'scale(1)' : 'scale(0.8)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {item.badge}
                  </span>
                </a>
              );
            })}
          </div>
        </nav>
      )}
      </div>

      {/* 3. HERO SECTION (Aligned with Desktop & Mobile) */}
      <section style={{
        padding: isCompact ? '1.75rem 1.25rem 1.5rem 1.25rem' : isRegular ? '2.25rem 1.5rem 1.85rem 1.5rem' : '2.5rem 1.75rem 2rem 1.75rem',
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}>
        {/* Pill Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: isMiniTablet ? '0.35rem 0.95rem' : '0.4rem 1.05rem',
          borderRadius: '999px',
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          fontSize: isMiniTablet ? '0.76rem' : '0.84rem',
          fontWeight: 800,
          marginBottom: '1rem',
          border: '1px solid #bfdbfe'
        }}>
          <Sparkles size={isMiniTablet ? 14 : 16} />
          <span>Platform Katalog Digital &amp; Biolink Usaha Mandiri</span>
        </div>

        {/* Main Title */}
        <h1 style={{
          fontSize: isCompact ? '1.95rem' : isRegular ? '2.3rem' : isExpanded ? '2.5rem' : 'clamp(2.6rem, 2.4vw, 2.9rem)',
          fontWeight: 900,
          lineHeight: 1.18,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          margin: '0 0 1rem 0',
          textWrap: 'balance'
        }}>
          Katalog Produk Interaktif untuk{' '}
          <span style={{ color: 'var(--primary)' }}>Segala Jenis Usaha</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: isCompact ? '0.92rem' : isRegular ? '0.95rem' : '0.98rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: isCompact ? '560px' : isRegular ? '640px' : '720px',
          margin: '0 auto 1.5rem auto'
        }}>
          Gantikan buku menu fisik dan daftar harga manual. Hadirkan website katalog modern responsif yang terhubung langsung ke WhatsApp tanpa potongan komisi.
        </p>

        {/* Value Pills Grid */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.55rem',
          marginBottom: '1.5rem'
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: isMiniTablet ? '0.38rem 0.82rem' : '0.45rem 0.95rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Zap size={15} color="var(--primary)" /> Siap dalam 60 Detik
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: isMiniTablet ? '0.38rem 0.82rem' : '0.45rem 0.95rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Layers size={15} color="var(--primary)" /> 7 Format Spesifik Usaha
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: isMiniTablet ? '0.38rem 0.82rem' : '0.45rem 0.95rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <MessageCircle size={15} color="#16a34a" /> Direct WhatsApp Order
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: isMiniTablet ? '0.38rem 0.82rem' : '0.45rem 0.95rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <ShieldCheck size={15} color="var(--primary)" /> Proteksi Rekber Syariah
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: isMiniTablet ? '0.38rem 0.82rem' : '0.45rem 0.95rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Scale size={15} color="var(--primary)" /> 0% Komisi Penjualan
          </span>
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: isNarrow ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={onOpenLogin}
            style={{
              minHeight: '44px',
              padding: isMiniTablet ? '0 1.65rem' : '0 1.85rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
              width: isNarrow ? '100%' : 'auto'
            }}
          >
            <span>Mulai Buat Katalog — Gratis</span>
            <ArrowRight size={16} />
          </button>
          <a
            href="#catalog-types"
            onClick={(e) => handleScrollTo(e, 'catalog-types')}
            style={{
              minHeight: '44px',
              padding: isMiniTablet ? '0 1.35rem' : '0 1.65rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              width: isNarrow ? '100%' : 'auto'
            }}
          >
            <span>Lihat 7 Tipe Katalog</span>
          </a>
        </div>

        {/* Target Audience Note */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.45rem 1.15rem',
          borderRadius: '999px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          fontSize: '0.82rem',
          color: 'var(--text-muted)'
        }}>
          <CheckCircle2 size={16} color="#16a34a" />
          <span>
            Didesain khusus untuk <strong>UMKM, pedagang, kreator &amp; pengelola usaha</strong> di Indonesia
          </span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1: 7 SPESIALISASI FORMAT KATALOG (#catalog-types)
          ========================================================================= */}
      <section id="catalog-types" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{ fontSize: isMiniTablet ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Spesialisasi Format
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.45rem 0', letterSpacing: '-0.02em' }}>
            7 Tipe Katalog untuk Berbagai Bidang Usaha
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMiniTablet ? '0.86rem' : '0.94rem', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
            Bukan sekadar tautan teks biasa. Setiap tipe katalog memiliki struktur formulir dan atribut khusus yang relevan dengan karakteristik produk atau layanan Anda.
          </p>
        </div>

        {/* Unified Tablet Interactive Pill Selector */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          // Tablet mini (744px) masih cukup lebar untuk wrap 2 baris — jauh lebih
          // nyaman daripada rail horizontal yang memotong label. Scroll hanya
          // dipakai untuk layar sempit non-tablet (< 600px).
          overflowX: viewportWidth < 600 ? 'auto' : 'visible',
          flexWrap: viewportWidth < 600 ? 'nowrap' : 'wrap',
          justifyContent: viewportWidth < 600 ? 'flex-start' : 'center',
          scrollbarWidth: 'none',
          paddingBottom: viewportWidth < 600 ? '0.5rem' : '0',
          marginBottom: '1rem',
          WebkitOverflowScrolling: 'touch'
        }}>
          {CATALOG_TYPES_INFO.map(cat => {
            const isSelected = selectedCatalogFormat === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatalogFormat(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  minHeight: '44px',
                  padding: isCompact ? '0.5rem 0.95rem' : '0.55rem 1.1rem',
                  borderRadius: '0.65rem',
                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 2px 8px var(--primary-glow)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} color={isSelected ? '#ffffff' : cat.color} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Focused Card - Responsive Split on Wide Tablet */}
        {isMiniTablet ? (
          /* Mini Tablet (768px): Single-Column Snug Card */
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: '1.35rem 1.25rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: activeFormatData.bgColor,
                  border: `1px solid ${activeFormatData.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activeFormatData.color
                }}>
                  <FormatIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {activeFormatData.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: activeFormatData.color, fontWeight: 700 }}>
                    {activeFormatData.tagline}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: activeFormatData.color,
                backgroundColor: activeFormatData.bgColor,
                border: `1px solid ${activeFormatData.borderColor}`,
                padding: '0.2rem 0.65rem',
                borderRadius: '999px'
              }}>
                Tipe Katalog
              </span>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-deep)',
              borderRadius: '0.75rem',
              padding: '1rem',
              border: '1px solid var(--border-light)',
              marginBottom: '0.85rem'
            }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {activeFormatData.description}
              </p>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Contoh Penggunaan:</strong> {activeFormatData.examples}
            </div>
          </div>
        ) : (
          /* Wide Tablet (>=880px): Balanced 2-Column Split Showcase Card */
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: '1.5rem 1.65rem',
            boxShadow: 'var(--shadow-premium)',
            display: 'grid',
            gridTemplateColumns: isRegular ? '300px 1fr' : '360px 1fr',
            gap: '1.5rem',
            alignItems: 'center'
          }}>
            {/* Left Column: Identity & Examples */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {activeFormatData.name}
                    </h3>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: activeFormatData.color,
                      backgroundColor: activeFormatData.bgColor,
                      border: `1px solid ${activeFormatData.borderColor}`,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px'
                    }}>
                      Tipe Katalog
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: activeFormatData.color, fontWeight: 700, marginTop: '0.15rem' }}>
                    {activeFormatData.tagline}
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-deep)',
                borderRadius: '0.75rem',
                padding: '0.75rem 0.95rem',
                border: '1px solid var(--border-light)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                  Contoh Penggunaan:
                </strong>
                <span>{activeFormatData.examples}</span>
              </div>
            </div>

            {/* Right Column: Structured Overview Panel */}
            <div style={{
              backgroundColor: 'var(--bg-deep)',
              borderRadius: '0.85rem',
              padding: '1.15rem 1.25rem',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {activeFormatData.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={15} color="#16a34a" />
                  <span>Formulir atribut industri spesifik</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <MessageCircle size={15} color="#16a34a" />
                  <span>Draf pesan WhatsApp terstruktur</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION 2: KEUNGGULAN UTAMA (#features-section)
          ========================================================================= */}
      <section id="features-section" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{ fontSize: isMiniTablet ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Keunggulan Utama
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.45rem 0', letterSpacing: '-0.02em' }}>
            Mengapa Pemilik Usaha Memilih Catavor?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMiniTablet ? '0.86rem' : '0.94rem', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
            Solusi terpadu untuk digitalisasi etalase produk, efisiensi pemesanan WhatsApp, dan branding toko fisik maupun online.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isExpandedPlus ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          gap: isMiniTablet ? '0.85rem' : '1rem'
        }}>
          {/* Card 1 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}>
              <Layers size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              7 Format Spesialisasi Produk
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Mendukung Barang Fisik, Kuliner, Jasa, Digital, Hewan, Tanaman, dan Properti dengan formulir atribut spesifik sesuai kebutuhan industri Anda.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a'
            }}>
              <MessageCircle size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Pesanan Terstruktur WhatsApp
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Tombol pesan otomatis mengisi nama produk, harga, varian, dan catatan sehingga penjual dan pembeli tidak perlu mengetik manual.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}>
              <Palette size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Kustomisasi Identitas &amp; Tema
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Sesuaikan warna tema katalog, foto profil toko, deskripsi usaha, tautan media sosial, serta jam operasional bisnis Anda.
            </p>
          </div>

          {/* Card 4 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7c3aed'
            }}>
              <PackageCheck size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Dashboard Manajemen Produk &amp; Stok
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Kelola ratusan produk, atur status ketersediaan (Tersedia, Pre-Order, Buka Jadwal), kompresi WebP otomatis, dan kelola varian dari satu panel admin terpadu.
            </p>
          </div>

          {/* Card 5 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(8, 145, 178, 0.1)',
              border: '1px solid rgba(8, 145, 178, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0891b2'
            }}>
              <ShieldCheck size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              0% Biaya Komisi Transaksi
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Seluruh hasil penjualan dari pelanggan 100% milik Anda seutuhnya. Tidak ada biaya transaksi tersembunyi per order.
            </p>
          </div>

          {/* Card 6 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(225, 29, 72, 0.1)',
              border: '1px solid rgba(225, 29, 72, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48'
            }}>
              <Globe size={20} />
            </div>
            <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Biolink Toko Mandiri Responsif
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Miliki alamat katalog web pribadi (catavor.com/nama-usaha) yang super ringan dibuka dari ponsel pelanggan dan siap dipasang di profil media sosial.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: CARA KERJA 3 LANGKAH (#steps-section)
          ========================================================================= */}
      <section id="steps-section" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{ fontSize: isMiniTablet ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kemudahan Operasional
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.45rem 0', letterSpacing: '-0.02em' }}>
            Mulai dalam 3 Langkah Sederhana
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMiniTablet ? '0.86rem' : '0.94rem', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
            Buka katalog interaktif Anda dalam hitungan menit tanpa keahlian teknis pemrograman.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isExpandedPlus ? 'repeat(3, 1fr)' : '1fr',
          gap: isCompact ? '0.85rem' : '1rem'
        }}>
          {/* Step 1 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem 1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: isRegular ? 'row' : 'column',
            alignItems: isRegular ? 'center' : 'stretch',
            gap: isRegular ? '1.25rem' : '0.85rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              flexShrink: 0,
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.05rem',
              boxShadow: '0 4px 12px var(--primary-glow)'
            }}>
              1
            </div>
            <div style={{
              display: isRegular ? 'grid' : 'block',
              gridTemplateColumns: isRegular ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : undefined,
              alignItems: 'center',
              gap: isRegular ? '1.25rem' : 0
            }}>
              <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.08rem', fontWeight: 800, margin: isRegular ? 0 : '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                Klaim Tautan &amp; Daftarkan Akun
              </h3>
              <p style={{ fontSize: isMiniTablet ? '0.82rem' : '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55, maxWidth: isRegular ? '54ch' : undefined }}>
                Daftar gratis dalam 30 detik dan pilih slug nama toko Anda (contoh: <strong>catavor.com/usaha-anda</strong>).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem 1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: isRegular ? 'row' : 'column',
            alignItems: isRegular ? 'center' : 'stretch',
            gap: isRegular ? '1.25rem' : '0.85rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              flexShrink: 0,
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.05rem',
              boxShadow: '0 4px 12px var(--primary-glow)'
            }}>
              2
            </div>
            <div style={{
              display: isRegular ? 'grid' : 'block',
              gridTemplateColumns: isRegular ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : undefined,
              alignItems: 'center',
              gap: isRegular ? '1.25rem' : 0
            }}>
              <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.08rem', fontWeight: 800, margin: isRegular ? 0 : '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                Upload Produk &amp; Atur Tarif
              </h3>
              <p style={{ fontSize: isMiniTablet ? '0.82rem' : '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55, maxWidth: isRegular ? '54ch' : undefined }}>
                Unggah foto produk, isi harga promo, kategori, profil bisnis, nomor WhatsApp, dan jam operasional.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem 1.15rem' : '1.35rem 1.25rem',
            display: 'flex',
            flexDirection: isRegular ? 'row' : 'column',
            alignItems: isRegular ? 'center' : 'stretch',
            gap: isRegular ? '1.25rem' : '0.85rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              flexShrink: 0,
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.05rem',
              boxShadow: '0 4px 12px var(--primary-glow)'
            }}>
              3
            </div>
            <div style={{
              display: isRegular ? 'grid' : 'block',
              gridTemplateColumns: isRegular ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : undefined,
              alignItems: 'center',
              gap: isRegular ? '1.25rem' : 0
            }}>
              <h3 style={{ fontSize: isMiniTablet ? '0.98rem' : '1.08rem', fontWeight: 800, margin: isRegular ? 0 : '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                Bagikan Biolink &amp; Terima Pesanan
              </h3>
              <p style={{ fontSize: isMiniTablet ? '0.82rem' : '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55, maxWidth: isRegular ? '54ch' : undefined }}>
                Pasang link di bio media sosial (Instagram, TikTok, WhatsApp). Pelanggan memesan langsung ke WhatsApp atau transaksi terproteksi Rekber Syariah.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: KEMITRAAN RESMI REKBER & TRANSAKSI AMAN ESCROW (#escrow-partner)
          ========================================================================= */}
      <section id="escrow-partner" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            color: '#16a34a',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            padding: isMiniTablet ? '0.35rem 0.95rem' : '0.4rem 1.05rem',
            borderRadius: '999px',
            fontSize: isMiniTablet ? '0.76rem' : '0.84rem',
            fontWeight: 800,
            marginBottom: '0.65rem'
          }}>
            <ShieldCheck size={16} color="#16a34a" />
            <span>Kemitraan Resmi &amp; Transaksi Aman Escrow</span>
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Belanja Tenang &amp; Bebas Ragu Bersama <span style={{ color: 'var(--primary)' }}>Rekber Syariah</span>
          </h2>
          <p style={{ fontSize: isMiniTablet ? '0.86rem' : '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '750px', margin: '0 auto' }}>
            Platform Catavor bekerja sama resmi dengan <strong>Rekber Syariah</strong> (<a href="https://rekbersyariah.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>rekbersyariah.com</a>) guna menghadirkan fasilitas rekening bersama pihak ketiga yang amanah, adil, transparan, dan 100% bebas riba.
          </p>
        </div>

        {/* 2-Column Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(2, 1fr)',
          gap: isMiniTablet ? '0.85rem' : '1.15rem',
          marginBottom: '1.25rem'
        }}>
          {/* Card 1: What is Escrow & Protection */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem 1.15rem' : '1.45rem 1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid #bfdbfe'
              }}>
                <Scale size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: isMiniTablet ? '1rem' : '1.12rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Apa Itu Rekening Bersama (Escrow)?
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Perlindungan transaksi netral antara Pembeli &amp; Penjual
                </span>
              </div>
            </div>

            <p style={{ fontSize: isMiniTablet ? '0.82rem' : '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Catavor adalah direktori dan katalog usaha langsung tanpa memotong komisi penjualan sepeser pun (0% komisi). Namun, saat bertransaksi jarak jauh antar kota atau untuk barang bernilai tinggi, rasa khawatir tertipu sering kali menjadi kendala.
            </p>

            <div style={{
              padding: '0.75rem 0.95rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              fontSize: isMiniTablet ? '0.78rem' : '0.84rem',
              color: 'var(--text-primary)',
              lineHeight: 1.55
            }}>
              <strong>Cara Kerja Proteksi:</strong> Dana pembayaran pembeli ditampung sementara di rekening escrow resmi mitra. Uang <em>tidak akan diteruskan</em> ke penjual hingga pembeli menerima dan memverifikasi barang dalam kondisi baik.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <div style={{ fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Bagi Pembeli:</strong> Tenang dan bebas risiko penipuan online. Barang pasti dikirim atau dana kembali utuh.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <div style={{ fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Bagi Penjual:</strong> Meningkatkan kepercayaan calon pembeli luar kota secara instan sehingga penjualan lebih cepat closing.
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Official Partner Profile */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1.5px solid #bfdbfe',
            padding: isMiniTablet ? '1.25rem 1.15rem' : '1.45rem 1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid rgba(22, 163, 74, 0.25)'
              }}>
                <BadgeCheck size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: isMiniTablet ? '1.05rem' : isRegular ? '1.12rem' : '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                    Rekber Syariah
                  </h3>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    backgroundColor: 'rgba(22, 163, 74, 0.12)',
                    color: '#16a34a',
                    padding: '0.12rem 0.5rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(22, 163, 74, 0.25)'
                  }}>
                    TERVERIFIKASI
                  </span>
                </div>
                <span style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: 700 }}>
                  Mitra Escrow Resmi Platform Catavor
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isRegular ? '1fr' : 'repeat(2, 1fr)', gap: '0.65rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-deep)', borderRadius: '0.65rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Sistem Transaksi</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Grup WA 3 Pihak</div>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-deep)', borderRadius: '0.65rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Prinsip Syariah</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>Amanah &amp; Bebas Riba</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', backgroundColor: 'var(--bg-deep)', padding: '0.75rem 0.95rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Situs Web Resmi:</span>
                <a
                  href="https://rekbersyariah.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', minHeight: '44px' }}
                >
                  <span>rekbersyariah.com</span>
                  <ExternalLink size={13} />
                </a>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-light)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>WhatsApp Admin:</span>
                <a
                  href="https://wa.me/62811220227"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#16a34a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', minHeight: '44px' }}
                >
                  <MessageCircle size={14} />
                  <span>+62811220227</span>
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: isRegular ? 'column' : 'row', gap: '0.65rem', marginTop: 'auto' }}>
              <a
                href="https://rekbersyariah.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '0 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={14} />
                <span>Kunjungi Situs</span>
              </a>
              <a
                href={`https://wa.me/62811220227?text=${encodeURIComponent('Halo Admin Rekber Syariah, saya ingin berkonsultasi mengenai transaksi pembelian barang melalui platform Catavor.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '0 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                }}
              >
                <MessageCircle size={15} />
                <span>Hubungi Rekber</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4-Step Interactive Escrow Flow Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.15rem',
          border: '1px solid var(--border-light)',
          padding: isMiniTablet ? '1.25rem 1.15rem' : '1.5rem 1.45rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: isMiniTablet ? '0.72rem' : '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Panduan Transaksi Mudah
            </span>
            <h3 style={{ fontSize: isMiniTablet ? '1.15rem' : '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.35rem 0' }}>
              Bagaimana Alur Transaksi via Rekber di Catavor?
            </h3>
            <p style={{ fontSize: isMiniTablet ? '0.8rem' : '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
              Proses aman, transparan, dan terkoordinasi dalam 4 langkah terarah
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isWide ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
            gap: isMiniTablet ? '0.75rem' : '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Pilih &amp; Sepakati</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pilih produk di katalog merchant dan pilih transaksi aman Rekber bersama penjual.
              </p>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Grup WA 3 Pihak</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Admin Rekber Syariah membuatkan grup WhatsApp resmi bersama Pembeli &amp; Penjual.
              </p>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Setor &amp; Kirim</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pembeli transfer ke escrow. Setelah diverifikasi aman, Penjual mengirimkan barang pesanan.
              </p>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: '0.75rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Cek &amp; Cair</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pembeli menerima paket &amp; cek isi. Saat dinyatakan sesuai, dana langsung dicairkan ke Penjual.
              </p>
            </div>
          </div>

          {/* Buyer Tips Callout */}
          <div style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '0.75rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '0.1rem'
            }}>
              <MessageCircle size={16} />
            </div>
            <div style={{ flex: 1, fontSize: isMiniTablet ? '0.78rem' : '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem', fontSize: isMiniTablet ? '0.82rem' : '0.92rem' }}>
                Tips Pembeli: Bagaimana Jika Penjual Belum Mengaktifkan Tombol Rekber?
              </strong>
              Jika opsi Rekber belum tampil di katalog, jangan ragu untuk <strong>meminta langsung via chat WhatsApp</strong>:
              <div style={{
                marginTop: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px dashed var(--border-light)',
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: isMiniTablet ? '0.78rem' : '0.84rem'
              }}>
                &ldquo;Halo kak, saya ingin pesan produk ini. Apakah pembayarannya bisa melalui mitra resmi Rekber Syariah (rekbersyariah.com)? Terima kasih.&rdquo;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: PAKET & HARGA (#pricing-section)
          ========================================================================= */}
      <section id="pricing-section" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{ fontSize: isMiniTablet ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Investasi Terjangkau
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.45rem 0', letterSpacing: '-0.02em' }}>
            Pilihan Paket Sesuai Skala Usaha
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMiniTablet ? '0.86rem' : '0.94rem', maxWidth: '640px', margin: '0 auto 1rem auto', lineHeight: 1.6 }}>
            Mulai gratis selamanya untuk pemula, atau upgrade ke Pro untuk fitur tanpa batas.
          </p>

          {/* Billing Cycle Switcher */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)'
          }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.38rem 1.15rem',
                minHeight: '44px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '0.38rem 1.15rem',
                minHeight: '44px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Tahunan</span>
              <span style={{
                backgroundColor: 'rgba(22, 163, 74, 0.18)',
                color: '#16a34a',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.1rem 0.5rem',
                borderRadius: '999px'
              }}>
                -20% Hemat
              </span>
            </button>
          </div>
        </div>

        {/* On Tablet Mini: Interactive Segmented Tab Switcher for 3 Plans */}
        {useTabbedPricing && (
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            padding: '0.3rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            marginBottom: '1rem'
          }}>
            {(['free', 'pro_starter', 'pro_business'] as const).map(planKey => {
              const isSelected = selectedPlanTab === planKey;
              const label = planKey === 'free' ? 'Gratis' : planKey === 'pro_starter' ? 'Pro Starter' : 'Pro Bisnis';
              return (
                <button
                  key={planKey}
                  type="button"
                  onClick={() => setSelectedPlanTab(planKey)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0.5rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Pricing Cards Grid (Mini shows selected card or all 3 on wide tablet) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isExpandedPlus ? 'repeat(3, 1fr)' : useTabbedPricing ? '1fr' : 'repeat(2, 1fr)',
          gap: useTabbedPricing ? '1rem' : '1.15rem'
        }}>
          {/* Plan 1: Free */}
          {(!useTabbedPricing || selectedPlanTab === 'free') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '1px solid var(--border-light)',
              padding: isMiniTablet ? '1.35rem 1.25rem' : '1.45rem 1.35rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-premium)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Gratis
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.12)', padding: '0.15rem 0.55rem', borderRadius: '999px' }}>
                    Rp 0
                  </span>
                </div>
                <div style={{ fontSize: isMiniTablet ? '1.85rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.55rem 0' }}>
                  Rp 0 <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ selamanya</span>
                </div>
                <p style={{ fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                  Cocok untuk usaha rintisan yang baru memulai digitalisasi produk &amp; katalog online.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#16a34a" /> Maksimal 15 item produk</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#16a34a" /> 100 MB Storage &amp; 5 foto/item</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#16a34a" /> Halaman profil bisnis</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#16a34a" /> Subdomain kustom (catavor.com/toko)</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#16a34a" /> WhatsApp Direct Order</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}><X size={16} /> Watermark Catavor aktif</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0 1.15rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Daftar Gratis Sekarang
              </button>
            </div>
          )}

          {/* Plan 2: Pro Starter */}
          {(!useTabbedPricing || selectedPlanTab === 'pro_starter') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '2px solid #0284c7',
              padding: isMiniTablet ? '1.35rem 1.25rem' : '1.45rem 1.35rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 30px -10px rgba(2, 132, 199, 0.2)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-0.7rem',
                right: '1.25rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.15rem 0.65rem',
                borderRadius: '999px'
              }}>
                POPULER
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pro Starter
                  </span>
                </div>
                <div style={{ fontSize: isMiniTablet ? '1.85rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.55rem 0', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ color: '#0284c7' }}>{billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 25.000'}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ bulan</span>
                </div>
                <p style={{ fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                  Untuk toko aktif &amp; UKM berkembang dengan kuota item besar &amp; branding mandiri.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-primary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#0284c7" /> <strong>150 item produk aktif</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#0284c7" /> <strong>2 GB Storage &amp; 8 foto/item</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#0284c7" /> Lencana Toko Terverifikasi</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#0284c7" /> Prioritas Pencarian Platform</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#0284c7" /> <strong>100% Bebas Watermark</strong></li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0 1.15rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                }}
              >
                <span>Pilih Pro Starter</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Plan 3: Pro Bisnis */}
          {(!useTabbedPricing || selectedPlanTab === 'pro_business') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '2px solid #f59e0b',
              padding: isMiniTablet ? '1.35rem 1.25rem' : '1.45rem 1.35rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 30px -10px rgba(245, 158, 11, 0.2)',
              position: 'relative',
              gridColumn: isExpandedPlus || useTabbedPricing ? undefined : '1 / -1'
            }}>
              <div style={{
                position: 'absolute',
                top: '-0.7rem',
                right: '1.25rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '0.15rem 0.65rem',
                borderRadius: '999px'
              }}>
                UNLIMITED + DOMAIN
              </div>
              <div style={{
                display: isRegular ? 'grid' : 'block',
                gridTemplateColumns: isRegular ? 'minmax(0, 1fr) minmax(0, 1.05fr)' : undefined,
                gap: isRegular ? '0 1.5rem' : 0,
                alignItems: 'start'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pro Bisnis
                  </span>
                </div>
                <div style={{ fontSize: isMiniTablet ? '1.85rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.55rem 0', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ color: '#d97706' }}>{billingCycle === 'monthly' ? 'Rp 129.000' : 'Rp 107.500'}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ bulan</span>
                </div>
                <p style={{ fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                  Solusi terlengkap dengan postingan tak terbatas dan alamat website domain Anda sendiri.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridColumn: isRegular ? 2 : undefined, gridRow: isRegular ? '1 / span 4' : undefined, alignSelf: isRegular ? 'stretch' : undefined, alignContent: isRegular ? 'space-between' : undefined, gridTemplateColumns: useTabbedPricing || isRegular ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: '0.5rem 1.25rem', fontSize: isMiniTablet ? '0.78rem' : '0.84rem', color: 'var(--text-primary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#d97706" /> <strong>Unlimited Produk &amp; Jasa</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#d97706" /> <strong>10 GB Storage &amp; 10 foto/item</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#d97706" /> <strong>Custom Domain (toko.com)</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#d97706" /> Lencana Toko Terverifikasi</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCheck size={16} color="#d97706" /> Prioritas VIP Support 24/7</li>
                </ul>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  style={{
                    width: isRegular ? 'fit-content' : '100%',
                    minWidth: isRegular ? '240px' : undefined,
                    minHeight: '44px',
                    padding: isRegular ? '0 1.6rem' : '0 1.15rem',
                    borderRadius: '0.65rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#000000',
                    fontSize: '0.86rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    marginTop: isRegular ? '1rem' : '1.25rem',
                    gridColumn: isRegular ? 1 : undefined,
                    gridRow: isRegular ? 4 : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                  }}
                >
                  <span>Pilih Pro Bisnis</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: FAQ ACCORDION (#faq-section)
          ========================================================================= */}
      <section id="faq-section" style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.25rem' : '1.75rem' }}>
          <div style={{ fontSize: isMiniTablet ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pusat Bantuan
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.45rem 0', letterSpacing: '-0.02em' }}>
            Pertanyaan yang Sering Diajukan
          </h2>
        </div>

        <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {LANDING_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.85rem',
                  border: isOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                  boxShadow: isOpen ? '0 4px 15px rgba(37, 99, 235, 0.12)' : 'none'
                }}
              >
                <div
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  style={{
                    padding: isMiniTablet ? '0.95rem 1.15rem' : '1.1rem 1.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <h3 style={{ fontSize: isMiniTablet ? '0.88rem' : '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, paddingRight: '0.75rem', lineHeight: 1.45 }}>
                    {faq.q}
                  </h3>
                  <ChevronDown
                    size={18}
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
                    padding: isMiniTablet ? '0 1.15rem 0.95rem 1.15rem' : '0 1.35rem 1.1rem 1.35rem',
                    fontSize: isMiniTablet ? '0.82rem' : '0.9rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
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

      {/* =========================================================================
          SECTION 7: BOTTOM HERO CTA BANNER
          ========================================================================= */}
      <section style={{
        maxWidth: 'var(--tablet-container-max, 960px)',
        margin: `0 auto ${sectionGap} auto`,
        padding: `0 ${sectionPadX}`,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          padding: isMiniTablet ? '2rem 1.35rem' : '2.75rem 2.25rem',
          borderRadius: '1.35rem',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
          color: '#ffffff',
          textAlign: 'center',
          boxShadow: '0 16px 36px -10px rgba(37, 99, 235, 0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px', margin: '0 auto' }}>
            <h2 style={{ fontSize: isMiniTablet ? '1.65rem' : '2.1rem', fontWeight: 900, marginBottom: '0.65rem', letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.25 }}>
              Siap Memulai Digitalisasi Katalog Bisnis Anda?
            </h2>
            <p style={{ fontSize: isMiniTablet ? '0.86rem' : '0.96rem', color: '#dbeafe', marginBottom: '1.5rem', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 1.5rem auto' }}>
              Daftar sekarang dan publikasikan katalog produk interaktif Anda dalam 60 detik. Gratis selamanya tanpa kartu kredit.
            </p>
            <button
              type="button"
              onClick={onOpenLogin}
              style={{
                minHeight: '44px',
                padding: '0 2rem',
                borderRadius: '0.75rem',
                backgroundColor: '#ffffff',
                color: '#1d4ed8',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
              }}
            >
              <span>Buat Link Katalog Saya</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8: TABLET FOOTER
          ========================================================================= */}
      <footer style={{
        borderTop: '1px solid var(--border-light)',
        padding: isMiniTablet ? '1.75rem 1.25rem' : '2.25rem 1.5rem',
        backgroundColor: 'var(--bg-card)',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: 'var(--tablet-container-max, 960px)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: isMiniTablet ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <StoreIcon size={16} />
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Catavor</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.35rem' }}>
              &copy; 2026 Catavor. Hak Cipta Dilindungi.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
            >
              Syarat &amp; Ketentuan
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
            >
              Kebijakan Privasi
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
            >
              Ketentuan Penggunaan
            </button>
          </div>
        </div>
      </footer>

      {/* Tablet Public Landing Policy Modal */}
      {showPolicyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-main, #0b1120)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              borderRadius: '1.25rem',
              width: '100%',
              maxWidth: '960px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card, #0f172a)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={18} style={{ color: 'var(--primary, #10b981)' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Pedoman Legal &amp; Kebijakan Platform
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              <TabletPoliciesView />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabletPublicLanding;
