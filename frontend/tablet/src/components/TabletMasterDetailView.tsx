import React, { type ReactNode } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export interface TabletMasterDetailViewProps {
  title: string;
  subtitle?: string;
  hideHeaderTitle?: boolean;
  hideBackButton?: boolean;
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
  hideHeaderTitle = false,
  hideBackButton = false,
  headerAction,
  masterPane,
  detailPane,
  emptyDetailMessage = 'Pilih salah satu item dari daftar di samping untuk melihat rincian lengkap.',
  selectedId,
  onClearSelection
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(800);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.clientWidth > 0) {
      setContainerWidth(el.clientWidth);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When container width is below 700px (e.g. narrow tablet or expanded sidebar),
  // adapt seamlessly to focused single-pane mode to prevent squeezed columns
  const isNarrowTablet = containerWidth < 700;
  const isSpaciousTablet = containerWidth >= 900;

  const showMaster = !isNarrowTablet || !selectedId;
  const showDetail = !isNarrowTablet || Boolean(selectedId);

  // Back button is only relevant in single-pane mode (narrow tablet) when a detail view is active,
  // because on wide tablet both master list and detail pane are already visible side-by-side.
  const showBackButton = !hideBackButton && isNarrowTablet && Boolean(selectedId && onClearSelection);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-deep)'
      }}
    >
      {/* Top Tablet Sub-Header Toolbar */}
      {(!hideHeaderTitle || showBackButton || headerAction) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: hideHeaderTitle ? '0.5rem 1.25rem' : '0.75rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {showBackButton && (
              <button
                type="button"
                id="btn-back-to-master"
                data-testid="btn-back-to-master"
                onClick={onClearSelection}
                aria-label="Kembali ke daftar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  minHeight: '38px',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.82rem'
                }}
              >
                <ArrowLeft size={18} />
                <span>Kembali ke Daftar</span>
              </button>
            )}
            {!hideHeaderTitle && (
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
            )}
          </div>

          {headerAction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {headerAction}
            </div>
          )}
        </div>
      )}

      {/* Two-Pane Master-Detail Content */}
      <div style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Left Pane: Master List */}
        {showMaster && (
          <div style={{
            width: isNarrowTablet ? '100%' : isSpaciousTablet ? '35%' : '38%',
            minWidth: isNarrowTablet ? '100%' : '270px',
            maxWidth: isNarrowTablet ? '100%' : isSpaciousTablet ? '380px' : '320px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isNarrowTablet ? 'none' : '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-deep)',
            overflow: 'hidden',
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {masterPane}
          </div>
        )}

        {/* Right Pane: Detail View */}
        {showDetail && (
          <div style={{
            flex: 1,
            width: isNarrowTablet ? '100%' : 'auto',
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
        )}
      </div>
    </div>
  );
};
