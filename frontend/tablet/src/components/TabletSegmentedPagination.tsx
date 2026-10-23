import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TabletSegmentedPaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords?: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export const TabletSegmentedPagination: React.FC<TabletSegmentedPaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
  isLoading = false
}) => {
  if (totalPages <= 1 || (typeof totalRecords === 'number' && totalRecords === 0)) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.45rem',
      padding: '0.65rem 0.75rem',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-light)',
      userSelect: 'none'
    }}>
      {/* Information Counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        fontWeight: 500,
        padding: '0 0.25rem'
      }}>
        <span>
          Hal <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> dari{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalPages || 1}</strong>
        </span>
        {typeof totalRecords === 'number' && (
          <span style={{ opacity: 0.85, fontWeight: 600 }}>({totalRecords} data)</span>
        )}
      </div>

      {/* Touch-Friendly Segmented Controls (Min Touch Target 44x44px) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', width: '100%' }}>
        <button
          type="button"
          disabled={currentPage <= 1 || isLoading}
          onClick={() => onPageChange(1)}
          title="Halaman Pertama"
          style={{
            minWidth: '40px',
            minHeight: '40px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            cursor: currentPage <= 1 || isLoading ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 || isLoading ? 0.35 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsLeft size={18} strokeWidth={2} />
        </button>

        <button
          type="button"
          disabled={currentPage <= 1 || isLoading}
          onClick={() => onPageChange(currentPage - 1)}
          title="Halaman Sebelumnya"
          style={{
            minWidth: '44px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            cursor: currentPage <= 1 || isLoading ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 || isLoading ? 0.35 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        {/* Current Page Pill Indicator */}
        <div style={{
          minWidth: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0.85rem',
          borderRadius: '0.6rem',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#10b981',
          fontWeight: 700,
          fontSize: '0.9rem'
        }}>
          {currentPage}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages || isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          title="Halaman Selanjutnya"
          style={{
            minWidth: '44px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            cursor: currentPage >= totalPages || isLoading ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages || isLoading ? 0.35 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages || isLoading}
          onClick={() => onPageChange(totalPages)}
          title="Halaman Terakhir"
          style={{
            minWidth: '40px',
            minHeight: '40px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-light)',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            cursor: currentPage >= totalPages || isLoading ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages || isLoading ? 0.35 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsRight size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
