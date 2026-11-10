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
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30, // auto-refresh telemetry
  });
};

export const useRecordScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordScanPayload) => {
      return await http.post<ScanRecord>('/scans/', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Manual scan record logged');
      queryClient.invalidateQueries({ queryKey: ['scans'] });
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
    onSuccess: () => {
      ToastMsgs.success("Scan record updated successfully");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
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
    onSuccess: () => {
      ToastMsgs.success("Scan record deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || "Failed to delete scan record");
    },
  });
};
