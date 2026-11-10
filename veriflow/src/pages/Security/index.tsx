// src/pages/Security/index.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  VerifiedUserRounded as ShieldCheck,
  GppBadRounded as ShieldOff,
  SmartphoneRounded as Smartphone,
  EmailRounded as Mail,
  VpnKeyRounded as Key,
  ContentCopyRounded as Copy,
  CheckRounded as Check,
  SendRounded as Send,
  LockRounded as Lock,
  RefreshRounded as RefreshCw,
  CloseRounded as CloseIcon,
} from "@mui/icons-material";
import QRCode from 'qrcode';
import { OtpBoxesInput } from '../../components/OtpModal';
import {
  useMFAStatusQuery,
  useStartEnrollMutation,
  useConfirmEnrollMutation,
  useDisableMFAMutation,
  useSendGenericOTPMutation,
  useSendEmailOTPMutation,
  useVerifyEmailOTPMutation,
} from './query';
import type { OTPPurposeType, StartEnrollResponse } from './types';

export const SecurityPage: React.FC = () => {
  const { data: mfaStatus, isLoading: statusLoading, refetch: refetchStatus } = useMFAStatusQuery();

  // Enrollment State
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollMethod, setEnrollMethod] = useState<'totp' | 'email'>('totp');
  const [enrollData, setEnrollData] = useState<StartEnrollResponse | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Disable State
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  // Email OTP Sandbox
  const [testEmail, setTestEmail] = useState('');
  const [testPurpose, setTestPurpose] = useState<OTPPurposeType>('verification');
  const [testCode, setTestCode] = useState('');
  const [testVerified, setTestVerified] = useState<boolean | null>(null);

  // Generic OTP
  const [genericPurpose, setGenericPurpose] = useState<OTPPurposeType>('login_2fa');

  // Mutations
  const startEnrollMutation = useStartEnrollMutation();
  const confirmEnrollMutation = useConfirmEnrollMutation();
  const disableMutation = useDisableMFAMutation();
  const sendGenericOTPMutation = useSendGenericOTPMutation();
  const sendEmailOTPMutation = useSendEmailOTPMutation();
  const verifyEmailOTPMutation = useVerifyEmailOTPMutation();

  const handleStartEnroll = async (method: 'totp' | 'email') => {
    setEnrollMethod(method);
    setVerificationCode('');
    setQrCodeUrl(null);
    setEnrollData(null);
    const res = await startEnrollMutation.mutateAsync({ method });
    setEnrollData(res);
    setEnrollDialogOpen(true);

    if (res.otpauth_uri) {
      try {
        const url = await QRCode.toDataURL(res.otpauth_uri, {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('Failed to generate QR code canvas', err);
      }
    }
  };

  const handleConfirmEnroll = async () => {
    if (!verificationCode || !enrollData) return;
    await confirmEnrollMutation.mutateAsync({
      method: enrollMethod,
      code: verificationCode.trim(),
    });
    setEnrollDialogOpen(false);
  };

  const handleConfirmDisable = async () => {
    if (!disablePassword) return;
    await disableMutation.mutateAsync({
      password: disablePassword,
      code: disableCode || undefined,
    });
    setDisableDialogOpen(false);
    setDisablePassword('');
    setDisableCode('');
  };

  const copySecret = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, p: { xs: 0.5, sm: 2 }, maxWidth: 1300, mx: 'auto', overflowX: 'hidden' }}>
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
            <Lock sx={{ color: '#38BDF8' }} /> Two-Factor Authentication & Verification
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Configure multi-factor authentication (TOTP Authenticator & Email OTP) and verify out-of-band codes.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshCw fontSize="small" />}
          onClick={() => refetchStatus()}
          sx={{ borderColor: '#334155', color: '#94A3B8' }}
        >
          Refresh Status
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Status Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {mfaStatus?.mfa_enabled ? (
                    <ShieldCheck sx={{ color: '#10B981' }} />
                  ) : (
                    <ShieldOff sx={{ color: '#F59E0B' }} />
                  )}
                  MFA Protection Status
                </Typography>
                {statusLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Chip
                    label={mfaStatus?.mfa_enabled ? 'MFA ACTIVE' : 'MFA DISABLED'}
                    color={mfaStatus?.mfa_enabled ? 'success' : 'warning'}
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  />
                )}
              </Box>

              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                Multi-Factor Authentication adds an essential cryptographic layer to prevent account hijacking, requiring both your password and an authenticator token.
              </Typography>

              {mfaStatus?.mfa_enabled ? (
                <Box sx={{ p: 2, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 0.5 }}>
                    Active 2FA Method:
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#38BDF8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {mfaStatus.mfa_method === 'totp' ? <Smartphone fontSize="small" /> : <Mail fontSize="small" />}
                    {String(mfaStatus?.mfa_method || "").toUpperCase()} (Time-based One-Time Password)
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setDisableDialogOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Disable Two-Factor Auth
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<Smartphone fontSize="small" />}
                    onClick={() => handleStartEnroll('totp')}
                    disabled={startEnrollMutation.isPending}
                    sx={{ bgcolor: '#38BDF8', color: '#07111D', fontWeight: 700, '&:hover': { bgcolor: '#0EA5E9' } }}
                  >
                    Enroll Authenticator App (TOTP)
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Mail fontSize="small" />}
                    onClick={() => handleStartEnroll('email')}
                    disabled={startEnrollMutation.isPending}
                    sx={{ borderColor: '#334155', color: '#E2E8F0' }}
                  >
                    Enroll Email OTP
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Generic OTP Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Key sx={{ color: '#F59E0B' }} /> Send Generic Purpose OTP
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                Generate and dispatch a scoped 6-digit OTP to your registered email for high-privilege operations.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  select
                  label="OTP Purpose"
                  value={genericPurpose}
                  onChange={(e) => setGenericPurpose(e.target.value as OTPPurposeType)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="login_2fa">Login 2FA (login_2fa)</MenuItem>
                  <MenuItem value="verification">Account Verification (verification)</MenuItem>
                  <MenuItem value="password_reset">Password Reset (password_reset)</MenuItem>
                  <MenuItem value="mfa_disable">MFA Disable Authorization (mfa_disable)</MenuItem>
                  <MenuItem value="account_restore">Account Restoration (account_restore)</MenuItem>
                  <MenuItem value="kill_switch_reset">Kill Switch Reset (kill_switch_reset)</MenuItem>
                </TextField>

                <Button
                  variant="outlined"
                  startIcon={<Send fontSize="small" />}
                  onClick={() => sendGenericOTPMutation.mutate(genericPurpose)}
                  disabled={sendGenericOTPMutation.isPending}
                  sx={{ borderColor: '#38BDF8', color: '#38BDF8', fontWeight: 600 }}
                >
                  {sendGenericOTPMutation.isPending ? 'Sending OTP...' : 'Send Generic OTP'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Email OTP Verification Sandbox */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#0B132B', border: '1px solid #1E293B', borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Mail sx={{ color: '#38BDF8' }} /> Out-of-Band Email OTP Sandbox
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                Test email OTP delivery and verify 6-digit confirmation codes against backend rate limiters.
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                  <Paper sx={{ p: 2.5, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700, mb: 1.5 }}>
                      1. Dispatch Email OTP
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Recipient Email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="user@example.com"
                      />
                      <TextField
                        select
                        label="Purpose"
                        value={testPurpose}
                        onChange={(e) => setTestPurpose(e.target.value as OTPPurposeType)}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="verification">verification</MenuItem>
                        <MenuItem value="login_2fa">login_2fa</MenuItem>
                        <MenuItem value="password_reset">password_reset</MenuItem>
                      </TextField>
                      <Button
                        variant="contained"
                        startIcon={<Send fontSize="small" />}
                        onClick={() => sendEmailOTPMutation.mutate({ email: testEmail, purpose: testPurpose })}
                        disabled={!testEmail || sendEmailOTPMutation.isPending}
                      >
                        Send OTP via Email
                      </Button>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                  <Paper sx={{ p: 2.5, bgcolor: '#07111D', border: '1px solid #1E293B', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700, mb: 1.5 }}>
                      2. Verify Received 6-Digit OTP
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2, bgcolor: '#0B132B', borderRadius: 2, border: '1px solid #1E293B' }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                          Enter 6-digit verification code sent to your email:
                        </Typography>
                        <OtpBoxesInput
                          value={testCode}
                          onChange={(v) => {
                            setTestCode(v);
                            setTestVerified(null);
                          }}
                        />
                        <Button
                          variant="contained"
                          color="success"
                          onClick={async () => {
                            try {
                              await verifyEmailOTPMutation.mutateAsync({
                                email: testEmail,
                                purpose: testPurpose,
                                code: testCode.trim(),
                              });
                              setTestVerified(true);
                            } catch {
                              setTestVerified(false);
                            }
                          }}
                          disabled={testCode.length !== 6 || verifyEmailOTPMutation.isPending}
                          sx={{ minWidth: 160 }}
                        >
                          Verify OTP
                        </Button>
                      </Box>

                      {testVerified === true && (
                        <Alert severity="success" sx={{ bgcolor: '#064E3B', color: '#A7F3D0' }}>
                          Code verified successfully! OTP has been consumed.
                        </Alert>
                      )}
                      {testVerified === false && (
                        <Alert severity="error" sx={{ bgcolor: '#450A0A', color: '#FECACA' }}>
                          Verification failed. Invalid or expired OTP code.
                        </Alert>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ENROLLMENT MODAL (QR CODE VIEW) */}
      <Dialog open={enrollDialogOpen} onClose={() => setEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{enrollMethod === 'totp' ? 'Scan Authenticator QR Code' : 'Confirm Email MFA Enrollment'}</span>
          <IconButton onClick={() => setEnrollDialogOpen(false)} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#F8FAFC' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {enrollMethod === 'totp' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8', textAlign: 'center' }}>
                Scan this QR code with Google Authenticator, 1Password, Authy, or your password manager.
              </Typography>

              {qrCodeUrl ? (
                <Paper sx={{ p: 2, bgcolor: '#FFFFFF', borderRadius: 2 }}>
                  <img src={qrCodeUrl} alt="TOTP QR Code" style={{ display: 'block', width: 220, height: 220 }} />
                </Paper>
              ) : (
                <CircularProgress />
              )}

              {enrollData?.secret && (
                <Box sx={{ width: '100%', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                    Or enter secret manually:
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        color: '#38BDF8',
                        bgcolor: '#07111D',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        border: '1px solid #1E293B',
                      }}
                    >
                      {enrollData.secret}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={copiedSecret ? <Check fontSize="small" /> : <Copy fontSize="small" />}
                      onClick={() => copySecret(enrollData.secret!)}
                      sx={{ color: '#94A3B8' }}
                    >
                      {copiedSecret ? 'Copied' : 'Copy'}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {enrollMethod === 'email' && (
            <Alert severity="info" sx={{ bgcolor: '#07111D', color: '#94A3B8', border: '1px solid #1E293B', mt: 1 }}>
              A 6-digit confirmation code has been dispatched to your email address on file. Please enter it below.
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mt: 1 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>
              Enter 6-Digit Verification Code
            </Typography>
            <OtpBoxesInput
              value={verificationCode}
              onChange={setVerificationCode}
              onComplete={handleConfirmEnroll}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setEnrollDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmEnroll}
            disabled={verificationCode.length !== 6 || confirmEnrollMutation.isPending}
          >
            Verify & Activate MFA
          </Button>
        </DialogActions>
      </Dialog>

      {/* DISABLE MFA MODAL */}
      <Dialog open={disableDialogOpen} onClose={() => setDisableDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0B132B', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Disable Two-Factor Auth</span>
          <IconButton onClick={() => setDisableDialogOpen(false)} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#F8FAFC' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0B132B', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 1 }}>
            Confirm your account password to remove MFA protection.
          </Typography>
          <TextField
            label="Account Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            fullWidth
            size="small"
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', width: '100%' }}>
              Current MFA / OTP Code (optional)
            </Typography>
            <OtpBoxesInput
              value={disableCode}
              onChange={setDisableCode}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0B132B', p: 2 }}>
          <Button onClick={() => setDisableDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDisable}
            disabled={!disablePassword || disableMutation.isPending}
          >
            Disable MFA
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityPage;
