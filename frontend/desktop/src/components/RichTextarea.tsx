import React, { useState, useEffect, useRef } from 'react';
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
  Copy
} from 'lucide-react';
import { sanitizeUrl, safeOpenUrl } from '../utils/urlSecurity';

/**
 * External Link Safety Confirmation Modal
 * Protects users from phishing and reverse tabnabbing when navigating away from platform.
 */
export const ExternalLinkWarningModal: React.FC<{
  url: string | null;
  onClose: () => void;
  theme?: any;
  isDark?: boolean;
}> = ({ url, onClose, theme, isDark = true }) => {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProceed = () => {
    const newWin = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWin) newWin.opener = null;
    onClose();
  };

  const bgModal = theme?.modalBg || (isDark ? '#0f172a' : '#ffffff');
  const borderCol = theme?.borderStrong || (isDark ? '#334155' : '#cbd5e1');
  const textPrimary = theme?.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const textSecondary = theme?.textSecondary || (isDark ? '#cbd5e1' : '#475569');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '440px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: textPrimary }}>
              Konfirmasi Tautan Luar
            </h4>
            <span style={{ fontSize: '0.7rem', color: textSecondary }}>
              Peringatan Keamanan Pengalihan Situs
            </span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.78rem', color: textSecondary, lineHeight: 1.5 }}>
          Anda akan dialihkan ke situs eksternal di luar ekosistem platform Catavor. Pastikan Anda hanya mengunjungi situs yang Anda percayai.
        </p>

        {/* URL Box with copy button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.75rem',
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '0.76rem',
            color: '#38bdf8',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'monospace'
          }}>
            {url}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            title="Salin Link"
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '0.45rem',
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
              border: 'none',
              color: textPrimary,
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              flexShrink: 0
            }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.55rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '0.65rem',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              border: `1px solid ${borderCol}`,
              color: textPrimary,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Batalkan
          </button>

          <button
            type="button"
            onClick={handleProceed}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '0.65rem',
              backgroundColor: '#3b82f6',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.35)'
            }}
          >
            <span>Kunjungi Situs</span>
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

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

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const handleLinkClick = (rawUrl: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const { isSafe, sanitizedUrl, isExternal } = sanitizeUrl(rawUrl);
    if (!isSafe || sanitizedUrl === '#') return;

    if (isExternal) {
      if (showExternalWarning) {
        setExternalUrlToPrompt(sanitizedUrl);
      } else {
        const newWin = window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');
        if (newWin) newWin.opener = null;
      }
    } else {
      if (onNavigate) {
        onNavigate(sanitizedUrl);
      } else {
        if (sanitizedUrl.startsWith('/')) {
          window.history.pushState({}, '', sanitizedUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = sanitizedUrl;
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
    const regex = /(\[button:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]|\[cta:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]|\[([^\]]+)\]\(([^)]+)\)|\*\*(.*?)\*\*|\*(.*?)\*|__(.*?)__|_(.*?)_|`(.*?)`)/g;
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
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={`h4-${lineIdx}`} style={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.55rem 0 0.18rem 0', color: 'var(--text-muted, #94a3b8)' }}>
            {renderInlineMarkdown(trimmed.replace(/^####\s+/, ''))}
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

      {externalUrlToPrompt && (
        <ExternalLinkWarningModal
          url={externalUrlToPrompt}
          onClose={() => setExternalUrlToPrompt(null)}
        />
      )}
    </>
  );
};
