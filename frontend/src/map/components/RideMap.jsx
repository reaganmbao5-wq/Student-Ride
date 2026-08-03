import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-rotatedmarker';

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

// Section 4: Car Icon with Rotation
const driverIcon = L.divIcon({
  className: 'custom-car-marker',
  html: `<div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1" transform="rotate(-90)">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20] // center
});

// Component to update map center/zoom when props change
const MapUpdater = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      // Different padding and maxZoom depending on the view
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: zoom || 16 });
    } else if (center) {
      map.flyTo(center, zoom || 13);
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

// Smooth marker component for drivers
const SmoothDriverMarker = ({ position, heading }) => {
  const [currentPos, setCurrentPos] = useState(position);

  // Section 3: Smooth Driver Movement interpolation
  useEffect(() => {
    if (!position) return;

    // Simple interpolation logic over 1 second (assumed update rate)
    const startPos = currentPos;
    const endPos = position;
    const startTime = performance.now();
    const duration = 1000; // ms

    let animationFrame;

    const animate = (time) => {
      let progress = (time - startTime) / duration;
      if (progress > 1) progress = 1;

      const lat = startPos.lat + (endPos.lat - startPos.lat) * progress;
      const lng = startPos.lng + (endPos.lng - startPos.lng) * progress;

      setCurrentPos({ lat, lng });

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [position, currentPos]);

  return (
    <Marker
      position={[currentPos.lat, currentPos.lng]}
      icon={driverIcon}
      rotationAngle={heading || 0}
      rotationOrigin="center center"
    />
  );
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
  const [effectiveZoom, setEffectiveZoom] = useState(zoom);

  useEffect(() => {
    // Dynamic zoom logic
    if (pickup && dropoff && driverLocation) {
      setEffectiveZoom(15); // Arriving or ongoing ride
    } else if (pickup && dropoff) {
      setEffectiveZoom(14); // Searching route
    } else {
      setEffectiveZoom(13); // Default view
    }

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
        zoom={effectiveZoom}
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

        <MapUpdater center={effectiveCenter} zoom={effectiveZoom} bounds={bounds} />

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
          <SmoothDriverMarker position={driverLocation} heading={driverLocation.heading} />
        )}

        {pickup && dropoff && routeGeometry && routeGeometry.length > 2 && (
          <Polyline
            positions={routeGeometry}
            pathOptions={{ color: '#3B82F6', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
          />
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

        {/* Nearby Drivers - Clustered */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
        >
          {nearbyDrivers.map((driver) => (
            <Marker
              key={driver.id}
              position={[driver.latitude, driver.longitude]}
              icon={driverIcon}
              rotationAngle={driver.heading || 0}
              rotationOrigin="center center"
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-md px-4 py-2 rounded-full border border-border shadow-lg pointer-events-none z-[400]">
        <p className="text-xs text-foreground">Tap anywhere to select location</p>
      </div>
    </div>
  );
};

export default RideMap;
