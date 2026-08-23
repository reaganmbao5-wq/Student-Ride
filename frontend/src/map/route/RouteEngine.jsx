import React, { useMemo } from 'react';
import { RouteRenderer } from './RouteRenderer';
import { RouteProgress } from './RouteProgress';

/**
 * RouteEngine.jsx
 * Unified Orchestrator for route rendering.
 * Aggregates multi-segment route arrays and single polylines, 
 * performs active-leg-only dynamic GPS slicing, and feeds a single
 * FeatureCollection to RouteRenderer.
 */
export const RouteEngine = ({ 
  id = 'default', 
  map, 
  routes = [], 
  geometry = [], 
  driverLocation, 
  status, 
  onAnimationChange, 
  color 
}) => {

  const processedSegments = useMemo(() => {
    const activeStates = [
      'accepted', 'driver_accepted', 'driver_en_route_to_pickup', 
      'driver_arrived', 'passenger_boarding', 'ride_started', 
      'ongoing', 'ride_in_progress', 'arriving_destination'
    ];
    const normalizedStatus = status ? String(status).toLowerCase() : '';
    const isTrackingActive = driverLocation && activeStates.includes(normalizedStatus);

    // Multi-segment routes array (e.g. driver multi-stop queue or student multi-stop projection)
    if (routes && Array.isArray(routes) && routes.length > 0) {
      return routes.map((seg, idx) => {
        if (!seg || !seg.geometry) return null;
        
        // CRITICAL: Only the first active leg (Driver -> Stop 1) is dynamically sliced by driver GPS
        if (idx === 0 && isTrackingActive && seg.geometry.length >= 2) {
          const split = RouteProgress.calculateSplit(seg.geometry, driverLocation);
          return {
            ...seg,
            geometry: split.remainingPath || seg.geometry,
            isNextLeg: true
          };
        }
        
        // Future legs remain 100% intact from waypoint to waypoint
        return {
          ...seg,
          isNextLeg: (idx === 0)
        };
      }).filter(Boolean);
    }

    // Single polyline fallback (e.g. initial ride request or single-passenger preview)
    if (geometry && Array.isArray(geometry) && geometry.length >= 2) {
      if (isTrackingActive) {
        const split = RouteProgress.calculateSplit(geometry, driverLocation);
        return [{
          rideId: 'main-route',
          geometry: split.remainingPath || geometry,
          color: color || '#3B82F6',
          isNextLeg: true
        }];
      }
      return [{
        rideId: 'main-route',
        geometry: geometry,
        color: color || '#3B82F6',
        isNextLeg: true
      }];
    }

    return [];
  }, [routes, geometry, driverLocation, status, color]);

  if (!map || processedSegments.length === 0) return null;

  return (
    <RouteRenderer 
      id={id}
      map={map}
      segments={processedSegments}
      status={status}
      onAnimationChange={onAnimationChange}
      color={color}
    />
  );
};

export default RouteEngine;
