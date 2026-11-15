// src/pages/Keys/query.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import type {
  KeyListResponse,
  JWKSResponse,
  KeyRecord,
  CreateKeyPayload,
  RotateKeyPayload,
  RevokeKeyPayload,
  ExportPrivateKeyResponse,
  IssueTokenPayload,
  IssueTokenResponse,
  VerifyTokenPayload,
  VerifyTokenResponse,
  GenerateTagQRPayload,
  ProductTagQRResponse,
  DeleteKeyResponse,
} from './types';

export const useKeysQuery = (statusFilter?: string) => {
  return useQuery({
    queryKey: ['keys', statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/keys/?status=${statusFilter}` : '/keys/';
      const data = await http.get<KeyListResponse>(url);
      return data;
    },
  });
};

export const useKeyByIdQuery = (keyId: string) => {
  return useQuery({
    queryKey: ['keys', 'detail', keyId],
    queryFn: async () => {
      if (!keyId) return null;
      return await http.get<KeyRecord>(`/keys/${keyId}`);
    },
    enabled: Boolean(keyId),
  });
};

export const useKeyByKidQuery = (kid: string) => {
  return useQuery({
    queryKey: ['keys', 'kid', kid],
    queryFn: async () => {
      if (!kid) return null;
      return await http.get<KeyRecord>(`/keys/kid/${kid}`);
    },
    enabled: Boolean(kid),
  });
};

export const useJWKSQuery = () => {
  return useQuery({
    queryKey: ['keys', 'jwks'],
    queryFn: async () => {
      const data = await http.get<JWKSResponse>('/keys/jwks');
      return data;
    },
  });
};

export const useCreateKeyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateKeyPayload) => {
      return await http.post<KeyRecord>('/keys/', payload);
    },
    onSuccess: async (newKey) => {
      ToastMsgs.success(`Key "${newKey.name}" (${newKey.kid}) generated successfully`);
      queryClient.setQueriesData<KeyListResponse>({ queryKey: ['keys'] }, (old) =>
        old && Array.isArray(old.items)
          ? { ...old, items: [newKey, ...old.items], total: (old.total ?? old.items.length) + 1 }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['keys'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to generate key');
    },
  });
};

export const useRotateKeyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RotateKeyPayload) => {
      return await http.post<KeyRecord>('/keys/rotate', payload);
    },
    onSuccess: async (newKey) => {
      ToastMsgs.success(`Active key successfully rotated! New primary: ${newKey.kid}`);
      await queryClient.invalidateQueries({ queryKey: ['keys'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to rotate key');
    },
  });
};

export const useRevokeKeyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ keyId, payload }: { keyId: string; payload: RevokeKeyPayload }) => {
      return await http.post<KeyRecord>(`/keys/${keyId}/revoke`, payload);
    },
    onSuccess: async (revokedKey) => {
      ToastMsgs.warning(`Key ${revokedKey.kid} has been revoked`);
      queryClient.setQueriesData<KeyListResponse>({ queryKey: ['keys'] }, (old) =>
        old && Array.isArray(old.items)
          ? { ...old, items: old.items.map((k) => (k.id === revokedKey.id ? revokedKey : k)) }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['keys'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to revoke key');
    },
  });
};

export const useExportPrivateKeyMutation = () => {
  return useMutation({
    mutationFn: async ({ keyId, password, otp }: { keyId: string; password: string; otp?: string }) => {
      return await http.post<ExportPrivateKeyResponse>(`/keys/${keyId}/export-private`, {
        password,
        otp: otp || undefined,
      });
    },
    onSuccess: () => {
      ToastMsgs.success("Private key decrypted and exported for administrative audit.");
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to export private key");
    },
  });
};

export const useIssueTokenMutation = () => {
  return useMutation({
    mutationFn: async (payload: IssueTokenPayload) => {
      return await http.post<IssueTokenResponse>('/keys/tokens/issue', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('RS256 JWT issued successfully');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to issue token');
    },
  });
};

export const useVerifyTokenMutation = () => {
  return useMutation({
    mutationFn: async (payload: VerifyTokenPayload) => {
      return await http.post<VerifyTokenResponse>('/keys/tokens/verify', payload);
    },
    onSuccess: (res) => {
      if (res.valid) {
        ToastMsgs.success(`Token signature verified using Key ID: ${res.kid || 'valid'}`);
      } else {
        ToastMsgs.warning('Token verification completed, but signature or claims are invalid');
      }
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Token verification failed');
    },
  });
};

export const useGenerateTagQRMutation = () => {
  return useMutation({
    mutationFn: async (payload: GenerateTagQRPayload) => {
      return await http.post<ProductTagQRResponse>('/keys/tags/qr', payload);
    },
    onSuccess: () => {
      ToastMsgs.success('Product Tag QR code generated and signed with RS256');
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to generate product tag QR');
    },
  });
};

export const useDeleteKeyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ keyId, force = false }: { keyId: string; force?: boolean }) => {
      const url = force ? `/keys/${keyId}?force=true` : `/keys/${keyId}`;
      return await http.delete<DeleteKeyResponse>(url);
    },
    onSuccess: async (res, vars) => {
      const extra = res.removed_shifts ? ` (+${res.removed_shifts} shifts, ${res.removed_scans} scans)` : '';
      ToastMsgs.warning(`Key ${res.key.kid} permanently deleted${extra}`);
      const deletedId = res?.key?.id || vars.keyId;
      queryClient.setQueriesData<KeyListResponse>({ queryKey: ['keys'] }, (old) =>
        old && Array.isArray(old.items)
          ? {
              ...old,
              items: old.items.filter((k) => k.id !== deletedId),
              total: Math.max(0, (old.total ?? old.items.length) - 1),
            }
          : old
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['keys'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['shifts'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['rules'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['scans'], refetchType: 'active' }),
      ]);
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.response?.data?.detail || err?.message || 'Failed to delete key');
    },
  });
};
