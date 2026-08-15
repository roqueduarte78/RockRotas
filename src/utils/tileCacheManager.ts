import { RouteStop } from '../types';

export interface FrequentLocation {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  visitsCount: number;
  lastVisited: string;
}

const FREQUENT_LOCATIONS_KEY = 'ROTA_EXPRESS_FREQUENT_LOCATIONS';
const LAST_WIFI_PRELOAD_KEY = 'ROTA_EXPRESS_LAST_WIFI_PRELOAD';

/**
 * Detect if the device is currently on a Wi-Fi or high-speed unmetered connection
 */
export function isWifiConnection(): boolean {
  if (typeof window === 'undefined' || !navigator.onLine) return false;

  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (connection) {
    // If Network Information API gives connection type:
    if (connection.type === 'wifi' || connection.type === 'ethernet') {
      return true;
    }
    // Check if user has data-saver enabled
    if (connection.saveData === true) {
      return false;
    }
    // High-speed cellular with no data-saver can also benefit
    if (connection.effectiveType === '4g' && !connection.type) {
      return true;
    }
    if (connection.type && connection.type !== 'cellular') {
      return true;
    }
  }

  // Fallback: If online and no explicit cellular restriction, assume broadband/wifi in desktop/web
  return true;
}

/**
 * Get all saved frequently visited delivery hubs and centers
 */
export function getFrequentLocations(): FrequentLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(FREQUENT_LOCATIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.visitsCount - a.visitsCount);
      }
    }
  } catch (e) {
    console.warn('Failed to load frequent locations:', e);
  }
  return [];
}

/**
 * Record a location into the frequent areas database
 */
export function recordFrequentLocation(lat: number, lng: number, label?: string): void {
  if (typeof window === 'undefined' || !lat || !lng) return;
  try {
    const locations = getFrequentLocations();
    // Check if location is within ~1.5km of existing recorded hub
    const existingIndex = locations.findIndex((item) => {
      const dLat = Math.abs(item.lat - lat);
      const dLng = Math.abs(item.lng - lng);
      return dLat < 0.015 && dLng < 0.015;
    });

    if (existingIndex >= 0) {
      locations[existingIndex].visitsCount += 1;
      locations[existingIndex].lastVisited = new Date().toISOString();
      if (label && !locations[existingIndex].label) {
        locations[existingIndex].label = label;
      }
    } else {
      locations.push({
        id: `hub-${Date.now()}`,
        lat,
        lng,
        label: label || `Ponto ${locations.length + 1}`,
        visitsCount: 1,
        lastVisited: new Date().toISOString(),
      });
    }

    // Keep top 20 frequent locations
    const trimmed = locations.sort((a, b) => b.visitsCount - a.visitsCount).slice(0, 20);
    localStorage.setItem(FREQUENT_LOCATIONS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save frequent location:', e);
  }
}

/**
 * Record all current route stops as visited locations
 */
export function recordRouteLocations(stops: RouteStop[]): void {
  stops.forEach((s) => {
    if (s.lat && s.lng) {
      recordFrequentLocation(s.lat, s.lng, s.address);
    }
  });
}

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

// Generate tile URLs around all route stops and frequent hubs for specified zoom levels
export function getTileUrlsForPoints(
  points: Array<{ lat: number; lng: number }>,
  zooms = [13, 14, 15, 16],
  isDarkMode = false
): string[] {
  const valid = points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  if (valid.length === 0) return [];

  const tileSet = new Set<string>();

  zooms.forEach((zoom) => {
    valid.forEach((p) => {
      const centerX = latLngToTileX(p.lat, p.lng, zoom);
      const centerY = latLngToTileY(p.lat, p.lng, zoom);

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

// Generate tile URLs around all route stops for specified zoom levels
export function getTileUrlsForStops(
  stops: RouteStop[],
  zooms = [13, 14, 15, 16],
  isDarkMode = false
): string[] {
  const points = stops
    .filter((s) => s.lat !== undefined && s.lng !== undefined)
    .map((s) => ({ lat: s.lat!, lng: s.lng! }));
  return getTileUrlsForPoints(points, zooms, isDarkMode);
}

// Preload map tiles into Service Worker Cache
export async function preloadMapTilesForRoute(
  stops: RouteStop[],
  isDarkMode = false,
  onProgress?: (downloaded: number, total: number) => void
): Promise<{ success: boolean; cachedCount: number }> {
  // Combine route stops + top frequent hubs
  const stopPoints = stops
    .filter((s) => s.lat !== undefined && s.lng !== undefined)
    .map((s) => ({ lat: s.lat!, lng: s.lng! }));

  const frequentPoints = getFrequentLocations()
    .slice(0, 8)
    .map((f) => ({ lat: f.lat, lng: f.lng }));

  const allPoints = [...stopPoints, ...frequentPoints];
  const tileUrls = getTileUrlsForPoints(allPoints, [13, 14, 15, 16], isDarkMode);
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
            // Ignore individual tile fetch error
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

    // Record last sync timestamp
    try {
      localStorage.setItem(
        LAST_WIFI_PRELOAD_KEY,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          tileCount: tileUrls.length,
        })
      );
    } catch {
      // ignore
    }

    return { success: true, cachedCount: tileUrls.length };
  } catch (err) {
    console.error('Error preloading map tiles:', err);
    return { success: false, cachedCount: downloaded };
  }
}

/**
 * Automatically preload tiles when Wi-Fi is available
 */
export async function autoPreloadTilesOnWifi(
  stops: RouteStop[],
  isDarkMode = false
): Promise<{ success: boolean; cachedCount: number; isWifi: boolean }> {
  if (!isWifiConnection()) {
    return { success: false, cachedCount: 0, isWifi: false };
  }

  // Record current route locations into frequent database
  recordRouteLocations(stops);

  // Check if we already preloaded in the last 30 minutes to avoid redundant downloads
  try {
    const last = localStorage.getItem(LAST_WIFI_PRELOAD_KEY);
    if (last) {
      const { timestamp } = JSON.parse(last);
      const diffMs = Date.now() - new Date(timestamp).getTime();
      if (diffMs < 30 * 60 * 1000) {
        const count = await getCachedTileCount();
        return { success: true, cachedCount: count, isWifi: true };
      }
    }
  } catch {
    // continue
  }

  const result = await preloadMapTilesForRoute(stops, isDarkMode);
  return { ...result, isWifi: true };
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
