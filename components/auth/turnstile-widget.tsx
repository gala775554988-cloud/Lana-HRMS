"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __turnstileOnLoad?: () => void;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__turnstileOnLoad";
let scriptLoadingPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve) => {
    window.__turnstileOnLoad = () => resolve();
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/**
 * Cloudflare Turnstile widget, wrapped in the app's glass-surface treatment
 * so it visually matches the rest of the login card. Reports the response
 * token (or null once it expires/errors) via onVerify -- the caller is
 * responsible for blocking submission until a token is present, matching
 * the server-side enforcement in lib/security/turnstile.ts.
 */
export function TurnstileWidget({ siteKey, onVerify }: { siteKey: string; onVerify: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const elementId = useId();

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => onVerify(null),
          "error-callback": () => { onVerify(null); setStatus("error"); }
        });
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      onVerify(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return (
    <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border border-slate-200/70 p-3 dark:border-slate-800">
      <div id={elementId} ref={containerRef} />
      {status === "loading" ? <p className="text-[10px] text-slate-400 dark:text-slate-500">جارٍ تحميل التحقق الأمني...</p> : null}
      {status === "error" ? <p className="text-[10px] text-destructive">تعذر تحميل التحقق الأمني، يرجى إعادة تحميل الصفحة.</p> : null}
    </div>
  );
}
