import React, { useMemo, useState } from 'react';
import { ExternalLink, Play, Film, AlertCircle } from 'lucide-react';

export interface ParsedVideoInfo {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'direct' | 'unknown';
  embedUrl: string;
  originalUrl: string;
  platformLabel: string;
  isValid: boolean;
  isShortLink?: boolean;
  shortLinkNote?: string;
}

export function parseVideoUrl(url: string | null | undefined): ParsedVideoInfo | null {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;

  try {
    // 1. YouTube & YouTube Shorts
    // Formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
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

    // 2. TikTok
    // Matches standard full desktop links: tiktok.com/@user/video/1234567890 or /v/1234567890
    const ttIdMatch = raw.match(/tiktok\.com\/(?:@?[^\/]+\/video|v|embed\/v2|embed|player\/v1)\/(\d+)/i);
    if (ttIdMatch && ttIdMatch[1]) {
      return {
        platform: 'tiktok',
        embedUrl: `https://www.tiktok.com/embed/v2/${ttIdMatch[1]}`,
        originalUrl: raw,
        platformLabel: 'TikTok Video',
        isValid: true
      };
    }

    if (raw.includes('tiktok.com')) {
      const isShort = raw.includes('vt.tiktok.com') || raw.includes('vm.tiktok.com') || raw.includes('/t/');
      return {
        platform: 'tiktok',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: isShort ? 'TikTok Short Link' : 'TikTok Link',
        isValid: true,
        isShortLink: true,
        shortLinkNote: isShort
          ? 'Tautan pendek aplikasi (vt.tiktok.com) tidak dapat diputar langsung di iframe karena kebijakan keamanan TikTok. Calon pembeli dapat menonton via tombol langsung di bawah. Untuk memunculkan pemutar langsung di katalog, salin URL lengkap dari browser (tiktok.com/@username/video/1234567890).'
          : 'Tautan video TikTok dapat dibuka langsung oleh calon pembeli di aplikasi TikTok.'
      };
    }

    // 3. Instagram Reels / Posts
    // Formats: instagram.com/reel/ID/ or instagram.com/p/ID/
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

    // 4. Direct MP4 / Generic URL Fallback
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
}> = ({ url, title, isMobile = false }) => {
  const [loadError, setLoadError] = useState(false);
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  if (!parsed || !parsed.isValid) return null;

  if (loadError) {
    return (
      <div style={{
        padding: '1rem',
        borderRadius: '0.75rem',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ color: '#ef4444' }} />
          <span>Tidak dapat memuat pratinjau video di peramban.</span>
        </div>
        <a
          href={parsed.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
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

  // YouTube / YouTube Shorts Player
  if (parsed.platform === 'youtube') {
    return (
      <div style={{
        margin: '1rem 0',
        borderRadius: '0.85rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        background: '#0a0f1d'
      }}>
        <div style={{
          padding: '0.5rem 0.85rem',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: '#ff0000',
              color: '#ffffff',
              fontSize: '10px'
            }}>
              ▶
            </span>
            <strong style={{ color: 'var(--text-primary)' }}>{title || parsed.platformLabel}</strong>
          </div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, fontSize: '0.74rem' }}
          >
            Buka YouTube <ExternalLink size={11} />
          </a>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          <iframe
            src={parsed.embedUrl}
            title={title || 'Video Produk Catavor'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onError={() => setLoadError(true)}
          />
        </div>
      </div>
    );
  }

  // TikTok or Instagram Reels Vertical Player
  if (parsed.platform === 'tiktok' || parsed.platform === 'instagram') {
    const isTikTok = parsed.platform === 'tiktok';

    // If it's a short link or has no direct embedUrl, display a beautiful action card instead of a broken iframe
    if (parsed.isShortLink || !parsed.embedUrl) {
      return (
        <div style={{
          margin: '1rem 0',
          borderRadius: '0.85rem',
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          background: 'linear-gradient(135deg, #0b1220 0%, #111a2e 100%)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: isTikTok ? '#000000' : 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {isTikTok ? '🎵 Video TikTok' : '📸 Video Instagram'}
          </div>

          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              {title || (isTikTok ? 'Tonton Video Showcase di TikTok' : 'Tonton Video Showcase di Instagram')}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.5 }}>
              {parsed.shortLinkNote || 'Video dapat disaksikan langsung oleh calon pembeli di aplikasi.'}
            </div>
          </div>

          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.55rem',
              background: isTikTok ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : 'linear-gradient(45deg, #f09433 0%, #dc2743 100%)',
              color: isTikTok ? '#000000' : '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              transition: 'transform 0.15s ease'
            }}
          >
            <span>Buka di {isTikTok ? 'TikTok' : 'Instagram'}</span>
            <ExternalLink size={13} />
          </a>
        </div>
      );
    }

    return (
      <div style={{
        margin: '1rem 0',
        borderRadius: '0.85rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        background: '#0a0f1d',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: isTikTok ? '#000000' : 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {isTikTok ? '🎵 TikTok' : '📸 Instagram'}
            </span>
            <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{title || parsed.platformLabel}</strong>
          </div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, fontSize: '0.74rem' }}
          >
            Buka di Aplikasi <ExternalLink size={11} />
          </a>
        </div>

        <div style={{ width: '100%', maxWidth: isMobile ? '100%' : '360px', height: isMobile ? '450px' : '520px', borderRadius: '0.5rem', overflow: 'hidden', background: '#000' }}>
          <iframe
            src={parsed.embedUrl}
            title={title || 'Social Video Embed'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onError={() => setLoadError(true)}
          />
        </div>

        <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.45 }}>
          Jika pemutar dibatasi oleh privasi kreator/adblocker, calon pembeli tetap dapat{' '}
          <a href={parsed.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
            membuka langsung di TikTok &rarr;
          </a>
        </div>
      </div>
    );
  }

  // Direct Fallback
  return (
    <div style={{ margin: '1rem 0' }}>
      <a
        href={parsed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 1.25rem',
          borderRadius: '0.6rem',
          background: 'var(--primary)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.85rem',
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(var(--primary-rgb), 0.3)'
        }}
      >
        <Film size={16} />
        <span>Tonton Video Preview ({parsed.platformLabel})</span>
        <ExternalLink size={14} />
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
        <label className="form-label" style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          YouTube • Shorts • TikTok • IG Reels
        </span>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input
          type="url"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', fontSize: '0.84rem', paddingRight: parsed?.isValid ? '100px' : '1rem' }}
        />
        {parsed?.isValid && (
          <span style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            background: parsed.platform === 'youtube' ? 'rgba(239, 68, 68, 0.15)' : parsed.platform === 'tiktok' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(168, 85, 247, 0.15)',
            border: `1px solid ${parsed.platform === 'youtube' ? 'rgba(239, 68, 68, 0.3)' : parsed.platform === 'tiktok' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(168, 85, 247, 0.3)'}`,
            color: parsed.platform === 'youtube' ? '#f87171' : parsed.platform === 'tiktok' ? '#e5e7eb' : '#c084fc',
            letterSpacing: '0.02em'
          }}>
            {parsed.platformLabel}
          </span>
        )}
      </div>

      <div style={{
        padding: '0.65rem 0.85rem',
        borderRadius: '0.55rem',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        fontSize: '0.73rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5
      }}>
        <div style={{ marginBottom: '0.25rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Format Link yang Didukung:</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.35rem' }}>
          <div>• <strong>YouTube / Shorts:</strong> <code>youtube.com/watch?v=...</code> atau <code>youtu.be/...</code></div>
          <div>• <strong>TikTok:</strong> Gunakan tautan lengkap browser <code>tiktok.com/@username/video/1234567890</code> agar pemutar dapat muncul langsung.</div>
          <div>• <strong>Instagram:</strong> <code>instagram.com/reel/...</code> atau <code>instagram.com/p/...</code></div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          <strong>Ketentuan Visibilitas:</strong> Pastikan video disetel ke <strong>Publik</strong>. Tautan pendek aplikasi seluler (seperti <code>vt.tiktok.com</code>) akan otomatis dialihkan ke aplikasi resmi TikTok.
        </div>
      </div>

      {/* Live Video Preview in Form */}
      {parsed?.isValid && (
        <div style={{ marginTop: '0.35rem', padding: '0.75rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Pratinjau Pemutar Video Langsung:
          </div>
          <VideoPlayerEmbed url={value} title="Pratinjau Video Produk" />
        </div>
      )}
    </div>
  );
};
