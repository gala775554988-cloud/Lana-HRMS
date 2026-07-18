"use client";

import { useQuery } from "@tanstack/react-query";

export const PENDING_APPROVALS_QUERY_KEY = ["pending-approvals-count"] as const;

/** Polls the lightweight pending-count endpoint; also invalidated instantly
 * from request-workbench-client.tsx right after an approve/reject decision,
 * so the sidebar badge updates in the same tab without waiting for the
 * next poll. */
export function usePendingApprovalsCount(enabled: boolean) {
  return useQuery({
    queryKey: PENDING_APPROVALS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/enterprise/requests/pending-count", { cache: "no-store" });
      const data = await response.json().catch(() => ({ success: false }));
      return data.success ? (data.count as number) : 0;
    },
    enabled,
    refetchInterval: 20000,
    refetchOnWindowFocus: true
  });
}
