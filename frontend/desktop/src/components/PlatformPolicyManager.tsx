import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Scale,
  ShieldAlert,
  Lock,
  CheckCircle2,
  CreditCard,
  Building2,
  ArrowLeft,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  FileEdit,
  History,
  Check,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight
} from 'lucide-react';
import {
  PlatformPoliciesView,
  type PolicyKey,
  type PolicyArticle,
  type DraftPolicyOverride
} from './PlatformPoliciesView';
import {
  FALLBACK_POLICY_SECTIONS,
  type PolicyAuditLogItem
} from '../utils/policyShared';
import { DesktopCustomSelect, type SelectOption } from './DesktopCustomSelect';
import { useModalBackHandler } from '../utils/navigation';

export interface PlatformPolicyTheme {
  surface: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  cardShadow?: string;
}

export interface PlatformPolicyManagerProps {
  token: string;
  isDark: boolean;
  theme: PlatformPolicyTheme;
  onBack: () => void;
  backLabel?: string;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

interface EditablePolicyDoc {
  type: PolicyKey;
  title: string;
  category: string;
  badge: string;
  summary: string;
  version: string;
  articles: PolicyArticle[];
  changeType: 'minor' | 'major';
  summaryOfChanges: string;
  requiresAcceptance: boolean;
}

interface PolicyMetadataEntry {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  defaultCategory: string;
  defaultBadge: string;
}

const POLICY_METADATA: Record<PolicyKey, PolicyMetadataEntry> = {
  terms: { label: 'Syarat & Ketentuan', icon: Scale, defaultCategory: 'Ketentuan Umum & Kedudukan Hukum', defaultBadge: 'Dokumen Perjanjian Pengelola' },
  prohibited: { label: 'Komoditas Terlarang', icon: ShieldAlert, defaultCategory: 'Kepatuhan Mutlak (Zero Tolerance)', defaultBadge: 'Wajib Dipatuhi Pengelola' },
  privacy: { label: 'Kebijakan Privasi & B2B', icon: Lock, defaultCategory: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)', defaultBadge: 'Standar Perlindungan Privasi' },
  moderation: { label: 'Moderasi & Sanksi', icon: CheckCircle2, defaultCategory: 'Prosedur Disiplin Ekosistem', defaultBadge: 'Transparansi & Akuntabilitas' },
  transactions: { label: 'Transaksi & Rekber', icon: CheckCircle2, defaultCategory: 'Integritas Pembayaran & Sengketa', defaultBadge: 'Prosedur Keamanan Keuangan' },
  subscription: { label: 'Langganan & Kuota', icon: CreditCard, defaultCategory: 'Model Layanan Bisnis & Kuota', defaultBadge: 'Ketentuan Komersial Merchant' }
};

const CHANGE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'minor', label: 'MINOR (Perbaikan Redaksional / Penjelasan)' },
  { value: 'major', label: 'MAJOR (Perubahan Substansial / Regulasi Baru)' }
];

const PER_PAGE_OPTIONS: SelectOption[] = [
  { value: '10', label: '10 baris' },
  { value: '25', label: '25 baris' },
  { value: '50', label: '50 baris' },
  { value: '100', label: '100 baris' }
];

