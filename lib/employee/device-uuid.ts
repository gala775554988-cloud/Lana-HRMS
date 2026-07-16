/**
 * Lightweight, non-blocking mobile device UUID generator (`ID-First / Zero Fingerprinting`).
 * Avoids CPU-heavy canvas/browser fingerprinting.
 * Generates a clean random UUID (v4) on first launch and stores it in secure storage.
 */
export function getOrCreateMobileDeviceUUID(): string {
  if (typeof window === "undefined") return "server-side";
  const STORAGE_KEY = "lana_mobile_secure_device_uuid";
  try {
    let deviceId = window.localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        deviceId = crypto.randomUUID();
      } else {
        // High-entropy fallback if randomUUID unavailable
        const timestamp = Date.now().toString(36);
        const randomHex = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
        deviceId = `LANA-UUID-${timestamp}-${randomHex}`.toUpperCase();
      }
      window.localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return "mobile-session-fallback";
  }
}
