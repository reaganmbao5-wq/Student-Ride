/**
 * RouteCache.js
 * Simple in-memory cache for routing geometries to prevent redundant API calls.
 */

class RouteCache {
  constructor() {
    this.cache = new Map();
  }

  _extract(pt) {
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      return (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
    }
    const lat = Number(pt.lat ?? pt.latitude);
    const lng = Number(pt.lng ?? pt.longitude);
    return (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
  }

  /**
   * Generates a unique key for a pair of coordinates.
   */
  _generateKey(pickup, dropoff) {
    const p = this._extract(pickup);
    const d = this._extract(dropoff);
    if (!p || !d) return null;
    // Round to ~10 meters precision (4 decimal places) to increase cache hits
    const pLat = p.lat.toFixed(4);
    const pLng = p.lng.toFixed(4);
    const dLat = d.lat.toFixed(4);
    const dLng = d.lng.toFixed(4);
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
    const p = this._extract(pickup);
    const d = this._extract(dropoff);
    if (!p || !d) return null;
    const dropoffLat = d.lat.toFixed(4);
    const dropoffLng = d.lng.toFixed(4);
    const targetDestStr = `${dropoffLat},${dropoffLng}`;
    
    for (const [key, geometry] of this.cache.entries()) {
      const parts = key.split('|');
      if (parts.length === 2 && parts[1] === targetDestStr) {
        const pCoords = parts[0].split(',');
        const cLat = parseFloat(pCoords[0]);
        const cLng = parseFloat(pCoords[1]);
        if (Math.abs(cLat - p.lat) <= toleranceDegrees && Math.abs(cLng - p.lng) <= toleranceDegrees) {
          return geometry;
        }
      }
    }
    return null;
  }

  setRoute(pickup, dropoff, geometry) {
    const key = this._generateKey(pickup, dropoff);
    // STRICT GUARD: Never cache 2-point straight line fallbacks!
    if (key && geometry && Array.isArray(geometry) && geometry.length > 2) {
      this.cache.set(key, geometry);
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const routeCache = new RouteCache();
