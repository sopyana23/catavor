/**
 * Feature Flag: Merchant Sponsored Ads (Promosi & Iklan Etalase Internal)
 *
 * Saat false (peluncuran awal), pengajuan kampanye iklan internal oleh merchant
 * dan penayangan slot etalase bersponsor di beranda platform ditahan/dinonaktifkan
 * tanpa menghapus implementasi kode yang sudah dibangun.
 *
 * Ubah ke true (bersamaan dengan env backend FEATURE_MERCHANT_SPONSORED_ADS_ENABLED=true)
 * untuk mengaktifkan kembali seluruh modul Promosi & Iklan Internal di masa mendatang.
 */
export const FEATURE_MERCHANT_SPONSORED_ADS_ENABLED = false;
