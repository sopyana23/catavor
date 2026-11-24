import type {
  AdminBroadcastRecord,
  BroadcastFormPayload,
  BroadcastListFilters,
  BroadcastListResponse,
  BroadcastRecipient,
  SubscriptionPlanOption,
} from './broadcastTypes';

export const FALLBACK_SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  {
    code: 'free',
    name: 'Gratis Terbatas',
    badge_label: 'Free Tier',
    description: 'Merchant pada paket dasar gratis',
    price_monthly: 0,
  },
  {
    code: 'pro_starter',
    name: 'Pro Starter',
    badge_label: 'Pro',
    description: 'Merchant berlangganan aktif Pro Starter',
    price_monthly: 30000,
  },
  {
    code: 'pro_business',
    name: 'Pro Bisnis',
    badge_label: 'Pro VIP',
    description: 'Merchant skala bisnis / VIP prioritas',
    price_monthly: 129000,
  },
];

function buildAuthHeaders(token?: string | null, extra?: Record<string, string>): Record<string, string> {
  const effectiveToken =
    token ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('catavor_token') || localStorage.getItem('token')
      : null);

  return {
    Accept: 'application/json',
    ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
    ...extra,
  };
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json();
    if (typeof json?.error === 'string' && json.error.trim()) return json.error;
    if (typeof json?.message === 'string' && json.message.trim()) return json.message;
  } catch {}
  return fallback;
}

export async function fetchSubscriptionPlans(token?: string | null): Promise<SubscriptionPlanOption[]> {
  try {
    const res = await fetch('/api/subscription/plans', {
      credentials: 'include',
      headers: buildAuthHeaders(token),
    });
    if (res.ok) {
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (rows.length > 0) {
        return rows.map((p: Record<string, unknown>) => ({
          code: String(p.code || '').toLowerCase(),
          name: String(p.name || p.code || ''),
          badge_label: p.badge_label ? String(p.badge_label) : undefined,
          description: p.description ? String(p.description) : undefined,
          price_monthly: typeof p.price_monthly === 'number' ? p.price_monthly : undefined,
        }));
      }
    }
  } catch {}
  return FALLBACK_SUBSCRIPTION_PLANS;
}

export async function fetchAdminBroadcasts(
  filters: BroadcastListFilters,
  token?: string | null
): Promise<BroadcastListResponse> {
  const params = new URLSearchParams();
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 15));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.target && filters.target !== 'all') params.set('target', filters.target);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.q && filters.q.trim()) params.set('q', filters.q.trim());

  const res = await fetch(`/api/admin/notifications?${params.toString()}`, {
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal memuat daftar siaran'));
  }
  return res.json();
}

export async function fetchAdminBroadcastDetail(
  id: string,
  token?: string | null
): Promise<AdminBroadcastRecord> {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Rincian siaran tidak ditemukan'));
  }
  const json = await res.json();
  return json.data || json.notification;
}

export async function createAdminBroadcast(
  payload: BroadcastFormPayload,
  idempotencyKey: string,
  token?: string | null
): Promise<{ message: string; notification: AdminBroadcastRecord; idempotent_replay?: boolean }> {
  const res = await fetch('/api/admin/notifications/broadcast', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(token, {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    }),
    body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal mengirim siaran pengumuman'));
  }
  return res.json();
}

export async function updateAdminBroadcast(
  id: string,
  payload: BroadcastFormPayload,
  token?: string | null
): Promise<{ message: string; notification: AdminBroadcastRecord }> {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal memperbarui siaran'));
  }
  return res.json();
}

export async function publishAdminBroadcast(
  id: string,
  token?: string | null
): Promise<{ message: string; notification: AdminBroadcastRecord }> {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal menerbitkan siaran'));
  }
  return res.json();
}

export async function revokeAdminBroadcast(
  id: string,
  token?: string | null
): Promise<{ message: string; notification: AdminBroadcastRecord }> {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal mencabut siaran'));
  }
  return res.json();
}

export async function deleteAdminBroadcast(
  id: string,
  token?: string | null
): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Gagal menghapus siaran'));
  }
  return res.json();
}

export async function searchBroadcastRecipients(
  query: string,
  token?: string | null
): Promise<BroadcastRecipient[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const encoded = encodeURIComponent(trimmed);
  const [storesRes, usersRes] = await Promise.all([
    fetch(`/api/admin/stores/search?q=${encoded}`, {
      credentials: 'include',
      headers: buildAuthHeaders(token),
    }).catch(() => null),
    fetch(`/api/admin/users/search?q=${encoded}`, {
      credentials: 'include',
      headers: buildAuthHeaders(token),
    }).catch(() => null),
  ]);

  const combined: BroadcastRecipient[] = [];

  if (storesRes && storesRes.ok) {
    const sj = await storesRes.json().catch(() => null);
    const list = Array.isArray(sj?.data) ? sj.data : [];
    for (const s of list) {
      combined.push({
        type: 'store',
        id: Number(s.id),
        name: String(s.store_title || s.slug || `Toko #${s.id}`),
        slug: s.slug ? String(s.slug) : undefined,
        email: s.user_email ? String(s.user_email) : undefined,
        plan: s.plan ? String(s.plan) : undefined,
      });
    }
  }

  if (usersRes && usersRes.ok) {
    const uj = await usersRes.json().catch(() => null);
    const list = Array.isArray(uj?.data) ? uj.data : [];
    for (const u of list) {
      combined.push({
        type: 'user',
        id: Number(u.id),
        name: String(u.name || u.email || `User #${u.id}`),
        email: u.email ? String(u.email) : undefined,
      });
    }
  }

  return combined;
}
