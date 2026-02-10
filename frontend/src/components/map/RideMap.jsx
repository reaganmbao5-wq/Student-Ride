import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const createCustomIcon = (color, svgPath) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2">
        ${svgPath}
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const userIcon = L.divIcon({
  className: 'marker-user',
  html: `<div style="width:16px;height:16px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(59,130,246,0.2);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const pickupIcon = createCustomIcon('#D4AF37', '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>');
const dropoffIcon = createCustomIcon('#10B981', '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>');
const driverIcon = createCustomIcon('#D4AF37', '<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>');

// Component to update map center/zoom when props change
const MapUpdater = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (center) {
      map.flyTo(center, zoom);
    }
  }, [center, zoom, bounds, map]);

  return null;
};

// Component to handle map clicks
const MapEvents = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect({
          lat: e.latlng.lat,
          lng: e.latlng.lng
        });
      }
    },
  });
  return null;
};

export const RideMap = ({
  center = { lat: -14.42, lng: 28.45 },
  zoom = 13,
  pickup = null,
  dropoff = null,
  driverLocation = null,
  userLocation = null,
  routeGeometry = null,
  interactive = true,
  className = ""
}) => {
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    if (pickup && dropoff) {
      const b = L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
      if (driverLocation) b.extend([driverLocation.lat, driverLocation.lng]);
      if (userLocation) b.extend([userLocation.lat, userLocation.lng]);
      setBounds(b);
    } else if (pickup || dropoff || driverLocation || userLocation) {
      const points = [];
      if (pickup) points.push([pickup.lat, pickup.lng]);
      if (dropoff) points.push([dropoff.lat, dropoff.lng]);
      if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
      if (userLocation) points.push([userLocation.lat, userLocation.lng]);

      if (points.length > 1) {
        setBounds(L.latLngBounds(points));
      } else {
        setBounds(null); // Let center take over if only 1 point
      }
    }
  }, [pickup, dropoff, driverLocation, userLocation]);

  // Determine effective center if no bounds
  const effectiveCenter = pickup ? [pickup.lat, pickup.lng] :
    userLocation ? [userLocation.lat, userLocation.lng] :
      [center.lat, center.lng];

  return (
    <div className={`rounded-xl overflow-hidden z-0 ${className}`}>
      <MapContainer
        center={effectiveCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        scrollWheelZoom={interactive}
        attributionControl={false} // Clean look
      >
        {/* Dark Matter-like Tile Layer (CartoDB Dark Matter is Free/Open) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapUpdater center={effectiveCenter} zoom={zoom} bounds={bounds} />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />
        )}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
        )}

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />
        )}

        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {pickup && dropoff && (
          routeGeometry ? (
            <Polyline
              positions={routeGeometry.map(coord => [coord[1], coord[0]])}
              pathOptions={{ color: '#3B82F6', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
            />
          ) : (
            <Polyline
              positions={[[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]}
              pathOptions={{ color: '#D4AF37', weight: 4, opacity: 0.8, dashArray: '10, 10' }}
            />
          )
        )}
      </MapContainer>
    </div>
  );
};

export const LocationPickerMap = ({
  center = { lat: -14.42, lng: 28.45 },
  zoom = 14,
  selectedLocation = null,
  onLocationSelect,
  nearbyDrivers = [],
  className = ""
}) => {
  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden z-0 ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapUpdater center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [center.lat, center.lng]} zoom={zoom} />
        <MapEvents onLocationSelect={onLocationSelect} />

        {/* Selected Pickup Location */}
        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pickupIcon} />
        )}

        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.latitude, driver.longitude]}
            icon={driverIcon}
            rotationAngle={driver.heading} // If using leaflet-rotatedmarker, otherwise just marker
          >
            {/* Optional: Add Popup if needed, but prompt says just markers first */}
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-none z-[400]">
        <p className="text-xs text-white">Tap anywhere to select location</p>
      </div>
    </div>
  );
};

export default RideMap;
