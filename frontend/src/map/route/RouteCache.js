/**
 * RouteCache.js
 * Simple in-memory cache for routing geometries to prevent redundant API calls.
 */

class RouteCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generates a unique key for a pair of coordinates.
   */
  _generateKey(pickup, dropoff) {
    if (!pickup || !dropoff) return null;
    // Round to ~10 meters precision (4 decimal places) to increase cache hits
    const pLat = parseFloat(pickup.lat).toFixed(4);
    const pLng = parseFloat(pickup.lng).toFixed(4);
    const dLat = parseFloat(dropoff.lat).toFixed(4);
    const dLng = parseFloat(dropoff.lng).toFixed(4);
    return `${pLat},${pLng}|${dLat},${dLng}`;
  }

  getRoute(pickup, dropoff) {
    const key = this._generateKey(pickup, dropoff);
    if (!key) return null;
    return this.cache.get(key) || null;
  }

  setRoute(pickup, dropoff, geometry) {
    const key = this._generateKey(pickup, dropoff);
    if (key && geometry) {
      this.cache.set(key, geometry);
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const routeCache = new RouteCache();
