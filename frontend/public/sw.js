const CACHE_NAME = "mobile-track-shell-v5";
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
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      const stale = keys.filter((key) => key !== CACHE_NAME);
      if (stale.length > 0) {
        await Promise.all(stale.map((key) => caches.delete(key)));
        // Force all open pages to reload so they pick up the new JS immediately.
        const openClients = await self.clients.matchAll({ type: "window" });
        await Promise.all(openClients.map((c) => c.navigate(c.url)));
      }
    })(),
  );
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

self.addEventListener("push", (event) => {
  let data = { title: "Fleet alert", body: "A new alert fired.", url: "/alerts" };
  try {
    data = Object.assign(data, JSON.parse(event.data.text()));
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/123-mobile-track-logo.png",
      badge: "/123-mobile-track-logo.png",
      data: { url: data.url },
      tag: "fleet-alert",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/alerts";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const existing = clientList.find((c) => c.url.includes(self.location.origin) && "focus" in c);
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        clients.openWindow(url);
      }
    }),
  );
});
