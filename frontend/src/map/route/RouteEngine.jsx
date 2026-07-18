import React, { useMemo } from 'react';
import { RouteRenderer } from './RouteRenderer';
import { RouteProgress } from './RouteProgress';

/**
 * RouteEngine.jsx
 * Orchestrator for route rendering.
 * Takes the raw geometry and driver location, computes the dynamic split,
 * and passes the segments to RouteRenderer.
 */
export const RouteEngine = ({ geometry, driverLocation, status, onAnimationChange, color }) => {

  const { travelledPath, remainingPath } = useMemo(() => {
    // If no driver location or ride hasn't started active tracking, 
    // just return the full geometry as remaining.
    if (!driverLocation || !['accepted', 'driver_arrived', 'ongoing'].includes(status)) {
      return {
        travelledPath: [],
        remainingPath: geometry || []
      };
    }

    // Split the route dynamically based on driver GPS
    return RouteProgress.calculateSplit(geometry, driverLocation);
  }, [geometry, driverLocation, status]);

  if (!geometry || geometry.length === 0) return null;

  return (
    <RouteRenderer 
      travelledPath={travelledPath}
      remainingPath={remainingPath}
      status={status}
      onAnimationChange={onAnimationChange}
      color={color}
    />
  );
};
