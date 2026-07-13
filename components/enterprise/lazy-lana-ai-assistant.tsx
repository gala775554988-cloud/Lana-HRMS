"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LanaAiAssistant = dynamic(
  () => import("@/components/enterprise/lana-ai-assistant").then((mod) => mod.LanaAiAssistant),
  { ssr: false }
);

export function LazyLanaAiAssistant() {
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

  return enabled ? <LanaAiAssistant /> : null;
}
