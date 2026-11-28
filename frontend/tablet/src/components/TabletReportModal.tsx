import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  X, 
  Store, 
  Briefcase, 
  Utensils, 
  Smartphone, 
  Building2, 
  PawPrint, 
  Sprout, 
  Package, 
  Check, 
  Mail, 
  ShieldCheck, 
  Send 
} from 'lucide-react';
import { API_BASE } from '../utils/apiClient';
import {
  submitPublicReport,
  MAX_REPORT_NOTES_LENGTH,
  MAX_REPORT_EMAIL_LENGTH,
} from '../../../shared/reporting/submitReport';
import { getCatalogReportReasons, getReportingSectorMeta } from '../../../shared/reporting/reportReasons';
export { getCatalogReportReasons };

export function getReportingSectorInfo(targetType: 'store' | 'item', item?: any): { label: string; color: string; icon: any } {
  const meta = getReportingSectorMeta(targetType, item);
  const iconMap = {
    store: Store,
    service: Briefcase,
    food: Utensils,
    digital: Smartphone,
    property: Building2,
    fauna: PawPrint,
    plant: Sprout,
    physical: Package,
  };
  return { label: meta.label, color: meta.color, icon: iconMap[meta.key] || Package };
}

export interface TabletReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: { type: 'store' | 'item'; item?: any } | null;
  storeSettings: any;
  storeSlug: string;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TabletReportModal: React.FC<TabletReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  storeSettings,
  storeSlug,
  onToast
}) => {
  const [reportReason, setReportReason] = useState<string>('');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [reportEmail, setReportEmail] = useState<string>('');
  const [reportFormError, setReportFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const reasonList = useMemo(() => {
    if (!reportData) return [];
    return getCatalogReportReasons(reportData.type, reportData.item);
  }, [reportData]);

  const sectorInfo = useMemo(() => {
    if (!reportData) return { label: 'Profil', color: '#6366f1', icon: Store };
    return getReportingSectorInfo(reportData.type, reportData.item);
  }, [reportData]);

  const SectorIcon = sectorInfo.icon;

  const targetTitle = useMemo(() => {
    if (!reportData) return '';
    return reportData.type === 'store'
      ? (storeSettings?.store_title ? `Katalog ${storeSettings.store_title}` : 'Profil Katalog Toko Ini')
      : (reportData.item?.name || 'Item Katalog');
  }, [reportData, storeSettings]);

  // Set default reason when reportData changes
  useEffect(() => {
    if (reasonList.length > 0) {
      setReportReason(reasonList[0].id);
    }
    setReportNotes('');
    setReportEmail('');
    setReportFormError(null);
  }, [reportData, reasonList]);

  if (!isOpen || !reportData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentReasonObj = reasonList.find(r => r.id === reportReason);
    const reasonLabel = currentReasonObj ? currentReasonObj.title : 'Pelanggaran Ketentuan';

    setReportFormError(null);
    setIsSubmitting(true);
    try {
      const result = await submitPublicReport({
        apiBase: API_BASE,
        targetTitle,
        payload: {
          target_type: reportData.type === 'store' ? 'catalog' : 'item',
          store_id: storeSettings?.id || 0,
          store_slug: storeSlug || '',
          store_title: storeSettings?.store_title || 'Katalog Digital',
          product_id: reportData.type === 'item' ? reportData.item?.id : null,
          fauna_id: reportData.type === 'item' ? reportData.item?.id : null,
          item_name: reportData.type === 'item' ? reportData.item?.name : null,
          reason_category: reportReason,
          reason_label: reasonLabel,
          description: reportNotes,
          reporter_email: reportEmail,
        },
      });
      if (result.ok) {
        onClose();
        setReportNotes('');
        setReportEmail('');
        onToast(result.message, result.duplicate ? 'info' : 'success');
      } else {
        setReportFormError(result.message);
        onToast(result.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ 
        position: 'fixed',
        inset: 0,
        zIndex: 1000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1.25rem'
      }}
    >
      <div 
        className="animate-scale-up" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          height: 'auto',
          maxHeight: 'min(90vh, 760px)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.28), 0 8px 24px -6px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Pinned Fixed Header */}
        <div style={{
          flexShrink: 0,
          padding: '1.2rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, var(--text-primary))', margin: 0, letterSpacing: '-0.01em' }}>
                {reportData.type === 'store' ? 'Laporkan Profil Katalog' : 'Laporkan Item Katalog'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                Pilih alasan pelanggaran yang paling relevan untuk ditinjau Tim Kepatuhan
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            aria-label="Tutup Modal"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card-hover)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div 
          className="modal-content-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Target Entity Summary Card */}
          <div style={{
            padding: '0.75rem 0.95rem',
            backgroundColor: 'var(--bg-card-hover)',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {reportData.type === 'item' ? (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                flexShrink: 0
              }}>
                <img 
                  src={reportData.item?.image_url || '/placeholder.png'} 
                  alt={reportData.item?.name || ''} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
                flexShrink: 0
              }}>
                <Store size={22} />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}>
                  <SectorIcon size={12} />
                  <span>{sectorInfo.label}</span>
                </span>
                {reportData.item?.class && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    • {reportData.item.class}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-main, var(--text-primary))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {targetTitle}
              </div>
            </div>
          </div>

          {/* Section: Alasan Pelaporan */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-main, var(--text-primary))',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Alasan Pelaporan *
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Disesuaikan untuk {sectorInfo.label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reasonList.map((reason) => {
                const isSelected = reportReason === reason.id;
                return (
                  <div
                    key={reason.id}
                    onClick={() => setReportReason(reason.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
                      backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(239, 68, 68, 0.08)' : 'none'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: isSelected ? '#ef4444' : 'var(--text-main, var(--text-primary))',
                        lineHeight: 1.35
                      }}>
                        {reason.title}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.2rem',
                        lineHeight: 1.35
                      }}>
                        {reason.desc}
                      </div>
                    </div>

                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? 'none' : '1.5px solid var(--border-focus, #94a3b8)',
                      backgroundColor: isSelected ? '#ef4444' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                      transition: 'all 0.15s ease'
                    }}>
                      {isSelected && <Check size={12} strokeWidth={3.5} color="#fff" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Keterangan Tambahan */}
          <div>
            <label style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-main, var(--text-primary))',
              display: 'block',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Keterangan Tambahan (Opsional)
            </label>
            <textarea
              placeholder="Jelaskan rincian atau bukti pelanggaran yang Anda temukan untuk mempermudah investigasi..."
              value={reportNotes}
              maxLength={MAX_REPORT_NOTES_LENGTH}
              onChange={(e) => {
                setReportNotes(e.target.value);
                if (reportFormError) setReportFormError(null);
              }}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-deep, var(--bg-card))',
                color: 'var(--text-main, var(--text-primary))',
                resize: 'none',
                fontSize: '0.84rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {reportNotes.length}/{MAX_REPORT_NOTES_LENGTH} karakter
            </div>
          </div>

          {/* Section: Email Pelapor */}
          <div>
            <label style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-main, var(--text-primary))',
              display: 'block',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Email Pelapor (Opsional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="email@anda.com"
                value={reportEmail}
                maxLength={MAX_REPORT_EMAIL_LENGTH}
                onChange={(e) => {
                  setReportEmail(e.target.value);
                  if (reportFormError) setReportFormError(null);
                }}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-deep, var(--bg-card))',
                  color: 'var(--text-main, var(--text-primary))',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              />
              <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
              Digunakan tim kepatuhan untuk mengirimkan notifikasi status tindak lanjut penanganan laporan.
            </p>
          </div>

          {reportFormError && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: '0.78rem',
                fontWeight: 600,
                lineHeight: 1.4
              }}
            >
              {reportFormError}
            </div>
          )}
        </div>

        {/* Pinned Sticky Footer */}
        <div style={{
          flexShrink: 0,
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
            <span>Laporan dijamin kerahasiaannya dan ditinjau secara objektif oleh Tim Kepatuhan.</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '0 1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-card-hover)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                flex: 2,
                minHeight: '44px',
                padding: '0 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: '8px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabletReportModal;

