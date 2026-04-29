import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient instance shared across the whole app. Created once at
 * module load time so that re-renders don't reset the cache.
 *
 * Defaults tuned for an internal CRM:
 * - staleTime: 30s — tolerates a small amount of staleness in exchange for
 *   far fewer requests when navigating between pages
 * - refetchOnWindowFocus: true — when the user switches back to the tab,
 *   refresh data so they see anything teammates may have changed
 * - retry: 1 — one auto-retry on transient failures, then surface the error
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
