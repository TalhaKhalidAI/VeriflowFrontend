import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import type {
  ShiftRecord,
  ShiftListResponse,
  StartShiftPayload,
  StartShiftResponse,
  ReissueShiftResponse,
  DeleteShiftResponse,
} from './types';

export const useActiveShiftQuery = () => {
  return useQuery({
    queryKey: ['shifts', 'active', 'me'],
    queryFn: async () => {
      try {
        const data = await http.get<ShiftRecord>('/shifts/active/me');
        return data;
      } catch (err: any) {
        if (err?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 1000 * 15,
  });
};

export const useShiftsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const data = await http.get<ShiftListResponse>('/shifts/');
      return data;
    },
    staleTime: 1000 * 30,
    enabled: options?.enabled,
  });
};

export const useStartShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, qrOnly = false }: { payload: StartShiftPayload; qrOnly?: boolean }): Promise<StartShiftResponse> => {
      const incRules = payload.include_rules ?? false;
      if (qrOnly) {
        const blob = await http.post<Blob>(
          `/shifts/start?qr_only=true&include_rules=${incRules}`,
          payload,
          { responseType: 'blob' }
        );
        return {
          isQrBlob: true,
          qrBlobUrl: URL.createObjectURL(blob),
          shift: null,
          shift_token: '',
          expires_at: '',
        };
      }
      return await http.post<StartShiftResponse>(`/shifts/start?qr_only=false&include_rules=${incRules}`, payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Work shift started successfully!');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to start shift');
    },
  });
};

export const useReissueActiveShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      includeRules = false,
      qrOnly = false,
      targetUserId,
    }: {
      includeRules?: boolean;
      qrOnly?: boolean;
      targetUserId?: number;
    }): Promise<ReissueShiftResponse> => {
      let url = `/shifts/active/reissue?include_rules=${includeRules}&qr_only=${qrOnly}`;
      if (targetUserId) {
        url += `&target_user_id=${targetUserId}`;
      }
      if (qrOnly) {
        const blob = await http.post<Blob>(url, {}, { responseType: 'blob' });
        return {
          isQrBlob: true,
          qrBlobUrl: URL.createObjectURL(blob),
          shift: null,
          shift_token: '',
          expires_at: '',
        };
      }
      return await http.post<ReissueShiftResponse>(url);
    },
    onSuccess: () => {
      ToastMsgs.success('Active shift token re-issued with current rules');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to reissue shift token');
    },
  });
};

export const useCheckoutShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId?: string) => {
      if (shiftId) {
        return await http.post<ShiftRecord>(`/shifts/${shiftId}/checkout`);
      }
      return await http.post<ShiftRecord>('/shifts/checkout');
    },
    onSuccess: () => {
      ToastMsgs.success('Work shift checked out and session ended.');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to checkout shift');
    },
  });
};

export const useDeleteShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string) => {
      return await http.delete<DeleteShiftResponse>(`/shifts/${shiftId}`);
    },
    onSuccess: (res) => {
      ToastMsgs.warning(`Shift ${res.shift.id.slice(0, 8)} permanently deleted (${res.removed_scans} scans removed)`);
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to delete shift');
    },
  });
};
