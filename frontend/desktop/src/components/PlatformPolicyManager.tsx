import React, { useState, useEffect, useCallback } from 'react';
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
  Info,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { PlatformPoliciesView, type PolicyKey, type PolicyArticle } from './PlatformPoliciesView';

export interface PlatformPolicyManagerProps {
  token: string;
  isDark: boolean;
  theme: any;
  onBack: () => void;
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

interface AuditLogEntry {
  id: number;
  policy_type: string;
  action: string;
  old_version: string;
  new_version: string;
  change_summary: string;
  admin_email: string;
  admin_ip: string;
  created_at: string;
}

const POLICY_METADATA: Record<PolicyKey, { label: string; icon: any; defaultCategory: string; defaultBadge: string }> = {
  terms: { label: 'Syarat & Ketentuan', icon: Scale, defaultCategory: 'Ketentuan Umum & Kedudukan Hukum', defaultBadge: 'Dokumen Perjanjian Pengelola' },
  prohibited: { label: 'Komoditas Terlarang', icon: ShieldAlert, defaultCategory: 'Kepatuhan Mutlak (Zero Tolerance)', defaultBadge: 'Wajib Dipatuhi Pengelola' },
  privacy: { label: 'Kebijakan Privasi & B2B', icon: Lock, defaultCategory: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)', defaultBadge: 'Standar Perlindungan Privasi' },
  moderation: { label: 'Moderasi & Sanksi', icon: CheckCircle2, defaultCategory: 'Prosedur Disiplin Ekosistem', defaultBadge: 'Transparansi & Akuntabilitas' },
  transactions: { label: 'Transaksi & Rekber', icon: CheckCircle2, defaultCategory: 'Integritas Pembayaran & Sengketa', defaultBadge: 'Prosedur Keamanan Keuangan' },
  subscription: { label: 'Langganan & Kuota', icon: CreditCard, defaultCategory: 'Model Layanan Bisnis & Kuota', defaultBadge: 'Ketentuan Komersial Merchant' }
};

export const PlatformPolicyManager: React.FC<PlatformPolicyManagerProps> = ({
  token,
  isDark,
  theme,
  onBack,
  onNotify
}) => {
  const [selectedKey, setSelectedKey] = useState<PolicyKey>('terms');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

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

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Load Policies and Settings
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const [policiesRes, settingsRes, publicSettingsRes] = await Promise.all([
        fetch('/api/policies').then(r => r.json()).catch(() => null),
        fetch(token ? '/api/admin/settings' : '/api/settings', { headers: settingsHeaders }).then(r => r.json()).catch(() => null),
        fetch('/api/settings/public').then(r => r.json()).catch(() => null)
      ]);

      const sData = (settingsRes && settingsRes.success && settingsRes.data) 
        ? settingsRes.data 
        : (publicSettingsRes && publicSettingsRes.success ? publicSettingsRes.data : null);

      if (sData) {
        if (sData.legal_entity_name) setLegalEntityName(sData.legal_entity_name);
        if (sData.legal_jurisdiction) setLegalJurisdiction(sData.legal_jurisdiction);
        if (sData.legal_warning_banner) setLegalWarningBanner(sData.legal_warning_banner);
      }

      if (policiesRes && policiesRes.success && policiesRes.data) {
        const raw = policiesRes.data[selectedKey];
        if (raw) {
          let articles: PolicyArticle[] = [];
          let category = POLICY_METADATA[selectedKey].defaultCategory;
          let badge = POLICY_METADATA[selectedKey].defaultBadge;
          let summary = '';

          if (raw.sections) {
            let s = raw.sections;
            if (typeof s === 'string') {
              try { s = JSON.parse(s); } catch {}
            }
            if (s && typeof s === 'object') {
              if (Array.isArray(s.articles)) articles = s.articles;
              if (s.category) category = s.category;
              if (s.badge) badge = s.badge;
              if (s.summary) summary = s.summary;
            }
          }

          setEditableDoc({
            type: selectedKey,
            title: raw.title || '',
            category,
            badge,
            summary,
            version: raw.version || 'v2.0',
            articles,
            changeType: 'minor',
            summaryOfChanges: '',
            requiresAcceptance: raw.requires_acceptance || false
          });
        }
      }
    } catch {
      onNotify('Gagal memuat konfigurasi kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, onNotify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Audit Trail Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/settings/policy-audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        setAuditLogs(json.data);
      }
    } catch {
      // Graceful
    } finally {
      setIsLoadingLogs(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Save Global Legal Settings
  const handleSaveGlobalSettings = async () => {
    if (!token) {
      onNotify('Autentikasi diperlukan.', 'error');
      return;
    }
    setIsSavingGlobalSettings(true);
    try {
      const body = {
        legal_entity_name: legalEntityName,
        legal_jurisdiction: legalJurisdiction,
        legal_warning_banner: legalWarningBanner
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data && data.success) {
        onNotify('Pengaturan identitas legal platform berhasil disimpan.', 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
      } else {
        onNotify(data?.message || 'Gagal menyimpan pengaturan legal.', 'error');
      }
    } catch {
      onNotify('Terjadi kesalahan jaringan saat menyimpan pengaturan legal.', 'error');
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

  const handleUpdateArticle = (index: number, field: keyof PolicyArticle, value: any) => {
    setEditableDoc(prev => {
      const updated = [...prev.articles];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, articles: updated };
    });
  };

  const handleDeleteArticle = (index: number) => {
    setEditableDoc(prev => {
      const updated = prev.articles.filter((_, i) => i !== index);
      return { ...prev, articles: updated };
    });
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
      onNotify('Autentikasi admin diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      onNotify('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      onNotify('Dokumen kebijakan wajib memiliki minimal 1 pasal.', 'error');
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

      const res = await fetch('/api/admin/settings/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json && json.success) {
        onNotify(`Kebijakan ${editableDoc.title} berhasil diperbarui ke ${payload.version}!`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        onNotify(json?.message || 'Gagal menyimpan pembaruan kebijakan.', 'error');
      }
    } catch {
      onNotify('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async (resetAll: boolean) => {
    if (!token) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/settings/policies/reset-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: resetAll ? 'all' : selectedKey })
      });
      const json = await res.json();
      if (json && json.success) {
        onNotify(resetAll ? 'Seluruh 6 dokumen kebijakan berhasil direset ke standar resmi Catavor v2.0!' : `Dokumen ${POLICY_METADATA[selectedKey].label} berhasil direset ke standar resmi!`, 'success');
        setShowResetModal(false);
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        onNotify(json?.message || 'Gagal mereset kebijakan.', 'error');
      }
    } catch {
      onNotify('Terjadi kesalahan jaringan saat mereset kebijakan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const SelectedIcon = POLICY_METADATA[selectedKey].icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
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
              padding: '0.45rem 0.75rem',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Master Data</span>
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scale size={20} style={{ color: '#10b981' }} />
              <span>Kebijakan, Regulasi &amp; Legalitas Platform</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.76rem', color: theme.textSecondary }}>
              Kelola 6 pilar kebijakan resmi Catavor, susunan pasal terstruktur, pratinjau publik, dan riwayat audit SOC 2.
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
            <RotateCcw size={14} />
            <span>Reset ke Standar Resmi</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
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
            <Building2 size={18} style={{ color: '#2563eb' }} />
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
            <Save size={14} />
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

      {/* 3. 6-Pillar Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                <Icon size={16} />
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
          <FileEdit size={15} />
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
          <Eye size={15} />
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
            backgroundColor: activeTab === 'audit' ? '#8b5cf6' : 'transparent',
            color: activeTab === 'audit' ? '#ffffff' : theme.textSecondary,
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <History size={15} />
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
              <SelectedIcon size={18} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Metadata Dokumen: {POLICY_METADATA[selectedKey].label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
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
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
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
                        width: '90px',
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
                      <ChevronUp size={14} />
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
                      <ChevronDown size={14} />
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
                      <Trash2 size={14} />
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

                {/* Highlights List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
                      Poin Sorotan Kepatuhan (Checklist Bullets)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddHighlight(aIdx)}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#10b981',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      + Tambah Butir
                    </button>
                  </div>

                  {(art.highlights || []).map((hl, hlIdx) => (
                    <div key={hlIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓</span>
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
                          padding: '0.2rem'
                        }}
                        title="Hapus Butir"
                      >
                        <Trash2 size={13} />
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
              <Sparkles size={18} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Publikasikan Versi Baru &amp; Catat Jejak Audit
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
                    padding: '0.5rem 0.75rem',
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
                <select
                  value={editableDoc.changeType}
                  onChange={e => setEditableDoc(prev => ({ ...prev, changeType: e.target.value as any }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.55rem',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="minor">MINOR (Perbaikan Redaksional / Penjelasan)</option>
                  <option value="major">MAJOR (Perubahan Substansial / Regulasi Baru)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>
                  Persetujuan Ulang Merchant
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.45rem' }}>
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
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan & Menerbitkan...' : `Publikasikan Versi Baru (${editableDoc.version})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-MODE 2: LIVE PREVIEW */}
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
              <Eye size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
                Pratinjau Langsung Tampilan Merchant &amp; Pengunjung Publik
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Mode Tampilan Dinamis Real-Time
            </span>
          </div>

          <div style={{ padding: '1rem' }}>
            <PlatformPoliciesView initialKey={selectedKey} />
          </div>
        </div>
      )}

      {/* 5. SUB-MODE 3: AUDIT TRAIL */}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                Jejak Audit Perubahan Kebijakan (SOC 2 Policy Audit Trail)
              </span>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              style={{
                fontSize: '0.75rem',
                color: '#8b5cf6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Segarkan Log
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
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.35rem',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: log.action === 'reset_defaults' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: log.action === 'reset_defaults' ? '#ef4444' : '#10b981'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: theme.textPrimary }}>
                        {log.new_version || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: theme.textPrimary, maxWidth: '300px' }}>
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
          )}
        </div>
      )}

      {/* 6. Reset Confirmation Modal */}
      {showResetModal && (
        <div
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
            style={{
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1.5px solid ${theme.border}`,
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
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.textPrimary }}>
                  Konfirmasi Reset ke Standar Resmi
                </h3>
                <span style={{ fontSize: '0.74rem', color: theme.textSecondary }}>
                  Tindakan ini akan mengembalikan dokumen kebijakan ke template standar resmi Catavor v2.0.
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.55 }}>
              Pilih apakah Anda ingin mereset <strong>hanya dokumen {POLICY_METADATA[selectedKey].label}</strong> atau <strong>seluruh 6 pilar kebijakan platform</strong>. Tindakan ini akan dicatat ke dalam log audit SOC 2.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '0.55rem',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: theme.textPrimary,
                  border: `1px solid ${theme.border}`,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
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
