export interface SupportSelectOption {
  value: string;
  label: string;
  shortLabel?: string;
}

export const SUPPORT_TICKET_CATEGORIES: SupportSelectOption[] = [
  { value: 'billing', label: 'Pembayaran & Paket Pro', shortLabel: 'Pembayaran' },
  { value: 'technical', label: 'Kendala Teknis & Fitur', shortLabel: 'Teknis' },
  { value: 'catalog_help', label: 'Bantuan Pengelolaan Katalog', shortLabel: 'Katalog' },
  { value: 'account', label: 'Akun & Profil', shortLabel: 'Akun' },
  { value: 'general', label: 'Pertanyaan Umum', shortLabel: 'Umum' },
  { value: 'compliance', label: 'Kepatuhan & Banding', shortLabel: 'Banding' },
];

export const SUPPORT_TICKET_PRIORITIES: SupportSelectOption[] = [
  { value: 'low', label: 'Rendah (Pertanyaan Umum)', shortLabel: 'Rendah' },
  { value: 'medium', label: 'Sedang (Kendala Standar)', shortLabel: 'Sedang' },
  { value: 'high', label: 'Tinggi (Urgensi Bisnis)', shortLabel: 'Tinggi' },
  { value: 'urgent', label: 'Mendesak (Darurat)', shortLabel: 'Mendesak' },
];

export const SUPPORT_TEMPLATE_CATEGORIES: SupportSelectOption[] = [
  { value: 'general', label: 'Umum & Greeting' },
  { value: 'billing', label: 'Keuangan & Billing' },
  { value: 'technical', label: 'Kendala Teknis' },
  { value: 'closing', label: 'Penutupan Tiket' },
  { value: 'account', label: 'Akun & Keamanan' },
];

export const SUPPORT_MAX_ATTACHMENTS = 5;
export const SUPPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Resolves merchant store display name safely from backend store_title or legacy fallbacks. */
export function resolveTicketStoreTitle(ticket: any): string {
  const candidates = [
    ticket?.store?.store_title,
    ticket?.store?.name,
    ticket?.store_title,
    ticket?.store_name,
    ticket?.store?.slug,
    ticket?.store_slug,
    ticket?.user?.name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim();
    }
  }
  return 'Merchant';
}

/** Resolves total message count from backend message_count with fallback to loaded messages length. */
export function resolveTicketMessageCount(ticket: any): number {
  if (typeof ticket?.message_count === 'number' && Number.isFinite(ticket.message_count) && ticket.message_count >= 0) {
    return ticket.message_count;
  }
  return Array.isArray(ticket?.messages) ? ticket.messages.length : 0;
}

export interface CannedTemplateContext {
  merchantName?: string;
  storeTitle?: string;
  ticketNumber?: string;
  agentName?: string;
}

/** Replaces standard canned response placeholders across all three frontends consistently. */
export function interpolateCannedTemplate(content: string, ctx: CannedTemplateContext): string {
  if (!content) return '';
  const merchantName = (ctx.merchantName || '').trim() || 'Bapak/Ibu Merchant';
  const storeTitle = (ctx.storeTitle || '').trim() || 'Merchant Anda';
  const ticketNumber = (ctx.ticketNumber || '').trim() || '-';
  const agentName = (ctx.agentName || '').trim() || 'Tim Support Catavor';

  return content
    .replace(/\{\{\s*merchant_name\s*\}\}/gi, merchantName)
    .replace(/\{\{\s*store_name\s*\}\}/gi, storeTitle)
    .replace(/\{\{\s*ticket_number\s*\}\}/gi, ticketNumber)
    .replace(/\{\{\s*agent_name\s*\}\}/gi, agentName);
}
