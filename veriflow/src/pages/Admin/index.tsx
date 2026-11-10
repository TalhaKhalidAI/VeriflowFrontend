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
} from './query';
import type { AdminUser } from './types';
import { useAuthStore } from '../../store/authStore';
import { useMFAStatusQuery } from '../Security/query';
import { ToastMsgs } from '../../api/toastUtils';
import { OtpBoxesInput } from '../../components/OtpModal';
import { Table, type TableColumn } from '../../components/Table';
import { PERMISSION_METADATA } from '../../config/permissionsMetadata';
import { CloseRounded as CloseIcon } from '@mui/icons-material';

export const AdminPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { data: mfaStatus } = useMFAStatusQuery();
  const isMFAEnabled = Boolean(user?.mfa_enabled || mfaStatus?.mfa_enabled);

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

  const [permMatrixUser, setPermMatrixUser] = useState<AdminUser | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});

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

  // Handlers
  const handleOpenEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role || 'user');
    setEditDialogOpen(true);
  };

  const isSelfAdmin = user?.role === 'admin' || (user as any)?.user_role === 'admin';

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    const payload: any = { name: editName, email: editEmail };
    if (isSelfAdmin) {
      payload.role = editRole;
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

  const handleOpenPermMatrix = (user: AdminUser) => {
    setPermMatrixUser(user);
    setUserPerms({ ...user.permissions });
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
    await setPermsMutation.mutateAsync({
      user_id: permMatrixUser.id,
      permissions: userPerms,
    });
    if (user && String(user.id) === String(permMatrixUser.id)) {
      useAuthStore.getState().setUser({
        ...user,
        permissions: userPerms,
      });
    }
  };

  const handleClearUserPerms = async () => {
    if (!permMatrixUser) return;
    await removePermsMutation.mutateAsync({
      user_id: permMatrixUser.id,
      remove_all: true,
    });
    setUserPerms({});
  };

  // Group permissions by category
  const permissionGroups = React.useMemo(() => {
    const groups: Record<string, string[]> = {};
    allPermissions.forEach((p) => {
      const parts = p.split('.');
      const category = parts[0] ? parts[0].toUpperCase() : 'GENERAL';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  }, [allPermissions]);

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
        render: (_, u) => {
          const permCount = Object.keys(u.permissions || {}).length;
          return (
            <Button
              size="small"
              variant="text"
              onClick={() => handleOpenPermMatrix(u)}
              sx={{ textTransform: 'none', color: '#38BDF8', fontSize: 12, p: 0 }}
            >
              {u.role === 'admin' ? 'Admin Full Access' : `${permCount} grants`}
            </Button>
          );
        },
      });
    }

    return cols;
  }, [showPermissions]);

  const renderUserActions = (u: AdminUser) => {
    const isTargetSelf = Number(user?.id) === Number(u.id);
    const myPerms = user?.permissions || {};

    const canEdit =
      isSelfAdmin ||
      Boolean(myPerms['admin.users.promote']) ||
      Boolean(myPerms['admin.settings.update']) ||
      (isTargetSelf && (Boolean(myPerms['user.update.self']) || Boolean(myPerms['user.update.profile']) || Boolean(myPerms['user.update.email'])));

    const canChangePass =
      isSelfAdmin ||
      Boolean(myPerms['admin.anyuser.password.update']) ||
      (isTargetSelf && Boolean(myPerms['user.update.password']));

    const canIssueSLT =
      isSelfAdmin ||
      Boolean(myPerms['admin.users.promote']) ||
      Boolean(myPerms['admin.users.restore']) ||
      Boolean(myPerms['admin.users.disable']);

    const canEnable =
      isSelfAdmin ||
      Boolean(myPerms['admin.user.enable']) ||
      Boolean(myPerms['admin.users.promote']) ||
      (isTargetSelf && Boolean(myPerms['user.self.enable']));

    const canDisable =
      isSelfAdmin ||
      Boolean(myPerms['admin.users.disable']) ||
      Boolean(myPerms['admin.users.promote']) ||
      (isTargetSelf && Boolean(myPerms['user.disable.self']));

    const canRestore =
      isSelfAdmin ||
      Boolean(myPerms['admin.users.restore']) ||
      Boolean(myPerms['admin.users.promote']);

    const canDelete =
      isSelfAdmin ||
      Boolean(myPerms['admin.users.delete']) ||
      Boolean(myPerms['admin.users.promote']) ||
      (isTargetSelf && Boolean(myPerms['user.delete.self']));

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
                onClick={() => enableMutation.mutate({ userId: u.id })}
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
                onClick={() => disableMutation.mutate({ userId: u.id })}
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
                onClick={() => restoreMutation.mutate({ userId: u.id })}
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
                onClick={() => deleteMutation.mutate({ userId: u.id })}
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
        <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2, p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
              mb: 3,
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                {permMatrixUser
                  ? `Assign Permissions: ${permMatrixUser.name} (${permMatrixUser.email})`
                  : 'Select a user to inspect and grant permissions'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Fine-grained RBAC controls enforced at the API gateway and backend authorization dependencies.
              </Typography>
            </Box>
            {permMatrixUser && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
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
            )}
          </Box>

          {!permMatrixUser ? (
            <Alert severity="info" sx={{ bgcolor: '#07111D', color: '#94A3B8', border: '1px solid #1E293B' }}>
              Please select a user from the "User Management" tab or click their permissions chip.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {Object.entries(permissionGroups).map(([category, perms]) => (
                <Grid item xs={12} md={6} lg={4} key={category}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: '#07111D',
                      border: '1px solid #1E293B',
                      borderRadius: 2,
                      height: '100%',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700, mb: 1.5 }}>
                      {category}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {perms.map((perm) => {
                        const meta = PERMISSION_METADATA[perm];
                        const isTagsCreate = perm === 'tags.create';
                        return (
                          <Box
                            key={perm}
                            sx={{
                              p: 1.25,
                              borderRadius: 1.5,
                              border: isTagsCreate ? '1px solid rgba(250, 204, 21, 0.4)' : '1px solid #1E293B',
                              bgcolor: isTagsCreate ? 'rgba(250, 204, 21, 0.06)' : 'rgba(15, 23, 42, 0.5)',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: isTagsCreate ? 'rgba(250, 204, 21, 0.12)' : 'rgba(30, 41, 59, 0.6)',
                                borderColor: isTagsCreate ? '#FACC15' : '#334155',
                              },
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={Boolean(userPerms[perm])}
                                  onChange={() => handleTogglePerm(perm)}
                                  size="small"
                                  sx={{
                                    color: isTagsCreate ? '#FACC15' : '#475569',
                                    '&.Mui-checked': { color: isTagsCreate ? '#FACC15' : '#38BDF8' },
                                    mt: -0.5,
                                  }}
                                />
                              }
                              label={
                                <Box>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: isTagsCreate ? '#FDE047' : '#F8FAFC',
                                        fontWeight: isTagsCreate ? 800 : 700,
                                        fontSize: '12.5px',
                                      }}
                                    >
                                      {meta?.label || perm}
                                    </Typography>
                                    {meta?.badge && (
                                      <span className="badge badge-xs bg-yellow-400 text-slate-950 font-bold font-mono">
                                        {meta.badge}
                                      </span>
                                    )}
                                  </div>
                                  <Typography
                                    variant="caption"
                                    sx={{ display: 'block', color: isTagsCreate ? '#FEF08A' : '#94A3B8', fontSize: '11px', mt: 0.2, lineHeight: 1.3 }}
                                  >
                                    <span className="font-mono text-slate-500 mr-1">({perm})</span>
                                    {meta?.description || ''}
                                  </Typography>
                                </Box>
                              }
                              sx={{ m: 0, alignItems: 'flex-start', width: '100%' }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Card>
      )}

      {/* TAB 2: BULK PERMISSION MATRIX */}
      {activeTab === 2 && (
        <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2, p: 3 }}>
          <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, mb: 1 }}>
            Bulk Permission Delegation
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
            Select multiple target user accounts and apply a standardized set of permissions simultaneously.
          </Typography>

          <Grid container spacing={3}>
            {/* Target Users Column */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700, mb: 1.5 }}>
                  Select Target Users ({bulkSelectedUserIds.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 400, overflowY: 'auto' }}>
                  {users.map((u) => {
                    const isSelected = bulkSelectedUserIds.includes(u.id);
                    return (
                      <FormControlLabel
                        key={u.id}
                        control={
                          <Checkbox
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setBulkSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                              } else {
                                setBulkSelectedUserIds((prev) => [...prev, u.id]);
                              }
                            }}
                            size="small"
                            sx={{ color: '#475569', '&.Mui-checked': { color: '#38BDF8' } }}
                          />
                        }
                        label={
                          <Typography variant="caption" sx={{ color: '#E2E8F0' }}>
                            {u.name} ({u.email})
                          </Typography>
                        }
                      />
                    );
                  })}
                </Box>
              </Paper>
            </Grid>

            {/* Permissions Column */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700 }}>
                    Select Permissions to Assign
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
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
                    Apply Bulk Permissions
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  {Object.entries(permissionGroups).map(([category, perms]) => (
                    <Grid item xs={12} sm={6} key={category}>
                      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700 }}>
                        {category}
                      </Typography>
                      {perms.map((perm) => (
                        <FormControlLabel
                          key={perm}
                          control={
                            <Checkbox
                              checked={Boolean(bulkPerms[perm])}
                              onChange={() =>
                                setBulkPerms((prev) => ({
                                  ...prev,
                                  [perm]: !prev[perm],
                                }))
                              }
                              size="small"
                              sx={{ color: '#475569', '&.Mui-checked': { color: '#38BDF8' } }}
                            />
                          }
                          label={
                            <Typography variant="caption" sx={{ color: '#E2E8F0', fontFamily: 'monospace' }}>
                              {perm}
                            </Typography>
                          }
                          sx={{ display: 'block', m: 0 }}
                        />
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Card>
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
          {isSelfAdmin && (
            <TextField
              select
              label="Role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="user">User (Standard)</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
            </TextField>
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
    </Box>
  );
};

export default AdminPage;
