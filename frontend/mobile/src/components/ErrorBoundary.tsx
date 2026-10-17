import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../utils/crashReporter.ts';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  sectionName?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[Catavor ErrorBoundary] Error caught in section "${this.props.sectionName || 'Root'}":`, error, errorInfo);
    reportClientError({
      message: error?.message || String(error),
      stack: errorInfo?.componentStack || error?.stack,
      section: this.props.sectionName || 'Root',
      component: errorInfo?.componentStack?.split('\n')[1]?.trim() || '',
    });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        console.error('[Catavor ErrorBoundary] Error in onError callback:', e);
      }
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.error('[Catavor ErrorBoundary] Error in onReset callback:', e);
      }
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error || new Error('Unknown error'), this.resetError);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const sectionTitle = this.props.sectionName || 'Komponen Antarmuka';

      return (
        <div
          role="alert"
          style={{
            padding: '1.5rem',
            margin: '1rem auto',
            maxWidth: '480px',
            borderRadius: '1rem',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-light, #e2e8f0)',
            boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AlertTriangle size={22} />
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              Kendala Memuat {sectionTitle}
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', lineHeight: 1.45 }}>
              Terjadi kesalahan rendering pada bagian ini. Anda dapat mencoba memuat ulang komponen tanpa perlu me-refresh halaman.
            </p>
          </div>

          <button
            type="button"
            onClick={this.resetError}
            style={{
              marginTop: '0.25rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary, #1e3a8a)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'opacity 0.2s ease',
              boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)'
            }}
          >
            <RefreshCw size={14} />
            Muat Ulang Bagian Ini
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
