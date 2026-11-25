export interface CustomDomainMeta {
  host: string | null;
  slug: string | null;
}

/**
 * Reads CSP-safe custom domain metadata injected by the Go SPA handler when a request
 * arrives via a merchant's verified custom domain rather than the canonical platform host.
 */
export function getCustomDomainMeta(): CustomDomainMeta {
  if (typeof document === 'undefined') {
    return { host: null, slug: null };
  }
  const slugEl = document.querySelector('meta[name="catavor-custom-domain-slug"]');
  const hostEl = document.querySelector('meta[name="catavor-custom-domain"]');
  const slug = slugEl?.getAttribute('content')?.trim().toLowerCase() || null;
  const host = hostEl?.getAttribute('content')?.trim().toLowerCase() || null;
  return { host, slug };
}

/**
 * Returns the canonical public storefront URL for a store, preferring an active custom domain.
 */
export function buildCanonicalStoreURL(
  slug: string,
  customDomain?: string | null,
  customDomainStatus?: string | null
): string {
  const cleanDomain = (customDomain || '').trim().toLowerCase();
  if (cleanDomain && customDomainStatus === 'active') {
    return `https://${cleanDomain}`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://catavor.com';
  return `${origin}/${slug}`;
}
