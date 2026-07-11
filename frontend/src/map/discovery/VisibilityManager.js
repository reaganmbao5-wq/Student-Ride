/**
 * VisibilityManager.js
 * 
 * Determines if a driver from the DriverPool should be rendered on the student's map.
 * This is about UI presentation, not actual assignment matching.
 */
import { getDriverStatus, DRIVER_STATUS } from './DriverStateManager';

export const getVisibleDrivers = (driversPool, searchRideType = 'private') => {
  return driversPool.filter(driver => {
    const status = getDriverStatus(driver);
    
    // 1. Offline drivers are never visible on the student map
    if (status === DRIVER_STATUS.OFFLINE) return false;
    
    // 2. If the driver is BUSY (has an active ride):
    if (status === DRIVER_STATUS.BUSY) {
      // Rule: Private rides completely hide the driver from all discovery
      if (driver.current_ride_type === 'private') {
        return false;
      }
      
      // Rule: If they are on a shared ride, they are visible ONLY if the student is looking for a shared ride
      if (driver.current_ride_type === 'shared' && searchRideType === 'shared') {
        return true;
      }
      
      // Otherwise, busy drivers are hidden
      return false;
    }
    
    // 3. Online drivers are visible
    return true;
  });
};
