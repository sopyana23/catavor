export interface ItemModerationMeta {
  status: string;
  label: string;
  shortLabel: string;
  title: string;
  bannerTitle: string;
  bannerDescription: string;
  color: string;
  bg: string;
  border: string;
  isLocked: boolean;
  isModerated: boolean;
}

export function getItemModerationMeta(status?: string | null): ItemModerationMeta | null {
  const normalized = String(status || '').trim().toLowerCase();
  switch (normalized) {
    case 'needs_fix':
      return {
        status: 'needs_fix',
        label: 'Perlu Perbaikan',
        shortLabel: 'Perlu Edit',
        title: 'Item perlu perbaikan data sesuai catatan tim kepatuhan sebelum ditinjau ulang',
        bannerTitle: 'Item Memerlukan Perbaikan Data',
        bannerDescription: 'Tim kepatuhan menyembunyikan item ini sementara agar Anda dapat mengedit informasi produk dan mengajukan peninjauan ulang.',
        color: '#d97706',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(245, 158, 11, 0.35)',
        isLocked: false,
        isModerated: true
      };
    case 'in_review':
      return {
        status: 'in_review',
        label: 'Ditinjau Ulang',
        shortLabel: 'Ditinjau',
        title: 'Perbaikan item sedang dalam antrean peninjauan ulang tim kepatuhan',
        bannerTitle: 'Sedang Ditinjau Ulang Tim Kepatuhan',
        bannerDescription: 'Pengajuan perbaikan Anda sudah diterima. Pengeditan dan aktivasi dikunci sementara hingga evaluasi kepatuhan selesai.',
        color: '#2563eb',
        bg: 'rgba(37, 99, 235, 0.12)',
        border: 'rgba(37, 99, 235, 0.32)',
        isLocked: true,
        isModerated: true
      };
    case 'locked':
    case 'hidden':
      return {
        status: normalized,
        label: 'Terkunci (Moderasi)',
        shortLabel: 'Terkunci',
        title: 'Dinonaktifkan dan dikunci sementara oleh tim moderasi platform',
        bannerTitle: 'Item Dikunci oleh Tim Moderasi',
        bannerDescription: 'Item ini dinonaktifkan dan dikunci dari pengeditan mandiri karena dugaan pelanggaran kebijakan. Ajukan banding kepatuhan melalui Pusat Bantuan jika diperlukan.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.32)',
        isLocked: true,
        isModerated: true
      };
    case 'banned':
      return {
        status: 'banned',
        label: 'Diblokir Permanen',
        shortLabel: 'Diblokir',
        title: 'Diblokir permanen oleh tim moderasi platform',
        bannerTitle: 'Item Diblokir Permanen',
        bannerDescription: 'Item ini telah diblokir secara permanen karena pelanggaran berat standar komunitas.',
        color: '#b91c1c',
        bg: 'rgba(185, 28, 28, 0.14)',
        border: 'rgba(185, 28, 28, 0.35)',
        isLocked: true,
        isModerated: true
      };
    default:
      return null;
  }
}
