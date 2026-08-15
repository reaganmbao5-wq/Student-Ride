import React, { useEffect, useRef } from 'react';

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

export const RouteRenderer = ({ id = 'default', map, remainingPath = [], status, color, onAnimationChange }) => {
  const normalizedStatus = status ? String(status).toLowerCase() : '';
  const isHeadingToPickup = ['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived'].includes(normalizedStatus);
  const strokeColor = color || (isHeadingToPickup ? '#10B981' : '#3B82F6');
  const strokeColorRef = useRef(strokeColor);

  const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const sourceId = `mulu-route-src-${cleanId}`;
  const layerId = `mulu-route-ln-${cleanId}`;

  const animatedSignatureRef = useRef('');
  const animationFrameRef = useRef(null);
  const animationTimeoutRef = useRef(null);

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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      try {
        if (map && map.style) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      } catch (err) {}
    };
  }, [map, sourceId, layerId]);

  // 2. Progressive Animated Drawing & Live Coordinate Updates
  useEffect(() => {
    if (!map || !map.style) return;

    const formattedCoords = (remainingPath || []).map(normalizePointToLngLat).filter(Boolean);
    const src = map.getSource(sourceId);

    if (formattedCoords.length < 2) {
      if (src) {
        src.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] }
        });
      }
      animatedSignatureRef.current = '';
      if (onAnimationChange) onAnimationChange(false);
      return;
    }

    const firstPt = formattedCoords[0];
    const lastPt = formattedCoords[formattedCoords.length - 1];
    const destinationSignature = `${firstPt[0].toFixed(5)},${firstPt[1].toFixed(5)}->${lastPt[0].toFixed(5)},${lastPt[1].toFixed(5)}-${normalizedStatus}`;

    // If this route has already animated its entry, update coordinates directly (real-time driver progress with zero flicker)
    if (animatedSignatureRef.current === destinationSignature) {
      if (src) {
        src.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: formattedCoords }
        });
      }
      return;
    }

    // New destination or route detected! Run the dramatic progressive draw animation
    animatedSignatureRef.current = destinationSignature;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);

    // Initial empty start
    if (src) {
      src.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [formattedCoords[0], formattedCoords[0]] }
      });
    }

    if (onAnimationChange) onAnimationChange(true);

    // Duration: 5.0s for requested (finding driver), 2.2s for confirm ride, 1.8s for default
    const isRequestedState = normalizedStatus === 'requested';
    const totalDuration = isRequestedState ? 5000 : 2200;
    const startDelay = isRequestedState ? 500 : 350;

    animationTimeoutRef.current = setTimeout(() => {
      const startTime = performance.now();
      const totalPoints = formattedCoords.length;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / totalDuration);
        
        // Easing: easeOutCubic (1 - Math.pow(1 - progress, 3))
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const pointCount = Math.max(2, Math.min(totalPoints, Math.ceil(easeProgress * totalPoints)));
        const currentSlice = formattedCoords.slice(0, pointCount);

        const activeSrc = map.getSource(sourceId);
        if (activeSrc) {
          activeSrc.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: currentSlice }
          });
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          if (activeSrc) {
            activeSrc.setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: formattedCoords }
            });
          }
          if (onAnimationChange) onAnimationChange(false);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, startDelay);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, [map, remainingPath, normalizedStatus, sourceId, onAnimationChange]);

  return null;
};

export default RouteRenderer;
