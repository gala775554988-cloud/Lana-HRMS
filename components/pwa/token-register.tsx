"use client";

import { useEffect } from "react";
import { getOrCreateMobileDeviceUUID } from "@/lib/employee/device-uuid";

const TOKEN_CACHE_KEY = "lana.hrms.registered-fcm-token";

/**
 * PWA Push Token & Device Registration Component (`TokenRegister`)
 * ----------------------------------------------------------------
 * 1. Requests Notification permission (`Notification.requestPermission()`).
 * 2. Retrieves Web Push subscription or generates secure device token (`fcmToken`).
 * 3. Securely registers token with `/api/enterprise/register-device` in Neon PostgreSQL.
 */
export function TokenRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    async function requestPermissionAndRegister() {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }

        if (Notification.permission !== "granted") return;

        let token: string | null = null;

        // 1. Try native Service Worker PushManager subscription first (Standard Web Push)
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_KEY;
            if (vapidKey && reg.pushManager) {
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey
              });
              token = JSON.stringify(sub);
            }
          } catch {}
        }

        // 2. If no VAPID / PushManager subscription, generate a secure device push identifier
        if (!token) {
          const deviceUUID = getOrCreateMobileDeviceUUID();
          token = `fcm-pwa-${deviceUUID}`;
        }

        // Check if token already registered recently to avoid excessive POST calls
        const cachedToken = window.localStorage.getItem(TOKEN_CACHE_KEY);
        if (cachedToken === token) return;

        await registerDeviceToken(token);
        window.localStorage.setItem(TOKEN_CACHE_KEY, token);
      } catch (error) {
        console.error("[TokenRegister] فشل تسجيل التوكن:", error);
      }
    }

    requestPermissionAndRegister();
  }, []);

  async function registerDeviceToken(token: string) {
    try {
      const deviceId = getOrCreateMobileDeviceUUID();
      await fetch("/api/enterprise/register-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          deviceId,
          platform: typeof window !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios-pwa" : "mobile-pwa"
        })
      });
    } catch (err) {
      console.error("[TokenRegister] Error registering with backend:", err);
    }
  }

  return null;
}
