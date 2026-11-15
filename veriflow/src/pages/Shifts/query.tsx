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
  UpdateShiftPayload,
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
  });
};

export const useShiftsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const data = await http.get<ShiftListResponse>('/shifts/');
      return data;
    },
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
    onSuccess: async () => {
      ToastMsgs.success('Work shift started successfully!');
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
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
    onSuccess: async () => {
      ToastMsgs.success('Active shift token re-issued with current rules');
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
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
    onSuccess: async (updatedShift) => {
      ToastMsgs.success('Work shift checked out and session ended.');
      if (updatedShift?.id) {
        queryClient.setQueryData<ShiftListResponse>(['shifts'], (old) =>
          old
            ? { ...old, items: old.items.map((s) => (s.id === updatedShift.id ? updatedShift : s)) }
            : old
        );
        queryClient.setQueryData<ShiftRecord | null>(['shifts', 'active', 'me'], (old) =>
          old && old.id === updatedShift.id ? null : old
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
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
    onSuccess: async (res, deletedShiftId) => {
      const targetId = res?.shift?.id || deletedShiftId;
      ToastMsgs.warning(`Shift ${targetId.slice(0, 8)} permanently deleted (${res?.removed_scans ?? 0} scans removed)`);
      queryClient.setQueryData<ShiftListResponse>(['shifts'], (old) =>
        old
          ? {
              ...old,
              items: old.items.filter((s) => s.id !== targetId),
              total: Math.max(0, (old.total ?? old.items.length) - 1),
            }
          : old
      );
      queryClient.setQueryData<ShiftRecord | null>(['shifts', 'active', 'me'], (old) =>
        old && old.id === targetId ? null : old
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['scans'], refetchType: 'active' }),
      ]);
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to delete shift');
    },
  });
};


export const useUpdateShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId, payload }: { shiftId: string; payload: UpdateShiftPayload }) => {
      return await http.put<ShiftRecord>(`/shifts/${shiftId}`, payload);
    },
    onSuccess: async (res) => {
      ToastMsgs.success(`Shift ${res.id.slice(0, 8)} updated successfully!`);
      queryClient.setQueryData<ShiftListResponse>(['shifts'], (old) =>
        old ? { ...old, items: old.items.map((s) => (s.id === res.id ? res : s)) } : old
      );
      queryClient.setQueryData<ShiftRecord | null>(['shifts', 'active', 'me'], (old) =>
        old && old.id === res.id ? res : old
      );
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to update shift');
    },
  });
};

export const useRestartShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId, includeRules = true }: { shiftId: string; includeRules?: boolean }) => {
      return await http.post<StartShiftResponse>(`/shifts/${shiftId}/restart?include_rules=${includeRules}`);
    },
    onSuccess: async () => {
      ToastMsgs.success('Shift restarted with same configuration!');
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to restart shift');
    },
  });
};


export const useRevokeShiftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shiftId, reason }: { shiftId: string; reason: string }) => {
      return await http.post<ShiftRecord>(`/shifts/${shiftId}/revoke`, { reason });
    },
    onSuccess: async (res) => {
      ToastMsgs.warning(`Shift ${res.id.slice(0, 8)} revoked and terminated.`);
      queryClient.setQueryData<ShiftListResponse>(['shifts'], (old) =>
        old ? { ...old, items: old.items.map((s) => (s.id === res.id ? res : s)) } : old
      );
      queryClient.setQueryData<ShiftRecord | null>(['shifts', 'active', 'me'], (old) =>
        old && old.id === res.id ? null : old
      );
      await queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to revoke shift');
    },
  });
};
