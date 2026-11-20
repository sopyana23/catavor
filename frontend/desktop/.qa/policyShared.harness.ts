// Standalone harness: parser extracted verbatim from policyShared.tsx
export interface PolicyArticle {
  number: string;
  heading: string;
  content: string;
  highlights?: string[];
}

// Audit finding A2: `policies.sections` is frequently NULL in the DB, which used to
// make admin edits to `content` (markdown) invisible on the public page. This parser
// turns the admin-authored markdown into structured articles so the published content
// is what actually renders. Pure string work only — renderers still sanitize links
// via checkUrlSecurity (SEC-FE-01), no HTML is produced here.
const POLICY_MD_HEADING_PATTERNS: RegExp[] = [
  /^#{2,4}\s+(.+)$/,
  /^\*\*(.+?)\*\*:?\s*$/,
  /^__(.+?)__:?\s*$/
];

const POLICY_MD_NUMBER_RE = /^(?:pasal|bab|bagian|artikel)\s+([0-9]+[a-z]?|[ivxlcdm]+)\b[\s.:-]*(.*)$/i;
// Admin editors commonly write "### 1. Judul" / "### 2) Judul" without the word "Pasal".
const POLICY_MD_LEADING_NUM_RE = /^([0-9]+[a-z]?|[ivxlcdm]+)[.)\]:-]\s*(.+)$/i;

export function parsePolicyMarkdownToArticles(markdown?: string | null): PolicyArticle[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const articles: PolicyArticle[] = [];
  let current: PolicyArticle | null = null;
  let pendingParagraph: string[] = [];
  let pendingHighlights: string[] = [];

  const flushPending = () => {
    if (!current) {
      pendingParagraph = [];
      pendingHighlights = [];
      return;
    }
    const body = pendingParagraph.join('\n').trim();
    if (body) current.content = current.content ? `${current.content}\n\n${body}` : body;
    if (pendingHighlights.length > 0) {
      current.highlights = [...(current.highlights || []), ...pendingHighlights];
    }
    pendingParagraph = [];
    pendingHighlights = [];
  };

  const openArticle = (rawHeading: string) => {
    flushPending();
    let heading = rawHeading
      .replace(/^#{2,4}\s+/, '')
      .replace(/^\*\*(.+?)\*\*:?$/, '$1')
      .replace(/^__(.+?)__:?$/, '$1')
      .replace(/\*\*|__/g, '')
      .trim();
    if (!heading) return;

    let number = '';
    const numMatch = heading.match(POLICY_MD_NUMBER_RE);
    if (numMatch) {
      const label = numMatch[1].toLowerCase();
      const rest = (numMatch[2] || '').trim();
      number = /^[ivxlcdm]+$/.test(label) && !/^[0-9]/.test(label)
        ? `Pasal ${label.toUpperCase()}`
        : `Pasal ${label}`;
      heading = rest || heading;
    } else {
      const leadMatch = heading.match(POLICY_MD_LEADING_NUM_RE);
      if (leadMatch) {
        const label = leadMatch[1].toLowerCase();
        const rest = (leadMatch[2] || '').trim();
        if (rest) {
          number = /^[ivxlcdm]+$/.test(label) && !/^[0-9]/.test(label)
            ? `Pasal ${label.toUpperCase()}`
            : `Pasal ${label}`;
          heading = rest;
        }
      }
    }
    if (!heading) return;
    current = { number, heading, content: '', highlights: [] };
    articles.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPending();
      continue;
    }

    // Horizontal rules / separators never start an article.
    if (/^[-*_]{3,}$/.test(line)) {
      flushPending();
      continue;
    }

    // Document title (#) is already rendered from the API `title` field — ignore it
    // so the page does not show a duplicated heading.
    if (/^#\s+/.test(line)) continue;

    const isHeading = POLICY_MD_HEADING_PATTERNS.some((re) => re.test(line));
    if (isHeading) {
      openArticle(line);
      continue;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      if (!item) continue;
      if (current) pendingHighlights.push(item);
      else pendingParagraph.push(item);
      continue;
    }

    pendingParagraph.push(line.startsWith('>') ? line.replace(/^>+\s*/, '') : line);
  }

  flushPending();

  const cleaned = articles.filter((a) => a.heading.trim().length > 0);
  if (cleaned.length === 0) return [];
  return cleaned.map((a) => ({
    ...a,
    content: a.content.trim(),
    highlights: (a.highlights || []).filter((h) => h.trim().length > 0)
  }));
}

