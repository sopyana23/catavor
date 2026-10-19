import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Store,
  AlertOctagon,
  LifeBuoy,
  CreditCard,
  Radio,
  Cpu,
  Flame,
  Layers,
  History,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';

export interface TabletRailNavProps {
  activeView: string;
  onSwitchView: (view: string) => void;
  currentUser: any;
  roleBadge: string;
  isDark: boolean;
  toggleTheme: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  pendingReportsCount?: number;
  urgentTicketsCount?: number;
  actionRequiredTicketsCount?: number;
}

export const TabletRailNav: React.FC<TabletRailNavProps> = ({
  activeView,
  onSwitchView,
  currentUser,
  roleBadge,
  isDark,
  toggleTheme,
  onLogout,
  onRefresh,
  isRefreshing = false,
  pendingReportsCount = 0,
  urgentTicketsCount = 0,
  actionRequiredTicketsCount = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { key: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
    { key: 'staff', label: 'Staf & RBAC', icon: ShieldCheck },
    { key: 'stores', label: 'Direktori Toko', icon: Store },
    {
      key: 'reports',
      label: 'Kepatuhan & Laporan',
      icon: AlertOctagon,
      badge: pendingReportsCount > 0 ? pendingReportsCount : null,
      badgeColor: '#ef4444'
    },
    {
      key: 'support',
      label: 'Bantuan CS',
      icon: LifeBuoy,
      badge: (urgentTicketsCount + actionRequiredTicketsCount) > 0 ? (urgentTicketsCount + actionRequiredTicketsCount) : null,
      badgeColor: '#f59e0b'
    },
    { key: 'finance', label: 'Keuangan & Billing', icon: CreditCard },
    { key: 'broadcast', label: 'Siaran Broadcast', icon: Radio },
    { key: 'automation', label: 'Mesin Otomatisasi', icon: Cpu },
    { key: 'monetization', label: 'Monetisasi & Ads', icon: Flame },
    { key: 'master-data', label: 'Master Data & Rekber', icon: Layers },
    { key: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <aside
      style={{
        width: isExpanded ? '240px' : '74px',
        height: '100vh',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 100,
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* Top Header / Branding */}
      <div>
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          padding: isExpanded ? '0 1rem' : '0',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              fontWeight: 800,
              fontSize: '1.05rem',
              flexShrink: 0
            }}>
              C
            </div>
            {isExpanded && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Catavor Tablet
                </div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                  Console Pengelola
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Ciutkan Menu' : 'Perluas Menu'}
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
              cursor: 'pointer'
            }}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation List */}
        <nav style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSwitchView(item.key)}
                title={item.label}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: isExpanded ? '0 0.85rem' : '0',
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  borderRadius: '0.65rem',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: isActive ? '#10b981' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} style={{ flexShrink: 0 }} />
                {isExpanded && <span>{item.label}</span>}

                {/* Badge Indicator */}
                {item.badge !== null && (
                  <span style={{
                    position: isExpanded ? 'static' : 'absolute',
                    top: isExpanded ? 'auto' : '6px',
                    right: isExpanded ? 'auto' : '10px',
                    marginLeft: isExpanded ? 'auto' : '0',
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '999px',
                    backgroundColor: item.badgeColor || '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions: Theme, Refresh, User Profile, Logout */}
      <div style={{
        padding: '0.75rem 0.5rem',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }}>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Segarkan Data"
            style={{
              width: '100%',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: isExpanded ? '0 0.85rem' : '0',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              borderRadius: '0.65rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: isRefreshing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} style={{ flexShrink: 0 }} />
            {isExpanded && <span>Segarkan Data</span>}
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Terang' : 'Beralih ke Gelap'}
          style={{
            width: '100%',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: isExpanded ? '0 0.85rem' : '0',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          {isDark ? <Sun size={18} style={{ flexShrink: 0 }} /> : <Moon size={18} style={{ flexShrink: 0 }} />}
          {isExpanded && <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>}
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
            padding: isExpanded ? '0 0.85rem' : '0',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            borderRadius: '0.65rem',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#ef4444',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {isExpanded && <span>Keluar Portal</span>}
        </button>
      </div>
    </aside>
  );
};
