// src/pages/Admin/query.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import { useAuthStore } from '../../store/authStore';
import type {
  AdminUser,
  PermissionListResponse,
  UpdateUserPayload,
  PasswordConfirmPayload,
  UpdatePasswordPayload,
  SetPermissionsPayload,
  BulkPermissionsPayload,
  RemovePermissionsPayload,
  TempTokenResponse,
} from './types';

export interface UserQueryOptions {
  show_disabled?: boolean;
  show_deleted?: boolean;
  show_permissions?: boolean;
}

export const useAdminUsersQuery = (options: UserQueryOptions & { enabled?: boolean } = {}) => {
  const { show_disabled = true, show_deleted = false, show_permissions = true, enabled } = options;
  const user = useAuthStore((state) => state.user);
  const isQueryEnabled = enabled !== undefined ? (enabled && Boolean(user?.id)) : Boolean(user?.id);

  return useQuery({
    queryKey: ['admin', 'users', show_disabled, show_deleted, show_permissions],
    enabled: isQueryEnabled,
    queryFn: async (): Promise<AdminUser[]> => {
      // 1. Fetch full user config accounts from GET /users/users_config/users
      let usersList: any[] = [];
      try {
        const fullUsers = await http.get<{ users: any[] }>(
          `/users/users_config/users?limit=200&show_disabled=${show_disabled}&show_deleted=${show_deleted}&show_permissions=${show_permissions}`
        );
        usersList = fullUsers?.users || [];
      } catch (err) {
        console.warn('Could not load user accounts from users_config/users', err);
      }

      // 2. Fetch permissions mapping if requested and user is admin/authorized
      let permUsers: Record<string, any> = {};
        const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
        const canViewPerms =
          isAdmin ||
          Boolean(user?.permissions?.['admin.users.view']) ||
          Boolean(user?.permissions?.['admin.access']) ||
          Boolean(user?.permissions?.['admin.users']);
        if (show_permissions && canViewPerms) {
          try {
            const permData = await http.get<{
              users: Record<string, { email: string; name: string; role: string; permissions: Record<string, boolean> }>;
            }>('/admin/admin_access/users/permissions?include_user_info=true&limit=200');
            permUsers = permData.users || {};
          } catch (e) {
            console.warn('Could not load permissions mapping', e);
          }
        }

        // If usersList was returned from /users/users_config/users, map directly
        if (usersList.length > 0) {
          return usersList.map((u: any) => {
            const pInfo = permUsers[String(u.id)] || {};
            return {
              id: u.id,
              email: u.email || pInfo.email || '',
              name: u.name || pInfo.name || '',
              role: u.user_role || pInfo.role || 'user',
              user_role: u.user_role || pInfo.role || 'user',
              disabled: Boolean(u.disabled),
              is_deleted: Boolean(u.is_deleted),
              permissions: show_permissions ? (u.permissions || pInfo.permissions || {}) : {},
              mfa_enabled: Boolean(u.mfa_enabled),
              mfa_method: u.mfa_method,
            };
          });
        }

        // Fallback if permUsers exists
        if (Object.keys(permUsers).length > 0) {
          return Object.entries(permUsers).map(([idStr, u]: [string, any]) => ({
            id: Number(idStr),
            email: u.email || '',
            name: u.name || '',
            role: u.role || 'user',
            user_role: u.role || 'user',
            disabled: false,
            is_deleted: false,
            permissions: show_permissions ? (u.permissions || {}) : {},
            mfa_enabled: false,
          }));
        }

        // Final fallback: return current user's own profile
        try {
          const profile = await http.get<any>('/users/users_config/me');
          if (profile && profile.id) {
            return [{
              id: profile.id,
              email: profile.email || '',
              name: profile.name || '',
              role: profile.user_role || profile.role || 'user',
              user_role: profile.user_role || profile.role || 'user',
              disabled: Boolean(profile.disabled),
              is_deleted: Boolean(profile.is_deleted),
              permissions: profile.permissions || user?.permissions || {},
              mfa_enabled: Boolean(profile.mfa_enabled),
              mfa_method: profile.mfa_method,
            }];
          }
        } catch (e) {
          console.warn('Could not fetch self profile', e);
        }

        if (user?.id) {
          return [{
            id: Number(user.id),
            email: user.email || '',
            name: user.name || '',
            role: user.role || user.user_role || 'user',
            user_role: user.user_role || user.role || 'user',
            disabled: false,
            is_deleted: false,
            permissions: user.permissions || {},
          }];
        }
        return [];
      },
      staleTime: 1000 * 30,
  });
};

