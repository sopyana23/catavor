import React, { useMemo, useState } from 'react';
import { ExternalLink, Play, Film, AlertCircle } from 'lucide-react';

export interface ParsedVideoInfo {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'direct' | 'unknown';
  embedUrl: string;
  originalUrl: string;
  platformLabel: string;
  isValid: boolean;
}

export function parseVideoUrl(url: string | null | undefined): ParsedVideoInfo | null {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;

  try {
    const ytMatch = raw.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return {
        platform: 'youtube',
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
        originalUrl: raw,
        platformLabel: raw.includes('shorts') ? 'YouTube Shorts' : 'YouTube Video',
        isValid: true
      };
    }

    const ttMatch = raw.match(/tiktok\.com\/@?[^\/]+\/video\/(\d+)/i);
    if (ttMatch && ttMatch[1]) {
      return {
        platform: 'tiktok',
        embedUrl: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
        originalUrl: raw,
        platformLabel: 'TikTok Video',
        isValid: true
      };
    }
    if (raw.includes('tiktok.com')) {
      return {
        platform: 'tiktok',
        embedUrl: raw,
        originalUrl: raw,
        platformLabel: 'TikTok Video',
        isValid: true
      };
    }

    const igMatch = raw.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/i);
    if (igMatch && igMatch[1]) {
      return {
        platform: 'instagram',
        embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed/captioned/`,
        originalUrl: raw,
        platformLabel: raw.includes('reel') ? 'Instagram Reel' : 'Instagram Post',
        isValid: true
      };
    }

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return {
        platform: 'direct',
        embedUrl: raw,
        originalUrl: raw,
        platformLabel: 'Video Tautan Langsung',
        isValid: true
      };
    }
  } catch (e) {
    console.error('Error parsing video URL:', e);
  }

  return null;
}

export const VideoPlayerEmbed: React.FC<{
  url?: string | null;
  title?: string;
  isMobile?: boolean;
}> = ({ url, title, isMobile = true }) => {
  const [loadError, setLoadError] = useState(false);
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  if (!parsed || !parsed.isValid) return null;

  if (loadError) {
    return (
      <div style={{
        padding: '0.85rem',
        borderRadius: '0.75rem',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <AlertCircle size={15} style={{ color: '#ef4444' }} />
          <span>Tidak dapat memuat pratinjau video di aplikasi.</span>
        </div>
        <a
          href={parsed.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '0.4rem',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 700,
            textDecoration: 'none'
          }}
        >
          Tonton di {parsed.platformLabel} <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  if (parsed.platform === 'youtube') {
    return (
      <div style={{
        margin: '0.85rem 0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
        background: '#0a0f1d'
      }}>
        <div style={{
          padding: '0.45rem 0.75rem',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '3px',
              background: '#ff0000',
              color: '#ffffff',
              fontSize: '9px'
            }}>
              ▶
            </span>
            <strong style={{ color: 'var(--text-primary)' }}>{title || parsed.platformLabel}</strong>
          </div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600, fontSize: '0.72rem' }}
          >
            Buka <ExternalLink size={10} />
          </a>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          <iframe
            src={parsed.embedUrl}
            title={title || 'Video Produk'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onError={() => setLoadError(true)}
          />
        </div>
      </div>
    );
  }

  if (parsed.platform === 'tiktok' || parsed.platform === 'instagram') {
    const isTikTok = parsed.platform === 'tiktok';
    return (
      <div style={{
        margin: '0.85rem 0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
        background: '#0a0f1d',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.65rem',
          paddingBottom: '0.45rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              padding: '2px 6px',
              borderRadius: '3px',
              background: isTikTok ? '#000000' : 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800
            }}>
              {isTikTok ? '🎵 TikTok' : '📸 Instagram'}
            </span>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{title || parsed.platformLabel}</strong>
          </div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600, fontSize: '0.72rem' }}
          >
            Aplikasi <ExternalLink size={10} />
          </a>
        </div>

        <div style={{ width: '100%', height: '420px', borderRadius: '0.45rem', overflow: 'hidden', background: '#000' }}>
          <iframe
            src={parsed.embedUrl}
            title={title || 'Social Video Embed'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
            onError={() => setLoadError(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '0.75rem 0' }}>
      <a
        href={parsed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          width: '100%',
          padding: '0.65rem 1rem',
          borderRadius: '0.5rem',
          background: 'var(--primary)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.82rem',
          textDecoration: 'none'
        }}
      >
        <Film size={15} />
        <span>Tonton Video Preview ({parsed.platformLabel})</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );
};

export const VideoPreviewInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
}> = ({
  value,
  onChange,
  label = 'Link Video Showcase / Review (Opsional)',
  placeholder = 'Tempel link video YouTube, Shorts, TikTok, atau Instagram Reels...'
}) => {
  const parsed = useMemo(() => parseVideoUrl(value), [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          YouTube • Shorts • TikTok • Reels
        </span>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input
          type="url"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', fontSize: '0.82rem', paddingRight: parsed?.isValid ? '90px' : '0.75rem' }}
        />
        {parsed?.isValid && (
          <span style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '4px',
            background: parsed.platform === 'youtube' ? 'rgba(239, 68, 68, 0.15)' : parsed.platform === 'tiktok' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(168, 85, 247, 0.15)',
            border: `1px solid ${parsed.platform === 'youtube' ? 'rgba(239, 68, 68, 0.3)' : parsed.platform === 'tiktok' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(168, 85, 247, 0.3)'}`,
            color: parsed.platform === 'youtube' ? '#f87171' : parsed.platform === 'tiktok' ? '#e5e7eb' : '#c084fc'
          }}>
            {parsed.platformLabel}
          </span>
        )}
      </div>

      <div style={{
        padding: '0.5rem 0.65rem',
        borderRadius: '0.45rem',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        fontSize: '0.7rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.4
      }}>
        <div style={{ marginBottom: '0.15rem' }}>
          <strong>Platform Didukung:</strong> Tautan video & Shorts dari <strong>YouTube</strong>, video <strong>TikTok</strong>, dan <strong>Instagram Reels</strong>.
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          <strong>Ketentuan Visibilitas:</strong> Pastikan video disetel ke <strong>Publik</strong> atau <strong>Tidak Publik (Unlisted)</strong> agar dapat diputar calon pembeli (jangan disetel <em>Pribadi / Private</em>).
        </div>
      </div>

      {/* Live Video Preview in Form */}
      {parsed?.isValid && (
        <div style={{ marginTop: '0.3rem', padding: '0.6rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Pratinjau Pemutar Video:
          </div>
          <VideoPlayerEmbed url={value} title="Pratinjau Video Produk" />
        </div>
      )}
    </div>
  );
};
