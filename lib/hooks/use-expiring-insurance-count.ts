"use client";

import { useQuery } from "@tanstack/react-query";

export const EXPIRING_INSURANCE_QUERY_KEY = ["expiring-insurance-count"] as const;

/** Polls the lightweight expiring-policy endpoint for the sidebar Insurance
 * badge -- policies due for renewal within 30 days. Mirrors
 * usePendingApprovalsCount's polling/invalidation pattern. */
export function useExpiringInsuranceCount(enabled: boolean) {
  return useQuery({
    queryKey: EXPIRING_INSURANCE_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/enterprise/insurance/expiring-count", { cache: "no-store" });
      const data = await response.json().catch(() => ({ success: false }));
      return data.success ? (data.count as number) : 0;
    },
    enabled,
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });
}
