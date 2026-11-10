import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  Fade,
  Divider,
} from '@mui/material';
import {
  LockRounded as LockIcon,
  Visibility,
  VisibilityOff,
  TimerRounded as TimerIcon,
  CheckCircleRounded as SuccessIcon,
  ErrorRounded as ErrorIcon,
  VpnKeyRounded as KeyIcon,
  RestoreRounded as RestoreIcon,
  ShieldRounded as ShieldIcon,
  ArrowForwardRounded as ArrowIcon,
} from '@mui/icons-material';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';

// ============================================================================
// Types
// ============================================================================
interface SLTPayload {
  sub: string;
  user_id: number;
  name: string;
  role: string;
  type: string;
  types: string;
  purpose: 'password_restore' | 'account_restoration' | string;
  exp: number;
  iat: number;
  jti: string;
}

function parseAndValidateSLT(token: string | null): { payload: SLTPayload | null; error: string | null } {
  if (!token || !token.trim()) {
    return {
      payload: null,
      error: 'No temporary token provided. This recovery page strictly requires a valid 2-minute Short-Lived Token (SLT).',
    };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return {
      payload: null,
      error: 'Malformed token. The provided recovery token must be a valid 3-part signed JWT.',
    };
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload) as SLTPayload;

    // Strict Check 1: Must be SLT
    if (payload.types !== 'slts') {
      return {
        payload: null,
        error:
          'STRICT POLICY VIOLATION: The provided token is not a Temporary Short-Lived Token (SLT). Standard session or refresh tokens are strictly rejected.',
      };
    }

    // Strict Check 2: Expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      return {
        payload: null,
        error:
          'TEMPORARY TOKEN EXPIRED: This SLT token has exceeded its 120-second lifetime. Please ask your administrator to issue a fresh temporary token.',
      };
    }

    // Strict Check 3: Purpose
    if (payload.purpose !== 'password_restore' && payload.purpose !== 'account_restoration') {
      return {
        payload: null,
        error: `INVALID SLT PURPOSE: Token purpose "${payload.purpose}" is not authorized for password or account restoration.`,
      };
    }

    return { payload, error: null };
  } catch {
    return {
      payload: null,
      error: 'Failed to decode token payload. Please ensure the full token URL was copied without truncation.',
    };
  }
}

