/**
 * URL Security & Sanitization Utilities
 * Provides strict protocol whitelisting, dynamic master domain whitelist verifications,
 * user-level trusted domain preferences, and protection against XSS and Reverse Tabnabbing.
 */

// Whitelist of allowed protocols
const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * Master Baseline Whitelist of trusted domains / ecosystem partners (Fallback when offline).
 */
export const MASTER_SAFE_DOMAINS: string[] = [
  // Catavor platform ecosystem
  'catavor.com',
  'catavor.id',
  'localhost',
  '127.0.0.1',
  
  // Google & Workspace ecosystem
  'google.com',
  'gemini.google.com',
  'docs.google.com',
  'drive.google.com',
  'mail.google.com',
  'meet.google.com',
  'maps.google.com',
  'play.google.com',
  'youtube.com',
  'youtu.be',
  'support.google.com',

  // Messaging & Customer Service Channels
  'wa.me',
  'whatsapp.com',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'telegram.org',
  't.me',

  // Social Media & Marketing Channels
  'instagram.com',
  'facebook.com',
  'fb.me',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'threads.net',
  'pinterest.com',

  // Productivity, Media & Developer Tools
  'canva.com',
  'zoom.us',
  'github.com',
  'gitlab.com',
  'apple.com',
  'apps.apple.com',
  
  // Payment Gateways & Banking
  'midtrans.com',
  'xendit.co',
  'bca.co.id',
  'mandiri.co.id',
  'bri.co.id',
  'bni.co.id'
];

// Dynamic runtime cache
let dynamicSafeDomainsCache: string[] = [];
let isFetchingDomains = false;

/**
 * Loads dynamic safe domains from the backend API and synchronizes with localStorage.
 */
export async function loadDynamicSafeDomains(forceRefresh: boolean = false): Promise<string[]> {
  if (dynamicSafeDomainsCache.length > 0 && !forceRefresh) {
    return dynamicSafeDomainsCache;
  }

  // 1. Read from localStorage cache for instant zero-latency boot
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('catavor_safe_domains');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dynamicSafeDomainsCache = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  if (isFetchingDomains) return dynamicSafeDomainsCache;
  isFetchingDomains = true;

  try {
    const res = await fetch('/api/safe-domains');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        dynamicSafeDomainsCache = json.data;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('catavor_safe_domains', JSON.stringify(json.data));
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // Network fallback: keeps cache or baseline
  } finally {
    isFetchingDomains = false;
  }

  return dynamicSafeDomainsCache;
}

// Auto-trigger background hydration in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    loadDynamicSafeDomains();
  }, 100);
}

/**
 * User-level trusted domains persistence in localStorage (when user clicks "Jangan ingatkan saya lagi untuk domain ini").
 */
const USER_TRUSTED_STORAGE_KEY = 'catavor_user_trusted_domains';

