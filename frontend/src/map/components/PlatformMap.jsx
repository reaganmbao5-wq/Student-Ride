import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-rotatedmarker';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import VehicleEngine from '../vehicle/VehicleEngine';
import CameraEngine from '../camera/CameraEngine';
import { CAMERA_MODES } from '../camera/CameraConfig';
import { RouteEngine } from '../route/RouteEngine';

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

export const pickupIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="position:relative; display:flex; flex-direction:column; align-items:center;">
           <div style="width:40px; height:40px; border-radius:50%; background-color:black; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.2);">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
           </div>
           <div style="width:4px; height:16px; background-color:black;"></div>
           <div style="width:12px; height:6px; background-color:rgba(0,0,0,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
         </div>`,
  iconSize: [40, 60],
  iconAnchor: [20, 58],
  popupAnchor: [0, -60]
});

export const dropoffIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="position:relative; display:flex; flex-direction:column; align-items:center;">
           <div style="width:40px; height:40px; border-radius:50%; background-color:#dc2626; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.2);">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
           </div>
           <div style="width:4px; height:16px; background-color:#dc2626;"></div>
           <div style="width:12px; height:6px; background-color:rgba(0,0,0,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
         </div>`,
  iconSize: [40, 60],
  iconAnchor: [20, 58],
  popupAnchor: [0, -60]
});



// ─── Tile layer definitions ─────────────────────────────────────────
const TILES = {
  // Google Maps Standard — full Google Maps look for light mode
  light: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
  },
  // CartoDB Dark Matter — excellent dark map style for dark mode
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    subdomains: 'abcd',
    attribution: '© CartoDB',
  },
  // Google Maps Hybrid — full-colour satellite + labels globally
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
  },
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
  routes = [],
  routeGeometry = null,
  showRouteLine = false,
  interactive = true,
  className = '',
  // Phase 3.2.2 Camera Engine Props
  cameraMode = CAMERA_MODES.FREE,
  driverLocation = null,
  routeBounds = null,
  selectionLocation = null,
  rideStatus = null,
  onRouteAnimationChange = null,
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

  const MapEvents = () => {
    useMapEvents({
      dragstart: () => {
        if (onDragStart) onDragStart();
      },
      dragend: (e) => {
        if (onDragEnd) onDragEnd();
        const c = e.target.getCenter();
        if (onCenterChanged) {
          onCenterChanged({ lat: c.lat, lng: c.lng });
        }
      }
    });
    return null;
  };

  return (
    <div className={`relative z-0 w-full h-full ${className}`} style={{ isolation: 'isolate' }}>


      {/* ─── LEAFLET MAP ─── */}
      <MapContainer
        center={center ? [center.lat, center.lng] : [-14.42, 28.45]}
        zoom={zoom}
        maxZoom={20}
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

        {/* Phase 3.2.2 Camera Engine */}
        <CameraEngine 
          mode={cameraMode}
          driverLocation={driverLocation}
          routeBounds={routeBounds || bounds}
          selectionLocation={selectionLocation || center}
        />

        <MapEvents />

        {/* Static pickup/dropoff markers */}
        {markers.map((m, idx) => (
          <Marker key={m.key || idx} position={[m.lat, m.lng]} icon={getIcon(m.iconType)}>
            {m.pIndex && (
              <Tooltip permanent direction="top" offset={[0, -30]} className="passenger-badge">
                <div style={{ color: m.color, fontWeight: 'bold', fontSize: '14px' }}>{m.pIndex}</div>
              </Tooltip>
            )}
          </Marker>
        ))}

        {/* Nearby driver markers handled by the new Vehicle Engine */}
        {drivers.length > 0 && (
          <VehicleEngine drivers={drivers} />
        )}

        {/* Route Engine Phase 3.2.3 */}
        {routes && routes.length > 0 ? (
          routes.map((route, idx) => (
             <RouteEngine 
               key={`route-${route.rideId || idx}`}
               geometry={route.geometry}
               color={route.color}
               driverLocation={driverLocation}
               status={route.status || rideStatus}
               onAnimationChange={onRouteAnimationChange}
             />
          ))
        ) : (
          routeGeometry && routeGeometry.length > 0 && (
            <RouteEngine 
              geometry={routeGeometry}
              driverLocation={driverLocation}
              status={rideStatus}
              onAnimationChange={onRouteAnimationChange}
            />
          )
        )}

      </MapContainer>
    </div>
  );
};

export default PlatformMap;
