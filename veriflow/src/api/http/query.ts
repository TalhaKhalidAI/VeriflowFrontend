// src/api/http/query.ts
import { QueryClient, MutationCache } from '@tanstack/react-query';
import { ToastMsgs } from '../toastUtils';

export const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      // Keep dashboard telemetry and active queries fresh after any mutation
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnMount: 'always',
      staleTime: 0,
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: 'always',
      refetchInterval: 1000 * 10, // Auto-sync active views every 10s when changes happen elsewhere (mobile/API/other tab)
      refetchIntervalInBackground: false,

      // Handle query errors gracefully without crashing the UI
      throwOnError: (error: any) => {
        if (error?.status !== 401 && error?.status !== 403) {
          ToastMsgs.error(error?.message || error?.detail || 'Failed to load data');
        }
        return false;
      },
    },
    mutations: {
      // Handle mutation errors
      onError: (error: any) => {
        if (error?.status !== 401) {
          ToastMsgs.error(error?.message || 'Operation failed');
        }
      },
    },
  },
});
