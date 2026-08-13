/**
 * RouteProgress.js
 * Mathematical utility for calculating progress along a polyline.
 * Snaps driver GPS coordinates to the nearest segment on the route 
 * and calculates travelled vs remaining distances.
 */

export class RouteProgress {
  /**
   * Calculate distance between two lat/lng coordinates in kilometers (Haversine)
   */
  static getDistance(pt1, pt2) {
    const R = 6371; // Earth radius in km
    const dLat = (pt2[0] - pt1[0]) * (Math.PI / 180);
    const dLon = (pt2[1] - pt1[1]) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pt1[0] * (Math.PI / 180)) * Math.cos(pt2[0] * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find the closest point on a line segment (A to B) to a point (P)
   */
  static getClosestPointOnSegment(P, A, B) {
    const AP = [P[0] - A[0], P[1] - A[1]];
    const AB = [B[0] - A[0], B[1] - A[1]];
    const ab2 = AB[0] * AB[0] + AB[1] * AB[1];
    
    if (ab2 === 0) return A;
    
    let t = (AP[0] * AB[0] + AP[1] * AB[1]) / ab2;
    t = Math.max(0, Math.min(1, t)); // Clamp between 0 and 1
    
    return [
      A[0] + t * AB[0],
      A[1] + t * AB[1]
    ];
  }

  /**
   * Analyzes the route geometry to split it into "travelled" and "remaining" segments.
   * Returns distances and the split coordinate arrays for rendering.
   * 
   * @param {Array<Array<number>>} geometry - Route coordinates [[lat, lng], ...]
   * @param {Object} driverLocation - Current driver location {lat, lng}
   * @returns {Object} { travelledPath, remainingPath, distanceLeftKm, percentageComplete }
   */
  static calculateSplit(geometry, driverLocation) {
    if (!geometry || geometry.length < 2 || !driverLocation) {
      return {
        travelledPath: [],
        remainingPath: geometry || [],
        distanceLeftKm: 0,
        percentageComplete: 0
      };
    }

    const driverPt = [driverLocation.lat, driverLocation.lng];
    
    let minDistance = Infinity;
    let closestSegmentIdx = 0;
    let closestPoint = geometry[0];

    // Find the nearest segment to the driver
    for (let i = 0; i < geometry.length - 1; i++) {
      const A = geometry[i];
      const B = geometry[i + 1];
      const ptOnSegment = this.getClosestPointOnSegment(driverPt, A, B);
      const dist = this.getDistance(driverPt, ptOnSegment);
      
      // Allow some snapping tolerance
      if (dist < minDistance) {
        minDistance = dist;
        closestSegmentIdx = i;
        closestPoint = ptOnSegment;
      }
    }

    // Split paths
    // Travelled path: all points before the closest segment + the exact closest point
    const travelledPath = geometry.slice(0, closestSegmentIdx + 1);
    travelledPath.push(closestPoint);

    // Remaining path: exact closest point + all points after
    const remainingPath = [closestPoint];
    for (let i = closestSegmentIdx + 1; i < geometry.length; i++) {
      remainingPath.push(geometry[i]);
    }

    // Calculate total distances
    let travelledDist = 0;
    for (let i = 0; i < travelledPath.length - 1; i++) {
      travelledDist += this.getDistance(travelledPath[i], travelledPath[i+1]);
    }

    let remainingDist = 0;
    for (let i = 0; i < remainingPath.length - 1; i++) {
      remainingDist += this.getDistance(remainingPath[i], remainingPath[i+1]);
    }

    const totalDist = travelledDist + remainingDist;
    const percentageComplete = totalDist > 0 ? (travelledDist / totalDist) * 100 : 0;

    return {
      travelledPath,
      remainingPath,
      distanceLeftKm: remainingDist,
      percentageComplete,
      minDistanceKm: minDistance // expose the cross-track distance
    };
  }

  /**
   * Checks if the driver has deviated significantly from the active route.
   * Uses 50 meters (0.05 km) as the threshold.
   * 
   * @param {Object} driverLocation - Current driver location {lat, lng}
   * @param {Array<Array<number>>} geometry - Route coordinates [[lat, lng], ...]
   * @returns {string} 'ON_ROUTE' or 'OFF_ROUTE'
   */
  static checkDeviationLevel(driverLocation, geometry) {
    if (!geometry || geometry.length < 2 || !driverLocation) return 'ON_ROUTE';
    
    // We can reuse calculateSplit to get the min cross-track distance
    const { minDistanceKm } = this.calculateSplit(geometry, driverLocation);
    
    if (minDistanceKm > 0.05) { // 50 meters
      return 'OFF_ROUTE';
    }
    return 'ON_ROUTE';
  }

  /**
   * Evaluates if a deviated route requires a HARD recalculation (queue rebuild)
   * or just a SOFT recalculation (re-drawing the line to Stop 1).
   * 
   * @param {Object} driverLocation - Current driver location {lat, lng}
   * @param {Array<Object>} routeQueue - The pending stops
   * @returns {string} 'SOFT' or 'HARD'
   */
  static evaluateLogicalThreshold(driverLocation, routeQueue) {
    if (!routeQueue || routeQueue.length === 0) return 'SOFT';
    if (!driverLocation) return 'SOFT';

    const driverPt = [driverLocation.lat, driverLocation.lng];
    let minDistance = Infinity;
    let closestStopIndex = -1;

    routeQueue.forEach((stop, index) => {
      if (stop.coordinates) {
        const stopPt = [stop.coordinates.lat, stop.coordinates.lng];
        const dist = this.getDistance(driverPt, stopPt);
        if (dist < minDistance) {
          minDistance = dist;
          closestStopIndex = index;
        }
      }
    });

    // If the closest stop physically is NOT the first stop in the logical queue,
    // the structure of the queue is compromised.
    if (closestStopIndex > 0) {
      return 'HARD';
    }
    
    return 'SOFT';
  }
}
