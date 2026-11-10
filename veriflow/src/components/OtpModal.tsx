// src/components/OtpModal.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Fade,
} from "@mui/material";
import {
  CloseRounded as CloseIcon,
  EmailRounded as EmailIcon,
  VpnKeyRounded as KeyIcon,
  ShieldRounded as ShieldIcon,
  RefreshRounded as RefreshIcon,
} from "@mui/icons-material";

/**
 * Masks an email for security while keeping key hints visible.
 * e.g., "talhakhalid77@gmail.com" -> "ta*********7*@gmail.com"
 */
export function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = String(email || "").split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  if (local.length <= 4) {
    return `${local[0]}**${local.slice(-1)}@${domain}`;
  }
  const prefix = local.slice(0, 2);
  const asterisks = "*".repeat(Math.max(4, local.length - 4));
  const penultimate = local.length > 5 ? local[local.length - 2] : "";
  return `${prefix}${asterisks}${penultimate}*@${domain}`;
}

// ============================================================================
// 6-BOX SEGMENTED OTP INPUT COMPONENT
// ============================================================================
export interface OtpBoxesInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

export const OtpBoxesInput: React.FC<OtpBoxesInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  onComplete,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [autoFocus, disabled]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = "";
      } else if (index > 0) {
        newDigits[index - 1] = "";
        inputRefs.current[index - 1]?.focus();
      }
      const updated = newDigits.join("");
      onChange(updated);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (!rawVal) return;

    const char = rawVal[rawVal.length - 1]; // take the latest typed digit
    const newDigits = [...digits];
    newDigits[index] = char;
    const updated = newDigits.join("");
    onChange(updated);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (updated.length === length) {
      onComplete?.(updated);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasteData) return;

    onChange(pasteData);
    const focusIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[focusIndex]?.focus();

    if (pasteData.length === length) {
      onComplete?.(pasteData);
    }
  };

  return (
    <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} justifyContent="center" sx={{ my: 2 }}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = Boolean(digits[i]);
        return (
          <Box
            key={i}
            component="input"
            ref={(el: HTMLInputElement | null) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={digits[i]}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onChange={(e) => handleChange(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            sx={{
              width: { xs: 40, sm: 48 },
              height: { xs: 50, sm: 58 },
              borderRadius: 2,
              textAlign: "center",
              fontFamily: "monospace",
              fontSize: { xs: 20, sm: 24 },
              fontWeight: 800,
              color: isFilled ? "#38BDF8" : "#94A3B8",
              bgcolor: isFilled ? "rgba(56, 189, 248, 0.08)" : "#07111D",
              border: `2px solid ${isFilled ? "#38BDF8" : "rgba(255, 255, 255, 0.12)"}`,
              outline: "none",
              transition: "all 0.2s ease-in-out",
              boxShadow: isFilled ? "0 0 12px rgba(56, 189, 248, 0.25)" : "none",
              "&:focus": {
                borderColor: "#38BDF8",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.45)",
                bgcolor: "rgba(56, 189, 248, 0.12)",
                transform: "translateY(-2px)",
              },
              "&:disabled": {
                opacity: 0.5,
                cursor: "not-allowed",
              },
            }}
          />
        );
      })}
    </Stack>
  );
};

// ============================================================================
// FANCY OTP MODAL
// ============================================================================
export interface OtpModalProps {
  open: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  method?: "totp" | "email";
  email?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onResendEmail?: () => Promise<void> | void;
  isResending?: boolean;
  actionButtonText?: string;
}

