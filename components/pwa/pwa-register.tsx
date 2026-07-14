"use client";

import { useEffect } from "react";

const SW_CACHE_VERSION = "v5";
const SW_CACHE_STORAGE_KEY = "lana.hrms.sw-cache-version";

async function clearLegacyPwaCaches() {
  if (!("caches" in window)) return;
  const currentVersion = window.localStorage.getItem(SW_CACHE_STORAGE_KEY);
  if (currentVersion === SW_CACHE_VERSION) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith("lana-hrms-"))
      .map((name) => caches.delete(name))
  );
  window.localStorage.setItem(SW_CACHE_STORAGE_KEY, SW_CACHE_VERSION);
}

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const registerServiceWorker = async () => {
      try {
        await clearLegacyPwaCaches();
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });
        await registration.update();

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("lana-pwa-update-ready"));
            }
          });
        });
      } catch (error) {
        console.error("PWA service worker registration failed", error);
      }
    };

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
