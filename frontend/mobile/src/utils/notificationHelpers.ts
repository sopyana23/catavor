/**
 * Notification Helper Utilities (Mobile)
 * Synchronized with Desktop notification helper logic.
 * Parses categories, moderation cases, contextual action links, and formats timestamps.
 */

export interface ModerationCaseInfo {
  isModeration: boolean;
  isRestored: boolean;
  isStoreRestored: boolean;
  categoryBadge: string;
  reportNumber: string;
  targetType: string;
  targetName: string;
  reason: string;
  notes: string;
  actionTaken: string;
  isAppealEligible: boolean;
  statusBadge: string;
  statusHeadline: string;
  statusColor: string;
  issuedDateStr: string;
}

export function extractTicketFromNotif(item: any): string | null {
  if (!item) return null;
  if (item.action_url) {
    const urlMatch = item.action_url.match(/(?:support_ticket|ticket)=([^&#]+)/i);
    if (urlMatch && urlMatch[1]) return decodeURIComponent(urlMatch[1]);
  }
  const combined = `${item.title || ''} ${item.message || ''} ${item.detail_content || ''}`;
  const codeMatch = combined.match(/#?(TCK-\d{8}-\d+)/i);
  if (codeMatch && codeMatch[1]) return codeMatch[1];
  if (item.ticket_number || item.ticket_id) return String(item.ticket_number || item.ticket_id);
  return null;
}

export function parseModerationCase(notif: any): ModerationCaseInfo {
  const fallback: ModerationCaseInfo = {
    isModeration: false,
    isRestored: false,
    isStoreRestored: false,
    categoryBadge: '',
    reportNumber: '',
    targetType: 'item',
    targetName: '',
    reason: '',
    notes: '',
    actionTaken: '',
    isAppealEligible: false,
    statusBadge: '',
    statusHeadline: '',
    statusColor: '#f43f5e',
    issuedDateStr: ''
  };

  if (!notif) return fallback;

  const category = String(notif.category || '').toUpperCase();
  const actionUrl = String(notif.action_url || notif.actionUrl || '');
  const title = String(notif.title || '');
  const message = String(notif.message || '');
  const detail = String(notif.detail_content || notif.detailContent || '');
  const combined = `${title} ${message} ${detail}`;
  const titleLower = title.toLowerCase();
  const msgLower = message.toLowerCase();

  const isSecurityOrMod =
    category === 'KEAMANAN' ||
    category === 'PEMULIHAN' ||
    category === 'KEPATUHAN' ||
    actionUrl.includes('report=') ||
    titleLower.includes('penonaktifan') ||
    titleLower.includes('penangguhan') ||
    titleLower.includes('pembekuan') ||
    titleLower.includes('dihapus') ||
    titleLower.includes('banned') ||
    titleLower.includes('peringatan') ||
    titleLower.includes('pemulihan') ||
    msgLower.includes('dipulihkan') ||
    msgLower.includes('telah dicabut') ||
    combined.includes('#RPT-');

  if (!isSecurityOrMod) return fallback;

  let reportNumber = '';
  let targetType = 'item';
  let targetName = '';
  let reason = '';
  let notes = '';

  if (actionUrl) {
    try {
      const dummyBase = 'http://localhost';
      const parsedUrl = new URL(actionUrl.startsWith('http') ? actionUrl : `${dummyBase}/${actionUrl.replace(/^\//, '')}`);
      reportNumber = parsedUrl.searchParams.get('report') || '';
      targetType = parsedUrl.searchParams.get('target_type') || 'item';
      targetName = parsedUrl.searchParams.get('target_name') || '';
      reason = parsedUrl.searchParams.get('reason') || '';
      notes = parsedUrl.searchParams.get('notes') || '';
    } catch {}
  }

  if (!reportNumber) {
    const rptMatch = combined.match(/#?(RPT-\d{8}-[A-Za-z0-9]+)/i);
    if (rptMatch) reportNumber = rptMatch[1];
  }

  if (!reason) {
    const reasonMatch =
      combined.match(/Kategori(?:\s+Pelanggaran)?\s*:\s*([^\n\r.]+)/i) ||
      combined.match(/Dugaan(?:\s+Pelanggaran)?\s*:\s*([^\n\r.]+)/i) ||
      combined.match(/Alasan\s*:\s*([^\n\r.]+)/i);
    if (reasonMatch) reason = reasonMatch[1].trim();
    else if (combined.includes('satwa dilindungi')) reason = 'Satwa Dilindungi / Regulasi Keanekaragaman Hayati';
    else if (combined.includes('tidak berizin')) reason = 'Izin Usaha / Dokumen Tidak Lengkap';
    else if (combined.includes('spam')) reason = 'Konten Menyesatkan / Spam';
    else reason = 'Pelanggaran Syarat & Ketentuan Layanan';
  }

  if (!notes) {
    const notesMatch = combined.match(/Catatan(?:\s+Peninjau|\s+Admin)?\s*:\s*["']?([^"'\n\r]+)["']?/i);
    if (notesMatch) notes = notesMatch[1].trim();
    else notes = 'Ditemukan ketidaksesuaian kebijakan atau indikasi pelanggaran pada entitas terkait berdasarkan audit penguji.';
  }

  if (!targetName) {
    const nameMatch =
      combined.match(/produk\s+"([^"]+)"/i) ||
      combined.match(/item\s+"([^"]+)"/i) ||
      combined.match(/toko\s+"([^"]+)"/i) ||
      combined.match(/katalog\s+"([^"]+)"/i) ||
      combined.match(/"([^"]+)"/);
    if (nameMatch) targetName = nameMatch[1].trim();
  }

  const isRestored =
    category === 'PEMULIHAN' ||
    titleLower.includes('dipulihkan') ||
    titleLower.includes('pemulihan') ||
    msgLower.includes('dipulihkan') ||
    msgLower.includes('telah dicabut') ||
    msgLower.includes('aktif kembali');

  const isStoreRestored = isRestored && (titleLower.includes('toko') || titleLower.includes('katalog') || combined.includes('toko Anda'));

  let actionTaken = 'Penonaktifan Sementara Publikasi Item';
  if (isRestored) {
    actionTaken = 'Pemulihan Status Operasional Normal';
  } else if (titleLower.includes('pembekuan') || titleLower.includes('suspend') || combined.includes('toko Anda dibekukan')) {
    actionTaken = 'Penangguhan Operasional Katalog Toko';
  }

  const isAppealEligible = !isRestored;
  const statusBadge = isRestored ? 'Telah Dipulihkan' : 'Tindakan Disipliner';
  const statusHeadline = isRestored
    ? 'Status Operasional Toko & Produk Telah Dipulihkan'
    : 'Penonaktifan Sementara / Pembatasan Visibilitas';
  const statusColor = isRestored ? '#10b981' : '#f43f5e';
  const issuedDateStr = notif.timestamp || notif.time || 'Baru saja';

  return {
    isModeration: true,
    isRestored,
    isStoreRestored,
    categoryBadge: category || (isRestored ? 'PEMULIHAN' : 'KEAMANAN'),
    reportNumber,
    targetType,
    targetName,
    reason,
    notes,
    actionTaken,
    isAppealEligible,
    statusBadge,
    statusHeadline,
    statusColor,
    issuedDateStr
  };
}

