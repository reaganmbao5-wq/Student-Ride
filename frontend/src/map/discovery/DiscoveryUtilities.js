/**
 * DiscoveryUtilities.js
 * 
 * Helper functions for the Driver Discovery Engine.
 * Responsible for payload validation to ensure the VehicleEngine contract is never violated.
 */

export const validateDriverPayload = (driver) => {
  if (!driver) return false;
  if (!driver.id) return false;
  
  // Accept either flat lat/lng or nested location object
  const hasFlatCoords = typeof driver.latitude === 'number' && typeof driver.longitude === 'number';
  const hasNestedCoords = driver.location && typeof driver.location.lat === 'number' && typeof driver.location.lng === 'number';
  const hasAltFlatCoords = typeof driver.lat === 'number' && typeof driver.lng === 'number';
  
  return hasFlatCoords || hasNestedCoords || hasAltFlatCoords;
};

export const normalizeDriverPayload = (driver) => {
  // Always output exactly what VehicleEngine expects.
  // VehicleAnimator supports driver.lat/driver.lng OR driver.latitude/driver.longitude.
  // We normalize to lat/lng to be perfectly safe and predictable.
  const lat = driver.lat ?? driver.latitude ?? driver.location?.lat;
  const lng = driver.lng ?? driver.longitude ?? driver.location?.lng;
  
  return {
    ...driver,
    id: driver.id,
    lat,
    lng,
    heading: driver.heading || 0,
    status: driver.status || 'online',
    current_ride_id: driver.current_ride_id || null,
  };
};
