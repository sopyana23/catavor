import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, Filter } from 'lucide-react';
import { useModalBackHandler } from '../utils/navigation';

export interface MobileSelectOption {
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

export interface MobileCustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MobileSelectOption[];
  placeholder?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
  ariaLabel?: string;
  interceptBack?: boolean;
}

export const MobileCustomSelect: React.FC<MobileCustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  title = 'Pilih Opsi',
  subtitle,
  icon,
  disabled = false,
  searchable,
  searchPlaceholder = 'Cari pilihan...',
  className = '',
  style,
  triggerStyle,
  ariaLabel,
  interceptBack = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const selectId = useId();

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Auto-enable search bar when there are 7 or more items, unless explicitly configured
  const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 7;

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

  // Back button interception conforming to Rule 2 & Mobile Modal standards
  useModalBackHandler({
    isOpen: isOpen && interceptBack,
    onClose: () => setIsOpen(false),
    modalId: `mobile_select_${selectId}`
  });

  // Drag physics tracking
  const handleDragStart = (clientY: number) => {
    touchStartY.current = clientY;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - touchStartY.current;
    if (delta > 0) {
      setDragY(delta);
    } else {
      // Rubber-banding damping for dragging upwards
      setDragY(delta * 0.18);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 70) {
      setIsOpen(false);
    }
    setDragY(0);
  };

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`mobile-custom-select-wrapper ${className}`} style={{ width: '100%', minWidth: 0, ...style }}>
      {/* Trigger Button: Styled as Native Mobile Dropdown Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel || (selectedOption ? `${title}: ${selectedOption.label}` : placeholder)}
        onClick={() => !disabled && setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          minHeight: '44px',
          width: '100%',
          padding: '0.55rem 0.85rem',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-card, #0f172a)',
          border: '1.5px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          color: 'var(--text-primary, #ffffff)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'border-color 0.18s ease, background-color 0.18s ease',
          ...triggerStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {icon ? (
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--primary, #38bdf8)' }}>
              {icon}
            </span>
          ) : (
            <Filter size={15} style={{ flexShrink: 0, color: 'var(--primary, #38bdf8)' }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {selectedOption && (typeof selectedOption.count === 'number' || selectedOption.badge !== undefined) && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.12rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: selectedOption.badgeBg || 'rgba(56, 189, 248, 0.15)',
                color: selectedOption.badgeColor || '#38bdf8'
              }}
            >
              {selectedOption.badge !== undefined ? selectedOption.badge : selectedOption.count}
            </span>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-muted, #94a3b8)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />
        </div>
      </button>

      {/* PORTAL: Mobile Option Picker Bottom Sheet Modal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${selectId}-title`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 14000,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              margin: '0 auto',
              maxHeight: '82vh',
              backgroundColor: 'var(--bg-card, #0f172a)',
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.15))',
              borderBottom: 'none',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              transform: `translateY(${Math.max(0, dragY)}px)`,
              transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              boxSizing: 'border-box'
            }}
          >
            {/* Apple-style Smooth Drag Handle Bar (Touch Action Isolation) */}
            <div
              style={{
                width: '100%',
                padding: '0.75rem 0 0.35rem 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'grab',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDragEnd}
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onMouseMove={(e) => handleDragMove(e.clientY)}
              onMouseUp={handleDragEnd}
            >
              <div
                style={{
                  width: '38px',
                  height: '4px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--border-strong, rgba(255, 255, 255, 0.25))'
                }}
              />
            </div>

            {/* Header: Clean, Professional Vector Icon (No 'X' button as per Rule 06) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.5rem 1.25rem 0.75rem 1.25rem',
                borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                touchAction: 'none'
              }}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDragEnd}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  flexShrink: 0
                }}
              >
                {icon ? icon : <Filter size={16} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <h3
                  id={`${selectId}-title`}
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: 'var(--text-primary, #ffffff)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {title}
                </h3>
                {subtitle && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.1rem' }}>
                    {subtitle}
                  </span>
                )}
              </div>
            </div>

            {/* Search Input for Option Picker (if enabled) */}
            {isSearchEnabled && (
              <div style={{ padding: '0.75rem 1.25rem 0.35rem 1.25rem' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted, #94a3b8)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'var(--bg-deep, #090d16)',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                      color: 'var(--text-primary, #ffffff)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted, #94a3b8)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.2rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Option Rows (Touch Target >= 44px, Overscroll Contain) */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                padding: '0.5rem 1.25rem 1.25rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}
            >
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.82rem' }}>
                  Tidak ada opsi yang sesuai
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      style={{
                        minHeight: '48px',
                        width: '100%',
                        padding: '0.7rem 0.95rem',
                        borderRadius: '0.85rem',
                        border: isSelected
                          ? '1.5px solid var(--primary, #38bdf8)'
                          : '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                        backgroundColor: isSelected
                          ? 'rgba(56, 189, 248, 0.12)'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: isSelected ? '#38bdf8' : 'var(--text-primary, #ffffff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        cursor: opt.disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                        {opt.icon && (
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isSelected ? '#38bdf8' : 'var(--text-muted, #94a3b8)' }}>
                            {opt.icon}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: isSelected ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.label}
                          </span>
                          {opt.description && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.1rem' }}>
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {typeof opt.count === 'number' && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.12rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                              color: isSelected ? '#38bdf8' : 'var(--text-muted, #94a3b8)'
                            }}
                          >
                            {opt.count}
                          </span>
                        )}
                        {isSelected && (
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '999px',
                              backgroundColor: '#38bdf8',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Check size={13} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
