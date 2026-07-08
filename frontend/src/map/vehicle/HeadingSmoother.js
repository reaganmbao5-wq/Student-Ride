/**
 * HeadingSmoother.js
 * Prevents erratic 360-degree spins by calculating the shortest angular distance.
 */

export const lerpHeading = (startHeading, endHeading, factor) => {
  let delta = endHeading - startHeading;
  
  // Normalize delta to be between -180 and 180 degrees
  // This ensures the vehicle always turns in the shortest direction
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  
  // Interpolate
  const result = startHeading + delta * factor;
  
  // Normalize back to 0-360 degrees
  return (result + 360) % 360;
};
