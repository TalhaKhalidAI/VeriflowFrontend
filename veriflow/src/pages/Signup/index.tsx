// src/pages/Signup/index.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  LinearProgress,
  Divider,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Fingerprint,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useSignupMutation } from "./query";
import { signupSchema, type SignupFormValues } from "./types";

export function Signup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { mutate: signup, isPending: isLoading, error: mutationError } = useSignupMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = watch("password", "");

  const calculateStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score >= 4) return { score: 100, color: "success" as const, label: "Strong" };
    if (score === 3) return { score: 65, color: "info" as const, label: "Good" };
    if (score === 2) return { score: 40, color: "warning" as const, label: "Fair" };
    return { score: 20, color: "error" as const, label: "Weak" };
  };

  const strength = calculateStrength(passwordValue);

  const onSubmit = (data: SignupFormValues) => {
    signup(data);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 50%, #0F172A 0%, #020617 100%)",
        position: "relative",
        overflow: "hidden",
        py: 4,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: "100%", zIndex: 1 }}
      >
        <Container maxWidth="xs">
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              bgcolor: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            {/* Header */}
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Box
                sx={{
                  display: "inline-flex",
                  p: 1.5,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  mb: 1.5,
                }}
              >
                <Fingerprint sx={{ fontSize: 36, color: "#38BDF8" }} />
              </Box>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  color: "#F8FAFC",
                  letterSpacing: -0.5,
                }}
              >
                Create Account
              </Typography>
              <Typography variant="body2" sx={{ color: "#94A3B8", mt: 0.5 }}>
                Join VeriFlow Cryptographic Identity Engine
              </Typography>
            </Box>

            {mutationError && (
              <Fade in>
                <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                  {(mutationError as any)?.response?.data?.detail || (mutationError as any)?.message || "Failed to register account"}
                </Alert>
              </Fade>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth
                label="Full Name"
                {...register("name")}
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    color: "#F8FAFC",
                    bgcolor: "#07111D",
                    "& fieldset": { borderColor: "rgba(148, 163, 184, 0.3)" },
                    "&:hover fieldset": { borderColor: "#38BDF8" },
                  },
                  "& .MuiInputBase-input": { color: "#F8FAFC !important", WebkitTextFillColor: "#F8FAFC !important" },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: "#94A3B8" }} />
                    </InputAdornment>
                  ),
                }}
                placeholder="Talha Khalid"
                variant="outlined"
              />

              <TextField
                fullWidth
                label="Work Email"
                type="email"
                {...register("email")}
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    color: "#F8FAFC",
                    bgcolor: "#07111D",
                    "& fieldset": { borderColor: "rgba(148, 163, 184, 0.3)" },
                    "&:hover fieldset": { borderColor: "#38BDF8" },
                  },
                  "& .MuiInputBase-input": { color: "#F8FAFC !important", WebkitTextFillColor: "#F8FAFC !important" },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: "#94A3B8" }} />
                    </InputAdornment>
                  ),
                }}
                placeholder="user@example.com"
                variant="outlined"
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{
                  mb: 1.5,
                  "& .MuiOutlinedInput-root": {
                    color: "#F8FAFC",
                    bgcolor: "#07111D",
                    "& fieldset": { borderColor: "rgba(148, 163, 184, 0.3)" },
                    "&:hover fieldset": { borderColor: "#38BDF8" },
                  },
                  "& .MuiInputBase-input": { color: "#F8FAFC !important", WebkitTextFillColor: "#F8FAFC !important" },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: "#94A3B8" }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder="At least 8 characters"
                variant="outlined"
              />

              {passwordValue && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: "#94A3B8" }}>
                      Password Strength
                    </Typography>
                    <Typography variant="caption" sx={{ color: strength.color === "success" ? "#10B981" : strength.color === "info" ? "#38BDF8" : "#F59E0B", fontWeight: 700 }}>
                      {strength.label}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={strength.score}
                    color={strength.color}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              )}

              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "#F8FAFC",
                    bgcolor: "#07111D",
                    "& fieldset": { borderColor: "rgba(148, 163, 184, 0.3)" },
                    "&:hover fieldset": { borderColor: "#38BDF8" },
                  },
                  "& .MuiInputBase-input": { color: "#F8FAFC !important", WebkitTextFillColor: "#F8FAFC !important" },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        sx={{ color: "#94A3B8" }}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                placeholder="Re-enter password"
                variant="outlined"
              />

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  fullWidth
                  type="submit"
                  disabled={isLoading}
                  sx={{
                    py: 1.4,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "1rem",
                    textTransform: "none",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #1D4ED8 0%, #6D28D9 100%)",
                    },
                    "&:disabled": {
                      background: "#334155",
                      color: "#64748B",
                    },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} sx={{ color: "white" }} />
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </motion.div>
            </Box>

            <Divider sx={{ my: 3, borderColor: "rgba(255, 255, 255, 0.1)" }}>
              <Typography variant="caption" sx={{ color: "#64748B", px: 1 }}>
                ALREADY REGISTERED?
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate("/login")}
              sx={{
                py: 1.2,
                borderRadius: 2,
                borderColor: "rgba(255, 255, 255, 0.15)",
                color: "#38BDF8",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  borderColor: "#38BDF8",
                  bgcolor: "rgba(56, 189, 248, 0.1)",
                },
              }}
            >
              Sign In to Existing Account
            </Button>
          </Paper>
        </Container>
      </motion.div>
    </Box>
  );
}

export default Signup;
