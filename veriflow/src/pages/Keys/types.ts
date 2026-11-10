// src/pages/Keys/types.ts

export interface KeyRecord {
  id: string;
  name: string;
  kid: string;
  public_key: string;
  status: 'active' | 'revoked' | 'expired' | string;
  algorithm?: string;
  created_by?: number | null;
  issued_by?: number | null;
  created_at?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
}

export interface KeyListResponse {
  items: KeyRecord[];
  limit: number;
  offset: number;
  total: number;
}

export interface JWKKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  public_key: string;
}

export interface JWKSResponse {
  keys: JWKKey[];
}

export interface CreateKeyPayload {
  name: string;
  kid?: string;
  key_size: number;
  target_user_id?: number | null;
  assigned_permissions?: string[];
}

export interface RotateKeyPayload {
  name: string;
  key_size: number;
  target_user_id?: number | null;
}

export interface RevokeKeyPayload {
  reason: string;
}

export interface ExportPrivateKeyResponse {
  status: string;
  key_id: string;
  kid: string;
  private_key: string;
  authorized_by?: number;
}

export type TokenDurationUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export interface IssueTokenPayload {
  target_user_id?: number | null;
  key_id?: string;
  expires_in_minutes?: number;
  expires_in_value?: number;
  expires_in_unit?: TokenDurationUnit;
  assigned_permissions?: string[];
  extra_claims?: Record<string, any>;
}

export interface IssueTokenResponse {
  token: string;
  kid: string;
  expires_at: string;
  token_type?: string;
}

export interface VerifyTokenPayload {
  token: string;
}

export interface VerifyTokenResponse {
  status: string;
  valid: boolean;
  kid?: string;
  payload?: Record<string, any>;
  message?: string;
}

export interface GenerateTagQRPayload {
  key_id?: string;
  payload: Record<string, any>;
  expires_in_value: number;
  expires_in_unit: TokenDurationUnit;
  box_size?: number;
  border?: number;
  format?: 'json' | 'png';
  raw_claims_only?: boolean;
}

export interface ProductTagQRResponse {
  status: string;
  key_id: string;
  kid: string;
  token: string;
  qr_code_base64: string;
  created_by: number;
  created_by_email: string;
  expires_at: string;
  expires_in_seconds: number;
  qr_version: number;
  payload: Record<string, any>;
}

export interface ExportPrivateKeyPayload {
  keyId: string;
  password: string;
  otp?: string;
}

export interface DeleteKeyResponse {
  status: string;
  message: string;
  key: KeyRecord;
  removed_rules: number;
  removed_shifts: number;
  removed_active_shifts: number;
  removed_scans: number;
}
