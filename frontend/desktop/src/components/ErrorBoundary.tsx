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
            padding: '2rem',
            margin: '1.5rem auto',
            maxWidth: '560px',
            borderRadius: '1.25rem',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-light, #e2e8f0)',
            boxShadow: '0 12px 30px -6px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AlertTriangle size={26} />
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              Kendala Memuat {sectionTitle}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', lineHeight: 1.5 }}>
              Terjadi kesalahan tak terduga saat me-render komponen ini. Anda dapat mencoba memuat ulang komponen tanpa harus keluar dari sesi aplikasi.
            </p>
          </div>

          <button
            type="button"
            onClick={this.resetError}
            style={{
              marginTop: '0.35rem',
              padding: '0.65rem 1.4rem',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--primary, #1e3a8a)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.2s ease',
              boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)'
            }}
          >
            <RefreshCw size={15} />
            Muat Ulang Komponen Ini
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
