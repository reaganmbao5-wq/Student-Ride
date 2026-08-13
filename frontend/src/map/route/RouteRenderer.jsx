import React, { useEffect, useRef } from 'react';

/**
 * Universal Coordinate Normalizer for Mapbox (GeoJSON requires [lng, lat])
 */
const normalizePointToLngLat = (pt) => {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
  } else if (typeof pt === 'object') {
    const lat = Number(pt.lat ?? pt.latitude);
    const lng = Number(pt.lng ?? pt.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
  }
  return null;
};

export const RouteRenderer = ({ id = 'default', map, remainingPath = [], status, color, onAnimationChange }) => {
  const normalizedStatus = status ? String(status).toLowerCase() : '';
  const isHeadingToPickup = ['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived'].includes(normalizedStatus);
  const strokeColor = color || (isHeadingToPickup ? '#10B981' : '#3B82F6');
  const strokeColorRef = useRef(strokeColor);

  const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const sourceId = `mulu-route-src-${cleanId}`;
  const layerId = `mulu-route-ln-${cleanId}`;

  // Keep stroke color ref in sync
  useEffect(() => {
    strokeColorRef.current = strokeColor;
    if (!map || !map.style) return;
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', strokeColor);
      }
    } catch (err) {}
  }, [map, strokeColor, layerId]);

  // 1. Source and layer lifecycle: Add ONCE when map is ready, remove ONLY on component unmount
  useEffect(() => {
    if (!map) return;

    const initLayer = () => {
      if (!map.style) return;
      try {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [] }
            }
          });
        }
        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': strokeColorRef.current || '#3B82F6',
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      } catch (err) {
        console.warn('Error initializing route layer:', err);
      }
    };

    const handleStyleLoad = () => {
      initLayer();
    };

    map.on('style.load', handleStyleLoad);
    if (map.style) {
      initLayer();
    }

    return () => {
      map.off('style.load', handleStyleLoad);
      try {
        if (map && map.style) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      } catch (err) {}
    };
  }, [map, sourceId, layerId]);

  // 2. Pure data updates via setData() - ZERO layer removals, ZERO flicker!
  useEffect(() => {
    if (!map || !map.style) return;

    const formattedCoords = (remainingPath || []).map(normalizePointToLngLat).filter(Boolean);
    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: formattedCoords.length >= 2 ? formattedCoords : []
      }
    };

    try {
      const src = map.getSource(sourceId);
      if (src) {
        src.setData(geojson);
      } else if (map.style) {
        // Fallback: If source not yet initialized, add it
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });
        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': strokeColorRef.current || '#3B82F6',
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      }
    } catch (e) {}
  }, [map, remainingPath, sourceId, layerId]);

  return null;
};

export default RouteRenderer;
