// LUPANA Service Worker — offline-first PWA
const CACHE = 'lupana-v3';

// App shell — pre-cache on install
const PRECACHE = [
  './index.html',
  './manifest.json',
];

// External origins to cache at runtime (fonts, Firebase SDK, CDN libs)
const CACHE_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://www.gstatic.com',          // Firebase SDK scripts
  'https://cdnjs.cloudflare.com',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for everything we know about ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only GET requests
  if (e.request.method !== 'GET') return;

  // Same-origin (app itself) — network-first with cache fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request)) // offline fallback from cache
    );
    return;
  }

  // External assets (Firebase SDK, fonts, CDN) — cache-first, update in background
  if (CACHE_ORIGINS.some(o => e.request.url.startsWith(o))) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) {
          // Serve from cache immediately, refresh in background
          fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
          }).catch(() => {});
          return cached;
        }
        // Not cached yet — fetch and cache
        try {
          const res = await fetch(e.request);
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
  }
});
