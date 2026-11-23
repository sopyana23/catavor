export type TelemetryPeriod = '7d' | '30d' | '90d';

export interface TelemetryDimensionItem {
  dimension_value: string;
  name: string;
  views: number;
  percentage: number;
  conversion_rate_percent?: number;
  unique_visitors?: number;
  total_actions?: number;
}

export interface GlobalAnalyticsOverview {
  period: TelemetryPeriod;
  days: number;
  total_views: number;
  total_unique_visitors: number;
  total_product_views: number;
  total_bounces: number;
  bounce_rate_percent: number;
  total_actions: number;
  conversion_rate: number;
  channels: {
    direct_wa: number;
    marketplace: number;
    rekber: number;
    video: number;
  };
  trends: Array<{
    date: string;
    store_views: number;
    unique_visitors: number;
    total_actions: number;
  }>;
  top_stores: Array<{
    store_id: number;
    slug: string;
    store_title: string;
    views: number;
    total_actions: number;
  }>;
  devices: TelemetryDimensionItem[];
  operating_systems: TelemetryDimensionItem[];
  browsers: TelemetryDimensionItem[];
  locations: TelemetryDimensionItem[];
  hourly_heatmap: Array<{
    hour: string;
    views: number;
  }>;
  campaigns?: TelemetryDimensionItem[];
  recent_visitors: Array<{
    id: number;
    store_id: number;
    store_slug: string;
    event: string;
    product_name?: string;
    source: string;
    device_type: string;
    browser: string;
    os: string;
    city: string;
    time_ago: string;
  }>;
}

export interface TrendingKeywordItem {
  keyword: string;
  product_type: string;
  search_volume: number;
  zero_count: number;
  ctr: number;
}

export interface DemandGapItem {
  keyword: string;
  product_type: string;
  zero_result_count: number;
  total_searches: number;
}

export interface CategoryTrendItem {
  category_id: number;
  category_name: string;
  product_count: number;
  unique_store_count: number;
  total_views: number;
  total_actions: number;
  conversion_rate: number;
  average_price: number;
}

export interface PriceBenchmarkItem {
  product_type: string;
  category_name: string;
  min_price: number;
  p25_price: number;
  avg_price: number;
  median_price: number;
  p75_price: number;
  max_price: number;
  sample_count: number;
  unique_store_count: number;
  is_k_anonymous: boolean;
}

export interface DailyTrendPoint {
  date: string;
  store_views: number;
  product_views: number;
  total_actions: number;
}

export interface PriceBracketMetric {
  product_type: string;
  bracket: string;
  views: number;
  total_actions: number;
  conversion_rate: number;
}

export interface GeoIndustryMetric {
  city: string;
  product_type: string;
  views: number;
  total_actions: number;
  conversion_rate: number;
}

export interface DeviceIndustryMetric {
  device_os: string;
  product_type: string;
  views: number;
  total_actions: number;
  conversion_rate: number;
}

export interface CatalogQualityMetrics {
  multi_photo_conversion_rate: number;
  single_photo_conversion_rate: number;
  video_boost_multiplier: number;
  rekber_trust_adoption_rate: number;
}

export interface SupplyDynamicsMetrics {
  price_increase_ratio: number;
  price_decrease_ratio: number;
  sold_out_velocity_avg_days: number;
  new_listings_30d: number;
}

export interface MarketIntelligenceData {
  total_active_stores: number;
  total_active_products: number;
  total_views_30d: number;
  total_actions_30d: number;
  overall_conversion_rate: number;
  k_anonymity_min_stores: number;
  channel_breakdown: {
    direct_wa_clicks: number;
    direct_wa_percent: number;
    marketplace_clicks: number;
    marketplace_percent: number;
    rekber_clicks: number;
    rekber_percent: number;
    video_views: number;
    video_views_percent: number;
    total_actions: number;
  };
  top_categories: CategoryTrendItem[];
  price_benchmarks: PriceBenchmarkItem[];
  trend_timeline: DailyTrendPoint[];
  price_bracket_elasticity: PriceBracketMetric[];
  geo_industry_matrix: GeoIndustryMetric[];
  device_industry_matrix: DeviceIndustryMetric[];
  catalog_quality_benchmarks: CatalogQualityMetrics;
  supply_side_dynamics: SupplyDynamicsMetrics;
  generated_at: string;
  data_privacy_notice: string;
}

