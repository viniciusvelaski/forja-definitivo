// Service worker: makes FORJA installable and usable offline.
// Strategy: precache the shell, then cache every same-origin asset as it is
// requested, so the module graph populates itself on the first online visit
// instead of being listed by hand and silently drifting out of date.

const CACHE = "forja-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles/tokens.css",
  "./src/styles/base.css",
  "./src/styles/components.css",
  "./src/js/main.js",
  "./src/assets/icons/icon-192.png",
  "./src/assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Individual failures must not abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network first so a new build is picked up, cache as fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached ?? caches.match("./")))
    );
    return;
  }

  if (!sameOrigin) {
    // Fonts and other cross-origin assets: cache opportunistically, never block.
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached))
    );
    return;
  }

  // Same-origin assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached ?? network;
    })
  );
});
