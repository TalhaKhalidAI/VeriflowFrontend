// src/pages/Keys/index.tsx
import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  Chip,
  IconButton,
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
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import QRCode from 'qrcode';
import {
  AddRounded as AddIcon,
  AutorenewRounded as RotateIcon,
  BlockRounded as RevokeIcon,
  ContentCopyRounded as CopyIcon,
  QrCode2Rounded as QrCodeIcon,
  VpnKeyRounded as KeyIcon,
  VisibilityRounded as VisibilityIcon,
  DownloadRounded as DownloadIcon,
  CheckCircleOutlineRounded as VerifyIcon,
  SendRounded as IssueIcon,
  SecurityRounded as SecurityIcon,
  DeleteRounded as DeleteIcon,
  ShareRounded as ShareIcon,
} from '@mui/icons-material';
import {
  useKeysQuery,
  useJWKSQuery,
  useCreateKeyMutation,
  useRotateKeyMutation,
  useRevokeKeyMutation,
  useDeleteKeyMutation,
  useExportPrivateKeyMutation,
  useIssueTokenMutation,
  useVerifyTokenMutation,
  useGenerateTagQRMutation,
} from './query';
import { useMFAStatusQuery } from '../Security/query';
import { useAdminUsersQuery } from '../Admin/query';
import type { KeyRecord, VerifyTokenResponse } from './types';
import { ToastMsgs } from '../../api/toastUtils';
import { http } from '../../api/http/https';
import { useAuthStore } from '../../store/authStore';
import { OtpBoxesInput } from '../../components/OtpModal';
import { Table, type TableColumn, type TableAction } from '../../components/Table';
import { CloseRounded as CloseIcon } from '@mui/icons-material';

