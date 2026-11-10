// src/pages/Login/query.tsx
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { http } from '../../api/http/https';
import { useAuthStore, type User } from '../../store/authStore';
import { ToastMsgs } from '../../api/toastUtils';
import type { LoginFormValues, LoginResponse } from './types';

export const useLoginMutation = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (data: LoginFormValues) => {
      let res: LoginResponse;
      try {
        res = await http.post<LoginResponse>(
          '/auth/basic_auth/login?cookie_login=true',
          {
            username: data.email,
            password: data.password,
            mfa_code: data.mfa_code || undefined,
          }
        );
      } catch (err: any) {
        if (err?.isMFA) {
          throw err;
        }

        const status = err?.status || err?.response?.status;
        const data = err?.data || err?.response?.data;
        const rawDetail = data?.detail || data?.error || err?.message || '';
        const detailStr = typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail);
        const headers = err?.response?.headers || {};

        const isMFA =
          headers['x-mfa-required'] === 'true' ||
          headers['X-MFA-Required'] === 'true' ||
          detailStr.toLowerCase().includes('mfa code required') ||
          Boolean(data?.mfa_required || data?.error?.mfa_required);

        if (status === 401 && isMFA) {
          let method: 'totp' | 'email' = 'totp';
          const candidateMethod =
            headers['x-mfa-method'] ||
            headers['X-MFA-Method'] ||
            data?.mfa_method ||
            data?.error?.mfa_method;

          if (candidateMethod === 'email' || candidateMethod === 'totp') {
            method = candidateMethod;
          } else if (detailStr.toLowerCase().includes('method: email') || detailStr.toLowerCase().includes('"email"')) {
            method = 'email';
          }

          const email =
            headers['x-mfa-email'] ||
            headers['X-MFA-Email'] ||
            data?.email ||
            data?.error?.email ||
            undefined;

          const mfaError = new Error('MFA_REQUIRED');
          (mfaError as any).isMFA = true;
          (mfaError as any).method = method;
          (mfaError as any).email = email;
          throw mfaError;
        }

        throw err;
      }

      const token = res.token || res.access_token || '';
      const refreshToken = res.refresh_token || '';
      let initialUser = res.user;

      try {
        const profile = await http.get<any>('/users/users_config/me', {
          headers: token ? { Authorization: "Bearer " + token } : {},
        });
        if (profile) {
          initialUser = {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.email,
            role: profile.user_role || profile.role || 'user',
            user_role: profile.user_role || profile.role || 'user',
            permissions: profile.permissions || {},
            profile_pic: profile.profile_pic,
          };
        }
      } catch (e) {
        console.warn('Could not fetch extra profile details, using login payload', e);
      }

      if (!initialUser) {
        throw new Error('User profile data missing in response');
      }

      const verifiedUser: User = {
        id: initialUser.id,
        email: initialUser.email,
        name: initialUser.name || initialUser.email,
        role: initialUser.role || initialUser.user_role || 'user',
        user_role: initialUser.user_role || initialUser.role || 'user',
        permissions: initialUser.permissions || {},
        profile_pic: initialUser.profile_pic,
      };

      return {
        token,
        refreshToken,
        user: verifiedUser,
      };
    },
    onSuccess: (data) => {
      setAuth(data.user, data.token, data.refreshToken);
      ToastMsgs.success(`Welcome back, ${data.user.name || data.user.email}!`);
      navigate('/dashboard');
    },
    onError: (error: any) => {
      if ((error as any).isMFA) {
        // Do not display generic failure toast, MFA challenge is displayed
        return;
      }
      const msg = error?.response?.data?.detail || error?.message || 'Login failed. Please check your credentials.';
      ToastMsgs.error(msg);
    },
  });
};