// ============================================================================
// Recovery Page Component
// ============================================================================
export const RecoveryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState<string>(tokenParam);

  // Decode & validate SLT token
  const { payload, error: tokenError } = useMemo(() => {
    return parseAndValidateSLT(tokenInput);
  }, [tokenInput]);

  // Live Countdown (starts at max 120s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!payload?.exp) return 0;
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  });

  useEffect(() => {
    if (!payload?.exp) return;

    const tick = () => {
      const remaining = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
      setSecondsRemaining(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [payload?.exp]);

  const isExpired = Boolean(payload && secondsRemaining <= 0);

  // Form States for Password Reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Handler for Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload || isExpired) return;

    if (newPassword.length < 6) {
      setSubmissionError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmissionError('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await http.put(
        `/admin/admin_access/account/password/${payload.user_id}`,
        {
          new_password: newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenInput.trim()}`,
          },
        }
      );

      setActionSuccess('Password has been successfully updated! Your temporary token has been burned.');
      ToastMsgs.success('Password reset successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.data?.detail || err?.message || 'Failed to update password';
      setSubmissionError(String(msg));
      ToastMsgs.error(String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Account Restoration / Enablement
  const handleRestoreAccount = async () => {
    if (!payload || isExpired) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // First attempt restore (in case user is soft-deleted)
      try {
        await http.post(
          `/admin/admin_access/account/restore/${payload.user_id}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokenInput.trim()}`,
            },
          }
        );
      } catch (restoreErr: any) {
        // If not soft-deleted, enable the account
        await http.post(
          `/admin/admin_access/account/enable/${payload.user_id}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokenInput.trim()}`,
            },
          }
        );
      }

      setActionSuccess(`Account #${payload.user_id} (${payload.sub}) has been successfully restored and enabled!`);
      ToastMsgs.success('Account restored successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.data?.detail || err?.message || 'Failed to restore account';
      setSubmissionError(String(msg));
      ToastMsgs.error(String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordMode = payload?.purpose === 'password_restore';
  const isRestoreMode = payload?.purpose === 'account_restoration';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#030712',
        backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 60%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: { xs: 2, sm: 4 },
      }}
    >
      {/* Brand Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
            }}
          >
            <ShieldIcon sx={{ color: '#FFFFFF', fontSize: 26 }} />
          </Box>
          <Typography variant="h5" fontWeight={900} sx={{ color: '#F8FAFC', letterSpacing: 1.5 }}>
            VERIFLOW
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
          Short-Lived Token (SLT) Security Gateway
        </Typography>
      </Box>

      {/* Main Card */}
      <Card
        sx={{
          width: '100%',
          maxWidth: 480,
          bgcolor: '#0B132B',
          borderRadius: 3.5,
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Expiration Progress Bar */}
        {payload && !isExpired && (
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (secondsRemaining / 120) * 100)}
            sx={{
              height: 4,
              bgcolor: 'rgba(56, 189, 248, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: secondsRemaining < 20 ? '#EF4444' : secondsRemaining < 50 ? '#F59E0B' : '#38BDF8',
              },
            }}
          />
        )}

        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {/* Card Title & Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  bgcolor: isPasswordMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: isPasswordMode ? '#38BDF8' : '#34D399',
                  display: 'flex',
                }}
              >
                {isPasswordMode ? <KeyIcon /> : <RestoreIcon />}
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC', lineHeight: 1.2 }}>
                  {isPasswordMode ? 'Reset Account Password' : isRestoreMode ? 'Restore User Account' : 'Account Recovery Gateway'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  2-Minute Single-Use SLT Token
                </Typography>
              </Box>
            </Box>

            {payload && !isExpired && (
              <Chip
                icon={<TimerIcon sx={{ fontSize: '14px !important' }} />}
                label={`${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`}
                size="small"
                sx={{
                  bgcolor: secondsRemaining < 20 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                  color: secondsRemaining < 20 ? '#F87171' : '#38BDF8',
                  fontWeight: 800,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              />
            )}
          </Box>

          {/* Action Success State */}
          {actionSuccess ? (
            <Fade in>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <SuccessIcon sx={{ fontSize: 56, color: '#34D399', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#F8FAFC', mb: 1 }}>
                  Action Completed!
                </Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
                  {actionSuccess}
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  endIcon={<ArrowIcon />}
                  onClick={() => navigate('/login')}
                  sx={{
                    py: 1.2,
                    background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                  }}
                >
                  Proceed to Sign In
                </Button>
              </Box>
            </Fade>
          ) : tokenError || isExpired ? (
            /* Error / Expired State */
            <Box sx={{ py: 1 }}>
              <Alert
                severity="error"
                icon={<ErrorIcon fontSize="inherit" />}
                sx={{
                  bgcolor: 'rgba(239, 68, 68, 0.12)',
                  color: '#FCA5A5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 2,
                  mb: 2.5,
                  '& .MuiAlert-icon': { color: '#EF4444' },
                }}
              >
                {isExpired
                  ? 'TEMPORARY TOKEN EXPIRED: This SLT token has exceeded its 120-second validity window. Please ask an administrator to generate a fresh token.'
                  : tokenError}
              </Alert>

              {/* Manual token input option */}
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1 }}>
                Have an unexpired SLT token? Paste it below:
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#07111D',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    '& fieldset': { borderColor: '#1E293B' },
                    '&:hover fieldset': { borderColor: '#38BDF8' },
                  },
                }}
              />

              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/login')}
                sx={{
                  color: '#94A3B8',
                  borderColor: '#1E293B',
                  textTransform: 'none',
                  borderRadius: 2,
                }}
              >
                Back to Sign In
              </Button>
            </Box>
          ) : (
            /* Active Valid SLT Form */
            <Box>
              {/* Target User Details Banner */}
              <Box
                sx={{
                  p: 1.5,
                  mb: 2.5,
                  bgcolor: '#07111D',
                  borderRadius: 2,
                  border: '1px solid #1E293B',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontWeight: 600 }}>
                    TARGET ACCOUNT
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                    {payload?.name || 'User'} ({payload?.sub})
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`UID #${payload?.user_id}`}
                  sx={{ bgcolor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', fontWeight: 700, fontSize: 11 }}
                />
              </Box>

              {submissionError && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
                    bgcolor: 'rgba(239, 68, 68, 0.12)',
                    color: '#FCA5A5',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 2,
                    fontSize: '0.85rem',
                  }}
                >
                  {submissionError}
                </Alert>
              )}

              {/* Mode A: Password Reset Form */}
              {isPasswordMode && (
                <Box component="form" onSubmit={handleResetPassword}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', mb: 1.5, display: 'block' }}>
                    Enter your new secure account password below:
                  </Typography>

                  <TextField
                    fullWidth
                    label="New Password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting || isExpired}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        color: '#F8FAFC',
                        bgcolor: '#07111D',
                        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.3)' },
                        '&:hover fieldset': { borderColor: '#38BDF8' },
                      },
                      '& .MuiInputBase-input': { color: '#F8FAFC !important', WebkitTextFillColor: '#F8FAFC !important' },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#94A3B8' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#94A3B8' }}>
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting || isExpired}
                    sx={{
                      mb: 2.5,
                      '& .MuiOutlinedInput-root': {
                        color: '#F8FAFC',
                        bgcolor: '#07111D',
                        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.3)' },
                        '&:hover fieldset': { borderColor: '#38BDF8' },
                      },
                      '& .MuiInputBase-input': { color: '#F8FAFC !important', WebkitTextFillColor: '#F8FAFC !important' },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#94A3B8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={isSubmitting || isExpired || !newPassword || !confirmPassword}
                    sx={{
                      py: 1.2,
                      background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(14, 165, 233, 0.4)',
                    }}
                  >
                    {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Confirm & Reset Password'}
                  </Button>
                </Box>
              )}

              {/* Mode B: Account Restoration Form */}
              {isRestoreMode && (
                <Box sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2.5 }}>
                    This verified temporary token authorizes immediate reactivation of your account.
                    Click below to restore access.
                  </Typography>

                  <Button
                    variant="contained"
                    fullWidth
                    color="success"
                    onClick={handleRestoreAccount}
                    disabled={isSubmitting || isExpired}
                    startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <RestoreIcon />}
                    sx={{
                      py: 1.3,
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    {isSubmitting ? 'Restoring Account...' : 'Restore & Activate Account'}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Footer note */}
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textAlign: 'center' }}>
            Protected by VeriFlow Cryptographic Security • SLT Burn-on-Use
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RecoveryPage;
