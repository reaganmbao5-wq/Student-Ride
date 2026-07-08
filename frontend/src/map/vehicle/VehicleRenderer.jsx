import React, { forwardRef } from 'react';
import { Marker } from 'react-leaflet';
import { getVehicleIcon } from './VehicleIcons';

/**
 * VehicleRenderer.jsx
 * Pure presentational component that renders the Leaflet Marker.
 * It uses forwardRef so the Animator can access the raw L.Marker instance to bypass React state for animations.
 */
const VehicleRenderer = forwardRef(({ driver, initialPosition, initialRotation }, ref) => {
  // Determine status (e.g. busy if they have a current_ride_id)
  const status = driver.current_ride_id ? 'busy' : (driver.is_online ? 'online' : 'offline');
  const icon = getVehicleIcon(status);

  return (
    <Marker
      ref={ref}
      position={initialPosition}
      icon={icon}
      rotationAngle={initialRotation}
      rotationOrigin="center center"
      zIndexOffset={100} // Keep vehicles above other map elements
    />
  );
});

VehicleRenderer.displayName = 'VehicleRenderer';

export default VehicleRenderer;
