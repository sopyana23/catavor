import React, { useRef, useEffect } from 'react';

export interface FilterTagItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ size?: number | string; color?: string; style?: React.CSSProperties }>;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}

export interface TabletScrollableFilterTagsProps {
  items: FilterTagItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  containerBg?: string;
}

export const TabletScrollableFilterTags: React.FC<TabletScrollableFilterTagsProps> = ({
  items,
  selectedId,
  onSelect,
  ariaLabel = 'Filter Tags',
  containerBg = 'var(--bg-deep)'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Mouse drag-to-scroll support for tablet trackpads & mice
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Scroll active item into view smoothly on change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tag-id="${selectedId}"]`) as HTMLElement;
    if (activeEl) {
      const containerRect = el.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      if (activeRect.left < containerRect.left + 24 || activeRect.right > containerRect.right - 24) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedId]);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: containerBg,
        overflow: 'hidden'
      }}
    >
      {/* Horizontal Scroll Track without Chevron Indicators */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          overflowX: 'auto',
          padding: '0.35rem 0.65rem',
          width: '100%',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: isDraggingRef.current ? 'grabbing' : 'default',
          userSelect: 'none'
        }}
      >
        {items.map((item) => {
          const isSelected = selectedId === item.id;
          const Icon = item.icon;

          const itemColor = isSelected ? (item.color || 'var(--primary)') : 'var(--text-secondary)';
          const itemBg = isSelected ? (item.bgColor || 'rgba(30, 58, 138, 0.12)') : 'var(--bg-card)';
          const itemBorder = isSelected
            ? (item.borderColor || item.color || 'var(--primary)')
            : 'var(--border-light)';

          return (
            <button
              key={item.id}
              type="button"
              data-tag-id={item.id}
              onClick={() => {
                if (hasMovedRef.current) return;
                onSelect(item.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: '34px',
                padding: '0.28rem 0.72rem',
                borderRadius: '999px',
                border: `1.5px solid ${itemBorder}`,
                backgroundColor: itemBg,
                color: itemColor,
                fontSize: '0.76rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              {Icon && (
                <Icon
                  size={14}
                  color={isSelected ? (item.color || 'var(--primary)') : 'var(--text-muted)'}
                  style={{ flexShrink: 0 }}
                />
              )}
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0 5px',
                    borderRadius: '999px',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    lineHeight: '16px',
                    backgroundColor: isSelected ? 'rgba(0,0,0,0.08)' : 'var(--bg-deep)',
                    color: isSelected ? itemColor : 'var(--text-muted)',
                    marginLeft: '0.15rem'
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
