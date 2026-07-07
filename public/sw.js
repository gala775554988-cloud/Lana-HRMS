/* Lana HRMS PWA service worker
 * Strategy:
 * - Cache static app assets and PWA icons.
 * - Never cache API responses or authenticated HTML pages by default.
 * - Show a safe offline page when navigation fails.
 */
const CACHE_VERSION = "v4";
const STATIC_CACHE = `lana-hrms-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/favicon.png",
  "/favicon.ico",
  "/brand/lana-logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-192x192.png",
  "/icons/maskable-512x512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((name) => name.startsWith("lana-hrms-") && name !== STATIC_CACHE).map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiOrAuthRequest(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/logout");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.png" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkOnlyNavigation(request) {
  try {
    return await fetch(request);
  } catch (_error) {
    const cachedOffline = await caches.match(OFFLINE_URL);
    return cachedOffline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isApiOrAuthRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOnlyNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
