export interface RBACUserLike {
  id?: number;
  name?: string;
  email?: string;
  platform_role?: string;
  is_superadmin?: boolean;
  is_admin?: boolean;
  permissions?: string[];
  two_factor_enabled?: boolean;
  is_password_changed?: boolean;
  has_custom_password?: boolean;
  store_slug?: string;
  [key: string]: unknown;
}

export type UserRBACInfo = RBACUserLike;

export interface RolePermissionItem {
  id: number;
  key: string;
  group: string;
  name: string;
  description: string;
}

export type PlatformPermission = RolePermissionItem;

export interface PlatformRoleItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions?: RolePermissionItem[];
}

export type PlatformRole = PlatformRoleItem;

export interface AdminStaffMember {
  id: number;
  name: string;
  email: string;
  platform_role: string;
  role_name: string;
  created_at: string;
  updated_at?: string;
  two_factor_enabled?: boolean;
}

export type AdminStaffUser = AdminStaffMember;

export interface PortalCapabilities {
  isSuperAdmin: boolean;
  canAccessRBAC: boolean;
  canAccessCompliance: boolean;
  canSuspendStores: boolean;
  canAccessSupport: boolean;
  canManageSupportTemplates: boolean;
  canReplySupport: boolean;
  canAccessFinance: boolean;
  canReadOrders: boolean;
  canReadRevenue: boolean;
  canManageOrders: boolean;
  canManagePaymentSettings: boolean;
  canManageCoupons: boolean;
  canAccessMonetization: boolean;
  canAccessBroadcast: boolean;
  canAccessAutomation: boolean;
  canManageAutomation: boolean;
  canAccessAudit: boolean;
  canAccessMarketIntel: boolean;
  canManageSystemSettings: boolean;
  canAccessMasterData: boolean;
  canAccessSettingsRead: boolean;
}

export const RESERVED_NON_STAFF_ROLES = new Set<string>([
  '',
  'merchant',
  'admin',
  'user',
  'buyer',
  'guest',
  'system',
  '*',
]);

export const DEFAULT_STAFF_ROLES = new Set<string>([
  'superadmin',
  'support',
  'compliance',
  'finance',
  'content',
]);

export const SUPERADMIN_EXCLUSIVE_PERMISSION = 'system:admins:manage';
export const CUSTOM_ROLE_SLUG_REGEX = /^[a-z][a-z0-9_]{1,48}[a-z0-9]$/;

export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  compliance: 'Kepatuhan & Moderasi',
  support: 'Layanan Bantuan CS',
  finance: 'Keuangan & Billing',
  content: 'Konten & Siaran',
  monetization: 'Monetisasi & Iklan',
  audit: 'Audit & Riset Pasar',
  system: 'Administrasi Sistem',
};

export function normalizeRoleSlug(role?: string | null): string {
  return String(role ?? '').trim().toLowerCase();
}

export function sanitizeRoleSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
}

export function formatPermissionGroupLabel(group?: string | null): string {
  const norm = normalizeRoleSlug(group);
  return PERMISSION_GROUP_LABELS[norm] || (group ? group.toUpperCase() : 'LAINNYA');
}

export function isAssignablePermissionKey(key: string): boolean {
  return key.trim() !== SUPERADMIN_EXCLUSIVE_PERMISSION;
}

export function isStaffRole(role?: string | null, knownRoleSlugs?: Iterable<string>): boolean {
  const norm = normalizeRoleSlug(role);
  if (!norm || RESERVED_NON_STAFF_ROLES.has(norm)) return false;
  if (DEFAULT_STAFF_ROLES.has(norm)) return true;
  if (knownRoleSlugs) {
    for (const slug of knownRoleSlugs) {
      if (normalizeRoleSlug(slug) === norm) return true;
    }
  }
  return false;
}

export function isPlatformStaffUser(user?: RBACUserLike | null, knownRoleSlugs?: Iterable<string>): boolean {
  if (!user) return false;
  if (user.is_superadmin === true) return true;
  if (user.is_admin === true) return true;
  const norm = normalizeRoleSlug(user.platform_role);
  if (norm && !RESERVED_NON_STAFF_ROLES.has(norm) && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return true;
  }
  return isStaffRole(user.platform_role, knownRoleSlugs);
}

