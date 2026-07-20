"use client";

import { useQuery } from "@tanstack/react-query";

export const SOCIAL_INSURANCE_ALERTS_QUERY_KEY = ["social-insurance-alerts-count"] as const;

/** Polls the lightweight alerts-count endpoint for the sidebar Social
 * Insurance badge -- active employees with no GOSI registration yet.
 * Mirrors useExpiringInsuranceCount's polling/invalidation pattern. */
export function useSocialInsuranceAlertsCount(enabled: boolean) {
  return useQuery({
    queryKey: SOCIAL_INSURANCE_ALERTS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/enterprise/social-insurance/alerts-count", { cache: "no-store" });
      const data = await response.json().catch(() => ({ success: false }));
      return data.success ? (data.count as number) : 0;
    },
    enabled,
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });
}
