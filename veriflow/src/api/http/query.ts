// src/api/http/query.ts
import { QueryClient } from '@tanstack/react-query';
import { ToastMsgs } from '../toastUtils';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnMount: false,
      staleTime: 15 * 60 * 1000,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      
      // Handle query errors gracefully without crashing the UI
      throwOnError: (error: any) => {
        if (error?.status !== 401 && error?.status !== 403) {
          ToastMsgs.error(error?.message || error?.detail || 'Failed to load data');
        }
        return false;
      },
    },
    mutations: {
      // ✅ ADD THIS: Handle mutation errors
      onError: (error: any) => {
        if (error?.status !== 401) {
          ToastMsgs.error(error?.message || 'Operation failed');
        }
      },
    },
 
  },
});