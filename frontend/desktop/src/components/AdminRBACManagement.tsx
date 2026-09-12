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
  onClose?: () => void;
}

export const AdminRBACManagement: React.FC<AdminRBACManagementProps> = ({
  token,
  currentUserEmail,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'matrix' | 'create_role'>('staff');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Matrix edit state: roleSlug -> Set of permission keys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('support');

  // New Custom Role Form
  const [newRoleSlug, setNewRoleSlug] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set());

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
    setSavingMatrix(true);
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
      setSavingMatrix(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffEmail.trim() || !selectedRoleSlug) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/rbac/staff', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_or_id: selectedStaffEmail.trim(),
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

  const handleRevokeRole = async (userId: number, email: string) => {
    if (!window.confirm(`Yakin ingin mencabut hak akses admin dari '${email}'? Pengguna akan kembali menjadi merchant standar.`)) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/rbac/staff/revoke', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
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
    setLoading(true);
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
        setSuccessMsg(`Custom role '${newRoleName}' berhasil dibuat.`);
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
      setLoading(false);
    }
  };

  // Group permissions by category
  const groupedPermissions: Record<string, PlatformPermission[]> = {};
  permissions.forEach((p) => {
    const grp = p.group || 'other';
    if (!groupedPermissions[grp]) groupedPermissions[grp] = [];
    groupedPermissions[grp].push(p);
  });

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', margin: '1rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
            <Shield size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Tata Kelola Staf & RBAC Platform
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Manajemen peran berjenjang, pemisahan tugas (*Separation of Duties*), dan matriks izin dinamis.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={fetchRBACData}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Segarkan</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.65rem' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'staff' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Users size={16} />
          <span>Staf Pengelola Platform ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'matrix' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Key size={16} />
          <span>Matriks Hak Akses Dinamis</span>
          {hasUnsavedChanges && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create_role')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'create_role' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'create_role' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Plus size={16} />
          <span>Buat Role Kustom</span>
        </button>
      </div>

      {/* TAB 1: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '350px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari staf berdasarkan nama, email, atau role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.82rem' }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedStaffEmail('');
                setSelectedRoleSlug('support');
                setShowAssignModal(true);
              }}
              className="btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <UserPlus size={15} />
              <span>Angkat / Ubah Role Staf</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>NAMA STAF</th>
                  <th style={{ padding: '0.75rem' }}>EMAIL</th>
                  <th style={{ padding: '0.75rem' }}>ROLE PLATFORM</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const badge = getRoleBadge(staff.platform_role);
                  const isPrimaryAdmin = staff.email === 'admin@catavor.com';

                  return (
                    <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {staff.name}
                        {staff.email === currentUserEmail && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: 'var(--primary)' }}>
                            (Anda)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{staff.email}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {staff.role_name}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaffEmail(staff.email);
                              setSelectedRoleSlug(staff.platform_role);
                              setShowAssignModal(true);
                            }}
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            title="Ubah Role"
                          >
                            <Edit2 size={13} />
                            <span>Ubah Role</span>
                          </button>
                          {!isPrimaryAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRevokeRole(staff.id, staff.email)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.75rem',
                                borderRadius: '0.375rem',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              title="Cabut Hak Akses Admin"
                            >
                              <Trash2 size={13} />
                              <span>Cabut</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DYNAMIC PERMISSION MATRIX */}
      {activeTab === 'matrix' && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Centang izin untuk setiap role operasional. Perubahan dapat disimpan per role dan langsung aktif seketika tanpa perlu restart server.
            </p>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', minWidth: '260px' }}>KATALOG HAK AKSES</th>
                  {roles.map((r) => {
                    const badge = getRoleBadge(r.slug);
                    return (
                      <th key={r.slug} style={{ padding: '0.85rem 0.75rem', textAlign: 'center', minWidth: '140px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {r.name}
                          </span>
                          {r.slug !== 'superadmin' && (
                            <button
                              type="button"
                              onClick={() => handleSaveMatrix(r.slug)}
                              disabled={savingMatrix}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.68rem',
                                borderRadius: '0.3rem',
                                border: '1px solid var(--primary)',
                                backgroundColor: 'transparent',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <Save size={11} />
                              <span>Simpan</span>
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedPermissions).map((groupKey) => (
                  <React.Fragment key={groupKey}>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-light)' }}>
                      <td
                        colSpan={roles.length + 1}
                        style={{ padding: '0.5rem 1rem', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}
                      >
                        DOMAIN: {groupKey.toUpperCase()}
                      </td>
                    </tr>
                    {groupedPermissions[groupKey].map((perm) => (
                      <tr key={perm.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{perm.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <code>{perm.key}</code> &bull; {perm.description}
                          </div>
                        </td>
                        {roles.map((r) => {
                          const isSuper = r.slug === 'superadmin';
                          const isChecked = isSuper || (matrixState[r.slug]?.has(perm.key) ?? false);

                          return (
                            <td key={r.slug} style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                              {isSuper ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }} title="Superadmin memiliki akses penuh">
                                  <Lock size={15} />
                                </div>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMatrixPerm(r.slug, perm.key)}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer',
                                    accentColor: 'var(--primary)',
                                  }}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CREATE CUSTOM ROLE */}
      {activeTab === 'create_role' && (
        <form onSubmit={handleCreateCustomRole} style={{ maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Definisikan Peran Kustom Baru
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Slug Role (ID Unik Huruf Kecil)
              </label>
              <input
                type="text"
                placeholder="misal: junior_support / legal_officer"
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Nama Tampilan Role
              </label>
              <input
                type="text"
                placeholder="misal: Junior Support & Helpdesk"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Deskripsi Tanggung Jawab
              </label>
              <textarea
                placeholder="Jelaskan cakupan tugas role ini..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="input-field"
                style={{ width: '100%', minHeight: '70px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Pilih Izin Awal untuk Role Ini:
              </label>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-light)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                {permissions.map((p) => {
                  const isSelected = newRolePerms.has(p.key);
                  return (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
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
                      />
                      <span><strong>{p.name}</strong> (<code>{p.key}</code>)</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>Buat Role Kustom Sekarang</span>
          </button>
        </form>
      )}

      {/* ASSIGN / CHANGE ROLE MODAL */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '1.5rem', borderRadius: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Penugasan Role Staf Platform</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignRole}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Email atau User ID Staf
                </label>
                <input
                  type="text"
                  placeholder="Masukkan email pengguna..."
                  value={selectedStaffEmail}
                  onChange={(e) => setSelectedStaffEmail(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  required
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Pengguna harus sudah terdaftar di Catavor.
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Pilih Role Platform
                </label>
                <select
                  value={selectedRoleSlug}
                  onChange={(e) => setSelectedRoleSlug(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.2rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Check size={15} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
