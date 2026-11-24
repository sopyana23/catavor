import React, { useState, useEffect, useRef } from 'react';
import { useModalBackHandler } from '../utils/navigation';
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
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  Mail,
  User,
  Layers
} from 'lucide-react';
import {
  type PlatformRole,
  type PlatformPermission,
  type AdminStaffUser,
  getRoleBadge,
  formatPermissionGroupLabel,
  isAssignablePermissionKey,
  normalizeRoleSlug,
  sanitizeRoleSlugInput,
  CUSTOM_ROLE_SLUG_REGEX,
  fetchRbacMatrix,
  fetchRbacStaff,
  updateRbacMatrix,
  assignRbacStaff,
  createRbacStaff,
  revokeRbacStaff,
  createRbacCustomRole,
  updateRbacCustomRole,
  deleteRbacCustomRole,
  RbacApiError,
} from '../utils/rbac';
import { MobileCustomSelect } from './MobileCustomSelect';

function useBottomSheetDrag(onDismiss: () => void, isBlocked = false) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const dragYRef = useRef(0);

  const handleStart = (clientY: number) => {
    if (isBlocked) return;
    touchStartY.current = clientY;
    dragYRef.current = 0;
    setIsDragging(true);
  };

  const handleMove = (clientY: number) => {
    if (!isDragging || isBlocked) return;
    const delta = clientY - touchStartY.current;
    // Elastic rubber-banding when pulling upward past resting detent
    const nextY = delta > 0 ? delta : delta * 0.18;
    dragYRef.current = nextY;
    setDragY(nextY);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const finalY = dragYRef.current;
    dragYRef.current = 0;
    setDragY(0);
    if (finalY >= 70 && !isBlocked) {
      onDismiss();
    }
  };

  const handleProps = {
    onTouchStart: (e: React.TouchEvent) => handleStart(e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => handleMove(e.touches[0].clientY),
    onTouchEnd: handleEnd,
    onMouseDown: (e: React.MouseEvent) => handleStart(e.clientY),
    onMouseMove: (e: React.MouseEvent) => handleMove(e.clientY),
    onMouseUp: handleEnd,
  };

  return { dragY, isDragging, handleProps };
}

interface AdminRBACManagementProps {
  token: string;
  currentUserId?: number;
  currentUserEmail?: string;
  themeMode?: 'dark' | 'light';
  onClose?: () => void;
  hideHeader?: boolean;
  canMutate?: boolean;
}

