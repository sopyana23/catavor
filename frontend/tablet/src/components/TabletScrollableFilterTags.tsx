import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, items]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = Math.max(180, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Scroll active item into view smoothly on change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tag-id="${selectedId}"]`) as HTMLElement;
    if (activeEl) {
      const containerRect = el.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      if (activeRect.left < containerRect.left + 36 || activeRect.right > containerRect.right - 36) {
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
        display: 'flex',
        alignItems: 'center',
        backgroundColor: containerBg,
        overflow: 'hidden'
      }}
    >
      {/* Left Scroll Chevron & Gradient Fade Indicator */}
      {canScrollLeft && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '42px',
            background: `linear-gradient(to right, ${containerBg} 65%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: '0.25rem',
            zIndex: 3
          }}
        >
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label="Geser filter ke kiri"
            title="Geser ke kiri"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          overflowX: 'auto',
          padding: '0.35rem 0.6rem',
          width: '100%',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
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
              onClick={() => onSelect(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: '34px',
                padding: '0.28rem 0.7rem',
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

      {/* Right Scroll Chevron & Gradient Fade Indicator */}
      {canScrollRight && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '42px',
            background: `linear-gradient(to left, ${containerBg} 65%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '0.25rem',
            zIndex: 3
          }}
        >
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label="Geser filter ke kanan"
            title="Geser ke kanan"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
