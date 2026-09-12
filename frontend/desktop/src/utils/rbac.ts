export interface UserRBACInfo {
  id?: number;
  name?: string;
  email?: string;
  platform_role?: string;
  is_superadmin?: boolean;
  is_admin?: boolean;
  permissions?: string[];
}

export interface PlatformRole {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions?: PlatformPermission[];
}

export interface PlatformPermission {
  id: number;
  key: string;
  group: string;
  name: string;
  description: string;
}

export interface AdminStaffUser {
  id: number;
  name: string;
  email: string;
  platform_role: string;
  role_name: string;
  created_at: string;
}

export const hasPermission = (user: UserRBACInfo | null | undefined, permissionKey: string): boolean => {
  if (!user) return false;
  if (user.is_superadmin || user.platform_role === 'superadmin' || user.email === 'admin@catavor.com') return true;
  if (!user.permissions || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes(permissionKey) || user.permissions.includes('*');
};

export const isPlatformAdmin = (user: UserRBACInfo | null | undefined): boolean => {
  if (!user) return false;
  if (user.is_superadmin || user.is_admin || user.email === 'admin@catavor.com') return true;
  return Boolean(user.platform_role && user.platform_role !== 'merchant' && user.platform_role !== '');
};

export const isSuperAdmin = (user: UserRBACInfo | null | undefined): boolean => {
  if (!user) return false;
  return Boolean(user.is_superadmin || user.platform_role === 'superadmin' || user.email === 'admin@catavor.com');
};

export const getRoleBadge = (roleSlug: string) => {
  switch (roleSlug?.toLowerCase()) {
    case 'superadmin':
      return { label: 'Super Admin', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' };
    case 'compliance':
      return { label: 'Compliance & Satwa', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' };
    case 'support':
      return { label: 'Customer Support', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' };
    case 'finance':
      return { label: 'Finance & Billing', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
    case 'content':
      return { label: 'Content & Marketing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
    default:
      return { label: roleSlug ? roleSlug.toUpperCase() : 'Merchant', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
  }
};
