/**
 * DriverDiscoveryEngine.jsx
 * 
 * The React entry point for the Discovery Module.
 * Replaces `useNearbyDrivers`.
 * Subscribes to the DriverPool and applies VisibilityManager rules to output
 * a memoized array of perfectly formatted drivers for the VehicleEngine.
 */
import { useState, useEffect } from 'react';
import { driverPool } from './DriverPool';
import { nearbyDriverManager } from './NearbyDriverManager';
import { viewportManager } from './ViewportManager';
import { getVisibleDrivers } from './VisibilityManager';

export const useDriverDiscovery = (api, location, searchRideType = 'private') => {
  const [visibleDrivers, setVisibleDrivers] = useState([]);

  // Initialize Network Layer and Viewport
  useEffect(() => {
    if (!api || !location || !location.lat || !location.lng) return;
    
    nearbyDriverManager.initialize(api);
    // Update viewport center based on user location (or map center in the future)
    // Radius is hardcoded to 10km for now
    viewportManager.updateViewport(location.lat, location.lng, 10);
    
    nearbyDriverManager.startPolling(3000);

    return () => {
      nearbyDriverManager.stopPolling();
    };
  }, [api, location?.lat, location?.lng]);

  // Subscribe to DriverPool updates
  useEffect(() => {
    const handlePoolUpdate = (allDrivers) => {
      // Filter the raw pool to only show visible drivers based on the requested ride type
      const filtered = getVisibleDrivers(allDrivers, searchRideType);
      setVisibleDrivers(filtered);
    };

    // Initial load
    handlePoolUpdate(driverPool.getAll());

    // Subscribe to future updates
    const unsubscribe = driverPool.subscribe(handlePoolUpdate);
    return () => unsubscribe();
  }, [searchRideType]);

  return { drivers: visibleDrivers };
};
