/**
 * URL Security & Sanitization Utilities (Tablet)
 * Provides strict protocol whitelisting, dynamic master domain whitelist verifications,
 * user-level trusted domain preferences, and protection against XSS and Reverse Tabnabbing.
 */

// Whitelist of allowed protocols
const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * Master Baseline Whitelist of trusted domains / ecosystem partners (Fallback when offline).
 */
export const MASTER_SAFE_DOMAINS: string[] = [
  // Catavor platform ecosystem & internal scope
  'catavor.com',
  'catavor.id',
  'localhost',
  '127.0.0.1'
];

// Dynamic runtime cache initialized synchronously from localStorage for instant zero-latency boot
const getInitialCachedSafeDomains = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem('catavor_safe_domains');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
};

let dynamicSafeDomainsCache: string[] = getInitialCachedSafeDomains();
let isFetchingDomains = false;

/**
 * Loads dynamic safe domains from the backend API and synchronizes with localStorage.
 */
export async function loadDynamicSafeDomains(forceRefresh: boolean = false): Promise<string[]> {
  if (dynamicSafeDomainsCache.length > 0 && !forceRefresh) {
    return dynamicSafeDomainsCache;
  }

  // 1. Read from localStorage cache for instant zero-latency boot
  let lastFetchTime = 0;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('catavor_safe_domains');
      const cachedTime = localStorage.getItem('catavor_safe_domains_time');
      if (cachedTime) lastFetchTime = parseInt(cachedTime, 10) || 0;
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

  // 30 Minutes Cache TTL: Skip network hit if cached within 30 minutes
  const now = Date.now();
  if (dynamicSafeDomainsCache.length > 0 && (now - lastFetchTime < 30 * 60 * 1000)) {
    return dynamicSafeDomainsCache;
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
            localStorage.setItem('catavor_safe_domains_time', String(Date.now()));
            window.dispatchEvent(new CustomEvent('catavor_safe_domains_updated', { detail: json.data }));
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
  }, 300);
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
 * Detects if a string resembles a web domain (e.g. google.com, www.example.org, sub.site.co.id, localhost:3000)
 */
export function isDomainLike(str: string): boolean {
  if (!str) return false;
  const clean = str.trim().toLowerCase();
  
  // Exclude explicit relative paths and anchors
  if (clean.startsWith('/') || clean.startsWith('?') || clean.startsWith('#')) {
    return false;
  }
  
  // Extract host part (before first slash, query, or hash)
  const hostPart = clean.split(/[/?#]/)[0].trim();
  if (!hostPart) return false;

  // Starts with www.
  if (hostPart.startsWith('www.')) return true;

  // Localhost (with or without port)
  if (hostPart === 'localhost' || hostPart.startsWith('localhost:')) return true;

  // IPv4 address with optional port
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(hostPart)) return true;

  // Standard domain name: at least one dot, valid TLD (2+ chars)
  // e.g. example.com, shopee.co.id, catavor.id, api.v1.service.org
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(:\d+)?$/.test(hostPart)) {
    return true;
  }

  return false;
}

/**
 * Validates and sanitizes a URL string.
 * Strips dangerous schemes like javascript:, data:, vbscript:, file:, etc.
 * Automatically normalizes naked domains (e.g. "google.com") to "https://google.com".
 */
export function sanitizeUrl(rawUrl?: string): SanitizedUrlResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isSafe: false, sanitizedUrl: '#', isExternal: false, isTrustedDomain: false, protocol: '', hostname: '' };
  }

  // 1. Block protocol-relative URLs (e.g. //evil.com)
  if (trimmed.startsWith('//')) {
    return { isSafe: false, sanitizedUrl: '#', isExternal: true, isTrustedDomain: false, protocol: '', hostname: '' };
  }

  // 2. Internal Relative Paths (/path, ?query, #anchor) are always safe and internal
  if (trimmed.startsWith('/') || trimmed.startsWith('?') || trimmed.startsWith('#')) {
    return {
      isSafe: true,
      sanitizedUrl: trimmed,
      isExternal: false,
      isTrustedDomain: true,
      protocol: 'internal',
      hostname: ''
    };
  }

  // 3. Normalization: If string looks like a domain without protocol or relative path without leading slash
  let urlToParse = trimmed;
  // If no scheme/protocol prefix (colon not followed immediately by digits):
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d)/.test(trimmed)) {
    if (isDomainLike(trimmed)) {
      urlToParse = (trimmed.toLowerCase().startsWith('localhost') || trimmed.startsWith('127.0.0.1'))
        ? 'http://' + trimmed
        : 'https://' + trimmed;
    } else {
      // Relative path without leading slash (e.g. "admin/products" or "help")
      return {
        isSafe: true,
        sanitizedUrl: '/' + trimmed,
        isExternal: false,
        isTrustedDomain: true,
        protocol: 'internal',
        hostname: ''
      };
    }
  }

  // 4. Absolute URLs with protocols
  try {
    const parsed = new URL(urlToParse);
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

    // Direct protocols
    if (protocol === 'mailto:' || protocol === 'tel:') {
      return {
        isSafe: true,
        sanitizedUrl: parsed.href,
        isExternal: false,
        isTrustedDomain: true,
        protocol,
        hostname: ''
      };
    }

    const currentHost = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
    const currentHostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const targetHost = parsed.host.toLowerCase();
    const targetHostname = parsed.hostname.toLowerCase();

    // Determine if external:
    // It is internal ONLY IF host or hostname matches current window host or hostname
    const isSameHost = currentHost && (targetHost === currentHost || targetHostname === currentHostname);
    const isExternal = !isSameHost;
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
    if (security.requiresWarning) {
      if (onExternalConfirmPrompt) {
        onExternalConfirmPrompt(security.sanitizedUrl);
        return;
      }
      if (typeof window !== 'undefined') {
        const evt = new CustomEvent('catavor_prompt_external_url', {
          detail: { url: security.sanitizedUrl }
        });
        window.dispatchEvent(evt);
        return;
      }
    }
    const newWin = window.open(security.sanitizedUrl, '_blank', 'noopener,noreferrer');
    if (newWin) newWin.opener = null;
  } else {
    if (onInternalNavigate) {
      onInternalNavigate(security.sanitizedUrl);
    } else if (typeof window !== 'undefined') {
      if (security.sanitizedUrl.startsWith('/')) {
        window.history.pushState({}, '', security.sanitizedUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = security.sanitizedUrl;
      }
    }
  }
}
