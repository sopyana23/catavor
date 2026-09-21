/**
 * URL Security & Sanitization Utilities
 * Provides strict protocol whitelisting and protection against XSS and Reverse Tabnabbing.
 */

const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:'];

export interface SanitizedUrlResult {
  isSafe: boolean;
  sanitizedUrl: string;
  isExternal: boolean;
  protocol: string;
}

export function sanitizeUrl(rawUrl?: string): SanitizedUrlResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol: '' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol: '' };
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('?') || trimmed.startsWith('#')) {
    if (trimmed.startsWith('//')) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: true, protocol: '' };
    }
    return {
      isSafe: true,
      sanitizedUrl: trimmed,
      isExternal: false,
      protocol: 'internal'
    };
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const protocol = parsed.protocol.toLowerCase();

    if (
      protocol === 'javascript:' ||
      protocol === 'data:' ||
      protocol === 'vbscript:' ||
      protocol === 'file:' ||
      protocol === 'blob:'
    ) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol };
    }

    if (!ALLOWED_PROTOCOLS.includes(protocol)) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol };
    }

    const currentHost = window.location.host.toLowerCase();
    const targetHost = parsed.host.toLowerCase();
    const isExternal = targetHost !== currentHost && targetHost !== '';

    return {
      isSafe: true,
      sanitizedUrl: parsed.href,
      isExternal,
      protocol
    };
  } catch (e) {
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      const fixedUrl = 'https://' + trimmed;
      try {
        const parsed = new URL(fixedUrl);
        const currentHost = window.location.host.toLowerCase();
        const targetHost = parsed.host.toLowerCase();
        return {
          isSafe: true,
          sanitizedUrl: fixedUrl,
          isExternal: targetHost !== currentHost,
          protocol: 'https:'
        };
      } catch {
        return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol: '' };
      }
    }

    return { isSafe: false, sanitizedUrl: '#', isExternal: false, protocol: '' };
  }
}

export function safeOpenUrl(
  url: string,
  onInternalNavigate?: (path: string) => void,
  onExternalConfirmPrompt?: (url: string) => void
) {
  const { isSafe, sanitizedUrl, isExternal } = sanitizeUrl(url);
  if (!isSafe || sanitizedUrl === '#') return;

  if (isExternal) {
    if (onExternalConfirmPrompt) {
      onExternalConfirmPrompt(sanitizedUrl);
    } else {
      const newWin = window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');
      if (newWin) newWin.opener = null;
    }
  } else {
    if (onInternalNavigate) {
      onInternalNavigate(sanitizedUrl);
    } else {
      window.location.href = sanitizedUrl;
    }
  }
}
