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

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);

  // Secondary effect to dynamically switch line colors on existing layers
  useEffect(() => {
    if (!map || !map.style) return;
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', strokeColor);
      }
    } catch (err) {
      console.warn('Error updating route line stroke color:', err);
    }
  }, [map, strokeColor, layerId]);

  // Main lifecycle: register style.load listener and handle drawing
  useEffect(() => {
    if (!map || !remainingPath || remainingPath.length <= 1) {
      try {
        if (map && map.style) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      } catch (e) {}
      return;
    }

    // Format coordinates from remainingPath (handles [lat, lng] arrays and {lat, lng} objects)
    const formattedCoords = remainingPath.map(normalizePointToLngLat).filter(Boolean);

    if (formattedCoords.length < 2) return;

    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: formattedCoords
      }
    };

    let isCleanedUp = false;

    const drawRoute = () => {
      if (isCleanedUp) return;
      if (!map || !map.style) return;

      try {
        if (map.getSource(sourceId)) {
          map.getSource(sourceId).setData(geojson);
        } else {
          map.addSource(sourceId, {
            type: 'geojson',
            data: geojson
          });

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': strokeColorRef.current,
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      } catch (err) {
        console.warn('Error drawing Route Line on Mapbox:', err);
      }
    };

    const handleStyleLoad = () => {
      if (isCleanedUp) return;
      drawRoute();
    };

    map.on('style.load', handleStyleLoad);

    if (map.style) {
      drawRoute();
    }

    return () => {
      isCleanedUp = true;
      map.off('style.load', handleStyleLoad);
      try {
        if (map && map.style) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      } catch (err) {
        console.warn('Error cleaning up Route Line:', err);
      }
    };
  }, [map, remainingPath, sourceId, layerId]);

  return null;
};

export default RouteRenderer;
