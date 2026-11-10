// src/pages/Signup/query.tsx
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { http } from "../../api/http/https";
import { ToastMsgs } from "../../api/toastUtils";
import type { SignupFormValues, SignupResponse } from "./types";

export const useSignupMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: SignupFormValues) => {
      return await http.post<SignupResponse>("/auth/basic_auth/signup", {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
    },
    onSuccess: (res) => {
      ToastMsgs.success(`Account created for ${res.email}! Please sign in.`);
      navigate("/login");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || "Registration failed. Please try again.";
      ToastMsgs.error(msg);
    },
  });
};