export interface NormalizedNotification {
  item: any;
  id: string | number;
  title: string;
  message: string;
  detailContent: string;
  time: string;
  read: boolean;
  type: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
  categoryBorder: string;
  modCase: ModerationCaseInfo;
  isModerationNotif: boolean;
  ticketRef: string | null;
  isTicketNotif: boolean;
  subTab: string;
  settingsTab: string;
  actionUrl: string;
  actionType: 'navigate' | 'external_link' | 'detail' | 'none';
  isDirectNav: boolean;
  isExternal: boolean;
  isDetail: boolean;
  displayLabel: string;
  displayType: 'navigate' | 'external' | 'detail' | null;
}

export function normalizeNotification(item: any): NormalizedNotification {
  const modCase = parseModerationCase(item);
  const isModerationNotif = modCase.isModeration;
  const ticketRef = extractTicketFromNotif(item);
  let rawSubTab = item.link_sub_tab || item.linkSubTab || '';
  if (rawSubTab === 'support') rawSubTab = 'help';
  if (rawSubTab === 'products') rawSubTab = 'items';

  const isTicketNotif =
    !isModerationNotif &&
    (Boolean(ticketRef) ||
      item.type === 'ticket' ||
      rawSubTab === 'help' ||
      (item.title && (item.title.includes('CS Catavor') || item.title.includes('Balasan Baru'))));
  const rawSettingsTab =
    item.link_settings_sub_tab ||
    item.linkSettingsSubTab ||
    item.link_mobile_settings_tab ||
    item.linkMobileSettingsTab ||
    '';

  const actionUrl = item.action_url || item.actionUrl || '';
  const rawActionLabel = item.action_label || item.actionLabel || '';
  const detailContent = item.detail_content || item.detailContent || '';

  let cleanLabel = (rawActionLabel || '').replace(/[→↗›>]/g, '').trim();
  if (
    cleanLabel.toLowerCase().includes('pengumuman lengkap') ||
    cleanLabel.toLowerCase() === 'buka pengumuman' ||
    cleanLabel.toLowerCase() === 'buka menu terkait' ||
    cleanLabel.toLowerCase() === 'buka tautan luar' ||
    cleanLabel.toLowerCase() === 'kunjungi tautan'
  ) {
    cleanLabel = '';
  }

  let rawActionType = item.action_type || item.actionType;
  if (isModerationNotif) {
    rawActionType = 'detail';
  } else if (!rawActionType || rawActionType === 'none') {
    if (isTicketNotif) rawActionType = 'navigate';
    else if (actionUrl) rawActionType = 'external_link';
    else if (rawSubTab) rawActionType = 'navigate';
    else if (detailContent) rawActionType = 'detail';
    else rawActionType = 'none';
  }

  const isDirectNav = (rawActionType === 'navigate' && Boolean(rawSubTab)) || isTicketNotif;
  const isExternal = rawActionType === 'external_link' && Boolean(actionUrl);
  const isDetail = rawActionType === 'detail' || (Boolean(detailContent) && !isDirectNav && !isExternal);

  const tabLabels: Record<string, string> = {
    settings: 'Pengaturan Toko',
    items: 'Katalog Produk',
    subscription: 'Paket Langganan',
    help: 'Pusat Bantuan & Tiket CS',
    analytics: 'Statistik Toko',
    share: 'Bagikan Toko / QR',
    articles: 'Artikel & Berita',
    policies: 'Kebijakan Toko',
    profile: 'Profil Pengguna',
    audit_logs: 'Log Aktivitas',
    rbac: 'Hak Akses Tim'
  };

  let displayLabel = cleanLabel;
  let displayType: 'navigate' | 'external' | 'detail' | null = null;

  if (isTicketNotif) {
    displayType = 'navigate';
    if (!displayLabel) displayLabel = ticketRef ? `Lihat Tiket #${ticketRef}` : 'Buka Pusat Bantuan CS';
  } else if (isDirectNav && rawSubTab) {
    displayType = 'navigate';
    if (!displayLabel) displayLabel = `Buka ${tabLabels[rawSubTab] || rawSubTab}`;
  } else if (isExternal && actionUrl) {
    displayType = 'external';
    if (!displayLabel) {
      try {
        const fullUrl = actionUrl.startsWith('http') ? actionUrl : `https://${actionUrl}`;
        const parsed = new URL(fullUrl);
        displayLabel = `Kunjungi ${parsed.hostname.replace(/^www\./, '')}`;
      } catch {
        displayLabel = 'Buka Tautan Luar';
      }
    }
  } else if (isDetail) {
    displayType = 'detail';
    if (!displayLabel) displayLabel = isModerationNotif ? 'Buka Kasus Kepatuhan' : 'Lihat Rincian';
  }

  // Category Color Theming
  let category = String(item.category || '').toUpperCase();
  let categoryColor = 'var(--primary)';
  let categoryBg = 'var(--primary-glow)';
  let categoryBorder = 'rgba(16, 185, 129, 0.3)';

  if (modCase.isRestored) {
    category = 'PEMULIHAN AKUN';
    categoryColor = '#10b981';
    categoryBg = 'rgba(16, 185, 129, 0.12)';
    categoryBorder = 'rgba(16, 185, 129, 0.35)';
  } else if (isModerationNotif) {
    category = 'KEAMANAN';
    categoryColor = '#f43f5e';
    categoryBg = 'rgba(244, 63, 94, 0.12)';
    categoryBorder = 'rgba(244, 63, 94, 0.35)';
  } else if (isTicketNotif) {
    category = 'BANTUAN CS';
    categoryColor = '#38bdf8';
    categoryBg = 'rgba(56, 189, 248, 0.12)';
    categoryBorder = 'rgba(56, 189, 248, 0.35)';
  } else if (item.type === 'order' || category === 'INVENTARIS') {
    category = category || 'INVENTARIS';
    categoryColor = '#10b981';
    categoryBg = 'rgba(16, 185, 129, 0.12)';
    categoryBorder = 'rgba(16, 185, 129, 0.3)';
  } else if (item.type === 'warning' || category === 'PANDUAN') {
    category = category || 'PANDUAN';
    categoryColor = '#f59e0b';
    categoryBg = 'rgba(245, 158, 11, 0.12)';
    categoryBorder = 'rgba(245, 158, 11, 0.35)';
  } else if (item.type === 'success' || category === 'PROMOSI') {
    category = category || 'FITUR & PROMO';
    categoryColor = '#a855f7';
    categoryBg = 'rgba(168, 85, 247, 0.12)';
    categoryBorder = 'rgba(168, 85, 247, 0.35)';
  } else {
    category = category || 'SISTEM';
    categoryColor = '#94a3b8';
    categoryBg = 'rgba(148, 163, 184, 0.12)';
    categoryBorder = 'rgba(148, 163, 184, 0.25)';
  }

  return {
    item,
    id: item.id,
    title: item.title || 'Notifikasi Baru',
    message: item.message || '',
    detailContent,
    time: item.timestamp || item.time || 'Baru saja',
    read: Boolean(item.read),
    type: item.type || 'info',
    category,
    categoryColor,
    categoryBg,
    categoryBorder,
    modCase,
    isModerationNotif,
    ticketRef,
    isTicketNotif,
    subTab: rawSubTab,
    settingsTab: rawSettingsTab,
    actionUrl,
    actionType: rawActionType,
    isDirectNav,
    isExternal,
    isDetail,
    displayLabel,
    displayType
  };
}
