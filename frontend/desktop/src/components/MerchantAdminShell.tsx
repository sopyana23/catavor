import React, { useState } from 'react';
import {
  PackageCheck,
  BarChart3,
  Crown,
  BellRing,
  History,
  SlidersHorizontal,
  UserCheck,
  Scale,
  LifeBuoy,
  Shield,
  Layers,
  ChevronDown,
  Store,
  Plus,
  Check,
  Eye,
  ExternalLink,
  LogOut,
  Bell,
  ChevronRight,
  Menu,
  HardDrive
} from 'lucide-react';

export interface MerchantAdminShellProps {
  adminTab: 'items' | 'analytics' | 'notifications' | 'settings' | 'profile' | 'policies' | 'help' | 'subscription' | 'audit_logs' | 'rbac' | 'portal';
  setAdminTab: (tab: any) => void;
  settings: any;
  storeSlug: string | null;
  adminUser: any;
  unreadCount: number;
  unreadTicketsCount: number;
  totalItemsCount: number;
  storeQuota?: any;
  userStores: any[];
  showStoreDropdown: boolean;
  setShowStoreDropdown: (show: boolean) => void;
  openStoreChooserModal: () => void;
  setShowCreateStoreModal: (show: boolean) => void;
  handleSwitchStore: (slug: string) => void;
  handleLogout: () => void;
  goToCatalog: () => void;
  onOpenNotifications: () => void;
  onOpenCreateItem?: () => void;
  isPlatformAdminUser?: boolean;
  isSuperAdminUser?: boolean;
  children: React.ReactNode;
}