export function getUserTrustedDomains(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_TRUSTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addUserTrustedDomain(domain: string): void {
  if (typeof window === 'undefined' || !domain) return;
  const clean = cleanDomainString(domain);
  if (!clean) return;

  try {
    const current = getUserTrustedDomains();
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      localStorage.setItem(USER_TRUSTED_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export function removeUserTrustedDomain(domain: string): void {
  if (typeof window === 'undefined' || !domain) return;
  const clean = cleanDomainString(domain);
  try {
    const current = getUserTrustedDomains();
    const updated = current.filter(d => d !== clean);
    localStorage.setItem(USER_TRUSTED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Extracts and cleans hostname / domain from URL or string.
 */
export function cleanDomainString(urlOrHostname: string): string {
  if (!urlOrHostname) return '';
  let host = urlOrHostname.trim().toLowerCase();

  try {
    if (host.includes('://')) {
      host = new URL(host).hostname.toLowerCase();
    } else if (host.includes('/')) {
      host = host.split('/')[0].toLowerCase();
    }
  } catch {
    // Keep host as-is
  }

  // Remove port if present (e.g. localhost:8000 -> localhost)
  host = host.split(':')[0];
  // Remove www. prefix for consistent comparison
  if (host.startsWith('www.')) {
    host = host.substring(4);
  }
  return host;
}

/**
 * Checks if a given hostname or URL matches the Master Safe Domains whitelist (Static + Dynamic).
 */
export function isMasterSafeDomain(urlOrHostname: string): boolean {
  if (!urlOrHostname) return false;
  const host = cleanDomainString(urlOrHostname);
  if (!host) return false;

  const allDomains = Array.from(new Set([...MASTER_SAFE_DOMAINS, ...dynamicSafeDomainsCache]));

  return allDomains.some(trusted => {
    const cleanTrusted = cleanDomainString(trusted);
    if (!cleanTrusted) return false;
    if (host === cleanTrusted) return true;
    if (host.endsWith('.' + cleanTrusted)) return true;
    return false;
  });
}

/**
 * Checks if domain is trusted by the user (remembered preference).
 */
export function isUserTrustedDomain(urlOrHostname: string): boolean {
  if (!urlOrHostname) return false;
  const host = cleanDomainString(urlOrHostname);
  if (!host) return false;

  const userDomains = getUserTrustedDomains();
  return userDomains.some(trusted => {
    const cleanTrusted = cleanDomainString(trusted);
    if (!cleanTrusted) return false;
    if (host === cleanTrusted) return true;
    if (host.endsWith('.' + cleanTrusted)) return true;
    return false;
  });
}

/**
 * Returns true if domain is either in Master Whitelist or in User-Trusted list.
 */
export function isTrustedDomain(urlOrHostname: string): boolean {
  return isMasterSafeDomain(urlOrHostname) || isUserTrustedDomain(urlOrHostname);
}

export interface SanitizedUrlResult {
  isSafe: boolean;
  sanitizedUrl: string;
  isExternal: boolean;
  isTrustedDomain: boolean;
  protocol: string;
  hostname: string;
}

/**
 * Validates and sanitizes a URL string.
 * Strips dangerous schemes like javascript:, data:, vbscript:, file:, etc.
 */
export function sanitizeUrl(rawUrl?: string): SanitizedUrlResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
  }

  // 1. Internal Relative Paths (/path, ?query, #anchor) are always safe and internal
  if (trimmed.startsWith('/') || trimmed.startsWith('?') || trimmed.startsWith('#')) {
    if (trimmed.startsWith('//')) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: true, isTrustedDomain: false, protocol: '', hostname: '' };
    }
    return {
      isSafe: true,
      sanitizedUrl: trimmed,
      isExternal: false,
      isTrustedDomain: true,
      protocol: 'internal',
      hostname: ''
    };
  }

  // 2. Absolute URLs with protocols
  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const protocol = parsed.protocol.toLowerCase();

    // Block dangerous protocols explicitly
    if (
      protocol === 'javascript:' ||
      protocol === 'data:' ||
      protocol === 'vbscript:' ||
      protocol === 'file:' ||
      protocol === 'blob:'
    ) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol, hostname: parsed.hostname };
    }

    // Check against allowed protocols
    if (!ALLOWED_PROTOCOLS.includes(protocol)) {
      return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol, hostname: parsed.hostname };
    }

    const currentHost = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
    const targetHost = parsed.host.toLowerCase();
    const isExternal = targetHost !== currentHost && targetHost !== '';
    const trusted = isTrustedDomain(parsed.hostname);

    return {
      isSafe: true,
      sanitizedUrl: parsed.href,
      isExternal,
      isTrustedDomain: trusted || !isExternal,
      protocol,
      hostname: parsed.hostname
    };
  } catch {
    // Fallback: Check if it's a plain domain like "example.com" or "www.example.com"
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      const fixedUrl = 'https://' + trimmed;
      try {
        const parsed = new URL(fixedUrl);
        const currentHost = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
        const targetHost = parsed.host.toLowerCase();
        const isExternal = targetHost !== currentHost;
        const trusted = isTrustedDomain(parsed.hostname);

        return {
          isSafe: true,
          sanitizedUrl: fixedUrl,
          isExternal,
          isTrustedDomain: trusted || !isExternal,
          protocol: 'https:',
          hostname: parsed.hostname
        };
      } catch {
        return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
      }
    }

    return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
  }
}

export interface UrlSecurityCheckResult {
  isSafe: boolean;
  sanitizedUrl: string;
  isExternal: boolean;
  domain: string;
  isMasterTrusted: boolean;
  isUserTrusted: boolean;
  isTrusted: boolean;
  requiresWarning: boolean;
}

/**
 * Full security analysis for opening external links.
 */
export function checkUrlSecurity(url: string): UrlSecurityCheckResult {
  const { isSafe, sanitizedUrl, isExternal, hostname } = sanitizeUrl(url);
  if (!isSafe || sanitizedUrl === '#' || !isExternal) {
    return {
      isSafe,
      sanitizedUrl,
      isExternal: false,
      domain: '',
      isMasterTrusted: true,
      isUserTrusted: false,
      isTrusted: true,
      requiresWarning: false
    };
  }

  const domain = cleanDomainString(hostname || sanitizedUrl);
  const isMasterTrusted = isMasterSafeDomain(domain);
  const isUserTrusted = isUserTrustedDomain(domain);
  const isTrusted = isMasterTrusted || isUserTrusted;
  const requiresWarning = isExternal && !isTrusted;

  return {
    isSafe: true,
    sanitizedUrl,
    isExternal: true,
    domain,
    isMasterTrusted,
    isUserTrusted,
    isTrusted,
    requiresWarning
  };
}

/**
 * Safely opens a URL.
 * If external & untrusted, triggers confirmation prompt.
 * If external & trusted, opens directly in new tab.
 * If internal, executes client router callback.
 */
export function safeOpenUrl(
  url: string,
  onInternalNavigate?: (path: string) => void,
  onExternalConfirmPrompt?: (url: string) => void
) {
  const security = checkUrlSecurity(url);
  if (!security.isSafe || security.sanitizedUrl === '#') return;

  if (security.isExternal) {
    if (security.requiresWarning && onExternalConfirmPrompt) {
      onExternalConfirmPrompt(security.sanitizedUrl);
    } else {
      const newWin = window.open(security.sanitizedUrl, '_blank', 'noopener,noreferrer');
      if (newWin) newWin.opener = null;
    }
  } else {
    if (onInternalNavigate) {
      onInternalNavigate(security.sanitizedUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = security.sanitizedUrl;
    }
  }
}
