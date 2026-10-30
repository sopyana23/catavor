import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShieldCheck,
  Store,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  Megaphone,
  Cpu,
  TrendingUp,
  Database,
  Clock,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity,
  CheckCircle2,
  Menu,
  X
} from 'lucide-react';
import appLogoImg from '../assets/logo.png';
import { APP_LOGO_BASE64 } from '../assets/logoBase64';

export interface PlatformAdminShellProps {
  currentUser: any;
  roleSlug: string;
  roleBadge: { label: string; color: string; bg: string; border: string };
  activeView: string;
  onSwitchView: (view: any, subView?: string) => void;
  canAccessRBAC: boolean;
  canAccessCompliance: boolean;
  canAccessSupport: boolean;
  canAccessFinance: boolean;
  canAccessMonetization: boolean;
  canAccessBroadcast: boolean;
  canAccessAutomation: boolean;
  canAccessAudit: boolean;
  canAccessMasterData: boolean;
  pendingReportsCount: number;
  urgentTicketsCount: number;
  actionRequiredTicketsCount: number;
  pendingOrdersCount: number;
  isDark: boolean;
  toggleTheme: () => void;
  onLogout?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const PlatformAdminShell: React.FC<PlatformAdminShellProps> = ({
  currentUser,
  roleSlug,
  roleBadge,
  activeView,
  onSwitchView,
  canAccessRBAC,
  canAccessCompliance,
  canAccessSupport,
  canAccessFinance,
  canAccessMonetization,
  canAccessBroadcast,
  canAccessAutomation,
  canAccessAudit,
  canAccessMasterData,
  pendingReportsCount,
  urgentTicketsCount,
  actionRequiredTicketsCount,
  pendingOrdersCount,
  isDark,
  toggleTheme,
  onLogout,
  onRefresh,
  isRefreshing = false,
  headerAction,
  children
}) => {
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });
  const [isTabletDrawerOpen, setIsTabletDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      if (w >= 768 && w < 1024) {
        setIsSidebarCollapsed(true);
      } else if (w >= 1024) {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const sidebarWidth = isTablet
    ? (isTabletDrawerOpen ? 260 : 74)
    : (isSidebarCollapsed ? 74 : 264);

  // Grouped Navigation Items (Strict parity with mobile features)
  const navGroups = [
    {
      group: 'Utama',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          sublabel: 'Metrik & Ringkasan',
          icon: <Layers size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: true
        },
        {
          id: 'rbac',
          label: 'Staf & RBAC',
          sublabel: 'Matriks & Izin Akses',
          icon: <ShieldCheck size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessRBAC
        },
        {
          id: 'stores',
          label: 'Direktori Merchant',
          sublabel: 'Tata Kelola & Dormansi',
          icon: <Store size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessCompliance
        }
      ]
    },
    {
      group: 'Operasional',
      items: [
        {
          id: 'reports',
          label: 'Kepatuhan & Laporan',
          sublabel: 'Penertiban & Investigasi',
          icon: <AlertTriangle size={18} strokeWidth={1.75} />,
          badge: pendingReportsCount,
          badgeColor: '#ef4444',
          visible: canAccessCompliance
        },
        {
          id: 'support',
          label: 'Tiket Bantuan',
          sublabel: 'Helpdesk & Percakapan',
          icon: <MessageSquare size={18} strokeWidth={1.75} />,
          badge: urgentTicketsCount > 0 ? urgentTicketsCount : actionRequiredTicketsCount,
          badgeColor: urgentTicketsCount > 0 ? '#ef4444' : '#0284c7',
          visible: canAccessSupport
        },
        {
          id: 'finance',
          label: 'Keuangan & Billing',
          sublabel: 'Langganan & Invoice',
          icon: <CreditCard size={18} strokeWidth={1.75} />,
          badge: pendingOrdersCount,
          badgeColor: '#10b981',
          visible: canAccessFinance
        },
        {
          id: 'broadcast',
          label: 'Siaran Broadcast',
          sublabel: 'Pesan Massal Merchant',
          icon: <Megaphone size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessBroadcast
        }
      ]
    },
    {
      group: 'Sistem & Konfigurasi',
      items: [
        {
          id: 'automation',
          label: 'Mesin Otomatisasi',
          sublabel: 'Bot Worker & Daemon',
          icon: <Cpu size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessAutomation
        },
        {
          id: 'monetization',
          label: 'Monetisasi & Ads',
          sublabel: 'AdSense & Google Analytics',
          icon: <TrendingUp size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessMonetization
        },
        {
          id: 'master_data',
          label: 'Master Data',
          sublabel: 'Domain, Template & Rekber',
          icon: <Database size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessMasterData
        },
        {
          id: 'audit',
          label: 'Audit Trail Sistem',
          sublabel: 'Log Aktivitas Staf',
          icon: <Clock size={18} strokeWidth={1.75} />,
          badge: 0,
          visible: canAccessAudit
        }
      ]
    }
  ];

  const getViewMetadata = (view: string) => {
    switch (view) {
      case 'dashboard':
        return { title: 'Ringkasan Platform', subtitle: 'Pusat komando dan analitik operasional platform' };
      case 'rbac':
        return { title: 'Staf & Role RBAC', subtitle: 'Pengaturan akun staf admin, penugasan role, dan matriks izin' };
      case 'stores':
        return { title: 'Tata Kelola Merchant & Dormansi', subtitle: 'Monitoring kepatuhan, keaktifan katalog merchant, dan penegakan sanksi' };
      case 'reports':
        return { title: 'Kepatuhan & Laporan Masyarakat', subtitle: 'Investigasi laporan pelanggaran merchant, komoditas ilegal, dan konten terlarang' };
      case 'support':
        return { title: 'Pusat Bantuan & Helpdesk', subtitle: 'Penanganan tiket kendala merchant, eskalasi, dan percakapan interaktif' };
      case 'finance':
        return { title: 'Keuangan & Billing Langganan', subtitle: 'Verifikasi aktivasi paket Pro, laporan omzet, dan invoice langganan' };
      case 'broadcast':
        return { title: 'Siaran Broadcast Notifikasi', subtitle: 'Pengiriman pesan pengumuman resmi ke seluruh merchant secara serentak' };
      case 'automation':
        return { title: 'Mesin Otomatisasi & Cron Bot', subtitle: 'Pemantauan kesehatan daemon worker, background scheduler, dan log otomatisasi' };
      case 'monetization':
        return { title: 'Monetisasi & Integrasi Google', subtitle: 'Pengaturan Google AdSense, file ads.txt, dan integrasi Google Analytics (GA4)' };
      case 'master_data':
        return { title: 'Master Data', subtitle: 'Whitelist domain transaksi aman, template balasan CS, dan escrow Rekber Syariah' };
      case 'audit':
        return { title: 'System-Wide Audit Trail', subtitle: 'Jejak rekaman forensik seluruh tindakan administratif lintas platform' };
      default:
        return { title: 'Platform Management Console', subtitle: 'Sistem operasional terpadu Catavor' };
    }
  };

  const currentMeta = getViewMetadata(activeView);
  const isCollapsed = isTablet ? !isTabletDrawerOpen : isSidebarCollapsed;
  const isSidebarShowing = !isCollapsed;
  const isCompactScreen = windowWidth < 1280;
  // Kondisi khusus: Pada tablet atau layar kompak ketika sidebar menu tampil (show)
  const isTightHeader = isTablet || (isCompactScreen && isSidebarShowing) || windowWidth < 1120;

  // Background and surface styling tokens
  const shellBg = isDark ? '#090d16' : '#f8fafc';
  const sidebarBg = isDark ? '#0c111e' : '#ffffff';
  const topbarBg = isDark ? 'rgba(12, 17, 30, 0.88)' : 'rgba(255, 255, 255, 0.9)';
  const borderCol = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const textPri = isDark ? '#f8fafc' : '#0f172a';
  const textSec = isDark ? '#cbd5e1' : '#475569';
  const textMut = isDark ? '#94a3b8' : '#64748b';
  const activeNavBg = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)';
  const activeNavBorder = isDark ? '#38bdf8' : '#0284c7';
  const activeNavText = isDark ? '#38bdf8' : '#0284c7';
  const hoverNavBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';

  return (
    <div
      className={`catavor-platform-shell ${isDark ? 'shell-dark' : 'shell-light'}`}
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: shellBg,
        color: textPri,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE SIDEBAR (DESKTOP NATIVE / TABLET ADAPTIVE ICON-RAIL)         */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarWidth}px`,
          height: '100vh',
          backgroundColor: sidebarBg,
          borderRight: `1px solid ${borderCol}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 50,
          overflow: 'hidden',
          boxShadow: isDark ? '4px 0 25px rgba(0, 0, 0, 0.45)' : '2px 0 15px rgba(0, 0, 0, 0.03)',
          flexShrink: 0
        }}
      >
        {/* Sidebar Header: Brand & Collapse Trigger */}
        <div
          style={{
            height: '66px',
            padding: isCollapsed ? '0 0.85rem' : '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: `1px solid ${borderCol}`,
            flexShrink: 0
          }}
        >
          <div
            onClick={() => onSwitchView('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.75rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '3px',
                flexShrink: 0,
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.04)'
              }}
            >
              <img
                src={appLogoImg || APP_LOGO_BASE64}
                alt="Catavor Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                    color: textPri,
                    lineHeight: 1.15
                  }}
                >
                  CATAVOR
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: activeNavText,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}
                >
                  Platform Console
                </span>
              </div>
            )}
          </div>

          {/* Collapse Toggle Button (Desktop & Tablet) */}
          {!isCollapsed && isDesktop && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: textMut,
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Ciutkan Sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {isCollapsed && isDesktop && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              style={{
                background: 'none',
                border: 'none',
                color: textMut,
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Perluas Sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {isTablet && (
            <button
              type="button"
              onClick={() => setIsTabletDrawerOpen(!isTabletDrawerOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: textMut,
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title={isTabletDrawerOpen ? "Ciutkan Drawer" : "Perluas Menu"}
            >
              {isTabletDrawerOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>

        {/* Sidebar Profile Card (When expanded) */}
        {!isCollapsed && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${borderCol}`,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
                  border: `1.5px solid ${activeNavBorder}`,
                  color: activeNavText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  flexShrink: 0
                }}
              >
                {(currentUser?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: textPri,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentUser?.name || 'Super Administrator'}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: textMut,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentUser?.email || 'admin@catavor.com'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  backgroundColor: roleBadge.bg,
                  color: roleBadge.color,
                  border: `1px solid ${roleBadge.border}`,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}
              >
                {roleBadge.label}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#10b981'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Online
              </span>
            </div>
          </div>
        )}

        {/* Navigation Menu (Scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isCollapsed ? '0.75rem 0.4rem' : '0.85rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem'
          }}
        >
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((item) => item.visible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {!isCollapsed && (
                  <div
                    style={{
                      padding: '0 0.65rem 0.35rem 0.65rem',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      color: textMut,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase'
                    }}
                  >
                    {group.group}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSwitchView(item.id);
                        if (isTablet) setIsTabletDrawerOpen(false);
                      }}
                      title={isCollapsed ? `${item.label} (${item.sublabel})` : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '0.75rem',
                        padding: isCollapsed ? '0.7rem 0' : '0.6rem 0.75rem',
                        borderRadius: '0.75rem',
                        border: 'none',
                        borderLeft: isActive && !isCollapsed ? `3px solid ${activeNavBorder}` : '3px solid transparent',
                        backgroundColor: isActive ? activeNavBg : 'transparent',
                        color: isActive ? activeNavText : textSec,
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = hoverNavBg;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isActive ? activeNavText : textMut,
                          flexShrink: 0
                        }}
                      >
                        {item.icon}
                      </div>

                      {!isCollapsed && (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </div>
                        </div>
                      )}

                      {/* Badge indicator */}
                      {item.badge > 0 && (
                        <span
                          style={{
                            minWidth: isCollapsed ? '16px' : '18px',
                            height: isCollapsed ? '16px' : '18px',
                            borderRadius: '999px',
                            backgroundColor: item.badgeColor || '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            position: isCollapsed ? 'absolute' : 'static',
                            top: isCollapsed ? '4px' : undefined,
                            right: isCollapsed ? '8px' : undefined,
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Theme Toggle & Logout */}
        <div
          style={{
            padding: isCollapsed ? '0.75rem 0.4rem' : '0.85rem 0.85rem',
            borderTop: `1px solid ${borderCol}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            flexShrink: 0
          }}
        >
          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '0.65rem',
              padding: isCollapsed ? '0.6rem 0' : '0.55rem 0.75rem',
              borderRadius: '0.65rem',
              border: `1px solid ${borderCol}`,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
              color: textSec,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {isDark ? <Sun size={16} strokeWidth={2} style={{ color: '#f59e0b' }} /> : <Moon size={16} strokeWidth={2} style={{ color: '#0284c7' }} />}
            {!isCollapsed && <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Keluar dari Console"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '0.65rem',
                padding: isCollapsed ? '0.6rem 0' : '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#ef4444',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} strokeWidth={2} />
              {!isCollapsed && <span>Keluar Portal</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN EXECUTIVE WORKSPACE CONTAINER                                      */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: shellBg
        }}
      >
        {/* Top Command Bar */}
        <header
          style={{
            height: '66px',
            backgroundColor: topbarBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isTightHeader ? '0 1.25rem' : (isDesktop ? '0 2rem' : '0 1.25rem'),
            gap: '1rem',
            zIndex: 40,
            flexShrink: 0
          }}
        >
          {/* Left: Semantic Breadcrumbs & View Meta (Clean single line on tablet/tight viewports) */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
            {!isTightHeader && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.72rem',
                  color: textMut,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span>Platform Console</span>
                <span>/</span>
                <span style={{ color: activeNavText }}>{currentMeta.title}</span>
              </div>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: isTightHeader ? '1.05rem' : (isDesktop ? '1.18rem' : '1.05rem'),
                fontWeight: 800,
                color: textPri,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={currentMeta.title}
            >
              {currentMeta.title}
            </h1>
          </div>

          {/* Right: Refresh action & Quick Role Pill (Clean, without truncated ellipsis info) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isTightHeader ? '0.5rem' : '0.65rem', flexShrink: 0 }}>
            {/* Contextual Action Button (e.g. Buat Siaran on Desktop) */}
            {headerAction}

            {/* Quick Refresh Data Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: isTightHeader ? '0.45rem' : '0.45rem 0.8rem',
                  minWidth: isTightHeader ? '36px' : 'auto',
                  height: '36px',
                  borderRadius: '0.65rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  color: textSec,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title="Segarkan Data Realtime"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                {!isTightHeader && <span>Segarkan</span>}
              </button>
            )}

            {/* Quick Role Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                backgroundColor: roleBadge.bg,
                color: roleBadge.color,
                border: `1px solid ${roleBadge.border}`,
                fontSize: '0.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span>{roleBadge.label}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isDesktop ? '1.75rem 2.25rem' : '1.25rem 1.5rem',
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
