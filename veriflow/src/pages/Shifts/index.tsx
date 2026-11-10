// src/pages/Shifts/index.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Typography,
  Button,

  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Paper,
  Stack,
  Radio,
  RadioGroup,
  Tabs, Alert,
  Tab,
} from '@mui/material';
import {
  PlayArrowRounded as StartIcon,
  StopRounded as StopIcon,
  AutorenewRounded as ReissueIcon,
  ContentCopyRounded as CopyIcon,
  QrCode2Rounded as QrCodeIcon,
  AccessTimeFilledRounded as ShiftIcon,
  DownloadRounded as DownloadIcon,
  DeleteRounded as DeleteIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import {
  useActiveShiftQuery,
  useShiftsQuery,
  useStartShiftMutation,
  useReissueActiveShiftMutation,
  useCheckoutShiftMutation,
  useDeleteShiftMutation,
} from './query';
import type { StartShiftResponse, ReissueShiftResponse, ShiftRecord, ShiftDurationUnit } from './types';
import { Table, type TableColumn, type TableAction } from '../../components/Table';
import { useKeysQuery } from '../Keys/query';
import { useAdminUsersQuery } from '../Admin/query';
import { ToastMsgs } from '../../api/toastUtils';
import { useAuthStore } from '../../store/authStore';

export function ShiftsPage() {
  const user = useAuthStore((state) => state.user);
  const currentUserId = Number(user?.id);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  const canDeleteAnyShift = isAdmin || Boolean(user?.permissions?.['shifts.delete.any']);
  const canDeleteOwnShift = canDeleteAnyShift || Boolean(user?.permissions?.['shifts.delete']);
  const canViewAny = isAdmin || Boolean(user?.permissions?.['shifts.view.any']) || Boolean(user?.permissions?.['shifts.view.all']) || canDeleteAnyShift;
  const canViewSelf = canViewAny || Boolean(user?.permissions?.['shifts.view']) || Boolean(user?.permissions?.['shifts.view.own']) || canDeleteOwnShift;
  const canCreateShift = isAdmin || Boolean(user?.permissions?.['shifts.create']);
  const canCheckoutShift = isAdmin || Boolean(user?.permissions?.['shifts.checkout']);

  const isShiftSelfCreated = (s?: ShiftRecord | null) =>
    Boolean(s && Number(s.user_id) === currentUserId && s.created_by != null && Number(s.created_by) === currentUserId);

  const canDeleteShiftRecord = (s?: ShiftRecord | null) =>
    Boolean(s && (canDeleteAnyShift || (canDeleteOwnShift && isShiftSelfCreated(s))));

  const { data: activeShift, isLoading: isLoadingActive } = useActiveShiftQuery();
  const { data: shiftsData, isLoading: isLoadingShifts } = useShiftsQuery();
  const { data: keysData } = useKeysQuery('active');
  const { data: usersData = [] } = useAdminUsersQuery({ show_permissions: false, enabled: isAdmin });
  const keys = keysData?.items || [];

  const userOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email: string; role: string }>();
    if (currentUserId) {
      map.set(currentUserId, {
        id: currentUserId,
        name: user?.name || user?.email?.split('@')[0] || `User #${currentUserId}`,
        email: user?.email || '',
        role: user?.role || user?.user_role || 'user',
      });
    }
    (usersData || []).forEach((u) => {
      if (!u?.id) return;
      map.set(Number(u.id), {
        id: Number(u.id),
        name: u.name || u.email?.split('@')[0] || `User #${u.id}`,
        email: u.email || '',
        role: u.role || u.user_role || 'user',
      });
    });
    (shiftsData?.items || []).forEach((s) => {
      if (!s?.user_id || map.has(Number(s.user_id))) return;
      map.set(Number(s.user_id), {
        id: Number(s.user_id),
        name: s.user_name || s.user_email?.split('@')[0] || `User #${s.user_id}`,
        email: s.user_email || '',
        role: 'user',
      });
    });
    return Array.from(map.values());
  }, [usersData, shiftsData, currentUserId, user]);

  const userMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; email: string; role: string }>();
    userOptions.forEach((u) => m.set(u.id, u));
    return m;
  }, [userOptions]);

  const getUserLabel = (uid?: number | null) => {
    if (uid == null) return 'Admin';
    const info = userMap.get(Number(uid));
    return info ? `${info.name} (#${info.id})` : `User #${uid}`;
  };

  const getKeyLabel = (keyId?: string | null) => {
    if (!keyId) return 'Global (All Keys)';
    const k = keys.find((item) => String(item.id) === String(keyId));
    return k ? `${k.name} (kid: ${k.kid})` : `Key ${String(keyId).slice(0, 8)}...`;
  };

  const startShiftMutation = useStartShiftMutation();
  const reissueMutation = useReissueActiveShiftMutation();
  const checkoutMutation = useCheckoutShiftMutation();
  const deleteShiftMutation = useDeleteShiftMutation();

  // Modals state
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [reissueModalOpen, setReissueModalOpen] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shiftIdToDelete, setShiftIdToDelete] = useState<string>('');
  const [selectedShiftToDelete, setSelectedShiftToDelete] = useState<ShiftRecord | null>(null);
  const [tokenResult, setTokenResult] = useState<StartShiftResponse | ReissueShiftResponse | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [tokenModalTab, setTokenModalTab] = useState<number>(0);

  // Start Form (strict_rules and strict_key driven directly by user checkboxes)
  const [startForm, setStartForm] = useState({
    key_id: '',
    duration_value: 8,
    duration_unit: 'hours' as ShiftDurationUnit,
    device_id: 'SCANNER-MOBILE-01',
    include_rules: false,
    qr_only: false,
    target_user_id: '',
    strict_rules: false,
    strict_key: false,
    strict_key_id: '',
    rule_match_mode: 'all' as 'all' | 'any',
  });
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  // Fetch active inventory verification rules for shift assignment
  const { data: rulesData } = useQuery({
    queryKey: ['shift_creator_rules'],
    queryFn: async () => {
      try {
        const res = await http.get<any>('/rules/');
        return (res?.items || []).filter((r: any) => r.is_active);
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 30,
  });
  const availableRules: Array<{
    id: string;
    rule_name: string;
    matching_claim_key: string;
    expected_value: string;
    key_id?: string | null;
    user_id?: number | null;
  }> = rulesData || [];

  const selectedOperatorId = Number(startForm.target_user_id || currentUserId);
  const selectedTargetKeyId = startForm.strict_key && startForm.strict_key_id ? startForm.strict_key_id : startForm.key_id;

  const eligibleRules = useMemo(() => {
    return availableRules.filter((r) => {
      // 1. Worker filter: rule must be unassigned (universal) OR assigned to this operator
      if (r.user_id != null && Number(r.user_id) !== selectedOperatorId) {
        return false;
      }
      // 2. Key filter: rule must be global (no key_id) OR assigned to the shift's target verification key
      if (r.key_id != null && selectedTargetKeyId && String(r.key_id) !== String(selectedTargetKeyId)) {
        return false;
      }
      return true;
    });
  }, [availableRules, selectedOperatorId, selectedTargetKeyId]);

  // Reissue Form (both include_rules and qr_only unchecked by default)
  const [reissueForm, setReissueForm] = useState({
    include_rules: false,
    qr_only: false,
    target_user_id: '',
  });

  // Result mode tracking
  const [resultMode, setResultMode] = useState({
    qr_only: false,
    include_rules: false,
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    ToastMsgs.info(`${label} copied to clipboard!`);
  };

  const generateQRCode = async (token: string) => {
    try {
      const url = await QRCode.toDataURL(token, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrCodeDataUrl(url);
    } catch (err) {
      console.error('Failed to render shift QR', err);
    }
  };

  const handleStartSubmit = async () => {
    const durationVal = Math.max(1, Number(startForm.duration_value) || 1);
    const isQr = startForm.qr_only;
    const hasRules = startForm.include_rules;
    setResultMode({ qr_only: isQr, include_rules: hasRules });

    const filteredRuleIds = selectedRuleIds.filter((id) => eligibleRules.some((r) => r.id === id));
    const effectiveRuleIds = hasRules && filteredRuleIds.length > 0 ? filteredRuleIds : undefined;

    const res: any = await startShiftMutation.mutateAsync({
      payload: {
        key_id: startForm.key_id ? startForm.key_id : undefined,
        duration_value: durationVal,
        duration_unit: startForm.duration_unit,
        duration_hours: startForm.duration_unit === 'hours' ? durationVal : undefined,
        device_id: startForm.device_id,
        include_rules: hasRules,
        rule_ids: effectiveRuleIds,
        strict_rules: startForm.strict_rules,
        strict_key: startForm.strict_key,
        strict_key_id: startForm.strict_key && startForm.strict_key_id ? startForm.strict_key_id : undefined,
        rule_match_mode: startForm.rule_match_mode,
        target_user_id: startForm.target_user_id ? Number(startForm.target_user_id) : undefined,
      },
      qrOnly: isQr,
    });
    setStartModalOpen(false);
    setTokenResult(res);
    setTokenModalTab(isQr ? 0 : 1);
    if (isQr) {
      if (res?.qrBlobUrl) {
        setQrCodeDataUrl(res.qrBlobUrl);
      } else if (res?.shift_token) {
        await generateQRCode(res.shift_token);
      }
    } else {
      setQrCodeDataUrl(null);
    }
    setTokenModalOpen(true);
  };

  const handleReissueSubmit = async () => {
    const isQr = reissueForm.qr_only;
    const hasRules = reissueForm.include_rules;
    setResultMode({ qr_only: isQr, include_rules: hasRules });

    const res: any = await reissueMutation.mutateAsync({
      includeRules: hasRules,
      qrOnly: isQr,
      targetUserId: reissueForm.target_user_id ? Number(reissueForm.target_user_id) : undefined,
    });
    setReissueModalOpen(false);
    setTokenResult(res);
    setTokenModalTab(isQr ? 0 : 1);
    if (isQr) {
      if (res?.qrBlobUrl) {
        setQrCodeDataUrl(res.qrBlobUrl);
      } else if (res?.shift_token) {
        await generateQRCode(res.shift_token);
      }
    } else {
      setQrCodeDataUrl(null);
    }
    setTokenModalOpen(true);
  };

  const handleCheckout = async (shiftId?: string) => {
    await checkoutMutation.mutateAsync(shiftId);
  };

  const handleOpenDeleteShift = (shift?: ShiftRecord | null) => {
    setSelectedShiftToDelete(shift || null);
    setShiftIdToDelete(shift?.id || '');
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteShift = async () => {
    const targetId = (selectedShiftToDelete?.id || shiftIdToDelete || '').trim();
    if (!targetId) {
      ToastMsgs.error('Valid Shift ID is required to delete a shift');
      return;
    }
    await deleteShiftMutation.mutateAsync(targetId);
    setDeleteModalOpen(false);
    setSelectedShiftToDelete(null);
    setShiftIdToDelete('');
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `shift_token_${tokenResult?.shift?.id?.slice(0, 8) || 'active'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shifts = canViewSelf ? (shiftsData?.items || []) : [];
  const hasActiveShift = Boolean(activeShift && activeShift.status === 'active');

  const shiftColumns: TableColumn<ShiftRecord>[] = [
    {
      key: 'user_id',
      label: 'Shift / User',
      render: (_, s) => {
        const isAdminIssued = s.created_by == null || Number(s.created_by) !== Number(s.user_id);
        return (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={600} sx={{ color: '#F8FAFC' }}>
                {s.user_name || userMap.get(Number(s.user_id))?.name || s.user_email?.split('@')[0] || `User #${s.user_id}`} (#{s.user_id})
              </Typography>
              <Chip
                size="small"
                label={isAdminIssued ? (s.created_by ? `Assigned by ${getUserLabel(s.created_by)}` : 'Admin-Assigned') : 'Self-Created'}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: isAdminIssued ? 'rgba(250, 204, 21, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                  color: isAdminIssued ? '#FACC15' : '#38BDF8',
                }}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
              ID: {s?.id || 'N/A'}
            </Typography>
          </Box>
        );
      },
    },
    {
      key: 'device_id',
      label: 'Device ID',
      render: (_, s) => (
        <Typography variant="body2" sx={{ color: '#E2E8F0', fontFamily: 'monospace' }}>
          {s.device_id || 'DEFAULT'}
        </Typography>
      ),
    },
    {
      key: 'key_id',
      label: 'Key ID',
      render: (_, s) => (
        <Typography variant="caption" sx={{ color: '#38BDF8', fontFamily: 'monospace' }}>
          {s.key_id ? String(s.key_id).slice(0, 10) : 'N/A'}
        </Typography>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, s) => (
        <Chip
          label={String(s.status || '').toUpperCase()}
          size="small"
          color={s.status === 'active' ? 'success' : 'default'}
          sx={{ fontWeight: 700, fontSize: 11 }}
        />
      ),
    },
    {
      key: 'started_at',
      label: 'Timing',
      render: (_, s) => (
        <Box>
          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
            Start: {s.started_at ? new Date(s.started_at).toLocaleTimeString() : 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
            End: {s.ended_at ? new Date(s.ended_at).toLocaleTimeString() : 'In Progress'}
          </Typography>
        </Box>
      ),
    },
  ];

  const shiftActions: TableAction<ShiftRecord>[] = [
    ...(canCheckoutShift
      ? [
        {
          label: 'Checkout',
          variant: 'error' as const,
          disabled: (s: ShiftRecord) => s.status !== 'active',
          onClick: (s: ShiftRecord) => handleCheckout(s.id),
          render: (s: ShiftRecord) =>
            s.status === 'active' ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => handleCheckout(s.id)}
                sx={{ py: 0.25, px: 1, fontSize: 11 }}
              >
                Checkout
              </Button>
            ) : null,
        },
      ]
      : []),
    {
      label: 'Delete',
      variant: 'error' as const,
      disabled: (s: ShiftRecord) => !canDeleteShiftRecord(s),
      onClick: (s: ShiftRecord) => handleOpenDeleteShift(s),
      render: (s: ShiftRecord) => {
        const allowed = canDeleteShiftRecord(s);
        const lockReason = !canDeleteOwnShift
          ? "Requires 'shifts.delete' permission (Admin can grant this in Admin Console)"
          : 'Cannot delete: normal users can only delete shifts they created themselves (not shifts created by Admin or another user)';
        return (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
            disabled={!allowed || deleteShiftMutation.isPending}
            onClick={() => handleOpenDeleteShift(s)}
            title={allowed ? 'Permanently delete this shift and its scan logs' : lockReason}
            sx={{ py: 0.25, px: 1, fontSize: 11 }}
          >
            {allowed ? 'Delete' : !canDeleteOwnShift ? 'Delete 🔒' : 'Admin-Created 🔒'}
          </Button>
        );
      },
    },
  ];

  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: 1400, mx: 'auto', p: { xs: 0.5, sm: 2 }, overflowX: 'hidden' }}>
      {/* Top Banner */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              color: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
            }}
          >
            <ShiftIcon sx={{ color: '#FACC15', fontSize: { xs: 28, sm: 36 } }} />
            Work Shifts & Scanner Sessions
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Manage active warehouse shifts, issue scoped RS256 shift tokens, and embed offline rules for Android scanners.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
          {hasActiveShift ? (
            <>
              {canCreateShift && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ReissueIcon />}
                  onClick={() => setReissueModalOpen(true)}
                  disabled={reissueMutation.isPending}
                  sx={{
                    borderColor: 'rgba(234, 179, 8, 0.4)',
                    color: '#FACC15',
                    '&:hover': { borderColor: '#FACC15', bgcolor: 'rgba(234, 179, 8, 0.1)' },
                  }}
                >
                  Reissue Token (QR & Raw)
                </Button>
              )}
              {canCheckoutShift && (
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  startIcon={<StopIcon />}
                  onClick={() => handleCheckout(activeShift?.id)}
                  disabled={checkoutMutation.isPending}
                >
                  Checkout & End Shift
                </Button>
              )}
              {canDeleteShiftRecord(activeShift) && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleOpenDeleteShift(activeShift)}
                  disabled={deleteShiftMutation.isPending}
                >
                  Delete Active Shift
                </Button>
              )}
            </>
          ) : (
            <>
              {isAdmin && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ReissueIcon />}
                  onClick={() => setReissueModalOpen(true)}
                  sx={{ borderColor: '#334155', color: '#FACC15' }}
                >
                  Admin Reissue Worker Shift
                </Button>
              )}
              {canCreateShift && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<StartIcon />}
                  onClick={() => setStartModalOpen(true)}
                  sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
                >
                  Start New Shift
                </Button>
              )}
            </>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              if (!canDeleteOwnShift) {
                ToastMsgs.error("Requires 'shifts.delete' permission to delete shifts");
                return;
              }
              handleOpenDeleteShift(null);
            }}
            disabled={!canDeleteOwnShift || deleteShiftMutation.isPending}
            title={
              canDeleteAnyShift
                ? 'Admin: Delete any shift by valid UUID'
                : canDeleteOwnShift
                  ? 'Delete your own self-created shift'
                  : "Requires 'shifts.delete' permission"
            }
            sx={{ borderColor: 'rgba(239, 68, 68, 0.45)', color: '#F87171' }}
          >
            {canDeleteAnyShift ? 'Delete Shift by ID' : canDeleteOwnShift ? 'Delete Own Shift' : 'Delete Shift 🔒'}
          </Button>
        </Stack>
      </Box>

      {/* Active Shift Card */}
      {isLoadingActive ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : hasActiveShift ? (
        <Card
          sx={{
            mb: 4,
            bgcolor: '#0B132B',
            border: '1px solid rgba(250, 204, 21, 0.4)',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(250, 204, 21, 0.08)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#10B981',
                    boxShadow: '0 0 12px #10B981',
                  }}
                />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#F8FAFC', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  CURRENT ACTIVE SHIFT
                </Typography>
                <Chip label="ACTIVE SESSION" color="success" size="small" sx={{ fontWeight: 700 }} />
              </Box>

              <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                Shift ID: {activeShift?.id}
              </Typography>
            </Box>

            <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-between">
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Operator
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#F8FAFC' }}>
                    {user?.name || user?.email} (ID #{activeShift?.user_id})
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Scanner Device ID
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#38BDF8', fontFamily: 'monospace' }}>
                    {activeShift?.device_id || 'DEFAULT_SCANNER'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Signing Key
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#A7F3D0', fontFamily: 'monospace' }}>
                    {activeShift?.key_id ? `${activeShift.key_id.slice(0, 8)}...` : 'Active Default'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Session Started
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#F8FAFC' }}>
                    {activeShift?.started_at ? new Date(activeShift.started_at).toLocaleTimeString() : 'N/A'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: 4, bgcolor: '#0B132B', border: '1px solid #1E293B', color: '#94A3B8' }}>
          No active work shift currently open for your account. Start a new shift to generate an authorization QR token for your scanner.
        </Alert>
      )}

      {!canViewSelf && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You do not have permission to view work shifts (requires 'shifts.view' permission).
        </Alert>
      )}

      {/* Shifts History Table */}
      <Table<ShiftRecord>
        columns={shiftColumns}
        data={shifts}
        rowKey="id"
        isLoading={isLoadingShifts}
        emptyMessage={canViewSelf ? "No shift records found." : "No shifts accessible (shifts.view disabled)."}
        actions={shiftActions}
        showSearch={true}
        searchPlaceholder="Search shifts by user or device..."
        showPagination={true}
        itemsPerPage={10}
      />

      {/* START SHIFT MODAL */}
      <Dialog open={startModalOpen} onClose={() => setStartModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Start New Work Shift</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Initiates an authenticated session and issues a scoped <code>shift_token</code> JWT scannable from the screen.
          </Typography>

          <TextField
            select
            fullWidth
            size="small"
            label="Select Operator / User"
            value={startForm.target_user_id || String(currentUserId || '')}
            onChange={(e) => {
              const selectedUid = e.target.value;
              const userKey = keys.find(
                (k) => k.status === 'active' && Number(k.created_by) === Number(selectedUid)
              );
              setStartForm({
                ...startForm,
                target_user_id: selectedUid,
                key_id: userKey ? userKey.id : startForm.key_id,
              });
            }}
            disabled={!isAdmin && userOptions.length <= 1}
            helperText={
              isAdmin
                ? 'Select a user by name — automatically captures their User ID and matches their active signing key'
                : `Starting shift for your account (${user?.name || user?.email || 'Self'} — ID #${currentUserId})`
            }
          >
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>

          {/* Cryptographic Key Selection Section */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(7, 17, 29, 0.7)',
              border: '1px solid #1E293B',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                  🔑 Cryptographic Signing & Verification Key
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Select the RS256 key to bind to this shift (used to sign shift token & verify scans)
                </Typography>
              </Box>
              {startForm.strict_key && (
                <Chip
                  size="small"
                  label={startForm.strict_key_id ? 'Verification Key Locked' : 'Signing Key Locked on Phone'}
                  sx={{
                    bgcolor: 'rgba(234, 179, 8, 0.15)',
                    color: '#FACC15',
                    fontWeight: 700,
                    fontSize: 11,
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                  }}
                />
              )}
            </Box>

            <TextField
              select
              fullWidth
              size="small"
              label="Select Signing Key (key_id)"
              value={startForm.key_id}
              onChange={(e) => setStartForm({ ...startForm, key_id: e.target.value })}
              helperText={
                startForm.target_user_id
                  ? `RS256 key used to mint and sign this shift token (Filtered for user #${startForm.target_user_id})`
                  : "RS256 key used to mint and sign this shift token (or leave Auto-detect)"
              }
            >
              <MenuItem value="">
                <em>Default Primary Active Key (Auto-detect)</em>
              </MenuItem>
              {(() => {
                const uid = startForm.target_user_id ? Number(startForm.target_user_id) : (currentUserId ? Number(currentUserId) : null);
                const candidateKeys = keys.filter((k) => k.status === 'active');
                const isKeyAvailableForUser = (k: any, targetUid: number | null) => {
                  if (!targetUid) return true;
                  if (Number(k.created_by) === targetUid) return true;
                  if (Array.isArray(k.shared_with) && k.shared_with.some((su: any) => Number(su) === targetUid || Number(su?.user_id) === targetUid)) {
                    return true;
                  }
                  return false;
                };
                const matchingKeys = uid && isAdmin
                  ? candidateKeys.filter((k) => isKeyAvailableForUser(k, uid))
                  : candidateKeys;
                const keysToShow = matchingKeys.length > 0 ? matchingKeys : candidateKeys;
                return keysToShow.map((k) => {
                  const isOwned = uid != null && Number(k.created_by) === uid;
                  const isShared = uid != null && !isOwned && isKeyAvailableForUser(k, uid);
                  const isAdminFallback = isAdmin && uid != null && !isOwned && !isShared && matchingKeys.length === 0;
                  return (
                    <MenuItem key={k.id} value={k.id}>
                      🔑 {k.name} (kid: {k.kid}) — {isShared ? `🤝 Shared Key (Owner: ${getUserLabel(k.created_by)})` : `Owner: ${getUserLabel(k.created_by)}`}
                      {isAdminFallback ? ' • [ADMIN OVERRIDE]' : ''}
                    </MenuItem>
                  );
                });
              })()}
            </TextField>

            {/* Strict Crypto Key Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={startForm.strict_key}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setStartForm({
                      ...startForm,
                      strict_key: isChecked,
                      strict_key_id: isChecked ? (startForm.strict_key_id || startForm.key_id || '') : '',
                    });
                  }}
                  size="small"
                  sx={{ color: '#64748B', '&.Mui-checked': { color: '#FACC15' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                    🔒 Strictly Enforce Verification Key on Phone (<code>strict_key</code>)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                    If checked, mobile worker cannot switch keys on Android and is strictly locked to the key selected below. If unchecked, worker can select other keys on their phone.
                  </Typography>
                </Box>
              }
            />

            {/* Dedicated Dropdown: Select Strictly Enforced Verification Key on Phone */}
            {startForm.strict_key && (
              <Box sx={{ pl: 3.5, mt: -0.5 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Select Strictly Enforced Key on Phone (strict_key_id)"
                  value={startForm.strict_key_id}
                  onChange={(e) => setStartForm({ ...startForm, strict_key_id: e.target.value })}
                  helperText="Choose which verification key the Android scanner will be strictly locked to"
                  sx={{
                    bgcolor: 'rgba(234, 179, 8, 0.05)',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(234, 179, 8, 0.4)' },
                      '&:hover fieldset': { borderColor: '#FACC15' },
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Default to Shift Signing Key ({startForm.key_id ? 'Selected Key' : 'Primary Active Key'})</em>
                  </MenuItem>
                  {keys.filter((k) => k.status === 'active').map((k) => (
                    <MenuItem key={k.id} value={k.id}>
                      🔒 {k.name} (kid: {k.kid}) — Owner: {getUserLabel(k.created_by)}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                type="number"
                label="Custom Token / Shift Duration"
                value={startForm.duration_value}
                onChange={(e) =>
                  setStartForm({
                    ...startForm,
                    duration_value: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                inputProps={{ min: 1 }}
                sx={{ width: { xs: '100%', sm: '50%' } }}
                size="small"
                helperText="Enter any positive number"
              />
              <FormControl sx={{ width: { xs: '100%', sm: '50%' } }} size="small">
                <InputLabel>Duration Unit</InputLabel>
                <Select
                  value={startForm.duration_unit}
                  label="Duration Unit"
                  onChange={(e) =>
                    setStartForm({
                      ...startForm,
                      duration_unit: e.target.value as ShiftDurationUnit,
                    })
                  }
                >
                  <MenuItem value="seconds">Seconds</MenuItem>
                  <MenuItem value="minutes">Minutes</MenuItem>
                  <MenuItem value="hours">Hours</MenuItem>
                  <MenuItem value="days">Days</MenuItem>
                  <MenuItem value="weeks">Weeks</MenuItem>
                  <MenuItem value="months">Months</MenuItem>
                  <MenuItem value="years">Years</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {[
                { label: '60 Sec', val: 60, unit: 'seconds' as ShiftDurationUnit },
                { label: '30 Min', val: 30, unit: 'minutes' as ShiftDurationUnit },
                { label: '4 Hrs', val: 4, unit: 'hours' as ShiftDurationUnit },
                { label: '8 Hrs (Std)', val: 8, unit: 'hours' as ShiftDurationUnit },
                { label: '12 Hrs', val: 12, unit: 'hours' as ShiftDurationUnit },
                { label: '24 Hrs', val: 24, unit: 'hours' as ShiftDurationUnit },
                { label: '7 Days', val: 7, unit: 'days' as ShiftDurationUnit },
                { label: '1 Month', val: 1, unit: 'months' as ShiftDurationUnit },
                { label: '1 Year', val: 1, unit: 'years' as ShiftDurationUnit },
              ].map((preset) => {
                const isSelected =
                  Number(startForm.duration_value) === preset.val && startForm.duration_unit === preset.unit;
                return (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    size="small"
                    clickable
                    onClick={() =>
                      setStartForm({
                        ...startForm,
                        duration_value: preset.val,
                        duration_unit: preset.unit,
                      })
                    }
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                      color: isSelected ? '#10B981' : '#94A3B8',
                      border: isSelected ? '1px solid #10B981' : '1px solid #334155',
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          <TextField
            label="Scanner Device ID"
            value={startForm.device_id}
            onChange={(e) => setStartForm({ ...startForm, device_id: e.target.value })}
            fullWidth
            size="small"
          />

          {/* Inventory Verification Rules Selection Section */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(7, 17, 29, 0.7)',
              border: '1px solid #1E293B',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mt: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                  📋 Select Inventory Rules to Attach to Shift
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Choose which rules to enforce for this shift session ({selectedRuleIds.filter((id) => eligibleRules.some((r) => r.id === id)).length} of {eligibleRules.length} eligible selected)
                </Typography>
              </Box>
              {eligibleRules.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const eligibleIds = eligibleRules.map((r) => String(r.id));
                    const allEligibleSelected = eligibleIds.every((id) => selectedRuleIds.includes(id));
                    if (allEligibleSelected) {
                      const next = selectedRuleIds.filter((id) => !eligibleIds.includes(id));
                      setSelectedRuleIds(next);
                      setStartForm({ ...startForm, include_rules: next.length > 0 });
                    } else {
                      const combined = Array.from(new Set([...selectedRuleIds, ...eligibleIds]));
                      setSelectedRuleIds(combined);
                      setStartForm({ ...startForm, include_rules: true });
                    }
                  }}
                  sx={{
                    fontSize: '11px',
                    borderColor: '#38BDF8',
                    color: '#38BDF8',
                    py: 0.25,
                    px: 1,
                    textTransform: 'none',
                  }}
                >
                  {eligibleRules.map((r) => String(r.id)).every((id) => selectedRuleIds.includes(id)) ? 'Clear Selection' : 'Select All Eligible'}
                </Button>
              )}
            </Box>

            {eligibleRules.length === 0 ? (
              <Typography variant="caption" sx={{ color: '#64748B', fontStyle: 'italic', display: 'block' }}>
                No eligible inventory rules found for this operator ({getUserLabel(selectedOperatorId)}) and verification key context. Rules belonging to other workers or other keys are hidden.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                {eligibleRules.map((rule: any) => {
                  const ruleIdStr = String(rule.id);
                  const isChecked = selectedRuleIds.includes(ruleIdStr);
                  return (
                    <Box
                      key={ruleIdStr}
                      onClick={() => {
                        const next = isChecked
                          ? selectedRuleIds.filter((id) => id !== ruleIdStr)
                          : [...selectedRuleIds, ruleIdStr];
                        setSelectedRuleIds(next);
                        setStartForm({ ...startForm, include_rules: next.length > 0 });
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: isChecked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                        border: `1px solid ${isChecked ? '#38BDF8' : '#1E293B'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.12)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={isChecked}
                          size="small"
                          sx={{ p: 0.5, color: '#64748B', '&.Mui-checked': { color: '#38BDF8' } }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600, fontSize: '13px' }}>
                            {rule.rule_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>
                            {rule.matching_claim_key} == "{rule.expected_value}"
                          </Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          size="small"
                          label={rule.user_id ? `👤 ${getUserLabel(rule.user_id)}` : '🌐 Universal'}
                          sx={{
                            fontSize: '10px',
                            height: 20,
                            bgcolor: rule.user_id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: rule.user_id ? '#38BDF8' : '#94A3B8',
                            border: `1px solid ${rule.user_id ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                          }}
                        />
                        <Chip
                          size="small"
                          label={rule.key_id ? `🔑 ${getKeyLabel(rule.key_id)}` : '🌐 Global Key'}
                          sx={{
                            fontSize: '10px',
                            height: 20,
                            maxWidth: 160,
                            bgcolor: rule.key_id ? 'rgba(234, 179, 8, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: rule.key_id ? '#FACC15' : '#94A3B8',
                            border: `1px solid ${rule.key_id ? 'rgba(234, 179, 8, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                          }}
                        />
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}

            {/* Rule Match Mode: ALL (AND) vs ANY (OR) */}
            {selectedRuleIds.length > 1 && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid #334155',
                }}
              >
                <Typography variant="caption" sx={{ color: '#F8FAFC', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  ⚙️ Multiple Rules Evaluation Logic ({selectedRuleIds.length} rules selected):
                </Typography>
                <RadioGroup
                  row
                  value={startForm.rule_match_mode}
                  onChange={(e) => setStartForm({ ...startForm, rule_match_mode: e.target.value as 'all' | 'any' })}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio size="small" sx={{ color: '#64748B', '&.Mui-checked': { color: '#38BDF8' } }} />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 600 }}>
                          Require ALL Rules (AND)
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '11px' }}>
                          Tag must satisfy every selected rule
                        </Typography>
                      </Box>
                    }
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel
                    value="any"
                    control={<Radio size="small" sx={{ color: '#64748B', '&.Mui-checked': { color: '#FACC15' } }} />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 600 }}>
                          Require ANY Rule (OR)
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '11px' }}>
                          Tag passes if at least one rule matches
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </Box>
            )}

            {/* Strict Inventory Rules Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={startForm.strict_rules}
                  onChange={(e) => setStartForm({ ...startForm, strict_rules: e.target.checked })}
                  size="small"
                  sx={{ color: '#64748B', '&.Mui-checked': { color: '#FACC15' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                    🔒 Strictly Enforce Selected Rules on Phone (<code>strict_rules</code>)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                    If checked, worker can ONLY scan using these rules. Rule selection is locked on the Android app. If unchecked, worker can select other rules on their phone.
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={startForm.qr_only}
                  onChange={(e) => setStartForm({ ...startForm, qr_only: e.target.checked })}
                  size="small"
                  sx={{ color: '#64748B', '&.Mui-checked': { color: '#F59E0B' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                    Direct Scannable QR Image (<code>qr_only</code>)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                    If checked (true), returns the QR code image (PNG) of the shift token directly to scan on screen. If false (unchecked), returns raw JSON data.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setStartModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleStartSubmit}
            disabled={startShiftMutation.isPending}
            sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
          >
            Start Shift & Render QR
          </Button>
        </DialogActions>
      </Dialog>

      {/* REISSUE SHIFT MODAL */}
      <Dialog open={reissueModalOpen} onClose={() => setReissueModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>
          Reissue Active Shift Token (QR & Raw)
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Re-mints a fresh <code>shift_token</code> JWT for your currently active session, available both as a scannable on-screen QR code and raw token string.
          </Typography>

          <TextField
            select
            label="Select Operator / User"
            value={reissueForm.target_user_id || String(currentUserId || '')}
            onChange={(e) => setReissueForm({ ...reissueForm, target_user_id: e.target.value })}
            fullWidth
            size="small"
            disabled={!isAdmin && userOptions.length <= 1}
            helperText={
              isAdmin
                ? 'Select a user by name to reissue their active shift token (captures User ID automatically)'
                : `Reissuing active shift token for ${user?.name || user?.email || 'Self'} (ID #${currentUserId})`
            }
          >
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>

          {/* Reissue Parameter Checkboxes */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(7, 17, 29, 0.7)',
              border: '1px solid #1E293B',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mt: 1,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={reissueForm.include_rules}
                  onChange={(e) => setReissueForm({ ...reissueForm, include_rules: e.target.checked })}
                  size="small"
                  sx={{ color: '#64748B', '&.Mui-checked': { color: '#38BDF8' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                    Embed Active Inventory Rules (<code>include_rules</code>)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                    If checked (true), embeds active inventory rules into the reissued shift token. If false (unchecked), omits rules for a lighter token.
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={reissueForm.qr_only}
                  onChange={(e) => setReissueForm({ ...reissueForm, qr_only: e.target.checked })}
                  size="small"
                  sx={{ color: '#64748B', '&.Mui-checked': { color: '#F59E0B' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                    Direct Scannable QR Image (<code>qr_only</code>)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                    If checked (true), returns the QR code image (PNG) of the shift token directly to scan on screen. If false (unchecked), returns raw JSON data.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setReissueModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReissueSubmit}
            disabled={reissueMutation.isPending}
            sx={{ bgcolor: '#FACC15', color: '#0F172A', fontWeight: 700, '&:hover': { bgcolor: '#EAB308' } }}
          >
            Reissue Token
          </Button>
        </DialogActions>
      </Dialog>

      {/* SHIFT TOKEN MODAL: CONDITIONAL QR & RAW FORM */}
      <Dialog open={tokenModalOpen} onClose={() => setTokenModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {resultMode.qr_only ? <QrCodeIcon sx={{ color: '#FACC15' }} /> : <ShiftIcon sx={{ color: '#38BDF8' }} />}
          {resultMode.qr_only ? 'Shift Authorization QR Code' : 'Shift Authorization Token Credential'}
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: '#1E293B', bgcolor: '#0B132B', px: 3 }}>
          <Tabs value={tokenModalTab} onChange={(_, val) => setTokenModalTab(val)}>
            {resultMode.qr_only && <Tab label="Scannable QR Code" value={0} />}
            <Tab label="Raw JWT Token String" value={1} />
          </Tabs>
        </Box>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 3 }}>
          {tokenModalTab === 0 && resultMode.qr_only && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8', textAlign: 'center' }}>
                Point the Android scanner camera or mobile barcode reader directly at this QR code to login.
              </Typography>

              {qrCodeDataUrl ? (
                <Paper sx={{ p: 2, bgcolor: '#FFFFFF', borderRadius: 3, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
                  <img
                    src={qrCodeDataUrl}
                    alt="Shift Token QR"
                    style={{ display: 'block', width: 240, height: 240 }}
                  />
                </Paper>
              ) : (
                <CircularProgress />
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadQR}
                  sx={{ bgcolor: '#38BDF8', color: '#07111D', fontWeight: 700 }}
                >
                  Download QR Image (PNG)
                </Button>
                {tokenResult?.shift_token ? (
                  <Button
                    variant="outlined"
                    startIcon={<CopyIcon />}
                    onClick={() => handleCopy(tokenResult.shift_token || '', 'Shift Token')}
                    sx={{ color: '#FACC15', borderColor: '#FACC15' }}
                  >
                    Copy Token String
                  </Button>
                ) : null}
              </Stack>
            </Box>
          )}

          {(tokenModalTab === 1 || !resultMode.qr_only) && (
            <Stack spacing={2.5}>
              {/* Rules Status Banner */}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: resultMode.include_rules ? 'rgba(56, 189, 248, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                  border: `1px solid ${resultMode.include_rules ? 'rgba(56, 189, 248, 0.3)' : 'rgba(100, 116, 139, 0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2" sx={{ color: resultMode.include_rules ? '#38BDF8' : '#94A3B8', fontWeight: 600 }}>
                  Active Inventory Rules: {resultMode.include_rules ? 'Embedded in token payload' : 'Omitted (Minted without rules)'}
                </Typography>
                <Chip
                  size="small"
                  label={resultMode.include_rules ? 'Rules Included' : 'No Rules'}
                  color={resultMode.include_rules ? 'info' : 'default'}
                />
              </Box>

              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Raw RS256 Shift JWT token string. Can be pasted into headers or configuration payloads:
              </Typography>

              <Paper
                sx={{
                  p: 2,
                  bgcolor: '#07111D',
                  border: '1px solid #1E293B',
                  borderRadius: 2,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    wordBreak: 'break-all',
                    color: '#A7F3D0',
                    m: 0,
                  }}
                >
                  {tokenResult?.shift_token || (tokenResult?.isQrBlob ? '(Token issued in direct QR PNG mode)' : 'No token string')}
                </Typography>
              </Paper>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  Shift ID: {tokenResult?.shift?.id || 'Active'}
                </Typography>
                {tokenResult?.shift_token && (
                  <Button
                    variant="outlined"
                    startIcon={<CopyIcon />}
                    onClick={() => handleCopy(tokenResult.shift_token || '', 'Raw JWT Token')}
                    sx={{ color: '#38BDF8', borderColor: '#38BDF8' }}
                  >
                    Copy Raw Token
                  </Button>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setTokenModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Shift Modal */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon />
          {selectedShiftToDelete ? 'Confirm Shift Deletion' : 'Delete Shift by ID'}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="warning" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {canDeleteAnyShift
              ? 'Admin / Supervisor mode: You can permanently delete any shift by its valid UUID. Active shift tokens for that shift will be immediately invalidated in Redis.'
              : 'Normal user mode (shifts.delete): You can only delete shifts that belong to you and that you personally started (shifts created for you by an Admin cannot be deleted).'}
          </Alert>

          {selectedShiftToDelete ? (
            <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                Operator: {selectedShiftToDelete.user_name || selectedShiftToDelete.user_email || `User #${selectedShiftToDelete.user_id}`}
              </Typography>
              <Typography variant="caption" sx={{ color: '#38BDF8', fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                Shift UUID: {selectedShiftToDelete.id}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
                Status: {String(selectedShiftToDelete.status || '').toUpperCase()} | Device: {selectedShiftToDelete.device_id || 'DEFAULT'}
              </Typography>
            </Paper>
          ) : (
            <>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel>Select From Loaded Shifts (Optional)</InputLabel>
                <Select
                  value={shiftIdToDelete}
                  label="Select From Loaded Shifts (Optional)"
                  onChange={(e) => setShiftIdToDelete(String(e.target.value))}
                >
                  <MenuItem value="">
                    <em>-- Paste UUID below or pick a shift --</em>
                  </MenuItem>
                  {shifts
                    .filter((s) => canDeleteShiftRecord(s))
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.user_name || `User #${s.user_id}`} — {s.id.slice(0, 8)}... ({s.status.toUpperCase()})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <TextField
                label="Shift UUID to Delete"
                value={shiftIdToDelete}
                onChange={(e) => setShiftIdToDelete(e.target.value)}
                placeholder="e.g. 50678322-ef9f-4512-9c1c-4d657da52d85"
                fullWidth
                inputProps={{ style: { fontFamily: 'monospace' } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleConfirmDeleteShift}
            disabled={deleteShiftMutation.isPending || !(selectedShiftToDelete?.id || shiftIdToDelete.trim())}
          >
            {deleteShiftMutation.isPending ? <CircularProgress size={20} /> : 'Permanently Delete Shift'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ShiftsPage;
