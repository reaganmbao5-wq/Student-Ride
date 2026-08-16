import React, { useEffect, useState, useRef, useMemo } from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import '../styles/map.css';

import { POILayer } from '../layers/POILayer';

import { getAutoMapStyle, isNightTheme } from '../styles/MapboxStyles';

import VehicleEngine from '../vehicle/VehicleEngine';

import { CAMERA_MODES, CAMERA_CONFIG } from '../camera/CameraConfig';

import { RouteEngine } from '../route/RouteEngine';

import { MarkerLayer } from '../layers/MarkerLayer';

import { Sun, Moon, Clock } from 'lucide-react';



// Configure Mapbox Access Token

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A';



if (typeof window !== 'undefined') {

  try {

    const workerScript = "importScripts('https://api.mapbox.com/mapbox-gl-js/v3.28.1/mapbox-gl-csp-worker.js');";

    const blob = new Blob([workerScript], { type: 'application/javascript' });

    const blobUrl = URL.createObjectURL(blob);



    class ClassicMapboxWorker extends window.Worker {

      constructor(url, options) {

        super(blobUrl, { ...options, type: 'classic' });

      }

    }

    mapboxgl.workerClass = ClassicMapboxWorker;

  } catch (err) {

    console.warn('Mapbox ClassicMapboxWorker init error:', err);

  }

}



