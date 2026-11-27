import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Check,
  ExternalLink,
  Building2,
  Search,
  X
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
import { MobileCustomSelect, type MobileSelectOption } from './MobileCustomSelect';
import { ExternalLinkWarningModal } from './ExternalLinkWarningModal';

export type { PolicyKey, PolicyArticle, PolicyDoc, DraftPolicyOverride };

export interface MobilePoliciesViewProps {
  onOpenHelpdesk?: () => void;
  initialKey?: PolicyKey;
  /** Accepted for call-site compatibility; the back affordance lives in the
      portal mobile header (App.tsx, `.btn-back-circle`) so this view no longer
      renders its own duplicate. */
  onBack?: () => void;
  draftOverride?: DraftPolicyOverride | null;
}

export const MobilePoliciesView: React.FC<MobilePoliciesViewProps> = ({
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
  const [isCompactMobile, setIsCompactMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 380 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsCompactMobile(window.innerWidth < 380);
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

  // Rule 11: Only expose options with count > 0
  const availableDocs = useMemo(
    () => policyDocs.filter(doc => doc.articles.length > 0),
    [policyDocs]
  );

  useEffect(() => {
    if (availableDocs.length > 0 && !availableDocs.some(d => d.key === activeKey)) {
      setActiveKey(availableDocs[0].key);
    }
  }, [availableDocs, activeKey]);

  const selectOptions: MobileSelectOption[] = useMemo(
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

  const cardHorizontalPad = isCompactMobile ? '0.75rem' : '1rem';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Mobile Executive Card */}
      <div
        className="glass-panel"
        style={{
          padding: `0.95rem ${cardHorizontalPad}`,
          borderRadius: '0.9rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        {/* No back button here on purpose: App.tsx already renders the portal
            header for policy tabs (`.btn-back-circle` + page title). Having both
            produced two identical "Kembali" controls 45px apart — measured by
            tools/qa_policy_dupes.cjs. The header one wins because it sits with
            the page title. */}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.66rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--primary)',
              backgroundColor: 'var(--primary-glow)',
              border: '1px solid var(--primary)',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px'
            }}
          >
            <ShieldCheck size={12} strokeWidth={1.75} />
            Dokumen Resmi Platform
          </span>

          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Building2 size={11} strokeWidth={1.75} />
            {legalEntity}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.66rem',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: 'var(--bg-inset)',
              padding: '0.15rem 0.5rem',
              borderRadius: '0.35rem',
              border: '1px solid var(--border-light)'
            }}
          >
            <Scale size={11} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
            Yurisdiksi: {legalJurisdiction}
          </span>

          {isLoading && (
            <span style={{ fontSize: '0.68rem', color: 'var(--primary)' }}>
              Memuat data...
            </span>
          )}
        </div>

        <div>
          <h1 style={{ margin: 0, fontSize: isCompactMobile ? '1.05rem' : '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            Pedoman Legal, Ketentuan &amp; Kepatuhan
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Standar kepatuhan resmi untuk seluruh pengelola katalog guna memastikan item yang diunggah mematuhi {legalJurisdiction} dan pedoman komunitas.
          </p>
        </div>

        {/* Warning Callout */}
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--warning-glow)',
            border: '1px solid var(--warning-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem'
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} strokeWidth={1.75} />
          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong>Peringatan Pengunggahan:</strong> {renderPolicyInlineMarkdown(legalWarning, setPendingExternalUrl)}
          </p>
        </div>

        {/* Search Bar for Articles */}
        <div style={{ position: 'relative', marginTop: '0.15rem' }}>
          <Search size={15} strokeWidth={1.75} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={`Cari pasal / klausul di ${currentDoc.navLabel}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '0.55rem 2.75rem 0.55rem 2.2rem',
              borderRadius: '0.55rem',
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus kata kunci pencarian"
              style={{
                position: 'absolute',
                right: '0.15rem',
                top: '50%',
                transform: 'translateY(-50%)',
                minWidth: '44px',
                minHeight: '44px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {onOpenHelpdesk && (
          <button
            type="button"
            onClick={onOpenHelpdesk}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.6rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              minHeight: '44px',
              width: '100%'
            }}
          >
            <HelpCircle size={15} strokeWidth={1.75} />
            <span>Konsultasi via Bantuan</span>
          </button>
        )}
      </div>

      {/* Mobile Native Option Picker Bottom Sheet (AGENTS.md Rule 7.A.3 & Rule 11: Replaces 6-Pill Horizontal Overflow Row) */}
      <MobileCustomSelect
        value={activeKey}
        onChange={(val) => {
          setActiveKey(val as PolicyKey);
          setSearchQuery('');
        }}
        options={selectOptions}
        title="Pilih Pilar Kebijakan Platform"
        subtitle="Seluruh dokumen berlaku mengikat sejak tanggal efektif"
        icon={<ActiveIcon size={20} strokeWidth={1.9} />}
      />

      {/* Document Content Card */}
      <div
        className="glass-panel"
        style={{
          padding: `1.1rem ${cardHorizontalPad}`,
          borderRadius: '0.9rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem'
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-glow)',
                padding: '0.18rem 0.5rem',
                borderRadius: '0.35rem',
                border: '1px solid var(--primary)'
              }}
            >
              {currentDoc.badge}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Versi: <strong>{currentDoc.version || 'v2.0'}</strong> • Berlaku: <strong>{currentDoc.effectiveDate || '1 Januari 2025'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.55rem',
                backgroundColor: 'var(--primary-glow)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0
              }}
            >
              <ActiveIcon size={18} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: isCompactMobile ? '0.98rem' : '1.05rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {currentDoc.title}
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'block' }}>
                Klasifikasi: {currentDoc.category}
              </span>
            </div>
          </div>

          <p style={{ margin: '0.65rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
            &ldquo;{renderPolicyInlineMarkdown(
              (currentDoc.summary || '')
                .replace(/^>+\s*/gm, '')
                .replace(/^\*\*Ringkasan Eksekutif:\*\*\s*/i, '')
                .replace(/^[ \t]*---+[ \t]*$/gm, '')
                .replace(/^[ \t]*--+[ \t]*$/gm, ''),
              setPendingExternalUrl
            )}&rdquo;
          </p>
        </div>

        {/* Search match stats */}
        {searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.65rem', borderRadius: '0.45rem', backgroundColor: 'var(--bg-inset)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>Menemukan <strong>{filteredArticles.length}</strong> pasal cocok</span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ minHeight: '44px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: '0 0.35rem' }}
            >
              Reset Pencarian
            </button>
          </div>
        )}

        {/* Articles List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {filteredArticles.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Tidak ada pasal yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredArticles.map((art, aIdx) => (
              <div
                key={aIdx}
                style={{
                  padding: isCompactMobile ? '0.85rem' : '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--bg-inset)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: 'var(--primary-strong)',
                      backgroundColor: 'var(--primary-glow)',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.3rem'
                    }}
                  >
                    {art.number || `Pasal ${aIdx + 1}`}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {renderPolicyInlineMarkdown((art.heading || '').replace(/^#+\s*/, ''), setPendingExternalUrl)}
                  </h3>
                </div>

                {renderPolicyArticleContent(art.content, setPendingExternalUrl)}

                {art.highlights && art.highlights.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.15rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-inset)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}
                  >
                    {art.highlights.map((h, hIdx) => (
                      <div key={hIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                        <Check size={13} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} strokeWidth={1.75} />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
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

        {/* Footer Seal */}
        <div
          style={{
            marginTop: '0.25rem',
            padding: '0.85rem',
            borderRadius: '0.65rem',
            backgroundColor: 'var(--primary-glow)',
            border: '1px solid var(--primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} strokeWidth={1.75} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                Diterbitkan secara sah oleh Divisi Hukum &amp; Kepatuhan {legalEntity}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Yurisdiksi: {legalJurisdiction} • Kontak: {officialEmail} / +{officialWa}
              </span>
            </div>
          </div>

          {onOpenHelpdesk && (
            <button
              type="button"
              onClick={onOpenHelpdesk}
              style={{
                minHeight: '44px',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0',
                alignSelf: 'flex-start'
              }}
            >
              <span>Tanya via Bantuan</span>
              <ExternalLink size={12} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <ExternalLinkWarningModal
        url={pendingExternalUrl}
        onClose={() => setPendingExternalUrl(null)}
      />
    </div>
  );
};
export default MobilePoliciesView;
