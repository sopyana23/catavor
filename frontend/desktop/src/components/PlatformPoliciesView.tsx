import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Check,
  ExternalLink,
  Info,
  Building2,
  ArrowLeft,
  Search,
  Calendar
} from 'lucide-react';
import {
  type PolicyKey,
  type PolicyArticle,
  type PolicyDoc,
  type ApiPolicyRecord,
  type DraftPolicyOverride,
  hydratePolicyDocs,
  renderPolicyInlineMarkdown,
  renderPolicyArticleContent
} from '../utils/policyShared';
import { ExternalLinkWarningModal } from './ExternalLinkWarningModal';

export type { PolicyKey, PolicyArticle, PolicyDoc, DraftPolicyOverride };

export interface PlatformPoliciesViewProps {
  onOpenHelpdesk?: () => void;
  initialKey?: PolicyKey;
  onBack?: () => void;
  draftOverride?: DraftPolicyOverride | null;
}

export const PlatformPoliciesView: React.FC<PlatformPoliciesViewProps> = ({
  onOpenHelpdesk,
  initialKey,
  onBack,
  draftOverride
}) => {
  const [activeKey, setActiveKey] = useState<PolicyKey>(initialKey || 'terms');
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicPolicies, setDynamicPolicies] = useState<Record<string, ApiPolicyRecord | undefined>>({});
  const [legalSettings, setLegalSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialKey) {
      setActiveKey(initialKey);
    }
  }, [initialKey]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [policiesRes, settingsRes] = await Promise.all([
        fetch('/api/policies').then(r => r.json()).catch(() => null),
        fetch('/api/settings').then(r => r.json()).catch(() => null)
      ]);

      if (policiesRes && policiesRes.success && policiesRes.data) {
        setDynamicPolicies(policiesRes.data as Record<string, ApiPolicyRecord | undefined>);
      }
      if (settingsRes && settingsRes.success && settingsRes.data) {
        setLegalSettings(settingsRes.data as Record<string, string>);
      }
    } catch {
      // Graceful fallback to static definitions
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('catavor_policies_updated', handleUpdate);
    return () => window.removeEventListener('catavor_policies_updated', handleUpdate);
  }, []);

  const policyDocs: PolicyDoc[] = useMemo(
    () => hydratePolicyDocs(dynamicPolicies, draftOverride),
    [dynamicPolicies, draftOverride]
  );

  const currentDoc = policyDocs.find(doc => doc.key === activeKey) || policyDocs[0];
  const ActiveIcon = currentDoc.icon;

  const legalEntity = legalSettings.legal_entity_name || 'PT Catavor Media Digital';
  const legalJurisdiction = legalSettings.legal_jurisdiction || 'Hukum Republik Indonesia';
  const legalWarning =
    legalSettings.legal_warning_banner ||
    'Sebagai pengelola katalog, Anda bertanggung jawab penuh atas keabsahan hukum dari setiap item yang dipajang. Segala bentuk peredaran satwa liar dilindungi tanpa izin BKSDA, tanaman langka tanpa karantina, komoditas ilegal, penipuan harga, atau pelanggaran hak cipta berakibat pada penindakan tegas berupa penonaktifan seketika (Item Locked) hingga pembekuan profil katalog permanen.';
  const officialEmail = legalSettings.platform_official_email || 'support@catavor.com';
  const officialWa = legalSettings.platform_official_whatsapp || '62811220227';

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentDoc.articles;
    return currentDoc.articles.filter(art => {
      const inNum = (art.number || '').toLowerCase().includes(q);
      const inHead = (art.heading || '').toLowerCase().includes(q);
      const inContent = (art.content || '').toLowerCase().includes(q);
      const inHighlights = (art.highlights || []).some(h => (h || '').toLowerCase().includes(q));
      return inNum || inHead || inContent || inHighlights;
    });
  }, [currentDoc, searchQuery]);

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: '0 0.5rem 3rem 0.5rem',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Executive Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '1.25rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          backgroundColor: 'var(--bg-card, #0f172a)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            {onBack && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.65rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ArrowLeft size={15} strokeWidth={1.75} />
                  <span>Kembali</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--primary, #10b981)',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  border: '1px solid var(--primary, #10b981)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px'
                }}
              >
                <ShieldCheck size={14} strokeWidth={1.75} />
                Dokumen Resmi Pengelola Platform
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Building2 size={13} strokeWidth={1.75} />
                {legalEntity}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <Scale size={12} strokeWidth={1.75} style={{ color: 'var(--primary, #10b981)' }} />
                Yurisdiksi: {legalJurisdiction}
              </span>
              {isLoading && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary, #10b981)' }}>
                  Memuat data resmi...
                </span>
              )}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.65rem',
                fontWeight: 800,
                color: 'var(--text-primary, #ffffff)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25
              }}
            >
              Pedoman Legal, Ketentuan &amp; Kepatuhan Platform
            </h1>
            <p
              style={{
                margin: '0.65rem 0 0 0',
                fontSize: '0.88rem',
                color: 'var(--text-secondary, #cbd5e1)',
                lineHeight: 1.6,
                maxWidth: '900px'
              }}
            >
              Ketentuan resmi ini diterbitkan oleh pengelola Platform Catavor untuk dipelajari, dipahami, dan dipatuhi oleh seluruh pemilik serta pengelola profil katalog. Harap cermat dan bertanggung jawab dalam mempublikasikan setiap item komoditas demi menjaga integritas ekosistem bisnis serta melindungi akun Anda dari sanksi penonaktifan katalog.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {onOpenHelpdesk && (
              <button
                type="button"
                onClick={onOpenHelpdesk}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: 'auto',
                  padding: '0.65rem 1.15rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <HelpCircle size={16} strokeWidth={1.75} />
                <span>Konsultasi Tim Kepatuhan</span>
              </button>
            )}
          </div>
        </div>

        {/* Compliance Warning Callout */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.85rem',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '0.55rem',
              backgroundColor: 'rgba(245, 158, 11, 0.18)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              flexShrink: 0,
              marginTop: '2px'
            }}
          >
            <AlertTriangle size={18} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.04em', display: 'block' }}>
              Peringatan Kehati-hatian Pengunggahan Item
            </span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              {renderPolicyInlineMarkdown(legalWarning, setPendingExternalUrl)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Reader Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Navigation Sidebar */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--bg-card, #0f172a)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            position: 'sticky',
            top: '1rem'
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem 0.35rem 0.75rem', borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}>
              6 Pilar Kebijakan Platform
            </span>
          </div>

          {policyDocs.map((doc, idx) => {
            const isSelected = doc.key === activeKey;
            const DocIcon = doc.icon;

            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => {
                  setActiveKey(doc.key);
                  setSearchQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.8rem 0.9rem',
                  borderRadius: '0.75rem',
                  border: isSelected ? '1px solid var(--primary, #10b981)' : '1px solid transparent',
                  backgroundColor: isSelected ? 'var(--primary-glow, rgba(16, 185, 129, 0.15))' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '0.5rem',
                    backgroundColor: isSelected ? 'var(--primary, #10b981)' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <DocIcon size={16} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                        display: 'block',
                        lineHeight: 1.35
                      }}
                    >
                      {idx + 1}. {doc.navLabel}
                    </span>
                    {doc.version && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.35rem',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                          flexShrink: 0
                        }}
                      >
                        {doc.version}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: isSelected ? 'var(--primary, #10b981)' : 'var(--text-muted, #94a3b8)',
                      marginTop: '0.2rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {doc.category}
                  </span>
                </div>
              </button>
            );
          })}

          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Info size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
              Ketentuan ini berlaku mengikat seluruh profil katalog secara otomatis sejak tanggal efektif.
            </span>
          </div>
        </div>

        {/* Right Column: Active Document Content Reader */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '1.25rem',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--bg-card, #0f172a)',
            padding: '2rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem'
          }}
        >
          {/* Document Header */}
          <div style={{ borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--primary, #10b981)',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--primary, #10b981)'
                }}
              >
                {currentDoc.badge}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={13} strokeWidth={1.75} />
                Versi: <strong>{currentDoc.version || 'v2.0'}</strong> • Berlaku: <strong>{currentDoc.effectiveDate || '1 Januari 2025'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  border: '1px solid var(--border-light, rgba(16, 185, 129, 0.35))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #10b981)',
                  flexShrink: 0
                }}
              >
                <ActiveIcon size={22} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3 }}>
                  {currentDoc.title}
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Kategori Regulasi: <strong>{currentDoc.category}</strong>
                </span>
              </div>
            </div>

            {/* Document Summary Box */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                fontSize: '0.86rem',
                color: 'var(--text-secondary, #cbd5e1)',
                lineHeight: 1.65
              }}
            >
              <strong style={{ color: 'var(--text-primary, #ffffff)', display: 'block', marginBottom: '0.25rem' }}>
                Ringkasan Eksekutif:
              </strong>
              {renderPolicyInlineMarkdown(
                (currentDoc.summary || '')
                  .replace(/^>+\s*/gm, '')
                  .replace(/^\*\*Ringkasan Eksekutif:\*\*\s*/i, '')
                  .replace(/^[ \t]*---+[ \t]*$/gm, '')
                  .replace(/^[ \t]*--+[ \t]*$/gm, ''),
                setPendingExternalUrl
              )}
            </div>

            {/* Article Filter / Search Bar */}
            <div style={{ marginTop: '1rem', position: 'relative' }}>
              <Search size={15} strokeWidth={1.75} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
              <input
                type="text"
                placeholder={`Cari pasal atau topik dalam ${currentDoc.navLabel}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 4.75rem 0.65rem 2.4rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  color: '#ffffff',
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
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Bersihkan
                </button>
              )}
            </div>
          </div>

          {/* Articles Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filteredArticles.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '0.85rem',
                  border: '1px dashed var(--border-light, rgba(255, 255, 255, 0.1))'
                }}
              >
                <Search size={28} strokeWidth={1.75} style={{ color: 'var(--text-muted, #94a3b8)', margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                  Tidak ada pasal yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  Tampilkan Seluruh Pasal
                </button>
              </div>
            ) : (
              filteredArticles.map((art, aIdx) => (
                <div
                  key={aIdx}
                  style={{
                    padding: '1.35rem 1.5rem',
                    borderRadius: '0.85rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.07))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: 'var(--primary, #10b981)',
                        backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.12))',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.4rem',
                        border: '1px solid var(--primary, #10b981)'
                      }}
                    >
                      {art.number || `Pasal ${aIdx + 1}`}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                      {renderPolicyInlineMarkdown((art.heading || '').replace(/^#+\s*/, ''), setPendingExternalUrl)}
                    </h3>
                  </div>

                  {renderPolicyArticleContent(art.content, setPendingExternalUrl)}

                  {art.highlights && art.highlights.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem'
                      }}
                    >
                      {art.highlights.map((h, hIdx) => (
                        <div key={hIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                          <Check size={13} style={{ color: 'var(--primary, #10b981)', flexShrink: 0, marginTop: '2px' }} strokeWidth={1.75} />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
                            {renderPolicyInlineMarkdown(h, setPendingExternalUrl)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Legal Certification Footer */}
          <div
            style={{
              marginTop: '0.5rem',
              padding: '1.15rem 1.35rem',
              borderRadius: '0.85rem',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldCheck size={22} strokeWidth={1.75} style={{ color: 'var(--primary, #10b981)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', display: 'block' }}>
                  Dokumen Resmi Kepatuhan Platform Catavor
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Dikelola dan diawasi oleh Divisi Hukum &amp; Kepatuhan {legalEntity} • Yurisdiksi: {legalJurisdiction} • Kontak: {officialEmail} / +{officialWa}
                </span>
              </div>
            </div>

            {onOpenHelpdesk && (
              <button
                type="button"
                onClick={onOpenHelpdesk}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary, #10b981)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: 0
                }}
              >
                <span>Ajukan Pertanyaan Kepatuhan</span>
                <ExternalLink size={13} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>

      <ExternalLinkWarningModal
        url={pendingExternalUrl}
        onClose={() => setPendingExternalUrl(null)}
      />
    </div>
  );
};
export default PlatformPoliciesView;
