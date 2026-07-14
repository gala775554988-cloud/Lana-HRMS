"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const REFRESH_INTERVAL_MS = 15_000;

export function BiometricLogsRefresher() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <Badge variant="secondary" className="animate-pulse">
      مباشر · تحديث كل 15 ثانية
    </Badge>
  );
}
