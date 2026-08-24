import React, { useEffect } from 'react';

const SOURCE_ID = 'mulu-unified-route-source';
const LAYER_ID = 'mulu-unified-route-layer';

/**
 * Universal Coordinate Normalizer for Mapbox (GeoJSON requires [lng, lat])
 */
const normalizePointToLngLat = (pt) => {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const val0 = Number(pt[0]);
    const val1 = Number(pt[1]);
    if (val0 < 0 && val1 > 0) {
      // [lat, lng] format (Zambia latitude is negative, longitude is positive)
      return [val1, val0]; // convert to [lng, lat]
    } else if (val0 > 0 && val1 < 0) {
      // Already [lng, lat]
      return [val0, val1];
    }
    return [val1, val0];
  } else if (typeof pt === 'object') {
    const lat = Number(pt.lat ?? pt.latitude);
    const lng = Number(pt.lng ?? pt.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
  }
  return null;
};

export const RouteRenderer = ({ map, segments = [] }) => {
  // 1. Initialize Source and Layer ONCE on map style load
  useEffect(() => {
    if (!map) return;

    const initLayer = () => {
      if (!map.style) return;

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            // Data-driven line color
            'line-color': ['coalesce', ['get', 'color'], '#3B82F6'],
            'line-width': 6,
            'line-opacity': 0.95
          }
        });
      }
    };

    map.on('style.load', initLayer);
    if (map.style) initLayer();

    return () => {
      map.off('style.load', initLayer);
      try {
        if (map && map.style) {
          if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
          if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        }
      } catch (e) {}
    };
  }, [map]);

  // 2. Stream dynamic GeoJSON FeatureCollection directly into WebGL buffer via setData()
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_ID)) return;

    const featureCollection = {
      type: 'FeatureCollection',
      features: (segments || []).map((seg, idx) => {
        const rawCoords = seg.geometry || [];
        const formattedCoords = rawCoords.map(normalizePointToLngLat).filter(Boolean);
        if (formattedCoords.length < 2) return null;

        return {
          type: 'Feature',
          id: seg.rideId || seg.stopId || `seg-${idx}`,
          properties: {
            color: seg.color || '#3B82F6',
            isNextLeg: seg.isNextLeg ?? (idx === 0)
          },
          geometry: {
            type: 'LineString',
            coordinates: formattedCoords
          }
        };
      }).filter(Boolean)
    };

    map.getSource(SOURCE_ID).setData(featureCollection);
  }, [map, segments]);

  return null;
};

export default RouteRenderer;

