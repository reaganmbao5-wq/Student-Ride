import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-rotatedmarker';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';

// Standardize default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const createCustomIcon = (color, svgPath) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2">${svgPath}</svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -30],
  });

export const userIcon = L.divIcon({
  className: 'marker-user',
  html: `<div style="width:16px;height:16px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(59,130,246,.2)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const pickupIcon = createCustomIcon(
  '#D4AF37',
  '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>'
);

export const dropoffIcon = createCustomIcon(
  '#10B981',
  '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>'
);

export const driverIcon = L.divIcon({
  className: 'custom-car-marker',
  html: `<div style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.4))">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1" transform="rotate(-90)">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// ─── Tile layer definitions ─────────────────────────────────────────
const TILES = {
  // Google Maps Standard — full Google Maps look for light mode
  light: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
  },
  // CartoDB Dark Matter — excellent dark map style for dark mode
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '© CartoDB',
  },
  // Google Maps Hybrid — full-colour satellite + labels globally
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
  },
};

// ─── Map controller ─────────────────────────────────────────────────
const MapController = ({ center, zoom, bounds, onCenterChanged, onDragStart, onDragEnd }) => {
  const map = useMap();
  const dragging = useRef(false);

  useEffect(() => {
    if (dragging.current) return;
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: zoom || 16 });
    } else if (center) {
      map.flyTo(center, zoom || 13);
    }
  }, [center, zoom, bounds, map]);

  useMapEvents({
    dragstart: () => {
      dragging.current = true;
      onDragStart?.();
    },
    dragend: () => {
      dragging.current = false;
      onDragEnd?.();
    },
    move: (e) => {
      if (onCenterChanged && dragging.current) {
        const c = e.target.getCenter();
        onCenterChanged({ lat: c.lat, lng: c.lng });
      }
    },
    moveend: (e) => {
      dragging.current = false;
      if (onCenterChanged) {
        const c = e.target.getCenter();
        onCenterChanged({ lat: c.lat, lng: c.lng });
      }
      onDragEnd?.();
    },
  });

  return null;
};

// ─── Map mode button ─────────────────────────────────────────────────
const MapBtn = ({ active, onClick, icon, label, accentColor }) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      background: active ? accentColor : 'rgba(255,255,255,0.95)',
      border: active ? `2px solid ${accentColor}` : '2px solid transparent',
      borderRadius: '12px',
      padding: '8px 12px',
      boxShadow: active
        ? `0 4px 14px ${accentColor}55`
        : '0 2px 10px rgba(0,0,0,0.18)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      fontSize: '12px',
      fontWeight: 700,
      color: active ? 'white' : '#1a1a1a',
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.18s ease',
      letterSpacing: '0.01em',
    }}
  >
    {icon}
    {label}
  </button>
);

// ─── Main PlatformMap component ─────────────────────────────────────
/**
 * PlatformMap Abstraction Layer
 * Uses react-leaflet. Native @capacitor/google-maps will replace this once an Android API key is provided.
 */
export const PlatformMap = ({
  center,
  zoom = 15,
  bounds = null,
  onCenterChanged,
  onDragStart,
  onDragEnd,
  markers = [],
  drivers = [],
  routeGeometry = null,
  showRouteLine = false,
  interactive = true,
  className = '',
}) => {
  const { theme } = useTheme();

  // Always use standard Google Maps (light mode) tiles per user request
  const tileUrl = TILES.light.url;
  const tileSubdomains = TILES.light.subdomains;
  const tileAttribution = TILES.light.attribution;

  const getIcon = (type) => {
    switch (type) {
      case 'pickup':  return pickupIcon;
      case 'dropoff': return dropoffIcon;
      case 'user':    return userIcon;
      default:        return pickupIcon;
    }
  };

  return (
    <div className={`relative z-0 w-full h-full ${className}`} style={{ isolation: 'isolate' }}>


      {/* ─── LEAFLET MAP ─── */}
      <MapContainer
        center={center ? [center.lat, center.lng] : [-14.42, 28.45]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        scrollWheelZoom={interactive}
        attributionControl={false}
      >
        {/*
          `key` forces TileLayer to fully remount when the URL changes.
          Without this, Leaflet keeps the old tiles and doesn't swap the layer.
        */}
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          subdomains={tileSubdomains}
          attribution={tileAttribution}
          maxZoom={20}
        />

        <MapController
          center={center}
          zoom={zoom}
          bounds={bounds}
          onCenterChanged={onCenterChanged}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        {/* Static pickup/dropoff markers */}
        {markers.map((m, idx) => (
          <Marker key={m.key || idx} position={[m.lat, m.lng]} icon={getIcon(m.iconType)} />
        ))}

        {/* Nearby driver markers (clustered) */}
        {drivers.length > 0 && (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
            {drivers.map((d) => (
              <Marker
                key={d.id}
                position={[d.latitude, d.longitude]}
                icon={driverIcon}
                rotationAngle={d.heading || 0}
                rotationOrigin="center center"
              />
            ))}
          </MarkerClusterGroup>
        )}

        {/* OSRM road-following route — blue */}
        {routeGeometry && routeGeometry.length > 0 && (
          <Polyline
            positions={routeGeometry}
            pathOptions={{ color: '#3B82F6', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        )}

        {/* Fallback straight dashed line (only when no OSRM geometry came back) */}
        {showRouteLine && (!routeGeometry || routeGeometry.length === 0) && markers.length >= 2 && (
          <Polyline
            positions={[[markers[0].lat, markers[0].lng], [markers[1].lat, markers[1].lng]]}
            pathOptions={{ color: '#D4AF37', weight: 4, opacity: 0.8, dashArray: '10 10' }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default PlatformMap;
