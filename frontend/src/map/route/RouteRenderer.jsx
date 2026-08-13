import React, { useEffect, useRef } from 'react';

export const RouteRenderer = ({ map, remainingPath = [], status, color }) => {
  const normalizedStatus = status ? String(status).toLowerCase() : '';
  const isHeadingToPickup = ['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived'].includes(normalizedStatus);
  const strokeColor = color || (isHeadingToPickup ? '#10B981' : '#3B82F6');
  const strokeColorRef = useRef(strokeColor);

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);

  // Secondary effect to dynamically switch line colors on existing layers
  useEffect(() => {
    if (!map || !map.style) return;
    const layerId = 'mulu-route-line';
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', strokeColor);
      }
    } catch (err) {
      console.warn('Error updating route line stroke color:', err);
    }
  }, [map, strokeColor]);

  // Main lifecycle: register style.load listener and handle drawing
  useEffect(() => {
    if (!map || !remainingPath || remainingPath.length <= 2) return;

    const sourceId = 'mulu-route-source';
    const layerId = 'mulu-route-line';

    // Format coordinates from remainingPath
    const formattedCoords = remainingPath.map(pt => [pt.lng, pt.lat]);

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
              'line-opacity': 0.9
            }
          });
        }
      } catch (err) {
        console.warn('Error drawing Route Line:', err);
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
  }, [map, remainingPath]);

  return null;
};

export default RouteRenderer;