async function authFetchJson(url: string, propToken: string, init?: RequestInit) {
  const activeToken = propToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('catavor_token') || '' : '');
  const headers = new Headers(init?.headers || {});
  if (activeToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${activeToken}`);
  }
  const res = await fetch(url, { ...init, headers });
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed && typeof localStorage !== 'undefined') {
    localStorage.setItem('catavor_token', refreshed);
  }
  return res.json();
}

export const PlatformPolicyManager: React.FC<PlatformPolicyManagerProps> = ({
  token,
  isDark,
  theme,
  onBack,
  backLabel = 'Kembali',
  onNotify
}) => {
  const [selectedKey, setSelectedKey] = useState<PolicyKey>('terms');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  useModalBackHandler({
    isOpen: showResetModal,
    onClose: () => {
      if (!isResetting) setShowResetModal(false);
    },
    modalId: 'desktop-policy-reset-modal'
  });

  // Global Legal Settings State
  const [legalEntityName, setLegalEntityName] = useState('PT Catavor Media Digital');
  const [legalJurisdiction, setLegalJurisdiction] = useState('Hukum Republik Indonesia');
  const [legalWarningBanner, setLegalWarningBanner] = useState('');
  const [isSavingGlobalSettings, setIsSavingGlobalSettings] = useState(false);

  // Active Policy Editor State
  const [editableDoc, setEditableDoc] = useState<EditablePolicyDoc>({
    type: 'terms',
    title: '',
    category: '',
    badge: '',
    summary: '',
    version: 'v2.0',
    articles: [],
    changeType: 'minor',
    summaryOfChanges: '',
    requiresAcceptance: false
  });

  // Server-Side Paginated Audit Logs State (AGENTS.md Rule 7.C.1)
  const [auditLogs, setAuditLogs] = useState<PolicyAuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPerPage, setAuditPerPage] = useState<number>(25);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const [quickJumpInput, setQuickJumpInput] = useState<string>('');

  // Load Policies and Settings (stable callback: parent scroll/render never resets draft!)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [policiesRes, settingsRes, publicSettingsRes] = await Promise.all([
        fetch('/api/policies').then(r => r.json()).catch(() => null),
        token ? authFetchJson('/api/admin/settings', token).catch(() => null) : fetch('/api/settings').then(r => r.json()).catch(() => null),
        fetch('/api/settings/public').then(r => r.json()).catch(() => null)
      ]);

      const sData =
        settingsRes && settingsRes.success && settingsRes.data
          ? settingsRes.data
          : publicSettingsRes && publicSettingsRes.success
          ? publicSettingsRes.data
          : null;

      if (sData) {
        if (sData.legal_entity_name) setLegalEntityName(String(sData.legal_entity_name));
        if (sData.legal_jurisdiction) setLegalJurisdiction(String(sData.legal_jurisdiction));
        if (sData.legal_warning_banner) setLegalWarningBanner(String(sData.legal_warning_banner));
      }

      const fallbackDoc = FALLBACK_POLICY_SECTIONS.find(f => f.key === selectedKey) || FALLBACK_POLICY_SECTIONS[0];

      if (policiesRes && policiesRes.success && policiesRes.data && policiesRes.data[selectedKey]) {
        const raw = policiesRes.data[selectedKey];
        let articles: PolicyArticle[] = fallbackDoc.articles;
        let category = POLICY_METADATA[selectedKey].defaultCategory;
        let badge = POLICY_METADATA[selectedKey].defaultBadge;
        let summary = fallbackDoc.summary;

        if (raw.sections) {
          let parsed: unknown = raw.sections;
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch {
              parsed = null;
            }
          }
          if (parsed && typeof parsed === 'object') {
            const sec = parsed as Record<string, unknown>;
            if (Array.isArray(sec.articles) && sec.articles.length > 0) {
              articles = (sec.articles as Array<Record<string, unknown>>).map((a, idx) => ({
                number: typeof a?.number === 'string' && a.number.trim() ? a.number : `Pasal ${idx + 1}`,
                heading: typeof a?.heading === 'string' ? a.heading : '',
                content: typeof a?.content === 'string' ? a.content : '',
                highlights: Array.isArray(a?.highlights) ? a.highlights.map(h => String(h ?? '')) : []
              }));
            }
            if (typeof sec.category === 'string' && sec.category.trim()) category = sec.category;
            if (typeof sec.badge === 'string' && sec.badge.trim()) badge = sec.badge;
            if (typeof sec.summary === 'string' && sec.summary.trim()) summary = sec.summary;
          }
        }

        setEditableDoc({
          type: selectedKey,
          title: raw.title ? String(raw.title) : fallbackDoc.title,
          category,
          badge,
          summary,
          version: raw.version ? String(raw.version) : 'v2.0',
          articles,
          changeType: raw.change_type === 'major' ? 'major' : 'minor',
          summaryOfChanges: '',
          requiresAcceptance: Boolean(raw.requires_acceptance)
        });
      } else {
        setEditableDoc({
          type: selectedKey,
          title: fallbackDoc.title,
          category: fallbackDoc.category,
          badge: fallbackDoc.badge,
          summary: fallbackDoc.summary,
          version: fallbackDoc.version || 'v2.0',
          articles: fallbackDoc.articles,
          changeType: 'minor',
          summaryOfChanges: '',
          requiresAcceptance: false
        });
      }
    } catch {
      notifyRef.current('Gagal memuat konfigurasi kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Paginated Audit Trail Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setIsLoadingLogs(true);
    try {
      const json = await authFetchJson(
        `/api/admin/settings/policy-audit-logs?page=${auditPage}&per_page=${auditPerPage}`,
        token
      );
      if (json && json.success && Array.isArray(json.data)) {
        setAuditLogs(json.data as PolicyAuditLogItem[]);
        const total = typeof json.total === 'number' ? json.total : json.data.length;
        const pages = typeof json.total_pages === 'number' ? Math.max(1, json.total_pages) : Math.max(1, Math.ceil(total / auditPerPage));
        setAuditTotal(total);
        setAuditTotalPages(pages);
      }
    } catch {
      // Graceful
    } finally {
      setIsLoadingLogs(false);
    }
  }, [token, auditPage, auditPerPage]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  const draftOverride: DraftPolicyOverride = useMemo(
    () => ({
      key: selectedKey,
      title: editableDoc.title,
      version: editableDoc.version,
      category: editableDoc.category,
      badge: editableDoc.badge,
      summary: editableDoc.summary,
      articles: editableDoc.articles
    }),
    [selectedKey, editableDoc]
  );

  // Save Global Legal Settings
  const handleSaveGlobalSettings = async () => {
    if (!token) {
      notifyRef.current('Autentikasi diperlukan.', 'error');
      return;
    }
    setIsSavingGlobalSettings(true);
    try {
      const data = await authFetchJson('/api/admin/settings', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_entity_name: legalEntityName,
          legal_jurisdiction: legalJurisdiction,
          legal_warning_banner: legalWarningBanner
        })
      });
      if (data && data.success) {
        notifyRef.current('Pengaturan identitas legal platform berhasil disimpan.', 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
      } else {
        notifyRef.current(data?.message || 'Gagal menyimpan pengaturan legal.', 'error');
      }
    } catch {
      notifyRef.current('Terjadi kesalahan jaringan saat menyimpan pengaturan legal.', 'error');
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  // Article Manipulation Helpers
  const handleAddArticle = () => {
    const nextNumber = `Pasal ${editableDoc.articles.length + 1}`;
    setEditableDoc(prev => ({
      ...prev,
      articles: [
        ...prev.articles,
        {
          number: nextNumber,
          heading: 'Judul Klausul / Pasal Baru',
          content: 'Uraikan isi klausul kebijakan secara lugas, transparan, dan terikat hukum di sini.',
          highlights: ['Poin sorotan kepatuhan 1']
        }
      ]
    }));
  };

  const handleUpdateArticle = (index: number, field: keyof PolicyArticle, value: string | string[]) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, articles: updated };
    });
  };

  const handleDeleteArticle = (index: number) => {
    setEditableDoc(prev => ({
      ...prev,
      articles: prev.articles.filter((_, i) => i !== index)
    }));
  };

  const handleMoveArticle = (index: number, direction: 'up' | 'down') => {
    setEditableDoc(prev => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.articles.length) return prev;
      const updated = [...prev.articles];
      const temp = updated[index];
      updated[index] = updated[target];
      updated[target] = temp;
      return { ...prev, articles: updated };
    });
  };

  const handleAddHighlight = (artIndex: number) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const curHighlights = updated[artIndex].highlights || [];
      updated[artIndex] = {
        ...updated[artIndex],
        highlights: [...curHighlights, 'Poin sorotan kepatuhan baru']
      };
      return { ...prev, articles: updated };
    });
  };

  const handleUpdateHighlight = (artIndex: number, hlIndex: number, text: string) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const curHighlights = [...(updated[artIndex].highlights || [])];
      curHighlights[hlIndex] = text;
      updated[artIndex] = { ...updated[artIndex], highlights: curHighlights };
      return { ...prev, articles: updated };
    });
  };

  const handleDeleteHighlight = (artIndex: number, hlIndex: number) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const curHighlights = (updated[artIndex].highlights || []).filter((_, i) => i !== hlIndex);
      updated[artIndex] = { ...updated[artIndex], highlights: curHighlights };
      return { ...prev, articles: updated };
    });
  };

  // Save Policy to Backend
  const handleSavePolicy = async () => {
    if (!token) {
      notifyRef.current('Autentikasi admin diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      notifyRef.current('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      notifyRef.current('Dokumen kebijakan wajib memiliki minimal 1 pasal.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const sections = {
        category: editableDoc.category,
        badge: editableDoc.badge,
        icon_key: selectedKey,
        summary: editableDoc.summary,
        articles: editableDoc.articles
      };

      const payload = {
        type: selectedKey,
        title: editableDoc.title,
        version: editableDoc.version || 'v2.1',
        sections,
        summary_of_changes: editableDoc.summaryOfChanges || `Pembaruan klausul dokumen ${editableDoc.title}`,
        change_type: editableDoc.changeType,
        requires_acceptance: editableDoc.requiresAcceptance
      };

      const json = await authFetchJson('/api/admin/settings/policies', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (json && json.success) {
        notifyRef.current(`Kebijakan ${editableDoc.title} berhasil diperbarui ke ${payload.version}.`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        notifyRef.current(json?.message || 'Gagal menyimpan pembaruan kebijakan.', 'error');
      }
    } catch {
      notifyRef.current('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async (resetAll: boolean) => {
    if (!token) return;
    setIsResetting(true);
    try {
      const json = await authFetchJson('/api/admin/settings/policies/reset-defaults', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: resetAll ? 'all' : selectedKey })
      });
      if (json && json.success) {
        notifyRef.current(
          resetAll
            ? 'Seluruh 6 dokumen kebijakan berhasil direset ke standar resmi Catavor v2.0.'
            : `Dokumen ${POLICY_METADATA[selectedKey].label} berhasil direset ke standar resmi.`,
          'success'
        );
        setShowResetModal(false);
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        notifyRef.current(json?.message || 'Gagal mereset kebijakan.', 'error');
      }
    } catch {
      notifyRef.current('Terjadi kesalahan jaringan saat mereset kebijakan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, auditPage - 2);
    const end = Math.min(auditTotalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    for (let p = adjustedStart; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [auditPage, auditTotalPages]);

  const startEntry = auditTotal === 0 ? 0 : (auditPage - 1) * auditPerPage + 1;
  const endEntry = Math.min(auditTotal, auditPage * auditPerPage);

  const SelectedIcon = POLICY_METADATA[selectedKey].icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Header Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.cardShadow,
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
            <span>{backLabel}</span>
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scale size={20} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span>Kebijakan, Regulasi &amp; Legalitas Platform</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.76rem', color: theme.textSecondary }}>
              Kelola 6 pilar kebijakan resmi Catavor, susunan pasal terstruktur, pratinjau publik real-time, dan riwayat audit SOC 2.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700
            }}
          >
            <RotateCcw size={14} strokeWidth={1.75} />
            <span>Reset ke Standar Resmi</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={14} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 2. Global Legal Identity Panel */}
      <div
        style={{
          padding: '1.15rem 1.35rem',
          borderRadius: '1rem',
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} strokeWidth={1.75} style={{ color: '#2563eb' }} />
            <div>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary, display: 'block' }}>
                Identitas Hukum &amp; Banner Peringatan Kepatuhan Platform
              </span>
              <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                Data ini ditampilkan pada seluruh kop dokumen hukum dan banner peringatan pengunggahan item katalog.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveGlobalSettings}
            disabled={isSavingGlobalSettings}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              width: 'auto',
              padding: '0.45rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: isSavingGlobalSettings ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              opacity: isSavingGlobalSettings ? 0.7 : 1
            }}
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{isSavingGlobalSettings ? 'Menyimpan...' : 'Simpan Identitas Hukum'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              Nama Badan Hukum Resmi (PT / Korporasi)
            </label>
            <input
              type="text"
              value={legalEntityName}
              onChange={e => setLegalEntityName(e.target.value)}
              placeholder="PT Catavor Media Digital"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.55rem',
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              Yurisdiksi Hukum Resmi
            </label>
            <input
              type="text"
              value={legalJurisdiction}
              onChange={e => setLegalJurisdiction(e.target.value)}
              placeholder="Hukum Republik Indonesia"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.55rem',
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
            Teks Banner Peringatan Kepatuhan (Compliance Callout)
          </label>
          <textarea
            rows={2}
            value={legalWarningBanner}
            onChange={e => setLegalWarningBanner(e.target.value)}
            placeholder="Teks peringatan kewaspadaan hukum bagi pengelola katalog..."
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.55rem',
              backgroundColor: theme.card,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              fontSize: '0.8rem',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* 3. 6-Pillar Multi-Column Grid Cards (Desktop Native) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.55rem'
        }}
      >
        {(Object.keys(POLICY_METADATA) as PolicyKey[]).map(key => {
          const isSelected = selectedKey === key;
          const meta = POLICY_METADATA[key];
          const Icon = meta.icon;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '0.85rem',
                backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)') : theme.surface,
                border: `1.5px solid ${isSelected ? '#10b981' : theme.border}`,
                color: isSelected ? '#10b981' : theme.textPrimary,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.5rem',
                  backgroundColor: isSelected ? '#10b981' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                  color: isSelected ? '#ffffff' : theme.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 800 : 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.68rem', color: theme.textSecondary, display: 'block' }}>
                  {key}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Sub-Mode Tabs (Editor vs Preview vs Audit) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: '0.5rem'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'editor' ? '#10b981' : 'transparent',
            color: activeTab === 'editor' ? '#ffffff' : theme.textSecondary,
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <FileEdit size={15} strokeWidth={1.75} />
          <span>Editor Pasal Terstruktur</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'preview' ? '#2563eb' : 'transparent',
            color: activeTab === 'preview' ? '#ffffff' : theme.textSecondary,
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Eye size={15} strokeWidth={1.75} />
          <span>Pratinjau Langsung (Live Preview)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'audit' ? '#475569' : 'transparent',
            color: activeTab === 'audit' ? '#ffffff' : theme.textSecondary,
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <History size={15} strokeWidth={1.75} />
          <span>Riwayat Versi (Audit Trail)</span>
        </button>
      </div>

      {/* 5. SUB-MODE 1: STRUCTURED EDITOR */}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Document Metadata Form */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '1rem',
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <SelectedIcon size={18} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Metadata Dokumen: {POLICY_METADATA[selectedKey].label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Judul Lengkap Dokumen
                </label>
                <input
                  type="text"
                  value={editableDoc.title}
                  onChange={e => setEditableDoc(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: Syarat & Ketentuan Layanan Platform Catavor"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Kategori Dokumen
                </label>
                <input
                  type="text"
                  value={editableDoc.category}
                  onChange={e => setEditableDoc(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Contoh: Ketentuan Umum & Kedudukan Hukum"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Label Badge Dokumen
                </label>
                <input
                  type="text"
                  value={editableDoc.badge}
                  onChange={e => setEditableDoc(prev => ({ ...prev, badge: e.target.value }))}
                  placeholder="Contoh: Dokumen Perjanjian Pengelola"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                Ringkasan Eksekutif (Executive Summary)
              </label>
              <textarea
                rows={2}
                value={editableDoc.summary}
                onChange={e => setEditableDoc(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Ringkasan resmi yang menjelaskan esensi dokumen kebijakan ini..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: theme.card,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Structured Articles List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: theme.textPrimary }}>
                Daftar Pasal ({editableDoc.articles.length} Pasal Aktif)
              </span>
              <button
                type="button"
                onClick={handleAddArticle}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  width: 'auto',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} strokeWidth={1.75} />
                <span>Tambah Pasal Baru</span>
              </button>
            </div>

            {editableDoc.articles.map((art, aIdx) => (
              <div
                key={aIdx}
                style={{
                  padding: '1.15rem',
                  borderRadius: '0.85rem',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <input
                      type="text"
                      value={art.number}
                      onChange={e => handleUpdateArticle(aIdx, 'number', e.target.value)}
                      placeholder="Pasal 1"
                      style={{
                        width: '95px',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.5rem',
                        backgroundColor: theme.card,
                        border: `1px solid ${theme.border}`,
                        color: '#10b981',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      value={art.heading}
                      onChange={e => handleUpdateArticle(aIdx, 'heading', e.target.value)}
                      placeholder="Judul Kepala Pasal..."
                      style={{
                        flex: 1,
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.5rem',
                        backgroundColor: theme.card,
                        border: `1px solid ${theme.border}`,
                        color: theme.textPrimary,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => handleMoveArticle(aIdx, 'up')}
                      disabled={aIdx === 0}
                      style={{
                        padding: '0.35rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.border}`,
                        color: theme.textSecondary,
                        cursor: aIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === 0 ? 0.4 : 1
                      }}
                      title="Geser ke Atas"
                    >
                      <ChevronUp size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveArticle(aIdx, 'down')}
                      disabled={aIdx === editableDoc.articles.length - 1}
                      style={{
                        padding: '0.35rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.border}`,
                        color: theme.textSecondary,
                        cursor: aIdx === editableDoc.articles.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === editableDoc.articles.length - 1 ? 0.4 : 1
                      }}
                      title="Geser ke Bawah"
                    >
                      <ChevronDown size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(aIdx)}
                      style={{
                        padding: '0.35rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                      title="Hapus Pasal"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={art.content}
                    onChange={e => handleUpdateArticle(aIdx, 'content', e.target.value)}
                    placeholder="Uraian isi pasal secara lengkap..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.55rem',
                      backgroundColor: theme.card,
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
                      fontSize: '0.8rem',
                      lineHeight: 1.55,
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Highlights List (Rule 6: Vector Lucide Check icon, Zero Unicode '✓') */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
                      Poin Sorotan Kepatuhan ({art.highlights?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddHighlight(aIdx)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#10b981',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.15rem 0'
                      }}
                    >
                      <Plus size={13} strokeWidth={1.75} />
                      <span>Tambah Butir</span>
                    </button>
                  </div>

                  {(art.highlights || []).map((hl, hlIdx) => (
                    <div key={hlIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Check size={14} strokeWidth={1.75} style={{ color: '#10b981', flexShrink: 0 }} />
                      <input
                        type="text"
                        value={hl}
                        onChange={e => handleUpdateHighlight(aIdx, hlIdx, e.target.value)}
                        placeholder="Butir sorotan..."
                        style={{
                          flex: 1,
                          padding: '0.35rem 0.55rem',
                          borderRadius: '0.45rem',
                          backgroundColor: theme.card,
                          border: `1px solid ${theme.border}`,
                          color: theme.textSecondary,
                          fontSize: '0.78rem',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHighlight(aIdx, hlIdx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Hapus Butir"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 6. Save & Publish Control Panel */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '1rem',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
              border: '1.5px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Publikasikan Versi Baru &amp; Catat Jejak Audit
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Nomor Versi Baru
                </label>
                <input
                  type="text"
                  value={editableDoc.version}
                  onChange={e => setEditableDoc(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="v2.1"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Tingkat Perubahan (Change Type)
                </label>
                <DesktopCustomSelect
                  value={editableDoc.changeType}
                  onChange={(val) => setEditableDoc(prev => ({ ...prev, changeType: val === 'major' ? 'major' : 'minor' }))}
                  options={CHANGE_TYPE_OPTIONS}
                  ariaLabel="Pilih tingkat perubahan kebijakan"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Persetujuan Ulang Merchant
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minHeight: '38px' }}>
                  <input
                    type="checkbox"
                    checked={editableDoc.requiresAcceptance}
                    onChange={e => setEditableDoc(prev => ({ ...prev, requiresAcceptance: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: theme.textPrimary }}>
                    Wajibkan Pop-up Persetujuan Ulang
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                Ringkasan Perubahan (Summary of Changes untuk Log Audit)
              </label>
              <input
                type="text"
                value={editableDoc.summaryOfChanges}
                onChange={e => setEditableDoc(prev => ({ ...prev, summaryOfChanges: e.target.value }))}
                placeholder="Contoh: Pembaruan klausul 7 katalog dan transparansi telemetri riset pasar B2B"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: theme.card,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={handleSavePolicy}
                disabled={isSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: 'auto',
                  padding: '0.65rem 1.35rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                <Save size={16} strokeWidth={1.75} />
                <span>{isSaving ? 'Menyimpan & Menerbitkan...' : `Publikasikan Versi Baru (${editableDoc.version})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-MODE 2: LIVE PREVIEW (Renders Unsaved Draft Real-Time) */}
      {activeTab === 'preview' && (
        <div
          style={{
            borderRadius: '1rem',
            overflow: 'hidden',
            border: `1.5px solid ${theme.border}`,
            backgroundColor: '#0f172a'
          }}
        >
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#1e293b',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={16} strokeWidth={1.75} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
                Pratinjau Langsung Draf ({POLICY_METADATA[selectedKey].label})
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Menampilkan perubahan draf secara real-time sebelum dipublikasikan
            </span>
          </div>

          <div style={{ padding: '1rem' }}>
            <PlatformPoliciesView initialKey={selectedKey} draftOverride={draftOverride} />
          </div>
        </div>
      )}

      {/* 5. SUB-MODE 3: AUDIT TRAIL WITH ENTERPRISE PAGINATION BAR */}
      {activeTab === 'audit' && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '1rem',
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} strokeWidth={1.75} style={{ color: '#64748b' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Jejak Audit Perubahan Kebijakan (SOC 2 Policy Audit Trail)
              </span>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={isLoadingLogs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                color: theme.textPrimary,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${theme.border}`,
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                fontWeight: 700
              }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isLoadingLogs ? 'animate-spin' : ''} />
              <span>Segarkan Log</span>
            </button>
          </div>

          {isLoadingLogs ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.82rem' }}>
              Memuat riwayat audit...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.82rem' }}>
              Belum ada riwayat perubahan kebijakan yang tercatat.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Waktu</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Tipe Dokumen</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Aksi</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Versi Baru</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Ringkasan Perubahan</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Admin / Email</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                        <td style={{ padding: '0.65rem 0.75rem', color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                          {log.policy_type}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              backgroundColor: log.action === 'reset_defaults' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: log.action === 'reset_defaults' ? '#ef4444' : '#10b981'
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                          {log.new_version || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: theme.textPrimary, maxWidth: '320px' }}>
                          {log.change_summary || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: theme.textSecondary }}>
                          {log.admin_email || 'System'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: theme.textSecondary, fontFamily: 'monospace' }}>
                          {log.admin_ip || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Enterprise Comprehensive Data Table Pagination Bar (AGENTS.md Rule 7.C.1) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  paddingTop: '0.85rem',
                  borderTop: `1px solid ${theme.border}`,
                  fontSize: '0.76rem',
                  color: theme.textSecondary
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '125px' }}>
                    <DesktopCustomSelect
                      value={String(auditPerPage)}
                      onChange={(val) => {
                        setAuditPerPage(Number(val) || 25);
                        setAuditPage(1);
                      }}
                      options={PER_PAGE_OPTIONS}
                      ariaLabel="Baris per halaman"
                    />
                  </div>
                  <span>
                    Menampilkan <strong style={{ color: theme.textPrimary }}>{startEntry} – {endEntry}</strong> dari{' '}
                    <strong style={{ color: theme.textPrimary }}>{auditTotal}</strong> data
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage(1)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textPrimary,
                      fontSize: '0.74rem',
                      cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: auditPage <= 1 ? 0.4 : 1
                    }}
                  >
                    <ChevronsLeft size={13} strokeWidth={1.75} />
                    <span>Awal</span>
                  </button>
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textPrimary,
                      fontSize: '0.74rem',
                      cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: auditPage <= 1 ? 0.4 : 1
                    }}
                  >
                    <ChevronLeft size={13} strokeWidth={1.75} />
                    <span>Sebelumnya</span>
                  </button>

                  {pageNumbers.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAuditPage(p)}
                      style={{
                        minWidth: '30px',
                        padding: '0.35rem 0.55rem',
                        borderRadius: '0.45rem',
                        border: `1px solid ${p === auditPage ? '#10b981' : theme.border}`,
                        backgroundColor: p === auditPage ? '#10b981' : 'transparent',
                        color: p === auditPage ? '#ffffff' : theme.textPrimary,
                        fontWeight: p === auditPage ? 800 : 600,
                        fontSize: '0.74rem',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages}
                    onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textPrimary,
                      fontSize: '0.74rem',
                      cursor: auditPage >= auditTotalPages ? 'not-allowed' : 'pointer',
                      opacity: auditPage >= auditTotalPages ? 0.4 : 1
                    }}
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages}
                    onClick={() => setAuditPage(auditTotalPages)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textPrimary,
                      fontSize: '0.74rem',
                      cursor: auditPage >= auditTotalPages ? 'not-allowed' : 'pointer',
                      opacity: auditPage >= auditTotalPages ? 0.4 : 1
                    }}
                  >
                    <span>Akhir</span>
                    <ChevronsRight size={13} strokeWidth={1.75} />
                  </button>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const target = parseInt(quickJumpInput, 10);
                      if (!isNaN(target) && target >= 1 && target <= auditTotalPages) {
                        setAuditPage(target);
                        setQuickJumpInput('');
                      }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.35rem' }}
                  >
                    <span>Ke hal:</span>
                    <input
                      type="number"
                      min={1}
                      max={auditTotalPages}
                      value={quickJumpInput}
                      onChange={e => setQuickJumpInput(e.target.value)}
                      placeholder={String(auditPage)}
                      style={{
                        width: '54px',
                        padding: '0.3rem 0.45rem',
                        borderRadius: '0.4rem',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: theme.card,
                        color: theme.textPrimary,
                        fontSize: '0.74rem',
                        outline: 'none'
                      }}
                    />
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 6. Reset Confirmation Centered Modal (Desktop Native) */}
      {showResetModal && (
        <div
          onClick={() => {
            if (!isResetting) setShowResetModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1.5px solid ${theme.border}`,
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.textPrimary }}>
                  Konfirmasi Reset ke Standar Resmi
                </h3>
                <span style={{ fontSize: '0.74rem', color: theme.textSecondary }}>
                  Tindakan ini menerbitkan versi baru berisi template resmi Catavor v2.0 dengan menjaga histori versi sebelumnya.
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.55 }}>
              Pilih apakah Anda ingin mereset <strong>hanya dokumen {POLICY_METADATA[selectedKey].label}</strong> atau <strong>seluruh 6 pilar kebijakan platform</strong>. Tindakan ini dicatat ke dalam log audit SOC 2.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                style={{
                  width: 'auto',
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: theme.textPrimary,
                  border: `1px solid ${theme.border}`,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: isResetting ? 'not-allowed' : 'pointer'
                }}
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => handleResetDefaults(false)}
                disabled={isResetting}
                style={{
                  width: 'auto',
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isResetting ? 'not-allowed' : 'pointer'
                }}
              >
                {isResetting ? 'Mereset...' : `Reset ${POLICY_METADATA[selectedKey].label}`}
              </button>

              <button
                type="button"
                onClick={() => handleResetDefaults(true)}
                disabled={isResetting}
                style={{
                  width: 'auto',
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isResetting ? 'not-allowed' : 'pointer'
                }}
              >
                {isResetting ? 'Mereset Semua...' : 'Reset Seluruh 6 Pilar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PlatformPolicyManager;
