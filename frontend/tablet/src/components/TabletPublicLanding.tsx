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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanTab, setSelectedPlanTab] = useState<'free' | 'pro_starter' | 'pro_business'>('pro_starter');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [showFloatingMenu, setShowFloatingMenu] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('catalog-types');
  const pillRailRef = useRef<HTMLDivElement>(null);

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
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const scrollPos = currentScroll + 160;
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

  // Auto-scroll active pill into view safely on Tablet Mini without clipping left edge
  useEffect(() => {
    if (pillRailRef.current && isMiniTablet && showFloatingMenu) {
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
  }, [activeSection, isMiniTablet, showFloatingMenu]);

  const handleScrollTo = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const headerOffset = 135;
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const elementTop = target.getBoundingClientRect().top + currentScroll;
      const targetPosition = Math.max(0, elementTop - headerOffset);

      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        } catch (_) {
          window.scrollTo(0, targetPosition);
        }
      }

      if (document.documentElement && typeof document.documentElement.scrollTo === 'function') {
        try {
          document.documentElement.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        } catch (_) {}
      }

      setActiveSection(sectionId);
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
            title={showFloatingMenu ? 'Tutup Navigasi' : 'Buka Navigasi'}
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

      {/* 2. FLOATING STICKY SUB-NAVIGATION BAR */}
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
                  {SECTION_NAV_ITEMS.find(s => s.id === activeSection)?.label || 'Tipe Katalog'}
                </strong>
                <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>•</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
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

      {/* 3. HERO SECTION (Aligned with Desktop & Mobile) */}
      <section style={{
        padding: isMiniTablet ? '2.5rem 1.25rem 2.25rem 1.25rem' : '3.5rem 2rem 3rem 2rem',
        maxWidth: '960px',
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
          padding: '0.35rem 0.95rem',
          borderRadius: '999px',
          backgroundColor: 'rgba(30, 58, 138, 0.08)',
          color: 'var(--primary)',
          fontSize: '0.76rem',
          fontWeight: 800,
          marginBottom: '1.25rem',
          border: '1px solid var(--border-light)'
        }}>
          <Sparkles size={14} />
          <span>Platform Katalog Digital &amp; Biolink Usaha Mandiri</span>
        </div>

        {/* Main Title */}
        <h1 style={{
          fontSize: isMiniTablet ? '2.2rem' : '2.85rem',
          fontWeight: 900,
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          margin: '0 0 1rem 0'
        }}>
          Katalog Produk Interaktif untuk{' '}
          <span style={{ color: 'var(--primary)' }}>Segala Jenis Usaha</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: isMiniTablet ? '0.92rem' : '1.05rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 1.85rem auto'
        }}>
          Gantikan buku menu fisik dan daftar harga manual. Hadirkan website katalog modern responsif yang terhubung langsung ke WhatsApp tanpa potongan komisi.
        </p>

        {/* Value Pills Grid */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Zap size={14} color="var(--primary)" /> Siap dalam 60 Detik
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Layers size={14} color="var(--primary)" /> 7 Format Spesifik Usaha
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <MessageCircle size={14} color="#16a34a" /> Direct WhatsApp Order
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <ShieldCheck size={14} color="var(--primary)" /> Proteksi Rekber Syariah
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            <Scale size={14} color="var(--primary)" /> 0% Komisi Penjualan
          </span>
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: isMiniTablet ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.85rem',
          marginBottom: '2rem'
        }}>
          <button
            type="button"
            onClick={onOpenLogin}
            style={{
              minHeight: '46px',
              padding: '0 1.85rem',
              borderRadius: '0.7rem',
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
              boxShadow: 'var(--shadow-premium)',
              width: isMiniTablet ? '100%' : 'auto'
            }}
          >
            <span>Mulai Buat Katalog — Gratis</span>
            <ArrowRight size={16} />
          </button>
          <a
            href="#catalog-types"
            onClick={(e) => handleScrollTo(e, 'catalog-types')}
            style={{
              minHeight: '46px',
              padding: '0 1.5rem',
              borderRadius: '0.7rem',
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
              width: isMiniTablet ? '100%' : 'auto'
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
          padding: '0.55rem 1.15rem',
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
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Spesialisasi Format
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            7 Tipe Katalog untuk Berbagai Bidang Usaha
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Bukan sekadar tautan teks biasa. Setiap tipe katalog memiliki struktur formulir dan atribut khusus yang relevan dengan karakteristik produk atau layanan Anda.
          </p>
        </div>

        {/* On Tablet Mini: Touch-Friendly Segmented Tabs + Rich Focused Card */}
        {isMiniTablet ? (
          <div>
            {/* Horizontal Pill Segmenter */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '0.75rem',
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
                      padding: '0.55rem 1rem',
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

            {/* Active Card Details */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-premium)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '0.75rem',
                    backgroundColor: activeFormatData.bgColor,
                    border: `1px solid ${activeFormatData.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: activeFormatData.color
                  }}>
                    <FormatIcon size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
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
                borderRadius: '0.85rem',
                padding: '1.15rem',
                border: '1px solid var(--border-light)',
                marginBottom: '1rem'
              }}>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {activeFormatData.description}
                </p>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Contoh Penggunaan:</strong> {activeFormatData.examples}
              </div>
            </div>
          </div>
        ) : (
          /* On Tablet Lebar (>=880px): Balanced 2-Column Responsive Card Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.25rem'
          }}>
            {CATALOG_TYPES_INFO.map(cat => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '1.15rem',
                    border: '1px solid var(--border-light)',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0.75rem',
                      backgroundColor: cat.bgColor,
                      border: `1px solid ${cat.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: cat.color
                    }}>
                      <Icon size={20} />
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: cat.color,
                      backgroundColor: cat.bgColor,
                      border: `1px solid ${cat.borderColor}`,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px'
                    }}>
                      Tipe Katalog
                    </span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>
                      {cat.name}
                    </h3>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: cat.color, marginBottom: '0.45rem' }}>
                      {cat.tagline}
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                      {cat.description}
                    </p>
                  </div>

                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Contoh:</strong> {cat.examples}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION 2: KEUNGGULAN UTAMA (#features-section)
          ========================================================================= */}
      <section id="features-section" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Keunggulan Utama
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Mengapa Pemilik Usaha Memilih Catavor?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
            Solusi terpadu untuk digitalisasi etalase produk, efisiensi pemesanan WhatsApp, dan branding toko fisik maupun online.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: isMiniTablet ? '1rem' : '1.25rem'
        }}>
          {/* Card 1 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              7 Format Spesialisasi Produk
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Mendukung Barang Fisik, Kuliner, Jasa, Digital, Hewan, Tanaman, dan Properti dengan formulir atribut spesifik sesuai kebutuhan industri Anda.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Pesanan Terstruktur WhatsApp
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Tombol pesan otomatis mengisi nama produk, harga, varian, dan catatan sehingga penjual dan pembeli tidak perlu mengetik manual.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Kustomisasi Identitas &amp; Tema
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Sesuaikan warna tema katalog, foto profil toko, deskripsi usaha, tautan media sosial, serta jam operasional bisnis Anda.
            </p>
          </div>

          {/* Card 4 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Dashboard Manajemen Produk &amp; Stok
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Kelola ratusan produk, atur status ketersediaan (Tersedia, Pre-Order, Buka Jadwal), kompresi WebP otomatis, dan kelola varian dari satu panel admin terpadu.
            </p>
          </div>

          {/* Card 5 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              0% Biaya Komisi Transaksi
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Seluruh hasil penjualan dari pelanggan 100% milik Anda seutuhnya. Tidak ada biaya transaksi tersembunyi per order.
            </p>
          </div>

          {/* Card 6 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.25rem' : '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
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
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Biolink Toko Mandiri Responsif
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Miliki alamat katalog web pribadi (catavor.com/nama-usaha) yang super ringan dibuka dari ponsel pelanggan dan siap dipasang di profil media sosial.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: CARA KERJA 3 LANGKAH (#steps-section)
          ========================================================================= */}
      <section id="steps-section" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kemudahan Operasional
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Mulai dalam 3 Langkah Sederhana
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
            Buka katalog interaktif Anda dalam hitungan menit tanpa keahlian teknis pemrograman.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(3, 1fr)',
          gap: isMiniTablet ? '1rem' : '1.25rem'
        }}>
          {/* Step 1 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: '1.75rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.15rem',
              boxShadow: '0 4px 10px var(--primary-glow)'
            }}>
              1
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                Klaim Tautan &amp; Daftarkan Akun
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Daftar gratis dalam 30 detik dan pilih slug nama toko Anda (contoh: <strong>catavor.com/usaha-anda</strong>).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: '1.75rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.15rem',
              boxShadow: '0 4px 10px var(--primary-glow)'
            }}>
              2
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                Upload Produk &amp; Atur Tarif
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Unggah foto produk, isi harga promo, kategori, profil bisnis, nomor WhatsApp, dan jam operasional.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.15rem',
            border: '1px solid var(--border-light)',
            padding: '1.75rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.15rem',
              boxShadow: '0 4px 10px var(--primary-glow)'
            }}>
              3
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                Bagikan Biolink &amp; Terima Pesanan
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
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
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            color: '#16a34a',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            padding: '0.35rem 0.95rem',
            borderRadius: '999px',
            fontSize: '0.76rem',
            fontWeight: 800,
            marginBottom: '0.85rem'
          }}>
            <ShieldCheck size={15} color="#16a34a" />
            <span>Kemitraan Resmi &amp; Transaksi Aman Escrow</span>
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.75rem 0', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Belanja Tenang &amp; Bebas Ragu Bersama <span style={{ color: 'var(--primary)' }}>Rekber Syariah</span>
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: '720px', margin: '0 auto' }}>
            Platform Catavor bekerja sama resmi dengan <strong>Rekber Syariah</strong> (<a href="https://rekbersyariah.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>rekbersyariah.com</a>) guna menghadirkan fasilitas rekening bersama pihak ketiga yang amanah, adil, transparan, dan 100% bebas riba.
          </p>
        </div>

        {/* 2-Column Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(2, 1fr)',
          gap: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          {/* Card 1: What is Escrow & Protection */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light)',
            padding: isMiniTablet ? '1.5rem' : '1.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(30, 58, 138, 0.08)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--border-light)'
              }}>
                <Scale size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Apa Itu Rekening Bersama (Escrow)?
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Perlindungan transaksi netral antara Pembeli &amp; Penjual
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Catavor adalah direktori dan katalog usaha langsung tanpa memotong komisi penjualan sepeser pun (0% komisi). Namun, saat bertransaksi jarak jauh antar kota atau untuk barang bernilai tinggi, rasa khawatir tertipu sering kali menjadi kendala.
            </p>

            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-light)',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              lineHeight: 1.55
            }}>
              <strong>Cara Kerja Proteksi:</strong> Dana pembayaran pembeli ditampung sementara di rekening escrow resmi mitra. Uang <em>tidak akan diteruskan</em> ke penjual hingga pembeli menerima dan memverifikasi barang dalam kondisi baik.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Bagi Pembeli:</strong> Tenang dan bebas risiko penipuan online. Barang pasti dikirim atau dana kembali utuh.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Bagi Penjual:</strong> Meningkatkan kepercayaan calon pembeli luar kota secara instan sehingga penjualan lebih cepat closing.
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Official Partner Profile */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1.5px solid rgba(30, 58, 138, 0.25)',
            padding: isMiniTablet ? '1.5rem' : '1.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                    Rekber Syariah
                  </h3>
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    backgroundColor: 'rgba(22, 163, 74, 0.12)',
                    color: '#16a34a',
                    padding: '0.12rem 0.45rem',
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
              <div style={{ padding: '0.75rem 0.85rem', backgroundColor: 'var(--bg-deep)', borderRadius: '0.65rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Sistem Transaksi</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>Grup WA 3 Pihak</div>
              </div>
              <div style={{ padding: '0.75rem 0.85rem', backgroundColor: 'var(--bg-deep)', borderRadius: '0.65rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Prinsip Syariah</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#16a34a' }}>Amanah &amp; Bebas Riba</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', backgroundColor: 'var(--bg-deep)', padding: '0.9rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Situs Web Resmi:</span>
                <a
                  href="https://rekbersyariah.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                >
                  <span>rekbersyariah.com</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-light)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>WhatsApp Admin:</span>
                <a
                  href="https://wa.me/62811220227"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#16a34a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                >
                  <MessageCircle size={13} />
                  <span>+62811220227</span>
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: 'auto' }}>
              <a
                href="https://rekbersyariah.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minHeight: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-card)',
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
                <ExternalLink size={13} />
                <span>Kunjungi Situs</span>
              </a>
              <a
                href={`https://wa.me/62811220227?text=${encodeURIComponent('Halo Admin Rekber Syariah, saya ingin berkonsultasi mengenai transaksi pembelian barang melalui platform Catavor.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minHeight: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  textDecoration: 'none'
                }}
              >
                <MessageCircle size={14} />
                <span>Hubungi Rekber</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4-Step Interactive Escrow Flow Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light)',
          padding: isMiniTablet ? '1.5rem' : '2rem',
          boxShadow: 'var(--shadow-premium)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Panduan Transaksi Mudah
            </span>
            <h3 style={{ fontSize: isMiniTablet ? '1.25rem' : '1.45rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.35rem 0' }}>
              Bagaimana Alur Transaksi via Rekber di Catavor?
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Proses aman, transparan, dan terkoordinasi dalam 4 langkah terarah
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMiniTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Pilih Produk &amp; Sepakati</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pembeli memilih produk di katalog merchant. Pada rincian item, pilih opsi transaksi aman Rekber atau minta penjual memproses lewat rekber.
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Grup WhatsApp 3 Pihak</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Admin resmi Rekber Syariah akan membuatkan grup koordinasi WhatsApp resmi bersama Pembeli dan Penjual.
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Setor Escrow &amp; Kirim</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pembeli mentransfer dana ke rekening resmi Rekber. Setelah dana terkonfirmasi aman oleh admin, Penjual mengirimkan barang pesanan.
              </p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '0.85rem', backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Cek Barang &amp; Dana Cair</h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Pembeli menerima paket &amp; memeriksa kesesuaiannya. Begitu pembeli menyatakan OK, dana langsung dicairkan ke rekening Penjual.
              </p>
            </div>
          </div>

          {/* Buyer Tips Callout */}
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.85rem',
            backgroundColor: 'rgba(30, 58, 138, 0.06)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
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
            <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                Tips Pembeli: Bagaimana Jika Penjual Belum Mengaktifkan Tombol Rekber?
              </strong>
              Jika pada katalog produk yang Anda minati opsi Rekber belum tampil, jangan ragu untuk <strong>meminta langsung kepada penjual via chat WhatsApp</strong>. Cukup sampaikan:
              <div style={{
                marginTop: '0.45rem',
                padding: '0.55rem 0.85rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px dashed var(--border-light)',
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                fontWeight: 600
              }}>
                &ldquo;Halo kak, saya berminat memesan produk ini. Agar transaksi lebih aman dan nyaman bersama, apakah pembayarannya bisa melalui mitra resmi Rekber Syariah (rekbersyariah.com)? Terima kasih.&rdquo;
              </div>
              <span style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                *Penjual dapat mengaktifkan fitur WhatsApp Rekber dengan mudah melalui menu Pengaturan Toko di dashboard admin mereka.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: PAKET & HARGA (#pricing-section)
          ========================================================================= */}
      <section id="pricing-section" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Investasi Terjangkau
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Pilihan Paket Sesuai Skala Usaha
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '560px', margin: '0 auto 1.25rem auto', lineHeight: 1.6 }}>
            Mulai gratis selamanya untuk pemula, atau upgrade ke Pro untuk fitur tanpa batas.
          </p>

          {/* Billing Cycle Switcher */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)'
          }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.42rem 1.15rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'monthly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.82rem',
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
                padding: '0.42rem 1.15rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: billingCycle === 'yearly' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Tahunan</span>
              <span style={{
                backgroundColor: 'rgba(22, 163, 74, 0.18)',
                color: '#16a34a',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '999px'
              }}>
                -20% Hemat
              </span>
            </button>
          </div>
        </div>

        {/* On Tablet Mini: Interactive Segmented Tab Switcher for 3 Plans */}
        {isMiniTablet && (
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            padding: '0.3rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem'
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
                    padding: '0.55rem',
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
          gridTemplateColumns: isMiniTablet ? '1fr' : 'repeat(3, 1fr)',
          gap: '1.25rem'
        }}>
          {/* Plan 1: Free */}
          {(!isMiniTablet || selectedPlanTab === 'free') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '1px solid var(--border-light)',
              padding: '1.75rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-premium)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Gratis
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.12)', padding: '0.15rem 0.55rem', borderRadius: '999px' }}>
                    Rp 0
                  </span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.5rem 0 0.85rem 0' }}>
                  Rp 0 <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ selamanya</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Cocok untuk usaha rintisan yang baru memulai digitalisasi produk &amp; katalog online.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Check size={16} color="#16a34a" /> Maksimal 15 item produk</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Check size={16} color="#16a34a" /> 100 MB Storage &amp; 5 foto/item</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Check size={16} color="#16a34a" /> Halaman "Tentang Kami" profil bisnis</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Check size={16} color="#16a34a" /> Subdomain kustom (catavor.com/toko)</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Check size={16} color="#16a34a" /> WhatsApp Direct Order</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)' }}><X size={16} /> Watermark Catavor aktif</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '0 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '1.75rem',
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
          {(!isMiniTablet || selectedPlanTab === 'pro_starter') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '2px solid #0284c7',
              padding: '1.75rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 15px 35px -10px rgba(2, 132, 199, 0.2)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-0.75rem',
                right: '1.25rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.18rem 0.65rem',
                borderRadius: '999px'
              }}>
                POPULER
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pro Starter
                  </span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.5rem 0 0.85rem 0', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ color: '#0284c7' }}>{billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 25.000'}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ bulan</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Untuk toko aktif &amp; UKM berkembang dengan kuota item besar &amp; branding mandiri.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#0284c7" /> <strong>150 item produk aktif</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#0284c7" /> <strong>2 GB Storage &amp; 8 foto/item</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#0284c7" /> Lencana Toko Terverifikasi</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#0284c7" /> Prioritas Pencarian Platform</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#0284c7" /> <strong>100% Bebas Watermark</strong></li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '0 1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <span>Pilih Pro Starter</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Plan 3: Pro Bisnis */}
          {(!isMiniTablet || selectedPlanTab === 'pro_business') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1.15rem',
              border: '2px solid #f59e0b',
              padding: '1.75rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 15px 35px -10px rgba(245, 158, 11, 0.2)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-0.75rem',
                right: '1.25rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                fontSize: '0.65rem',
                fontWeight: 900,
                padding: '0.18rem 0.65rem',
                borderRadius: '999px'
              }}>
                UNLIMITED + DOMAIN
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pro Bisnis
                  </span>
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.5rem 0 0.85rem 0', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ color: '#d97706' }}>{billingCycle === 'monthly' ? 'Rp 129.000' : 'Rp 107.500'}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ bulan</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Solusi terlengkap dengan postingan tak terbatas dan alamat website domain Anda sendiri.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#d97706" /> <strong>Unlimited Produk &amp; Jasa</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#d97706" /> <strong>10 GB Storage &amp; 10 foto/item</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#d97706" /> <strong>Custom Domain (toko.com)</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#d97706" /> Lencana Toko Terverifikasi</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}><CheckCheck size={17} color="#d97706" /> Prioritas VIP Support 24/7</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '0 1rem',
                  borderRadius: '0.65rem',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#000000',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  marginTop: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <span>Pilih Pro Bisnis</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: FAQ ACCORDION (#faq-section)
          ========================================================================= */}
      <section id="faq-section" style={{
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        scrollMarginTop: '135px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMiniTablet ? '1.5rem' : '2.25rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pusat Bantuan
          </div>
          <h2 style={{ fontSize: isMiniTablet ? '1.75rem' : '2.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.35rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Pertanyaan yang Sering Diajukan
          </h2>
        </div>

        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  style={{
                    padding: '1.15rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, paddingRight: '0.75rem', lineHeight: 1.4 }}>
                    {faq.q}
                  </h3>
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
                    padding: '0 1.25rem 1.15rem 1.25rem',
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '0.85rem'
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
        maxWidth: '960px',
        margin: isMiniTablet ? '0 auto 3rem auto' : '0 auto 4rem auto',
        padding: isMiniTablet ? '0 1.25rem' : '0 2rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          padding: isMiniTablet ? '2.5rem 1.5rem' : '3.5rem 2.5rem',
          borderRadius: '1.5rem',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
          color: '#ffffff',
          textAlign: 'center',
          boxShadow: '0 20px 45px -10px rgba(37, 99, 235, 0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px', margin: '0 auto' }}>
            <h2 style={{ fontSize: isMiniTablet ? '1.85rem' : '2.35rem', fontWeight: 900, marginBottom: '0.75rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
              Siap Memulai Digitalisasi Katalog Bisnis Anda?
            </h2>
            <p style={{ fontSize: isMiniTablet ? '0.88rem' : '0.98rem', color: '#dbeafe', marginBottom: '1.75rem', lineHeight: 1.6 }}>
              Daftar sekarang dan publikasikan katalog produk interaktif Anda dalam 60 detik. Gratis selamanya tanpa kartu kredit.
            </p>
            <button
              type="button"
              onClick={onOpenLogin}
              style={{
                minHeight: '46px',
                padding: '0 2rem',
                borderRadius: '0.7rem',
                backgroundColor: '#ffffff',
                color: '#1d4ed8',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
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
        padding: '2.5rem 1.5rem',
        backgroundColor: 'var(--bg-card)',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: isMiniTablet ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <StoreIcon size={15} />
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Catavor</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.35rem' }}>
              &copy; 2026 Catavor. Hak Cipta Dilindungi.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Syarat &amp; Ketentuan</span>
            <span>&bull;</span>
            <span>Kebijakan Privasi</span>
            <span>&bull;</span>
            <span>Ketentuan Penggunaan</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TabletPublicLanding;
