/**
 * VehicleInterpolator.js
 * Handles mathematical interpolation (LERP) and easing for smooth vehicle movement.
 */

// Basic Linear Interpolation
export const lerp = (start, end, factor) => {
  return start + (end - start) * factor;
};

// Easing function for natural acceleration/deceleration
// Using a Sine ease-in-out gives a very natural smooth start and stop
export const easeInOutSine = (x) => {
  return -(Math.cos(Math.PI * x) - 1) / 2;
};

// Linear easing for constant speed
export const easeLinear = (x) => {
  return x;
};
