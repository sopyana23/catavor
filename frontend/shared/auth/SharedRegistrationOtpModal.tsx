import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { sendRegistrationOtpApi, verifyRegistrationOtpApi } from './registrationOtp';

export interface SharedRegistrationOtpModalProps {
  isOpen: boolean;
  email: string;
  recipientName?: string;
  apiBase?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
  initialCooldown?: number;
  initialNotice?: string | null;
  submitLabel?: string;
  onVerified: (verificationToken: string) => void;
  onClose: () => void;
}

export const SharedRegistrationOtpModal: React.FC<SharedRegistrationOtpModalProps> = ({
  isOpen,
  email,
  recipientName = '',
  apiBase = '/api',
  device = 'desktop',
  initialCooldown = 60,
  initialNotice = null,
  submitLabel = 'Verifikasi & Lanjutkan',
  onVerified,
  onClose,
}) => {
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setOtpCode('');
    setErrorMsg(null);
    setInfoMsg(initialNotice || null);
    setCooldown(initialCooldown);
    setDragY(0);
    setIsDragging(false);
    dragStartYRef.current = null;
  }, [isOpen, email, initialCooldown, initialNotice]);

  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const isTouch = device === 'tablet' || device === 'mobile';
  const touchBtnHeight = isTouch ? '46px' : '42px';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otpCode.replace(/\D/g, '');
    if (cleanedOtp.length !== 6) {
      setErrorMsg('Masukkan 6-digit kode OTP angka yang diterima di email.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const result = await verifyRegistrationOtpApi(apiBase, email, cleanedOtp);
    setLoading(false);
    if (result.ok && result.verification_token) {
      onVerified(result.verification_token);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const result = await sendRegistrationOtpApi(apiBase, email, recipientName);
    setLoading(false);
    if (result.ok) {
      setCooldown(60);
      setInfoMsg('Kode OTP baru telah dikirimkan ke email Anda.');
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-reg-otp-title"
      onClick={() => {
        if (!loading) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: device === 'mobile' ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: device === 'mobile' ? 0 : '1.25rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: device === 'mobile' ? '100%' : '440px',
          backgroundColor: '#ffffff',
          borderRadius: device === 'mobile' ? '1.25rem 1.25rem 0 0' : '1.15rem',
          border: '1px solid #e2e8f0',
          padding: device === 'mobile' ? '1.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px))' : '1.85rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
          color: '#0f172a',
          boxSizing: 'border-box',
          maxHeight: device === 'mobile' ? '92dvh' : undefined,
          overflowY: device === 'mobile' ? 'auto' : undefined,
          overscrollBehavior: 'contain',
          transform: device === 'mobile' ? `translateY(${dragY}px)` : undefined,
          transition: device === 'mobile'
            ? (isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)')
            : undefined,
        }}
      >
        <div
          onTouchStart={(e) => {
            if (device !== 'mobile' || loading || e.touches.length !== 1) return;
            dragStartYRef.current = e.touches[0].clientY;
            setIsDragging(true);
          }}
          onTouchMove={(e) => {
            if (device !== 'mobile' || !isDragging || dragStartYRef.current === null) return;
            const delta = e.touches[0].clientY - dragStartYRef.current;
            setDragY(delta > 0 ? delta : delta * 0.18);
          }}
          onTouchEnd={() => {
            if (device !== 'mobile' || !isDragging) return;
            setIsDragging(false);
            dragStartYRef.current = null;
            if (dragY >= 70 && !loading) {
              const targetY = typeof window !== 'undefined' ? window.innerHeight : 720;
              setDragY(targetY);
              setTimeout(() => {
                onClose();
              }, 220);
            } else {
              setDragY(0);
            }
          }}
          style={{
            touchAction: device === 'mobile' ? 'none' : undefined,
          }}
        >
        {device === 'mobile' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem', padding: '0.25rem 0', cursor: 'grab' }}>
            <div style={{ width: '42px', height: '4px', borderRadius: '999px', backgroundColor: '#cbd5e1' }} />
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <h3
            id="shared-reg-otp-title"
            style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}
          >
            Verifikasi Alamat Email
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
            Kode OTP 6-digit telah dikirim ke <strong style={{ color: '#0f172a' }}>{email}</strong>. Masukkan kode untuk melanjutkan pendaftaran toko.
          </p>
        </div>
        </div>

        {infoMsg && (
          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '0.78rem',
              fontWeight: 600,
              lineHeight: 1.45,
            }}
          >
            {infoMsg}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.65rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.78rem',
              fontWeight: 600,
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.45rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.15rem' }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="------"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, ''));
                if (errorMsg) setErrorMsg(null);
              }}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '0.75rem',
                fontSize: '1.85rem',
                fontWeight: 800,
                letterSpacing: '0.6rem',
                textAlign: 'center',
                fontFamily: 'monospace',
                backgroundColor: '#f8fafc',
                border: errorMsg ? '1.5px solid #dc2626' : '1.5px solid #93c5fd',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                fontSize: '0.74rem',
                color: '#64748b',
                marginTop: '0.5rem',
              }}
            >
              <Clock size={13} />
              <span>Kode rahasia berlaku 5 menit (sesi verifikasi 15 menit).</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            style={{
              width: '100%',
              minHeight: touchBtnHeight,
              padding: '0.75rem 1rem',
              fontWeight: 800,
              fontSize: '0.88rem',
              borderRadius: '0.75rem',
              border: 'none',
              backgroundColor: loading || otpCode.length !== 6 ? '#94a3b8' : '#1e3a8a',
              color: '#ffffff',
              cursor: loading || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
            }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{loading ? 'Memverifikasi...' : submitLabel}</span>
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid #e2e8f0',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                minHeight: isTouch ? '44px' : '34px',
                padding: '0.35rem 0.5rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Batal / Ganti Email
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              style={{
                minHeight: isTouch ? '44px' : '34px',
                padding: '0.35rem 0.5rem',
                background: 'none',
                border: 'none',
                color: cooldown > 0 ? '#94a3b8' : '#1d4ed8',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: cooldown > 0 || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim Ulang Kode OTP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SharedRegistrationOtpModal;
