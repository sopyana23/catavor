import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Check, Search, Filter, X } from 'lucide-react';
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
  zIndex?: number;
}

interface SheetPickerRequest {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  value: string;
  options: MobileSelectOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (val: string) => void;
}

interface MobileSheetStackContextValue {
  pushPicker: (req: SheetPickerRequest) => void;
}

const MobileSheetStackContext = createContext<MobileSheetStackContextValue | null>(null);

interface MobileOptionListProps {
  options: MobileSelectOption[];
  value: string;
  searchable?: boolean;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (val: string) => void;
  isDark?: boolean;
  padding?: string;
}

/** Shared search bar and touch option list used by both in-sheet drill-down and standalone picker. */
const MobileOptionList: React.FC<MobileOptionListProps> = ({
  options,
  value,
  searchable,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  onSelect,
  isDark = true,
  padding = '0.5rem 1.25rem 1.25rem 1.25rem',
}) => {
  const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 7;

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

  const inputBg = isDark ? 'var(--bg-deep, #090d16)' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1';
  const idleRowBg = isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff';
  const idleRowBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const primaryText = isDark ? 'var(--text-primary, #f8fafc)' : '#0f172a';
  const mutedText = isDark ? 'var(--text-muted, #94a3b8)' : '#64748b';

  return (
    <>
      {isSearchEnabled && (
        <div style={{ padding: '0.75rem 1.25rem 0.35rem 1.25rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', color: mutedText, pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '0.55rem 2rem 0.55rem 2.2rem',
                borderRadius: '0.65rem',
                backgroundColor: inputBg,
                border: `1px solid ${inputBorder}`,
                color: primaryText,
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: mutedText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem'
        }}
      >
        {filteredOptions.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: mutedText, fontSize: '0.82rem' }}>
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
                onClick={() => onSelect(opt.value)}
                style={{
                  minHeight: '48px',
                  width: '100%',
                  padding: '0.7rem 0.95rem',
                  borderRadius: '0.85rem',
                  border: isSelected
                    ? '1.5px solid var(--primary, #2563eb)'
                    : `1px solid ${idleRowBorder}`,
                  backgroundColor: isSelected
                    ? 'rgba(37, 99, 235, 0.12)'
                    : idleRowBg,
                  color: isSelected ? 'var(--primary, #2563eb)' : primaryText,
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
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isSelected ? 'var(--primary, #2563eb)' : mutedText }}>
                      {opt.icon}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: isSelected ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span style={{ fontSize: '0.7rem', color: mutedText, marginTop: '0.1rem' }}>
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
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.18)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9'),
                        color: isSelected ? 'var(--primary, #2563eb)' : mutedText
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
                        backgroundColor: 'var(--primary, #2563eb)',
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
    </>
  );
};

export interface MobileSheetStackProps {
  children: React.ReactNode;
  isDark?: boolean;
}

/**
 * Multi-view in-sheet drill-down container: pushes MobileCustomSelect options horizontally
 * inside the active bottom sheet instead of stacking a second modal overlay on top.
 */
