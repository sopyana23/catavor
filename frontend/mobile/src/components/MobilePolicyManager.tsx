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
  ChevronLeft,
  ChevronRight,
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
  MobilePoliciesView,
  type PolicyKey,
  type PolicyArticle,
  type DraftPolicyOverride
} from './MobilePoliciesView';
import {
  FALLBACK_POLICY_SECTIONS,
  type PolicyAuditLogItem
} from '../utils/policyShared';
import { MobileCustomSelect, type MobileSelectOption } from './MobileCustomSelect';
import { useModalBackHandler } from '../utils/navigation';

export interface MobilePolicyManagerProps {
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

const CHANGE_TYPE_OPTIONS: MobileSelectOption[] = [
  { value: 'minor', label: 'Minor (Redaksional)', description: 'Perbaikan bahasa atau penjelasan tanpa mengubah kewajiban hukum' },
  { value: 'major', label: 'Major (Substansi Hukum)', description: 'Perubahan klausul substansial atau regulasi baru' }
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

export const MobilePolicyManager: React.FC<MobilePolicyManagerProps> = ({
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
  const [resetScope, setResetScope] = useState<'single' | 'all'>('single');

  // Slide-Up Bottom Sheet Physics State (AGENTS.md Rule 7.A.3)
  const [resetDragY, setResetDragY] = useState<number>(0);
  const [isResetDragging, setIsResetDragging] = useState<boolean>(false);
  const [isClosingResetSheet, setIsClosingResetSheet] = useState<boolean>(false);
  const resetTouchStartY = useRef<number>(0);
  const resetDragYRef = useRef<number>(0);

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
    resetDragYRef.current = resetDragY;
  }, [resetDragY]);

  const closeResetSheet = useCallback(() => {
    if (isResetting) return;
    setIsClosingResetSheet(true);
    setIsResetDragging(false);
    setTimeout(() => {
      setShowResetModal(false);
      setIsClosingResetSheet(false);
      setResetDragY(0);
    }, 280);
  }, [isResetting]);

  useModalBackHandler({
    isOpen: showResetModal,
    onClose: () => {
      if (!isResetting) {
        setShowResetModal(false);
        setIsClosingResetSheet(false);
        setResetDragY(0);
      }
    },
    modalId: 'mobile-policy-reset-sheet'
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

  // Server-Side Paginated Audit Logs State (AGENTS.md Rule 7.C.3)
  const [auditLogs, setAuditLogs] = useState<PolicyAuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditTotalPages, setAuditTotalPages] = useState<number>(1);
  const auditPerPage = 10;

  // Load Policies and Settings (stable deps: parent scroll/re-render never overwrites draft!)
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
      toastRef.current('Gagal memuat dokumen kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Paginated Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setIsLoadingLogs(true);
    try {
      const data = await authFetchJson(
        `/api/admin/settings/policy-audit-logs?page=${auditPage}&per_page=${auditPerPage}`,
        token
      );
      if (data && data.success && Array.isArray(data.data)) {
        setAuditLogs(data.data as PolicyAuditLogItem[]);
        const total = typeof data.total === 'number' ? data.total : data.data.length;
        const pages = typeof data.total_pages === 'number' ? Math.max(1, data.total_pages) : Math.max(1, Math.ceil(total / auditPerPage));
        setAuditTotal(total);
        setAuditTotalPages(pages);
      }
    } catch {
      // Graceful fallback
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
  const pillarSelectOptions: MobileSelectOption[] = useMemo(
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
      toastRef.current('Autentikasi staf diperlukan.', 'error');
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
        toastRef.current('Identitas legal platform berhasil disimpan.', 'success');
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
          heading: 'Judul Klausul Baru',
          content: 'Uraian ketentuan klausul...',
          highlights: ['Poin ketentuan pokok']
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
      const updated = [...prev.articles];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return { ...prev, articles: updated };
    });
  };

  const handleAddHighlight = (articleIndex: number) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const cur = updated[articleIndex];
      const curHighlights = Array.isArray(cur.highlights) ? [...cur.highlights] : [];
      curHighlights.push('Poin sorotan penting baru');
      updated[articleIndex] = { ...cur, highlights: curHighlights };
      return { ...prev, articles: updated };
    });
  };

  const handleUpdateHighlight = (articleIndex: number, hlIndex: number, text: string) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const cur = updated[articleIndex];
      const curHighlights = Array.isArray(cur.highlights) ? [...cur.highlights] : [];
      curHighlights[hlIndex] = text;
      updated[articleIndex] = { ...cur, highlights: curHighlights };
      return { ...prev, articles: updated };
    });
  };

  const handleDeleteHighlight = (articleIndex: number, hlIndex: number) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      const cur = updated[articleIndex];
      const curHighlights = Array.isArray(cur.highlights) ? [...cur.highlights] : [];
      curHighlights.splice(hlIndex, 1);
      updated[articleIndex] = { ...cur, highlights: curHighlights };
      return { ...prev, articles: updated };
    });
  };

  const handleSavePolicy = async () => {
    if (!token) {
      toastRef.current('Autentikasi staf diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      toastRef.current('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      toastRef.current('Dokumen harus memiliki setidaknya satu pasal aktif.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        type: selectedKey,
        title: editableDoc.title,
        version: editableDoc.version || 'v2.1',
        change_type: editableDoc.changeType,
        summary_of_changes: editableDoc.summaryOfChanges || `Pembaruan klausul dokumen ${POLICY_METADATA[selectedKey].label}`,
        requires_acceptance: editableDoc.requiresAcceptance,
        sections: {
          category: editableDoc.category,
          badge: editableDoc.badge,
          icon_key: selectedKey,
          summary: editableDoc.summary,
          articles: editableDoc.articles
        }
      };

      const data = await authFetchJson('/api/admin/settings/policies', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (data && data.success) {
        toastRef.current(`Dokumen ${POLICY_METADATA[selectedKey].label} berhasil dipublikasikan.`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        toastRef.current(data?.message || 'Gagal menyimpan dokumen kebijakan.', 'error');
      }
    } catch {
      toastRef.current('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // SEC-05 / SEC-FE-02 Fix: Send canonical { type: 'all' | selectedKey } so single-document reset NEVER wipes out all 6 policies!
  const handleResetDefaults = async () => {
    if (!token) return;
    const targetType = resetScope === 'all' ? 'all' : selectedKey;
    setIsResetting(true);
    try {
      const data = await authFetchJson('/api/admin/settings/policies/reset-defaults', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: targetType })
      });
      if (data && data.success) {
        toastRef.current(
          resetScope === 'all'
            ? 'Seluruh 6 dokumen kebijakan berhasil direset ke standar resmi Catavor v2.0.'
            : `Kebijakan ${POLICY_METADATA[selectedKey].label} berhasil direset ke standar resmi.`,
          'success'
        );
        setShowResetModal(false);
        setResetDragY(0);
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        toastRef.current(data?.message || 'Gagal mereset ke standar resmi.', 'error');
      }
    } catch {
      toastRef.current('Terjadi kesalahan saat memproses reset bawaan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const SelectedIcon = POLICY_METADATA[selectedKey].icon;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header & Breadcrumb */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: '44px',
                padding: '0.45rem 0.8rem',
                borderRadius: '0.6rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={15} strokeWidth={1.75} />
              <span>{backLabel}</span>
            </button>
          )}
          <div>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Scale size={17} strokeWidth={1.75} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>Kebijakan &amp; Regulasi</span>
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Editor 6 pilar hukum &amp; audit SOC 2
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={() => {
              setResetScope('single');
              setShowResetModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              minHeight: '44px',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.6rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} strokeWidth={1.75} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            aria-label="Segarkan data kebijakan"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '0.6rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={15} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Global Legal Identity Card */}
      <div
        style={{
          padding: '0.9rem',
          borderRadius: '0.85rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Building2 size={16} strokeWidth={1.75} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Identitas Hukum &amp; Peringatan Kepatuhan
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Badan Hukum Resmi
          </label>
          <input
            type="text"
            value={legalEntityName}
            onChange={e => setLegalEntityName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.55rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              minHeight: '44px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Yurisdiksi Hukum
          </label>
          <input
            type="text"
            value={legalJurisdiction}
            onChange={e => setLegalJurisdiction(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.55rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              minHeight: '44px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Banner Peringatan Kepatuhan
          </label>
          <textarea
            rows={2}
            value={legalWarningBanner}
            onChange={e => setLegalWarningBanner(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.55rem',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSaveGlobalSettings}
          disabled={isSavingGlobalSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            width: '100%',
            padding: '0.55rem 1rem',
            borderRadius: '0.6rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: isSavingGlobalSettings ? 'not-allowed' : 'pointer',
            minHeight: '44px'
          }}
        >
          {isSavingGlobalSettings ? <RefreshCw size={15} strokeWidth={1.75} className="animate-spin" /> : <Save size={15} strokeWidth={1.75} />}
          <span>Simpan Identitas Legal</span>
        </button>
      </div>

      {/* Mobile Native Option Picker Bottom Sheet (AGENTS.md Rule 7.A.3 & Rule 11: Replaces 6-Pill Horizontal Row) */}
      <MobileCustomSelect
        value={selectedKey}
        onChange={(val) => setSelectedKey(val as PolicyKey)}
        options={pillarSelectOptions}
        title="Pilih Pilar Kebijakan"
        subtitle="6 dokumen regulasi resmi platform Catavor"
        icon={<SelectedIcon size={16} strokeWidth={1.75} />}
      />

      {/* View Mode Tabs (Editor, Preview, Audit — 3 Bounded Tabs, >= 44px Touch Target) */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.4rem'
        }}
      >
        {(
          [
            { key: 'editor', label: 'Editor', icon: FileEdit },
            { key: 'preview', label: 'Pratinjau', icon: Eye },
            { key: 'audit', label: 'Audit Log', icon: History }
          ] as const
        ).map(t => {
          const isActive = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem 0.5rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-deep)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              <Icon size={15} strokeWidth={1.75} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. EDITOR */}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} strokeWidth={1.75} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>Memuat dokumen kebijakan...</p>
            </div>
          ) : (
            <>
              {/* Document Meta Configuration Card */}
              <div
                style={{
                  padding: '0.9rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Metadata Dokumen &bull; {editableDoc.version}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontWeight: 700
                    }}
                  >
                    {editableDoc.articles.length} Pasal Terdaftar
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Judul Resmi Dokumen
                  </label>
                  <input
                    type="text"
                    value={editableDoc.title}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      minHeight: '44px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Kategori Dokumen
                  </label>
                  <input
                    type="text"
                    value={editableDoc.category}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      minHeight: '44px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Label Badge
                  </label>
                  <input
                    type="text"
                    value={editableDoc.badge}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, badge: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      minHeight: '44px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Ringkasan Eksekutif (Summary)
                  </label>
                  <textarea
                    rows={2}
                    value={editableDoc.summary}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, summary: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Articles Builder Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Daftar Pasal ({editableDoc.articles.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAddArticle}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.6rem',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  <Plus size={16} strokeWidth={1.75} />
                  <span>Tambah Pasal</span>
                </button>
              </div>

              {/* Articles Cards (All Touch Targets >= 44x44px) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editableDoc.articles.map((art, aIdx) => (
                  <div
                    key={aIdx}
                    style={{
                      padding: '0.9rem',
                      borderRadius: '0.85rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={art.number}
                        onChange={(e) => handleUpdateArticle(aIdx, 'number', e.target.value)}
                        style={{
                          width: '96px',
                          padding: '0.4rem 0.55rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: '#10b981',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          minHeight: '44px',
                          boxSizing: 'border-box'
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveArticle(aIdx, 'up')}
                          disabled={aIdx === 0}
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-secondary)',
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
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--bg-deep)',
                            color: 'var(--text-secondary)',
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
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Hapus Pasal"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        Judul Klausul
                      </label>
                      <input
                        type="text"
                        value={art.heading}
                        onChange={(e) => handleUpdateArticle(aIdx, 'heading', e.target.value)}
                        placeholder="Judul klausul pasal..."
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          minHeight: '44px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        Uraian Penjelasan Pasal
                      </label>
                      <textarea
                        rows={3}
                        value={art.content}
                        onChange={(e) => handleUpdateArticle(aIdx, 'content', e.target.value)}
                        placeholder="Uraian isi pasal..."
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Highlights List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
                          Poin Sorotan ({art.highlights?.length || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddHighlight(aIdx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#10b981',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: '0 0.4rem',
                            minHeight: '44px'
                          }}
                        >
                          <Plus size={14} strokeWidth={1.75} />
                          <span>Tambah Butir</span>
                        </button>
                      </div>

                      {art.highlights?.map((hl, hlIdx) => (
                        <div key={hlIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Check size={14} strokeWidth={1.75} style={{ color: '#10b981', flexShrink: 0 }} />
                          <input
                            type="text"
                            value={hl}
                            onChange={(e) => handleUpdateHighlight(aIdx, hlIdx, e.target.value)}
                            style={{
                              flex: 1,
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              minHeight: '44px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteHighlight(aIdx, hlIdx)}
                            style={{
                              minWidth: '44px',
                              minHeight: '44px',
                              borderRadius: '0.45rem',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Hapus butir"
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Version & Publishing Controls Card (Uses MobileCustomSelect instead of native <select>) */}
              <div
                style={{
                  padding: '0.9rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  marginTop: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Sparkles size={16} strokeWidth={1.75} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Publikasikan Pembaruan Regulasi
                  </h4>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Versi Baru
                  </label>
                  <input
                    type="text"
                    value={editableDoc.version}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="v2.1"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      minHeight: '44px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Tingkat Perubahan
                  </label>
                  <MobileCustomSelect
                    value={editableDoc.changeType}
                    onChange={(val) => setEditableDoc(prev => ({ ...prev, changeType: val === 'major' ? 'major' : 'minor' }))}
                    options={CHANGE_TYPE_OPTIONS}
                    title="Pilih Tingkat Perubahan"
                    subtitle="Tentukan dampak pembaruan dokumen hukum"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    Catatan Perubahan (Summary of Changes)
                  </label>
                  <input
                    type="text"
                    value={editableDoc.summaryOfChanges}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, summaryOfChanges: e.target.value }))}
                    placeholder="Contoh: Pembaruan klausul garansi pengiriman tanaman dan fauna..."
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      minHeight: '44px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', minHeight: '44px' }}>
                  <input
                    type="checkbox"
                    checked={editableDoc.requiresAcceptance}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, requiresAcceptance: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>Wajibkan persetujuan ulang bagi seluruh merchant</span>
                </label>

                <button
                  type="button"
                  onClick={handleSavePolicy}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.7rem 1.25rem',
                    borderRadius: '0.65rem',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    minHeight: '46px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {isSaving ? <RefreshCw size={16} strokeWidth={1.75} className="animate-spin" /> : <Save size={16} strokeWidth={1.75} />}
                  <span>{isSaving ? 'Menyimpan...' : `Publikasikan Versi Baru (${editableDoc.version})`}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: 2. LIVE PREVIEW (Renders Unsaved Draft Real-Time) */}
      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.76rem',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Eye size={16} strokeWidth={1.75} />
            <span>Pratinjau Draf Real-Time ({POLICY_METADATA[selectedKey].label})</span>
          </div>

          <MobilePoliciesView
            initialKey={selectedKey}
            draftOverride={draftOverride}
            onOpenHelpdesk={() => toastRef.current('Navigasi helpdesk dipicu dari pratinjau.', 'success')}
          />
        </div>
      )}

      {/* TAB CONTENT: 3. AUDIT LOGS WITH COMPACT 1-LINE PREV-NEXT BAR */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <History size={16} strokeWidth={1.75} color="#94a3b8" />
              <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Jejak Audit SOC 2 ({auditTotal})
              </h4>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={isLoadingLogs}
              style={{
                minHeight: '44px',
                padding: '0 0.65rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.74rem',
                fontWeight: 700
              }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isLoadingLogs ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>

          {isLoadingLogs ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} strokeWidth={1.75} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Memuat riwayat audit...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Belum ada log perubahan dokumen kebijakan.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>
                        {log.policy_type.toUpperCase()} &bull; {log.old_version || '-'} &rarr; {log.new_version || '-'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {log.change_summary || 'Pembaruan isi klausul regulasi'}
                    </p>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                      Oleh: {log.admin_email || 'System'} ({log.admin_ip || '-'})
                    </span>
                  </div>
                ))}
              </div>

              {/* Compact 1-Line Prev-Next Bar (AGENTS.md Rule 7.C.3) */}
              {auditTotalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <button
                    type="button"
                    disabled={auditPage <= 1 || isLoadingLogs}
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      minHeight: '44px',
                      padding: '0 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: auditPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: auditPage <= 1 ? 0.4 : 1
                    }}
                  >
                    <ChevronLeft size={15} strokeWidth={1.75} />
                    <span>Sebelumnya</span>
                  </button>

                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Hal <strong style={{ color: 'var(--text-primary)' }}>{auditPage}</strong> / {auditTotalPages}
                  </span>

                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages || isLoadingLogs}
                    onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      minHeight: '44px',
                      padding: '0 0.85rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: auditPage >= auditTotalPages ? 'not-allowed' : 'pointer',
                      opacity: auditPage >= auditTotalPages ? 0.4 : 1
                    }}
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={15} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Slide-Up Bottom Sheet: Reset to Official Defaults (AGENTS.md Rule 7.A.3 — Zero 'X' Header Button) */}
      {showResetModal && (
        <div
          onClick={closeResetSheet}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: isClosingResetSheet ? 'rgba(0, 0, 0, 0)' : 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            transition: 'background-color 0.25s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '85vh',
              backgroundColor: '#0f172a',
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              borderTopLeftRadius: '1.25rem',
              borderTopRightRadius: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -18px 48px rgba(0, 0, 0, 0.7)',
              transform: isClosingResetSheet ? 'translateY(100%)' : `translateY(${resetDragY}px)`,
              transition: isResetDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            {/* Clean Drag Handle + Header (Zero 'X' button per AGENTS.md Rule 7.A.3) */}
            <div
              onTouchStart={(e) => {
                resetTouchStartY.current = e.touches[0].clientY;
                setIsResetDragging(true);
              }}
              onTouchMove={(e) => {
                const delta = e.touches[0].clientY - resetTouchStartY.current;
                setResetDragY(delta < 0 ? delta * 0.18 : delta);
              }}
              onTouchEnd={() => {
                setIsResetDragging(false);
                if (resetDragYRef.current >= 70) {
                  closeResetSheet();
                } else {
                  setResetDragY(0);
                }
              }}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                cursor: 'grab',
                padding: '0.65rem 1.15rem 0.85rem 1.15rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(148, 163, 184, 0.45)',
                  margin: '0 auto 0.75rem auto'
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={19} strokeWidth={1.75} />
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#ffffff' }}>
                  Konfirmasi Reset ke Standar Resmi
                </h3>
              </div>
            </div>

            {/* Body with Isolated Touch Scroll */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                padding: '1rem 1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                Pilih cakupan reset ke standar hukum resmi Catavor v2.0. Versi sebelumnya tetap tersimpan secara utuh di riwayat audit SOC 2:
              </p>

              {/* Touch-Friendly Scope Option Pills (>= 48px, with Check indicator) */}
              <button
                type="button"
                onClick={() => setResetScope('single')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                  minHeight: '52px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.7rem',
                  border: resetScope === 'single' ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: resetScope === 'single' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block' }}>
                    Hanya Dokumen {POLICY_METADATA[selectedKey].label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    5 pilar kebijakan lainnya tidak berubah
                  </span>
                </div>
                {resetScope === 'single' && <Check size={17} strokeWidth={2} style={{ color: '#10b981', flexShrink: 0 }} />}
              </button>

              <button
                type="button"
                onClick={() => setResetScope('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                  minHeight: '52px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.7rem',
                  border: resetScope === 'all' ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: resetScope === 'all' ? 'rgba(239, 68, 68, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block' }}>
                    Seluruh 6 Pilar Kebijakan Platform
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Kembalikan keenam dokumen ke standar bawaan v2.0
                  </span>
                </div>
                {resetScope === 'all' && <Check size={17} strokeWidth={2} style={{ color: '#ef4444', flexShrink: 0 }} />}
              </button>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: '0.55rem', padding: '0.85rem 1.15rem 1rem 1.15rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                onClick={closeResetSheet}
                disabled={isResetting}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  minHeight: '46px'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isResetting}
                style={{
                  flex: 1.35,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  minHeight: '46px'
                }}
              >
                {isResetting ? <RefreshCw size={15} strokeWidth={1.75} className="animate-spin" /> : <RotateCcw size={15} strokeWidth={1.75} />}
                <span>{isResetting ? 'Mereset...' : resetScope === 'all' ? 'Reset 6 Pilar' : 'Reset Dokumen Ini'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePolicyManager;
