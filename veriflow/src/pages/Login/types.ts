// src/pages/Login/types.ts
import * as z from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  mfa_code: z.string().optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export interface LoginResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  status?: string;
  message?: string;
  user?: {
    id: number | string;
    email: string;
    name?: string;
    role?: string;
    user_role?: string;
    permissions?: Record<string, boolean>;
    profile_pic?: string;
  };
}