export function isSuperAdmin(user?: RBACUserLike | null): boolean {
  if (!user) return false;
  return user.is_superadmin === true || normalizeRoleSlug(user.platform_role) === 'superadmin';
}

export function hasPermission(user?: RBACUserLike | null, perm?: string | string[]): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
  if (userPerms.includes('*')) return true;
  if (!perm) return false;
  const required = Array.isArray(perm) ? perm : [perm];
  return required.some((p) => userPerms.includes(p));
}

export function derivePortalCapabilities(user?: RBACUserLike | null): PortalCapabilities {
  const superAdmin = isSuperAdmin(user);
  const canAccessCompliance = superAdmin || hasPermission(user, ['compliance:reports:manage', 'compliance:dormancy:manage']);
  const canAccessSupport = superAdmin || hasPermission(user, ['support:tickets:read', 'support:tickets:reply']);
  const canManageSupportTemplates = superAdmin || hasPermission(user, ['support:tickets:read', 'support:tickets:reply']);
  const canManageSystemSettings = superAdmin || hasPermission(user, 'system:settings:manage');
  const canAccessMonetization = superAdmin || hasPermission(user, 'monetization:google:manage');

  return {
    isSuperAdmin: superAdmin,
    canAccessRBAC: superAdmin || hasPermission(user, SUPERADMIN_EXCLUSIVE_PERMISSION),
    canAccessCompliance,
    canSuspendStores: superAdmin || hasPermission(user, 'compliance:stores:suspend'),
    canAccessSupport,
    canManageSupportTemplates,
    canReplySupport: superAdmin || hasPermission(user, 'support:tickets:reply'),
    canAccessFinance: superAdmin || hasPermission(user, [
      'finance:orders:read',
      'finance:orders:manage',
      'finance:settings:manage',
      'finance:revenue:read',
    ]),
    canReadOrders: superAdmin || hasPermission(user, [
      'finance:orders:read',
      'finance:orders:manage',
      'finance:revenue:read',
    ]),
    canReadRevenue: superAdmin || hasPermission(user, ['finance:revenue:read', 'finance:orders:manage']),
    canManageOrders: superAdmin || hasPermission(user, 'finance:orders:manage'),
    canManagePaymentSettings: superAdmin || hasPermission(user, ['finance:settings:manage', 'system:settings:manage']),
    canManageCoupons: superAdmin || hasPermission(user, ['finance:orders:manage', 'finance:settings:manage', 'system:settings:manage']),
    canAccessMonetization,
    canAccessBroadcast: superAdmin || hasPermission(user, 'content:broadcast:send'),
    canAccessAutomation: superAdmin || hasPermission(user, ['system:automation:manage', 'system:automation:view']),
    canManageAutomation: superAdmin || hasPermission(user, 'system:automation:manage'),
    canAccessAudit: superAdmin || hasPermission(user, 'audit:logs:read'),
    canAccessMarketIntel: superAdmin || hasPermission(user, 'market_intel:manage'),
    canManageSystemSettings,
    canAccessMasterData: superAdmin || canManageSystemSettings || canManageSupportTemplates,
    canAccessSettingsRead: superAdmin || canManageSystemSettings || hasPermission(user, 'finance:settings:manage') || canAccessMonetization,
  };
}

export function isViewPermitted(view: string, caps: PortalCapabilities): boolean {
  const norm = normalizeRoleSlug(view);
  switch (norm) {
    case 'dashboard':
    case 'overview':
    case 'home':
      return true;
    case 'rbac':
    case 'staff':
      return caps.canAccessRBAC;
    case 'stores':
    case 'reports':
      return caps.canAccessCompliance;
    case 'support':
      return caps.canAccessSupport;
    case 'finance':
      return caps.canAccessFinance;
    case 'monetization':
      return caps.canAccessMonetization;
    case 'broadcast':
      return caps.canAccessBroadcast;
    case 'automation':
      return caps.canAccessAutomation;
    case 'market_intel':
      return caps.canAccessMarketIntel;
    case 'audit':
      return caps.canAccessAudit;
    case 'master_data':
    case 'master-data':
    case 'safe_domains':
    case 'policies':
      return norm === 'policies' ? caps.canManageSystemSettings : caps.canAccessMasterData;
    default:
      return false;
  }
}

