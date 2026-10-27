import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Trash2,
  Type,
  FileText
} from 'lucide-react';
import { sanitizeUrl, safeOpenUrl, checkUrlSecurity } from '../utils/urlSecurity';
import { ExternalLinkWarningModal, type ExternalLinkWarningModalProps } from './ExternalLinkWarningModal';
import { useModalBackHandler } from '../utils/navigation';

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
              {isEditing ? 'Edit Tautan (Link)' : 'Sisipkan Tautan (Link)'}
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
              <div style={{ fontSize: '0.66rem', marginTop: '0.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {!isSafe ? (
                  <>
                    <AlertTriangle size={12} color="#ef4444" />
                    <span style={{ color: '#ef4444' }}>Protokol tidak aman / dilarang (XSS Protection)</span>
                  </>
                ) : isExternal ? (
                  <>
                    <Globe size={12} color="#3b82f6" />
                    <span style={{ color: '#3b82f6' }}>Tautan Eksternal Aman (Akan dibuka di tab baru)</span>
                  </>
                ) : (
                  <>
                    <Check size={12} color="#10b981" />
                    <span style={{ color: '#10b981' }}>Rute Internal Platform (Navigasi cepat)</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem', marginTop: '0.5rem' }}>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  color: '#ef4444',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginRight: 'auto'
                }}
              >
                <Trash2 size={13} />
                <span>Hapus Tautan</span>
              </button>
            )}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
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
              {isEditing && <Check size={13} />}
              <span>{isEditing ? 'Simpan' : 'Sisipkan'}</span>
            </button>
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
              {isEditing ? 'Edit Tombol Aksi (CTA)' : 'Sisipkan Tombol Aksi (CTA Button)'}
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
                border: `1px solid ${url ? (isSafe ? '#3b82f6' : '#ef4444') : inputBorder}`,
                color: textPrimary,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem', marginTop: '0.5rem' }}>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  color: '#ef4444',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginRight: 'auto'
                }}
              >
                <Trash2 size={13} />
                <span>Hapus Tombol</span>
              </button>
            )}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
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
              {isEditing && <Check size={13} />}
              <span>{isEditing ? 'Simpan' : 'Sisipkan Tombol'}</span>
            </button>
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
  activeHeading?: 1 | 2 | 3 | null;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = true, activeHeading = null }) => {
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

  const isHighlighted = isOpen || Boolean(activeHeading);
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
          backgroundColor: isHighlighted ? (isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') : (theme?.surface || (isDark ? 'rgba(255,255,255,0.06)' : '#ffffff')),
          borderColor: isHighlighted ? (isDark ? '#38bdf8' : '#0284c7') : (theme?.border || (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
          color: isHighlighted ? (isDark ? '#38bdf8' : '#0284c7') : (theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a')),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          fontWeight: isHighlighted ? 800 : 700,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: isHighlighted ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontWeight: 700 }}>{activeHeading ? `Judul (H${activeHeading})` : 'Judul'}</span>
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
              backgroundColor: activeHeading === 1 ? (isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: activeHeading === 1 ? (isDark ? '#38bdf8' : '#0284c7') : textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (activeHeading !== 1) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { if (activeHeading !== 1) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#38bdf8', width: '20px' }}>H1</span>
              <span style={{ fontSize: '0.82rem', fontWeight: activeHeading === 1 ? 800 : 700 }}>Judul Utama</span>
              {activeHeading === 1 && <Check size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 'auto' }} />}
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>#</code>
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
              backgroundColor: activeHeading === 2 ? (isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: activeHeading === 2 ? (isDark ? '#38bdf8' : '#0284c7') : textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (activeHeading !== 2) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { if (activeHeading !== 2) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8', width: '20px' }}>H2</span>
              <span style={{ fontSize: '0.82rem', fontWeight: activeHeading === 2 ? 800 : 600 }}>Judul Bab</span>
              {activeHeading === 2 && <Check size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 'auto' }} />}
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>##</code>
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
              backgroundColor: activeHeading === 3 ? (isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: activeHeading === 3 ? (isDark ? '#38bdf8' : '#0284c7') : textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (activeHeading !== 3) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { if (activeHeading !== 3) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#38bdf8', width: '20px' }}>H3</span>
              <span style={{ fontSize: '0.82rem', fontWeight: activeHeading === 3 ? 800 : 500 }}>Sub-Judul</span>
              {activeHeading === 3 && <Check size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 'auto' }} />}
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>###</code>
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
  activeList?: 'bullet' | 'number' | null;
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = true, activeList = null }) => {
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

  const isHighlighted = isOpen || Boolean(activeList);
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
          backgroundColor: isHighlighted ? (isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') : (theme?.surface || (isDark ? 'rgba(255,255,255,0.06)' : '#ffffff')),
          borderColor: isHighlighted ? (isDark ? '#38bdf8' : '#0284c7') : (theme?.border || (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
          color: isHighlighted ? (isDark ? '#38bdf8' : '#0284c7') : (theme?.textPrimary || (isDark ? '#ffffff' : '#0f172a')),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          fontWeight: isHighlighted ? 800 : 700,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: isHighlighted ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontWeight: 700 }}>{activeList === 'bullet' ? 'List (Poin)' : activeList === 'number' ? 'List (Nomor)' : 'List'}</span>
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
              backgroundColor: activeList === 'bullet' ? (isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: activeList === 'bullet' ? (isDark ? '#38bdf8' : '#0284c7') : textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (activeList !== 'bullet') e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { if (activeList !== 'bullet') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#38bdf8', width: '20px', textAlign: 'center', lineHeight: 1 }}>•</span>
              <span style={{ fontSize: '0.82rem', fontWeight: activeList === 'bullet' ? 800 : 600 }}>Daftar Poin</span>
              {activeList === 'bullet' && <Check size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 'auto' }} />}
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>-</code>
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
              backgroundColor: activeList === 'number' ? (isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: activeList === 'number' ? (isDark ? '#38bdf8' : '#0284c7') : textCol,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (activeList !== 'number') e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { if (activeList !== 'number') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8', width: '20px', textAlign: 'center' }}>1.</span>
              <span style={{ fontSize: '0.82rem', fontWeight: activeList === 'number' ? 800 : 600 }}>Daftar Nomor</span>
              {activeList === 'number' && <Check size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 'auto' }} />}
            </div>
            <code style={{ fontSize: '0.72rem', color: textMutedCol, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>1.</code>
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

/**
 * HTML entities escaping
 */
export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts inline markdown tokens to HTML elements for visual editor
 */
export function inlineMarkdownToHtml(str: string): string {
  if (!str) return '';
  let res = escapeHtml(str);

  // 1. CTA Button Syntax: [button:Label|url|variant] or [cta:Label|url|variant]
  res = res.replace(/\[(button|cta):([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g, (_, _t, label, url, variant) => {
    const v = variant ? variant.trim() : 'primary';
    const cleanLabel = (label || '').trim();
    const cleanUrl = (url || '').trim();
    return `<span data-rich-type="button" data-label="${cleanLabel}" data-url="${cleanUrl}" data-variant="${v}" contenteditable="false" class="rich-visual-badge rich-btn-${v}"><span>${cleanLabel}</span></span>`;
  });

  // 2. Markdown Link: [text](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
    const cleanText = (linkText || '').trim();
    const cleanUrl = (url || '').trim();
    return `<a data-rich-type="link" data-url="${cleanUrl}" href="${cleanUrl}" class="rich-visual-link">${cleanText}</a>`;
  });

  // 3. Bold: **text**
  res = res.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

  // 4. Italic: *text*
  res = res.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');

  // 5. Inline Code: `text`
  res = res.replace(/`([^`]+?)`/g, '<code style="background-color: rgba(56, 189, 248, 0.12); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; color: var(--primary, #38bdf8);">$1</code>');

  return res;
}

/**
 * Converts a Markdown string into HTML for the contentEditable visual WYSIWYG canvas
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '<p><br></p>';
  const normalized = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const htmlParts: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check headings
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    // Check list items
    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (ulMatch) {
      if (inList !== 'ul') {
        if (inList) htmlParts.push(`</${inList}>`);
        htmlParts.push('<ul>');
        inList = 'ul';
      }
      htmlParts.push(`<li>${inlineMarkdownToHtml(ulMatch[1])}</li>`);
      continue;
    } else if (olMatch) {
      if (inList !== 'ol') {
        if (inList) htmlParts.push(`</${inList}>`);
        htmlParts.push('<ol>');
        inList = 'ol';
      }
      htmlParts.push(`<li>${inlineMarkdownToHtml(olMatch[2])}</li>`);
      continue;
    } else {
      if (inList) {
        htmlParts.push(`</${inList}>`);
        inList = null;
      }
    }

    if (h1Match) {
      htmlParts.push(`<h1>${inlineMarkdownToHtml(h1Match[1])}</h1>`);
    } else if (h2Match) {
      htmlParts.push(`<h2>${inlineMarkdownToHtml(h2Match[1])}</h2>`);
    } else if (h3Match) {
      htmlParts.push(`<h3>${inlineMarkdownToHtml(h3Match[1])}</h3>`);
    } else if (trimmed === '') {
      htmlParts.push('<p><br></p>');
    } else {
      htmlParts.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
    }
  }

  if (inList) {
    htmlParts.push(`</${inList}>`);
  }

  return htmlParts.join('');
}

/**
 * Serializes the contentEditable DOM back to clean Markdown
 */
export function htmlToMarkdown(rootNode: Node): string {
  function serializeInline(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as HTMLElement;
    const richType = el.getAttribute('data-rich-type');

    if (richType === 'button') {
      const label = el.getAttribute('data-label') || el.innerText || '';
      const url = el.getAttribute('data-url') || '';
      const variant = el.getAttribute('data-variant') || 'primary';
      return `[button:${label.trim()}|${url.trim()}|${variant}]`;
    }

    if (richType === 'link' || el.tagName === 'A') {
      const text = el.innerText || el.textContent || '';
      const url = el.getAttribute('data-url') || el.getAttribute('href') || '';
      return `[${text.trim()}](${url.trim()})`;
    }

    const tag = el.tagName.toLowerCase();
    if (tag === 'strong' || tag === 'b') {
      const inner = Array.from(el.childNodes).map(serializeInline).join('');
      return inner.trim() ? `**${inner}**` : '';
    }
    if (tag === 'em' || tag === 'i') {
      const inner = Array.from(el.childNodes).map(serializeInline).join('');
      return inner.trim() ? `*${inner}*` : '';
    }
    if (tag === 'code') {
      const inner = Array.from(el.childNodes).map(serializeInline).join('');
      return inner ? `\`${inner}\`` : '';
    }
    if (tag === 'br') {
      return '\n';
    }

    return Array.from(el.childNodes).map(serializeInline).join('');
  }

  function serializeBlock(node: Node): string[] {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      return text ? [text] : [];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (el.getAttribute('data-rich-type') === 'button') {
      const label = el.getAttribute('data-label') || el.innerText || '';
      const url = el.getAttribute('data-url') || '';
      const variant = el.getAttribute('data-variant') || 'primary';
      return [`[button:${label.trim()}|${url.trim()}|${variant}]`];
    }

    if (tag === 'h1') {
      return [`# ${serializeInline(el).trim()}`];
    }
    if (tag === 'h2') {
      return [`## ${serializeInline(el).trim()}`];
    }
    if (tag === 'h3') {
      return [`### ${serializeInline(el).trim()}`];
    }
    if (tag === 'ul') {
      const items: string[] = [];
      Array.from(el.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          items.push(`- ${serializeInline(child).trim()}`);
        }
      });
      return items;
    }
    if (tag === 'ol') {
      const items: string[] = [];
      let count = 1;
      Array.from(el.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          items.push(`${count++}. ${serializeInline(child).trim()}`);
        }
      });
      return items;
    }
    if (tag === 'p' || tag === 'div') {
      if (!el.textContent?.trim() && el.querySelector('br')) {
        return [''];
      }
      const hasBlockChild = Array.from(el.children).some(c =>
        ['h1', 'h2', 'h3', 'ul', 'ol', 'p', 'div'].includes(c.tagName.toLowerCase())
      );
      if (hasBlockChild) {
        const blocks: string[] = [];
        Array.from(el.childNodes).forEach(child => {
          blocks.push(...serializeBlock(child));
        });
        return blocks;
      }
      return [serializeInline(el)];
    }

    return [serializeInline(el)];
  }

  const blocks: string[] = [];
  Array.from(rootNode.childNodes).forEach(child => {
    blocks.push(...serializeBlock(child));
  });

  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  isDark
}) => {
  const [editorMode, setEditorMode] = useState<'visual' | 'source'>('visual');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const visualEditorRef = useRef<HTMLDivElement | null>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fullscreenVisualRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Dynamic Theme Auto-Detection (from localStorage / DOM when not explicitly provided)
  const [detectedIsDark, setDetectedIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const adminMode = localStorage.getItem('catavor_admin_theme_mode');
      if (adminMode) return adminMode === 'dark';
      const storeTheme = localStorage.getItem('catavor_theme');
      if (storeTheme) return storeTheme !== 'light';
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined') {
        const adminMode = localStorage.getItem('catavor_admin_theme_mode');
        if (adminMode) {
          setDetectedIsDark(adminMode === 'dark');
        } else {
          const storeTheme = localStorage.getItem('catavor_theme');
          if (storeTheme) {
            setDetectedIsDark(storeTheme !== 'light');
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const activeIsDark = isDark !== undefined ? isDark : detectedIsDark;

  // Screen Width Tracking for Responsive Form-Factor Adaptation
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 768);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = isMobileScreen;

  // Robust Theme Tokens with Strict Light / Dark Fallback
  const effectiveTheme = useMemo(() => {
    const fallbackModalBg = activeIsDark ? '#0f172a' : '#ffffff';
    const fallbackSurface = activeIsDark ? '#111827' : '#ffffff';
    const fallbackCardAlt = activeIsDark ? '#0b1120' : '#f8fafc';
    const fallbackInputBg = activeIsDark ? '#0b1120' : '#ffffff';
    const fallbackOverlay = activeIsDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)';

    return {
      surface: theme?.surface || fallbackSurface,
      card: theme?.card || (activeIsDark ? '#1e293b' : '#ffffff'),
      cardAlt: theme?.cardAlt || fallbackCardAlt,
      cardHover: theme?.cardHover || (activeIsDark ? '#273549' : '#f8fafc'),
      border: theme?.border || (activeIsDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
      borderStrong: theme?.borderStrong || (activeIsDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1'),
      textPrimary: theme?.textPrimary || (activeIsDark ? '#f8fafc' : '#0f172a'),
      textSecondary: theme?.textSecondary || (activeIsDark ? '#cbd5e1' : '#475569'),
      textMuted: theme?.textMuted || (activeIsDark ? '#94a3b8' : '#64748b'),
      inputBg: theme?.inputBg || fallbackInputBg,
      inputBorder: theme?.inputBorder || (activeIsDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1'),
      modalBg: theme?.modalBg || fallbackModalBg,
      modalOverlay: theme?.modalOverlay || fallbackOverlay,
      editorBg: activeIsDark ? '#0b1120' : '#ffffff',
      shadow: theme?.shadow || (activeIsDark ? '0 8px 25px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.06)'),
      cardShadow: theme?.cardShadow || (activeIsDark ? '0 4px 15px rgba(0, 0, 0, 0.2)' : '0 2px 10px rgba(0, 0, 0, 0.04)'),
      chipActiveBg: theme?.chipActiveBg || (activeIsDark ? '#38bdf8' : '#0284c7'),
      chipActiveText: theme?.chipActiveText || (activeIsDark ? '#000000' : '#ffffff'),
      chipInactiveBg: theme?.chipInactiveBg || (activeIsDark ? '#1e293b' : '#f1f5f9'),
      chipInactiveText: theme?.chipInactiveText || (activeIsDark ? '#94a3b8' : '#64748b')
    };
  }, [theme, activeIsDark]);

  // Helper to place cursor at the end of content
  const moveCursorToEnd = (element: HTMLElement | HTMLTextAreaElement) => {
    try {
      if (element instanceof HTMLTextAreaElement) {
        element.focus();
        const len = element.value.length;
        element.setSelectionRange(len, len);
      } else {
        element.focus();
        if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false); // collapse to end
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    } catch {
      element.focus();
    }
  };

  // Modals & Selection Tracking
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [modalInitialText, setModalInitialText] = useState('');
  const [modalInitialUrl, setModalInitialUrl] = useState('');
  const [modalInitialVariant, setModalInitialVariant] = useState<'primary' | 'amber' | 'emerald' | 'outline'>('primary');
  const [isLinkEditing, setIsLinkEditing] = useState(false);
  const [isButtonEditing, setIsButtonEditing] = useState(false);
  const [editingLinkNode, setEditingLinkNode] = useState<HTMLAnchorElement | null>(null);
  const [editingButtonNode, setEditingButtonNode] = useState<HTMLElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const savedTextareaRangeRef = useRef<{ start: number; end: number } | null>(null);
  const activeEditorRef = useRef<'standard' | 'fullscreen'>('standard');
  const isInternalUpdateRef = useRef(false);

  // Active Formatting State (for visual selected indicators in toolbar)
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean;
    italic: boolean;
    heading: 1 | 2 | 3 | null;
    list: 'bullet' | 'number' | null;
    link: boolean;
    button: boolean;
  }>({
    bold: false,
    italic: false,
    heading: null,
    list: null,
    link: false,
    button: false
  });

  // Synchronize incoming markdown value into the visual editor canvas (protecting active focus)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (visualEditorRef.current && document.activeElement !== visualEditorRef.current) {
      const currentMd = htmlToMarkdown(visualEditorRef.current);
      if (currentMd !== (value || '').trim()) {
        visualEditorRef.current.innerHTML = markdownToHtml(value || '');
      }
    }
    if (fullscreenVisualRef.current && document.activeElement !== fullscreenVisualRef.current) {
      const currentMd = htmlToMarkdown(fullscreenVisualRef.current);
      if (currentMd !== (value || '').trim()) {
        fullscreenVisualRef.current.innerHTML = markdownToHtml(value || '');
      }
    }
  }, [value, editorMode]);

  // Initial populate visual editor
  useEffect(() => {
    if (visualEditorRef.current && !visualEditorRef.current.innerHTML) {
      visualEditorRef.current.innerHTML = markdownToHtml(value || '');
    }
  }, []);

  // Real-time active format detector and selection recorder
  const updateActiveFormats = useCallback(() => {
    if (editorMode === 'visual') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const targetDiv = activeEditorRef.current === 'fullscreen'
        ? fullscreenVisualRef.current
        : visualEditorRef.current;

      if (!targetDiv) return;

      const anchor = sel.anchorNode;
      if (!anchor || !targetDiv.contains(anchor)) return;

      const range = sel.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();

      let hasCommandState = false;
      let isBold = false;
      let isItalic = false;
      let isBullet = false;
      let isNum = false;
      try {
        isBold = document.queryCommandState('bold');
        isItalic = document.queryCommandState('italic');
        isBullet = document.queryCommandState('insertUnorderedList');
        isNum = document.queryCommandState('insertOrderedList');
        hasCommandState = true;
      } catch {
        hasCommandState = false;
      }

      let headingLevel: 1 | 2 | 3 | null = null;
      let listType: 'bullet' | 'number' | null = isBullet ? 'bullet' : isNum ? 'number' : null;
      let isLink = false;
      let isBtn = false;

      let cur: Node | null = anchor;
      while (cur && cur !== targetDiv) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
          const el = cur as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'h1') headingLevel = 1;
          else if (tag === 'h2') headingLevel = 2;
          else if (tag === 'h3') headingLevel = 3;
          else if (tag === 'ul') listType = 'bullet';
          else if (tag === 'ol') listType = 'number';
          else if (el.getAttribute('data-rich-type') === 'link' || tag === 'a') isLink = true;
          else if (el.getAttribute('data-rich-type') === 'button') isBtn = true;
          else if (!hasCommandState) {
            if (tag === 'strong' || tag === 'b') isBold = true;
            else if (tag === 'em' || tag === 'i') isItalic = true;
          }
        }
        cur = cur.parentNode;
      }

      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        heading: headingLevel,
        list: listType,
        link: isLink,
        button: isBtn
      });
    } else {
      const ref = activeEditorRef.current === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      const el = ref.current;
      if (!el) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      savedTextareaRangeRef.current = { start, end };

      const txt = value || '';
      const textBefore = txt.substring(0, start);
      const textAfter = txt.substring(end);
      const lastNewline = textBefore.lastIndexOf('\n');
      const nextNewline = textAfter.indexOf('\n');
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const lineEnd = nextNewline === -1 ? txt.length : end + nextNewline;
      const currentLine = txt.substring(lineStart, lineEnd);

      let heading: 1 | 2 | 3 | null = null;
      if (/^#\s+/.test(currentLine)) heading = 1;
      else if (/^##\s+/.test(currentLine)) heading = 2;
      else if (/^###\s+/.test(currentLine)) heading = 3;

      let list: 'bullet' | 'number' | null = null;
      if (/^[-*•]\s+/.test(currentLine)) list = 'bullet';
      else if (/^\d+\.\s+/.test(currentLine)) list = 'number';

      const lineBeforeCursor = txt.substring(lineStart, start);
      const boldCount = (lineBeforeCursor.match(/\*\*/g) || []).length;
      const isBold = boldCount % 2 === 1;

      const lineBeforeNoBold = lineBeforeCursor.replace(/\*\*/g, '');
      const italicCount = (lineBeforeNoBold.match(/\*/g) || []).length;
      const isItalic = italicCount % 2 === 1;

      const isLink = /\[[^\]]*$/.test(lineBeforeCursor) || /\([^)]*$/.test(lineBeforeCursor);
      const isBtn = /\[button:[^\]]*$/.test(lineBeforeCursor);

      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        heading,
        list,
        link: isLink,
        button: isBtn
      });
    }
  }, [editorMode, value]);

  useEffect(() => {
    const handleDocSelectionChange = () => {
      updateActiveFormats();
    };
    document.addEventListener('selectionchange', handleDocSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleDocSelectionChange);
    };
  }, [updateActiveFormats]);

  // Lock body scroll when Fullscreen is active & autofocus cursor to end
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        if (editorMode === 'visual') {
          if (fullscreenVisualRef.current) {
            fullscreenVisualRef.current.innerHTML = markdownToHtml(value || '');
            moveCursorToEnd(fullscreenVisualRef.current);
          }
        } else {
          if (fullscreenTextareaRef.current) {
            moveCursorToEnd(fullscreenTextareaRef.current);
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
      if (visualEditorRef.current) {
        visualEditorRef.current.innerHTML = markdownToHtml(value || '');
      }
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

  // Handle hardware / browser back to close Zen Fullscreen editor
  useModalBackHandler({
    isOpen: isFullscreen,
    onClose: () => setIsFullscreen(false),
    modalId: isMobile ? 'rich-textarea-portal-mobile' : 'rich-textarea-portal-desktop'
  });

  const handleVisualInput = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    if (!targetRef.current) return;
    isInternalUpdateRef.current = true;
    const newMd = htmlToMarkdown(targetRef.current);
    onChange(newMd);
    updateActiveFormats();
  };

  const handleEditorClick = (
    e: React.MouseEvent<HTMLDivElement>,
    _targetRef: React.RefObject<HTMLDivElement | null>,
    editorType: 'standard' | 'fullscreen'
  ) => {
    const target = e.target as HTMLElement;
    activeEditorRef.current = editorType;

    // 1. Clicked on an atomic CTA button badge
    const btnNode = target.closest('[data-rich-type="button"]') as HTMLElement | null;
    if (btnNode) {
      e.preventDefault();
      e.stopPropagation();
      setEditingButtonNode(btnNode);
      setModalInitialText(btnNode.getAttribute('data-label') || btnNode.innerText || '');
      setModalInitialUrl(btnNode.getAttribute('data-url') || '');
      setModalInitialVariant((btnNode.getAttribute('data-variant') as any) || 'primary');
      setIsButtonEditing(true);
      setShowButtonModal(true);
      return;
    }

    // 2. Clicked on an atomic link
    const linkNode = target.closest('[data-rich-type="link"]') as HTMLAnchorElement | null;
    if (linkNode) {
      e.preventDefault();
      e.stopPropagation();
      setEditingLinkNode(linkNode);
      setModalInitialText(linkNode.innerText || linkNode.textContent || '');
      setModalInitialUrl(linkNode.getAttribute('data-url') || linkNode.getAttribute('href') || '');
      setIsLinkEditing(true);
      setShowLinkModal(true);
      return;
    }

    updateActiveFormats();
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

    // Use savedTextareaRangeRef if valid, fallback to selectionStart, fallback to end of text
    let start = typeof savedTextareaRangeRef.current?.start === 'number'
      ? savedTextareaRangeRef.current.start
      : el.selectionStart;
    let end = typeof savedTextareaRangeRef.current?.end === 'number'
      ? savedTextareaRangeRef.current.end
      : el.selectionEnd;

    // Boundary check
    if (start < 0 || start > currentVal.length) start = currentVal.length;
    if (end < start || end > currentVal.length) end = start;

    const selected = currentVal.substring(start, end);

    if (prefix === '- ' || prefix === '1. ') {
      const textBefore = currentVal.substring(0, start);
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
          savedTextareaRangeRef.current = { start: newPos, end: newPos };
          updateActiveFormats();
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
          savedTextareaRangeRef.current = { start: newPos, end: newPos };
          updateActiveFormats();
        }, 0);
        return;
      }
    }

    let actualPrefix = prefix;
    if (prefix.startsWith('\n')) {
      const textBefore = currentVal.substring(0, start);
      if (start === 0 || textBefore.endsWith('\n')) {
        actualPrefix = prefix.substring(1);
      }
    }

    const replacement = selected ? `${actualPrefix}${selected}${suffix}` : `${actualPrefix}${defaultText}${suffix}`;
    const newValue = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      const newCursor = selected ? start + actualPrefix.length + selected.length + suffix.length : start + actualPrefix.length;
      el.setSelectionRange(newCursor, newCursor + (selected ? 0 : defaultText.length));
      savedTextareaRangeRef.current = { start: newCursor, end: newCursor + (selected ? 0 : defaultText.length) };
      updateActiveFormats();
    }, 0);
  };

  const handleFormatBold = (editorType: 'standard' | 'fullscreen') => {
    if (editorMode === 'visual') {
      const ref = editorType === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
      }
      ref.current?.focus();
      document.execCommand('bold', false);
      updateActiveFormats();
      handleVisualInput(ref);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '**', '**', 'teks tebal');
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatItalic = (editorType: 'standard' | 'fullscreen') => {
    if (editorMode === 'visual') {
      const ref = editorType === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
      }
      ref.current?.focus();
      document.execCommand('italic', false);
      updateActiveFormats();
      handleVisualInput(ref);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '*', '*', 'teks miring');
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatHeading = (level: 1 | 2 | 3, editorType: 'standard' | 'fullscreen') => {
    if (editorMode === 'visual') {
      const ref = editorType === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      ref.current?.focus();
      document.execCommand('formatBlock', false, `<h${level}>`);
      handleVisualInput(ref);
      setTimeout(() => updateActiveFormats(), 10);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      const prefix = level === 1 ? '\n# ' : level === 2 ? '\n## ' : '\n### ';
      applyFormatToRef(ref, prefix, '\n', `Judul H${level}`);
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatList = (type: 'bullet' | 'number', editorType: 'standard' | 'fullscreen') => {
    if (editorMode === 'visual') {
      const ref = editorType === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      ref.current?.focus();
      if (type === 'bullet') {
        document.execCommand('insertUnorderedList', false);
      } else {
        document.execCommand('insertOrderedList', false);
      }
      handleVisualInput(ref);
      setTimeout(() => updateActiveFormats(), 10);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      const prefix = type === 'bullet' ? '- ' : '1. ';
      applyFormatToRef(ref, prefix, '', type === 'bullet' ? 'Poin list' : 'Langkah');
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleOpenLinkModal = (editorType: 'standard' | 'fullscreen') => {
    activeEditorRef.current = editorType;
    if (editorMode === 'visual') {
      const targetDiv = editorType === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      const sel = window.getSelection();
      let txt = '';
      if (sel && sel.rangeCount > 0 && targetDiv) {
        const range = sel.getRangeAt(0);
        if (targetDiv.contains(range.commonAncestorContainer) || targetDiv.contains(range.startContainer)) {
          savedRangeRef.current = range.cloneRange();
          txt = range.toString().trim();
        }
      }
      setModalInitialText(txt);
      setModalInitialUrl('');
      setIsLinkEditing(false);
      setEditingLinkNode(null);
      setShowLinkModal(true);
    } else {
      const el = (editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef).current;
      let txt = '';
      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        savedTextareaRangeRef.current = { start, end };
        txt = el.value.substring(start, end).trim();
      }
      setModalInitialText(txt);
      setModalInitialUrl('');
      setIsLinkEditing(false);
      setEditingLinkNode(null);
      setShowLinkModal(true);
    }
  };

  const handleOpenButtonModal = (editorType: 'standard' | 'fullscreen') => {
    activeEditorRef.current = editorType;
    if (editorMode === 'visual') {
      const targetDiv = editorType === 'fullscreen' ? fullscreenVisualRef.current : visualEditorRef.current;
      const sel = window.getSelection();
      let txt = '';
      if (sel && sel.rangeCount > 0 && targetDiv) {
        const range = sel.getRangeAt(0);
        if (targetDiv.contains(range.commonAncestorContainer) || targetDiv.contains(range.startContainer)) {
          savedRangeRef.current = range.cloneRange();
          txt = range.toString().trim();
        }
      }
      setModalInitialText(txt);
      setModalInitialUrl('');
      setModalInitialVariant('primary');
      setIsButtonEditing(false);
      setEditingButtonNode(null);
      setShowButtonModal(true);
    } else {
      const el = (editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef).current;
      let txt = '';
      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        savedTextareaRangeRef.current = { start, end };
        txt = el.value.substring(start, end).trim();
      }
      setModalInitialText(txt);
      setModalInitialUrl('');
      setModalInitialVariant('primary');
      setIsButtonEditing(false);
      setEditingButtonNode(null);
      setShowButtonModal(true);
    }
  };

  const handleInsertOrUpdateLink = (linkText: string, linkUrl: string) => {
    const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
    if (editorMode === 'visual') {
      if (isLinkEditing && editingLinkNode) {
        editingLinkNode.innerText = linkText;
        editingLinkNode.setAttribute('data-url', linkUrl);
        editingLinkNode.setAttribute('href', linkUrl);
        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      } else {
        const link = document.createElement('a');
        link.setAttribute('data-rich-type', 'link');
        link.setAttribute('data-url', linkUrl);
        link.setAttribute('href', linkUrl);
        link.className = 'rich-visual-link';
        link.innerText = linkText;

        const container = targetDivRef.current;
        let inserted = false;

        if (savedRangeRef.current && container && (container.contains(savedRangeRef.current.commonAncestorContainer) || container.contains(savedRangeRef.current.startContainer))) {
          try {
            savedRangeRef.current.deleteContents();
            savedRangeRef.current.insertNode(link);
            inserted = true;

            const space = document.createTextNode('\u00A0');
            if (link.parentNode) {
              link.parentNode.insertBefore(space, link.nextSibling);
            }

            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(newRange);
              savedRangeRef.current = newRange.cloneRange();
            }
          } catch {
            inserted = false;
          }
        }

        if (!inserted && container) {
          const lastEl = container.lastElementChild;
          if (lastEl && lastEl.tagName.toLowerCase() === 'p') {
            lastEl.appendChild(document.createTextNode(' '));
            lastEl.appendChild(link);
          } else {
            const p = document.createElement('p');
            p.appendChild(link);
            container.appendChild(p);
          }
        }

        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      }
    } else {
      const ref = activeEditorRef.current === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '', '', `[${linkText}](${linkUrl})`);
    }
    setEditingLinkNode(null);
    setIsLinkEditing(false);
    setTimeout(() => updateActiveFormats(), 10);
  };

  const handleDeleteLink = () => {
    if (editingLinkNode) {
      const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      editingLinkNode.remove();
      setEditingLinkNode(null);
      setIsLinkEditing(false);
      isInternalUpdateRef.current = true;
      handleVisualInput(targetDivRef);
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleInsertOrUpdateButton = (btnLabel: string, btnUrl: string, btnVariant: string) => {
    const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
    if (editorMode === 'visual') {
      if (isButtonEditing && editingButtonNode) {
        editingButtonNode.setAttribute('data-label', btnLabel);
        editingButtonNode.setAttribute('data-url', btnUrl);
        editingButtonNode.setAttribute('data-variant', btnVariant);
        editingButtonNode.className = `rich-visual-badge rich-btn-${btnVariant}`;
        editingButtonNode.innerHTML = `<span>${escapeHtml(btnLabel)}</span>`;
        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      } else {
        const btn = document.createElement('span');
        btn.setAttribute('data-rich-type', 'button');
        btn.setAttribute('data-label', btnLabel);
        btn.setAttribute('data-url', btnUrl);
        btn.setAttribute('data-variant', btnVariant);
        btn.setAttribute('contenteditable', 'false');
        btn.className = `rich-visual-badge rich-btn-${btnVariant}`;
        btn.innerHTML = `<span>${escapeHtml(btnLabel)}</span>`;

        const container = targetDivRef.current;
        let inserted = false;

        if (savedRangeRef.current && container && (container.contains(savedRangeRef.current.commonAncestorContainer) || container.contains(savedRangeRef.current.startContainer))) {
          try {
            savedRangeRef.current.deleteContents();
            savedRangeRef.current.insertNode(btn);
            inserted = true;

            const space = document.createTextNode('\u00A0');
            if (btn.parentNode) {
              btn.parentNode.insertBefore(space, btn.nextSibling);
            }

            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(newRange);
              savedRangeRef.current = newRange.cloneRange();
            }
          } catch {
            inserted = false;
          }
        }

        if (!inserted && container) {
          const lastEl = container.lastElementChild;
          if (lastEl && lastEl.tagName.toLowerCase() === 'p') {
            lastEl.appendChild(document.createTextNode(' '));
            lastEl.appendChild(btn);
          } else {
            const p = document.createElement('p');
            p.appendChild(btn);
            container.appendChild(p);
          }
        }

        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      }
    } else {
      const ref = activeEditorRef.current === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '\n', '\n', `[button:${btnLabel}|${btnUrl}|${btnVariant}]`);
    }
    setEditingButtonNode(null);
    setIsButtonEditing(false);
    setTimeout(() => updateActiveFormats(), 10);
  };

  const handleDeleteButton = () => {
    if (editingButtonNode) {
      const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
      editingButtonNode.remove();
      setEditingButtonNode(null);
      setIsButtonEditing(false);
      isInternalUpdateRef.current = true;
      handleVisualInput(targetDivRef);
      setTimeout(() => updateActiveFormats(), 10);
    }
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

      const bulletMatch = currentLine.match(/^([-*•]\s+)(.*)$/);
      const numberMatch = currentLine.match(/^(\d+)(\.\s+)(.*)$/);

      if (bulletMatch) {
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

  const bgSurface = effectiveTheme.surface;
  const borderDefault = effectiveTheme.border;
  const textPrimary = effectiveTheme.textPrimary;
  const textSecondary = effectiveTheme.textSecondary;
  const textMuted = effectiveTheme.textMuted;
  const inputBg = effectiveTheme.inputBg;
  const inputBorder = effectiveTheme.inputBorder;
  const btnBg = effectiveTheme.surface;
  const btnBorder = effectiveTheme.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', ...style }}>
      {/* Scoped CSS for Visual WYSIWYG editor & Badges */}
      <style>{`
        .rich-wysiwyg-editor {
          outline: none;
          min-height: 110px;
          line-height: 1.6;
          font-family: inherit;
        }
        .rich-wysiwyg-editor:empty:before {
          content: attr(data-placeholder);
          color: ${activeIsDark ? '#94a3b8' : '#64748b'};
          pointer-events: none;
          font-style: italic;
        }
        .rich-wysiwyg-editor h1 {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0.5rem 0 0.25rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor h2 {
          font-size: 1.15rem;
          font-weight: 800;
          margin: 0.45rem 0 0.2rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor h3 {
          font-size: 1rem;
          font-weight: 700;
          margin: 0.4rem 0 0.2rem 0;
          color: inherit;
        }
        .rich-wysiwyg-editor ul {
          list-style-type: disc;
          margin: 0.35rem 0;
          padding-left: 1.4rem;
        }
        .rich-wysiwyg-editor ol {
          list-style-type: decimal;
          margin: 0.35rem 0;
          padding-left: 1.4rem;
        }
        .rich-wysiwyg-editor li {
          margin: 0.15rem 0;
        }
        .rich-wysiwyg-editor p {
          margin: 0.3rem 0;
        }
        .rich-visual-link {
          color: ${activeIsDark ? '#38bdf8' : '#0284c7'};
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.18rem;
          border-radius: 4px;
          padding: 0 2px;
          transition: background-color 0.15s ease;
        }
        .rich-visual-link:hover {
          background-color: ${activeIsDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)'};
        }
        .rich-visual-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.65rem;
          border-radius: 0.6rem;
          font-size: 0.74rem;
          font-weight: 800;
          cursor: pointer;
          user-select: none;
          margin: 0.15rem 0.25rem;
          vertical-align: middle;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .rich-visual-badge:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .rich-btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        .rich-btn-amber {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #000000;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
        }
        .rich-btn-emerald {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        .rich-btn-outline {
          background: ${activeIsDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.08)'};
          color: ${activeIsDark ? '#38bdf8' : '#0284c7'};
          border: 1px solid ${activeIsDark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(2, 132, 199, 0.4)'};
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
            backgroundColor: activeFormats.bold 
              ? (isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
              : btnBg,
            border: `1px solid ${activeFormats.bold 
              ? (isDark ? '#38bdf8' : '#0284c7') 
              : btnBorder}`,
            color: activeFormats.bold 
              ? (activeIsDark ? '#38bdf8' : '#0284c7') 
              : textPrimary,
            fontSize: '0.78rem',
            fontWeight: activeFormats.bold ? 800 : 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: activeFormats.bold ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
            transition: 'all 0.15s ease'
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
            backgroundColor: activeFormats.italic 
              ? (activeIsDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
              : btnBg,
            border: `1px solid ${activeFormats.italic 
              ? (activeIsDark ? '#38bdf8' : '#0284c7') 
              : btnBorder}`,
            color: activeFormats.italic 
              ? (activeIsDark ? '#38bdf8' : '#0284c7') 
              : textPrimary,
            fontSize: '0.78rem',
            fontWeight: activeFormats.italic ? 800 : 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: activeFormats.italic ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <em>I</em>
        </button>

        {/* Heading Dropdown */}
        <HeadingDropdown
          onSelect={(level) => handleFormatHeading(level, 'standard')}
          btnClassName="rich-btn-format"
          activeHeading={activeFormats.heading}
          theme={effectiveTheme}
          isDark={activeIsDark}
        />

        {/* List Dropdown */}
        <ListDropdown
          onSelect={(type) => handleFormatList(type, 'standard')}
          btnClassName="rich-btn-format"
          activeList={activeFormats.list}
          theme={effectiveTheme}
          isDark={activeIsDark}
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
            backgroundColor: activeFormats.link 
              ? (activeIsDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
              : btnBg,
            border: `1px solid ${activeFormats.link 
              ? (activeIsDark ? '#38bdf8' : '#0284c7') 
              : btnBorder}`,
            color: activeFormats.link 
              ? (activeIsDark ? '#38bdf8' : '#0284c7') 
              : (activeIsDark ? '#38bdf8' : '#0284c7'),
            fontSize: '0.78rem',
            fontWeight: activeFormats.link ? 800 : 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            boxShadow: activeFormats.link ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
            transition: 'all 0.15s ease'
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
            backgroundColor: activeFormats.button
              ? (activeIsDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.22)')
              : (activeIsDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)'),
            border: `1px solid ${activeFormats.button ? '#f59e0b' : 'rgba(245, 158, 11, 0.3)'}`,
            color: '#f59e0b',
            fontSize: '0.78rem',
            fontWeight: activeFormats.button ? 800 : 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            boxShadow: activeFormats.button ? '0 0 0 1px rgba(245, 158, 11, 0.35)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={12} />
          <span style={{ fontWeight: 800 }}>Tombol</span>
        </button>

        {/* Visual vs Source Mode Switcher */}
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
            padding: '0.25rem 0.55rem',
            borderRadius: '0.35rem',
            backgroundColor: editorMode === 'visual' ? (activeIsDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)') : (activeIsDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
            border: `1px solid ${editorMode === 'visual' ? (activeIsDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)') : btnBorder}`,
            color: editorMode === 'visual' ? (activeIsDark ? '#38bdf8' : '#0284c7') : textSecondary,
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

        {/* Fullscreen Zen Mode Button */}
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
              backgroundColor: activeIsDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.1)',
              border: `1px solid ${activeIsDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)'}`,
              color: activeIsDark ? '#38bdf8' : '#0284c7',
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
          onClick={(e) => {
            handleEditorClick(e, visualEditorRef, 'standard');
            updateActiveFormats();
          }}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onSelect={updateActiveFormats}
          onTouchEnd={updateActiveFormats}
          onFocus={() => {
            activeEditorRef.current = 'standard';
            updateActiveFormats();
          }}
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
            fontSize: '0.84rem',
            lineHeight: 1.6,
            padding: '0.7rem 0.85rem',
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
          onChange={e => {
            onChange(e.target.value);
            if (textareaRef.current) {
              savedTextareaRangeRef.current = {
                start: textareaRef.current.selectionStart,
                end: textareaRef.current.selectionEnd
              };
            }
            updateActiveFormats();
          }}
          onKeyDown={e => handleKeyDownSmartList(textareaRef, e)}
          onClick={updateActiveFormats}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onSelect={updateActiveFormats}
          onTouchEnd={updateActiveFormats}
          onFocus={() => {
            activeEditorRef.current = 'standard';
            updateActiveFormats();
          }}
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
            resize: 'vertical'
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
            ? 'Live WYSIWYG: Teks langsung diformat secara visual tanpa kode mentah'
            : 'Mode Markdown: Mendukung format mentah **tebal**, *miring*, [link], [button]'}
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
        <div 
          onClick={() => setIsFullscreen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: isMobile ? '100dvh' : '100vh',
            minHeight: isMobile ? '100dvh' : undefined,
            backgroundColor: isMobile ? effectiveTheme.modalBg : (effectiveTheme.modalOverlay || 'rgba(0, 0, 0, 0.72)'),
            backdropFilter: isMobile ? undefined : 'blur(8px)',
            WebkitBackdropFilter: isMobile ? undefined : 'blur(8px)',
            zIndex: 1250,
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'center',
            padding: isMobile ? 0 : '1.5rem',
            margin: 0,
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isMobile ? '100vw' : '100%',
              maxWidth: isMobile ? '100vw' : '940px',
              height: isMobile ? '100dvh' : 'min(800px, calc(100vh - 3.5rem))',
              maxHeight: isMobile ? '100dvh' : 'calc(100vh - 3.5rem)',
              minHeight: isMobile ? '100dvh' : undefined,
              backgroundColor: effectiveTheme.modalBg,
              borderRadius: isMobile ? 0 : '1.25rem',
              border: isMobile ? 'none' : `1px solid ${effectiveTheme.border}`,
              boxShadow: isMobile ? 'none' : (activeIsDark ? '0 25px 70px rgba(0, 0, 0, 0.6)' : '0 20px 50px rgba(0, 0, 0, 0.12)'),
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              boxSizing: 'border-box',
              paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
              paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
              paddingLeft: isMobile ? 'env(safe-area-inset-left, 0px)' : undefined,
              paddingRight: isMobile ? 'env(safe-area-inset-right, 0px)' : undefined
            }}
          >
            {/* Zen Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '0.75rem 1rem' : '0.8rem 1.15rem',
              backgroundColor: effectiveTheme.surface,
              borderBottom: `1px solid ${effectiveTheme.border}`,
              gap: '0.75rem',
              flexWrap: 'nowrap',
              flexShrink: 0
            }}>
              {/* Left: Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'var(--primary-glow, rgba(16, 185, 129, 0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #10b981)',
                  flexShrink: 0
                }}>
                  <Edit3 size={15} />
                </div>
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {label || 'Detail Artikel'}
                </span>
              </div>

              {/* Right: Close Button X (Shown on Desktop & Tablet only) */}
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsFullscreen(false);
                    }}
                    title="Tutup (Esc)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '0.5rem',
                      border: `1px solid ${effectiveTheme.border}`,
                      backgroundColor: activeIsDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                      color: textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Zen Editor Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: isMobile ? '0.4rem 0.75rem' : '0.45rem 1.1rem',
              backgroundColor: effectiveTheme.cardAlt,
              borderBottom: `1px solid ${effectiveTheme.border}`,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
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
                  backgroundColor: activeFormats.bold 
                    ? (activeIsDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
                    : btnBg,
                  border: `1px solid ${activeFormats.bold 
                    ? (activeIsDark ? '#38bdf8' : '#0284c7') 
                    : btnBorder}`,
                  color: activeFormats.bold 
                    ? (activeIsDark ? '#38bdf8' : '#0284c7') 
                    : textPrimary,
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.bold ? 800 : 700,
                  cursor: 'pointer',
                  boxShadow: activeFormats.bold ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
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
                  backgroundColor: activeFormats.italic 
                    ? (activeIsDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
                    : btnBg,
                  border: `1px solid ${activeFormats.italic 
                    ? (activeIsDark ? '#38bdf8' : '#0284c7') 
                    : btnBorder}`,
                  color: activeFormats.italic 
                    ? (activeIsDark ? '#38bdf8' : '#0284c7') 
                    : textPrimary,
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.italic ? 800 : 700,
                  cursor: 'pointer',
                  boxShadow: activeFormats.italic ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <em>I</em>
              </button>
              <HeadingDropdown
                onSelect={(level) => handleFormatHeading(level, 'fullscreen')}
                isZen
                activeHeading={activeFormats.heading}
                theme={effectiveTheme}
                isDark={activeIsDark}
              />
              <ListDropdown
                onSelect={(type) => handleFormatList(type, 'fullscreen')}
                isZen
                activeList={activeFormats.list}
                theme={effectiveTheme}
                isDark={activeIsDark}
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
                  backgroundColor: activeFormats.link 
                    ? (activeIsDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.15)') 
                    : btnBg,
                  border: `1px solid ${activeFormats.link 
                    ? (activeIsDark ? '#38bdf8' : '#0284c7') 
                    : btnBorder}`,
                  color: activeIsDark ? '#38bdf8' : '#0284c7',
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.link ? 800 : 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: activeFormats.link ? '0 0 0 1px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
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
                  backgroundColor: activeFormats.button
                    ? (activeIsDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.22)')
                    : (activeIsDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)'),
                  border: `1px solid ${activeFormats.button ? '#f59e0b' : 'rgba(245, 158, 11, 0.3)'}`,
                  color: '#f59e0b',
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.button ? 800 : 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: activeFormats.button ? '0 0 0 1px rgba(245, 158, 11, 0.35)' : 'none',
                  transition: 'all 0.15s ease'
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
                  padding: '0.28rem 0.65rem',
                  borderRadius: '0.4rem',
                  backgroundColor: editorMode === 'visual' ? (activeIsDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)') : (activeIsDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                  border: `1px solid ${editorMode === 'visual' ? (activeIsDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)') : btnBorder}`,
                  color: editorMode === 'visual' ? (activeIsDark ? '#38bdf8' : '#0284c7') : textSecondary,
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

            {/* Fullscreen Body */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.1rem',
              overflowY: 'auto',
              backgroundColor: effectiveTheme.editorBg || effectiveTheme.modalBg || (activeIsDark ? '#0b1120' : '#ffffff')
            }}>
              {editorMode === 'visual' ? (
                <div
                  ref={fullscreenVisualRef}
                  contentEditable
                  data-placeholder={placeholder || 'Tulis rincian pengumuman lengkap di sini...'}
                  className="rich-wysiwyg-editor"
                  onInput={() => handleVisualInput(fullscreenVisualRef)}
                  onClick={(e) => {
                    handleEditorClick(e, fullscreenVisualRef, 'fullscreen');
                    updateActiveFormats();
                  }}
                  onKeyUp={updateActiveFormats}
                  onMouseUp={updateActiveFormats}
                  onSelect={updateActiveFormats}
                  onTouchEnd={updateActiveFormats}
                  onFocus={() => {
                    activeEditorRef.current = 'fullscreen';
                    updateActiveFormats();
                  }}
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
                  onChange={e => {
                    onChange(e.target.value);
                    if (fullscreenTextareaRef.current) {
                      savedTextareaRangeRef.current = {
                        start: fullscreenTextareaRef.current.selectionStart,
                        end: fullscreenTextareaRef.current.selectionEnd
                      };
                    }
                    updateActiveFormats();
                  }}
                  onKeyDown={e => handleKeyDownSmartList(fullscreenTextareaRef, e)}
                  onClick={updateActiveFormats}
                  onKeyUp={updateActiveFormats}
                  onMouseUp={updateActiveFormats}
                  onSelect={updateActiveFormats}
                  onTouchEnd={updateActiveFormats}
                  onFocus={() => {
                    activeEditorRef.current = 'fullscreen';
                    updateActiveFormats();
                  }}
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
              )}
            </div>

            {/* Zen Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '0.75rem 1rem env(safe-area-inset-bottom, 0.75rem) 1rem' : '0.8rem 1.15rem',
              backgroundColor: effectiveTheme.surface,
              borderTop: `1px solid ${effectiveTheme.border}`,
              gap: '0.65rem',
              flexShrink: 0
            }}>
              {/* Left: Word and Character Counts */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: textMuted,
                overflow: 'hidden'
              }}>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.45rem',
                  backgroundColor: activeIsDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  border: `1px solid ${effectiveTheme.border}`,
                  color: textSecondary,
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {wordCount} kata
                </span>
                <span>•</span>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.45rem',
                  backgroundColor: activeIsDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  border: `1px solid ${effectiveTheme.border}`,
                  color: textSecondary,
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {charCount} karakter
                </span>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {isMobile && (
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
                      gap: '0.35rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'transparent',
                      border: `1px solid ${effectiveTheme.border}`,
                      color: textSecondary,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>Tutup</span>
                  </button>
                )}

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
                    padding: isMobile ? '0.5rem 1rem' : '0.55rem 1.35rem',
                    borderRadius: '0.65rem',
                    background: 'linear-gradient(135deg, var(--primary, #0284c7) 0%, var(--primary-hover, #0369a1) 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px var(--primary-glow, rgba(2, 132, 199, 0.35))',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Check size={15} strokeWidth={2.5} color="#ffffff" />
                  <span>Selesai</span>
                </button>
              </div>
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
        theme={effectiveTheme}
        isDark={activeIsDark}
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
        theme={effectiveTheme}
        isDark={activeIsDark}
      />
    </div>
  );
};
