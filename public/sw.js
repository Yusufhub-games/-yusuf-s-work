const CACHE_NAME = 'shiftflow-pro-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' }).then((res) => {
            if (res && res.ok) {
              return cache.put(url, res);
            }
          }).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev-only internal endpoints
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/__vite')
  ) {
    return;
  }

  // Navigation requests: Network-first with offline fallback to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/')) || (await cache.match('/index.html'));
        })
    );
    return;
  }

  // Static assets: Cache-first, then network + background update
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