export const useAllPermissionsQuery = (enabled?: boolean) => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  const canViewAll =
    isAdmin ||
    Boolean(user?.permissions?.['admin.users.view']) ||
    Boolean(user?.permissions?.['user.view.any']) ||
    Boolean(user?.permissions?.['admin.access']) ||
    Boolean(user?.permissions?.['admin.users']);
  const canManageSelf =
    Boolean(user?.permissions?.['user.view.self']) ||
    Boolean(user?.permissions?.['user.update.self']) ||
    Boolean(user?.permissions?.['user.update.profile']) ||
    Boolean(user?.permissions?.['user.update.password']);

  const isQueryEnabled = enabled !== undefined ? (enabled && (canViewAll || canManageSelf)) : (canViewAll || canManageSelf);

  return useQuery({
    queryKey: ['admin', 'all_permissions'],
    enabled: isQueryEnabled,
    queryFn: async () => {
      const res = await http.get<PermissionListResponse>('/admin/admin_access/get_all_permissions');
      return res.permissions || [];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload: UpdateUserPayload }) => {
      return await http.put<AdminUser>(`/admin/admin_access/account/${userId}`, payload);
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`Account for User #${vars.userId} updated`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to update account');
    },
  });
};

export const useDisableAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload?: PasswordConfirmPayload }) => {
      return await http.post(`/admin/admin_access/account/disable/${userId}`, payload || {});
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`User #${vars.userId} account disabled`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to disable account');
    },
  });
};

export const useEnableAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload?: PasswordConfirmPayload }) => {
      return await http.post(`/admin/admin_access/account/enable/${userId}`, payload || {});
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`User #${vars.userId} account enabled`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to enable account');
    },
  });
};

export const useDeleteAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload?: PasswordConfirmPayload }) => {
      return await http.delete(`/admin/admin_access/account/${userId}`, { data: payload || {} });
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`User #${vars.userId} soft-deleted`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to delete account');
    },
  });
};

export const useRestoreAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, otp }: { userId: number; otp?: string }) => {
      const url = otp
        ? `/admin/admin_access/account/restore/${userId}?otp=${encodeURIComponent(otp)}`
        : `/admin/admin_access/account/restore/${userId}`;
      return await http.post(url);
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`User #${vars.userId} account restored`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to restore account');
    },
  });
};

export const useUpdatePasswordMutation = () => {
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload: UpdatePasswordPayload }) => {
      return await http.put(`/admin/admin_access/account/password/${userId}`, payload);
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`Password updated successfully for User #${vars.userId}`);
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to update password');
    },
  });
};

export const useTempTokenMutation = () => {
  return useMutation({
    mutationFn: async ({
      userId,
      restorePasswd,
      otp,
    }: {
      userId: number;
      restorePasswd?: boolean;
      otp?: string;
    }) => {
      const params = new URLSearchParams();
      if (restorePasswd) params.append('restore_passwd', 'true');
      if (otp) params.append('otp', otp);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await http.post<TempTokenResponse>(`/admin/admin_access/account/temp_token/${userId}${query}`);
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`Temporary token issued for User #${vars.userId}`);
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to generate temporary token');
    },
  });
};

export const useResetAutoKillMutation = () => {
  return useMutation({
    mutationFn: async (otp?: string) => {
      const url = otp
        ? `/admin/admin_access/reset-auto-kill?otp=${encodeURIComponent(otp)}`
        : '/admin/admin_access/reset-auto-kill';
      return await http.post(url);
    },
    onSuccess: () => {
      ToastMsgs.success('Safety Mode / Auto-Kill Switch has been reset successfully');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to reset Auto-Kill');
    },
  });
};

export const useSetPermissionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SetPermissionsPayload) => {
      return await http.post('/admin/admin_access/set_permissions', payload);
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`Permissions updated for User #${vars.user_id}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to set permissions');
    },
  });
};

export const useBulkSetPermissionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkPermissionsPayload) => {
      return await http.post('/admin/admin_access/set_permissions_bulk', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Bulk permissions assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to apply bulk permissions');
    },
  });
};

export const useRemovePermissionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RemovePermissionsPayload) => {
      return await http.delete('/admin/admin_access/remove_permissions', { data: payload });
    },
    onSuccess: (_, vars) => {
      ToastMsgs.success(`Permissions removed for User #${vars.user_id}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to remove permissions');
    },
  });
};
