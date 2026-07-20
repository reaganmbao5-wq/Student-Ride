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

  /**
   * Checks for a cached route to the dropoff that originates from roughly the same area.
   * Useful for the driver's location which drifts constantly by a few meters.
   * toleranceDegrees of 0.0002 is approx 22 meters.
   */
  getLenientRoute(pickup, dropoff, toleranceDegrees = 0.0002) {
    if (!pickup || !dropoff) return null;
    const dropoffLat = parseFloat(dropoff.lat).toFixed(4);
    const dropoffLng = parseFloat(dropoff.lng).toFixed(4);
    const targetDestStr = `${dropoffLat},${dropoffLng}`;
    
    for (const [key, geometry] of this.cache.entries()) {
      const parts = key.split('|');
      if (parts.length === 2 && parts[1] === targetDestStr) {
        const pCoords = parts[0].split(',');
        const cLat = parseFloat(pCoords[0]);
        const cLng = parseFloat(pCoords[1]);
        if (Math.abs(cLat - pickup.lat) <= toleranceDegrees && Math.abs(cLng - pickup.lng) <= toleranceDegrees) {
          return geometry;
        }
      }
    }
    return null;
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
