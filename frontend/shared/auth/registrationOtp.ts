export const REG_TOKEN_STORAGE_KEY = 'catavor_reg_verification_token';
export const REG_VERIFIED_EMAIL_STORAGE_KEY = 'catavor_reg_verified_email';
export const REG_VERIFIED_AT_STORAGE_KEY = 'catavor_reg_verified_at';

// Backend OTPService issues verification tokens valid for 15 minutes.
// Keep client freshness slightly conservative (14 minutes) to catch expiry proactively.
const TOKEN_CLIENT_MAX_AGE_MS = 14 * 60 * 1000;

export function normalizeRegEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

export function getStoredRegistrationToken(email?: string | null): string {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    const token = sessionStorage.getItem(REG_TOKEN_STORAGE_KEY) || '';
    const verifiedEmail = sessionStorage.getItem(REG_VERIFIED_EMAIL_STORAGE_KEY) || '';
    const verifiedAt = Number(sessionStorage.getItem(REG_VERIFIED_AT_STORAGE_KEY) || '0');
    if (!token || !verifiedEmail) return '';
    const targetEmail = normalizeRegEmail(email);
    if (!targetEmail || targetEmail !== normalizeRegEmail(verifiedEmail)) {
      return '';
    }
    if (verifiedAt > 0 && Date.now() - verifiedAt > TOKEN_CLIENT_MAX_AGE_MS) {
      return '';
    }
    return token;
  } catch {
    return '';
  }
}

export function setStoredRegistrationToken(email: string, token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const cleanEmail = normalizeRegEmail(email);
  const cleanToken = String(token || '').trim();
  if (!cleanEmail || !cleanToken) return;
  try {
    sessionStorage.setItem(REG_TOKEN_STORAGE_KEY, cleanToken);
    sessionStorage.setItem(REG_VERIFIED_EMAIL_STORAGE_KEY, cleanEmail);
    sessionStorage.setItem(REG_VERIFIED_AT_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore private storage quota errors
  }
}

export function clearStoredRegistrationToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(REG_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REG_VERIFIED_EMAIL_STORAGE_KEY);
    sessionStorage.removeItem(REG_VERIFIED_AT_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export interface SendOtpResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function sendRegistrationOtpApi(
  apiBase: string,
  email: string,
  name: string
): Promise<SendOtpResult> {
  try {
    const res = await fetch(`${apiBase}/auth/send-registration-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: normalizeRegEmail(email),
        name: String(name || '').trim(),
        website_hp: '',
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: Boolean(res.ok && data?.success),
      status: res.status,
      message: data?.message || (res.ok ? 'Kode OTP telah dikirim ke email Anda.' : 'Gagal mengirim kode OTP.'),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message: 'Gagal menghubungi server verifikasi OTP.',
    };
  }
}

export interface VerifyOtpResult {
  ok: boolean;
  status: number;
  verification_token?: string;
  message: string;
}

export async function verifyRegistrationOtpApi(
  apiBase: string,
  email: string,
  otp: string
): Promise<VerifyOtpResult> {
  try {
    const res = await fetch(`${apiBase}/auth/verify-registration-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: normalizeRegEmail(email),
        otp: String(otp || '').trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.verification_token) {
      setStoredRegistrationToken(email, data.verification_token);
      return {
        ok: true,
        status: res.status,
        verification_token: data.verification_token,
        message: data?.message || 'Email berhasil diverifikasi!',
      };
    }
    return {
      ok: false,
      status: res.status,
      message: data?.message || 'Kode OTP salah atau telah kedaluwarsa.',
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message: 'Gagal memverifikasi kode OTP. Periksa koneksi internet Anda.',
    };
  }
}

export function isVerificationTokenErrorResponse(status: number, message?: string): boolean {
  if (status !== 422 && status !== 400) return false;
  const lower = String(message || '').toLowerCase();
  return (
    lower.includes('verifikasi email wajib') ||
    lower.includes('token verifikasi') ||
    lower.includes('verification token')
  );
}
