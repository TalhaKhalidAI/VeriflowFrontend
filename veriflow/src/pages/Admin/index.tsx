// src/pages/Admin/index.tsx
import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Card,
  CardContent,

  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Grid,
  Paper,
  Alert,
} from '@mui/material';
import {
  ShieldOutlined as ShieldAlert,
  VpnKeyRounded as KeyRound,
  CheckCircleOutlineRounded as UserCheck,
  BlockRounded as UserX,
  LockRounded as Lock,
  RotateLeftRounded as RotateCcw,
  DeleteRounded as Trash2,
  EditRounded as Edit,
  AccessTimeRounded as Clock,
  ContentCopyRounded as Copy,
  CheckRounded as Check,
  RefreshRounded as RefreshCw,
  GroupRounded as Users,
  AdminPanelSettingsRounded as Settings,
  OpenInNewRounded as OpenIcon,
} from "@mui/icons-material";
import {
  useAdminUsersQuery,
  useAllPermissionsQuery,
  useUpdateUserMutation,
  useDisableAccountMutation,
  useEnableAccountMutation,
  useDeleteAccountMutation,
  useRestoreAccountMutation,
  useUpdatePasswordMutation,
  useTempTokenMutation,
  useResetAutoKillMutation,
  useSetPermissionsMutation,
  useRemovePermissionsMutation,
  useBulkSetPermissionsMutation,
  useSetManagedUsersMutation,
} from './query';
import type { AdminUser } from './types';
import { useAuthStore } from '../../store/authStore';
import { useMFAStatusQuery } from '../Security/query';
import { ToastMsgs } from '../../api/toastUtils';
import { http } from '../../api/http/https';
import { OtpBoxesInput } from '../../components/OtpModal';
import { Table, type TableColumn } from '../../components/Table';
import { WindowPanel } from '../../components/WindowPanel';
import { PERMISSION_METADATA } from '../../config/permissionsMetadata';
import { CloseRounded as CloseIcon } from '@mui/icons-material';

