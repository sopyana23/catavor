import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Key,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  UserPlus,
  Save,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  Mail,
  User,
  Copy,
  CheckCheck,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
  Sliders,
  ShieldAlert,
  HelpCircle,
  CreditCard,
  Activity
} from 'lucide-react';
import {
  type PlatformRole,
  type PlatformPermission,
  type AdminStaffUser,
  getRoleBadge,
} from '../utils/rbac';
import { useModalBackHandler } from '../utils/navigation';
import { TabletCustomSelect } from './TabletCustomSelect';

interface AdminRBACManagementProps {
  token: string;
  currentUserEmail?: string;
  themeMode?: 'dark' | 'light';
  onClose?: () => void;
  hideHeader?: boolean;
}

export const AdminRBACManagement: React.FC<AdminRBACManagementProps> = ({
  token,
  currentUserEmail,
  themeMode = 'dark',
  onClose,
  hideHeader = false,
}) => {
  const isDark = themeMode === 'dark';

  const theme = {
    bg: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#0f172a' : '#ffffff',
    card: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
    cardAlt: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f1f5f9',
    border: isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(148, 163, 184, 0.22)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    inputBg: isDark ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
    inputBorder: isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1',
    modalBg: isDark ? '#0f172a' : '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',
    cardShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 4px 20px rgba(15, 23, 42, 0.05)',
    tabTrackBg: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f1f5f9',
    tabActiveBg: isDark ? 'rgba(255, 255, 255, 0.12)' : '#0f172a',
    tabActiveText: '#ffffff',
    tabInactiveText: isDark ? '#94a3b8' : '#64748b',
    tabActiveShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.35)' : '0 2px 10px rgba(15, 23, 42, 0.15)',
    primaryActionBg: '#2563eb',
    primaryActionHover: '#1d4ed8',
    primaryActionShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
    saveActionBg: '#059669',
    saveActionHover: '#047857',
    saveActionShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
    accentBadgeBg: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
    accentBadgeBorder: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
    accentBadgeColor: isDark ? '#38bdf8' : '#0284c7',
    btnSecondaryBg: isDark ? 'rgba(30, 41, 59, 0.75)' : '#ffffff',
    btnSecondaryBorder: isDark ? 'rgba(148, 163, 184, 0.25)' : '#cbd5e1',
    btnSecondaryText: isDark ? '#f1f5f9' : '#1e293b',
    btnSecondaryHoverBg: isDark ? 'rgba(51, 65, 85, 0.85)' : '#f8fafc',
    btnSecondaryShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
  };

  const [activeTab, setActiveTab] = useState<'staff' | 'matrix' | 'create_role'>('staff');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('support');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Matrix edit state: roleSlug -> Set of permission keys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({});
  const [savingMatrixRole, setSavingMatrixRole] = useState<string | null>(null);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetStaffEmail, setTargetStaffEmail] = useState('');
  const [targetRoleSlug, setTargetRoleSlug] = useState('support');

  useModalBackHandler({
    isOpen: showAssignModal,
    onClose: () => setShowAssignModal(false)
  });

  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRoleSlug, setNewStaffRoleSlug] = useState('support');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);

  useModalBackHandler({
    isOpen: showCreateStaffModal,
    onClose: () => setShowCreateStaffModal(false)
  });

  // Custom Role Form
  const [newRoleSlug, setNewRoleSlug] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set());
  const [creatingRole, setCreatingRole] = useState(false);

  const fetchRBACData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // 1. Fetch staff
      const staffRes = await fetch('/api/admin/rbac/staff', { headers });
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaffList(staffData.data || []);
      }

      // 2. Fetch matrix
      const matrixRes = await fetch('/api/admin/rbac/matrix', { headers });
      const matrixData = await matrixRes.json();
      if (matrixData.success) {
        const loadedRoles: PlatformRole[] = matrixData.data.roles || [];
        const loadedPerms: PlatformPermission[] = matrixData.data.permissions || [];
        setRoles(loadedRoles);
        setPermissions(loadedPerms);

        if (loadedRoles.length > 0 && !selectedRoleSlug) {
          setSelectedRoleSlug(loadedRoles[0].slug);
        }

        const stateMap: Record<string, Set<string>> = {};
        loadedRoles.forEach((r) => {
          const permSet = new Set<string>();
          if (r.permissions) {
            r.permissions.forEach((p) => permSet.add(p.key));
          }
          stateMap[r.slug] = permSet;
        });
        setMatrixState(stateMap);
        setHasUnsavedChanges({});
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data RBAC platform.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRBACData();
  }, [token]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleToggleMatrixPerm = (roleSlug: string, permKey: string) => {
    if (roleSlug === 'superadmin') return;

    setMatrixState((prev) => {
      const currentSet = new Set(prev[roleSlug] || []);
      if (currentSet.has(permKey)) {
        currentSet.delete(permKey);
      } else {
        currentSet.add(permKey);
      }
      return {
        ...prev,
        [roleSlug]: currentSet,
      };
    });

    setHasUnsavedChanges((prev) => ({
      ...prev,
      [roleSlug]: true,
    }));
  };

  const handleSaveMatrix = async (roleSlug: string) => {
    setSavingMatrixRole(roleSlug);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const permKeys = Array.from(matrixState[roleSlug] || []);
      const res = await fetch('/api/admin/rbac/matrix', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_slug: roleSlug,
          permission_keys: permKeys,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Hak akses role '${roleSlug}' berhasil disimpan realtime.`);
        setHasUnsavedChanges((prev) => ({ ...prev, [roleSlug]: false }));
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan perubahan matriks.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setSavingMatrixRole(null);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStaffEmail.trim() || !targetRoleSlug) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/rbac/staff/assign', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: targetStaffEmail.trim(),
          role_slug: targetRoleSlug,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Role staf '${targetStaffEmail}' berhasil diubah.`);
        setShowAssignModal(false);
        setTargetStaffEmail('');
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal mengubah role staf.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      setErrorMsg('Nama lengkap, email, dan password petugas wajib diisi.');
      return;
    }
    if (newStaffPassword.length < 8) {
      setErrorMsg('Password petugas minimal 8 karakter.');
      return;
    }

    setCreatingStaff(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/rbac/staff/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          password: newStaffPassword,
          role_slug: newStaffRoleSlug || 'support',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Akun petugas '${newStaffName.trim()}' berhasil dibuat.`);
        setShowCreateStaffModal(false);
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffRoleSlug('support');
        setShowStaffPassword(false);
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal membuat akun petugas.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleRevokeRole = async (userId: number, email: string) => {
    if (!window.confirm(`Yakin ingin mencabut hak akses admin dari '${email}'? Pengguna akan kembali menjadi merchant biasa.`)) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/admin/rbac/staff/${userId}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Hak akses admin '${email}' berhasil dicabut.`);
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal mencabut hak akses.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleSlug.trim() || !newRoleName.trim()) return;
    setCreatingRole(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/rbac/roles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: newRoleSlug.trim(),
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permission_keys: Array.from(newRolePerms),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Role kustom '${newRoleName}' berhasil dibuat.`);
        setNewRoleSlug('');
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRolePerms(new Set());
        setActiveTab('matrix');
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal membuat custom role.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setCreatingRole(false);
    }
  };

  // Group permissions by category
  const permissionGroups: Record<string, PlatformPermission[]> = {};
  permissions.forEach((p) => {
    const grp = p.group || 'Umum';
    if (!permissionGroups[grp]) permissionGroups[grp] = [];
    permissionGroups[grp].push(p);
  });

  const filteredStaff = staffList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.role_name && s.role_name.toLowerCase().includes(q)) ||
      (s.platform_role && s.platform_role.toLowerCase().includes(q))
    );
  });

  const anyUnsaved = Object.values(hasUnsavedChanges).some(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box', padding: '1.25rem 1.5rem 3rem 1.5rem', maxWidth: '1240px', margin: '0 auto' }}>
      {/* 1. Header (When not embedded with outer shell header) */}
      {!hideHeader && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '1.25rem',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.85rem',
              backgroundColor: theme.accentBadgeBg,
              border: `1px solid ${theme.accentBadgeBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.accentBadgeColor
            }}>
              <Shield size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: theme.textPrimary }}>
                Tata Kelola Staf &amp; RBAC Platform
              </h2>
              <p style={{ fontSize: '0.8rem', color: theme.textSecondary, margin: '0.2rem 0 0 0' }}>
                Pengaturan wewenang multi-tier &amp; matriks izin operasional
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={fetchRBACData}
              disabled={loading}
              className="btn-secondary"
              style={{
                minHeight: '44px',
                padding: '0.5rem 1rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                backgroundColor: theme.btnSecondaryBg,
                border: `1px solid ${theme.btnSecondaryBorder}`,
                color: theme.btnSecondaryText,
                boxShadow: theme.btnSecondaryShadow,
                cursor: loading ? 'wait' : 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan Data</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.btnSecondaryBg,
                  border: `1px solid ${theme.btnSecondaryBorder}`,
                  color: theme.btnSecondaryText,
                  boxShadow: theme.btnSecondaryShadow,
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Tablet 4 KPI Metric Cards (Responsive Grid with Touch Targets) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem'
      }}>
        {/* Metric 1 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '1rem',
          padding: '1.15rem 1.25rem',
          boxShadow: theme.cardShadow,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            backgroundColor: theme.accentBadgeBg,
            border: `1px solid ${theme.accentBadgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.accentBadgeColor,
            flexShrink: 0
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Petugas Staf Aktif
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.1rem' }}>
              {staffList.length}
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '1rem',
          padding: '1.15rem 1.25rem',
          boxShadow: theme.cardShadow,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            flexShrink: 0
          }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Peran RBAC
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.1rem' }}>
              {roles.length}
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '1rem',
          padding: '1.15rem 1.25rem',
          boxShadow: theme.cardShadow,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <Key size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Izin Granular
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.1rem' }}>
              {permissions.length}
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '1rem',
          padding: '1.15rem 1.25rem',
          boxShadow: theme.cardShadow,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            flexShrink: 0
          }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Status Kebijakan
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981', lineHeight: 1.2, marginTop: '0.2rem' }}>
              Aktif Realtime
            </div>
          </div>
        </div>
      </div>

      {/* 3. Alerts */}
      {errorMsg && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.28)',
          color: '#f87171',
          padding: '0.85rem 1.15rem',
          borderRadius: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.84rem',
          fontWeight: 600
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.28)',
          color: '#34d399',
          padding: '0.85rem 1.15rem',
          borderRadius: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.84rem',
          fontWeight: 600
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4. Touch-Friendly Segmented Tab Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.4rem',
        backgroundColor: theme.tabTrackBg,
        padding: '0.35rem',
        borderRadius: '0.95rem',
        border: `1px solid ${theme.border}`
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          style={{
            minHeight: '46px',
            borderRadius: '0.75rem',
            backgroundColor: activeTab === 'staff' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'staff' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'staff' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: activeTab === 'staff' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.18s ease'
          }}
        >
          <Users size={15} />
          <span>Daftar Staf ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            minHeight: '46px',
            borderRadius: '0.75rem',
            backgroundColor: activeTab === 'matrix' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'matrix' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'matrix' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: activeTab === 'matrix' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.18s ease'
          }}
        >
          <Key size={15} />
          <span>Matriks Izin</span>
          {anyUnsaved && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create_role')}
          style={{
            minHeight: '46px',
            borderRadius: '0.75rem',
            backgroundColor: activeTab === 'create_role' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'create_role' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'create_role' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            boxShadow: activeTab === 'create_role' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.18s ease'
          }}
        >
          <Plus size={15} />
          <span>Buat Role Baru</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. TAB 1: DAFTAR STAF (Tablet Responsive 2-Column Touch Grid)             */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Action Header */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
              <input
                type="text"
                placeholder="Cari berdasarkan nama, email, atau peran staf..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '2.5rem',
                  paddingRight: '1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.84rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setTargetStaffEmail('');
                setTargetRoleSlug('support');
                setShowAssignModal(true);
              }}
              className="btn-secondary"
              style={{
                minHeight: '44px',
                padding: '0 1rem',
                fontSize: '0.82rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                backgroundColor: theme.btnSecondaryBg,
                border: `1px solid ${theme.btnSecondaryBorder}`,
                color: theme.btnSecondaryText,
                boxShadow: theme.btnSecondaryShadow,
                cursor: 'pointer'
              }}
            >
              <Edit2 size={14} />
              <span>Ubah Role</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewStaffName('');
                setNewStaffEmail('');
                setNewStaffPassword('');
                setNewStaffRoleSlug('support');
                setShowStaffPassword(false);
                setShowCreateStaffModal(true);
              }}
              style={{
                minHeight: '44px',
                padding: '0 1.15rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '0.75rem',
                backgroundColor: theme.primaryActionBg,
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                boxShadow: theme.primaryActionShadow
              }}
            >
              <UserPlus size={15} />
              <span>Tambah Petugas</span>
            </button>
          </div>

          {/* Responsive Adaptive Card Grid on Tablet (1-col on tight width, 2-col when ample) */}
          {filteredStaff.length === 0 ? (
            <div style={{
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              boxShadow: theme.cardShadow
            }}>
              <Users size={36} color={theme.textMuted} style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ margin: 0, color: theme.textPrimary, fontSize: '0.88rem', fontWeight: 800 }}>
                Tidak Ada Petugas Staf Ditemukan
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: '0.78rem' }}>
                Silakan sesuaikan kata kunci atau daftarkan staf baru.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '1rem'
            }}>
              {filteredStaff.map((staff) => {
                const badge = getRoleBadge(staff.platform_role);
                const isPrimaryAdmin = staff.email === 'admin@catavor.com';
                const isSelf = staff.email === currentUserEmail;

                return (
                  <div
                    key={staff.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '1rem',
                      backgroundColor: theme.surface,
                      border: `1px solid ${theme.border}`,
                      boxShadow: theme.cardShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '0.75rem',
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            flexShrink: 0
                          }}>
                            {staff.name ? staff.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                              <h4 style={{
                                margin: 0,
                                fontSize: '0.92rem',
                                fontWeight: 800,
                                color: theme.textPrimary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0
                              }}>
                                {staff.name || 'Petugas Platform'}
                              </h4>
                              {isSelf && (
                                <span style={{
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '999px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  color: '#60a5fa',
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  flexShrink: 0
                                }}>
                                  Anda
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', minWidth: 0 }}>
                              <span style={{
                                fontSize: '0.76rem',
                                color: theme.textSecondary,
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0
                              }}>
                                {staff.email}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(staff.email)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: copiedEmail === staff.email ? '#10b981' : theme.textMuted,
                                  cursor: 'pointer',
                                  padding: '0.15rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexShrink: 0
                                }}
                                title="Salin Email"
                              >
                                {copiedEmail === staff.email ? <CheckCheck size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {staff.role_name}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.85rem',
                      borderTop: `1px solid ${theme.border}`
                    }}>
                      <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                        ID #{staff.id} &bull; Staf Internal
                      </span>

                      {isPrimaryAdmin ? (
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Lock size={12} />
                          <span>Superadmin Utama</span>
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetStaffEmail(staff.email);
                              setTargetRoleSlug(staff.platform_role || 'support');
                              setShowAssignModal(true);
                            }}
                            className="btn-secondary"
                            style={{
                              minHeight: '40px',
                              padding: '0 0.85rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              backgroundColor: theme.btnSecondaryBg,
                              border: `1px solid ${theme.btnSecondaryBorder}`,
                              color: theme.btnSecondaryText,
                              boxShadow: theme.btnSecondaryShadow,
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Ubah Role</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRevokeRole(staff.id, staff.email)}
                            style={{
                              minHeight: '40px',
                              padding: '0 0.85rem',
                              borderRadius: '0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                              color: isDark ? '#f87171' : '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Cabut</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 2: MATRIKS HAK AKSES DINAMIS (Tablet Role Switcher & Cards)        */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Role Segmented Horizontal Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '1rem',
            padding: '1rem 1.25rem',
            boxShadow: theme.cardShadow
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '280px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase' }}>
                Pilih Role untuk Dikonfigurasi:
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {roles.map((r) => {
                  const isSelected = selectedRoleSlug === r.slug;
                  const isSuper = r.slug === 'superadmin';
                  const roleUnsaved = Boolean(hasUnsavedChanges[r.slug]);

                  return (
                    <button
                      key={r.slug}
                      type="button"
                      onClick={() => setSelectedRoleSlug(r.slug)}
                      style={{
                        minHeight: '44px',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '0.75rem',
                        backgroundColor: isSelected ? theme.primaryActionBg : theme.cardAlt,
                        color: isSelected ? '#ffffff' : theme.textPrimary,
                        border: `1px solid ${isSelected ? theme.primaryActionBg : theme.border}`,
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Shield size={14} />
                      <span>{r.name}</span>
                      {roleUnsaved && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button for active role */}
            {selectedRoleSlug !== 'superadmin' && (
              <button
                type="button"
                onClick={() => handleSaveMatrix(selectedRoleSlug)}
                disabled={Boolean(savingMatrixRole)}
                style={{
                  minHeight: '44px',
                  padding: '0 1.25rem',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.saveActionBg,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: theme.saveActionShadow,
                  whiteSpace: 'nowrap'
                }}
              >
                <Save size={15} className={savingMatrixRole === selectedRoleSlug ? 'animate-spin' : ''} />
                <span>Simpan Izin ({selectedRoleSlug})</span>
              </button>
            )}
          </div>

          {/* Quick Filter */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
            <input
              type="text"
              placeholder="Cari izin hak akses di domain ini..."
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '2.5rem',
                paddingRight: '1rem',
                borderRadius: '0.75rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.textPrimary,
                fontSize: '0.82rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Categorized Permission Cards for the selected role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.keys(permissionGroups).map((groupKey) => {
              const grpPerms = permissionGroups[groupKey].filter(
                (p) =>
                  !matrixSearch.trim() ||
                  p.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                  p.key.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                  (p.description && p.description.toLowerCase().includes(matrixSearch.toLowerCase()))
              );

              if (grpPerms.length === 0) return null;

              const isSuper = selectedRoleSlug === 'superadmin';
              const activePermSet = matrixState[selectedRoleSlug] || new Set();

              return (
                <div
                  key={groupKey}
                  style={{
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    boxShadow: theme.cardShadow
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: `1px solid ${theme.border}`,
                    marginBottom: '0.85rem'
                  }}>
                    <Layers size={16} color={theme.accentBadgeColor} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 900, color: theme.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DOMAIN: {groupKey}
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '0.75rem'
                  }}>
                    {grpPerms.map((perm) => {
                      const isChecked = isSuper || activePermSet.has(perm.key);

                      return (
                        <div
                          key={perm.key}
                          onClick={() => {
                            if (!isSuper) handleToggleMatrixPerm(selectedRoleSlug, perm.key);
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0.85rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: isChecked ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : theme.cardAlt,
                            border: `1px solid ${isChecked ? (isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.25)') : theme.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            cursor: isSuper ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                            overflow: 'hidden',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.35, wordBreak: 'break-word' }}>
                              {perm.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: theme.textMuted, marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <code>{perm.key}</code>
                            </div>
                          </div>

                          {isSuper ? (
                            <span style={{
                              fontSize: '0.7rem',
                              color: '#10b981',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '20px',
                              height: '20px',
                              minWidth: '20px',
                              minHeight: '20px',
                              flexShrink: 0
                            }}>
                              <Lock size={13} />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleMatrixPerm(selectedRoleSlug, perm.key)}
                              style={{
                                width: '20px',
                                height: '20px',
                                minWidth: '20px',
                                minHeight: '20px',
                                maxWidth: '20px',
                                maxHeight: '20px',
                                flexShrink: 0,
                                cursor: 'pointer',
                                accentColor: theme.primaryActionBg,
                                margin: 0
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 3: BUAT ROLE KUSTOM (Tablet Clean Form)                            */}
      {/* ========================================================================= */}
      {activeTab === 'create_role' && (
        <form onSubmit={handleCreateCustomRole} style={{ width: '100%' }}>
          <div style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: theme.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: theme.textPrimary }}>
                Definisikan Peran Kustom
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: theme.textSecondary }}>
                Buat tingkat wewenang baru spesifik untuk tim internal Anda.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.4rem' }}>
                  Slug Role (ID Unik) <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: junior_support"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.4rem' }}>
                  Nama Tampilan Role <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Junior Support & Helpdesk"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.4rem' }}>
                Deskripsi Tanggung Jawab
              </label>
              <textarea
                placeholder="Jelaskan cakupan wewenang dan tugas operasional role ini..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.84rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.textPrimary }}>
                  Pilih Izin Awal ({newRolePerms.size} terpilih):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (newRolePerms.size === permissions.length) {
                      setNewRolePerms(new Set());
                    } else {
                      setNewRolePerms(new Set(permissions.map((p) => p.key)));
                    }
                  }}
                  style={{
                    minHeight: '36px',
                    padding: '0 0.85rem',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    borderRadius: '0.65rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                    border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(37, 99, 235, 0.25)'}`,
                    color: isDark ? '#38bdf8' : '#2563eb',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.12)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {newRolePerms.size === permissions.length ? (
                    <>
                      <X size={14} />
                      <span>Batal Semua</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck size={14} />
                      <span>Pilih Semua</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{
                maxHeight: '350px',
                overflowY: 'auto',
                border: `1px solid ${theme.border}`,
                borderRadius: '0.75rem',
                padding: '0.85rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.5rem'
              }}>
                {permissions.map((p) => {
                  const isSelected = newRolePerms.has(p.key);
                  return (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.6rem',
                        backgroundColor: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(37, 99, 235, 0.35)' : theme.border}`,
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        minWidth: 0
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setNewRolePerms((prev) => {
                            const n = new Set(prev);
                            if (n.has(p.key)) n.delete(p.key);
                            else n.add(p.key);
                            return n;
                          });
                        }}
                        style={{
                          width: '18px',
                          height: '18px',
                          minWidth: '18px',
                          minHeight: '18px',
                          maxWidth: '18px',
                          maxHeight: '18px',
                          flexShrink: 0,
                          cursor: 'pointer',
                          accentColor: theme.primaryActionBg,
                          margin: 0
                        }}
                      />
                      <span style={{
                        fontSize: '0.78rem',
                        color: theme.textPrimary,
                        fontWeight: 700,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {p.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingRole}
              style={{
                minHeight: '46px',
                backgroundColor: theme.primaryActionBg,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.84rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: creatingRole ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: theme.primaryActionShadow,
                marginTop: '0.5rem'
              }}
            >
              {creatingRole ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Mendaftarkan Role...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Buat Role Kustom Sekarang</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL 1: UBAH ROLE STAF (Tablet Centered Panel)                        */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: theme.modalBg,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '1.25rem',
              padding: '1.75rem',
              boxShadow: theme.cardShadow,
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.accentBadgeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.accentBadgeColor
                }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: theme.textPrimary }}>
                    Penugasan Peran Staf
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: theme.textSecondary, margin: '0.15rem 0 0 0' }}>
                    Tetapkan wewenang operasional pengguna internal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.4rem' }}>
                  Email Staf <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                  <input
                    type="email"
                    placeholder="nama@catavor.com"
                    value={targetStaffEmail}
                    onChange={(e) => setTargetStaffEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '2.4rem',
                      paddingRight: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.4rem' }}>
                  Pilih Role Platform <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <TabletCustomSelect
                  value={targetRoleSlug}
                  onChange={(val) => setTargetRoleSlug(val)}
                  options={roles.map((r) => ({
                    value: r.slug,
                    label: `${r.name} (${r.slug})`
                  }))}
                  placeholder="Pilih Role Platform..."
                  style={{ width: '100%' }}
                  triggerStyle={{ height: '44px', borderRadius: '0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn-secondary"
                  style={{
                    minHeight: '44px',
                    padding: '0 1.25rem',
                    fontSize: '0.82rem',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    boxShadow: theme.btnSecondaryShadow,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    minHeight: '44px',
                    padding: '0 1.35rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '0.75rem',
                    backgroundColor: theme.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: theme.primaryActionShadow
                  }}
                >
                  <Check size={16} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL 2: TAMBAH PETUGAS BARU (Tablet Centered Panel)                   */}
      {/* ========================================================================= */}
      {showCreateStaffModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowCreateStaffModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: theme.modalBg,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: theme.cardShadow,
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.accentBadgeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.accentBadgeColor
                }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: theme.textPrimary }}>
                    Tambah Akun Petugas Baru
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: theme.textSecondary, margin: '0.15rem 0 0 0' }}>
                    Daftarkan akun staf operasional internal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateStaffModal(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Nama Lengkap Petugas <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '2.4rem',
                      paddingRight: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Alamat Email <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                  <input
                    type="email"
                    placeholder="petugas@catavor.com"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '2.4rem',
                      paddingRight: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Kata Sandi Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    placeholder="Minimal 8 karakter..."
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    minLength={8}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '2.4rem',
                      paddingRight: '2.6rem',
                      borderRadius: '0.75rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary,
                      fontSize: '0.82rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: theme.textMuted,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Peran &amp; Hak Akses Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <TabletCustomSelect
                  value={newStaffRoleSlug}
                  onChange={(val) => setNewStaffRoleSlug(val)}
                  options={roles.map((r) => ({
                    value: r.slug,
                    label: `${r.name} (${r.slug})`
                  }))}
                  placeholder="Pilih Peran Platform..."
                  style={{ width: '100%' }}
                  triggerStyle={{ height: '44px', borderRadius: '0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="btn-secondary"
                  style={{
                    minHeight: '44px',
                    padding: '0 1.25rem',
                    fontSize: '0.82rem',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    boxShadow: theme.btnSecondaryShadow,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingStaff}
                  style={{
                    minHeight: '44px',
                    padding: '0 1.35rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '0.75rem',
                    backgroundColor: theme.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: creatingStaff ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: theme.primaryActionShadow
                  }}
                >
                  {creatingStaff ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Mendaftarkan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Buat Petugas</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
