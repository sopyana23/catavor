import React, { useMemo } from 'react';
import { ExternalLink, Play } from 'lucide-react';

export interface ParsedVideoInfo {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'pinterest' | 'direct' | 'unknown';
  embedUrl: string;
  originalUrl: string;
  platformLabel: string;
  isValid: boolean;
  creatorHandle?: string;
  isNativeIframeSupported: boolean;
  brandAccent: string;
  brandGlow: string;
  badgeBg: string;
  badgeText: string;
  badgeIcon: string;
  cardBackground: string;
}

export function parseVideoUrl(url: string | null | undefined): ParsedVideoInfo | null {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;

  try {
    // 1. YouTube & YouTube Shorts (Native iframe supported & reliable)
    const ytMatch = raw.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      const isShorts = raw.includes('shorts');
      return {
        platform: 'youtube',
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
        originalUrl: raw,
        platformLabel: isShorts ? 'YouTube Shorts' : 'YouTube Video',
        isValid: true,
        isNativeIframeSupported: true,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: '#ff0000',
        badgeText: isShorts ? 'YouTube Shorts' : 'YouTube Video',
        badgeIcon: '▶',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 2. TikTok (App share links vt.tiktok.com, vm.tiktok.com, or full browser links)
    if (raw.includes('tiktok.com')) {
      const handleMatch = raw.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
      const handle = handleMatch && handleMatch[1] ? `@${handleMatch[1]}` : undefined;
      return {
        platform: 'tiktok',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: 'TikTok',
        isValid: true,
        creatorHandle: handle,
        isNativeIframeSupported: false,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: '#05070d',
        badgeText: 'TikTok Video',
        badgeIcon: '🎵',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 3. Instagram Reels / Posts / TV
    if (raw.includes('instagram.com')) {
      const handleMatch = raw.match(/instagram\.com\/([a-zA-Z0-9_.-]+)\/(?:reel|p)\//i);
      const handle = handleMatch && handleMatch[1] && !['reel', 'p', 'tv', 'stories'].includes(handleMatch[1]) ? `@${handleMatch[1]}` : undefined;
      const isReel = raw.includes('/reel');
      return {
        platform: 'instagram',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: 'Instagram',
        isValid: true,
        creatorHandle: handle,
        isNativeIframeSupported: false,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        badgeText: isReel ? 'Instagram Reel' : 'Instagram Video',
        badgeIcon: '📸',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 4. Facebook Video / Reels
    if (raw.includes('facebook.com') || raw.includes('fb.watch')) {
      const isReel = raw.includes('/reel');
      return {
        platform: 'facebook',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: 'Facebook',
        isValid: true,
        isNativeIframeSupported: false,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: '#1877f2',
        badgeText: isReel ? 'Facebook Reel' : 'Facebook Video',
        badgeIcon: '📘',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 5. X / Twitter Video
    if (raw.includes('twitter.com') || raw.includes('x.com')) {
      const handleMatch = raw.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status/i);
      const handle = handleMatch && handleMatch[1] && handleMatch[1].toLowerCase() !== 'i' ? `@${handleMatch[1]}` : undefined;
      return {
        platform: 'twitter',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: 'X (Twitter)',
        isValid: true,
        creatorHandle: handle,
        isNativeIframeSupported: false,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: '#05070d',
        badgeText: 'Video di X',
        badgeIcon: '𝕏',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 6. Pinterest Video
    if (raw.includes('pinterest.com') || raw.includes('pin.it')) {
      return {
        platform: 'pinterest',
        embedUrl: '',
        originalUrl: raw,
        platformLabel: 'Pinterest',
        isValid: true,
        isNativeIframeSupported: false,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: '#e60023',
        badgeText: 'Pinterest Video',
        badgeIcon: '📌',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }

    // 7. Direct MP4 / WebM / Generic Video URL
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const isDirectFile = /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(raw);
      return {
        platform: 'direct',
        embedUrl: raw,
        originalUrl: raw,
        platformLabel: 'Video Showcase',
        isValid: true,
        isNativeIframeSupported: isDirectFile,
        brandAccent: 'var(--primary, #10b981)',
        brandGlow: 'var(--primary-glow, rgba(16, 185, 129, 0.35))',
        badgeBg: 'var(--primary, #10b981)',
        badgeText: 'Video Produk',
        badgeIcon: '▶',
        cardBackground: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      };
    }
  } catch (err) {
    console.error('Failed to parse video URL:', err);
  }

  return null;
}

export const VideoPlayerEmbed: React.FC<{
  url?: string | null;
  title?: string;
  isMobile?: boolean;
}> = ({ url, title, isMobile = false }) => {
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  if (!parsed || !parsed.isValid) return null;

  // 1. YouTube Player (Native iframe supported and reliable)
  if (parsed.isNativeIframeSupported && parsed.platform === 'youtube') {
    return (
      <div style={{
        margin: '1rem 0',
        borderRadius: '1rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        background: 'var(--card-bg-gradient, var(--bg-card, #0f172a))'
      }}>
        <div style={{
          padding: '0.6rem 0.95rem',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              background: '#ff0000',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800
            }}>
              ▶
            </span>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{title || parsed.platformLabel}</strong>
          </div>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem' }}
          >
            Buka YouTube <ExternalLink size={12} />
          </a>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          <iframe
            src={parsed.embedUrl}
            title={title || 'Video Produk Catavor'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 2. Direct HTML5 Video Player if it is an actual video file (.mp4/.webm)
  if (parsed.platform === 'direct' && parsed.isNativeIframeSupported) {
    return (
      <div style={{
        margin: '1rem 0',
        borderRadius: '1rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        background: '#000000'
      }}>
        <video 
          controls 
          src={parsed.originalUrl} 
          style={{ width: '100%', maxHeight: '420px', display: 'block' }} 
        />
      </div>
    );
  }

  // 3. Industry-Standard Rich Social Video Showcase Card (for TikTok, Instagram Reels, Facebook, X, etc.)
  return (
    <a
      href={parsed.originalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="catavor-video-card"
      style={{
        margin: isMobile ? '0.85rem 0' : '1rem 0',
        width: '100%',
        maxWidth: isMobile ? '100%' : '540px',
        padding: isMobile ? '1.15rem 1.15rem 1.1rem' : '1.35rem 1.4rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: isMobile ? '185px' : '205px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      } as React.CSSProperties}
      title={`Tonton ${title || parsed.platformLabel} di ${parsed.platformLabel}`}
    >
      {/* Ambient Dynamic Theme Corner Glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '160px',
        height: '160px',
        borderRadius: '50%',
        background: 'var(--primary-glow, rgba(16, 185, 129, 0.25))',
        filter: 'blur(45px)',
        opacity: 0.65,
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Subtle Specular Sheen Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Top Header: Platform Badge + Creator Pill / Open Tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: isMobile ? '0.28rem 0.65rem' : '0.32rem 0.75rem',
          borderRadius: '999px',
          background: parsed.badgeBg,
          color: '#ffffff',
          fontSize: isMobile ? '0.72rem' : '0.75rem',
          fontWeight: 800,
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
          letterSpacing: '0.02em'
        }}>
          <span>{parsed.badgeIcon}</span>
          <span>{parsed.badgeText}</span>
        </div>

        {parsed.creatorHandle ? (
          <span style={{
            fontSize: isMobile ? '0.7rem' : '0.74rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            padding: '0.22rem 0.6rem',
            borderRadius: '999px',
            fontWeight: 600,
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            {parsed.creatorHandle}
          </span>
        ) : (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.22rem 0.55rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-secondary)',
            fontSize: '0.7rem',
            fontWeight: 600,
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))'
          }}>
            <span>Buka Media</span>
            <ExternalLink size={11} />
          </div>
        )}
      </div>

      {/* Center: Hero Play Button with Dynamic Theme Primary Accent */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: isMobile ? '0.65rem 0' : '0.85rem 0',
        zIndex: 1
      }}>
        <div 
          className="catavor-play-btn"
          style={{
            width: isMobile ? '52px' : '60px',
            height: isMobile ? '52px' : '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary, #10b981) 0%, var(--primary-hover, #059669) 100%)',
            boxShadow: '0 0 0 5px var(--primary-glow, rgba(16, 185, 129, 0.25)), 0 8px 24px var(--primary-glow, rgba(16, 185, 129, 0.35))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}
        >
          <Play size={isMobile ? 22 : 25} fill="#ffffff" color="#ffffff" style={{ marginLeft: '3px' }} />
        </div>
      </div>

      {/* Bottom Footer: Video Title + Direct Watch CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', zIndex: 1 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: isMobile ? '0.88rem' : '0.94rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '0.2rem',
            letterSpacing: '-0.01em'
          }}>
            {title || `Video Showcase di ${parsed.platformLabel}`}
          </div>
          <div style={{
            fontSize: isMobile ? '0.72rem' : '0.76rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontWeight: 500
          }}>
            <span>Tonton selengkapnya di</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{parsed.platformLabel}</span>
            <ExternalLink size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          </div>
        </div>

        <div 
          className="catavor-video-cta"
          style={{
            flexShrink: 0,
            padding: isMobile ? '0.42rem 0.85rem' : '0.48rem 1rem',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, var(--primary, #10b981) 0%, var(--primary-hover, #059669) 100%)',
            color: '#ffffff',
            fontSize: isMobile ? '0.72rem' : '0.76rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            boxShadow: '0 4px 14px var(--primary-glow, rgba(16, 185, 129, 0.35))',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            letterSpacing: '0.02em'
          }}
        >
          <span>Tonton</span>
          <span style={{ fontSize: '0.82rem', transform: 'translateY(-0.5px)' }}>&rarr;</span>
        </div>
      </div>
    </a>
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
  placeholder = 'Tempel link video YouTube, TikTok, Instagram Reels, Facebook, dll...'
}) => {
  const parsed = useMemo(() => parseVideoUrl(value), [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          YouTube • TikTok • Reels • FB • X
        </span>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input
          type="url"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', fontSize: '0.84rem', paddingRight: parsed?.isValid ? '120px' : '1rem' }}
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
            background: parsed.badgeBg,
            border: `1px solid rgba(255, 255, 255, 0.25)`,
            color: '#ffffff',
            letterSpacing: '0.02em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span>{parsed.badgeIcon}</span>
            <span>{parsed.badgeText}</span>
          </span>
        )}
      </div>

      <div style={{
        padding: '0.6rem 0.85rem',
        borderRadius: '0.55rem',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        fontSize: '0.73rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>🎥 Dukungan Video Multi-Platform</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.71rem' }}>
          Mendukung link video dari <strong>YouTube</strong>, <strong>TikTok</strong> (tautan aplikasi seluler maupun browser desktop), <strong>Instagram Reels</strong>, <strong>Facebook</strong>, dan <strong>X (Twitter)</strong>. Video akan ditampilkan secara profesional di katalog produk Anda.
        </div>
      </div>

      {/* Live Video Preview in Form */}
      {parsed?.isValid && (
        <div style={{ marginTop: '0.35rem', padding: '0.75rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Pratinjau Tampilan di Katalog Produk:
          </div>
          <VideoPlayerEmbed url={value} title="Pratinjau Video Produk" />
        </div>
      )}
    </div>
  );
};
