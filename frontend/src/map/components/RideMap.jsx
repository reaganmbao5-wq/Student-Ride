import React from 'react';
import PlatformMap from './PlatformMap';

export const RideMap = ({
  center = { lat: -14.294896, lng: 28.559798 },
  zoom = 15,
  pickup = null,
  dropoff = null,
  driverLocation = null,
  userLocation = null,
  routeGeometry = null,
  interactive = true,
  className = ""
}) => {
  const markers = [];
  if (pickup) markers.push({ lat: pickup.lat, lng: pickup.lng, iconType: 'pickup', key: 'pickup' });
  if (dropoff) markers.push({ lat: dropoff.lat, lng: dropoff.lng, iconType: 'dropoff', key: 'dropoff' });
  if (userLocation) markers.push({ lat: userLocation.lat, lng: userLocation.lng, iconType: 'user', key: 'user' });

  return (
    <div className={`rounded-2xl overflow-hidden z-0 w-full h-full ${className}`}>
      <PlatformMap
        center={pickup || userLocation || center}
        zoom={zoom}
        markers={markers}
        driverLocation={driverLocation}
        routeGeometry={routeGeometry}
        interactive={interactive}
      />
    </div>
  );
};

export const LocationPickerMap = ({
  center = { lat: -14.294896, lng: 28.559798 },
  zoom = 15,
  selectedLocation = null,
  onLocationSelect,
  nearbyDrivers = [],
  className = ""
}) => {
  const markers = [];
  if (selectedLocation) {
    markers.push({ lat: selectedLocation.lat, lng: selectedLocation.lng, iconType: 'pickup', key: 'selected' });
  }

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden z-0 ${className}`}>
      <PlatformMap
        center={selectedLocation || center}
        zoom={zoom}
        markers={markers}
        drivers={nearbyDrivers}
        interactive={true}
        onCenterChanged={(c) => {
          if (onLocationSelect) onLocationSelect(c);
        }}
      />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border border-border shadow-lg pointer-events-none z-[20]">
        <p className="text-xs text-foreground font-medium">Tap anywhere to select location</p>
      </div>
    </div>
  );
};

export default RideMap;
