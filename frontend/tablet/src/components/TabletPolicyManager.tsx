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
  RefreshCw,
  Sparkles,
  FileText
} from 'lucide-react';
import {
  TabletPoliciesView,
  type PolicyKey,
  type PolicyArticle,
  type DraftPolicyOverride
} from './TabletPoliciesView';
import {
  FALLBACK_POLICY_SECTIONS,
  type PolicyAuditLogItem
} from '../utils/policyShared';
import { TabletCustomSelect, type TabletSelectOption } from './TabletCustomSelect';
import { TabletSegmentedPagination } from './TabletSegmentedPagination';
import { useModalBackHandler } from '../utils/navigation';

export interface TabletPolicyManagerProps {
  token: string;
  isDark?: boolean;
  theme?: Record<string, string>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onBack?: () => void;
  backLabel?: string;
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
  // Admin could not create or edit this document at all: it was absent from the
  // PolicyKey union, so the manager UI had no entry for it.
  acceptable_use: { label: 'Ketentuan Penggunaan', icon: FileText, defaultCategory: 'Aturan Penggunaan Layanan', defaultBadge: 'Wajib Dipatuhi Pengguna' },
  prohibited: { label: 'Komoditas Terlarang', icon: ShieldAlert, defaultCategory: 'Kepatuhan Mutlak (Zero Tolerance)', defaultBadge: 'Wajib Dipatuhi Pengelola' },
  privacy: { label: 'Privasi & Data B2B', icon: Lock, defaultCategory: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)', defaultBadge: 'Standar Perlindungan Privasi' },
  moderation: { label: 'Moderasi & Sanksi', icon: CheckCircle2, defaultCategory: 'Prosedur Disiplin Ekosistem', defaultBadge: 'Transparansi & Akuntabilitas' },
  transactions: { label: 'Transaksi & Rekber', icon: CheckCircle2, defaultCategory: 'Integritas Pembayaran & Sengketa', defaultBadge: 'Prosedur Keamanan Keuangan' },
  subscription: { label: 'Langganan & Kuota', icon: CreditCard, defaultCategory: 'Model Layanan Bisnis & Kuota', defaultBadge: 'Ketentuan Komersial Merchant' }
};

