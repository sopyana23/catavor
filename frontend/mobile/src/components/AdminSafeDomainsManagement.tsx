import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Save,
  Check,
  X,
  Lock,
  ExternalLink,
  Copy,
  Sliders,
  Sparkles,
  ShieldCheck,
  Tag,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { loadDynamicSafeDomains } from '../utils/urlSecurity';

export interface SafeDomainItem {
  id: number;
  domain: string;
  category: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AdminSafeDomainsManagementProps {
  token: string;
  themeMode?: 'dark' | 'light';
  onClose?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Google: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  Komunikasi: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  'Media Sosial': { bg: 'rgba(236, 72, 153, 0.12)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
  Platform: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
  Produktivitas: { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
  Finansial: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  Mitra: { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
  Umum: { bg: 'rgba(100, 116, 139, 0.12)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' }
};

export const AdminSafeDomainsManagement: React.FC<AdminSafeDomainsManagementProps> = ({
  token,
  themeMode = 'dark',
  onClose
}) => {
  const isDark = themeMode === 'dark';

  const theme = {
    bg: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#0f172a' : '#ffffff',
    card: isDark ? '#1e293b' : '#ffffff',
    cardAlt: isDark ? '#141d2e' : '#f1f5f9',
    cardHover: isDark ? '#273549' : '#f8fafc',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#cbd5e1' : '#475569',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    modalBg: isDark ? '#0f172a' : '#ffffff'
  };

  const [domains, setDomains] = useState<SafeDomainItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1
  });
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Debounce search query 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page to 1 when search or category changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  // Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<SafeDomainItem | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);
  const [formData, setFormData] = useState({
    domain: '',
    category: 'Google',
    description: '',
    is_active: true
  });

  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchDomains = async (targetPage = page, targetSearch = debouncedSearch, targetCat = selectedCategory, targetLimit = limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(targetLimit));
      if (targetCat && targetCat !== 'Semua') {
        params.set('category', targetCat);
      }
      if (targetSearch.trim()) {
        params.set('q', targetSearch.trim());
      }

      const res = await fetch(`/api/admin/safe-domains?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Gagal memuat data master domain');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDomains(json.data);
        if (json.pagination) {
          setPagination({
            page: Number(json.pagination.page || targetPage),
            limit: Number(json.pagination.limit || targetLimit),
            total: Number(json.pagination.total ?? json.pagination.total_items ?? json.data.length),
            total_pages: Number(json.pagination.total_pages || 1)
          });
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data domain', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains(page, debouncedSearch, selectedCategory, limit);
  }, [token, page, debouncedSearch, selectedCategory, limit]);

  const categories = useMemo(() => {
    const list = ['Semua', 'Google', 'Komunikasi', 'Media Sosial', 'Platform', 'Produktivitas', 'Finansial', 'Mitra', 'Umum'];
    return list;
  }, []);

  const stats = useMemo(() => {
    const total = pagination.total || domains.length;
    const active = domains.filter(d => d.is_active).length;
    const system = domains.filter(d => d.is_system).length;
    const custom = domains.filter(d => !d.is_system).length;
    return { total, active, system, custom };
  }, [pagination.total, domains]);

  const handleOpenAdd = () => {
    setEditingDomain(null);
    setFormData({
      domain: '',
      category: 'Google',
      description: '',
      is_active: true
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (item: SafeDomainItem) => {
    setEditingDomain(item);
    setFormData({
      domain: item.domain,
      category: item.category || 'Umum',
      description: item.description || '',
      is_active: item.is_active
    });
    setShowFormModal(true);
  };

  const handleToggleActive = async (item: SafeDomainItem) => {
    try {
      const nextStatus = !item.is_active;
      const res = await fetch(`/api/admin/safe-domains/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: nextStatus })
      });
      if (!res.ok) throw new Error('Gagal mengubah status domain');
      
      setDomains(prev => prev.map(d => (d.id === item.id ? { ...d, is_active: nextStatus } : d)));
      loadDynamicSafeDomains(true);
      showToast(`Domain ${item.domain} ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (item: SafeDomainItem) => {
    if (!window.confirm(`Hapus domain '${item.domain}' dari master whitelist?`)) return;
    try {
      const res = await fetch(`/api/admin/safe-domains/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Gagal menghapus domain');
      
      setDomains(prev => prev.filter(d => d.id !== item.id));
      loadDynamicSafeDomains(true);
      showToast(`Domain ${item.domain} berhasil dihapus`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus domain', 'error');
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Sinkronkan dan lengkapi domain standar ekosistem bawaan?')) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/safe-domains/reset-defaults', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Gagal menyinkronkan default');
      await fetchDomains();
      loadDynamicSafeDomains(true);
      showToast('Master whitelist domain berhasil disinkronkan dengan default');
    } catch (err: any) {
      showToast(err.message || 'Gagal sinkronisasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDomain(true);
    try {
      let clean = formData.domain.trim().toLowerCase();
      clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0];
      if (!clean) throw new Error('Nama domain tidak boleh kosong');

      const url = editingDomain ? `/api/admin/safe-domains/${editingDomain.id}` : '/api/admin/safe-domains';
      const method = editingDomain ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: clean,
          category: formData.category,
          description: formData.description,
          is_active: formData.is_active
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan domain');
      }

      setShowFormModal(false);
      await fetchDomains();
      loadDynamicSafeDomains(true);
      showToast(editingDomain ? 'Domain berhasil diperbarui' : 'Domain berhasil ditambahkan');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan domain', 'error');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleCopy = (dom: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(dom);
    setCopiedDomain(dom);
    setTimeout(() => setCopiedDomain(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          padding: '0.65rem 1.2rem',
          borderRadius: '999px',
          backgroundColor: toastMsg.type === 'success' ? '#10b981' : toastMsg.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          maxWidth: '92%',
          backdropFilter: 'blur(8px)',
          animation: 'fadeInDown 0.25s ease-out'
        }}>
          {toastMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '1rem',
        backgroundColor: theme.surface,
        border: `1px solid ${theme.border}`,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.85rem',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#38bdf8' : '#0284c7',
              flexShrink: 0
            }}>
              <Globe size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                Master Whitelist Domain Aman
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                Konfigurasi domain resmi &amp; mitra yang dibuka instan tanpa peringatan perantara
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Sinkronkan domain bawaan"
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '0.65rem',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                border: `1px solid ${theme.border}`,
                color: theme.textSecondary,
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Sinkron Default</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 10px rgba(56, 189, 248, 0.3)'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Tambah Domain</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '0.6rem',
          paddingTop: '0.65rem',
          borderTop: `1px solid ${theme.border}`
        }}>
          <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '0.66rem', color: theme.textMuted, display: 'block', fontWeight: 700 }}>TOTAL DOMAIN</span>
            <strong style={{ fontSize: '1.1rem', color: theme.textPrimary, fontWeight: 900 }}>{stats.total}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '0.66rem', color: '#10b981', display: 'block', fontWeight: 700 }}>STATUS AKTIF</span>
            <strong style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: 900 }}>{stats.active}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '0.66rem', color: isDark ? '#38bdf8' : '#0284c7', display: 'block', fontWeight: 700 }}>DEFAULT SISTEM</span>
            <strong style={{ fontSize: '1.1rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900 }}>{stats.system}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.75rem', borderRadius: '0.65rem', backgroundColor: theme.cardAlt, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '0.66rem', color: '#a855f7', display: 'block', fontWeight: 700 }}>KUSTOM ADMIN</span>
            <strong style={{ fontSize: '1.1rem', color: '#a855f7', fontWeight: 900 }}>{stats.custom}</strong>
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari domain aman, kategori, atau catatan (misal: gemini, wa.me, google)..."
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem 0.65rem 2.35rem',
              borderRadius: '0.75rem',
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {categories.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isActive
                    ? '1px solid #38bdf8'
                    : `1px solid ${theme.border}`,
                  backgroundColor: isActive
                    ? (isDark ? 'rgba(56, 189, 248, 0.18)' : '#0284c7')
                    : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'),
                  color: isActive
                    ? (isDark ? '#38bdf8' : '#ffffff')
                    : theme.textSecondary,
                  transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Domain Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {loading && domains.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: theme.textMuted, fontSize: '0.82rem' }}>
            <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <span>Memuat data master whitelist...</span>
          </div>
        ) : domains.length === 0 ? (
          <div style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: theme.surface,
            borderRadius: '1rem',
            border: `1px dashed ${theme.border}`,
            color: theme.textMuted
          }}>
            <Globe size={32} style={{ margin: '0 auto 0.6rem', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: theme.textPrimary }}>
              Tidak ada domain yang sesuai
            </p>
            <span style={{ fontSize: '0.74rem' }}>
              Coba kata kunci pencarian lain atau klik Tambah Domain.
            </span>
          </div>
        ) : (
          domains.map(item => {
            const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Umum;
            return (
              <div
                key={item.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${item.is_active ? theme.border : (isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.3)')}`,
                  opacity: item.is_active ? 1 : 0.65,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  transition: 'border-color 0.2s ease, opacity 0.2s ease'
                }}
              >
                {/* Domain Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <strong style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: theme.textPrimary,
                      fontFamily: 'monospace',
                      letterSpacing: '-0.01em'
                    }}>
                      {item.domain}
                    </strong>

                    {/* Category Pill */}
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.35rem',
                      backgroundColor: catStyle.bg,
                      color: catStyle.text,
                      border: `1px solid ${catStyle.border}`
                    }}>
                      {item.category}
                    </span>

                    {/* System Badge */}
                    {item.is_system && (
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.3rem',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                        color: theme.textMuted
                      }}>
                        SISTEM
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <span style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.35 }}>
                      {item.description}
                    </span>
                  )}
                </div>

                {/* Right Action Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopy(item.domain, e)}
                    title="Salin domain"
                    style={{
                      padding: '0.35rem',
                      borderRadius: '0.45rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                      border: 'none',
                      color: copiedDomain === item.domain ? '#10b981' : theme.textSecondary,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedDomain === item.domain ? <Check size={13} /> : <Copy size={13} />}
                  </button>

                  {/* Test Visit External Link */}
                  <a
                    href={`https://${item.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Uji buka https://${item.domain}`}
                    style={{
                      padding: '0.35rem',
                      borderRadius: '0.45rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13} />
                  </a>

                  {/* Active Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    title={item.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                    style={{
                      padding: '0.22rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: item.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.is_active ? '#10b981' : '#ef4444'
                    }}
                  >
                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    title="Edit domain"
                    style={{
                      padding: '0.35rem',
                      borderRadius: '0.45rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                      border: 'none',
                      color: theme.textSecondary,
                      cursor: 'pointer'
                    }}
                  >
                    <Edit2 size={13} />
                  </button>

                  {/* Delete Button (Allowed for all or custom) */}
                  {!item.is_system && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      title="Hapus domain"
                      style={{
                        padding: '0.35rem',
                        borderRadius: '0.45rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Server-Side Pagination Controls */}
      {pagination.total_pages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          padding: '0.75rem 0.5rem',
          borderTop: `1px solid ${theme.border}`,
          marginTop: '0.5rem'
        }}>
          <div style={{ fontSize: '0.74rem', color: theme.textSecondary }}>
            {(() => {
              const totalCount = Number(pagination.total ?? (pagination as any).total_items ?? domains.length);
              const startIdx = totalCount > 0 ? ((page - 1) * limit) + 1 : 0;
              const endIdx = Math.min(page * limit, totalCount);
              return (
                <span>
                  Menampilkan <strong style={{ color: theme.textPrimary }}>{startIdx}</strong> - <strong style={{ color: theme.textPrimary }}>{endIdx}</strong> dari <strong style={{ color: theme.textPrimary }}>{totalCount}</strong> domain
                </span>
              );
            })()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.cardAlt,
                color: page <= 1 ? theme.textMuted : theme.textPrimary,
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={14} />
              <span>Sebelumnya</span>
            </button>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.35rem 0.65rem',
              borderRadius: '0.5rem',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
              color: isDark ? '#38bdf8' : '#0284c7'
            }}>
              {page} / {pagination.total_pages}
            </span>

            <button
              type="button"
              disabled={page >= pagination.total_pages || loading}
              onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.cardAlt,
                color: page >= pagination.total_pages ? theme.textMuted : theme.textPrimary,
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: page >= pagination.total_pages ? 'not-allowed' : 'pointer',
                opacity: page >= pagination.total_pages ? 0.5 : 1
              }}
            >
              <span>Berikutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal / Bottom Sheet Form: Tambah / Edit Safe Domain */}
      {showFormModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 14000,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setShowFormModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: theme.surface,
              borderRadius: '1.25rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 15px 35px rgba(0,0,0,0.15)',
              padding: '1.35rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.75rem',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#38bdf8' : '#0284c7'
                }}>
                  <Globe size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: theme.textPrimary }}>
                    {editingDomain ? 'Edit Domain Whitelist' : 'Tambah Domain Aman'}
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                    Domain yang diizinkan untuk navigasi langsung
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                  Nama Host / Domain <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={e => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="misal: zoom.us, meet.google.com, t.me"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.66rem', color: theme.textMuted, marginTop: '0.2rem', display: 'block' }}>
                  💡 Protokol (https://) dan tanda garis miring (/) akan dibersihkan otomatis.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                  Kategori Domain
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Google">Google Ecosystem</option>
                  <option value="Komunikasi">Komunikasi &amp; Chat</option>
                  <option value="Media Sosial">Media Sosial</option>
                  <option value="Platform">Platform Catavor</option>
                  <option value="Produktivitas">Produktivitas &amp; Dev</option>
                  <option value="Finansial">Finansial &amp; Bank</option>
                  <option value="Mitra">Mitra Resmi</option>
                  <option value="Umum">Umum / Lainnya</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textSecondary, display: 'block', marginBottom: '0.3rem' }}>
                  Keterangan / Fungsi Domain
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="misal: Layanan video conference meeting resmi"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.4rem', borderTop: `1px solid ${theme.border}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: theme.textPrimary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Status Aktif</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingDomain}
                    style={{
                      padding: '0.45rem 1.15rem',
                      borderRadius: '0.55rem',
                      backgroundColor: isDark ? '#38bdf8' : '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      opacity: savingDomain ? 0.6 : 1
                    }}
                  >
                    {savingDomain && <RefreshCw size={13} className="animate-spin" />}
                    <span>{editingDomain ? 'Simpan Perubahan' : 'Tambahkan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
