const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 100;

/** Times a DB operation and logs a warning (matching the bracketed
 * [SCOPE][RBAC]-style structured console logs already used elsewhere in
 * this codebase, e.g. lib/hrms/actions.ts's [RBAC][HRMS] logger) if it
 * exceeds thresholdMs, so slow permission/role queries surface in the
 * Vercel runtime logs before they become a user-visible slowdown. */
export async function withQueryTiming<T>(
  label: string,
  operation: () => Promise<T>,
  thresholdMs: number = DEFAULT_SLOW_QUERY_THRESHOLD_MS
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const durationMs = performance.now() - startedAt;
    if (durationMs > thresholdMs) {
      console.warn("[PERF][RBAC] slow query", {
        label,
        durationMs: Math.round(durationMs),
        thresholdMs
      });
    }
  }
}
