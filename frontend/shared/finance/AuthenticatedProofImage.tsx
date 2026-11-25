import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

function resolveAuthToken(explicitToken?: string | null): string {
  if (explicitToken && explicitToken.trim() !== '') {
    return explicitToken.trim();
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return (
      window.localStorage.getItem('catavor_token') ||
      window.localStorage.getItem('token') ||
      ''
    );
  }
  return '';
}

export function useAuthenticatedMediaUrl(
  src?: string | null,
  apiToken?: string | null,
  storeSlug?: string | null
): { resolvedUrl: string; loading: boolean; error: boolean } {
  const raw = (src || '').trim();
  const isDirectInline =
    raw === '' || raw.startsWith('data:') || raw.startsWith('blob:');

  const [resolvedUrl, setResolvedUrl] = useState<string>(isDirectInline ? raw : '');
  const [loading, setLoading] = useState<boolean>(!isDirectInline);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!raw) {
      setResolvedUrl('');
      setLoading(false);
      setError(false);
      return;
    }
    if (raw.startsWith('data:') || raw.startsWith('blob:')) {
      setResolvedUrl(raw);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    let objectUrl = '';

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const headers: Record<string, string> = {};
        const tok = resolveAuthToken(apiToken);
        if (tok) {
          headers['Authorization'] = `Bearer ${tok}`;
        }
        if (storeSlug && storeSlug.trim() !== '') {
          headers['X-Store-Slug'] = storeSlug.trim();
        }
        const res = await fetch(raw, {
          method: 'GET',
          credentials: 'include',
          headers,
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedUrl(objectUrl);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setError(true);
          setResolvedUrl('');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [raw, apiToken, storeSlug]);

  return { resolvedUrl, loading, error };
}

export interface AuthenticatedProofImageProps {
  src?: string | null;
  alt?: string;
  apiToken?: string | null;
  storeSlug?: string | null;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (resolvedSrc: string) => void;
  fallbackText?: string;
}

export const AuthenticatedProofImage: React.FC<AuthenticatedProofImageProps> = ({
  src,
  alt = 'Bukti pembayaran',
  apiToken,
  storeSlug,
  className,
  style,
  onClick,
  fallbackText = 'Bukti pembayaran tidak dapat dimuat',
}) => {
  const { resolvedUrl, loading, error } = useAuthenticatedMediaUrl(src, apiToken, storeSlug);

  if (!src) return null;

  if (loading) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          minHeight: '96px',
          background: 'var(--bg-secondary, rgba(148,163,184,0.1))',
          color: 'var(--text-muted, #64748b)',
          borderRadius: '8px',
          fontSize: '0.78rem',
          ...style,
        }}
      >
        <Loader2 size={16} className="spin" />
        <span>Memuat bukti...</span>
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          minHeight: '96px',
          padding: '0.75rem',
          background: 'var(--bg-secondary, rgba(148,163,184,0.1))',
          color: 'var(--text-muted, #64748b)',
          borderRadius: '8px',
          fontSize: '0.76rem',
          textAlign: 'center',
          ...style,
        }}
      >
        <ImageOff size={18} />
        <span>{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      style={{
        cursor: onClick ? 'zoom-in' : style?.cursor,
        ...style,
      }}
      onClick={onClick ? () => onClick(resolvedUrl) : undefined}
    />
  );
};
