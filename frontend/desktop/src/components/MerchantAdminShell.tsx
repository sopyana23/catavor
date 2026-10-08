import React, { useState } from 'react';
import { NotificationHeaderPopover } from './NotificationHeaderPopover';
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
  HardDrive,
  Search,
  FolderTree,
  Package,
  X
} from 'lucide-react';

export interface MerchantAdminShellProps {
  adminTab: 'items' | 'categories' | 'analytics' | 'notifications' | 'settings' | 'profile' | 'policies' | 'help' | 'subscription' | 'audit_logs' | 'rbac' | 'portal';
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
  notifications?: any[];
  onMarkAsRead?: (id: string | number) => void;
  onMarkAllAsRead?: () => void;
  onSelectNotification?: (notif: any) => void;
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
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectNotification,
  children
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const storeDropdownRef = React.useRef<HTMLDivElement>(null);
  const notifTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!showStoreDropdown) {
      setStoreSearchQuery('');
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStoreDropdown, setShowStoreDropdown]);

  // Filter stores when search is typed and keep active store at the very top
  const filteredStores = React.useMemo(() => {
    let list = userStores;
    if (storeSearchQuery.trim()) {
      const q = storeSearchQuery.toLowerCase().trim();
      list = userStores.filter((s: any) => {
        const title = (s.store_title || '').toLowerCase();
        const slug = (s.slug || '').toLowerCase();
        return title.includes(q) || slug.includes(q);
      });
    }

    const curSlug = (storeSlug || '').toLowerCase();
    return [...list].sort((a: any, b: any) => {
      const isACurrent = (a.slug || '').toLowerCase() === curSlug;
      const isBCurrent = (b.slug || '').toLowerCase() === curSlug;
      if (isACurrent && !isBCurrent) return -1;
      if (!isACurrent && isBCurrent) return 1;
      return 0;
    });
  }, [userStores, storeSearchQuery, storeSlug]);

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
        },
        {
          id: 'categories',
          label: 'Kategori Etalase',
          icon: <FolderTree size={18} />
        }
      ]
    },
    {
      group: 'Performa & Bisnis',
      items: [
        {
          id: 'analytics',
          label: 'Statistik & Trafik',
          icon: <BarChart3 size={18} />
        }
      ]
    },
    {
      group: 'Pengaturan & Akun',
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
          label: 'Profil & Log Akun',
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
      case 'categories': return 'Manajemen Kategori & Etalase Katalog';
      case 'analytics': return 'Statistik & Analisis Trafik';
      case 'subscription': return 'Paket Langganan & Kuota Toko';
      case 'notifications': return 'Pusat Notifikasi Sistem';
      case 'audit_logs': return 'Riwayat Aktivitas & Audit Trail';
      case 'settings': return 'Pengaturan Profil & Tampilan Katalog';
      case 'profile': return 'Profil Pengelola & Log Aktivitas Akun';
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
          ref={storeDropdownRef}
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
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{storeSlug}</span>
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '4px',
                      backgroundColor: settings?.plan === 'pro_business' ? 'rgba(245, 158, 11, 0.2)' : settings?.plan === 'pro_starter' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: settings?.plan === 'pro_business' ? '#f59e0b' : settings?.plan === 'pro_starter' ? '#38bdf8' : '#34d399',
                      textTransform: 'uppercase',
                      flexShrink: 0
                    }}>
                      {settings?.plan === 'pro_business' ? 'PRO' : settings?.plan === 'pro_starter' ? 'STARTER' : 'FREE'}
                    </span>
                  </div>
                </div>

                <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: showStoreDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
              </button>
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

          {/* Enhanced Store Switcher Dropdown Popover */}
          {showStoreDropdown && (
            <div 
              style={{
                position: 'absolute',
                top: isSidebarCollapsed ? '12px' : 'calc(100% + 8px)',
                left: isSidebarCollapsed ? 'calc(100% + 10px)' : '1.15rem',
                width: '348px',
                maxWidth: 'calc(100vw - 32px)',
                backgroundColor: 'var(--bg-card, #0f172a)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                borderRadius: '0.9rem',
                boxShadow: '0 20px 48px -6px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--border-light)',
                padding: '0.75rem',
                zIndex: 100,
                color: 'var(--text-primary)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                animation: 'dropdownFadeInScale 0.15s ease-out'
              }}
            >
              {/* Header: Title and User Email */}
              <div style={{
                padding: '0.2rem 0.25rem 0.55rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                  Katalog Anda ({userStores.length})
                </span>
                <span 
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '170px',
                    textAlign: 'right'
                  }}
                  title={adminUser?.email}
                >
                  {adminUser?.email}
                </span>
              </div>

              {/* Quick Search for 4+ Catalogs */}
              {userStores.length >= 4 && (
                <div style={{ position: 'relative', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Cari katalog atau @slug..."
                    value={storeSearchQuery}
                    onChange={(e) => setStoreSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '0.38rem 1.8rem 0.38rem 1.85rem',
                      fontSize: '0.74rem',
                      borderRadius: '0.45rem',
                      backgroundColor: 'var(--bg-deep, #090e17)',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border-light, rgba(255, 255, 255, 0.1))')}
                  />
                  {storeSearchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStoreSearchQuery('');
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Bersihkan pencarian"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable List with Smooth Aesthetic */}
              <div 
                className="store-switcher-scroll-area catavor-custom-scrollbar"
                style={{
                  maxHeight: '275px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '0.4rem 0.35rem 0.4rem 0.15rem',
                  margin: '0 -0.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                {filteredStores.length === 0 ? (
                  <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                    <Store size={22} style={{ margin: '0 auto 0.35rem', opacity: 0.35, display: 'block' }} />
                    <div>Tidak ada katalog sesuai &quot;{storeSearchQuery}&quot;</div>
                  </div>
                ) : (
                  filteredStores.map((s: any) => {
                    const isCurrent = s.slug.toLowerCase() === (storeSlug || '').toLowerCase();
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (!isCurrent) {
                            setShowStoreDropdown(false);
                            handleSwitchStore(s.slug);
                          }
                        }}
                        className={`store-dropdown-item ${isCurrent ? 'active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.52rem 0.65rem',
                          borderRadius: '0.65rem',
                          backgroundColor: isCurrent ? 'var(--primary-glow)' : 'transparent',
                          border: isCurrent ? '1.5px solid var(--primary)' : '1px solid transparent',
                          boxShadow: isCurrent ? '0 0 0 1px var(--primary-glow)' : 'none',
                          cursor: isCurrent ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                          gap: '0.55rem',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: isCurrent ? 'var(--primary)' : 'var(--bg-card-hover)',
                            color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            flexShrink: 0,
                            overflow: 'hidden',
                            border: isCurrent ? 'none' : '1px solid var(--border-light)'
                          }}>
                            {s.store_logo_url ? (
                              <img src={s.store_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (s.store_title || s.slug).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div 
                              style={{ 
                                fontSize: '0.8rem', 
                                fontWeight: 700, 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                color: isCurrent ? 'var(--primary)' : 'var(--text-primary)'
                              }}
                              title={s.store_title || s.slug}
                            >
                              {s.store_title || s.slug}
                            </div>
                            <div 
                              style={{ 
                                fontSize: '0.67rem', 
                                color: 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              @{s.slug} {s.item_count !== undefined ? `• ${s.item_count} item` : ''}
                            </div>
                          </div>
                        </div>

                        {isCurrent ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              flexShrink: 0
                            }}
                            title="Katalog Aktif"
                          >
                            <Check size={13} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <span 
                            className="store-item-switch-pill"
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem', 
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              padding: '0.2rem 0.45rem',
                              borderRadius: '5px',
                              backgroundColor: 'var(--bg-deep, rgba(0,0,0,0.05))',
                              border: '1px solid var(--border-light)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>Pindah</span>
                            <ChevronRight size={12} />
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ paddingTop: '0.55rem', borderTop: '1px solid var(--border-light)', marginTop: '0.35rem', display: 'flex', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStoreDropdown(false);
                    openStoreChooserModal();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.6rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                >
                  <Store size={14} />
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
                    padding: '0.5rem 0.6rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'var(--primary-glow)',
                    border: '1px dashed var(--primary)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={14} />
                  <span>Buat Baru</span>
                </button>
              </div>
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

            {/* Notification Bell & Popover (Desktop) */}
            <div style={{ position: 'relative' }}>
              <button
                ref={notifTriggerRef}
                type="button"
                onClick={() => {
                  if (onOpenNotifications) {
                    onOpenNotifications();
                  }
                  setShowNotifPopover(prev => !prev);
                }}
                style={{
                  position: 'relative',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: showNotifPopover ? 'var(--primary-glow)' : 'var(--bg-card-hover)',
                  border: showNotifPopover ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Pusat Notifikasi Sistem"
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

              <NotificationHeaderPopover
                isOpen={showNotifPopover}
                onClose={() => setShowNotifPopover(false)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={(id) => onMarkAsRead?.(id)}
                onMarkAllAsRead={() => onMarkAllAsRead?.()}
                onSelectNotification={(notif) => {
                  setShowNotifPopover(false);
                  onSelectNotification?.(notif);
                }}
                onViewAllNotifications={() => {
                  setShowNotifPopover(false);
                  setAdminTab('notifications');
                  const slug = storeSlug;
                  if (slug) window.history.pushState({}, '', `/${slug}/admin/notifications`);
                }}
                triggerRef={notifTriggerRef}
              />
            </div>

            {/* Header Action Buttons for items & categories */}
            {!(settings?.dormancy_status === 'suspended' || settings?.is_suspended) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {adminTab === 'items' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAdminTab('categories');
                      if (storeSlug) window.history.pushState({}, '', `/${storeSlug}/admin/categories`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '0.55rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--border-light)'
                    }}
                    title="Kelola Taksonomi Kategori Etalase"
                  >
                    <FolderTree size={15} style={{ color: 'var(--primary)' }} />
                    <span>Kelola Kategori</span>
                  </button>
                )}

                {adminTab === 'categories' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAdminTab('items');
                      if (storeSlug) window.history.pushState({}, '', `/${storeSlug}/admin/items`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '0.55rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--border-light)'
                    }}
                    title="Buka Pengelolaan Daftar Item & Produk"
                  >
                    <Package size={15} style={{ color: 'var(--primary)' }} />
                    <span>Kelola Daftar Item</span>
                  </button>
                )}

                {onOpenCreateItem && adminTab === 'items' && (
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
