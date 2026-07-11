/**
 * DriverMatcher.js
 * 
 * Implements the strict business rules for assigning a driver to a ride request.
 */
import { getDriverStatus, DRIVER_STATUS } from './DriverStateManager';

export const isDriverEligibleForRide = (driver, rideRequest) => {
  const status = getDriverStatus(driver);
  const isPrivateRequest = rideRequest.type === 'private';
  const isSharedRequest = rideRequest.type === 'shared';

  if (status === DRIVER_STATUS.OFFLINE) return false;

  if (isPrivateRequest) {
    // Private rides may ONLY be offered to drivers without ANY active passengers.
    if (status === DRIVER_STATUS.BUSY) return false;
    return true;
  }

  if (isSharedRequest) {
    // Shared requests can only be offered to drivers who:
    // 1. accept shared rides (assuming disabled_shared_rides is a flag, default false)
    if (driver.disabled_shared_rides) return false;
    
    // 2. are not carrying a private passenger
    if (status === DRIVER_STATUS.BUSY && driver.current_ride_type === 'private') return false;
    
    // 3. have available platform seats
    const totalCapacity = driver.capacity || 4; // default to 4 seats
    const usedSeats = driver.current_passengers_count || 0;
    const requestedSeats = rideRequest.passengers || 1;
    
    if (usedSeats + requestedSeats > totalCapacity) return false;

    return true;
  }

  return false; // Unknown ride type
};
