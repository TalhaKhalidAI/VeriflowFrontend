import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import { ToastMsgs } from '../../api/toastUtils';
import type {
  InventoryRuleListResponse,
  InventoryRule,
  CreateInventoryRulePayload,
  UpdateInventoryRulePayload,
  EvaluateClaimsPayload,
  EvaluateClaimsResponse,
} from './types';

export const useRulesQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const data = await http.get<InventoryRuleListResponse>('/rules/');
      return data;
    },
    enabled: options?.enabled,
  });
};

export const useCreateRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInventoryRulePayload) => {
      return await http.post<InventoryRule>('/rules/', payload);
    },
    onSuccess: async (newRule) => {
      ToastMsgs.success(`Rule "${newRule.rule_name}" created`);
      queryClient.setQueryData<InventoryRuleListResponse>(['rules'], (old) =>
        old
          ? {
              ...old,
              items: [newRule, ...old.items],
              total: (old.total ?? old.items.length) + 1,
            }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['rules'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to create rule');
    },
  });
};

export const useUpdateRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, payload }: { ruleId: string; payload: UpdateInventoryRulePayload }) => {
      return await http.put<InventoryRule>(`/rules/${ruleId}`, payload);
    },
    onSuccess: async (updated) => {
      ToastMsgs.success(`Rule "${updated.rule_name}" updated`);
      queryClient.setQueryData<InventoryRuleListResponse>(['rules'], (old) =>
        old
          ? { ...old, items: old.items.map((r) => (r.id === updated.id ? updated : r)) }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['rules'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to update rule');
    },
  });
};

export const useToggleRuleStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      return await http.patch<InventoryRule>(`/rules/${ruleId}/status`, { is_active: isActive });
    },
    onSuccess: async (rule) => {
      ToastMsgs.info(`Rule "${rule.rule_name}" is now ${rule.is_active ? 'active' : 'inactive'}`);
      queryClient.setQueryData<InventoryRuleListResponse>(['rules'], (old) =>
        old
          ? { ...old, items: old.items.map((r) => (r.id === rule.id ? rule : r)) }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['rules'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to update rule status');
    },
  });
};

export const useDeleteRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      return await http.delete(`/rules/${ruleId}`);
    },
    onSuccess: async (_, deletedRuleId) => {
      ToastMsgs.success('Rule deleted successfully');
      queryClient.setQueryData<InventoryRuleListResponse>(['rules'], (old) =>
        old
          ? {
              ...old,
              items: old.items.filter((r) => r.id !== deletedRuleId),
              total: Math.max(0, (old.total ?? old.items.length) - 1),
            }
          : old
      );
      await queryClient.invalidateQueries({ queryKey: ['rules'], refetchType: 'active' });
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Failed to delete rule');
    },
  });
};

export const useEvaluateClaimsMutation = () => {
  return useMutation({
    mutationFn: async (payload: EvaluateClaimsPayload) => {
      return await http.post<EvaluateClaimsResponse>('/rules/evaluate', payload);
    },
    onError: (err: any) => {
      ToastMsgs.error(err?.message || 'Claim evaluation failed');
    },
  });
};

export const useApplicableRulesQuery = (keyId?: string) => {
  return useQuery({
    queryKey: ['rules', 'applicable', keyId || 'all'],
    queryFn: async () => {
      const url = keyId ? `/rules/applicable?key_id=${encodeURIComponent(keyId)}` : '/rules/applicable';
      return await http.get<InventoryRule[]>(url);
    },
  });
};
