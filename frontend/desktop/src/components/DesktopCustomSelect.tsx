import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownDir, setDropdownDir] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  // Auto-detect direction or apply explicit preference
  useEffect(() => {
    if (!isOpen) return;
    if (direction === 'up') {
      setDropdownDir('up');
      return;
    }
    if (direction === 'down') {
      setDropdownDir('down');
      return;
    }
    // 'auto' calculation
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 220 && spaceAbove > 180) {
        setDropdownDir('up');
      } else {
        setDropdownDir('down');
      }
    }
  }, [isOpen, direction]);

  // Close when clicking outside
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

  return (
    <div
      ref={containerRef}
      className={`desktop-custom-select-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
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
            maxHeight: '260px',
            overflowY: 'auto',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)',
            background: 'var(--card-bg-gradient)',
            backgroundColor: 'var(--bg-card)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 1000,
            padding: '0.35rem',
            boxSizing: 'border-box',
            ...dropdownStyle,
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Tidak ada pilihan
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className="desktop-select-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
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
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          padding: '0.1rem 0.4rem',
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
      )}
    </div>
  );
};
