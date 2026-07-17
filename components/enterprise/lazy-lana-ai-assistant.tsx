"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const LanaAiAssistant = dynamic(
  () => import("@/components/enterprise/lana-ai-assistant").then((mod) => mod.LanaAiAssistant),
  { ssr: false }
);

const LanaExecutiveAgent = dynamic(
  () => import("@/components/enterprise/lana-executive-agent").then((mod) => mod.LanaExecutiveAgent),
  { ssr: false }
);

export function LazyLanaAiAssistant() {
  const { data: session } = useSession();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const w = window as typeof window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setEnabled(true), { timeout: 3500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => setEnabled(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  // لا يظهر المكون إلا إذا وُجدت جلسة نشطة
  if (!session || !enabled) return null;

  const roles = (session.user as any)?.roles || [];
  const isExecutiveOrHR = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || Boolean((session.user as any)?.isDelegate);

  return (
    <>
      <LanaAiAssistant />
      {isExecutiveOrHR ? <LanaExecutiveAgent /> : null}
    </>
  );
}
