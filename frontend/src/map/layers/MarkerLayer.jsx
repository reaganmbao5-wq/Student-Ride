import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

/**
 * Creates custom HTML DOM element for static map markers (pickup, dropoff, user, passenger badges)
 * Matches exact design specs from original Leaflet implementation (no white border rings).
 */
const createMarkerElement = (marker) => {
  const container = document.createElement('div');
  container.className = 'mapbox-custom-marker-wrapper';
  container.style.pointerEvents = 'auto';
  container.style.cursor = 'pointer';

  const iconType = marker.iconType || 'pickup';
  const color = marker.color || (iconType === 'dropoff' ? '#dc2626' : '#000000');

  if (iconType === 'pickup' || iconType === 'passenger_pickup') {
    container.innerHTML = `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        ${marker.pIndex ? `<div style="background:${color}; color:white; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:12px; margin-bottom:2px; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-family:sans-serif;">P${marker.pIndex}</div>` : ''}
        <div style="width:40px; height:40px; border-radius:50%; background-color:#000000; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div style="width:4px; height:16px; background-color:#000000;"></div>
        <div style="width:12px; height:6px; background-color:rgba(0,0,0,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
      </div>
    `;
  } else if (iconType === 'dropoff' || iconType === 'passenger_dropoff') {
    container.innerHTML = `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        ${marker.pIndex ? `<div style="background:${color}; color:white; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:12px; margin-bottom:2px; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-family:sans-serif;">D${marker.pIndex}</div>` : ''}
        <div style="width:40px; height:40px; border-radius:50%; background-color:#dc2626; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
        </div>
        <div style="width:4px; height:16px; background-color:#dc2626;"></div>
        <div style="width:12px; height:6px; background-color:rgba(0,0,0,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
      </div>
    `;
  } else if (iconType === 'user') {
    container.innerHTML = `
      <div style="position:relative; display:flex; align-items:center; justify-content:center;">
        <div style="width:16px; height:16px; background-color:#3b82f6; border:3px solid white; border-radius:50%; box-shadow:0 0 0 8px rgba(59,130,246,0.2);"></div>
      </div>
    `;
  } else {
    // Fallback marker
    container.innerHTML = `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="width:36px; height:36px; border-radius:50%; background-color:${color}; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 8px 16px -2px rgba(0,0,0,0.3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div style="width:4px; height:12px; background-color:${color};"></div>
      </div>
    `;
  }

  return container;
};

export const MarkerLayer = ({ map, markers = [] }) => {
  const activeMarkersRef = useRef([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    activeMarkersRef.current.forEach(m => m.remove());
    activeMarkersRef.current = [];

    // Add new markers
    markers.forEach(m => {
      const lat = m.lat ?? m.latitude ?? (Array.isArray(m.position) ? m.position[0] : null);
      const lng = m.lng ?? m.longitude ?? (Array.isArray(m.position) ? m.position[1] : null);

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;

      const el = createMarkerElement(m);
      const mapboxMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([lng, lat])
        .addTo(map);

      activeMarkersRef.current.push(mapboxMarker);
    });

    return () => {
      activeMarkersRef.current.forEach(m => m.remove());
      activeMarkersRef.current = [];
    };
  }, [map, markers]);

  return null;
};

export default MarkerLayer;
