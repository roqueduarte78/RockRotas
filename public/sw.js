const CACHE_NAME = 'rota-express-v1';
const TILE_CACHE_NAME = 'rota-express-tiles-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== TILE_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Handle messages from main thread (e.g., bulk tile caching)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_TILES' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        for (const url of event.data.urls) {
          try {
            const match = await cache.match(url);
            if (!match) {
              const res = await fetch(url, { mode: 'cors' });
              if (res.ok) {
                await cache.put(url, res);
              }
            }
          } catch (e) {
            // Ignore individual tile fetch failures when offline or restricted
          }
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isTileUrl = url.includes('tile.openstreetmap.org') || url.includes('cartocdn.com');

  if (isTileUrl) {
    // CACHE-FIRST strategy for map tiles: Instant load from offline cache, fetch network in background
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((tileCache) => {
        return tileCache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached tile immediately, update cache asynchronously if online
            fetch(event.request).then((netRes) => {
              if (netRes && netRes.status === 200) {
                tileCache.put(event.request, netRes);
              }
            }).catch(() => {/* offline */});

            return cachedResponse;
          }

          // Not in cache yet, fetch from network
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              tileCache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Fallback placeholder response or 503 for missing tiles when completely offline
            return new Response('', { status: 404, statusText: 'Tile Not Cached Offline' });
          });
        });
      })
    );
    return;
  }

  // Network-First strategy for static app assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.includes('unpkg.com') || url.includes('/assets/'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
          return new Response('Sem conexão com a internet (Modo Sombra Offline)', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
