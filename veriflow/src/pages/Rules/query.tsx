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
    staleTime: 1000 * 30,
    enabled: options?.enabled,
  });
};

export const useCreateRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInventoryRulePayload) => {
      return await http.post<InventoryRule>('/rules/', payload);
    },
    onSuccess: (newRule) => {
      ToastMsgs.success(`Rule "${newRule.rule_name}" created`);
      queryClient.invalidateQueries({ queryKey: ['rules'] });
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
    onSuccess: (updated) => {
      ToastMsgs.success(`Rule "${updated.rule_name}" updated`);
      queryClient.invalidateQueries({ queryKey: ['rules'] });
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
    onSuccess: (rule) => {
      ToastMsgs.info(`Rule "${rule.rule_name}" is now ${rule.is_active ? 'active' : 'inactive'}`);
      queryClient.invalidateQueries({ queryKey: ['rules'] });
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
    onSuccess: () => {
      ToastMsgs.success('Rule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rules'] });
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
    staleTime: 1000 * 30,
  });
};
