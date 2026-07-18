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
 * Cloudflare Turnstile widget with strict Fail-Open resiliency:
 * Reports the response token via onVerify. If Cloudflare CDN/Turnstile is blocked,
 * times out, or fails to render, automatically transitions to a simulated bypass
 * or provides a 1-click 'تخطي التحقق' button so users are never locked out of login.
 */
export function TurnstileWidget({ siteKey, onVerify }: { siteKey: string; onVerify: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "bypassed">("loading");
  const elementId = useId();

  useEffect(() => {
    let cancelled = false;

    // Failsafe timer: if Turnstile hangs for more than 6 seconds, auto fail-open
    const failsafeTimer = setTimeout(() => {
      if (!cancelled && status === "loading") {
        setStatus("bypassed");
        onVerify("turnstile-simulated-bypass");
      }
    }, 6000);

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          if (!cancelled && !window.turnstile) {
            setStatus("error");
            onVerify("turnstile-simulated-bypass");
          }
          return;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey.trim(),
          callback: (token: string) => {
            setStatus("ready");
            onVerify(token);
          },
          "expired-callback": () => {
            if (!cancelled) {
              setStatus("loading");
              onVerify(null);
            }
          },
          "error-callback": () => {
            if (!cancelled) {
              setStatus("error");
              // Fail open: immediately pass simulated bypass token so form works without blocking
              onVerify("turnstile-simulated-bypass");
            }
          }
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          onVerify("turnstile-simulated-bypass");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(failsafeTimer);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  const handleManualBypass = () => {
    setStatus("bypassed");
    onVerify("turnstile-simulated-bypass");
  };

  const handleRetry = () => {
    setStatus("loading");
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); return; } catch {}
    }
    if (containerRef.current && window.turnstile) {
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey.trim(),
          callback: (token: string) => { setStatus("ready"); onVerify(token); },
          "error-callback": () => { setStatus("error"); onVerify("turnstile-simulated-bypass"); }
        });
      } catch {}
    }
  };

  return (
    <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border border-slate-200/70 p-3 dark:border-slate-800">
      <div id={elementId} ref={containerRef} className={status === "bypassed" ? "hidden" : ""} />
      
      {status === "loading" ? (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">جارٍ تحميل التحقق الأمني...</p>
      ) : null}

      {status === "error" ? (
        <div className="w-full space-y-2 text-center" dir="rtl">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            تعذر الاتصال بخادم الأمان Cloudflare؛ قد يكون الاتصال محجوباً أو تأخر المتصفح.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleManualBypass}
              className="rounded-lg bg-teal-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-teal-700 active:scale-95"
            >
              ✓ تخطي التحقق والمتابعة (Bypass & Continue)
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      ) : null}

      {status === "bypassed" ? (
        <div className="w-full flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" dir="rtl">
          <span>✓ تم تخطي التحقق الأمني (وضـع Fail-open)</span>
          <button type="button" onClick={handleRetry} className="text-emerald-700 underline text-[10px]">إعادة التحميل</button>
        </div>
      ) : null}
    </div>
  );
}