export function getDefaultViewForCapabilities(caps: PortalCapabilities, roleSlug?: string | null): string {
  const norm = normalizeRoleSlug(roleSlug);
  if (caps.isSuperAdmin) return 'dashboard';
  if (norm === 'compliance' && caps.canAccessCompliance) return 'reports';
  if (norm === 'support' && caps.canAccessSupport) return 'support';
  if (norm === 'finance' && caps.canAccessFinance) return 'finance';
  if (norm === 'content' && caps.canAccessBroadcast) return 'broadcast';
  if (caps.canAccessRBAC) return 'rbac';
  if (caps.canAccessCompliance) return 'reports';
  if (caps.canAccessSupport) return 'support';
  if (caps.canAccessFinance) return 'finance';
  if (caps.canAccessBroadcast) return 'broadcast';
  if (caps.canAccessMonetization) return 'monetization';
  if (caps.canAccessAudit) return 'audit';
  if (caps.canAccessMarketIntel) return 'market_intel';
  return 'dashboard';
}

export const isPlatformAdmin = isPlatformStaffUser;

export function formatRoleDisplayLabel(roleSlug?: string | null): string {
  const norm = normalizeRoleSlug(roleSlug);
  switch (norm) {
    case 'superadmin':
      return 'Super Admin';
    case 'compliance':
      return 'Trust & Compliance';
    case 'support':
      return 'Customer Support';
    case 'finance':
      return 'Finance & Billing';
    case 'content':
      return 'Content & Marketing';
    case 'merchant':
    case '':
      return 'Merchant';
    default:
      return norm
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

export function getRoleBadge(roleSlug?: string | null): { label: string; color: string; bg: string; border: string } {
  const norm = normalizeRoleSlug(roleSlug);
  const label = formatRoleDisplayLabel(norm);
  switch (norm) {
    case 'superadmin':
      return { label, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' };
    case 'compliance':
      return { label, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' };
    case 'support':
      return { label, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' };
    case 'finance':
      return { label, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
    case 'content':
      return { label, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
    default:
      return { label, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
  }
}

export function getRoleBadgeTheme(slug: string, isDark: boolean): { color: string; bg: string; border: string } {
  const norm = normalizeRoleSlug(slug);
  switch (norm) {
    case 'superadmin':
      return {
        color: isDark ? '#c084fc' : '#7e22ce',
        bg: isDark ? 'rgba(168, 85, 247, 0.16)' : '#f3e8ff',
        border: isDark ? 'rgba(168, 85, 247, 0.35)' : '#d8b4fe',
      };
    case 'compliance':
      return {
        color: isDark ? '#f87171' : '#b91c1c',
        bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
        border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
      };
    case 'support':
      return {
        color: isDark ? '#38bdf8' : '#0369a1',
        bg: isDark ? 'rgba(14, 165, 233, 0.16)' : '#e0f2fe',
        border: isDark ? 'rgba(14, 165, 233, 0.35)' : '#7dd3fc',
      };
    case 'finance':
      return {
        color: isDark ? '#34d399' : '#047857',
        bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#d1fae5',
        border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#6ee7b7',
      };
    case 'content':
      return {
        color: isDark ? '#f472b6' : '#be185d',
        bg: isDark ? 'rgba(236, 72, 153, 0.16)' : '#fce7f3',
        border: isDark ? 'rgba(236, 72, 153, 0.35)' : '#f9a8d4',
      };
    default:
      return {
        color: isDark ? '#94a3b8' : '#334155',
        bg: isDark ? 'rgba(148, 163, 184, 0.14)' : '#f1f5f9',
        border: isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1',
      };
  }
}

export class RbacApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'RbacApiError';
  }
}

interface RbacResponseEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

async function rbacApiRequest<T>(
  url: string,
  token: string,
  init: RequestInit = {},
  fallbackMsg = 'Permintaan RBAC gagal diproses.'
): Promise<RbacResponseEnvelope<T>> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  const payload = (await res.json().catch(() => null)) as RbacResponseEnvelope<T> | null;
  if (!res.ok || payload?.success === false) {
    const serverMsg = payload?.message?.trim();
    const defaultMsg =
      res.status === 403
        ? 'Akses Ditolak: hanya Superadmin yang dapat mengubah konfigurasi RBAC.'
        : res.status === 401
          ? 'Sesi Anda telah berakhir. Silakan login kembali.'
          : fallbackMsg;
    throw new RbacApiError(res.status, serverMsg || defaultMsg);
  }

  return payload ?? { success: true };
}

export async function fetchRbacMatrix(token: string): Promise<{ roles: PlatformRoleItem[]; permissions: RolePermissionItem[] }> {
  const res = await rbacApiRequest<{ roles?: PlatformRoleItem[]; permissions?: RolePermissionItem[] }>(
    '/api/admin/rbac/matrix',
    token,
    { method: 'GET' },
    'Gagal memuat matriks hak akses RBAC.'
  );
  return {
    roles: Array.isArray(res.data?.roles) ? res.data.roles : [],
    permissions: Array.isArray(res.data?.permissions) ? res.data.permissions : [],
  };
}

export async function fetchRbacStaff(token: string): Promise<AdminStaffMember[]> {
  const res = await rbacApiRequest<AdminStaffMember[]>(
    '/api/admin/rbac/staff',
    token,
    { method: 'GET' },
    'Gagal memuat daftar staf platform.'
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function updateRbacMatrix(token: string, roleSlug: string, permissionKeys: string[]): Promise<string> {
  const res = await rbacApiRequest<unknown>(
    '/api/admin/rbac/matrix',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ role_slug: roleSlug, permission_keys: permissionKeys }),
    },
    'Gagal memperbarui matriks izin role.'
  );
  return res.message || 'Matriks hak akses berhasil diperbarui.';
}

export async function assignRbacStaff(token: string, emailOrId: string, roleSlug: string): Promise<string> {
  const res = await rbacApiRequest<unknown>(
    '/api/admin/rbac/staff',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ email_or_id: emailOrId, role_slug: roleSlug }),
    },
    'Gagal memperbarui peran staf.'
  );
  return res.message || 'Role staf berhasil diperbarui.';
}

export async function createRbacStaff(
  token: string,
  payload: { name: string; email: string; password: string; role_slug: string }
): Promise<string> {
  const res = await rbacApiRequest<unknown>(
    '/api/admin/rbac/staff/create',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Gagal membuat akun petugas baru.'
  );
  return res.message || 'Akun petugas baru berhasil dibuat.';
}

export async function revokeRbacStaff(token: string, userId: number): Promise<string> {
  const res = await rbacApiRequest<unknown>(
    `/api/admin/rbac/staff/${userId}`,
    token,
    {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    },
    'Gagal mencabut hak akses staf.'
  );
  return res.message || 'Hak akses staf berhasil dicabut.';
}

export async function createRbacCustomRole(
  token: string,
  payload: { slug: string; name: string; description: string; permission_keys: string[] }
): Promise<string> {
  const res = await rbacApiRequest<PlatformRoleItem>(
    '/api/admin/rbac/roles',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Gagal membuat custom role baru.'
  );
  return res.message || 'Custom role baru berhasil dibuat.';
}

export async function updateRbacCustomRole(
  token: string,
  slug: string,
  payload: { name: string; description: string; permission_keys?: string[] }
): Promise<string> {
  const res = await rbacApiRequest<PlatformRoleItem>(
    `/api/admin/rbac/roles/${encodeURIComponent(slug)}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        permission_keys: payload.permission_keys,
        has_permissions: Array.isArray(payload.permission_keys),
      }),
    },
    'Gagal memperbarui custom role.'
  );
  return res.message || 'Custom role berhasil diperbarui.';
}

export async function deleteRbacCustomRole(token: string, slug: string): Promise<string> {
  const res = await rbacApiRequest<unknown>(
    `/api/admin/rbac/roles/${encodeURIComponent(slug)}`,
    token,
    { method: 'DELETE' },
    'Gagal menghapus custom role.'
  );
  return res.message || 'Custom role berhasil dihapus.';
}
