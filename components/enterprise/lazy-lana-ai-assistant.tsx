"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const LanaAiAssistant = dynamic(
  () => import("@/components/enterprise/lana-ai-assistant").then((mod) => mod.LanaAiAssistant),
  { ssr: false }
);

export function LazyLanaAiAssistant() {
  const { data: session, status } = useSession();
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

  // Require the literal "authenticated" status, not just a truthy session
  // object -- this is the same explicit check used for the sidebar's Lana AI
  // nav item (components/hrms/app-shell.tsx's showLanaAI). Every public page
  // (login, forgot/reset-password, verify-email, the signed-out landing
  // page) renders through this same root layout, so this is the only gate
  // keeping the widget off those pages.
  if (status !== "authenticated" || !session?.user || !enabled) return null;

  return <LanaAiAssistant />;
}
