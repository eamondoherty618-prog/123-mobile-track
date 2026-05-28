const CACHE_NAME = "mobile-track-shell-v2";
const APP_SHELL = [
  "/",
  "/dashboard",
  "/vehicles",
  "/devices",
  "/drivers",
  "/trips",
  "/alerts",
  "/geofences",
  "/maintenance",
  "/features",
  "/settings",
  "/123-mobile-track-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache API responses — always go to network.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for hashed static assets (content hash in filename = safe to cache forever).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => undefined);
          return response;
        });
      }),
    );
    return;
  }

  // Network-first for HTML pages — get fresh content, fall back to cache offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/dashboard"))),
  );
});