export const AdminRBACManagement: React.FC<AdminRBACManagementProps> = ({
  token,
  currentUserId,
  currentUserEmail,
  themeMode = 'dark',
  onClose: _onClose,
  hideHeader: _hideHeader = false,
  canMutate = true,
}) => {
  const isDark = themeMode === 'dark';

  const theme = {
    bg: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#0f172a' : '#ffffff',
    card: isDark ? 'rgba(30, 41, 59, 0.65)' : '#ffffff',
    cardAlt: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f1f5f9',
    border: isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0',
    borderStrong: isDark ? 'rgba(148, 163, 184, 0.22)' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    inputBg: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
    inputBorder: isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1',
    modalBg: isDark ? '#0f172a' : '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',
    cardShadow: isDark ? '0 8px 30px rgba(0,0,0,0.45)' : '0 4px 20px rgba(15, 23, 42, 0.06)',
    tabTrackBg: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f1f5f9',
    tabActiveBg: isDark ? 'rgba(255, 255, 255, 0.12)' : '#0f172a',
    tabActiveText: '#ffffff',
    tabInactiveText: isDark ? '#94a3b8' : '#64748b',
    tabActiveShadow: isDark ? '0 2px 6px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(15, 23, 42, 0.12)',
    primaryActionBg: '#2563eb',
    primaryActionShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
    saveActionBg: '#059669',
    saveActionShadow: '0 2px 10px rgba(5, 150, 105, 0.25)',
    accentBadgeBg: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
    accentBadgeBorder: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
    accentBadgeColor: isDark ? '#38bdf8' : '#0284c7',
    btnSecondaryBg: isDark ? 'rgba(30, 41, 59, 0.85)' : '#ffffff',
    btnSecondaryBorder: isDark ? 'rgba(148, 163, 184, 0.32)' : '#cbd5e1',
    btnSecondaryText: isDark ? '#f1f5f9' : '#1e293b',
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
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('support');

  // Matrix edit state: roleSlug -> Set of permission keys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({});
  const [savingMatrixRole, setSavingMatrixRole] = useState<string | null>(null);

  // Modals / Bottom Sheets
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [targetRoleSlug, setTargetRoleSlug] = useState('support');
  const [staffActionLoading, setStaffActionLoading] = useState(false);

  useModalBackHandler({
    isOpen: showAssignModal,
    onClose: () => setShowAssignModal(false)
  });

  // Create Staff Modal states
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

  // Edit Custom Role Modal
  const [editingRole, setEditingRole] = useState<{ slug: string; name: string; description: string; permissions: Set<string> } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  useModalBackHandler({
    isOpen: editingRole !== null,
    onClose: () => {
      if (!updatingRole) setEditingRole(null);
    }
  });

  // Custom Confirm Dialog (replaces window.confirm cleanly)
  const [confirmDialog, setConfirmDialog] = useState<
    | { type: 'revoke_staff'; userId: number; email: string }
    | { type: 'delete_role'; slug: string; name: string }
    | null
  >(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useModalBackHandler({
    isOpen: confirmDialog !== null,
    onClose: () => {
      if (!confirmLoading) setConfirmDialog(null);
    }
  });

  const createSheetDrag = useBottomSheetDrag(() => setShowCreateStaffModal(false), creatingStaff);
  const assignSheetDrag = useBottomSheetDrag(() => setShowAssignModal(false), staffActionLoading);
  const editRoleSheetDrag = useBottomSheetDrag(() => setEditingRole(null), updatingRole);
  const confirmSheetDrag = useBottomSheetDrag(() => setConfirmDialog(null), confirmLoading);

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
      const [loadedStaff, matrixData] = await Promise.all([
        fetchRbacStaff(token),
        fetchRbacMatrix(token),
      ]);
      setStaffList(loadedStaff);

      const loadedRoles = matrixData.roles;
      const loadedPerms = matrixData.permissions;
      setRoles(loadedRoles);
      setPermissions(loadedPerms);

      if (loadedRoles.length > 0 && !loadedRoles.some((r) => r.slug === selectedRoleSlug)) {
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
    } catch (err) {
      setErrorMsg(err instanceof RbacApiError ? err.message : 'Gagal memuat data RBAC platform.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRBACData();
  }, [token]);

  const superadminCount = staffList.filter(
    (s) => normalizeRoleSlug(s.platform_role) === 'superadmin'
  ).length;

  const handleToggleMatrixPerm = (roleSlug: string, permKey: string) => {
    if (!canMutate) return;
    if (roleSlug === 'superadmin' || !isAssignablePermissionKey(permKey)) return;

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
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat menyimpan perubahan matriks hak akses.', false);
      return;
    }
    setSavingMatrixRole(roleSlug);
    try {
      const permKeys = Array.from(matrixState[roleSlug] || []).filter(isAssignablePermissionKey);
      const message = await updateRbacMatrix(token, roleSlug, permKeys);
      showNotification(message || `Izin role '${roleSlug}' berhasil disimpan realtime.`, true);
      setHasUnsavedChanges((prev) => ({ ...prev, [roleSlug]: false }));
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Kesalahan saat menyimpan matriks.', false);
    } finally {
      setSavingMatrixRole(null);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat mengubah peran staf.', false);
      return;
    }
    if (!selectedStaffEmail.trim() || !targetRoleSlug) return;
    setStaffActionLoading(true);
    try {
      const message = await assignRbacStaff(token, selectedStaffEmail.trim(), targetRoleSlug);
      showNotification(message || `Role staf '${selectedStaffEmail}' berhasil diubah.`, true);
      setShowAssignModal(false);
      setSelectedStaffEmail('');
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Gagal mengubah role staf.', false);
    } finally {
      setStaffActionLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat menambahkan petugas baru.', false);
      return;
    }
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      showNotification('Nama, email, dan password wajib diisi.', false);
      return;
    }
    if (newStaffPassword.length < 10) {
      showNotification('Password minimal 10 karakter.', false);
      return;
    }
    if (new TextEncoder().encode(newStaffPassword).length > 72) {
      showNotification('Password maksimal 72 karakter/byte.', false);
      return;
    }

    setCreatingStaff(true);
    try {
      const message = await createRbacStaff(token, {
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        role_slug: newStaffRoleSlug || 'support',
      });
      showNotification(message || `Akun petugas '${newStaffName.trim()}' berhasil dibuat.`, true);
      setShowCreateStaffModal(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRoleSlug('support');
      setShowStaffPassword(false);
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Gagal membuat akun staf.', false);
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleRevokeRole = (userId: number, email: string) => {
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat mencabut hak akses staf.', false);
      return;
    }
    setConfirmDialog({ type: 'revoke_staff', userId, email });
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat membuat custom role.', false);
      return;
    }
    const cleanSlug = sanitizeRoleSlugInput(newRoleSlug);
    if (!CUSTOM_ROLE_SLUG_REGEX.test(cleanSlug)) {
      showNotification('Slug role wajib 3-32 karakter huruf kecil, angka, atau garis bawah.', false);
      return;
    }
    if (!newRoleName.trim()) {
      showNotification('Nama tampilan role wajib diisi.', false);
      return;
    }
    setCreatingRole(true);
    try {
      const permKeys = Array.from(newRolePerms).filter(isAssignablePermissionKey);
      const message = await createRbacCustomRole(token, {
        slug: cleanSlug,
        name: newRoleName.trim(),
        description: newRoleDesc.trim(),
        permission_keys: permKeys,
      });
      showNotification(message || `Role kustom '${newRoleName}' berhasil dibuat.`, true);
      setNewRoleSlug('');
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePerms(new Set());
      setSelectedRoleSlug(cleanSlug);
      setActiveTab('matrix');
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Gagal membuat custom role.', false);
    } finally {
      setCreatingRole(false);
    }
  };

  const openEditRoleModal = (role: PlatformRole) => {
    if (!canMutate) {
      showNotification('Hanya Superadmin yang dapat mengubah definisi custom role.', false);
      return;
    }
    if (role.is_system) {
      showNotification('Role bawaan sistem hanya dapat diubah izinnya melalui Matriks Izin.', false);
      return;
    }
    const currentSet = new Set<string>(
      Array.from(matrixState[role.slug] || []).filter(isAssignablePermissionKey)
    );
    setEditingRole({
      slug: role.slug,
      name: role.name,
      description: role.description || '',
      permissions: currentSet,
    });
  };

  const handleUpdateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !canMutate) return;
    if (!editingRole.name.trim()) {
      showNotification('Nama role tidak boleh kosong.', false);
      return;
    }
    setUpdatingRole(true);
    try {
      const permKeys = Array.from(editingRole.permissions).filter(isAssignablePermissionKey);
      const message = await updateRbacCustomRole(token, editingRole.slug, {
        name: editingRole.name.trim(),
        description: editingRole.description.trim(),
        permission_keys: permKeys,
      });
      showNotification(message || `Custom role '${editingRole.name.trim()}' berhasil diperbarui.`, true);
      setEditingRole(null);
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Gagal memperbarui custom role.', false);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmDialog || !canMutate) return;
    setConfirmLoading(true);
    try {
      if (confirmDialog.type === 'revoke_staff') {
        const message = await revokeRbacStaff(token, confirmDialog.userId);
        showNotification(message || `Hak akses admin '${confirmDialog.email}' berhasil dicabut.`, true);
      } else {
        const message = await deleteRbacCustomRole(token, confirmDialog.slug);
        showNotification(message || `Custom role '${confirmDialog.name}' berhasil dihapus.`, true);
        if (selectedRoleSlug === confirmDialog.slug) {
          setSelectedRoleSlug('support');
        }
      }
      await fetchRBACData();
    } catch (err) {
      showNotification(err instanceof RbacApiError ? err.message : 'Operasi RBAC gagal dijalankan.', false);
    } finally {
      setConfirmDialog(null);
      setConfirmLoading(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', paddingBottom: '6rem', boxSizing: 'border-box' }}>
      {/* 1. Alerts */}
      {successMsg && (
        <div style={{
          padding: '0.8rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: '#10b981',
          color: '#ffffff',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.25)'
        }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{
          padding: '0.8rem 1rem',
          borderRadius: '0.75rem',
          backgroundColor: '#ef4444',
          color: '#ffffff',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.25)'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}
      {!canMutate && (
        <div style={{
          padding: '0.75rem 0.9rem',
          borderRadius: '0.75rem',
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
          border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'}`,
          color: isDark ? '#fbbf24' : '#b45309',
          fontSize: '0.76rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Lock size={15} style={{ flexShrink: 0 }} />
          <span>Mode Hanya-Baca: Hanya Superadmin yang dapat mengubah konfigurasi RBAC.</span>
        </div>
      )}

      {/* 2. Mobile 4 KPI Metric Cards (2x2 Grid - Sleek & Refined) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.5rem'
      }}>
        {/* Metric 1 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '0.75rem',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          boxShadow: theme.cardShadow
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.55rem',
            backgroundColor: theme.accentBadgeBg,
            border: `1px solid ${theme.accentBadgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.accentBadgeColor,
            flexShrink: 0
          }}>
            <Users size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Petugas Staf
            </div>
            <div style={{ fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.05rem' }}>
              {staffList.length}
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '0.75rem',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          boxShadow: theme.cardShadow
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            flexShrink: 0
          }}>
            <Shield size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Peran RBAC
            </div>
            <div style={{ fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.05rem' }}>
              {roles.length}
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '0.75rem',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          boxShadow: theme.cardShadow
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <Key size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Izin Granular
            </div>
            <div style={{ fontSize: '1.02rem', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.2, marginTop: '0.05rem' }}>
              {permissions.length}
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '0.75rem',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          boxShadow: theme.cardShadow
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.55rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            flexShrink: 0
          }}>
            <CheckCircle size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Penegakan
            </div>
            <div style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#10b981',
              lineHeight: 1.2,
              marginTop: '0.08rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
              }} />
              <span>Aktif Realtime</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs (Refined & Compact) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.25rem',
        backgroundColor: theme.tabTrackBg,
        padding: '0.25rem',
        borderRadius: '0.75rem',
        border: `1px solid ${theme.border}`
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          style={{
            minHeight: '36px',
            borderRadius: '0.55rem',
            backgroundColor: activeTab === 'staff' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'staff' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'staff' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            boxShadow: activeTab === 'staff' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={13} />
          <span>Staf ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            minHeight: '36px',
            borderRadius: '0.55rem',
            backgroundColor: activeTab === 'matrix' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'matrix' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'matrix' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            boxShadow: activeTab === 'matrix' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Key size={13} />
          <span>Matriks Izin</span>
          {anyUnsaved && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create_role')}
          style={{
            minHeight: '36px',
            borderRadius: '0.55rem',
            backgroundColor: activeTab === 'create_role' ? theme.tabActiveBg : 'transparent',
            color: activeTab === 'create_role' ? theme.tabActiveText : theme.tabInactiveText,
            border: activeTab === 'create_role' && isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            boxShadow: activeTab === 'create_role' ? theme.tabActiveShadow : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={13} />
          <span>Buat Role</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: DAFTAR STAF (Mobile Stacked Touch Cards)                        */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Action Header */}
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
              <input
                type="text"
                placeholder="Cari nama / email staf..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  paddingLeft: '2.2rem',
                  paddingRight: '0.75rem',
                  borderRadius: '0.65rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.8rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="button"
              disabled={!canMutate}
              onClick={() => {
                if (!canMutate) return;
                setNewStaffName('');
                setNewStaffEmail('');
                setNewStaffPassword('');
                setNewStaffRoleSlug('support');
                setShowStaffPassword(false);
                setShowCreateStaffModal(true);
              }}
              style={{
                minHeight: '44px',
                padding: '0 0.9rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.primaryActionBg,
                color: '#ffffff',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: canMutate ? 'pointer' : 'not-allowed',
                opacity: canMutate ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                boxShadow: theme.primaryActionShadow
              }}
            >
              <UserPlus size={14} />
              <span>+ Petugas</span>
            </button>
          </div>

          {/* Cards Feed */}
          {filteredStaff.length === 0 ? (
            <div style={{
              padding: '3rem 1.25rem',
              textAlign: 'center',
              backgroundColor: theme.surface,
              borderRadius: '1rem',
              border: `1px solid ${theme.border}`,
              boxShadow: theme.cardShadow
            }}>
              <Users size={32} color={theme.textMuted} style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, color: theme.textPrimary, fontSize: '0.85rem', fontWeight: 800 }}>
                Tidak Ada Staf Ditemukan
              </p>
              <p style={{ margin: '0.2rem 0 0 0', color: theme.textSecondary, fontSize: '0.75rem' }}>
                Sesuaikan kata kunci pencarian Anda.
              </p>
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const badge = getRoleBadge(staff.platform_role);
              const isSelf = (typeof currentUserId === 'number' && currentUserId > 0 && staff.id === currentUserId) || (Boolean(currentUserEmail) && staff.email.toLowerCase() === currentUserEmail!.toLowerCase());
              const isLastSuperadmin = normalizeRoleSlug(staff.platform_role) === 'superadmin' && superadminCount <= 1;
              const isLockedSuperadmin = isSelf || isLastSuperadmin;

              return (
                <div
                  key={staff.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.85rem',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.cardShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}
                >
                  {/* Top Row: Avatar + Name/Email + Single Role Pill */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '0.65rem',
                        backgroundColor: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        flexShrink: 0
                      }}>
                        {staff.name ? staff.name.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {staff.name || 'Petugas Platform'}
                          </h4>
                          {isSelf && (
                            <span style={{
                              padding: '0.05rem 0.35rem',
                              borderRadius: '4px',
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                              color: isDark ? '#60a5fa' : '#2563eb',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              Anda
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                          <span style={{ fontSize: '0.7rem', color: theme.textSecondary, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {staff.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(staff.email)}
                            style={{ background: 'none', border: 'none', color: copiedEmail === staff.email ? '#10b981' : theme.textMuted, cursor: 'pointer', padding: 0 }}
                          >
                            {copiedEmail === staff.email ? <CheckCheck size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <span style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      {staff.role_name}
                    </span>
                  </div>

                  {/* Bottom Row: Metadata & Actions */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.55rem',
                    borderTop: `1px solid ${theme.border}`
                  }}>
                    <span style={{ fontSize: '0.66rem', color: theme.textMuted }}>
                      ID #{staff.id} &bull; Petugas
                    </span>

                    {isLockedSuperadmin ? (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Lock size={11} />
                        <span>{isSelf ? 'Akun Anda (Terkunci)' : 'Superadmin Terakhir'}</span>
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.45rem' }}>
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => {
                            if (!canMutate) return;
                            setSelectedStaffEmail(staff.email);
                            setTargetRoleSlug(staff.platform_role || 'support');
                            setShowAssignModal(true);
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0 0.85rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.35)' : '#bfdbfe'}`,
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
                            color: isDark ? '#93c5fd' : '#1d4ed8',
                            cursor: canMutate ? 'pointer' : 'not-allowed',
                            opacity: canMutate ? 1 : 0.45,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Edit2 size={13} />
                          <span>Ubah Role</span>
                        </button>

                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => {
                            if (!canMutate) return;
                            handleRevokeRole(staff.id, staff.email);
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0 0.85rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fff1f2',
                            color: isDark ? '#f87171' : '#dc2626',
                            cursor: canMutate ? 'pointer' : 'not-allowed',
                            opacity: canMutate ? 1 : 0.45,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
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
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: MATRIKS HAK AKSES (Mobile Role Switcher & Native Cards)         */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (() => {
        const activeRoleObj = roles.find((r) => r.slug === selectedRoleSlug);
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Native Mobile Role Selector (MobileCustomSelect replaces horizontal pill strip) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '0.85rem',
            padding: '0.9rem',
            boxShadow: theme.cardShadow
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pilih Role Pengelola:
            </span>
            <MobileCustomSelect
              value={selectedRoleSlug}
              onChange={(val) => setSelectedRoleSlug(val)}
              options={roles.map((r) => ({
                value: r.slug,
                label: `${r.name}${hasUnsavedChanges[r.slug] ? ' (Belum Disimpan)' : ''}`
              }))}
              placeholder="Pilih Role Pengelola..."
              style={{ width: '100%' }}
              triggerStyle={{ minHeight: '44px', borderRadius: '0.75rem' }}
            />
            {activeRoleObj && !activeRoleObj.is_system && canMutate && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.15rem' }}>
                <button
                  type="button"
                  onClick={() => openEditRoleModal(activeRoleObj)}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0 0.75rem',
                    borderRadius: '0.65rem',
                    border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.35)' : '#bfdbfe'}`,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Edit2 size={13} />
                  <span>Edit Info Role</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDialog({ type: 'delete_role', slug: activeRoleObj.slug, name: activeRoleObj.name })}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '0 0.75rem',
                    borderRadius: '0.65rem',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fff1f2',
                    color: isDark ? '#f87171' : '#dc2626',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Hapus Role</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
            <input
              type="text"
              placeholder="Filter hak akses..."
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '2.3rem',
                paddingRight: '0.75rem',
                borderRadius: '0.65rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.textPrimary,
                fontSize: '0.8rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Categorized Permissions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                    borderRadius: '0.85rem',
                    padding: '0.85rem',
                    boxShadow: theme.cardShadow
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    paddingBottom: '0.55rem',
                    borderBottom: `1px solid ${theme.border}`,
                    marginBottom: '0.65rem'
                  }}>
                    <Layers size={14} color={theme.accentBadgeColor} />
                    <span style={{ fontSize: '0.74rem', fontWeight: 900, color: theme.accentBadgeColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      DOMAIN: {formatPermissionGroupLabel(groupKey)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {grpPerms.map((perm) => {
                      const isChecked = isSuper || activePermSet.has(perm.key);
                      const isAssignLocked = !isSuper && !isAssignablePermissionKey(perm.key);
                      const permDisabled = isSuper || isAssignLocked || !canMutate;

                      return (
                        <div
                          key={perm.key}
                          onClick={() => {
                            if (!permDisabled) handleToggleMatrixPerm(selectedRoleSlug, perm.key);
                          }}
                          style={{
                            minHeight: '44px',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '0.55rem',
                            backgroundColor: isChecked ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : theme.cardAlt,
                            border: `1px solid ${isChecked ? 'rgba(37, 99, 235, 0.35)' : theme.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.65rem',
                            cursor: permDisabled ? 'not-allowed' : 'pointer',
                            opacity: isAssignLocked ? 0.65 : 1
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.textPrimary }}>
                              {perm.name}
                            </div>
                            <div style={{ fontSize: '0.66rem', color: theme.textMuted, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <code>{perm.key}</code>
                              {isAssignLocked && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#f59e0b' }}>
                                  Hanya Superadmin
                                </span>
                              )}
                            </div>
                          </div>

                          {isSuper || isAssignLocked ? (
                            <span style={{ fontSize: '0.68rem', color: isAssignLocked ? '#f59e0b' : '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                              <Lock size={13} />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canMutate}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleToggleMatrixPerm(selectedRoleSlug, perm.key)}
                              style={{ width: '20px', height: '20px', flexShrink: 0, accentColor: theme.primaryActionBg, cursor: canMutate ? 'pointer' : 'not-allowed' }}
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

          {/* Sticky Floating Save Bar on Mobile */}
          {selectedRoleSlug !== 'superadmin' && (
            <div style={{
              position: 'sticky',
              bottom: '1rem',
              zIndex: 20,
              padding: '0.35rem 0'
            }}>
              <button
                type="button"
                onClick={() => handleSaveMatrix(selectedRoleSlug)}
                disabled={Boolean(savingMatrixRole) || !canMutate}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '0.75rem',
                  backgroundColor: theme.saveActionBg,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: !canMutate ? 'not-allowed' : savingMatrixRole ? 'wait' : 'pointer',
                  opacity: !canMutate ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: theme.saveActionShadow
                }}
              >
                <Save size={16} className={savingMatrixRole === selectedRoleSlug ? 'animate-spin' : ''} />
                <span>Simpan Perubahan Izin ({selectedRoleSlug})</span>
              </button>
            </div>
          )}
        </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 6. TAB 3: BUAT ROLE KUSTOM (Mobile Clean Form)                            */}
      {/* ========================================================================= */}
      {activeTab === 'create_role' && (
        <form onSubmit={handleCreateCustomRole} style={{ width: '100%' }}>
          <div style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: theme.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: theme.textPrimary }}>
                Definisikan Peran Kustom
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: theme.textSecondary }}>
                Buat tingkat wewenang baru untuk tim operasional Anda.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                Slug Role (ID Unik) <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="misal: junior_support"
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(sanitizeRoleSlugInput(e.target.value))}
                disabled={!canMutate}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${newRoleSlug && !CUSTOM_ROLE_SLUG_REGEX.test(newRoleSlug) ? '#ef4444' : theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.82rem',
                  boxSizing: 'border-box'
                }}
                required
              />
              <span style={{ display: 'block', fontSize: '0.66rem', color: theme.textMuted, marginTop: '0.25rem' }}>
                Gunakan huruf kecil, angka, dan garis bawah (3–32 karakter).
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                Nama Tampilan Role <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="misal: Junior Support & Helpdesk"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                disabled={!canMutate}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.82rem',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                Deskripsi Tanggung Jawab
              </label>
              <textarea
                placeholder="Jelaskan wewenang dan tugas role ini..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                disabled={!canMutate}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary,
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary }}>
                  Izin Awal ({newRolePerms.size}/{permissions.filter((p) => isAssignablePermissionKey(p.key)).length}):
                </label>
                <button
                  type="button"
                  disabled={!canMutate}
                  onClick={() => {
                    if (!canMutate) return;
                    const assignable = permissions.filter((p) => isAssignablePermissionKey(p.key));
                    if (newRolePerms.size === assignable.length) {
                      setNewRolePerms(new Set());
                    } else {
                      setNewRolePerms(new Set(assignable.map((p) => p.key)));
                    }
                  }}
                  className="btn-secondary"
                  style={{
                    minHeight: '44px',
                    padding: '0 0.85rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    borderRadius: '0.6rem',
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    cursor: canMutate ? 'pointer' : 'not-allowed',
                    opacity: canMutate ? 1 : 0.5
                  }}
                >
                  {newRolePerms.size === permissions.filter((p) => isAssignablePermissionKey(p.key)).length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div style={{
                maxHeight: '290px',
                overflowY: 'auto',
                border: `1px solid ${theme.border}`,
                borderRadius: '0.65rem',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {Object.keys(permissionGroups).map((grpKey) => {
                  const grpPerms = permissionGroups[grpKey];
                  const assignableGrp = grpPerms.filter((p) => isAssignablePermissionKey(p.key));
                  const allGrpSelected = assignableGrp.length > 0 && assignableGrp.every((p) => newRolePerms.has(p.key));
                  return (
                    <div key={grpKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 900, color: theme.accentBadgeColor, textTransform: 'uppercase' }}>
                          {formatPermissionGroupLabel(grpKey)}
                        </span>
                        {assignableGrp.length > 0 && (
                          <button
                            type="button"
                            disabled={!canMutate}
                            onClick={() => {
                              setNewRolePerms((prev) => {
                                const next = new Set(prev);
                                if (allGrpSelected) assignableGrp.forEach((p) => next.delete(p.key));
                                else assignableGrp.forEach((p) => next.add(p.key));
                                return next;
                              });
                            }}
                            style={{ background: 'none', border: 'none', color: theme.textSecondary, fontSize: '0.68rem', fontWeight: 700, cursor: canMutate ? 'pointer' : 'not-allowed', textDecoration: 'underline', minHeight: '28px' }}
                          >
                            {allGrpSelected ? 'Kosongkan' : 'Pilih Domain'}
                          </button>
                        )}
                      </div>
                      {grpPerms.map((p) => {
                        const permLocked = !isAssignablePermissionKey(p.key);
                        const isSelected = !permLocked && newRolePerms.has(p.key);
                        return (
                          <label
                            key={p.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              minHeight: '44px',
                              padding: '0.55rem 0.7rem',
                              borderRadius: '0.55rem',
                              backgroundColor: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : 'transparent',
                              border: `1px solid ${isSelected ? 'rgba(37, 99, 235, 0.35)' : theme.border}`,
                              cursor: permLocked || !canMutate ? 'not-allowed' : 'pointer',
                              opacity: permLocked ? 0.6 : 1
                            }}
                          >
                            {permLocked ? (
                              <Lock size={13} color="#f59e0b" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canMutate}
                                onChange={() => {
                                  if (!canMutate) return;
                                  setNewRolePerms((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(p.key)) n.delete(p.key);
                                    else n.add(p.key);
                                    return n;
                                  });
                                }}
                                style={{ width: '18px', height: '18px', accentColor: theme.primaryActionBg }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.76rem', color: theme.textPrimary, fontWeight: 700 }}>
                                {p.name}
                              </div>
                              {permLocked && (
                                <div style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 700 }}>
                                  Hanya Superadmin
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingRole || !canMutate}
              style={{
                minHeight: '44px',
                backgroundColor: theme.primaryActionBg,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                borderRadius: '0.65rem',
                border: 'none',
                cursor: !canMutate ? 'not-allowed' : creatingRole ? 'wait' : 'pointer',
                opacity: !canMutate ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: theme.primaryActionShadow,
                marginTop: '0.35rem'
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
      {/* 7. MODAL 1: UBAH ROLE STAF (Mobile Slide-Up Bottom Sheet)                  */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '90vh',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.cardShadow,
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              transform: `translateY(${assignSheetDrag.dragY}px)`,
              transition: assignSheetDrag.isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Sheet Drag Handle Bar (touchAction: none) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.5rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              {...assignSheetDrag.handleProps}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'
                }}
              />
            </div>

            {/* Clean Header without X button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              {...assignSheetDrag.handleProps}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.75rem',
                backgroundColor: theme.accentBadgeBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.accentBadgeColor,
                flexShrink: 0
              }}>
                <Edit2 size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: theme.textPrimary }}>
                  Penugasan Peran Staf
                </h3>
                <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                  Tetapkan wewenang operasional pengguna internal
                </span>
              </div>
            </div>

            <form onSubmit={handleAssignRole} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Email Staf <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
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
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Pilih Role Platform <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <MobileCustomSelect
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

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    borderRadius: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={staffActionLoading || !canMutate}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '0.65rem',
                    backgroundColor: theme.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: !canMutate ? 'not-allowed' : staffActionLoading ? 'wait' : 'pointer',
                    opacity: !canMutate ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: theme.primaryActionShadow
                  }}
                >
                  <Check size={15} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL 2: TAMBAH PETUGAS BARU (Mobile Slide-Up Bottom Sheet)             */}
      {/* ========================================================================= */}
      {showCreateStaffModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setShowCreateStaffModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '90vh',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.cardShadow,
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              transform: `translateY(${createSheetDrag.dragY}px)`,
              transition: createSheetDrag.isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Sheet Drag Handle Bar (touchAction: none) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.25rem 0 0.5rem 0',
                cursor: 'grab',
                touchAction: 'none'
              }}
              {...createSheetDrag.handleProps}
            >
              <div
                style={{
                  width: '44px',
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'
                }}
              />
            </div>

            {/* Clean Header without X button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                cursor: 'grab',
                touchAction: 'none'
              }}
              {...createSheetDrag.handleProps}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.75rem',
                backgroundColor: theme.accentBadgeBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.accentBadgeColor,
                flexShrink: 0
              }}>
                <UserPlus size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: theme.textPrimary }}>
                  Tambah Akun Petugas Baru
                </h3>
                <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                  Daftarkan akun staf operasional internal
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Kata Sandi Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    placeholder="Minimal 10 karakter..."
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    minLength={10}
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
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Peran &amp; Hak Akses Awal <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <MobileCustomSelect
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

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    borderRadius: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingStaff || !canMutate}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '0.65rem',
                    backgroundColor: theme.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: !canMutate ? 'not-allowed' : creatingStaff ? 'wait' : 'pointer',
                    opacity: !canMutate ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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

      {/* ========================================================================= */}
      {/* 9. SHEET 3: EDIT CUSTOM ROLE (Mobile Slide-Up Bottom Sheet)               */}
      {/* ========================================================================= */}
      {editingRole && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => { if (!updatingRole) setEditingRole(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '90vh',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.cardShadow,
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              transform: `translateY(${editRoleSheetDrag.dragY}px)`,
              transition: editRoleSheetDrag.isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0 0.5rem 0', cursor: 'grab', touchAction: 'none' }}
              {...editRoleSheetDrag.handleProps}
            >
              <div style={{ width: '44px', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1' }} />
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'grab', touchAction: 'none' }}
              {...editRoleSheetDrag.handleProps}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '0.75rem', backgroundColor: theme.accentBadgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accentBadgeColor }}>
                <Edit2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: theme.textPrimary }}>
                  Edit Custom Role ({editingRole.slug})
                </h3>
                <p style={{ fontSize: '0.72rem', color: theme.textSecondary, margin: '0.1rem 0 0 0' }}>
                  Perbarui nama role, deskripsi, dan hak akses
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateCustomRole} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.3rem' }}>
                  Nama Role <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole((prev) => prev ? { ...prev, name: e.target.value } : null)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 0.85rem',
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

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.3rem' }}>
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={editingRole.description}
                  onChange={(e) => setEditingRole((prev) => prev ? { ...prev, description: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary, marginBottom: '0.35rem' }}>
                  Hak Akses ({editingRole.permissions.size} terpilih):
                </label>
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '0.75rem',
                  padding: '0.65rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  {Object.keys(permissionGroups).map((grpKey) => (
                    <div key={grpKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 900, color: theme.accentBadgeColor, textTransform: 'uppercase' }}>
                        {formatPermissionGroupLabel(grpKey)}
                      </div>
                      {permissionGroups[grpKey].map((perm) => {
                        const permLocked = !isAssignablePermissionKey(perm.key);
                        const isChecked = !permLocked && editingRole.permissions.has(perm.key);
                        return (
                          <label
                            key={perm.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              minHeight: '44px',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.55rem',
                              backgroundColor: isChecked ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : 'transparent',
                              border: `1px solid ${isChecked ? 'rgba(37, 99, 235, 0.35)' : theme.border}`,
                              cursor: permLocked ? 'not-allowed' : 'pointer',
                              opacity: permLocked ? 0.6 : 1
                            }}
                          >
                            {permLocked ? (
                              <Lock size={13} color="#f59e0b" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setEditingRole((prev) => {
                                    if (!prev) return null;
                                    const next = new Set(prev.permissions);
                                    if (next.has(perm.key)) next.delete(perm.key);
                                    else next.add(perm.key);
                                    return { ...prev, permissions: next };
                                  });
                                }}
                                style={{ width: '18px', height: '18px', accentColor: theme.primaryActionBg }}
                              />
                            )}
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: theme.textPrimary }}>
                              {perm.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  disabled={updatingRole}
                  onClick={() => setEditingRole(null)}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    borderRadius: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: theme.btnSecondaryBg,
                    border: `1px solid ${theme.btnSecondaryBorder}`,
                    color: theme.btnSecondaryText,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingRole || !canMutate}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '0.65rem',
                    backgroundColor: theme.primaryActionBg,
                    color: '#ffffff',
                    border: 'none',
                    cursor: updatingRole ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: theme.primaryActionShadow
                  }}
                >
                  <Save size={15} />
                  <span>{updatingRole ? 'Menyimpan...' : 'Simpan Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. SHEET 4: KONFIRMASI AKSI DESTRUKTIF (Mobile Confirm Bottom Sheet)    */}
      {/* ========================================================================= */}
      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => { if (!confirmLoading) setConfirmDialog(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: theme.modalBg,
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.cardShadow,
              padding: '0.75rem 1.25rem 2rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.95rem',
              overscrollBehavior: 'contain',
              transform: `translateY(${confirmSheetDrag.dragY}px)`,
              transition: confirmSheetDrag.isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0 0.35rem 0', cursor: 'grab', touchAction: 'none' }}
              {...confirmSheetDrag.handleProps}
            >
              <div style={{ width: '44px', height: '5px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1' }} />
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'grab', touchAction: 'none' }}
              {...confirmSheetDrag.handleProps}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={19} />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: theme.textPrimary }}>
                {confirmDialog.type === 'revoke_staff' ? 'Cabut Hak Akses Staf?' : 'Hapus Custom Role?'}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.55, color: theme.textSecondary }}>
              {confirmDialog.type === 'revoke_staff'
                ? `Yakin ingin mencabut seluruh hak akses pengelola dari akun '${confirmDialog.email}'? Seluruh sesi aktif akan dicabut dan akun dikembalikan menjadi merchant standar.`
                : `Yakin ingin menghapus custom role '${confirmDialog.name}' (${confirmDialog.slug})? Penghapusan hanya diizinkan apabila tidak ada staf aktif yang memegang peran tersebut.`}
            </p>

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => setConfirmDialog(null)}
                className="btn-secondary"
                style={{
                  flex: 1,
                  minHeight: '44px',
                  fontSize: '0.8rem',
                  borderRadius: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: theme.btnSecondaryBg,
                  border: `1px solid ${theme.btnSecondaryBorder}`,
                  color: theme.btnSecondaryText,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={handleExecuteConfirm}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '0.65rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: confirmLoading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Trash2 size={15} />
                <span>{confirmLoading ? 'Memproses...' : (confirmDialog.type === 'revoke_staff' ? 'Ya, Cabut' : 'Ya, Hapus')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
