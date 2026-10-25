import React, { useState, useRef, useEffect, useId, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface TabletSelectOption {
  value: string;
  label: string;
  description?: string;
  count?: number;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  badgeBg?: string;
  disabled?: boolean;
}

export interface TabletCustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TabletSelectOption[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  highlight?: boolean;
  highlightColor?: string;
  highlightBg?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  menuWidth?: number | string;
  direction?: 'down' | 'up' | 'auto';
  align?: 'left' | 'right' | 'auto';
  maxHeight?: number | string;
  clearable?: boolean;
  onClear?: () => void;
  ariaLabel?: string;
  variant?: 'default' | 'filter' | 'compact';
  interceptBack?: boolean;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  openDirection: 'down' | 'up';
}

export const TabletCustomSelect: React.FC<TabletCustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  label,
  icon,
  disabled = false,
  highlight = false,
  highlightColor,
  highlightBg,
  searchable,
  searchPlaceholder = 'Cari pilihan...',
  className = '',
  style,
  triggerStyle,
  menuStyle,
  menuWidth,
  direction = 'auto',
  align = 'auto',
  maxHeight = 280,
  clearable = false,
  onClear,
  ariaLabel,
  variant = 'default',
  interceptBack = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<DropdownPosition | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const selectId = useId();

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Auto-enable search bar when there are 6 or more items, unless explicitly configured
  const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 6;

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.value && opt.value.toLowerCase().includes(q)) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Back button interception conforming to Rule 2 (Hardware/Browser Back closes topmost modal/dropdown)
  useModalBackHandler({
    isOpen: isOpen && interceptBack,
    onClose: () => setIsOpen(false),
    modalId: `tablet_select_${selectId}`
  });

  // Check scroll state for subtle scroll hints
  const checkScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const hasTop = el.scrollTop > 4;
    const hasBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    setCanScrollUp(hasTop);
    setCanScrollDown(hasBottom);
  }, []);

  // Calculate precise fixed positioning for tablet viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const rect = triggerRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Determine target width (at least trigger width, clamped between 220px and tablet screen limits)
    let calculatedWidth: number;
    if (typeof menuWidth === 'number') {
      calculatedWidth = menuWidth;
    } else if (typeof menuWidth === 'string' && menuWidth.endsWith('px')) {
      calculatedWidth = parseFloat(menuWidth);
    } else {
      calculatedWidth = Math.max(rect.width, 240);
    }
    calculatedWidth = Math.min(calculatedWidth, windowWidth - 24);

    // Horizontal alignment calculation
    let calculatedLeft = rect.left;
    if (align === 'right') {
      calculatedLeft = rect.right - calculatedWidth;
    } else if (align === 'auto') {
      if (rect.left + calculatedWidth > windowWidth - 12) {
        calculatedLeft = rect.right - calculatedWidth;
      }
    }
    // Clamp to ensure it doesn't leave the tablet screen
    calculatedLeft = Math.max(12, Math.min(calculatedLeft, windowWidth - calculatedWidth - 12));

    // Vertical direction calculation
    const estimatedMenuHeight = Math.min(
      typeof maxHeight === 'number' ? maxHeight + 80 : 360,
      options.length * 48 + (isSearchEnabled ? 52 : 0) + 20
    );
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;

    let openDirection: 'down' | 'up' = 'down';
    if (direction === 'up') {
      openDirection = 'up';
    } else if (direction === 'down') {
      openDirection = 'down';
    } else {
      // Auto: Flip up if space below is too tight and space above is larger
      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        openDirection = 'up';
      } else {
        openDirection = 'down';
      }
    }

    if (openDirection === 'up') {
      setCoords({
        bottom: windowHeight - rect.top + 6,
        left: calculatedLeft,
        width: calculatedWidth,
        openDirection: 'up'
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left: calculatedLeft,
        width: calculatedWidth,
        openDirection: 'down'
      });
    }
  }, [align, direction, maxHeight, menuWidth, options.length, isSearchEnabled]);

  // Recalculate on open, resize, or parent scroll
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    updatePosition();

    const handleWindowResize = () => updatePosition();
    const handleScroll = (e: Event) => {
      // If scroll happens outside the menu itself, re-align or dismiss if trigger hidden
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      updatePosition();
    };

    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    // Focus search on open if enabled
    if (isSearchEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }

    // Scroll selected item into view
    setTimeout(() => {
      if (selectedItemRef.current) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      checkScrollState();
    }, 60);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition, isSearchEnabled, checkScrollState]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const parsedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  // Trigger min-height based on variant (Standard tablet minimum is 44px)
  const defaultMinHeight = '44px';

  return (
    <div
      className={`tablet-select-wrapper ${className}`}
      style={{
        position: 'relative',
        width: style?.width || (variant === 'filter' ? 'auto' : '100%'),
        display: style?.display || (variant === 'filter' ? 'inline-flex' : 'block'),
        flexShrink: 0,
        ...style
      }}
    >
      {/* Optional Form Field Label */}
      {label && variant !== 'filter' && (
        <label
          htmlFor={selectId}
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '0.35rem',
            color: 'var(--text-primary)'
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button - Native Tablet Touch Target >= 44px */}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || (label ? `${label}: ${selectedOption?.label || placeholder}` : placeholder)}
        onClick={handleTriggerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: variant === 'filter' && !triggerStyle?.width ? 'auto' : (triggerStyle?.width ? String(triggerStyle.width) : '100%'),
          minHeight: triggerStyle?.height ? String(triggerStyle.height) : defaultMinHeight,
          padding: triggerStyle?.padding ? String(triggerStyle.padding) : '0.6rem 0.85rem',
          borderRadius: variant === 'filter' ? '0.65rem' : '0.6rem',
          border: highlight
            ? `1px solid ${highlightColor || 'var(--primary, #1e3a8a)'}`
            : '1px solid var(--border-light, rgba(30, 58, 138, 0.14))',
          backgroundColor: highlight
            ? (highlightBg || (isOpen ? 'var(--bg-card-hover, #f1f5f9)' : 'var(--bg-card, #ffffff)'))
            : (isOpen ? 'var(--bg-card-hover, #f1f5f9)' : 'var(--bg-card, #ffffff)'),
          color: 'var(--text-primary, #0f172a)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: 'none',
          transition: 'background-color 0.15s ease',
          opacity: disabled ? 0.55 : 1,
          boxSizing: 'border-box',
          gap: '0.5rem',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          ...triggerStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {icon && (
            <span
              style={{
                color: highlight || isOpen ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'color 0.18s ease'
              }}
            >
              {icon}
            </span>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, overflow: 'hidden', textAlign: 'left' }}>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                fontSize: '0.85rem',
                fontWeight: selectedOption ? 700 : 500,
                color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
                width: '100%'
              }}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>

            {/* Subtitle / Description preview if available on selected option */}
            {selectedOption?.description && variant !== 'compact' && variant !== 'filter' && (
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  marginTop: '1px',
                  width: '100%'
                }}
              >
                {selectedOption.description}
              </span>
            )}
          </div>

          {/* Badge or Count Pill */}
          {selectedOption && (typeof selectedOption.badge !== 'undefined' || typeof selectedOption.count === 'number') && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: selectedOption.badgeColor || 'var(--primary)',
                backgroundColor: selectedOption.badgeBg || 'var(--primary-glow)',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                flexShrink: 0
              }}
            >
              {selectedOption.badge !== undefined ? selectedOption.badge : selectedOption.count}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {/* Quick Clear Button */}
          {clearable && selectedOption && onClear && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Hapus pilihan"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '999px',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(0,0,0,0.06)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              <X size={12} strokeWidth={2} />
            </span>
          )}

          <ChevronDown
            size={16}
            strokeWidth={2}
            style={{
              color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s ease'
            }}
          />
        </div>
      </button>

      {/* PORTAL OVERLAY: FLOATING TABLET SELECT MENU */}
      {isOpen && coords && typeof document !== 'undefined' && createPortal(
        <>
          {/* Fixed Backdrop: Intercepts taps outside to close smoothly without accidental clicks */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              backgroundColor: 'transparent',
              touchAction: 'manipulation'
            }}
          />

          {/* Floating Dropdown Card */}
          <div
            ref={menuRef}
            role="listbox"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : 'auto',
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '0.85rem',
              border: '1px solid var(--border-light, rgba(30, 58, 138, 0.14))',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24), 0 4px 14px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
              animation: 'tabletSelectPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              ...menuStyle
            }}
          >
            {/* Optional Touch Search Filter Bar */}
            {isSearchEnabled && (
              <div
                style={{
                  padding: '0.65rem 0.75rem',
                  borderBottom: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep, #f8fafc)',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Search
                    size={16}
                    strokeWidth={1.75}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    style={{
                      width: '100%',
                      minHeight: '40px',
                      padding: '0 2rem 0 2.2rem',
                      borderRadius: '0.55rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredOptions.length > 0) {
                        handleSelect(filteredOptions[0].value);
                      }
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        padding: '0.35rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Items Container with Touch Momentum */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              {/* Top Scroll Indicator Shadow */}
              {canScrollUp && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '14px',
                    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.12), transparent)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              )}

              <div
                ref={listRef}
                onScroll={checkScrollState}
                style={{
                  maxHeight: parsedMaxHeight,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  padding: '0.4rem',
                  boxSizing: 'border-box'
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div
                    style={{
                      padding: '1.75rem 1rem',
                      textAlign: 'center',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600
                    }}
                  >
                    {searchQuery ? `Tidak ada pilihan untuk "${searchQuery}"` : 'Tidak ada opsi tersedia'}
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    const isDisabled = opt.disabled;

                    return (
                      <div
                        key={opt.value}
                        ref={isSelected ? selectedItemRef : undefined}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={isDisabled}
                        onClick={() => !isDisabled && handleSelect(opt.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '44px',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.6rem',
                          fontSize: '0.85rem',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          backgroundColor: isSelected
                            ? 'var(--primary-glow, rgba(30, 58, 138, 0.12))'
                            : 'transparent',
                          color: isSelected
                            ? 'var(--primary, #1e3a8a)'
                            : isDisabled
                            ? 'var(--text-muted)'
                            : 'var(--text-primary)',
                          fontWeight: isSelected ? 800 : 600,
                          transition: 'background-color 0.12s ease, transform 0.1s ease',
                          marginBottom: '2px',
                          opacity: isDisabled ? 0.45 : 1,
                          userSelect: 'none',
                          touchAction: 'manipulation',
                          gap: '0.65rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                          {opt.icon && (
                            <span
                              style={{
                                color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0
                              }}
                            >
                              {opt.icon}
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.3
                              }}
                            >
                              {opt.label}
                            </span>

                            {opt.description && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  fontWeight: 500,
                                  lineHeight: 1.25,
                                  marginTop: '2px'
                                }}
                              >
                                {opt.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {/* Badge / Pill */}
                          {(opt.badge !== undefined || typeof opt.count === 'number') && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                color: opt.badgeColor || (isSelected ? 'var(--primary)' : 'var(--text-muted)'),
                                backgroundColor: opt.badgeBg || (isSelected ? 'rgba(30, 58, 138, 0.15)' : 'rgba(0, 0, 0, 0.05)'),
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px'
                              }}
                            >
                              {opt.badge !== undefined ? opt.badge : opt.count}
                            </span>
                          )}

                          {/* Checkmark icon for active selection */}
                          {isSelected && (
                            <Check
                              size={16}
                              strokeWidth={2.5}
                              style={{
                                color: 'var(--primary)',
                                flexShrink: 0
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Scroll Indicator Shadow */}
              {canScrollDown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '14px',
                    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.12), transparent)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
