import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface DesktopCustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  ariaLabel?: string;
  direction?: 'down' | 'up' | 'auto';
  showCheckmark?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  maxHeight?: number | string;
}

export const DesktopCustomSelect: React.FC<DesktopCustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  icon,
  disabled = false,
  className = '',
  style,
  dropdownStyle,
  ariaLabel,
  direction = 'auto',
  showCheckmark = true,
  searchable,
  searchPlaceholder = 'Cari opsi...',
  maxHeight = 260,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownDir, setDropdownDir] = useState<'down' | 'up'>('down');
  const [searchQuery, setSearchQuery] = useState('');
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const selectId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  // Auto-enable search bar when there are 8 or more items
  const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 8;

  // Filtered options based on user search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.value && opt.value.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Update scroll hints (subtle top & bottom shadows)
  const checkScrollState = () => {
    const el = listRef.current;
    if (!el) return;
    const hasTop = el.scrollTop > 4;
    const hasBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    setCanScrollUp(hasTop);
    setCanScrollDown(hasBottom);
  };

  // Auto-detect direction (up or down) to ensure it stays in viewport
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    if (direction === 'up') {
      setDropdownDir('up');
    } else if (direction === 'down') {
      setDropdownDir('down');
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 260 && spaceAbove > 200) {
        setDropdownDir('up');
      } else {
        setDropdownDir('down');
      }
    }

    // Auto-focus search input if search is active
    if (isSearchEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    // Auto-scroll selected item into view
    setTimeout(() => {
      if (selectedItemRef.current) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      checkScrollState();
    }, 60);
  }, [isOpen, direction, isSearchEnabled]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const parsedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  return (
    <div
      ref={containerRef}
      className={`desktop-custom-select-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        userSelect: 'none',
        zIndex: isOpen ? 60 : 1,
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="desktop-select-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minWidth: 0,
          height: style?.height ? String(style.height) : '40px',
          padding: style?.height && Number(style.height) <= 34 ? '0 0.6rem' : '0 0.85rem',
          borderRadius: '0.6rem',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontSize: style?.height && Number(style.height) <= 34 ? '0.78rem' : '0.84rem',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px var(--primary-glow)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {icon && (
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {icon}
            </span>
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
              color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption && typeof selectedOption.count === 'number' && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                flexShrink: 0,
              }}
            >
              {selectedOption.count}
            </span>
          )}
        </div>

        <ChevronDown
          size={15}
          style={{
            color: isOpen ? 'var(--primary)' : 'var(--text-secondary)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease, color 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Options Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="desktop-select-dropdown animate-fade-in"
          style={{
            position: 'absolute',
            ...(dropdownDir === 'up'
              ? { bottom: 'calc(100% + 6px)', top: 'auto', boxShadow: '0 -12px 32px rgba(0, 0, 0, 0.45), 0 -2px 8px rgba(0, 0, 0, 0.25)' }
              : { top: 'calc(100% + 6px)', bottom: 'auto', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)' }),
            left: 0,
            right: 0,
            minWidth: '100%',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)',
            background: 'var(--card-bg-gradient)',
            backgroundColor: 'var(--bg-card)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 1000,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...dropdownStyle,
          }}
        >
          {/* Optional Sticky Search Filter Box */}
          {isSearchEnabled && (
            <div
              style={{
                padding: '0.45rem 0.5rem',
                borderBottom: '1px solid var(--border-light)',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: '0.55rem',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
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
                    height: '30px',
                    padding: '0 1.5rem 0 1.8rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    outline: 'none',
                    boxSizing: 'border-box',
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
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.4rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Items Container with Professional Capped Max-Height */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            {/* Top Scroll Indicator Shadow */}
            {canScrollUp && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: '6px',
                  height: '14px',
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.25), transparent)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            )}

            <div
              ref={listRef}
              onScroll={checkScrollState}
              className="desktop-select-scroll-area"
              style={{
                maxHeight: parsedMaxHeight,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                scrollBehavior: 'smooth',
                padding: '0.35rem',
                boxSizing: 'border-box',
              }}
            >
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '1rem 0.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {searchQuery ? `Tidak ada opsi "${searchQuery}"` : 'Tidak ada pilihan'}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <div
                      key={opt.value}
                      ref={isSelected ? selectedItemRef : undefined}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className="desktop-select-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.52rem 0.72rem',
                        borderRadius: '0.45rem',
                        fontSize: '0.82rem',
                        lineHeight: 1.35,
                        cursor: 'pointer',
                        color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400,
                        backgroundColor: isSelected ? 'var(--primary-glow)' : 'transparent',
                        transition: 'background-color 0.15s ease, color 0.15s ease',
                        marginBottom: '2px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                        {opt.icon && (
                          <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                            {opt.icon}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                        {typeof opt.count === 'number' && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                              backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(255, 255, 255, 0.06)',
                              padding: '0.1rem 0.42rem',
                              borderRadius: '999px',
                            }}
                          >
                            {opt.count}
                          </span>
                        )}
                        {isSelected && showCheckmark && (
                          <Check size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
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
                  right: '6px',
                  height: '14px',
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.25), transparent)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
