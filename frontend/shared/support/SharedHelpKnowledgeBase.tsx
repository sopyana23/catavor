import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  ThumbsUp,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  FileText,
  X,
} from 'lucide-react';

export interface HelpArticleItem {
  id: number;
  category: string;
  title: string;
  slug: string;
  content: string;
  helpful_count: number;
  sort_order: number;
}

type HelpFormFactor = 'desktop' | 'tablet' | 'mobile';

let cachedArticles: HelpArticleItem[] | null = null;
let inflightArticlesPromise: Promise<HelpArticleItem[]> | null = null;

export function generateSupportIdempotencyKey(prefix: string = 'sup'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // Fallback below
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function fetchPublishedHelpArticles(): Promise<HelpArticleItem[]> {
  if (cachedArticles) {
    return cachedArticles;
  }
  if (inflightArticlesPromise) {
    return inflightArticlesPromise;
  }
  inflightArticlesPromise = fetch('/api/help/articles')
    .then((res) => res.json())
    .then((json) => {
      if (json && json.success && Array.isArray(json.data)) {
        cachedArticles = json.data;
        return json.data as HelpArticleItem[];
      }
      return [] as HelpArticleItem[];
    })
    .catch(() => [] as HelpArticleItem[])
    .finally(() => {
      inflightArticlesPromise = null;
    });
  return inflightArticlesPromise;
}

const KB_CATEGORY_LABELS: Record<string, string> = {
  all: 'Semua Topik',
  catalog: 'Katalog & Produk',
  catalog_help: 'Katalog & Produk',
  billing: 'Langganan & Tagihan',
  technical: 'Teknis',
  account: 'Akun & Keamanan',
  general: 'Panduan Umum',
};

function getKbCategoryLabel(cat: string): string {
  const key = String(cat || 'general').toLowerCase().trim();
  return KB_CATEGORY_LABELS[key] || cat;
}

interface SharedHelpKnowledgeBaseProps {
  formFactor: HelpFormFactor;
  onOpenCreateTicket?: (prefillSubject?: string) => void;
  compact?: boolean;
}

export const SharedHelpKnowledgeBase: React.FC<SharedHelpKnowledgeBaseProps> = ({
  formFactor,
  onOpenCreateTicket,
  compact = false,
}) => {
  const [articles, setArticles] = useState<HelpArticleItem[]>(cachedArticles || []);
  const [loading, setLoading] = useState<boolean>(!cachedArticles);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticleItem | null>(null);
  const [votedIds, setVotedIds] = useState<Record<number, boolean>>({});
  const [votingId, setVotingId] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetchPublishedHelpArticles().then((list) => {
      if (!active) return;
      setArticles(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const uniq = new Set<string>();
    articles.forEach((a) => {
      if (a.category) uniq.add(a.category);
    });
    return ['all', ...Array.from(uniq)];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (activeCategory !== 'all' && a.category !== activeCategory) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        getKbCategoryLabel(a.category).toLowerCase().includes(q)
      );
    });
  }, [articles, activeCategory, searchQuery]);

  const handleVoteHelpful = async (article: HelpArticleItem) => {
    if (votingId === article.id || votedIds[article.id]) return;
    setVotingId(article.id);
    try {
      const res = await fetch(`/api/help/articles/${article.id}/helpful`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const incremented = !json.already_voted;
        setVotedIds((prev) => ({ ...prev, [article.id]: true }));
        if (incremented) {
          setArticles((prev) => {
            const next = prev.map((item) =>
              item.id === article.id
                ? { ...item, helpful_count: (item.helpful_count || 0) + 1 }
                : item
            );
            cachedArticles = next;
            return next;
          });
          setSelectedArticle((prev) =>
            prev && prev.id === article.id
              ? { ...prev, helpful_count: (prev.helpful_count || 0) + 1 }
              : prev
          );
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setVotingId(null);
    }
  };

  const gridTemplateColumns =
    formFactor === 'desktop'
      ? 'repeat(auto-fill, minmax(240px, 1fr))'
      : formFactor === 'tablet'
        ? 'repeat(auto-fill, minmax(220px, 1fr))'
        : '1fr';

  return (
    <>
      <div
        className="glass-panel"
        style={{
          padding: formFactor === 'mobile' ? '0.95rem 1rem' : '1rem 1.25rem',
          borderRadius: '0.95rem',
          border: '1px solid var(--border-light)',
          background: 'var(--card-bg-gradient)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(14, 165, 233, 0.28)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BookOpen size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: formFactor === 'mobile' ? '0.88rem' : '0.92rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                Panduan Lengkap
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {loading ? 'Memuat artikel...' : `${articles.length} panduan mandiri tersedia sebelum membuat tiket`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            style={{
              minHeight: formFactor === 'desktop' ? '34px' : '44px',
              padding: '0.4rem 0.85rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--border-light)',
              backgroundColor: isExpanded ? 'var(--primary)' : 'var(--bg-deep)',
              color: isExpanded ? '#ffffff' : 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span>{isExpanded ? 'Tutup Panduan' : 'Jelajahi Panduan'}</span>
            <ChevronRight
              size={14}
              style={{
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        </div>

        {/* Always show quick scannable pills when collapsed (compact overview), full grid when expanded */}
        {!isExpanded && articles.length > 0 && !compact && (
          <div
            style={{
              display: 'flex',
              flexWrap: formFactor === 'mobile' ? 'nowrap' : 'wrap',
              overflowX: formFactor === 'mobile' ? 'auto' : 'visible',
              gap: '0.45rem',
              paddingBottom: formFactor === 'mobile' ? '0.2rem' : '0',
            }}
          >
            {articles.slice(0, 4).map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => setSelectedArticle(art)}
                style={{
                  minHeight: formFactor === 'desktop' ? '32px' : '44px',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '0.55rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <FileText size={13} color="var(--primary)" />
                <span>{art.title}</span>
              </button>
            ))}
          </div>
        )}

        {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <input
                  type="text"
                  placeholder="Cari panduan atau topik..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: formFactor === 'desktop' ? '36px' : '44px',
                    paddingLeft: '2.1rem',
                    paddingRight: '0.75rem',
                    borderRadius: '0.55rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.7rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      minHeight: formFactor === 'desktop' ? '32px' : '44px',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      border: `1px solid ${activeCategory === cat ? 'var(--primary)' : 'var(--border-light)'}`,
                      backgroundColor: activeCategory === cat ? 'var(--primary-glow)' : 'var(--bg-deep)',
                      color: activeCategory === cat ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {getKbCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tidak ada artikel panduan yang cocok dengan pencarian Anda.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns, gap: '0.65rem' }}>
                {filtered.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => setSelectedArticle(art)}
                    style={{
                      textAlign: 'left',
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-deep)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      minHeight: formFactor === 'desktop' ? 'auto' : '44px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#0284c7',
                          backgroundColor: 'rgba(2, 132, 199, 0.12)',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        {getKbCategoryLabel(art.category)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <ThumbsUp size={11} /> {art.helpful_count || 0}
                      </span>
                    </div>
                    <strong style={{ fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.35 }}>
                      {art.title}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.73rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {art.content}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Article Reader Overlay */}
      {selectedArticle && (
        <div
          onClick={() => setSelectedArticle(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: formFactor === 'mobile' ? 'flex-end' : 'center',
            justifyContent: formFactor === 'tablet' ? 'flex-end' : 'center',
            padding: formFactor === 'mobile' ? '0' : formFactor === 'tablet' ? '0' : '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              width: formFactor === 'mobile' ? '100%' : formFactor === 'tablet' ? 'min(480px, 92vw)' : 'min(640px, 92vw)',
              height: formFactor === 'tablet' ? '100vh' : 'auto',
              maxHeight: formFactor === 'mobile' ? '85vh' : formFactor === 'tablet' ? '100vh' : '86vh',
              borderRadius:
                formFactor === 'mobile'
                  ? '1.25rem 1.25rem 0 0'
                  : formFactor === 'tablet'
                    ? '1rem 0 0 1rem'
                    : '1rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            }}
          >
            {formFactor === 'mobile' && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.6rem', paddingBottom: '0.2rem', touchAction: 'none' }}>
                <div style={{ width: '38px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--border-light)' }} />
              </div>
            )}

            {/* Header: No X button on mobile per Mobile Modal Standard */}
            <div
              style={{
                padding: '1rem 1.2rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                <BookOpen size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                    {getKbCategoryLabel(selectedArticle.category)}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedArticle.title}
                  </h3>
                </div>
              </div>
              {formFactor !== 'mobile' && (
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  style={{
                    minWidth: '36px',
                    minHeight: '36px',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div
              style={{
                padding: '1.15rem 1.25rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                fontSize: '0.86rem',
                lineHeight: 1.65,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                flex: 1,
              }}
            >
              {selectedArticle.content}
            </div>

            <div
              style={{
                padding: '0.9rem 1.2rem',
                borderTop: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
              }}
            >
              <button
                type="button"
                disabled={votingId === selectedArticle.id || Boolean(votedIds[selectedArticle.id])}
                onClick={() => handleVoteHelpful(selectedArticle)}
                style={{
                  minHeight: '44px',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '0.6rem',
                  border: `1px solid ${votedIds[selectedArticle.id] ? '#10b981' : 'var(--border-light)'}`,
                  backgroundColor: votedIds[selectedArticle.id] ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-card)',
                  color: votedIds[selectedArticle.id] ? '#10b981' : 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: votedIds[selectedArticle.id] ? 'default' : 'pointer',
                }}
              >
                {votedIds[selectedArticle.id] ? <Check size={15} /> : <ThumbsUp size={15} />}
                <span>
                  {votedIds[selectedArticle.id]
                    ? `Terima kasih (${selectedArticle.helpful_count})`
                    : `Membantu (${selectedArticle.helpful_count || 0})`}
                </span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {onOpenCreateTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      const subjectHint = selectedArticle.title;
                      setSelectedArticle(null);
                      onOpenCreateTicket(subjectHint);
                    }}
                    style={{
                      minHeight: '44px',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '0.6rem',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Masih Butuh Bantuan? Buat Tiket
                  </button>
                )}
                {formFactor === 'mobile' && (
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    style={{
                      minHeight: '44px',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '0.6rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface HelpDeflectionSuggestionsProps {
  subject: string;
  formFactor: HelpFormFactor;
}

export const HelpDeflectionSuggestions: React.FC<HelpDeflectionSuggestionsProps> = ({
  subject,
  formFactor,
}) => {
  const [articles, setArticles] = useState<HelpArticleItem[]>(cachedArticles || []);
  const [previewArticle, setPreviewArticle] = useState<HelpArticleItem | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublishedHelpArticles().then((list) => {
      if (active) setArticles(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    const tokens = subject
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3);
    if (tokens.length === 0 || articles.length === 0) return [];
    return articles
      .map((a) => {
        const hay = `${a.title} ${a.content} ${a.category}`.toLowerCase();
        const score = tokens.reduce((acc, tk) => (hay.includes(tk) ? acc + 1 : acc), 0);
        return { article: a, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.article);
  }, [subject, articles]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '0.7rem 0.85rem',
        borderRadius: '0.65rem',
        border: '1px solid rgba(14, 165, 233, 0.28)',
        backgroundColor: 'rgba(14, 165, 233, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', fontWeight: 800, color: '#0284c7' }}>
        <Sparkles size={13} />
        <span>Panduan cepat yang mungkin langsung menjawab kendala Anda:</span>
      </div>

      {previewArticle ? (
        <div
          style={{
            padding: '0.65rem 0.75rem',
            borderRadius: '0.55rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewArticle(null)}
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--primary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              cursor: 'pointer',
              minHeight: formFactor === 'desktop' ? '24px' : '44px',
            }}
          >
            <ChevronLeft size={13} /> Kembali ke saran
          </button>
          <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{previewArticle.title}</strong>
          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {previewArticle.content}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {suggestions.map((art) => (
            <button
              key={art.id}
              type="button"
              onClick={() => setPreviewArticle(art)}
              style={{
                textAlign: 'left',
                minHeight: formFactor === 'desktop' ? '32px' : '44px',
                padding: '0.35rem 0.55rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              <span>{art.title}</span>
              <ChevronRight size={13} color="var(--text-muted)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
