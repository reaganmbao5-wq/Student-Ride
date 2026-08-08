/**
 * Global Persistent & In-Memory Data Cache for Student-Ride
 * Provides instant zero-delay tab switching for Home, History, Profile & Ride.
 */

const MEMORY_CACHE = new Map();

export const AppCache = {
  get: (key) => {
    if (MEMORY_CACHE.has(key)) {
      return MEMORY_CACHE.get(key);
    }
    try {
      const stored = localStorage.getItem(`mulurides_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        MEMORY_CACHE.set(key, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn(`[AppCache] Read error for ${key}:`, e);
    }
    return null;
  },

  set: (key, value) => {
    MEMORY_CACHE.set(key, value);
    try {
      localStorage.setItem(`mulurides_cache_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn(`[AppCache] Write error for ${key}:`, e);
    }
  },

  clear: (key) => {
    if (key) {
      MEMORY_CACHE.delete(key);
      localStorage.removeItem(`mulurides_cache_${key}`);
    } else {
      MEMORY_CACHE.clear();
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('mulurides_cache_')) {
          localStorage.removeItem(k);
        }
      });
    }
  },

  // Pre-download key static assets & API datasets on login/app startup
  preloadAll: async (api) => {
    // 1. Preload car asset into browser memory
    try {
      const img = new Image();
      img.src = '/car_top.png';
    } catch (e) {}

    // 2. Pre-fetch API data in parallel silently
    if (!api) return;
    try {
      const [historyRes, activeRes, destRes] = await Promise.allSettled([
        api.get('/rides/history?limit=50'),
        api.get('/rides/active'),
        api.get('/destinations/top')
      ]);

      if (historyRes.status === 'fulfilled' && historyRes.value?.data) {
        const historyData = historyRes.value.data;
        AppCache.set('history', historyData);
        AppCache.set('recent_rides', historyData.slice(0, 5));
      }
      if (activeRes.status === 'fulfilled' && activeRes.value?.data) {
        AppCache.set('active_ride', activeRes.value.data);
      }
      if (destRes.status === 'fulfilled' && destRes.value?.data) {
        AppCache.set('destinations', destRes.value.data);
      }
    } catch (e) {
      console.warn('[AppCache] Preload warning:', e);
    }
  }
};
