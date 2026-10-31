// Service Worker de Hubzy (PWA)
const CACHE_NAME = "hubzy-v5";
const STATIC_ASSETS = [
  "/favicon.png",
  "/favicon.ico",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NUNCA cachear en localhost/dev para permitir recarga instantánea de Vite
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.pathname.includes("@vite") ||
    url.pathname.includes("@fs") ||
    url.pathname.includes("/src/") ||
    url.pathname.startsWith("/api/") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // En producción (network-first, fallback a cache)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

