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
import { MobilePoliciesView, type PolicyKey, type PolicyArticle } from './MobilePoliciesView';

export interface MobilePolicyManagerProps {
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

export const MobilePolicyManager: React.FC<MobilePolicyManagerProps> = ({
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
            title: raw.title || POLICY_METADATA[selectedKey].label,
            category,
            badge,
            summary,
            version: raw.version || 'v2.0',
            articles,
            changeType: 'minor',
            summaryOfChanges: '',
            requiresAcceptance: false
          });
        }
      }
    } catch {
      showToast('Gagal memuat dokumen kebijakan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, token, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/settings/policy-audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setAuditLogs(data.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingLogs(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Save Global Legal Identity Settings
  const handleSaveGlobalSettings = async () => {
    if (!token) {
      showToast('Autentikasi staf diperlukan.', 'error');
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
        showToast('Identitas legal platform berhasil disimpan.', 'success');
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

  // Article Manipulation Helpers
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

  // Save Policy to Backend
  const handleSavePolicy = async () => {
    if (!token) {
      showToast('Autentikasi staf diperlukan.', 'error');
      return;
    }
    if (!editableDoc.title.trim()) {
      showToast('Judul dokumen kebijakan tidak boleh kosong.', 'error');
      return;
    }
    if (editableDoc.articles.length === 0) {
      showToast('Dokumen harus memiliki setidaknya satu pasal aktif.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        type: editableDoc.type,
        title: editableDoc.title,
        version: editableDoc.version,
        change_type: editableDoc.changeType,
        summary_of_changes: editableDoc.summaryOfChanges || `Pembaruan klausul dokumen ${POLICY_METADATA[editableDoc.type].label}`,
        requires_acceptance: editableDoc.requiresAcceptance,
        sections: {
          category: editableDoc.category,
          badge: editableDoc.badge,
          icon_key: editableDoc.type === 'terms' ? 'scale' : editableDoc.type === 'prohibited' ? 'shield-alert' : editableDoc.type === 'privacy' ? 'lock' : 'check-circle-2',
          summary: editableDoc.summary,
          articles: editableDoc.articles
        }
      };

      const res = await fetch('/api/admin/settings/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(`Dokumen ${POLICY_METADATA[editableDoc.type].label} berhasil dipublikasikan.`, 'success');
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
      } else {
        showToast(data?.message || 'Gagal menyimpan dokumen kebijakan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan kebijakan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Factory Defaults Reset
  const handleResetDefaults = async () => {
    if (!token) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/settings/policies/reset-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ policy_type: selectedKey })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(`Kebijakan ${POLICY_METADATA[selectedKey].label} berhasil direset ke standar resmi.`, 'success');
        setShowResetModal(false);
        window.dispatchEvent(new CustomEvent('catavor_policies_updated'));
        fetchData();
      } else {
        showToast(data?.message || 'Gagal mereset ke standar resmi.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat memproses reset bawaan.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Top Header & Breadcrumb */}
      <div style={{
        padding: '0.85rem 1rem',
        borderRadius: '0.85rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Scale size={18} color="#10b981" />
              <h2 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Kebijakan &amp; Legalitas Platform
              </h2>
            </div>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              6 Pilar Regulasi &bull; UU PDP &bull; Dinamis &bull; Kontrol Versi
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
              padding: '0.45rem 0.75rem',
              borderRadius: '0.6rem',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: '44px'
            }}
          >
            <RotateCcw size={15} />
            <span>Reset Bawaan</span>
          </button>
        </div>
      </div>

      {/* Global Legal Identity Banner Card */}
      <div style={{
        padding: '0.9rem',
        borderRadius: '0.85rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Building2 size={16} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Identitas Legal &amp; Peringatan Platform
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Nama Entitas Hukum
            </label>
            <input
              type="text"
              value={legalEntityName}
              onChange={(e) => setLegalEntityName(e.target.value)}
              placeholder="PT Catavor Media Digital"
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
              Yurisdiksi &amp; Domisili Hukum
            </label>
            <input
              type="text"
              value={legalJurisdiction}
              onChange={(e) => setLegalJurisdiction(e.target.value)}
              placeholder="Hukum Republik Indonesia"
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
              Teks Banner Peringatan Kepatuhan (Opsional)
            </label>
            <input
              type="text"
              value={legalWarningBanner}
              onChange={(e) => setLegalWarningBanner(e.target.value)}
              placeholder="Contoh: Pembaruan Kebijakan Privasi & Ketentuan Transaksi berlaku efektif 12 November 2026."
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={handleSaveGlobalSettings}
              disabled={isSavingGlobalSettings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.55rem',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: isSavingGlobalSettings ? 'not-allowed' : 'pointer',
                minHeight: '44px'
              }}
            >
              {isSavingGlobalSettings ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Simpan Identitas Legal</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Policy Pills Selector (Scrollable Horizontal) */}
      <div style={{
        display: 'flex',
        gap: '0.45rem',
        overflowX: 'auto',
        paddingBottom: '0.35rem',
        WebkitOverflowScrolling: 'touch'
      }}>
        {(Object.keys(POLICY_METADATA) as PolicyKey[]).map((key) => {
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
                padding: '0.55rem 0.95rem',
                borderRadius: '0.7rem',
                border: `1.5px solid ${isSelected ? '#10b981' : 'var(--border-light)'}`,
                backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                color: isSelected ? '#10b981' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0
              }}
            >
              <Icon size={16} />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Mode Tabs (Editor, Preview, Audit) */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '0.4rem'
      }}>
        {[
          { key: 'editor', label: 'Editor Pasal', icon: FileEdit },
          { key: 'preview', label: 'Pratinjau Live', icon: Eye },
          { key: 'audit', label: 'Log Audit SOC 2', icon: History }
        ].map(t => {
          const isActive = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-deep)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              <Icon size={15} />
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
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>Memuat dokumen kebijakan...</p>
            </div>
          ) : (
            <>
              {/* Document Meta Configuration Card */}
              <div style={{
                padding: '0.9rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Metadata Dokumen &bull; {editableDoc.version}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontWeight: 700
                  }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
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
                  <Plus size={16} />
                  <span>Tambah Pasal</span>
                </button>
              </div>

              {/* Articles Cards */}
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
                    {/* Article Header & Order Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={art.number}
                        onChange={(e) => handleUpdateArticle(aIdx, 'number', e.target.value)}
                        style={{
                          width: '90px',
                          padding: '0.4rem 0.55rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-deep)',
                          color: '#10b981',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          minHeight: '40px'
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveArticle(aIdx, 'up')}
                          disabled={aIdx === 0}
                          style={{
                            width: '40px',
                            height: '40px',
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
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveArticle(aIdx, 'down')}
                          disabled={aIdx === editableDoc.articles.length - 1}
                          style={{
                            width: '40px',
                            height: '40px',
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
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(aIdx)}
                          style={{
                            width: '40px',
                            height: '40px',
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
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Heading */}
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

                    {/* Content */}
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
                          Poin Sorotan / Butir Kepatuhan ({art.highlights?.length || 0})
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
                            padding: '0.2rem 0.4rem',
                            minHeight: '36px'
                          }}
                        >
                          <Plus size={14} />
                          <span>Tambah Butir</span>
                        </button>
                      </div>

                      {art.highlights?.map((hl, hlIdx) => (
                        <div key={hlIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ color: '#10b981', fontSize: '0.75rem' }}>&bull;</span>
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
                              minHeight: '40px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteHighlight(aIdx, hlIdx)}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '0.45rem',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Hapus butir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Version & Publishing Controls Card */}
              <div style={{
                padding: '0.9rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                marginTop: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Sparkles size={16} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Publikasikan Pembaruan Regulasi
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      Tipe Perubahan
                    </label>
                    <select
                      value={editableDoc.changeType}
                      onChange={(e) => setEditableDoc(prev => ({ ...prev, changeType: e.target.value as any }))}
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
                    >
                      <option value="minor">Minor (Redaksional)</option>
                      <option value="major">Major (Substansi Hukum)</option>
                    </select>
                  </div>
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

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={editableDoc.requiresAcceptance}
                    onChange={(e) => setEditableDoc(prev => ({ ...prev, requiresAcceptance: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }}
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
                    minHeight: '44px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSaving ? 'Menyimpan...' : `Publikasikan Versi Baru (${editableDoc.version})`}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: 2. PREVIEW */}
      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: '0.65rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '0.76rem',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}>
            <Eye size={16} />
            <span>Mode Pratinjau Interaktif Dokumen Kebijakan Publik</span>
          </div>

          <MobilePoliciesView onOpenHelpdesk={() => showToast('Navigasi helpdesk dipicu dari pratinjau.', 'success')} />
        </div>
      )}

      {/* TAB CONTENT: 3. AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <History size={16} color="#8b5cf6" />
              <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Riwayat Jejak Audit SOC 2
              </h4>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem'
              }}
            >
              <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>

          {isLoadingLogs ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Memuat riwayat audit...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Belum ada log perubahan dokumen kebijakan.</p>
            </div>
          ) : (
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>
                      {log.policy_type.toUpperCase()} &bull; {log.old_version || '-'} &rarr; {log.new_version}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {log.change_summary || 'Pembaruan isi klausul regulasi'}
                  </p>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    Oleh: {log.admin_email} ({log.admin_ip})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: Reset to Factory Defaults */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertTriangle size={20} />
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>
                Konfirmasi Reset ke Standar Resmi
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin mengembalikan dokumen <strong>{POLICY_METADATA[selectedKey].label}</strong> ke standar hukum bawaan platform Catavor? Seluruh penyesuaian kustom pada pasal ini akan ditimpa dengan draf hukum resmi.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  minHeight: '44px'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isResetting}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.55rem',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  minHeight: '44px'
                }}
              >
                {isResetting ? <RefreshCw size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                <span>{isResetting ? 'Mereset...' : 'Ya, Reset ke Standar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePolicyManager;
