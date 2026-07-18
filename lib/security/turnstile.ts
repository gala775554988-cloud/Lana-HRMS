const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile response token server-side. Fails closed on
 * every ambiguous case (missing secret, missing token, network/API error) --
 * a login must never be accepted unless Turnstile has actively confirmed
 * success, not merely "didn't confirm failure".
 */
export async function verifyTurnstileToken(token: string | undefined | null, remoteIp?: string | null): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    return Boolean(data?.success);
  } catch {
    return false;
  }
}
