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

export const RouteRenderer = ({ 
  id = 'default', 
  map, 
  segments = [], 
  remainingPath = [], 
  status, 
  color, 
  onAnimationChange 
}) => {
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
  }, [strokeColor]);

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
              type: 'FeatureCollection',
              features: []
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
              // Data-driven line color expression from feature properties
              'line-color': ['coalesce', ['get', 'color'], strokeColorRef.current || '#3B82F6'],
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      } catch (err) {
        console.warn('Error initializing unified route layer:', err);
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

  // 2. Progressive Animated Drawing & Live Coordinate Updates via FeatureCollection
  useEffect(() => {
    if (!map || !map.style) return;

    // Convert input data to FeatureCollection
    let features = [];
    if (segments && segments.length > 0) {
      features = segments.map((seg, idx) => {
        const rawCoords = seg.geometry || [];
        const formattedCoords = rawCoords.map(normalizePointToLngLat).filter(Boolean);
        if (formattedCoords.length < 2) return null;
        return {
          type: 'Feature',
          id: seg.rideId || seg.stopId || `seg-${idx}`,
          properties: {
            color: seg.color || strokeColorRef.current || '#3B82F6',
            isNextLeg: seg.isNextLeg || (idx === 0)
          },
          geometry: {
            type: 'LineString',
            coordinates: formattedCoords
          }
        };
      }).filter(Boolean);
    } else if (remainingPath && remainingPath.length >= 2) {
      const formattedCoords = (remainingPath || []).map(normalizePointToLngLat).filter(Boolean);
      if (formattedCoords.length >= 2) {
        features = [{
          type: 'Feature',
          id: `${cleanId}-main`,
          properties: {
            color: strokeColorRef.current || '#3B82F6',
            isNextLeg: true
          },
          geometry: {
            type: 'LineString',
            coordinates: formattedCoords
          }
        }];
      }
    }

    const src = map.getSource(sourceId);

    if (features.length === 0) {
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      animatedSignatureRef.current = '';
      if (onAnimationChange) onAnimationChange(false);
      return;
    }

    // Build signature from the final waypoint coordinate of all features
    const lastFeature = features[features.length - 1];
    const lastCoords = lastFeature.geometry.coordinates;
    const lastPt = lastCoords[lastCoords.length - 1];
    const destinationSignature = `${features.length}-${cleanId}-${lastPt[0].toFixed(4)},${lastPt[1].toFixed(4)}`;

    const isActiveTripState = [
      'accepted', 'driver_accepted', 'driver_en_route_to_pickup', 
      'driver_arrived', 'passenger_boarding', 'ride_started', 
      'ongoing', 'ride_in_progress', 'arriving_destination'
    ].includes(normalizedStatus);

    // If already animated or during active trip GPS progression:
    // Update coordinates directly into WebGL buffer in <1ms
    if (animatedSignatureRef.current === destinationSignature || (isActiveTripState && animatedSignatureRef.current)) {
      animatedSignatureRef.current = destinationSignature;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features
        });
      }
      return;
    }

    // New destination or route detected
    animatedSignatureRef.current = destinationSignature;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);

    // Active trips render line immediately with zero replay delay
    if (isActiveTripState) {
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features
        });
      }
      if (onAnimationChange) onAnimationChange(false);
      return;
    }

    // Initial empty start for preview animations (Confirm Ride / Finding Driver)
    const firstFeatureCoords = features[0]?.geometry?.coordinates || [];
    if (src && firstFeatureCoords.length >= 2) {
      src.setData({
        type: 'FeatureCollection',
        features: [{
          ...features[0],
          geometry: {
            type: 'LineString',
            coordinates: [firstFeatureCoords[0], firstFeatureCoords[0]]
          }
        }]
      });
    }

    if (onAnimationChange) onAnimationChange(true);

    const isRequestedState = normalizedStatus === 'requested';
    const totalDuration = isRequestedState ? 5000 : 2200;
    const startDelay = isRequestedState ? 500 : 350;

    animationTimeoutRef.current = setTimeout(() => {
      const startTime = performance.now();
      const firstCoords = features[0]?.geometry?.coordinates || [];
      const totalPoints = firstCoords.length;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / totalDuration);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const pointCount = Math.max(2, Math.min(totalPoints, Math.ceil(easeProgress * totalPoints)));
        const currentSlice = firstCoords.slice(0, pointCount);

        const activeSrc = map.getSource(sourceId);
        if (activeSrc) {
          activeSrc.setData({
            type: 'FeatureCollection',
            features: [
              {
                ...features[0],
                geometry: {
                  type: 'LineString',
                  coordinates: currentSlice
                }
              },
              ...features.slice(1)
            ]
          });
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          if (activeSrc) {
            activeSrc.setData({
              type: 'FeatureCollection',
              features
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
  }, [map, segments, remainingPath, normalizedStatus, sourceId, cleanId, onAnimationChange]);

  return null;
};

export default RouteRenderer;
