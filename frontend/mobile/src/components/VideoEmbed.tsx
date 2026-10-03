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
        brandAccent: '#ff0000',
        brandGlow: 'rgba(239, 68, 68, 0.35)',
        badgeBg: '#ff0000',
        badgeText: isShorts ? 'YouTube Shorts' : 'YouTube Video',
        badgeIcon: '▶',
        cardBackground: 'linear-gradient(135deg, #120a0d 0%, #1f0d14 100%)'
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
        brandAccent: '#00f2fe',
        brandGlow: 'rgba(0, 242, 254, 0.35)',
        badgeBg: '#000000',
        badgeText: 'TikTok Video',
        badgeIcon: '🎵',
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(0, 242, 254, 0.14) 0%, rgba(254, 44, 85, 0.1) 45%, #070c18 85%)'
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
        brandAccent: '#e1306c',
        brandGlow: 'rgba(225, 48, 108, 0.35)',
        badgeBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        badgeText: isReel ? 'Instagram Reel' : 'Instagram Video',
        badgeIcon: '📸',
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(225, 48, 108, 0.15) 0%, rgba(240, 148, 51, 0.08) 45%, #0e0916 85%)'
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
        brandAccent: '#1877f2',
        brandGlow: 'rgba(24, 119, 242, 0.35)',
        badgeBg: '#1877f2',
        badgeText: isReel ? 'Facebook Reel' : 'Facebook Video',
        badgeIcon: '📘',
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(24, 119, 242, 0.15) 0%, rgba(13, 30, 60, 0.2) 50%, #090e1a 85%)'
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
        brandAccent: '#1d9bf0',
        brandGlow: 'rgba(29, 155, 240, 0.35)',
        badgeBg: '#000000',
        badgeText: 'Video di X',
        badgeIcon: '𝕏',
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(29, 155, 240, 0.12) 0%, rgba(20, 30, 45, 0.25) 50%, #080c14 85%)'
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
        brandAccent: '#e60023',
        brandGlow: 'rgba(230, 0, 35, 0.35)',
        badgeBg: '#e60023',
        badgeText: 'Pinterest Video',
        badgeIcon: '📌',
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(230, 0, 35, 0.14) 0%, rgba(35, 12, 16, 0.25) 50%, #0f0709 85%)'
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
        cardBackground: 'radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.12) 0%, rgba(12, 28, 22, 0.25) 50%, #080f13 85%)'
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
}> = ({ url, title, isMobile = true }) => {
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  if (!parsed || !parsed.isValid) return null;

  // 1. YouTube Player (Native iframe supported and reliable)
  if (parsed.isNativeIframeSupported && parsed.platform === 'youtube') {
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
            Buka YouTube <ExternalLink size={10} />
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
        margin: '0.85rem 0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
        background: '#000000'
      }}>
        <video 
          controls 
          src={parsed.originalUrl} 
          style={{ width: '100%', maxHeight: '380px', display: 'block' }} 
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
        '--card-accent': parsed.brandAccent,
        '--card-glow': parsed.brandGlow,
        margin: '0.85rem 0',
        width: '100%',
        padding: '1.15rem 1.1rem 1.05rem',
        background: parsed.cardBackground,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '180px',
        cursor: 'pointer'
      } as React.CSSProperties}
      title={`Tonton ${title || parsed.platformLabel} di ${parsed.platformLabel}`}
    >
      {/* Top Header: Badge + Creator Tag / External Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.28rem 0.65rem',
          borderRadius: '999px',
          background: parsed.badgeBg,
          color: '#ffffff',
          fontSize: '0.7rem',
          fontWeight: 800,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          letterSpacing: '0.02em'
        }}>
          <span>{parsed.badgeIcon}</span>
          <span>{parsed.badgeText}</span>
        </div>

        {parsed.creatorHandle ? (
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '0.18rem 0.5rem',
            borderRadius: '5px',
            fontWeight: 600,
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {parsed.creatorHandle}
          </span>
        ) : (
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <ExternalLink size={11} />
          </div>
        )}
      </div>

      {/* Center: Play Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0.65rem 0'
      }}>
        <div 
          className="catavor-play-btn"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            border: `2px solid ${parsed.brandAccent}`,
            boxShadow: `0 0 18px ${parsed.brandGlow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#ffffff'
          }}
        >
          <Play size={22} fill="#ffffff" color="#ffffff" style={{ marginLeft: '3px' }} />
        </div>
      </div>

      {/* Bottom Footer: Video Title + Direct Watch CTA */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.65rem', width: '100%' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '0.15rem'
          }}>
            {title || 'Video Showcase Produk'}
          </div>
          <div style={{
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span>Klik untuk menonton di {parsed.platformLabel}</span>
            <ExternalLink size={10} />
          </div>
        </div>

        <div style={{
          flexShrink: 0,
          padding: '0.32rem 0.7rem',
          borderRadius: '0.45rem',
          background: parsed.badgeBg,
          color: '#ffffff',
          fontSize: '0.7rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <span>Tonton</span>
          <span style={{ fontSize: '0.75rem' }}>&rarr;</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
          style={{ width: '100%', fontSize: '0.82rem', paddingRight: parsed?.isValid ? '115px' : '0.85rem' }}
        />
        {parsed?.isValid && (
          <span style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.66rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '4px',
            background: parsed.badgeBg,
            border: `1px solid rgba(255, 255, 255, 0.25)`,
            color: '#ffffff',
            letterSpacing: '0.02em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem'
          }}>
            <span>{parsed.badgeIcon}</span>
            <span>{parsed.badgeText}</span>
          </span>
        )}
      </div>

      <div style={{
        padding: '0.55rem 0.75rem',
        borderRadius: '0.5rem',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        fontSize: '0.71rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.45
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>🎥 Dukungan Video Multi-Platform</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.69rem' }}>
          Mendukung link video dari <strong>YouTube</strong>, <strong>TikTok</strong> (tautan aplikasi seluler maupun browser desktop), <strong>Instagram Reels</strong>, <strong>Facebook</strong>, dan <strong>X (Twitter)</strong>. Video akan tampil sebagai kartu showcase interaktif yang siap ditonton calon pembeli.
        </div>
      </div>

      {/* Live Video Preview in Form */}
      {parsed?.isValid && (
        <div style={{ marginTop: '0.3rem', padding: '0.65rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Pratinjau Tampilan di Katalog Produk:
          </div>
          <VideoPlayerEmbed url={value} title="Pratinjau Video Produk" />
        </div>
      )}
    </div>
  );
};
