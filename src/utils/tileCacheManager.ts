import { RouteStop } from '../types';

// Convert Lat/Lng to OpenStreetMap tile coordinates (X, Y, Z)
export function latLngToTileX(lat: number, lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function latLngToTileY(lat: number, lon: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

// Generate tile URLs around all route stops for specified zoom levels
export function getTileUrlsForStops(
  stops: RouteStop[],
  zooms = [13, 14, 15, 16],
  isDarkMode = false
): string[] {
  const validStops = stops.filter((s) => s.lat !== undefined && s.lng !== undefined);
  if (validStops.length === 0) return [];

  const tileSet = new Set<string>();

  zooms.forEach((zoom) => {
    validStops.forEach((stop) => {
      const centerX = latLngToTileX(stop.lat!, stop.lng!, zoom);
      const centerY = latLngToTileY(stop.lat!, stop.lng!, zoom);

      // Cache a 3x3 grid of tiles around each stop for smooth panning
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;

          if (x >= 0 && y >= 0) {
            let tileUrl = '';
            if (isDarkMode) {
              const sub = ['a', 'b', 'c', 'd'][(x + y) % 4];
              tileUrl = `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`;
            } else {
              const sub = ['a', 'b', 'c'][(x + y) % 3];
              tileUrl = `https://${sub}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
            }
            tileSet.add(tileUrl);
          }
        }
      }
    });
  });

  return Array.from(tileSet);
}

// Preload map tiles into Service Worker Cache
export async function preloadMapTilesForRoute(
  stops: RouteStop[],
  isDarkMode = false,
  onProgress?: (downloaded: number, total: number) => void
): Promise<{ success: boolean; cachedCount: number }> {
  const tileUrls = getTileUrlsForStops(stops, [13, 14, 15, 16], isDarkMode);
  if (tileUrls.length === 0) return { success: false, cachedCount: 0 };

  const cacheName = 'rota-express-tiles-v1';
  let downloaded = 0;

  try {
    const cache = await caches.open(cacheName);

    // Fetch and cache in batches of 6 concurrent requests to avoid network thrashing
    const batchSize = 6;
    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (url) => {
          try {
            const existing = await cache.match(url);
            if (!existing) {
              const res = await fetch(url, { mode: 'cors' });
              if (res.ok) {
                await cache.put(url, res);
              }
            }
          } catch (err) {
            console.warn('Failed to fetch tile for cache:', url, err);
          } finally {
            downloaded++;
            if (onProgress) {
              onProgress(downloaded, tileUrls.length);
            }
          }
        })
      );
    }

    // Also notify active service worker if present
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_TILES',
        urls: tileUrls,
      });
    }

    return { success: true, cachedCount: tileUrls.length };
  } catch (err) {
    console.error('Error preloading map tiles:', err);
    return { success: false, cachedCount: downloaded };
  }
}

// Get total cached tile items in storage
export async function getCachedTileCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await caches.open('rota-express-tiles-v1');
    const keys = await cache.keys();
    return keys.length;
  } catch (e) {
    return 0;
  }
}

// Clear all cached tiles
export async function clearTileCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    await caches.delete('rota-express-tiles-v1');
  } catch (e) {
    console.warn('Error clearing tile cache:', e);
  }
}
