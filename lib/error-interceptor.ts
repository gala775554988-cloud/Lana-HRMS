import { prisma } from "@/lib/prisma";

declare global {
  var __LANA_SERVER_ERRORS__: Map<string, { message: string; stack: string; timestamp: string }> | undefined;
  var __LANA_ERROR_PATCHED__: boolean | undefined;
}

if (!globalThis.__LANA_SERVER_ERRORS__) {
  globalThis.__LANA_SERVER_ERRORS__ = new Map();
}

/**
 * Intercepts server-side errors and digests so that client error boundaries (`error.tsx`)
 * can query `/api/internal/get-error-diagnostic?digest=XXXX` to display exact stack traces
 * directly on the UI even when Next.js conceals them in production (`An error occurred in the Server Components render`).
 */
export function recordServerErrorDiagnostic(digestOrErr: any, maybeErr?: any) {
  try {
    let digest: string | undefined = undefined;
    let err: any = digestOrErr;

    if (typeof digestOrErr === "string" && (digestOrErr.match(/^\d+$/) || digestOrErr.includes("::") || digestOrErr.includes("-"))) {
      digest = digestOrErr;
      err = maybeErr;
    } else if (digestOrErr?.digest) {
      digest = String(digestOrErr.digest);
      err = digestOrErr;
    }

    if (!err && !digest) return;

    const message = err?.message || typeof err === "string" ? String(err.message || err) : "Server runtime exception";
    const stack = err?.stack || "";
    const timestamp = new Date().toISOString();

    if (!digest && message) {
      // Create a hash or quick id if no digest attached
      digest = "DIGEST-" + Math.abs(message.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString();
    }

    if (digest && globalThis.__LANA_SERVER_ERRORS__) {
      globalThis.__LANA_SERVER_ERRORS__.set(digest, { message, stack, timestamp });
      // Keep only recent 100 errors in memory
      if (globalThis.__LANA_SERVER_ERRORS__.size > 100) {
        const firstKey = globalThis.__LANA_SERVER_ERRORS__.keys().next().value;
        if (firstKey) globalThis.__LANA_SERVER_ERRORS__.delete(firstKey);
      }
    }

    // Also persist to database if connection pool available
    if (digest && message && !message.includes("Connection pool") && !message.includes("53100")) {
      prisma.integrationLog.create({
        data: {
          action: "SERVER_CRASH_DIAGNOSTIC",
          message: `[${digest}] ${message}`.slice(0, 191),
          level: "ERROR",
          response: { digest, message, stack, timestamp } as any
        }
      }).catch(() => {});
    }
  } catch {}
}

// Automatically patch console.error in Node environment to catch unhandled Server Component crashes
if (typeof window === "undefined" && !globalThis.__LANA_ERROR_PATCHED__) {
  globalThis.__LANA_ERROR_PATCHED__ = true;
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      for (const arg of args) {
        if (arg && (arg instanceof Error || arg.digest || (typeof arg === "string" && arg.includes("Stack trace")))) {
          recordServerErrorDiagnostic(arg);
        }
      }
    } catch {}
    originalConsoleError.apply(console, args);
  };
}
