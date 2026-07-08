/**
 * BearingCalculator.js
 * Calculates the exact heading (bearing) in degrees from point A to point B.
 */

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export const calculateBearing = (startLat, startLng, endLat, endLng) => {
  const lat1 = toRad(startLat);
  const lat2 = toRad(endLat);
  const dLng = toRad(endLng - startLng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  // Calculate raw bearing in degrees
  let bearing = toDeg(Math.atan2(y, x));
  
  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
};

// Calculates haversine distance in meters to act as a noise filter
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
