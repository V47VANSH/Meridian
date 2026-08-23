import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

/**
 * Shared query client.
 *
 * The retry rule matters: the default retries any failure three times, which
 * for a 401/403/404 means three identical rejections and a slow, confusing
 * error state. Only genuine network faults and 5xx are worth retrying.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof ApiError) {
          return error.isNetworkError || error.status >= 500;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
