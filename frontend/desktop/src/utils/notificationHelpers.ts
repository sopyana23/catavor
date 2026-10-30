/**
 * Notification Helper Utilities (Desktop)
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
    category === 'PERBAIKAN' ||
    category === 'PERINGATAN' ||
    category === 'BAHAYA' ||
    category === 'DANGER' ||
    String((notif as any).type || '') === 'danger' ||
    actionUrl.includes('report=') ||
    actionUrl.includes('action=item_banned') ||
    actionUrl.includes('action=catalog_banned') ||
    actionUrl.includes('action=account_banned') ||
    titleLower.includes('penonaktifan') ||
    titleLower.includes('penangguhan') ||
    titleLower.includes('pemblokiran') ||
    titleLower.includes('penghapusan') ||
    titleLower.includes('pembekuan') ||
    titleLower.includes('dihapus') ||
    titleLower.includes('banned') ||
    titleLower.includes('blokir') ||
    titleLower.includes('peringatan') ||
    titleLower.includes('pemulihan') ||
    msgLower.includes('dipulihkan') ||
    msgLower.includes('telah dicabut') ||
    combined.includes('#RPT-');

  if (!isSecurityOrMod) return fallback;

  // Informational resubmission acknowledgements / reviews are status notices, not punitive sanction cases
  const isSubmissionAck =
    titleLower.includes('pengajuan ulang') ||
    titleLower.includes('pengajuan perbaikan') ||
    titleLower.includes('perbaikan produk diterima') ||
    titleLower.includes('perbaikan produk terkirim') ||
    msgLower.includes('antrean peninjauan') ||
    msgLower.includes('telah kami terima dan masuk antrean') ||
    msgLower.includes('masuk dalam antrean peninjauan');

  if (isSubmissionAck) return fallback;

  let reportNumber = '';
  let parsedTargetType = '';
  let targetName = '';
  let reason = '';
  let notes = '';

  if (actionUrl) {
    try {
      const dummyBase = 'http://localhost';
      const parsedUrl = new URL(actionUrl.startsWith('http') ? actionUrl : `${dummyBase}/${actionUrl.replace(/^\//, '')}`);
      reportNumber = parsedUrl.searchParams.get('report') || '';
      parsedTargetType = parsedUrl.searchParams.get('target_type') || '';
      targetName = parsedUrl.searchParams.get('target_name') || '';
      reason = parsedUrl.searchParams.get('reason') || '';
      notes = parsedUrl.searchParams.get('notes') || '';
    } catch {}
  }

  if (!notes && (notif.admin_notes || notif.adminNotes || notif.moderation_reason || notif.notes)) {
    notes = String(notif.admin_notes || notif.adminNotes || notif.moderation_reason || notif.notes).trim();
  }

  if (!reportNumber) {
    const rptMatch = combined.match(/#?(RPT-\d{8}-[A-Za-z0-9]+)/i);
    if (rptMatch) reportNumber = rptMatch[1];
  }

  if (!reason) {
    const reasonMatch =
      combined.match(/Kategori(?:\s+Pelanggaran|\s+Dugaan\s+Pelanggaran|\s+Evaluasi)?\s*:\s*([^\n\r.]+)/i) ||
      combined.match(/Dugaan(?:\s+Pelanggaran)?\s*:\s*([^\n\r.]+)/i) ||
      combined.match(/Alasan\s*:\s*([^\n\r.]+)/i) ||
      combined.match(/Kategori Dugaan Pelanggaran:\s*\*\*([^\*]+)\*\*/i);
    if (reasonMatch) reason = reasonMatch[1].trim();
    else if (combined.includes('satwa dilindungi')) reason = 'Satwa Dilindungi / Regulasi Keanekaragaman Hayati';
    else if (combined.includes('tidak berizin')) reason = 'Izin Usaha / Dokumen Tidak Lengkap';
    else if (combined.includes('spam')) reason = 'Konten Menyesatkan / Spam';
    else reason = 'Pelanggaran Syarat & Ketentuan Layanan';
  }

  if (reason) {
    reason = reason.replace(/\*\*/g, '').replace(/^\*+|\*+$/g, '').trim();
  }

  if (!notes) {
    const notesMatch =
      combined.match(/Pesan Peninjau[:\*]*\s*["“]([\s\S]*?)["”]/i) ||
      combined.match(/Catatan(?:\s+Resmi)?(?:\s+Tim)?(?:\s+Kepatuhan|\s+Peninjau|\s+Admin|\s+Penguji)?[:\*]*\s*(?:>\s*(?:💬\s*)?(?:\*\*Pesan Peninjau:\*\*\s*)?)?["“]([\s\S]*?)["”]/i) ||
      combined.match(/Catatan & Temuan Peninjau[^:]*:\s*>\s*["“]([\s\S]*?)["”]/i) ||
      combined.match(/Catatan Resmi Kepatuhan:\s*<em>"([^"]+)"<\/em>/i) ||
      combined.match(/Catatan(?:\s+Peninjau|\s+Admin|\s+Kepatuhan|\s+Resmi)?\s*:\s*["']([^"'\r\n]+)["']/i);
    if (notesMatch && notesMatch[1] && notesMatch[1].trim()) {
      notes = notesMatch[1].trim();
    }
  }

  if (notes) {
    notes = notes.replace(/\*\*/g, '').replace(/^["'“]+|["'”]+$/g, '').trim();
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

  if (targetName) {
    targetName = targetName.replace(/\*\*/g, '').replace(/^["'*]+|["'*]+$/g, '').trim();
  }

  const isBannedCase =
    category === 'BAHAYA' ||
    category === 'DANGER' ||
    titleLower.includes('banned') ||
    titleLower.includes('blokir') ||
    titleLower.includes('pemblokiran') ||
    titleLower.includes('penghapusan') ||
    titleLower.includes('permanen') ||
    titleLower.includes('dihapus') ||
    msgLower.includes('diblokir secara permanen') ||
    msgLower.includes('dihapus secara permanen') ||
    msgLower.includes('dinonaktifkan secara permanen') ||
    msgLower.includes('telah diblokir') ||
    msgLower.includes('telah dihapus') ||
    (Boolean(actionUrl) && (actionUrl.includes('action=item_banned') || actionUrl.includes('action=catalog_banned') || actionUrl.includes('action=account_banned')));

  const isRestored = !isBannedCase && (
    category === 'PEMULIHAN' ||
    category.includes('PULIH') ||
    titleLower.includes('dipulihkan') ||
    titleLower.includes('pemulihan') ||
    titleLower.includes('pulih') ||
    titleLower.includes('aktif kembali') ||
    titleLower.includes('restored') ||
    msgLower.includes('berhasil dipulihkan') ||
    msgLower.includes('resmi dicabut') ||
    msgLower.includes('telah dicabut') ||
    msgLower.includes('telah diaktifkan kembali')
  );

  const hasStoreClues =
    parsedTargetType === 'store' ||
    parsedTargetType === 'catalog' ||
    actionUrl.includes('target_type=catalog') ||
    actionUrl.includes('target_type=store') ||
    titleLower.includes('profil katalog') ||
    titleLower.includes('operasional profil') ||
    titleLower.includes('akun &') ||
    titleLower.includes('akun dan') ||
    titleLower.includes('akun pemilik') ||
    detail.toLowerCase().includes('status penonaktifan akun') ||
    detail.toLowerCase().includes('status pembekuan operasional');

  const hasItemClues =
    parsedTargetType === 'item' ||
    actionUrl.includes('target_type=item') ||
    titleLower.includes('item') ||
    titleLower.includes('produk') ||
    msgLower.includes('item katalog') ||
    msgLower.includes('produk "') ||
    msgLower.includes('item "') ||
    detail.toLowerCase().includes('entitas item') ||
    detail.toLowerCase().includes('item katalog **') ||
    detail.toLowerCase().includes('item terkait');

  const isExplicitStore = (hasStoreClues && !hasItemClues) || (hasStoreClues && (titleLower.includes('akun &') || titleLower.includes('akun dan') || titleLower.includes('profil katalog')));
  const isExplicitItem = !isExplicitStore;
  let targetType = isExplicitStore ? 'store' : 'item';

  const isStoreRestored = isRestored && isExplicitStore;

  const isNeedsFixCase = titleLower.includes('perlu perbaikan') || msgLower.includes('perlu penyesuaian') || titleLower.includes('koreksi');
  const isLockedCase = titleLower.includes('penguncian') || titleLower.includes('terkunci') || titleLower.includes('kebijakan keras');
  const isSuspendedCase = titleLower.includes('penangguhan') || msgLower.includes('penangguhan') || titleLower.includes('suspend') || titleLower.includes('dibekukan');
  const isWarningCase = titleLower.includes('peringatan') || msgLower.includes('peringatan');

  let actionTaken = 'item_hidden';
  let statusBadge = 'ITEM DINONAKTIFKAN';
  let statusHeadline = 'Penonaktifan Sementara Item Katalog';
  let statusColor = '#f43f5e';
  let isAppealEligible = true;

  if (isBannedCase) {
    if (isExplicitStore) {
      actionTaken = 'account_banned';
      targetType = 'store';
      statusBadge = 'AKUN & SELURUH ITEM KATALOG DITANGGUHKAN PERMANEN';
      statusHeadline = 'Penonaktifan Permanen Akun & Seluruh Item Katalog';
      statusColor = '#dc2626';
      isAppealEligible = false;
    } else {
      actionTaken = 'item_banned';
      targetType = 'item';
      statusBadge = 'ITEM DIBLOKIR & DIHAPUS PERMANEN';
      statusHeadline = 'Pemblokiran & Penghapusan Permanen Item Katalog';
      statusColor = '#dc2626';
      isAppealEligible = false;
    }
  } else if (isRestored) {
    if (isExplicitStore) {
      actionTaken = 'catalog_restored';
      targetType = 'store';
      statusBadge = 'KATALOG AKTIF & PULIH';
      statusHeadline = 'Pemulihan Operasional Profil Katalog Berhasil';
    } else {
      actionTaken = 'item_restored';
      targetType = 'item';
      statusBadge = 'ITEM AKTIF KEMBALI';
      statusHeadline = 'Pemulihan Visibilitas Item Katalog';
    }
    statusColor = '#10b981';
    isAppealEligible = false;
  } else if (isNeedsFixCase) {
    actionTaken = 'item_needs_fix';
    targetType = 'item';
    statusBadge = 'PERLU PERBAIKAN ITEM';
    statusHeadline = 'Penyesuaian & Perbaikan Informasi Item';
    statusColor = '#f59e0b';
    isAppealEligible = false;
  } else if (isLockedCase) {
    actionTaken = 'item_locked';
    targetType = 'item';
    statusBadge = 'ITEM TERKUNCI (PELANGGARAN KERAS)';
    statusHeadline = 'Penonaktifan & Penguncian Item Katalog';
    statusColor = '#ef4444';
    isAppealEligible = true;
  } else if (isSuspendedCase) {
    actionTaken = 'catalog_suspended';
    targetType = 'store';
    statusBadge = 'KATALOG DIBEKUKAN SEMENTARA';
    statusHeadline = 'Penangguhan Operasional Profil Katalog';
    statusColor = '#ef4444';
    isAppealEligible = true;
  } else if (isWarningCase) {
    actionTaken = 'warning_issued';
    if (isExplicitItem) {
      targetType = 'item';
      statusBadge = 'PERINGATAN ITEM KATALOG';
      statusHeadline = 'Peringatan Resmi Kepatuhan Konten Item';
    } else {
      targetType = 'store';
      statusBadge = 'PERINGATAN PROFIL KATALOG';
      statusHeadline = 'Peringatan Resmi Kepatuhan Profil Katalog';
    }
    statusColor = '#f59e0b';
    isAppealEligible = false;
  }

  const issuedDateStr = notif.timestamp || notif.time || 'Baru saja';

  return {
    isModeration: true,
    isRestored,
    isStoreRestored,
    categoryBadge: category || (isRestored ? 'PEMULIHAN' : isWarningCase ? 'PERINGATAN' : isNeedsFixCase ? 'PERBAIKAN' : 'KEAMANAN'),
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
  hasDetailArticle: boolean;
  isQuickNotif: boolean;
  displayLabel: string;
  displayType: 'navigate' | 'external' | 'detail' | null;
  btnLabel: string;
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

  // Clean trailing navigational arrows from inputted label while preserving custom text
  const cleanLabel = (rawActionLabel || '').replace(/[→↗›>]/g, '').trim();

  let rawActionType = (item.action_type || item.actionType || 'none') as 'navigate' | 'external_link' | 'detail' | 'none';
  if (isModerationNotif) {
    rawActionType = 'detail';
  } else if (!rawActionType || rawActionType === 'none') {
    if (isTicketNotif) rawActionType = 'navigate';
    else if (actionUrl && !item.action_type) rawActionType = 'external_link';
    else if (rawSubTab && !item.action_type) rawActionType = 'navigate';
    else if (detailContent && !item.action_type) rawActionType = 'detail';
    else if (item.action_enabled && detailContent) rawActionType = 'detail';
    else rawActionType = 'none';
  }

  // Exact 3-tier categorization:
  // 1. hasDetailArticle: only true if there is genuine editorial article / formal legal decision sheet
  const hasDetailArticle = isModerationNotif ||
    item.id === 'system_suspended_notice' ||
    rawActionType === 'detail' ||
    (Boolean(detailContent) && detailContent.trim().length > 0 && detailContent.trim() !== (item.message || '').trim());

  // 2. isDirectNav & isExternal: actionable jumps to designated sub-tab or external link (no article body)
  const isDirectNav = !hasDetailArticle && ((rawActionType === 'navigate' && Boolean(rawSubTab)) || isTicketNotif);
  const isExternal = !hasDetailArticle && rawActionType === 'external_link' && Boolean(actionUrl);
  const isDetail = hasDetailArticle;

  // 3. isQuickNotif: brief informational message readable directly in-card (no article body, no navigation)
  const isQuickNotif = !hasDetailArticle && !isDirectNav && !isExternal;

  const tabLabels: Record<string, string> = {
    settings: 'Pengaturan Toko',
    items: 'Inventaris & Item',
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
  } else if (hasDetailArticle) {
    displayType = 'detail';
    if (!displayLabel) {
      if (isModerationNotif) {
        if (modCase.actionTaken === 'item_banned' || modCase.actionTaken === 'account_banned' || modCase.actionTaken === 'catalog_banned') {
          displayLabel = 'Lihat Salinan Keputusan';
        } else if (modCase.isAppealEligible) {
          displayLabel = 'Ajukan Banding Kepatuhan';
        } else if (modCase.actionTaken === 'item_needs_fix') {
          displayLabel = 'Perbaiki Item Sekarang';
        } else if (modCase.isRestored) {
          displayLabel = 'Lihat Status Pemulihan';
        } else {
          displayLabel = 'Buka Kasus Kepatuhan';
        }
      } else {
        displayLabel = 'Baca Artikel Lengkap';
      }
    }
  } else {
    displayType = null;
    displayLabel = '';
  }

  let btnLabel = '';
  if (displayType === 'navigate') {
    btnLabel = `${displayLabel} →`;
  } else if (displayType === 'external') {
    btnLabel = `${displayLabel} ↗`;
  } else if (displayType === 'detail') {
    btnLabel = `${displayLabel} →`;
  }

  // Category Color Theming - 100% Aligned with Admin Pengelola Visual Specs
  const rawCategory = String(item.category || '').toUpperCase().trim();
  const itemType = String(item.type || 'info').toLowerCase().trim();

  let category = rawCategory || 'PENGUMUMAN';
  let categoryColor = '#0ea5e9'; // Sky-500
  let categoryBg = 'rgba(14, 165, 233, 0.12)';
  let categoryBorder = 'rgba(14, 165, 233, 0.35)';

  if (modCase.actionTaken === 'item_banned' || modCase.actionTaken === 'account_banned' || modCase.actionTaken === 'catalog_banned' || itemType === 'danger' || rawCategory === 'BAHAYA' || rawCategory === 'DANGER') {
    category = rawCategory ? `${rawCategory} • SANKSI` : 'KEAMANAN • SANKSI FATAL';
    categoryColor = '#ef4444';
    categoryBg = 'rgba(239, 68, 68, 0.12)';
    categoryBorder = 'rgba(239, 68, 68, 0.35)';
  } else if (modCase.isRestored) {
    category = 'PEMULIHAN AKUN';
    categoryColor = '#10b981';
    categoryBg = 'rgba(16, 185, 129, 0.12)';
    categoryBorder = 'rgba(16, 185, 129, 0.35)';
  } else if (modCase.actionTaken === 'warning_issued') {
    category = 'PERINGATAN';
    categoryColor = '#f59e0b';
    categoryBg = 'rgba(245, 158, 11, 0.12)';
    categoryBorder = 'rgba(245, 158, 11, 0.35)';
  } else if (modCase.actionTaken === 'item_needs_fix') {
    category = 'PERBAIKAN';
    categoryColor = '#f59e0b';
    categoryBg = 'rgba(245, 158, 11, 0.12)';
    categoryBorder = 'rgba(245, 158, 11, 0.35)';
  } else if (isModerationNotif || rawCategory === 'KEAMANAN') {
    category = rawCategory || 'KEAMANAN';
    categoryColor = '#f43f5e';
    categoryBg = 'rgba(244, 63, 94, 0.12)';
    categoryBorder = 'rgba(244, 63, 94, 0.35)';
  } else if (isTicketNotif || rawCategory === 'BANTUAN CS') {
    category = 'BANTUAN CS';
    categoryColor = '#0284c7';
    categoryBg = 'rgba(2, 132, 199, 0.12)';
    categoryBorder = 'rgba(2, 132, 199, 0.35)';
  } else if (rawCategory === 'PEMELIHARAAN') {
    category = 'PEMELIHARAAN';
    categoryColor = '#f97316';
    categoryBg = 'rgba(249, 115, 22, 0.12)';
    categoryBorder = 'rgba(249, 115, 22, 0.35)';
  } else if (rawCategory === 'PANDUAN') {
    category = 'PANDUAN';
    categoryColor = '#f59e0b';
    categoryBg = 'rgba(245, 158, 11, 0.12)';
    categoryBorder = 'rgba(245, 158, 11, 0.35)';
  } else if (rawCategory === 'PROMOSI') {
    category = 'PROMOSI';
    categoryColor = '#a855f7';
    categoryBg = 'rgba(168, 85, 247, 0.12)';
    categoryBorder = 'rgba(168, 85, 247, 0.35)';
  } else if (rawCategory === 'INVENTARIS' || itemType === 'order') {
    category = 'INVENTARIS';
    categoryColor = '#10b981';
    categoryBg = 'rgba(16, 185, 129, 0.12)';
    categoryBorder = 'rgba(16, 185, 129, 0.35)';
  } else if (rawCategory === 'SISTEM' || itemType === 'system') {
    category = 'SISTEM';
    categoryColor = '#8b5cf6';
    categoryBg = 'rgba(139, 92, 246, 0.12)';
    categoryBorder = 'rgba(139, 92, 246, 0.35)';
  } else if (rawCategory === 'PENGUMUMAN') {
    category = 'PENGUMUMAN';
    if (itemType === 'warning') {
      categoryColor = '#f59e0b';
      categoryBg = 'rgba(245, 158, 11, 0.12)';
      categoryBorder = 'rgba(245, 158, 11, 0.35)';
    } else if (itemType === 'success') {
      categoryColor = '#10b981';
      categoryBg = 'rgba(16, 185, 129, 0.12)';
      categoryBorder = 'rgba(16, 185, 129, 0.35)';
    } else if (itemType === 'system') {
      categoryColor = '#8b5cf6';
      categoryBg = 'rgba(139, 92, 246, 0.12)';
      categoryBorder = 'rgba(139, 92, 246, 0.35)';
    } else {
      categoryColor = '#0ea5e9';
      categoryBg = 'rgba(14, 165, 233, 0.12)';
      categoryBorder = 'rgba(14, 165, 233, 0.35)';
    }
  } else {
    // Custom category fallback
    if (itemType === 'warning') {
      categoryColor = '#f59e0b';
      categoryBg = 'rgba(245, 158, 11, 0.12)';
      categoryBorder = 'rgba(245, 158, 11, 0.35)';
    } else if (itemType === 'success') {
      categoryColor = '#10b981';
      categoryBg = 'rgba(16, 185, 129, 0.12)';
      categoryBorder = 'rgba(16, 185, 129, 0.35)';
    } else if (itemType === 'system') {
      categoryColor = '#8b5cf6';
      categoryBg = 'rgba(139, 92, 246, 0.12)';
      categoryBorder = 'rgba(139, 92, 246, 0.35)';
    }
  }

  return {
    item,
    id: item.id,
    title: item.title || 'Notifikasi Baru',
    message: item.message || '',
    detailContent,
    time: item.timestamp || item.time || 'Baru saja',
    read: Boolean(item.read ?? item.is_read),
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
    hasDetailArticle,
    isQuickNotif,
    displayLabel,
    displayType,
    btnLabel
  };
}

/**
 * Generates a concise yet informative notification description.
 * Simplifies lengthy moderation messages on cards while preserving full detail in the article modal/view.
 */
export function getMobileNotificationDescription(item: any, modCaseInfo?: any): string {
  if (!item) return '';

  const modCase = modCaseInfo || parseModerationCase(item);
  const action = modCase?.actionTaken || '';
  const isItem = modCase?.targetType !== 'store';
  const rawTargetName = (modCase?.targetName || '').trim();
  let cleanTargetName = rawTargetName && !/^item(\s+katalog)?$/i.test(rawTargetName) ? rawTargetName : '';
  
  if (!cleanTargetName) {
    const rawMsg = item.message || '';
    const rawTitle = item.title || '';
    const match = rawMsg.match(/["“]([^"”]+)["”]/) || rawTitle.match(/["“]([^"”]+)["”]/);
    if (match && match[1] && !/^item(\s+katalog)?$/i.test(match[1])) {
      cleanTargetName = match[1].trim();
    }
  }

  const itemLabel = cleanTargetName ? `"${cleanTargetName}"` : 'item katalog';
  const categoryUpper = String(item.category || '').toUpperCase();
  const titleLower = String(item.title || '').toLowerCase();
  const msgLower = String(item.message || '').toLowerCase();

  const rawNotes = (modCase?.notes || '').trim();
  const cleanNotes = rawNotes && !rawNotes.startsWith('Ditemukan ketidaksesuaian kebijakan') ? rawNotes.replace(/^["'“]+|["'”]+$/g, '').trim() : '';
  const notesSuffix = cleanNotes ? ` Catatan Admin: "${cleanNotes}".` : '';

  // 1. Peringatan Resmi (warning_issued)
  const isWarning =
    action === 'warning_issued' ||
    categoryUpper === 'PERINGATAN' ||
    titleLower.includes('peringatan kepatuhan') ||
    titleLower.includes('peringatan resmi') ||
    msgLower.includes('peringatan resmi');
  if (isWarning) {
    if (isItem) {
      return cleanTargetName
        ? `Peringatan resmi kepatuhan untuk item ${itemLabel}.${notesSuffix} Status item tetap aktif. Buka rincian untuk panduan.`
        : `Peringatan resmi kepatuhan konten item.${notesSuffix} Status item tetap aktif. Buka rincian untuk panduan.`;
    }
    return `Peringatan resmi kepatuhan profil katalog.${notesSuffix} Status operasional tetap aktif. Buka rincian untuk panduan.`;
  }

  // 2. Nonaktifkan: Beri Kesempatan Edit & Perbaiki (item_needs_fix)
  const isNeedsFix =
    action === 'item_needs_fix' ||
    categoryUpper === 'PERBAIKAN' ||
    titleLower.includes('perlu perbaikan') ||
    titleLower.includes('koreksi item') ||
    msgLower.includes('memerlukan penyesuaian') ||
    msgLower.includes('beri kesempatan edit') ||
    msgLower.includes('mengedit data dan mengajukan peninjauan');
  if (isNeedsFix) {
    return cleanTargetName
      ? `Item ${itemLabel} disembunyikan sementara.${notesSuffix} Silakan edit dan perbaiki data item untuk peninjauan ulang.`
      : `Item disembunyikan sementara.${notesSuffix} Silakan edit dan perbaiki data item untuk peninjauan ulang.`;
  }

  // 3. Nonaktifkan & Kunci: Pelanggaran Kebijakan Keras (item_locked / item_hidden)
  const isLocked =
    action === 'item_locked' ||
    action === 'item_hidden' ||
    titleLower.includes('kebijakan keras') ||
    titleLower.includes('penguncian') ||
    titleLower.includes('dikunci sementara') ||
    msgLower.includes('pelanggaran kebijakan keras') ||
    msgLower.includes('dinonaktifkan & dikunci') ||
    msgLower.includes('dinonaktifkan dan dikunci');
  if (isLocked) {
    return cleanTargetName
      ? `Item ${itemLabel} dinonaktifkan dan dikunci karena pelanggaran keras.${notesSuffix} Anda dapat mengajukan banding kepatuhan.`
      : `Item dinonaktifkan dan dikunci karena pelanggaran keras.${notesSuffix} Anda dapat mengajukan banding kepatuhan.`;
  }

  // 4. Blokir atau Hapus Item: Banned Permanen (item_banned)
  const isItemBanned =
    action === 'item_banned' ||
    (action === 'banned' && isItem) ||
    (titleLower.includes('pemblokiran') && isItem) ||
    (titleLower.includes('banned') && isItem) ||
    msgLower.includes('diblokir secara permanen dan dihapus') ||
    msgLower.includes('diblokir permanen');
  if (isItemBanned) {
    return cleanTargetName
      ? `Item ${itemLabel} telah diblokir permanen dan dihapus dari katalog.${notesSuffix} Keputusan bersifat final.`
      : `Item katalog telah diblokir permanen dan dihapus.${notesSuffix} Keputusan bersifat final.`;
  }

  // Akun / Profil Katalog Banned Permanen
  if (action === 'account_banned' || action === 'catalog_banned' || titleLower.includes('penonaktifan permanen akun')) {
    return `Akun dan seluruh item katalog dinonaktifkan permanen.${notesSuffix} Keputusan sanksi ini bersifat final.`;
  }

  // Pembekuan / Suspend Profil Katalog
  if (action === 'catalog_suspended' || titleLower.includes('penangguhan operasional')) {
    return `Operasional katalog ditangguhkan sementara.${notesSuffix} Anda dapat mengajukan banding kepatuhan resmi.`;
  }

  // Pemulihan Item & Profil Katalog
  if (action === 'item_restored' || titleLower.includes('berhasil dipulihkan')) {
    return cleanTargetName
      ? `Item ${itemLabel} telah diaktifkan kembali ke etalase publik dan dapat diakses normal.${notesSuffix}`
      : `Item katalog telah diaktifkan kembali ke etalase publik dan dapat diakses normal.${notesSuffix}`;
  }
  if (action === 'catalog_reactivated' || titleLower.includes('pemulihan operasional')) {
    return `Penangguhan profil katalog telah resmi dicabut.${notesSuffix} Seluruh etalase publik kembali aktif normal.`;
  }

  // Default fallback: return standard message with bold asterisks stripped
  return (item.message || '').replace(/\*\*(.*?)\*\*/g, '$1');
}
