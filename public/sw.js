/* VasBazaar Service Worker
 * ------------------------
 * Version-aware cache. Bump CACHE_VERSION whenever you deploy a new build
 * (or, preferably, have the build step replace it). Old caches are purged
 * on activate and clients are claimed so the new SW takes effect without
 * requiring a second reload.
 *
 * Strategy:
 *   - API calls  -> never cached, always network
 *   - version.json -> always network (so OTA check never reads a stale file)
 *   - index.html / navigations -> network-first, cache fallback
 *   - static assets -> stale-while-revalidate
 */
const CACHE_VERSION = "v3";
const CACHE_NAME = `vasbazaar-${CACHE_VERSION}`;
// Cache both root and start_url for PWA
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/customer/app/services",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache assets one by one to avoid failing on a single 404
        Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`SW: failed to cache ${url}:`, err);
            })
          )
        )
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Let the page ask the SW to skip waiting (used by the "Reload" button).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache API or OTA endpoints.
  if (url.pathname.includes("/api/")) return;

  // Always fetch version.json fresh — this is what drives PWA update detection.
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  // Navigation requests: network-first with cache fallback so new HTML
  // is picked up as soon as the network allows, but offline still works.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          // Try to serve from cache first
          const cached = await caches.match(req);
          if (cached) return cached;
          // Fall back to index.html for SPA routing
          const indexCached = await caches.match("/index.html");
          if (indexCached) return indexCached;
          // Last resort: try root
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          // If nothing in cache, return a basic offline page
          return new Response(
            '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>You are offline</h2><p>Please check your internet connection.</p><button onclick="location.reload()">Try Again</button></body></html>',
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // Static assets: stale-while-revalidate from the same origin.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
