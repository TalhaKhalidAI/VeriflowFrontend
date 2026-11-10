// src/pages/Security/query.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import type {
  MFAStatusResponse,
  StartEnrollPayload,
  StartEnrollResponse,
  ConfirmEnrollPayload,
  DisableMFAPayload,
  SendEmailOTPPayload,
  VerifyEmailOTPPayload,
  OTPPurposeType,
} from './types';

export const useMFAStatusQuery = () => {
  return useQuery({
    queryKey: ['mfa', 'status'],
    queryFn: async () => {
      const data = await http.get<MFAStatusResponse>('/mfa/status');
      return data;
    },
    staleTime: 1000 * 30,
  });
};

export const useStartEnrollMutation = () => {
  return useMutation({
    mutationFn: async (payload: StartEnrollPayload) => {
      return await http.post<StartEnrollResponse>('/mfa/enroll/start', payload);
    },
    onSuccess: (data) => {
      if (data.method === 'totp') {
        ToastMsgs.info('TOTP Secret generated. Scan the QR code with your authenticator app.');
      } else {
        ToastMsgs.info('Confirmation OTP sent to your registered email address.');
      }
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to initiate MFA enrollment');
    },
  });
};

export const useConfirmEnrollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConfirmEnrollPayload) => {
      return await http.post('/mfa/enroll/verify', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('MFA successfully enabled and verified!');
      queryClient.invalidateQueries({ queryKey: ['mfa', 'status'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Invalid or expired MFA code');
    },
  });
};

export const useDisableMFAMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DisableMFAPayload) => {
      return await http.post('/mfa/disable', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Two-factor authentication has been disabled.');
      queryClient.invalidateQueries({ queryKey: ['mfa', 'status'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to disable MFA. Check your password/code.');
    },
  });
};

export const useSendGenericOTPMutation = () => {
  return useMutation({
    mutationFn: async (purpose: OTPPurposeType) => {
      return await http.post(`/mfa/send_genaric_otp?purpose=${encodeURIComponent(purpose)}`);
    },
    onSuccess: () => {
      ToastMsgs.success('Generic OTP sent to registered email.');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to send OTP');
    },
  });
};

export const useSendEmailOTPMutation = () => {
  return useMutation({
    mutationFn: async (payload: SendEmailOTPPayload) => {
      return await http.post('/email_otp/send', payload);
    },
    onSuccess: () => {
      ToastMsgs.info('Email OTP requested. If email is valid, a code will be delivered shortly.');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to send email OTP');
    },
  });
};

export const useVerifyEmailOTPMutation = () => {
  return useMutation({
    mutationFn: async (payload: VerifyEmailOTPPayload) => {
      return await http.post<{ status: string }>('/email_otp/verify', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Email OTP verified successfully!');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Invalid or expired verification code');
    },
  });
};
