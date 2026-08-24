import React, { useMemo } from 'react';
import RouteRenderer from './RouteRenderer';
import { RouteProgress } from './RouteProgress';

export const RouteEngine = ({ 
  map, 
  routes = [], 
  routeGeometry = [], 
  driverLocation, 
  rideStatus, 
  onAnimationChange 
}) => {
  const processedSegments = useMemo(() => {
    if (!routes || routes.length === 0) {
      if (!routeGeometry || routeGeometry.length === 0) return [];
      
      // Single Polyline Fallback (e.g., student initial booking preview)
      const split = driverLocation && routeGeometry.length >= 2
        ? RouteProgress.calculateSplit(routeGeometry, driverLocation)
        : { remainingPath: routeGeometry };

      return [{
        rideId: 'main-route',
        geometry: split.remainingPath || routeGeometry,
        color: '#3B82F6',
        isNextLeg: true
      }];
    }

    return routes.map((segment, idx) => {
      if (!segment || !segment.geometry) return null;

      // ONLY slice the active driver leg (idx === 0)
      if (idx === 0 && driverLocation && segment.geometry && segment.geometry.length >= 2) {
        const split = RouteProgress.calculateSplit(segment.geometry, driverLocation);
        return {
          ...segment,
          geometry: split.remainingPath || segment.geometry,
          isNextLeg: true
        };
      }
      
      // Future legs remain 100% intact
      return {
        ...segment,
        isNextLeg: (idx === 0)
      };
    }).filter(Boolean);
  }, [routes, routeGeometry, driverLocation]);

  return <RouteRenderer map={map} segments={processedSegments} />;
};

export default RouteEngine;

