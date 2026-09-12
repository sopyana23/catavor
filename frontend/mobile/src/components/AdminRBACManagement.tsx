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
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCheck,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  CreditCard,
  Megaphone,
  Activity,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  type PlatformRole,
  type PlatformPermission,
  type AdminStaffUser,
  getRoleBadge,
} from '../utils/rbac';

interface AdminRBACManagementProps {
  token: string;
  currentUserEmail?: string;
  themeMode?: 'dark' | 'light';
  onClose?: () => void;
}

export const AdminRBACManagement: React.FC<AdminRBACManagementProps> = ({
  token,
  currentUserEmail,
  themeMode = 'dark',
  onClose,
}) => {
  const isDark = themeMode === 'dark';

  const theme = {
    bg: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#0f172a' : '#ffffff',
    card: isDark ? '#1e293b' : '#ffffff',
    cardAlt: isDark ? '#141d2e' : '#f1f5f9',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    inputBg: isDark ? '#1e293b' : '#ffffff',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
    modalBg: isDark ? '#0f172a' : '#ffffff',
    modalOverlay: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.45)',
    cardShadow: isDark ? '0 4px 15px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.04)',
    tabInactiveBg: isDark ? '#1e293b' : '#f1f5f9',
    tabInactiveText: isDark ? '#94a3b8' : '#64748b'
  };

  const [activeTab, setActiveTab] = useState<'staff' | 'matrix' | 'create_role'>('staff');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Data states
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Active accordion role in matrix tab
  const [expandedRoleSlug, setExpandedRoleSlug] = useState<string>('compliance');

  // Matrix edit state: roleSlug -> Set of permission keys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({});
  const [savingMatrixRole, setSavingMatrixRole] = useState<string | null>(null);

  // Modals / Bottom Sheets
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('support');
  const [staffActionLoading, setStaffActionLoading] = useState(false);

  // New Custom Role Form
  const [newRoleSlug, setNewRoleSlug] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set());
  const [creatingRole, setCreatingRole] = useState(false);

  const showNotification = (msg: string, isSuccess: boolean = true) => {
    if (isSuccess) {
      setSuccessMsg(msg);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 3500);
    } else {
      setErrorMsg(msg);
      setSuccessMsg('');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const fetchRBACData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch staff list
      const staffRes = await fetch('/api/admin/rbac/staff', { headers });
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaffList(staffData.data || []);
      }

      // Fetch matrix
      const matrixRes = await fetch('/api/admin/rbac/matrix', { headers });
      const matrixData = await matrixRes.json();
      if (matrixData.success) {
        const loadedRoles: PlatformRole[] = matrixData.data.roles || [];
        const loadedPerms: PlatformPermission[] = matrixData.data.permissions || [];
        setRoles(loadedRoles);
        setPermissions(loadedPerms);

        // Build matrix state map
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

  // Toggle permission in role matrix
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

    setHasUnsavedChanges(prev => ({ ...prev, [roleSlug]: true }));
  };

  // Save specific role matrix changes
  const handleSaveMatrix = async (roleSlug: string) => {
    setSavingMatrixRole(roleSlug);
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
      if (res.ok && data.success) {
        showNotification(`Matriks hak akses role ${roleSlug.toUpperCase()} berhasil disimpan!`, true);
        setHasUnsavedChanges(prev => ({ ...prev, [roleSlug]: false }));
      } else {
        showNotification(data.message || 'Gagal menyimpan perubahan matriks.', false);
      }
    } catch (err: any) {
      showNotification('Kesalahan jaringan saat menyimpan matriks.', false);
    } finally {
      setSavingMatrixRole(null);
    }
  };

  // Assign staff role
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffEmail.trim()) {
      showNotification('Email pengguna wajib diisi.', false);
      return;
    }

    setStaffActionLoading(true);
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
      if (res.ok && data.success) {
        showNotification(`Role ${selectedRoleSlug.toUpperCase()} berhasil ditugaskan ke ${selectedStaffEmail}!`, true);
        setShowAssignModal(false);
        setSelectedStaffEmail('');
        fetchRBACData();
      } else {
        showNotification(data.message || 'Gagal menugaskan role staf.', false);
      }
    } catch (err: any) {
      showNotification('Kesalahan koneksi saat menugaskan staf.', false);
    } finally {
      setStaffActionLoading(false);
    }
  };

  // Revoke staff role
  const handleRevokeRole = async (userId: number, email: string) => {
    if (email === 'admin@catavor.com') {
      showNotification('Superadmin utama platform tidak dapat dicabut.', false);
      return;
    }
    if (!confirm(`Cabut wewenang staf admin dari ${email}? User akan kembali menjadi akun merchant reguler.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/rbac/staff/${userId}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Wewenang staf dicabut dari ${email}.`, true);
        fetchRBACData();
      } else {
        showNotification(data.message || 'Gagal mencabut role staf.', false);
      }
    } catch (err: any) {
      showNotification('Kesalahan jaringan saat mencabut role staf.', false);
    }
  };

  // Create custom role
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleSlug.trim() || !newRoleName.trim()) {
      showNotification('Kode slug dan nama role wajib diisi.', false);
      return;
    }

    setCreatingRole(true);
    try {
      const res = await fetch('/api/admin/rbac/roles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: newRoleSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permission_keys: Array.from(newRolePerms),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`Role custom "${newRoleName}" berhasil dibuat!`, true);
        setNewRoleSlug('');
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRolePerms(new Set());
        setActiveTab('matrix');
        fetchRBACData();
      } else {
        showNotification(data.message || 'Gagal membuat custom role.', false);
      }
    } catch (err: any) {
      showNotification('Kesalahan jaringan saat membuat role.', false);
    } finally {
      setCreatingRole(false);
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.platform_role && s.platform_role.toLowerCase().includes(q))
    );
  });

  // Group permissions by category
  const permissionGroups = permissions.reduce<Record<string, PlatformPermission[]>>((acc, p) => {
    const groupName = p.group || 'Umum';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(p);
    return acc;
  }, {});

  const getGroupIcon = (groupName: string) => {
    switch (groupName.toLowerCase()) {
      case 'kepatuhan':
      case 'compliance':
        return <ShieldAlert size={14} color="#f59e0b" />;
      case 'support':
      case 'helpdesk':
        return <HelpCircle size={14} color="#0ea5e9" />;
      case 'finance':
      case 'keuangan':
        return <CreditCard size={14} color="#10b981" />;
      case 'konten':
      case 'content':
      case 'monetisasi':
      case 'monetization':
        return <Sparkles size={14} color="#f43f5e" />;
      case 'audit':
        return <Activity size={14} color="#38bdf8" />;
      default:
        return <Sliders size={14} color="#f43f5e" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Toast Alert */}
      {successMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: '#10b981',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
          animation: 'fadeInDown 0.25s ease'
        }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: '#ef4444',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
          animation: 'fadeInDown 0.25s ease'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-Navigation: Staff / Matrix / Create Role */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.35rem',
        backgroundColor: theme.tabInactiveBg,
        padding: '0.25rem',
        borderRadius: '0.85rem',
        border: `1px solid ${theme.border}`
      }}>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'staff' ? '#f43f5e' : 'transparent',
            color: activeTab === 'staff' ? '#ffffff' : theme.tabInactiveText,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            transition: 'all 0.2s'
          }}
        >
          <Users size={13} />
          <span>Daftar Staf</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'matrix' ? '#f43f5e' : 'transparent',
            color: activeTab === 'matrix' ? '#ffffff' : theme.tabInactiveText,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            transition: 'all 0.2s'
          }}
        >
          <Key size={13} />
          <span>Matriks Izin</span>
        </button>

        <button
          onClick={() => setActiveTab('create_role')}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '0.65rem',
            backgroundColor: activeTab === 'create_role' ? '#f43f5e' : 'transparent',
            color: activeTab === 'create_role' ? '#ffffff' : theme.tabInactiveText,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={13} />
          <span>Buat Role</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAFTAR STAF ADMIN (Mobile Stacked Cards)                           */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Action Header */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
              <input
                type="text"
                placeholder="Cari nama / email staf..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.78rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              onClick={() => {
                setSelectedStaffEmail('');
                setSelectedRoleSlug('support');
                setShowAssignModal(true);
              }}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 15px rgba(244, 63, 94, 0.35)'
              }}
            >
              <UserPlus size={14} />
              <span>Tugaskan</span>
            </button>
          </div>

          {/* Staff Cards Feed */}
          {filteredStaff.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, boxShadow: theme.cardShadow }}>
              <Users size={32} color="#64748b" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.78rem' }}>Tidak ada staf admin yang cocok dengan pencarian.</p>
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const badge = getRoleBadge(staff.platform_role);
              const isPrimaryAdmin = staff.email === 'admin@catavor.com';

              return (
                <div
                  key={staff.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '1rem',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.cardShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '0.75rem',
                        backgroundColor: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.9rem'
                      }}>
                        {staff.name ? staff.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: theme.textPrimary }}>
                          {staff.name || 'Admin Platform'}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                          <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{staff.email}</span>
                          <button
                            onClick={() => handleCopy(staff.email)}
                            style={{ background: 'none', border: 'none', color: copiedEmail === staff.email ? '#10b981' : theme.textMuted, cursor: 'pointer', padding: 0 }}
                          >
                            {copiedEmail === staff.email ? <CheckCheck size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                      ID #{staff.id} &bull; Staf Platform
                    </span>

                    {isPrimaryAdmin ? (
                      <span style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Lock size={11} />
                        Superadmin Utama
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => {
                            setSelectedStaffEmail(staff.email);
                            setSelectedRoleSlug(staff.platform_role || 'support');
                            setShowAssignModal(true);
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.5rem',
                            backgroundColor: theme.cardAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.textPrimary,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Ubah Role
                        </button>
                        <button
                          onClick={() => handleRevokeRole(staff.id, staff.email)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Cabut
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MATRIKS HAK AKSES DINAMIS (Mobile Accordion Per Role)              */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.85rem', backgroundColor: isDark ? 'rgba(244, 63, 94, 0.1)' : 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', fontSize: '0.75rem', color: theme.textPrimary, lineHeight: 1.45 }}>
            <strong style={{ color: isDark ? '#fb7185' : '#e11d48' }}>Matriks Dinamis Real-Time:</strong> Ketuk nama role untuk membuka daftar hak akses. Perubahan izin langsung berlaku seketika tanpa restart server.
          </div>

          {roles.map((role) => {
            const isExpanded = expandedRoleSlug === role.slug;
            const badge = getRoleBadge(role.slug);
            const isSuper = role.slug === 'superadmin';
            const rolePermSet = matrixState[role.slug] || new Set();
            const hasChanges = Boolean(hasUnsavedChanges[role.slug]);
            const isSaving = savingMatrixRole === role.slug;

            return (
              <div
                key={role.id || role.slug}
                style={{
                  borderRadius: '1rem',
                  backgroundColor: theme.surface,
                  border: isExpanded ? `1.5px solid ${badge.color}60` : `1px solid ${theme.border}`,
                  overflow: 'hidden',
                  boxShadow: theme.cardShadow,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedRoleSlug(isExpanded ? '' : role.slug)}
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc') : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '0.65rem',
                      backgroundColor: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: theme.textPrimary }}>
                          {role.name}
                        </h4>
                        <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>({role.slug})</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                        {isSuper ? 'Bypass Seluruh Hak Akses (16/16)' : `${rolePermSet.size} dari 16 Izin Aktif`}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {hasChanges && (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
                    )}
                    {isExpanded ? <ChevronUp size={18} color={theme.textMuted} /> : <ChevronDown size={18} color={theme.textMuted} />}
                  </div>
                </div>

                {/* Accordion Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: '0.5rem 1rem 1.15rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textSecondary, fontStyle: 'italic' }}>
                      {role.description || 'Tidak ada deskripsi peranan.'}
                    </p>

                    {/* Permission Groups */}
                    {Object.entries(permissionGroups).map(([groupName, groupPerms]) => (
                      <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: `1px solid ${theme.border}`, paddingBottom: '0.35rem' }}>
                          {getGroupIcon(groupName)}
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textPrimary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {groupName}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {groupPerms.map((perm) => {
                            const isChecked = isSuper || rolePermSet.has(perm.key);

                            return (
                              <div
                                key={perm.key}
                                onClick={() => !isSuper && handleToggleMatrixPerm(role.slug, perm.key)}
                                style={{
                                  padding: '0.65rem 0.75rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: isChecked ? (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9') : (isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc'),
                                  border: isChecked ? (isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1') : `1px solid ${theme.border}`,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: isSuper ? 'default' : 'pointer'
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isChecked ? theme.textPrimary : theme.textMuted }}>
                                    {perm.name}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: '0.1rem' }}>
                                    {perm.key}
                                  </div>
                                </div>

                                {/* iOS Style Toggle Switch */}
                                <div style={{
                                  width: '38px',
                                  height: '22px',
                                  borderRadius: '999px',
                                  backgroundColor: isChecked ? (isSuper ? '#fbbf24' : '#10b981') : (isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                                  padding: '2px',
                                  boxSizing: 'border-box',
                                  position: 'relative',
                                  transition: 'all 0.2s ease',
                                  flexShrink: 0
                                }}>
                                  <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: '#ffffff',
                                    position: 'absolute',
                                    top: '2px',
                                    left: isChecked ? '18px' : '2px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.25)'
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Save Button for Non-Superadmin */}
                    {!isSuper && (
                      <button
                        onClick={() => handleSaveMatrix(role.slug)}
                        disabled={!hasChanges || isSaving}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          borderRadius: '0.75rem',
                          backgroundColor: hasChanges ? '#10b981' : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
                          color: hasChanges ? '#ffffff' : theme.textMuted,
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          cursor: hasChanges ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          boxShadow: hasChanges ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none'
                        }}
                      >
                        <Save size={15} />
                        <span>{isSaving ? 'Menyimpan Matriks...' : `Simpan Matriks ${role.name}`}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BUAT CUSTOM ROLE BARU (Mobile Form)                                */}
      {/* ========================================================================= */}
      {activeTab === 'create_role' && (
        <form onSubmit={handleCreateCustomRole} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.85rem', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.75rem', color: theme.textPrimary, lineHeight: 1.45 }}>
            <strong style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>Custom Role Generator:</strong> Buat peranan administrator baru untuk divisi khusus (misal: *Marketing Specialist*, *Security Auditor*).
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
              Kode Role Slug (Unik, huruf kecil &amp; underscore)
            </label>
            <input
              type="text"
              placeholder="contoh: marketing_lead"
              value={newRoleSlug}
              onChange={e => setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
              Nama Jabatan / Peran
            </label>
            <input
              type="text"
              placeholder="contoh: Tim Marketing & Promo"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
              Deskripsi Tugas
            </label>
            <textarea
              rows={2}
              placeholder="Deskripsi singkat wewenang dan tanggung jawab role ini..."
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: theme.textPrimary, marginBottom: '0.45rem' }}>
              Pilih Hak Akses Role ({newRolePerms.size} dipilih)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto', padding: '0.5rem', backgroundColor: theme.cardAlt, borderRadius: '0.75rem', border: `1px solid ${theme.border}` }}>
              {permissions.map((p) => {
                const isSelected = newRolePerms.has(p.key);
                return (
                  <div
                    key={p.key}
                    onClick={() => {
                      setNewRolePerms(prev => {
                        const next = new Set(prev);
                        if (next.has(p.key)) next.delete(p.key);
                        else next.add(p.key);
                        return next;
                      });
                    }}
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.5rem',
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '0.35rem',
                      border: isSelected ? 'none' : `1px solid ${theme.borderStrong}`,
                      backgroundColor: isSelected ? '#f43f5e' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.65rem'
                    }}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isSelected ? theme.textPrimary : theme.textSecondary }}>{p.name}</div>
                      <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>{p.key}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingRole || !newRoleSlug.trim() || !newRoleName.trim()}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: '#f43f5e',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 15px rgba(244, 63, 94, 0.35)'
            }}
          >
            <Plus size={16} />
            <span>{creatingRole ? 'Membuat Role...' : 'Buat Role Kustom Sekarang'}</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 4. BOTTOM SHEET: TUGASKAN STAF ROLE                                      */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: theme.modalOverlay,
          backdropFilter: 'blur(6px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }} onClick={() => setShowAssignModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '85vh',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.cardShadow,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: theme.textPrimary }}>
                Tugaskan Peran Staf Admin
              </h3>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignRole} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                  Alamat Email Akun Staf
                </label>
                <input
                  type="email"
                  placeholder="staf@catavor.com"
                  value={selectedStaffEmail}
                  onChange={e => setSelectedStaffEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.3rem' }}>
                  Pilih Role Wewenang
                </label>
                <select
                  value={selectedRoleSlug}
                  onChange={e => setSelectedRoleSlug(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.65rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem'
                  }}
                >
                  {roles.map(r => (
                    <option key={r.slug} value={r.slug}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={staffActionLoading || !selectedStaffEmail.trim()}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.8rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f43f5e',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(244, 63, 94, 0.35)'
                }}
              >
                <Check size={16} />
                <span>{staffActionLoading ? 'Menugaskan...' : 'Konfirmasi Penugasan Role'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
