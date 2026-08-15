/**
 * NearbyDriverManager.js
 * 
 * The network layer. Responsible for communicating with the backend
 * and pushing the results into the DriverPool.
 */
import { driverPool } from './DriverPool';
import { viewportManager } from './ViewportManager';

class NearbyDriverManager {
  constructor() {
    this.api = null;
    this.intervalId = null;
    this.isPolling = false;
  }

  initialize(apiClient) {
    this.api = apiClient;
  }

  startPolling(intervalMs = 3000) {
    if (this.isPolling) return;
    this.isPolling = true;
    
    // Initial fetch
    this.fetchNearbyDrivers();
    
    this.intervalId = setInterval(() => {
      this.fetchNearbyDrivers();
      // Periodically prune drivers that haven't sent updates (e.g. 15 seconds)
      driverPool.pruneStaleDrivers(15000);
    }, intervalMs);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
  }

  async fetchNearbyDrivers() {
    if (!this.api) return;

    const viewport = viewportManager.getViewport();
    if (!viewport.center || !viewport.center.lat || !viewport.center.lng) {
      return; // No location to search around
    }

    try {
      const response = await this.api.get('/drivers/nearby', {
        params: {
          latitude: viewport.center.lat,
          longitude: viewport.center.lng,
          radius_km: viewport.radiusKm
        }
      });
      
      const rawDrivers = response.data || [];
      
      // Push directly into the Singleton Pool.
      // The pool handles validation, normalization, and deduplication.
      driverPool.updateDrivers(rawDrivers);

    } catch (err) {
      console.error('NearbyDriverManager: Failed to fetch drivers', err);
    }
  }
}

export const nearbyDriverManager = new NearbyDriverManager();
