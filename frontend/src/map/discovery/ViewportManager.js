/**
 * ViewportManager.js
 * 
 * Monitors the map bounds to determine the appropriate search radius
 * and center point for querying the backend.
 */

class ViewportManager {
  constructor() {
    this.currentCenter = null;
    this.currentRadiusKm = 10;
  }

  updateViewport(centerLat, centerLng, radiusKm) {
    this.currentCenter = { lat: centerLat, lng: centerLng };
    this.currentRadiusKm = radiusKm || 10;
  }

  getViewport() {
    return {
      center: this.currentCenter,
      radiusKm: this.currentRadiusKm
    };
  }
}

export const viewportManager = new ViewportManager();
