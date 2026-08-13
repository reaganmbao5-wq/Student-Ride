/**
 * DriverPool.js
 * 
 * A singleton cache that acts as the Single Source of Truth for all drivers.
 * Prevents marker duplication and React re-render thrashing.
 */
import { validateDriverPayload, normalizeDriverPayload } from './DiscoveryUtilities';

class DriverPool {
  constructor() {
    this.drivers = new Map();
    this.listeners = new Set();
  }

  /**
   * Updates or adds a batch of drivers to the pool.
   * @param {Array} incomingDrivers - Raw array from API/WebSockets
   */
  updateDrivers(incomingDrivers) {
    if (!Array.isArray(incomingDrivers)) return;

    let hasChanges = false;

    incomingDrivers.forEach(rawDriver => {
      if (!validateDriverPayload(rawDriver)) return;

      const driver = normalizeDriverPayload(rawDriver);
      const existing = this.drivers.get(driver.id);

      // Simple comparison to avoid unnecessary state propagation if nothing changed
      if (!existing || 
          existing.lat !== driver.lat || 
          existing.lng !== driver.lng || 
          existing.status !== driver.status ||
          existing.current_ride_id !== driver.current_ride_id) {
        
        this.drivers.set(driver.id, {
          ...existing, // Preserve any internal state
          ...driver,
          last_updated: Date.now()
        });
        hasChanges = true;
      } else {
        // Just update timestamp so they don't get pruned
        existing.last_updated = Date.now();
      }
    });

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  /**
   * Removes drivers that haven't been updated in a while.
   */
  pruneStaleDrivers(timeoutMs = 15000) {
    const now = Date.now();
    let hasChanges = false;

    for (const [id, driver] of this.drivers.entries()) {
      if (now - driver.last_updated > timeoutMs) {
        this.drivers.delete(id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  getAll() {
    return Array.from(this.drivers.values());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const driversArray = this.getAll();
    this.listeners.forEach(listener => listener(driversArray));
  }
}

export const driverPool = new DriverPool();
