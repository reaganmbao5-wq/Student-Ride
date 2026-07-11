/**
 * DriverStateManager.js
 * 
 * Tracks the lifecycle status of a driver to ensure smooth transitions
 * and accurate availability representing.
 */

export const DRIVER_STATUS = {
  ONLINE: 'online',     // Available for any ride
  BUSY: 'busy',         // Currently in a ride or not accepting requests
  OFFLINE: 'offline'    // Disconnected
};

/**
 * Determines the normalized status of a driver based on their payload.
 */
export const getDriverStatus = (driver) => {
  if (!driver) return DRIVER_STATUS.OFFLINE;
  
  if (driver.status === 'offline') return DRIVER_STATUS.OFFLINE;
  
  // If they have an active ride assigned, they are automatically busy
  if (driver.current_ride_id) return DRIVER_STATUS.BUSY;
  
  // Explicit busy status
  if (driver.status === 'busy') return DRIVER_STATUS.BUSY;
  
  return DRIVER_STATUS.ONLINE;
};