export function KeysPage() {
  const user = useAuthStore((state) => state.user);
  const currentUserId = Number(user?.id);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  const canDeleteAnyKey = isAdmin || Boolean(user?.permissions?.['keys.delete.any']);
  const canDeleteOwnKey = canDeleteAnyKey || Boolean(user?.permissions?.['keys.delete']);
  const canViewKeys = isAdmin || Boolean(user?.permissions?.['keys.view']) || canDeleteOwnKey;
  const canCreateKey = isAdmin || Boolean(user?.permissions?.['keys.create']);
  const canRotateKey = isAdmin || (Boolean(user?.permissions?.['keys.create']) && Boolean(user?.permissions?.['keys.update']));
  const canRevokeKey = isAdmin || Boolean(user?.permissions?.['keys.revoke']);
  const canShareKey = isAdmin || Boolean(user?.permissions?.['keys.share']) || canCreateKey;
  const canIssueToken = isAdmin || Boolean(user?.permissions?.['keys.create']);
  const canCreateTags = isAdmin || Boolean(user?.permissions?.['tags.create']);

  const isKeySelfCreated = (k?: KeyRecord | null) =>
    Boolean(k && Number(k.created_by) === currentUserId && k.issued_by != null && Number(k.issued_by) === currentUserId);

  const canDeleteKeyRecord = (k?: KeyRecord | null) =>
    Boolean(k && (canDeleteAnyKey || (canDeleteOwnKey && isKeySelfCreated(k))));

  const { data: keysData, isLoading } = useKeysQuery();
  const { data: jwksData } = useJWKSQuery();
  const { data: mfaStatus } = useMFAStatusQuery();
  const { data: usersData = [] } = useAdminUsersQuery({ show_permissions: false, enabled: isAdmin });
  const isMFAEnabled = Boolean(user?.mfa_enabled || mfaStatus?.mfa_enabled);
  const activeMFAMethod = user?.mfa_method || mfaStatus?.mfa_method || "totp";

  // Build user options list (ensuring current logged-in user is always present)
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
    return Array.from(map.values());
  }, [usersData, currentUserId, user]);

  const userMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; email: string; role: string }>();
    userOptions.forEach((u) => m.set(u.id, u));
    return m;
  }, [userOptions]);

  const getUserLabel = (uid?: number | null) => {
    if (uid == null) return 'System / Admin';
    const info = userMap.get(Number(uid));
    return info ? `${info.name} (#${info.id})` : `User #${uid}`;
  };

  const createKeyMutation = useCreateKeyMutation();
  const rotateKeyMutation = useRotateKeyMutation();
  const revokeKeyMutation = useRevokeKeyMutation();
  const deleteKeyMutation = useDeleteKeyMutation();
  const exportPrivateMutation = useExportPrivateKeyMutation();
  const issueTokenMutation = useIssueTokenMutation();
  const verifyTokenMutation = useVerifyTokenMutation();
  const generateTagMutation = useGenerateTagQRMutation();

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rotateModalOpen, setRotateModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [selectedKeyForRevoke, setSelectedKeyForRevoke] = useState<KeyRecord | null>(null);
  const [deleteKeyModalOpen, setDeleteKeyModalOpen] = useState(false);
  const [selectedKeyForDelete, setSelectedKeyForDelete] = useState<KeyRecord | null>(null);

  // Share Key Modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedKeyForShare, setSelectedKeyForShare] = useState<KeyRecord | null>(null);
  const [keyShares, setKeyShares] = useState<any[]>([]);
  const [selectedShareUserId, setSelectedShareUserId] = useState<string>('');
  const [canSignTagsShare, setCanSignTagsShare] = useState<boolean>(true);
  const [canStartShiftsShare, setCanStartShiftsShare] = useState<boolean>(true);
  const [isLoadingShares, setIsLoadingShares] = useState<boolean>(false);
  const [isSubmittingShare, setIsSubmittingShare] = useState<boolean>(false);
  const [userSharedKeys, setUserSharedKeys] = useState<Record<number, string[]>>({});

  const [pemModalOpen, setPemModalOpen] = useState(false);
  const [selectedKeyForPem, setSelectedKeyForPem] = useState<KeyRecord | null>(null);
  const [pemShowQr, setPemShowQr] = useState(false);
  const [pemQrPayloadType, setPemQrPayloadType] = useState<'base64' | 'pem' | 'json'>('base64');
  const [pemQrDataUrl, setPemQrDataUrl] = useState<string | null>(null);

  // Strip PEM headers, literal \n/\r escapes, and all line breaks so strict Base64/DER parsers never break
  const extractCleanBase64Key = (pem?: string | null): string => {
    if (!pem) return '';
    return pem
      .replace(/\\r/g, '')
      .replace(/\\n/g, '')
      .replace(/-----BEGIN [A-Z0-9 ]+-----/gi, '')
      .replace(/-----END [A-Z0-9 ]+-----/gi, '')
      .replace(/[\r\n\s]+/g, '')
      .trim();
  };

  // Normalize standard PEM without trailing newline or accidental escaped \n
  const normalizePemKey = (pem?: string | null): string => {
    if (!pem) return '';
    return pem
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  useEffect(() => {
    if (!pemModalOpen || !selectedKeyForPem?.public_key || !pemShowQr) {
      setPemQrDataUrl(null);
      return;
    }
    const cleanBase64 = extractCleanBase64Key(selectedKeyForPem.public_key);
    const cleanPem = normalizePemKey(selectedKeyForPem.public_key);

    const qrContent =
      pemQrPayloadType === 'base64'
        ? cleanBase64
        : pemQrPayloadType === 'json'
        ? JSON.stringify({
            key_id: selectedKeyForPem.id,
            kid: selectedKeyForPem.kid,
            name: selectedKeyForPem.name,
            alg: selectedKeyForPem.algorithm || 'RS256',
            public_key: cleanBase64,
          })
        : cleanPem;

    let cancelled = false;
    QRCode.toDataURL(qrContent, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setPemQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate public key QR code', err);
        if (!cancelled) setPemQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pemModalOpen, selectedKeyForPem, pemShowQr, pemQrPayloadType]);

  const handleDownloadPublicKeyQR = () => {
    if (!pemQrDataUrl || !selectedKeyForPem) return;
    const a = document.createElement('a');
    a.href = pemQrDataUrl;
    a.download = `public_key_${selectedKeyForPem.kid || 'rsa'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [privatePemModalOpen, setPrivatePemModalOpen] = useState(false);
  const [exportAuthModalOpen, setExportAuthModalOpen] = useState(false);
  const [targetKeyForExport, setTargetKeyForExport] = useState<KeyRecord | null>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [exportOtp, setExportOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [privatePemResult, setPrivatePemResult] = useState<string | null>(null);
  const [privateShowQr, setPrivateShowQr] = useState(false);
  const [privateQrPayloadType, setPrivateQrPayloadType] = useState<'base64' | 'pem' | 'json'>('base64');
  const [privateQrDataUrl, setPrivateQrDataUrl] = useState<string | null>(null);
  const [privateQrError, setPrivateQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!privatePemModalOpen || !privatePemResult || !privateShowQr) {
      setPrivateQrDataUrl(null);
      setPrivateQrError(null);
      return;
    }
    const cleanBase64 = extractCleanBase64Key(privatePemResult);
    const cleanPem = normalizePemKey(privatePemResult);

    const qrContent =
      privateQrPayloadType === 'base64'
        ? cleanBase64
        : privateQrPayloadType === 'json'
        ? JSON.stringify({
            key_id: targetKeyForExport?.id,
            kid: targetKeyForExport?.kid,
            name: targetKeyForExport?.name,
            alg: targetKeyForExport?.algorithm || 'RS256',
            private_key: cleanBase64,
          })
        : cleanPem;

    let cancelled = false;
    setPrivateQrError(null);
    QRCode.toDataURL(qrContent, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'L',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setPrivateQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate private key QR code', err);
        if (!cancelled) {
          setPrivateQrDataUrl(null);
          setPrivateQrError(
            'Key payload exceeds standard QR code capacity (e.g. 4096-bit key). Switch to "Clean Base64 (No \\n)" or copy the key text directly.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [privatePemModalOpen, privatePemResult, privateShowQr, privateQrPayloadType, targetKeyForExport]);

  const handleDownloadPrivateKeyQR = () => {
    if (!privateQrDataUrl) return;
    const a = document.createElement('a');
    a.href = privateQrDataUrl;
    a.download = `private_key_${targetKeyForExport?.kid || 'rsa'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [jwksModalOpen, setJwksModalOpen] = useState(false);
  const [issueTokenModalOpen, setIssueTokenModalOpen] = useState(false);
  const [issuedTokenResult, setIssuedTokenResult] = useState<string | null>(null);

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyTokenResponse | null>(null);

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagTab, setTagTab] = useState<number>(0);
  const [tagVerifyInput, setTagVerifyInput] = useState('');
  const [tagVerifyResult, setTagVerifyResult] = useState<VerifyTokenResponse | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({ name: '', kid: '', key_size: 2048, target_user_id: '' });
  const [rotateForm, setRotateForm] = useState({ name: '', key_size: 2048, target_user_id: '' });
  const [revokeReason, setRevokeReason] = useState('');

  const [issueForm, setIssueForm] = useState({
    key_id: '',
    target_user_id: '',
    expires_in_value: 8,
    expires_in_unit: 'hours' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years',
    extra_claims: '{\n  "work_station": "BAY-4"\n}',
  });

  const [tagForm, setTagForm] = useState({
    sku: 'SKU-99201',
    batch: 'BATCH-2026-X',
    warehouse: 'WH-CENTRAL-01',
    key_id: '',
    target_user_id: '',
    duration: 30,
    unit: 'days' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years',
    qr_only: false,
  });
  const [tagPayloadMode, setTagPayloadMode] = useState<'form' | 'json'>('form');
  const [excludeFormData, setExcludeFormData] = useState(false);
  const [tagRawJson, setTagRawJson] = useState<string>(
    JSON.stringify(
      {
        sku: 'SKU-99201',
        batch_no: 'BATCH-2026-X',
        warehouse_id: 'WH-CENTRAL-01',
        product_name: 'Industrial Sensor Unit',
        hazard_class: 'NON-HAZARDOUS',
        inspection_status: 'passed',
      },
      null,
      2
    )
  );
  const [tagJsonError, setTagJsonError] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    ToastMsgs.info(`${label} copied to clipboard!`);
  };

  const handleDownloadQR = (base64Url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = base64Url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCreateSubmit = async () => {
    if (!createForm.name.trim()) {
      ToastMsgs.error('Key Name is required');
      return;
    }
    await createKeyMutation.mutateAsync({
      name: createForm.name,
      kid: createForm.kid.trim() || undefined,
      key_size: createForm.key_size,
      target_user_id: createForm.target_user_id ? Number(createForm.target_user_id) : undefined,
    });
    setCreateModalOpen(false);
    setCreateForm({ name: '', kid: '', key_size: 2048, target_user_id: '' });
  };

  const handleRotateSubmit = async () => {
    if (!rotateForm.name.trim()) {
      ToastMsgs.error('Rotation Key Name is required');
      return;
    }
    await rotateKeyMutation.mutateAsync({
      name: rotateForm.name,
      key_size: rotateForm.key_size,
      target_user_id: rotateForm.target_user_id ? Number(rotateForm.target_user_id) : undefined,
    });
    setRotateModalOpen(false);
    setRotateForm({ name: '', key_size: 2048, target_user_id: '' });
  };

  const handleRevokeSubmit = async () => {
    if (!selectedKeyForRevoke || !revokeReason.trim()) {
      ToastMsgs.error('Revocation reason is required');
      return;
    }
    await revokeKeyMutation.mutateAsync({
      keyId: selectedKeyForRevoke.id,
      payload: { reason: revokeReason },
    });
    setRevokeModalOpen(false);
    setSelectedKeyForRevoke(null);
    setRevokeReason('');
  };

  const handleConfirmDeleteKey = async () => {
    if (!selectedKeyForDelete) return;
    await deleteKeyMutation.mutateAsync({
      keyId: selectedKeyForDelete.id,
      force: canDeleteAnyKey,
    });
    setDeleteKeyModalOpen(false);
    setSelectedKeyForDelete(null);
  };

  const handleOpenExportAuth = (k: KeyRecord) => {
    setTargetKeyForExport(k);
    setExportPassword("");
    setExportOtp("");
    setExportAuthModalOpen(true);
  };

  const handleConfirmExport = async () => {
    if (!targetKeyForExport || !exportPassword) return;
    try {
      const res = await exportPrivateMutation.mutateAsync({
        keyId: targetKeyForExport.id,
        password: exportPassword,
        otp: exportOtp.trim() || undefined,
      });
      setPrivatePemResult(res.private_key);
      setExportAuthModalOpen(false);
      setPrivatePemModalOpen(true);
    } catch {
      // toast shown in query
    }
  };

  const handleIssueToken = async () => {
    let claims = {};
    try {
      if (issueForm.extra_claims.trim()) {
        claims = JSON.parse(issueForm.extra_claims);
      }
    } catch {
      ToastMsgs.error('Extra claims must be valid JSON');
      return;
    }

    const durationVal = Math.max(1, Number(issueForm.expires_in_value) || 1);
    const res = await issueTokenMutation.mutateAsync({
      key_id: issueForm.key_id || undefined,
      target_user_id: issueForm.target_user_id ? Number(issueForm.target_user_id) : undefined,
      expires_in_value: durationVal,
      expires_in_unit: issueForm.expires_in_unit,
      expires_in_minutes: issueForm.expires_in_unit === 'minutes' ? durationVal : undefined,
      extra_claims: claims,
    });
    setIssuedTokenResult(res.token);
  };

  const handleVerifyToken = async (tokenString: string) => {
    if (!tokenString.trim()) return;
    try {
      const res = await verifyTokenMutation.mutateAsync({ token: tokenString.trim() });
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({
        status: 'error',
        valid: false,
        message: err?.response?.data?.detail || err?.message || 'Verification failed',
      });
    }
  };

  const handleGenerateTag = async () => {
    if (!canCreateTags) {
      ToastMsgs.error("Permission 'tags.create' required to generate product tags");
      return;
    }
    let finalPayload: Record<string, any>;
    if (tagPayloadMode === 'json') {
      try {
        finalPayload = JSON.parse(tagRawJson);
        setTagJsonError(null);
      } catch (err: any) {
        setTagJsonError('Invalid JSON format: ' + (err?.message || 'Syntax error'));
        ToastMsgs.error('Invalid Raw JSON syntax');
        return;
      }
    } else {
      finalPayload = {
        sku: tagForm.sku,
        batch_no: tagForm.batch,
        warehouse_id: tagForm.warehouse,
      };
    }

    await generateTagMutation.mutateAsync({
      key_id: tagForm.key_id || undefined,
      payload: finalPayload,
      expires_in_value: tagForm.duration,
      expires_in_unit: tagForm.unit,
      box_size: 10,
      border: 4,
      format: 'json',
      raw_claims_only: tagPayloadMode === 'json' && excludeFormData,
    });
  };

  const handleVerifyTag = async () => {
    if (!tagVerifyInput.trim()) return;
    try {
      const res = await verifyTokenMutation.mutateAsync({ token: tagVerifyInput.trim() });
      setTagVerifyResult(res);
    } catch (err: any) {
      setTagVerifyResult({
        status: 'error',
        valid: false,
        message: err?.response?.data?.detail || err?.message || 'Tag verification failed',
      });
    }
  };

  useEffect(() => {
    if (!tagForm.target_user_id) return;
    const uid = Number(tagForm.target_user_id);
    http.get<any>(`/keys/?user_id=${uid}`).then((res) => {
      if (res?.items) {
        const sharedIds = res.items.map((k: any) => k.id);
        setUserSharedKeys((prev) => ({ ...prev, [uid]: sharedIds }));
      }
    }).catch(() => {});
  }, [tagForm.target_user_id]);

  const handleOpenShareModal = async (key: KeyRecord) => {
    setSelectedKeyForShare(key);
    setSelectedShareUserId('');
    setShareModalOpen(true);
    setIsLoadingShares(true);
    try {
      const data = await http.get<any[]>(`/keys/${key.id}/shares`);
      setKeyShares(data || []);
    } catch {
      setKeyShares([]);
    } finally {
      setIsLoadingShares(false);
    }
  };

  const handleGrantShare = async () => {
    if (!selectedKeyForShare || !selectedShareUserId) return;
    setIsSubmittingShare(true);
    try {
      await http.post(`/keys/${selectedKeyForShare.id}/shares`, {
        user_id: Number(selectedShareUserId),
        can_sign_tags: canSignTagsShare,
        can_start_shifts: canStartShiftsShare,
      });
      ToastMsgs.success('Key shared successfully!');
      setSelectedShareUserId('');
      const updated = await http.get<any[]>(`/keys/${selectedKeyForShare.id}/shares`);
      setKeyShares(updated || []);
      const uid = Number(selectedShareUserId);
      setUserSharedKeys((prev) => ({
        ...prev,
        [uid]: Array.from(new Set([...(prev[uid] || []), selectedKeyForShare.id])),
      }));
    } catch (err: any) {
      ToastMsgs.error(err?.response?.data?.detail || 'Failed to share key');
    } finally {
      setIsSubmittingShare(false);
    }
  };

  const handleRevokeShare = async (userId: number) => {
    if (!selectedKeyForShare) return;
    try {
      await http.delete(`/keys/${selectedKeyForShare.id}/shares/${userId}`);
      ToastMsgs.info('Share access revoked');
      setKeyShares((prev) => prev.filter((s) => s.user_id !== userId));
      setUserSharedKeys((prev) => ({
        ...prev,
        [userId]: (prev[userId] || []).filter((kid) => kid !== selectedKeyForShare.id),
      }));
    } catch (err: any) {
      ToastMsgs.error(err?.response?.data?.detail || 'Failed to revoke share');
    }
  };

  const keys = canViewKeys ? (keysData?.items || []) : [];

  const keyColumns: TableColumn<KeyRecord>[] = [
    {
      key: 'kid',
      label: 'Key ID (kid)',
      render: (_, k) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8' }}>
            {k.kid}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            UUID: {String(k.id || '').slice(0, 8)}...
          </Typography>
        </Box>
      ),
    },
    {
      key: 'name',
      label: 'Name / Description',
      render: (_, k) => {
        const isAdminIssued = k.issued_by == null || (k.created_by != null && Number(k.issued_by) !== Number(k.created_by));
        return (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#F8FAFC' }}>
                {k.name}
              </Typography>
              <Chip
                size="small"
                label={
                  isAdminIssued
                    ? `Admin-Assigned to ${getUserLabel(k.created_by)}${k.issued_by ? ` (by ${getUserLabel(k.issued_by)})` : ''}`
                    : `Self-Created (${getUserLabel(k.created_by)})`
                }
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: isAdminIssued ? 'rgba(250, 204, 21, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                  color: isAdminIssued ? '#FACC15' : '#38BDF8',
                }}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              RSA-2048 / RS256
            </Typography>
          </Box>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, k) => (
        <Chip
          label={String(k.status || '').toUpperCase()}
          size="small"
          color={k.status === 'active' ? 'success' : 'error'}
          sx={{ fontWeight: 700, fontSize: 11 }}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (_, k) => (
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          {k.created_at ? new Date(k.created_at).toLocaleDateString() : 'N/A'}
        </Typography>
      ),
    },
  ];

  const keyActions: TableAction<KeyRecord>[] = [
    ...(canViewKeys ? [{
      icon: <VisibilityIcon fontSize="small" />,
      title: 'View Public Key (Raw PEM / QR Code)',
      variant: 'info' as const,
      onClick: (k: KeyRecord) => {
        setSelectedKeyForPem(k);
        setPemModalOpen(true);
      },
    }] : []),
    ...(canShareKey ? [{
      icon: <ShareIcon fontSize="small" />,
      title: 'Share Key with Users (Delegated Tags & Shifts)',
      variant: 'info' as const,
      disabled: (k: KeyRecord) => k.status !== 'active',
      onClick: (k: KeyRecord) => {
        handleOpenShareModal(k);
      },
    }] : []),
    ...(isAdmin ? [{
      icon: <SecurityIcon fontSize="small" />,
      title: 'Export Decrypted Private Key (Raw PEM / QR Code)',
      variant: 'warning' as const,
      onClick: (k: KeyRecord) => handleOpenExportAuth(k),
    }] : []),
    ...(canRevokeKey ? [{
      icon: <RevokeIcon fontSize="small" />,
      title: 'Revoke Key',
      variant: 'warning' as const,
      disabled: (k: KeyRecord) => k.status !== 'active',
      onClick: (k: KeyRecord) => {
        setSelectedKeyForRevoke(k);
        setRevokeModalOpen(true);
      },
    }] : []),
    {
      icon: <DeleteIcon fontSize="small" />,
      title: canDeleteAnyKey
        ? 'Permanently Delete Key (Admin)'
        : !canDeleteOwnKey
          ? "Requires 'keys.delete' permission to delete keys"
          : 'Permanently Delete Key (Only keys you created yourself; Admin-assigned keys are locked)',
      variant: 'error' as const,
      disabled: (k: KeyRecord) => !canDeleteKeyRecord(k),
      onClick: (k: KeyRecord) => {
        if (!canDeleteKeyRecord(k)) return;
        setSelectedKeyForDelete(k);
        setDeleteKeyModalOpen(true);
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
            <KeyIcon sx={{ color: '#38BDF8', fontSize: { xs: 28, sm: 36 } }} />
            Cryptographic Keys & Asymmetric Engine
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Manage RSA keypairs, sign offline tokens, inspect JWKS, and issue RS256-signed product tag QR codes.
          </Typography>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-mono text-slate-400">Product Tag QR Engine:</span>
            {canCreateTags ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-yellow-500/15 border border-yellow-500/40 text-yellow-300">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                tags.create ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                tags.create LOCKED (Admin Assignment Required)
              </span>
            )}
          </div>
        </Box>

        {/* Sleek Industrial Command Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Tool actions with unified industrial theme */}
          <button
            onClick={() => {
              setVerifyResult(null);
              setVerifyTokenInput('');
              setVerifyModalOpen(true);
            }}
            className="btn btn-sm bg-[#0F172A] border border-[#1E293B] hover:border-sky-400 text-slate-300 hover:text-white font-mono text-xs font-semibold gap-1.5 transition-all shadow-sm"
          >
            <VerifyIcon sx={{ fontSize: 16, color: '#38BDF8' }} />
            <span>Verify Token</span>
          </button>

          {canIssueToken && (
            <button
              onClick={() => {
                setIssuedTokenResult(null);
                setIssueTokenModalOpen(true);
              }}
              className="btn btn-sm bg-[#0F172A] border border-[#1E293B] hover:border-emerald-400 text-slate-300 hover:text-white font-mono text-xs font-semibold gap-1.5 transition-all shadow-sm"
            >
              <IssueIcon sx={{ fontSize: 16, color: '#10B981' }} />
              <span>Issue Token</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!canCreateTags) {
                setTagTab(1);
              }
              setTagModalOpen(true);
            }}
            className={
              canCreateTags
                ? "btn btn-sm bg-[#0F172A] border border-[#1E293B] hover:border-yellow-400 text-slate-300 hover:text-yellow-400 font-mono text-xs font-semibold gap-1.5 transition-all shadow-sm"
                : "btn btn-sm bg-[#0F172A] border border-slate-800 text-slate-500 hover:border-slate-700 font-mono text-xs font-semibold gap-1.5 transition-all shadow-sm"
            }
            title={canCreateTags ? "Product Tag QR Engine (RS256 Signed)" : "Requires tags.create permission to generate tags"}
          >
            <QrCodeIcon sx={{ fontSize: 16, color: canCreateTags ? '#FACC15' : '#64748B' }} />
            <span>Product Tag QR {!canCreateTags && '🔒'}</span>
          </button>

          <button
            onClick={() => setJwksModalOpen(true)}
            className="btn btn-sm bg-[#0F172A] border border-[#1E293B] hover:border-slate-400 text-slate-400 hover:text-white font-mono text-xs font-semibold gap-1.5 transition-all shadow-sm"
          >
            <VisibilityIcon sx={{ fontSize: 16 }} />
            <span>JWKS</span>
          </button>

          {/* Primary Operations */}
          {canRotateKey && (
            <button
              onClick={() => setRotateModalOpen(true)}
              className="btn btn-sm bg-[#0F172A] border border-emerald-500/50 hover:bg-emerald-500/15 text-emerald-400 font-mono text-xs font-bold gap-1.5 transition-all shadow-sm"
            >
              <RotateIcon sx={{ fontSize: 16 }} />
              <span>Rotate Key</span>
            </button>
          )}

          {canCreateKey && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn btn-sm btn-warning font-mono text-xs font-extrabold text-slate-900 gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.25)] hover:bg-yellow-400"
            >
              <AddIcon sx={{ fontSize: 18 }} />
              <span>Generate Key</span>
            </button>
          )}
        </div>
      </Box>

      {!canViewKeys && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You do not have permission to view cryptographic keys (requires 'keys.view' permission).
        </Alert>
      )}

      {/* Keys Table */}
      <Table<KeyRecord>
        columns={keyColumns}
        data={keys}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage={canViewKeys ? "No cryptographic keys generated yet." : "No cryptographic keys accessible (keys.view disabled)."}
        actions={keyActions}
        showSearch={true}
        searchPlaceholder="Search keys by name or kid..."
        showPagination={true}
        itemsPerPage={10}
      />

      {/* CREATE KEY MODAL */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Generate Asymmetric Keypair</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Key Name"
            placeholder="e.g. Warehouse Main RS256"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
          />
          <TextField
            label="Custom Key ID (kid) - Optional"
            placeholder="e.g. wh-us-east-01"
            value={createForm.kid}
            onChange={(e) => setCreateForm({ ...createForm, kid: e.target.value })}
            fullWidth
            size="small"
            helperText="Leave empty to auto-generate a unique timestamped kid"
          />
          <TextField
            select
            label="Select User (Key Owner)"
            value={createForm.target_user_id || String(currentUserId || '')}
            onChange={(e) => setCreateForm({ ...createForm, target_user_id: e.target.value })}
            fullWidth
            size="small"
            disabled={!isAdmin && userOptions.length <= 1}
            helperText={
              isAdmin
                ? 'Select a user by name to assign this cryptographic key (captures User ID automatically)'
                : `Assigned to your account (${user?.name || user?.email || 'Self'} — ID #${currentUserId})`
            }
          >
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>
          <FormControl fullWidth size="small">
            <InputLabel>Key Bit Size</InputLabel>
            <Select
              value={createForm.key_size}
              label="Key Bit Size"
              onChange={(e) => setCreateForm({ ...createForm, key_size: Number(e.target.value) })}
            >
              <MenuItem value={2048}>2048 bits (Standard & Fast)</MenuItem>
              <MenuItem value={4096}>4096 bits (Highest Security)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setCreateModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateSubmit} disabled={createKeyMutation.isPending}>
            Generate Keypair
          </Button>
        </DialogActions>
      </Dialog>

      {/* ROTATE KEY MODAL */}
      <Dialog open={rotateModalOpen} onClose={() => setRotateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Rotate Active Key</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="warning" sx={{ mt: 1 }}>
            Rotating generates a new primary signing key. Previous keys remain valid for verification until revoked.
          </Alert>
          <TextField
            label="Rotation Key Name"
            value={rotateForm.name}
            onChange={(e) => setRotateForm({ ...rotateForm, name: e.target.value })}
            fullWidth
            size="small"
          />
          <TextField
            select
            label="Select User (Key Owner)"
            value={rotateForm.target_user_id || String(currentUserId || '')}
            onChange={(e) => setRotateForm({ ...rotateForm, target_user_id: e.target.value })}
            fullWidth
            size="small"
            disabled={!isAdmin && userOptions.length <= 1}
            helperText="Select the user account that will own the rotated signing key"
          >
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setRotateModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={handleRotateSubmit} disabled={rotateKeyMutation.isPending}>
            Confirm Rotation
          </Button>
        </DialogActions>
      </Dialog>

      {/* REVOKE KEY MODAL */}
      <Dialog open={revokeModalOpen} onClose={() => setRevokeModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#EF4444' }}>Revoke Cryptographic Key</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Revoking key <strong>{selectedKeyForRevoke?.kid}</strong> prevents it from issuing new tokens.
          </Typography>
          <TextField
            label="Audit Reason"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setRevokeModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleRevokeSubmit} disabled={revokeKeyMutation.isPending}>
            Revoke Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW PUBLIC KEY PEM / QR CODE MODAL */}
      <Dialog open={pemModalOpen} onClose={() => setPemModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            bgcolor: '#0B132B',
            color: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            borderBottom: '1px solid #1E293B',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {pemShowQr ? <QrCodeIcon sx={{ color: '#FACC15' }} /> : <KeyIcon sx={{ color: '#38BDF8' }} />}
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC', lineHeight: 1.2 }}>
                Public Key ({selectedKeyForPem?.name || 'RSA-2048'})
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                kid: {selectedKeyForPem?.kid} • Owner: {getUserLabel(selectedKeyForPem?.created_by)}
              </Typography>
            </Box>
          </Box>

          {/* Checkbox to switch between Raw PEM and In-Browser QR Code */}
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              bgcolor: pemShowQr ? 'rgba(250, 204, 21, 0.12)' : 'rgba(56, 189, 248, 0.1)',
              border: pemShowQr ? '1px solid rgba(250, 204, 21, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={pemShowQr}
                  onChange={(e) => setPemShowQr(e.target.checked)}
                  sx={{
                    color: '#38BDF8',
                    p: 0.5,
                    mr: 0.5,
                    '&.Mui-checked': { color: '#FACC15' },
                  }}
                />
              }
              label={
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: pemShowQr ? '#FACC15' : '#38BDF8',
                    letterSpacing: '0.02em',
                  }}
                >
                  {pemShowQr ? 'QR CODE VIEW ACTIVE (Uncheck for Raw PEM)' : 'View as Scannable QR Code'}
                </Typography>
              }
            />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2.5 }}>
          {pemShowQr ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-mono text-slate-400">QR Payload Format:</span>
                <div className="join">
                  <button
                    type="button"
                    onClick={() => setPemQrPayloadType('base64')}
                    className={`join-item btn btn-xs font-mono ${
                      pemQrPayloadType === 'base64'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    Clean Base64 (No \n)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPemQrPayloadType('pem')}
                    className={`join-item btn btn-xs font-mono ${
                      pemQrPayloadType === 'pem'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    Standard PEM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPemQrPayloadType('json')}
                    className={`join-item btn btn-xs font-mono ${
                      pemQrPayloadType === 'json'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    JSON (kid + Clean Key)
                  </button>
                </div>
              </div>

              <Typography variant="body2" sx={{ color: '#94A3B8', textAlign: 'center', maxWidth: 540 }}>
                {pemQrPayloadType === 'base64'
                  ? 'Single-line X.509 Base64 key with all \\n, \\r, and PEM headers stripped so strict mobile decoders never break.'
                  : pemQrPayloadType === 'json'
                  ? 'JSON bundle with kid and single-line Base64 public_key (zero \\n escape characters).'
                  : 'Standard X.509 PEM format with normalized line endings and no trailing newline.'}
              </Typography>

              {pemQrDataUrl ? (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#FFFFFF',
                    borderRadius: 3,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                    border: '3px solid #FACC15',
                  }}
                >
                  <img
                    src={pemQrDataUrl}
                    alt={`Public Key QR ${selectedKeyForPem?.kid}`}
                    style={{ display: 'block', width: 280, maxWidth: '100%', height: 'auto' }}
                  />
                </Paper>
              ) : (
                <CircularProgress sx={{ color: '#FACC15', my: 4 }} />
              )}

              <Chip
                size="small"
                label={`kid: ${selectedKeyForPem?.kid || 'N/A'} • ${
                  pemQrPayloadType === 'base64'
                    ? 'Clean Base64 (Zero \\n / No Headers)'
                    : pemQrPayloadType === 'json'
                    ? 'JSON Bundle (kid + Clean Base64)'
                    : 'Standard X.509 PEM'
                }`}
                sx={{
                  bgcolor: 'rgba(250, 204, 21, 0.12)',
                  color: '#FACC15',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
                  CLEAN SINGLE-LINE BASE64 (NO \n OR PEM HEADERS — SAFE FOR ANDROID / DER DECODERS):
                </Typography>
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: '#07111D',
                    border: '1px solid rgba(250, 204, 21, 0.35)',
                    borderRadius: 2,
                    overflowX: 'auto',
                  }}
                >
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#FACC15',
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {extractCleanBase64Key(selectedKeyForPem?.public_key)}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
                  STANDARD X.509 PEM FORMAT:
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#07111D',
                    border: '1px solid #1E293B',
                    borderRadius: 2,
                    overflowX: 'auto',
                  }}
                >
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#38BDF8',
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {normalizePemKey(selectedKeyForPem?.public_key)}
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ bgcolor: '#0B132B', p: 2, borderTop: '1px solid #1E293B', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              variant="outlined"
              onClick={() =>
                handleCopy(extractCleanBase64Key(selectedKeyForPem?.public_key), 'Clean Base64 Public Key (No \\n)')
              }
              sx={{ color: '#FACC15', borderColor: '#FACC15' }}
            >
              Copy Clean Base64 (No \n)
            </Button>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              variant="outlined"
              onClick={() => handleCopy(normalizePemKey(selectedKeyForPem?.public_key), 'Standard PEM')}
              sx={{ color: '#38BDF8', borderColor: '#38BDF8' }}
            >
              Copy Standard PEM
            </Button>
            {pemShowQr && pemQrDataUrl && (
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                variant="contained"
                onClick={handleDownloadPublicKeyQR}
                sx={{ bgcolor: '#FACC15', color: '#07111D', fontWeight: 700, '&:hover': { bgcolor: '#EAB308' } }}
              >
                Download QR (PNG)
              </Button>
            )}
          </Stack>
          <Button size="small" onClick={() => setPemModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* SHARE KEY MODAL */}
      <Dialog open={shareModalOpen} onClose={() => setShareModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShareIcon sx={{ color: '#FACC15' }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC', lineHeight: 1.2 }}>
              Share Key: {selectedKeyForShare?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
              kid: {selectedKeyForShare?.kid} • Owner: {getUserLabel(selectedKeyForShare?.created_by)}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 3 }}>
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              Grant other workers or supervisors access to sign product tags or start shifts using this cryptographic key.
            </Typography>

            {/* Grant Share Form */}
            <Box sx={{ p: 2, bgcolor: '#0F172A', borderRadius: 2, border: '1px solid #1E293B' }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#FACC15', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
                Grant Access to Worker
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Select Worker / User"
                  value={selectedShareUserId}
                  onChange={(e) => setSelectedShareUserId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select user to share with...</em>
                  </MenuItem>
                  {userOptions
                    .filter((u) => u.id !== selectedKeyForShare?.created_by)
                    .map((u) => (
                      <MenuItem key={u.id} value={String(u.id)}>
                        👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id}
                      </MenuItem>
                    ))}
                </TextField>

                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={canSignTagsShare}
                        onChange={(e) => setCanSignTagsShare(e.target.checked)}
                        sx={{ color: '#FACC15', '&.Mui-checked': { color: '#FACC15' } }}
                      />
                    }
                    label={<Typography variant="body2" sx={{ color: '#F8FAFC' }}>Can Sign Product Tags</Typography>}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={canStartShiftsShare}
                        onChange={(e) => setCanStartShiftsShare(e.target.checked)}
                        sx={{ color: '#FACC15', '&.Mui-checked': { color: '#FACC15' } }}
                      />
                    }
                    label={<Typography variant="body2" sx={{ color: '#F8FAFC' }}>Can Start Shifts</Typography>}
                  />
                </Stack>

                <Button
                  variant="contained"
                  onClick={handleGrantShare}
                  disabled={!selectedShareUserId || isSubmittingShare}
                  sx={{ bgcolor: '#FACC15', color: '#0F172A', fontWeight: 800, '&:hover': { bgcolor: '#EAB308' } }}
                >
                  {isSubmittingShare ? <CircularProgress size={20} sx={{ color: '#0F172A' }} /> : 'Grant Key Access'}
                </Button>
              </Stack>
            </Box>

            {/* List of Current Shares */}
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                Users with Shared Access ({keyShares.length})
              </Typography>
              {isLoadingShares ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : keyShares.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#64748B', fontStyle: 'italic', p: 1 }}>
                  This key is not currently shared with any other users. Only the key creator and administrators can sign with it.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {keyShares.map((s) => (
                    <Box
                      key={s.id || s.user_id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: '#0F172A',
                        border: '1px solid #1E293B',
                        borderRadius: 1.5,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                          👤 {s.user_name} ({s.user_email})
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                          Permissions: {s.can_sign_tags ? '✓ Tags' : ''} {s.can_start_shifts ? '✓ Shifts' : ''}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleRevokeShare(s.user_id)}
                        sx={{ fontSize: '11px', py: 0.25, px: 1 }}
                      >
                        Revoke
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setShareModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* STEP-UP AUTHENTICATION DIALOG (PASSWORD + MFA) */}
      <Dialog
        open={exportAuthModalOpen}
        onClose={() => setExportAuthModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0B132B", color: "#F8FAFC", border: "1px solid #EF4444", borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SecurityIcon /> Step-Up Verification Required
          </Box>
          <IconButton
            size="small"
            onClick={() => setExportAuthModalOpen(false)}
            sx={{ color: "#94A3B8", "&:hover": { color: "#EF4444", bgcolor: "rgba(239, 68, 68, 0.1)" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Alert severity="warning" sx={{ bgcolor: "rgba(234, 179, 8, 0.1)", color: "#FACC15", border: "1px solid rgba(234, 179, 8, 0.3)" }}>
            High-Security Action: Exporting private key <strong>{targetKeyForExport?.kid}</strong>.
          </Alert>

          <TextField
            autoFocus
            label="Account Password"
            type="password"
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
            fullWidth
            size="small"
            placeholder="Enter your account password"
            sx={{
              mt: 1,
              "& .MuiOutlinedInput-root": {
                bgcolor: "#07111D",
              },
            }}
          />

          {isMFAEnabled ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="caption" sx={{ color: "#38BDF8", fontWeight: 700, textAlign: "center" }}>
                {activeMFAMethod === "totp"
                  ? "Enter 6-Digit Authenticator Code (TOTP)"
                  : "Enter 6-Digit Email OTP Security Code"}
              </Typography>
              <OtpBoxesInput
                value={exportOtp}
                onChange={setExportOtp}
              />
              {activeMFAMethod === "email" && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    setIsSendingOtp(true);
                    try {
                      await http.post("/mfa/send_genaric_otp?purpose=mfa_stepup");
                      ToastMsgs.info("Security code sent to your email.");
                    } catch (err: any) {
                      ToastMsgs.error(err?.message || "Failed to send email code");
                    } finally {
                      setIsSendingOtp(false);
                    }
                  }}
                  disabled={isSendingOtp}
                  sx={{ color: "#38BDF8", borderColor: "#38BDF8" }}
                >
                  {isSendingOtp ? "Sending Code..." : "Send Code to My Email"}
                </Button>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ bgcolor: "rgba(56, 189, 248, 0.1)", color: "#38BDF8", border: "1px solid rgba(56, 189, 248, 0.3)", py: 0.5 }}>
              Two-factor authentication is not active on your profile. Password verification alone is required.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setExportAuthModalOpen(false)} sx={{ color: "#94A3B8" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmExport}
            disabled={!exportPassword || (isMFAEnabled && exportOtp.length !== 6) || exportPrivateMutation.isPending}
          >
            {exportPrivateMutation.isPending ? <CircularProgress size={20} /> : "Verify & Export Key"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW DECRYPTED PRIVATE KEY PEM / QR CODE (ADMIN ONLY) */}
      <Dialog
        open={privatePemModalOpen}
        onClose={() => {
          setPrivatePemModalOpen(false);
          setPrivatePemResult(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: '#0B132B',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            borderBottom: '1px solid #7F1D1D',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {privateShowQr ? <QrCodeIcon sx={{ color: '#FACC15' }} /> : <SecurityIcon sx={{ color: '#EF4444' }} />}
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#EF4444', lineHeight: 1.2 }}>
                Decrypted Private Key ({targetKeyForExport?.name || 'RSA Confidential'})
              </Typography>
              <Typography variant="caption" sx={{ color: '#FCA5A5', fontFamily: 'monospace' }}>
                kid: {targetKeyForExport?.kid || 'N/A'} • Step-Up Verified
              </Typography>
            </Box>
          </Box>

          {/* Checkbox to switch between Raw Private Key and In-Browser QR Code */}
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              bgcolor: privateShowQr ? 'rgba(250, 204, 21, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: privateShowQr ? '1px solid rgba(250, 204, 21, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={privateShowQr}
                  onChange={(e) => setPrivateShowQr(e.target.checked)}
                  sx={{
                    color: '#EF4444',
                    p: 0.5,
                    mr: 0.5,
                    '&.Mui-checked': { color: '#FACC15' },
                  }}
                />
              }
              label={
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: privateShowQr ? '#FACC15' : '#FCA5A5',
                    letterSpacing: '0.02em',
                  }}
                >
                  {privateShowQr ? 'QR CODE VIEW ACTIVE (Uncheck for Raw Key)' : 'View as Scannable QR Code'}
                </Typography>
              }
            />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2.5 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            CRITICAL SECURITY MATERIAL: This decrypted RSA private key can sign tokens as this authority. Do not expose this screen or QR code to unauthorized cameras.
          </Alert>

          {privateShowQr ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-mono text-slate-400">QR Payload Format:</span>
                <div className="join">
                  <button
                    type="button"
                    onClick={() => setPrivateQrPayloadType('base64')}
                    className={`join-item btn btn-xs font-mono ${
                      privateQrPayloadType === 'base64'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    Clean Base64 (No \n)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivateQrPayloadType('pem')}
                    className={`join-item btn btn-xs font-mono ${
                      privateQrPayloadType === 'pem'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    Standard PEM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivateQrPayloadType('json')}
                    className={`join-item btn btn-xs font-mono ${
                      privateQrPayloadType === 'json'
                        ? 'btn-warning text-slate-900 font-bold'
                        : 'bg-[#07111D] text-slate-300 border-[#1E293B]'
                    }`}
                  >
                    JSON (kid + Clean Key)
                  </button>
                </div>
              </div>

              <Typography variant="body2" sx={{ color: '#94A3B8', textAlign: 'center', maxWidth: 540 }}>
                {privateQrPayloadType === 'base64'
                  ? 'Single-line PKCS#8 Base64 private key with all \\n, \\r, and PEM headers stripped so Android KeyFactory / PKCS8EncodedKeySpec never breaks.'
                  : privateQrPayloadType === 'json'
                  ? 'JSON bundle with kid and single-line Base64 private_key (zero \\n escape characters).'
                  : 'Standard PKCS#8 PEM format with normalized line endings and no trailing newline.'}
              </Typography>

              {privateQrError ? (
                <Alert severity="warning" sx={{ maxWidth: 500 }}>
                  {privateQrError}
                </Alert>
              ) : privateQrDataUrl ? (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#FFFFFF',
                    borderRadius: 3,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                    border: '3px solid #EF4444',
                  }}
                >
                  <img
                    src={privateQrDataUrl}
                    alt={`Private Key QR ${targetKeyForExport?.kid}`}
                    style={{ display: 'block', width: 320, maxWidth: '100%', height: 'auto' }}
                  />
                </Paper>
              ) : (
                <CircularProgress sx={{ color: '#EF4444', my: 4 }} />
              )}

              <Chip
                size="small"
                label={`CONFIDENTIAL • kid: ${targetKeyForExport?.kid || 'N/A'} • ${
                  privateQrPayloadType === 'base64'
                    ? 'Clean Base64 (Zero \\n / No Headers)'
                    : privateQrPayloadType === 'json'
                    ? 'JSON Bundle (kid + Clean Base64)'
                    : 'Standard PKCS#8 PEM'
                }`}
                sx={{
                  bgcolor: 'rgba(239, 68, 68, 0.15)',
                  color: '#FCA5A5',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" sx={{ color: '#FCA5A5', fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
                  CLEAN SINGLE-LINE BASE64 (NO \n OR PEM HEADERS — SAFE FOR ANDROID PKCS8EncodedKeySpec):
                </Typography>
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: '#07111D',
                    border: '1px solid rgba(250, 204, 21, 0.35)',
                    borderRadius: 2,
                    overflowX: 'auto',
                  }}
                >
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#FACC15',
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {extractCleanBase64Key(privatePemResult)}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
                  STANDARD PKCS#8 PEM FORMAT:
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#07111D',
                    border: '1px solid #7F1D1D',
                    borderRadius: 2,
                    overflowX: 'auto',
                  }}
                >
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#FCA5A5',
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {normalizePemKey(privatePemResult)}
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ bgcolor: '#0B132B', p: 2, borderTop: '1px solid #7F1D1D', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              variant="outlined"
              onClick={() =>
                handleCopy(extractCleanBase64Key(privatePemResult), 'Clean Base64 Private Key (No \\n)')
              }
              sx={{ color: '#FACC15', borderColor: '#FACC15' }}
            >
              Copy Clean Base64 (No \n)
            </Button>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              variant="outlined"
              onClick={() => handleCopy(normalizePemKey(privatePemResult), 'Standard Private Key PEM')}
              sx={{ color: '#EF4444', borderColor: '#EF4444' }}
            >
              Copy Standard PEM
            </Button>
            {privateShowQr && privateQrDataUrl && (
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                variant="contained"
                onClick={handleDownloadPrivateKeyQR}
                sx={{ bgcolor: '#EF4444', color: '#FFFFFF', fontWeight: 700, '&:hover': { bgcolor: '#DC2626' } }}
              >
                Download Private QR (PNG)
              </Button>
            )}
          </Stack>
          <Button
            size="small"
            onClick={() => {
              setPrivatePemModalOpen(false);
              setPrivatePemResult(null);
            }}
            sx={{ color: '#94A3B8' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* JWKS MODAL */}
      <Dialog open={jwksModalOpen} onClose={() => setJwksModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>JSON Web Key Set (JWKS)</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2 }}>
          <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
            <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#34D399', m: 0 }}>
              {JSON.stringify(jwksData || { keys: [] }, null, 2)}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button
            startIcon={<CopyIcon />}
            variant="outlined"
            onClick={() => handleCopy(JSON.stringify(jwksData || {}, null, 2), 'JWKS')}
            sx={{ color: '#34D399', borderColor: '#34D399' }}
          >
            Copy JWKS
          </Button>
          <Button onClick={() => setJwksModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ISSUE TOKEN MODAL */}
      <Dialog open={issueTokenModalOpen} onClose={() => setIssueTokenModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Issue RS256 Asymmetric JWT</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Sign arbitrary claims using the database RSA private key. Scanners verify this offline using the public key.
          </Typography>

          <TextField
            select
            label="Select User (Token Subject)"
            value={issueForm.target_user_id || String(currentUserId || '')}
            onChange={(e) => {
              const selectedUid = e.target.value;
              const userKey = keys.find(
                (k) => k.status === 'active' && Number(k.created_by) === Number(selectedUid)
              );
              setIssueForm({
                ...issueForm,
                target_user_id: selectedUid,
                key_id: userKey ? userKey.id : issueForm.key_id,
              });
            }}
            fullWidth
            size="small"
            disabled={!isAdmin && userOptions.length <= 1}
            helperText="Select a user by name — automatically captures their User ID and matches their active signing key"
          >
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Signing Key"
            value={issueForm.key_id}
            onChange={(e) => setIssueForm({ ...issueForm, key_id: e.target.value })}
            fullWidth
            size="small"
          >
            <MenuItem value="">Latest Active Key (Auto-detect)</MenuItem>
            {keys.map((k) => (
              <MenuItem key={k.id} value={k.id}>
                🔑 {k.name} ({k.kid}) — Owner: {getUserLabel(k.created_by)}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Expiration Duration"
              type="number"
              value={issueForm.expires_in_value}
              onChange={(e) =>
                setIssueForm({ ...issueForm, expires_in_value: Math.max(1, Number(e.target.value) || 1) })
              }
              inputProps={{ min: 1 }}
              sx={{ width: { xs: '100%', sm: '50%' } }}
              size="small"
            />
            <FormControl sx={{ width: { xs: '100%', sm: '50%' } }} size="small">
              <InputLabel>Duration Unit</InputLabel>
              <Select
                value={issueForm.expires_in_unit}
                label="Duration Unit"
                onChange={(e) => setIssueForm({ ...issueForm, expires_in_unit: e.target.value as any })}
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

          <TextField
            label="Extra Custom Claims (JSON)"
            multiline
            rows={3}
            value={issueForm.extra_claims}
            onChange={(e) => setIssueForm({ ...issueForm, extra_claims: e.target.value })}
            fullWidth
            size="small"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          />

          {issuedTokenResult && (
            <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #10B981', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, display: 'block', mb: 1 }}>
                Issued RS256 Token:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: '#A7F3D0',
                  fontSize: 12,
                  bgcolor: '#030712',
                  p: 1.5,
                  borderRadius: 1,
                }}
              >
                {issuedTokenResult}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CopyIcon />}
                onClick={() => handleCopy(issuedTokenResult, 'RS256 Token')}
                sx={{ mt: 1.5, color: '#10B981', borderColor: '#10B981' }}
              >
                Copy Token
              </Button>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setIssueTokenModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
          <Button variant="contained" onClick={handleIssueToken} disabled={issueTokenMutation.isPending}>
            Issue Token
          </Button>
        </DialogActions>
      </Dialog>

      {/* VERIFY TOKEN MODAL */}
      <Dialog open={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC' }}>Verify & Decode RS256 Token</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Extracts the Key ID (kid) from the JWT header and validates the cryptographic signature using the public key in PostgreSQL.
          </Typography>

          <TextField
            label="Paste RS256 Token String or Scanned QR Text"
            multiline
            rows={4}
            value={verifyTokenInput}
            onChange={(e) => setVerifyTokenInput(e.target.value)}
            fullWidth
            placeholder="eyJhbGciOiJSUzI1NiIs..."
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          />

          <Button
            variant="contained"
            onClick={() => handleVerifyToken(verifyTokenInput)}
            disabled={!verifyTokenInput.trim() || verifyTokenMutation.isPending}
            sx={{ bgcolor: '#38BDF8', color: '#07111D', fontWeight: 700 }}
          >
            {verifyTokenMutation.isPending ? <CircularProgress size={20} /> : 'Verify Signature & Claims'}
          </Button>

          {verifyResult && (
            <Paper sx={{ p: 2, bgcolor: '#07111D', border: `1px solid ${verifyResult.valid ? '#10B981' : '#EF4444'}`, borderRadius: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: verifyResult.valid ? '#10B981' : '#EF4444', fontWeight: 700, mb: 1 }}
              >
                {verifyResult.valid ? 'VALID CRYPTOGRAPHIC SIGNATURE' : 'SIGNATURE VERIFICATION FAILED'}
              </Typography>
              {verifyResult.kid && (
                <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1 }}>
                  Verified with Key ID: <strong>{verifyResult.kid}</strong>
                </Typography>
              )}
              {verifyResult.payload && (
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: '#A7F3D0',
                    bgcolor: '#030712',
                    p: 1.5,
                    borderRadius: 1,
                    m: 0,
                  }}
                >
                  {JSON.stringify(verifyResult.payload, null, 2)}
                </Typography>
              )}
              {verifyResult.message && (
                <Typography variant="body2" sx={{ color: '#FCA5A5', mt: 1 }}>
                  {verifyResult.message}
                </Typography>
              )}
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setVerifyModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* PRODUCT TAG QR MODAL WITH GENERATE & VERIFY TABS */}
      <Dialog open={tagModalOpen} onClose={() => setTagModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <div className="flex items-center gap-2">
            <span>Product Tag QR Engine (RS256 Signed)</span>
            <span className="badge badge-sm bg-yellow-400 text-slate-950 font-bold font-mono">TAGS.CREATE</span>
          </div>
          <div>
            {canCreateTags ? (
              <span className="badge badge-sm badge-success font-mono font-bold">STATUS: AUTHORIZED</span>
            ) : (
              <span className="badge badge-sm badge-error font-mono font-bold">STATUS: LOCKED (LACKS tags.create)</span>
            )}
          </div>
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: '#1E293B', bgcolor: '#0B132B', px: 3 }}>
          <Tabs value={tagTab} onChange={(_, val) => setTagTab(val)}>
            <Tab
              label={
                <span className="flex items-center gap-1.5">
                  Generate Product Tag QR
                  {!canCreateTags && <span className="badge badge-xs badge-error font-mono">Locked</span>}
                </span>
              }
            />
            <Tab label="Verify Tag / Scan QR Code" />
          </Tabs>
        </Box>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 3 }}>
          {tagTab === 0 && (
            <Stack spacing={2.5}>
              {!canCreateTags && (
                <Box
                  sx={{
                    p: 3,
                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 2,
                    textAlign: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#F87171', fontWeight: 700, mb: 0.5 }}>
                    🔒 Permission Required: tags.create
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#FECACA', fontSize: '13px' }}>
                    You do not have permission to generate RS256-signed Product Tag QR codes. The <code>tags.create</code> permission or Admin role is required.
                  </Typography>
                </Box>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-2.5">
                <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                  Signs arbitrary inventory attributes with RSA and dynamically generates a fitted QR code image.
                </Typography>

                {/* Input Mode Selector: Form vs Raw JSON */}
                <div className="join shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!excludeFormData) {
                        setTagRawJson(
                          JSON.stringify(
                            {
                              sku: tagForm.sku,
                              batch_no: tagForm.batch,
                              warehouse_id: tagForm.warehouse,
                            },
                            null,
                            2
                          )
                        );
                      }
                      setTagPayloadMode('form');
                    }}
                    className={`join-item btn btn-xs font-mono transition-all ${tagPayloadMode === 'form'
                        ? 'btn-warning font-bold text-slate-900 shadow-sm'
                        : 'btn-ghost text-slate-400'
                      }`}
                  >
                    Standard Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagPayloadMode('json')}
                    className={`join-item btn btn-xs font-mono transition-all ${tagPayloadMode === 'json'
                        ? 'btn-warning font-bold text-slate-900 shadow-sm'
                        : 'btn-ghost text-slate-400'
                      }`}
                  >
                    {'{ }'} Raw JSON Payload
                  </button>
                </div>
              </div>

              <TextField
                select
                label="Select User (Key Owner Filter)"
                value={tagForm.target_user_id}
                onChange={(e) => {
                  const selectedUid = e.target.value;
                  setTagForm({
                    ...tagForm,
                    target_user_id: selectedUid,
                    key_id: '',
                  });
                }}
                fullWidth
                size="small"
                helperText="Select a user to filter assigned & shared signing keys (or select All Users)"
              >
                <MenuItem value="">
                  <em>👥 All Users (Show All Available Signing Keys)</em>
                </MenuItem>
                {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : ''}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Signing Cryptographic Key (kid / key_id)"
                value={tagForm.key_id}
                onChange={(e) => setTagForm({ ...tagForm, key_id: e.target.value })}
                fullWidth
                size="small"
                helperText={
                  tagForm.target_user_id
                    ? `Showing keys owned by or shared with ${getUserLabel(Number(tagForm.target_user_id))}`
                    : 'Showing all active cryptographic signing keys'
                }
              >
                <MenuItem value="">
                  <em>Latest Active Key (Auto-resolved)</em>
                </MenuItem>
                {(() => {
                  const uid = tagForm.target_user_id ? Number(tagForm.target_user_id) : null;
                  const candidateKeys = keys.filter((k) => k.status === 'active');
                  const matchingKeys = uid && isAdmin
                    ? candidateKeys.filter(
                        (k) =>
                          Number(k.created_by) === uid ||
                          (userSharedKeys[uid] && userSharedKeys[uid].includes(k.id))
                      )
                    : candidateKeys;

                  const keysToShow = matchingKeys.length > 0 ? matchingKeys : (isAdmin ? candidateKeys : []);

                  return keysToShow.map((k) => {
                    const isShared = uid != null && Number(k.created_by) !== uid && (userSharedKeys[uid] || []).includes(k.id);
                    const isAdminFallback = uid != null && matchingKeys.length === 0 && isAdmin;
                    return (
                      <MenuItem key={k.id} value={k.id}>
                        🔑 {k.name} (kid: {k.kid}) — Owner: {getUserLabel(k.created_by)}
                        {isShared ? ' • [SHARED]' : ''}
                        {isAdminFallback ? ' • [ADMIN OVERRIDE]' : ''}
                      </MenuItem>
                    );
                  });
                })()}
              </TextField>

              {/* Conditional Mode: Standard Form vs Raw JSON Editor */}
              {tagPayloadMode === 'form' ? (
                <>
                  <TextField
                    label="SKU / Item Code"
                    value={tagForm.sku}
                    onChange={(e) => setTagForm({ ...tagForm, sku: e.target.value })}
                    fullWidth
                    size="small"
                    placeholder="e.g. SKU-99201"
                  />
                  <TextField
                    label="Batch Number"
                    value={tagForm.batch}
                    onChange={(e) => setTagForm({ ...tagForm, batch: e.target.value })}
                    fullWidth
                    size="small"
                    placeholder="e.g. BATCH-2026-X"
                  />
                  <TextField
                    label="Warehouse ID"
                    value={tagForm.warehouse}
                    onChange={(e) => setTagForm({ ...tagForm, warehouse: e.target.value })}
                    fullWidth
                    size="small"
                    placeholder="e.g. WH-CENTRAL-01"
                  />
                </>
              ) : (
                <Box>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-yellow-400">
                      Arbitrary Product Claims JSON Payload (POST /app/v1/keys/tags/qr):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTagRawJson(
                          JSON.stringify(
                            {
                              sku: 'SKU-99201',
                              batch_no: 'BATCH-2026-X',
                              warehouse_id: 'WH-CENTRAL-01',
                              product_name: 'Precision Pressure Sensor',
                              hazard_class: 'NON-HAZARDOUS',
                              custom_claims: {
                                operating_temp: '-40C to 85C',
                                voltage: '24V DC',
                                inspected_by: 'QA-TECH-04',
                              },
                            },
                            null,
                            2
                          )
                        );
                        setTagJsonError(null);
                      }}
                      className="text-[11px] font-mono text-[#38BDF8] hover:underline"
                    >
                      ↺ Load Full Sample Payload
                    </button>
                  </div>
                  <TextField
                    multiline
                    rows={8}
                    fullWidth
                    value={tagRawJson}
                    onChange={(e) => {
                      setTagRawJson(e.target.value);
                      try {
                        JSON.parse(e.target.value);
                        setTagJsonError(null);
                      } catch (err: any) {
                        setTagJsonError(err.message);
                      }
                    }}
                    error={!!tagJsonError}
                    helperText={tagJsonError || 'Valid JSON dictionary passed directly as arbitrary claims to the token signer'}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#07111D',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        color: '#F8FAFC',
                        '& fieldset': { borderColor: tagJsonError ? '#EF4444' : '#1E293B' },
                        '&:hover fieldset': { borderColor: '#FACC15' },
                      },
                    }}
                  />
                  <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={excludeFormData}
                          onChange={(e) => setExcludeFormData(e.target.checked)}
                          size="small"
                          sx={{ color: '#64748B', '&.Mui-checked': { color: '#FACC15' } }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600, fontSize: '13px' }}>
                            Exclude standard form fields & creator metadata (Pure JSON Only)
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: '11px' }}>
                            When checked, only your custom JSON claims are embedded in the QR tag (omits user_id, creator_name, and default form fields).
                          </Typography>
                        </Box>
                      }
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setTagRawJson('{\n  \n}');
                        setTagJsonError(null);
                      }}
                      sx={{
                        color: '#38BDF8',
                        borderColor: 'rgba(56, 189, 248, 0.4)',
                        fontSize: '11px',
                        textTransform: 'none',
                        py: 0.25,
                        px: 1,
                        '&:hover': { borderColor: '#38BDF8', bgcolor: 'rgba(56, 189, 248, 0.1)' },
                      }}
                    >
                      Clear to Empty JSON {'{ }'}
                    </Button>
                  </Box>
                </Box>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  type="number"
                  label="Expiration Duration"
                  value={tagForm.duration}
                  onChange={(e) => setTagForm({ ...tagForm, duration: Number(e.target.value) })}
                  sx={{ width: { xs: '100%', sm: '50%' } }}
                  size="small"
                />
                <FormControl sx={{ width: { xs: '100%', sm: '50%' } }} size="small">
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={tagForm.unit}
                    label="Unit"
                    onChange={(e) => setTagForm({ ...tagForm, unit: e.target.value as any })}
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

              <Button
                variant="contained"
                onClick={handleGenerateTag}
                disabled={generateTagMutation.isPending || !canCreateTags}
                sx={{ bgcolor: '#FACC15', color: '#0F172A', fontWeight: 700, '&:hover': { bgcolor: '#EAB308' } }}
              >
                {generateTagMutation.isPending ? <CircularProgress size={20} /> : 'Generate Scannable Tag QR'}
              </Button>

              {generateTagMutation.data && (
                <Box
                  sx={{
                    p: 3,
                    bgcolor: '#07111D',
                    borderRadius: 2,
                    border: '1px solid rgba(250, 204, 21, 0.3)',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: 'center',
                    gap: 3,
                    mt: 2,
                  }}
                >
                  <Box
                    component="img"
                    src={generateTagMutation.data.qr_code_base64}
                    alt="Product Tag QR"
                    sx={{
                      width: 200,
                      height: 200,
                      bgcolor: '#fff',
                      p: 1.5,
                      borderRadius: 2,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#FACC15' }}>
                      TAG QR GENERATED SUCCESSFULLY
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
                      Signed with Key ID: <strong>{generateTagMutation.data.kid}</strong>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                      Expires at: {new Date(generateTagMutation.data.expires_at).toLocaleString()}
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() =>
                          handleDownloadQR(
                            generateTagMutation.data!.qr_code_base64,
                            `tag_${generateTagMutation.data!.kid}.png`
                          )
                        }
                        sx={{ bgcolor: '#38BDF8', color: '#07111D', fontWeight: 700 }}
                      >
                        Download PNG
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CopyIcon />}
                        onClick={() => handleCopy(generateTagMutation.data?.token || '', 'Signed JWT Token')}
                        sx={{ color: '#FACC15', borderColor: 'rgba(250, 204, 21, 0.4)' }}
                      >
                        Copy Token
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              )}
            </Stack>
          )}

          {tagTab === 1 && (
            <Stack spacing={2.5}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Paste the token scanned from a physical product tag QR code to inspect payload attributes and verify its RSA signature.
              </Typography>

              <TextField
                label="Paste Scanned QR Code Token"
                multiline
                rows={4}
                value={tagVerifyInput}
                onChange={(e) => setTagVerifyInput(e.target.value)}
                fullWidth
                placeholder="eyJhbGciOiJSUzI1Ni..."
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
              />

              <Button
                variant="contained"
                onClick={handleVerifyTag}
                disabled={!tagVerifyInput.trim() || verifyTokenMutation.isPending}
                sx={{ bgcolor: '#38BDF8', color: '#07111D', fontWeight: 700 }}
              >
                {verifyTokenMutation.isPending ? <CircularProgress size={20} /> : 'Verify Scanned Tag'}
              </Button>

              {tagVerifyResult && (
                <Paper
                  sx={{
                    p: 2.5,
                    bgcolor: '#07111D',
                    border: `1px solid ${tagVerifyResult.valid ? '#10B981' : '#EF4444'}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ color: tagVerifyResult.valid ? '#10B981' : '#EF4444', fontWeight: 700, mb: 1 }}
                  >
                    {tagVerifyResult.valid ? 'VALID PRODUCT TAG' : 'INVALID TAG SIGNATURE'}
                  </Typography>
                  {tagVerifyResult.payload && (
                    <Typography
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: '#A7F3D0',
                        bgcolor: '#030712',
                        p: 1.5,
                        borderRadius: 1,
                        m: 0,
                      }}
                    >
                      {JSON.stringify(tagVerifyResult.payload, null, 2)}
                    </Typography>
                  )}
                  {tagVerifyResult.message && (
                    <Typography variant="body2" sx={{ color: '#FCA5A5', mt: 1 }}>
                      {tagVerifyResult.message}
                    </Typography>
                  )}
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setTagModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Key Confirmation Modal */}
      <Dialog open={deleteKeyModalOpen} onClose={() => setDeleteKeyModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon />
          Permanently Delete Cryptographic Key
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="error" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {canDeleteAnyKey
              ? 'Admin / Supervisor deletion: Permanently deletes this RSA keypair along with any bound inventory rules and shifts.'
              : 'Self-created key deletion: Permanently deletes your personally generated RSA keypair and its bound rules.'}
          </Alert>
          {selectedKeyForDelete && (
            <Paper sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                {selectedKeyForDelete.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#38BDF8', fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                Key ID (kid): {selectedKeyForDelete.kid}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                UUID: {selectedKeyForDelete.id} | Status: {String(selectedKeyForDelete.status || '').toUpperCase()}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setDeleteKeyModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleConfirmDeleteKey}
            disabled={deleteKeyMutation.isPending || !selectedKeyForDelete}
          >
            {deleteKeyMutation.isPending ? <CircularProgress size={20} /> : 'Permanently Delete Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default KeysPage;
