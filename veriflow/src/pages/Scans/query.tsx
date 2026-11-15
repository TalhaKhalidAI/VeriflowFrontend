import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import type { ScanListResponse, ScanRecord, RecordScanPayload } from './types';

export const useScansQuery = () => {
  return useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const data = await http.get<ScanListResponse>('/scans/');
      return data;
    },
  });
};

export const useRecordScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordScanPayload) => {
      return await http.post<ScanRecord>('/scans/', payload);
    },
    onSuccess: async (newScan) => {
      ToastMsgs.success('Manual scan record logged');
      if (newScan?.id !== undefined) {
        queryClient.setQueryData<ScanListResponse>(['scans'], (old) =>
          old
            ? {
                ...old,
                items: [newScan, ...old.items],
                total: (old.total ?? old.items.length) + 1,
              }
            : old
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['scans'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to log scan record');
    },
  });
};

export const useVerifyTokenDirectMutation = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      return await http.post<any>('/keys/tokens/verify', { token });
    },
    onSuccess: () => {
      ToastMsgs.success('Token verified valid by RS256 public key');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Token verification failed');
    },
  });
};

export const useUpdateScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scanId, status, reason }: { scanId: number; status?: string; reason?: string }) => {
      return await http.patch<ScanRecord>(`/scans/${scanId}`, { status, reason });
    },
    onSuccess: async (updatedScan) => {
      ToastMsgs.success("Scan record updated successfully");
      if (updatedScan?.id !== undefined) {
        queryClient.setQueryData<ScanListResponse>(['scans'], (old) =>
          old
            ? { ...old, items: old.items.map((s) => (s.id === updatedScan.id ? updatedScan : s)) }
            : old
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["scans"], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || "Failed to update scan record");
    },
  });
};

export const useDeleteScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scanId: number) => {
      return await http.delete<{ status: string; message: string }>(`/scans/${scanId}`);
    },
    onSuccess: async (_, deletedScanId) => {
      ToastMsgs.success("Scan record deleted successfully");
      queryClient.setQueryData<ScanListResponse>(['scans'], (old) =>
        old
          ? {
              ...old,
              items: old.items.filter((s) => s.id !== deletedScanId),
              total: Math.max(0, (old.total ?? old.items.length) - 1),
            }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ["scans"], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || "Failed to delete scan record");
    },
  });
};
