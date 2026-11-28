export const MAX_REPORT_NOTES_LENGTH = 5000;
export const MAX_REPORT_EMAIL_LENGTH = 254;

const REPORT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateReportEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REPORT_EMAIL_LENGTH || !REPORT_EMAIL_REGEX.test(trimmed)) {
    return 'Format alamat email pelapor tidak valid.';
  }
  return null;
}

export interface SubmitPublicReportPayload {
  target_type: 'catalog' | 'item';
  store_id: number;
  store_slug: string;
  store_title: string;
  product_id: number | null;
  fauna_id: number | null;
  item_name: string | null;
  reason_category: string;
  reason_label: string;
  description: string;
  reporter_email: string;
  website_hp?: string;
}

export interface SubmitPublicReportResult {
  ok: boolean;
  duplicate?: boolean;
  rateLimited?: boolean;
  reportNumber?: string;
  message: string;
}

export async function submitPublicReport(params: {
  apiBase: string;
  payload: SubmitPublicReportPayload;
  targetTitle: string;
}): Promise<SubmitPublicReportResult> {
  const emailErr = validateReportEmail(params.payload.reporter_email);
  if (emailErr) {
    return { ok: false, message: emailErr };
  }

  const trimmedNotes = params.payload.description.trim();
  if (trimmedNotes.length > MAX_REPORT_NOTES_LENGTH) {
    return {
      ok: false,
      message: `Keterangan tambahan maksimal ${MAX_REPORT_NOTES_LENGTH} karakter.`,
    };
  }

  try {
    const res = await fetch(`${params.apiBase}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params.payload,
        description: trimmedNotes,
        reporter_email: params.payload.reporter_email.trim(),
        website_hp: params.payload.website_hp ?? '',
      }),
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.status === 429) {
      return {
        ok: false,
        rateLimited: true,
        message:
          data?.message ||
          'Terlalu banyak pengiriman laporan dalam waktu singkat. Harap tunggu beberapa saat sebelum mencoba lagi.',
      };
    }

    if (res.ok && data?.success) {
      if (data.duplicate) {
        return {
          ok: true,
          duplicate: true,
          message:
            data.message ||
            `Laporan untuk "${params.targetTitle}" sudah tercatat dan sedang ditinjau tim kepatuhan.`,
        };
      }
      const reportNum = data?.data?.report_number || '';
      return {
        ok: true,
        reportNumber: reportNum,
        message: `Terima kasih. Laporan #${reportNum} untuk "${params.targetTitle}" telah berhasil dikirim ke tim kepatuhan.`,
      };
    }

    return {
      ok: false,
      message: data?.message || 'Gagal mengirim laporan. Silakan periksa isian Anda dan coba lagi.',
    };
  } catch {
    return {
      ok: false,
      message: 'Terjadi gangguan jaringan saat mengirim laporan. Silakan coba lagi.',
    };
  }
}
