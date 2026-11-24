import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Maximize2,
  Minimize2,
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
  FileText,
  ShieldAlert,
  ShieldCheck
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
  theme?: any;
  isDark?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  style,
  className,
  onNavigate,
  showExternalWarning = true,
  theme,
  isDark = false
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
    isBlock: boolean = false,
    size: string = 'md'
  ) => {
    const sec = checkUrlSecurity(rawUrl);
    if (!sec.isSafe || sec.sanitizedUrl === '#') return null;

    let bg = 'linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%)';
    let textColor = '#ffffff';
    let borderColor = 'transparent';
    let shadow = '0 2px 8px var(--primary-glow, rgba(30, 58, 138, 0.3))';

    if (variant === 'amber' || variant === 'warning') {
      bg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      textColor = '#000000';
      shadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
    } else if (variant === 'emerald' || variant === 'success') {
      bg = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      textColor = '#ffffff';
      shadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
    } else if (variant === 'outline') {
      bg = 'var(--primary-glow, rgba(30, 58, 138, 0.08))';
      textColor = 'var(--primary, #1e3a8a)';
      borderColor = 'var(--primary, #1e3a8a)';
      shadow = 'none';
    } else if (variant === 'danger') {
      bg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      textColor = '#ffffff';
      shadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
    }

    // Size tokens
    let padding = isBlock ? '0.65rem 1.25rem' : '0.28rem 0.65rem';
    let fontSize = isBlock ? '0.82rem' : '0.74rem';
    let borderRadius = '0.65rem';
    let iconSize = isBlock ? 13 : 11;
    let gap = '0.35rem';

    if (size === 'sm') {
      padding = isBlock ? '0.45rem 0.95rem' : '0.2rem 0.5rem';
      fontSize = isBlock ? '0.74rem' : '0.68rem';
      borderRadius = '0.45rem';
      iconSize = isBlock ? 11 : 10;
      gap = '0.25rem';
    } else if (size === 'lg') {
      padding = isBlock ? '0.85rem 1.65rem' : '0.42rem 0.95rem';
      fontSize = isBlock ? '0.94rem' : '0.85rem';
      borderRadius = '0.75rem';
      iconSize = isBlock ? 15 : 13;
      gap = '0.45rem';
    } else if (size === 'xl') {
      padding = isBlock ? '1.05rem 2.15rem' : '0.58rem 1.25rem';
      fontSize = isBlock ? '1.08rem' : '0.96rem';
      borderRadius = '0.85rem';
      iconSize = isBlock ? 18 : 15;
      gap = '0.55rem';
    }

    const buttonElement = (
      <button
        key={key}
        type="button"
        onClick={(e) => handleLinkClick(sec.sanitizedUrl, e)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
          padding,
          borderRadius,
          background: bg,
          color: textColor,
          border: `1px solid ${borderColor}`,
          fontSize,
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
        {sec.isExternal ? <ExternalLink size={iconSize} /> : <MousePointer size={iconSize} />}
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
    if (!str) return null;
    const cleanStr = str
      .replace(/^>+\s*/gm, '')
      .replace(/(\s)--+(\s)/g, '$1—$2');
    const sanitize = (t: string) => t.replace(/\*\*/g, '').replace(/^>+\s*/gm, '').replace(/---+/g, '');
    const parts: React.ReactNode[] = [];
    let idx = 0;
    // Regex matches:
    // 1. [button:Label|url|variant] or [cta:Label|url|variant]
    // 2. [Link Text](url)
    // 3. **bold** or __bold__
    // 4. *italic* or _italic_
    // 5. `code`
    const regex = /(\[button:([^|\]]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]|\[cta:([^|\]]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__|_(.*?)_|`([^`]+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanStr)) !== null) {
      if (match.index > lastIndex) {
        const raw = sanitize(cleanStr.substring(lastIndex, match.index));
        if (raw) parts.push(raw);
      }

      // 1. CTA Button Syntax
      if (match[2] !== undefined && match[3] !== undefined) {
        const btnLabel = match[2];
        const btnUrl = match[3];
        const btnVariant = match[4] || 'primary';
        const btnSize = match[5] || 'md';
        parts.push(renderButton(btnLabel, btnUrl, btnVariant, `btn-${idx++}`, false, btnSize));
      } else if (match[6] !== undefined && match[7] !== undefined) {
        const btnLabel = match[6];
        const btnUrl = match[7];
        const btnVariant = match[8] || 'primary';
        const btnSize = match[9] || 'md';
        parts.push(renderButton(btnLabel, btnUrl, btnVariant, `cta-${idx++}`, false, btnSize));
      }
      // 2. Markdown Link [Text](URL)
      else if (match[10] !== undefined && match[11] !== undefined) {
        const linkText = match[10];
        const rawUrl = match[11];
        const sec = checkUrlSecurity(rawUrl);

        if (sec.isSafe && sec.sanitizedUrl !== '#') {
          parts.push(
            <a
              key={`lnk-${idx++}`}
              href={sec.sanitizedUrl}
              target={sec.isExternal ? '_blank' : undefined}
              rel={sec.isExternal ? 'noopener noreferrer' : undefined}
              onClick={(e) => handleLinkClick(sec.sanitizedUrl, e)}
              style={{
                color: 'var(--primary, #1e3a8a)',
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
              {sec.isExternal && <ExternalLink size={11} style={{ flexShrink: 0 }} />}
            </a>
          );
        } else {
          parts.push(<span key={`unsafe-${idx++}`} style={{ color: 'inherit' }}>{linkText}</span>);
        }
      }
      // 3. Bold
      else if (match[12] !== undefined) {
        parts.push(<strong key={`b-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{sanitize(match[12])}</strong>);
      } else if (match[14] !== undefined) {
        parts.push(<strong key={`b2-${idx++}`} style={{ fontWeight: 700, color: 'inherit' }}>{sanitize(match[14])}</strong>);
      }
      // 4. Italic
      else if (match[13] !== undefined) {
        parts.push(<em key={`i-${idx++}`}>{sanitize(match[13])}</em>);
      } else if (match[15] !== undefined) {
        parts.push(<em key={`i2-${idx++}`}>{sanitize(match[15])}</em>);
      }
      // 5. Code
      else if (match[16] !== undefined) {
        parts.push(
          <code key={`c-${idx++}`} style={{ backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.12))', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.9em', color: 'var(--primary, #1e3a8a)' }}>
            {match[16]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < cleanStr.length) {
      const rawTail = sanitize(cleanStr.substring(lastIndex));
      if (rawTail) parts.push(rawTail);
    }
    return parts.length > 0 ? parts : sanitize(cleanStr);
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
    const blockButtonMatch = trimmed.match(/^\[(button|cta):([^|\]]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]$/);
    if (blockButtonMatch) {
      const flushed = flushList(lineIdx);
      if (flushed) elements.push(flushed);
      const btnLabel = blockButtonMatch[2];
      const btnUrl = blockButtonMatch[3];
      const btnVariant = blockButtonMatch[4] || 'primary';
      const btnSize = blockButtonMatch[5] || 'md';
      elements.push(renderButton(btnLabel, btnUrl, btnVariant, `blk-btn-${lineIdx}`, true, btnSize));
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
            border: isChecked ? 'none' : '1.5px solid var(--border-hover, #cbd5e1)',
            backgroundColor: isChecked ? 'var(--primary, #1e3a8a)' : 'transparent',
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
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('-- ')) {
      const itemText = trimmed.replace(/^(--|[-*•])\s+/, '');
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
      } else if (/^[-*_]{2,}$/.test(trimmed)) {
        elements.push(<hr key={`hr-${lineIdx}`} style={{ border: 'none', borderTop: '1px solid var(--border-light, #e2e8f0)', margin: '0.85rem 0' }} />);
      } else if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>+\s*/, '');
        elements.push(
          <blockquote key={`bq-${lineIdx}`} style={{
            margin: '0.5rem 0',
            padding: '0.6rem 0.9rem',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '3px solid var(--primary, #1e3a8a)',
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
          theme={theme}
          isDark={isDark}
        />
      )}
    </>
  );
};

/**
 * Shared slide-up bottom sheet drag-to-dismiss physics helper (AGENTS.md Rule 7.A.3)
 */
function useMobileBottomSheetDrag(isOpen: boolean, onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setIsDragging(false);
      setIsClosing(false);
      touchStartY.current = null;
    }
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const closeWithAnimation = useCallback(() => {
    setIsDragging(false);
    setIsClosing(true);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setIsClosing(false);
      setDragY(0);
      onClose();
    }, 240);
  }, [onClose]);

  const handleDragStart = useCallback((clientY: number) => {
    touchStartY.current = clientY;
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (touchStartY.current === null) return;
    const delta = clientY - touchStartY.current;
    setDragY(delta > 0 ? delta : delta * 0.16);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    setIsDragging(false);
    if (dragY >= 70) {
      closeWithAnimation();
    } else {
      setDragY(0);
    }
  }, [dragY, closeWithAnimation]);

  return {
    dragY,
    isDragging,
    isClosing,
    closeWithAnimation,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}

/**
 * Link Insertion Mobile Bottom Sheet Modal (AGENTS.md Rule 7.A.3)
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
  isDark = false
}) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [previewExternalUrl, setPreviewExternalUrl] = useState<string | null>(null);

  const {
    dragY,
    isDragging,
    isClosing,
    closeWithAnimation,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useMobileBottomSheetDrag(isOpen, onClose);

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: 'rich-link-insert-modal-mobile'
  });

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setUrl(initialUrl || '');
      setPreviewExternalUrl(null);
    }
  }, [isOpen, initialText, initialUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithAnimation();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  if (!isOpen) return null;

  const urlSec = checkUrlSecurity(url);

  const handleConfirm = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!text.trim() || !url.trim() || !urlSec.isSafe) return;
    const finalUrl = urlSec.sanitizedUrl !== '#' ? urlSec.sanitizedUrl : url.trim();
    onInsert(text.trim(), finalUrl);
    setText('');
    setUrl('');
    onClose();
  };

  const bgModal = theme?.modalBg || theme?.surface || 'var(--bg-card, #ffffff)';
  const borderCol = theme?.borderStrong || theme?.border || 'var(--border-light, #e2e8f0)';
  const textPrimary = theme?.textPrimary || 'var(--text-primary, #0f172a)';
  const textSecondary = theme?.textSecondary || 'var(--text-secondary, #334155)';
  const inputBg = theme?.inputBg || theme?.cardAlt || 'var(--bg-deep, #f8fafc)';
  const inputBorder = theme?.inputBorder || borderCol;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Tautan (Link)' : 'Sisipkan Tautan (Link)'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 0
      }}
      onClick={(e) => {
        e.stopPropagation();
        closeWithAnimation();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: bgModal,
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          border: `1px solid ${borderCol}`,
          borderBottom: 'none',
          boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Drag Handle Bar + Clean Header (NO Close/X button per AGENTS.md Rule 7.A.3) */}
        <div
          style={{ touchAction: 'none', userSelect: 'none', flexShrink: 0, cursor: 'grab' }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
        >
          <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)',
                transform: isDragging ? 'scaleX(1.12)' : 'scaleX(1)',
                transition: 'transform 0.15s ease'
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0 1.15rem 0.85rem',
              borderBottom: `1px solid ${borderCol}`
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.14))',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #3b82f6)'
              }}
            >
              <Link size={19} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary, textAlign: 'center' }}>
              {isEditing ? 'Edit Tautan (Link)' : 'Sisipkan Tautan (Link)'}
            </h4>
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleConfirm(e);
            }
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '0.95rem 1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.3rem' }}>
              Teks Tautan
            </label>
            <input
              type="text"
              placeholder="Contoh: Baca Panduan Merchant"
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.7rem',
                backgroundColor: inputBg,
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
                fontSize: '0.84rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.3rem' }}>
              URL Tujuan (Web atau Rute Internal)
            </label>
            <input
              type="text"
              placeholder="https://example.com atau /admin/settings"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.7rem',
                backgroundColor: inputBg,
                border: `1px solid ${url ? (!urlSec.isSafe ? '#ef4444' : !urlSec.isExternal ? '#10b981' : urlSec.isMasterTrusted ? '#3b82f6' : '#f59e0b') : inputBorder}`,
                color: textPrimary,
                fontSize: '0.84rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {url.trim() && (
              <div style={{
                marginTop: '0.55rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '0.85rem',
                backgroundColor: !urlSec.isSafe
                  ? 'rgba(239, 68, 68, 0.08)'
                  : !urlSec.isExternal
                    ? 'rgba(16, 185, 129, 0.08)'
                    : urlSec.isMasterTrusted
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${
                  !urlSec.isSafe
                    ? 'rgba(239, 68, 68, 0.25)'
                    : !urlSec.isExternal
                      ? 'rgba(16, 185, 129, 0.25)'
                      : urlSec.isMasterTrusted
                        ? 'rgba(59, 130, 246, 0.25)'
                        : 'rgba(245, 158, 11, 0.25)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                width: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.76rem', fontWeight: 800, minWidth: 0 }}>
                  {!urlSec.isSafe ? (
                    <>
                      <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#ef4444', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Protokol Dilarang (XSS Protection)</span>
                    </>
                  ) : !urlSec.isExternal ? (
                    <>
                      <Check size={15} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#10b981', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Rute Internal Platform</span>
                    </>
                  ) : urlSec.isMasterTrusted ? (
                    <>
                      <ShieldCheck size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#3b82f6', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Master Safe Domain ({urlSec.domain})</span>
                    </>
                  ) : (
                    <>
                      <Globe size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#d97706', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Domain Pihak Ketiga ({urlSec.domain || 'Eksternal'})</span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '0.72rem', color: textSecondary, lineHeight: 1.48, wordBreak: 'break-word' }}>
                  {!urlSec.isSafe
                    ? 'Protokol tidak aman dicegah demi keamanan sistem. Gunakan https:// atau rute internal (/...).'
                    : !urlSec.isExternal
                      ? 'Tautan internal sistem Catavor. Pengunjung bernavigasi langsung di dalam aplikasi tanpa konfirmasi eksternal.'
                      : urlSec.isMasterTrusted
                        ? 'Domain ini terdaftar resmi dalam Master Whitelist Sistem Catavor. Pengunjung langsung diarahkan ke halaman tujuan tanpa modal peringatan.'
                        : 'Domain ini berada di luar Master Safe Domain. Pengunjung toko akan melihat modal konfirmasi peringatan keamanan sebelum dialihkan.'}
                </div>

                {urlSec.isSafe && urlSec.sanitizedUrl !== '#' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', paddingTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newWin = window.open(urlSec.sanitizedUrl, '_blank', 'noopener,noreferrer');
                        if (newWin) newWin.opener = null;
                      }}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.12))',
                        border: '1px solid var(--primary, #1e3a8a)',
                        color: 'var(--primary, #1e3a8a)',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap'
                      }}
                      title="Buka tautan tujuan secara langsung di tab baru"
                    >
                      <ExternalLink size={13} />
                      <span>Buka Tautan</span>
                    </button>

                    {urlSec.isExternal && !urlSec.isMasterTrusted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewExternalUrl(urlSec.sanitizedUrl);
                        }}
                        style={{
                          minHeight: '38px',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '0.55rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.16)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          color: '#d97706',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                        title="Lihat simulasi konfirmasi keamanan yang akan tampil bagi pengunjung"
                      >
                        <Eye size={13} />
                        <span>Uji Modal Konfirmasi</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Structured Mobile Action Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${borderCol}`,
            padding: '0.85rem 1.1rem 1.05rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
            backgroundColor: bgModal,
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', width: '100%' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeWithAnimation();
              }}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: inputBg,
                border: `1px solid ${borderCol}`,
                color: textPrimary,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!text.trim() || !url.trim() || !urlSec.isSafe}
              style={{
                flex: 1.5,
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.6rem 1.1rem',
                borderRadius: '0.75rem',
                background: (!text.trim() || !url.trim() || !urlSec.isSafe) ? 'var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: (!text.trim() || !url.trim() || !urlSec.isSafe) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isEditing && <Check size={14} />}
              <span>{isEditing ? 'Simpan' : 'Sisipkan'}</span>
            </button>
          </div>

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
                width: '100%',
                minHeight: '42px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Trash2 size={14} />
              <span>Hapus Tautan</span>
            </button>
          )}
        </div>
      </div>

      {/* Visualisasi Konfirmasi Keamanan (Preview Modal) */}
      {previewExternalUrl && (
        <ExternalLinkWarningModal
          url={previewExternalUrl}
          onClose={() => setPreviewExternalUrl(null)}
          theme={theme}
          isDark={isDark}
        />
      )}
    </div>,
    document.body
  );
};

/**
 * CTA Button Insertion Mobile Bottom Sheet Modal (AGENTS.md Rule 7.A.3)
 */
export const ButtonInsertModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsert: (label: string, url: string, variant: string, size: string) => void;
  onDelete?: () => void;
  initialLabel?: string;
  initialUrl?: string;
  initialVariant?: 'primary' | 'amber' | 'emerald' | 'outline';
  initialSize?: 'sm' | 'md' | 'lg' | 'xl';
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
  initialSize = 'md',
  isEditing = false,
  theme,
  isDark = false
}) => {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState(initialUrl);
  const [variant, setVariant] = useState<'primary' | 'amber' | 'emerald' | 'outline'>(initialVariant);
  const [size, setSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(initialSize);
  const [previewExternalUrl, setPreviewExternalUrl] = useState<string | null>(null);

  const {
    dragY,
    isDragging,
    isClosing,
    closeWithAnimation,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useMobileBottomSheetDrag(isOpen, onClose);

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: 'rich-button-insert-modal-mobile'
  });

  useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel || '');
      setUrl(initialUrl || '');
      setVariant(initialVariant || 'primary');
      setSize(initialSize || 'md');
      setPreviewExternalUrl(null);
    }
  }, [isOpen, initialLabel, initialUrl, initialVariant, initialSize]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithAnimation();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  if (!isOpen) return null;

  const urlSec = checkUrlSecurity(url);

  const handleConfirm = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!label.trim() || !url.trim() || !urlSec.isSafe) return;
    const finalUrl = urlSec.sanitizedUrl !== '#' ? urlSec.sanitizedUrl : url.trim();
    onInsert(label.trim(), finalUrl, variant, size);
    setLabel('');
    setUrl('');
    onClose();
  };

  const bgModal = theme?.modalBg || theme?.surface || 'var(--bg-card, #ffffff)';
  const borderCol = theme?.borderStrong || theme?.border || 'var(--border-light, #e2e8f0)';
  const textPrimary = theme?.textPrimary || 'var(--text-primary, #0f172a)';
  const textSecondary = theme?.textSecondary || 'var(--text-secondary, #334155)';
  const inputBg = theme?.inputBg || theme?.cardAlt || 'var(--bg-deep, #f8fafc)';
  const inputBorder = theme?.inputBorder || borderCol;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Tombol Aksi (CTA)' : 'Sisipkan Tombol Aksi (CTA Button)'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 0
      }}
      onClick={(e) => {
        e.stopPropagation();
        closeWithAnimation();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: bgModal,
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          border: `1px solid ${borderCol}`,
          borderBottom: 'none',
          boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Drag Handle Bar + Clean Header (NO Close/X button per AGENTS.md Rule 7.A.3) */}
        <div
          style={{ touchAction: 'none', userSelect: 'none', flexShrink: 0, cursor: 'grab' }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
        >
          <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)',
                transform: isDragging ? 'scaleX(1.12)' : 'scaleX(1)',
                transition: 'transform 0.15s ease'
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0 1.15rem 0.85rem',
              borderBottom: `1px solid ${borderCol}`
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.16)',
                border: '1px solid rgba(245, 158, 11, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}
            >
              <Sparkles size={19} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textPrimary, textAlign: 'center' }}>
              {isEditing ? 'Edit Tombol Aksi (CTA)' : 'Sisipkan Tombol Aksi (CTA Button)'}
            </h4>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleConfirm(e);
            }
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '0.95rem 1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.3rem' }}>
              Label Tombol
            </label>
            <input
              type="text"
              placeholder="Contoh: Klaim Promo Sekarang / Buka Pengaturan"
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.7rem',
                backgroundColor: inputBg,
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
                fontSize: '0.84rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.3rem' }}>
              URL / Rute Aksi
            </label>
            <input
              type="text"
              placeholder="https://example.com atau /admin/promotions"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.7rem',
                backgroundColor: inputBg,
                border: `1px solid ${url ? (!urlSec.isSafe ? '#ef4444' : !urlSec.isExternal ? '#10b981' : urlSec.isMasterTrusted ? '#3b82f6' : '#f59e0b') : inputBorder}`,
                color: textPrimary,
                fontSize: '0.84rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {url.trim() && (
              <div style={{
                marginTop: '0.55rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '0.85rem',
                backgroundColor: !urlSec.isSafe
                  ? 'rgba(239, 68, 68, 0.08)'
                  : !urlSec.isExternal
                    ? 'rgba(16, 185, 129, 0.08)'
                    : urlSec.isMasterTrusted
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${
                  !urlSec.isSafe
                    ? 'rgba(239, 68, 68, 0.25)'
                    : !urlSec.isExternal
                      ? 'rgba(16, 185, 129, 0.25)'
                      : urlSec.isMasterTrusted
                        ? 'rgba(59, 130, 246, 0.25)'
                        : 'rgba(245, 158, 11, 0.25)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                width: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.76rem', fontWeight: 800, minWidth: 0 }}>
                  {!urlSec.isSafe ? (
                    <>
                      <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#ef4444', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Protokol Dilarang (XSS Protection)</span>
                    </>
                  ) : !urlSec.isExternal ? (
                    <>
                      <Check size={15} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#10b981', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Rute Internal Platform</span>
                    </>
                  ) : urlSec.isMasterTrusted ? (
                    <>
                      <ShieldCheck size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#3b82f6', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Master Safe Domain ({urlSec.domain})</span>
                    </>
                  ) : (
                    <>
                      <Globe size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ color: '#d97706', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Domain Pihak Ketiga ({urlSec.domain || 'Eksternal'})</span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '0.72rem', color: textSecondary, lineHeight: 1.48, wordBreak: 'break-word' }}>
                  {!urlSec.isSafe
                    ? 'Protokol tidak aman dicegah demi keamanan sistem. Gunakan https:// atau rute internal (/...).'
                    : !urlSec.isExternal
                      ? 'Tautan internal sistem Catavor. Pengunjung bernavigasi langsung di dalam aplikasi tanpa konfirmasi eksternal.'
                      : urlSec.isMasterTrusted
                        ? 'Domain ini terdaftar resmi dalam Master Whitelist Sistem Catavor. Pengunjung langsung diarahkan ke halaman tujuan tanpa modal peringatan.'
                        : 'Domain ini berada di luar Master Safe Domain. Pengunjung toko akan melihat modal konfirmasi peringatan keamanan sebelum dialihkan.'}
                </div>

                {urlSec.isSafe && urlSec.sanitizedUrl !== '#' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', paddingTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newWin = window.open(urlSec.sanitizedUrl, '_blank', 'noopener,noreferrer');
                        if (newWin) newWin.opener = null;
                      }}
                      style={{
                        minHeight: '38px',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.55rem',
                        backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.12))',
                        border: '1px solid var(--primary, #1e3a8a)',
                        color: 'var(--primary, #1e3a8a)',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap'
                      }}
                      title="Buka tautan tujuan secara langsung di tab baru"
                    >
                      <ExternalLink size={13} />
                      <span>Buka Tautan</span>
                    </button>

                    {urlSec.isExternal && !urlSec.isMasterTrusted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewExternalUrl(urlSec.sanitizedUrl);
                        }}
                        style={{
                          minHeight: '38px',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '0.55rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.16)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          color: '#d97706',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                        title="Lihat simulasi konfirmasi keamanan yang akan tampil bagi pengunjung"
                      >
                        <Eye size={13} />
                        <span>Uji Modal Konfirmasi</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.35rem' }}>
              Ukuran Tombol
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.4rem' }}>
              {[
                { id: 'sm', label: 'Kecil' },
                { id: 'md', label: 'Sedang' },
                { id: 'lg', label: 'Besar' },
                { id: 'xl', label: 'XL' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSize(opt.id as any);
                  }}
                  style={{
                    minHeight: '46px',
                    padding: '0.45rem 0.25rem',
                    borderRadius: '0.65rem',
                    border: size === opt.id ? '2px solid var(--primary, #1e3a8a)' : `1px solid ${borderCol}`,
                    backgroundColor: size === opt.id ? 'var(--primary-glow, rgba(30, 58, 138, 0.15))' : 'transparent',
                    color: size === opt.id ? 'var(--primary, #1e3a8a)' : textPrimary,
                    fontSize: '0.74rem',
                    fontWeight: size === opt.id ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.64rem', opacity: 0.75 }}>{opt.id.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: textSecondary, display: 'block', marginBottom: '0.35rem' }}>
              Gaya Desain Tombol
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem' }}>
              {[
                { id: 'primary', label: 'Warna Tema', color: 'var(--primary, #1e3a8a)' },
                { id: 'amber', label: 'Amber Emas', color: '#f59e0b' },
                { id: 'emerald', label: 'Hijau Sukses', color: '#10b981' },
                { id: 'outline', label: 'Garis Tepi', color: 'var(--primary, #1e3a8a)' }
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
                    minHeight: '44px',
                    padding: '0.5rem 0.7rem',
                    borderRadius: '0.65rem',
                    border: variant === opt.id ? `2px solid ${opt.color}` : `1px solid ${borderCol}`,
                    backgroundColor: variant === opt.id ? 'var(--primary-glow, rgba(30, 58, 138, 0.12))' : 'transparent',
                    color: textPrimary,
                    fontSize: '0.76rem',
                    fontWeight: variant === opt.id ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0 }} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {label.trim() && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--bg-card-hover, var(--bg-deep, #f8fafc))',
              border: `1px dashed ${borderCol}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}>
              <span style={{ fontSize: '0.68rem', color: textSecondary, fontWeight: 700 }}>Pratinjau Tombol:</span>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: size === 'sm' ? '0.25rem' : size === 'lg' ? '0.45rem' : size === 'xl' ? '0.55rem' : '0.35rem',
                  padding: size === 'sm' ? '0.25rem 0.6rem' : size === 'lg' ? '0.45rem 1.1rem' : size === 'xl' ? '0.6rem 1.4rem' : '0.35rem 0.85rem',
                  borderRadius: size === 'sm' ? '0.45rem' : size === 'lg' ? '0.75rem' : size === 'xl' ? '0.85rem' : '0.6rem',
                  fontSize: size === 'sm' ? '0.7rem' : size === 'lg' ? '0.88rem' : size === 'xl' ? '0.98rem' : '0.78rem',
                  fontWeight: 800,
                  background: variant === 'amber' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : variant === 'emerald' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : variant === 'outline' ? 'var(--primary-glow, rgba(30, 58, 138, 0.08))'
                    : 'linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%)',
                  color: variant === 'amber' ? '#000000' : variant === 'outline' ? 'var(--primary, #1e3a8a)' : '#ffffff',
                  border: variant === 'outline' ? '1px solid var(--primary, #1e3a8a)' : 'none',
                  boxShadow: variant === 'outline' ? 'none' : '0 2px 8px var(--primary-glow, rgba(30, 58, 138, 0.3))',
                  maxWidth: '100%'
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>{label.trim()}</span>
                {urlSec.isExternal ? <ExternalLink size={size === 'sm' ? 10 : size === 'lg' ? 14 : size === 'xl' ? 16 : 12} style={{ flexShrink: 0 }} /> : <MousePointer size={size === 'sm' ? 10 : size === 'lg' ? 14 : size === 'xl' ? 16 : 12} style={{ flexShrink: 0 }} />}
              </div>
            </div>
          )}
        </div>

        {/* Structured Mobile Action Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${borderCol}`,
            padding: '0.85rem 1.1rem 1.05rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
            backgroundColor: bgModal,
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', width: '100%' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeWithAnimation();
              }}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: inputBg,
                border: `1px solid ${borderCol}`,
                color: textPrimary,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!label.trim() || !url.trim() || !urlSec.isSafe}
              style={{
                flex: 1.5,
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.6rem 1.1rem',
                borderRadius: '0.75rem',
                background: (!label.trim() || !url.trim() || !urlSec.isSafe) ? 'var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: (!label.trim() || !url.trim() || !urlSec.isSafe) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isEditing && <Check size={14} />}
              <span>{isEditing ? 'Simpan' : 'Sisipkan Tombol'}</span>
            </button>
          </div>

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
                width: '100%',
                minHeight: '42px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Trash2 size={14} />
              <span>Hapus Tombol</span>
            </button>
          )}
        </div>
      </div>

      {/* Visualisasi Konfirmasi Keamanan (Preview Modal) */}
      {previewExternalUrl && (
        <ExternalLinkWarningModal
          url={previewExternalUrl}
          onClose={() => setPreviewExternalUrl(null)}
          theme={theme}
          isDark={isDark}
        />
      )}
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
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = false, activeHeading = null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const {
    dragY,
    isDragging,
    isClosing,
    closeWithAnimation,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useMobileBottomSheetDrag(isOpen, () => setIsOpen(false));

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: `rich-heading-picker-mobile-${isZen ? 'zen' : 'std'}`
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithAnimation();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  const handleSelect = (level: 1 | 2 | 3) => {
    onSelect(level);
    setIsOpen(false);
  };

  const isHighlighted = isOpen || Boolean(activeHeading);
  const bgCard = theme?.modalBg || theme?.surface || theme?.card || 'var(--bg-card, #ffffff)';
  const borderCol = theme?.borderStrong || theme?.border || 'var(--border-light, #e2e8f0)';
  const textCol = theme?.textPrimary || 'var(--text-primary, #0f172a)';
  const textMutedCol = theme?.textMuted || 'var(--text-muted, #64748b)';
  const deepBg = theme?.cardAlt || theme?.inputBg || 'var(--bg-deep, #f8fafc)';

  const headingItems: Array<{ level: 1 | 2 | 3; tag: string; label: string; syntax: string; fontSize: string }> = [
    { level: 1, tag: 'H1', label: 'Judul Utama', syntax: '#', fontSize: '0.96rem' },
    { level: 2, tag: 'H2', label: 'Judul Bab', syntax: '##', fontSize: '0.9rem' },
    { level: 3, tag: 'H3', label: 'Sub-Judul', syntax: '###', fontSize: '0.84rem' },
  ];

  return (
    <>
      <button
        type="button"
        className={btnClassName}
        title="Pilih Ukuran Judul (Heading H1, H2, H3)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isHighlighted ? 'var(--primary-glow, rgba(30, 58, 138, 0.15))' : (theme?.card || 'var(--bg-card, #ffffff)'),
          borderColor: isHighlighted ? 'var(--primary, #1e3a8a)' : borderCol,
          color: isHighlighted ? 'var(--primary, #1e3a8a)' : (theme?.textSecondary || 'var(--text-secondary, #334155)'),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          fontWeight: isHighlighted ? 800 : 700,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: isHighlighted ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontWeight: 700 }}>{activeHeading ? `Judul (H${activeHeading})` : 'Judul'}</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilih Ukuran Judul"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
          onClick={(e) => {
            e.stopPropagation();
            closeWithAnimation();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: bgCard,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${borderCol}`,
              borderBottom: 'none',
              boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.38)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
              transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
              transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDragEnd}
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
              onMouseUp={handleDragEnd}
            >
              <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '44px',
                    height: '5px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0 1.15rem 0.85rem', borderBottom: `1px solid ${borderCol}` }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #2563eb)' }}>
                  <Type size={19} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: textCol, textAlign: 'center' }}>
                  Pilih Ukuran Judul
                </h4>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {headingItems.map((item) => {
                const selected = activeHeading === item.level;
                return (
                  <button
                    key={item.level}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item.level)}
                    style={{
                      minHeight: '50px',
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '0.85rem',
                      border: selected ? '1.5px solid var(--primary, #2563eb)' : `1px solid ${borderCol}`,
                      backgroundColor: selected ? 'var(--primary-glow, rgba(37, 99, 235, 0.12))' : deepBg,
                      color: selected ? 'var(--primary, #2563eb)' : textCol,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontWeight: 800, fontSize: item.fontSize, color: 'var(--primary, #2563eb)', minWidth: '28px' }}>{item.tag}</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: selected ? 800 : 600 }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <code style={{ fontSize: '0.74rem', color: textMutedCol, backgroundColor: bgCard, padding: '0.15rem 0.45rem', borderRadius: '6px', border: `1px solid ${borderCol}` }}>{item.syntax}</code>
                      {selected && <Check size={15} strokeWidth={2.5} color="var(--primary, #2563eb)" />}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={closeWithAnimation}
                style={{
                  marginTop: '0.25rem',
                  minHeight: '44px',
                  width: '100%',
                  borderRadius: '0.75rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: deepBg,
                  color: textCol,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
            </div>
          </div>
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
}> = ({ onSelect, btnClassName = "rich-btn-format", isZen = false, theme, isDark = false, activeList = null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const {
    dragY,
    isDragging,
    isClosing,
    closeWithAnimation,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useMobileBottomSheetDrag(isOpen, () => setIsOpen(false));

  useModalBackHandler({
    isOpen,
    onClose: closeWithAnimation,
    modalId: `rich-list-picker-mobile-${isZen ? 'zen' : 'std'}`
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithAnimation();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  const handleSelect = (type: 'bullet' | 'number') => {
    onSelect(type);
    setIsOpen(false);
  };

  const isHighlighted = isOpen || Boolean(activeList);
  const bgCard = theme?.modalBg || theme?.surface || theme?.card || 'var(--bg-card, #ffffff)';
  const borderCol = theme?.borderStrong || theme?.border || 'var(--border-light, #e2e8f0)';
  const textCol = theme?.textPrimary || 'var(--text-primary, #0f172a)';
  const textMutedCol = theme?.textMuted || 'var(--text-muted, #64748b)';
  const deepBg = theme?.cardAlt || theme?.inputBg || 'var(--bg-deep, #f8fafc)';

  const listItems: Array<{ type: 'bullet' | 'number'; glyph: string; label: string; syntax: string }> = [
    { type: 'bullet', glyph: '•', label: 'Daftar Poin', syntax: '-' },
    { type: 'number', glyph: '1.', label: 'Daftar Nomor', syntax: '1.' },
  ];

  return (
    <>
      <button
        type="button"
        className={btnClassName}
        title="Pilih Format Daftar (Daftar Poin, Nomor)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isHighlighted ? 'var(--primary-glow, rgba(30, 58, 138, 0.15))' : (theme?.card || 'var(--bg-card, #ffffff)'),
          borderColor: isHighlighted ? 'var(--primary, #1e3a8a)' : borderCol,
          color: isHighlighted ? 'var(--primary, #1e3a8a)' : (theme?.textSecondary || 'var(--text-secondary, #334155)'),
          padding: '0.25rem 0.55rem',
          borderRadius: '0.35rem',
          fontSize: '0.78rem',
          fontWeight: isHighlighted ? 800 : 700,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: isHighlighted ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontWeight: 700 }}>{activeList === 'bullet' ? 'List (Poin)' : activeList === 'number' ? 'List (Nomor)' : 'List'}</span>
        <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilih Format Daftar"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
          onClick={(e) => {
            e.stopPropagation();
            closeWithAnimation();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: bgCard,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${borderCol}`,
              borderBottom: 'none',
              boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.38)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
              transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, dragY)}px)`,
              transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDragEnd}
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
              onMouseUp={handleDragEnd}
            >
              <div style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '44px',
                    height: '5px',
                    borderRadius: '999px',
                    backgroundColor: isDark ? 'rgba(203, 213, 225, 0.55)' : 'rgba(71, 85, 105, 0.45)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0 1.15rem 0.85rem', borderBottom: `1px solid ${borderCol}` }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #2563eb)' }}>
                  <FileText size={19} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: textCol, textAlign: 'center' }}>
                  Pilih Format Daftar
                </h4>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listItems.map((item) => {
                const selected = activeList === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item.type)}
                    style={{
                      minHeight: '50px',
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '0.85rem',
                      border: selected ? '1.5px solid var(--primary, #2563eb)' : `1px solid ${borderCol}`,
                      backgroundColor: selected ? 'var(--primary-glow, rgba(37, 99, 235, 0.12))' : deepBg,
                      color: selected ? 'var(--primary, #2563eb)' : textCol,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary, #2563eb)', minWidth: '24px', textAlign: 'center' }}>{item.glyph}</span>
                      <span style={{ fontSize: '0.86rem', fontWeight: selected ? 800 : 600 }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <code style={{ fontSize: '0.74rem', color: textMutedCol, backgroundColor: bgCard, padding: '0.15rem 0.45rem', borderRadius: '6px', border: `1px solid ${borderCol}` }}>{item.syntax}</code>
                      {selected && <Check size={15} strokeWidth={2.5} color="var(--primary, #2563eb)" />}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={closeWithAnimation}
                style={{
                  marginTop: '0.25rem',
                  minHeight: '44px',
                  width: '100%',
                  borderRadius: '0.75rem',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: deepBg,
                  color: textCol,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
            </div>
          </div>
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

  // 1. CTA Button Syntax: [button:Label|url|variant|size] or [cta:Label|url|variant|size]
  res = res.replace(/\[(button|cta):([^|\]]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|([^\]]+))?\]/g, (_, _t, label, url, variant, size) => {
    const v = variant ? variant.trim() : 'primary';
    const s = size ? size.trim() : 'md';
    const cleanLabel = (label || '').trim();
    const sec = sanitizeUrl((url || '').trim());
    const cleanUrl = sec.isSafe ? sec.sanitizedUrl : '#';
    return `<span data-rich-type="button" data-label="${cleanLabel}" data-url="${cleanUrl}" data-variant="${v}" data-size="${s}" contenteditable="false" class="rich-visual-badge rich-btn-${v} rich-btn-size-${s}"><span>${cleanLabel}</span></span>`;
  });

  // 2. Markdown Link: [text](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
    const cleanText = (linkText || '').trim();
    const sec = sanitizeUrl((url || '').trim());
    const cleanUrl = sec.isSafe ? sec.sanitizedUrl : '#';
    return `<a data-rich-type="link" data-url="${cleanUrl}" href="${cleanUrl}" class="rich-visual-link">${cleanText}</a>`;
  });

  // 3. Bold: **text**
  res = res.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

  // 4. Italic: *text*
  res = res.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');

  // 5. Inline Code: `text`
  res = res.replace(/`([^`]+?)`/g, '<code style="background-color: var(--primary-glow, rgba(30, 58, 138, 0.12)); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; color: var(--primary, #1e3a8a);">$1</code>');

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
      const size = el.getAttribute('data-size') || 'md';
      return `[button:${label.trim()}|${url.trim()}|${variant}|${size}]`;
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
      const size = el.getAttribute('data-size') || 'md';
      return [`[button:${label.trim()}|${url.trim()}|${variant}|${size}]`];
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

/**
 * Condenses and simplifies mobile Zen Fullscreen header titles.
 * Prevents truncation with ellipsis ("...") by transforming long catalog/setting labels
 * into concise, readable, and informative titles that fit cleanly on mobile screens.
 */
export const condenseMobileTitle = (rawLabel?: string): string => {
  if (!rawLabel) return 'Editor Teks';
  const clean = rawLabel.replace(/[\s*]+$/, '').trim();

  // 1. Direct high-precision dictionary mapping for all 7 catalog types and store settings
  const knownMap: Record<string, string> = {
    // Physical
    'Pengiriman & Ketentuan Packing (Ekspedisi / Kurir)': 'Ketentuan Pengiriman',
    'Kebijakan Garansi / Retur Barang': 'Garansi & Retur',
    'Deskripsi Lengkap Barang': 'Deskripsi Produk',

    // Digital
    'Pengiriman & Panduan Akses File Digital': 'Pengiriman File Digital',
    'Ketentuan Lisensi & Hak Cipta': 'Lisensi & Hak Cipta',
    'Deskripsi & Isi Materi Digital': 'Deskripsi Materi Digital',

    // Fauna / Live Animals
    'Pengiriman & Garansi Live Arrival (Satwa)': 'Pengiriman Satwa (Live Arrival)',
    'Ketentuan Garansi D.O.A (Dead On Arrival)': 'Garansi Satwa (D.O.A)',
    'Deskripsi & Kondisi Satwa': 'Deskripsi Satwa',

    // Services
    'Area Layanan, Reservasi & Ketentuan Pengerjaan': 'Layanan & Reservasi',
    'Deskripsi Cakupan Layanan': 'Deskripsi Layanan',

    // Food & Beverage
    'Pengiriman & Ketentuan Kemasan (F&B)': 'Ketentuan Pengiriman F&B',
    'Deskripsi & Detail Menu Kuliner': 'Detail Menu Kuliner',

    // Property
    'Akses & Ketentuan Booking / Survey Lokasi': 'Booking & Survey Lokasi',
    'Legalitas & Kelengkapan Dokumen': 'Legalitas Dokumen',
    'Deskripsi Lengkap & Keunggulan Properti': 'Deskripsi Properti',

    // Plant / Flora
    'Pengiriman & Ketentuan Packing Tanaman': 'Ketentuan Pengiriman Tanaman',
    'Kebijakan Garansi Segar Sampai Tujuan': 'Garansi Segar Tanaman',
    'Deskripsi Lengkap Tanaman': 'Deskripsi Tanaman',

    // Store & Admin Profile Settings
    'Lokasi / Alamat Resmi': 'Lokasi & Alamat Toko',
    'Deskripsi Profil Lengkap': 'Deskripsi Profil Toko',
  };

  if (knownMap[clean]) {
    return knownMap[clean];
  }

  // 2. Intelligent Domain Heuristics for any custom or variant labels
  let simplified = clean;

  // Domain terms simplification
  if (/pengiriman/i.test(simplified)) {
    if (/digital/i.test(simplified)) return 'Pengiriman File Digital';
    if (/satwa/i.test(simplified)) return 'Pengiriman Satwa';
    if (/tanaman/i.test(simplified)) return 'Pengiriman Tanaman';
    if (/kemasan|f&b|kuliner/i.test(simplified)) return 'Ketentuan Pengiriman F&B';
    return 'Ketentuan Pengiriman';
  }

  if (/garansi|retur|doa|d\.o\.a/i.test(simplified)) {
    if (/doa|d\.o\.a/i.test(simplified)) return 'Garansi Satwa (D.O.A)';
    if (/segar/i.test(simplified)) return 'Garansi Segar Tanaman';
    if (/retur/i.test(simplified)) return 'Garansi & Retur';
    return 'Ketentuan Garansi';
  }

  if (/lisensi|hak cipta/i.test(simplified)) {
    return 'Lisensi & Hak Cipta';
  }

  if (/deskripsi/i.test(simplified)) {
    if (/satwa/i.test(simplified)) return 'Deskripsi Satwa';
    if (/tanaman/i.test(simplified)) return 'Deskripsi Tanaman';
    if (/properti/i.test(simplified)) return 'Deskripsi Properti';
    if (/layanan/i.test(simplified)) return 'Deskripsi Layanan';
    if (/menu|kuliner/i.test(simplified)) return 'Detail Menu Kuliner';
    if (/digital/i.test(simplified)) return 'Deskripsi Materi Digital';
    if (/profil/i.test(simplified)) return 'Deskripsi Profil Toko';
    return 'Deskripsi Produk';
  }

  if (/lokasi|alamat/i.test(simplified)) {
    return 'Lokasi & Alamat Toko';
  }

  if (/booking|survey/i.test(simplified)) {
    return 'Booking & Survey Lokasi';
  }

  if (/legalitas|dokumen/i.test(simplified)) {
    return 'Legalitas Dokumen';
  }

  // If still long, remove parenthetical expressions (e.g., "(Catatan Penting)")
  simplified = simplified.replace(/\s*\([^)]*\)/g, '').trim();

  // If contains slashes, take the first segment
  if (simplified.includes(' / ')) {
    simplified = simplified.split(' / ')[0].trim();
  }

  // Clean redundant words
  simplified = simplified.replace(/^(Kebijakan|Ketentuan|Deskripsi Lengkap & Keunggulan)\s+/i, '');

  return simplified || clean;
};

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

  // Screen Width Tracking for Responsive Form-Factor Adaptation (Mobile Native)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return true;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 1024);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isFocused, setIsFocused] = useState(false);

  // Dynamic Theme Auto-Detection (from localStorage / DOM when not explicitly provided)
  const [detectedIsDark, setDetectedIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 
                           document.body.getAttribute('data-theme') || 
                           localStorage.getItem('catavor_theme');
      if (currentTheme) {
        const darkThemes = ['dark', 'emerald', 'cyberpunk', 'ocean', 'nordic'];
        return darkThemes.includes(currentTheme.toLowerCase());
      }
      const adminMode = localStorage.getItem('catavor_admin_theme_mode');
      if (adminMode) return adminMode === 'dark';
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== 'undefined') {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 
                             document.body.getAttribute('data-theme') || 
                             localStorage.getItem('catavor_theme');
        if (currentTheme) {
          const darkThemes = ['dark', 'emerald', 'cyberpunk', 'ocean', 'nordic'];
          setDetectedIsDark(darkThemes.includes(currentTheme.toLowerCase()));
          return;
        }
        const adminMode = localStorage.getItem('catavor_admin_theme_mode');
        if (adminMode) {
          setDetectedIsDark(adminMode === 'dark');
          return;
        }
        setDetectedIsDark(document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
      }
    };

    window.addEventListener('storage', checkTheme);
    let observer: MutationObserver | null = null;
    if (typeof document !== 'undefined') {
      observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }
    return () => {
      window.removeEventListener('storage', checkTheme);
      if (observer) observer.disconnect();
    };
  }, []);

  const activeIsDark = isDark !== undefined ? isDark : detectedIsDark;

  // Robust Theme Tokens using CSS Variables for Instant Dynamic Synchronization
  const effectiveTheme = useMemo(() => {
    return {
      surface: theme?.surface || 'var(--bg-card, #ffffff)',
      card: theme?.card || 'var(--bg-card, #ffffff)',
      cardAlt: theme?.cardAlt || 'var(--bg-deep, #f8fafc)',
      cardHover: theme?.cardHover || 'var(--bg-card-hover, #f1f5f9)',
      border: theme?.border || 'var(--border-light, #e2e8f0)',
      borderStrong: theme?.borderStrong || 'var(--border-hover, #cbd5e1)',
      textPrimary: theme?.textPrimary || 'var(--text-primary, #0f172a)',
      textSecondary: theme?.textSecondary || 'var(--text-secondary, #334155)',
      textMuted: theme?.textMuted || 'var(--text-muted, #64748b)',
      inputBg: theme?.inputBg || 'var(--bg-card, #ffffff)',
      inputBorder: theme?.inputBorder || 'var(--border-light, #e2e8f0)',
      modalBg: theme?.modalBg || 'var(--bg-card, #ffffff)',
      modalOverlay: theme?.modalOverlay || 'rgba(0, 0, 0, 0.65)',
      editorBg: theme?.editorBg || 'var(--bg-card, #ffffff)',
      shadow: theme?.shadow || 'var(--shadow-premium, 0 8px 25px rgba(0, 0, 0, 0.12))',
      cardShadow: theme?.cardShadow || '0 4px 15px rgba(0, 0, 0, 0.05)',
      chipActiveBg: theme?.chipActiveBg || 'var(--primary, #1e3a8a)',
      chipActiveText: theme?.chipActiveText || '#ffffff',
      chipInactiveBg: theme?.chipInactiveBg || 'var(--bg-deep, #f1f5f9)',
      chipInactiveText: theme?.chipInactiveText || 'var(--text-muted, #64748b)',
      primary: 'var(--primary, #1e3a8a)',
      primaryGlow: 'var(--primary-glow, rgba(30, 58, 138, 0.2))',
      primaryHover: 'var(--primary-hover, #172554)'
    };
  }, [theme]);

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
  const [modalInitialSize, setModalInitialSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
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

  // Safe Close / Minimize Fullscreen handler
  const handleCloseFullscreen = useCallback((e?: React.MouseEvent | React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsFullscreen(false);
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleCloseFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isFullscreen, handleCloseFullscreen]);

  // Handle hardware / browser back to close Zen Fullscreen editor
  useModalBackHandler({
    isOpen: isFullscreen,
    onClose: handleCloseFullscreen,
    modalId: 'rich-textarea-portal-mobile'
  });

  const handleVisualInput = (targetRef: React.RefObject<HTMLDivElement | null>, skipFormatUpdate: boolean = false) => {
    if (!targetRef.current) return;
    isInternalUpdateRef.current = true;
    const newMd = htmlToMarkdown(targetRef.current);
    onChange(newMd);
    if (!skipFormatUpdate) {
      updateActiveFormats();
    }
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
      setModalInitialSize((btnNode.getAttribute('data-size') as any) || 'md');
      setIsButtonEditing(true);
      setShowButtonModal(true);
      return;
    }

    // 2. Clicked on an atomic link or any anchor
    const linkNode = (target.closest('[data-rich-type="link"]') || target.closest('a')) as HTMLAnchorElement | null;
    if (linkNode) {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = linkNode.getAttribute('data-url') || linkNode.getAttribute('href') || '';

      // Ctrl+Click or Cmd+Click: Open/follow link immediately through safe redirect
      if (e.ctrlKey || e.metaKey) {
        safeOpenUrl(targetUrl);
        return;
      }

      setEditingLinkNode(linkNode);
      setModalInitialText(linkNode.innerText || linkNode.textContent || '');
      setModalInitialUrl(targetUrl);
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
    activeEditorRef.current = editorType;
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
      const willBeBold = !activeFormats.bold;
      document.execCommand('bold', false);
      setActiveFormats(prev => ({ ...prev, bold: willBeBold }));
      handleVisualInput(ref, true);
      setTimeout(() => updateActiveFormats(), 50);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '**', '**', 'teks tebal');
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatItalic = (editorType: 'standard' | 'fullscreen') => {
    activeEditorRef.current = editorType;
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
      const willBeItalic = !activeFormats.italic;
      document.execCommand('italic', false);
      setActiveFormats(prev => ({ ...prev, italic: willBeItalic }));
      handleVisualInput(ref, true);
      setTimeout(() => updateActiveFormats(), 50);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      applyFormatToRef(ref, '*', '*', 'teks miring');
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatHeading = (level: 1 | 2 | 3, editorType: 'standard' | 'fullscreen') => {
    activeEditorRef.current = editorType;
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
      const isCurrent = activeFormats.heading === level;
      if (isCurrent) {
        document.execCommand('formatBlock', false, '<p>');
        setActiveFormats(prev => ({ ...prev, heading: null }));
      } else {
        document.execCommand('formatBlock', false, `<h${level}>`);
        setActiveFormats(prev => ({ ...prev, heading: level }));
      }
      handleVisualInput(ref, true);
      setTimeout(() => updateActiveFormats(), 50);
    } else {
      const ref = editorType === 'fullscreen' ? fullscreenTextareaRef : textareaRef;
      const prefix = level === 1 ? '\n# ' : level === 2 ? '\n## ' : '\n### ';
      applyFormatToRef(ref, prefix, '\n', `Judul H${level}`);
      setTimeout(() => updateActiveFormats(), 10);
    }
  };

  const handleFormatList = (type: 'bullet' | 'number', editorType: 'standard' | 'fullscreen') => {
    activeEditorRef.current = editorType;
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
      const isCurrent = activeFormats.list === type;
      if (type === 'bullet') {
        document.execCommand('insertUnorderedList', false);
      } else {
        document.execCommand('insertOrderedList', false);
      }
      setActiveFormats(prev => ({ ...prev, list: isCurrent ? null : type }));
      handleVisualInput(ref, true);
      setTimeout(() => updateActiveFormats(), 50);
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
      setModalInitialSize('md');
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
      setModalInitialSize('md');
      setIsButtonEditing(false);
      setEditingButtonNode(null);
      setShowButtonModal(true);
    }
  };

  const handleInsertOrUpdateLink = (linkText: string, linkUrl: string) => {
    const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
    const sec = sanitizeUrl(linkUrl);
    const finalUrl = sec.isSafe && sec.sanitizedUrl !== '#' ? sec.sanitizedUrl : linkUrl;
    if (editorMode === 'visual') {
      if (isLinkEditing && editingLinkNode) {
        editingLinkNode.innerText = linkText;
        editingLinkNode.setAttribute('data-url', finalUrl);
        editingLinkNode.setAttribute('href', finalUrl);
        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      } else {
        const link = document.createElement('a');
        link.setAttribute('data-rich-type', 'link');
        link.setAttribute('data-url', finalUrl);
        link.setAttribute('href', finalUrl);
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

  const handleInsertOrUpdateButton = (btnLabel: string, btnUrl: string, btnVariant: string, btnSize: string = 'md') => {
    const targetDivRef = activeEditorRef.current === 'fullscreen' ? fullscreenVisualRef : visualEditorRef;
    const sec = sanitizeUrl(btnUrl);
    const finalUrl = sec.isSafe && sec.sanitizedUrl !== '#' ? sec.sanitizedUrl : btnUrl;
    if (editorMode === 'visual') {
      if (isButtonEditing && editingButtonNode) {
        editingButtonNode.setAttribute('data-label', btnLabel);
        editingButtonNode.setAttribute('data-url', finalUrl);
        editingButtonNode.setAttribute('data-variant', btnVariant);
        editingButtonNode.setAttribute('data-size', btnSize);
        editingButtonNode.className = `rich-visual-badge rich-btn-${btnVariant} rich-btn-size-${btnSize}`;
        editingButtonNode.innerHTML = `<span>${escapeHtml(btnLabel)}</span>`;
        isInternalUpdateRef.current = true;
        handleVisualInput(targetDivRef);
      } else {
        const btn = document.createElement('span');
        btn.setAttribute('data-rich-type', 'button');
        btn.setAttribute('data-label', btnLabel);
        btn.setAttribute('data-url', finalUrl);
        btn.setAttribute('data-variant', btnVariant);
        btn.setAttribute('data-size', btnSize);
        btn.setAttribute('contenteditable', 'false');
        btn.className = `rich-visual-badge rich-btn-${btnVariant} rich-btn-size-${btnSize}`;
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
      applyFormatToRef(ref, '\n', '\n', `[button:${btnLabel}|${btnUrl}|${btnVariant}|${btnSize}]`);
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
          color: var(--text-muted, #64748b);
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
          color: var(--primary, #1e3a8a);
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
          background-color: var(--primary-glow, rgba(30, 58, 138, 0.12));
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
          background: linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%);
          color: #ffffff;
          box-shadow: 0 2px 8px var(--primary-glow, rgba(30, 58, 138, 0.3));
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
          background: var(--primary-glow, rgba(30, 58, 138, 0.08));
          color: var(--primary, #1e3a8a);
          border: 1px solid var(--primary, #1e3a8a);
        }
        .rich-btn-size-sm {
          padding: 0.2rem 0.5rem;
          font-size: 0.68rem;
          border-radius: 0.45rem;
        }
        .rich-btn-size-md {
          padding: 0.28rem 0.65rem;
          font-size: 0.74rem;
          border-radius: 0.6rem;
        }
        .rich-btn-size-lg {
          padding: 0.42rem 0.95rem;
          font-size: 0.85rem;
          border-radius: 0.75rem;
        }
        .rich-btn-size-xl {
          padding: 0.58rem 1.25rem;
          font-size: 0.96rem;
          border-radius: 0.85rem;
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
        backgroundColor: effectiveTheme.cardAlt,
        border: `1px solid ${isFocused ? 'var(--primary, #1e3a8a)' : borderDefault}`,
        borderBottom: `1px solid ${effectiveTheme.border}`,
        borderTopLeftRadius: '0.75rem',
        borderTopRightRadius: '0.75rem',
        gap: '0.3rem',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        transition: 'border-color 0.15s ease'
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
              ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
              : effectiveTheme.card,
            border: `1px solid ${activeFormats.bold 
              ? 'var(--primary, #1e3a8a)' 
              : effectiveTheme.border}`,
            color: activeFormats.bold 
              ? 'var(--primary, #1e3a8a)' 
              : effectiveTheme.textSecondary,
            fontSize: '0.78rem',
            fontWeight: activeFormats.bold ? 800 : 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: activeFormats.bold ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
              ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
              : effectiveTheme.card,
            border: `1px solid ${activeFormats.italic 
              ? 'var(--primary, #1e3a8a)' 
              : effectiveTheme.border}`,
            color: activeFormats.italic 
              ? 'var(--primary, #1e3a8a)' 
              : effectiveTheme.textSecondary,
            fontSize: '0.78rem',
            fontWeight: activeFormats.italic ? 800 : 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: activeFormats.italic ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
              ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
              : effectiveTheme.card,
            border: `1px solid ${activeFormats.link 
              ? 'var(--primary, #1e3a8a)' 
              : effectiveTheme.border}`,
            color: 'var(--primary, #1e3a8a)',
            fontSize: '0.78rem',
            fontWeight: activeFormats.link ? 800 : 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            boxShadow: activeFormats.link ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
              ? 'var(--primary-glow, rgba(30, 58, 138, 0.2))'
              : effectiveTheme.card,
            border: `1px solid ${activeFormats.button ? 'var(--primary, #1e3a8a)' : effectiveTheme.border}`,
            color: 'var(--primary, #1e3a8a)',
            fontSize: '0.78rem',
            fontWeight: activeFormats.button ? 800 : 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            boxShadow: activeFormats.button ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
            backgroundColor: editorMode === 'visual' ? 'var(--primary-glow, rgba(30, 58, 138, 0.12))' : effectiveTheme.card,
            border: `1px solid ${editorMode === 'visual' ? 'var(--primary, #1e3a8a)' : effectiveTheme.border}`,
            color: editorMode === 'visual' ? 'var(--primary, #1e3a8a)' : effectiveTheme.textSecondary,
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
              backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.12))',
              border: '1px solid var(--primary, #1e3a8a)',
              color: 'var(--primary, #1e3a8a)',
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
            setIsFocused(true);
            activeEditorRef.current = 'standard';
            updateActiveFormats();
          }}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            minHeight: minHeight || '110px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.75rem',
            borderBottomRightRadius: '0.75rem',
            backgroundColor: inputBg,
            border: `1px solid ${isFocused ? 'var(--primary, #1e3a8a)' : inputBorder}`,
            boxShadow: isFocused ? '0 0 0 3px var(--primary-glow, rgba(30, 58, 138, 0.15))' : 'none',
            color: textPrimary,
            fontSize: '0.84rem',
            lineHeight: 1.6,
            padding: '0.7rem 0.85rem',
            boxSizing: 'border-box',
            overflowY: 'auto',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
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
            setIsFocused(true);
            activeEditorRef.current = 'standard';
            updateActiveFormats();
          }}
          onBlur={() => setIsFocused(false)}
          required={required}
          style={{
            width: '100%',
            minHeight: minHeight || '110px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.75rem',
            borderBottomRightRadius: '0.75rem',
            backgroundColor: inputBg,
            border: `1px solid ${isFocused ? 'var(--primary, #1e3a8a)' : inputBorder}`,
            boxShadow: isFocused ? '0 0 0 3px var(--primary-glow, rgba(30, 58, 138, 0.15))' : 'none',
            color: textPrimary,
            fontSize: '0.82rem',
            lineHeight: 1.5,
            padding: '0.65rem 0.75rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
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
          id="rich-textarea-fullscreen-portal"
          className="zen-fullscreen-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseFullscreen(e);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            backgroundColor: effectiveTheme.modalOverlay || 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100vw',
              maxWidth: '100vw',
              height: '100dvh',
              maxHeight: '100dvh',
              minHeight: '100dvh',
              backgroundColor: effectiveTheme.modalBg,
              borderRadius: 0,
              border: 'none',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              boxSizing: 'border-box',
              margin: 0,
              padding: 0
            }}
          >
            {/* Zen Header: Pure Clean Title (No Minimize/Close buttons on mobile) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              backgroundColor: effectiveTheme.surface,
              borderBottom: `1px solid ${effectiveTheme.border}`,
              gap: '0.65rem',
              flexShrink: 0
            }}>
              {/* Icon + Title */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary-glow, rgba(30, 58, 138, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #1e3a8a)',
                flexShrink: 0
              }}>
                <Edit3 size={15} />
              </div>
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 800,
                color: textPrimary,
                lineHeight: 1.25,
                wordBreak: 'break-word',
                flex: 1
              }}>
                {condenseMobileTitle(label)}
              </span>
            </div>

            {/* Zen Editor Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 1.1rem',
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
                    ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
                    : effectiveTheme.card,
                  border: `1px solid ${activeFormats.bold 
                    ? 'var(--primary, #1e3a8a)' 
                    : effectiveTheme.border}`,
                  color: activeFormats.bold 
                    ? 'var(--primary, #1e3a8a)' 
                    : effectiveTheme.textSecondary,
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.bold ? 800 : 700,
                  cursor: 'pointer',
                  boxShadow: activeFormats.bold ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
                    ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
                    : effectiveTheme.card,
                  border: `1px solid ${activeFormats.italic 
                    ? 'var(--primary, #1e3a8a)' 
                    : effectiveTheme.border}`,
                  color: activeFormats.italic 
                    ? 'var(--primary, #1e3a8a)' 
                    : effectiveTheme.textSecondary,
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.italic ? 800 : 700,
                  cursor: 'pointer',
                  boxShadow: activeFormats.italic ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
                    ? 'var(--primary-glow, rgba(30, 58, 138, 0.18))' 
                    : effectiveTheme.card,
                  border: `1px solid ${activeFormats.link 
                    ? 'var(--primary, #1e3a8a)' 
                    : effectiveTheme.border}`,
                  color: 'var(--primary, #1e3a8a)',
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.link ? 800 : 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: activeFormats.link ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
                    ? 'var(--primary-glow, rgba(30, 58, 138, 0.2))'
                    : effectiveTheme.card,
                  border: `1px solid ${activeFormats.button ? 'var(--primary, #1e3a8a)' : effectiveTheme.border}`,
                  color: 'var(--primary, #1e3a8a)',
                  fontSize: '0.78rem',
                  fontWeight: activeFormats.button ? 800 : 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  boxShadow: activeFormats.button ? '0 0 0 1px var(--primary-glow, rgba(30, 58, 138, 0.25))' : 'none',
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
                  backgroundColor: editorMode === 'visual' ? 'var(--primary-glow, rgba(30, 58, 138, 0.12))' : effectiveTheme.card,
                  border: `1px solid ${editorMode === 'visual' ? 'var(--primary, #1e3a8a)' : effectiveTheme.border}`,
                  color: editorMode === 'visual' ? 'var(--primary, #1e3a8a)' : effectiveTheme.textSecondary,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              >
                {editorMode === 'visual' ? <Type size={12} /> : <FileText size={12} />}
                <span>{editorMode === 'visual' ? 'Visual' : 'Markdown'}</span>
              </button>

              {/* Quick Minimize Action */}
              <button
                type="button"
                title="Kecilkan Layar Penuh (Minimize)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCloseFullscreen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.28rem 0.65rem',
                  borderRadius: '0.4rem',
                  backgroundColor: effectiveTheme.card,
                  border: `1px solid ${effectiveTheme.border}`,
                  color: effectiveTheme.textSecondary,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = effectiveTheme.textSecondary;
                  e.currentTarget.style.borderColor = effectiveTheme.border;
                }}
              >
                <Minimize2 size={12} />
                <span>Kecilkan</span>
              </button>
            </div>

            {/* Fullscreen Body */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.1rem',
              overflowY: 'auto',
              backgroundColor: effectiveTheme.editorBg || effectiveTheme.modalBg || 'var(--bg-card, #ffffff)'
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
              padding: '0.85rem 1.25rem',
              backgroundColor: effectiveTheme.surface,
              borderTop: `1px solid ${effectiveTheme.border}`,
              gap: '0.75rem',
              flexShrink: 0
            }}>
              {/* Left: Word and Character Counts */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: textMuted,
                overflow: 'hidden'
              }}>
                <span style={{
                  padding: '0.22rem 0.55rem',
                  borderRadius: '0.45rem',
                  backgroundColor: effectiveTheme.cardAlt,
                  border: `1px solid ${effectiveTheme.border}`,
                  color: textSecondary,
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {wordCount} kata
                </span>
                <span>•</span>
                <span style={{
                  padding: '0.22rem 0.55rem',
                  borderRadius: '0.45rem',
                  backgroundColor: effectiveTheme.cardAlt,
                  border: `1px solid ${effectiveTheme.border}`,
                  color: textSecondary,
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {charCount} karakter
                </span>
              </div>

              {/* Right: Selesai Button */}
              <button
                type="button"
                onClick={handleCloseFullscreen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '0.65rem',
                  background: 'linear-gradient(135deg, var(--primary, #1e3a8a) 0%, var(--primary-hover, #172554) 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px var(--primary-glow, rgba(30, 58, 138, 0.35))',
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
        initialSize={modalInitialSize}
        isEditing={isButtonEditing}
        theme={effectiveTheme}
        isDark={activeIsDark}
      />
    </div>
  );
};
