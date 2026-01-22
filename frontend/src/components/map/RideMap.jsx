import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color) => new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const pickupIcon = createIcon('#D4AF37'); // Gold
const dropoffIcon = createIcon('#10B981'); // Green
const driverIcon = new L.DivIcon({
  className: 'driver-marker',
  html: `<div style="
    width: 40px;
    height: 40px;
    background: #D4AF37;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(212,175,55,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const userIcon = new L.DivIcon({
  className: 'user-marker',
  html: `<div style="
    width: 16px;
    height: 16px;
    background: #3B82F6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 8px rgba(59,130,246,0.2);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Component to recenter map
const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
};

// Component to fit bounds
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

export const RideMap = ({
  center = [-14.4087, 28.2849], // Kabwe, Zambia coordinates
  zoom = 14,
  pickup = null,
  dropoff = null,
  driverLocation = null,
  userLocation = null,
  onMapClick = null,
  showRoute = false,
  interactive = true,
  className = ""
}) => {
  const mapRef = useRef(null);

  // Calculate bounds if we have multiple points
  const bounds = [];
  if (pickup) bounds.push([pickup.lat, pickup.lng]);
  if (dropoff) bounds.push([dropoff.lat, dropoff.lng]);
  if (driverLocation) bounds.push([driverLocation.lat, driverLocation.lng]);

  // Simple route line between points
  const routePositions = [];
  if (pickup) routePositions.push([pickup.lat, pickup.lng]);
  if (dropoff) routePositions.push([dropoff.lat, dropoff.lng]);

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} data-testid="ride-map">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {bounds.length >= 2 && <FitBounds bounds={bounds} />}

        {/* User location */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Pickup marker */}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-black font-medium">Pickup</div>
              <div className="text-gray-600 text-sm">{pickup.address || 'Selected location'}</div>
            </Popup>
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-black font-medium">Dropoff</div>
              <div className="text-gray-600 text-sm">{dropoff.address || 'Selected location'}</div>
            </Popup>
          </Marker>
        )}

        {/* Driver marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
            <Popup>Driver</Popup>
          </Marker>
        )}

        {/* Route line */}
        {showRoute && routePositions.length >= 2 && (
          <Polyline
            positions={routePositions}
            color="#D4AF37"
            weight={4}
            opacity={0.8}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  );
};

export const LocationPickerMap = ({
  center = [-14.4087, 28.2849],
  zoom = 15,
  selectedLocation = null,
  onLocationSelect,
  className = ""
}) => {
  const MapClickHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      map.on('click', (e) => {
        if (onLocationSelect) {
          onLocationSelect({
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
        }
      });
      
      return () => {
        map.off('click');
      };
    }, [map]);
    
    return null;
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} data-testid="location-picker-map">
      <MapContainer
        center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler />
        
        {selectedLocation && (
          <>
            <RecenterMap position={[selectedLocation.lat, selectedLocation.lng]} />
            <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pickupIcon}>
              <Popup>Selected location</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
      
      {/* Crosshair overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 border-2 border-gold rounded-full opacity-50" />
        <div className="absolute w-1 h-1 bg-gold rounded-full" />
      </div>
    </div>
  );
};

export default RideMap;