export const PlatformMap = ({

  center = { lat: -14.294896, lng: 28.559798 }, // Default Mulungushi University

  zoom = 15,

  bounds = null,

  onCenterChanged,

  onDragStart,

  onDragEnd,

  markers = [],

  drivers = [],

  routes = [],

  routeGeometry = null,

  interactive = true,

  className = '',

  cameraMode = CAMERA_MODES.FREE,

  driverLocation = null,

  routeBounds = null,

  selectionLocation = null,

  bottomPadding = null,

  rideStatus = null,

  onRouteAnimationChange = null,

  isDriverView = false,

}) => {

  const mapContainerRef = useRef(null);

  const mapRef = useRef(null);

  const targetCenterRef = useRef(center);

  const currentStyleRef = useRef('');

  const isUserInteractingRef = useRef(false);

  const isUserDraggingRef = useRef(false);
  const hasManuallyInteractedRef = useRef(false);
  const lastFittedBoundsRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  // Map Appearance Mode: 'auto' (default), 'light', 'dark'
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('map_theme_mode') || 'auto');

  useEffect(() => {
    const handleThemeEvent = (e) => {
      if (e?.detail) {
        setThemeMode(e.detail);
      } else {
        setThemeMode(localStorage.getItem('map_theme_mode') || 'auto');
      }
    };
    window.addEventListener('map-theme-change', handleThemeEvent);
    window.addEventListener('storage', handleThemeEvent);
    return () => {
      window.removeEventListener('map-theme-change', handleThemeEvent);
      window.removeEventListener('storage', handleThemeEvent);
    };
  }, []);

  useEffect(() => {
    hasManuallyInteractedRef.current = false;
    lastFittedBoundsRef.current = null;
  }, [cameraMode]);



  // Stable Style Calculation

  const activeStyle = useMemo(() => {

    return getAutoMapStyle(themeMode === 'auto' ? null : themeMode);

  }, [themeMode]);



  const isNight = useMemo(() => {

    return isNightTheme(themeMode === 'auto' ? null : themeMode);

  }, [themeMode]);



  // Initialize Mapbox Map once

  useEffect(() => {

    if (!mapContainerRef.current) return;



    const initialCenter = (bounds && bounds.length >= 2)
      ? [(bounds[0][1] + bounds[1][1]) / 2, (bounds[0][0] + bounds[1][0]) / 2]
      : (center ? [center.lng, center.lat] : [28.559798, -14.294896]);

    currentStyleRef.current = activeStyle;



    const map = new mapboxgl.Map({

      container: mapContainerRef.current,

      style: activeStyle,

      center: initialCenter,

      zoom: zoom,

      pitch: 0,

      bearing: 0,

      interactive: interactive,

      attributionControl: false,

      pixelRatio: window.devicePixelRatio || 1

    });



    map.on('load', () => {

      setMapLoaded(true);

      map.resize();

    });



    map.on('dragstart', () => {

      isUserDraggingRef.current = true;

      isUserInteractingRef.current = true;
      hasManuallyInteractedRef.current = true;

      if (onDragStart) onDragStart();

    });



    map.on('zoomstart', () => {

      isUserInteractingRef.current = true;
      hasManuallyInteractedRef.current = true;

    });



    map.on('dragend', () => {

      if (onDragEnd) onDragEnd();

    });



    map.on('zoomend', () => {

      setTimeout(() => {

        isUserInteractingRef.current = false;

      }, 500);

    });



    // ONLY notify parent on moveend IF the user was manually dragging!

    // Preserves updated mapCenter while preventing circular flyTo loops (React Error #185)

    map.on('moveend', () => {

      if (isUserDraggingRef.current) {

        isUserDraggingRef.current = false;

        setTimeout(() => {

          isUserInteractingRef.current = false;

        }, 500);

        if (onCenterChanged) {

          const c = map.getCenter();

          onCenterChanged({ lat: c.lat, lng: c.lng });

        }

      }

    });



    // Re-anchor canvas size safely without forcing jumpTo stale center
    map.on('resize', () => {
      // Mapbox automatically resizes viewport without jumping camera
    });



    mapRef.current = map;

    window.map = map;



    const resizeObserver = new ResizeObserver(() => {

      if (mapRef.current) mapRef.current.resize();

    });

    resizeObserver.observe(mapContainerRef.current);



    return () => {

      resizeObserver.disconnect();

      map.remove();

      mapRef.current = null;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  // Handle Dynamic Theme Switching safely

  useEffect(() => {

    if (mapRef.current && mapLoaded && currentStyleRef.current !== activeStyle) {

      currentStyleRef.current = activeStyle;

      mapRef.current.setStyle(activeStyle);

      mapRef.current.once('style.load', () => {

        if (mapRef.current) mapRef.current.resize();

      });

    }

  }, [activeStyle, mapLoaded]);



  const lastFlownCenterRef = useRef(null);
  const prevCameraModeRef = useRef(cameraMode);

  // Clear fitted bounds when camera mode changes so mode transitions always animate smoothly
  useEffect(() => {
    if (prevCameraModeRef.current !== cameraMode) {
      prevCameraModeRef.current = cameraMode;
      lastFittedBoundsRef.current = null;
      lastFlownCenterRef.current = null;
      hasManuallyInteractedRef.current = false;
    }
  }, [cameraMode]);

  const markersRef = useRef(markers);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Handle Smooth Center / Bounds / Driver Follow with zero twitching
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    isUserInteractingRef.current = false;
    isUserDraggingRef.current = false;

    // 1. DRIVER FOLLOW MODE (Active in-progress trip)
    if (cameraMode === CAMERA_MODES.FOLLOW_DRIVER && driverLocation) {
      const lat = Number(driverLocation.lat ?? driverLocation.latitude);
      const lng = Number(driverLocation.lng ?? driverLocation.longitude);
      const heading = Number(driverLocation.heading || 0);

      if (!isNaN(lat) && !isNaN(lng)) {
        let isPannedAway = false;
        if (hasManuallyInteractedRef.current && typeof mapRef.current.getCenter === 'function') {
          const currentMapCenter = mapRef.current.getCenter();
          const distFromDriver = Math.hypot(currentMapCenter.lat - lat, currentMapCenter.lng - lng);
          if (distFromDriver > 0.0035) {
            isPannedAway = true;
          }
        }

        if (!isPannedAway) {
          let targetCoord = null;
          if (Array.isArray(markersRef.current) && markersRef.current.length > 0) {
            const activeTargetMarker = markersRef.current.find(m => m.iconType === 'dropoff' || m.iconType === 'pickup');
            if (activeTargetMarker && activeTargetMarker.lat && activeTargetMarker.lng) {
              targetCoord = {
                lat: Number(activeTargetMarker.lat),
                lng: Number(activeTargetMarker.lng)
              };
            }
          }

          // Student Zoom: 18.0 (scaling to 19.5 within 400m)
          // Driver Zoom: Student Zoom - 2 = 16.0 (scaling to 17.5 within 400m) for balanced Google Maps driving view
          let dynamicZoom = isDriverView ? 16.0 : 18.0;
          if (targetCoord && !isNaN(targetCoord.lat) && !isNaN(targetCoord.lng)) {
            const dLat = (targetCoord.lat - lat) * (Math.PI / 180);
            const dLon = (targetCoord.lng - lng) * (Math.PI / 180);
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat * (Math.PI / 180)) * Math.cos(targetCoord.lat * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const distMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            if (distMeters < 400) {
              if (isDriverView) {
                // Driver: Smoothly scale zoom from 16.0 at 400m up to 17.5 at 20m (Google Maps realistic driving view)
                dynamicZoom = Math.min(17.5, Math.max(16.0, 17.5 - Math.log2(Math.max(distMeters, 20) / 20) * 0.35));
              } else {
                // Student: Smoothly scale zoom from 17.8 at 400m up to 19.5 at 20m
                dynamicZoom = Math.min(19.5, Math.max(17.8, 19.5 - Math.log2(Math.max(distMeters, 20) / 20) * 0.39));
              }
            } else {
              dynamicZoom = isDriverView ? 16.0 : 18.0;
            }
          }

          const effBottom = (typeof bottomPadding === 'number' && bottomPadding > 0) ? Math.max(bottomPadding, 220) : 220;

          mapRef.current.easeTo({
            center: [lng, lat],
            offset: [0, -Math.round(effBottom * 0.35)], // Places vehicle comfortably in lower-third
            bearing: heading,
            pitch: 45, // 45 degree navigation perspective
            zoom: dynamicZoom,
            duration: 800,
            essential: true
          });
          return;
        }
      }
    }

    // 2. OVERVIEW / BOUNDS MODE (Confirm Ride / Finding a Driver / Shared Ride with Other Stops Ahead / Route Preview)
    const targetArray = routeBounds || bounds;
    const hasMultipleBounds = Array.isArray(targetArray) && targetArray.length >= 2;

    if (hasMultipleBounds) {
      const lats = [];
      const lngs = [];
      targetArray.forEach(pt => {
        if (Array.isArray(pt) && pt.length >= 2) {
          let lat, lng;
          const val0 = Number(pt[0]);
          const val1 = Number(pt[1]);
          if (val0 < 0 && val1 > 0) {
            // [lat, lng] format (Zambia latitude is negative, longitude is positive)
            lat = val0;
            lng = val1;
          } else if (val0 > 0 && val1 < 0) {
            // [lng, lat] GeoJSON standard format
            lng = val0;
            lat = val1;
          } else {
            lat = val0;
            lng = val1;
          }
          if (!isNaN(lat) && !isNaN(lng)) {
            lats.push(lat);
            lngs.push(lng);
          }
        } else if (pt && typeof pt === 'object') {
          const lat = Number(pt.lat ?? pt.latitude);
          const lng = Number(pt.lng ?? pt.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            lats.push(lat);
            lngs.push(lng);
          }
        }
      });

      if (lats.length >= 2 && lngs.length >= 2) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const containerRect = mapContainerRef.current?.getBoundingClientRect();
        const containerHeight = containerRect?.height || (typeof window !== 'undefined' ? window.innerHeight : 600);
        const containerWidth = containerRect?.width || (typeof window !== 'undefined' ? window.innerWidth : 400);
        const isMiniMap = !interactive || containerHeight < 250;

        // Top clearance for header and back button (110px on mobile to clear top status bar and back button)
        const calcTop = isMiniMap ? 14 : 110;
        // Dynamic bottom padding to place route safely above the bottom sheet card
        const calcBottom = isMiniMap ? 14 : ((typeof bottomPadding === 'number' && bottomPadding > 0)
          ? Math.min(bottomPadding + 25, Math.round(containerHeight * 0.48))
          : Math.max(220, Math.round(containerHeight * 0.38)));
        // Generous side margins so pins with labels/icons on far edges are NEVER clipped (15% width clearance)
        const calcSide = isMiniMap ? 14 : Math.max(55, Math.min(95, Math.round(containerWidth * 0.15)));

        // Skip re-fitting if coordinates haven't shifted significantly (eliminates jerking on landing/polling)
        const prev = lastFittedBoundsRef.current;
        const isInitialFit = !prev;
        const isSameBounds = prev &&
          Math.abs(prev.minLat - minLat) < 0.00025 &&
          Math.abs(prev.maxLat - maxLat) < 0.00025 &&
          Math.abs(prev.minLng - minLng) < 0.00025 &&
          Math.abs(prev.maxLng - maxLng) < 0.00025 &&
          Math.abs(prev.calcBottom - calcBottom) < 15 &&
          prev.calcTop === calcTop;

        if (isSameBounds) {
          return;
        }

        lastFittedBoundsRef.current = { minLat, maxLat, minLng, maxLng, calcTop, calcBottom };

        try {
          const targetCamera = mapRef.current.cameraForBounds([
            [minLng, minLat],
            [maxLng, maxLat]
          ], {
            padding: {
              top: calcTop,
              bottom: calcBottom,
              left: calcSide,
              right: calcSide
            }
          });

          if (targetCamera && typeof targetCamera.zoom === 'number') {
            // Compromise zoom out slightly (-0.45 zoom) as requested by user for comfortable framing on all distances
            const balancedZoom = Math.min(16.0, targetCamera.zoom - 0.45);
            mapRef.current.flyTo({
              center: targetCamera.center,
              zoom: balancedZoom,
              pitch: 0,
              bearing: 0,
              duration: isInitialFit ? 1800 : 800,
              essential: true
            });
            return;
          }
        } catch (e) {}

        // Fallback fitBounds if cameraForBounds throws or returns undefined
        try {
          mapRef.current.fitBounds([
            [minLng, minLat],
            [maxLng, maxLat]
          ], {
            padding: {
              top: calcTop + 25,
              bottom: calcBottom + 25,
              left: calcSide + 25,
              right: calcSide + 25
            },
            pitch: 0, // Flat 2D overview for multi-point framing
            bearing: 0,
            maxZoom: 15.8,
            duration: isInitialFit ? 1800 : 800,
            essential: true
          });
        } catch (e) {}
        return;
      }
    }

    if (center && center.lat !== undefined && center.lng !== undefined) {
      const defaultStepZoom = cameraMode === CAMERA_MODES.PICKUP_SELECTION
        ? (CAMERA_CONFIG.ZOOM.PICKUP_SELECTION || 18.5)
        : cameraMode === CAMERA_MODES.DESTINATION_SELECTION
        ? (CAMERA_CONFIG.ZOOM.DESTINATION_SELECTION || 17.0)
        : (typeof mapRef.current.getZoom === 'function' ? mapRef.current.getZoom() : zoom);

      const targetZoom = (hasManuallyInteractedRef.current && typeof mapRef.current.getZoom === 'function')
        ? mapRef.current.getZoom()
        : defaultStepZoom;

      const prevCenter = lastFlownCenterRef.current;
      const centerChanged = !prevCenter ||
        Math.abs(prevCenter.lat - center.lat) > 0.00005 ||
        Math.abs(prevCenter.lng - center.lng) > 0.00005 ||
        Math.abs(prevCenter.zoom - targetZoom) > 0.1;

      if (centerChanged) {
        lastFlownCenterRef.current = { lat: center.lat, lng: center.lng, zoom: targetZoom };
        mapRef.current.flyTo({
          center: [center.lng, center.lat],
          zoom: targetZoom,
          pitch: 0,
          bearing: 0,
          speed: 0.08,
          duration: 4800,
          essential: true
        });
      }
    }
  }, [center, zoom, bounds, routeBounds, cameraMode, driverLocation, mapLoaded, bottomPadding]);



  return (

    <div className={`relative z-0 w-full h-full min-h-[300px] ${className}`} style={{ isolation: 'isolate' }}>

      

      {/* MAPBOX CONTAINER - Identical to Student-Ride container styling */}

      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 bg-[#e4e2dc] dark:bg-[#191a1a] transition-colors" />







      {/* 659 POIS CATEGORY LAYER */}

      {mapLoaded && mapRef.current && (

        <POILayer map={mapRef.current} isNight={isNight} />

      )}







      {/* STATIC PICKUP / DROPOFF / USER MARKERS */}

      {mapLoaded && mapRef.current && markers && markers.length > 0 && (

        <MarkerLayer map={mapRef.current} markers={markers} />

      )}



      {/* VEHICLE ENGINE */}

      {mapLoaded && mapRef.current && drivers.length > 0 && (

        <VehicleEngine map={mapRef.current} drivers={drivers} />

      )}



      {/* ROUTE ENGINE */}

      {mapLoaded && mapRef.current && (

        routes && routes.length > 0 ? (

          routes.map((route, idx) => (

             <RouteEngine 

               key={`route-${route.rideId || idx}`}

               id={`route-${route.rideId || idx}`}

               map={mapRef.current}

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

              id="main-route"

              map={mapRef.current}

              geometry={routeGeometry}

              driverLocation={driverLocation}

              status={rideStatus}

              onAnimationChange={onRouteAnimationChange}

            />

          )

        )

      )}



    </div>

  );

};



export default PlatformMap;

