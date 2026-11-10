import { useQuery } from '@tanstack/react-query';
import { http } from '../../api/http/https';
import type { DashboardStats } from './types';

export const useDashboardOverviewQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async (): Promise<DashboardStats> => {
      const [keysRes, rulesRes, scansRes, shiftRes] = await Promise.allSettled([
        http.get<any>('/keys/'),
        http.get<any>('/rules/'),
        http.get<any>('/scans/'),
        http.get<any>('/shifts/active/me'),
      ]);

      const keysItems = keysRes.status === 'fulfilled' && Array.isArray(keysRes.value?.items) ? keysRes.value.items : [];
      const rulesItems = rulesRes.status === 'fulfilled' && Array.isArray(rulesRes.value?.items) ? rulesRes.value.items : [];
      const scansItems = scansRes.status === 'fulfilled' && Array.isArray(scansRes.value?.items) ? scansRes.value.items : [];
      const hasShift = shiftRes.status === 'fulfilled' && Boolean(shiftRes.value?.id);

      const activeKeys = keysItems.filter((k: any) => k?.status === 'active').length;
      const activeRules = rulesItems.filter((r: any) => Boolean(r?.is_active)).length;
      const validScans = scansItems.filter((s: any) => s?.status === 'valid').length;
      const invalidScans = scansItems.filter((s: any) => s?.status && s.status !== 'valid').length;

      return {
        activeKeysCount: activeKeys,
        activeRulesCount: activeRules,
        hasActiveShift: hasShift,
        totalScansCount: scansItems.length,
        validScansCount: validScans,
        invalidScansCount: invalidScans,
      };
    },
    staleTime: 1000 * 15,
  });
};