const CHANGE_TYPE_OPTIONS: TabletSelectOption[] = [
  { value: 'minor', label: 'MINOR (Perbaikan Redaksional)', description: 'Klarifikasi bahasa tanpa mengubah kewajiban pokok' },
  { value: 'major', label: 'MAJOR (Perubahan Substansial)', description: 'Perubahan klausul hukum / kewajiban merchant' }
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

export const TabletPolicyManager: React.FC<TabletPolicyManagerProps> = ({
  token,
  showToast,
  onBack,
  backLabel = 'Kembali'
}) => {
  const [selectedKey, setSelectedKey] = useState<PolicyKey>('terms');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isTabletWide, setIsTabletWide] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 880 : true
  );
  const [pillarCounts, setPillarCounts] = useState<Record<PolicyKey, number>>(() => {
    const initial = {} as Record<PolicyKey, number>;
    FALLBACK_POLICY_SECTIONS.forEach(doc => {
      initial[doc.key] = doc.articles.length;
    });
    return initial;
  });

  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsTabletWide(window.innerWidth >= 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useModalBackHandler({
    isOpen: showResetModal,
    onClose: () => {
      if (!isResetting) setShowResetModal(false);
    },
    modalId: 'tablet-policy-reset-modal'
  });

  // Global Legal Settings
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

  // Server-Side Paginated Audit Logs State (AGENTS.md Rule 7.C.2)
  const [auditLogs, setAuditLogs] = useState<PolicyAuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const auditPerPage = 15;

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

      if (policiesRes && policiesRes.success && policiesRes.data) {
        const nextCounts = {} as Record<PolicyKey, number>;
        FALLBACK_POLICY_SECTIONS.forEach(fb => {
          const item = policiesRes.data[fb.key];
          let cnt = fb.articles.length;
          if (item && item.sections) {
            try {
              const sec = typeof item.sections === 'string' ? JSON.parse(item.sections) : item.sections;
              if (sec && Array.isArray(sec.articles) && sec.articles.length > 0) {
                cnt = sec.articles.length;
              }
            } catch {
              // Keep fallback count
            }
          }
          nextCounts[fb.key] = cnt;
        });
        setPillarCounts(nextCounts);
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
      toastRef.current('Gagal memuat konfigurasi kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  }, [token, auditPage]);

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

  // Rule 11: Only expose options with count > 0
  const pillarSelectOptions: TabletSelectOption[] = useMemo(
    () =>
      (Object.keys(POLICY_METADATA) as PolicyKey[])
        .filter(k => (pillarCounts[k] || 0) > 0)
        .map((k, idx) => {
          const meta = POLICY_METADATA[k];
          const Icon = meta.icon;
          return {
            value: k,
            label: `${idx + 1}. ${meta.label}`,
            description: meta.defaultCategory,
            count: k === selectedKey && editableDoc.articles.length > 0 ? editableDoc.articles.length : pillarCounts[k],
            icon: <Icon size={16} strokeWidth={1.75} />
          };
        }),
    [pillarCounts, selectedKey, editableDoc.articles.length]
  );

  const handleSaveGlobalSettings = async () => {
    if (!token) {
      toastRef.current('Autentikasi diperlukan.', 'error');
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
        toastRef.current('Identitas hukum platform berhasil disimpan.', 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
      } else {
        toastRef.current(data?.message || 'Gagal menyimpan pengaturan legal.', 'error');
      }
    } catch {
      toastRef.current('Terjadi kesalahan jaringan saat menyimpan identitas legal.', 'error');
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  const handleAddArticle = () => {
    const nextNumber = `Pasal ${editableDoc.articles.length + 1}`;
    setEditableDoc(prev => ({
      ...prev,
      articles: [
        ...prev.articles,
        {
          number: nextNumber,
          heading: 'Judul Klausul / Pasal Baru',
          content: 'Uraikan isi pasal secara jelas dan terikat hukum di sini.',
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

  const handleSavePolicy = async () => {
    if (!token) {
      toastRef.current('Autentikasi admin diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      toastRef.current('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      toastRef.current('Dokumen kebijakan wajib memiliki minimal 1 pasal.', 'error');
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
        toastRef.current(`Kebijakan ${editableDoc.title} berhasil diperbarui ke ${payload.version}.`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        toastRef.current(json?.message || 'Gagal menyimpan pembaruan kebijakan.', 'error');
      }
    } catch {
      toastRef.current('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

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
        toastRef.current(
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
        toastRef.current(json?.message || 'Gagal mereset kebijakan.', 'error');
      }
    } catch {
      toastRef.current('Terjadi kesalahan jaringan saat mereset kebijakan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const SelectedIcon = POLICY_METADATA[selectedKey].icon;

  const detailPane = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0 }}>
      {/* Sub-Mode Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '0.5rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'editor' ? '#10b981' : 'transparent',
            color: activeTab === 'editor' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <FileEdit size={15} strokeWidth={1.75} />
          <span>Editor Pasal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'preview' ? '#2563eb' : 'transparent',
            color: activeTab === 'preview' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <Eye size={15} strokeWidth={1.75} />
          <span>Pratinjau Tablet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'audit' ? '#475569' : 'transparent',
            color: activeTab === 'audit' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <History size={15} strokeWidth={1.75} />
          <span>Riwayat Audit</span>
        </button>
      </div>

      {/* SUB-MODE: EDITOR */}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div
            style={{
              padding: '1.15rem',
              borderRadius: '1rem',
              backgroundColor: 'var(--bg-card, #0f172a)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <SelectedIcon size={18} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Metadata: {POLICY_METADATA[selectedKey].label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Judul Dokumen
                </label>
                <input
                  type="text"
                  value={editableDoc.title}
                  onChange={e => setEditableDoc(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    minHeight: '44px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Kategori
                </label>
                <input
                  type="text"
                  value={editableDoc.category}
                  onChange={e => setEditableDoc(prev => ({ ...prev, category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    minHeight: '44px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Badge Label
                </label>
                <input
                  type="text"
                  value={editableDoc.badge}
                  onChange={e => setEditableDoc(prev => ({ ...prev, badge: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    minHeight: '44px'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                Ringkasan Eksekutif
              </label>
              <textarea
                rows={2}
                value={editableDoc.summary}
                onChange={e => setEditableDoc(prev => ({ ...prev, summary: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Articles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                Daftar Pasal ({editableDoc.articles.length} Pasal Aktif)
              </span>
              <button
                type="button"
                onClick={handleAddArticle}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '44px'
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
                  padding: '1.1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card, #0f172a)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: '200px' }}>
                    <input
                      type="text"
                      value={art.number}
                      onChange={e => handleUpdateArticle(aIdx, 'number', e.target.value)}
                      placeholder="Pasal 1"
                      style={{
                        width: '90px',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#10b981',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        outline: 'none',
                        minHeight: '44px'
                      }}
                    />
                    <input
                      type="text"
                      value={art.heading}
                      onChange={e => handleUpdateArticle(aIdx, 'heading', e.target.value)}
                      placeholder="Judul Kepala Pasal..."
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.6rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        outline: 'none',
                        minHeight: '44px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => handleMoveArticle(aIdx, 'up')}
                      disabled={aIdx === 0}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        borderRadius: '0.45rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: aIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === 0 ? 0.4 : 1
                      }}
                    >
                      <ChevronUp size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveArticle(aIdx, 'down')}
                      disabled={aIdx === editableDoc.articles.length - 1}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        borderRadius: '0.45rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: aIdx === editableDoc.articles.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === editableDoc.articles.length - 1 ? 0.4 : 1
                      }}
                    >
                      <ChevronDown size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(aIdx)}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        borderRadius: '0.45rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={art.content}
                  onChange={e => handleUpdateArticle(aIdx, 'content', e.target.value)}
                  placeholder="Uraian isi pasal secara lengkap..."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    lineHeight: 1.55,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />

                {/* Highlights (Rule 6: Vector Lucide Check icon, Touch Target >= 44px) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
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
                        minHeight: '44px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#10b981',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 0.35rem'
                      }}
                    >
                      <Plus size={14} strokeWidth={1.75} />
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
                          padding: '0.45rem 0.6rem',
                          borderRadius: '0.45rem',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                          color: '#cbd5e1',
                          fontSize: '0.78rem',
                          outline: 'none',
                          minHeight: '44px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHighlight(aIdx, hlIdx)}
                        style={{
                          minWidth: '44px',
                          minHeight: '44px',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save & Publish Panel */}
          <div
            style={{
              padding: '1.15rem',
              borderRadius: '1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1.5px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sparkles size={18} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Publikasikan Versi Baru
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Nomor Versi
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
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    outline: 'none',
                    minHeight: '44px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <TabletCustomSelect
                  label="Tingkat Perubahan"
                  value={editableDoc.changeType}
                  onChange={(val) => setEditableDoc(prev => ({ ...prev, changeType: val === 'major' ? 'major' : 'minor' }))}
                  options={CHANGE_TYPE_OPTIONS}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Persetujuan Ulang
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minHeight: '44px' }}>
                  <input
                    type="checkbox"
                    checked={editableDoc.requiresAcceptance}
                    onChange={e => setEditableDoc(prev => ({ ...prev, requiresAcceptance: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span style={{ fontSize: '0.76rem', color: '#ffffff' }}>
                    Wajibkan Pop-up Persetujuan
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                Ringkasan Perubahan
              </label>
              <input
                type="text"
                value={editableDoc.summaryOfChanges}
                onChange={e => setEditableDoc(prev => ({ ...prev, summaryOfChanges: e.target.value }))}
                placeholder="Contoh: Pembaruan klausul 7 katalog dan riset pasar B2B"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  minHeight: '44px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
              <button
                type="button"
                onClick={handleSavePolicy}
                disabled={isSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.35rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                <Save size={16} strokeWidth={1.75} />
                <span>{isSaving ? 'Menyimpan...' : `Terbitkan ${editableDoc.version}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODE: LIVE PREVIEW */}
      {activeTab === 'preview' && (
        <div style={{ borderRadius: '1rem', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', overflow: 'hidden' }}>
          <TabletPoliciesView initialKey={selectedKey} draftOverride={draftOverride} />
        </div>
      )}

      {/* SUB-MODE: AUDIT WITH TOUCH-SEGMENTED PAGINATION */}
      {activeTab === 'audit' && (
        <div
          style={{
            borderRadius: '1rem',
            backgroundColor: 'var(--bg-card, #0f172a)',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} strokeWidth={1.75} style={{ color: '#94a3b8' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Riwayat Audit Perubahan Kebijakan
              </span>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={isLoadingLogs}
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                borderRadius: '0.55rem',
                fontSize: '0.75rem',
                color: '#cbd5e1',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isLoadingLogs ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>

          <div style={{ padding: '1rem 1.15rem' }}>
            {isLoadingLogs ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                Memuat log...
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                Belum ada log tercatat.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '0.55rem' }}>Waktu</th>
                      <th style={{ padding: '0.55rem' }}>Tipe</th>
                      <th style={{ padding: '0.55rem' }}>Aksi</th>
                      <th style={{ padding: '0.55rem' }}>Versi</th>
                      <th style={{ padding: '0.55rem' }}>Ringkasan</th>
                      <th style={{ padding: '0.55rem' }}>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.55rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td style={{ padding: '0.55rem', fontWeight: 700, color: '#ffffff' }}>
                          {log.policy_type}
                        </td>
                        <td style={{ padding: '0.55rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              backgroundColor: log.action === 'reset_defaults' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: log.action === 'reset_defaults' ? '#ef4444' : '#10b981'
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem', fontWeight: 700, color: '#ffffff' }}>
                          {log.new_version || '-'}
                        </td>
                        <td style={{ padding: '0.55rem', color: '#cbd5e1' }}>
                          {log.change_summary || '-'}
                        </td>
                        <td style={{ padding: '0.55rem', color: '#94a3b8' }}>
                          {log.admin_email || 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <TabletSegmentedPagination
            currentPage={auditPage}
            totalPages={auditTotalPages}
            totalRecords={auditTotal}
            pageSize={auditPerPage}
            onPageChange={setAuditPage}
            isLoading={isLoadingLogs}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '0.5rem' }}>
      {/* 1. Tablet Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                minHeight: '44px'
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
              <span>{backLabel}</span>
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Scale size={19} strokeWidth={1.75} style={{ color: '#10b981' }} />
              <span>Manajemen Kebijakan &amp; Regulasi Platform</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
              Kelola 6 pilar hukum platform, draf pratinjau langsung, dan riwayat audit SOC 2.
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
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              minHeight: '44px'
            }}
          >
            <RotateCcw size={15} strokeWidth={1.75} />
            <span>Reset Standar</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              minHeight: '44px'
            }}
          >
            <RefreshCw size={15} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 2. Global Legal Identity Panel */}
      <div
        style={{
          padding: '1.15rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} strokeWidth={1.75} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
              Identitas Hukum &amp; Banner Peringatan Kepatuhan
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveGlobalSettings}
            disabled={isSavingGlobalSettings}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: isSavingGlobalSettings ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              minHeight: '44px',
              opacity: isSavingGlobalSettings ? 0.7 : 1
            }}
          >
            <Save size={15} strokeWidth={1.75} />
            <span>{isSavingGlobalSettings ? 'Menyimpan...' : 'Simpan Identitas'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
              Badan Hukum Resmi
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
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                color: '#ffffff',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: '44px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
              Yurisdiksi Hukum
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
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                color: '#ffffff',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: '44px'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
            Banner Peringatan Kepatuhan Pengunggahan Item
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
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              color: '#ffffff',
              fontSize: '0.8rem',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* 3. Dual-Form-Factor Tablet Workspace (AGENTS.md Rule 7.A.2 & Rule 11):
             - Tablet Lebar (>= 880px): Master-Detail Split View (Left 34% Pillar Master List, Right 66% Editor/Preview/Audit)
             - Tablet Mini (< 880px): Native TabletCustomSelect Dropdown (Zero Horizontal Overflowing Pills) */}
      {isTabletWide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 34%) minmax(0, 66%)', gap: '1.1rem', alignItems: 'flex-start' }}>
          <div
            style={{
              borderRadius: '1rem',
              backgroundColor: 'var(--bg-card, #0f172a)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              position: 'sticky',
              top: '0.75rem'
            }}
          >
            <div style={{ padding: '0.4rem 0.65rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '0.15rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}>
                6 Pilar Kebijakan Platform
              </span>
            </div>

            {(Object.keys(POLICY_METADATA) as PolicyKey[])
              .filter(k => (pillarCounts[k] || 0) > 0)
              .map((key, idx) => {
                const isSelected = selectedKey === key;
                const meta = POLICY_METADATA[key];
                const Icon = meta.icon;
                const count = key === selectedKey && editableDoc.articles.length > 0 ? editableDoc.articles.length : pillarCounts[key];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      minHeight: '48px',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.7rem',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                      border: `1.5px solid ${isSelected ? '#10b981' : 'transparent'}`,
                      color: isSelected ? '#ffffff' : '#cbd5e1',
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
                        backgroundColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 800 : 600, display: 'block', lineHeight: 1.3 }}>
                        {idx + 1}. {meta.label}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {count} pasal aktif
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>

          {detailPane}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <TabletCustomSelect
            label="Pilih Pilar Kebijakan yang Diedit"
            value={selectedKey}
            onChange={(val) => setSelectedKey(val as PolicyKey)}
            options={pillarSelectOptions}
            icon={<SelectedIcon size={16} strokeWidth={1.75} />}
          />
          {detailPane}
        </div>
      )}

      {/* 6. Reset Confirmation Centered Medium Panel */}
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
              backgroundColor: '#0f172a',
              borderRadius: '1rem',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={22} strokeWidth={1.75} style={{ color: '#ef4444' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Reset Standar Resmi Catavor
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Menerbitkan versi baru berisi template resmi v2.0 dengan menjaga jejak audit versi sebelumnya.
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              Pilih untuk mereset dokumen <strong>{POLICY_METADATA[selectedKey].label}</strong> saja atau <strong>seluruh 6 pilar kebijakan platform</strong>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  minHeight: '44px',
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
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  minHeight: '44px',
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
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  minHeight: '44px',
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
export default TabletPolicyManager;
