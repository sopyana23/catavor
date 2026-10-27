import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Maximize2,
  Edit3,
  Eye,
  Check,
  Link,
  ExternalLink,
  AlertTriangle,
  X,
  Sparkles,
  MousePointer,
  Globe,
  Copy,
  Type,
  FileText,
  Trash2
} from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';
import { sanitizeUrl, safeOpenUrl, checkUrlSecurity } from '../utils/urlSecurity';
import { ExternalLinkWarningModal, type ExternalLinkWarningModalProps } from './ExternalLinkWarningModal';

export { ExternalLinkWarningModal };
export type { ExternalLinkWarningModalProps };

export interface FormattedTextProps {
  text?: string;
  style?: React.CSSProperties;
  className?: string;
  onNavigate?: (path: string) => void;
  showExternalWarning?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  style,
  className,
  onNavigate,
  showExternalWarning = true
}) => {
  const [externalUrlToPrompt, setExternalUrlToPrompt] = useState<string | null>(null);

  if (!text) return null;

  const normalizedText = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const handleLinkClick = (rawUrl: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const sec = checkUrlSecurity(rawUrl);
    if (!sec.isSafe || sec.sanitizedUrl === '#') return;

    if (sec.isExternal) {
      if (showExternalWarning && sec.requiresWarning) {
        setExternalUrlToPrompt(sec.sanitizedUrl);
      } else {
        const newWin = window.open(sec.sanitizedUrl, '_blank', 'noopener,noreferrer');
        if (newWin) newWin.opener = null;
      }
    } else {
      if (onNavigate) {
        onNavigate(sec.sanitizedUrl);
      } else {
        // Safe internal push / location change
        if (sec.sanitizedUrl.startsWith('/')) {
          window.history.pushState({}, '', sec.sanitizedUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = sec.sanitizedUrl;
        }
      }
    }
  };

  const renderButton = (
    label: string,
    rawUrl: string,
    variant: string = 'primary',
    key: string | number,
    isBlock: boolean = false
  ) => {
    const { isSafe, isExternal } = sanitizeUrl(rawUrl);
    if (!isSafe) return null;

    let bg = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    let textColor = '#ffffff';
    let borderColor = 'transparent';
    let shadow = '0 2px 8px rgba(37, 99, 235, 0.3)';

    if (variant === 'amber' || variant === 'warning') {
      bg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      textColor = '#000000';
      shadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
    } else if (variant === 'emerald' || variant === 'success') {
      bg = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      textColor = '#ffffff';
      shadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
    } else if (variant === 'outline') {
      bg = 'rgba(56, 189, 248, 0.08)';
      textColor = '#38bdf8';
      borderColor = 'rgba(56, 189, 248, 0.4)';
      shadow = 'none';
    } else if (variant === 'danger') {
      bg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      textColor = '#ffffff';
      shadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
    }

    const buttonElement = (
      <button
        key={key}
        type="button"
        onClick={(e) => handleLinkClick(rawUrl, e)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          padding: isBlock ? '0.65rem 1.25rem' : '0.28rem 0.65rem',
          borderRadius: '0.65rem',
          background: bg,
          color: textColor,
          border: `1px solid ${borderColor}`,
          fontSize: isBlock ? '0.82rem' : '0.74rem',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: shadow,
          textDecoration: 'none',
          verticalAlign: 'middle',
          margin: isBlock ? '0.45rem 0' : '0 0.2rem',
          transition: 'transform 0.15s ease, filter 0.15s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      >
        <span>{label}</span>
        {isExternal ? <ExternalLink size={isBlock ? 13 : 11} /> : <MousePointer size={isBlock ? 13 : 11} />}
      </button>
    );

    if (isBlock) {
      return (
        <div key={`blk-${key}`} style={{ display: 'flex', justifyContent: 'flex-start', margin: '0.45rem 0' }}>
          {buttonElement}
        </div>
      );
    }

    return buttonElement;
  };

  const renderInlineMarkdown = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let idx = 0;
    // Regex matches:
    // 1. [button:Label|url|variant] or [cta:Label|url|variant]
    // 2. [Link Text](url)
    // 3. **bold** or __bold__
    // 4. *italic* or _italic_
    // 5. `code`
    const regex = /(\[button:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]|\[cta:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__|_(.*?)_|`([^`]+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }

      // 1. CTA Button Syntax
      if (match[2] !== undefined && match[3] !== undefined) {
        const btnLabel = match[2];
        const btnUrl = match[3];
        const btnVariant = match[4] || 'primary';
        parts.push(renderButton(btnLabel, btnUrl, btnVariant, `btn-${idx++}`, false));
      } else if (match[5] !== undefined && match[6] !== undefined) {
        const btnLabel = match[5];
        const btnUrl = match[6];
        const btnVariant = match[7] || 'primary';
        parts.push(renderButton(btnLabel, btnUrl, btnVariant, `cta-${idx++}`, false));
      }
      // 2. Markdown Link [Text](URL)
      else if (match[8] !== undefined && match[9] !== undefined) {
        const linkText = match[8];
        const rawUrl = match[9];
        const { isSafe, isExternal } = sanitizeUrl(rawUrl);

        if (isSafe) {
          parts.push(
            <a
              key={`lnk-${idx++}`}
              href={rawUrl}
              onClick={(e) => handleLinkClick(rawUrl, e)}
              style={{
                color: '#38bdf8',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.18rem',
                cursor: 'pointer'
              }}
            >
              <span>{linkText}</span>
              {isExternal && <ExternalLink size={11} style={{ flexShrink: 0 }} />}
            </a>
          );
        } else {
          parts.push(<span key={`unsafe-${idx++}`} style={{ color: 'inherit' }}>{linkText}</span>);
        }
      }
      // 3. Bold
      else if (match[10] !== undefined) {
        parts.push(<strong key={`b-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{match[10]}</strong>);
      } else if (match[12] !== undefined) {
        parts.push(<strong key={`b2-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{match[12]}</strong>);
      }
      // 4. Italic
      else if (match[11] !== undefined) {
        parts.push(<em key={`i-${idx++}`}>{match[11]}</em>);
      } else if (match[13] !== undefined) {
        parts.push(<em key={`i2-${idx++}`}>{match[13]}</em>);
      }
      // 5. Code
      else if (match[14] !== undefined) {
        parts.push(
          <code key={`c-${idx++}`} style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.9em', color: 'var(--primary, #38bdf8)' }}>
            {match[14]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  const flushList = (key: number) => {
    if (!currentList) return null;
    const isUl = currentList.type === 'ul';
    const listNode = isUl ? (
      <ul key={`list-${key}`} style={{ paddingLeft: '1.25rem', margin: '0.35rem 0 0.5rem 0', listStyleType: 'disc' }}>
        {currentList.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    ) : (
      <ol key={`list-${key}`} style={{ paddingLeft: '1.25rem', margin: '0.35rem 0 0.5rem 0' }}>
        {currentList.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    currentList = null;
    return listNode;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Check if line is a standalone block CTA button
    const blockButtonMatch = trimmed.match(/^\[(button|cta):([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]$/);
    if (blockButtonMatch) {
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);
      const btnLabel = blockButtonMatch[2];
      const btnUrl = blockButtonMatch[3];
      const btnVariant = blockButtonMatch[4] || 'primary';
      elements.push(renderButton(btnLabel, btnUrl, btnVariant, `blk-btn-${lineIdx}`, true));
      return;
    }

    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[ ] ')) {
      const isChecked = trimmed.includes('[x]') || trimmed.includes('[X]');
      const itemText = trimmed.replace(/^[-*•]?\s*\[[ xX]\]\s+/, '');
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);
      elements.push(
        <div key={`check-${lineIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.18rem 0', paddingLeft: '0.15rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            border: isChecked ? 'none' : '1.5px solid var(--border-hover, #64748b)',
            backgroundColor: isChecked ? 'var(--primary, #38bdf8)' : 'transparent',
            color: '#ffffff',
            fontSize: '9px',
            flexShrink: 0
          }}>
            {isChecked && <Check size={10} strokeWidth={3} />}
          </span>
          <span style={{ fontSize: 'inherit', color: isChecked ? 'var(--text-muted)' : 'inherit', textDecoration: isChecked ? 'line-through' : 'none' }}>
            {renderInlineMarkdown(itemText)}
          </span>
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      if (currentList && currentList.type !== 'ul') {
        const flushed = flushList(lineIdx);
        if (flushed) elements.push(flushed);
      }
      if (!currentList) currentList = { type: 'ul', items: [] };
      currentList.items.push(itemText);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      if (currentList && currentList.type !== 'ol') {
        const flushed = flushList(lineIdx);
        if (flushed) elements.push(flushed);
      }
      if (!currentList) currentList = { type: 'ol', items: [] };
      currentList.items.push(itemText);
    } else {
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);

      if (trimmed === '') {
        elements.push(<div key={`br-${lineIdx}`} style={{ height: '0.4rem' }} />);
      } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        elements.push(<hr key={`hr-${lineIdx}`} style={{ border: 'none', borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', margin: '0.85rem 0' }} />);
      } else if (trimmed.startsWith('> ') || trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        elements.push(
          <blockquote key={`bq-${lineIdx}`} style={{
            margin: '0.5rem 0',
            padding: '0.6rem 0.9rem',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '3px solid var(--primary, #38bdf8)',
            color: 'var(--text-secondary, #94a3b8)',
            fontStyle: 'italic',
            fontSize: '0.88rem'
          }}>
            {renderInlineMarkdown(quoteText)}
          </blockquote>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={`h4-${lineIdx}`} style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0.45rem 0 0.15rem 0', color: 'inherit' }}>
            {renderInlineMarkdown(trimmed.replace('#### ', ''))}
          </h5>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${lineIdx}`} style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0.5rem 0 0.2rem 0', color: 'inherit' }}>
            {renderInlineMarkdown(trimmed.replace('### ', ''))}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${lineIdx}`} style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.6rem 0 0.25rem 0', color: 'inherit' }}>
            {renderInlineMarkdown(trimmed.replace('## ', ''))}
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={`h1-${lineIdx}`} style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.7rem 0 0.3rem 0', color: 'inherit' }}>
            {renderInlineMarkdown(trimmed.replace('# ', ''))}
          </h2>
        );
      } else {
        elements.push(
          <p key={`p-${lineIdx}`} style={{ margin: '0 0 0.35rem 0', lineHeight: 1.6 }}>
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    }
  });

  const finalFlushed = flushList(lines.length);
  if (finalFlushed) elements.push(finalFlushed);

  return (
    <>
      <div className={className} style={{ wordBreak: 'break-word', ...style }}>
        {elements}
      </div>

      {/* External Link Safety Prompt */}
      {externalUrlToPrompt && (
        <ExternalLinkWarningModal
          url={externalUrlToPrompt}
          onClose={() => setExternalUrlToPrompt(null)}
        />
      )}
    </>
  );
};

/**
 * Link Insertion Dialog Modal
 */
export const LinkInsertModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
  onDelete?: () => void;
  initialText?: string;
  initialUrl?: string;
  isEditing?: boolean;
  theme?: any;
  isDark?: boolean;
}> = ({
  isOpen,
  onClose,
  onInsert,
  onDelete,
  initialText = '',
  initialUrl = '',
  isEditing = false,
  theme,
  isDark = true
}) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);

  useModalBackHandler({
    isOpen,
    onClose,
    modalId: 'rich-link-insert-modal'
  });

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setUrl(initialUrl || '');
    }
  }, [isOpen, initialText, initialUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { isSafe, isExternal } = sanitizeUrl(url);

  const handleConfirm = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!text.trim() || !url.trim() || !isSafe) return;
    onInsert(text.trim(), url.trim());
    setText('');
    setUrl('');
    onClose();
  };

  const bgModal = theme?.modalBg || (isDark ? '#0f172a' : '#ffffff');
  const borderCol = theme?.borderStrong || (isDark ? '#334155' : '#cbd5e1');
  const textPrimary = theme?.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = theme?.textSecondary || (isDark ? '#cbd5e1' : '#475569');
  const inputBg = theme?.inputBg || (isDark ? '#1e293b' : '#f8fafc');
  const inputBorder = theme?.inputBorder || (isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1');

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: bgModal,
          borderRadius: '1.25rem',
          border: `1px solid ${borderCol}`,
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 15px 35px rgba(0,0,0,0.15)',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Link size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: textPrimary }}>
              {isEditing ? 'Ubah Tautan (Link)' : 'Sisipkan Tautan (Link)'}
            </h4>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', padding: '0.2rem' }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleConfirm(e);
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              Teks Tautan
            </label>
            <input
              type="text"
              placeholder="Contoh: Baca Panduan Merchant"
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: inputBg,
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              URL Tujuan (Web atau Rute Internal)
            </label>
            <input
              type="text"
              placeholder="https://example.com atau /admin/settings"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: inputBg,
                border: `1px solid ${url ? (isSafe ? (isExternal ? '#3b82f6' : '#10b981') : '#ef4444') : inputBorder}`,
                color: textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {url && (
              <div style={{ fontSize: '0.66rem', marginTop: '0.3rem', fontWeight: 700 }}>
                {!isSafe ? (
                  <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertTriangle size={12} />
                    <span>Protokol tidak aman / dilarang (XSS Protection)</span>
                  </span>
                ) : isExternal ? (
                  <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Globe size={12} />
                    <span>Tautan Eksternal Aman (Akan dibuka di tab baru)</span>
                  </span>
                ) : (
                  <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={12} />
                    <span>Rute Internal Platform (Navigasi cepat)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: isEditing ? 'space-between' : 'flex-end', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Trash2 size={13} />
                <span>Hapus Tautan</span>
              </button>
            ) : null}

            <div style={{ display: 'flex', gap: '0.45rem', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${borderCol}`,
                  color: textSecondary,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!text.trim() || !url.trim() || !isSafe}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: (!text.trim() || !url.trim() || !isSafe) ? 'rgba(56, 189, 248, 0.3)' : '#38bdf8',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: (!text.trim() || !url.trim() || !isSafe) ? 'not-allowed' : 'pointer'
                }}
              >
                {isEditing ? 'Simpan' : 'Sisipkan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * CTA Button Insertion Dialog Modal
 */
export const ButtonInsertModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsert: (label: string, url: string, variant: string) => void;
  onDelete?: () => void;
  initialLabel?: string;
  initialUrl?: string;
  initialVariant?: 'primary' | 'amber' | 'emerald' | 'outline';
  isEditing?: boolean;
  theme?: any;
  isDark?: boolean;
}> = ({
  isOpen,
  onClose,
  onInsert,
  onDelete,
  initialLabel = '',
  initialUrl = '',
  initialVariant = 'primary',
  isEditing = false,
  theme,
  isDark = true
}) => {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState(initialUrl);
  const [variant, setVariant] = useState<'primary' | 'amber' | 'emerald' | 'outline'>(initialVariant);

  useModalBackHandler({
    isOpen,
    onClose,
    modalId: 'rich-button-insert-modal'
  });

  useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel || '');
      setUrl(initialUrl || '');
      setVariant(initialVariant || 'primary');
    }
  }, [isOpen, initialLabel, initialUrl, initialVariant]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { isSafe, isExternal } = sanitizeUrl(url);

  const handleConfirm = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!label.trim() || !url.trim() || !isSafe) return;
    onInsert(label.trim(), url.trim(), variant);
    setLabel('');
    setUrl('');
    onClose();
  };

  const bgModal = theme?.modalBg || (isDark ? '#0f172a' : '#ffffff');
  const borderCol = theme?.borderStrong || (isDark ? '#334155' : '#cbd5e1');
  const textPrimary = theme?.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = theme?.textSecondary || (isDark ? '#cbd5e1' : '#475569');
  const inputBg = theme?.inputBg || (isDark ? '#1e293b' : '#f8fafc');
  const inputBorder = theme?.inputBorder || (isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1');

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: bgModal,
          borderRadius: '1.25rem',
          border: `1px solid ${borderCol}`,
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 15px 35px rgba(0,0,0,0.15)',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <Sparkles size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: textPrimary }}>
              {isEditing ? 'Ubah Tombol Aksi (CTA Button)' : 'Sisipkan Tombol Aksi (CTA Button)'}
            </h4>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: textSecondary, cursor: 'pointer', padding: '0.2rem' }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleConfirm(e);
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              Label Tombol
            </label>
            <input
              type="text"
              placeholder="Contoh: Klaim Promo Sekarang / Buka Pengaturan"
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: inputBg,
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.25rem' }}>
              URL / Rute Aksi
            </label>
            <input
              type="text"
              placeholder="https://example.com atau /admin/promotions"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: inputBg,
                border: `1px solid ${url ? (isSafe ? (isExternal ? '#3b82f6' : '#10b981') : '#ef4444') : inputBorder}`,
                color: textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {url && (
              <div style={{ fontSize: '0.66rem', marginTop: '0.3rem', fontWeight: 700 }}>
                {!isSafe ? (
                  <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertTriangle size={12} />
                    <span>Protokol tidak aman / dilarang (XSS Protection)</span>
                  </span>
                ) : isExternal ? (
                  <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Globe size={12} />
                    <span>Tautan Eksternal Aman (Akan dibuka di tab baru)</span>
                  </span>
                ) : (
                  <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={12} />
                    <span>Rute Internal Platform (Navigasi cepat)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.35rem' }}>
              Gaya Desain Tombol
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
              {[
                { id: 'primary', label: 'Biru Utama (Primary)', color: '#3b82f6' },
                { id: 'amber', label: 'Amber Emas (Warning)', color: '#f59e0b' },
                { id: 'emerald', label: 'Hijau Sukses (Success)', color: '#10b981' },
                { id: 'outline', label: 'Garis Tepi (Outline)', color: '#38bdf8' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setVariant(opt.id as any);
                  }}
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '0.55rem',
                    border: variant === opt.id ? `2px solid ${opt.color}` : `1px solid ${borderCol}`,
                    backgroundColor: variant === opt.id ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
                    color: textPrimary,
                    fontSize: '0.72rem',
                    fontWeight: variant === opt.id ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color }} />
                  <span>{opt.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: isEditing ? 'space-between' : 'flex-end', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Trash2 size={13} />
                <span>Hapus Tombol</span>
              </button>
            ) : null}

            <div style={{ display: 'flex', gap: '0.45rem', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${borderCol}`,
                  color: textSecondary,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!label.trim() || !url.trim() || !isSafe}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '0.65rem',
                  backgroundColor: (!label.trim() || !url.trim() || !isSafe) ? 'rgba(245, 158, 11, 0.3)' : '#f59e0b',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: (!label.trim() || !url.trim() || !isSafe) ? 'not-allowed' : 'pointer'
                }}
              >
                {isEditing ? 'Simpan' : 'Sisipkan Tombol'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const HeadingDropdown: React.FC<{
  onSelect: (level: 1 | 2 | 3) => void;
  btnClassName?: string;
  isZen?: boolean;
  theme?: any;
  isDark?: boolean;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const calculateCoords = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = isZen ? 205 : 190;
    const menuHeight = 150;
    let top = rect.bottom + 5;
    if (top + menuHeight > window.innerHeight - 8 && rect.top > menuHeight + 10) {
      top = Math.max(10, rect.top - menuHeight - 5);
    }
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, rect.right - menuWidth);
    }
    if (left < 10) left = 10;
    return { top, left };
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      setCoords(calculateCoords());
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
        return;
      }
      setCoords(calculateCoords());
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isZen]);

  const handleSelect = (level: 1 | 2 | 3) => {
    onSelect(level);
    setIsOpen(false);
  };

  const bgCard = theme?.modalBg || theme?.surface || (isDark ? '#1e293b' : '#ffffff');
  const borderCol = theme?.borderStrong || theme?.border || (isDark ? '#334155' : '#cbd5e1');
  const textCol = theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a');
  const textMutedCol = theme?.textMuted || (isDark ? '#94a3b8' : '#64748b');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={btnClassName}
        title="Pilih Ukuran Judul (Heading H1, H2, H3)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOpen ? 'rgba(56, 189, 248, 0.15)' : (theme?.surface || (isDark ? 'rgba(255,255,255,0.06)' : '#ffffff')),
          borderColor: isOpen ? '#38bdf8' : (theme?.border || (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
          color: isOpen ? '#38bdf8' : (theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a')),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        <span style={{ fontWeight: 700 }}>Judul</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999999,
            minWidth: isZen ? '205px' : '190px',
            maxWidth: 'calc(100vw - 20px)',
            backgroundColor: bgCard,
            border: `1px solid ${borderCol}`,
            borderRadius: '0.65rem',
            boxShadow: isDark ? '0 14px 35px rgba(0,0,0,0.55)' : '0 10px 25px rgba(0,0,0,0.12)',
            padding: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#38bdf8', width: '20px' }}>H1</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Judul Utama</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>#</code>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8', width: '20px' }}>H2</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Judul Bab</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>##</code>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#38bdf8', width: '20px' }}>H3</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Sub-Judul</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>###</code>
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

export const ListDropdown: React.FC<{
  onSelect: (type: 'bullet' | 'number') => void;
  btnClassName?: string;
  isZen?: boolean;
  theme?: any;
  isDark?: boolean;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const calculateCoords = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = isZen ? 205 : 190;
    const menuHeight = 110;
    let top = rect.bottom + 5;
    if (top + menuHeight > window.innerHeight - 8 && rect.top > menuHeight + 10) {
      top = Math.max(10, rect.top - menuHeight - 5);
    }
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, rect.right - menuWidth);
    }
    if (left < 10) left = 10;
    return { top, left };
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      setCoords(calculateCoords());
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
        return;
      }
      setCoords(calculateCoords());
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isZen]);

  const handleSelect = (type: 'bullet' | 'number') => {
    onSelect(type);
    setIsOpen(false);
  };

  const bgCard = theme?.modalBg || theme?.surface || (isDark ? '#1e293b' : '#ffffff');
  const borderCol = theme?.borderStrong || theme?.border || (isDark ? '#334155' : '#cbd5e1');
  const textCol = theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a');
  const textMutedCol = theme?.textMuted || (isDark ? '#94a3b8' : '#64748b');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={btnClassName}
        title="Pilih Format Daftar (Daftar Poin, Nomor)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOpen ? 'rgba(56, 189, 248, 0.15)' : (theme?.surface || (isDark ? 'rgba(255,255,255,0.06)' : '#ffffff')),
          borderColor: isOpen ? '#38bdf8' : (theme?.border || (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
          color: isOpen ? '#38bdf8' : (theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a')),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        <span style={{ fontWeight: 700 }}>List</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999999,
            minWidth: isZen ? '205px' : '190px',
            maxWidth: 'calc(100vw - 20px)',
            backgroundColor: bgCard,
            border: `1px solid ${borderCol}`,
            borderRadius: '0.65rem',
            boxShadow: isDark ? '0 14px 35px rgba(0,0,0,0.55)' : '0 10px 25px rgba(0,0,0,0.12)',
            padding: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect('bullet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#38bdf8', width: '20px', textAlign: 'center', lineHeight: 1 }}>•</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Daftar Poin</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>-</code>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect('number')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.45rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8', width: '20px', textAlign: 'center' }}>1.</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Daftar Nomor</span>
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>1.</code>
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

/**
 * Helper: Convert Markdown string into WYSIWYG Editable HTML
 */
function markdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const parseInline = (str: string): string => {
    let res = str;
    // CTA Button: [button:Label|url|variant]
    res = res.replace(/\[button:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g, (_, label, url, variant = 'primary') => {
      const v = (variant || 'primary').trim().toLowerCase();
      let bg = '#3b82f6';
      let textCol = '#ffffff';
      if (v === 'amber') { bg = '#f59e0b'; textCol = '#000000'; }
      else if (v === 'emerald') { bg = '#10b981'; textCol = '#ffffff'; }
      else if (v === 'outline') { bg = 'transparent'; textCol = '#38bdf8'; }

      return `<span data-rich-type="button" data-label="${label}" data-url="${url}" data-variant="${v}" contenteditable="false" class="rich-cta-node rich-cta-${v}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;font-size:0.75rem;font-weight:700;margin:0 2px;background-color:${bg};color:${textCol};border:1px solid ${v === 'outline' ? '#38bdf8' : bg};cursor:pointer;user-select:none;">${label}</span>`;
    });

    // Links: [text](url)
    res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      return `<a data-rich-type="link" href="${url}" contenteditable="false" class="rich-link-node" style="color:#38bdf8;text-decoration:underline;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px;">${linkText}</a>`;
    });

    // Bold: **text**
    res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    res = res.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

    return res;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      out.push('<div><br></div>');
      continue;
    }

    if (trimmed.startsWith('# ')) {
      closeLists();
      out.push(`<h1>${parseInline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      closeLists();
      out.push(`<h2>${parseInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      closeLists();
      out.push(`<h3>${parseInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${parseInline(trimmed.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      const content = trimmed.replace(/^\d+\.\s/, '');
      out.push(`<li>${parseInline(content)}</li>`);
    } else {
      closeLists();
      out.push(`<div>${parseInline(rawLine)}</div>`);
    }
  }

  closeLists();
  return out.join('');
}

/**
 * Helper: Convert WYSIWYG Editable HTML DOM back to clean Markdown string
 */
function htmlToMarkdown(rootNode: HTMLElement): string {
  const lines: string[] = [];

  const serializeChild = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check for CTA button node
    if (el.getAttribute('data-rich-type') === 'button') {
      const label = el.getAttribute('data-label') || el.innerText || '';
      const url = el.getAttribute('data-url') || '';
      const variant = el.getAttribute('data-variant') || 'primary';
      return `[button:${label}|${url}|${variant}]`;
    }

    // Check for Link node
    if (el.getAttribute('data-rich-type') === 'link' || tag === 'a') {
      const text = el.innerText || el.textContent || '';
      const href = el.getAttribute('href') || el.getAttribute('data-url') || '';
      return `[${text}](${href})`;
    }

    // Formattings
    if (tag === 'strong' || tag === 'b') {
      return `**${Array.from(el.childNodes).map(serializeChild).join('')}**`;
    }
    if (tag === 'em' || tag === 'i') {
      return `*${Array.from(el.childNodes).map(serializeChild).join('')}*`;
    }
    if (tag === 'br') {
      return '\n';
    }

    // Default: recurse
    return Array.from(el.childNodes).map(serializeChild).join('');
  };

  const processBlock = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || '';
      if (t.trim()) lines.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1') {
      lines.push(`# ${Array.from(el.childNodes).map(serializeChild).join('')}`);
    } else if (tag === 'h2') {
      lines.push(`## ${Array.from(el.childNodes).map(serializeChild).join('')}`);
    } else if (tag === 'h3') {
      lines.push(`### ${Array.from(el.childNodes).map(serializeChild).join('')}`);
    } else if (tag === 'ul') {
      const lis = el.querySelectorAll(':scope > li');
      lis.forEach(li => {
        lines.push(`- ${Array.from(li.childNodes).map(serializeChild).join('')}`);
      });
    } else if (tag === 'ol') {
      const lis = el.querySelectorAll(':scope > li');
      lis.forEach((li, idx) => {
        lines.push(`${idx + 1}. ${Array.from(li.childNodes).map(serializeChild).join('')}`);
      });
    } else if (tag === 'li') {
      lines.push(`- ${Array.from(el.childNodes).map(serializeChild).join('')}`);
    } else if (tag === 'div' || tag === 'p') {
      const text = Array.from(el.childNodes).map(serializeChild).join('');
      lines.push(text);
    } else {
      const text = serializeChild(el);
      if (text) lines.push(text);
    }
  };

  Array.from(rootNode.childNodes).forEach(processBlock);

  // Join lines with single \n
  return lines.join('\n');
}

export interface RichTextareaProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showPreviewTab?: boolean;
  showZenFullscreen?: boolean;
  theme?: any;
  isDark?: boolean;
}

export const RichTextarea: React.FC<RichTextareaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  minHeight,
  required = false,
  className = "form-textarea",
  style,
  showPreviewTab = true,
  showZenFullscreen = true,
  theme,
  isDark = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const visualEditorRef = useRef<HTMLDivElement | null>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fullscreenVisualRef = useRef<HTMLDivElement | null>(null);

  const [editorMode, setEditorMode] = useState<'visual' | 'source'>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Modals state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [modalInitialText, setModalInitialText] = useState('');
  const [modalInitialUrl, setModalInitialUrl] = useState('');
  const [modalInitialVariant, setModalInitialVariant] = useState<'primary' | 'amber' | 'emerald' | 'outline'>('primary');
  const [isLinkEditing, setIsLinkEditing] = useState(false);
  const [isButtonEditing, setIsButtonEditing] = useState(false);
  const [editingLinkNode, setEditingLinkNode] = useState<HTMLElement | null>(null);
  const [editingButtonNode, setEditingButtonNode] = useState<HTMLElement | null>(null);
  const [activeTargetScope, setActiveTargetScope] = useState<'standard' | 'fullscreen'>('standard');
  const [activeTargetRef, setActiveTargetRef] = useState<React.RefObject<HTMLTextAreaElement | null>>(textareaRef);

  const isInternalUpdateRef = useRef(false);

  // Synchronize incoming markdown `value` with the visual contentEditable DOM
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    const htmlContent = markdownToHtml(value || '');
    if (visualEditorRef.current && visualEditorRef.current.innerHTML !== htmlContent) {
      visualEditorRef.current.innerHTML = htmlContent;
    }
    if (fullscreenVisualRef.current && fullscreenVisualRef.current.innerHTML !== htmlContent) {
      fullscreenVisualRef.current.innerHTML = htmlContent;
    }
  }, [value, editorMode]);

  // Lock body scroll when Fullscreen is active
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (editorMode === 'visual') {
          fullscreenVisualRef.current?.focus();
        } else {
          fullscreenTextareaRef.current?.focus();
        }
      }, 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen, editorMode]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isFullscreen]);

  // ContentEditable onInput handler: converts visual HTML back to clean Markdown
  const handleVisualInput = (editorRef: React.RefObject<HTMLDivElement | null>) => {
    if (!editorRef.current) return;
    const md = htmlToMarkdown(editorRef.current);
    isInternalUpdateRef.current = true;
    onChange(md);
  };

  // Intercept clicks on links and CTA buttons inside the visual editor to open edit modal
  const handleEditorClick = (
    e: React.MouseEvent<HTMLDivElement>,
    editorRef: React.RefObject<HTMLDivElement | null>,
    scope: 'standard' | 'fullscreen'
  ) => {
    const target = e.target as HTMLElement;
    const buttonNode = target.closest('[data-rich-type="button"]') as HTMLElement | null;
    const linkNode = target.closest('[data-rich-type="link"]') as HTMLElement | null;

    if (buttonNode) {
      e.preventDefault();
      e.stopPropagation();
      setEditingButtonNode(buttonNode);
      setEditingLinkNode(null);
      setIsButtonEditing(true);
      setModalInitialText(buttonNode.getAttribute('data-label') || buttonNode.innerText || '');
      setModalInitialUrl(buttonNode.getAttribute('data-url') || '');
      setModalInitialVariant((buttonNode.getAttribute('data-variant') as any) || 'primary');
      setActiveTargetScope(scope);
      setShowButtonModal(true);
      return;
    }

    if (linkNode) {
      e.preventDefault();
      e.stopPropagation();
      setEditingLinkNode(linkNode);
      setEditingButtonNode(null);
      setIsLinkEditing(true);
      setModalInitialText(linkNode.innerText || '');
      setModalInitialUrl(linkNode.getAttribute('href') || linkNode.getAttribute('data-url') || '');
      setActiveTargetScope(scope);
      setShowLinkModal(true);
      return;
    }
  };

  const applyFormatToRef = (
    targetRef: React.RefObject<HTMLTextAreaElement | null>,
    prefix: string,
    suffix: string,
    defaultText: string
  ) => {
    const el = targetRef.current;
    const currentVal = value || '';
    if (!el) {
      onChange(currentVal + `${prefix}${defaultText}${suffix}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = currentVal.substring(start, end);
    const textBefore = currentVal.substring(0, start);

    if (prefix === '- ' || prefix === '1. ' || prefix === '- [ ] ') {
      const lastNewlineIdx = textBefore.lastIndexOf('\n');
      const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
      const lineText = currentVal.substring(lineStart, start);

      if (lineText.trim() === '') {
        const newText = currentVal.substring(0, lineStart) + prefix + currentVal.substring(start);
        onChange(newText);
        setTimeout(() => {
          el.focus();
          const newPos = lineStart + prefix.length;
          el.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      } else {
        const insertText = '\n' + prefix;
        const newText = currentVal.substring(0, start) + insertText + currentVal.substring(end);
        onChange(newText);
        setTimeout(() => {
          el.focus();
          const newPos = start + insertText.length;
          el.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }
    }

    const actualPrefix = (start === 0 || textBefore.endsWith('\n')) && prefix.startsWith('\n')
      ? prefix.replace(/^\n+/, '')
      : prefix;

    const replacement = selected ? `${actualPrefix}${selected}${suffix}` : `${actualPrefix}${defaultText}${suffix}`;
    const newValue = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      const newCursor = selected ? start + actualPrefix.length + selected.length + suffix.length : start + actualPrefix.length;
      el.setSelectionRange(newCursor, newCursor + (selected ? 0 : defaultText.length));
    }, 0);
  };

  // Unified Formatters
  const handleFormatBold = (scope: 'standard' | 'fullscreen' = 'standard') => {
    if (editorMode === 'visual') {
      const targetDiv = scope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();
      document.execCommand('bold', false);
      if (targetDiv) handleVisualInput(scope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(targetTextarea, '**', '**', 'teks tebal');
    }
  };

  const handleFormatItalic = (scope: 'standard' | 'fullscreen' = 'standard') => {
    if (editorMode === 'visual') {
      const targetDiv = scope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();
      document.execCommand('italic', false);
      if (targetDiv) handleVisualInput(scope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(targetTextarea, '*', '*', 'teks miring');
    }
  };

  const handleFormatHeading = (level: 1 | 2 | 3, scope: 'standard' | 'fullscreen' = 'standard') => {
    if (editorMode === 'visual') {
      const targetDiv = scope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();
      document.execCommand('formatBlock', false, `h${level}`);
      if (targetDiv) handleVisualInput(scope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      if (level === 1) applyFormatToRef(targetTextarea, '\n# ', '\n', 'Judul Utama H1');
      else if (level === 2) applyFormatToRef(targetTextarea, '\n## ', '\n', 'Judul Bab H2');
      else if (level === 3) applyFormatToRef(targetTextarea, '\n### ', '\n', 'Sub Judul H3');
    }
  };

  const handleFormatList = (type: 'bullet' | 'number', scope: 'standard' | 'fullscreen' = 'standard') => {
    if (editorMode === 'visual') {
      const targetDiv = scope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();
      if (type === 'bullet') {
        document.execCommand('insertUnorderedList', false);
      } else {
        document.execCommand('insertOrderedList', false);
      }
      if (targetDiv) handleVisualInput(scope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      if (type === 'bullet') applyFormatToRef(targetTextarea, '- ', '', 'Poin list');
      else if (type === 'number') applyFormatToRef(targetTextarea, '1. ', '', 'Langkah');
    }
  };

  // Open Link Modal
  const handleOpenLinkModal = (scope: 'standard' | 'fullscreen' = 'standard') => {
    setActiveTargetScope(scope);
    setIsLinkEditing(false);
    setEditingLinkNode(null);

    if (editorMode === 'visual') {
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString() : '';
      setModalInitialText(selectedText);
      setModalInitialUrl('');
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      setActiveTargetRef(targetTextarea);
      const el = targetTextarea.current;
      const selected = el ? el.value.substring(el.selectionStart, el.selectionEnd) : '';
      setModalInitialText(selected);
      setModalInitialUrl('');
    }
    setShowLinkModal(true);
  };

  // Insert or Update Link
  const handleInsertOrUpdateLink = (linkText: string, linkUrl: string) => {
    if (editorMode === 'visual') {
      const targetDiv = activeTargetScope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();

      if (isLinkEditing && editingLinkNode) {
        editingLinkNode.innerText = linkText;
        editingLinkNode.setAttribute('href', linkUrl);
      } else {
        const linkHtml = `<a data-rich-type="link" href="${linkUrl}" contenteditable="false" class="rich-link-node" style="color:#38bdf8;text-decoration:underline;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px;">${linkText}</a>&nbsp;`;
        document.execCommand('insertHTML', false, linkHtml);
      }
      if (targetDiv) handleVisualInput(activeTargetScope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = activeTargetScope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(targetTextarea, '', '', `[${linkText}](${linkUrl})`);
    }

    setEditingLinkNode(null);
    setIsLinkEditing(false);
  };

  const handleDeleteLink = () => {
    if (editingLinkNode) {
      const text = editingLinkNode.innerText || '';
      editingLinkNode.replaceWith(document.createTextNode(text));
      const targetDiv = activeTargetScope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      if (targetDiv) handleVisualInput(activeTargetScope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    }
    setEditingLinkNode(null);
    setIsLinkEditing(false);
  };

  // Open Button Modal
  const handleOpenButtonModal = (scope: 'standard' | 'fullscreen' = 'standard') => {
    setActiveTargetScope(scope);
    setIsButtonEditing(false);
    setEditingButtonNode(null);

    if (editorMode === 'visual') {
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString() : '';
      setModalInitialText(selectedText);
      setModalInitialUrl('');
      setModalInitialVariant('primary');
    } else {
      const targetTextarea = scope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      setActiveTargetRef(targetTextarea);
      const el = targetTextarea.current;
      const selected = el ? el.value.substring(el.selectionStart, el.selectionEnd) : '';
      setModalInitialText(selected);
      setModalInitialUrl('');
      setModalInitialVariant('primary');
    }
    setShowButtonModal(true);
  };

  // Insert or Update Button
  const handleInsertOrUpdateButton = (btnLabel: string, btnUrl: string, btnVariant: string) => {
    const v = (btnVariant || 'primary').trim().toLowerCase();
    let bg = '#3b82f6';
    let textCol = '#ffffff';
    if (v === 'amber') { bg = '#f59e0b'; textCol = '#000000'; }
    else if (v === 'emerald') { bg = '#10b981'; textCol = '#ffffff'; }
    else if (v === 'outline') { bg = 'transparent'; textCol = '#38bdf8'; }

    if (editorMode === 'visual') {
      const targetDiv = activeTargetScope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      targetDiv?.focus();

      if (isButtonEditing && editingButtonNode) {
        editingButtonNode.setAttribute('data-label', btnLabel);
        editingButtonNode.setAttribute('data-url', btnUrl);
        editingButtonNode.setAttribute('data-variant', v);
        editingButtonNode.className = `rich-cta-node rich-cta-${v}`;
        editingButtonNode.innerText = btnLabel;
        editingButtonNode.style.backgroundColor = bg;
        editingButtonNode.style.color = textCol;
        editingButtonNode.style.border = `1px solid ${v === 'outline' ? '#38bdf8' : bg}`;
      } else {
        const btnHtml = `&nbsp;<span data-rich-type="button" data-label="${btnLabel}" data-url="${btnUrl}" data-variant="${v}" contenteditable="false" class="rich-cta-node rich-cta-${v}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;font-size:0.75rem;font-weight:700;margin:0 2px;background-color:${bg};color:${textCol};border:1px solid ${v === 'outline' ? '#38bdf8' : bg};cursor:pointer;user-select:none;">${btnLabel}</span>&nbsp;`;
        document.execCommand('insertHTML', false, btnHtml);
      }
      if (targetDiv) handleVisualInput(activeTargetScope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    } else {
      const targetTextarea = activeTargetScope === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(targetTextarea, '\n', '\n', `[button:${btnLabel}|${btnUrl}|${btnVariant}]`);
    }

    setEditingButtonNode(null);
    setIsButtonEditing(false);
  };

  const handleDeleteButton = () => {
    if (editingButtonNode) {
      editingButtonNode.remove();
      const targetDiv = activeTargetScope === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      if (targetDiv) handleVisualInput(activeTargetScope === 'fullscreen' ? fullscreenVisualRef : visualEditorRef);
    }
    setEditingButtonNode(null);
    setIsButtonEditing(false);
  };

  const handleKeyDownSmartList = (
    targetRef: React.RefObject<HTMLTextAreaElement | null>,
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter') {
      const el = targetRef.current;
      if (!el) return;

      const currentVal = value || '';
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const textBefore = currentVal.substring(0, start);
      const textAfter = currentVal.substring(end);

      const lastNewlineIdx = textBefore.lastIndexOf('\n');
      const currentLine = textBefore.substring(lastNewlineIdx + 1);

      const checklistMatch = currentLine.match(/^([-*•]?\s*\[[ xX]?\]\s+)(.*)$/);
      const bulletMatch = !checklistMatch ? currentLine.match(/^([-*•]\s+)(.*)$/) : null;
      const numberMatch = currentLine.match(/^(\d+)(\.\s+)(.*)$/);

      if (checklistMatch) {
        e.preventDefault();
        const content = checklistMatch[2];
        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextChecklist = '\n- [ ] ';
          const newText = textBefore + nextChecklist + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextChecklist.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        const content = bulletMatch[2];

        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextBullet = '\n' + prefix;
          const newText = textBefore + nextBullet + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextBullet.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else if (numberMatch) {
        e.preventDefault();
        const num = parseInt(numberMatch[1], 10);
        const dotSpace = numberMatch[2];
        const content = numberMatch[3];

        if (content.trim() === '') {
          const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
          const newText = currentVal.substring(0, lineStart) + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          const nextPrefix = `\n${num + 1}${dotSpace}`;
          const newText = textBefore + nextPrefix + textAfter;
          onChange(newText);
          setTimeout(() => {
            el.focus();
            const newPos = start + nextPrefix.length;
            el.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
    }
  };

  const wordCount = (value || '').trim() ? (value || '').trim().split(/\s+/).length : 0;
  const charCount = (value || '').length;

  const bgSurface = theme?.surface || (isDark ? '#111827' : '#ffffff');
  const borderDefault = theme?.border || (isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0');
  const textPrimary = theme?.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = theme?.textSecondary || (isDark ? '#cbd5e1' : '#475569');
  const textMuted = theme?.textMuted || (isDark ? '#94a3b8' : '#64748b');
  const inputBg = theme?.inputBg || (isDark ? '#1e293b' : '#ffffff');
  const inputBorder = theme?.inputBorder || (isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1');
  const btnBg = theme?.surface || (isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff');
  const btnBorder = theme?.border || (isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', ...style }}>
      <style>{`
        .rich-wysiwyg-editor {
          outline: none;
          white-space: pre-wrap;
          word-break: break-word;
          min-height: 110px;
        }
        .rich-wysiwyg-editor:empty:before {
          content: attr(data-placeholder);
          color: #64748b;
          pointer-events: none;
          display: block;
        }
        .rich-wysiwyg-editor h1 {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0.5rem 0 0.25rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor h2 {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0.45rem 0 0.2rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor h3 {
          font-size: 0.98rem;
          font-weight: 800;
          margin: 0.4rem 0 0.15rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor ul {
          list-style-type: disc;
          margin: 0.35rem 0 0.35rem 1.4rem;
          padding: 0;
        }
        .rich-wysiwyg-editor ol {
          list-style-type: decimal;
          margin: 0.35rem 0 0.35rem 1.4rem;
          padding: 0;
        }
        .rich-wysiwyg-editor li {
          margin-bottom: 0.2rem;
        }
        .rich-cta-node {
          transition: transform 0.1s ease, filter 0.1s ease;
        }
        .rich-cta-node:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .rich-link-node:hover {
          opacity: 0.85;
        }
      `}</style>

      {label && (
        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, marginBottom: '0.1rem' }}>
          {label}
        </label>
      )}
      
      {/* Inline Formatting Helper Toolbar: Single Row Bar */}
      <div className="rich-toolbar-wrapper" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.35rem 0.5rem',
        backgroundColor: bgSurface,
        border: `1px solid ${borderDefault}`,
        borderBottom: 'none',
        borderTopLeftRadius: '0.75rem',
        borderTopRightRadius: '0.75rem',
        gap: '0.3rem',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Bold Button */}
        <button
          type="button"
          className="rich-btn-format"
          title="Teks Tebal (Bold)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFormatBold('standard');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.35rem',
            backgroundColor: btnBg,
            border: `1px solid ${btnBorder}`,
            color: textPrimary,
            fontSize: '0.78rem',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <strong>B</strong>
        </button>

        {/* Italic Button */}
        <button
          type="button"
          className="rich-btn-format"
          title="Teks Miring (Italic)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFormatItalic('standard');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.35rem',
            backgroundColor: btnBg,
            border: `1px solid ${btnBorder}`,
            color: textPrimary,
            fontSize: '0.78rem',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <em>I</em>
        </button>

        {/* Heading Dropdown */}
        <HeadingDropdown
          onSelect={(level) => handleFormatHeading(level, 'standard')}
          btnClassName="rich-btn-format"
          theme={theme}
          isDark={isDark}
        />

        {/* List Dropdown */}
        <ListDropdown
          onSelect={(type) => handleFormatList(type, 'standard')}
          btnClassName="rich-btn-format"
          theme={theme}
          isDark={isDark}
        />

        {/* Hyperlink Button */}
        <button
          type="button"
          className="rich-btn-format"
          title="Sisipkan Tautan (Link)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenLinkModal('standard');
          }}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.35rem',
            backgroundColor: btnBg,
            border: `1px solid ${btnBorder}`,
            color: isDark ? '#38bdf8' : '#0284c7',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0
          }}
        >
          <Link size={12} />
          <span style={{ fontWeight: 700 }}>Link</span>
        </button>

        {/* CTA Button Inserter */}
        <button
          type="button"
          className="rich-btn-format"
          title="Sisipkan Tombol Aksi (CTA Button)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenButtonModal('standard');
          }}
          style={{
            padding: '0.25rem 0.55rem',
            borderRadius: '0.35rem',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0
          }}
        >
          <Sparkles size={12} />
          <span style={{ fontWeight: 800 }}>Tombol</span>
        </button>

        {/* Visual / Markdown Toggle */}
        <button
          type="button"
          className="rich-btn-mode-toggle"
          title={editorMode === 'visual' ? 'Beralih ke Teks Mentah (Markdown)' : 'Beralih ke Tampilan Visual (WYSIWYG)'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setEditorMode(prev => prev === 'visual' ? 'source' : 'visual');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.55rem',
            borderRadius: '0.35rem',
            backgroundColor: editorMode === 'visual' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${editorMode === 'visual' ? 'rgba(56, 189, 248, 0.3)' : btnBorder}`,
            color: editorMode === 'visual' ? 'var(--primary, #38bdf8)' : textSecondary,
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 'auto'
          }}
        >
          {editorMode === 'visual' ? <Type size={12} /> : <FileText size={12} />}
          <span>{editorMode === 'visual' ? 'Visual' : 'Markdown'}</span>
        </button>

        {/* Fullscreen Button */}
        {showZenFullscreen && (
          <button
            type="button"
            className="rich-btn-fullscreen"
            title="Buka Layar Penuh (Fullscreen Zen Mode)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFullscreen(true);
              setMobileTab('editor');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.55rem',
              borderRadius: '0.35rem',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)'}`,
              color: isDark ? '#38bdf8' : '#0284c7',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Maximize2 size={12} />
            <span style={{ whiteSpace: 'nowrap' }}>Zen</span>
          </button>
        )}
      </div>

      {/* Editor Canvas: Visual ContentEditable or Raw Textarea */}
      {editorMode === 'visual' ? (
        <div
          ref={visualEditorRef}
          contentEditable
          data-placeholder={placeholder || 'Tulis deskripsi atau konten lengkap di sini...'}
          className="rich-wysiwyg-editor"
          onInput={() => handleVisualInput(visualEditorRef)}
          onClick={(e) => handleEditorClick(e, visualEditorRef, 'standard')}
          style={{
            width: '100%',
            minHeight: minHeight || '110px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.75rem',
            borderBottomRightRadius: '0.75rem',
            backgroundColor: inputBg,
            border: `1px solid ${inputBorder}`,
            color: textPrimary,
            fontSize: '0.82rem',
            lineHeight: 1.5,
            padding: '0.65rem 0.75rem',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          rows={rows}
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => handleKeyDownSmartList(textareaRef, e)}
          required={required}
          style={{
            width: '100%',
            minHeight: minHeight || '110px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.75rem',
            borderBottomRightRadius: '0.75rem',
            backgroundColor: inputBg,
            borderColor: inputBorder,
            color: textPrimary,
            fontSize: '0.82rem',
            lineHeight: 1.5,
            padding: '0.65rem 0.75rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            outline: 'none'
          }}
        />
      )}

      {/* Helper Footer under standard editor */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.2rem 0.35rem 0 0.35rem',
        fontSize: '0.68rem',
        color: textMuted,
        gap: '0.5rem'
      }}>
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0
        }}>
          {editorMode === 'visual'
            ? 'Live WYSIWYG: Teks langsung diformat secara visual'
            : 'Mode Markdown: Format mentah **tebal**, *miring*, [link], [button]'}
        </span>
        <span style={{
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontWeight: 600
        }}>
          {wordCount} kata • {charCount} kar
        </span>
      </div>

      {/* ========================================================================= */}
      {/* ZEN FULLSCREEN OVERLAY MODAL (Rendered in Portal)                         */}
      {/* ========================================================================= */}
      {isFullscreen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: theme?.modalOverlay || 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            maxWidth: '100vw',
            maxHeight: '100vh',
            backgroundColor: theme?.modalBg || (isDark ? '#0b0f19' : '#ffffff'),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Zen Header: Clean Single Row Bar (Icon + Title, Edit/Preview Tabs) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.8rem 1.15rem',
              backgroundColor: theme?.surface || (isDark ? '#111827' : '#ffffff'),
              borderBottom: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
              gap: '0.75rem',
              flexWrap: 'nowrap',
              flexShrink: 0
            }}>
              {/* Left: Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '0.7rem',
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  flexShrink: 0
                }}>
                  <Edit3 size={16} />
                </div>
                <span style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  color: textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {label || 'Detail Artikel (Zen Mode)'}
                </span>
              </div>

              {/* Right: Segmented Edit/Preview Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                borderRadius: '0.65rem',
                padding: '0.2rem',
                border: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileTab('editor');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: mobileTab === 'editor' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                    color: mobileTab === 'editor' ? '#ffffff' : textSecondary,
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: mobileTab === 'editor' ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Edit3 size={13} color={mobileTab === 'editor' ? '#ffffff' : textSecondary} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileTab('preview');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: mobileTab === 'preview' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                    color: mobileTab === 'preview' ? '#ffffff' : textSecondary,
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: mobileTab === 'preview' ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Eye size={13} color={mobileTab === 'preview' ? '#ffffff' : textSecondary} />
                  <span>Pratinjau</span>
                </button>
              </div>
            </div>

            {/* Zen Editor Toolbar (Only in Editor Tab) */}
            {mobileTab === 'editor' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 1.1rem',
                backgroundColor: theme?.cardAlt || (isDark ? '#090d16' : '#f8fafc'),
                borderBottom: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                overflowX: 'auto',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  title="Teks Tebal"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFormatBold('fullscreen');
                  }}
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor: btnBg,
                    border: `1px solid ${btnBorder}`,
                    color: textPrimary,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  title="Teks Miring"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFormatItalic('fullscreen');
                  }}
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor: btnBg,
                    border: `1px solid ${btnBorder}`,
                    color: textPrimary,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <em>I</em>
                </button>
                <HeadingDropdown
                  onSelect={(level) => handleFormatHeading(level, 'fullscreen')}
                  isZen
                  theme={theme}
                  isDark={isDark}
                />
                <ListDropdown
                  onSelect={(type) => handleFormatList(type, 'fullscreen')}
                  isZen
                  theme={theme}
                  isDark={isDark}
                />

                {/* Hyperlink Button */}
                <button
                  type="button"
                  title="Sisipkan Tautan (Link)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenLinkModal('fullscreen');
                  }}
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor: btnBg,
                    border: `1px solid ${btnBorder}`,
                    color: isDark ? '#38bdf8' : '#0284c7',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Link size={12} />
                  <span style={{ fontWeight: 700 }}>Link</span>
                </button>

                {/* CTA Button Inserter */}
                <button
                  type="button"
                  title="Sisipkan Tombol Aksi (CTA Button)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenButtonModal('fullscreen');
                  }}
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Sparkles size={12} />
                  <span style={{ fontWeight: 800 }}>Tombol</span>
                </button>

                {/* Mode toggle */}
                <button
                  type="button"
                  title={editorMode === 'visual' ? 'Beralih ke Teks Mentah (Markdown)' : 'Beralih ke Tampilan Visual (WYSIWYG)'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditorMode(prev => prev === 'visual' ? 'source' : 'visual');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    backgroundColor: editorMode === 'visual' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${editorMode === 'visual' ? 'rgba(56, 189, 248, 0.3)' : btnBorder}`,
                    color: editorMode === 'visual' ? 'var(--primary, #38bdf8)' : textSecondary,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                >
                  {editorMode === 'visual' ? <Type size={12} /> : <FileText size={12} />}
                  <span>{editorMode === 'visual' ? 'Visual' : 'Markdown'}</span>
                </button>
              </div>
            )}

            {/* Fullscreen Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.1rem', overflowY: 'auto', backgroundColor: inputBg }}>
              {mobileTab === 'editor' ? (
                editorMode === 'visual' ? (
                  <div
                    ref={fullscreenVisualRef}
                    contentEditable
                    data-placeholder={placeholder || 'Tulis rincian pengumuman lengkap di sini...'}
                    className="rich-wysiwyg-editor"
                    onInput={() => handleVisualInput(fullscreenVisualRef)}
                    onClick={(e) => handleEditorClick(e, fullscreenVisualRef, 'fullscreen')}
                    style={{
                      width: '100%',
                      height: '100%',
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: textPrimary,
                      fontSize: '0.94rem',
                      lineHeight: 1.7,
                      fontFamily: 'inherit',
                      padding: 0
                    }}
                  />
                ) : (
                  <textarea
                    ref={fullscreenTextareaRef}
                    placeholder={placeholder || 'Tulis rincian pengumuman lengkap di sini...'}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => handleKeyDownSmartList(fullscreenTextareaRef, e)}
                    style={{
                      width: '100%',
                      height: '100%',
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: textPrimary,
                      fontSize: '0.94rem',
                      lineHeight: 1.7,
                      resize: 'none',
                      fontFamily: 'inherit',
                      padding: 0
                    }}
                  />
                )
              ) : (
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '0.9rem',
                  backgroundColor: theme?.surface || (isDark ? '#111827' : '#ffffff'),
                  border: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                  color: textPrimary,
                  fontSize: '0.92rem',
                  lineHeight: 1.7
                }}>
                  {value ? (
                    <FormattedText text={value} />
                  ) : (
                    <div style={{ color: textMuted, fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                      Belum ada teks yang ditulis untuk dipratinjau.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Zen Footer: Word Accumulation Badges & Primary Selesai Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.8rem 1.15rem',
              backgroundColor: theme?.surface || (isDark ? '#111827' : '#ffffff'),
              borderTop: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
              gap: '0.85rem',
              flexShrink: 0
            }}>
              {/* Left: Word and Character Counts */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: textMuted
              }}>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '0.45rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  border: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                  color: textSecondary,
                  fontWeight: 700
                }}>
                  {wordCount} kata
                </span>
                <span>•</span>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '0.45rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  border: `1px solid ${theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                  color: textSecondary,
                  fontWeight: 700
                }}>
                  {charCount} karakter
                </span>
              </div>

              {/* Right: Selesai Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFullscreen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '0.65rem',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <Check size={15} strokeWidth={2.5} color="#ffffff" />
                <span>Selesai</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Link Insertion Modal */}
      <LinkInsertModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setEditingLinkNode(null);
          setIsLinkEditing(false);
        }}
        onInsert={handleInsertOrUpdateLink}
        onDelete={handleDeleteLink}
        initialText={modalInitialText}
        initialUrl={modalInitialUrl}
        isEditing={isLinkEditing}
        theme={theme}
        isDark={isDark}
      />

      {/* CTA Button Insertion Modal */}
      <ButtonInsertModal
        isOpen={showButtonModal}
        onClose={() => {
          setShowButtonModal(false);
          setEditingButtonNode(null);
          setIsButtonEditing(false);
        }}
        onInsert={handleInsertOrUpdateButton}
        onDelete={handleDeleteButton}
        initialLabel={modalInitialText}
        initialUrl={modalInitialUrl}
        initialVariant={modalInitialVariant}
        isEditing={isButtonEditing}
        theme={theme}
        isDark={isDark}
      />
    </div>
  );
};
