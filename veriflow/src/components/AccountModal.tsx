import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Stack,
  Alert,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  ManageAccountsRounded as AccountIcon,
  LockRounded as LockIcon,
  VerifiedUserRounded as ShieldIcon,
  WarningAmberRounded as WarningIcon,
  VpnKeyRounded as KeyIcon,
  SaveRounded as SaveIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useMFAStatusQuery } from '../pages/Security/query';
import { useUpdateUserMutation, useUpdatePasswordMutation, useDisableAccountMutation, useDeleteAccountMutation } from '../pages/Admin/query';
import { OtpBoxesInput } from './OtpModal';
import { ToastMsgs } from '../api/toastUtils';
import { PERMISSION_METADATA } from '../config/permissionsMetadata';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ open, onClose }) => {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions || {};
  const isAdmin = user?.role === 'admin' || (user as any)?.user_role === 'admin';

  const { data: mfaStatus } = useMFAStatusQuery();
  const isMFAEnabled = Boolean(user?.mfa_enabled || mfaStatus?.mfa_enabled);

  const [activeTab, setActiveTab] = useState<number>(0);

  // Profile Form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password Form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordOtp, setPasswordOtp] = useState('');

  // Danger Confirmations
  const [confirmDisablePassword, setConfirmDisablePassword] = useState('');
  const [disableOtp, setDisableOtp] = useState('');
  const [confirmDeletePassword, setConfirmDeletePassword] = useState('');
  const [permSearch, setPermSearch] = useState('');

  // Permissions granted to this user
  const canUpdateProfile = isAdmin || Boolean(permissions['user.update.self']) || Boolean(permissions['user.update.profile']);
  const canUpdateEmail = isAdmin || Boolean(permissions['user.update.self']) || Boolean(permissions['user.update.email']);
  const canUpdatePassword = isAdmin || Boolean(permissions['user.update.password']);
  const canDisableSelf = isAdmin || Boolean(permissions['user.disable.self']);
  const canDeleteSelf = isAdmin || Boolean(permissions['user.delete.self']);

  useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOtp('');
      setConfirmDisablePassword('');
      setDisableOtp('');
      setConfirmDeletePassword('');
    }
  }, [open, user]);

  const updateMutation = useUpdateUserMutation();
  const passwordMutation = useUpdatePasswordMutation();
  const disableMutation = useDisableAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({
        userId: Number(user.id),
        payload: { name, email },
      });
      useAuthStore.getState().setUser({
        ...user,
        name,
        email,
      });
      ToastMsgs.success('Account profile updated successfully');
    } catch {
      // Error handled by mutation
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      ToastMsgs.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      ToastMsgs.error('Password must be at least 8 characters');
      return;
    }
    if (!isAdmin && !oldPassword) {
      ToastMsgs.error('Current password is required');
      return;
    }

    try {
      await passwordMutation.mutateAsync({
        userId: Number(user.id),
        payload: {
          new_password: newPassword,
          old_password: oldPassword || undefined,
          otp: passwordOtp || undefined,
        },
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOtp('');
      ToastMsgs.success('Password updated successfully');
    } catch {
      // Error handled by mutation
    }
  };

  const handleDisableAccount = async () => {
    if (!user || !confirmDisablePassword) return;
    try {
      await disableMutation.mutateAsync({
        userId: Number(user.id),
        payload: {
          password: confirmDisablePassword,
          otp: disableOtp || undefined,
        },
      });
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirmDeletePassword) return;
    try {
      await deleteMutation.mutateAsync({
        userId: Number(user.id),
        payload: {
          password: confirmDeletePassword,
        },
      });
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const userPermEntries = useMemo(() => {
    const list = Object.entries(permissions);
    if (!permSearch.trim()) return list;
    const q = permSearch.toLowerCase();
    return list.filter(([k]) => k.toLowerCase().includes(q));
  }, [permissions, permSearch]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#0F172A', border: '1px solid #1E293B', borderRadius: 3, color: '#F8FAFC' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid #1E293B' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <div className="w-8 h-8 rounded-lg bg-[#FACC15]/15 text-[#FACC15] flex items-center justify-center font-bold">
            <AccountIcon fontSize="small" />
          </div>
          <div>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC', fontSize: 16 }}>
              Account & Profile Governance
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Manage credentials, permissions, and identity controls
            </Typography>
          </div>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {/* User Card Telemetry Banner */}
        <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#07111D', border: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={user?.profile_pic || undefined}
            sx={{ width: 48, height: 48, bgcolor: '#FACC15', color: '#07111D', fontWeight: 800, fontSize: 18 }}
          >
            {(user?.name || user?.email || 'U')[0].toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                {user?.name || 'Unnamed Operator'}
              </Typography>
              <Chip
                size="small"
                label={isAdmin ? 'ADMIN' : 'OPERATOR'}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  bgcolor: isAdmin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                  color: isAdmin ? '#F87171' : '#38BDF8',
                  border: `1px solid ${isAdmin ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                }}
              />
              <Chip
                size="small"
                label={isMFAEnabled ? '2FA ACTIVE' : 'MFA STANDBY'}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  bgcolor: isMFAEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                  color: isMFAEnabled ? '#34D399' : '#94A3B8',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
              {user?.email} • ID #{user?.id}
            </Typography>
          </Box>
        </Box>

        {/* Tab Selection */}
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            mb: 2,
            borderBottom: '1px solid #1E293B',
            '& .MuiTab-root': { color: '#94A3B8', textTransform: 'none', fontWeight: 600, fontSize: 13 },
            '& .Mui-selected': { color: '#FACC15 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#FACC15' },
          }}
        >
          <Tab icon={<AccountIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Profile" />
          <Tab icon={<LockIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Password" />
          <Tab icon={<ShieldIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Permissions" />
          <Tab icon={<WarningIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Safety" />
        </Tabs>

        {/* TAB 0: PROFILE */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            {!canUpdateProfile && !canUpdateEmail && (
              <Alert severity="info" sx={{ bgcolor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                You have read-only access to your account profile (requires user.update.self permission).
              </Alert>
            )}

            <TextField
              label="Operator Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canUpdateProfile}
              fullWidth
              size="small"
              sx={{ bgcolor: '#07111D', borderRadius: 1 }}
              helperText={canUpdateProfile ? 'Authorized by user.update.profile / self' : 'Profile edit permission not granted'}
            />

            <TextField
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canUpdateEmail}
              fullWidth
              size="small"
              sx={{ bgcolor: '#07111D', borderRadius: 1 }}
              helperText={canUpdateEmail ? 'Authorized by user.update.email / self' : 'Email edit permission not granted'}
            />

            <TextField
              label="Assigned System Role"
              value={String(user?.role || user?.user_role || 'user').toUpperCase()}
              disabled
              fullWidth
              size="small"
              sx={{ bgcolor: '#07111D', borderRadius: 1 }}
              helperText="Assigned by administrator (immutable by standard operators)"
            />

            {(canUpdateProfile || canUpdateEmail) && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveProfile}
                  disabled={updateMutation.isPending || (!name && !email)}
                  sx={{ bgcolor: '#FACC15', color: '#07111D', fontWeight: 700, '&:hover': { bgcolor: '#EAB308' } }}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </Box>
            )}
          </Stack>
        )}

        {/* TAB 1: PASSWORD ROTATION */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            {!canUpdatePassword && (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                Password rotation permission (user.update.password) is not active on this account.
              </Alert>
            )}

            {!isAdmin && (
              <TextField
                label="Current Password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={!canUpdatePassword}
                fullWidth
                size="small"
                required
                helperText="Required to verify account ownership before setting new password"
                sx={{ bgcolor: '#07111D', borderRadius: 1 }}
              />
            )}

            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!canUpdatePassword}
              fullWidth
              size="small"
              required
              helperText="At least 8 characters with numbers and symbols"
              sx={{ bgcolor: '#07111D', borderRadius: 1 }}
            />

            <TextField
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!canUpdatePassword}
              fullWidth
              size="small"
              required
              sx={{ bgcolor: '#07111D', borderRadius: 1 }}
            />

            {isMFAEnabled && canUpdatePassword && (
              <Box sx={{ p: 2, bgcolor: '#07111D', borderRadius: 2, border: '1px solid #1E293B' }}>
                <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', textAlign: 'center', mb: 1 }}>
                  Enter 2FA Security Code (MFA Authorization)
                </Typography>
                <OtpBoxesInput value={passwordOtp} onChange={setPasswordOtp} />
              </Box>
            )}

            {canUpdatePassword && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<KeyIcon />}
                  onClick={handleSavePassword}
                  disabled={passwordMutation.isPending || !newPassword || newPassword !== confirmPassword || (!isAdmin && !oldPassword)}
                  sx={{ bgcolor: '#FACC15', color: '#07111D', fontWeight: 700, '&:hover': { bgcolor: '#EAB308' } }}
                >
                  {passwordMutation.isPending ? 'Updating...' : 'Rotate Password'}
                </Button>
              </Box>
            )}
          </Stack>
        )}

        {/* TAB 2: MY GRANTED PERMISSIONS */}
        {activeTab === 2 && (
          <Box className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-400">
                Active Permissions ({userPermEntries.filter(([, v]) => v).length} granted / {userPermEntries.length} total)
              </span>
              <input
                type="text"
                placeholder="Filter permissions..."
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                className="input input-bordered input-xs bg-[#07111D] border-[#1E293B] text-slate-200 font-mono w-44"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-[#07111D] border border-[#1E293B]">
              {userPermEntries.length === 0 ? (
                <div className="text-center p-4 text-xs font-mono text-slate-500">
                  No matching permissions found.
                </div>
              ) : (
                userPermEntries.map(([permKey, granted]) => {
                  const meta = PERMISSION_METADATA[permKey];
                  const isTagsCreate = permKey === 'tags.create';
                  return (
                    <div
                      key={permKey}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-xs transition-colors gap-2 ${
                        isTagsCreate
                          ? 'bg-yellow-950/25 border-yellow-500/50 text-yellow-200'
                          : granted
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-[12px]">{meta?.label || permKey}</span>
                          {meta?.badge && (
                            <span className="badge badge-xs bg-yellow-400 text-slate-950 font-bold font-mono">
                              {meta.badge}
                            </span>
                          )}
                          <span className="font-mono text-slate-400 text-[11px]">({permKey})</span>
                        </div>
                        {meta?.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{meta.description}</p>
                        )}
                      </div>
                      <span className={`badge badge-xs font-mono font-bold self-start sm:self-auto shrink-0 ${granted ? 'badge-success' : 'badge-ghost text-slate-600'}`}>
                        {granted ? 'GRANTED' : 'DENIED'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Box>
        )}

        {/* TAB 3: SAFETY ACTIONS */}
        {activeTab === 3 && (
          <Stack spacing={2.5}>
            {/* Disable Account */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#07111D', border: '1px solid #1E293B' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#FACC15', mb: 0.5 }}>
                Disable Account (Temporary Standby)
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1.5 }}>
                {canDisableSelf
                  ? 'Temporarily freeze your account. Requires password confirmation and MFA.'
                  : 'Requires user.disable.self permission (not currently assigned).'}
              </Typography>
              {canDisableSelf && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Confirm Account Password"
                    type="password"
                    value={confirmDisablePassword}
                    onChange={(e) => setConfirmDisablePassword(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  {isMFAEnabled && (
                    <Box sx={{ p: 1 }}>
                      <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        Enter 2FA Code
                      </Typography>
                      <OtpBoxesInput value={disableOtp} onChange={setDisableOtp} />
                    </Box>
                  )}
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={handleDisableAccount}
                    disabled={disableMutation.isPending || !confirmDisablePassword}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                  >
                    {disableMutation.isPending ? 'Processing...' : 'Disable My Account'}
                  </Button>
                </Stack>
              )}
            </Box>

            {/* Soft Delete Account */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#07111D', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#EF4444', mb: 0.5 }}>
                Delete Account (Self Soft-Delete)
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1.5 }}>
                {canDeleteSelf
                  ? 'Soft-delete your operator identity. Can only be restored by system administrators.'
                  : 'Requires user.delete.self permission (not currently assigned).'}
              </Typography>
              {canDeleteSelf && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Enter Password to Confirm Deletion"
                    type="password"
                    value={confirmDeletePassword}
                    onChange={(e) => setConfirmDeletePassword(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteAccount}
                    disabled={deleteMutation.isPending || !confirmDeletePassword}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete My Account'}
                  </Button>
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #1E293B' }}>
        <Button onClick={onClose} sx={{ color: '#94A3B8', textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccountModal;
