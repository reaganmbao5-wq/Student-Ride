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

  isNextStop = true,

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

  // Camera Guard Reset on Ride Acceptance / State Transition
  useEffect(() => {
    if (['driver_accepted', 'accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ongoing', 'ride_in_progress'].includes(rideStatus)) {
      hasManuallyInteractedRef.current = false;
      lastFittedBoundsRef.current = null;
    }
  }, [rideStatus]);

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

    let defaultFallbackLngLat = [28.559798, -14.294896];
    try {
      const savedLoc = localStorage.getItem('mulu_last_location') || localStorage.getItem('last_known_location');
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        const lat = parsed.lat ?? parsed.latitude;
        const lng = parsed.lng ?? parsed.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          defaultFallbackLngLat = [lng, lat];
        }
      }
    } catch (e) {}

    const initialCenter = (bounds && bounds.length >= 2)
      ? [(bounds[0][1] + bounds[1][1]) / 2, (bounds[0][0] + bounds[1][0]) / 2]
      : (center && typeof center.lat === 'number' && typeof center.lng === 'number' ? [center.lng, center.lat] : defaultFallbackLngLat);

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



    map.on('dragstart', (e) => {
      isUserDraggingRef.current = true;
      isUserInteractingRef.current = true;
      if (e && e.originalEvent) {
        hasManuallyInteractedRef.current = true;
      }
      if (onDragStart) onDragStart();
    });

    map.on('zoomstart', (e) => {
      if (e && e.originalEvent) {
        isUserInteractingRef.current = true;
        hasManuallyInteractedRef.current = true;
      }
    });

    map.on('rotatestart', (e) => {
      if (e && e.originalEvent) {
        isUserInteractingRef.current = true;
        hasManuallyInteractedRef.current = true;
      }
    });

    map.on('pitchstart', (e) => {
      if (e && e.originalEvent) {
        isUserInteractingRef.current = true;
        hasManuallyInteractedRef.current = true;
      }
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
    const isActiveRide = ['driver_accepted', 'accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ongoing', 'ride_started', 'ride_in_progress', 'arriving_destination'].includes(rideStatus);

    if (cameraMode === CAMERA_MODES.FOLLOW_DRIVER || isActiveRide) {
      const activeLoc = driverLocation || (center && typeof center.lat === 'number' && typeof center.lng === 'number' ? center : null);
      if (activeLoc) {
        const lat = Number(activeLoc.lat ?? activeLoc.latitude);
        const lng = Number(activeLoc.lng ?? activeLoc.longitude);
        const heading = Number(activeLoc.heading || 0);

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
            // Dynamic Zoom Logic for Shared & Private Rides:
            // If the student is next in line (or private ride): zoom in tight (17.5)
            // If the student is waiting for others in shared ride: zoom out (15.0) to see wider context in 3D 45° tilt tracking driver
            const isNext = isNextStop !== false;
            const targetZoom = isDriverView ? 16.5 : (isNext ? 17.5 : 15.0);

            const effBottom = (typeof bottomPadding === 'number' && bottomPadding > 0) ? Math.max(bottomPadding, 220) : 220;

            mapRef.current.easeTo({
              center: [lng, lat], // STRICTLY track the driver in 3D
              offset: [0, -Math.round(effBottom * 0.35)], // Places vehicle comfortably in lower-third
              bearing: heading,
              pitch: 45, // Instant and permanent 3D tilt
              zoom: targetZoom,
              duration: 1000,
              essential: true
            });
            return;
          }
        }
      }
      // Strict 3D Lock: Active ride follow mode NEVER drops down to 2D pitch:0 overview!
      return;
    }

    // 2. OVERVIEW / BOUNDS MODE (Confirm Ride / Finding a Driver / Route Preview)
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
        const isMiniMap = containerHeight < 250;

        if (isMiniMap) {
          try {
            mapRef.current.resize();
            const miniCamera = mapRef.current.cameraForBounds([
              [minLng, minLat],
              [maxLng, maxLat]
            ], {
              padding: { top: 16, bottom: 16, left: 16, right: 16 }
            });
            if (miniCamera && typeof miniCamera.zoom === 'number') {
              mapRef.current.jumpTo({
                center: miniCamera.center,
                zoom: Math.min(15.5, miniCamera.zoom),
                pitch: 0,
                bearing: 0
              });
              return;
            }
          } catch (e) {}
        }

        // Top clearance for header and back button (110px on mobile to clear top status bar and back button)
        const calcTop = 110;
        // Dynamic bottom padding to place route safely above the bottom sheet card
        const calcBottom = (typeof bottomPadding === 'number' && bottomPadding > 0)
          ? Math.min(bottomPadding + 25, Math.round(containerHeight * 0.48))
          : Math.max(220, Math.round(containerHeight * 0.38));
        // Generous side margins so pins with labels/icons on far edges are NEVER clipped (15% width clearance)
        const calcSide = Math.max(55, Math.min(95, Math.round(containerWidth * 0.15)));

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
            const balancedZoom = Math.min(16.0, targetCamera.zoom);
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
          duration: 1200,
          essential: true
        });
      }
    }
  }, [center, zoom, bounds, routeBounds, cameraMode, driverLocation, rideStatus, isNextStop, mapLoaded, bottomPadding]);



  return (

    <div className={`relative z-0 w-full h-full ${className}`} style={{ isolation: 'isolate' }}>

      

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



      {/* UNIFIED ROUTE ENGINE: Single persistent instance for all single and multi-stop trips */}
      {mapLoaded && mapRef.current && (
        <RouteEngine 
          map={mapRef.current}
          routes={routes}
          routeGeometry={routeGeometry}
          driverLocation={driverLocation}
          rideStatus={rideStatus}
          onAnimationChange={onRouteAnimationChange}
        />
      )}



    </div>

  );

};



export default PlatformMap;

