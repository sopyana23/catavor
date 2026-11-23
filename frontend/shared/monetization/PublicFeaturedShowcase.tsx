import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Sparkles, Store } from 'lucide-react';
import { formatRupiah } from './adsenseRuntime';

export interface PublicFeaturedShowcaseProps {
  device?: 'desktop' | 'tablet' | 'mobile';
  isDark?: boolean;
}

interface ShowcaseCardItem {
  is_sponsored: boolean;
  badge_text: string;
  campaign_id?: number;
  ad_slot_id?: number;
  campaign_code?: string;
  ad_slot_code?: string;
  redirect_url: string;
  item_type: 'store' | 'product';
  store_id: number;
  store_slug: string;
  store_title: string;
  store_logo_url?: string;
  store_slogan?: string;
  product_id?: number;
  product_name?: string;
  product_price?: number;
  product_image_url?: string;
  category_name?: string;
}

const SECTORS = [
  { id: 'all', label: 'Semua' },
  { id: 'food', label: 'Kuliner' },
  { id: 'physical', label: 'Barang Fisik' },
  { id: 'fauna', label: 'Fauna' },
  { id: 'plant', label: 'Tanaman' },
  { id: 'service', label: 'Jasa' },
  { id: 'digital', label: 'Produk Digital' },
  { id: 'property', label: 'Properti' },
] as const;

export const PublicFeaturedShowcase: React.FC<PublicFeaturedShowcaseProps> = ({
  device = 'desktop',
  isDark = false,
}) => {
  const [sector, setSector] = useState<string>('all');
  const [items, setItems] = useState<ShowcaseCardItem[]>([]);
  const [initialHasContent, setInitialHasContent] = useState<boolean>(false);
  const reportedRef = useRef<Set<string>>(new Set());

  const fetchShowcase = useCallback(async (selectedSector: string) => {
    try {
      const url =
        selectedSector === 'all'
          ? '/api/public/showcase/featured?limit=6'
          : `/api/public/showcase/sector/${encodeURIComponent(selectedSector)}?limit=6`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json();

      let nextItems: ShowcaseCardItem[] = [];
      if (selectedSector === 'all') {
        const stores: ShowcaseCardItem[] = Array.isArray(json?.data?.featured_stores?.items)
          ? json.data.featured_stores.items
          : [];
        const prods: ShowcaseCardItem[] = Array.isArray(json?.data?.spotlight_items?.items)
          ? json.data.spotlight_items.items
          : [];
        nextItems = [...stores, ...prods].slice(0, 8);
      } else {
        nextItems = Array.isArray(json?.showcase?.items) ? json.showcase.items : [];
      }

      setItems(nextItems);
      if (nextItems.length > 0) {
        setInitialHasContent(true);
      }

      // Report deduplicated impressions for sponsored items
      const batch: Array<{ campaign_id: number; ad_slot_id: number; store_id: number }> = [];
      nextItems.forEach((it) => {
        if (it.is_sponsored && it.campaign_id && it.ad_slot_id && it.store_id) {
          const key = `${it.campaign_id}:${it.ad_slot_id}`;
          if (!reportedRef.current.has(key)) {
            reportedRef.current.add(key);
            batch.push({
              campaign_id: it.campaign_id,
              ad_slot_id: it.ad_slot_id,
              store_id: it.store_id,
            });
          }
        }
      });

      if (batch.length > 0) {
        fetch('/api/public/ads/impressions/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        }).catch(() => {});
      }
    } catch {
      // Fail gracefully without breaking landing page
    }
  }, []);

  useEffect(() => {
    fetchShowcase(sector);
  }, [sector, fetchShowcase]);

  if (!initialHasContent && items.length === 0) {
    return null;
  }

  const gridCols =
    device === 'desktop'
      ? 'repeat(auto-fill, minmax(250px, 1fr))'
      : device === 'tablet'
        ? 'repeat(auto-fill, minmax(220px, 1fr))'
        : '1fr';

  return (
    <section
      aria-label="Etalase Unggulan Catavor"
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '1.5rem auto',
        padding: device === 'mobile' ? '0 0.25rem' : '0 1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: device === 'mobile' ? '1.1rem' : '1.6rem',
          borderRadius: '1.15rem',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.25rem' }}>
              <Sparkles size={14} />
              <span>Etalase Unggulan &amp; Mitra Terkurasi</span>
            </div>
            <h2 style={{ margin: 0, fontSize: device === 'mobile' ? '1.15rem' : '1.4rem', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
              Katalog &amp; Produk Pilihan Minggu Ini
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              maxWidth: '100%',
              paddingBottom: '0.2rem',
            }}
          >
            {SECTORS.map((s) => {
              const active = sector === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSector(s.id)}
                  style={{
                    minHeight: device === 'desktop' ? '34px' : '44px',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    border: active ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.28)' : '#cbd5e1'}`,
                    backgroundColor: active ? '#1e3a8a' : 'transparent',
                    color: active ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b', padding: '0.75rem 0' }}>
            Belum ada item unggulan untuk kategori ini.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.85rem' }}>
            {items.map((item, idx) => {
              const isProduct = item.item_type === 'product';
              const title = isProduct ? item.product_name || item.store_title : item.store_title;
              const imgUrl = isProduct ? item.product_image_url : item.store_logo_url;
              return (
                <a
                  key={`${item.item_type}-${item.store_id}-${item.product_id || idx}`}
                  href={item.redirect_url || `/u/${item.store_slug}`}
                  style={{
                    textDecoration: 'none',
                    padding: '0.9rem',
                    borderRadius: '0.85rem',
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={title}
                        loading="lazy"
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '0.65rem',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '0.65rem',
                          backgroundColor: isDark ? '#0f172a' : '#e2e8f0',
                          color: isDark ? '#94a3b8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Store size={22} />
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: '999px',
                          backgroundColor: item.is_sponsored ? 'rgba(234, 179, 8, 0.16)' : 'rgba(37, 99, 235, 0.12)',
                          color: item.is_sponsored ? '#b45309' : '#1d4ed8',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {item.badge_text || (item.is_sponsored ? 'Disponsori' : 'Populer Minggu Ini')}
                      </span>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          color: isDark ? '#f8fafc' : '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: isDark ? '#94a3b8' : '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isProduct ? item.store_title : item.store_slogan || `@${item.store_slug}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.35rem', borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0'}` }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isProduct ? '#059669' : '#2563eb' }}>
                      {isProduct && item.product_price ? formatRupiah(item.product_price) : 'Buka Katalog'}
                    </span>
                    <ArrowUpRight size={15} color={isDark ? '#94a3b8' : '#64748b'} />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
