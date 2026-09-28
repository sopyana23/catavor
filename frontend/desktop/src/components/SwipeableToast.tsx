import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, MessageSquare, X } from 'lucide-react';

export interface ToastItem {
  message: string;
  type?: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export function compactToastMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  let text = msg.trim();

  const replacements: [RegExp, string][] = [
    [/^Item ini berstatus DIARSIPKAN\. Kuota aktif katalog Anda \(\d+\/\d+\) sudah penuh\..*$/i, 'Kuota penuh, arsipkan item lain'],
    [/^Batas katalog aktif \(\d+ item\) telah tercapai\..*$/i, 'Batas kuota item tercapai'],
    [/^Terima kasih\. Laporan #([A-Za-z0-9\-]+).*ke tim kepatuhan\.*$/i, 'Laporan #$1 terkirim'],
    [/^Terima kasih! Ulasan kepuasan Anda berhasil disimpan\.*$/i, 'Ulasan kepuasan tersimpan'],
    [/^Selamat! Katalog Anda berhasil diaktifkan kembali.*$/i, 'Katalog aktif kembali (45 hari)'],
    [/^Selamat! Katalog Anda telah berhasil di-upgrade.*$/i, 'Katalog di-upgrade ke Pro'],
    [/^Masa aktif katalog berhasil diperpanjang 45 hari!*$/i, 'Masa aktif diperpanjang 45 hari'],
    [/^Aksi dinonaktifkan sementara karena status operasional toko sedang dibekukan\.*$/i, 'Aksi nonaktif: toko dibekukan'],
    [/^Mode Pratinjau: Menguji tautan WhatsApp katalog Anda\.\.\.*$/i, 'Menguji tautan WhatsApp...'],
    [/^Otentikasi Google Berhasil! Silakan lengkapi Informasi Katalog.*$/i, 'Google terhubung, lengkapi data'],
    [/^Gagal mendapatkan informasi email dari Google\..*$/i, 'Gagal akses akun Google'],
    [/^Silakan centang persetujuan Syarat & Ketentuan serta Kebijakan Privasi.*$/i, 'Setujui Syarat & Ketentuan'],
    [/^Formulir banding kepatuhan telah disiapkan secara otomatis\.*$/i, 'Formulir banding disiapkan'],
    [/^Maksimum 5 file screenshot\/gambar per pengiriman\.*$/i, 'Maksimal 5 screenshot'],
    [/^Terjadi kesalahan saat mengunggah gambar screenshot\.*$/i, 'Gagal unggah screenshot'],
    [/^Tautan produk berhasil disalin ke papan klip!*$/i, 'Tautan produk disalin'],
    [/^Nomor kasus #([A-Za-z0-9\-]+) disalin ke clipboard\.*$/i, 'Nomor kasus #$1 disalin'],
    [/^Baris ads\.txt disalin ke clipboard$/i, 'ads.txt disalin'],
    [/^Pengaturan Google AdSense & Analytics berhasil disimpan!*$/i, 'Pengaturan Google disimpan'],
    [/^Pengaturan custom domain berhasil disimpan!*$/i, 'Custom domain disimpan'],
    [/^Tindakan moderasi berhasil diterapkan dan audit trail tercatat$/i, 'Moderasi berhasil diterapkan'],
    [/^Siaran berhasil dihapus dari riwayat publikasi$/i, 'Siaran berhasil dihapus'],
    [/^Siaran pengumuman berhasil disebarkan!$/i, 'Siaran berhasil dikirim'],
    [/^Template preset industri berhasil diterapkan ke profil katalog!$/i, 'Preset industri diterapkan'],
    [/^Nama kategori\/opsi berhasil diubah dan disinkronkan!$/i, 'Nama kategori diubah'],
    [/^Logo berhasil dipilih! Klik "Simpan Pengaturan".*$/i, 'Logo dipilih, klik simpan'],
    [/^⚠️ Logo\/Ikon harus berukuran persegi.*$/i, 'Logo harus persegi (1:1)'],
    [/^Akses ditolak atau sesi Anda telah habis.*$/i, 'Sesi habis, login ulang'],
    [/^Sesi Anda berakhir\. Silakan login kembali.*$/i, 'Sesi habis, login ulang'],
    [/^Koneksi internet terputus\. Gagal memperbarui profil\.*$/i, 'Gagal perbarui profil'],
    [/^Koneksi internet bermasalah\. Gagal menyimpan pengaturan\.*$/i, 'Gagal simpan pengaturan'],
    [/^Koneksi terputus ke server saat mengunggah logo\.*$/i, 'Gagal unggah logo'],
    [/^Koneksi terputus ke server\. Periksa jaringan Anda\.*$/i, 'Koneksi server terputus'],
    [/^Terjadi kesalahan koneksi saat beralih profil katalog$/i, 'Gagal beralih katalog'],
    [/^Terjadi kesalahan saat otentikasi Google SSO\.*$/i, 'Gagal login Google'],
    [/^Terjadi kesalahan saat upgrade plan$/i, 'Gagal upgrade plan'],
    [/^Terjadi kesalahan saat mengunggah gambar\. Silakan login ulang\.*$/i, 'Gagal unggah gambar'],
    [/^Koneksi bermasalah\. Gagal menyimpan artikel\.*$/i, 'Gagal simpan artikel'],
    [/^Koneksi bermasalah\. Gagal menghapus artikel\.*$/i, 'Gagal hapus artikel'],
    [/^Koneksi bermasalah\. Gagal mengirim komentar\.*$/i, 'Gagal kirim komentar'],
    [/^Tidak ada opsi pengganti lain yang tersedia untuk menghapus opsi ini\.*$/i, 'Tidak ada opsi pengganti'],
    [/^Status langganan dan kuota berhasil diperbarui!$/i, 'Status langganan diperbarui'],
    [/^Semua notifikasi telah ditandai dibaca!$/i, 'Semua notifikasi dibaca'],
    [/^Riwayat notifikasi terbaca telah dibersihkan!$/i, 'Riwayat notifikasi dibersihkan'],
    [/^Catatan internal CS berhasil disimpan$/i, 'Catatan internal disimpan'],
    [/^Balasan berhasil dikirim ke merchant$/i, 'Balasan terkirim ke merchant'],
    [/^Silakan tambahkan minimal 1 penerima.*$/i, 'Pilih minimal 1 penerima'],
    [/^Silakan pilih toko target terlebih dahulu$/i, 'Pilih toko target dulu'],
    [/^Silakan pilih user target terlebih dahulu$/i, 'Pilih user target dulu'],
    [/^Silakan pilih profil katalog yang ingin Anda kelola\.*$/i, 'Pilih profil katalog dulu'],
    [/^Beralih ke profil katalog "(.*?)"$/i, 'Beralih ke $1'],
    [/^Profil katalog baru "(.*?)" berhasil dibuat!$/i, 'Katalog $1 dibuat'],
  ];

  for (const [pattern, target] of replacements) {
    if (pattern.test(text)) {
      return text.replace(pattern, target);
    }
  }

  text = text.replace(/^Terjadi kesalahan (koneksi )?saat /i, 'Gagal ');
  text = text.replace(/^Terjadi gangguan saat /i, 'Gagal ');
  text = text.replace(/^Koneksi bermasalah\.\s*/i, '');
  text = text.replace(/^Koneksi terputus\.\s*/i, '');
  text = text.replace(/^Koneksi internet bermasalah\.\s*/i, '');
  text = text.replace(/\s+berhasil disimpan!?$/i, ' disimpan');
  text = text.replace(/\s+berhasil ditambahkan!?$/i, ' ditambahkan');
  text = text.replace(/\s+berhasil diperbarui!?$/i, ' diperbarui');
  text = text.replace(/\s+berhasil dihapus!?$/i, ' dihapus');
  text = text.replace(/\s+berhasil diunggah!?$/i, ' diunggah');
  text = text.replace(/\s+ke papan klip!?$/i, '');
  text = text.replace(/\s+ke clipboard\.?$/i, '');
  text = text.replace(/\.\s*Silakan coba lagi\.?$/i, '');
  text = text.replace(/\.\s*Periksa jaringan Anda\.?$/i, '');
  text = text.replace(/^Mohon\s+/i, '');
  text = text.replace(/^Silakan\s+/i, '');

  if (text.length > 38) {
    const trimmed = text.slice(0, 36);
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > 20) {
      text = trimmed.slice(0, lastSpace);
    } else {
      text = trimmed;
    }
  }

  return text;
}

interface SwipeableToastProps {
  toast: ToastItem | null;
  onClose: () => void;
  position?: 'top' | 'bottom';
  className?: string;
}

export const SwipeableToast: React.FC<SwipeableToastProps> = ({
  toast,
  onClose,
  position = 'top',
  className = '',
}) => {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef<number>(3800);
  const startTimeRef = useRef<number>(Date.now());
  const toastRef = useRef<HTMLDivElement>(null);

  // Setup auto-dismiss timer with pause/resume support
  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    remainingTimeRef.current = duration;
    startTimeRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      triggerDismiss('up');
    }, duration);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(800, remainingTimeRef.current - elapsed);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (!timerRef.current && remainingTimeRef.current > 0) {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        triggerDismiss('up');
      }, remainingTimeRef.current);
    }
  }, []);

  // Trigger dismiss with smooth exit animation and haptic vibration
  const triggerDismiss = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (isExiting) return;
    setIsExiting(true);
    setExitDirection(dir);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Haptic pulse if supported
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {
      // Ignore vibration error on unsupported browsers
    }

    setTimeout(() => {
      onClose();
      setIsExiting(false);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
    }, 220);
  }, [isExiting, onClose]);

  // Reset or initialize when toast changes
  useEffect(() => {
    if (toast) {
      setIsExiting(false);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
      const defaultDuration = toast.actionLabel ? 6000 : 3800;
      startTimer(toast.duration || defaultDuration);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, startTimer]);

  if (!toast) return null;

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    pauseTimer();
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    currentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startPosRef.current.x;
    const dy = touch.clientY - startPosRef.current.y;

    // Apply slight resistance to vertical drag if position is top and dragged downwards
    let effectiveDy = dy;
    if (position === 'top' && dy > 0) {
      effectiveDy = dy * 0.3;
    }

    currentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setDragOffset({ x: dx, y: effectiveDy });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const thresholdX = 50;
    const thresholdY = 35;

    if (dx > thresholdX) {
      triggerDismiss('right');
    } else if (dx < -thresholdX) {
      triggerDismiss('left');
    } else if (position === 'top' && dy < -thresholdY) {
      triggerDismiss('up');
    } else if (position === 'bottom' && dy > thresholdY) {
      triggerDismiss('down');
    } else {
      setDragOffset({ x: 0, y: 0 });
      resumeTimer();
    }
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    pauseTimer();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    currentPosRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    let effectiveDy = dy;
    if (position === 'top' && dy > 0) {
      effectiveDy = dy * 0.3;
    }

    currentPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: dx, y: effectiveDy });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragOffset.x;
    const dy = dragOffset.y;
    const thresholdX = 50;
    const thresholdY = 35;

    if (dx > thresholdX) {
      triggerDismiss('right');
    } else if (dx < -thresholdX) {
      triggerDismiss('left');
    } else if (position === 'top' && dy < -thresholdY) {
      triggerDismiss('up');
    } else if (position === 'bottom' && dy > thresholdY) {
      triggerDismiss('down');
    } else {
      setDragOffset({ x: 0, y: 0 });
      resumeTimer();
    }
  };

  const getTransform = () => {
    if (isExiting) {
      switch (exitDirection) {
        case 'right':
          return 'translateX(120vw) translateY(0) rotate(15deg)';
        case 'left':
          return 'translateX(-120vw) translateY(0) rotate(-15deg)';
        case 'up':
          return 'translateX(-50%) translateY(-100px) scale(0.85)';
        case 'down':
          return 'translateX(-50%) translateY(100px) scale(0.85)';
        default:
          return 'translateX(-50%) translateY(-60px) scale(0.9)';
      }
    }

    if (isDragging) {
      const rotation = dragOffset.x * 0.05;
      return `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px) rotate(${rotation}deg)`;
    }

    return 'translateX(-50%) translateY(0) rotate(0deg)';
  };

  const getOpacity = () => {
    if (isExiting) return 0;
    if (isDragging) {
      const distance = Math.sqrt(dragOffset.x * dragOffset.x + dragOffset.y * dragOffset.y);
      return Math.max(0.2, 1 - distance / 160);
    }
    return 1;
  };

  const isSuccess = toast.type === 'success' || !toast.type;
  const isInfo = toast.type === 'info';

  const bgColor = isSuccess
    ? 'rgba(10, 20, 16, 0.94)'
    : isInfo
    ? 'rgba(15, 23, 42, 0.94)'
    : 'rgba(24, 12, 12, 0.94)';

  const borderColor = isSuccess
    ? 'rgba(16, 185, 129, 0.35)'
    : isInfo
    ? 'rgba(56, 189, 248, 0.35)'
    : 'rgba(239, 68, 68, 0.35)';

  const glowShadow = isSuccess
    ? '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 14px rgba(16, 185, 129, 0.25)'
    : isInfo
    ? '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 16px rgba(56, 189, 248, 0.25)'
    : '0 10px 25px -4px rgba(0,0,0,0.5), 0 0 14px rgba(239, 68, 68, 0.25)';

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live="assertive"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`swipeable-toast ${className}`}
      style={{
        position: 'fixed',
        top: position === 'top' ? '18px' : 'auto',
        bottom: position === 'bottom' ? '20px' : 'auto',
        left: '50%',
        transform: getTransform(),
        opacity: getOpacity(),
        transition: isDragging
          ? 'none'
          : isExiting
          ? 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'transform 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease',
        zIndex: 999999,
        padding: '0.52rem 1.05rem',
        borderRadius: '999px',
        backgroundColor: bgColor,
        color: '#f8fafc',
        fontSize: '0.8rem',
        fontWeight: 600,
        boxShadow: glowShadow,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.55rem',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`,
        maxWidth: '92%',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        animation: !isDragging && !isExiting ? 'toast-slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none'
      }}
    >
      {isSuccess ? (
        <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
      ) : isInfo ? (
        <MessageSquare size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
      ) : (
        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
      )}

      <span
        style={{
          letterSpacing: '0.01em',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '75vw',
        }}
      >
        {compactToastMessage(toast.message)}
      </span>

      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toast.onAction?.();
            triggerDismiss('right');
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.18)',
            border: 'none',
            color: '#ffffff',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginLeft: '0.2rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        >
          {toast.actionLabel}
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerDismiss('right');
        }}
        aria-label="Tutup Notifikasi"
        title="Tutup (bisa juga diusap)"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.55)',
          padding: '0.1rem',
          marginLeft: '0.15rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          flexShrink: 0,
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)')}
      >
        <X size={14} />
      </button>
    </div>
  );
};
