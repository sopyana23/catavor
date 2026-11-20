import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Check,
  Building2,
  ExternalLink,
  Info,
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
import { TabletCustomSelect, type TabletSelectOption } from './TabletCustomSelect';
import { ExternalLinkWarningModal } from './ExternalLinkWarningModal';

export type { PolicyKey, PolicyArticle, PolicyDoc, DraftPolicyOverride };

export interface TabletPoliciesViewProps {
  onOpenHelpdesk?: () => void;
  initialKey?: PolicyKey;
  draftOverride?: DraftPolicyOverride | null;
}

export const TabletPoliciesView: React.FC<TabletPoliciesViewProps> = ({
  onOpenHelpdesk,
  initialKey,
  draftOverride
}) => {
  const [activeKey, setActiveKey] = useState<PolicyKey>(initialKey || 'terms');
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicPolicies, setDynamicPolicies] = useState<Record<string, ApiPolicyRecord | undefined>>({});
  const [legalSettings, setLegalSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
  const [isTabletWide, setIsTabletWide] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 880 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsTabletWide(window.innerWidth >= 880);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      // Graceful fallback
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

  // Rule 11: Only expose pillars with real active data (articles.length > 0)
  const availableDocs = useMemo(
    () => policyDocs.filter(doc => doc.articles.length > 0),
    [policyDocs]
  );

  useEffect(() => {
    if (availableDocs.length > 0 && !availableDocs.some(d => d.key === activeKey)) {
      setActiveKey(availableDocs[0].key);
    }
  }, [availableDocs, activeKey]);

  const selectOptions: TabletSelectOption[] = useMemo(
    () =>
      availableDocs.map((doc, idx) => {
        const DocIcon = doc.icon;
        return {
          value: doc.key,
          label: `${idx + 1}. ${doc.navLabel}`,
          description: doc.category,
          count: doc.articles.length,
          badge: doc.version || 'v2.0',
          icon: <DocIcon size={16} strokeWidth={1.75} />
        };
      }),
    [availableDocs]
  );

  const currentDoc = availableDocs.find(doc => doc.key === activeKey) || policyDocs[0];
  const ActiveIcon = currentDoc.icon;

  const legalEntity = legalSettings.legal_entity_name || 'PT Catavor Media Digital';
  const legalJurisdiction = legalSettings.legal_jurisdiction || 'Hukum Republik Indonesia';
  const legalWarning =
    legalSettings.legal_warning_banner ||
    'Pengelola wajib memastikan keabsahan hukum seluruh item. Dilarang keras memajang satwa dilindungi tanpa izin BKSDA, tanaman langka tanpa karantina, maupun komoditas terlarang. Pelanggaran memicu penonaktifan item (Item Locked) hingga pembekuan katalog.';
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

  const readingPanel = (
    <div
      style={{
        padding: isTabletWide ? '1.5rem 1.75rem' : '1.35rem 1.25rem',
        borderRadius: '1.15rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.35rem',
        minWidth: 0
      }}
    >
      {/* Document Header */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--primary)',
              padding: '0',
              border: 'none'
            }}
          >
            {currentDoc.badge}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} strokeWidth={1.75} />
            Versi: <strong>{currentDoc.version || 'v2.0'}</strong> • Berlaku: <strong>{currentDoc.effectiveDate || '1 Januari 2025'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.7rem',
              backgroundColor: 'var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              flexShrink: 0
            }}
          >
            <ActiveIcon size={20} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.4375rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.28, letterSpacing: '-0.01em' }}>
              {currentDoc.title}
            </h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Kategori Regulasi: <strong>{currentDoc.category}</strong>
            </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div
          style={{
            marginTop: '1rem',
            padding: '0.9rem 1.05rem',
            borderRadius: '0.7rem',
            backgroundColor: 'var(--bg-inset)',
            border: 'none',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            maxWidth: '72ch'
          }}
        >
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
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

        {/* Search Bar for Articles */}
        <div style={{ marginTop: '0.85rem', position: 'relative' }}>
          <Search size={14} strokeWidth={1.75} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Cari pasal dalam ${currentDoc.navLabel}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '0.55rem 4.25rem 0.55rem 2.3rem',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
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
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                minHeight: '44px',
                minWidth: '44px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 700
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Articles List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {filteredArticles.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Tidak ada pasal yang sesuai kata kunci &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredArticles.map((art, aIdx) => (
            <div
              key={aIdx}
              style={{
                padding: '1.25rem 1.35rem',
                borderRadius: '0.85rem',
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    backgroundColor: 'var(--primary-glow)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '0.4rem',
                    // Tinted fill plus a full-strength primary border repeated
                    // 5-8 times down the page read as loud chips. Fill only.
                    border: 'none',
                    letterSpacing: '0.01em'
                  }}
                >
                  {art.number || `Pasal ${aIdx + 1}`}
                </span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {renderPolicyInlineMarkdown((art.heading || '').replace(/^#+\s*/, ''), setPendingExternalUrl)}
                </h3>
              </div>

              {renderPolicyArticleContent(art.content, setPendingExternalUrl)}

              {art.highlights && art.highlights.length > 0 && (
                <div
                  style={{
                    marginTop: '0.15rem',
                    padding: '0.85rem 0.95rem 0.85rem 1rem',
                    borderTopRightRadius: '0.55rem',
                    borderBottomRightRadius: '0.55rem',
                    // Same fill as the article card above it meant the highlight
                    // block had no edge at all. Sit it on --bg-card and mark the
                    // grouping with a left rule instead of another grey box.
                    backgroundColor: 'var(--bg-card)',
                    borderLeft: '3px solid var(--primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  {art.highlights.map((h, hIdx) => (
                    <div key={hIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Check size={13} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} strokeWidth={1.75} />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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

      {/* Footer */}
      <div
        style={{
          marginTop: '0.25rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--primary-glow)',
          border: '1px solid var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <ShieldCheck size={20} strokeWidth={1.75} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
              Dokumen Resmi Kepatuhan Platform Catavor
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Dikelola oleh Divisi Kepatuhan {legalEntity} • Yurisdiksi: {legalJurisdiction} • Kontak: {officialEmail} / +{officialWa}
            </span>
          </div>
        </div>

        {onOpenHelpdesk && (
          <button
            type="button"
            onClick={onOpenHelpdesk}
            style={{
              minHeight: '44px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0 0.25rem'
            }}
          >
            <span>Konsultasi Helpdesk</span>
            <ExternalLink size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '1rem 1.25rem 3rem 1.25rem', maxWidth: '1024px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Tablet Hero Header */}
      <div
        style={{
          padding: '1.35rem 1.5rem',
          borderRadius: '1.15rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px'
                }}
              >
                <ShieldCheck size={13} strokeWidth={1.75} />
                Dokumen Resmi Pengelola Platform
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Building2 size={12} strokeWidth={1.75} />
                {legalEntity}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--bg-inset)', padding: '0.15rem 0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}>
                <Scale size={11} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                Yurisdiksi: {legalJurisdiction}
              </span>
              {isLoading && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>
                  Memuat data...
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Pedoman Legal, Ketentuan &amp; Kepatuhan Platform
            </h1>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Pedoman resmi pengelola Platform Catavor untuk seluruh pengelola profil katalog guna memastikan setiap item yang diunggah mematuhi hukum dan standar komunitas.
            </p>
          </div>

          {onOpenHelpdesk && (
            <button
              type="button"
              onClick={onOpenHelpdesk}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '0.65rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                backgroundColor: 'var(--bg-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              <HelpCircle size={15} strokeWidth={1.75} />
              <span>Bantuan Kepatuhan</span>
            </button>
          )}
        </div>

        {/* Warning Callout */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'var(--warning-glow)',
            border: '1px solid var(--warning-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} strokeWidth={1.75} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '72ch' }}>
            <strong>Peringatan Pengunggahan Item:</strong> {renderPolicyInlineMarkdown(legalWarning, setPendingExternalUrl)}
          </p>
        </div>
      </div>

      {/* Dual-Form-Factor Tablet Adaptation (AGENTS.md Rule 7.A.2 & Rule 11):
          - Tablet Lebar (>= 880px): Master-Detail Split View (Left 30% Pillar Rail, Right 70% Reader)
          - Tablet Mini (< 880px): Native TabletCustomSelect Dropdown (Count > 0, Zero Overflowing Pill Row) */}
      {isTabletWide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(272px, 30%) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div
            style={{
              borderRadius: '1.15rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              position: 'sticky',
              top: '1rem'
            }}
          >
            <div style={{ padding: '0.4rem 0.65rem', borderBottom: '1px solid var(--border-light)', marginBottom: '0.15rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Pilar Kebijakan ({availableDocs.length})
              </span>
            </div>

            {availableDocs.map((doc, idx) => {
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
                    alignItems: 'center',
                    gap: '0.65rem',
                    minHeight: '48px',
                    padding: '0.7rem 0.8rem',
                    borderRadius: '0.7rem',
                    // Selected rail item: soft fill only. A full-strength border
                    // plus the fill plus the filled icon tile was three signals
                    // for one state; the icon tile alone carries it now.
                    border: '1px solid transparent',
                    backgroundColor: isSelected ? 'var(--primary-glow)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '0.55rem',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-inset)',
                      color: isSelected ? 'var(--on-primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <DocIcon size={15} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? 'var(--primary-strong)' : 'var(--text-secondary)',
                        display: 'block',
                        lineHeight: 1.3
                      }}
                    >
                      {idx + 1}. {doc.navLabel}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {doc.articles.length} pasal • {doc.version || 'v2.0'}
                    </span>
                  </div>
                </button>
              );
            })}

            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem 0.75rem',
                borderRadius: '0.6rem',
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <Info size={13} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Berlaku mengikat seluruh profil katalog sejak tanggal efektif.
              </span>
            </div>
          </div>

          {readingPanel}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TabletCustomSelect
            value={activeKey}
            onChange={(val) => {
              setActiveKey(val as PolicyKey);
              setSearchQuery('');
            }}
            options={selectOptions}
            label="Pilih Dokumen Kebijakan Platform"
            icon={<ActiveIcon size={16} strokeWidth={1.75} />}
          />
          {readingPanel}
        </div>
      )}

      <ExternalLinkWarningModal
        url={pendingExternalUrl}
        onClose={() => setPendingExternalUrl(null)}
      />
    </div>
  );
};
export default TabletPoliciesView;
