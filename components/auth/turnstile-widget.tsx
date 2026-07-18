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
    script.onerror = () => resolve(); // Do not block promise if script fails to load
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/**
 * Cloudflare Turnstile widget. Strictly fail-closed: onVerify only ever
 * receives a real Cloudflare-issued token, never a bypass -- if the widget
 * can't load or errors out, the token stays null and the login form's
 * submit button stays disabled (see verifyTurnstileToken, which re-enforces
 * this server-side regardless of what the client sends). No flashing
 * loading/bypass states -- one static container, one static retry message.
 */
export function TurnstileWidget({ siteKey, onVerify }: { siteKey: string; onVerify: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"pending" | "ready" | "error">("pending");
  const elementId = useId();

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          if (!cancelled && !window.turnstile) setStatus("error");
          return;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey.trim(),
          callback: (token: string) => {
            setStatus("ready");
            onVerify(token);
          },
          "expired-callback": () => {
            if (!cancelled) onVerify(null);
          },
          "error-callback": () => {
            if (!cancelled) setStatus("error");
          }
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  const handleRetry = () => {
    setStatus("pending");
    onVerify(null);
    if (containerRef.current && window.turnstile) {
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey.trim(),
          callback: (token: string) => { setStatus("ready"); onVerify(token); },
          "expired-callback": () => onVerify(null),
          "error-callback": () => setStatus("error")
        });
      } catch {
        setStatus("error");
      }
    }
  };

  return (
    <div className="glass-surface flex flex-col items-center gap-2 rounded-xl border border-slate-200/70 p-3 dark:border-slate-800">
      <div id={elementId} ref={containerRef} />

      {status === "error" ? (
        <div className="w-full space-y-2 text-center" dir="rtl">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            تعذر تحميل التحقق الأمني. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}
    </div>
  );
}
