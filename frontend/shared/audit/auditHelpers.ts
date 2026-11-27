export interface AuditCategoryOption {
  key: string;
  label: string;
  shortLabel?: string;
}

export interface AuditRoleOption {
  value: string;
  label: string;
}

export const PLATFORM_AUDIT_CATEGORIES: AuditCategoryOption[] = [
  { key: 'all', label: 'Semua Kategori', shortLabel: 'Semua' },
  { key: 'security', label: 'Keamanan & Akses', shortLabel: 'Keamanan' },
  { key: 'catalog', label: 'Katalog & Produk', shortLabel: 'Katalog' },
  { key: 'store', label: 'Toko & Merchant', shortLabel: 'Toko' },
  { key: 'billing', label: 'Finansial & Billing', shortLabel: 'Finansial' },
  { key: 'moderation', label: 'Moderasi & Laporan', shortLabel: 'Moderasi' },
  { key: 'superadmin', label: 'Aksi Superadmin', shortLabel: 'Superadmin' },
  { key: 'market_intel', label: 'Riset Pasar B2B', shortLabel: 'Riset Pasar' },
  { key: 'system', label: 'Sistem & Otomasi', shortLabel: 'Sistem' },
];

export const PLATFORM_AUDIT_ROLES: AuditRoleOption[] = [
  { value: 'all', label: 'Semua Aktor' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'staff', label: 'Staf Platform' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'system', label: 'Sistem Otomatis' },
];

export const MERCHANT_AUDIT_CATEGORIES: AuditCategoryOption[] = [
  { key: 'all', label: 'Semua Kategori', shortLabel: 'Semua' },
  { key: 'security', label: 'Autentikasi', shortLabel: 'Autentikasi' },
  { key: 'catalog', label: 'Item Katalog', shortLabel: 'Produk' },
  { key: 'store', label: 'Profil & Katalog', shortLabel: 'Katalog' },
  { key: 'billing', label: 'Paket & Langganan', shortLabel: 'Paket' },
  { key: 'moderation', label: 'Moderasi & Kepatuhan', shortLabel: 'Moderasi' },
];

export interface AuditChainVerifyReport {
  intact: boolean;
  checked_count: number;
  chained_count: number;
  unchained_legacy_count: number;
  last_chain_seq: number;
  head_hash?: string;
  broken_at_id?: number;
  reason: string;
}

export function formatAuditDateTimeWIB(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatAuditShortDateTimeWIB(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function verifyAuditChainApi(
  token: string,
  fetcher: typeof fetch = window.fetch.bind(window)
): Promise<AuditChainVerifyReport> {
  const res = await fetcher('/api/admin/audit-logs/verify', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json?.data) {
    throw new Error(json?.message || `Gagal memverifikasi rantai audit (HTTP ${res.status})`);
  }
  return json.data as AuditChainVerifyReport;
}

export interface ExportAuditLogsOptions {
  endpoint: string;
  token: string;
  format?: 'csv' | 'json';
  category?: string;
  role?: string;
  q?: string;
  storeSlug?: string;
  fetcher?: typeof fetch;
}

export async function exportAuditLogsFile({
  endpoint,
  token,
  format = 'csv',
  category = 'all',
  role = 'all',
  q = '',
  storeSlug = '',
  fetcher = window.fetch.bind(window),
}: ExportAuditLogsOptions): Promise<string> {
  const params = new URLSearchParams({ format });
  if (category && category !== 'all') params.set('category', category);
  if (role && role !== 'all') params.set('role', role);
  if (q && q.trim()) params.set('q', q.trim());

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (storeSlug) {
    headers['X-Store-Slug'] = storeSlug;
  }

  const res = await fetcher(`${endpoint}?${params.toString()}`, { headers });
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Gagal mengekspor audit log (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fallbackName = `catavor-audit-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${format}`;
  const filename = match?.[1]?.trim() || fallbackName;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return filename;
}
