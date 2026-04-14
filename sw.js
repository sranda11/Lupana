// LUPANA Service Worker — offline-first PWA
const CACHE = 'lupana-v1';

// Assets to pre-cache on install
const PRECACHE = [
  './index.html',
  './manifest.json',
  // Google Fonts (cached at runtime, not pre-cached because they require network on install)
];

// External origins we want to cache at runtime
const CACHE_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
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

// ── Activate: clean up old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for fonts/CDN, cache-first for app ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // App shell (same origin) — cache-first, fallback to network
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // External assets (fonts, CDN) — stale-while-revalidate
  if (CACHE_ORIGINS.some(o => e.request.url.startsWith(o))) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        // Serve cached immediately, update in background
        return cached || await fetchPromise;
      })
    );
  }
});
