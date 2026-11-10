// src/pages/Login/index.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Fade,
  Chip,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  VpnKeyRounded,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from './query';
import { loginSchema, type LoginFormValues } from './types';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import { OtpModal, maskEmail } from '../../components/OtpModal';

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // MFA Challenge State
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'email'>('totp');
  const [savedFormValues, setSavedFormValues] = useState<LoginFormValues | null>(null);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  const { mutate: login, isPending: isLoading } = useLoginMutation();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setLoginError(null);
    setSavedFormValues(data);
    login(data, {
      onError: (err: any) => {
        if (err?.isMFA) {
          const method = err.method || 'totp';
          const targetEmail = err.email || data.email;
          setMfaMethod(method);
          setMfaError(null);
          if (err.email) {
            setSavedFormValues((prev) => (prev ? { ...prev, email: err.email } : prev));
          }
          setMfaModalOpen(true);
          if (method === 'email' && targetEmail) {
            http.post('/email_otp/send', { email: targetEmail, purpose: 'login_2fa' })
              .then(() => ToastMsgs.info(`Verification code sent to ${maskEmail(targetEmail)}`))
              .catch(() => {});
          }
        } else {
          setLoginError(err?.response?.data?.detail || err?.data?.detail || err?.message || 'Authentication failed');
        }
      },
    });
  };

  const handleResendEmailOtp = async () => {
    if (!savedFormValues?.email) return;
    setIsResendingOtp(true);
    try {
      await http.post('/email_otp/send', {
        email: savedFormValues.email,
        purpose: 'login_2fa',
      });
      setMfaMethod('email');
      ToastMsgs.info(`Security code sent to ${maskEmail(savedFormValues.email)}`);
    } catch (err: any) {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to send email verification code');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleMfaSubmit = (codeToVerify: string) => {
    if (!savedFormValues || codeToVerify.length !== 6) return;
    setLoginError(null);
    setMfaError(null);
    login(
      {
        ...savedFormValues,
        mfa_code: codeToVerify.trim(),
      },
      {
        onSuccess: () => {
          setMfaModalOpen(false);
        },
        onError: (err: any) => {
          setMfaError(
            err?.response?.data?.detail ||
            err?.data?.detail ||
            err?.message ||
            'Invalid or expired verification code. Please check and try again.'
          );
        },
      }
    );
  };

  const quickFill = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 50%, #0F172A 0%, #020617 100%)',
        position: 'relative',
        overflow: 'hidden',
        py: 4,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', zIndex: 1 }}
      >
        <Container maxWidth="xs">
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              bgcolor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Industrial Header */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: '#0B1323',
                  border: '2px solid #FACC15',
                  mb: 1.5,
                  boxShadow: '0 0 20px rgba(250, 204, 21, 0.2)',
                }}
              >
                <img
                  src="/msi_white.png"
                  alt="VeriFlow Logo"
                  style={{ width: 48, height: 42, objectFit: 'contain' }}
                />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  color: '#FACC15',
                  textShadow: '0 0 15px rgba(250, 204, 21, 0.3)',
                }}
              >
                VERIFLOW
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5, fontWeight: 600, letterSpacing: '0.02em' }}>
                Industrial QR Verification & Audit System
              </Typography>
            </Box>

            {/* Quick fill chips */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1, textAlign: 'center' }}>
                Quick Fill for Testing:
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  label="Admin (All Access)"
                  icon={<VpnKeyRounded sx={{ fontSize: '14px !important' }} />}
                  onClick={() => quickFill('admin@example.com', 'Talha@6295')}
                  sx={{
                    bgcolor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60A5FA',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.25)' },
                  }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label="Worker Operator"
                  onClick={() => quickFill('talha@poste.talha.pk', 'Talha@6295')}
                  sx={{
                    bgcolor: 'rgba(234, 179, 8, 0.15)',
                    color: '#FACC15',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(234, 179, 8, 0.25)' },
                  }}
                  variant="outlined"
                />
              </Stack>
            </Box>

            {/* Error Message */}
            {loginError && (
              <Fade in>
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {loginError}
                </Alert>
              </Fade>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth
                label="Username or Email"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: '#F8FAFC',
                    bgcolor: '#07111D',
                    '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.3)' },
                    '&:hover fieldset': { borderColor: '#38BDF8' },
                    '&.Mui-focused fieldset': { borderColor: '#FACC15' },
                  },
                  '& .MuiInputBase-input': {
                    color: '#F8FAFC !important',
                    WebkitTextFillColor: '#F8FAFC !important',
                  },
                  '& .MuiInputLabel-root': { color: '#94A3B8' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#FACC15' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: '#94A3B8' }} />
                    </InputAdornment>
                  ),
                }}
                placeholder="username or email@company.com"
                variant="outlined"
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    color: '#F8FAFC',
                    bgcolor: '#07111D',
                    '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.3)' },
                    '&:hover fieldset': { borderColor: '#38BDF8' },
                    '&.Mui-focused fieldset': { borderColor: '#FACC15' },
                  },
                  '& .MuiInputBase-input': {
                    color: '#F8FAFC !important',
                    WebkitTextFillColor: '#F8FAFC !important',
                  },
                  '& .MuiInputLabel-root': { color: '#94A3B8' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#FACC15' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: '#94A3B8' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: '#94A3B8' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder="••••••••"
                variant="outlined"
              />



              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button
                  size="small"
                  onClick={() => setRememberMe(!rememberMe)}
                  sx={{
                    p: 0,
                    textTransform: 'none',
                    color: rememberMe ? '#60A5FA' : '#94A3B8',
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '4px',
                      border: `2px solid ${rememberMe ? '#3B82F6' : '#64748B'}`,
                      mr: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: rememberMe ? '#3B82F6' : 'transparent',
                    }}
                  >
                    {rememberMe && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: 'white' }} />
                    )}
                  </Box>
                  Remember me
                </Button>
                <Button
                  variant="text"
                  size="small"
                  sx={{
                    textTransform: 'none',
                    color: '#94A3B8',
                    '&:hover': { color: '#60A5FA' },
                  }}
                >
                  Forgot password?
                </Button>
              </Box>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  fullWidth
                  type="submit"
                  disabled={isLoading}
                  sx={{
                    py: 1.4,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #1D4ED8 0%, #6D28D9 100%)',
                    },
                    '&:disabled': {
                      background: '#334155',
                      color: '#64748B',
                    },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                  ) : (
                    'Authenticate & Enter'
                  )}
                </Button>
              </motion.div>

              {/* Sign Up Navigation */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#94A3B8', mb: 1.5 }}>
                  Don't have an account yet?
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/signup')}
                  sx={{
                    py: 1.2,
                    borderRadius: 2,
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    color: '#38BDF8',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#38BDF8',
                      bgcolor: 'rgba(56, 189, 248, 0.1)',
                    },
                  }}
                >
                  Create New Account (Sign Up)
                </Button>
              </Box>
            </Box>
          </Paper>
        </Container>
      </motion.div>

      {/* FANCY MFA TWO-FACTOR CHALLENGE MODAL */}
      <OtpModal
        open={mfaModalOpen}
        onClose={() => setMfaModalOpen(false)}
        onVerify={handleMfaSubmit}
        title="Two-Factor Authentication"
        subtitle={
          mfaMethod === "totp"
            ? "Enter the 6-digit security code generated by your Authenticator app."
            : `Enter the 6-digit security code sent to ${maskEmail(savedFormValues?.email || "your registered email")}.`
        }
        method={mfaMethod}
        email={savedFormValues?.email}
        isLoading={isLoading}
        errorMessage={mfaError}
        onResendEmail={handleResendEmailOtp}
        isResending={isResendingOtp}
        actionButtonText="Verify & Sign In"
      />
    </Box>
  );
}

export default Login;
