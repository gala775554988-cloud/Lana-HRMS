"use client";

import { useEffect, useState } from "react";
import { parseClientError } from "@/lib/errors";

// A stale service worker / browser tab can still hold JS chunk references
// from a PREVIOUS deployment (Next.js content-hashes chunk filenames per
// build, and old ones stop existing on the server once a new deploy
// replaces them). When that happens the browser throws "ChunkLoadError" /
// "Failed to fetch dynamically imported module" outside of any route
// segment's own error.tsx (the target segment hasn't mounted yet), so it
// escapes all the way up to this root boundary. reset() alone cannot fix
// it -- it only re-renders with the same broken in-memory chunk reference;
// only a real network reload picks up the new build's HTML/manifest. Guard
// with sessionStorage so a genuinely broken deploy doesn't reload forever.
const RELOAD_GUARD_KEY = "lana-global-error-reload-attempted";

function isChunkLoadError(error: Error) {
  return /ChunkLoadError|Loading chunk|failed to fetch dynamically imported module/i.test(error.message ?? "");
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloaded, setReloaded] = useState(false);

  useEffect(() => {
    console.error("[GlobalError]", error);
    if (isChunkLoadError(error) && typeof window !== "undefined" && !window.sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      setReloaded(true);
      window.location.reload();
    }
  }, [error]);

  const structured = parseClientError(error, "app/global-error");
  const chunkError = isChunkLoadError(error);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: "32rem", width: "100%", backgroundColor: "white", borderRadius: "1rem", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", height: "3rem", width: "3rem", alignItems: "center", justifyContent: "center", borderRadius: "0.75rem", backgroundColor: "#fef2f2", color: "#dc2626", fontSize: "1.5rem" }}>⚠</div>
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.5rem" }}>
              {chunkError ? "تحديث جديد للنظام" : "خطأ حرج في النظام"}
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
              {reloaded
                ? "تم إصدار تحديث جديد للتطبيق -- جارٍ إعادة تحميل الصفحة..."
                : chunkError
                  ? structured.cause || "تعذر تحميل جزء من التطبيق بعد تحديث جديد. يرجى إعادة تحميل الصفحة بالكامل."
                  : structured.message || "حدث خطأ غير متوقع في تطبيق Lana HRMS. يرجى تحديث الصفحة أو المحاولة مرة أخرى."}
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "1rem", fontFamily: "monospace" }}>
                مرجع: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              <button onClick={() => window.location.reload()} style={{ padding: "0.5rem 1rem", backgroundColor: "#4f46e5", color: "white", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                إعادة تحميل الصفحة
              </button>
              <button onClick={reset} style={{ padding: "0.5rem 1rem", backgroundColor: "white", color: "#0f172a", borderRadius: "0.5rem", border: "1px solid #e2e8f0", cursor: "pointer", fontSize: "0.875rem" }}>
                إعادة المحاولة
              </button>
              <a href="/" style={{ padding: "0.5rem 1rem", backgroundColor: "white", color: "#0f172a", borderRadius: "0.5rem", border: "1px solid #e2e8f0", cursor: "pointer", fontSize: "0.875rem", textDecoration: "none" }}>
                الصفحة الرئيسية
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
