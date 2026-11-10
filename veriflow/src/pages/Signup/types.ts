// src/pages/Signup/types.ts
import * as z from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(2, "Full Name must be at least 2 characters"),
    email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

export interface SignupResponse {
  id: number;
  name: string;
  email: string;
  user_role?: string;
  permissions?: Record<string, any>;
  profile_pic?: string;
}