export interface MarketIntelBundle {
  summary: MarketIntelligenceData;
  trendingKeywords: TrendingKeywordItem[];
  demandGaps: DemandGapItem[];
  partialWarning: string | null;
}

export const PRIVACY_BADGE_LABEL = 'K-Anonymity >= 3 Toko';

export const PRIVACY_COMPLIANCE_SUMMARY =
  'Seluruh data riset pasar diolah secara agregat murni tanpa memuat identitas pribadi (Zero-PII) sesuai UU No. 27 Tahun 2022 (UU PDP), dengan ambang privasi K-Anonymity minimal 3 toko unik per kategori.';

export const TELEMETRY_PRIVACY_SUMMARY =
  'Kepatuhan UU No. 27 Tahun 2022 (UU PDP): sistem telemetri menggunakan hash harian dengan garam kriptografi rotasi (HMAC-SHA256) tanpa menyimpan alamat IP mentah ataupun identitas pribadi pengguna.';

function toFiniteNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clampPercent(val: unknown): number {
  const num = toFiniteNumber(val, 0);
  if (num < 0) return 0;
  if (num > 100) return 100;
  return num;
}

function toArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function buildAuthHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extra ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function normalizeMarketIntelligenceData(raw: unknown): MarketIntelligenceData {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawChannel = (src.channel_breakdown && typeof src.channel_breakdown === 'object'
    ? src.channel_breakdown
    : {}) as Record<string, unknown>;
  const rawQuality = (src.catalog_quality_benchmarks && typeof src.catalog_quality_benchmarks === 'object'
    ? src.catalog_quality_benchmarks
    : {}) as Record<string, unknown>;
  const rawSupply = (src.supply_side_dynamics && typeof src.supply_side_dynamics === 'object'
    ? src.supply_side_dynamics
    : {}) as Record<string, unknown>;

  return {
    total_active_stores: toFiniteNumber(src.total_active_stores),
    total_active_products: toFiniteNumber(src.total_active_products),
    total_views_30d: toFiniteNumber(src.total_views_30d),
    total_actions_30d: toFiniteNumber(src.total_actions_30d),
    overall_conversion_rate: clampPercent(src.overall_conversion_rate),
    k_anonymity_min_stores: Math.max(3, toFiniteNumber(src.k_anonymity_min_stores, 3)),
    channel_breakdown: {
      direct_wa_clicks: toFiniteNumber(rawChannel.direct_wa_clicks),
      direct_wa_percent: clampPercent(rawChannel.direct_wa_percent),
      marketplace_clicks: toFiniteNumber(rawChannel.marketplace_clicks),
      marketplace_percent: clampPercent(rawChannel.marketplace_percent),
      rekber_clicks: toFiniteNumber(rawChannel.rekber_clicks),
      rekber_percent: clampPercent(rawChannel.rekber_percent),
      video_views: toFiniteNumber(rawChannel.video_views),
      video_views_percent: clampPercent(rawChannel.video_views_percent),
      total_actions: toFiniteNumber(rawChannel.total_actions),
    },
    top_categories: toArray<Record<string, unknown>>(src.top_categories).map((c) => ({
      category_id: toFiniteNumber(c.category_id),
      category_name: String(c.category_name || 'Umum'),
      product_count: toFiniteNumber(c.product_count),
      unique_store_count: toFiniteNumber(c.unique_store_count),
      total_views: toFiniteNumber(c.total_views),
      total_actions: toFiniteNumber(c.total_actions),
      conversion_rate: clampPercent(c.conversion_rate),
      average_price: toFiniteNumber(c.average_price),
    })),
    price_benchmarks: toArray<Record<string, unknown>>(src.price_benchmarks).map((p) => ({
      product_type: String(p.product_type || 'physical'),
      category_name: String(p.category_name || 'Umum'),
      min_price: toFiniteNumber(p.min_price),
      p25_price: toFiniteNumber(p.p25_price),
      avg_price: toFiniteNumber(p.avg_price),
      median_price: toFiniteNumber(p.median_price),
      p75_price: toFiniteNumber(p.p75_price),
      max_price: toFiniteNumber(p.max_price),
      sample_count: toFiniteNumber(p.sample_count),
      unique_store_count: toFiniteNumber(p.unique_store_count),
      is_k_anonymous: Boolean(p.is_k_anonymous ?? true),
    })),
    trend_timeline: toArray<Record<string, unknown>>(src.trend_timeline).map((t) => ({
      date: String(t.date || ''),
      store_views: toFiniteNumber(t.store_views),
      product_views: toFiniteNumber(t.product_views),
      total_actions: toFiniteNumber(t.total_actions),
    })),
    price_bracket_elasticity: toArray<Record<string, unknown>>(src.price_bracket_elasticity).map((pb) => ({
      product_type: String(pb.product_type || 'all'),
      bracket: String(pb.bracket || '-'),
      views: toFiniteNumber(pb.views),
      total_actions: toFiniteNumber(pb.total_actions),
      conversion_rate: clampPercent(pb.conversion_rate),
    })),
    geo_industry_matrix: toArray<Record<string, unknown>>(src.geo_industry_matrix).map((g) => ({
      city: String(g.city || 'Indonesia'),
      product_type: String(g.product_type || 'all'),
      views: toFiniteNumber(g.views),
      total_actions: toFiniteNumber(g.total_actions),
      conversion_rate: clampPercent(g.conversion_rate),
    })),
    device_industry_matrix: toArray<Record<string, unknown>>(src.device_industry_matrix).map((d) => ({
      device_os: String(d.device_os || '-'),
      product_type: String(d.product_type || 'all'),
      views: toFiniteNumber(d.views),
      total_actions: toFiniteNumber(d.total_actions),
      conversion_rate: clampPercent(d.conversion_rate),
    })),
    catalog_quality_benchmarks: {
      multi_photo_conversion_rate: clampPercent(rawQuality.multi_photo_conversion_rate),
      single_photo_conversion_rate: clampPercent(rawQuality.single_photo_conversion_rate),
      video_boost_multiplier: Math.max(0, toFiniteNumber(rawQuality.video_boost_multiplier, 1)),
      rekber_trust_adoption_rate: clampPercent(rawQuality.rekber_trust_adoption_rate),
    },
    supply_side_dynamics: {
      price_increase_ratio: clampPercent(rawSupply.price_increase_ratio),
      price_decrease_ratio: clampPercent(rawSupply.price_decrease_ratio),
      sold_out_velocity_avg_days: Math.max(0, toFiniteNumber(rawSupply.sold_out_velocity_avg_days)),
      new_listings_30d: toFiniteNumber(rawSupply.new_listings_30d),
    },
    generated_at: String(src.generated_at || ''),
    data_privacy_notice: String(src.data_privacy_notice || PRIVACY_COMPLIANCE_SUMMARY),
  };
}

