// src/pages/Admin/types.ts

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  user_role?: string;
  disabled: boolean;
  is_deleted: boolean;
  permissions: Record<string, boolean>;
  mfa_enabled?: boolean;
  mfa_method?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionListResponse {
  permissions: string[];
}

export interface UserPermissionItem {
  user_id: number;
  user_email?: string;
  user_name?: string;
  permissions: Record<string, boolean>;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: string;
  user_role?: string;
  is_active?: boolean;
}

export interface PasswordConfirmPayload {
  password?: string;
  otp?: string;
}

export interface UpdatePasswordPayload {
  new_password: string;
  old_password?: string;
  otp?: string;
}

export interface SetPermissionsPayload {
  user_id: number;
  permissions: Record<string, boolean>;
}

export interface BulkPermissionsPayload {
  all_user_permissions: Array<{
    user_id: number;
    permissions: Record<string, boolean>;
  }>;
}

export interface RemovePermissionsPayload {
  user_id: number;
  permission_keys?: string[];
  remove_all?: boolean;
}

export interface TempTokenResponse {
  temp_token?: string;
  token?: string;
  expires_in?: number;
  user_id: number;
  message?: string;
}
