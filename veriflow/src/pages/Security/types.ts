// src/pages/Security/types.ts

export interface MFAStatusResponse {
  mfa_enabled: boolean;
  mfa_method: 'totp' | 'email' | null;
}

export interface StartEnrollPayload {
  method: 'totp' | 'email';
}

export interface StartEnrollResponse {
  method: 'totp' | 'email';
  secret?: string;
  otpauth_uri?: string;
  issuer?: string;
  expires_in?: number;
  message?: string;
  masked_email?: string;
}

export interface ConfirmEnrollPayload {
  method: 'totp' | 'email';
  code: string;
}

export interface DisableMFAPayload {
  password: string;
  code?: string;
}

export type OTPPurposeType =
  | 'verification'
  | 'login_2fa'
  | 'password_reset'
  | 'mfa_enroll_email'
  | 'mfa_disable'
  | 'account_restore'
  | 'kill_switch_reset';

export interface SendEmailOTPPayload {
  email: string;
  purpose?: string;
}

export interface VerifyEmailOTPPayload {
  email: string;
  purpose?: string;
  code: string;
}