export const MobileSheetStack: React.FC<MobileSheetStackProps> = ({ children, isDark = false }) => {
  const stackId = useId();
  const [renderedPicker, setRenderedPicker] = useState<SheetPickerRequest | null>(null);
  const [isPushed, setIsPushed] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const popTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (popTimerRef.current !== null) {
      window.clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const popPicker = useCallback(() => {
    clearTimers();
    setIsPushed(false);
    popTimerRef.current = window.setTimeout(() => {
      setRenderedPicker(null);
      setPickerSearch('');
      popTimerRef.current = null;
    }, 290);
  }, [clearTimers]);

  const pushPicker = useCallback((req: SheetPickerRequest) => {
    clearTimers();
    setPickerSearch('');
    setRenderedPicker(req);
    rafRef.current = window.requestAnimationFrame(() => {
      setIsPushed(true);
      rafRef.current = null;
    });
  }, [clearTimers]);

  useModalBackHandler({
    isOpen: isPushed,
    onClose: popPicker,
    modalId: `mobile_sheet_stack_${stackId}`
  });

  const ctxValue = useMemo<MobileSheetStackContextValue>(() => ({ pushPicker }), [pushPicker]);
  const primaryText = isDark ? '#f8fafc' : '#0f172a';
  const mutedText = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0';

  return (
    <MobileSheetStackContext.Provider value={ctxValue}>
      <div style={{ width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            width: '200%',
            transform: isPushed ? 'translateX(-50%)' : 'translateX(0%)',
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Pane 0: Primary Form View */}
          <div
            aria-hidden={isPushed}
            style={{
              width: '50%',
              flexShrink: 0,
              maxHeight: 'calc(84vh - 36px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              padding: '0 1.25rem 1.75rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxSizing: 'border-box'
            }}
          >
            {children}
          </div>

          {/* Pane 1: Drill-Down Option Picker View (inside same sheet, zero double modal) */}
          <div
            aria-hidden={!isPushed}
            style={{
              width: '50%',
              flexShrink: 0,
              maxHeight: 'calc(84vh - 36px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {renderedPicker && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.15rem 1.25rem 0.75rem 0.9rem',
                    borderBottom: `1px solid ${borderCol}`,
                    touchAction: 'none'
                  }}
                >
                  <button
                    type="button"
                    onClick={popPicker}
                    style={{
                      minHeight: '44px',
                      padding: '0 0.65rem',
                      borderRadius: '0.65rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--primary, #2563eb)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <ChevronLeft size={18} strokeWidth={2.4} />
                    <span>Kembali</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '0.55rem',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        color: 'var(--primary, #2563eb)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {renderedPicker.icon ? renderedPicker.icon : <Filter size={14} />}
                    </div>
                    <div style={{ minWidth: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderedPicker.title}
                      </div>
                      {renderedPicker.subtitle && (
                        <div style={{ fontSize: '0.68rem', color: mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderedPicker.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <MobileOptionList
                  options={renderedPicker.options}
                  value={renderedPicker.value}
                  searchable={renderedPicker.searchable}
                  searchPlaceholder={renderedPicker.searchPlaceholder || 'Cari pilihan...'}
                  searchQuery={pickerSearch}
                  onSearchChange={setPickerSearch}
                  onSelect={(val) => {
                    renderedPicker.onSelect(val);
                    popPicker();
                  }}
                  isDark={isDark}
                  padding="0.75rem 1.25rem 1.75rem 1.25rem"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </MobileSheetStackContext.Provider>
  );
};

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
  zIndex = 200000,
}) => {
  const sheetStack = useContext(MobileSheetStackContext);
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

  // Back button interception conforming to Rule 2 & Mobile Modal standards (standalone portal only)
  useModalBackHandler({
    isOpen: !sheetStack && isOpen && interceptBack,
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

  const handleOpen = () => {
    if (disabled) return;
    if (sheetStack) {
      sheetStack.pushPicker({
        title,
        subtitle,
        icon,
        value,
        options,
        searchable,
        searchPlaceholder,
        onSelect: onChange,
      });
      return;
    }
    setIsOpen(true);
  };

  return (
    <div className={`mobile-custom-select-wrapper ${className}`} style={{ width: '100%', minWidth: 0, ...style }}>
      {/* Trigger Button: Styled as Native Mobile Dropdown or In-Sheet Drill-Down Trigger */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={sheetStack ? undefined : isOpen}
        aria-label={ariaLabel || (selectedOption ? `${title}: ${selectedOption.label}` : placeholder)}
        onClick={handleOpen}
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
          {sheetStack ? (
            <ChevronRight size={16} style={{ color: 'var(--text-muted, #94a3b8)' }} />
          ) : (
            <ChevronDown
              size={16}
              style={{
                color: 'var(--text-muted, #94a3b8)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          )}
        </div>
      </button>

      {/* PORTAL: Standalone Mobile Option Picker Bottom Sheet Modal (when not nested in MobileSheetStack) */}
      {!sheetStack && isOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${selectId}-title`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
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

            <MobileOptionList
              options={options}
              value={value}
              searchable={searchable}
              searchPlaceholder={searchPlaceholder}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleSelect}
              isDark={true}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
