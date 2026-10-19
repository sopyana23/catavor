import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../utils/crashReporter';

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
    console.error(`[Catavor Tablet ErrorBoundary] Error in "${this.props.sectionName || 'Root'}":`, error, errorInfo);
    reportClientError({
      message: error?.message || String(error),
      stack: errorInfo?.componentStack || error?.stack,
      section: this.props.sectionName || 'TabletRoot',
      component: errorInfo?.componentStack?.split('\n')[1]?.trim() || '',
    });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        console.error('[Catavor Tablet ErrorBoundary] Error in onError callback:', e);
      }
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.error('[Catavor Tablet ErrorBoundary] Error in onReset callback:', e);
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

      return (
        <div style={{
          minHeight: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderRadius: '1rem',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          margin: '1.5rem',
          gap: '1rem'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <AlertTriangle size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Terjadi Kendala pada Bagian {this.props.sectionName || 'Tablet'}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '420px', margin: 0 }}>
              Sistem telah mengamankan tampilan agar tidak menutup seluruh aplikasi.
            </p>
          </div>
          <button
            onClick={this.resetError}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Coba Muat Ulang Bagian Ini
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
