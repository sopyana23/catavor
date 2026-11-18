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
  RefreshCw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { TabletPoliciesView, type PolicyKey, type PolicyArticle } from './TabletPoliciesView';

export interface TabletPolicyManagerProps {
  token: string;
  isDark?: boolean;
  theme?: any;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onBack?: () => void;
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
  privacy: { label: 'Privasi & Data B2B', icon: Lock, defaultCategory: 'Kepatuhan UU No. 27 Tahun 2022 (PDP)', defaultBadge: 'Standar Perlindungan Privasi' },
  moderation: { label: 'Moderasi & Sanksi', icon: CheckCircle2, defaultCategory: 'Prosedur Disiplin Ekosistem', defaultBadge: 'Transparansi & Akuntabilitas' },
  transactions: { label: 'Transaksi & Rekber', icon: CheckCircle2, defaultCategory: 'Integritas Pembayaran & Sengketa', defaultBadge: 'Prosedur Keamanan Keuangan' },
  subscription: { label: 'Langganan & Kuota', icon: CreditCard, defaultCategory: 'Model Layanan Bisnis & Kuota', defaultBadge: 'Ketentuan Komersial Merchant' }
};

export const TabletPolicyManager: React.FC<TabletPolicyManagerProps> = ({
  token,
  isDark = true,
  theme,
  showToast,
  onBack
}) => {
  const [selectedKey, setSelectedKey] = useState<PolicyKey>('terms');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'audit'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

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
      showToast('Gagal memuat konfigurasi kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, showToast]);

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
      showToast('Autentikasi diperlukan.', 'error');
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
        showToast('Identitas hukum platform berhasil disimpan.', 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
      } else {
        showToast(data?.message || 'Gagal menyimpan pengaturan legal.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan identitas legal.', 'error');
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  // Article Helpers
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
      showToast('Autentikasi admin diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      showToast('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      showToast('Dokumen kebijakan wajib memiliki minimal 1 pasal.', 'error');
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
        showToast(`Kebijakan ${editableDoc.title} berhasil diperbarui ke ${payload.version}!`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        showToast(json?.message || 'Gagal menyimpan pembaruan kebijakan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
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
        showToast(resetAll ? 'Seluruh 6 dokumen kebijakan berhasil direset ke standar resmi Catavor v2.0!' : `Dokumen ${POLICY_METADATA[selectedKey].label} berhasil direset ke standar resmi!`, 'success');
        setShowResetModal(false);
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
        if (activeTab === 'audit') fetchAuditLogs();
      } else {
        showToast(json?.message || 'Gagal mereset kebijakan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mereset kebijakan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const SelectedIcon = POLICY_METADATA[selectedKey].icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '1rem' }}>
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
                gap: '0.35rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                minHeight: '44px'
              }}
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scale size={20} style={{ color: '#10b981' }} />
              <span>Kebijakan, Regulasi &amp; Legalitas Platform</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
              Kelola 6 pilar kebijakan resmi Catavor, susunan pasal terstruktur, pratinjau publik, dan riwayat audit.
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
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              minHeight: '44px'
            }}
          >
            <RotateCcw size={14} />
            <span>Reset Standar Resmi</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              minHeight: '44px'
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
          padding: '1.15rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: '#2563eb' }} />
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff', display: 'block' }}>
                Identitas Hukum &amp; Banner Peringatan Kepatuhan
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                Ditampilkan pada seluruh kop dokumen hukum dan banner peringatan katalog.
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
            <Save size={14} />
            <span>{isSavingGlobalSettings ? 'Menyimpan...' : 'Simpan Identitas'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
              Nama Badan Hukum Resmi
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

      {/* 3. Segmented Touch Tabs (6 Pillars) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          WebkitOverflowScrolling: 'touch'
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-card, #0f172a)',
                border: `1.5px solid ${isSelected ? '#10b981' : 'var(--border-light, rgba(255, 255, 255, 0.1))'}`,
                color: isSelected ? '#10b981' : '#ffffff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '0.82rem',
                minHeight: '44px',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Sub-Mode Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '0.5rem'
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
          <FileEdit size={15} />
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
          <Eye size={15} />
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
            backgroundColor: activeTab === 'audit' ? '#8b5cf6' : 'transparent',
            color: activeTab === 'audit' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <History size={15} />
          <span>Riwayat Audit</span>
        </button>
      </div>

      {/* 5. SUB-MODE: EDITOR */}
      {activeTab === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Metadata Card */}
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
              <SelectedIcon size={18} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Metadata: {POLICY_METADATA[selectedKey].label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
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
                  backgroundColor: 'var(--bg-card, #0f172a)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1 }}>
                    <input
                      type="text"
                      value={art.number}
                      onChange={e => handleUpdateArticle(aIdx, 'number', e.target.value)}
                      placeholder="Pasal 1"
                      style={{
                        width: '85px',
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
                        padding: '0.45rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#ffffff',
                        cursor: aIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === 0 ? 0.4 : 1,
                        minHeight: '44px',
                        minWidth: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveArticle(aIdx, 'down')}
                      disabled={aIdx === editableDoc.articles.length - 1}
                      style={{
                        padding: '0.45rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                        color: '#ffffff',
                        cursor: aIdx === editableDoc.articles.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: aIdx === editableDoc.articles.length - 1 ? 0.4 : 1,
                        minHeight: '44px',
                        minWidth: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(aIdx)}
                      style={{
                        padding: '0.45rem',
                        borderRadius: '0.4rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        minHeight: '44px',
                        minWidth: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={art.content}
                    onChange={e => handleUpdateArticle(aIdx, 'content', e.target.value)}
                    placeholder="Uraian isi pasal..."
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
                </div>

                {/* Highlights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
                      Poin Sorotan Kepatuhan
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
                        padding: '0.25rem'
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
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.35rem'
                        }}
                      >
                        <Trash2 size={14} />
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
              <Sparkles size={18} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Publikasikan Versi Baru
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
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
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Tingkat Perubahan
                </label>
                <select
                  value={editableDoc.changeType}
                  onChange={e => setEditableDoc(prev => ({ ...prev, changeType: e.target.value as any }))}
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
                >
                  <option value="minor">MINOR (Perbaikan Redaksional)</option>
                  <option value="major">MAJOR (Perubahan Substansial)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '0.2rem' }}>
                  Persetujuan Ulang
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
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
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : `Publikasikan Versi Baru (${editableDoc.version})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-MODE: PREVIEW */}
      {activeTab === 'preview' && (
        <div style={{ borderRadius: '1rem', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', overflow: 'hidden' }}>
          <TabletPoliciesView initialKey={selectedKey} />
        </div>
      )}

      {/* 5. SUB-MODE: AUDIT */}
      {activeTab === 'audit' && (
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                Riwayat Audit Perubahan Kebijakan
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
              Segarkan
            </button>
          </div>

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
                        <span style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '0.35rem',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          backgroundColor: log.action === 'reset_defaults' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: log.action === 'reset_defaults' ? '#ef4444' : '#10b981'
                        }}>
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
      )}

      {/* 6. Reset Modal */}
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
              backgroundColor: '#0f172a',
              borderRadius: '1rem',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={22} style={{ color: '#ef4444' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Reset Standar Resmi Catavor
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Kembalikan dokumen kebijakan ke standar resmi v2.0.
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              Pilih untuk mereset dokumen <strong>{POLICY_METADATA[selectedKey].label}</strong> saja atau <strong>seluruh 6 pilar kebijakan platform</strong>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
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