export const MerchantAdminShell: React.FC<MerchantAdminShellProps> = ({
  adminTab,
  setAdminTab,
  settings,
  storeSlug,
  adminUser,
  unreadCount,
  unreadTicketsCount,
  totalItemsCount,
  storeQuota,
  userStores,
  showStoreDropdown,
  setShowStoreDropdown,
  openStoreChooserModal,
  setShowCreateStoreModal,
  handleSwitchStore,
  handleLogout,
  goToCatalog,
  onOpenNotifications,
  onOpenCreateItem,
  isPlatformAdminUser = false,
  isSuperAdminUser = false,
  children
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Grouped Navigation Items
  const navSections = [
    {
      group: 'Katalog & Inventaris',
      items: [
        {
          id: 'items',
          label: 'Daftar Item / Produk',
          icon: <PackageCheck size={18} />,
          badge: totalItemsCount > 0 ? totalItemsCount : null,
          badgeColor: 'var(--primary-glow)',
          badgeTextColor: 'var(--primary)'
        }
      ]
    },
    {
      group: 'Performa & Aktivitas',
      items: [
        {
          id: 'analytics',
          label: 'Statistik & Trafik',
          icon: <BarChart3 size={18} />
        },
        {
          id: 'audit_logs',
          label: 'Riwayat & Audit Log',
          icon: <History size={18} />
        }
      ]
    },
    {
      group: 'Pengaturan & Toko',
      items: [
        {
          id: 'settings',
          label: 'Pengaturan Katalog',
          icon: <SlidersHorizontal size={18} />
        },
        {
          id: 'subscription',
          label: 'Paket & Kuota',
          icon: <Crown size={18} />,
          badge: settings?.plan === 'pro_business' ? 'PRO BISNIS' : settings?.plan === 'pro_starter' ? 'STARTER' : 'GRATIS',
          badgeColor: settings?.plan === 'free' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          badgeTextColor: settings?.plan === 'free' ? '#f59e0b' : 'var(--primary)'
        },
        {
          id: 'profile',
          label: 'Profil & Keamanan',
          icon: <UserCheck size={18} />
        }
      ]
    },
    {
      group: 'Bantuan & Layanan',
      items: [
        {
          id: 'help',
          label: 'Pusat Bantuan & Tiket',
          icon: <LifeBuoy size={18} />,
          badge: unreadTicketsCount > 0 ? `${unreadTicketsCount} Baru` : null,
          badgeColor: 'rgba(239, 68, 68, 0.2)',
          badgeTextColor: '#ef4444'
        },
        {
          id: 'notifications',
          label: 'Pusat Notifikasi',
          icon: <BellRing size={18} />,
          badge: unreadCount > 0 ? unreadCount : null,
          badgeColor: '#ef4444',
          badgeTextColor: '#ffffff'
        },
        {
          id: 'policies',
          label: 'Legal & Kebijakan',
          icon: <Scale size={18} />
        }
      ]
    }
  ];

  // Optional Staff items
  if (isSuperAdminUser || isPlatformAdminUser) {
    const staffItems: any[] = [];
    if (isSuperAdminUser) {
      staffItems.push({
        id: 'rbac',
        label: 'Staf & Hak Akses',
        icon: <Shield size={18} color="#f43f5e" />
      });
    }
    if (isPlatformAdminUser) {
      staffItems.push({
        id: 'portal',
        label: 'Portal Pengelola Staf',
        icon: <Layers size={18} color="#38bdf8" />
      });
    }
    if (staffItems.length > 0) {
      navSections.push({
        group: 'Platform Staf',
        items: staffItems
      });
    }
  }

  // Active Tab Title Lookup
  const getActiveTabTitle = () => {
    switch (adminTab) {
      case 'items': return 'Daftar Item & Inventaris';
      case 'analytics': return 'Statistik & Analisis Trafik';
      case 'subscription': return 'Paket Langganan & Kuota Toko';
      case 'notifications': return 'Pusat Notifikasi Sistem';
      case 'audit_logs': return 'Riwayat Aktivitas & Audit Trail';
      case 'settings': return 'Pengaturan Profil & Tampilan Katalog';
      case 'profile': return 'Profil Pengelola & Keamanan Akun';
      case 'policies': return 'Legal, Ketentuan & Kebijakan Platform';
      case 'help': return 'Pusat Bantuan & Layanan Tiket';
      case 'rbac': return 'Manajemen Staf & Akses RBAC';
      case 'portal': return 'Portal Khusus Tim Pengelola';
      default: return 'Dashboard Pengelola';
    }
  };

  const planName = storeQuota?.plan?.name || (settings?.plan === 'pro_business' ? 'Pro Bisnis' : settings?.plan === 'pro_starter' ? 'Pro Starter' : 'Gratis Terbatas');
  const activeItemsCount = storeQuota?.active_items_count ?? totalItemsCount;
  const maxItems = storeQuota?.max_items ?? (settings?.plan === 'free' ? 15 : -1);

  return (
    <div 
      className="desktop-admin-shell"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
    >
      {/* 1. LEFT SIDEBAR NAVIGATION */}
      <aside 
        style={{
          width: isSidebarCollapsed ? '78px' : '268px',
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.06)'
        }}
      >
        {/* Sidebar Header: Store Switcher Anchor */}
        <div 
          style={{
            padding: isSidebarCollapsed ? '1rem 0.5rem' : '1.15rem 1.15rem',
            borderBottom: '1px solid var(--border-light)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between'
          }}
        >
          {!isSidebarCollapsed ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                title="Ganti Profil Katalog"
              >
                {/* Store Logo / Initial */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  border: '1px solid var(--primary, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #10b981)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {settings?.store_logo_url ? (
                    <img src={settings.store_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (settings?.store_title || storeSlug || 'C').charAt(0).toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {settings?.store_title || storeSlug || 'Katalog'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                    <span>@{storeSlug}</span>
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '4px',
                      backgroundColor: settings?.plan === 'pro_business' ? 'rgba(245, 158, 11, 0.2)' : settings?.plan === 'pro_starter' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: settings?.plan === 'pro_business' ? '#f59e0b' : settings?.plan === 'pro_starter' ? '#38bdf8' : '#34d399',
                      textTransform: 'uppercase'
                    }}>
                      {settings?.plan === 'pro_business' ? 'PRO' : settings?.plan === 'pro_starter' ? 'STARTER' : 'FREE'}
                    </span>
                  </div>
                </div>

                <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: showStoreDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
              </button>

              {/* Store Switcher Dropdown Popover */}
              {showStoreDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '280px',
                  backgroundColor: 'var(--bg-card, #0f172a)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  borderRadius: '0.85rem',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
                  padding: '0.65rem',
                  zIndex: 100,
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ padding: '0.4rem 0.5rem 0.55rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Katalog Anda ({userStores.length})
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {adminUser?.email}
                    </span>
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.35rem 0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {userStores.map((s: any) => {
                      const isCurrent = s.slug.toLowerCase() === (storeSlug || '').toLowerCase();
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setShowStoreDropdown(false);
                            handleSwitchStore(s.slug);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.55rem',
                            borderRadius: '0.5rem',
                            backgroundColor: isCurrent ? 'var(--primary-glow)' : 'transparent',
                            border: isCurrent ? '1px solid var(--primary)' : '1px solid transparent',
                            cursor: isCurrent ? 'default' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: isCurrent ? 'var(--primary)' : 'var(--bg-card-hover)',
                              color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              flexShrink: 0,
                              overflow: 'hidden'
                            }}>
                              {s.store_logo_url ? (
                                <img src={s.store_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (s.store_title || s.slug).charAt(0).toUpperCase()
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.store_title || s.slug}
                              </div>
                              <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                                @{s.slug} {s.item_count !== undefined ? `• ${s.item_count} item` : ''}
                              </div>
                            </div>
                          </div>
                          {isCurrent ? (
                            <Check size={14} color="var(--primary)" />
                          ) : (
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Pindah &rarr;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ paddingTop: '0.45rem', borderTop: '1px solid var(--border-light)', marginTop: '0.2rem', display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStoreDropdown(false);
                        openStoreChooserModal();
                      }}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        borderRadius: '0.45rem',
                        backgroundColor: 'var(--bg-deep)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Store size={13} />
                      <span>Pusat Katalog</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStoreDropdown(false);
                        setShowCreateStoreModal(true);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        borderRadius: '0.45rem',
                        backgroundColor: 'var(--primary-glow)',
                        border: '1px dashed var(--primary)',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Plus size={13} />
                      <span>Buat Baru</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => setShowStoreDropdown(!showStoreDropdown)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-glow)',
                border: '1px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title={settings?.store_title || storeSlug || 'Katalog'}
            >
              {(settings?.store_title || storeSlug || 'C').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isSidebarCollapsed ? '0.75rem 0.4rem' : '0.85rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {navSections.map((section, idx) => (
            <div key={idx}>
              {!isSidebarCollapsed && (
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: 'var(--text-muted, #94a3b8)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '0 0.5rem 0.45rem 0.5rem',
                  opacity: 0.85
                }}>
                  {section.group}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {section.items.map((item: any) => {
                  const isActive = adminTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAdminTab(item.id);
                        if (storeSlug) {
                          window.history.pushState({}, '', `/${storeSlug}/admin/${item.id}`);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                        gap: '0.65rem',
                        padding: isSidebarCollapsed ? '0.65rem 0' : '0.55rem 0.75rem',
                        borderRadius: '0.55rem',
                        border: 'none',
                        backgroundColor: isActive ? 'var(--primary-glow, rgba(16, 185, 129, 0.18))' : 'transparent',
                        color: isActive ? 'var(--primary, #10b981)' : 'var(--text-secondary, #cbd5e1)',
                        cursor: 'pointer',
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: '18%',
                          bottom: '18%',
                          width: '3.5px',
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: 'var(--primary)',
                          boxShadow: '0 0 10px var(--primary)'
                        }} />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span style={{ color: isActive ? 'var(--primary)' : 'inherit', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        {!isSidebarCollapsed && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                      </div>

                      {!isSidebarCollapsed && item.badge !== null && item.badge !== undefined && (
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          padding: '0.12rem 0.45rem',
                          borderRadius: '999px',
                          backgroundColor: item.badgeColor || 'var(--primary-glow)',
                          color: item.badgeTextColor || 'var(--primary)',
                          border: '1px solid var(--border-light)',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: User Details & Logout */}
        <div 
          style={{
            padding: isSidebarCollapsed ? '0.75rem 0.4rem' : '0.85rem 1rem',
            borderTop: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          {!isSidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  flexShrink: 0
                }}>
                  {(adminUser?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {adminUser?.name || 'Pengelola'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {adminUser?.email || ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: '0.45rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Keluar dari Panel Admin"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.6rem 0',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Keluar"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE AREA */}
      <div 
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: '100vh',
          backgroundColor: 'var(--bg-deep)'
        }}
      >
        {/* Top App Header Bar */}
        <header
          style={{
            height: '62px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.75rem',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backdropFilter: 'blur(12px)'
          }}
        >
          {/* Left: Breadcrumbs / Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isSidebarCollapsed ? 'Buka Sidebar' : 'Ciutkan Sidebar'}
            >
              <Menu size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Panel Admin</span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                {getActiveTabTitle()}
              </strong>
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Quick Quota Pill */}
            <div 
              onClick={() => {
                setAdminTab('subscription');
                if (storeSlug) window.history.pushState({}, '', `/${storeSlug}/admin/subscription`);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '999px',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
              title="Lihat status kuota & upgrade paket"
            >
              <PackageCheck size={13} color="var(--primary)" />
              <span>{activeItemsCount} / {maxItems === -1 ? '∞' : maxItems} Produk</span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '0.05rem 0.35rem',
                borderRadius: '4px',
                backgroundColor: settings?.plan === 'free' ? 'rgba(245, 158, 11, 0.2)' : 'var(--primary-glow)',
                color: settings?.plan === 'free' ? '#f59e0b' : 'var(--primary)'
              }}>
                {planName}
              </span>
            </div>

            {/* Cloud Storage Warning Pill if >= 80% */}
            {storeQuota && storeQuota.storage_usage_percent >= 80 && (
              <div
                onClick={() => {
                  setAdminTab('subscription');
                  if (storeSlug) window.history.pushState({}, '', `/${storeSlug}/admin/subscription`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '999px',
                  backgroundColor: storeQuota.is_storage_over_limit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${storeQuota.is_storage_over_limit ? '#ef4444' : '#f59e0b'}`,
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: storeQuota.is_storage_over_limit ? '#ef4444' : '#f59e0b',
                  transition: 'all 0.15s ease'
                }}
                title={`Penyimpanan Cloud hampir penuh (${Math.round(storeQuota.storage_usage_percent)}%). Klik untuk upgrade kuota.`}
              >
                <HardDrive size={13} />
                <span>{Math.round(storeQuota.storage_usage_percent)}% Storage</span>
              </div>
            )}

            {/* Public Storefront Link Button */}
            {!(settings?.dormancy_status === 'suspended' || settings?.is_suspended) && (
              <button
                type="button"
                onClick={goToCatalog}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Buka tampilan katalog yang dilihat pengunjung"
              >
                <Eye size={14} />
                <span>Lihat Katalog Publik</span>
                <ExternalLink size={12} style={{ opacity: 0.6 }} />
              </button>
            )}

            {/* Notification Bell */}
            <button
              type="button"
              onClick={onOpenNotifications}
              style={{
                position: 'relative',
                padding: '0.45rem 0.75rem',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Notifikasi Sistem"
            >
              <Bell size={15} color={unreadCount > 0 ? '#f59e0b' : 'var(--text-secondary)'} />
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '0.08rem 0.4rem',
                  borderRadius: '999px',
                  lineHeight: 1
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Primary Action Button (e.g. + Tambah Item when on items tab) */}
            {adminTab === 'items' && onOpenCreateItem && !(settings?.dormancy_status === 'suspended' || settings?.is_suspended) && (
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenCreateItem}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 1.05rem',
                  borderRadius: '0.55rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} />
                <span>Tambah Item</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Canvas */}
        <main
          style={{
            flex: 1,
            padding: '2rem 2.25rem 4rem 2.25rem',
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default MerchantAdminShell;
