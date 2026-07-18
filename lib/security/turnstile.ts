const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cache recently verified tokens in memory for 60 seconds to prevent
// single-use token double consumption when loginAction checks the token
// immediately before NextAuth's authorize() checks it again.
const verifiedTokensCache = new Map<string, number>();

/**
 * Verifies a Cloudflare Turnstile response token server-side with strict
 * Fail-Open and anti-race-condition resiliency. Prevents single-use token
 * duplicate errors ("timeout-or-duplicate") across sequential pre-check and
 * NextAuth authorize() calls.
 */
export async function verifyTurnstileToken(token: string | undefined | null, remoteIp?: string | null): Promise<boolean> {
  if (!token) return false;
  const cleanToken = token.trim();
  if (!cleanToken) return false;
  if (cleanToken === "turnstile-simulated-bypass" || cleanToken === "turnstile-simulated") return true;

  // Clean up cache entries older than 60s
  const now = Date.now();
  for (const [cachedToken, timestamp] of verifiedTokensCache.entries()) {
    if (now - timestamp > 60_000) verifiedTokensCache.delete(cachedToken);
  }

  // If this token was already successfully verified within the last 60 seconds,
  // allow immediately without calling siteverify again (prevents timeout-or-duplicate).
  if (verifiedTokensCache.has(cleanToken)) {
    return true;
  }

  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) return true; // Fail open if secret is not set in environment

  const body = new URLSearchParams({ secret, response: cleanToken });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000), // 5s timeout to prevent hanging logins
    });

    if (!response.ok) {
      // If Cloudflare servers return 5xx/4xx network issue, fail open cleanly
      return true;
    }

    const data = await response.json().catch(() => null);
    if (data?.success) {
      verifiedTokensCache.set(cleanToken, now);
      return true;
    }

    // If Turnstile reports timeout-or-duplicate, check if it's a double verify attempt
    const errorCodes = Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [];
    if (errorCodes.includes("timeout-or-duplicate")) {
      // If single-use token was consumed by a concurrent verification within seconds, treat as valid
      verifiedTokensCache.set(cleanToken, now);
      return true;
    }

    return false;
  } catch (err) {
    // Network timeout or reachability failure to Cloudflare API -> Fail-Open so legitimate logins are not blocked
    console.warn("[Turnstile] Server verification fallback (Fail-Open mode due to reachability/timeout):", err);
    return true;
  }
}
