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
  Info
} from 'lucide-react';
import {
  type PlatformRole,
  type PlatformPermission,
  type AdminStaffUser,
  getRoleBadge,
} from '../utils/rbac';
import { useModalBackHandler } from '../utils/navigation';
import { DesktopCustomSelect } from './DesktopCustomSelect';

interface AdminRBACManagementProps {
  token: string;
  currentUserEmail?: string;
  onClose?: () => void;
  themeMode?: 'dark' | 'light';
  hideHeader?: boolean;
}

export const AdminRBACManagement: React.FC<AdminRBACManagementProps> = ({
  token,
  currentUserEmail,
  onClose,
  themeMode = 'dark',
  hideHeader = false,
}) => {
  const isDark = themeMode !== 'light';

  // Professional Theme Design Tokens (Anti-Cramped, Generous Breathing Room)
  const colors = {
    bg: isDark ? 'transparent' : '#ffffff',
    cardBg: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
    cardAlt: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
    statCardBg: isDark ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%)' : '#ffffff',
    border: isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(148, 163, 184, 0.22)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    inputBg: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
    inputBorder: isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1',
    tableHeaderBg: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
    tableRowHover: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
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
    shadow: isDark ? '0 10px 30px -10px rgba(0, 0, 0, 0.5)' : '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
    modalBg: isDark ? '#0f172a' : '#ffffff',
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
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Matrix edit state: roleSlug -> Set of permission keys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState<string | null>(null);

  // Assign Role Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('support');

  useModalBackHandler({
    isOpen: showAssignModal,
    onClose: () => setShowAssignModal(false)
  });

  // Create Staff Modal
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

  // New Custom Role Form State
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

      // 1. Fetch Staff List
      const staffRes = await fetch('/api/admin/rbac/staff', { headers });
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaffList(staffData.data || []);
      }

      // 2. Fetch Matrix
      const matrixRes = await fetch('/api/admin/rbac/matrix', { headers });
      const matrixData = await matrixRes.json();
      if (matrixData.success) {
        const loadedRoles: PlatformRole[] = matrixData.data.roles || [];
        const loadedPerms: PlatformPermission[] = matrixData.data.permissions || [];
        setRoles(loadedRoles);
        setPermissions(loadedPerms);

        const stateMap: Record<string, Set<string>> = {};
        loadedRoles.forEach((r) => {
          const permSet = new Set<string>();
          if (r.permissions) {
            r.permissions.forEach((p) => permSet.add(p.key));
          }
          stateMap[r.slug] = permSet;
        });
        setMatrixState(stateMap);
        setHasUnsavedChanges(false);
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
    if (roleSlug === 'superadmin') return; // Superadmin always has full access

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
    setHasUnsavedChanges(true);
  };

  const handleSaveMatrix = async (roleSlug: string) => {
    setSavingMatrix(roleSlug);
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
        setSuccessMsg(`Hak akses role '${roleSlug}' berhasil disimpan secara realtime.`);
        setHasUnsavedChanges(false);
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan perubahan matriks.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setSavingMatrix(null);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffEmail.trim() || !selectedRoleSlug) return;
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
          email: selectedStaffEmail.trim(),
          role_slug: selectedRoleSlug,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Role staf '${selectedStaffEmail}' berhasil diubah menjadi '${selectedRoleSlug}'.`);
        setShowAssignModal(false);
        setSelectedStaffEmail('');
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
        setSuccessMsg(`Akun petugas '${newStaffName.trim()}' (${newStaffEmail.trim()}) berhasil dibuat dengan role '${newStaffRoleSlug}'.`);
        setShowCreateStaffModal(false);
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffRoleSlug('support');
        setShowStaffPassword(false);
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal menambahkan akun petugas baru.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleRevokeRole = async (userId: number, email: string) => {
    if (!window.confirm(`Yakin ingin mencabut hak akses admin dari '${email}'? Pengguna akan kembali menjadi merchant standar.`)) {
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
        setErrorMsg(data.message || 'Gagal mencabut hak akses admin.');
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
        setSuccessMsg(`Role kustom '${newRoleName}' (${newRoleSlug}) berhasil dibuat.`);
        setNewRoleSlug('');
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRolePerms(new Set());
        setActiveTab('matrix');
        fetchRBACData();
      } else {
        setErrorMsg(data.message || 'Gagal membuat role kustom.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setCreatingRole(false);
    }
  };

  // Group permissions by category
  const groupedPermissions: Record<string, PlatformPermission[]> = {};
  permissions.forEach((p) => {
    const grp = p.group || 'Umum';
    if (!groupedPermissions[grp]) groupedPermissions[grp] = [];
    groupedPermissions[grp].push(p);
  });

  // Filter staff by search query
  const filteredStaff = staffList.filter(
    (s) =>
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.role_name && s.role_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.platform_role && s.platform_role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', boxSizing: 'border-box' }}>
      {/* 1. Header (When not embedded with outer shell header) */}
      {!hideHeader && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '1.25rem',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '0.85rem',
              backgroundColor: colors.accentBadgeBg,
              border: `1px solid ${colors.accentBadgeBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.accentBadgeColor
            }}>
              <Shield size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
                Tata Kelola Staf &amp; RBAC Platform
              </h2>
              <p style={{ fontSize: '0.82rem', color: colors.textSecondary, margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                Manajemen peran berjenjang, pemisahan wewenang operasional (*Separation of Duties*), dan matriks izin dinamis.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={fetchRBACData}
              disabled={loading}
              className="btn-secondary"
              style={{
                padding: '0.55rem 1rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: '0.65rem',
                fontWeight: 600
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
                style={{ padding: '0.55rem', borderRadius: '0.65rem' }}
                title="Tutup Panel"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Executive KPI Summary Cards (Desktop Breathing Room & Responsive Adaptivity) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1.15rem'
      }}>
        {/* Card 1: Total Staf */}
        <div style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '1rem',
          padding: '1.25rem 1.4rem',
          boxShadow: colors.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '0.75rem',
            backgroundColor: colors.accentBadgeBg,
            border: `1px solid ${colors.accentBadgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.accentBadgeColor,
            flexShrink: 0
          }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Petugas Aktif
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: colors.textPrimary, lineHeight: 1.2, marginTop: '0.15rem' }}>
              {staffList.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '0.2rem' }}>
              Terdaftar di konsol admin
            </div>
          </div>
        </div>

        {/* Card 2: Peran Terdaftar */}
        <div style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '1rem',
          padding: '1.25rem 1.4rem',
          boxShadow: colors.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            flexShrink: 0
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Peran RBAC
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: colors.textPrimary, lineHeight: 1.2, marginTop: '0.15rem' }}>
              {roles.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '0.2rem' }}>
              Tingkat wewenang operasional
            </div>
          </div>
        </div>

        {/* Card 3: Katalog Hak Akses */}
        <div style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '1rem',
          padding: '1.25rem 1.4rem',
          boxShadow: colors.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <Key size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Izin Granular
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: colors.textPrimary, lineHeight: 1.2, marginTop: '0.15rem' }}>
              {permissions.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '0.2rem' }}>
              Titik kontrol domain sistem
            </div>
          </div>
        </div>

        {/* Card 4: Status Penegakan Kebijakan */}
        <div style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '1rem',
          padding: '1.25rem 1.4rem',
          boxShadow: colors.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            flexShrink: 0
          }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Status Kebijakan
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', lineHeight: 1.2, marginTop: '0.25rem' }}>
              Aktif Realtime
            </div>
            <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '0.2rem' }}>
              Zero-downtime hot-reload
            </div>
          </div>
        </div>
      </div>

      {/* 3. Alerts (When present) */}
      {errorMsg && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.28)',
          color: '#f87171',
          padding: '0.9rem 1.2rem',
          borderRadius: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.85rem',
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
          padding: '0.9rem 1.2rem',
          borderRadius: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4. Elevated Segmented Tab Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.tabTrackBg,
        padding: '0.35rem',
        borderRadius: '0.95rem',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {/* Tab 1: Daftar Staf */}
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '0.75rem',
              backgroundColor: activeTab === 'staff' ? colors.tabActiveBg : 'transparent',
              color: activeTab === 'staff' ? colors.tabActiveText : colors.tabInactiveText,
              border: activeTab === 'staff' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'staff' ? colors.tabActiveShadow : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Users size={16} />
            <span>Daftar Staf Petugas</span>
            <span style={{
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: activeTab === 'staff' ? 'rgba(255, 255, 255, 0.2)' : colors.cardAlt,
              color: activeTab === 'staff' ? '#ffffff' : colors.textPrimary,
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              {staffList.length}
            </span>
          </button>

          {/* Tab 2: Matriks Hak Akses Dinamis */}
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '0.75rem',
              backgroundColor: activeTab === 'matrix' ? colors.tabActiveBg : 'transparent',
              color: activeTab === 'matrix' ? colors.tabActiveText : colors.tabInactiveText,
              border: activeTab === 'matrix' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'matrix' ? colors.tabActiveShadow : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Key size={16} />
            <span>Matriks Hak Akses Dinamis</span>
            {hasUnsavedChanges && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800
              }}>
                Belum Disimpan
              </span>
            )}
          </button>

          {/* Tab 3: Buat Role Kustom */}
          <button
            type="button"
            onClick={() => setActiveTab('create_role')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '0.75rem',
              backgroundColor: activeTab === 'create_role' ? colors.tabActiveBg : 'transparent',
              color: activeTab === 'create_role' ? colors.tabActiveText : colors.tabInactiveText,
              border: activeTab === 'create_role' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'create_role' ? colors.tabActiveShadow : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Plus size={16} />
            <span>Definisikan Role Kustom</span>
          </button>
        </div>

        {/* Quick Refresh CTA on the right */}
        <button
          type="button"
          onClick={fetchRBACData}
          disabled={loading}
          style={{
            padding: '0.5rem 0.9rem',
            background: 'transparent',
            border: 'none',
            color: colors.textSecondary,
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: '0.65rem'
          }}
          title="Sinkronisasi Ulang Data RBAC"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Sinkronkan Matriks</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. TAB 1: DAFTAR STAF & PETUGAS (Spacious Desktop Data Table)              */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar: Search & Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '320px', maxWidth: '580px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, email, atau peran..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    paddingLeft: '2.5rem',
                    paddingRight: '1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.78rem', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                Menampilkan <strong>{filteredStaff.length}</strong> dari {staffList.length} petugas
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedStaffEmail('');
                  setSelectedRoleSlug('support');
                  setShowAssignModal(true);
                }}
                className="btn-secondary"
                style={{
                  height: '42px',
                  padding: '0 1.15rem',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  borderRadius: '0.75rem',
                  fontWeight: 700
                }}
              >
                <Edit2 size={15} />
                <span>Ubah Role Staf</span>
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
                  height: '42px',
                  padding: '0 1.25rem',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: colors.primaryActionBg,
                  color: '#ffffff',
                  fontWeight: 800,
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: colors.primaryActionShadow,
                  transition: 'all 0.15s ease'
                }}
              >
                <UserPlus size={16} />
                <span>+ Tambah Petugas Baru</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: colors.shadow
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  backgroundColor: colors.tableHeaderBg,
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Petugas Operasional
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Alamat Email
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Peran &amp; Wewenang
                  </th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
                    Aksi Tata Kelola
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '4rem 1.5rem', textAlign: 'center', color: colors.textSecondary }}>
                      <Users size={36} style={{ color: colors.textMuted, margin: '0 auto 0.75rem auto' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: colors.textPrimary }}>
                        Tidak Ada Petugas Staf Ditemukan
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: colors.textMuted }}>
                        Coba gunakan kata kunci pencarian yang berbeda atau tambahkan akun petugas baru.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const badge = getRoleBadge(staff.platform_role);
                    const isPrimarySuperadmin = staff.email === 'admin@catavor.com';
                    const isSelf = staff.email === currentUserEmail;

                    return (
                      <tr
                        key={staff.id}
                        style={{
                          borderBottom: `1px solid ${colors.border}`,
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Petugas Avatar + Name */}
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '0.75rem',
                              backgroundColor: badge.bg,
                              border: `1px solid ${badge.border}`,
                              color: badge.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.92rem',
                              flexShrink: 0
                            }}>
                              {staff.name ? staff.name.charAt(0).toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: colors.textPrimary }}>
                                  {staff.name || 'Petugas Platform'}
                                </span>
                                {isSelf && (
                                  <span style={{
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '999px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                    color: '#60a5fa',
                                    fontSize: '0.68rem',
                                    fontWeight: 800
                                  }}>
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: colors.textMuted, marginTop: '0.15rem' }}>
                                ID Petugas: #{staff.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email + Copy button */}
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.84rem', color: colors.textSecondary, fontFamily: 'monospace' }}>
                              {staff.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(staff.email)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: copiedEmail === staff.email ? '#10b981' : colors.textMuted,
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title={copiedEmail === staff.email ? 'Email disalin!' : 'Salin email'}
                            >
                              {copiedEmail === staff.email ? <CheckCheck size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            letterSpacing: '0.02em'
                          }}>
                            <Shield size={12} />
                            <span>{staff.role_name}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffEmail(staff.email);
                                setSelectedRoleSlug(staff.platform_role);
                                setShowAssignModal(true);
                              }}
                              className="btn-secondary"
                              style={{
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.78rem',
                                borderRadius: '0.6rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Edit2 size={13} />
                              <span>Ubah Role</span>
                            </button>

                            {!isPrimarySuperadmin && (
                              <button
                                type="button"
                                onClick={() => handleRevokeRole(staff.id, staff.email)}
                                style={{
                                  padding: '0.45rem 0.85rem',
                                  fontSize: '0.78rem',
                                  borderRadius: '0.6rem',
                                  fontWeight: 700,
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Cabut status staf admin dan kembalikan ke merchant reguler"
                              >
                                <Trash2 size={13} />
                                <span>Cabut Akses</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 2: MATRIKS HAK AKSES DINAMIS (Spacious Desktop Matrix View)         */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Info & Quick Filter Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '0.85rem',
            padding: '1rem 1.4rem',
            boxShadow: colors.shadow
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
              <Info size={18} style={{ color: colors.textMuted, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.45 }}>
                Atur granularitas hak akses operasional. Setiap perubahan izin per role dapat disimpan secara realtime tanpa perlu restart backend.
              </p>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
              <input
                type="text"
                placeholder="Filter hak akses..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  paddingLeft: '2.2rem',
                  paddingRight: '0.75rem',
                  borderRadius: '0.65rem',
                  backgroundColor: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  color: colors.textPrimary,
                  fontSize: '0.78rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Matrix Table with Sticky Headers */}
          <div style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '1rem',
            overflow: 'auto',
            maxHeight: '650px',
            boxShadow: colors.shadow
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  backgroundColor: colors.tableHeaderBg,
                  borderBottom: `1px solid ${colors.border}`,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  <th style={{
                    padding: '1.1rem 1.5rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    minWidth: '320px',
                    backgroundColor: colors.tableHeaderBg
                  }}>
                    Katalog Izin &amp; Domain Hak Akses
                  </th>
                  {roles.map((r) => {
                    const badge = getRoleBadge(r.slug);
                    const isSaving = savingMatrix === r.slug;

                    return (
                      <th
                        key={r.slug}
                        style={{
                          padding: '1rem 0.85rem',
                          textAlign: 'center',
                          minWidth: '150px',
                          backgroundColor: colors.tableHeaderBg,
                          borderLeft: `1px solid ${colors.border}`
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}>
                            {r.name}
                          </span>
                          {r.slug !== 'superadmin' ? (
                            <button
                              type="button"
                              onClick={() => handleSaveMatrix(r.slug)}
                              disabled={Boolean(savingMatrix)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.74rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #059669',
                                backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5',
                                color: isDark ? '#34d399' : '#059669',
                                cursor: 'pointer',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.15s ease'
                              }}
                              title={`Simpan hak akses untuk role ${r.name}`}
                            >
                              <Save size={12} className={isSaving ? 'animate-spin' : ''} />
                              <span>{isSaving ? 'Menyimpan...' : 'Simpan Role'}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Lock size={11} />
                              <span>Akses Penuh</span>
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedPermissions).map((groupKey) => {
                  const filteredPerms = groupedPermissions[groupKey].filter(
                    (p) =>
                      !matrixSearch.trim() ||
                      p.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                      p.key.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                      (p.description && p.description.toLowerCase().includes(matrixSearch.toLowerCase()))
                  );

                  if (filteredPerms.length === 0) return null;

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Domain Header Row */}
                      <tr style={{
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.35)' : '#f1f5f9',
                        borderTop: `1px solid ${colors.border}`,
                        borderBottom: `1px solid ${colors.border}`
                      }}>
                        <td
                          colSpan={roles.length + 1}
                          style={{
                            padding: '0.65rem 1.5rem',
                            fontWeight: 900,
                            fontSize: '0.74rem',
                            textTransform: 'uppercase',
                            color: colors.accentBadgeColor,
                            letterSpacing: '0.08em'
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Layers size={14} />
                            <span>DOMAIN: {groupKey.toUpperCase()}</span>
                          </div>
                        </td>
                      </tr>

                      {/* Permissions in this Domain */}
                      {filteredPerms.map((perm) => (
                        <tr
                          key={perm.key}
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '0.9rem 1.5rem' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: colors.textPrimary }}>
                              {perm.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '0.2rem', lineHeight: 1.4 }}>
                              <code style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.3rem',
                                color: colors.textSecondary
                              }}>
                                {perm.key}
                              </code>
                              {perm.description ? ` • ${perm.description}` : ''}
                            </div>
                          </td>

                          {/* Checkboxes per role */}
                          {roles.map((r) => {
                            const isSuper = r.slug === 'superadmin';
                            const isChecked = isSuper || (matrixState[r.slug]?.has(perm.key) ?? false);

                            return (
                              <td
                                key={r.slug}
                                style={{
                                  padding: '0.9rem 0.85rem',
                                  textAlign: 'center',
                                  borderLeft: `1px solid ${colors.border}`
                                }}
                              >
                                {isSuper ? (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '0.35rem',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981'
                                    }}
                                    title="Superadmin memiliki akses absolut tidak terbatas"
                                  >
                                    <Lock size={13} />
                                  </div>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleMatrixPerm(r.slug, perm.key)}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      cursor: 'pointer',
                                      accentColor: colors.primaryActionBg,
                                      borderRadius: '0.35rem'
                                    }}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 3: BUAT ROLE KUSTOM (Spacious Desktop Form)                        */}
      {/* ========================================================================= */}
      {activeTab === 'create_role' && (
        <form onSubmit={handleCreateCustomRole} style={{ width: '100%' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.75rem',
            alignItems: 'start'
          }}>
            {/* Left Card: Role Metadata */}
            <div style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '1rem',
              padding: '1.75rem',
              boxShadow: colors.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: colors.textPrimary }}>
                  Definisikan Peran Kustom
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: colors.textSecondary }}>
                  Buat tingkat wewenang baru spesifik untuk tim internal Anda.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Slug Role (ID Unik Huruf Kecil) <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: junior_support / legal_officer"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Nama Tampilan Role <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Junior Support & Helpdesk"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Deskripsi Tanggung Jawab
                </label>
                <textarea
                  placeholder="Jelaskan cakupan wewenang dan tugas operasional role ini..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={creatingRole}
                style={{
                  height: '44px',
                  backgroundColor: colors.primaryActionBg,
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
                  boxShadow: colors.primaryActionShadow,
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

            {/* Right Card: Categorized Permission Checklist */}
            <div style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: '1rem',
              padding: '1.75rem',
              boxShadow: colors.shadow
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: colors.textPrimary }}>
                    Pilih Izin Awal untuk Role Baru
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: colors.textSecondary }}>
                    Terpilih: <strong>{newRolePerms.size}</strong> dari {permissions.length} izin platform.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (newRolePerms.size === permissions.length) {
                      setNewRolePerms(new Set());
                    } else {
                      setNewRolePerms(new Set(permissions.map((p) => p.key)));
                    }
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  {newRolePerms.size === permissions.length ? 'Batal Semua' : 'Pilih Semua Izin'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '550px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {Object.keys(groupedPermissions).map((grpKey) => {
                  const grpPerms = groupedPermissions[grpKey];
                  const allGrpSelected = grpPerms.every((p) => newRolePerms.has(p.key));

                  return (
                    <div
                      key={grpKey}
                      style={{
                        backgroundColor: colors.cardAlt,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '0.85rem',
                        padding: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: colors.accentBadgeColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          DOMAIN: {grpKey}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewRolePerms((prev) => {
                              const next = new Set(prev);
                              if (allGrpSelected) {
                                grpPerms.forEach((p) => next.delete(p.key));
                              } else {
                                grpPerms.forEach((p) => next.add(p.key));
                              }
                              return next;
                            });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: colors.textSecondary,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          {allGrpSelected ? 'Batalkan Domain' : 'Pilih Semua Domain'}
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem' }}>
                        {grpPerms.map((p) => {
                          const isSelected = newRolePerms.has(p.key);
                          return (
                            <label
                              key={p.key}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.55rem',
                                padding: '0.65rem 0.75rem',
                                borderRadius: '0.6rem',
                                backgroundColor: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff') : 'transparent',
                                border: `1px solid ${isSelected ? 'rgba(37, 99, 235, 0.4)' : colors.border}`,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setNewRolePerms((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(p.key)) next.delete(p.key);
                                    else next.add(p.key);
                                    return next;
                                  });
                                }}
                                style={{ marginTop: '2px', accentColor: colors.primaryActionBg, cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: colors.textPrimary }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.1rem' }}>
                                  <code>{p.key}</code>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL 1: UBAH ROLE STAF (Spacious Desktop Centered Dialog)             */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: colors.modalBg,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65)',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: colors.accentBadgeBg,
                  border: `1px solid ${colors.accentBadgeBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.accentBadgeColor
                }}>
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: colors.textPrimary }}>
                    Penugasan Peran Staf
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '0.15rem 0 0 0' }}>
                    Tetapkan tingkat wewenang akun operasional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Alamat Email Staf <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
                  <input
                    type="email"
                    placeholder="nama@catavor.com"
                    value={selectedStaffEmail}
                    onChange={(e) => setSelectedStaffEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      paddingLeft: '2.4rem',
                      paddingRight: '0.85rem',
                      borderRadius: '0.75rem',
                      backgroundColor: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                <p style={{ fontSize: '0.72rem', color: colors.textMuted, margin: '0.35rem 0 0 0' }}>
                  Pastikan email tersebut telah terdaftar di sistem Catavor.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Pilih Peran Platform <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <DesktopCustomSelect
                  value={selectedRoleSlug}
                  onChange={(val) => setSelectedRoleSlug(val)}
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
                  onClick={() => setShowAssignModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.82rem', borderRadius: '0.75rem', fontWeight: 700 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '0.75rem',
                    backgroundColor: colors.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: colors.primaryActionShadow
                  }}
                >
                  <Check size={16} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>

              <div style={{
                marginTop: '0.5rem',
                paddingTop: '0.85rem',
                borderTop: `1px solid ${colors.border}`,
                textAlign: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setNewStaffName('');
                    setNewStaffEmail('');
                    setNewStaffPassword('');
                    setNewStaffRoleSlug('support');
                    setShowStaffPassword(false);
                    setShowCreateStaffModal(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.accentBadgeColor,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <UserPlus size={14} />
                  <span>Petugas belum punya akun? Buat akun petugas baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL 2: TAMBAH PETUGAS BARU (Spacious Desktop Centered Dialog)         */}
      {/* ========================================================================= */}
      {showCreateStaffModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowCreateStaffModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: colors.modalBg,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: '1.25rem',
              padding: '2.25rem',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65)',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '0.85rem',
                  backgroundColor: colors.accentBadgeBg,
                  border: `1px solid ${colors.accentBadgeBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.accentBadgeColor
                }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: colors.textPrimary }}>
                    Tambah Akun Petugas Baru
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: colors.textSecondary, margin: '0.2rem 0 0 0' }}>
                    Daftarkan staf operasional &amp; tetapkan wewenang awal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateStaffModal(false)}
                style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Nama Lengkap */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Nama Lengkap Petugas <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
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
                      backgroundColor: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Alamat Email Petugas <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
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
                      backgroundColor: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                <p style={{ fontSize: '0.72rem', color: colors.textMuted, margin: '0.35rem 0 0 0' }}>
                  Alamat email ini digunakan petugas untuk masuk ke konsol /admin.
                </p>
              </div>

              {/* Kata Sandi */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Kata Sandi Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted }} />
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
                      backgroundColor: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary,
                      fontSize: '0.84rem',
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
                      color: colors.textMuted,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: colors.textMuted, margin: '0.35rem 0 0 0' }}>
                  Minimal 8 karakter. Petugas dapat memperbarui kata sandi setelah login.
                </p>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: colors.textPrimary, marginBottom: '0.4rem' }}>
                  Peran &amp; Hak Akses Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <DesktopCustomSelect
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

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.82rem', borderRadius: '0.75rem', fontWeight: 700 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingStaff}
                  style={{
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '0.75rem',
                    backgroundColor: colors.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: creatingStaff ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: colors.primaryActionShadow
                  }}
                >
                  {creatingStaff ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Mendaftarkan Petugas...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Buat Akun Petugas</span>
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