export function normalizeTrendingKeywords(raw: unknown): TrendingKeywordItem[] {
  return toArray<Record<string, unknown>>(raw).map((item) => ({
    keyword: String(item.keyword || ''),
    product_type: String(item.product_type || 'all'),
    search_volume: toFiniteNumber(item.search_volume),
    zero_count: toFiniteNumber(item.zero_count),
    ctr: clampPercent(item.ctr),
  }));
}

export function normalizeDemandGaps(raw: unknown): DemandGapItem[] {
  return toArray<Record<string, unknown>>(raw).map((item) => ({
    keyword: String(item.keyword || ''),
    product_type: String(item.product_type || 'all'),
    zero_result_count: toFiniteNumber(item.zero_result_count),
    total_searches: toFiniteNumber(item.total_searches),
  }));
}

export function normalizeGlobalTelemetryData(raw: unknown, fallbackPeriod: TelemetryPeriod = '7d'): GlobalAnalyticsOverview {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawChannels = (src.channels && typeof src.channels === 'object' ? src.channels : {}) as Record<string, unknown>;
  const rawPeriod = String(src.period || fallbackPeriod) as TelemetryPeriod;
  const period: TelemetryPeriod = rawPeriod === '30d' || rawPeriod === '90d' ? rawPeriod : '7d';

  const normalizeDims = (val: unknown): TelemetryDimensionItem[] =>
    toArray<Record<string, unknown>>(val).map((d) => ({
      dimension_value: String(d.dimension_value || d.name || ''),
      name: String(d.name || d.dimension_value || 'Lainnya'),
      views: toFiniteNumber(d.views),
      percentage: clampPercent(d.percentage),
      conversion_rate_percent: clampPercent(d.conversion_rate_percent),
      unique_visitors: toFiniteNumber(d.unique_visitors),
      total_actions: toFiniteNumber(d.total_actions),
    }));

  const defaultHeatmap = Array.from({ length: 24 }, (_, idx) => ({
    hour: String(idx).padStart(2, '0'),
    views: 0,
  }));
  const rawHeatmap = toArray<Record<string, unknown>>(src.hourly_heatmap);
  const hourlyHeatmap =
    rawHeatmap.length === 24
      ? rawHeatmap.map((h, idx) => ({
          hour: String(h.hour ?? String(idx).padStart(2, '0')),
          views: toFiniteNumber(h.views),
        }))
      : defaultHeatmap;

  return {
    period,
    days: toFiniteNumber(src.days, period === '30d' ? 30 : period === '90d' ? 90 : 7),
    total_views: toFiniteNumber(src.total_views),
    total_unique_visitors: toFiniteNumber(src.total_unique_visitors),
    total_product_views: toFiniteNumber(src.total_product_views),
    total_bounces: toFiniteNumber(src.total_bounces),
    bounce_rate_percent: clampPercent(src.bounce_rate_percent),
    total_actions: toFiniteNumber(src.total_actions),
    conversion_rate: clampPercent(src.conversion_rate),
    channels: {
      direct_wa: toFiniteNumber(rawChannels.direct_wa),
      marketplace: toFiniteNumber(rawChannels.marketplace),
      rekber: toFiniteNumber(rawChannels.rekber),
      video: toFiniteNumber(rawChannels.video),
    },
    trends: toArray<Record<string, unknown>>(src.trends).map((t) => ({
      date: String(t.date || ''),
      store_views: toFiniteNumber(t.store_views),
      unique_visitors: toFiniteNumber(t.unique_visitors),
      total_actions: toFiniteNumber(t.total_actions),
    })),
    top_stores: toArray<Record<string, unknown>>(src.top_stores).map((s) => ({
      store_id: toFiniteNumber(s.store_id),
      slug: String(s.slug || ''),
      store_title: String(s.store_title || s.slug || 'Toko'),
      views: toFiniteNumber(s.views),
      total_actions: toFiniteNumber(s.total_actions),
    })),
    devices: normalizeDims(src.devices),
    operating_systems: normalizeDims(src.operating_systems),
    browsers: normalizeDims(src.browsers),
    locations: normalizeDims(src.locations),
    hourly_heatmap: hourlyHeatmap,
    campaigns: normalizeDims(src.campaigns),
    recent_visitors: toArray<Record<string, unknown>>(src.recent_visitors).map((rv, idx) => ({
      id: toFiniteNumber(rv.id, idx + 1),
      store_id: toFiniteNumber(rv.store_id),
      store_slug: String(rv.store_slug || 'katalog'),
      event: String(rv.event || 'store_view'),
      product_name: rv.product_name ? String(rv.product_name) : undefined,
      source: String(rv.source || 'direct'),
      device_type: String(rv.device_type || 'mobile'),
      browser: String(rv.browser || ''),
      os: String(rv.os || ''),
      city: String(rv.city || 'Indonesia'),
      time_ago: String(rv.time_ago || 'Baru saja'),
    })),
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const msg = body.message || body.error;
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  return `${fallback} (HTTP ${res.status})`;
}

export async function fetchAdminMarketIntelBundle(
  token: string,
  signal?: AbortSignal,
): Promise<MarketIntelBundle> {
  const opts: RequestInit = {
    headers: buildAuthHeaders(token),
    credentials: 'include',
    signal,
  };

  const [mainRes, trendRes, gapRes] = await Promise.all([
    fetch('/api/admin/market-intelligence', opts),
    fetch('/api/admin/market-intelligence/trending-keywords', opts),
    fetch('/api/admin/market-intelligence/demand-gaps', opts),
  ]);

  if (!mainRes.ok) {
    throw new Error(await readErrorMessage(mainRes, 'Gagal memuat ringkasan riset pasar'));
  }

  const mainJson = (await mainRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!mainJson.success || !mainJson.data) {
    const errText =
      (typeof mainJson.message === 'string' && mainJson.message) ||
      (typeof mainJson.error === 'string' && mainJson.error) ||
      'Data riset pasar tidak tersedia.';
    throw new Error(errText);
  }

  const summary = normalizeMarketIntelligenceData(mainJson.data);
  const partialFailures: string[] = [];

  let trendingKeywords: TrendingKeywordItem[] = [];
  if (trendRes.ok) {
    const trendJson = (await trendRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (trendJson.success) {
      trendingKeywords = normalizeTrendingKeywords(trendJson.data);
    } else {
      partialFailures.push('kata kunci tren');
    }
  } else {
    partialFailures.push('kata kunci tren');
  }

  let demandGaps: DemandGapItem[] = [];
  if (gapRes.ok) {
    const gapJson = (await gapRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (gapJson.success) {
      demandGaps = normalizeDemandGaps(gapJson.data);
    } else {
      partialFailures.push('demand gap');
    }
  } else {
    partialFailures.push('demand gap');
  }

  return {
    summary,
    trendingKeywords,
    demandGaps,
    partialWarning:
      partialFailures.length > 0
        ? `Sebagian data (${partialFailures.join(' & ')}) belum dapat dimuat dari server.`
        : null,
  };
}

export async function fetchAdminGlobalTelemetry(
  token: string,
  period: TelemetryPeriod,
  signal?: AbortSignal,
): Promise<GlobalAnalyticsOverview> {
  const res = await fetch(`/api/admin/analytics/overview?period=${encodeURIComponent(period)}`, {
    headers: buildAuthHeaders(token),
    credentials: 'include',
    signal,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Gagal memuat telemetri audiens global'));
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!json.success || !json.data) {
    const errText =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      'Data telemetri global tidak tersedia.';
    throw new Error(errText);
  }

  return normalizeGlobalTelemetryData(json.data, period);
}

export async function triggerMarketIntelAggregationBot(token: string): Promise<string> {
  const res = await fetch('/api/admin/automation/trigger', {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ action: 'market_intel_worker' }),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Gagal memicu bot agregasi riset pasar'));
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!json.success) {
    const errText =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      'Gagal memicu bot agregasi riset pasar.';
    throw new Error(errText);
  }

  return typeof json.message === 'string' && json.message
    ? json.message
    : 'Bot Agregasi Riset Pasar berhasil dipicu di latar belakang.';
}

export async function downloadAdminMarketIntelExport(
  token: string,
  format: 'csv' | 'json',
): Promise<string> {
  const res = await fetch(`/api/admin/market-intelligence/export?format=${format}`, {
    headers: buildAuthHeaders(token),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Gagal mengunduh laporan ${format.toUpperCase()}`));
  }

  const blob = await res.blob();
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `catavor-market-intelligence-${datePart}.${format}`;
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  return filename;
}

export function formatIDR(amount?: number): string {
  const n = toFiniteNumber(amount, 0);
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatNumber(value?: number): string {
  return Math.round(toFiniteNumber(value, 0)).toLocaleString('id-ID');
}

export function formatPercent(value?: number, digits = 1): string {
  return `${clampPercent(value).toFixed(digits)}%`;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  all: 'Semua Industri',
  physical: 'Barang Fisik',
  food: 'Kuliner & F&B',
  digital: 'Produk Digital',
  service: 'Jasa & Layanan',
  plant: 'Tanaman & Flora',
  fauna: 'Satwa & Hewan',
  property: 'Properti & Lahan',
};

export function formatProductTypeLabel(productType?: string): string {
  const key = String(productType || 'all').toLowerCase().trim();
  return PRODUCT_TYPE_LABELS[key] || titleizeFallback(key);
}

function titleizeFallback(val: string): string {
  return val
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatTelemetryEventLabel(event?: string, productName?: string): string {
  const suffix = productName ? ` (${productName})` : '';
  switch (event) {
    case 'store_view':
      return 'Kunjungan Katalog';
    case 'product_view':
      return productName ? `Lihat ${productName}` : 'Lihat Item Katalog';
    case 'direct_wa_click':
    case 'action_wa':
      return `Klik WhatsApp${suffix}`;
    case 'rekber_click':
      return `Klik Rekber Syariah${suffix}`;
    case 'marketplace_click':
      return `Klik Marketplace${suffix}`;
    case 'video_view':
      return `Tonton Video${suffix}`;
    default:
      return `${event || 'Aktivitas'}${suffix}`;
  }
}

export function computeGapRatio(zeroCount: number, totalSearches: number): number {
  if (totalSearches <= 0 || zeroCount <= 0) return 0;
  const pct = (zeroCount / totalSearches) * 100;
  return pct > 100 ? 100 : pct;
}
