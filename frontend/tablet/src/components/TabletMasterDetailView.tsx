import React, { type ReactNode } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export interface TabletMasterDetailViewProps {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  masterPane: ReactNode;
  detailPane: ReactNode | null;
  emptyDetailMessage?: string;
  selectedId: string | number | null;
  onClearSelection?: () => void;
}

export const TabletMasterDetailView: React.FC<TabletMasterDetailViewProps> = ({
  title,
  subtitle,
  headerAction,
  masterPane,
  detailPane,
  emptyDetailMessage = 'Pilih salah satu item dari daftar di samping untuk melihat rincian lengkap.',
  selectedId,
  onClearSelection
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'calc(100vh - 64px)',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-deep)'
    }}>
      {/* Top Tablet Sub-Header Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {selectedId && onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Kembali ke daftar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {headerAction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {headerAction}
          </div>
        )}
      </div>

      {/* Two-Pane Master-Detail Content */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Left Pane: Master List (38% width, scrollable, with pagination at bottom) */}
        <div style={{
          width: '38%',
          minWidth: '320px',
          maxWidth: '420px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-deep)',
          overflow: 'hidden'
        }}>
          {masterPane}
        </div>

        {/* Right Pane: Detail View (62% width, rich inspector panel) */}
        <div style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {detailPane ? (
            detailPane
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px dashed var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: 'var(--text-muted)'
              }}>
                <ClipboardList size={30} strokeWidth={1.5} />
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                Tidak Ada Item Terpilih
              </h4>
              <p style={{ fontSize: '0.88rem', maxWidth: '340px', lineHeight: 1.5, margin: 0 }}>
                {emptyDetailMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