export const OtpModal: React.FC<OtpModalProps> = ({
  open,
  onClose,
  onVerify,
  title = "Two-Factor Verification",
  subtitle,
  method = "totp",
  email,
  isLoading = false,
  errorMessage = null,
  onResendEmail,
  isResending = false,
  actionButtonText = "Verify Code",
}) => {
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setOtp("");
      if (method === "email") {
        setResendCooldown(60);
      }
    }
  }, [open, method]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleConfirm = () => {
    if (otp.length === 6) {
      onVerify(otp);
    }
  };

  const handleResend = async () => {
    if (onResendEmail && resendCooldown <= 0 && !isResending) {
      await onResendEmail();
      setResendCooldown(60);
    }
  };

  const maskedEmail = email ? maskEmail(email) : "your registered email";
  const defaultSubtitle =
    method === "totp"
      ? "Enter the 6-digit code from your Authenticator app (Google Authenticator, Authy, etc.)."
      : `Enter the 6-digit security code sent to ${maskedEmail}.`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#0B132B",
          color: "#F8FAFC",
          borderRadius: 4,
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)",
          overflow: "hidden",
          p: { xs: 1, sm: 2 },
        },
      }}
    >
      {/* Top Header with Glowing Icon & Cross Button */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          pt: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              p: 1,
              borderRadius: 2.5,
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            {method === "email" ? (
              <EmailIcon sx={{ color: "#38BDF8", fontSize: 24 }} />
            ) : (
              <ShieldIcon sx={{ color: "#38BDF8", fontSize: 24 }} />
            )}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: "#F8FAFC", lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Chip
              size="small"
              icon={method === "email" ? <EmailIcon sx={{ fontSize: "12px !important" }} /> : <KeyIcon sx={{ fontSize: "12px !important" }} />}
              label={method === "email" ? "EMAIL OTP CODE" : "AUTHENTICATOR TOTP"}
              sx={{
                height: 18,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.5,
                bgcolor: "rgba(56, 189, 248, 0.15)",
                color: "#38BDF8",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                mt: 0.5,
              }}
            />
          </Box>
        </Box>

        {/* Cross / Close Button */}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "#94A3B8",
            bgcolor: "rgba(255, 255, 255, 0.05)",
            "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)", color: "#EF4444" },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column" }}>
        <Typography variant="body2" sx={{ color: "#94A3B8", mb: 1, lineHeight: 1.5 }}>
          {subtitle || defaultSubtitle}
        </Typography>

        {errorMessage && (
          <Fade in>
            <Alert
              severity="error"
              sx={{
                mb: 1.5,
                bgcolor: "rgba(239, 68, 68, 0.12)",
                color: "#FCA5A5",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 2,
                fontSize: "0.85rem",
              }}
            >
              {errorMessage}
            </Alert>
          </Fade>
        )}

        {/* 6 Digit Boxed Inputs */}
        <OtpBoxesInput
          value={otp}
          onChange={setOtp}
          disabled={isLoading}
          onComplete={(code) => onVerify(code)}
        />

        {onResendEmail && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              mt: 2,
              p: 1.5,
              bgcolor: "rgba(15, 23, 42, 0.65)",
              borderRadius: 2.5,
              border: "1px solid rgba(56, 189, 248, 0.15)",
            }}
          >
            <Typography variant="caption" sx={{ color: "#94A3B8", textAlign: "center" }}>
              {method === "email"
                ? "Didn't receive the verification code?"
                : "Can't access your Authenticator app?"}
            </Typography>
            <Button
              size="small"
              onClick={handleResend}
              disabled={isResending || isLoading || resendCooldown > 0}
              startIcon={
                isResending ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <RefreshIcon sx={{ fontSize: "14px !important" }} />
                )
              }
              sx={{
                textTransform: "none",
                color: resendCooldown > 0 ? "#64748B" : "#38BDF8",
                fontWeight: 700,
                fontSize: "0.82rem",
                "&:hover": { color: "#60A5FA", bgcolor: "rgba(56, 189, 248, 0.08)" },
              }}
            >
              {isResending
                ? "Dispatching code..."
                : resendCooldown > 0
                ? `Resend to ${maskedEmail} (${resendCooldown}s)`
                : method === "email"
                ? `Resend to ${maskedEmail}`
                : `Send code to ${maskedEmail}`}
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, display: "flex", gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            color: "#94A3B8",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            px: 2,
            "&:hover": { color: "#F8FAFC", bgcolor: "rgba(255, 255, 255, 0.05)" },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={otp.length !== 6 || isLoading}
          sx={{
            flex: 1,
            py: 1.1,
            borderRadius: 2,
            background: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "0.95rem",
            textTransform: "none",
            boxShadow: "0 4px 15px rgba(14, 165, 233, 0.4)",
            "&:hover": {
              background: "linear-gradient(135deg, #0284C7 0%, #1D4ED8 100%)",
            },
            "&:disabled": {
              background: "#1E293B",
              color: "#64748B",
            },
          }}
        >
          {isLoading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : actionButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