export const AdminPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { data: mfaStatus } = useMFAStatusQuery();
  const isMFAEnabled = Boolean(user?.mfa_enabled || mfaStatus?.mfa_enabled);
  const activeMFAMethod = (user?.mfa_method || mfaStatus?.mfa_method || 'totp').toLowerCase();
  const myPerms = user?.permissions || {};
  const isSelfAdminQuick =
    user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  const canManagePerms =
    isSelfAdminQuick || Boolean(myPerms['admin.users.promote']) || Boolean(myPerms['user.promote']);

  const [showDisabled, setShowDisabled] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showPermissions, setShowPermissions] = useState(true);

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useAdminUsersQuery({
    show_disabled: showDisabled,
    show_deleted: showDeleted,
    show_permissions: showPermissions,
  });
  const { data: allPermissions = [] } = useAllPermissionsQuery();

  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Dialog States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editManagedById, setEditManagedById] = useState<string>('');

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordOtp, setPasswordOtp] = useState('');

  const [tempTokenDialogOpen, setTempTokenDialogOpen] = useState(false);
  const [tempTokenRestorePasswd, setTempTokenRestorePasswd] = useState(false);
  const [tempTokenOtp, setTempTokenOtp] = useState('');
  const [issuedTempToken, setIssuedTempToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [autoKillDialogOpen, setAutoKillDialogOpen] = useState(false);
  const [autoKillOtp, setAutoKillOtp] = useState('');

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'disable' | 'enable' | 'delete' | 'restore';
    user: AdminUser | null;
  }>({ open: false, type: 'disable', user: null });
  const [actionPassword, setActionPassword] = useState('');
  const [actionOtp, setActionOtp] = useState('');
  const [sendingActionOtp, setSendingActionOtp] = useState(false);

  const [permMatrixUser, setPermMatrixUser] = useState<AdminUser | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});
  const [managedUserIdsDraft, setManagedUserIdsDraft] = useState<number[]>([]);

  // Bulk Perm State
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState<number[]>([]);
  const [bulkPerms, setBulkPerms] = useState<Record<string, boolean>>({});

  // Mutations
  const updateMutation = useUpdateUserMutation();
  const disableMutation = useDisableAccountMutation();
  const enableMutation = useEnableAccountMutation();
  const deleteMutation = useDeleteAccountMutation();
  const restoreMutation = useRestoreAccountMutation();
  const passwordMutation = useUpdatePasswordMutation();
  const tempTokenMutation = useTempTokenMutation();
  const resetKillMutation = useResetAutoKillMutation();
  const setPermsMutation = useSetPermissionsMutation();
  const removePermsMutation = useRemovePermissionsMutation();
  const bulkPermsMutation = useBulkSetPermissionsMutation();
  const setManagedUsersMutation = useSetManagedUsersMutation();

  // Handlers
  const handleOpenEdit = (target: AdminUser) => {
    setSelectedUser(target);
    setEditName(target.name);
    setEditEmail(target.email);
    setEditRole(target.role || 'user');
    setEditManagedById(target.managed_by_id != null ? String(target.managed_by_id) : '');
    setEditDialogOpen(true);
  };

  const isSelfAdmin = user?.role === 'admin' || (user as any)?.user_role === 'admin';

  const canManageOtherUser = (target: AdminUser) => {
    const isTargetMainAdmin = String(target.role || target.user_role || '').toLowerCase() === 'admin';
    if (isSelfAdmin) {
      return !isTargetMainAdmin;
    }
    if (isTargetMainAdmin) return false;
    return target.managed_by_id != null && Number(target.managed_by_id) === Number(user?.id);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    const payload: any = { name: editName, email: editEmail };
    if (isSelfAdmin && String(selectedUser.role || '').toLowerCase() !== 'admin') {
      payload.user_role = editRole === 'admin' ? 'user' : editRole;
      payload.managed_by_id = editManagedById ? Number(editManagedById) : null;
    }
    await updateMutation.mutateAsync({
      userId: selectedUser.id,
      payload,
    });
    setEditDialogOpen(false);
  };

  const handleOpenPassword = (user: AdminUser) => {
    setSelectedUser(user);
    setOldPassword('');
    setNewPassword('');
    setPasswordOtp('');
    setPasswordDialogOpen(true);
  };

  const handleSavePassword = async () => {
    if (!selectedUser || !newPassword) return;
    await passwordMutation.mutateAsync({
      userId: selectedUser.id,
      payload: {
        new_password: newPassword,
        old_password: oldPassword || undefined,
        otp: passwordOtp || undefined,
      },
    });
    setPasswordDialogOpen(false);
  };

  const handleOpenTempToken = (user: AdminUser) => {
    setSelectedUser(user);
    setTempTokenRestorePasswd(false);
    setTempTokenOtp('');
    setIssuedTempToken(null);
    setTempTokenDialogOpen(true);
  };

  const handleGenerateTempToken = async () => {
    if (!selectedUser) return;
    const res = await tempTokenMutation.mutateAsync({
      userId: selectedUser.id,
      restorePasswd: tempTokenRestorePasswd,
      otp: tempTokenOtp || undefined,
    });
    setIssuedTempToken(res.temp_token || res.token || 'TOKEN_ISSUED_IN_COOKIE');
  };

  const handleOpenActionDialog = (type: 'disable' | 'enable' | 'delete' | 'restore', targetUser: AdminUser) => {
    setActionPassword('');
    setActionOtp('');
    setActionDialog({ open: true, type, user: targetUser });
  };

  const handleSendActionOtp = async () => {
    const purposeMap: Record<'disable' | 'enable' | 'delete' | 'restore', string> = {
      disable: 'disable_account',
      enable: 'enable_account',
      restore: 'restore_account',
      delete: 'mfa_stepup',
    };
    const purpose = purposeMap[actionDialog.type];
    setSendingActionOtp(true);
    try {
      await http.post(`/mfa/send_genaric_otp?purpose=${encodeURIComponent(purpose)}`);
      ToastMsgs.success('Verification code sent to your email.');
    } catch (err: any) {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to send verification code');
    } finally {
      setSendingActionOtp(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionDialog.user) return;
    const targetId = actionDialog.user.id;
    const payload = {
      password: actionPassword || undefined,
      otp: actionOtp || undefined,
    };
    if (actionDialog.type === 'disable') {
      await disableMutation.mutateAsync({ userId: targetId, payload });
    } else if (actionDialog.type === 'enable') {
      await enableMutation.mutateAsync({ userId: targetId, payload });
    } else if (actionDialog.type === 'delete') {
      await deleteMutation.mutateAsync({ userId: targetId, payload });
    } else if (actionDialog.type === 'restore') {
      await restoreMutation.mutateAsync({ userId: targetId, otp: actionOtp || undefined });
    }
    setActionDialog((prev) => ({ ...prev, open: false }));
  };

  const filterValidPerms = (permsObj?: Record<string, boolean> | null) => {
    const validSet = new Set([...allPermissions, ...Object.keys(PERMISSION_METADATA)]);
    const cleaned: Record<string, boolean> = {};
    if (!permsObj) return cleaned;
    for (const [k, v] of Object.entries(permsObj)) {
      if ((validSet.size === 0 || validSet.has(k)) && PERMISSION_METADATA[k]) {
        cleaned[k] = Boolean(v);
      }
    }
    return cleaned;
  };

  const handleOpenPermMatrix = (targetUser: AdminUser) => {
    setPermMatrixUser(targetUser);
    setUserPerms(filterValidPerms(targetUser.permissions));
    setManagedUserIdsDraft(
      users
        .filter((u) => Number(u.managed_by_id) === Number(targetUser.id))
        .map((u) => u.id)
    );
    setActiveTab(1);
  };

  const handleTogglePerm = (perm: string) => {
    setUserPerms((prev) => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  const handleSaveUserPerms = async () => {
    if (!permMatrixUser) return;
    const cleanedPerms = filterValidPerms(userPerms);
    await setPermsMutation.mutateAsync({
      user_id: permMatrixUser.id,
      permissions: cleanedPerms,
    });
    if (user && String(user.id) === String(permMatrixUser.id)) {
      useAuthStore.getState().setUser({
        ...user,
        permissions: cleanedPerms,
      });
    }
  };

  const handleClearUserPerms = async () => {
    if (!permMatrixUser) return;
    if (isSelfAdmin) {
      await removePermsMutation.mutateAsync({
        user_id: permMatrixUser.id,
        remove_all: true,
      });
      setUserPerms({});
      return;
    }
    const allowedKeysToRevoke = allPermissionRows
      .map((r) => r.perm)
      .filter((p) => Boolean(userPerms[p]));
    if (allowedKeysToRevoke.length === 0) return;
    await removePermsMutation.mutateAsync({
      user_id: permMatrixUser.id,
      permission_keys: allowedKeysToRevoke,
    });
    setUserPerms((prev) => {
      const next = { ...prev };
      allowedKeysToRevoke.forEach((k) => {
        next[k] = false;
      });
      return next;
    });
  };

  const effectiveAllPermissions = React.useMemo(
    () => Array.from(new Set([...allPermissions, ...Object.keys(PERMISSION_METADATA)])),
    [allPermissions]
  );

  const [permCategoryFilter, setPermCategoryFilter] = useState<string>('ALL');
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<string>('ALL');
  const [fullscreenPanel, setFullscreenPanel] = useState<'single-users' | 'single-perms' | 'bulk-users' | 'bulk-perms' | null>(null);
  const [minimizedPanels, setMinimizedPanels] = useState<Record<string, boolean>>({});
  const [swapSingleLayout, setSwapSingleLayout] = useState(false);
  const [swapBulkLayout, setSwapBulkLayout] = useState(false);

  const toggleMinimizePanel = (key: string) => {
    setMinimizedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  interface PermissionRow {
    id: string;
    perm: string;
    category: string;
    label: string;
    description: string;
    badge?: string;
  }

  const rbacMetaPerms = new Set(['admin.users.promote', 'user.promote', 'admin.rbac.delegate', 'admin.rbac.android']);
  const canDelegateRbacAuthority = isSelfAdmin || Boolean(myPerms['admin.rbac.delegate']);
  const canDelegateAndroidPerms = isSelfAdmin || Boolean(myPerms['admin.rbac.android']);

  const allPermissionRows = React.useMemo<PermissionRow[]>(() => {
    return effectiveAllPermissions
      .filter((p) => Boolean(PERMISSION_METADATA[p]))
      .filter((p) => {
        if (isSelfAdmin) return true;
        if (rbacMetaPerms.has(p) && !canDelegateRbacAuthority) return false;
        if (p.startsWith('android.') && !canDelegateAndroidPerms) return false;
        if (!p.startsWith('admin.')) return true;
        return Boolean(myPerms[p]);
      })
      .map((p) => {
        const meta = PERMISSION_METADATA[p];
        const category = p.split('.')[0]?.toUpperCase() || 'GENERAL';
        return {
          id: p,
          perm: p,
          category,
          label: meta?.label || p,
          description: meta?.description || '',
          badge: meta?.badge,
        };
      });
  }, [effectiveAllPermissions, isSelfAdmin, myPerms]);

  const manageableRbacUsers = React.useMemo(() => {
    return users.filter((u) => {
      const isTargetMainAdmin = String(u.role || u.user_role || '').toLowerCase() === 'admin';
      if (isTargetMainAdmin) return false;
      if (isSelfAdmin) return true;
      return Number(u.id) !== Number(user?.id) && Number(u.managed_by_id) === Number(user?.id);
    });
  }, [users, isSelfAdmin, user?.id]);

  const permCategories = React.useMemo(() => {
    const cats = Array.from(new Set(allPermissionRows.map((r) => r.category)));
    return ['ALL', ...cats];
  }, [allPermissionRows]);

  const filteredSinglePermRows = React.useMemo(
    () =>
      permCategoryFilter === 'ALL'
        ? allPermissionRows
        : allPermissionRows.filter((r) => r.category === permCategoryFilter),
    [allPermissionRows, permCategoryFilter]
  );

  const filteredBulkPermRows = React.useMemo(
    () =>
      bulkCategoryFilter === 'ALL'
        ? allPermissionRows
        : allPermissionRows.filter((r) => r.category === bulkCategoryFilter),
    [allPermissionRows, bulkCategoryFilter]
  );

  const buildPermissionColumns = React.useCallback(
    (activeMap: Record<string, boolean>): TableColumn<PermissionRow>[] => [
      {
        key: 'label',
        label: 'Permission',
        render: (_, row) => (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="body2"
                sx={{
                  color: row.perm === 'tags.create' ? '#FDE047' : '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
              >
                {row.label}
              </Typography>
              {row.badge && (
                <Chip
                  label={row.badge}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    bgcolor: 'rgba(250, 204, 21, 0.16)',
                    color: '#FACC15',
                  }}
                />
              )}
            </Box>
          </Box>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        hideOnMobile: true,
        width: 130,
        render: (_, row) => (
          <Chip
            label={row.category}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 700,
              bgcolor: 'rgba(56, 189, 248, 0.12)',
              color: '#38BDF8',
            }}
          />
        ),
      },
      {
        key: 'perm',
        label: 'Key',
        hideOnMobile: true,
        render: (_, row) => (
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#94A3B8' }}>
            {row.perm}
          </Typography>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        hideOnMobile: true,
        render: (_, row) => (
          <Typography variant="caption" sx={{ color: '#94A3B8', lineHeight: 1.35 }}>
            {row.description || '—'}
          </Typography>
        ),
      },
      {
        key: 'granted',
        label: 'Status',
        sortable: false,
        searchable: false,
        width: 96,
        align: 'right',
        render: (_, row) =>
          activeMap[row.perm] ? (
            <Chip label="Granted" size="small" color="success" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
          ) : (
            <Chip label="Denied" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.68rem', color: '#64748B', borderColor: '#334155' }} />
          ),
      },
    ],
    []
  );

  const singlePermColumns = React.useMemo(
    () => buildPermissionColumns(userPerms),
    [buildPermissionColumns, userPerms]
  );

  const bulkPermColumns = React.useMemo(
    () => buildPermissionColumns(bulkPerms),
    [buildPermissionColumns, bulkPerms]
  );

  const pickerUserColumns = React.useMemo<TableColumn<AdminUser>[]>(
    () => [
      {
        key: 'name',
        label: 'User',
        render: (_, u) => {
          const isActive = permMatrixUser?.id === u.id;
          return (
            <Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: isActive ? '#38BDF8' : '#F8FAFC', fontSize: '0.82rem' }}
              >
                {u.name || 'Unnamed'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                {u.email}
              </Typography>
            </Box>
          );
        },
      },
      {
        key: 'role',
        label: 'Role',
        hideOnMobile: true,
        width: 90,
        render: (_, u) => (
          <Chip
            label={String(u.role || 'user').toUpperCase()}
            size="small"
            color={u.role === 'admin' ? 'secondary' : 'default'}
            sx={{ height: 20, fontWeight: 700, fontSize: '0.65rem' }}
          />
        ),
      },
      {
        key: 'permissions',
        label: 'Grants',
        hideOnMobile: true,
        sortable: false,
        searchable: false,
        width: 80,
        align: 'right',
        render: (_, u) => (
          <Typography variant="caption" sx={{ color: '#38BDF8', fontFamily: 'monospace' }}>
            {u.role === 'admin' ? 'ALL' : Object.keys(u.permissions || {}).length}
          </Typography>
        ),
      },
    ],
    [permMatrixUser]
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const userColumns: TableColumn<AdminUser>[] = React.useMemo(() => {
    const cols: TableColumn<AdminUser>[] = [
    {
      key: 'id',
      label: 'ID',
      width: 70,
      hideOnMobile: true,
      render: (_, u) => (
        <Typography variant="body2" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
          #{u.id}
        </Typography>
      ),
    },
    {
      key: 'name',
      label: 'User / Email',
      render: (_, u) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#F8FAFC' }}>
            {u.name || 'Unnamed'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            {u.email}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      hideOnMobile: true,
      render: (_, u) => (
        <Chip
          label={String(u.role || "").toUpperCase()}
          size="small"
          color={u.role === 'admin' ? 'secondary' : 'default'}
          sx={{ fontWeight: 700, fontSize: 11 }}
        />
      ),
    },
    {
      key: 'disabled',
      label: 'Status',
      render: (_, u) => (
        u.is_deleted ? (
          <Chip label="Deleted" size="small" color="error" />
        ) : u.disabled ? (
          <Chip label="Disabled" size="small" color="warning" />
        ) : (
          <Chip label="Active" size="small" color="success" />
        )
      ),
    },
    {
      key: 'mfa_enabled',
      label: 'MFA',
      hideOnMobile: true,
      render: (_, u) => (
        u.mfa_enabled ? (
          <Chip label={u.mfa_method?.toUpperCase() || 'MFA'} size="small" color="info" />
        ) : (
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            None
          </Typography>
        )
      ),
    },
    ];

    if (showPermissions) {
      cols.push({
        key: 'permissions',
        label: 'Permissions',
        hideOnMobile: true,
        render: (_, u) => {
          const permCount = Object.keys(u.permissions || {}).length;
          const canOpenRbac =
            canManagePerms &&
            String(u.role || u.user_role || '').toLowerCase() !== 'admin' &&
            (isSelfAdmin || (Number(u.id) !== Number(user?.id) && canManageOtherUser(u)));
          return canOpenRbac ? (
            <Button
              size="small"
              variant="text"
              onClick={() => handleOpenPermMatrix(u)}
              sx={{ textTransform: 'none', color: '#38BDF8', fontSize: 12, p: 0 }}
            >
              {`${permCount} grants`}
            </Button>
          ) : (
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              {u.role === 'admin' ? 'Admin Full Access' : `${permCount} grants`}
            </Typography>
          );
        },
      });
    }

    return cols;
  }, [showPermissions]);

  const renderUserActions = (u: AdminUser) => {
    const isTargetSelf = Number(user?.id) === Number(u.id);
    const isTargetMainAdmin = String(u.role || u.user_role || '').toLowerCase() === 'admin';
    const canActOnOther = !isTargetSelf && canManageOtherUser(u);
    const myPerms = user?.permissions || {};

    const canEdit =
      (isSelfAdmin && isTargetSelf) ||
      (canActOnOther && (isSelfAdmin || Boolean(myPerms['admin.users.promote']))) ||
      (isTargetSelf && (Boolean(myPerms['user.update.self']) || Boolean(myPerms['user.update.profile']) || Boolean(myPerms['user.update.email'])));

    const canChangePass =
      (isSelfAdmin && isTargetSelf) ||
      (canActOnOther && (isSelfAdmin || Boolean(myPerms['admin.anyuser.password.update']))) ||
      (isTargetSelf && Boolean(myPerms['user.update.password']));

    const canIssueSLT =
      canActOnOther &&
      (isSelfAdmin ||
        Boolean(myPerms['admin.users.promote']) ||
        Boolean(myPerms['admin.users.restore']) ||
        Boolean(myPerms['admin.users.disable']));

    const canEnable =
      (canActOnOther &&
        (isSelfAdmin ||
          Boolean(myPerms['admin.user.enable']) ||
          Boolean(myPerms['admin.users.promote']))) ||
      (isTargetSelf && !isTargetMainAdmin && Boolean(myPerms['user.self.enable']));

    const canDisable =
      !isTargetMainAdmin &&
      ((canActOnOther &&
        (isSelfAdmin ||
          Boolean(myPerms['admin.users.disable']) ||
          Boolean(myPerms['admin.users.promote']))) ||
        (isTargetSelf && Boolean(myPerms['user.disable.self'])));

    const canRestore =
      canActOnOther &&
      (isSelfAdmin ||
        Boolean(myPerms['admin.users.restore']) ||
        Boolean(myPerms['admin.users.promote']));

    const canDelete =
      !isTargetMainAdmin &&
      ((canActOnOther &&
        (isSelfAdmin ||
          Boolean(myPerms['admin.users.delete']) ||
          Boolean(myPerms['admin.users.promote']))) ||
        (isTargetSelf && Boolean(myPerms['user.delete.self'])));

    return (
      <Box sx={{ display: 'inline-flex', gap: 0.5, justifyContent: 'flex-end' }}>
        {canEdit && (
          <Tooltip title="Edit Profile">
            <IconButton size="small" onClick={() => handleOpenEdit(u)} sx={{ color: '#94A3B8', '&:hover': { color: '#38BDF8' } }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canChangePass && (
          <Tooltip title="Update Password">
            <IconButton size="small" onClick={() => handleOpenPassword(u)} sx={{ color: '#94A3B8', '&:hover': { color: '#FACC15' } }}>
              <Lock fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canIssueSLT && (
          <Tooltip title="Issue Temp Token (2 min SLT)">
            <IconButton size="small" onClick={() => handleOpenTempToken(u)} sx={{ color: '#F59E0B' }}>
              <Clock fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {u.disabled ? (
          canEnable && (
            <Tooltip title="Enable Account">
              <IconButton
                size="small"
                onClick={() => handleOpenActionDialog('enable', u)}
                sx={{ color: '#10B981' }}
              >
                <UserCheck fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        ) : (
          canDisable && (
            <Tooltip title="Disable Account">
              <IconButton
                size="small"
                onClick={() => handleOpenActionDialog('disable', u)}
                sx={{ color: '#EF4444' }}
              >
                <UserX fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        )}
        {u.is_deleted ? (
          canRestore && (
            <Tooltip title="Restore Account">
              <IconButton
                size="small"
                onClick={() => handleOpenActionDialog('restore', u)}
                sx={{ color: '#10B981' }}
              >
                <RotateCcw fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        ) : (
          canDelete && (
            <Tooltip title="Delete Account">
              <IconButton
                size="small"
                onClick={() => handleOpenActionDialog('delete', u)}
                sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}
              >
                <Trash2 fontSize="small" />
              </IconButton>
            </Tooltip>
          )
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, p: { xs: 0.5, sm: 2 }, maxWidth: 1400, mx: 'auto', overflowX: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
            }}
          >
            <Settings sx={{ color: '#38BDF8' }} /> Admin Governance Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Manage identity accounts, cryptographic roles, granular permissions, and kill-switch recovery.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw fontSize="small" />}
            onClick={() => refetchUsers()}
            sx={{ borderColor: '#334155', color: '#94A3B8', '&:hover': { borderColor: '#64748B' } }}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<ShieldAlert fontSize="small" />}
            onClick={() => setAutoKillDialogOpen(true)}
            sx={{ fontWeight: 700 }}
          >
            Reset Auto-Kill
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#1E293B', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="inherit"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="User Management & Security" icon={<Users fontSize="small" />} iconPosition="start" />
          <Tab
            label={permMatrixUser ? `Permissions (${permMatrixUser.email})` : 'Permission Matrix'}
            icon={<KeyRound fontSize="small" />}
            iconPosition="start"
          />
          <Tab label="Bulk Permission Matrix" icon={<Lock fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* TAB 0: USERS LIST */}
      {activeTab === 0 && (
        <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2 }}>
          {/* Checkboxes Filter Bar */}
          <Box
            sx={{
              p: 2,
              px: 2.5,
              borderBottom: '1px solid #1E293B',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              bgcolor: 'rgba(11, 19, 43, 0.6)',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#94A3B8', fontWeight: 600 }}>
              Display & Security Filters:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showDisabled}
                    onChange={(e) => setShowDisabled(e.target.checked)}
                    size="small"
                    sx={{ color: '#64748B', '&.Mui-checked': { color: '#F59E0B' } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>
                    Show Disabled
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    size="small"
                    sx={{ color: '#64748B', '&.Mui-checked': { color: '#EF4444' } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>
                    Show Deleted
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPermissions}
                    onChange={(e) => setShowPermissions(e.target.checked)}
                    size="small"
                    sx={{ color: '#64748B', '&.Mui-checked': { color: '#38BDF8' } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>
                    Show Permissions
                  </Typography>
                }
              />
            </Box>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <Table<AdminUser>
              columns={userColumns}
              data={users}
              rowKey="id"
              isLoading={usersLoading}
              emptyMessage="No users found."
              actionRenderer={renderUserActions}
              showSearch={true}
              searchPlaceholder="Search users by name, email, or role..."
              showPagination={true}
              itemsPerPage={10}
            />
          </CardContent>
        </Card>
      )}

      {/* TAB 1: PERMISSION MATRIX FOR SINGLE USER */}
      {activeTab === 1 && (
        <Grid container spacing={2.5} direction={swapSingleLayout ? 'row-reverse' : 'row'}>
          {/* Left / Top (on mobile): Separate Users Table */}
          <Grid
            item
            xs={12}
            md={minimizedPanels['single-perms'] ? 12 : minimizedPanels['single-users'] ? 12 : 4}
          >
            <WindowPanel
              title="Select Operator / User"
              subtitle="Click any user row to load and edit their permissions."
              isFullscreen={fullscreenPanel === 'single-users'}
              onToggleFullscreen={() =>
                setFullscreenPanel((prev) => (prev === 'single-users' ? null : 'single-users'))
              }
              isMinimized={Boolean(minimizedPanels['single-users'])}
              onToggleMinimize={() => toggleMinimizePanel('single-users')}
              onSwapPosition={() => setSwapSingleLayout((prev) => !prev)}
              swapTooltip="Move panel Left / Right"
            >
              <Table<AdminUser>
                columns={pickerUserColumns}
                data={manageableRbacUsers}
                rowKey="id"
                size="xs"
                isLoading={usersLoading}
                emptyMessage={isSelfAdmin ? "No non-admin user accounts found." : "No users assigned to you for RBAC delegation."}
                showSearch={true}
                searchPlaceholder="Search users..."
                showPagination={true}
                itemsPerPage={8}
                onRowClick={(u) => handleOpenPermMatrix(u)}
              />
            </WindowPanel>
          </Grid>

          {/* Right / Bottom (on mobile): Permissions Table */}
          <Grid
            item
            xs={12}
            md={minimizedPanels['single-users'] ? 12 : minimizedPanels['single-perms'] ? 12 : 8}
          >
            <WindowPanel
              title={
                permMatrixUser
                  ? `Assign Permissions: ${permMatrixUser.name} (${permMatrixUser.email})`
                  : 'Select a user to inspect and grant permissions'
              }
              subtitle="Fine-grained RBAC controls enforced at the API gateway and backend authorization dependencies."
              isFullscreen={fullscreenPanel === 'single-perms'}
              onToggleFullscreen={() =>
                setFullscreenPanel((prev) => (prev === 'single-perms' ? null : 'single-perms'))
              }
              isMinimized={Boolean(minimizedPanels['single-perms'])}
              onToggleMinimize={() => toggleMinimizePanel('single-perms')}
              onSwapPosition={() => setSwapSingleLayout((prev) => !prev)}
              swapTooltip="Move panel Left / Right"
              headerActions={
                permMatrixUser ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Button variant="outlined" color="error" size="small" onClick={handleClearUserPerms}>
                      Revoke All
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={handleSaveUserPerms}
                      disabled={setPermsMutation.isPending}
                    >
                      Save Permissions
                    </Button>
                  </Box>
                ) : null
              }
            >
              {!permMatrixUser ? (
                <Alert severity="info" sx={{ bgcolor: '#07111D', color: '#94A3B8', border: '1px solid #1E293B' }}>
                  Select a user from the operator table to manage their permissions.
                </Alert>
              ) : (
                <>
                  {isSelfAdmin && String(permMatrixUser.role || permMatrixUser.user_role || '').toLowerCase() !== 'admin' && (
                    <Box
                      sx={{
                        mb: 2.5,
                        p: 2,
                        bgcolor: '#07111D',
                        border: '1px solid #1E293B',
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          gap: 1,
                          mb: 1.5,
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700 }}>
                            Managed Users Scope ({managedUserIdsDraft.length} assigned)
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                            Choose which operators <strong>{permMatrixUser.name}</strong> is allowed to manage (when granted RBAC/admin permissions).
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          disabled={setManagedUsersMutation.isPending}
                          onClick={() =>
                            setManagedUsersMutation.mutate({
                              managerId: permMatrixUser.id,
                              userIds: managedUserIdsDraft,
                            })
                          }
                        >
                          Save Managed Users
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {users
                          .filter(
                            (u) =>
                              u.id !== permMatrixUser.id &&
                              String(u.role || u.user_role || '').toLowerCase() !== 'admin'
                          )
                          .map((op) => {
                            const isAssigned = managedUserIdsDraft.includes(op.id);
                            return (
                              <Chip
                                key={op.id}
                                label={`${op.name || op.email} (#${op.id})`}
                                size="small"
                                onClick={() =>
                                  setManagedUserIdsDraft((prev) =>
                                    isAssigned ? prev.filter((id) => id !== op.id) : [...prev, op.id]
                                  )
                                }
                                color={isAssigned ? 'info' : 'default'}
                                variant={isAssigned ? 'filled' : 'outlined'}
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.74rem',
                                  borderColor: isAssigned ? '#38BDF8' : '#334155',
                                  color: isAssigned ? '#0F172A' : '#CBD5E1',
                                }}
                              />
                            );
                          })}
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, flexShrink: 0 }}>
                    {permCategories.map((cat) => (
                      <Chip
                        key={cat}
                        label={cat}
                        size="small"
                        onClick={() => setPermCategoryFilter(cat)}
                        color={permCategoryFilter === cat ? 'primary' : 'default'}
                        variant={permCategoryFilter === cat ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          borderColor: '#334155',
                          color: permCategoryFilter === cat ? '#0F172A' : '#94A3B8',
                        }}
                      />
                    ))}
                  </Box>

                  <Table<PermissionRow>
                    columns={singlePermColumns}
                    data={filteredSinglePermRows}
                    rowKey="id"
                    size="xs"
                    showCheckbox={true}
                    selectedRows={filteredSinglePermRows.filter((r) => Boolean(userPerms[r.perm]))}
                    onRowSelect={(row, checked) =>
                      setUserPerms((prev) => ({ ...prev, [row.perm]: checked }))
                    }
                    onSelectAll={(checked) =>
                      setUserPerms((prev) => {
                        const next = { ...prev };
                        filteredSinglePermRows.forEach((r) => {
                          next[r.perm] = checked;
                        });
                        return next;
                      })
                    }
                    onRowClick={(row) => handleTogglePerm(row.perm)}
                    showSearch={true}
                    searchPlaceholder="Search permissions by name, key, or description..."
                    showPagination={true}
                    itemsPerPage={fullscreenPanel === 'single-perms' ? 20 : 12}
                    fillHeight={fullscreenPanel === 'single-perms'}
                    maxHeight={fullscreenPanel === 'single-perms' ? undefined : 460}
                    emptyMessage="No permissions match this filter."
                  />
                </>
              )}
            </WindowPanel>
          </Grid>
        </Grid>
      )}

      {/* TAB 2: BULK PERMISSION MATRIX */}
      {activeTab === 2 && (
        <Grid container spacing={2.5} direction={swapBulkLayout ? 'row-reverse' : 'row'}>
          {/* Target Users Table */}
          <Grid
            item
            xs={12}
            md={minimizedPanels['bulk-perms'] ? 12 : minimizedPanels['bulk-users'] ? 12 : 5}
          >
            <WindowPanel
              title={`Select Target Users (${bulkSelectedUserIds.length})`}
              subtitle="Choose multiple accounts to receive the selected permission set."
              isFullscreen={fullscreenPanel === 'bulk-users'}
              onToggleFullscreen={() =>
                setFullscreenPanel((prev) => (prev === 'bulk-users' ? null : 'bulk-users'))
              }
              isMinimized={Boolean(minimizedPanels['bulk-users'])}
              onToggleMinimize={() => toggleMinimizePanel('bulk-users')}
              onSwapPosition={() => setSwapBulkLayout((prev) => !prev)}
              swapTooltip="Move panel Left / Right"
            >
              <Table<AdminUser>
                columns={pickerUserColumns}
                data={manageableRbacUsers}
                rowKey="id"
                size="xs"
                isLoading={usersLoading}
                showCheckbox={true}
                selectedRows={manageableRbacUsers.filter((u) => bulkSelectedUserIds.includes(u.id))}
                onRowSelect={(u, checked) =>
                  setBulkSelectedUserIds((prev) =>
                    checked ? (prev.includes(u.id) ? prev : [...prev, u.id]) : prev.filter((id) => id !== u.id)
                  )
                }
                onSelectAll={(checked) =>
                  setBulkSelectedUserIds(checked ? manageableRbacUsers.map((u) => u.id) : [])
                }
                onRowClick={(u) =>
                  setBulkSelectedUserIds((prev) =>
                    prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                  )
                }
                showSearch={true}
                searchPlaceholder="Search target users..."
                showPagination={true}
                itemsPerPage={8}
                emptyMessage={isSelfAdmin ? "No non-admin users available." : "No users assigned to you for bulk delegation."}
              />
            </WindowPanel>
          </Grid>

          {/* Permissions Table */}
          <Grid
            item
            xs={12}
            md={minimizedPanels['bulk-users'] ? 12 : minimizedPanels['bulk-perms'] ? 12 : 7}
          >
            <WindowPanel
              title="Bulk Permission Delegation"
              subtitle="Select permissions to apply across all checked target users."
              isFullscreen={fullscreenPanel === 'bulk-perms'}
              onToggleFullscreen={() =>
                setFullscreenPanel((prev) => (prev === 'bulk-perms' ? null : 'bulk-perms'))
              }
              isMinimized={Boolean(minimizedPanels['bulk-perms'])}
              onToggleMinimize={() => toggleMinimizePanel('bulk-perms')}
              onSwapPosition={() => setSwapBulkLayout((prev) => !prev)}
              swapTooltip="Move panel Left / Right"
              headerActions={
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={bulkSelectedUserIds.length === 0 || bulkPermsMutation.isPending}
                  onClick={async () => {
                    const payload = {
                      all_user_permissions: bulkSelectedUserIds.map((userId) => ({
                        user_id: userId,
                        permissions: bulkPerms,
                      })),
                    };
                    await bulkPermsMutation.mutateAsync(payload);
                  }}
                >
                  Apply Bulk ({bulkSelectedUserIds.length} users)
                </Button>
              }
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {permCategories.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onClick={() => setBulkCategoryFilter(cat)}
                    color={bulkCategoryFilter === cat ? 'primary' : 'default'}
                    variant={bulkCategoryFilter === cat ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      borderColor: '#334155',
                      color: bulkCategoryFilter === cat ? '#0F172A' : '#94A3B8',
                    }}
                  />
                ))}
              </Box>
              <Table<PermissionRow>
                columns={bulkPermColumns}
                data={filteredBulkPermRows}
                rowKey="id"
                size="xs"
                showCheckbox={true}
                selectedRows={filteredBulkPermRows.filter((r) => Boolean(bulkPerms[r.perm]))}
                onRowSelect={(row, checked) =>
                  setBulkPerms((prev) => ({ ...prev, [row.perm]: checked }))
                }
                onSelectAll={(checked) =>
                  setBulkPerms((prev) => {
                    const next = { ...prev };
                    filteredBulkPermRows.forEach((r) => {
                      next[r.perm] = checked;
                    });
                    return next;
                  })
                }
                onRowClick={(row) =>
                  setBulkPerms((prev) => ({ ...prev, [row.perm]: !prev[row.perm] }))
                }
                showSearch={true}
                searchPlaceholder="Search permissions..."
                showPagination={true}
                itemsPerPage={fullscreenPanel === 'bulk-perms' ? 20 : 12}
                emptyMessage="No permissions match this filter."
              />
            </WindowPanel>
          </Grid>
        </Grid>
      )}

      {/* EDIT USER DIALOG */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Edit User Account</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
          />
          <TextField
            label="Email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            fullWidth
            size="small"
          />
          {isSelfAdmin && selectedUser && String(selectedUser.role || '').toLowerCase() !== 'admin' && (
            <>
              <TextField
                select
                label="Role"
                value={editRole === 'admin' ? 'user' : editRole}
                onChange={(e) => setEditRole(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="user">User (Standard / Operator)</MenuItem>
              </TextField>
              <TextField
                select
                label="Assigned Manager (Delegated RBAC)"
                value={editManagedById}
                onChange={(e) => setEditManagedById(e.target.value)}
                fullWidth
                size="small"
                helperText="Only the assigned manager (and Main Admin) can manage this user's RBAC & account"
              >
                <MenuItem value="">Main Admin Only (Unassigned)</MenuItem>
                {users
                  .filter(
                    (u) =>
                      u.id !== selectedUser.id &&
                      String(u.role || u.user_role || '').toLowerCase() !== 'admin'
                  )
                  .map((mgr) => (
                    <MenuItem key={mgr.id} value={String(mgr.id)}>
                      {mgr.name} ({mgr.email}) — #{mgr.id}
                    </MenuItem>
                  ))}
              </TextField>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Update User Password</Typography>
          <IconButton size="small" onClick={() => setPasswordDialogOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(user?.id === selectedUser?.id || !isSelfAdmin) && (
            <TextField
              label="Current Password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              fullWidth
              size="small"
              required
              helperText="Required to verify identity before password update"
              sx={{ mt: 1 }}
            />
          )}
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            helperText="Minimum 8 characters with numbers & symbols"
          />
          {isMFAEnabled && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', textAlign: 'center', mb: 0.5 }}>
                Admin MFA Authorization Code (6 Digits)
              </Typography>
              <OtpBoxesInput
                value={passwordOtp}
                onChange={setPasswordOtp}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSavePassword} disabled={passwordMutation.isPending || !newPassword}>
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* ISSUE TEMP TOKEN DIALOG */}
      <Dialog open={tempTokenDialogOpen} onClose={() => setTempTokenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Issue Temporary Token (SLT)</Typography>
          <IconButton size="small" onClick={() => setTempTokenDialogOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Issues a 2-minute Short-Lived Token (SLT) that allows the target user to reset password or restore accounts.
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={tempTokenRestorePasswd}
                onChange={(e) => setTempTokenRestorePasswd(e.target.checked)}
                sx={{ color: '#475569', '&.Mui-checked': { color: '#38BDF8' } }}
              />
            }
            label={<Typography variant="body2" sx={{ color: '#F8FAFC' }}>Allow Password Restoration</Typography>}
          />

          {isMFAEnabled && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', textAlign: 'center', mb: 0.5 }}>
                Admin MFA Authorization Code (6 Digits)
              </Typography>
              <OtpBoxesInput
                value={tempTokenOtp}
                onChange={setTempTokenOtp}
              />
            </Box>
          )}

          {issuedTempToken && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert
                severity="info"
                sx={{
                  bgcolor: 'rgba(56, 189, 248, 0.1)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 2,
                  fontSize: '0.82rem',
                }}
              >
                Generated 2-minute SLT for <strong>{selectedUser?.name || 'User'} (#{selectedUser?.id})</strong> strictly authorized for{' '}
                <strong>{tempTokenRestorePasswd ? 'Password Reset' : 'Account Restoration'}</strong>.
              </Alert>

              {/* Recovery URL with Current Host/IP */}
              <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  Direct Recovery Link (Share with User):
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: '#60A5FA',
                    fontSize: 12,
                    bgcolor: '#030712',
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px solid #1E293B',
                    mb: 1.5,
                  }}
                >
                  {`${window.location.origin}/recovery?token=${encodeURIComponent(issuedTempToken)}`}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={copiedLink ? <Check fontSize="small" /> : <Copy fontSize="small" />}
                    onClick={() => {
                      const link = `${window.location.origin}/recovery?token=${encodeURIComponent(issuedTempToken)}`;
                      copyToClipboard(link);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                      ToastMsgs.success('Direct recovery link copied to clipboard!');
                    }}
                    sx={{
                      background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
                      textTransform: 'none',
                      fontWeight: 700,
                    }}
                  >
                    {copiedLink ? 'Link Copied!' : 'Copy Recovery Link'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenIcon fontSize="small" />}
                    onClick={() => {
                      const link = `${window.location.origin}/recovery?token=${encodeURIComponent(issuedTempToken)}`;
                      window.open(link, '_blank');
                    }}
                    sx={{
                      color: '#38BDF8',
                      borderColor: 'rgba(56, 189, 248, 0.4)',
                      textTransform: 'none',
                    }}
                  >
                    Open Link
                  </Button>
                </Stack>
              </Paper>

              {/* Raw Token Collapsible / Display */}
              <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  Raw Temporary Token (Expires in 120s):
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: '#A7F3D0',
                    fontSize: 11,
                    bgcolor: '#030712',
                    p: 1,
                    borderRadius: 1,
                    maxHeight: 65,
                    overflowY: 'auto',
                    mb: 1,
                  }}
                >
                  {issuedTempToken}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={copiedToken ? <Check fontSize="small" /> : <Copy fontSize="small" />}
                  onClick={() => {
                    copyToClipboard(issuedTempToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                    ToastMsgs.success('Raw temporary token copied!');
                  }}
                  sx={{ color: '#94A3B8', borderColor: '#334155', textTransform: 'none' }}
                >
                  {copiedToken ? 'Copied' : 'Copy Raw Token'}
                </Button>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setTempTokenDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
          {!issuedTempToken && (
            <Button
              variant="contained"
              onClick={handleGenerateTempToken}
              disabled={tempTokenMutation.isPending}
            >
              Generate Token
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* RESET AUTO-KILL DIALOG */}
      <Dialog open={autoKillDialogOpen} onClose={() => setAutoKillDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldAlert fontSize="medium" /> Reset Auto-Kill Safety Switch
          </Box>
          <IconButton size="small" onClick={() => setAutoKillDialogOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            This clears the Redis safety mode flag that halts system endpoints after repeated critical internal failures.
          </Typography>
          {isMFAEnabled && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 700, display: 'block', textAlign: 'center', mb: 0.5 }}>
                Safety Switch Authorization Code (6 Digits)
              </Typography>
              <OtpBoxesInput
                value={autoKillOtp}
                onChange={setAutoKillOtp}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setAutoKillDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              await resetKillMutation.mutateAsync(autoKillOtp || undefined);
              setAutoKillDialogOpen(false);
            }}
            disabled={resetKillMutation.isPending}
          >
            Confirm Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* ACCOUNT ACTION CONFIRMATION DIALOG (DISABLE / ENABLE / DELETE / RESTORE) */}
      <Dialog
        open={actionDialog.open}
        onClose={() => setActionDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: '#0B132B',
            color: actionDialog.type === 'delete' || actionDialog.type === 'disable' ? '#EF4444' : '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            {actionDialog.type === 'disable' && 'Disable User Account'}
            {actionDialog.type === 'enable' && 'Enable User Account'}
            {actionDialog.type === 'delete' && 'Delete User Account'}
            {actionDialog.type === 'restore' && 'Restore User Account'}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setActionDialog((prev) => ({ ...prev, open: false }))}
            sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Confirm {actionDialog.type} for <strong>{actionDialog.user?.username || actionDialog.user?.email}</strong>.
          </Typography>
          {actionDialog.type !== 'restore' && (
            <TextField
              label={isSelfAdmin ? 'Your Password (Optional for Admin)' : 'Your Password'}
              type="password"
              value={actionPassword}
              onChange={(e) => setActionPassword(e.target.value)}
              fullWidth
              size="small"
            />
          )}
          {isMFAEnabled && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', textAlign: 'center', mb: 0.5 }}
              >
                {activeMFAMethod === 'email'
                  ? 'Email Verification Code (6 Digits)'
                  : '2FA Authenticator TOTP Code (6 Digits)'}
              </Typography>
              <OtpBoxesInput value={actionOtp} onChange={setActionOtp} />
              {activeMFAMethod === 'email' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleSendActionOtp}
                    disabled={sendingActionOtp}
                    sx={{ color: '#38BDF8', textTransform: 'none' }}
                  >
                    {sendingActionOtp ? 'Sending Code...' : 'Send Email Code'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button
            onClick={() => setActionDialog((prev) => ({ ...prev, open: false }))}
            sx={{ color: '#94A3B8' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'delete' || actionDialog.type === 'disable' ? 'error' : 'success'}
            onClick={handleConfirmAction}
            disabled={
              disableMutation.isPending ||
              enableMutation.isPending ||
              deleteMutation.isPending ||
              restoreMutation.isPending ||
              (isMFAEnabled && actionOtp.trim().length < 6)
            }
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
