/**
 * FollowController calculates the ideal camera position to keep the vehicle in view.
 * Instead of snapping, it provides a target coordinate that the Animator will ease toward.
 */
class FollowController {
  
  /**
   * Calculates where the camera should look to follow the driver.
   * We simply return the driver's current LatLng. 
   * The CameraAnimator will handle the smooth interpolation (easing) toward this point,
   * creating the "lagging slightly behind" professional effect seen in Uber/Bolt.
   */
  getTargetCenter(driverLocation) {
    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      return null;
    }

    let lat = driverLocation.lat;
    let lng = driverLocation.lng;

    // Add a dynamic "look ahead" vector based on the driver's heading
    // This pushes the camera slightly ahead of the car, creating a professional GPS navigation feel
    // revealing more of the road ahead rather than the road behind.
    if (driverLocation.heading !== undefined && driverLocation.heading !== null) {
      // Look ahead by roughly 35 meters (0.0003 degrees)
      // This ensures the car stays well within the visible frame even at high zoom levels
      const LOOK_AHEAD_DEGREES = 0.0003; 
      const headingRad = driverLocation.heading * (Math.PI / 180);
      
      // GPS heading: 0=North (increase lat), 90=East (increase lng)
      lat += Math.cos(headingRad) * LOOK_AHEAD_DEGREES;
      lng += Math.sin(headingRad) * LOOK_AHEAD_DEGREES;
    }

    return { lat, lng };
  }
}

export const followController = new FollowController();
